"use client";
import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
import {supabase} from "../lib/supabase";
import {roundPosition,roundPotContribution,type RoundHit} from "../lib/engagement";
import usePageScrollLock from "./usePageScrollLock";

type Snapshot={hits:number;played:number;place:number|null;movement:number|null;pot:number|null};
function AnimatedNumber({value,suffix="",run}:{value:number;suffix?:string;run:number}){
 const [shown,setShown]=useState(0);
 useEffect(()=>{
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setShown(value);return;}
  setShown(0);
  let frame=0;
  const start=performance.now();
  const tick=(now:number)=>{
    const t=Math.min(1,(now-start)/900);
    setShown(Math.round(value*(1-Math.pow(1-t,3))));
    if(t<1)frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
  return ()=>cancelAnimationFrame(frame);
 },[value,run]);
 return <>{shown}{suffix}</>;
}
export default function RoundRecap({round,userId,username,teams}:{round:number;userId:string;username:string;teams:string[]}){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [open,setOpen]=useState(false);
 const [run,setRun]=useState(0);
 const teamsKey=teams.join("|");
 usePageScrollLock(open);
 useEffect(()=>{
  let active=true;
  setSnapshot(null);setOpen(false);
  if(!userId||!teams.length)return;
  void(async()=>{
    const [{data:matches,error:matchError},{data:scores,error:scoreError}]=await Promise.all([
      supabase.from("quini_live_matches").select("round,team,status").in("round",[Math.max(1,round-1),round]),
      supabase.from("quini_round_scores").select("user_id,round,hits,picks_count").lte("round",round)
    ]);
    if(!active||matchError||scoreError)return;
    const matchesMap=new Map((matches||[]).filter(m=>m.round===round).map(m=>[m.team,m.status]));
    // A suspension or a missing match must never be declared a definitive recap.
    if(!teams.every(team=>["finished","final"].includes(matchesMap.get(team)||"")))return;
    const rows=(scores||[]) as RoundHit[];
    const own=rows.find(row=>row.round===round&&row.user_id===userId);
    if(!own)return;
    const prior=(matches||[]).filter(m=>m.round===round-1);
    const priorComplete=round>1&&prior.length>0&&prior.every(m=>["finished","final"].includes(m.status));
    const priorPlace=priorComplete?roundPosition(rows,userId,round-1):null;
    const currentPlace=roundPosition(rows,userId,round);
    setSnapshot({
      hits:Number(own.hits),
      played:teams.length,
      place:roundPosition(rows,userId,round,true),
      movement:priorPlace!==null&&currentPlace!==null?priorPlace-currentPlace:null,
      pot:roundPotContribution(rows,userId,round,teams.length)
    });
  })();
  return ()=>{active=false;};
 },[round,userId,teamsKey]);
 useEffect(()=>{
  if(!open)return;
  const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
  window.addEventListener("keydown",onKey);
  return ()=>window.removeEventListener("keydown",onKey);
 },[open]);
 if(!snapshot)return null;
 const percentage=snapshot.played?Math.round(snapshot.hits/snapshot.played*100):0;
 const movementText=snapshot.movement===null?"Sin comparación":snapshot.movement>0?"Subes "+snapshot.movement+" posiciones":snapshot.movement<0?"Bajas "+Math.abs(snapshot.movement)+" posiciones":"Mantienes tu posición";
 return <>
  <button type="button" className="qdRecapLaunch" onClick={()=>{setRun(n=>n+1);setOpen(true);}}>
   <span className="qdRecapLaunchIcon">✦</span><span><b>Resumen de la Jornada {round}</b><small>Descubre tu jornada animada</small></span><span aria-hidden="true">›</span>
  </button>
  {open&&createPortal(<div className="qdRecapOverlay" onClick={()=>setOpen(false)}>
   <section className="qdRecapModal" role="dialog" aria-modal="true" aria-label={"Resumen de la jornada "+round} onClick={event=>event.stopPropagation()}>
    <button type="button" aria-label="Cerrar resumen" className="qdRecapClose" onClick={()=>setOpen(false)}>×</button>
    <div className="qdRecapStage" key={run}>
      <p className="qdRecapEyebrow">QUINIDERIO · RESUMEN FINAL</p>
      <h2>Jornada {round}</h2>
      <p className="qdRecapUsername">{username}</p>
      <div className="qdRecapHero qdRecapCard">
        <span>PRONÓSTICOS ACERTADOS</span>
        <strong><AnimatedNumber value={snapshot.hits} run={run}/><em> / {snapshot.played}</em></strong>
        <div className="qdRecapProgress"><i style={{width:percentage+"%"}}/></div>
        <small><AnimatedNumber value={percentage} suffix="%" run={run}/> de efectividad</small>
      </div>
      <div className="qdRecapGrid">
        <article className="qdRecapCard"><small>PUESTO DE JORNADA</small><strong>{snapshot.place===null?"—":<AnimatedNumber value={snapshot.place} suffix="º" run={run}/>}</strong></article>
        <article className="qdRecapCard"><small>CLASIFICACIÓN GENERAL</small><strong className={snapshot.movement!==null&&snapshot.movement<0?"qdRecapDown":"qdRecapUp"}>{snapshot.movement===null?"—":snapshot.movement>0?"↑ "+snapshot.movement:snapshot.movement<0?"↓ "+Math.abs(snapshot.movement):"="}</strong><span>{movementText}</span></article>
        <article className="qdRecapCard"><small>APORTACIÓN AL BOTE</small><strong className="qdRecapPot">{snapshot.pot===null?"—":<><AnimatedNumber value={Math.abs(snapshot.pot)} run={run}/> €</>}</strong><span>{snapshot.pot===null?"Sin datos":snapshot.pot<0?"Bonificación":snapshot.pot>0?"Aportas al bote":"Sin aportación"}</span></article>
        <article className="qdRecapCard"><small>PARTIDOS COMPUTADOS</small><strong><AnimatedNumber value={snapshot.played} run={run}/></strong><span>Jornada finalizada</span></article>
      </div>
    </div>
    <button type="button" className="qdRecapReplay" onClick={()=>setRun(n=>n+1)}>↻ Repetir animación</button>
   </section>
  </div>,document.body)}
 </>;
}
