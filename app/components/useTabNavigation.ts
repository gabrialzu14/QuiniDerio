"use client";
import {useLayoutEffect,useRef,useState} from "react";
import type {MainTab} from "./BottomNavigation";

export default function useTabNavigation(){
  const [tab,setTab]=useState<MainTab>("inicio");
  const [entryKey,setEntryKey]=useState(0);
  const dashboardRef=useRef<HTMLElement>(null);
  const scrollToTop=(behavior:ScrollBehavior)=>{
    dashboardRef.current?.scrollTo({top:0,behavior});
    window.scrollTo({top:0,behavior});
  };
  const navigateTab=(next:MainTab)=>{
    // Re-entering a round view also starts at its current round.
    setEntryKey(previous=>previous+1);
    if(next===tab){
      scrollToTop(window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth");
      return;
    }
    setTab(next);
  };
  // The document owns scrolling on desktop and installed mobile apps.
  useLayoutEffect(()=>{scrollToTop("instant")},[tab]);
  return {tab,navigateTab,dashboardRef,entryKey};
}
