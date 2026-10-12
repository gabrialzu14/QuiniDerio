"use client";
import {useLayoutEffect,useRef,useState} from "react";
import type {MainTab} from "./BottomNavigation";

export default function useTabNavigation(){
  const [tab,setTab]=useState<MainTab>("inicio");
  const dashboardRef=useRef<HTMLElement>(null);
  const scrollToTop=(behavior:ScrollBehavior)=>{
    dashboardRef.current?.scrollTo({top:0,behavior});
    window.scrollTo({top:0,behavior});
  };
  const navigateTab=(next:MainTab)=>{
    if(next===tab){
      scrollToTop(window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth");
      return;
    }
    setTab(next);
  };
  // Mobile PWA content scrolls inside main; desktop may scroll the document.
  useLayoutEffect(()=>{scrollToTop("instant")},[tab]);
  return {tab,navigateTab,dashboardRef};
}
