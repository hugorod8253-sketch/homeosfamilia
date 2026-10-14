import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

async function main(){
 // No network or real users: simulate the authenticated transport, refresh and household RPCs.
 process.env.NEXT_PUBLIC_SUPABASE_URL="https://supabase.unit-test.invalid";
 process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="test-public-anon-key";
 const storage=new Map<string,string>();
 const localStorage={
  getItem:(key:string)=>storage.get(key)||null,
  setItem:(key:string,val:string)=>{storage.set(key,val)},
  removeItem:(key:string)=>{storage.delete(key)},
  key:(n:number)=>[...storage.keys()][n]||null,
  get length(){return storage.size}
 };
 Object.defineProperty(globalThis,"window",{value:{localStorage},configurable:true});
 const {readAccountSession,signInAccount,currentAccountSession,verifyAccountSession,
  listAccountHouseholds,createAccountHousehold,readAccountHousehold,writeAccountHousehold,
  joinAccountHousehold,inviteAccountMember,claimLegacyHousehold,signOutAccount}=await import("../lib/homeos-account");
 const calls:{path:string;auth:string;body:any}[]=[];
 let unauthorized=false,refreshCount=0;
 globalThis.fetch=(async(url:RequestInfo|URL,init?:RequestInit)=>{
  const path=String(url).replace("https://supabase.unit-test.invalid","");
  const auth=new Headers(init?.headers).get("Authorization")||"";
  const body=init?.body?JSON.parse(String(init.body)):{};
  calls.push({path,auth,body});
  const res=(payload:unknown,status=200)=>new Response(JSON.stringify(payload),{status,headers:{"content-type":"application/json"}});
  if(path==="/auth/v1/token?grant_type=password")return res({access_token:"token-A",refresh_token:"refresh-A",expires_in:3600,user:{id:"u1",email:"family@example.com"}});
  if(path==="/auth/v1/token?grant_type=refresh_token"){
   assert.equal(body.refresh_token,"refresh-A");
   refreshCount++;
   return res({access_token:"token-B",refresh_token:"refresh-B",expires_in:3600,user:{id:"u1",email:"family@example.com"}});
  }
  if(path==="/auth/v1/user")return res({id:"u1",email:"family@example.com"});
  if(path==="/auth/v1/logout")return res({});
  if(path.startsWith("/rest/v1/rpc/")){
   assert.equal(auth,"Bearer token-B","RPC must use the refreshed account token");
   if(unauthorized)return res({ok:false,error:"not_member"});
   if(path.endsWith("homeos_account_mine"))return res({ok:true,households:[{householdId:"house-A",name:"Casa",role:"member",memberName:"Ana",revision:4}]});
   if(path.endsWith("homeos_account_household_create"))return res({ok:true,householdId:"house-B",revision:1});
   if(path.endsWith("homeos_account_household_read"))return res({ok:true,name:"Casa",data:{inventory:[]},revision:4});
   if(path.endsWith("homeos_account_household_write_v2"))return res({ok:true,revision:5});
   if(path.endsWith("homeos_account_invite_create"))return res({ok:true,code:"HOS2.invite",expiresInHours:48});
   if(path.endsWith("homeos_account_invite_redeem"))return res({ok:true,householdId:"house-B"});
   if(path.endsWith("homeos_account_household_claim"))return res({ok:true,householdId:"house-A",revision:4});
   throw new Error("Unexpected RPC "+path);
  }
  throw new Error("Unexpected HTTP "+path);
 }) as typeof fetch;
 const s=await signInAccount("family@example.com","a-good-password");
 assert.equal(s.user.id,"u1");
 assert.ok(!JSON.stringify([...storage]).includes("a-good-password"),"password must never enter local storage");
 assert.equal(readAccountSession()?.access_token,"token-A");
 const refreshed=await currentAccountSession(true);
 assert.equal(refreshed?.access_token,"token-B");
 assert.equal(refreshed?.refresh_token,"refresh-B");
 assert.equal(refreshCount,1);
 assert.equal((await verifyAccountSession())?.user.id,"u1");
 const homes=await listAccountHouseholds();assert.equal(homes.length,1);
 const created=await createAccountHousehold("Mi casa","Ana",{});assert.equal(created.householdId,"house-B");
 const read=await readAccountHousehold("house-A");assert.deepEqual(read.data,{inventory:[]});
 const revision=await writeAccountHousehold("house-A",{shopping:[]},4);assert.equal(revision,5);
 const inv=await inviteAccountMember("house-A");assert.equal(inv,"HOS2.invite");
 let rejected=false;
 try{await joinAccountHousehold("HOS1.bad","Ana")}catch{rejected=true}
 assert.equal(rejected,true,"legacy shared secret may not be used as a new member invitation");
 const uuid="12345678-1234-1234-1234-123456789abc";
 const hex="a".repeat(64);
 const joined=await joinAccountHousehold("HOS2."+uuid+"."+hex,"Ana");
 assert.equal(joined.householdId,"house-B");
 const migrated=await claimLegacyHousehold("HOS1."+uuid+"."+("b".repeat(43)),"Ana");
 assert.equal(migrated.householdId,"house-A");
 unauthorized=true;
 await assert.rejects(readAccountHousehold("house-A"),(e:any)=>e.code==="not_member");
 assert.equal(calls.filter(c=>c.path.endsWith("homeos_account_household_claim")).length,1);
 storage.set("homeos:account:u1:house-A:homeos:v5","sensitive-home");
 await signOutAccount();
 assert.equal(readAccountSession(),null);
 assert.equal(storage.has("homeos:account:u1:house-A:homeos:v5"),false);
 assert.ok(calls.some(c=>c.path==="/auth/v1/logout"),"server receives logout request");
 assert.equal(await currentAccountSession(),null);

 // The migration is deliberately a repo artifact, not yet applied to a live database.
 const sql=readFileSync(new URL("../supabase/migrations/20261014_secure_household_accounts.sql",import.meta.url),"utf8");
 for(const name of ["homeos_account_mine","homeos_account_household_create","homeos_account_household_claim",
   "homeos_account_household_read","homeos_account_household_write_v2","homeos_account_invite_create",
   "homeos_account_invite_redeem","homeos_account_members_list","homeos_account_member_remove","homeos_account_leave"]){
  assert.ok(sql.includes("function public."+name+"("),"secure procedure missing: "+name);
  assert.ok(sql.includes("revoke all on function public."+name+"("),"procedure must revoke public and anonymous execution");
  assert.ok(sql.includes("grant execute on function public."+name+"("),"procedure must grant authenticated only");
 }
 assert.ok(sql.includes("enable row level security;"),"membership tables must have RLS");
 assert.ok(sql.includes("access_token_hash=encode(extensions.digest(extensions.gen_random_bytes(32)"),"claim must invalidate legacy shared token");
 assert.ok(sql.includes("for update of h,i"),"invitation redemption must lock rows to prevent multiple joins");
 console.log("PASS: 27 account session, invite, membership-auth and staged-RLS migration checks");
}
void main().catch(err=>{console.error(err);process.exitCode=1});
