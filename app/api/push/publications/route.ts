import {timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import webpush from 'web-push';
import {deliverRoundPublications} from '../../../../lib/round-publication-push';

export const runtime='nodejs';
export const maxDuration=60;

export async function POST(req:NextRequest){
 const headers={'Cache-Control':'no-store'};
 const supplied=req.headers.get('authorization')||'';
 if(!supplied.startsWith('Bearer '))return NextResponse.json({error:'unauthorized'},{status:401,headers});
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('supabase_env');
  const db=createClient(url,key,{auth:{persistSession:false}});
  const {data,error}=await db.from('quini_round_push_config').select('dispatch_token').eq('id',true).single();
  if(error||!data)throw new Error('publication_config');
  const expected=Buffer.from('Bearer '+data.dispatch_token),actual=Buffer.from(supplied);
  if(expected.length!==actual.length||!timingSafeEqual(expected,actual))
   return NextResponse.json({error:'unauthorized'},{status:401,headers});
  const pub=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,priv=process.env.VAPID_PRIVATE_KEY;
  if(!pub||!priv)throw new Error('vapid_env');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT||'mailto:admin@quiniderio.app',pub,priv);
  return NextResponse.json({ok:true,...await deliverRoundPublications(db)},{headers});
 }catch{
  console.error('round-publication-push: dispatch failed; queued deliveries will retry');
  return NextResponse.json({error:'publication_dispatch'},{status:500,headers});
 }
}
