const CACHE="homeos-shell-v5-food-illustrations";
const SHELL=["/","/manifest.webmanifest","/icon.svg?v=3"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(req.mode==="navigate"){
    event.respondWith(fetch(req).then(res=>{
      const copy=res.clone(); caches.open(CACHE).then(c=>c.put("/",copy)).catch(()=>{});
      return res;
    }).catch(()=>caches.match("/")));
    return;
  }
  if(["style","script","font","image","manifest"].includes(req.destination)){
    event.respondWith(caches.match(req).then(hit=>{
      const fresh=fetch(req).then(res=>{
        if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});}
        return res;
      }).catch(()=>hit);
      return hit||fresh;
    }));
  }
});
