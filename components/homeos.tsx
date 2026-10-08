"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { localDateIso, calendarDaysUntil } from "../lib/local-date";
import { readBrowserStorage, writeBrowserStorage, removeBrowserStorage } from "../lib/browser-storage";
import { clearSync, connectionCode, createRemoteHousehold, getStoredSync, parseConnectionCode, readRemoteHousehold, storeSync, syncConfigured, SyncConflictError, type SyncCredentials, writeRemoteHousehold } from "../lib/homeos-sync";
import { addMonthsIso, canStoreAt, classifyProduct, detectProductsInText, freezerQualityGuide, productSuggestions, recommendedLocation, storageWarning, registeredProductNames } from "../lib/product-engine";
import { ProductGlyph } from "./product-glyph";
import { REUSE_IDEAS, reuseIdeaMatchesProduct, type ReuseNeed } from "../lib/reuse-engine";
import { RECIPES as BUILTIN_RECIPES } from "../lib/recipes";
import { generateLocalRecipes, localAiSupported, localAiErrorMessage } from "../lib/local-ai";
import { mergeReceiptCandidates, readReceiptImage, type ReceiptCandidate } from "../lib/receipt-local";
import { estimateShelfLifeFromReference, shelfLifeBandFromReference } from "../lib/shelf-life-calibration";
import { DEFAULT_MENU_PREFERENCES, normalizeMenuPreferences, type MenuPreferences } from "../lib/menu-preferences";
import { RECIPE_THEMES, themeForMonth, themeForPeriod, themeRecipes } from "../lib/recipe-themes";
import { retireWeeklyMenu } from "../lib/retire-weekly-menu";
import { recipeAllowed, type WeeklyMenuPlan } from "../lib/weekly-menu";
import { freeInventoryAfterReservations, planFromBase, planToBase, planUnitFamily, recipeShortages, planProductMatches, consumePlanIngredients, resizeShoppingSources, remainingSourcesAfterPurchase, removePlanFromSources, sumSources, type ShoppingSource } from "../lib/recipe-plan-engine";
import { mergeHouseholdState } from "../lib/sync-merge";
import { habitBalanceSignals } from "../lib/habit-balance";
import { normalizeSpokenShoppingText, splitShoppingEntries, parseShoppingQuantity, shoppingInputNeedsReview } from "../lib/shopping-input";

import { matchesRecipeSearch, recipeCountryLabel } from "../lib/catalog-search";
import { SPANISH_SUPERMARKETS, normalizeSupermarket, editDistance } from "../lib/supermarkets";
import { appendConfirmedStockCheck, emptyInventoryItem, freezeInventoryItem, thawInventoryItem } from "../lib/inventory-lifecycle";
import { estimateConsumption, estimateInventoryConsumption, shoppingQuantityStep, changeShoppingQuantity, type ConsumptionHabit, type StockCheck } from "../lib/consumption-engine";

type View = "inicio"|"comer"|"comprar"|"casa"|"finanzas"|"habitos";
type StockState = "hay"|"poco"|"falta"|"mucho"|"incierto";
type Location = "Nevera"|"Congelador"|"Despensa"|"Suplementos"|"Sin ubicar";
type Goal = "organizar"|"ahorrar"|"desperdicio"|"equilibrio";
type NutritionMode = "basica"|"detallada"|"off";
type CookingStyle = "rapido"|"normal"|"cocinar"|"mealprep";

type InventoryItem = {
  id:string; name:string; qty:number; unit:string; location:Location; estimateAnchorDate?:string; estimateAnchorQty?:number; category:string; subcategory?:string;
  stock:StockState; purchasedAt:string; expires?:string; dateType?:"caducidad"|"preferente";
  purchaseDateUnknown?:boolean; price?:number; servings?:number; preparedAt?:string; source?:"compra"|"receta"|"sobras"|"mealprep"; preparedRecipeId?:string; preparedPlanId?:string; preparedIngredients?:{name:string;key:string;category:string}[]; mealPrepInitialServings?:number; mealPrepDays?:number; mealPrepStart?:string; frozenAt?:string; originalExpires?:string; supermarket?:string; storageMode?:"normal"|"reserva"; reservedFor?:string; qualityReviewAt?:string; lastConfirmedAt?:string; lastStockCheckId?:string; estimatedExpires?:string; estimatedDateType?:"caducidad"|"preferente"; estimateBasis?:string; planReservations?:ShoppingSource[];
};
type ShoppingItem = {
  id:string; name:string; requestedName?:string; qty:number; unit:string; category:string; subcategory?:string; supermarket?:string; price?:number;
  requestedBy:string; reason:"persona"|"recomienda"|"receta"|"reposicion"; status:"pendiente"|"carrito"; reserve?:boolean; recipePlanId?:string; recipePlanIds?:string[]; recipeId?:string; sources?:ShoppingSource[]; boughtQty?:number;
};
type PurchaseRecord = {id:string;name:string;qty:number;unit:string;category:string;subcategory?:string;date:string;supermarket?:string;requestedBy?:string;price?:number};
type PurchaseSession = {id:string;date:string;total:number;supermarket?:string};
type MealRecord = {id:string;date:string;recipeId:string;title:string;servings:number;ingredients:{name:string;key:string;category:string}[]};
type ProductPreference = {location?:Location;category?:string};
type Member = {id:string;name:string;relation:string;presence:"casa"|"fuera_dia"|"fines_semana"|"variable";appetite:"poco"|"normal"|"mucho";dislikes:string;notes:string;dailyCalories?:number};
type EventItem = {id:string;title:string;date:string;time?:string};
type RecipeIngredient = {name:string;qty:string;key:string};
type Recipe = {
  id:string; title:string; image:string; time:number; difficulty:"Fácil"|"Media";
  mode:CookingStyle[]; servings:number; calories:number; protein:number; carbs:number; fat:number;
  ingredients:RecipeIngredient[]; steps:string[]; description:string; tools?:string[]; source?:"local-ai"; family?:string;mealTypes?:("Desayuno"|"Comida"|"Cena"|"Merienda")[];photoCaption?:string;country?:string;nutritionUnavailable?:boolean;toolGroups?:string[][];adapted?:boolean;omittedIngredients?:string[];
};
const RECIPES:Recipe[]=BUILTIN_RECIPES;
type RecipePlan = {id:string;recipe:Recipe;createdAt:string;plannedFor?:string;status:"saved"|"done";shoppingLinked?:boolean};
type Profile = {
  householdSize:number; supermarkets:string[]; mainSupermarket:string; goals:Goal[];
  nutrition:NutritionMode; cooking:CookingStyle; shoppingCycle:"diaria"|"semanal"|"quincenal"|"mensual"|"mixta";
  consumptionHabits?:ConsumptionHabit[]; consumptionSetupDone?:boolean; notifications:boolean; onboardingDone:boolean; financeMode:"orientativo"|"preciso"; kitchenTools:string[];
};
export type AppState = {
  stockChecks:StockCheck[]; retiredWeeklyMenu?:WeeklyMenuPlan; menuPreferences:MenuPreferences; inventory:InventoryItem[]; shopping:ShoppingItem[]; purchaseHistory:PurchaseRecord[]; purchaseSessions:PurchaseSession[]; mealHistory:MealRecord[]; weeklyMenu:WeeklyMenuPlan|null; recipePlans:RecipePlan[]; productPreferences:Record<string,ProductPreference>; members:Member[]; events:EventItem[];
  profile:Profile; budget:number; spent:number; waste:number; wasteSaved:number; productEngineVersion:number;
};

const SUPERMARKETS=SPANISH_SUPERMARKETS;
const KITCHEN_TOOLS=["Placa / inducción","Gas","Horno","Air fryer","Microondas","Thermomix / robot","Batidora"];
const CATEGORIES=["Todos","Fruta y verdura","Carne","Lácteos","Congelados","Preparados","Despensa","Bebidas","Snacks y dulces","Suplementos","Limpieza y hogar","Higiene y cuidado","Por clasificar"];
const LOCATIONS=["Todo","Nevera","Congelador","Despensa","Revisar"];
const CATEGORY_LABELS:Record<string,string>={"Todos":"Todo","Lácteos":"Lácteos","Carne":"Carne y pescado","Fruta y verdura":"Fruta y verdura","Congelados":"Congelados","Despensa":"Despensa","Preparados":"Preparados","Bebidas":"Bebidas","Snacks y dulces":"Snacks y dulces","Suplementos":"Suplementos","Limpieza y hogar":"Limpieza y hogar","Higiene y cuidado":"Higiene y cuidado","Por clasificar":"Revisar"};
const CATEGORY_ICONS:Record<string,string>={"Todos":"▦","Lácteos":"🥛","Carne":"🥩","Fruta y verdura":"🥬","Congelados":"🧊","Despensa":"🥫","Preparados":"🍱","Bebidas":"🥤","Snacks y dulces":"🍪","Suplementos":"＋","Limpieza y hogar":"🧽","Higiene y cuidado":"🫧","Por clasificar":"📦"};
const LOCATION_ICONS:Record<string,string>={"Todo":"🏠","Nevera":"❄️","Congelador":"🧊","Despensa":"🥫","Revisar":"◌"};


const DEFAULT:AppState={
 stockChecks:[],
 menuPreferences:DEFAULT_MENU_PREFERENCES,
 inventory:[],
 shopping:[],
 purchaseHistory:[],
 purchaseSessions:[],
 mealHistory:[],
 weeklyMenu:null,
 recipePlans:[],
 productPreferences:{},
 members:[{id:"m1",name:"Tú",relation:"Yo",presence:"variable",appetite:"normal",dislikes:"",notes:"",dailyCalories:0}],
 events:[],
 budget:0,spent:0,waste:0,wasteSaved:0,productEngineVersion:1,
 profile:{householdSize:1,supermarkets:[],mainSupermarket:"",goals:[],nutrition:"basica",cooking:"rapido",shoppingCycle:"semanal",notifications:true,onboardingDone:false,financeMode:"orientativo",kitchenTools:[]}
};

export function normalizeState(x:any):AppState{
 const raw=x&&typeof x==="object"&&!Array.isArray(x)?x:{};
 const rawMembers=Array.isArray(raw.members)?raw.members:DEFAULT.members;
 const rawProfile=raw.profile&&typeof raw.profile==="object"&&!Array.isArray(raw.profile)?raw.profile:{};
 const profile={...DEFAULT.profile,...rawProfile};
 profile.householdSize=Math.max(1,Math.min(12,Math.round(Number(profile.householdSize)||1)));
 profile.supermarkets=Array.isArray(profile.supermarkets)?[...new Set(profile.supermarkets.filter((v:any)=>typeof v==="string"&&v.trim()).map(normalizeSupermarket))].slice(0,30):[];
 profile.consumptionHabits=Array.isArray(profile.consumptionHabits)?profile.consumptionHabits.filter((h:any)=>h&&typeof h.name==="string"&&h.qty>0&&Number.isFinite(h.qty)&&h.days>0&&typeof h.unit==="string").slice(0,30):[];
 profile.kitchenTools=Array.isArray(profile.kitchenTools)?profile.kitchenTools.filter((v:any)=>typeof v==="string").slice(0,20):[];
 profile.goals=Array.isArray(profile.goals)?profile.goals.filter((v:any)=>["organizar","ahorrar","desperdicio","equilibrio"].includes(v)):DEFAULT.profile.goals;
 profile.mainSupermarket=typeof profile.mainSupermarket==="string"?normalizeSupermarket(profile.mainSupermarket):"";
 if(profile.nutrition==="detallada")profile.nutrition="basica";
 const baseMembers=rawMembers.slice(0,12).map((m:any,i:number)=>{const base=((DEFAULT.members[i]||{id:"m"+(i+1),name:"Miembro "+(i+1),relation:"Miembro",presence:"variable",appetite:"normal",dislikes:"",notes:"",dailyCalories:0}) as Member);const merged={...base,...(m&&typeof m==="object"?m:{})};const rawCalories=Number(merged.dailyCalories)||0;return {...merged,dailyCalories:rawCalories>=1200&&rawCalories<=5000?Math.round(rawCalories):0}});
 const members=ensureMembers(baseMembers,profile.householdSize);
 const productPreferences=raw.productPreferences&&typeof raw.productPreferences==="object"&&!Array.isArray(raw.productPreferences)?raw.productPreferences:{};
 const needsProductMigration=(Number(raw.productEngineVersion)||0)<1;
 const baseInventory=(Array.isArray(raw.inventory)?raw.inventory:DEFAULT.inventory) as InventoryItem[];
 const baseShopping=(Array.isArray(raw.shopping)?raw.shopping:DEFAULT.shopping) as ShoppingItem[];
 const migratedInventory=needsProductMigration?baseInventory.map(i=>{
  const p=classifyProduct(i.name,i.category);
  const pref=productPreferences[p.canonical]||{};
  const category=pref.category||p.category;
  const preserveFrozen=i.location==="Congelador"&&Boolean(i.frozenAt);
  const location=preserveFrozen?i.location:recommendedLocation(i.name,category,pref.location) as Location;
  return {...i,category,subcategory:i.subcategory||p.subcategory,location};
 }):baseInventory;
 const inventory=migratedInventory.map(i=>{
  if(i.category==="Preparados")return {...i,estimatedExpires:undefined,estimatedDateType:undefined,estimateBasis:undefined};
  if(i.expires||i.category==="Preparados"||i.location==="Congelador"||!i.purchasedAt||i.purchaseDateUnknown)return i;
  if(i.estimatedExpires){
   if(i.estimateBasis?.includes("referencia real observada en tienda")&&!estimateShelfLifeFromReference(i.name,i.purchasedAt))return {...i,estimatedExpires:undefined,estimatedDateType:undefined,estimateBasis:undefined};
   return i;
  }
  const estimated=estimateShelfLifeFromReference(i.name,i.purchasedAt);
  return estimated?{...i,estimatedExpires:estimated.date,estimatedDateType:estimated.kind,estimateBasis:estimated.basis}:i;
 });
 const migratedShopping=needsProductMigration?baseShopping.map(i=>{
  const p=classifyProduct(i.name,i.category);
  const pref=productPreferences[p.canonical]||{};
  return {...i,category:pref.category||p.category,subcategory:i.subcategory||p.subcategory};
 }):baseShopping;
 const shopping=migratedShopping.map(i=>({...i,supermarket:i.supermarket?normalizeSupermarket(i.supermarket):undefined,sources:i.sources?.length?i.sources:shoppingSources(i)}));
 return cleanWeeklyState({...DEFAULT,...raw,stockChecks:Array.isArray(raw.stockChecks)?raw.stockChecks.filter((c:any)=>c&&typeof c.name==="string"&&typeof c.date==="string"&&Number.isFinite(c.qty)&&c.qty>=0):[],menuPreferences:normalizeMenuPreferences(raw.menuPreferences),profile,members,events:Array.isArray(raw.events)?raw.events.slice(-200):[],inventory,shopping,purchaseHistory:Array.isArray(raw.purchaseHistory)?raw.purchaseHistory:[],purchaseSessions:Array.isArray(raw.purchaseSessions)?raw.purchaseSessions:[],mealHistory:Array.isArray(raw.mealHistory)?raw.mealHistory:[],weeklyMenu:raw.weeklyMenu&&Array.isArray(raw.weeklyMenu.slots)?raw.weeklyMenu:null,recipePlans:Array.isArray(raw.recipePlans)?raw.recipePlans.filter((p:any)=>p&&p.recipe&&p.status!=="done"):[],productPreferences,budget:Math.max(0,Number(raw.budget)||0),spent:Math.max(0,Number(raw.spent)||0),waste:Math.max(0,Number(raw.waste)||0),wasteSaved:Math.max(0,Number(raw.wasteSaved)||0),productEngineVersion:1});
}
function loadState():AppState{
 if(typeof window==="undefined") return DEFAULT;
 try{return normalizeState(JSON.parse(readBrowserStorage("homeos:v5")||"{}"))}catch{return DEFAULT}
}
function daysUntil(date?:string){return date?calendarDaysUntil(date):999}
function fmtDate(){return new Intl.DateTimeFormat("es-ES",{weekday:"long",day:"numeric",month:"long"}).format(new Date())}
function isoAfterDays(days:number){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+days);return localDateIso(d)}
function weekendPlanIso(){const d=new Date();d.setHours(12,0,0,0);const day=d.getDay();if(day===6||day===0)return localDateIso(d);d.setDate(d.getDate()+(6-day));return localDateIso(d)}

function demoState(_withMenu:boolean):AppState{
 const today=new Date();today.setHours(12,0,0,0);
 const iso=(offset=0)=>{const d=new Date(today);d.setDate(d.getDate()+offset);return localDateIso(d)};
 const month=localDateIso(today).slice(0,7);
 const inventory:InventoryItem[]=[
  {id:"demo-tomate",name:"Tomate cherry",qty:1,unit:"ud",location:"Nevera",category:"Fruta y verdura",stock:"hay",purchasedAt:iso(-3),expires:iso(1),dateType:"caducidad",supermarket:"Mercadona"},
  {id:"demo-yogur",name:"Yogur natural",qty:3,unit:"uds",location:"Nevera",category:"Lácteos",stock:"hay",purchasedAt:iso(-4),expires:iso(2),dateType:"caducidad",supermarket:"Lidl"},
  {id:"demo-espinaca",name:"Espinacas",qty:250,unit:"g",location:"Nevera",category:"Fruta y verdura",stock:"hay",purchasedAt:iso(-2),estimatedExpires:iso(3),estimatedDateType:"caducidad",estimateBasis:"Demo visual",supermarket:"Mercadona"},
  {id:"demo-fruta",name:"Fruta variada",qty:5,unit:"uds",location:"Nevera",category:"Fruta y verdura",stock:"hay",purchasedAt:iso(-2),supermarket:"Mercadona"},
  {id:"demo-avena",name:"Avena",qty:500,unit:"g",location:"Despensa",category:"Despensa",stock:"hay",purchasedAt:iso(-12),supermarket:"Lidl"},
  {id:"demo-pollo",name:"Pollo",qty:900,unit:"g",location:"Nevera",category:"Carne",stock:"hay",purchasedAt:iso(-1),supermarket:"Mercadona"},
  {id:"demo-arroz",name:"Arroz",qty:800,unit:"g",location:"Despensa",category:"Despensa",stock:"hay",purchasedAt:iso(-20),supermarket:"Mercadona"},
  {id:"demo-verdura",name:"Verduras variadas",qty:500,unit:"g",location:"Nevera",category:"Fruta y verdura",stock:"hay",purchasedAt:iso(-1),supermarket:"Mercadona"},
  {id:"demo-calabaza",name:"Calabaza",qty:900,unit:"g",location:"Nevera",category:"Fruta y verdura",stock:"hay",purchasedAt:iso(-1),supermarket:"Lidl"},
  {id:"demo-preparado",name:"Pollo con arroz preparado",qty:4,unit:"raciones",location:"Nevera",category:"Preparados",stock:"hay",purchasedAt:iso(-1),preparedAt:iso(-1),servings:4,source:"mealprep",mealPrepInitialServings:4,mealPrepDays:4,mealPrepStart:iso(-1),preparedIngredients:[{name:"Pollo",key:"pollo",category:"Carne"},{name:"Arroz",key:"arroz",category:"Despensa"},{name:"Verduras",key:"verdura",category:"Fruta y verdura"}]}
 ];
 const shopping:ShoppingItem[]=[
  {id:"demo-shop1",name:"Leche",qty:2,unit:"L",category:"Lácteos",supermarket:"Mercadona",requestedBy:"Fran",reason:"persona",status:"pendiente"},
  {id:"demo-shop2",name:"Huevos",qty:12,unit:"uds",category:"Lácteos",supermarket:"Mercadona",requestedBy:"Casa",reason:"reposicion",status:"pendiente"},
  {id:"demo-shop3",name:"Pan integral",qty:1,unit:"ud",category:"Despensa",supermarket:"Lidl",requestedBy:"Casa",reason:"reposicion",status:"pendiente"},
  {id:"demo-shop4",name:"Plátano de Canarias",qty:6,unit:"uds",category:"Fruta y verdura",supermarket:"Mercadona",requestedBy:"Casa",reason:"reposicion",status:"pendiente"},
  {id:"demo-shop5",name:"Queso",qty:1,unit:"ud",category:"Lácteos",supermarket:"Lidl",requestedBy:"Casa",reason:"reposicion",status:"pendiente"}
 ];
 const meal=(id:string,offset:number,title:string,ingredients:{name:string;key:string;category:string}[]):MealRecord=>({id,date:iso(offset),recipeId:id,title,servings:1,ingredients});
 const mealHistory:MealRecord[]=[
  meal("dm1",-1,"Pollo con arroz",[{name:"Pollo",key:"pollo",category:"Carne"},{name:"Arroz",key:"arroz",category:"Despensa"}]),
  meal("dm2",-2,"Pasta con pollo",[{name:"Pollo",key:"pollo",category:"Carne"},{name:"Pasta",key:"pasta",category:"Despensa"}]),
  meal("dm3",-3,"Arroz con huevo",[{name:"Huevo",key:"huevo",category:"Lácteos"},{name:"Arroz",key:"arroz",category:"Despensa"}]),
  meal("dm4",-4,"Pollo y patata",[{name:"Pollo",key:"pollo",category:"Carne"},{name:"Patata",key:"patata",category:"Fruta y verdura"}]),
  meal("dm5",-5,"Pescado con arroz",[{name:"Pescado",key:"pescado",category:"Carne"},{name:"Arroz",key:"arroz",category:"Despensa"}]),
  meal("dm6",-6,"Tortilla",[{name:"Huevo",key:"huevo",category:"Lácteos"},{name:"Cebolla",key:"cebolla",category:"Fruta y verdura"}]),
  meal("dm7",-7,"Chocolate",[{name:"Chocolate",key:"chocolate",category:"Snacks y dulces"}]),
  meal("dm8",-8,"Galletas",[{name:"Galletas",key:"galleta",category:"Snacks y dulces"}]),
  meal("dm9",-9,"Helado",[{name:"Helado",key:"helado",category:"Snacks y dulces"}]),
  meal("dm10",-10,"Pollo",[{name:"Pollo",key:"pollo",category:"Carne"}])
 ];
 return {
  ...DEFAULT,
  inventory,
  shopping,
  purchaseHistory:[],
  purchaseSessions:[{id:"demo-buy",date:month+"-01",total:124,supermarket:"Mercadona"}],
  mealHistory,
  weeklyMenu:null,
  recipePlans:[],
  members:[{id:"m1",name:"Fran",relation:"Yo",presence:"variable",appetite:"normal",dislikes:"",notes:"",dailyCalories:0}],
  events:[
   {id:"demo-event1",title:"Comida con invitados",date:iso(0),time:"14:00"},
   {id:"demo-event2",title:"Entrenamiento",date:iso(0),time:"18:00"},
   {id:"demo-event3",title:"Cena",date:iso(0),time:"20:00"}
  ],
  budget:500,spent:124,waste:0,wasteSaved:0,
  profile:{...DEFAULT.profile,householdSize:1,supermarkets:["Mercadona","Lidl"],mainSupermarket:"Mercadona",goals:["organizar","desperdicio"],nutrition:"basica",cooking:"rapido",shoppingCycle:"semanal",notifications:true,onboardingDone:true,financeMode:"orientativo",kitchenTools:["Placa / inducción","Horno","Microondas"]}
 };
}
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
 const recipeIds=[...new Set(positive.filter(x=>x.type==="recipe"&&x.planId).map(x=>x.planId!))];
 return {...i,qty,sources:positive,recipePlanIds:recipeIds,recipePlanId:recipeIds[0],reason:positive.some(x=>x.type==="recipe")?"receta":positive.some(x=>x.type==="weekly")?"receta":positive.some(x=>x.type==="restock")?"recomienda":"persona"};
}
function cleanPlanReservations(item:InventoryItem,planId:string){
 const planReservations=(item.planReservations||[]).filter(x=>x.planId!==planId);
 return {...item,planReservations:planReservations.length?planReservations:undefined};
}
function score(recipe:Recipe,inv:InventoryItem[]){return recipe.ingredients.length-missing(recipe,inv).length}
function planningInventory(state:AppState,exceptPlanId?:string){
 const active=state.recipePlans.filter(p=>p.status==="saved").map(p=>p.id);
 return freeInventoryAfterReservations(state.inventory.filter(usableInventoryItem),active,exceptPlanId) as InventoryItem[];
}
function cleanWeeklyState(base:AppState){return retireWeeklyMenu(base,(item,sources)=>withShoppingSources(item as ShoppingItem,sources as ShoppingSource[])) as AppState}
function reconcileWeeklyShopping(base:AppState){return cleanWeeklyState(base)}
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
function productMatchesNeed(i:InventoryItem,key:string,label=key){
 return usableInventoryItem(i)&&planProductMatches(i,key,label);
}
function hasNeed(inv:InventoryItem[],need:ReuseNeed){return inv.some(i=>productMatchesNeed(i,need.key))}
function needAvailable(inv:InventoryItem[],need:ReuseNeed){
 const family=unitFamily(need.unit);
 const required=toBase(need.amount,need.unit);
 let total=0;
 for(const i of inv.filter(x=>productMatchesNeed(x,need.key,need.label))){
  const itemFamily=unitFamily(i.unit);
  if(itemFamily!==family)continue;
  if(family==="count"&&normalizedUnit(i.unit)!==normalizedUnit(need.unit))continue;
  total+=toBase(Math.max(0,i.qty),i.unit);
 }
 return total>=required;
}
function consumeNeed(inv:InventoryItem[],need:{key:string;amount:number;unit:string;label?:string}){
 let remaining=toBase(need.amount,need.unit);
 const family=unitFamily(need.unit);
 let exact=true;
 const candidates=inv.map((i,index)=>({i,index})).filter(x=>productMatchesNeed(x.i,need.key,need.label)).sort((a,b)=>daysUntil(a.i.expires)-daysUntil(b.i.expires));
 const out=[...inv];
 for(const {i,index} of candidates){
  if(remaining<=0)break;
  const itemFamily=unitFamily(i.unit);
  if(itemFamily!==family||(family==="count"&&normalizedUnit(i.unit)!==normalizedUnit(need.unit))){
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
export function consumeRecipeIngredients(inv:InventoryItem[],ingredients:RecipeIngredient[],context?:AppState,today=localDateIso()){
 const result=consumePlanIngredients(inv,ingredients,usableInventoryItem);
 return {...result,inventory:result.inventory.map(i=>{const before=inv.find(x=>x.id===i.id);return before?.estimateAnchorQty!==undefined&&before.qty!==i.qty?{...i,estimateAnchorQty:Math.max(0,(context?estimateInventoryConsumption(before,inv,context.purchaseHistory,context.profile.consumptionHabits,context.stockChecks,today).estimatedQty:before.estimateAnchorQty)-(before.qty-i.qty)),estimateAnchorDate:context?today:before.estimateAnchorDate}:i})};
}

function ensureMembers(members:Member[],count:number){
 const out=[...members];
 while(out.length<count){
  const n=out.length+1;
  out.push({id:"m"+n,name:"Miembro "+n,relation:"Miembro",presence:"variable",appetite:"normal",dislikes:"",notes:"",dailyCalories:0});
 }
 return out;
}
function statusLabel(s:StockState){return s==="hay"?"Hay":s==="poco"?"Queda poco":s==="falta"?"Probablemente falta":s==="mucho"?"Hay bastante":"Revisar"}
function storeClass(name:string){
 const n=norm(name);
 if(n.includes("mercadona"))return "store-mercadona";
 if(n.includes("lidl"))return "store-lidl";
 if(n.includes("aldi"))return "store-aldi";
 if(n.includes("carrefour"))return "store-carrefour";
 if(n.includes("bonpreu")||n.includes("esclat"))return "store-bonpreu";
 if(n.includes("consum"))return "store-consum";
 if(n.includes("dia"))return "store-dia";
 if(n.includes("cualquiera")||n.includes("compra general"))return "store-any";
 return "store-other";
}
function productIcon(name:string,cat:string){return <ProductGlyph name={name} category={cat}/>}
function rotationBand(name:string,cat:string,location?:string){
 if(location==="Congelador") return {key:"baja",label:"Larga duración"};
 if(cat==="Preparados")return {key:"alta",label:"Conservación de preparado"};
 const ref=shelfLifeBandFromReference(name);
 if(ref==="corta")return {key:"alta",label:"Vida útil corta"};
 if(ref==="media")return {key:"media",label:"Vida útil media"};
 if(ref==="larga")return {key:"baja",label:"Vida útil larga"};
 const r=classifyProduct(name,cat).rotation;
 return {key:r,label:r==="alta"?"Vida útil corta":r==="media"?"Vida útil media":"Vida útil larga"};
}
function recommendedBuyAfter(name:string,cat:string,plannedFor?:string){
 if(!plannedFor)return undefined;
 const band=rotationBand(name,cat).key;
 const daysBefore=band==="alta"?2:band==="media"?5:14;
 const d=new Date(plannedFor+"T12:00:00");
 if(Number.isNaN(d.getTime()))return undefined;
 d.setDate(d.getDate()-daysBefore);
 const iso=localDateIso(d);
 const today=localDateIso();
 return iso>today?iso:undefined;
}
function median(values:number[]){
 const xs=values.filter(Number.isFinite).sort((a,b)=>a-b);
 if(!xs.length)return 0;
 const m=Math.floor(xs.length/2);
 return xs.length%2?xs[m]:(xs[m-1]+xs[m])/2;
}
function addDaysIso(date:string,days:number){const d=new Date(date+"T12:00:00");if(!Number.isFinite(d.getTime()))return "";d.setDate(d.getDate()+days);return localDateIso(d)}
function inventoryEstimate(state:AppState,item:InventoryItem){
 if(item.location!=="Congelador"&&item.expires&&item.dateType==="caducidad"&&daysUntil(item.expires)<0)return {prob:.01,label:"Caducado",tone:"falta",basis:"La fecha de caducidad registrada ya ha pasado"};
 if(item.location!=="Congelador"&&item.expires&&item.dateType==="preferente"&&daysUntil(item.expires)<0)return {prob:.55,label:"Revisar calidad",tone:"review",basis:"El consumo preferente ha pasado; revisa calidad antes de usarlo"};
 if(item.stock==="falta"||item.qty<=0)return {prob:.03,label:"Probablemente falta",tone:"falta",basis:"Confirmado como agotado"};
 if(item.storageMode==="reserva"){
  const reviewDue=item.qualityReviewAt&&daysUntil(item.qualityReviewAt)<=0;
  return {prob:.96,label:"Probablemente hay",tone:reviewDue?"review":"hay",basis:reviewDue?"Reserva registrada · conviene revisar calidad":"Reserva registrada · no se descuenta por rotación normal"};
 }
 if(item.stock!=="poco"&&item.lastConfirmedAt&&daysUntil(item.lastConfirmedAt)>=-1)return {prob:.99,label:"Cantidad confirmada",tone:"hay",basis:"Cantidad real confirmada por ti; el ritmo de consumo se estima por separado"};
 if(item.stock==="incierto")return {prob:.5,label:"Revisar",tone:"incierto",basis:"Cantidad o estado pendiente de confirmar"};
 if(item.category==="Preparados")return {prob:item.stock==="poco"?.42:.9,label:"Raciones registradas",tone:item.stock==="poco"?"incierto":"hay",basis:"Cantidad de comida preparada registrada; el paso de los días no confirma que se haya comido"};
 const estimate=estimateInventoryConsumption(item,state.inventory,state.purchaseHistory,state.profile.consumptionHabits,state.stockChecks);
 // A product without history is not a task for the user: show a neutral
 // initial estimate and let the purchase cycle learn it automatically.
 if(estimate.source==="unknown")return {prob:.55,label:"Estimación inicial",tone:"review",basis:"Todavía no hay historial suficiente; se ajustará con las próximas compras"};
 const recorded=Math.max(.01,item.estimateAnchorQty??item.qty);
 const ratio=estimate.estimatedQty/recorded;
 const fresh=daysUntil(item.lastConfirmedAt||item.purchasedAt)>=-1;
 let prob=fresh?.96:ratio>.6?.82:ratio>.2?.55:ratio>0?.35:.2;
 if(item.stock==="poco")prob=Math.min(prob,.42);
 return {prob,label:prob>=.78?"Probablemente hay":prob>=.32?"Revisar cantidad":"Podría faltar",tone:prob>=.78?"hay":prob>=.32?"incierto":"falta",basis:estimate.basis+" · ≈ "+estimate.estimatedQty+" "+item.unit+" estimados; "+item.qty+" "+item.unit+" registrados"};
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

function suspiciousRepeatedText(value:string){
 const words=norm(value).split(/\s+/).filter(Boolean);
 if(words.length<3)return false;
 const unique=new Set(words);
 return unique.size===1||words.every((w,i)=>i===0||w===words[0]);
}
function logo(){return <div className="logo-mark" aria-label="HomeOS"><svg viewBox="0 0 64 64" role="img"><rect x="6" y="6" width="52" height="52" rx="15" className="logo-bg"/><rect className="logo-h" x="17" y="17" width="8" height="30" rx="2"/><rect className="logo-h" x="39" y="17" width="8" height="30" rx="2"/><rect className="logo-h" x="23" y="28" width="18" height="8" rx="2"/><ellipse className="logo-spoon" cx="32" cy="20.5" rx="4.6" ry="5.6"/><rect className="logo-spoon" x="30.3" y="25" width="3.4" height="20" rx="1.7"/></svg></div>}
function micIcon(){return <svg className="mic-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="8.25" y="2.75" width="7.5" height="12.5" rx="3.75" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M5.75 11.75v.5a6.25 6.25 0 0 0 12.5 0v-.5M12 18.5v2.75M8.75 21.25h6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
function habitIcon(key:string){
 const common={fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
 return <span className={"habit-symbol habit-symbol-"+key} aria-hidden="true"><svg viewBox="0 0 24 24">
  {key==="protein"?<><path d="M8.5 14.5c-2.4-2.4-2.5-5.9-.2-8.2s5.8-2.2 8.2.2 2.2 5.9-.1 8.2-5.5 2.2-7.9-.2Z" {...common}/><path d="m7.2 15.8-2.1 2.1M4.2 17.1l2.7 2.7M3.8 20.2l1.3-1.3" {...common}/></>
  :key==="veg"?<><path d="M18.8 5.2C12.7 4.7 7.4 7.6 6.1 13c-.7 3 1 5.5 3.8 5.8 5.8.7 8.8-5 8.9-13.6Z" {...common}/><path d="M5.2 19.5c3.8-4.7 6.8-7.5 11.4-10.6" {...common}/></>
  :key==="carbs"?<><path d="M12 4v16M12 8c-2.4 0-4-1.3-4.6-3.2 2.4-.1 4 .9 4.6 3.2ZM12 12c-2.4 0-4-1.3-4.6-3.2 2.4-.1 4 .9 4.6 3.2ZM12 16c-2.4 0-4-1.3-4.6-3.2 2.4-.1 4 .9 4.6 3.2ZM12 8c2.4 0 4-1.3 4.6-3.2-2.4-.1-4 .9-4.6 3.2ZM12 12c2.4 0 4-1.3 4.6-3.2-2.4-.1-4 .9-4.6 3.2ZM12 16c2.4 0 4-1.3 4.6-3.2-2.4-.1-4 .9-4.6 3.2Z" {...common}/></>
  :<><path d="m8 8 8 8M16 8l-8 8" {...common}/><path d="M8 8 5 6l-2 2 3 3M16 8l3-2 2 2-3 3M8 16l-3 2-2-2 3-3M16 16l3 2 2-2-3-3" {...common}/><rect x="7" y="7" width="10" height="10" rx="3" {...common}/></>}
 </svg></span>
}

function navIcon(id:View,_icon:string){
 const common={fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
 return <span className={"nav-icon nav-icon-"+id} aria-hidden="true"><svg viewBox="0 0 24 24">
  {id==="inicio"?<><path d="M3.8 11.2 12 4.5l8.2 6.7v8.1a1.7 1.7 0 0 1-1.7 1.7h-13a1.7 1.7 0 0 1-1.7-1.7v-8.1Z" fill="currentColor" stroke="none"/><path d="M9.2 21v-6.3h5.6V21" fill="var(--paper)" stroke="none"/></>
  :id==="comer"?<><path d="M5 3v7M8 3v7M5 7h3M6.5 10v11" {...common}/><path d="M15 3v18M15 3c3 2.5 4 7 1.5 10H15" {...common}/></>
  :id==="comprar"?<><path d="M3 5h2l2 10h10l2-7H6" {...common}/><circle cx="9" cy="19" r="1.2" {...common}/><circle cx="17" cy="19" r="1.2" {...common}/></>
  :id==="casa"?<><path d="M3.8 11.2 12 4.5l8.2 6.7v8.1a1.7 1.7 0 0 1-1.7 1.7h-13a1.7 1.7 0 0 1-1.7-1.7v-8.1Z" {...common}/><path d="M9.2 21v-6.3h5.6V21" {...common}/></>
  :<><path d="M5 19V12M10 19V9M15 19V5M20 19V8" {...common}/><path d="M3 20.5h19" {...common}/></>}
 </svg></span>
}

const nav:{id:View;label:string;icon:string}[]=[
 {id:"inicio",label:"Inicio",icon:"⌂"},{id:"comer",label:"Comer",icon:"♨"},{id:"comprar",label:"Comprar",icon:"⌁"},{id:"casa",label:"Casa",icon:"⌂"},{id:"finanzas",label:"Finanzas",icon:"▥"}
];

export function reconcileRecipeShopping(base:AppState,onlyPlanIds?:string[]){
  let shopping=[...base.shopping];
  const targets=base.recipePlans.filter(p=>p.status==="saved"&&p.shoppingLinked&&(!onlyPlanIds||onlyPlanIds.includes(p.id)));
  for(const plan of targets){
   shopping=shopping.flatMap(item=>{
    const next=shoppingSources(item).filter(src=>src.planId!==plan.id);
    const updated=withShoppingSources(item,next);
    return updated?[updated]:[];
   });
   const shortages=recipeShortages(plan.recipe.ingredients,planningInventory({...base,shopping},plan.id));
   for(const shortage of shortages){
    const unit=shortage.unit||inferUnit(shortage.name);
    const canonical=norm(classifyProduct(shortage.name,inferCategory(shortage.name)).canonical);
    const source:ShoppingSource={id:"recipe:"+plan.id+":"+canonical,type:"recipe",label:plan.recipe.title,qty:shortage.missing,unit,planId:plan.id,recipeId:plan.recipe.id,plannedFor:plan.plannedFor,buyAfter:recommendedBuyAfter(shortage.name,inferCategory(shortage.name),plan.plannedFor)};
    const existing=shopping.findIndex(q=>q.status==="pendiente"&&planUnitFamily(q.unit)===planUnitFamily(unit)&&norm(classifyProduct(q.name,q.category).canonical)===canonical);
    if(existing>=0){
     const q=shopping[existing];
     const updated=withShoppingSources(q,[...shoppingSources(q),source]);
     if(updated)shopping[existing]={...updated,requestedBy:updated.recipePlanIds&&updated.recipePlanIds.length>1?"Varias recetas":q.requestedBy};
    }else{
     shopping.push({id:crypto.randomUUID(),name:shortage.name,qty:shortage.missing,unit,category:inferCategory(shortage.name),requestedBy:"Receta · "+plan.recipe.title,reason:"receta",status:"pendiente",recipePlanId:plan.id,recipePlanIds:[plan.id],recipeId:plan.recipe.id,sources:[source]});
    }
   }
  }
  return {...base,shopping};
 }

export function completePurchase(s:AppState,cartIds:string[],total?:number,activeStore="",today=localDateIso()):AppState{
 const cart=s.shopping.filter(i=>cartIds.includes(i.id)&&i.status==="carrito"&&Number.isFinite(i.boughtQty??i.qty)&&(i.boughtQty??i.qty)>0);
 if(!cart.length)return s;
   const inventory=[...s.inventory];
   for(const x of cart){
    const buyQty=Math.max(.01,x.boughtQty??x.qty);
    const sourcesBefore=shoppingSources(x);
    const sourcesAfter=remainingSourcesAfterPurchase(sourcesBefore,buyQty,x.unit);
    const remainingById=new Map(sourcesAfter.map(src=>[src.id,src.qty]));
    const fulfilledSources=sourcesBefore.map(src=>({...src,qty:Math.max(0,Math.round((src.qty-(remainingById.get(src.id)||0))*100)/100)})).filter(src=>src.qty>0);
    const profile=classifyProduct(x.name,x.category);
    const pref=s.productPreferences[profile.canonical]||{};
    const category=pref.category||profile.category;
    const reserveAllowed=x.reserve&&(Boolean(freezerQualityGuide(x.name,category,profile.subcategory))||category==="Carne");
    const location=(reserveAllowed?"Congelador":recommendedLocation(x.name,category,pref.location)) as Location;
    const guide=reserveAllowed?freezerQualityGuide(x.name,category,profile.subcategory):null;
    const frozenAt=reserveAllowed?today:undefined;
    const qualityReviewAt=reserveAllowed&&guide?addMonthsIso(today,guide.minMonths):undefined;
    const estimated=!reserveAllowed?estimateShelfLifeFromReference(x.name,today):null;
    const planReservations=fulfilledSources.filter(src=>src.type==="recipe"&&Boolean(src.planId)&&src.qty>0);
    const idx=inventory.findIndex(i=>norm(i.name)===norm(x.name)&&i.unit===x.unit&&i.location===location&&Boolean(i.storageMode==="reserva")===Boolean(reserveAllowed)&&(i.qty<=0||(!i.expires&&profile.rotation!=="alta")));
    if(idx>=0){
     const current=inventory[idx];
     const estimatedExpires=current.qty<=0?estimated?.date:current.expires?current.estimatedExpires:(current.estimatedExpires&&estimated?.date?(current.estimatedExpires<estimated.date?current.estimatedExpires:estimated.date):(current.estimatedExpires||estimated?.date));
     const mergedPlanReservations=[...(current.planReservations||[])];
     for(const incoming of planReservations){
      const ri=mergedPlanReservations.findIndex(r=>r.id===incoming.id);
      if(ri>=0)mergedPlanReservations[ri]={...mergedPlanReservations[ri],qty:Math.round((mergedPlanReservations[ri].qty+incoming.qty)*100)/100};
      else mergedPlanReservations.push(incoming);
     }
     inventory[idx]={...current,...(current.qty<=0?{expires:undefined,dateType:undefined,estimatedExpires:estimated?.date,estimatedDateType:estimated?.kind,estimateBasis:estimated?.basis,lastConfirmedAt:undefined,purchaseDateUnknown:false}:{}),category,subcategory:profile.subcategory,qty:Math.max(0,current.qty)+buyQty,estimateAnchorQty:estimateInventoryConsumption(current,inventory,[...s.purchaseHistory,{name:x.name,qty:buyQty,unit:x.unit,date:today,category}],s.profile.consumptionHabits,s.stockChecks,today).estimatedQty+buyQty,estimateAnchorDate:today,stock:"hay",purchasedAt:current.qty>0?current.purchasedAt:today,price:typeof x.price==="number"?x.price:current.price,supermarket:x.supermarket||activeStore||current.supermarket,planReservations:mergedPlanReservations.length?mergedPlanReservations:undefined,...(reserveAllowed?{storageMode:"reserva" as const,frozenAt,qualityReviewAt,expires:undefined,dateType:undefined,estimatedExpires:undefined,estimatedDateType:undefined,estimateBasis:undefined}:(!current.expires&&estimatedExpires?{estimatedExpires,estimatedDateType:current.estimatedDateType||estimated?.kind,estimateBasis:current.estimateBasis||estimated?.basis}:{}))};
    }else{
     inventory.unshift({id:crypto.randomUUID(),name:x.name,qty:buyQty,estimateAnchorQty:buyQty,estimateAnchorDate:today,unit:x.unit,location,category,subcategory:profile.subcategory,stock:"hay",purchasedAt:today,price:x.price,supermarket:x.supermarket||activeStore,planReservations:planReservations.length?planReservations:undefined,...(reserveAllowed?{storageMode:"reserva" as const,frozenAt,qualityReviewAt}:(estimated?{estimatedExpires:estimated.date,estimatedDateType:estimated.kind,estimateBasis:estimated.basis}:{}))});
    }
   }
   const purchaseHistory=[...s.purchaseHistory,...cart.map(x=>{
    const p=classifyProduct(x.name,x.category);
    const pref=s.productPreferences[p.canonical]||{};
    return {
     id:crypto.randomUUID(),
     name:x.name,
     qty:Math.max(.01,x.boughtQty??x.qty),
     unit:x.unit,
     category:pref.category||p.category,
     subcategory:p.subcategory,
     date:today,
     supermarket:x.supermarket||activeStore||undefined,
     requestedBy:x.requestedBy,
     price:x.price
    };
   })];
   const purchaseSessions=typeof total==="number"&&total>=0?[...s.purchaseSessions,{id:crypto.randomUUID(),date:today,total,supermarket:activeStore||undefined}]:s.purchaseSessions;
   const shoppingAfterPurchase=s.shopping.flatMap(item=>{
    if(!cart.some(x=>x.id===item.id))return [item];
    const remaining=remainingSourcesAfterPurchase(shoppingSources(item),Math.max(.01,item.boughtQty??item.qty),item.unit);
    const updated=withShoppingSources({...item,status:"pendiente",boughtQty:undefined},remaining);
    return updated?[updated]:[];
   });
   const purchasedState={...s,inventory,purchaseHistory,purchaseSessions,spent:typeof total==="number"&&total>=0?s.spent+total:s.spent,shopping:shoppingAfterPurchase};
   return reconcileWeeklyShopping(reconcileRecipeShopping(purchasedState));
}

export default function HomeOS(){
 const [view,setView]=useState<View>("inicio");
 const [state,setState]=useState<AppState>(DEFAULT);
 const [hydrated,setHydrated]=useState(false);
 const [storageError,setStorageError]=useState(false);
 const [toast,setToast]=useState("");
 const [purchaseUndo,setPurchaseUndo]=useState<{recipeId:string;title:string;previous?:RecipePlan}|null>(null);
 const [profileOpen,setProfileOpen]=useState(false);
 const [tourOpen,setTourOpen]=useState(false);
 const [consumptionSetupOpen,setConsumptionSetupOpen]=useState(false);
 const [mobileMoreOpen,setMobileMoreOpen]=useState(false);
 const [demoMode,setDemoMode]=useState<"menu"|"ideas"|null>(null);
 const [activeStore,setActiveStore]=useState("");
 const [shoppingActive,setShoppingActive]=useState(false);
 const [casaFocus,setCasaFocus]=useState<"all"|"expiring"|"prepared"|"reserve">("all");
 const [mealSeed,setMealSeed]=useState("");
 const [comerFocus,setComerFocus]=useState<"ideas"|"aprovechar"|"themes"|"catalog"|null>(null);
 const [deviceMemberId,setDeviceMemberId]=useState("");
 const [syncCreds,setSyncCreds]=useState<SyncCredentials|null>(null);
 const [syncStatus,setSyncStatus]=useState<"local"|"connecting"|"synced"|"error">("local");
 const [ticketCameraRequest,setTicketCameraRequest]=useState(0);
 const receiptRef=useRef<HTMLInputElement>(null);
 const syncRevisionRef=useRef(0);
 const lastSyncedJsonRef=useRef("");
 const syncCreateRef=useRef(false);
 const syncWritingRef=useRef(false);
 const [syncWriteTick,setSyncWriteTick]=useState(0);
 const syncTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
 const stateRef=useRef(state);
 const readyPlansRef=useRef<Set<string>>(new Set());
 const readyPlansInitializedRef=useRef(false);
 function rememberSyncSnapshot(json:string){lastSyncedJsonRef.current=json;writeBrowserStorage("homeos:sync-base:v1",json)}

 useEffect(()=>{stateRef.current=state},[state]);
 useEffect(()=>{
  if(!hydrated)return;
  setState(s=>{
   const next=reconcileWeeklyShopping(reconcileRecipeShopping(s));
   const before=JSON.stringify(s.shopping),after=JSON.stringify(next.shopping);
   return before===after?s:next;
  });
 },[hydrated,state.inventory,state.profile.householdSize,state.members]);
 useEffect(()=>{
  if(!hydrated)return;
  const readyNow=new Set(state.recipePlans.filter(p=>p.status==="saved"&&missing(p.recipe,planningInventory(state,p.id)).length===0).map(p=>p.id));
  if(!readyPlansInitializedRef.current){readyPlansRef.current=readyNow;readyPlansInitializedRef.current=true;return}
  const newlyReady=state.recipePlans.filter(p=>readyNow.has(p.id)&&!readyPlansRef.current.has(p.id));
  readyPlansRef.current=readyNow;
  if(newlyReady.length===1)setToast("Ya tienes todo para "+newlyReady[0].recipe.title);
  else if(newlyReady.length>1)setToast(newlyReady.length+" recetas guardadas ya están listas para cocinar");
 },[hydrated,state.inventory,state.recipePlans]);
 useEffect(()=>{if(!hydrated||demoMode)return;const saved=readBrowserStorage("homeos:device-member");const valid=state.members.slice(0,state.profile.householdSize).some(m=>m.id===saved);const next=valid?saved||"":state.members[0]?.id||"";setDeviceMemberId(next)},[hydrated,state.profile.householdSize,state.members.length]);
 useEffect(()=>{if(hydrated&&!demoMode&&deviceMemberId)writeBrowserStorage("homeos:device-member",deviceMemberId)},[hydrated,deviceMemberId,demoMode]);

 useEffect(()=>{
  let alive=true;
  (async()=>{
   const params=typeof window!=="undefined"?new URLSearchParams(window.location.search):new URLSearchParams();
   const demoParam=params.get("demo");
   const demo=demoParam==="menu"?"menu":demoParam==="ideas"||demoParam==="sin-menu"?"ideas":null;
   if(demo){
    setDemoMode(demo);
    setState(demoState(demo==="menu"));
    setSyncCreds(null);
    setSyncStatus("local");
    if(alive)setHydrated(true);
    return;
   }
   const fresh=params.get("fresh")==="1";
   if(fresh){
    removeBrowserStorage("homeos:v5");
    removeBrowserStorage("homeos:device-member");
    removeBrowserStorage("homeos:quick-guide-seen");
    clearSync();
    removeBrowserStorage("homeos:sync-base:v1");
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
      let base={...DEFAULT,spent:Math.min(local.spent,remoteState.spent),waste:Math.min(local.waste,remoteState.waste),wasteSaved:Math.min(local.wasteSaved,remoteState.wasteSaved)};
      try{const savedBase=readBrowserStorage("homeos:sync-base:v1");if(savedBase)base=normalizeState(JSON.parse(savedBase))}catch{}
      const restored=local.profile.onboardingDone?normalizeState(mergeHouseholdState(base,local,remoteState)):remoteState;
      setSyncCreds(creds);
      syncRevisionRef.current=remote.revision;
      rememberSyncSnapshot(JSON.stringify(remoteState));
      setState(restored);
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
  if(!hydrated||demoMode||!state.profile.onboardingDone||syncCreds||!syncConfigured()||syncCreateRef.current)return;
  syncCreateRef.current=true;
  const snapshot=state;
  setSyncStatus("connecting");
  createRemoteHousehold("Mi hogar",snapshot).then(({creds,revision})=>{
   setSyncCreds(creds);
   syncRevisionRef.current=revision;
   rememberSyncSnapshot(JSON.stringify(snapshot));
   setSyncStatus("synced");
  }).catch(()=>setSyncStatus("error")).finally(()=>{syncCreateRef.current=false});
 },[hydrated,state.profile.onboardingDone,syncCreds,demoMode]);

 useEffect(()=>{
  if(!hydrated||demoMode||typeof window==="undefined")return;
  const json=JSON.stringify(state);
  setStorageError(!writeBrowserStorage("homeos:v5",json));
  if(!syncCreds||!state.profile.onboardingDone||!syncConfigured()||json===lastSyncedJsonRef.current)return;
  if(syncTimerRef.current)clearTimeout(syncTimerRef.current);
  syncTimerRef.current=setTimeout(async()=>{
   if(syncWritingRef.current)return;
   syncWritingRef.current=true;
   const snapshot=stateRef.current;
   const snapshotJson=JSON.stringify(snapshot);
   let saved=false;
   setSyncStatus("connecting");
   try{
    const revision=await writeRemoteHousehold(syncCreds,snapshot,syncRevisionRef.current);
    syncRevisionRef.current=revision;
    rememberSyncSnapshot(snapshotJson);
    saved=true;
    setSyncStatus("synced");
   }catch(err){
    if(err instanceof SyncConflictError){
     try{await resolveSyncConflict(syncCreds);saved=true}catch{setSyncStatus("error")}
    }else setSyncStatus("error");
   }finally{
    syncWritingRef.current=false;
    if(saved&&JSON.stringify(stateRef.current)!==lastSyncedJsonRef.current)setSyncWriteTick(n=>n+1);
   }
  },700);
  return()=>{if(syncTimerRef.current)clearTimeout(syncTimerRef.current)};
 },[state,hydrated,syncCreds,demoMode,syncWriteTick]);

 useEffect(()=>{
  if(!hydrated||demoMode||!syncCreds||!syncConfigured())return;
  let alive=true;
  const pull=async()=>{
   if(document.visibilityState==="hidden")return;
   if(syncWritingRef.current)return;
   if(JSON.stringify(stateRef.current)!==lastSyncedJsonRef.current){setSyncWriteTick(n=>n+1);return}
   const beforeRead=lastSyncedJsonRef.current;
   try{
    const remote=await readRemoteHousehold(syncCreds);
    if(!alive||!remote||remote.revision<=syncRevisionRef.current||syncWritingRef.current||JSON.stringify(stateRef.current)!==beforeRead)return;
    const remoteState=normalizeState(remote.data);
    syncRevisionRef.current=remote.revision;
    rememberSyncSnapshot(JSON.stringify(remoteState));
    setState(remoteState);
    setSyncStatus("synced");
   }catch{if(alive)setSyncStatus("error")}
  };
  const id=window.setInterval(pull,15000);
  window.addEventListener("focus",pull);
  window.addEventListener("online",pull);
  document.addEventListener("visibilitychange",pull);
  return()=>{alive=false;window.clearInterval(id);window.removeEventListener("focus",pull);window.removeEventListener("online",pull);document.removeEventListener("visibilitychange",pull)};
 },[hydrated,syncCreds,demoMode]);

 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(""),2400);return()=>clearTimeout(t)},[toast]);
 useEffect(()=>{
  if(!hydrated||demoMode||!state.profile.onboardingDone||typeof window==="undefined")return;
  if(readBrowserStorage("homeos:quick-guide-seen")!=="1")setTourOpen(true);
 },[hydrated,state.profile.onboardingDone,demoMode]);
 function closeQuickGuide(){
  writeBrowserStorage("homeos:quick-guide-seen","1");
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
   rememberSyncSnapshot(JSON.stringify(remoteState));
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

 async function resolveSyncConflict(creds:SyncCredentials){
  const remote=await readRemoteHousehold(creds);
  if(!remote)throw new Error("sync_remote_missing");
  let base=DEFAULT;
  try{base=normalizeState(JSON.parse(lastSyncedJsonRef.current||"{}"))}catch{}
  const local=stateRef.current;
  const remoteState=normalizeState(remote.data);
  const merged=normalizeState(mergeHouseholdState(base,local,remoteState));
  const revision=await writeRemoteHousehold(creds,merged,remote.revision);
  syncRevisionRef.current=revision;
  rememberSyncSnapshot(JSON.stringify(merged));
  const latest=stateRef.current;
  const next=normalizeState(mergeHouseholdState(local,latest,merged));
  stateRef.current=next;
  setState(next);
  setSyncStatus("synced");
  return revision;
 }

 async function syncNow(){
  if(!syncCreds)return;
  if(syncWritingRef.current){setToast("La sincronización ya está en curso");return}
  syncWritingRef.current=true;
  const snapshot=stateRef.current;
  let saved=false;
  setSyncStatus("connecting");
  try{
   const revision=await writeRemoteHousehold(syncCreds,snapshot,syncRevisionRef.current);
   syncRevisionRef.current=revision;
   rememberSyncSnapshot(JSON.stringify(snapshot));
   saved=true;
   setSyncStatus("synced");
   setToast("Hogar sincronizado");
  }catch(err){
   if(err instanceof SyncConflictError){
    try{await resolveSyncConflict(syncCreds);saved=true;setToast("Cambios de varios dispositivos combinados")}
    catch{setSyncStatus("error");setToast("No se pudo resolver la sincronización")}
   }else{setSyncStatus("error");setToast("No se pudo sincronizar")}
  }finally{syncWritingRef.current=false;if(saved&&JSON.stringify(stateRef.current)!==lastSyncedJsonRef.current)setSyncWriteTick(n=>n+1)}
 }

 const expiring=useMemo(()=>state.inventory.filter(i=>{
  if(i.stock==="falta"||i.location==="Congelador"||i.storageMode==="reserva")return false;
  const date=i.expires||i.estimatedExpires;
  return date?daysUntil(date)<=3:classifyProduct(i.name,i.category).rotation==="alta"&&daysUntil(i.purchasedAt)<=-2;
 }),[state.inventory]);
 const monthKey=localDateIso().slice(0,7);
 const monthlySpent=state.purchaseSessions.length?state.purchaseSessions.filter(x=>x.date.startsWith(monthKey)).reduce((n,x)=>n+x.total,0):state.spent;
 const available=state.budget-monthlySpent;
 const confidence=state.inventory.filter(i=>i.stock!=="incierto").length/Math.max(1,state.inventory.length);

 function ensureRecipePlan(s:AppState,recipe:Recipe,plannedFor?:string,shoppingLinked=false){
  const existing=s.recipePlans.find(p=>p.status==="saved"&&p.recipe.id===recipe.id);
  if(existing){
   return {plans:s.recipePlans.map(p=>p.id===existing.id?{...p,recipe,plannedFor:plannedFor||p.plannedFor,shoppingLinked:p.shoppingLinked||shoppingLinked}:p),planId:existing.id};
  }
  const planId=crypto.randomUUID();
  return {plans:[...s.recipePlans,{id:planId,recipe,createdAt:localDateIso(),plannedFor,status:"saved" as const,shoppingLinked}],planId};
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
   const saved=ensureRecipePlan(s,recipe,plannedFor,true);
   return reconcileRecipeShopping({...s,recipePlans:saved.plans},[saved.planId]);
  });
  setPurchaseUndo({recipeId:recipe.id,title:recipe.title,previous:state.recipePlans.find(p=>p.status==="saved"&&p.recipe.id===recipe.id)});
  const currentPlan=state.recipePlans.find(p=>p.status==="saved"&&p.recipe.id===recipe.id);
  const currentShortages=recipeShortages(recipe.ingredients,planningInventory(state,currentPlan?.id));
  setToast(currentShortages.length?recipe.title+" guardada · Comprar se ha ajustado a lo que realmente falta":"Receta guardada · ya tienes todo para hacerla");
 }
 function unlinkRecipeShopping(recipeId:string,previous?:RecipePlan){
  setState(s=>{
   const ids=s.recipePlans.filter(p=>p.status==="saved"&&p.recipe.id===recipeId).map(p=>p.id);
   const updated={...s,recipePlans:s.recipePlans.map(p=>ids.includes(p.id)?(previous?{...previous,id:p.id}:{...p,shoppingLinked:false}):p),shopping:s.shopping.flatMap(item=>{
    const updated=withShoppingSources(item,shoppingSources(item).filter(src=>!src.planId||!ids.includes(src.planId)));
    return updated?[updated]:[];
   })};
   return previous?.shoppingLinked?reconcileRecipeShopping(updated,ids):updated;
  });
  setPurchaseUndo(null);setToast("Añadido a la compra deshecho · la receta sigue guardada");
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
  const ids=cart.map(i=>i.id),today=localDateIso();
  setState(s=>completePurchase(s,ids,total,activeStore,today));
  setShoppingActive(false);setActiveStore("");setToast(`${cart.length} productos guardados como compra reciente`);
 }

 if(!hydrated)return <div className="app-loading"><div className="app-loading-mark">H</div><strong>HomeOS</strong></div>;
 if(!state.profile.onboardingDone)return <Onboarding state={state} setState={setState} connectHome={connectHome} syncStatus={syncStatus}/>;

 return <div className={demoMode?"app-shell demo-mode":"app-shell"}>
  {storageError&&<div className="storage-error" role="alert">No se pueden guardar los cambios en este navegador. Revisa el espacio o los permisos de almacenamiento antes de cerrar HomeOS.</div>}
  <aside className="sidebar">
   <div className="brand">{logo()}<div><strong>HomeOS</strong><span>Tu cocina, sin carga mental</span></div></div>
   <nav>
    {nav.map(n=><button key={n.id} className={view===n.id?"nav active":"nav"} onClick={()=>{if(n.id==="casa")setCasaFocus("all");if(n.id==="comer"){setComerFocus("catalog");setMealSeed("")}setView(n.id)}}>{navIcon(n.id,n.icon)}{n.label}</button>)}
    <button className={view==="habitos"?"nav active":"nav"} onClick={()=>{setView("habitos")}}><span className="nav-icon nav-icon-habits" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 18c2.5-6 5-9 7-12 2 3 4.5 6 7 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M7 15h10M9 11h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></span>Hábitos</button>
   </nav>
   <button className="profile settings-entry" onClick={()=>setProfileOpen(true)}><span>⚙</span><div><strong>Configuración</strong><small>Hogar y preferencias</small></div></button>
  </aside>

  <main className="main">
   <header className={view==="inicio"?"topbar home-topbar":"topbar"}>{view!=="inicio"&&<div className="topbar-title"><span className="topbar-logo">{logo()}</span><div><span className="eyebrow">{fmtDate()}</span><h1>{view==="habitos"?"Hábitos":nav.find(n=>n.id===view)?.label}</h1></div></div>}<div className="top-actions">{syncCreds&&<span className={`sync-pill ${syncStatus}`} title="Estado de sincronización del hogar; no es el estado de la IA">{syncStatus==="synced"?"● Hogar sincronizado":syncStatus==="connecting"?"↻ Guardando hogar":syncStatus==="error"?"! Hogar sin conexión":"Hogar local"}</span>}{view==="inicio"?<button className="notification-button" onClick={()=>setToast("No tienes avisos nuevos")} aria-label="Avisos" title="Avisos"><svg viewBox="0 0 24 24"><path d="M6.5 16.5h11l-1.5-2V10a4 4 0 0 0-8 0v4.5l-1.5 2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 19a2.2 2.2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></button>:<button className="help-button" onClick={()=>setTourOpen(true)} aria-label="Ver guía rápida" title="Ver guía rápida">?</button>}<button className="avatar" onClick={()=>setProfileOpen(true)}>FR</button></div></header>
   {view==="inicio"&&<Inicio state={state} setState={setState} expiring={expiring} confidence={confidence} available={available} setView={setView} setCasaFocus={setCasaFocus} openRecipeIdea={(title)=>{setComerFocus("ideas");setMealSeed(title);setView("comer")}} openNewRecipe={()=>{setComerFocus("catalog");setMealSeed("");setView("comer")}} scanTicket={()=>{setView("comprar");setTicketCameraRequest(v=>v+1)}} openHabits={()=>{setView("habitos")}} openThemes={()=>{setComerFocus("themes");setView("comer")}} openProfile={()=>setProfileOpen(true)} notify={()=>setToast("No tienes avisos nuevos")} demoMode={demoMode}/>} 
   {view==="habitos"&&<section className="stack"><div className="page-intro"><div><span className="eyebrow">HÁBITOS</span><h2>Cómo comemos</h2><p>Compras, consumo confirmado y tendencias del hogar, reunidos en un mismo lugar.</p></div></div><article className="list-card consumption-start-card"><div><h3>Ritmo de consumo del hogar</h3><p>{state.profile.consumptionHabits?.length?state.profile.consumptionHabits.length+" hábitos iniciales · las cantidades confirmadas tienen prioridad":"Configura un punto de partida breve; las compras por sí solas no confirman consumo."}</p></div><button className="secondary" onClick={()=>setConsumptionSetupOpen(true)}>Ajustar hábitos</button></article><Habitos state={state}/></section>}
   {view==="comer"&&<Comer state={state} setState={setState} addFromRecipe={addFromRecipe} saveRecipePlan={saveRecipePlan} cancelRecipePlan={cancelRecipePlan} unlinkRecipeShopping={unlinkRecipeShopping} setToast={setToast} mealSeed={mealSeed} clearMealSeed={()=>setMealSeed("")} focusTab={comerFocus} clearFocusTab={()=>setComerFocus(null)}/>}
   {view==="comprar"&&<Comprar state={state} setState={setState} addFromRecipe={addFromRecipe} activeStore={activeStore} setActiveStore={setActiveStore} shoppingActive={shoppingActive} setShoppingActive={setShoppingActive} finishShopping={finishShopping} receiptRef={receiptRef} setToast={setToast} deviceMemberId={deviceMemberId} setDeviceMemberId={setDeviceMemberId} cameraRequest={ticketCameraRequest}/>}
   {view==="casa"&&<Casa state={state} setState={setState} setToast={setToast} focus={casaFocus} clearFocus={()=>setCasaFocus("all")} openRecipes={(name)=>{setComerFocus("ideas");setMealSeed(name);setView("comer")}}/>}
   {view==="finanzas"&&<Finanzas state={state} setState={setState} available={available} monthlySpent={monthlySpent}/>}
  </main>

  <nav className="bottom-nav">{nav.filter(n=>n.id!=="finanzas").map(n=><button key={n.id} className={view===n.id?"active":""} onClick={()=>{if(n.id==="casa")setCasaFocus("all");if(n.id==="comer"){setComerFocus("catalog");setMealSeed("")}setMobileMoreOpen(false);setView(n.id)}}>{navIcon(n.id,n.icon)}<small>{n.label}</small></button>)}<button className={mobileMoreOpen||view==="finanzas"||view==="habitos"?"active more-tab": "more-tab"} onClick={()=>setMobileMoreOpen(v=>!v)}><span className="more-dots">•••</span><small>Más</small></button></nav>
  {mobileMoreOpen&&<div className="mobile-more-backdrop" onMouseDown={()=>setMobileMoreOpen(false)}><div className="mobile-more-sheet" onMouseDown={e=>e.stopPropagation()}><div className="mobile-more-handle"/><button onClick={()=>{setView("finanzas");setMobileMoreOpen(false)}}><span className="more-icon finance">▥</span><div><strong>Finanzas</strong><small>Gasto, presupuesto y categorías</small></div><b>›</b></button>{state.profile.nutrition!=="off"&&<button onClick={()=>{setView("habitos");setMobileMoreOpen(false)}}><span className="more-icon habits">◴</span><div><strong>Hábitos</strong><small>Cómo está comiendo el hogar</small></div><b>›</b></button>}<button onClick={()=>{setProfileOpen(true);setMobileMoreOpen(false)}}><span className="more-icon settings">⚙</span><div><strong>Configuración</strong><small>Hogar, preferencias y sincronización</small></div><b>›</b></button></div></div>}
  {consumptionSetupOpen&&<div className="modal-backdrop"><section className="modal confirm-stock-modal"><div className="modal-head"><h2>Tu ritmo habitual</h2><button aria-label="Cerrar hábitos iniciales" onClick={()=>setConsumptionSetupOpen(false)}>×</button></div><ConsumptionSetup state={state} setState={setState} finish={()=>setConsumptionSetupOpen(false)}/></section></div>}
  {profileOpen&&<ProfileModal state={state} setState={setState} close={()=>setProfileOpen(false)} syncCreds={syncCreds} syncStatus={syncStatus} connectHome={connectHome} copyHomeCode={copyHomeCode} syncNow={syncNow} deviceMemberId={deviceMemberId} setDeviceMemberId={setDeviceMemberId} setToast={setToast}/>}
  {tourOpen&&<QuickStartGuide close={closeQuickGuide}/>}
  {purchaseUndo&&<div className="purchase-undo" role="status"><span><strong>Receta vinculada a la compra</strong>{purchaseUndo.title}</span><button onClick={()=>unlinkRecipeShopping(purchaseUndo.recipeId,purchaseUndo.previous)}>Deshacer</button><button aria-label="Cerrar aviso de compra" onClick={()=>setPurchaseUndo(null)}>×</button></div>}
  {toast&&<div className="toast" role="status" aria-live="polite"><span>✓</span>{toast}</div>}
 </div>
}

const STARTER_HABITS:ConsumptionHabit[]=[{id:"habit-leche",name:"Leche",qty:1,unit:"L",days:7},{id:"habit-huevos",name:"Huevos",qty:6,unit:"uds",days:7},{id:"habit-fruta",name:"Manzana",qty:6,unit:"uds",days:7},{id:"habit-pollo",name:"Pechuga de pollo",qty:1,unit:"kg",days:7}];
function ConsumptionSetup({state,setState,finish}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;finish:()=>void}){
 const [habits,setHabits]=useState<ConsumptionHabit[]>(state.profile.consumptionHabits||[]);
 function update(id:string,key:"qty"|"days"|"unit",value:string){setHabits(xs=>xs.map(h=>h.id===id?{...h,[key]:key==="unit"?value:Number(value)}:h))}
 function save(){setState(s=>({...s,profile:{...s.profile,consumptionSetupDone:true,consumptionHabits:habits.filter(h=>Number.isFinite(h.qty)&&h.qty>0&&Number.isFinite(h.days)&&h.days>0)}}));finish()}
 return <section className="consumption-setup"><span className="eyebrow">PUNTO DE PARTIDA · OPCIONAL</span><h2>¿Qué gastáis habitualmente?</h2><p>Selecciona solo lo que conoces. Son cantidades para todo el hogar; no se añaden a Casa ni se dan por consumidas.</p><div className="habit-starter-choices">{STARTER_HABITS.map(h=><button className={habits.some(x=>x.id===h.id)?"secondary active":"secondary"} key={h.id} onClick={()=>setHabits(xs=>xs.some(x=>x.id===h.id)?xs.filter(x=>x.id!==h.id):[...xs,h])}>{h.name}</button>)}</div>{habits.map(h=><div className="habit-starter-row" key={h.id}><strong>{h.name}</strong><label>Cantidad<input type="number" min="0.1" step="any" value={h.qty} onChange={e=>update(h.id,"qty",e.target.value)}/></label><label>Unidad<select value={h.unit} onChange={e=>update(h.id,"unit",e.target.value)}><option>L</option><option>kg</option><option>g</option><option>uds</option><option>bricks</option></select></label><label>Cada cuántos días<input type="number" min="1" max="365" value={h.days} onChange={e=>update(h.id,"days",e.target.value)}/></label></div>)}<div className="meal-actions"><button className="primary" onClick={save}>Guardar y continuar</button><button className="secondary" onClick={()=>{setState(s=>({...s,profile:{...s.profile,consumptionSetupDone:true}}));finish()}}>Ahora no</button></div><p>Después podrás corregirlo en Hábitos. Los tickets y las cantidades reales confirmadas ajustarán esta orientación.</p></section>
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
  <div className="onboarding-progress"><span style={{width:`${((step+1)/6)*100}%`}}/></div>
  {step===0&&<div className="ob-panel"><span className="eyebrow">PRIMERA CONFIGURACIÓN</span><h1>¿Cuántas personas viven en casa?</h1><p>HomeOS adapta cantidades y nivel de incertidumbre al tamaño del hogar.</p><div className="number-grid">{[1,2,3,4,5,6].map(n=><button key={n} className={state.profile.householdSize===n?"choice active":"choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,householdSize:n},members:ensureMembers(s.members,n)}))}>{n}</button>)}</div></div>}
  {step===1&&<div className="ob-panel"><span className="eyebrow">RITMO DE COMPRA</span><h1>¿Cómo soléis comprar?</h1><div className="goal-grid">{[["diaria","Casi cada día"],["semanal","Compra semanal"],["quincenal","Cada dos semanas"],["mensual","Compra grande mensual"],["mixta","Compra grande + compras rápidas"]].map(([id,label])=><button key={id} className={state.profile.shoppingCycle===id?"goal-choice active":"goal-choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,shoppingCycle:id as Profile["shoppingCycle"]}}))}><strong>{label}</strong></button>)}</div></div>}
  {step===2&&<div className="ob-panel"><span className="eyebrow">COCINA</span><h1>¿Cómo quieres cocinar normalmente?</h1><div className="goal-grid">{[["rapido","Voy con prisas","Ideas de 5–20 min."],["normal","Cocino normal","Equilibrio entre tiempo y variedad."],["cocinar","Me gusta cocinar","Recetas más completas."],["mealprep","Preparo varios días","Raciones, nevera y congelador."]].map(([id,label,desc])=><button key={id} className={state.profile.cooking===id?"goal-choice active":"goal-choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,cooking:id as CookingStyle}}))}><strong>{label}</strong><span>{desc}</span></button>)}</div></div>}
  {step===3&&<div className="ob-panel"><span className="eyebrow">HÁBITOS</span><h1>¿Quieres que HomeOS aprenda cómo compra el hogar?</h1><div className="goal-grid">{[["basica","Sí, enséñame tendencias","Proteína, verdura, fruta, carbohidratos y snacks a partir de compras reales."],["off","No necesito esta parte","Casa, compra y recetas funcionarán igual."]].map(([id,label,desc])=><button key={id} className={state.profile.nutrition===id?"goal-choice active":"goal-choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,nutrition:id as NutritionMode}}))}><strong>{label}</strong><span>{desc}</span></button>)}</div></div>}
  {step===4&&<div className="ob-panel"><span className="eyebrow">TIENDAS</span><h1>¿Dónde compráis?</h1><p>Opcional. Si no quieres configurarlo ahora, HomeOS usará “Compra general”.</p><div className="market-grid">{SUPERMARKETS.map(m=><button key={m} className={state.profile.supermarkets.includes(m)?"choice active":"choice"} onClick={()=>toggleMarket(m)}>{m}</button>)}</div></div>}
  {step===5&&<div className="ob-panel"><ConsumptionSetup state={state} setState={setState} finish={()=>setState(s=>({...s,profile:{...s.profile,onboardingDone:true}}))}/></div>}
  <div className="ob-actions"><button className="secondary" disabled={step===0} onClick={()=>setStep(x=>Math.max(0,x-1))}>Atrás</button>{step<5?<button className="primary" onClick={()=>setStep(x=>x+1)}>Continuar</button>:null}</div>{step===0&&<button className="onboarding-skip" onClick={()=>setState(s=>({...s,profile:{...s.profile,onboardingDone:true}}))}>Entrar rápido · lo configuro después</button>}
  <div className="existing-home">{!joinOpen?<button className="join-link" onClick={()=>setJoinOpen(true)}>Ya tengo HomeOS en otro dispositivo</button>:<div className="join-box"><div><strong>Conectar con mi hogar</strong><small>Pega el código que aparece en HomeOS del otro dispositivo.</small></div><input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="HOS1.…"/><button className="primary" disabled={!joinCode.trim()||syncStatus==="connecting"} onClick={joinExisting}>{syncStatus==="connecting"?"Conectando…":"Conectar"}</button>{joinError&&<span className="form-error">{joinError}</span>}<button className="join-cancel" onClick={()=>{setJoinOpen(false);setJoinError("")}}>Cancelar</button></div>}</div>
 </div></div>
}

function QuickStartGuide({close}:{close:()=>void}){
 const steps=[
  ["Inicio","Lo urgente de casa: compra, caducidades, preparados y próximos eventos."],
  ["Comer","Ideas, aprovechamiento y propuestas temáticas usando inventario, gustos y tiempo. También avisa si una receta contiene algo que alguien evita."],
  ["Comprar","Apunta por voz o texto. HomeOS separa frases largas, añade lo claro y deja lo ambiguo para revisar."],
  ["Casa","Consulta lo que probablemente queda, añade cualquier faltante directamente a la lista y corrige solo cuando haga falta."],
  ["Finanzas","Ve gasto mensual, categorías y desperdicio sin llevar otra contabilidad aparte."]
 ];
 return <div className="modal-backdrop quick-guide-backdrop" onMouseDown={close}><div className="quick-guide" onMouseDown={e=>e.stopPropagation()}>
  <div className="quick-guide-head">{logo()}<div><small>HOMEOS EN 30 SEGUNDOS</small><h2>La app trabaja por ti</h2><p>No necesitas mantener un inventario perfecto. Compra, corrige excepciones y consulta.</p></div><button onClick={close} aria-label="Cerrar">×</button></div>
  <div className="quick-guide-steps">{steps.map(([name,desc],i)=><article key={name}><span>{i+1}</span><div><strong>{name}</strong><p>{desc}</p></div></article>)}</div>
  <div className="quick-guide-bottom"><span>Durante las primeras 4 semanas aprenderá vuestro ritmo con tickets y confirmaciones. Las estimaciones mejoran cuanto más precisas sean las compras.</span><button className="primary" onClick={close}>Entendido · entrar</button></div>
 </div></div>
}

function MiniAgenda({state,onOpen}:{state:AppState;onOpen:()=>void}){
 const today=new Date();
 const year=today.getFullYear(),month=today.getMonth();
 const first=(new Date(year,month,1).getDay()+6)%7;
 const days=new Date(year,month+1,0).getDate();
 const todayIso=`${year}-${String(month+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
 const events=state.events.filter(e=>e.date>=todayIso).slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
 const eventDays=new Set(state.events.filter(e=>e.date.startsWith(`${year}-${String(month+1).padStart(2,"0")}`)).map(e=>Number(e.date.slice(-2))));
 const monthLabel=new Intl.DateTimeFormat("es-ES",{month:"long",year:"numeric"}).format(today);
 return <article className="home-mini-agenda">
  <div className="home-card-head"><div><small>AGENDA DE HOY</small><strong>{monthLabel.charAt(0).toUpperCase()+monthLabel.slice(1)}</strong></div><button onClick={onOpen}>Ver mes →</button></div>
  <div className="home-mini-agenda-body">
   <div className="home-mini-calendar" onClick={onOpen}>
    <div className="home-mini-weekdays">{["L","M","X","J","V","S","D"].map(d=><span key={d}>{d}</span>)}</div>
    <div className="home-mini-days">{Array.from({length:first}).map((_,i)=><span key={"b"+i}/>)}
     {Array.from({length:days},(_,i)=>i+1).map(d=><button key={d} className={(d===today.getDate()?"today ":"")+(eventDays.has(d)?"has-event":"")} onClick={e=>{e.stopPropagation();onOpen()}}>{d}</button>)}
    </div>
   </div>
   <div className="home-mini-events">{events.length?events.map(ev=><button key={ev.id} onClick={onOpen}><time>{ev.time||new Date(ev.date+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</time><span>{ev.title}</span><b>›</b></button>):<button className="empty" onClick={onOpen}>Sin eventos próximos · añadir uno</button>}
   </div>
  </div>
  <button className="home-mini-add" onClick={onOpen}>＋ Añadir evento</button>
 </article>
}

function Inicio({state,setState,expiring,confidence,available,setView,setCasaFocus,openRecipeIdea,openNewRecipe,scanTicket,openHabits,openThemes,openProfile,notify,demoMode}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;expiring:InventoryItem[];confidence:number;available:number;setView:(v:View)=>void;setCasaFocus:(v:"all"|"expiring"|"prepared"|"reserve")=>void;openRecipeIdea:(title:string,slot?:WeeklyMenuPlan["slots"][number])=>void;openNewRecipe:()=>void;scanTicket:()=>void;openHabits:()=>void;openThemes:()=>void;openProfile:()=>void;notify:()=>void;demoMode:"menu"|"ideas"|null}){
 const [now,setNow]=useState(()=>new Date());
 const [calendarOpen,setCalendarOpen]=useState(false);
 const [weather,setWeather]=useState<number|null>(null);
 useEffect(()=>{const id=window.setInterval(()=>setNow(new Date()),60000);return()=>window.clearInterval(id)},[]);
 useEffect(()=>{
  let active=true;
  fetch("https://api.open-meteo.com/v1/forecast?latitude=41.5486&longitude=2.1074&current=temperature_2m&timezone=Europe%2FMadrid")
   .then(r=>r.ok?r.json():Promise.reject())
   .then(data=>{const value=Number(data?.current?.temperature_2m);if(active&&Number.isFinite(value))setWeather(Math.round(value))})
   .catch(()=>{});
  return()=>{active=false};
 },[]);
 const localIso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
 const todayIso=localIso(now);
 const pending=state.shopping.filter(i=>i.status==="pendiente").length;
 const readyServings=state.inventory.filter(i=>i.category==="Preparados"&&i.stock!=="falta").reduce((n,i)=>n+(i.servings||i.qty||0),0);
 const homeInventory=planningInventory(state);
 const householdDislikes=state.members.slice(0,state.profile.householdSize).flatMap(m=>m.dislikes.split(/[,;\n]/).map(x=>norm(x.trim())).filter(Boolean));
 const computedHomeIdeas=RECIPES.map(r=>{
  const miss=missing(r,homeInventory);
  const text=norm([r.title,...r.ingredients.map(i=>i.name)].join(" "));
  const blocked=householdDislikes.some(d=>d&&text.includes(d));
  const urgentHits=expiring.filter(item=>r.ingredients.some(ing=>norm(ing.key).includes(norm(item.name))||norm(item.name).includes(norm(ing.key))||norm(ing.name).includes(norm(item.name)))).length;
  return {r,miss,blocked,urgentHits};
 }).filter(x=>!x.blocked).sort((a,b)=>a.miss.length-b.miss.length||b.urgentHits-a.urgentHits||a.r.time-b.r.time).filter((x,i,a)=>a.findIndex(y=>y.r.image===x.r.image)===i).slice(0,4);
 const demoIdeaIds=["x28","x07","x21"];
 const homeIdeas=demoMode==="ideas"?demoIdeaIds.map(id=>RECIPES.find(r=>r.id===id)).filter(Boolean).map(r=>({r:r as Recipe,miss:missing(r as Recipe,homeInventory),blocked:false,urgentHits:0})):computedHomeIdeas;

 const hour=now.getHours();
 const primaryName=(state.members[0]?.name||"").trim();
 const showName=primaryName&&!["tu","tú","yo","miembro 1"].includes(norm(primaryName));
 const greetingName=showName?primaryName:"Fran";
 const greeting=(hour<6?"Buenas noches":hour<12?"Buenos días":hour<20?"Buenas tardes":"Buenas noches")+", "+greetingName;
  const habitBalance=habitBalanceSignals(state);
 const habitLearning=habitBalance.every(x=>x.tone==="learning");
 const currentMonthKey=todayIso.slice(0,7);
 const monthSpent=state.purchaseSessions.length?state.purchaseSessions.filter(x=>x.date.startsWith(currentMonthKey)).reduce((n,x)=>n+x.total,0):state.spent;
 const openCalendar=()=>{setCalendarOpen(true);requestAnimationFrame(()=>setTimeout(()=>document.querySelector(".apple-calendar")?.scrollIntoView({behavior:"smooth",block:"start"}),60))};
 const primaryIdea=homeIdeas[0];

 return <section className="home-final">
  <div className="home-mobile-brand"><div className="home-mobile-brand-id">{logo()}<div><strong>HomeOS</strong><small>Tu cocina, sin carga mental</small></div></div><div className="home-mobile-brand-actions"><button className="notification-button" onClick={notify} aria-label="Avisos"><svg viewBox="0 0 24 24"><path d="M6.5 16.5h11l-1.5-2V10a4 4 0 0 0-8 0v4.5l-1.5 2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 19a2.2 2.2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></button><button className="avatar" onClick={openProfile}>FR</button></div></div>
  <header className="home-final-head">
   <div><span className="eyebrow">{new Intl.DateTimeFormat("es-ES",{weekday:"long",day:"numeric",month:"long"}).format(now)}</span><h2>{greeting}.</h2><p>Todo bajo control. Aquí tienes tu resumen de hoy.</p></div>
   <div className="home-weather"><span>{hour>=20||hour<7?"☾":"☀"}</span><div><strong>{demoMode?18+"°C":weather!==null?weather+"°C":now.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</strong><small>{demoMode||weather!==null?"Sabadell":"Ahora"}</small></div></div>
  </header>

  <section className="home-final-top">
   <article className="home-final-menu">
    <div className="home-card-head home-menu-head"><div><strong>Ideas para hoy</strong><small>Recetas según lo que tienes en casa</small></div><button onClick={openNewRecipe}>Ver todas ›</button></div>
    <div className="home-final-ideas">{homeIdeas.slice(0,3).map(({r,miss})=><button key={r.id} onClick={()=>openRecipeIdea(r.title)}><img src={r.image} alt="" loading="lazy" onError={e=>{if(!e.currentTarget.src.endsWith("/recipe-placeholder.svg"))e.currentTarget.src="/recipe-placeholder.svg"}}/><div><strong>{r.title}</strong><span>{r.time} min · {miss.length?miss.length+" por completar":"✓ puedes hacerlo"}</span></div><b>›</b></button>)}
      <div className="home-no-menu-actions"><button onClick={()=>setView("comer")}>Ver recetas</button></div>
    </div>
   </article>
   <article className="home-theme-card"><img className="home-theme-photo" src={themeRecipes(themeForMonth().id,RECIPES)[0]?.image||"/recipe-images/x20.webp"} alt={themeRecipes(themeForMonth().id,RECIPES)[0]?.title||"Pizza"}/><span>{themeForMonth().icon}</span><div><small>DESCUBRE ESTE MES</small><strong>{themeForMonth().title}</strong><p>Descubre platos diferentes y elige lo que te apetece.</p></div><button onClick={openThemes}>Explorar ›</button></article>
  </section>

   <article className="home-final-actions">
    <div className="home-card-head"><div><small>ACCESOS RÁPIDOS</small><strong>Hazlo en un toque</strong></div></div>
    <div className="home-final-action-grid">
     <button onClick={()=>openRecipeIdea("Quiero una cena rápida")}><span>⚡</span><strong>Cenas rápidas</strong></button>
     <button onClick={openNewRecipe}><span>＋</span><strong>Nueva receta</strong></button>
     <button onClick={scanTicket}><span>▣</span><strong>Escanear ticket</strong></button>
     <button onClick={()=>{setCasaFocus("all");setView("casa")}}><span>⌂</span><strong>Añadir a Casa</strong></button>
     <button onClick={openThemes}><span>🍣</span><strong>Cocinas del mundo</strong></button>
    </div>
   </article>

  <section className="home-final-mid">
   <div className="home-final-summary">
    <div className="home-card-head"><div><small>TU CASA HOY</small><strong>Resumen rápido</strong></div></div>
    <div className="home-final-summary-grid">
     <button onClick={()=>setView("comprar")}><span>🛒</span><small>COMPRA</small><strong>{pending}</strong><em>{pending===1?"pendiente":"pendientes"}</em></button>
     <button className={expiring.some(i=>i.dateType==="caducidad"&&daysUntil(i.expires)<0)?"urgent":""} onClick={()=>{setCasaFocus("expiring");setView("casa")}}><span>🍃</span><small>USAR PRONTO</small><strong>{expiring.length}</strong><em>{expiring[0]?expiring[0].name+" · "+(expiring[0].expires?"fecha real":"fecha estimada"):"sin urgencias"}</em></button>
     <button onClick={()=>{setCasaFocus("prepared");setView("casa")}}><span><svg width="26" height="26" viewBox="0 0 32 32" role="img" aria-label="Comida preparada en táper"><rect x="4" y="10" width="24" height="5" rx="2.5" fill="#82b59c" stroke="#315c43" strokeWidth="1.5"/><path d="M6 15h20l-2 12H8Z" fill="#e9f3ec" stroke="#315c43" strokeWidth="1.5"/><path d="M11 20h10M12 23h8" stroke="#b58448" strokeWidth="2" strokeLinecap="round"/><path d="M12 7c-2-2 2-3 0-5M20 7c-2-2 2-3 0-5" fill="none" stroke="#648774" strokeWidth="1.5" strokeLinecap="round"/></svg></span><small>PREPARADO</small><strong>{readyServings}</strong><em>{readyServings===1?"ración":"raciones"}</em></button>
     <button onClick={()=>setView("finanzas")}><span>↗</span><small>ESTE MES</small><strong>{monthSpent.toFixed(0)} €</strong><em>{state.budget>0?Math.max(0,state.budget-monthSpent).toFixed(0)+" € disponibles":"ver finanzas"}</em></button>
    </div>
   </div>

   {state.profile.nutrition!=="off"&&<article className="home-final-habits">
    <div className="home-card-head"><div><small>HÁBITOS ALIMENTARIOS (7 DÍAS)</small><strong>{habitLearning?"Aprendiendo":"Equilibrio reciente"}</strong></div><button onClick={openHabits}>Ver detalle →</button></div>
    <div className="home-final-habit-grid">{habitBalance.map(x=><button key={x.key} className={"tone-"+x.tone} onClick={openHabits}>{habitIcon(x.key)}<div><strong>{x.label}</strong><span className="habit-meter" aria-label={x.tone==="learning"?"Aún faltan comidas registradas":Math.round(x.ratio*100)+"% de comidas registradas"}><i style={{width:Math.round(x.ratio*100)+"%"}}/></span><em>{x.status}</em></div></button>)}</div>
   </article>}
  </section>

  <section className="home-final-bottom">
   <MiniAgenda state={state} onOpen={openCalendar}/>
   {primaryIdea&&<article className="home-final-recommend">
    <img src={primaryIdea.r.image} alt="" loading="lazy" onError={e=>{if(!e.currentTarget.src.endsWith("/recipe-placeholder.svg"))e.currentTarget.src="/recipe-placeholder.svg"}}/>
    <div><small>RECETA RECOMENDADA</small><strong>{primaryIdea.r.title}</strong><p>{primaryIdea.miss.length?primaryIdea.miss.length+" ingredientes por completar":"Ideal para hoy con lo que tienes en casa."}</p><span>{primaryIdea.r.time} min · {primaryIdea.r.difficulty}</span><button onClick={()=>openRecipeIdea(primaryIdea.r.title)}>Ver receta →</button></div>
   </article>}

  </section>

  {calendarOpen&&<CalendarCard state={state} setState={setState}/>}
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
    <div className="apple-calendar-top-actions"><div className="apple-calendar-legend"><span className="legend-dot today-dot"/>Hoy <span className="legend-dot event-dot"/>Evento</div><button className="calendar-add-event" onClick={()=>{setSelectedDate(selectedDate||todayIso);setSelectedEventId("");requestAnimationFrame(()=>eventInputRef.current?.focus())}}>＋ Añadir evento</button></div>
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
      <form className="event-compose" onSubmit={e=>{e.preventDefault();add()}}><label htmlFor="calendar-event-date">Fecha</label><input id="calendar-event-date" className="event-date-input" type="date" value={selectedDate} onChange={e=>{const value=e.target.value;setSelectedDate(value);if(value){const d=new Date(value+"T12:00:00");setCursor(new Date(d.getFullYear(),d.getMonth(),1))}}}/><label htmlFor="calendar-event-input">Evento</label><div className="event-compose-row"><input ref={eventInputRef} id="calendar-event-input" value={title} onChange={e=>setTitle(e.target.value)} enterKeyHint="send" autoComplete="off" placeholder="Ej. comida familiar"/><button type="submit" disabled={!title.trim()||!selectedDate}>Guardar</button></div><small>En iPhone/iPad la fecha usa el selector nativo del sistema.</small></form></>:<div className="event-empty"><span>＋</span><strong>Selecciona un día</strong><p>Haz clic en cualquier fecha para añadir o ver eventos.</p></div>}
    </aside>
   </div>
  </article>
}

function Comer({state,setState,addFromRecipe,saveRecipePlan,cancelRecipePlan,unlinkRecipeShopping,setToast,mealSeed,clearMealSeed,focusTab,clearFocusTab}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;addFromRecipe:(r:Recipe,plannedFor?:string)=>void;saveRecipePlan:(r:Recipe,plannedFor?:string)=>void;cancelRecipePlan:(planId:string)=>void;unlinkRecipeShopping:(recipeId:string)=>void;setToast:(s:string)=>void;mealSeed:string;clearMealSeed:()=>void;focusTab:"ideas"|"aprovechar"|"themes"|"catalog"|null;clearFocusTab:()=>void}){
 const [mode,setMode]=useState<CookingStyle>(state.profile.cooking);
 const [themePeriod,setThemePeriod]=useState<"week"|"month">("month");
 const featuredTheme=themeForPeriod(themePeriod);
 const [tab,setTab]=useState<"ideas"|"aprovechar"|"themes"|"catalog"|"saved">("ideas");
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
 const [catalogCountry,setCatalogCountry]=useState("Todos");
 const [catalogQuery,setCatalogQuery]=useState("");
 const [selectedScaledRecipe,setSelectedScaledRecipe]=useState<Recipe|null>(null);
 const [preparedDestination,setPreparedDestination]=useState<Location>("Nevera");
 const [editRecipe,setEditRecipe]=useState(false);
 const [recipeScope,setRecipeScope]=useState<"casa"|"planear">("casa");
 useEffect(()=>{if(mealSeed){
  setCraving(mealSeed);
  setTab("ideas");clearMealSeed();
 }},[mealSeed]);
 useEffect(()=>{if(focusTab){setTab(focusTab);setOpen(false);setReuseOpen(false);setSelectedRecipeId(null);setSelectedScaledRecipe(null);setCatalogQuery("");setCatalogCountry("Todos");setCraving("");clearFocusTab();window.scrollTo({top:0})}},[focusTab]);
 const discoveryRecipes=useMemo(()=>RECIPES.filter(r=>recipeAllowed(r,{inventory:[],dislikes:state.members.slice(0,state.profile.householdSize).flatMap(m=>m.dislikes.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean)),tools:[],people:state.profile.householdSize})),[state.members,state.profile.householdSize ]);
 const allRecipes=useMemo(()=>[...RECIPES,...state.recipePlans.map(p=>p.recipe),...aiRecipes].filter((r,i,a)=>a.findIndex(x=>x.id===r.id)===i),[state.recipePlans,aiRecipes]);
 const recipeVisual=(r:Recipe,kind:"thumb"|"hero"="thumb")=>{
  const fallback="/recipe-placeholder.svg";
  return <img title={r.photoCaption} src={r.image||fallback} alt={kind==="hero"?r.title:""} loading="lazy" decoding="async" onError={e=>{const img=e.currentTarget;if(!img.src.endsWith(fallback))img.src=fallback}}/>;
 };
 const options=useMemo(()=>allRecipes.filter(r=>r.mode.includes(mode)).map(r=>({r,score:score(r,planningInventory(state,state.recipePlans.find(p=>p.status==="saved"&&p.recipe.id===r.id)?.id))})).sort((a,b)=>b.score-a.score).map(x=>x.r),[allRecipes,mode,state.inventory,state.recipePlans,state.weeklyMenu]);
 const pool=options.length?options:allRecipes;
 const autoRecipe=pool[index%pool.length];
 const recipe=selectedScaledRecipe||(selectedRecipeId?allRecipes.find(r=>r.id===selectedRecipeId):undefined)||autoRecipe;
 const recipeShoppingLinked=state.recipePlans.some(p=>p.status==="saved"&&p.recipe.id===recipe.id&&p.shoppingLinked);
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
 const missingForQuery=(r:Recipe)=>{const ownPlan=state.recipePlans.find(p=>p.status==="saved"&&p.recipe.id===r.id);return missing(r,planningInventory(state,ownPlan?.id)).filter(ing=>!confirmedForQuery(ing))};
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
 const catalogBase=allRecipes;
 const catalogRecipes=catalogBase.filter(r=>(catalogCountry==="Todos"||recipeCountryLabel(r.country)===catalogCountry)&&matchesRecipeSearch(r,catalogQuery)).sort((a,b)=>Number(matchesRecipeSearch({title:b.title,ingredients:[]},catalogQuery))-Number(matchesRecipeSearch({title:a.title,ingredients:[]},catalogQuery)));
 const catalogCountries=[...new Set(allRecipes.map(r=>recipeCountryLabel(r.country)))].sort();
 const availableTools=recipe.toolGroups?.length?recipe.toolGroups.map(group=>group.join(" o ")):(recipe.tools||[]).filter(t=>state.profile.kitchenTools.includes(t));
 const dislikers=state.members.slice(0,state.profile.householdSize).map(member=>{
  const dislikes=member.dislikes.split(/[,;\n]/).map(x=>norm(x.trim())).filter(Boolean);
  const matches=recipe.ingredients.filter(i=>dislikes.some(d=>norm(i.name).includes(d)||d.includes(norm(i.key))||norm(i.key).includes(d))).map(i=>i.name);
  return {name:member.name,matches};
 }).filter(x=>x.matches.length);

 const reuseInventory=planningInventory(state);
 const reuseIdeasBase=REUSE_IDEAS.map(idea=>{
  const matched=idea.needs.filter(n=>needAvailable(reuseInventory,n)).length;
  const mentionedHits=mentionedProducts.filter(p=>idea.needs.some(n=>norm(n.key).includes(norm(p.canonical))||norm(p.canonical).includes(norm(n.key))||norm(n.label).includes(norm(p.canonical)))).length;
  return {...idea,matched,ready:matched===idea.needs.length,mentionedHits};
 }).sort((a,b)=>Number(b.ready)-Number(a.ready)||b.mentionedHits-a.mentionedHits||b.matched-a.matched);
 const reuseIdeas=mentionedProducts.length?reuseIdeasBase.filter(x=>requireAllMentioned?x.mentionedHits===mentionedProducts.length:x.mentionedHits>0):reuseIdeasBase;
 const selectedReuse=REUSE_IDEAS.find(x=>x.id===selectedReuseId)||reuseIdeas[0];
 const expiringForReuse=reuseInventory.filter(usableInventoryItem).filter(i=>daysUntil(i.expires)<=5||i.stock==="mucho").sort((a,b)=>daysUntil(a.expires)-daysUntil(b.expires)).slice(0,6);
 const preferenceMembers=state.members.slice(0,state.profile.householdSize).filter(m=>m.dislikes.trim());
 const savedPlans=state.recipePlans.filter(p=>p.status==="saved").map(p=>({...p,missing:missing(p.recipe,planningInventory(state,p.id))})).sort((a,b)=>(a.plannedFor||"9999").localeCompare(b.plannedFor||"9999")||a.createdAt.localeCompare(b.createdAt));
 function adaptIngredient(index:number,name:string,qty?:string){
  const old=recipe.ingredients[index];const nextName=name.trim()||old.name;
  const ingredients=recipe.ingredients.map((i,n)=>n===index?{...i,name:nextName,key:norm(nextName),qty:qty??i.qty}:i);
  setSelectedScaledRecipe({...recipe,ingredients,adapted:true,photoCaption:"Foto de la receta original · ingredientes adaptados",steps:recipe.steps.map(step=>name.trim()?step.replaceAll(old.name,nextName):step)});
 }
 function omitIngredient(index:number){
  if(recipe.ingredients.length<=1){setToast("Mantén al menos un ingrediente en la receta");return}
  const name=recipe.ingredients[index].name;
  setSelectedScaledRecipe({...recipe,adapted:true,ingredients:recipe.ingredients.filter((_,n)=>n!==index),omittedIngredients:[...(recipe.omittedIngredients||[]),name],photoCaption:"Foto de la receta original · ingredientes adaptados"});
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
     inv=inv.map((i,idx)=>idx===existing?{...i,qty:i.qty+out.qty,stock:"hay",purchasedAt:localDateIso(),preparedAt:localDateIso()}:i);
    }else{
     inv=[{id:crypto.randomUUID(),name:out.name,qty:out.qty,unit:out.unit,location:out.location,category:out.category,subcategory:profile.subcategory,stock:"hay",purchasedAt:localDateIso(),preparedAt:localDateIso(),source:"receta"},...inv];
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
  recognition.lang="es-ES";recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=3;
  let transcript="";
  setMealListening(true);
  recognition.onresult=(e:any)=>{
   for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)transcript+=(transcript?" ":"")+e.results[i][0].transcript;
   setCraving(transcript);
   const spoken=norm(transcript);
   if(/sushi|japones|italiana|tematica|descubrir/.test(spoken)){setTab("themes");setToast("Explora propuestas a tu ritmo")}
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
    mode,
    scope:recipeScope
   },p=>{setAiProgress(p.progress);setAiProgressText(p.text)});
   const mapped:Recipe[]=generated.map((r,idx)=>{
    const visual="/recipe-placeholder.svg";
    return {
    id:"local-ai-"+Date.now()+"-"+idx,
    title:r.title,
    image:visual,
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
   };
   });
   setAiRecipes(mapped);
   if(mapped[0]){setSelectedScaledRecipe(null);setSelectedRecipeId(mapped[0].id)}
   setToast(mapped.length+" "+(mapped.length===1?"idea creada":"ideas creadas")+" con IA local");
  }catch(err:any){
   setAiError(localAiErrorMessage(err));
  }finally{
   setAiLoading(false);
  }
 }
 function chooseRecipe(r:Recipe){
  setTab("ideas");
  setEditRecipe(false);setSavePreparedAfter(false);
  setSelectedScaledRecipe(r);setSelectedRecipeId(r.id);
  setMode(r.mode.includes(mode)?mode:r.mode[0]);
  setIndex(0);
 }
 function completeRecipe(servingsToStore=0){
  if(recipe.ingredients.some(i=>!i.name.trim()||(parseQty(i.qty)?.amount||0)<=0)){setToast("Revisa las cantidades y unidades antes de confirmar");return}
  let wasExact=true;
  setState(s=>{
   const consumed=consumeRecipeIngredients(s.inventory,recipe.ingredients,s);
   wasExact=consumed.exact;
   let inventory=consumed.inventory;
   const today=localDateIso();
   if(servingsToStore>0){
    const existing=inventory.findIndex(i=>norm(i.name)===norm(recipe.title)&&i.category==="Preparados"&&i.location===preparedDestination);
    if(existing>=0)inventory=inventory.map((i,idx)=>idx===existing?{...i,qty:i.qty+servingsToStore,servings:(i.servings||i.qty)+servingsToStore,stock:"hay",preparedAt:today,purchasedAt:today,source:mode==="mealprep"?"mealprep":i.source,mealPrepInitialServings:mode==="mealprep"?(i.mealPrepInitialServings||i.servings||i.qty)+servingsToStore:i.mealPrepInitialServings,mealPrepDays:i.mealPrepDays,mealPrepStart:mode==="mealprep"?(i.mealPrepStart||today):i.mealPrepStart,preparedRecipeId:recipe.id,preparedIngredients:recipe.ingredients.map(x=>({name:x.name,key:x.key,category:inferCategory(x.name)}))}:i);
    else inventory=[{id:crypto.randomUUID(),name:recipe.title+(recipe.adapted?" (adaptada)":""),qty:servingsToStore,unit:"raciones",location:preparedDestination,category:"Preparados",subcategory:"Preparado",stock:"hay",purchasedAt:today,preparedAt:today,servings:servingsToStore,source:mode==="mealprep"?"mealprep":"receta",mealPrepInitialServings:mode==="mealprep"?servingsToStore:undefined,mealPrepStart:mode==="mealprep"?today:undefined,preparedRecipeId:recipe.id,preparedIngredients:recipe.ingredients.map(x=>({name:x.name,key:x.key,category:inferCategory(x.name)}))},...inventory];
   }
   const eatenServings=Math.max(0,recipe.servings-servingsToStore);
   const mealHistory=eatenServings>0?[...s.mealHistory,{
    id:crypto.randomUUID(),date:today,recipeId:recipe.id,title:recipe.title+(recipe.adapted?" (adaptada)":""),servings:eatenServings,
    ingredients:recipe.ingredients.map(i=>({name:i.name,key:i.key,category:inferCategory(i.name)}))
   }]:s.mealHistory;
   const completedPlanIds=s.recipePlans.filter(p=>p.recipe.id===recipe.id).map(p=>p.id);
   const releasedInventory=inventory.map(i=>({...i,planReservations:(i.planReservations||[]).filter(r=>!r.planId||!completedPlanIds.includes(r.planId))}));
   return reconcileWeeklyShopping({...s,inventory:releasedInventory,mealHistory,recipePlans:s.recipePlans.filter(p=>p.recipe.id!==recipe.id)});
  });
  setOpen(false);setSavePreparedAfter(false);setSelectedScaledRecipe(null);
  setToast(servingsToStore>0?(wasExact?"Ingredientes descontados · preparado guardado":"Preparado guardado · revisa una cantidad"):(wasExact?"Ingredientes descontados del inventario":"Ingredientes actualizados · hay una cantidad por revisar"));
 }

 return <section className="stack">
  <div className="page-intro"><div><span className="eyebrow">COMER</span><h2>Qué te apetece y qué puedes hacer</h2><p>Decide si quieres cocinar con Casa ahora o planear algo para lo que puedes comprar ingredientes.</p></div><div className="view-tabs eat-tabs"><button className={tab==="ideas"?"active":""} onClick={()=>setTab("ideas")}>Ideas para comer</button><button className={tab==="aprovechar"?"active":""} onClick={()=>setTab("aprovechar")}>Aprovechar</button><button className={tab==="themes"?"active":""} onClick={()=>setTab("themes")}>Descubrir</button><button className={tab==="catalog"?"active":""} onClick={()=>{setTab("catalog");setCatalogQuery("")}}>Recetario</button><button className={tab==="saved"?"active":""} onClick={()=>setTab("saved")}>Guardadas · {savedPlans.length}</button></div></div>
  {preferenceMembers.length>0&&<div className="meal-household-strip"><span>✓</span><p><b>Preferencias activas:</b> HomeOS tiene en cuenta lo que no gusta a {preferenceMembers.map(m=>m.name).join(", ")} al ordenar y avisar sobre recetas.</p></div>}
  {(tab==="ideas"||tab==="saved")&&savedPlans.length>0&&<section className="saved-recipe-plans"><div className="saved-recipe-head"><div><small>PARA OTRO MOMENTO</small><h3>Recetas que no quieres perder</h3></div><span>{savedPlans.length}</span></div><div className="saved-recipe-grid">{(tab==="saved"?savedPlans:savedPlans.slice(0,3)).map(p=><article className={p.missing.length?"saved-recipe-card":"saved-recipe-card ready"} key={p.id}><button className="saved-recipe-main" onClick={()=>{chooseRecipe(p.recipe);setCraving("")}}><img src={RECIPES.find(r=>r.id===p.recipe.id)?.image||(p.recipe.source==="local-ai"?"/recipe-placeholder.svg":p.recipe.image)} alt="" loading="lazy" onError={e=>{if(!e.currentTarget.src.endsWith("/recipe-placeholder.svg"))e.currentTarget.src="/recipe-placeholder.svg"}}/><div><strong>{p.recipe.title}</strong><small>{p.plannedFor?new Date(p.plannedFor+"T12:00:00").toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short"}):"Sin fecha"} · {p.missing.length?p.missing.length+" por comprar":"✓ lista para cocinar"}</small></div></button><div className="saved-recipe-actions">{p.shoppingLinked?<button onClick={()=>unlinkRecipeShopping(p.recipe.id)}>Quitar de la compra</button>:p.missing.length>0?<button onClick={()=>addFromRecipe(p.recipe,p.plannedFor)}>Añadir faltantes</button>:<button onClick={()=>{chooseRecipe(p.recipe);setOpen(true)}}>Preparar</button>}<button className="remove-plan" onClick={()=>cancelRecipePlan(p.id)} aria-label="Quitar receta guardada">×</button></div></article>)}</div></section>}

  {tab==="saved"&&savedPlans.length===0&&<article className="friendly-empty"><h3>Aún no has guardado recetas</h3><p>Pulsa «Guardar para luego» en una receta. Aparecerá aquí.</p><button className="primary" onClick={()=>setTab("catalog")}>Explorar recetario</button></article>}
  {tab==="catalog"&&<section className="full-recipe-catalog"><div className="recipe-catalog-head"><div><span className="eyebrow">RECETARIO COMPLETO</span><h3>{catalogRecipes.length} recetas</h3></div><label>Buscar recetas<input value={catalogQuery} onChange={e=>setCatalogQuery(e.target.value)} placeholder="Plato, ingrediente o país · español, català, English"/></label><label>País<select value={catalogCountry} onChange={e=>setCatalogCountry(e.target.value)}><option>Todos</option>{catalogCountries.map(c=><option key={c}>{c}</option>)}</select></label></div><div className="full-recipe-grid">{catalogRecipes.map(r=><button className="full-recipe-card" key={r.id} onClick={()=>{chooseRecipe(r);setTab("ideas");setCraving("");window.scrollTo({top:0})}}>{recipeVisual(r)}<div><strong>{r.title}</strong><span>{recipeCountryLabel(r.country)} · {r.time} min · {r.servings} raciones</span><small>{missingForQuery(r).length+" ingredientes por completar"}</small></div></button>)}</div>{!catalogRecipes.length&&<p role="status">No hay coincidencias. Prueba otro ingrediente o selecciona todos los países.</p>}</section>}
  {tab==="ideas"?<>
   <article className="meal-request">
    <div><small>¿QUÉ TE APETECE?</small><h3>Dilo o escríbelo como hablarías en casa</h3><p>Ej.: “Tengo leche y yogur y quiero aprovechar ambos” o “quiero una cena rápida con pollo”.</p></div>
    <div className="meal-query-input"><input value={craving} onChange={e=>setCraving(e.target.value)} enterKeyHint="search" placeholder="Tengo leche y yogur, quiero aprovechar ambos…"/><button className={mealListening?"meal-mic listening":"meal-mic"} onClick={startMealVoice} aria-label="Hablar">{mealListening?"…":micIcon()}</button></div>
    {mentionedProducts.length>0&&<div className="meal-confirmed-products">{mentionedProducts.map(p=><span key={p.canonical}>✓ {p.canonical} <small>{state.inventory.some(i=>productMatchesNeed(i,p.canonical))?"en Casa":"confirmado por ti para esta consulta"}</small></span>)}</div>}
    {craving.trim()&&<div className="meal-request-results">{cravingMatches.length?cravingMatches.slice(0,4).map(r=><button key={r.id} onClick={()=>{chooseRecipe(r);setCraving("")}}><span>{productIcon(r.ingredients[0]?.name||r.title,inferCategory(r.ingredients[0]?.name||""))}</span><div><strong>{r.title}</strong><small>{missingForQuery(r).length?String(missingForQuery(r).length)+" ingredientes por completar":"Puedes hacerlo con lo que has confirmado"}</small></div><b>›</b></button>):<div className="recipe-empty">No hay una coincidencia exacta en las recetas disponibles. La IA local puede crear opciones nuevas sin enviar tus datos a una API de pago.</div>}</div>}
    <div className="local-ai-meals">
     <div><small>IA LOCAL · SIN COSTE POR USO</small><strong>Crea recetas nuevas en tu propio dispositivo</strong><p>Primero descarga un modelo y lo guarda en la caché del navegador. Genera en el dispositivo, sin pagar por petición. Necesita WebGPU, espacio y memoria; puede ir lento o fallar. El recetario sigue disponible.</p></div>
     {localAiSupported()?<button className="local-ai-run" disabled={aiLoading} onClick={runLocalAI}>{aiLoading?"Preparando "+aiProgress+"%":"✦ Generar con IA local"}</button>:<span className="local-ai-unavailable">Este navegador usará el libro local de recetas.</span>}
     {aiLoading&&<div className="local-ai-progress"><span style={{width:aiProgress+"%"}}/><small>{aiProgressText}</small></div>}
     {aiError&&<p className="local-ai-error">{aiError}</p>}
    </div>
   </article>

   <div className="recipe-scope-switch"><button className={recipeScope==="casa"?"active":""} onClick={()=>setRecipeScope("casa")}><span>🏠</span><div><strong>Con lo que tengo</strong><small>Prioriza recetas que puedes hacer ya o casi.</small></div></button><button className={recipeScope==="planear"?"active":""} onClick={()=>setRecipeScope("planear")}><span>🛒</span><div><strong>Planear · puedo comprar</strong><small>Busca por apetencia aunque falten ingredientes.</small></div></button></div>

   <div className="mode-row meal-modes">{[["rapido","⚡ Rápido"],["normal","🍽 Normal"],["cocinar","👨‍🍳 Cocinar"],["mealprep","🍱 Cocinar varias raciones"]].map(([id,label])=><button key={id} className={mode===id?"active":""} onClick={()=>{setMode(id as CookingStyle);setIndex(0);setSelectedScaledRecipe(null);setSelectedRecipeId(null)}}>{label}</button>)}</div>

   <div className="recipe-options-head"><div><small>CON LO QUE TIENES</small><h3>{mode==="mealprep"?"Opciones para preparar varias raciones":"Varias opciones, no solo una"}</h3></div><button className="recipe-catalog-toggle" onClick={()=>{setTab("catalog");setCatalogQuery("");setCatalogCountry("Todos");window.scrollTo({top:0})}}>Ver todas · {allRecipes.length} recetas</button></div>
   <div className="recipe-option-grid">{suggestions.map(r=>{const rm=missingForQuery(r);return <button className={recipe.id===r.id?"recipe-option selected":"recipe-option"} key={r.id} onClick={()=>chooseRecipe(r)}>{recipeVisual(r)}<div><strong>{r.title}</strong><span>{r.time} min · {r.servings} {r.servings===1?"ración":"raciones"}</span><small className={rm.length?"needs":"ready"}>{rm.length?String(rm.length)+" por completar":"✓ Puedes hacerlo"}</small></div></button>})}</div>

   {mode==="mealprep"&&<p className="prepared-note">Varias raciones filtra recetas fáciles de repartir en tuppers. No crea una semana ni descuenta comida. Al terminar puedes guardar lo preparado en nevera o congelador.</p>}
   <article className="featured-meal">{recipeVisual(recipe,"hero")}<div className="featured-copy"><span className="eyebrow">{miss.length?String(miss.length)+" INGREDIENTES POR COMPLETAR":"PUEDES HACERLO YA"}</span><h3>{recipe.title}</h3><p>{recipe.description}</p>{recipe.photoCaption&&<small className="recipe-photo-caption">{recipe.photoCaption}</small>}<div className="chips"><span>{recipe.time} min</span><span>{recipe.difficulty}</span><span>{recipe.servings} raciones</span></div>{availableTools.length>0&&<div className="recipe-tools"><small>{recipe.toolGroups?.length?"NECESITAS ESTOS EQUIPOS":"PUEDES HACERLA CON"}</small>{availableTools.map(t=><span key={t}>{t}</span>)}</div>}{(recipe.adapted||recipe.nutritionUnavailable)?<div className="ai-recipe-note"><b>{recipe.adapted?"Ingredientes adaptados":"Receta detallada"}</b><span>Sin estimación nutricional verificada.</span></div>:recipe.source==="local-ai"?<div className="ai-recipe-note"><b>✦ IA local</b><span>Receta generada en tu dispositivo · revisa cantidades y cocción antes de preparar.</span></div>:<div className="macro-row"><b>{recipe.calories} kcal</b><span>{recipe.protein}g proteína</span><span>{recipe.carbs}g carbos</span><span>{recipe.fat}g grasas</span><small>por ración · estimación</small></div>}
    {dislikers.length>0&&<div className="family-warning">{dislikers.map((d,i)=><span key={d.name}>⚠ {d.name==="Tú"?"Has marcado que no te gusta":("A "+d.name+" no le gusta")} {d.matches.join(", ")}{i<dislikers.length-1?".":""}</span>)}</div>}
    <div className="meal-actions"><button className="secondary" onClick={()=>addFromRecipe(recipe)} disabled={!miss.length||recipeShoppingLinked}>{recipeShoppingLinked?"Faltantes en la compra":"Añadir faltantes a la compra"}</button>{state.recipePlans.some(p=>p.status==="saved"&&p.recipe.id===recipe.id&&p.shoppingLinked)&&<button className="secondary" onClick={()=>unlinkRecipeShopping(recipe.id)}>Deshacer añadido a compra</button>}<button className="primary" onClick={()=>setOpen(true)}>Preparar esta receta</button><button className="secondary" onClick={()=>saveRecipePlan(recipe)}>Guardar para luego</button><button className="secondary" onClick={()=>{setSelectedScaledRecipe(null);setSelectedRecipeId(null);setIndex(i=>i+1)}}>Siguiente idea</button></div><div className="recipe-plan-when"><span>Si no es para ahora:</span><button onClick={()=>miss.length?addFromRecipe(recipe,isoAfterDays(1)):saveRecipePlan(recipe,isoAfterDays(1))}>Mañana{miss.length?" + compra":""}</button><button onClick={()=>miss.length?addFromRecipe(recipe,weekendPlanIso()):saveRecipePlan(recipe,weekendPlanIso())}>Este finde{miss.length?" + compra":""}</button>{miss.length>0&&<button className="buy-missing-plan" onClick={()=>addFromRecipe(recipe)}>Sin fecha + añadir faltantes</button>}</div></div></article>

   <div className="ingredient-summary clearer"><article><small>YA TIENES EN CASA</small><strong>{recipe.ingredients.length-miss.length} de {recipe.ingredients.length}</strong>{recipe.ingredients.filter(i=>!miss.some(m=>m.name===i.name)).map(i=><span key={i.name}>✓ {i.name}</span>)}</article><article><small>NECESITAS PARA COMPLETARLA</small><strong>{miss.length?String(miss.length)+" ingredientes":"Nada"}</strong>{miss.length?miss.map(i=><span key={i.name}>• {i.name}</span>):<span>✓ Está todo listo</span>}<button onClick={()=>addFromRecipe(recipe)} disabled={!miss.length||recipeShoppingLinked}>{recipeShoppingLinked?"Faltantes en la compra":miss.length?"Añadir faltantes a la compra":"Ya tienes todo"}</button></article></div>

   <article className="use-more-card"><div><small>APROVECHAR PRODUCTO</small><h3>¿Qué quieres gastar antes?</h3><p>Escribe un producto que tengas de sobra y te mostramos recetas donde realmente se usa.</p></div><input value={useMuch} onChange={e=>setUseMuch(e.target.value)} placeholder="Ej. leche, tomates, huevos…"/>{useMuch&&<div className="recipe-mini-list">{filtered.length?filtered.slice(0,4).map(r=><button key={r.id} onClick={()=>{chooseRecipe(r);setUseMuch("")}}><strong>{r.title}</strong><span>{r.time} min · {missing(r,planningInventory(state)).length?String(missing(r,planningInventory(state)).length)+" por completar":"puedes hacerlo ya"}</span></button>):<div className="recipe-empty">No hay una receta preparada con ese ingrediente todavía.</div>}</div>}</article>
  </>:tab==="aprovechar"?<>
   <article className="reuse-hero"><div><small>APROVECHAMIENTO INTELIGENTE</small><h3>Ideas para gastar, transformar y no tirar</h3><p>Dilo por voz si quieres: “tengo leche y yogur y quiero usar los dos”. Los ingredientes que confirmas tú mandan sobre una estimación antigua del inventario.</p><div className="reuse-query"><input value={craving} onChange={e=>setCraving(e.target.value)} placeholder="Ej. tengo tomates y queso y quiero gastar ambos"/><button className={mealListening?"meal-mic listening":"meal-mic"} onClick={startMealVoice}>{mealListening?"…":micIcon()}</button></div>{mentionedProducts.length>0&&<div className="meal-confirmed-products">{mentionedProducts.map(p=><span key={p.canonical}>✓ {p.canonical}</span>)}</div>}</div><span>♻️</span></article>

   {expiringForReuse.length>0&&<div className="reuse-priority"><div className="recipe-options-head"><div><small>GASTAR PRIMERO</small><h3>Productos que merecen atención</h3></div></div><div className="reuse-priority-grid">{expiringForReuse.map(i=><button key={i.id} onClick={()=>{const found=reuseIdeas.find(x=>reuseIdeaMatchesProduct(x,i.name,i.category));if(found){setSelectedReuseId(found.id);setReuseOpen(true)}}}><span>{productIcon(i.name,i.category)}</span><div><strong>{i.name}</strong><small>{i.expires&&daysUntil(i.expires)<=5?("Fecha próxima · "+Math.max(0,daysUntil(i.expires))+" días"):i.stock==="mucho"?"Hay bastante":"Conviene revisar"}</small></div><b>›</b></button>)}</div></div>}

   <div className="reuse-section-head"><div><small>CON LO QUE HAY EN CASA</small><h3>Aprovechar o transformar</h3><p>Las ideas listas aparecen primero. Las demás te enseñan qué ingrediente falta.</p></div></div>
   <div className="reuse-grid">{reuseIdeas.map(idea=><article className={idea.ready?"reuse-card ready":"reuse-card"} key={idea.id}><div className="reuse-card-top"><span>{idea.icon}</span><em>{idea.kind==="transformar"?"Transformar":"Aprovechar"}</em></div><h3>{idea.title}</h3><p>{idea.summary}</p><div className="reuse-needs">{idea.needs.map(n=><span className={needAvailable(reuseInventory,n)?"have":hasNeed(reuseInventory,n)?"some":"missing"} key={n.key}>{needAvailable(reuseInventory,n)?"✓":hasNeed(reuseInventory,n)?"~":"+"} {n.label}</span>)}</div><div className="reuse-card-foot"><small>{idea.ready?"Puedes hacerlo con lo que tienes":idea.matched+" de "+idea.needs.length+" ingredientes"}</small><button onClick={()=>{setSelectedReuseId(idea.id);setReuseOpen(true)}}>{idea.ready?"Ver cómo":"Ver idea"}</button></div></article>)}</div>
  </>:tab==="themes"?<section className="recipe-theme-list"><div className="page-intro"><div><span className="eyebrow">COCINAS DEL MUNDO</span><h3>{themePeriod==="week"?"Esta semana":"Este mes"}: {featuredTheme.title}</h3><div className="view-tabs"><button className={themePeriod==="week"?"active":""} onClick={()=>setThemePeriod("week")}>Por semanas</button><button className={themePeriod==="month"?"active":""} onClick={()=>setThemePeriod("month")}>Por meses</button></div><p>Ideas de inspiración casera; el país destacado rota según el periodo. Elige lo que te apetezca: explorar no añade compras ni consume alimentos.</p></div></div>{[featuredTheme,...RECIPE_THEMES.filter(t=>t.id!==featuredTheme.id)].map(theme=><article className="list-card" key={theme.id}><div className="theme-title"><span>{theme.icon}</span><div><h3>{theme.title}</h3><p>{theme.description}</p></div></div><div className="theme-recipe-grid">{themeRecipes(theme.id,discoveryRecipes).map(r=><button key={r.id} onClick={()=>{chooseRecipe(r);setTab("ideas");setCraving("")}}>{recipeVisual(r)}<span><strong>{r.title}</strong><small>{r.time} min · {missing(r,planningInventory(state)).length} por completar</small>{r.photoCaption&&<small>{r.photoCaption.includes("orientativa")?"Foto orientativa":"Imagen generada"}</small>}</span></button>)}</div></article>)}</section>:null} 


  {open&&<div className="modal-backdrop"><div className="modal recipe-modal"><div className="modal-head"><div><span className="eyebrow">PREPARAR</span><h2>{recipe.title}</h2>{availableTools.length>0&&<small className="modal-tool-note">{recipe.toolGroups?.length?"Necesitas":"Compatible con"} {availableTools.join(" · ")}</small>}</div><button onClick={()=>setOpen(false)}>×</button></div><div className="recipe-cols"><div><h4>Ingredientes</h4><button className="secondary" onClick={()=>setEditRecipe(!editRecipe)}>{editRecipe?"Terminar cambios":"Cambiar ingredientes"}</button>{editRecipe?<><p>Indica lo que vas a usar y su cantidad. Revisa los pasos al sustituir un ingrediente; las calorías originales dejan de ser válidas.</p>{recipe.ingredients.map((i,index)=><div className="ingredient-edit" key={index}><label>Ingrediente {index+1}<input value={i.name} onChange={e=>adaptIngredient(index,e.target.value)}/></label><label>Cantidad y unidad<input value={i.qty} onChange={e=>adaptIngredient(index,i.name,e.target.value)}/></label><button className="secondary" onClick={()=>omitIngredient(index)}>No lo usaré</button></div>)}</>:recipe.ingredients.map(i=><p key={i.name}>{i.qty} · {i.name}</p>)}</div><div><h4>Pasos</h4>{recipe.omittedIngredients?.length? <p className="prepared-note">No usarás {recipe.omittedIngredients.join(", ")}. Adapta los pasos que lo mencionen; estos ingredientes no se descontarán.</p>:null}{recipe.steps.map((s,i)=><p key={s}><b>{i+1}.</b> {s}</p>)}</div></div>{recipe.source==="local-ai"||recipe.adapted||recipe.nutritionUnavailable?<div className="recipe-total"><span>{recipe.adapted?"Receta adaptada":recipe.nutritionUnavailable?"Receta detallada":"Receta generada localmente"}</span><b>Sin cálculo nutricional automático</b></div>:<div className="recipe-total"><span>Total receta</span><b>≈ {recipe.calories*recipe.servings} kcal · {recipe.protein*recipe.servings}g proteína</b></div>}{!savePreparedAfter?<div className="recipe-finish-actions"><button className="secondary" onClick={()=>completeRecipe(0)}>Comido ahora</button><button className="primary" onClick={()=>{setLeftoverServings(Math.max(1,recipe.servings));setSavePreparedAfter(true)}}>Guardar para después</button></div>:<div className="save-prepared-after"><div><span>¿Cuántas raciones guardas?</span><p>Solo se crea un preparado si realmente queda comida para otro momento.</p></div><label>Guardar en<select value={preparedDestination} onChange={e=>setPreparedDestination(e.target.value as Location)}><option>Nevera</option><option>Congelador</option></select></label><div className="stepper"><button onClick={()=>setLeftoverServings(n=>Math.max(1,n-1))}>−</button><b>{leftoverServings}</b><button onClick={()=>setLeftoverServings(n=>Math.min(recipe.servings,n+1))}>+</button></div><button className="primary" onClick={()=>completeRecipe(leftoverServings)}>Guardar {leftoverServings} {leftoverServings===1?"ración":"raciones"}</button></div>}</div></div>}
  {reuseOpen&&selectedReuse&&<div className="modal-backdrop" onMouseDown={()=>setReuseOpen(false)}><div className="modal recipe-modal reuse-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">{selectedReuse.kind==="transformar"?"TRANSFORMAR":"APROVECHAR"}</span><h2>{selectedReuse.title}</h2><p>{selectedReuse.summary}</p></div><button onClick={()=>setReuseOpen(false)}>×</button></div><div className="reuse-modal-grid"><div><h4>Vas a usar</h4>{selectedReuse.needs.map(n=><p key={n.key}><b>{n.amount} {n.unit}</b> · {n.label} <span className={needAvailable(reuseInventory,n)?"need-ok":hasNeed(reuseInventory,n)?"need-some":"need-missing"}>{needAvailable(reuseInventory,n)?"✓":hasNeed(reuseInventory,n)?"cantidad insuficiente":"falta"}</span></p>)}{selectedReuse.optional?.length?<><h4>Opcional</h4>{selectedReuse.optional.map(x=><p key={x}>+ {x}</p>)}</>:null}</div><div><h4>Cómo hacerlo</h4>{selectedReuse.steps.map((s,i)=><p key={s}><b>{i+1}.</b> {s}</p>)}</div></div>{selectedReuse.safety&&<div className={selectedReuse.safetyLevel==="attention"?"reuse-safety attention":"reuse-safety"}><b>Seguridad alimentaria</b><span>{selectedReuse.safety}</span></div>}{selectedReuse.output&&<div className="reuse-output"><span>Resultado en Casa</span><strong>{selectedReuse.output.name} · {selectedReuse.output.qty} {selectedReuse.output.unit}</strong></div>}<button className="primary modal-save" disabled={!selectedReuse.needs.every(n=>needAvailable(reuseInventory,n))} onClick={completeReuse}>Hecho · actualizar inventario</button></div></div>}

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
function Comprar({state,setState,addFromRecipe,activeStore,setActiveStore,shoppingActive,setShoppingActive,finishShopping,receiptRef,setToast,deviceMemberId,setDeviceMemberId,cameraRequest}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;addFromRecipe:(r:Recipe,plannedFor?:string)=>void;activeStore:string;setActiveStore:(s:string)=>void;shoppingActive:boolean;setShoppingActive:(b:boolean)=>void;finishShopping:(total?:number)=>void;receiptRef:React.RefObject<HTMLInputElement|null>;setToast:(s:string)=>void;deviceMemberId:string;setDeviceMemberId:(id:string)=>void;cameraRequest:number}){
 const [quick,setQuick]=useState("");
 const [suggestionsOpen,setSuggestionsOpen]=useState(false);
 const [dismissedSuggestions,setDismissedSuggestions]=useState<string[]>([]);
 const [lastDismissed,setLastDismissed]=useState<string|null>(null);
 const suggestionTouch=useRef<{id:string;x:number;y:number}|null>(null);
 const [alreadyHave,setAlreadyHave]=useState<ShoppingItem|null>(null);
 const [haveQty,setHaveQty]=useState("");
 const [haveLocation,setHaveLocation]=useState<Location>("Despensa");
 function confirmAlreadyHave(){
  const qty=Number(haveQty.replace(",","."));if(!alreadyHave||!Number.isFinite(qty)||qty<=0)return;
  const item=alreadyHave;const profile=classifyProduct(item.name,item.category);
  if(!canStoreAt(item.name,item.category,haveLocation)){setToast(storageWarning(item.name,item.category,haveLocation));return}
  setState(s=>{const matches=s.inventory.filter(i=>norm(classifyProduct(i.name,i.category).canonical)===norm(profile.canonical)&&i.location===haveLocation&&normalizedUnit(i.unit)===normalizedUnit(item.unit));
   const id=matches[0]?.id||crypto.randomUUID();
   const inventory=[...s.inventory.filter(i=>!matches.some(x=>x.id===i.id)),{...matches[0],id,name:item.name,qty,unit:item.unit,location:haveLocation,category:item.category,subcategory:item.subcategory,stock:"hay" as const,purchasedAt:matches[0]?.purchasedAt||isoAfterDays(0),purchaseDateUnknown:!matches[0]||matches[0].purchaseDateUnknown,lastConfirmedAt:isoAfterDays(0),lastStockCheckId:crypto.randomUUID(),estimateAnchorDate:isoAfterDays(0),estimateAnchorQty:qty}];
   const shopping=s.shopping.flatMap(i=>{if(i.id!==item.id)return [i];const sources=remainingSourcesAfterPurchase(shoppingSources(i),qty,item.unit);const updated=withShoppingSources(i,sources);return updated?[updated]:[]});
   return reconcileWeeklyShopping({...s,inventory,shopping,stockChecks:appendConfirmedStockCheck(s.stockChecks,inventory,inventory.find(i=>i.id===id)!,isoAfterDays(0))});
  });setAlreadyHave(null);setToast("Cantidad confirmada en Casa · no se registra como compra");
 }
 const [productChoice,setProductChoice]=useState<{raw:string;name:string;qty:number;unit:string;supermarket?:string;options:ReturnType<typeof productSuggestions>}|null>(null);
 const [storeFilter,setStoreFilter]=useState("Todos");
 const [newStoreName,setNewStoreName]=useState("");
 const [addingStore,setAddingStore]=useState(false);
 const [manageStores,setManageStores]=useState(false);
 const [editingStore,setEditingStore]=useState<string|null>(null);
 const [editStoreName,setEditStoreName]=useState("");
 const [shoppingIntentFilter,setShoppingIntentFilter]=useState<"todos"|"habitual"|"planes">("todos");
 const [purchaseTotal,setPurchaseTotal]=useState("");
 const [receiptName,setReceiptName]=useState("");
 const [shoppingListening,setShoppingListening]=useState(false);
 const shoppingRecognitionRef=useRef<any>(null);
 const shoppingTranscriptRef=useRef("");
 const shoppingInterimRef=useRef("");
 const shoppingListeningRef=useRef(false);
 useEffect(()=>()=>{shoppingListeningRef.current=false;shoppingRecognitionRef.current?.abort()},[]);
 const [ocrStatus,setOcrStatus]=useState<"idle"|"reading"|"ready"|"error">("idle");
 const [ocrProgress,setOcrProgress]=useState(0);
 const [ocrItems,setOcrItems]=useState<ReceiptCandidate[]>([]);
 const [ocrTotal,setOcrTotal]=useState<number|undefined>(undefined);
 const [ocrPhotoCount,setOcrPhotoCount]=useState(0);
 const receiptCameraRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(cameraRequest>0)requestAnimationFrame(()=>setTimeout(()=>receiptCameraRef.current?.click(),60))},[cameraRequest]);
 const members=state.members.slice(0,state.profile.householdSize);
 const currentMember=members.find(m=>m.id===deviceMemberId)||members[0];
 const requestedBy=currentMember?.name||"Tú";
 const estimatedTotal=state.shopping.filter(i=>i.status==="carrito").reduce((sum,item)=>{
  const canonical=norm(classifyProduct(item.name,item.category).canonical);
  const last=[...state.purchaseHistory].reverse().find(x=>typeof x.price==="number"&&x.qty>0&&norm(classifyProduct(x.name,x.category).canonical)===canonical);
  if(!last||typeof last.price!=="number")return sum;
  return sum+(last.price/Math.max(.01,last.qty))*(item.boughtQty??item.qty);
 },0);
 const recommendedMissing=state.inventory.filter(i=>{
  if(i.storageMode==="reserva"||i.category==="Preparados")return false;
  if(dismissedSuggestions.includes(i.id))return false;
  if(state.shopping.some(q=>norm(classifyProduct(q.name,q.category).canonical)===norm(classifyProduct(i.name,i.category).canonical)))return false;
  return inventoryEstimate(state,i).prob<.32;
 });
 const pendingRecipePlans=state.recipePlans.filter(p=>p.status==="saved").map(p=>({...p,missing:missing(p.recipe,planningInventory(state,p.id))})).filter(p=>p.missing.length>0);
 const recipeShoppingItems=state.shopping.filter(i=>i.status==="pendiente"&&shoppingSources(i).some(src=>src.type==="recipe")).length;


 function addOne(rawInput:string,forcedName?:string){
  let value=normalizeSpokenShoppingText(rawInput.trim());if(!value)return;
  let supermarket:string|undefined;
  const lower=norm(value);
  for(const s of state.profile.supermarkets){
   if(s!=="Otro supermercado"&&lower.includes(norm(s))){
    supermarket=s;value=value.replace(new RegExp(s,"i"),"").trim();break;
   }
  }
  const parsed=parseShoppingQuantity(value);
  const {qty,unit}=parsed;
  value=parsed.name;
  if(!Number.isFinite(qty)||qty<=0){setToast("La cantidad debe ser mayor que cero");return}
  if(!value)return;
  if(shoppingInputNeedsReview(value)||value.split(/\s+/).length>8||suspiciousRepeatedText(value)){setToast("Revisa el nombre del producto antes de añadirlo");return}
  const productProfile=classifyProduct(forcedName||value);
  const name=forcedName||value;
  setState(s=>{
   const duplicate=s.shopping.find(i=>norm(i.name)===norm(name)&&i.supermarket===supermarket&&i.status==="pendiente"&&planUnitFamily(i.unit)===planUnitFamily(unit));
   if(duplicate){
    const sources=shoppingSources(duplicate);
    const manualId="manual:"+duplicate.id+":"+norm(requestedBy);
    const convertedQty=Math.round(planFromBase(planToBase(qty,unit),duplicate.unit)*100)/100;
    const idx=sources.findIndex(src=>src.id===manualId);
    const nextSources=idx>=0?sources.map((src,j)=>j===idx?{...src,qty:Math.round((src.qty+convertedQty)*100)/100}:src):[...sources,{id:manualId,type:"manual" as const,label:requestedBy,qty:convertedQty,unit:duplicate.unit}];
    const updated=withShoppingSources(duplicate,nextSources);
    return updated?{...s,shopping:s.shopping.map(i=>i.id===duplicate.id?updated:i)}:s;
   }
   const id=crypto.randomUUID();
   const source:ShoppingSource={id:"manual:"+id+":"+norm(requestedBy),type:"manual",label:requestedBy,qty,unit};
   return {...s,shopping:[...s.shopping,{id,name:name.charAt(0).toUpperCase()+name.slice(1),requestedName:forcedName&&forcedName!==value?value:undefined,qty,unit,category:productProfile.category,subcategory:productProfile.subcategory,supermarket,requestedBy,reason:"persona",status:"pendiente",sources:[source]}]};
  });
 }
 const pendingShoppingEntries=useRef<string[]>([]);
 function processShoppingEntries(entries:string[]){
  if(!entries.length){setQuick("");setProductChoice(null);return}
  const [first,...rest]=entries;
  const parsed=parseShoppingQuantity(first);
  let name=parsed.name;
  const corrections:Record<string,string>={pesacado:"pescado",pescao:"pescado",peix:"pescado",llet:"leche",ous:"huevos",pollastre:"pollo",fish:"pescado",ketchu:"ketchup",ketchupp:"ketchup"};
  const corrected=corrections[norm(name)];
  const options=productSuggestions(corrected||name);
  if(!options.length&&classifyProduct(name).category==="Por clasificar"&&name.split(/\s+/).length<=3&&name.length>=4){
   const near=registeredProductNames().filter(x=>Math.abs(norm(x).length-norm(name).length)<=2).map(x=>({name:x,d:editDistance(norm(x),norm(name))})).filter(x=>x.d<=1).sort((a,b)=>a.d-b.d).slice(0,4);
   near.forEach(x=>options.push(classifyProduct(x.name)));
  }
  if(options.length>1||corrected||classifyProduct(name).category==="Por clasificar"){
   if(corrected&&!options.length)options.push(classifyProduct(corrected));
   pendingShoppingEntries.current=rest;
   setProductChoice({raw:first,name:corrected||name,qty:parsed.qty,unit:parsed.unit,options});return;
  }
  addOne(first);processShoppingEntries(rest);
 }
 function add(input=quick){
  if(shoppingInputNeedsReview(input)){setToast("Parece una corrección o una conversación. Escribe solo los productos; no se ha cambiado la lista.");return}
  const entries=splitShoppingEntries(input);
  if(!entries.length)return;
  processShoppingEntries(entries);
 }
  function startShoppingVoice(){
  if(shoppingListening){
   setShoppingListening(false);shoppingListeningRef.current=false;
   const finalText=(shoppingTranscriptRef.current+" "+shoppingInterimRef.current).trim();
   shoppingRecognitionRef.current?.abort();
   shoppingTranscriptRef.current="";shoppingInterimRef.current="";
   if(finalText){setQuick(finalText);setToast("Dictado listo · revisa la lista y pulsa Añadir")}
   return;
  }
  const W=(window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if(!W){setToast("El reconocimiento de voz no está disponible en este navegador");return}
  const recognition=new W(); shoppingRecognitionRef.current=recognition;
  recognition.lang="es-ES";recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=3;
  shoppingTranscriptRef.current="";shoppingInterimRef.current="";shoppingListeningRef.current=true;setShoppingListening(true);
  recognition.onresult=(e:any)=>{
   let interim="";
   for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)shoppingTranscriptRef.current+=(shoppingTranscriptRef.current?" ":"")+e.results[i][0].transcript;
   for(let i=e.resultIndex;i<e.results.length;i++)if(!e.results[i].isFinal)interim+=e.results[i][0].transcript+" ";
   shoppingInterimRef.current=interim.trim();
   setQuick((shoppingTranscriptRef.current+" "+interim).trim());
  };
  recognition.onerror=(event:any)=>{if(event.error==="no-speech")return;shoppingListeningRef.current=false;setShoppingListening(false);setToast(event.error==="not-allowed"?"Permiso de micrófono denegado · puedes escribir la lista":"No he podido entender la voz · el texto reconocido se conserva")};
  recognition.onend=()=>{if(shoppingListeningRef.current){try{recognition.start()}catch{shoppingListeningRef.current=false;setShoppingListening(false)}}};
  try{recognition.start()}catch{shoppingListeningRef.current=false;setShoppingListening(false);setToast("No se pudo activar el micrófono · puedes escribir la lista")}
 }
 async function ticketSelected(file?:File,append=false){
  if(!file)return;
  if(!file.type.startsWith("image/")){
   setOcrStatus("idle");
   setToast("PDF seleccionado · el OCR local funciona con fotos; introduce el total manualmente");
   return;
  }
  if(!append){setOcrItems([]);setOcrTotal(undefined);setOcrPhotoCount(0)}
  setOcrProgress(0);setOcrStatus("reading");
  setToast(append?"Leyendo otra foto del ticket…":"Leyendo el ticket en este dispositivo…");
  try{
   const parsed=await readReceiptImage(file,setOcrProgress);
   const nextCount=(append?ocrPhotoCount:0)+1;
   setOcrPhotoCount(nextCount);
   setReceiptName(nextCount>1?nextCount+" fotos del ticket":file.name||"Foto del ticket");
   setOcrItems(prev=>append?mergeReceiptCandidates(prev,parsed.items):parsed.items);
   setOcrTotal(prev=>parsed.total??(append?prev:undefined));
   setOcrStatus("ready");
   if(typeof parsed.total==="number")setPurchaseTotal(parsed.total.toFixed(2).replace(".",","));
   setToast(parsed.items.length?"Foto "+nextCount+" leída · revisa los productos detectados":"Foto leída · revisa el total");
  }catch{
   setOcrStatus("error");
   setToast("No he podido leer bien esta foto · puedes repetirla o continuar manualmente");
  }
 }
 async function ticketFilesSelected(files?:FileList|null){
  const images=[...(files?Array.from(files):[])].filter(file=>file.type.startsWith("image/")).slice(0,4);
  if(!images.length){const pdf=files?.[0];if(pdf)await ticketSelected(pdf,false);return}
  setOcrItems([]);setOcrTotal(undefined);setOcrPhotoCount(0);setReceiptName(images.length+" fotos del ticket");setOcrStatus("reading");
  let merged:ReceiptCandidate[]=[];let total:number|undefined;
  try{
   for(let i=0;i<images.length;i++){
    const parsed=await readReceiptImage(images[i],pct=>setOcrProgress(Math.round(((i+pct/100)/images.length)*100)));
    merged=mergeReceiptCandidates(merged,parsed.items);
    total=parsed.total??total;
    setOcrPhotoCount(i+1);
   }
   setOcrItems(merged);setOcrTotal(total);setOcrStatus("ready");
   if(typeof total==="number")setPurchaseTotal(total.toFixed(2).replace(".",","));
   setToast(images.length+" fotos leídas · "+merged.length+" productos detectados");
  }catch{
   setOcrStatus("error");
   setToast("Una de las fotos no se pudo leer bien · revisa o repite esa parte");
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
     const current=shopping[existing];
     shopping[existing]={...current,qty:shoppingActive?current.qty:Math.max(current.qty,item.qty),price:item.price??current.price,status:shoppingActive?"carrito":current.status,boughtQty:shoppingActive?item.qty:current.boughtQty,supermarket:activeStore||current.supermarket};
    }else{
     shopping.push({id:crypto.randomUUID(),name:item.name,qty:item.qty||1,unit:inferUnit(item.name),category:p.category,subcategory:p.subcategory,supermarket:activeStore||undefined,requestedBy:"Ticket",reason:"persona",status:shoppingActive?"carrito":"pendiente",boughtQty:shoppingActive?(item.qty||1):undefined,price:item.price});
    }
   }
   return {...s,shopping};
  });
  setToast(ocrItems.length+" productos añadidos desde el ticket");
 }
 function moveHere(id:string){setState(s=>({...s,shopping:s.shopping.map(i=>i.id===id?{...i,supermarket:activeStore,status:"pendiente"}:i)}))}
 function cart(id:string){setState(s=>({...s,shopping:s.shopping.map(i=>i.id===id?(i.status==="carrito"?{...i,status:"pendiente",boughtQty:undefined}:{...i,status:"carrito",boughtQty:i.qty}):i)}))}
 function toggleReserve(id:string){setState(s=>({...s,shopping:s.shopping.map(i=>i.id===id?{...i,reserve:!i.reserve}:i)}));setToast("Reserva actualizada")}
 function addSupermarket(selectNow=false){
  const name=newStoreName.trim().replace(/\s+/g," ");
  if(!name)return;
  const corrected=normalizeSupermarket(name);
  const exists=state.profile.supermarkets.find(x=>norm(x)===norm(corrected));
  const finalName=exists||corrected;
  setState(s=>s.profile.supermarkets.some(x=>norm(x)===norm(finalName))?s:{...s,profile:{...s.profile,supermarkets:[...s.profile.supermarkets,finalName],mainSupermarket:s.profile.mainSupermarket||finalName}});
  setNewStoreName("");
  setAddingStore(false);
  if(selectNow)setActiveStore(finalName);else setStoreFilter(finalName);
  setToast(corrected!==name?`He corregido “${name}” a ${finalName}`:exists?finalName+" ya estaba guardado":finalName+" añadido a supermercados");
 }
 function suggestedAmount(i:InventoryItem){
  const canonical=norm(classifyProduct(i.name,i.category).canonical);
  const recent=state.purchaseHistory.filter(p=>norm(classifyProduct(p.name,p.category).canonical)===canonical&&p.qty>0).slice(-6);
  const last=recent[recent.length-1];
  const sameUnit=recent.filter(p=>normalizedUnit(p.unit)===normalizedUnit(last?.unit||i.unit));
  return {qty:sameUnit.length?median(sameUnit.map(p=>p.qty)):1,unit:last?.unit||i.unit};
 }
 function dismissSuggestion(id:string){setDismissedSuggestions(xs=>[...new Set([...xs,id])]);setLastDismissed(id)}
 function addRecommendedMissing(){
  if(!recommendedMissing.length)return;
  setState(s=>{
   const seen=new Set(s.shopping.map(q=>norm(classifyProduct(q.name,q.category).canonical)));
   const additions:ShoppingItem[]=[];
   for(const i of recommendedMissing){
    const canonical=norm(classifyProduct(i.name,i.category).canonical);
    if(seen.has(canonical))continue;
    seen.add(canonical);
    additions.push({id:crypto.randomUUID(),name:i.name,...suggestedAmount(i),category:i.category,subcategory:i.subcategory,requestedBy:"HomeOS",reason:"recomienda",status:"pendiente"});
   }
   return {...s,shopping:[...s.shopping,...additions]};
  });
  setSuggestionsOpen(false);setToast("Sugerencias añadidas sin duplicar tu lista");
 }
 function changeShoppingQty(id:string,delta:number){
  setState(s=>({...s,shopping:s.shopping.map(i=>{
   if(i.id!==id)return i;
   if(shoppingActive&&i.status==="carrito")return {...i,boughtQty:changeShoppingQuantity(i.boughtQty??i.qty,i.unit,delta)};
   if(planLine(i))return i;
   const qty=changeShoppingQuantity(i.qty,i.unit,delta);
   const sources=resizeShoppingSources(shoppingSources(i),qty,i.unit);
   return {...i,qty,sources};
  })}));
 }
 function removeShopping(id:string){
  setState(s=>({...s,shopping:s.shopping.filter(i=>i.id!==id)}));
  setToast("Producto eliminado de la lista");
 }
 function shoppingRecipeContext(i:ShoppingItem){
  const sources=shoppingSources(i);
  const recipeIds=[...new Set(sources.filter(x=>x.type==="recipe"&&x.planId).map(x=>x.planId!))];
  const titles=[...new Set(recipeIds.map(id=>state.recipePlans.find(p=>p.id===id)?.recipe.title).filter(Boolean) as string[])];
  const weekly=sources.some(x=>x.type==="weekly");
  const manual=sources.some(x=>x.type==="manual");
  const buyAfter=sources.map(x=>x.buyAfter).filter((x):x is string=>Boolean(x)&&x!=="").sort()[0];
  const timing=buyAfter&&buyAfter>localDateIso()?" · mejor desde "+new Date(buyAfter+"T12:00:00").toLocaleDateString("es-ES",{weekday:"short",day:"numeric"}):"";
  if(titles.length&&weekly)return (manual?"Habitual + ":"")+"menú + "+titles.length+" receta"+(titles.length===1?"":"s")+timing;
  if(titles.length===1)return (manual?"Habitual + ":"")+"para "+titles[0]+timing;
  if(titles.length>1)return (manual?"Habitual + ":"")+"para "+titles.length+" recetas"+timing;
  if(weekly)return manual?"Habitual + menú semanal":"Menú semanal";
  return "";
 }
 function shoppingRecipeDue(i:ShoppingItem){
  const sourceDue=shoppingSources(i).map(x=>x.buyAfter||x.plannedFor).filter((x):x is string=>Boolean(x)).sort()[0];
  if(sourceDue)return sourceDue;
  const ids=[...(i.recipePlanIds||[]),...(i.recipePlanId?[i.recipePlanId]:[])];
  return ids.map(id=>state.recipePlans.find(p=>p.id===id)?.plannedFor||"9999-12-31").sort()[0]||"9999-12-31";
 }
 const filteredList=state.shopping.filter(i=>storeFilter==="Todos"||i.supermarket===storeFilter||(!i.supermarket&&storeFilter==="Cualquiera"));
 const planLine=(i:ShoppingItem)=>shoppingSources(i).some(src=>src.type==="recipe"||src.type==="weekly");
 const intentBase=(shoppingActive&&activeStore&&activeStore!=="Compra general"?state.shopping.filter(i=>(!i.supermarket||i.supermarket===activeStore)):shoppingActive&&activeStore==="Compra general"?state.shopping:filteredList);
 const todayShopping=localDateIso();
 const shoppingRank=(i:ShoppingItem)=>{
  if(!planLine(i))return 1;
  const sources=shoppingSources(i);
  if(sources.some(src=>src.type==="weekly"))return 0;
  const hasDate=sources.some(src=>src.type==="recipe"&&Boolean(src.buyAfter||src.plannedFor));
  if(!hasDate)return 2;
  return shoppingRecipeDue(i)>todayShopping?2:0;
 };
 const mainItems=intentBase.filter(i=>shoppingIntentFilter==="todos"||(shoppingIntentFilter==="planes"?planLine(i):!planLine(i))).slice().sort((a,b)=>shoppingRank(a)-shoppingRank(b)||shoppingRecipeDue(a).localeCompare(shoppingRecipeDue(b)));
 const hasPlanLines=state.shopping.some(planLine);
 const grouped=mainItems.reduce<Record<string,ShoppingItem[]>>((a,i)=>{
  const category=i.category==="Revisar"&&/^(carne|pechuga|pollo|pavo)$/.test(norm(i.name))?"Carne":i.category;
  (a[category]??=[]).push(i);return a;
 },{});
 const other=shoppingActive&&activeStore&&activeStore!=="Compra general"?state.shopping.filter(i=>i.supermarket&&i.supermarket!==activeStore&&i.status==="pendiente"):[];
 return <section className="stack">
  {manageStores&&<div className="modal-backdrop"><section className="modal confirm-stock-modal"><div className="modal-head"><h2>Supermercados</h2><button aria-label="Cerrar supermercados" onClick={()=>setManageStores(false)}>×</button></div><p>Editar cambia la tienda en la lista actual. Quitar conserva el historial y deja sus productos en «Cualquiera».</p>{state.profile.supermarkets.map(store=><div className="store-management-row" key={store}>{editingStore===store?<><input aria-label="Nombre del supermercado" value={editStoreName} onChange={e=>setEditStoreName(e.target.value)}/><button className="secondary" disabled={!editStoreName.trim()} onClick={()=>{const name=normalizeSupermarket(editStoreName);setState(s=>({...s,profile:{...s.profile,supermarkets:[...new Set(s.profile.supermarkets.map(x=>x===store?name:x))],mainSupermarket:s.profile.mainSupermarket===store?name:s.profile.mainSupermarket},shopping:s.shopping.map(i=>i.supermarket===store?{...i,supermarket:name}:i)}));if(activeStore===store)setActiveStore(name);if(storeFilter===store)setStoreFilter(name);setEditingStore(null)}}>Guardar</button></>:<><strong>{store}</strong><button className="secondary" onClick={()=>{setEditingStore(store);setEditStoreName(store)}}>Editar</button><button className="secondary" onClick={()=>{setState(s=>({...s,profile:{...s.profile,supermarkets:s.profile.supermarkets.filter(x=>x!==store),mainSupermarket:s.profile.mainSupermarket===store?s.profile.supermarkets.find(x=>x!==store)||"":s.profile.mainSupermarket},shopping:s.shopping.map(i=>i.supermarket===store?{...i,supermarket:undefined}:i)}));if(activeStore===store)setActiveStore("Compra general");if(storeFilter===store)setStoreFilter("Todos");setToast("Tienda quitada · puedes volver a añadirla")}}>Quitar</button></>}</div>)}</section></div>}
  {alreadyHave&&<div className="modal-backdrop"><section className="modal confirm-stock-modal" role="dialog" aria-modal="true" aria-label="Confirmar lo que tengo"><div className="modal-head"><h2>Ya tengo {alreadyHave.name}</h2><button aria-label="Cerrar confirmación" onClick={()=>setAlreadyHave(null)}>×</button></div><p>Confirma cuánto tienes en esta ubicación, en {alreadyHave.unit}. No lo contaremos como comprado.</p><label>Cantidad real en casa<input type="number" min="0.01" step="any" value={haveQty} onChange={e=>setHaveQty(e.target.value)}/></label><label>Ubicación<select value={haveLocation} onChange={e=>setHaveLocation(e.target.value as Location)}><option>Despensa</option><option>Nevera</option><option>Congelador</option></select></label><button className="primary" disabled={!(Number.isFinite(Number(haveQty))&&Number(haveQty)>0)} onClick={confirmAlreadyHave}>Confirmar cantidad</button></section></div>}
  <div className="shopping-top"><div><span className="eyebrow">LISTA DE COMPRA</span><h2>{shoppingActive?(activeStore?"Comprando en "+activeStore:"¿Dónde estás comprando?"):"Lo que falta en casa"}</h2><p>Marca la casilla cuando cojas un producto. Al terminar la compra, lo cogido pasa a Casa.</p></div>{shoppingActive?<div className="shopping-session-actions"><button className="secondary" onClick={()=>{setState(s=>({...s,shopping:s.shopping.map(i=>i.status==="carrito"?{...i,status:"pendiente",boughtQty:undefined}:i)}));setShoppingActive(false);setActiveStore("");setPurchaseTotal("");setReceiptName("")}}>Salir</button><button className="primary" disabled={!activeStore||(state.profile.financeMode==="preciso"&&!purchaseTotal.trim())} onClick={()=>{const n=Number(purchaseTotal.replace(",","."));if(purchaseTotal.trim()&&(!Number.isFinite(n)||n<0)){setToast("Introduce un total válido, igual o mayor que cero");return}const manual=purchaseTotal.trim()&&Number.isFinite(n)?n:undefined;const total=manual??(state.profile.financeMode==="orientativo"&&estimatedTotal>0?estimatedTotal:undefined);finishShopping(total);setPurchaseTotal("");setReceiptName("")}}>Terminar compra</button></div>:<button className="primary shopping-start" onClick={()=>setShoppingActive(true)}><span>Empezar compra</span><small>Elige dónde compras y marca lo que vas cogiendo</small></button>}</div>

  {pendingRecipePlans.length>0&&<section className="shopping-recipe-memory-list"><h3>Compra para tus recetas</h3>{pendingRecipePlans.map(p=><article className="shopping-recipe-memory" key={p.id}><img src={RECIPES.find(r=>r.id===p.recipe.id)?.image||p.recipe.image||"/recipe-placeholder.svg"} alt=""/><div><strong>{p.recipe.title}</strong><p>{p.missing.length} ingredientes por completar{p.shoppingLinked?" · vinculados a la compra":""}</p></div><button onClick={()=>addFromRecipe(p.recipe,p.plannedFor)}>Añadir faltantes</button></article>)}</section>}
  {!shoppingActive?<div className="quick-add smart"><input value={quick} onChange={e=>setQuick(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} enterKeyHint="done" placeholder="Ej. leche, 2 yogures y 1 kg de pollo…"/><button className={shoppingListening?"meal-mic listening":"meal-mic"} onClick={startShoppingVoice} aria-label="Añadir por voz">{shoppingListening?"…":micIcon()}</button><span className="device-member-pill" title="Este dispositivo añade productos a nombre de esta persona">👤 {requestedBy}</span><button onClick={()=>add()}>Añadir</button></div>:<div className="store-picker"><span>Estoy en</span><button className={activeStore==="Compra general"?"active":""} onClick={()=>setActiveStore("Compra general")}>Compra general</button>{state.profile.supermarkets.map(s=><button key={s} className={(activeStore===s?"active ":"")+storeClass(s)} onClick={()=>setActiveStore(s)}>{s}</button>)}<button className="add-store-button" onClick={()=>setAddingStore(true)}>＋ Añadir supermercado</button></div>}
  {productChoice&&<article className="product-choice-card"><div><small>REVISAR PRODUCTO</small><strong>¿Qué querías decir con “{productChoice.name}”?</strong><p>He entendido la familia del producto, pero prefiero confirmarlo antes de ordenar la compra.</p></div><div className="product-choice-options">{productChoice.options.map(option=><button key={option.canonical} onClick={()=>{addOne(productChoice.raw,option.canonical);setProductChoice(null);processShoppingEntries(pendingShoppingEntries.current);setToast(option.canonical+" añadido · escrito como “"+productChoice.raw+"”")}}><span>{productIcon(option.canonical,option.category)}</span><b>{option.canonical}</b><small>{option.category} · {option.subcategory}</small></button>)}</div>{!/^(carne|pescado|pollo|pavo|fruta|verdura|pechuga|fish|peix)$/.test(norm(productChoice.name))&&<button className="secondary" onClick={()=>{addOne(productChoice.raw);setProductChoice(null);processShoppingEntries(pendingShoppingEntries.current)}}>Usar exactamente “{productChoice.name}”</button>}<button className="secondary" onClick={()=>{setProductChoice(null);processShoppingEntries(pendingShoppingEntries.current)}}>Omitir este producto</button><button className="secondary" onClick={()=>{setProductChoice(null);pendingShoppingEntries.current=[]}}>Cancelar</button></article>}

  {!shoppingActive&&<div className="store-tabs"><button className={storeFilter==="Todos"?"active":""} onClick={()=>setStoreFilter("Todos")}>Todos</button>{state.profile.supermarkets.map(s=><button className={(storeFilter===s?"active ":"")+storeClass(s)} key={s} onClick={()=>setStoreFilter(s)}>{s}</button>)}<button className={(storeFilter==="Cualquiera"?"active ":"")+"store-any"} onClick={()=>setStoreFilter("Cualquiera")}>Cualquiera</button><button className="add-store-button" onClick={()=>setAddingStore(true)}>＋ Supermercado</button><button className="secondary" onClick={()=>setManageStores(true)}>Editar tiendas</button></div>}
  {hasPlanLines&&<div className="shopping-intent-tabs"><button className={shoppingIntentFilter==="todos"?"active":""} onClick={()=>setShoppingIntentFilter("todos")}>Todo</button><button className={shoppingIntentFilter==="habitual"?"active":""} onClick={()=>setShoppingIntentFilter("habitual")}>Compra habitual</button><button className={shoppingIntentFilter==="planes"?"active":""} onClick={()=>setShoppingIntentFilter("planes")}>Para recetas</button></div>}
  {shoppingActive&&!activeStore&&<article className="empty-state"><h3>Elige la tienda</h3><p>La lista se reorganizará para que veas primero lo que puedes comprar ahí.</p></article>}
  {addingStore&&<div className="inline-store-add"><div><strong>Añadir supermercado</strong><small>Se guardará para futuras compras.</small></div><input autoFocus value={newStoreName} onChange={e=>setNewStoreName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addSupermarket(shoppingActive);if(e.key==="Escape"){setAddingStore(false);setNewStoreName("")}}} placeholder="Ej. BonÀrea, Ametller, tienda del barrio…"/><button className="primary" onClick={()=>addSupermarket(shoppingActive)} disabled={!newStoreName.trim()}>Guardar</button><button className="secondary" onClick={()=>{setAddingStore(false);setNewStoreName("")}}>Cancelar</button></div>}

  {(!shoppingActive||activeStore)&&<div className="shopping-layout"><div className="category-list shopping-list-categories">{Object.keys(grouped).length===0&&<article className="friendly-empty"><span>✓</span><h3>Todo al día</h3><p>No hay productos en esta vista.</p></article>}{Object.entries(grouped).map(([cat,items])=><article className="list-card shopping-category" key={cat}><div className="list-title"><h3><span>{CATEGORY_ICONS[cat]||"🛍️"}</span>{CATEGORY_LABELS[cat]||cat}</h3><span>{items.filter(i=>i.status==="carrito").length} / {items.length} cogidos</span></div><div className="shopping-list-rows">{items.map(i=><div className={"shopping-list-row"+(i.status==="carrito"?" is-picked":"")} key={i.id}>
     <button className="shopping-pick" onClick={()=>cart(i.id)} aria-pressed={i.status==="carrito"} aria-label={(i.status==="carrito"?"Desmarcar ":"Marcar como cogido ")+i.name}><span className="shopping-checkbox">{i.status==="carrito"&&<svg className="shopping-check-animation" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 16.5 13 23 25 9"/></svg>}</span></button>
     <span className="shopping-row-icon" aria-hidden="true">{productIcon(i.name,i.category)}</span><div className="shopping-row-copy"><strong>{i.name}</strong>{(shoppingRecipeContext(i)||i.supermarket)&&<small>{[shoppingRecipeContext(i),i.supermarket].filter(Boolean).join(" · ")}</small>}</div>
     <div className="shopping-row-controls"><button disabled={planLine(i)&&!shoppingActive} onClick={()=>changeShoppingQty(i.id,-1)} aria-label={"Restar cantidad de "+i.name}>−</button><b>{i.status==="carrito"?(i.boughtQty??i.qty):i.qty} {i.unit}</b><button disabled={planLine(i)&&!shoppingActive} onClick={()=>changeShoppingQty(i.id,1)} aria-label={"Sumar cantidad de "+i.name}>+</button></div>
     <details className="shopping-row-menu"><summary aria-label={"Más opciones de "+i.name}>⋯</summary><div className="shopping-row-options"><button onClick={e=>{e.currentTarget.closest("details")?.removeAttribute("open");setAlreadyHave(i);setHaveQty("");setHaveLocation(classifyProduct(i.name,i.category).location)}}>Ya está en casa</button>{shoppingActive&&(Boolean(freezerQualityGuide(i.name,i.category,i.subcategory))||i.category==="Carne")&&<button onClick={e=>{e.currentTarget.closest("details")?.removeAttribute("open");toggleReserve(i.id)}}>{i.reserve?"❄ Quitar reserva":"❄ Comprar de reserva"}</button>}<button className="shopping-remove" onClick={()=>removeShopping(i.id)}>Eliminar producto</button></div></details>
    </div>)}</div></article>)}</div>


   <aside className="purchase-tools">
    <div className="ticket-actions">
     <button className="tool-action ticket-camera" onClick={()=>receiptCameraRef.current?.click()}><span>📷</span><div><strong>Hacer foto del ticket</strong><p>Abre la cámara directamente.</p></div></button>
     <button className="tool-action" onClick={()=>receiptRef.current?.click()}><span>🧾</span><div><strong>Elegir ticket</strong><p>{receiptName?"Seleccionado: "+receiptName:"Foto o PDF desde el dispositivo."}</p></div></button>
    </div>
    {ocrStatus==="reading"&&<div className="local-ocr-card"><div className="local-ocr-head"><span>⌁</span><div><strong>Leyendo ticket en el móvil</strong><small>Procesamiento local · sin API de pago</small></div><b>{ocrProgress}%</b></div><div className="local-ocr-progress"><span style={{width:ocrProgress+"%"}}/></div></div>}
    {ocrStatus==="ready"&&<div className="local-ocr-card ready"><div className="local-ocr-head"><span>✓</span><div><strong>{ocrItems.length} productos detectados</strong><small>{ocrPhotoCount>1?ocrPhotoCount+" fotos combinadas · ":""}{typeof ocrTotal==="number"?"Total detectado: "+ocrTotal.toFixed(2)+" €":"Revisa el total antes de terminar"}</small></div></div>{ocrItems.length>0&&<div className="ocr-preview">{ocrItems.slice(0,6).map((x,idx)=><span key={idx}>{x.name}{typeof x.price==="number"?" · "+x.price.toFixed(2)+" €":""}</span>)}{ocrItems.length>6&&<small>+{ocrItems.length-6} más</small>}</div>}<div className="ocr-ready-actions"><button onClick={applyOcrItems} disabled={!ocrItems.length}>Usar productos detectados</button><button className="secondary" onClick={()=>receiptCameraRef.current?.click()}>＋ Otra foto</button><button className="secondary" onClick={()=>{setOcrItems([]);setOcrTotal(undefined);setOcrPhotoCount(0);setOcrStatus("idle");setReceiptName("")}}>Nuevo ticket</button></div><p>Las fotos se procesan en tu dispositivo. HomeOS no las envía a una IA de pago.</p></div>}
    {ocrStatus==="error"&&<div className="local-ocr-card error"><strong>No se pudo leer con suficiente claridad</strong><p>Haz otra foto más recta y con buena luz, o continúa con la lista y el total manual.</p></div>}
    <input ref={receiptCameraRef} hidden type="file" accept="image/*" capture="environment" onChange={e=>{ticketSelected(e.target.files?.[0],ocrPhotoCount>0);e.currentTarget.value=""}}/>
    <input ref={receiptRef} hidden type="file" accept="image/*,.pdf" multiple onChange={e=>{ticketFilesSelected(e.target.files);e.currentTarget.value=""}}/>
    {shoppingActive&&<p className="receipt-fallback-note">¿No tienes el ticket? Marca lo comprado e introduce el total. Puedes terminar sin precios por producto.</p>}
    {shoppingActive&&<label className="purchase-total"><span>Total de la compra <small>{state.profile.financeMode==="preciso"?"obligatorio en modo preciso":"opcional"}</small></span><div><input inputMode="decimal" value={purchaseTotal} onChange={e=>setPurchaseTotal(e.target.value)} placeholder={estimatedTotal>0?"≈ "+estimatedTotal.toFixed(2):"0,00"}/><b>€</b></div>{state.profile.financeMode==="orientativo"&&estimatedTotal>0&&<small>Si lo dejas vacío, HomeOS usará ≈ {estimatedTotal.toFixed(2)} € con los precios que ya conoce.</small>}</label>}
    <article className="tool-card smart-restock"><span>✦</span><div><strong>¿Quieres ideas para tu compra?</strong><p>Opcional · revisa la propuesta y añade solo lo que quieras.</p><button onClick={()=>setSuggestionsOpen(v=>!v)}>{suggestionsOpen?"Cerrar sugerencias":"Ver sugerencias"}</button></div></article>
    {suggestionsOpen&&<section className="restock-review" aria-label="Sugerencias de compra"><div className="restock-review-head"><strong>{recommendedMissing.length} sugerencias</strong><button onClick={()=>setSuggestionsOpen(false)} aria-label="Cerrar sugerencias">×</button></div><p>Desliza a cualquier lado para descartar. Tu lista se mantiene hasta que pulses añadir.</p>{recommendedMissing.map(i=>{const amount=suggestedAmount(i);return <div className="restock-suggestion" key={i.id} onTouchStart={e=>{const t=e.touches[0];suggestionTouch.current={id:i.id,x:t.clientX,y:t.clientY}}} onTouchEnd={e=>{const start=suggestionTouch.current;suggestionTouch.current=null;if(!start||start.id!==i.id)return;const t=e.changedTouches[0];const dx=Math.abs(t.clientX-start.x),dy=Math.abs(t.clientY-start.y);if(dx>70&&dx>dy*1.5)dismissSuggestion(i.id)}}><span>{productIcon(i.name,i.category)}</span><div><strong>{i.name}</strong><small>{amount.qty} {amount.unit} · cantidad habitual</small></div><button onClick={()=>dismissSuggestion(i.id)} aria-label={"Descartar "+i.name}>×</button></div>})}{lastDismissed&&<button className="secondary" onClick={()=>{setDismissedSuggestions(xs=>xs.filter(id=>id!==lastDismissed));setLastDismissed(null)}}>Deshacer descarte</button>}{recommendedMissing.length>0?<button className="primary" onClick={addRecommendedMissing}>Añadir los {recommendedMissing.length} restantes</button>:<p>No hay más sugerencias para esta compra.</p>}</section>}

   </aside>
  </div>}

  {shoppingActive&&activeStore&&other.length>0&&<article className="other-stores"><div><small>PENDIENTE EN OTRAS TIENDAS</small><h3>También tenías esto apuntado</h3></div>{other.map(i=><div key={i.id}><span><strong>{i.name}</strong><small>{i.supermarket}</small></span><button onClick={()=>moveHere(i.id)}>Traer aquí</button></div>)}</article>}
 </section>
}

function Casa({state,setState,setToast,focus,clearFocus,openRecipes}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;setToast:(s:string)=>void;focus:"all"|"expiring"|"prepared"|"reserve";clearFocus:()=>void;openRecipes:(name:string)=>void}){
 const [loc,setLoc]=useState("Todo"),[cat,setCat]=useState("Todos");
 const [stockEdit,setStockEdit]=useState<InventoryItem|null>(null);
 const [stockName,setStockName]=useState("");
 const [stockQty,setStockQty]=useState("");
 const [stockUnit,setStockUnit]=useState("ud");
 const [stockLocation,setStockLocation]=useState<Location>("Despensa");
 const [stockDate,setStockDate]=useState("");
 const [stockDateType,setStockDateType]=useState<"caducidad"|"preferente">("caducidad");
 const [stockFormOpen,setStockFormOpen]=useState(false);
 const [density,setDensity]=useState<"compact"|"detail">("compact");
 const [preparedOpen,setPreparedOpen]=useState(false);
 const [preparedName,setPreparedName]=useState("");
 const [voiceDraft,setVoiceDraft]=useState("");
 const [voiceListening,setVoiceListening]=useState(false);
 const [preparedServings,setPreparedServings]=useState(1);
 const [preparedLocation,setPreparedLocation]=useState<"Nevera"|"Congelador">("Nevera");
 const [preparedKind,setPreparedKind]=useState<"sobras"|"mealprep">("sobras");
 const [mealPrepDays,setMealPrepDays]=useState(7);
 useEffect(()=>{if(focus!=="all"){setLoc(focus==="reserve"?"Congelador":"Todo");setCat(focus==="prepared"?"Preparados":"Todos")}},[focus]);
 const locationMatch=(i:InventoryItem)=>loc==="Todo"||(loc==="Revisar"?i.location==="Sin ubicar":loc==="Despensa"?(i.location==="Despensa"||i.location==="Suplementos"):i.location===loc);
 const shown=state.inventory.slice().sort((a,b)=>daysUntil(a.expires||a.estimatedExpires||addDaysIso(a.purchasedAt,classifyProduct(a.name,a.category).rotation==="alta"?3:999))-daysUntil(b.expires||b.estimatedExpires||addDaysIso(b.purchasedAt,classifyProduct(b.name,b.category).rotation==="alta"?3:999))).filter(i=>locationMatch(i)&&(cat==="Todos"||i.category===cat)&&(focus==="expiring"?(i.expires||i.estimatedExpires?daysUntil(i.expires||i.estimatedExpires)<=3:classifyProduct(i.name,i.category).rotation==="alta"&&daysUntil(i.purchasedAt)<=-2)&&i.stock!=="falta"&&i.location!=="Congelador":focus==="prepared"?i.category==="Preparados"&&i.stock!=="falta":focus==="reserve"?i.storageMode==="reserva":true));

 function setStock(id:string,stock:StockState){setState(s=>{const today=localDateIso(),item=s.inventory.find(i=>i.id===id);const inventory=s.inventory.map(i=>i.id===id?(stock==="falta"?emptyInventoryItem(i,today):{...i,stock}):i);return {...s,inventory,stockChecks:stock==="falta"&&item?appendConfirmedStockCheck(s.stockChecks,inventory,inventory.find(i=>i.id===id)!,today):s.stockChecks}})}
 function openStockForm(item?:InventoryItem){setStockEdit(item||null);setStockName(item?.name||"");setStockQty(item?String(item.qty):"");setStockUnit(item?.unit||"ud");setStockLocation(item?.location||"Despensa");setStockDate(item?.expires||"");setStockDateType(item?.dateType||"caducidad");setStockFormOpen(true)}
 function saveStockCount(){
  const qty=Number(stockQty.replace(",","."));if(!stockName.trim()||!Number.isFinite(qty)||qty<0)return;
  const today=localDateIso(),p=classifyProduct(stockName),name=stockName.trim();
  setState(s=>{
   const same=s.inventory.find(i=>i.id===stockEdit?.id)||(!stockEdit?s.inventory.find(i=>norm(i.name)===norm(name)&&normalizedUnit(i.unit)===normalizedUnit(stockUnit)&&i.location===stockLocation):undefined);
   const item:InventoryItem={...same,id:same?.id||crypto.randomUUID(),name,qty,unit:stockUnit,location:stockLocation,category:same?.category==="Preparados"?"Preparados":p.category,servings:same?.category==="Preparados"?qty:same?.servings,subcategory:p.subcategory,stock:qty>0?"hay":"falta",purchasedAt:same?.purchasedAt||today,purchaseDateUnknown:same?.purchaseDateUnknown??!same,lastConfirmedAt:today,lastStockCheckId:crypto.randomUUID(),estimateAnchorDate:today,estimateAnchorQty:qty,expires:stockDate||undefined,dateType:stockDate?stockDateType:undefined,estimatedExpires:stockDate?undefined:same?.estimatedExpires,estimatedDateType:stockDate?undefined:same?.estimatedDateType};
   const inventory=same?s.inventory.map(i=>i.id===same.id?item:i):[item,...s.inventory];
   return {...s,inventory,stockChecks:appendConfirmedStockCheck(s.stockChecks,inventory,item,today)};
  });setStockFormOpen(false);setToast("Cantidad real confirmada · no cuenta como compra");
 }
 function confirmStillHere(id:string){const item=state.inventory.find(i=>i.id===id);if(item)openStockForm(item)}
 function discardProduct(i:InventoryItem){
  const loss=typeof i.price==="number"?Math.max(0,i.price):0;
  setState(s=>{const current=s.inventory.find(x=>x.id===i.id);if(!current||current.stock==="falta")return s;return {...s,waste:s.waste+loss,inventory:s.inventory.map(x=>x.id===i.id?emptyInventoryItem(x,localDateIso()):x)}});
  setToast(loss>0?"Desperdicio registrado · "+loss.toFixed(2)+" €":"Marcado como tirado");
 }
 function eatPrepared(i:InventoryItem){
  const today=localDateIso();
  setState(s=>{
   const current=s.inventory.find(x=>x.id===i.id);if(!current||current.stock==="falta")return s;
   const nextQty=Math.max(0,(current.servings||current.qty||1)-1);
   const ingredients=current.preparedIngredients?.length?current.preparedIngredients:[{name:current.name,key:current.name,category:inferCategory(current.name)}];
   const meal:MealRecord={id:crypto.randomUUID(),date:today,recipeId:current.preparedRecipeId||current.id,title:current.name,servings:1,ingredients};
   return {...s,mealHistory:[...s.mealHistory,meal],inventory:s.inventory.map(x=>x.id===current.id?{...x,qty:nextQty,servings:nextQty,stock:nextQty<=0?"falta":x.stock}:x)};
  });
  setToast("1 ración consumida · Casa y hábitos actualizados");
 }
 function addMealPrepServing(i:InventoryItem){
  setState(s=>({...s,inventory:s.inventory.map(x=>x.id===i.id?{...x,qty:(x.servings||x.qty||0)+1,servings:(x.servings||x.qty||0)+1,stock:"hay"}:x)}));
  setToast("Ración corregida · +1 en meal prep");
 }
 function mealPrepExpectedRemaining(i:InventoryItem){
  if(i.source!=="mealprep"||!i.mealPrepStart||!i.mealPrepDays||!i.mealPrepInitialServings)return null;
  const start=new Date(i.mealPrepStart+"T12:00:00").getTime();
  const today=new Date(localDateIso()+"T12:00:00").getTime();
  const elapsed=Math.max(0,Math.floor((today-start)/86400000));
  const expectedConsumed=Math.min(i.mealPrepInitialServings,Math.floor(i.mealPrepInitialServings*Math.min(i.mealPrepDays,elapsed)/Math.max(1,i.mealPrepDays)));
  return Math.max(0,i.mealPrepInitialServings-expectedConsumed);
 }
 function freeze(id:string){
  const frozenAt=localDateIso();
  setState(s=>{
   const item=s.inventory.find(i=>i.id===id);
   if(!item)return s;
   const key=classifyProduct(item.name,item.category).canonical;
   const guide=freezerQualityGuide(item.name,item.category,item.subcategory);
   const qualityReviewAt=guide?addMonthsIso(frozenAt,guide.minMonths):undefined;
   return {...s,
    productPreferences:{...s.productPreferences,[key]:{...(s.productPreferences[key]||{}),location:"Congelador"}},
    inventory:s.inventory.map(i=>i.id===id?{...freezeInventoryItem(i,frozenAt,estimateInventoryConsumption(i,s.inventory,s.purchaseHistory,s.profile.consumptionHabits,s.stockChecks,frozenAt).estimatedQty),qualityReviewAt}:i)
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
   inventory:s.inventory.map(x=>x.id===i.id?(x.location==="Congelador"?thawInventoryItem(x,next,localDateIso()):{...x,location:next}):x)
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
  const dayMatch=t.match(/(\d+)\s*d[ií]as?/);
  if(t.includes("meal prep")||t.includes("mealprep"))setPreparedKind("mealprep");
  if(dayMatch)setMealPrepDays(Math.max(1,Math.min(14,Number(dayMatch[1])||7)));
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
  const preparedAt=localDateIso();
  const detected=detectProductsInText(name).map(p=>({name:p.canonical,key:p.canonical,category:p.category}));
  const item:InventoryItem={id:crypto.randomUUID(),name,qty:preparedServings,unit:"raciones",location:preparedLocation,category:"Preparados",stock:"hay",purchasedAt:preparedAt,preparedAt,servings:preparedServings,source:preparedKind,mealPrepInitialServings:preparedKind==="mealprep"?preparedServings:undefined,mealPrepDays:preparedKind==="mealprep"?mealPrepDays:undefined,mealPrepStart:preparedKind==="mealprep"?preparedAt:undefined,preparedIngredients:detected};
  setState(s=>({...s,inventory:[item,...s.inventory]}));
  setPreparedName("");setPreparedServings(1);setPreparedLocation("Nevera");setPreparedKind("sobras");setMealPrepDays(7);setVoiceDraft("");setPreparedOpen(false);setToast(preparedKind==="mealprep"?"Meal prep guardado · seguimiento de raciones activo":"Preparado guardado");
 }

 return <section className="stack">
  <div className="page-intro"><div><span className="eyebrow">CASA</span><h2>Encuentra rápido lo que tienes</h2><p>Primero eliges dónde está; después, si quieres, filtras por tipo de producto.</p></div><div className="photo-actions"><button className="secondary" onClick={()=>openStockForm()}>＋ Ya está en casa</button><button className="prepared-button" onClick={()=>setPreparedOpen(true)}>＋ Añadir preparado</button></div></div>

  {stockFormOpen&&<div className="modal-backdrop"><section className="modal confirm-stock-modal"><div className="modal-head"><h2>{stockEdit?"Confirmar cantidad real":"Añadir lo que ya tienes"}</h2><button aria-label="Cerrar cantidad real" onClick={()=>setStockFormOpen(false)}>×</button></div><p>Sin ticket ni gasto. Cuenta solo lo que tienes en esta ubicación.</p><label>Producto<input value={stockName} onChange={e=>setStockName(e.target.value)} placeholder="Ej. leche, manzanas, pollo…"/></label><label>Cantidad real<input inputMode="decimal" value={stockQty} onChange={e=>setStockQty(e.target.value)} placeholder="0"/></label><label>Unidad<select value={stockUnit} onChange={e=>setStockUnit(e.target.value)}>{[...new Set([stockUnit,"ud","uds","g","kg","ml","L","bricks","pack","raciones"])].map(u=><option key={u}>{u}</option>)}</select></label><label>Ubicación<select value={stockLocation} onChange={e=>setStockLocation(e.target.value as Location)}><option>Despensa</option><option>Nevera</option><option>Congelador</option></select></label><label>Fecha del envase · opcional<input type="date" value={stockDate} onChange={e=>setStockDate(e.target.value)}/></label><label>Tipo de fecha<select value={stockDateType} onChange={e=>setStockDateType(e.target.value as "caducidad"|"preferente")}><option value="caducidad">Caducidad</option><option value="preferente">Consumo preferente</option></select></label><button className="primary" disabled={!stockName.trim()||!stockQty.trim()||!Number.isFinite(Number(stockQty.replace(",",".")))||Number(stockQty.replace(",","."))<0} onClick={saveStockCount}>Guardar cantidad real</button></section></div>}
  {focus!=="all"&&<div className={"inventory-focus "+focus}><div><span>{focus==="expiring"?"⏳":focus==="reserve"?"❄️":"🍱"}</span><div><small>VISTA RÁPIDA</small><strong>{focus==="expiring"?"Productos que caducan pronto":focus==="reserve"?"Reservas del congelador":"Comida preparada"}</strong><p>{focus==="expiring"?"Primero fechas próximas y frescos que llevan días en casa. Sin fecha, pedimos revisar calidad sin inventar una caducidad.":focus==="reserve"?"Productos guardados a largo plazo. Los avisos son de revisión y calidad, no borrados automáticos.":"Solo mostramos raciones y preparados listos."}</p></div></div><button onClick={clearFocus}>Ver todo</button></div>}
  {!state.profile.consumptionSetupDone&&<article className="inventory-start-note"><strong>Primer mes de aprendizaje</strong><p>Durante cuatro semanas HomeOS ajustará vuestro ritmo con tickets, compras y cantidades confirmadas. No hace falta registrar los 300 productos de casa el primer día: empieza por los básicos y añade el resto por voz o foto cuando puedas.</p></article>}
  <div className="inventory-toolbar">
   <div className="inventory-filter-block"><small>DÓNDE ESTÁ</small><div className="visual-filter-row">{LOCATIONS.map(x=><button key={x} className={loc===x?"active":""} onClick={()=>setLoc(x)}><span>{LOCATION_ICONS[x]}</span><b>{x}</b></button>)}</div></div>
   <div className="inventory-filter-block"><small>QUÉ ES</small><div className="visual-filter-row categories">{CATEGORIES.map(x=><button key={x} className={cat===x?"active":""} onClick={()=>setCat(x)}><span>{CATEGORY_ICONS[x]||"🛍️"}</span><b>{CATEGORY_LABELS[x]||x}</b></button>)}</div></div>
   <div className="inventory-density"><small>VISTA</small><div><button className={density==="compact"?"active":""} onClick={()=>setDensity("compact")}>▦ Compacta</button><button className={density==="detail"?"active":""} onClick={()=>setDensity("detail")}>☰ Detalle</button></div></div>
  </div>

  <div className={"inventory-grid "+density}>{shown.length===0&&<article className="friendly-empty inventory-empty"><span>⌂</span><h3>No hay productos aquí</h3><p>Prueba otro filtro o registra una compra.</p></article>}{shown.map(i=>{
   const displayLocation=i.location==="Suplementos"?"Despensa":i.location==="Sin ubicar"?"Revisar":i.location;
   const estimate=inventoryEstimate(state,i);
   const consumption=estimateInventoryConsumption(i,state.inventory,state.purchaseHistory,state.profile.consumptionHabits,state.stockChecks);
   return <article className="inventory-card" key={i.id}>
    <div className="inventory-top"><span className="inventory-product-icon">{productIcon(i.name,i.category)}</span><span className={"stock-badge "+estimate.tone} title={estimate.basis}>{estimate.label}</span></div>
    <div className="inventory-name-row"><h3>{i.name}</h3><span className="location-mini">{LOCATION_ICONS[displayLocation]||"▦"} {displayLocation}</span></div>
    <p className="inventory-qty">{i.stock==="incierto"?"Cantidad por revisar":String(i.qty)+" "+i.unit}{density==="detail"&&<small className="estimate-basis">{estimate.basis}</small>}</p>
    <div className="inventory-badges"><span className={"rotation-badge "+rotationBand(i.name,i.category,i.location).key}>{rotationBand(i.name,i.category,i.location).label.replace("Rotación ","")}</span>{i.expires&&<small className={i.dateType==="caducidad"?"date-alert expiry":"date-alert"}>{i.dateType==="caducidad"?"Caduca ":"Consumo pref. "}{new Date(i.expires+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</small>}{!i.expires&&i.estimatedExpires&&<small className="date-alert estimate" title={i.estimateBasis}>≈ {i.estimatedDateType==="caducidad"?"Caducidad":"Consumo pref."} {new Date(i.estimatedExpires+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})} · revisa envase</small>}{i.frozenAt&&<small className="date-alert">Congelado {new Date(i.frozenAt+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</small>}{i.storageMode==="reserva"&&<small className="date-alert reserve">Reserva</small>}{i.qualityReviewAt&&<small className="date-alert quality">Revisar calidad desde {new Date(i.qualityReviewAt+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</small>}</div>
    {i.category==="Preparados"&&<div className="prepared-meta"><span>🍱 {i.source==="mealprep"?"Meal prep":i.source==="receta"?"Receta":"Sobras / tupper"}</span>{i.preparedAt&&<span>Hecho {new Date(i.preparedAt+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</span>}{i.source==="mealprep"&&i.mealPrepDays&&<span>Objetivo {i.mealPrepDays} días</span>}</div>}
    {i.source==="mealprep"&&i.stock!=="falta"&&<div className="mealprep-tracker"><div><small>RACIONES DE MEAL PREP</small><strong>{i.servings||i.qty||0} restantes</strong>{mealPrepExpectedRemaining(i)!==null&&<span>Según el ritmo previsto: ≈ {mealPrepExpectedRemaining(i)} hoy</span>}</div><div className="mealprep-stepper"><button onClick={()=>eatPrepared(i)} aria-label="Restar una ración">−</button><b>{i.servings||i.qty||0}</b><button onClick={()=>addMealPrepServing(i)} aria-label="Añadir una ración">+</button></div></div>}
    {i.category!=="Preparados"&&i.stock!=="falta"&&<small className="consumption-quantity">Registrado: {i.qty} {i.unit}{consumption.source!=="unknown"&&i.location!=="Congelador"?" · estimado hoy: ≈ "+consumption.estimatedQty+" "+i.unit:(i.lastConfirmedAt&&daysUntil(i.lastConfirmedAt)>=-1?" · confirmado por ti":" · pendiente de comprobar")}</small>}<div className="inventory-actions"><button onClick={()=>openStockForm(i)}>Confirmar cantidad</button>{i.stock!=="falta"&&<button className="action-out" onClick={()=>setStock(i.id,"falta")}><span>🔴</span> Se acabó</button>}{i.stock!=="falta"&&<button className="action-low" onClick={()=>setStock(i.id,"poco")}><span>🟡</span> Queda poco</button>}{estimate.tone==="incierto"&&i.stock!=="falta"&&<button className="action-confirm" onClick={()=>confirmStillHere(i.id)}>✓ Sigue aquí</button>}{i.location==="Nevera"&&i.dateType==="caducidad"&&<button className="action-freeze" onClick={()=>freeze(i.id)}>🧊 Congelar</button>}{i.stock==="falta"&&<button className="action-buy" onClick={()=>addToBuy(i)}>🛒 Comprar</button>}{i.category==="Preparados"&&i.source!=="mealprep"&&i.stock!=="falta"&&<button className="action-eat" onClick={()=>eatPrepared(i)}>🍽 Comer 1</button>}{i.stock!=="falta"&&<button className="recipe-from-product" onClick={()=>openRecipes(i.name)}>🍴 Hacer receta</button>}{density==="detail"&&i.stock!=="falta"&&<button className="discard-product" onClick={()=>discardProduct(i)}>Tirar</button>}</div>{density==="detail"&&<div className="learn-location"><label><span>Guardar este producto en</span><select value={i.location} onChange={e=>moveProduct(i,e.target.value as Location)}><option value="Nevera">Nevera</option><option value="Congelador">Congelador</option><option value="Despensa">Despensa</option>{i.category==="Suplementos"&&<option value="Suplementos">Suplementos</option>}</select></label>{i.location==="Congelador"&&<><label><span>Uso previsto</span><select value={i.storageMode||"normal"} onChange={e=>setStorageMode(i,e.target.value as "normal"|"reserva")}><option value="normal">Uso normal</option><option value="reserva">Reserva / largo plazo</option></select></label>{i.storageMode==="reserva"&&state.events.filter(e=>e.date>=localDateIso()).length>0&&<label><span>Reservado para</span><select value={i.reservedFor||""} onChange={e=>setReservedFor(i,e.target.value)}><option value="">Sin evento concreto</option>{state.events.filter(e=>e.date>=localDateIso()).sort((a,b)=>a.date.localeCompare(b.date)).map(e=><option key={e.id} value={e.id}>{new Date(e.date+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})} · {e.title}</option>)}</select></label>}</>}<small>HomeOS aprende vuestra forma de guardar productos, pero mantiene separadas las reglas de conservación y los avisos de calidad.</small></div>}
   </article>
  })}</div>

  {preparedOpen&&<div className="modal-backdrop" onMouseDown={()=>setPreparedOpen(false)}><div className="modal prepared-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">PREPARADOS</span><h2>Guardar comida ya hecha</h2><p>Sobras, tuppers y meal prep en un único sitio.</p></div><button onClick={()=>setPreparedOpen(false)}>×</button></div><div className="voice-prepared-box"><button className={voiceListening?"voice-main listening":"voice-main"} onClick={startPreparedVoice}>{voiceListening?"Escuchando…":<>{micIcon()}<span>Añadir por voz</span></>}</button><span>Ej.: “Han sobrado 3 raciones de pollo con arroz y van a la nevera”.</span>{voiceDraft&&<small>Entendido: “{voiceDraft}”</small>}</div><div className="prepared-divider"><span>o manualmente</span></div><div className="prepared-form"><label><span>¿Qué es?</span><input autoFocus value={preparedName} onChange={e=>setPreparedName(e.target.value)} placeholder="Ej. pollo con arroz, lentejas…"/></label><label><span>Tipo</span><div className="prepared-kind"><button className={preparedKind==="sobras"?"active":""} onClick={()=>setPreparedKind("sobras")}>Preparado normal</button><button className={preparedKind==="mealprep"?"active":""} onClick={()=>setPreparedKind("mealprep")}>Meal prep</button></div></label><label><span>Raciones aproximadas</span><div className="stepper"><button onClick={()=>setPreparedServings(n=>Math.max(1,n-1))}>−</button><b>{preparedServings}</b><button onClick={()=>setPreparedServings(n=>n+1)}>+</button></div></label>{preparedKind==="mealprep"&&<label><span>Objetivo del meal prep</span><div className="mealprep-days"><button onClick={()=>setMealPrepDays(n=>Math.max(1,n-1))}>−</button><b>{mealPrepDays} días</b><button onClick={()=>setMealPrepDays(n=>Math.min(14,n+1))}>+</button></div><small>HomeOS mostrará el ritmo esperado, pero el consumo real lo corrige con − / + para no inventar comidas.</small></label>}<label><span>¿Dónde lo guardas?</span><div className="storage-choice"><button className={preparedLocation==="Nevera"?"active":""} onClick={()=>setPreparedLocation("Nevera")}>❄️ Nevera</button><button className={preparedLocation==="Congelador"?"active":""} onClick={()=>setPreparedLocation("Congelador")}>🧊 Congelador</button></div></label><div className="prepared-note">{preparedKind==="mealprep"?"Se guardará como meal prep separado de sobras/tuppers y tendrá control de raciones.":"HomeOS lo tratará como comida lista y la priorizará."} No inventaremos una fecha de seguridad si no tenemos datos suficientes.</div></div><button className="primary modal-save" disabled={!preparedName.trim()} onClick={savePrepared}>Guardar preparado</button></div></div>}
 </section>
}

function Finanzas({state,setState,available,monthlySpent}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;available:number;monthlySpent:number}){
 const [selectedCategory,setSelectedCategory]=useState<string|null>(null);
 const usedPct=Math.min(100,Math.round(monthlySpent/Math.max(1,state.budget)*100));
 const monthKey=localDateIso().slice(0,7);
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
  <div className="page-intro finance-intro"><div><span className="eyebrow">FINANZAS DE CASA</span><h2>Cuánto has gastado y cuánto te queda</h2><p>El presupuesto es lo que quieres gastar este mes en alimentación y hogar. No lo llamamos ahorro: simplemente es dinero que todavía queda disponible.</p></div><div className="finance-mode-switch"><small>MODO DE CÁLCULO · ¿CÓMO QUIERES REGISTRAR EL GASTO?</small><div><button className={state.profile.financeMode==="orientativo"?"active":""} onClick={()=>setState(s=>({...s,profile:{...s.profile,financeMode:"orientativo"}}))}>≈ Orientativo</button><button className={state.profile.financeMode==="preciso"?"active":""} onClick={()=>setState(s=>({...s,profile:{...s.profile,financeMode:"preciso"}}))}>= Preciso</button></div><p>{modeText}</p></div></div>

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
 const [themePeriod,setThemePeriod]=useState<"week"|"month">("month");
 const featuredTheme=themeForPeriod(themePeriod);
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
    <label><span>Consumo habitual</span><select value={m.appetite} onChange={e=>updateMember(m.id,{appetite:e.target.value as Member["appetite"]})}><option value="poco">Come poco</option><option value="normal">Normal</option><option value="mucho">Come bastante</option></select></label><label className="text-field"><span>Calorías/día orientativas</span><input type="number" min="1200" max="5000" step="50" value={m.dailyCalories||""} onChange={e=>{const v=Number(e.target.value)||0;updateMember(m.id,{dailyCalories:v?Math.max(1200,Math.min(5000,Math.round(v))):0})}} placeholder="Opcional · ej. 2200"/><small>Si no sabes este dato, déjalo vacío: HomeOS usará ≈ 2.000 kcal como referencia general, no como objetivo médico.</small></label>
    <label className="text-field"><span>No le gusta / evita</span><input value={m.dislikes} onChange={e=>updateMember(m.id,{dislikes:e.target.value})} placeholder="Ej. queso, frankfurt, hamburguesa…"/><small>Se usa para avisar y priorizar recetas que encajen mejor con esta persona.</small></label>
    <label className="text-field"><span>Nota útil</span><textarea value={m.notes} onChange={e=>updateMember(m.id,{notes:e.target.value})} placeholder="Ej. come fuera entre semana, suele llevar tupper…"/></label>
    <div className="member-summary"><b>{presenceText(m.presence)}</b><span>{appetiteText(m.appetite)}</span></div>
   </article>)}</div>:<div className="settings-list improved-settings">
    <label><span>Personas del hogar</span><select value={draft.profile.householdSize} onChange={e=>setDraft(s=>{const householdSize=Number(e.target.value);return {...s,profile:{...s.profile,householdSize},members:ensureMembers(s.members,householdSize)}})}>{[1,2,3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></label>
    {members.length>1&&<label><span>Identidad de este dispositivo</span><select value={members.some(m=>m.id===draftDeviceMemberId)?draftDeviceMemberId:(members[0]?.id||"")} onChange={e=>setDraftDeviceMemberId(e.target.value)}>{members.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select><small>Se configura una vez: todo lo que añadas desde este móvil u ordenador queda asociado automáticamente a esta persona.</small></label>}
    <label><span>Estilo habitual de cocina</span><select value={draft.profile.cooking} onChange={e=>setDraft(s=>({...s,profile:{...s.profile,cooking:e.target.value as CookingStyle}}))}><option value="rapido">Rápida</option><option value="normal">Normal</option><option value="cocinar">Me gusta cocinar</option><option value="mealprep">Meal prep</option></select></label>
    <label><span>Hábitos de alimentación</span><select value={draft.profile.nutrition} onChange={e=>setDraft(s=>({...s,profile:{...s.profile,nutrition:e.target.value as NutritionMode}}))}><option value="basica">Mostrar tendencias</option><option value="off">Ocultar</option></select><small>Analiza compras y recetas como señales; no sustituye una valoración nutricional.</small></label>
    <label><span>Compra habitual</span><select value={draft.profile.shoppingCycle} onChange={e=>setDraft(s=>({...s,profile:{...s.profile,shoppingCycle:e.target.value as Profile["shoppingCycle"]}}))}><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option><option value="mixta">Grande + compras rápidas</option><option value="diaria">Frecuente</option></select></label>

    <div className="profile-market-section"><span>Supermercados habituales</span><p>Toca una tienda seleccionada para quitarla de habituales. Las compras registradas se conservan.</p><div className="profile-market-grid">{[...new Set([...SUPERMARKETS,...draft.profile.supermarkets])].map(m=><button type="button" key={m} aria-pressed={draft.profile.supermarkets.includes(m)} className={(draft.profile.supermarkets.includes(m)?"active ":"")+"market-choice"} onClick={()=>setDraft(s=>{const supermarkets=s.profile.supermarkets.includes(m)?s.profile.supermarkets.filter(x=>x!==m):[...s.profile.supermarkets,m];const mainSupermarket=supermarkets.includes(s.profile.mainSupermarket)?s.profile.mainSupermarket:(supermarkets[0]||"");return {...s,profile:{...s.profile,supermarkets,mainSupermarket}}})}>{m}</button>)}</div></div>

    <div className="profile-market-section kitchen-tools-setting"><span>Qué tienes para cocinar</span><p>HomeOS muestra las formas de preparación compatibles cuando la receta las tiene disponibles.</p><div className="profile-market-grid">{KITCHEN_TOOLS.map(t=><button type="button" key={t} className={draft.profile.kitchenTools.includes(t)?"active":""} onClick={()=>toggleTool(t)}>{t}</button>)}</div></div>
   </div>}

  <section className="sync-settings"><div className="sync-settings-head"><div><small>HOGAR COMPARTIDO</small><h3>Sincronización entre dispositivos</h3><p>{syncCreds?"Compra, inventario, calendario y perfiles se guardan para toda la casa.":"HomeOS está preparando el hogar compartido."}</p></div><span className={"sync-state "+syncStatus}>{syncStatus==="synced"?"Sincronizado":syncStatus==="connecting"?"Guardando…":syncStatus==="error"?"Sin conexión":"Local"}</span></div>{syncCreds&&<div className="sync-actions"><button type="button" className="secondary" onClick={copyHomeCode}>Copiar código para otro dispositivo</button><button type="button" className="secondary" onClick={syncNow}>Sincronizar ahora</button></div>}<details className="join-details"><summary>Conectar este dispositivo a otro hogar</summary><div className="join-inline"><input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="HOS1.…"/><button type="button" onClick={joinOther} disabled={!joinCode.trim()||syncStatus==="connecting"}>Conectar</button></div>{joinError&&<span className="form-error">{joinError}</span>}</details></section>
  </div>

  <div className="modal-actions sticky-actions"><button type="button" className="secondary" onClick={cancel}>Cancelar</button><button type="button" className="primary" disabled={!dirty} onClick={save}>{dirty?"Guardar cambios":"Sin cambios"}</button></div>
 </div></div>
}
