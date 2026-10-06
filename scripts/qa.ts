import { readFileSync } from "node:fs";
import { classifyProduct, detectProductsInText, freezerQualityGuide } from "../lib/product-engine";
import { parseReceiptText } from "../lib/receipt-local";
import { EXTRA_RECIPES } from "../lib/extra-recipes";
import { REUSE_IDEAS } from "../lib/reuse-engine";
import { estimateShelfLifeFromReference, LIDL_2026_SHELF_LIFE, shelfLifeBandFromReference, shelfLifeReferenceDays } from "../lib/shelf-life-calibration";
import { buildWeeklyMenu } from "../lib/weekly-menu";
import { buildLocalAiPrompt, LOCAL_AI_MODEL, LOCAL_AI_MOBILE_FALLBACK_MODEL, LOCAL_AI_MOBILE_MODEL, parseLocalAiResponse, sanitizeLocalAiRecipes } from "../lib/local-ai";
import { prebuiltAppConfig } from "@mlc-ai/web-llm";
import { mergeAdditiveCounter, mergeThreeWay } from "../lib/sync-merge";
import { connectionCode, parseConnectionCode } from "../lib/homeos-sync";
import { freeInventoryAfterReservations, planFromBase, planToBase, recipeShortages, remainingSourcesAfterPurchase, removePlanFromSources, sumSources } from "../lib/recipe-plan-engine";

function assert(condition:any,message:string){
 if(!condition)throw new Error("QA: "+message);
}
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
