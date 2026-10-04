"use client";
import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";
const ADMIN="gabrialzueta@gmail.com";
type Match={round:number,team:string,opponent:string,home_score:number,away_score:number,yellow_cards:number,red_cards:number,status:"scheduled"|"live"|"finished"|"suspended"};
const HOME:Record<string,boolean>={"Derio A":true,"Derio B":true,"Derio Fem":false,"Derio Fem B":false,"Juvenil A":false,"Juvenil B":true};
type Card={id:string,round:number,team:string,person:string,card_type:"yellow"|"red",created_at:string};
const STAFF:Record<string,string[]>={
 "Derio A":["Nando Alonso","Julen de Miguel","Gabri Alzueta"],
 "Derio B":["Gorka Barrio","David Perez","Mikel Elejalde"],
 "Derio Fem":["Iker Ibarluzea","Galder Ferreiro","Omar El Kabouri"],
 "Derio Fem B":["Ibai Mateos","Eneko Sanchez","Aner Taranilla"],
 "Juvenil A":["Peio Garcia","Koldo Corral"],
 "Juvenil B":["Mikel Tara","Asel Ibañez"],
 "Cadete B":["Gaizka Garcia","Galder Carreras"]
};
export default function AdminPage(){
 const[allowed,setAllowed]=useState<boolean|null>(null);
 const[matches,setMatches]=useState<Match[]>([]);
 const[cards,setCards]=useState<Card[]>([]);
 const[busy,setBusy]=useState("");
 const[pending,setPending]=useState<{username:string,count:number}[]>([]);
 const[picker,setPicker]=useState<{team:string,type:"yellow"|"red"}|null>(null);

 const load=async()=>{
  const [{data},{data:cardRows},{data:profiles},{data:picks}]=await Promise.all([
   supabase.from("quini_live_matches").select("*").eq("round",1).order("team"),
   supabase.from("quini_match_cards").select("*").eq("round",1).order("created_at",{ascending:true}),
   supabase.from("quini_profiles").select("user_id,username").eq("completed",true),
   supabase.from("quini_picks").select("user_id,team").eq("round",1)
  ]);
  setMatches((data||[]) as Match[]);
  setCards((cardRows||[]) as Card[]);
  const teams=["Derio A","Derio B","Derio Fem","Derio Fem B","Juvenil A","Juvenil B"];
  const rows=(profiles||[]).map((p:any)=>{const done=new Set((picks||[]).filter((x:any)=>x.user_id===p.user_id).map((x:any)=>x.team));return{username:p.username||"Participante",count:teams.filter(t=>!done.has(t)).length}}).filter((p:any)=>p.count>0).sort((a:any,b:any)=>b.count-a.count);
  setPending(rows);
 };
 useEffect(()=>{let active=true;const verify=async()=>{const {data:{session}}=await supabase.auth.getSession();let user=session?.user||null;if(session){const fresh=await supabase.auth.getUser();user=fresh.data.user||user}const ok=user?.email?.trim().toLowerCase()===ADMIN;if(!active)return;setAllowed(ok);if(ok)await load()};void verify();const {data:listener}=supabase.auth.onAuthStateChange(()=>void verify());return()=>{active=false;listener.subscription.unsubscribe()}},[]);
 const act=async(team:string,action:string,extra:Record<string,unknown>={},reload=true)=>{setBusy(team+action);const {data:{session}}=await supabase.auth.getSession();const res=await fetch("/api/admin/live",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session?.access_token},body:JSON.stringify({round:1,team,action,...extra})});if(res.ok&&reload)await load();setBusy("");return res.ok};
 const addCard=async(team:string,type:"yellow"|"red",person:string)=>{if(await act(team,"addCard",{cardType:type,person}))setPicker(null)};
 if(allowed===null)return <main className="adminGate"/>;
 if(!allowed)return <main className="adminGate"><section><h1>Acceso restringido</h1><p>Este panel no está disponible para esta cuenta.</p><button onClick={()=>location.href="/"}>Volver a QuiniDerio</button></section></main>;
 return <main className="adminPage"><header><button onClick={()=>location.href="/"}>‹ Volver</button><div><small>QUINIDERIO</small><h1>Panel Admin</h1></div></header><section className="adminHero"><span>JORNADA 1</span><h2>Control en directo</h2><p>Resultados y tarjetas se comparten con todos los usuarios.</p></section><div className="adminGrid">{matches.map(m=>{const teamCards=cards.filter(c=>c.team===m.team);const isHome=HOME[m.team]!==false;const home=isHome?m.team:m.opponent;const away=isHome?m.opponent:m.team;return <article key={m.team}><div><small>{m.status==="live"?"EN JUEGO":m.status==="finished"?"FINALIZADO":m.status==="suspended"?"SUSPENDIDO":"PARTIDO"}</small><h3>{home} · {away}</h3><p className="adminVenueOrder"><b>LOCAL</b> {home} <span>·</span> <b>VISITANTE</b> {away}</p></div><div className="adminScore"><div><button aria-label="Quitar gol local" disabled={!!busy||m.status==="finished"||m.home_score<=0} onClick={()=>act(m.team,"homeGoalRemove")}>−</button><button aria-label="Añadir gol local" disabled={!!busy||m.status==="finished"} onClick={()=>act(m.team,"homeGoal")}>+</button></div><strong>{m.home_score} - {m.away_score}</strong><div><button aria-label="Quitar gol visitante" disabled={!!busy||m.status==="finished"||m.away_score<=0} onClick={()=>act(m.team,"awayGoalRemove")}>−</button><button aria-label="Añadir gol visitante" disabled={!!busy||m.status==="finished"} onClick={()=>act(m.team,"awayGoal")}>+</button></div></div><div className="adminActions"><button disabled={!!busy||m.status!=="scheduled"} onClick={()=>act(m.team,"start")}>Iniciar partido</button><button disabled={!!busy||m.status!=="live"} onClick={()=>setPicker(picker?.team===m.team&&picker.type==="yellow"?null:{team:m.team,type:"yellow"})}>Amarilla · {m.yellow_cards}</button><button disabled={!!busy||m.status!=="live"} onClick={()=>setPicker(picker?.team===m.team&&picker.type==="red"?null:{team:m.team,type:"red"})}>Roja · {m.red_cards}</button><button disabled={!!busy||m.status!=="live"} onClick={()=>{if(window.confirm("¿Finalizar este partido? Podrás reabrirlo desde el panel."))void act(m.team,"finish")}}>Finalizar</button>{m.status==="finished"&&<button disabled={!!busy} onClick={()=>{if(window.confirm("¿Reabrir este partido para corregirlo?"))void act(m.team,"reopen")}}>Reabrir</button>}</div>{picker?.team===m.team&&<div className={"adminCardPicker "+picker.type}><small>{picker.type==="yellow"?"AMARILLA":"ROJA"} · ¿A QUIÉN?</small><div>{(STAFF[m.team]||[]).map(person=><button key={person} disabled={!!busy} onClick={()=>void addCard(m.team,picker.type,person)}>{person}</button>)}</div></div>}{teamCards.length>0&&<div className="adminCardLog"><small>TARJETAS MOSTRADAS</small>{teamCards.map(card=><div key={card.id}><span className={"cardDot "+card.card_type}/><b>{card.person}</b><em>{card.card_type==="yellow"?"Amarilla":"Roja"}</em><button aria-label={"Eliminar tarjeta de "+card.person} disabled={!!busy} onClick={()=>{if(window.confirm("¿Eliminar esta tarjeta?"))void act(m.team,"removeCard",{cardId:card.id})}}>×</button></div>)}</div>}</article>})}</div><section className="adminPending"><div><h2>Pronósticos pendientes</h2><strong>{pending.length}</strong></div>{pending.length?<div className="adminPendingList">{pending.map(p=><span key={p.username}><b>{p.username}</b><em>{p.count} pendientes</em></span>)}</div>:<p>No hay participantes con pronósticos pendientes.</p>}</section><section className="adminBulk"><h2>Control de jornada</h2><p>Acciones globales para corregir o cerrar la jornada.</p><button disabled={!!busy||!matches.some(m=>m.status==="live")} onClick={()=>{if(window.confirm("¿Finalizar todos los partidos que están en juego?"))void (async()=>{setBusy("bulk");const live=matches.filter(m=>m.status==="live");for(const m of live)await act(m.team,"finish",{},false);await load();setBusy("")})()}}>Finalizar partidos en juego</button></section></main>
}