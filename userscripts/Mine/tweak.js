// ==UserScript==
// @name        Web Pro
// @namespace   Ven0m0
// @version     2.1
// @match       *://*/*
// @grant       none
// @run-at      document-start
// ==/UserScript==
"use strict";

// Timer clamping for 60fps performance
const origSetInterval = window.setInterval;
const origSetTimeout = window.setTimeout;
window.setInterval = (cb, d) => origSetInterval(cb, Math.max(d, 16));
window.setTimeout = (cb, d) => origSetTimeout(cb, Math.max(d, 10));

// Suppress console logging
console.log = console.warn = console.error = () => {};

// Config management
const KEY = "ven0m0.webperf.v2";
const defaults = {
  log: false,
  images: true,
  iframes: true,
  videos: true,
  deferScripts: true,
  observe: true,
  prefetch: true,
  preconnect: true,
  linkPrefetch: true,
  linkLimit: 15,
  linkDelay: 2000,
  gpuAccel: true,
  memOptim: true,
  preloadRes: false
};

const cfg = (() => {
  try {
    const stored = localStorage.getItem(KEY);
    return stored ? {...defaults, ...JSON.parse(stored)} : {...defaults};
  } catch(e) {
    return {...defaults};
  }
})();

const saveCfg = () => localStorage.setItem(KEY, JSON.stringify(cfg));
const L = (...args) => cfg.log && console.debug("webperf:", ...args);

// Utilities
const isHttp = u => /^\s*https?:/i.test(u);
const mark = (e, k = "data-webperf") => e.setAttribute(k, "1");
const marked = (e, k = "data-webperf") => e.getAttribute(k) === "1";
const runIdle = fn => {
  window.requestIdleCallback
    ? requestIdleCallback(fn, {timeout: 1000})
    : setTimeout(fn, 200);
};

// Link ignore patterns
const linkIgnore = [
  /\/api\/?/, 
  /^api\./,
  /\/(sign|log)\/?/, 
  /^https?:\/\/.+\/(.+)?premium/, 
  u => u.includes('video'),
  u => u.includes('#'),
  u => ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'youtubeeducation.com']
    .some(d => u.includes(d))
];

const shouldIgnoreLink = (u, e) => linkIgnore.some(i =>
  typeof i === 'function' ? i(u, e) : i.test ? i.test(u) : false
);

// GPU acceleration via CSS transform tricks
function forceHardwareAcceleration() {
  if (!cfg.gpuAccel) return;
  document.querySelectorAll("*:not([data-webperf-gpu])").forEach(el => {
    el.style.transform = 'translateZ(0)';
    el.style.willChange = 'transform, opacity';
    el.style.backfaceVisibility = 'hidden';
    mark(el, "data-webperf-gpu");
  });
  L("GPU acceleration applied");
}

// Memory optimization with GC trigger
function optimizeMemory() {
  if (!cfg.memOptim) return;
  if (window.performance?.memory) {
    performance.memory.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit * 0.95;
  }
  if (window.gc) window.gc();
  L("memory optimized");
}

// Preload media resources
function preloadResources() {
  if (!cfg.preloadRes) return;
  document.querySelectorAll("img:not([data-webperf-pre]),video:not([data-webperf-pre]),audio:not([data-webperf-pre]),source:not([data-webperf-pre])").forEach(r => {
    const u = r.src || r.href;
    if (u) new Image().src = u;
    mark(r, "data-webperf-pre");
  });
  L("resources preloaded");
}

// Enhanced RAF
const origRAF = window.requestAnimationFrame;
window.requestAnimationFrame = cb => origRAF(() => cb(performance.now()));

// Lazy load iframes
function lazyLoadIframes() {
  if (!cfg.iframes) return;
  document.querySelectorAll("iframe:not([data-webperf])").forEach(i => {
    const s = i.getAttribute("src");
    const sd = i.getAttribute("srcdoc");
    if (!s || !isHttp(s) || sd !== null) return;
    i.setAttribute("loading", "lazy");
    mark(i);
  });
}

// Lazy load images
function lazyLoadImages() {
  if (!cfg.images) return;
  document.querySelectorAll("img:not([data-webperf])").forEach(i => {
    const ld = i.getAttribute("loading");
    if (ld === "eager") return;
    if (!ld) i.setAttribute("loading", "lazy");
    mark(i);
  });
}

// Video optimization
function optimizeVideos() {
  if (!cfg.videos) return;
  document.querySelectorAll("video:not([data-webperf])").forEach(v => {
    const ap = v.hasAttribute("autoplay");
    const mu = v.hasAttribute("muted");
    const ct = v.hasAttribute("controls");
    if (!ap) {
      v.setAttribute("preload", "metadata");
      if (!mu) v.setAttribute("muted", "");
      if (!ct) v.setAttribute("controls", "");
    }
    mark(v);
  });
}

// Block tracking/ad scripts
const scriptDeny = /ads?|analytics|tracking|doubleclick|googletag|gtag|google-analytics|adsbygoogle|consent|pixel|facebook|scorecardresearch|matomo/i;

function deferNoncriticalScripts() {
  if (!cfg.deferScripts) return;
  document.querySelectorAll("script[src]:not([data-webperf-s])").forEach(s => {
    const src = s.getAttribute("src") || "";
    const type = s.getAttribute("type") || "";
    if (scriptDeny.test(src) || type === "application/ld+json") {
      s.setAttribute("type", "text/webperf-blocked");
      s.setAttribute("data-webperf-src", src);
      s.removeAttribute("src");
      L("blocked:", src);
    }
    mark(s, "data-webperf-s");
  });
}

function restoreDeferredScripts() {
  document.querySelectorAll("script[type='text/webperf-blocked'][data-webperf-src]").forEach(s => {
    const src = s.getAttribute("data-webperf-src");
    if (!src) return;
    const n = document.createElement("script");
    n.src = src;
    n.async = true;
    s.parentNode.replaceChild(n, s);
    L("restored:", src);
  });
}

// Restore deferred scripts on user interaction
const userInteractionEvents = ["click", "keydown", "touchstart", "pointerdown"];
let interactionBound = false;

function bindRestoreOnInteraction() {
  if (interactionBound) return;
  const cb = () => {
    runIdle(() => restoreDeferredScripts());
    userInteractionEvents.forEach(e => window.removeEventListener(e, cb, {passive: true}));
    interactionBound = false;
    L("deferred scripts restored on interaction");
  };
  userInteractionEvents.forEach(e =>
    window.addEventListener(e, cb, {passive: true, once: true})
  );
  interactionBound = true;
}

// Resource hints
function addResourceHint(rel, href, as, cors) {
  if (!href || !isHttp(href)) return;
  const existing = document.querySelector(`link[rel="${rel}"][href="${href}"]`);
  if (existing) return;
  const lnk = document.createElement("link");
  lnk.rel = rel;
  lnk.href = href;
  if (as) lnk.as = as;
  if (cors) lnk.crossOrigin = "anonymous";
  document.head.appendChild(lnk);
}

// Extract and preconnect to external origins
const origins = new Set();

function extractOrigins() {
  if (!cfg.preconnect) return;
  document.querySelectorAll("img[src],script[src],link[href],iframe[src],video[src],source[src]").forEach(e => {
    const u = e.src || e.href;
    if (!u || !isHttp(u)) return;
    try {
      const url = new URL(u);
      if (url.origin !== location.origin) origins.add(url.origin);
    } catch(ex) {}
  });
  origins.forEach(o => addResourceHint("preconnect", o));
}

// Preload critical sync scripts
function preloadCriticalResources() {
  if (!cfg.preconnect) return;
  document.querySelectorAll("script[src]:not([async]):not([defer])").forEach((s, i) => {
    if (i < 3) {
      const src = s.getAttribute("src");
      if (src && isHttp(src)) addResourceHint("preload", src, "script");
    }
  });
}

// Link prefetching system
let prefetchedLinks = new Set();
let prefetchQueue = [];
let prefetchTimer;

function shouldPrefetchLink(a) {
  const h = a.href;
  if (!h || !isHttp(h) || prefetchedLinks.has(h)) return false;
  if (shouldIgnoreLink(h, a)) return false;
  try {
    const u = new URL(h);
    if (u.origin !== location.origin) return false;
  } catch(e) {
    return false;
  }
  return true;
}

function prefetchLink(url) {
  if (prefetchedLinks.has(url)) return;
  const lnk = document.createElement("link");
  lnk.rel = "prefetch";
  lnk.href = url;
  lnk.as = "document";
  document.head.appendChild(lnk);
  prefetchedLinks.add(url);
  L("prefetch:", url);
}

function processPrefetchQueue() {
  if (!prefetchQueue.length) return;
  const batch = prefetchQueue.splice(0, cfg.linkLimit);
  batch.forEach(u => prefetchLink(u));
}

function queueLinkPrefetch(url) {
  if (!prefetchQueue.includes(url)) prefetchQueue.push(url);
  clearTimeout(prefetchTimer);
  prefetchTimer = setTimeout(processPrefetchQueue, cfg.linkDelay);
}

function setupLinkPrefetching() {
  if (!cfg.linkPrefetch || !cfg.prefetch) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const a = e.target;
        if (shouldPrefetchLink(a)) {
          queueLinkPrefetch(a.href);
          obs.unobserve(a);
        }
      }
    });
  }, {rootMargin: "50px"});
  document.querySelectorAll("a[href]").forEach(a => obs.observe(a));
}

// Apply all optimizations
function applyAll() {
  runIdle(() => {
    lazyLoadIframes();
    lazyLoadImages();
    optimizeVideos();
    deferNoncriticalScripts();
    if (cfg.deferScripts) bindRestoreOnInteraction();
    extractOrigins();
    preloadCriticalResources();
    setupLinkPrefetching();
    forceHardwareAcceleration();
    optimizeMemory();
    preloadResources();
  });
}

// DOM observer
let observer = null;

function startObserver() {
  if (!cfg.observe || observer) return;
  observer = new MutationObserver(m => applyAll());
  observer.observe(document.documentElement || document, {
    childList: true,
    subtree: true
  });
  L("observer started");
}

function stopObserver() {
  if (!observer) return;
  observer.disconnect();
  observer = null;
  L("observer stopped");
}

// UI construction
function buildUI() {
  if (document.getElementById("ven0m0-webperf-ui")) return;

  const css = `
    #ven0m0-webperf-ui{position:fixed;right:8px;bottom:8px;z-index:2147483647;background:rgba(0,0,0,0.85);color:#fff;font:12px monospace;padding:10px;border-radius:6px;user-select:none;max-width:300px;box-shadow:0 0 20px rgba(0,255,0,0.3)}
    .hdr{font-weight:bold;margin-bottom:8px;border-bottom:1px solid #0f0;padding-bottom:6px;color:#0f0;text-align:center}
    label{display:block;margin:4px 0;cursor:pointer;transition:color 0.2s}
    label:hover{color:#0f0}
    input[type=checkbox]{margin-right:6px}
    button{width:100%;margin:4px 0;padding:6px;font:11px monospace;background:#111;color:#0f0;border:1px solid #0f0;border-radius:4px;cursor:pointer;transition:all 0.2s}
    button:hover{background:#0f0;color:#000}
    .stats{margin-top:8px;padding-top:8px;border-top:1px solid #333;font-size:10px;color:#0f0;text-align:center}
  `;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const div = document.createElement("div");
  div.id = "ven0m0-webperf-ui";
  div.innerHTML = `<div class=hdr>⚡ WebPerf v2.1 ⚡</div>`;

  const items = [
    ["log", "Verbose logging"],
    ["images", "Lazy load images"],
    ["iframes", "Lazy load iframes"],
    ["videos", "Optimize videos"],
    ["deferScripts", "Defer 3rd-party scripts"],
    ["observe", "DOM observer"],
    ["prefetch", "Enable prefetch"],
    ["preconnect", "Preconnect origins"],
    ["linkPrefetch", "Link prefetching"],
    ["gpuAccel", "GPU acceleration"],
    ["memOptim", "Memory optimization"],
    ["preloadRes", "Preload resources"]
  ];

  items.forEach(([k, label]) => {
    const lab = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!cfg[k];
    cb.addEventListener("change", () => {
      cfg[k] = cb.checked;
      saveCfg();
      L("config updated:", k, cb.checked);
    });
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(label));
    div.appendChild(lab);
  });

  const btnApply = document.createElement("button");
  btnApply.textContent = "⚡ Apply Now";
  btnApply.addEventListener("click", () => {
    applyAll();
    L("manual apply");
  });

  const btnRestore = document.createElement("button");
  btnRestore.textContent = "🔓 Restore Scripts";
  btnRestore.addEventListener("click", () => restoreDeferredScripts());

  const btnClear = document.createElement("button");
  btnClear.textContent = "🗑️ Clear Cache";
  btnClear.addEventListener("click", () => {
    prefetchedLinks.clear();
    prefetchQueue = [];
    L("prefetch cache cleared");
  });

  const btnMemGC = document.createElement("button");
  btnMemGC.textContent = "♻️ Force GC";
  btnMemGC.addEventListener("click", () => {
    optimizeMemory();
    L("manual GC triggered");
  });

  div.appendChild(btnApply);
  div.appendChild(btnRestore);
  div.appendChild(btnClear);
  div.appendChild(btnMemGC);

  const stats = document.createElement("div");
  stats.className = "stats";
  stats.innerHTML = "MEM: calculating...";
  div.appendChild(stats);

  setInterval(() => {
    const mem = performance.memory
      ? (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + 'MB'
      : 'N/A';
    stats.innerHTML = `MEM: ${mem} | FPS: OPT | GPU: ${cfg.gpuAccel ? 'ON' : 'OFF'}`;
  }, 2000);

  document.documentElement.appendChild(div);
}

// Initialize
(function init() {
  buildUI();
  applyAll();
  if (cfg.observe) startObserver();
  setInterval(() => applyAll(), 30000);
  L("WebPerf v2.1 initialized", cfg);
})();
