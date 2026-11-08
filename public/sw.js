/* QuiniDerio intentionally never uses iOS app-icon badges. */
const clearBadge=async()=>{try{if(self.registration.clearAppBadge)await self.registration.clearAppBadge();else if(self.registration.setAppBadge)await self.registration.setAppBadge(0)}catch{}};
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil((async()=>{await self.clients.claim();await clearBadge()})()));
self.addEventListener("push",e=>{let d={};try{d=e.data?e.data.json():{}}catch{}e.waitUntil((async()=>{await clearBadge();await self.registration.showNotification(d.title||"QuiniDerio",{body:d.body||"Tienes un nuevo aviso.",renotify:false,icon:"https://bwonxnayayopbohxuphs.supabase.co/storage/v1/object/public/Images/branding/LogoApp.png",tag:d.tag||"quiniderio",data:{url:d.url||"/"}});await clearBadge();setTimeout(()=>{clearBadge()},1000);setTimeout(()=>{clearBadge()},4000)})())});
/* Open the tab the notification is about; reuse the running app when there is one. */
self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil((async()=>{await clearBadge();const url=new URL(e.notification.data?.url||"/",self.location.origin).href;const cs=await self.clients.matchAll({type:"window",includeUncontrolled:true});const c=cs.find(x=>x.focused)||cs[0];if(c){c.postMessage({type:"OPEN_URL",url});return c.focus()}return self.clients.openWindow(url)})())});
self.addEventListener("message",e=>{if(e.data?.type==="CLEAR_BADGE")e.waitUntil(clearBadge())});

const CACHE="quiniderio-shell-v5";const SHELL=["/","/manifest.webmanifest","/launch.svg?v=5","/api/assets/branding/EscudoCarga.png?opt=4"];const MAX_ENTRIES=160;
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith("quiniderio-shell-")).map(k=>caches.delete(k)))))});
/* Oldest entries go first so files from past deploys never pile up on the phone. */
const trim=async()=>{try{const c=await caches.open(CACHE);const keys=await c.keys();for(const k of keys.slice(0,Math.max(0,keys.length-MAX_ENTRIES)))await c.delete(k)}catch{}};
const store=(r,res)=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy)).then(trim)}return res};
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET")return;const u=new URL(r.url);if(u.origin!==self.location.origin||u.pathname.startsWith("/api/"))return;if(r.mode==="navigate"){e.respondWith(fetch(r).catch(()=>caches.match("/")));return}if(!["script","style","image","font"].includes(r.destination))return;
/* Hashed build files and versioned assets never change: cache first. */
if(u.pathname.startsWith("/_next/static/")||u.search){e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>store(r,res))));return}
/* Unversioned public files (crests, icons) can change: network first, cache offline. */
e.respondWith(fetch(r).then(res=>store(r,res)).catch(()=>caches.match(r).then(hit=>hit||Response.error())))})
