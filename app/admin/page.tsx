"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {supabase} from "../lib/supabase";
import "./admin.css";
const ADMIN="gabrialzueta@gmail.com";
type Match={round:number,team:string,opponent:string,home_score:number,away_score:number,yellow_cards:number,red_cards:number,status:"scheduled"|"live"|"finished"|"suspended",is_home:boolean|null};
type Card={id:string,round:number,team:string,person:string,card_type:"yellow"|"red",created_at:string};
type View="matches"|"pending"|"round";
const STATUS:Record<Match["status"],string>={scheduled:"Por jugar",live:"En juego",finished:"Finalizado",suspended:"Suspendido"};
const STAFF:Record<string,string[]>={"Derio A":["Nando Alonso","Julen de Miguel","Gabri Alzueta"],"Derio B":["Gorka Barrio","David Perez","Mikel Elejalde"],"Derio Fem":["Iker Ibarluzea","Galder Ferreiro","Omar El Kabouri"],"Derio Fem B":["Ibai Mateos","Eneko Sanchez","Aner Taranilla"],"Juvenil A":["Peio Garcia","Koldo Corral"],"Juvenil B":["Mikel Tara","Asel Ibañez"],"Cadete B":["Gaizka Garcia","Galder Carreras"]};
export default function AdminPage(){
 const[allowed,setAllowed]=useState<boolean|null>(null);
 const[matches,setMatches]=useState<Match[]>([]),[cards,setCards]=useState<Card[]>([]);
 const[busy,setBusy]=useState(""),[loading,setLoading]=useState(true);
 const[message,setMessage]=useState<{kind:"success"|"error",text:string}|null>(null);
 const[loadError,setLoadError]=useState("");
 const[pending,setPending]=useState<{user_id:string,username:string,sent:number,total:number}[]>([]);
 const[pendingError,setPendingError]=useState(false);
 const[round,setRound]=useState(2),[view,setView]=useState<View>("matches"),[filter,setFilter]=useState("all");
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
 useEffect(()=>{
  setTheme(document.documentElement.dataset.theme||"dark");let active=true;
  const verify=async()=>{const {data:{session}}=await supabase.auth.getSession();let user=session?.user||null;if(session){const fresh=await supabase.auth.getUser();user=fresh.data.user||user}if(active)setAllowed(user?.email?.trim().toLowerCase()===ADMIN)};
  void verify();const {data:listener}=supabase.auth.onAuthStateChange(()=>{setTimeout(()=>{if(active)void verify()},0)});
  return()=>{active=false;listener.subscription.unsubscribe();requestId.current++};
 },[]);
 useEffect(()=>{if(allowed)void load(round)},[round,allowed,load]);
 const sendAction=async(team:string,action:string,extra:Record<string,unknown>={})=>{
  const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error("session");
  const res=await fetch("/api/admin/live",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({round,team,action,...extra})});if(!res.ok)throw new Error("update");
 };
 const act=async(team:string,action:string,extra:Record<string,unknown>={})=>{
  if(busy)return;setBusy(team+action);setMessage(null);
  try{await sendAction(team,action,extra);setPicker(null);if(await load(round,true))setMessage({kind:"success",text:"Cambios guardados · "+team})}
  catch{setMessage({kind:"error",text:"No se ha podido guardar el cambio. Comprueba la conexión e inténtalo de nuevo."})}finally{setBusy("")}
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
 const changeRound=(n:number)=>{setRound(n);setPicker(null);setReminderSent({});setMessage(null);setFilter("all")};
 const changeTheme=()=>{const next=theme==="light"?"dark":"light";setTheme(next);document.documentElement.dataset.theme=next;localStorage.setItem("quiniderio-theme",next)};
 const live=matches.filter(m=>m.status==="live").length,finished=matches.filter(m=>m.status==="finished").length;
 const visibleMatches=filter==="all"?matches:matches.filter(m=>m.status===filter),locked=!!busy||loading;
 if(allowed===null)return <main className="adminAccess"><section role="status"><div className="adminLoadingMark"/><h1>Cargando administración…</h1><p>Comprobando tu sesión.</p></section></main>;
 if(!allowed)return <main className="adminAccess"><section><span className="adminEyebrow">QUINIDERIO · ADMINISTRACIÓN</span><h1>Acceso restringido</h1><p>Este panel no está disponible para esta cuenta.</p><a className="adminPrimary" href="/">Volver a QuiniDerio</a></section></main>;
 return <main className="adminWorkspace">
  <header className="adminTopbar"><a href="/" className="adminBrand" aria-label="Volver a QuiniDerio"><img src="/api/assets/branding/LogoApp.png" alt=""/><span><b className="qdWordmark"><span className="qd-quini">QUINI</span><span className="qd-de">DE</span><span className="qd-rio">RIO</span></b><small>ADMINISTRACIÓN</small></span></a><div><button className="adminTheme" onClick={changeTheme} aria-label={theme==="light"?"Activar modo oscuro":"Activar modo claro"}>{theme==="light"?"☾ Oscuro":"☀ Claro"}</button><a className="adminBack" href="/">‹ Volver a la app</a></div></header>
  <section className="adminIntro"><div><span className="adminEyebrow">TEMPORADA 2026/27</span><h1>Panel Admin</h1><p>Resultados y tarjetas se comparten con todos los usuarios.</p></div><span className="adminRoundBadge">Jornada {round}</span></section>
  <section className="adminRoundSelector" aria-label="Jornada activa"><div><b>Selecciona la jornada</b><small>Todos los controles se aplican a la jornada elegida.</small></div><nav aria-label="Seleccionar jornada">{Array.from({length:8},(_,i)=>i+1).map(n=><button type="button" key={n} disabled={!!busy||!!reminderSending} aria-current={round===n?"page":undefined} aria-label={"Jornada "+n} className={round===n?"active":""} onClick={()=>changeRound(n)}>J{n}</button>)}</nav></section>
  <div className="adminSummary" aria-label="Resumen de jornada" aria-busy={loading}><article><span>Partidos</span><strong>{loading?"—":matches.length}</strong><small>En esta jornada</small></article><article className="adminSummaryLive"><span>En juego</span><strong>{loading?"—":live}</strong><small>Control en directo</small></article><article><span>Finalizados</span><strong>{loading?"—":finished}</strong><small>Resultados cerrados</small></article><article><span>Pronósticos pendientes</span><strong>{loading||pendingError?"—":pending.length}</strong><small>Participantes por avisar</small></article></div>
  <nav className="adminViewTabs" aria-label="Secciones de administración">{([["matches","Partidos"],["pending","Pronósticos pendientes"],["round","Control de jornada"]] as [View,string][]).map(([key,label])=><button type="button" key={key} aria-current={view===key?"page":undefined} className={view===key?"active":""} onClick={()=>setView(key)}>{label}</button>)}</nav>
  {message&&<div className={"adminFeedback "+message.kind} role={message.kind==="error"?"alert":"status"}>{message.text}<button aria-label="Cerrar aviso" onClick={()=>setMessage(null)}>×</button></div>}
  {loadError?<section className="adminEmpty" role="alert"><h2>No se ha podido cargar la jornada</h2><p>{loadError}</p><button className="adminPrimary" onClick={()=>void load(round)}>Reintentar</button></section>:loading?<section className="adminLoading" role="status"><div className="adminLoadingMark"/><p>Cargando jornada {round}…</p></section>:<>
   {view==="matches"&&<section aria-labelledby="admin-matches-title"><div className="adminSectionHeading"><div><h2 id="admin-matches-title">Partidos de la jornada</h2><p>Gestiona el marcador y las tarjetas de cada encuentro.</p></div><label className="adminFilter">Mostrar<select aria-label="Filtrar partidos" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos los partidos</option><option value="live">En juego</option><option value="scheduled">Por jugar</option><option value="finished">Finalizados</option><option value="suspended">Suspendidos</option></select></label></div>
   {visibleMatches.length?<div className="adminMatchGrid">{visibleMatches.map(m=>{
    const teamCards=cards.filter(c=>c.team===m.team),isHome=m.is_home===true,home=isHome?m.team:m.opponent,away=isHome?m.opponent:m.team,scoreLocked=locked||m.status==="finished";
    return <article className="adminMatchCard" key={m.team} aria-label={m.team+" contra "+m.opponent} aria-busy={busy.startsWith(m.team)}>
     <header className="adminMatchHeader"><b>{m.team}</b><span className={"adminStatus "+m.status}>{STATUS[m.status]}</span></header>
     <div className="adminScoreboard"><ScoreControl label="Local" team={home} value={m.home_score} disabled={scoreLocked} onRemove={()=>void act(m.team,"homeGoalRemove")} onAdd={()=>void act(m.team,"homeGoal")}/><span className="adminScoreDivider" aria-hidden="true">:</span><ScoreControl label="Visitante" team={away} value={m.away_score} disabled={scoreLocked} onRemove={()=>void act(m.team,"awayGoalRemove")} onAdd={()=>void act(m.team,"awayGoal")}/></div>
     <div className="adminHomeOrder"><span>{m.is_home===null?"Local y visitante por confirmar":"Orden local / visitante"}</span><button disabled={locked} onClick={()=>void act(m.team,"setHome",{isHome:!isHome})}>⇄ {m.is_home===null?"Definir local":"Invertir orden"}</button></div>
     <div className="adminMatchTools"><div className="adminMatchLifecycle">{m.status==="scheduled"?<button className="adminPrimary" disabled={locked||m.is_home===null} onClick={()=>void act(m.team,"start")}>▶ Iniciar partido</button>:m.status==="live"?<button className="adminFinish" disabled={locked} onClick={()=>{if(window.confirm("¿Finalizar este partido? Podrás reabrirlo desde el panel."))void act(m.team,"finish")}}>■ Finalizar partido</button>:m.status==="finished"?<button disabled={locked} onClick={()=>{if(window.confirm("¿Reabrir este partido para corregirlo?"))void act(m.team,"reopen")}}>↺ Reabrir para corregir</button>:<p>Partido suspendido</p>}</div><div className="adminCardButtons" aria-label="Registrar tarjetas"><button disabled={locked||m.status!=="live"} aria-expanded={picker?.team===m.team&&picker.type==="yellow"} onClick={()=>setPicker(picker?.team===m.team&&picker.type==="yellow"?null:{team:m.team,type:"yellow"})}><i className="adminCardMark yellow" aria-hidden="true"/>Amarilla <b>{m.yellow_cards}</b></button><button disabled={locked||m.status!=="live"} aria-expanded={picker?.team===m.team&&picker.type==="red"} onClick={()=>setPicker(picker?.team===m.team&&picker.type==="red"?null:{team:m.team,type:"red"})}><i className="adminCardMark red" aria-hidden="true"/>Roja <b>{m.red_cards}</b></button></div></div>
     {m.is_home===null?<p className="adminMatchHint">Define quién juega en casa antes de iniciar el partido.</p>:m.status==="finished"?<p className="adminMatchHint">Reabre el partido para corregir el marcador o añadir tarjetas.</p>:m.status==="scheduled"?<p className="adminMatchHint">Inicia el partido para registrar tarjetas.</p>:null}
     {picker?.team===m.team&&<section className="adminStaffPicker" aria-label="Elegir destinatario de tarjeta"><div><b><i className={"adminCardMark "+picker.type} aria-hidden="true"/>{picker.type==="yellow"?"Amarilla":"Roja"} · ¿A quién?</b><button disabled={locked} aria-label="Cerrar selección de tarjeta" onClick={()=>setPicker(null)}>×</button></div><div>{(STAFF[m.team]||[]).map(person=><button key={person} disabled={locked} onClick={()=>void act(m.team,"addCard",{cardType:picker.type,person})}>{person}</button>)}</div></section>}
     {teamCards.length>0&&<section className="adminCardHistory" aria-label="Tarjetas mostradas"><h3>Tarjetas mostradas</h3>{teamCards.map(card=><div key={card.id}><i className={"adminCardMark "+card.card_type} aria-hidden="true"/><span><b>{card.person}</b><small>{card.card_type==="yellow"?"Amarilla":"Roja"}</small></span><button aria-label={"Eliminar tarjeta de "+card.person} disabled={locked} onClick={()=>{if(window.confirm("¿Eliminar esta tarjeta?"))void act(m.team,"removeCard",{cardId:card.id})}}>×</button></div>)}</section>}
    </article>
   })}</div>:<div className="adminEmpty"><h3>{matches.length?"No hay partidos con este estado":"No hay partidos en esta jornada"}</h3><p>{matches.length?"Selecciona otro filtro para ver los demás encuentros.":"Selecciona otra jornada para gestionar sus resultados."}</p>{matches.length>0&&<button onClick={()=>setFilter("all")}>Ver todos los partidos</button>}</div>}</section>}
   {view==="pending"&&<section aria-labelledby="admin-pending-title"><div className="adminSectionHeading"><div><h2 id="admin-pending-title">Pronósticos pendientes · J{round}</h2><p>Consulta quién falta y envía un recordatorio individual.</p></div><span className="adminCount">{pendingError?"—":pending.length} pendientes</span></div>{pendingError?<div className="adminEmpty" role="alert"><h3>No se han podido consultar los pendientes</h3><p>Comprueba la conexión y vuelve a intentarlo.</p><button onClick={()=>void load(round)}>Reintentar</button></div>:pending.length?<div className="adminPendingTable">{pending.map(p=><article key={p.user_id}><span className="adminInitial" aria-hidden="true">{p.username?.[0]?.toUpperCase()}</span><div><b>{p.username}</b><small>{p.sent}/{p.total} pronósticos enviados</small></div><button className="adminPrimary" disabled={!!reminderSending||!!reminderSent[p.user_id]} onClick={()=>void remind(p.user_id)}>{reminderSending===p.user_id?"Enviando…":reminderSent[p.user_id]?"Enviado":"Recordar"}</button></article>)}</div>:<div className="adminEmpty"><span className="adminDone" aria-hidden="true">✓</span><h3>Todo enviado</h3><p>No hay participantes con pronósticos pendientes.</p></div>}</section>}
   {view==="round"&&<section className="adminRoundControl" aria-labelledby="admin-control-title"><span className="adminEyebrow">JORNADA {round}</span><h2 id="admin-control-title">Control de jornada</h2><p>Acciones globales para corregir o cerrar la jornada.</p><div className="adminRoundProgress"><div><b>{finished} de {matches.length} partidos finalizados</b><span>{live} en juego</span></div><progress max={Math.max(1,matches.length)} value={finished}/></div><div className="adminBulkAction"><div><h3>Finalizar partidos en juego</h3><p>Se cerrarán los {live} partidos que están en juego. Sus resultados se compartirán con los participantes.</p></div><button className="adminFinish" disabled={locked||!live} onClick={()=>void finishRound()}>{busy==="bulk"?"Finalizando…":"Finalizar partidos en juego"}</button></div><p className="adminMatchHint">Para corregir un resultado, vuelve a Partidos y selecciona «Reabrir para corregir».</p></section>}
  </>}
  <footer className="adminFooter">QuiniDerio · Administración de la temporada 2026/27</footer>
 </main>;
}
function ScoreControl({label,team,value,disabled,onRemove,onAdd}:{label:string,team:string,value:number,disabled:boolean,onRemove:()=>void,onAdd:()=>void}){
 return <div className="adminScoreSide"><small>{label}</small><b>{team}</b><strong aria-label={"Goles "+label.toLowerCase()+": "+value}>{value}</strong><div><button aria-label={"Quitar gol "+label.toLowerCase()} disabled={disabled||value<=0} onClick={onRemove}>−</button><button aria-label={"Añadir gol "+label.toLowerCase()} disabled={disabled} onClick={onAdd}>+</button></div></div>;
}
