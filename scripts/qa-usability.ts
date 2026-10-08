import assert from 'node:assert/strict';
import {parsePreparedInput} from '../lib/prepared-input';
import {dailyIdeas} from '../lib/daily-ideas';
import {estimateRecipeNutrition} from '../lib/recipe-nutrition';
import {RECIPES} from '../lib/recipes';
import {estimateConsumption} from '../lib/consumption-engine';
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
console.log('PASS: sobras, tres comidas distintas, macros completos/adaptados, incertidumbre y hábitos sin alterar inventario');
