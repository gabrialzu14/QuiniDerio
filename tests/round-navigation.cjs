const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const nodes=tree=>!tree||typeof tree!=='object'?[]:[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];
function harness(){
 let slots=[],index=0,pending=[];
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const effect=(fn,deps)=>{const i=index++,previous=slots[i];if(!previous||!same(previous.deps,deps)){slots[i]={deps,cleanup:previous?.cleanup};pending.push(()=>{slots[i].cleanup?.();slots[i].cleanup=fn()})}};
 const react={
  useState:initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next}]},
  useRef:initial=>{const i=index++;if(!(i in slots))slots[i]={current:initial};return slots[i]},
  useEffect:effect,useLayoutEffect:effect,
  useMemo:(fn,deps)=>{const i=index++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value}
 };
 const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'};
 const context={exports:{},require:name=>{if(name==='react')return react;if(name==='react/jsx-runtime')return jsx;throw Error(name)},...react,window:{matchMedia:()=>({matches:false}),scrollTo:()=>{}},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},Date,Set,Map,AbortController,console};
 return {context,render:fn=>{index=0;pending=[];return fn()},flush:()=>{for(const f of pending)f();pending=[]},load:source=>{context.exports={};vm.runInNewContext(compile(source),context);return context.exports}};
}
const pageSource=ts.createSourceFile('page.tsx',read('app/page.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const declaration=name=>pageSource.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name).getText(pageSource);
function pageFixture(name,destination=null){
 const h=harness();let active=4;
 const RoundRail=()=>null;
 const useRoundScope=h.load(read('app/components/useRoundScope.ts')).default;
 const coachContext={exports:{}};vm.runInNewContext(compile(read('app/lib/coach-change.ts')),coachContext);
 const {currentCoachName}=coachContext.exports;
 Object.assign(h.context,{currentCoachName,useRoundScope,useFixtures:()=>({}),useActiveRound:()=>active,useScrollReveal:()=>{},usePageScrollLock:()=>{},useBackDismiss:()=>{},AvatarImage:()=>null,rankingMoves:()=>new Map(),RankingMove:()=>null,teams:[],teamData:[],RoundRail,asset:p=>p,UsersIcon:()=>null,DinioImage:()=>null,quiniRoundOpeningKey:()=>null});
 const Component=h.load(declaration(name)+'\nexports.Component='+name+';').Component;
 const props=name==='Ranking'?{destination}:{picks:{},round:1,dinio:'NO',season:{positions:{}},onEdit:()=>{},onRequireLogin:()=>{}};
 const render=()=>h.render(()=>Component(props));
 const rail=()=>nodes(render()).find(n=>n.type===RoundRail).props;
 return {rail,setActive:n=>{active=n}};
}
for(const name of ['MyPredictions','Ranking']){
 const page=pageFixture(name);
 const startsInGeneral=name==='Ranking';
 assert.equal(page.rail().value,startsInGeneral?'all':4,name+' opens its intended default');
 page.setActive(7);assert.equal(page.rail().value,startsInGeneral?'all':7,'Settings hydration keeps General selected and updates the default prediction round');
 assert.equal(page.rail().enabledRounds.has(7),true,'The real current round stays available while fixtures load');
 page.rail().onChange(2);page.setActive(8);assert.equal(page.rail().value,2,'A deliberate historical selection must remain visible');
 page.rail().onChange('all');assert.equal(page.rail().value,'all','Season/general summaries remain selectable');
 page.rail().onChange(8);page.setActive(9);assert.equal(page.rail().value,9,'Returning to current resumes following the current round');
 const revisit=pageFixture(name);revisit.setActive(9);assert.equal(revisit.rail().value,startsInGeneral?'all':9,'Re-entry restores the section default instead of a previous manual choice');
}
for(const destination of ['hits','pot','self'])assert.equal(pageFixture('Ranking',destination).rail().value,'all','An explicit cumulative summary link keeps its intended destination');
{
 const h=harness(),scrolls=[];h.context.window.scrollTo=x=>scrolls.push(x);
 // Minimal session history: the Android back button must return to Inicio, not close the app.
 const listeners=[],stack=[{}];let at=0;
 const history={get state(){return stack[at]},get length(){return stack.length},pushState:st=>{stack.splice(at+1);stack.push(st);at++},replaceState:st=>{stack[at]=st},back:()=>{if(at>0){at--;for(const l of [...listeners])l({state:stack[at]})}}};
 Object.assign(h.context.window,{addEventListener:(t,l)=>{if(t==='popstate')listeners.push(l)},removeEventListener:(t,l)=>{const i=listeners.indexOf(l);if(i>=0)listeners.splice(i,1)}});
 h.context.history=history;
 Object.assign(h.context,{location:{href:'https://quiniderio.app/',pathname:'/',hash:''},navigator:{},URL,URLSearchParams});
 const useNavigation=h.load(read('app/components/useTabNavigation.ts')).default;
 const render=()=>h.render(()=>useNavigation());
 let nav=render();h.flush();assert.equal(nav.tab,'inicio');assert.equal(nav.entryKey,0);
 for(const next of ['pronosticos','clasificacion','pronosticos','pronosticos']){const before=nav.entryKey;nav.navigateTab(next);nav=render();h.flush();assert.equal(nav.tab,next);assert.equal(nav.entryKey,before+1,'Every tab entry, including tapping the current tab again, resets its round view')}
 assert.ok(scrolls.some(s=>s.behavior==='smooth'),'Tapping the active tab still scrolls to the top');
 assert.equal(history.length,2,'Switching between tabs keeps a single entry above Inicio');
 history.back();nav=render();h.flush();
 assert.equal(nav.tab,'inicio','Back from any tab returns to Inicio');
 nav.navigateTab('quiniela');nav=render();h.flush();nav.navigateTab('inicio');nav=render();h.flush();
 assert.equal(nav.tab,'inicio');assert.equal(history.state.qdTab??'inicio','inicio','Tapping Inicio reuses the Inicio entry');assert.equal(at,0);
}
{
 // Notifications and home-screen shortcuts open /?tab=…; back still returns to Inicio.
 const h=harness(),listeners=[],stack=[{}];let at=0,url='/?tab=quiniela';
 const history={get state(){return stack[at]},get length(){return stack.length},pushState:st=>{stack.splice(at+1);stack.push(st);at++},replaceState:(st,_t,u)=>{stack[at]=st;if(u!==undefined)url=u},back:()=>{if(at>0){at--;for(const l of [...listeners])l({state:stack[at]})}}};
 Object.assign(h.context.window,{scrollTo:()=>{},addEventListener:(t,l)=>{if(t==='popstate')listeners.push(l)},removeEventListener:()=>{}});
 Object.assign(h.context,{history,location:{href:'https://quiniderio.app/?tab=quiniela',pathname:'/',hash:''},navigator:{},URL,URLSearchParams});
 const mod=h.load(read('app/components/useTabNavigation.ts'));
 assert.equal(mod.tabFromUrl('/?tab=clasificacion'),'clasificacion');assert.equal(mod.tabFromUrl('/?tab=admin'),null);assert.equal(mod.tabFromUrl('/'),null);
 const render=()=>h.render(()=>mod.default());
 let nav=render();h.flush();nav=render();h.flush();
 assert.equal(nav.tab,'quiniela','?tab=quiniela opens the Quiniela tab');
 assert.equal(url,'/','The ?tab= query is removed after opening');
 history.back();nav=render();h.flush();
 assert.equal(nav.tab,'inicio','Back from a deep-linked tab returns to Inicio');
}
function railFixture({value=2,currentRound=4,reduced=false,enabledRounds=new Set([1,2,3,4,5])}={}){
 const h=harness();let frameId=0,frames=new Map(),changes=[],focus=[],animations=0;
 const buttons=new Map(['all',1,2,3,4,5].map((round,i)=>[String(round),{offsetLeft:i*80,offsetWidth:46,disabled:round!=='all'&&!enabledRounds.has(round),focus:()=>focus.push(round)}]));
 const rail={scrollLeft:0,clientWidth:220,scrollWidth:600,addEventListener:()=>{},removeEventListener:()=>{},querySelector:selector=>buttons.get(selector.match(/data-scope="([^"]+)"/)[1])};
 const arrow={animate:()=>{animations++;return {cancel:()=>{}}}},marker={style:{}};
 h.context.window.matchMedia=()=>({matches:reduced});
 h.context.requestAnimationFrame=fn=>{const id=++frameId;frames.set(id,fn);return id};h.context.cancelAnimationFrame=id=>frames.delete(id);
 const Component=h.load(read('app/components/RoundRail.tsx')).default;
 const props=()=>({value,currentRound,onChange:next=>{changes.push(next);value=next},rounds:[1,2,3,4,5],enabledRounds,initialLabel:'General',label:'Jornada'});
 const render=()=>{const tree=h.render(()=>Component(props()));for(const n of nodes(tree)){if(!n.props?.ref)continue;const cls=n.props.className||'';if(cls==='qdRoundRail')n.props.ref.current=rail;if(cls==='qdLaunchArrow')n.props.ref.current=arrow;if(cls==='qdRoundTrain')n.props.ref.current=marker}h.flush();return tree};
 const button=()=>nodes(render()).find(n=>n.props?.className==='qdAdvanceRound');
 const tick=time=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(time)};
 return {render,button,tick,stats:()=>({changes,focus,animations,frames:frames.size}),choose:round=>nodes(render()).find(n=>n.props?.['data-scope']===round).props.onClick(),rail};
}
{
 const general=railFixture({value:'all'});
 general.render();
 assert.equal(general.rail.scrollLeft,0,'Opening General must keep the complete label visible');
 const current=railFixture({value:4});
 current.render();
 assert.ok(current.rail.scrollLeft>0,'Opening a round must still align the current jornada toward the right');
}
assert.equal(railFixture({value:4}).button(),undefined,'Hide the jump action while already at current');
assert.equal(railFixture({value:2,enabledRounds:new Set([1,2])}).button(),undefined,'Never offer a disabled destination');
{
 const f=railFixture({value:'all'});const button=f.button();assert.match(button.props['aria-label'],/jornada 4/);button.props.onClick();assert.equal(f.button().props['aria-busy'],true,'A click gives immediate visible feedback');
 f.tick(0);f.tick(2000);assert.deepEqual(f.stats().changes,[4]);assert.deepEqual(f.stats().focus,[4]);assert.equal(f.stats().animations,1);assert.equal(f.button(),undefined);assert.equal(f.rail.scrollLeft,233,'The current round is centered after the animated scroll');
}
{
 const f=railFixture({reduced:true});f.button().props.onClick();assert.deepEqual(f.stats().changes,[4]);assert.deepEqual(f.stats().focus,[4]);assert.equal(f.stats().frames,0);assert.equal(f.stats().animations,0);assert.equal(f.button(),undefined,'Reduced-motion navigation is immediate and still hides the action');
}
{
 const f=railFixture();f.button().props.onClick();assert.ok(f.stats().frames);f.choose(1);assert.equal(f.stats().frames,0,'Manual selection cancels an in-progress jump');assert.deepEqual(f.stats().changes,[1]);assert.ok(f.button(),'Keep the action available when the visitor stays at a past round');
}
console.log('Passed round navigation: standings open in General, predictions at current, delayed settings, manual history, summaries, tab re-entry, conditional CTA, animated scroll, focus, cancellation and reduced motion.');
