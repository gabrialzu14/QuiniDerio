export const PULL_THRESHOLD:number;
export function pullDistance(startX:number,startY:number,currentX:number,currentY:number):number;
export function canStartPull(args:{scrollTop:number,blocked:boolean,interactive:boolean,horizontal?:boolean}):boolean;
export function shouldRefresh(distance:number):boolean;
