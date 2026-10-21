"use strict";
// MERCY MODES — reply generation and public-knowledge lookup only.
// Deliberately does not touch voice settings, pitch, rate or speechSynthesis.
(function(){
const MODEL="onnx-community/SmolLM-135M-Instruct-ONNX";
let generator=null,loading=null,localState="not downloaded",lastSource=null;
const history=[];
function online(){return navigator.onLine!==false;}
function available(){return typeof fetch==="function";}
function strip(text){return String(text||"").replace(/\s+/g," ").replace(/\[[0-9]+\]/g,"").trim();}
function cleanAnswer(value){
 const raw=typeof value==="string"?value:"";
 const s=raw.replace(/<\|[^>]+\|>/g,"").replace(/^assistant\s*:?\s*/i,"").trim();
 return s.slice(0,480);
}
function status(){return {online:online(),localState,ready:!!generator,source:lastSource};}
async function installLocal(progress){
 if(generator)return true;
 if(loading)return loading;
 if(!online()){localState="offline: model must be downloaded first";progress?.(localState);return false;}
 loading=(async()=>{
  try{
   localState="loading tiny offline model";progress?.(localState);
   // Browser import and model download are requested only after explicit button click.
   const {pipeline,env}=await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6/+esm");
   env.useBrowserCache=true;
   env.allowRemoteModels=true;
   generator=await pipeline("text-generation",MODEL,{
    dtype:"q4",
    device:"wasm",
    progress_callback:(evt)=>{
     if(evt?.status==="progress"&&Number.isFinite(evt.progress)){localState="downloading: "+Math.round(evt.progress)+"%";progress?.(localState);}
    }
   });
   localState="offline model ready";progress?.(localState);
   return true;
  }catch(e){
   generator=null;
   localState="model unavailable on this device";progress?.(localState);
   return false;
  }finally{loading=null;}
 })();
 return loading;
}
async function generate(prompt,maxTokens=85){
 if(!generator)return null;
 try{
  const messages=[{role:"system",content:"You are Mercy, a fictional ancient fallen guardian. Use clear English. Respond in one or two short sentences. Be sarcastic but not cruel. Never invent sourced facts. Never include tags or role labels."},...history.slice(-4),{role:"user",content:prompt.slice(0,900)}];
  const output=await generator(messages,{max_new_tokens:maxTokens,do_sample:true,temperature:.75,repetition_penalty:1.12});
  const generated=output?.[0]?.generated_text;
  const text=Array.isArray(generated)?generated.at(-1)?.content:generated;
  return cleanAnswer(text);
 }catch(e){return null;}
}
function chatHistory(user,reply){
 history.push({role:"user",content:user.slice(0,250)},{role:"assistant",content:reply.slice(0,450)});
 while(history.length>12)history.shift();
}
function queryFrom(text){
 let q=strip(text).replace(/^(?:mercy[, ]+)?(?:please )?/i,"");
 q=q.replace(/^(?:can you )?(?:tell me about|tell me what|tell me who|explain(?: to me)?|search(?: the web)?(?: for)?|look up|find out about|give me facts about|what is|what are|what was|what were|who is|who was|where is|when was|why is|how does|how do|history of)\s+/i,"");
 q=q.replace(/[?!.,]+$/,"").slice(0,110).trim();
 return q;
}
function wantsSearch(text){
 const t=strip(text).toLowerCase().replace(/[!?.,]+$/,"").trim();
 if(t.length<7||t.split(/\s+/).length<2)return false;
 // A question mark alone does not imply research. Casual exchanges stay conversational.
 if(/^(?:yo|hey|hi|hello|sup|what|what's up|whats up|how are you|you there|really|why|huh|ok|okay|yes|no|lol|thanks|thank you|who are you|what's your name|what is your name|what did you mean|what do you mean|how do you feel|are you okay|can you hear me|tell me a joke)[?!. ]*$/.test(t))return false;
 if(/^(?:i |i'm |im |my |you |we |let's |lets |thank |sorry |good |bad |nice |haha|lol|make me |do you |are you |can you )/.test(t))return false;
 return /^(?:what (?:is|are|was|were) .+|who (?:is|was|are|were) .+|where (?:is|are|was|were) .+|when (?:was|did|is) .+|why (?:is|are|does|do|did) .+|how (?:does|do|did|is) .+|tell me about .+|explain .+|search(?: the web)?(?: for)? .+|look up .+|find out about .+|give me facts about .+|history of .+)$/.test(t);
}
async function wikiLookup(query,signal){
 const url=new URL("https://en.wikipedia.org/w/api.php");
 const params={action:"query",generator:"search",gsrsearch:query,gsrlimit:"5",prop:"extracts|info|pageprops",ppprop:"disambiguation",inprop:"url",exintro:"1",explaintext:"1",exchars:"650",format:"json",origin:"*"};
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 const response=await fetch(url.toString(),{signal,credentials:"omit",cache:"no-store"});
 if(!response.ok)throw new Error("Search unavailable");
 const json=await response.json();
 const pages=Object.values(json?.query?.pages||{}).sort((a,b)=>(a.index||99)-(b.index||99));
 const p=pages.find(p=>{
  if(typeof p.extract!=="string"||p.extract.trim().length<55)return false;
  if(p.pageprops?.disambiguation!==undefined)return false;
  if(/\b(?:may also refer to|most often refers to|may refer to|can refer to)\s*:/i.test(p.extract))return false;
  if(/\(disambiguation\)/i.test(p.title))return false;
  if(/^(what|who|why|how|yes|no|hello|hi|yo)$/i.test(p.title))return false;
  return true;
 });
 if(!p)return null;
 const title=strip(p.title),extract=strip(p.extract);
 return {title,extract,url:p.fullurl||"https://en.wikipedia.org/wiki/"+encodeURIComponent(title.replace(/ /g,"_"))};
}
function sarcasticFacts(found){
 const sentences=found.extract.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[];
 const fact=sentences.slice(0,2).join(" ").trim().slice(0,360);
 const openers=["Ah yes. A question worthy of disturbing my eternal silence.","How fortunate for you that I still remember how to read.","The archives speak. Try not to look too impressed.","Even the dust-covered archives have an answer to that."];
 const opener=openers[(found.title.length+history.length)%openers.length];
 return opener+" "+fact;
}
async function answer(text,{signal,progress}={}){
 lastSource=null;
 if(!online()||!available()){
  progress?.("Offline · local reply");
  const generated=await generate(text);
  if(generated){chatHistory(text,generated);return {text:generated,mode:"offline model"};}
  return null; // caller uses the existing offline memory/rule brain
 }
 if(wantsSearch(text)){
  try{
   progress?.("Searching public reference…");
   const found=await wikiLookup(queryFrom(text),signal);
   if(found){
    lastSource={title:found.title,url:found.url};
    // Ground the factual part deterministically, so a tiny model cannot hallucinate it.
    const response=sarcasticFacts(found);
    chatHistory(text,response);
    return {text:response,mode:"online source",source:lastSource};
   }
  }catch(e){if(signal?.aborted)throw e;progress?.("Search unavailable · falling back");}
 }
 if(generator){
  progress?.("Mercy's local brain is thinking…");
  const generated=await generate(text);
  if(generated){chatHistory(text,generated);return {text:generated,mode:"local model"};}
 }
 return null;
}
window.MercyModes=Object.freeze({status,answer,installLocal});
})();
