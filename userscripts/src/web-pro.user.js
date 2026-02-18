// ==UserScript==
// @name         Web Pro (Compact)
// @author       Ven0m0
// @namespace    http://tampermonkey.net/
// @homepageURL  https://github.com/Ven0m0/Ven0m0-Adblock
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// ==/UserScript==
(() => {
  'use strict';
  const C = {
    KEY: "ven0m0.webpro.v4.optimized",
    CACHE: {
      MAX: 32 * 1024 * 1024,
      TTL: 180000,
      RX: /\.(css|woff2?|ttf|eot|js)$/i
    },
    TIME: {
      IDLE: 1500,
      FALLBACK: 300,
      MIN_TO: 15,
      MIN_IV: 20,
      THR_CLEAN: 500,
      THR_RUN: 300,
      THR_MUT: 500,
      THR_COOKIE: 1000,
      THR_MEM: 5000
    },
    SCRIPT_DENY:
      /ads?|analytics|tracking|doubleclick|googletag|gtag|google-analytics|adsbygoogle|consent|pixel|facebook|scorecardresearch|matomo|tealium|pardot|hubspot|hotjar|intercom|criteo|quantc/i,
    IO_MARGIN: "300px",
    BATCH: 30
  };
  const TRACK = [
    "fbclid",
    "gclid",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "utm_id",
    "mc_cid",
    "mc_eid",
    "_ga",
    "pk_campaign",
    "scid",
    "src",
    "ref",
    "aff",
    "affiliate",
    "campaign",
    "ad_id",
    "ad_name",
    "tracking",
    "partner",
    "promo",
    "promoid",
    "clickid",
    "irclickid",
    "spm",
    "smid",
    "pvid",
    "qid",
    "traffic_source",
    "sprefix",
    "rowan_id1",
    "rowan_msg_id"
  ];
  const HASH = ["intcid", "back-url", "back_url", "src"];
  const UE = ["click", "keydown", "touchstart", "pointerdown"];
  const DEF = {
    log: 0,
    lazy: 1,
    iframes: 1,
    videos: 1,
    defer: 1,
    observe: 1,
    prefetch: 1,
    preconnect: 1,
    linkPrefetch: 1,
    linkLimit: 10,
    linkDelay: 3000,
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
    minTimeout: C.TIME.MIN_TO,
    minInterval: C.TIME.MIN_IV,
    showUI: 1
  };
  const cfg = (() => {
    try {
      return { ...DEF, ...JSON.parse(localStorage.getItem(C.KEY) || "") };
    } catch {
      return { ...DEF };
    }
  })();
  const state = {
    cache: new Map(),
    cacheSize: 0,
    loaded: new WeakSet(),
    deferredScripts: new Map(),
    origins: new Set(),
    interactionBound: 0,
    videoObserver: null
  };
  const idle = (fn, to = C.TIME.IDLE) =>
    "requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: to }) : setTimeout(fn, C.TIME.FALLBACK);
  const mark = (el, a = "data-wp") => el?.setAttribute(a, "1");
  const throttle = (fn, ms) => {
    let l = 0;
    return (...a) => {
      const n = Date.now();
      if (n - l >= ms) {
        l = n;
        fn(...a);
      }
    };
  };
  const log = (...a) => cfg.log && console.debug("[WebPro]", ...a);
  if (cfg.cpuTamer || cfg.rafTamer) {
    const AsyncFn = (async () => {}).constructor;
    const [nTO, nSI, nRAF, nCTO, nCI, nCAF] = [
      setTimeout,
      setInterval,
      requestAnimationFrame,
      clearTimeout,
      clearInterval,
      cancelAnimationFrame
    ];
    const micro = queueMicrotask;
    let res = () => {};
    let p;
    const newP = () => (p = new AsyncFn((r) => (res = r)));
    newP();
    const marker = document.createComment("--CPUTamer--");
    let last = null;
    const trig = () => {
      if (last !== p) {
        last = p;
        marker.data = marker.data === "++" ? "--" : "++";
      }
    };
    new MutationObserver(() => {
      res();
      newP();
    }).observe(marker, { characterData: true });
    const toSet = new Set();
    const rafSet = new Set();
    const awaitTO = async (id) => {
      toSet.add(id);
      if (last !== p) micro(trig);
      await p;
      if (last !== p) micro(trig);
      await p;
      toSet.delete(id);
      return 1;
    };
    const awaitRAF = async (id, q) => {
      rafSet.add(id);
      await q;
      rafSet.delete(id);
      return 1;
    };
    const throwE = (e) =>
      micro(() => {
        throw e;
      });
    if (cfg.cpuTamer) {
      window.setTimeout = (fn, d = 0, ...a) => {
        // eslint-disable-next-line prefer-const
        let id;
        const w =
          typeof fn === "function"
            ? (...x) =>
                awaitTO(id)
                  .then((v) => v && fn(...x))
                  .catch(throwE)
            : fn;
        d = Math.max(d, cfg.minTimeout);
        id = nTO(w, d, ...a);
        return id;
      };
      window.setInterval = (fn, d = 0, ...a) => {
        // eslint-disable-next-line prefer-const
        let id;
        const w =
          typeof fn === "function"
            ? (...x) =>
                awaitTO(id)
                  .then((v) => v && fn(...x))
                  .catch(throwE)
            : fn;
        d = Math.max(d, cfg.minInterval);
        id = nSI(w, d, ...a);
        return id;
      };
      window.clearTimeout = (id) => {
        toSet.delete(id);
        return nCTO(id);
      };
      window.clearInterval = (id) => {
        toSet.delete(id);
        return nCI(id);
      };
      log("CPU tamer enabled");
    }
    if (cfg.rafTamer) {
      class T {
        constructor() {
          this.start = performance.timeOrigin || performance.now();
        }
        get currentTime() {
          return performance.now() - this.start;
        }
      }
      let tl;
      if (typeof DocumentTimeline === "function") tl = new DocumentTimeline();
      else if (typeof Animation === "function") {
        const a = document.documentElement?.animate?.(null);
        tl = a?.timeline || new T();
      } else tl = new T();
      window.requestAnimationFrame = (fn) => {
        // eslint-disable-next-line prefer-const
        let id;
        const q = p;
        const w = (ts) => {
          const s = tl.currentTime;
          awaitRAF(id, q)
            .then((v) => v && fn(ts + (tl.currentTime - s)))
            .catch(throwE);
        };
        if (last !== p) micro(trig);
        id = nRAF(w);
        return id;
      };
      window.cancelAnimationFrame = (id) => {
        rafSet.delete(id);
        return nCAF(id);
      };
      log("RAF tamer enabled");
    }
  }
  if (!cfg.log) {
    console.log = console.warn = console.error = () => {};
  }
  if (cfg.tabSave) {
    document.addEventListener("visibilitychange", () => {
      document.documentElement.style.cssText = document.visibilityState === "hidden" ? "display:none!important" : "";
    });
  }
  if (cfg.caching) {
    const rx = (u) => C.CACHE.RX.test(u);
    const get = (u) => {
      const e = state.cache.get(u);
      if (!e) return null;
      const { data, ts } = e;
      if (Date.now() - ts < C.CACHE.TTL) {
        state.cache.set(u, { data, ts: Date.now() });
        return data;
      }
      state.cache.delete(u);
      state.cacheSize -= data.length;
      return null;
    };
    const set = (u, d) => {
      if (state.cacheSize + d.length <= C.CACHE.MAX) {
        state.cache.set(u, { data: d, ts: Date.now() });
        state.cacheSize += d.length;
      }
    };
    const of = window.fetch;
    window.fetch = function (u, ...a) {
      if (typeof u === "string" && rx(u)) {
        const c = get(u);
        if (c) return Promise.resolve(new Response(c));
        return of.call(this, u, ...a).then((r) => {
          if (!r.ok) return r;
          const s = Number.parseInt(r.headers.get("Content-Length") || "", 10);
          if (!Number.isNaN(s) && s > 512000) return r;
          return r
            .clone()
            .text()
            .then((t) => {
              set(u, t);
              return new Response(t, {
                status: r.status,
                statusText: r.statusText,
                headers: r.headers
              });
            })
            .catch(() => r);
        });
      }
      return of.call(this, u, ...a);
    };
  }
  const stripTracking = (url) => {
    let c = 0;
    if (url.href.includes("/ref=")) {
      url.href = url.href.replace("/ref=", "?ref=");
      c = 1;
    }
    for (const p of TRACK)
      if (url.searchParams.has(p)) {
        url.searchParams.delete(p);
        c = 1;
      }
    return c;
  };
  const extractASIN = () => {
    if (document.readyState === "loading") return "";
    const el = document.getElementById("ASIN") || document.querySelector("[name='ASIN.0']");
    return el?.value || "";
  };
  function canonicalAmazon(url) {
    if (!/\.amazon\./i.test(url.hostname)) return 0;
    const p = url.pathname;
    const asin =
      p.match(/\/dp\/([A-Z0-9]{8,16})/i)?.[1] ||
      p.match(/\/gp\/product\/([A-Z0-9]{8,16})/i)?.[1] ||
      p.match(/\/exec\/obidos\/ASIN\/([A-Z0-9]{8,16})/i)?.[1] ||
      p.match(/\/o\/ASIN\/([A-Z0-9]{8,16})/i)?.[1] ||
      url.searchParams.get("ASIN") ||
      url.searchParams.get("ASIN.0") ||
      extractASIN();
    if (!asin) return 0;
    const canon = `${url.origin}/dp/${asin.toUpperCase()}/`;
    if (url.href === canon) return 0;
    history.replaceState(null, "", canon);
    log("Amazon canonicalized");
    return 1;
  }
  function cleanURL() {
    if (!cfg.cleanURL) return;
    try {
      const url = new URL(location.href.replace("/ref=", "?ref="));
      if (canonicalAmazon(url)) return;
      let c = stripTracking(url);
      for (const h of HASH) if (url.hash.startsWith(`#${h}`)) c = 1;
      if (c) {
        history.replaceState(null, "", url.origin + url.pathname + url.search);
        log("URL cleaned");
      }
    } catch (e) {
      if (cfg.log) console.error("[WebPro] URL clean error:", e);
    }
  }
  const cleanLinks = (() => {
    if (!cfg.cleanURL) return () => {};
    let busy = 0;
    return throttle(() => {
      if (busy) return;
      busy = 1;
      const links = document.querySelectorAll("a[href]:not([data-wp-cl])");
      if (!links.length) {
        busy = 0;
        return;
      }
      const bs = C.BATCH;
      let i = 0;
      const step = () => {
        const end = Math.min(i + bs, links.length);
        for (; i < end; i++) {
          const a = links[i];
          mark(a, "data-wp-cl");
          try {
            const h = a.href;
            if (!h || h.startsWith("javascript:")) continue;
            const u = new URL(h);
            if (u.origin === location.origin) continue;
            if (stripTracking(u)) a.href = u.href;
          } catch (e) {
            cfg.log && console.error("[WebPro] Link clean error:", e);
          }
        }
        i = end;
        if (i < links.length) idle(step);
        else busy = 0;
      };
      step();
    }, C.TIME.THR_CLEAN);
  })();
  function applyBypass() {
    if (!cfg.bypass) return;
    if (cfg.rightClick) window.addEventListener("contextmenu", (e) => e.stopImmediatePropagation(), { capture: true });
    if (cfg.copy) {
      for (const ev of ["copy", "paste", "cut"]) {
        document.addEventListener(
          ev,
          (e) => {
            const t = e.target;
            if (["INPUT", "TEXTAREA", "DIV"].includes(t.tagName) && t.isContentEditable) e.stopImmediatePropagation();
          },
          { capture: true }
        );
      }
    }
    if (cfg.select && !document.getElementById("wp-style")) {
      const s = document.createElement("style");
      s.id = "wp-style";
      s.textContent = "*{user-select:text!important}::selection{background:#b3d4fc;color:#000}";
      document.head.appendChild(s);
    }
  }
  function acceptCookies() {
    if (!cfg.cookie) return;
    throttle(() => {
      document.querySelectorAll("button,input[type=button]").forEach((b) => {
        const t = (b.innerText || b.value || "").toLowerCase();
        if (/accept|agree|allow/.test(t)) b.click();
      });
    }, C.TIME.THR_COOKIE)();
  }
  const forceGPU = (() => {
    if (!cfg.gpu) return () => {};
    const css = "transform:translate3d(0,0,0);will-change:transform;backface-visibility:hidden";
    return () => {
      document
        .querySelectorAll('video:not([data-wp-gpu]),canvas:not([data-wp-gpu]),img[loading="eager"]:not([data-wp-gpu])')
        .forEach((el) => {
          el.style.cssText += `;${css}`;
          mark(el, "data-wp-gpu");
        });
    };
  })();
  function optimizeMem() {
    if (!cfg.mem) return;
    if (performance?.memory) performance.memory.jsHeapSizeLimit *= 0.9;
    if (window.gc) window.gc();
    log("Memory optimized");
  }
  function preloadRes() {
    if (!cfg.preload) return;
    document
      .querySelectorAll("img:not([data-wp-pre]),video:not([data-wp-pre]),audio:not([data-wp-pre])")
      .forEach((r) => {
        const u = r.src || r.href;
        if (u) {
          const i = new Image();
          i.src = u;
        }
        mark(r, "data-wp-pre");
      });
  }
  function lazyIframes() {
    if (!cfg.iframes) return;
    document.querySelectorAll("iframe:not([data-wp])").forEach((i) => {
      const s = i.getAttribute("src");
      const sd = i.getAttribute("srcdoc");
      if (!s || !/^https?:/i.test(s) || sd !== null) return;
      i.loading = "lazy";
      i.fetchpriority = "low";
      mark(i);
    });
  }
  function lazyImages() {
    if (!cfg.lazy) return;
    document.querySelectorAll("img:not([data-wp])").forEach((i) => {
      const ld = i.getAttribute("loading");
      if (ld === "eager") return;
      if (!ld) i.setAttribute("loading", "lazy");
      mark(i);
    });
  }
  function lazyVideos() {
    if (!cfg.videos || !("IntersectionObserver" in window)) return;
    const vids = document.querySelectorAll("video[data-src],video:has(source[data-src])");
    if (!vids.length) return;
    if (!state.videoObserver) {
      state.videoObserver = new IntersectionObserver(
        (es, obs) => {
          es.forEach((e) => {
            if (e.isIntersecting) {
              const v = e.target;
              if (!state.loaded.has(v)) {
                v.querySelectorAll("source[data-src]").forEach((s) => {
                  if (s.dataset.src) {
                    s.src = s.dataset.src;
                    delete s.dataset.src;
                  }
                });
                if (v.dataset.src) {
                  v.src = v.dataset.src;
                  delete v.dataset.src;
                }
                v.load();
                state.loaded.add(v);
              }
              obs.unobserve(v);
            }
          });
        },
        {
          rootMargin: C.IO_MARGIN
        }
      );
    }
    vids.forEach((v) => state.videoObserver.observe(v));
  }
  function optimizeVids() {
    if (!cfg.videos) return;
    document.querySelectorAll("video:not([data-wp])").forEach((v) => {
      const ap = v.hasAttribute("autoplay");
      const mu = v.hasAttribute("muted");
      const ct = v.hasAttribute("controls");
      if (!ap) {
        v.preload = "metadata";
        if (!mu) v.muted = true;
        if (!ct) v.controls = true;
      }
      mark(v);
    });
  }
  function deferScripts() {
    if (!cfg.defer) return;
    document.querySelectorAll("script[src]:not([data-wp-s])").forEach((s) => {
      const src = s.getAttribute("src") || "";
      const t = s.getAttribute("type") || "";
      if (C.SCRIPT_DENY.test(src) || t === "application/ld+json") {
        const id = Math.random().toString(36).slice(2) + Date.now();
        state.deferredScripts.set(id, src);
        s.type = "text/wp-blocked";
        s.setAttribute("data-wp-id", id);
        s.removeAttribute("src");
      }
      mark(s, "data-wp-s");
    });
  }
  function restoreScripts() {
    document.querySelectorAll('script[type="text/wp-blocked"][data-wp-id]').forEach((s) => {
      const id = s.getAttribute("data-wp-id");
      if (!id) return;
      const src = state.deferredScripts.get(id);
      if (!src) return;
      const danger =
        src.startsWith("javascript:") ||
        src.startsWith("data:") ||
        src.startsWith("vbscript:") ||
        src.startsWith("//") ||
        src.includes("<") ||
        src.includes(">") ||
        src.includes('"') ||
        src.includes("'");
      if (danger) {
        state.deferredScripts.delete(id);
        return;
      }
      const https = src.startsWith("https://");
      const root = src.startsWith("/") && !src.startsWith("//");
      if (!https && !root) {
        state.deferredScripts.delete(id);
        return;
      }
      if (https) {
        try {
          const u = new URL(src);
          if (u.protocol !== "https:") {
            state.deferredScripts.delete(id);
            return;
          }
        } catch {
          state.deferredScripts.delete(id);
          return;
        }
      }
      state.deferredScripts.delete(id);
      const n = document.createElement("script");
      n.src = src;
      n.async = 1;
      n.setAttribute("data-restored", "1");
      s.parentNode?.replaceChild(n, s);
    });
  }
  function bindRestore() {
    if (state.interactionBound) return;
    const cb = () => {
      idle(() => restoreScripts(), 500);
      UE.forEach((e) => window.removeEventListener(e, cb, { passive: true }));
      state.interactionBound = 0;
    };
    UE.forEach((e) => window.addEventListener(e, cb, { passive: true, once: true }));
    state.interactionBound = 1;
  }
  function addHint(rel, href, as, cors) {
    if (!href || !/^\s*https?:/i.test(href)) return;
    if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
    const l = document.createElement("link");
    l.rel = rel;
    l.href = href;
    if (as) l.as = as;
    if (cors) l.crossOrigin = "anonymous";
    l.setAttribute("data-wp-hint", "1");
    document.head.appendChild(l);
  }
  function extractOrigins() {
    if (!cfg.preconnect) return;
    document
      .querySelectorAll(
        "img[src]:not([data-wp-o]),script[src]:not([data-wp-o]),link[href]:not([data-wp-o]),iframe[src]:not([data-wp-o]),video[src]:not([data-wp-o]),source[src]:not([data-wp-o])"
      )
      .forEach((e) => {
        mark(e, "data-wp-o");
        const u = e.src || e.href;
        if (!u || !/^\s*https?:/i.test(u)) return;
        try {
          const url = new URL(u);
          if (url.origin !== location.origin && !state.origins.has(url.origin)) {
            state.origins.add(url.origin);
            addHint("preconnect", url.origin);
          }
        } catch (e) {
          cfg.log && console.error("[WebPro] Origin extract error:", e);
        }
      });
  }
  function preloadCritical() {
    if (!cfg.preconnect) return;
    document.querySelectorAll('link[rel="stylesheet"],link[rel="preload"],img[loading="eager"]').forEach((el) => {
      if (el.href) addHint("preload", el.href, "style");
      else if (el.src) addHint("preload", el.src, "image");
    });
  }
  const run = throttle(() => {
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
  }, C.TIME.THR_RUN);
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", run) : setTimeout(run, 100);
  if (cfg.defer) bindRestore();
  if (cfg.observe) {
    const mut = throttle(() => {
      cleanLinks();
      lazyIframes();
      lazyImages();
      lazyVideos();
      optimizeVids();
      deferScripts();
      extractOrigins();
    }, C.TIME.THR_MUT);
    new MutationObserver(() => mut()).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
  if (cfg.mem) {
    document.addEventListener(
      "visibilitychange",
      throttle(() => {
        if (document.visibilityState === "hidden") optimizeMem();
      }, C.TIME.THR_MEM)
    );
  }
  log("Web Pro Enhanced (Compact) v4+ loaded");
})();
