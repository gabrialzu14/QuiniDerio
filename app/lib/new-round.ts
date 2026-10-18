import {kickoffUtc,validateDetails,type MatchDetails} from "./match-details";

export const ROUND_TEAMS=["Derio A","Derio B","Derio Fem","Derio Fem B","Juvenil A","Juvenil B","Cadete B"] as const;
export type RoundTeam=typeof ROUND_TEAMS[number];
export type RoundGameInput={
 team:RoundTeam;status:"scheduled"|"rest";is_home?:boolean;
 details?:MatchDetails & {crest?:string;competition?:string;federationRound?:number|null};
 competition?:string;federationRound?:number|null;
};
export type ParsedRoundGame={
 team:RoundTeam;status:"scheduled"|"rest";
 opponent?:string;is_home?:boolean;scheduled_at?:string;
 details?:MatchDetails;competition?:string;federationRound?:number|null;
};
function validateCrest(value:string):string{
 if(!value)return "";
 if(value.length>320||!value.startsWith("/api/assets/Escudos/"))throw new Error("Escudo no válido. Súbelo desde el formulario.");
 const path=value.split("?")[0].slice("/api/assets/Escudos/".length);
 if(!path||path.includes("/")||path.includes("\\")||path.includes("..")||/[%]2[fF]|[%]5[cC]/.test(path))throw new Error("Ruta del escudo no válida.");
 const suffix=value.slice(value.split("?")[0].length);
 if(suffix&&!/^\?(?:normalize=1|v=[a-zA-Z0-9._-]+)(?:&(v=[a-zA-Z0-9._-]+|normalize=1))*$/.test(suffix))throw new Error("Parámetros del escudo no válidos.");
 return value;
}
function checkFederationRound(value:unknown):number|null{
 if(value===undefined||value===null||value==="")return null;
 if(!Number.isInteger(value)||Number(value)<1||Number(value)>100)throw new Error("Jornada federativa no válida.");
 return Number(value);
}
export function parseNewRound(input:unknown):{round:number,games:ParsedRoundGame[]}{
 if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Datos de jornada no válidos.");
 const data=input as Record<string,unknown>;
 const round=data.round;
 if(!Number.isInteger(round)||Number(round)<1||Number(round)>60)throw new Error("El número de jornada debe estar entre 1 y 60.");
 if(!Array.isArray(data.games)||data.games.length!==ROUND_TEAMS.length)throw new Error("Debes completar los siete equipos.");
 const found=new Set<string>();
 const games=data.games.map((entry:unknown):ParsedRoundGame=>{
  if(!entry||typeof entry!=="object"||Array.isArray(entry))throw new Error("Faltan los datos de un equipo.");
  const item=entry as Record<string,unknown>;
  const team=item.team;
  if(typeof team!=="string"||!ROUND_TEAMS.includes(team as RoundTeam)||found.has(team))throw new Error("Equipo duplicado o desconocido.");
  found.add(team);
  if(item.status==="rest"){
   const competition=typeof item.competition==="string"?item.competition.trim():"";
   if(competition.length>80)throw new Error("Nombre de competición demasiado largo.");
   return {team:team as RoundTeam,status:"rest",competition,federationRound:checkFederationRound(item.federationRound)};
  }
  if(item.status!=="scheduled"||typeof item.is_home!=="boolean")throw new Error("Selecciona local o visitante para cada partido.");
  const d=validateDetails(item.details);
  const competition=typeof d.competition==="string"?d.competition:"";
  const federationRound=checkFederationRound(d.federationRound);
  const crest=validateCrest(d.crest||"");
  if(d.teamLabel!==team)throw new Error("El equipo del club no coincide con la ficha.");
  const details:MatchDetails={...d,crest,competition,federationRound};
  return {team:team as RoundTeam,status:"scheduled",opponent:d.opponent,is_home:item.is_home,scheduled_at:kickoffUtc(d.date,d.time),details};
 });
 if(!games.some(g=>g.status==="scheduled"))throw new Error("Debe haber al menos un partido en la jornada.");
 return {round:Number(round),games};
}
