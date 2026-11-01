const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const output=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../app/lib/push-client.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const vapid=Buffer.concat([Buffer.from([4]),Buffer.alloc(64,1)]).toString('base64url');
function fixture({ios=true,standalone=true,permission='granted',existing=true,inactive=false,rotatedKey=false,slowPrompt=false,stuckEndpoint=false}={}){
 let currentSub,subscribeCalls=0,unsubscribes=0,permissions=0,requests=[],events=[],mode='ok',refreshes=0,token='valid',refreshFailed=false;
 let inGesture=false,gestureCalls=[],workerCalls=0,completePrompt,timerDelays=[];
 let endpoints=new Set(),inactiveEndpoints=new Set(inactive?['https://web.push.apple.com/device']:[]);
 const makeSub=endpoint=>({endpoint,toJSON:()=>({keys:{p256dh:'valid-client-key',auth:'valid-auth'}}),unsubscribe:async()=>{unsubscribes++;currentSub=null;return true}});
 currentSub=existing?makeSub('https://web.push.apple.com/device'):null;
 if(existing&&!inactive)endpoints.add(currentSub.endpoint);
 const notification={permission,requestPermission:async()=>{permissions++;gestureCalls.push(inGesture);notification.permission='granted';return 'granted'}};
 const reg={active:{},pushManager:{getSubscription:async()=>currentSub,subscribe:()=>{
  subscribeCalls++;gestureCalls.push(inGesture);
  if(rotatedKey&&currentSub){const e=new Error('Old VAPID key');e.name='InvalidStateError';return Promise.reject(e)}
  const finish=()=>{notification.permission='granted';return currentSub||(currentSub=makeSub(unsubscribes&&!stuckEndpoint?'https://web.push.apple.com/renewed':'https://web.push.apple.com/device'))};
  return slowPrompt&&notification.permission==='default'?new Promise(resolve=>{completePrompt=()=>resolve(finish())}):Promise.resolve(finish());
 }}};
 const nav={userAgent:ios?'iPhone':'Android',maxTouchPoints:5,serviceWorker:{register:async()=>{workerCalls++;return reg},ready:Promise.resolve(reg)}};
 const window={Notification:notification,PushManager:{},matchMedia:()=>({matches:standalone}),dispatchEvent:e=>events.push(e)};
 const supabase={auth:{getSession:async()=>({data:{session:token?{access_token:token}:null}}),refreshSession:async()=>{refreshes++;if(refreshFailed)return {data:{session:null},error:new Error('expired')};token='refreshed';return {data:{session:{access_token:token}},error:null}}}};
 const storage=new Map();
 const context={exports:{},require:name=>{assert.equal(name,'./supabase');return {supabase}},navigator:nav,window,Notification:notification,localStorage:{setItem:(k,v)=>storage.set(k,v)},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail}},process:{env:{NEXT_PUBLIC_VAPID_PUBLIC_KEY:vapid}},atob:s=>Buffer.from(s,'base64').toString('binary'),Uint8Array,AbortController,setTimeout:(fn,ms)=>{timerDelays.push(ms);return setTimeout(fn,ms)},clearTimeout,Error,fetch:async(url,init)=>{
  requests.push({url,...init});
  if(mode==='network')throw new TypeError('offline');
  const status=mode==='save'&&init.method!=='GET'?500:mode==='expired'&&init.headers.Authorization!=='Bearer refreshed'?401:200;
  if(status===200&&init.method==='POST'){const {subscription}=JSON.parse(init.body);if(subscription)endpoints.add(subscription.endpoint)}
  return {ok:status===200,status,json:async()=>status===200?(init.method==='GET'?{endpoints:[...endpoints],inactiveEndpoints:[...inactiveEndpoints]}:{ok:true}):{error:status===401?'unauthorized':'push'}};
 }};
 vm.runInNewContext(output,context);
 const click=()=>{inGesture=true;try{return context.exports.enablePush()}finally{inGesture=false}};
 return {api:context.exports,click,window,storage,notification,stats:()=>({subscribeCalls,unsubscribes,permissions,requests,events,refreshes,workerCalls,gestureCalls,timerDelays}),setMode:v=>{mode=v},setToken:v=>{token=v},failRefresh:()=>{refreshFailed=true},finishPrompt:()=>completePrompt(),resetTimers:()=>{timerDelays=[]}};
}
(async()=>{
 const a=fixture();a.setMode('save');await assert.rejects(a.click(),/save/);assert.equal(a.stats().unsubscribes,0);assert.equal(a.storage.has('quiniderio-notifications'),false);assert.equal(a.stats().permissions,0);
 a.setMode('ok');assert.equal(await a.click(),true);assert.equal(a.stats().unsubscribes,0,'A save failure must retain the valid browser subscription');assert.equal(a.storage.get('quiniderio-notifications'),'true');
 assert.equal(a.stats().requests.find(r=>r.method==='POST').body.includes('playerId'),false,'No client-supplied identity is trusted');
 const fresh=fixture({existing:false,permission:'default'});await fresh.api.getPushState();assert.equal(fresh.stats().subscribeCalls,0,'Preflight must never ask for notification permission');assert.equal(fresh.stats().permissions,0);
 await Promise.all([fresh.click(),fresh.click()]);assert.equal(fresh.stats().permissions,0,'Prepared browsers prompt through subscribe directly');assert.equal(fresh.stats().subscribeCalls,1);assert.equal(fresh.stats().gestureCalls[0],true,'Safari subscribe must run synchronously in the original tap');assert.equal(fresh.stats().workerCalls,1,'The worker must be ready before the tap');assert.equal(fresh.stats().requests.filter(r=>r.method==='POST').length,1,'Double click saves once');
 const early=fixture({existing:false,permission:'default'});assert.equal(await early.click(),true);assert.equal(early.stats().permissions,1);assert.equal(early.stats().gestureCalls[0],true,'An early tap requests permission before awaiting the worker');
 const slow=fixture({existing:false,permission:'default',slowPrompt:true});await slow.api.getPushState();slow.resetTimers();const waiting=slow.click();assert.equal(slow.stats().timerDelays.length,0,'Do not abandon the native permission dialog after ten seconds');slow.finishPrompt();assert.equal(await waiting,true);
 for(const ios of [true,false]){
  const expiredDevice=fixture({ios,inactive:true});assert.equal((await expiredDevice.api.getPushState()).enabled,false);assert.equal(await expiredDevice.click(),true);assert.equal(expiredDevice.stats().unsubscribes,1);const saved=JSON.parse(expiredDevice.stats().requests.find(r=>r.method==='POST').body).subscription;assert.equal(saved.endpoint,'https://web.push.apple.com/renewed','Never re-enable the old provider-revoked endpoint');assert.equal((await expiredDevice.api.getPushState()).enabled,true);
 }
 const stuck=fixture({inactive:true,stuckEndpoint:true});await assert.rejects(stuck.click(),/renew/);assert.equal(stuck.storage.has('quiniderio-notifications'),false,'No success message for a still-expired subscription');assert.equal(stuck.stats().requests.filter(r=>r.method==='POST').length,0);
 const rotated=fixture({rotatedKey:true});await rotated.api.getPushState();assert.equal(await rotated.click(),true);assert.equal(rotated.stats().unsubscribes,1,'Replace a subscription created with an old VAPID key');assert.equal(rotated.stats().subscribeCalls,2);
 const offline=fixture();offline.setMode('network');await assert.rejects(offline.click(),/network/);assert.equal(offline.stats().unsubscribes,0);assert.equal((await offline.api.getPushState()).verified,false);
 const expired=fixture();expired.setMode('expired');assert.equal(await expired.click(),true);assert.equal(expired.stats().refreshes,1);
 const test=fixture();test.setMode('expired');assert.equal(await test.api.testPush(),true);assert.equal(test.stats().refreshes,1);assert.equal(test.stats().requests[1].url,'/api/push/test');
 const lost=fixture();lost.setMode('expired');lost.failRefresh();await assert.rejects(lost.click(),/login/);assert.equal(lost.stats().unsubscribes,0);
 const denied=fixture({permission:'denied'});await assert.rejects(denied.click(),/denied/);assert.equal(denied.stats().requests.length,0);denied.notification.permission='default';await denied.api.getPushState();assert.equal(await denied.click(),true,'Retry works after the user unblocks notifications in system settings');
 const safari=fixture({standalone:false});await assert.rejects(safari.click(),/install/);
 const native=fixture();native.window.webkit={messageHandlers:{quiniWidgets:{}}};await assert.rejects(native.click(),/native/);
 const android=fixture({ios:false,standalone:false});assert.equal(await android.click(),true);assert.equal((await android.api.getPushState()).enabled,true);await android.api.disablePush();assert.equal(android.stats().unsubscribes,1);
 const failedDelete=fixture();failedDelete.setMode('save');await assert.rejects(failedDelete.api.disablePush(),/save/);assert.equal(failedDelete.stats().unsubscribes,0);
 console.log('Passed push client: direct Safari gesture, preflight without prompts, early taps, slow native dialogs, Android/iOS expired endpoint renewal, VAPID rotation, retry without data loss, double clicks, JWT refresh, blocked-permission recovery and verified server state.');
})().catch(e=>{console.error(e);process.exitCode=1});
