"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {supabase} from "../lib/supabase";
import {publishedQuiniRounds} from "../lib/quiz-fixtures";
import "./admin.css";
import MatchEditor from "./MatchEditor";
import CreateRound from "./CreateRound";
import type {ManagedMatch} from "../lib/match-details";
const ADMIN="gabrialzueta@gmail.com";
const PUBLISHED_ROUNDS=publishedQuiniRounds();
const CURRENT_ROUND=PUBLISHED_ROUNDS[PUBLISHED_ROUNDS.length-1]??1;
type Match=ManagedMatch&{round:number,team:string,opponent:string,home_score:number,away_score:number,yellow_cards:number,red_cards:number,status:"scheduled"|"live"|"finished"|"suspended",is_home:boolean|null};
type Card={id:string,round:number,team:string,person:string,card_type:"yellow"|"red",created_at:string};
type View="matches"|"pending"|"round"|"create";
const STAFF:Record<string,string[]>={"Derio A":["Nando Alonso","Julen de Miguel","Gabri Alzueta"],"Derio B":["Gorka Barrio","David Perez","Mikel Elejalde"],"Derio Fem":["Iker Ibarluzea","Galder Ferreiro","Omar El Kabouri"],"Derio Fem B":["Ibai Mateos","Eneko Sanchez","Aner Taranilla"],"Juvenil A":["Peio Garcia","Koldo Corral"],"Juvenil B":["Mikel Tara","Asel Ibañez"],"Cadete B":["Gaizka Garcia","Galder Carreras"]};
export default function AdminPage(){
 const[allowed,setAllowed]=useState<boolean|null>(null);
 const[matches,setMatches]=useState<Match[]>([]),[cards,setCards]=useState<Card[]>([]);
 const[busy,setBusy]=useState(""),[loading,setLoading]=useState(true);
 const[message,setMessage]=useState<{kind:"success"|"error",text:string}|null>(null);
 const[loadError,setLoadError]=useState("");
 const[pending,setPending]=useState<{user_id:string,username:string,sent:number,total:number}[]>([]);
 const[pendingError,setPendingError]=useState(false);
 const[round,setRound]=useState(CURRENT_ROUND),[view,setView]=useState<View>("matches"),[filter,setFilter]=useState("all");
 const[publishedRounds,setPublishedRounds]=useState<number[]>(PUBLISHED_ROUNDS);
 const[activeRound,setActiveRound]=useState<number|null>(null);
 const[activeRoundError,setActiveRoundError]=useState("");
 const[theme,setTheme]=useState("dark"),[reminderSending,setReminderSending]=useState("");
 const[reminderSent,setReminderSent]=useState<Record<string,boolean>>({});
 const[picker,setPicker]=useState<{team:string,type:"yellow"|"red"}|null>(null);
 const requestId=useRef(0);
 const load=useCallback(async(selectedRound:number,quiet=false)=>{
  const id=++requestId.current;if(!quiet)setLoading(true);setLoadError("");setPendingError(false);
  try{
   const {data:{session}}=await supabase.auth.getSession();
   const [matchResult,cardResult,pendingResult]=await Promise.all([
    supabase.from("quini_live_matches").select("*").eq("round",selectedRound).order("scheduled_at",{ascending:true}),
    supabase.from("quini_match_cards").select("*").eq("round",selectedRound).order("created_at",{ascending:true}),
    session?fetch("/api/admin/pending?round="+selectedRound,{headers:{Authorization:"Bearer "+session.access_token}}).catch(()=>null):Promise.resolve(null)
   ]);
   if(id!==requestId.current)return;
   if(matchResult.error||cardResult.error)throw new Error("load");
   setMatches((matchResult.data||[]) as Match[]);setCards((cardResult.data||[]) as Card[]);
   const json=await pendingResult?.json().catch(()=>null);if(id!==requestId.current)return;
   setPending(pendingResult?.ok?(json?.pending||[]):[]);setPendingError(!pendingResult?.ok);return true;
  }catch{if(id===requestId.current){setMatches([]);setCards([]);setPending([]);setLoadError("No se ha podido cargar la jornada. Inténtalo de nuevo.")}return false}
  finally{if(id===requestId.current)setLoading(false)}
 },[]);
 useEffect(()=>{document.body.classList.add("qd-mounted");return()=>document.body.classList.remove("qd-mounted")},[]);
 useEffect(()=>{
  setTheme(document.documentElement.dataset.theme||"dark");let active=true;
  const verify=async()=>{const {data:{session}}=await supabase.auth.getSession();let user=session?.user||null;if(session){const fresh=await supabase.auth.getUser();user=fresh.data.user||user}if(active)setAllowed(user?.email?.trim().toLowerCase()===ADMIN)};
  void verify();const {data:listener}=supabase.auth.onAuthStateChange(()=>{setTimeout(()=>{if(active)void verify()},0)});
  return()=>{active=false;listener.subscription.unsubscribe();requestId.current++};
 },[]);
 useEffect(()=>{
  if(!allowed)return;
  let active=true;
  const loadList=async()=>{
   const [games,rests]=await Promise.all([
    supabase.from("quini_live_matches").select("round"),
    supabase.from("quini_rest_fixtures").select("round")
   ]);
   if(!active||games.error||rests.error)return;
   const all=new Set([...PUBLISHED_ROUNDS,...(games.data||[]).map(v=>v.round),...(rests.data||[]).map(v=>v.round)]);
   setPublishedRounds([...all].sort((a,b)=>a-b));
  };
  const loadCurrentRound=async()=>{
   const {data,error}=await supabase.from("quini_app_settings").select("active_round").eq("id",1).maybeSingle();
   if(!active)return;
   if(error||!data){setActiveRoundError("No se ha podido consultar la jornada activa.");return}
   setActiveRoundError("");
   setActiveRound(Number(data.active_round));
  };
  void loadList();
  void loadCurrentRound();
  const interval=window.setInterval(()=>{
   if(document.visibilityState==="visible"){void loadList();void loadCurrentRound()}
  },20000);
  const resume=()=>{if(document.visibilityState==="visible"){void loadCurrentRound();void loadList()}};
  document.addEventListener("visibilitychange",resume);
  return()=>{active=false;window.clearInterval(interval);document.removeEventListener("visibilitychange",resume)};
 },[allowed]);
 const syncPromiseRef=useRef<Promise<void>|null>(null);
 useEffect(()=>{
  if(!allowed)return;
  let active=true;
  if(!syncPromiseRef.current){
   syncPromiseRef.current=fetch("/api/rounds/sync",{method:"POST",cache:"no-store"})
    .then(response=>{if(!response.ok)throw new Error("fixture_sync")})
    .catch(()=>{syncPromiseRef.current=null});
  }
  void syncPromiseRef.current.then(()=>{if(active)void load(round)});
  return()=>{active=false};
 },[round,allowed,load]);
 const sendAction=async(team:string,action:string,extra:Record<string,unknown>={})=>{
  const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error("session");
  const res=await fetch("/api/admin/live",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({round,team,action,...extra})});if(!res.ok){const json=await res.json().catch(()=>null);throw new Error(json?.message||"No se ha podido guardar el cambio. Comprueba la conexión e inténtalo de nuevo.")};
 };
 const act=async(team:string,action:string,extra:Record<string,unknown>={})=>{
  if(busy)return;setBusy(team+action);setMessage(null);
  try{await sendAction(team,action,extra);setPicker(null);if(await load(round,true)){setMessage({kind:"success",text:"Cambios guardados · "+team});return true}return false}
  catch(e){setMessage({kind:"error",text:e instanceof Error?e.message:"No se ha podido guardar el cambio."});return false}finally{setBusy("")}
 };
 const remind=async(playerId:string)=>{
  setReminderSending(playerId);setMessage(null);
  try{const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error("session");const res=await fetch("/api/admin/pending",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({playerId,round})});if(!res.ok)throw new Error("push");setReminderSent(v=>({...v,[playerId]:true}));setMessage({kind:"success",text:"Recordatorio enviado."})}
  catch{setMessage({kind:"error",text:"No se ha podido enviar el recordatorio. Inténtalo de nuevo."})}finally{setReminderSending("")}
 };
 const finishRound=async()=>{
  if(busy||!window.confirm("¿Finalizar todos los partidos que están en juego?"))return;setBusy("bulk");setMessage(null);
  try{for(const match of matches.filter(m=>m.status==="live"))await sendAction(match.team,"finish");if(await load(round,true))setMessage({kind:"success",text:"Partidos en juego finalizados."})}
  catch{await load(round,true);setMessage({kind:"error",text:"No se han podido finalizar todos los partidos. Revisa sus estados antes de volver a intentarlo."})}finally{setBusy("")}
 };
 const advanceRound=async()=>{
  if(activeRound===null||busy)return;
  const next=activeRound+1;
  if(!publishedRounds.includes(next)){setMessage({kind:"error",text:"Debes crear la Jornada "+next+" antes de activarla."});return}
  if(!window.confirm("¿Activar la Jornada "+next+" para todos los jugadores? La quiniela nueva pasará a ser la jornada actual, pero se conservarán las anteriores."))return;
  setBusy("advance");setMessage(null);
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw new Error("La sesión ha caducado. Vuelve a acceder al panel.");
   const response=await fetch("/api/admin/advance-round",{
    method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
    body:JSON.stringify({expectedRound:activeRound})
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok||!result.ok)throw new Error(result.error||"No se ha podido activar la jornada.");
   const advanced=Number(result.activeRound);
   setActiveRound(advanced);
   changeRound(advanced);
   setView("round");
   window.dispatchEvent(new Event("quini-round-advanced"));
   setMessage({kind:"success",text:"Jornada "+advanced+" activada. Los jugadores ya pueden acceder a la nueva quiniela."});
   void load(advanced,true);
  }catch(error){
   setMessage({kind:"error",text:error instanceof Error?error.message:"No se ha podido avanzar de jornada."});
  }finally{setBusy("")}
 };
 const changeRound=(n:number)=>{setRound(n);setPicker(null);setReminderSent({});setMessage(null);setFilter("all")};
 const changeTheme=()=>{const next=theme==="light"?"dark":"light";setTheme(next);document.documentElement.dataset.theme=next;localStorage.setItem("quiniderio-theme",next)};
 const live=matches.filter(m=>m.status==="live").length,finished=matches.filter(m=>m.status==="finished").length;
 const visibleMatches=filter==="all"?matches:matches.filter(m=>m.status===filter),locked=!!busy||loading;
 if(allowed===null)return <main className="adminAccess"><section role="status"><div className="adminLoadingMark"/><h1>Cargando administración…</h1><p>Comprobando tu sesión.</p></section></main>;
 if(!allowed)return <main className="adminAccess"><section><span className="adminEyebrow">QUINIDERIO · ADMINISTRACIÓN</span><h1>Acceso restringido</h1><p>Este panel no está disponible para esta cuenta.</p><a className="adminPrimary" href="/">Volver a QuiniDerio</a></section></main>;
 return <main className="adminWorkspace">
  <header className="adminTopbar"><a href="/" className="adminBrand" aria-label="Volver a QuiniDerio"><img src="/api/assets/branding/LogoApp.png" alt=""/><span><b className="qdWordmark"><span className="qd-quini">QUINI</span><span className="qd-de">DE</span><span className="qd-rio">RIO</span></b><small>ADMINISTRACIÓN</small></span></a><div><button className="adminTheme" onClick={changeTheme} aria-label={theme==="light"?"Activar modo oscuro":"Activar modo claro"}>{theme==="light"?"☾ Oscuro":"☀ Claro"}</button><a className="adminBack" href="/">‹ Volver a la app</a></div></header>
  <section className="adminIntro"><div><span className="adminEyebrow">TEMPORADA 2026/27</span><h1>Panel Admin</h1><p>Datos de los partidos, resultados y tarjetas se comparten con todos los usuarios.</p></div><span className="adminRoundBadge">Jornada {round}</span></section>
  <section className="adminRoundSelector" aria-label="Jornada activa"><div><b>Selecciona la jornada</b><small>Jornada activa para jugadores: {activeRound===null?"Cargando…":"J"+activeRound}. Los controles se aplican a la jornada seleccionada.</small></div><nav aria-label="Seleccionar jornada">{publishedRounds.map(n=><button type="button" key={n} disabled={!!busy||!!reminderSending} aria-current={round===n?"page":undefined} aria-label={"Jornada "+n} className={round===n?"active":""} onClick={()=>changeRound(n)}>J{n}</button>)}<button type="button" className="adminCreateRoundTrigger" aria-current={view==="create"?"page":undefined}
  onClick={()=>{setView("create");setMessage(null)}}>+ Crear jornada</button></nav></section>
  <div className="adminSummary" aria-label="Resumen de jornada" aria-busy={loading}><article><span>Partidos</span><strong>{loading?"—":matches.length}</strong><small>En esta jornada</small></article><article className="adminSummaryLive"><span>En juego</span><strong>{loading?"—":live}</strong><small>Control en directo</small></article><article><span>Finalizados</span><strong>{loading?"—":finished}</strong><small>Resultados cerrados</small></article><article><span>Pronósticos pendientes</span><strong>{loading||pendingError?"—":pending.length}</strong><small>Participantes por avisar</small></article></div>
  <nav className="adminViewTabs" aria-label="Secciones de administración">{([["matches","Partidos"],["pending","Pronósticos pendientes"],["round","Control de jornada"],["create","Crear jornada"]] as [View,string][]).map(([key,label])=><button type="button" key={key} aria-current={view===key?"page":undefined} className={view===key?"active":""} onClick={()=>setView(key)}>{label}</button>)}</nav>
  {message&&<div className={"adminFeedback "+message.kind} role={message.kind==="error"?"alert":"status"}>{message.text}<button aria-label="Cerrar aviso" onClick={()=>setMessage(null)}>×</button></div>}
  {view!=="create"&&loadError?<section className="adminEmpty" role="alert"><h2>No se ha podido cargar la jornada</h2><p>{loadError}</p><button className="adminPrimary" onClick={()=>void load(round)}>Reintentar</button></section>:view!=="create"&&loading?<section className="adminLoading" role="status"><div className="adminLoadingMark"/><p>Cargando jornada {round}…</p></section>:<>
   {view==="create"&&<CreateRound nextRound={Math.max(0,...publishedRounds)+1}
    onCreated={created=>{
     setPublishedRounds(prev=>[...new Set([...prev,created])].sort((a,b)=>a-b));
     changeRound(created);
     setView("matches");
     setMessage({kind:"success",text:"Jornada "+created+" creada y publicada correctamente. Ya puedes editar sus partidos."});
     void load(created,true);
    }}/>}
   {view==="matches"&&<section aria-labelledby="admin-matches-title"><div className="adminSectionHeading"><div><h2 id="admin-matches-title">Partidos de la jornada</h2><p>Edita los equipos, horarios, campo, clasificación y forma de cada encuentro.</p></div><label className="adminFilter">Mostrar<select aria-label="Filtrar partidos" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos los partidos</option><option value="live">En juego</option><option value="scheduled">Por jugar</option><option value="finished">Finalizados</option><option value="suspended">Suspendidos</option></select></label></div>
   {visibleMatches.length?<div className="adminMatchGrid">{visibleMatches.map(m=>{
    const teamCards=cards.filter(c=>c.team===m.team),isHome=m.is_home===true,home=isHome?(m.fixture_details?.teamLabel||m.team):m.opponent,away=isHome?m.opponent:(m.fixture_details?.teamLabel||m.team),scoreLocked=locked||m.status==="finished";
    return <article className="adminMatchCard" key={m.team} aria-label={m.team+" contra "+m.opponent} aria-busy={busy.startsWith(m.team)}>
     <header className="adminMatchHeader"><b>{m.team}</b></header>
     <div className="adminScoreboard"><ScoreControl label="Local" team={home} value={m.home_score} disabled={scoreLocked} onRemove={()=>void act(m.team,"homeGoalRemove")} onAdd={()=>void act(m.team,"homeGoal")}/><span className="adminScoreDivider" aria-hidden="true">:</span><ScoreControl label="Visitante" team={away} value={m.away_score} disabled={scoreLocked} onRemove={()=>void act(m.team,"awayGoalRemove")} onAdd={()=>void act(m.team,"awayGoal")}/></div>
     <div className="adminHomeOrder"><span>{m.is_home===null?"Local y visitante por confirmar":"Orden local / visitante"}</span><button disabled={locked} onClick={()=>void act(m.team,"setHome",{isHome:!isHome})}><AdminIcon name="swap"/> {m.is_home===null?"Definir local":"Invertir orden"}</button></div>
     <div className="adminMatchTools"><div className="adminMatchLifecycle">{m.status==="scheduled"?<button className="adminPrimary" disabled={locked||m.is_home===null} onClick={()=>void act(m.team,"start")}><AdminIcon name="play"/> Iniciar partido</button>:m.status==="live"?<button className="adminFinish" disabled={locked} onClick={()=>{if(window.confirm("¿Finalizar este partido? Podrás reabrirlo desde el panel."))void act(m.team,"finish")}}><AdminIcon name="stop"/> Finalizar partido</button>:m.status==="finished"?<button disabled={locked} onClick={()=>{if(window.confirm("¿Reabrir este partido para corregirlo?"))void act(m.team,"reopen")}}><AdminIcon name="refresh"/> Reabrir para corregir</button>:<p>Partido suspendido</p>}</div><div className="adminCardButtons" aria-label="Registrar tarjetas"><button disabled={locked||m.status!=="live"} aria-expanded={picker?.team===m.team&&picker.type==="yellow"} onClick={()=>setPicker(picker?.team===m.team&&picker.type==="yellow"?null:{team:m.team,type:"yellow"})}><AdminIcon name="card"/> Amarilla <b>{m.yellow_cards}</b></button><button disabled={locked||m.status!=="live"} aria-expanded={picker?.team===m.team&&picker.type==="red"} onClick={()=>setPicker(picker?.team===m.team&&picker.type==="red"?null:{team:m.team,type:"red"})}><AdminIcon name="card"/> Roja <b>{m.red_cards}</b></button></div></div>
     {m.is_home===null?<p className="adminMatchHint">Define quién juega en casa antes de iniciar el partido.</p>:m.status==="finished"?<p className="adminMatchHint">Reabre el partido para corregir el marcador o añadir tarjetas.</p>:m.status==="scheduled"?<p className="adminMatchHint">Inicia el partido para registrar tarjetas.</p>:null}
     {picker?.team===m.team&&<section className="adminStaffPicker" aria-label="Elegir destinatario de tarjeta"><div><b><AdminIcon name="card"/>{picker.type==="yellow"?"Amarilla":"Roja"} · ¿A quién?</b><button disabled={locked} aria-label="Cerrar selección de tarjeta" onClick={()=>setPicker(null)}>×</button></div><div>{(STAFF[m.team]||[]).map(person=><button key={person} disabled={locked} onClick={()=>void act(m.team,"addCard",{cardType:picker.type,person})}>{person}</button>)}</div></section>}
     {teamCards.length>0&&<section className="adminCardHistory" aria-label="Tarjetas mostradas"><h3>Tarjetas mostradas</h3>{teamCards.map(card=><div key={card.id}><AdminIcon name="card"/><span><b>{card.person}</b><small>{card.card_type==="yellow"?"Amarilla":"Roja"}</small></span><button aria-label={"Eliminar tarjeta de "+card.person} disabled={locked} onClick={()=>{if(window.confirm("¿Eliminar esta tarjeta?"))void act(m.team,"removeCard",{cardId:card.id})}}>×</button></div>)}</section>}
     <MatchEditor match={m} disabled={locked} onSave={async details=>!!await act(m.team,"details",{details})}/>
    </article>
   })}</div>:<div className="adminEmpty"><h3>{matches.length?"No hay partidos con este estado":"No hay partidos en esta jornada"}</h3><p>{matches.length?"Selecciona otro filtro para ver los demás encuentros.":"Esta jornada todavía no contiene partidos publicados. Comprueba la configuración de los encuentros."}</p>{matches.length>0&&<button onClick={()=>setFilter("all")}>Ver todos los partidos</button>}</div>}</section>}
   {view==="pending"&&<section aria-labelledby="admin-pending-title"><div className="adminSectionHeading"><div><h2 id="admin-pending-title">Pronósticos pendientes · J{round}</h2><p>Consulta quién falta y envía un recordatorio individual.</p></div><span className="adminCount">{pendingError?"—":pending.length} pendientes</span></div>{pendingError?<div className="adminEmpty" role="alert"><h3>No se han podido consultar los pendientes</h3><p>Comprueba la conexión y vuelve a intentarlo.</p><button onClick={()=>void load(round)}>Reintentar</button></div>:pending.length?<div className="adminPendingTable">{pending.map(p=><article key={p.user_id}><span className="adminInitial" aria-hidden="true">{p.username?.[0]?.toUpperCase()}</span><div><b>{p.username}</b><small>{p.sent}/{p.total} pronósticos enviados</small></div><button className="adminPrimary" disabled={!!reminderSending||!!reminderSent[p.user_id]} onClick={()=>void remind(p.user_id)}>{reminderSending===p.user_id?"Enviando…":reminderSent[p.user_id]?"Enviado":"Recordar"}</button></article>)}</div>:<div className="adminEmpty"><span className="adminDone" aria-hidden="true">✓</span><h3>Todo enviado</h3><p>No hay participantes con pronósticos pendientes.</p></div>}</section>}
   {view==="round"&&<section className="adminRoundControl" aria-labelledby="admin-control-title"><span className="adminEyebrow">JORNADA {round}</span><h2 id="admin-control-title">Control de jornada</h2><p>Acciones globales para corregir o cerrar la jornada.</p><div className="adminRoundProgress"><div><b>{finished} de {matches.length} partidos finalizados</b><span>{live} en juego</span></div><progress max={Math.max(1,matches.length)} value={finished}/></div><div className="adminBulkAction"><div><h3>Finalizar partidos en juego</h3><p>Se cerrarán los {live} partidos que están en juego. Sus resultados se compartirán con los participantes.</p></div><button className="adminFinish" disabled={locked||!live} onClick={()=>void finishRound()}>{busy==="bulk"?"Finalizando…":"Finalizar partidos en juego"}</button></div>
   <div className="adminAdvanceRound">
    <div className="adminAdvanceRoundCopy">
     <span className="adminEyebrow">JORNADA ACTIVA PARA LOS JUGADORES</span>
     <h3>{activeRound===null?"Consultando jornada…":"Jornada "+activeRound}</h3>
     <p>Avanza a la siguiente jornada cuando quieras abrir la nueva quiniela para todos. Los pronósticos y resultados de jornadas anteriores no se modifican.</p>
     {activeRound!==null&&!publishedRounds.includes(activeRound+1)&&<small>Primero debes crear y publicar la Jornada {activeRound+1} con todos sus partidos.</small>}
     {activeRoundError&&<small role="alert">{activeRoundError}</small>}
    </div>
    <button className="adminPrimary adminAdvanceRoundButton" type="button"
     disabled={locked||activeRound===null||!publishedRounds.includes(activeRound+1)}
     onClick={()=>void advanceRound()}>
     {busy==="advance"?"Activando…":activeRound===null?"Cargando…":"Avanzar a Jornada "+(activeRound+1)}
    </button>
   </div><p className="adminMatchHint">Para corregir un resultado, vuelve a Partidos y selecciona «Reabrir para corregir».</p></section>}
  </>}
  <footer className="adminFooter">QuiniDerio · Administración de la temporada 2026/27</footer>
 </main>;
}
function AdminIcon({name}:{name:"play"|"stop"|"refresh"|"swap"|"card"}){
 const paths:Record<typeof name,React.ReactNode>={
  play:<path d="m8 5 11 7-11 7V5Z"/>,
  stop:<rect x="5" y="5" width="14" height="14" rx="2"/>,
  refresh:<><path d="M3 12a9 9 0 0 1 15-6l3 3"/><path d="M21 3v6h-6"/><path d="M21 12a9 9 0 0 1-15 6l-3-3"/><path d="M3 21v-6h6"/></>,
  swap:<><path d="m7 7-4 4 4 4"/><path d="M3 11h18"/><path d="m17 3 4 4-4 4"/><path d="M21 7H3"/></>,
  card:<rect x="7" y="3" width="10" height="18" rx="1.5"/>
 };
 return <svg aria-hidden="true" className="adminActionIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
function ScoreControl({label,team,value,disabled,onRemove,onAdd}:{label:string,team:string,value:number,disabled:boolean,onRemove:()=>void,onAdd:()=>void}){
 return <div className="adminScoreSide"><small>{label}</small><b>{team}</b><strong aria-label={"Goles "+label.toLowerCase()+": "+value}>{value}</strong><div><button aria-label={"Quitar gol "+label.toLowerCase()} disabled={disabled||value<=0} onClick={onRemove}>−</button><button aria-label={"Añadir gol "+label.toLowerCase()} disabled={disabled} onClick={onAdd}>+</button></div></div>;
}
