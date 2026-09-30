import {NextRequest,NextResponse} from "next/server";

const ORIGIN="https://bwonxnayayopbohxuphs.supabase.co/storage/v1/object/public/Images";

export const runtime="nodejs";

export async function GET(req:NextRequest,{params}:{params:Promise<{path:string[]}>}){
  try{
    const {path}=await params;
    const parts=(path||[]).filter(Boolean);
    if(!parts.length||parts.some(p=>p===".."||p.includes("\\"))) return new NextResponse("Bad request",{status:400});
    const upstream=ORIGIN+"/"+parts.map(encodeURIComponent).join("/");
    const r=await fetch(upstream,{cache:"force-cache",next:{revalidate:31536000}});
    if(!r.ok) return new NextResponse("Asset not found",{status:r.status});
    const body=await r.arrayBuffer();
    return new NextResponse(body,{status:200,headers:{
      "Content-Type":r.headers.get("content-type")||"application/octet-stream",
      "Cache-Control":"public, max-age=31536000, s-maxage=31536000, immutable",
      "CDN-Cache-Control":"public, max-age=31536000, immutable",
      "Vercel-CDN-Cache-Control":"public, max-age=31536000, immutable"
    }});
  }catch(e){
    console.error("asset proxy",e);
    return new NextResponse("Asset error",{status:502});
  }
}
