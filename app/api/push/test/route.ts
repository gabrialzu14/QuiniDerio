import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import webpush from "web-push";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL||"";
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||"";

function client(){if(!url||!key)throw new Error("supabase_env");return createClient(url,key,{auth:{persistSession:false}})}

export async function POST(req:NextRequest){
 try{
  const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return NextResponse.json({error:"unauthorized"},{status:401});
  const db=client();
  const {data:{user},error:userError}=await db.auth.getUser(token);
  if(userError||!user)return NextResponse.json({error:"unauthorized"},{status:401});
  const body=await req.json();
  const endpoint=String(body.endpoint||"");
  if(!endpoint)return NextResponse.json({error:"endpoint"},{status:400});
  const {data:player}=await db.from("players").select("id").eq("auth_user_id",user.id).maybeSingle();
  if(!player)return NextResponse.json({error:"player"},{status:404});
  const {data:sub}=await db.from("push_subscriptions").select("id,endpoint,p256dh,auth,enabled").eq("player_id",player.id).eq("endpoint",endpoint).maybeSingle();
  if(!sub||!sub.enabled)return NextResponse.json({error:"subscription"},{status:409});
  const pub=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||"",priv=process.env.VAPID_PRIVATE_KEY||"";
  if(!pub||!priv)return NextResponse.json({error:"vapid"},{status:500});
  webpush.setVapidDetails(process.env.VAPID_SUBJECT||"mailto:admin@quiniderio.app",pub,priv);
  try{
   await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify({title:"QuiniDerio · Prueba",body:"Las notificaciones funcionan correctamente en este dispositivo.",url:"/",tag:"quiniderio-test-"+Date.now()}),{TTL:300,urgency:"high"});
  }catch(e:any){
   if(e?.statusCode===404||e?.statusCode===410)await db.from("push_subscriptions").update({enabled:false,updated_at:new Date().toISOString()}).eq("id",sub.id);
   return NextResponse.json({error:"delivery",statusCode:e?.statusCode||null},{status:502});
  }
  return NextResponse.json({ok:true});
 }catch(e){console.error("push-test",e);return NextResponse.json({error:"test"},{status:500})}
}
