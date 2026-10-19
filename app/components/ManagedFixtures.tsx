"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from "react";
import {supabase} from "../lib/supabase";
import {quizFixtures} from "../lib/quiz-fixtures";
import {mergeFixtures,type ManagedMatch,type RestFixture} from "../lib/match-details";
const Context=createContext(quizFixtures);
const ActiveRoundContext=createContext(3);
export const useFixtures=()=>useContext(Context);
export const useActiveRound=()=>useContext(ActiveRoundContext);
export default function ManagedFixtures({children}:{children:ReactNode}){
 const [fixtures,setFixtures]=useState(quizFixtures);
 const [activeRound,setActiveRound]=useState(3);
 useEffect(()=>{
  let active=true,version=0;
  const load=async()=>{
   const id=++version;
   const [games,rests]=await Promise.all([
    supabase.from("quini_live_matches").select("round,team,opponent,is_home,scheduled_at,fixture_details"),
    supabase.from("quini_rest_fixtures").select("round,team,competition,federation_round")
   ]);
   if(active&&id===version&&!games.error&&!rests.error){
    setFixtures(mergeFixtures((games.data||[]) as ManagedMatch[],(rests.data||[]) as RestFixture[]));
   }
  };
  void load();
  const channel=supabase.channel("managed-fixtures")
   .on("postgres_changes",{event:"*",schema:"public",table:"quini_live_matches"},()=>void load())
   .on("postgres_changes",{event:"*",schema:"public",table:"quini_rest_fixtures"},()=>void load())
   .subscribe();
  const focus=()=>void load();
  window.addEventListener("focus",focus);
  document.addEventListener("visibilitychange",focus);
  return()=>{
   active=false;
   window.removeEventListener("focus",focus);
   document.removeEventListener("visibilitychange",focus);
   void supabase.removeChannel(channel);
  };
 },[]);
 useEffect(()=>{
  let mounted=true,requestId=0;
  const fetchActive=async()=>{
   const id=++requestId;
   const {data,error}=await supabase.from("quini_app_settings").select("active_round").eq("id",1).maybeSingle();
   if(mounted&&requestId===id&&!error&&Number.isInteger(data?.active_round)&&data!.active_round>=1){
    setActiveRound(data!.active_round);
   }
  };
  void fetchActive();
  const channel=supabase.channel("quini-active-round-read")
   .on("postgres_changes",{event:"*",schema:"public",table:"quini_app_settings"},()=>void fetchActive())
   .subscribe();
  const interval=window.setInterval(()=>{if(document.visibilityState==="visible")void fetchActive()},20000);
  const resume=()=>{if(document.visibilityState==="visible")void fetchActive()};
  const onRoundAdvanced=()=>void fetchActive();
  document.addEventListener("visibilitychange",resume);
  window.addEventListener("focus",resume);
  window.addEventListener("quini-round-advanced",onRoundAdvanced);
  return()=>{
   mounted=false;
   window.clearInterval(interval);
   document.removeEventListener("visibilitychange",resume);
   window.removeEventListener("focus",resume);
   window.removeEventListener("quini-round-advanced",onRoundAdvanced);
   void supabase.removeChannel(channel);
  };
 },[]);
 return <Context.Provider value={fixtures}><ActiveRoundContext.Provider value={activeRound}>{children}</ActiveRoundContext.Provider></Context.Provider>;
}
