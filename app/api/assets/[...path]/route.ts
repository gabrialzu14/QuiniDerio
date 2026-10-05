import {NextRequest,NextResponse} from "next/server";
import sharp from "sharp";

const ORIGIN="https://bwonxnayayopbohxuphs.supabase.co/storage/v1/object/public/Images";
export const runtime="nodejs";

export async function GET(req:NextRequest,{params}:{params:Promise<{path:string[]}>}){
 try{
  const {path}=await params;const parts=(path||[]).filter(Boolean);
  if(!parts.length||parts.some(p=>p===".."||p.includes("\\")))return new NextResponse("Bad request",{status:400});
  const upstream=ORIGIN+"/"+parts.map(encodeURIComponent).join("/");
  const r=await fetch(upstream,{cache:"force-cache",next:{revalidate:31536000}});
  if(!r.ok)return new NextResponse("Asset not found",{status:r.status});
  const raw=Buffer.from(await r.arrayBuffer());
  const folder=parts[0]?.toLowerCase();
  const filename=(parts.at(-1)||"").toLowerCase();
  const isSplash=folder==="branding"&&filename.includes("escudocarga");
  const isLogo=folder==="branding"&&filename.includes("logoapp");
  const isHomeCover=folder==="branding"&&filename.includes("imagenportada");
  const width=folder==="entrenadores"?384:folder==="escudos"?160:isHomeCover?1672:isSplash?320:isLogo?640:640;
  const quality=folder==="escudos"?78:isHomeCover?90:folder==="branding"?82:74;
  try{
   const body=await sharp(raw,{failOn:"none"})
    .resize({width,withoutEnlargement:true,fit:"inside"})
    .webp({quality,effort:5,smartSubsample:true})
    .toBuffer();
   return new NextResponse(new Uint8Array(body),{status:200,headers:{
    "Content-Type":"image/webp",
    "Cache-Control":"public, max-age=31536000, s-maxage=31536000, immutable",
    "Vercel-CDN-Cache-Control":"public, max-age=31536000, immutable"
   }});
  }catch{
   return new NextResponse(new Uint8Array(raw),{status:200,headers:{"Content-Type":r.headers.get("content-type")||"application/octet-stream","Cache-Control":"public, max-age=86400, s-maxage=86400"}});
  }
 }catch(e){console.error("asset proxy",e);return new NextResponse("Asset error",{status:502})}
}
