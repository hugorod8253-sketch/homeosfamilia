import type { WeeklyMenuRecipe } from "./weekly-menu";
export type MenuPreferences={briefing:string;likes:string[];excludes:string[];favoriteRecipeIds:string[];repeat:"variety"|"favorites"|"routine";favoriteFrequency:number;dailyCalories?:number;maxMinutes?:number;diet:"any"|"vegetarian"|"vegan"};
export const DEFAULT_MENU_PREFERENCES:MenuPreferences={briefing:"",likes:[],excludes:[],favoriteRecipeIds:[],repeat:"variety",favoriteFrequency:2,diet:"any"};
export function menuNorm(s:string){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim()}
const foodTerms=["arroz","pollo","pavo","ensalada","pasta","pizza","huevo","jamon","chorizo","patata","pescado","salmon","merluza","atun","legumbre","garbanzo","lenteja","verdura","brocoli","espinaca","yogur","avena","queso","leche","fruta","tofu","cerdo","ternera","chocolate","marisco","cacahuete","nuez","almendra"];
export function normalizeMenuPreferences(raw:unknown):MenuPreferences{
 const r=raw&&typeof raw==="object"?raw as Partial<MenuPreferences>:{};
 const texts=(v:unknown)=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==="string"&&x.trim()).map(x=>x.slice(0,150)))].slice(0,30):[];
 const calories=Number(r.dailyCalories),minutes=Number(r.maxMinutes);
 return {briefing:typeof r.briefing==="string"?r.briefing.slice(0,2000):"",likes:texts(r.likes),excludes:texts(r.excludes),favoriteRecipeIds:texts(r.favoriteRecipeIds).slice(0,6),repeat:["variety","favorites","routine"].includes(r.repeat||"")?r.repeat!:"variety",favoriteFrequency:Math.max(1,Math.min(7,Math.round(Number(r.favoriteFrequency)||2))),dailyCalories:calories>=1200&&calories<=5000?Math.round(calories):undefined,maxMinutes:minutes>=5&&minutes<=120?Math.round(minutes):undefined,diet:r.diet==="vegan"||r.diet==="vegetarian"?r.diet:"any"};
}
export function parseMenuBriefing(text:string,recipes:WeeklyMenuRecipe[]){
 const input=menuNorm(text),likes=new Set<string>(),excludes=new Set<string>();
 for(const rawClause of text.split(/[.;]|\bpero\b|\baunque\b/i)){
  const clause=menuNorm(rawClause);
  const negative=/\b(no me gusta|no quiero|sin|evitar|evita|odio|alergi\w*|intoleran\w*|no puedo comer)\b/.test(clause);
  const tail=negative?clause.replace(/^.*?(?:no me gusta|no quiero|sin|evitar|evita|odio|alergi\w*|intoleran\w*|no puedo comer)\s*/,""):clause;
  for(const term of foodTerms)if(new RegExp("\\b"+term+"\\w*\\b").test(tail))(negative?excludes:likes).add(term);
 }
 excludes.forEach(x=>likes.delete(x));
 const stop=new Set(["me","gusta","gustan","mucho","quiero","comer","con","y","el","la","los","las","un","una","de","del","semanal","semana","menu","gustaria","tener","todos","dias","fitness","preferencia"]);
 const requested=text.split(/[.;]/).map(menuNorm).find(clause=>/\b(quiero|gustaria|prefiero)\b/.test(clause)&&/\b(arroz|pollo|pizza|revuelto|ensalada|pasta)\b/.test(clause));
 const tokens=(requested||input).split(" ").filter(t=>t.length>2&&!stop.has(t)&&!excludes.has(t));
 const favoriteCandidates=recipes.map(r=>{const title=menuNorm(r.title),words=title.split(" ").filter(t=>!stop.has(t)&&t.length>2);const hits=words.filter(w=>tokens.some(t=>w===t||w.startsWith(t)||t.startsWith(w))).length;const titleWords=words.length;return {r,score:hits===titleWords&&hits>=2?100-hits*.1:hits>=2?hits*4-titleWords:0}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,5).map(x=>x.r);
 const calorieMatch=input.match(/\b(1[2-9]\d{2}|[2-4]\d{3}|5000)\s*(?:kcal|calorias)\b/);
 const time=input.match(/\b(\d{1,3})\s*(?:minutos|min)\b/);
 const diet=/vegano|vegana/.test(input)?"vegan":/vegetariano|vegetariana/.test(input)?"vegetarian":"any";
 const repeatMatch=input.match(/\b(2|3|4|5|6|7|dos|tres|cuatro|cinco|seis|siete)\s*(?:veces|dias)\b/);
 const nums:Record<string,number>={dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7};
 return {favoriteFrequency:repeatMatch?(nums[repeatMatch[1]]||Number(repeatMatch[1])):undefined,likes:[...likes],excludes:[...excludes],favoriteCandidates,dailyCalories:calorieMatch?Number(calorieMatch[1]):undefined,maxMinutes:time?Number(time[1]):undefined,diet} as const;
}
export function matchesMenuTerm(r:WeeklyMenuRecipe,term:string){
 const t=menuNorm(term),text=menuNorm([r.title,...r.ingredients.map(i=>i.name)].join(" "));
 const patterns:Record<string,RegExp>={pescado:/salmon|merluza|atun|bacalao|sardina|dorada|lubina|caballa|trucha/,marisco:/gamba|langostino|calamar|sepia|pulpo|mejillon/,legumbre:/garbanzo|lenteja|alubia|judia|guisante/,verdura:/espinaca|brocoli|zanahoria|calabacin|tomate|pimiento|lechuga|rucula|calabaza|esparrago|coliflor|berenjena|puerro/};
 return patterns[t]?patterns[t].test(text):text.split(" ").some(w=>w===t||w.startsWith(t));
}
