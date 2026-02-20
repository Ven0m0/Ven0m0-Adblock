// ==UserScript==
// @name         Web Pro
// @author       Ven0m0
// @namespace    https://violentmonkey.github.io/
// @homepageURL  https://github.com/Ven0m0/Ven0m0-Adblock
// @version      6.0.0
// @description  Universal web optimizer: lazy load, URL cleaning, CPU/RAF tamer, network, privacy, perf features.
// @match        *://*/*
// @exclude      /^https?://\S+\.(txt|png|jpg|jpeg|gif|xml|svg|manifest|log|ini)[^\/]*$/
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-start
// @allFrames    true
// @license      MIT
// ==/UserScript==
(() => {
  "use strict";

  const SITE_KEY = "webpro:disable:" + location.hostname;
  if (localStorage.getItem(SITE_KEY) === "1") return;

  const HKEY = "__webpro_v6__";
  const win = typeof unsafeWindow === "object" ? unsafeWindow : window;
  if (win[HKEY]) return;
  win[HKEY] = true;

  const conn = navigator.connection;
  const eff = conn?.effectiveType;
  const MODE = eff === "slow-2g" ? 2 : conn?.saveData || eff?.includes("2g") ? 1 : 0;

  // Config constants
  const C = {
    KEY: "ven0m0.webpro.v6",
    CACHE: { MAX: 48 * 1024 * 1024, TTL: 300000, RX: /\.(css|woff2?|ttf|eot|js|json)$/i },
    TIME: { IDLE: 1500, FALLBACK: 300, MIN_TO: 15, MIN_IV: 20, THR_CLEAN: 500, THR_RUN: 300, THR_MUT: 500, THR_COOKIE: 1000, THR_MEM: 5000 },
    SCRIPT_DENY: /ads?|analytics|tracking|doubleclick|googletag|gtag|google-analytics|adsbygoogle|consent|pixel|facebook|scorecardresearch|matomo|tealium|pardot|hubspot|hotjar|intercom|criteo|quantc|clarity|mixpanel|segment|fullstory|onesignal|beacon/i,
    TRACKER_HOSTS: new Set([
      "google-analytics.com", "googletagmanager.com", "doubleclick.net", "googlesyndication.com",
      "adservice.google.com", "connect.facebook.net", "clarity.ms", "hotjar.com",
      "sentry.io", "mixpanel.com", "segment.com", "fullstory.com", "onesignal.com",
    ]),
    TRACKER_SCRIPTS: ["google-analytics", "googletagmanager", "adsbygoogle", "doubleclick.net"],
    TRACKER_META: [
      "google-site-verification", "msvalidate.01", "yandex-verification", "apple-itunes-app",
      "juicyads-site-verification", "exoclick-site-verification", "trafficjunky-site-verification",
      "ero_verify", "linkbuxverifycode",
    ],
    ALLOW_KW: ["jquery", "bootstrap", "core", "essential", "react", "chunk", "runtime", "main", "cloudflare", "captcha"],
    IO_MARGIN: "300px", BATCH: 30,
    GPU_SEL: "video,canvas,[data-gpu-accelerate],.animation-container,.slider,.carousel",
  };

  const TRACK = [
    "fbclid", "gclid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id",
    "mc_cid", "mc_eid", "_ga", "pk_campaign", "scid", "src", "ref", "aff", "affiliate", "campaign",
    "ad_id", "ad_name", "tracking", "partner", "promo", "promoid", "clickid", "irclickid",
    "spm", "smid", "pvid", "qid", "traffic_source", "sprefix", "rowan_id1", "rowan_msg_id",
  ];
  const HASH = ["intcid", "back-url", "back_url", "src"];
  const UE = ["click", "keydown", "touchstart", "pointerdown"];

  const DEF = {
    log: 0, lazy: 1, iframes: 1, videos: 1, defer: 1, observe: 1, prefetch: 1, preconnect: 1,
    linkPrefetch: 1, linkLimit: 10, linkDelay: 3000, hoverPrefetch: 1, blockPrefetchLinks: 1,
    cleanURL: 1, blockBeacons: 1, fingerprintReduce: 0, gpu: 1, mem: 1, preload: 1,
    cpuTamer: 1, rafTamer: 1, throttleBG: 1, limitFPS: 0,
    minTimeout: C.TIME.MIN_TO, minInterval: C.TIME.MIN_IV, caching: 1,
    bypass: 1, rightClick: 0, copy: 1, select: 1,
    cookie: 1, tabSave: 1, xhrBlock: 1, ytPrivacy: 1, domCleanup: 1, captchaSpeed: 1,
    silenceConsole: 0, darkMode: 0, disableWebGL: 0, pauseGIFs: 0, siteToggle: 1, showUI: 1,
  };
  if (MODE >= 1) DEF.blockPrefetchLinks = 1;
  if (MODE >= 2) DEF.fingerprintReduce = 1;

  const cfg = (() => {
    try { return { ...DEF, ...JSON.parse(localStorage.getItem(C.KEY) || "") }; }
    catch { return { ...DEF }; }
  })();
  const saveCfg = () => localStorage.setItem(C.KEY, JSON.stringify(cfg));

  const state = {
    cache: new Map(), cacheSize: 0, loaded: new WeakSet(), deferredScripts: new Map(),
    origins: new Set(), interactionBound: 0, videoObserver: null, hoverPrefetched: new Set(),
  };

  // Helpers
  const idle = (fn, to = C.TIME.IDLE) =>
    "requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: to }) : setTimeout(fn, C.TIME.FALLBACK);
  const mark = (el, a = "data-wp") => el?.setAttribute(a, "1");
  const throttle = (fn, ms) => { let l = 0; return (...a) => { const n = Date.now(); if (n - l >= ms) { l = n; fn(...a); } }; };
  const log = (...a) => cfg.log && console.debug("[WebPro]", ...a);

  const pageHost = location.hostname;
  const mainDomain = pageHost.split(".").slice(-2).join(".");
  const isTrusted = (url) => {
    if (!url) return false;
    try { return new URL(url, location.origin).hostname.endsWith(mainDomain); } catch { return false; }
  };
  const isTracker = (url) => {
    if (!url || isTrusted(url)) return false;
    try {
      const h = new URL(url, location.origin).hostname;
      if ([...C.TRACKER_HOSTS].some((t) => h.endsWith(t))) return true;
      const lc = url.toLowerCase();
      return !C.ALLOW_KW.some((k) => lc.includes(k)) && C.SCRIPT_DENY.test(lc);
    } catch { return false; }
  };

  // Google Captcha speedup
  if (cfg.captchaSpeed && /\/recaptcha\/(api2|enterprise)\/bframe/.test(location.href)) {
    const origST = setTimeout;
    setTimeout = function (fn, dur) {
      if (dur === 4000 || dur === 50) dur = 0;
      return origST.apply(this, arguments);
    };
    document.head.appendChild(document.createElement("style")).textContent = "*{transition:none!important}";
  }

  // Fingerprint reduction
  if (cfg.fingerprintReduce) {
    const prop = (k, v) => Object.defineProperty(navigator, k, { get: () => v, configurable: true });
    prop("hardwareConcurrency", 2); prop("deviceMemory", 2); prop("plugins", []); prop("mimeTypes", []);
  }

  // Beacon blocking
  if (cfg.blockBeacons) {
    const orig = navigator.sendBeacon?.bind(navigator);
    if (orig) navigator.sendBeacon = (url, data) => isTracker(url) ? false : orig(url, data);
  }

  // WebGL block
  if (cfg.disableWebGL) {
    try {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...a) {
        return type === "webgl" || type === "webgl2" ? null : orig.call(this, type, ...a);
      };
    } catch {}
  }

  // CPU tamer / RAF tamer
  if (cfg.cpuTamer || cfg.rafTamer) {
    const AsyncFn = (async () => {}).constructor;
    const [nTO, nSI, nRAF, nCTO, nCI, nCAF] = [
      setTimeout, setInterval, requestAnimationFrame, clearTimeout, clearInterval, cancelAnimationFrame,
    ];
    const micro = queueMicrotask;
    let res = () => {}, p;
    const newP = () => (p = new AsyncFn((r) => (res = r)));
    newP();
    const marker = document.createComment("--CPUTamer--");
    let last = null;
    const trig = () => { if (last !== p) { last = p; marker.data = marker.data === "++" ? "--" : "++"; } };
    new MutationObserver(() => { res(); newP(); }).observe(marker, { characterData: true });

    const toSet = new Set(), rafSet = new Set();
    const awaitTO = async (id) => {
      toSet.add(id);
      if (last !== p) micro(trig); await p;
      if (last !== p) micro(trig); await p;
      toSet.delete(id); return 1;
    };
    const awaitRAF = async (id, q) => { rafSet.add(id); await q; rafSet.delete(id); return 1; };
    const throwE = (e) => micro(() => { throw e; });

    if (cfg.cpuTamer) {
      window.setTimeout = (fn, d = 0, ...a) => {
        let id;
        const w = typeof fn === "function"
          ? (...x) => awaitTO(id).then((v) => v && fn(...x)).catch(throwE) : fn;
        id = nTO(w, Math.max(d, cfg.minTimeout), ...a); return id;
      };
      window.setInterval = (fn, d = 0, ...a) => {
        let id;
        const w = typeof fn === "function"
          ? (...x) => awaitTO(id).then((v) => v && fn(...x)).catch(throwE) : fn;
        id = nSI(w, Math.max(d, cfg.minInterval), ...a); return id;
      };
      window.clearTimeout = (id) => { toSet.delete(id); return nCTO(id); };
      window.clearInterval = (id) => { toSet.delete(id); return nCI(id); };
    }

    if (cfg.rafTamer) {
      class T { constructor() { this.start = performance.timeOrigin || performance.now(); } get currentTime() { return performance.now() - this.start; } }
      let tl;
      if (typeof DocumentTimeline === "function") tl = new DocumentTimeline();
      else if (typeof Animation === "function") { tl = document.documentElement?.animate?.(null)?.timeline || new T(); }
      else tl = new T();
      const frameMs = cfg.limitFPS ? 1000 / 30 : 0;
      let lastFrame = 0;

      window.requestAnimationFrame = (fn) => {
        let id; const q = p;
        const w = (ts) => {
          if (frameMs) { const now = Date.now(); if (now - lastFrame < frameMs) { nCAF(id); return; } lastFrame = now; }
          const s = tl.currentTime;
          awaitRAF(id, q).then((v) => v && fn(ts + (tl.currentTime - s))).catch(throwE);
        };
        if (last !== p) micro(trig);
        id = nRAF(w); return id;
      };
      window.cancelAnimationFrame = (id) => { rafSet.delete(id); return nCAF(id); };
    } else if (cfg.limitFPS) {
      const nRAF2 = window.requestAnimationFrame.bind(window);
      const frameMs = 1000 / 30; let lastFrame = 0;
      window.requestAnimationFrame = (cb) => nRAF2((ts) => { const now = Date.now(); if (now - lastFrame >= frameMs) { lastFrame = now; cb(ts); } });
    }
  } else if (cfg.limitFPS) {
    const nRAF = window.requestAnimationFrame.bind(window);
    const frameMs = 1000 / 30; let lastFrame = 0;
    window.requestAnimationFrame = (cb) => nRAF((ts) => { const now = Date.now(); if (now - lastFrame >= frameMs) { lastFrame = now; cb(ts); } });
  }

  // Background throttle
  if (cfg.throttleBG) {
    const nTO2 = window.setTimeout.bind(window), nSI2 = window.setInterval.bind(window);
    const active = { st: window.setTimeout, si: window.setInterval };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        window.setTimeout = (fn, ms, ...a) => nTO2(fn, Math.max(ms | 0, 2000), ...a);
        window.setInterval = (fn, ms, ...a) => nSI2(fn, Math.max(ms | 0, 2000), ...a);
      } else { window.setTimeout = active.st; window.setInterval = active.si; }
    });
  }

  // Console silencing
  if (cfg.silenceConsole) { const noop = () => {}; ["log", "warn", "error", "debug", "info"].forEach((m) => { console[m] = noop; }); }
  else if (!cfg.log) { console.log = console.warn = console.error = () => {}; }

  // Dark mode
  if (cfg.darkMode) GM_addStyle("html,body{background:#121212!important;color:#e0e0e0!important}:not(pre)>code,pre{background:#212121!important;color:#e0e0e0!important}img,video,canvas{filter:invert(1) hue-rotate(180deg)}");

  // Tab save
  if (cfg.tabSave) document.addEventListener("visibilitychange", () => { document.documentElement.style.cssText = document.visibilityState === "hidden" ? "display:none!important" : ""; });

  // XHR interception
  if (cfg.xhrBlock) {
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...args) {
      if (typeof url === "string" && isTracker(url)) return;
      return origOpen.call(this, method, url, ...args);
    };
  }

  // Fetch override: caching + tracker blocking
  {
    const rx = (u) => cfg.caching && C.CACHE.RX.test(u);
    const cGet = (u) => {
      const e = state.cache.get(u); if (!e) return null;
      if (Date.now() - e.ts < C.CACHE.TTL) { state.cache.set(u, { data: e.data, ts: Date.now() }); return e.data; }
      state.cache.delete(u); state.cacheSize -= e.data.length; return null;
    };
    const cSet = (u, d) => { if (state.cacheSize + d.length <= C.CACHE.MAX) { state.cache.set(u, { data: d, ts: Date.now() }); state.cacheSize += d.length; } };
    const origFetch = window.fetch;
    window.fetch = function (u, ...a) {
      if (typeof u === "string") {
        if (isTracker(u)) return new Promise(() => {});
        if (rx(u)) {
          const c = cGet(u);
          if (c) return Promise.resolve(new Response(c));
          return origFetch.call(this, u, ...a).then((r) => {
            if (!r.ok) return r;
            const s = Number.parseInt(r.headers.get("Content-Length") || "", 10);
            if (!Number.isNaN(s) && s > 1048576) return r;
            return r.clone().text().then((t) => { cSet(u, t); return new Response(t, { status: r.status, statusText: r.statusText, headers: r.headers }); }).catch(() => r);
          });
        }
      }
      return origFetch.call(this, u, ...a);
    };
  }

  // URL cleaning
  const stripTracking = (url) => {
    let c = 0;
    if (url.href.includes("/ref=")) { url.href = url.href.replace("/ref=", "?ref="); c = 1; }
    for (const p of TRACK) if (url.searchParams.has(p)) { url.searchParams.delete(p); c = 1; }
    return c;
  };

  const extractASIN = () => {
    if (document.readyState === "loading") return "";
    return (document.getElementById("ASIN") || document.querySelector("[name='ASIN.0']"))?.value || "";
  };

  function canonicalAmazon(url) {
    if (!/\.amazon\./i.test(url.hostname)) return 0;
    const p = url.pathname;
    const asin =
      p.match(/\/dp\/([A-Z0-9]{8,16})/i)?.[1] || p.match(/\/gp\/product\/([A-Z0-9]{8,16})/i)?.[1] ||
      p.match(/\/exec\/obidos\/ASIN\/([A-Z0-9]{8,16})/i)?.[1] || p.match(/\/o\/ASIN\/([A-Z0-9]{8,16})/i)?.[1] ||
      url.searchParams.get("ASIN") || url.searchParams.get("ASIN.0") || extractASIN();
    if (!asin) return 0;
    const canon = `${url.origin}/dp/${asin.toUpperCase()}/`;
    if (url.href === canon) return 0;
    history.replaceState(null, "", canon); return 1;
  }

  function cleanURL() {
    if (!cfg.cleanURL) return;
    try {
      const url = new URL(location.href.replace("/ref=", "?ref="));
      if (canonicalAmazon(url)) return;
      let c = stripTracking(url);
      for (const h of HASH) if (url.hash.startsWith(`#${h}`)) c = 1;
      if (c) history.replaceState(null, "", url.origin + url.pathname + url.search);
    } catch {}
  }

  const cleanLinks = (() => {
    if (!cfg.cleanURL) return () => {};
    let busy = 0;
    return throttle(() => {
      if (busy) return; busy = 1;
      const links = document.querySelectorAll("a[href]:not([data-wp-cl])");
      if (!links.length) { busy = 0; return; }
      let i = 0;
      const step = () => {
        const end = Math.min(i + C.BATCH, links.length);
        for (; i < end; i++) {
          const a = links[i]; mark(a, "data-wp-cl");
          try {
            const h = a.href;
            if (!h || h.startsWith("javascript:")) continue;
            const u = new URL(h);
            if (u.origin === location.origin) continue;
            if (stripTracking(u)) a.href = u.href;
          } catch {}
        }
        if (i < links.length) idle(step); else busy = 0;
      };
      step();
    }, C.TIME.THR_CLEAN);
  })();

  // Bypass (right-click, copy, select)
  function applyBypass() {
    if (!cfg.bypass) return;
    if (cfg.rightClick) window.addEventListener("contextmenu", (e) => e.stopImmediatePropagation(), { capture: true });
    if (cfg.copy) {
      for (const ev of ["copy", "paste", "cut"])
        document.addEventListener(ev, (e) => { const t = e.target; if (["INPUT", "TEXTAREA", "DIV"].includes(t.tagName) && t.isContentEditable) e.stopImmediatePropagation(); }, { capture: true });
    }
    if (cfg.select && !document.getElementById("wp-style")) {
      const s = document.createElement("style"); s.id = "wp-style";
      s.textContent = "*{user-select:text!important}::selection{background:#b3d4fc;color:#000}";
      document.head.appendChild(s);
    }
  }

  // Cookie auto-accept
  function acceptCookies() {
    if (!cfg.cookie) return;
    throttle(() => {
      document.querySelectorAll("button,input[type=button]").forEach((b) => {
        const t = (b.innerText || b.value || "").toLowerCase();
        if (/accept|agree|allow/.test(t)) b.click();
      });
    }, C.TIME.THR_COOKIE)();
  }

  // GPU compositing hints
  const forceGPU = (() => {
    if (!cfg.gpu) return () => {};
    const css = "transform:translate3d(0,0,0);will-change:transform;backface-visibility:hidden";
    return () => {
      document.querySelectorAll(`${C.GPU_SEL},img[loading="eager"]`).forEach((el) => {
        if (el.dataset.wpGpu) return;
        el.style.cssText += `;${css}`; el.dataset.wpGpu = "1";
      });
    };
  })();

  function optimizeMem() {
    if (!cfg.mem) return;
    if (performance?.memory) performance.memory.jsHeapSizeLimit *= 0.9;
    if (window.gc) window.gc();
  }

  function preloadRes() {
    if (!cfg.preload) return;
    document.querySelectorAll("img:not([data-wp-pre]),video:not([data-wp-pre]),audio:not([data-wp-pre])").forEach((r) => {
      const u = r.src || r.href; if (u) { const i = new Image(); i.src = u; }
      mark(r, "data-wp-pre");
    });
  }

  // Lazy loading
  function lazyImages() {
    if (!cfg.lazy) return;
    document.querySelectorAll("img:not([data-wp])").forEach((i) => {
      if (i.getAttribute("loading") === "eager") return;
      if (!i.getAttribute("loading")) i.setAttribute("loading", "lazy");
      if (i.dataset.src && !i.src) i.src = i.dataset.src;
      mark(i);
    });
  }

  function lazyIframes() {
    if (!cfg.iframes) return;
    document.querySelectorAll("iframe:not([data-wp])").forEach((i) => {
      const s = i.getAttribute("src");
      if (!s || !/^https?:/i.test(s) || i.getAttribute("srcdoc") !== null) return;
      i.loading = "lazy"; i.fetchpriority = "low"; mark(i);
    });
  }

  function lazyVideos() {
    if (!cfg.videos || !("IntersectionObserver" in window)) return;
    const vids = document.querySelectorAll("video[data-src],video:has(source[data-src])");
    if (!vids.length) return;
    if (!state.videoObserver) {
      state.videoObserver = new IntersectionObserver((es, obs) => {
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          const v = e.target;
          if (!state.loaded.has(v)) {
            v.querySelectorAll("source[data-src]").forEach((s) => { if (s.dataset.src) { s.src = s.dataset.src; delete s.dataset.src; } });
            if (v.dataset.src) { v.src = v.dataset.src; delete v.dataset.src; }
            v.load(); state.loaded.add(v);
          }
          obs.unobserve(v);
        });
      }, { rootMargin: C.IO_MARGIN });
    }
    vids.forEach((v) => state.videoObserver.observe(v));
  }

  function optimizeVids() {
    if (!cfg.videos) return;
    document.querySelectorAll("video:not([data-wp])").forEach((v) => {
      if (!v.hasAttribute("autoplay")) {
        v.preload = "metadata";
        if (!v.hasAttribute("muted")) v.muted = true;
        if (!v.hasAttribute("controls")) v.controls = true;
      }
      mark(v);
    });
  }

  // GIF pause
  function pauseGIFs() {
    if (!cfg.pauseGIFs) return;
    document.querySelectorAll("img[src$='.gif']").forEach((img) => {
      const snap = () => {
        if (!img.naturalWidth) return;
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.style.cssText = img.style.cssText; c.className = img.className;
        c.title = "Click to play GIF";
        try { c.getContext("2d").drawImage(img, 0, 0); } catch { return; }
        c.onclick = () => c.replaceWith(img);
        img.replaceWith(c);
      };
      img.complete ? snap() : img.addEventListener("load", snap, { once: true });
    });
  }

  // Script defer + restore on interaction
  function deferScripts() {
    if (!cfg.defer) return;
    document.querySelectorAll("script[src]:not([data-wp-s])").forEach((s) => {
      const src = s.getAttribute("src") || "";
      const t = s.getAttribute("type") || "";
      if (C.SCRIPT_DENY.test(src) || t === "application/ld+json") {
        const id = Math.random().toString(36).slice(2) + Date.now();
        state.deferredScripts.set(id, src);
        s.type = "text/wp-blocked"; s.setAttribute("data-wp-id", id); s.removeAttribute("src");
      }
      mark(s, "data-wp-s");
    });
  }

  function restoreScripts() {
    document.querySelectorAll('script[type="text/wp-blocked"][data-wp-id]').forEach((s) => {
      const id = s.getAttribute("data-wp-id");
      const src = id && state.deferredScripts.get(id);
      if (!src) return;
      if (src.startsWith("javascript:") || src.startsWith("data:") || src.startsWith("vbscript:") ||
          src.startsWith("//") || /[<>"']/.test(src)) { state.deferredScripts.delete(id); return; }
      if (!src.startsWith("https://") && !src.startsWith("/")) { state.deferredScripts.delete(id); return; }
      if (src.startsWith("https://")) { try { if (new URL(src).protocol !== "https:") { state.deferredScripts.delete(id); return; } } catch { state.deferredScripts.delete(id); return; } }
      state.deferredScripts.delete(id);
      const n = document.createElement("script");
      n.src = src; n.async = 1; n.setAttribute("data-restored", "1");
      s.parentNode?.replaceChild(n, s);
    });
  }

  function bindRestore() {
    if (state.interactionBound) return;
    const cb = () => { idle(() => restoreScripts(), 500); UE.forEach((e) => window.removeEventListener(e, cb, { passive: true })); state.interactionBound = 0; };
    UE.forEach((e) => window.addEventListener(e, cb, { passive: true, once: true }));
    state.interactionBound = 1;
  }

  // Preconnect + origin hints
  function addHint(rel, href, as, cors) {
    if (!href || !/^\s*https?:/i.test(href)) return;
    if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
    const l = document.createElement("link");
    l.rel = rel; l.href = href;
    if (as) l.as = as; if (cors) l.crossOrigin = "anonymous";
    l.setAttribute("data-wp-hint", "1"); document.head.appendChild(l);
  }

  function extractOrigins() {
    if (!cfg.preconnect) return;
    document.querySelectorAll("img[src]:not([data-wp-o]),script[src]:not([data-wp-o]),link[href]:not([data-wp-o]),iframe[src]:not([data-wp-o]),video[src]:not([data-wp-o]),source[src]:not([data-wp-o])").forEach((e) => {
      mark(e, "data-wp-o");
      const u = e.src || e.href;
      if (!u || !/^\s*https?:/i.test(u)) return;
      try { const url = new URL(u); if (url.origin !== location.origin && !state.origins.has(url.origin)) { state.origins.add(url.origin); addHint("preconnect", url.origin); } } catch {}
    });
  }

  function preloadCritical() {
    if (!cfg.preconnect) return;
    document.querySelectorAll('link[rel="stylesheet"],link[rel="preload"],img[loading="eager"]').forEach((el) => {
      if (el.href) addHint("preload", el.href, "style");
      else if (el.src) addHint("preload", el.src, "image");
    });
  }

  // Hover prefetch
  function initHoverPrefetch() {
    if (!cfg.hoverPrefetch) return;
    const EXCL = /\/log(?:in|out)|\/sign(?:in|out)|\/auth|\/account/;
    const doPrefetch = (e) => {
      const a = e.target.closest("a[href]");
      if (!a || a.dataset.noPrefetch) return;
      const { href } = a;
      if (state.hoverPrefetched.has(href) || EXCL.test(href) || isTracker(href)) return;
      state.hoverPrefetched.add(href);
      const link = document.createElement("link");
      link.rel = "prefetch"; link.href = href; link.as = "document";
      document.head?.appendChild(link);
    };
    document.addEventListener("mouseover", doPrefetch, { passive: true });
    document.addEventListener("touchstart", doPrefetch, { passive: true });
  }

  function blockPrefetchLinks() {
    if (!cfg.blockPrefetchLinks) return;
    document.querySelectorAll('link[rel="prefetch"]:not([data-wp-hint]),link[rel="preload"]:not([data-wp-hint])').forEach((l) => l.remove());
  }

  // YouTube privacy
  function ytPrivacy() {
    if (!cfg.ytPrivacy) return;
    document.querySelectorAll("iframe[src]:not([data-wp-yt])").forEach((iframe) => {
      if (iframe.src.includes("youtube.com/embed/")) iframe.src = iframe.src.replace("youtube.com/embed/", "youtube-nocookie.com/embed/");
      mark(iframe, "data-wp-yt");
    });
  }

  // DOM cleanup
  function domCleanup() {
    if (!cfg.domCleanup) return;
    document.querySelectorAll("meta").forEach((meta) => {
      const name = (meta.getAttribute("name") || "").toLowerCase();
      const prop = meta.getAttribute("property") || "";
      if (C.TRACKER_META.some((t) => name.includes(t)) || prop.startsWith("fb:")) meta.remove();
    });
    document.querySelectorAll("script").forEach((s) => { const src = s.getAttribute("src"); if (src && C.TRACKER_SCRIPTS.some((t) => src.includes(t))) s.remove(); });
    document.querySelectorAll("noscript").forEach((n) => n.remove());
    document.querySelectorAll("p").forEach((p) => { if (p.innerHTML.trim() === "&nbsp;") p.remove(); });
  }

  // Amazon optimizations
  function initAmazon() {
    if (!/\.amazon\./i.test(location.hostname)) return;
    if (/(checkout|signin|payment|addressselect|huc)/i.test(location.pathname)) return;

    const s = document.createElement("style");
    s.textContent = ".s-main-slot .s-result-item{content-visibility:auto;contain-intrinsic-size:1px 350px}img.s-image{transform:translateZ(0);will-change:opacity}#navFooter{content-visibility:auto;contain-intrinsic-size:1px 600px}";
    document.head.appendChild(s);

    const HIGH = 4, DEBOUNCE = 240;
    const prio = "fetchPriority" in HTMLImageElement.prototype;
    const optAZ = (root = document) => {
      root.querySelectorAll("img:not([data-az])").forEach((img, i) => {
        img.dataset.az = "1";
        if (img.closest("#navFooter")) { img.loading = "lazy"; img.decoding = "async"; if (prio) img.fetchPriority = "low"; return; }
        if (img.classList.contains("s-image")) {
          if (i < HIGH) { img.loading = "eager"; if (prio) img.fetchPriority = "high"; }
          else { img.loading = "lazy"; img.decoding = "async"; if (prio) img.fetchPriority = "low"; }
          return;
        }
        if (!img.loading) { img.loading = "lazy"; img.decoding = "async"; }
      });
    };
    const runAZ = () => {
      optAZ(document);
      let t;
      new MutationObserver((m) => {
        if (!m.some((x) => x.addedNodes.length)) return;
        clearTimeout(t);
        t = setTimeout(() => "requestIdleCallback" in window ? requestIdleCallback(() => optAZ(document.body)) : optAZ(document.body), DEBOUNCE);
      }).observe(document.body || document.documentElement, { childList: true, subtree: true });
    };
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", runAZ, { once: true }) : runAZ();
  }

  // Main run
  const run = throttle(() => {
    cleanURL(); applyBypass(); acceptCookies(); forceGPU(); optimizeMem(); preloadRes();
    lazyIframes(); lazyImages(); lazyVideos(); optimizeVids(); deferScripts();
    extractOrigins(); preloadCritical(); blockPrefetchLinks(); ytPrivacy(); domCleanup();
  }, C.TIME.THR_RUN);

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", run) : setTimeout(run, 100);
  if (cfg.defer) bindRestore();

  if (cfg.observe) {
    const mut = throttle(() => {
      cleanLinks(); lazyIframes(); lazyImages(); lazyVideos(); optimizeVids();
      deferScripts(); extractOrigins(); blockPrefetchLinks(); ytPrivacy();
    }, C.TIME.THR_MUT);
    new MutationObserver(() => mut()).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (cfg.mem) document.addEventListener("visibilitychange", throttle(() => { if (document.visibilityState === "hidden") optimizeMem(); }, C.TIME.THR_MEM));

  const onReady = () => { pauseGIFs(); initHoverPrefetch(); };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", onReady, { once: true }) : onReady();
  initAmazon();

  // Settings UI
  if (cfg.showUI) GM_registerMenuCommand("Web Pro ⚡ Settings", showUI);

  function showUI() {
    const ID = "wp-panel";
    if (document.getElementById(ID)) return;
    const LABELS = {
      log: "Debug logging", lazy: "Lazy-load images", iframes: "Lazy-load iframes",
      videos: "Lazy-load videos", defer: "Defer & block ad/tracking scripts",
      observe: "MutationObserver (dynamic content)", prefetch: "Link prefetch hints",
      hoverPrefetch: "Hover prefetch (mouseover)", blockPrefetchLinks: "Block page-injected prefetch/preload",
      preconnect: "Preconnect to external origins", gpu: "GPU compositing hints (video/canvas)",
      mem: "Memory cleanup on tab hide", preload: "Preload resource hints",
      cpuTamer: "CPU tamer (async setTimeout/setInterval)", rafTamer: "RAF tamer (async rAF)",
      throttleBG: "Throttle background timers (≥2s)", limitFPS: "Cap frame rate at 30fps",
      cleanURL: "Strip tracking params from URLs", blockBeacons: "Block sendBeacon to trackers",
      fingerprintReduce: "Fingerprint reduction", xhrBlock: "Block tracker XHR requests",
      ytPrivacy: "YouTube privacy (no-cookie embeds)", domCleanup: "Remove tracker meta/scripts/noscript",
      captchaSpeed: "Speed up Google reCAPTCHA", bypass: "Bypass copy/select restrictions",
      cookie: "Auto-accept cookie banners", tabSave: "Hide DOM when tab is hidden",
      silenceConsole: "Silence console output", darkMode: "Force dark mode",
      disableWebGL: "Disable WebGL", pauseGIFs: "Freeze GIF animations",
      siteToggle: "Show per-site disable button",
    };
    const rows = Object.entries(LABELS).map(([k, label]) =>
      `<label class="wp-row"><input type="checkbox" data-k="${k}" ${cfg[k] ? "checked" : ""}><span>${label}</span></label>`
    ).join("");

    const panel = document.createElement("div"); panel.id = ID;
    panel.innerHTML = `<style>
#${ID}{font-family:sans-serif;position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.82);backdrop-filter:blur(4px)}
.wp-modal{background:#1e1e1e;color:#eee;border-radius:10px;padding:20px;max-width:480px;width:92%;max-height:85vh;overflow-y:auto}
.wp-modal h2{margin:0 0 14px;font-size:1.05em;border-bottom:1px solid #444;padding-bottom:8px}
.wp-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:9px;cursor:pointer;font-size:.88em;line-height:1.4}
.wp-row input{margin-top:2px;flex-shrink:0}
.wp-note{font-size:.78em;color:#888;margin:6px 0 0}
.wp-modal button{background:#0070f3;color:#fff;border:none;border-radius:6px;cursor:pointer;width:100%;padding:8px;margin-top:10px;font-size:.9em}
.wp-modal button:hover{background:#0058c4}
</style><div class="wp-modal"><h2>⚡ Web Pro v6</h2>${rows}<p class="wp-note">Changes take effect on next page load.</p><button id="wp-close">Close</button></div>`;

    document.body.appendChild(panel);
    panel.querySelector("#wp-close").onclick = () => panel.remove();
    panel.querySelectorAll("input[type=checkbox]").forEach((cb) => { cb.onchange = (e) => { cfg[e.target.dataset.k] = e.target.checked ? 1 : 0; saveCfg(); }; });
  }

  // Per-site toggle
  if (cfg.siteToggle) {
    const addToggle = () => {
      if (document.getElementById("wp-toggle")) return;
      const btn = document.createElement("button"); btn.id = "wp-toggle";
      btn.textContent = "⚡ WebPro OFF"; btn.title = "Disable Web Pro for this site";
      btn.style.cssText = "position:fixed;bottom:10px;right:10px;z-index:99999;font-size:11px;padding:5px 9px;background:#222;color:#fff;border:none;border-radius:4px;cursor:pointer;touch-action:manipulation;opacity:.8";
      btn.onclick = () => { localStorage.setItem(SITE_KEY, "1"); location.reload(); };
      document.body?.appendChild(btn);
    };
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", addToggle, { once: true }) : addToggle();
  }

  log("Web Pro v6.0 loaded (mode=" + MODE + ")");
})();
