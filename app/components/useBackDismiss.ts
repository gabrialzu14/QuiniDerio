"use client";
import {useEffect,useRef} from "react";

/**
 * While `open`, the Android back button/gesture closes this overlay instead
 * of leaving the app. Closing it any other way removes the extra entry again.
 * Stacked overlays each own one entry, so back closes the top one first.
 */
export default function useBackDismiss(open:boolean,onClose:()=>void){
 const closeRef=useRef(onClose);
 closeRef.current=onClose;
 useEffect(()=>{
  if(!open)return;
  const token="o"+Math.random().toString(36).slice(2);
  let pushed=false,popped=false;
  // Deferred so a StrictMode double-mount never leaves a stray entry.
  const timer=window.setTimeout(()=>{
   const tab=(history.state as {qdTab?:string}|null)?.qdTab;
   history.pushState({qdTab:tab,qdOverlay:token},"");
   pushed=true;
  },0);
  const onPop=(event:PopStateEvent)=>{
   if(!pushed||popped)return;
   if((event.state as {qdOverlay?:string}|null)?.qdOverlay===token)return;
   popped=true;
   closeRef.current();
  };
  window.addEventListener("popstate",onPop);
  return()=>{
   window.clearTimeout(timer);
   window.removeEventListener("popstate",onPop);
   if(pushed&&!popped&&(history.state as {qdOverlay?:string}|null)?.qdOverlay===token)history.back();
  };
 },[open]);
}
