"use client";
import {useState} from "react";
import {matchDetails,type ManagedMatch,type MatchDetails} from "../lib/match-details";
export default function MatchEditor({match,disabled,onSave}:{match:ManagedMatch,disabled:boolean,onSave:(details:MatchDetails)=>Promise<boolean>}){
 const [open,setOpen]=useState(false);
 const [error,setError]=useState("");
 const d=matchDetails(match);
 return <section className="adminFixtureEditor"><button type="button" disabled={disabled} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?"Cerrar datos del partido":"Editar datos del partido"}</button>{open&&<form key={JSON.stringify(d)} onSubmit={async e=>{
  e.preventDefault();if(disabled)return;setError("");const data=new FormData(e.currentTarget);
  const text=(name:string)=>String(data.get(name)||"").trim();const num=(name:string)=>text(name)===""?null:Number(text(name));
  const details:MatchDetails={teamLabel:text("teamLabel"),opponent:text("opponent"),date:text("date").split("-").reverse().join("/"),time:text("time"),venue:text("venue"),location:text("location"),derioPosition:num("derioPosition"),opponentPosition:num("opponentPosition"),derioPoints:num("derioPoints"),opponentPoints:num("opponentPoints"),derioForm:text("derioForm").toUpperCase(),opponentForm:text("opponentForm").toUpperCase()};
  if(await onSave(details))setOpen(false);else setError("No se han guardado los datos. Revisa los campos e inténtalo de nuevo.");
 }}><fieldset disabled={disabled}><legend>Datos del partido · {match.team}</legend><div className="adminFixtureFields">
 <label>Equipo<input name="teamLabel" defaultValue={d.teamLabel} required maxLength={80}/></label>
 <label>Equipo rival<input name="opponent" defaultValue={d.opponent} required maxLength={80}/></label>
 <label>Día<input name="date" type="date" required min="2020-01-01" max="2100-12-31" defaultValue={d.date.split("/").reverse().join("-")}/></label>
 <label>Hora (España)<input name="time" type="time" required defaultValue={d.time}/></label>
 <label>Nombre del campo<input name="venue" defaultValue={d.venue} maxLength={160}/></label>
 <label>Ubicación / localidad<input name="location" defaultValue={d.location} placeholder="Localidad o dirección" maxLength={160}/></label>
 {([['derioPosition','Posición del equipo',1],['opponentPosition','Posición del rival',1],['derioPoints','Puntos del equipo',-999],['opponentPoints','Puntos del rival',-999]] as const).map(([name,label,min])=><label key={name}>{label}<input type="number" name={name} min={min} max={999} step={1} defaultValue={d[name]??""}/></label>)}
 <label>Forma del equipo<input name="derioForm" defaultValue={d.derioForm} maxLength={5} pattern="[VvEeDd]{0,5}" placeholder="VEVDV"/></label>
 <label>Forma del rival<input name="opponentForm" defaultValue={d.opponentForm} maxLength={5} pattern="[VvEeDd]{0,5}" placeholder="VEVDV"/></label>
 </div><p className="adminMatchHint">Forma: hasta 5 resultados, del más antiguo al más reciente. V = victoria, E = empate, D = derrota. Deja vacíos los datos que no estén confirmados.</p>
 {error&&<p role="alert">{error}</p>}<button className="adminPrimary" type="submit">{disabled?"Guardando…":"Guardar datos del partido"}</button>
 </fieldset></form>}</section>;
}
