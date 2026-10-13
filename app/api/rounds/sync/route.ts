import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {quizFixtures,publishedQuiniRounds,type Fixture} from "../../../lib/quiz-fixtures";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function kickoffUtc(date?:string,time?:string):string|null{
 if(!date||!time)return null;
 const [day,month,year]=date.split("/").map(Number);
 const [hour,minute]=time.split(":").map(Number);
 if(![day,month,year,hour,minute].every(Number.isFinite))return null;
 const intended=Date.UTC(year,month-1,day,hour,minute);
 let instant=intended;
 // Convert the published Spain-local kickoff into UTC across CET/CEST changes.
 const format=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
 for(let i=0;i<3;i++){
  const parts=Object.fromEntries(format.formatToParts(new Date(instant)).filter(p=>p.type!=="literal").map(p=>[p.type,Number(p.value)]));
  const represented=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute);
  instant+=intended-represented;
 }
 return new Date(instant).toISOString();
}

function isPublished(f:Partial<Fixture>):boolean{
 return f.status!=="rest"&&!!f.opponent?.trim()&&!!f.date&&!!f.time;
}

export async function POST(req:NextRequest){
 // The endpoint accepts no fixtures or round IDs from callers: only fixtures
 // compiled into this deployed app can be inserted.
 const origin=req.headers.get("origin");
 if(origin){try{if(new URL(origin).host!==new URL(req.url).host)return NextResponse.json({error:"origin"},{status:403})}catch{return NextResponse.json({error:"origin"},{status:403})}}
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("Missing Supabase server environment");
  const db=createClient(url,key,{auth:{persistSession:false}});
  const rounds=publishedQuiniRounds();
  if(!rounds.length)return NextResponse.json({ok:true,rounds:[],created:0},{headers:{"Cache-Control":"no-store"}});
  const {data:registered,error:readError}=await db.from("quini_live_matches").select("round,team").in("round",rounds);
  if(readError)throw readError;
  const registeredIds=new Set((registered||[]).map(r=>r.round+":"+r.team));
  const missing=rounds.flatMap(round=>
   Object.entries(quizFixtures[round]).filter(([,f])=>isPublished(f))
    .filter(([team])=>!registeredIds.has(round+":"+team))
    .map(([team,f])=>({
     round,team,opponent:f.opponent!.trim(),
     is_home:typeof f.isHome==="boolean"?f.isHome:null,
     scheduled_at:kickoffUtc(f.date,f.time),
     home_score:0,away_score:0,yellow_cards:0,red_cards:0,status:"scheduled"
    }))
  );
  if(missing.length){
   // Ignore conflicts from concurrent visitors; never overwrite goals, cards or status.
   const {error}=await db.from("quini_live_matches").upsert(missing,{onConflict:"round,team",ignoreDuplicates:true});
   if(error)throw error;
  }
  return NextResponse.json({ok:true,rounds,created:missing.length},{headers:{"Cache-Control":"no-store"}});
 }catch(e){console.error("quini-fixture-sync",e);return NextResponse.json({error:"round_sync"},{status:500,headers:{"Cache-Control":"no-store"}})}
}
