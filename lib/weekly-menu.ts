import { DEFAULT_MENU_PREFERENCES, matchesMenuTerm, normalizeMenuPreferences, type MenuPreferences } from "./menu-preferences";
import { classifyProduct } from "./product-engine";
import { parsePlanQty } from "./recipe-plan-engine";
import { planProductMatches } from "./recipe-plan-engine";
export type WeeklyMenuRecipe={
 id:string;title:string;time:number;servings:number;
 ingredients:{name:string;qty:string;key:string}[];
 tools?:string[]; toolGroups?:string[][];
 mode:string[];
 calories?:number;
 protein?:number;family?:string;mealTypes?:WeeklyMeal[]|("Desayuno"|"Comida"|"Cena"|"Merienda")[];
};

export type WeeklyMeal="Desayuno"|"Comida"|"Cena";
export type WeeklyMenuSlot={day:number;meal:WeeklyMeal;recipeId:string;why:string;portionFactor?:number;skipped?:boolean;cooked?:boolean};
export type WeeklyMenuPlan={id:string;createdAt:string;startDate:string;slots:WeeklyMenuSlot[];shoppingLinked?:boolean;seed?:number;preferences?:MenuPreferences;warnings?:string[];kind?:"weekly"|"mealprep"};

export type CalorieReferenceSource="off"|"general"|"custom"|"mixed";
export type CalorieReference={enabled:boolean;dailyCalories?:number;source:CalorieReferenceSource;configuredCount:number;people:number};

export function resolveCalorieReference(targets:(number|undefined)[],enabled=true):CalorieReference{
 const people=Math.max(1,targets.length||1);
 if(!enabled)return {enabled:false,source:"off",configuredCount:0,people};
 const normalized=(targets.length?targets:[0]).map(x=>{
  const n=Number(x)||0;
  return n>=1200&&n<=5000?Math.round(n):0;
 });
 const configuredCount=normalized.filter(Boolean).length;
 const values=normalized.map(n=>n||2000);
 const dailyCalories=Math.round(values.reduce((a,b)=>a+b,0)/values.length);
 const source=configuredCount===0?"general":configuredCount===normalized.length?"custom":"mixed";
 return {enabled:true,dailyCalories,source,configuredCount,people:normalized.length};
}

function norm(s:string){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9ñ\s]/g," ").replace(/\s+/g," ").trim()}
function recipeText(r:WeeklyMenuRecipe){return norm([r.title,...r.ingredients.map(i=>i.name)].join(" "))}
function group(r:WeeklyMenuRecipe){
 const t=recipeText(r);
 if(/salmon|merluza|atun|pescado|bacalao/.test(t))return "fish";
 if(/lenteja|garbanzo|tofu|seitan|soja/.test(t))return "plant";
 if(/pollo|pavo/.test(t))return "poultry";
 if(/ternera|vacuno|cerdo|entrecot|solomillo|hamburgues/.test(t))return "meat";
 if(/huevo|tortilla|revuelto/.test(t))return "egg";
 return "mixed";
}
function hasVeg(r:WeeklyMenuRecipe){return /verdura|tomate|lechuga|brocoli|zanahoria|cebolla|pepino|espinaca|calabaza|aguacate/.test(recipeText(r))}
function hasInventory(r:WeeklyMenuRecipe,inventory:string[]){
 const inv=inventory.map(name=>({name,qty:1,unit:"ud",category:classifyProduct(name).category}));
 return r.ingredients.reduce((n,i)=>{
  return n+(inv.some(x=>planProductMatches(x,i.key||i.name,i.name))?1:0);
 },0);
}
function dislikeHits(r:WeeklyMenuRecipe,dislikes:string[]){
 const t=recipeText(r);
 return dislikes.filter(Boolean).filter(d=>t.includes(norm(d))).length;
}
function toolOk(r:WeeklyMenuRecipe,tools:string[]){
 if(!tools.length)return true;
 if(r.toolGroups?.length)return r.toolGroups.every(group=>group.some(tool=>tools.includes(tool)));
 if(!r.tools?.length)return true;
 return r.tools.some(t=>tools.includes(t));
}

const DINNER_LUNCH_TARGETS=["poultry","fish","plant","meat","plant","fish","egg","poultry","mixed","plant","meat","fish","poultry","mixed"];
const MEALS:WeeklyMeal[]=["Desayuno","Comida","Cena"];

function breakfastLike(r:WeeklyMenuRecipe){
 return /desayuno|avena|yogur|batido|tortita|pancake|sandwich|sandwich|bizcocho|fruta|platano|huevo/.test(recipeText(r));
}
function calorieTargetFor(meal:WeeklyMeal,dailyCalories?:number){
 const reference=dailyCalories&&dailyCalories>=1200?dailyCalories:2000;
 const share=meal==="Desayuno"?.25:meal==="Comida"?.40:.35;
 return reference*share;
}
function calorieFitScore(r:WeeklyMenuRecipe,meal:WeeklyMeal,dailyCalories?:number){
 if(!r.calories||!Number.isFinite(r.calories))return 0;
 const target=calorieTargetFor(meal,dailyCalories);
 const diff=Math.abs(r.calories-target);
 return Math.max(-5,5-diff/90);
}

export type WeeklyMenuOptions={inventory:string[];dislikes:string[];tools:string[];people:number;priority?:string[];seed?:number;costByRecipe?:Record<string,number>;budgetPressure?:boolean;dailyCalories?:number;balancedGoal?:boolean;useCalorieGuidance?:boolean;preferences?:MenuPreferences;previousRecipeIds?:string[]};
export function recipeAllowed(r:WeeklyMenuRecipe,opts:WeeklyMenuOptions){
 const prefs=normalizeMenuPreferences(opts.preferences||DEFAULT_MENU_PREFERENCES);
 if(!toolOk(r,opts.tools)||(prefs.maxMinutes&&r.time>prefs.maxMinutes))return false;
 if([...opts.dislikes,...prefs.excludes].some(t=>matchesMenuTerm(r,t)))return false;
 const ingredients=norm(r.ingredients.map(i=>i.name).join(" "));
 if(prefs.diet!=="any"&&/pollo|pavo|ternera|vacuno|cerdo|salmon|merluza|atun|bacalao|gamba|sardina|jamon|chorizo|bacon|hamburguesa|carne/.test(ingredients))return false;
 if(prefs.diet==="vegan"&&/huevo|leche|yogur|queso|mozzarella|skyr|mantequilla|whey|miel/.test(ingredients))return false;
 return true;
}
export function recipeMealFits(r:WeeklyMenuRecipe,meal:WeeklyMeal){
 if(r.mealTypes?.length)return r.mealTypes.includes(meal);
 return meal==="Desayuno"?breakfastLike(r):!(/batido|yogur|bizcocho|brownie|mug cake|tortitas|avena|platano con chocolate/.test(norm(r.title)));
}
function randomScore(seed:number,id:string){let h=seed|0;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967296}
export function menuPortionFactor(r:WeeklyMenuRecipe,meal:WeeklyMeal,opts:WeeklyMenuOptions){
 if(!opts.useCalorieGuidance||!opts.dailyCalories||!r.calories)return 1;
 let factor=Math.max(.65,Math.min(1.8,calorieTargetFor(meal,opts.dailyCalories)/r.calories));
 const eggs=r.ingredients.find(i=>/huevo/.test(norm(i.name)));
 const quantity=eggs?parsePlanQty(eggs.qty):null;
 if(quantity&&quantity.unit==="ud"){
  const step=r.servings/(quantity.amount*Math.max(1,opts.people));
  const low=Math.ceil(.65/step),high=Math.floor(1.8/step);
  if(low<=high)factor=Math.max(low,Math.min(high,Math.round(factor/step)))*step;
 }
 return Math.round(factor*10000)/10000;
}
export function buildWeeklyMenu(recipes:WeeklyMenuRecipe[],opts:WeeklyMenuOptions):WeeklyMenuPlan{
 const prefs=normalizeMenuPreferences(opts.preferences||DEFAULT_MENU_PREFERENCES);
 const seed=opts.seed??Date.now();
 const pool=recipes.filter(r=>recipeAllowed(r,opts));
 const used=new Map<string,number>(),families=new Map<string,number>();
 const slots:WeeklyMenuSlot[]=[],warnings:string[]=[];
 const favorites=prefs.favoriteRecipeIds.map(id=>pool.find(r=>r.id===id)).filter(Boolean) as WeeklyMenuRecipe[];
 for(const id of prefs.favoriteRecipeIds)if(!pool.some(r=>r.id===id))warnings.push("Un favorito no encaja con las exclusiones, tiempo o equipamiento y no se ha incluido.");
 const favoriteTarget=prefs.repeat==="variety"?1:prefs.favoriteFrequency;
 const desired=new Map(favorites.map(r=>[r.id,favoriteTarget]));
 const schedule=new Map<string,WeeklyMenuRecipe>();
 // Reserve explicit favorites on spaced days; the same favorite never appears twice in a day.
 for(const favorite of favorites){
  const meal:WeeklyMeal=recipeMealFits(favorite,"Comida")?"Comida":recipeMealFits(favorite,"Cena")?"Cena":"Desayuno";
  let scheduled=0;for(let k=0;k<7&&scheduled<favoriteTarget;k++){
   const day=(Math.floor(k*7/favoriteTarget)+favorites.indexOf(favorite))%7,key=day+"|"+meal;
   if(schedule.has(key)||[...schedule].some(([slot,r])=>slot.startsWith(day+"|")&&r.id===favorite.id))continue;
   schedule.set(key,favorite);scheduled++;
  }
  desired.set(favorite.id,scheduled);
  if(scheduled<favoriteTarget)warnings.push("No cabían todas las repeticiones de tus favoritos en la semana.");
 }
 let mainIndex=0;
 for(let day=0;day<7;day++)for(const meal of MEALS){
  const target=meal==="Desayuno"?"mixed":DINNER_LUNCH_TARGETS[mainIndex++];
  let eligible=pool.filter(r=>recipeMealFits(r,meal));
  if(!eligible.length){warnings.push("No hay recetas compatibles para "+meal.toLowerCase()+" con estas restricciones.");continue}
  const reserved=schedule.get(day+"|"+meal);
  let best=reserved,bestScore=-Infinity;
  if(!reserved){
   const fresh=eligible.filter(r=>!used.has(r.id)&&!desired.has(r.id));
   if(fresh.length)eligible=fresh;
   else eligible=eligible.filter(r=>!desired.has(r.id)||(used.get(r.id)||0)<(desired.get(r.id)||0));
   if(!eligible.length)eligible=pool.filter(r=>recipeMealFits(r,meal)&&!slots.some(s=>s.day===day&&s.recipeId===r.id));
   for(const r of eligible){
    const family=r.family||norm(r.title).split(" ").slice(0,2).join(" ");
    const g=group(r);let score=randomScore(seed+day*31+MEALS.indexOf(meal)*13,r.id)*6;
    if(g===target&&meal!=="Desayuno")score+=3;
    if(meal==="Desayuno"&&r.time<=15)score+=2;
    if(meal==="Cena"&&r.time<=25)score+=2;
    if(hasVeg(r)&&meal!=="Desayuno")score+=3;
    score+=Math.min(4,hasInventory(r,opts.inventory))*.7;
    if((opts.priority||[]).some(t=>matchesMenuTerm(r,t)))score+=2;
    score+=Math.min(2,prefs.likes.filter(t=>matchesMenuTerm(r,t)).length)*2;
    score-=(used.get(r.id)||0)*60+(families.get(family)||0)*5;
    if(slots.some(s=>s.day===day&&recipes.find(x=>x.id===s.recipeId)?.family===family))score-=9;
    if(slots.some(s=>s.day===day-1&&s.meal===meal&&recipes.find(x=>x.id===s.recipeId)?.family===family))score-=7;
    if(opts.previousRecipeIds?.includes(r.id))score-=8;
    if(opts.balancedGoal&&(r.protein||0)>=20)score+=1;
    if(opts.useCalorieGuidance&&r.calories){const ratio=calorieTargetFor(meal,opts.dailyCalories)/r.calories;score-=ratio<.65||ratio>1.8?12:Math.abs(ratio-1)*2;}
    if(opts.budgetPressure){const cost=opts.costByRecipe?.[r.id];if(typeof cost==="number"&&Number.isFinite(cost))score-=Math.min(12,cost*.7)}
    if(score>bestScore){bestScore=score;best=r}
   }
  }
  if(!best)continue;
  const family=best.family||norm(best.title).split(" ").slice(0,2).join(" ");
  used.set(best.id,(used.get(best.id)||0)+1);families.set(family,(families.get(family)||0)+1);
  const portionFactor=menuPortionFactor(best,meal,opts);
  const why=reserved?"Favorito elegido por ti":prefs.likes.some(t=>matchesMenuTerm(best!,t))?"Encaja con tus gustos":hasInventory(best,opts.inventory)>=2?"Aprovecha Casa":"Variedad para esta semana";
  slots.push({day,meal,recipeId:best.id,why,portionFactor});
 }
 if([...used].some(([id,n])=>n>1&&!desired.has(id)))warnings.push("Con las restricciones actuales faltan opciones para evitar todas las repeticiones.");
 if(opts.useCalorieGuidance&&opts.dailyCalories)for(let day=0;day<7;day++){
  const total=slots.filter(s=>s.day===day).reduce((n,s)=>n+(recipes.find(r=>r.id===s.recipeId)?.calories||0)*(s.portionFactor||1),0);
  if(Math.abs(total-opts.dailyCalories)>opts.dailyCalories*.15){warnings.push("Algún día queda fuera del objetivo aproximado; revisa las raciones y tus restricciones.");break}
 }
 const today=new Date().toISOString().slice(0,10);
 return {id:"week-"+Date.now()+"-"+seed,createdAt:today,startDate:today,slots,seed,preferences:prefs,warnings:[...new Set(warnings)]};
}
