// ==UserScript==
// @name         Web Performance Optimizer
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Intelligent web performance optimization: Smart CPU/timer management, selective GPU acceleration, resource caching, request blocking, lazy loading - without breaking accessibility or console logging
// @author       Consolidated from 3 web optimization scripts
// @match        *://*/*
// @exclude      /^https?://\S+\.(txt|png|jpg|jpeg|gif|xml|svg|manifest|log|ini)[^\/]*$/
// @run-at       document-start
// @grant        none
// @inject-into  auto
// @allFrames    true
// @license      MIT
// @noframes
// @downloadURL  https://update.greasyfork.org/scripts/[ID]/Web%20Performance%20Optimizer.user.js
// @updateURL    https://update.greasyfork.org/scripts/[ID]/Web%20Performance%20Optimizer.meta.js
// ==/UserScript==

/*
CONSOLIDATED FEATURES:

1. Smart CPU Tamer - Reduces browser energy impact via async scheduling delay (from Web_CPU_Tamer)
2. Selective GPU Acceleration - Applies transforms only to high-change elements (refactored from Absolute_Performance)
3. Resource Optimization - Fetch caching, request blocking, lazy loading (from Universal_Website_Optimizer)
4. DOM Cleanup - Removes trackers while preserving accessibility (refactored from Universal_Website_Optimizer)

IMPROVEMENTS OVER ORIGINALS:
- NO global console.log disabling (preserves debugging)
- NO aggressive GPU transforms on ALL elements (selective targeting)
- NO annoying alert() popups on errors
- PRESERVES accessibility attributes (aria-*, alt, etc.)
- SELECTIVE meta tag removal (only trackers, keeps SEO)
*/

(function () {
  "use strict";

  // Emergency disable
  if (localStorage.getItem("disable_web_perf_optimizer") === "1") {
    console.warn("[Web Performance Optimizer]: Disabled by user");
    return;
  }

  // ═══════════════════════════════════════════════════════════
  // MODULE 1: SMART CPU TAMER (Web_CPU_Tamer implementation)
  // ═══════════════════════════════════════════════════════════

  ((o) => {
    const [setTimeout_, setInterval_, requestAnimationFrame_, clearTimeout_, clearInterval_, cancelAnimationFrame_] = o;
    const queueMicrotask_ = queueMicrotask;
    const win =
      typeof window.wrappedJSObject === "object"
        ? window.wrappedJSObject
        : typeof unsafeWindow === "object"
          ? unsafeWindow
          : this instanceof Window
            ? this
            : window;

    // Duplicate detection
    const hkey_script = "web_perf_optimizer_cpu_tamer";
    if (win[hkey_script]) return; // Avoid duplicated scripting
    win[hkey_script] = true;

    const Promise = (async () => {})().constructor;

    let resolvePr = () => {},
      pr;
    const setPr = () =>
      (pr = new Promise((resolve) => {
        resolvePr = resolve;
      }));

    setPr();

    const cme = document.createComment("--WebPerfOptimizer--");
    let cmi = 0;
    let lastPr = null;

    function act() {
      if (lastPr !== pr) {
        lastPr = pr;
        cmi = (cmi & 7) + 1;
        cme.data = cmi & 1 ? "++WebPerfOptimizer++" : "--WebPerfOptimizer--";
      }
    }

    class PseudoTimeline {
      constructor() {
        this.startTime = performance.timeOrigin || performance.now();
      }
      get currentTime() {
        return performance.now() - this.startTime;
      }
    }

    let tl;
    if (typeof DocumentTimeline === "function") {
      tl = new DocumentTimeline();
    } else if (typeof Animation === "function") {
      let AnimationConstructor = Animation,
        e = document.documentElement;
      try {
        if (e) {
          e = e.animate(null);
          if (typeof (e || 0) === "object" && "_animation" in e && e.constructor === Object) {
            e = e._animation;
          }
          if (typeof (e || 0) === "object" && "timeline" in e && typeof e.constructor === "function") {
            AnimationConstructor = e.constructor;
          }
        }
        const ant = new AnimationConstructor();
        tl = ant.timeline;
      } catch (err) {
        // ignored
      }
    }
    if (!tl || !Number.isFinite(tl.currentTime || null)) tl = new PseudoTimeline();
    const tl_ = tl;

    const mo = new MutationObserver(() => {
      resolvePr();
      setPr();
    });
    mo.observe(cme, { characterData: true });

    const tz = new Set();
    const az = new Set();

    const h1 = async (r) => {
      tz.add(r);
      if (lastPr !== pr) queueMicrotask_(act);
      await pr;
      if (lastPr !== pr) queueMicrotask_(act);
      await pr;
      return tz.delete(r);
    };

    const h2 = async (r, upr) => {
      az.add(r);
      await upr;
      return az.delete(r);
    };

    const errCatch = (e) => {
      queueMicrotask_(() => {
        throw e;
      });
    };

    const dOffset = 2 ** -26; // Avoid Brave/uBlock adjustSetTimeout

    setTimeout = function (f, d = void 0, ...args) {
      let r;
      const g =
        typeof f === "function"
          ? (...args) => {
            h1(r)
              .then((act) => {
                act && f(...args);
              })
              .catch(errCatch);
          }
          : f;
      if (d >= 1) d -= dOffset;
      r = setTimeout_(g, d, ...args);
      return r;
    };

    setInterval = function (f, d = void 0, ...args) {
      let r;
      const g =
        typeof f === "function"
          ? (...args) => {
            h1(r)
              .then((act) => {
                act && f(...args);
              })
              .catch(errCatch);
          }
          : f;
      if (d >= 1) d -= dOffset;
      r = setInterval_(g, d, ...args);
      return r;
    };

    clearTimeout = function (cid) {
      tz.delete(cid);
      return clearTimeout_(cid);
    };

    clearInterval = function (cid) {
      tz.delete(cid);
      return clearInterval_(cid);
    };

    requestAnimationFrame = function (f) {
      let r;
      const upr = pr;
      const g = (timeRes) => {
        const q1 = tl_.currentTime;
        h2(r, upr)
          .then((act) => {
            act && f(timeRes + (tl_.currentTime - q1));
          })
          .catch(errCatch);
      };
      if (lastPr !== pr) queueMicrotask_(act);
      r = requestAnimationFrame_(g);
      return r;
    };

    cancelAnimationFrame = function (aid) {
      az.delete(aid);
      return cancelAnimationFrame_(aid);
    };

    // Export for content scripts
    const isContentScript =
      (typeof window.wrappedJSObject === "object" &&
        typeof unsafeWindow === "object" &&
        typeof exportFunction === "function") ||
      (typeof GM === "object" && ((GM || 0).info || 0).injectInto === "content");
    if (isContentScript) {
      const exportFn = (f, name) => {
        typeof exportFunction === "function"
          ? exportFunction(f, win, { defineAs: name, allowCrossOriginArguments: true })
          : (win[name] = f);
      };
      exportFn(setTimeout, "setTimeout");
      exportFn(setInterval, "setInterval");
      exportFn(requestAnimationFrame, "requestAnimationFrame");
      exportFn(clearTimeout, "clearTimeout");
      exportFn(clearInterval, "clearInterval");
      exportFn(cancelAnimationFrame, "cancelAnimationFrame");
    }
  })([setTimeout, setInterval, requestAnimationFrame, clearTimeout, clearInterval, cancelAnimationFrame]);

  // ═══════════════════════════════════════════════════════════
  // MODULE 2: SELECTIVE GPU ACCELERATION
  // ═══════════════════════════════════════════════════════════

  const GPUModule = {
    // Only apply GPU acceleration to elements that actually benefit
    highChangeSelectors: ["video", "canvas", "[data-gpu-accelerate]", ".animation-container", ".slider", ".carousel"],

    apply() {
      try {
        const elements = document.querySelectorAll(this.highChangeSelectors.join(","));
        for (const el of elements) {
          el.style.transform = "translateZ(0)";
          el.style.willChange = "transform";
          el.style.backfaceVisibility = "hidden";
        }
        if (elements.length > 0) {
          console.log(`[Web Perf] GPU acceleration applied to ${elements.length} elements`);
        }
      } catch (e) {
        console.error("[Web Perf] GPU acceleration error:", e);
      }
    },

    observe() {
      const observer = new MutationObserver(() => {
        this.apply();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  };

  // ═══════════════════════════════════════════════════════════
  // MODULE 3: RESOURCE OPTIMIZATION
  // ═══════════════════════════════════════════════════════════

  const ResourceModule = {
    // Analytics and ad blocking
    blockList: [
      /google\.analytics\.com/,
      /analytics\.js/,
      /gtag\/js/,
      /doubleclick\.net/,
      /adsbygoogle\.js/,
      /googlesyndication\.com/,
      /googletagmanager\.com/
    ],

    // Fetch cache (48MB, 5min expiry)
    cache: new Map(),
    cacheSize: 0,
    MAX_CACHE_SIZE: 48 * 1024 * 1024,
    CACHE_EXPIRY: 5 * 60 * 1000,

    isCacheable(url) {
      return /\.(css|woff|woff2|ttf|eot|js|json)$/i.test(url);
    },

    cachedFetch(url) {
      const now = Date.now();

      if (this.cache.has(url)) {
        const { data, timestamp } = this.cache.get(url);
        if (now - timestamp < this.CACHE_EXPIRY) {
          this.cache.set(url, { data, timestamp: now });
          return Promise.resolve(data);
        } else {
          this.cache.delete(url);
          this.cacheSize -= data.length;
        }
      }

      return fetch(url).then((response) => {
        const contentLength = response.headers.get("Content-Length");
        if (contentLength && parseInt(contentLength) > 1048576) {
          return response.text();
        }

        return response.text().then((data) => {
          if (this.cacheSize + data.length <= this.MAX_CACHE_SIZE) {
            this.cache.set(url, { data, timestamp: now });
            this.cacheSize += data.length;
          }
          return data;
        });
      });
    },

    interceptRequests() {
      // XMLHttpRequest
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (method, url, ...args) {
        if (ResourceModule.blockList.some((regex) => regex.test(url))) {
          return;
        }
        originalOpen.call(this, method, url, ...args);
      };

      // Fetch API
      const originalFetch = window.fetch;
      window.fetch = function (input, init) {
        if (typeof input === "string" && ResourceModule.blockList.some((regex) => regex.test(input))) {
          return Promise.reject(new Error("Request blocked by Web Performance Optimizer"));
        }

        if (typeof input === "string" && ResourceModule.isCacheable(input)) {
          return ResourceModule.cachedFetch(input);
        }

        return originalFetch.call(this, input, init);
      };
    },

    lazyLoad() {
      const lazyLoadElements = (selector, attr = "src") => {
        const elements = document.querySelectorAll(selector);
        if ("loading" in HTMLImageElement.prototype) {
          elements.forEach((el) => {
            if (!el.hasAttribute("loading")) {
              el.setAttribute("loading", "lazy");
            }
            if (el.dataset.src) {
              el[attr] = el.dataset.src;
            }
          });
        } else {
          const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const el = entry.target;
                if (el.dataset.src) {
                  el[attr] = el.dataset.src;
                }
                observer.unobserve(el);
              }
            });
          });
          elements.forEach((el) => observer.observe(el));
        }
      };

      lazyLoadElements("img");
      lazyLoadElements("iframe", "src");
    },

    enableYouTubePrivacy() {
      document.querySelectorAll("iframe").forEach((iframe) => {
        if (iframe.src.includes("youtube.com/embed/")) {
          iframe.src = iframe.src.replace("youtube.com/embed/", "youtube-nocookie.com/embed/");
        }
      });
    }
  };

  // ═══════════════════════════════════════════════════════════
  // MODULE 4: DOM CLEANUP (REFINED - PRESERVES ACCESSIBILITY)
  // ═══════════════════════════════════════════════════════════

  const DOMCleanupModule = {
    // Only remove tracker-related meta tags
    trackerMetaTags: [
      "google-site-verification",
      "msvalidate.01",
      "yandex-verification",
      "apple-itunes-app",
      "juicyads-site-verification",
      "exoclick-site-verification",
      "trafficjunky-site-verification",
      "ero_verify",
      "linkbuxverifycode"
    ],

    // Remove tracker scripts
    trackerScripts: ["google-analytics", "googletagmanager", "adsbygoogle", "doubleclick.net"],

    cleanup() {
      // Remove tracker meta tags ONLY
      document.querySelectorAll("meta").forEach((meta) => {
        const name = meta.getAttribute("name");
        const property = meta.getAttribute("property");

        if (name && this.trackerMetaTags.some((tracker) => name.toLowerCase().includes(tracker))) {
          meta.remove();
        } else if (property && property.startsWith("fb:")) {
          meta.remove(); // Facebook trackers
        }
      });

      // Remove tracker scripts
      document.querySelectorAll("script").forEach((script) => {
        const src = script.getAttribute("src");
        if (src && this.trackerScripts.some((tracker) => src.includes(tracker))) {
          script.remove();
        }
      });

      // Remove noscript tags (usually contain tracking pixels)
      document.querySelectorAll("noscript").forEach((noscript) => noscript.remove());

      // Remove empty paragraphs
      document.querySelectorAll("p").forEach((p) => {
        if (p.innerHTML.trim() === "&nbsp;") p.remove();
      });
    }
  };

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════

  // Document-start optimizations
  ResourceModule.interceptRequests();

  // DOM-ready optimizations
  function init() {
    try {
      GPUModule.apply();
      GPUModule.observe();
      ResourceModule.lazyLoad();
      ResourceModule.enableYouTubePrivacy();
      DOMCleanupModule.cleanup();
      console.log("[Web Performance Optimizer] Initialized");
    } catch (e) {
      console.error("[Web Performance Optimizer] Init error:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
