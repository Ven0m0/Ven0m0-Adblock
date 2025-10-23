// ==UserScript==
// @name        Web pro
// @namespace   Ven0m0
// @version     1.0
// @match       *://*/*
// @grant       none
// @run-at      document-end
// ==/UserScript==

"use strict";

/* config (persisted in localStorage) */
const KEY = "ven0m0.webperf.v1";
const defaults = {
  log: false,
  images: true,
  iframes: true,
  videos: true,
  deferScripts: true,
  observe: true
};

const cfg = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {...defaults};
    return Object.assign({}, defaults, JSON.parse(raw));
  } catch (e) { return {...defaults}; }
})();
const saveCfg = () => localStorage.setItem(KEY, JSON.stringify(cfg));
const L = (...a) => cfg.log && console.debug("webperf:", ...a);

/* utilities */
const isHttp = u => /^\s*https?:/i.test(u);
const mark = (el, k = "data-webperf") => el.setAttribute(k, "1");
const marked = (el, k = "data-webperf") => el.getAttribute(k) === "1";
const runIdle = (fn) => {
  if (window.requestIdleCallback) requestIdleCallback(fn, {timeout: 1e3});
  else setTimeout(fn, 200);
};

/* core tweaks */
function lazyLoadIframes() {
  if (!cfg.iframes) return;
  document.querySelectorAll("iframe").forEach(iframe => {
    if (marked(iframe)) return;
    const src = iframe.getAttribute("src");
    const srcdoc = iframe.getAttribute("srcdoc");
    if (!src || !isHttp(src) || srcdoc !== null) return;
    iframe.setAttribute("loading", "lazy");
    // lower network priority for offscreen frames
    iframe.setAttribute("fetchpriority", "low");
    mark(iframe);
    L("iframe lazy:", src);
  });
}

function lazyLoadImages() {
  if (!cfg.images) return;
  document.querySelectorAll("img").forEach(img => {
    if (marked(img)) return;
    // keep images with explicit eager alone
    const loading = img.getAttribute("loading");
    if (loading === "eager") return;
    // set lazy + async decoding
    if (!loading) img.setAttribute("loading", "lazy");
    // decoding is safe for modern browsers
    if (!img.getAttribute("decoding")) img.setAttribute("decoding", "async");
    img.setAttribute("fetchpriority", "low");
    mark(img);
    L("img lazy:", img.src || img.getAttribute("src"));
  });
}
function optimizeVideos() {
  if (!cfg.videos) return;
  document.querySelectorAll("video").forEach(v => {
    if (marked(v)) return;
    // if video is not autoplay and not muted, reduce preload
    const autoplay = v.hasAttribute("autoplay");
    const muted = v.hasAttribute("muted");
    const controls = v.hasAttribute("controls");
    if (!autoplay && !muted && controls) {
      // prefer metadata or none to avoid heavy downloads
      try { v.preload = "metadata"; } catch (e) {}
    } else if (!autoplay && !muted && !controls) {
      try { v.preload = "none"; } catch (e) {}
    }
    // playsinline can avoid expensive compositor changes on mobile/embedded
    if (!v.hasAttribute("playsinline")) v.setAttribute("playsinline", "");
    mark(v);
    L("video optimized:", v.currentSrc || v.querySelector("source")?.src);
  });
}

/* safe script deferral:
   - only touch external scripts (with src) that match a conservative deny regex
   - do not touch inline scripts or module scripts
   - store original src in data-src and remove src to prevent load
   - restore on user interaction or explicit enable
*/
const scriptDeny = /ads?|analytics|tracking|doubleclick|googletag|gtag|google-analytics|adsbygoogle|consent|pixel|facebook|scorecardresearch|matomo/i;
function deferNoncriticalScripts() {
  if (!cfg.deferScripts) return;
  document.querySelectorAll("script[src]").forEach(s => {
    if (marked(s, "data-webperf-s")) return;
    const src = s.getAttribute("src") || "";
    const type = s.getAttribute("type") || "";
    // skip modules and known frameworks
    if (/module/i.test(type)) return;
    if (/jquery|react|vue|angular|bootstrap|polyfill/i.test(src)) return;
    // target likely third-party but conservative: only when deny matches
    if (!scriptDeny.test(src)) return;
    // block load
    s.setAttribute("data-webperf-src", src);
    s.removeAttribute("src");
    s.type = "text/webperf-blocked";
    mark(s, "data-webperf-s");
    L("script deferred:", src);
  });
}
/* restore deferred scripts (on interaction or explicit enable) */
function restoreDeferredScripts() {
  document.querySelectorAll("script[type='text/webperf-blocked'][data-webperf-src]").forEach(s => {
    const src = s.getAttribute("data-webperf-src");
    if (!src) return;
    const n = document.createElement("script");
    n.src = src;
    // preserve async/defer hints if present on original (best-effort)
    if (s.hasAttribute("async")) n.async = true;
    if (s.hasAttribute("defer")) n.defer = true;
    // insert near original
    s.parentNode && s.parentNode.insertBefore(n, s);
    s.remove();
    L("script restored:", src);
  });
}
/* interaction triggers */
const userInteractionEvents = ["click", "keydown", "touchstart", "pointerdown"];
let interactionBound = false;
function bindRestoreOnInteraction() {
  if (interactionBound) return;
  const cb = () => {
    runIdle(() => {
      restoreDeferredScripts();
    });
    userInteractionEvents.forEach(ev => window.removeEventListener(ev, cb, {passive:true}));
    interactionBound = false;
  };
  userInteractionEvents.forEach(ev => window.addEventListener(ev, cb, {passive:true}));
  interactionBound = true;
}
/* apply once, using requestIdleCallback for low CPU impact */
function applyAll() {
  runIdle(() => {
    lazyLoadIframes();
    lazyLoadImages();
    optimizeVideos();
    deferNoncriticalScripts();
    if (cfg.deferScripts) bindRestoreOnInteraction();
  });
}
/* observe mutations for dynamic pages */
let observer = null;
function startObserver() {
  if (!cfg.observe) return;
  if (observer) return;
  observer = new MutationObserver(muts => applyAll());
  observer.observe(document.documentElement || document, {childList:true, subtree:true});
  L("observer started");
}
function stopObserver() {
  if (!observer) return;
  observer.disconnect();
  observer = null;
  L("observer stopped");
}
/* simple floating UI to toggle features */
function buildUI() {
  if (document.getElementById("ven0m0-webperf-ui")) return;
  const css = `
  #ven0m0-webperf-ui{position:fixed;right:8px;bottom:8px;z-index:2147483647;
    background:rgba(0,0,0,0.66);color:#fff;font:12px/1.1 system-ui,Segoe UI,Roboto;
    border-radius:6px;padding:6px;backdrop-filter:blur(3px);min-width:180px}
  #ven0m0-webperf-ui label{display:flex;align-items:center;gap:6px;margin:4px 0}
  #ven0m0-webperf-ui .hdr{font-weight:600;margin-bottom:4px}
  #ven0m0-webperf-ui button{margin-top:6px;width:100%}
  `;
  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);
  const div = document.createElement("div"); div.id = "ven0m0-webperf-ui";
  div.innerHTML = `<div class=hdr>WebPerf</div>`;
  const items = [
    ["log","Verbose log"],
    ["images","Lazy images"],
    ["iframes","Lazy iframes"],
    ["videos","Optimize videos"],
    ["deferScripts","Defer 3rd-party scripts"],
    ["observe","Observe DOM"]
  ];
  items.forEach(([k,label]) => {
    const lab = document.createElement("label");
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!cfg[k];
    cb.addEventListener("change", () => { cfg[k] = cb.checked; saveCfg(); L("cfg",k,cfg[k]); if (k==="observe") { cfg.observe? startObserver(): stopObserver(); } });
    lab.appendChild(cb); lab.appendChild(document.createTextNode(label));
    div.appendChild(lab);
  });
  const btnApply = document.createElement("button");
  btnApply.textContent = "Apply now";
  btnApply.addEventListener("click", () => { applyAll(); L("manual apply"); });
  const btnRestore = document.createElement("button");
  btnRestore.textContent = "Restore deferred scripts";
  btnRestore.style.marginTop = "6px";
  btnRestore.addEventListener("click", () => { restoreDeferredScripts(); });
  div.appendChild(btnApply);
  div.appendChild(btnRestore);
  document.documentElement.appendChild(div);
}
/* init */
(function init() {
  buildUI();
  applyAll();
  if (cfg.observe) startObserver();
  // periodic re-apply for long-running pages
  setInterval(() => applyAll(), 30_000);
  L("initialized", cfg);
})();
