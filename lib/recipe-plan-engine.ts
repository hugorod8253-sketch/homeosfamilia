import { classifyProduct } from "./product-engine";

export type PlanIngredient={name:string;qty:string;key:string};
export type PlanInventoryItem={name:string;qty:number;unit:string;category:string;stock?:string;expires?:string;estimatedExpires?:string;purchasedAt?:string};
export type RecipeShortage={name:string;key:string;unit:string;required:number;available:number;missing:number};
export type ShoppingSource={
 id:string;
 type:"manual"|"recipe"|"weekly"|"restock";
 label:string;
 qty:number;
 unit:string;
 planId?:string;
 recipeId?:string;
 plannedFor?:string;
 buyAfter?:string;
};

export function normalizePlanUnit(unit:string){
 const u=unit.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\./g,"").trim();
 if(["l","litro","litros"].includes(u))return "L";
 if(["ml","mililitro","mililitros"].includes(u))return "ml";
 if(["kg","kilo","kilos"].includes(u))return "kg";
 if(["g","gramo","gramos"].includes(u))return "g";
 if(["ud","uds","unidad","unidades"].includes(u))return "ud";
 if(["racion","raciones"].includes(u))return "racion";
 if(["loncha","lonchas"].includes(u))return "loncha";
 return u||"ud";
}
export function planUnitFamily(unit:string){
 const u=normalizePlanUnit(unit);
 if(u==="L"||u==="ml")return "volume";
 if(u==="kg"||u==="g")return "mass";
 if(["ud","racion","loncha"].includes(u))return "count";
 return "other";
}
export function planToBase(amount:number,unit:string){
 const u=normalizePlanUnit(unit);
 if(u==="L"||u==="kg")return amount*1000;
 return amount;
}
export function planFromBase(amount:number,unit:string){
 const u=normalizePlanUnit(unit);
 if(u==="L"||u==="kg")return amount/1000;
 return amount;
}
export function parsePlanQty(qty:string){
 const m=qty.trim().match(/([\d.,]+)\s*([a-zA-Záéíóúñ]+)?/);
 if(!m)return null;
 return {amount:Number(m[1].replace(",","."))||0,unit:normalizePlanUnit(m[2]||"ud")};
}
function norm(s:string){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
export function planProductMatches(item:PlanInventoryItem,key:string,ingredientName=key){
 if(item.stock==="falta"||item.qty<=0)return false;
 const k=norm(key);
 const p=classifyProduct(item.name,item.category);
 if(k==="verdura")return item.category==="Fruta y verdura"&&p.subcategory!=="Fruta";
 if(k==="fruta")return item.category==="Fruta y verdura"&&p.subcategory==="Fruta";
 const target=classifyProduct(ingredientName);
 if(target.category!=="Por clasificar"&&p.category!==target.category)return false;
 if(target.category==="Carne"&&p.subcategory!==target.subcategory)return false;
 const requested=norm(ingredientName), actual=norm(item.name);
 if(/garbanzo|lenteja|alubia/.test(requested)&&/cocid|conserva/.test(requested)&&!/cocid|conserva|bote|tarro/.test(actual))return false;
 if(k===requested&&target.category!=="Por clasificar")return norm(p.canonical)===norm(target.canonical);
 const n=norm(item.name),canonical=norm(p.canonical);
 return n.includes(k)||canonical.includes(k)||k.includes(canonical);
}
export function recipeShortages(ingredients:PlanIngredient[],inventory:PlanInventoryItem[]):RecipeShortage[]{
 const out:RecipeShortage[]=[];
 for(const ing of ingredients){
  const parsed=parsePlanQty(ing.qty);
  if(!parsed)continue;
  const family=planUnitFamily(parsed.unit);
  const requiredBase=planToBase(parsed.amount,parsed.unit);
  let availableBase=0;
  for(const item of inventory){
   if(!planProductMatches(item,ing.key,ing.name))continue;
   if(planUnitFamily(item.unit)!==family)continue;
   if(family==="count"&&normalizePlanUnit(item.unit)!==normalizePlanUnit(parsed.unit))continue;
   availableBase+=planToBase(Math.max(0,item.qty),item.unit);
  }
  const missingBase=Math.max(0,requiredBase-availableBase);
  if(missingBase<=0)continue;
  out.push({
   name:ing.name,key:ing.key,unit:parsed.unit,
   required:Math.round(parsed.amount*100)/100,
   available:Math.round(planFromBase(availableBase,parsed.unit)*100)/100,
   missing:Math.round(planFromBase(missingBase,parsed.unit)*100)/100
  });
 }
 return out;
}

/** Allocate real ingredients once; preserve unrelated inventory and incompatible units. */
export function consumePlanIngredients<T extends PlanInventoryItem>(items:T[],ingredients:PlanIngredient[],eligible:(item:T)=>boolean=()=>true){
 const inventory=items.map(item=>({...item}));
 let exact=true;
 for(const ingredient of ingredients){
  const parsed=parsePlanQty(ingredient.qty);
  if(!parsed||parsed.amount<=0){exact=false;continue}
  let remaining=planToBase(parsed.amount,parsed.unit);
  const indexes=inventory.map((item,index)=>({index,expires:item.expires||item.estimatedExpires||"9999",purchasedAt:item.purchasedAt||"9999"})).sort((a,b)=>a.expires.localeCompare(b.expires)||a.purchasedAt.localeCompare(b.purchasedAt)).map(x=>x.index);
  for(const index of indexes){
   if(remaining<=0)break;
   const item=inventory[index];
   if(!eligible(item)||!planProductMatches(item,ingredient.key,ingredient.name))continue;
   if(planUnitFamily(item.unit)!==planUnitFamily(parsed.unit)||
      (planUnitFamily(parsed.unit)==="count"&&normalizePlanUnit(item.unit)!==parsed.unit))continue;
   const available=planToBase(item.qty,item.unit);
   const used=Math.min(available,remaining);
   const qty=Math.max(0,Math.round(planFromBase(available-used,item.unit)*100)/100);
   inventory[index]={...item,qty,stock:qty===0?"falta":used>=available*.75?"poco":item.stock};
   remaining-=used;
  }
  if(remaining>0.000001)exact=false;
 }
 return {inventory,exact};
}
export function sumSources(sources:ShoppingSource[],unit:string){
 const family=planUnitFamily(unit);
 let totalBase=0;
 for(const source of sources){
  if(planUnitFamily(source.unit)!==family)continue;
  totalBase+=planToBase(source.qty,source.unit);
 }
 return Math.round(planFromBase(totalBase,unit)*100)/100;
}
export function removePlanFromSources(sources:ShoppingSource[]|undefined,planId:string){
 return (sources||[]).filter(s=>s.planId!==planId);
}


export function freeInventoryAfterReservations<T extends PlanInventoryItem & {planReservations?:ShoppingSource[]}>(items:T[],activePlanIds:string[],exceptPlanId?:string):T[]{
 const active=new Set(activePlanIds);
 return items.map(item=>{
  let freeBase=planToBase(Math.max(0,item.qty),item.unit);
  for(const reservation of item.planReservations||[]){
   if(!reservation.planId||!active.has(reservation.planId)||reservation.planId===exceptPlanId)continue;
   if(planUnitFamily(reservation.unit)!==planUnitFamily(item.unit))continue;
   freeBase-=planToBase(Math.max(0,reservation.qty),reservation.unit);
  }
  const qty=Math.max(0,Math.round(planFromBase(Math.max(0,freeBase),item.unit)*100)/100);
  return {...item,qty};
 });
}


export function remainingSourcesAfterPurchase(sources:ShoppingSource[],purchasedQty:number,purchasedUnit:string){
 let remainingBase=planToBase(Math.max(0,purchasedQty),purchasedUnit);
 const priority=(x:ShoppingSource)=>x.type==="recipe"?0:x.type==="weekly"?1:x.type==="manual"?2:3;
 const ordered=sources.map((source,index)=>({source,index})).sort((a,b)=>priority(a.source)-priority(b.source)||(a.source.plannedFor||"9999").localeCompare(b.source.plannedFor||"9999"));
 const next=[...sources];
 for(const {source,index} of ordered){
  if(remainingBase<=0)break;
  if(planUnitFamily(source.unit)!==planUnitFamily(purchasedUnit))continue;
  const sourceBase=planToBase(Math.max(0,source.qty),source.unit);
  const fulfilled=Math.min(sourceBase,remainingBase);
  const left=Math.max(0,sourceBase-fulfilled);
  next[index]={...source,qty:Math.round(planFromBase(left,source.unit)*100)/100};
  remainingBase-=fulfilled;
 }
 return next.filter(x=>x.qty>0);
}

/** Resize a shared manual line without assigning its full total to every contributor. */
export function resizeShoppingSources(sources:ShoppingSource[],targetQty:number,unit:string){
 const current=sumSources(sources,unit);
 if(targetQty<=current)return remainingSourcesAfterPurchase(sources,current-Math.max(0,targetQty),unit);
 const first=sources.findIndex(s=>planUnitFamily(s.unit)===planUnitFamily(unit));
 if(first<0)return sources;
 return sources.map((s,i)=>i===first?{...s,qty:Math.round((s.qty+planFromBase(planToBase(targetQty-current,unit),s.unit))*100)/100}:s);
}
