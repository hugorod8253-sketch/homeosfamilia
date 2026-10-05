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
type Member = {id:string;name:string;relation:string;presence:"casa"|"fuera_dia"|"fines_semana"|"variable";appetite:"poco"|"normal"|"mucho";dislikes:string;notes:string};
type EventItem = {id:string;title:string;date:string};
type RecipeIngredient = {name:string;qty:string;key:string};
type Recipe = {
  id:string; title:string; image:string; time:number; difficulty:"Fácil"|"Media";
  mode:CookingStyle[]; servings:number; calories:number; protein:number; carbs:number; fat:number;
  ingredients:RecipeIngredient[]; steps:string[]; description:string;
};
type Profile = {
  householdSize:number; supermarkets:string[]; mainSupermarket:string; goals:Goal[];
  nutrition:NutritionMode; cooking:CookingStyle; shoppingCycle:"diaria"|"semanal"|"quincenal"|"mensual"|"mixta";
  notifications:boolean; onboardingDone:boolean; financeMode:"orientativo"|"preciso";
};
type AppState = {
  inventory:InventoryItem[]; shopping:ShoppingItem[]; members:Member[]; events:EventItem[];
  profile:Profile; budget:number; spent:number; waste:number; wasteSaved:number;
};

const SUPERMARKETS=["Mercadona","Lidl","Aldi","Carrefour","Alcampo","Dia","Consum","Bonpreu / Esclat","Caprabo","Eroski","Condis","Carnicería","Frutería","Otro supermercado"];
const CATEGORIES=["Todos","Lácteos","Carne","Fruta y verdura","Despensa","Preparados","Suplementos"];
const LOCATIONS=["Todo","Nevera","Congelador","Despensa","Suplementos"];

const RECIPES:Recipe[]=[
 {id:"r1",title:"Hamburguesa casera",image:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=76",time:20,difficulty:"Fácil",mode:["rapido","normal"],servings:4,calories:620,protein:36,carbs:52,fat:28,description:"Rápida y pensada para aprovechar lo que ya tienes.",ingredients:[{name:"Hamburguesas",qty:"4 uds",key:"hamburguesas"},{name:"Queso",qty:"4 lonchas",key:"queso"},{name:"Pan de hamburguesa",qty:"4 uds",key:"pan"},{name:"Tomates",qty:"2 uds",key:"tomate"}],steps:["Calienta una sartén a fuego medio-alto.","Cocina las hamburguesas 3–4 min por lado.","Añade el queso al final.","Monta con pan y tomate y sirve."]},
 {id:"r2",title:"Pasta cremosa con queso",image:"https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=76",time:18,difficulty:"Fácil",mode:["rapido","normal"],servings:4,calories:540,protein:22,carbs:76,fat:15,description:"Una comida de despensa sencilla y rápida.",ingredients:[{name:"Pasta",qty:"320 g",key:"pasta"},{name:"Queso",qty:"120 g",key:"queso"},{name:"Leche",qty:"200 ml",key:"leche"}],steps:["Cuece la pasta.","Calienta la leche a fuego suave.","Añade el queso y remueve.","Mezcla con la pasta y ajusta de sal."]},
 {id:"r3",title:"Pollo con arroz y verduras",image:"https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=900&q=76",time:30,difficulty:"Fácil",mode:["normal","mealprep","cocinar"],servings:5,calories:585,protein:46,carbs:64,fat:16,description:"Ideal para varias raciones y para llevar fuera de casa.",ingredients:[{name:"Pollo",qty:"800 g",key:"pollo"},{name:"Arroz",qty:"350 g",key:"arroz"},{name:"Tomates",qty:"3 uds",key:"tomate"}],steps:["Corta y dora el pollo.","Cuece el arroz por separado.","Saltea las verduras o tomate.","Reparte en raciones y deja enfriar antes de guardar."]},
 {id:"r4",title:"Batido de plátano y proteína",image:"https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=900&q=76",time:5,difficulty:"Fácil",mode:["rapido","mealprep"],servings:1,calories:390,protein:32,carbs:48,fat:8,description:"Batido rápido; los suplementos se integran como cualquier otro ingrediente.",ingredients:[{name:"Leche",qty:"250 ml",key:"leche"},{name:"Plátano",qty:"1 ud",key:"platano"},{name:"Proteína whey",qty:"30 g",key:"proteina"}],steps:["Añade todos los ingredientes a la batidora.","Tritura 30–45 segundos.","Ajusta textura con leche o agua."]},
 {id:"r5",title:"Tortitas para aprovechar leche",image:"https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=900&q=76",time:22,difficulty:"Fácil",mode:["normal","cocinar"],servings:4,calories:430,protein:17,carbs:58,fat:14,description:"Buena opción cuando tienes leche de sobra.",ingredients:[{name:"Leche",qty:"500 ml",key:"leche"},{name:"Huevos",qty:"3 uds",key:"huevo"},{name:"Harina",qty:"300 g",key:"harina"}],steps:["Mezcla huevos y leche.","Añade harina poco a poco.","Cocina porciones en sartén antiadherente.","Sirve y guarda las sobrantes."]}
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
 members:[{id:"m1",name:"Tú",relation:"Yo",presence:"fines_semana",appetite:"normal",dislikes:"",notes:"Entre semana casi no está en casa."},{id:"m2",name:"Mamá",relation:"Madre",presence:"fuera_dia",appetite:"normal",dislikes:"",notes:"Suele comer fuera y vuelve por la noche."},{id:"m3",name:"Papá",relation:"Padre",presence:"casa",appetite:"normal",dislikes:"",notes:"Hace parte de la compra familiar."},{id:"m4",name:"Hermano",relation:"Hijo",presence:"casa",appetite:"mucho",dislikes:"queso",notes:"Consume bastante comida preparada."}],
 events:[{id:"e1",title:"Navidad",date:"2026-12-25"}],
 budget:800,spent:486.35,waste:18.4,wasteSaved:27.6,
 profile:{householdSize:4,supermarkets:["Mercadona","Lidl"],mainSupermarket:"Mercadona",goals:["organizar","desperdicio"],nutrition:"basica",cooking:"rapido",shoppingCycle:"semanal",notifications:true,onboardingDone:false,financeMode:"orientativo"}
};

function normalizeState(x:any):AppState{
 const raw=x&&typeof x==="object"?x:{};
 const rawMembers=raw.members||DEFAULT.members;
 const profile={...DEFAULT.profile,...(raw.profile||{})};
 const baseMembers=rawMembers.map((m:any,i:number)=>({...((DEFAULT.members[i]||{id:"m"+(i+1),name:"Miembro "+(i+1),relation:"Miembro",presence:"variable",appetite:"normal",dislikes:"",notes:""}) as Member),...m}));
 const members=ensureMembers(baseMembers,profile.householdSize);
 return {...DEFAULT,...raw,profile,members,events:raw.events||DEFAULT.events,inventory:raw.inventory||DEFAULT.inventory,shopping:raw.shopping||DEFAULT.shopping};
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
 const active=state.inventory.filter(i=>i.stock!=="falta");
 const has=(re:RegExp,cat?:string)=>active.some(i=>(cat&&i.category===cat)||re.test(norm(i.name)));
 return [
  ["Proteína",has(/pollo|carne|pescado|huevo|proteina|yogur/)],
  ["Verdura",has(/verdura|tomate|zanahoria|cebolla|aguacate|brocoli/,"Fruta y verdura")],
  ["Carbohidratos",has(/arroz|pasta|pan|patata|avena/)],
  ["Dulces/snacks",has(/chocolate|galleta|chuche|gominola|snack|bolleria/)]
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
 const cameraRef=useRef<HTMLInputElement>(null),galleryRef=useRef<HTMLInputElement>(null),receiptRef=useRef<HTMLInputElement>(null);

 useEffect(()=>{setState(loadState());setHydrated(true)},[]);
 useEffect(()=>{if(hydrated&&typeof window!=="undefined")localStorage.setItem("homeos:v5",JSON.stringify(state))},[state,hydrated]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(""),2400);return()=>clearTimeout(t)},[toast]);
 useEffect(()=>{window.scrollTo({top:0,behavior:"smooth"})},[view]);

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
   return {...s,inventory,spent:typeof total==="number"&&total>=0?s.spent+total:s.spent,shopping:s.shopping.filter(i=>i.status!=="carrito")};
  });
  setShoppingActive(false);setActiveStore("");setToast(`${cart.length} productos guardados como compra reciente`);
 }

 if(!hydrated)return <div className="app-loading"><div className="app-loading-mark">H</div><strong>HomeOS</strong></div>;
 if(!state.profile.onboardingDone)return <Onboarding state={state} setState={setState}/>;

 return <div className="app-shell">
  <aside className="sidebar">
   <div className="brand">{logo()}<div><strong>HomeOS</strong><span>Tu cocina, sin carga mental</span></div></div>
   <nav>{nav.map(n=><button key={n.id} className={view===n.id?"nav active":"nav"} onClick={()=>setView(n.id)}><span>{n.icon}</span>{n.label}</button>)}</nav>
   <button className="profile" onClick={()=>setProfileOpen(true)}><span>FR</span><div><strong>Mi hogar</strong><small>{state.profile.householdSize} personas</small></div></button>
  </aside>

  <main className="main">
   <header className="topbar"><div><span className="eyebrow">{fmtDate()}</span><h1>{view==="inicio"?"Dashboard":nav.find(n=>n.id===view)?.label}</h1></div><button className="avatar" onClick={()=>setProfileOpen(true)}>FR</button></header>
   {view==="inicio"&&<Inicio state={state} setState={setState} expiring={expiring} confidence={confidence} available={available} setView={setView}/>}
   {view==="comer"&&<Comer state={state} setState={setState} addFromRecipe={addFromRecipe}/>}
   {view==="comprar"&&<Comprar state={state} setState={setState} activeStore={activeStore} setActiveStore={setActiveStore} shoppingActive={shoppingActive} setShoppingActive={setShoppingActive} finishShopping={finishShopping} receiptRef={receiptRef} setToast={setToast}/>}
   {view==="casa"&&<Casa state={state} setState={setState} cameraRef={cameraRef} galleryRef={galleryRef} setToast={setToast}/>}
   {view==="finanzas"&&<Finanzas state={state} setState={setState} available={available}/>}
  </main>

  <nav className="bottom-nav">{nav.map(n=><button key={n.id} className={view===n.id?"active":""} onClick={()=>setView(n.id)}><span>{n.icon}</span><small>{n.label}</small></button>)}</nav>
  {profileOpen&&<ProfileModal state={state} setState={setState} close={()=>setProfileOpen(false)}/>}
  {toast&&<div className="toast" role="status" aria-live="polite"><span>✓</span>{toast}</div>}
 </div>
}

function Onboarding({state,setState}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>}){
 const [step,setStep]=useState(0);
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
 </div></div>
}

function Inicio({state,setState,expiring,confidence,available,setView}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;expiring:InventoryItem[];confidence:number;available:number;setView:(v:View)=>void}){
 const todayIso=new Date().toISOString().slice(0,10);
 const next=state.events.filter(e=>e.date>=todayIso).slice().sort((a,b)=>a.date.localeCompare(b.date))[0];
 const recommended=state.shopping.filter(i=>i.reason==="recomienda"&&i.status==="pendiente").length;
 return <section className="stack">
  <div className="dashboard-hero"><div><span className="eyebrow">HOMEOS HOY · {state.profile.cooking==="mealprep"?"MEAL PREP":state.profile.cooking==="rapido"?"POCO TIEMPO":state.profile.cooking==="cocinar"?"ME GUSTA COCINAR":"COCINA NORMAL"}</span><h2>{state.profile.householdSize===1?"Tu cocina, pensada para ti":state.profile.householdSize===2?"Vuestra cocina, coordinada":"La cocina de casa, coordinada"}</h2><p>{recommended? `${recommended} productos podrían necesitar reposición.`:"No hay ninguna compra urgente detectada."} {state.profile.shoppingCycle==="semanal"?"Próxima compra estimada: esta semana.":state.profile.shoppingCycle==="mensual"?"HomeOS prioriza lo que debe durar hasta la próxima compra grande.":""}</p></div><div className="confidence-pill"><span>Inventario</span><strong>{confidence>.8?"Bastante actualizado":confidence>.55?"Orientativo":"Necesita revisión"}</strong><small>{state.profile.nutrition==="detallada"?"Nutrición detallada":state.profile.nutrition==="basica"?"Hábitos activos":"Nutrición oculta"}</small></div></div>
  <div className="household-context">
   <div><small>PERFIL DEL HOGAR</small><strong>{state.members.slice(0,state.profile.householdSize).filter(m=>m.presence==="casa").length} comen habitualmente en casa</strong><span>{state.members.slice(0,state.profile.householdSize).filter(m=>m.presence==="fuera_dia").length} fuera durante el día · {state.members.slice(0,state.profile.householdSize).filter(m=>m.appetite==="mucho").length} con consumo alto</span></div>
   <button onClick={()=>document.querySelector<HTMLButtonElement>(".avatar")?.click()}>Configurar perfiles</button>
  </div>
  <div className="quick-strip" aria-label="Acciones rápidas">
   <button onClick={()=>setView("comer")}><span>🍽️</span><div><strong>Quiero comer</strong><small>Ideas con lo que hay</small></div></button>
   <button onClick={()=>setView("comprar")}><span>🛒</span><div><strong>Voy a comprar</strong><small>Lista ordenada</small></div></button>
   <button onClick={()=>setView("casa")}><span>🏠</span><div><strong>¿Qué hay en casa?</strong><small>Inventario rápido</small></div></button>
  </div>
  <div className="hero-grid">
   <button className="decision-card photo-card" onClick={()=>setView("comer")}><img src={RECIPES[0].image} alt="Idea para comer" decoding="async"/><div className="photo-overlay"><small>QUÉ COMEMOS</small><h2>Ideas con lo que tienes</h2><p>Rápidas, útiles y conectadas al inventario.</p></div></button>
   <button className="decision-card blue" onClick={()=>setView("comprar")}><span className="decision-icon">🛒</span><div><small>PRÓXIMA COMPRA</small><h2>{state.shopping.filter(x=>x.status==="pendiente").length} pendientes</h2><p>HomeOS separa pedido, recomendación y receta.</p></div><b>›</b></button>
  </div>
  <div className="card-grid four">
   <article className="soft-card amber"><small>CADUCA PRONTO</small><strong>{expiring.length}</strong><p>{expiring[0]?.name||"Nada urgente"}</p></article>
   <article className="soft-card green"><small>DISPONIBLE MES</small><strong>{available.toFixed(0)} €</strong><p>Seguimiento {state.profile.financeMode}</p></article>
   <article className="soft-card blue-soft"><small>PREPARADOS</small><strong>{state.inventory.filter(i=>i.category==="Preparados"&&i.stock!=="falta").reduce((n,i)=>n+(i.servings||i.qty||0),0)}</strong><p>Raciones listas en nevera/congelador</p></article>
   <article className="soft-card rose"><small>PRÓXIMO EVENTO</small><strong>{next?new Date(next.date+"T12:00:00").getDate():"—"}</strong><p>{next?.title||"Sin eventos"}</p></article>
  </div>
  <div className="home-secondary-grid">
   <button className="home-recipes-card" onClick={()=>setView("comer")}><div><small>RECETAS</small><h3>Cocina con lo que ya tienes</h3><p>Recetas rápidas, meal prep y nutrición por ración.</p></div><span>Ver recetas →</span></button>
   {state.profile.nutrition!=="off"&&<article className="home-habits-card"><div className="home-habits-head"><div><small>HÁBITOS · APRENDIENDO</small><h3>Cómo está comiendo el hogar</h3></div><button onClick={()=>setView("comer")}>Ver detalle</button></div><div className="habit-mini">{habitSignals(state).map(([label,seen])=><span key={label}>{label}<b style={{width:seen?"72%":"18%",opacity:seen?1:.35}}/></span>)}</div><p>{habitSignals(state).filter(([,seen])=>seen).length} grupos con señales recientes. HomeOS evita inventar porcentajes de consumo.</p></article>}
  </div>
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
 const [selectedRecipeId,setSelectedRecipeId]=useState<string|null>(null);
 const options=RECIPES.filter(r=>r.mode.includes(mode)).sort((a,b)=>score(b,state.inventory)-score(a,state.inventory));
 const pool=options.length?options:RECIPES;
 const autoRecipe=pool[index%pool.length];
 const recipe=(selectedRecipeId?RECIPES.find(r=>r.id===selectedRecipeId):undefined)||autoRecipe;
 const miss=missing(recipe,state.inventory);
 const filtered=useMuch?RECIPES.filter(r=>r.ingredients.some(i=>norm(i.name).includes(norm(useMuch))||norm(i.key).includes(norm(useMuch)))||norm(r.title).includes(norm(useMuch))):[];

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
  <div className="page-intro"><div><span className="eyebrow">RECETAS Y COMIDAS</span><h2>Qué puedes preparar hoy</h2><p>Primero te enseñamos recetas compatibles con tu inventario y tu tiempo. Los ingredientes que falten pasan a la compra con un toque.</p></div><div className="view-tabs"><button className={tab==="ideas"?"active":""} onClick={()=>setTab("ideas")}>Ideas</button>{state.profile.nutrition!=="off"&&<button className={tab==="habitos"?"active":""} onClick={()=>setTab("habitos")}>Hábitos</button>}</div></div>
  {tab==="ideas"?<>
   <div className="mode-row">{[["rapido","Rápido"],["normal","Normal"],["cocinar","Cocinar"],["mealprep","Meal prep"]].map(([id,label])=><button key={id} className={mode===id?"active":""} onClick={()=>{setMode(id as CookingStyle);setIndex(0);setSelectedRecipeId(null)}}>{label}</button>)}</div>
   <article className="featured-meal"><img src={recipe.image} alt={recipe.title} loading="lazy" decoding="async"/><div className="featured-copy"><span className="eyebrow">{miss.length?"TE FALTA POCO":"PUEDES HACERLO YA"}</span><h3>{recipe.title}</h3><p>{recipe.description}</p><div className="chips"><span>{recipe.time} min</span><span>{recipe.difficulty}</span><span>{recipe.servings} raciones</span></div><div className="macro-row"><b>{recipe.calories} kcal</b><span>{recipe.protein}g proteína</span><span>{recipe.carbs}g carbos</span><span>{recipe.fat}g grasas</span><small>por ración · estimación</small></div>{state.members.slice(0,state.profile.householdSize).some(m=>m.dislikes&&recipe.ingredients.some(i=>norm(m.dislikes).includes(norm(i.key))))&&<div className="family-warning">⚠ Esta receta contiene algo que no gusta a {state.members.slice(0,state.profile.householdSize).filter(m=>m.dislikes&&recipe.ingredients.some(i=>norm(m.dislikes).includes(norm(i.key)))).map(m=>m.name).join(", ")}.</div>}
<div className="meal-actions"><button className="primary" onClick={()=>setOpen(true)}>Vamos a prepararlo</button><button className="secondary" onClick={()=>{setSelectedRecipeId(null);setIndex(i=>i+1)}}>Otra idea</button></div></div></article>
   <div className="ingredient-summary"><article><small>TIENES</small>{recipe.ingredients.filter(i=>!miss.some(m=>m.name===i.name)).map(i=><span key={i.name}>✓ {i.name}</span>)}</article><article><small>TE FALTA</small>{miss.length?miss.map(i=><span key={i.name}>• {i.name}</span>):<span>Todo listo</span>}<button onClick={()=>addFromRecipe(recipe)} disabled={!miss.length}>Añadir faltantes</button></article></div>
   <article className="use-more-card"><div><small>APROVECHAR PRODUCTO</small><h3>¿Tienes demasiado de algo?</h3><p>Escribe un ingrediente y HomeOS prioriza recetas que realmente lo gasten.</p></div><input value={useMuch} onChange={e=>setUseMuch(e.target.value)} placeholder="Ej. leche, tomates, huevos…"/>{useMuch&&<div className="recipe-mini-list">{filtered.length?filtered.slice(0,4).map(r=><button key={r.id} onClick={()=>{setSelectedRecipeId(r.id);setMode(r.mode[0]);setUseMuch("")}}><strong>{r.title}</strong><span>{r.time} min · {missing(r,state.inventory).length?missing(r,state.inventory).length+" faltantes":"puedes hacerlo ya"}</span></button>):<div className="recipe-empty">No hay una receta preparada con ese ingrediente todavía.</div>}</div>}</article>
  </>:<Habitos state={state}/>}
  {open&&<div className="modal-backdrop"><div className="modal recipe-modal"><div className="modal-head"><div><span className="eyebrow">PREPARAR</span><h2>{recipe.title}</h2></div><button onClick={()=>setOpen(false)}>×</button></div><div className="recipe-cols"><div><h4>Ingredientes</h4>{recipe.ingredients.map(i=><p key={i.name}>{i.qty} · {i.name}</p>)}</div><div><h4>Pasos</h4>{recipe.steps.map((s,i)=><p key={s}><b>{i+1}.</b> {s}</p>)}</div></div><div className="recipe-total"><span>Total receta</span><b>≈ {recipe.calories*recipe.servings} kcal · {recipe.protein*recipe.servings}g proteína</b></div><button className="primary modal-save" onClick={completeRecipe}>He terminado</button></div></div>}
 </section>
}

function Habitos({state}:{state:AppState}){
 const prepared=state.inventory.filter(i=>i.category==="Preparados"&&i.stock!=="falta").length;
 const known=state.inventory.filter(i=>i.stock!=="incierto").length;
 const quality=Math.min(100,Math.round((known/Math.max(1,state.inventory.length))*70 + Math.min(30,prepared*6)));
 const signals=[
  ["Proteína","Aprendiendo",state.inventory.some(i=>/pollo|carne|pescado|huevo|proteina/i.test(i.name))],
  ["Verdura y fruta","Aprendiendo",state.inventory.some(i=>i.category==="Fruta y verdura")],
  ["Carbohidratos","Aprendiendo",state.inventory.some(i=>/arroz|pasta|pan|patata/i.test(i.name))],
  ["Dulces / snacks","Sin datos suficientes",false]
 ];
 return <div className="habits-grid"><article className="habit-chart"><div><small>HÁBITOS · DATOS REALES</small><h3>HomeOS está aprendiendo vuestro patrón</h3><p className="habit-explainer">Las compras no equivalen a consumo. Las conclusiones aparecerán cuando haya recetas, preparados, reposiciones, fotos o correcciones suficientes.</p></div>{signals.map(([k,label,seen])=><div className="habit-status-row" key={String(k)}><span>{String(k)}</span><b className={seen?"seen":""}>{seen?"Señales registradas":String(label)}</b></div>)}</article><article className="habit-note"><span>✦</span><h3>Calidad de la estimación</h3><strong className="quality-number">{quality}%</strong><p>Cuanto más historial real tenga HomeOS, menos dependerá de supuestos generales.</p><small>No mostramos porcentajes nutricionales inventados.</small></article></div>
}

function Comprar({state,setState,activeStore,setActiveStore,shoppingActive,setShoppingActive,finishShopping,receiptRef,setToast}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;activeStore:string;setActiveStore:(s:string)=>void;shoppingActive:boolean;setShoppingActive:(b:boolean)=>void;finishShopping:(total?:number)=>void;receiptRef:React.RefObject<HTMLInputElement|null>;setToast:(s:string)=>void}){
 const [quick,setQuick]=useState("");
 const [member,setMember]=useState(state.members[0]?.name||"Tú");
 const [storeFilter,setStoreFilter]=useState("Todos");
 const [purchaseTotal,setPurchaseTotal]=useState("");
 const [receiptName,setReceiptName]=useState("");
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
   return {...s,shopping:[...s.shopping,{id:crypto.randomUUID(),name:name.charAt(0).toUpperCase()+name.slice(1),qty,unit,category,supermarket,requestedBy:member,reason:"persona",status:"pendiente"}]};
  });
  setQuick("");
 }
 function moveHere(id:string){setState(s=>({...s,shopping:s.shopping.map(i=>i.id===id?{...i,supermarket:activeStore,status:"pendiente"}:i)}))}
 function cart(id:string){setState(s=>({...s,shopping:s.shopping.map(i=>i.id===id?{...i,status:i.status==="carrito"?"pendiente":"carrito"}:i)}))}
 const filteredList=state.shopping.filter(i=>storeFilter==="Todos"||i.supermarket===storeFilter||(!i.supermarket&&storeFilter==="Cualquiera"));
 const mainItems=shoppingActive&&activeStore?state.shopping.filter(i=>(!i.supermarket||i.supermarket===activeStore)):filteredList;
 const grouped=mainItems.reduce<Record<string,ShoppingItem[]>>((a,i)=>{(a[i.category]??=[]).push(i);return a},{});
 const other=shoppingActive&&activeStore?state.shopping.filter(i=>i.supermarket&&i.supermarket!==activeStore&&i.status==="pendiente"):[];
 return <section className="stack">
  <div className="shopping-top"><div><span className="eyebrow">LISTA GENERAL</span><h2>{shoppingActive?(activeStore?`Comprando en ${activeStore}`:"Elige dónde estás comprando"):"Compra compartida"}</h2><p>Añade lo que necesitas. Al empezar la compra, HomeOS lo ordena por tienda y categoría.</p></div>{shoppingActive?<div className="shopping-session-actions"><button className="secondary" onClick={()=>{setState(s=>({...s,shopping:s.shopping.map(i=>i.status==="carrito"?{...i,status:"pendiente"}:i)}));setShoppingActive(false);setActiveStore("");setPurchaseTotal("");setReceiptName("")}}>Salir</button><button className="primary" disabled={!activeStore||(state.profile.financeMode==="preciso"&&!purchaseTotal.trim())} onClick={()=>{const n=Number(purchaseTotal.replace(",","."));const manual=purchaseTotal.trim()&&Number.isFinite(n)?n:undefined;const total=manual??(state.profile.financeMode==="orientativo"&&estimatedTotal>0?estimatedTotal:undefined);finishShopping(total);setPurchaseTotal("");setReceiptName("")}}>Terminar compra</button></div>:<button className="primary" onClick={()=>setShoppingActive(true)}>Estoy comprando</button>}</div>
  {!shoppingActive?<div className="quick-add smart"><input value={quick} onChange={e=>setQuick(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Ej. leche semidesnatada Lidl, 1 kg pollo…"/><select value={member} onChange={e=>setMember(e.target.value)}>{state.members.slice(0,state.profile.householdSize).map(m=><option key={m.id}>{m.name}</option>)}</select><button onClick={add}>Añadir</button></div>:<div className="store-picker"><span>Estoy en</span>{state.profile.supermarkets.map(s=><button key={s} className={activeStore===s?"active":""} onClick={()=>setActiveStore(s)}>{s}</button>)}</div>}
  {!shoppingActive&&<div className="store-tabs"><button className={storeFilter==="Todos"?"active":""} onClick={()=>setStoreFilter("Todos")}>Todos</button>{state.profile.supermarkets.map(s=><button className={storeFilter===s?"active":""} key={s} onClick={()=>setStoreFilter(s)}>{s}</button>)}<button className={storeFilter==="Cualquiera"?"active":""} onClick={()=>setStoreFilter("Cualquiera")}>Cualquiera</button></div>}
  {shoppingActive&&!activeStore&&<article className="empty-state"><h3>¿En qué tienda estás?</h3><p>Elige una arriba para reorganizar la compra. No se puede cerrar hasta seleccionar una.</p></article>}
  {(!shoppingActive||activeStore)&&<div className="shopping-layout"><div className="category-list">{Object.keys(grouped).length===0&&<article className="friendly-empty"><span>✓</span><h3>Todo al día</h3><p>No hay productos en esta vista.</p></article>}{Object.entries(grouped).map(([cat,items])=><article className="list-card" key={cat}><div className="list-title"><h3>{cat}</h3><span>{items.length}</span></div><div className="shopping-card-grid">{items.map(i=><div className={i.status==="carrito"?"shop-visual-card checked":"shop-visual-card"} key={i.id}><button className="product-pictogram" onClick={()=>cart(i.id)} aria-label={i.status==="carrito"?"Quitar del carrito":"Añadir al carrito"}>{i.status==="carrito"?"✓":productIcon(i.name,i.category)}</button><div className="shop-visual-copy"><strong>{i.name}</strong><span>{i.qty} {i.unit}</span><small>{i.reason==="recomienda"?"HomeOS recomienda":i.reason==="receta"?"Receta":i.requestedBy}</small></div>{i.supermarket&&<em>{i.supermarket}</em>}</div>)}</div></article>)}</div><aside className="purchase-tools"><button className="tool-action" onClick={()=>receiptRef.current?.click()}><span>🧾</span><div><strong>Adjuntar ticket</strong><p>{receiptName?`Seleccionado: ${receiptName}`:"Selecciona foto o PDF del ticket."}</p></div></button><input ref={receiptRef} hidden type="file" accept="image/*,.pdf" onChange={e=>{const file=e.target.files?.[0];if(file){setReceiptName(file.name);setToast("Ticket seleccionado")}}}/>{shoppingActive&&<label className="purchase-total"><span>Total de la compra <small>{state.profile.financeMode==="preciso"?"necesario en modo preciso":"opcional"}</small></span><div><input inputMode="decimal" value={purchaseTotal} onChange={e=>setPurchaseTotal(e.target.value)} placeholder={estimatedTotal>0?`≈ ${estimatedTotal.toFixed(2)}`:"0,00"}/><b>€</b></div>{state.profile.financeMode==="orientativo"&&estimatedTotal>0&&<small>Si lo dejas vacío, HomeOS usará ≈ {estimatedTotal.toFixed(2)} € con precios conocidos.</small>}</label>}<article className="tool-card"><span>✦</span><div><strong>HomeOS recomienda</strong><p>{state.shopping.filter(i=>i.reason==="recomienda").length} productos por posible falta.</p></div></article></aside></div>}
  {shoppingActive&&activeStore&&other.length>0&&<article className="other-stores"><div><small>PENDIENTE EN OTRAS TIENDAS</small><h3>También tenías esto apuntado</h3></div>{other.map(i=><div key={i.id}><span><strong>{i.name}</strong><small>{i.supermarket}</small></span><button onClick={()=>moveHere(i.id)}>Traer aquí</button></div>)}</article>}
 </section>
}

function Casa({state,setState,cameraRef,galleryRef,setToast}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;cameraRef:React.RefObject<HTMLInputElement|null>;galleryRef:React.RefObject<HTMLInputElement|null>;setToast:(s:string)=>void}){
 const [loc,setLoc]=useState("Todo"),[cat,setCat]=useState("Todos");
 const [preparedOpen,setPreparedOpen]=useState(false);
 const [preparedName,setPreparedName]=useState("");
 const [voiceDraft,setVoiceDraft]=useState("");
 const [voiceListening,setVoiceListening]=useState(false);
 const [preparedServings,setPreparedServings]=useState(1);
 const [preparedLocation,setPreparedLocation]=useState<"Nevera"|"Congelador">("Nevera");
 const [photoStatus,setPhotoStatus]=useState("");
 const shown=state.inventory.filter(i=>(loc==="Todo"||i.location===loc)&&(cat==="Todos"||i.category===cat));
 function setStock(id:string,stock:StockState){setState(s=>({...s,inventory:s.inventory.map(i=>i.id===id?{...i,stock,qty:stock==="falta"?0:i.qty}:i)}))}
 function freeze(id:string){const frozenAt=new Date().toISOString().slice(0,10);setState(s=>({...s,inventory:s.inventory.map(i=>i.id===id?{...i,location:"Congelador",frozenAt,originalExpires:i.originalExpires||i.expires,expires:undefined,dateType:undefined}:i)}));setToast("Producto movido al congelador")}
 function addToBuy(i:InventoryItem){if(state.shopping.some(q=>norm(q.name)===norm(i.name)&&q.status==="pendiente")){setToast("Ya estaba en la lista de compra");return}setState(s=>({...s,shopping:[...s.shopping,{id:crypto.randomUUID(),name:i.name,qty:1,unit:i.unit,category:i.category,requestedBy:"Casa",reason:"recomienda",status:"pendiente"}]}));setToast("Añadido a la compra")}
 function parsePreparedVoice(text:string){
  const t=norm(text);
  const rMatch=t.match(/(\d+)\s*(raciones|tuppers|tuperes|tuppers?)/);
  const servings=rMatch?Math.max(1,Number(rMatch[1])):1;
  const location=t.includes("congela")?"Congelador":"Nevera";
  let name=text
    .replace(/he preparado/ig,"")
    .replace(/han sobrado/ig,"")
    .replace(/sobraron/ig,"")
    .replace(/guardo/ig,"")
    .replace(/dejo/ig,"")
    .replace(/congelo/ig,"")
    .replace(/\d+\s*(raciones|tuppers?|tuperes)/ig,"")
    .replace(/en la nevera/ig,"")
    .replace(/en el congelador/ig,"")
    .replace(/al congelador/ig,"")
    .trim();
  if(!name) name="Comida preparada";
  setPreparedName(name.charAt(0).toUpperCase()+name.slice(1));
  setPreparedServings(servings);
  setPreparedLocation(location);
 }
 function startPreparedVoice(){
  const W=(window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if(!W){setToast("El reconocimiento de voz no está disponible en este navegador");return}
  const recognition=new W();
  recognition.lang="es-ES"; recognition.interimResults=false; recognition.maxAlternatives=1;
  setVoiceListening(true);
  recognition.onresult=(e:any)=>{const text=e.results?.[0]?.[0]?.transcript||"";setVoiceDraft(text);parsePreparedVoice(text)};
  recognition.onerror=()=>setToast("No he podido entender la voz");
  recognition.onend=()=>setVoiceListening(false);
  recognition.start();
 }
 function savePrepared(){
  const name=preparedName.trim(); if(!name)return;
  const today=new Date();
  const preparedAt=today.toISOString().slice(0,10);
  const item:InventoryItem={id:crypto.randomUUID(),name,qty:preparedServings,unit:"raciones",location:preparedLocation,category:"Preparados",stock:"hay",purchasedAt:preparedAt,preparedAt,servings:preparedServings,source:"sobras"};
  setState(s=>({...s,inventory:[item,...s.inventory]}));
  setPreparedName("");setPreparedServings(1);setPreparedLocation("Nevera");setVoiceDraft("");setPreparedOpen(false);setToast("Preparado guardado");
 }
 return <section className="stack">
  <div className="page-intro"><div><span className="eyebrow">INVENTARIO DE CASA</span><h2>Qué hay, qué queda poco y qué conviene revisar</h2><p>Una vista visual por ubicación y categoría. HomeOS estima cuando no tiene confirmación reciente.</p></div><div className="photo-actions"><button className="prepared-button" onClick={()=>setPreparedOpen(true)}>🍱 Añadir preparado</button><button className="secondary" onClick={()=>cameraRef.current?.click()}>Hacer foto</button><button className="secondary" onClick={()=>galleryRef.current?.click()}>Fototeca</button><input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files?.[0];if(f){setPhotoStatus(f.name||"Foto de cámara");setToast("Foto seleccionada")}}}/><input ref={galleryRef} hidden type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f){setPhotoStatus(f.name);setToast("Imagen seleccionada")}}}/>{photoStatus&&<span className="photo-status">Imagen lista: {photoStatus} · análisis automático pendiente</span>}</div></div>
  <div className="inventory-controls"><div className="segmented">{LOCATIONS.map(x=><button key={x} className={loc===x?"active":""} onClick={()=>setLoc(x)}>{x}</button>)}</div><div className="segmented categories">{CATEGORIES.map(x=><button key={x} className={cat===x?"active":""} onClick={()=>setCat(x)}>{x}</button>)}</div></div>
  <div className="inventory-grid">{shown.length===0&&<article className="friendly-empty inventory-empty"><span>⌂</span><h3>No hay nada aquí todavía</h3><p>Cambia el filtro o añade productos desde una compra.</p></article>}{shown.map(i=><article className="inventory-card" key={i.id}><div className="inventory-top"><span className="food-dot">{i.location==="Nevera"?"❄":i.location==="Congelador"?"◈":i.location==="Suplementos"?"＋":"▦"}</span><span className={`stock-badge ${i.stock}`}>{statusLabel(i.stock)}</span></div><h3>{i.name}</h3><p>{i.stock==="incierto"?"Cantidad estimada":`${i.qty} ${i.unit}`} · {i.location}</p><div className={`rotation-badge ${rotationBand(i.name,i.category,i.location).key}`}>{rotationBand(i.name,i.category,i.location).label}</div>{i.category==="Preparados"&&<div className="prepared-meta"><span>🍱 Preparado</span><span>{i.source==="mealprep"?"Meal prep":i.source==="receta"?"Receta":"Sobras / tupper"}</span>{i.preparedAt&&<span>Hecho {new Date(i.preparedAt+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</span>}</div>}{i.expires&&<small className={i.dateType==="caducidad"?"date-alert expiry":"date-alert"}>{i.dateType==="caducidad"?"Caduca":"Consumo pref."}: {new Date(i.expires+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</small>}{i.frozenAt&&<small className="date-alert">Congelado: {new Date(i.frozenAt+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</small>}<div className="inventory-actions">{i.stock!=="falta"&&<button onClick={()=>setStock(i.id,"falta")}>Se acabó</button>}{i.stock!=="falta"&&<button onClick={()=>setStock(i.id,"poco")}>Queda poco</button>}{i.location==="Nevera"&&i.dateType==="caducidad"&&<button onClick={()=>freeze(i.id)}>Congelar</button>}{i.stock==="falta"&&<button onClick={()=>addToBuy(i)}>Añadir a compra</button>}</div></article>)}</div>
  {preparedOpen&&<div className="modal-backdrop" onMouseDown={()=>setPreparedOpen(false)}><div className="modal prepared-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">PREPARADOS</span><h2>Guardar comida ya hecha</h2><p>Sobras, tuppers y meal prep viven en el mismo sitio.</p></div><button onClick={()=>setPreparedOpen(false)}>×</button></div><div className="voice-prepared-box"><button className={voiceListening?"voice-main listening":"voice-main"} onClick={startPreparedVoice}>{voiceListening?"Escuchando…":"🎙 Añadir por voz"}</button><span>Ej.: “Han sobrado 3 raciones de pollo con arroz y van a la nevera”.</span>{voiceDraft&&<small>Entendido: “{voiceDraft}”</small>}</div><div className="prepared-divider"><span>o manualmente</span></div><div className="prepared-form"><label><span>¿Qué es?</span><input autoFocus value={preparedName} onChange={e=>setPreparedName(e.target.value)} placeholder="Ej. pollo con arroz, lentejas…"/></label><label><span>Raciones aproximadas</span><div className="stepper"><button onClick={()=>setPreparedServings(n=>Math.max(1,n-1))}>−</button><b>{preparedServings}</b><button onClick={()=>setPreparedServings(n=>n+1)}>+</button></div></label><label><span>¿Dónde lo guardas?</span><div className="storage-choice"><button className={preparedLocation==="Nevera"?"active":""} onClick={()=>setPreparedLocation("Nevera")}>❄️ Nevera</button><button className={preparedLocation==="Congelador"?"active":""} onClick={()=>setPreparedLocation("Congelador")}>🧊 Congelador</button></div></label><div className="prepared-note">HomeOS lo tratará como comida lista y la priorizará. La conservación dependerá del plato y de cuándo se preparó; no se inventa una fecha de seguridad.</div></div><button className="primary modal-save" disabled={!preparedName.trim()} onClick={savePrepared}>Guardar preparado</button></div></div>}
 </section>
}

function Finanzas({state,setState,available}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;available:number}){
 const pct=Math.min(100,Math.round(state.spent/Math.max(1,state.budget)*100));
 const priced=state.inventory.filter(i=>typeof i.price==="number"&&i.price!>0);
 const knownSpend=priced.reduce((n,i)=>n+(i.price||0),0);
 const byCat=priced.reduce<Record<string,number>>((a,i)=>{a[i.category]=(a[i.category]||0)+(i.price||0);return a},{});
 const fresh=(byCat["Carne"]||0)+(byCat["Fruta y verdura"]||0)+(byCat["Lácteos"]||0);
 const pantry=byCat["Despensa"]||0, prepared=byCat["Preparados"]||0, other=Math.max(0,knownSpend-fresh-pantry-prepared);
 const denom=Math.max(1,knownSpend);
 const parts=[fresh,pantry,prepared,other].map(x=>Math.round(x/denom*100));
 return <section className="stack">
  <div className="page-intro"><div><span className="eyebrow">FINANZAS</span><h2>Útil si quieres mirarlo, invisible si no</h2><p>El modo orientativo usa tickets e histórico. El preciso puede pedir el total si falta.</p></div><div className="mode-row compact"><button className={state.profile.financeMode==="orientativo"?"active":""} onClick={()=>setState(s=>({...s,profile:{...s.profile,financeMode:"orientativo"}}))}>Orientativo</button><button className={state.profile.financeMode==="preciso"?"active":""} onClick={()=>setState(s=>({...s,profile:{...s.profile,financeMode:"preciso"}}))}>Preciso</button></div></div>
  <div className="finance-grid"><article className="finance-main"><small>GASTO DEL MES</small><strong>{state.spent.toFixed(2)} €</strong><div className="progress"><span style={{width:`${pct}%`}}/></div><div className="finance-row"><span>Presupuesto</span><b>{state.budget.toFixed(0)} €</b></div><div className="finance-row"><span>Disponible</span><b>{available.toFixed(2)} €</b></div></article><article className="soft-card green"><small>AHORRO VS PRESUPUESTO</small><strong>{Math.max(0,available).toFixed(0)} €</strong><p>Orientativo hasta cerrar el mes.</p></article><article className="soft-card amber"><small>DESPERDICIO REGISTRADO</small><strong>{state.waste.toFixed(2)} €</strong><p>Separado del ahorro para no inflar cifras.</p></article></div>
  <article className="chart-card"><div className="chart-head"><div><small>EVOLUCIÓN</small><h3>Control mensual</h3></div><strong>{pct}%</strong></div><div className="finance-history-empty"><strong>Historial mensual en construcción</strong><p>Se activará cuando existan varios meses de compras registradas. Así evitamos dibujar una tendencia falsa.</p></div></article>
  <div className="finance-visual-grid">
    <article className="finance-donut-card"><div className="donut" style={{background:`conic-gradient(#507a61 0 ${parts[0]}%,#89aa93 ${parts[0]}% ${parts[0]+parts[1]}%,#d4b06b ${parts[0]+parts[1]}% ${parts[0]+parts[1]+parts[2]}%,#c98d89 ${parts[0]+parts[1]+parts[2]}% 100%)`}}><div><strong>{state.spent.toFixed(0)}€</strong><span>total</span></div></div><div><small>PRODUCTOS CON PRECIO CONOCIDO</small><h3>Distribución registrada</h3><ul><li><i className="dot d1"/>Frescos <b>{parts[0]}%</b></li><li><i className="dot d2"/>Despensa <b>{parts[1]}%</b></li><li><i className="dot d3"/>Preparados <b>{parts[2]}%</b></li><li><i className="dot d4"/>Otros <b>{parts[3]}%</b></li></ul></div></article>
    <article className="finance-insight-card"><small>RESUMEN DEL MES</small><h3>{available>=0?"Vas dentro del presupuesto":"Has superado el presupuesto"}</h3><p>{knownSpend>0?"La distribución se calcula solo con productos cuyo precio conocemos. ":"Todavía faltan precios suficientes para repartir el gasto por categorías. "}El desperdicio registrado representa aproximadamente {(state.waste/Math.max(1,state.spent)*100).toFixed(1)}% del gasto.</p><div className="finance-kpis"><span><b>{Math.max(0,available).toFixed(0)}€</b> margen</span><span><b>{state.waste.toFixed(0)}€</b> desperdicio</span><span><b>{pct}%</b> presupuesto usado</span></div></article>
  </div>
  <article className="budget-editor"><div><h3>Presupuesto mensual</h3><p>Opcional. Puedes usar HomeOS sin definirlo.</p></div><div className="budget-control"><input type="number" value={state.budget} onChange={e=>setState(s=>({...s,budget:Math.max(0,Number(e.target.value)||0)}))}/><span>€ / mes</span></div></article>
 </section>
}

function ProfileModal({state,setState,close}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;close:()=>void}){
 const [draft,setDraft]=useState<AppState>(state);
 const [tab,setTab]=useState<"miembros"|"ajustes">("miembros");
 function updateMember(id:string,patch:Partial<Member>){setDraft(s=>({...s,members:s.members.map(m=>m.id===id?{...m,...patch}:m)}))}
 function save(){setState(draft);close()}
 const members=draft.members.slice(0,draft.profile.householdSize);
 return <div className="modal-backdrop" onMouseDown={close}><div className="modal household-modal" onMouseDown={e=>e.stopPropagation()}>
  <div className="modal-head"><div><span className="eyebrow">MI HOGAR</span><h2>Configurar cómo vive y come cada persona</h2><p>Esto cambia recetas, cantidades y estimaciones de consumo.</p></div><button onClick={close}>×</button></div>
  <div className="profile-tabs"><button className={tab==="miembros"?"active":""} onClick={()=>setTab("miembros")}>Personas</button><button className={tab==="ajustes"?"active":""} onClick={()=>setTab("ajustes")}>Preferencias</button></div>
  {tab==="miembros"?<div className="member-profile-grid">{members.map((m,i)=><article className="member-profile-card" key={m.id}>
    <div className="member-title"><span>{m.name.slice(0,1).toUpperCase()}</span><div><input value={m.name} onChange={e=>updateMember(m.id,{name:e.target.value})}/><small>{m.relation||"Miembro "+(i+1)}</small></div></div>
    <label><span>Rutina</span><select value={m.presence} onChange={e=>updateMember(m.id,{presence:e.target.value as Member["presence"]})}><option value="casa">Suele comer en casa</option><option value="fuera_dia">Fuera durante el día</option><option value="fines_semana">Sobre todo fines de semana</option><option value="variable">Rutina variable</option></select></label>
    <label><span>Consumo</span><select value={m.appetite} onChange={e=>updateMember(m.id,{appetite:e.target.value as Member["appetite"]})}><option value="poco">Come poco</option><option value="normal">Normal</option><option value="mucho">Come bastante</option></select></label>
    <label className="text-field"><span>No le gusta / evita</span><input value={m.dislikes} onChange={e=>updateMember(m.id,{dislikes:e.target.value})} placeholder="Ej. queso, pescado…"/></label>
    <label className="text-field"><span>Nota útil</span><textarea value={m.notes} onChange={e=>updateMember(m.id,{notes:e.target.value})} placeholder="Ej. come preparados, solo cena en casa…"/></label>
    <div className="member-summary"><b>{presenceText(m.presence)}</b><span>{appetiteText(m.appetite)}</span></div>
   </article>)}</div>:<div className="settings-list">
    <label><span>Personas</span><select value={draft.profile.householdSize} onChange={e=>setDraft(s=>{const householdSize=Number(e.target.value);return {...s,profile:{...s.profile,householdSize},members:ensureMembers(s.members,householdSize)}})}>{[1,2,3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></label>
    <label><span>Cocina</span><select value={draft.profile.cooking} onChange={e=>setDraft(s=>({...s,profile:{...s.profile,cooking:e.target.value as CookingStyle}}))}><option value="rapido">Rápida</option><option value="normal">Normal</option><option value="cocinar">Me gusta cocinar</option><option value="mealprep">Meal prep</option></select></label>
    <label><span>Nutrición</span><select value={draft.profile.nutrition} onChange={e=>setDraft(s=>({...s,profile:{...s.profile,nutrition:e.target.value as NutritionMode}}))}><option value="off">Oculta</option><option value="basica">Básica</option><option value="detallada">Detallada</option></select></label>
    <label><span>Compra habitual</span><select value={draft.profile.shoppingCycle} onChange={e=>setDraft(s=>({...s,profile:{...s.profile,shoppingCycle:e.target.value as Profile["shoppingCycle"]}}))}><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option><option value="mixta">Mixta</option><option value="diaria">Frecuente</option></select></label><div className="profile-market-section"><span>Supermercados habituales</span><div className="profile-market-grid">{SUPERMARKETS.map(m=><button type="button" key={m} className={draft.profile.supermarkets.includes(m)?"active":""} onClick={()=>setDraft(s=>{const supermarkets=s.profile.supermarkets.includes(m)?s.profile.supermarkets.filter(x=>x!==m):[...s.profile.supermarkets,m];return {...s,profile:{...s.profile,supermarkets}}})}>{m}</button>)}</div></div>
   </div>}
  <div className="modal-actions"><button className="secondary" onClick={close}>Cancelar</button><button className="primary" onClick={save}>Guardar hogar</button></div>
 </div></div>
}
