"use client";
import {useEffect, useMemo, useRef, useState} from "react";
import {summarizeVotes} from "../lib/engagement";
import {makeTrendTimeline, trendStageProgress} from "../lib/vote-timeline";

/** Receives only server-authorized, submitted picks after the round has started. */
export default function VoteTrend({votes}:{votes:readonly string[]}) {
  const root = useRef<HTMLDivElement>(null);
  const bars = useRef<(HTMLElement | null)[]>([]);
  const counters = useRef<(HTMLElement | null)[]>([]);
  const [visible,setVisible] = useState(false);
  const summary = useMemo(()=>summarizeVotes(votes),[votes]);
  // The parent recreates the votes array on render. Only restart for actual data changes.
  const voteSignature = summary.counts.join(":");
  const hasVotes = summary.total > 0;

  useEffect(()=>{
    if(!hasVotes) return;
    const node=root.current;
    if(!node) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)){
      setVisible(true);
      return;
    }
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){
        setVisible(true);
        observer.disconnect();
      }
    },{threshold:0.55,rootMargin:"0px 0px -10% 0px"});
    observer.observe(node);
    return ()=>observer.disconnect();
  },[hasVotes]);

  useEffect(()=>{
    if(!visible || !hasVotes)return;
    const percentages=summary.percentages;
    const timeline=makeTrendTimeline(percentages);
    const paint=(elapsed:number)=>{
      for(let i=0;i<3;i++){
        const fraction=trendStageProgress(elapsed,timeline.stages[i]);
        const bar=bars.current[i];
        const counter=counters.current[i];
        if(bar)bar.style.transform="scaleX("+fraction+")";
        if(counter)counter.textContent=Math.round(percentages[i]*fraction)+"%";
      }
    };
    // Keep the bars and their numbers perfectly synchronized on one animation clock.
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      paint(timeline.end);
      return;
    }
    paint(0);
    let request=0;
    let started:number|null=null;
    const tick=(now:number)=>{
      if(started===null)started=now;
      const elapsed=Math.min(timeline.end,now-started);
      paint(elapsed);
      if(elapsed<timeline.end)request=requestAnimationFrame(tick);
    };
    request=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(request);
    // The serialized counts stay stable when unchanged votes arrays are recreated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[visible,hasVotes,voteSignature]);

  if(!hasVotes)return null;
  return <div ref={root} className={"qdVoteTrend "+(visible?"isVisible":"")} aria-label={"Tendencias: "+summary.percentages[0]+" por ciento local, "+summary.percentages[1]+" empate, "+summary.percentages[2]+" visitante"}>
    <div className="qdVoteTrendTop"><span>TENDENCIAS</span><small>{summary.total} {summary.total===1?"pronóstico":"pronósticos"}</small></div>
    <div className="qdVoteBar" aria-hidden="true">
      {summary.percentages.map((percent,index)=><i key={index} ref={node=>{bars.current[index]=node;}} className={"qdVoteBarPart qdVoteBar"+index} style={{width:percent+"%",transform:"scaleX(0)"}}/>)}
    </div>
    <div className="qdVoteLegend">
      {summary.percentages.map((_,index)=><span key={index} className={"qdVoteLabel qdVoteLabel"+index}>{["1","X","2"][index]} <b ref={node=>{counters.current[index]=node;}}>0%</b></span>)}
    </div>
  </div>;
}
