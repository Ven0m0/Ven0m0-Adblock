// ==UserScript==
// @name        Web Pro Enhanced (Compact)
// @match       *://*/*
// @run-at      document-start
// ==/UserScript==
"use strict";
const KEY='ven0m0.webpro.v4.optimized';
const defaults={
 log:0,lazy:1,iframes:1,videos:1,defer:1,observe:1,prefetch:1,preconnect:1,linkPrefetch:1,linkLimit:10,linkDelay:3e3,
 gpu:1,mem:1,preload:1,cleanURL:1,bypass:1,rightClick:0,copy:1,select:1,cookie:1,tabSave:1,cpuTamer:1,rafTamer:1,
 caching:1,minTimeout:15,minInterval:20,showUI:1
};
const cfg=(()=>{try{return{...defaults,...JSON.parse(localStorage.getItem(KEY)||'')}}catch(_){return{...defaults}}})();
const save=()=>localStorage.setItem(KEY,JSON.stringify(cfg));
const L=(...a)=>cfg.log&&console.debug('webpro:',...a);

const idle=(fn,timeout=1500)=>{
 if(window.requestIdleCallback)return requestIdleCallback(fn,{timeout});
 return setTimeout(fn,300);
};

const mark=(e,k='data-wp')=>e?.setAttribute(k,'1');
const marked=(e,k='data-wp')=>e?.getAttribute(k)==='1';

const debounce=(fn,ms)=>{
 let t;
 return function(...a){clearTimeout(t);t=setTimeout(()=>fn.apply(this,a),ms);}
};

const throttle=(fn,ms)=>{
 let last=0;
 return function(...a){
  let now=Date.now();
  if(now-last>=ms){fn.apply(this,a);last=now;}
 };
};

// ---- CPU/RAF Tamers (still readable, less vertical whitespace) ----

if(cfg.cpuTamer||cfg.rafTamer){
 const AsyncFn=(async()=>{}).constructor;
 const [nTO,nSI,nRAF,nCTO,nCI,nCAF]=[setTimeout,setInterval,requestAnimationFrame,clearTimeout,clearInterval,cancelAnimationFrame];
 const microtask=queueMicrotask;
 let resolveFn=()=>{},promise,newPromise=()=>promise=new AsyncFn(r=>resolveFn=r);newPromise();
 const marker=document.createComment("--CPUTamer--");
 let counter=0,lastPromise=null;
 const trigger=()=>{
  if(lastPromise!==promise){
   lastPromise=promise;counter=(counter&7)+1;
   marker.data=(counter&1)?"++":"--";
  }
 };
 new MutationObserver(()=>{resolveFn();newPromise()}).observe(marker,{characterData:true});
 const timeoutSet=new Set(),rafSet=new Set();

 const awaitTimeout=async id=>{
  timeoutSet.add(id);
  if(lastPromise!==promise)microtask(trigger);
  await promise;
  if(lastPromise!==promise)microtask(trigger);
  await promise;
  timeoutSet.delete(id);
 };

 const awaitRAF=async (id, p)=>{
  rafSet.add(id);await p;rafSet.delete(id);
 };

 const throwErr=e=>microtask(()=>{throw e;});

 if(cfg.cpuTamer){
  window.setTimeout=function(fn,delay=0,...args){
   let id;
   const wrapped=typeof fn==="function"?
    (...a)=>awaitTimeout(id).then(v=>v&&fn(...a)).catch(throwErr):fn;
   delay=Math.max(delay,cfg.minTimeout);
   id=nTO(wrapped,delay,...args);
   return id;
  };
  window.setInterval=function(fn,delay=0,...args){
   let id;
   const wrapped=typeof fn==="function"?
    (...a)=>awaitTimeout(id).then(v=>v&&fn(...a)).catch(throwErr):fn;
   delay=Math.max(delay,cfg.minInterval);
   id=nSI(wrapped,delay,...args);
   return id;
  };
  window.clearTimeout=id=>{timeoutSet.delete(id);return nCTO(id);}
  window.clearInterval=id=>{timeoutSet.delete(id);return nCI(id);}
  L('CPU tamer enabled');
 }
 if(cfg.rafTamer){
  class Timeline{constructor(){this.startTime=performance.timeOrigin||performance.now()}
   get currentTime(){return performance.now()-this.startTime;}
  }
  let timeline;
  if(typeof DocumentTimeline=="function")timeline=new DocumentTimeline();
  else if(typeof Animation=="function"){const anim=document.documentElement?.animate?.(null);timeline=anim?.timeline||new Timeline();}
  else timeline=new Timeline();
  window.requestAnimationFrame=function(fn){
   let id,p=promise;
   const wrapped=ts=>{
    const start=timeline.currentTime;
    awaitRAF(id,p).then(v=>v&&fn(ts+(timeline.currentTime-start))).catch(throwErr);
   };
   if(lastPromise!==promise)microtask(trigger);
   id=nRAF(wrapped);
   return id;
  };
  window.cancelAnimationFrame=id=>{rafSet.delete(id);return nCAF(id);};
  L('RAF tamer enabled');
 }
}

// ---- UI/Perf tweaks (no blank lines, distinct blocks) ----

if(!cfg.log)console.log=console.warn=console.error=()=>{};
if(cfg.tabSave)document.addEventListener('visibilitychange',()=>{document.documentElement.style.cssText=document.visibilityState==='hidden'?'display:none!important':''});
let cache=new Map(),cacheSize=0,maxCacheSize=32*1024*1024,cacheTTL=3*60*1e3;
if(cfg.caching){
 const isCacheable=url=>/\.(css|woff2?|ttf|eot|js)$/i.test(url);
 const getCached=url=>{
  if(cache.has(url)){
   const {data,ts}=cache.get(url);
   if(Date.now()-ts<cacheTTL){
    cache.set(url,{data,ts:Date.now()});
    return Promise.resolve(data);
   }
   cache.delete(url);cacheSize-=data.length;
  }
  return null;
 };
 const setCache=(url,data)=>{
  if(cacheSize+data.length<=maxCacheSize){
   cache.set(url,{data,ts:Date.now()});cacheSize+=data.length;
  }
 };
 const origFetch=window.fetch;
 window.fetch=function(url,...args){
  if(typeof url==="string"&&isCacheable(url)){
   const cached=getCached(url);
   if(cached)return cached;
   return origFetch.call(this,url,...args).then(res=>{
    const size=res.headers.get("Content-Length");
    if(!size||parseInt(size)<=512000){
     return res.clone().text().then(text=>{
      setCache(url,text);
      return new Response(text,{status:res.status,statusText:res.statusText,headers:res.headers});
     });
    }
    return res;
   });
  }
  return origFetch.call(this,url,...args);
 }
}

// ---- URL & link cleaning ----

const trackParams=['fbclid','gclid','utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','mc_cid','mc_eid','_ga','pk_campaign','scid','src','ref','aff','affiliate','campaign','ad_id','ad_name','tracking','partner','promo','promoid','clickid','irclickid','spm','smid','pvid','qid','traffic_source','sprefix','rowan_id1','rowan_msg_id'];
const cleanHashes=['intcid','back-url','back_url','src'];

function cleanURL(){
 if(!cfg.cleanURL)return;
 try{
  const url=new URL(location.href.replace('/ref=','?ref='));
  let clean=0;
  for(const param of trackParams)if(url.searchParams.has(param)){url.searchParams.delete(param);clean=1}
  for(const hash of cleanHashes)if(url.hash.startsWith('#'+hash))clean=1;
  if(clean){
   window.history.replaceState(null,'',url.origin+url.pathname+url.search);
   L('URL clean');
  }
 }catch(_){}
}

function cleanLinks(){
 if(!cfg.cleanURL)return;
 const throttledClean=throttle(()=>{
  const links=document.querySelectorAll('a[href]:not([data-wp-cl])');
  if(!links.length)return;
  const batchSize=25;let idx=0;
  const processBatch=()=>{
   const end=Math.min(idx+batchSize,links.length);
   for(let i=idx;i<end;i++){
    const a=links[i];
    try{
     const url=new URL(a.href);
     if(url.href.includes('/ref='))a.href=a.href.replace('/ref=','?ref=');
     let mod=0;
     for(const param of trackParams)if(url.searchParams.has(param)){url.searchParams.delete(param);mod=1;}
     if(mod)a.href=url.origin+url.pathname+url.search;
     mark(a,'data-wp-cl');
    }catch(_){}
   }
   idx=end;if(idx<links.length)idle(processBatch);
  };
  processBatch();
 },500);
 throttledClean();
}

// ---- DOM bypass, copy/select, cookie ----

function applyBypass(){
 if(!cfg.bypass)return;
 if(cfg.rightClick)
  window.addEventListener('contextmenu',e=>e.stopImmediatePropagation(),{capture:true});
 if(cfg.copy){
  ['copy','paste','cut'].forEach(ev=>{
   document.addEventListener(ev,e=>{
    const t=e.target;if(['INPUT','TEXTAREA','DIV'].includes(t.tagName)&&t.isContentEditable)
     e.stopImmediatePropagation();
   },{capture:true});
  });
 }
 if(cfg.select&&!document.getElementById('wp-style')){
  const s=document.createElement('style');
  s.id='wp-style';
  s.textContent='*{user-select:text!important}::selection{background:#b3d4fc;color:#000}';
  document.head.appendChild(s);
 }
}

function acceptCookies(){
 if(!cfg.cookie)return;
 const throttledAccept=throttle(()=>{
  document.querySelectorAll('button, input[type=button]').forEach(b=>{
   const t=(b.innerText||b.value||'').toLowerCase();
   if(/accept|agree|allow/i.test(t))b.click();
  });
 },1000);
 throttledAccept();
}

// ---- GPU/mem tweaks ----

function forceGPU(){
 if(!cfg.gpu)return;
 const selectors='video, canvas, img[loading="eager"], div[role="img"]:not([data-wp-gpu]), .ytd-thumbnail:not([data-wp-gpu]), .video-preview:not([data-wp-gpu])';
 document.querySelectorAll(selectors).forEach(el=>{
  if(marked(el,'data-wp-gpu'))return;
  el.style.transform='translate3d(0,0,0)';
  el.style.willChange='transform';
  el.style.backfaceVisibility='hidden';
  mark(el,'data-wp-gpu');
 });
}

function optimizeMem(){
 if(!cfg.mem)return;
 if(window.performance?.memory)performance.memory.jsHeapSizeLimit*=0.90;
 if(window.gc)window.gc();
 L('mem optimized');
}

// ---- Preload/lazyload ----

function preloadRes(){
 if(!cfg.preload)return;
 document.querySelectorAll('img:not([data-wp-pre]), video:not([data-wp-pre]), audio:not([data-wp-pre])').forEach(r=>{
  const u=r.src||r.href;if(u){const img=new Image();img.src=u;}
  mark(r,'data-wp-pre');
 });
}

const loaded=new WeakSet();

function lazyIframes(){
 if(!cfg.iframes)return;
 document.querySelectorAll('iframe:not([data-wp])').forEach(i=>{
  const s=i.getAttribute('src'),sd=i.getAttribute('srcdoc');
  if(!s||!/^https?:/i.test(s)||sd!==null)return;
  i.setAttribute('loading','lazy');
  i.setAttribute('fetchpriority','low');
  mark(i);
 });
}

function lazyImages(){
 if(!cfg.lazy)return;
 document.querySelectorAll('img:not([data-wp])').forEach(i=>{
  const ld=i.getAttribute('loading');
  if(ld==='eager')return;
  if(!ld)i.setAttribute('loading','lazy');
  mark(i);
 });
}

function lazyVideos(){
 if(!cfg.videos)return;
 if("IntersectionObserver" in window){
  const observer=new IntersectionObserver(entries=>{
   entries.forEach(e=>{
    if(e.isIntersecting){
     const v=e.target;
     if(!loaded.has(v)){
      v.querySelectorAll("source[data-src]").forEach(s=>{
       if(s.dataset.src){s.src=s.dataset.src;delete s.dataset.src;}
      });
      if(v.dataset.src){v.src=v.dataset.src;delete v.dataset.src;}
      v.load();loaded.add(v);
     }
     observer.unobserve(v);
    }
   });
  },{rootMargin:'300px'});
  document.querySelectorAll('video[data-src], video:has(source[data-src])').forEach(v=>{
   observer.observe(v);
  });
 }
}

function optimizeVids(){
 if(!cfg.videos)return;
 document.querySelectorAll('video:not([data-wp])').forEach(v=>{
  const ap=v.hasAttribute('autoplay');
  const mu=v.hasAttribute('muted');
  const ct=v.hasAttribute('controls');
  if(!ap){
   v.setAttribute('preload','metadata');
   if(!mu)v.setAttribute('muted','');
   if(!ct)v.setAttribute('controls','');
  }
  mark(v);
 });
}

// ---- Script deferral ----

const scriptDeny=/ads?|analytics|tracking|doubleclick|googletag|gtag|google-analytics|adsbygoogle|consent|pixel|facebook|scorecardresearch|matomo|tealium|pardot|hubspot|hotjar|intercom|criteo|quantc/i;

function deferScripts(){
 if(!cfg.defer)return;
 document.querySelectorAll('script[src]:not([data-wp-s])').forEach(s=>{
  const src=s.getAttribute('src')||'',type=s.getAttribute('type')||'';
  if(scriptDeny.test(src)||type==='application/ld+json'){
   s.setAttribute('type','text/wp-blocked');
   s.setAttribute('data-wp-src',src);
   s.removeAttribute('src');
  }
  mark(s,'data-wp-s');
 });
}

function restoreScripts(){
 document.querySelectorAll('script[type="text/wp-blocked"][data-wp-src]').forEach(s=>{
  const src=s.getAttribute('data-wp-src');
  // Strict validation: only accept https URLs or root-relative, exclude protocol-relative, javascript:, data:, etc
  if(!src ||
    !(src.startsWith('https://') || src.startsWith('/')) ||
    src.startsWith('javascript:') ||
    src.startsWith('data:') ||
    src.startsWith('vbscript:') ||
    src.startsWith('//')) return;
  try {
    // Use URL constructor for absolute URLs; root-relative paths will throw unless base is provided
    if(src.startsWith('https://')) {
      new URL(src); // Throws if malformed
    }
  } catch {
    return;
  }
  const n=document.createElement('script');
  n.src=src;n.async=1;n.setAttribute('data-restored','1');
  s.parentNode.replaceChild(n,s);
 });
}

const userEvents=['click','keydown','touchstart','pointerdown'];
let interactionBound=0;

function bindRestore(){
 if(interactionBound)return;
 const cb=()=>{idle(()=>restoreScripts(),500);userEvents.forEach(e=>window.removeEventListener(e,cb,{passive:true}));interactionBound=0;};
 userEvents.forEach(e=>window.addEventListener(e,cb,{passive:true,once:true}));
 interactionBound=1;
}

// ---- Resource hints/preconnect etc ----

function addHint(rel,href,as,cors){
 if(!href||!/^\s*https?:/i.test(href))return;
 if(document.querySelector(`link[rel="${rel}"][href="${href}"]`))return;
 const lnk=document.createElement('link');
 lnk.rel=rel;lnk.href=href;if(as)lnk.as=as;if(cors)lnk.crossOrigin='anonymous';
 lnk.setAttribute('data-wp-hint','1');
 document.head.appendChild(lnk);
}

const origins=new Set();

function extractOrigins(){
 if(!cfg.preconnect)return;
 const elements=document.querySelectorAll('img[src], script[src], link[href], iframe[src], video[src], source[src]');
 for(const e of elements){
  const u=e.src||e.href;
  if(!u||!/^https?:/i.test(u))continue;
  try{const url=new URL(u);if(url.origin!==location.origin)origins.add(url.origin);}
  catch(_){}
 }
 for(const o of origins)addHint('preconnect',o);
}

function preloadCritical(){
 if(!cfg.preconnect)return;
 const selectors='link[rel="stylesheet"], link[rel="preload"], img[loading="eager"]';
 document.querySelectorAll(selectors).forEach(el=>{
  if(el.href)addHint('preload',el.href,'style');
  else if(el.src)addHint('preload',el.src,'image');
 });
}

// ---- Main runner ----

const run=throttle(()=>{
 cleanURL();
 applyBypass();
 acceptCookies();
 forceGPU();
 optimizeMem();
 preloadRes();
 lazyIframes();
 lazyImages();
 lazyVideos();
 optimizeVids();
 deferScripts();
 extractOrigins();
 preloadCritical();
},300);

if(document.readyState==='loading'){
 document.addEventListener('DOMContentLoaded',run);
}else setTimeout(run,100);

if(cfg.defer)bindRestore();

if(cfg.observe){
 const throttledMutation=throttle(()=>{
  cleanLinks();
  lazyIframes();
  lazyImages();
  lazyVideos();
  optimizeVids();
  deferScripts();
 },500);
 const obs=new MutationObserver(()=>throttledMutation());
 obs.observe(document.documentElement,{childList:true,subtree:true});
}

if(cfg.mem){
 document.addEventListener('visibilitychange',throttle(()=>{
  if(document.visibilityState==='hidden')optimizeMem();
 },5000));
}
L('Web Pro Enhanced (Compact) loaded');
