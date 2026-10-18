"use client";
import {useState} from "react";
import {supabase} from "../lib/supabase";
import {matchDetails,type ManagedMatch,type MatchDetails} from "../lib/match-details";

export default function MatchEditor({match,disabled,onSave}:{match:ManagedMatch,disabled:boolean,onSave:(details:MatchDetails)=>Promise<boolean>}){
 const [open,setOpen]=useState(false);
 const [error,setError]=useState("");
 const [uploading,setUploading]=useState(false);
 const d=matchDetails(match);
 const disabledNow=disabled||uploading;
 return <section className="adminFixtureEditor">
 <button type="button" disabled={disabledNow} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?"Cerrar datos del partido":"Editar datos del partido"}</button>
 {open&&<form key={JSON.stringify(d)} onSubmit={async e=>{
  e.preventDefault();if(disabledNow)return;setError("");setUploading(true);
  const data=new FormData(e.currentTarget);
  const text=(name:string)=>String(data.get(name)||"").trim();
  const num=(name:string)=>text(name)===""?null:Number(text(name));
  let crest=d.crest||"";
  try{
   const chosen=data.get("crestFile");
   if(chosen instanceof File&&chosen.size>0){
    const {data:{session}}=await supabase.auth.getSession();
    if(!session)throw new Error("Inicia sesión para subir el escudo.");
    const upload=new FormData();
    upload.set("file",chosen);upload.set("team",match.team);
    const response=await fetch("/api/admin/crests",{
     method:"POST",headers:{Authorization:"Bearer "+session.access_token},body:upload
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.crest)throw new Error(result.error||"No se ha podido subir el escudo.");
    crest=result.crest;
   }
   const details:MatchDetails={
    teamLabel:text("teamLabel"),opponent:text("opponent"),
    date:text("date").split("-").reverse().join("/"),
    time:text("time"),venue:text("venue"),location:text("location"),
    derioPosition:num("derioPosition"),opponentPosition:num("opponentPosition"),
    derioPoints:num("derioPoints"),opponentPoints:num("opponentPoints"),
    derioForm:text("derioForm").toUpperCase(),opponentForm:text("opponentForm").toUpperCase(),
    competition:text("competition"),federationRound:num("federationRound"),crest
   };
   if(await onSave(details))setOpen(false);
   else setError("No se han guardado los datos. Revisa los campos e inténtalo de nuevo.");
  }catch(err){
   setError(err instanceof Error?err.message:"No se han guardado los cambios.");
  }finally{setUploading(false)}
 }}>
 <fieldset disabled={disabledNow}><legend>Datos del partido · {match.team}</legend>
 <div className="adminFixtureCrest">
  {d.crest&&<img src={d.crest} alt="Escudo actual del rival"/>}
  <label>Escudo del rival
   <input type="file" name="crestFile" accept="image/png,image/jpeg,image/webp,image/avif"/>
   <small>Puedes cambiarlo también después de publicar la jornada. Máximo 4 MB.</small>
  </label>
 </div>
 <div className="adminFixtureFields">
  <label>Equipo<input name="teamLabel" defaultValue={d.teamLabel} required maxLength={80}/></label>
  <label>Equipo rival<input name="opponent" defaultValue={d.opponent} required maxLength={80}/></label>
  <label>Día<input name="date" type="date" required min="2020-01-01" max="2100-12-31" defaultValue={d.date.split("/").reverse().join("-")}/></label>
  <label>Hora (España)<input name="time" type="time" required defaultValue={d.time}/></label>
  <label>Nombre del campo<input name="venue" defaultValue={d.venue} maxLength={160}/></label>
  <label>Ubicación / localidad<input name="location" defaultValue={d.location} placeholder="Localidad o dirección" maxLength={160}/></label>
  <label>Competición<input name="competition" defaultValue={d.competition||""} maxLength={80}/></label>
  <label>Jornada federativa<input type="number" name="federationRound" min={1} max={100} defaultValue={d.federationRound??""}/></label>
  {([["derioPosition","Posición del equipo",1],["opponentPosition","Posición del rival",1],
      ["derioPoints","Puntos del equipo",0],["opponentPoints","Puntos del rival",0]] as const)
   .map(([name,label,min])=><label key={name}>{label}<input type="number" name={name} min={min} max={999} step={1} defaultValue={d[name]??""}/></label>)}
  <label>Forma del equipo<input name="derioForm" defaultValue={d.derioForm} maxLength={5} pattern="[VvEeDd]{0,5}" placeholder="VEVDV"/></label>
  <label>Forma del rival<input name="opponentForm" defaultValue={d.opponentForm} maxLength={5} pattern="[VvEeDd]{0,5}" placeholder="VEVDV"/></label>
 </div>
 <p className="adminMatchHint">Forma: hasta cinco resultados, del más antiguo al más reciente. V = victoria, E = empate, D = derrota. Puedes dejar vacías las estadísticas desconocidas.</p>
 {error&&<p role="alert">{error}</p>}
 <button className="adminPrimary" type="submit">{uploading?"Guardando y subiendo escudo…":"Guardar datos del partido"}</button>
 </fieldset></form>}
 </section>;
}
