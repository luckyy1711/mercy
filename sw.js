"use strict";
const SHELL="mercy-shell-v1";
const ASSETS=["./","./index.html","./reply-brain.js","./mercy-modes.js"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()).catch(()=>{}));
});
self.addEventListener("activate",event=>{
 event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("mercy-shell-")&&k!==SHELL).map(k=>caches.delete(k)))),
  self.clients.claim()
 ]));
});
self.addEventListener("fetch",event=>{
 const req=event.request;
 if(req.method!=="GET")return;
 const url=new URL(req.url);
 const sameOrigin=url.origin===self.location.origin;
 const isLibrary=url.hostname==="cdn.jsdelivr.net"&&url.pathname.includes("@huggingface/transformers");
 if(!sameOrigin&&!isLibrary)return; // Never cache search results or model weights here.
 event.respondWith((async()=>{
  const cache=await caches.open(SHELL);
  try{
   const response=await fetch(req);
   if(response.ok||response.type==="opaque")cache.put(req,response.clone()).catch(()=>{});
   return response;
  }catch(e){
   const cached=await cache.match(req,{ignoreSearch:true});
   if(cached)return cached;
   if(req.mode==="navigate"){const shell=await cache.match("./index.html");if(shell)return shell;}
   throw e;
  }
 })());
});
