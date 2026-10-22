import {roundPosition,roundPotContribution,type RoundHit} from "./engagement";

type Fixtures=Record<number,Record<string,{status?:string}>>;
export type RecapMatch={round:number;team:string;status:string};
export type RoundSnapshot={round:number;hits:number;played:number;place:number|null;movement:number|null;pot:number|null};
const final=(status:string|undefined)=>status==="finished"||status==="final";

/** A suspended or missing match is unresolved, even if the weekly betting window closed. */
export function latestRoundSnapshot(fixtures:Fixtures,matches:readonly RecapMatch[],scores:readonly RoundHit[],userId:string,maxRound:number):RoundSnapshot|null{
 const complete=(round:number)=>{
  const expected=Object.entries(fixtures[round]||{}).filter(([,game])=>game.status!=="rest").map(([team])=>team);
  const statuses=new Map(matches.filter(match=>Number(match.round)===round).map(match=>[match.team,match.status]));
  return expected.length>0&&expected.every(team=>final(statuses.get(team)))?expected.length:0;
 };
 const rounds=[...new Set(scores.filter(score=>score.user_id===userId&&score.round<=maxRound&&score.round>0).map(score=>Number(score.round)))].sort((a,b)=>b-a);
 for(const round of rounds){
  const played=complete(round);if(!played)continue;
  const own=scores.find(score=>score.round===round&&score.user_id===userId)!;
  const priorPlace=round>1&&complete(round-1)?roundPosition(scores,userId,round-1):null;
  const currentPlace=roundPosition(scores,userId,round);
  return {round,hits:Number(own.hits),played,place:roundPosition(scores,userId,round,true),movement:priorPlace!==null&&currentPlace!==null?priorPlace-currentPlace:null,pot:roundPotContribution(scores,userId,round,played)};
 }
 return null;
}

export const recapSeenKey=(userId:string,round:number)=>`qd-round-recap-seen-v1:${userId}:${round}`;
