// ==UserScript==
// @name        Web Pro
// @namespace   Ven0m0
// @version     3.0
// @match       *://*/*
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_registerMenuCommand
// @grant       unsafeWindow
// @run-at      document-start
// ==/UserScript==
"use strict";
// Config
const K='ven0m0.webpro.v3';
const defs={
  log:0,lazy:1,iframes:1,videos:1,defer:1,observe:1,prefetch:1,preconnect:1,linkPrefetch:1,linkLimit:15,linkDelay:2e3,gpu:1,mem:1,preload:0,
  cleanURL:1,bypass:1,rightClick:0,copy:1,select:1,adBlock:1,cookie:1,tabSave:1
};
const cfg=(()=>{try{const s=localStorage.getItem(K);return s?{...defs,...JSON.parse(s)}:{...defs};}catch(e){return{...defs};}})();
const save=()=>localStorage.setItem(K,JSON.stringify(cfg));
const L=(...a)=>cfg.log&&console.debug('webpro:',...a);
// Utils
const isHttp=u=>/^\s*https?:/i.test(u);
const mark=(e,k='data-wp')=>e.setAttribute(k,'1');
const marked=(e,k='data-wp')=>e.getAttribute(k)==='1';
const idle=fn=>window.requestIdleCallback?requestIdleCallback(fn,{timeout:1e3}):setTimeout(fn,200);
// Timer clamping
const origSetInterval=window.setInterval;
const origSetTimeout=window.setTimeout;
window.setInterval=(cb,d)=>origSetInterval(cb,Math.max(d,16));
window.setTimeout=(cb,d)=>origSetTimeout(cb,Math.max(d,10));
// Suppress logs
if(!cfg.log){console.log=console.warn=console.error=()=>{};}
// Enhanced RAF
const origRAF=window.requestAnimationFrame;
window.requestAnimationFrame=cb=>origRAF(()=>cb(performance.now()));
// Tab visibility save
if(cfg.tabSave){
  document.addEventListener('visibilitychange',()=>{
    document.documentElement.style.display=document.visibilityState==='hidden'?'none':'block';
  });
}
// URL cleaning
const trackParams=[
  'fbclid','gclid','utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id',
  'mc_cid','mc_eid','_ga','pk_campaign','scid','src','ref','aff','affiliate','campaign',
  'ad_id','ad_name','tracking','partner','promo','promoid','clickid','irclickid','spm',
  'smid','pvid','qid','traffic_source','sprefix','rowan_id1','rowan_msg_id'
];
const cleanHashes=['intcid','back-url','back_url','src'];
function cleanURL(){
  if(!cfg.cleanURL)return;
  const url=new URL(location.href.replace('/ref=','?ref='));
  let clean=0;
  trackParams.forEach(p=>{if(url.searchParams.has(p)){url.searchParams.delete(p);clean=1;}});
  cleanHashes.forEach(h=>{if(url.hash.startsWith('#'+h))clean=1;});
  if(clean){
    const nu=url.origin+url.pathname+url.search;
    window.history.replaceState(null,'',nu);
    L('URL cleaned');
  }
}
function cleanLinks(){
  if(!cfg.cleanURL)return;
  document.querySelectorAll('a[href]:not([data-wp-cl])').forEach(a=>{
    try{
      const url=new URL(a.href);
      if(url.href.includes('/ref='))a.href=a.href.replace('/ref=','?ref=');
      let mod=0;
      trackParams.forEach(p=>{if(url.searchParams.has(p)){url.searchParams.delete(p);mod=1;}});
      if(mod)a.href=url.origin+url.pathname+url.search;
      mark(a,'data-wp-cl');
    }catch(e){}
  });
}
// Bypass restrictions
function applyBypass(){
  if(!cfg.bypass)return;
  if(cfg.rightClick){
    window.addEventListener('contextmenu',e=>e.stopImmediatePropagation(),{capture:!0});
  }
  if(cfg.copy){
    ['copy','paste','cut'].forEach(ev=>{
      document.addEventListener(ev,e=>{
        const t=e.target;
        if(['INPUT','TEXTAREA','DIV'].includes(t.tagName)&&t.isContentEditable)e.stopImmediatePropagation();
      },{capture:!0});
    });
  }
  if(cfg.select&&!document.getElementById('wp-style')){
    const s=document.createElement('style');
    s.id='wp-style';
    s.textContent='*{user-select:text!important}::selection{background:#b3d4fc;color:#000}';
    document.head.appendChild(s);
  }
}
// Ad blocking
const adSels=[
  '[data-component-type="sp-sponsored-result"]','.ad-banner','.player-ad-overlay',
  '.ytp-ad-overlay-close-button','[class*="sponsor"]','[class*="advertisement"]'
];
function blockAds(){
  if(!cfg.adBlock)return;
  const h=location.hostname;
  if(/youtube/.test(h)){
    const skip=document.querySelector('.ytp-ad-skip-button');
    if(skip)skip.click();
    const ov=document.querySelector('.ytp-ad-overlay-close-button');
    if(ov)ov.click();
    const v=document.querySelector('video');
    const ad=document.querySelector('.ad-showing');
    if(v&&ad&&!v.muted)v.muted=!0;
  }
  if(/twitch/.test(h)){
    const v=document.querySelector('video');
    if(v&&v.duration<60)v.muted=!0;
  }
  if(/netflix/.test(h)){
    const skip=document.querySelector('[data-uia="player-skip-intro"]');
    if(skip)skip.click();
  }
  adSels.forEach(sel=>{
    document.querySelectorAll(sel+':not([data-wp-ad])').forEach(e=>{
      e.style.display='none';
      mark(e,'data-wp-ad');
    });
  });
}
// Cookie acceptance
function acceptCookies(){
  if(!cfg.cookie)return;
  document.querySelectorAll('button,input[type=button]').forEach(b=>{
    const t=(b.innerText||b.value||'').toLowerCase();
    if(/accept|agree|allow/i.test(t))b.click();
  });
}
// GPU acceleration
function forceGPU(){
  if(!cfg.gpu)return;
  document.querySelectorAll('*:not([data-wp-gpu])').forEach(el=>{
    el.style.transform='translateZ(0)';
    el.style.willChange='transform,opacity';
    el.style.backfaceVisibility='hidden';
    mark(el,'data-wp-gpu');
  });
}
// Memory optimization
function optimizeMem(){
  if(!cfg.mem)return;
  if(window.performance?.memory){
    performance.memory.jsHeapSizeLimit=performance.memory.jsHeapSizeLimit*0.95;
  }
  if(window.gc)window.gc();
  L('mem optimized');
}
// Preload resources
function preloadRes(){
  if(!cfg.preload)return;
  document.querySelectorAll('img:not([data-wp-pre]),video:not([data-wp-pre]),audio:not([data-wp-pre])').forEach(r=>{
    const u=r.src||r.href;
    if(u)new Image().src=u;
    mark(r,'data-wp-pre');
  });
}
// Lazy load iframes
function lazyIframes(){
  if(!cfg.iframes)return;
  document.querySelectorAll('iframe:not([data-wp])').forEach(i=>{
    const s=i.getAttribute('src');
    const sd=i.getAttribute('srcdoc');
    if(!s||!isHttp(s)||sd!==null)return;
    i.setAttribute('loading','lazy');
    mark(i);
  });
}
// Lazy load images
function lazyImages(){
  if(!cfg.lazy)return;
  document.querySelectorAll('img:not([data-wp])').forEach(i=>{
    const ld=i.getAttribute('loading');
    if(ld==='eager')return;
    if(!ld)i.setAttribute('loading','lazy');
    mark(i);
  });
}
// Video optimization
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
// Block tracking scripts
const scriptDeny=/ads?|analytics|tracking|doubleclick|googletag|gtag|google-analytics|adsbygoogle|consent|pixel|facebook|scorecardresearch|matomo/i;
function deferScripts(){
  if(!cfg.defer)return;
  document.querySelectorAll('script[src]:not([data-wp-s])').forEach(s=>{
    const src=s.getAttribute('src')||'';
    const type=s.getAttribute('type')||'';
    if(scriptDeny.test(src)||type==='application/ld+json'){
      s.setAttribute('type','text/wp-blocked');
      s.setAttribute('data-wp-src',src);
      s.removeAttribute('src');
      L('blocked:',src);
    }
    mark(s,'data-wp-s');
  });
}
function restoreScripts(){
  document.querySelectorAll('script[type="text/wp-blocked"][data-wp-src]').forEach(s=>{
    const src=s.getAttribute('data-wp-src');
    if(!src)return;
    const n=document.createElement('script');
    n.src=src;
    n.async=!0;
    s.parentNode.replaceChild(n,s);
    L('restored:',src);
  });
}
const userEvents=['click','keydown','touchstart','pointerdown'];
let interactionBound=0;
function bindRestore(){
  if(interactionBound)return;
  const cb=()=>{
    idle(()=>restoreScripts());
    userEvents.forEach(e=>window.removeEventListener(e,cb,{passive:!0}));
    interactionBound=0;
    L('scripts restored');
  };
  userEvents.forEach(e=>window.addEventListener(e,cb,{passive:!0,once:!0}));
  interactionBound=1;
}
// Resource hints
function addHint(rel,href,as,cors){
  if(!href||!isHttp(href))return;
  if(document.querySelector(`link[rel="${rel}"][href="${href}"]`))return;
  const lnk=document.createElement('link');
  lnk.rel=rel;
  lnk.href=href;
  if(as)lnk.as=as;
  if(cors)lnk.crossOrigin='anonymous';
  document.head.appendChild(lnk);
}
const origins=new Set();
function extractOrigins(){
  if(!cfg.preconnect)return;
  document.querySelectorAll('img[src],script[src],link[href],iframe[src],video[src],source[src]').forEach(e=>{
    const u=e.src||e.href;
    if(!u||!isHttp(u))return;
    try{
      const url=new URL(u);
      if(url.origin!==location.origin)origins.add(url.origin);
    }catch(ex){}
  });
  origins.forEach(o=>addHint('preconnect',o));
}
function preloadCritical(){
  if(!cfg.preconnect)return;
  document.querySelectorAll('script[src]:not([async]):not([defer])').forEach((s,i)=>{
    if(i<3){
      const src=s.getAttribute('src');
      if(src&&isHttp(src))addHint('preload',src,'script');
    }
  });
}
// Link prefetching
let prefetched=new Set();
let prefetchQ=[];
let prefetchT;
const linkIgnore=[
  /\/api\/?/,/^api\./,/\/(sign|log)\/?/,/premium/,/#/,
  u=>u.includes('video'),
  u=>['youtube.com','youtu.be','youtube-nocookie.com','youtubeeducation.com'].some(d=>u.includes(d))
];
const shouldIgnore=(u,e)=>linkIgnore.some(i=>typeof i==='function'?i(u,e):i.test?i.test(u):0);
function shouldPrefetch(a){
  const h=a.href;
  if(!h||!isHttp(h)||prefetched.has(h))return 0;
  if(shouldIgnore(h,a))return 0;
  try{
    const u=new URL(h);
    if(u.origin!==location.origin)return 0;
  }catch(e){return 0;}
  return 1;
}
function prefetchLink(url){
  if(prefetched.has(url))return;
  const lnk=document.createElement('link');
  lnk.rel='prefetch';
  lnk.href=url;
  lnk.as='document';
  document.head.appendChild(lnk);
  prefetched.add(url);
  L('prefetch:',url);
}
function processPrefetchQ(){
  if(!prefetchQ.length)return;
  const batch=prefetchQ.splice(0,cfg.linkLimit);
  batch.forEach(u=>prefetchLink(u));
}
function queuePrefetch(url){
  if(!prefetchQ.includes(url))prefetchQ.push(url);
  clearTimeout(prefetchT);
  prefetchT=setTimeout(processPrefetchQ,cfg.linkDelay);
}
function setupLinkPrefetch(){
  if(!cfg.linkPrefetch||!cfg.prefetch)return;
  const obs=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        const a=e.target;
        if(shouldPrefetch(a)){
          queuePrefetch(a.href);
          obs.unobserve(a);
        }
      }
    });
  },{rootMargin:'50px'});
  document.querySelectorAll('a[href]').forEach(a=>obs.observe(a));
}
// Apply all optimizations
function applyAll(){
  idle(()=>{
    cleanLinks();
    lazyIframes();
    lazyImages();
    optimizeVids();
    deferScripts();
    if(cfg.defer)bindRestore();
    extractOrigins();
    preloadCritical();
    setupLinkPrefetch();
    forceGPU();
    optimizeMem();
    preloadRes();
    applyBypass();
    blockAds();
    acceptCookies();
  });
}
// DOM observer
let observer=null;
function startObs(){
  if(!cfg.observe||observer)return;
  observer=new MutationObserver(m=>applyAll());
  observer.observe(document.documentElement||document,{childList:!0,subtree:!0});
  L('observer started');
}
function stopObs(){
  if(!observer)return;
  observer.disconnect();
  observer=null;
  L('observer stopped');
}
// UI
function buildUI(){
  if(document.getElementById('wp-ui'))return;
  const css=`#wp-ui{position:fixed;right:8px;bottom:8px;z-index:2147483647;background:rgba(0,0,0,.85);color:#fff;font:12px monospace;padding:10px;border-radius:6px;user-select:none;max-width:300px;box-shadow:0 0 20px rgba(0,255,0,.3)}.hdr{font-weight:bold;margin-bottom:8px;border-bottom:1px solid #0f0;padding-bottom:6px;color:#0f0;text-align:center}label{display:block;margin:4px 0;cursor:pointer;transition:color .2s}label:hover{color:#0f0}input[type=checkbox]{margin-right:6px}button{width:100%;margin:4px 0;padding:6px;font:11px monospace;background:#111;color:#0f0;border:1px solid #0f0;border-radius:4px;cursor:pointer;transition:all .2s}button:hover{background:#0f0;color:#000}.stats{margin-top:8px;padding-top:8px;border-top:1px solid #333;font-size:10px;color:#0f0;text-align:center}`;
  const style=document.createElement('style');
  style.textContent=css;
  document.head.appendChild(style);
  const div=document.createElement('div');
  div.id='wp-ui';
  div.innerHTML='<div class=hdr>⚡ WebPro v3.0 ⚡</div>';
  const items=[
    ['log','Verbose logging'],
    ['lazy','Lazy load images'],
    ['iframes','Lazy load iframes'],
    ['videos','Optimize videos'],
    ['defer','Defer 3rd-party scripts'],
    ['observe','DOM observer'],
    ['prefetch','Enable prefetch'],
    ['preconnect','Preconnect origins'],
    ['linkPrefetch','Link prefetching'],
    ['gpu','GPU acceleration'],
    ['mem','Memory optimization'],
    ['preload','Preload resources'],
    ['cleanURL','Clean tracking URLs'],
    ['bypass','Bypass restrictions'],
    ['rightClick','Enable right-click'],
    ['copy','Enable copy/paste'],
    ['select','Enable text selection'],
    ['adBlock','Block ads'],
    ['cookie','Auto-accept cookies'],
    ['tabSave','Tab CPU saving']
  ];
  items.forEach(([k,label])=>{
    const lab=document.createElement('label');
    const cb=document.createElement('input');
    cb.type='checkbox';
    cb.checked=!!cfg[k];
    cb.addEventListener('change',()=>{
      cfg[k]=cb.checked;
      save();
      L('config updated:',k,cb.checked);
    });
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(label));
    div.appendChild(lab);
  });
  const btnApply=document.createElement('button');
  btnApply.textContent='⚡ Apply Now';
  btnApply.addEventListener('click',()=>{applyAll();L('manual apply');});
  const btnRestore=document.createElement('button');
  btnRestore.textContent='🔓 Restore Scripts';
  btnRestore.addEventListener('click',()=>restoreScripts());
  const btnClear=document.createElement('button');
  btnClear.textContent='🗑️ Clear Cache';
  btnClear.addEventListener('click',()=>{prefetched.clear();prefetchQ=[];L('cache cleared');});
  const btnMemGC=document.createElement('button');
  btnMemGC.textContent='♻️ Force GC';
  btnMemGC.addEventListener('click',()=>{optimizeMem();L('GC triggered');});
  div.appendChild(btnApply);
  div.appendChild(btnRestore);
  div.appendChild(btnClear);
  div.appendChild(btnMemGC);
  const stats=document.createElement('div');
  stats.className='stats';
  stats.innerHTML='MEM: calculating...';
  div.appendChild(stats);
  setInterval(()=>{
    const mem=performance.memory?(performance.memory.usedJSHeapSize/1048576).toFixed(2)+'MB':'N/A';
    stats.innerHTML=`MEM: ${mem} | FPS: OPT | GPU: ${cfg.gpu?'ON':'OFF'}`;
  },2e3);
  document.documentElement.appendChild(div);
}
// Init
(function init(){
  cleanURL();
  buildUI();
  applyAll();
  if(cfg.observe)startObs();
  setInterval(()=>applyAll(),3e4);
  L('WebPro v3.0 initialized',cfg);
})();
