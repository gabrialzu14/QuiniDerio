"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {supabase} from "../lib/supabase";
import {latestRoundSnapshot,recapSeenKey,FIRST_RECAP_ROUND,type RoundSnapshot,type RecapMatch} from "../lib/round-recap";
import {roundNeedsRefresh} from "../lib/live-window";
import {AnimatedNumber} from "./DynamicMotion";
import {useActiveRound,useFixtures} from "./ManagedFixtures";
import usePageScrollLock from "./usePageScrollLock";

// In-memory fallback when storage is unavailable; browser effects are the only writers.
const shownThisVisit=new Set<string>();
function hasSeen(key:string){
 if(shownThisVisit.has(key))return true;
 try{return localStorage.getItem(key)==="seen"}catch{return false}
}
export default function RoundRecap({username}:{username:string}){
 const fixtures=useFixtures(),maxRound=useActiveRound();
 const [userId,setUserId]=useState("");
 const [candidate,setCandidate]=useState<RoundSnapshot|null>(null);
 const [snapshot,setSnapshot]=useState<RoundSnapshot|null>(null);
 const modal=useRef<HTMLElement>(null);
 const openSnapshot=useRef<RoundSnapshot|null>(null);
 const close=()=>{openSnapshot.current=null;setSnapshot(null)};
 usePageScrollLock(!!snapshot);
 useEffect(()=>{
  let active=true;
  void supabase.auth.getUser().then(({data:{user}})=>{if(active)setUserId(user?.id||"")});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(active)setUserId(session?.user?.id||"")});
  return()=>{active=false;subscription.unsubscribe()};
 },[]);
 useEffect(()=>{
  const controller=new AbortController();
  if(!userId||maxRound<FIRST_RECAP_ROUND){setCandidate(null);close();return()=>controller.abort()}
  let version=0;
  let watchMatches:RecapMatch[]=[];
  const load=async()=>{
   if(document.visibilityState!=="visible")return;
   const current=++version;
   // Scores must be read after the final statuses, to avoid an older in-flight score snapshot.
   const {data:matches,error:matchError}=await supabase.from("quini_live_matches").select("round,team,status").lte("round",maxRound).abortSignal(controller.signal);
   if(controller.signal.aborted||current!==version||matchError)return;
   const {data:scores,error:scoreError}=await supabase.from("quini_round_scores").select("user_id,round,hits,picks_count").lte("round",maxRound).abortSignal(controller.signal);
   if(controller.signal.aborted||current!==version||scoreError)return;
   watchMatches=(matches||[]) as RecapMatch[];
   const next=latestRoundSnapshot(fixtures,(matches||[]) as RecapMatch[],scores||[],userId,maxRound);
   // Reopening a match also withdraws any now-outdated popup.
   if(openSnapshot.current&&openSnapshot.current.round!==next?.round)close();
   setCandidate(next);
  };
  const timer=window.setTimeout(()=>void load(),250);
  const resume=()=>void load();
  const poll=window.setInterval(()=>{if(navigator.onLine&&Object.entries(fixtures).some(([round,games])=>Number(round)<=maxRound&&roundNeedsRefresh(games,watchMatches.filter(match=>match.round===Number(round)))))void load()},60000);
  window.addEventListener("focus",resume);window.addEventListener("online",resume);document.addEventListener("visibilitychange",resume);
  return()=>{controller.abort();window.clearTimeout(timer);window.clearInterval(poll);window.removeEventListener("focus",resume);window.removeEventListener("online",resume);document.removeEventListener("visibilitychange",resume)};
  // ManagedFixtures already refreshes on match events and reconnection. Reuse it.
 },[fixtures,maxRound,userId]);
 useEffect(()=>{
  if(!candidate||!userId)return;
  const key=recapSeenKey(userId,candidate.round);
  if(hasSeen(key))return;
  let timer:ReturnType<typeof setTimeout>;
  const show=()=>{
   if(hasSeen(key))return;
   // Wait for other app dialogs and the splash transition; never stack popups.
   if(document.visibilityState!=="visible"||document.body.classList.contains("qd-entering")||document.querySelector('[role="dialog"],.assistantPredictionOverlay,.pushPromptBackdrop')){timer=setTimeout(show,500);return}
   shownThisVisit.add(key);try{localStorage.setItem(key,"seen")}catch{}
   openSnapshot.current=candidate;setSnapshot(candidate);
  };
  timer=setTimeout(show,450);
  return()=>clearTimeout(timer);
 },[candidate,userId]);
 useEffect(()=>{setCandidate(null);close()},[userId]);
 useEffect(()=>{
  if(!snapshot)return;
  const previous=document.activeElement as HTMLElement|null;
  const frame=requestAnimationFrame(()=>modal.current?.querySelector<HTMLButtonElement>("button")?.focus({preventScroll:true}));
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();close()}
   if(event.key==="Tab"){event.preventDefault();modal.current?.querySelector<HTMLButtonElement>("button")?.focus({preventScroll:true})}
  };
  window.addEventListener("keydown",onKey);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener("keydown",onKey);if(previous?.isConnected)previous.focus({preventScroll:true})};
 },[snapshot]);
 if(!snapshot)return null;
 const percentage=snapshot.played?Math.round(snapshot.hits/snapshot.played*100):0;
 const movementText=snapshot.movement===null?"Sin comparación":snapshot.movement>0?"Subes "+snapshot.movement+" posiciones":snapshot.movement<0?"Bajas "+Math.abs(snapshot.movement)+" posiciones":"Mantienes tu posición";
 return createPortal(<div className="qdRecapOverlay" onClick={close}>
   <section ref={modal} className="qdRecapModal" role="dialog" aria-modal="true" aria-label={"Resumen de la jornada "+snapshot.round} onClick={event=>event.stopPropagation()}>
    <button type="button" aria-label="Cerrar resumen" className="qdRecapClose" onClick={close}>×</button>
    <div className="qdRecapStage">
      <p className="qdRecapEyebrow">QUINIDERIO · RESUMEN FINAL</p>
      <h2>Jornada {snapshot.round}</h2>
      <p className="qdRecapUsername">{username}</p>
      <div className="qdRecapHero qdRecapCard">
        <span>PRONÓSTICOS ACERTADOS</span>
        <strong><AnimatedNumber value={snapshot.hits}/><em> / {snapshot.played}</em></strong>
        <div className="qdRecapProgress"><i style={{width:percentage+"%"}}/></div>
        <small><AnimatedNumber value={percentage} suffix="%"/> de efectividad</small>
      </div>
      <div className="qdRecapGrid">
        <article className="qdRecapCard"><small>PUESTO DE JORNADA</small><strong>{snapshot.place===null?"—":<AnimatedNumber value={snapshot.place} suffix="º"/>}</strong></article>
        <article className="qdRecapCard"><small>CLASIFICACIÓN GENERAL</small><strong className={snapshot.movement!==null&&snapshot.movement<0?"qdRecapDown":"qdRecapUp"}>{snapshot.movement===null?"—":snapshot.movement>0?"↑ "+snapshot.movement:snapshot.movement<0?"↓ "+Math.abs(snapshot.movement):"="}</strong><span>{movementText}</span></article>
        <article className="qdRecapCard"><small>APORTACIÓN AL BOTE</small><strong className="qdRecapPot">{snapshot.pot===null?"—":<><AnimatedNumber value={Math.abs(snapshot.pot)}/> €</>}</strong><span>{snapshot.pot===null?"Sin datos":snapshot.pot<0?"Bonificación":snapshot.pot>0?"Aportas al bote":"Sin aportación"}</span></article>
        <article className="qdRecapCard"><small>PARTIDOS COMPUTADOS</small><strong><AnimatedNumber value={snapshot.played}/></strong><span>Jornada finalizada</span></article>
      </div>
    </div>
   </section>
  </div>,document.body);
}
