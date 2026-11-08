"use client";
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import type {MainTab} from "./BottomNavigation";

const HOME:MainTab="inicio";
const TABS:MainTab[]=["inicio","quiniela","pronosticos","clasificacion","mas"];
const tabFromState=(state:unknown):MainTab=>{
  const value=(state as {qdTab?:unknown}|null)?.qdTab;
  return TABS.includes(value as MainTab)?value as MainTab:HOME;
};

/**
 * Tabs keep at most one history entry above Inicio, so the Android back
 * button/gesture returns to Inicio instead of closing the installed app,
 * and a second back from Inicio leaves as usual. The URL is never changed:
 * Supabase recovery links rely on the hash.
 */
export default function useTabNavigation(){
  const [tab,setTab]=useState<MainTab>(HOME);
  const [entryKey,setEntryKey]=useState(0);
  const dashboardRef=useRef<HTMLElement>(null);
  const tabRef=useRef<MainTab>(HOME);
  tabRef.current=tab;
  const scrollToTop=(behavior:ScrollBehavior)=>{
    dashboardRef.current?.scrollTo({top:0,behavior});
    window.scrollTo({top:0,behavior});
  };
  useEffect(()=>{
    // A reload on a pushed entry starts on Inicio; drop the stale tab marker.
    if(tabFromState(history.state)!==HOME)history.replaceState({qdTab:HOME},"");
    const onPop=(event:PopStateEvent)=>{
      const next=tabFromState(event.state);
      if(next!==tabRef.current){setEntryKey(previous=>previous+1);setTab(next)}
    };
    window.addEventListener("popstate",onPop);
    return()=>window.removeEventListener("popstate",onPop);
  },[]);
  const navigateTab=(next:MainTab)=>{
    // Re-entering a round view also starts at its current round.
    setEntryKey(previous=>previous+1);
    const current=tabRef.current;
    if(next===current){
      scrollToTop(window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth");
      return;
    }
    if(next===HOME&&tabFromState(history.state)!==HOME){
      // Reuse the existing Inicio entry so forward history never piles up.
      history.back();
      setTab(HOME);
      return;
    }
    if(current===HOME)history.pushState({qdTab:next},"");
    else history.replaceState({qdTab:next},"");
    setTab(next);
  };
  // The document owns scrolling on desktop and installed mobile apps.
  useLayoutEffect(()=>{scrollToTop("instant")},[tab]);
  return {tab,navigateTab,dashboardRef,entryKey};
}
