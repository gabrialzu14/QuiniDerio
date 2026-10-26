"use client";
import {useEffect,useRef,useState} from "react";
import {supabase} from "../lib/supabase";
import {ROUND_TEAMS,type RoundTeam} from "../lib/new-round";
import "./create-round.css";

type GameForm={
 team:RoundTeam;
 rest:boolean;
 isHome:boolean;
 opponent:string;
 date:string;
 time:string;
 venue:string;
 location:string;
 competition:string;
 federationRound:string;
 derioPosition:string;
 opponentPosition:string;
 derioPoints:string;
 opponentPoints:string;
 derioForm:string;
 opponentForm:string;
 crest:string;
 file:File|null;
};
const COMPETITIONS:Record<RoundTeam,string>={
 "Derio A":"3ª RFEF","Derio B":"Derio B","Derio Fem":"FEM Liga Vasca",
 "Derio Fem B":"FEM B","Juvenil A":"Juvenil A","Juvenil B":"Juvenil B","Cadete B":"Cadete B"
};
const makeInitial=():GameForm[]=>
 ROUND_TEAMS.map(team=>({
  team,rest:false,isHome:true,opponent:"",date:"",time:"",venue:"",location:"",
  competition:COMPETITIONS[team],federationRound:"",derioPosition:"",
  opponentPosition:"",derioPoints:"",opponentPoints:"",
  derioForm:"",opponentForm:"",crest:"",file:null
 }));
const textFieldNames=["opponent","venue","location","competition","federationRound","derioPosition","opponentPosition","derioPoints","opponentPoints","derioForm","opponentForm"] as const;
function CrestPreview({file,src}:{file:File|null,src:string}){
 const[objectUrl,setObjectUrl]=useState("");
 useEffect(()=>{
  if(!file){setObjectUrl("");return}
  const url=URL.createObjectURL(file);
  setObjectUrl(url);
  return()=>URL.revokeObjectURL(url);
 },[file]);
 return <div className="qdNewCrestPreview">
  {objectUrl||src?<img src={objectUrl||src} alt="Vista previa del escudo"/>:
   <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 22s8-4 8-11V4l-8-2-8 2v7c0 7 8 11 8 11Z"/><path d="m8 12 3 3 5-5"/></svg>}
 </div>;
}
export default function CreateRound({nextRound,onCreated}:{nextRound:number,onCreated:(round:number)=>void}){
 const[round,setRound]=useState(nextRound);
 const[games,setGames]=useState<GameForm[]>(makeInitial);
 const[busy,setBusy]=useState(false);
 const[progress,setProgress]=useState("");
 const[error,setError]=useState("");
 const[expanded,setExpanded]=useState<RoundTeam[]>([...ROUND_TEAMS]);
 const ready=useRef(false);
 const submitLock=useRef(false);
 useEffect(()=>{setRound(nextRound);setGames(makeInitial());ready.current=false},[nextRound]);
 useEffect(()=>{
  if(!ready.current){
   try{
    const saved=localStorage.getItem("qd-admin-round-draft-"+round);
    if(saved){
     const parsed=JSON.parse(saved);
     if(Array.isArray(parsed)&&parsed.length===ROUND_TEAMS.length&&
        parsed.every((g:GameForm,i:number)=>g.team===ROUND_TEAMS[i])){
      setGames(parsed.map((g:GameForm)=>({...g,file:null})));
     }
    }
   }catch{}
   ready.current=true;
  }
 },[round]);
 useEffect(()=>{
  if(!ready.current||busy)return;
  const id=window.setTimeout(()=>{
   try{localStorage.setItem("qd-admin-round-draft-"+round,JSON.stringify(games.map(({file,...rest})=>rest)))}catch{}
  },350);
  return()=>window.clearTimeout(id);
 },[games,round,busy]);
 const refreshDerioForms=async()=>{
  // A round's saved form describes the five games BEFORE that fixture.
  // Use that snapshot as a historical baseline, then append completed results.
  const {data,error}=await supabase.from("quini_live_matches")
   .select("round,team,is_home,home_score,away_score,status,fixture_details")
   .lt("round",round).order("round",{ascending:true});
  if(error)throw error;
  const forms=new Map<RoundTeam,string>();
  for(const team of ROUND_TEAMS){
   const fixtures=(data||[]).filter(match=>match.team===team);
   let history="";
   for(const match of fixtures){
    const snapshot=typeof match.fixture_details?.derioForm==="string"
     ?match.fixture_details.derioForm.toUpperCase().replace(/[^VED]/g,"").slice(-5):"";
    if(snapshot.length>history.length)history=snapshot;
    if(match.status!=="finished"||typeof match.is_home!=="boolean"||
       match.home_score===null||match.away_score===null)continue;
    const ours=Number(match.is_home?match.home_score:match.away_score);
    const theirs=Number(match.is_home?match.away_score:match.home_score);
    if(!Number.isFinite(ours)||!Number.isFinite(theirs))continue;
    history=(history+(ours>theirs?"V":ours<theirs?"D":"E")).slice(-5);
   }
   if(history)forms.set(team,history);
  }
  setGames(previous=>previous.map(game=>forms.has(game.team)?{...game,derioForm:forms.get(game.team)!}:game));
  return forms;
 };
 useEffect(()=>{
  const timer=window.setTimeout(()=>{
   if(ready.current)void refreshDerioForms().catch(()=>setError("No se ha podido actualizar automáticamente la forma del Derio."));
  },0);
  return()=>window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[round]);
 const edit=(team:RoundTeam,patch:Partial<GameForm>)=>
  setGames(prev=>prev.map(g=>g.team===team?{...g,...patch}:g));
 const input=(g:GameForm,key:typeof textFieldNames[number],label:string,opts?:{type?:string;placeholder?:string;min?:number;max?:number;pattern?:string})=>
  <label className="qdNewField" key={key}>{label}
   <input name={g.team+"-"+key} type={opts?.type||"text"} value={g[key]}
    placeholder={opts?.placeholder} min={opts?.min} max={opts?.max} pattern={opts?.pattern}
    onChange={e=>edit(g.team,{[key]:e.target.value})} maxLength={opts?.type==="number"?undefined:key==="venue"||key==="location"?160:key==="opponent"?80:80}/>
  </label>;
 const num=(value:string)=>value.trim()===""?null:Number(value);
 const publish=async(event:React.FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(submitLock.current)return;
  const scheduled=games.filter(g=>!g.rest);
  if(!scheduled.length){setError("Añade al menos un partido. Los demás equipos pueden descansar.");return}
  const empty=scheduled.find(g=>!g.opponent.trim()||!g.date||!g.time||!g.venue.trim());
  if(empty){setError("Completa el rival, la fecha, la hora y el campo de "+empty.team+".");return}
  if(!window.confirm("¿Publicar la jornada "+round+" con "+scheduled.length+" partidos y "+(games.length-scheduled.length)+" descansos? Después podrás editar los partidos en el panel."))return;
  submitLock.current=true;setBusy(true);setError("");setProgress("Comprobando datos…");
  try{
   const autoForms=await refreshDerioForms();
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw new Error("La sesión ha caducado. Accede de nuevo al panel.");
   const token=session.access_token;
   const updated=games.map(g=>({...g,derioForm:autoForms.get(g.team)??g.derioForm}));
   for(const g of updated){
    if(g.rest||!g.file)continue;
    setProgress("Subiendo escudo de "+g.team+"…");
    const data=new FormData();
    data.set("file",g.file);
    data.set("team",g.team);
    const response=await fetch("/api/admin/crests",{
     method:"POST",headers:{Authorization:"Bearer "+token},body:data
    });
    const json=await response.json().catch(()=>({}));
    if(!response.ok||!json.crest)throw new Error(json.error||"No se ha podido subir un escudo.");
    g.crest=json.crest;
    g.file=null;
    edit(g.team,{crest:g.crest,file:null});
   }
   setProgress("Validando y publicando jornada "+round+"…");
   const payload={
    round,
    games:updated.map(g=>g.rest?{
     team:g.team,status:"rest",competition:g.competition,
     federationRound:num(g.federationRound)
    }:{
     team:g.team,status:"scheduled",is_home:g.isHome,
     details:{
      teamLabel:g.team,opponent:g.opponent.trim(),
      date:g.date.split("-").reverse().join("/"),time:g.time,
      venue:g.venue.trim(),location:g.location.trim(),crest:g.crest,
      competition:g.competition.trim(),federationRound:num(g.federationRound),
      derioPosition:num(g.derioPosition),opponentPosition:num(g.opponentPosition),
      derioPoints:num(g.derioPoints),opponentPoints:num(g.opponentPoints),
      derioForm:g.derioForm.toUpperCase(),opponentForm:g.opponentForm.toUpperCase()
     }
    })
   };
   const response=await fetch("/api/admin/round",{
    method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
    body:JSON.stringify(payload)
   });
   const json=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(json.error||"No se ha podido publicar la jornada.");
   try{localStorage.removeItem("qd-admin-round-draft-"+round)}catch{}
   setProgress("");
   onCreated(round);
  }catch(e){
   setError(e instanceof Error?e.message:"No se ha podido publicar la jornada.");
  }finally{submitLock.current=false;setBusy(false);setProgress("")}
 };
 const totalScheduled=games.filter(g=>!g.rest).length;
 return <section className="qdCreateRound" aria-labelledby="qd-create-round-title">
  <div className="qdCreateRoundHeading">
   <div><span className="adminEyebrow">GESTIÓN DE JORNADAS</span><h2 id="qd-create-round-title">Crear jornada</h2>
    <p>Configura todos los encuentros, escudos y descansos. Se publicarán juntos y estarán disponibles en la app sin editar el código.</p></div>
   <label className="qdCreateRoundNumber">Jornada
    <input type="number" min={1} max={60} value={round} disabled={busy}
     onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=60){ready.current=false;setRound(n);setGames(makeInitial())}}}/>
   </label>
  </div>
  <div className="qdCreateRoundSummary">
   <span><strong>{totalScheduled}</strong> partidos</span>
   <span><strong>{games.length-totalScheduled}</strong> descansos</span>
   <span>7 equipos del CD Derio</span>
  </div>
  <form onSubmit={publish} className="qdCreateRoundForm">
   {games.map(g=><article className={"qdCreateRoundMatch "+(g.rest?"isRest":"")} key={g.team}>
    <header>
     <div><span className="qdCreateTeamIndex">{ROUND_TEAMS.indexOf(g.team)+1}</span>
      <div><h3>{g.team}</h3><small>{g.rest?"Descansa esta jornada":g.opponent||"Rival pendiente"}</small></div></div>
     <div className="qdCreateMatchActions">
      <label className="qdNewRestToggle"><input type="checkbox" checked={g.rest} disabled={busy}
       onChange={e=>edit(g.team,{rest:e.target.checked})}/> Descansa</label>
      <button type="button" aria-expanded={expanded.includes(g.team)}
       onClick={()=>setExpanded(prev=>prev.includes(g.team)?prev.filter(team=>team!==g.team):[...prev,g.team])}>
       {expanded.includes(g.team)?"Contraer":"Editar"}
      </button>
     </div>
    </header>
    {expanded.includes(g.team)&&<div className="qdCreateRoundFields">
     {g.rest?<div className="qdCreateRestHint">Este equipo descansa. No se creará un partido ni se solicitarán pronósticos.</div>:<>
      <div className="qdNewCrestBlock">
       <CrestPreview file={g.file} src={g.crest}/>
       <label className="qdNewCrestUpload">Escudo del rival
        <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" disabled={busy}
         onChange={e=>{
          const file=e.target.files?.[0]||null;
          if(file&&file.size>4*1024*1024){setError("El escudo debe pesar menos de 4 MB.");e.target.value="";return}
          edit(g.team,{file});
         }}/>
        <small>PNG, JPG, WebP o AVIF · máximo 4 MB</small>
       </label>
       {(g.file||g.crest)&&<button type="button" disabled={busy} onClick={()=>edit(g.team,{file:null,crest:""})}>Quitar</button>}
      </div>
      <div className="qdNewRoundGrid">
       {input(g,"opponent","Equipo rival",{placeholder:"Nombre del club rival"})}
       <label className="qdNewField">Condición
        <select value={g.isHome?"home":"away"} disabled={busy}
         onChange={e=>edit(g.team,{isHome:e.target.value==="home"})}>
         <option value="home">Juega en casa</option><option value="away">Juega fuera</option>
        </select>
       </label>
       <label className="qdNewField">Fecha
        <input type="date" value={g.date} disabled={busy} required min="2020-01-01" max="2100-12-31"
         onChange={e=>edit(g.team,{date:e.target.value})}/>
       </label>
       <label className="qdNewField">Hora (España)
        <input type="time" value={g.time} disabled={busy} required
         onChange={e=>edit(g.team,{time:e.target.value})}/>
       </label>
       {input(g,"venue","Campo de juego",{placeholder:"Ibaiondo"})}
       {input(g,"location","Localidad",{placeholder:"Derio"})}
      </div>
     </>}
     <h4>Competición y estadísticas {g.rest?"(opcional)":"(opcionales)"}</h4>
     <div className="qdNewRoundGrid">
      {input(g,"competition","Competición")}
      {input(g,"federationRound","Jornada federativa",{type:"number",min:1,max:100})}
      {!g.rest&&<>
       {input(g,"derioPosition","Posición del Derio",{type:"number",min:1,max:999})}
       {input(g,"opponentPosition","Posición del rival",{type:"number",min:1,max:999})}
       {input(g,"derioPoints","Puntos del Derio",{type:"number",min:0,max:999})}
       {input(g,"opponentPoints","Puntos del rival",{type:"number",min:0,max:999})}
       {input(g,"derioForm","Forma del Derio",{placeholder:"VVEVD",pattern:"[VvEeDd]{0,5}"})}
       {input(g,"opponentForm","Forma del rival",{placeholder:"EDVVE",pattern:"[VvEeDd]{0,5}"})}
      </>}
     </div>
    </div>}
   </article>)}
   {error&&<p className="qdCreateRoundError" role="alert">{error}</p>}
   {progress&&<p className="qdCreateRoundProgress" role="status"><span className="qdCreateRoundSpinner"/>{progress}</p>}
   <div className="qdCreateRoundFooter">
    <p>Los datos se guardan temporalmente como borrador en este dispositivo. Publicar no borra jornadas anteriores, resultados ni pronósticos. Los escudos se subirán al guardar.</p>
    <button type="submit" className="adminPrimary" disabled={busy||!totalScheduled}>
     {busy?"Publicando…":`Publicar jornada ${round}`}
    </button>
   </div>
  </form>
 </section>;
}
