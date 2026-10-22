"use client";
import {useEffect,useRef,useState,type RefObject} from "react";

const targets=".matchRivalsCard,.matchRivalsTeam,.matchRivalsPlayers>li,.seasonSticker,.rivalPlayerBanner,.rankingRow,.qdPlayerRoundMatch,.qdCardsRow";
/** One observer per view, including asynchronously loaded content and modal scrollports. */
export function useScrollReveal(root:RefObject<HTMLElement|null>){
 useEffect(()=>{
  const node=root.current;
  if(!node||!("IntersectionObserver" in window)||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const seen=new WeakSet<Element>();
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting){entry.target.setAttribute("data-qd-reveal","shown");observer.unobserve(entry.target)}
  },{threshold:0,rootMargin:"0px 0px -24px 0px"});
  const scan=()=>node.querySelectorAll(targets).forEach(element=>{
   if(seen.has(element))return;seen.add(element);
   // Never conceal content that the user has already scrolled past.
   if(element.getBoundingClientRect().bottom<0)return;
   element.setAttribute("data-qd-reveal","waiting");observer.observe(element);
  });
  scan();
  const mutations=new MutationObserver(records=>{if(records.some(record=>Array.from(record.addedNodes).some(added=>added.nodeType===1)))scan()});
  mutations.observe(node,{childList:true,subtree:true});
  return()=>{observer.disconnect();mutations.disconnect();node.querySelectorAll("[data-qd-reveal]").forEach(element=>element.removeAttribute("data-qd-reveal"))};
 },[root]);
}

export function AnimatedNumber({value,suffix="",prefix="",decimals=0}:{value:number;suffix?:string;prefix?:string;decimals?:number}){
 const root=useRef<HTMLSpanElement>(null);
 const previous=useRef(0);
 const [visible,setVisible]=useState(false);
 const safe=Number.isFinite(value)?value:0;
 const initial=useRef(safe);
 const format=(number:number)=>prefix+number.toLocaleString("es-ES",{minimumFractionDigits:decimals,maximumFractionDigits:decimals})+suffix;
 useEffect(()=>{
  const node=root.current;if(!node)return;
  if(!("IntersectionObserver" in window)){setVisible(true);return}
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect()}},{threshold:0});
  observer.observe(node);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  const node=root.current;if(!node||!visible)return;
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){node.textContent=format(safe);previous.current=safe;return}
  const from=previous.current;let frame=0;let start:number|null=null;
  const tick=(time:number)=>{
   if(start===null)start=time;
   const progress=Math.min(1,(time-start)/760);
   const current=from+(safe-from)*(1-Math.pow(1-progress,3));
   node.textContent=format(decimals?current:Math.round(current));previous.current=current;
   if(progress<1)frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  // Formatting depends only on these primitive props.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[safe,visible,prefix,suffix,decimals]);
 return <span className="qdAnimatedNumber" aria-label={format(safe)}><span aria-hidden="true" ref={root}>{format(initial.current)}</span></span>;
}
