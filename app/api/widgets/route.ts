import {NextRequest,NextResponse} from "next/server";
import {unstable_cache} from "next/cache";
import {createClient} from "@supabase/supabase-js";
import {createHash} from "node:crypto";
import {buildWidgetSnapshot,type WidgetRow} from "../../lib/widget-snapshot";
import type {RestFixture} from "../../lib/match-details";

export const runtime="nodejs";
const snapshot=unstable_cache(async(requestedRound:number|null)=>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw new Error("Widget configuration missing");
 // Exactly the existing anonymous read permissions; no service-role key or user data.
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const setting=await db.from("quini_app_settings").select("active_round").eq("id",1).single();
 if(setting.error||!Number.isInteger(setting.data?.active_round)||setting.data.active_round<1)throw new Error("Active round unavailable");
 const round=requestedRound??setting.data.active_round;
 if(round>setting.data.active_round)return null;
 const [games,rests]=await Promise.all([
  db.from("quini_live_matches").select("round,team,opponent,is_home,scheduled_at,fixture_details,home_score,away_score,status,updated_at,started_at").eq("round",round),
  db.from("quini_rest_fixtures").select("round,team,competition,federation_round").eq("round",round)
 ]);
 if(games.error||rests.error)throw new Error("Round unavailable");
 return buildWidgetSnapshot(round,(games.data||[]) as WidgetRow[],(rests.data||[]) as RestFixture[]);
},["quini-widget-snapshot-v1"],{revalidate:30});

export async function GET(req:NextRequest){
 const raw=req.nextUrl.searchParams.get("round");
 if(raw!==null&&!/^(?:[1-9]|[1-5][0-9]|60)$/.test(raw))return NextResponse.json({error:"Jornada no válida"},{status:400});
 try{
  const data=await snapshot(raw===null?null:Number(raw));
  if(!data||!data.matches.length)return NextResponse.json({error:"Jornada no publicada"},{status:404,headers:{"Cache-Control":"no-store"}});
  const body=JSON.stringify(data),etag=`"${createHash("sha256").update(body).digest("hex")}"`;
  const headers={"Cache-Control":"public, max-age=0, s-maxage=30, stale-while-revalidate=30",ETag:etag};
  if(req.headers.get("if-none-match")===etag)return new NextResponse(null,{status:304,headers});
  return new NextResponse(body,{headers:{...headers,"Content-Type":"application/json; charset=utf-8"}});
 }catch{return NextResponse.json({error:"No se pudo consultar la jornada"},{status:503,headers:{"Cache-Control":"no-store"}})}
}
