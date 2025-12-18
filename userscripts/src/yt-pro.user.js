// ==UserScript==
// @name         YouTube Unified Optimizer
// @namespace    http://tampermonkey.net/
// @version      4.3.1
// @description  Lightweight YouTube optimizer: CPU/GPU/UI tweaks, quality lock, flags, engine tame
// @match        https://youtube.com/*
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @match        https://music.youtube.com/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// @license      GPL-3.0
// @homepageURL  https://github.com/Ven0m0/Ven0m0-Adblock
// ==/UserScript==
(() => {
  "use strict";
  const GUARD = "__yt_unified_optimizer__";
  if (window[GUARD]) return;
  window[GUARD] = 1;
  const K = {
    RAF_BASE: 1e9,
    RAF_BATCH: 8,
    PREFETCH_TO: 3e4,
    TIMER_CHECK: 10,
    TIMER_REPATCH: 800,
    TIMER_NAV_DEB: 500,
    IDLE_CHECK: 2e3,
    IDLE_THROTTLE: 120,
    IDLE_MIN_ACTIVE: 150,
    LAZY_THUMB_MARGIN: "1000px",
    SCROLL_DB: 60,
    WHEEL_DB: 60,
    RESIZE_DB: 120,
    INSTANT_NAV_TH: 200,
    QUALITY_INIT: 120,
    QUALITY_RETRY: 120,
    QUALITY_EXP: 2592e6,
  };
  // prettier-ignore
  const CFG = { debug: 0, cpu: { eventThrottle: 1, rafDecimation: 1, timerPatch: 1, idleBoost: 1, idleDelayNormal: 8e3, idleDelayShorts: 15e3, rafFpsVisible: 20, rafFpsHidden: 3, minDelayIdle: 200, minDelayBase: 75 }, gpu: { blockAV1: 1, disableAmbient: 1, lazyThumbs: 1 }, ui: { hideSpinner: 1, hideShorts: 0, disableAnimations: 1, contentVisibility: 1, instantNav: 1 }, quality: { enabled: 1, targetRes: "hd1080", highFramerateTargetRes: null, preferPremium: 0, flushBuffer: 1, useAPI: 1, overwriteStoredSettings: 0 }, flags: { IS_TABLET: 1, DISABLE_YT_IMG_DELAY_LOADING: 1, kevlar_clear_non_displayable_url_params: 1, kevlar_clear_duplicate_pref_cookie: 1, kevlar_player_playlist_use_local_index: 1, web_secure_pref_cookie_killswitch: 1, ytidb_clear_optimizations_killswitch: 1, html5_allow_asmjs: 1, html5_honor_caption_availabilities_in_audio_track: 1, web_player_hide_nitrate_promo_tooltip: 1, html5_enable_vod_slar_with_notify_pacf: 1, html5_recognize_predict_start_cue_point: 1, log_gel_compression_latency: 1, log_gel_compression_latency_lr: 1, log_jspb_serialize_latency: 1, web_supports_animations_api: 1, enable_native_live_chat_on_kevlar: 1, live_chat_enable_qna_replay: 1, live_chat_aggregation: 1, live_chat_web_use_emoji_manager_singleton: 1, live_chat_mention_regex_update: 1, kevlar_refresh_on_theme_change: 0, kevlar_watch_cinematics: 0, web_cinematic_masthead: 0, enable_cinematic_blur_desktop_loading: 0, web_cinematic_theater_mode: 0, web_cinematic_fullscreen: 0 } };
  const RES = [
    "highres",
    "hd2880",
    "hd2160",
    "hd1440",
    "hd1080",
    "hd720",
    "large",
    "medium",
    "small",
    "tiny",
  ];
  const H = [4320, 2880, 2160, 1440, 1080, 720, 480, 360, 240, 144];
  const IDLE_ATTR = "data-yt-idle";
  const log = (...a) => CFG.debug && console.log("[YT Unified]", ...a);
  const isShorts = () => location.pathname.startsWith("/shorts");
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
  const debounce = (fn, d) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), d);
    };
  };
  const rafThrottle = (fn) => {
    let q = 0;
    return (...a) => {
      if (!q) {
        q = 1;
        requestAnimationFrame(() => {
          q = 0;
          fn(...a);
        });
      }
    };
  };
  const GM = window.GM || { getValue: GM_getValue, setValue: GM_setValue };
  const getStored = async (k, d) => {
    try {
      return GM.getValue ? await GM.getValue(`yt_opt_${k}`, d) : d;
    } catch {
      return d;
    }
  };
  const setStored = async (k, v) => {
    try {
      if (GM.setValue) await GM.setValue(`yt_opt_${k}`, v);
    } catch {}
  };
  (() => {
    const o = performance.now.bind(performance);
    let last = 0;
    performance.now = () => {
      const v = o();
      const n = v <= last ? last + 0.001 : v;
      last = n;
      return n;
    };
  })();
  (() => {
    if (Document?.prototype?.requestStorageAccess)
      Document.prototype.requestStorageAccess = undefined;
    if (Document?.prototype?.requestStorageAccessFor)
      Document.prototype.requestStorageAccessFor = undefined;
  })();
  if (CFG.gpu.blockAV1) {
    const cp = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function (t) {
      if (t && /av01/i.test(t)) return "";
      return cp.call(this, t);
    };
    if (navigator.mediaCapabilities?.decodingInfo) {
      const od = navigator.mediaCapabilities.decodingInfo.bind(
        navigator.mediaCapabilities,
      );
      navigator.mediaCapabilities.decodingInfo = async (c) =>
        /av01/i.test(c?.video?.contentType || "")
          ? { supported: 0, powerEfficient: 0, smooth: 0 }
          : od(c);
    }
    log("AV1 blocked");
  }
  if (CFG.cpu.eventThrottle) {
    const oa = EventTarget.prototype.addEventListener;
    const or = EventTarget.prototype.removeEventListener;
    const wrap = new WeakMap();
    const thEv = new Set(["mousemove", "pointermove", "touchmove"]);
    const dbEv = new Map([
      ["scroll", K.SCROLL_DB],
      ["wheel", K.WHEEL_DB],
      ["resize", K.RESIZE_DB],
    ]);
    const isP = (e) =>
      e instanceof HTMLVideoElement ||
      e.closest?.(".ytp-chrome-bottom,.ytp-volume-panel,.ytp-progress-bar");
    const isG = (e) =>
      e === window ||
      e === document ||
      e === document.documentElement ||
      e === document.body;
    EventTarget.prototype.addEventListener = function (t, f, o) {
      if (
        isShorts() ||
        !CFG.cpu.eventThrottle ||
        typeof f !== "function" ||
        isP(this) ||
        (isG(this) && (t === "wheel" || t === "scroll" || t === "resize"))
      )
        return oa.call(this, t, f, o);
      let w = f;
      if (thEv.has(t)) w = rafThrottle(f);
      else if (dbEv.has(t)) w = debounce(f, dbEv.get(t));
      if (w !== f) wrap.set(f, w);
      return oa.call(this, t, w, o);
    };
    EventTarget.prototype.removeEventListener = function (t, f, o) {
      return or.call(this, t, wrap.get(f) || f, o);
    };
    log("Event throttle ok");
  }
  if (CFG.cpu.rafDecimation) {
    const oRAF = requestAnimationFrame.bind(window);
    const oCAF = cancelAnimationFrame.bind(window);
    let idc = 1;
    const rafQ = new Map();
    let sch = 0;
    let next = performance.now();
    const iv = () =>
      document.visibilityState === "visible"
        ? 1000 / CFG.cpu.rafFpsVisible
        : 1000 / CFG.cpu.rafFpsHidden;
    const loop = () => {
      const now = performance.now();
      if (now >= next) {
        next = now + iv();
        const c = [...rafQ.values()];
        rafQ.clear();
        const b = Math.min(c.length, K.RAF_BATCH);
        for (let i = 0; i < b; i++)
          try {
            c[i](now);
          } catch {}
        for (let i = b; i < c.length; i++) oRAF(() => c[i](now));
      }
      oRAF(loop);
    };
    window.requestAnimationFrame = (cb) => {
      if (!CFG.cpu.rafDecimation) return oRAF(cb);
      const id = K.RAF_BASE + idc++;
      rafQ.set(id, cb);
      if (!sch) {
        sch = 1;
        next = performance.now();
        oRAF(loop);
      }
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      if (typeof id === "number" && id >= K.RAF_BASE) rafQ.delete(id);
      else oCAF(id);
    };
    document.addEventListener(
      "visibilitychange",
      throttle(() => {
        next = performance.now();
      }, 1000),
    );
    log("RAF decimation ok");
  }
  if (CFG.cpu.timerPatch) {
    (async () => {
      const nat = {
        setTimeout: window.setTimeout.bind(window),
        clearTimeout: window.clearTimeout.bind(window),
        setInterval: window.setInterval.bind(window),
        clearInterval: window.clearInterval.bind(window),
      };
      if (!document.documentElement)
        await new Promise((r) => {
          document.addEventListener("DOMContentLoaded", r, { once: true });
        });
      let timers = nat;
      if (document.visibilityState === "visible") {
        const f = document.createElement("iframe");
        f.style.display = "none";
        f.sandbox = "allow-same-origin allow-scripts";
        f.srcdoc = "<!doctype html><title>t</title>";
        document.documentElement.appendChild(f);
        await new Promise((r) => {
          const ck = () =>
            f.contentWindow?.setTimeout ? r() : setTimeout(ck, K.TIMER_CHECK);
          ck();
        });
        timers = {
          setTimeout: f.contentWindow.setTimeout.bind(f.contentWindow),
          clearTimeout: f.contentWindow.clearTimeout.bind(f.contentWindow),
          setInterval: f.contentWindow.setInterval.bind(f.contentWindow),
          clearInterval: f.contentWindow.clearInterval.bind(f.contentWindow),
        };
      }
      const wrapTO =
        (impl) =>
        (fn, d = 0, ...a) => {
          if (
            typeof fn !== "function" ||
            isShorts() ||
            d < CFG.cpu.minDelayBase
          )
            return nat.setTimeout(fn, d, ...a);
          return impl(() => fn(...a), d);
        };
      const wrapIV =
        (impl) =>
        (fn, d = 0, ...a) => {
          if (
            typeof fn !== "function" ||
            isShorts() ||
            d < CFG.cpu.minDelayBase
          )
            return nat.setInterval(fn, d, ...a);
          return impl(() => fn(...a), d);
        };
      window.setTimeout = wrapTO(timers.setTimeout);
      window.clearTimeout = timers.clearTimeout;
      window.setInterval = wrapIV(timers.setInterval);
      window.clearInterval = timers.clearInterval;
      if (CFG.cpu.idleBoost) {
        let last = performance.now();
        let throttleTimers = 1;
        let minDelay = CFG.cpu.minDelayBase;
        const actEv = [
          "mousemove",
          "mousedown",
          "keydown",
          "wheel",
          "touchstart",
          "pointerdown",
          "focusin",
        ];
        const thAct = throttle(() => {
          last = performance.now();
          if (document.documentElement.hasAttribute(IDLE_ATTR)) {
            document.documentElement.removeAttribute(IDLE_ATTR);
            throttleTimers = 1;
            minDelay = CFG.cpu.minDelayBase;
            log("Idle OFF");
          }
        }, K.IDLE_THROTTLE);
        actEv.forEach((ev) =>
          window.addEventListener(ev, thAct, { capture: true, passive: true }),
        );
        setInterval(() => {
          if (document.visibilityState !== "visible") return;
          const now = performance.now();
          const idle = isShorts()
            ? CFG.cpu.idleDelayShorts
            : CFG.cpu.idleDelayNormal;
          if (
            now - last >= idle &&
            !document.documentElement.hasAttribute(IDLE_ATTR)
          ) {
            document.documentElement.setAttribute(IDLE_ATTR, "1");
            const hv =
              document.querySelector("video.video-stream")?.paused === false;
            throttleTimers = !(hv || isShorts());
            minDelay =
              hv || isShorts() ? K.IDLE_MIN_ACTIVE : CFG.cpu.minDelayIdle;
            log("Idle ON");
          }
        }, K.IDLE_CHECK);
        window.__YT_TIMER_STATE__ = {
          get throttleTimers() {
            return throttleTimers;
          },
          get minDelay() {
            return minDelay;
          },
        };
      }
      const reapply = debounce(() => {
        window.setTimeout = wrapTO(timers.setTimeout);
        window.setInterval = wrapIV(timers.setInterval);
        window.clearTimeout = timers.clearTimeout;
        window.clearInterval = timers.clearInterval;
      }, K.TIMER_REPATCH);
      window.addEventListener("yt-navigate-finish", reapply);
    })();
  }
  (() => {
    let css = "";
    if (CFG.ui.disableAnimations)
      css +=
        "[no-anim] *{transition:none!important;animation:none!important}html{scroll-behavior:auto!important}.ytd-ghost-grid-renderer *,.ytd-continuation-item-renderer *{animation:none!important}";
    if (CFG.ui.contentVisibility)
      css += `html:not([data-yt-cv-off]) #comments,html:not([data-yt-cv-off]) #related,html:not([data-yt-cv-off]) ytd-watch-next-secondary-results-renderer{content-visibility:auto;contain-intrinsic-size:1px 1000px}`;
    if (CFG.ui.hideSpinner)
      css +=
        ".ytp-spinner,.ytp-spinner *{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}";
    if (CFG.gpu.disableAmbient)
      css +=
        ".ytp-ambient-light,ytd-watch-flexy[ambient-mode-enabled] .ytp-ambient-light{display:none!important}ytd-app,ytd-watch-flexy,#content,#page-manager{backdrop-filter:none!important}";
    if (CFG.ui.hideShorts)
      css +=
        '[hide-shorts] ytd-rich-section-renderer,ytd-reel-shelf-renderer,#endpoint[title="Shorts"],a[title="Shorts"]{display:none!important}';
    if (css) {
      const s = document.createElement("style");
      s.textContent = css;
      (document.head || document.documentElement).appendChild(s);
    }
  })();
  if (CFG.gpu.disableAmbient) {
    const dis = () => {
      const f = document.querySelector("ytd-watch-flexy");
      if (!f || f.dataset.ambientDis) return;
      f.dataset.ambientDis = "1";
      new MutationObserver(() => {
        if (f.hasAttribute("ambient-mode-enabled"))
          f.removeAttribute("ambient-mode-enabled");
      }).observe(f, {
        attributes: true,
        attributeFilter: ["ambient-mode-enabled"],
      });
    };
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", dis)
      : setTimeout(dis, 400);
    window.addEventListener("yt-navigate-finish", throttle(dis, 1000));
  }
  if (CFG.gpu.lazyThumbs) {
    const obs = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            if (e.target.style.display === "none") e.target.style.display = "";
            obs.unobserve(e.target);
          }
        });
      },
      { rootMargin: K.LAZY_THUMB_MARGIN },
    );
    const lazy = () => {
      document
        .querySelectorAll(
          "ytd-rich-item-renderer:not([data-lazy-opt]),ytd-compact-video-renderer:not([data-lazy-opt]),ytd-thumbnail:not([data-lazy-opt])",
        )
        .forEach((e) => {
          e.dataset.lazyOpt = "1";
          e.style.display = "none";
          obs.observe(e);
        });
    };
    const tl = throttle(lazy, 500);
    new MutationObserver(tl).observe(
      document.body || document.documentElement,
      { childList: true, subtree: true },
    );
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", lazy)
      : setTimeout(lazy, 120);
  }
  if (CFG.ui.instantNav) {
    const hov = throttle((e) => {
      const link = e.target.closest('a[href^="/watch"]');
      if (link) {
        const p = document.createElement("link");
        p.rel = "prefetch";
        p.href = link.href;
        p.fetchPriority = "low";
        document.head.appendChild(p);
        setTimeout(() => p.remove(), K.PREFETCH_TO);
      }
    }, K.INSTANT_NAV_TH);
    document.addEventListener("mouseover", hov, { passive: true });
  }
  let recent = "";
  let foundHFR = 0;
  if (CFG.quality.enabled) {
    const unwrap = (e) => e?.wrappedJSObject || e;
    const getVid = (y) => /(?:v=)([\w-]+)/.exec(y.getVideoUrl())?.[1] || "";
    const setRes = (y, rs) => {
      if (!y?.getPlaybackQuality) return;
      const cur = y.getPlaybackQuality();
      let res = CFG.quality.targetRes;
      if (CFG.quality.highFramerateTargetRes && foundHFR)
        res = CFG.quality.highFramerateTargetRes;
      const prem =
        CFG.quality.preferPremium &&
        [...y.getAvailableQualityData()].some(
          (q) =>
            q.quality === res &&
            q.qualityLabel.includes("Premium") &&
            q.isPlayable,
        );
      const useBtn = !CFG.quality.useAPI || prem;
      if (rs.indexOf(res) < rs.indexOf(cur)) {
        let nb = Math.max(rs.indexOf(res), 0);
        const av = y.getAvailableQualityLevels();
        while (av.indexOf(rs[nb]) === -1 && nb < rs.length - 1) ++nb;
        if (!useBtn && CFG.quality.flushBuffer && cur !== rs[nb]) {
          const id = getVid(y);
          if (id && !id.includes("ERROR")) {
            const pos = y.getCurrentTime();
            y.loadVideoById(id, pos, rs[nb]);
          }
        }
        res = rs[nb];
      }
      if (CFG.quality.useAPI) {
        y.setPlaybackQualityRange?.(res);
        y.setPlaybackQuality(res);
        log("Quality (API):", res);
      }
      if (useBtn) {
        try {
          const btn = document.querySelector(
            ".ytp-settings-button:not(#ScaleBtn)",
          );
          if (btn) {
            unwrap(btn).click();
            const qm = document.evaluate(
              './/*[contains(text(),"Quality")]/ancestor-or-self::*[@class="ytp-menuitem-label"]',
              y,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null,
            ).singleNodeValue;
            if (qm) {
              unwrap(qm).click();
              const qb = document.evaluate(
                `.//*[contains(text(),"${H[rs.indexOf(res)]}") and not(@class)]/ancestor::*[@class="ytp-menuitem"]`,
                y,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null,
              ).singleNodeValue;
              if (qb) {
                unwrap(qb).click();
                log("Quality (Buttons):", res);
              }
            }
          }
        } catch (e) {
          log("Quality button error:", e);
        }
      }
    };
    const setResReady = (y, rs) => {
      if (CFG.quality.useAPI && y.getPlaybackQuality === undefined) {
        window.setTimeout(setResReady, K.QUALITY_RETRY, y, rs);
        return;
      }
      let fr = 0;
      if (CFG.quality.highFramerateTargetRes) {
        const f = y.getVideoData().video_quality_features;
        if (f) {
          const h = f.includes("hfr");
          fr = h && !foundHFR;
          foundHFR = h;
        }
      }
      const vid = getVid(y);
      if (vid !== recent || fr) {
        recent = vid;
        setRes(y, rs);
        const stored = localStorage.getItem("yt-player-quality");
        if (!stored || !stored.includes(CFG.quality.targetRes)) {
          const tc = Date.now();
          const te = tc + K.QUALITY_EXP;
          localStorage.setItem(
            "yt-player-quality",
            `{"data":"${CFG.quality.targetRes}","expiration":${te},"creation":${tc}}`,
          );
        }
      }
    };
    const initQ = () => {
      const y =
        document.getElementById("movie_player") ||
        document.getElementsByClassName("html5-video-player")[0];
      const u = unwrap(y);
      if (u) setResReady(u, RES);
    };
    window.addEventListener(
      "loadstart",
      (e) => {
        if (!(e.target instanceof window.HTMLMediaElement)) return;
        const y =
          document.getElementById("movie_player") ||
          document.getElementsByClassName("html5-video-player")[0];
        const u = unwrap(y);
        if (u) {
          log("Loaded new video");
          setResReady(u, RES);
        }
      },
      true,
    );
    window.addEventListener("yt-navigate-finish", initQ, true);
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", initQ)
      : setTimeout(initQ, K.QUALITY_INIT);
  }
  const updateFlags = () => {
    const f = window.yt?.config_?.EXPERIMENT_FLAGS;
    if (f) Object.assign(f, CFG.flags);
  };
  const upF = throttle(updateFlags, 1000);
  if (document.head)
    new MutationObserver(upF).observe(document.head, {
      childList: true,
      subtree: true,
    });
  window.addEventListener("yt-navigate-finish", upF);
  updateFlags();
  if (CFG.ui.disableAnimations)
    document.documentElement.setAttribute("no-anim", "");
  if (CFG.ui.hideShorts)
    document.documentElement.setAttribute("hide-shorts", "");
  (async () => {
    if (!GM.getValue) return;
    try {
      const saved = await getStored("settingsSaved", false);
      if (CFG.quality.overwriteStoredSettings || !saved) {
        for (const [k, v] of Object.entries(CFG.quality))
          await setStored(`quality_${k}`, v);
        await setStored("settingsSaved", true);
        log("Settings saved");
      } else {
        for (const k of Object.keys(CFG.quality)) {
          const nv = await getStored(`quality_${k}`, CFG.quality[k]);
          if (k !== "overwriteStoredSettings") CFG.quality[k] = nv;
        }
        log("Settings loaded");
      }
    } catch (e) {
      log("Settings error:", e);
    }
  })();
  (() => {
    const win = window;
    if (typeof win?.navigator?.locks?.request === "function") {
      win.navigator.locks.query = () => Promise.resolve({});
      win.navigator.locks.request = () => new (async () => {})().constructor();
    }
  })();
  log("YouTube Unified Optimizer v4.3.1 loaded");
})();
