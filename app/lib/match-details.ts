import {currentStandings,matchdayThreeStandings,currentForm,matchdayThreeForm} from "./team-context";
import {quizFixtures} from "./quiz-fixtures";
export type MatchDetails={teamLabel:string,opponent:string,date:string,time:string,venue:string,location:string,derioPosition:number|null,opponentPosition:number|null,derioPoints:number|null,opponentPoints:number|null,derioForm:string,opponentForm:string};
export type ManagedMatch={round:number,team:string,opponent:string,is_home:boolean|null,scheduled_at:string|null,fixture_details:MatchDetails|null};
export function matchDetails(row:ManagedMatch):MatchDetails{
 const f=quizFixtures[row.round]?.[row.team]||{};
 const standings=row.round===3?matchdayThreeStandings:row.round===2?currentStandings:{};
 const stats=(team:string)=>{const value=standings[team]||"";return {position:Number(value.match(/^(\d+)º/)?.[1])||null,points:value.match(/· (-?\d+) pt/)?.[1]}};
 const own=stats(row.team),rival=stats(row.opponent);
 const form=(team:string)=>(row.round===3?matchdayThreeForm[team]:undefined)??currentForm[team]??"";
 const parts=row.scheduled_at?Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(row.scheduled_at)).map(p=>[p.type,p.value])):null;
 return {teamLabel:row.team,opponent:row.opponent,date:parts?`${parts.day}/${parts.month}/${parts.year}`:f.date||"",time:parts?`${parts.hour}:${parts.minute}`:f.time||"",venue:f.venue||"",location:"",derioPosition:own.position??f.derioPosition??null,opponentPosition:rival.position??f.opponentPosition??null,derioPoints:own.points===undefined?null:Number(own.points),opponentPoints:rival.points===undefined?null:Number(rival.points),derioForm:form(row.team),opponentForm:form(row.opponent),...row.fixture_details};
}
export function mergeFixtures(rows:ManagedMatch[]):typeof quizFixtures{
 const result=Object.fromEntries(Object.entries(quizFixtures).map(([round,games])=>[round,{...games}]));
 for(const row of rows){const base=result[row.round]?.[row.team]||{};const d=matchDetails(row);result[row.round]??={};result[row.round][row.team]={...base,...d,opponent:row.opponent,isHome:row.is_home??base.isHome,date:d.date,time:d.time,venue:[d.venue,d.location].filter(Boolean).join(", ")};}
 return result;
}
/** Interpret kickoff in Spain, independently of the browser/server timezone. */
export function kickoffUtc(date:string,time:string):string{
 if(!/^\d{2}\/\d{2}\/\d{4}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error("Fecha u hora no válida.");
 const [day,month,year]=date.split("/").map(Number),[hour,minute]=time.split(":").map(Number);
 const intended=Date.UTC(year,month-1,day,hour,minute),calendar=new Date(intended);
 if(year<2020||year>2100||calendar.getUTCFullYear()!==year||calendar.getUTCMonth()!==month-1||calendar.getUTCDate()!==day)throw new Error("Fecha no válida.");
 let instant=intended;const formatter=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
 for(let i=0;i<3;i++){const p=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p=>[p.type,Number(p.value)]));instant+=intended-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute)}
 const p=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p=>[p.type,Number(p.value)]));
 if(Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute)!==intended)throw new Error("La hora no existe por el cambio de horario.");
 return new Date(instant).toISOString();
}
export function validateDetails(input:unknown):MatchDetails{
 if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Datos del partido no válidos.");
 const v=input as Record<string,unknown>;
 const text=(k:string,max:number,required=false)=>{if(typeof v[k]!=="string")throw new Error("Revisa los campos del partido.");const s=(v[k] as string).trim();if(s.length>max||(required&&!s))throw new Error("Completa equipo y rival y revisa la longitud de los campos.");return s};
 const num=(k:string,min:number)=>{const n=v[k];if(n===null)return null;if(typeof n!=="number"||!Number.isInteger(n)||n<min||n>999)throw new Error("Posiciones y puntos deben ser números enteros válidos.");return n};
 const form=(k:string)=>{const s=text(k,5).toUpperCase();if(!/^[VED]{0,5}$/.test(s))throw new Error("La forma admite hasta 5 resultados: V, E o D.");return s};
 const d:MatchDetails={teamLabel:text("teamLabel",80,true),opponent:text("opponent",80,true),date:text("date",10,true),time:text("time",5,true),venue:text("venue",160),location:text("location",160),derioPosition:num("derioPosition",1),opponentPosition:num("opponentPosition",1),derioPoints:num("derioPoints",-999),opponentPoints:num("opponentPoints",-999),derioForm:form("derioForm"),opponentForm:form("opponentForm")};kickoffUtc(d.date,d.time);return d;
}
export function standing(position:number|null|undefined,points:number|null|undefined,fallback?:string){
 if(position===undefined&&points===undefined)return fallback;
 return [position==null?"":`${position}º`,points==null?"":`${points} pts`].filter(Boolean).join(" · ");
}
