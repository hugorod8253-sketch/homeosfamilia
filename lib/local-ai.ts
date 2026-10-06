export type LocalAiProgress={progress:number;text:string};
export type LocalAiRecipe={
 title:string;
 description:string;
 time:number;
 servings:number;
 ingredients:{name:string;qty:string;key:string}[];
 steps:string[];
 tools:string[];
};

const DESKTOP_MODEL="Llama-3.2-1B-Instruct-q4f16_1-MLC";
const MOBILE_MODEL="SmolLM2-360M-Instruct-q4f32_1-MLC";
let enginePromise:Promise<any>|null=null;
let activeModel="";

export function localAiSupported(){
 if(typeof window==="undefined")return false;
 return "gpu" in navigator && Boolean((navigator as any).gpu);
}
export function preferredLocalAiModel(){
 if(typeof window==="undefined")return DESKTOP_MODEL;
 const mobile=/iphone|ipad|ipod|android/i.test(navigator.userAgent)||window.innerWidth<820;
 return mobile?MOBILE_MODEL:DESKTOP_MODEL;
}

async function createEngine(modelId:string,onProgress?:(p:LocalAiProgress)=>void){
 const webllm=await import("@mlc-ai/web-llm");
 return webllm.CreateMLCEngine(modelId,{
  initProgressCallback:(report:any)=>{
   const p=typeof report?.progress==="number"?Math.round(report.progress*100):0;
   onProgress?.({progress:p,text:report?.text||"Preparando IA local"});
  },
  logLevel:"WARN"
 },{context_window_size:2048});
}
async function getEngine(onProgress?:(p:LocalAiProgress)=>void){
 if(!localAiSupported())throw new Error("webgpu_unavailable");
 const preferred=preferredLocalAiModel();
 if(enginePromise&&activeModel===preferred)return enginePromise;
 activeModel=preferred;
 enginePromise=createEngine(preferred,onProgress).catch(async()=>{
  if(preferred===MOBILE_MODEL){enginePromise=null;activeModel="";throw new Error("model_load_failed")}
  activeModel=MOBILE_MODEL;
  return createEngine(MOBILE_MODEL,onProgress);
 });
 try{return await enginePromise}catch(err){enginePromise=null;activeModel="";throw err}
}

export function extractLocalAiJson(text:string){
 const cleaned=text.trim().replace(/^\`\`\`json\s*/i,"").replace(/^\`\`\`/,"").replace(/\`\`\`$/,"").trim();
 const first=cleaned.indexOf("[");
 const last=cleaned.lastIndexOf("]");
 if(first<0||last<=first)throw new Error("bad_json");
 return JSON.parse(cleaned.slice(first,last+1));
}
export function sanitizeLocalAiRecipes(raw:unknown,people=1):LocalAiRecipe[]{
 if(!Array.isArray(raw))throw new Error("bad_json");
 const recipes=raw.slice(0,3).flatMap((r:any,i:number)=>{
  const ingredients=Array.isArray(r?.ingredients)?r.ingredients.slice(0,12).map((x:any)=>({
   name:String(x?.name||"").trim().slice(0,80),
   qty:String(x?.qty||"al gusto").trim().slice(0,40),
   key:String(x?.key||x?.name||"").trim().toLowerCase().slice(0,60)
  })).filter((x:any)=>x.name&&x.key):[];
  const steps=Array.isArray(r?.steps)?r.steps.slice(0,10).map((x:any)=>String(x).trim().slice(0,240)).filter(Boolean):[];
  if(!ingredients.length||!steps.length)return [];
  return [{
   title:String(r?.title||("Idea "+(i+1))).trim().slice(0,80)||("Idea "+(i+1)),
   description:String(r?.description||"").trim().slice(0,220),
   time:Math.max(5,Math.min(180,Math.round(Number(r?.time)||25))),
   servings:Math.max(1,Math.min(12,Math.round(Number(r?.servings)||Math.max(1,people)))),
   ingredients,
   steps,
   tools:Array.isArray(r?.tools)?r.tools.slice(0,6).map((x:any)=>String(x).trim().slice(0,60)).filter(Boolean):[]
  } satisfies LocalAiRecipe];
 });
 if(!recipes.length)throw new Error("bad_recipe_shape");
 return recipes;
}
export function parseLocalAiResponse(text:string,people=1){
 return sanitizeLocalAiRecipes(extractLocalAiJson(text),people);
}
export type LocalAiScope="casa"|"planear";

export function buildLocalAiPrompt(input:{
 request:string;
 inventory:string[];
 people:number;
 dislikes:string[];
 tools:string[];
 mode:string;
 scope?:LocalAiScope;
}){
 const inventory=input.inventory.slice(0,60).join(", ")||"sin inventario fiable";
 const dislikes=input.dislikes.filter(Boolean).join(", ")||"ninguna";
 const tools=input.tools.join(", ")||"equipamiento no indicado";
 const scope=input.scope||"casa";
 const scopeRule=scope==="planear"
  ?"El usuario está PLANIFICANDO y puede comprar. Respeta sobre todo el plato o antojo pedido; usa lo que ya hay cuando encaje, pero puedes incluir ingredientes faltantes razonables."
  :"El usuario quiere cocinar CON LO QUE HAY. Prioriza fuertemente el inventario disponible y minimiza ingredientes faltantes; no presentes como lista una receta que depende de muchas compras si existe una alternativa viable.";
 const system="Eres el asistente culinario local de HomeOS. Responde SOLO con un array JSON válido de 3 recetas. No uses markdown. No inventes que un alimento caducado o estropeado es seguro. Si un ingrediente no aparece en inventario pero el usuario afirma explícitamente que lo tiene en su petición, trátalo como disponible para esta consulta. "+scopeRule+" Mantén recetas domésticas realistas para España. No des consejos médicos ni nutricionales. Respeta alimentos indicados como no gustar/evitar. Cada receta debe tener: title, description, time (minutos, entero), servings (entero), ingredients [{name,qty,key}], steps [strings], tools [strings]. Las cantidades deben ser razonables y los pasos breves.";
 const user="Petición: "+(input.request||"Dame ideas para comer con lo que tengo")+"\nPersonas: "+input.people+"\nModo: "+input.mode+"\nObjetivo: "+(scope==="planear"?"planificar, se puede comprar":"cocinar con Casa")+"\nInventario conocido: "+inventory+"\nNo gusta / evitar: "+dislikes+"\nEquipamiento disponible: "+tools+"\nGenera 3 opciones distintas.";
 return {system,user};
}

export async function generateLocalRecipes(input:{
 request:string;
 inventory:string[];
 people:number;
 dislikes:string[];
 tools:string[];
 mode:string;
 scope?:LocalAiScope;
},onProgress?:(p:LocalAiProgress)=>void):Promise<LocalAiRecipe[]>{
 const engine=await getEngine(onProgress);
 const {system,user}=buildLocalAiPrompt(input);
 let parsed:any=null;
 let lastRaw="";
 for(let attempt=0;attempt<2;attempt++){
  const reply=await engine.chat.completions.create({
   messages:[
    {role:"system",content:system+(attempt?" IMPORTANTE: tu respuesta anterior no fue JSON válido. Devuelve únicamente el array JSON, sin texto antes ni después.":"")},
    {role:"user",content:user}
   ],
   temperature:attempt?0.15:.35,
   max_tokens:900
  });
  lastRaw=reply?.choices?.[0]?.message?.content||"";
  try{parsed=extractLocalAiJson(lastRaw);if(Array.isArray(parsed))break}catch{}
 }
 if(!Array.isArray(parsed))throw new Error("bad_json");
 return sanitizeLocalAiRecipes(parsed,input.people);
}

export const LOCAL_AI_MODEL=DESKTOP_MODEL;
export const LOCAL_AI_MOBILE_MODEL=MOBILE_MODEL;
