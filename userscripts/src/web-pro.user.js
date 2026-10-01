// ==UserScript==
// @name         Web Pro
// @author       Ven0m0
// @namespace    http://tampermonkey.net/
// @homepageURL  https://github.com/Ven0m0/Ven0m0-Adblock
// @version      6.2.0
// @description  Universal web optimizer: lazy load, URL cleaning, CPU/RAF tamer, network,
//               privacy, perf features. Merges: Web Pro, Web Performance Optimizer,
//               Speed up Google Captcha, plus selected ideas from Greasy Fork performance scripts.
// @match        *://*/*
// @exclude      /^https?://\S+\.(txt|png|jpg|jpeg|gif|xml|svg|manifest|log|ini)[^\/]*$/
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @run-at       document-start
// @allFrames    true
// @license      MIT
// ==/UserScript==
(() => {
  const SITE_KEY = `webpro:disable:${location.hostname}`;
  // localStorage access throws in sandboxed and opaque-origin frames
  const store = (() => {
    try {
      return localStorage;
    } catch {
      return null;
    }
  })();
  if (store?.getItem(SITE_KEY) === "1") {
    if (window.top === window)
      GM_registerMenuCommand("Web Pro ⚡ Enable on this site", () => {
        store.removeItem(SITE_KEY);
        location.reload();
      });
    return;
  }

  const HKEY = "__webpro_v6__";
  // Page globals must be patched on the page window: with @grant the script runs in a sandbox,
  // where `window.setTimeout = ...` would only change the sandbox's own copy.
  const win = typeof unsafeWindow === "object" ? unsafeWindow : window;
  // Firefox: functions handed to the page have to be exported from the sandbox
  const expose = typeof exportFunction === "function" ? (fn) => exportFunction(fn, win) : (fn) => fn;
  if (win[HKEY]) return;
  win[HKEY] = true;
  const VERSION = typeof GM_info === "object" ? GM_info.script.version : "dev";

  const isYouTube = /(?:^|\.)youtube\.com$|^youtu\.be$/.test(location.hostname);
  const conn = navigator.connection;
  const eff = conn?.effectiveType;
  const MODE = eff === "slow-2g" ? 2 : conn?.saveData || eff?.includes("2g") ? 1 : 0;

  // Config constants
  const C = {
    KEY: "ven0m0.webpro.v6",
    CACHE: { MAX: 48 * 1024 * 1024, TTL: 300000, RX: /\.(css|js|json)$/i },
    TIME: {
      IDLE: 1500,
      FALLBACK: 300,
      MIN_TO: 15,
      MIN_IV: 20,
      THR_CLEAN: 500,
      THR_RUN: 300,
      THR_MUT: 500,
      THR_MEM: 5000
    },
    TRACKER_META: [
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
    PREFETCH_EXCL:
      /\/(?:log(?:in|out|off)|sign(?:in|out|up)|register|auth|account|checkout|cart|download)|\.(?:zip|exe|pdf|apk|dmg|iso|7z|rar|msi|mp[34])(?:$|[?#])|[?&](?:logout|download|token|session|sid|key)=/i,
    PREFETCH_MAX_QUERY: 80,
    IO_MARGIN: "300px",
    BATCH: 30,
    GPU_SEL: "video,canvas,[data-gpu-accelerate],.animation-container,.slider,.carousel"
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
  const HASH_RE = /^#(?:intcid|back-url|back_url|src)/;
  const AMAZON_RE = /\.amazon\./i;

  const DEF = {
    log: 0,
    lazy: 1,
    iframes: 1,
    videos: 1,
    observe: 1,
    preconnect: 1,
    linkLimit: 10,
    linkDelay: 3000,
    hoverPrefetch: 1,
    viewportPrefetch: 0,
    asyncDecode: 1,
    blockPrefetchLinks: 1,
    cleanURL: 1,
    fingerprintReduce: 0,
    gpu: 1,
    mem: 1,
    cpuTamer: 1,
    rafTamer: 1,
    throttleBG: 1,
    minTimeout: C.TIME.MIN_TO,
    minInterval: C.TIME.MIN_IV,
    caching: 1,
    bypass: 1,
    rightClick: 0,
    copy: 1,
    select: 1,
    cookie: 0,
    tabSave: 0,
    domCleanup: 1,
    captchaSpeed: 1,
    silenceConsole: 0,
    siteToggle: 1,
    showUI: 1
  };
  if (MODE >= 2) DEF.fingerprintReduce = 1;

  const cfg = (() => {
    try {
      return { ...DEF, ...JSON.parse(store.getItem(C.KEY) || "") };
    } catch {
      return { ...DEF };
    }
  })();
  const saveCfg = () => store?.setItem(C.KEY, JSON.stringify(cfg));

  const state = {
    prefetchCount: 0,
    cache: new Map(),
    cacheSize: 0,
    loaded: new WeakSet(),
    origins: new Set(),
    videoObserver: null,
    hoverPrefetched: new Set()
  };

  // Helpers
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

  // Google Captcha speedup
  if (cfg.captchaSpeed && /\/recaptcha\/(api2|enterprise)\/bframe/.test(location.href)) {
    const origST = win.setTimeout;
    win.setTimeout = expose((fn, dur, ...args) => origST.call(win, fn, dur === 4000 || dur === 50 ? 0 : dur, ...args));
    // document.head may not exist yet at document-start
    (document.head || document.documentElement).appendChild(document.createElement("style")).textContent =
      "*{transition:none!important}";
  }

  // Fingerprint reduction
  if (cfg.fingerprintReduce) {
    const prop = (k, v) => Object.defineProperty(win.navigator, k, { get: expose(() => v), configurable: true });
    prop("hardwareConcurrency", 2);
    prop("deviceMemory", 2);
    prop("plugins", []);
    prop("mimeTypes", []);
  }

  // CPU tamer / RAF tamer — skip on YouTube; yt-pro handles those domains
  if ((cfg.cpuTamer || cfg.rafTamer) && !isYouTube) {
    const AsyncFn = (async () => {}).constructor;
    const [nTO, nSI, nRAF, nCTO, nCI, nCAF] = [
      "setTimeout",
      "setInterval",
      "requestAnimationFrame",
      "clearTimeout",
      "clearInterval",
      "cancelAnimationFrame"
    ].map((k) => win[k].bind(win));
    const micro = queueMicrotask;
    let res = () => {},
      p;
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

    const toSet = new Set(),
      rafSet = new Set();
    // toSet holds live timer ids; clearTimeout/clearInterval remove them, so a callback
    // cleared while waiting here does not run
    const awaitTO = async () => {
      if (last !== p) micro(trig);
      await p;
      if (last !== p) micro(trig);
      await p;
    };
    const awaitRAF = async (id, q) => {
      rafSet.add(id);
      await q;
      return rafSet.delete(id);
    };
    const throwE = (e) =>
      micro(() => {
        throw e;
      });

    if (cfg.cpuTamer) {
      win.setTimeout = expose((fn, d = 0, ...a) => {
        const h =
          typeof fn === "function"
            ? (...x) =>
                awaitTO()
                  .then(() => toSet.delete(id) && fn(...x))
                  .catch(throwE)
            : fn;
        const id = nTO(h, Math.max(d, cfg.minTimeout), ...a);
        toSet.add(id);
        return id;
      });
      win.setInterval = expose((fn, d = 0, ...a) => {
        const h =
          typeof fn === "function"
            ? (...x) =>
                awaitTO()
                  .then(() => toSet.has(id) && fn(...x))
                  .catch(throwE)
            : fn;
        const id = nSI(h, Math.max(d, cfg.minInterval), ...a);
        toSet.add(id);
        return id;
      });
      win.clearTimeout = expose((id) => {
        toSet.delete(id);
        return nCTO(id);
      });
      win.clearInterval = expose((id) => {
        toSet.delete(id);
        return nCI(id);
      });
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
        tl = document.documentElement?.animate?.(null)?.timeline || new T();
      } else tl = new T();

      win.requestAnimationFrame = expose((fn) => {
        const q = p;
        const id = nRAF((ts) => {
          const s = tl.currentTime;
          awaitRAF(id, q)
            .then((v) => {
              if (v) {
                fn(ts + (tl.currentTime - s));
              }
            })
            .catch(throwE);
        });
        if (last !== p) micro(trig);
        return id;
      });
      win.cancelAnimationFrame = expose((id) => {
        rafSet.delete(id);
        return nCAF(id);
      });
    }
  }

  // Background throttle — skip on YouTube; yt-pro patches the same timers there
  if (cfg.throttleBG && !isYouTube) {
    const st = win.setTimeout,
      si = win.setInterval;
    const slowST = expose((fn, ms, ...a) => st.call(win, fn, Math.max(ms | 0, 2000), ...a));
    const slowSI = expose((fn, ms, ...a) => si.call(win, fn, Math.max(ms | 0, 2000), ...a));
    // Swap only our own functions, so a timer patch installed later by the page or another script survives
    const swap = (k, from, to) => {
      if (win[k] === from) win[k] = to;
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        swap("setTimeout", st, slowST);
        swap("setInterval", si, slowSI);
      } else {
        swap("setTimeout", slowST, st);
        swap("setInterval", slowSI, si);
      }
    });
  }

  // Console silencing
  if (cfg.silenceConsole) {
    const noop = expose(() => {});
    ["log", "warn", "error", "debug", "info"].forEach((m) => {
      win.console[m] = noop;
    });
  }

  // Tab save
  if (cfg.tabSave)
    document.addEventListener("visibilitychange", () => {
      document.documentElement.style.display = document.visibilityState === "hidden" ? "none" : "";
    });

  // Fetch override: caching
  {
    const rx = (u) => cfg.caching && C.CACHE.RX.test(u);
    const cGet = (u) => {
      const e = state.cache.get(u);
      if (!e) return null;
      // ts is not refreshed on a hit, so an entry expires TTL after it was fetched
      if (Date.now() - e.ts < C.CACHE.TTL) return e;
      state.cache.delete(u);
      state.cacheSize -= e.data.length;
      return null;
    };
    const cSet = (u, data, r) => {
      // Concurrent misses for one URL both land here; replace instead of double-counting
      const old = state.cache.get(u);
      const size = state.cacheSize - (old ? old.data.length : 0) + data.length;
      if (size > C.CACHE.MAX) return;
      state.cache.set(u, { data, ts: Date.now(), status: r.status, statusText: r.statusText, headers: [...r.headers] });
      state.cacheSize = size;
    };
    const origFetch = win.fetch;
    win.fetch = expose(function (u, ...a) {
      // Cache key is the URL only, so cache plain GETs and nothing else
      const method = a[0]?.method;
      if (typeof u === "string" && rx(u) && (!method || method.toUpperCase() === "GET")) {
        const c = cGet(u);
        if (c) return Promise.resolve(new Response(c.data, c));
        return origFetch.call(this, u, ...a).then((r) => {
          if (!r.ok) return r;
          const s = Number.parseInt(r.headers.get("Content-Length") || "", 10);
          if (!Number.isNaN(s) && s > 1048576) return r;
          return r
            .clone()
            .text()
            .then((t) => {
              cSet(u, t, r);
              return new Response(t, { status: r.status, statusText: r.statusText, headers: r.headers });
            })
            .catch((e) => {
              log("Fetch clone error:", e);
              return r;
            });
        });
      }
      return origFetch.call(this, u, ...a);
    });
  }

  // URL cleaning
  const stripTracking = (url) => {
    let c = 0;
    // `ref` and `src` are functional params on many sites; only Amazon uses them purely for tracking
    const amazon = AMAZON_RE.test(url.hostname);
    if (amazon && url.href.includes("/ref=")) {
      url.href = url.href.replace("/ref=", "?ref=");
      c = 1;
    }
    for (const p of amazon ? [...TRACK, "ref", "src"] : TRACK)
      if (url.searchParams.has(p)) {
        url.searchParams.delete(p);
        c = 1;
      }
    return c;
  };

  const extractASIN = () => {
    if (document.readyState === "loading") return "";
    return (document.getElementById("ASIN") || document.querySelector("[name='ASIN.0']"))?.value || "";
  };

  function canonicalAmazon(url) {
    if (!AMAZON_RE.test(url.hostname)) return 0;
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
    return 1;
  }

  function cleanURL() {
    if (!cfg.cleanURL) return;
    try {
      const url = new URL(location.href);
      if (canonicalAmazon(url)) return;
      const c = stripTracking(url);
      const dropHash = HASH_RE.test(url.hash);
      if (c || dropHash)
        history.replaceState(null, "", url.origin + url.pathname + url.search + (dropHash ? "" : url.hash));
    } catch (e) {
      log("URL clean error:", e);
    }
  }

  const cleanLinks = (() => {
    if (!cfg.cleanURL) return () => {};
    let busy = 0;
    return throttle(() => {
      if (busy) return;
      busy = 1;
      try {
        const links = document.querySelectorAll("a[href]:not([data-wp-cl])");
        if (!links.length) return;
        let i = 0;
        const step = () => {
          const end = Math.min(i + C.BATCH, links.length);
          for (; i < end; i++) {
            const a = links[i];
            mark(a, "data-wp-cl");
            try {
              const h = a.href;
              const hl = h?.toLowerCase();
              if (!hl || hl.startsWith("javascript:") || hl.startsWith("data:") || hl.startsWith("vbscript:")) continue;
              const u = new URL(h);
              if (u.origin === location.origin) continue;
              if (stripTracking(u)) a.href = u.href;
            } catch (e) {
              if (cfg.log) log("Link clean error", e);
            }
          }
          if (i < links.length) idle(step);
        };
        step();
      } finally {
        busy = 0;
      }
    }, C.TIME.THR_CLEAN);
  })();

  // Bypass (right-click, copy, select)
  function applyBypass() {
    if (!cfg.bypass) return;
    if (cfg.rightClick) window.addEventListener("contextmenu", (e) => e.stopImmediatePropagation(), { capture: true });
    if (cfg.copy) {
      for (const ev of ["copy", "paste", "cut"])
        document.addEventListener(
          ev,
          (e) => {
            const t = e.target;
            if (["INPUT", "TEXTAREA", "DIV"].includes(t.tagName) && t.isContentEditable) e.stopImmediatePropagation();
          },
          { capture: true }
        );
    }
    if (cfg.select && !document.getElementById("wp-style")) {
      const s = document.createElement("style");
      s.id = "wp-style";
      s.textContent = "*{user-select:text!important}::selection{background:#b3d4fc;color:#000}";
      document.head.appendChild(s);
    }
  }

  // Cookie auto-accept
  function acceptCookies() {
    if (!cfg.cookie) return;
    document.querySelectorAll("button,input[type=button]").forEach((b) => {
      const t = (b.innerText || b.value || "").toLowerCase();
      if (/accept|agree|allow/.test(t)) b.click();
    });
  }

  // GPU compositing hints
  const forceGPU = (() => {
    if (!cfg.gpu) return () => {};
    const css = "transform:translate3d(0,0,0);will-change:transform;backface-visibility:hidden";
    return () => {
      document.querySelectorAll(`${C.GPU_SEL},img[loading="eager"]`).forEach((el) => {
        if (el.dataset.wpGpu) return;
        el.style.cssText += `;${css}`;
        el.dataset.wpGpu = "1";
      });
    };
  })();

  function optimizeMem() {
    if (!cfg.mem) return;
    if (window.gc) window.gc();
  }

  // Lazy loading
  function lazyImages() {
    if (!cfg.lazy) return;
    document.querySelectorAll("img:not([data-wp])").forEach((i) => {
      if (i.getAttribute("loading") === "eager") return;
      if (!i.getAttribute("loading")) i.setAttribute("loading", "lazy");
      if (cfg.asyncDecode && !i.getAttribute("decoding")) i.setAttribute("decoding", "async");
      if (i.dataset.src && !i.src) i.src = i.dataset.src;
      mark(i);
    });
  }

  function lazyIframes() {
    if (!cfg.iframes) return;
    document.querySelectorAll("iframe:not([data-wp])").forEach((i) => {
      const s = i.getAttribute("src");
      if (!s || !/^https?:/i.test(s) || i.getAttribute("srcdoc") !== null) return;
      i.loading = "lazy";
      i.fetchPriority = "low";
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
          for (const e of es) {
            if (!e.isIntersecting) continue;
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
        },
        { rootMargin: C.IO_MARGIN }
      );
    }
    for (const v of vids) {
      state.videoObserver.observe(v);
    }
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

  // Preconnect + origin hints
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
          log("Origin extract error:", e);
        }
      });
  }

  // Link prefetch: same-origin only, capped, skipped on data-saver / slow networks
  function initLinkPrefetch() {
    if ((!cfg.hoverPrefetch && !cfg.viewportPrefetch) || MODE >= 1) return;
    const prefetch = (a) => {
      if (state.prefetchCount >= cfg.linkLimit || a.dataset.noPrefetch) return;
      const { href } = a;
      if (state.hoverPrefetched.has(href)) return;
      let u;
      try {
        u = new URL(href);
      } catch {
        return;
      }
      if (u.origin !== location.origin || !/^https?:$/.test(u.protocol)) return;
      if (u.pathname === location.pathname && u.search === location.search) return;
      if (u.search.length > C.PREFETCH_MAX_QUERY || C.PREFETCH_EXCL.test(u.pathname + u.search)) return;
      state.hoverPrefetched.add(href);
      state.prefetchCount++;
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = href;
      link.as = "document";
      link.setAttribute("data-wp-hint", "1");
      document.head?.appendChild(link);
    };
    if (cfg.hoverPrefetch) {
      const onHover = (e) => {
        const a = e.target.closest?.("a[href]");
        if (a) prefetch(a);
      };
      document.addEventListener("mouseover", onHover, { passive: true });
      document.addEventListener("touchstart", onHover, { passive: true });
    }
    if (cfg.viewportPrefetch && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => {
        for (const e of es) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          prefetch(e.target);
        }
      });
      // ponytail: observes links present after linkDelay only, add MutationObserver hook if SPA links matter
      setTimeout(() => {
        for (const a of document.querySelectorAll("a[href]")) io.observe(a);
      }, cfg.linkDelay);
    }
  }

  function blockPrefetchLinks() {
    if (!cfg.blockPrefetchLinks) return;
    // Preloads are left alone: pages use them for fonts and LCP images
    document.querySelectorAll('link[rel="prefetch"]:not([data-wp-hint])').forEach((l) => {
      l.remove();
    });
  }

  // DOM cleanup
  function domCleanup() {
    if (!cfg.domCleanup) return;
    document.querySelectorAll("meta").forEach((meta) => {
      const name = (meta.getAttribute("name") || "").toLowerCase();
      const prop = meta.getAttribute("property") || "";
      if (C.TRACKER_META.some((t) => name.includes(t)) || prop.startsWith("fb:")) {
        meta.remove();
      }
    });
    document.querySelectorAll("noscript").forEach((n) => {
      n.remove();
    });
    document.querySelectorAll("p").forEach((p) => {
      if (p.innerHTML.trim() === "&nbsp;") {
        p.remove();
      }
    });
  }

  // Amazon optimizations
  function initAmazon() {
    if (!AMAZON_RE.test(location.hostname)) return;
    if (/(checkout|signin|payment|addressselect|huc)/i.test(location.pathname)) return;

    const s = document.createElement("style");
    s.textContent =
      ".s-main-slot .s-result-item{content-visibility:auto;contain-intrinsic-size:1px 350px}img.s-image{transform:translateZ(0);will-change:opacity}#navFooter{content-visibility:auto;contain-intrinsic-size:1px 600px}";
    (document.head || document.documentElement).appendChild(s);

    const HIGH = 4,
      DEBOUNCE = 240;
    const prio = "fetchPriority" in HTMLImageElement.prototype;
    const optAZ = (root = document) => {
      const imgs = root.getElementsByTagName("img");
      let i = 0;
      for (let j = 0; j < imgs.length; j++) {
        const img = imgs[j];
        if (img.dataset.az) continue;
        img.dataset.az = "1";
        if (img.closest("#navFooter")) {
          img.loading = "lazy";
          img.decoding = "async";
          if (prio) img.fetchPriority = "low";
        } else if (img.classList.contains("s-image")) {
          if (i < HIGH) {
            img.loading = "eager";
            if (prio) img.fetchPriority = "high";
          } else {
            img.loading = "lazy";
            img.decoding = "async";
            if (prio) img.fetchPriority = "low";
          }
        } else if (!img.loading) {
          img.loading = "lazy";
          img.decoding = "async";
        }
        i++;
      }
    };
    const runAZ = () => {
      optAZ(document);
      let t;
      new MutationObserver((m) => {
        if (!m.some((x) => x.addedNodes.length)) return;
        clearTimeout(t);
        t = setTimeout(
          () =>
            "requestIdleCallback" in window ? requestIdleCallback(() => optAZ(document.body)) : optAZ(document.body),
          DEBOUNCE
        );
      }).observe(document.body || document.documentElement, { childList: true, subtree: true });
    };
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", runAZ, { once: true }) : runAZ();
  }

  // Main run
  const run = throttle(() => {
    cleanURL();
    applyBypass();
    acceptCookies();
    forceGPU();
    optimizeMem();
    lazyIframes();
    lazyImages();
    lazyVideos();
    optimizeVids();
    extractOrigins();
    blockPrefetchLinks();
    domCleanup();
  }, C.TIME.THR_RUN);

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", run) : setTimeout(run, 100);

  if (cfg.observe) {
    const mut = throttle(() => {
      cleanLinks();
      lazyIframes();
      lazyImages();
      lazyVideos();
      optimizeVids();
      extractOrigins();
      blockPrefetchLinks();
    }, C.TIME.THR_MUT);
    new MutationObserver(() => mut()).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (cfg.mem)
    document.addEventListener(
      "visibilitychange",
      throttle(() => {
        if (document.visibilityState === "hidden") optimizeMem();
      }, C.TIME.THR_MEM)
    );

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", initLinkPrefetch, { once: true })
    : initLinkPrefetch();
  initAmazon();

  // Settings UI
  if (cfg.showUI) GM_registerMenuCommand("Web Pro ⚡ Settings", showUI);

  function showUI() {
    const ID = "wp-panel";
    if (document.getElementById(ID)) return;

    const panel = document.createElement("div");
    panel.id = ID;

    const style = document.createElement("style");
    style.textContent = `
      #${ID}{font-family:sans-serif;position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.82);backdrop-filter:blur(4px)}
      .wp-modal{background:#1e1e1e;color:#eee;border-radius:10px;padding:20px;max-width:480px;width:92%;max-height:85vh;overflow-y:auto}
      .wp-modal h2{margin:0 0 14px;font-size:1.05em;border-bottom:1px solid #444;padding-bottom:8px}
      .wp-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:9px;cursor:pointer;font-size:.88em;line-height:1.4}
      .wp-row input{margin-top:2px;flex-shrink:0}
      .wp-note{font-size:.78em;color:#888;margin:6px 0 0}
      .wp-modal button{background:#0070f3;color:#fff;border:none;border-radius:6px;cursor:pointer;width:100%;padding:8px;margin-top:10px;font-size:.9em}
      .wp-modal button:hover{background:#0058c4}
    `;
    panel.appendChild(style);

    const LABELS = {
      log: "Debug logging",
      lazy: "Lazy-load images",
      iframes: "Lazy-load iframes",
      videos: "Lazy-load videos",
      observe: "MutationObserver (dynamic content)",
      hoverPrefetch: "Hover prefetch (same-origin, capped)",
      viewportPrefetch: "Viewport prefetch (same-origin, capped)",
      asyncDecode: "Async image decoding",
      blockPrefetchLinks: "Block page-injected prefetch",
      preconnect: "Preconnect to external origins",
      gpu: "GPU compositing hints (video/canvas)",
      mem: "Memory cleanup on tab hide",
      cpuTamer: "CPU tamer (async setTimeout/setInterval)",
      rafTamer: "RAF tamer (async rAF)",
      throttleBG: "Throttle background timers (≥2s)",
      cleanURL: "Strip tracking params from URLs",
      fingerprintReduce: "Fingerprint reduction",
      domCleanup: "Remove tracker meta/noscript",
      captchaSpeed: "Speed up Google reCAPTCHA",
      bypass: "Bypass copy/select restrictions",
      cookie: "Auto-accept cookie banners",
      tabSave: "Hide DOM when tab is hidden",
      silenceConsole: "Silence console output",
      siteToggle: "Show per-site disable button"
    };

    const modal = document.createElement("div");
    modal.className = "wp-modal";

    const h2 = document.createElement("h2");
    h2.textContent = `⚡ Web Pro v${VERSION}`;
    modal.appendChild(h2);

    Object.entries(LABELS).forEach(([k, label]) => {
      const row = document.createElement("label");
      row.className = "wp-row";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.dataset.k = k;
      cb.checked = !!cfg[k];
      cb.onchange = (e) => {
        cfg[e.target.dataset.k] = e.target.checked ? 1 : 0;
        saveCfg();
      };

      const span = document.createElement("span");
      span.textContent = label;

      row.append(cb, span);
      modal.appendChild(row);
    });

    const note = document.createElement("p");
    note.className = "wp-note";
    note.textContent = "Changes take effect on next page load.";
    modal.appendChild(note);

    const closeBtn = document.createElement("button");
    closeBtn.id = "wp-close";
    closeBtn.textContent = "Close";
    closeBtn.onclick = () => panel.remove();
    modal.appendChild(closeBtn);

    panel.appendChild(modal);
    document.body.appendChild(panel);
  }

  // Per-site toggle (top frame only; re-enable through the userscript menu)
  if (cfg.siteToggle && window.top === window) {
    const addToggle = () => {
      if (document.getElementById("wp-toggle")) return;
      const btn = document.createElement("button");
      btn.id = "wp-toggle";
      btn.textContent = "⚡ WebPro OFF";
      btn.title = "Disable Web Pro for this site";
      btn.style.cssText =
        "position:fixed;bottom:10px;right:10px;z-index:99999;font-size:11px;padding:5px 9px;background:#222;color:#fff;border:none;border-radius:4px;cursor:pointer;touch-action:manipulation;opacity:.8";
      btn.onclick = () => {
        store?.setItem(SITE_KEY, "1");
        location.reload();
      };
      document.body?.appendChild(btn);
    };
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", addToggle, { once: true })
      : addToggle();
  }

  log(`Web Pro v${VERSION} loaded (mode=${MODE})`);
})();
