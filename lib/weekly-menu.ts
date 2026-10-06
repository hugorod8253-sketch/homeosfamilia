export type WeeklyMenuRecipe={
 id:string;title:string;time:number;servings:number;
 ingredients:{name:string;qty:string;key:string}[];
 tools?:string[];
 mode:string[];
};

export type WeeklyMenuSlot={day:number;meal:"Comida"|"Cena";recipeId:string;why:string};
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

const TARGETS=["poultry","fish","plant","meat","plant","fish","egg","poultry","mixed","plant","meat","fish","poultry","mixed"];

export function buildWeeklyMenu(recipes:WeeklyMenuRecipe[],opts:{inventory:string[];dislikes:string[];tools:string[];people:number;priority?:string[];seed?:number;costByRecipe?:Record<string,number>;budgetPressure?:boolean}):WeeklyMenuPlan{
 const candidates=recipes.filter(r=>toolOk(r,opts.tools)&&dislikeHits(r,opts.dislikes)===0);
 const pool=candidates.length>=8?candidates:recipes.filter(r=>dislikeHits(r,opts.dislikes)===0);
 const used=new Map<string,number>();
 const slots:WeeklyMenuSlot[]=[];
 for(let i=0;i<14;i++){
  const meal=i%2===0?"Comida":"Cena";
  const target=TARGETS[i];
  let best=pool[0];
  let bestScore=-9999;
  for(const r of pool){
   const g=group(r);
   let score=0;
   if(g===target)score+=6;
   if(hasVeg(r))score+=meal==="Cena"?3:2;
   score+=Math.min(4,hasInventory(r,opts.inventory))*2;
   const priority=(opts.priority||[]).map(norm);
   if(priority.length&&r.ingredients.some(i=>priority.some(p=>norm(i.name).includes(p)||p.includes(norm(i.key||i.name)))))score+=5;
   score-=Math.max(0,(used.get(r.id)||0))*8;
   if(meal==="Cena"){
    if(r.time<=25)score+=4;
    if(r.time>40)score-=4;
   }else{
    if(r.mode.includes("mealprep"))score+=2;
   }
   if(r.servings>=Math.max(1,opts.people))score+=1;
   if(opts.budgetPressure){const cost=opts.costByRecipe?.[r.id];if(typeof cost==="number"&&Number.isFinite(cost))score-=Math.min(12,cost*.7)}
   if(score>bestScore){bestScore=score;best=r}
  }
  if(!best)break;
  used.set(best.id,(used.get(best.id)||0)+1);
  const invHits=hasInventory(best,opts.inventory);
  const why=invHits>=2?"Aprovecha varios productos que ya tienes":group(best)===target?"Da variedad a la semana":meal==="Cena"&&best.time<=25?"Cena rápida":"Encaja con el hogar";
  slots.push({day:Math.floor(i/2),meal,recipeId:best.id,why});
 }
 const today=new Date().toISOString().slice(0,10);
 return {id:"week-"+Date.now(),createdAt:today,startDate:today,slots};
}
