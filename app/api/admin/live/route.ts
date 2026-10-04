import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import webpush from "web-push";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||"";const key=process.env.SUPABASE_SERVICE_ROLE_KEY||"";const ADMIN="gabrialzueta@gmail.com";
function db(){if(!url||!key)throw new Error("supabase_env");return createClient(url,key,{auth:{persistSession:false}})}
async function sendToAllPlayerEndpoints(client:ReturnType<typeof db>,notificationKey:string,kind:string,title:string,body:string){
 const {data:subs}=await client.from("push_subscriptions").select("player_id,endpoint,p256dh,auth").eq("enabled",true);
 const players=new Map<string,any[]>();for(const s of subs||[])players.set(s.player_id,[...(players.get(s.player_id)||[]),s]);
 for(const [playerId,endpoints] of players){
  const playerKey=notificationKey+":"+playerId;
  const {data:already}=await client.from("push_notification_log").select("id").eq("notification_key",playerKey).limit(1);
  if(already?.length)continue;
  let delivered=false;
  for(const s of endpoints){try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title,body,url:"/",tag:"quiniderio-"+notificationKey}),{TTL:86400,urgency:"normal"});delivered=true}catch(e:any){if(e?.statusCode===404||e?.statusCode===410)await client.from("push_subscriptions").update({enabled:false,updated_at:new Date().toISOString()}).eq("endpoint",s.endpoint)}}
  if(delivered)await client.from("push_notification_log").insert({player_id:playerId,round_id:null,kind,notification_key:playerKey});
 }
}
async function sendFinalPush(round:number,team:string,home:number,away:number){
 const client=db(),pub=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||"",priv=process.env.VAPID_PRIVATE_KEY||"";if(!pub||!priv)return;
 webpush.setVapidDetails(process.env.VAPID_SUBJECT||"mailto:admin@quiniderio.app",pub,priv);
 await sendToAllPlayerEndpoints(client,"result:"+round+":"+team,"result","FINAL · "+team+" "+home+"–"+away,"Partido finalizado · Jornada "+round);
}
async function sendRoundCompletePush(round:number){
 const client=db();const {data:matches}=await client.from("quini_live_matches").select("team,status").eq("round",round);
 const expected=["Derio A","Derio B","Derio Fem","Derio Fem B","Juvenil A","Juvenil B"];
 if(!expected.every(team=>["finished","final","suspended"].includes(String((matches||[]).find(m=>m.team===team)?.status||""))))return;
 const pub=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||"",priv=process.env.VAPID_PRIVATE_KEY||"";if(!pub||!priv)return;
 webpush.setVapidDetails(process.env.VAPID_SUBJECT||"mailto:admin@quiniderio.app",pub,priv);
 await sendToAllPlayerEndpoints(client,"round_complete:"+round,"round_complete","Jornada "+round+" finalizada","Ya están disponibles los resultados y la clasificación.");
}
async function admin(req:NextRequest){const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");if(!token)return null;const {data}=await db().auth.getUser(token);return data.user?.email?.toLowerCase()===ADMIN?data.user:null}
async function syncCardTotals(round:number,team:string){const client=db();const [{count:yellow},{count:red}]=await Promise.all([client.from("quini_match_cards").select("*",{count:"exact",head:true}).eq("round",round).eq("team",team).eq("card_type","yellow"),client.from("quini_match_cards").select("*",{count:"exact",head:true}).eq("round",round).eq("team",team).eq("card_type","red")]);const {data,error}=await client.from("quini_live_matches").update({yellow_cards:yellow||0,red_cards:red||0,updated_at:new Date().toISOString()}).eq("round",round).eq("team",team).select().single();if(error)throw error;return data}
export async function POST(req:NextRequest){try{if(!await admin(req))return NextResponse.json({error:"forbidden"},{status:403});const b=await req.json();const round=Number(b.round||1),team=String(b.team||"");const {data:row}=await db().from("quini_live_matches").select("*").eq("round",round).eq("team",team).single();if(!row)return NextResponse.json({error:"match"},{status:404});if(b.action==="addCard"){const person=String(b.person||"").trim(),cardType=String(b.cardType||"");if(!person||!["yellow","red"].includes(cardType))return NextResponse.json({error:"card"},{status:400});const {error}=await db().from("quini_match_cards").insert({round,team,person,card_type:cardType});if(error)throw error;return NextResponse.json(await syncCardTotals(round,team))}if(b.action==="removeCard"){const cardId=String(b.cardId||"");if(!cardId)return NextResponse.json({error:"card"},{status:400});const {error}=await db().from("quini_match_cards").delete().eq("id",cardId).eq("round",round).eq("team",team);if(error)throw error;return NextResponse.json(await syncCardTotals(round,team))}const patch:any={updated_at:new Date().toISOString()};if(b.action==="start"){patch.status="live";patch.started_at=new Date().toISOString()}if(b.action==="finish"){patch.status="finished";patch.finished_at=new Date().toISOString()}if(b.action==="reopen"){patch.status="live";patch.finished_at=null}if(b.action==="homeGoal")patch.home_score=row.home_score+1;if(b.action==="homeGoalRemove")patch.home_score=Math.max(0,row.home_score-1);if(b.action==="awayGoal")patch.away_score=row.away_score+1;if(b.action==="awayGoalRemove")patch.away_score=Math.max(0,row.away_score-1);const {data,error}=await db().from("quini_live_matches").update(patch).eq("round",round).eq("team",team).select().single();if(error)throw error;if(b.action==="finish"){await sendFinalPush(round,team,data.home_score,data.away_score);await sendRoundCompletePush(round)}return NextResponse.json(data)}catch(e){console.error(e);return NextResponse.json({error:"update"},{status:500})}}
