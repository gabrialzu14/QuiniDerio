const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const transpile=file=>ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const policy={exports:{}};vm.runInNewContext(transpile('app/lib/push-prompt-policy.ts'),policy);
const {PUSH_PROMPT_SEEN_KEY,PUSH_PROMPT_INTERVAL,pushPromptDue}=policy.exports;
const source=transpile('app/components/PushPrompt.tsx');
const initial=Date.parse('2026-11-01T18:00:00Z');
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
function mount({storage=new Map(),now=initial,enabled=false,verified=true,blocked=false,storageBlocked=false}={}){
 let hooks=[],index=0,effects=[],timers=new Map(),nextId=1,cleanup=[],gate,activationCalls=0;
 const listeners=new Map();
 const add=(name,fn)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn)};
 const remove=(name,fn)=>listeners.get(name)?.delete(fn);
 const emit=name=>{for(const fn of listeners.get(name)||[])fn({type:name})};
 const schedule=(fn,delay)=>{const id=nextId++;timers.set(id,{fn,time:now+delay});return id};
 const react={useState:initial=>{const i=index++;if(!(i in hooks))hooks[i]=initial;return [hooks[i],v=>{hooks[i]=typeof v==='function'?v(hooks[i]):v}]},useRef:initial=>{const i=index++;if(!(i in hooks))hooks[i]={current:initial};return hooks[i]},useEffect:fn=>{effects.push(fn)}};
 const client={getPushState:async()=>({supported:true,enabled,verified,permission:'default'}),enablePush:async()=>{activationCalls++;if(gate)await gate;enabled=true;emit('quiniderio-push-state');return true},pushErrorMessage:String};
 const localStorage={getItem:key=>{if(storageBlocked&&key!=="quiniderio-player")throw Error('storage');return key==='quiniderio-player'?JSON.stringify({userId:'test-user',completed:true}):storage.get(key)||null},setItem:(key,value)=>{if(storageBlocked)throw Error('storage');storage.set(key,value)}};
 const runtime={exports:{},require:name=>name==='react'?react:name==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:name==='../lib/push-client'?client:name==='../lib/push-prompt-policy'?{...policy.exports,pushPromptDue:value=>pushPromptDue(value,now)}:name==='./usePageScrollLock'?{default:()=>{}}:(()=>{throw Error(name)})(),localStorage,Date:class extends Date{static now(){return now}},navigator:{serviceWorker:{getRegistration:async()=>undefined}},document:{visibilityState:'visible',querySelector:()=>blocked?{}:null,addEventListener:add,removeEventListener:remove},window:{addEventListener:add,removeEventListener:remove,setInterval:()=>nextId++,clearInterval:()=>{}},setTimeout:schedule,clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(source,runtime);
 const render=()=>{index=0;effects=[];return runtime.exports.default()};
 render();for(const effect of effects){const fn=effect();if(fn)cleanup.push(fn)}
 const tick=async(ms)=>{
  const end=now+ms;
  for(let i=0;i<100;i++){
   await flush();const due=[...timers.entries()].filter(([,t])=>t.time<=end).sort((a,b)=>a[1].time-b[1].time)[0];
   if(!due)break;
   const[id,t]=due;timers.delete(id);now=t.time;t.fn();
  }
  now=end;await flush();return render();
 };
 const nodes=value=>!value||typeof value!=='object'?[]:[value,...[value.props?.children].flat(Infinity).flatMap(nodes)];
 const button=label=>nodes(render()).find(v=>v.type==='button'&&v.props.children===label);
 return {tick,render,storage,emit,button,stats:()=>({activationCalls}),setState:state=>{if("enabled"in state)enabled=state.enabled;if("verified"in state)verified=state.verified},unmount:()=>cleanup.forEach(fn=>fn()),hide:()=>{runtime.document.visibilityState='hidden';emit('visibilitychange')},show:()=>{runtime.document.visibilityState='visible';emit('visibilitychange')},unblock:()=>{blocked=false},holdActivation:()=>{let release;gate=new Promise(resolve=>{release=resolve});return release}};
}
(async()=>{
 assert.equal(pushPromptDue(null,initial),true);assert.equal(pushPromptDue('invalid',initial),true);assert.equal(pushPromptDue(String(initial),initial+PUSH_PROMPT_INTERVAL-1),false);assert.equal(pushPromptDue(String(initial),initial+PUSH_PROMPT_INTERVAL),true);
 const first=mount();assert.ok(await first.tick(650));const seen=first.storage.get(PUSH_PROMPT_SEEN_KEY);assert.equal(Number(seen),initial+650,'Record appearance before any dismissal');
 first.button('Ahora no').props.onClick();assert.equal(await first.tick(360),null);first.hide();first.show();first.emit('focus');assert.equal(await first.tick(650),null,'Returning from background must not reopen the reminder');first.unmount();
 const reload=mount({storage:first.storage,now:Number(seen)+1000});assert.equal(await reload.tick(650),null,'A new visit must keep the weekly cooldown');reload.unmount();
 const beforeWeek=mount({storage:first.storage,now:Number(seen)+PUSH_PROMPT_INTERVAL-1000});assert.equal(await beforeWeek.tick(650),null);beforeWeek.unmount();
 const nextWeek=mount({storage:first.storage,now:Number(seen)+PUSH_PROMPT_INTERVAL});assert.ok(await nextWeek.tick(650),'Show the next reminder once seven days have elapsed');nextWeek.unmount();
 const enabled=mount({enabled:true});assert.equal(await enabled.tick(650),null);assert.equal(enabled.storage.has(PUSH_PROMPT_SEEN_KEY),false);enabled.unmount();
 const activeStorage=new Map([['quiniderio-notifications','true'],[PUSH_PROMPT_SEEN_KEY,String(initial-1000)]]);
 const activeDevice=mount({enabled:true,storage:activeStorage});assert.equal(await activeDevice.tick(650),null);activeDevice.hide();activeDevice.show();assert.equal(await activeDevice.tick(650),null);assert.equal(activeDevice.stats().activationCalls,0,'Do not register again or change existing active notifications');assert.equal(activeStorage.get('quiniderio-notifications'),'true');assert.equal(activeStorage.get(PUSH_PROMPT_SEEN_KEY),String(initial-1000));activeDevice.unmount();
 const unknownState=mount({verified:false,storage:new Map([['quiniderio-notifications','true']])});assert.equal(await unknownState.tick(650),null,'An unverified network/session error must not show a repair prompt to an active user');assert.equal(unknownState.storage.has(PUSH_PROMPT_SEEN_KEY),false);assert.equal(unknownState.storage.get('quiniderio-notifications'),'true');unknownState.setState({verified:true,enabled:true});unknownState.emit('focus');assert.equal(await unknownState.tick(650),null);assert.equal(unknownState.stats().activationCalls,0);unknownState.unmount();
 const laterInactive=mount({verified:false});assert.equal(await laterInactive.tick(650),null);laterInactive.setState({verified:true,enabled:false});laterInactive.emit('focus');assert.ok(await laterInactive.tick(650),'Show the notice only after the device is confirmed inactive');laterInactive.unmount();
 const otherDialog=mount({blocked:true});assert.equal(await otherDialog.tick(650),null);assert.equal(otherDialog.storage.has(PUSH_PROMPT_SEEN_KEY),false,'Do not consume the week while another dialog is open');otherDialog.unblock();assert.ok(await otherDialog.tick(600));otherDialog.unmount();
 const privateMode=mount({storageBlocked:true});assert.ok(await privateMode.tick(650));privateMode.button('Ahora no').props.onClick();await privateMode.tick(360);privateMode.emit('focus');assert.equal(await privateMode.tick(650),null,'Storage errors must not crash or spam the current visit');privateMode.unmount();
 const activating=mount();await activating.tick(650);const release=activating.holdActivation();const pending=activating.button('Activar notificaciones').props.onClick();activating.emit('quiniderio-push-state');await activating.tick(650);assert.equal(activating.button('Activando…').props.disabled,true);release();await pending;await activating.tick(650);assert.ok(activating.render(),'The success dialog must survive the state-change event');assert.equal(await activating.tick(2000),null);activating.unmount();
 console.log('Passed weekly push prompt: appearance timestamp, legacy cooldown, revisit/background suppression, seven-day boundary, enabled users, overlapping dialogs, storage errors and activation/success race.');
})().catch(error=>{console.error(error);process.exitCode=1});
