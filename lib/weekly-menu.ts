export type WeeklyMenuRecipe={
 id:string;title:string;time:number;servings:number;
 ingredients:{name:string;qty:string;key:string}[];
 tools?:string[];
 mode:string[];
 calories?:number;
 protein?:number;
};

export type WeeklyMeal="Desayuno"|"Comida"|"Cena";
export type WeeklyMenuSlot={day:number;meal:WeeklyMeal;recipeId:string;why:string};
export type WeeklyMenuPlan={id:string;createdAt:string;startDate:string;slots:WeeklyMenuSlot[];shoppingLinked?:boolean};

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
 const inv=inventory.map(norm);
 return r.ingredients.reduce((n,i)=>{
  const k=norm(i.key||i.name);
  return n+(inv.some(x=>x.includes(k)||k.includes(x.split(" ")[0]))?1:0);
 },0);
}
function dislikeHits(r:WeeklyMenuRecipe,dislikes:string[]){
 const t=recipeText(r);
 return dislikes.filter(Boolean).filter(d=>t.includes(norm(d))).length;
}
function toolOk(r:WeeklyMenuRecipe,tools:string[]){
 if(!r.tools?.length||!tools.length)return true;
 return r.tools.some(t=>tools.includes(t));
}

const DINNER_LUNCH_TARGETS=["poultry","fish","plant","meat","plant","fish","egg","poultry","mixed","plant","meat","fish","poultry","mixed"];
const MEALS:WeeklyMeal[]=["Desayuno","Comida","Cena"];

function breakfastLike(r:WeeklyMenuRecipe){
 return /desayuno|avena|yogur|batido|tortita|pancake|sandwich|sandwich|bizcocho|fruta|platano|huevo/.test(recipeText(r));
}
function calorieTargetFor(meal:WeeklyMeal,dailyCalories?:number){
 if(dailyCalories&&dailyCalories>=1200){
  const share=meal==="Desayuno"?.25:meal==="Comida"?.40:.35;
  return dailyCalories*share;
 }
 return meal==="Desayuno"?400:meal==="Comida"?650:500;
}
function calorieFitScore(r:WeeklyMenuRecipe,meal:WeeklyMeal,dailyCalories?:number){
 if(!r.calories||!Number.isFinite(r.calories))return 0;
 const target=calorieTargetFor(meal,dailyCalories);
 const diff=Math.abs(r.calories-target);
 return Math.max(-5,5-diff/90);
}

export function buildWeeklyMenu(recipes:WeeklyMenuRecipe[],opts:{inventory:string[];dislikes:string[];tools:string[];people:number;priority?:string[];seed?:number;costByRecipe?:Record<string,number>;budgetPressure?:boolean;dailyCalories?:number;balancedGoal?:boolean}):WeeklyMenuPlan{
 const candidates=recipes.filter(r=>toolOk(r,opts.tools)&&dislikeHits(r,opts.dislikes)===0);
 const pool=candidates.length>=8?candidates:recipes.filter(r=>dislikeHits(r,opts.dislikes)===0);
 const used=new Map<string,number>();
 const slots:WeeklyMenuSlot[]=[];
 let mainIndex=0;
 for(let day=0;day<7;day++){
  for(const meal of MEALS){
   const target=meal==="Desayuno"?"mixed":DINNER_LUNCH_TARGETS[mainIndex++];
   let best=pool[0];
   let bestScore=-9999;
   for(const r of pool){
    const g=group(r);
    let score=0;
    if(meal==="Desayuno"){
     score+=breakfastLike(r)?11:-7;
     if(r.time<=15)score+=3;
     if(g==="meat"||g==="fish")score-=4;
    }else{
     if(g===target)score+=6;
     if(breakfastLike(r))score-=4;
     if(hasVeg(r))score+=meal==="Cena"?4:3;
     if(meal==="Cena"){
      if(r.time<=25)score+=4;
      if(r.time>40)score-=4;
     }else if(r.mode.includes("mealprep"))score+=2;
    }
    score+=Math.min(4,hasInventory(r,opts.inventory))*2;
    const priority=(opts.priority||[]).map(norm);
    if(priority.length&&r.ingredients.some(i=>priority.some(p=>norm(i.name).includes(p)||p.includes(norm(i.key||i.name)))))score+=5;
    score-=Math.max(0,(used.get(r.id)||0))*9;
    if(r.servings>=Math.max(1,opts.people))score+=1;
    if(opts.balancedGoal){
     if(hasVeg(r)&&meal!=="Desayuno")score+=2;
     if((r.protein||0)>=20)score+=1.5;
    }
    score+=calorieFitScore(r,meal,opts.dailyCalories);
    if(opts.budgetPressure){const cost=opts.costByRecipe?.[r.id];if(typeof cost==="number"&&Number.isFinite(cost))score-=Math.min(12,cost*.7)}
    if(score>bestScore){bestScore=score;best=r}
   }
   if(!best)continue;
   used.set(best.id,(used.get(best.id)||0)+1);
   const invHits=hasInventory(best,opts.inventory);
   const why=meal==="Desayuno"&&breakfastLike(best)?"Desayuno práctico":invHits>=2?"Aprovecha varios productos que ya tienes":meal!=="Desayuno"&&group(best)===target?"Da variedad a la semana":meal==="Cena"&&best.time<=25?"Cena rápida":"Encaja con el hogar";
   slots.push({day,meal,recipeId:best.id,why});
  }
 }
 const today=new Date().toISOString().slice(0,10);
 return {id:"week-"+Date.now(),createdAt:today,startDate:today,slots};
}
