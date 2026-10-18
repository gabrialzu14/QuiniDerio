"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from "react";
import {supabase} from "../lib/supabase";
import {quizFixtures} from "../lib/quiz-fixtures";
import {mergeFixtures,type ManagedMatch,type RestFixture} from "../lib/match-details";
const Context=createContext(quizFixtures);
export const useFixtures=()=>useContext(Context);
export default function ManagedFixtures({children}:{children:ReactNode}){
 const [fixtures,setFixtures]=useState(quizFixtures);
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
 return <Context.Provider value={fixtures}>{children}</Context.Provider>;
}
