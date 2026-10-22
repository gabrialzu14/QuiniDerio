import {supabase} from "./supabase";

type PushError="unsupported"|"native"|"install"|"denied"|"permission"|"login"|"vapid"|"subscribe"|"subscription_keys"|"subscription"|"profile_not_found"|"network"|"timeout"|"save"|"delivery";
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
async function registration(){
 try{await deadline(navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"}));return await deadline(navigator.serviceWorker.ready)}
 catch(e){if(e instanceof Error&&e.message==="timeout")throw e;throw fail("network")}
}
async function pushRequest(method:"GET"|"POST"|"DELETE",body?:unknown,tokenOverride?:string,path="/api/push"){
 const {data:{session}}=await supabase.auth.getSession();
 let token=tokenOverride||session?.access_token;
 if(!token)throw fail("login");
 for(let attempt=0;attempt<2;attempt++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  let response:Response;
  try{response=await fetch(path,{method,headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:"no-store",signal:controller.signal})}
  catch{throw fail(controller.signal.aborted?"timeout":"network")}
  finally{clearTimeout(timer)}
  if(response.status===401&&attempt===0){
   const refreshed=await supabase.auth.refreshSession();
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
 if(checking)return checking;
 checking=(async():Promise<PushState>=>{
  const error=environmentError();
  if(error)return {supported:false,enabled:false,permission:"unsupported",verified:true,error};
  const permission=Notification.permission;
  if(permission!=="granted")return {supported:true,enabled:false,permission,verified:true};
  try{
   const reg=await registration(),sub=await reg.pushManager.getSubscription();
   if(!sub)return {supported:true,enabled:false,permission,verified:true};
   const data=await pushRequest("GET");
   if(!Array.isArray(data.endpoints))throw fail("save");
   return {supported:true,enabled:data.endpoints.includes(sub.endpoint),permission,verified:true};
  }catch(e){return {supported:true,enabled:false,permission,verified:false,error:(e instanceof Error?e.message:"save") as PushError}}
 })().finally(()=>{checking=undefined});
 return checking;
}
function keyBytes(s:string){const p="=".repeat((4-s.length%4)%4);return Uint8Array.from(atob((s+p).replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0))}
let enabling:Promise<boolean>|undefined;
export function enablePush():Promise<boolean>{
 if(enabling)return enabling;
 enabling=(async()=>{
  const error=environmentError();if(error)throw fail(error);
  if(Notification.permission==="denied")throw fail("denied");
  // Keep the permission request directly in the user's click gesture on iOS.
  if(Notification.permission!=="granted"&&await Notification.requestPermission()!=="granted")return false;
  const reg=await registration();let sub=await reg.pushManager.getSubscription();
  if(!sub){
   const key=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;if(!key)throw fail("vapid");
   try{sub=await deadline(reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(key)}))}
   catch(e){throw e instanceof Error&&e.message==="timeout"?e:fail("subscribe")}
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
  install:"En iPhone, abre QuiniDerio desde el icono añadido a la pantalla de inicio con Safari.",
  denied:"Las notificaciones están bloqueadas. Actívalas en los ajustes de notificaciones de QuiniDerio.",
  permission:"Necesitamos permiso para enviarte avisos.",
  login:"Tu sesión ha caducado. Inicia sesión de nuevo y vuelve a activar las notificaciones.",
  vapid:"La configuración de notificaciones de QuiniDerio no está completa.",
  subscribe:"No se ha podido crear la suscripción del dispositivo. Vuelve a intentarlo.",
  subscription_keys:"La suscripción del dispositivo está incompleta. No se ha podido registrar.",
  subscription:"Activa primero las notificaciones en este dispositivo.",
  profile_not_found:"No se ha encontrado tu perfil. Inicia sesión de nuevo para completar el registro.",
  network:"No se ha podido conectar. Comprueba tu conexión y vuelve a intentarlo.",
  timeout:"La conexión ha tardado demasiado. Vuelve a intentarlo.",
  save:"El permiso está concedido, pero no se ha podido guardar el dispositivo. Puedes volver a intentarlo.",
  delivery:"No se ha podido enviar la notificación de prueba. Vuelve a intentarlo."
 };
 return messages[code as PushError]||"No se han podido activar las notificaciones. Vuelve a intentarlo.";
}
