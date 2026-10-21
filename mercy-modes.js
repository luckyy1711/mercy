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
function reset(){memory=initial();save();}
function clean(value){
 let result=String(value||"").trim();
 result=result.replace(/<\|[^>]+\|>/g,"").replace(/^(?:assistant|Mercy)\s*:\s*/i,"").trim();
 return result.slice(0,620);
}
async function waitForWorker(){
 if(!("serviceWorker" in navigator))return false;
 try{
  await Promise.race([navigator.serviceWorker.ready,new Promise(resolve=>setTimeout(resolve,3500))]);
  return Boolean(navigator.serviceWorker.controller);
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
   if(modelManifest?.model===MODEL&&Array.isArray(modelManifest.parts)){
    const controlled=await waitForWorker();
    if(!controlled)throw Error("Offline model service worker is not active; reload once.");
    env.allowLocalModels=true;
    env.allowRemoteModels=false;
    env.localModelPath=BASE_DIR.href;
    source="GitHub Pages";
   }else{
    env.allowRemoteModels=true;
    env.allowLocalModels=false;
    source="upstream model host (GitHub upload pending)";
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
async function answer(user,report){
 if(!generator){if(!await load(report))return {error:"Local AI unavailable. Check the status and try again."};}
 state="Writing a new answer…";report?.(state);
 const self="You are MERCY, a fictional ancient gothic guardian and an AI character. You can monitor your model state, record prior exchanges and examine your responses, but you are not known to be conscious or capable of subjective experience. Never pretend proven sentience. Respond directly to the latest user with original, specific language, concise dry sarcasm where fitting; don't always introduce yourself, don't sound like a search result. Be honest when uncertain. No markdown, stage directions or fake laughter noises.";
 const continuity=memory.name?"The user told you their name is "+memory.name+". ":"";
 const introspection="You have recorded "+memory.turns+" previous conversation turns. Your last logged reply: "+memory.lastReflection.slice(0,230)+".";
 try{
  const messages=[
   {role:"system",content:self+" "+continuity+introspection},
   ...memory.conversation.slice(-8),
   {role:"user",content:String(user).slice(0,500)}
  ];
  const output=await generator(messages,{
   max_new_tokens:110,do_sample:true,temperature:.78,
   repetition_penalty:1.16,return_full_text:false
  });
  const generated=output?.[0]?.generated_text;
  const raw=Array.isArray(generated)?generated.at(-1)?.content:generated;
  const reply=clean(raw);
  if(!reply){state="No reply generated";report?.(state);return {error:"The AI returned no answer."};}
  remember(user,reply);
  state="AI ready · "+source;report?.(state);
  return {text:reply};
 }catch(err){
  state="Generation failed: "+String(err?.message||err).slice(0,140);
  report?.(state);
  return {error:state};
 }
}
window.MercyModes=Object.freeze({status,load,answer,reset});
})();
