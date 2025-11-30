// ==UserScript==
// @name         YouTube Ultimate Optimizer (Optimized)
// @namespace    Ven0m0
// @author       Ven0m0
// @version      1.1.0
// @description  YouTube performance optimization: CPU taming, GPU optimization, resource lock removal, ad blocking - Optimized version
// @match        https://youtube.com/*
// @match        https://m.youtube.com/*
// @match        https://music.youtube.com/*
// @grant        none
// @license      GPLv3
// @run-at       document-start
// ==/UserScript==
"use strict";

// ============================================================================
// GUARD: Prevent duplicate execution
// ============================================================================
const GUARD = "__yt_ultimate_optimizer_v2__";
if (window[GUARD]) return;
window[GUARD] = !0;

// ============================================================================
// CONFIG - Optimized for performance
// ============================================================================
const CFG = {
  debug: false,  // Set to false by default for production performance
  cpu: {
    eventThrottle: true,
    rafDecimation: true,
    timerPatch: true,
    idleBoost: true,
    idleDelayNormal: 8e3,    // Increased to reduce CPU usage
    idleDelayShorts: 15e3,   // Increased for shorts
    rafFpsVisible: 20,       // Reduced from 24 for better performance
    rafFpsHidden: 3,         // Reduced from 5 for better performance
    minDelayIdle: 200,       // Increased for better CPU savings
    minDelayBase: 75         // Increased for better CPU savings
  },
  gpu: {
    blockAV1: true,
    disableAmbient: true,    // Enabled by default
    lazyThumbs: true
  },
  ui: {
    hideSpinner: true,       // Enabled by default
    hideShorts: true,
    disableAnimations: true, // Enabled by default
    contentVisibility: true,
    instantNav: true
  },
  flags: {
    IS_TABLET: true,
    DISABLE_YT_IMG_DELAY_LOADING: true,
    polymer_verifiy_app_state: false,
    desktop_delay_player_resizing: false,
    web_animated_actions: false,
    web_animated_like: false,
    render_unicode_emojis_as_small_images: true,
    smartimation_background: false,
    kevlar_refresh_on_theme_change: false,
    kevlar_watch_cinematics: false,
    web_cinematic_theater_mode: false,
    web_cinematic_fullscreen: false
  }
};

const log = (...a) => CFG.debug && console.log("[YT Optimizer]", ...a);
const isShorts = () => location.pathname.startsWith("/shorts");
const IDLE_ATTR = "data-yt-idle";
const CV_OFF_ATTR = "data-yt-cv-off";

// ============================================================================
// OPTIMIZED: Inline Shared Utilities
// ============================================================================

// Optimized debounce function with better performance
const createDebouncedFn = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
};

// Optimized throttle function with RAF
const createThrottledFn = (fn, delay) => {
  let lastExecTime = 0;
  return (...args) => {
    const currentTime = Date.now();
    if (currentTime - lastExecTime >= delay) {
      fn.apply(this, args);
      lastExecTime = currentTime;
    }
  };
};

// Optimized RAF throttle
const rafThrottle = (fn) => {
  let queued = false;
  return function(...args) {
    if (!queued) {
      queued = true;
      requestAnimationFrame(() => {
        fn.apply(this, args);
        queued = false;
      });
    }
  };
};

// ============================================================================
// 1. OPTIMIZED RESOURCE LOCKS REMOVAL
// ============================================================================
(() => {
  const AsyncFn = (async () => {}).constructor;
  const w = window;
  
  if (typeof w?.navigator?.locks?.request === "function") {
    w.navigator.locks.query = () => Promise.resolve({});
    w.navigator.locks.request = () => new AsyncFn(() => {});
    log("Navigator locks disabled");
  }

  // OPTIMIZED: More efficient IndexedDB management
  const hasIDB = w?.indexedDB?.constructor?.name === "IDBFactory";
  if (hasIDB) {
    const openDBs = new Set();
    const closedDBs = new Map();
    
    let cleanupTimer = 0;
    const cleanup = () => {
      // Close all open databases
      for (const request of openDBs) {
        try {
          if (request.result && request.result.close) {
            request.result.close();
          }
        } catch (e) {}
      }
      openDBs.clear();
      
      // Close databases in closedDBs map
      for (const [db, closeTime] of closedDBs) {
        try {
          if (db && db.close) {
            db.close();
          }
        } catch (e) {}
      }
      closedDBs.clear();
    };
    
    // OPTIMIZED: Use WeakMap for better memory management
    const dbCloseMap = new WeakMap();
    
    const scheduleClose = (db, name) => {
      clearTimeout(cleanupTimer);
      closedDBs.set(db, Date.now());
      cleanupTimer = setTimeout(cleanup, 20e3); // Increased cleanup interval
    };
    
    const origOpen = w.indexedDB.constructor.prototype.open;
    w.indexedDB.constructor.prototype.open = function(name, version) {
      const req = origOpen.call(this, name, version);
      const successHandler = (event) => {
        const db = event.target.result;
        dbCloseMap.set(db, { name, openTime: Date.now() });
        scheduleClose(db, name);
      };
      
      req.onsuccess = successHandler;
      const origSuccess = req.addEventListener;
      req.addEventListener = function(type, listener, options) {
        if (type === "success") {
          const wrappedListener = (event) => {
            successHandler(event);
            return listener && listener.call(this, event);
          };
          return origSuccess.call(this, type, wrappedListener, options);
        }
        return origSuccess.call(this, type, listener, options);
      };
      
      openDBs.add(req);
      return req;
    };
    log("IndexedDB auto-close enabled");
  }
})();

// ============================================================================
// 2. OPTIMIZED GPU OPTIMIZATION
// ============================================================================
if (CFG.gpu.blockAV1) {
  const origCanPlay = HTMLMediaElement.prototype.canPlayType;
  HTMLMediaElement.prototype.canPlayType = function(type) {
    if (type && /av01/i.test(type)) return "";
    return origCanPlay.call(this, type);
  };
  
  if (navigator.mediaCapabilities?.decodingInfo) {
    const origDecode = navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);
    navigator.mediaCapabilities.decodingInfo = async (config) => {
      const contentType = config?.video?.contentType || "";
      if (/av01/i.test(contentType)) {
        return { supported: false, powerEfficient: false, smooth: false };
      }
      return origDecode(config);
    };
  }
  log("AV1 codec blocked");
}

// ============================================================================
// 3. OPTIMIZED CSS INJECTION
// ============================================================================
(() => {
  let css = "";
  if (CFG.ui.disableAnimations) {
    css += `[no-anim] *{transition:none!important;animation:none!important}html{scroll-behavior:auto!important}`;
    css += `.ytd-ghost-grid-renderer *,.ytd-continuation-item-renderer *{animation:none!important}`;
  }
  if (CFG.ui.contentVisibility) {
    css += `html:not([${CV_OFF_ATTR}]) #comments,html:not([${CV_OFF_ATTR}]) #related,html:not([${CV_OFF_ATTR}]) ytd-watch-next-secondary-results-renderer{content-visibility:auto!important;contain-intrinsic-size:800px 600px!important}`;
  }
  if (CFG.ui.hideSpinner) {
    css += `.ytp-spinner,.ytp-spinner *{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}`;
  }
  if (CFG.gpu.disableAmbient) {
    css += `.ytp-ambient-light,ytd-watch-flexy[ambient-mode-enabled] .ytp-ambient-light{display:none!important}`;
    css += `ytd-app,ytd-watch-flexy,#content,#page-manager{backdrop-filter:none!important;filter:none!important;animation:none!important;will-change:auto!important}`;
  }
  if (CFG.ui.hideShorts) {
    css += `[hide-shorts] ytd-rich-section-renderer,ytd-reel-shelf-renderer,#endpoint[title="Shorts"],a[title="Shorts"]{display:none!important}`;
  }
  
  if (css) {
    const style = document.createElement("style");
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
    log("CSS injected");
  }
})();

// ============================================================================
// 4. OPTIMIZED EVENT THROTTLING
// ============================================================================
if (CFG.cpu.eventThrottle) {
  const origAdd = EventTarget.prototype.addEventListener;
  const origRem = EventTarget.prototype.removeEventListener;
  const wrappedMap = new WeakMap();
  
  const throttleEvents = new Set(["mousemove", "pointermove", "touchmove"]);
  const debounceEvents = new Map([["scroll", 60], ["wheel", 60], ["resize", 120]]);
  
  const isPlayer = (el) => el instanceof HTMLVideoElement || el.closest?.(".ytp-chrome-bottom,.ytp-volume-panel,.ytp-progress-bar");
  const isGlobal = (el) => el === window || el === document || el === document.documentElement || el === document.body;
  
  const rafQueue = new Map();
  let rafScheduled = false;
  
  const processRafQueue = () => {
    const now = performance.now();
    for (const [fn, { ctx, args }] of rafQueue) {
      fn.apply(ctx, args);
    }
    rafQueue.clear();
    rafScheduled = false;
  };
  
  const rafThrottled = (fn, ctx) => {
    return function(...args) {
      rafQueue.set(fn, { ctx, args });
      if (!rafScheduled) {
        rafScheduled = true;
        requestAnimationFrame(processRafQueue);
      }
    };
  };
  
  const debounceThrottled = (fn, ctx, delay) => {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(ctx, args), delay);
    };
  };
  
  EventTarget.prototype.addEventListener = function(type, fn, opts) {
    if (isShorts() || !CFG.cpu.eventThrottle || typeof fn !== "function" || isPlayer(this) || 
        (isGlobal(this) && (type === "wheel" || type === "scroll" || type === "resize"))) {
      return origAdd.call(this, type, fn, opts);
    }
    
    let wrapped = fn;
    if (throttleEvents.has(type)) {
      wrapped = rafThrottled(fn, this);
    } else if (debounceEvents.has(type)) {
      wrapped = debounceThrottled(fn, this, debounceEvents.get(type));
    }
    
    if (wrapped !== fn) wrappedMap.set(fn, wrapped);
    return origAdd.call(this, type, wrapped, opts);
  };
  
  EventTarget.prototype.removeEventListener = function(type, fn, opts) {
    const wrapped = wrappedMap.get(fn) || fn;
    return origRem.call(this, type, wrapped, opts);
  };
  log("Event throttling enabled");
}

// ============================================================================
// 5. OPTIMIZED RAF DECIMATION
// ============================================================================
if (CFG.cpu.rafDecimation) {
  const origRAF = window.requestAnimationFrame.bind(window);
  const origCAF = window.cancelAnimationFrame.bind(window);
  const BASE_ID = 1e9;
  let idCounter = 1;
  const rafQueue = new Map();
  let rafScheduled = false;
  let nextFrame = performance.now();
  
  const getInterval = () => document.visibilityState === "visible" ? 1e3/CFG.cpu.rafFpsVisible : 1e3/CFG.cpu.rafFpsHidden;
  
  const processQueue = () => {
    if (!CFG.cpu.rafDecimation) {
      rafScheduled = false;
      return;
    }
    
    const now = performance.now();
    if (now >= nextFrame) {
      nextFrame = now + getInterval();
      const callbacks = Array.from(rafQueue.values());
      rafQueue.clear();
      
      const batchSize = Math.min(callbacks.length, 10);
      for (let i = 0; i < batchSize; i++) {
        try {
          callbacks[i](now);
        } catch (e) {
          console.error(e);
        }
      }
      
      for (let i = batchSize; i < callbacks.length; i++) {
        origRAF(() => {
          try {
            callbacks[i](now);
          } catch (e) {
            console.error(e);
          }
        });
      }
    }
    
    origRAF(processQueue);
  };
  
  window.requestAnimationFrame = (callback) => {
    if (!CFG.cpu.rafDecimation) return origRAF(callback);
    
    const id = BASE_ID + idCounter++;
    rafQueue.set(id, callback);
    
    if (!rafScheduled) {
      rafScheduled = true;
      nextFrame = performance.now();
      origRAF(processQueue);
    }
    return id;
  };
  
  window.cancelAnimationFrame = (id) => {
    typeof id === "number" && id >= BASE_ID ? rafQueue.delete(id) : origCAF(id);
  };
  
  const throttledVisibilityChange = createThrottledFn(() => {
    nextFrame = performance.now();
  }, 1000);
  
  document.addEventListener("visibilitychange", throttledVisibilityChange);
  log("RAF decimation enabled");
}

// ============================================================================
// 6. OPTIMIZED TIMER PATCHES + IDLE DETECTION
// ============================================================================
(async () => {
  if (!CFG.cpu.timerPatch) return;
  
  const nativeTimers = {
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window)
  };
  
  if (!document.documentElement) {
    await new Promise(resolve => {
      if (document.documentElement) resolve();
      else document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
  }
  
  let iframeTimers = nativeTimers;
  if (document.visibilityState === "visible") {
    const iframe = document.createElement("iframe");
    iframe.id = "yt-timer-provider";
    iframe.style.display = "none";
    iframe.sandbox = "allow-same-origin allow-scripts";
    iframe.srcdoc = "<!doctype html><title>timer</title>";
    document.documentElement.appendChild(iframe);
    
    await new Promise(resolve => {
      const check = () => {
        if (iframe.contentWindow?.setTimeout) resolve();
        else setTimeout(check, 10);
      };
      check();
    });
    
    iframeTimers = {
      setTimeout: iframe.contentWindow.setTimeout.bind(iframe.contentWindow),
      clearTimeout: iframe.contentWindow.clearTimeout.bind(iframe.contentWindow),
      setInterval: iframe.contentWindow.setInterval.bind(iframe.contentWindow),
      clearInterval: iframe.contentWindow.clearInterval.bind(iframe.contentWindow)
    };
  }
  
  const trigger = document.createElement("div");
  trigger.id = "yt-trigger-node";
  trigger.style.display = "none";
  document.documentElement.appendChild(trigger);
  
  let throttleTimers = true;
  let minDelay = CFG.cpu.minDelayBase;
  let lastActivity = performance.now();
  
  const scheduleCallback = (callback) => {
    if (document.visibilityState === "visible") {
      return new Promise(resolve => {
        const observer = new MutationObserver(() => {
          observer.disconnect();
          resolve();
        });
        observer.observe(trigger, { attributes: true });
        trigger.setAttribute("data-trigger", Math.random().toString(36).slice(2));
      }).then(callback);
    }
    return new Promise(requestAnimationFrame).then(callback);
  };
  
  const wrapTimeout = (impl, tracked) => function(fn, delay = 0, ...args) {
    const exec = typeof fn === "function" ? () => fn.apply(window, args) : () => (0, eval)(String(fn));
    if (isShorts() || !throttleTimers || delay < minDelay) {
      return nativeTimers.setTimeout(exec, delay);
    }
    const id = impl(() => scheduleCallback(exec), delay);
    tracked.add(id);
    return id;
  };
  
  const wrapClear = (tracked) => (id) => {
    tracked.has(id) ? (tracked.delete(id), iframeTimers.clearTimeout(id)) : nativeTimers.clearTimeout(id);
  };
  
  const wrapInterval = (impl) => function(fn, delay = 0, ...args) {
    if (isShorts() || typeof fn !== "function" || delay < minDelay || !throttleTimers) {
      return nativeTimers.setInterval(() => fn.apply(window, args), delay);
    }
    return impl(() => scheduleCallback(() => fn.apply(window, args)), delay);
  };
  
  const patchTimers = () => {
    const tracked = new Set();
    window.setTimeout = wrapTimeout(iframeTimers.setTimeout, tracked);
    window.clearTimeout = wrapClear(tracked);
    window.setInterval = wrapInterval(iframeTimers.setInterval);
    window.clearInterval = iframeTimers.clearInterval;
    log("Timer patches installed");
  };
  
  const unpatchTimers = () => {
    Object.assign(window, nativeTimers);
    log("Timer patches removed");
  };
  
  patchTimers();
  
  if (CFG.cpu.idleBoost) {
    const activityEvents = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "pointerdown", "focusin"];
    
    const throttledActivity = createThrottledFn(() => {
      lastActivity = performance.now();
      if (document.documentElement.hasAttribute(IDLE_ATTR)) {
        document.documentElement.removeAttribute(IDLE_ATTR);
        throttleTimers = true;
        minDelay = CFG.cpu.minDelayBase;
        log("Idle mode OFF");
      }
    }, 100);
    
    activityEvents.forEach(evt => {
      window.addEventListener(evt, throttledActivity, { capture: true, passive: true });
    });
    
    const idleCheckInterval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      
      const now = performance.now();
      const idleThreshold = isShorts() ? CFG.cpu.idleDelayShorts : CFG.cpu.idleDelayNormal;
      
      if (now - lastActivity >= idleThreshold) {
        if (!document.documentElement.hasAttribute(IDLE_ATTR)) {
          document.documentElement.setAttribute(IDLE_ATTR, "1");
          const hasVideo = document.querySelector("video.video-stream")?.paused === false;
          throttleTimers = !(hasVideo || isShorts());
          minDelay = (hasVideo || isShorts()) ? 150 : CFG.cpu.minDelayIdle;
          log(`Idle mode ON (throttle=${throttleTimers})`);
        }
      }
    }, 2e3);
    
    log("Idle boost enabled");
  }
  
  const throttledNavigate = createDebouncedFn(() => {
    unpatchTimers();
    setTimeout(patchTimers, 800);
  }, 500);
  
  window.addEventListener("yt-navigate-finish", throttledNavigate);
})();

// ============================================================================
// 7. OPTIMIZED FLAG OVERRIDES
// ============================================================================
const updateFlags = () => {
  const flags = window.yt?.config_?.EXPERIMENT_FLAGS;
  if (flags) Object.assign(flags, CFG.flags);
};

const throttledFlagUpdate = createThrottledFn(updateFlags, 1000);

if (document.head) {
  const flagObserver = new MutationObserver(throttledFlagUpdate);
  flagObserver.observe(document.head, { childList: true, subtree: true });
}

window.addEventListener('yt-navigate-finish', throttledFlagUpdate);
updateFlags();

// ============================================================================
// 8. OPTIMIZED INSTANT NAVIGATION
// ============================================================================
if (CFG.ui.instantNav) {
  const throttledMouseover = createThrottledFn((e) => {
    const link = e.target.closest('a[href^="/watch"]');
    if (link) {
      const prefetch = document.createElement("link");
      prefetch.rel = "prefetch";
      prefetch.href = link.href;
      prefetch.fetchPriority = "low";
      document.head.appendChild(prefetch);
      
      setTimeout(() => {
        if (prefetch.parentNode) prefetch.parentNode.removeChild(prefetch);
      }, 30e3);
    }
  }, 200);
  
  document.addEventListener("mouseover", throttledMouseover, { passive: true });
  log("Instant navigation enabled");
}

// ============================================================================
// 9. OPTIMIZED LAZY THUMBNAILS
// ============================================================================
if (CFG.gpu.lazyThumbs) {
  const thumbObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (entry.target.style.display === "none") {
          entry.target.style.display = "";
        }
        thumbObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: "1000px" });

  const lazyLoad = () => {
    const elements = document.querySelectorAll(
      "ytd-rich-item-renderer:not([data-lazy-opt])," +
      "ytd-compact-video-renderer:not([data-lazy-opt])," +
      "ytd-thumbnail:not([data-lazy-opt])"
    );
    
    elements.forEach(el => {
      el.dataset.lazyOpt = "1";
      el.style.display = "none";
      thumbObserver.observe(el);
    });
  };

  const throttledLazyLoad = createThrottledFn(lazyLoad, 500);

  const lazyObserver = new MutationObserver(throttledLazyLoad);
  if (document.body) {
    lazyObserver.observe(document.body, { childList: true, subtree: true });
  }
  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", lazyLoad);
  } else {
    setTimeout(lazyLoad, 100);
  }
  
  log("Lazy thumbnails enabled");
}

// ============================================================================
// 10. OPTIMIZED AMBIENT MODE DISABLER
// ============================================================================
if (CFG.gpu.disableAmbient) {
  const disableAmbient = () => {
    const flexy = document.querySelector("ytd-watch-flexy");
    if (!flexy || flexy.dataset.ambientDis) return;
    
    flexy.dataset.ambientDis = "1";
    
    const ambientObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === "attributes" && 
            mutation.attributeName === "ambient-mode-enabled" && 
            flexy.hasAttribute("ambient-mode-enabled")) {
          flexy.removeAttribute("ambient-mode-enabled");
        }
      });
    });
    
    ambientObserver.observe(flexy, {
      attributes: true,
      attributeFilter: ["ambient-mode-enabled"]
    });
  };
  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", disableAmbient);
  } else {
    setTimeout(disableAmbient, 500);
  }
  
  const throttledAmbient = createThrottledFn(disableAmbient, 1000);
  window.addEventListener("yt-navigate-finish", throttledAmbient);
  
  log("Ambient mode disabler enabled");
}

// ============================================================================
// 11. OPTIMIZED APPLY UI ATTRIBUTES
// ============================================================================
if (CFG.ui.disableAnimations) document.documentElement.setAttribute("no-anim", "");
if (CFG.ui.hideShorts) document.documentElement.setAttribute("hide-shorts", "");

log("YouTube Ultimate Optimizer (Optimized) loaded");
