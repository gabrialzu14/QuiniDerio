import { NextResponse } from "next/server";
import { federationTeams } from "../../../lib/federation";
export const dynamic="force-dynamic";
const clean=(s:string)=>s.replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/<br\s*\/?\s*>/gi," | ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
async function get(url:string){const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1","accept":"text/html,application/xhtml+xml","accept-language":"es-ES,es;q=0.9"},cache:"no-store",signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error("Federation "+r.status);return r.text()}
function cells(row:string){return [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>clean(m[1])).filter(Boolean)}
function parse(html:string,round:number){
 const rows=[...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>cells(m[0])).filter(c=>c.some(v=>/DERIO/i.test(v)));
 for(const c of rows){
  const di=c.findIndex(v=>/DERIO/i.test(v)); if(di<0)continue;
  const date=c.find(v=>/\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/.test(v))||"";
  const time=c.find(v=>/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/.test(v))||"";
  const teamish=c.filter(v=>v.length<80&&!/^(JORNADA|FECHA|HORA|CAMPO|LOCAL|VISITANTE|RESULTADO)$/i.test(v)&&!/^\d{1,2}:\d{2}$/.test(v)&&!/^\d{1,2}[\/-]\d{1,2}/.test(v));
  const ti=teamish.findIndex(v=>/DERIO/i.test(v));
  const before=teamish.slice(0,ti).reverse().find(v=>/[A-ZÁÉÍÓÚÑ]{2}/i.test(v)&&!/^\d+$/.test(v));
  const after=teamish.slice(ti+1).find(v=>/[A-ZÁÉÍÓÚÑ]{2}/i.test(v)&&!/^\d+$/.test(v));
  const opponent=(after||before||"").trim();
  if(!opponent)continue;
  const venue=c.find(v=>v!==opponent&&!/DERIO/i.test(v)&&/(IBAIONDO|FADURA|MUNICIPAL|POLIDEPORT|CAMPO|ZELAIA|FUTBOL|FÚTBOL|KIROL|SAN |MALLONA|LASESARRE|SOLOARTE|TABIRA|URBIETA|GAZITUAGA|GOBELA)/i.test(v))||"";
  const derioCell=c.findIndex(v=>/DERIO/i.test(v)), oppCell=c.findIndex(v=>v===opponent);
  return {federationRound:round,opponent,date,time,venue,isHome:derioCell>=0&&oppCell>=0?derioCell<oppCell:undefined,status:"scheduled"};
 }
 return null;
}
function stamp(s:string){const m=s.match(/(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/);if(!m)return 0;let y=m[3]?+m[3]:new Date().getFullYear();if(y<100)y+=2000;return new Date(y,+m[2]-1,+m[1]).getTime()}
export async function GET(){
 const now=Date.now();
 const teams=await Promise.all(federationTeams.map(async team=>{
  const rounds=Array.from({length:38},(_,i)=>i+1), found:any[]=[];
  for(let i=0;i<rounds.length;i+=6){const batch=await Promise.all(rounds.slice(i,i+6).map(async j=>{try{return parse(await get(team.calendar.replace("{J}",String(j))),j)}catch{return null}}));found.push(...batch.filter(Boolean));}
  const dated=found.filter(g=>stamp(g.date)>0);
  const upcoming=dated.filter(g=>stamp(g.date)>=now-2*86400000).sort((a,b)=>stamp(a.date)-stamp(b.date))[0];
  const game=upcoming||dated.sort((a,b)=>Math.abs(stamp(a.date)-now)-Math.abs(stamp(b.date)-now))[0]||found[0];
  return {id:team.id,name:team.name,...(game||{status:"unavailable",opponent:"",date:"",time:"",venue:"",federationRound:null})};
 }));
 return NextResponse.json({updatedAt:new Date().toISOString(),teams},{headers:{"Cache-Control":"no-store"}});
}