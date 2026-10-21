"use strict";
const SHELL="mercy-shell-v5";
const ASSETS=["./","./index.html","./mercy-modes.js"];
const MODEL_END="/onnx-community/SmolLM2-135M-Instruct-ONNX/onnx/model_int8.onnx";
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(ASSETS))
  .then(()=>self.skipWaiting()).catch(()=>{}));
});
self.addEventListener("message",event=>{
 if(event.data?.type==="MERCY_WORKER_VERSION"){
  event.ports?.[0]?.postMessage({version:5});
 }
});
self.addEventListener("activate",event=>{
 event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("mercy-shell-")&&k!==SHELL).map(k=>caches.delete(k)))),
  self.clients.claim()
 ]));
});
async function modelResponse(request){
 const base=new URL(request.url);
 const manifestUrl=new URL("../manifest.json",base);
 const cache=await caches.open(SHELL);
 let manifestResponse;
 try{
  manifestResponse=await fetch(manifestUrl.href);
  if(manifestResponse.ok)cache.put(manifestUrl.href,manifestResponse.clone()).catch(()=>{});
 }catch(e){manifestResponse=await cache.match(manifestUrl.href);}
 if(!manifestResponse?.ok)throw Error("The GitHub-hosted model manifest is unavailable.");
 const manifest=await manifestResponse.json();
 if(!Array.isArray(manifest.parts)||!manifest.parts.length||manifest.parts.length>20)throw Error("Invalid model manifest");
 let reader=null,index=0;
 const stream=new ReadableStream({
  async pull(controller){
   try{
    // Always enqueue, close or error on every pull. Returning without
    // doing any of those could stall ONNX model loading between chunks.
    for(;;){
     if(!reader){
      if(index>=manifest.parts.length){controller.close();return;}
      const part=manifest.parts[index++];
      if(!/^model_int8\.onnx\.part\d{2}$/.test(part))throw Error("Unsafe model part name");
      const url=new URL(part,base);
      let response;
      try{
       response=await fetch(url.href);
       if(response.ok)cache.put(url.href,response.clone()).catch(()=>{});
      }catch(e){response=await cache.match(url.href);}
      if(!response?.ok||!response.body)throw Error("Model part failed to load: "+part);
      reader=response.body.getReader();
     }
     const chunk=await reader.read();
     if(chunk.done){reader.releaseLock();reader=null;continue;}
     controller.enqueue(chunk.value);
     return;
    }
   }catch(e){controller.error(e);}
  },
  cancel(){reader?.cancel().catch(()=>{});}
 });
 return new Response(stream,{headers:{"Content-Type":"application/octet-stream"}});
}
self.addEventListener("fetch",event=>{
 const req=event.request;
 if(req.method!=="GET")return;
 const url=new URL(req.url);
 if(url.origin===self.location.origin&&url.pathname.endsWith(MODEL_END)){
  event.respondWith(modelResponse(req));return;
 }
 const sameOrigin=url.origin===self.location.origin;
 const vendorRuntime=url.hostname==="cdn.jsdelivr.net"&&(
  url.pathname.includes("@huggingface/transformers")||url.pathname.includes("onnxruntime-web"));
 if(!sameOrigin&&!vendorRuntime)return;
 event.respondWith((async()=>{
  const cache=await caches.open(SHELL);
  try{
   const response=await fetch(req);
   if(response.ok||response.type==="opaque")cache.put(req,response.clone()).catch(()=>{});
   return response;
  }catch(e){
   const saved=await cache.match(req,{ignoreSearch:true});
   if(saved)return saved;
   if(req.mode==="navigate"){const page=await cache.match("./index.html");if(page)return page;}
   throw e;
  }
 })());
});
