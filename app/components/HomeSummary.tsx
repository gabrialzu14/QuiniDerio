"use client";
import "./home-summary.css";
import type {ReactNode} from "react";
import {AnimatedNumber} from "./DynamicMotion";

export type RankingDestination="pot"|"hits"|"self";

type Standing={username:string;hits:number};
type Props={
  round:number; submitted:boolean; totalPot:number;
  leader?:Standing; myRank:Standing|null; position:number|null;
  stage:"open"|"live"|"finished";
  onQuiniela:()=>void; onRanking:(destination:RankingDestination)=>void;
};

export default function HomeSummary({round,submitted,totalPot,leader,myRank,position,stage,onQuiniela,onRanking}:Props){
  const action=submitted?"Revisar mi quiniela":"Hacer mi quiniela";
  return <section className="qdOverviewSummary" aria-label="Resumen de tu quiniela">
    <article className={"qdOverviewFeature qdHeroSport "+(submitted?"is-submitted":"is-pending")}>
      <div className="qdHeroSportBackdrop" aria-hidden="true"/>
      <div className="qdHeroSportContent">
        <span className="qdHeroSportSeason">TEMPORADA 2026/27</span>
        <h1 className="qdHeroSportTitle">Jornada {round}</h1>
        <span className={"qdHeroSportStatus "+(submitted?"submitted":"pending")}>
          <span className="qdHeroSportStatusIcon" aria-hidden="true">{submitted?<svg className="qdHeroSportCheck" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d="m5 12.5 4.5 4.4L19 7.5"/></svg>:"!"}</span>
          <span>{submitted?"Quiniela enviada":"Quiniela pendiente"}</span>
        </span>
        <div className="qdHeroSportStages" aria-label="Estado de la jornada">
          {([{key:"open",name:"Abierta"},{key:"live",name:"En juego"},{key:"finished",name:"Finalizada"}] as const).map((item,i)=>{
            const stages=["open","live","finished"];
            const passed=stages.indexOf(stage)>i;
            const current=stage===item.key;
            return <span className={"qdHeroSportStage "+(current?"active":passed?"completed":"")} key={item.key} aria-current={current?"step":undefined}>
              <span className="qdHeroSportStageDot">{current?"●":passed?"✓":"○"}</span><small>{item.name}</small>
            </span>;
          })}
        </div>
        <button type="button" className="qdOverviewCta qdHeroSportCta" onClick={onQuiniela}>{action}<Arrow/></button>
      </div>
    </article>
    <div className="qdOverviewStats">
      <Stat label="Bote acumulado" value={`${totalPot.toLocaleString("es-ES")} €`} visual={<AnimatedNumber value={totalPot} suffix=" €"/>} detail="Bote total" icon="pot" onClick={()=>onRanking("pot")}/>
      <Stat label="Líder actual" value={leader?.username||"—"} detail={leader?`${leader.hits} PTS`:"Clasificación general"} detailVisual={leader?<AnimatedNumber value={leader.hits} suffix=" PTS"/>:undefined} icon="leader" onClick={()=>onRanking("hits")}/>
      <Stat label="Tu posición" value={position!==null?`${position}º`:"—"} detail={myRank?`${myRank.hits} PTS`:"Sin posición disponible"} visual={position!==null?<AnimatedNumber value={position} suffix="º"/>:undefined} detailVisual={myRank?<AnimatedNumber value={myRank.hits} suffix=" PTS"/>:undefined} icon="rank" onClick={()=>onRanking("self")}/>
    </div>
  </section>;
}
function Stat({label,value,detail,visual,detailVisual,icon,onClick}:{label:string;value:string;detail:string;visual?:ReactNode;detailVisual?:ReactNode;icon:"pot"|"leader"|"rank";onClick:()=>void}){
  return <button type="button" className={"qdOverviewStat qdOverviewStat-"+icon+(icon==="pot"&&value.length>9?" qdOverviewStat-compact":"")} onClick={onClick} aria-label={`${label}: ${value}. ${detail}. Ver clasificación`}>
    <span className="qdOverviewStatHead"><span className="qdOverviewStatLabel">{label}</span><SummaryIcon kind={icon}/></span>
    <strong title={value}>{visual??value}</strong><span className="qdOverviewStatDetail">{detailVisual??detail}<Arrow/></span>
  </button>;
}
function Arrow(){return <svg className="qdOverviewArrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>}
function SummaryIcon({kind}:{kind:"target"|"pot"|"leader"|"rank"}){
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind==="target"?<><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="m12 12 8-8m-4 0h4v4"/></>:kind==="pot"?<><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 4 16 4 16 0V6M4 12v6c0 4 16 4 16 0v-6"/></>:kind==="leader"?<><path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm4 10v5m-4 3h8m-6-3h4M8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4"/></>:<><path d="M4 21V11h4v10m2 0V4h4v17m2 0v-7h4v7"/></>}
  </svg>;
}
