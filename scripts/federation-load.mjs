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
const PAUSE_MS=900;
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
async function page(origin,url,retry=true){
 const cookie=await session(origin);await sleep(PAUSE_MS);
 const res=await fetch(url,{headers:{"user-agent":UA,"accept-language":"es-ES,es;q=0.9",cookie}});
 const body=new TextDecoder("iso-8859-1").decode(await res.arrayBuffer());
 if(res.ok&&body.length>=1000)return body;
 // After many requests the site may answer empty: wait, open a fresh session and try once more.
 if(retry){await sleep(4000);sessions.delete(origin);return page(origin,url,false)}
 throw new Error(`la federación devolvió ${res.status} con ${body.length} bytes`);
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
// ---------------------------------------------------------------------------------------------
// Draft of the next jornada when it is not created yet (or --draft N): every team's fixture,
// standings and a reused name/crest for known rivals. Saved to quini_round_drafts; the admin
// reviews it in "Crear jornada", adds missing crests and publishes. Nothing is published here.
const COMPETITIONS={"Derio A":"3ª RFEF","Derio B":"Derio B","Derio Fem":"FEM Liga Vasca","Derio Fem B":"FEM B","Juvenil A":"Juvenil A","Juvenil B":"Juvenil B","Cadete B":"Cadete B"};
const NOISE=new Set(["SAD","SD","CD","UD","CF","KE","KT","FT","FK","CLUB","DE","S","D","C","U","F"]);
const key=n=>String(n).normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase().replace(/["'.,()]/g," ").replace(/\s+/g," ").trim();
const words=n=>key(n).split(" ").filter(w=>w&&!NOISE.has(w));
const letterOf=n=>(String(n).match(/"([A-Z])"/)||String(n).match(/\s([A-Z])$/)||[])[1]||"";
/** Same club and same team letter, ignoring legal suffixes (S.D., SAD, C.D.…). */
const sameClub=(a,b)=>{const wa=words(a).filter(w=>w.length>1),wb=new Set(words(b));return wa.length>0&&wa.every(w=>wb.has(w))&&letterOf(a)===letterOf(b)};
const titleCase=t=>t.toLowerCase().replace(/(^|[\s-])\S/g,c=>c.toUpperCase());
const cleanTeam=n=>{const l=letterOf(n);const base=words(String(n).replace(/"[A-Z]"/g,"").split(",")[0]).filter(w=>!/^[A-Z]$/.test(w)).join(" ");return titleCase(base)+(l?` ${l}`:"")};
const cleanField=f=>titleCase(String(f).replace(/\(.*?\)/g,"").replace(/\s+/g," ").trim());
const isoDate=d=>{const [dd,mm,yy]=String(d).split("/");return yy?`${yy}-${mm}-${dd}`:""};
const getJson=async path=>{const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:{apikey:PUBLIC_KEY}});if(!r.ok)throw new Error(`QuiniDerio ${path}: HTTP ${r.status}`);return r.json()};

let draftRound=Number(opt("--draft"))||null;
if(!draftRound&&!onlyRound&&!rows.some(r=>r.status==="scheduled")){
 const last=(await getJson("quini_live_matches?select=round&order=round.desc&limit=1"))[0]?.round;
 if(last)draftRound=Number(last)+1;
}
if(draftRound){
 const history=await getJson(`quini_live_matches?select=round,team,opponent,is_home,fixture_details&round=lt.${draftRound}&order=round.desc`);
 const rests=await getJson(`quini_rest_fixtures?select=round,team,federation_round&round=lt.${draftRound}&order=round.desc`);
 const exists=(await getJson(`quini_live_matches?select=round&round=eq.${draftRound}&limit=1`)).length>0;
 const notes=[];
 if(exists){console.log(`\nBorrador J${draftRound}: la jornada ya existe; no se prepara.`)}
 else{
  const base={};
  for(const s of TEAM_SOURCES){
   const last=history.find(r=>r.team===s.t&&Number(r.fixture_details?.federationRound));
   const rest=rests.find(r=>r.team===s.t&&Number(r.federation_round));
   const lastRound=Math.max(last?last.round:0,rest?rest.round:0);
   const fed=lastRound&&last&&last.round===lastRound?Number(last.fixture_details.federationRound):rest&&rest.round===lastRound?Number(rest.federation_round):null;
   if(fed)base[s.t]=fed+1;
  }
  const look=new Map();
  const calendarAt=async(s,j)=>{const k=s.t+":"+j;if(!look.has(k)){try{look.set(k,derioMatch(parseCalendar(await page(s.o,calendarUrl(s,j)))))}catch(e){look.set(k,{error:String(e.message||e)})}}return look.get(k)};
  const pick={};
  for(const s of TEAM_SOURCES){if(base[s.t])pick[s.t]={j:base[s.t],m:await calendarAt(s,base[s.t])}}
  const at=m=>m&&m.date&&m.time?Date.parse(kickoffIso(m.date,m.time)):m&&m.date?Date.parse(kickoffIso(m.date,"12:00")):null;
  const times=Object.values(pick).map(p=>at(p.m)).filter(Boolean).sort((a,b)=>a-b);
  const median=times[Math.floor(times.length/2)];
  // A team whose next jornada falls on another weekend: look one jornada either side.
  for(const s of TEAM_SOURCES){
   const p=pick[s.t];if(!p||!median)continue;
   const t=at(p.m);
   if(t&&Math.abs(t-median)<=4*86400000)continue;
   for(const j of [p.j+1,p.j-1]){const m=await calendarAt(s,j),tt=at(m);if(tt&&Math.abs(tt-median)<=4*86400000){notes.push(`${s.t}: la jornada federativa que encaja es la J${j} (no la J${p.j}).`);pick[s.t]={j,m};break}}
  }
  const games=[];
  for(const s of TEAM_SOURCES){
   const p=pick[s.t];
   const blank={team:s.t,rest:false,isHome:true,opponent:"",date:"",time:"",venue:"Ibaiondo",location:"Derio",competition:COMPETITIONS[s.t],federationRound:"",derioPosition:"",opponentPosition:"",derioPoints:"",opponentPoints:"",derioForm:"",opponentForm:"",crest:""};
   if(!p){notes.push(`${s.t}: no se sabe su jornada federativa; rellénalo a mano.`);games.push(blank);continue}
   if(p.m?.error){notes.push(`${s.t}: la federación no respondió (${p.m.error}).`);games.push({...blank,federationRound:String(p.j)});continue}
   if(!p.m||(median&&!(at(p.m)&&Math.abs(at(p.m)-median)<=4*86400000))){
    notes.push(`${s.t}: sin partido del Derio ese fin de semana en la federación; se marca como descanso (J${p.j}). Revísalo.`);
    games.push({...blank,rest:true,federationRound:String(p.j)});continue;
   }
   const m=p.m;
   let table=[];try{if(p.j>1)table=parseStandings(await page(s.o,standingsUrl(s,p.j-1)))}catch(e){notes.push(`${s.t}: clasificación no disponible (${e.message||e}).`)}
   const own=standingOf(table,m.derio),rival=standingOf(table,m.opponent);
   const known=history.find(r=>r.team===s.t&&r.opponent&&(key(r.fixture_details?.federationOpponent||"")===key(m.opponent)||sameClub(r.opponent,m.opponent)));
   const sameVenue=history.find(r=>!m.isHome&&r.fixture_details?.venue&&words(r.fixture_details.venue)[0]===words(cleanField(m.field))[0]&&r.fixture_details.location);
   if(!m.time)notes.push(`${s.t}: la federación aún no ha publicado la hora; complétala.`);
   if(!known)notes.push(`${s.t}: rival nuevo (${cleanTeam(m.opponent)}); añade su escudo.`);
   else if(!known.fixture_details?.crest)notes.push(`${s.t}: ${known.opponent} no tiene escudo guardado; añádelo.`);
   games.push({...blank,
    isHome:m.isHome,opponent:known?known.opponent:cleanTeam(m.opponent),
    date:isoDate(m.date),time:m.time||"",
    venue:m.isHome?"Ibaiondo":(cleanField(m.field)||""),location:m.isHome?"Derio":(sameVenue?sameVenue.fixture_details.location:(known&&!known.is_home?known.fixture_details?.location||"":"")),
    competition:history.find(r=>r.team===s.t)?.fixture_details?.competition||COMPETITIONS[s.t],
    federationRound:String(p.j),
    derioPosition:own?String(own.position):"",derioPoints:own?String(own.points):"",derioForm:own?own.form:"",
    opponentPosition:rival?String(rival.position):"",opponentPoints:rival?String(rival.points):"",opponentForm:rival?rival.form:"",
    crest:known?.fixture_details?.crest||"",
   });
  }
  console.log(`\nBorrador de la jornada ${draftRound} (no se publica: revísalo en Crear jornada):`);
  for(const g of games)console.log(g.rest?`  ${g.team}: descanso (federación J${g.federationRound})`:`  ${g.team}: ${g.isHome?"vs":"en casa de"} ${g.opponent||"?"} · ${g.date} ${g.time} · ${g.venue}${g.location?", "+g.location:""} · J${g.federationRound} · Derio ${g.derioPosition||"?"}º ${g.derioPoints||"?"} pts ${g.derioForm} · rival ${g.opponentPosition||"?"}º ${g.opponentPoints||"?"} pts ${g.opponentForm}${g.crest?" · escudo ✓":" · sin escudo"}`);
  for(const n of notes)console.log("  ⚠ "+n);
  sql.push(`insert into public.quini_round_drafts(round,games,notes,source,updated_at) values (${Number(draftRound)},${sqlText(JSON.stringify(games))}::jsonb,${sqlText(JSON.stringify(notes))}::jsonb,'federation',now()) on conflict (round) do update set games=excluded.games,notes=excluded.notes,source=excluded.source,updated_at=now();`);
  report.push({draft:draftRound,teams:games.length,notes});
 }
}

const ok=report.every(r=>!r.error);
sql.push(`insert into public.quini_federation_sync_runs(started_at,finished_at,ok,summary) values (now(),now(),${ok},${sqlText(JSON.stringify({source:"weekly-claude",dry,report}))}::jsonb);`);
for(const r of report){
 if(r.draft)continue;
 if(r.error)console.log(`✗ ${r.team} (J${r.round}): ${r.error}`);
 else if(r.skipped)console.log(`· ${r.team}${r.round?` (J${r.round})`:""}: ${r.skipped}`);
 else console.log(`${r.warning?"⚠":"✓"} ${r.team} J${r.round} (federación J${r.federationRound}, rival ${r.rival})${r.note?` — ${r.note}`:""}${r.warning?` — ${r.warning}`:""}\n    ${r.changes.length?r.changes.join("\n    "):"sin cambios"}`);
}
if(sqlPath&&!dry){writeFileSync(sqlPath,sql.join("\n")+"\n");console.log(`\nSQL: ${sql.length-1} sentencias + registro → ${sqlPath}`)}
