/** Pure gesture guards shared by mobile interaction and regression tests. */
export const PULL_THRESHOLD=78;
export function pullDistance(startX,startY,currentX,currentY){
 const dx=currentX-startX,dy=currentY-startY;
 if(dy<=12||dy<=Math.abs(dx)*1.45)return 0;
 return Math.min(135,dy);
}
export function canStartPull({scrollTop,blocked,interactive,horizontal=false}){
 return scrollTop<=1&&!blocked&&!interactive&&!horizontal;
}
export function shouldRefresh(distance){
 return distance>=PULL_THRESHOLD;
}
