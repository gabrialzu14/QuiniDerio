/**
 * "Enviar a QuiniDerio": the admin opens a federation page in their own
 * browser and a bookmarklet sends the visible table to /admin#fed=…
 * Federation access is authorised for game data only (docs/federation-access.md);
 * scores are never read.
 */
import {nameKey,displayName,isDerio} from "../../supabase/functions/federation-sync/parse";
import {matchDetails,type ManagedMatch,type MatchDetails} from "./match-details";

/** Federation group code -> QuiniDerio team. */
export const FEDERATION_GROUPS:Record<string,string>={
 "24057858":"Derio A","24109682":"Derio B","24057867":"Derio Fem",
 "24265685":"Derio Fem B","24153519":"Juvenil A","24155723":"Juvenil B",
};
export type CalendarPayload={k:"cal",g:string,j:number|null,m:{h:string,a:string,d:string,t:string,f:string}[]};
export type StandingsPayload={k:"cla",g:string,j:number|null,r:{p:number,n:string,pt:number,fo:string}[]};
export type FederationPayload=CalendarPayload|StandingsPayload;

export function decodeFederationHash(hash:string):FederationPayload|null{
 const raw=new URLSearchParams(hash.replace(/^#/,"")).get("fed");
 if(!raw)return null;
 try{
  const v=JSON.parse(raw);
  const j=Number(v.j)||null;
  if(v.k==="cal"&&typeof v.g==="string"&&Array.isArray(v.m))return {k:"cal",g:v.g,j,m:v.m.slice(0,40).map((x:any)=>({h:String(x.h||""),a:String(x.a||""),d:String(x.d||""),t:String(x.t||""),f:String(x.f||"")}))};
  if(v.k==="cla"&&typeof v.g==="string"&&Array.isArray(v.r))return {k:"cla",g:v.g,j,r:v.r.slice(0,40).map((x:any)=>({p:Number(x.p),n:String(x.n||""),pt:Number(x.pt),fo:String(x.fo||"")}))};
 }catch{}
 return null;
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

/** Work out which upcoming QuiniDerio match the page belongs to and what would change. */
export function planImport(payload:FederationPayload,rows:(ManagedMatch&{status?:string})[]):ImportPlan{
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
 return rival?plan:{...plan,changes:[...plan.changes,{field:"note",label:"Rival",from:before.opponent,to:"no encontrado en la tabla: importa antes la jornada"}]};
}

/**
 * Bookmarklet source. It only reads the table already on screen in the
 * admin's browser and opens QuiniDerio with it; nothing is sent elsewhere.
 */
export function bookmarkletCode(appOrigin:string){
 const src=`(()=>{const u=new URL(location.href),q=k=>{for(const [a,b] of u.searchParams)if(a.toLowerCase()===k)return b;return ""},T=e=>(e&&e.textContent||"").replace(/\\s+/g," ").trim();let d=null;
if(/NFG_CmpJornada/i.test(u.pathname)){const m=[];document.querySelectorAll('tr[style*="ffffff00"]').forEach(tr=>{const h=T(tr.querySelector(".font_widgetL h4")),a=T(tr.querySelector(".font_widgetV h4"));if(!h||!a)return;const s=[...tr.querySelectorAll(".horario")].map(T),n=tr.nextElementSibling;m.push({h,a,d:s.find(x=>/^\\d{1,2}[-/]\\d{1,2}[-/]\\d{4}$/.test(x))||"",t:s.find(x=>/^\\d{1,2}:\\d{2}$/.test(x))||"",f:T(n&&n.querySelector('a[href*="NFG_VisCampos"]'))})});d={k:"cal",g:q("codgrupo"),j:q("codjornada"),m}}
else if(/NFG_VisClasificacion/i.test(u.pathname)){const r=[],seen={};document.querySelectorAll("table tr").forEach(tr=>{const c=[...tr.children].map(T);if(c.length>14&&/^\\d+$/.test(c[1])&&!seen[c[2]]){seen[c[2]]=1;r.push({p:+c[1],n:c[2],pt:+c[3],fo:(c.find(x=>/^([GEP]\\s*){1,6}$/.test(x))||"").replace(/\\s/g,"")})}});d={k:"cla",g:q("codgrupo"),j:q("codjornada"),r}}
if(!d||!d.g){alert("Abre en la federación la página de una jornada o de una clasificación y vuelve a pulsar.");return}
location.href=${JSON.stringify(appOrigin+"/admin#fed=")}+encodeURIComponent(JSON.stringify(d))})()`;
 return "javascript:"+encodeURIComponent(src.replace(/\n/g,""));
}
