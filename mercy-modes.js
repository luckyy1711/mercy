"use strict";
// Local generative AI only. No Wikipedia lookup, canned answers, or reply rules.
// The original browser voice is defined separately in index.html.
(function(){
const MODEL="onnx-community/SmolLM-135M-Instruct-ONNX";
const SCRIPT="https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6/+esm";
let generator=null,loading=null,state="Not loaded";
let history=[];
const system="You are Mercy, a fictional ancient gothic guardian with dry sarcastic wit. Speak naturally as a character, in a short, direct answer. Respond specifically to the user's actual message and question. Be conversational, varied and coherent. Do not repeat empty stock introductions. If uncertain, be truthful. You do not possess real consciousness. Do not output markdown, names of speakers, or stage directions.";
function status(){return {ready:!!generator,loading:!!loading,state};}
function reset(){history=[];}
function clean(value){
 let text=String(value||"").trim();
 text=text.replace(/<\\|[^>]+\\|>/g,"").replace(/^(?:assistant|Mercy)\\s*:\\s*/i,"");
 return text.slice(0,600).trim();
}
async function load(report){
 if(generator)return true;
 if(loading)return loading;
 loading=(async()=>{
  try{
   state="Loading local AI runtime…";report?.(state);
   const {pipeline,env}=await import(SCRIPT);
   env.useBrowserCache=true;
   env.allowRemoteModels=true;
   state="Loading 135M AI model (first use downloads files)…";report?.(state);
   generator=await pipeline("text-generation",MODEL,{
    dtype:"q4",device:"wasm",
    progress_callback:(event)=>{
     if(event&&event.status==="progress"&&Number.isFinite(event.progress)){
      state="Downloading model: "+Math.round(event.progress)+"%";
      report?.(state);
     }
    }
   });
   state="AI ready · responses generated locally";report?.(state);
   return true;
  }catch(err){
   generator=null;
   state="AI not available: "+String(err?.message||err).slice(0,145);
   report?.(state);
   return false;
  }finally{loading=null;}
 })();
 return loading;
}
async function answer(user,report){
 if(!generator){
  const ok=await load(report);
  if(!ok)return {error:"Mercy's offline AI could not load. Connect to the internet for the first model download, then try Load AI Brain again."};
 }
 state="Generating original reply…";report?.(state);
 try{
  const messages=[
   {role:"system",content:system},
   ...history.slice(-8),
   {role:"user",content:String(user).slice(0,500)}
  ];
  const result=await generator(messages,{
   max_new_tokens:100,
   do_sample:true,
   temperature:0.75,
   repetition_penalty:1.16,
   return_full_text:false
  });
  const output=result?.[0]?.generated_text;
  const raw=Array.isArray(output)?output.at(-1)?.content:output;
  const reply=clean(raw);
  if(!reply){state="Model returned no reply";return {error:"The local model returned an empty reply. Please try again."};}
  history.push({role:"user",content:String(user).slice(0,500)},{role:"assistant",content:reply});
  if(history.length>10)history=history.slice(-10);
  state="AI ready · responses generated locally";
  return {text:reply};
 }catch(err){
  state="Generation failed: "+String(err?.message||err).slice(0,130);
  return {error:state};
 }
}
window.MercyModes=Object.freeze({status,load,answer,reset});
})();
