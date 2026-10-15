import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePreparedInput} from '../lib/prepared-input';
import {dailyIdeas} from '../lib/daily-ideas';
import {estimateRecipeNutrition} from '../lib/recipe-nutrition';
import {RECIPES} from '../lib/recipes';
import {estimateConsumption} from '../lib/consumption-engine';
import {shoppingCategoryLabel} from '../lib/shopping-category';
for(const [phrase,name,servings,location] of [
 ['Me ha sobrado sopa','Sopa',1,'Nevera'],
 ['Han sobrado 3 raciones de pollo con arroz y van a la nevera','Pollo con arroz',3,'Nevera'],
 ['Me han sobrado tres raciones de sopa de pollo en la nevera','Sopa de pollo',3,'Nevera'],
 ['He preparado 4 tuppers de lentejas para el congelador','Lentejas',4,'Congelador'],
 ['Sopa de verduras','Sopa de verduras',1,'Nevera'],
 ['Nos ha sobrado arroz con pollo','Arroz con pollo',1,'Nevera'],
] as const){const x=parsePreparedInput(phrase);assert.equal(x.name,name);assert.equal(x.servings,servings);assert.equal(x.location,location)}
const ideas=dailyIdeas(RECIPES.map(r=>({r})));assert.deepEqual(ideas.map(x=>x.slot),['Desayuno','Comida','Cena']);assert.equal(new Set(ideas.map(x=>x.r.id)).size,3);assert.ok(!/plátano con chocolate/i.test(ideas[0].r.title));
const breakfast=estimateRecipeNutrition(RECIPES.find(r=>r.id==='x15')!);assert.ok(breakfast.complete);if(breakfast.complete)assert.ok(breakfast.perServing.protein>15);
for(const id of ['world-gazpacho','world-salmorejo']){
 const recipe=RECIPES.find(r=>r.id===id)!;const nutrition=estimateRecipeNutrition(recipe);assert.ok(nutrition.complete);
 if(nutrition.complete){assert.ok(nutrition.perServing.calories>100);assert.ok(nutrition.perServing.calories<600);assert.ok(nutrition.perServing.protein>0);
 const double=estimateRecipeNutrition({...recipe,servings:recipe.servings*2});assert.ok(double.complete);if(double.complete)assert.ok(Math.abs(double.perServing.calories*2-nutrition.perServing.calories)<.2);
 const noOil=estimateRecipeNutrition({...recipe,ingredients:recipe.ingredients.filter(i=>!i.name.includes('Aceite'))});assert.ok(noOil.complete);if(noOil.complete)assert.ok(noOil.total.calories<nutrition.total.calories);
 }
 assert.equal(estimateRecipeNutrition({...recipe,ingredients:[...recipe.ingredients,{name:'Ingrediente desconocido',qty:'10 g'}]}).complete,false);
}
assert.equal(estimateRecipeNutrition({servings:1,ingredients:[{name:'Arroz cocido',qty:'100 g'}]}).complete,false);
const item={name:'Leche',qty:1,unit:'L',purchasedAt:'2026-10-01'};
const purchases=[{name:'Leche',qty:1,unit:'L',date:'2026-09-24'},{name:'Leche',qty:1,unit:'L',date:'2026-10-01'}];
const habits=[{id:'h',name:'Leche',qty:1,unit:'L',days:14}];
const estimate=estimateConsumption(item,purchases,habits,[],'2026-10-08');assert.equal(estimate.source,'habit');assert.equal(estimate.estimatedQty,.5);assert.equal(item.qty,1);
const checked=estimateConsumption(item,purchases,habits,[{id:'a',name:'Leche',qty:1,unit:'L',date:'2026-10-01',location:'Todo'},{id:'b',name:'Leche',qty:0,unit:'L',date:'2026-10-08',location:'Todo'}],'2026-10-08');assert.equal(checked.source,'confirmed');
assert.equal(shoppingCategoryLabel('Lácteos'),'Huevos y lácteos');
const homeosUi=readFileSync('components/homeos.tsx','utf8');
assert.ok(homeosUi.includes('Consulta ingredientes y datos por envase; añádelo a tu compra o inventario.'),'Scanner copy must promise factual product details, not a subjective score');
assert.ok(homeosUi.includes('confirmedSteps.includes(4)&&state.profile.nutrition===id'),'Default nutrition must not appear selected until the user confirms it');
assert.ok(homeosUi.includes('Elige una de las dos opciones para continuar.'),'Onboarding must explain the blocked next step');
assert.ok(homeosUi.includes('className="onboarding-member-details"'),'Household member preferences must be collapsible');
assert.ok(homeosUi.includes('scanProduct={()=>{setScannerItem(null);setScannerOpen(true)}}'),'Home quick actions must open the product scanner directly');
assert.ok(homeosUi.includes('openRecipeDetails(r)'),'Choosing a recipe must open its actions immediately');
assert.ok(!homeosUi.includes('{(view==="inicio"||view==="comprar")&&<section className="homeos-scan-feature"'),'Home must not show a second oversized scanner card');
assert.ok(homeosUi.includes('Gasto registrado')&&homeosUi.includes('Math.abs(available)'),'Finance balance must compare the real monthly budget with recorded spending and show overspending');
assert.ok(homeosUi.includes('value={state.profile.weeklyBudget?monthBudget:state.budget}'),'Finance editor must show the same current-month budget as the summary');
assert.ok(homeosUi.indexOf('<article className="featured-meal">')<homeosUi.indexOf('<div className="recipe-options-head">'),'The featured recipe must appear before alternative suggestions');
const casaStart=homeosUi.indexOf('function Casa(');
assert.ok(homeosUi.indexOf('className={"inventory-grid "+density}',casaStart)<homeosUi.indexOf('className="freshness-overview"',casaStart),'Casa must show the inventory before secondary freshness suggestions');
console.log('PASS: sobras, tres comidas distintas, macros completos/adaptados, incertidumbre y hábitos sin alterar inventario');
assert.ok(homeosUi.includes('Ver una demo sin configurar'),'Onboarding must offer a questionnaire-free demo');
assert.ok(homeosUi.includes('Demostración · datos de ejemplo'),'Demo must be clearly labeled as fictional data');
assert.ok(homeosUi.includes('Salir de demostración'),'Demo must offer an obvious exit');
assert.ok(homeosUi.includes('href="/?demo=menu"'),'The demo must be directly reachable from the app');
