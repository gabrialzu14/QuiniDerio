"use client";
import {useEffect,useMemo,useState} from "react";
import {createPortal} from "react-dom";
import {supabase} from "../lib/supabase";
import type {Fixture} from "../lib/quiz-fixtures";

type MatchRow={team:string;home_score:number|null;away_score:number|null;status:string};
type Player={user_id:string;username:string;profile_pic?:string};
type Props={player:Player;initialRound:number;rounds:number[];fixtures:Record<number,Record<string,Partial<Fixture>>>;onClose:()=>void};

const resultChoice=(home:number,away:number):string=>home>away?"1":home<away?"2":"X";
const dateOrder=(game:Partial<Fixture>)=>{
  if(!game.date)return Number.MAX_SAFE_INTEGER;
  const [d,m,y]=game.date.split("/").map(Number);
  const [h,min]=(game.time||"23:59").split(":").map(Number);
  return new Date(y,m-1,d,h,min).getTime()||Number.MAX_SAFE_INTEGER;
};
function TeamCrest({src,name}:{src:string;name:string}){
 const [broken,setBroken]=useState(false);
 useEffect(()=>setBroken(false),[src]);
 return src&&!broken?<img className="qdPlayerMatchCrest" loading="lazy" src={src} alt="" onError={()=>setBroken(true)}/>:<span className="qdPlayerCrestFallback" aria-hidden="true">{name.slice(0,2)}</span>;
}
export default function PlayerRoundSheet({player,initialRound,rounds,fixtures,onClose}:Props){
 const [round,setRound]=useState(initialRound);
 const [loading,setLoading]=useState(true);
 const [blocked,setBlocked]=useState(false);
 const [error,setError]=useState(false);
 const [rows,setRows]=useState<MatchRow[]>([]);
 const [picks,setPicks]=useState<Record<string,string>>({});
 useEffect(()=>setRound(initialRound),[player.user_id,initialRound]);
 useEffect(()=>{
  let live=true;
  setLoading(true);setError(false);setBlocked(false);setRows([]);setPicks({});
  void (async()=>{
    try{
      const [{data:matches,error:matchError},{data:{user},error:authError}]=await Promise.all([
        supabase.from("quini_live_matches").select("team,home_score,away_score,status").eq("round",round),
        supabase.auth.getUser()
      ]);
      if(!live)return;
      if(matchError||authError||!user)throw new Error("Consulta no autorizada");
      const started=(matches||[]).some(m=>["live","finished","final"].includes(m.status));
      if(user.id!==player.user_id&&!started){setBlocked(true);return;}
      const {data:forecast,error:forecastError}=await supabase.from("quini_picks").select("team,pick").eq("user_id",player.user_id).eq("round",round);
      if(!live)return;
      if(forecastError)throw forecastError;
      const indexed:Record<string,string>={};
      for(const item of forecast||[]) if(["1","X","2"].includes(item.pick))indexed[item.team]=item.pick;
      setPicks(indexed);
      setRows((matches||[]) as MatchRow[]);
    }catch{if(live)setError(true);}
    finally{if(live)setLoading(false);}
  })();
  return ()=>{live=false;};
 },[round,player.user_id]);

 const entries=useMemo(()=>Object.entries(fixtures[round]||{}).filter(([,game])=>game.status!=="rest").sort((a,b)=>dateOrder(a[1])-dateOrder(b[1])),[fixtures,round]);
 const results=useMemo(()=>new Map(rows.map(item=>[item.team,item])),[rows]);
 return createPortal(<div className="playerStatsOverlay qdPlayerRoundOverlay" onClick={onClose}>
  <section role="dialog" aria-modal="true" aria-label={"Jornada "+round+" de "+player.username} className="playerStatsModal qdPlayerRoundModal" onClick={event=>event.stopPropagation()}>
    <header className="qdPlayerRoundHeader">
      <div className="playerStatsIdentity">
        <span className="playerStatsAvatar">{player.profile_pic?<img src={player.profile_pic} alt=""/>:player.username.slice(0,1).toUpperCase()}</span>
        <div><h2>{player.username}</h2><p>Jornada {round}</p></div>
      </div>
      <button type="button" aria-label="Cerrar" onClick={onClose}>×</button>
    </header>
    <div className="qdPlayerRoundTabs" role="group" aria-label="Seleccionar jornada">
      {rounds.map(n=><button key={n} type="button" className={round===n?"active":""} aria-pressed={round===n} onClick={()=>setRound(n)}>J{n}</button>)}
    </div>
    {loading?<p role="status" className="qdPlayerRoundMessage">Cargando jornada…</p>:blocked?<p className="qdPlayerRoundMessage">Los pronósticos de este participante estarán disponibles cuando comience la jornada.</p>:error?<p className="qdPlayerRoundMessage" role="alert">No se han podido consultar los pronósticos de esta jornada.</p>:<div className="qdPlayerRoundMatches" key={round}>
      {entries.length?entries.map(([team,game])=>{
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
        return <article key={team} className={"qdPlayerRoundMatch "+(correct?"correct":incorrect?"incorrect":"")}>
          <div className="qdPlayerRoundKick">{game.date||"Fecha pendiente"} · {game.time||"Hora pendiente"}</div>
          <div className="qdPlayerRoundScoreline">
            <div><TeamCrest src={isHome?ownCrest:rivalCrest} name={home}/><span>{home}</span></div>
            <strong>{final?String(match!.home_score)+" – "+String(match!.away_score):"—"}</strong>
            <div><TeamCrest src={isHome?rivalCrest:ownCrest} name={away}/><span>{away}</span></div>
          </div>
          <div className="qdPlayerRoundFoot"><span>Pronóstico <b className={"qdPlayerPick "+(pick?"pick"+pick:"")}>{pick||"—"}</b></span><span className={"qdPlayerPickState "+(correct?"hit":incorrect?"miss":"")}>{correct?"✓ Acierto":incorrect?"× Fallo":match?.status==="suspended"?"Suspendido":final?"Sin pronóstico":"Pendiente"}</span></div>
        </article>;
      }):<p className="qdPlayerRoundMessage">No hay partidos disponibles para esta jornada.</p>}
    </div>}
  </section>
 </div>,document.body);
}
