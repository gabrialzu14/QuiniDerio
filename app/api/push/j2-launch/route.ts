import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import webpush from "web-push";
const TOKEN="qd-j2-launch-20261005-1831";
export async function GET(req:NextRequest){
 if(req.nextUrl.searchParams.get("token")!==TOKEN)return NextResponse.json({error:"unauthorized"},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||"",key=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
 const pub=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||"",priv=process.env.VAPID_PRIVATE_KEY||"";
 if(!url||!key||!pub||!priv)return NextResponse.json({error:"env"},{status:500});
 const db=createClient(url,key,{auth:{persistSession:false}});
 webpush.setVapidDetails(process.env.VAPID_SUBJECT||"mailto:admin@quiniderio.app",pub,priv);
 const notificationKey="round_open:2";
 const {data:subs}=await db.from("push_subscriptions").select("player_id,endpoint,p256dh,auth").eq("enabled",true);
 const players=new Map<string,any[]>();for(const s of subs||[])players.set(s.player_id,[...(players.get(s.player_id)||[]),s]);
 let delivered=0,skipped=0,failed=0;
 for(const [playerId,endpoints] of players){
  const playerKey=notificationKey+":"+playerId;
  const {data:already}=await db.from("push_notification_log").select("id").eq("notification_key",playerKey).limit(1);
  if(already?.length){skipped++;continue}
  let ok=false;
  for(const s of endpoints){try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title:"Jornada 2 disponible",body:"Ya puedes hacer tus pronósticos de la Jornada 2 en QuiniDerio.",url:"/",tag:"quiniderio-round-open-2"}),{TTL:86400,urgency:"high"});ok=true}catch(e:any){if(e?.statusCode===404||e?.statusCode===410)await db.from("push_subscriptions").update({enabled:false,updated_at:new Date().toISOString()}).eq("endpoint",s.endpoint)}}
  if(ok){await db.from("push_notification_log").insert({player_id:playerId,round_id:null,kind:"round_open",notification_key:playerKey});delivered++}else failed++;
 }
 return NextResponse.json({ok:true,delivered,skipped,failed});
}