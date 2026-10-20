import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizeState} from "../components/homeos";
import {recipeShortages,sumSources,remainingSourcesAfterPurchase,resizeShoppingSources,freeInventoryAfterReservations,planUnitsCompatible,consumePlanIngredients} from "../lib/recipe-plan-engine";
import {startAutoPrepared,estimatePreparedRemaining,advanceAutoPrepared} from "../lib/quick-inventory";

// Two ingredients in one recipe must share the available stock, not each claim it in full.
const sameMilk=recipeShortages(
 [{name:"Leche",key:"leche",qty:"700 ml"},{name:"Leche",key:"leche",qty:"500 ml"}],
 [{name:"Leche",qty:1,unit:"L",category:"Lácteos",stock:"hay"}]
);
assert.equal(sameMilk.length,1);
assert.equal(sameMilk[0].missing,200);
assert.equal(sameMilk[0].available,300);

// Generic vegetables may only take what remains after a more specific ingredient.
const vegetables=recipeShortages(
 [{name:"Verdura",key:"verdura",qty:"1 ud"},{name:"Zanahoria",key:"zanahoria",qty:"2 ud"}],
 [{name:"Zanahoria",qty:2,unit:"ud",category:"Fruta y verdura",stock:"hay"},{name:"Brócoli",qty:1,unit:"ud",category:"Fruta y verdura",stock:"hay"}]
);
assert.deepEqual(vegetables,[]);

// Countable units such as pieces, slices and portions cannot silently convert.
assert.equal(planUnitsCompatible("ud","loncha"),false);
assert.equal(planUnitsCompatible("ud","uds"),true);
assert.equal(planUnitsCompatible("L","ml"),true);
const sources=[
 {id:"eggs",type:"recipe" as const,label:"Tortilla",qty:3,unit:"ud"},
 {id:"slices",type:"manual" as const,label:"Pan",qty:4,unit:"loncha"}
];
assert.equal(sumSources(sources,"ud"),3);
assert.equal(sumSources(sources,"loncha"),4);
assert.equal(sumSources(resizeShoppingSources(sources,5,"ud"),"ud"),5);
assert.equal(sumSources(resizeShoppingSources(sources,5,"ud"),"loncha"),4);
const partiallyBought=remainingSourcesAfterPurchase(sources,2,"ud");
assert.equal(partiallyBought.find(x=>x.id==="eggs")?.qty,1);
assert.equal(partiallyBought.find(x=>x.id==="slices")?.qty,4);
const reserves=freeInventoryAfterReservations(
 [{name:"Queso",qty:4,unit:"ud",category:"Lácteos",planReservations:[{id:"a",type:"weekly" as const,label:"Cena",qty:3,unit:"loncha",planId:"p1"}]}],
 ["p1"]
);
assert.equal(reserves[0].qty,4);

// Confirmed consumption still follows earliest actual deadline and preserves other lots.
const consumed=consumePlanIngredients(
 [
  {name:"Leche",qty:1,unit:"L",category:"Lácteos",stock:"hay",purchasedAt:"2026-10-18",expires:"2026-10-30"},
  {name:"Leche",qty:1,unit:"L",category:"Lácteos",stock:"hay",purchasedAt:"2026-10-19",expires:"2026-10-24"}
 ],
 [{name:"Leche",key:"leche",qty:"500 ml"}]
);
assert.equal(consumed.exact,true);
assert.equal(consumed.inventory[0].qty,1);
assert.equal(consumed.inventory[1].qty,.5);

// An automatic meal-prep forecast must never make food vanish from confirmed inventory.
const prepared=startAutoPrepared({qty:4,servings:4,stock:"hay",source:"mealprep",location:"Nevera"} as const,4,"2026-10-20");
const original=structuredClone(prepared);
assert.deepEqual(advanceAutoPrepared(prepared,"2026-10-22"),original);
assert.deepEqual(advanceAutoPrepared(prepared,"2026-10-27"),original);
assert.equal(estimatePreparedRemaining(prepared,"2026-10-22")?.estimatedQty,2);
assert.equal(estimatePreparedRemaining(prepared,"2026-10-27")?.estimatedQty,0);
assert.equal(prepared.qty,4);
assert.equal(estimatePreparedRemaining({...prepared,location:"Congelador"},"2026-10-22"),null);
console.log("PASS: shared recipe quantities, vegetable priority, distinct units, FEFO and meal-prep estimates without silent deductions");

const baseState=normalizeState({profile:{onboardingDone:true,dailyRoutineIntakes:[
 {id:"coffee",qty:3,unit:"cafés",period:"día"},
 {id:"milk",qty:2,unit:"vasos",period:"día"},
 {id:"protein",qty:1,unit:"batidos",period:"día"},
 {id:"energy",qty:0,unit:"latas",period:"día"},
 {id:"vitamins",qty:1,unit:"tomas",period:"día"},
 {id:"invalid",qty:99999,unit:"g",period:"día"}
]},inventory:[{id:"coffee-bag",name:"Café molido",qty:250,unit:"g",stock:"hay",category:"Despensa",location:"Despensa"}]});
assert.equal(baseState.profile.dailyRoutineIntakes?.length,5);
assert.equal(baseState.profile.dailyRoutineIntakes?.find(r=>r.id==="coffee")?.qty,3);
assert.equal(baseState.inventory[0].qty,250,"three coffees a day must not fabricate gram consumption");
const restored=normalizeState(JSON.parse(JSON.stringify(baseState)));
assert.deepEqual(restored.profile.dailyRoutineIntakes,baseState.profile.dailyRoutineIntakes,"save and reload keeps explicitly chosen human routines");
const markup=readFileSync("components/homeos.tsx","utf8");
const css=readFileSync("app/globals.css","utf8");
assert(!markup.includes("disabled={step<4&&!confirmedSteps.includes(step)}"),"onboarding should not prevent Continue on a displayed default");
assert(markup.includes("confirmedSteps.includes(0)&&state.profile.householdSize===n"),"initial household size must not appear user-selected");
assert(markup.includes("confirmedSteps.includes(1)&&state.profile.shoppingCycle===id"),"shopping cycle must not appear user-selected");
assert(markup.includes("explicitOptional.includes(\"budget\")"),"optional budget cannot look selected without a tap");
const homeStart=markup.indexOf('return <section className="home-final">');
const actionStart=markup.indexOf('<article className="home-final-actions">',homeStart);
const ideasStart=markup.indexOf('<section className="home-final-top">',homeStart);
const summaryStart=markup.indexOf('<section className="home-final-mid">',homeStart);
assert(homeStart>=0&&actionStart>homeStart&&actionStart<ideasStart&&ideasStart<summaryStart,"home action shortcuts should be visible before secondary content");
const homeActions=markup.slice(actionStart,ideasStart);
assert.equal((homeActions.match(/<button\b/g)||[]).length,6,"the first row should contain six balanced quick actions");
assert(homeActions.includes('homeTicketInput.current?.click()'),"ticket chooser should open directly within tap");
assert(markup.includes('onChange={e=>{const file=e.currentTarget.files?.[0]'),"receipt file must flow from Home to shopping OCR");
assert(!markup.includes('<section className="homeos-scan-feature"'),"scanner already lives in the mobile center navigation");
assert(css.includes('border-radius:12px!important')&&css.includes('/* Voice is a labeled rectangular action'),"shopping microphone must be a labeled rectangle");
console.log("PASS: explicit onboarding selections, readable routine units, mobile home shortcuts and direct receipt capture");
