import { NextResponse } from "next/server";
import { federationTeams } from "../../../lib/federation";

export const dynamic = "force-dynamic";

function clean(html:string){return html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," | ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/\s+/g," ").trim()}
async function fetchHtml(url:string){const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 (QuiniDerio/1.0)","accept-language":"es-ES,es;q=0.9"},next:{revalidate:900},signal:AbortSignal.timeout(9000)});if(!r.ok)throw new Error(String(r.status));return r.text()}
const derio=/(?:C\.?D\.?\s*)?DERIO(?:\s*,?\s*C\.?D\.?)?(?:\s*["“]?[AB]["”]?)?/i;
function parse(html:string,round:number){
 const t=clean(html), chunks=t.split("|").map(x=>x.trim()).filter(Boolean);
 const idx=chunks.findIndex(x=>derio.test(x));
 if(idx<0)return null;
 const around=chunks.slice(Math.max(0,idx-12),Math.min(chunks.length,idx+13));
 const date=around.find(x=>/\b\d{2}[-/]\d{2}[-/]\d{4}\b/.test(x))?.match(/\d{2}[-/]\d{2}[-/]\d{4}/)?.[0]||"";
 const time=around.find(x=>/\b\d{1,2}:\d{2}\b/.test(x))?.match(/\d{1,2}:\d{2}/)?.[0]||"";
 const venue=around.find(x=>/(HIERBA|ZELAIA|CAMPO|IBAIONDO|FUTBOL|FÚTBOL)/i.test(x) && !derio.test(x))||"";
 const teamTokens=around.filter(x=>/(DERIO|C\.D\.|S\.D\.|F\.C\.|K\.E\.|U\.D\.|CLUB|ATHLETIC|ARENAS|LEIOA|DEUSTO|SANTURTZI|GERNIKA|MUNGIA|BUTROE|ABADIÑO|AMOREBIETA|LOYOLA|ETXEBARRI|INDARTSU|ARTIBAI|ITURRIGORRI|ARIZ|BASKAURI|MONTEFUERTE|SANTUTXU|LEKEITIO)/i.test(x) && !/(TEMPORADA|CAMPEONATO|JORNADA|CLASIFIC)/i.test(x));
 const di=teamTokens.findIndex(x=>derio.test(x));
 const opponent=teamTokens[di+1]&&!derio.test(teamTokens[di+1])?teamTokens[di+1]:teamTokens[di-1]&&!derio.test(teamTokens[di-1])?teamTokens[di-1]:"";
 const isHome=di>=0 && teamTokens[di+1]===opponent;
 return {federationRound:round,opponent,date,time,venue,isHome,status:"scheduled"};
}
function ddmmyyyy(d:Date){return String(d.getDate()).padStart(2,"0")+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+d.getFullYear()}
function dateDistance(s:string,now:Date){if(!s)return 999;const [d,m,y]=s.split(/[-/]/).map(Number);if(!y)return 999;return Math.abs(new Date(y,m-1,d).getTime()-now.getTime())/86400000}
export async function GET(){
 const now=new Date();
 const out=await Promise.all(federationTeams.map(async team=>{
   const candidates:any[]=[];
   for(let j=1;j<=38;j++){
     try{const html=await fetchHtml(team.calendar.replace("{J}",String(j)));const game=parse(html,j);if(game?.opponent)candidates.push(game)}catch{}
   }
   candidates.sort((a,b)=>dateDistance(a.date,now)-dateDistance(b.date,now));
   const game=candidates[0];
   return {id:team.id,name:team.name,...(game||{status:"unavailable",opponent:"",date:"",time:"",venue:"",federationRound:null})};
 }));
 return NextResponse.json({updatedAt:new Date().toISOString(),date:ddmmyyyy(now),teams:out},{headers:{"Cache-Control":"s-maxage=900, stale-while-revalidate=3600"}});
}