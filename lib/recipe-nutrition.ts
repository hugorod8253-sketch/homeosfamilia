/** Generic reference values per 100 g edible portion; estimates, never brand label values.
 * Reference framework: USDA FoodData Central / SR. Unit weights below are explicit approximations.
 */
type Nutrients={calories:number;protein:number;carbs:number;fat:number};
type Food={match:RegExp;values:[number,number,number,number];unit?:number;density?:number};
const foods:Food[]=[
 {match:/^agua$|^sal$/,values:[0,0,0,0]},
 {match:/aceite/,values:[884,0,0,100],density:.91},
 {match:/vinagre/,values:[19,0,0.3,0]},
 {match:/jamon/,values:[250,30,0,14]},
 {match:/huevo/,values:[143,12.6,.7,9.5],unit:50},
 {match:/tomate(?! frito| seco)/,values:[18,.9,3.9,.2],unit:150},
 {match:/pepino/,values:[15,.7,3.6,.1],unit:200},
 {match:/pimiento/,values:[20,.9,4.6,.2],unit:150},
 {match:/ajo/,values:[149,6.4,33.1,.5],unit:3},
 {match:/cebolla/,values:[40,1.1,9.3,.1],unit:150},
 {match:/pan/,values:[265,9,49,3.2],unit:30},
 {match:/patata/,values:[77,2,17.5,.1],unit:180},
 {match:/calabacin/,values:[17,1.2,3.1,.3],unit:200},
 {match:/zanahoria/,values:[41,.9,9.6,.2],unit:80},
 {match:/calabaza/,values:[26,1,6.5,.1]},
 {match:/brocoli/,values:[34,2.8,6.6,.4]},
 {match:/espinaca/,values:[23,2.9,3.6,.4]},
 {match:/pollo|pavo/,values:[120,22.5,0,2.6]},
 {match:/merluza|bacalao/,values:[82,18,0,.7]},
 {match:/salmon/,values:[208,20,0,13]},
 {match:/arroz/,values:[365,7.1,80,.7]},
 {match:/pasta|macarron|espagueti/,values:[371,13,75,1.5]},
 {match:/avena/,values:[379,13.2,67.7,6.5]},
 {match:/harina/,values:[364,10.3,76.3,1]},
 {match:/leche/,values:[50,3.4,4.8,1.8],density:1.03},
 {match:/yogur natural/,values:[61,3.5,4.7,3.3],unit:125},
 {match:/platano|banana/,values:[89,1.1,22.8,.3],unit:120},
 {match:/manzana/,values:[52,.3,13.8,.2],unit:150},
 {match:/garbanzo.*cocid/,values:[164,8.9,27.4,2.6]},
 {match:/lenteja.*cocid/,values:[116,9,20.1,.4]},
 {match:/tofu/,values:[144,17.3,2.8,8.7]},
 {match:/aguacate/,values:[160,2,8.5,14.7],unit:150},
 {match:/azucar/,values:[387,0,100,0]},
 {match:/mantequilla/,values:[717,.9,.1,81.1]},
];
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function estimateRecipeNutrition(recipe:{servings:number;ingredients:{name:string;qty:string}[]}){
 const total:Nutrients={calories:0,protein:0,carbs:0,fat:0};const missing:string[]=[];const assumptions:string[]=[];
 for(const i of recipe.ingredients){
  const incompatible=/\b(?:cocid\w*|frit\w*|adobad\w*|salsa|conserva|lata|lonchas?)\b/.test(norm(i.name));
  const food=incompatible&&!/garbanzo.*cocid|lenteja.*cocid/.test(norm(i.name))?undefined:foods.find(f=>f.match.test(norm(i.name)));const q=norm(i.qty).replace(',','.').match(/^(\d+(?:\.\d+)?)\s*(kg|g|ml|l|uds?|unidades?|lonchas?)$/);
  if(!food||!q){missing.push(i.name);continue;}
  const amount=Number(q[1]),unit=q[2];let grams=amount;
  if(unit==='kg')grams*=1000;
  else if(unit==='ml'||unit==='l'){grams*=unit==='l'?1000:1;grams*=food.density||1;}
  else if(unit!=='g'){
   if(!food.unit){missing.push(i.name);continue;}
   grams*=food.unit;assumptions.push(`${i.name}: ≈ ${food.unit} g por unidad`);
  }
  (Object.keys(total) as Array<keyof Nutrients>).forEach((key,index)=>total[key]+=food.values[index]*grams/100);
 }
 if(missing.length||!Number.isFinite(recipe.servings)||recipe.servings<=0)return {complete:false as const,missing,assumptions};
 const rounded=(div:number)=>Object.fromEntries(Object.entries(total).map(([k,v])=>[k,Math.round(v/div*10)/10])) as Nutrients;
 return {complete:true as const,total:rounded(1),perServing:rounded(recipe.servings),missing,assumptions};
}
