import {NextResponse} from "next/server";
import {federationTeams} from "../../../lib/federation";
export const dynamic="force-dynamic";

const SUPABASE_URL="https://bwonxnayayopbohxuphs.supabase.co";
const SUPABASE_KEY="sb_publishable_k0vRQvM6VQtxUcqnyuUGLA_qE6APi09";

export async function GET(){
 try{
  const now=new Date().toISOString();
  const r=await fetch(SUPABASE_URL+"/rest/v1/matches?select=id,team_id,federation_round,opponent,is_home,kickoff,status,derio_position,opponent_position&status=in.(scheduled,postponed,rest)&or=(kickoff.is.null,kickoff.gte."+encodeURIComponent(now)+")&order=kickoff.asc.nullslast",{headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY},cache:"no-store"});
  if(!r.ok)throw new Error("Supabase "+r.status);
  const matches=await r.json() as any[];
  const teams=federationTeams.map(team=>{
   const m=matches.find(x=>x.team_id===team.id);
   if(!m)return {id:team.id,name:team.name,status:"unavailable",opponent:"",date:"",time:"",venue:"",federationRound:null};
   const d=m.kickoff?new Date(m.kickoff):null;
   return {id:team.id,name:team.name,status:m.status,opponent:m.opponent||"",isHome:m.is_home,federationRound:m.federation_round,date:d?new Intl.DateTimeFormat("es-ES",{timeZone:"Europe/Madrid",day:"2-digit",month:"2-digit",year:"numeric"}).format(d):"",time:d?new Intl.DateTimeFormat("es-ES",{timeZone:"Europe/Madrid",hour:"2-digit",minute:"2-digit",hour12:false}).format(d):"",venue:"",derioPosition:m.derio_position,opponentPosition:m.opponent_position};
  });
  return NextResponse.json({updatedAt:new Date().toISOString(),source:"supabase-sync",teams},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  return NextResponse.json({updatedAt:new Date().toISOString(),source:"supabase-sync",error:String(e),teams:federationTeams.map(t=>({id:t.id,name:t.name,status:"unavailable",opponent:"",date:"",time:"",venue:"",federationRound:null}))},{status:200,headers:{"Cache-Control":"no-store"}});
 }
}