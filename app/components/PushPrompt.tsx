"use client";
import {useEffect,useRef,useState} from "react";
import {supabase} from "../lib/supabase";
async function clearIosBadge(){try{if("clearAppBadge"in navigator)await (navigator as Navigator & {clearAppBadge:()=>Promise<void>}).clearAppBadge();else if("setAppBadge"in navigator)await (navigator as Navigator & {setAppBadge:(n?:number)=>Promise<void>}).setAppBadge(0);const reg=await navigator.serviceWorker?.ready;reg?.active?.postMessage({type:"CLEAR_BADGE"})}catch{}}
function keyBytes(s:string){const p="=".repeat((4-s.length%4)%4);return Uint8Array.from(atob((s+p).replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0))}
function identity(){let id="";let name="Jugador";try{const player=JSON.parse(localStorage.getItem("quiniderio-player")||"{}");id=player.userId||"";name=player.name||name}catch{}if(!id)id=localStorage.getItem("quiniderio-player-id")||"";if(!id){id=crypto.randomUUID();localStorage.setItem("quiniderio-player-id",id)}return{id,name}}
export async function getPushState(){
  if(!("serviceWorker"in navigator)||!("PushManager"in window)||!("Notification"in window))return {supported:false,enabled:false,permission:"unsupported"};
  const permission=Notification.permission;
  try{
    const reg=await navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"});
    const sub=await reg.pushManager.getSubscription();
    if(permission!=="granted"||!sub)return {supported:true,enabled:false,permission};
    const {data:{session}}=await supabase.auth.getSession();
    if(!session?.access_token)return {supported:true,enabled:false,permission};
    const response=await fetch("/api/push",{method:"GET",headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
    if(!response.ok)return {supported:true,enabled:false,permission};
    const {endpoints}=await response.json();
    return {supported:true,enabled:Array.isArray(endpoints)&&endpoints.includes(sub.endpoint),permission};
  }catch{return {supported:true,enabled:false,permission}}
}
export async function enablePush(){if(!("serviceWorker"in navigator)||!("PushManager"in window)||!("Notification"in window))throw new Error("unsupported");if(Notification.permission==="denied")throw new Error("denied");const standalone=window.matchMedia("(display-mode: standalone)").matches||("standalone"in navigator&&(navigator as Navigator & {standalone?:boolean}).standalone===true);if(!standalone&&/iPad|iPhone|iPod/.test(navigator.userAgent))throw new Error("install");if(Notification.permission!=="granted"&&await Notification.requestPermission()!=="granted")return false;await navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"});const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub){const k=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;if(!k)throw new Error("vapid");try{sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(k)})}catch{throw new Error("subscribe")}}const j=sub.toJSON(),p=identity();const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error("login");if(!j.keys?.p256dh||!j.keys?.auth){try{await sub.unsubscribe()}catch{}throw new Error("subscription_keys")}const r=await fetch("/api/push",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({playerId:p.id,name:p.name,subscription:{endpoint:sub.endpoint,keys:j.keys}})});if(!r.ok){try{await sub.unsubscribe()}catch{}throw new Error("save");}localStorage.setItem("quiniderio-notifications","true");window.dispatchEvent(new CustomEvent("quiniderio-push-state",{detail:true}));return true}
export async function disablePush(){const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error("login");const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub){const response=await fetch("/api/push",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({endpoint:sub.endpoint})});if(!response.ok)throw new Error("save");await sub.unsubscribe()}localStorage.setItem("quiniderio-notifications","false");window.dispatchEvent(new CustomEvent("quiniderio-push-state",{detail:false}))}
export async function testPush(token:string){if(!("serviceWorker"in navigator)||!("PushManager"in window)||!("Notification"in window))throw new Error("unsupported");if(Notification.permission!=="granted")throw new Error("permission");const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(!sub)throw new Error("subscription");const r=await fetch("/api/push/test",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({endpoint:sub.endpoint})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||"delivery");return true}
export default function PushPrompt(){const[show,setShow]=useState(false),[busy,setBusy]=useState(false),[err,setErr]=useState(""),[success,setSuccess]=useState(false),[leaving,setLeaving]=useState(false);const dismissedThisVisit=useRef(false);useEffect(()=>{
  let mounted=true;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const check=async()=>{
    if(!mounted||dismissedThisVisit.current||document.visibilityState==="hidden")return;
    let player:{userId?:string,completed?:boolean}|null=null;
    try{player=JSON.parse(localStorage.getItem("quiniderio-player")||"null")}catch{}
    if(!player?.userId||!player.completed){timer=setTimeout(()=>void check(),1000);return}
    const state=await getPushState();
    if(!mounted||dismissedThisVisit.current||state.enabled)return;
    // Let any other blocking dialog finish, without depending on the old Jornada 1 notice.
    if(document.querySelector(".roundPendingOverlay")){timer=setTimeout(()=>void check(),600);return}
    setLeaving(false);setSuccess(false);
    setErr(state.permission==="denied"?"Las notificaciones están bloqueadas. Actívalas en Ajustes del dispositivo.":state.supported?"":"Este dispositivo no admite notificaciones web push.");
    setShow(true);
  };
  const entry=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>void check(),650)};
  const visibility=()=>{if(document.visibilityState==="hidden")dismissedThisVisit.current=false;else entry()};
  const clear=()=>void clearIosBadge();
  const onVisibility=()=>{visibility();if(document.visibilityState==="visible")clear()};
  void clearIosBadge();
  window.addEventListener("focus",clear);
  window.addEventListener("pageshow",entry);
  window.addEventListener("popstate",clear);
  document.addEventListener("visibilitychange",onVisibility);
  window.addEventListener("quiniderio-suspended-popup-closed",entry);
  const badgeTimer=window.setInterval(clear,3000);
  entry();
  return()=>{
    mounted=false;if(timer)clearTimeout(timer);
    window.removeEventListener("focus",clear);
    window.removeEventListener("pageshow",entry);
    window.removeEventListener("popstate",clear);
    document.removeEventListener("visibilitychange",onVisibility);
    window.removeEventListener("quiniderio-suspended-popup-closed",entry);
    window.clearInterval(badgeTimer);
  };
},[]);if(!show)return null;const close=()=>{dismissedThisVisit.current=true;localStorage.setItem("quiniderio-push-prompt-seen-v1",String(Date.now()));setLeaving(true);setTimeout(()=>setShow(false),360)};return <div className={"pushPromptBackdrop "+(leaving?"isLeaving":"")}><section className={"pushPrompt "+(success?"pushSuccess":"")} role="dialog" aria-modal="true"><div className="pushBell" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>{success?<><h2>¡Notificaciones activadas!</h2><p>Ya recibirás los avisos importantes de cada jornada.</p></>:<><h2>No te pierdas la jornada</h2><p>Activa las notificaciones para recibir recordatorios si aún no has enviado tu quiniela, además de avisos de cierre y resultados.</p>{err&&<small>{err}</small>}<button disabled={busy} onClick={async()=>{setBusy(true);try{if(await enablePush()){setSuccess(true);setTimeout(close,1800)}else setErr("Necesitamos permiso para enviarte avisos.")}catch(e){const m=e instanceof Error?e.message:"";setErr(m==="login"?"Inicia sesión para activar las notificaciones.":m==="denied"?"Las notificaciones están bloqueadas. Actívalas en Ajustes del dispositivo.":m==="install"?"Abre QuiniDerio desde el icono de la pantalla de inicio.":m==="vapid"?"Falta la configuración VAPID de QuiniDerio.":m==="subscribe"?"iOS no ha podido crear la suscripción push.":m==="subscription_keys"?"iOS ha creado una suscripción incompleta. Cierra la app y vuelve a abrirla.":m==="save"?"iOS ha dado permiso, pero el servidor no ha podido guardar este dispositivo.":m==="unsupported"?"Este dispositivo no admite notificaciones push.":"No se han podido activar las notificaciones.")}finally{setBusy(false)}}}>{busy?"Activando…":"Activar notificaciones"}</button><button className="later" onClick={close}>Ahora no</button></>}</section></div>}
