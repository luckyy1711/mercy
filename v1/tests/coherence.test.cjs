"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=(name)=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");

function createBrain(saved,generator){
 const source=read("mercy-modes.js").replace(
  "let memory=read(),generator=null,loading=null,",
  "let memory=read(),generator=window.__mockGenerator,loading=null,"
 );
 assert.notEqual(source,read("mercy-modes.js"),"test must replace pipeline for injected fake");
 const context={
  document:{baseURI:"https://example.com/mercy/"},
  window:{__mockGenerator:generator},
  navigator:{},URL,MessageChannel,setTimeout,clearTimeout,
  localStorage:{
   getItem:key=>saved.get(key)||null,
   setItem:(key,value)=>saved.set(key,value)
  }
 };
 vm.runInNewContext(source,context);
 return context.window.MercyModes;
}

test("hello is handled using fresh context, not old name-question text",async()=>{
 const saved=new Map();
 saved.set("mercy-identity-memory-v1",JSON.stringify({
  version:1,identity:"Mercy",name:"Alex",turns:5,
  observations:["The user introduced themselves as Alex"],
  lastReflection:"What is my name?",
  conversation:[
   {role:"user",content:"What is my name?"},
   {role:"assistant",content:"That sounds good! I'll keep it in mind for future questions: What is my name?"}
  ]
 }));
 let calls=0;
 const prompts=[];
 const mock=async(messages)=>{
  calls++;
  prompts.push(JSON.parse(JSON.stringify(messages)));
  const value="Hello, Alex. The shadows missed you.";
  return [{generated_text:[{role:"assistant",content:value}]}];
 };
 const brain=createBrain(saved,mock);
 const answer=await brain.answer("hello");
 assert.equal(answer.text,"Hello, Alex. The shadows missed you.");
 assert.equal(calls,1);
 assert.equal(prompts[0].length,2,"greetings use only system and latest message");
 assert.equal(prompts[0].at(-1).content,"hello");
 assert.equal(brain.status().name,"Alex","keep the person's saved name");
 const stored=JSON.parse(saved.get("mercy-identity-memory-v1"));
 assert.ok(stored.cleanDialogue.some(turn=>turn.content===answer.text));
 assert.equal(stored.turns,6,"retain prior conversation count");
});

test("irrelevant hello replies are retried and never saved",async()=>{
 const saved=new Map();
 const sequence=[
  "That sounds good! I'll keep it in mind for future questions: What is my name?",
  "Well hello, wanderer. Back again?"
 ];
 let calls=0;
 const brain=createBrain(saved,async(messages)=>{
  const text=sequence[calls++]||"Unused";
  return [{generated_text:[{role:"assistant",content:text}]}];
 });
 const result=await brain.answer("hello");
 assert.equal(result.text,sequence[1]);
 assert.equal(calls,2);
 const stored=JSON.parse(saved.get("mercy-identity-memory-v1"));
 assert.ok(stored.conversation.some(turn=>turn.content===sequence[1]));
 assert.ok(!stored.conversation.some(turn=>turn.content===sequence[0]));
});

test("follow-up question sees the recent clean dialogue",async()=>{
 const saved=new Map(),prompts=[];
 const brain=createBrain(saved,async(messages)=>{
  prompts.push(JSON.parse(JSON.stringify(messages)));
  return [{generated_text:[{role:"assistant",content:prompts.length===1?"Greetings, wanderer.":"I said greetings, wanderer."}]}];
 });
 await brain.answer("hello");
 const followup=await brain.answer("what did you just say?");
 assert.equal(followup.text,"I said greetings, wanderer.");
 assert.ok(prompts[1].some(msg=>msg.role==="assistant"&&msg.content==="Greetings, wanderer."));
 assert.equal(prompts[1].at(-1).content,"what did you just say?");
});

test("new hosted model manifest and service worker route are consistent",()=>{
 const manifest=JSON.parse(read("models/onnx-community/SmolLM2-360M-Instruct-ONNX/manifest.json"));
 assert.equal(manifest.model,"onnx-community/SmolLM2-360M-Instruct-ONNX");
 assert.equal(manifest.dtype,"int8");
 let size=0;
 for(const name of manifest.parts){
  assert.match(name,/^model_int8\.onnx\.part\d{2}$/);
  size+=fs.statSync(path.join(__dirname,"..","models",manifest.model,"onnx",name)).size;
 }
 assert.equal(size,manifest.size);
 assert.match(read("mercy-modes.js"),/const MODEL="onnx-community\/SmolLM2-360M-Instruct-ONNX"/);
 assert.match(read("sw.js"),/135M\|360M/);
});
