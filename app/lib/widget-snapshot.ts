import {matchDetails,kickoffUtc,type ManagedMatch,type RestFixture} from "./match-details";
import {ROUND_TEAMS} from "./new-round";
import {quizFixtures} from "./quiz-fixtures";

export type WidgetStatus="scheduled"|"live"|"halftime"|"finished"|"postponed"|"suspended"|"rest"|"unknown";
export type WidgetMatch={id:string;team:string;home:string;away:string;homeCrest:string|null;awayCrest:string|null;homeScore:number|null;awayScore:number|null;status:WidgetStatus;statusLabel:string;kickoff:string|null;date:string;time:string;url:string};
export type WidgetSnapshot={version:1;round:number;fetchedAt:string;sourceUpdatedAt:string|null;matches:WidgetMatch[];url:string};
export type WidgetRow=ManagedMatch & {home_score:number|null;away_score:number|null;status:string;updated_at:string|null;started_at?:string|null};
export const WIDGET_ORIGIN="https://quiniderio.vercel.app";
const labels:Record<WidgetStatus,string>={scheduled:"Pendiente",live:"En juego",halftime:"Descanso",finished:"Finalizado",postponed:"Aplazado",suspended:"Suspendido",rest:"Sin partido",unknown:"Estado pendiente"};
function status(value:string):WidgetStatus{
 if(value==="final")return "finished";
 if(value==="pending")return "scheduled";
 return Object.hasOwn(labels,value)?value as WidgetStatus:"unknown";
}
const validScore=(value:unknown):value is number=>typeof value==="number"&&Number.isInteger(value)&&value>=0;
const validDate=(value:string|null|undefined)=>!!value&&Number.isFinite(Date.parse(value));
export function widgetCrest(asset:string|undefined):string|null{
 if(!asset||!asset.startsWith("/api/assets/Escudos/"))return null;
 return `${WIDGET_ORIGIN}/api/widgets/crest?asset=${encodeURIComponent(asset)}`;
}
export function widgetUrl(round:number,team?:string):string{
 const q=new URLSearchParams({round:String(round)});if(team)q.set("team",team);
 return `${WIDGET_ORIGIN}/widgets?${q}`;
}
/** No score or live state is inferred from the clock. Database scores are already local/visitor. */
export function buildWidgetSnapshot(round:number,rows:WidgetRow[],rests:RestFixture[],fetchedAt=new Date().toISOString()):WidgetSnapshot{
 const matches:WidgetMatch[]=[];let sourceUpdatedAt:string|null=null;
 for(const team of ROUND_TEAMS){
  const row=rows.find(r=>r.round===round&&r.team===team);
  const rest=rests.some(r=>r.round===round&&r.team===team);
  const fallback=quizFixtures[round]?.[team];
  if(!row&&!rest&&!fallback)continue;
  const d=row?matchDetails(row):fallback;
  const state=rest||(!row&&fallback?.status==="rest")?"rest":row?status(row.status):"scheduled";
  const isHome=row?.is_home??fallback?.isHome;
  const oriented=typeof isHome==="boolean";
  const opponent=row?.opponent||d?.opponent||"Rival por confirmar";
  const own=d?.teamLabel||team;
  const home=state==="rest"?own:oriented?(isHome?own:opponent):own;
  const away=state==="rest"?"Sin partido":oriented?(isHome?opponent:own):`${opponent} · localía pendiente`;
  const showScore=oriented&&!!row&&(["live","halftime","finished"].includes(state)||(state==="suspended"&&!!row.started_at));
  let kickoff=validDate(row?.scheduled_at)?row!.scheduled_at:null;
  if(!kickoff&&state!=="rest"&&d?.date&&d.time){try{kickoff=kickoffUtc(d.date,d.time)}catch{/* Date unconfirmed. */}}
  const ownCrest=widgetCrest("/api/assets/Escudos/cd_derio.png"),rivalCrest=widgetCrest(d?.crest);
  matches.push({id:`${round}:${team}`,team,home,away,homeCrest:oriented?(isHome?ownCrest:rivalCrest):ownCrest,awayCrest:oriented?(isHome?rivalCrest:ownCrest):null,homeScore:showScore&&validScore(row!.home_score)?row!.home_score:null,awayScore:showScore&&validScore(row!.away_score)?row!.away_score:null,status:state,statusLabel:labels[state],kickoff,date:state==="rest"?"":d?.date||"",time:state==="rest"?"":d?.time||"",url:widgetUrl(round,team)});
  if(validDate(row?.updated_at)&&(!sourceUpdatedAt||Date.parse(row!.updated_at!)>Date.parse(sourceUpdatedAt)))sourceUpdatedAt=row!.updated_at;
 }
 const priority=(m:WidgetMatch)=>m.status==="live"||m.status==="halftime"?0:m.status==="scheduled"?1:m.status==="rest"?3:2;
 matches.sort((a,b)=>priority(a)-priority(b)||(Date.parse(a.kickoff||"")||Infinity)-(Date.parse(b.kickoff||"")||Infinity)||a.team.localeCompare(b.team,"es"));
 return {version:1,round,fetchedAt,sourceUpdatedAt,matches,url:widgetUrl(round)};
}
