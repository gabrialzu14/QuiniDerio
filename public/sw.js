/* QuiniDerio intentionally never uses iOS app-icon badges. */
const clearBadge=async()=>{try{if(self.registration.clearAppBadge)await self.registration.clearAppBadge();else if(self.registration.setAppBadge)await self.registration.setAppBadge(0)}catch{}};
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil((async()=>{await self.clients.claim();await clearBadge()})()));
self.addEventListener("push",e=>{let d={};try{d=e.data?e.data.json():{}}catch{}e.waitUntil((async()=>{await clearBadge();await self.registration.showNotification(d.title||"QuiniDerio",{body:d.body||"Tienes un nuevo aviso.",renotify:false,icon:"https://bwonxnayayopbohxuphs.supabase.co/storage/v1/object/public/Images/branding/LogoApp.png",tag:d.tag||"quiniderio",data:{url:d.url||"/"}});await clearBadge();setTimeout(()=>{clearBadge()},1000);setTimeout(()=>{clearBadge()},4000)})())});
self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil((async()=>{await clearBadge();const cs=await self.clients.matchAll({type:"window",includeUncontrolled:true});if(cs.length)return cs[0].focus();return self.clients.openWindow(e.notification.data?.url||"/")})())});
self.addEventListener("message",e=>{if(e.data?.type==="CLEAR_BADGE")e.waitUntil(clearBadge())});

const CACHE="quiniderio-shell-v4";const SHELL=["/","/manifest.webmanifest","/launch.svg?v=3","/api/assets/branding/EscudoCarga.png?opt=3"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith("quiniderio-shell-")).map(k=>caches.delete(k)))))});
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET")return;const u=new URL(r.url);if(u.origin!==self.location.origin||u.pathname.startsWith("/api/"))return;if(r.mode==="navigate"){e.respondWith(fetch(r).catch(()=>caches.match("/")));return}if(["script","style","image","font"].includes(r.destination)){e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy))}return res})))}})
