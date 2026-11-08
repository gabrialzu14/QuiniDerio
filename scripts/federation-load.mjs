#!/usr/bin/env node
// Weekly "Cargar jornada": reads, for every team's pending QuiniDerio jornada, the federation
// calendar (date, time, field, rival) and the previous standings (position, points, form), and
// writes SQL updates for those not-yet-played matches. Authorised by the Basque and Biscay
// federations for game data only (docs/federation-access.md). Scores are never read.
//
// Run:  node --experimental-strip-types --no-warnings scripts/federation-load.mjs [--sql out.sql] [--round N] [--dry]
//   --round N  only that QuiniDerio jornada (useful with --dry to compare against a played one)
//   --dry      print what would change; no SQL is written
import {writeFileSync} from "node:fs";
import {parseCalendar,parseStandings,derioMatch,standingOf,displayName,kickoffIso} from "../supabase/functions/federation-sync/parse.ts";
import {TEAM_SOURCES,calendarUrl,standingsUrl} from "../supabase/functions/federation-sync/sources.ts";

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||"https://bwonxnayayopbohxuphs.supabase.co";
// Public (publishable) key: read-only access to data the app already shows to everyone.
const PUBLIC_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||"sb_publishable_P4Bn2ATVDJbROd-HSns7RA_ixZl-f0U";
const UA="QuiniDerio/1.0 (+https://quiniderio.vercel.app; datos autorizados para el juego)";
const PAUSE_MS=500;
const args=process.argv.slice(2);
const opt=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null};
const dry=args.includes("--dry"),onlyRound=Number(opt("--round"))||null,sqlPath=opt("--sql");

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sessions=new Map();
async function session(origin){
 if(sessions.has(origin))return sessions.get(origin);
 const jar=new Map();let url=origin+"/pnfg";
 const header=()=>[...jar].map(([k,v])=>`${k}=${v}`).join("; ");
 for(let hop=0;hop<8;hop++){
  const res=await fetch(url,{redirect:"manual",headers:{"user-agent":UA,...(jar.size?{cookie:header()}:{})}});
  for(const set of res.headers.getSetCookie()){const [pair]=set.split(";");const i=pair.indexOf("=");if(i>0)jar.set(pair.slice(0,i).trim(),pair.slice(i+1).trim())}
  await res.arrayBuffer();
  const next=res.headers.get("location");if(!next||res.status<300||res.status>=400)break;
  url=new URL(next,url).href;
 }
 sessions.set(origin,header());return header();
}
async function page(origin,url){
 const cookie=await session(origin);await sleep(PAUSE_MS);
 const res=await fetch(url,{headers:{"user-agent":UA,"accept-language":"es-ES,es;q=0.9",cookie}});
 const body=new TextDecoder("iso-8859-1").decode(await res.arrayBuffer());
 if(!res.ok||body.length<1000)throw new Error(`la federación devolvió ${res.status} con ${body.length} bytes`);
 return body;
}
const show=v=>v===null||v===undefined||v===""?"—":String(v);
const FIELDS={date:"Fecha",time:"Hora",venue:"Campo",derioPosition:"Pos. Derio",derioPoints:"Pts Derio",derioForm:"Forma Derio",opponentPosition:"Pos. rival",opponentPoints:"Pts rival",opponentForm:"Forma rival"};
const sqlText=s=>"'"+String(s).replace(/'/g,"''")+"'";

const filter=onlyRound?`round=eq.${onlyRound}`:"status=eq.scheduled";
const res=await fetch(`${SUPABASE_URL}/rest/v1/quini_live_matches?select=round,team,opponent,status,scheduled_at,fixture_details&${filter}&order=round.asc`,{headers:{apikey:PUBLIC_KEY}});
if(!res.ok)throw new Error("No se han podido leer las jornadas de QuiniDerio: HTTP "+res.status);
const rows=await res.json();
const report=[],sql=[],pending=[],dates=[];
for(const s of TEAM_SOURCES){
 const row=rows.find(r=>r.team===s.t&&Number(r.fixture_details?.federationRound));
 if(!row){report.push({team:s.t,skipped:"sin jornada pendiente con jornada federativa"});continue}
 const fd=row.fixture_details,j=Number(fd.federationRound);
 try{
  const match=derioMatch(parseCalendar(await page(s.o,calendarUrl(s,j))));
  if(!match){report.push({team:s.t,round:row.round,skipped:`la J${j} de la federación no tiene partido del Derio`});continue}
  const table=j>1?parseStandings(await page(s.o,standingsUrl(s,j-1))):[];
  const own=standingOf(table,match.derio),rival=standingOf(table,match.opponent);
  const next={...fd,
   date:match.date||fd.date||"",time:match.time||fd.time||"",
   venue:fd.venue||(match.field?displayName(match.field):""),
   federationOpponent:match.opponent,
   ...(own?{derioPosition:own.position,derioPoints:own.points,derioForm:own.form}:{}),
   ...(rival?{opponentPosition:rival.position,opponentPoints:rival.points,opponentForm:rival.form}:{}),
  };
  const changes=Object.entries(FIELDS).filter(([k])=>show(fd[k])!==show(next[k])).map(([k,label])=>`${label}: ${show(fd[k])} → ${show(next[k])}`);
  const kickoff=next.date&&next.time?kickoffIso(next.date,next.time):null;
  report.push({team:s.t,round:row.round,federationRound:j,rival:match.opponent,changes,...(rival?{}:{warning:"rival no encontrado en la clasificación"}),...(row.status!=="scheduled"?{note:"jornada ya jugada: no se escribe"}:{})});
  if(row.status==="scheduled"&&changes.length){
   pending.push({report:report[report.length-1],round:row.round,team:s.t,kickoff,
    sql:`update public.quini_live_matches set fixture_details=${sqlText(JSON.stringify(next))}::jsonb,${kickoff?` scheduled_at=${sqlText(kickoff)}::timestamptz,`:""} opponent=coalesce(nullif(opponent,''),${sqlText(displayName(match.opponent))}), updated_at=now() where round=${Number(row.round)} and team=${sqlText(s.t)} and status='scheduled';`});
  }
  if(kickoff)dates.push({team:s.t,round:row.round,report:report[report.length-1],at:Date.parse(kickoff)});
 }catch(e){report.push({team:s.t,round:row.round,error:String(e.message||e)})}
}
// Safety: every team of a QuiniDerio jornada plays the same weekend. A date more than 4 days away
// from the jornada's median means the stored federation jornada is wrong: report it, write nothing.
const byRound=new Map();for(const d of dates){if(!byRound.has(d.round))byRound.set(d.round,[]);byRound.get(d.round).push(d)}
const outliers=new Set();
for(const list of byRound.values()){
 if(list.length<3)continue;
 const sorted=list.map(d=>d.at).sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
 for(const d of list)if(Math.abs(d.at-median)>4*86400000){outliers.add(d.team+":"+d.round);d.report.warning=`su fecha no cae en el fin de semana del resto de la jornada: revisa su jornada federativa (ahora J${d.report.federationRound}). No se escribe.`}
}
for(const p of pending)if(!outliers.has(p.team+":"+p.round))sql.push(p.sql);
const ok=report.every(r=>!r.error);
sql.push(`insert into public.quini_federation_sync_runs(started_at,finished_at,ok,summary) values (now(),now(),${ok},${sqlText(JSON.stringify({source:"weekly-claude",dry,report}))}::jsonb);`);
for(const r of report){
 if(r.error)console.log(`✗ ${r.team} (J${r.round}): ${r.error}`);
 else if(r.skipped)console.log(`· ${r.team}${r.round?` (J${r.round})`:""}: ${r.skipped}`);
 else console.log(`${r.warning?"⚠":"✓"} ${r.team} J${r.round} (federación J${r.federationRound}, rival ${r.rival})${r.note?` — ${r.note}`:""}${r.warning?` — ${r.warning}`:""}\n    ${r.changes.length?r.changes.join("\n    "):"sin cambios"}`);
}
if(sqlPath&&!dry){writeFileSync(sqlPath,sql.join("\n")+"\n");console.log(`\nSQL: ${sql.length-1} actualizaciones + registro → ${sqlPath}`)}
