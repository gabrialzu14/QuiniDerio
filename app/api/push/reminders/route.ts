import {NextRequest,NextResponse} from "next/server";
import webpush from "web-push";

const base=process.env.NEXT_PUBLIC_SUPABASE_URL||"";
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
const rounds=[{number:1,first:"2026-10-03T18:15:00+02:00"}];

function configurePush(){
 const pub=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||"",priv=process.env.VAPID_PRIVATE_KEY||"";
 if(!pub||!priv)throw new Error("vapid_env");
 webpush.setVapidDetails(process.env.VAPID_SUBJECT||"mailto:admin@quiniderio.app",pub,priv);
}
async function db(path:string,init:RequestInit={}){
 const r=await fetch(base+"/rest/v1/"+path,{...init,headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",...(init.headers||{})},cache:"no-store"});
 if(!r.ok)throw new Error(await r.text());
 if(r.status===204)return [];
 const text=await r.text();return text?JSON.parse(text):[];
}
function activeReminder(){
 const now=Date.now();
 const round=rounds.map(r=>({...r,t:new Date(r.first).getTime()})).filter(r=>r.t>=now-3600000).sort((a,b)=>a.t-b.t)[0];
 if(!round)return null;
 const diff=(round.t-now)/3600000;
 if(diff<=0&&diff>=-1)return {...round,kind:"start",hours:0};
 if(diff>0&&diff<=3)return {...round,kind:"3h",hours:3};
 if(diff>3&&diff<=24)return {...round,kind:"24h",hours:24};
 if(diff>24&&diff<=48)return {...round,kind:"48h",hours:48};
 if(diff>48&&diff<=72)return {...round,kind:"72h",hours:72};
 return null;
}
export async function GET(req:NextRequest){
 if(req.headers.get("authorization")!=="Bearer "+key)return NextResponse.json({error:"unauthorized"},{status:401});
 try{
  configurePush();
  const reminder=activeReminder();
  if(!reminder)return NextResponse.json({ok:true,status:"outside_window",sent:0,failed:0,skipped:0});
  const round=reminder.number,kind=reminder.kind,hours=reminder.hours;
  const notificationKey="j"+round+":"+kind;
  const [subs,sent,submitted]=await Promise.all([
   db("push_subscriptions?enabled=eq.true&select=player_id,endpoint,p256dh,auth,updated_at&order=updated_at.desc"),
   db("push_notification_log?notification_key=eq."+encodeURIComponent(notificationKey)+"&select=player_id"),
   db("push_notification_log?kind=eq."+encodeURIComponent("submitted:"+round)+"&select=player_id")
  ]);
  const sentUsers=new Set(sent.map((x:any)=>x.player_id));
  const done=new Set(submitted.map((x:any)=>x.player_id));
  const grouped=new Map<string,any[]>();
  for(const s of subs){const a=grouped.get(s.player_id)||[];a.push(s);grouped.set(s.player_id,a)}
  let delivered=0,failed=0,skipped=0;
  for(const [playerId,devices] of grouped){
   if(sentUsers.has(playerId)){skipped++;continue}
   if(kind!=="start"&&done.has(playerId)){skipped++;continue}
   const title=kind==="start"?"¡Comienza la Jornada "+round+"!":"Jornada "+round+" · Faltan "+hours+" horas";
   const body=kind==="start"?"Consulta ya los pronósticos de tus rivales.":"Aún tienes pronósticos pendientes. Completa tu quiniela antes del cierre.";
   let ok=false;
   for(const s of devices){
    try{
     await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title,body,url:"/",tag:"quiniderio-"+notificationKey}),{TTL:3600,urgency:kind==="start"?"high":"normal"});
     ok=true;break;
    }catch(e:any){
     if(e?.statusCode===404||e?.statusCode===410){
      await db("push_subscriptions?endpoint=eq."+encodeURIComponent(s.endpoint),{method:"PATCH",body:JSON.stringify({enabled:false,updated_at:new Date().toISOString()})});
     }
    }
   }
   if(ok){
    await db("push_notification_log",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates"},body:JSON.stringify({player_id:playerId,round_id:null,kind,notification_key:notificationKey})});
    delivered++;
   }else failed++;
  }
  return NextResponse.json({ok:true,round,kind,sent:delivered,failed,skipped,subscriptions:subs.length});
 }catch(e){console.error("push-reminders",e);return NextResponse.json({error:"reminder"},{status:500})}
}
