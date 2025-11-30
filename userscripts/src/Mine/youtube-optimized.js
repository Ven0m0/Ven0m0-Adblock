// ==UserScript==
// @name         YouTube Ultimate Optimizer (Compact)
// @match        https://youtube.com/*
// @match        https://m.youtube.com/*
// @match        https://music.youtube.com/*
// @run-at       document-start
// ==/UserScript==
"use strict";
const GUARD="__yt_ultimate_optimizer_v2__";
if(window[GUARD])return;
window[GUARD]=1;

const CFG={
 debug:0,
 cpu:{
  eventThrottle:1,
  rafDecimation:1,
  timerPatch:1,
  idleBoost:1,
  idleDelayNormal:8e3,
  idleDelayShorts:15e3,
  rafFpsVisible:20,
  rafFpsHidden:3,
  minDelayIdle:200,
  minDelayBase:75
 },
 gpu:{
  blockAV1:1,
  disableAmbient:1,
  lazyThumbs:1
 },
 ui:{
  hideSpinner:1,
  hideShorts:1,
  disableAnimations:1,
  contentVisibility:1,
  instantNav:1
 },
 flags:{
  IS_TABLET:1,
  DISABLE_YT_IMG_DELAY_LOADING:1,
  polymer_verifiy_app_state:0,
  desktop_delay_player_resizing:0,
  web_animated_actions:0,
  web_animated_like:0,
  render_unicode_emojis_as_small_images:1,
  smartimation_background:0,
  kevlar_refresh_on_theme_change:0,
  kevlar_watch_cinematics:0,
  web_cinematic_theater_mode:0,
  web_cinematic_fullscreen:0
 }
};

const log=(...a)=>CFG.debug&&console.log("[YT Optimizer]",...a);
const isShorts=()=>location.pathname.startsWith("/shorts");
const IDLE_ATTR="data-yt-idle";
const CV_OFF_ATTR="data-yt-cv-off";

const throttle=(fn,ms)=>{
 let last=0;
 return function(...a){
  let now=Date.now();
  if(now-last>=ms){fn.apply(this,a);last=now;}
 };
};

const debounce=(fn,delay)=>{
 let t;
 return function(...a){
  clearTimeout(t);
  t=setTimeout(()=>fn.apply(this,a),delay);
 };
};

const rafThrottle=fn=>{
 let q=0;
 return function(...a){
  if(!q){
   q=1;
   requestAnimationFrame(()=>{
    fn.apply(this,a);
    q=0;
   });
  }
 };
};

// --- Resource Locks/IndexedDB ---
(()=>{
 const win=window;
 if(typeof win?.navigator?.locks?.request==="function"){
  win.navigator.locks.query=()=>Promise.resolve({});
  win.navigator.locks.request=()=>new ((async()=>{}).constructor);
 }
 if(win?.indexedDB?.constructor?.name==="IDBFactory"){
  const origOpen=win.indexedDB.constructor.prototype.open;
  const openDBs=new Set(),closedDBs=new Map();
  let cleanupTimer=0;
  const cleanup=()=>{
   for(const req of openDBs)try{req.result?.close()}catch(_){}
   openDBs.clear();
   for(const [db,] of closedDBs)try{db&&db.close()}catch(_){}
   closedDBs.clear();
  };
  const dbCloseMap=new WeakMap();
  const scheduleClose=(db,name)=>{
   clearTimeout(cleanupTimer);
   closedDBs.set(db,Date.now());
   cleanupTimer=setTimeout(cleanup,20e3);
  };
  win.indexedDB.constructor.prototype.open=function(name,ver){
   const req=origOpen.call(this,name,ver);
   req.onsuccess=e=>{
    const db=e.target.result;
    dbCloseMap.set(db,{name,openTime:Date.now()});
    scheduleClose(db,name);
   };
   openDBs.add(req);
   return req;
  };
 }
})();

// --- AV1 block ---
if(CFG.gpu.blockAV1){
 const cp=HTMLMediaElement.prototype.canPlayType;
 HTMLMediaElement.prototype.canPlayType=function(type){
  if(type&&/av01/i.test(type))return"";
  return cp.call(this,type);
 };
 if(navigator.mediaCapabilities?.decodingInfo){
  const origDecode=navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);
  navigator.mediaCapabilities.decodingInfo=async config=>{
   if(/av01/i.test(config?.video?.contentType||""))
    return {supported:0,powerEfficient:0,smooth:0};
   return origDecode(config);
  };
 }
 log("AV1 blocked");
}

// --- CSS Tweaks ---
(()=>{
 let css="";
 if(CFG.ui.disableAnimations)
  css+='[no-anim] *{transition:none!important;animation:none!important}html{scroll-behavior:auto!important}.ytd-ghost-grid-renderer *,.ytd-continuation-item-renderer *{animation:none!important}';
 if(CFG.ui.contentVisibility)
  css+=`html:not([${CV_OFF_ATTR}]) #comments,html:not([${CV_OFF_ATTR}]) #related,html:not([${CV_OFF_ATTR}]) ytd-watch-next-secondary-results-renderer{content-visibility:auto!important;contain-intrinsic-size:auto!important}`;
 if(CFG.ui.hideSpinner)
  css+='.ytp-spinner,.ytp-spinner *{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}';
 if(CFG.gpu.disableAmbient)
  css+='.ytp-ambient-light,ytd-watch-flexy[ambient-mode-enabled] .ytp-ambient-light{display:none!important}ytd-app,ytd-watch-flexy,#content,#page-manager{backdrop-filter:none!important;filter:none!important;animation:none!important;will-change:auto!important}';
 if(CFG.ui.hideShorts)
  css+='[hide-shorts] ytd-rich-section-renderer,ytd-reel-shelf-renderer,#endpoint[title="Shorts"],a[title="Shorts"]{display:none!important}';
 if(css){
  const s=document.createElement("style");
  s.textContent=css;
  (document.head||document.documentElement).appendChild(s);
 }
})();

// --- Event Throttle ---
if(CFG.cpu.eventThrottle){
 const origAdd=EventTarget.prototype.addEventListener;
 const origRem=EventTarget.prototype.removeEventListener;
 const wrapMap=new WeakMap();
 const throttleEvents=new Set(["mousemove","pointermove","touchmove"]);
 const debounceEvents=new Map([["scroll",60],["wheel",60],["resize",120]]);
 const isPlayer=el=>el instanceof HTMLVideoElement||el.closest?.(".ytp-chrome-bottom,.ytp-volume-panel,.ytp-progress-bar");
 const isGlobal=el=>el===window||el===document||el===document.documentElement||el===document.body;

 EventTarget.prototype.addEventListener=function(type,fn,opt){
  if(isShorts()||!CFG.cpu.eventThrottle||typeof fn!="function"||
     isPlayer(this)||(isGlobal(this)&&(type==="wheel"||type==="scroll"||type==="resize")))
   return origAdd.call(this,type,fn,opt);
  let wrapped=fn;
  if(throttleEvents.has(type))wrapped=rafThrottle(fn,this);
  else if(debounceEvents.has(type))wrapped=debounce(fn,this,debounceEvents.get(type));
  if(wrapped!==fn)wrapMap.set(fn,wrapped);
  return origAdd.call(this,type,wrapped,opt);
 };
 EventTarget.prototype.removeEventListener=function(type,fn,opt){
  const wrapped=wrapMap.get(fn)||fn;
  return origRem.call(this,type,wrapped,opt);
 };
 log("Event throttle ok");
}

// --- RAF Decimation ---
if(CFG.cpu.rafDecimation){
 const origRAF=window.requestAnimationFrame.bind(window),origCAF=window.cancelAnimationFrame.bind(window),BASE_ID=1e9;
 let idc=1,rafQ=new Map,rafSch=0,nextFrm=performance.now();
 const getInterval=()=>document.visibilityState==="visible"?1e3/CFG.cpu.rafFpsVisible:1e3/CFG.cpu.rafFpsHidden;
 const processQueue=()=>{
  const now=performance.now();
  if(now>=nextFrm){
   nextFrm=now+getInterval();
   const cbs=Array.from(rafQ.values());
   rafQ.clear();
   const bs=Math.min(cbs.length,10);
   for(let i=0;i<bs;i++)try{cbs[i](now);}catch(e){}
   for(let i=bs;i<cbs.length;i++)origRAF(()=>{try{cbs[i](now);}catch(e){}});
  }
  origRAF(processQueue);
 };
 window.requestAnimationFrame=cb=>{
  if(!CFG.cpu.rafDecimation)return origRAF(cb);
  const id=BASE_ID+idc++;
  rafQ.set(id,cb);
  if(!rafSch){rafSch=1;nextFrm=performance.now();origRAF(processQueue);}
  return id;
 };
 window.cancelAnimationFrame=id=>{
  typeof id==="number"&&id>=BASE_ID?rafQ.delete(id):origCAF(id);
 };
 document.addEventListener("visibilitychange",throttle(()=>{nextFrm=performance.now()},1e3));
 log("RAF decimation ok");
}

// --- Timer Patch + Idle ---
(async ()=>{
 if(!CFG.cpu.timerPatch)return;
 const natv={setTimeout:window.setTimeout.bind(window),clearTimeout:window.clearTimeout.bind(window),
  setInterval:window.setInterval.bind(window),clearInterval:window.clearInterval.bind(window)};
 if(!document.documentElement)
  await new Promise(r=>{if(document.documentElement)r();else document.addEventListener('DOMContentLoaded',r,{once:!0})});
 let iframeTimers=natv;
 if(document.visibilityState==="visible"){
  const iframe=document.createElement("iframe");
  iframe.id="yt-timer-provider";iframe.style.display="none";iframe.sandbox="allow-same-origin allow-scripts";iframe.srcdoc="<!doctype html><title>timer</title>";
  document.documentElement.appendChild(iframe);
  await new Promise(r=>{const check=()=>{iframe.contentWindow?.setTimeout?r():setTimeout(check,10)};check()});
  iframeTimers={
   setTimeout:iframe.contentWindow.setTimeout.bind(iframe.contentWindow),
   clearTimeout:iframe.contentWindow.clearTimeout.bind(iframe.contentWindow),
   setInterval:iframe.contentWindow.setInterval.bind(iframe.contentWindow),
   clearInterval:iframe.contentWindow.clearInterval.bind(iframe.contentWindow)
  };
 }
 const trigger=document.createElement("div");
 trigger.id="yt-trigger-node";trigger.style.display="none";
 document.documentElement.appendChild(trigger);

 let throttleTimers=1,minDelay=CFG.cpu.minDelayBase,lastActive=performance.now();
 const scheduleCallback=cb=>{
  if(document.visibilityState==="visible")return new Promise(r=>{
   const ob=new MutationObserver(()=>{ob.disconnect();r()});
   ob.observe(trigger,{attributes:!0});
   trigger.setAttribute("data-trigger",Math.random().toString(36).slice(2));
  }).then(cb);
  return new Promise(requestAnimationFrame).then(cb);
 };

 const wrapTimeout=(impl,tracked)=>function(fn,delay=0,...a){
  const exec=typeof fn==="function"?()=>fn.apply(window,a):()=>eval(String(fn));
  if(isShorts()||!throttleTimers||delay<minDelay)return natv.setTimeout(exec,delay);
  const id=impl(()=>scheduleCallback(exec),delay);tracked.add(id);return id;
 };
 const wrapClear=tracked=>id=>{
  if(tracked.has(id)){tracked.delete(id);iframeTimers.clearTimeout(id);}
  else natv.clearTimeout(id);
 };
 const wrapInterval=impl=>function(fn,delay=0,...a){
  if(isShorts()||typeof fn!=="function"||delay<minDelay||!throttleTimers)
   return natv.setInterval(()=>fn.apply(window,a),delay);
  return impl(()=>scheduleCallback(()=>fn.apply(window,a)),delay);
 };

 const patchTimers=()=>{
  const tracked=new Set();
  window.setTimeout=wrapTimeout(iframeTimers.setTimeout,tracked);
  window.clearTimeout=wrapClear(tracked);
  window.setInterval=wrapInterval(iframeTimers.setInterval);
  window.clearInterval=iframeTimers.clearInterval;
  log("Timer patch ok");
 };
 const unpatchTimers=()=>{Object.assign(window,natv);log("Timer patch removed");};
 patchTimers();
 if(CFG.cpu.idleBoost){
  const activityEv=["mousemove","mousedown","keydown","wheel","touchstart","pointerdown","focusin"];
  const thAct=throttle(()=>{
   lastActive=performance.now();
   if(document.documentElement.hasAttribute(IDLE_ATTR)){
    document.documentElement.removeAttribute(IDLE_ATTR);
    throttleTimers=1;minDelay=CFG.cpu.minDelayBase;
    log("Idle OFF");
   }
  },100);
  activityEv.forEach(evt=>window.addEventListener(evt,thAct,{capture:!0,passive:!0}));
  setInterval(()=>{
   if(document.visibilityState!=="visible")return;
   const now=performance.now(),idl=isShorts()?CFG.cpu.idleDelayShorts:CFG.cpu.idleDelayNormal;
   if(now-lastActive>=idl){
    if(!document.documentElement.hasAttribute(IDLE_ATTR)){
     document.documentElement.setAttribute(IDLE_ATTR,"1");
     const hv=document.querySelector("video.video-stream")?.paused===!1;
     throttleTimers=!(hv||isShorts());
     minDelay=(hv||isShorts())?150:CFG.cpu.minDelayIdle;
     log("Idle ON");
    }
   }
  },2e3);
 }
 const throttledNavigate=debounce(()=>{unpatchTimers();setTimeout(patchTimers,800)},500);
 window.addEventListener("yt-navigate-finish",throttledNavigate);
})();

// --- Flag override ---
const updateFlags=()=>{
 const flags=window.yt?.config_?.EXPERIMENT_FLAGS;
 if(flags)Object.assign(flags,CFG.flags);
};
const throttledFlagUpdate=throttle(updateFlags,1e3);
if(document.head){
 const flagObs=new MutationObserver(throttledFlagUpdate);
 flagObs.observe(document.head,{childList:!0,subtree:!0});
}
window.addEventListener('yt-navigate-finish',throttledFlagUpdate);
updateFlags();

// --- Instant Nav ---
if(CFG.ui.instantNav){
 const throttledMouseover=throttle(e=>{
  const link=e.target.closest('a[href^="/watch"]');
  if(link){
   const prefetch=document.createElement("link");
   prefetch.rel="prefetch";
   prefetch.href=link.href;
   prefetch.fetchPriority="low";
   document.head.appendChild(prefetch);
   setTimeout(()=>{prefetch.parentNode&&prefetch.parentNode.removeChild(prefetch)},3e4);
  }
 },200);
 document.addEventListener("mouseover",throttledMouseover,{passive:!0});
}

// --- Lazy thumbs ---
if(CFG.gpu.lazyThumbs){
 const thumbObserver=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
   if(entry.isIntersecting){
    if(entry.target.style.display==="none")
     entry.target.style.display="";
    thumbObserver.unobserve(entry.target);
   }
  });
 },{rootMargin:"1000px"});
 const lazyLoad=()=>{
  const el=document.querySelectorAll(
   "ytd-rich-item-renderer:not([data-lazy-opt]),"+
   "ytd-compact-video-renderer:not([data-lazy-opt]),"+
   "ytd-thumbnail:not([data-lazy-opt])"
  );
  el.forEach(e=>{
   e.dataset.lazyOpt="1";
   e.style.display="none";
   thumbObserver.observe(e);
  });
 };
 const throttledLazyLoad=throttle(lazyLoad,500);
 const lazyObs=new MutationObserver(throttledLazyLoad);
 if(document.body)lazyObs.observe(document.body,{childList:!0,subtree:!0});
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",lazyLoad);
 else setTimeout(lazyLoad,100);
}

// --- Ambient-mode disable ---
if(CFG.gpu.disableAmbient){
 const disableAmbient=()=>{
  const flexy=document.querySelector("ytd-watch-flexy");
  if(!flexy||flexy.dataset.ambientDis)return;
  flexy.dataset.ambientDis="1";
  const ambientObs=new MutationObserver(mutations=>{
   mutations.forEach(m=>{
    if(m.type==="attributes"&&m.attributeName==="ambient-mode-enabled"&&flexy.hasAttribute("ambient-mode-enabled"))
     flexy.removeAttribute("ambient-mode-enabled");
   });
  });
  ambientObs.observe(flexy,{attributes:!0,attributeFilter:["ambient-mode-enabled"]});
 };
 if(document.readyState==="loading")
  document.addEventListener("DOMContentLoaded",disableAmbient);
 else setTimeout(disableAmbient,500);
 const throttledAmbient=throttle(disableAmbient,1e3);
 window.addEventListener("yt-navigate-finish",throttledAmbient);
}

// --- UI attributes ---
if(CFG.ui.disableAnimations)document.documentElement.setAttribute("no-anim","");
if(CFG.ui.hideShorts)document.documentElement.setAttribute("hide-shorts","");

log("YouTube Ultimate Optimizer (Compact) loaded");
