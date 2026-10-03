import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime="nodejs";

export async function GET(_request:Request,{params}:{params:Promise<{userId:string}>}){
  try{
    const {userId}=await params;
    if(!/^[0-9a-f-]{36}$/i.test(userId))return new NextResponse("Bad request",{status:400});

    const base=process.env.NEXT_PUBLIC_SUPABASE_URL||"";
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
    if(!base||!serviceKey)return new NextResponse("Unavailable",{status:503});

    const supabase=createClient(base,serviceKey,{auth:{persistSession:false}});
    const {data,error}=await supabase.from("quini_profiles").select("profile_pic").eq("user_id",userId).maybeSingle();
    if(error)return new NextResponse("Avatar unavailable",{status:500});

    const value=typeof data?.profile_pic==="string"?data.profile_pic.trim():"";
    if(!value)return new NextResponse("Not found",{status:404});

    const match=value.match(/^data:([^;]+);base64,([\s\S]+)$/);
    if(match){
      const body=Buffer.from(match[2],"base64");
      return new NextResponse(new Uint8Array(body),{
        headers:{
          "Content-Type":match[1]||"image/webp",
          "Cache-Control":"public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
          "Vercel-CDN-Cache-Control":"public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    if(/^https?:\/\//i.test(value)){
      const image=await fetch(value,{cache:"force-cache",next:{revalidate:86400}});
      if(!image.ok)return new NextResponse("Not found",{status:404});
      return new NextResponse(new Uint8Array(await image.arrayBuffer()),{
        headers:{
          "Content-Type":image.headers.get("content-type")||"image/webp",
          "Cache-Control":"public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
          "Vercel-CDN-Cache-Control":"public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    return new NextResponse("Not found",{status:404});
  }catch(error){
    console.error("avatar proxy",error);
    return new NextResponse("Avatar error",{status:502});
  }
}
