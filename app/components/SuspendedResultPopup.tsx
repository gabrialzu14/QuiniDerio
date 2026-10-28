"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {supabase} from "../lib/supabase";
import {AnimatedNumber} from "./DynamicMotion";
import usePageScrollLock from "./usePageScrollLock";
import "./suspended-result-popup.css";

const ANNOUNCEMENT_ID="j1-ibaiondo-6-1-derio-fem-b-2026-v1";
const OTHER_DIALOG='[aria-modal="true"],.roundPendingOverlay,.pushPromptBackdrop,.assistantPredictionOverlay';

export default function SuspendedResultPopup(){
 const [userId,setUserId]=useState("");
 const [open,setOpen]=useState(false);
 const [leaving,setLeaving]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const identity=useRef("");
 const openRef=useRef(false);
 const busy=useRef("");
 const acknowledged=useRef(new Set<string>());
 const action=useRef<HTMLButtonElement>(null);
 const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 usePageScrollLock(open);

 useEffect(()=>{
  let active=true,authObserved=false;
  const sync=(id:string)=>{
   if(!active||identity.current===id)return;
   identity.current=id;
   openRef.current=false;
   busy.current="";
   if(closeTimer.current)clearTimeout(closeTimer.current);
   setOpen(false);setLeaving(false);setSaving(false);setError("");setUserId(id);
  };
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
   authObserved=true;sync(session?.user?.id||"");
  });
  void supabase.auth.getSession().then(({data:{session}})=>{
   if(!authObserved)sync(session?.user?.id||"");
  }).catch(()=>{/* Auth changes will retry when the session recovers. */});
  return()=>{active=false;identity.current="";subscription.unsubscribe()};
 },[]);

 useEffect(()=>{
  if(!userId)return;
  let active=true,checking=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const controller=new AbortController();
  const schedule=(delay:number)=>{
   if(timer)clearTimeout(timer);
   if(active)timer=setTimeout(()=>void check(),delay);
  };
  const blocked=()=>document.body.classList.contains("qd-entering")||!!document.querySelector(OTHER_DIALOG);
  const check=async()=>{
   if(!active||checking||openRef.current||acknowledged.current.has(userId)||document.visibilityState==="hidden")return;
   if(blocked()){schedule(750);return}
   checking=true;
   try{
    // Acknowledgements are authoritative on the server, including on a new device.
    const [notice,match]=await Promise.all([
     supabase.from("quini_announcement_acknowledgements").select("announcement_id")
      .eq("user_id",userId).eq("announcement_id",ANNOUNCEMENT_ID).abortSignal(controller.signal).maybeSingle(),
     supabase.from("quini_live_matches").select("opponent,is_home,home_score,away_score,status")
      .eq("round",1).eq("team","Derio Fem B").abortSignal(controller.signal).maybeSingle()
    ]);
    if(!active||identity.current!==userId)return;
    if(notice.error||match.error){schedule(5000);return}
    if(notice.data){acknowledged.current.add(userId);return}
    const result=match.data;
    // Only announce this exact final result, never a reopened or corrected fixture.
    if(!result||!["finished","final"].includes(result.status)||result.is_home!==false||
     result.opponent!=="Ibaiondo Nerbioi A"||result.home_score!==6||result.away_score!==1)return;
    if(document.hidden||blocked()){schedule(750);return}
    openRef.current=true;setLeaving(false);setError("");setOpen(true);
   }catch{if(active)schedule(5000)}finally{checking=false}
  };
  const resume=()=>schedule(500);
  schedule(1100);
  window.addEventListener("focus",resume);
  window.addEventListener("online",resume);
  window.addEventListener("quiniderio-david-popup-closed",resume);
  window.addEventListener("quiniderio-suspended-popup-closed",resume);
  document.addEventListener("visibilitychange",resume);
  return()=>{
   active=false;controller.abort();if(timer)clearTimeout(timer);
   window.removeEventListener("focus",resume);
   window.removeEventListener("online",resume);
   window.removeEventListener("quiniderio-david-popup-closed",resume);
   window.removeEventListener("quiniderio-suspended-popup-closed",resume);
   document.removeEventListener("visibilitychange",resume);
  };
 },[userId]);

 const confirm=useCallback(async()=>{
  if(!userId||identity.current!==userId||busy.current||acknowledged.current.has(userId))return;
  busy.current=userId;setSaving(true);setError("");
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(identity.current!==userId)return;
   if(authError||user?.id!==userId)throw new Error("session");
   const {error:saveError}=await supabase.from("quini_announcement_acknowledgements").upsert({
    user_id:userId,announcement_id:ANNOUNCEMENT_ID
   },{onConflict:"user_id,announcement_id",ignoreDuplicates:true});
   if(identity.current!==userId)return;
   if(saveError)throw saveError;
   acknowledged.current.add(userId);
   setLeaving(true);
   const delay=window.matchMedia("(prefers-reduced-motion: reduce)").matches?0:240;
   closeTimer.current=setTimeout(()=>{
    if(identity.current!==userId)return;
    openRef.current=false;setOpen(false);
    window.dispatchEvent(new Event("quiniderio-suspended-popup-closed"));
   },delay);
  }catch{
   if(identity.current===userId)setError("No se ha podido guardar la confirmación. Comprueba tu conexión y vuelve a intentarlo.");
  }finally{
   if(busy.current===userId){busy.current="";setSaving(false)}
  }
 },[userId]);

 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement as HTMLElement|null;
  action.current?.focus({preventScroll:true});
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==="Tab"){event.preventDefault();action.current?.focus({preventScroll:true})}
   if(event.key==="Escape"){event.preventDefault();void confirm()}
  };
  document.addEventListener("keydown",onKey);
  return()=>{
   document.removeEventListener("keydown",onKey);
   if(previous?.isConnected)previous.focus({preventScroll:true});
  };
 },[open,confirm]);
 useEffect(()=>()=>{if(closeTimer.current)clearTimeout(closeTimer.current)},[]);

 if(!open||typeof document==="undefined")return null;
 return createPortal(<div className={"qdResultOverlay"+(leaving?" isLeaving":"")}>
  <section className="qdResultModal" role="dialog" aria-modal="true" aria-labelledby="qdResultTitle" aria-describedby="qdResultDescription">
   <p className="qdResultEyebrow">QUINIDERIO · JORNADA 1</p>
   <span className="qdResultConfirmed"><svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>RESULTADO CONFIRMADO</span>
   <h2 id="qdResultTitle">Ya tenemos resultado</h2>
   <p className="qdResultIntro">El partido suspendido ya ha finalizado.</p>
   <div className="qdResultBoard" role="img" aria-label="Resultado final: Ibaiondo 6, Derio Fem B 1.">
    <div className="qdResultClub qdResultHome" aria-hidden="true"><img src="/api/assets/Escudos/IbaiondoNerbioi.png?opt=4" alt="" width="76" height="76"/><strong>Ibaiondo</strong><small>LOCAL</small></div>
    <div className="qdResultScore" aria-hidden="true"><span>FINAL</span><strong><AnimatedNumber value={6}/><i>–</i><AnimatedNumber value={1}/></strong></div>
    <div className="qdResultClub qdResultAway" aria-hidden="true"><img src="/api/assets/Escudos/cd_derio.png?opt=4" alt="" width="76" height="76"/><strong>Derio Fem B</strong><small>VISITANTE</small></div>
   </div>
   <div className="qdResultOutcome"><div><small>SIGNO GANADOR</small><strong>Victoria de Ibaiondo</strong></div><b aria-label="Signo ganador: 1">1</b></div>
   <div className="qdResultPoints" role="group" aria-label="Tara y Lander suman 1 punto cada uno">
    <article><span>Tara</span><strong><AnimatedNumber value={1} prefix="+"/><small> pto.</small></strong></article>
    <article><span>Lander</span><strong><AnimatedNumber value={1} prefix="+"/><small> pto.</small></strong></article>
   </div>
   <p id="qdResultDescription" className="qdResultDescription">Los aciertos y la clasificación de la Jornada 1 ya están actualizados.</p>
   {error?<p className="qdResultError" role="alert">{error}</p>:null}
   <button ref={action} className="qdResultAction" type="button" disabled={saving||leaving} onClick={()=>void confirm()}>{saving?"Guardando…":"Entendido"}<span aria-hidden="true">→</span></button>
  </section>
 </div>,document.body);
}
