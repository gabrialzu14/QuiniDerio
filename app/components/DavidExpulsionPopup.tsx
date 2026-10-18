"use client";

import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {supabase} from "../lib/supabase";
import usePageScrollLock from "./usePageScrollLock";
import {DAVID_EXPULSION} from "./david-expulsion-config";

const keyFor=(userId:string)=>"quiniderio:announcement:"+DAVID_EXPULSION.version+":"+userId;

export default function DavidExpulsionPopup(){
 const[open,setOpen]=useState(false);
 const[leaving,setLeaving]=useState(false);
 const[userKey,setUserKey]=useState("");
 const closeRef=useRef<HTMLButtonElement|null>(null);
 const shownRef=useRef(false);
 const closingRef=useRef(false);
 const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 usePageScrollLock(open);

 useEffect(()=>{
  // Never expose the announcement without the actual supplied photograph.
  if(!DAVID_EXPULSION.enabled||!DAVID_EXPULSION.photoSrc)return;
  let active=true;
  let timer:ReturnType<typeof setTimeout>|null=null;
  const schedule=(delay:number)=>{
   if(timer)clearTimeout(timer);
   timer=setTimeout(()=>void check(),delay);
  };
  const check=async()=>{
   if(!active||shownRef.current||document.visibilityState==="hidden")return;
   const {data:{session}}=await supabase.auth.getSession();
   if(!active||!session?.user?.id)return;
   const key=keyFor(session.user.id);
   try{
    const player=JSON.parse(localStorage.getItem("quiniderio-player")||"null") as {completed?:boolean,userId?:string}|null;
    if(!player?.completed||player.userId!==session.user.id)return;
    if(localStorage.getItem(key)==="seen")return;
   }catch{return}
   // Respect onboarding, notifications and other existing blocking dialogs.
   if(document.querySelector('[aria-modal="true"],.roundPendingOverlay,.pushPromptBackdrop,.assistantPredictionOverlay')){
    schedule(800);return;
   }
   setUserKey(key);
   shownRef.current=true;
   setLeaving(false);
   setOpen(true);
  };
  schedule(360);
  const visible=()=>{if(document.visibilityState==="visible")schedule(350)};
  document.addEventListener("visibilitychange",visible);
  window.addEventListener("quiniderio-suspended-popup-closed",visible);
  window.addEventListener("quiniderio-david-popup-check",visible);
  return()=>{
   active=false;
   if(timer)clearTimeout(timer);
   document.removeEventListener("visibilitychange",visible);
   window.removeEventListener("quiniderio-suspended-popup-closed",visible);
   window.removeEventListener("quiniderio-david-popup-check",visible);
  };
 },[]);

 const dismiss=()=>{
  if(closingRef.current)return;
  closingRef.current=true;
  try{if(userKey)localStorage.setItem(userKey,"seen")}catch{}
  setLeaving(true);
  closeTimer.current=setTimeout(()=>{
   setOpen(false);
   window.dispatchEvent(new Event("quiniderio-david-popup-closed"));
  },280);
 };
 useEffect(()=>{
  if(!open)return;
  const previouslyFocused=document.activeElement as HTMLElement|null;
  closeRef.current?.focus({preventScroll:true});
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();dismiss();}
   if(event.key==="Tab"){event.preventDefault();closeRef.current?.focus({preventScroll:true});}
  };
  document.addEventListener("keydown",onKey);
  return()=>{
   document.removeEventListener("keydown",onKey);
   previouslyFocused?.focus?.({preventScroll:true});
  };
 // dismiss is only invoked from active dialog controls and its own keyboard listener.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[open]);
 useEffect(()=>()=>{if(closeTimer.current)clearTimeout(closeTimer.current)},[]);
 if(!open||typeof document==="undefined")return null;
 return createPortal(
  <div className={"qdDavidExpulsionOverlay "+(leaving?"isLeaving":"")} role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)dismiss()}}>
   <section className="qdDavidExpulsionModal" role="dialog" aria-modal="true" aria-labelledby="qdDavidExpulsionTitle" aria-describedby="qdDavidExpulsionHint">
    <button ref={closeRef} type="button" className="qdDavidExpulsionClose" onClick={dismiss} aria-label="Cerrar anuncio">×</button>
    <div className="qdDavidExpulsionEyebrow">QUINIDERIO · ÚLTIMA HORA</div>
    <div className="qdDavidExpulsionStage" aria-hidden="true">
     <span className="qdDavidExpulsionParticle p1"/><span className="qdDavidExpulsionParticle p2"/>
     <span className="qdDavidExpulsionParticle p3"/><span className="qdDavidExpulsionParticle p4"/>
     <span className="qdDavidExpulsionParticle p5"/><span className="qdDavidExpulsionParticle p6"/>
     <div className="qdDavidExpulsionRedCard"><span/></div>
     <div className="qdDavidExpulsionPortrait">
      {DAVID_EXPULSION.photoSrc?<img src={DAVID_EXPULSION.photoSrc} alt="" decoding="async"/>:<span>DAVID</span>}
     </div>
    </div>
    <div className="qdDavidExpulsionCopy">
     <span className="qdDavidExpulsionLabel">PRIMERA EXPULSIÓN</span>
     <h2 id="qdDavidExpulsionTitle">{DAVID_EXPULSION.message}</h2>
     <p id="qdDavidExpulsionHint">David hace historia en el banquillo.</p>
    </div>
    <button type="button" className="qdDavidExpulsionAction" onClick={dismiss}>Entendido</button>
   </section>
  </div>,document.body
 );
}
