const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),Module=require('node:module');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename);
process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='server-only-test';
const owner='11111111-1111-4111-8111-111111111111';
let players=[],subs=[],inserts=0,race=false,dbError=false;
const original=Module._load;
Module._load=function(name,...args){if(name==='@supabase/supabase-js')return {createClient:(url,key)=>{assert.equal(key,'server-only-test');return {auth:{getUser:async token=>({data:{user:token==='valid'?{id:owner}:null},error:token==='valid'?null:new Error('expired')})},from:table=>{
 let filters=[],operation='select',value;
 const result=()=>{
  if(dbError)return {data:null,error:{code:'08006'}};
  if(table==='quini_profiles')return {data:{username:'Existing Name'},error:null};
  const data=table==='players'?players:subs;
  const matching=()=>data.filter(row=>filters.every(([k,v])=>row[k]===v));
  if(operation==='insert'){
   inserts++;
   if(value.username==='Existing Name')return {data:null,error:{code:'23505',message:'players_username_lower_unique'}};
   // Reproduce an existing historical username belonging to another identity.
   const row={id:'owned-player',...value};players.push(row);
   if(race){race=false;return {data:null,error:{code:'23505'}}}
   return {data:row,error:null};
  }
  if(operation==='upsert'){
   const index=subs.findIndex(s=>s.endpoint===value.endpoint);
   if(index<0)subs.push({id:subs.length+1,...value});else subs[index]={...subs[index],...value};
   return {data:null,error:null};
  }
  if(operation==='update'){for(const row of matching())Object.assign(row,value);return {data:null,error:null}}
  if(operation==='delete'){subs=subs.filter(row=>!matching().includes(row));return {data:null,error:null}}
  return {data:matching(),error:null};
 };
 const chain={select:()=>chain,eq:(k,v)=>{filters.push([k,v]);return chain},limit:()=>chain,insert:v=>{operation='insert';value=v;return chain},upsert:v=>{operation='upsert';value=v;return chain},update:v=>{operation='update';value=v;return chain},delete:()=>{operation='delete';return chain},single:async()=>result(),maybeSingle:async()=>{const r=result();if(Array.isArray(r.data))r.data=r.data[0]||null;return r},then:(resolve,reject)=>Promise.resolve(result()).then(resolve,reject)};
 return chain;
}}}};return original.call(this,name,...args)};
const {POST,GET,DELETE}=require('../app/api/push/route.ts');
const req=(body,token='valid',method='POST')=>new Request('https://quiniderio.vercel.app/api/push',{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})});
const subscription={endpoint:'https://web.push.apple.com/test-device',keys:{p256dh:Buffer.alloc(65,4).toString('base64url'),auth:Buffer.alloc(16,1).toString('base64url')}};
(async()=>{
 players=[{id:'historical',auth_user_id:null,username:'Existing Name',notifications_enabled:false}];
 assert.equal((await POST(req({subscription},null))).status,401);assert.equal(inserts,0);
 assert.equal((await POST(req({subscription},'expired'))).status,401);
 assert.equal((await POST(req({subscription:{endpoint:'http://bad',keys:{}}}))).status,400);assert.equal(inserts,0,'Invalid input must not create an identity');
 const response=await POST(req({subscription,playerId:'historical',name:'Attacker'}));assert.equal(response.status,200);
 assert.equal(players.length,2);assert.equal(players[0].auth_user_id,null,'Do not claim history by display name');
 assert.equal(players[1].auth_user_id,owner);assert.equal(players[1].username,null,'Push registration must not reserve or duplicate the profile username');
 assert.equal(players[1].full_name,'Existing Name');assert.equal(subs[0].player_id,'owned-player');
 assert.equal(players[1].notifications_enabled,true);
 assert.deepEqual((await (await GET(req(null,'valid','GET'))).json()).endpoints,[subscription.endpoint]);
 subs[0].enabled=false;assert.equal((await POST(req({subscription}))).status,200);assert.equal(subs.length,1);assert.equal(subs[0].enabled,true);
 const second={...subscription,endpoint:'https://fcm.googleapis.com/test-device'};
 assert.equal((await POST(req({subscription:second}))).status,200);assert.equal(subs.length,2,'Keep other devices enabled');
 assert.equal((await DELETE(req({endpoint:subscription.endpoint},'valid','DELETE'))).status,200);assert.equal(subs.length,1);assert.equal(players[1].notifications_enabled,true);
 players=[players[0]];race=true;
 assert.equal((await POST(req({subscription}))).status,200,'Concurrent identity creation reuses the authenticated row');
 dbError=true;const savedError=console.error;console.error=()=>{};assert.equal((await POST(req({subscription}))).status,500);console.error=savedError;
 console.log('Passed push API: real username-collision regression, verified identity, history isolation, payload validation, session rejection, reactivation, multiple devices and concurrent creation.');
})().catch(e=>{console.error(e);process.exitCode=1});
