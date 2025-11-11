// ==UserScript==
// @name         YouTube Ultimate Optimizer
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Merged YouTube performance optimization: CPU taming, GPU optimization, resource lock removal, ad blocking
// @author       Lucy
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(()=>{"use strict";

// ============================================================================
// GUARD: Prevent duplicate execution
// ============================================================================
const GUARD="__yt_ultimate_optimizer__";
if(window[GUARD])return;
window[GUARD]=!0;

// ============================================================================
// CONFIG
// ============================================================================
const CFG={
  debug:!1,
  cpu:{
    eventThrottle:!0,
    rafDecimation:!0,
    timerPatch:!0,
    idleBoost:!0,
    idleDelayNormal:6e3,
    idleDelayShorts:12e3,
    rafFpsVisible:24,
    rafFpsHidden:5,
    minDelayIdle:150,
    minDelayBase:50
  },
  gpu:{
    blockAV1:!0,
    disableAmbient:!0,
    lazyThumbs:!0
  },
  ui:{
    hideSpinner:!0,
    hideShorts:!0,
    hideAds:!0,
    disableAnimations:!0,
    contentVisibility:!0,
    instantNav:!0
  },
  flags:{
    IS_TABLET:!0,
    DISABLE_YT_IMG_DELAY_LOADING:!0,
    polymer_verifiy_app_state:!1,
    desktop_delay_player_resizing:!1,
    web_animated_actions:!1,
    web_animated_like:!1,
    render_unicode_emojis_as_small_images:!0,
    smartimation_background:!1,
    kevlar_refresh_on_theme_change:!1,
    kevlar_watch_cinematics:!1,
    web_cinematic_theater_mode:!1,
    web_cinematic_fullscreen:!1
  }
};

const log=(...a)=>CFG.debug&&console.log("[YT Optimizer]",...a);
const isShorts=()=>location.pathname.startsWith("/shorts");
const IDLE_ATTR="data-yt-idle";
const CV_OFF_ATTR="data-yt-cv-off";

// ============================================================================
// 1. RESOURCE LOCKS REMOVAL
// ============================================================================
(()=>{
  const AsyncFn=(async()=>{})().constructor;
  const w=window;
  if(typeof w?.navigator?.locks?.request=="function"){
    w.navigator.locks.query=()=>new AsyncFn(()=>{});
    w.navigator.locks.request=()=>new AsyncFn(()=>{});
    log("Navigator locks disabled");
  }
  
  const hasIDB=w?.indexedDB?.constructor?.name=="IDBFactory";
  if(hasIDB){
    const openDBs=new Set;
    const closedDBs=[];
    let cleanTimer=0;
    const weakRef=e=>e?new WeakRef(e):null;
    const deref=e=>e?.deref?.():e;
    
    const cleanup=()=>{
      for(const db of[...openDBs.values()]){
        try{db.result?.close()}catch{}
      }
      openDBs.clear();
      for(const[ref]of closedDBs){
        const db=deref(ref);
        db?.close?.();
      }
      closedDBs.length=0;
    };
    
    const scheduleClose=(db,name)=>{
      clearTimeout(cleanTimer);
      closedDBs.push([weakRef(db),name]);
      cleanTimer=setTimeout(cleanup,18e3);
    };
    
    const origOpen=w.indexedDB.constructor.prototype.open;
    w.indexedDB.constructor.prototype.open=function(name){
      const req=origOpen.call(this,name);
      const wrap=(type,fn)=>function(evt){
        fn.call(this,...arguments);
        const db=evt?.target?.result;
        if(openDBs.delete(db)){
          scheduleClose(db,name);
        }
      };
      
      const origAdd=req.addEventListener;
      req.addEventListener=function(type,fn,...a){
        if(type=="success"||type=="error"){
          return origAdd.call(this,type,wrap(type,fn),...a);
        }
        return origAdd.call(this,type,fn,...a);
      };
      
      openDBs.add(req);
      clearTimeout(cleanTimer);
      cleanTimer=setTimeout(cleanup,18e3);
      return req;
    };
    log("IndexedDB auto-close enabled");
  }
})();

// ============================================================================
// 2. GPU OPTIMIZATION
// ============================================================================
if(CFG.gpu.blockAV1){
  const origCanPlay=HTMLMediaElement.prototype.canPlayType;
  HTMLMediaElement.prototype.canPlayType=function(type){
    return type&&/codecs="?av01/i.test(type)?"":origCanPlay.call(this,type);
  };
  if(navigator.mediaCapabilities?.decodingInfo){
    const origDecode=navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);
    navigator.mediaCapabilities.decodingInfo=async cfg=>{
      const ct=cfg?.video?.contentType||"";
      return/codecs="?av01/i.test(ct)?{supported:!1,powerEfficient:!1,smooth:!1}:origDecode(cfg);
    };
  }
  log("AV1 codec blocked");
}

// ============================================================================
// 3. CSS INJECTION
// ============================================================================
(()=>{
  let css="";
  
  if(CFG.ui.disableAnimations){
    css+=`[no-anim] *{transition:none!important;animation:none!important}html{scroll-behavior:auto!important}`;
    css+=`.ytd-ghost-grid-renderer *,.ytd-continuation-item-renderer *{animation:none!important}`;
  }
  
  if(CFG.ui.contentVisibility){
    css+=`html:not([${CV_OFF_ATTR}]) #comments,html:not([${CV_OFF_ATTR}]) #related,html:not([${CV_OFF_ATTR}]) ytd-watch-next-secondary-results-renderer{content-visibility:auto!important;contain-intrinsic-size:800px 600px!important}`;
  }
  
  if(CFG.ui.hideSpinner){
    css+=`.ytp-spinner,.ytp-spinner *{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}`;
  }
  
  if(CFG.gpu.disableAmbient){
    css+=`.ytp-ambient-light,ytd-watch-flexy[ambient-mode-enabled] .ytp-ambient-light{display:none!important}`;
    css+=`ytd-app,ytd-watch-flexy,#content,#page-manager{backdrop-filter:none!important;filter:none!important;animation:none!important;will-change:auto!important}`;
  }
  
  if(CFG.ui.hideAds){
    css+=`ytd-shelf-renderer:has(ytd-ad-slot-renderer),ytd-reel-shelf-renderer,ytd-rich-section-renderer,ytd-display-ad-renderer,ytd-ad-slot-renderer,ytd-statement-banner-renderer,ytd-banner-promo-renderer-background,ytd-in-feed-ad-layout-renderer,ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],ytd-rich-item-renderer:has(> #content > ytd-ad-slot-renderer),#player-ads,masthead-ad,tp-yt-iron-overlay-backdrop{display:none!important}`;
  }
  
  if(CFG.ui.hideShorts){
    css+=`[hide-shorts] ytd-rich-section-renderer,ytd-reel-shelf-renderer,#endpoint[title="Shorts"],a[title="Shorts"]{display:none!important}`;
  }
  
  if(css){
    const style=document.createElement("style");
    style.textContent=css;
    (document.head||document.documentElement).appendChild(style);
    log("CSS injected");
  }
})();

// ============================================================================
// 4. EVENT THROTTLING
// ============================================================================
if(CFG.cpu.eventThrottle){
  const origAdd=EventTarget.prototype.addEventListener;
  const origRem=EventTarget.prototype.removeEventListener;
  const wrapMap=new WeakMap;
  const throttleEvents=new Set(["mousemove","pointermove","touchmove"]);
  const debounceEvents=new Map([["scroll",50],["wheel",50],["resize",100]]);
  
  const isPlayer=e=>e instanceof HTMLVideoElement||e.closest?.(".ytp-chrome-bottom,.ytp-volume-panel,.ytp-progress-bar");
  const isGlobal=e=>e===window||e===document||e===document.documentElement||e===document.body;
  
  const raf=(fn,ctx)=>{
    let pending=!1,args=null;
    return function(...a){
      args=a;
      if(!pending){
        pending=!0;
        requestAnimationFrame(()=>{
          pending=!1;
          fn.apply(ctx,args);
        });
      }
    };
  };
  
  const debounce=(fn,ctx,ms)=>{
    let timer=0,args=null;
    return function(...a){
      args=a;
      clearTimeout(timer);
      timer=setTimeout(()=>fn.apply(ctx,args),ms);
    };
  };
  
  EventTarget.prototype.addEventListener=function(type,fn,opts){
    if(isShorts()||!CFG.cpu.eventThrottle||typeof fn!="function"||isPlayer(this)||(isGlobal(this)&&(type=="wheel"||type=="scroll"||type=="resize"))){
      return origAdd.call(this,type,fn,opts);
    }
    
    let wrapped=fn;
    if(throttleEvents.has(type)){
      wrapped=raf(fn,this);
    }else if(debounceEvents.has(type)){
      wrapped=debounce(fn,this,debounceEvents.get(type));
    }
    
    if(wrapped!==fn)wrapMap.set(fn,wrapped);
    return origAdd.call(this,type,wrapped,opts);
  };
  
  EventTarget.prototype.removeEventListener=function(type,fn,opts){
    const wrapped=wrapMap.get(fn)||fn;
    return origRem.call(this,type,wrapped,opts);
  };
  
  log("Event throttling enabled");
}

// ============================================================================
// 5. RAF DECIMATION
// ============================================================================
if(CFG.cpu.rafDecimation){
  const origRAF=window.requestAnimationFrame.bind(window);
  const origCAF=window.cancelAnimationFrame.bind(window);
  const BASE_ID=1e9;
  let idCounter=1;
  const rafQueue=new Map;
  let rafScheduled=!1;
  let nextFrame=performance.now();
  
  const getInterval=()=>document.visibilityState=="visible"?1e3/CFG.cpu.rafFpsVisible:1e3/CFG.cpu.rafFpsHidden;
  
  const processQueue=()=>{
    if(!CFG.cpu.rafDecimation){
      rafScheduled=!1;
      return;
    }
    const now=performance.now();
    if(now>=nextFrame){
      nextFrame=now+getInterval();
      const cbs=Array.from(rafQueue.values());
      rafQueue.clear();
      for(const cb of cbs){
        try{cb(now)}catch(e){console.error(e)}
      }
    }
    origRAF(processQueue);
  };
  
  window.requestAnimationFrame=cb=>{
    if(!CFG.cpu.rafDecimation)return origRAF(cb);
    const id=BASE_ID+idCounter++;
    rafQueue.set(id,cb);
    if(!rafScheduled){
      rafScheduled=!0;
      nextFrame=performance.now();
      origRAF(processQueue);
    }
    return id;
  };
  
  window.cancelAnimationFrame=id=>{
    typeof id=="number"&&id>=BASE_ID?rafQueue.delete(id):origCAF(id);
  };
  
  document.addEventListener("visibilitychange",()=>{
    nextFrame=performance.now();
  });
  
  log("RAF decimation enabled");
}

// ============================================================================
// 6. TIMER PATCHES + IDLE DETECTION
// ============================================================================
(async()=>{
  if(!CFG.cpu.timerPatch)return;
  
  const nativeTimers={
    setTimeout:window.setTimeout.bind(window),
    clearTimeout:window.clearTimeout.bind(window),
    setInterval:window.setInterval.bind(window),
    clearInterval:window.clearInterval.bind(window)
  };
  
  const waitDOM=async()=>{
    while(!document.documentElement)await new Promise(requestAnimationFrame);
  };
  await waitDOM();
  
  const iframe=document.createElement("iframe");
  iframe.id="yt-timer-provider";
  iframe.style.display="none";
  iframe.sandbox="allow-same-origin allow-scripts";
  iframe.srcdoc="<!doctype html><title>timer</title>";
  document.documentElement.appendChild(iframe);
  
  while(!iframe.contentWindow?.setTimeout)await new Promise(requestAnimationFrame);
  
  const iframeTimers={
    setTimeout:iframe.contentWindow.setTimeout.bind(iframe.contentWindow),
    clearTimeout:iframe.contentWindow.clearTimeout.bind(iframe.contentWindow),
    setInterval:iframe.contentWindow.setInterval.bind(iframe.contentWindow),
    clearInterval:iframe.contentWindow.clearInterval.bind(iframe.contentWindow)
  };
  
  const trigger=document.createElement("div");
  trigger.id="yt-trigger-node";
  trigger.style.display="none";
  document.documentElement.appendChild(trigger);
  
  let throttleTimers=!0;
  let minDelay=CFG.cpu.minDelayBase;
  let lastActivity=performance.now();
  const timerSet=new WeakSet;
  
  const scheduleCallback=cb=>{
    if(document.visibilityState=="visible"){
      return new Promise(r=>{
        const obs=new MutationObserver(()=>{
          obs.disconnect();
          r();
        });
        obs.observe(trigger,{attributes:!0});
        trigger.setAttribute("data-trigger",Math.random().toString(36));
      }).then(cb);
    }
    return new Promise(requestAnimationFrame).then(cb);
  };
  
  const wrapTimeout=(impl,tracked)=>function(fn,delay=0,...args){
    const exec=typeof fn=="function"?()=>fn.apply(window,args):()=>(0,eval)(String(fn));
    if(isShorts()||!throttleTimers||delay<minDelay){
      return nativeTimers.setTimeout(exec,delay);
    }
    const id=impl(()=>scheduleCallback(exec),delay);
    tracked.add(id);
    return id;
  };
  
  const wrapClear=tracked=>id=>{
    tracked.has(id)?(tracked.delete(id),iframeTimers.clearTimeout(id)):nativeTimers.clearTimeout(id);
  };
  
  const wrapInterval=impl=>function(fn,delay=0,...args){
    if(isShorts()||typeof fn!="function"||delay<minDelay||!throttleTimers){
      return nativeTimers.setInterval(()=>fn.apply(window,args),delay);
    }
    return impl(()=>scheduleCallback(()=>fn.apply(window,args)),delay);
  };
  
  const patchTimers=()=>{
    const tracked=new Set;
    window.setTimeout=wrapTimeout(iframeTimers.setTimeout,tracked);
    window.clearTimeout=wrapClear(tracked);
    window.setInterval=wrapInterval(iframeTimers.setInterval);
    window.clearInterval=iframeTimers.clearInterval;
    log("Timer patches installed");
  };
  
  const unpatchTimers=()=>{
    Object.assign(window,nativeTimers);
    log("Timer patches removed");
  };
  
  patchTimers();
  
  if(CFG.cpu.idleBoost){
    const activityEvents=["mousemove","mousedown","keydown","wheel","touchstart","pointerdown","focusin"];
    const onActivity=()=>{
      lastActivity=performance.now();
      if(document.documentElement.hasAttribute(IDLE_ATTR)){
        document.documentElement.removeAttribute(IDLE_ATTR);
        throttleTimers=!0;
        minDelay=CFG.cpu.minDelayBase;
        log("Idle mode OFF");
      }
    };
    
    activityEvents.forEach(evt=>{
      window.addEventListener(evt,onActivity,{capture:!0,passive:!0});
    });
    
    setInterval(()=>{
      const now=performance.now();
      const idleThreshold=isShorts()?CFG.cpu.idleDelayShorts:CFG.cpu.idleDelayNormal;
      if(document.visibilityState=="visible"&&now-lastActivity>=idleThreshold){
        if(!document.documentElement.hasAttribute(IDLE_ATTR)){
          document.documentElement.setAttribute(IDLE_ATTR,"1");
          const hasVideo=document.querySelector("video.video-stream")?.paused==!1;
          throttleTimers=!hasVideo&&!isShorts();
          minDelay=hasVideo||isShorts()?120:CFG.cpu.minDelayIdle;
          log(`Idle mode ON (throttle=${throttleTimers})`);
        }
      }
    },1e3);
    
    log("Idle boost enabled");
  }
  
  window.addEventListener("yt-navigate-finish",()=>{
    unpatchTimers();
    setTimeout(patchTimers,500);
  });
})();

// ============================================================================
// 7. FLAG OVERRIDES
// ============================================================================
const updateFlags=()=>{
  const flags=window.yt?.config_?.EXPERIMENT_FLAGS;
  if(flags)Object.assign(flags,CFG.flags);
};
const flagObs=new MutationObserver(updateFlags);
flagObs.observe(document,{subtree:!0,childList:!0});

// ============================================================================
// 8. INSTANT NAVIGATION
// ============================================================================
if(CFG.ui.instantNav){
  document.addEventListener("mouseover",e=>{
    const link=e.target.closest('a[href^="/watch"]');
    if(link){
      const prefetch=document.createElement("link");
      prefetch.rel="prefetch";
      prefetch.href=link.href;
      document.head.appendChild(prefetch);
    }
  },{passive:!0});
  log("Instant navigation enabled");
}

// ============================================================================
// 9. LAZY THUMBNAILS
// ============================================================================
if(CFG.gpu.lazyThumbs){
  const lazyLoad=()=>{
    document.querySelectorAll("ytd-rich-item-renderer,ytd-compact-video-renderer").forEach(el=>{
      if(!el.dataset.lazyOpt){
        el.dataset.lazyOpt="1";
        el.style.display="none";
        const obs=new IntersectionObserver(([entry],o)=>{
          if(entry.isIntersecting){
            el.style.display="";
            o.disconnect();
          }
        },{rootMargin:"800px"});
        obs.observe(el);
      }
    });
  };
  
  const lazyObs=new MutationObserver(lazyLoad);
  if(document.body)lazyObs.observe(document.body,{childList:!0,subtree:!0});
  document.addEventListener("DOMContentLoaded",()=>{
    lazyLoad();
    if(document.body)lazyObs.observe(document.body,{childList:!0,subtree:!0});
  });
  log("Lazy thumbnails enabled");
}

// ============================================================================
// 10. AMBIENT MODE DISABLER
// ============================================================================
if(CFG.gpu.disableAmbient){
  const disableAmbient=()=>{
    const flexy=document.querySelector("ytd-watch-flexy");
    if(!flexy||flexy.dataset.ambientDis)return;
    flexy.dataset.ambientDis="1";
    const obs=new MutationObserver(()=>{
      flexy.removeAttribute("ambient-mode-enabled");
    });
    obs.observe(flexy,{attributes:!0,attributeFilter:["ambient-mode-enabled"]});
  };
  document.addEventListener("DOMContentLoaded",disableAmbient);
  window.addEventListener("yt-navigate-finish",disableAmbient);
  log("Ambient mode disabler enabled");
}

// ============================================================================
// 11. APPLY UI ATTRIBUTES
// ============================================================================
if(CFG.ui.disableAnimations)document.documentElement.setAttribute("no-anim","");
if(CFG.ui.hideShorts)document.documentElement.setAttribute("hide-shorts","");

log("YouTube Ultimate Optimizer loaded");
})();
