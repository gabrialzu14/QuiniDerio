import {ROUND_TEAMS,type RoundTeam} from "./new-round";

export type HistoricalMatch={
 round:number;team:string;status:string;is_home:boolean|null;
 home_score:number|null;away_score:number|null;
 fixture_details:Record<string,unknown>|null;
};
export type HistoricalRest={
 round:number;team:string;federation_round:number|null;
};
export type RoundAutoDefaults={
 derioPoints:number|null;
 derioForm:string;
 federationRound:number|null;
 restFederationRound:number|null;
};
const numberOrNull=(value:unknown):number|null=>{
 if(value===null||value===undefined||value==="")return null;
 const num=typeof value==="number"?value:typeof value==="string"&&/^\d+$/.test(value)?Number(value):NaN;
 return Number.isSafeInteger(num)&&num>=0&&num<=999?num:null;
};
const matchPoints=(match:HistoricalMatch):number|null=>{
 if(match.status!=="finished"||typeof match.is_home!=="boolean")return null;
 const ours=numberOrNull(match.is_home?match.home_score:match.away_score);
 const theirs=numberOrNull(match.is_home?match.away_score:match.home_score);
 if(ours===null||theirs===null)return null;
 return ours>theirs?3:ours===theirs?1:0;
};
const formLetter=(match:HistoricalMatch):string|null=>{
 const points=matchPoints(match);
 if(points===null)return null;
 return points===3?"V":points===1?"E":"D";
};
/**
 * A fixture's derioPoints is the table total BEFORE that match.
 * Rebase on every later saved snapshot; add each completed result at most once.
 * No synthetic zero is assumed when a historical points baseline is unavailable.
 */
export function buildRoundDefaults(matches:HistoricalMatch[],rests:HistoricalRest[],round:number):
 Record<RoundTeam,RoundAutoDefaults>{
 const out={} as Record<RoundTeam,RoundAutoDefaults>;
 for(const team of ROUND_TEAMS){
  const history=matches.filter(m=>m.team===team&&m.round<round)
    .sort((a,b)=>a.round-b.round);
  const byes=rests.filter(r=>r.team===team&&r.round<round);
  let points:number|null=null;
  let form="";
  let lastFed:number|null=null;
  const events=[
   ...history.map(row=>({round:row.round,kind:"match" as const,row})),
   ...byes.map(row=>({round:row.round,kind:"rest" as const,row}))
  ].sort((a,b)=>a.round-b.round);
  for(const event of events){
   if(event.kind==="rest"){
    const fed=numberOrNull(event.row.federation_round);
    if(fed!==null&&fed>=1)lastFed=fed;
    continue;
   }
   const match=event.row,details=match.fixture_details||{};
   const fed=numberOrNull(details.federationRound);
   if(fed!==null&&fed>=1)lastFed=fed;
   const snapshot=numberOrNull(details.derioPoints);
   if(snapshot!==null)points=snapshot;
   const priorForm=typeof details.derioForm==="string"
    ?details.derioForm.toUpperCase().replace(/[^VED]/g,"").slice(-5):"";
   if(priorForm.length>form.length)form=priorForm;
   const earned=matchPoints(match);
   if(earned!==null&&points!==null)points+=earned;
   const letter=formLetter(match);
   if(letter)form=(form+letter).slice(-5);
  }
  out[team]={
   derioPoints:points,
   derioForm:form,
   federationRound:lastFed===null?null:lastFed+1,
   restFederationRound:lastFed
  };
 }
 return out;
}
