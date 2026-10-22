"use client";
import {useEffect,useLayoutEffect,useRef,useState,type RefObject} from "react";

const targets=[
 ".predictionOwnerSection", ".rivalPredictionBlock", ".predictionSectionTitle", ".predictionSectionTitle small", ".predictionSectionTitle h2", ".rivalPlayerBanner", ".rivalPlayerBanner>.rankingAvatar", ".rivalPlayerBanner>div>*",
 ".seasonSticker", ".stickerPhoto", ".stickerPhoto>span", ".stickerCopy>small", ".stickerCopy>strong", ".stickerCopy>b",
 ".miniSticker>small", ".miniSticker>strong", ".miniSticker>b", ".dinioSticker>img", ".dinioSticker>div>*",
 ".matchRivalsCard", ".matchRivalsTeam", ".matchRivalsTeam>.crestBox", ".matchRivalsTeamName", ".matchRivalsDate", ".matchRivalsScore", ".matchRivalsVenue",
 ".matchRivalsPlayers>li", ".matchRivalsPlayers>li>.rankingAvatar", ".matchRivalsPlayers>li>b", ".matchRivalsPlayers>li>strong",
 ".rankingRow", ".qdPlayerRoundMatch", ".qdCardsRow"
].join(",");
const imageParts=".stickerPhoto,.dinioSticker>img,.rankingAvatar,.crestBox";
const labelParts=".stickerPhoto>span,.stickerCopy>small,.miniSticker>small,.dinioSticker small,.matchRivalsDate,.matchRivalsVenue,.predictionSectionTitle small,.rivalPlayerBanner small";
const valueParts=".stickerCopy>strong,.miniSticker>strong,.dinioSticker strong,.matchRivalsScore,.matchRivalsPlayers>li>strong";
/** Each card AND each content part waits for its own viewport intersection. */
export function useScrollReveal(root:RefObject<HTMLElement|null>){
 useLayoutEffect(()=>{
  const node=root.current;
  if(!node||!("IntersectionObserver" in window))return;
  const motion=window.matchMedia("(prefers-reduced-motion: reduce)");
  const seen=new WeakSet<Element>();
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting){entry.target.setAttribute("data-qd-reveal","shown");observer.unobserve(entry.target)}
  },{threshold:0,rootMargin:"0px 0px -40px 0px"});
  const scan=()=>node.querySelectorAll(targets).forEach(element=>{
   if(seen.has(element))return;seen.add(element);
   const part=element.matches(imageParts)?"image":element.matches(labelParts)?"label":element.matches(valueParts)?"value":element.matches(".stickerCopy>b,.miniSticker>b,.dinioSticker b,.matchRivalsPlayers>li>b,.matchRivalsTeamName,.predictionSectionTitle h2,.rivalPlayerBanner b")?"text":"card";
   element.setAttribute("data-qd-stage",part);
   if(motion.matches||element.getBoundingClientRect().bottom<0){element.setAttribute("data-qd-reveal","shown");return}
   element.setAttribute("data-qd-reveal","waiting");observer.observe(element);
  });
  scan();
  const mutations=new MutationObserver(records=>{if(records.some(record=>Array.from(record.addedNodes).some(added=>added.nodeType===1)))scan()});
  mutations.observe(node,{childList:true,subtree:true});
  const reduce=()=>{if(motion.matches)node.querySelectorAll('[data-qd-reveal="waiting"]').forEach(element=>{element.setAttribute("data-qd-reveal","shown");observer.unobserve(element)})};
  motion.addEventListener("change",reduce);
  return()=>{observer.disconnect();mutations.disconnect();motion.removeEventListener("change",reduce);node.querySelectorAll("[data-qd-reveal]").forEach(element=>{element.removeAttribute("data-qd-reveal");element.removeAttribute("data-qd-stage")})};
 },[root]);
}

export function AnimatedNumber({value,suffix="",prefix="",decimals=0}:{value:number;suffix?:string;prefix?:string;decimals?:number}){
 const root=useRef<HTMLSpanElement>(null);
 const previous=useRef(0);
 const [visible,setVisible]=useState(false);
 const safe=Number.isFinite(value)?value:0;
 const format=(number:number)=>prefix+number.toLocaleString("es-ES",{minimumFractionDigits:decimals,maximumFractionDigits:decimals})+suffix;
 useEffect(()=>{
  const node=root.current;if(!node)return;
  if(!("IntersectionObserver" in window)){setVisible(true);return}
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect()}},{threshold:.05});
  observer.observe(node);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  const node=root.current;if(!node||!visible)return;
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){node.textContent=format(safe);previous.current=safe;return}
  const from=previous.current,change=safe-from;
  if(Math.abs(change)<.00001){node.textContent=format(safe);return}
  let frame=0,start:number|null=null;
  // Smooth start/end, with enough time to read each change; no abrupt counter jumps.
  const duration=Math.max(750,Math.min(1100,820+Math.log1p(Math.abs(change))*65));
  const tick=(time:number)=>{
   if(start===null)start=time;
   const p=Math.min(1,(time-start)/duration);
   const eased=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
   const current=from+change*eased;
   node.textContent=format(p===1?safe:decimals?current:Math.round(current));
   previous.current=p===1?safe:current;
   if(p<1)frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
  return()=>cancelAnimationFrame(frame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[safe,visible,prefix,suffix,decimals]);
 return <span className="qdAnimatedNumber" aria-label={format(safe)}><span aria-hidden="true" ref={root}>{format(0)}</span></span>;
}
