const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const output=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../app/lib/push-client.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function fixture({ios=true,standalone=true,permission='granted',existing=true}={}){
 let currentSub,subscribeCalls=0,unsubscribes=0,permissions=0,requests=[],events=[],mode='ok',refreshes=0,token='valid',refreshFailed=false;
 const subscription={endpoint:'https://web.push.apple.com/device',toJSON:()=>({keys:{p256dh:'valid-client-key',auth:'valid-auth'}}),unsubscribe:async()=>{unsubscribes++;currentSub=null;return true}};
 currentSub=existing?subscription:null;
 const storage=new Map();
 const reg={pushManager:{getSubscription:async()=>currentSub,subscribe:async()=>{subscribeCalls++;currentSub=subscription;return subscription}}};
 const nav={userAgent:ios?'iPhone':'Android',maxTouchPoints:5,serviceWorker:{register:async()=>reg,ready:Promise.resolve(reg)}};
 const notification={permission,requestPermission:async()=>{permissions++;notification.permission='granted';return 'granted'}};
 const window={Notification:notification,PushManager:{},matchMedia:()=>({matches:standalone}),dispatchEvent:e=>events.push(e)};
 const supabase={auth:{getSession:async()=>({data:{session:token?{access_token:token}:null}}),refreshSession:async()=>{refreshes++;if(refreshFailed)return {data:{session:null},error:new Error('expired')};token='refreshed';return {data:{session:{access_token:token}},error:null}}}};
 const context={exports:{},require:name=>{assert.equal(name,'./supabase');return {supabase}},navigator:nav,window,Notification:notification,localStorage:{setItem:(k,v)=>storage.set(k,v)},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail}},process:{env:{NEXT_PUBLIC_VAPID_PUBLIC_KEY:'BAAAAA'}},atob:s=>Buffer.from(s,'base64').toString('binary'),Uint8Array,AbortController,setTimeout,clearTimeout,Error,fetch:async(url,init)=>{
  requests.push({url,...init});
  if(mode==='network')throw new TypeError('offline');
  const status=mode==='save'?500:mode==='expired'&&init.headers.Authorization!=='Bearer refreshed'?401:200;
  return {ok:status===200,status,json:async()=>status===200?(init.method==='GET'?{endpoints:[subscription.endpoint]}:{ok:true}):{error:status===401?'unauthorized':'push'}};
 }};
 vm.runInNewContext(output,context);
 return {api:context.exports,window,storage,notification,stats:()=>({subscribeCalls,unsubscribes,permissions,requests,events,refreshes}),setMode:v=>{mode=v},setToken:v=>{token=v},failRefresh:()=>{refreshFailed=true}};
}
(async()=>{
 const a=fixture();a.setMode('save');await assert.rejects(a.api.enablePush(),/save/);assert.equal(a.stats().unsubscribes,0);assert.equal(a.storage.has('quiniderio-notifications'),false);assert.equal(a.stats().permissions,0);
 a.setMode('ok');assert.equal(await a.api.enablePush(),true);assert.equal(a.stats().subscribeCalls,0,'Retry reuses the existing browser subscription');assert.equal(a.storage.get('quiniderio-notifications'),'true');
 assert.equal(a.stats().requests[1].body.includes('playerId'),false,'No client-supplied identity is trusted');
 const fresh=fixture({existing:false,permission:'default'});await Promise.all([fresh.api.enablePush(),fresh.api.enablePush()]);assert.equal(fresh.stats().permissions,1);assert.equal(fresh.stats().subscribeCalls,1);assert.equal(fresh.stats().requests.length,1,'Double click creates one registration request');
 const offline=fixture();offline.setMode('network');await assert.rejects(offline.api.enablePush(),/network/);assert.equal(offline.stats().unsubscribes,0);assert.equal((await offline.api.getPushState()).verified,false);
 const expired=fixture();expired.setMode('expired');assert.equal(await expired.api.enablePush(),true);assert.equal(expired.stats().refreshes,1);assert.equal(expired.stats().requests.length,2);
 const test=fixture();test.setMode('expired');assert.equal(await test.api.testPush(),true);assert.equal(test.stats().refreshes,1);assert.equal(test.stats().requests[1].url,'/api/push/test');
 const lost=fixture();lost.setMode('expired');lost.failRefresh();await assert.rejects(lost.api.enablePush(),/login/);assert.equal(lost.stats().unsubscribes,0);
 const denied=fixture({permission:'denied'});await assert.rejects(denied.api.enablePush(),/denied/);assert.equal(denied.stats().requests.length,0);
 const safari=fixture({standalone:false});await assert.rejects(safari.api.enablePush(),/install/);
 const native=fixture();native.window.webkit={messageHandlers:{quiniWidgets:{}}};await assert.rejects(native.api.enablePush(),/native/);
 const android=fixture({ios:false,standalone:false});assert.equal(await android.api.enablePush(),true);assert.equal((await android.api.getPushState()).enabled,true);await android.api.disablePush();assert.equal(android.stats().unsubscribes,1);
 const failedDelete=fixture();failedDelete.setMode('save');await assert.rejects(failedDelete.api.disablePush(),/save/);assert.equal(failedDelete.stats().unsubscribes,0);
 console.log('Passed push client: iOS gesture, granted permission, retained subscription on failure, retry, deduplicated clicks, JWT refresh, offline state, PWA/native distinction and Android activation/deactivation.');
})().catch(e=>{console.error(e);process.exitCode=1});
