import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RECIPES } from "../lib/recipes";
import { classifyProduct } from "../lib/product-engine";
import { consumePlanIngredients, parsePlanQty, planProductMatches, recipeShortages } from "../lib/recipe-plan-engine";

assert(RECIPES.length>=500,"A broad recipe book is required");
const originals=RECIPES.filter(r=>!r.photoCaption);
assert.equal(new Set(originals.map(r=>r.image)).size,originals.length,"Original exact photos remain distinct");
assert.equal(new Set(RECIPES.map(r=>r.title)).size,RECIPES.length,"Recipe titles must be distinct");
for(const recipe of RECIPES){
 assert(recipe.image.startsWith("/recipe-images/"),recipe.title);
 const bytes=readFileSync(`public${recipe.image}`);
 assert(bytes.length>100&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP",recipe.title);
 const inventory=recipe.ingredients.map(i=>{
  const parsed=parsePlanQty(i.qty)!;
  return {name:i.name,qty:parsed.amount,unit:parsed.unit,category:classifyProduct(i.name).category,stock:"hay"};
 });
 const untouched={name:"Papel higiénico",qty:9,unit:"ud",category:"Limpieza y hogar",stock:"hay"};
 const full=consumePlanIngredients([...inventory,untouched],recipe.ingredients);
 assert(full.exact,`Full consumption: ${recipe.title}`);
 assert(full.inventory.slice(0,-1).every(i=>i.qty===0),`All ingredients consumed: ${recipe.title}`);
 assert.deepEqual(full.inventory.at(-1),untouched);
 const partial=consumePlanIngredients(inventory.map(i=>({...i,qty:i.qty/2})),recipe.ingredients);
 assert(!partial.exact&&partial.inventory.every(i=>i.qty>=0),`Partial consumption: ${recipe.title}`);
 assert.equal(consumePlanIngredients([],recipe.ingredients).exact,false);
}
const item=(name:string,unit="g")=>({name,qty:1000,unit,category:classifyProduct(name).category,stock:"hay"});
for(const [actual,key,label] of [
 ["Caldo de pollo","pollo","Pechuga de pollo"],
 ["Pavo en lonchas","pavo","Pechuga de pavo"],
 ["Tomate","tomate","Tomate frito"],
 ["Garbanzos secos","garbanzo","Garbanzos cocidos"],
 ["Leche de coco","leche","Leche"]
])assert(!planProductMatches(item(actual),key,label),`${actual} must not satisfy ${label}`);
assert(planProductMatches(item("Garbanzos cocidos en bote"),"garbanzo","Garbanzos cocidos"));
assert.equal(recipeShortages([{name:"Queso lonchas",qty:"2 lonchas",key:"queso"}],[item("Queso lonchas","ud")]).length,1);
const expired={...item("Pollo"),expired:true};
const protectedStock=consumePlanIngredients([expired],[{name:"Pollo",qty:"500 g",key:"pollo"}],i=>!i.expired);
assert(!protectedStock.exact&&protectedStock.inventory[0].qty===1000);
const converted=consumePlanIngredients([{...item("Leche","L"),qty:1}],[{name:"Leche",qty:"250 ml",key:"leche"}]);
assert(converted.exact&&converted.inventory[0].qty===.75);
console.log(`Recipe audit: ${RECIPES.length} recipes with local exact or clearly labelled family photos, full/partial/empty consumption, product distinctions, units and excluded stock.`);
for(const name of ["Chucrut","Gochujang","Semillas de sésamo","Jengibre","Comino"])assert.notEqual(classifyProduct(name).category,"Por clasificar",name);
assert(!planProductMatches(item("Comino"),"curry","Curry"),"Comino must not satisfy curry");
assert(!planProductMatches(item("Gochujang"),"salsa de soja","Salsa de soja"),"Different sauces must remain distinct");
