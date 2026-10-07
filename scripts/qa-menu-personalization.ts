import assert from "node:assert/strict";
import {retireWeeklyMenu} from "../lib/retire-weekly-menu";
import {RECIPE_THEMES,themeRecipes,themeForMonth,themeForPeriod} from "../lib/recipe-themes";
import {sumSources} from "../lib/recipe-plan-engine";
import {RECIPES} from "../lib/recipes";
import {recipeAllowed} from "../lib/weekly-menu";
import {PRODUCT_VARIETIES} from "../lib/product-varieties";
import {classifyProduct} from "../lib/product-engine";
assert(RECIPES.length>=120);
assert(PRODUCT_VARIETIES.length>=1000);
for(const v of PRODUCT_VARIETIES)assert.notEqual(classifyProduct(v.name).category,"Por clasificar",v.name);
for(const r of RECIPES){assert(r.steps.length>=3&&r.ingredients.length>=2,r.title);assert(r.nutritionUnavailable?r.calories===0:r.calories>0,r.title)}
for(const theme of RECIPE_THEMES){const dishes=themeRecipes(theme.id,RECIPES);assert(dishes.length>=6,theme.title);assert.equal(new Set(dishes.map(r=>r.image)).size,dishes.length);assert.equal(new Set(dishes.map(r=>r.family||r.id)).size,dishes.length)}
assert.equal(themeForMonth(new Date(2026,9,1)).id,"pizza");
assert.equal(themeForPeriod("week",new Date(2026,9,5)).id,themeForPeriod("week",new Date(2026,9,11)).id);
assert.notEqual(themeForPeriod("week",new Date(2026,9,5)).id,themeForPeriod("week",new Date(2026,9,12)).id);
const ovenAndHob=RECIPES.find(r=>r.id==="world-lasana")!;
const options={inventory:[],dislikes:[],tools:["Horno"],people:2};
assert(!recipeAllowed(ovenAndHob,options));assert(recipeAllowed(ovenAndHob,{...options,tools:["Horno","Gas"]}));
assert(!recipeAllowed(RECIPES.find(r=>r.id==="world-salmorejo")!,{...options,dislikes:["tomate"],tools:[]}));
const legacy={weeklyMenu:{id:"old-week"},shopping:[{id:"mixed",qty:5,unit:"ud",sources:[{id:"manual",type:"manual" as const,label:"Casa",qty:2,unit:"ud"},{id:"weekly",type:"weekly" as const,label:"Semana",qty:3,unit:"ud"}]},{id:"weekly-only",qty:3,unit:"ud",sources:[{id:"weekly-2",type:"weekly" as const,label:"Semana",qty:3,unit:"ud"}]}],inventory:[{name:"Leche",qty:6,planReservations:[{id:"reserve-week",type:"weekly" as const,label:"Semana",qty:2,unit:"ud"},{id:"reserve-recipe",type:"recipe" as const,label:"Receta",qty:1,unit:"ud"}]}],purchaseHistory:[{name:"Leche",qty:2}],mealHistory:[]};
const cleaned:any=retireWeeklyMenu(legacy,(item,sources)=>sources.length?{...item,qty:sumSources(sources as any,item.unit),sources:sources as any}:null);
assert.equal(cleaned.weeklyMenu,null);assert.deepEqual(cleaned.retiredWeeklyMenu,legacy.weeklyMenu);
assert.equal(cleaned.shopping.length,1);assert.equal(cleaned.shopping[0].qty,2,"Keep ordinary shopping and remove only menu demand");
assert.equal(cleaned.inventory[0].qty,6);assert.equal(cleaned.inventory[0].planReservations?.length,1);
assert.deepEqual(cleaned.purchaseHistory,legacy.purchaseHistory);assert.deepEqual(cleaned.mealHistory,[]);
assert.equal(legacy.inventory[0].planReservations.length,2,"Migration is immutable");
assert.equal(retireWeeklyMenu(cleaned,()=>null),cleaned,"Migration is idempotent");

console.log(`Cultural recipe QA: ${RECIPES.length} distinct dishes, ${RECIPE_THEMES.length} populated themes; tool groups, exclusions and inventory-safe migration.`);
