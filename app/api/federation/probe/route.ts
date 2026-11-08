// TEMPORARY diagnostic: can the app's server (Vercel) read an authorised federation page?
// Reads one fixed public page at most once a minute and reports only its size and whether Derio appears.
import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const dynamic="force-dynamic";
const UA="QuiniDerio/1.0 (+https://quiniderio.vercel.app; datos autorizados para el juego)";
const PAGE="https://www.fvf-bff.eus/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=24058476&CodGrupo=24109682&CodTemporada=22&CodJornada=8&Sch_Tipo_Juego=1&cod_agrupacion=1773563";

export async function GET(){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||"",process.env.SUPABASE_SERVICE_ROLE_KEY||"",{auth:{persistSession:false}});
 const {data:last}=await db.from("quini_federation_sync_runs").select("started_at").eq("summary->>probe","vercel").order("started_at",{ascending:false}).limit(1).maybeSingle();
 if(last&&Date.now()-Date.parse(last.started_at)<60000)return NextResponse.json({skipped:"too_soon"});
 await db.from("quini_federation_sync_runs").insert({ok:null,summary:{probe:"vercel"}});
 try{
  const jar=new Map<string,string>();let url="https://www.fvf-bff.eus/pnfg";
  const cookie=()=>[...jar].map(([k,v])=>`${k}=${v}`).join("; ");
  for(let hop=0;hop<8;hop++){
   const res=await fetch(url,{redirect:"manual",headers:{"user-agent":UA,...(jar.size?{cookie:cookie()}:{})},cache:"no-store"});
   for(const set of res.headers.getSetCookie()){const [pair]=set.split(";");const i=pair.indexOf("=");if(i>0)jar.set(pair.slice(0,i).trim(),pair.slice(i+1).trim())}
   const next=res.headers.get("location");if(!next||res.status<300||res.status>=400)break;
   url=new URL(next,url).href;
  }
  const res=await fetch(PAGE,{headers:{"user-agent":UA,"accept-language":"es-ES,es;q=0.9",cookie:cookie()},cache:"no-store"});
  const body=new TextDecoder("iso-8859-1").decode(await res.arrayBuffer());
  return NextResponse.json({status:res.status,bytes:body.length,derio:/DERIO/.test(body),cookies:[...jar.keys()]});
 }catch(e){return NextResponse.json({error:String(e)},{status:502})}
}
