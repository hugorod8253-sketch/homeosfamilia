"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type View = "inicio" | "comer" | "comprar" | "casa" | "finanzas";
type Goal = "ahorrar" | "desperdicio" | "comer-mejor";
type Confidence = "seguro" | "probable" | "duda";
type InventoryItem = { id:string; name:string; qty:number; unit:string; location:string; expires:string; confidence:Confidence; price?:number };
type ShoppingItem = { id:string; name:string; qty:number; checked:boolean; requestedBy?:string; estimated?:boolean };
type Profile = { householdSize:number; supermarkets:string[]; mainSupermarket:string; goal:Goal; notifications:boolean; onboardingDone:boolean };
type AppState = {
  inventory: InventoryItem[];
  shopping: ShoppingItem[];
  budget: number;
  spent: number;
  waste: number;
  wasteSaved: number;
  profile: Profile;
};

const SUPERMARKETS = ["Mercadona","Lidl","Aldi","Carrefour","Alcampo","Dia","Consum","Bonpreu / Esclat","Caprabo","Eroski","Ahorramás","Condis","Gadis","Froiz","Hipercor","Supercor","Costco"];
const GOALS: {id:Goal;label:string;desc:string}[] = [
  {id:"ahorrar",label:"Ahorrar más",desc:"Prioriza gasto, presupuesto y ahorro acumulado."},
  {id:"desperdicio",label:"Desperdiciar menos",desc:"Prioriza caducidades y uso de lo que ya hay."},
  {id:"comer-mejor",label:"Comer mejor",desc:"Prioriza variedad y comidas caseras sencillas."},
];

const MEALS = [
  {title:"Hamburguesa casera",subtitle:"Aprovecha hamburguesas y queso",time:"20 min",missing:"Pan y tomate",image:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=85"},
  {title:"Pasta cremosa con tomate",subtitle:"Rápida y con productos de despensa",time:"18 min",missing:"Nada imprescindible",image:"https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1200&q=85"},
  {title:"Boniato con pico de gallo",subtitle:"Ligero, visual y fácil de preparar",time:"30 min",missing:"Boniato y aguacate",image:"https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=85"},
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
  profile: {householdSize:4,supermarkets:["Mercadona","Lidl"],mainSupermarket:"Mercadona",goal:"ahorrar",notifications:true,onboardingDone:false}
};

function loadState():AppState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const saved = JSON.parse(localStorage.getItem("homeos:v3") || "{}");
    return {...DEFAULT,...saved,profile:{...DEFAULT.profile,...saved.profile}};
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

      {view==="inicio" && <Inicio state={state} expiring={expiring} available={available} budgetPct={budgetPct} setView={setView}/>}
      {view==="comer" && <Comer mealIndex={mealIndex} setMealIndex={setMealIndex} expiring={expiring}/>}
      {view==="comprar" && <Comprar state={state} quick={quick} setQuick={setQuick} addQuick={addQuick} toggleShopping={toggleShopping} shoppingActive={shoppingActive} startShopping={startShopping} finishShopping={finishShopping} receiptRef={receiptRef} handleReceipt={handleReceipt}/>}
      {view==="casa" && <Casa inventory={state.inventory} setState={setState} pantryPhotoRef={pantryPhotoRef} handlePantryPhoto={handlePantryPhoto}/>}
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

function Inicio({state,expiring,available,budgetPct,setView}:{state:AppState;expiring:InventoryItem[];available:number;budgetPct:number;setView:(v:View)=>void}){
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
      <article className="soft-card rose"><small>PRÓXIMO EVENTO</small><strong>—</strong><p>Sin eventos añadidos</p></article>
    </div>
  </section>;
}

function Comer({mealIndex,setMealIndex,expiring}:{mealIndex:number;setMealIndex:React.Dispatch<React.SetStateAction<number>>;expiring:InventoryItem[]}){
  const meal=MEALS[mealIndex%MEALS.length];
  return <section className="stack">
    <div className="page-intro"><div><span className="eyebrow">IDEA DEL DÍA</span><h2>¿Qué comemos hoy?</h2><p>Propuestas visuales con prioridad a lo que conviene gastar.</p></div><button className="primary" onClick={()=>setMealIndex(i=>(i+1)%MEALS.length)}>Otra idea</button></div>
    <article className="featured-meal">
      <img src={meal.image} alt={meal.title}/>
      <div className="featured-copy"><span className="eyebrow">RECOMENDADO</span><h3>{meal.title}</h3><p>{meal.subtitle}</p><div className="chips"><span>{meal.time}</span><span>4 personas</span><span>Falta: {meal.missing}</span></div></div>
    </article>
    <div className="section-title"><h3>Usa primero</h3><span>Por caducidad</span></div>
    <div className="mini-priority-grid">{expiring.slice(0,4).map(i=><article key={i.id}><strong>{i.name}</strong><span>{i.qty} {i.unit}</span><b>{Math.max(0,daysUntil(i.expires))}d</b></article>)}</div>
  </section>;
}

function Comprar({state,quick,setQuick,addQuick,toggleShopping,shoppingActive,startShopping,finishShopping,receiptRef,handleReceipt}:{state:AppState;quick:string;setQuick:(s:string)=>void;addQuick:()=>void;toggleShopping:(id:string)=>void;shoppingActive:boolean;startShopping:()=>void;finishShopping:()=>void;receiptRef:React.RefObject<HTMLInputElement|null>;handleReceipt:(file?:File)=>void}){
  return <section className="stack">
    <div className="shopping-top"><div><span className="eyebrow">{state.profile.mainSupermarket||"COMPRA"}</span><h2>{shoppingActive?"Compra en curso":"Lista de compra"}</h2><p>Selecciona, marca y deja que HomeOS haga el resto.</p></div>{shoppingActive?<button className="primary" onClick={finishShopping}>Terminar compra</button>:<button className="primary" onClick={startShopping}>Estoy comprando</button>}</div>
    <div className="quick-add"><input value={quick} onChange={e=>setQuick(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addQuick()} placeholder="Añadir producto…"/><button onClick={addQuick}>Añadir</button></div>
    <div className="shopping-layout"><article className="list-card"><div className="list-title"><h3>Por comprar</h3><span>{state.shopping.filter(i=>!i.checked).length} pendientes</span></div>{state.shopping.map(i=><label className={i.checked?"shop-row checked":"shop-row"} key={i.id}><input type="checkbox" checked={i.checked} onChange={()=>toggleShopping(i.id)}/><span className="fake-check">✓</span><div><strong>{i.name}</strong><small>{i.estimated?"Sugerido por consumo":i.requestedBy?`Pedido por ${i.requestedBy}`:"Lista"}</small></div><b>x{i.qty}</b></label>)}</article>
      <aside className="purchase-tools"><button className="tool-action" onClick={()=>receiptRef.current?.click()}><span>🧾</span><div><strong>Subir ticket</strong><p>Foto o archivo del ticket.</p></div></button><input ref={receiptRef} hidden type="file" accept="image/*,.pdf" onChange={e=>handleReceipt(e.target.files?.[0])}/><article className="tool-card"><span>⌖</span><div><strong>Supermercado</strong><p>{state.profile.mainSupermarket||"Sin seleccionar"}</p></div></article></aside>
    </div>
  </section>;
}

function Casa({inventory,setState,pantryPhotoRef,handlePantryPhoto}:{inventory:InventoryItem[];setState:React.Dispatch<React.SetStateAction<AppState>>;pantryPhotoRef:React.RefObject<HTMLInputElement|null>;handlePantryPhoto:(file?:File)=>void}){
  const [filter,setFilter]=useState("Todos");
  const shown=inventory.filter(i=>filter==="Todos"||i.location===filter);
  function consume(id:string){setState(s=>({...s,inventory:s.inventory.map(i=>i.id===id?{...i,qty:Math.max(0,i.qty-1),confidence:"seguro" as Confidence}:i).filter(i=>i.qty>0)}));}
  return <section className="stack"><div className="page-intro"><div><span className="eyebrow">CASA</span><h2>Lo que probablemente hay</h2><p>Solo pedimos confirmación cuando realmente importa.</p></div><button className="secondary" onClick={()=>pantryPhotoRef.current?.click()}>Actualizar con foto</button><input ref={pantryPhotoRef} hidden type="file" accept="image/*" capture="environment" onChange={e=>handlePantryPhoto(e.target.files?.[0])}/></div>
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
  return <div className="modal-backdrop" onMouseDown={close}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">MI HOGAR</span><h2>Perfil y preferencias</h2></div><button onClick={close}>×</button></div><div className="settings-list"><label><span>Personas en casa</span><select value={state.profile.householdSize} onChange={e=>setState(s=>({...s,profile:{...s.profile,householdSize:Number(e.target.value)}}))}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select></label><label><span>Supermercado principal</span><select value={state.profile.mainSupermarket} onChange={e=>setState(s=>({...s,profile:{...s.profile,mainSupermarket:e.target.value}}))}>{state.profile.supermarkets.map(m=><option key={m}>{m}</option>)}</select></label><label><span>Objetivo principal</span><select value={state.profile.goal} onChange={e=>setState(s=>({...s,profile:{...s.profile,goal:e.target.value as Goal}}))}>{GOALS.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}</select></label><label><span>Notificaciones</span><button className={state.profile.notifications?"switch on":"switch"} onClick={()=>setState(s=>({...s,profile:{...s.profile,notifications:!s.profile.notifications}}))}><span/></button></label></div><button className="primary modal-save" onClick={close}>Guardar</button></div></div>;
}
