import {consumptionKey, type ConsumptionExtra} from "./consumption-engine";
import {planFromBase,planToBase,planUnitFamily,normalizePlanUnit} from "./recipe-plan-engine";

/** Only an estimate anchor changes. The last physically confirmed quantity remains untouched. */
export type ForecastLot={
 id:string;name:string;category?:string;qty:number;unit:string;stock?:string;location?:string;storageMode?:string;
 estimateAnchorDate?:string;estimateAnchorQty?:number;purchasedAt?:string;lastConfirmedAt?:string;
 expires?:string;estimatedExpires?:string;
};
type Forecast={estimatedQty:number};
const round=(n:number)=>Math.round(n*1000)/1000;

function inEventUnits(amount:number,unit:string,eventUnit:string,milkPackLiters:number|null,product:string):number|null{
 const f=planUnitFamily(unit),target=planUnitFamily(eventUnit);
 if(f===target&&(f==="mass"||f==="volume"))return planToBase(amount,unit);
 if(normalizePlanUnit(unit)===normalizePlanUnit(eventUnit))return amount;
 if(product==="leche"&&["brick","bricks"].includes(normalizePlanUnit(unit))&&target==="volume"&&milkPackLiters){
  return amount*1000*milkPackLiters;
 }
 return null;
}
function fromEventUnits(base:number,unit:string,eventUnit:string,milkPackLiters:number|null,product:string):number|null{
 const f=planUnitFamily(unit),target=planUnitFamily(eventUnit);
 if(f===target&&(f==="mass"||f==="volume"))return planFromBase(base,unit);
 if(normalizePlanUnit(unit)===normalizePlanUnit(eventUnit))return base;
 if(product==="leche"&&["brick","bricks"].includes(normalizePlanUnit(unit))&&target==="volume"&&milkPackLiters){
  return base/(1000*milkPackLiters);
 }
 return null;
}

/**
 * Record actual extra use once, using current estimated lots in expiry order.
 * Events marked as charged remain in the audit trail and can calibrate
 * confirmed rates, but must not be deducted a second time during forecast reads.
 * Unknown pack sizes are not guessed: their related items remain unchanged.
 */
export function chargeVisitorUse<T extends ForecastLot>(
 inventory:T[],events:ConsumptionExtra[],today:string,estimate:(item:T)=>Forecast,milkPackLiters:number|null
):{inventory:T[];events:ConsumptionExtra[];unmatched:string[]}{
 const products=inventory.map((item,index)=>({
  item,index,estimatedQty:Math.max(0,Number(estimate(item).estimatedQty)||0)
 }));
 const unmatched:string[]=[];
 for(const event of events){
  if(!(event.qty>0)||!Number.isFinite(event.qty)||!event.unit)continue;
  const product=consumptionKey(event.name);
  let remaining=planToBase(event.qty,event.unit);
  let hadCompatible=false;
  const matches=products.filter(lot=>
   lot.item.qty>0&&lot.item.stock!=="falta"&&lot.item.location!=="Congelador"&&lot.item.storageMode!=="reserva"&&
   consumptionKey(lot.item.name,lot.item.category)===product&&
   inEventUnits(1,lot.item.unit,event.unit,milkPackLiters,product)!==null
  ).sort((a,b)=>(a.item.expires||a.item.estimatedExpires||"9999").localeCompare(b.item.expires||b.item.estimatedExpires||"9999")||
   (a.item.purchasedAt||"").localeCompare(b.item.purchasedAt||"")||a.index-b.index);
  for(const lot of matches){
   hadCompatible=true;
   const capacity=inEventUnits(lot.estimatedQty,lot.item.unit,event.unit,milkPackLiters,product)||0;
   const used=Math.min(capacity,remaining);
   const back=fromEventUnits(capacity-used,lot.item.unit,event.unit,milkPackLiters,product);
   if(back===null)continue;
   if(used>0){lot.estimatedQty=round(Math.max(0,back));lot.item={...lot.item,estimateAnchorDate:today,estimateAnchorQty:lot.estimatedQty};}
   remaining-=used;
   if(remaining<=.00001)break;
  }
  if(!hadCompatible||remaining>.00001)unmatched.push(event.name);
 }
 return {
  inventory:products.sort((a,b)=>a.index-b.index).map(lot=>lot.item),
  events:events.map(e=>({...e,charged:true})),
  unmatched:[...new Set(unmatched)]
 };
}
