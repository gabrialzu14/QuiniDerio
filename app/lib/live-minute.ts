/**
 * Estimated match clock for a game marked "live".
 * Halves last 40 minutes for Cadete teams and 45 for everyone else, with a
 * 15-minute break. The clock starts when the admin pressed "Iniciar"
 * (started_at) or, failing that, at the scheduled kickoff.
 */
export const HALF_TIME_BREAK=15;
export type LiveClock={phase:"first"|"second"|"added",minute:number,label:string}|{phase:"break",label:string};

export const halfLengthFor=(team:string)=>/cadete/i.test(team)?40:45;

export function liveClock(team:string,startedAt:string|null|undefined,scheduledAt:string|null|undefined,now:number):LiveClock|null{
 const start=Date.parse(startedAt||scheduledAt||"");
 if(!Number.isFinite(start))return null;
 const elapsed=Math.floor((now-start)/60000);
 if(elapsed<0)return null;
 const half=halfLengthFor(team),full=half*2;
 if(elapsed<half)return {phase:"first",minute:elapsed+1,label:`${elapsed+1}'`};
 if(elapsed<half+HALF_TIME_BREAK)return {phase:"break",label:"Descanso"};
 const minute=elapsed-HALF_TIME_BREAK+1;
 if(minute<=full)return {phase:"second",minute,label:`${minute}'`};
 // Stoppage time until the admin marks the match as finished.
 return {phase:"added",minute:full,label:`${full}+'`};
}
