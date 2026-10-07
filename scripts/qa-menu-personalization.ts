import {retireWeeklyMenu} from "../lib/retire-weekly-menu";
import {RECIPE_THEMES,themeRecipes,themeForMonth,themeForPeriod} from "../lib/recipe-themes";
import {sumSources} from "../lib/recipe-plan-engine";
import assert from "node:assert/strict";
import { RECIPES } from "../lib/recipes";
import { DEFAULT_MENU_PREFERENCES, parseMenuBriefing } from "../lib/menu-preferences";
import { buildWeeklyMenu, recipeAllowed, type WeeklyMenuOptions } from "../lib/weekly-menu";
import { PRODUCT_VARIETIES } from "../lib/product-varieties";
import { classifyProduct, registeredProductNames } from "../lib/product-engine";
const opts:WeeklyMenuOptions={inventory:[],dislikes:[],tools:["Placa / inducción","Horno","Batidora"],people:2,seed:123,preferences:DEFAULT_MENU_PREFERENCES};
assert(RECIPES.length>=500);
assert(PRODUCT_VARIETIES.length>=1000);
assert(new Set(PRODUCT_VARIETIES.map(p=>p.name)).size===PRODUCT_VARIETIES.length);
for(const v of PRODUCT_VARIETIES){const p=classifyProduct(v.name);assert(p.category!=="Por clasificar",v.name);assert(p.canonical===v.name,v.name)}
assert(registeredProductNames().length>1000);
const originalNames=new Set(RECIPES.map(r=>r.title));
assert(originalNames.size===RECIPES.length);
for(const r of RECIPES){assert(r.steps.length>=3&&r.ingredients.length>=2,r.title);assert(r.calories>0&&Number.isFinite(r.calories),r.title)}
for(let seed=1;seed<=20;seed++){
 const week=buildWeeklyMenu(RECIPES,{...opts,seed,dailyCalories:2000,useCalorieGuidance:true});
 assert.equal(week.slots.length,21);
 assert.equal(new Set(week.slots.map(s=>s.recipeId)).size,21,"Default menu must not repeat a dish");
 assert(new Set(week.slots.map(s=>RECIPES.find(r=>r.id===s.recipeId)!.family||rFamily(s.recipeId))).size>=8,"Multiple recipe families");
 for(let day=0;day<7;day++){
  const total=week.slots.filter(s=>s.day===day).reduce((n,s)=>n+RECIPES.find(r=>r.id===s.recipeId)!.calories*(s.portionFactor||1),0);
  assert(Math.abs(total-2000)<200,`Calorie estimate ${total} seed ${seed}`);
 }
}
function rFamily(id:string){return RECIPES.find(r=>r.id===id)!.title.split(" ")[0]}
const a=buildWeeklyMenu(RECIPES,opts),b=buildWeeklyMenu(RECIPES,{...opts,seed:456,previousRecipeIds:a.slots.map(s=>s.recipeId)});
assert.deepEqual(a.slots,buildWeeklyMenu(RECIPES,opts).slots,"Seed makes plans reproducible");
assert(b.slots.filter(s=>a.slots.some(x=>x.recipeId===s.recipeId)).length<8,"New week rotates dishes");
const favorite=RECIPES.find(r=>r.id==="r3")!;
const preferred={...DEFAULT_MENU_PREFERENCES,briefing:"Me gusta el arroz con pollo tres días",likes:["arroz","pollo"],favoriteRecipeIds:[favorite.id],repeat:"favorites" as const,favoriteFrequency:3,dailyCalories:2100};
const week=buildWeeklyMenu(RECIPES,{...opts,preferences:preferred,dailyCalories:2100,useCalorieGuidance:true});
assert.equal(week.slots.filter(s=>s.recipeId===favorite.id).length,3,"Explicit repeat frequency is respected");
assert.equal(new Set(week.slots.filter(s=>s.recipeId===favorite.id).map(s=>s.day)).size,3);
const conflict=buildWeeklyMenu(RECIPES,{...opts,preferences:{...preferred,excludes:["pollo"]}});
assert(!conflict.slots.some(s=>s.recipeId===favorite.id)&&conflict.warnings?.length,"Exclusion overrides favorite");
const vegan=buildWeeklyMenu(RECIPES,{...opts,preferences:{...DEFAULT_MENU_PREFERENCES,diet:"vegan",maxMinutes:30}});
assert.equal(vegan.slots.length,21);
for(const slot of vegan.slots)assert(recipeAllowed(RECIPES.find(r=>r.id===slot.recipeId)!,{...opts,preferences:{...DEFAULT_MENU_PREFERENCES,diet:"vegan",maxMinutes:30}}));
const none=buildWeeklyMenu(RECIPES,{...opts,preferences:{...DEFAULT_MENU_PREFERENCES,maxMinutes:5,excludes:["fruta","avena","leche","yogur","queso","platano","fresa","huevo","pan","mango","pera","naranja","kiwi","arandano","melocoton","pina","chocolate"]}});
assert(none.warnings?.length,"Impossible requests must be disclosed");
const parsed=parseMenuBriefing("Me gustan las ensaladas, el pollo y el arroz. Quiero arroz con pollo tres días. No me gusta el pescado. 2100 calorías y máximo 30 minutos.",RECIPES);
assert(parsed.likes.includes("pollo")&&parsed.likes.includes("arroz")&&parsed.excludes.includes("pescado"));
assert.equal(parsed.dailyCalories,2100);assert.equal(parsed.maxMinutes,30);assert.equal(parsed.favoriteFrequency,3);assert(parsed.favoriteCandidates.length);assert.equal(parsed.favoriteCandidates[0].id,"r3","A specific dish takes priority over general likes");
console.log(`Personalized-menu QA: ${RECIPES.length} recipes, ${PRODUCT_VARIETIES.length} distinct varieties; 20 diverse weeks, repeated favorites, exclusions, vegan restrictions, seed rotation and calorie portions.`);

const legacy={weeklyMenu:{id:"old-week"},shopping:[{id:"mixed",qty:5,unit:"ud",sources:[{id:"manual",type:"manual" as const,label:"Casa",qty:2,unit:"ud"},{id:"weekly",type:"weekly" as const,label:"Semana",qty:3,unit:"ud"}]},{id:"weekly-only",qty:3,unit:"ud",sources:[{id:"weekly-2",type:"weekly" as const,label:"Semana",qty:3,unit:"ud"}]}],inventory:[{name:"Leche",qty:6,planReservations:[{id:"reserve-week",type:"weekly" as const,label:"Semana",qty:2,unit:"ud"},{id:"reserve-recipe",type:"recipe" as const,label:"Receta",qty:1,unit:"ud"}]}],purchaseHistory:[{name:"Leche",qty:2}],mealHistory:[]};
const cleaned:any=retireWeeklyMenu(legacy,(item,sources)=>sources.length?{...item,qty:sumSources(sources as any,item.unit),sources:sources as any}:null);
assert.equal(cleaned.weeklyMenu,null);assert.deepEqual(cleaned.retiredWeeklyMenu,legacy.weeklyMenu);
assert.equal(cleaned.shopping.length,1);assert.equal(cleaned.shopping[0].qty,2,"Keep ordinary shopping and remove only menu demand");
assert.equal(cleaned.inventory[0].qty,6);assert.equal(cleaned.inventory[0].planReservations?.length,1);
assert.deepEqual(cleaned.purchaseHistory,legacy.purchaseHistory);assert.deepEqual(cleaned.mealHistory,[]);
assert.equal(legacy.inventory[0].planReservations.length,2,"Migration is immutable");
assert.equal(retireWeeklyMenu(cleaned,()=>null),cleaned,"Migration is idempotent");
for(const theme of RECIPE_THEMES)assert(themeRecipes(theme.id,RECIPES).length>=4,theme.title);
assert.notEqual(themeForMonth(new Date(2026,9,1)).id,themeForMonth(new Date(2026,10,1)).id);
assert.notDeepEqual(themeRecipes("pasta",RECIPES,new Date(2026,9,1)).map(r=>r.id),themeRecipes("pasta",RECIPES,new Date(2026,9,8)).map(r=>r.id));
console.log("Recipe discovery QA: retired weekly plans preserve stock/history/manual shopping, idempotent migration, populated country themes and weekly rotation.");

assert.equal(themeForPeriod("week",new Date(2026,9,5)).id,themeForPeriod("week",new Date(2026,9,11)).id);
assert.notEqual(themeForPeriod("week",new Date(2026,9,5)).id,themeForPeriod("week",new Date(2026,9,12)).id);
