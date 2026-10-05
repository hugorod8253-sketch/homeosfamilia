"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type View = "inicio" | "comer" | "comprar" | "casa" | "finanzas";
type Goal = "ahorrar" | "desperdicio" | "comer-mejor";
type Confidence = "seguro" | "probable" | "duda";
type InventoryItem = { id:string; name:string; qty:number; unit:string; location:string; expires:string; confidence:Confidence; price?:number };
type ShoppingItem = { id:string; name:string; qty:number; checked:boolean; requestedBy?:string; estimated?:boolean; supermarket?:string };
type Profile = { householdSize:number; supermarkets:string[]; mainSupermarket:string; goal:Goal; notifications:boolean; onboardingDone:boolean };
type Member = { id:string; name:string };
type EventItem = { id:string; title:string; date:string };
type Meal = { title:string; subtitle:string; time:string; level:"rápido"|"cocinar"; image:string; ingredients:{name:string;qty:string}[]; steps:string[] };
type AppState = {
  inventory: InventoryItem[];
  shopping: ShoppingItem[];
  budget: number;
  spent: number;
  waste: number;
  wasteSaved: number;
  profile: Profile;
  members: Member[];
  events: EventItem[];
};

const SUPERMARKETS = ["Mercadona","Lidl","Aldi","Carrefour","Alcampo","Dia","Consum","Bonpreu / Esclat","Caprabo","Eroski","Ahorramás","Condis","Gadis","Froiz","Hipercor","Supercor","Costco"];
const GOALS: {id:Goal;label:string;desc:string}[] = [
  {id:"ahorrar",label:"Ahorrar más",desc:"Prioriza gasto, presupuesto y ahorro acumulado."},
  {id:"desperdicio",label:"Desperdiciar menos",desc:"Prioriza caducidades y uso de lo que ya hay."},
  {id:"comer-mejor",label:"Comer mejor",desc:"Prioriza variedad y comidas caseras sencillas."},
];

const MEALS: Meal[] = [
  {title:"Hamburguesa casera",subtitle:"Fácil y pensada para aprovechar lo que ya tienes",time:"20 min",level:"rápido",image:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=85",ingredients:[{name:"Hamburguesas",qty:"4 uds"},{name:"Queso lonchas",qty:"4 lonchas"},{name:"Pan de hamburguesa",qty:"4 uds"},{name:"Tomates",qty:"2 uds"}],steps:["Calienta una sartén.","Cocina las hamburguesas 3-4 minutos por lado.","Añade el queso al final.","Monta con pan y tomate."]},
  {title:"Pasta cremosa con queso",subtitle:"Una opción de despensa sencilla",time:"18 min",level:"rápido",image:"https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1200&q=85",ingredients:[{name:"Pasta",qty:"320 g"},{name:"Queso lonchas",qty:"4 lonchas"},{name:"Leche",qty:"200 ml"}],steps:["Cuece la pasta.","Calienta la leche.","Añade el queso y remueve.","Mezcla con la pasta."]},
  {title:"Bol de yogur rápido",subtitle:"Para comer algo en cinco minutos",time:"5 min",level:"rápido",image:"https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=1200&q=85",ingredients:[{name:"Yogures",qty:"2 uds"}],steps:["Pon el yogur en un bol.","Añade fruta o cereal si tienes.","Mezcla y sirve."]},
  {title:"Hamburguesa completa",subtitle:"Para cuando te apetece cocinar",time:"40 min",level:"cocinar",image:"https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=85",ingredients:[{name:"Hamburguesas",qty:"4 uds"},{name:"Queso lonchas",qty:"4 lonchas"},{name:"Pan de hamburguesa",qty:"4 uds"},{name:"Tomates",qty:"2 uds"},{name:"Cebolla",qty:"1 ud"}],steps:["Pocha la cebolla.","Marca las hamburguesas.","Añade el queso.","Tuesta el pan.","Monta y sirve."]},
];

const DEFAULT: AppState = {
  inventory: [
    {id:"i1",name:"Hamburguesas",qty:4,unit:"uds",location:"Nevera",expires:"2026-10-06",confidence:"seguro",price:5.8},
    {id:"i2",name:"Queso lonchas",qty:6,unit:"lonchas",location:"Nevera",expires:"2026-10-09",confidence:"probable",price:2.4},
    {id:"i3",name:"Yogures",qty:2,unit:"uds",location:"Nevera",expires:"2026-10-07",confidence:"seguro",price:1.8},
    {id:"i4",name:"Leche",qty:3,unit:"L",location:"Despensa",expires:"2026-11-20",confidence:"probable",price:3.2},
    {id:"i5",name:"Pasta",qty:1,unit:"kg",location:"Despensa",expires:"2027-04-01",confidence:"seguro",price:1.5}
  ],
  shopping: [
    {id:"s1",name:"Pan de hamburguesa",qty:1,checked:false,requestedBy:"Mamá"},
    {id:"s2",name:"Tomates",qty:4,checked:false,requestedBy:"Casa"},
    {id:"s3",name:"Leche",qty:2,checked:false,requestedBy:"Papá",estimated:true}
  ],
  budget: 800,
  spent: 486.35,
  waste: 18.40,
  wasteSaved: 27.60,
  profile: {householdSize:4,supermarkets:["Mercadona","Lidl"],mainSupermarket:"Mercadona",goal:"ahorrar",notifications:true,onboardingDone:false},
  members:[{id:"m1",name:"Tú"},{id:"m2",name:"Mamá"},{id:"m3",name:"Papá"},{id:"m4",name:"Casa"}],
  events:[{id:"e1",title:"Navidad",date:"2026-12-25"}]
};

function loadState():AppState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const saved = JSON.parse(localStorage.getItem("homeos:v3") || "{}");
    return {...DEFAULT,...saved,profile:{...DEFAULT.profile,...saved.profile},members:saved.members||DEFAULT.members,events:saved.events||DEFAULT.events};
  } catch { return DEFAULT; }
}

function daysUntil(date:string){
  const now = new Date();
  const target = new Date(date+"T12:00:00");
  return Math.ceil((target.getTime()-now.getTime())/86400000);
}

function formatDate(){
  return new Intl.DateTimeFormat("es-ES",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
}
function hasIngredient(inventory:InventoryItem[],name:string){const n=name.toLowerCase();return inventory.some(i=>i.qty>0&&(i.name.toLowerCase().includes(n)||n.includes(i.name.toLowerCase())))}
function missingIngredients(meal:Meal,inventory:InventoryItem[]){return meal.ingredients.filter(i=>!hasIngredient(inventory,i.name))}
function mealScore(meal:Meal,inventory:InventoryItem[]){return meal.ingredients.length-missingIngredients(meal,inventory).length}

const nav: {id:View; label:string; icon:string}[] = [
  {id:"inicio",label:"Inicio",icon:"⌂"},
  {id:"comer",label:"Comer",icon:"◉"},
  {id:"comprar",label:"Comprar",icon:"🛒"},
  {id:"casa",label:"Casa",icon:"⌑"},
  {id:"finanzas",label:"Finanzas",icon:"€"}
];

export default function HomeOS(){
  const [view,setView] = useState<View>("inicio");
  const [state,setState] = useState<AppState>(DEFAULT);
  const [quick,setQuick] = useState("");
  const [toast,setToast] = useState("");
  const [profileOpen,setProfileOpen] = useState(false);
  const [shoppingActive,setShoppingActive] = useState(false);
  const [mealIndex,setMealIndex] = useState(0);
  const receiptRef = useRef<HTMLInputElement>(null);
  const pantryPhotoRef = useRef<HTMLInputElement>(null);
  const pantryGalleryRef = useRef<HTMLInputElement>(null);

  useEffect(()=>setState(loadState()),[]);
  useEffect(()=>{ if(typeof window!=="undefined") localStorage.setItem("homeos:v3",JSON.stringify(state)); },[state]);
  useEffect(()=>{ if(!toast) return; const t=setTimeout(()=>setToast(""),2400); return()=>clearTimeout(t); },[toast]);

  const expiring = useMemo(()=>state.inventory.filter(i=>daysUntil(i.expires)<=3).sort((a,b)=>daysUntil(a.expires)-daysUntil(b.expires)),[state.inventory]);
  const available = state.budget-state.spent;
  const budgetPct = state.budget > 0 ? Math.min(100,Math.round((state.spent/state.budget)*100)) : 0;

  function addQuick(){
    const value=quick.trim();
    if(!value) return;
    setState(s=>({...s,shopping:[...s.shopping,{id:crypto.randomUUID(),name:value,qty:1,checked:false,requestedBy:"Tú"}]}));
    setQuick(""); setToast("Añadido a la lista");
  }

  function toggleShopping(id:string){
    setState(s=>({...s,shopping:s.shopping.map(i=>i.id===id?{...i,checked:!i.checked}:i)}));
  }

  function startShopping(){
    setShoppingActive(true);
    setToast(state.profile.mainSupermarket ? `Compra iniciada · ${state.profile.mainSupermarket}` : "Compra iniciada");
  }

  function finishShopping(){
    const bought=state.shopping.filter(i=>i.checked);
    if(!bought.length){setToast("Marca lo que has comprado");return;}
    const newInventory: InventoryItem[] = bought.map(i=>({id:crypto.randomUUID(),name:i.name,qty:i.qty,unit:"uds",location:"Por colocar",expires:"2026-10-15",confidence:"seguro"}));
    setState(s=>({...s,inventory:[...newInventory,...s.inventory],shopping:s.shopping.filter(i=>!i.checked)}));
    setShoppingActive(false);
    setToast(`${bought.length} productos añadidos a Casa`);
  }

  function handleReceipt(file?:File){
    if(!file) return;
    setToast("Ticket recibido · listo para analizar en la siguiente capa");
  }

  function handlePantryPhoto(file?:File){
    if(!file) return;
    setToast("Foto recibida · preparada para revisión de inventario");
  }

  if(!state.profile.onboardingDone){
    return <Onboarding state={state} setState={setState} />;
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-dot">H</div><div><strong>HomeOS</strong><span>Familia</span></div></div>
      <nav>{nav.map(n=><button key={n.id} className={view===n.id?"nav active":"nav"} onClick={()=>setView(n.id)}><span>{n.icon}</span>{n.label}</button>)}</nav>
      <button className="profile" onClick={()=>setProfileOpen(true)}><span>FR</span><div><strong>Mi hogar</strong><small>{state.profile.householdSize} personas</small></div></button>
    </aside>

    <main className="main">
      <header className="topbar">
        <div><span className="eyebrow">{formatDate()}</span><h1>{view==="inicio"?"Dashboard":nav.find(n=>n.id===view)?.label}</h1></div>
        <button className="avatar" onClick={()=>setProfileOpen(true)}>FR</button>
      </header>

      {view==="inicio" && <Inicio state={state} setState={setState} expiring={expiring} available={available} budgetPct={budgetPct} setView={setView}/>}
      {view==="comer" && <Comer state={state} setState={setState} mealIndex={mealIndex} setMealIndex={setMealIndex} expiring={expiring}/>}
      {view==="comprar" && <Comprar state={state} setState={setState} quick={quick} setQuick={setQuick} toggleShopping={toggleShopping} shoppingActive={shoppingActive} startShopping={startShopping} finishShopping={finishShopping} receiptRef={receiptRef} handleReceipt={handleReceipt}/>}
      {view==="casa" && <Casa inventory={state.inventory} setState={setState} pantryPhotoRef={pantryPhotoRef} pantryGalleryRef={pantryGalleryRef} handlePantryPhoto={handlePantryPhoto}/>}
      {view==="finanzas" && <Finanzas state={state} setState={setState} available={available} budgetPct={budgetPct}/>}
    </main>

    <nav className="bottom-nav">{nav.map(n=><button key={n.id} className={view===n.id?"active":""} onClick={()=>setView(n.id)}><span>{n.icon}</span><small>{n.label}</small></button>)}</nav>
    {profileOpen && <ProfileModal state={state} setState={setState} close={()=>setProfileOpen(false)}/>}
    {toast&&<div className="toast">{toast}</div>}
  </div>;
}

function Onboarding({state,setState}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>}){
  const [step,setStep]=useState(0);
  const [other,setOther]=useState("");

  function toggleMarket(m:string){
    setState(s=>{
      const has=s.profile.supermarkets.includes(m);
      const supermarkets=has?s.profile.supermarkets.filter(x=>x!==m):[...s.profile.supermarkets,m];
      const mainSupermarket=supermarkets.includes(s.profile.mainSupermarket)?s.profile.mainSupermarket:(supermarkets[0]||"");
      return {...s,profile:{...s.profile,supermarkets,mainSupermarket}};
    });
  }

  function addOther(){
    const value=other.trim();
    if(!value) return;
    setState(s=>({...s,profile:{...s.profile,supermarkets:Array.from(new Set([...s.profile.supermarkets,value])),mainSupermarket:s.profile.mainSupermarket||value}}));
    setOther("");
  }

  return <div className="onboarding">
    <div className="onboarding-card">
      <div className="onboarding-progress"><span style={{width:`${((step+1)/4)*100}%`}}/></div>
      {step===0&&<div className="ob-panel"><span className="eyebrow">CONFIGURACIÓN INICIAL</span><h1>¿Cuántos sois en casa?</h1><p>Solo lo usamos para ajustar cantidades y recomendaciones.</p><div className="number-grid">{[1,2,3,4,5,6].map(n=><button key={n} className={state.profile.householdSize===n?"choice active":"choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,householdSize:n}}))}>{n}</button>)}</div></div>}
      {step===1&&<div className="ob-panel"><span className="eyebrow">SUPERMERCADOS</span><h1>¿Dónde compráis normalmente?</h1><p>Selecciona varios. Así evitamos nombres escritos de formas distintas.</p><div className="market-grid">{SUPERMARKETS.map(m=><button key={m} className={state.profile.supermarkets.includes(m)?"choice active":"choice"} onClick={()=>toggleMarket(m)}>{m}</button>)}</div><div className="other-market"><input value={other} onChange={e=>setOther(e.target.value)} placeholder="Otro supermercado"/><button onClick={addOther}>Añadir</button></div>{state.profile.supermarkets.length>0&&<div className="main-market"><span>Principal</span><select value={state.profile.mainSupermarket} onChange={e=>setState(s=>({...s,profile:{...s.profile,mainSupermarket:e.target.value}}))}>{state.profile.supermarkets.map(m=><option key={m}>{m}</option>)}</select></div>}</div>}
      {step===2&&<div className="ob-panel"><span className="eyebrow">OBJETIVO</span><h1>¿Qué quieres mejorar primero?</h1><p>HomeOS seguirá haciendo todo, pero dará prioridad a esto.</p><div className="goal-grid">{GOALS.map(g=><button key={g.id} className={state.profile.goal===g.id?"goal-choice active":"goal-choice"} onClick={()=>setState(s=>({...s,profile:{...s.profile,goal:g.id}}))}><strong>{g.label}</strong><span>{g.desc}</span></button>)}</div></div>}
      {step===3&&<div className="ob-panel"><span className="eyebrow">RECORDATORIOS</span><h1>¿Quieres avisos útiles?</h1><p>Para caducidades, productos olvidados y compras próximas. Se puede cambiar después.</p><div className="toggle-row"><div><strong>Notificaciones inteligentes</strong><span>Solo cuando haya algo que merezca la pena recordar.</span></div><button className={state.profile.notifications?"switch on":"switch"} onClick={()=>setState(s=>({...s,profile:{...s.profile,notifications:!s.profile.notifications}}))}><span/></button></div></div>}
      <div className="ob-actions"><button className="secondary" disabled={step===0} onClick={()=>setStep(s=>Math.max(0,s-1))}>Atrás</button>{step<3?<button className="primary" onClick={()=>setStep(s=>s+1)}>Continuar</button>:<button className="primary" onClick={()=>setState(s=>({...s,profile:{...s.profile,onboardingDone:true}}))}>Entrar en HomeOS</button>}</div>
    </div>
  </div>;
}

function Inicio({state,setState,expiring,available,budgetPct,setView}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;expiring:InventoryItem[];available:number;budgetPct:number;setView:(v:View)=>void}){
  const goal = GOALS.find(g=>g.id===state.profile.goal)?.label || "Ahorrar";
  return <section className="stack">
    <div className="dashboard-hero">
      <div><span className="eyebrow">HOY · {goal.toUpperCase()}</span><h2>Tu casa, de un vistazo</h2><p>{expiring.length? `Hay ${expiring.length} productos que conviene usar pronto.` : "No hay nada urgente hoy."}</p></div>
      <div className="hero-stat"><span>Disponible este mes</span><strong>{available.toFixed(0)} €</strong></div>
    </div>

    <div className="hero-grid">
      <button className="decision-card photo-card" onClick={()=>setView("comer")}><img src={MEALS[0].image} alt="Comida recomendada"/><div className="photo-overlay"><small>QUÉ COMEMOS</small><h2>Idea para hoy</h2><p>Ver platos que encajan con lo que tienes.</p></div></button>
      <button className="decision-card blue" onClick={()=>setView("comprar")}><span className="decision-icon">🛒</span><div><small>COMPRA</small><h2>{state.shopping.filter(x=>!x.checked).length} pendientes</h2><p>{state.profile.mainSupermarket||"Supermercado principal"}</p></div><b>›</b></button>
    </div>

    <div className="card-grid four">
      <article className="soft-card amber"><small>CADUCA PRONTO</small><strong>{expiring.length}</strong><p>{expiring[0]?.name||"Nada urgente"}</p></article>
      <article className="soft-card green"><small>PRESUPUESTO USADO</small><strong>{budgetPct}%</strong><p>{state.spent.toFixed(0)} € gastados</p></article>
      <article className="soft-card blue-soft"><small>AHORRO POR DESPERDICIO</small><strong>{state.wasteSaved.toFixed(0)} €</strong><p>Estimado este mes</p></article>
      <article className="soft-card rose"><small>PRÓXIMO EVENTO</small><strong>{state.events[0]?new Date(state.events.slice().sort((a,b)=>a.date.localeCompare(b.date))[0].date+"T12:00:00").getDate():"—"}</strong><p>{state.events.slice().sort((a,b)=>a.date.localeCompare(b.date))[0]?.title||"Sin eventos añadidos"}</p></article>
    </div>
      <CalendarCard state={state} setState={setState}/>
  </section>;
}

function CalendarCard({state,setState}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>}){
  const now=new Date(),year=now.getFullYear(),month=now.getMonth(),days=new Date(year,month+1,0).getDate(),blanks=(new Date(year,month,1).getDay()+6)%7;
  const [title,setTitle]=useState(""),[date,setDate]=useState("");
  function add(){if(!title.trim()||!date)return;setState(s=>({...s,events:[...s.events,{id:crypto.randomUUID(),title:title.trim(),date}].sort((x,y)=>x.date.localeCompare(y.date))}));setTitle("");setDate("")}
  return <article className="calendar-card"><div className="calendar-head"><div><small>EVENTOS</small><h3>{new Intl.DateTimeFormat("es-ES",{month:"long",year:"numeric"}).format(now)}</h3></div><div className="event-add"><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Evento"/><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><button onClick={add}>Añadir</button></div></div><div className="calendar-week">{["L","M","X","J","V","S","D"].map(d=><b key={d}>{d}</b>)}</div><div className="calendar-grid">{Array.from({length:blanks}).map((_,i)=><span key={"b"+i}/>)}{Array.from({length:days}).map((_,i)=>{const d=i+1,iso=year+"-"+String(month+1).padStart(2,"0")+"-"+String(d).padStart(2,"0"),ev=state.events.find(e=>e.date===iso);return <div key={d} className={ev?"calendar-day has-event":"calendar-day"}><b>{d}</b>{ev&&<small>{ev.title}</small>}</div>})}</div></article>
}

function Comer({state,setState,mealIndex,setMealIndex,expiring}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;mealIndex:number;setMealIndex:React.Dispatch<React.SetStateAction<number>>;expiring:InventoryItem[]}){
  const [mode,setMode]=useState<"rápido"|"cocinar">("rápido"),[open,setOpen]=useState(false);
  const options=MEALS.filter(m=>m.level===mode).sort((x,y)=>mealScore(y,state.inventory)-mealScore(x,state.inventory));
  const meal=options[mealIndex%Math.max(1,options.length)]||MEALS[0],missing=missingIngredients(meal,state.inventory),have=meal.ingredients.filter(i=>!missing.some(m=>m.name===i.name));
  function addMissing(){setState(s=>({...s,shopping:[...s.shopping,...missing.filter(m=>!s.shopping.some(x=>x.name.toLowerCase()===m.name.toLowerCase())).map(m=>({id:crypto.randomUUID(),name:m.name,qty:1,checked:false,requestedBy:"Receta",supermarket:s.profile.mainSupermarket}))]}))}
  return <section className="stack"><div className="page-intro"><div><span className="eyebrow">IDEA DEL DÍA</span><h2>¿Qué comemos hoy?</h2><p>La recomendación parte del inventario. Si falta algo, aparece antes de cocinar.</p></div><button className="primary" onClick={()=>{setMealIndex(i=>(i+1)%Math.max(1,options.length));setOpen(false)}}>Otra idea</button></div>
  <div className="segmented"><button className={mode==="rápido"?"active":""} onClick={()=>{setMode("rápido");setMealIndex(0)}}>Rápido y fácil</button><button className={mode==="cocinar"?"active":""} onClick={()=>{setMode("cocinar");setMealIndex(0)}}>Quiero cocinar</button></div>
  <article className="featured-meal"><img src={meal.image} alt={meal.title}/><div className="featured-copy"><span className="eyebrow">TIENES {mealScore(meal,state.inventory)} DE {meal.ingredients.length} INGREDIENTES</span><h3>{meal.title}</h3><p>{meal.subtitle}</p><div className="chips"><span>{meal.time}</span><span>{state.profile.householdSize} personas</span><span>{missing.length?"Faltan "+missing.length:"Tienes lo necesario"}</span></div><div className="meal-actions"><button className="primary" onClick={()=>setOpen(true)}>Preparar este plato</button>{missing.length>0&&<button className="secondary" onClick={addMissing}>Añadir faltantes a compra</button>}</div></div></article>
  {open&&<article className="recipe-card"><div className="recipe-head"><div><span className="eyebrow">RECETA</span><h3>{meal.title}</h3></div><button onClick={()=>setOpen(false)}>×</button></div><div className="recipe-columns"><div><h4>Ya tienes</h4>{have.map(i=><p key={i.name}>✓ {i.name} · {i.qty}</p>)}</div><div><h4>Te falta</h4>{missing.length?missing.map(i=><p key={i.name}>+ {i.name} · {i.qty}</p>):<p>✓ Nada imprescindible</p>}</div></div><ol>{meal.steps.map((s,i)=><li key={i}>{s}</li>)}</ol></article>}
  <div className="section-title"><h3>Usa primero</h3><span>Por caducidad</span></div><div className="mini-priority-grid">{expiring.slice(0,4).map(i=><article key={i.id}><strong>{i.name}</strong><span>{i.qty} {i.unit}</span><b>{Math.max(0,daysUntil(i.expires))}d</b></article>)}</div></section>
}

function Comprar({state,setState,quick,setQuick,toggleShopping,shoppingActive,startShopping,finishShopping,receiptRef,handleReceipt}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;quick:string;setQuick:(s:string)=>void;toggleShopping:(id:string)=>void;shoppingActive:boolean;startShopping:()=>void;finishShopping:()=>void;receiptRef:React.RefObject<HTMLInputElement|null>;handleReceipt:(file?:File)=>void}){
  const [market,setMarket]=useState(state.profile.mainSupermarket||state.profile.supermarkets[0]||""),[requester,setRequester]=useState(state.members[0]?.name||"Tú");
  const visible=state.shopping.filter(i=>(i.supermarket||state.profile.mainSupermarket)===market);
  function add(){const v=quick.trim();if(!v)return;setState(s=>({...s,shopping:[...s.shopping,{id:crypto.randomUUID(),name:v,qty:1,checked:false,requestedBy:requester,supermarket:market}]}));setQuick("")}
  return <section className="stack"><div className="shopping-top"><div><span className="eyebrow">COMPRA COLABORATIVA</span><h2>{shoppingActive?"Compra en curso":"Lista de compra"}</h2><p>Productos separados por supermercado y por quién los ha pedido.</p></div>{shoppingActive?<button className="primary" onClick={finishShopping}>Terminar compra</button>:<button className="primary" onClick={startShopping}>Estoy comprando</button>}</div>
  <div className="market-tabs">{state.profile.supermarkets.map(m=><button key={m} className={market===m?"active":""} onClick={()=>setMarket(m)}>{m}<span>{state.shopping.filter(i=>(i.supermarket||state.profile.mainSupermarket)===m&&!i.checked).length}</span></button>)}</div>
  <div className="quick-add advanced"><input value={quick} onChange={e=>setQuick(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Añadir producto…"/><select value={requester} onChange={e=>setRequester(e.target.value)}>{state.members.map(m=><option key={m.id}>{m.name}</option>)}</select><button onClick={add}>Añadir</button></div>
  <div className="shopping-layout"><article className="list-card"><div className="list-title"><h3>{market||"Por comprar"}</h3><span>{visible.filter(i=>!i.checked).length} pendientes</span></div>{visible.length?visible.map(i=><label className={i.checked?"shop-row checked":"shop-row"} key={i.id}><input type="checkbox" checked={i.checked} onChange={()=>toggleShopping(i.id)}/><span className="fake-check">✓</span><div><strong>{i.name}</strong><small>{i.estimated?"Sugerido por consumo":i.requestedBy?"Pedido por "+i.requestedBy:"Lista"}</small></div><b>x{i.qty}</b></label>):<div className="empty-list">No hay productos para este supermercado.</div>}</article><aside className="purchase-tools"><button className="tool-action" onClick={()=>receiptRef.current?.click()}><span>🧾</span><div><strong>Subir ticket</strong><p>Desde foto, fototeca o PDF.</p></div></button><input ref={receiptRef} hidden type="file" accept="image/*,.pdf" onChange={e=>handleReceipt(e.target.files?.[0])}/><article className="tool-card"><span>◎</span><div><strong>Pedido por Casa</strong><p>HomeOS lo ha sugerido por consumo o reposición.</p></div></article></aside></div></section>
}

function Casa({inventory,setState,pantryPhotoRef,pantryGalleryRef,handlePantryPhoto}:{inventory:InventoryItem[];setState:React.Dispatch<React.SetStateAction<AppState>>;pantryPhotoRef:React.RefObject<HTMLInputElement|null>;pantryGalleryRef:React.RefObject<HTMLInputElement|null>;handlePantryPhoto:(file?:File)=>void}){
  const [filter,setFilter]=useState("Todos");
  const shown=inventory.filter(i=>filter==="Todos"||i.location===filter);
  function consume(id:string){setState(s=>({...s,inventory:s.inventory.map(i=>i.id===id?{...i,qty:Math.max(0,i.qty-1),confidence:"seguro" as Confidence}:i).filter(i=>i.qty>0)}));}
  return <section className="stack"><div className="page-intro"><div><span className="eyebrow">CASA</span><h2>Lo que probablemente hay</h2><p>Solo pedimos confirmación cuando realmente importa.</p></div><div className="photo-actions"><button className="secondary" onClick={()=>pantryPhotoRef.current?.click()}>Abrir cámara</button><button className="secondary" onClick={()=>pantryGalleryRef.current?.click()}>Elegir de fototeca</button></div><input ref={pantryPhotoRef} hidden type="file" accept="image/*" capture="environment" onChange={e=>handlePantryPhoto(e.target.files?.[0])}/><input ref={pantryGalleryRef} hidden type="file" accept="image/*" onChange={e=>handlePantryPhoto(e.target.files?.[0])}/></div>
    <div className="segmented">{["Todos","Nevera","Congelador","Despensa"].map(x=><button key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x}</button>)}</div>
    <div className="inventory-grid">{shown.map(i=><article className="inventory-card" key={i.id}><div className="inventory-top"><span className="food-dot">{i.location==="Nevera"?"❄":i.location==="Despensa"?"▦":"□"}</span><span className={`confidence ${i.confidence}`}>{i.confidence}</span></div><h3>{i.name}</h3><p>{i.qty} {i.unit} · {i.location}</p><div className="inventory-bottom"><small>{daysUntil(i.expires)<=3?`Caduca en ${Math.max(0,daysUntil(i.expires))}d`:`Hasta ${i.expires.slice(5).replace("-","/")}`}</small><button onClick={()=>consume(i.id)}>He usado 1</button></div></article>)}</div>
  </section>;
}

function Finanzas({state,setState,available,budgetPct}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;available:number;budgetPct:number}){
  const chart=[42,56,51,68,74,81];
  return <section className="stack">
    <div className="page-intro"><div><span className="eyebrow">FINANZAS</span><h2>Que ahorrar se vea</h2><p>Gasto, desperdicio y ahorro separados para no engañarnos con los números.</p></div></div>
    <div className="finance-grid"><article className="finance-main"><small>GASTO DEL MES</small><strong>{state.spent.toFixed(2)} €</strong><div className="progress"><span style={{width:`${budgetPct}%`}}/></div><div className="finance-row"><span>Presupuesto</span><b>{state.budget.toFixed(0)} €</b></div><div className="finance-row"><span>Disponible</span><b>{available.toFixed(2)} €</b></div></article><article className="soft-card green"><small>AHORRO POR MENOS DESPERDICIO</small><strong>{state.wasteSaved.toFixed(2)} €</strong><p>Estimación acumulada del mes.</p></article><article className="soft-card amber"><small>DESPERDICIO</small><strong>{state.waste.toFixed(2)} €</strong><p>Coste registrado aparte.</p></article></div>
    <article className="chart-card"><div className="chart-head"><div><small>EVOLUCIÓN</small><h3>Ahorro acumulado</h3></div><strong>+{state.wasteSaved.toFixed(0)} €</strong></div><div className="bars">{chart.map((v,i)=><div key={i} className="bar-wrap"><div className="bar" style={{height:`${v}%`}}/><span>{["May","Jun","Jul","Ago","Sep","Oct"][i]}</span></div>)}</div></article>
    <article className="budget-editor"><div><h3>Presupuesto mensual</h3><p>Se puede cambiar cuando quieras.</p></div><div className="budget-control"><input type="number" value={state.budget} onChange={e=>setState(s=>({...s,budget:Number(e.target.value)||0}))}/><span>€ / mes</span></div></article>
  </section>;
}

function ProfileModal({state,setState,close}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;close:()=>void}){
  function rename(id:string,name:string){setState(s=>({...s,members:s.members.map(m=>m.id===id?{...m,name}:m)}))}
  return <div className="modal-backdrop" onMouseDown={close}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">MI HOGAR</span><h2>Perfil y preferencias</h2></div><button onClick={close}>×</button></div><div className="settings-list"><div className="members-editor"><span>Miembros</span>{state.members.slice(0,state.profile.householdSize).map(m=><input key={m.id} value={m.name} onChange={e=>rename(m.id,e.target.value)}/>)}</div><label><span>Supermercado principal</span><select value={state.profile.mainSupermarket} onChange={e=>setState(s=>({...s,profile:{...s.profile,mainSupermarket:e.target.value}}))}>{state.profile.supermarkets.map(m=><option key={m}>{m}</option>)}</select></label><label><span>Objetivo principal</span><select value={state.profile.goal} onChange={e=>setState(s=>({...s,profile:{...s.profile,goal:e.target.value as Goal}}))}>{GOALS.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}</select></label></div><p className="sync-note">Para compartir estos perfiles entre cuatro móviles en tiempo real falta conectar autenticación y base de datos; aquí ya queda preparado el flujo visual.</p><button className="primary modal-save" onClick={close}>Guardar</button></div></div>
}
