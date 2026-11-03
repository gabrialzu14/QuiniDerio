const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}
}).outputText,file);
const {publicationMessage,deliverRoundPublications}=require('../lib/round-publication-push.ts');

function mock(){
 const rows=[1,2,3,4,5].map(id=>({delivery_id:String(id),round:7,subscription_id:id,player_id:'user',
 endpoint:'https://push.example/'+id,p256dh:'key',auth:'auth',lease_token:'lease',attempts:1,status:'pending'}));
 const updates=[];
 const db={rpc:async()=>({data:rows.filter(r=>r.status==='pending').map(r=>{r.status='processing';return {...r}})}),
  from(table){let patch,filters={};const q={
   select(){return q},update(value){patch=value;return q},eq(key,value){filters[key]=value;return q},
   maybeSingle:async()=>({data:{enabled:filters.id!==4}}),
   single:async()=>({data:{expires_at:new Date(Date.now()+3600000).toISOString()}}),
   then(resolve,reject){
    updates.push({table,patch,filters});
    if(table==='quini_round_push_deliveries')Object.assign(rows.find(r=>r.delivery_id===filters.id),patch);
    return Promise.resolve({error:null}).then(resolve,reject);
   }
  };return q}
 };
 return {db,rows,updates};
}
(async()=>{
 assert.equal(publicationMessage(7).title,'Jornada 7 ya disponible');
 const {db,rows,updates}=mock();const calls=[];
 const send=async(sub,payload,options)=>{
  calls.push(sub.endpoint);assert.equal(JSON.parse(payload).tag,'quiniderio-round-available-7');
  assert.equal(options.timeout,10000);
  if(sub.endpoint.endsWith('/2'))throw {statusCode:410};
  if(sub.endpoint.endsWith('/3'))throw {statusCode:503};
  return {};
 };
 const first=await deliverRoundPublications(db,send);
 assert.deepEqual(first,{claimed:5,accepted:2,failed:1,expired:2});
 assert(!calls.some(s=>s.endsWith('/4')),'Unsubscribed devices never receive a push');
 assert(updates.some(x=>x.table==='push_subscriptions'&&x.filters.id===2&&x.patch.enabled===false));
 assert.equal(rows[2].last_error,'HTTP 503');
 assert(new Date(rows[2].next_attempt_at)>new Date());
 calls.length=0;
 await deliverRoundPublications(db,async(sub)=>{calls.push(sub.endpoint);return {}});
 assert.deepEqual(calls,['https://push.example/3'],'Retries exclude accepted and expired endpoints');
 assert.equal((await deliverRoundPublications(db,send)).claimed,0,'No duplicate sends after completion');
 await assert.rejects(deliverRoundPublications({rpc:async()=>({error:new Error('db unavailable')})},send));
 console.log('Passed: publication payload, all devices, retries, deduplication, unsubscribe, expiry and claim failure.');
})().catch(e=>{console.error(e);process.exitCode=1});
