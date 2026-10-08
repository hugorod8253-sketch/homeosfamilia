import { classifyProduct, normalizeProductText } from './product-engine';
function stable(v:unknown){try{return JSON.stringify(v)}catch{return String(v)}}
function same(a:unknown,b:unknown){return stable(a)===stable(b)}
function isRecord(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==="object"&&!Array.isArray(v)}
function idArray(v:unknown):v is Array<Record<string,unknown>&{id:string}>{
 return Array.isArray(v)&&v.every(x=>isRecord(x)&&typeof x.id==="string");
}

export function mergeThreeWay(base:any,local:any,remote:any):any{
 if(same(local,remote))return local;
 if(same(local,base))return remote;
 if(same(remote,base))return local;

 if(idArray(local)&&idArray(remote)&&(base===undefined||idArray(base))){
  const baseArr=idArray(base)?base:[];
  const bm=new Map(baseArr.map(x=>[x.id,x]));
  const lm=new Map(local.map(x=>[x.id,x]));
  const rm=new Map(remote.map(x=>[x.id,x]));
  const order=[...remote.map(x=>x.id),...local.map(x=>x.id).filter(id=>!rm.has(id))];
  const out:any[]=[];
  for(const id of order){
   const b=bm.get(id),l=lm.get(id),r=rm.get(id);
   if(l===undefined&&r===undefined)continue;
   if(b!==undefined&&l===undefined){
    if(same(r,b))continue;
    if(r!==undefined)out.push(r);
    continue;
   }
   if(b!==undefined&&r===undefined){
    if(same(l,b))continue;
    if(l!==undefined)out.push(l);
    continue;
   }
   if(l!==undefined&&r!==undefined)out.push(mergeThreeWay(b,l,r));
   else out.push(l??r);
  }
  return out;
 }

 if(Array.isArray(local)&&Array.isArray(remote)&&Array.isArray(base)){
  const primitive=[...base,...local,...remote].every(x=>x==null||["string","number","boolean"].includes(typeof x));
  if(primitive)return [...new Set([...remote,...local])].filter(value=>!base.includes(value)||(local.includes(value)&&remote.includes(value)));
  return local;
 }

 if(isRecord(local)&&isRecord(remote)&&(base===undefined||isRecord(base))){
  const b=isRecord(base)?base:{};
  const keys=new Set([...Object.keys(b),...Object.keys(local),...Object.keys(remote)]);
  const out:Record<string,unknown>={};
  for(const key of keys){
   const hasL=Object.prototype.hasOwnProperty.call(local,key);
   const hasR=Object.prototype.hasOwnProperty.call(remote,key);
   const hasB=Object.prototype.hasOwnProperty.call(b,key);
   if(!hasL&&!hasR)continue;
   if(hasB&&!hasL){
    if(hasR&&!same(remote[key],b[key]))out[key]=remote[key];
    continue;
   }
   if(hasB&&!hasR){
    if(hasL&&!same(local[key],b[key]))out[key]=local[key];
    continue;
   }
   if(hasL&&hasR)out[key]=mergeThreeWay(hasB?b[key]:undefined,local[key],remote[key]);
   else out[key]=hasL?local[key]:remote[key];
  }
  return out;
 }
 return local;
}

export function mergeAdditiveCounter(base:unknown,local:unknown,remote:unknown){
 const b=Number(base)||0,l=Number(local)||0,r=Number(remote)||0;
 return Math.max(0,b+(l-b)+(r-b));
}

export function mergeHouseholdState(base:any,local:any,remote:any){
 if(same(local,remote))return local;
 const merged={...mergeThreeWay(base,local,remote)};
 for(const key of ["spent","waste","wasteSaved"]){
  if(key in local||key in remote)merged[key]=mergeAdditiveCounter(base[key],local[key],remote[key]);
 }
 // A checkout already present on both devices is one expense, not two.
 if(Array.isArray(base.purchaseSessions)&&Array.isArray(local.purchaseSessions)&&Array.isArray(remote.purchaseSessions)){
  const known=new Set(base.purchaseSessions.map((x:any)=>x.id));
  const localNew=new Map(local.purchaseSessions.filter((x:any)=>!known.has(x.id)).map((x:any)=>[x.id,x.total]));
  const shared=remote.purchaseSessions.filter((x:any)=>!known.has(x.id)&&localNew.get(x.id)===x.total).reduce((n:number,x:any)=>n+(Number(x.total)||0),0);
  merged.spent=Math.max(0,merged.spent-shared);
 }
 // Combine independent, logged stock changes. A manual recount takes precedence
 // over arithmetic, and a shared action must never be applied twice.
 if(idArray(base.inventory)&&idArray(local.inventory)&&idArray(remote.inventory)){
  const bm=new Map<string,any>(base.inventory.map((i:any)=>[i.id,i] as [string,any]));
  const lm=new Map<string,any>(local.inventory.map((i:any)=>[i.id,i] as [string,any]));
  const rm=new Map<string,any>(remote.inventory.map((i:any)=>[i.id,i] as [string,any]));
  const canonical=(name:string,category?:string)=>normalizeProductText(classifyProduct(name,category).canonical);
  const actions=(side:any,item:any,delta:number)=>{
   const field=delta>0?'purchaseHistory':'mealHistory';
   const prior=new Set((base[field]||[]).map((x:any)=>x.id));
   return (side[field]||[]).filter((x:any)=>!prior.has(x.id)&&(delta>0?canonical(x.name,x.category)===canonical(item.name,item.category):x.title===item.name||(x.ingredients||[]).some((v:any)=>canonical(v.name,v.category)===canonical(item.name,item.category)))).map((x:any)=>x.id);
  };
  merged.inventory=merged.inventory.map((item:any)=>{
   const b=bm.get(item.id),l=lm.get(item.id),r=rm.get(item.id);
   if(!b||!l||!r||l.unit!==b.unit||r.unit!==b.unit||l.location!==b.location||r.location!==b.location)return item;
   const manualL=l.lastStockCheckId!==b.lastStockCheckId,manualR=r.lastStockCheckId!==b.lastStockCheckId;
   if(manualL||manualR){const count=manualL?l:r;return {...item,qty:count.qty,stock:count.stock,estimateAnchorQty:count.estimateAnchorQty,estimateAnchorDate:count.estimateAnchorDate,lastConfirmedAt:count.lastConfirmedAt,lastStockCheckId:count.lastStockCheckId}}
   const dl=l.qty-b.qty,dr=r.qty-b.qty;
   if(!dl||!dr)return item;
   const la=actions(local,b,dl),ra=actions(remote,b,dr);
   if(!la.length||!ra.length||la.some((id:string)=>ra.includes(id)))return item;
   const qty=Math.max(0,Math.round((b.qty+dl+dr)*100)/100);
   const estimateAnchorQty=Math.max(0,Math.min(qty,(l.estimateAnchorQty??l.qty)+(r.estimateAnchorQty??r.qty)-(b.estimateAnchorQty??b.qty)));
   return {...item,qty,stock:qty===0?'falta':item.stock==='falta'?'poco':item.stock,estimateAnchorQty,servings:item.category==='Preparados'?qty:item.servings};
  });
 }
 return merged;
}
