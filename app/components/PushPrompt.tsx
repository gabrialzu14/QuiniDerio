"use client";
import {useEffect,useRef,useState} from "react";
import {getPushState,enablePush,pushErrorMessage} from "../lib/push-client";
import {PUSH_PROMPT_SEEN_KEY,pushPromptDue} from "../lib/push-prompt-policy";
import usePageScrollLock from "./usePageScrollLock";

async function clearIosBadge(){
  try{
    if("clearAppBadge"in navigator)await (navigator as Navigator & {clearAppBadge:()=>Promise<void>}).clearAppBadge();
    else if("setAppBadge"in navigator)await (navigator as Navigator & {setAppBadge:(n?:number)=>Promise<void>}).setAppBadge(0);
    const reg=await navigator.serviceWorker?.getRegistration("/");
    reg?.active?.postMessage({type:"CLEAR_BADGE"});
  }catch{}
}
export {getPushState,enablePush,disablePush,testPush,pushErrorMessage} from "../lib/push-client";

export default function PushPrompt(){
  const[show,setShow]=useState(false),[busy,setBusy]=useState(false),[err,setErr]=useState(""),[success,setSuccess]=useState(false),[leaving,setLeaving]=useState(false);
  const open=useRef(false),busyRef=useRef(false),mounted=useRef(false),lastShown=useRef<string|null>(null);
  const closeTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const successTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  usePageScrollLock(show);

  useEffect(()=>{
    mounted.current=true;
    let checking=false;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const hidden=()=>document.visibilityState==="hidden";
    const check=async()=>{
      if(!mounted.current||checking||open.current||busyRef.current||hidden())return;
      let player:{userId?:string,completed?:boolean}|null=null;
      try{player=JSON.parse(localStorage.getItem("quiniderio-player")||"null")}catch{}
      if(!player?.userId||!player.completed){timer=setTimeout(()=>void check(),1000);return}
      checking=true;
      try{
        const state=await getPushState();
        if(!mounted.current||open.current||busyRef.current||hidden()||state.enabled)return;
        let seen=lastShown.current;
        try{const stored=localStorage.getItem(PUSH_PROMPT_SEEN_KEY);if(stored)seen=stored}catch{}
        if(!pushPromptDue(seen))return;
        if(document.querySelector(".roundPendingOverlay,.qdDavidExpulsionOverlay,.qdCardCorrectionOverlay,.qdRecapOverlay,.qdResultOverlay")){
          timer=setTimeout(()=>void check(),600);return;
        }
        // Count the appearance, even if the app is closed without dismissing.
        lastShown.current=String(Date.now());
        try{localStorage.setItem(PUSH_PROMPT_SEEN_KEY,lastShown.current)}catch{}
        open.current=true;
        setLeaving(false);setSuccess(false);
        setErr(state.error?pushErrorMessage(state.error):state.permission==="denied"?pushErrorMessage("denied"):"");
        setShow(true);
      }finally{checking=false}
    };
    const entry=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>void check(),650)};
    const clear=()=>void clearIosBadge();
    const onVisibility=()=>{if(document.visibilityState==="visible"){entry();clear()}};
    const onStorage=(event:StorageEvent)=>{if(event.key===PUSH_PROMPT_SEEN_KEY)entry()};
    clear();entry();
    window.addEventListener("focus",entry);
    window.addEventListener("focus",clear);
    window.addEventListener("pageshow",entry);
    window.addEventListener("quiniderio-push-state",entry);
    window.addEventListener("popstate",clear);
    window.addEventListener("storage",onStorage);
    document.addEventListener("visibilitychange",onVisibility);
    window.addEventListener("quiniderio-suspended-popup-closed",entry);
    window.addEventListener("quiniderio-david-popup-closed",entry);
    const badgeTimer=window.setInterval(clear,3000);
    return()=>{
      mounted.current=false;
      if(timer)clearTimeout(timer);
      if(closeTimer.current)clearTimeout(closeTimer.current);
      if(successTimer.current)clearTimeout(successTimer.current);
      window.removeEventListener("focus",entry);
      window.removeEventListener("focus",clear);
      window.removeEventListener("pageshow",entry);
      window.removeEventListener("quiniderio-push-state",entry);
      window.removeEventListener("popstate",clear);
      window.removeEventListener("storage",onStorage);
      document.removeEventListener("visibilitychange",onVisibility);
      window.removeEventListener("quiniderio-suspended-popup-closed",entry);
      window.removeEventListener("quiniderio-david-popup-closed",entry);
      window.clearInterval(badgeTimer);
    };
  },[]);

  const close=()=>{
    setLeaving(true);
    closeTimer.current=setTimeout(()=>{if(mounted.current){setShow(false);open.current=false}},360);
  };
  const activate=async()=>{
    if(busyRef.current)return;
    busyRef.current=true;setBusy(true);setErr("");
    try{
      if(await enablePush()){
        if(!mounted.current)return;
        setSuccess(true);successTimer.current=setTimeout(close,1800);
      }else if(mounted.current)setErr(pushErrorMessage("permission"));
    }catch(error){if(mounted.current)setErr(pushErrorMessage(error))}
    finally{busyRef.current=false;if(mounted.current)setBusy(false)}
  };
  if(!show)return null;
  return <div className={"pushPromptBackdrop "+(leaving?"isLeaving":"")}>
    <section className={"pushPrompt "+(success?"pushSuccess":"")} role="dialog" aria-modal="true" aria-labelledby="push-prompt-title" aria-describedby="push-prompt-description" aria-busy={busy}>
      <div className="pushBell" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
      {success?<>
        <h2 id="push-prompt-title">¡Notificaciones activadas!</h2><p id="push-prompt-description" role="status">Ya recibirás los avisos importantes de cada jornada.</p>
      </>:<>
        <h2 id="push-prompt-title">Notificaciones</h2><p id="push-prompt-description">Activa las notificaciones para recibir recordatorios si aún no has enviado tu quiniela, además de avisos de cierre y resultados.</p>
        {err&&<small role="status" aria-live="polite">{err}</small>}
        <button type="button" disabled={busy} onClick={activate}>{busy?"Activando…":"Activar notificaciones"}</button>
        <button type="button" className="later" disabled={busy} onClick={close}>Ahora no</button>
      </>}
    </section>
  </div>;
}
