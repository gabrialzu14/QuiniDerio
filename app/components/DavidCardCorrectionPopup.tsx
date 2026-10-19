"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {supabase} from "../lib/supabase";
import usePageScrollLock from "./usePageScrollLock";

const ANNOUNCEMENT_ID="david-perez-red-to-yellow-2026-v1";
const LOCAL_KEY=(id:string)=>"quiniderio:announcement:"+ANNOUNCEMENT_ID+":"+id;
const DESCRIPTION="La tarjeta roja mostrada a David Pérez, segundo entrenador del Derio B, ha quedado anulada. El árbitro ha reflejado finalmente una tarjeta amarilla en el acta oficial del partido. Por tanto, la roja se sustituye por una amarilla y se actualizan las estadísticas de tarjetas.";

function CardGraphic({color}:{color:"red"|"yellow"}){
 return <svg viewBox="0 0 112 156" width="112" height="156" fill="none" aria-hidden="true">
  <defs>
   <linearGradient id={"qdCorrectionGradient-"+color} x1="0" y1="0" x2="1" y2="1">
    {color==="red"?<><stop stopColor="#ff6b7b"/><stop offset=".48" stopColor="#f32d4d"/><stop offset="1" stopColor="#b30e30"/></>:<><stop stopColor="#fff18a"/><stop offset=".52" stopColor="#ffd42b"/><stop offset="1" stopColor="#e5a70c"/></>}
   </linearGradient>
  </defs>
  <rect x="7" y="6" width="98" height="144" rx="10" fill={"url(#qdCorrectionGradient-"+color+")"} stroke="white" strokeOpacity=".45" strokeWidth="2"/>
  <rect x="15" y="14" width="82" height="128" rx="6" stroke="white" strokeOpacity=".24"/>
  <path d="M19 25L77 17" stroke="white" strokeOpacity=".24" strokeWidth="6" strokeLinecap="round"/>
 </svg>;
}

export default function DavidCardCorrectionPopup(){
 const [open,setOpen]=useState(false);
 const [leaving,setLeaving]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [userId,setUserId]=useState("");
 const [acknowledged,setAcknowledged]=useState(false);
 const shownRef=useRef(false);
 const busyRef=useRef(false);
 const closeRef=useRef<HTMLButtonElement|null>(null);
 const timerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
 const openRef=useRef(false);
 usePageScrollLock(open);

 const close=useCallback(()=>{
  setLeaving(true);
  timerRef.current=setTimeout(()=>{
   openRef.current=false;
   setOpen(false);
   window.dispatchEvent(new Event("quiniderio-david-popup-closed"));
   window.dispatchEvent(new Event("quiniderio-suspended-popup-closed"));
  },280);
 },[]);

 const confirm=useCallback(async()=>{
  if(busyRef.current||!userId)return;
  busyRef.current=true;
  setSaving(true);
  setError("");
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError||user?.id!==userId)throw new Error("Inicia sesión de nuevo para confirmar el aviso.");
   const {error:insertError}=await supabase.from("quini_announcement_acknowledgements").upsert({
    user_id:userId,announcement_id:ANNOUNCEMENT_ID
   },{onConflict:"user_id,announcement_id",ignoreDuplicates:true});
   if(insertError)throw insertError;
   try{localStorage.setItem(LOCAL_KEY(userId),"seen")}catch{}
   setAcknowledged(true);
   close();
  }catch{
   setError("No se ha podido guardar la confirmación. Comprueba tu conexión y vuelve a intentarlo.");
  }finally{
   busyRef.current=false;
   setSaving(false);
  }
 },[userId,close]);

 useEffect(()=>{
  let active=true;
  let timer:ReturnType<typeof setTimeout>|null=null;
  let checking=false;
  const schedule=(delay:number)=>{
   if(timer)clearTimeout(timer);
   timer=setTimeout(()=>void check(),delay);
  };
  const check=async()=>{
   if(!active||checking||shownRef.current||openRef.current||document.visibilityState==="hidden")return;
   checking=true;
   try{
    const {data:{session}}=await supabase.auth.getSession();
    if(!active||!session?.user?.id){schedule(1100);return}
    const id=session.user.id;
    let completed=false;
    try{
     const profile=JSON.parse(localStorage.getItem("quiniderio-player")||"null") as {completed?:boolean,userId?:string}|null;
     completed=!!profile?.completed&&profile.userId===id;
    }catch{}
    if(!completed){schedule(1200);return}
    if(document.querySelector('[aria-modal="true"],.roundPendingOverlay,.pushPromptBackdrop,.assistantPredictionOverlay')){
     schedule(800);return;
    }
    // Always check the server so acknowledgement works across devices.
    const {data,error:readError}=await supabase.from("quini_announcement_acknowledgements")
     .select("announcement_id").eq("user_id",id).eq("announcement_id",ANNOUNCEMENT_ID).maybeSingle();
    if(!active)return;
    if(readError){schedule(2500);return}
    if(data){shownRef.current=true;try{localStorage.setItem(LOCAL_KEY(id),"seen")}catch{}return}
    setUserId(id);
    setError("");
    setLeaving(false);
    shownRef.current=true;
    openRef.current=true;
    setOpen(true);
   }finally{checking=false}
  };
  schedule(450);
  const onVisible=()=>{if(document.visibilityState==="visible")schedule(400)};
  const onAuth=()=>schedule(600);
  const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>schedule(600));
  document.addEventListener("visibilitychange",onVisible);
  window.addEventListener("quiniderio-suspended-popup-closed",onVisible);
  window.addEventListener("quiniderio-david-popup-check",onAuth);
  return()=>{
   active=false;
   if(timer)clearTimeout(timer);
   subscription.unsubscribe();
   document.removeEventListener("visibilitychange",onVisible);
   window.removeEventListener("quiniderio-suspended-popup-closed",onVisible);
   window.removeEventListener("quiniderio-david-popup-check",onAuth);
  };
 },[]);

 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement as HTMLElement|null;
  closeRef.current?.focus({preventScroll:true});
  const trap=(event:KeyboardEvent)=>{
   if(event.key==="Tab"){event.preventDefault();closeRef.current?.focus({preventScroll:true})}
   // The announcement stays pending until explicit acknowledgement.
   if(event.key==="Escape")event.preventDefault();
  };
  document.addEventListener("keydown",trap);
  return()=>{document.removeEventListener("keydown",trap);previous?.focus?.({preventScroll:true})};
 },[open]);
 useEffect(()=>()=>{if(timerRef.current)clearTimeout(timerRef.current)},[]);

 if(!open||typeof document==="undefined")return null;
 return createPortal(
  <div className={"qdCardCorrectionOverlay "+(leaving?"isLeaving":"")} role="presentation">
   <section className="qdCardCorrectionModal" role="dialog" aria-modal="true" aria-labelledby="qdCardCorrectionTitle" aria-describedby="qdCardCorrectionText">
    <div className="qdCardCorrectionEyebrow">QUINIDERIO · RECTIFICACIÓN OFICIAL</div>
    <div className="qdCardCorrectionStage" aria-label="Tarjeta roja anulada y sustituida por tarjeta amarilla">
     <div className="qdCardCorrectionRed"><CardGraphic color="red"/><svg className="qdCardCorrectionStrike" viewBox="0 0 160 190" aria-hidden="true"><path d="M20 164L139 25" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round"/><path d="M20 164L139 25" fill="none" stroke="#102e54" strokeWidth="4" strokeLinecap="round"/></svg></div>
     <div className="qdCardCorrectionYellow"><CardGraphic color="yellow"/></div>
    </div>
    <div className="qdCardCorrectionCopy">
     <span>DAVID PÉREZ · DERIO B</span>
     <h2 id="qdCardCorrectionTitle">¡ROJA ANULADA!</h2>
     <p id="qdCardCorrectionText">{DESCRIPTION}</p>
    </div>
    {error&&<p className="qdCardCorrectionError" role="alert">{error}</p>}
    <button ref={closeRef} type="button" className="qdCardCorrectionAction" disabled={saving||acknowledged} onClick={()=>void confirm()}>
     {saving?"Guardando…":"Entendido"}
    </button>
   </section>
  </div>,document.body
 );
}
