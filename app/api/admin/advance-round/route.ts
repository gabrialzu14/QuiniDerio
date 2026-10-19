import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const ADMIN="gabrialzueta@gmail.com";

export async function POST(request:NextRequest){
 const headers={"Cache-Control":"no-store"};
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!serviceKey)throw new Error("missing_supabase_config");
  const db=createClient(url,serviceKey,{auth:{persistSession:false}});
  const bearer=request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!bearer)return NextResponse.json({error:"Acceso restringido."},{status:403,headers});
  const {data:{user},error:authError}=await db.auth.getUser(bearer);
  if(authError||user?.email?.trim().toLowerCase()!==ADMIN)
   return NextResponse.json({error:"Acceso restringido."},{status:403,headers});

  let payload:unknown;
  try{payload=await request.json()}catch{return NextResponse.json({error:"Solicitud no válida."},{status:400,headers})}
  const expected=typeof payload==="object"&&payload!==null&&!Array.isArray(payload)?
   (payload as Record<string,unknown>).expectedRound:undefined;
  if(!Number.isInteger(expected)||Number(expected)<1||Number(expected)>59)
   return NextResponse.json({error:"Jornada de origen no válida."},{status:400,headers});

  const {data:next,error}=await db.rpc("quini_advance_active_round",{p_expected_round:expected});
  if(error){
   if(error.message.includes("round_has_changed"))
    return NextResponse.json({error:"La jornada activa ya ha cambiado. Actualiza el panel antes de intentarlo."},{status:409,headers});
   if(error.message.includes("next_round_incomplete"))
    return NextResponse.json({error:"Primero crea la siguiente jornada con los siete equipos y al menos un partido."},{status:409,headers});
   if(error.message.includes("maximum_round_reached"))
    return NextResponse.json({error:"No hay más jornadas disponibles."},{status:409,headers});
   console.error("quini-admin-advance-round",error.code,error.message);
   return NextResponse.json({error:"No se ha podido activar la siguiente jornada."},{status:500,headers});
  }
  return NextResponse.json({ok:true,activeRound:Number(next)},{headers});
 }catch(error){
  console.error("quini-admin-advance-round",error);
  return NextResponse.json({error:"No se ha podido activar la siguiente jornada."},{status:500,headers});
 }
}
