import {NextResponse} from "next/server";

export const runtime="nodejs";

export async function GET(_request:Request,{params}:{params:Promise<{userId:string}>}){
  try{
    const {userId}=await params;
    if(!/^[0-9a-f-]{36}$/i.test(userId))return new NextResponse("Bad request",{status:400});

    const base=process.env.NEXT_PUBLIC_SUPABASE_URL||"";
    const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||"";
    if(!base||!key)return new NextResponse("Unavailable",{status:503});

    const url=`${base}/rest/v1/quini_public_profiles?user_id=eq.${encodeURIComponent(userId)}&select=profile_pic&limit=1`;
    const response=await fetch(url,{
      headers:{apikey:key,Authorization:`Bearer ${key}`},
      cache:"no-store",
    });
    if(!response.ok)return new NextResponse("Avatar unavailable",{status:response.status});

    const rows=await response.json() as Array<{profile_pic?:string|null}>;
    const value=rows[0]?.profile_pic?.trim()||"";
    if(!value)return new NextResponse("Not found",{status:404});

    const data=value.match(/^data:([^;]+);base64,(.+)$/s);
    if(data){
      const body=Buffer.from(data[2],"base64");
      return new NextResponse(new Uint8Array(body),{
        headers:{
          "Content-Type":data[1]||"image/webp",
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
