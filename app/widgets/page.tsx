"use client";
import {useEffect,useState} from "react";
import {widgetPlatform,type WidgetMode} from "../components/WidgetEntry";
import type {WidgetMatch,WidgetSnapshot} from "../lib/widget-snapshot";
import "./widgets.css";

const CACHE="qd-widget-preview-v1";
function isSnapshot(value:unknown):value is WidgetSnapshot{
 if(!value||typeof value!=="object")return false;
 const s=value as WidgetSnapshot;
 return s.version===1&&Number.isInteger(s.round)&&s.round>0&&Number.isFinite(Date.parse(s.fetchedAt))&&Array.isArray(s.matches)&&s.matches.every(m=>typeof m.id==="string"&&typeof m.home==="string"&&typeof m.away==="string"&&typeof m.statusLabel==="string");
}
function Crest({src,name}:{src:string|null;name:string}){
 const [failed,setFailed]=useState(false);
 return src&&!failed?<img src={src} alt="" onError={()=>setFailed(true)}/>:<span className="qwInitials" aria-hidden="true">{name.slice(0,2).toUpperCase()}</span>;
}
function MatchRow({match,compact=false}:{match:WidgetMatch;compact?:boolean}){
 const score=match.homeScore!==null&&match.awayScore!==null?`${match.homeScore} – ${match.awayScore}`:null;
 return <div className={"qwMatch "+(compact?"qwCompact":"")} data-state={match.status}>
  <div className="qwTeam"><Crest key={match.homeCrest} src={match.homeCrest} name={match.home}/><span>{match.home}</span></div>
  <div className="qwResult"><small>{match.statusLabel}</small><strong>{score??(match.status==="scheduled"?match.time||"—":"—")}</strong>{match.date&&<time>{match.date}</time>}</div>
  <div className="qwTeam"><Crest key={match.awayCrest} src={match.awayCrest} name={match.away}/><span>{match.away}</span></div>
 </div>;
}
export default function Widgets(){
 const [mode,setMode]=useState<WidgetMode>("full"),[snapshot,setSnapshot]=useState<WidgetSnapshot|null>(null),[selectedId,setSelectedId]=useState<string|null>(null);
 const [offline,setOffline]=useState(false),[busy,setBusy]=useState(false),[platform,setPlatform]=useState<"android"|"ios"|null>(null),[message,setMessage]=useState("");
 const [round,setRound]=useState<number|null>(null),[loaded,setLoaded]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{
  document.body.classList.add("qd-mounted");
  setPlatform(widgetPlatform());
  const q=new URLSearchParams(window.location.search),r=q.get("round");
  const n=r&&/^(?:[1-9]|[1-5][0-9]|60)$/.test(r)?Number(r):null;
  setRound(n);if(q.get("team")&&n){setSelectedId(`${n}:${q.get("team")}`);setMode("compact")}
  try{const saved=localStorage.getItem("qd-widget-mode");if(!q.get("team")&&(saved==="compact"||saved==="full"))setMode(saved);const old=JSON.parse(localStorage.getItem(CACHE)||"null");if(isSnapshot(old)&&(n===null||old.round===n)){setSnapshot(old);setOffline(true)}}catch{}
  setLoaded(true);
 },[]);
 useEffect(()=>{
  if(!loaded)return;
  let active=true,inFlight=false;
  const controller=new AbortController();
  const load=async()=>{
   if(inFlight||document.visibilityState==="hidden")return;
   inFlight=true;setBusy(true);
   try{
    const res=await fetch("/api/widgets"+(round?`?round=${round}`:""),{signal:controller.signal});
    if(!res.ok)throw new Error("snapshot");const data:unknown=await res.json();if(!isSnapshot(data))throw new Error("snapshot");
    if(active){setSnapshot(data);setOffline(false);try{localStorage.setItem(CACHE,JSON.stringify(data))}catch{}}
   }catch{if(active)setOffline(true)}finally{inFlight=false;if(active)setBusy(false)}
  };
  void load();const timer=window.setInterval(load,60000);const visible=()=>void load();document.addEventListener("visibilitychange",visible);
  return()=>{active=false;controller.abort();window.clearInterval(timer);document.removeEventListener("visibilitychange",visible)};
 },[loaded,round,revision]);
 const matches=snapshot?.matches||[];
 const selectedIndex=Math.max(0,matches.findIndex(m=>m.id===selectedId));
 const selected=matches[selectedIndex];
 const move=(direction:number)=>{if(matches.length)setSelectedId(matches[(selectedIndex+direction+matches.length)%matches.length].id)};
 const choose=(value:WidgetMode)=>{setMode(value);setMessage("");try{localStorage.setItem("qd-widget-mode",value)}catch{}};
 const add=()=>{
  try{
   if(platform==="android"){window.QuiniWidgets!.addWidget(mode);setMessage("Confirma el widget en la ventana de Android. También puedes añadirlo manteniendo pulsada la pantalla de inicio.")}
   else if(platform==="ios"){window.webkit!.messageHandlers!.quiniWidgets!.postMessage({mode});setMessage("Mantén pulsada la pantalla de inicio → Editar → Añadir widget → QuiniDerio. Elige «Jornada completa» o «Partido a partido».")}
  }catch{setMessage("Abre el selector de widgets de tu móvil y busca QuiniDerio.")}
 };
 return <main className="qwPage">
  <a className="qwBack" href="/">← QuiniDerio</a>
  <header><p>EN TU PANTALLA DE INICIO</p><h1>Widget de jornada</h1><span>Elige cómo quieres seguir los resultados. Puedes añadir ambos.</span></header>
  <div className="qwModes" role="group" aria-label="Formato de widget">
   <button type="button" aria-pressed={mode==="full"} onClick={()=>choose("full")}><b>Jornada completa</b><span>Todos los encuentros</span></button>
   <button type="button" aria-pressed={mode==="compact"} onClick={()=>choose("compact")}><b>Partido a partido</b><span>Recorre los marcadores</span></button>
  </div>
  <section className={"qwPreview "+(mode==="compact"?"qwSmall":"")} aria-label="Vista previa con los datos de la jornada">
   <div className="qwHeading"><b>QuiniDerio</b><span>{snapshot?`Jornada ${snapshot.round}`:"Consultando jornada…"}</span></div>
   {matches.length?(mode==="full"?matches.map(m=><a href={m.url} className="qwMatchLink" key={m.id}><MatchRow match={m}/></a>):<>{selected&&<a href={selected.url} className="qwMatchLink"><MatchRow match={selected} compact/></a>}<div className="qwPager"><button type="button" aria-label="Partido anterior" disabled={matches.length<2} onClick={()=>move(-1)}>‹</button><span aria-live="polite">{selectedIndex+1} de {matches.length}</span><button type="button" aria-label="Partido siguiente" disabled={matches.length<2} onClick={()=>move(1)}>›</button></div></>):<p role="status">{offline?"No se pudo consultar la jornada. Inténtalo de nuevo.":"Cargando resultados…"}</p>}
   <footer>{offline&&<b>Sin conexión · últimos datos guardados</b>}{snapshot&&<span>Consultado {new Date(snapshot.fetchedAt).toLocaleString("es-ES",{timeZone:"Europe/Madrid",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>}<button type="button" disabled={busy} onClick={()=>setRevision(n=>n+1)}>{busy?"Consultando…":"Actualizar"}</button></footer>
  </section>
  <div className="qwInstall">
   {platform?<><button type="button" className="qwAdd" onClick={add}>{platform==="android"?"Añadir":"Cómo añadir"} {mode==="full"?"jornada completa":"partido a partido"}</button><p>La actualización en segundo plano depende del sistema. No se garantiza que cada gol aparezca inmediatamente.</p></>:<p>Esta es una vista previa. Para añadir widgets necesitas la versión nativa de QuiniDerio; la instalación desde el navegador no los incluye.</p>}
   {message&&<p role="status">{message}</p>}
  </div>
 </main>;
}
