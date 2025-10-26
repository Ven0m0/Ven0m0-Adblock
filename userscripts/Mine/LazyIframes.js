// ==UserScript==
// @name        Web pro
// @namespace   Ven0m0
// @version     2.0
// @match       *://*/*
// @grant       none
// @run-at      document-end
// ==/UserScript==
"use strict";
const KEY="ven0m0.webperf.v2",defaults={log:!1,images:!0,iframes:!0,videos:!0,deferScripts:!0,observe:!0,prefetch:!0,preconnect:!0,linkPrefetch:!0,linkLimit:15,linkDelay:2e3};
const cfg=(()=>{try{const r=localStorage.getItem(KEY);return r?{...defaults,...JSON.parse(r)}:{...defaults}}catch(e){return{...defaults}}})();
const saveCfg=()=>localStorage.setItem(KEY,JSON.stringify(cfg)),L=(...a)=>cfg.log&&console.debug("webperf:",...a);
const isHttp=u=>/^\s*https?:/i.test(u),mark=(e,k="data-webperf")=>e.setAttribute(k,"1"),marked=(e,k="data-webperf")=>e.getAttribute(k)==="1";
const runIdle=fn=>{window.requestIdleCallback?requestIdleCallback(fn,{timeout:1e3}):setTimeout(fn,200)};
const linkIgnore=[/\/api\/?/,/^api\./,/\/(sign|log)\/?/,/^https?:\/\/.+\/(.+)?premium/,u=>u.includes('video'),u=>u.includes('#'),u=>['youtube.com','youtu.be','youtube-nocookie.com','youtubeeducation.com','discord.com','discordapp.com','facebook.com','facebook.net','pin.it','pinimg.com','pinterest.com','redd.it','reddit.com','redditmedia.com','tiktok.com','twitter.com','twimg.com','t.co'].some(s=>u.includes(s)),u=>/\.(zip|tar|7z|rar|js|apk|xapk|woff2|tff|otf|pdf|mp3|mp4|wav|exe|msi|bat|deb|rpm|bin|dmg|iso|csv|log|sql|xml|key|odp|ods|pps|ppt|xls|doc|jpg|jpeg|jpe|jif|jfif|jfi|png|gif|webp|tif|psd|raw|arw|cr2|nrw|k25|bmp|dib|heif|heic|ind|indd|indt|jp2|j2k|jpf|jpx|jpm|mj2|svg|ai|eps)$/i.test(u),u=>/^(mailto|tel|file|ftp|data|javascript):/i.test(u),(u,e)=>e?.hasAttribute?.('noprefetch')];
const shouldIgnoreLink=(u,e)=>linkIgnore.some(i=>typeof i==='function'?i(u,e):i.test?i.test(u):!1);
function lazyLoadIframes(){if(!cfg.iframes)return;document.querySelectorAll("iframe:not([data-webperf])").forEach(i=>{const s=i.getAttribute("src"),sd=i.getAttribute("srcdoc");if(!s||!isHttp(s)||sd!==null)return;i.setAttribute("loading","lazy");i.setAttribute("fetchpriority","low");mark(i);L("iframe lazy:",s)})}
function lazyLoadImages(){if(!cfg.images)return;document.querySelectorAll("img:not([data-webperf])").forEach(i=>{const ld=i.getAttribute("loading");if(ld==="eager")return;if(!ld)i.setAttribute("loading","lazy");if(!i.getAttribute("decoding"))i.setAttribute("decoding","async");i.setAttribute("fetchpriority","low");mark(i);L("img lazy:",i.src||i.getAttribute("src"))})}
function optimizeVideos(){if(!cfg.videos)return;document.querySelectorAll("video:not([data-webperf])").forEach(v=>{const ap=v.hasAttribute("autoplay"),mu=v.hasAttribute("muted"),ct=v.hasAttribute("controls");if(!ap&&!mu&&ct){try{v.preload="metadata"}catch(e){}}else if(!ap&&!mu&&!ct){try{v.preload="none"}catch(e){}}if(!v.hasAttribute("playsinline"))v.setAttribute("playsinline","");mark(v);L("video optimized:",v.currentSrc||v.querySelector("source")?.src)})}
const scriptDeny=/ads?|analytics|tracking|doubleclick|googletag|gtag|google-analytics|adsbygoogle|consent|pixel|facebook|scorecardresearch|matomo/i;
function deferNoncriticalScripts(){if(!cfg.deferScripts)return;document.querySelectorAll("script[src]:not([data-webperf-s])").forEach(s=>{const src=s.getAttribute("src")||"",type=s.getAttribute("type")||"";if(/module/i.test(type))return;if(/jquery|react|vue|angular|bootstrap|polyfill/i.test(src))return;if(!scriptDeny.test(src))return;s.setAttribute("data-webperf-src",src);s.removeAttribute("src");s.type="text/webperf-blocked";mark(s,"data-webperf-s");L("script deferred:",src)})}
function restoreDeferredScripts(){document.querySelectorAll("script[type='text/webperf-blocked'][data-webperf-src]").forEach(s=>{const src=s.getAttribute("data-webperf-src");if(!src)return;const n=document.createElement("script");n.src=src;if(s.hasAttribute("async"))n.async=!0;if(s.hasAttribute("defer"))n.defer=!0;s.parentNode?.insertBefore(n,s);s.remove();L("script restored:",src)})}
const userInteractionEvents=["click","keydown","touchstart","pointerdown"];let interactionBound=!1;
function bindRestoreOnInteraction(){if(interactionBound)return;const cb=()=>{runIdle(()=>restoreDeferredScripts());userInteractionEvents.forEach(e=>window.removeEventListener(e,cb,{passive:!0}));interactionBound=!1};userInteractionEvents.forEach(e=>window.addEventListener(e,cb,{passive:!0}));interactionBound=!0}
function addResourceHint(rel,href,as,cors){if(!href||!isHttp(href))return;const existing=document.querySelector(`link[rel="${rel}"][href="${href}"]`);if(existing)return;const lnk=document.createElement("link");lnk.rel=rel;lnk.href=href;if(as)lnk.as=as;if(cors)lnk.crossOrigin="anonymous";document.head.appendChild(lnk);L(`${rel}:`,href)}
const origins=new Set();
function extractOrigins(){if(!cfg.preconnect)return;document.querySelectorAll("img[src],script[src],link[href],iframe[src],video[src],source[src]").forEach(e=>{const u=e.src||e.href;if(!u||!isHttp(u))return;try{const o=new URL(u).origin;if(o!==location.origin&&!origins.has(o)){origins.add(o);addResourceHint("preconnect",o,null,!0);addResourceHint("dns-prefetch",o)}}catch(e){}})}
function preloadCriticalResources(){if(!cfg.preconnect)return;document.querySelectorAll("script[src]:not([async]):not([defer])").forEach((s,i)=>{if(i<3){const src=s.getAttribute("src");if(src&&isHttp(src))addResourceHint("preload",src,"script")}});document.querySelectorAll("link[rel='stylesheet'][href]").forEach((l,i)=>{if(i<2){const h=l.getAttribute("href");if(h&&isHttp(h))addResourceHint("preload",h,"style")}})}
let prefetchedLinks=new Set(),prefetchQueue=[],prefetchTimer;
function shouldPrefetchLink(a){const h=a.href;if(!h||!isHttp(h)||prefetchedLinks.has(h))return!1;if(shouldIgnoreLink(h,a))return!1;try{const u=new URL(h);if(u.origin!==location.origin)return!1}catch(e){return!1}return!0}
function prefetchLink(url){if(prefetchedLinks.has(url))return;const lnk=document.createElement("link");lnk.rel="prefetch";lnk.href=url;lnk.as="document";document.head.appendChild(lnk);prefetchedLinks.add(url);L("prefetch:",url)}
function processPrefetchQueue(){if(!prefetchQueue.length)return;const batch=prefetchQueue.splice(0,cfg.linkLimit);batch.forEach(u=>prefetchLink(u))}
function queueLinkPrefetch(url){if(!prefetchQueue.includes(url))prefetchQueue.push(url);clearTimeout(prefetchTimer);prefetchTimer=setTimeout(processPrefetchQueue,cfg.linkDelay)}
function setupLinkPrefetching(){if(!cfg.linkPrefetch||!cfg.prefetch)return;const obs=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){const a=e.target;if(shouldPrefetchLink(a)){queueLinkPrefetch(a.href);obs.unobserve(a)}}})},{rootMargin:"100px"});document.querySelectorAll("a[href]").forEach(a=>shouldPrefetchLink(a)&&obs.observe(a));L("link prefetch observer started")}
function applyAll(){runIdle(()=>{lazyLoadIframes();lazyLoadImages();optimizeVideos();deferNoncriticalScripts();if(cfg.deferScripts)bindRestoreOnInteraction();extractOrigins();preloadCriticalResources();setupLinkPrefetching()})}
let observer=null;
function startObserver(){if(!cfg.observe||observer)return;observer=new MutationObserver(m=>applyAll());observer.observe(document.documentElement||document,{childList:!0,subtree:!0});L("observer started")}
function stopObserver(){if(!observer)return;observer.disconnect();observer=null;L("observer stopped")}
function buildUI(){if(document.getElementById("ven0m0-webperf-ui"))return;const css=`#ven0m0-webperf-ui{position:fixed;right:8px;bottom:8px;z-index:2147483647;background:rgba(0,0,0,0.66);color:#fff;font:12px/1.1 system-ui,Segoe UI,Roboto;border-radius:6px;padding:6px;backdrop-filter:blur(3px);min-width:180px}#ven0m0-webperf-ui label{display:flex;align-items:center;gap:6px;margin:4px 0}#ven0m0-webperf-ui .hdr{font-weight:600;margin-bottom:4px}#ven0m0-webperf-ui button{margin-top:6px;width:100%}`;
const style=document.createElement("style");style.textContent=css;document.head.appendChild(style);
const div=document.createElement("div");div.id="ven0m0-webperf-ui";div.innerHTML=`<div class=hdr>WebPerf v2</div>`;
const items=[["log","Verbose log"],["images","Lazy images"],["iframes","Lazy iframes"],["videos","Optimize videos"],["deferScripts","Defer 3rd-party scripts"],["observe","Observe DOM"],["prefetch","Enable prefetch"],["preconnect","Preconnect origins"],["linkPrefetch","Prefetch viewport links"]];
items.forEach(([k,label])=>{const lab=document.createElement("label"),cb=document.createElement("input");cb.type="checkbox";cb.checked=!!cfg[k];cb.addEventListener("change",()=>{cfg[k]=cb.checked;saveCfg();L("cfg",k,cfg[k]);if(k==="observe"){cfg.observe?startObserver():stopObserver()}});lab.appendChild(cb);lab.appendChild(document.createTextNode(label));div.appendChild(lab)});
const btnApply=document.createElement("button");btnApply.textContent="Apply now";btnApply.addEventListener("click",()=>{applyAll();L("manual apply")});
const btnRestore=document.createElement("button");btnRestore.textContent="Restore deferred scripts";btnRestore.style.marginTop="6px";btnRestore.addEventListener("click",()=>restoreDeferredScripts());
const btnClear=document.createElement("button");btnClear.textContent="Clear prefetch cache";btnClear.style.marginTop="6px";btnClear.addEventListener("click",()=>{prefetchedLinks.clear();prefetchQueue=[];L("prefetch cache cleared")});
div.appendChild(btnApply);div.appendChild(btnRestore);div.appendChild(btnClear);
document.documentElement.appendChild(div)}
(function init(){buildUI();applyAll();if(cfg.observe)startObserver();setInterval(()=>applyAll(),3e4);L("initialized",cfg)})();
