/**
 * Readers for the public pages of the Basque (euskadifutbol.eus) and Biscay
 * (fvf-bff.eus) federations. Access is authorised by both federations for
 * QuiniDerio game data only (see docs/federation-access.md).
 *
 * Only plain visible text is read: teams, date, time, field, position,
 * points and recent form. Match scores are deliberately protected on those
 * pages and are never read.
 */
export type FederationMatch={home:string,away:string,date:string,time:string,field:string};
export type FederationStanding={position:number,team:string,points:number,form:string};

const ENTITIES:Record<string,string>={nbsp:" ",amp:"&",quot:'"',apos:"'",lt:"<",gt:">",aacute:"á",eacute:"é",iacute:"í",oacute:"ó",uacute:"ú",Aacute:"Á",Eacute:"É",Iacute:"Í",Oacute:"Ó",Uacute:"Ú",ntilde:"ñ",Ntilde:"Ñ",uuml:"ü",Uuml:"Ü",ordm:"º",ordf:"ª"};
export function text(fragment:string){
 return fragment
  .replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," ")
  .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
  .replace(/&([a-zA-Z]+);/g,(m,name)=>ENTITIES[name]??m)
  .replace(/\s+/g," ").trim();
}
/** Compare federation names regardless of case, accents, quotes and punctuation. */
export function nameKey(name:string){
 return name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/["'.,]/g," ").replace(/\s+/g," ").trim();
}
export const isDerio=(name:string)=>/\bDERIO\b/.test(nameKey(name));

/** Matches of one federation jornada page (NFG_CmpJornada). */
export function parseCalendar(html:string):FederationMatch[]{
 const out:FederationMatch[]=[];
 for(const block of html.split(/<tr style="background-color:\s*#ffffff00;?">/i).slice(1)){
  const chunk=block.split(/<\/tbody>/i)[0];
  // Home team sits in .font_widgetL and away team in .font_widgetV; the centre <h4> is the (protected) score.
  const home=text(chunk.match(/class=["']?font_widgetL["']?[^>]*>\s*<h4>([\s\S]*?)<\/h4>/i)?.[1]||"");
  const away=text(chunk.match(/class=["']?font_widgetV["']?[^>]*>\s*<h4>([\s\S]*?)<\/h4>/i)?.[1]||"");
  if(!home||!away)continue;
  const times=[...chunk.matchAll(/class=["']?horario["']?[^>]*>([^<]*)</gi)].map(m=>text(m[1]));
  const dateRaw=times.find(t=>/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(t))||"";
  const time=times.find(t=>/^\d{1,2}:\d{2}$/.test(t))||"";
  const field=text(chunk.match(/NFG_VisCampos[^>]*>([^<]*)</i)?.[1]||"");
  const [d,m,y]=dateRaw.split(/[-/]/);
  out.push({home,away,date:dateRaw?`${d.padStart(2,"0")}/${m.padStart(2,"0")}/${y}`:"",time:time?time.padStart(5,"0"):"",field});
 }
 return out;
}
/** Standings table (NFG_VisClasificacion): position, team, points and last results. */
export function parseStandings(html:string):FederationStanding[]{
 const table=(html.match(/<table[\s\S]*?<\/table>/gi)||[]).find(t=>/Puntuak|Puntos|Ptos/i.test(t)&&/<td/i.test(t))||"";
 const rows:FederationStanding[]=[];
 for(const row of table.match(/<tr[\s\S]*?<\/tr>/gi)||[]){
  const cells=[...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>text(m[1]));
  if(cells.length<6||!/^\d+$/.test(cells[1]||""))continue;
  // Recent results: G (won) / E (draw) / P (lost), oldest first, as V / E / D in the app.
  const formCell=cells.find(c=>/^([GEP]\s*){1,6}$/.test(c))||"";
  const form=formCell.replace(/\s+/g,"").replace(/G/g,"V").replace(/P/g,"D");
  rows.push({position:Number(cells[1]),team:cells[2],points:Number(cells[3]),form});
 }
 return rows;
}
export function derioMatch(matches:FederationMatch[]){
 const m=matches.find(x=>isDerio(x.home)||isDerio(x.away));
 if(!m)return null;
 const home=isDerio(m.home);
 return {...m,isHome:home,opponent:home?m.away:m.home,derio:home?m.home:m.away};
}
export function standingOf(rows:FederationStanding[],team:string){
 const key=nameKey(team);
 return rows.find(r=>nameKey(r.team)===key)||null;
}
/** Readable fallback name, only used when the jornada has no opponent yet. */
export function displayName(name:string){
 const letter=name.match(/"([A-Z])"/)?.[1];
 const base=name.replace(/"[A-Z]"/g,"").split(",")[0].trim().toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());
 return letter?`${base} ${letter}`:base;
}
/** Spanish local kickoff (Europe/Madrid) to an ISO UTC timestamp. */
export function kickoffIso(date:string,time:string){
 const [d,m,y]=date.split("/").map(Number);const [h,min]=time.split(":").map(Number);
 if(!d||!m||!y||!Number.isFinite(h)||!Number.isFinite(min))return null;
 const guess=Date.UTC(y,m-1,d,h,min);
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(guess)).map(p=>[p.type,p.value]));
 const shown=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute));
 return new Date(guess-(shown-guess)).toISOString();
}
