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
  if(primitive)return [...new Set([...remote,...local])];
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
