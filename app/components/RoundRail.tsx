"use client";
import {useEffect,useRef,useState} from "react";

type Scope=number|"all";
type Props={value:Scope;onChange:(scope:Scope)=>void;rounds:number[];currentRound:number;initialLabel:string;label:string;enabledRounds?:Set<number>};
export default function RoundRail({value,onChange,rounds,currentRound,initialLabel,label,enabledRounds}:Props){
 const jump=useRef<HTMLDivElement>(null);
 const arrow=useRef<HTMLSpanElement>(null);
 const flight=useRef<Animation|null>(null);
 const rail=useRef<HTMLDivElement>(null);
 const marker=useRef<HTMLSpanElement>(null);
 const frame=useRef(0);
 const [travelling,setTravelling]=useState(false);
 const mouseDrag=useRef<{pointerId:number;startX:number;startLeft:number;dragged:boolean}|null>(null);
 const suppressClickUntil=useRef(0);
 const stop=()=>{flight.current?.cancel();flight.current=null;cancelAnimationFrame(frame.current);frame.current=0;setTravelling(false);if(marker.current)marker.current.style.opacity="0"};
 useEffect(()=>()=>{cancelAnimationFrame(frame.current);flight.current?.cancel()},[]);
 // On iOS PWA, this makes a horizontal swipe work even when parent styles reserve vertical gestures.
 // Only prevent a horizontal move; vertical swipes remain native page scrolling.
 useEffect(()=>{
  const node=rail.current;
  if(!node)return;
  let originX=0,originY=0,originLeft=0;
  let axis:"pending"|"horizontal"|"vertical"="pending";
  const start=(event:TouchEvent)=>{
   if(event.touches.length!==1)return;
   const touch=event.touches[0];
   originX=touch.clientX;originY=touch.clientY;originLeft=node.scrollLeft;axis="pending";
  };
  const move=(event:TouchEvent)=>{
   if(event.touches.length!==1||axis==="vertical"||node.scrollWidth<=node.clientWidth)return;
   const touch=event.touches[0],dx=touch.clientX-originX,dy=touch.clientY-originY;
   if(axis==="pending"&&Math.max(Math.abs(dx),Math.abs(dy))>=7){
    axis=Math.abs(dx)>Math.abs(dy)*1.15?"horizontal":"vertical";
   }
   if(axis!=="horizontal")return;
   if(event.cancelable)event.preventDefault();
   node.scrollLeft=originLeft-dx;
   suppressClickUntil.current=Date.now()+450;
  };
  const end=()=>{axis="pending"};
  node.addEventListener("touchstart",start,{passive:true});
  node.addEventListener("touchmove",move,{passive:false});
  node.addEventListener("touchend",end);
  node.addEventListener("touchcancel",end);
  return()=>{
   node.removeEventListener("touchstart",start);
   node.removeEventListener("touchmove",move);
   node.removeEventListener("touchend",end);
   node.removeEventListener("touchcancel",end);
  };
 },[]);
 const onPointerDown=(event:React.PointerEvent<HTMLDivElement>)=>{
  stop();
  if(event.pointerType!=="mouse"||event.button!==0)return;
  mouseDrag.current={pointerId:event.pointerId,startX:event.clientX,startLeft:event.currentTarget.scrollLeft,dragged:false};
 };
 const onPointerMove=(event:React.PointerEvent<HTMLDivElement>)=>{
  const drag=mouseDrag.current;
  if(!drag||drag.pointerId!==event.pointerId)return;
  const dx=event.clientX-drag.startX;
  if(!drag.dragged&&Math.abs(dx)>6){
   drag.dragged=true;
   event.currentTarget.classList.add("isDragging");
   event.currentTarget.setPointerCapture(event.pointerId);
  }
  if(!drag.dragged)return;
  event.preventDefault();
  event.currentTarget.scrollLeft=drag.startLeft-dx;
  suppressClickUntil.current=Date.now()+450;
 };
 const onPointerEnd=(event:React.PointerEvent<HTMLDivElement>)=>{
  if(mouseDrag.current?.pointerId!==event.pointerId)return;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  event.currentTarget.classList.remove("isDragging");
  mouseDrag.current=null;
 };
 const onRailClickCapture=(event:React.MouseEvent<HTMLDivElement>)=>{
  if(Date.now()>=suppressClickUntil.current)return;
  event.preventDefault();
  event.stopPropagation();
 };
 useEffect(()=>{
  if(frame.current)return;
  const button=rail.current?.querySelector<HTMLElement>('[data-scope="'+value+'"]');
  const node=rail.current;
  if(button&&node)node.scrollLeft=Math.max(0,button.offsetLeft-(node.clientWidth-button.offsetWidth)/2);
 },[value]);
 const advance=()=>{
  const node=rail.current;
  const target=node?.querySelector<HTMLButtonElement>('[data-scope="'+currentRound+'"]');
  const source=node?.querySelector<HTMLButtonElement>('[data-scope="'+value+'"]');
  if(!node||!target||target.disabled||travelling||frame.current)return;
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){onChange(currentRound);return}
  const left=node.scrollLeft;
  const end=Math.max(0,Math.min(node.scrollWidth-node.clientWidth,target.offsetLeft-(node.clientWidth-target.offsetWidth)/2));
  const from=source?source.offsetLeft+source.offsetWidth/2:0;
  const to=target.offsetLeft+target.offsetWidth/2;
  const duration=Math.min(1400,850+Math.abs(to-from)*.22);
  let start:number|null=null;
  setTravelling(true);
  const arrowNode=arrow.current,track=jump.current;
  if(arrowNode&&track&&arrowNode.animate){
   const distance=Math.max(0,track.getBoundingClientRect().right-arrowNode.getBoundingClientRect().right-5);
   flight.current=arrowNode.animate([
    {transform:"translateX(0)",opacity:1,offset:0},
    {transform:`translateX(${distance*.8}px)`,opacity:1,offset:.7},
    {transform:`translateX(${distance}px)`,opacity:0,offset:1}
   ],{duration:duration*.9,easing:"cubic-bezier(.3,0,.25,1)",fill:"forwards"});
  }
  const tick=(time:number)=>{
   if(start===null)start=time;
   const p=Math.min(1,(time-start)/duration);
   const ease=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
   node.scrollLeft=left+(end-left)*ease;
   if(marker.current){marker.current.style.opacity=p===1?"0":"1";marker.current.style.transform=`translateX(${from+(to-from)*ease-14}px)`}
   if(p<1)frame.current=requestAnimationFrame(tick);
   else{frame.current=0;flight.current?.cancel();flight.current=null;setTravelling(false);onChange(currentRound)}
  };
  frame.current=requestAnimationFrame(tick);
 };
 const canAdvance=rounds.includes(currentRound)&&(!enabledRounds||enabledRounds.has(currentRound));
 return <div className={"qdRoundNavigator "+(travelling?"isTravelling":"")}>
  <div ref={jump} className="qdRoundJump"><button className="qdAdvanceRound" type="button" onClick={advance} disabled={!canAdvance||travelling||value===currentRound} aria-label={value===currentRound?"Estás en la jornada actual":"Ir a jornada actual"} aria-busy={travelling}><span>Ir a jornada actual</span><span ref={arrow} className="qdLaunchArrow" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 12h10m-5-5 5 5-5 5"/></svg></span></button></div>
  <div ref={rail} className="qdRoundRail" role="group" aria-label={label} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onClickCapture={onRailClickCapture} onWheel={stop} onKeyDown={stop}>
   <div className="qdRoundTrack">
    <button type="button" data-scope="all" aria-pressed={value==="all"} className={value==="all"?"active":""} onClick={()=>{stop();onChange("all")}}>{initialLabel}</button>
    {rounds.map(round=><button type="button" data-scope={round} key={round} aria-pressed={value===round} className={value===round?"active":""} disabled={!!enabledRounds&&!enabledRounds.has(round)} onClick={()=>{stop();onChange(round)}}>J{round}</button>)}
    <span ref={marker} className="qdRoundTrain" aria-hidden="true"/>
   </div>
  </div>
 </div>;
}
