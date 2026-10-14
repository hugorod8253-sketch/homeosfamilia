"use client";
import {useCallback,useEffect,useState,type FormEvent,type ReactNode} from "react";
import HomeOS from "./homeos";
import {readBrowserStorage,writeBrowserStorage} from "../lib/browser-storage";
import {
 accountAuthConfigured,createAccount,signInAccount,signOutAccount,verifyAccountSession,
 listAccountHouseholds,createAccountHousehold,joinAccountHousehold,claimLegacyHousehold,
 listAccountMembers,inviteAccountMember,removeAccountMember,leaveAccountHousehold,
 type HomeAccount,type HomeAccountMember,type HomeAccountSession
} from "../lib/homeos-account";

function Badge({children}:{children:ReactNode}){return <span className="ha-badge">{children}</span>}
function InlineError({message}:{message:string}){return message?<p role="alert" className="ha-error">{message}</p>:null}
const homeKey=(id:string)=>"homeos:account:selected:"+id;
const errorMessage=(err:unknown)=>err instanceof Error?err.message:"Ha ocurrido un problema. Inténtalo de nuevo.";

export default function HomeAccountGateway(){
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [session,setSession]=useState<HomeAccountSession|null>(null);
 const [houses,setHouses]=useState<HomeAccount[]>([]);
 const [selected,setSelected]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [mode,setMode]=useState<"login"|"signup">("login");
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [nickname,setNickname]=useState("");
 const [homeName,setHomeName]=useState("");
 const [inviteCode,setInviteCode]=useState("");
 const [claimCode,setClaimCode]=useState("");
 const [claimApproved,setClaimApproved]=useState(false);
 const [invite,setInvite]=useState("");
 const [members,setMembers]=useState<HomeAccountMember[]>([]);
 const [removingId,setRemovingId]=useState("");
 const [leaving,setLeaving]=useState(false);
 const [manageOpen,setManageOpen]=useState(false);

 const loadHomes=useCallback(async(user:HomeAccountSession,choosePrevious=true)=>{
  const data=await listAccountHouseholds();
  setHouses(data);
  const saved=readBrowserStorage(homeKey(user.user.id));
  if(choosePrevious&&saved&&data.some(h=>h.householdId===saved))setSelected(saved);
  else if(choosePrevious&&data.length===1)setSelected(data[0].householdId);
  else setSelected(null);
  return data;
 },[]);

 const restore=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const valid=await verifyAccountSession();
   setSession(valid);
   if(valid)await loadHomes(valid);
  }catch(err){setError(errorMessage(err))}
  finally{setLoading(false)}
 },[loadHomes]);
 useEffect(()=>{void restore()},[restore]);
 useEffect(()=>{if(!session||!selected)return;writeBrowserStorage(homeKey(session.user.id),selected)},[selected,session]);
 useEffect(()=>{if(!selected||!manageOpen)return;void listAccountMembers(selected).then(setMembers).catch(err=>setError(errorMessage(err)))},[selected,manageOpen]);
 const current=houses.find(h=>h.householdId===selected);
 async function run(task:()=>Promise<void>){if(busy)return;setBusy(true);setError("");setSuccess("");try{await task()}catch(err){setError(errorMessage(err))}finally{setBusy(false)}}
 async function submitAuth(event:FormEvent){
  event.preventDefault();
  await run(async()=>{
   if(mode==="signup"){
    const result=await createAccount(email,password);
    if(result.needsConfirmation){setSuccess("Revisa tu correo para confirmar la cuenta. Después, inicia sesión.");setMode("login");setPassword("");return}
   }else await signInAccount(email,password);
   setPassword("");
   const valid=await verifyAccountSession();
   if(!valid)throw new Error("Confirma tu correo antes de iniciar sesión.");
   setSession(valid);await loadHomes(valid);
  });
 }
 async function createHome(event:React.FormEvent){
  event.preventDefault();
  if(!session)return;
  await run(async()=>{
   const r=await createAccountHousehold(homeName||"Mi hogar",nickname||session.user.email?.split("@")[0]||"Miembro",{});
   const data=await loadHomes(session,false);
   if(!data.some(h=>h.householdId===r.householdId))throw new Error("El hogar está creado, pero falta cargar sus datos. Recarga la página.");
   setSelected(r.householdId);
  });
 }
 async function joinHome(event:React.FormEvent){
  event.preventDefault();if(!session)return;
  await run(async()=>{
   const r=await joinAccountHousehold(inviteCode,nickname||session.user.email?.split("@")[0]||"Miembro");
   const data=await loadHomes(session,false);
   if(!data.some(h=>h.householdId===r.householdId))throw new Error("Has entrado en el hogar. Recarga para verlo.");
   setInviteCode("");setSelected(r.householdId);
  });
 }
 async function claimHome(event:React.FormEvent){
  event.preventDefault();if(!session||!claimApproved)return;
  await run(async()=>{
   const r=await claimLegacyHousehold(claimCode,nickname||session.user.email?.split("@")[0]||"Miembro");
   const data=await loadHomes(session,false);
   if(!data.some(h=>h.householdId===r.householdId))throw new Error("El hogar se ha migrado. Recarga para verlo.");
   setClaimCode("");setClaimApproved(false);setSelected(r.householdId);
  });
 }
 async function refreshMembers(){if(!current)return;setMembers(await listAccountMembers(current.householdId))}
 async function shareInvite(){
  if(!current||current.role!=="owner")return;
  await run(async()=>{
   const code=await inviteAccountMember(current.householdId);setInvite(code);
   try{await navigator.clipboard.writeText(code);setSuccess("Invitación copiada. Úsala una vez en el otro dispositivo.")}catch{setSuccess("Copia el código mostrado para invitar a un familiar.")}
  });
 }
 async function doRemove(userId:string){
  if(!current||current.role!=="owner")return;
  await run(async()=>{await removeAccountMember(current.householdId,userId);setRemovingId("");await refreshMembers();setSuccess("Acceso retirado. Los datos del hogar permanecen guardados.")});
 }
 async function doLeave(){
  if(!current||current.role==="owner")return;
  await run(async()=>{
   await leaveAccountHousehold(current.householdId);setSelected(null);setManageOpen(false);setLeaving(false);
   if(session)await loadHomes(session,false);
  });
 }
 async function doSignOut(){
  // Unmount the household before clearing sensitive local cache.
  setSelected(null);setManageOpen(false);
  await signOutAccount();
  setSession(null);setHouses([]);setMembers([]);setError("");setSuccess("");
 }
 async function openManager(){setManageOpen(true);setError("");setInvite("");if(current)try{setMembers(await listAccountMembers(current.householdId))}catch(err){setError(errorMessage(err))}}
 if(!accountAuthConfigured())return <main className="ha-page"><section className="ha-panel"><h1>HomeOS</h1><p>El acceso por cuentas aún no está configurado en este entorno.</p></section></main>;
 if(loading)return <main className="ha-page"><section className="ha-panel" role="status"><h1>HomeOS</h1><p>Comprobando tu sesión y tus hogares…</p></section></main>;
 if(current&&!manageOpen)return <HomeOS key={current.householdId+"-"+session?.user.id} account={{
  householdId:current.householdId,userId:session!.user.id,
  memberName:current.memberName||"Tú",role:current.role,onManage:()=>{void openManager()},
  onAccessDenied:()=>{setSelected(null);setError("Tu cuenta ya no tiene acceso a este hogar.");if(session)void loadHomes(session,false)}
 }}/>;
 return <main className="ha-page">
  <header className="ha-header"><div className="ha-logo" aria-hidden="true">H</div><div><strong>HomeOS</strong><span>Un hogar, cada persona con su cuenta.</span></div></header>
  <section className="ha-panel">
   {!session?<div className="ha-login">
    <Badge>ACCESO PERSONAL</Badge><h1>{mode==="login"?"Tu casa, siempre a mano":"Crear una cuenta"}</h1>
    <p>Inicia sesión una vez en tu dispositivo. Tus compras e inventario se compartirán únicamente con las personas invitadas.</p>
    <div className="ha-segments"><button type="button" aria-pressed={mode==="login"} className={mode==="login"?"active":""} onClick={()=>{setMode("login");setError("");setSuccess("")}}>Entrar</button><button type="button" aria-pressed={mode==="signup"} className={mode==="signup"?"active":""} onClick={()=>{setMode("signup");setError("");setSuccess("")}}>Crear cuenta</button></div>
    <form onSubmit={submitAuth} className="ha-form"><label>Correo electrónico<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="tu@email.com"/></label><label>Contraseña<input type="password" minLength={8} autoComplete={mode==="login"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} required placeholder={mode==="login"?"Tu contraseña":"Mínimo 8 caracteres"}/></label><button className="primary" type="submit" disabled={busy}>{busy?"Comprobando…":mode==="login"?"Entrar en HomeOS":"Crear mi cuenta"}</button></form>
    <p className="ha-hint">La contraseña no se guarda en HomeOS. Puedes cerrar y volver a abrir la aplicación sin iniciar sesión cada vez.</p>
   </div>:manageOpen&&current?<div className="ha-manage">
    <button className="ha-back" onClick={()=>{setManageOpen(false);setError("")}}>← Volver a HomeOS</button><Badge>HOGAR COMPARTIDO</Badge><h1>{current.name}</h1><p>El inventario y la lista son comunes. Cada persona utiliza su propia cuenta y conserva su sesión en su dispositivo.</p>
    <div className="ha-members-head"><h2>Personas con acceso</h2><span>{members.length} de 12</span></div>
    <div className="ha-member-list">{members.map(m=><div className="ha-person" key={m.userId}><span className="ha-person-avatar">{(m.name||"M").slice(0,1).toUpperCase()}</span><div><strong>{m.name||"Miembro"}</strong><small>{m.role==="owner"?"Administrador":"Miembro"}</small></div>{m.role==="member"&&current.role==="owner"&&<div>{removingId===m.userId?<><button className="ha-danger" onClick={()=>{void doRemove(m.userId)}} disabled={busy}>Confirmar</button><button className="ha-minimal" onClick={()=>setRemovingId("")}>Cancelar</button></>:<button className="ha-minimal" onClick={()=>setRemovingId(m.userId)}>Quitar acceso</button>}</div>}</div>)}</div>
    {current.role==="owner"&&<div className="ha-section ha-invite"><h2>Invitar a alguien</h2><p>Genera un código personal de un solo uso. Caduca a las 48 horas; cada familiar entra con su propia cuenta.</p><button type="button" className="primary" disabled={busy} onClick={()=>{void shareInvite()}}>Crear invitación</button>{invite&&<label>Código de esta invitación<textarea readOnly value={invite} rows={2} onFocus={e=>e.currentTarget.select()}/></label>}</div>}
    <div className="ha-actions"><button className="secondary" onClick={()=>{setManageOpen(false);setSelected(null)}}>Cambiar de hogar</button>{current.role==="member"&&(leaving?<div><p>Dejarás de tener acceso a este inventario.</p><button className="ha-danger" disabled={busy} onClick={()=>void doLeave()}>Confirmar salida</button><button className="ha-minimal" onClick={()=>setLeaving(false)}>Cancelar</button></div>:<button className="secondary" onClick={()=>setLeaving(true)}>Salir de este hogar</button>)}<button className="ha-minimal" onClick={()=>void doSignOut()}>Cerrar sesión</button></div>
   </div>:<div className="ha-houses">
    <Badge>MI ESPACIO</Badge><h1>{houses.length?"Elige tu hogar":"Prepara tu hogar"}</h1><p>Una cuenta por persona, pero las compras, las recetas y el inventario se mantienen juntos.</p>
    {houses.length>0&&<div className="ha-house-list">{houses.map(h=><button className="ha-house" key={h.householdId} onClick={()=>{setSelected(h.householdId);setError("")}}><span aria-hidden="true">⌂</span><div><strong>{h.name}</strong><small>{h.role==="owner"?"Administrador":"Miembro"} · Datos compartidos</small></div><b>→</b></button>)}</div>}
    <label className="ha-name">Tu nombre en casa<input value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="Ej. Marta · opcional" maxLength={60}/></label>
    <div className="ha-option-grid">
     <form className="ha-option" onSubmit={createHome}><div className="ha-option-symbol home">⌂</div><h2>Crear hogar</h2><p>Empieza desde cero. Configuraremos los hábitos una sola vez.</p><label>Nombre del hogar<input required value={homeName} onChange={e=>setHomeName(e.target.value)} placeholder="Mi casa" maxLength={80}/></label><button className="primary" disabled={busy}>Crear hogar</button></form>
     <form className="ha-option" onSubmit={joinHome}><div className="ha-option-symbol join">↗</div><h2>Entrar en una familia</h2><p>Usa una invitación HOS2 que te haya compartido el responsable.</p><label>Código de invitación<input required value={inviteCode} onChange={e=>setInviteCode(e.target.value)} placeholder="HOS2.…" autoComplete="off"/></label><button className="secondary" disabled={busy}>Unirme al hogar</button></form>
    </div>
    <details className="ha-claim"><summary>Ya utilizabas HomeOS y quieres conservar tu inventario</summary><p>Esta operación mantiene las compras, recetas y perfiles actuales. <strong>El código HOS1 antiguo dejará de funcionar</strong> y tendrás que invitar a los demás miembros con códigos HOS2.</p><form onSubmit={claimHome} className="ha-form"><label>Código HOS1 original<input value={claimCode} required onChange={e=>setClaimCode(e.target.value)} placeholder="HOS1.…" autoComplete="off"/></label><label className="ha-check"><input type="checkbox" checked={claimApproved} onChange={e=>setClaimApproved(e.target.checked)}/>Entiendo que los otros dispositivos necesitarán invitación nueva.</label><button type="submit" className="secondary" disabled={busy||!claimApproved}>Conservar y vincular este hogar</button></form></details>
    <div className="ha-actions"><span>{session.user.email||"Cuenta conectada"}</span><button className="ha-minimal" onClick={()=>void doSignOut()}>Cerrar sesión</button></div>
   </div>}
   <InlineError message={error}/>{success&&<p className="ha-success" role="status">{success}</p>}
  </section>
 </main>;
}
