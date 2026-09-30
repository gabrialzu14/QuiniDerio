import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||"";
const service=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
function admin(){if(!url||!service)throw new Error("supabase_env");return createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})}
export async function POST(req:NextRequest){
 try{
  const body=await req.json();
  const email=String(body.email||"").trim().toLowerCase();
  const password=String(body.password||"");
  const username=String(body.username||"").trim();
  if(!email||!email.includes("@")||password.length<6||username.length<3)return NextResponse.json({error:"Datos de registro no válidos."},{status:400});
  const db=admin();
  const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username}});
  if(error){
   const msg=String(error.message||"");
   if(/already|registered|exists/i.test(msg))return NextResponse.json({error:"Este email ya está registrado. Inicia sesión."},{status:409});
   console.error("register",error);
   return NextResponse.json({error:"No se ha podido crear la cuenta. Inténtalo de nuevo."},{status:400});
  }
  if(!data.user)return NextResponse.json({error:"No se ha podido crear la cuenta."},{status:500});
  const {error:profileError}=await db.from("quini_profiles").upsert({user_id:data.user.id,email,username,season:{},completed:false});
  if(profileError)console.error("profile",profileError);
  return NextResponse.json({ok:true});
 }catch(e){console.error(e);return NextResponse.json({error:"No se ha podido crear la cuenta."},{status:500})}
}