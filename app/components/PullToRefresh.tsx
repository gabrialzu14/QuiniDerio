"use client";

import {useEffect,useRef,useState} from "react";
import type {CSSProperties} from "react";
import {canStartPull,pullDistance,shouldRefresh} from "../lib/mobile-gestures.mjs";

type Phase="idle"|"pull"|"ready"|"refreshing"|"success"|"error";
type Gesture={x:number,y:number,distance:number};
const NO_PULL="input,textarea,select,button,a,[contenteditable='true'],[role='dialog'],.rankingRoundTabs,.rankingTabs,.predictionTabs,.predictionScopeTabs,.predictionUnifiedTabs,.qdPullNotice";
const MODALS="[aria-modal='true'],.qdModalOpen,.roundPendingOverlay,.pushPromptBackdrop,.qdDavidExpulsionOverlay,.assistantPredictionOverlay,.playerStatsOverlay,.avatarCropOverlay";

export default function PullToRefresh({onRefresh}:{onRefresh:()=>Promise<boolean>}){
 const[phase,setPhase]=useState<Phase>("idle");
 const[progress,setProgress]=useState(0);
 const gesture=useRef<Gesture|null>(null);
 const refreshing=useRef(false);
 const refreshFn=useRef(onRefresh);
 const resetTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const alive=useRef(true);
 refreshFn.current=onRefresh;
 const hide=()=>{
  gesture.current=null;
  setPhase("idle");
  setProgress(0);
 };

 useEffect(()=>{
  alive.current=true;
  const clearTimer=()=>{if(resetTimer.current){clearTimeout(resetTimer.current);resetTimer.current=null}};
  const finish=(next:Phase)=>{
   if(!alive.current)return;
   setPhase(next);
   setProgress(0);
   clearTimer();
   resetTimer.current=setTimeout(()=>{if(alive.current){refreshing.current=false;hide()}},next==="success"?1350:2300);
  };
  const start=(event:TouchEvent)=>{
   if(refreshing.current||event.touches.length!==1||document.visibilityState!=="visible")return;
   const target=event.target;
   const isInteractive=target instanceof Element&&!!target.closest(NO_PULL);
   const isHorizontal=target instanceof Element&&!!target.closest("[data-horizontal-scroll],.qdRoundTabs,.rankingRoundTabs,.predictionTabs,.predictionUnifiedTabs");
   const blocked=!!document.querySelector(MODALS);
   const scrollTop=Math.max(window.scrollY,document.scrollingElement?.scrollTop||0);
   if(!canStartPull({scrollTop,blocked,interactive:isInteractive,horizontal:isHorizontal})){
    gesture.current=null;return;
   }
   const touch=event.touches[0];
   gesture.current={x:touch.clientX,y:touch.clientY,distance:0};
  };
  const move=(event:TouchEvent)=>{
   const current=gesture.current;
   if(!current||refreshing.current||event.touches.length!==1)return;
   if(window.scrollY>1||(document.scrollingElement?.scrollTop||0)>1||document.querySelector(MODALS)){
    hide();return;
   }
   const touch=event.touches[0];
   const distance=pullDistance(current.x,current.y,touch.clientX,touch.clientY);
   current.distance=distance;
   if(distance===0){if(phase!=="idle")hide();return;}
   setProgress(Math.min(1,distance/110));
   setPhase(shouldRefresh(distance)?"ready":"pull");
   // Passive touch listeners intentionally never call preventDefault:
   // vertical pan remains owned by the browser's document scroller.
  };
  const end=()=>{
   const distance=gesture.current?.distance||0;
   gesture.current=null;
   if(!distance||refreshing.current)return;
   if(!shouldRefresh(distance)){hide();return;}
   refreshing.current=true;
   setPhase("refreshing");
   setProgress(0);
   void Promise.resolve().then(()=>refreshFn.current()).then(
    updated=>finish(updated?"success":"error"),
    ()=>finish("error")
   );
  };
  const cancel=()=>{gesture.current=null;if(!refreshing.current)hide()};
  const visible=()=>{if(document.visibilityState!=="visible"&&!refreshing.current)cancel()};
  document.addEventListener("touchstart",start,{passive:true});
  document.addEventListener("touchmove",move,{passive:true});
  document.addEventListener("touchend",end,{passive:true});
  document.addEventListener("touchcancel",cancel,{passive:true});
  document.addEventListener("visibilitychange",visible);
  return()=>{
   alive.current=false;
   clearTimer();
   document.removeEventListener("touchstart",start);
   document.removeEventListener("touchmove",move);
   document.removeEventListener("touchend",end);
   document.removeEventListener("touchcancel",cancel);
   document.removeEventListener("visibilitychange",visible);
  };
 // phase changes are displayed via React state. Gesture listeners remain stable.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);

 if(phase==="idle")return null;
 const text=phase==="refreshing"?"Actualizando…":
  phase==="success"?"Actualizado":
  phase==="error"?"No se ha podido actualizar":"Desliza para actualizar";
 const style={"--qd-pull-y":(phase==="pull"||phase==="ready"?Math.round(progress*14):0)+"px"} as CSSProperties;
 return <div className={"qdPullNotice is-"+phase} style={style} role="status" aria-live={phase==="error"?"assertive":"polite"} aria-atomic="true">
  <span className="qdPullNoticeOrb" aria-hidden="true"><i/></span>
  <b>{text}</b>
 </div>;
}
