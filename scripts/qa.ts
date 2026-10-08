import { RECIPES } from "../lib/recipes";
import { habitBalanceSignals } from "../lib/habit-balance";
import { parseShoppingQuantity, splitShoppingEntries } from "../lib/shopping-input";
import { readFileSync } from "node:fs";
import { classifyProduct, detectProductsInText, freezerQualityGuide } from "../lib/product-engine";
import { mergeReceiptCandidates, parseReceiptText } from "../lib/receipt-local";
import { EXTRA_RECIPES } from "../lib/extra-recipes";
import { REUSE_IDEAS } from "../lib/reuse-engine";
import { estimateShelfLifeFromReference, LIDL_2026_SHELF_LIFE, shelfLifeBandFromReference, shelfLifeReferenceDays } from "../lib/shelf-life-calibration";
import { buildWeeklyMenu, resolveCalorieReference } from "../lib/weekly-menu";
import { buildLocalAiPrompt, LOCAL_AI_MODEL, LOCAL_AI_MOBILE_FALLBACK_MODEL, LOCAL_AI_MOBILE_MODEL, parseLocalAiResponse, sanitizeLocalAiRecipes } from "../lib/local-ai";
import { prebuiltAppConfig } from "@mlc-ai/web-llm";
import { mergeAdditiveCounter, mergeThreeWay, mergeHouseholdState } from "../lib/sync-merge";
import { connectionCode, parseConnectionCode } from "../lib/homeos-sync";
import { localDateIso, calendarDaysUntil } from "../lib/local-date";
import { readBrowserStorage, writeBrowserStorage, removeBrowserStorage } from "../lib/browser-storage";
import { parsePlanQty, freeInventoryAfterReservations, planFromBase, planToBase, recipeShortages, remainingSourcesAfterPurchase, resizeShoppingSources, removePlanFromSources, sumSources } from "../lib/recipe-plan-engine";

function assert(condition:any,message:string){
 if(!condition)throw new Error("QA: "+message);
}
assert(readBrowserStorage("qa")===null&&!writeBrowserStorage("qa","x"),"storage helpers must work safely during server rendering");
const deniedStorage={getItem(){throw new Error("denied")},setItem(){throw new Error("quota")},removeItem(){throw new Error("denied")}};
Object.defineProperty(globalThis,"window",{value:{localStorage:deniedStorage},configurable:true});
assert(readBrowserStorage("qa")===null&&!writeBrowserStorage("qa","x")&&!removeBrowserStorage("qa"),"denied or full browser storage must not crash the app");
delete (globalThis as any).window;
const auditedServiceWorker=readFileSync(new URL("../public/sw.js",import.meta.url),"utf8");
assert(auditedServiceWorker.includes('k.startsWith("homeos-shell-")'),"app updates must preserve unrelated caches, including downloaded local AI models");
function product(name:string,category:string,location:string){
 const p=classifyProduct(name);
 assert(p.category===category,name+" category expected "+category+" got "+p.category);
 assert(p.location===location,name+" location expected "+location+" got "+p.location);
}

const cases:[string,string,string][]=[
 ["lechuga","Fruta y verdura","Nevera"],
 ["lechuga iceberg","Fruta y verdura","Nevera"],
 ["tomate cherry","Fruta y verdura","Nevera"],
 ["pechuga de pollo","Carne","Nevera"],
 ["pechuga de pavo","Carne","Nevera"],
 ["hamburguesa de vacuno","Carne","Nevera"],
 ["hamburguesa vegetal","Preparados","Nevera"],
 ["pan de hamburguesa","Despensa","Despensa"],
 ["entrecot","Carne","Nevera"],
 ["solomillo de cerdo","Carne","Nevera"],
 ["mozzarella rallada","Lácteos","Nevera"],
 ["burrata","Lácteos","Nevera"],
 ["queso brie","Lácteos","Nevera"],
 ["yogur griego","Lácteos","Nevera"],
 ["tofu","Preparados","Nevera"],
 ["seitán","Preparados","Nevera"],
 ["patatas fritas congeladas","Congelados","Congelador"],
 ["croquetas congeladas","Congelados","Congelador"],
 ["croquetas frescas","Preparados","Nevera"],
 ["pescado congelado","Congelados","Congelador"],
 ["pizza fresca","Preparados","Nevera"],
 ["pizza congelada","Congelados","Congelador"],
 ["tomate frito","Despensa","Despensa"],
 ["atún en lata","Despensa","Despensa"],
 ["leche fresca","Lácteos","Nevera"],
 ["leche condensada","Despensa","Despensa"],
 ["bebida de avena","Bebidas","Despensa"],
 ["kombucha","Bebidas","Nevera"],
 ["edamame","Congelados","Congelador"],
 ["soja texturizada","Despensa","Despensa"],
 ["detergente lavadora","Limpieza y hogar","Despensa"],
 ["suavizante","Limpieza y hogar","Despensa"],
 ["perfume","Higiene y cuidado","Despensa"],
 ["pasta de dientes","Higiene y cuidado","Despensa"],
 ["papel higiénico","Limpieza y hogar","Despensa"],
 ["creatina","Suplementos","Suplementos"],
 ["chocolate con leche","Snacks y dulces","Despensa"],
 ["chocolate con almendras","Snacks y dulces","Despensa"],
 ["kale","Fruta y verdura","Nevera"],
 ["pak choi","Fruta y verdura","Nevera"]
];
cases.forEach(([a,b,c])=>product(a,b,c));

const unknown=classifyProduct("producto marciano xyz");
assert(unknown.category==="Por clasificar","unknown product must not silently become pantry");
assert(unknown.location==="Sin ubicar","unknown product must remain unlocated");

const mentioned=detectProductsInText("Tengo leche y yogur natural y quiero aprovechar ambos");
assert(mentioned.some(x=>x.canonical.includes("leche")),"voice context should detect milk");
assert(mentioned.some(x=>x.canonical.includes("yogur")),"voice context should detect yogurt");

const burgerGuide=freezerQualityGuide("hamburguesa de vacuno","Carne","Hamburguesa");
assert(burgerGuide?.maxMonths===4,"burger freezer guide should exist");

const receipt=parseReceiptText([
 "MERCADONA",
 "LECHE SEMI 1L 1,05",
 "YOGUR NATURAL 1,75",
 "2 X PLATANO 3,20",
 "TOTAL 6,00",
 "TARJETA 6,00"
].join("\n"));
assert(receipt.total===6,"receipt total should parse");
assert(receipt.items.length===3,"receipt should parse 3 product lines");
assert(receipt.items.some(x=>x.name.toLowerCase().includes("leche")),"receipt should include milk");
assert(receipt.items.some(x=>x.qty===2),"receipt should parse x2 quantity");
const dottedReceipt=parseReceiptText("LECHE 2.50\nDEVOLUCION -1.50\nTOTAL 2.50\nSUBTOTAL 10.00");
assert(dottedReceipt.total===2.5,"receipt decimal points must not inflate totals or accept SUBTOTAL as TOTAL");
assert(dottedReceipt.items.length===1&&dottedReceipt.items[0].price===2.5,"refunds must not become positive purchases");
assert(parseReceiptText("TOTAL 2,50").total===2.5,"comma decimals remain supported");
const lateToday=new Date(2026,9,8,0,15);
assert(localDateIso(lateToday)==="2026-10-08","calendar dates must use local midnight rather than UTC");
assert(calendarDaysUntil("2026-10-08",lateToday)===0&&calendarDaysUntil("2026-10-09",lateToday)===1,"expiry days must not change depending on the current hour");
assert(calendarDaysUntil("2026-10-07",new Date(2026,9,8,23,59))===-1,"yesterday is expired for the entire local day");
const mergedReceipt=mergeReceiptCandidates(
 [{name:"Leche",qty:1,price:1.25,raw:"LECHE 1,25"}],
 [{name:"Leche",qty:1,price:1.25,raw:"LECHE 1,25"},{name:"Pan",qty:1,price:1.1,raw:"PAN 1,10"}]
);
assert(mergedReceipt.length===2,"overlapping ticket photos should not duplicate the exact same detected line");
assert(mergedReceipt.some(x=>x.name==="Pan"),"multi-photo ticket merge should keep new lines from later photos");

assert(EXTRA_RECIPES.length>=30,"local recipe book should have at least 30 extra recipes");
assert(REUSE_IDEAS.length>=8,"reuse library should have at least 8 verified ideas");
assert(EXTRA_RECIPES.some(r=>r.ingredients.some(i=>/yogur/i.test(i.name))&&r.ingredients.some(i=>/leche/i.test(i.name))),"recipe book should cover milk + yogurt together");
assert(LIDL_2026_SHELF_LIFE.length>=50,"real Lidl shelf-life calibration should contain at least 50 observed references");
assert(shelfLifeBandFromReference("pan de hamburguesa")==="corta","burger buns should calibrate as short shelf life");
assert(shelfLifeBandFromReference("macarrones")==="larga","dry pasta should calibrate as long shelf life");
assert((shelfLifeReferenceDays("bebida de avena barista")||0)>150,"barista oat drink should use observed long shelf-life reference");
assert(LIDL_2026_SHELF_LIFE.some(x=>x.name==="batido proteínas"&&x.label==="02/2028"),"protein drink must preserve the observed 02/2028 label");
assert(LIDL_2026_SHELF_LIFE.some(x=>x.name==="queso"&&x.exactDate==="2026-11-19"),"cheese must preserve the corrected 19/11/2026 label");
assert(LIDL_2026_SHELF_LIFE.some(x=>x.name==="almendras"&&x.confidence==="media"&&!x.exactDate),"almonds 29/03 must remain incomplete instead of inventing a year");
assert(estimateShelfLifeFromReference("pollo","2026-10-07")===null,"fresh chicken must not inherit a broth date");
assert(estimateShelfLifeFromReference("caldo de pollo","2026-10-07")?.kind==="preferente","broth retains its own reference");
const oatEstimate=estimateShelfLifeFromReference("bebida de avena barista","2026-10-06");
assert(oatEstimate?.date==="2027-05-02","estimated oat drink date should reproduce the observed reference on the observation date");
assert(oatEstimate?.kind==="preferente","estimated oat drink must remain a best-before estimate, not an expiry guarantee");


const menu=buildWeeklyMenu(EXTRA_RECIPES,{
 inventory:["pechuga de pollo","arroz","tomate","yogur natural","patatas","huevos","garbanzos"],
 dislikes:["queso azul"],
 tools:["Placa / inducción","Horno","Air fryer"],
 people:4
});
assert(menu.slots.length===21,"weekly menu should create breakfast, lunch and dinner for 7 days");
assert(new Set(menu.slots.map(x=>x.day)).size===7,"weekly menu should cover all 7 days");
assert(menu.slots.filter(x=>x.meal==="Desayuno").length===7,"weekly menu should include 7 breakfasts");
assert(menu.slots.filter(x=>x.meal==="Comida").length===7,"weekly menu should include 7 lunches");
assert(menu.slots.filter(x=>x.meal==="Cena").length===7,"weekly menu should include 7 dinners");
const threeMealPlan=buildWeeklyMenu([
 {id:"breakfast",title:"Avena con yogur y fruta",time:8,servings:2,calories:380,protein:18,ingredients:[{name:"Avena",qty:"100 g",key:"avena"},{name:"Yogur",qty:"2 uds",key:"yogur"}],mode:["rapido"]},
 {id:"lunch",title:"Pollo con arroz y verduras",time:30,servings:4,calories:700,protein:45,ingredients:[{name:"Pollo",qty:"600 g",key:"pollo"},{name:"Arroz",qty:"300 g",key:"arroz"},{name:"Verduras",qty:"400 g",key:"verdura"}],mode:["normal"]},
 {id:"dinner",title:"Merluza con verduras",time:20,servings:4,calories:480,protein:38,ingredients:[{name:"Merluza",qty:"500 g",key:"merluza"},{name:"Verduras",qty:"400 g",key:"verdura"}],mode:["normal"]}
],{inventory:[],dislikes:[],tools:[],people:2,dailyCalories:2000,balancedGoal:true});
assert(threeMealPlan.slots.length===21,"three-meal weekly planning should fill all 21 moments");
assert(threeMealPlan.slots.filter(x=>x.meal==="Desayuno").every(x=>x.recipeId==="breakfast"),"breakfast slots should prefer breakfast-like recipes when available");
const defaultCaloriePlan=buildWeeklyMenu([
 {id:"breakfast-ref",title:"Avena con fruta",time:8,servings:2,calories:500,protein:16,ingredients:[{name:"Avena",qty:"100 g",key:"avena"}],mode:["rapido"]},
 {id:"lunch-ref",title:"Pollo con arroz y verduras",time:30,servings:2,calories:800,protein:40,ingredients:[{name:"Pollo",qty:"300 g",key:"pollo"},{name:"Arroz",qty:"160 g",key:"arroz"}],mode:["normal"]},
 {id:"dinner-ref",title:"Pescado con verduras",time:20,servings:2,calories:700,protein:35,ingredients:[{name:"Pescado",qty:"300 g",key:"pescado"},{name:"Verduras",qty:"250 g",key:"verdura"}],mode:["normal"]}
],{inventory:[],dislikes:[],tools:[],people:1,balancedGoal:true});
assert(defaultCaloriePlan.slots.length===21,"weekly menu should still use a calorie reference when the user does not know their target");
const generalRef=resolveCalorieReference([0],true);
assert(generalRef.source==="general"&&generalRef.dailyCalories===2000,"unknown calorie needs should use the 2000 kcal general reference");
const mixedRef=resolveCalorieReference([2400,0],true);
assert(mixedRef.source==="mixed"&&mixedRef.dailyCalories===2200,"mixed households should average configured values with the general reference for unknown members");
const invalidRef=resolveCalorieReference([800,9999],true);
assert(invalidRef.source==="general"&&invalidRef.dailyCalories===2000,"invalid calorie values should fall back safely instead of distorting the menu");
const offRef=resolveCalorieReference([2400,0],false);
assert(offRef.enabled===false&&offRef.dailyCalories===undefined&&offRef.source==="off","turning nutrition guidance off must disable calorie guidance completely");
const savingMenu=buildWeeklyMenu([
 {id:"cheap",title:"Plato sencillo",time:20,servings:4,ingredients:[{name:"Arroz",qty:"300 g",key:"arroz"}],mode:["normal"]},
 {id:"expensive",title:"Plato premium",time:20,servings:4,ingredients:[{name:"Arroz",qty:"300 g",key:"arroz"}],mode:["normal"]}
],{inventory:[],dislikes:[],tools:[],people:2,budgetPressure:true,costByRecipe:{cheap:2,expensive:18}});
assert(savingMenu.slots.some(x=>x.recipeId==="cheap"),"save-priority menu should include the lower known-cost option when recipes otherwise fit equally");

const shortages=recipeShortages([{name:"Leche",qty:"500 ml",key:"leche"},{name:"Huevos",qty:"4 uds",key:"huevo"}],[{name:"Leche",qty:0.2,unit:"L",category:"Lácteos",stock:"hay"},{name:"Huevos",qty:2,unit:"ud",category:"Lácteos",stock:"hay"}]);
assert(shortages.some(x=>x.key==="leche"&&x.missing===300),"recipe shortage should subtract 200 ml already at home");
assert(shortages.some(x=>x.key==="huevo"&&x.missing===2),"recipe shortage should subtract eggs already at home");
const sourceTotal=sumSources([{id:"m",type:"manual",label:"Habitual",qty:1,unit:"L"},{id:"r",type:"recipe",label:"Receta",qty:500,unit:"ml",planId:"p1"}],"L");
assert(sourceTotal===1.5,"shopping sources should merge compatible recipe and manual quantities");
const sharedSources=[{id:"m1",type:"manual" as const,label:"Fran",qty:1,unit:"L"},{id:"m2",type:"manual" as const,label:"Hugo",qty:500,unit:"ml"}];
assert(sumSources(resizeShoppingSources(sharedSources,2.5,"L"),"L")===2.5,"increasing a shared shopping line must preserve its total across contributors");
assert(sumSources(resizeShoppingSources(sharedSources,.5,"L"),"L")===.5,"reducing a shared shopping line must consume a quantity once");
assert(sumSources(remainingSourcesAfterPurchase(sharedSources,.5,"L"),"L")===1,"already-have confirmation must not subtract its quantity from every contributor");
assert(planFromBase(planToBase(1,"L"),"ml")===1000,"shopping unit conversion must preserve 1 L as 1000 ml");
assert(planFromBase(planToBase(750,"g"),"kg")===0.75,"shopping unit conversion must preserve 750 g as 0.75 kg");
const remainingSources=removePlanFromSources([{id:"m",type:"manual",label:"Habitual",qty:1,unit:"L"},{id:"r",type:"recipe",label:"Receta",qty:500,unit:"ml",planId:"p1"}],"p1");
assert(remainingSources.length===1&&remainingSources[0].type==="manual","cancelling a recipe must preserve manual shopping demand");
const aiParsed=parseLocalAiResponse('prefix [{"title":"Tortilla rápida","description":"Simple","time":12,"servings":2,"ingredients":[{"name":"Huevos","qty":"4 uds","key":"huevo"}],"steps":["Batir","Cuajar"],"tools":["Sartén"]}] suffix',2);
assert(aiParsed.length===1&&aiParsed[0].title==="Tortilla rápida","local AI parser should recover a valid JSON array from model text");
const aiClamped=sanitizeLocalAiRecipes([{title:"X",time:999,servings:99,ingredients:[{name:"Leche",qty:"1 L",key:"leche"}],steps:["Mezclar"]}],4);
assert(aiClamped[0].time===180&&aiClamped[0].servings===12,"local AI sanitizer should clamp unreasonable time and serving values");
let badAiShape=false;try{sanitizeLocalAiRecipes([{title:"Vacía",ingredients:[],steps:[]}],2)}catch{badAiShape=true}
assert(badAiShape,"local AI sanitizer should reject recipes without usable ingredients or steps");
let unmeasurableAi=false;try{sanitizeLocalAiRecipes([{title:"Sal",ingredients:[{name:"Sal",qty:"al gusto",key:"sal"}],steps:["Mezclar"]}])}catch{unmeasurableAi=true}
assert(unmeasurableAi,"generated recipes must have measurable ingredients so they can be cooked and deducted");
assert(LOCAL_AI_MOBILE_MODEL==="SmolLM2-360M-Instruct-q4f32_1-MLC","mobile local AI should use the broadly compatible q4f32 WebLLM model");
const aiCasaPrompt=buildLocalAiPrompt({request:"Quiero cenar",inventory:["Huevos"],people:2,dislikes:[],tools:["Sartén"],mode:"normal",scope:"casa"});
const aiPlanPrompt=buildLocalAiPrompt({request:"Quiero una lasaña",inventory:["Huevos"],people:2,dislikes:[],tools:["Horno"],mode:"normal",scope:"planear"});
assert(aiCasaPrompt.system.includes("CON LO QUE HAY")&&aiCasaPrompt.system.includes("minimiza ingredientes faltantes"),"Casa AI mode must strongly prefer current inventory");
assert(aiPlanPrompt.system.includes("PLANIFICANDO")&&aiPlanPrompt.system.includes("puedes incluir ingredientes faltantes"),"planning AI mode must allow sensible missing ingredients");
const webllmModels=new Set((prebuiltAppConfig?.model_list||[]).map((m:any)=>m.model_id));
assert(webllmModels.has(LOCAL_AI_MODEL),"desktop local AI model must exist in installed WebLLM catalog");
assert(webllmModels.has(LOCAL_AI_MOBILE_MODEL),"mobile local AI model must exist in installed WebLLM catalog");
assert(webllmModels.has(LOCAL_AI_MOBILE_FALLBACK_MODEL),"mobile fallback local AI model must exist in installed WebLLM catalog");
const syncBase={shopping:[{id:"a",name:"Leche",qty:1}],profile:{cooking:"rapido"}};
const syncLocal={shopping:[{id:"a",name:"Leche",qty:1},{id:"b",name:"Pan",qty:1}],profile:{cooking:"rapido"}};
const syncRemote={shopping:[{id:"a",name:"Leche",qty:2}],profile:{cooking:"normal"}};
const syncMerged=mergeThreeWay(syncBase,syncLocal,syncRemote);
assert(syncMerged.shopping.some((x:any)=>x.id==="b")&&syncMerged.shopping.find((x:any)=>x.id==="a")?.qty===2,"three-way sync should preserve an independent local addition and remote edit");
assert(syncMerged.profile.cooking==="normal","three-way sync should accept a remote field when local left it unchanged");
const changesDuringWrite={...syncLocal,shopping:[...syncLocal.shopping,{id:"c",name:"Arroz",qty:1}]};
const afterWrite=mergeThreeWay(syncLocal,changesDuringWrite,syncMerged);
assert(afterWrite.shopping.some((x:any)=>x.id==="c")&&afterWrite.shopping.find((x:any)=>x.id==="a")?.qty===2,"edits made while resolving a sync conflict must survive the write response");
const resumed=mergeHouseholdState({...syncBase,spent:10},{...changesDuringWrite,spent:15},{...syncRemote,spent:17});
assert(resumed.spent===22&&resumed.shopping.some((x:any)=>x.id==="c"),"reopening after offline edits must preserve unsent additions and combine independent expenses once");
const sharedStores=mergeThreeWay(["Mercadona","Lidl"],["Mercadona"],["Mercadona","Lidl","Dia"]);
assert(!sharedStores.includes("Lidl")&&sharedStores.includes("Dia"),"sync must preserve a removed supermarket alongside another device's new supermarket");
const deleted=mergeThreeWay([{id:"a",qty:1}],[],[{id:"a",qty:1}]);
assert(deleted.length===0,"three-way sync should preserve a deletion when the other device did not edit the item");
const deletionConflict=mergeThreeWay([{id:"a",qty:1}],[],[{id:"a",qty:2}]);
assert(deletionConflict[0]?.qty===2,"three-way sync should preserve changed data rather than silently losing it on delete/edit conflict");
assert(mergeAdditiveCounter(100,120,130)===150,"additive counters should combine independent device deltas");
const fakeCreds={householdId:"123e4567-e89b-12d3-a456-426614174000",token:"12345678901234567890123456789012"};
assert(JSON.stringify(parseConnectionCode(connectionCode(fakeCreds)))===JSON.stringify(fakeCreds),"household connection code should round-trip");
assert(parseConnectionCode("HOS1.bad.short")===null,"invalid household connection codes must be rejected");
const manifest=JSON.parse(readFileSync("public/manifest.webmanifest","utf8"));
assert(manifest.name==="HomeOS"&&manifest.short_name==="HomeOS","PWA manifest must use the HomeOS identity");
assert(manifest.display==="standalone"&&manifest.start_url==="/","PWA manifest must install as a standalone app from root");
assert(Array.isArray(manifest.icons)&&manifest.icons.some((x:any)=>String(x.src||"").includes("/icon.svg")),"PWA manifest must include the HomeOS icon");
const serviceWorker=readFileSync("public/sw.js","utf8");
new Function(serviceWorker);
assert(serviceWorker.includes("/manifest.webmanifest")&&serviceWorker.includes("/icon.svg"),"service worker shell must cache the current manifest and icon");
const reservedMilk=freeInventoryAfterReservations([{name:"Leche",qty:1,unit:"L",category:"Lácteos",stock:"hay",planReservations:[{id:"r1",type:"recipe",label:"Tortitas",qty:500,unit:"ml",planId:"p1"}]}],["p1"]);
assert(reservedMilk[0].qty===0.5,"general suggestions must not spend milk reserved for a recipe");
const ownerMilk=freeInventoryAfterReservations([{name:"Leche",qty:1,unit:"L",category:"Lácteos",stock:"hay",planReservations:[{id:"r1",type:"recipe",label:"Tortitas",qty:500,unit:"ml",planId:"p1"}]}],["p1"],"p1");
assert(ownerMilk[0].qty===1,"the owning recipe must see its own reserved ingredient");
const mixedReservations=freeInventoryAfterReservations([{name:"Huevos",qty:6,unit:"ud",category:"Lácteos",stock:"hay",planReservations:[{id:"a",type:"recipe",label:"A",qty:2,unit:"ud",planId:"p1"},{id:"b",type:"recipe",label:"B",qty:3,unit:"ud",planId:"p2"}]}],["p1","p2"],"p1");
assert(mixedReservations[0].qty===3,"a recipe may use its own reservation but must respect another recipe reservation");
const partial=remainingSourcesAfterPurchase([{id:"recipe",type:"recipe",label:"Tortilla",qty:6,unit:"ud",planId:"p1"},{id:"manual",type:"manual",label:"Habitual",qty:4,unit:"ud"}],4,"ud");
assert(partial.find(x=>x.id==="recipe")?.qty===2&&partial.find(x=>x.id==="manual")?.qty===4,"partial purchase should fulfil planned recipe demand first and preserve the rest");
const mostlyBought=remainingSourcesAfterPurchase([{id:"recipe",type:"recipe",label:"Tortilla",qty:6,unit:"ud",planId:"p1"},{id:"manual",type:"manual",label:"Habitual",qty:4,unit:"ud"}],8,"ud");
assert(!mostlyBought.some(x=>x.id==="recipe")&&mostlyBought.find(x=>x.id==="manual")?.qty===2,"buying most of a mixed line should leave only the unmet habitual quantity");


console.log("HomeOS QA passed:",cases.length,"product classifications,",EXTRA_RECIPES.length,"extra recipes,",REUSE_IDEAS.length,"reuse ideas,",LIDL_2026_SHELF_LIFE.length,"shelf-life samples, weekly menu 21/21");

// Real family shorthand must keep quantities and decimal commas.
const quickInputs = [
 ["2 yogures", "yogures", 2, "uds"],
 ["dos yogures", "yogures", 2, "uds"],
 ["1 kg de pollo", "pollo", 1, "kg"],
 ["0,5 kg de pollo", "pollo", .5, "kg"],
 ["medio kilo de pollo", "pollo", .5, "kg"],
 ["500 ml de leche", "leche", 500, "ml"],
 ["media docena de huevos", "huevos", 6, "uds"]
] as const;
for(const [input,name,qty,unit] of quickInputs){const p=parseShoppingQuantity(input);assert(p.name===name&&p.qty===qty&&p.unit===unit,"shopping shorthand: "+input)}
assert(splitShoppingEntries("leche, 2 yogures y 0,5 kg de pollo").length===3,"decimal comma must not split a product");
assert(splitShoppingEntries("leche\nyogur\npollo").length===3,"newline-separated products must stay separate");
product("pollo","Carne","Nevera");
product("caldo de pollo","Despensa","Despensa");
const habitNow=new Date(2026,9,7,10);
const record=(date:string,name:string)=>({date,ingredients:[{name}]});
const oldMeals=Array.from({length:8},()=>record("2026-09-25","chocolate"));
assert(habitBalanceSignals({mealHistory:oldMeals},habitNow).every(x=>x.tone==="learning"),"7-day overview must exclude older meals");
const habitMeals=[record("2026-10-01","pollo"),record("2026-10-07","huevo"),record("2026-10-06","tomate"),record("2026-10-05","chocolate")];
const balance=habitBalanceSignals({mealHistory:[...oldMeals,...habitMeals,record("2026-10-08","chocolate")]},habitNow);
assert(balance.find(x=>x.key==="protein")?.ratio===.5,"habits must include today and six prior calendar days, but exclude future dates");
assert(balance.find(x=>x.key==="sweets")?.ratio===.25,"habits bar must reflect recorded meals, not a fixed decoration");
console.log("Family-flow regression checks passed: shorthand quantities, decimals, product routing, real 7-day habits");

// Check every built-in recipe, not just a representative sample.
assert(new Set(RECIPES.map(r=>r.id)).size===RECIPES.length,"recipe IDs must be unique");
for(const recipe of RECIPES){
 assert(recipe.title.trim().length>0&&recipe.steps.length>=2,"recipe content: "+recipe.id);
 assert(recipe.time>0&&recipe.servings>0&&recipe.mode.length>0,"recipe metadata: "+recipe.id);
 const ingredients=recipe.ingredients.map(i=>{const q=parsePlanQty(i.qty);assert(q&&q.amount>0,"ingredient quantity: "+recipe.id+" "+i.name);return {name:i.name,qty:q!.amount,unit:q!.unit,category:classifyProduct(i.name).category,stock:"hay"}});
 assert(recipeShortages(recipe.ingredients,[]).length===recipe.ingredients.length,"empty inventory must show every shortage: "+recipe.id);
 assert(recipeShortages(recipe.ingredients,ingredients).length===0,"full inventory must make recipe possible: "+recipe.id);
 const half=ingredients.map(i=>({...i,qty:i.qty/2}));
 const halfMissing=recipeShortages(recipe.ingredients,half);
 assert(halfMissing.every(i=>Number.isFinite(i.missing)&&i.missing>0),"partial inventory must have positive finite deficits: "+recipe.id);
}
for(const people of [1,2,4,6]){
 const plan=buildWeeklyMenu(RECIPES,{inventory:[],dislikes:[],tools:["Placa / inducción","Horno","Microondas","Batidora"],people});
 assert(plan.slots.length===21&&plan.slots.every(slot=>RECIPES.some(r=>r.id===slot.recipeId)),"weekly plan must reference real recipes for household "+people);
}
console.log("All",RECIPES.length,"recipes verified against empty, full and partial inventory; weekly menus for 1/2/4/6 people");
