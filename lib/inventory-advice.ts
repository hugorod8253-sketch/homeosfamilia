import {classifyProduct,normalizeProductText} from './product-engine';
import {calendarDaysUntil,isCalendarDate,localDateIso} from './local-date';
type Item={id:string;name:string;category?:string;qty:number;stock?:string;location?:string;purchasedAt?:string;purchaseDateUnknown?:boolean;expires?:string;estimatedExpires?:string};
export function inventoryProductKey(item:{name:string;category?:string}){return normalizeProductText(classifyProduct(item.name,item.category).canonical)}
/** Known dates precede purchase age; no estimated date is presented as a label date. */
export function comparePurchasePriority(a:Item,b:Item){
 const deadline=(i:Item)=>i.location==='Congelador'?'9999-12-31':i.expires||i.estimatedExpires||'9999-12-31';
 return deadline(a).localeCompare(deadline(b))||(a.purchaseDateUnknown?'9999':a.purchasedAt||'9999').localeCompare(b.purchaseDateUnknown?'9999':b.purchasedAt||'9999');
}
export function possibleExistingPurchase(inventory:Item[],product:{name:string;category?:string},today=localDateIso()){
 const key=inventoryProductKey(product);
 const item=inventory.filter(i=>i.stock!=='falta'&&i.qty>0&&inventoryProductKey(i)===key).sort(comparePurchasePriority)[0];
 if(!item)return null;
 const age=item.purchasedAt&&!item.purchaseDateUnknown&&isCalendarDate(item.purchasedAt)?Math.max(0,-calendarDaysUntil(item.purchasedAt,new Date(today+'T12:00:00'))):null;
 return {item,text:age===null?'Podría quedar en '+(item.location||'Casa'):(age===0?'Comprado hoy':age===1?'Comprado ayer':'Comprado hace '+age+' días')+' · podría quedar'+(item.location==='Congelador'?' en el congelador':'')};
}
/** Replenishment is per product, never per purchase lot. A remaining peer suppresses it. */
export function replenishmentCandidates<T extends Item>(inventory:T[],shopping:Array<{name:string;category?:string}>,probability:(i:T)=>number,dismissed:string[]=[]){
 const listed=new Set(shopping.map(inventoryProductKey));
 const groups=new Map<string,T[]>();
 for(const i of inventory){const key=inventoryProductKey(i);if(listed.has(key))continue;groups.set(key,[...(groups.get(key)||[]),i])}
 const out:T[]=[];
 for(const peers of groups.values()){
  if(peers.some(i=>dismissed.includes(i.id)))continue;
  if(peers.some(i=>i.stock!=='falta'&&probability(i)>=.32))continue;
  const eligible=peers.filter(i=>i.category!=='Preparados'&&i.location!=='Congelador').sort((a,b)=>(b.purchasedAt||'').localeCompare(a.purchasedAt||''));
  if(eligible[0])out.push(eligible[0]);
 }
 return out;
}
