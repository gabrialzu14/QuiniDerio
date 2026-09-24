import {NextResponse} from "next/server";
import {federationTeams} from "../../../lib/federation";
export const dynamic="force-dynamic";
const SUPABASE_URL="https://bwonxnayayopbohxuphs.supabase.co";
const SUPABASE_KEY="sb_publishable_k0vRQvM6VQtxUcqnyuUGLA_qE6APi09";
export async function GET(){
 try{
  const edge=await fetch(SUPABASE_URL+"/functions/v1/federation-fixtures",{headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY},cache:"no-store",signal:AbortSignal.timeout(50000)});
  if(edge.ok){
   const data=await edge.json();
   if(data?.teams?.some((x:any)=>x.opponent)) return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
  }
  const now=new Date().toISOString();
  const r=await fetch(SUPABASE_URL+"/rest/v1/matches?select=id,team_id,federation_round,opponent,is_home,kickoff,status,derio_position,opponent_position&status=in.(scheduled,postponed,rest)&or=(kickoff.is.null,kickoff.gte."+encodeURIComponent(now)+")&order=kickoff.asc.nullslast",{headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY},cache:"no-store"});
  const matches=r.ok?await r.json():[];
  const teams=federationTeams.map(team=>{const m=matches.find((x:any)=>x.team_id===team.id);if(!m)return{id:team.id,name:team.name,status:"unavailable",opponent:"",date:"",time:"",venue:"",federationRound:null};const d=m.kickoff?new Date(m.kickoff):null;return{id:team.id,name:team.name,status:m.status,opponent:m.opponent||"",isHome:m.is_home,federationRound:m.federation_round,date:d?new Intl.DateTimeFormat("es-ES",{timeZone:"Europe/Madrid",day:"2-digit",month:"2-digit",year:"numeric"}).format(d):"",time:d?new Intl.DateTimeFormat("es-ES",{timeZone:"Europe/Madrid",hour:"2-digit",minute:"2-digit",hour12:false}).format(d):"",venue:"",derioPosition:m.derio_position,opponentPosition:m.opponent_position}});
  return NextResponse.json({updatedAt:new Date().toISOString(),source:"supabase-fallback",teams},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({error:String(e),teams:federationTeams.map(t=>({id:t.id,name:t.name,status:"unavailable",opponent:"",date:"",time:"",venue:"",federationRound:null}))},{headers:{"Cache-Control":"no-store"}})}
}