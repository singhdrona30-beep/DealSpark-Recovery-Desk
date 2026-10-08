const CACHE="dealspark-pwa-v2";
const SHELL=["./","./index.html","./chatbot.html","./lead-recovery.html","./quote-flow.html","./reactivate.html","./phone-agent.html","./styles.css","./chatbot.css","./chatbot.js","./receptionist-manifest.json","./recovery-manifest.json","./quoteflow-manifest.json","./reactivate-manifest.json","./phone-manifest.json","./receptionist-icon.svg","./recovery-icon.svg","./quoteflow-icon.svg","./reactivate-icon.svg","./phone-icon.svg"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET") return;
 e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{
   const copy=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return r;
 }).catch(()=>caches.match("./index.html"))));
});