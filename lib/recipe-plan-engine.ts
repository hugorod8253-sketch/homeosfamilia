import { classifyProduct } from "./product-engine";

export type PlanIngredient={name:string;qty:string;key:string};
export type PlanInventoryItem={name:string;qty:number;unit:string;category:string;stock?:string};
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
export function planProductMatches(item:PlanInventoryItem,key:string){
 if(item.stock==="falta"||item.qty<=0)return false;
 const k=norm(key);
 const p=classifyProduct(item.name,item.category);
 if(k==="verdura")return item.category==="Fruta y verdura"&&p.subcategory!=="Fruta";
 if(k==="fruta")return item.category==="Fruta y verdura"&&p.subcategory==="Fruta";
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
   if(!planProductMatches(item,ing.key))continue;
   if(planUnitFamily(item.unit)!==family)continue;
   if(family==="count"&&normalizePlanUnit(parsed.unit)!=="ud"&&normalizePlanUnit(item.unit)!==normalizePlanUnit(parsed.unit))continue;
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
