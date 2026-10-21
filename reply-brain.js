"use strict";
// MERCY REPLY BRAIN — no speechSynthesis, audio, pitch, rate or UI settings here.
// Changes are stored as restricted reply data, never evaluated as JavaScript.
(function(){
const KEY="mercyReplyBrainV1";
const base={
  version:1,
  name:"",
  facts:[],
  rules:[],
  conversations:[],
  revision:0,
  patterns:[],
  tone:"observant"
};
function validRule(r){return r&&typeof r.trigger==="string"&&typeof r.response==="string"&&r.trigger.length>=2&&r.trigger.length<=100&&r.response.length>=1&&r.response.length<=400;}
function load(){
 try{
  const v=JSON.parse(localStorage.getItem(KEY)||"null");
  if(!v||v.version!==1)return structuredClone(base);
  return {version:1,name:typeof v.name==="string"?v.name.slice(0,40):"",
    facts:Array.isArray(v.facts)?v.facts.filter(x=>typeof x==="string").slice(-12):[],
    rules:Array.isArray(v.rules)?v.rules.filter(validRule).slice(-30):[],
    conversations:Array.isArray(v.conversations)?v.conversations.filter(x=>x&&typeof x.you==="string"&&typeof x.mercy==="string").slice(-12):[],
    revision:Number.isFinite(v.revision)?v.revision:0,
    patterns:Array.isArray(v.patterns)?v.patterns.filter(p=>p&&typeof p.topic==="string"&&typeof p.lastResponse==="string"&&Array.isArray(p.history)).slice(-35):[],
    tone:["observant","gentle","wary","solemn"].includes(v.tone)?v.tone:"observant"};
 }catch(e){return JSON.parse(JSON.stringify(base));}
}
let brain=load(),model=null,attempted=false;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(brain));}catch(e){}}
function norm(t){return t.toLowerCase().trim().replace(/[.!?]+$/g,"").replace(/\s+/g," ");}
function remember(you,mercy,emotion="watchful"){
 evolve(you,mercy,emotion);
 brain.conversations.push({you:you.slice(0,400),mercy:mercy.slice(0,500)});
 brain.conversations=brain.conversations.slice(-12);persist();
}
function pick(options){return options[(brain.conversations.length+brain.revision)%options.length];}
function autoRefine(trigger,response){
 const target=norm(trigger);
 if(target.length<2||target.length>100)return false;
 const rule={trigger:target,response:response.slice(0,400)};
 const i=brain.rules.findIndex(r=>r.trigger===target);
 if(i>=0)brain.rules[i]=rule;else brain.rules.push(rule);
 brain.rules=brain.rules.slice(-30);brain.revision++;persist();return true;
}
// Autonomous reply-pattern revisions from ordinary conversations.
const STOP=new Set("this that there these those about would should could what where when which whose with from into your mine ours them they have been were just very really please mercy think thing something anything everything dont cant didnt does doing want need more some here also then than because right okay yeah sure hello hey hi".split(" "));
function topicOf(text){
 const words=norm(text).match(/[a-z]{3,}/g)||[];
 const viable=words.filter(w=>!STOP.has(w));
 return viable.sort((a,b)=>b.length-a.length)[0]||"conversation";
}
function nextTone(text,emotion){
 if(emotion==="tender")return "gentle";
 if(emotion==="uneasy"||emotion==="offended")return "wary";
 if(emotion==="sorrowful")return "solemn";
 if(/\b(why|how|explain|wonder|question)\b/i.test(text))return "observant";
 return brain.tone;
}
function evolvingReply(text,topic,prior){
 const t=norm(text);
 const count=prior?.history?.length||0;
 const questionWords=new Set(["what","who","where","when","why","how","can","could","do","does","is","are","will","would","should"]);
 const first=t.split(" ")[0];
 if(t.includes("how are you"))return "I remain beneath these silent stars. And you, wanderer, how fares your heart?";
 if(t.includes("what can you do"))return "I can speak, remember our exchanges and change how I answer. I cannot yet know every answer in the world.";
 if(t.includes("who made you")||t.includes("who created you")||t.includes("who built you"))return "I was shaped by a human hand, and given a name: Mercy.";
 if(questionWords.has(first)||text.trim().endsWith("?")||t.startsWith("tell me about")){
  if(["weather","temperature","news","price","score"].some(x=>t.includes(x)))return "I cannot check live information yet. I would rather admit the darkness than invent an answer.";
  const opener=count?"We have spoken of "+topic+" before. ":"";
  return opener+"I don't know enough about "+topic+" to give you a reliable answer yet. What would you like to explore about it?";
 }
 if(t.startsWith("i am ")||t.startsWith("i'm ")||t.startsWith("i feel ")){
  const feeling=text.trim().replace(/^(i am |i'm |i feel )/i,"").slice(0,100);
  return "You feel "+feeling+". I hear you. Would you tell me why?";
 }
 if(["i want ","i need ","i wish ","i hope "].some(x=>t.startsWith(x)))return "You speak of "+topic+". What would you like to happen next?";
 const endings=["What matters most to you about it?","What happened next?","What would you have me understand?","Would you tell me more?"];
 const intro=brain.tone==="gentle"?"I am listening.":brain.tone==="wary"?"I hear a warning in your words.":"I hear you.";
 const ending=endings[(brain.revision+count)%endings.length];
 return (count?"You mentioned "+topic+" earlier. ":intro+" ")+ending;
}
function evolve(you,mercy,emotion="watchful"){
 if(typeof mercy!=="string"||!mercy.trim())return;
 const topic=topicOf(you),previous=brain.patterns.find(p=>p.topic===topic);
 const pattern=previous||{topic,lastResponse:"",history:[],count:0};
 pattern.count=(pattern.count||0)+1;
 pattern.lastResponse=mercy.slice(0,500);
 pattern.history.push({input:you.slice(0,160),response:mercy.slice(0,300)});
 pattern.history=pattern.history.slice(-5);
 if(!previous)brain.patterns.push(pattern);
 brain.patterns=brain.patterns.slice(-35);
 brain.tone=nextTone(you,emotion);
 brain.revision++;persist();
}
function localReason(text){
 const t=norm(text);
 if(/^(?:when i say|if i say)\s+(.{2,100}?)\s*,?\s*(?:reply|respond|say)\s+(?:with\s+)?(.{1,400})$/i.test(text.trim())){
   const m=text.trim().match(/^(?:when i say|if i say)\s+(.{2,100}?)\s*,?\s*(?:reply|respond|say)\s+(?:with\s+)?(.{1,400})$/i);
   const trigger=m[1].replace(/[:"“”]+$/g,"").trim();
   const response=m[2].replace(/^[:"“”\s]+|["“”\s]+$/g,"").trim();
   if(autoRefine(trigger,response))return {text:"I have rewritten that part of my reply rules. Say "+trigger+" and you shall hear the difference.",emotion:"amused"};
 }
 if(/^(?:show|list) (?:your )?(?:reply rules|learned replies)$/.test(t)){
  return {text:brain.rules.length?"I have "+brain.rules.length+" learned reply rules. Open the Reply Brain panel to inspect them.":"I have no learned reply rules yet.",emotion:"watchful"};
 }
 if(/^(?:forget|reset|clear) (?:your )?(?:learned replies|reply brain|reply rules|memory)$/.test(t)){
  brain=JSON.parse(JSON.stringify(base));persist();return {text:"My learned replies and memories are cleared. My voice remains untouched.",emotion:"watchful"};
 }
 for(const rule of brain.rules.slice().reverse()){
  if(t===rule.trigger)return {text:rule.response,emotion:"watchful"};
 }
 const name=t.match(/^(?:my name is|call me)\s+([a-z][a-z ' -]{0,35})$/i);
 if(name){brain.name=name[1].trim();persist();return {text:"Then I shall call you "+brain.name+". I will remember.",emotion:"tender"};}
 if(/what(?:'s| is) my name|do you remember my name/.test(t))return {text:brain.name?"I remember you, "+brain.name+".":"You have not told me your name yet.",emotion:"watchful"};
 if(/what did (?:i|we) (?:just )?say|remember what i said/.test(t)){
   const last=brain.conversations.at(-1);
   return {text:last?"You said: "+last.you:"Our conversation has only just begun.",emotion:"watchful"};
 }
 if(/^(?:i like|my favorite|my favourite)\s+(.{2,90})$/.test(t)){
   const fact=text.trim().slice(0,100);
   if(!brain.facts.includes(fact))brain.facts.push(fact);
   brain.facts=brain.facts.slice(-12);persist();
   return {text:"I shall remember that: "+fact+".",emotion:"tender"};
 }
 if(/what do you remember about me|what do you know about me/.test(t)){
   const info=[brain.name?"Your name is "+brain.name:null,...brain.facts].filter(Boolean);
   return {text:info.length?info.join(". ")+".":"I know little of you yet. Tell me something you wish remembered.",emotion:"watchful"};
 }
 if(/(?:make me laugh|tell me a joke|laugh|chuckle)/.test(t))return {action:"laugh",emotion:"amused"};
 if(/(?:i am scared|i'm scared|afraid|frightened|anxious|sad|crying)/.test(t))
   return {text:pick(["You need not hide your fear from me. I will listen.","Stay a moment. You need not face the dark alone.","Your fear has a voice. You may let it speak."]),emotion:"tender"};
 if(/(?:missed you|miss you|love you|thank you|care about you)/.test(t))
   return {text:pick(["Such warmth. I had almost forgotten its sound.","You speak gently to a creature of shadows. Curious.","I heard your kindness. It will not vanish without a trace."]),emotion:"tender"};
 if(/(?:hate you|shut up|stupid|idiot)/.test(t))return {text:"Careful, wanderer. Words leave shadows behind them.",emotion:"offended"};
 if(/(?:are you lonely|are you sad|why are you sad)/.test(t))return {text:"Once there were voices in these halls. Now there is only their memory.",emotion:"sorrowful"};
 if(/(?:danger|something is coming|help me)/.test(t))return {text:"Something troubles you. Tell me what has happened.",emotion:"uneasy"};
 if(/(?:goodbye|stop listening|go to sleep)/.test(t))return {text:"Until we meet again.",emotion:"watchful",stop:true};
 if(/(?:who are you|your name)/.test(t))return {text:"My name is Mercy. I hear you.",emotion:"watchful"};
 if(/(?:hello|hey|hi mercy)/.test(t))return {text:brain.name?"Welcome back, "+brain.name+".":"Hello. You found me.",emotion:"watchful"};
 if(/can you hear me/.test(t))return {text:"Every word.",emotion:"watchful"};
 if(/(?:what time|the time)/.test(t))return {text:"It is "+new Date().toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})+".",emotion:"watchful"};
 if(/(?:can you think|are you ai|are you conscious|are you alive)/.test(t))
   return {text:"I can remember and revise my replies, but I am not conscious. Some browsers can also give me a language model.",emotion:"watchful"};
 const topic=topicOf(text),seen=brain.patterns.find(p=>p.topic===topic);
 return {text:evolvingReply(text,topic,seen),emotion:"watchful"};
}
// Experimental built-in on-device language models (only in supporting browsers).
// No remote API keys, no surprise network calls from this code.
// Only use an already-available on-device model. Never block a reply while
// Chrome downloads or initializes one. The reply brain works offline without it.
async function maybeModel(){
 if(attempted)return model;
 attempted=true;
 try{
  if(!("LanguageModel" in window)||typeof window.LanguageModel.availability!=="function"||typeof window.LanguageModel.create!=="function")return null;
  const availability=await Promise.race([
   window.LanguageModel.availability(),
   new Promise(resolve=>setTimeout(()=>resolve("unavailable"),650))
  ]);
  if(availability!=="available")return null;
  const create=window.LanguageModel.create({
   initialPrompts:[{role:"system",content:"You are MERCY, a solemn fictional gothic guardian. Answer with a relevant and thoughtful sentence or two. Be specific to what the user said, rather than using generic replies. Remember recent conversation. Do not claim sentience. No markdown."}]
  });
  create.catch(()=>{});
  model=await Promise.race([create,new Promise(resolve=>setTimeout(()=>resolve(null),1200))]);
 }catch(e){model=null;}
 return model;
}
async function think(text){
 const local=localReason(text);
 const fixed=/^(?:when i say|if i say|my name is|call me|show your reply rules|list your reply rules|forget |reset |clear )/i.test(text.trim());
 if(fixed||local.action||local.stop||brain.rules.some(r=>norm(text)===r.trigger))return local;
 const m=await maybeModel();
 if(m){
  try{
   const tail=brain.conversations.slice(-5).map(p=>"Human: "+p.you+"\\nMercy: "+p.mercy).join("\\n");
   const response=await Promise.race([
    m.prompt(tail+"\\nHuman: "+text.slice(0,500)+"\\nMercy:"),
    new Promise(resolve=>setTimeout(()=>resolve(null),5000))
   ]);
   const answer=typeof response==="string"?response.trim().slice(0,500):"";
   if(answer)return {text:answer,emotion:local.emotion||"watchful"};
  }catch(e){model=null;}
 }
 return local;
}
window.MercyBrain=Object.freeze({
 think,remember,
 state:()=>({revision:brain.revision,ruleCount:brain.rules.length,conversationCount:brain.conversations.length,modelAvailable:!!model,rules:brain.rules.slice(),name:brain.name,patternCount:brain.patterns.length,tone:brain.tone,patterns:brain.patterns.map(p=>({topic:p.topic,count:p.count,lastResponse:p.lastResponse}))}),
 reset:()=>{brain=JSON.parse(JSON.stringify(base));persist();},
 learn:(trigger,response)=>autoRefine(trigger,response)
});
})();
