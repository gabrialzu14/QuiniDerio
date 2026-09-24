import { NextResponse } from "next/server";
import { federationTeams } from "../../../lib/federation";

export const dynamic = "force-dynamic";

function text(html:string){return html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim()}
async function fetchHtml(url:string){const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 (QuiniDerio/1.0)","accept-language":"es-ES,es;q=0.9"},cache:"no-store",signal:AbortSignal.timeout(9000)});if(!r.ok)throw new Error(String(r.status));return r.text()}
function hasDerio(html:string){return /DERIO/i.test(text(html))}
export async function GET(){
 const out=await Promise.all(federationTeams.map(async team=>{
   let detected:null|number=null; let preview="";
   for(let j=1;j<=40;j++){
     try{const html=await fetchHtml(team.calendar.replace("{J}",String(j)));if(hasDerio(html)){detected=j;preview=text(html).slice(0,180)}}catch{break}
   }
   return {id:team.id,name:team.name,federationRound:detected,status:detected?"source-reachable":"unavailable",preview};
 }));
 return NextResponse.json({updatedAt:new Date().toISOString(),teams:out},{headers:{"Cache-Control":"s-maxage=900, stale-while-revalidate=3600"}});
}
