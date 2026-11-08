// Keeps upcoming QuiniDerio fixtures in step with the federations:
// date, time, positions, points and recent form. Authorised by the Basque
// and Biscay federations for game data only (docs/federation-access.md).
// Scores and finished/live matches are never touched.
import {createClient} from "npm:@supabase/supabase-js@2.58.0";
import {parseCalendar,parseStandings,derioMatch,standingOf,displayName,kickoffIso} from "./parse.ts";

const UA="QuiniDerio/1.0 (+https://quiniderio.vercel.app; datos autorizados para el juego)";
const MIN_INTERVAL_MINUTES=10,DRY_INTERVAL_MINUTES=1;
const PAUSE_MS=400; // between requests, to keep the load on the federation sites low

type Source={origin:string,competition:string,group:string,agrupacion:string};
const EUSKADI="https://www.euskadifutbol.eus",BIZKAIA="https://www.fvf-bff.eus";
const SOURCES:Record<string,Source>={
 "Derio A":{origin:EUSKADI,competition:"24057857",group:"24057858",agrupacion:"1"},
 "Derio B":{origin:BIZKAIA,competition:"24058476",group:"24109682",agrupacion:"1773563"},
 "Derio Fem":{origin:EUSKADI,competition:"24057866",group:"24057867",agrupacion:"1"},
 "Derio Fem B":{origin:BIZKAIA,competition:"24058462",group:"24265685",agrupacion:"1773567"},
 "Juvenil A":{origin:BIZKAIA,competition:"24058479",group:"24153519",agrupacion:"1773564"},
 "Juvenil B":{origin:BIZKAIA,competition:"24058483",group:"24155723",agrupacion:"1773564"},
 "Cadete B":{origin:BIZKAIA,competition:"24058487",group:"24190893",agrupacion:"1773565"},
};
const calendarUrl=(s:Source,j:number)=>`${s.origin}/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=${s.competition}&CodGrupo=${s.group}&CodTemporada=22&CodJornada=${j}&Sch_Tipo_Juego=1&cod_agrupacion=${s.agrupacion}`;
const standingsUrl=(s:Source,j:number)=>`${s.origin}/pnfg/NPcd/NFG_VisClasificacion?cod_primaria=1000120&codjornada=${j}&codcompeticion=${s.competition}&codgrupo=${s.group}&cod_agrupacion=${s.agrupacion}`;

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const sessions=new Map<string,string>();
const lastPage={bytes:0,derio:false,cookies:""};
/** The sites keep a normal session cookie (JSESSIONID) set during the first visit's redirects. */
async function session(origin:string){
 if(sessions.has(origin))return sessions.get(origin)!;
 let url=origin+"/pnfg";const jar=new Map<string,string>();
 const header=()=>[...jar].map(([k,v])=>`${k}=${v}`).join("; ");
 for(let hop=0;hop<8;hop++){
  const res=await fetch(url,{redirect:"manual",headers:{"user-agent":UA,...(jar.size?{cookie:header()}:{})}});
  for(const set of res.headers.getSetCookie?.()??[]){const [pair]=set.split(";");const i=pair.indexOf("=");if(i>0)jar.set(pair.slice(0,i).trim(),pair.slice(i+1).trim())}
  await res.body?.cancel();
  const next=res.headers.get("location");if(!next||res.status<300||res.status>=400)break;
  url=new URL(next,url).href;
 }
 const cookie=header();sessions.set(origin,cookie);return cookie;
}
async function page(origin:string,url:string){
 const cookie=await session(origin);
 await sleep(PAUSE_MS);
 const res=await fetch(url,{headers:{"user-agent":UA,"accept-language":"es-ES,es;q=0.9",...(cookie?{cookie}:{})}});
 if(!res.ok)throw new Error(`HTTP ${res.status}`);
 const body=new TextDecoder("iso-8859-1").decode(await res.arrayBuffer());
 lastPage.bytes=body.length;lastPage.derio=/DERIO/.test(body);lastPage.cookies=cookie.replace(/=[^;]*/g,"");
 return body;
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});

Deno.serve(async(req)=>{
 // ?dry=1&round=N: report what would change for that jornada, writing nothing.
 const params=new URL(req.url).searchParams;
 const dry=params.get("dry")==="1",dryRound=Number(params.get("round"))||null;
 sessions.clear(); // a fresh federation session for every run
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
 const {data:last}=await db.from("quini_federation_sync_runs").select("started_at").order("started_at",{ascending:false}).limit(1).maybeSingle();
 if(last&&Date.now()-Date.parse(last.started_at)<(dry?DRY_INTERVAL_MINUTES:MIN_INTERVAL_MINUTES)*60000)return json({skipped:"too_soon",last:last.started_at});
 const {data:run}=await db.from("quini_federation_sync_runs").insert({}).select("id").single();
 const report:Record<string,unknown>[]=[];
 try{
  const nowIso=new Date().toISOString();
  let query=db.from("quini_live_matches").select("round,team,opponent,is_home,status,scheduled_at,fixture_details");
  query=dry&&dryRound?query.eq("round",dryRound):query.eq("status","scheduled").or(`scheduled_at.is.null,scheduled_at.gt.${nowIso}`);
  const {data:rows,error}=await query;
  if(error)throw error;
  const standingsCache=new Map<string,ReturnType<typeof parseStandings>>();
  for(const row of rows||[]){
   const source=SOURCES[row.team];const fd=(row.fixture_details||{}) as Record<string,any>;
   const fedRound=Number(fd.federationRound);
   if(!source||!fedRound){report.push({team:row.team,round:row.round,skipped:!source?"no_source":"no_federation_round"});continue}
   try{
    const match=derioMatch(parseCalendar(await page(source.origin,calendarUrl(source,fedRound))));
    if(!match){report.push({team:row.team,round:row.round,skipped:"no_derio_fixture",...(dry?{page:{...lastPage}}:{})});continue}
    // Standings before this jornada: the context shown on the card.
    const key=`${source.group}:${fedRound-1}`;
    if(fedRound>1&&!standingsCache.has(key))standingsCache.set(key,parseStandings(await page(source.origin,standingsUrl(source,fedRound-1))));
    const table=standingsCache.get(key)||[];
    const own=standingOf(table,match.derio),rival=standingOf(table,match.opponent);
    const next={...fd,
     date:match.date||fd.date||"",time:match.time||fd.time||"",
     venue:fd.venue||(match.field?displayName(match.field):""),
     ...(own?{derioPosition:own.position,derioPoints:own.points,derioForm:own.form}:{}),
     ...(rival?{opponentPosition:rival.position,opponentPoints:rival.points,opponentForm:rival.form}:{}),
     ...(fd.opponent?{}:{opponent:displayName(match.opponent)}),
     federationSyncedAt:new Date().toISOString(),
    };
    const kickoff=next.date&&next.time?kickoffIso(next.date,next.time):null;
    const patch:Record<string,unknown>={fixture_details:next,updated_at:new Date().toISOString()};
    if(kickoff&&Date.parse(kickoff)!==Date.parse(row.scheduled_at||""))patch.scheduled_at=kickoff;
    if(!row.opponent)patch.opponent=next.opponent;
    if(!dry){
     const {error:updateError}=await db.from("quini_live_matches").update(patch).eq("round",row.round).eq("team",row.team).eq("status","scheduled");
     if(updateError)throw updateError;
    }
    report.push({team:row.team,round:row.round,federationRound:fedRound,opponent:match.opponent,isHome:match.isHome,date:next.date,time:next.time,venue:next.venue,derio:own,rival,
     ...(row.is_home!==null&&row.is_home!==match.isHome?{warning:"home_away_differs"}:{})});
   }catch(e){report.push({team:row.team,round:row.round,error:String(e)})}
  }
  await db.from("quini_federation_sync_runs").update({finished_at:new Date().toISOString(),ok:true,summary:{dry,report}}).eq("id",run?.id);
  return json({ok:true,dry,updated:report});
 }catch(e){
  await db.from("quini_federation_sync_runs").update({finished_at:new Date().toISOString(),ok:false,summary:{error:String(e),report}}).eq("id",run?.id);
  return json({ok:false,error:String(e)},500);
 }
});
