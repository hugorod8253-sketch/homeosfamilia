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
assert.equal(parsed.dailyCalories,2100);assert.equal(parsed.maxMinutes,30);assert.equal(parsed.favoriteFrequency,3);assert(parsed.favoriteCandidates.length);
console.log(`Personalized-menu QA: ${RECIPES.length} recipes, ${PRODUCT_VARIETIES.length} distinct varieties; 20 diverse weeks, repeated favorites, exclusions, vegan restrictions, seed rotation and calorie portions.`);
