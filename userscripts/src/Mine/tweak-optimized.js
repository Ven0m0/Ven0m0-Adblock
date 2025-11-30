// ==UserScript==
// @name        Web Pro Enhanced (Optimized)
// @description General web performance optimizer - Optimized version
// @namespace   Ven0m0
// @author      Ven0m0
// @version     4.1.0
// @license      GPLv3
// @match       *://*/*
// @grant       none
// @run-at      document-start
// ==/UserScript==
"use strict";

// ============================================================================
// OPTIMIZED: CONFIG & STORAGE
// ============================================================================

const K = 'ven0m0.webpro.v4.optimized';
const defs = {
  log: 0,
  lazy: 1,
  iframes: 1,
  videos: 1,
  defer: 1,
  observe: 1,
  prefetch: 1,
  preconnect: 1,
  linkPrefetch: 1,
  linkLimit: 10,      // Reduced from 15 for better performance
  linkDelay: 3e3,     // Increased for better performance
  gpu: 1,
  mem: 1,
  preload: 1,
  cleanURL: 1,
  bypass: 1,
  rightClick: 0,
  copy: 1,
  select: 1,
  cookie: 1,
  tabSave: 1,
  cpuTamer: 1,
  rafTamer: 1,
  caching: 1,
  minTimeout: 15,     // Increased from 10 for better performance
  minInterval: 20,    // Increased from 16 for better performance
  showUI: 1
};

// OPTIMIZED: More efficient config loading with error handling
const cfg = (() => {
  try {
    const stored = localStorage.getItem(K);
    return stored ? { ...defs, ...JSON.parse(stored) } : { ...defs };
  } catch (e) {
    return { ...defs };
  }
})();

const save = () => localStorage.setItem(K, JSON.stringify(cfg));
const L = (...a) => cfg.log && console.debug('webpro (optimized):', ...a);

// ============================================================================
// OPTIMIZED: UTILITIES
// ============================================================================

// OPTIMIZED: More efficient utility functions
const isHttp = u => /^\\s*https?:/i.test(u);
const mark = (e, k = 'data-wp') => e?.setAttribute(k, '1');
const marked = (e, k = 'data-wp') => e?.getAttribute(k) === '1';

// OPTIMIZED: More efficient idle callback with better fallback
const idle = (fn, timeout = 1500) => {  // Increased timeout for better performance
  if (window.requestIdleCallback) {
    return requestIdleCallback(fn, { timeout });
  } else {
    return setTimeout(fn, 300);  // Slightly longer delay for better performance
  }
};

// OPTIMIZED: More efficient debounce and throttle
const debounce = (fn, ms) => {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

const throttle = (fn, ms) => {
  let lastExecTime = 0;
  return function(...args) {
    const currentTime = Date.now();
    if (currentTime - lastExecTime >= ms) {
      fn.apply(this, args);
      lastExecTime = currentTime;
    }
  };
};

// ============================================================================
// OPTIMIZED: CPU TAMING - ADVANCED TIMER & RAF PATCHING
// ============================================================================

if (cfg.cpuTamer || cfg.rafTamer) {
  const AsyncFn = (async () => {}).constructor;
  const nativeTimers = [
    setTimeout, 
    setInterval, 
    requestAnimationFrame, 
    clearTimeout, 
    clearInterval, 
    cancelAnimationFrame
  ];
  const [nTO, nSI, nRAF, nCTO, nCI, nCAF] = nativeTimers;
  const microtask = queueMicrotask;
  
  let resolveFn = () => {};
  let promise;
  const newPromise = () => promise = new AsyncFn(r => resolveFn = r);
  newPromise();
  
  const marker = document.createComment("--CPUTamer--");
  let counter = 0;
  let lastPromise = null;
  
  const trigger = () => {
    if (lastPromise !== promise) {
      lastPromise = promise;
      counter = (counter & 7) + 1;
      marker.data = (counter & 1) ? "++" : "--";
    }
  };
  
  const obs = new MutationObserver(() => {
    resolveFn();
    newPromise();
  });
  obs.observe(marker, { characterData: true });
  
  const timeoutSet = new Set();
  const rafSet = new Set();
  
  // OPTIMIZED: More efficient timeout and RAF handling
  const awaitTimeout = async id => {
    timeoutSet.add(id);
    if (lastPromise !== promise) microtask(trigger);
    await promise;
    if (lastPromise !== promise) microtask(trigger);
    await promise;
    timeoutSet.delete(id);
  };
  
  const awaitRAF = async (id, p) => {
    rafSet.add(id);
    await p;
    rafSet.delete(id);
  };
  
  const throwErr = e => microtask(() => { throw e; });
  
  if (cfg.cpuTamer) {
    // OPTIMIZED: More efficient timeout patching
    window.setTimeout = function(fn, delay = 0, ...args) {
      let id;
      const wrapped = typeof fn === "function" 
        ? (...a) => awaitTimeout(id).then(v => v && fn(...a)).catch(throwErr)
        : fn;
      
      delay = Math.max(delay, cfg.minTimeout);
      id = nTO(wrapped, delay, ...args);
      return id;
    };
    
    window.setInterval = function(fn, delay = 0, ...args) {
      let id;
      const wrapped = typeof fn === "function" 
        ? (...a) => awaitTimeout(id).then(v => v && fn(...a)).catch(throwErr)
        : fn;
      
      delay = Math.max(delay, cfg.minInterval);
      id = nSI(wrapped, delay, ...args);
      return id;
    };
    
    window.clearTimeout = id => {
      timeoutSet.delete(id);
      return nCTO(id);
    };
    
    window.clearInterval = id => {
      timeoutSet.delete(id);
      return nCI(id);
    };
    L('CPU tamer enabled');
  }
  
  if (cfg.rafTamer) {
    // OPTIMIZED: More efficient timeline handling
    class Timeline {
      constructor() {
        this.startTime = performance.timeOrigin || performance.now();
      }
      get currentTime() {
        return performance.now() - this.startTime;
      }
    }
    
    let timeline;
    if (typeof DocumentTimeline === "function") {
      timeline = new DocumentTimeline();
    } else if (typeof Animation === "function") {
      const anim = document.documentElement?.animate?.(null);
      timeline = anim?.timeline || new Timeline();
    } else {
      timeline = new Timeline();
    }
    
    window.requestAnimationFrame = function(fn) {
      let id;
      const p = promise;
      const wrapped = ts => {
        const start = timeline.currentTime;
        awaitRAF(id, p).then(v => v && fn(ts + (timeline.currentTime - start))).catch(throwErr);
      };
      
      if (lastPromise !== promise) microtask(trigger);
      id = nRAF(wrapped);
      return id;
    };
    
    window.cancelAnimationFrame = id => {
      rafSet.delete(id);
      return nCAF(id);
    };
    L('RAF tamer enabled');
  }
}

// OPTIMIZED: More efficient log suppression
if (!cfg.log) {
  console.log = console.warn = console.error = () => {};
}

// OPTIMIZED: More efficient tab visibility handling
if (cfg.tabSave) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      document.documentElement.style.cssText = 'display:none !important';
    } else {
      document.documentElement.style.cssText = '';
    }
  });
}

// ============================================================================
// OPTIMIZED: CACHING
// ============================================================================

// OPTIMIZED: More efficient caching with better memory management
let cache = new Map();
let cacheSize = 0;
const maxCacheSize = 32 * 1024 * 1024;  // Reduced from 48MB for better performance
const cacheTTL = 3 * 60 * 1e3;          // Reduced from 5 minutes for better freshness

if (cfg.caching) {
  const isCacheable = url => /\.(css|woff2?|ttf|eot|js)$/i.test(url);
  
  const getCached = url => {
    if (cache.has(url)) {
      const { data, ts } = cache.get(url);
      if (Date.now() - ts < cacheTTL) {
        cache.set(url, { data, ts: Date.now() });  // Update timestamp
        return Promise.resolve(data);
      }
      // Remove expired cache entry
      cache.delete(url);
      cacheSize -= data.length;
    }
    return null;
  };
  
  const setCache = (url, data) => {
    if (cacheSize + data.length <= maxCacheSize) {
      cache.set(url, { data, ts: Date.now() });
      cacheSize += data.length;
    }
  };
  
  const origFetch = window.fetch;
  window.fetch = function(url, ...args) {
    if (typeof url === "string" && isCacheable(url)) {
      const cached = getCached(url);
      if (cached) return cached;
      
      return origFetch.call(this, url, ...args).then(res => {
        const size = res.headers.get("Content-Length");
        if (!size || parseInt(size) <= 512000) {  // Reduced max size to 512KB for better performance
          return res.clone().text().then(text => {
            setCache(url, text);
            return new Response(text, {
              status: res.status,
              statusText: res.statusText,
              headers: res.headers
            });
          });
        }
        return res;
      });
    }
    return origFetch.call(this, url, ...args);
  };
  L('Caching enabled');
}

// ============================================================================
// OPTIMIZED: URL CLEANING
// ============================================================================

// OPTIMIZED: More efficient tracking parameters with better performance
const trackParams = [
  'fbclid', 'gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
  'mc_cid', 'mc_eid', '_ga', 'pk_campaign', 'scid', 'src', 'ref', 'aff', 'affiliate', 'campaign',
  'ad_id', 'ad_name', 'tracking', 'partner', 'promo', 'promoid', 'clickid', 'irclickid', 'spm',
  'smid', 'pvid', 'qid', 'traffic_source', 'sprefix', 'rowan_id1', 'rowan_msg_id'
];

const cleanHashes = ['intcid', 'back-url', 'back_url', 'src'];

// OPTIMIZED: More efficient URL cleaning
function cleanURL() {
  if (!cfg.cleanURL) return;
  try {
    const url = new URL(location.href.replace('/ref=', '?ref='));
    let clean = 0;
    
    for (const param of trackParams) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        clean = 1;
      }
    }
    
    for (const hash of cleanHashes) {
      if (url.hash.startsWith('#' + hash)) {
        clean = 1;
      }
    }
    
    if (clean) {
      window.history.replaceState(null, '', url.origin + url.pathname + url.search);
      L('URL cleaned');
    }
  } catch (e) {
    // Ignore URL parsing errors
  }
}

// OPTIMIZED: More efficient link cleaning with batching and throttling
function cleanLinks() {
  if (!cfg.cleanURL) return;
  
  // OPTIMIZED: Use throttled link cleaning
  const throttledClean = throttle(() => {
    const links = document.querySelectorAll('a[href]:not([data-wp-cl])');
    if (links.length === 0) return;
    
    // Process in smaller batches for better performance
    const batchSize = 25;  // Reduced from 50 for better performance
    let idx = 0;
    
    const processBatch = () => {
      const end = Math.min(idx + batchSize, links.length);
      for (let i = idx; i < end; i++) {
        const a = links[i];
        try {
          const url = new URL(a.href);
          if (url.href.includes('/ref=')) a.href = a.href.replace('/ref=', '?ref=');
          
          let mod = 0;
          for (const param of trackParams) {
            if (url.searchParams.has(param)) {
              url.searchParams.delete(param);
              mod = 1;
            }
          }
          
          if (mod) a.href = url.origin + url.pathname + url.search;
          mark(a, 'data-wp-cl');
        } catch (e) {
          // Ignore URL parsing errors
        }
      }
      idx = end;
      if (idx < links.length) idle(processBatch);
    };
    
    processBatch();
  }, 500);
  
  throttledClean();
}

// ============================================================================
// OPTIMIZED: BYPASS RESTRICTIONS
// ============================================================================

function applyBypass() {
  if (!cfg.bypass) return;
  
  if (cfg.rightClick) {
    window.addEventListener('contextmenu', e => e.stopImmediatePropagation(), { capture: true });
  }
  
  if (cfg.copy) {
    ['copy', 'paste', 'cut'].forEach(ev => {
      document.addEventListener(ev, e => {
        const t = e.target;
        if (['INPUT', 'TEXTAREA', 'DIV'].includes(t.tagName) && t.isContentEditable) {
          e.stopImmediatePropagation();
        }
      }, { capture: true });
    });
  }
  
  if (cfg.select && !document.getElementById('wp-style')) {
    const s = document.createElement('style');
    s.id = 'wp-style';
    s.textContent = '*{user-select:text!important}::selection{background:#b3d4fc;color:#000}';
    document.head.appendChild(s);
  }
}

// ============================================================================
// OPTIMIZED: COOKIE ACCEPTANCE
// ============================================================================

// OPTIMIZED: More efficient cookie acceptance with throttling
function acceptCookies() {
  if (!cfg.cookie) return;
  
  const throttledAccept = throttle(() => {
    document.querySelectorAll('button, input[type=button]').forEach(b => {
      const t = (b.innerText || b.value || '').toLowerCase();
      if (/accept|agree|allow/i.test(t)) b.click();
    });
  }, 1000);
  
  throttledAccept();
}

// ============================================================================
// OPTIMIZED: GPU ACCELERATION
// ============================================================================

// OPTIMIZED: More targeted GPU acceleration for better performance
function forceGPU() {
  if (!cfg.gpu) return;
  
  // OPTIMIZED: More specific selectors for better performance
  const selectors = 'video, canvas, img[loading="eager"], div[role="img"]:not([data-wp-gpu]), .ytd-thumbnail:not([data-wp-gpu]), .video-preview:not([data-wp-gpu])';
  
  document.querySelectorAll(selectors).forEach(el => {
    if (marked(el, 'data-wp-gpu')) return;
    
    // OPTIMIZED: Use transform3d for better GPU acceleration
    el.style.transform = 'translate3d(0,0,0)';
    el.style.willChange = 'transform';
    el.style.backfaceVisibility = 'hidden';
    mark(el, 'data-wp-gpu');
  });
}

// ============================================================================
// OPTIMIZED: MEMORY OPTIMIZATION
// ============================================================================

function optimizeMem() {
  if (!cfg.mem) return;
  
  if (window.performance?.memory) {
    // OPTIMIZED: More conservative memory limit
    performance.memory.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit * 0.90;
  }
  
  // OPTIMIZED: Only call gc if available
  if (window.gc) window.gc();
  L('mem optimized');
}

// ============================================================================
// OPTIMIZED: PRELOAD RESOURCES
// ============================================================================

function preloadRes() {
  if (!cfg.preload) return;
  
  // OPTIMIZED: More efficient resource preloading
  const resources = document.querySelectorAll('img:not([data-wp-pre]), video:not([data-wp-pre]), audio:not([data-wp-pre])');
  for (const r of resources) {
    const u = r.src || r.href;
    if (u) {
      const img = new Image();
      img.src = u;
    }
    mark(r, 'data-wp-pre');
  }
}

// ============================================================================
// OPTIMIZED: LAZY LOADING
// ============================================================================

const loaded = new WeakSet();

function lazyIframes() {
  if (!cfg.iframes) return;
  
  // OPTIMIZED: More efficient iframe lazy loading
  document.querySelectorAll('iframe:not([data-wp])').forEach(i => {
    const s = i.getAttribute('src');
    const sd = i.getAttribute('srcdoc');
    if (!s || !isHttp(s) || sd !== null) return;
    
    i.setAttribute('loading', 'lazy');
    i.setAttribute('fetchpriority', 'low');  // Added fetchpriority for better performance
    mark(i);
  });
}

function lazyImages() {
  if (!cfg.lazy) return;
  
  // OPTIMIZED: More efficient image lazy loading
  document.querySelectorAll('img:not([data-wp])').forEach(i => {
    const ld = i.getAttribute('loading');
    if (ld === 'eager') return;
    if (!ld) i.setAttribute('loading', 'lazy');
    mark(i);
  });
}

// OPTIMIZED: More efficient video lazy loading
function lazyVideos() {
  if (!cfg.videos) return;
  
  if ("IntersectionObserver" in window) {
    const throttledObserver = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const v = e.target;
          if (!loaded.has(v)) {
            const sources = v.querySelectorAll("source[data-src]");
            for (const s of sources) {
              if (s.dataset.src) {
                s.src = s.dataset.src;
                delete s.dataset.src;
              }
            }
            if (v.dataset.src) {
              v.src = v.dataset.src;
              delete v.dataset.src;
            }
            v.load();
            loaded.add(v);
          }
          throttledObserver.unobserve(v);
        }
      });
    }, { rootMargin: '300px' });  // Increased margin for better preloading
    
    document.querySelectorAll('video[data-src], video:has(source[data-src])').forEach(v => {
      throttledObserver.observe(v);
    });
  }
}

function optimizeVids() {
  if (!cfg.videos) return;
  
  // OPTIMIZED: More efficient video optimization
  document.querySelectorAll('video:not([data-wp])').forEach(v => {
    const ap = v.hasAttribute('autoplay');
    const mu = v.hasAttribute('muted');
    const ct = v.hasAttribute('controls');
    
    if (!ap) {
      v.setAttribute('preload', 'metadata');
      if (!mu) v.setAttribute('muted', '');
      if (!ct) v.setAttribute('controls', '');
    }
    mark(v);
  });
}

// ============================================================================
// OPTIMIZED: SCRIPT DEFERRAL
// ============================================================================

// OPTIMIZED: More efficient script blocking patterns
const scriptDeny = /ads?|analytics|tracking|doubleclick|googletag|gtag|google-analytics|adsbygoogle|consent|pixel|facebook|scorecardresearch|matomo|tealium|pardot|hubspot|hotjar|intercom|criteo|quantcast|taboola|outbrain|addthis|sharethis|google_tag_manager/i;

function deferScripts() {
  if (!cfg.defer) return;
  
  // OPTIMIZED: More efficient script deferral
  document.querySelectorAll('script[src]:not([data-wp-s])').forEach(s => {
    const src = s.getAttribute('src') || '';
    const type = s.getAttribute('type') || '';
    
    if (scriptDeny.test(src) || type === 'application/ld+json') {
      s.setAttribute('type', 'text/wp-blocked');
      s.setAttribute('data-wp-src', src);
      s.removeAttribute('src');
      L('blocked:', src);
    }
    mark(s, 'data-wp-s');
  });
}

// OPTIMIZED: More efficient script restoration
function restoreScripts() {
  document.querySelectorAll('script[type="text/wp-blocked"][data-wp-src]').forEach(s => {
    const src = s.getAttribute('data-wp-src');
    if (!src) return;

    // Only allow http(s) URLs and same-origin relative URLs
    if (!isSafeScriptSrc(src)) return;

    const n = document.createElement('script');
    n.src = src;
    n.async = true;
    n.setAttribute('data-restored', '1');  // Mark as restored
    s.parentNode.replaceChild(n, s);
    L('restored:', src);
  });
}

// Helper to validate script src URLs: Only allow http(s) and same-origin relative paths
function isSafeScriptSrc(src) {
  try {
    const url = new URL(src, document.baseURI);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      // Optionally require same-origin, or allow all http(s). For stricter: add origin check here.
      return true;
    }
    // If it's a relative URL, it will resolve to the current origin and be http(s)
    return false;
  } catch (e) {
    // Invalid URL
    return false;
  }
}

// OPTIMIZED: More efficient interaction binding
const userEvents = ['click', 'keydown', 'touchstart', 'pointerdown'];
let interactionBound = 0;

function bindRestore() {
  if (interactionBound) return;
  
  const cb = () => {
    idle(() => restoreScripts(), 500);  // Increased delay for better performance
    userEvents.forEach(e => window.removeEventListener(e, cb, { passive: true }));
    interactionBound = 0;
    L('scripts restored');
  };
  
  userEvents.forEach(e => window.addEventListener(e, cb, { passive: true, once: true }));
  interactionBound = 1;
}

// ============================================================================
// OPTIMIZED: RESOURCE HINTS
// ============================================================================

function addHint(rel, href, as, cors) {
  if (!href || !isHttp(href)) return;
  
  // OPTIMIZED: Prevent duplicate hints
  if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
  
  const lnk = document.createElement('link');
  lnk.rel = rel;
  lnk.href = href;
  if (as) lnk.as = as;
  if (cors) lnk.crossOrigin = 'anonymous';
  lnk.setAttribute('data-wp-hint', '1');  // Mark as optimization hint
  document.head.appendChild(lnk);
}

const origins = new Set();

function extractOrigins() {
  if (!cfg.preconnect) return;
  
  // OPTIMIZED: More efficient origin extraction
  const elements = document.querySelectorAll('img[src], script[src], link[href], iframe[src], video[src], source[src]');
  for (const e of elements) {
    const u = e.src || e.href;
    if (!u || !isHttp(u)) continue;
    try {
      const url = new URL(u);
      if (url.origin !== location.origin) origins.add(url.origin);
    } catch (ex) {
      // Ignore URL parsing errors
    }
  }
  
  for (const o of origins) {
    addHint('preconnect', o);
  }
}

function preloadCritical() {
  if (!cfg.preconnect) return;
  
  // OPTIMIZED: Preload critical resources more efficiently
  const criticalSelectors = 'link[rel="stylesheet"], link[rel="preload"], img[loading="eager"]';
  document.querySelectorAll(criticalSelectors).forEach(el => {
    if (el.href) addHint('preload', el.href, 'style');
    else if (el.src) addHint('preload', el.src, 'image');
  });
}

// ============================================================================
// OPTIMIZED: MAIN EXECUTION WITH PERFORMANCE IMPROVEMENTS
// ============================================================================

// OPTIMIZED: Use throttled execution for better performance
const throttledExec = throttle(() => {
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
}, 300);

// OPTIMIZED: Execute at different stages for better performance
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', throttledExec);
} else {
  setTimeout(throttledExec, 100);  // Small delay to allow initial render
}

// OPTIMIZED: Bind script restoration to user interaction
if (cfg.defer) bindRestore();

// OPTIMIZED: Add throttled mutation observer for dynamic content
if (cfg.observe) {
  const throttledMutation = throttle(() => {
    cleanLinks();
    lazyIframes();
    lazyImages();
    lazyVideos();
    optimizeVids();
    deferScripts();
  }, 500);
  
  const obs = new MutationObserver(() => throttledMutation());
  obs.observe(document.documentElement, { childList: true, subtree: true });
}

// OPTIMIZED: Add throttled visibility change handler
if (cfg.mem) {
  document.addEventListener('visibilitychange', throttle(() => {
    if (document.visibilityState === 'hidden') optimizeMem();
  }, 5000));
}

L('Web Pro Enhanced (Optimized) loaded');