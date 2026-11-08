"use client";
import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";

/**
 * True while a jornada is being played: a match is live, or the first
 * kickoff has passed and not every match is finished or suspended.
 * Rechecked every minute and when the app comes back to the foreground.
 */
export default function useRoundInPlay(round:number){
 const [inPlay,setInPlay]=useState(false);
 useEffect(()=>{
  let active=true;
  const check=async()=>{
   const {data,error}=await supabase.from("quini_live_matches").select("status,scheduled_at,started_at").eq("round",round);
   if(!active||error||!data)return;
   const now=Date.now();
   const done=(s:string)=>["finished","final","suspended"].includes(s);
   const live=data.some(m=>m.status==="live");
   const started=data.some(m=>m.started_at||(m.scheduled_at&&Date.parse(m.scheduled_at)<=now));
   setInPlay(live||(started&&data.length>0&&!data.every(m=>done(String(m.status||"")))));
  };
  void check();
  const id=window.setInterval(()=>void check(),60000);
  const onVisible=()=>{if(document.visibilityState==="visible")void check()};
  document.addEventListener("visibilitychange",onVisible);
  return()=>{active=false;window.clearInterval(id);document.removeEventListener("visibilitychange",onVisible)};
 },[round]);
 return inPlay;
}
