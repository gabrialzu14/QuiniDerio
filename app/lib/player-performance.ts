/**
 * Season performance for the participant detail sheet.
 * Only fully settled rounds count toward the per-round average.
 * Suspended games close a round but do not count as evaluated predictions.
 */
export type PlayerPerformanceScore={user_id:string;round:number;hits:number;picks_count:number};
export type PlayerPerformanceMatch={round:number;status:string};
export type PlayerPerformance={
 percentage:number|null;
 pointsPerRound:number|null;
 hits:number;
 evaluatedPicks:number;
 completedRounds:number;
};
export function summarizePlayerPerformance(
 scores:readonly PlayerPerformanceScore[],
 matches:readonly PlayerPerformanceMatch[],
 userId:string
):PlayerPerformance{
 const state=new Map<number,{total:number;settled:number;played:number}>();
 for(const match of matches){
  const round=Number(match.round);
  if(!Number.isSafeInteger(round)||round<1)continue;
  const counts=state.get(round)||{total:0,settled:0,played:0};
  counts.total++;
  if(["finished","final","suspended"].includes(match.status))counts.settled++;
  if(["finished","final"].includes(match.status))counts.played++;
  state.set(round,counts);
 }
 const completed=new Set([...state.entries()]
  .filter(([,v])=>v.total>0&&v.total===v.settled&&v.played>0)
  .map(([round])=>round));
 let hits=0,evaluatedPicks=0;
 for(const score of scores){
  if(score.user_id!==userId||!completed.has(Number(score.round)))continue;
  const picked=Number(score.picks_count),correct=Number(score.hits);
  if(!Number.isFinite(picked)||!Number.isFinite(correct))continue;
  evaluatedPicks+=Math.max(0,picked);
  hits+=Math.min(Math.max(0,correct),Math.max(0,picked));
 }
 return {
  percentage:evaluatedPicks>0?Math.round(hits/evaluatedPicks*100):null,
  pointsPerRound:completed.size>0?hits/completed.size:null,
  hits,evaluatedPicks,completedRounds:completed.size
 };
}
