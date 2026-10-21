"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

function setup(){
 let time=100000,serial=0,hidden=false;
 const scheduled=new Map(),events={};
 const context={
  window:{},
  document:{get hidden(){return hidden;},addEventListener:(event,handler)=>{events[event]=handler;}}
 };
 vm.runInNewContext(read("autonomy.js"),context,{filename:"autonomy.js"});
 const timeouts={
  now:()=>time,
  setTimer:(fn,ms)=>{
   const id=++serial;
   scheduled.set(id,{fn,at:time+ms});
   return id;
  },
  clearTimer:id=>{scheduled.delete(id);}
 };
 function advance(ms){
  const target=time+ms;
  let guard=100;
  while(guard--){
   const due=[...scheduled].filter(([,task])=>task.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];
   if(!due)break;
   time=due[1].at;
   scheduled.delete(due[0]);due[1].fn();
  }
  if(guard<=0)throw Error("Scheduler busy loop");
  time=target;
 }
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 return {factory:context.window.MercyAutonomy,events,timeouts,advance,flush,
  setHidden(value){hidden=value;events.visibilitychange?.();},pending:()=>scheduled.size};
}

test("autonomous speaking is opt-in and respects idle, cooldown, and cap",async()=>{
 const sim=setup();
 let spoken=0;
 const controller=sim.factory.create({
  ...sim.timeouts,
  canRun:()=>true,
  begin:async()=>{spoken++;return true;}
 });
 assert.equal(controller.info().enabled,false);
 sim.advance(180000);
 assert.equal(spoken,0);
 controller.enable();
 sim.advance(54999);
 assert.equal(spoken,0);
 sim.advance(1);await sim.flush();
 assert.equal(spoken,1);
 assert.equal(controller.info().unsolicited,1);
 sim.advance(124999);await sim.flush();
 assert.equal(spoken,1);
 sim.advance(1);await sim.flush();
 assert.equal(spoken,2);
 sim.advance(125000);await sim.flush();
 assert.equal(spoken,3);
 assert.equal(controller.info().paused,true);
 sim.advance(1000000);
 assert.equal(spoken,3);
 controller.activity();
 assert.equal(controller.info().paused,false);
 sim.advance(125000);await sim.flush();
 assert.equal(spoken,4);
 controller.disable();
 sim.advance(400000);
 assert.equal(spoken,4);
});

test("autonomous speaking pauses in hidden tabs and can be disabled",async()=>{
 const sim=setup();let spoken=0,stopped=0;
 const controller=sim.factory.create({
  ...sim.timeouts,
  canRun:()=>true,
  begin:async()=>{spoken++;return true;},
  onDisable:()=>{stopped++;}
 });
 controller.enable();
 sim.setHidden(true);
 sim.advance(1000000);
 assert.equal(spoken,0);
 sim.setHidden(false);
 sim.advance(55000);await sim.flush();
 assert.equal(spoken,1);
 controller.disable();
 assert.equal(stopped,1);
 assert.equal(controller.info().enabled,false);
 assert.equal(sim.pending(),0);
});

test("autonomy cannot initiate while speech or model is busy",async()=>{
 const sim=setup();let ready=false,spoken=0;
 const controller=sim.factory.create({
  ...sim.timeouts,
  canRun:()=>ready,
  begin:async()=>{spoken++;return true;}
 });
 controller.enable();
 sim.advance(55000);await sim.flush();
 assert.equal(spoken,0);
 ready=true;
 sim.advance(12000);await sim.flush();
 assert.equal(spoken,1);
});

test("new Mercy presence assets and original voice are wired to page",()=>{
 const html=read("index.html"),css=read("presence.css");
 for(const path of ["autonomy.js","presence.js"])assert.doesNotThrow(()=>new vm.Script(read(path)));
 assert.match(html,/<script src="autonomy\.js"/);
 assert.match(html,/<script src="presence\.js"/);
 assert.match(html,/<link rel="stylesheet" href="presence\.css"/);
 assert.match(html,/id="autonomyToggle" aria-pressed="false"/);
 assert.match(html,/id="presence"/);
 assert.match(html,/VOICE_RATE=0\.75, VOICE_PITCH=0\.45/);
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
 const modes=read("mercy-modes.js");
 assert.match(modes,/function initiate\(report\)/);
 assert.match(modes,/lastInitiative/);
 assert.match(read("sw.js"),/"\.\/autonomy\.js"/);
 assert.match(read("sw.js"),/"\.\/presence\.css"/);
});
