import { NextResponse } from "next/server";
import { federationTeams } from "../../../lib/federation";
export const dynamic="force-dynamic";
const entity=(s:string)=>s.replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const txt=(h:string)=>entity(h).replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<br\s*\/?\s*>/gi," | ").replace(/<\/t[drh]>/gi," | ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
async function get(url:string){const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0","accept-language":"es-ES,es;q=0.9"},signal:AbortSignal.timeout(8000),next:{revalidate:600}});if(!r.ok)throw Error(String(r.status));return r.text()}
const isDerio=(s:string)=>/\bDERIO\b/i.test(s);
const junk=(s:string)=>/(JORNADA|TEMPORADA|RESULTADOS|CLASIFIC|ÁRBITR|ARBITR|HIERBA|ARTIFICIAL|NATURAL|CAMPO|ZELAIA|FECHA|HORA|LOCAL|VISITANTE|EGUTEGI|SAILKAPEN)/i.test(s);
function parse(html:string,round:number){
 const rows=[...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(m=>txt(m[0])).filter(Boolean);
 const row=rows.find(x=>isDerio(x));
 const source=row||txt(html);
 if(!isDerio(source))return null;
 const date=source.match(/\b\d{2}[-/]\d{2}[-/]\d{4}\b/)?.[0]||"";
 const time=source.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/)?.[0]||"";
 const parts=source.split(/\s{2,}|\s*\|\s*/).map(x=>x.trim()).filter(x=>x.length>2);
 let di=parts.findIndex(isDerio);
 if(di<0)di=0;
 const candidates=parts.filter(x=>!junk(x)&&!/^\d+[\s-]*\d*$/.test(x)&&!/^\d{2}[-/]\d{2}/.test(x)&&!/^\d{1,2}:\d{2}$/.test(x));
 const dci=candidates.findIndex(isDerio);
 let opponent="";
 if(dci>=0){
   const near=[candidates[dci-1],candidates[dci+1]].filter(Boolean);
   opponent=near.find(x=>!isDerio(x)&&x.length<90)||"";
 }
 if(!opponent){
   const m=source.match(/([^|]{3,70})\s+-\s+([^|]{3,70})/);
   if(m){opponent=isDerio(m[1])?m[2].trim():isDerio(m[2])?m[1].trim():""}
 }
 const isHome=opponent?source.indexOf("DERIO")<source.indexOf(opponent):undefined;
 const venueParts=parts.filter(x=>/(IBAIONDO|MALLONA|LASESARRE|ASTI|FADURA|TABIRA|SOLOARTE|ETXEZURI|SAN MIGUEL|URBIETA|GAZITUAGA|GOBELA|CAMPO|ZELAIA|POL\.|MUNICIPAL)/i.test(x));
 const venue=venueParts.find(x=>!isDerio(x))||"";
 return {federationRound:round,opponent:opponent.replace(/^[-–—\s]+|[-–—\s]+$/g,""),date,time,venue,isHome,status:opponent?"scheduled":"unparsed"};
}
function stamp(s:string){const m=s.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);return m?new Date(+m[3],+m[2]-1,+m[1]).getTime():0}
export async function GET(){
 const now=Date.now(), max=10;
 const teams=await Promise.all(federationTeams.map(async team=>{
   const pages=await Promise.all(Array.from({length:max},(_,i)=>i+1).map(async j=>{try{return parse(await get(team.calendar.replace("{J}",String(j))),j)}catch{return null}}));
   const games=pages.filter((x):x is NonNullable<typeof x>=>!!x&&!!x.opponent);
   const future=games.filter(x=>stamp(x.date)>=now-36*3600000).sort((a,b)=>stamp(a.date)-stamp(b.date));
   const game=future[0]||games.sort((a,b)=>Math.abs(stamp(a.date)-now)-Math.abs(stamp(b.date)-now))[0];
   return {id:team.id,name:team.name,...(game||{status:"unavailable",opponent:"",date:"",time:"",venue:"",federationRound:null})};
 }));
 return NextResponse.json({updatedAt:new Date().toISOString(),teams},{headers:{"Cache-Control":"s-maxage=600, stale-while-revalidate=1800"}});
}