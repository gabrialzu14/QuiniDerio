"use client";
import {useEffect, useMemo, useRef, useState} from "react";
import {summarizeVotes} from "../lib/engagement";

/** Receives only server-authorized, submitted picks after the round has started. */
export default function VoteTrend({votes}:{votes:readonly string[]}) {
  const root = useRef<HTMLDivElement>(null);
  const [visible,setVisible] = useState(false);
  const [progress,setProgress] = useState(0);
  const summary = useMemo(()=>summarizeVotes(votes),[votes]);
  useEffect(()=>{
    const node=root.current;
    if(!node)return;
    if(!("IntersectionObserver" in window)){setVisible(true);return;}
    const observer=new IntersectionObserver((entries)=>{
      if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}
    },{threshold:0.18});
    observer.observe(node);
    return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!visible || !summary.total) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setProgress(1);return;}
    let frame=0;
    const start=performance.now();
    const tick=(now:number)=>{
      const t=Math.min(1,(now-start)/930);
      setProgress(1-Math.pow(1-t,3));
      if(t<1)frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(frame);
  },[visible,summary.total]);
  if(!summary.total)return null;
  return <div ref={root} className={"qdVoteTrend "+(visible?"isVisible":"")} aria-label={"Tendencias: "+summary.percentages[0]+" por ciento local, "+summary.percentages[1]+" empate, "+summary.percentages[2]+" visitante"}>
    <div className="qdVoteTrendTop"><span>TENDENCIAS</span><small>{summary.total} {summary.total===1?"pronóstico":"pronósticos"}</small></div>
    <div className="qdVoteBar" aria-hidden="true">
      {summary.percentages.map((percent,index)=><i key={index} className={"qdVoteBarPart qdVoteBar"+index} style={{width:percent*progress+"%"}}/>)}
    </div>
    <div className="qdVoteLegend">
      {summary.percentages.map((percent,index)=><span key={index} className={"qdVoteLabel qdVoteLabel"+index}>{["1","X","2"][index]} <b>{Math.round(percent*progress)}%</b></span>)}
    </div>
  </div>;
}
