"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"..","mercy-modes.js"),"utf8");
const C=require("../v2/cognition/engine.js"),R=require("../v5/research.js");

function setup() {
 const saved=new Map(),calls=[];
 const storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
 const cognition=C.create({storage});
 const supervisor=R.createSupervisor({cognition});
 const replies=[];
 const mocked=async (messages)=>{
  calls.push(JSON.parse(JSON.stringify(messages)));
  const value=replies.shift()||"Good evening, wanderer.";
  return [{generated_text:[{role:"assistant",content:value}]}];
 };
 const altered=source.replace(
  "let memory=read(),generator=null,loading=null,",
  "let memory=read(),generator=window.__mockGenerator,loading=null,"
 );
 assert.notEqual(altered,source,"The real generator must be replaced in this test");
 const window={__mockGenerator:mocked,MercyBrain:{cognition,supervisor}};
 const ctx={window,document:{baseURI:"https://example.org/mercy/",hidden:false},
  navigator:{},localStorage:storage,URL,MessageChannel,setTimeout,clearTimeout};
 vm.runInNewContext(altered,ctx,{filename:"mercy-modes.js"});
 return {brain:window.MercyModes,cognition,supervisor,replies,calls,saved};
}

test("normal conversation can teach, correct and recall without calling an LLM",async()=>{
 const {brain,cognition,replies,calls}=setup();
 replies.push("This should not be needed");
 let response=await brain.answer("remember that the skull material is PLA");
 assert.equal(response.grounded,true);
 assert.equal(calls.length,0);
 response=await brain.answer("what is the skull material?");
 assert.equal(response.text,"skull material is PLA.");
 response=await brain.answer("correction: the skull material is resin");
 assert.match(response.text,/updated/i);
 response=await brain.answer("what is the skull material?");
 assert.equal(response.text,"skull material is resin.");
 assert.equal(cognition.stats().knownFacts,1);
 assert.equal(cognition.stats().corrections,1);
 assert.equal(calls.length,0);
 assert.equal(brain.status().cognitiveFacts,1);
});

test("unfamiliar chat is handled by model and receives user-provided fact context",async()=>{
 const {brain,cognition,calls}=setup();
 cognition.learn({subject:"skull material",value:"resin"});
 const reply=await brain.answer("Tell me about my skull material");
 assert.equal(reply.text,"Good evening, wanderer.");
 assert.equal(calls.length,1);
 assert.ok(calls[0][0].content.includes("skull material"));
 assert.ok(calls[0][0].content.includes("resin"));
 assert.equal(calls[0].at(-1).content,"Tell me about my skull material");
});

test("autonomous question follows grounded curiosity and records once",async()=>{
 const {brain,cognition,supervisor,replies,calls}=setup();
 cognition.learn({subject:"skull material",value:"resin"});
 supervisor.setEnabled(true);
 replies.push("How is the skull coming along?");
 const response=await brain.initiate();
 assert.equal(response.spontaneous,true);
 assert.equal(response.text,"How is the skull coming along?");
 assert.equal(cognition.stats().askedQuestions,1);
 assert.equal(cognition.chooseQuestion().action,"silent");
 assert.ok(calls[0].at(-1).content.includes("skull material"));
});

test("clearing Mercy resets both legacy dialogue and cognitive facts",async()=>{
 const {brain,cognition}=setup();
 cognition.learn({subject:"skull material",value:"resin"});
 await brain.answer("what is the skull material?");
 assert.equal(brain.status().cognitiveFacts,1);
 assert.equal(brain.status().turns,1);
 brain.reset();
 assert.equal(brain.status().turns,0);
 assert.equal(brain.status().cognitiveFacts,0);
 assert.equal(cognition.stats().knownFacts,0);
});

test("a simple hello does not import cognitive history from previous topics",async()=>{
 const {brain,cognition,calls,replies}=setup();
 cognition.learn({subject:"skull material",value:"resin"});
 replies.push("Welcome back, wanderer.");
 const answer=await brain.answer("hello");
 assert.equal(answer.text,"Welcome back, wanderer.");
 assert.equal(calls[0].length,2);
 assert.doesNotMatch(calls[0][0].content,/resin/);
 assert.equal(calls[0][1].content,"hello");
});
