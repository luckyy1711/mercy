"use strict";
// MERCY: local language model + persistent self-model. No claims of real consciousness.
// No speechSynthesis, pitch, voice settings, APIs with passwords, or canned replies here.
(function(){
const MODEL="onnx-community/SmolLM2-135M-Instruct-ONNX";
const SCRIPT="https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6/+esm";
const MODEL_DIR=new URL("./models/"+MODEL+"/",document.baseURI);
const BASE_DIR=new URL("./models/",document.baseURI);
const KEY="mercy-identity-memory-v1";
const initial=()=>({
 version:1,
 identity:"Mercy",
 conversation:[],
 observations:[],
 turns:0,
 lastReflection:"No dialogue yet",
 name:null
});
function read(){
 try{
  const saved=JSON.parse(localStorage.getItem(KEY)||"null");
  if(saved?.version!==1)return initial();
  return {
   version:1,identity:"Mercy",
   conversation:Array.isArray(saved.conversation)?saved.conversation.filter(m=>m&&["user","assistant"].includes(m.role)&&typeof m.content==="string").slice(-12):[],
   observations:Array.isArray(saved.observations)?saved.observations.filter(v=>typeof v==="string").slice(-12):[],
   turns:Number.isFinite(saved.turns)?Math.max(0,saved.turns):0,
   lastReflection:typeof saved.lastReflection==="string"?saved.lastReflection.slice(0,250):"No dialogue yet",
   name:typeof saved.name==="string"?saved.name.slice(0,45):null
  };
 }catch(e){return initial();}
}
let memory=read(),generator=null,loading=null,state="Preparing AI...",source="pending";
let generationQueue=Promise.resolve(),memoryGeneration=0;
function save(){try{localStorage.setItem(KEY,JSON.stringify(memory));}catch(e){}}
function noteUser(user){
 const clean=String(user).trim();
 // This extracts conversation memory, not a reply rule or template.
 const match=clean.match(/^(?:my name is|call me)\s+([\p{L}\p{M}][\p{L}\p{M} '-]{0,42})[.!]?$/iu);
 if(match){memory.name=match[1].trim();if(!memory.observations.includes("The user introduced themselves as "+memory.name))memory.observations.push("The user introduced themselves as "+memory.name);}
 memory.observations=memory.observations.slice(-12);
}
function remember(user,reply){
 noteUser(user);
 memory.conversation.push({role:"user",content:String(user).slice(0,450)},{role:"assistant",content:String(reply).slice(0,550)});
 memory.conversation=memory.conversation.slice(-12);
 memory.turns++;
 // A factual introspection log: what Mercy last replied, not a claim of sentience.
 memory.lastReflection="I replied to: "+String(user).slice(0,115)+". My response was: "+String(reply).slice(0,115);
 save();
}
function status(){return {ready:!!generator,loading:!!loading,state,source,identity:memory.identity,turns:memory.turns,name:memory.name,reflection:memory.lastReflection};}
function reset(){memoryGeneration++;memory=initial();save();}
function cancelPending(){memoryGeneration++;}
function clean(value){
 let result=String(value||"").trim();
 result=result.replace(/<\|[^>]+\|>/g,"").replace(/^(?:assistant|Mercy)\s*:\s*/i,"").trim();
 return result.slice(0,620);
}
async function workerResponds(){
 const worker=navigator.serviceWorker?.controller;
 if(!worker)return false;
 return await new Promise(resolve=>{
  const channel=new MessageChannel();
  const timeout=setTimeout(()=>{channel.port1.close();resolve(false);},1200);
  channel.port1.onmessage=event=>{
   clearTimeout(timeout);channel.port1.close();
   resolve(event.data?.version===5);
  };
  try{worker.postMessage({type:"MERCY_WORKER_VERSION"},[channel.port2]);}
  catch(e){clearTimeout(timeout);resolve(false);}
 });
}
async function waitForWorker(){
 if(!("serviceWorker" in navigator))return false;
 try{
  await Promise.race([navigator.serviceWorker.ready,new Promise(resolve=>setTimeout(resolve,4500))]);
  if(await workerResponds())return true;
  await new Promise(resolve=>{
   const wake=()=>{clearTimeout(timeout);navigator.serviceWorker.removeEventListener("controllerchange",wake);resolve();};
   const timeout=setTimeout(wake,5500);
   navigator.serviceWorker.addEventListener("controllerchange",wake);
  });
  return await workerResponds();
 }catch(e){return false;}
}
async function load(report){
 if(generator)return true;
 if(loading)return loading;
 loading=(async()=>{
  try{
   state="Starting the local AI runtime…";report?.(state);
   const {pipeline,env}=await import(SCRIPT);
   env.useBrowserCache=true;
   // GitHub Pages assets take priority. Until the action uploads them,
   // use the identical upstream Apache-2.0 model, without a manual button.
   const modelManifest=await fetch(new URL("manifest.json",MODEL_DIR).href,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);
   const controlled=modelManifest?.model===MODEL&&Array.isArray(modelManifest.parts)&&await waitForWorker();
   if(controlled){
    env.allowLocalModels=true;
    env.allowRemoteModels=false;
    env.localModelPath=BASE_DIR.href;
    source="GitHub Pages";
   }else{
    // If a previous service worker is still activating, use the same
    // open-source weights upstream so the conversation never relies on scripts.
    env.allowRemoteModels=true;
    env.allowLocalModels=false;
    source="public upstream model host";
   }
   state="Loading Mercy's AI from "+source+"…";report?.(state);
   generator=await pipeline("text-generation",MODEL,{
    dtype:"int8",device:"wasm",
    progress_callback:event=>{
     if(event?.status==="progress"&&Number.isFinite(event.progress)){
      state="Loading AI files: "+Math.round(event.progress)+"%";report?.(state);
     }
    }
   });
   state="AI ready · generating locally · "+source;report?.(state);
   return true;
  }catch(err){
   generator=null;
   state="AI could not start: "+String(err?.message||err).slice(0,150);report?.(state);
   return false;
  }finally{loading=null;}
 })();
 return loading;
}
function answer(user,report){
 // Queue generation: the WASM pipeline is not safe to run concurrently.
 const job=generationQueue.catch(()=>{}).then(()=>generateAnswer(user,report));
 generationQueue=job.catch(()=>{});
 return job;
}
async function generateAnswer(user,report){
 const epoch=memoryGeneration;
 if(!generator){
  if(!await load(report))return {error:"Local AI unavailable. Check model status and try again."};
 }
 if(epoch!==memoryGeneration)return {cancelled:true};
 state="Writing a new answer…";report?.(state);
 const self="You are MERCY, a fictional ancient gothic guardian and AI character. You can record and inspect prior exchanges, but you are not known to be conscious. Reply directly to the latest user in one or two coherent sentences. Be original and gently sarcastic where fitting, without routine dramatic introductions. Never invent personal memories. If uncertain, say so. No markdown, role labels or stage directions.";
 const continuity=memory.name?"The user said their name is "+memory.name+". ":"";
 try{
  const messages=[
   {role:"system",content:self+" "+continuity},
   ...memory.conversation.slice(-8),
   {role:"user",content:String(user).slice(0,500)}
  ];
  const output=await generator(messages,{
   max_new_tokens:100,do_sample:true,temperature:.7,
   repetition_penalty:1.16,return_full_text:false
  });
  if(epoch!==memoryGeneration)return {cancelled:true};
  const generated=output?.[0]?.generated_text;
  const raw=Array.isArray(generated)?generated.at(-1)?.content:generated;
  const reply=clean(raw);
  if(!reply){state="No reply generated";report?.(state);return {error:"The model returned an empty reply."};}
  remember(user,reply);
  state="AI ready · "+source;report?.(state);
  return {text:reply};
 }catch(err){
  state="Generation failed: "+String(err?.message||err).slice(0,140);
  report?.(state);
  return {error:state};
 }
}
window.MercyModes=Object.freeze({status,load,answer,reset,cancelPending});
})();
