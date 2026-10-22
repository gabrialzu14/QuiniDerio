"use client";
import {useEffect,useRef} from "react";

type Props={home:number|null|undefined;away:number|null|undefined;status?:string};
/** The displayed text is always an actual snapshot; never count through invented goals. */
export default function MatchScore({home,away,status}:Props){
 const root=useRef<HTMLSpanElement>(null);
 const available=["live","halftime","finished","final","suspended"].includes(status||"")&&typeof home==="number"&&Number.isFinite(home)&&typeof away==="number"&&Number.isFinite(away);
 const text=available?`${home}\u00a0–\u00a0${away}`:"vs";
 const previous=useRef(text);
 useEffect(()=>{
  const changed=previous.current!==text;previous.current=text;
  if(!changed||!root.current?.animate||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const animation=root.current.animate([{opacity:.25,translate:"0 6px"},{opacity:1,translate:"0 0"}],{duration:360,easing:"cubic-bezier(.2,.75,.25,1)"});
  return()=>animation.cancel();
 },[text]);
 return <span className="matchRivalsScore" aria-label={available?`Marcador: ${home} a ${away}`:"Partido pendiente"}><span className="qdScoreValue" ref={root}>{text}</span></span>;
}
