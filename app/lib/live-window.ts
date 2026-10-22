import {kickoffUtc} from "./match-details";

type FixtureTime={status?:string;date?:string;time?:string};
/** Poll only a visible match window, with live events remaining the primary source. */
export function roundNeedsRefresh(fixtures:Record<string,FixtureTime>,matches:readonly {team:string;status:string}[],now=Date.now()){
 const statuses=new Map(matches.map(match=>[match.team,match.status]));
 if(matches.some(match=>["live","halftime"].includes(match.status)))return true;
 return Object.entries(fixtures).some(([team,game])=>{
  if(game.status==="rest"||["finished","final","suspended","postponed"].includes(statuses.get(team)||""))return false;
  if(!game.date||!game.time)return false;
  try{const kickoff=Date.parse(kickoffUtc(game.date,game.time));return now>=kickoff-15*60_000&&now<=kickoff+4*60*60_000}catch{return false}
 });
}
