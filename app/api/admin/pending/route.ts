import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import webpush from "web-push";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||"";const key=process.env.SUPABASE_SERVICE_ROLE_KEY||"";const ADMIN="gabrialzueta@gmail.com";
function db(){if(!url||!key)throw new Error("supabase_env");return createClient(url,key,{auth:{persistSession:false}})}
async function admin(req:NextRequest){const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");if(!token)return null;const {data}=await db().auth.getUser(token);return data.user?.email?.toLowerCase()===ADMIN?data.user:null}
export async function GET(req:NextRequest){try{if(!await admin(req))return NextResponse.json({error:"forbidden"},{status:403});const client=db();
 if(req.nextUrl.searchParams.get("history")==="1"){
  const requested=Number(req.nextUrl.searchParams.get("round")||0);
  if(!Number.isSafeInteger(requested)||requested<1)return NextResponse.json({error:"round"},{status:400});
  const {data,error}=await client.from("quini_push_reminder_reports").select("request_id,round,user_id,username,status,reason,accepted_devices,failed_devices,created_at").eq("round",requested).order("created_at",{ascending:false}).limit(120);
  if(error)throw error;
  return NextResponse.json({reports:data||[]},{headers:{"Cache-Control":"no-store"}});
 }
 const requested=Number(req.nextUrl.searchParams.get("round")||0);let round=Math.max(0,requested);if(!round){const {data:schedule,error:se}=await client.from("quini_live_matches").select("round,scheduled_at").not("scheduled_at","is",null).order("round",{ascending:true});if(se)throw se;const now=Date.now();const firstByRound=new Map<number,number>();for(const m of schedule||[]){const r=Number(m.round);const at=new Date(m.scheduled_at).getTime();if(!Number.isFinite(at))continue;const prev=firstByRound.get(r);if(prev===undefined||at<prev)firstByRound.set(r,at)}const rounds=[...firstByRound.entries()].sort((a,b)=>a[0]-b[0]);round=rounds.find(([,first])=>first>now)?.[0]||rounds.at(-1)?.[0]||1}const [{data:profiles,error:pe},{data:picks,error:qe},{data:matches,error:me}]=await Promise.all([client.from("quini_public_profiles").select("user_id,username,has_profile_pic").order("username"),client.from("quini_picks").select("user_id,team").eq("round",round),client.from("quini_live_matches").select("team").eq("round",round)]);if(pe||qe)throw pe||qe;const expected=new Set((matches||[]).map((m:any)=>m.team));if(me||expected.size===0){["Derio A","Derio B","Derio Fem","Derio Fem B","Juvenil A","Juvenil B"].forEach(t=>expected.add(t))}const byUser=new Map<string,Set<string>>();for(const p of picks||[]){if(!byUser.has(p.user_id))byUser.set(p.user_id,new Set());if(expected.has(p.team))byUser.get(p.user_id)!.add(p.team)}const pending=(profiles||[]).map((p:any)=>({user_id:p.user_id,username:p.username,profile_pic:p.has_profile_pic?`/api/avatar/${p.user_id}`:"",sent:byUser.get(p.user_id)?.size||0,total:expected.size})).filter((p:any)=>p.sent<p.total);return NextResponse.json({round,totalParticipants:(profiles||[]).length,pending})}catch(e){console.error(e);return NextResponse.json({error:"pending"},{status:500})}}


type RecipientStatus="accepted"|"failed"|"no_subscription"|"unknown";
type RecipientReport={user_id:string;username:string;status:RecipientStatus;reason:string|null;accepted_devices:number;failed_devices:number};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function failureReason(error:unknown){
 const e=error as {statusCode?:number;code?:string};
 switch(e?.statusCode){
  case 404:case 410:return "La suscripción del dispositivo ha caducado o ha sido eliminada.";
  case 401:case 403:return "El servicio push ha rechazado la autorización.";
  case 429:return "El proveedor ha limitado temporalmente los envíos.";
  case 400:return "El proveedor ha rechazado los datos de la suscripción.";
 }
 if(["ETIMEDOUT","ECONNRESET","ENOTFOUND","EAI_AGAIN"].includes(e?.code||""))return "Error de conexión con el servicio push.";
 return "Error del servicio push; no se ha confirmado la aceptación.";
}
export async function POST(req:NextRequest){
 try{
  if(!await admin(req))return NextResponse.json({error:"forbidden"},{status:403});
  const body=await req.json().catch(()=>null);
  const ids:unknown[]=Array.isArray(body?.playerIds)?body.playerIds:[body?.playerId];
  const playerIds:string[]=[...new Set<string>(ids.filter((x):x is string=>typeof x==="string"&&uuid.test(x)))];
  const round=Number(body?.round);
  const requestId=typeof body?.requestId==="string"&&uuid.test(body.requestId)?body.requestId:crypto.randomUUID();
  if(!playerIds.length||playerIds.length>100||!Number.isSafeInteger(round)||round<1||round>1000)
   return NextResponse.json({error:"invalid_request"},{status:400});
  const client=db();
  const [{data:profiles,error:profileError},{data:players,error:playersError}]=await Promise.all([
   client.from("quini_public_profiles").select("user_id,username").in("user_id",playerIds),
   client.from("players").select("id,auth_user_id").in("auth_user_id",playerIds)
  ]);
  if(profileError||playersError)throw profileError||playersError;
  const names=new Map((profiles||[]).map(p=>[p.user_id,p.username||"Participante"]));
  const playerByAuth=new Map((players||[]).map(p=>[p.auth_user_id,p.id]));
  const internalIds=[...playerByAuth.values()];
  const {data:subscriptions,error:subError}=internalIds.length
   ?await client.from("push_subscriptions").select("id,player_id,endpoint,p256dh,auth").in("player_id",internalIds).eq("enabled",true)
   :{data:[],error:null};
  if(subError)throw subError;
  type PushSubscription={id:number;player_id:string;endpoint:string;p256dh:string;auth:string};
  const subsById=new Map<string,PushSubscription[]>();
  for(const s of subscriptions||[]){
   const devices=subsById.get(s.player_id)||[];
   devices.push(s);subsById.set(s.player_id,devices);
  }
  const pub=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||"";
  const priv=process.env.VAPID_PRIVATE_KEY||"";
  const configured=!!(pub&&priv);
  if(configured)webpush.setVapidDetails(process.env.VAPID_SUBJECT||"mailto:gabrialzueta@gmail.com",pub,priv);
  const processRecipient=async(userId:string):Promise<RecipientReport>=>{
   const username=names.get(userId)||"Participante";
   const defaultReport=(status:RecipientStatus,reason:string|null,accepted_devices=0,failed_devices=0):RecipientReport=>({user_id:userId,username,status,reason,accepted_devices,failed_devices});
   // Claim the (request, recipient) pair before any push. A retry never sends again.
   const {data:claimed,error:claimError}=await client.from("quini_push_reminder_reports")
    .insert({request_id:requestId,round,user_id:userId,username,status:"processing"})
    .select("id").maybeSingle();
   if(claimError||!claimed){
    const {data:existing}=await client.from("quini_push_reminder_reports")
     .select("status,reason,accepted_devices,failed_devices,username")
     .eq("request_id",requestId).eq("user_id",userId).maybeSingle();
    if(existing)return defaultReport(existing.status==="processing"?"unknown":existing.status as RecipientStatus,existing.status==="processing"?"Estado pendiente de confirmar; no se reenvía automáticamente.":existing.reason,existing.accepted_devices,existing.failed_devices);
    return defaultReport("unknown","No se pudo registrar el intento; no se ha realizado ningún envío.");
   }
   let report:RecipientReport;
   const devices=subsById.get(playerByAuth.get(userId)||"")||[];
   if(!devices.length)report=defaultReport("no_subscription","No hay ninguna suscripción push activa registrada para este usuario.");
   else if(!configured)report=defaultReport("failed","Configuración del servicio push no disponible.");
   else{
    let accepted=0,failed=0;const problems:string[]=[];
    const payload=JSON.stringify({title:"QUINIDERIO",body:"Tienes pronósticos pendientes de la Jornada "+round+".",url:"/",tag:"pending-"+round});
    for(const s of devices){
     try{
      await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload,{TTL:3600});
      accepted++;
     }catch(error){
      failed++;problems.push(failureReason(error));
      const code=(error as {statusCode?:number})?.statusCode;
      if(code===404||code===410)await client.from("push_subscriptions").update({enabled:false}).eq("id",s.id);
     }
    }
    report=defaultReport(accepted>0?"accepted":"failed",failed?Array.from(new Set(problems)).join(" "):null,accepted,failed);
   }
   const {error:saveError}=await client.from("quini_push_reminder_reports")
    .update({status:report.status,reason:report.reason,accepted_devices:report.accepted_devices,failed_devices:report.failed_devices}).eq("id",claimed.id);
   // State returned here reflects the provider response, not device delivery.
   if(saveError)report.reason=[report.reason,"No se pudo guardar el informe en el historial."].filter(Boolean).join(" ");
   return report;
  };
  const reports:RecipientReport[]=[];
  for(let i=0;i<playerIds.length;i+=4){
   const batch=await Promise.all(playerIds.slice(i,i+4).map(processRecipient));
   reports.push(...batch);
  }
  const summary={total:reports.length,accepted:reports.filter(r=>r.status==="accepted").length,failed:reports.filter(r=>r.status==="failed").length,no_subscription:reports.filter(r=>r.status==="no_subscription").length,unknown:reports.filter(r=>r.status==="unknown").length};
  return NextResponse.json({ok:true,round,requestId,summary,reports},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("admin-reminder",error);return NextResponse.json({error:"reminder"},{status:500})}
}
