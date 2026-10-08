import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { completePurchase, normalizeState, consumeRecipeIngredients, reconcileRecipeShopping, type AppState } from '../components/homeos';
import { estimateInventoryConsumption } from '../lib/consumption-engine';
import { appendConfirmedStockCheck, emptyInventoryItem, freezeInventoryItem, thawInventoryItem } from '../lib/inventory-lifecycle';
import { localDateIso, calendarDaysUntil, isCalendarDate } from '../lib/local-date';
import { classifyProduct } from '../lib/product-engine';
import { mergeHouseholdState } from '../lib/sync-merge';
import { RECIPES } from '../lib/recipes';
import { removePlanFromSources, remainingSourcesAfterPurchase, recipeShortages } from '../lib/recipe-plan-engine';

const start=performance.now();let checks=0;
function verify(condition:unknown,message:string){checks++;assert.ok(condition,message)}
const day=(n:number)=>localDateIso(new Date(2025,9,9+n,12));
let state=normalizeState({profile:{onboardingDone:true,householdSize:4,supermarkets:['mercdona','bonaria'],consumptionHabits:[{id:'milk-habit',name:'Leche',qty:1,unit:'L',days:7}]},budget:650});
const initial:AppState["inventory"][number]={id:'home-milk',name:'Leche',category:'Lácteos',qty:1,unit:'L',location:'Despensa' as const,stock:'hay' as const,purchasedAt:day(0),purchaseDateUnknown:true,lastConfirmedAt:day(0),estimateAnchorQty:1,estimateAnchorDate:day(0)};
state.inventory=[initial];state.stockChecks=appendConfirmedStockCheck([],state.inventory,initial,day(0));
verify(state.spent===0&&state.purchaseHistory.length===0,'initial existing food is not a paid purchase');
const basket=[['Leche',1,'L'],['Huevos',12,'uds'],['Manzanas',6,'uds'],['Plátanos',6,'uds'],['Tomate cherry',300,'g'],['Pollo',500,'g'],['Pavo',400,'g'],['Lubina',400,'g'],['Yogur natural',4,'uds'],['Pan',1,'ud'],['Arroz',500,'g'],['Macarrones',500,'g'],['Sal',100,'g'],['Aceite de oliva',250,'ml'],['Vinagre',250,'ml'],['Zanahoria',300,'g'],['Patata',500,'g'],['Cebolla',400,'g'],['Avena',300,'g'],['Garbanzos cocidos',400,'g'],['Lentejas cocidas',400,'g'],['Caldo de pollo',1,'L'],['Queso',200,'g'],['Papel higiénico',6,'uds'],['Detergente',1,'L']] as const;
let receipts=0,lines=0,expectedSpend=0,cooks=0,reopens=0;
for(let n=0;n<365;n++){
 const today=day(n),week=Math.floor(n/7),away=week>=18&&week<=20;
 if(!away){
  const products=n%7===0?[...basket]:[basket[9],basket[8]];
  const added=products.map(([name,qty,unit],index)=>({id:`cart-${n}-${index}`,name,qty:name==='Leche'&&week%8===0?2:qty,unit,category:classifyProduct(name).category,requestedBy:'Casa',reason:'persona' as const,status:'carrito' as const}));
  // The fish is not available; a small packet of tomatoes only partly fulfils the request.
  if(n%28===0)added.find(i=>i.name==='Lubina')!.status='pendiente' as any;
  const purchased=added.filter(i=>i.status==='carrito').map(i=>i.name==='Tomate cherry'&&n%28===0?{...i,boughtQty:150}:i);
  state.shopping=[...state.shopping,...added.map(i=>purchased.find(p=>p.id===i.id)||i)];
  const ids=added.map(i=>i.id),total=n%7===0?74.55:3.25;
  state=completePurchase(state,ids,total,week%2?'BonÀrea':'Mercadona',today);
  const once=JSON.stringify(state);
  const repeated=completePurchase(state,ids,total,'Mercadona',today);
  verify(JSON.stringify(repeated)===once,`double checkout is idempotent on day ${n}`);
  receipts++;lines+=purchased.length;expectedSpend+=total;
  if(n%28===0){verify(state.shopping.some(i=>i.name==='Lubina'&&i.status==='pendiente'),'unavailable fish remains on the list');verify(state.shopping.some(i=>i.name==='Tomate cherry'&&i.qty===150),'partial package keeps the correct missing grams')}
 }
 // The family confirms milk occasionally, and often does not log meals.
 if(n%42===0){
  const i=state.inventory.find(i=>i.name==='Leche')!;
  const real={...i,qty:.5,stock:'hay' as const,lastConfirmedAt:today,estimateAnchorQty:.5,estimateAnchorDate:today};
  state.inventory=state.inventory.map(x=>x.id===i.id?real:x);
  state.stockChecks=appendConfirmedStockCheck(state.stockChecks,state.inventory,real,today);
 }
 if(!away&&n%5===0){const used=consumeRecipeIngredients(state.inventory,[{name:'Arroz',key:'arroz',qty:'100 g'}],state,today);state.inventory=used.inventory;cooks++}
 const before=JSON.stringify(state.inventory);
 for(const item of state.inventory.filter(i=>i.name==='Leche')){
  const e=estimateInventoryConsumption(item,state.inventory,state.purchaseHistory,state.profile.consumptionHabits,state.stockChecks,today);
  verify(Number.isFinite(e.estimatedQty)&&e.estimatedQty>=0&&e.estimatedQty<=(item.estimateAnchorQty??item.qty)+.01,`finite bounded estimate ${today}`);
 }
 verify(JSON.stringify(state.inventory)===before,'passage of time never changes recorded stock');
 if(n%7===0){
  const count=state.purchaseHistory.length,sessions=state.purchaseSessions.length;
  state=normalizeState(JSON.parse(JSON.stringify(state)));reopens++;
  verify(state.purchaseHistory.length===count&&state.purchaseSessions.length===sessions,'restart never truncates history');
 }
}
verify(lines>600&&receipts>240,'annual workload exceeds both old history limits');
verify(state.purchaseHistory.length===lines,'all purchased products survive the year');
verify(state.purchaseSessions.length===receipts,'all paid purchases survive the year');
verify(Math.abs(state.spent-expectedSpend)<1e-6,'annual expense counts each receipt once');
verify(new Set(state.purchaseHistory.map(x=>x.id)).size===lines,'history IDs stay unique');
verify(state.inventory.every(i=>Number.isFinite(i.qty)&&i.qty>=0),'recorded quantities stay nonnegative');

// Missing data in another location is never presented as a confirmed household total.
const older={...initial,id:'other-location',qty:3,unit:'L',location:'Nevera' as const,lastConfirmedAt:day(0)};
const confirmed={...initial,qty:500,unit:'ml',lastConfirmedAt:day(364)};
let snapshot=appendConfirmedStockCheck([], [confirmed,older], confirmed, day(364));
verify(snapshot[0].location!=='Todo','one location cannot confirm stale stock in another');
snapshot=appendConfirmedStockCheck([], [confirmed,{...older,lastConfirmedAt:day(364)}], confirmed,day(364));
verify(snapshot[0].location==='Todo'&&snapshot[0].qty===3500,'compatible litre and ml confirmations yield one real total');
const gone=emptyInventoryItem(initial,day(10));
verify(gone.qty===0&&gone.estimateAnchorQty===0,'finished means zero real and estimated base');
const comeback=normalizeState({profile:state.profile,inventory:[gone],shopping:[{id:'new-milk',name:'Leche',qty:1,unit:'L',category:'Lácteos',status:'carrito',reason:'persona',requestedBy:'Casa'}]});
const restocked=completePurchase(comeback,['new-milk'],1.2,'Lidl',day(11)).inventory[0];
verify(restocked.qty===1&&restocked.estimateAnchorQty===1,'repurchasing cannot resurrect old milk');
verify(restocked.lastConfirmedAt===undefined,'new purchase cannot inherit a past stock confirmation');
const frozen=freezeInventoryItem(initial,day(5),.3),thawed=thawInventoryItem(frozen,'Nevera',day(50));
verify(frozen.estimatedExpires===undefined&&frozen.expires===undefined,'frozen food cannot retain an active fridge expiry');
verify(estimateInventoryConsumption(frozen,[frozen],[],state.profile.consumptionHabits,[],day(49)).estimatedQty===.3,'freezing pauses projected consumption');
verify(thawed.estimateAnchorDate===day(50)&&thawed.stock==='incierto'&&thawed.storageMode==='normal','thaw resumes today and requests review');
verify(estimateInventoryConsumption(thawed,[thawed],[],state.profile.consumptionHabits,[],day(50)).estimatedQty===.3,'freezer days are not charged on thaw');

// Saved recipes and their shopping sources must survive long-term use and undo.
const saved=normalizeState({...state,recipePlans:RECIPES.map(recipe=>({id:recipe.id,recipe,createdAt:day(0),status:'saved',shoppingLinked:false}))});
verify(saved.recipePlans.length===RECIPES.length,'saving more than 80 recipes never silently drops favourites');
let recipes=normalizeState({profile:state.profile,recipePlans:[{id:'plan-test',recipe:RECIPES[0],createdAt:day(364),status:'saved',shoppingLinked:true}]});
recipes=reconcileRecipeShopping(recipes);
verify(recipes.shopping.length>0,'saved recipe routes its shortages to shopping');
const unchanged=JSON.stringify(recipes.inventory);
const undo=recipes.shopping.flatMap(i=>{const sources=removePlanFromSources(i.sources,'plan-test');return sources.length?[{...i,sources}]:[]});
verify(undo.length===0&&JSON.stringify(recipes.inventory)===unchanged,'undo removes only recipe requests, never stock');
verify(recipeShortages(RECIPES[0].ingredients,[]).length>0,'empty cupboard is a shortage, not a crash');
verify(remainingSourcesAfterPurchase([{id:'a',type:'manual',label:'milk',qty:1,unit:'L'}],.25,'L')[0].qty===.75,'decimal partial purchases are correct');

// Offline merge: independent receipts combine; the same receipt is never paid twice.
const base={spent:10,waste:0,wasteSaved:0,purchaseSessions:[{id:'old',date:day(0),total:10}],inventory:[],shopping:[]};
const a={...base,spent:15,purchaseSessions:[...base.purchaseSessions,{id:'shared',date:day(1),total:5}],shopping:[{id:'a',name:'Pan'}]};
const b={...a,shopping:[{id:'b',name:'Leche'}]};
const merged=mergeHouseholdState(base,a,b);
verify(merged.spent===15&&merged.purchaseSessions.length===2,'a receipt copied to both devices counts once');
verify(merged.shopping.length===2,'independent offline additions survive');
verify(mergeHouseholdState(base,a,a).spent===15,'identical reconnection does not double counters');
const c={...base,spent:17,purchaseSessions:[...base.purchaseSessions,{id:'independent',date:day(1),total:7}]};
verify(mergeHouseholdState(base,a,c).spent===22,'different paid purchases combine');
const stockBase={...base,inventory:[{...initial,qty:4}],purchaseHistory:[],mealHistory:[]};
const leftBuy={...stockBase,inventory:[{...initial,qty:5}],purchaseHistory:[{id:'left-milk',name:'Leche',qty:1,unit:'L'}]};
const rightBuy={...stockBase,inventory:[{...initial,qty:6}],purchaseHistory:[{id:'right-milk',name:'Leche',qty:2,unit:'L'}]};
verify(mergeHouseholdState(stockBase,leftBuy,rightBuy).inventory[0].qty===7,'two devices buying the same product preserve both purchases');
const leftCook={...stockBase,inventory:[{...initial,qty:3}],mealHistory:[{id:'left-meal',ingredients:[{name:'Leche'}]}]};
const rightCook={...stockBase,inventory:[{...initial,qty:3}],mealHistory:[{id:'right-meal',ingredients:[{name:'Leche'}]}]};
verify(mergeHouseholdState(stockBase,leftCook,rightCook).inventory[0].qty===2,'independent logged meals both deduct stock');
const realCount={...leftCook,inventory:[{...initial,qty:.5,lastStockCheckId:'real-count',estimateAnchorQty:.5}]};
verify(mergeHouseholdState(stockBase,leftCook,realCount).inventory[0].qty===.5,'explicit recount wins over inferred arithmetic');
verify(isCalendarDate('2028-02-29')&&!isCalendarDate('2026-02-29')&&!isCalendarDate('2026-02-31'),'invalid calendar dates rejected');
for(const date of ['2026-03-29','2026-10-25'])verify(calendarDaysUntil(date,new Date(date+'T12:00:00'))===0,'daylight saving respects calendar dates');
console.log(JSON.stringify({result:'PASS',simulation:'365 days / family of four / sparse logging',days:365,receipts,products:lines,restarts:reopens,loggedCooks:cooks,assertions:checks,spent:Math.round(expectedSpend*100)/100,elapsedMs:Math.round(performance.now()-start),limits:'Synthetic simulation; not 12 months of real-world observation or physical camera/microphone/GPU testing'}));
