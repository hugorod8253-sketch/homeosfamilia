"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { clearSync, connectionCode, createRemoteHousehold, getStoredSync, parseConnectionCode, readRemoteHousehold, storeSync, syncConfigured, type SyncCredentials, writeRemoteHousehold } from "../lib/homeos-sync";

type View = "inicio"|"comer"|"comprar"|"casa"|"finanzas";
type StockState = "hay"|"poco"|"falta"|"mucho"|"incierto";
type Location = "Nevera"|"Congelador"|"Despensa"|"Suplementos";
type Goal = "organizar"|"ahorrar"|"desperdicio"|"equilibrio";
type NutritionMode = "basica"|"detallada"|"off";
type CookingStyle = "rapido"|"normal"|"cocinar"|"mealprep";

type InventoryItem = {
  id:string; name:string; qty:number; unit:string; location:Location; category:string;
  stock:StockState; purchasedAt:string; expires?:string; dateType?:"caducidad"|"preferente";
  price?:number; servings?:number; preparedAt?:string; source?:"compra"|"receta"|"sobras"|"mealprep"; frozenAt?:string; originalExpires?:string; supermarket?:string;
};
type ShoppingItem = {
  id:string; name:string; qty:number; unit:string; category:string; supermarket?:string;
  requestedBy:string; reason:"persona"|"recomienda"|"receta"|"reposicion"; status:"pendiente"|"carrito";
};
type PurchaseRecord = {id:string;name:string;qty:number;unit:string;category:string;date:string;supermarket?:string;requestedBy?:string};
type Member = {id:string;name:string;relation:string;presence:"casa"|"fuera_dia"|"fines_semana"|"variable";appetite:"poco"|"normal"|"mucho";dislikes:string;notes:string};
type EventItem = {id:string;title:string;date:string};
type RecipeIngredient = {name:string;qty:string;key:string};
type Recipe = {
  id:string; title:string; image:string; time:number; difficulty:"Fácil"|"Media";
  mode:CookingStyle[]; servings:number; calories:number; protein:number; carbs:number; fat:number;
  ingredients:RecipeIngredient[]; steps:string[]; description:string; tools?:string[];
};
type Profile = {
  householdSize:number; supermarkets:string[]; mainSupermarket:string; goals:Goal[];
  nutrition:NutritionMode; cooking:CookingStyle; shoppingCycle:"diaria"|"semanal"|"quincenal"|"mensual"|"mixta";
  notifications:boolean; onboardingDone:boolean; financeMode:"orientativo"|"preciso"; kitchenTools:string[];
};
type AppState = {
  inventory:InventoryItem[]; shopping:ShoppingItem[]; purchaseHistory:PurchaseRecord[]; members:Member[]; events:EventItem[];
  profile:Profile; budget:number; spent:number; waste:number; wasteSaved:number;
};

const SUPERMARKETS=["Mercadona","Lidl","Aldi","Carrefour","Alcampo","Dia","Consum","Bonpreu / Esclat","Caprabo","Eroski","Condis","Carnicería","Frutería","Otro supermercado"];
const KITCHEN_TOOLS=["Placa / inducción","Gas","Horno","Air fryer","Microondas","Thermomix / robot","Batidora"];
const CATEGORIES=["Todos","Lácteos","Carne","Fruta y verdura","Despensa","Preparados","Suplementos","Limpieza y hogar"];
const LOCATIONS=["Todo","Nevera","Congelador","Despensa"];
const CATEGORY_LABELS:Record<string,string>={"Todos":"Todo","Lácteos":"Lácteos","Carne":"Carne y pescado","Fruta y verdura":"Fruta y verdura","Despensa":"Despensa","Preparados":"Preparados","Suplementos":"Suplementos","Limpieza y hogar":"Limpieza y hogar"};
const CATEGORY_ICONS:Record<string,string>={"Todos":"▦","Lácteos":"🥛","Carne":"🥩","Fruta y verdura":"🥬","Despensa":"🥫","Preparados":"🍱","Suplementos":"＋","Limpieza y hogar":"🧴"};
const LOCATION_ICONS:Record<string,string>={"Todo":"⌂","Nevera":"❄️","Congelador":"🧊","Despensa":"▦"};

const RECIPES:Recipe[]=[
 {id:"r1",title:"Hamburguesa casera",image:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=76",time:20,difficulty:"Fácil",mode:["rapido","normal"],servings:4,calories:620,protein:36,carbs:52,fat:28,description:"Rápida y pensada para aprovechar lo que ya tienes.",tools:["Placa / inducción","Gas","Air fryer"],ingredients:[{name:"Hamburguesas",qty:"4 uds",key:"hamburguesas"},{name:"Queso",qty:"4 lonchas",key:"queso"},{name:"Pan de hamburguesa",qty:"4 uds",key:"pan"},{name:"Tomates",qty:"2 uds",key:"tomate"}],steps:["Calienta una sartén a fuego medio-alto.","Cocina las hamburguesas 3–4 min por lado.","Añade el queso al final.","Monta con pan y tomate y sirve."]},
 {id:"r2",title:"Pasta cremosa con queso",image:"https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=76",time:18,difficulty:"Fácil",mode:["rapido","normal"],servings:4,calories:540,protein:22,carbs:76,fat:15,description:"Una comida de despensa sencilla y rápida.",tools:["Placa / inducción","Gas","Thermomix / robot"],ingredients:[{name:"Pasta",qty:"320 g",key:"pasta"},{name:"Queso",qty:"120 g",key:"queso"},{name:"Leche",qty:"200 ml",key:"leche"}],steps:["Cuece la pasta.","Calienta la leche a fuego suave.","Añade el queso y remueve.","Mezcla con la pasta y ajusta de sal."]},
 {id:"r3",title:"Pollo con arroz y verduras",image:"https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=900&q=76",time:30,difficulty:"Fácil",mode:["normal","mealprep","cocinar"],servings:5,calories:585,protein:46,carbs:64,fat:16,description:"Ideal para varias raciones y para llevar fuera de casa.",tools:["Placa / inducción","Gas","Horno"],ingredients:[{name:"Pollo",qty:"800 g",key:"pollo"},{name:"Arroz",qty:"350 g",key:"arroz"},{name:"Tomates",qty:"3 uds",key:"tomate"}],steps:["Corta y dora el pollo.","Cuece el arroz por separado.","Saltea las verduras o tomate.","Reparte en raciones y deja enfriar antes de guardar."]},
 {id:"r4",title:"Batido de plátano y proteína",image:"https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=900&q=76",time:5,difficulty:"Fácil",mode:["rapido","mealprep"],servings:1,calories:390,protein:32,carbs:48,fat:8,description:"Batido rápido; los suplementos se integran como cualquier otro ingrediente.",tools:["Batidora","Thermomix / robot"],ingredients:[{name:"Leche",qty:"250 ml",key:"leche"},{name:"Plátano",qty:"1 ud",key:"platano"},{name:"Proteína whey",qty:"30 g",key:"proteina"}],steps:["Añade todos los ingredientes a la batidora.","Tritura 30–45 segundos.","Ajusta textura con leche o agua."]},
 {id:"r5",title:"Tortitas para aprovechar leche",image:"https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=900&q=76",time:22,difficulty:"Fácil",mode:["normal","cocinar"],servings:4,calories:430,protein:17,carbs:58,fat:14,description:"Buena opción cuando tienes leche de sobra.",tools:["Placa / inducción","Gas"],ingredients:[{name:"Leche",qty:"500 ml",key:"leche"},{name:"Huevos",qty:"3 uds",key:"huevo"},{name:"Harina",qty:"300 g",key:"harina"}],steps:["Mezcla huevos y leche.","Añade harina poco a poco.","Cocina porciones en sartén antiadherente.","Sirve y guarda las sobrantes."]}
];

const DEFAULT:AppState={
 inventory:[
  {id:"i1",name:"Leche semidesnatada",qty:3,unit:"L",location:"Despensa",category:"Lácteos",stock:"hay",purchasedAt:"2026-10-01",expires:"2027-02-20",dateType:"preferente",price:3.2},
  {id:"i2",name:"Yogures naturales",qty:2,unit:"uds",location:"Nevera",category:"Lácteos",stock:"poco",purchasedAt:"2026-10-02",expires:"2026-10-09",dateType:"preferente",price:1.8},
  {id:"i3",name:"Hamburguesas",qty:4,unit:"uds",location:"Nevera",category:"Carne",stock:"hay",purchasedAt:"2026-10-03",expires:"2026-10-07",dateType:"caducidad",price:5.8},
  {id:"i4",name:"Queso lonchas",qty:6,unit:"lonchas",location:"Nevera",category:"Lácteos",stock:"hay",purchasedAt:"2026-10-02",expires:"2026-10-12",dateType:"preferente",price:2.4},
  {id:"i5",name:"Pasta",qty:1,unit:"kg",location:"Despensa",category:"Despensa",stock:"hay",purchasedAt:"2026-09-15",expires:"2027-05-01",dateType:"preferente",price:1.6},
  {id:"i6",name:"Pollo",qty:600,unit:"g",location:"Congelador",category:"Carne",stock:"hay",purchasedAt:"2026-09-28",price:6.4},
  {id:"i7",name:"Proteína whey",qty:18,unit:"servicios",location:"Suplementos",category:"Suplementos",stock:"hay",purchasedAt:"2026-09-20",expires:"2027-08-01",dateType:"preferente",price:24},
  {id:"i8",name:"Pollo con arroz",qty:2,unit:"raciones",location:"Nevera",category:"Preparados",stock:"hay",purchasedAt:"2026-10-05",preparedAt:"2026-10-05",expires:"2026-10-08",dateType:"caducidad",servings:2,source:"sobras"}
 ],
 shopping:[
  {id:"s1",name:"Tomates",qty:4,unit:"uds",category:"Fruta y verdura",requestedBy:"Casa",reason:"recomienda",status:"pendiente"},
  {id:"s2",name:"Pan de hamburguesa",qty:1,unit:"pack",category:"Despensa",supermarket:"Mercadona",requestedBy:"Tú",reason:"receta",status:"pendiente"},
  {id:"s3",name:"Leche semidesnatada",qty:2,unit:"L",category:"Lácteos",supermarket:"Lidl",requestedBy:"Papá",reason:"persona",status:"pendiente"}
 ],
 purchaseHistory:[],
 members:[{id:"m1",name:"Tú",relation:"Yo",presence:"fines_semana",appetite:"normal",dislikes:"",notes:"Entre semana casi no está en casa."},{id:"m2",name:"Mamá",relation:"Madre",presence:"fuera_dia",appetite:"normal",dislikes:"",notes:"Suele comer fuera y vuelve por la noche."},{id:"m3",name:"Papá",relation:"Padre",presence:"casa",appetite:"normal",dislikes:"",notes:"Hace parte de la compra familiar."},{id:"m4",name:"Hermano",relation:"Hijo",presence:"casa",appetite:"mucho",dislikes:"queso",notes:"Consume bastante comida preparada."}],
 events:[{id:"e1",title:"Navidad",date:"2026-12-25"}],
 budget:800,spent:486.35,waste:18.4,wasteSaved:27.6,
 profile:{householdSize:4,supermarkets:["Mercadona","Lidl"],mainSupermarket:"Mercadona",goals:["organizar","desperdicio"],nutrition:"basica",cooking:"rapido",shoppingCycle:"semanal",notifications:true,onboardingDone:false,financeMode:"orientativo",kitchenTools:[]}
};

function normalizeState(x:any):AppState{
 const raw=x&&typeof x==="object"?x:{};
 const rawMembers=raw.members||DEFAULT.members;
 const profile={...DEFAULT.profile,...(raw.profile||{})};
 const baseMembers=rawMembers.map((m:any,i:number)=>({...((DEFAULT.members[i]||{id:"m"+(i+1),name:"Miembro "+(i+1),relation:"Miembro",presence:"variable",appetite:"normal",dislikes:"",notes:""}) as Member),...m}));
 const members=ensureMembers(baseMembers,profile.householdSize);
 return {...DEFAULT,...raw,profile,members,events:raw.events||DEFAULT.events,inventory:raw.inventory||DEFAULT.inventory,shopping:raw.shopping||DEFAULT.shopping,purchaseHistory:Array.isArray(raw.purchaseHistory)?raw.purchaseHistory:[]};
}
function loadState():AppState{
 if(typeof window==="undefined") return DEFAULT;
 try{return normalizeState(JSON.parse(localStorage.getItem("homeos:v5")||"{}"))}catch{return DEFAULT}
}
function daysUntil(date?:string){if(!date)return 999;const d=new Date(date+"T12:00:00");return Math.ceil((d.getTime()-Date.now())/86400000)}
function fmtDate(){return new Intl.DateTimeFormat("es-ES",{weekday:"long",day:"numeric",month:"long"}).format(new Date())}
function norm(s:string){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function hasInv(inv:InventoryItem[],key:string){const k=norm(key);return inv.some(i=>i.stock!=="falta"&&(norm(i.name).includes(k)||k.includes(norm(i.name).split(" ")[0])))}
function missing(recipe:Recipe,inv:InventoryItem[]){return recipe.ingredients.filter(x=>!hasInv(inv,x.key))}
function score(recipe:Recipe,inv:InventoryItem[]){return recipe.ingredients.length-missing(recipe,inv).length}
function reasonText(r:ShoppingItem["reason"]){return r==="persona"?"Pedido por":r==="recomienda"?"HomeOS recomienda":r==="receta"?"Añadido desde receta":"Reposición probable"}
function inferCategory(name:string){
 const n=norm(name);
 if(/leche|yogur|queso|mozzarella|nata|mantequilla/.test(n)) return "Lácteos";
 if(/pollo|carne|ternera|cerdo|pavo|hamburguesa|pescado|salmon|atun|marisco/.test(n)) return "Carne";
 if(/tomate|fruta|verdura|platano|banana|manzana|naranja|limon|fresa|arandano|patata|cebolla|zanahoria|aguacate/.test(n)) return "Fruta y verdura";
 if(/proteina|creatina|suplement/.test(n)) return "Suplementos";
 if(/detergente|suavizante|limpiador|jabon|papel higienico|papel de cocina|servilleta|lavavajillas|bolsa de basura|lejia/.test(n)) return "Limpieza y hogar";
 if(/tupper|preparad|meal prep|sobras/.test(n)) return "Preparados";
 return "Despensa";
}
function inferUnit(name:string){
 const n=norm(name);
 if(/kg|kilo/.test(n)) return "kg";
 if(/gramo/.test(n)) return "g";
 if(/litro/.test(n)) return "L";
 if(/mililitro|ml/.test(n)) return "ml";
 if(/rollo/.test(n)) return "rollos";
 return "ud";
}
function ensureMembers(members:Member[],count:number){
 const out=[...members];
 while(out.length<count){
  const n=out.length+1;
  out.push({id:"m"+n,name:"Miembro "+n,relation:"Miembro",presence:"variable",appetite:"normal",dislikes:"",notes:""});
 }
 return out;
}
function statusLabel(s:StockState){return s==="hay"?"Hay":s==="poco"?"Queda poco":s==="falta"?"Probablemente falta":s==="mucho"?"Hay bastante":"Revisar"}
function productIcon(name:string,cat:string){
 const n=norm(name);
 if(/pan|baguette|molde|hamburguesa.*pan/.test(n)) return "🍞";
 if(/leche/.test(n)) return "🥛";
 if(/yogur/.test(n)) return "🥣";
 if(/mozzarella/.test(n)) return "⚪";
 if(/queso/.test(n)) return "🧀";
 if(/huevo/.test(n)) return "🥚";
 if(/tomate/.test(n)) return "🍅";
 if(/patata/.test(n)) return "🥔";
 if(/cebolla/.test(n)) return "🧅";
 if(/zanahoria/.test(n)) return "🥕";
 if(/aguacate/.test(n)) return "🥑";
 if(/platano|banana/.test(n)) return "🍌";
 if(/manzana/.test(n)) return "🍎";
 if(/naranja|mandarina/.test(n)) return "🍊";
 if(/limon/.test(n)) return "🍋";
 if(/fresa/.test(n)) return "🍓";
 if(/arandano|frutos rojos/.test(n)) return "🫐";
 if(/chuche|gominola|caramelo/.test(n)) return "🍬";
 if(/chocolate/.test(n)) return "🍫";
 if(/galleta/.test(n)) return "🍪";
 if(/helado/.test(n)) return "🍨";
 if(/pizza/.test(n)) return "🍕";
 if(/pollo/.test(n)) return "🍗";
 if(/carne|ternera|cerdo|entrecot|hamburguesa/.test(n)) return "🥩";
 if(/pescado|salmon|atun/.test(n)) return "🐟";
 if(/marisco|gamba|langostino/.test(n)) return "🍤";
 if(/arroz/.test(n)) return "🍚";
 if(/pasta|macarron|espagueti/.test(n)) return "🍝";
 if(/sopa|crema/.test(n)) return "🥣";
 if(/ensalada/.test(n)) return "🥗";
 if(/sandwich|bocadillo/.test(n)) return "🥪";
 if(/cafe/.test(n)) return "☕";
 if(/agua/.test(n)) return "💧";
 if(/refresco|cola/.test(n)) return "🥤";
 if(/zumo/.test(n)) return "🧃";
 if(/congelad/.test(n)) return "🧊";
 if(/preparad|tupper|meal prep/.test(n)||cat==="Preparados") return "🍱";
 if(/proteina|creatina|suplement/.test(n)||cat==="Suplementos") return "🥤";
 if(/detergente|suavizante|limpiador/.test(n)) return "🧴";
 if(/jabon/.test(n)) return "🧼";
 if(/papel higienico|papel de cocina|servilleta/.test(n)) return "🧻";
 if(cat==="Fruta y verdura") return "🥬";
 if(cat==="Lácteos") return "🥛";
 if(cat==="Carne") return "🥩";
 return "🛍️";
}
function rotationBand(name:string,cat:string,location?:string){
 const n=norm(name);
 if(location==="Congelador") return {key:"baja",label:"Rotación baja"};
 if(/carne|pollo|pescado|mozzarella|yogur|pan|fruta|verdura|tomate|leche fresca|preparad/.test(n)) return {key:"alta",label:"Rotación alta"};
 if(/queso|embutido|huevo|tortilla|salsa refrigerada|bebida fresca/.test(n)) return {key:"media",label:"Rotación media"};
 return {key:"baja",label:"Rotación baja"};
}
function presenceText(p:Member["presence"]){return p==="casa"?"Come habitualmente en casa":p==="fuera_dia"?"Fuera durante el día":p==="fines_semana"?"Principalmente fines de semana":"Rutina variable"}
function appetiteText(a:Member["appetite"]){return a==="poco"?"Come poco":a==="mucho"?"Come bastante":"Consumo normal"}
function habitSignals(state:AppState){
 const now=Date.now();
 const recentPurchases=state.purchaseHistory.filter(x=>{
  const t=new Date(x.date+"T12:00:00").getTime();
  return t<=now&&now-t<=28*86400000;
 });
 const source=recentPurchases.length?recentPurchases:state.inventory.filter(i=>i.stock!=="falta").map(i=>({name:i.name,category:i.category}));
 const has=(re:RegExp,cat?:string)=>source.some((i:any)=>(cat&&i.category===cat)||re.test(norm(i.name)));
 return [
  ["Proteína",has(/pollo|carne|pescado|huevo|proteina|legumbre|lenteja|garbanzo/,"Carne")],
  ["Verdura",has(/verdura|tomate|zanahoria|cebolla|aguacate|brocoli|lechuga|pepino/)],
  ["Carbohidratos",has(/arroz|pasta|pan|patata|avena|cereal/)],
  ["Dulces/snacks",has(/chocolate|galleta|chuche|gominola|snack|bolleria|refresco/)]
 ] as [string,boolean][];
}
function logo(){return <div className="logo-mark" aria-label="HomeOS"><svg viewBox="0 0 64 64" role="img"><rect x="7" y="8" width="50" height="48" rx="15" className="logo-bg"/><path className="logo-h" d="M18 18h8v11h12V18h8v28h-8V36H26v10h-8z"/><ellipse className="logo-spoon" cx="32" cy="21.5" rx="4.4" ry="5.3"/><rect className="logo-spoon" x="30.5" y="26" width="3" height="16" rx="1.5"/></svg></div>}

const nav:{id:View;label:string;icon:string}[]=[
 {id:"inicio",label:"Inicio",icon:"⌂"},{id:"comer",label:"Comer",icon:"◉"},{id:"comprar",label:"Comprar",icon:"🛒"},{id:"casa",label:"Casa",icon:"⌑"},{id:"finanzas",label:"Finanzas",icon:"€"}
];

export default function HomeOS(){
 const [view,setView]=useState<View>("inicio");
 const [state,setState]=useState<AppState>(DEFAULT);
 const [hydrated,setHydrated]=useState(false);
 const [toast,setToast]=useState("");
 const [profileOpen,setProfileOpen]=useState(false);
 const [activeStore,setActiveStore]=useState("");
 const [shoppingActive,setShoppingActive]=useState(false);
 const [casaFocus,setCasaFocus]=useState<"all"|"expiring"|"prepared">("all");
 const [deviceMemberId,setDeviceMemberId]=useState("");
 const [syncCreds,setSyncCreds]=useState<SyncCredentials|null>(null);
 const [syncStatus,setSyncStatus]=useState<"local"|"connecting"|"synced"|"error">("local");
 const cameraRef=useRef<HTMLInputElement>(null),galleryRef=useRef<HTMLInputElement>(null),receiptRef=useRef<HTMLInputElement>(null);
 const syncRevisionRef=useRef(0);
 const lastSyncedJsonRef=useRef("");
 const syncCreateRef=useRef(false);
 const syncTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
 const stateRef=useRef(state);

 useEffect(()=>{stateRef.current=state},[state]);
 useEffect(()=>{if(!hydrated)return;const saved=localStorage.getItem("homeos:device-member");const valid=state.members.slice(0,state.profile.householdSize).some(m=>m.id===saved);const next=valid?saved||"":state.members[0]?.id||"";setDeviceMemberId(next)},[hydrated,state.profile.householdSize,state.members.length]);
 useEffect(()=>{if(hydrated&&deviceMemberId)localStorage.setItem("homeos:device-member",deviceMemberId)},[hydrated,deviceMemberId]);

 useEffect(()=>{
  let alive=true;
  (async()=>{
   const local=loadState();
   const creds=getStoredSync();
   if(creds&&syncConfigured()){
    setSyncStatus("connecting");
    try{
     const remote=await readRemoteHousehold(creds);
     if(!alive)return;
     if(remote){
      const remoteState=normalizeState(remote.data);
      setSyncCreds(creds);
      syncRevisionRef.current=remote.revision;
      lastSyncedJsonRef.current=JSON.stringify(remoteState);
      setState(remoteState);
      setSyncStatus("synced");
     }else{
      clearSync();
      setState(local);
      setSyncStatus("local");
     }
    }catch{
     if(!alive)return;
     setSyncCreds(creds);
     setState(local);
     setSyncStatus("error");
    }
   }else{
    setState(local);
    setSyncStatus("local");
   }
   if(alive)setHydrated(true);
  })();
  return()=>{alive=false};
 },[]);

 useEffect(()=>{
  if(!hydrated||!state.profile.onboardingDone||syncCreds||!syncConfigured()||syncCreateRef.current)return;
  syncCreateRef.current=true;
  const snapshot=state;
  setSyncStatus("connecting");
  createRemoteHousehold("Mi hogar",snapshot).then(({creds,revision})=>{
   setSyncCreds(creds);
   syncRevisionRef.current=revision;
   lastSyncedJsonRef.current=JSON.stringify(snapshot);
   setSyncStatus("synced");
  }).catch(()=>setSyncStatus("error")).finally(()=>{syncCreateRef.current=false});
 },[hydrated,state.profile.onboardingDone,syncCreds]);

 useEffect(()=>{
  if(!hydrated||typeof window==="undefined")return;
  const json=JSON.stringify(state);
  localStorage.setItem("homeos:v5",json);
  if(!syncCreds||!state.profile.onboardingDone||!syncConfigured()||json===lastSyncedJsonRef.current)return;
  if(syncTimerRef.current)clearTimeout(syncTimerRef.current);
  syncTimerRef.current=setTimeout(async()=>{
   setSyncStatus("connecting");
   try{
    const revision=await writeRemoteHousehold(syncCreds,stateRef.current);
    syncRevisionRef.current=revision;
    lastSyncedJsonRef.current=JSON.stringify(stateRef.current);
    setSyncStatus("synced");
   }catch{setSyncStatus("error")}
  },700);
  return()=>{if(syncTimerRef.current)clearTimeout(syncTimerRef.current)};
 },[state,hydrated,syncCreds]);

 useEffect(()=>{
  if(!hydrated||!syncCreds||!syncConfigured())return;
  let alive=true;
  const pull=async()=>{
   if(document.visibilityState==="hidden")return;
   if(JSON.stringify(stateRef.current)!==lastSyncedJsonRef.current)return;
   try{
    const remote=await readRemoteHousehold(syncCreds);
    if(!alive||!remote||remote.revision<=syncRevisionRef.current)return;
    const remoteState=normalizeState(remote.data);
    syncRevisionRef.current=remote.revision;
    lastSyncedJsonRef.current=JSON.stringify(remoteState);
    setState(remoteState);
    setSyncStatus("synced");
   }catch{if(alive)setSyncStatus("error")}
  };
  const id=window.setInterval(pull,15000);
  window.addEventListener("focus",pull);
  document.addEventListener("visibilitychange",pull);
  return()=>{alive=false;window.clearInterval(id);window.removeEventListener("focus",pull);document.removeEventListener("visibilitychange",pull)};
 },[hydrated,syncCreds]);

 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(""),2400);return()=>clearTimeout(t)},[toast]);
 useEffect(()=>{window.scrollTo({top:0,behavior:"smooth"})},[view]);

 async function connectHome(code:string){
  const creds=parseConnectionCode(code);
  if(!creds||!syncConfigured())return false;
  setSyncStatus("connecting");
  try{
   const remote=await readRemoteHousehold(creds);
   if(!remote){setSyncStatus("error");return false}
   const remoteState=normalizeState(remote.data);
   storeSync(creds);
   setSyncCreds(creds);
   syncRevisionRef.current=remote.revision;
   lastSyncedJsonRef.current=JSON.stringify(remoteState);
   setState(remoteState);
   setSyncStatus("synced");
   setToast("Hogar conectado");
   return true;
  }catch{setSyncStatus("error");return false}
 }

 async function copyHomeCode(){
  if(!syncCreds)return;
  try{
   await navigator.clipboard.writeText(connectionCode(syncCreds));
   setToast("Código del hogar copiado");
  }catch{setToast("No se pudo copiar el código")}
 }

 async function syncNow(){
  if(!syncCreds)return;
  setSyncStatus("connecting");
  try{
   const revision=await writeRemoteHousehold(syncCreds,stateRef.current);
   syncRevisionRef.current=revision;
   lastSyncedJsonRef.current=JSON.stringify(stateRef.current);
   setSyncStatus("synced");
   setToast("Hogar sincronizado");
  }catch{setSyncStatus("error");setToast("No se pudo sincronizar")}
 }

 const expiring=useMemo(()=>state.inventory.filter(i=>daysUntil(i.expires)<=3&&i.stock!=="falta"),[state.inventory]);
 const available=state.budget-state.spent;
 const confidence=state.inventory.filter(i=>i.stock!=="incierto").length/Math.max(1,state.inventory.length);

 function addFromRecipe(recipe:Recipe){
  const miss=missing(recipe,state.inventory);
  if(!miss.length){setToast("Tienes todo para esta receta");return}
  const toAdd=miss.filter(m=>!state.shopping.some(q=>q.status==="pendiente"&&norm(q.name).includes(norm(m.key))));
  if(!toAdd.length){setToast("Los ingredientes que faltan ya están en la compra");return}
  setState(s=>({...s,shopping:[...s.shopping,...toAdd.map(m=>({id:crypto.randomUUID(),name:m.name,qty:1,unit:inferUnit(m.name),category:inferCategory(m.name),requestedBy:"Casa",reason:"receta" as const,status:"pendiente" as const}))]}));
  setToast(`${toAdd.length} ingredientes añadidos a la compra`);
 }

 function finishShopping(total?:number){
  const cart=state.shopping.filter(i=>i.status==="carrito");
  if(!cart.length){setToast("Todavía no hay productos en el carrito");return}
  const today=new Date().toISOString().slice(0,10);
  setState(s=>{
   const inventory=[...s.inventory];
   for(const x of cart){
    const location:Location=x.category==="Lácteos"||x.category==="Carne"?"Nevera":"Despensa";
    const idx=inventory.findIndex(i=>norm(i.name)===norm(x.name)&&i.unit===x.unit&&i.location===location);
    if(idx>=0){
     inventory[idx]={...inventory[idx],qty:Math.max(0,inventory[idx].qty)+x.qty,stock:"hay",purchasedAt:today,supermarket:x.supermarket||activeStore||inventory[idx].supermarket};
    }else{
     inventory.unshift({id:crypto.randomUUID(),name:x.name,qty:x.qty,unit:x.unit,location,category:x.category,stock:"hay",purchasedAt:today,supermarket:x.supermarket||activeStore});
    }
   }
   const purchaseHistory=[...s.purchaseHistory,...cart.map(x=>({
    id:crypto.randomUUID(),
    name:x.name,
    qty:x.qty,
    unit:x.unit,
    category:x.category,
    date:today,
    supermarket:x.supermarket||activeStore||undefined,
    requestedBy:x.requestedBy
   }))].slice(-600);
   return {...s,inventory,purchaseHistory,spent:typeof total==="number"&&total>=0?s.spent+total:s.spent,shopping:s.shopping.filter(i=>i.status!=="carrito")};
  });
  setShoppingActive(false);setActiveStore("");setToast(`${cart.length} productos guardados como compra reciente`);
 }

 if(!hydrated)return <div className="app-loading"><div className="app-loading-mark">H</div><strong>HomeOS</strong></div>;
 if(!state.profile.onboardingDone)return <Onboarding state={state} setState={setState} connectHome={connectHome} syncStatus={syncStatus}/>;

 return <div className="app-shell">
  <aside className="sidebar">
   <div className="brand">{logo()}<div><strong>HomeOS</strong><span>Tu cocina, sin carga mental</span></div></div>
   <nav>{nav.map(n=><button key={n.id} className={view===n.id?"nav active":"nav"} onClick={()=>{if(n.id==="casa")setCasaFocus("all");setView(n.id)}}><span>{n.icon}</span>{n.label}</button>)}</nav>
   <button className="profile" onClick={()=>setProfileOpen(true)}><span>FR</span><div><strong>Mi hogar</strong><small>{state.profile.householdSize} personas</small></div></button>
  </aside>

  <main className="main">
   <header className="topbar"><div><span className="eyebrow">{fmtDate()}</span><h1>{view==="inicio"?"Dashboard":nav.find(n=>n.id===view)?.label}</h1></div><div className="top-actions">{syncCreds&&<span className={`sync-pill ${syncStatus}`}>{syncStatus==="synced"?"● Sincronizado":syncStatus==="connecting"?"↻ Guardando":syncStatus==="error"?"! Sin conexión":"Local"}</span>}<button className="avatar" onClick={()=>setProfileOpen(true)}>FR</button></div></header>
   {view==="inicio"&&<Inicio state={state} setState={setState} expiring={expiring} confidence={confidence} available={available} setView={setView} setCasaFocus={setCasaFocus}/>}
   {view==="comer"&&<Comer state={state} setState={setState} addFromRecipe={addFromRecipe}/>}
   {view==="comprar"&&<Comprar state={state} setState={setState} activeStore={activeStore} setActiveStore={setActiveStore} shoppingActive={shoppingActive} setShoppingActive={setShoppingActive} finishShopping={finishShopping} receiptRef={receiptRef} setToast={setToast} deviceMemberId={deviceMemberId} setDeviceMemberId={setDeviceMemberId}/>}
   {view==="casa"&&<Casa state={state} setState={setState} cameraRef={cameraRef} galleryRef={galleryRef} setToast={setToast} focus={casaFocus} clearFocus={()=>setCasaFocus("all")}/>}
   {view==="finanzas"&&<Finanzas state={state} setState={setState} available={available}/>}
  </main>

  <nav className="bottom-nav">{nav.map(n=><button key={n.id} className={view===n.id?"active":""} onClick={()=>{if(n.id==="casa")setCasaFocus("all");setView(n.id)}}><span>{n.icon}</span><small>{n.label}</small></button>)}</nav>
  {profileOpen&&<ProfileModal state={state} setState={setState} close={()=>setProfileOpen(false)} syncCreds={syncCreds} syncStatus={syncStatus} connectHome={connectHome} copyHomeCode={copyHomeCode} syncNow={syncNow} deviceMemberId={deviceMemberId} setDeviceMemberId={setDeviceMemberId} setToast={setToast}/>}
  {toast&&<div className="toast" role="status" aria-live="polite"><span>✓</span>{toast}</div>}
 </div>
}

function Onboarding({state,setState,connectHome,syncStatus}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;connectHome:(code:string)=>Promise<boolean>;syncStatus:"local"|"connecting"|"synced"|"error"}){
 const [step,setStep]=useState(0);
 const [joinOpen,setJoinOpen]=useState(false);
 const [joinCode,setJoinCode]=useState("");
 const [joinError,setJoinError]=useState("");
 async function joinExisting(){setJoinError("");const ok=await connectHome(joinCode);if(!ok)setJoinError("Código no válido o no se pudo conectar.");}
 const toggleGoal=(g:Goal)=>setState(s=>({...s,profile:{...s.profile,goals:s.profile.goals.includes(g)?s.profile.goals.filter(x=>x!==g):[...s.profile.goals,g]}}));
 const toggleMarket=(m:string)=>setState(s=>({...s,profile:{...s.profile,supermarkets:s.profile.supermarkets.includes(m)?s.profile.supermarkets.filter(x=>x!==m):[...s.profile.supermarkets,m],mainSupermarket:s.profile.mainSupermarket||m}}));
 return <div className="onboarding"><div className="onboarding-card">
  <div className="onboarding-progress"><span style={{width:`${((step+1)/6)*100}%`}}/></div>
  {step===0&&<div className="ob-panel"><span className="eyebrow">PRIMERA CONFIGURACIÓN</span><h1>¿Cuántas personas viven en casa?</h1><p>HomeOS adapta cantidades y nivel de incertidumbre al tamaño del hogar.</p><div className="number-grid">{[1,2,3,4,5,6].map(n=><button key={n} className={state.profile.householdSize===n?"choice active":"choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,householdSize:n},members:ensureMembers(s.members,n)}))}>{n}</button>)}</div></div>}
  {step===1&&<div className="ob-panel"><span className="eyebrow">RITMO DE COMPRA</span><h1>¿Cómo soléis comprar?</h1><div className="goal-grid">{[["diaria","Casi cada día"],["semanal","Compra semanal"],["quincenal","Cada dos semanas"],["mensual","Compra grande mensual"],["mixta","Compra grande + compras rápidas"]].map(([id,label])=><button key={id} className={state.profile.shoppingCycle===id?"goal-choice active":"goal-choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,shoppingCycle:id as Profile["shoppingCycle"]}}))}><strong>{label}</strong></button>)}</div></div>}
  {step===2&&<div className="ob-panel"><span className="eyebrow">COCINA</span><h1>¿Cómo quieres cocinar normalmente?</h1><div className="goal-grid">{[["rapido","Voy con prisas","Ideas de 5–20 min."],["normal","Cocino normal","Equilibrio entre tiempo y variedad."],["cocinar","Me gusta cocinar","Recetas más completas."],["mealprep","Preparo varios días","Raciones, nevera y congelador."]].map(([id,label,desc])=><button key={id} className={state.profile.cooking===id?"goal-choice active":"goal-choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,cooking:id as CookingStyle}}))}><strong>{label}</strong><span>{desc}</span></button>)}</div></div>}
  {step===3&&<div className="ob-panel"><span className="eyebrow">NUTRICIÓN</span><h1>¿Cuánta información quieres ver?</h1><div className="goal-grid">{[["off","Solo cocina e inventario","Sin gráficos nutricionales."],["basica","Hábitos sencillos","Tendencias semanales sin contar cada caloría."],["detallada","Nutrición detallada","Calorías y macros en recetas y análisis."]].map(([id,label,desc])=><button key={id} className={state.profile.nutrition===id?"goal-choice active":"goal-choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,nutrition:id as NutritionMode}}))}><strong>{label}</strong><span>{desc}</span></button>)}</div></div>}
  {step===4&&<div className="ob-panel"><span className="eyebrow">PRIORIDADES</span><h1>¿Qué quieres mejorar?</h1><p>Puedes marcar varias.</p><div className="market-grid">{[["organizar","Organizar la cocina"],["ahorrar","Ahorrar"],["desperdicio","Desperdiciar menos"],["equilibrio","Comer más equilibrado"]].map(([id,label])=><button key={id} className={state.profile.goals.includes(id as Goal)?"choice active":"choice"} onClick={()=>toggleGoal(id as Goal)}>{label}</button>)}</div></div>}
  {step===5&&<div className="ob-panel"><span className="eyebrow">TIENDAS</span><h1>¿Dónde compráis?</h1><p>Puedes cambiarlo después. También admitimos carnicerías y tiendas de barrio.</p><div className="market-grid">{SUPERMARKETS.map(m=><button key={m} className={state.profile.supermarkets.includes(m)?"choice active":"choice"} onClick={()=>toggleMarket(m)}>{m}</button>)}</div></div>}
  <div className="ob-actions"><button className="secondary" disabled={step===0} onClick={()=>setStep(x=>Math.max(0,x-1))}>Atrás</button>{step<5?<button className="primary" onClick={()=>setStep(x=>x+1)}>Continuar</button>:<button className="primary" disabled={state.profile.supermarkets.length===0} onClick={()=>setState(s=>({...s,profile:{...s.profile,onboardingDone:true}}))}>Entrar en HomeOS</button>}</div>
  <div className="existing-home">{!joinOpen?<button className="join-link" onClick={()=>setJoinOpen(true)}>Ya tengo HomeOS en otro dispositivo</button>:<div className="join-box"><div><strong>Conectar con mi hogar</strong><small>Pega el código que aparece en HomeOS del otro dispositivo.</small></div><input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="HOS1.…"/><button className="primary" disabled={!joinCode.trim()||syncStatus==="connecting"} onClick={joinExisting}>{syncStatus==="connecting"?"Conectando…":"Conectar"}</button>{joinError&&<span className="form-error">{joinError}</span>}<button className="join-cancel" onClick={()=>{setJoinOpen(false);setJoinError("")}}>Cancelar</button></div>}</div>
 </div></div>
}

function Inicio({state,setState,expiring,confidence,available,setView,setCasaFocus}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;expiring:InventoryItem[];confidence:number;available:number;setView:(v:View)=>void;setCasaFocus:(v:"all"|"expiring"|"prepared")=>void}){
 const todayIso=new Date().toISOString().slice(0,10);
 const next=state.events.filter(e=>e.date>=todayIso).slice().sort((a,b)=>a.date.localeCompare(b.date))[0];
 const recommended=state.shopping.filter(i=>i.reason==="recomienda"&&i.status==="pendiente").length;
 const pending=state.shopping.filter(i=>i.status==="pendiente").length;
 const known=state.inventory.filter(i=>i.stock!=="incierto").length;
 const review=state.inventory.length-known;
 const readyServings=state.inventory.filter(i=>i.category==="Preparados"&&i.stock!=="falta").reduce((n,i)=>n+(i.servings||i.qty||0),0);
 const nextDate=next?new Date(next.date+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"}):"—";
 const peopleAtHome=state.members.slice(0,state.profile.householdSize).filter(m=>m.presence==="casa").length;
 return <section className="stack">
  <div className="dashboard-hero"><div><span className="eyebrow">HOY EN CASA</span><h2>{state.profile.householdSize===1?"Tu casa, sin tener que recordarlo todo":"Lo importante de casa, de un vistazo"}</h2><p>{pending?String(pending)+" productos pendientes de compra.":"La lista de compra está al día."} {recommended?String(recommended)+" son sugerencias de reposición de HomeOS.":""}</p></div><div className="inventory-trust"><span>ESTADO DEL INVENTARIO</span><strong>{known} productos con estado conocido</strong><small>{review?String(review)+" necesitan revisión":"Nada pendiente de revisar"}</small></div></div>

  <div className="household-context">
   <div><small>PERFIL DEL HOGAR</small><strong>{state.profile.householdSize===1?"Perfil personal":String(peopleAtHome)+" comen habitualmente en casa"}</strong><span>{state.profile.householdSize===1?"Tus gustos y rutina ajustan las sugerencias.":state.members.slice(0,state.profile.householdSize).filter(m=>m.presence==="fuera_dia").length+" fuera durante el día · "+state.members.slice(0,state.profile.householdSize).filter(m=>m.appetite==="mucho").length+" con consumo alto"}</span></div>
   <button onClick={()=>document.querySelector<HTMLButtonElement>(".avatar")?.click()}>Configurar hogar</button>
  </div>

  <div className="hero-grid home-primary-actions">
   <button className="decision-card photo-card" onClick={()=>setView("comer")}><img src={RECIPES[0].image} alt="Idea para comer" decoding="async"/><div className="photo-overlay"><small>¿QUÉ COMEMOS HOY?</small><h2>Ideas con lo que ya tienes</h2><p>Varias opciones según tiempo, inventario y gustos.</p><span className="card-cta">Ver ideas →</span></div></button>
   <button className="decision-card shopping-decision" onClick={()=>setView("comprar")}><span className="decision-icon">🛒</span><div><small>LISTA DE COMPRA</small><h2>{pending?String(pending)+" pendientes":"Todo al día"}</h2><p>{pending?"Entra, marca lo que coges y termina la compra.":"Añade algo cuando lo necesites."}</p><span className="card-cta">Abrir lista →</span></div></button>
  </div>

  <div className="home-status-grid">
   <button className="status-card expiry-card" onClick={()=>{setCasaFocus("expiring");setView("casa")}}><span>⏳</span><div><small>CADUCA PRONTO</small><strong>{expiring.length}</strong><p>{expiring[0]?.name||"Nada urgente"}</p></div><b>›</b></button>
   <button className="status-card budget-card" onClick={()=>setView("finanzas")}><span>€</span><div><small>TE QUEDA ESTE MES</small><strong>{Math.max(0,available).toFixed(0)} €</strong><p>de {state.budget.toFixed(0)} € de presupuesto</p></div><b>›</b></button>
   <button className="status-card prepared-card" onClick={()=>{setCasaFocus("prepared");setView("casa")}}><span>🍱</span><div><small>COMIDA PREPARADA</small><strong>{readyServings}</strong><p>raciones listas</p></div><b>›</b></button>
   <button className="status-card event-card" onClick={()=>document.querySelector(".apple-calendar")?.scrollIntoView({behavior:"smooth",block:"center"})}><span>📅</span><div><small>PRÓXIMO EVENTO</small><strong>{nextDate}</strong><p>{next?.title||"Sin eventos"}</p></div><b>›</b></button>
  </div>

  {state.profile.nutrition!=="off"&&<article className="home-habits-card simplified-habits"><div className="home-habits-head"><div><small>CÓMO COME EL HOGAR · APRENDIENDO</small><h3>Qué señales conoce HomeOS</h3></div><button onClick={()=>setView("comer")}>Ver detalle</button></div><div className="habit-signal-chips">{habitSignals(state).map(([label,seen])=><span className={seen?"known":""} key={label}><b>{seen?"✓":"·"}</b>{label}</span>)}</div><p>No confundimos compras con consumo: esta parte gana precisión con recetas preparadas, correcciones y reposiciones reales.</p></article>}

  <CalendarCard state={state} setState={setState}/>
 </section>
}

function CalendarCard({state,setState}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>}){
 const today=new Date();
 const [cursor,setCursor]=useState(()=>new Date(today.getFullYear(),today.getMonth(),1));
 const [selectedDate,setSelectedDate]=useState("");
 const [selectedEventId,setSelectedEventId]=useState("");
 const [title,setTitle]=useState("");
 const year=cursor.getFullYear(),month=cursor.getMonth();
 const days=new Date(year,month+1,0).getDate();
 const blank=(new Date(year,month,1).getDay()+6)%7;
 const todayIso=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
 const monthLabel=new Intl.DateTimeFormat("es-ES",{month:"long",year:"numeric"}).format(cursor);
 const add=()=>{if(!title.trim()||!selectedDate)return;setState(s=>({...s,events:[...s.events,{id:crypto.randomUUID(),title:title.trim(),date:selectedDate}]}));setTitle("")};
 const move=(delta:number)=>setCursor(new Date(year,month+delta,1));
 const goToday=()=>{setCursor(new Date(today.getFullYear(),today.getMonth(),1));setSelectedDate(todayIso)};
 const selectedEvents=selectedDate?state.events.filter(e=>e.date===selectedDate):[];
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{
   const target=e.target as HTMLElement|null;
   if(target&&(["INPUT","TEXTAREA","SELECT"].includes(target.tagName)||target.isContentEditable)) return;
   if(e.key!=="Delete"&&e.key!=="Backspace") return;
   const onlyEvent=!selectedEventId&&selectedEvents.length===1?selectedEvents[0].id:"";
   const id=selectedEventId||onlyEvent;
   if(!id)return;
   e.preventDefault();
   setState(s=>({...s,events:s.events.filter(ev=>ev.id!==id)}));
   setSelectedEventId("");
  };
  window.addEventListener("keydown",onKey);
  return()=>window.removeEventListener("keydown",onKey);
 },[selectedEventId,selectedDate,state.events]);
 return <article className="calendar-card apple-calendar">
   <div className="apple-calendar-top">
    <div>
      <small>CALENDARIO DEL HOGAR</small>
      <div className="apple-month-row">
        <h3>{monthLabel}</h3>
        <div className="apple-calendar-controls">
          <button onClick={()=>move(-1)} aria-label="Mes anterior">‹</button>
          <button onClick={goToday}>Hoy</button>
          <button onClick={()=>move(1)} aria-label="Mes siguiente">›</button>
        </div>
      </div>
    </div>
    <div className="apple-calendar-legend"><span className="legend-dot today-dot"/>Hoy <span className="legend-dot event-dot"/>Evento</div>
   </div>

   <div className="apple-calendar-body">
    <div className="apple-calendar-main">
      <div className="calendar-week apple-week">{["L","M","X","J","V","S","D"].map(x=><b key={x}>{x}</b>)}</div>
      <div className="calendar-grid apple-grid">
       {Array.from({length:blank}).map((_,i)=><span className="calendar-blank" key={"b"+i}/>)}
       {Array.from({length:days}).map((_,i)=>{
        const d=i+1;
        const iso=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        const events=state.events.filter(e=>e.date===iso);
        const cls=["apple-day",events.length?"has-event":"",iso===todayIso?"today":"",iso===selectedDate?"selected":""].filter(Boolean).join(" ");
        return <button className={cls} key={d} onClick={()=>{setSelectedDate(iso);setSelectedEventId("")}}>
          <span className="day-number">{d}</span>
          {events.length>0&&<div className="day-events">{events.slice(0,2).map(ev=><span key={ev.id}>{ev.title}</span>)}</div>}
        </button>
       })}
      </div>
    </div>

    <aside className={selectedDate?"apple-event-panel open":"apple-event-panel"}>
      {selectedDate?<><div className="event-panel-date"><small>FECHA SELECCIONADA</small><strong>{new Date(selectedDate+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</strong></div>
      {selectedEvents.length>0&&<div className="event-existing">{selectedEvents.map(ev=><div className={selectedEventId===ev.id?"event-row selected":"event-row"} key={ev.id} onClick={()=>setSelectedEventId(ev.id)}><span className="event-color-dot"/><b>{ev.title}</b><button className="event-delete" onClick={(e)=>{e.stopPropagation();setState(s=>({...s,events:s.events.filter(x=>x.id!==ev.id)}));setSelectedEventId("")}}>Eliminar</button></div>)}<small className="keyboard-hint">Selecciona un evento y pulsa Supr/Delete para eliminarlo.</small></div>}
      <div className="event-compose"><label>Nuevo evento</label><input value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Ej. comida familiar"/><button onClick={add}>Añadir evento</button></div></>:<div className="event-empty"><span>＋</span><strong>Selecciona un día</strong><p>Haz clic en cualquier fecha para añadir o ver eventos.</p></div>}
    </aside>
   </div>
  </article>
}

function Comer({state,setState,addFromRecipe}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;addFromRecipe:(r:Recipe)=>void}){
 const [mode,setMode]=useState<CookingStyle>(state.profile.cooking);
 const [tab,setTab]=useState<"ideas"|"habitos">("ideas");
 const [index,setIndex]=useState(0);
 const [open,setOpen]=useState(false);
 const [useMuch,setUseMuch]=useState("");
 const [craving,setCraving]=useState("");
 const [selectedRecipeId,setSelectedRecipeId]=useState<string|null>(null);
 const options=RECIPES.filter(r=>r.mode.includes(mode)).sort((a,b)=>score(b,state.inventory)-score(a,state.inventory));
 const pool=options.length?options:RECIPES;
 const autoRecipe=pool[index%pool.length];
 const recipe=(selectedRecipeId?RECIPES.find(r=>r.id===selectedRecipeId):undefined)||autoRecipe;
 const miss=missing(recipe,state.inventory);
 const filtered=useMuch?RECIPES.filter(r=>r.ingredients.some(i=>norm(i.name).includes(norm(useMuch))||norm(i.key).includes(norm(useMuch)))||norm(r.title).includes(norm(useMuch))):[];
 const cravingWords=norm(craving).split(/\s+/).filter(w=>w.length>2);
 const cravingMatches=cravingWords.length?RECIPES.map(r=>{
  const hay=norm([r.title,r.description,...r.ingredients.map(i=>i.name)].join(" "));
  const hits=cravingWords.filter(w=>hay.includes(w)).length;
  return {r,hits,fit:score(r,state.inventory)};
 }).filter(x=>x.hits>0).sort((a,b)=>b.hits-a.hits||b.fit-a.fit).map(x=>x.r):[];
 const suggestions=(craving.trim()?cravingMatches:pool).slice(0,4);
 const availableTools=(recipe.tools||[]).filter(t=>state.profile.kitchenTools.includes(t));
 const dislikers=state.members.slice(0,state.profile.householdSize).map(member=>{
  const dislikes=member.dislikes.split(/[,;\n]/).map(x=>norm(x.trim())).filter(Boolean);
  const matches=recipe.ingredients.filter(i=>dislikes.some(d=>norm(i.name).includes(d)||d.includes(norm(i.key))||norm(i.key).includes(d))).map(i=>i.name);
  return {name:member.name,matches};
 }).filter(x=>x.matches.length);

 function chooseRecipe(r:Recipe){
  setSelectedRecipeId(r.id);
  setMode(r.mode.includes(mode)?mode:r.mode[0]);
  setIndex(0);
 }
 function completeRecipe(){
  const usedKeys=recipe.ingredients.map(x=>norm(x.key));
  setState(s=>({...s,inventory:s.inventory.map(i=>{
   const itemName=norm(i.name);
   const match=usedKeys.some(k=>itemName.includes(k)||k.includes(itemName.split(" ")[0]));
   if(!match||i.stock==="falta") return i;
   return {...i,stock:i.stock==="poco"?"falta":"poco"};
  })}));
  setOpen(false);
 }

 return <section className="stack">
  <div className="page-intro"><div><span className="eyebrow">COMER</span><h2>Qué te apetece y qué puedes hacer con lo que hay</h2><p>HomeOS prioriza recetas que encajan con tu inventario, tu tiempo y las preferencias del hogar.</p></div><div className="view-tabs eat-tabs"><button className={tab==="ideas"?"active":""} onClick={()=>setTab("ideas")}>Ideas para comer</button>{state.profile.nutrition!=="off"&&<button className={tab==="habitos"?"active":""} onClick={()=>setTab("habitos")}>Cómo comemos</button>}</div></div>

  {tab==="ideas"?<>
   <article className="meal-request">
    <div><small>¿QUÉ TE APETECE?</small><h3>Busca una idea concreta</h3><p>Prueba con “pollo con tomate”, “pasta”, “algo rápido” o un ingrediente que quieras gastar.</p></div>
    <input value={craving} onChange={e=>setCraving(e.target.value)} placeholder="Ej. pollo con tomate, carbonara, algo con leche…"/>
    {craving.trim()&&<div className="meal-request-results">{cravingMatches.length?cravingMatches.slice(0,4).map(r=><button key={r.id} onClick={()=>{chooseRecipe(r);setCraving("")}}><span>{productIcon(r.ingredients[0]?.name||r.title,inferCategory(r.ingredients[0]?.name||""))}</span><div><strong>{r.title}</strong><small>{missing(r,state.inventory).length?String(missing(r,state.inventory).length)+" ingredientes por completar":"Puedes hacerlo con lo que tienes"}</small></div><b>›</b></button>):<div className="recipe-empty">No hay una coincidencia exacta en las recetas disponibles. Puedes usar “Aprovechar producto” o elegir una de las ideas de abajo.</div>}</div>}
   </article>

   <div className="mode-row meal-modes">{[["rapido","⚡ Rápido"],["normal","🍽 Normal"],["cocinar","👨‍🍳 Cocinar"],["mealprep","🍱 Meal prep"]].map(([id,label])=><button key={id} className={mode===id?"active":""} onClick={()=>{setMode(id as CookingStyle);setIndex(0);setSelectedRecipeId(null)}}>{label}</button>)}</div>

   <div className="recipe-options-head"><div><small>CON LO QUE TIENES</small><h3>{mode==="mealprep"?"Opciones para preparar varias raciones":"Varias opciones, no solo una"}</h3></div><span>{pool.length} ideas disponibles</span></div>
   <div className="recipe-option-grid">{suggestions.map(r=>{const rm=missing(r,state.inventory);return <button className={recipe.id===r.id?"recipe-option selected":"recipe-option"} key={r.id} onClick={()=>chooseRecipe(r)}><img src={r.image} alt="" loading="lazy" decoding="async"/><div><strong>{r.title}</strong><span>{r.time} min · {r.servings} raciones</span><small className={rm.length?"needs":"ready"}>{rm.length?String(rm.length)+" por completar":"✓ Puedes hacerlo"}</small></div></button>})}</div>

   <article className="featured-meal"><img src={recipe.image} alt={recipe.title} loading="lazy" decoding="async"/><div className="featured-copy"><span className="eyebrow">{miss.length?String(miss.length)+" INGREDIENTES POR COMPLETAR":"PUEDES HACERLO YA"}</span><h3>{recipe.title}</h3><p>{recipe.description}</p><div className="chips"><span>{recipe.time} min</span><span>{recipe.difficulty}</span><span>{recipe.servings} raciones</span></div>{availableTools.length>0&&<div className="recipe-tools"><small>PUEDES HACERLA CON</small>{availableTools.map(t=><span key={t}>{t}</span>)}</div>}<div className="macro-row"><b>{recipe.calories} kcal</b><span>{recipe.protein}g proteína</span><span>{recipe.carbs}g carbos</span><span>{recipe.fat}g grasas</span><small>por ración · estimación</small></div>
    {dislikers.length>0&&<div className="family-warning">{dislikers.map((d,i)=><span key={d.name}>⚠ {d.name==="Tú"?"Has marcado que no te gusta":("A "+d.name+" no le gusta")} {d.matches.join(", ")}{i<dislikers.length-1?".":""}</span>)}</div>}
    <div className="meal-actions"><button className="primary" onClick={()=>setOpen(true)}>Preparar esta receta</button><button className="secondary" onClick={()=>{setSelectedRecipeId(null);setIndex(i=>i+1)}}>Siguiente idea</button></div></div></article>

   <div className="ingredient-summary clearer"><article><small>YA TIENES EN CASA</small><strong>{recipe.ingredients.length-miss.length} de {recipe.ingredients.length}</strong>{recipe.ingredients.filter(i=>!miss.some(m=>m.name===i.name)).map(i=><span key={i.name}>✓ {i.name}</span>)}</article><article><small>NECESITAS PARA COMPLETARLA</small><strong>{miss.length?String(miss.length)+" ingredientes":"Nada"}</strong>{miss.length?miss.map(i=><span key={i.name}>• {i.name}</span>):<span>✓ Está todo listo</span>}<button onClick={()=>addFromRecipe(recipe)} disabled={!miss.length}>Añadir lo que falta a compra</button></article></div>

   <article className="use-more-card"><div><small>APROVECHAR PRODUCTO</small><h3>¿Qué quieres gastar antes?</h3><p>Escribe un producto que tengas de sobra y te mostramos recetas donde realmente se usa.</p></div><input value={useMuch} onChange={e=>setUseMuch(e.target.value)} placeholder="Ej. leche, tomates, huevos…"/>{useMuch&&<div className="recipe-mini-list">{filtered.length?filtered.slice(0,4).map(r=><button key={r.id} onClick={()=>{chooseRecipe(r);setUseMuch("")}}><strong>{r.title}</strong><span>{r.time} min · {missing(r,state.inventory).length?String(missing(r,state.inventory).length)+" por completar":"puedes hacerlo ya"}</span></button>):<div className="recipe-empty">No hay una receta preparada con ese ingrediente todavía.</div>}</div>}</article>
  </>:<Habitos state={state}/>}

  {open&&<div className="modal-backdrop"><div className="modal recipe-modal"><div className="modal-head"><div><span className="eyebrow">PREPARAR</span><h2>{recipe.title}</h2>{availableTools.length>0&&<small className="modal-tool-note">Compatible con {availableTools.join(" · ")}</small>}</div><button onClick={()=>setOpen(false)}>×</button></div><div className="recipe-cols"><div><h4>Ingredientes</h4>{recipe.ingredients.map(i=><p key={i.name}>{i.qty} · {i.name}</p>)}</div><div><h4>Pasos</h4>{recipe.steps.map((s,i)=><p key={s}><b>{i+1}.</b> {s}</p>)}</div></div><div className="recipe-total"><span>Total receta</span><b>≈ {recipe.calories*recipe.servings} kcal · {recipe.protein*recipe.servings}g proteína</b></div><button className="primary modal-save" onClick={completeRecipe}>He terminado</button></div></div>}
 </section>
}

function Habitos({state}:{state:AppState}){
 const now=new Date();
 const dayMs=86400000;
 const daysAgo=(date:string)=>Math.floor((now.getTime()-new Date(date+"T12:00:00").getTime())/dayMs);
 const historical=state.purchaseHistory.filter(x=>daysAgo(x.date)>=0&&daysAgo(x.date)<=28);
 const provisional=state.inventory.filter(i=>i.purchasedAt&&daysAgo(i.purchasedAt)>=0&&daysAgo(i.purchasedAt)<=28).map(i=>({id:i.id,name:i.name,qty:i.qty,unit:i.unit,category:i.category,date:i.purchasedAt,supermarket:i.supermarket,requestedBy:"Casa"} as PurchaseRecord));
 const source=historical.length?historical:provisional;
 const sourceMode=historical.length?"Historial de compras":"Inventario reciente";
 const food=source.filter(x=>x.category!=="Limpieza y hogar");
 const recent=food.filter(x=>daysAgo(x.date)<=14);
 const previous=food.filter(x=>daysAgo(x.date)>14&&daysAgo(x.date)<=28);

 const isFruit=(n:string)=>/platano|banana|manzana|pera|naranja|mandarina|fresa|arandano|kiwi|uva|melon|sandia|melocoton|piña|mango|fruta/.test(norm(n));
 const isVeg=(n:string)=>/tomate|lechuga|brocoli|calabacin|berenjena|zanahoria|cebolla|pimiento|espinaca|pepino|verdura|aguacate|judia verde|coliflor/.test(norm(n));
 const isProtein=(n:string,c:string)=>c==="Carne"||/pollo|carne|ternera|cerdo|pavo|pescado|salmon|atun|huevo|legumbre|lenteja|garbanzo|proteina|tofu/.test(norm(n));
 const isCarb=(n:string)=>/arroz|pasta|pan|patata|avena|cereal|harina|tortilla|cuscus|quinoa/.test(norm(n));
 const isSnack=(n:string)=>/chocolate|galleta|chuche|gominola|snack|patatas fritas|bolleria|refresco|helado|caramelo/.test(norm(n));
 const defs=[
  {key:"protein",name:"Proteína",icon:"🥩",test:(x:PurchaseRecord)=>isProtein(x.name,x.category),min:.18,max:.5},
  {key:"veg",name:"Verduras",icon:"🥬",test:(x:PurchaseRecord)=>isVeg(x.name),min:.12,max:.45},
  {key:"fruit",name:"Fruta",icon:"🍎",test:(x:PurchaseRecord)=>isFruit(x.name),min:.08,max:.35},
  {key:"carb",name:"Carbohidratos base",icon:"🍚",test:(x:PurchaseRecord)=>isCarb(x.name),min:.12,max:.45},
  {key:"snack",name:"Dulces / snacks",icon:"🍫",test:(x:PurchaseRecord)=>isSnack(x.name),min:0,max:.18}
 ];
 const total=Math.max(1,food.length);
 const groups=defs.map(d=>{
  const count=food.filter(d.test).length;
  const share=count/total;
  const r=recent.filter(d.test).length;
  const p=previous.filter(d.test).length;
  let trend:"up"|"down"|"flat"|"new"="flat";
  if(p===0&&r>0)trend="new";
  else if(p>0&&r>=p*1.35)trend="up";
  else if(p>0&&r<=p*.65)trend="down";
  let status="En rango";
  let tone="good";
  if(food.length<8){status="Aprendiendo";tone="learn"}
  else if(d.key==="snack"){
   if(share>d.max){status="Muy presente";tone="warn"}
   else if(share>d.max*.7){status="Presencia media";tone="mid"}
   else{status="Presencia baja";tone="good"}
  }else{
   if(share<d.min*.65){status="Poco presente";tone="warn"}
   else if(share<d.min){status="Algo bajo";tone="mid"}
   else if(share>d.max){status="Muy presente";tone="mid"}
   else{status="Bien presente";tone="good"}
  }
  return {...d,count,share,trend,status,tone};
 });

 const important=groups.filter(g=>g.key!=="snack");
 const gaps=important.filter(g=>g.tone==="warn");
 const snack=groups.find(g=>g.key==="snack")!;
 let orientation="Aún estamos aprendiendo";
 let orientationText="Necesitamos varias compras reales para ver una tendencia fiable.";
 let orientationTone="learn";
 if(food.length>=8){
  if(gaps.length===0&&snack.tone!=="warn"){
   orientation="Cesta bastante equilibrada";
   orientationText="Hay presencia razonable de los principales grupos y los snacks no dominan la compra.";
   orientationTone="good";
  }else if(gaps.length){
   orientation="Hay grupos que conviene reforzar";
   orientationText="La compra reciente muestra poca presencia de "+gaps.map(g=>g.name.toLowerCase()).join(" y ")+".";
   orientationTone="warn";
  }else if(snack.tone==="warn"){
   orientation="Demasiado peso de snacks";
   orientationText="Los dulces y snacks aparecen con mucha frecuencia respecto al resto de la cesta.";
   orientationTone="warn";
  }
 }
 const dataQuality=Math.min(100,Math.round(Math.min(1,food.length/24)*85+Math.min(15,state.inventory.filter(i=>i.stock!=="incierto").length/Math.max(1,state.inventory.length)*15)));
 const trendLabel=(g:typeof groups[number])=>g.trend==="up"?"↑ sube":g.trend==="down"?"↓ baja":g.trend==="new"?"↑ aparece":"→ estable";
 const insightCandidates=[
  ...groups.filter(g=>g.tone==="warn").map(g=>g.key==="snack"?"Los snacks tienen más peso del habitual en la cesta.":g.name+" aparece poco en las compras recientes."),
  ...groups.filter(g=>g.tone==="good"&&g.key!=="snack").slice(0,2).map(g=>g.name+" está bien representada en la compra.")
 ].slice(0,3);

 return <div className="habits-dashboard">
  <article className={"habit-orientation "+orientationTone}>
   <div><small>ORIENTACIÓN DEL HOGAR · ÚLTIMOS 28 DÍAS</small><h3>{orientation}</h3><p>{orientationText}</p></div>
   <div className="habit-confidence"><span>Calidad de lectura</span><strong>{dataQuality}%</strong><small>{food.length} líneas de compra analizadas · {sourceMode}</small></div>
  </article>

  <article className="habit-source-note">
   <span>ⓘ</span><p><b>Esto analiza lo que entra en casa, no afirma exactamente lo que se ha comido.</b> HomeOS usa compras como señal principal y mejora cuando también registra recetas preparadas, correcciones y reposiciones.</p>
  </article>

  <div className="habit-balance-grid">
   {groups.map(g=><article className={"habit-balance-card "+g.tone} key={g.key}>
    <div className="habit-balance-top"><span>{g.icon}</span><div><strong>{g.name}</strong><small>{g.status}</small></div><b>{trendLabel(g)}</b></div>
    <div className="habit-share-bar"><span style={{width:String(Math.min(100,Math.max(4,g.share*100)))+"%"}}/></div>
    <div className="habit-balance-foot"><span>{g.count} compras relacionadas</span><strong>{food.length?Math.round(g.share*100):0}% de líneas</strong></div>
   </article>)}
  </div>

  <div className="habit-bottom-grid">
   <article className="habit-insights">
    <div><small>QUÉ ESTÁ CAMBIANDO</small><h3>Lectura rápida</h3></div>
    {insightCandidates.length?<div className="habit-insight-list">{insightCandidates.map((x,i)=><p key={i}><span>{i+1}</span>{x}</p>)}</div>:<p className="habit-empty-copy">Todavía no hay suficiente historial para sacar conclusiones útiles.</p>}
   </article>
   <article className="habit-direction">
    <small>HACIA DÓNDE VA</small>
    <h3>{recent.length>=4?"Comparación de las últimas 2 semanas":"Aprendiendo tendencia"}</h3>
    <div>{groups.slice(0,4).map(g=><span key={g.key}><b>{g.icon} {g.name}</b><em className={g.trend}>{trendLabel(g)}</em></span>)}</div>
    <p>La tendencia compara las compras de los últimos 14 días con los 14 anteriores. No es una valoración médica.</p>
   </article>
  </div>
 </div>
}

function Comprar({state,setState,activeStore,setActiveStore,shoppingActive,setShoppingActive,finishShopping,receiptRef,setToast,deviceMemberId,setDeviceMemberId}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;activeStore:string;setActiveStore:(s:string)=>void;shoppingActive:boolean;setShoppingActive:(b:boolean)=>void;finishShopping:(total?:number)=>void;receiptRef:React.RefObject<HTMLInputElement|null>;setToast:(s:string)=>void;deviceMemberId:string;setDeviceMemberId:(id:string)=>void}){
 const [quick,setQuick]=useState("");
 const [storeFilter,setStoreFilter]=useState("Todos");
 const [purchaseTotal,setPurchaseTotal]=useState("");
 const [receiptName,setReceiptName]=useState("");
 const receiptCameraRef=useRef<HTMLInputElement>(null);
 const members=state.members.slice(0,state.profile.householdSize);
 const currentMember=members.find(m=>m.id===deviceMemberId)||members[0];
 const requestedBy=currentMember?.name||"Tú";
 const estimatedTotal=state.shopping.filter(i=>i.status==="carrito").reduce((sum,item)=>{
  const known=state.inventory.find(x=>norm(x.name)===norm(item.name)&&typeof x.price==="number");
  return sum+(known?.price||0);
 },0);

 function add(){
  let value=quick.trim();if(!value)return;
  let supermarket:string|undefined;
  const lower=norm(value);
  for(const s of state.profile.supermarkets){
   if(s!=="Otro supermercado"&&lower.includes(norm(s))){
    supermarket=s;value=value.replace(new RegExp(s,"i"),"").trim();break;
   }
  }
  let qty=1,unit=inferUnit(value);
  const m=value.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|uds?|unidades?|rollos?|packs?|paquetes?|bricks?)/i);
  if(m){
   qty=Number(m[1].replace(",","."))||1;
   const raw=m[2].toLowerCase();
   unit=raw==="l"?"L":raw.startsWith("ud")||raw.startsWith("unidad")?"uds":raw.startsWith("rollo")?"rollos":raw.startsWith("brick")?"bricks":raw.startsWith("pack")||raw.startsWith("paquete")?"pack":raw;
   value=value.replace(m[0]," ").replace(/\s+/g," ").trim();
  }
  const category=inferCategory(value);
  const name=(value||quick.trim()).replace(/^de\s+/i,"").trim();
  setState(s=>{
   const duplicate=s.shopping.find(i=>norm(i.name)===norm(name)&&i.supermarket===supermarket&&i.status==="pendiente");
   if(duplicate)return {...s,shopping:s.shopping.map(i=>i.id===duplicate.id?{...i,qty:i.qty+qty}:i)};
   return {...s,shopping:[...s.shopping,{id:crypto.randomUUID(),name:name.charAt(0).toUpperCase()+name.slice(1),qty,unit,category,supermarket,requestedBy,reason:"persona",status:"pendiente"}]};
  });
  setQuick("");
 }
 function ticketSelected(file?:File){
  if(!file)return;
  setReceiptName(file.name||"Foto del ticket");
  setToast("Ticket seleccionado");
 }
 function moveHere(id:string){setState(s=>({...s,shopping:s.shopping.map(i=>i.id===id?{...i,supermarket:activeStore,status:"pendiente"}:i)}))}
 function cart(id:string){setState(s=>({...s,shopping:s.shopping.map(i=>i.id===id?{...i,status:i.status==="carrito"?"pendiente":"carrito"}:i)}))}
 const filteredList=state.shopping.filter(i=>storeFilter==="Todos"||i.supermarket===storeFilter||(!i.supermarket&&storeFilter==="Cualquiera"));
 const mainItems=shoppingActive&&activeStore?state.shopping.filter(i=>(!i.supermarket||i.supermarket===activeStore)):filteredList;
 const grouped=mainItems.reduce<Record<string,ShoppingItem[]>>((a,i)=>{(a[i.category]??=[]).push(i);return a},{});
 const other=shoppingActive&&activeStore?state.shopping.filter(i=>i.supermarket&&i.supermarket!==activeStore&&i.status==="pendiente"):[];
 return <section className="stack">
  <div className="shopping-top"><div><span className="eyebrow">LISTA DE COMPRA</span><h2>{shoppingActive?(activeStore?"Comprando en "+activeStore:"¿Dónde estás comprando?"):"Lo que falta en casa"}</h2><p>Añade productos y HomeOS los organiza por tienda y categoría.</p></div>{shoppingActive?<div className="shopping-session-actions"><button className="secondary" onClick={()=>{setState(s=>({...s,shopping:s.shopping.map(i=>i.status==="carrito"?{...i,status:"pendiente"}:i)}));setShoppingActive(false);setActiveStore("");setPurchaseTotal("");setReceiptName("")}}>Salir</button><button className="primary" disabled={!activeStore||(state.profile.financeMode==="preciso"&&!purchaseTotal.trim())} onClick={()=>{const n=Number(purchaseTotal.replace(",","."));const manual=purchaseTotal.trim()&&Number.isFinite(n)?n:undefined;const total=manual??(state.profile.financeMode==="orientativo"&&estimatedTotal>0?estimatedTotal:undefined);finishShopping(total);setPurchaseTotal("");setReceiptName("")}}>Terminar compra</button></div>:<button className="primary" onClick={()=>setShoppingActive(true)}>Empezar compra</button>}</div>

  {!shoppingActive?<div className="quick-add smart"><input value={quick} onChange={e=>setQuick(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Ej. 2 L de leche Lidl, tomates, 1 kg pollo…"/>{members.length>1?<label className="device-member-select"><span>Añade como</span><select value={currentMember?.id||""} onChange={e=>setDeviceMemberId(e.target.value)}>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>:<span className="device-member-pill">👤 {requestedBy}</span>}<button onClick={add}>Añadir</button></div>:<div className="store-picker"><span>Estoy en</span>{state.profile.supermarkets.map(s=><button key={s} className={activeStore===s?"active":""} onClick={()=>setActiveStore(s)}>{s}</button>)}</div>}

  {!shoppingActive&&<div className="store-tabs"><button className={storeFilter==="Todos"?"active":""} onClick={()=>setStoreFilter("Todos")}>Todos</button>{state.profile.supermarkets.map(s=><button className={storeFilter===s?"active":""} key={s} onClick={()=>setStoreFilter(s)}>{s}</button>)}<button className={storeFilter==="Cualquiera"?"active":""} onClick={()=>setStoreFilter("Cualquiera")}>Cualquiera</button></div>}
  {shoppingActive&&!activeStore&&<article className="empty-state"><h3>Elige la tienda</h3><p>La lista se reorganizará para que veas primero lo que puedes comprar ahí.</p></article>}

  {(!shoppingActive||activeStore)&&<div className="shopping-layout"><div className="category-list">{Object.keys(grouped).length===0&&<article className="friendly-empty"><span>✓</span><h3>Todo al día</h3><p>No hay productos en esta vista.</p></article>}{Object.entries(grouped).map(([cat,items])=><article className="list-card shopping-category" key={cat}><div className="list-title"><h3><span>{CATEGORY_ICONS[cat]||"🛍️"}</span>{CATEGORY_LABELS[cat]||cat}</h3><span>{items.length}</span></div><div className="shopping-card-grid">{items.map(i=><div className={i.status==="carrito"?"shop-visual-card checked":"shop-visual-card"} key={i.id}><button className="product-pictogram" onClick={()=>cart(i.id)} aria-label={i.status==="carrito"?"Quitar del carrito":"Añadir al carrito"}>{i.status==="carrito"?"✓":productIcon(i.name,i.category)}</button><div className="shop-visual-copy"><strong>{i.name}</strong><span>{i.qty} {i.unit}</span><small>{i.reason==="recomienda"?"HomeOS recomienda":i.reason==="receta"?"Para una receta":i.requestedBy}</small></div>{i.supermarket&&<em>{i.supermarket}</em>}</div>)}</div></article>)}</div>

   <aside className="purchase-tools">
    <div className="ticket-actions">
     <button className="tool-action ticket-camera" onClick={()=>receiptCameraRef.current?.click()}><span>📷</span><div><strong>Hacer foto del ticket</strong><p>Abre la cámara directamente.</p></div></button>
     <button className="tool-action" onClick={()=>receiptRef.current?.click()}><span>🧾</span><div><strong>Elegir ticket</strong><p>{receiptName?"Seleccionado: "+receiptName:"Foto o PDF desde el dispositivo."}</p></div></button>
    </div>
    <input ref={receiptCameraRef} hidden type="file" accept="image/*" capture="environment" onChange={e=>ticketSelected(e.target.files?.[0])}/>
    <input ref={receiptRef} hidden type="file" accept="image/*,.pdf" onChange={e=>ticketSelected(e.target.files?.[0])}/>
    {shoppingActive&&<label className="purchase-total"><span>Total de la compra <small>{state.profile.financeMode==="preciso"?"obligatorio en modo preciso":"opcional"}</small></span><div><input inputMode="decimal" value={purchaseTotal} onChange={e=>setPurchaseTotal(e.target.value)} placeholder={estimatedTotal>0?"≈ "+estimatedTotal.toFixed(2):"0,00"}/><b>€</b></div>{state.profile.financeMode==="orientativo"&&estimatedTotal>0&&<small>Si lo dejas vacío, HomeOS usará ≈ {estimatedTotal.toFixed(2)} € con los precios que ya conoce.</small>}</label>}
    <article className="tool-card"><span>✦</span><div><strong>Reposición sugerida</strong><p>{state.shopping.filter(i=>i.reason==="recomienda"&&i.status==="pendiente").length} productos marcados por posible falta.</p></div></article>
   </aside>
  </div>}

  {shoppingActive&&activeStore&&other.length>0&&<article className="other-stores"><div><small>PENDIENTE EN OTRAS TIENDAS</small><h3>También tenías esto apuntado</h3></div>{other.map(i=><div key={i.id}><span><strong>{i.name}</strong><small>{i.supermarket}</small></span><button onClick={()=>moveHere(i.id)}>Traer aquí</button></div>)}</article>}
 </section>
}

function Casa({state,setState,cameraRef,galleryRef,setToast,focus,clearFocus}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;cameraRef:React.RefObject<HTMLInputElement|null>;galleryRef:React.RefObject<HTMLInputElement|null>;setToast:(s:string)=>void;focus:"all"|"expiring"|"prepared";clearFocus:()=>void}){
 const [loc,setLoc]=useState("Todo"),[cat,setCat]=useState("Todos");
 const [density,setDensity]=useState<"compact"|"detail">("compact");
 const [preparedOpen,setPreparedOpen]=useState(false);
 const [preparedName,setPreparedName]=useState("");
 const [voiceDraft,setVoiceDraft]=useState("");
 const [voiceListening,setVoiceListening]=useState(false);
 const [preparedServings,setPreparedServings]=useState(1);
 const [preparedLocation,setPreparedLocation]=useState<"Nevera"|"Congelador">("Nevera");
 const [photoStatus,setPhotoStatus]=useState("");
 useEffect(()=>{if(focus!=="all"){setLoc("Todo");setCat(focus==="prepared"?"Preparados":"Todos")}},[focus]);
 const locationMatch=(i:InventoryItem)=>loc==="Todo"||(loc==="Despensa"?(i.location==="Despensa"||i.location==="Suplementos"):i.location===loc);
 const shown=state.inventory.filter(i=>locationMatch(i)&&(cat==="Todos"||i.category===cat)&&(focus==="expiring"?daysUntil(i.expires)<=3&&i.stock!=="falta":focus==="prepared"?i.category==="Preparados"&&i.stock!=="falta":true));

 function setStock(id:string,stock:StockState){setState(s=>({...s,inventory:s.inventory.map(i=>i.id===id?{...i,stock,qty:stock==="falta"?0:i.qty}:i)}))}
 function freeze(id:string){const frozenAt=new Date().toISOString().slice(0,10);setState(s=>({...s,inventory:s.inventory.map(i=>i.id===id?{...i,location:"Congelador",frozenAt,originalExpires:i.originalExpires||i.expires,expires:undefined,dateType:undefined}:i)}));setToast("Producto movido al congelador")}
 function addToBuy(i:InventoryItem){if(state.shopping.some(q=>norm(q.name)===norm(i.name)&&q.status==="pendiente")){setToast("Ya estaba en la lista de compra");return}setState(s=>({...s,shopping:[...s.shopping,{id:crypto.randomUUID(),name:i.name,qty:1,unit:i.unit,category:i.category,requestedBy:"Casa",reason:"recomienda",status:"pendiente"}]}));setToast("Añadido a la compra")}
 function parsePreparedVoice(text:string){
  const t=norm(text);
  const rMatch=t.match(/(\d+)\s*(raciones|tuppers|tuperes|tuppers?)/);
  const servings=rMatch?Math.max(1,Number(rMatch[1])):1;
  const location=t.includes("congela")?"Congelador":"Nevera";
  let name=text
    .replace(/he preparado/ig,"").replace(/han sobrado/ig,"").replace(/sobraron/ig,"")
    .replace(/guardo/ig,"").replace(/dejo/ig,"").replace(/congelo/ig,"")
    .replace(/\d+\s*(raciones|tuppers?|tuperes)/ig,"")
    .replace(/en la nevera/ig,"").replace(/en el congelador/ig,"").replace(/al congelador/ig,"").trim();
  if(!name) name="Comida preparada";
  setPreparedName(name.charAt(0).toUpperCase()+name.slice(1));
  setPreparedServings(servings);setPreparedLocation(location);
 }
 function startPreparedVoice(){
  const W=(window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if(!W){setToast("El reconocimiento de voz no está disponible en este navegador");return}
  const recognition=new W();
  recognition.lang="es-ES";recognition.interimResults=false;recognition.maxAlternatives=1;
  setVoiceListening(true);
  recognition.onresult=(e:any)=>{const text=e.results?.[0]?.[0]?.transcript||"";setVoiceDraft(text);parsePreparedVoice(text)};
  recognition.onerror=()=>setToast("No he podido entender la voz");
  recognition.onend=()=>setVoiceListening(false);
  recognition.start();
 }
 function savePrepared(){
  const name=preparedName.trim();if(!name)return;
  const preparedAt=new Date().toISOString().slice(0,10);
  const item:InventoryItem={id:crypto.randomUUID(),name,qty:preparedServings,unit:"raciones",location:preparedLocation,category:"Preparados",stock:"hay",purchasedAt:preparedAt,preparedAt,servings:preparedServings,source:"sobras"};
  setState(s=>({...s,inventory:[item,...s.inventory]}));
  setPreparedName("");setPreparedServings(1);setPreparedLocation("Nevera");setVoiceDraft("");setPreparedOpen(false);setToast("Preparado guardado");
 }

 return <section className="stack">
  <div className="page-intro"><div><span className="eyebrow">CASA</span><h2>Encuentra rápido lo que tienes</h2><p>Primero eliges dónde está; después, si quieres, filtras por tipo de producto.</p></div><div className="photo-actions"><button className="prepared-button" onClick={()=>setPreparedOpen(true)}>🍱 Añadir preparado</button><button className="secondary" onClick={()=>cameraRef.current?.click()}>📷 Revisar con foto</button><button className="secondary" onClick={()=>galleryRef.current?.click()}>🖼 Fototeca</button><input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files?.[0];if(f){setPhotoStatus(f.name||"Foto de cámara");setToast("Foto seleccionada")}}}/><input ref={galleryRef} hidden type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f){setPhotoStatus(f.name);setToast("Imagen seleccionada")}}}/>{photoStatus&&<span className="photo-status">Imagen lista: {photoStatus} · análisis automático pendiente</span>}</div></div>

  {focus!=="all"&&<div className={"inventory-focus "+focus}><div><span>{focus==="expiring"?"⏳":"🍱"}</span><div><small>VISTA RÁPIDA</small><strong>{focus==="expiring"?"Productos que caducan pronto":"Comida preparada"}</strong><p>{focus==="expiring"?"Solo mostramos productos con fecha próxima para que puedas decidir qué gastar primero.":"Solo mostramos raciones y preparados listos."}</p></div></div><button onClick={clearFocus}>Ver todo</button></div>}
  <div className="inventory-toolbar">
   <div className="inventory-filter-block"><small>DÓNDE ESTÁ</small><div className="visual-filter-row">{LOCATIONS.map(x=><button key={x} className={loc===x?"active":""} onClick={()=>setLoc(x)}><span>{LOCATION_ICONS[x]}</span><b>{x}</b></button>)}</div></div>
   <div className="inventory-filter-block"><small>QUÉ ES</small><div className="visual-filter-row categories">{CATEGORIES.map(x=><button key={x} className={cat===x?"active":""} onClick={()=>setCat(x)}><span>{CATEGORY_ICONS[x]||"🛍️"}</span><b>{CATEGORY_LABELS[x]||x}</b></button>)}</div></div>
   <div className="inventory-density"><small>VISTA</small><div><button className={density==="compact"?"active":""} onClick={()=>setDensity("compact")}>▦ Compacta</button><button className={density==="detail"?"active":""} onClick={()=>setDensity("detail")}>☰ Detalle</button></div></div>
  </div>

  <div className={"inventory-grid "+density}>{shown.length===0&&<article className="friendly-empty inventory-empty"><span>⌂</span><h3>No hay productos aquí</h3><p>Prueba otro filtro o registra una compra.</p></article>}{shown.map(i=>{
   const displayLocation=i.location==="Suplementos"?"Despensa":i.location;
   return <article className="inventory-card" key={i.id}>
    <div className="inventory-top"><span className="inventory-product-icon">{productIcon(i.name,i.category)}</span><span className={"stock-badge "+i.stock}>{statusLabel(i.stock)}</span></div>
    <div className="inventory-name-row"><h3>{i.name}</h3><span className="location-mini">{LOCATION_ICONS[displayLocation]||"▦"} {displayLocation}</span></div>
    <p className="inventory-qty">{i.stock==="incierto"?"Cantidad por revisar":String(i.qty)+" "+i.unit}</p>
    <div className="inventory-badges"><span className={"rotation-badge "+rotationBand(i.name,i.category,i.location).key}>{rotationBand(i.name,i.category,i.location).label.replace("Rotación ","")}</span>{i.expires&&<small className={i.dateType==="caducidad"?"date-alert expiry":"date-alert"}>{i.dateType==="caducidad"?"Caduca ":"Consumo pref. "}{new Date(i.expires+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</small>}{i.frozenAt&&<small className="date-alert">Congelado {new Date(i.frozenAt+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</small>}</div>
    {i.category==="Preparados"&&<div className="prepared-meta"><span>🍱 {i.source==="mealprep"?"Meal prep":i.source==="receta"?"Receta":"Sobras / tupper"}</span>{i.preparedAt&&<span>Hecho {new Date(i.preparedAt+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</span>}</div>}
    <div className="inventory-actions">{i.stock!=="falta"&&<button onClick={()=>setStock(i.id,"falta")}>Se acabó</button>}{i.stock!=="falta"&&<button onClick={()=>setStock(i.id,"poco")}>Queda poco</button>}{i.location==="Nevera"&&i.dateType==="caducidad"&&<button onClick={()=>freeze(i.id)}>Congelar</button>}{i.stock==="falta"&&<button onClick={()=>addToBuy(i)}>Comprar</button>}</div>
   </article>
  })}</div>

  {preparedOpen&&<div className="modal-backdrop" onMouseDown={()=>setPreparedOpen(false)}><div className="modal prepared-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">PREPARADOS</span><h2>Guardar comida ya hecha</h2><p>Sobras, tuppers y meal prep en un único sitio.</p></div><button onClick={()=>setPreparedOpen(false)}>×</button></div><div className="voice-prepared-box"><button className={voiceListening?"voice-main listening":"voice-main"} onClick={startPreparedVoice}>{voiceListening?"Escuchando…":"🎙 Añadir por voz"}</button><span>Ej.: “Han sobrado 3 raciones de pollo con arroz y van a la nevera”.</span>{voiceDraft&&<small>Entendido: “{voiceDraft}”</small>}</div><div className="prepared-divider"><span>o manualmente</span></div><div className="prepared-form"><label><span>¿Qué es?</span><input autoFocus value={preparedName} onChange={e=>setPreparedName(e.target.value)} placeholder="Ej. pollo con arroz, lentejas…"/></label><label><span>Raciones aproximadas</span><div className="stepper"><button onClick={()=>setPreparedServings(n=>Math.max(1,n-1))}>−</button><b>{preparedServings}</b><button onClick={()=>setPreparedServings(n=>n+1)}>+</button></div></label><label><span>¿Dónde lo guardas?</span><div className="storage-choice"><button className={preparedLocation==="Nevera"?"active":""} onClick={()=>setPreparedLocation("Nevera")}>❄️ Nevera</button><button className={preparedLocation==="Congelador"?"active":""} onClick={()=>setPreparedLocation("Congelador")}>🧊 Congelador</button></div></label><div className="prepared-note">HomeOS lo tratará como comida lista y la priorizará. No inventaremos una fecha de seguridad si no tenemos datos suficientes.</div></div><button className="primary modal-save" disabled={!preparedName.trim()} onClick={savePrepared}>Guardar preparado</button></div></div>}
 </section>
}

function Finanzas({state,setState,available}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;available:number}){
 const usedPct=Math.min(100,Math.round(state.spent/Math.max(1,state.budget)*100));
 const priced=state.inventory.filter(i=>typeof i.price==="number"&&(i.price||0)>0);
 function financeCategory(i:InventoryItem){
  if(i.location==="Congelador")return "Congelados";
  if(i.category==="Carne")return "Carne y pescado";
  if(i.category==="Fruta y verdura")return "Fruta y verdura";
  if(i.category==="Lácteos")return "Lácteos";
  if(i.category==="Limpieza y hogar")return "Limpieza y hogar";
  if(i.category==="Preparados")return "Preparados";
  if(i.category==="Suplementos")return "Suplementos";
  if(i.category==="Despensa")return "Despensa";
  return "Otros";
 }
 const byCat=priced.reduce<Record<string,number>>((a,i)=>{const k=financeCategory(i);a[k]=(a[k]||0)+(i.price||0);return a},{});
 const knownSpend=Object.values(byCat).reduce((a,b)=>a+b,0);
 const categoryOrder=["Carne y pescado","Fruta y verdura","Lácteos","Congelados","Despensa","Limpieza y hogar","Preparados","Suplementos","Otros"];
 const icons:Record<string,string>={"Carne y pescado":"🥩","Fruta y verdura":"🥬","Lácteos":"🥛","Congelados":"🧊","Despensa":"🥫","Limpieza y hogar":"🧴","Preparados":"🍱","Suplementos":"＋","Otros":"🛍️"};
 const rows=categoryOrder.filter(k=>(byCat[k]||0)>0).map(k=>({name:k,value:byCat[k]||0,icon:icons[k]}));
 const remaining=Math.max(0,available);
 const over=Math.max(0,-available);
 const modeText=state.profile.financeMode==="preciso"
  ?"Cada compra debe tener un total. Así el gasto mensual no depende de estimaciones."
  :"Si falta el total, HomeOS puede usar precios que ya conoce. Siempre se marca como aproximado.";

 return <section className="stack finance-page">
  <div className="page-intro finance-intro"><div><span className="eyebrow">FINANZAS DE CASA</span><h2>Cuánto has gastado y cuánto te queda</h2><p>El presupuesto es lo que quieres gastar este mes en alimentación y hogar. No lo llamamos ahorro: simplemente es dinero que todavía queda disponible.</p></div><div className="finance-mode-switch"><small>MODO DE CÁLCULO</small><div><button className={state.profile.financeMode==="orientativo"?"active":""} onClick={()=>setState(s=>({...s,profile:{...s.profile,financeMode:"orientativo"}}))}>≈ Orientativo</button><button className={state.profile.financeMode==="preciso"?"active":""} onClick={()=>setState(s=>({...s,profile:{...s.profile,financeMode:"preciso"}}))}>= Preciso</button></div><p>{modeText}</p></div></div>

  <article className="budget-overview">
   <div className="budget-head"><div><small>PRESUPUESTO DEL MES</small><strong>{state.budget.toFixed(0)} €</strong></div><label><span>Cambiar</span><div><input type="number" min="0" value={state.budget} onChange={e=>setState(s=>({...s,budget:Math.max(0,Number(e.target.value)||0)}))}/><b>€</b></div></label></div>
   <div className="budget-progress"><span style={{width:String(usedPct)+"%"}}/></div>
   <div className="budget-numbers">
    <div><small>GASTADO</small><strong>{state.spent.toFixed(2)} €</strong></div>
    <div className={available>=0?"remaining":"remaining over"}><small>{available>=0?"TE QUEDA":"TE HAS PASADO"}</small><strong>{available>=0?remaining.toFixed(2):over.toFixed(2)} €</strong></div>
    <div><small>PRESUPUESTO USADO</small><strong>{usedPct}%</strong></div>
   </div>
  </article>

  <div className="finance-secondary">
   <article className="waste-card"><span>♻️</span><div><small>DESPERDICIO REGISTRADO</small><strong>{state.waste.toFixed(2)} €</strong><p>Solo cuenta productos que realmente has marcado como tirados o caducados.</p></div></article>
   <article className="finance-data-card"><span>🧾</span><div><small>GASTO CON CATEGORÍA CONOCIDA</small><strong>{knownSpend.toFixed(2)} €</strong><p>De {state.spent.toFixed(2)} € gastados este mes. El resto aún no tiene detalle por producto.</p></div></article>
  </div>

  <article className="category-spend-card">
   <div className="category-spend-head"><div><small>EN QUÉ SE VA EL DINERO</small><h3>Gasto por categoría</h3><p>Cuando tengamos tickets detallados, aquí aparecerá el reparto exacto de cada compra.</p></div><strong>{knownSpend.toFixed(2)} € clasificados</strong></div>
   {rows.length?<div className="category-money-list">{rows.map((r,i)=>{const pct=knownSpend?Math.round(r.value/knownSpend*100):0;return <div className="money-row" key={r.name}><span className="money-icon">{r.icon}</span><div><div className="money-row-top"><b>{r.name}</b><strong>{r.value.toFixed(2)} €</strong></div><div className="money-bar"><span className={"bar-"+((i%6)+1)} style={{width:String(pct)+"%"}}/></div><small>{pct}% de lo clasificado</small></div></div>})}</div>:<div className="finance-empty"><span>🧾</span><strong>Todavía no hay productos con precio</strong><p>Cuando cierres compras con importes o se lean tickets, aparecerá el desglose.</p></div>}
  </article>

  <article className="finance-how">
   <div><small>QUÉ SIGNIFICA CADA DATO</small><h3>Un ejemplo sencillo</h3></div>
   <div className="finance-example"><span>Presupuesto <b>800 €</b></span><span>− Gastado <b>{state.spent.toFixed(2)} €</b></span><span>= Disponible <b>{available>=0?remaining.toFixed(2)+" €":"0 €"}</b></span></div>
   <p>El desperdicio se muestra aparte y no se resta otra vez del presupuesto porque ya forma parte de las compras realizadas.</p>
  </article>
 </section>
}

function ProfileModal({state,setState,close,syncCreds,syncStatus,connectHome,copyHomeCode,syncNow,deviceMemberId,setDeviceMemberId,setToast}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;close:()=>void;syncCreds:SyncCredentials|null;syncStatus:"local"|"connecting"|"synced"|"error";connectHome:(code:string)=>Promise<boolean>;copyHomeCode:()=>Promise<void>;syncNow:()=>Promise<void>;deviceMemberId:string;setDeviceMemberId:(id:string)=>void;setToast:(s:string)=>void}){
 const [draft,setDraft]=useState<AppState>(state);
 const [tab,setTab]=useState<"miembros"|"ajustes">("miembros");
 const [joinCode,setJoinCode]=useState("");
 const [joinError,setJoinError]=useState("");
 const members=draft.members.slice(0,draft.profile.householdSize);
 const dirty=JSON.stringify(draft)!==JSON.stringify(state);

 async function joinOther(){setJoinError("");const ok=await connectHome(joinCode);if(ok)close();else setJoinError("No se ha podido conectar con ese hogar.");}
 function updateMember(id:string,patch:Partial<Member>){setDraft(s=>({...s,members:s.members.map(m=>m.id===id?{...m,...patch}:m)}))}
 function toggleTool(tool:string){setDraft(s=>({...s,profile:{...s.profile,kitchenTools:s.profile.kitchenTools.includes(tool)?s.profile.kitchenTools.filter(x=>x!==tool):[...s.profile.kitchenTools,tool]}}))}
 function save(){
  const validDevice=draft.members.slice(0,draft.profile.householdSize).some(m=>m.id===deviceMemberId);
  if(!validDevice)setDeviceMemberId(draft.members[0]?.id||"");
  setState({...draft});
  setToast("Hogar guardado");
  close();
 }
 function cancel(){close()}

 return <div className="modal-backdrop" onMouseDown={cancel}><div className="modal household-modal" onMouseDown={e=>e.stopPropagation()}>
  <div className="modal-head"><div><span className="eyebrow">MI HOGAR</span><h2>Cómo vive y come cada persona</h2><p>Estos datos ayudan a HomeOS a proponer mejor, estimar demanda y saber para quién se apunta una compra.</p></div><button type="button" aria-label="Cerrar" onClick={cancel}>×</button></div>

  <div className="profile-tabs"><button type="button" className={tab==="miembros"?"active":""} onClick={()=>setTab("miembros")}>Personas</button><button type="button" className={tab==="ajustes"?"active":""} onClick={()=>setTab("ajustes")}>Preferencias y cocina</button></div>

  <div className="household-scroll">
  {tab==="miembros"?<div className="member-profile-grid">{members.map((m,i)=><article className="member-profile-card" key={m.id}>
    <div className="member-title"><span>{m.name.slice(0,1).toUpperCase()||"?"}</span><div><input value={m.name} onChange={e=>updateMember(m.id,{name:e.target.value})}/><small>{m.relation||"Miembro "+(i+1)}</small></div></div>
    <label><span>Rutina</span><select value={m.presence} onChange={e=>updateMember(m.id,{presence:e.target.value as Member["presence"]})}><option value="casa">Suele comer en casa</option><option value="fuera_dia">Fuera durante el día</option><option value="fines_semana">Sobre todo fines de semana</option><option value="variable">Rutina variable</option></select></label>
    <label><span>Consumo habitual</span><select value={m.appetite} onChange={e=>updateMember(m.id,{appetite:e.target.value as Member["appetite"]})}><option value="poco">Come poco</option><option value="normal">Normal</option><option value="mucho">Come bastante</option></select></label>
    <label className="text-field"><span>No le gusta / evita</span><input value={m.dislikes} onChange={e=>updateMember(m.id,{dislikes:e.target.value})} placeholder="Ej. queso, frankfurt, hamburguesa…"/><small>Se usa para avisar y priorizar recetas que encajen mejor con esta persona.</small></label>
    <label className="text-field"><span>Nota útil</span><textarea value={m.notes} onChange={e=>updateMember(m.id,{notes:e.target.value})} placeholder="Ej. come fuera entre semana, suele llevar tupper…"/></label>
    <div className="member-summary"><b>{presenceText(m.presence)}</b><span>{appetiteText(m.appetite)}</span></div>
   </article>)}</div>:<div className="settings-list improved-settings">
    <label><span>Personas del hogar</span><select value={draft.profile.householdSize} onChange={e=>setDraft(s=>{const householdSize=Number(e.target.value);return {...s,profile:{...s.profile,householdSize},members:ensureMembers(s.members,householdSize)}})}>{[1,2,3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></label>
    {members.length>1&&<label><span>Este dispositivo lo usa</span><select value={members.some(m=>m.id===deviceMemberId)?deviceMemberId:(members[0]?.id||"")} onChange={e=>setDeviceMemberId(e.target.value)}>{members.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select><small>Las compras que añadas desde este móvil u ordenador aparecerán a nombre de esta persona.</small></label>}
    <label><span>Estilo habitual de cocina</span><select value={draft.profile.cooking} onChange={e=>setDraft(s=>({...s,profile:{...s.profile,cooking:e.target.value as CookingStyle}}))}><option value="rapido">Rápida</option><option value="normal">Normal</option><option value="cocinar">Me gusta cocinar</option><option value="mealprep">Meal prep</option></select></label>
    <label><span>Información de alimentación</span><select value={draft.profile.nutrition} onChange={e=>setDraft(s=>({...s,profile:{...s.profile,nutrition:e.target.value as NutritionMode}}))}><option value="off">Oculta</option><option value="basica">Básica</option><option value="detallada">Detallada</option></select></label>
    <label><span>Compra habitual</span><select value={draft.profile.shoppingCycle} onChange={e=>setDraft(s=>({...s,profile:{...s.profile,shoppingCycle:e.target.value as Profile["shoppingCycle"]}}))}><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option><option value="mixta">Grande + compras rápidas</option><option value="diaria">Frecuente</option></select></label>

    <div className="profile-market-section"><span>Supermercados habituales</span><div className="profile-market-grid">{SUPERMARKETS.map(m=><button type="button" key={m} className={draft.profile.supermarkets.includes(m)?"active":""} onClick={()=>setDraft(s=>{const supermarkets=s.profile.supermarkets.includes(m)?s.profile.supermarkets.filter(x=>x!==m):[...s.profile.supermarkets,m];return {...s,profile:{...s.profile,supermarkets}}})}>{m}</button>)}</div></div>

    <div className="profile-market-section kitchen-tools-setting"><span>Qué tienes para cocinar</span><p>HomeOS muestra las formas de preparación compatibles cuando la receta las tiene disponibles.</p><div className="profile-market-grid">{KITCHEN_TOOLS.map(t=><button type="button" key={t} className={draft.profile.kitchenTools.includes(t)?"active":""} onClick={()=>toggleTool(t)}>{t}</button>)}</div></div>
   </div>}

  <section className="sync-settings"><div className="sync-settings-head"><div><small>HOGAR COMPARTIDO</small><h3>Sincronización entre dispositivos</h3><p>{syncCreds?"Compra, inventario, calendario y perfiles se guardan para toda la casa.":"HomeOS está preparando el hogar compartido."}</p></div><span className={"sync-state "+syncStatus}>{syncStatus==="synced"?"Sincronizado":syncStatus==="connecting"?"Guardando…":syncStatus==="error"?"Sin conexión":"Local"}</span></div>{syncCreds&&<div className="sync-actions"><button type="button" className="secondary" onClick={copyHomeCode}>Copiar código para otro dispositivo</button><button type="button" className="secondary" onClick={syncNow}>Sincronizar ahora</button></div>}<details className="join-details"><summary>Conectar este dispositivo a otro hogar</summary><div className="join-inline"><input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="HOS1.…"/><button type="button" onClick={joinOther} disabled={!joinCode.trim()||syncStatus==="connecting"}>Conectar</button></div>{joinError&&<span className="form-error">{joinError}</span>}</details></section>
  </div>

  <div className="modal-actions sticky-actions"><button type="button" className="secondary" onClick={cancel}>Cancelar</button><button type="button" className="primary" disabled={!dirty} onClick={save}>{dirty?"Guardar cambios":"Sin cambios"}</button></div>
 </div></div>
}