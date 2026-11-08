/**
 * "Cargar jornada": the admin taps a bookmark while on a federation website.
 * Their own browser asks QuiniDerio which federation jornada each team plays
 * next, reads those calendar and standings pages of that same website, and
 * opens /admin#fed=… to review and save. The federations serve no data to
 * servers, so this runs in the admin's browser, on demand.
 * Access is authorised for game data only (docs/federation-access.md);
 * scores are never read.
 */
import {nameKey,displayName,isDerio} from "../../supabase/functions/federation-sync/parse";
import {matchDetails,type ManagedMatch,type MatchDetails} from "./match-details";
import {TEAM_SOURCES} from "../../supabase/functions/federation-sync/sources";
export {TEAM_SOURCES} from "../../supabase/functions/federation-sync/sources";

/** Federation group code -> QuiniDerio team. */
export const FEDERATION_GROUPS:Record<string,string>=Object.fromEntries(TEAM_SOURCES.map(s=>[s.g,s.t]));

export type CalendarPayload={k:"cal",g:string,j:number|null,m:{h:string,a:string,d:string,t:string,f:string}[]};
export type StandingsPayload={k:"cla",g:string,j:number|null,r:{p:number,n:string,pt:number,fo:string}[]};
export type MultiPayload={k:"multi",items:(CalendarPayload|StandingsPayload)[],missing:string[]};
export type FederationPayload=CalendarPayload|StandingsPayload;

function decodeItem(v:any):FederationPayload|null{
 const j=Number(v?.j)||null;
 if(v?.k==="cal"&&typeof v.g==="string"&&Array.isArray(v.m))return {k:"cal",g:v.g,j,m:v.m.slice(0,40).map((x:any)=>({h:String(x.h||""),a:String(x.a||""),d:String(x.d||""),t:String(x.t||""),f:String(x.f||"")}))};
 if(v?.k==="cla"&&typeof v.g==="string"&&Array.isArray(v.r))return {k:"cla",g:v.g,j,r:v.r.slice(0,40).map((x:any)=>({p:Number(x.p),n:String(x.n||""),pt:Number(x.pt),fo:String(x.fo||"")}))};
 return null;
}
export function decodeFederationHash(hash:string):FederationPayload|MultiPayload|null{
 const raw=new URLSearchParams(hash.replace(/^#/,"")).get("fed");
 if(!raw)return null;
 try{
  const v=JSON.parse(raw);
  if(v.k==="multi"&&Array.isArray(v.items))return {k:"multi",items:v.items.slice(0,30).map(decodeItem).filter(Boolean),missing:Array.isArray(v.missing)?v.missing.map(String).slice(0,10):[]};
  return decodeItem(v);
 }catch{return null}
}

const COMMON=new Set(["CD","C","D","SD","S","UD","U","CF","F","SAD","KE","KT","FT","FK","CLUB","DE","DEL","LA","EL","SA","A"]);
const tokens=(name:string)=>nameKey(name).split(" ").filter(t=>t&&!COMMON.has(t));
/** True when every meaningful word of the app name appears in the federation name. */
export function sameTeam(appName:string,federationName:string){
 if(nameKey(appName)===nameKey(federationName))return true;
 const fed=new Set(nameKey(federationName).split(" "));
 const own=tokens(appName);
 const letter=appName.trim().match(/\s([A-Z])$/)?.[1];
 return own.length>0&&own.every(t=>fed.has(t))&&(!letter||fed.has(letter));
}

export type FieldChange={field:string,label:string,from:string,to:string};
export type ImportPlan={team:string,round:number,details:MatchDetails,changes:FieldChange[]}|{team:string|null,error:string};
const LABELS:Record<string,string>={date:"Fecha",time:"Hora",venue:"Campo",derioPosition:"Posición Derio",derioPoints:"Puntos Derio",derioForm:"Forma Derio",opponentPosition:"Posición rival",opponentPoints:"Puntos rival",opponentForm:"Forma rival",federationOpponent:"Rival en la federación"};
/** Saved details win over the defaults rebuilt from the static fixtures. */
const current=(row:ManagedMatch):MatchDetails=>({...matchDetails(row),...(row.fixture_details||{})});
const show=(v:unknown)=>v===null||v===undefined||v===""?"—":String(v);
const toForm=(f:string)=>f.toUpperCase().replace(/\s+/g,"").replace(/G/g,"V").replace(/P/g,"D").replace(/[^VED]/g,"").slice(-5);

function diff(before:MatchDetails,after:MatchDetails){
 return Object.keys(LABELS).filter(k=>show((before as any)[k])!==show((after as any)[k])).map(k=>({field:k,label:LABELS[k],from:show((before as any)[k]),to:show((after as any)[k])}));
}

type Row=ManagedMatch&{status?:string};
/** Work out which upcoming QuiniDerio match the page belongs to and what would change. */
export function planImport(payload:FederationPayload,rows:Row[]):ImportPlan{
 const team=FEDERATION_GROUPS[payload.g]||null;
 if(!team)return {team:null,error:"Esta competición no corresponde a ningún equipo de QuiniDerio."};
 const upcoming=rows.filter(r=>r.team===team&&(r.status??"scheduled")==="scheduled").sort((a,b)=>a.round-b.round);
 if(payload.k==="cal"){
  const fm=payload.m.find(m=>isDerio(m.h)||isDerio(m.a));
  if(!fm)return {team,error:"En esta jornada no aparece ningún partido del Derio."};
  const row=upcoming.find(r=>Number(current(r).federationRound)===payload.j);
  if(!row)return {team,error:`No hay ninguna jornada pendiente de QuiniDerio con la J${payload.j??"?"} de ${team}. Crea antes la jornada en administración.`};
  const before=current(row);
  const [d,m,y]=fm.d.split(/[-/]/);
  const date=fm.d&&y?`${d.padStart(2,"0")}/${m.padStart(2,"0")}/${y}`:before.date;
  const time=/^\d{1,2}:\d{2}$/.test(fm.t)?fm.t.padStart(5,"0"):before.time;
  const after:MatchDetails={...before,date,time,venue:before.venue||(fm.f?displayName(fm.f):""),federationOpponent:isDerio(fm.h)?fm.a:fm.h};
  return {team,round:row.round,details:after,changes:diff(before,after)};
 }
 // Standings after jornada J are the context for the match of jornada J+1.
 const row=(payload.j?upcoming.find(r=>Number(current(r).federationRound)===payload.j!+1):null)||upcoming[0];
 if(!row)return {team,error:`No hay ninguna jornada pendiente de QuiniDerio para ${team}.`};
 const before=current(row);
 const own=payload.r.find(r=>isDerio(r.n));
 const rival=payload.r.find(r=>before.federationOpponent?nameKey(r.n)===nameKey(before.federationOpponent):sameTeam(before.opponent,r.n));
 if(!own)return {team,error:"En esta clasificación no aparece el Derio."};
 const after:MatchDetails={...before,
  derioPosition:own.p,derioPoints:own.pt,derioForm:toForm(own.fo),
  ...(rival?{opponentPosition:rival.p,opponentPoints:rival.pt,opponentForm:toForm(rival.fo),federationOpponent:rival.n}:{})};
 const plan={team,round:row.round,details:after,changes:diff(before,after)};
 return rival?plan:{...plan,changes:[...plan.changes,{field:"note",label:"Rival",from:before.opponent,to:"no encontrado en la tabla"}]};
}

/** Several pages at once: calendar first, then standings, merged into one plan per match. */
export function planImportAll(payload:MultiPayload,rows:Row[]):ImportPlan[]{
 const work=rows.map(r=>({...r,fixture_details:r.fixture_details?{...r.fixture_details}:r.fixture_details}));
 const originals=new Map(rows.map(r=>[`${r.round}:${r.team}`,current(r)]));
 const touched=new Map<string,{team:string,round:number}>();
 const errors:ImportPlan[]=payload.missing.map(team=>({team,error:`${team}: no hay jornada pendiente de QuiniDerio con jornada federativa. Crea antes la jornada.`}));
 const ordered=[...payload.items].sort((a,b)=>a.k===b.k?0:a.k==="cal"?-1:1);
 for(const item of ordered){
  const plan=planImport(item,work);
  if("error" in plan){errors.push({...plan,error:`${plan.team?plan.team+": ":""}${plan.error}`});continue}
  const key=`${plan.round}:${plan.team}`;
  const row=work.find(r=>`${r.round}:${r.team}`===key);
  if(row)row.fixture_details=plan.details;
  touched.set(key,{team:plan.team,round:plan.round});
 }
 const plans:ImportPlan[]=[...touched].map(([key,{team,round}])=>{
  const details=work.find(r=>`${r.round}:${r.team}`===key)!.fixture_details as MatchDetails;
  return {team,round,details,changes:diff(originals.get(key)!,details)};
 });
 return [...plans.sort((a,b)=>TEAM_SOURCES.findIndex(s=>s.t===a.team)-TEAM_SOURCES.findIndex(s=>s.t===b.team)),...errors];
}

/**
 * Bookmark "Cargar jornada". Tapped on euskadifutbol.eus or fvf-bff.eus, it
 * runs in the admin's browser: reads which federation jornada each team of
 * that website plays next (QuiniDerio public data), fetches those calendar
 * and standings pages from the same website, keeps only the Derio fixture
 * and the two teams' standings, and opens QuiniDerio to review and save.
 */
export function bookmarkletCode(appOrigin:string,supabaseUrl:string,publicKey:string){
 const cfg={app:appOrigin,sb:supabaseUrl,k:publicKey,s:TEAM_SOURCES};
 const src=`(async()=>{const C=${JSON.stringify(cfg)},O=location.origin,mine=C.s.filter(s=>s.o===O);
if(!mine.length){alert("Abre la web de la Federación Vasca (euskadifutbol.eus) o Vizcaína (fvf-bff.eus) y vuelve a pulsar.");return}
const T=e=>(e&&e.textContent||"").replace(/\\s+/g," ").trim(),K=n=>n.toUpperCase().replace(/["'.,]/g," ").replace(/\\s+/g," ").trim();
let rows;try{rows=await(await fetch(C.sb+"/rest/v1/quini_live_matches?select=team,round,fixture_details&status=eq.scheduled",{headers:{apikey:C.k}})).json()}catch(e){alert("No se ha podido consultar QuiniDerio. Revisa la conexión.");return}
const get=async u=>new DOMParser().parseFromString(await(await fetch(u,{credentials:"include"})).text(),"text/html");
const items=[],missing=[],note=document.createElement("div");note.style.cssText="position:fixed;z-index:2147483647;left:12px;right:12px;bottom:12px;padding:14px;border-radius:14px;background:#061a3b;color:#fff;font:600 15px system-ui;text-align:center";document.body.appendChild(note);
for(const s of mine){const row=rows.filter(r=>r.team===s.t&&r.fixture_details&&+r.fixture_details.federationRound).sort((a,b)=>a.round-b.round)[0];if(!row){missing.push(s.t);continue}
const j=+row.fixture_details.federationRound;note.textContent="Cargando "+s.t+" (J"+j+")…";
const cal=await get(O+"/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion="+s.c+"&CodGrupo="+s.g+"&CodTemporada=22&CodJornada="+j+"&Sch_Tipo_Juego=1&cod_agrupacion="+s.a),m=[];
cal.querySelectorAll('tr[style*="ffffff00"]').forEach(tr=>{const h=T(tr.querySelector(".font_widgetL h4")),a=T(tr.querySelector(".font_widgetV h4"));if(!h||!a||!/DERIO/.test(K(h+" "+a)))return;const x=[...tr.querySelectorAll(".horario")].map(T),n=tr.nextElementSibling;m.push({h,a,d:x.find(v=>/^\\d{1,2}[-/]\\d{1,2}[-/]\\d{4}$/.test(v))||"",t:x.find(v=>/^\\d{1,2}:\\d{2}$/.test(v))||"",f:T(n&&n.querySelector('a[href*="NFG_VisCampos"]'))})});
items.push({k:"cal",g:s.g,j,m});
if(j>1&&m.length){const rival=K(/DERIO/.test(K(m[0].h))?m[0].a:m[0].h),st=await get(O+"/pnfg/NPcd/NFG_VisClasificacion?cod_primaria=1000120&codjornada="+(j-1)+"&codcompeticion="+s.c+"&codgrupo="+s.g+"&cod_agrupacion="+s.a),r=[];
st.querySelectorAll("table tr").forEach(tr=>{const c=[...tr.children].map(T);if(c.length>14&&/^\\d+$/.test(c[1])&&(/DERIO/.test(K(c[2]))||K(c[2])===rival)&&!r.some(v=>v.n===c[2]))r.push({p:+c[1],n:c[2],pt:+c[3],fo:(c.find(v=>/^([GEP]\\s*){1,6}$/.test(v))||"").replace(/\\s/g,"")})});
items.push({k:"cla",g:s.g,j:j-1,r})}}
note.textContent="Abriendo QuiniDerio…";location.href=C.app+"/admin#fed="+encodeURIComponent(JSON.stringify({k:"multi",items,missing}))})()`;
 return "javascript:"+encodeURIComponent(src.replace(/\n/g,""));
}
