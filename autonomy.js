"use strict";
// Opt-in, foreground-only autonomous speech scheduler. No canned dialogue.
(function(){
 function create(options){
  const now=options.now||(()=>Date.now());
  const setTimer=options.setTimer||((fn,ms)=>setTimeout(fn,ms));
  const clearTimer=options.clearTimer||((id)=>clearTimeout(id));
  const visible=options.visible||(()=>!document.hidden);
  const idleMs=options.idleMs??55000;
  const cooldownMs=options.cooldownMs??125000;
  const retryMs=options.retryMs??12000;
  const maxWithoutInteraction=options.maxWithoutInteraction??3;
  let enabled=false,timer=null,lastAction=now(),lastSpontaneous=-Infinity;
  let unsolicited=0,inFlight=false,epoch=0;
  const info=()=>({enabled,inFlight,unsolicited,paused:unsolicited>=maxWithoutInteraction});
  function notify(){options.onChange?.(info());}
  function clear(){if(timer!==null){clearTimer(timer);timer=null;}}
  function schedule(){
   clear();
   if(!enabled||!visible()||unsolicited>=maxWithoutInteraction)return;
   const due=Math.max(lastAction+idleMs,lastSpontaneous+cooldownMs);
   timer=setTimer(()=>{timer=null;void fire();},Math.max(1000,due-now()));
  }
  async function fire(){
   if(!enabled||!visible()||inFlight)return;
   if(now()<Math.max(lastAction+idleMs,lastSpontaneous+cooldownMs)){
    schedule();return;
   }
   if(!options.canRun()){
    timer=setTimer(()=>{timer=null;void fire();},retryMs);
    return;
   }
   const turn=epoch;
   inFlight=true;notify();
   let saidSomething=false;
   try{saidSomething=(await options.begin())===true;}
   catch(err){options.onError?.(err);}
   finally{
    if(epoch!==turn)return;
    inFlight=false;
    if(saidSomething){
     unsolicited++;
     lastSpontaneous=now();
     lastAction=now();
    }else{
     // Retry gently on a failed initiation without entering a busy loop.
     lastAction=now();
    }
    notify();schedule();
   }
  }
  function enable(){
   if(enabled)return;
   epoch++;enabled=true;lastAction=now();unsolicited=0;
   notify();schedule();
  }
  function disable(){
   if(!enabled)return;
   epoch++;enabled=false;inFlight=false;clear();
   options.onDisable?.();notify();
  }
  function activity(){
   lastAction=now();unsolicited=0;
   notify();schedule();
  }
  function visibilityChanged(){
   if(!visible()){
    clear();
    if(inFlight){epoch++;inFlight=false;options.onDisable?.();}
   }else{lastAction=now();schedule();}
   notify();
  }
  if(options.observeVisibility!==false&&typeof document!=="undefined"){
   document.addEventListener("visibilitychange",visibilityChanged);
  }
  notify();
  return Object.freeze({enable,disable,toggle:()=>enabled?disable():enable(),activity,visibilityChanged,info});
 }
 window.MercyAutonomy=Object.freeze({create});
})();
