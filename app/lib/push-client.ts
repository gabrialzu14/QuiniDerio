import {supabase} from "./supabase";

type PushError="unsupported"|"native"|"install"|"denied"|"permission"|"login"|"vapid"|"subscribe"|"subscription_keys"|"subscription"|"renew"|"profile_not_found"|"network"|"timeout"|"save"|"delivery";
export type PushState={supported:boolean;enabled:boolean;permission:NotificationPermission|"unsupported";verified:boolean;error?:PushError};
const fail=(code:PushError)=>new Error(code);
function environmentError():PushError|null{
 const host=window as typeof window & {QuiniWidgets?:unknown;webkit?:{messageHandlers?:{quiniWidgets?:unknown}}};
 if(host.QuiniWidgets||host.webkit?.messageHandlers?.quiniWidgets)return "native";
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
 const standalone=window.matchMedia("(display-mode: standalone)").matches||(navigator as Navigator & {standalone?:boolean}).standalone===true;
 if(ios&&!standalone)return "install";
 if(!("serviceWorker"in navigator)||!("PushManager"in window)||!("Notification"in window))return "unsupported";
 return null;
}
async function deadline<T>(promise:Promise<T>,ms=10000):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(fail("timeout")),ms)})])}
 finally{if(timer)clearTimeout(timer)}
}
let preparedRegistration:ServiceWorkerRegistration|undefined;
let preparing:Promise<ServiceWorkerRegistration>|undefined;
function registration():Promise<ServiceWorkerRegistration>{
 if(preparedRegistration?.active)return Promise.resolve(preparedRegistration);
 if(preparing)return preparing;
 preparing=(async()=>{
  try{
   await deadline(navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"}),20000);
   preparedRegistration=await deadline(navigator.serviceWorker.ready,20000);
   return preparedRegistration;
  }catch(e){if(e instanceof Error&&e.message==="timeout")throw e;throw fail("network")}
 })().finally(()=>{preparing=undefined});
 return preparing;
}
async function pushRequest(method:"GET"|"POST"|"DELETE",body?:unknown,tokenOverride?:string,path="/api/push"){
 let token=tokenOverride;
 if(!token){const {data:{session}}=await deadline(supabase.auth.getSession());token=session?.access_token}
 if(!token)throw fail("login");
 for(let attempt=0;attempt<2;attempt++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  let response:Response;
  try{response=await fetch(path,{method,headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:"no-store",signal:controller.signal})}
  catch{throw fail(controller.signal.aborted?"timeout":"network")}
  finally{clearTimeout(timer)}
  if(response.status===401&&attempt===0){
   const refreshed=await deadline(supabase.auth.refreshSession());
   if(refreshed.error||!refreshed.data.session?.access_token)throw fail("login");
   token=refreshed.data.session.access_token;continue;
  }
  const data=await response.json().catch(()=>null);
  if(response.status===401)throw fail("login");
  if(!response.ok)throw fail(data?.error==="profile_not_found"?"profile_not_found":data?.error==="subscription"?(path.endsWith("/test")?"subscription":"subscription_keys"):path.endsWith("/test")?"delivery":"save");
  if(!data||(method!=="GET"&&data.ok!==true))throw fail("save");
  return data;
 }
 throw fail("login");
}
function remember(enabled:boolean){
 try{localStorage.setItem("quiniderio-notifications",String(enabled))}catch{}
 window.dispatchEvent(new CustomEvent("quiniderio-push-state",{detail:enabled}));
}
let checking:Promise<PushState>|undefined;
export function getPushState():Promise<PushState>{
 if(enabling)return enabling.then(()=>getPushState(),()=>getPushState());
 if(checking)return checking;
 checking=(async():Promise<PushState>=>{
  const error=environmentError();
  if(error)return {supported:false,enabled:false,permission:"unsupported",verified:true,error};
  const permission=Notification.permission;
  try{
   // Prepare the worker before showing either activation button. Safari needs
   // subscribe() itself to run in the tap handler, without awaiting worker setup.
   const reg=await registration();
   if(permission!=="granted")return {supported:true,enabled:false,permission,verified:true};
   const sub=await deadline(reg.pushManager.getSubscription());
   if(!sub)return {supported:true,enabled:false,permission,verified:true};
   const data=await pushRequest("GET");
   if(!Array.isArray(data.endpoints))throw fail("save");
   return {supported:true,enabled:data.endpoints.includes(sub.endpoint),permission,verified:true};
  }catch(e){return {supported:true,enabled:false,permission,verified:false,error:(e instanceof Error?e.message:"save") as PushError}}
 })().finally(()=>{checking=undefined});
 return checking;
}
function keyBytes(s:string){const p="=".repeat((4-s.length%4)%4);return Uint8Array.from(atob((s+p).replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0))}
function applicationServerKey(){
 const key=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
 try{if(!key)throw fail("vapid");const bytes=keyBytes(key);if(bytes.length!==65||bytes[0]!==4)throw fail("vapid");return bytes}
 catch{throw fail("vapid")}
}
async function subscribe(reg:ServiceWorkerRegistration,key:Uint8Array<ArrayBuffer>,allowReset=true):Promise<PushSubscription>{
 const create=()=>{
  // Do not time out a native permission dialog while the user is reading it.
  const prompting=Notification.permission==="default";
  const pending=reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  return prompting?pending:deadline(pending,45000);
 };
 try{return await create()}
 catch(error){
  // A previous VAPID key can leave an unusable subscription in this browser.
  if(allowReset&&(error as DOMException)?.name==="InvalidStateError"&&Notification.permission==="granted"){
   const old=await deadline(reg.pushManager.getSubscription());
   if(old){if(!await deadline(old.unsubscribe()))throw fail("subscribe");return subscribe(reg,key,false)}
  }
  if(Notification.permission==="denied")throw fail("denied");
  if((error as DOMException)?.name==="NotAllowedError")throw fail("permission");
  if((error as DOMException)?.name==="InvalidAccessError")throw fail("vapid");
  throw error instanceof Error&&error.message==="timeout"?error:fail("subscribe");
 }
}
let enabling:Promise<boolean>|undefined;
export function enablePush():Promise<boolean>{
 if(enabling)return enabling;
 enabling=(async()=>{
  const error=environmentError();if(error)throw fail(error);
  if(Notification.permission==="denied")throw fail("denied");
  const key=applicationServerKey();
  let reg:ServiceWorkerRegistration,sub:PushSubscription;
  if(preparedRegistration?.active){
   reg=preparedRegistration;
   // subscribe() also prompts for permission; call it before the first await.
   sub=await subscribe(reg,key);
  }else{
   // A very early tap can precede preflight. Keep this permission request in
   // the original gesture and prepare the worker concurrently.
   const permission=Notification.permission==="granted"?Promise.resolve("granted"):Notification.requestPermission();
   const ready=registration();
   const [granted,worker]=await Promise.all([permission,ready]);
   if(granted!=="granted")return false;
   reg=worker;sub=await subscribe(reg,key);
  }
  const status=await pushRequest("GET");
  if(Array.isArray(status.inactiveEndpoints)&&status.inactiveEndpoints.includes(sub.endpoint)){
   // Provider 404/410 errors disable the server row, but getSubscription() can
   // still return that dead endpoint. Replace it rather than re-enabling it.
   const expired=sub.endpoint;
   if(!await deadline(sub.unsubscribe()))throw fail("subscribe");
   sub=await subscribe(reg,key);
   if(sub.endpoint===expired)throw fail("renew");
  }
  const json=sub.toJSON();if(!json.keys?.p256dh||!json.keys?.auth)throw fail("subscription_keys");
  // On a server/network failure retain this subscription so Retry can save it.
  // Browser permission and server registration are two separate states.
  await pushRequest("POST",{subscription:{endpoint:sub.endpoint,keys:json.keys}});
  remember(true);return true;
 })().finally(()=>{enabling=undefined});
 return enabling;
}
export async function disablePush(){
 const error=environmentError();if(error)throw fail(error);
 const reg=await registration(),sub=await reg.pushManager.getSubscription();
 if(sub){await pushRequest("DELETE",{endpoint:sub.endpoint});await sub.unsubscribe()}
 remember(false);
}
export async function testPush(token?:string){
 const error=environmentError();if(error)throw fail(error);
 if(Notification.permission!=="granted")throw fail("permission");
 const reg=await registration(),sub=await reg.pushManager.getSubscription();if(!sub)throw fail("subscription");
 await pushRequest("POST",{endpoint:sub.endpoint},token,"/api/push/test");
 return true;
}
export function pushErrorMessage(error:unknown):string{
 const code=error instanceof Error?error.message:String(error||"");
 const messages:Record<PushError,string>={
  unsupported:"Este dispositivo no admite notificaciones web push.",
  native:"Esta versión nativa no incluye notificaciones web. Abre QuiniDerio desde el icono instalado con Safari.",
  install:"En iPhone o iPad: abre QuiniDerio en Safari, pulsa Compartir → Añadir a pantalla de inicio y ábrela desde ese icono para activar las notificaciones.",
  denied:"Las notificaciones están bloqueadas. En iPhone: Ajustes → Notificaciones → QuiniDerio → Permitir notificaciones. En Android: ajustes del sitio del navegador → Notificaciones → Permitir. Después, vuelve y pulsa Activar notificaciones.",
  permission:"Necesitamos permiso para enviarte avisos.",
  login:"Tu sesión ha caducado. Inicia sesión de nuevo y vuelve a activar las notificaciones.",
  vapid:"La configuración de notificaciones de QuiniDerio no está completa.",
  subscribe:"No se ha podido crear la suscripción del dispositivo. Vuelve a intentarlo.",
  subscription_keys:"La suscripción del dispositivo está incompleta. No se ha podido registrar.",
  subscription:"Activa primero las notificaciones en este dispositivo.",
  renew:"El dispositivo conserva una suscripción caducada. Cierra y vuelve a abrir QuiniDerio y pulsa Activar notificaciones para renovarla.",
  profile_not_found:"No se ha encontrado tu perfil. Inicia sesión de nuevo para completar el registro.",
  network:"No se ha podido conectar. Comprueba tu conexión y vuelve a intentarlo.",
  timeout:"La conexión ha tardado demasiado. Vuelve a intentarlo.",
  save:"El permiso está concedido, pero no se ha podido guardar el dispositivo. Puedes volver a intentarlo.",
  delivery:"No se ha podido enviar la notificación de prueba. Vuelve a intentarlo."
 };
 return messages[code as PushError]||"No se han podido activar las notificaciones. Vuelve a intentarlo.";
}
