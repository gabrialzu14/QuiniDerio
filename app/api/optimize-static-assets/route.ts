import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import sharp from "sharp";

export const runtime="nodejs";
export const maxDuration=60;

const ASSETS=[
"entrenadores/NandoAlonso2.png","entrenadores/GorkaBarrio2.png","entrenadores/IkerIbarluzea.png",
"entrenadores/IbaiMateos2.png","entrenadores/PeioGarcia2.png","entrenadores/MikelTara.png",
"entrenadores/GaizkaGarcia.png","entrenadores/DinioDerio.jpeg","branding/ImagenPortada.png",
"branding/LogoApp.png","branding/EscudoCarga.png","Escudos/cd_derio.png","Escudos/BEASAIN.png",
"Escudos/Lakua.png","Escudos/IbaiondoNerbioi.png","Escudos/Escolapios.png","Escudos/Iturrigorri.png","Escudos/SD LEIOA.png"
];

function client(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||"";
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
 if(!url||!key)throw new Error("supabase_env");
 return createClient(url,key,{auth:{persistSession:false}});
}

export async function GET(req:NextRequest){
 if(req.nextUrl.searchParams.get("run")!=="2026-static-optimize")return new NextResponse("Not found",{status:404});
 try{
  const db=client();
  const results=[];
  for(const src of ASSETS){
   const backup="_originals/"+src;
   await db.storage.from("Images").copy(src,backup).catch(()=>undefined);
   const {data,error}=await db.storage.from("Images").download(src);
   if(error||!data){results.push({src,error:error?.message||"download"});continue}
   const raw=Buffer.from(await data.arrayBuffer());
   const folder=src.split("/")[0].toLowerCase();
   const width=folder==="entrenadores"?960:folder==="escudos"?512:1600;
   const keepPng=src==="branding/LogoApp.png";
   const pipe=sharp(raw,{failOn:"none"}).resize({width,withoutEnlargement:true,fit:"inside"});
   const out=keepPng
    ?await pipe.png({compressionLevel:9,palette:true}).toBuffer()
    :await pipe.webp({quality:folder==="escudos"?86:82,effort:5}).toBuffer();
   const contentType=keepPng?"image/png":"image/webp";
   const {error:uploadError}=await db.storage.from("Images").upload(src,out,{upsert:true,contentType,cacheControl:"31536000"});
   results.push({src,before:raw.length,after:out.length,error:uploadError?.message||null});
  }
  return NextResponse.json({ok:true,results});
 }catch(error){
  console.error("static asset optimize",error);
  return NextResponse.json({ok:false,error:String(error)},{status:500});
 }
}
