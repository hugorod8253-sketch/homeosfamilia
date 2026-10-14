/** Browser-only Supabase Auth transport. Passwords never enter app state or persistent storage. */
import {readBrowserStorage,writeBrowserStorage,removeBrowserStorage} from "./browser-storage";
import {parseConnectionCode} from "./homeos-sync";

export type HomeAccountSession={
 access_token:string;refresh_token:string;expires_at:number;
 user:{id:string;email?:string};
};
export type HomeAccount={householdId:string;name:string;role:"owner"|"member";memberName:string;revision:number};
export type HomeAccountMember={userId:string;name:string;role:"owner"|"member";joinedAt:string};
const KEY="homeos:account-auth:v1";
const url=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/$/,"");
const apiKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"";
let ongoingRefresh:Promise<HomeAccountSession|null>|null=null;

export function accountAuthConfigured(){return Boolean(url&&apiKey)}
export function readAccountSession():HomeAccountSession|null{
 try{
  const x=JSON.parse(readBrowserStorage(KEY)||"null");
  if(!x||typeof x.access_token!=="string"||typeof x.refresh_token!=="string"
      ||!Number.isFinite(x.expires_at)||typeof x.user?.id!=="string")return null;
  return x as HomeAccountSession;
 }catch{return null}
}
function savedSession(payload:any):HomeAccountSession|null{
 if(!payload||typeof payload.access_token!=="string"||typeof payload.refresh_token!=="string"||
    typeof payload.user?.id!=="string")return null;
 const expires=Number(payload.expires_at)||Math.floor(Date.now()/1000)+Number(payload.expires_in||3600);
 if(!Number.isFinite(expires)||expires<=0)return null;
 const session:HomeAccountSession={
  access_token:payload.access_token,refresh_token:payload.refresh_token,
  expires_at:expires,user:{id:payload.user.id,email:payload.user.email}
 };
 if(!writeBrowserStorage(KEY,JSON.stringify(session)))throw new Error("storage_unavailable");
 return session;
}
function authError(code:string){
 const lookup:Record<string,string>={
  invalid_credentials:"Correo o contraseña incorrectos.",
  email_not_confirmed:"Confirma tu correo desde el enlace que te enviaron.",
  user_already_exists:"Ya existe una cuenta con ese correo.",
  over_email_send_rate_limit:"Demasiados correos. Espera antes de volver a intentarlo.",
  signup_disabled:"El registro está desactivado en este momento.",
  email_provider_disabled:"El acceso por correo no está disponible.",
  too_many_requests:"Demasiados intentos. Vuelve a probar en unos minutos.",
  storage_unavailable:"Este navegador no está guardando la sesión. Comprueba los permisos de almacenamiento.",
  auth_required:"Inicia sesión para continuar.",
  not_member:"No tienes permiso para acceder a ese hogar.",
  not_owner:"Solo el responsable del hogar puede realizar esta acción.",
  invite_used:"Este código de invitación ya se ha utilizado.",
  invalid_or_expired:"La invitación ha caducado o es incorrecta.",
  already_claimed:"Este hogar ya tiene una cuenta propietaria.",
  state_too_large:"El inventario supera el tamaño admitido. No se ha guardado.",
  conflict:"Otra persona ha actualizado este hogar. Hay que combinar los cambios.",
  household_full:"El hogar ha alcanzado el límite de doce miembros."
 };
 return lookup[code]||"No se pudo completar la operación. Comprueba la conexión e inténtalo de nuevo.";
}
async function request(path:string,body:unknown,token?:string,method="POST"){
 if(!accountAuthConfigured())throw new Error("account_unconfigured");
 let res:Response;
 try{
  res=await fetch(url+path,{
   method,cache:"no-store",
   headers:{"Content-Type":"application/json",apikey:apiKey,...(token?{"Authorization":"Bearer "+token}:{})},
   ...(method!=="GET"?{body:JSON.stringify(body)}:{})
  });
 }catch{throw new Error("Sin conexión. Tu cuenta no se ha modificado.")}
 let data:any;
 try{data=await res.json()}catch{data={}}
 if(!res.ok){
  const err=data?.error_code||data?.code||data?.error||data?.msg||"";
  const message=authError(err);
  const e=new Error(message) as Error&{status?:number};
  e.status=res.status;
  throw e;
 }
 return data;
}
export async function createAccount(email:string,password:string):Promise<{needsConfirmation:boolean}>{
 if(!/^\S+@\S+\.\S+$/.test(email.trim())||password.length<8)throw new Error("Indica un correo válido y una contraseña de al menos 8 caracteres.");
 const data=await request("/auth/v1/signup",{email:email.trim().toLowerCase(),password});
 const ready=Boolean(savedSession(data));
 return {needsConfirmation:!ready};
}
export async function signInAccount(email:string,password:string):Promise<HomeAccountSession>{
 const data=await request("/auth/v1/token?grant_type=password",{email:email.trim().toLowerCase(),password});
 const session=savedSession(data);
 if(!session)throw new Error("El servidor no ha devuelto una sesión válida.");
 return session;
}
async function refreshOnce():Promise<HomeAccountSession|null>{
 const previous=readAccountSession();
 if(!previous)return null;
 // Cross-tab refresh coordination: avoid reusing a rotated refresh token.
 const execute=async()=>{
  const latest=readAccountSession();
  if(!latest)return null;
  if(latest.refresh_token!==previous.refresh_token && latest.expires_at>Math.floor(Date.now()/1000)+30)return latest;
  try{
   const data=await request("/auth/v1/token?grant_type=refresh_token",{refresh_token:latest.refresh_token});
   return savedSession(data);
  }catch(err){
   // A transient network failure must not delete a user's session.
   if((err as any)?.status===400||(err as any)?.status===401){
    const newest=readAccountSession();
    if(newest&&newest.refresh_token!==latest.refresh_token)return newest;
    removeBrowserStorage(KEY);
    return null;
   }
   throw err;
  }
 };
 if(typeof navigator!=="undefined"&&navigator.locks?.request){
  return navigator.locks.request("homeos-refresh-auth",{mode:"exclusive"},execute);
 }
 return execute();
}
export async function currentAccountSession(forceRefresh=false):Promise<HomeAccountSession|null>{
 const s=readAccountSession();
 if(!s)return null;
 const now=Math.floor(Date.now()/1000);
 if(!forceRefresh&&s.expires_at>now+90)return s;
 if(!ongoingRefresh)ongoingRefresh=refreshOnce().finally(()=>{ongoingRefresh=null});
 return ongoingRefresh;
}
export async function verifyAccountSession():Promise<HomeAccountSession|null>{
 let s=await currentAccountSession();
 if(!s)return null;
 // Do not show locally cached household contents without verifying identity online.
 try{
  const user=await request("/auth/v1/user",null,s.access_token,"GET");
  if(user?.id!==s.user.id){removeBrowserStorage(KEY);return null}
  return s;
 }catch(err){
  if((err as any)?.status!==401)return Promise.reject(err);
  s=await currentAccountSession(true);
  if(!s)return null;
  const user=await request("/auth/v1/user",null,s.access_token,"GET");
  if(user?.id!==s.user.id){removeBrowserStorage(KEY);return null}
  return s;
 }
}
export async function signOutAccount(){
 const previous=readAccountSession();
 // Clear session locally even if offline; remote tokens expire and are revoked online where possible.
 removeBrowserStorage(KEY);
 if(previous){
  try{await request("/auth/v1/logout",{},previous.access_token)}catch{}
  // Clear cached household contents for this user so another login cannot inherit them.
  try{const prefix="homeos:account:"+previous.user.id+":";
   for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k?.startsWith(prefix))localStorage.removeItem(k)}
  }catch{}
 }
}
async function rpc<T>(name:string,params:Record<string,unknown>):Promise<T>{
 const session=await currentAccountSession();
 if(!session)throw new Error("Inicia sesión para continuar.");
 const send=async(token:string)=>{
  const result=await request("/rest/v1/rpc/"+name,params,token);
  if(result?.ok===false)throw Object.assign(new Error(authError(result.error)),{code:result.error,revision:result.revision});
  return result as T;
 };
 try{return await send(session.access_token)}
 catch(err){
  if((err as any)?.status!==401)return Promise.reject(err);
  const refreshed=await currentAccountSession(true);
  if(!refreshed)throw new Error("Tu sesión ha caducado. Inicia sesión de nuevo.");
  return send(refreshed.access_token);
 }
}
export async function listAccountHouseholds(){
 const result=await rpc<{ok:true;households:HomeAccount[]}>("homeos_account_mine",{});
 return result.households;
}
export async function createAccountHousehold(name:string,memberName:string,data:unknown){
 const r=await rpc<{ok:true;householdId:string;revision:number}>("homeos_account_household_create",{
  p_name:name.trim().slice(0,80)||"Mi hogar",p_data:data,p_display_name:memberName.trim().slice(0,60)
 });
 return r;
}
export async function claimLegacyHousehold(code:string,memberName:string){
 const creds=parseConnectionCode(code);
 if(!creds)throw new Error("El código antiguo del hogar no es válido.");
 return rpc<{ok:true;householdId:string;revision:number}>("homeos_account_household_claim",{
  p_household_id:creds.householdId,p_legacy_token:creds.token,p_display_name:memberName.trim().slice(0,60)
 });
}
export async function joinAccountHousehold(code:string,memberName:string){
 if(!/^HOS2\.[0-9a-f-]{36}\.[0-9a-f]{64}$/i.test(code.trim()))throw new Error("Revisa el código de invitación.");
 return rpc<{ok:true;householdId:string}>("homeos_account_invite_redeem",{
  p_code:code.trim(),p_display_name:memberName.trim().slice(0,60)
 });
}
export async function inviteAccountMember(householdId:string){
 const r=await rpc<{ok:true;code:string;expiresInHours:number}>("homeos_account_invite_create",{p_household_id:householdId});
 return r.code;
}
export async function listAccountMembers(householdId:string){
 const r=await rpc<{ok:true;members:HomeAccountMember[]}>("homeos_account_members_list",{p_household_id:householdId});
 return r.members;
}
export async function removeAccountMember(householdId:string,userId:string){
 return rpc("homeos_account_member_remove",{p_household_id:householdId,p_user_id:userId});
}
export async function leaveAccountHousehold(householdId:string){
 return rpc("homeos_account_leave",{p_household_id:householdId});
}
export async function readAccountHousehold(householdId:string){
 const r=await rpc<{ok:true;data:unknown;revision:number;name:string}>("homeos_account_household_read",{p_household_id:householdId});
 return r;
}
export async function writeAccountHousehold(householdId:string,data:unknown,revision:number){
 const r=await rpc<{ok:true;revision:number}>("homeos_account_household_write_v2",{
  p_household_id:householdId,p_expected_revision:revision,p_data:data
 });
 return r.revision;
}
