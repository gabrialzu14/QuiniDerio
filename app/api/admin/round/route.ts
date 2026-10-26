import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {parseNewRound} from "../../../lib/new-round";

export const runtime="nodejs";
const ADMIN="gabrialzueta@gmail.com";

function client(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error("supabase_env");
 return createClient(url,key,{auth:{persistSession:false}});
}
async function verify(req:NextRequest,db:ReturnType<typeof client>){
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return false;
 const {data,error}=await db.auth.getUser(token);
 return !error&&data.user?.email?.trim().toLowerCase()===ADMIN;
}
export async function POST(req:NextRequest){
 const headers={"Cache-Control":"no-store"};
 try{
  const db=client();
  if(!await verify(req,db))return NextResponse.json({error:"Acceso restringido."},{status:403,headers});
  let payload;
  try{payload=parseNewRound(await req.json())}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Datos de jornada no válidos."},{status:400,headers})}
  const {data,error}=await db.rpc("quini_publish_round",{p_round:payload.round,p_games:payload.games});
  if(error){
   if(/round_already_exists|duplicate key/i.test(error.message))
    return NextResponse.json({error:"La jornada ya existe. No se ha modificado ningún partido."},{status:409,headers});
   console.error("quini-publish-round",error.code,error.message);
   return NextResponse.json({error:"No se ha podido publicar la jornada. Ningún partido se ha guardado."},{status:500,headers});
  }
  // The publication RPC also activates the immediately following round atomically.
  const {data:settings,error:settingsError}=await db.from("quini_app_settings")
   .select("active_round").eq("id",1).single();
  if(settingsError||!settings)throw new Error("Unable to confirm active round after publication");
  const activeRound=Number(settings.active_round);
  return NextResponse.json({ok:true,round:payload.round,created:Number(data),
   rests:payload.games.length-Number(data),activeRound,activated:activeRound===payload.round},{headers});
 }catch(e){console.error("quini-create-round",e);return NextResponse.json({error:"No se ha podido crear la jornada."},{status:500,headers})}
}
