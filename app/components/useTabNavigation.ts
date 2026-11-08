"use client";
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import type {MainTab} from "./BottomNavigation";

const HOME:MainTab="inicio";
const TABS:MainTab[]=["inicio","quiniela","pronosticos","clasificacion","mas"];
const isTab=(value:unknown):value is MainTab=>TABS.includes(value as MainTab);
const tabFromState=(state:unknown):MainTab=>{
  const value=(state as {qdTab?:unknown}|null)?.qdTab;
  return isTab(value)?value:HOME;
};
/** `/?tab=quiniela` (notifications, home-screen shortcuts) opens that tab. */
export const tabFromUrl=(href:string):MainTab|null=>{
  try{const value=new URL(href,"https://quiniderio.local").searchParams.get("tab");return isTab(value)?value:null}catch{return null}
};

/**
 * Tabs keep at most one history entry above Inicio, so the Android back
 * button/gesture returns to Inicio instead of closing the installed app,
 * and a second back from Inicio leaves as usual. The hash is never touched:
 * Supabase recovery links rely on it.
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
      tabRef.current=HOME;
      return;
    }
    if(current===HOME)history.pushState({qdTab:next},"");
    else history.replaceState({qdTab:next},"");
    setTab(next);
    tabRef.current=next;
  };
  const navigateRef=useRef(navigateTab);
  navigateRef.current=navigateTab;
  useEffect(()=>{
    const requested=tabFromUrl(location.href);
    // A reload on a pushed entry starts on Inicio; drop the stale tab marker and any ?tab=.
    if(requested||tabFromState(history.state)!==HOME){
      const clean=requested?location.pathname+location.hash:undefined;
      history.replaceState({qdTab:HOME},"",clean);
    }
    if(requested&&requested!==HOME)navigateRef.current(requested);
    const onPop=(event:PopStateEvent)=>{
      const next=tabFromState(event.state);
      if(next!==tabRef.current){setEntryKey(previous=>previous+1);setTab(next);tabRef.current=next}
    };
    // A notification tapped while the app is already open.
    const onWorkerMessage=(event:MessageEvent)=>{
      if(event.data?.type!=="OPEN_URL")return;
      const next=tabFromUrl(String(event.data.url||""));
      if(next)navigateRef.current(next);
    };
    window.addEventListener("popstate",onPop);
    navigator.serviceWorker?.addEventListener("message",onWorkerMessage);
    return()=>{
      window.removeEventListener("popstate",onPop);
      navigator.serviceWorker?.removeEventListener("message",onWorkerMessage);
    };
  },[]);
  // The document owns scrolling on desktop and installed mobile apps.
  useLayoutEffect(()=>{scrollToTop("instant")},[tab]);
  return {tab,navigateTab,dashboardRef,entryKey};
}
