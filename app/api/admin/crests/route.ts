import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import sharp from "sharp";
import {randomUUID} from "node:crypto";
import {ROUND_TEAMS} from "../../../lib/new-round";

export const runtime="nodejs";
const ADMIN="gabrialzueta@gmail.com";
const MAX_BYTES=4*1024*1024;
const TYPES=new Set(["image/png","image/jpeg","image/webp","image/avif"]);

export async function POST(req:NextRequest){
 const headers={"Cache-Control":"no-store"};
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("supabase_env");
  const db=createClient(url,key,{auth:{persistSession:false}});
  const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return NextResponse.json({error:"Acceso restringido."},{status:403,headers});
  const {data:{user},error:authError}=await db.auth.getUser(token);
  if(authError||user?.email?.trim().toLowerCase()!==ADMIN)
   return NextResponse.json({error:"Acceso restringido."},{status:403,headers});
  const contentLength=Number(req.headers.get("content-length")||0);
  if(contentLength>MAX_BYTES+20480)
   return NextResponse.json({error:"La imagen supera los 4 MB."},{status:413,headers});
  const form=await req.formData();
  const file=form.get("file"),team=String(form.get("team")||"");
  if(!ROUND_TEAMS.includes(team as typeof ROUND_TEAMS[number])||!(file instanceof File))
   return NextResponse.json({error:"Selecciona el equipo y su imagen."},{status:400,headers});
  if(!TYPES.has(file.type)||file.size<100||file.size>MAX_BYTES)
   return NextResponse.json({error:"Utiliza una imagen JPG, PNG, WebP o AVIF de hasta 4 MB."},{status:400,headers});
  let output:Buffer;
  try{
   const raw=Buffer.from(await file.arrayBuffer());
   const im=sharp(raw,{failOn:"error",limitInputPixels:16_000_000});
   const metadata=await im.metadata();
   if(!metadata.width||!metadata.height||!["png","jpeg","webp","avif"].includes(metadata.format||""))
    throw new Error("invalid_image");
   output=await im.rotate().resize(320,320,{fit:"contain",background:{r:0,g:0,b:0,alpha:0},withoutEnlargement:true}).webp({quality:83,effort:4}).toBuffer();
  }catch{
   return NextResponse.json({error:"No se ha podido procesar el escudo."},{status:400,headers});
  }
  const slug=team.toLowerCase().replace(/[^a-z0-9]+/g,"-");
  const name=`Escudos/admin-${slug}-${randomUUID()}.webp`;
  const {error:saveError}=await db.storage.from("Images").upload(name,output,{contentType:"image/webp",upsert:false,cacheControl:"31536000"});
  if(saveError)throw saveError;
  return NextResponse.json({ok:true,crest:"/api/assets/"+name+"?normalize=1"},{headers});
 }catch(e){
  console.error("quini-crest-upload",e);
  return NextResponse.json({error:"No se ha podido guardar el escudo."},{status:500,headers});
 }
}
