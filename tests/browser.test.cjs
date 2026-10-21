"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");

test("browser scripts are valid JavaScript and all queried elements exist",()=>{
 const html=read("index.html");
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,"inline script must exist");
 for(const [name,code] of [["page",script],["brain",read("mercy-modes.js")],["worker",read("sw.js")]]){
  assert.doesNotThrow(()=>new vm.Script(code,{filename:name}));
 }
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 for(const match of script.matchAll(/querySelector\("#([^"]+)"\)/g)){
  assert.ok(ids.has(match[1]),"missing element #"+match[1]);
 }
 assert.match(script,/VOICE_RATE=0\.75, VOICE_PITCH=0\.45/);
 assert.doesNotMatch(html,/<script src="reply-brain\.js"/);
});

test("offline model manifest and chunk sizes agree",()=>{
 const dir="models/onnx-community/SmolLM2-135M-Instruct-ONNX";
 const manifest=JSON.parse(read(dir+"/manifest.json"));
 assert.equal(manifest.model,"onnx-community/SmolLM2-135M-Instruct-ONNX");
 assert.equal(manifest.dtype,"int8");
 assert.ok(manifest.parts.length>=1);
 let sum=0;
 for(const name of manifest.parts){
  assert.match(name,/^model_int8\.onnx\.part\d{2}$/);
  sum+=fs.statSync(path.join(root,dir,"onnx",name)).size;
 }
 assert.equal(sum,manifest.size);
});

test("memory reset clears saved conversation without touching voice settings",()=>{
 const saved=new Map();
 const storage={
  getItem:k=>saved.get(k)||null,
  setItem:(k,v)=>saved.set(k,v)
 };
 const context={
  document:{baseURI:"https://example.org/mercy/"},
  window:{},
  localStorage:storage,
  URL,
  navigator:{},
  setTimeout,
  clearTimeout,
  MessageChannel
 };
 vm.runInNewContext(read("mercy-modes.js"),context);
 const brain=context.window.MercyModes;
 assert.equal(brain.status().identity,"Mercy");
 assert.equal(brain.status().turns,0);
 assert.equal(typeof brain.cancelPending,"function");
 brain.reset();
 assert.equal(brain.status().name,null);
 assert.equal(brain.status().turns,0);
 assert.equal(JSON.parse(saved.get("mercy-identity-memory-v1")).version,1);
});

test("service worker reassembles model chunks as one ONNX response",async()=>{
 const handlers={};
 const encoder=new TextEncoder();
 const partData={"model_int8.onnx.part00":new Uint8Array([1,2]),"model_int8.onnx.part01":new Uint8Array([3,4])};
 const fetchStub=async url=>{
  const str=String(url);
  if(str.endsWith("/manifest.json"))return new Response(JSON.stringify({
   model:"onnx-community/SmolLM2-135M-Instruct-ONNX",parts:Object.keys(partData),size:4
  }),{status:200});
  const part=Object.keys(partData).find(p=>str.endsWith("/"+p));
  if(part)return new Response(partData[part],{status:200});
  throw Error("Unexpected URL "+str);
 };
 const context={
  self:{location:{origin:"https://example.org"},addEventListener:(name,fn)=>{handlers[name]=fn;}},
  URL,Response,ReadableStream,fetch:fetchStub,TextEncoder,
  caches:{open:async()=>({put:async()=>{},match:async()=>null})}
 };
 vm.runInNewContext(read("sw.js"),context);
 const url="https://example.org/mercy/models/onnx-community/SmolLM2-135M-Instruct-ONNX/onnx/model_int8.onnx";
 let pending=null;
 handlers.fetch({request:{method:"GET",url},respondWith:p=>{pending=p;}});
 assert.ok(pending,"model requests must be intercepted");
 const response=await pending;
 const bytes=new Uint8Array(await response.arrayBuffer());
 assert.deepEqual([...bytes],[1,2,3,4]);
});

test("personal name questions respect the remembered fact and 6-7 word request",async()=>{
 const saved=new Map();
 const make=()=>{
  const context={
   document:{baseURI:"https://example.org/mercy/"},
   window:{}, URL, navigator:{}, MessageChannel,setTimeout,clearTimeout,
   localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}
  };
  vm.runInNewContext(read("mercy-modes.js"),context);
  return context.window.MercyModes;
 };
 let mercy=make();
 const unknown=await mercy.answer("answer this in 6-7 words what is my name");
 assert.equal(unknown.text,"I don't know your name just yet.");
 assert.equal(unknown.text.trim().split(/\s+/).length,7);
 // Revisit the page: browser localStorage should retain the person's name.
 saved.set("mercy-identity-memory-v1",JSON.stringify({
  version:1,identity:"Mercy",name:"Alex",observations:[],turns:1,
  conversation:[{role:"user",content:"My name is Alex"},{role:"assistant",content:"Greetings, Alex."}],
  lastReflection:"Introduced as Alex"
 }));
 mercy=make();
 const known=await mercy.answer("answer this in 6-7 words what is my name");
 assert.equal(known.text,"You told me your name is Alex.");
 assert.equal(known.text.trim().split(/\s+/).length,7);
});
