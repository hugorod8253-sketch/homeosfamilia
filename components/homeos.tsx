"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { clearSync, connectionCode, createRemoteHousehold, getStoredSync, parseConnectionCode, readRemoteHousehold, storeSync, syncConfigured, type SyncCredentials, writeRemoteHousehold } from "../lib/homeos-sync";
import { addMonthsIso, canStoreAt, classifyProduct, detectProductsInText, freezerQualityGuide, recommendedLocation, storageWarning } from "../lib/product-engine";
import { ProductGlyph } from "./product-glyph";
import { REUSE_IDEAS, reuseIdeaMatchesProduct, type ReuseNeed } from "../lib/reuse-engine";
import { EXTRA_RECIPES } from "../lib/extra-recipes";
import { generateLocalRecipes, localAiSupported } from "../lib/local-ai";
import { readReceiptImage, type ReceiptCandidate } from "../lib/receipt-local";
import { estimateShelfLifeFromReference, shelfLifeBandFromReference } from "../lib/shelf-life-calibration";
import { buildWeeklyMenu, type WeeklyMenuPlan } from "../lib/weekly-menu";
import { planUnitFamily, recipeShortages, removePlanFromSources, sumSources, type ShoppingSource } from "../lib/recipe-plan-engine";

type View = "inicio"|"comer"|"comprar"|"casa"|"finanzas";
type StockState = "hay"|"poco"|"falta"|"mucho"|"incierto";
type Location = "Nevera"|"Congelador"|"Despensa"|"Suplementos"|"Sin ubicar";
type Goal = "organizar"|"ahorrar"|"desperdicio"|"equilibrio";
type NutritionMode = "basica"|"detallada"|"off";
type CookingStyle = "rapido"|"normal"|"cocinar"|"mealprep";

type InventoryItem = {
  id:string; name:string; qty:number; unit:string; location:Location; category:string; subcategory?:string;
  stock:StockState; purchasedAt:string; expires?:string; dateType?:"caducidad"|"preferente";
  price?:number; servings?:number; preparedAt?:string; source?:"compra"|"receta"|"sobras"|"mealprep"; preparedRecipeId?:string; preparedIngredients?:{name:string;key:string;category:string}[]; frozenAt?:string; originalExpires?:string; supermarket?:string; storageMode?:"normal"|"reserva"; reservedFor?:string; qualityReviewAt?:string; lastConfirmedAt?:string; estimatedExpires?:string; estimatedDateType?:"caducidad"|"preferente"; estimateBasis?:string; planReservations?:ShoppingSource[];
};
type ShoppingItem = {
  id:string; name:string; qty:number; unit:string; category:string; subcategory?:string; supermarket?:string; price?:number;
  requestedBy:string; reason:"persona"|"recomienda"|"receta"|"reposicion"; status:"pendiente"|"carrito"; reserve?:boolean; recipePlanId?:string; recipePlanIds?:string[]; recipeId?:string; sources?:ShoppingSource[];
};
type PurchaseRecord = {id:string;name:string;qty:number;unit:string;category:string;subcategory?:string;date:string;supermarket?:string;requestedBy?:string;price?:number};
type PurchaseSession = {id:string;date:string;total:number;supermarket?:string};
type MealRecord = {id:string;date:string;recipeId:string;title:string;servings:number;ingredients:{name:string;key:string;category:string}[]};
type ProductPreference = {location?:Location;category?:string};
type Member = {id:string;name:string;relation:string;presence:"casa"|"fuera_dia"|"fines_semana"|"variable";appetite:"poco"|"normal"|"mucho";dislikes:string;notes:string};
type EventItem = {id:string;title:string;date:string};
type RecipeIngredient = {name:string;qty:string;key:string};
type Recipe = {
  id:string; title:string; image:string; time:number; difficulty:"Fácil"|"Media";
  mode:CookingStyle[]; servings:number; calories:number; protein:number; carbs:number; fat:number;
  ingredients:RecipeIngredient[]; steps:string[]; description:string; tools?:string[]; source?:"local-ai";
};
type RecipePlan = {id:string;recipe:Recipe;createdAt:string;plannedFor?:string;status:"saved"|"done"};
type Profile = {
  householdSize:number; supermarkets:string[]; mainSupermarket:string; goals:Goal[];
  nutrition:NutritionMode; cooking:CookingStyle; shoppingCycle:"diaria"|"semanal"|"quincenal"|"mensual"|"mixta";
  notifications:boolean; onboardingDone:boolean; financeMode:"orientativo"|"preciso"; kitchenTools:string[];
};
type AppState = {
  inventory:InventoryItem[]; shopping:ShoppingItem[]; purchaseHistory:PurchaseRecord[]; purchaseSessions:PurchaseSession[]; mealHistory:MealRecord[]; weeklyMenu:WeeklyMenuPlan|null; recipePlans:RecipePlan[]; productPreferences:Record<string,ProductPreference>; members:Member[]; events:EventItem[];
  profile:Profile; budget:number; spent:number; waste:number; wasteSaved:number; productEngineVersion:number;
};

const SUPERMARKETS=["Mercadona","Lidl","Aldi","Carrefour","Alcampo","Dia","Consum","Bonpreu / Esclat","Caprabo","Eroski","Condis","Carnicería","Frutería","Otro supermercado"];
const KITCHEN_TOOLS=["Placa / inducción","Gas","Horno","Air fryer","Microondas","Thermomix / robot","Batidora"];
const CATEGORIES=["Todos","Fruta y verdura","Carne","Lácteos","Congelados","Preparados","Despensa","Bebidas","Snacks y dulces","Suplementos","Limpieza y hogar","Higiene y cuidado","Por clasificar"];
const LOCATIONS=["Todo","Nevera","Congelador","Despensa","Revisar"];
const CATEGORY_LABELS:Record<string,string>={"Todos":"Todo","Lácteos":"Lácteos","Carne":"Carne y pescado","Fruta y verdura":"Fruta y verdura","Congelados":"Congelados","Despensa":"Despensa","Preparados":"Preparados","Bebidas":"Bebidas","Snacks y dulces":"Snacks y dulces","Suplementos":"Suplementos","Limpieza y hogar":"Limpieza y hogar","Higiene y cuidado":"Higiene y cuidado","Por clasificar":"Revisar"};
const CATEGORY_ICONS:Record<string,string>={"Todos":"▦","Lácteos":"🥛","Carne":"🥩","Fruta y verdura":"🥬","Congelados":"🧊","Despensa":"🥫","Preparados":"🍱","Bebidas":"🥤","Snacks y dulces":"🍪","Suplementos":"＋","Limpieza y hogar":"🧽","Higiene y cuidado":"🫧","Por clasificar":"?"};
const LOCATION_ICONS:Record<string,string>={"Todo":"⌂","Nevera":"❄️","Congelador":"🧊","Despensa":"🥫","Revisar":"?"};

const BASE_RECIPES:Recipe[]=[
 {id:"r1",title:"Hamburguesa casera",image:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=76",time:20,difficulty:"Fácil",mode:["rapido","normal"],servings:4,calories:620,protein:36,carbs:52,fat:28,description:"Rápida y pensada para aprovechar lo que ya tienes.",tools:["Placa / inducción","Gas","Air fryer"],ingredients:[{name:"Hamburguesas",qty:"4 uds",key:"hamburguesas"},{name:"Queso",qty:"4 lonchas",key:"queso"},{name:"Pan de hamburguesa",qty:"4 uds",key:"pan"},{name:"Tomates",qty:"2 uds",key:"tomate"}],steps:["Calienta una sartén a fuego medio-alto.","Cocina las hamburguesas 3–4 min por lado.","Añade el queso al final.","Monta con pan y tomate y sirve."]},
 {id:"r2",title:"Pasta cremosa con queso",image:"https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=76",time:18,difficulty:"Fácil",mode:["rapido","normal"],servings:4,calories:540,protein:22,carbs:76,fat:15,description:"Una comida de despensa sencilla y rápida.",tools:["Placa / inducción","Gas","Thermomix / robot"],ingredients:[{name:"Pasta",qty:"320 g",key:"pasta"},{name:"Queso",qty:"120 g",key:"queso"},{name:"Leche",qty:"200 ml",key:"leche"}],steps:["Cuece la pasta.","Calienta la leche a fuego suave.","Añade el queso y remueve.","Mezcla con la pasta y ajusta de sal."]},
 {id:"r3",title:"Pollo con arroz y verduras",image:"https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=900&q=76",time:30,difficulty:"Fácil",mode:["normal","mealprep","cocinar"],servings:5,calories:585,protein:46,carbs:64,fat:16,description:"Ideal para varias raciones y para llevar fuera de casa.",tools:["Placa / inducción","Gas","Horno"],ingredients:[{name:"Pollo",qty:"800 g",key:"pollo"},{name:"Arroz",qty:"350 g",key:"arroz"},{name:"Tomates",qty:"3 uds",key:"tomate"}],steps:["Corta y dora el pollo.","Cuece el arroz por separado.","Saltea las verduras o tomate.","Reparte en raciones y deja enfriar antes de guardar."]},
 {id:"r4",title:"Batido de plátano y proteína",image:"https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=900&q=76",time:5,difficulty:"Fácil",mode:["rapido","mealprep"],servings:1,calories:390,protein:32,carbs:48,fat:8,description:"Batido rápido; los suplementos se integran como cualquier otro ingrediente.",tools:["Batidora","Thermomix / robot"],ingredients:[{name:"Leche",qty:"250 ml",key:"leche"},{name:"Plátano",qty:"1 ud",key:"platano"},{name:"Proteína whey",qty:"30 g",key:"proteina"}],steps:["Añade todos los ingredientes a la batidora.","Tritura 30–45 segundos.","Ajusta textura con leche o agua."]},
 {id:"r5",title:"Tortitas para aprovechar leche",image:"https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=900&q=76",time:22,difficulty:"Fácil",mode:["normal","cocinar"],servings:4,calories:430,protein:17,carbs:58,fat:14,description:"Buena opción cuando tienes leche de sobra.",tools:["Placa / inducción","Gas"],ingredients:[{name:"Leche",qty:"500 ml",key:"leche"},{name:"Huevos",qty:"3 uds",key:"huevo"},{name:"Harina",qty:"300 g",key:"harina"}],steps:["Mezcla huevos y leche.","Añade harina poco a poco.","Cocina porciones en sartén antiadherente.","Sirve y guarda las sobrantes."]}
];
const RECIPES:Recipe[]=[...BASE_RECIPES,...EXTRA_RECIPES as Recipe[]];

const DEFAULT:AppState={
 inventory:[],
 shopping:[],
 purchaseHistory:[],
 purchaseSessions:[],
 mealHistory:[],
 weeklyMenu:null,
 recipePlans:[],
 productPreferences:{},
 members:[{id:"m1",name:"Tú",relation:"Yo",presence:"variable",appetite:"normal",dislikes:"",notes:""}],
 events:[],
 budget:0,spent:0,waste:0,wasteSaved:0,productEngineVersion:1,
 profile:{householdSize:1,supermarkets:[],mainSupermarket:"",goals:[],nutrition:"basica",cooking:"rapido",shoppingCycle:"semanal",notifications:true,onboardingDone:false,financeMode:"orientativo",kitchenTools:[]}
};

function normalizeState(x:any):AppState{
 const raw=x&&typeof x==="object"?x:{};
 const rawMembers=raw.members||DEFAULT.members;
 const profile={...DEFAULT.profile,...(raw.profile||{})};
 if(profile.nutrition==="detallada")profile.nutrition="basica";
 const baseMembers=rawMembers.map((m:any,i:number)=>({...((DEFAULT.members[i]||{id:"m"+(i+1),name:"Miembro "+(i+1),relation:"Miembro",presence:"variable",appetite:"normal",dislikes:"",notes:""}) as Member),...m}));
 const members=ensureMembers(baseMembers,profile.householdSize);
 const productPreferences=raw.productPreferences&&typeof raw.productPreferences==="object"?raw.productPreferences:{};
 const needsProductMigration=(Number(raw.productEngineVersion)||0)<1;
 const baseInventory=(raw.inventory||DEFAULT.inventory) as InventoryItem[];
 const baseShopping=(raw.shopping||DEFAULT.shopping) as ShoppingItem[];
 const migratedInventory=needsProductMigration?baseInventory.map(i=>{
  const p=classifyProduct(i.name,i.category);
  const pref=productPreferences[p.canonical]||{};
  const category=pref.category||p.category;
  const preserveFrozen=i.location==="Congelador"&&Boolean(i.frozenAt);
  const location=preserveFrozen?i.location:recommendedLocation(i.name,category,pref.location) as Location;
  return {...i,category,subcategory:i.subcategory||p.subcategory,location};
 }):baseInventory;
 const inventory=migratedInventory.map(i=>{
  if(i.expires||i.estimatedExpires||i.location==="Congelador"||!i.purchasedAt)return i;
  const estimated=estimateShelfLifeFromReference(i.name,i.purchasedAt);
  return estimated?{...i,estimatedExpires:estimated.date,estimatedDateType:estimated.kind,estimateBasis:estimated.basis}:i;
 });
 const migratedShopping=needsProductMigration?baseShopping.map(i=>{
  const p=classifyProduct(i.name,i.category);
  const pref=productPreferences[p.canonical]||{};
  return {...i,category:pref.category||p.category,subcategory:i.subcategory||p.subcategory};
 }):baseShopping;
 const shopping=migratedShopping.map(i=>i.sources?.length?i:{...i,sources:shoppingSources(i)});
 return {...DEFAULT,...raw,profile,members,events:raw.events||DEFAULT.events,inventory,shopping,purchaseHistory:Array.isArray(raw.purchaseHistory)?raw.purchaseHistory:[],purchaseSessions:Array.isArray(raw.purchaseSessions)?raw.purchaseSessions:[],mealHistory:Array.isArray(raw.mealHistory)?raw.mealHistory:[],weeklyMenu:raw.weeklyMenu&&Array.isArray(raw.weeklyMenu.slots)?raw.weeklyMenu:null,recipePlans:Array.isArray(raw.recipePlans)?raw.recipePlans.filter((p:any)=>p&&p.recipe&&p.status!=="done").slice(-80):[],productPreferences,productEngineVersion:1};
}
function loadState():AppState{
 if(typeof window==="undefined") return DEFAULT;
 try{return normalizeState(JSON.parse(localStorage.getItem("homeos:v5")||"{}"))}catch{return DEFAULT}
}
function daysUntil(date?:string){if(!date)return 999;const d=new Date(date+"T12:00:00");return Math.ceil((d.getTime()-Date.now())/86400000)}
function fmtDate(){return new Intl.DateTimeFormat("es-ES",{weekday:"long",day:"numeric",month:"long"}).format(new Date())}
function isoAfterDays(days:number){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function weekendPlanIso(){const d=new Date();d.setHours(12,0,0,0);const day=d.getDay();if(day===6||day===0)return d.toISOString().slice(0,10);d.setDate(d.getDate()+(6-day));return d.toISOString().slice(0,10)}
function norm(s:string){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function usableInventoryItem(i:InventoryItem){
 if(i.stock==="falta"||i.qty<=0)return false;
 if(i.location!=="Congelador"&&i.dateType==="caducidad"&&i.expires&&daysUntil(i.expires)<0)return false;
 return true;
}
function hasInv(inv:InventoryItem[],key:string){const k=norm(key);return inv.some(i=>usableInventoryItem(i)&&(norm(i.name).includes(k)||k.includes(norm(i.name).split(" ")[0])))}
function missing(recipe:Recipe,inv:InventoryItem[]){
 return recipe.ingredients.filter(x=>{
  const parsed=parseQty(x.qty);
  if(!parsed)return !hasInv(inv,x.key);
  return !needAvailable(inv,{key:x.key,label:x.name,amount:parsed.amount,unit:parsed.unit as ReuseNeed["unit"]});
 });
}
function shoppingSources(i:ShoppingItem):ShoppingSource[]{
 if(i.sources?.length)return i.sources;
 const ids=[...(i.recipePlanIds||[]),...(i.recipePlanId?[i.recipePlanId]:[])];
 if(ids.length)return ids.map((planId,idx)=>({id:"legacy-recipe:"+planId+":"+i.id+":"+idx,type:"recipe" as const,label:i.requestedBy||"Receta",qty:idx===0?i.qty:0,unit:i.unit,planId,recipeId:i.recipeId})).filter(x=>x.qty>0);
 const type=i.reason==="recomienda"||i.reason==="reposicion"?"restock":i.reason==="receta"?"recipe":"manual";
 return [{id:"legacy:"+i.id,type,label:i.requestedBy||"Compra",qty:i.qty,unit:i.unit,recipeId:i.recipeId} as ShoppingSource];
}
function withShoppingSources(i:ShoppingItem,sources:ShoppingSource[]):ShoppingItem|null{
 const positive=sources.filter(x=>x.qty>0);
 if(!positive.length)return null;
 const qty=sumSources(positive,i.unit);
 if(qty<=0)return null;
 const recipeIds=[...new Set(positive.filter(x=>x.planId).map(x=>x.planId!))];
 return {...i,qty,sources:positive,recipePlanIds:recipeIds,recipePlanId:recipeIds[0],reason:positive.some(x=>x.type==="recipe")?"receta":positive.some(x=>x.type==="weekly")?"receta":positive.some(x=>x.type==="restock")?"recomienda":"persona"};
}
function cleanPlanReservations(item:InventoryItem,planId:string){
 const planReservations=(item.planReservations||[]).filter(x=>x.planId!==planId);
 return {...item,planReservations:planReservations.length?planReservations:undefined};
}
function score(recipe:Recipe,inv:InventoryItem[]){return recipe.ingredients.length-missing(recipe,inv).length}
function reasonText(r:ShoppingItem["reason"]){return r==="persona"?"Pedido por":r==="recomienda"?"HomeOS recomienda":r==="receta"?"Añadido desde receta":"Reposición probable"}
function inferCategory(name:string){return classifyProduct(name).category}
function inferUnit(name:string){
 const n=norm(name);
 if(/kg|kilo/.test(n)) return "kg";
 if(/gramo/.test(n)) return "g";
 if(/litro/.test(n)) return "L";
 if(/mililitro|ml/.test(n)) return "ml";
 if(/rollo/.test(n)) return "rollos";
 return "ud";
}
function normalizeSpokenShoppingText(value:string){
 const words:Record<string,string>={un:"1",una:"1",uno:"1",dos:"2",tres:"3",cuatro:"4",cinco:"5",seis:"6",siete:"7",ocho:"8",nueve:"9",diez:"10",once:"11",doce:"12"};
 let out=value;
 for(const [w,n] of Object.entries(words))out=out.replace(new RegExp("\\b"+w+"\\b","gi"),n);
 out=out.replace(/\bmedio\s+(kilo|kg|litro|l)\b/gi,(_,u)=>"0,5 "+u).replace(/\bmedia\s+(docena)\b/gi,"6 uds");
 return out;
}
function splitShoppingEntries(value:string){
 const cleaned=value.replace(/\s+/g," ").trim();
 if(!cleaned)return [];
 return cleaned.split(/\s*(?:,|;|\n|\s+y\s+)\s*/i).map(x=>x.trim()).filter(Boolean).slice(0,12);
}

function normalizedUnit(unit:string){
 const u=norm(unit).replace(/\./g,"").trim();
 if(["l","litro","litros"].includes(u))return "L";
 if(["ml","mililitro","mililitros"].includes(u))return "ml";
 if(["kg","kilo","kilos"].includes(u))return "kg";
 if(["g","gramo","gramos"].includes(u))return "g";
 if(["ud","uds","unidad","unidades"].includes(u))return "ud";
 if(["racion","raciones"].includes(u))return "racion";
 if(["loncha","lonchas"].includes(u))return "loncha";
 return u;
}
function unitFamily(unit:string){
 const u=normalizedUnit(unit);
 if(u==="L"||u==="ml")return "volume";
 if(u==="kg"||u==="g")return "mass";
 if(["ud","racion","loncha"].includes(u))return "count";
 return "other";
}
function toBase(amount:number,unit:string){
 const u=normalizedUnit(unit);
 if(u==="L")return amount*1000;
 if(u==="kg")return amount*1000;
 return amount;
}
function fromBase(amount:number,unit:string){
 const u=normalizedUnit(unit);
 if(u==="L"||u==="kg")return amount/1000;
 return amount;
}
function parseQty(qty:string){
 const m=qty.trim().match(/([\d.,]+)\s*([a-zA-Záéíóúñ]+)?/);
 if(!m)return null;
 return {amount:Number(m[1].replace(",","."))||0,unit:normalizedUnit(m[2]||"ud")};
}
function productMatchesNeed(i:InventoryItem,key:string){
 if(i.stock==="falta")return false;
 const k=norm(key);
 const p=classifyProduct(i.name,i.category);
 if(k==="verdura")return i.category==="Fruta y verdura"&&p.subcategory!=="Fruta";
 if(k==="fruta")return i.category==="Fruta y verdura"&&p.subcategory==="Fruta";
 const n=norm(i.name),canonical=norm(p.canonical);
 return n.includes(k)||canonical.includes(k)||k.includes(canonical);
}
function hasNeed(inv:InventoryItem[],need:ReuseNeed){return inv.some(i=>productMatchesNeed(i,need.key))}
function needAvailable(inv:InventoryItem[],need:ReuseNeed){
 const family=unitFamily(need.unit);
 const required=toBase(need.amount,need.unit);
 let total=0;
 for(const i of inv.filter(x=>productMatchesNeed(x,need.key))){
  const itemFamily=unitFamily(i.unit);
  if(itemFamily!==family)continue;
  if(family==="count"&&normalizedUnit(need.unit)!=="ud"&&normalizedUnit(i.unit)!==normalizedUnit(need.unit))continue;
  total+=toBase(Math.max(0,i.qty),i.unit);
 }
 return total>=required;
}
function consumeNeed(inv:InventoryItem[],need:{key:string;amount:number;unit:string}){
 let remaining=toBase(need.amount,need.unit);
 const family=unitFamily(need.unit);
 let exact=true;
 const candidates=inv.map((i,index)=>({i,index})).filter(x=>productMatchesNeed(x.i,need.key)).sort((a,b)=>daysUntil(a.i.expires)-daysUntil(b.i.expires));
 const out=[...inv];
 for(const {i,index} of candidates){
  if(remaining<=0)break;
  const itemFamily=unitFamily(i.unit);
  if(itemFamily!==family||(family==="count"&&normalizedUnit(i.unit)!==normalizedUnit(need.unit)&&normalizedUnit(need.unit)!=="ud")){
   out[index]={...out[index],stock:"incierto"};
   exact=false;
   continue;
  }
  const available=toBase(Math.max(0,i.qty),i.unit);
  const used=Math.min(available,remaining);
  const nextBase=Math.max(0,available-used);
  const nextQty=Math.round(fromBase(nextBase,i.unit)*100)/100;
  out[index]={...out[index],qty:nextQty,stock:nextQty<=0?"falta":nextBase<=available*.25?"poco":out[index].stock==="mucho"?"hay":out[index].stock};
  remaining-=used;
 }
 if(remaining>0)exact=false;
 return {inventory:out,exact};
}
function consumeRecipeIngredients(inv:InventoryItem[],ingredients:RecipeIngredient[]){
 let next=inv,exact=true;
 for(const ing of ingredients){
  const parsed=parseQty(ing.qty);
  if(!parsed){exact=false;continue}
  const result=consumeNeed(next,{key:ing.key,amount:parsed.amount,unit:parsed.unit});
  next=result.inventory;exact=exact&&result.exact;
 }
 return {inventory:next,exact};
}

function ensureMembers(members:Member[],count:number){
 const out=[...members];
 while(out.length<count){
  const n=out.length+1;
  out.push({id:"m"+n,name:"Miembro "+n,relation:"Miembro",presence:"variable",appetite:"normal",dislikes:"",notes:""});
 }
 return out;
}
function statusLabel(s:StockState){return s==="hay"?"Hay":s==="poco"?"Queda poco":s==="falta"?"Probablemente falta":s==="mucho"?"Hay bastante":"Revisar"}
function productIcon(name:string,cat:string){return <ProductGlyph name={name} category={cat}/>}
function rotationBand(name:string,cat:string,location?:string){
 if(location==="Congelador") return {key:"baja",label:"Larga duración"};
 const ref=shelfLifeBandFromReference(name);
 if(ref==="corta")return {key:"alta",label:"Vida útil corta"};
 if(ref==="media")return {key:"media",label:"Vida útil media"};
 if(ref==="larga")return {key:"baja",label:"Vida útil larga"};
 const r=classifyProduct(name,cat).rotation;
 return {key:r,label:r==="alta"?"Vida útil corta":r==="media"?"Vida útil media":"Vida útil larga"};
}
function median(values:number[]){
 const xs=values.filter(Number.isFinite).sort((a,b)=>a-b);
 if(!xs.length)return 0;
 const m=Math.floor(xs.length/2);
 return xs.length%2?xs[m]:(xs[m-1]+xs[m])/2;
}
function inventoryEstimate(state:AppState,item:InventoryItem){
 if(item.location!=="Congelador"&&item.expires&&item.dateType==="caducidad"&&daysUntil(item.expires)<0)return {prob:.01,label:"Caducado",tone:"falta",basis:"La fecha de caducidad registrada ya ha pasado"};
 if(item.location!=="Congelador"&&item.expires&&item.dateType==="preferente"&&daysUntil(item.expires)<0)return {prob:.55,label:"Revisar calidad",tone:"review",basis:"El consumo preferente ha pasado; revisa calidad antes de usarlo"};
 if(item.stock==="falta"||item.qty<=0)return {prob:.03,label:"Probablemente falta",tone:"falta",basis:"Confirmado como agotado"};
 if(item.storageMode==="reserva"){
  const reviewDue=item.qualityReviewAt&&daysUntil(item.qualityReviewAt)<=0;
  return {prob:.96,label:"Probablemente hay",tone:reviewDue?"review":"hay",basis:reviewDue?"Reserva registrada · conviene revisar calidad":"Reserva registrada · no se descuenta por rotación normal"};
 }
 if(item.stock==="incierto")return {prob:.5,label:"Revisar",tone:"incierto",basis:"Cantidad o estado pendiente de confirmar"};
 const canonical=norm(classifyProduct(item.name,item.category).canonical);
 const purchases=state.purchaseHistory.filter(p=>norm(classifyProduct(p.name,p.category).canonical)===canonical).map(p=>new Date(p.date+"T12:00:00").getTime()).sort((a,b)=>a-b);
 const intervals:number[]=[];
 for(let i=1;i<purchases.length;i++)intervals.push((purchases[i]-purchases[i-1])/86400000);
 const learned=intervals.length>=2?median(intervals):0;
 const cycleDays={diaria:3,semanal:7,quincenal:14,mensual:30,mixta:10}[state.profile.shoppingCycle]||7;
 const activeMembers=state.members.slice(0,state.profile.householdSize);
 const presenceWeight:Record<Member["presence"],number>={casa:1,fuera_dia:.65,fines_semana:.38,variable:.65};
 const appetiteWeight:Record<Member["appetite"],number>={poco:.82,normal:1,mucho:1.22};
 const demand=Math.max(.55,activeMembers.reduce((sum,m)=>sum+presenceWeight[m.presence]*appetiteWeight[m.appetite],0));
 const baseline=Math.max(1.2,state.profile.householdSize*.68);
 const demandFactor=Math.max(.7,Math.min(1.45,demand/baseline));
 const canonicalName=norm(classifyProduct(item.name,item.category).canonical);
 const stapleFast=/leche|yogur|huevo|pan|pollo|pavo|hamburgues|lechuga|tomate|platano|manzana/.test(canonicalName);
 const householdSlow=["Suplementos","Limpieza y hogar","Higiene y cuidado"].includes(item.category);
 let genericExpected=cycleDays*(stapleFast?1:item.location==="Despensa"?3.2:householdSlow?5:1.7);
 const purchaseQtys=state.purchaseHistory.filter(p=>norm(classifyProduct(p.name,p.category).canonical)===canonical).map(p=>Math.max(.01,p.qty));
 const typicalQty=purchaseQtys.length?median(purchaseQtys):Math.max(.01,item.qty);
 const qtyFactor=Math.max(.55,Math.min(2.4,item.qty/Math.max(.01,typicalQty)));
 let expected=learned?learned*qtyFactor:genericExpected*qtyFactor/demandFactor;
 if(item.location==="Congelador")expected=learned?Math.max(learned*qtyFactor,30):Math.max(90,cycleDays*10);
 else if(householdSlow)expected*=1.6;
 const eatenSinceStart=state.mealHistory.filter(m=>new Date(m.date+"T12:00:00").getTime()>=new Date((item.lastConfirmedAt||item.purchasedAt)+"T12:00:00").getTime()).reduce((sum,m)=>{
  return sum+(m.ingredients.some(ing=>norm(classifyProduct(ing.name,ing.category).canonical)===canonical)?m.servings:0);
 },0);
 if(eatenSinceStart>0&&!learned)expected=Math.max(2,expected/(1+Math.min(2,eatenSinceStart/Math.max(1,state.profile.householdSize))*.35));
 const start=item.lastConfirmedAt||item.frozenAt||item.purchasedAt;
 const age=Math.max(0,Math.floor((Date.now()-new Date(start+"T12:00:00").getTime())/86400000));
 const ratio=age/Math.max(1,expected);
 let prob=ratio<=.4?.96:ratio<=.8?.86:ratio<=1.1?.68:ratio<=1.5?.46:ratio<=2?.27:.12;
 if(item.stock==="poco")prob=Math.min(prob,.42);
 if(item.stock==="mucho")prob=Math.max(prob,.9);
 const label=prob>=.78?(age<=2?"Hay":"Probablemente hay"):prob>=.42?"Revisar":"Probablemente falta";
 const tone=prob>=.78?"hay":prob>=.42?"incierto":"falta";
 const basis=learned?"Aprende de vuestra reposición real (~"+Math.max(1,Math.round(expected))+" días ajustados a cantidad)":"Estimación inicial según hogar, cantidad y ritmo de compra · mejorará con tickets y comidas";
 return {prob,label,tone,basis};
}

function presenceText(p:Member["presence"]){return p==="casa"?"Come habitualmente en casa":p==="fuera_dia"?"Fuera durante el día":p==="fines_semana"?"Principalmente fines de semana":"Rutina variable"}
function appetiteText(a:Member["appetite"]){return a==="poco"?"Come poco":a==="mucho"?"Come bastante":"Consumo normal"}
function habitSignals(state:AppState){
 const now=Date.now();
 const recentPurchases=state.purchaseHistory.filter(x=>{
  const t=new Date(x.date+"T12:00:00").getTime();
  return t<=now&&now-t<=28*86400000;
 });
 const recentMeals=state.mealHistory.filter(x=>{
  const t=new Date(x.date+"T12:00:00").getTime();
  return t<=now&&now-t<=28*86400000;
 }).flatMap(m=>m.ingredients.map(i=>({name:i.name,category:i.category})));
 const current=state.inventory.filter(usableInventoryItem).map(i=>({name:i.name,category:i.category}));
 const source=[...recentPurchases,...recentMeals,...current];
 const has=(re:RegExp,cat?:string)=>source.some((i:any)=>(cat&&i.category===cat)||re.test(norm(i.name)));
 return [
  ["Proteína",has(/pollo|carne|pescado|huevo|proteina|legumbre|lenteja|garbanzo|tofu|seitan/,"Carne")],
  ["Verdura",has(/verdura|tomate|zanahoria|cebolla|aguacate|brocoli|lechuga|pepino|espinaca/)],
  ["Fruta",has(/platano|banana|manzana|pera|naranja|mandarina|fresa|arandano|kiwi|uva|melon|sandia|piña|mango|fruta/)],
  ["Carbohidratos",has(/arroz|pasta|pan|patata|avena|cereal|quinoa|cuscus/)],
  ["Dulces/snacks",has(/chocolate|galleta|chuche|gominola|snack|bolleria|refresco|helado/)]
 ] as [string,boolean][];
}
function logo(){return <div className="logo-mark" aria-label="HomeOS"><svg viewBox="0 0 64 64" role="img"><rect x="7" y="8" width="50" height="48" rx="15" className="logo-bg"/><path className="logo-h" d="M18 18h8v11h12V18h8v28h-8V36H26v10h-8z"/><ellipse className="logo-spoon" cx="32" cy="21.5" rx="4.4" ry="5.3"/><rect className="logo-spoon" x="30.5" y="26" width="3" height="16" rx="1.5"/></svg></div>}
function micIcon(){return <svg className="mic-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="8.25" y="2.75" width="7.5" height="12.5" rx="3.75" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M5.75 11.75v.5a6.25 6.25 0 0 0 12.5 0v-.5M12 18.5v2.75M8.75 21.25h6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
function navIcon(id:View,icon:string){return id==="inicio"?<span className="nav-logo-mini">{logo()}</span>:<span>{icon}</span>}


const nav:{id:View;label:string;icon:string}[]=[
 {id:"inicio",label:"Inicio",icon:"⌂"},{id:"comer",label:"Comer",icon:"◉"},{id:"comprar",label:"Comprar",icon:"🛒"},{id:"casa",label:"Casa",icon:"⌑"},{id:"finanzas",label:"Finanzas",icon:"€"}
];

export default function HomeOS(){
 const [view,setView]=useState<View>("inicio");
 const [state,setState]=useState<AppState>(DEFAULT);
 const [hydrated,setHydrated]=useState(false);
 const [toast,setToast]=useState("");
 const [profileOpen,setProfileOpen]=useState(false);
 const [tourOpen,setTourOpen]=useState(false);
 const [activeStore,setActiveStore]=useState("");
 const [shoppingActive,setShoppingActive]=useState(false);
 const [casaFocus,setCasaFocus]=useState<"all"|"expiring"|"prepared"|"reserve">("all");
 const [mealSeed,setMealSeed]=useState("");
 const [comerFocus,setComerFocus]=useState<"ideas"|"aprovechar"|"menu"|"habitos"|null>(null);
 const [deviceMemberId,setDeviceMemberId]=useState("");
 const [syncCreds,setSyncCreds]=useState<SyncCredentials|null>(null);
 const [syncStatus,setSyncStatus]=useState<"local"|"connecting"|"synced"|"error">("local");
 const receiptRef=useRef<HTMLInputElement>(null);
 const syncRevisionRef=useRef(0);
 const lastSyncedJsonRef=useRef("");
 const syncCreateRef=useRef(false);
 const syncTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
 const stateRef=useRef(state);
 const readyPlansRef=useRef<Set<string>>(new Set());
 const readyPlansInitializedRef=useRef(false);

 useEffect(()=>{stateRef.current=state},[state]);
 useEffect(()=>{
  if(!hydrated)return;
  const readyNow=new Set(state.recipePlans.filter(p=>p.status==="saved"&&missing(p.recipe,state.inventory).length===0).map(p=>p.id));
  if(!readyPlansInitializedRef.current){readyPlansRef.current=readyNow;readyPlansInitializedRef.current=true;return}
  const newlyReady=state.recipePlans.filter(p=>readyNow.has(p.id)&&!readyPlansRef.current.has(p.id));
  readyPlansRef.current=readyNow;
  if(newlyReady.length===1)setToast("Ya tienes todo para "+newlyReady[0].recipe.title);
  else if(newlyReady.length>1)setToast(newlyReady.length+" recetas guardadas ya están listas para cocinar");
 },[hydrated,state.inventory,state.recipePlans]);
 useEffect(()=>{if(!hydrated)return;const saved=localStorage.getItem("homeos:device-member");const valid=state.members.slice(0,state.profile.householdSize).some(m=>m.id===saved);const next=valid?saved||"":state.members[0]?.id||"";setDeviceMemberId(next)},[hydrated,state.profile.householdSize,state.members.length]);
 useEffect(()=>{if(hydrated&&deviceMemberId)localStorage.setItem("homeos:device-member",deviceMemberId)},[hydrated,deviceMemberId]);

 useEffect(()=>{
  let alive=true;
  (async()=>{
   const fresh=typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("fresh")==="1";
   if(fresh){
    localStorage.removeItem("homeos:v5");
    localStorage.removeItem("homeos:device-member");
    localStorage.removeItem("homeos:quick-guide-seen");
    clearSync();
    window.history.replaceState({},document.title,window.location.pathname);
   }
   const local=fresh?DEFAULT:loadState();
   const creds=fresh?null:getStoredSync();
   if(creds&&syncConfigured()){
    setSyncStatus("connecting");
    try{
     const remote=await readRemoteHousehold(creds);
     if(!alive)return;
     if(remote){
      const remoteState=normalizeState(remote.data);
      setSyncCreds(creds);
      syncRevisionRef.current=remote.revision;
      lastSyncedJsonRef.current=JSON.stringify(remoteState);
      setState(remoteState);
      setSyncStatus("synced");
     }else{
      clearSync();
      setState(local);
      setSyncStatus("local");
     }
    }catch{
     if(!alive)return;
     setSyncCreds(creds);
     setState(local);
     setSyncStatus("error");
    }
   }else{
    setState(local);
    setSyncStatus("local");
   }
   if(alive)setHydrated(true);
  })();
  return()=>{alive=false};
 },[]);

 useEffect(()=>{
  if(!hydrated||!state.profile.onboardingDone||syncCreds||!syncConfigured()||syncCreateRef.current)return;
  syncCreateRef.current=true;
  const snapshot=state;
  setSyncStatus("connecting");
  createRemoteHousehold("Mi hogar",snapshot).then(({creds,revision})=>{
   setSyncCreds(creds);
   syncRevisionRef.current=revision;
   lastSyncedJsonRef.current=JSON.stringify(snapshot);
   setSyncStatus("synced");
  }).catch(()=>setSyncStatus("error")).finally(()=>{syncCreateRef.current=false});
 },[hydrated,state.profile.onboardingDone,syncCreds]);

 useEffect(()=>{
  if(!hydrated||typeof window==="undefined")return;
  const json=JSON.stringify(state);
  localStorage.setItem("homeos:v5",json);
  if(!syncCreds||!state.profile.onboardingDone||!syncConfigured()||json===lastSyncedJsonRef.current)return;
  if(syncTimerRef.current)clearTimeout(syncTimerRef.current);
  syncTimerRef.current=setTimeout(async()=>{
   setSyncStatus("connecting");
   try{
    const revision=await writeRemoteHousehold(syncCreds,stateRef.current);
    syncRevisionRef.current=revision;
    lastSyncedJsonRef.current=JSON.stringify(stateRef.current);
    setSyncStatus("synced");
   }catch{setSyncStatus("error")}
  },700);
  return()=>{if(syncTimerRef.current)clearTimeout(syncTimerRef.current)};
 },[state,hydrated,syncCreds]);

 useEffect(()=>{
  if(!hydrated||!syncCreds||!syncConfigured())return;
  let alive=true;
  const pull=async()=>{
   if(document.visibilityState==="hidden")return;
   if(JSON.stringify(stateRef.current)!==lastSyncedJsonRef.current)return;
   try{
    const remote=await readRemoteHousehold(syncCreds);
    if(!alive||!remote||remote.revision<=syncRevisionRef.current)return;
    const remoteState=normalizeState(remote.data);
    syncRevisionRef.current=remote.revision;
    lastSyncedJsonRef.current=JSON.stringify(remoteState);
    setState(remoteState);
    setSyncStatus("synced");
   }catch{if(alive)setSyncStatus("error")}
  };
  const id=window.setInterval(pull,15000);
  window.addEventListener("focus",pull);
  document.addEventListener("visibilitychange",pull);
  return()=>{alive=false;window.clearInterval(id);window.removeEventListener("focus",pull);document.removeEventListener("visibilitychange",pull)};
 },[hydrated,syncCreds]);

 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(""),2400);return()=>clearTimeout(t)},[toast]);
 useEffect(()=>{
  if(!hydrated||!state.profile.onboardingDone||typeof window==="undefined")return;
  if(localStorage.getItem("homeos:quick-guide-seen")!=="1")setTourOpen(true);
 },[hydrated,state.profile.onboardingDone]);
 function closeQuickGuide(){
  localStorage.setItem("homeos:quick-guide-seen","1");
  setTourOpen(false);
 }
 useEffect(()=>{window.scrollTo({top:0,behavior:"smooth"})},[view]);

 async function connectHome(code:string){
  const creds=parseConnectionCode(code);
  if(!creds||!syncConfigured())return false;
  setSyncStatus("connecting");
  try{
   const remote=await readRemoteHousehold(creds);
   if(!remote){setSyncStatus("error");return false}
   const remoteState=normalizeState(remote.data);
   storeSync(creds);
   setSyncCreds(creds);
   syncRevisionRef.current=remote.revision;
   lastSyncedJsonRef.current=JSON.stringify(remoteState);
   setState(remoteState);
   setSyncStatus("synced");
   setToast("Hogar conectado");
   return true;
  }catch{setSyncStatus("error");return false}
 }

 async function copyHomeCode(){
  if(!syncCreds)return;
  try{
   await navigator.clipboard.writeText(connectionCode(syncCreds));
   setToast("Código del hogar copiado");
  }catch{setToast("No se pudo copiar el código")}
 }

 async function syncNow(){
  if(!syncCreds)return;
  setSyncStatus("connecting");
  try{
   const revision=await writeRemoteHousehold(syncCreds,stateRef.current);
   syncRevisionRef.current=revision;
   lastSyncedJsonRef.current=JSON.stringify(stateRef.current);
   setSyncStatus("synced");
   setToast("Hogar sincronizado");
  }catch{setSyncStatus("error");setToast("No se pudo sincronizar")}
 }

 const expiring=useMemo(()=>state.inventory.filter(i=>daysUntil(i.expires)<=3&&i.stock!=="falta"),[state.inventory]);
 const monthKey=new Date().toISOString().slice(0,7);
 const monthlySpent=state.purchaseSessions.length?state.purchaseSessions.filter(x=>x.date.startsWith(monthKey)).reduce((n,x)=>n+x.total,0):state.spent;
 const available=state.budget-monthlySpent;
 const confidence=state.inventory.filter(i=>i.stock!=="incierto").length/Math.max(1,state.inventory.length);

 function ensureRecipePlan(s:AppState,recipe:Recipe,plannedFor?:string){
  const existing=s.recipePlans.find(p=>p.status==="saved"&&p.recipe.id===recipe.id);
  if(existing){
   return {plans:s.recipePlans.map(p=>p.id===existing.id?{...p,recipe,plannedFor:plannedFor||p.plannedFor}:p),planId:existing.id};
  }
  const planId=crypto.randomUUID();
  return {plans:[...s.recipePlans,{id:planId,recipe,createdAt:new Date().toISOString().slice(0,10),plannedFor,status:"saved" as const}].slice(-80),planId};
 }
 function saveRecipePlan(recipe:Recipe,plannedFor?:string){
  setState(s=>{
   const saved=ensureRecipePlan(s,recipe,plannedFor);
   return {...s,recipePlans:saved.plans};
  });
  setToast(plannedFor?"Receta guardada para "+new Date(plannedFor+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"short"}):"Receta guardada para más adelante");
 }
 function addFromRecipe(recipe:Recipe,plannedFor?:string){
  setState(s=>{
   const saved=ensureRecipePlan(s,recipe,plannedFor);
   const shortages=recipeShortages(recipe.ingredients,s.inventory.filter(usableInventoryItem));
   let shopping=[...s.shopping];
   for(const shortage of shortages){
    const unit=shortage.unit||inferUnit(shortage.name);
    const sourceId="recipe:"+saved.planId+":"+norm(shortage.key)+":"+unit;
    let existing=shopping.findIndex(q=>q.status==="pendiente"&&planUnitFamily(q.unit)===planUnitFamily(unit)&&(norm(classifyProduct(q.name,q.category).canonical)===norm(classifyProduct(shortage.name,inferCategory(shortage.name)).canonical)||norm(q.name).includes(norm(shortage.key))));
    if(existing<0){
     const source:ShoppingSource={id:sourceId,type:"recipe",label:recipe.title,qty:shortage.missing,unit,planId:saved.planId,recipeId:recipe.id,plannedFor};
     shopping.push({id:crypto.randomUUID(),name:shortage.name,qty:shortage.missing,unit,category:inferCategory(shortage.name),requestedBy:"Receta · "+recipe.title,reason:"receta",status:"pendiente",recipePlanId:saved.planId,recipePlanIds:[saved.planId],recipeId:recipe.id,sources:[source]});
    }else{
     const q=shopping[existing];
     const current=shoppingSources(q).filter(x=>x.id!==sourceId);
     const source:ShoppingSource={id:sourceId,type:"recipe",label:recipe.title,qty:shortage.missing,unit:q.unit,planId:saved.planId,recipeId:recipe.id,plannedFor};
     const updated=withShoppingSources(q,[...current,source]);
     if(updated)shopping[existing]={...updated,requestedBy:updated.recipePlanIds&&updated.recipePlanIds.length>1?"Varias recetas":q.requestedBy};
    }
   }
   // If the recipe now needs less than before, remove stale recipe contributions.
   shopping=shopping.flatMap(q=>{
    const sources=shoppingSources(q);
    const own=sources.filter(x=>x.planId===saved.planId);
    if(!own.length)return [q];
    const shortageKeys=new Set(shortages.map(x=>norm(x.key)));
    const next=sources.filter(x=>x.planId!==saved.planId||shortageKeys.has(norm(classifyProduct(q.name,q.category).canonical))||[...shortageKeys].some(k=>norm(q.name).includes(k)));
    const updated=withShoppingSources(q,next);
    return updated?[updated]:[];
   });
   return {...s,recipePlans:saved.plans,shopping};
  });
  const currentShortages=recipeShortages(recipe.ingredients,state.inventory.filter(usableInventoryItem));
  setToast(currentShortages.length?recipe.title+" guardada · Comprar se ha ajustado a lo que realmente falta":"Receta guardada · ya tienes todo para hacerla");
 }
 function cancelRecipePlan(planId:string){
  setState(s=>{
   const shopping=s.shopping.flatMap(item=>{
    const nextSources=removePlanFromSources(shoppingSources(item),planId);
    const updated=withShoppingSources(item,nextSources);
    return updated?[updated]:[];
   });
   return {...s,recipePlans:s.recipePlans.filter(p=>p.id!==planId),shopping,inventory:s.inventory.map(i=>cleanPlanReservations(i,planId))};
  });
  setToast("Plan eliminado · la compra se ha recalculado");
 }

 function finishShopping(total?:number){
  const cart=state.shopping.filter(i=>i.status==="carrito");
  if(!cart.length){setToast("Todavía no hay productos en el carrito");return}
  const today=new Date().toISOString().slice(0,10);
  setState(s=>{
   const inventory=[...s.inventory];
   for(const x of cart){
    const profile=classifyProduct(x.name,x.category);
    const pref=s.productPreferences[profile.canonical]||{};
    const category=pref.category||profile.category;
    const reserveAllowed=x.reserve&&(Boolean(freezerQualityGuide(x.name,category,profile.subcategory))||category==="Carne");
    const location=(reserveAllowed?"Congelador":recommendedLocation(x.name,category,pref.location)) as Location;
    const guide=reserveAllowed?freezerQualityGuide(x.name,category,profile.subcategory):null;
    const frozenAt=reserveAllowed?today:undefined;
    const qualityReviewAt=reserveAllowed&&guide?addMonthsIso(today,guide.minMonths):undefined;
    const estimated=!reserveAllowed?estimateShelfLifeFromReference(x.name,today):null;
    const planReservations=shoppingSources(x).filter(src=>Boolean(src.planId)&&src.qty>0);
    const idx=inventory.findIndex(i=>norm(i.name)===norm(x.name)&&i.unit===x.unit&&i.location===location&&Boolean(i.storageMode==="reserva")===Boolean(reserveAllowed));
    if(idx>=0){
     const current=inventory[idx];
     const estimatedExpires=current.expires?current.estimatedExpires:(current.estimatedExpires&&estimated?.date?(current.estimatedExpires<estimated.date?current.estimatedExpires:estimated.date):(current.estimatedExpires||estimated?.date));
     inventory[idx]={...current,category,subcategory:profile.subcategory,qty:Math.max(0,current.qty)+x.qty,stock:"hay",purchasedAt:today,price:typeof x.price==="number"?x.price:current.price,supermarket:x.supermarket||activeStore||current.supermarket,planReservations:[...(current.planReservations||[]).filter(r=>!planReservations.some(n=>n.id===r.id)),...planReservations],...(reserveAllowed?{storageMode:"reserva" as const,frozenAt,qualityReviewAt,expires:undefined,dateType:undefined,estimatedExpires:undefined,estimatedDateType:undefined,estimateBasis:undefined}:(!current.expires&&estimatedExpires?{estimatedExpires,estimatedDateType:current.estimatedDateType||estimated?.kind,estimateBasis:current.estimateBasis||estimated?.basis}:{}))};
    }else{
     inventory.unshift({id:crypto.randomUUID(),name:x.name,qty:x.qty,unit:x.unit,location,category,subcategory:profile.subcategory,stock:"hay",purchasedAt:today,price:x.price,supermarket:x.supermarket||activeStore,planReservations:planReservations.length?planReservations:undefined,...(reserveAllowed?{storageMode:"reserva" as const,frozenAt,qualityReviewAt}:(estimated?{estimatedExpires:estimated.date,estimatedDateType:estimated.kind,estimateBasis:estimated.basis}:{}))});
    }
   }
   const purchaseHistory=[...s.purchaseHistory,...cart.map(x=>{
    const p=classifyProduct(x.name,x.category);
    const pref=s.productPreferences[p.canonical]||{};
    return {
     id:crypto.randomUUID(),
     name:x.name,
     qty:x.qty,
     unit:x.unit,
     category:pref.category||p.category,
     subcategory:p.subcategory,
     date:today,
     supermarket:x.supermarket||activeStore||undefined,
     requestedBy:x.requestedBy,
     price:x.price
    };
   })].slice(-600);
   const purchaseSessions=typeof total==="number"&&total>=0?[...s.purchaseSessions,{id:crypto.randomUUID(),date:today,total,supermarket:activeStore||undefined}].slice(-240):s.purchaseSessions;
   return {...s,inventory,purchaseHistory,purchaseSessions,spent:typeof total==="number"&&total>=0?s.spent+total:s.spent,shopping:s.shopping.filter(i=>i.status!=="carrito")};
  });
  setShoppingActive(false);setActiveStore("");setToast(`${cart.length} productos guardados como compra reciente`);
 }

 if(!hydrated)return <div className="app-loading"><div className="app-loading-mark">H</div><strong>HomeOS</strong></div>;
 if(!state.profile.onboardingDone)return <Onboarding state={state} setState={setState} connectHome={connectHome} syncStatus={syncStatus}/>;

 return <div className="app-shell">
  <aside className="sidebar">
   <div className="brand">{logo()}<div><strong>HomeOS</strong><span>Tu cocina, sin carga mental</span></div></div>
   <nav>{nav.map(n=><button key={n.id} className={view===n.id?"nav active":"nav"} onClick={()=>{if(n.id==="casa")setCasaFocus("all");setView(n.id)}}>{navIcon(n.id,n.icon)}{n.label}</button>)}</nav>
   <button className="profile" onClick={()=>setProfileOpen(true)}><span>FR</span><div><strong>Mi hogar</strong><small>{state.profile.householdSize} personas</small></div></button>
  </aside>

  <main className="main">
   <header className="topbar"><div className="topbar-title"><span className="topbar-logo">{logo()}</span><div><span className="eyebrow">{fmtDate()}</span><h1>{view==="inicio"?"Inicio":nav.find(n=>n.id===view)?.label}</h1></div></div><div className="top-actions">{syncCreds&&<span className={`sync-pill ${syncStatus}`} title="Estado de sincronización del hogar; no es el estado de la IA">{syncStatus==="synced"?"● Hogar sincronizado":syncStatus==="connecting"?"↻ Guardando hogar":syncStatus==="error"?"! Hogar sin conexión":"Hogar local"}</span>}<button className="help-button" onClick={()=>setTourOpen(true)} aria-label="Ver guía rápida" title="Ver guía rápida">?</button><button className="avatar" onClick={()=>setProfileOpen(true)}>FR</button></div></header>
   {view==="inicio"&&<Inicio state={state} setState={setState} expiring={expiring} confidence={confidence} available={available} setView={setView} setCasaFocus={setCasaFocus} openHabits={()=>{setComerFocus("habitos");setView("comer")}} openWeekly={()=>{setComerFocus("menu");setView("comer")}}/>}
   {view==="comer"&&<Comer state={state} setState={setState} addFromRecipe={addFromRecipe} saveRecipePlan={saveRecipePlan} cancelRecipePlan={cancelRecipePlan} setToast={setToast} mealSeed={mealSeed} clearMealSeed={()=>setMealSeed("")} focusTab={comerFocus} clearFocusTab={()=>setComerFocus(null)}/>}
   {view==="comprar"&&<Comprar state={state} setState={setState} addFromRecipe={addFromRecipe} activeStore={activeStore} setActiveStore={setActiveStore} shoppingActive={shoppingActive} setShoppingActive={setShoppingActive} finishShopping={finishShopping} receiptRef={receiptRef} setToast={setToast} deviceMemberId={deviceMemberId} setDeviceMemberId={setDeviceMemberId}/>}
   {view==="casa"&&<Casa state={state} setState={setState} setToast={setToast} focus={casaFocus} clearFocus={()=>setCasaFocus("all")} openRecipes={(name)=>{setComerFocus("ideas");setMealSeed(name);setView("comer")}}/>}
   {view==="finanzas"&&<Finanzas state={state} setState={setState} available={available} monthlySpent={monthlySpent}/>}
  </main>

  <nav className="bottom-nav">{nav.map(n=><button key={n.id} className={view===n.id?"active":""} onClick={()=>{if(n.id==="casa")setCasaFocus("all");setView(n.id)}}>{navIcon(n.id,n.icon)}<small>{n.label}</small></button>)}</nav>
  {profileOpen&&<ProfileModal state={state} setState={setState} close={()=>setProfileOpen(false)} syncCreds={syncCreds} syncStatus={syncStatus} connectHome={connectHome} copyHomeCode={copyHomeCode} syncNow={syncNow} deviceMemberId={deviceMemberId} setDeviceMemberId={setDeviceMemberId} setToast={setToast}/>}
  {tourOpen&&<QuickStartGuide close={closeQuickGuide}/>}
  {toast&&<div className="toast" role="status" aria-live="polite"><span>✓</span>{toast}</div>}
 </div>
}

function Onboarding({state,setState,connectHome,syncStatus}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;connectHome:(code:string)=>Promise<boolean>;syncStatus:"local"|"connecting"|"synced"|"error"}){
 const [step,setStep]=useState(0);
 const [joinOpen,setJoinOpen]=useState(false);
 const [joinCode,setJoinCode]=useState("");
 const [joinError,setJoinError]=useState("");
 async function joinExisting(){setJoinError("");const ok=await connectHome(joinCode);if(!ok)setJoinError("Código no válido o no se pudo conectar.");}
 const toggleGoal=(g:Goal)=>setState(s=>({...s,profile:{...s.profile,goals:s.profile.goals.includes(g)?s.profile.goals.filter(x=>x!==g):[...s.profile.goals,g]}}));
 const toggleMarket=(m:string)=>setState(s=>{
  const supermarkets=s.profile.supermarkets.includes(m)?s.profile.supermarkets.filter(x=>x!==m):[...s.profile.supermarkets,m];
  const mainSupermarket=supermarkets.includes(s.profile.mainSupermarket)?s.profile.mainSupermarket:(supermarkets[0]||"");
  return {...s,profile:{...s.profile,supermarkets,mainSupermarket}};
 });
 return <div className="onboarding"><div className="onboarding-card">
  <div className="onboarding-progress"><span style={{width:`${((step+1)/5)*100}%`}}/></div>
  {step===0&&<div className="ob-panel"><span className="eyebrow">PRIMERA CONFIGURACIÓN</span><h1>¿Cuántas personas viven en casa?</h1><p>HomeOS adapta cantidades y nivel de incertidumbre al tamaño del hogar.</p><div className="number-grid">{[1,2,3,4,5,6].map(n=><button key={n} className={state.profile.householdSize===n?"choice active":"choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,householdSize:n},members:ensureMembers(s.members,n)}))}>{n}</button>)}</div></div>}
  {step===1&&<div className="ob-panel"><span className="eyebrow">RITMO DE COMPRA</span><h1>¿Cómo soléis comprar?</h1><div className="goal-grid">{[["diaria","Casi cada día"],["semanal","Compra semanal"],["quincenal","Cada dos semanas"],["mensual","Compra grande mensual"],["mixta","Compra grande + compras rápidas"]].map(([id,label])=><button key={id} className={state.profile.shoppingCycle===id?"goal-choice active":"goal-choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,shoppingCycle:id as Profile["shoppingCycle"]}}))}><strong>{label}</strong></button>)}</div></div>}
  {step===2&&<div className="ob-panel"><span className="eyebrow">COCINA</span><h1>¿Cómo quieres cocinar normalmente?</h1><div className="goal-grid">{[["rapido","Voy con prisas","Ideas de 5–20 min."],["normal","Cocino normal","Equilibrio entre tiempo y variedad."],["cocinar","Me gusta cocinar","Recetas más completas."],["mealprep","Preparo varios días","Raciones, nevera y congelador."]].map(([id,label,desc])=><button key={id} className={state.profile.cooking===id?"goal-choice active":"goal-choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,cooking:id as CookingStyle}}))}><strong>{label}</strong><span>{desc}</span></button>)}</div></div>}
  {step===3&&<div className="ob-panel"><span className="eyebrow">HÁBITOS</span><h1>¿Quieres que HomeOS aprenda cómo compra el hogar?</h1><div className="goal-grid">{[["basica","Sí, enséñame tendencias","Proteína, verdura, fruta, carbohidratos y snacks a partir de compras reales."],["off","No necesito esta parte","Casa, compra y recetas funcionarán igual."]].map(([id,label,desc])=><button key={id} className={state.profile.nutrition===id?"goal-choice active":"goal-choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,nutrition:id as NutritionMode}}))}><strong>{label}</strong><span>{desc}</span></button>)}</div></div>}
  {step===4&&<div className="ob-panel"><span className="eyebrow">TIENDAS</span><h1>¿Dónde compráis?</h1><p>Opcional. Si no quieres configurarlo ahora, HomeOS usará “Compra general”.</p><div className="market-grid">{SUPERMARKETS.map(m=><button key={m} className={state.profile.supermarkets.includes(m)?"choice active":"choice"} onClick={()=>toggleMarket(m)}>{m}</button>)}</div></div>}
  <div className="ob-actions"><button className="secondary" disabled={step===0} onClick={()=>setStep(x=>Math.max(0,x-1))}>Atrás</button>{step<4?<button className="primary" onClick={()=>setStep(x=>x+1)}>Continuar</button>:<button className="primary" onClick={()=>setState(s=>({...s,profile:{...s.profile,onboardingDone:true}}))}>Entrar en HomeOS</button>}</div>{step===0&&<button className="onboarding-skip" onClick={()=>setState(s=>({...s,profile:{...s.profile,onboardingDone:true}}))}>Entrar rápido · lo configuro después</button>}
  <div className="existing-home">{!joinOpen?<button className="join-link" onClick={()=>setJoinOpen(true)}>Ya tengo HomeOS en otro dispositivo</button>:<div className="join-box"><div><strong>Conectar con mi hogar</strong><small>Pega el código que aparece en HomeOS del otro dispositivo.</small></div><input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="HOS1.…"/><button className="primary" disabled={!joinCode.trim()||syncStatus==="connecting"} onClick={joinExisting}>{syncStatus==="connecting"?"Conectando…":"Conectar"}</button>{joinError&&<span className="form-error">{joinError}</span>}<button className="join-cancel" onClick={()=>{setJoinOpen(false);setJoinError("")}}>Cancelar</button></div>}</div>
 </div></div>
}

function QuickStartGuide({close}:{close:()=>void}){
 const steps=[
  ["Inicio","Lo urgente de casa: compra, caducidades, preparados y próximos eventos."],
  ["Comer","Ideas, aprovechamiento y menú semanal usando inventario, gustos y tiempo. También avisa si una receta contiene algo que alguien evita."],
  ["Comprar","Apunta por voz o texto, compra en tienda y usa el ticket para actualizar Casa."],
  ["Casa","Consulta lo que probablemente queda, corrige solo cuando haga falta y pide recetas desde un producto."],
  ["Finanzas","Ve gasto mensual, categorías y desperdicio sin llevar otra contabilidad aparte."]
 ];
 return <div className="modal-backdrop quick-guide-backdrop" onMouseDown={close}><div className="quick-guide" onMouseDown={e=>e.stopPropagation()}>
  <div className="quick-guide-head">{logo()}<div><small>HOMEOS EN 30 SEGUNDOS</small><h2>La app trabaja por ti</h2><p>No necesitas mantener un inventario perfecto. Compra, corrige excepciones y consulta.</p></div><button onClick={close} aria-label="Cerrar">×</button></div>
  <div className="quick-guide-steps">{steps.map(([name,desc],i)=><article key={name}><span>{i+1}</span><div><strong>{name}</strong><p>{desc}</p></div></article>)}</div>
  <div className="quick-guide-bottom"><span>Consejo: usa la voz siempre que te dé pereza escribir.</span><button className="primary" onClick={close}>Entendido · entrar</button></div>
 </div></div>
}

function Inicio({state,setState,expiring,confidence,available,setView,setCasaFocus,openHabits,openWeekly}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;expiring:InventoryItem[];confidence:number;available:number;setView:(v:View)=>void;setCasaFocus:(v:"all"|"expiring"|"prepared"|"reserve")=>void;openHabits:()=>void;openWeekly:()=>void}){
 const todayIso=new Date().toISOString().slice(0,10);
 const next=state.events.filter(e=>e.date>=todayIso).slice().sort((a,b)=>a.date.localeCompare(b.date))[0];
 const recommended=state.shopping.filter(i=>i.reason==="recomienda"&&i.status==="pendiente").length;
 const pending=state.shopping.filter(i=>i.status==="pendiente").length;
 const known=state.inventory.filter(i=>i.stock!=="incierto").length;
 const review=state.inventory.length-known;
 const readyServings=state.inventory.filter(i=>i.category==="Preparados"&&i.stock!=="falta").reduce((n,i)=>n+(i.servings||i.qty||0),0);
 const reserveDue=state.inventory.filter(i=>i.storageMode==="reserva"&&i.qualityReviewAt&&daysUntil(i.qualityReviewAt)<=0);
 const nextDate=next?new Date(next.date+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"}):"—";
 const peopleAtHome=state.members.slice(0,state.profile.householdSize).filter(m=>m.presence==="casa").length;
 const savedRecipePlans=state.recipePlans.filter(p=>p.status==="saved").map(p=>({...p,missing:missing(p.recipe,state.inventory)})).sort((a,b)=>(a.plannedFor||"9999").localeCompare(b.plannedFor||"9999")||a.createdAt.localeCompare(b.createdAt));
 const readyRecipePlans=savedRecipePlans.filter(p=>p.missing.length===0);
 const nextRecipePlan=savedRecipePlans[0];
 return <section className="stack">
  <div className="dashboard-hero"><div>{logo()}<span className="eyebrow">HOY EN CASA</span><h2>{state.profile.householdSize===1?"Tu casa, sin tener que recordarlo todo":"Lo importante de casa, de un vistazo"}</h2><p>{pending?String(pending)+" productos pendientes de compra.":"La lista de compra está al día."} {recommended?String(recommended)+" son sugerencias de reposición de HomeOS.":""}</p></div><div className="inventory-trust"><span>ESTADO DEL INVENTARIO</span><strong>{known} productos con estado conocido</strong><small>{review?String(review)+" necesitan revisión":"Nada pendiente de revisar"}</small></div></div>

  <div className="household-context">
   <div><small>PERFIL DEL HOGAR</small><strong>{state.profile.householdSize===1?"Perfil personal":String(peopleAtHome)+" comen habitualmente en casa"}</strong><span>{state.profile.householdSize===1?"Tus gustos y rutina ajustan las sugerencias.":state.members.slice(0,state.profile.householdSize).filter(m=>m.presence==="fuera_dia").length+" fuera durante el día · "+state.members.slice(0,state.profile.householdSize).filter(m=>m.appetite==="mucho").length+" con consumo alto"}</span></div>
   <button onClick={()=>document.querySelector<HTMLButtonElement>(".avatar")?.click()}>Configurar hogar</button>
  </div>

  <div className="hero-grid home-primary-actions">
   <button className="decision-card photo-card" onClick={()=>setView("comer")}><img src={RECIPES[0].image} alt="Idea para comer" decoding="async"/><div className="photo-overlay"><small>¿QUÉ COMEMOS HOY?</small><h2>Ideas con lo que ya tienes</h2><p>Varias opciones según tiempo, inventario y gustos.</p><span className="card-cta">Ver ideas →</span></div></button>
   <button className="decision-card shopping-decision" onClick={()=>setView("comprar")}><span className="decision-icon">🛒</span><div><small>LISTA DE COMPRA</small><h2>{pending?String(pending)+" pendientes":"Todo al día"}</h2><p>{pending?"Entra, marca lo que coges y termina la compra.":"Añade algo cuando lo necesites."}</p><span className="card-cta">Abrir lista →</span></div></button>
  </div>
  {savedRecipePlans.length>0&&<button className={readyRecipePlans.length?"home-recipe-memory ready":"home-recipe-memory"} onClick={()=>setView("comer")}><span>{readyRecipePlans.length?"✓":"🍳"}</span><div><small>RECETAS QUE QUERÍAS HACER</small><strong>{readyRecipePlans.length?readyRecipePlans.length+" ya "+(readyRecipePlans.length===1?"está":"están")+" listas":nextRecipePlan?.recipe.title}</strong><p>{readyRecipePlans.length?"Ya tienes todos los ingredientes.":nextRecipePlan?.plannedFor?("Planificada para "+new Date(nextRecipePlan.plannedFor+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"short"})+" · faltan "+nextRecipePlan.missing.length):("No la has perdido · faltan "+(nextRecipePlan?.missing.length||0)+" ingredientes")}</p></div><b>Ver →</b></button>}
  <button className="home-weekly-strip" onClick={openWeekly}><span>📅</span><div><small>MENÚ SEMANAL</small><strong>{state.weeklyMenu?"Semana preparada":"Planifica 7 días sin pensar cada comida"}</strong><p>{state.weeklyMenu?"Revisa platos y añade de una vez lo que falte a Comprar.":"HomeOS usa Casa, gustos, eventos y recetas."}</p></div><b>Ver menú →</b></button>

  <div className="home-status-grid">
   <button className="status-card expiry-card" onClick={()=>{setCasaFocus("expiring");setView("casa")}}><span>⏳</span><div><small>CADUCA PRONTO</small><strong>{expiring.length}</strong><p>{expiring[0]?.name||"Nada urgente"}</p></div><b>›</b></button>
   <button className="status-card budget-card" onClick={()=>setView("finanzas")}><span>€</span><div><small>TE QUEDA ESTE MES</small><strong>{Math.max(0,available).toFixed(0)} €</strong><p>de {state.budget.toFixed(0)} € de presupuesto</p></div><b>›</b></button>
   <button className="status-card prepared-card" onClick={()=>{setCasaFocus("prepared");setView("casa")}}><span>🍱</span><div><small>COMIDA PREPARADA</small><strong>{readyServings}</strong><p>raciones listas</p></div><b>›</b></button>
   <button className="status-card event-card" onClick={()=>document.querySelector(".apple-calendar")?.scrollIntoView({behavior:"smooth",block:"center"})}><span>📅</span><div><small>PRÓXIMO EVENTO</small><strong>{nextDate}</strong><p>{next?.title||"Sin eventos"}</p></div><b>›</b></button>
  </div>
  {reserveDue.length>0&&<button className="reserve-review-banner" onClick={()=>{setCasaFocus("reserve");setView("casa")}}><span>❄️</span><div><small>RESERVA DEL CONGELADOR</small><strong>{reserveDue.length} producto{reserveDue.length===1?"":"s"} para revisar</strong><p>No significa que esté caducado: HomeOS te recuerda revisar calidad y decidir si conviene usarlo pronto.</p></div><b>Ver reservas →</b></button>}

  {state.profile.nutrition!=="off"&&<article className="home-habits-card simplified-habits"><div className="home-habits-head"><div><small>CÓMO COME EL HOGAR · APRENDIENDO</small><h3>Qué señales conoce HomeOS</h3></div><button onClick={openHabits}>Ver detalle</button></div><div className="habit-signal-chips">{habitSignals(state).map(([label,seen])=><span className={seen?"known":""} key={label}><b>{seen?"✓":"·"}</b>{label}</span>)}</div><p>No confundimos compras con consumo: esta parte gana precisión con recetas preparadas, correcciones y reposiciones reales.</p></article>}

  <CalendarCard state={state} setState={setState}/>
 </section>
}

function CalendarCard({state,setState}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>}){
 const today=new Date();
 const [cursor,setCursor]=useState(()=>new Date(today.getFullYear(),today.getMonth(),1));
 const [selectedDate,setSelectedDate]=useState("");
 const [selectedEventId,setSelectedEventId]=useState("");
 const [title,setTitle]=useState("");
 const eventInputRef=useRef<HTMLInputElement>(null);
 const year=cursor.getFullYear(),month=cursor.getMonth();
 const days=new Date(year,month+1,0).getDate();
 const blank=(new Date(year,month,1).getDay()+6)%7;
 const todayIso=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
 const monthLabel=new Intl.DateTimeFormat("es-ES",{month:"long",year:"numeric"}).format(cursor);
 const add=()=>{if(!title.trim()||!selectedDate)return;setState(s=>({...s,events:[...s.events,{id:crypto.randomUUID(),title:title.trim(),date:selectedDate}]}));setTitle("")};
 const move=(delta:number)=>setCursor(new Date(year,month+delta,1));
 const goToday=()=>{setCursor(new Date(today.getFullYear(),today.getMonth(),1));setSelectedDate(todayIso)};
 const selectedEvents=selectedDate?state.events.filter(e=>e.date===selectedDate):[];
 useEffect(()=>{if(selectedDate){requestAnimationFrame(()=>eventInputRef.current?.focus())}},[selectedDate]);
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{
   const target=e.target as HTMLElement|null;
   if(target&&(["INPUT","TEXTAREA","SELECT"].includes(target.tagName)||target.isContentEditable)) return;
   if(e.key!=="Delete"&&e.key!=="Backspace") return;
   const onlyEvent=!selectedEventId&&selectedEvents.length===1?selectedEvents[0].id:"";
   const id=selectedEventId||onlyEvent;
   if(!id)return;
   e.preventDefault();
   setState(s=>({...s,events:s.events.filter(ev=>ev.id!==id)}));
   setSelectedEventId("");
  };
  window.addEventListener("keydown",onKey);
  return()=>window.removeEventListener("keydown",onKey);
 },[selectedEventId,selectedDate,state.events]);
 return <article className="calendar-card apple-calendar">
   <div className="apple-calendar-top">
    <div>
      <small>CALENDARIO DEL HOGAR</small>
      <div className="apple-month-row">
        <h3>{monthLabel}</h3>
        <div className="apple-calendar-controls">
          <button onClick={()=>move(-1)} aria-label="Mes anterior">‹</button>
          <button onClick={goToday}>Hoy</button>
          <button onClick={()=>move(1)} aria-label="Mes siguiente">›</button>
        </div>
      </div>
    </div>
    <div className="apple-calendar-legend"><span className="legend-dot today-dot"/>Hoy <span className="legend-dot event-dot"/>Evento</div>
   </div>

   <div className="apple-calendar-body">
    <div className="apple-calendar-main">
      <div className="calendar-week apple-week">{["L","M","X","J","V","S","D"].map(x=><b key={x}>{x}</b>)}</div>
      <div className="calendar-grid apple-grid">
       {Array.from({length:blank}).map((_,i)=><span className="calendar-blank" key={"b"+i}/>)}
       {Array.from({length:days}).map((_,i)=>{
        const d=i+1;
        const iso=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        const events=state.events.filter(e=>e.date===iso);
        const cls=["apple-day",events.length?"has-event":"",iso===todayIso?"today":"",iso===selectedDate?"selected":""].filter(Boolean).join(" ");
        return <button className={cls} key={d} onClick={()=>{setSelectedDate(iso);setSelectedEventId("");setTitle("")}}>
          <span className="day-number">{d}</span>
          {events.length>0&&<div className="day-events">{events.slice(0,2).map(ev=><span key={ev.id}>{ev.title}</span>)}</div>}
        </button>
       })}
      </div>
    </div>

    <aside className={selectedDate?"apple-event-panel open":"apple-event-panel"}>
      {selectedDate?<><div className="event-panel-date"><small>FECHA SELECCIONADA</small><strong>{new Date(selectedDate+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</strong></div>
      {selectedEvents.length>0&&<div className="event-existing">{selectedEvents.map(ev=><div className={selectedEventId===ev.id?"event-row selected":"event-row"} key={ev.id} onClick={()=>setSelectedEventId(ev.id)}><span className="event-color-dot"/><b>{ev.title}</b><button className="event-delete" onClick={(e)=>{e.stopPropagation();setState(s=>({...s,events:s.events.filter(x=>x.id!==ev.id)}));setSelectedEventId("")}}>Eliminar</button></div>)}<small className="keyboard-hint">Selecciona un evento y pulsa Supr/Delete para eliminarlo.</small></div>}
      <form className="event-compose" onSubmit={e=>{e.preventDefault();add()}}><label htmlFor="calendar-event-input">Escribe el evento</label><div className="event-compose-row"><input ref={eventInputRef} id="calendar-event-input" value={title} onChange={e=>setTitle(e.target.value)} enterKeyHint="send" autoComplete="off" placeholder="Ej. comida familiar"/><button type="submit" disabled={!title.trim()}>Confirmar</button></div><small>Enter en ordenador · Enviar en móvil</small></form></>:<div className="event-empty"><span>＋</span><strong>Selecciona un día</strong><p>Haz clic en cualquier fecha para añadir o ver eventos.</p></div>}
    </aside>
   </div>
  </article>
}

function Comer({state,setState,addFromRecipe,saveRecipePlan,cancelRecipePlan,setToast,mealSeed,clearMealSeed,focusTab,clearFocusTab}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;addFromRecipe:(r:Recipe,plannedFor?:string)=>void;saveRecipePlan:(r:Recipe,plannedFor?:string)=>void;cancelRecipePlan:(planId:string)=>void;setToast:(s:string)=>void;mealSeed:string;clearMealSeed:()=>void;focusTab:"ideas"|"aprovechar"|"menu"|"habitos"|null;clearFocusTab:()=>void}){
 const [mode,setMode]=useState<CookingStyle>(state.profile.cooking);
 const [tab,setTab]=useState<"ideas"|"aprovechar"|"menu"|"habitos">("ideas");
 const [index,setIndex]=useState(0);
 const [open,setOpen]=useState(false);
 const [savePreparedAfter,setSavePreparedAfter]=useState(false);
 const [leftoverServings,setLeftoverServings]=useState(1);
 const [useMuch,setUseMuch]=useState("");
 const [craving,setCraving]=useState("");
 const [selectedRecipeId,setSelectedRecipeId]=useState<string|null>(null);
 const [aiRecipes,setAiRecipes]=useState<Recipe[]>([]);
 const [aiLoading,setAiLoading]=useState(false);
 const [aiProgress,setAiProgress]=useState(0);
 const [aiProgressText,setAiProgressText]=useState("");
 const [aiError,setAiError]=useState("");
 const [mealListening,setMealListening]=useState(false);
 const [reuseOpen,setReuseOpen]=useState(false);
 const [selectedReuseId,setSelectedReuseId]=useState<string|null>(null);
 const [catalogOpen,setCatalogOpen]=useState(false);
 const [catalogQuery,setCatalogQuery]=useState("");
 const [recipeScope,setRecipeScope]=useState<"casa"|"planear">("casa");
 useEffect(()=>{if(mealSeed){setCraving(mealSeed);setTab("ideas");clearMealSeed()}},[mealSeed]);
 useEffect(()=>{if(focusTab){setTab(focusTab);clearFocusTab()}},[focusTab]);
 const allRecipes=[...RECIPES,...state.recipePlans.map(p=>p.recipe),...aiRecipes].filter((r,i,a)=>a.findIndex(x=>x.id===r.id)===i);
 const options=allRecipes.filter(r=>r.mode.includes(mode)).sort((a,b)=>score(b,state.inventory)-score(a,state.inventory));
 const pool=options.length?options:allRecipes;
 const autoRecipe=pool[index%pool.length];
 const recipe=(selectedRecipeId?allRecipes.find(r=>r.id===selectedRecipeId):undefined)||autoRecipe;
 const filtered=useMuch?allRecipes.filter(r=>r.ingredients.some(i=>norm(i.name).includes(norm(useMuch))||norm(i.key).includes(norm(useMuch)))||norm(r.title).includes(norm(useMuch))):[];
 const searchStopWords=new Set(["tengo","quiero","puedo","hacer","para","como","algo","alguna","algun","alguno","alguna","esto","esta","este","que","con","una","uno","unos","unas","del","las","los","por","favor"]);
 const cravingWords=norm(craving).split(/\s+/).filter(w=>w.length>2&&!searchStopWords.has(w));
 const mentionedProducts=detectProductsInText(craving);
 const requireAllMentioned=mentionedProducts.length>1&&/(ambos|los dos|las dos|juntos|juntas|aprovechar|usar|gastar|con .* y )/.test(norm(craving));
 const recipeUses=(r:Recipe,p:{canonical:string})=>r.ingredients.some(i=>{
  const ip=classifyProduct(i.name,inferCategory(i.name));
  const a=norm(ip.canonical),b=norm(p.canonical),raw=norm(i.name+" "+i.key);
  return a===b||a.includes(b)||b.includes(a)||raw.includes(b);
 });
 const recipeIntentScore=(r:Recipe,q:string)=>{
  const query=norm(q);
  const text=norm([r.title,r.description,...r.ingredients.map(i=>i.name)].join(" "));
  let points=0;
  const intents=[
   {q:/postre|dulce|merienda|chocolate/,r:/postre|dulce|chocolate|brownie|bizcocho|tortita|mug cake|yogur|avena|platano/},
   {q:/desayuno/,r:/desayuno|avena|yogur|tortita|batido|sandwich|huevo/},
   {q:/cena/,r:/cena|ensalada|merluza|revuelto|wrap|sopa|crema|tortilla|sandwich/},
   {q:/rapido|rapida|poco tiempo|10 min|15 min/,r:/rapido|rápido|batido|yogur|sandwich|revuelto|ensalada|mug cake/},
   {q:/proteina|proteico|proteica/,r:/pollo|pavo|huevo|atun|salmon|merluza|yogur|proteina/},
   {q:/vegetal|vegano|vegetariano/,r:/tofu|garbanzo|lenteja|verdura|hummus|ensalada|calabaza/}
  ];
  for(const intent of intents)if(intent.q.test(query)&&intent.r.test(text))points+=8;
  return points;
 };
 const confirmedForQuery=(ing:RecipeIngredient)=>mentionedProducts.some(p=>recipeUses({ingredients:[ing]} as Recipe,p));
 const missingForQuery=(r:Recipe)=>missing(r,state.inventory).filter(ing=>!confirmedForQuery(ing));
 const miss=missingForQuery(recipe);
 const cravingMatches=craving.trim()?allRecipes.map(r=>{
  const hay=norm([r.title,r.description,...r.ingredients.map(i=>i.name)].join(" "));
  const wordHits=cravingWords.filter(w=>hay.includes(w)).length;
  const productHits=mentionedProducts.filter(p=>recipeUses(r,p)).length;
  const allProducts=!mentionedProducts.length||productHits===mentionedProducts.length;
  const intent=recipeIntentScore(r,craving);
  const missCount=missingForQuery(r).length;
  return {r,wordHits,productHits,allProducts,intent,fit:score(r,state.inventory),missCount};
 }).filter(x=>requireAllMentioned?x.allProducts:(x.productHits>0||x.wordHits>0||x.intent>0)).sort((a,b)=>recipeScope==="casa"?(a.missCount-b.missCount||b.intent-a.intent||Number(b.allProducts)-Number(a.allProducts)||b.productHits-a.productHits||b.wordHits-a.wordHits||b.fit-a.fit):(b.intent-a.intent||Number(b.allProducts)-Number(a.allProducts)||b.productHits-a.productHits||b.wordHits-a.wordHits||a.missCount-b.missCount||b.fit-a.fit)).map(x=>x.r):[];
 const baseSuggestions=craving.trim()?cravingMatches:(recipeScope==="casa"?pool:allRecipes);
 const suggestions=baseSuggestions.slice(0,4);
 const catalogBase=baseSuggestions;
 const catalogRecipes=catalogQuery.trim()?catalogBase.filter(r=>{
  const q=norm(catalogQuery);
  return norm([r.title,r.description,...r.ingredients.map(i=>i.name)].join(" ")).includes(q);
 }):catalogBase;
 const availableTools=(recipe.tools||[]).filter(t=>state.profile.kitchenTools.includes(t));
 const dislikers=state.members.slice(0,state.profile.householdSize).map(member=>{
  const dislikes=member.dislikes.split(/[,;\n]/).map(x=>norm(x.trim())).filter(Boolean);
  const matches=recipe.ingredients.filter(i=>dislikes.some(d=>norm(i.name).includes(d)||d.includes(norm(i.key))||norm(i.key).includes(d))).map(i=>i.name);
  return {name:member.name,matches};
 }).filter(x=>x.matches.length);

 const reuseIdeasBase=REUSE_IDEAS.map(idea=>{
  const matched=idea.needs.filter(n=>needAvailable(state.inventory,n)).length;
  const mentionedHits=mentionedProducts.filter(p=>idea.needs.some(n=>norm(n.key).includes(norm(p.canonical))||norm(p.canonical).includes(norm(n.key))||norm(n.label).includes(norm(p.canonical)))).length;
  return {...idea,matched,ready:matched===idea.needs.length,mentionedHits};
 }).sort((a,b)=>Number(b.ready)-Number(a.ready)||b.mentionedHits-a.mentionedHits||b.matched-a.matched);
 const reuseIdeas=mentionedProducts.length?reuseIdeasBase.filter(x=>requireAllMentioned?x.mentionedHits===mentionedProducts.length:x.mentionedHits>0):reuseIdeasBase;
 const selectedReuse=REUSE_IDEAS.find(x=>x.id===selectedReuseId)||reuseIdeas[0];
 const expiringForReuse=state.inventory.filter(i=>i.stock!=="falta"&&(daysUntil(i.expires)<=5||i.stock==="mucho")).sort((a,b)=>daysUntil(a.expires)-daysUntil(b.expires)).slice(0,6);
 const preferenceMembers=state.members.slice(0,state.profile.householdSize).filter(m=>m.dislikes.trim());
 const savedPlans=state.recipePlans.filter(p=>p.status==="saved").map(p=>({...p,missing:missing(p.recipe,state.inventory)})).sort((a,b)=>(a.plannedFor||"9999").localeCompare(b.plannedFor||"9999")||a.createdAt.localeCompare(b.createdAt));
 const weeklyPlan=state.weeklyMenu;
 const weekStart=weeklyPlan?.startDate||weeklyPlan?.createdAt||new Date().toISOString().slice(0,10);
 const weekDates=Array.from({length:7},(_,i)=>{
  const d=new Date(weekStart+"T12:00:00");d.setDate(d.getDate()+i);
  return {iso:d.toISOString().slice(0,10),label:d.toLocaleDateString("es-ES",{weekday:"long"}),date:d.toLocaleDateString("es-ES",{day:"numeric",month:"short"})};
 });
 const weeklySlots=weeklyPlan?.slots||[];
 const weeklyRecipes=weeklySlots.map(slot=>({slot,recipe:RECIPES.find(r=>r.id===slot.recipeId)})).filter(x=>x.recipe) as {slot:WeeklyMenuPlan["slots"][number];recipe:Recipe}[];
 const weeklyNeedMap=new Map<string,{name:string;key:string;amountBase:number;unit:string;family:string}>();
 for(const {recipe:r} of weeklyRecipes){
  for(const ing of r.ingredients){
   const parsed=parseQty(ing.qty);
   if(!parsed)continue;
   const family=unitFamily(parsed.unit);
   const canonical=norm(classifyProduct(ing.name,inferCategory(ing.name)).canonical);
   const key=canonical+"|"+family+"|"+(family==="count"?normalizedUnit(parsed.unit):"");
   const base=toBase(parsed.amount,parsed.unit);
   const prev=weeklyNeedMap.get(key);
   if(prev)prev.amountBase+=base;
   else weeklyNeedMap.set(key,{name:ing.name,key:ing.key,amountBase:base,unit:parsed.unit,family});
  }
 }
 const weeklyMissing=[...weeklyNeedMap.values()].map(need=>{
  const candidates=state.inventory.filter(i=>productMatchesNeed(i,need.key)&&usableInventoryItem(i));
  let availableBase=0;
  for(const i of candidates){
   const itemFamily=unitFamily(i.unit);
   if(itemFamily!==need.family)continue;
   if(need.family==="count"&&normalizedUnit(need.unit)!=="ud"&&normalizedUnit(i.unit)!==normalizedUnit(need.unit))continue;
   availableBase+=toBase(Math.max(0,i.qty),i.unit);
  }
  const shortBase=Math.max(0,need.amountBase-availableBase);
  if(shortBase<=0)return null;
  const amount=Math.round(fromBase(shortBase,need.unit)*100)/100;
  return {name:need.name,key:need.key,qty:String(amount)+" "+need.unit};
 }).filter(Boolean) as RecipeIngredient[];

 function generateWeek(){
  const dislikes=state.members.slice(0,state.profile.householdSize).flatMap(m=>m.dislikes.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean));
  const inventory=state.inventory.filter(usableInventoryItem).map(i=>i.name);
  const priority=state.inventory.filter(usableInventoryItem).filter(i=>i.stock==="mucho"||daysUntil(i.expires)<=5||daysUntil(i.estimatedExpires)<=5).map(i=>i.name);
  const plan=buildWeeklyMenu(RECIPES,{inventory,dislikes,tools:state.profile.kitchenTools,people:state.profile.householdSize,priority});
  setState(s=>({...s,weeklyMenu:plan}));
  setToast("Menú semanal preparado con lo que hay en casa");
 }
 function openWeekRecipe(r:Recipe){
  chooseRecipe(r);setOpen(true);
 }
 function addWeekMissing(){
  if(!weeklyMissing.length){setToast("El menú ya encaja con lo que tienes");return}
  const grouped=new Map<string,{name:string;qty:number;unit:string;category:string}>();
  for(const ing of weeklyMissing){
   const parsed=parseQty(ing.qty);
   const unit=parsed?.unit||inferUnit(ing.name);
   const qty=parsed?.amount||1;
   const key=norm(classifyProduct(ing.name,inferCategory(ing.name)).canonical)+"|"+unit;
   const prev=grouped.get(key);
   if(prev)prev.qty=Math.round((prev.qty+qty)*100)/100;
   else grouped.set(key,{name:ing.name,qty,unit,category:inferCategory(ing.name)});
  }
  setState(s=>{
   const shopping=[...s.shopping];
   for(const item of grouped.values()){
    const p=classifyProduct(item.name,item.category);
    const existing=shopping.findIndex(x=>norm(classifyProduct(x.name,x.category).canonical)===norm(p.canonical)&&x.status==="pendiente");
    if(existing>=0)shopping[existing]={...shopping[existing],qty:Math.max(shopping[existing].qty,item.qty),reason:"receta"};
    else shopping.push({id:crypto.randomUUID(),name:item.name,qty:item.qty,unit:item.unit,category:p.category,subcategory:p.subcategory,requestedBy:"Menú semanal",reason:"receta",status:"pendiente"});
   }
   return {...s,shopping};
  });
  setToast(grouped.size+" productos del menú añadidos a compra");
 }

 function completeReuse(){
  if(!selectedReuse)return;
  let exact=true;
  setState(s=>{
   let inv=s.inventory;
   for(const need of selectedReuse.needs){
    const result=consumeNeed(inv,need);
    inv=result.inventory;exact=exact&&result.exact;
   }
   if(selectedReuse.output){
    const out=selectedReuse.output;
    const profile=classifyProduct(out.name,out.category);
    const existing=inv.findIndex(i=>norm(i.name)===norm(out.name)&&i.unit===out.unit&&i.location===out.location);
    if(existing>=0){
     inv=inv.map((i,idx)=>idx===existing?{...i,qty:i.qty+out.qty,stock:"hay",purchasedAt:new Date().toISOString().slice(0,10),preparedAt:new Date().toISOString().slice(0,10)}:i);
    }else{
     inv=[{id:crypto.randomUUID(),name:out.name,qty:out.qty,unit:out.unit,location:out.location,category:out.category,subcategory:profile.subcategory,stock:"hay",purchasedAt:new Date().toISOString().slice(0,10),preparedAt:new Date().toISOString().slice(0,10),source:"receta"},...inv];
    }
   }
   return {...s,inventory:inv};
  });
  setReuseOpen(false);
  setToast(exact?"Inventario actualizado":"Inventario actualizado · revisa una cantidad incompatible");
 }


 function startMealVoice(){
  const W=(window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if(!W){setToast("El reconocimiento de voz no está disponible en este navegador");return}
  const recognition=new W();
  recognition.lang="es-ES";recognition.interimResults=false;recognition.maxAlternatives=1;
  setMealListening(true);
  recognition.onresult=(e:any)=>{
   const text=e.results?.[0]?.[0]?.transcript||"";
   setCraving(text);
   const spoken=norm(text);
   if(/menu|semana|semanal|planifica/.test(spoken)){setTab("menu");generateWeek();setToast("Te he preparado una propuesta semanal")}
   else if(/aprovecha|aprovechar|gastar|sobra|sobran|transform/.test(spoken)){setTab("aprovechar");setToast("He usado lo que acabas de decir como contexto")}
   else {setTab("ideas");setToast("He usado lo que acabas de decir como contexto")}
   
  };
  recognition.onerror=()=>setToast("No he podido entender la voz");
  recognition.onend=()=>setMealListening(false);
  recognition.start();
 }

 async function runLocalAI(){
  setAiError("");
  if(!localAiSupported()){setAiError("Este navegador no ofrece WebGPU. HomeOS seguirá usando el libro local de recetas sin coste.");return}
  setAiLoading(true);setAiProgress(0);setAiProgressText("Preparando IA local");
  try{
   const inventory=state.inventory.filter(usableInventoryItem).slice(0,60).map(i=>i.name+" · "+i.qty+" "+i.unit+" · "+i.location+(i.expires?" · fecha "+i.expires:""));
   const dislikes=state.members.slice(0,state.profile.householdSize).flatMap(m=>m.dislikes.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean));
   const generated=await generateLocalRecipes({
    request:craving.trim()||"Dame tres ideas útiles usando lo que tengo en casa",
    inventory,
    people:state.profile.householdSize,
    dislikes,
    tools:state.profile.kitchenTools,
    mode
   },p=>{setAiProgress(p.progress);setAiProgressText(p.text)});
   const mapped:Recipe[]=generated.map((r,idx)=>({
    id:"local-ai-"+Date.now()+"-"+idx,
    title:r.title,
    image:RECIPES[0]?.image||"/icon.svg",
    time:r.time,
    difficulty:r.time<=30?"Fácil":"Media",
    mode:[mode],
    servings:r.servings,
    calories:0,protein:0,carbs:0,fat:0,
    ingredients:r.ingredients,
    steps:r.steps,
    description:r.description,
    tools:r.tools,
    source:"local-ai"
   }));
   setAiRecipes(mapped);
   if(mapped[0])setSelectedRecipeId(mapped[0].id);
   setToast("3 ideas creadas con IA local");
  }catch(err:any){
   setAiError(err?.message==="webgpu_unavailable"?"Este navegador no soporta la IA local.":"No he podido generar ideas ahora. El libro local sigue disponible.");
  }finally{
   setAiLoading(false);
  }
 }
 function chooseRecipe(r:Recipe){
  setSelectedRecipeId(r.id);
  setMode(r.mode.includes(mode)?mode:r.mode[0]);
  setIndex(0);
 }
 function completeRecipe(servingsToStore=0){
  let wasExact=true;
  setState(s=>{
   const consumed=consumeRecipeIngredients(s.inventory,recipe.ingredients);
   wasExact=consumed.exact;
   let inventory=consumed.inventory;
   const today=new Date().toISOString().slice(0,10);
   if(servingsToStore>0){
    const existing=inventory.findIndex(i=>norm(i.name)===norm(recipe.title)&&i.category==="Preparados"&&i.location==="Nevera");
    if(existing>=0)inventory=inventory.map((i,idx)=>idx===existing?{...i,qty:i.qty+servingsToStore,servings:(i.servings||i.qty)+servingsToStore,stock:"hay",preparedAt:today,purchasedAt:today,preparedRecipeId:recipe.id,preparedIngredients:recipe.ingredients.map(x=>({name:x.name,key:x.key,category:inferCategory(x.name)}))}:i);
    else inventory=[{id:crypto.randomUUID(),name:recipe.title,qty:servingsToStore,unit:"raciones",location:"Nevera",category:"Preparados",subcategory:"Preparado",stock:"hay",purchasedAt:today,preparedAt:today,servings:servingsToStore,source:recipe.mode.includes("mealprep")?"mealprep":"receta",preparedRecipeId:recipe.id,preparedIngredients:recipe.ingredients.map(x=>({name:x.name,key:x.key,category:inferCategory(x.name)}))},...inventory];
   }
   const eatenServings=Math.max(0,recipe.servings-servingsToStore);
   const mealHistory=eatenServings>0?[...s.mealHistory,{
    id:crypto.randomUUID(),date:today,recipeId:recipe.id,title:recipe.title,servings:eatenServings,
    ingredients:recipe.ingredients.map(i=>({name:i.name,key:i.key,category:inferCategory(i.name)}))
   }].slice(-400):s.mealHistory;
   const completedPlanIds=s.recipePlans.filter(p=>p.recipe.id===recipe.id).map(p=>p.id);
   const releasedInventory=inventory.map(i=>({...i,planReservations:(i.planReservations||[]).filter(r=>!r.planId||!completedPlanIds.includes(r.planId))}));
   return {...s,inventory:releasedInventory,mealHistory,recipePlans:s.recipePlans.filter(p=>p.recipe.id!==recipe.id)};
  });
  setOpen(false);setSavePreparedAfter(false);
  setToast(servingsToStore>0?(wasExact?"Ingredientes descontados · preparado guardado":"Preparado guardado · revisa una cantidad"):(wasExact?"Ingredientes descontados del inventario":"Ingredientes actualizados · hay una cantidad por revisar"));
 }

 return <section className="stack">
  <div className="page-intro"><div><span className="eyebrow">COMER</span><h2>Qué te apetece y qué puedes hacer</h2><p>Decide si quieres cocinar con Casa ahora o planear algo para lo que puedes comprar ingredientes.</p></div><div className="view-tabs eat-tabs"><button className={tab==="ideas"?"active":""} onClick={()=>setTab("ideas")}>Ideas para comer</button><button className={tab==="aprovechar"?"active":""} onClick={()=>setTab("aprovechar")}>Aprovechar</button><button className={tab==="menu"?"active":""} onClick={()=>setTab("menu")}>Menú semanal</button>{state.profile.nutrition!=="off"&&<button className={tab==="habitos"?"active":""} onClick={()=>setTab("habitos")}>Cómo comemos</button>}</div></div>
  {preferenceMembers.length>0&&<div className="meal-household-strip"><span>✓</span><p><b>Preferencias activas:</b> HomeOS tiene en cuenta lo que no gusta a {preferenceMembers.map(m=>m.name).join(", ")} al ordenar y avisar sobre recetas.</p></div>}
  {tab==="ideas"&&savedPlans.length>0&&<section className="saved-recipe-plans"><div className="saved-recipe-head"><div><small>PARA OTRO MOMENTO</small><h3>Recetas que no quieres perder</h3></div><span>{savedPlans.length}</span></div><div className="saved-recipe-grid">{savedPlans.slice(0,6).map(p=><article className={p.missing.length?"saved-recipe-card":"saved-recipe-card ready"} key={p.id}><button className="saved-recipe-main" onClick={()=>{chooseRecipe(p.recipe);setCraving("")}}><img src={p.recipe.image} alt="" loading="lazy"/><div><strong>{p.recipe.title}</strong><small>{p.plannedFor?new Date(p.plannedFor+"T12:00:00").toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short"}):"Sin fecha"} · {p.missing.length?p.missing.length+" por comprar":"✓ lista para cocinar"}</small></div></button><div className="saved-recipe-actions">{p.missing.length>0?<button onClick={()=>addFromRecipe(p.recipe,p.plannedFor)}>Añadir faltantes</button>:<button onClick={()=>{chooseRecipe(p.recipe);setOpen(true)}}>Preparar</button>}<button className="remove-plan" onClick={()=>cancelRecipePlan(p.id)} aria-label="Quitar receta guardada">×</button></div></article>)}</div></section>}

  {tab==="ideas"?<>
   <article className="meal-request">
    <div><small>¿QUÉ TE APETECE?</small><h3>Dilo o escríbelo como hablarías en casa</h3><p>Ej.: “Tengo leche y yogur y quiero aprovechar ambos” o “quiero una cena rápida con pollo”.</p></div>
    <div className="meal-query-input"><input value={craving} onChange={e=>setCraving(e.target.value)} enterKeyHint="search" placeholder="Tengo leche y yogur, quiero aprovechar ambos…"/><button className={mealListening?"meal-mic listening":"meal-mic"} onClick={startMealVoice} aria-label="Hablar">{mealListening?"…":micIcon()}</button></div>
    {mentionedProducts.length>0&&<div className="meal-confirmed-products">{mentionedProducts.map(p=><span key={p.canonical}>✓ {p.canonical} <small>{state.inventory.some(i=>productMatchesNeed(i,p.canonical))?"en Casa":"confirmado por ti para esta consulta"}</small></span>)}</div>}
    {craving.trim()&&<div className="meal-request-results">{cravingMatches.length?cravingMatches.slice(0,4).map(r=><button key={r.id} onClick={()=>{chooseRecipe(r);setCraving("")}}><span>{productIcon(r.ingredients[0]?.name||r.title,inferCategory(r.ingredients[0]?.name||""))}</span><div><strong>{r.title}</strong><small>{missingForQuery(r).length?String(missingForQuery(r).length)+" ingredientes por completar":"Puedes hacerlo con lo que has confirmado"}</small></div><b>›</b></button>):<div className="recipe-empty">No hay una coincidencia exacta en las recetas disponibles. La IA local puede crear opciones nuevas sin enviar tus datos a una API de pago.</div>}</div>}
    <div className="local-ai-meals">
     <div><small>IA LOCAL · SIN COSTE POR USO</small><strong>Crea recetas nuevas en tu propio dispositivo</strong><p>La primera vez descarga un modelo al dispositivo y puede tardar. Después queda en caché. No necesita clave de API ni saldo.</p></div>
     {localAiSupported()?<button className="local-ai-run" disabled={aiLoading} onClick={runLocalAI}>{aiLoading?"Preparando "+aiProgress+"%":"✦ Generar con IA local"}</button>:<span className="local-ai-unavailable">Este navegador usará el libro local de recetas.</span>}
     {aiLoading&&<div className="local-ai-progress"><span style={{width:aiProgress+"%"}}/><small>{aiProgressText}</small></div>}
     {aiError&&<p className="local-ai-error">{aiError}</p>}
    </div>
   </article>

   <div className="recipe-scope-switch"><button className={recipeScope==="casa"?"active":""} onClick={()=>setRecipeScope("casa")}><span>🏠</span><div><strong>Con lo que tengo</strong><small>Prioriza recetas que puedes hacer ya o casi.</small></div></button><button className={recipeScope==="planear"?"active":""} onClick={()=>setRecipeScope("planear")}><span>🛒</span><div><strong>Planear · puedo comprar</strong><small>Busca por apetencia aunque falten ingredientes.</small></div></button></div>

   <div className="mode-row meal-modes">{[["rapido","⚡ Rápido"],["normal","🍽 Normal"],["cocinar","👨‍🍳 Cocinar"],["mealprep","🍱 Meal prep"]].map(([id,label])=><button key={id} className={mode===id?"active":""} onClick={()=>{setMode(id as CookingStyle);setIndex(0);setSelectedRecipeId(null)}}>{label}</button>)}</div>

   <div className="recipe-options-head"><div><small>CON LO QUE TIENES</small><h3>{mode==="mealprep"?"Opciones para preparar varias raciones":"Varias opciones, no solo una"}</h3></div><button className="recipe-catalog-toggle" onClick={()=>setCatalogOpen(v=>!v)}>{catalogOpen?"Cerrar catálogo":"Ver todas"} · {catalogBase.length} recetas</button></div>
   <div className="recipe-option-grid">{suggestions.map(r=>{const rm=missingForQuery(r);return <button className={recipe.id===r.id?"recipe-option selected":"recipe-option"} key={r.id} onClick={()=>chooseRecipe(r)}><img src={r.image} alt="" loading="lazy" decoding="async"/><div><strong>{r.title}</strong><span>{r.time} min · {r.servings} raciones</span><small className={rm.length?"needs":"ready"}>{rm.length?String(rm.length)+" por completar":"✓ Puedes hacerlo"}</small></div></button>})}</div>{catalogOpen&&<section className="recipe-catalog"><div className="recipe-catalog-head"><div><small>CATÁLOGO DE RECETAS</small><strong>{catalogRecipes.length} opciones</strong></div><input value={catalogQuery} onChange={e=>setCatalogQuery(e.target.value)} placeholder="Buscar dentro del catálogo…"/></div><div className="recipe-catalog-grid">{catalogRecipes.map(r=>{const rm=missingForQuery(r);return <button key={r.id} className={recipe.id===r.id?"catalog-recipe selected":"catalog-recipe"} onClick={()=>{chooseRecipe(r);setCatalogOpen(false);window.scrollTo({top:document.querySelector(".featured-meal")?.getBoundingClientRect().top?window.scrollY+(document.querySelector(".featured-meal") as HTMLElement).getBoundingClientRect().top-90:window.scrollY,behavior:"smooth"})}}><img src={r.image} alt="" loading="lazy" decoding="async"/><div><strong>{r.title}</strong><span>{r.time} min · {r.servings} raciones</span><small>{rm.length?String(rm.length)+" ingredientes por completar":"✓ Puedes hacerla"}</small></div></button>})}</div></section>}

   <article className="featured-meal"><img src={recipe.image} alt={recipe.title} loading="lazy" decoding="async"/><div className="featured-copy"><span className="eyebrow">{miss.length?String(miss.length)+" INGREDIENTES POR COMPLETAR":"PUEDES HACERLO YA"}</span><h3>{recipe.title}</h3><p>{recipe.description}</p><div className="chips"><span>{recipe.time} min</span><span>{recipe.difficulty}</span><span>{recipe.servings} raciones</span></div>{availableTools.length>0&&<div className="recipe-tools"><small>PUEDES HACERLA CON</small>{availableTools.map(t=><span key={t}>{t}</span>)}</div>}{recipe.source==="local-ai"?<div className="ai-recipe-note"><b>✦ IA local</b><span>Receta generada en tu dispositivo · revisa cantidades y cocción antes de preparar.</span></div>:<div className="macro-row"><b>{recipe.calories} kcal</b><span>{recipe.protein}g proteína</span><span>{recipe.carbs}g carbos</span><span>{recipe.fat}g grasas</span><small>por ración · estimación</small></div>}
    {dislikers.length>0&&<div className="family-warning">{dislikers.map((d,i)=><span key={d.name}>⚠ {d.name==="Tú"?"Has marcado que no te gusta":("A "+d.name+" no le gusta")} {d.matches.join(", ")}{i<dislikers.length-1?".":""}</span>)}</div>}
    <div className="meal-actions"><button className="primary" onClick={()=>setOpen(true)}>Preparar esta receta</button><button className="secondary" onClick={()=>saveRecipePlan(recipe)}>Guardar para luego</button><button className="secondary" onClick={()=>{setSelectedRecipeId(null);setIndex(i=>i+1)}}>Siguiente idea</button></div><div className="recipe-plan-when"><span>Si no es para ahora:</span><button onClick={()=>miss.length?addFromRecipe(recipe,isoAfterDays(1)):saveRecipePlan(recipe,isoAfterDays(1))}>Mañana{miss.length?" + compra":""}</button><button onClick={()=>miss.length?addFromRecipe(recipe,weekendPlanIso()):saveRecipePlan(recipe,weekendPlanIso())}>Este finde{miss.length?" + compra":""}</button>{miss.length>0&&<button className="buy-missing-plan" onClick={()=>addFromRecipe(recipe)}>Sin fecha + añadir faltantes</button>}</div></div></article>

   <div className="ingredient-summary clearer"><article><small>YA TIENES EN CASA</small><strong>{recipe.ingredients.length-miss.length} de {recipe.ingredients.length}</strong>{recipe.ingredients.filter(i=>!miss.some(m=>m.name===i.name)).map(i=><span key={i.name}>✓ {i.name}</span>)}</article><article><small>NECESITAS PARA COMPLETARLA</small><strong>{miss.length?String(miss.length)+" ingredientes":"Nada"}</strong>{miss.length?miss.map(i=><span key={i.name}>• {i.name}</span>):<span>✓ Está todo listo</span>}<button onClick={()=>addFromRecipe(recipe)} disabled={!miss.length}>{miss.length?"Guardar receta + añadir faltantes":"Ya tienes todo"}</button></article></div>

   <article className="use-more-card"><div><small>APROVECHAR PRODUCTO</small><h3>¿Qué quieres gastar antes?</h3><p>Escribe un producto que tengas de sobra y te mostramos recetas donde realmente se usa.</p></div><input value={useMuch} onChange={e=>setUseMuch(e.target.value)} placeholder="Ej. leche, tomates, huevos…"/>{useMuch&&<div className="recipe-mini-list">{filtered.length?filtered.slice(0,4).map(r=><button key={r.id} onClick={()=>{chooseRecipe(r);setUseMuch("")}}><strong>{r.title}</strong><span>{r.time} min · {missing(r,state.inventory).length?String(missing(r,state.inventory).length)+" por completar":"puedes hacerlo ya"}</span></button>):<div className="recipe-empty">No hay una receta preparada con ese ingrediente todavía.</div>}</div>}</article>
  </>:tab==="aprovechar"?<>
   <article className="reuse-hero"><div><small>APROVECHAMIENTO INTELIGENTE</small><h3>Ideas para gastar, transformar y no tirar</h3><p>Dilo por voz si quieres: “tengo leche y yogur y quiero usar los dos”. Los ingredientes que confirmas tú mandan sobre una estimación antigua del inventario.</p><div className="reuse-query"><input value={craving} onChange={e=>setCraving(e.target.value)} placeholder="Ej. tengo tomates y queso y quiero gastar ambos"/><button className={mealListening?"meal-mic listening":"meal-mic"} onClick={startMealVoice}>{mealListening?"…":micIcon()}</button></div>{mentionedProducts.length>0&&<div className="meal-confirmed-products">{mentionedProducts.map(p=><span key={p.canonical}>✓ {p.canonical}</span>)}</div>}</div><span>♻️</span></article>

   {expiringForReuse.length>0&&<div className="reuse-priority"><div className="recipe-options-head"><div><small>GASTAR PRIMERO</small><h3>Productos que merecen atención</h3></div></div><div className="reuse-priority-grid">{expiringForReuse.map(i=><button key={i.id} onClick={()=>{const found=reuseIdeas.find(x=>reuseIdeaMatchesProduct(x,i.name,i.category));if(found){setSelectedReuseId(found.id);setReuseOpen(true)}}}><span>{productIcon(i.name,i.category)}</span><div><strong>{i.name}</strong><small>{i.expires&&daysUntil(i.expires)<=5?("Fecha próxima · "+Math.max(0,daysUntil(i.expires))+" días"):i.stock==="mucho"?"Hay bastante":"Conviene revisar"}</small></div><b>›</b></button>)}</div></div>}

   <div className="reuse-section-head"><div><small>CON LO QUE HAY EN CASA</small><h3>Aprovechar o transformar</h3><p>Las ideas listas aparecen primero. Las demás te enseñan qué ingrediente falta.</p></div></div>
   <div className="reuse-grid">{reuseIdeas.map(idea=><article className={idea.ready?"reuse-card ready":"reuse-card"} key={idea.id}><div className="reuse-card-top"><span>{idea.icon}</span><em>{idea.kind==="transformar"?"Transformar":"Aprovechar"}</em></div><h3>{idea.title}</h3><p>{idea.summary}</p><div className="reuse-needs">{idea.needs.map(n=><span className={needAvailable(state.inventory,n)?"have":hasNeed(state.inventory,n)?"some":"missing"} key={n.key}>{needAvailable(state.inventory,n)?"✓":hasNeed(state.inventory,n)?"~":"+"} {n.label}</span>)}</div><div className="reuse-card-foot"><small>{idea.ready?"Puedes hacerlo con lo que tienes":idea.matched+" de "+idea.needs.length+" ingredientes"}</small><button onClick={()=>{setSelectedReuseId(idea.id);setReuseOpen(true)}}>{idea.ready?"Ver cómo":"Ver idea"}</button></div></article>)}</div>
  </>:tab==="menu"?<>
   <article className="weekly-menu-hero">
    <div><small>MENÚ SEMANAL</small><h3>14 comidas pensadas para tu casa</h3><p>Combina variedad, lo que probablemente tienes, gustos del hogar, tiempo y equipamiento. No es una dieta médica: es planificación doméstica práctica.</p></div>
    <div className="weekly-menu-actions"><button className="secondary" onClick={generateWeek}>{weeklyPlan?"Regenerar semana":"Crear mi semana"}</button>{weeklyPlan&&<button className="primary" disabled={!weeklyMissing.length} onClick={addWeekMissing}>{weeklyMissing.length?"Añadir faltantes a compra":"No falta nada"}</button>}</div>
   </article>
   {!weeklyPlan?<article className="weekly-menu-empty"><span>📅</span><h3>Una semana sin pensar cada día qué cocinar</h3><p>HomeOS usará el inventario conocido, evitará lo que no gusta y repartirá las recetas para no repetir siempre lo mismo.</p><button onClick={generateWeek}>Generar menú semanal</button></article>:
   <div className="weekly-menu-grid">{weekDates.map((day,dayIndex)=>{
    const daySlots=weeklySlots.filter(s=>s.day===dayIndex);
    const dayEvents=state.events.filter(e=>e.date===day.iso);
    return <article className="weekly-day" key={day.iso}><div className="weekly-day-head"><span>{dayIndex+1}</span><div><strong>{day.label.charAt(0).toUpperCase()+day.label.slice(1)}</strong><small>{day.date}</small></div></div>{dayEvents.length>0&&<div className="weekly-event-note">📅 {dayEvents.map(e=>e.title).join(" · ")}</div>}{["Comida","Cena"].map(meal=>{
     const slot=daySlots.find(s=>s.meal===meal);
     const r=slot?RECIPES.find(x=>x.id===slot.recipeId):undefined;
     return <div className="weekly-slot" key={meal}><small>{meal.toUpperCase()}</small>{r?<button onClick={()=>openWeekRecipe(r)}><span>{productIcon(r.ingredients[0]?.name||r.title,inferCategory(r.ingredients[0]?.name||""))}</span><div><b>{r.title}</b><em>{r.time} min · {missing(r,state.inventory).length?missing(r,state.inventory).length+" por completar":"encaja con Casa"}</em></div><strong>›</strong></button>:<p>Sin propuesta</p>}{slot?.why&&<i>{slot.why}</i>}</div>
    })}</article>
   })}</div>}
   {weeklyPlan&&<article className="weekly-menu-summary"><div><small>COMPRA DE LA SEMANA</small><h3>{weeklyMissing.length?weeklyMissing.length+" ingredientes por completar":"Tienes lo necesario"}</h3><p>HomeOS calcula los faltantes contra Casa. Los productos repetidos se agrupan al enviarlos a Comprar.</p></div><button disabled={!weeklyMissing.length} onClick={addWeekMissing}>🛒 Pasar faltantes a Comprar</button></article>}
  </>:<Habitos state={state}/>} 

  {open&&<div className="modal-backdrop"><div className="modal recipe-modal"><div className="modal-head"><div><span className="eyebrow">PREPARAR</span><h2>{recipe.title}</h2>{availableTools.length>0&&<small className="modal-tool-note">Compatible con {availableTools.join(" · ")}</small>}</div><button onClick={()=>setOpen(false)}>×</button></div><div className="recipe-cols"><div><h4>Ingredientes</h4>{recipe.ingredients.map(i=><p key={i.name}>{i.qty} · {i.name}</p>)}</div><div><h4>Pasos</h4>{recipe.steps.map((s,i)=><p key={s}><b>{i+1}.</b> {s}</p>)}</div></div>{recipe.source==="local-ai"?<div className="recipe-total"><span>Receta generada localmente</span><b>Sin cálculo nutricional automático</b></div>:<div className="recipe-total"><span>Total receta</span><b>≈ {recipe.calories*recipe.servings} kcal · {recipe.protein*recipe.servings}g proteína</b></div>}{!savePreparedAfter?<div className="recipe-finish-actions"><button className="secondary" onClick={()=>completeRecipe(0)}>Comido ahora</button><button className="primary" onClick={()=>{setLeftoverServings(Math.max(1,recipe.servings));setSavePreparedAfter(true)}}>Guardar para después</button></div>:<div className="save-prepared-after"><div><span>¿Cuántas raciones guardas?</span><p>Solo se crea un preparado si realmente queda comida para otro momento.</p></div><div className="stepper"><button onClick={()=>setLeftoverServings(n=>Math.max(1,n-1))}>−</button><b>{leftoverServings}</b><button onClick={()=>setLeftoverServings(n=>Math.min(recipe.servings,n+1))}>+</button></div><button className="primary" onClick={()=>completeRecipe(leftoverServings)}>Guardar {leftoverServings} ración{leftoverServings===1?"":"es"}</button></div>}</div></div>}
  {reuseOpen&&selectedReuse&&<div className="modal-backdrop" onMouseDown={()=>setReuseOpen(false)}><div className="modal recipe-modal reuse-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">{selectedReuse.kind==="transformar"?"TRANSFORMAR":"APROVECHAR"}</span><h2>{selectedReuse.title}</h2><p>{selectedReuse.summary}</p></div><button onClick={()=>setReuseOpen(false)}>×</button></div><div className="reuse-modal-grid"><div><h4>Vas a usar</h4>{selectedReuse.needs.map(n=><p key={n.key}><b>{n.amount} {n.unit}</b> · {n.label} <span className={needAvailable(state.inventory,n)?"need-ok":hasNeed(state.inventory,n)?"need-some":"need-missing"}>{needAvailable(state.inventory,n)?"✓":hasNeed(state.inventory,n)?"cantidad insuficiente":"falta"}</span></p>)}{selectedReuse.optional?.length?<><h4>Opcional</h4>{selectedReuse.optional.map(x=><p key={x}>+ {x}</p>)}</>:null}</div><div><h4>Cómo hacerlo</h4>{selectedReuse.steps.map((s,i)=><p key={s}><b>{i+1}.</b> {s}</p>)}</div></div>{selectedReuse.safety&&<div className={selectedReuse.safetyLevel==="attention"?"reuse-safety attention":"reuse-safety"}><b>Seguridad alimentaria</b><span>{selectedReuse.safety}</span></div>}{selectedReuse.output&&<div className="reuse-output"><span>Resultado en Casa</span><strong>{selectedReuse.output.name} · {selectedReuse.output.qty} {selectedReuse.output.unit}</strong></div>}<button className="primary modal-save" disabled={!selectedReuse.needs.every(n=>needAvailable(state.inventory,n))} onClick={completeReuse}>Hecho · actualizar inventario</button></div></div>}

 </section>
}

function Habitos({state}:{state:AppState}){
 const now=new Date();
 const dayMs=86400000;
 const daysAgo=(date:string)=>Math.floor((now.getTime()-new Date(date+"T12:00:00").getTime())/dayMs);
 const purchases=state.purchaseHistory.filter(x=>daysAgo(x.date)>=0&&daysAgo(x.date)<=28&& !["Limpieza y hogar","Higiene y cuidado"].includes(x.category));
 const provisional=state.inventory.filter(i=>i.purchasedAt&&daysAgo(i.purchasedAt)>=0&&daysAgo(i.purchasedAt)<=28&& !["Limpieza y hogar","Higiene y cuidado"].includes(i.category)).map(i=>({id:i.id,name:i.name,qty:i.qty,unit:i.unit,category:i.category,date:i.purchasedAt,supermarket:i.supermarket,requestedBy:"Casa"} as PurchaseRecord));
 const purchaseSource=purchases.length?purchases:provisional;
 const purchaseMode=purchases.length?"Compras reales":"Inventario reciente";
 const meals=state.mealHistory.filter(x=>daysAgo(x.date)>=0&&daysAgo(x.date)<=28);
 const recentPurchases=purchaseSource.filter(x=>daysAgo(x.date)<=14);
 const previousPurchases=purchaseSource.filter(x=>daysAgo(x.date)>14&&daysAgo(x.date)<=28);
 const recentMeals=meals.filter(x=>daysAgo(x.date)<=14);
 const previousMeals=meals.filter(x=>daysAgo(x.date)>14&&daysAgo(x.date)<=28);

 const isFruit=(n:string)=>/platano|banana|manzana|pera|naranja|mandarina|fresa|arandano|kiwi|uva|melon|sandia|melocoton|piña|mango|papaya|fruta/.test(norm(n));
 const isVeg=(n:string)=>/tomate|lechuga|brocoli|calabacin|berenjena|zanahoria|cebolla|pimiento|espinaca|pepino|verdura|aguacate|judia verde|coliflor|calabaza|puerro|apio|alcachofa|esparrago/.test(norm(n));
 const isProtein=(n:string,c:string)=>c==="Carne"||/pollo|carne|ternera|cerdo|pavo|pescado|salmon|atun|merluza|bacalao|huevo|legumbre|lenteja|garbanzo|alubia|proteina|tofu|seitan|tempeh/.test(norm(n));
 const isCarb=(n:string)=>/arroz|pasta|pan|patata|avena|cereal|harina|tortilla|cuscus|quinoa|bulgur/.test(norm(n));
 const isSnack=(n:string)=>/chocolate|galleta|chuche|gominola|snack|patatas fritas|bolleria|refresco|helado|caramelo|barrita de chocolate/.test(norm(n));
 const defs=[
  {key:"protein",name:"Proteína",icon:"🥩",test:(n:string,c:string)=>isProtein(n,c)},
  {key:"veg",name:"Verduras",icon:"🥬",test:(n:string)=>isVeg(n)},
  {key:"fruit",name:"Fruta",icon:"🍎",test:(n:string)=>isFruit(n)},
  {key:"carb",name:"Carbohidratos base",icon:"🍚",test:(n:string)=>isCarb(n)},
  {key:"snack",name:"Dulces / snacks",icon:"🍫",test:(n:string)=>isSnack(n)}
 ];

 const inventoryFood=state.inventory.filter(i=>usableInventoryItem(i)&& !["Limpieza y hogar","Higiene y cuidado","Suplementos"].includes(i.category));
 const groupOfIngredient=(x:{name:string;category:string},d:typeof defs[number])=>d.test(x.name,x.category);
 const mealGroupServings=(list:MealRecord[],d:typeof defs[number])=>list.reduce((sum,m)=>sum+(m.ingredients.some(i=>groupOfIngredient(i,d))?m.servings:0),0);
 const purchaseGroupCount=(list:PurchaseRecord[],d:typeof defs[number])=>list.filter(p=>d.test(p.name,p.category)).length;
 const groups=defs.map(d=>{
  const bought=purchaseGroupCount(purchaseSource,d);
  const eaten=mealGroupServings(meals,d);
  const available=inventoryFood.filter(i=>d.test(i.name,i.category)).length;
  const recentSignal=purchaseGroupCount(recentPurchases,d)+mealGroupServings(recentMeals,d)*1.25;
  const previousSignal=purchaseGroupCount(previousPurchases,d)+mealGroupServings(previousMeals,d)*1.25;
  let trend:"up"|"down"|"flat"|"new"="flat";
  if(previousSignal===0&&recentSignal>0)trend="new";
  else if(previousSignal>0&&recentSignal>=previousSignal*1.3)trend="up";
  else if(previousSignal>0&&recentSignal<=previousSignal*.7)trend="down";
  const evidence=bought+eaten;
  let status="Aprendiendo",tone="learn";
  if(evidence>=3){
   if(available===0&&bought>0){status="Comprado, pero ya no parece quedar";tone="mid"}
   else if(eaten>0&&available>0){status="Comprado, usado y aún disponible";tone="good"}
   else if(eaten>0){status="Aparece en comidas registradas";tone="good"}
   else if(available>0){status="Está presente en Casa";tone="good"}
   else{status="Se compra, pero falta confirmar uso";tone="learn"}
  }
  return {...d,bought,eaten,available,trend,status,tone,evidence};
 });

 const totalPurchaseLines=Math.max(1,purchaseSource.length);
 const totalMealServings=Math.max(1,meals.reduce((n,m)=>n+m.servings,0));
 const purchaseCoverage=Math.min(45,Math.round(Math.min(1,purchaseSource.length/24)*45));
 const mealCoverage=Math.min(35,Math.round(Math.min(1,meals.length/12)*35));
 const inventoryCoverage=Math.min(20,Math.round(state.inventory.length?state.inventory.filter(i=>i.stock!=="incierto").length/state.inventory.length*20:0));
 const dataQuality=Math.min(100,purchaseCoverage+mealCoverage+inventoryCoverage);
 const trendLabel=(g:typeof groups[number])=>g.trend==="up"?"↑ sube":g.trend==="down"?"↓ baja":g.trend==="new"?"↑ aparece":"→ estable";

 const actuallyUsed=meals.length;
 const hasEnough=dataQuality>=45;
 const absentAfterBuying=groups.filter(g=>g.bought>=2&&g.available===0);
 const currentPresent=groups.filter(g=>g.available>0);
 let orientation="Aún estamos aprendiendo";
 let orientationText="HomeOS necesita varias compras y algunas comidas confirmadas para distinguir mejor entre lo comprado, lo usado y lo que todavía queda.";
 let orientationTone="learn";
 if(hasEnough&&actuallyUsed>=3){
  orientation="Ya distinguimos compra, uso y disponibilidad";
  orientationText="La lectura combina lo que entra en casa, recetas realmente marcadas como comidas y lo que HomeOS cree que aún está disponible.";
  orientationTone="good";
 }else if(hasEnough){
  orientation="La cesta está clara; falta observar más comidas";
  orientationText="Sabemos bastante de lo que compráis, pero HomeOS aún no debe asumir que comprar equivale a comer.";
  orientationTone="mid";
 }

 const insightCandidates:string[]=[];
 for(const g of absentAfterBuying.slice(0,2))insightCandidates.push(g.name+" se ha comprado varias veces y ahora no aparece disponible en Casa.");
 for(const g of groups.filter(g=>g.eaten>=3).sort((a,b)=>b.eaten-a.eaten).slice(0,2))insightCandidates.push(g.name+" aparece con frecuencia en comidas confirmadas.");
 if(!insightCandidates.length&&currentPresent.length)insightCandidates.push("Ahora mismo hay "+currentPresent.map(g=>g.name.toLowerCase()).slice(0,3).join(", ")+" disponibles en Casa.");

 const recentBoughtGone=purchaseSource.filter(p=>{
  const canonical=norm(classifyProduct(p.name,p.category).canonical);
  return !inventoryFood.some(i=>norm(classifyProduct(i.name,i.category).canonical)===canonical);
 }).slice().reverse().filter((p,idx,arr)=>arr.findIndex(x=>norm(classifyProduct(x.name,x.category).canonical)===norm(classifyProduct(p.name,p.category).canonical))===idx).slice(0,6);

 const memberDemand=state.members.slice(0,state.profile.householdSize).map(m=>{
  const presence={casa:1,fuera_dia:.65,fines_semana:.38,variable:.65}[m.presence];
  const appetite={poco:.82,normal:1,mucho:1.22}[m.appetite];
  const score=presence*appetite;
  const requested=purchaseSource.filter(p=>norm(p.requestedBy||"")===norm(m.name)).length;
  return {m,score,requested,label:score>=1.05?"Demanda alta":score<=.55?"Demanda baja":"Demanda media"};
 });

 return <div className="habits-dashboard">
  <article className={"habit-orientation "+orientationTone}>
   <div><small>LECTURA DEL HOGAR · ÚLTIMOS 28 DÍAS</small><h3>{orientation}</h3><p>{orientationText}</p></div>
   <div className="habit-confidence"><span>Calidad de lectura</span><strong>{dataQuality}%</strong><small>{purchaseSource.length} líneas de compra · {meals.length} comidas confirmadas · {purchaseMode}</small></div>
  </article>

  <article className="habit-source-note">
   <span>ⓘ</span><p><b>Comprar no significa comer.</b> HomeOS separa tres señales: lo que compraste, lo que realmente marcaste como comido desde una receta y lo que probablemente sigue en Casa. Así evita inventarse hábitos.</p>
  </article>

  <div className="habit-balance-grid richer">
   {groups.map(g=>{
    const boughtPct=Math.round(g.bought/totalPurchaseLines*100);
    const eatenPct=Math.round(g.eaten/totalMealServings*100);
    return <article className={"habit-balance-card "+g.tone} key={g.key}>
     <div className="habit-balance-top"><span>{g.icon}</span><div><strong>{g.name}</strong><small>{g.status}</small></div><b>{trendLabel(g)}</b></div>
     <div className="habit-evidence-grid"><span><small>COMPRADO</small><b>{g.bought}</b><em>{boughtPct}% líneas</em></span><span><small>COMIDO</small><b>{g.eaten}</b><em>raciones registradas</em></span><span><small>AHORA EN CASA</small><b>{g.available}</b><em>productos probables</em></span></div>
    </article>
   })}
  </div>

  <div className="habit-bottom-grid">
   <article className="habit-insights">
    <div><small>QUÉ ESTÁ CAMBIANDO</small><h3>Lectura rápida</h3></div>
    {insightCandidates.length?<div className="habit-insight-list">{insightCandidates.slice(0,3).map((x,i)=><p key={i}><span>{i+1}</span>{x}</p>)}</div>:<p className="habit-empty-copy">Todavía no hay suficiente historial para sacar conclusiones útiles.</p>}
   </article>
   <article className="habit-direction">
    <small>COMPRADO Y YA NO DISPONIBLE</small>
    <h3>{recentBoughtGone.length?recentBoughtGone.length+" productos recientes":"Nada claro que revisar"}</h3>
    <div>{recentBoughtGone.map(p=><span key={p.id}><b>{productIcon(p.name,p.category)} {p.name}</b><em>{new Date(p.date+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</em></span>)}</div>
    <p>No significa necesariamente que se haya comido: puede haberse tirado, regalado o estar mal registrado. HomeOS solo indica que ya no consta disponible.</p>
   </article>
  </div>

  <article className="habit-members">
   <div><small>PERSONAS DEL HOGAR</small><h3>Demanda estimada, sin obligar a registrar cada plato</h3><p>La app usa presencia y consumo habitual para ajustar compras y stock. No atribuye una comida concreta a una persona si nadie lo ha confirmado.</p></div>
   <div>{memberDemand.map(({m,label,requested})=><span key={m.id}><b>{m.name}</b><em>{label}</em><small>{presenceText(m.presence)} · {appetiteText(m.appetite)}{requested?" · "+requested+" compras atribuidas":""}{m.dislikes.trim()?" · evita "+m.dislikes:""}</small></span>)}</div>
  </article>
 </div>
}
function Comprar({state,setState,addFromRecipe,activeStore,setActiveStore,shoppingActive,setShoppingActive,finishShopping,receiptRef,setToast,deviceMemberId,setDeviceMemberId}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;addFromRecipe:(r:Recipe,plannedFor?:string)=>void;activeStore:string;setActiveStore:(s:string)=>void;shoppingActive:boolean;setShoppingActive:(b:boolean)=>void;finishShopping:(total?:number)=>void;receiptRef:React.RefObject<HTMLInputElement|null>;setToast:(s:string)=>void;deviceMemberId:string;setDeviceMemberId:(id:string)=>void}){
 const [quick,setQuick]=useState("");
 const [storeFilter,setStoreFilter]=useState("Todos");
 const [newStoreName,setNewStoreName]=useState("");
 const [addingStore,setAddingStore]=useState(false);
 const [purchaseTotal,setPurchaseTotal]=useState("");
 const [receiptName,setReceiptName]=useState("");
 const [shoppingListening,setShoppingListening]=useState(false);
 const [ocrStatus,setOcrStatus]=useState<"idle"|"reading"|"ready"|"error">("idle");
 const [ocrProgress,setOcrProgress]=useState(0);
 const [ocrItems,setOcrItems]=useState<ReceiptCandidate[]>([]);
 const [ocrTotal,setOcrTotal]=useState<number|undefined>(undefined);
 const receiptCameraRef=useRef<HTMLInputElement>(null);
 const members=state.members.slice(0,state.profile.householdSize);
 const currentMember=members.find(m=>m.id===deviceMemberId)||members[0];
 const requestedBy=currentMember?.name||"Tú";
 const estimatedTotal=state.shopping.filter(i=>i.status==="carrito").reduce((sum,item)=>{
  const canonical=norm(classifyProduct(item.name,item.category).canonical);
  const last=[...state.purchaseHistory].reverse().find(x=>typeof x.price==="number"&&x.qty>0&&norm(classifyProduct(x.name,x.category).canonical)===canonical);
  if(!last||typeof last.price!=="number")return sum;
  return sum+(last.price/Math.max(.01,last.qty))*item.qty;
 },0);
 const recommendedMissing=state.inventory.filter(i=>{
  if(i.storageMode==="reserva"||i.category==="Preparados")return false;
  if(state.shopping.some(q=>norm(q.name)===norm(i.name)&&q.status==="pendiente"))return false;
  return inventoryEstimate(state,i).prob<.32;
 }).slice(0,8);
 const pendingRecipePlans=state.recipePlans.filter(p=>p.status==="saved").map(p=>({...p,missing:missing(p.recipe,state.inventory)})).filter(p=>p.missing.length>0);
 const recipeShoppingItems=state.shopping.filter(i=>i.status==="pendiente"&&Boolean(i.recipePlanIds?.length||i.recipePlanId)).length;


 function addOne(rawInput:string){
  let value=normalizeSpokenShoppingText(rawInput.trim());if(!value)return;
  let supermarket:string|undefined;
  const lower=norm(value);
  for(const s of state.profile.supermarkets){
   if(s!=="Otro supermercado"&&lower.includes(norm(s))){
    supermarket=s;value=value.replace(new RegExp(s,"i"),"").trim();break;
   }
  }
  let qty=1,unit=inferUnit(value);
  const m=value.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|gramos?|l|litros?|ml|mililitros?|uds?|unidades?|rollos?|packs?|paquetes?|bricks?)/i);
  if(m){
   qty=Number(m[1].replace(",","."))||1;
   const raw=m[2].toLowerCase();
   unit=raw==="l"||raw.startsWith("litro")?"L":raw==="kg"||raw.startsWith("kilo")?"kg":raw==="g"||raw.startsWith("gramo")?"g":raw==="ml"||raw.startsWith("mililitro")?"ml":raw.startsWith("ud")||raw.startsWith("unidad")?"uds":raw.startsWith("rollo")?"rollos":raw.startsWith("brick")?"bricks":raw.startsWith("pack")||raw.startsWith("paquete")?"pack":raw;
   value=value.replace(m[0]," ").replace(/\s+/g," ").trim();
  }
  value=value.replace(/^de\s+/i,"").trim();
  if(!value)return;
  const productProfile=classifyProduct(value);
  const name=value;
  setState(s=>{
   const duplicate=s.shopping.find(i=>norm(i.name)===norm(name)&&i.supermarket===supermarket&&i.status==="pendiente");
   if(duplicate)return {...s,shopping:s.shopping.map(i=>i.id===duplicate.id?{...i,qty:Math.round((i.qty+qty)*100)/100}:i)};
   return {...s,shopping:[...s.shopping,{id:crypto.randomUUID(),name:name.charAt(0).toUpperCase()+name.slice(1),qty,unit,category:productProfile.category,subcategory:productProfile.subcategory,supermarket,requestedBy,reason:"persona",status:"pendiente"}]};
  });
 }
 function add(input=quick){
  const entries=splitShoppingEntries(input);
  if(!entries.length)return;
  entries.forEach(addOne);
  setQuick("");
  setToast(entries.length===1?entries[0]+" añadido":entries.length+" productos añadidos");
 } function startShoppingVoice(){
  const W=(window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if(!W){setToast("El reconocimiento de voz no está disponible en este navegador");return}
  const recognition=new W();
  recognition.lang="es-ES";recognition.interimResults=false;recognition.maxAlternatives=1;
  setShoppingListening(true);
  recognition.onresult=(e:any)=>{
   const text=e.results?.[0]?.[0]?.transcript||"";
   if(text)add(text);
  };
  recognition.onerror=()=>setToast("No he podido entender la voz");
  recognition.onend=()=>setShoppingListening(false);
  recognition.start();
 }
 async function ticketSelected(file?:File){
  if(!file)return;
  setReceiptName(file.name||"Foto del ticket");
  setOcrItems([]);setOcrTotal(undefined);setOcrProgress(0);
  if(!file.type.startsWith("image/")){
   setOcrStatus("idle");
   setToast("PDF seleccionado · el OCR local funciona con fotos; introduce el total manualmente");
   return;
  }
  setOcrStatus("reading");
  setToast("Leyendo el ticket en este dispositivo…");
  try{
   const parsed=await readReceiptImage(file,setOcrProgress);
   setOcrItems(parsed.items);setOcrTotal(parsed.total);setOcrStatus("ready");
   if(typeof parsed.total==="number")setPurchaseTotal(parsed.total.toFixed(2).replace(".",","));
   setToast(parsed.items.length?parsed.items.length+" líneas detectadas en el ticket":"Ticket leído · revisa el total");
  }catch{
   setOcrStatus("error");
   setToast("No he podido leer bien este ticket · puedes continuar manualmente");
  }
 }
 function applyOcrItems(){
  if(!ocrItems.length){setToast("No hay productos detectados para añadir");return}
  setState(s=>{
   let shopping=[...s.shopping];
   for(const item of ocrItems){
    const p=classifyProduct(item.name);
    const existing=shopping.findIndex(x=>norm(classifyProduct(x.name,x.category).canonical)===norm(p.canonical)&&p.category!=="Por clasificar");
    if(existing>=0){
     shopping[existing]={...shopping[existing],qty:Math.max(shopping[existing].qty,item.qty),price:item.price??shopping[existing].price,status:shoppingActive?"carrito":shopping[existing].status,supermarket:activeStore||shopping[existing].supermarket};
    }else{
     shopping.push({id:crypto.randomUUID(),name:item.name,qty:item.qty||1,unit:inferUnit(item.name),category:p.category,subcategory:p.subcategory,supermarket:activeStore||undefined,requestedBy:"Ticket",reason:"persona",status:shoppingActive?"carrito":"pendiente",price:item.price});
    }
   }
   return {...s,shopping};
  });
  setToast(ocrItems.length+" productos añadidos desde el ticket");
 }
 function moveHere(id:string){setState(s=>({...s,shopping:s.shopping.map(i=>i.id===id?{...i,supermarket:activeStore,status:"pendiente"}:i)}))}
 function cart(id:string){setState(s=>({...s,shopping:s.shopping.map(i=>i.id===id?{...i,status:i.status==="carrito"?"pendiente":"carrito"}:i)}))}
 function toggleReserve(id:string){setState(s=>({...s,shopping:s.shopping.map(i=>i.id===id?{...i,reserve:!i.reserve}:i)}));setToast("Reserva actualizada")}
 function addSupermarket(selectNow=false){
  const name=newStoreName.trim().replace(/\s+/g," ");
  if(!name)return;
  const exists=state.profile.supermarkets.find(x=>norm(x)===norm(name));
  const finalName=exists||name;
  setState(s=>s.profile.supermarkets.some(x=>norm(x)===norm(finalName))?s:{...s,profile:{...s.profile,supermarkets:[...s.profile.supermarkets,finalName],mainSupermarket:s.profile.mainSupermarket||finalName}});
  setNewStoreName("");
  setAddingStore(false);
  if(selectNow)setActiveStore(finalName);else setStoreFilter(finalName);
  setToast(exists?finalName+" ya estaba guardado":finalName+" añadido a supermercados");
 }
 function addRecommendedMissing(){
  if(!recommendedMissing.length){setToast("No hay faltas claras ahora mismo");return}
  setState(s=>({...s,shopping:[...s.shopping,...recommendedMissing.map(i=>{
   const canonical=norm(classifyProduct(i.name,i.category).canonical);
   const last=[...s.purchaseHistory].reverse().find(p=>norm(classifyProduct(p.name,p.category).canonical)===canonical);
   return {id:crypto.randomUUID(),name:i.name,qty:last?.qty||1,unit:last?.unit||i.unit,category:i.category,subcategory:i.subcategory,requestedBy:"HomeOS",reason:"recomienda" as const,status:"pendiente" as const};
  })]}));
  setToast(recommendedMissing.length+" sugerencias añadidas");
 }
 function changeShoppingQty(id:string,delta:number){
  setState(s=>({...s,shopping:s.shopping.map(i=>i.id===id?{...i,qty:Math.max(0.1,Math.round((i.qty+delta)*100)/100)}:i)}));
 }
 function removeShopping(id:string){
  setState(s=>({...s,shopping:s.shopping.filter(i=>i.id!==id)}));
  setToast("Producto eliminado de la lista");
 }
 function shoppingRecipeContext(i:ShoppingItem){
  const ids=[...(i.recipePlanIds||[]),...(i.recipePlanId?[i.recipePlanId]:[])];
  const titles=[...new Set(ids.map(id=>state.recipePlans.find(p=>p.id===id)?.recipe.title).filter(Boolean) as string[])];
  if(!titles.length)return "";
  if(titles.length===1)return "Para "+titles[0];
  return "Para "+titles.length+" recetas";
 }
 function shoppingRecipeDue(i:ShoppingItem){
  const ids=[...(i.recipePlanIds||[]),...(i.recipePlanId?[i.recipePlanId]:[])];
  return ids.map(id=>state.recipePlans.find(p=>p.id===id)?.plannedFor||"9999-12-31").sort()[0]||"9999-12-31";
 }
 const filteredList=state.shopping.filter(i=>storeFilter==="Todos"||i.supermarket===storeFilter||(!i.supermarket&&storeFilter==="Cualquiera"));
 const mainItems=(shoppingActive&&activeStore?state.shopping.filter(i=>(!i.supermarket||i.supermarket===activeStore)):filteredList).slice().sort((a,b)=>Number(Boolean(b.recipePlanIds?.length||b.recipePlanId))-Number(Boolean(a.recipePlanIds?.length||a.recipePlanId))||shoppingRecipeDue(a).localeCompare(shoppingRecipeDue(b)));
 const grouped=mainItems.reduce<Record<string,ShoppingItem[]>>((a,i)=>{(a[i.category]??=[]).push(i);return a},{});
 const other=shoppingActive&&activeStore?state.shopping.filter(i=>i.supermarket&&i.supermarket!==activeStore&&i.status==="pendiente"):[];
 return <section className="stack">
  <div className="shopping-top"><div><span className="eyebrow">LISTA DE COMPRA</span><h2>{shoppingActive?(activeStore?"Comprando en "+activeStore:"¿Dónde estás comprando?"):"Lo que falta en casa"}</h2><p>Añade productos y HomeOS los organiza por tienda y categoría.</p></div>{shoppingActive?<div className="shopping-session-actions"><button className="secondary" onClick={()=>{setState(s=>({...s,shopping:s.shopping.map(i=>i.status==="carrito"?{...i,status:"pendiente"}:i)}));setShoppingActive(false);setActiveStore("");setPurchaseTotal("");setReceiptName("")}}>Salir</button><button className="primary" disabled={!activeStore||(state.profile.financeMode==="preciso"&&!purchaseTotal.trim())} onClick={()=>{const n=Number(purchaseTotal.replace(",","."));const manual=purchaseTotal.trim()&&Number.isFinite(n)?n:undefined;const total=manual??(state.profile.financeMode==="orientativo"&&estimatedTotal>0?estimatedTotal:undefined);finishShopping(total);setPurchaseTotal("");setReceiptName("")}}>Terminar compra</button></div>:<button className="primary shopping-start" onClick={()=>setShoppingActive(true)}><span>Empezar compra</span><small>Elige dónde compras y marca lo que vas cogiendo</small></button>}</div>

  {pendingRecipePlans.length>0&&<article className="shopping-recipe-memory"><span>🍳</span><div><small>RECETAS GUARDADAS</small><strong>{pendingRecipePlans.length} receta{pendingRecipePlans.length===1?"":"s"} esperando ingredientes</strong><p>{recipeShoppingItems?recipeShoppingItems+" productos ya están vinculados a esas recetas.":"Puedes añadir los faltantes sin volver a buscar las recetas."}</p></div><button onClick={()=>pendingRecipePlans.forEach(p=>addFromRecipe(p.recipe,p.plannedFor))}>Añadir faltantes</button></article>}
  {!shoppingActive?<div className="quick-add smart"><input value={quick} onChange={e=>setQuick(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} enterKeyHint="done" placeholder="Ej. leche, 2 yogures y 1 kg de pollo…"/><button className={shoppingListening?"meal-mic listening":"meal-mic"} onClick={startShoppingVoice} aria-label="Añadir por voz">{shoppingListening?"…":micIcon()}</button><span className="device-member-pill" title="Este dispositivo añade productos a nombre de esta persona">👤 {requestedBy}</span><button onClick={()=>add()}>Añadir</button></div>:<div className="store-picker"><span>Estoy en</span><button className={activeStore==="Compra general"?"active":""} onClick={()=>setActiveStore("Compra general")}>Compra general</button>{state.profile.supermarkets.map(s=><button key={s} className={activeStore===s?"active":""} onClick={()=>setActiveStore(s)}>{s}</button>)}<button className="add-store-button" onClick={()=>setAddingStore(true)}>＋ Añadir supermercado</button></div>}

  {!shoppingActive&&<div className="store-tabs"><button className={storeFilter==="Todos"?"active":""} onClick={()=>setStoreFilter("Todos")}>Todos</button>{state.profile.supermarkets.map(s=><button className={storeFilter===s?"active":""} key={s} onClick={()=>setStoreFilter(s)}>{s}</button>)}<button className={storeFilter==="Cualquiera"?"active":""} onClick={()=>setStoreFilter("Cualquiera")}>Cualquiera</button><button className="add-store-button" onClick={()=>setAddingStore(true)}>＋ Supermercado</button></div>}
  {shoppingActive&&!activeStore&&<article className="empty-state"><h3>Elige la tienda</h3><p>La lista se reorganizará para que veas primero lo que puedes comprar ahí.</p></article>}
  {addingStore&&<div className="inline-store-add"><div><strong>Añadir supermercado</strong><small>Se guardará para futuras compras.</small></div><input autoFocus value={newStoreName} onChange={e=>setNewStoreName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addSupermarket(shoppingActive);if(e.key==="Escape"){setAddingStore(false);setNewStoreName("")}}} placeholder="Ej. BonÀrea, Ametller, tienda del barrio…"/><button className="primary" onClick={()=>addSupermarket(shoppingActive)} disabled={!newStoreName.trim()}>Guardar</button><button className="secondary" onClick={()=>{setAddingStore(false);setNewStoreName("")}}>Cancelar</button></div>}

  {(!shoppingActive||activeStore)&&<div className="shopping-layout"><div className="category-list">{Object.keys(grouped).length===0&&<article className="friendly-empty"><span>✓</span><h3>Todo al día</h3><p>No hay productos en esta vista.</p></article>}{Object.entries(grouped).map(([cat,items])=><article className="list-card shopping-category" key={cat}><div className="list-title"><h3><span>{CATEGORY_ICONS[cat]||"🛍️"}</span>{CATEGORY_LABELS[cat]||cat}</h3><span>{items.length}</span></div><div className="shopping-card-grid">{items.map(i=><div className={i.status==="carrito"?"shop-visual-card checked":"shop-visual-card"} key={i.id}><button className="product-pictogram" onClick={()=>cart(i.id)} aria-label={i.status==="carrito"?"Quitar del carrito":"Añadir al carrito"}>{i.status==="carrito"?"✓":productIcon(i.name,i.category)}</button><div className="shop-visual-copy"><strong>{i.name}</strong><span>{i.qty} {i.unit}</span><small>{shoppingRecipeContext(i)|| (i.reason==="recomienda"?"HomeOS recomienda":i.reason==="receta"?(i.requestedBy||"Para una receta"):i.requestedBy)}</small></div>{i.supermarket&&<em>{i.supermarket}</em>}<div className="shop-inline-controls"><button onClick={(e)=>{e.stopPropagation();changeShoppingQty(i.id,-1)}} aria-label="Restar cantidad">−</button><b>{i.qty}</b><button onClick={(e)=>{e.stopPropagation();changeShoppingQty(i.id,1)}} aria-label="Sumar cantidad">+</button><button className="remove" onClick={(e)=>{e.stopPropagation();removeShopping(i.id)}} aria-label="Eliminar">×</button></div>{shoppingActive&&(Boolean(freezerQualityGuide(i.name,i.category,i.subcategory))||i.category==="Carne")&&<button className={i.reserve?"reserve-buy active":"reserve-buy"} onClick={(e)=>{e.stopPropagation();toggleReserve(i.id)}} title="Guardar como reserva en el congelador">{i.reserve?"❄ Reserva":"＋ Reserva"}</button>}</div>)}</div></article>)}</div>

   <aside className="purchase-tools">
    <div className="ticket-actions">
     <button className="tool-action ticket-camera" onClick={()=>receiptCameraRef.current?.click()}><span>📷</span><div><strong>Hacer foto del ticket</strong><p>Abre la cámara directamente.</p></div></button>
     <button className="tool-action" onClick={()=>receiptRef.current?.click()}><span>🧾</span><div><strong>Elegir ticket</strong><p>{receiptName?"Seleccionado: "+receiptName:"Foto o PDF desde el dispositivo."}</p></div></button>
    </div>
    {ocrStatus==="reading"&&<div className="local-ocr-card"><div className="local-ocr-head"><span>⌁</span><div><strong>Leyendo ticket en el móvil</strong><small>Procesamiento local · sin API de pago</small></div><b>{ocrProgress}%</b></div><div className="local-ocr-progress"><span style={{width:ocrProgress+"%"}}/></div></div>}
    {ocrStatus==="ready"&&<div className="local-ocr-card ready"><div className="local-ocr-head"><span>✓</span><div><strong>{ocrItems.length} productos detectados</strong><small>{typeof ocrTotal==="number"?"Total detectado: "+ocrTotal.toFixed(2)+" €":"Revisa el total antes de terminar"}</small></div></div>{ocrItems.length>0&&<div className="ocr-preview">{ocrItems.slice(0,6).map((x,idx)=><span key={idx}>{x.name}{typeof x.price==="number"?" · "+x.price.toFixed(2)+" €":""}</span>)}{ocrItems.length>6&&<small>+{ocrItems.length-6} más</small>}</div>}<button onClick={applyOcrItems} disabled={!ocrItems.length}>Usar productos detectados</button><p>La foto se procesa en tu dispositivo. HomeOS no la envía a una IA de pago.</p></div>}
    {ocrStatus==="error"&&<div className="local-ocr-card error"><strong>No se pudo leer con suficiente claridad</strong><p>Haz otra foto más recta y con buena luz, o continúa con la lista y el total manual.</p></div>}
    <input ref={receiptCameraRef} hidden type="file" accept="image/*" capture="environment" onChange={e=>ticketSelected(e.target.files?.[0])}/>
    <input ref={receiptRef} hidden type="file" accept="image/*,.pdf" onChange={e=>ticketSelected(e.target.files?.[0])}/>
    {shoppingActive&&<label className="purchase-total"><span>Total de la compra <small>{state.profile.financeMode==="preciso"?"obligatorio en modo preciso":"opcional"}</small></span><div><input inputMode="decimal" value={purchaseTotal} onChange={e=>setPurchaseTotal(e.target.value)} placeholder={estimatedTotal>0?"≈ "+estimatedTotal.toFixed(2):"0,00"}/><b>€</b></div>{state.profile.financeMode==="orientativo"&&estimatedTotal>0&&<small>Si lo dejas vacío, HomeOS usará ≈ {estimatedTotal.toFixed(2)} € con los precios que ya conoce.</small>}</label>}
    <article className="tool-card smart-restock"><span>✦</span><div><strong>Reposición sugerida</strong><p>{recommendedMissing.length?recommendedMissing.length+" productos parecen faltar por vuestro ritmo de consumo.":"No hay faltas claras que añadir ahora."}</p>{recommendedMissing.length>0&&<button onClick={addRecommendedMissing}>Añadir sugeridos</button>}</div></article>
   </aside>
  </div>}

  {shoppingActive&&activeStore&&other.length>0&&<article className="other-stores"><div><small>PENDIENTE EN OTRAS TIENDAS</small><h3>También tenías esto apuntado</h3></div>{other.map(i=><div key={i.id}><span><strong>{i.name}</strong><small>{i.supermarket}</small></span><button onClick={()=>moveHere(i.id)}>Traer aquí</button></div>)}</article>}
 </section>
}

function Casa({state,setState,setToast,focus,clearFocus,openRecipes}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;setToast:(s:string)=>void;focus:"all"|"expiring"|"prepared"|"reserve";clearFocus:()=>void;openRecipes:(name:string)=>void}){
 const [loc,setLoc]=useState("Todo"),[cat,setCat]=useState("Todos");
 const [density,setDensity]=useState<"compact"|"detail">("compact");
 const [preparedOpen,setPreparedOpen]=useState(false);
 const [preparedName,setPreparedName]=useState("");
 const [voiceDraft,setVoiceDraft]=useState("");
 const [voiceListening,setVoiceListening]=useState(false);
 const [preparedServings,setPreparedServings]=useState(1);
 const [preparedLocation,setPreparedLocation]=useState<"Nevera"|"Congelador">("Nevera");
 useEffect(()=>{if(focus!=="all"){setLoc(focus==="reserve"?"Congelador":"Todo");setCat(focus==="prepared"?"Preparados":"Todos")}},[focus]);
 const locationMatch=(i:InventoryItem)=>loc==="Todo"||(loc==="Revisar"?i.location==="Sin ubicar":loc==="Despensa"?(i.location==="Despensa"||i.location==="Suplementos"):i.location===loc);
 const shown=state.inventory.filter(i=>locationMatch(i)&&(cat==="Todos"||i.category===cat)&&(focus==="expiring"?daysUntil(i.expires)<=3&&i.stock!=="falta":focus==="prepared"?i.category==="Preparados"&&i.stock!=="falta":focus==="reserve"?i.storageMode==="reserva":true));

 function setStock(id:string,stock:StockState){setState(s=>({...s,inventory:s.inventory.map(i=>i.id===id?{...i,stock,qty:stock==="falta"?0:i.qty}:i)}))}
 function confirmStillHere(id:string){
  const today=new Date().toISOString().slice(0,10);
  setState(s=>({...s,inventory:s.inventory.map(i=>i.id===id?{...i,stock:"hay",lastConfirmedAt:today,qty:i.qty<=0?1:i.qty}:i)}));
  setToast("Confirmado · HomeOS ajustará la estimación");
 }
 function discardProduct(i:InventoryItem){
  const loss=typeof i.price==="number"?Math.max(0,i.price):0;
  setState(s=>({...s,waste:s.waste+loss,inventory:s.inventory.map(x=>x.id===i.id?{...x,stock:"falta",qty:0}:x)}));
  setToast(loss>0?"Desperdicio registrado · "+loss.toFixed(2)+" €":"Marcado como tirado");
 }
 function eatPrepared(i:InventoryItem){
  const today=new Date().toISOString().slice(0,10);
  setState(s=>{
   const current=s.inventory.find(x=>x.id===i.id);if(!current||current.stock==="falta")return s;
   const nextQty=Math.max(0,(current.servings||current.qty||1)-1);
   const ingredients=current.preparedIngredients?.length?current.preparedIngredients:[{name:current.name,key:current.name,category:inferCategory(current.name)}];
   const meal:MealRecord={id:crypto.randomUUID(),date:today,recipeId:current.preparedRecipeId||current.id,title:current.name,servings:1,ingredients};
   return {...s,mealHistory:[...s.mealHistory,meal].slice(-400),inventory:s.inventory.map(x=>x.id===current.id?{...x,qty:nextQty,servings:nextQty,stock:nextQty<=0?"falta":x.stock}:x)};
  });
  setToast("1 ración consumida · Casa y hábitos actualizados");
 }
 function freeze(id:string){
  const frozenAt=new Date().toISOString().slice(0,10);
  setState(s=>{
   const item=s.inventory.find(i=>i.id===id);
   if(!item)return s;
   const key=classifyProduct(item.name,item.category).canonical;
   const guide=freezerQualityGuide(item.name,item.category,item.subcategory);
   const qualityReviewAt=guide?addMonthsIso(frozenAt,guide.minMonths):undefined;
   return {...s,
    productPreferences:{...s.productPreferences,[key]:{...(s.productPreferences[key]||{}),location:"Congelador"}},
    inventory:s.inventory.map(i=>i.id===id?{...i,location:"Congelador",frozenAt,qualityReviewAt,originalExpires:i.originalExpires||i.expires,expires:undefined,dateType:undefined}:i)
   };
  });
  setToast("Guardado en congelador · HomeOS lo recordará");
 }
 function addToBuy(i:InventoryItem){if(state.shopping.some(q=>norm(q.name)===norm(i.name)&&q.status==="pendiente")){setToast("Ya estaba en la lista de compra");return}setState(s=>({...s,shopping:[...s.shopping,{id:crypto.randomUUID(),name:i.name,qty:1,unit:i.unit,category:i.category,subcategory:i.subcategory,requestedBy:"Casa",reason:"recomienda",status:"pendiente"}]}));setToast("Añadido a la compra")}
 function moveProduct(i:InventoryItem,next:Location){
  if(!canStoreAt(i.name,i.category,next)){setToast(storageWarning(i.name,i.category,next));return}
  if(next==="Congelador"){freeze(i.id);return}
  const profile=classifyProduct(i.name,i.category);
  setState(s=>({...s,
   productPreferences:{...s.productPreferences,[profile.canonical]:{...(s.productPreferences[profile.canonical]||{}),location:next}},
   inventory:s.inventory.map(x=>x.id===i.id?{...x,location:next,frozenAt:undefined,stock:x.location==="Congelador"?"incierto":x.stock}:x)
  }));
  setToast("Ubicación aprendida para futuras compras");
 }
 function setStorageMode(i:InventoryItem,mode:"normal"|"reserva"){
  setState(s=>({...s,inventory:s.inventory.map(x=>x.id===i.id?{...x,storageMode:mode,reservedFor:mode==="normal"?undefined:x.reservedFor}:x)}));
  setToast(mode==="reserva"?"Marcado como reserva · no se tratará como consumo habitual":"Vuelve a rotación normal");
 }
 function setReservedFor(i:InventoryItem,eventId:string){
  setState(s=>({...s,inventory:s.inventory.map(x=>x.id===i.id?{...x,reservedFor:eventId||undefined}:x)}));
  setToast(eventId?"Reserva vinculada al evento":"Reserva sin evento concreto");
 }

 function parsePreparedVoice(text:string){
  const spoken=normalizeSpokenShoppingText(text);
  const t=norm(spoken);
  const rMatch=t.match(/(\d+)\s*(raciones|tuppers|tuperes|tuppers?)/);
  const servings=rMatch?Math.max(1,Number(rMatch[1])):1;
  const location=t.includes("congela")?"Congelador":"Nevera";
  let name=spoken
    .replace(/he preparado/ig,"").replace(/han sobrado/ig,"").replace(/sobraron/ig,"")
    .replace(/guardo/ig,"").replace(/dejo/ig,"").replace(/congelo/ig,"")
    .replace(/\d+\s*(raciones|tuppers?|tuperes)/ig,"")
    .replace(/en la nevera/ig,"").replace(/en el congelador/ig,"").replace(/al congelador/ig,"").trim();
  if(!name) name="Comida preparada";
  setPreparedName(name.charAt(0).toUpperCase()+name.slice(1));
  setPreparedServings(servings);setPreparedLocation(location);
 }
 function startPreparedVoice(){
  const W=(window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if(!W){setToast("El reconocimiento de voz no está disponible en este navegador");return}
  const recognition=new W();
  recognition.lang="es-ES";recognition.interimResults=false;recognition.maxAlternatives=1;
  setVoiceListening(true);
  recognition.onresult=(e:any)=>{const text=e.results?.[0]?.[0]?.transcript||"";setVoiceDraft(text);parsePreparedVoice(text)};
  recognition.onerror=()=>setToast("No he podido entender la voz");
  recognition.onend=()=>setVoiceListening(false);
  recognition.start();
 }
 function savePrepared(){
  const name=preparedName.trim();if(!name)return;
  const preparedAt=new Date().toISOString().slice(0,10);
  const detected=detectProductsInText(name).map(p=>({name:p.canonical,key:p.canonical,category:p.category}));
  const item:InventoryItem={id:crypto.randomUUID(),name,qty:preparedServings,unit:"raciones",location:preparedLocation,category:"Preparados",stock:"hay",purchasedAt:preparedAt,preparedAt,servings:preparedServings,source:"sobras",preparedIngredients:detected};
  setState(s=>({...s,inventory:[item,...s.inventory]}));
  setPreparedName("");setPreparedServings(1);setPreparedLocation("Nevera");setVoiceDraft("");setPreparedOpen(false);setToast("Preparado guardado");
 }

 return <section className="stack">
  <div className="page-intro"><div><span className="eyebrow">CASA</span><h2>Encuentra rápido lo que tienes</h2><p>Primero eliges dónde está; después, si quieres, filtras por tipo de producto.</p></div><div className="photo-actions"><button className="prepared-button" onClick={()=>setPreparedOpen(true)}>🍱 Añadir preparado</button></div></div>

  {focus!=="all"&&<div className={"inventory-focus "+focus}><div><span>{focus==="expiring"?"⏳":focus==="reserve"?"❄️":"🍱"}</span><div><small>VISTA RÁPIDA</small><strong>{focus==="expiring"?"Productos que caducan pronto":focus==="reserve"?"Reservas del congelador":"Comida preparada"}</strong><p>{focus==="expiring"?"Solo mostramos productos con fecha próxima para que puedas decidir qué gastar primero.":focus==="reserve"?"Productos guardados a largo plazo. Los avisos son de revisión y calidad, no borrados automáticos.":"Solo mostramos raciones y preparados listos."}</p></div></div><button onClick={clearFocus}>Ver todo</button></div>}
  <div className="inventory-toolbar">
   <div className="inventory-filter-block"><small>DÓNDE ESTÁ</small><div className="visual-filter-row">{LOCATIONS.map(x=><button key={x} className={loc===x?"active":""} onClick={()=>setLoc(x)}><span>{LOCATION_ICONS[x]}</span><b>{x}</b></button>)}</div></div>
   <div className="inventory-filter-block"><small>QUÉ ES</small><div className="visual-filter-row categories">{CATEGORIES.map(x=><button key={x} className={cat===x?"active":""} onClick={()=>setCat(x)}><span>{CATEGORY_ICONS[x]||"🛍️"}</span><b>{CATEGORY_LABELS[x]||x}</b></button>)}</div></div>
   <div className="inventory-density"><small>VISTA</small><div><button className={density==="compact"?"active":""} onClick={()=>setDensity("compact")}>▦ Compacta</button><button className={density==="detail"?"active":""} onClick={()=>setDensity("detail")}>☰ Detalle</button></div></div>
  </div>

  <div className={"inventory-grid "+density}>{shown.length===0&&<article className="friendly-empty inventory-empty"><span>⌂</span><h3>No hay productos aquí</h3><p>Prueba otro filtro o registra una compra.</p></article>}{shown.map(i=>{
   const displayLocation=i.location==="Suplementos"?"Despensa":i.location==="Sin ubicar"?"Revisar":i.location;
   const estimate=inventoryEstimate(state,i);
   return <article className="inventory-card" key={i.id}>
    <div className="inventory-top"><span className="inventory-product-icon">{productIcon(i.name,i.category)}</span><span className={"stock-badge "+estimate.tone} title={estimate.basis}>{estimate.label}</span></div>
    <div className="inventory-name-row"><h3>{i.name}</h3><span className="location-mini">{LOCATION_ICONS[displayLocation]||"▦"} {displayLocation}</span></div>
    <p className="inventory-qty">{i.stock==="incierto"?"Cantidad por revisar":String(i.qty)+" "+i.unit}{density==="detail"&&<small className="estimate-basis">{estimate.basis}</small>}</p>
    <div className="inventory-badges"><span className={"rotation-badge "+rotationBand(i.name,i.category,i.location).key}>{rotationBand(i.name,i.category,i.location).label.replace("Rotación ","")}</span>{i.expires&&<small className={i.dateType==="caducidad"?"date-alert expiry":"date-alert"}>{i.dateType==="caducidad"?"Caduca ":"Consumo pref. "}{new Date(i.expires+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</small>}{!i.expires&&i.estimatedExpires&&<small className="date-alert estimate" title={i.estimateBasis}>≈ {i.estimatedDateType==="caducidad"?"Caducidad":"Consumo pref."} {new Date(i.estimatedExpires+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})} · revisa envase</small>}{i.frozenAt&&<small className="date-alert">Congelado {new Date(i.frozenAt+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</small>}{i.storageMode==="reserva"&&<small className="date-alert reserve">Reserva</small>}{i.qualityReviewAt&&<small className="date-alert quality">Revisar calidad desde {new Date(i.qualityReviewAt+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</small>}</div>
    {i.category==="Preparados"&&<div className="prepared-meta"><span>🍱 {i.source==="mealprep"?"Meal prep":i.source==="receta"?"Receta":"Sobras / tupper"}</span>{i.preparedAt&&<span>Hecho {new Date(i.preparedAt+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</span>}</div>}
    <div className="inventory-actions">{i.stock!=="falta"&&<button className="action-out" onClick={()=>setStock(i.id,"falta")}><span>🔴</span> Se acabó</button>}{i.stock!=="falta"&&<button className="action-low" onClick={()=>setStock(i.id,"poco")}><span>🟡</span> Queda poco</button>}{estimate.tone==="incierto"&&i.stock!=="falta"&&<button className="action-confirm" onClick={()=>confirmStillHere(i.id)}>✓ Sigue aquí</button>}{i.location==="Nevera"&&i.dateType==="caducidad"&&<button className="action-freeze" onClick={()=>freeze(i.id)}>🧊 Congelar</button>}{i.stock==="falta"&&<button className="action-buy" onClick={()=>addToBuy(i)}>🛒 Comprar</button>}{i.category==="Preparados"&&i.stock!=="falta"&&<button className="action-eat" onClick={()=>eatPrepared(i)}>🍽 Comer 1</button>}{i.stock!=="falta"&&<button className="recipe-from-product" onClick={()=>openRecipes(i.name)}>🍴 Hacer receta</button>}{density==="detail"&&i.stock!=="falta"&&<button className="discard-product" onClick={()=>discardProduct(i)}>Tirar</button>}</div>{density==="detail"&&<div className="learn-location"><label><span>Guardar este producto en</span><select value={i.location} onChange={e=>moveProduct(i,e.target.value as Location)}><option value="Nevera">Nevera</option><option value="Congelador">Congelador</option><option value="Despensa">Despensa</option>{i.category==="Suplementos"&&<option value="Suplementos">Suplementos</option>}</select></label>{i.location==="Congelador"&&<><label><span>Uso previsto</span><select value={i.storageMode||"normal"} onChange={e=>setStorageMode(i,e.target.value as "normal"|"reserva")}><option value="normal">Uso normal</option><option value="reserva">Reserva / largo plazo</option></select></label>{i.storageMode==="reserva"&&state.events.filter(e=>e.date>=new Date().toISOString().slice(0,10)).length>0&&<label><span>Reservado para</span><select value={i.reservedFor||""} onChange={e=>setReservedFor(i,e.target.value)}><option value="">Sin evento concreto</option>{state.events.filter(e=>e.date>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date)).map(e=><option key={e.id} value={e.id}>{new Date(e.date+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})} · {e.title}</option>)}</select></label>}</>}<small>HomeOS aprende vuestra forma de guardar productos, pero mantiene separadas las reglas de conservación y los avisos de calidad.</small></div>}
   </article>
  })}</div>

  {preparedOpen&&<div className="modal-backdrop" onMouseDown={()=>setPreparedOpen(false)}><div className="modal prepared-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">PREPARADOS</span><h2>Guardar comida ya hecha</h2><p>Sobras, tuppers y meal prep en un único sitio.</p></div><button onClick={()=>setPreparedOpen(false)}>×</button></div><div className="voice-prepared-box"><button className={voiceListening?"voice-main listening":"voice-main"} onClick={startPreparedVoice}>{voiceListening?"Escuchando…":<>{micIcon()}<span>Añadir por voz</span></>}</button><span>Ej.: “Han sobrado 3 raciones de pollo con arroz y van a la nevera”.</span>{voiceDraft&&<small>Entendido: “{voiceDraft}”</small>}</div><div className="prepared-divider"><span>o manualmente</span></div><div className="prepared-form"><label><span>¿Qué es?</span><input autoFocus value={preparedName} onChange={e=>setPreparedName(e.target.value)} placeholder="Ej. pollo con arroz, lentejas…"/></label><label><span>Raciones aproximadas</span><div className="stepper"><button onClick={()=>setPreparedServings(n=>Math.max(1,n-1))}>−</button><b>{preparedServings}</b><button onClick={()=>setPreparedServings(n=>n+1)}>+</button></div></label><label><span>¿Dónde lo guardas?</span><div className="storage-choice"><button className={preparedLocation==="Nevera"?"active":""} onClick={()=>setPreparedLocation("Nevera")}>❄️ Nevera</button><button className={preparedLocation==="Congelador"?"active":""} onClick={()=>setPreparedLocation("Congelador")}>🧊 Congelador</button></div></label><div className="prepared-note">HomeOS lo tratará como comida lista y la priorizará. No inventaremos una fecha de seguridad si no tenemos datos suficientes.</div></div><button className="primary modal-save" disabled={!preparedName.trim()} onClick={savePrepared}>Guardar preparado</button></div></div>}
 </section>
}

function Finanzas({state,setState,available,monthlySpent}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;available:number;monthlySpent:number}){
 const [selectedCategory,setSelectedCategory]=useState<string|null>(null);
 const usedPct=Math.min(100,Math.round(monthlySpent/Math.max(1,state.budget)*100));
 const monthKey=new Date().toISOString().slice(0,7);
 const pricedHistory=state.purchaseHistory.filter(i=>i.date.startsWith(monthKey)&&typeof i.price==="number"&&(i.price||0)>0);
 const pricedInventory=state.inventory.filter(i=>typeof i.price==="number"&&(i.price||0)>0);
 function financeCategory(i:{category:string;subcategory?:string;location?:Location}){
  if(i.location==="Congelador"||i.category==="Congelados")return "Congelados";
  if(i.category==="Carne")return "Carne y pescado";
  if(i.category==="Fruta y verdura")return i.subcategory==="Fruta"?"Fruta":"Verdura";
  if(i.category==="Lácteos")return "Lácteos";
  if(i.category==="Bebidas")return "Bebidas";
  if(i.category==="Snacks y dulces")return "Snacks y dulces";
  if(i.category==="Higiene y cuidado")return "Higiene y cuidado";
  if(i.category==="Limpieza y hogar")return "Limpieza y hogar";
  if(i.category==="Preparados")return "Preparados";
  if(i.category==="Suplementos")return "Suplementos";
  if(i.category==="Despensa")return "Despensa";
  return "Otros";
 }
 const financeSource=pricedHistory.length?pricedHistory:pricedInventory;
 const byCat=financeSource.reduce<Record<string,number>>((a,i)=>{const k=financeCategory(i as any);a[k]=(a[k]||0)+(i.price||0);return a},{});
 const knownSpend=Object.values(byCat).reduce((a,b)=>a+b,0);
 const categoryOrder=["Carne y pescado","Verdura","Fruta","Lácteos","Congelados","Despensa","Bebidas","Snacks y dulces","Limpieza y hogar","Higiene y cuidado","Preparados","Suplementos","Otros"];
 const icons:Record<string,string>={"Carne y pescado":"🥩","Verdura":"🥬","Fruta":"🍎","Lácteos":"🥛","Congelados":"🧊","Despensa":"🥫","Bebidas":"🥤","Snacks y dulces":"🍪","Limpieza y hogar":"🧽","Higiene y cuidado":"🫧","Preparados":"🍱","Suplementos":"＋","Otros":"🛍️"};
 const rows=categoryOrder.map(k=>({name:k,value:byCat[k]||0,icon:icons[k]}));
 const selectedItems=selectedCategory?pricedHistory.filter(i=>financeCategory(i as any)===selectedCategory).slice().reverse().slice(0,12):[];
 const remaining=Math.max(0,available);
 const over=Math.max(0,-available);
 const modeText=state.profile.financeMode==="preciso"
  ?"Cada compra debe tener un total. Así el gasto mensual no depende de estimaciones."
  :"Si falta el total, HomeOS puede usar precios que ya conoce. Siempre se marca como aproximado.";

 return <section className="stack finance-page">
  <div className="page-intro finance-intro"><div><span className="eyebrow">FINANZAS DE CASA</span><h2>Cuánto has gastado y cuánto te queda</h2><p>El presupuesto es lo que quieres gastar este mes en alimentación y hogar. No lo llamamos ahorro: simplemente es dinero que todavía queda disponible.</p></div><div className="finance-mode-switch"><small>MODO DE CÁLCULO</small><div><button className={state.profile.financeMode==="orientativo"?"active":""} onClick={()=>setState(s=>({...s,profile:{...s.profile,financeMode:"orientativo"}}))}>≈ Orientativo</button><button className={state.profile.financeMode==="preciso"?"active":""} onClick={()=>setState(s=>({...s,profile:{...s.profile,financeMode:"preciso"}}))}>= Preciso</button></div><p>{modeText}</p></div></div>

  <article className="budget-overview">
   <div className="budget-head"><div><small>PRESUPUESTO DEL MES</small><strong>{state.budget.toFixed(0)} €</strong></div><label><span>Cambiar</span><div><input type="number" min="0" value={state.budget} onChange={e=>setState(s=>({...s,budget:Math.max(0,Number(e.target.value)||0)}))}/><b>€</b></div></label></div>
   <div className="budget-progress"><span style={{width:String(usedPct)+"%"}}/></div>
   <div className="budget-numbers">
    <div title="Total registrado en compras durante este mes"><small>GASTADO ⓘ</small><strong>{monthlySpent.toFixed(2)} €</strong></div>
    <div className={available>=0?"remaining":"remaining over"} title="Presupuesto mensual menos lo gastado"><small>{available>=0?"TE QUEDA ⓘ":"TE HAS PASADO ⓘ"}</small><strong>{available>=0?remaining.toFixed(2):over.toFixed(2)} €</strong></div>
    <div title="Porcentaje del presupuesto mensual ya utilizado"><small>PRESUPUESTO USADO ⓘ</small><strong>{usedPct}%</strong></div>
   </div>
  </article>

  <div className="finance-secondary">
   <article className="waste-card"><span>♻️</span><div><small>DESPERDICIO REGISTRADO</small><strong>{state.waste.toFixed(2)} €</strong><p>Solo cuenta productos que realmente has marcado como tirados o caducados.</p></div></article>
   <article className="finance-data-card"><span>🧾</span><div><small>GASTO CON CATEGORÍA CONOCIDA</small><strong>{knownSpend.toFixed(2)} €</strong><p>De {monthlySpent.toFixed(2)} € gastados este mes. El resto aún no tiene detalle por producto.</p></div></article>
  </div>

  <article className="category-spend-card">
   <div className="category-spend-head"><div><small>EN QUÉ SE VA EL DINERO</small><h3>Gasto por categoría</h3><p>Mostramos todas las categorías. Toca una con gasto para ver qué productos la forman.</p></div><strong>{knownSpend.toFixed(2)} € clasificados</strong></div>
   <div className="category-money-list">{rows.map((r,i)=>{const pct=knownSpend?Math.round(r.value/knownSpend*100):0;return <button className={"money-row "+(r.value?"has-data":"zero")+" "+(selectedCategory===r.name?"selected":"")} key={r.name} onClick={()=>r.value&&setSelectedCategory(selectedCategory===r.name?null:r.name)} disabled={!r.value}><span className="money-icon">{r.icon}</span><div><div className="money-row-top"><b>{r.name}</b><strong>{r.value.toFixed(2)} €</strong></div><div className="money-bar"><span className={"bar-"+((i%6)+1)} style={{width:String(pct)+"%"}}/></div><small>{r.value?pct+"% de lo clasificado":"Sin gasto registrado este mes"}</small></div></button>})}</div>
   {selectedCategory&&<div className="finance-category-detail"><div><small>DETALLE · {selectedCategory.toUpperCase()}</small><button onClick={()=>setSelectedCategory(null)}>Cerrar</button></div>{selectedItems.length?<div>{selectedItems.map(i=><span key={i.id}><b>{i.name}</b><em>{typeof i.price==="number"?i.price.toFixed(2)+" €":"—"}</em><small>{new Date(i.date+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}{i.supermarket?" · "+i.supermarket:""}</small></span>)}</div>:<p>Hay gasto clasificado, pero todavía no tenemos líneas de ticket suficientes para enseñar el detalle de productos.</p>}</div>}
  </article>

  <article className="finance-how">
   <div><small>QUÉ SIGNIFICA CADA DATO</small><h3>Un ejemplo sencillo</h3></div>
   <div className="finance-example"><span>Presupuesto <b>800 €</b></span><span>− Gastado <b>{monthlySpent.toFixed(2)} €</b></span><span>= Disponible <b>{available>=0?remaining.toFixed(2)+" €":"0 €"}</b></span></div>
   <p>El desperdicio se muestra aparte y no se resta otra vez del presupuesto porque ya forma parte de las compras realizadas.</p>
  </article>
 </section>
}

function ProfileModal({state,setState,close,syncCreds,syncStatus,connectHome,copyHomeCode,syncNow,deviceMemberId,setDeviceMemberId,setToast}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;close:()=>void;syncCreds:SyncCredentials|null;syncStatus:"local"|"connecting"|"synced"|"error";connectHome:(code:string)=>Promise<boolean>;copyHomeCode:()=>Promise<void>;syncNow:()=>Promise<void>;deviceMemberId:string;setDeviceMemberId:(id:string)=>void;setToast:(s:string)=>void}){
 const [draft,setDraft]=useState<AppState>(state);
 const [tab,setTab]=useState<"miembros"|"ajustes">("miembros");
 const [joinCode,setJoinCode]=useState("");
 const [joinError,setJoinError]=useState("");
 const [draftDeviceMemberId,setDraftDeviceMemberId]=useState(deviceMemberId);
 const members=draft.members.slice(0,draft.profile.householdSize);
 const dirty=JSON.stringify(draft)!==JSON.stringify(state)||draftDeviceMemberId!==deviceMemberId;

 async function joinOther(){setJoinError("");const ok=await connectHome(joinCode);if(ok)close();else setJoinError("No se ha podido conectar con ese hogar.");}
 function updateMember(id:string,patch:Partial<Member>){setDraft(s=>({...s,members:s.members.map(m=>m.id===id?{...m,...patch}:m)}))}
 function toggleTool(tool:string){setDraft(s=>({...s,profile:{...s.profile,kitchenTools:s.profile.kitchenTools.includes(tool)?s.profile.kitchenTools.filter(x=>x!==tool):[...s.profile.kitchenTools,tool]}}))}
 function save(){
  const validDevice=draft.members.slice(0,draft.profile.householdSize).some(m=>m.id===draftDeviceMemberId);
  setDeviceMemberId(validDevice?draftDeviceMemberId:(draft.members[0]?.id||""));
  setState({...draft});
  setToast("Hogar guardado");
  close();
 }
 function cancel(){close()}

 return <div className="modal-backdrop" onMouseDown={cancel}><div className="modal household-modal" onMouseDown={e=>e.stopPropagation()}>
  <div className="modal-head"><div><span className="eyebrow">MI HOGAR</span><h2>Cómo vive y come cada persona</h2><p>Estos datos ayudan a HomeOS a proponer mejor, estimar demanda y saber para quién se apunta una compra.</p></div><button type="button" aria-label="Cerrar" onClick={cancel}>×</button></div>

  <div className="profile-tabs"><button type="button" className={tab==="miembros"?"active":""} onClick={()=>setTab("miembros")}>Personas</button><button type="button" className={tab==="ajustes"?"active":""} onClick={()=>setTab("ajustes")}>Preferencias y cocina</button></div>

  <div className="household-scroll">
  {tab==="miembros"?<div className="member-profile-grid">{members.map((m,i)=><article className="member-profile-card" key={m.id}>
    <div className="member-title"><span>{m.name.slice(0,1).toUpperCase()||"?"}</span><div><input value={m.name} onChange={e=>updateMember(m.id,{name:e.target.value})}/><small>{m.relation||"Miembro "+(i+1)}</small></div></div>
    <label><span>Rutina</span><select value={m.presence} onChange={e=>updateMember(m.id,{presence:e.target.value as Member["presence"]})}><option value="casa">Suele comer en casa</option><option value="fuera_dia">Fuera durante el día</option><option value="fines_semana">Sobre todo fines de semana</option><option value="variable">Rutina variable</option></select></label>
    <label><span>Consumo habitual</span><select value={m.appetite} onChange={e=>updateMember(m.id,{appetite:e.target.value as Member["appetite"]})}><option value="poco">Come poco</option><option value="normal">Normal</option><option value="mucho">Come bastante</option></select></label>
    <label className="text-field"><span>No le gusta / evita</span><input value={m.dislikes} onChange={e=>updateMember(m.id,{dislikes:e.target.value})} placeholder="Ej. queso, frankfurt, hamburguesa…"/><small>Se usa para avisar y priorizar recetas que encajen mejor con esta persona.</small></label>
    <label className="text-field"><span>Nota útil</span><textarea value={m.notes} onChange={e=>updateMember(m.id,{notes:e.target.value})} placeholder="Ej. come fuera entre semana, suele llevar tupper…"/></label>
    <div className="member-summary"><b>{presenceText(m.presence)}</b><span>{appetiteText(m.appetite)}</span></div>
   </article>)}</div>:<div className="settings-list improved-settings">
    <label><span>Personas del hogar</span><select value={draft.profile.householdSize} onChange={e=>setDraft(s=>{const householdSize=Number(e.target.value);return {...s,profile:{...s.profile,householdSize},members:ensureMembers(s.members,householdSize)}})}>{[1,2,3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></label>
    {members.length>1&&<label><span>Identidad de este dispositivo</span><select value={members.some(m=>m.id===draftDeviceMemberId)?draftDeviceMemberId:(members[0]?.id||"")} onChange={e=>setDraftDeviceMemberId(e.target.value)}>{members.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select><small>Se configura una vez: todo lo que añadas desde este móvil u ordenador queda asociado automáticamente a esta persona.</small></label>}
    <label><span>Estilo habitual de cocina</span><select value={draft.profile.cooking} onChange={e=>setDraft(s=>({...s,profile:{...s.profile,cooking:e.target.value as CookingStyle}}))}><option value="rapido">Rápida</option><option value="normal">Normal</option><option value="cocinar">Me gusta cocinar</option><option value="mealprep">Meal prep</option></select></label>
    <label><span>Hábitos de alimentación</span><select value={draft.profile.nutrition} onChange={e=>setDraft(s=>({...s,profile:{...s.profile,nutrition:e.target.value as NutritionMode}}))}><option value="basica">Mostrar tendencias</option><option value="off">Ocultar</option></select><small>Analiza compras y recetas como señales; no sustituye una valoración nutricional.</small></label>
    <label><span>Compra habitual</span><select value={draft.profile.shoppingCycle} onChange={e=>setDraft(s=>({...s,profile:{...s.profile,shoppingCycle:e.target.value as Profile["shoppingCycle"]}}))}><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option><option value="mixta">Grande + compras rápidas</option><option value="diaria">Frecuente</option></select></label>

    <div className="profile-market-section"><span>Supermercados habituales</span><div className="profile-market-grid">{SUPERMARKETS.map(m=><button type="button" key={m} className={draft.profile.supermarkets.includes(m)?"active":""} onClick={()=>setDraft(s=>{const supermarkets=s.profile.supermarkets.includes(m)?s.profile.supermarkets.filter(x=>x!==m):[...s.profile.supermarkets,m];const mainSupermarket=supermarkets.includes(s.profile.mainSupermarket)?s.profile.mainSupermarket:(supermarkets[0]||"");return {...s,profile:{...s.profile,supermarkets,mainSupermarket}}})}>{m}</button>)}</div></div>

    <div className="profile-market-section kitchen-tools-setting"><span>Qué tienes para cocinar</span><p>HomeOS muestra las formas de preparación compatibles cuando la receta las tiene disponibles.</p><div className="profile-market-grid">{KITCHEN_TOOLS.map(t=><button type="button" key={t} className={draft.profile.kitchenTools.includes(t)?"active":""} onClick={()=>toggleTool(t)}>{t}</button>)}</div></div>
   </div>}

  <section className="sync-settings"><div className="sync-settings-head"><div><small>HOGAR COMPARTIDO</small><h3>Sincronización entre dispositivos</h3><p>{syncCreds?"Compra, inventario, calendario y perfiles se guardan para toda la casa.":"HomeOS está preparando el hogar compartido."}</p></div><span className={"sync-state "+syncStatus}>{syncStatus==="synced"?"Sincronizado":syncStatus==="connecting"?"Guardando…":syncStatus==="error"?"Sin conexión":"Local"}</span></div>{syncCreds&&<div className="sync-actions"><button type="button" className="secondary" onClick={copyHomeCode}>Copiar código para otro dispositivo</button><button type="button" className="secondary" onClick={syncNow}>Sincronizar ahora</button></div>}<details className="join-details"><summary>Conectar este dispositivo a otro hogar</summary><div className="join-inline"><input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="HOS1.…"/><button type="button" onClick={joinOther} disabled={!joinCode.trim()||syncStatus==="connecting"}>Conectar</button></div>{joinError&&<span className="form-error">{joinError}</span>}</details></section>
  </div>

  <div className="modal-actions sticky-actions"><button type="button" className="secondary" onClick={cancel}>Cancelar</button><button type="button" className="primary" disabled={!dirty} onClick={save}>{dirty?"Guardar cambios":"Sin cambios"}</button></div>
 </div></div>
}