/**
 * Short vibrations for Android. iOS Safari has no Vibration API, so these
 * calls do nothing there; they never throw.
 */
function vibrate(pattern:number|number[]){
 try{if(typeof navigator!=="undefined"&&typeof navigator.vibrate==="function")navigator.vibrate(pattern)}catch{}
}
/** A light tick when choosing 1, X or 2. */
export const tapHaptic=()=>vibrate(8);
/** A double pulse when the quiniela has been saved. */
export const successHaptic=()=>vibrate([14,60,22]);
