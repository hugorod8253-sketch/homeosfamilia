export type SyncCredentials={householdId:string;token:string};

const SYNC_STORAGE_KEY="homeos:sync:v1";
const url=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/$/,"");
const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"";

export function syncConfigured(){
 return Boolean(url&&anonKey);
}

async function rpc<T>(name:string,body:Record<string,unknown>):Promise<T>{
 if(!syncConfigured()) throw new Error("sync_not_configured");
 const res=await fetch(`${url}/rest/v1/rpc/${name}`,{
  method:"POST",
  headers:{
   "Content-Type":"application/json",
   "apikey":anonKey,
   "Authorization":`Bearer ${anonKey}`
  },
  body:JSON.stringify(body),
  cache:"no-store"
 });
 if(!res.ok) throw new Error(`sync_http_${res.status}`);
 return await res.json() as T;
}

function newToken(){
 const bytes=new Uint8Array(32);
 crypto.getRandomValues(bytes);
 let raw="";
 for(const b of bytes) raw+=String.fromCharCode(b);
 return btoa(raw).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

export function getStoredSync():SyncCredentials|null{
 if(typeof window==="undefined") return null;
 try{
  const parsed=JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY)||"null");
  if(parsed&&typeof parsed.householdId==="string"&&typeof parsed.token==="string") return parsed;
 }catch{}
 return null;
}

export function storeSync(creds:SyncCredentials){
 if(typeof window!=="undefined") localStorage.setItem(SYNC_STORAGE_KEY,JSON.stringify(creds));
}

export function clearSync(){
 if(typeof window!=="undefined") localStorage.removeItem(SYNC_STORAGE_KEY);
}

export function connectionCode(creds:SyncCredentials){
 return `HOS1.${creds.householdId}.${creds.token}`;
}

export function parseConnectionCode(input:string):SyncCredentials|null{
 const clean=input.trim();
 const parts=clean.split(".");
 if(parts.length!==3||parts[0]!=="HOS1") return null;
 const householdId=parts[1],token=parts[2];
 if(!/^[0-9a-f-]{36}$/i.test(householdId)||token.length<32) return null;
 return {householdId,token};
}

export async function createRemoteHousehold(name:string,data:unknown):Promise<{creds:SyncCredentials;revision:number}>{
 const token=newToken();
 const result=await rpc<{ok:boolean;householdId?:string;revision?:number;error?:string}>("homeos_household_create",{
  p_name:name||"Mi hogar",
  p_token:token,
  p_data:data
 });
 if(!result.ok||!result.householdId) throw new Error(result.error||"sync_create_failed");
 const creds={householdId:result.householdId,token};
 storeSync(creds);
 return {creds,revision:result.revision||1};
}

export async function readRemoteHousehold(creds:SyncCredentials):Promise<{data:unknown;revision:number;name:string}|null>{
 const result=await rpc<{ok:boolean;data?:unknown;revision?:number;name?:string;error?:string}>("homeos_household_read",{
  p_household_id:creds.householdId,
  p_token:creds.token
 });
 if(!result.ok) return null;
 return {data:result.data,revision:result.revision||1,name:result.name||"Mi hogar"};
}

export async function writeRemoteHousehold(creds:SyncCredentials,data:unknown):Promise<number>{
 const result=await rpc<{ok:boolean;revision?:number;error?:string}>("homeos_household_write",{
  p_household_id:creds.householdId,
  p_token:creds.token,
  p_data:data
 });
 if(!result.ok) throw new Error(result.error||"sync_write_failed");
 return result.revision||1;
}
