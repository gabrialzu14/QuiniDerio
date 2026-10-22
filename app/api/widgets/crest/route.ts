import {NextRequest,NextResponse} from "next/server";
import sharp from "sharp";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const asset=req.nextUrl.searchParams.get("asset")||"";
 const prefix="/api/assets/Escudos/";
 let name:string;
 try{name=decodeURIComponent(asset.split("?")[0].slice(prefix.length))}catch{return new NextResponse(null,{status:400})}
 if(!asset.startsWith(prefix)||!name||/[\\/\x00-\x1f]/.test(name)||name.includes("..")||name.length>180)return new NextResponse(null,{status:400});
 try{
  const url="https://bwonxnayayopbohxuphs.supabase.co/storage/v1/object/public/Images/Escudos/"+encodeURIComponent(name);
  const upstream=await fetch(url,{next:{revalidate:86400},signal:AbortSignal.timeout(6000)});
  if(!upstream.ok)return new NextResponse(null,{status:404});
  const bytes=await upstream.arrayBuffer();if(bytes.byteLength>4*1024*1024)return new NextResponse(null,{status:413});
  const png=await sharp(Buffer.from(bytes),{limitInputPixels:16000000}).trim().resize(64,64,{fit:"contain",background:"#00000000"}).png().toBuffer();
  return new NextResponse(new Uint8Array(png),{headers:{"Content-Type":"image/png","Cache-Control":"public, max-age=86400, s-maxage=86400"}});
 }catch{return new NextResponse(null,{status:502})}
}
