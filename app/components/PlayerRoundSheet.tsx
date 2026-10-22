"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {useScrollReveal} from "./DynamicMotion";
import usePageScrollLock from "./usePageScrollLock";
import {supabase} from "../lib/supabase";
import type {Fixture} from "../lib/quiz-fixtures";
import "./player-round-sheet.css";

type MatchRow={team:string;home_score:number|null;away_score:number|null;status:string};
type Player={user_id:string;username:string;profile_pic?:string};
type Props={player:Player;initialRound:number;rounds:number[];maxRound:number;fixtures:Record<number,Record<string,Partial<Fixture>>>;onClose:()=>void};
type SheetData={rows:MatchRow[];picks:Record<string,string>;blocked:boolean};
const cache=new Map<string,SheetData&{expiresAt:number}>();
const crestCache=new Map<string,string>();
const resultChoice=(home:number,away:number):string=>home>away?"1":home<away?"2":"X";
const dateOrder=(game:Partial<Fixture>)=>{
 if(!game.date)return Number.MAX_SAFE_INTEGER;
 const [d,m,y]=game.date.split("/").map(Number);
 const [h,min]=(game.time||"23:59").split(":").map(Number);
 return new Date(y,m-1,d,h,min).getTime()||Number.MAX_SAFE_INTEGER;
};
/** Crop transparent image margins, retaining aspect ratio and original alpha. */
function cropTransparentCrest(image:HTMLImageElement){
 const canvas=document.createElement("canvas"),w=image.naturalWidth,h=image.naturalHeight;
 if(!w||!h||w*h>16000000)return null;
 canvas.width=w;canvas.height=h;
 const context=canvas.getContext("2d",{willReadFrequently:true});if(!context)return null;
 context.drawImage(image,0,0,w,h);
 const pixels=context.getImageData(0,0,w,h).data;
 let left=w,top=h,right=-1,bottom=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  if(pixels[(y*w+x)*4+3]<24)continue;
  if(x<left)left=x;if(x>right)right=x;if(y<top)top=y;if(y>bottom)bottom=y;
 }
 if(right<left||bottom<top)return null;
 const pad=Math.ceil(Math.max(right-left+1,bottom-top+1)*.045);
 const x=Math.max(0,left-pad),y=Math.max(0,top-pad);
 const width=Math.min(w-x,right-left+1+pad*2),height=Math.min(h-y,bottom-top+1+pad*2);
 // Avoid regenerating essentially uncropped images and unnecessary data URLs.
 if(width>=w*.96&&height>=h*.96)return null;
 const trimmed=document.createElement("canvas");trimmed.width=width;trimmed.height=height;
 trimmed.getContext("2d")?.drawImage(canvas,x,y,width,height,0,0,width,height);
 return trimmed.toDataURL("image/png");
}
function TeamCrest({src,name}:{src:string;name:string}){
 const [broken,setBroken]=useState(false);
 const [imageSrc,setImageSrc]=useState(()=>crestCache.get(src)||src);
 useEffect(()=>{setBroken(false);setImageSrc(crestCache.get(src)||src)},[src]);
 const normalized=useCallback((image:HTMLImageElement)=>{
  if(imageSrc!==src||crestCache.has(src))return;
  try{
   const cropped=cropTransparentCrest(image);
   crestCache.set(src,cropped||src);
   if(cropped)setImageSrc(cropped);
  }catch{crestCache.set(src,src);}
 },[src,imageSrc]);
 return <span className="qdPlayerCrestFrame">
  {src&&!broken?<img className="qdPlayerMatchCrest" loading="lazy" src={imageSrc} alt="" onLoad={event=>normalized(event.currentTarget)} onError={()=>setBroken(true)}/>:<span className="qdPlayerCrestFallback" aria-hidden="true">{name.slice(0,2)}</span>}
 </span>;
}
export default function PlayerRoundSheet({player,initialRound,rounds,maxRound,fixtures,onClose}:Props){
 usePageScrollLock(true);
 const motionRoot=useRef<HTMLElement>(null);
 const scrollRoot=useRef<HTMLDivElement>(null);
 useScrollReveal(motionRoot);
 const [round,setRound]=useState(initialRound);
 const [direction,setDirection]=useState<"next"|"prev">("next");
 const [exiting,setExiting]=useState(false);
 const switchTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const validatedViewer=useRef<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [loadedKey,setLoadedKey]=useState("");
 const [blocked,setBlocked]=useState(false);
 const [error,setError]=useState(false);
 const [rows,setRows]=useState<MatchRow[]>([]);
 const [picks,setPicks]=useState<Record<string,string>>({});
 const key=player.user_id+":"+round;
 useEffect(()=>{setRound(initialRound);setExiting(false)},[player.user_id,initialRound]);
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};
  document.addEventListener("keydown",onKey);
  return()=>{document.removeEventListener("keydown",onKey);if(switchTimer.current)clearTimeout(switchTimer.current)};
 },[onClose]);
 const selectRound=(next:number)=>{
  if(next===round||next>maxRound)return;
  if(switchTimer.current)clearTimeout(switchTimer.current);
  setDirection(next>round?"next":"prev");
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setRound(next);setExiting(false);return}
  setExiting(true);
  switchTimer.current=setTimeout(()=>{setRound(next);setExiting(false)},175);
 };
 useEffect(()=>{
  let live=true;
  // The first round validates auth; revisiting one during the same verified
  // modal session can restore its short-lived snapshot without a loading flash.
  const recent=validatedViewer.current?cache.get(validatedViewer.current+":"+key):null;
  if(recent&&recent.expiresAt>Date.now()){
   setRows(recent.rows);setPicks(recent.picks);setBlocked(recent.blocked);
   setLoadedKey(key);setError(false);setLoading(false);
   return;
  }
  setLoading(true);setError(false);setBlocked(false);setRows([]);setPicks({});
  void (async()=>{
   try{
    // Always validate the current viewer before reusing any cached private picks.
    const {data:{user},error:authError}=await supabase.auth.getUser();
    if(!live)return;
    if(authError||!user)throw new Error("Consulta no autorizada");
    validatedViewer.current=user.id;
    const cacheKey=user.id+":"+key;
    const saved=cache.get(cacheKey);
    if(saved&&saved.expiresAt>Date.now()){
     setRows(saved.rows);setPicks(saved.picks);setBlocked(saved.blocked);setLoadedKey(key);
     return;
    }
    const {data:matches,error:matchError}=await supabase.from("quini_live_matches").select("team,home_score,away_score,status").eq("round",round);
    if(!live)return;
    if(matchError)throw matchError;
    const started=(matches||[]).some(m=>["live","finished","final"].includes(m.status));
    if(user.id!==player.user_id&&!started){setBlocked(true);setLoadedKey(key);return;}
    const {data:forecast,error:forecastError}=await supabase.from("quini_picks").select("team,pick").eq("user_id",player.user_id).eq("round",round);
    if(!live)return;
    if(forecastError)throw forecastError;
    const indexed:Record<string,string>={};
    for(const item of forecast||[])if(["1","X","2"].includes(item.pick))indexed[item.team]=item.pick;
    const loaded={rows:(matches||[]) as MatchRow[],picks:indexed,blocked:false};
    cache.set(cacheKey,{...loaded,expiresAt:Date.now()+45000});
    setPicks(loaded.picks);setRows(loaded.rows);setLoadedKey(key);
   }catch{if(live){setError(true);setLoadedKey(key)}}
   finally{if(live)setLoading(false)}
  })();
  return()=>{live=false};
 },[round,player.user_id,key]);
 useEffect(()=>{if(scrollRoot.current)scrollRoot.current.scrollTop=0},[round]);
 useEffect(()=>{
  const {data}=supabase.auth.onAuthStateChange(event=>{
   if(event==="SIGNED_OUT"){validatedViewer.current=null;cache.clear();onClose()}
  });
  return()=>data.subscription.unsubscribe();
 },[onClose]);
 const entries=useMemo(()=>Object.entries(fixtures[round]||{}).filter(([,game])=>game.status!=="rest").sort((a,b)=>dateOrder(a[1])-dateOrder(b[1])),[fixtures,round]);
 const results=useMemo(()=>new Map(rows.map(item=>[item.team,item])),[rows]);
 return createPortal(<div className="playerStatsOverlay qdPlayerRoundOverlay" onClick={onClose}>
  <section ref={motionRoot} role="dialog" aria-modal="true" aria-label={"Jornada "+round+" de "+player.username} className="playerStatsModal qdPlayerRoundModal" onClick={event=>event.stopPropagation()}>
   <header className="qdPlayerRoundHeader">
    <div className="playerStatsIdentity">
     <span className="playerStatsAvatar">{player.profile_pic?<img src={player.profile_pic} alt=""/>:player.username.slice(0,1).toUpperCase()}</span>
     <div><h2>{player.username}</h2><p>Jornada {round}</p></div>
    </div>
    <button type="button" aria-label="Cerrar" onClick={onClose}>×</button>
   </header>
   <div className="qdPlayerRoundTabs" role="group" aria-label="Seleccionar jornada">
    {rounds.map(n=><button key={n} type="button" className={round===n?"active":""} aria-pressed={round===n} disabled={n>maxRound} onClick={()=>selectRound(n)}>J{n}</button>)}
   </div>
   <div ref={scrollRoot} className={"qdPlayerRoundViewport "+(exiting?"is-exiting ":"")+(direction==="prev"?"is-prev":"is-next")}>
    {loading||loadedKey!==key?<div className="qdPlayerRoundLoading" role="status" aria-live="polite"><span/><span/><span/><p>Cargando jornada…</p></div>:blocked?<p className="qdPlayerRoundMessage">Los pronósticos de este participante estarán disponibles cuando comience la jornada.</p>:error?<p className="qdPlayerRoundMessage" role="alert">No se han podido consultar los pronósticos de esta jornada.</p>:<div className="qdPlayerRoundMatches" key={round}>
     {entries.length?entries.map(([team,game],index)=>{
      const match=results.get(team);
      const isHome=game.isHome!==false;
      const own=game.teamLabel||team;
      const rival=game.opponent||"Rival pendiente";
      const home=isHome?own:rival,away=isHome?rival:own;
      const ownCrest="/api/assets/Escudos/cd_derio.png";
      const rivalCrest=game.crest?.startsWith("/api/assets/Escudos/")?game.crest:"";
      const final=match&&["finished","final"].includes(match.status)&&Number.isFinite(match.home_score)&&Number.isFinite(match.away_score);
      const actual=final?resultChoice(Number(match.home_score),Number(match.away_score)):null;
      const pick=picks[team]||null;
      const correct=actual!==null&&pick===actual;
      const incorrect=actual!==null&&!!pick&&pick!==actual;
      return <article key={team} style={{"--qd-card-index":Math.min(index,12)} as React.CSSProperties} className={"qdPlayerRoundMatch "+(correct?"correct":incorrect?"incorrect":"")}>
       <div className="qdPlayerRoundKick">{game.date||"Fecha pendiente"} <span>·</span> {game.time||"Hora pendiente"}</div>
       <div className="qdPlayerRoundScoreline">
        <div className="qdPlayerRoundTeam"><TeamCrest src={isHome?ownCrest:rivalCrest} name={home}/><span>{home}</span></div>
        <strong>{final?String(match!.home_score)+" – "+String(match!.away_score):"—"}</strong>
        <div className="qdPlayerRoundTeam"><TeamCrest src={isHome?rivalCrest:ownCrest} name={away}/><span>{away}</span></div>
       </div>
       <div className="qdPlayerRoundFoot">
        <span className="qdPlayerPredictionCapsule">
         <span className="qdPlayerPredictionLabel">TU PRONÓSTICO</span>
         <b aria-label={(correct?"Pronóstico acertado: ":incorrect?"Pronóstico fallado: ":"Pronóstico: ")+(pick||"sin pronóstico")} className={"qdPlayerPick "+(pick?"pick"+pick:"")}>{pick||"—"}</b>
         {(correct||incorrect)&&<span className={"qdPlayerPickVerdict "+(correct?"hit":"miss")} aria-label={correct?"Acierto":"Error"}>{correct?"✓":"×"}</span>}
        </span>
        <span className={"qdPlayerPickState "+(correct?"hit":incorrect?"miss":"")}>{correct||incorrect?null:match?.status==="suspended"?"Suspendido":final?"Sin pronóstico":"Pendiente"}</span>
       </div>
      </article>;
     }):<p className="qdPlayerRoundMessage">No hay partidos disponibles para esta jornada.</p>}
    </div>}
   </div>
  </section>
 </div>,document.body);
}
