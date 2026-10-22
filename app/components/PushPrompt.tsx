"use client";
import {useEffect,useRef,useState} from "react";
import {getPushState,enablePush,pushErrorMessage} from "../lib/push-client";
async function clearIosBadge(){try{if("clearAppBadge"in navigator)await (navigator as Navigator & {clearAppBadge:()=>Promise<void>}).clearAppBadge();else if("setAppBadge"in navigator)await (navigator as Navigator & {setAppBadge:(n?:number)=>Promise<void>}).setAppBadge(0);const reg=await navigator.serviceWorker?.ready;reg?.active?.postMessage({type:"CLEAR_BADGE"})}catch{}}
export {getPushState,enablePush,disablePush,testPush,pushErrorMessage} from "../lib/push-client";
export default function PushPrompt(){const[show,setShow]=useState(false),[busy,setBusy]=useState(false),[err,setErr]=useState(""),[success,setSuccess]=useState(false),[leaving,setLeaving]=useState(false);const dismissedThisVisit=useRef(false);useEffect(()=>{
  let mounted=true;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const check=async()=>{
    if(!mounted||dismissedThisVisit.current||document.visibilityState==="hidden")return;
    let player:{userId?:string,completed?:boolean}|null=null;
    try{player=JSON.parse(localStorage.getItem("quiniderio-player")||"null")}catch{}
    if(!player?.userId||!player.completed){timer=setTimeout(()=>void check(),1000);return}
    const state=await getPushState();
    if(!mounted||dismissedThisVisit.current)return;
    if(state.enabled){setShow(false);return}
    // Let any other blocking dialog finish, without depending on the old Jornada 1 notice.
    if(document.querySelector(".roundPendingOverlay,.qdDavidExpulsionOverlay,.qdCardCorrectionOverlay")){timer=setTimeout(()=>void check(),600);return}
    setLeaving(false);setSuccess(false);
    setErr(state.error?pushErrorMessage(state.error):state.permission==="denied"?pushErrorMessage("denied"):"");
    setShow(true);
  };
  const entry=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>void check(),650)};
  const visibility=()=>{if(document.visibilityState==="hidden")dismissedThisVisit.current=false;else entry()};
  const clear=()=>void clearIosBadge();
  const onVisibility=()=>{visibility();if(document.visibilityState==="visible")clear()};
  void clearIosBadge();
  window.addEventListener("focus",clear);
  window.addEventListener("pageshow",entry);
  window.addEventListener("quiniderio-push-state",entry);
  window.addEventListener("popstate",clear);
  document.addEventListener("visibilitychange",onVisibility);
  window.addEventListener("quiniderio-suspended-popup-closed",entry);
  window.addEventListener("quiniderio-david-popup-closed",entry);
  const badgeTimer=window.setInterval(clear,3000);
  entry();
  return()=>{
    mounted=false;if(timer)clearTimeout(timer);
    window.removeEventListener("focus",clear);
    window.removeEventListener("pageshow",entry);
    window.removeEventListener("quiniderio-push-state",entry);
    window.removeEventListener("popstate",clear);
    document.removeEventListener("visibilitychange",onVisibility);
    window.removeEventListener("quiniderio-suspended-popup-closed",entry);
    window.removeEventListener("quiniderio-david-popup-closed",entry);
    window.clearInterval(badgeTimer);
  };
},[]);if(!show)return null;const close=()=>{dismissedThisVisit.current=true;localStorage.setItem("quiniderio-push-prompt-seen-v1",String(Date.now()));setLeaving(true);setTimeout(()=>setShow(false),360)};return <div className={"pushPromptBackdrop "+(leaving?"isLeaving":"")}><section className={"pushPrompt "+(success?"pushSuccess":"")} role="dialog" aria-modal="true"><div className="pushBell" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>{success?<><h2>¡Notificaciones activadas!</h2><p>Ya recibirás los avisos importantes de cada jornada.</p></>:<><h2>Notificaciones</h2><p>Activa las notificaciones para recibir recordatorios si aún no has enviado tu quiniela, además de avisos de cierre y resultados.</p>{err&&<small>{err}</small>}<button disabled={busy} onClick={async()=>{setBusy(true);try{if(await enablePush()){setSuccess(true);setTimeout(close,1800)}else setErr("Necesitamos permiso para enviarte avisos.")}catch(e){setErr(pushErrorMessage(e))}finally{setBusy(false)}}}>{busy?"Activando…":"Activar notificaciones"}</button><button className="later" onClick={close}>Ahora no</button></>}</section></div>}
