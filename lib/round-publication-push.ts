import type {SupabaseClient} from '@supabase/supabase-js';
import webpush from 'web-push';

type Delivery = {
 delivery_id:string; round:number; subscription_id:number; player_id:string;
 endpoint:string; p256dh:string; auth:string; lease_token:string; attempts:number;
};

export function publicationMessage(round:number){
 return {title:`Jornada ${round} ya disponible`,
  body:'Ya puedes completar tus pronósticos en QuiniDerio.',
  url:'/',tag:`quiniderio-round-available-${round}`};
}

// Injectable transport keeps verification isolated from real subscriber devices.
export async function deliverRoundPublications(db:SupabaseClient,send=webpush.sendNotification){
 const {data,error}=await db.rpc('quini_claim_round_push');
 if(error)throw error;
 const deliveries=(data||[]) as Delivery[];
 const stats={claimed:deliveries.length,accepted:0,failed:0,expired:0};
 async function save(d:Delivery,patch:Record<string,unknown>){
  const {error}=await db.from('quini_round_push_deliveries').update(patch)
   .eq('id',d.delivery_id).eq('lease_token',d.lease_token);
  if(error)throw error;
 }
 async function deliver(d:Delivery){
  // A device can unsubscribe or a round can close after it was queued.
  const [subscription,event]=await Promise.all([
   db.from('push_subscriptions').select('enabled').eq('id',d.subscription_id).maybeSingle(),
   db.from('quini_round_push_events').select('expires_at').eq('round',d.round).single()
  ]);
  if(subscription.error||event.error)throw subscription.error||event.error;
  const remaining=new Date(event.data.expires_at).getTime()-Date.now();
  if(!subscription.data?.enabled||remaining<=0){
   await save(d,{status:'expired',lease_token:null});stats.expired++;return;
  }
  try{
   await send({endpoint:d.endpoint,keys:{p256dh:d.p256dh,auth:d.auth}},
    JSON.stringify(publicationMessage(d.round)),
    {TTL:Math.max(1,Math.min(86400,Math.floor(remaining/1000))),urgency:'normal',timeout:10000});
  }catch(error:unknown){
   const status=Number((error as {statusCode?:number})?.statusCode||0);
   if(status===404||status===410){
    const {error:disabled}=await db.from('push_subscriptions')
     .update({enabled:false,updated_at:new Date().toISOString()}).eq('id',d.subscription_id);
    if(disabled)throw disabled;
    await save(d,{status:'expired',lease_token:null,last_error:`HTTP ${status}`});stats.expired++;
   }else{
    await save(d,{status:'pending',lease_token:null,last_error:status?`HTTP ${status}`:'transport_error',
     next_attempt_at:new Date(Date.now()+Math.min(3600,60*2**Math.min(d.attempts,6))*1000).toISOString()});
    stats.failed++;
   }
   return;
  }
  // Save acceptance outside the transport catch: an uncertain DB acknowledgement
  // retains the lease instead of immediately sending the same push again.
  await save(d,{status:'accepted',accepted_at:new Date().toISOString(),lease_token:null,last_error:null});
  stats.accepted++;
 }
 for(let i=0;i<deliveries.length;i+=5){
  const results=await Promise.allSettled(deliveries.slice(i,i+5).map(deliver));
  if(results.some(r=>r.status==='rejected'))throw new Error('publication_delivery_persistence');
 }
 return stats;
}
