/* QuiniDerio intentionally never uses iOS app-icon badges. */
const clearBadge=async()=>{try{if(self.registration.clearAppBadge)await self.registration.clearAppBadge();else if(self.registration.setAppBadge)await self.registration.setAppBadge(0)}catch{}};
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil((async()=>{await self.clients.claim();await clearBadge()})()));
self.addEventListener("push",e=>{let d={};try{d=e.data?e.data.json():{}}catch{}e.waitUntil((async()=>{await clearBadge();await self.registration.showNotification(d.title||"QuiniDerio",{body:d.body||"Tienes un nuevo aviso.",renotify:false,icon:"https://bwonxnayayopbohxuphs.supabase.co/storage/v1/object/public/Images/branding/LogoApp.png",tag:d.tag||"quiniderio",data:{url:d.url||"/"}});await clearBadge();setTimeout(()=>{clearBadge()},1000);setTimeout(()=>{clearBadge()},4000)})())});
self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil((async()=>{await clearBadge();const cs=await self.clients.matchAll({type:"window",includeUncontrolled:true});if(cs.length)return cs[0].focus();return self.clients.openWindow(e.notification.data?.url||"/")})())});
self.addEventListener("message",e=>{if(e.data?.type==="CLEAR_BADGE")e.waitUntil(clearBadge())});
