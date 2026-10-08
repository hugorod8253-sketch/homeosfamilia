import {classifyProduct,normalizeProductText} from './product-engine';
import {planToBase,planFromBase,planUnitFamily,normalizePlanUnit} from './recipe-plan-engine';
import {calendarDaysUntil,localDateIso,isCalendarDate} from './local-date';
export type ConsumptionHabit={id:string;name:string;qty:number;unit:string;days:number};
export type StockCheck={id:string;name:string;qty:number;unit:string;date:string;location:string};
type Purchase={name:string;category?:string;qty:number;unit:string;date:string};
type Item=Purchase&{purchasedAt?:string;lastConfirmedAt?:string;estimateAnchorDate?:string;estimateAnchorQty?:number;location?:string;storageMode?:string};
function key(name:string,category?:string){return normalizeProductText(classifyProduct(name,category).canonical)}
function validDate(date:string){return isCalendarDate(date)}
function compatible(a:string,b:string){const f=planUnitFamily(a);return f===planUnitFamily(b)&&(f==='mass'||f==='volume'||normalizePlanUnit(a)===normalizePlanUnit(b))}
function median(xs:number[]){const s=xs.sort((a,b)=>a-b);return s.length%2?s[Math.floor(s.length/2)]:(s[s.length/2-1]+s[s.length/2])/2}
/** Purchase intervals are a provisional hint, never proof of consumption or a stock mutation. */
export function estimateConsumption(item:Omit<Item,'date'>,purchases:Purchase[],habits:ConsumptionHabit[]=[],checks:StockCheck[]=[],today=localDateIso(),allocation=1){
 const canonical=key(item.name,item.category);
 const matches=(p:{name:string;category?:string;unit:string})=>key(p.name,p.category)===canonical&&compatible(p.unit,item.unit);
 const buys=purchases.filter(p=>matches(p)&&p.qty>0&&Number.isFinite(p.qty)&&validDate(p.date)&&p.date<=today);
 const daily=new Map<string,number>();for(const p of buys)daily.set(p.date,(daily.get(p.date)||0)+planToBase(p.qty,p.unit));
 const dates=[...daily.keys()].sort(),rates:number[]=[];
 for(let i=1;i<dates.length;i++){const days=calendarDaysUntil(dates[i],new Date(dates[i-1]+'T12:00:00'));if(days>=2)rates.push((daily.get(dates[i-1])||0)/days)}
 // All-location totals avoid treating a move between fridge and freezer as consumption.
 const snapshots=checks.filter(c=>matches(c)&&c.location==='Todo'&&c.qty>=0&&validDate(c.date)&&c.date<=today).sort((a,b)=>a.date.localeCompare(b.date));
 const confirmedRates:number[]=[];
 for(let i=1;i<snapshots.length;i++){const a=snapshots[i-1],b=snapshots[i],days=calendarDaysUntil(b.date,new Date(a.date+'T12:00:00'));if(days<2)continue;const incoming=buys.filter(p=>p.date>a.date&&p.date<=b.date).reduce((sum,p)=>sum+planToBase(p.qty,p.unit),0);const used=planToBase(a.qty,a.unit)+incoming-planToBase(b.qty,b.unit);if(used>=0)confirmedRates.push(used/days)}
 const habit=habits.find(h=>matches(h)&&Number.isFinite(h.qty)&&Number.isFinite(h.days)&&h.qty>0&&h.days>0);
 const source=confirmedRates.length?'confirmed':habit?'habit':rates.length>=1?'purchases':'unknown';
 const rate=confirmedRates.length?median(confirmedRates.slice(-6)):habit?planToBase(habit.qty,habit.unit)/habit.days:rates.length>=1?median(rates.slice(-6)):0;
 const anchor=item.estimateAnchorDate||item.lastConfirmedAt||item.purchasedAt;
 const age=anchor&&validDate(anchor)?Math.max(0,-calendarDaysUntil(anchor,new Date(today+'T12:00:00'))):0;
 const base=planToBase(item.qty<=0?0:Math.max(0,item.estimateAnchorQty??item.qty),item.unit);
 const allocatedRate=item.qty<=0||item.storageMode==='reserva'||item.location==='Congelador'?0:rate*Math.max(0,Math.min(1,allocation));
 const remaining=item.storageMode==='reserva'||item.location==='Congelador'||!rate?base:Math.max(0,base-allocatedRate*age);
 return {source,dailyRate:planFromBase(allocatedRate,item.unit),estimatedQty:Math.round(planFromBase(remaining,item.unit)*100)/100,daysLeft:allocatedRate?remaining/allocatedRate:null,confidence:source==='confirmed'?'media':source==='unknown'?'sin datos':'baja',basis:source==='confirmed'?'Ritmo ajustado con cantidades confirmadas y compras':source==='purchases'?'Ritmo provisional de recompra; comprar no demuestra que se haya acabado':source==='habit'?'Ritmo inicial indicado por ti; todavía sin comprobar':'Aún no hay datos suficientes de consumo'};
}
export function shoppingQuantityStep(unit:string){return /^(g|ml)$/i.test(unit)?10:/^(kg|l)$/i.test(unit)?.1:1}
export function changeShoppingQuantity(qty:number,unit:string,delta:number){
 const measured=planUnitFamily(unit)==='mass'||planUnitFamily(unit)==='volume';
 const minimum=measured&&/^(kg|l)$/i.test(unit)?.01:1;
 return Math.round(Math.max(Math.min(qty,minimum),qty+delta*shoppingQuantityStep(unit))*100)/100;
}

/** A household rate is shared once across compatible locations, not applied to every row. */
export function estimateInventoryConsumption(item:Omit<Item,'date'>,inventory:Array<Omit<Item,'date'>&{stock?:string}>,purchases:Purchase[],habits:ConsumptionHabit[]=[],checks:StockCheck[]=[],today=localDateIso()){
 const peers=inventory.filter(i=>i.stock!=='falta'&&i.qty>0&&i.location!=='Congelador'&&i.storageMode!=='reserva'&&key(i.name,i.category)===key(item.name,item.category)&&compatible(i.unit,item.unit));
 const total=peers.reduce((sum,i)=>sum+planToBase(Math.max(0,i.estimateAnchorQty??i.qty),i.unit),0);
 const own=planToBase(Math.max(0,item.estimateAnchorQty??item.qty),item.unit);
 return estimateConsumption(item,purchases,habits,checks,today,total>0?own/total:1);
}
