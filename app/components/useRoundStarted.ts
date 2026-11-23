"use client";
import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";

/** Remembered per round so re-entering a tab does not flash the wrong default while the check runs. */
const known=new Map<number,boolean>();

/**
 * True once the round has begun: a match is live or finished, or the first kickoff has passed.
 * It stays true after the last match ends, until the next round becomes the active one.
 */
export default function useRoundStarted(round:number){
 const [started,setStarted]=useState<boolean>(()=>known.get(round)??false);
 useEffect(()=>{
  let active=true;
  setStarted(known.get(round)??false);
  const check=async()=>{
   const {data,error}=await supabase.from("quini_live_matches").select("status,scheduled_at,started_at").eq("round",round);
   if(!active||error||!data)return;
   const now=Date.now();
   const next=data.length>0&&data.some(m=>["live","finished","final","suspended"].includes(String(m.status||""))||m.started_at||(m.scheduled_at&&Date.parse(m.scheduled_at)<=now));
   known.set(round,next);
   setStarted(next);
  };
  void check();
  const id=window.setInterval(()=>void check(),60000);
  const onVisible=()=>{if(document.visibilityState==="visible")void check()};
  document.addEventListener("visibilitychange",onVisible);
  return()=>{active=false;window.clearInterval(id);document.removeEventListener("visibilitychange",onVisible)};
 },[round]);
 return started;
}
