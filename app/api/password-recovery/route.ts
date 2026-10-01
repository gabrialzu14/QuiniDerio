import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||"";
const service=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
const SITE="https://quiniderio.vercel.app/";
function admin(){if(!url||!service)throw new Error("supabase_env");return createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})}
export async function POST(req:NextRequest){
 try{
  const {email:raw}=await req.json();
  const email=String(raw||"").trim().toLowerCase();
  if(!email||!email.includes("@"))return NextResponse.json({error:"Introduce un email válido."},{status:400});
  const db=admin();
  const {data,error}=await db.auth.admin.generateLink({type:"recovery",email,options:{redirectTo:SITE}});
  if(error){
   console.error("recovery",error);
   return NextResponse.json({error:"No se ha podido generar el acceso de recuperación."},{status:400});
  }
  const actionLink=data.properties?.action_link;
  if(!actionLink)return NextResponse.json({error:"No se ha podido generar el acceso de recuperación."},{status:500});
  return NextResponse.json({ok:true,recoveryUrl:actionLink});
 }catch(e){console.error(e);return NextResponse.json({error:"No se ha podido recuperar la cuenta."},{status:500})}
}
