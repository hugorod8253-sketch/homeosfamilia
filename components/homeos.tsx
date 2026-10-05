"use client";
import { useEffect, useMemo, useState } from "react";

type View = "inicio" | "comer" | "comprar" | "casa" | "finanzas";
type Confidence = "seguro" | "probable" | "duda";
type InventoryItem = { id:string; name:string; qty:number; unit:string; location:string; expires:string; confidence:Confidence; opened?:boolean; price?:number };
type ShoppingItem = { id:string; name:string; qty:number; checked:boolean; requestedBy?:string; estimated?:boolean };
type PurchaseSession = { active:boolean; startedAt?:string; store?:string; latitude?:number; longitude?:number };

type AppState = {
  inventory: InventoryItem[];
  shopping: ShoppingItem[];
  budget: number;
  spent: number;
  waste: number;
  session: PurchaseSession;
};

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
  session: {active:false}
};

function loadState():AppState {
  if (typeof window === "undefined") return DEFAULT;
  try { return {...DEFAULT, ...JSON.parse(localStorage.getItem("homeos:v2") || "{}")}; } catch { return DEFAULT; }
}

function daysUntil(date:string){
  const today = new Date("2026-10-05T12:43:00+02:00");
  const target = new Date(date+"T12:00:00+02:00");
  return Math.ceil((target.getTime()-today.getTime())/86400000);
}

const nav: {id:View; label:string; icon:string}[] = [
  {id:"inicio",label:"Inicio",icon:"⌂"},{id:"comer",label:"Comer",icon:"🍽"},{id:"comprar",label:"Comprar",icon:"🛒"},{id:"casa",label:"Casa",icon:"⌑"},{id:"finanzas",label:"Finanzas",icon:"€"}
];

export default function HomeOS(){
  const [view,setView] = useState<View>("inicio");
  const [state,setState] = useState<AppState>(DEFAULT);
  const [quick,setQuick] = useState("");
  const [toast,setToast] = useState("");

  useEffect(()=>setState(loadState()),[]);
  useEffect(()=>{ if(typeof window!=="undefined") localStorage.setItem("homeos:v2",JSON.stringify(state)); },[state]);
  useEffect(()=>{ if(!toast) return; const t=setTimeout(()=>setToast(""),2500); return()=>clearTimeout(t); },[toast]);

  const expiring = useMemo(()=>state.inventory.filter(i=>daysUntil(i.expires)<=3).sort((a,b)=>daysUntil(a.expires)-daysUntil(b.expires)),[state.inventory]);
  const available = state.budget-state.spent;
  const budgetPct = Math.min(100,Math.round((state.spent/state.budget)*100));

  function addQuick(){
    const value=quick.trim(); if(!value) return;
    const id=crypto.randomUUID();
    setState(s=>({...s,shopping:[...s.shopping,{id,name:value,qty:1,checked:false,requestedBy:"Tú"}]}));
    setQuick(""); setToast("Añadido a la compra");
  }
  function toggleShopping(id:string){ setState(s=>({...s,shopping:s.shopping.map(i=>i.id===id?{...i,checked:!i.checked}:i)})); }
  function startShopping(){
    if(!navigator.geolocation){setState(s=>({...s,session:{active:true,startedAt:new Date().toISOString()}})); setToast("Compra iniciada"); return;}
    navigator.geolocation.getCurrentPosition(
      p=>{setState(s=>({...s,session:{active:true,startedAt:new Date().toISOString(),latitude:p.coords.latitude,longitude:p.coords.longitude}}));setToast("Compra iniciada y ubicación guardada");},
      ()=>{setState(s=>({...s,session:{active:true,startedAt:new Date().toISOString()}}));setToast("Compra iniciada sin ubicación");},
      {enableHighAccuracy:false,timeout:5000,maximumAge:60000}
    );
  }
  function finishShopping(){
    const bought=state.shopping.filter(i=>i.checked);
    if(!bought.length){setToast("Marca primero lo que has comprado");return;}
    const newInventory=bought.map(i=>({id:crypto.randomUUID(),name:i.name,qty:i.qty,unit:"uds",location:"Por colocar",expires:"2026-10-15",confidence:"seguro" as Confidence}));
    setState(s=>({...s, inventory:[...newInventory,...s.inventory], shopping:s.shopping.filter(i=>!i.checked), session:{active:false}}));
    setToast(`${bought.length} productos pasados a Casa`);
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-dot">H</div><div><strong>HomeOS</strong><span>Familia</span></div></div>
      <nav>{nav.map(n=><button key={n.id} className={view===n.id?"nav active":"nav"} onClick={()=>setView(n.id)}><span>{n.icon}</span>{n.label}</button>)}</nav>
      <button className="profile"><span>FR</span><div><strong>Casa de Fran</strong><small>4 personas</small></div></button>
    </aside>

    <main className="main">
      <header className="topbar"><div><span className="eyebrow">Lunes, 5 de octubre</span><h1>{view==="inicio"?"Tu casa, sin tener que pensar en todo":nav.find(n=>n.id===view)?.label}</h1></div><button className="avatar">FR</button></header>
      {view==="inicio" && <Inicio expiring={expiring} available={available} budgetPct={budgetPct} shopping={state.shopping} setView={setView} />}
      {view==="comer" && <Comer inventory={state.inventory} expiring={expiring}/>} 
      {view==="comprar" && <Comprar state={state} setState={setState} quick={quick} setQuick={setQuick} addQuick={addQuick} toggleShopping={toggleShopping} startShopping={startShopping} finishShopping={finishShopping}/>} 
      {view==="casa" && <Casa inventory={state.inventory} setState={setState}/>} 
      {view==="finanzas" && <Finanzas state={state} setState={setState} available={available} budgetPct={budgetPct}/>} 
    </main>
    <nav className="bottom-nav">{nav.map(n=><button key={n.id} className={view===n.id?"active":""} onClick={()=>setView(n.id)}><span>{n.icon}</span><small>{n.label}</small></button>)}</nav>
    {toast&&<div className="toast">{toast}</div>}
  </div>;
}

function Inicio({expiring,available,budgetPct,shopping,setView}:{expiring:InventoryItem[];available:number;budgetPct:number;shopping:ShoppingItem[];setView:(v:View)=>void}){
  return <section className="stack">
    <div className="hero-grid">
      <button className="decision-card mint" onClick={()=>setView("comer")}><span className="decision-icon">🍽</span><div><small>DECISIÓN RÁPIDA</small><h2>¿Qué comemos hoy?</h2><p>Usa primero lo que ya tienes en casa.</p></div><b>›</b></button>
      <button className="decision-card blue" onClick={()=>setView("comprar")}><span className="decision-icon">🛒</span><div><small>ANTES DE SALIR</small><h2>Voy a comprar</h2><p>{shopping.filter(x=>!x.checked).length} cosas pendientes · lista inteligente</p></div><b>›</b></button>
    </div>
    <div className="section-title"><h3>Lo importante ahora</h3><span>HomeOS prioriza por ti</span></div>
    <div className="card-grid three">
      <article className="soft-card amber"><div className="card-head"><span>⏱</span><small>CONSUMIR PRONTO</small></div><strong>{expiring.length?`${expiring.length} productos`:`Todo al día`}</strong><p>{expiring[0]?`${expiring[0].name} · ${daysUntil(expiring[0].expires)} día(s)`:"No hay urgencias"}</p></article>
      <article className="soft-card green"><div className="card-head"><span>€</span><small>PRESUPUESTO</small></div><strong>{available.toFixed(0)} € disponibles</strong><p>{budgetPct}% del presupuesto mensual usado</p></article>
      <article className="soft-card rose"><div className="card-head"><span>◷</span><small>PRÓXIMO EVENTO</small></div><strong>Fin de semana</strong><p>Sin evento especial añadido</p></article>
    </div>
    <article className="insight"><span className="spark">✦</span><div><strong>Una sugerencia para hoy</strong><p>Hay hamburguesas y queso en casa. Si compras pan y tomate puedes resolver la cena sin añadir otra compra grande.</p></div><button onClick={()=>setView("comer")}>Ver idea</button></article>
  </section>
}

function Comer({inventory,expiring}:{inventory:InventoryItem[];expiring:InventoryItem[]}){
  const idea = inventory.some(i=>i.name.toLowerCase().includes("hamburg")) ? "Hamburguesas con queso" : "Pasta rápida";
  return <section className="stack"><div className="page-intro"><div><span className="eyebrow">DECIDE EN 10 SEGUNDOS</span><h2>{idea}</h2><p>La recomendación prioriza caducidad, lo que ya tienes y evitar una compra innecesaria.</p></div><button className="primary">Otra idea</button></div>
    <div className="card-grid two"><article className="meal-card"><div className="meal-emoji">🍔</div><div><small>RECOMENDADO</small><h3>{idea}</h3><p>Ya tienes la base en casa. Solo faltaría pan y tomate.</p><div className="chips"><span>20 min</span><span>4 personas</span><span>Compra mínima</span></div></div></article><article className="priority-list"><h3>Usa primero</h3>{expiring.slice(0,4).map(i=><div className="priority" key={i.id}><span>●</span><div><strong>{i.name}</strong><small>{i.qty} {i.unit} · {i.location}</small></div><b>{daysUntil(i.expires)}d</b></div>)}</article></div>
  </section>
}

function Comprar({state,setState,quick,setQuick,addQuick,toggleShopping,startShopping,finishShopping}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;quick:string;setQuick:(s:string)=>void;addQuick:()=>void;toggleShopping:(id:string)=>void;startShopping:()=>void;finishShopping:()=>void}){
  return <section className="stack"><div className="shopping-top"><div><span className="eyebrow">LISTA COMPARTIDA</span><h2>{state.session.active?"Compra en curso":"Lista para la próxima compra"}</h2><p>Marca mientras compras. Si subes el ticket después, servirá como segunda comprobación.</p></div>{state.session.active?<button className="primary" onClick={finishShopping}>Terminar compra</button>:<button className="primary" onClick={startShopping}>Estoy comprando</button>}</div>
    <div className="quick-add"><input value={quick} onChange={e=>setQuick(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addQuick()} placeholder="Añadir producto o dictarlo por voz…"/><button title="Voz" onClick={()=>setQuick(quick||"Añadir por voz")}>🎙</button><button onClick={addQuick}>Añadir</button></div>
    <div className="shopping-layout"><article className="list-card"><div className="list-title"><h3>Por comprar</h3><span>{state.shopping.filter(i=>!i.checked).length} pendientes</span></div>{state.shopping.map(i=><label className={i.checked?"shop-row checked":"shop-row"} key={i.id}><input type="checkbox" checked={i.checked} onChange={()=>toggleShopping(i.id)}/><span className="fake-check">✓</span><div><strong>{i.name}</strong><small>{i.requestedBy?`Pedido por ${i.requestedBy}`:"Añadido automáticamente"}{i.estimated?" · sugerido por consumo":""}</small></div><b>x{i.qty}</b></label>)}</article>
      <aside className="purchase-tools"><div className="tool-card"><span>📍</span><div><strong>Ubicación de compra</strong><p>{state.session.active&&state.session.latitude?"Punto guardado. Se usará como ayuda para detectar el final.":"Se solicita solo al iniciar una compra."}</p></div></div><div className="tool-card"><span>🧾</span><div><strong>Ticket o foto</strong><p>Segunda capa para corregir lo que se olvidó marcar.</p></div><button disabled>Próximamente</button></div><div className="tool-card"><span>✦</span><div><strong>3 productos sugeridos</strong><p>Basados en consumo habitual y stock estimado.</p></div></div></aside>
    </div>
  </section>
}

function Casa({inventory,setState}:{inventory:InventoryItem[];setState:React.Dispatch<React.SetStateAction<AppState>>}){
  const [filter,setFilter]=useState("Todos");
  const shown=inventory.filter(i=>filter==="Todos"||i.location===filter);
  function consume(id:string){setState(s=>({...s,inventory:s.inventory.map(i=>i.id===id?{...i,qty:Math.max(0,i.qty-1),confidence:"seguro"}:i).filter(i=>i.qty>0)}));}
  return <section className="stack"><div className="page-intro"><div><span className="eyebrow">INVENTARIO ESTIMADO</span><h2>Lo que probablemente hay en casa</h2><p>No exige precisión milimétrica: muestra seguridad y solo pregunta cuando importa.</p></div><button className="secondary">Actualizar con foto</button></div><div className="segmented">{["Todos","Nevera","Congelador","Despensa"].map(x=><button key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x}</button>)}</div><div className="inventory-grid">{shown.map(i=><article className="inventory-card" key={i.id}><div className="inventory-top"><span className="food-dot">{i.location==="Nevera"?"❄":i.location==="Despensa"?"▦":"□"}</span><span className={`confidence ${i.confidence}`}>{i.confidence}</span></div><h3>{i.name}</h3><p>{i.qty} {i.unit} · {i.location}</p><div className="inventory-bottom"><small>{daysUntil(i.expires)<=3?`Caduca en ${daysUntil(i.expires)}d`:`Hasta ${i.expires.slice(5).replace("-","/")}`}</small><button onClick={()=>consume(i.id)}>He usado 1</button></div></article>)}</div></section>
}

function Finanzas({state,setState,available,budgetPct}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;available:number;budgetPct:number}){
  return <section className="stack"><div className="page-intro"><div><span className="eyebrow">COMIDA + OBJETIVO FINANCIERO</span><h2>Control sin mezclar conceptos</h2><p>Gasto real, ahorro frente al presupuesto y desperdicio se muestran por separado.</p></div></div><div className="finance-grid"><article className="finance-main"><small>GASTO DEL MES</small><strong>{state.spent.toFixed(2)} €</strong><div className="progress"><span style={{width:`${budgetPct}%`}}/></div><div className="finance-row"><span>Presupuesto</span><b>{state.budget.toFixed(0)} €</b></div><div className="finance-row"><span>Disponible</span><b>{available.toFixed(2)} €</b></div></article><article className="soft-card green"><small>AHORRO VS. PRESUPUESTO</small><strong>{Math.max(0,available).toFixed(2)} €</strong><p>Solo si el mes termina por debajo del presupuesto.</p></article><article className="soft-card amber"><small>COSTE DEL DESPERDICIO</small><strong>{state.waste.toFixed(2)} €</strong><p>No se confunde con el ahorro. Se registra aparte.</p></article></div><article className="budget-editor"><div><h3>Presupuesto mensual</h3><p>Es el único dato financiero imprescindible para empezar.</p></div><div className="budget-control"><input type="number" value={state.budget} onChange={e=>setState(s=>({...s,budget:Number(e.target.value)||0}))}/><span>€ / mes</span></div></article></section>
}
