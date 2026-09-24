import { NextResponse } from "next/server";
import { federationTeams } from "../../../lib/federation";
export const dynamic="force-dynamic";

const decode=(s:string)=>s.replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&aacute;/gi,"á").replace(/&eacute;/gi,"é").replace(/&iacute;/gi,"í").replace(/&oacute;/gi,"ó").replace(/&uacute;/gi,"ú").replace(/&ntilde;/gi,"ñ");
const text=(s:string)=>decode(s).replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<br\s*\/?\s*>/gi," | ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();

async function fetchHtml(url:string){
 // PNFG validates a JSESSIONID cookie. Bootstrap it from the federation root
 // first, then request the jornada using the same session.
 const u=new URL(url), root=u.origin+"/";
 let cookie="";
 const absorb=(r:Response)=>{const raw=r.headers.get("set-cookie")||"";const m=raw.match(/JSESSIONID=[^;,\\s]+/i);if(m)cookie=m[0]};
 try{
   const boot=await fetch(root,{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36","Accept":"text/html,application/xhtml+xml","Accept-Language":"es-ES,es;q=0.9"},cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(10000)});
   absorb(boot);
   if(boot.status>=300&&boot.status<400&&boot.headers.get("location")){
     const r2=await fetch(new URL(boot.headers.get("location")!,root),{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",...(cookie?{"Cookie":cookie}:{})},cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(10000)});absorb(r2);
   }
 }catch{}
 const request=async()=>{
   const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36","Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8","Accept-Language":"es-ES,es;q=0.9","Referer":root,...(cookie?{"Cookie":cookie}:{})},cache:"no-store",redirect:"follow",signal:AbortSignal.timeout(15000)});
   absorb(r);if(!r.ok)throw new Error("Federation "+r.status);return r.text();
 };
 let body=await request();
 if(/No se ha aceptado el cookie/i.test(body)&&cookie)body=await request();
 return body;
}
function dateOf(s:string){return s.match(/\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/)?.[0]||""}
function timeOf(s:string){return s.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/)?.[0]||""}
function parse(html:string,round:number){
 const rowHtml=[...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map(m=>m[0]).filter(r=>/DERIO/i.test(text(r)));
 for(const row of rowHtml){
   const vals=[...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>text(m[1])).filter(Boolean);
   if(!vals.length) continue;
   const di=vals.findIndex(v=>/DERIO/i.test(v)); if(di<0)continue;
   const ignore=(v:string)=>/^(JORNADA|FECHA|HORA|CAMPO|LOCAL|VISITANTE|RESULTADO|VS\.?|-)$/i.test(v)||/^\d+$/.test(v)||!!dateOf(v)||!!timeOf(v);
   const teamCells=vals.map((v,i)=>({v,i})).filter(x=>!ignore(x.v)&&x.v.length<90);
   const d=teamCells.findIndex(x=>/DERIO/i.test(x.v));
   const left=teamCells.slice(0,d).reverse().find(x=>!/(IBAIONDO|CAMPO|ZELAIA|MUNICIPAL|POLIDEPORT)/i.test(x.v));
   const right=teamCells.slice(d+1).find(x=>!/(IBAIONDO|CAMPO|ZELAIA|MUNICIPAL|POLIDEPORT)/i.test(x.v));
   const opp=(right||left)?.v||"";
   if(!opp)continue;
   const oi=vals.findIndex(v=>v===opp);
   const venue=vals.find(v=>v!==opp&&!/DERIO/i.test(v)&&/(IBAIONDO|CAMPO|ZELAIA|MUNICIPAL|POLIDEPORT|FADURA|MALLONA|LASESARRE|SOLOARTE|TABIRA|URBIETA|GAZITUAGA|GOBELA|SAN MIGUEL)/i.test(v))||"";
   return {federationRound:round,opponent:opp,date:dateOf(text(row)),time:timeOf(text(row)),venue,isHome:oi>=0?di<oi:undefined,status:"scheduled"};
 }
 // Federation sometimes returns non-table/mobile markup: use a bounded text window around DERIO.
 const all=text(html), pos=all.search(/DERIO/i);
 if(pos>=0){
   const chunk=all.slice(Math.max(0,pos-180),pos+260);
   const pieces=chunk.split(/\s+[-–—|]\s+|\s{2,}/).map(x=>x.trim()).filter(Boolean);
   const dp=pieces.findIndex(x=>/DERIO/i.test(x));
   const opp=[pieces[dp-1],pieces[dp+1]].find(x=>x&&!/DERIO/i.test(x)&&x.length<80&&!dateOf(x)&&!timeOf(x));
   if(opp)return {federationRound:round,opponent:opp,date:dateOf(chunk),time:timeOf(chunk),venue:"",status:"scheduled"};
 }
 return null;
}
function stamp(s:string){const m=s.match(/(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/);if(!m)return 0;let y=m[3]?+m[3]:new Date().getFullYear();if(y<100)y+=2000;return new Date(y,+m[2]-1,+m[1]).getTime()}

export async function GET(){
 const now=Date.now();
 const teams=await Promise.all(federationTeams.map(async team=>{
   const games:any[]=[];
   // September is early season; scan all rounds but stop once several future fixtures exist.
   for(let start=1;start<=40;start+=5){
     const batch=await Promise.all(Array.from({length:Math.min(5,41-start)},(_,i)=>start+i).map(async round=>{try{const html=await fetchHtml(team.calendar.replace("{J}",String(round)));const game=parse(html,round);if(debug&&round<=3)diagnostics.push({team:team.name,round,bytes:html.length,hasDerio:/DERIO/i.test(text(html)),cookieRejected:/No se ha aceptado el cookie/i.test(html),sample:text(html).slice(0,180),parsed:game});return game}catch(e){if(debug&&round<=3)diagnostics.push({team:team.name,round,error:String(e)});return null}}));
     games.push(...batch.filter(Boolean));
     if(games.filter(g=>stamp(g.date)>=now-2*86400000).length>=2)break;
   }
   const dated=games.filter(g=>stamp(g.date));
   const next=dated.filter(g=>stamp(g.date)>=now-2*86400000).sort((a,b)=>stamp(a.date)-stamp(b.date))[0];
   const nearest=dated.sort((a,b)=>Math.abs(stamp(a.date)-now)-Math.abs(stamp(b.date)-now))[0];
   const game=next||nearest||games[0];
   return {id:team.id,name:team.name,...(game||{status:"unavailable",opponent:"",date:"",time:"",venue:"",federationRound:null})};
 }));
 return NextResponse.json({updatedAt:new Date().toISOString(),teams,...(debug?{diagnostics}: {})},{headers:{"Cache-Control":"no-store, max-age=0"}});
}