"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type View = "inicio"|"comer"|"comprar"|"casa"|"finanzas";
type StockState = "hay"|"poco"|"falta"|"mucho"|"incierto";
type Location = "Nevera"|"Congelador"|"Despensa"|"Suplementos";
type Goal = "organizar"|"ahorrar"|"desperdicio"|"equilibrio";
type NutritionMode = "basica"|"detallada"|"off";
type CookingStyle = "rapido"|"normal"|"cocinar"|"mealprep";

type InventoryItem = {
  id:string; name:string; qty:number; unit:string; location:Location; category:string;
  stock:StockState; purchasedAt:string; expires?:string; dateType?:"caducidad"|"preferente";
  price?:number; servings?:number;
};
type ShoppingItem = {
  id:string; name:string; qty:number; unit:string; category:string; supermarket?:string;
  requestedBy:string; reason:"persona"|"recomienda"|"receta"|"reposicion"; status:"pendiente"|"carrito";
};
type Member = {id:string;name:string};
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

const SUPERMARKETS=["Mercadona","Lidl","Aldi","Carrefour","Alcampo","Dia","Consum","Bonpreu / Esclat","Caprabo","Eroski","Condis","Carnicería","Frutería"];
const CATEGORIES=["Todos","Lácteos","Carne","Fruta y verdura","Despensa","Preparados","Suplementos"];
const LOCATIONS=["Todo","Nevera","Congelador","Despensa","Suplementos"];

const RECIPES:Recipe[]=[
 {id:"r1",title:"Hamburguesa casera",image:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1400&q=85",time:20,difficulty:"Fácil",mode:["rapido","normal"],servings:4,calories:620,protein:36,carbs:52,fat:28,description:"Rápida y pensada para aprovechar lo que ya tienes.",ingredients:[{name:"Hamburguesas",qty:"4 uds",key:"hamburguesas"},{name:"Queso",qty:"4 lonchas",key:"queso"},{name:"Pan de hamburguesa",qty:"4 uds",key:"pan"},{name:"Tomates",qty:"2 uds",key:"tomate"}],steps:["Calienta una sartén a fuego medio-alto.","Cocina las hamburguesas 3–4 min por lado.","Añade el queso al final.","Monta con pan y tomate y sirve."]},
 {id:"r2",title:"Pasta cremosa con queso",image:"https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1400&q=85",time:18,difficulty:"Fácil",mode:["rapido","normal"],servings:4,calories:540,protein:22,carbs:76,fat:15,description:"Una comida de despensa sencilla y rápida.",ingredients:[{name:"Pasta",qty:"320 g",key:"pasta"},{name:"Queso",qty:"120 g",key:"queso"},{name:"Leche",qty:"200 ml",key:"leche"}],steps:["Cuece la pasta.","Calienta la leche a fuego suave.","Añade el queso y remueve.","Mezcla con la pasta y ajusta de sal."]},
 {id:"r3",title:"Pollo con arroz y verduras",image:"https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=1400&q=85",time:30,difficulty:"Fácil",mode:["normal","mealprep","cocinar"],servings:5,calories:585,protein:46,carbs:64,fat:16,description:"Ideal para varias raciones y para llevar fuera de casa.",ingredients:[{name:"Pollo",qty:"800 g",key:"pollo"},{name:"Arroz",qty:"350 g",key:"arroz"},{name:"Tomates",qty:"3 uds",key:"tomate"}],steps:["Corta y dora el pollo.","Cuece el arroz por separado.","Saltea las verduras o tomate.","Reparte en raciones y deja enfriar antes de guardar."]},
 {id:"r4",title:"Batido de plátano y proteína",image:"https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=1400&q=85",time:5,difficulty:"Fácil",mode:["rapido","mealprep"],servings:1,calories:390,protein:32,carbs:48,fat:8,description:"Batido rápido; los suplementos se integran como cualquier otro ingrediente.",ingredients:[{name:"Leche",qty:"250 ml",key:"leche"},{name:"Plátano",qty:"1 ud",key:"platano"},{name:"Proteína whey",qty:"30 g",key:"proteina"}],steps:["Añade todos los ingredientes a la batidora.","Tritura 30–45 segundos.","Ajusta textura con leche o agua."]},
 {id:"r5",title:"Tortitas para aprovechar leche",image:"https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=1400&q=85",time:22,difficulty:"Fácil",mode:["normal","cocinar"],servings:4,calories:430,protein:17,carbs:58,fat:14,description:"Buena opción cuando tienes leche de sobra.",ingredients:[{name:"Leche",qty:"500 ml",key:"leche"},{name:"Huevos",qty:"3 uds",key:"huevo"},{name:"Harina",qty:"300 g",key:"harina"}],steps:["Mezcla huevos y leche.","Añade harina poco a poco.","Cocina porciones en sartén antiadherente.","Sirve y guarda las sobrantes."]}
];

const DEFAULT:AppState={
 inventory:[
  {id:"i1",name:"Leche semidesnatada",qty:3,unit:"L",location:"Despensa",category:"Lácteos",stock:"hay",purchasedAt:"2026-10-01",expires:"2027-02-20",dateType:"preferente",price:3.2},
  {id:"i2",name:"Yogures naturales",qty:2,unit:"uds",location:"Nevera",category:"Lácteos",stock:"poco",purchasedAt:"2026-10-02",expires:"2026-10-09",dateType:"preferente",price:1.8},
  {id:"i3",name:"Hamburguesas",qty:4,unit:"uds",location:"Nevera",category:"Carne",stock:"hay",purchasedAt:"2026-10-03",expires:"2026-10-07",dateType:"caducidad",price:5.8},
  {id:"i4",name:"Queso lonchas",qty:6,unit:"lonchas",location:"Nevera",category:"Lácteos",stock:"hay",purchasedAt:"2026-10-02",expires:"2026-10-12",dateType:"preferente",price:2.4},
  {id:"i5",name:"Pasta",qty:1,unit:"kg",location:"Despensa",category:"Despensa",stock:"hay",purchasedAt:"2026-09-15",expires:"2027-05-01",dateType:"preferente",price:1.6},
  {id:"i6",name:"Pollo",qty:600,unit:"g",location:"Congelador",category:"Carne",stock:"hay",purchasedAt:"2026-09-28",price:6.4},
  {id:"i7",name:"Proteína whey",qty:18,unit:"servicios",location:"Suplementos",category:"Suplementos",stock:"hay",purchasedAt:"2026-09-20",expires:"2027-08-01",dateType:"preferente",price:24}
 ],
 shopping:[
  {id:"s1",name:"Tomates",qty:4,unit:"uds",category:"Fruta y verdura",requestedBy:"Casa",reason:"recomienda",status:"pendiente"},
  {id:"s2",name:"Pan de hamburguesa",qty:1,unit:"pack",category:"Despensa",supermarket:"Mercadona",requestedBy:"Tú",reason:"receta",status:"pendiente"},
  {id:"s3",name:"Leche semidesnatada",qty:2,unit:"L",category:"Lácteos",supermarket:"Lidl",requestedBy:"Papá",reason:"persona",status:"pendiente"}
 ],
 members:[{id:"m1",name:"Tú"},{id:"m2",name:"Mamá"},{id:"m3",name:"Papá"},{id:"m4",name:"Hermano"}],
 events:[{id:"e1",title:"Navidad",date:"2026-12-25"}],
 budget:800,spent:486.35,waste:18.4,wasteSaved:27.6,
 profile:{householdSize:4,supermarkets:["Mercadona","Lidl"],mainSupermarket:"Mercadona",goals:["organizar","desperdicio"],nutrition:"basica",cooking:"rapido",shoppingCycle:"semanal",notifications:true,onboardingDone:false,financeMode:"orientativo"}
};

function loadState():AppState{
 if(typeof window==="undefined") return DEFAULT;
 try{const x=JSON.parse(localStorage.getItem("homeos:v5")||"{}");return {...DEFAULT,...x,profile:{...DEFAULT.profile,...x.profile},members:x.members||DEFAULT.members,events:x.events||DEFAULT.events,inventory:x.inventory||DEFAULT.inventory,shopping:x.shopping||DEFAULT.shopping};}catch{return DEFAULT}
}
function daysUntil(date?:string){if(!date)return 999;const d=new Date(date+"T12:00:00");return Math.ceil((d.getTime()-Date.now())/86400000)}
function fmtDate(){return new Intl.DateTimeFormat("es-ES",{weekday:"long",day:"numeric",month:"long"}).format(new Date())}
function norm(s:string){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function hasInv(inv:InventoryItem[],key:string){const k=norm(key);return inv.some(i=>i.stock!=="falta"&&(norm(i.name).includes(k)||k.includes(norm(i.name).split(" ")[0])))}
function missing(recipe:Recipe,inv:InventoryItem[]){return recipe.ingredients.filter(x=>!hasInv(inv,x.key))}
function score(recipe:Recipe,inv:InventoryItem[]){return recipe.ingredients.length-missing(recipe,inv).length}
function reasonText(r:ShoppingItem["reason"]){return r==="persona"?"Pedido por":r==="recomienda"?"HomeOS recomienda":r==="receta"?"Añadido desde receta":"Reposición probable"}
function statusLabel(s:StockState){return s==="hay"?"Hay":s==="poco"?"Queda poco":s==="falta"?"Probablemente falta":s==="mucho"?"Hay bastante":"Revisar"}
function logo(){return <div className="logo-mark" aria-label="HomeOS"><svg viewBox="0 0 64 64" role="img"><path d="M10 29 32 11l22 18v24a5 5 0 0 1-5 5H15a5 5 0 0 1-5-5Z"/><path className="cut" d="M20 25h7v10h10V25h7v25h-7v-9H27v9h-7z"/><ellipse className="spoon" cx="32" cy="28" rx="4.3" ry="5.4"/><rect className="spoon" x="30.5" y="32" width="3" height="14" rx="1.5"/></svg></div>}

const nav:{id:View;label:string;icon:string}[]=[
 {id:"inicio",label:"Inicio",icon:"⌂"},{id:"comer",label:"Comer",icon:"◉"},{id:"comprar",label:"Comprar",icon:"🛒"},{id:"casa",label:"Casa",icon:"⌑"},{id:"finanzas",label:"Finanzas",icon:"€"}
];

export default function HomeOS(){
 const [view,setView]=useState<View>("inicio");
 const [state,setState]=useState<AppState>(DEFAULT);
 const [toast,setToast]=useState("");
 const [profileOpen,setProfileOpen]=useState(false);
 const [activeStore,setActiveStore]=useState("");
 const [shoppingActive,setShoppingActive]=useState(false);
 const cameraRef=useRef<HTMLInputElement>(null),galleryRef=useRef<HTMLInputElement>(null),receiptRef=useRef<HTMLInputElement>(null);

 useEffect(()=>setState(loadState()),[]);
 useEffect(()=>{if(typeof window!=="undefined")localStorage.setItem("homeos:v5",JSON.stringify(state))},[state]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(""),2400);return()=>clearTimeout(t)},[toast]);

 const expiring=useMemo(()=>state.inventory.filter(i=>daysUntil(i.expires)<=3&&i.stock!=="falta"),[state.inventory]);
 const available=state.budget-state.spent;
 const confidence=state.inventory.filter(i=>i.stock!=="incierto").length/Math.max(1,state.inventory.length);

 function addFromRecipe(recipe:Recipe){
  const miss=missing(recipe,state.inventory);
  if(!miss.length){setToast("Tienes todo para esta receta");return}
  setState(s=>({...s,shopping:[...s.shopping,...miss.filter(m=>!s.shopping.some(q=>norm(q.name).includes(norm(m.key)))).map(m=>({id:crypto.randomUUID(),name:m.name,qty:1,unit:"ud",category:"Despensa",requestedBy:"Casa",reason:"receta" as const,status:"pendiente" as const}))]}));
  setToast(`${miss.length} ingredientes añadidos a la compra`);
 }

 function finishShopping(){
  const cart=state.shopping.filter(i=>i.status==="carrito");
  if(!cart.length){setToast("Todavía no hay productos en el carrito");return}
  const today=new Date().toISOString().slice(0,10);
  const additions:InventoryItem[]=cart.map(x=>({id:crypto.randomUUID(),name:x.name,qty:x.qty,unit:x.unit,location:x.category==="Lácteos"||x.category==="Carne"?"Nevera":"Despensa",category:x.category,stock:"hay",purchasedAt:today}));
  setState(s=>({...s,inventory:[...additions,...s.inventory],shopping:s.shopping.filter(i=>i.status!=="carrito")}));
  setShoppingActive(false);setActiveStore("");setToast(`${cart.length} productos guardados como compra reciente`);
 }

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
  {toast&&<div className="toast">{toast}</div>}
 </div>
}

function Onboarding({state,setState}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>}){
 const [step,setStep]=useState(0);
 const toggleGoal=(g:Goal)=>setState(s=>({...s,profile:{...s.profile,goals:s.profile.goals.includes(g)?s.profile.goals.filter(x=>x!==g):[...s.profile.goals,g]}}));
 const toggleMarket=(m:string)=>setState(s=>({...s,profile:{...s.profile,supermarkets:s.profile.supermarkets.includes(m)?s.profile.supermarkets.filter(x=>x!==m):[...s.profile.supermarkets,m],mainSupermarket:s.profile.mainSupermarket||m}}));
 return <div className="onboarding"><div className="onboarding-card">
  <div className="onboarding-progress"><span style={{width:`${((step+1)/6)*100}%`}}/></div>
  {step===0&&<div className="ob-panel"><span className="eyebrow">PRIMERA CONFIGURACIÓN</span><h1>¿Cuántas personas viven en casa?</h1><p>HomeOS adapta cantidades y nivel de incertidumbre al tamaño del hogar.</p><div className="number-grid">{[1,2,3,4,5,6].map(n=><button key={n} className={state.profile.householdSize===n?"choice active":"choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,householdSize:n}}))}>{n}</button>)}</div></div>}
  {step===1&&<div className="ob-panel"><span className="eyebrow">RITMO DE COMPRA</span><h1>¿Cómo soléis comprar?</h1><div className="goal-grid">{[["diaria","Casi cada día"],["semanal","Compra semanal"],["quincenal","Cada dos semanas"],["mensual","Compra grande mensual"],["mixta","Compra grande + compras rápidas"]].map(([id,label])=><button key={id} className={state.profile.shoppingCycle===id?"goal-choice active":"goal-choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,shoppingCycle:id as Profile["shoppingCycle"]}}))}><strong>{label}</strong></button>)}</div></div>}
  {step===2&&<div className="ob-panel"><span className="eyebrow">COCINA</span><h1>¿Cómo quieres cocinar normalmente?</h1><div className="goal-grid">{[["rapido","Voy con prisas","Ideas de 5–20 min."],["normal","Cocino normal","Equilibrio entre tiempo y variedad."],["cocinar","Me gusta cocinar","Recetas más completas."],["mealprep","Preparo varios días","Raciones, nevera y congelador."]].map(([id,label,desc])=><button key={id} className={state.profile.cooking===id?"goal-choice active":"goal-choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,cooking:id as CookingStyle}}))}><strong>{label}</strong><span>{desc}</span></button>)}</div></div>}
  {step===3&&<div className="ob-panel"><span className="eyebrow">NUTRICIÓN</span><h1>¿Cuánta información quieres ver?</h1><div className="goal-grid">{[["off","Solo cocina e inventario","Sin gráficos nutricionales."],["basica","Hábitos sencillos","Tendencias semanales sin contar cada caloría."],["detallada","Nutrición detallada","Calorías y macros en recetas y análisis."]].map(([id,label,desc])=><button key={id} className={state.profile.nutrition===id?"goal-choice active":"goal-choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,nutrition:id as NutritionMode}}))}><strong>{label}</strong><span>{desc}</span></button>)}</div></div>}
  {step===4&&<div className="ob-panel"><span className="eyebrow">PRIORIDADES</span><h1>¿Qué quieres mejorar?</h1><p>Puedes marcar varias.</p><div className="market-grid">{[["organizar","Organizar la cocina"],["ahorrar","Ahorrar"],["desperdicio","Desperdiciar menos"],["equilibrio","Comer más equilibrado"]].map(([id,label])=><button key={id} className={state.profile.goals.includes(id as Goal)?"choice active":"choice"} onClick={()=>toggleGoal(id as Goal)}>{label}</button>)}</div></div>}
  {step===5&&<div className="ob-panel"><span className="eyebrow">TIENDAS</span><h1>¿Dónde compráis?</h1><p>Puedes cambiarlo después. También admitimos carnicerías y tiendas de barrio.</p><div className="market-grid">{SUPERMARKETS.map(m=><button key={m} className={state.profile.supermarkets.includes(m)?"choice active":"choice"} onClick={()=>toggleMarket(m)}>{m}</button>)}</div></div>}
  <div className="ob-actions"><button className="secondary" disabled={step===0} onClick={()=>setStep(x=>Math.max(0,x-1))}>Atrás</button>{step<5?<button className="primary" onClick={()=>setStep(x=>x+1)}>Continuar</button>:<button className="primary" onClick={()=>setState(s=>({...s,profile:{...s.profile,onboardingDone:true}}))}>Entrar en HomeOS</button>}</div>
 </div></div>
}

function Inicio({state,setState,expiring,confidence,available,setView}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;expiring:InventoryItem[];confidence:number;available:number;setView:(v:View)=>void}){
 const next=state.events.slice().sort((a,b)=>a.date.localeCompare(b.date))[0];
 const recommended=state.shopping.filter(i=>i.reason==="recomienda"&&i.status==="pendiente").length;
 return <section className="stack">
  <div className="dashboard-hero"><div><span className="eyebrow">HOMEOS HOY</span><h2>Tu cocina, sin tener que saberlo todo</h2><p>{recommended? `${recommended} productos podrían necesitar reposición.`:"No hay ninguna compra urgente detectada."}</p></div><div className="confidence-pill"><span>Inventario</span><strong>{confidence>.8?"Bastante actualizado":confidence>.55?"Orientativo":"Necesita revisión"}</strong></div></div>
  <div className="hero-grid">
   <button className="decision-card photo-card" onClick={()=>setView("comer")}><img src={RECIPES[0].image} alt="Idea para comer"/><div className="photo-overlay"><small>QUÉ COMEMOS</small><h2>Ideas con lo que tienes</h2><p>Rápidas, útiles y conectadas al inventario.</p></div></button>
   <button className="decision-card blue" onClick={()=>setView("comprar")}><span className="decision-icon">🛒</span><div><small>PRÓXIMA COMPRA</small><h2>{state.shopping.filter(x=>x.status==="pendiente").length} pendientes</h2><p>HomeOS separa pedido, recomendación y receta.</p></div><b>›</b></button>
  </div>
  <div className="card-grid four">
   <article className="soft-card amber"><small>CADUCA PRONTO</small><strong>{expiring.length}</strong><p>{expiring[0]?.name||"Nada urgente"}</p></article>
   <article className="soft-card green"><small>DISPONIBLE MES</small><strong>{available.toFixed(0)} €</strong><p>Seguimiento {state.profile.financeMode}</p></article>
   <article className="soft-card blue-soft"><small>APROVECHAR</small><strong>{state.inventory.filter(i=>i.stock==="mucho").length||1}</strong><p>Productos que puedes gastar mejor</p></article>
   <article className="soft-card rose"><small>PRÓXIMO EVENTO</small><strong>{next?new Date(next.date+"T12:00:00").getDate():"—"}</strong><p>{next?.title||"Sin eventos"}</p></article>
  </div>
  <CalendarCard state={state} setState={setState}/>
 </section>
}

function CalendarCard({state,setState}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>}){
 const now=new Date(),year=now.getFullYear(),month=now.getMonth(),days=new Date(year,month+1,0).getDate(),blank=(new Date(year,month,1).getDay()+6)%7;
 const [title,setTitle]=useState(""),[date,setDate]=useState("");
 const add=()=>{if(!title||!date)return;setState(s=>({...s,events:[...s.events,{id:crypto.randomUUID(),title,date}]}));setTitle("");setDate("")};
 return <article className="calendar-card"><div className="calendar-head"><div><small>CALENDARIO DEL HOGAR</small><h3>{new Intl.DateTimeFormat("es-ES",{month:"long",year:"numeric"}).format(now)}</h3></div><div className="event-add"><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Evento"/><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><button onClick={add}>Añadir</button></div></div><div className="calendar-week">{["L","M","X","J","V","S","D"].map(x=><b key={x}>{x}</b>)}</div><div className="calendar-grid">{Array.from({length:blank}).map((_,i)=><span key={"b"+i}/>)}{Array.from({length:days}).map((_,i)=>{const d=i+1,iso=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`,ev=state.events.find(e=>e.date===iso);return <div className={ev?"calendar-day has-event":"calendar-day"} key={d}><b>{d}</b>{ev&&<small>{ev.title}</small>}</div>})}</div></article>
}

function Comer({state,setState,addFromRecipe}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;addFromRecipe:(r:Recipe)=>void}){
 const [mode,setMode]=useState<CookingStyle>(state.profile.cooking);
 const [tab,setTab]=useState<"ideas"|"habitos">("ideas");
 const [index,setIndex]=useState(0);
 const [open,setOpen]=useState(false);
 const [useMuch,setUseMuch]=useState("");
 const options=RECIPES.filter(r=>r.mode.includes(mode)).sort((a,b)=>score(b,state.inventory)-score(a,state.inventory));
 const pool=options.length?options:RECIPES;
 const recipe=pool[index%pool.length],miss=missing(recipe,state.inventory);
 const filtered=useMuch?RECIPES.filter(r=>r.ingredients.some(i=>norm(i.name).includes(norm(useMuch)))):[];

 function completeRecipe(){
  const missNames=miss.map(m=>m.key);
  setState(s=>({...s,inventory:s.inventory.map(i=>missNames.some(k=>norm(i.name).includes(norm(k)))?i:{...i,stock:i.stock==="poco"?"falta":i.stock==="hay"?"poco":i.stock})}));
  setOpen(false);
 }
 return <section className="stack">
  <div className="page-intro"><div><span className="eyebrow">COMER</span><h2>Decidir qué comer debería llevar segundos</h2><p>HomeOS usa inventario, tiempo y preferencias. Si falta algo, lo manda a la compra.</p></div><div className="view-tabs"><button className={tab==="ideas"?"active":""} onClick={()=>setTab("ideas")}>Ideas</button>{state.profile.nutrition!=="off"&&<button className={tab==="habitos"?"active":""} onClick={()=>setTab("habitos")}>Hábitos</button>}</div></div>
  {tab==="ideas"?<>
   <div className="mode-row">{[["rapido","Rápido"],["normal","Normal"],["cocinar","Cocinar"],["mealprep","Meal prep"]].map(([id,label])=><button key={id} className={mode===id?"active":""} onClick={()=>{setMode(id as CookingStyle);setIndex(0)}}>{label}</button>)}</div>
   <article className="featured-meal"><img src={recipe.image} alt={recipe.title}/><div className="featured-copy"><span className="eyebrow">{miss.length?"TE FALTA POCO":"PUEDES HACERLO YA"}</span><h3>{recipe.title}</h3><p>{recipe.description}</p><div className="chips"><span>{recipe.time} min</span><span>{recipe.difficulty}</span><span>{recipe.servings} raciones</span></div><div className="macro-row"><b>{recipe.calories} kcal</b><span>{recipe.protein}g proteína</span><span>{recipe.carbs}g carbos</span><span>{recipe.fat}g grasas</span><small>por ración · estimación</small></div><div className="meal-actions"><button className="primary" onClick={()=>setOpen(true)}>Preparar receta</button><button className="secondary" onClick={()=>setIndex(i=>i+1)}>Otra idea</button></div></div></article>
   <div className="ingredient-summary"><article><small>TIENES</small>{recipe.ingredients.filter(i=>!miss.some(m=>m.name===i.name)).map(i=><span key={i.name}>✓ {i.name}</span>)}</article><article><small>TE FALTA</small>{miss.length?miss.map(i=><span key={i.name}>• {i.name}</span>):<span>Todo listo</span>}<button onClick={()=>addFromRecipe(recipe)} disabled={!miss.length}>Añadir faltantes</button></article></div>
   <article className="use-more-card"><div><small>APROVECHAR PRODUCTO</small><h3>¿Tienes demasiado de algo?</h3><p>Escribe un ingrediente y HomeOS prioriza recetas que realmente lo gasten.</p></div><input value={useMuch} onChange={e=>setUseMuch(e.target.value)} placeholder="Ej. leche, tomates, huevos…"/>{useMuch&&<div className="recipe-mini-list">{filtered.slice(0,3).map(r=><button key={r.id} onClick={()=>{setUseMuch("");setMode(r.mode[0]);setIndex(0)}}>{r.title}<span>{r.time} min</span></button>)}</div>}</article>
  </>:<Habitos state={state}/>}
  {open&&<div className="modal-backdrop"><div className="modal recipe-modal"><div className="modal-head"><div><span className="eyebrow">PREPARAR</span><h2>{recipe.title}</h2></div><button onClick={()=>setOpen(false)}>×</button></div><div className="recipe-cols"><div><h4>Ingredientes</h4>{recipe.ingredients.map(i=><p key={i.name}>{i.qty} · {i.name}</p>)}</div><div><h4>Pasos</h4>{recipe.steps.map((s,i)=><p key={s}><b>{i+1}.</b> {s}</p>)}</div></div><div className="recipe-total"><span>Total receta</span><b>≈ {recipe.calories*recipe.servings} kcal · {recipe.protein*recipe.servings}g proteína</b></div><button className="primary modal-save" onClick={completeRecipe}>He terminado</button></div></div>}
 </section>
}

function Habitos({state}:{state:AppState}){
 const data=[["Proteína",76],["Verdura y fruta",58],["Carbohidratos",71],["Dulces / snacks",34]];
 return <div className="habits-grid"><article className="habit-chart"><div><small>ÚLTIMOS 7 DÍAS</small><h3>Patrón estimado del hogar</h3></div>{data.map(([k,v])=><div className="habit-row" key={k}><span>{k}</span><div><b style={{width:`${v}%`}}/></div><strong>{v}%</strong></div>)}</article><article className="habit-note"><span>✦</span><h3>Resumen</h3><p>La proteína se mantiene estable. Esta semana hay menos verdura que en tu media reciente y han aumentado ligeramente los snacks.</p><small>Se calcula con recetas, compras, reposiciones y correcciones. No equivale a un registro clínico.</small></article></div>
}

function Comprar({state,setState,activeStore,setActiveStore,shoppingActive,setShoppingActive,finishShopping,receiptRef,setToast}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;activeStore:string;setActiveStore:(s:string)=>void;shoppingActive:boolean;setShoppingActive:(b:boolean)=>void;finishShopping:()=>void;receiptRef:React.RefObject<HTMLInputElement|null>;setToast:(s:string)=>void}){
 const [quick,setQuick]=useState("");
 const [member,setMember]=useState(state.members[0]?.name||"Tú");
 const [storeFilter,setStoreFilter]=useState("Todos");

 function add(){
  let value=quick.trim();if(!value)return;
  let supermarket:string|undefined;
  const lower=norm(value);
  for(const s of state.profile.supermarkets){if(lower.includes(norm(s))){supermarket=s;value=value.replace(new RegExp(s,"i"),"").trim()}}
  let category="Despensa",unit="ud";
  if(/leche|yogur|queso/.test(lower))category="Lácteos";
  if(/pollo|carne|ternera|cerdo/.test(lower)){category="Carne";unit=/kg|kilo/.test(lower)?"kg":"ud"}
  if(/tomate|fruta|verdura|platano|arándano|arandano/.test(lower))category="Fruta y verdura";
  setState(s=>({...s,shopping:[...s.shopping,{id:crypto.randomUUID(),name:value.charAt(0).toUpperCase()+value.slice(1),qty:1,unit,category,supermarket,requestedBy:member,reason:"persona",status:"pendiente"}]}));
  setQuick("");
 }
 function moveHere(id:string){setState(s=>({...s,shopping:s.shopping.map(i=>i.id===id?{...i,supermarket:activeStore,status:"pendiente"}:i)}))}
 function cart(id:string){setState(s=>({...s,shopping:s.shopping.map(i=>i.id===id?{...i,status:i.status==="carrito"?"pendiente":"carrito"}:i)}))}
 const visible=state.shopping.filter(i=>storeFilter==="Todos"||i.supermarket===storeFilter||(!i.supermarket&&storeFilter==="Cualquiera"));
 const grouped=visible.reduce<Record<string,ShoppingItem[]>>((a,i)=>{(a[i.category]??=[]).push(i);return a},{});
 const other=shoppingActive?state.shopping.filter(i=>i.supermarket&&i.supermarket!==activeStore&&i.status==="pendiente"):[];
 return <section className="stack">
  <div className="shopping-top"><div><span className="eyebrow">LISTA GENERAL</span><h2>{shoppingActive?`Comprando en ${activeStore}`:"Compra compartida"}</h2><p>Primero una lista simple. Cuando entras en una tienda, HomeOS la reorganiza.</p></div>{shoppingActive?<button className="primary" onClick={finishShopping}>Terminar compra</button>:<button className="primary" onClick={()=>setShoppingActive(true)}>Estoy comprando</button>}</div>
  {!shoppingActive?<div className="quick-add smart"><input value={quick} onChange={e=>setQuick(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Ej. leche semidesnatada Lidl, 1 kg pollo…"/><select value={member} onChange={e=>setMember(e.target.value)}>{state.members.slice(0,state.profile.householdSize).map(m=><option key={m.id}>{m.name}</option>)}</select><button onClick={add}>Añadir</button></div>:<div className="store-picker"><span>Estoy en</span>{state.profile.supermarkets.map(s=><button key={s} className={activeStore===s?"active":""} onClick={()=>setActiveStore(s)}>{s}</button>)}</div>}
  {!shoppingActive&&<div className="store-tabs"><button className={storeFilter==="Todos"?"active":""} onClick={()=>setStoreFilter("Todos")}>Todos</button>{state.profile.supermarkets.map(s=><button className={storeFilter===s?"active":""} key={s} onClick={()=>setStoreFilter(s)}>{s}</button>)}<button className={storeFilter==="Cualquiera"?"active":""} onClick={()=>setStoreFilter("Cualquiera")}>Cualquiera</button></div>}
  {shoppingActive&&!activeStore&&<article className="empty-state"><h3>¿En qué tienda estás?</h3><p>Elige una arriba para reorganizar la compra.</p></article>}
  {(!shoppingActive||activeStore)&&<div className="shopping-layout"><div className="category-list">{Object.entries(grouped).map(([cat,items])=><article className="list-card" key={cat}><div className="list-title"><h3>{cat}</h3><span>{items.length}</span></div>{items.filter(i=>!shoppingActive||!i.supermarket||i.supermarket===activeStore).map(i=><div className={i.status==="carrito"?"shop-row checked":"shop-row"} key={i.id}><button className="fake-check" onClick={()=>cart(i.id)}>✓</button><div><strong>{i.name}</strong><small>{reasonText(i.reason)} {i.reason==="persona"?i.requestedBy:""} {i.supermarket?`· ${i.supermarket}`:"· cualquier tienda"}</small></div><b>{i.qty} {i.unit}</b></div>)}</article>)}</div><aside className="purchase-tools"><button className="tool-action" onClick={()=>receiptRef.current?.click()}><span>🧾</span><div><strong>Ticket</strong><p>La IA intentará entender productos, cantidades y total.</p></div></button><input ref={receiptRef} hidden type="file" accept="image/*,.pdf" onChange={e=>{if(e.target.files?.[0])setToast("Ticket recibido para revisión")}}/><article className="tool-card"><span>✦</span><div><strong>HomeOS recomienda</strong><p>{state.shopping.filter(i=>i.reason==="recomienda").length} productos por posible falta.</p></div></article></aside></div>}
  {shoppingActive&&activeStore&&other.length>0&&<article className="other-stores"><div><small>PENDIENTE EN OTRAS TIENDAS</small><h3>También tenías esto apuntado</h3></div>{other.map(i=><div key={i.id}><span><strong>{i.name}</strong><small>{i.supermarket}</small></span><button onClick={()=>moveHere(i.id)}>Traer aquí</button></div>)}</article>}
 </section>
}

function Casa({state,setState,cameraRef,galleryRef,setToast}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;cameraRef:React.RefObject<HTMLInputElement|null>;galleryRef:React.RefObject<HTMLInputElement|null>;setToast:(s:string)=>void}){
 const [loc,setLoc]=useState("Todo"),[cat,setCat]=useState("Todos");
 const shown=state.inventory.filter(i=>(loc==="Todo"||i.location===loc)&&(cat==="Todos"||i.category===cat));
 function setStock(id:string,stock:StockState){setState(s=>({...s,inventory:s.inventory.map(i=>i.id===id?{...i,stock}:i)}))}
 function freeze(id:string){setState(s=>({...s,inventory:s.inventory.map(i=>i.id===id?{...i,location:"Congelador",stock:"hay"}:i)}));setToast("Producto movido al congelador")}
 function addToBuy(i:InventoryItem){setState(s=>({...s,shopping:[...s.shopping,{id:crypto.randomUUID(),name:i.name,qty:1,unit:i.unit,category:i.category,requestedBy:"Casa",reason:"recomienda",status:"pendiente"}]}));setToast("Añadido a recomendaciones de compra")}
 return <section className="stack">
  <div className="page-intro"><div><span className="eyebrow">CASA</span><h2>Una referencia útil, no un inventario imposible</h2><p>HomeOS muestra lo que sabe y reconoce cuando solo puede estimar.</p></div><div className="photo-actions"><button className="secondary" onClick={()=>cameraRef.current?.click()}>Hacer foto</button><button className="secondary" onClick={()=>galleryRef.current?.click()}>Fototeca</button><input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={e=>e.target.files?.[0]&&setToast("Foto recibida para recalibrar inventario")}/><input ref={galleryRef} hidden type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&setToast("Imagen recibida para recalibrar inventario")}/></div></div>
  <div className="inventory-controls"><div className="segmented">{LOCATIONS.map(x=><button key={x} className={loc===x?"active":""} onClick={()=>setLoc(x)}>{x}</button>)}</div><div className="segmented categories">{CATEGORIES.map(x=><button key={x} className={cat===x?"active":""} onClick={()=>setCat(x)}>{x}</button>)}</div></div>
  <div className="inventory-grid">{shown.map(i=><article className="inventory-card" key={i.id}><div className="inventory-top"><span className="food-dot">{i.location==="Nevera"?"❄":i.location==="Congelador"?"◈":i.location==="Suplementos"?"＋":"▦"}</span><span className={`stock-badge ${i.stock}`}>{statusLabel(i.stock)}</span></div><h3>{i.name}</h3><p>{i.stock==="incierto"?"Cantidad estimada":`${i.qty} ${i.unit}`} · {i.location}</p>{i.expires&&<small className={i.dateType==="caducidad"?"date-alert expiry":"date-alert"}>{i.dateType==="caducidad"?"Caduca":"Consumo pref."}: {new Date(i.expires+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</small>}<div className="inventory-actions"><button onClick={()=>setStock(i.id,"falta")}>Se acabó</button><button onClick={()=>setStock(i.id,"poco")}>Queda poco</button>{i.location==="Nevera"&&i.dateType==="caducidad"&&<button onClick={()=>freeze(i.id)}>Congelar</button>}{i.stock==="falta"&&<button onClick={()=>addToBuy(i)}>Comprar</button>}</div></article>)}</div>
 </section>
}

function Finanzas({state,setState,available}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;available:number}){
 const chart=[44,50,57,55,68,74],pct=Math.min(100,Math.round(state.spent/Math.max(1,state.budget)*100));
 return <section className="stack">
  <div className="page-intro"><div><span className="eyebrow">FINANZAS</span><h2>Útil si quieres mirarlo, invisible si no</h2><p>El modo orientativo usa tickets e histórico. El preciso puede pedir el total si falta.</p></div><div className="mode-row compact"><button className={state.profile.financeMode==="orientativo"?"active":""} onClick={()=>setState(s=>({...s,profile:{...s.profile,financeMode:"orientativo"}}))}>Orientativo</button><button className={state.profile.financeMode==="preciso"?"active":""} onClick={()=>setState(s=>({...s,profile:{...s.profile,financeMode:"preciso"}}))}>Preciso</button></div></div>
  <div className="finance-grid"><article className="finance-main"><small>GASTO DEL MES</small><strong>{state.spent.toFixed(2)} €</strong><div className="progress"><span style={{width:`${pct}%`}}/></div><div className="finance-row"><span>Presupuesto</span><b>{state.budget.toFixed(0)} €</b></div><div className="finance-row"><span>Disponible</span><b>{available.toFixed(2)} €</b></div></article><article className="soft-card green"><small>AHORRO VS PRESUPUESTO</small><strong>{Math.max(0,available).toFixed(0)} €</strong><p>Orientativo hasta cerrar el mes.</p></article><article className="soft-card amber"><small>DESPERDICIO REGISTRADO</small><strong>{state.waste.toFixed(2)} €</strong><p>Separado del ahorro para no inflar cifras.</p></article></div>
  <article className="chart-card"><div className="chart-head"><div><small>EVOLUCIÓN</small><h3>Control mensual</h3></div><strong>{pct}%</strong></div><div className="bars">{chart.map((v,i)=><div className="bar-wrap" key={i}><div className="bar" style={{height:`${v}%`}}/><span>{["May","Jun","Jul","Ago","Sep","Oct"][i]}</span></div>)}</div></article>
  <article className="budget-editor"><div><h3>Presupuesto mensual</h3><p>Opcional. Puedes usar HomeOS sin definirlo.</p></div><div className="budget-control"><input type="number" value={state.budget} onChange={e=>setState(s=>({...s,budget:Number(e.target.value)||0}))}/><span>€ / mes</span></div></article>
 </section>
}

function ProfileModal({state,setState,close}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;close:()=>void}){
 return <div className="modal-backdrop" onMouseDown={close}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">MI HOGAR</span><h2>Preferencias</h2></div><button onClick={close}>×</button></div><div className="settings-list"><label><span>Personas</span><select value={state.profile.householdSize} onChange={e=>setState(s=>({...s,profile:{...s.profile,householdSize:Number(e.target.value)}}))}>{[1,2,3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></label><label><span>Cocina</span><select value={state.profile.cooking} onChange={e=>setState(s=>({...s,profile:{...s.profile,cooking:e.target.value as CookingStyle}}))}><option value="rapido">Rápida</option><option value="normal">Normal</option><option value="cocinar">Me gusta cocinar</option><option value="mealprep">Meal prep</option></select></label><label><span>Nutrición</span><select value={state.profile.nutrition} onChange={e=>setState(s=>({...s,profile:{...s.profile,nutrition:e.target.value as NutritionMode}}))}><option value="off">Oculta</option><option value="basica">Básica</option><option value="detallada">Detallada</option></select></label><label><span>Compra habitual</span><select value={state.profile.shoppingCycle} onChange={e=>setState(s=>({...s,profile:{...s.profile,shoppingCycle:e.target.value as Profile["shoppingCycle"]}}))}><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option><option value="mixta">Mixta</option><option value="diaria">Frecuente</option></select></label></div><button className="primary modal-save" onClick={close}>Guardar</button></div></div>
}
