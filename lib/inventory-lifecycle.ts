import { classifyProduct, normalizeProductText } from './product-engine';
import { normalizePlanUnit, planUnitFamily, planToBase, planFromBase } from './recipe-plan-engine';
import type { StockCheck } from './consumption-engine';

type StockItem={id:string;name:string;category:string;qty:number;unit:string;location:string;stock:string;lastConfirmedAt?:string;estimateAnchorQty?:number;estimateAnchorDate?:string;servings?:number;expires?:string;dateType?:string;estimatedExpires?:string;estimatedDateType?:string;estimateBasis?:string;frozenAt?:string;originalExpires?:string;qualityReviewAt?:string;storageMode?:string;reservedFor?:string};
function canonical(i:StockItem){return normalizeProductText(classifyProduct(i.name,i.category).canonical)}
function compatible(a:string,b:string){const family=planUnitFamily(a);return family===planUnitFamily(b)&&(family==='mass'||family==='volume'||normalizePlanUnit(a)===normalizePlanUnit(b))}

/** Never call stale quantities in other locations a confirmed household count. */
export function appendConfirmedStockCheck(checks:StockCheck[],inventory:StockItem[],item:StockItem,today:string){
 const peers=inventory.filter(i=>canonical(i)===canonical(item)&&compatible(i.unit,item.unit));
 const complete=peers.every(i=>i.lastConfirmedAt===today);
 const scope=complete?peers:peers.filter(i=>i.location===item.location&&i.lastConfirmedAt===today);
 const location=complete?'Todo':item.location;
 const qty=planFromBase(scope.reduce((n,i)=>n+planToBase(i.qty,i.unit),0),item.unit);
 const check:StockCheck={id:crypto.randomUUID(),name:classifyProduct(item.name,item.category).canonical,qty,unit:item.unit,date:today,location};
 return [...checks.filter(c=>!(c.date===today&&normalizeProductText(c.name)===normalizeProductText(check.name)&&compatible(c.unit,item.unit)&&c.location===location)),check];
}

export function emptyInventoryItem<T extends StockItem>(item:T,today:string):T{
 return {...item,stock:'falta',qty:0,servings:item.category==='Preparados'?0:item.servings,lastConfirmedAt:today,lastStockCheckId:crypto.randomUUID(),estimateAnchorQty:0,estimateAnchorDate:today};
}

export function freezeInventoryItem<T extends StockItem>(item:T,today:string,estimatedQty:number):T{
 return {...item,location:'Congelador',frozenAt:today,originalExpires:item.originalExpires||item.expires,expires:undefined,dateType:undefined,estimatedExpires:undefined,estimatedDateType:undefined,estimateBasis:undefined,estimateAnchorQty:estimatedQty,estimateAnchorDate:today};
}

export function thawInventoryItem<T extends StockItem>(item:T,location:string,today:string):T{
 return {...item,location,frozenAt:undefined,qualityReviewAt:undefined,storageMode:'normal',reservedFor:undefined,stock:item.qty>0?'incierto':'falta',lastConfirmedAt:undefined,estimateAnchorDate:today};
}
