"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from "react";
import {supabase} from "../lib/supabase";
import {quizFixtures} from "../lib/quiz-fixtures";
import {mergeFixtures,type ManagedMatch} from "../lib/match-details";
const Context=createContext(quizFixtures);
export const useFixtures=()=>useContext(Context);
export default function ManagedFixtures({children}:{children:ReactNode}){
 const [fixtures,setFixtures]=useState(quizFixtures);
 useEffect(()=>{let active=true;let version=0;const load=async()=>{const id=++version;const {data,error}=await supabase.from("quini_live_matches").select("round,team,opponent,is_home,scheduled_at,fixture_details");if(active&&id===version&&!error&&data)setFixtures(mergeFixtures(data as ManagedMatch[]))};void load();const channel=supabase.channel("managed-fixtures").on("postgres_changes",{event:"*",schema:"public",table:"quini_live_matches"},()=>void load()).subscribe();const focus=()=>void load();window.addEventListener("focus",focus);return()=>{active=false;window.removeEventListener("focus",focus);void supabase.removeChannel(channel)}},[]);
 return <Context.Provider value={fixtures}>{children}</Context.Provider>;
}
