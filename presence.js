"use strict";
// Purely visual behavior. Never changes Mercy's speech engine or voice.
(function(){
 const stage=document.querySelector("#presence");
 const caption=document.querySelector("#presenceCaption");
 if(!stage){window.MercyPresence=Object.freeze({setState(){}});return;}
 const names={idle:"Watching",listening:"Listening",thinking:"Considering",speaking:"Speaking",asleep:"Resting"};
 let state="idle",frame=0;
 function setState(next){
  state=Object.hasOwn(names,next)?next:"idle";
  stage.dataset.state=state;
  if(caption)caption.textContent=names[state];
  if(state==="asleep")resetGaze();
 }
 function resetGaze(){
  stage.style.setProperty("--gaze-x","0px");
  stage.style.setProperty("--gaze-y","0px");
 }
 function move(event){
  if(state==="asleep"||document.hidden)return;
  if(frame)return;
  const x=event.clientX,y=event.clientY;
  frame=requestAnimationFrame(()=>{
   frame=0;
   const rect=stage.getBoundingClientRect();
   if(!rect.width||!rect.height)return;
   const dx=Math.max(-4,Math.min(4,((x-rect.left)/rect.width-.5)*13));
   const dy=Math.max(-3,Math.min(3,((y-rect.top)/rect.height-.5)*10));
   stage.style.setProperty("--gaze-x",dx.toFixed(1)+"px");
   stage.style.setProperty("--gaze-y",dy.toFixed(1)+"px");
  });
 }
 stage.addEventListener("pointermove",move,{passive:true});
 stage.addEventListener("pointerleave",resetGaze,{passive:true});
 document.addEventListener("visibilitychange",()=>{if(document.hidden)resetGaze();});
 window.MercyPresence=Object.freeze({setState,getState:()=>state});
 setState("idle");
})();
