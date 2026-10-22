"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const C=require("../v2/cognition/engine.js");
const P=require("../v3/perception.js");
const R=require("../v5/research.js");
const storage=()=>{
 const m=new Map();
 return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};
};

test("v2 facts, correction history, offline query, refresh",()=>{
 const store=storage();
 let t=100;
 const brain=C.create({storage:store,now:()=>++t});
 assert.equal(brain.processText("remember that the skull material is PLA").handled,true);
 assert.equal(brain.recall("skull material").value,"PLA");
 assert.equal(brain.processText("correction: the skull material is resin").handled,true);
 assert.equal(brain.recall("skull material").value,"resin");
 assert.equal(brain.stats().corrections,1);
 const old=brain.snapshot().beliefs.find(b=>b.value==="PLA");
 assert.equal(old.status,"superseded");
 assert.equal(brain.recall("skull material").supersedes,old.id);
 const reopened=C.create({storage:store});
 assert.equal(reopened.recall("skull material").value,"resin");
 assert.deepEqual(reopened.processText("what is the skull material?"),
  {handled:true,text:"skull material is resin."});
 assert.equal(reopened.recall("unknown"),null);
});

test("v2 unrelated conversation does not turn into verified facts",()=>{
 const brain=C.create({storage:storage()});
 assert.equal(brain.processText("hello").handled,false);
 assert.equal(brain.processText("the skull is magical").handled,false);
 assert.equal(brain.recall("skull"),null);
 assert.equal(brain.processText("remember that skull stage = prototype").handled,true);
 assert.equal(brain.recall("skull stage").value,"prototype");
 assert.equal(brain.learn({subject:"",value:"x"}).ok,false);
 assert.equal(brain.learn({subject:"__proto__",value:"bad"}).ok,false);
 assert.equal(brain.learn({subject:"x",value:"a".repeat(201)}).ok,false);
});

test("v2 evidence-supported transitive inference and bounded curiosity",()=>{
 const brain=C.create({storage:storage()});
 assert.equal(brain.chooseQuestion().action,"silent");
 brain.learn({subject:"jaw",predicate:"part_of",value:"skull"});
 brain.learn({subject:"skull",predicate:"part_of",value:"Mercy body"});
 const reasoning=brain.reason("jaw");
 assert.equal(reasoning.length,2);
 assert.equal(reasoning[1].value,"Mercy body");
 assert.equal(reasoning[1].supports.length,2);
 assert.equal(brain.reason("jaw","causes").length,0);
 brain.learn({subject:"skull material",value:"PLA"});
 const plan=brain.chooseQuestion();
 assert.equal(plan.action,"ask");
 assert.equal(brain.markAsked(plan),true);
 assert.equal(brain.markAsked(plan),false);
 const remaining=brain.chooseQuestion();
 assert.equal(remaining.action,"ask");
 assert.notEqual(remaining.subject,plan.subject);
 assert.equal(brain.markAsked(remaining),true);
 assert.equal(brain.chooseQuestion().action,"silent");
 brain.clear();
 assert.equal(brain.stats().knownFacts,0);
});

test("v2 recovers from damaged or unavailable browser storage",()=>{
 const brain=C.create({storage:{
  getItem:()=>"{damaged",
  setItem:()=>{throw Error("private browsing");}
 }});
 assert.equal(brain.stats().knownFacts,0);
 assert.equal(brain.learn({subject:"battery",value:"charged"}).ok,true);
 assert.equal(brain.recall("battery").value,"charged");
});

test("v3 frame processing is strictly light and motion metadata",()=>{
 const make=v=>{
  const a=new Uint8ClampedArray(256*4);
  for(let i=0;i<a.length;i+=4)a.set([v,v,v,255],i);
  return a;
 };
 const dark=make(10),bright=make(240);
 assert.equal(P.analyzeFrame(dark).light,"dim");
 assert.equal(P.analyzeFrame(bright).light,"bright");
 assert.equal(P.analyzeFrame(bright,dark).motion,"change detected");
 assert.equal(P.analyzeFrame(dark,dark).motion,"little change");
 assert.throws(()=>P.analyzeFrame([1]),/RGBA/);
});

test("v3 camera permission required, audio disabled, and hidden tab stops tracks",async()=>{
 const listeners={};let args=null,stops=0,interval=()=>{};
 const video={readyState:3,play:async()=>{},pause:()=>{},srcObject:null};
 const doc={hidden:false,addEventListener:(k,f)=>{listeners[k]=f;},
  createElement:()=>({getContext:()=>({drawImage:()=>{},
   getImageData:()=>({data:new Uint8ClampedArray(64*48*4).fill(60)})})})};
 const observed=[];
 const camera=P.create({video,document:doc,now:()=>60000,
  mediaDevices:{getUserMedia:async a=>{
   args=a;return {getTracks:()=>[{stop:()=>stops++}]};
  }},
  setInterval:fn=>{interval=fn;return 2;},clearInterval:()=>{},
  onObservation:e=>observed.push(e)});
 assert.equal(camera.running(),false);
 assert.equal(args,null);
 assert.equal(await camera.start(),true);
 assert.equal(args.audio,false);
 interval();
 assert.ok(observed.length<=1);
 if(observed.length)assert.equal(observed[0].kind,"camera-metadata");
 doc.hidden=true;listeners.visibilitychange();
 assert.equal(camera.running(),false);
 assert.equal(stops,1);
 assert.equal(video.srcObject,null);
});

test("v3 permission completed after cancellation cannot reactivate camera",async()=>{
 let resolve,stops=0;
 const camera=P.create({
  video:{play:async()=>{},srcObject:null,pause:()=>{}},
  document:{hidden:false,addEventListener:()=>{}},
  mediaDevices:{getUserMedia:()=>new Promise(r=>{resolve=r;})}
 });
 const pending=camera.start();
 camera.stop();
 resolve({getTracks:()=>[{stop:()=>stops++}]});
 assert.equal(await pending,false);
 assert.equal(stops,1);
});

test("v5 supervisor uses opt-in and one-shot curiosity",()=>{
 let now=100000;
 const brain=C.create({storage:storage()});
 brain.learn({subject:"skull material",value:"PLA"});
 const control=R.createSupervisor({cognition:brain,now:()=>now});
 assert.equal(control.tick({visible:true,allowQuestions:true}).action,"silent");
 control.setEnabled(true);
 assert.equal(control.tick({visible:false,allowQuestions:true}).action,"silent");
 const action=control.tick({visible:true,allowQuestions:true});
 assert.equal(action.action,"ask");
 assert.equal(control.completed(action.plan),true);
 assert.equal(control.tick({visible:true,allowQuestions:true}).action,"silent");
 now+=130000;
 assert.equal(control.tick({visible:true,allowQuestions:true}).action,"silent");
});

test("v5 experiments cannot silently modify software; full diagnostic succeeds",()=>{
 const lab=R.createExperiments();
 assert.equal(lab.propose({title:"",hypothesis:"",metric:""}).ok,false);
 const item=lab.propose({title:"Improve recall",hypothesis:"More evidence improves accuracy",
  metric:"Held-out correct recall",cost:2});
 assert.equal(item.ok,true);
 assert.equal(lab.decide(item.proposal.id,true),true);
 assert.equal(lab.list()[0].status,"approved-for-testing");
 assert.equal(lab.decide(item.proposal.id,true),false);
 const store=storage();
 const one=R.createExperiments({storage:store});
 one.propose({title:"Track uncertainty",hypothesis:"More evidence helps calibration",
  metric:"Unseen calibration error",cost:3});
 const reloaded=R.createExperiments({storage:store});
 assert.equal(reloaded.list().length,1);
 assert.equal(reloaded.list()[0].title,"Track uncertainty");
 reloaded.clear();
 assert.equal(R.createExperiments({storage:store}).list().length,0);
 const check=R.selfCheck(C);
 assert.equal(check.success,true,JSON.stringify(check.checks));
 assert.equal(check.passed,check.total);
});

test("production scripts load and the original voice remains intact",()=>{
 const html=read("index.html");
 for(const file of ["v2/cognition/engine.js","mercy-cognition.js","cognition-lab.js"]){
  assert.ok(html.includes(file),"Current version missing "+file);
  assert.doesNotThrow(()=>new vm.Script(read(file),{filename:file}));
 }
 for(const parked of ["v3/perception.js","v5/research.js"]){
  assert.ok(!html.includes(parked),"Inactive experiment must not load: "+parked);
  assert.doesNotThrow(()=>new vm.Script(read(parked),{filename:parked}));
 }
 const sw=read("sw.js");
 assert.ok(!html.includes("v4/"),"Removed v4 must not appear on website");
 assert.ok(!fs.existsSync(path.join(__dirname,"..","v4")),"Removed v4 folder must be absent");
 assert.ok(!sw.includes("v3/perception.js"),"v3 must not be precached");
 assert.ok(!sw.includes("v5/research.js"),"v5 must not be precached");
 assert.ok(!sw.includes("v4/"),"v4 must not be precached");
 assert.match(html,/VOICE_RATE=0\.75, VOICE_PITCH=0\.45/);
 assert.match(sw,/mercy-shell-v10/);
 assert.match(read("mercy-modes.js"),/event\.data\?\.version===8/);
 assert.match(read("mercy-modes.js"),/cognitive\?\.processText\(user\)/);
});
