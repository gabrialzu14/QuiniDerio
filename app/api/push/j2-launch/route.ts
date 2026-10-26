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
 const {data:settings,error:settingsError}=await db.from("quini_app_settings").select("active_round").eq("id",1).single();
 if(settingsError||settings?.active_round!==5)return NextResponse.json({error:"round_not_active"},{status:409});
 const {data:matches,error:matchesError}=await db.from("quini_live_matches").select("team").eq("round",5);
 const {data:rests,error:restsError}=await db.from("quini_rest_fixtures").select("team").eq("round",5);
 if(matchesError||restsError||(matches?.length||0)<1||(matches?.length||0)+(rests?.length||0)!==7)
  return NextResponse.json({error:"round_incomplete"},{status:409});
 const notificationKey="round_open:5";
 const {data:subs}=await db.from("push_subscriptions").select("player_id,endpoint,p256dh,auth").eq("enabled",true);
 const players=new Map<string,any[]>();for(const s of subs||[])players.set(s.player_id,[...(players.get(s.player_id)||[]),s]);
 let delivered=0,skipped=0,failed=0;
 for(const [playerId,endpoints] of players){
  const playerKey=notificationKey+":"+playerId;
  const {data:already}=await db.from("push_notification_log").select("id").eq("notification_key",playerKey).limit(1);
  if(already?.length){skipped++;continue}
  let ok=false;
  for(const s of endpoints){try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title:"¡Jornada 5 disponible!",body:"Ya puedes completar y enviar tu quiniela de la Jornada 5 en QuiniDerio. ¡No te quedes sin pronosticar!",url:"/",tag:"quiniderio-round-open-5"}),{TTL:86400,urgency:"high"});ok=true}catch(e:any){if(e?.statusCode===404||e?.statusCode===410)await db.from("push_subscriptions").update({enabled:false,updated_at:new Date().toISOString()}).eq("endpoint",s.endpoint)}}
  if(ok){await db.from("push_notification_log").insert({player_id:playerId,round_id:null,kind:"round_open",notification_key:playerKey});delivered++}else failed++;
 }
 return NextResponse.json({ok:true,round:5,delivered,skipped,failed});
}