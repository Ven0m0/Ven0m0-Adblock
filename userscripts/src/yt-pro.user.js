// ==UserScript==
// @name         YouTube Unified Optimizer
// @namespace    http://tampermonkey.net/
// @version      4.3.0
// @description  Unified YouTube optimizer: CPU/GPU/UI optimizations + quality control + premium playback + experiment flags + JS engine taming
// @author       Ven0m0 (optimizer), adisib/Fznhq (quality control), CY Fung (flags/engine)
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

  // ───────────────────────────────── CONFIG ─────────────────────────────────
  const CONSTANTS = {
    RAF_BASE_ID: 1e9,
    RAF_BATCH_SIZE: 10,
    PREFETCH_TIMEOUT: 3e4,
    TIMER_CHECK_INTERVAL: 10,
    TIMER_REPATCH_DELAY: 800,
    TIMER_NAVIGATE_DEBOUNCE: 500,
    IDLE_CHECK_INTERVAL: 2e3,
    IDLE_THROTTLE: 100,
    IDLE_MIN_DELAY_ACTIVE: 150,
    LAZY_THUMB_ROOT_MARGIN: "1000px",
    SCROLL_DEBOUNCE: 60,
    WHEEL_DEBOUNCE: 60,
    RESIZE_DEBOUNCE: 120
  };

  const CFG = {
    debug: 0,
    cpu: {
      eventThrottle: 1,
      rafDecimation: 1,
      timerPatch: 1,
      idleBoost: 1,
      idleDelayNormal: 8e3,
      idleDelayShorts: 15e3,
      rafFpsVisible: 20,
      rafFpsHidden: 3,
      minDelayIdle: 200,
      minDelayBase: 75
    },
    gpu: { blockAV1: 1, disableAmbient: 1, lazyThumbs: 1 },
    ui: {
      hideSpinner: 1,
      hideShorts: 0,
      disableAnimations: 1,
      contentVisibility: 1,
      instantNav: 1
    },
    quality: {
      enabled: 1,
      targetRes: "hd1080",
      highFramerateTargetRes: null,
      preferPremium: 0,
      flushBuffer: 1,
      useAPI: 1,
      overwriteStoredSettings: 0
    },
    flags: {
      IS_TABLET: 1,
      DISABLE_YT_IMG_DELAY_LOADING: 1,
      kevlar_clear_non_displayable_url_params: 1,
      kevlar_clear_duplicate_pref_cookie: 1,
      kevlar_player_playlist_use_local_index: 1,
      web_secure_pref_cookie_killswitch: 1,
      ytidb_clear_optimizations_killswitch: 1,
      html5_allow_asmjs: 1,
      html5_honor_caption_availabilities_in_audio_track: 1,
      web_player_hide_nitrate_promo_tooltip: 1,
      html5_enable_vod_slar_with_notify_pacf: 1,
      html5_recognize_predict_start_cue_point: 1,
      log_gel_compression_latency: 1,
      log_gel_compression_latency_lr: 1,
      log_jspb_serialize_latency: 1,
      web_supports_animations_api: 1,
      enable_native_live_chat_on_kevlar: 1,
      live_chat_enable_qna_replay: 1,
      live_chat_aggregation: 1,
      live_chat_web_use_emoji_manager_singleton: 1,
      live_chat_mention_regex_update: 1,
      kevlar_refresh_on_theme_change: 0,
      kevlar_watch_cinematics: 0,
      web_cinematic_masthead: 0,
      enable_cinematic_blur_desktop_loading: 0,
      web_cinematic_theater_mode: 0,
      web_cinematic_fullscreen: 0
    }
  };

  const RESOLUTIONS = [
    "highres",
    "hd2880",
    "hd2160",
    "hd1440",
    "hd1080",
    "hd720",
    "large",
    "medium",
    "small",
    "tiny"
  ];
  const HEIGHTS = [4320, 2880, 2160, 1440, 1080, 720, 480, 360, 240, 144];
  const IDLE_ATTR = "data-yt-idle";

  // ──────────────────────────────── UTILS ──────────────────────────────────
  const log = (...a) => CFG.debug && console.log("[YT Unified]", ...a);
  const isShorts = () => location.pathname.startsWith("/shorts");
  const throttle = (fn, ms) => {
    let last = 0;
    return function (...a) {
      const now = Date.now();
      if (now - last >= ms) {
        last = now;
        return fn.apply(this, a);
      }
    };
  };
  const debounce = (fn, delay) => {
    let t;
    return function (...a) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, a), delay);
    };
  };
  const rafThrottle = (fn) => {
    let q = 0;
    return function (...a) {
      if (!q) {
        q = 1;
        requestAnimationFrame(() => {
          q = 0;
          fn.apply(this, a);
        });
      }
    };
  };
  const GM = window.GM || { getValue: GM_getValue, setValue: GM_setValue };
  const getStoredValue = async (k, d) => {
    try {
      return GM.getValue ? await GM.getValue(`yt_opt_${k}`, d) : d;
    } catch {
      return d;
    }
  };
  const setStoredValue = async (k, v) => {
    try {
      if (GM.setValue) await GM.setValue(`yt_opt_${k}`, v);
    } catch {}
  };

  // ───────────────────────────── JS ENGINE TAMER ───────────────────────────
  // perf.now monotonic tweak (addresses back nav issues)
  (() => {
    if (typeof performance?.now !== "function") return;
    const orig = performance.now.bind(performance);
    let last = 0;
    performance.now = function () {
      const v = orig();
      const next = v <= last ? last + 0.001 : v;
      last = next;
      return next;
    };
  })();

  // Remove requestStorageAccess (privacy)
  (() => {
    if (typeof Document !== "undefined") {
      if (Document.prototype.requestStorageAccess) {
        Document.prototype.requestStorageAccess = undefined;
      }
      if (Document.prototype.requestStorageAccessFor) {
        Document.prototype.requestStorageAccessFor = undefined;
      }
    }
  })();

  // Block AV1 aggressively
  if (CFG.gpu.blockAV1) {
    const cp = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function (type) {
      if (type && /av01/i.test(type)) return "";
      return cp.call(this, type);
    };
    if (navigator.mediaCapabilities?.decodingInfo) {
      const origDecode = navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);
      navigator.mediaCapabilities.decodingInfo = async (config) => {
        if (/av01/i.test(config?.video?.contentType || "")) {
          return { supported: false, powerEfficient: false, smooth: false };
        }
        return origDecode(config);
      };
    }
    log("AV1 blocked");
  }

  // ───────────────────────────── CPU: EVENTS/RAF/TIMERS ────────────────────
  if (CFG.cpu.eventThrottle) {
    const origAdd = EventTarget.prototype.addEventListener;
    const origRem = EventTarget.prototype.removeEventListener;
    const wrapMap = new WeakMap();
    const throttleEvents = new Set(["mousemove", "pointermove", "touchmove"]);
    const debounceEvents = new Map([
      ["scroll", CONSTANTS.SCROLL_DEBOUNCE],
      ["wheel", CONSTANTS.WHEEL_DEBOUNCE],
      ["resize", CONSTANTS.RESIZE_DEBOUNCE]
    ]);
    const isPlayer = (el) =>
      el instanceof HTMLVideoElement ||
      el.closest?.(".ytp-chrome-bottom,.ytp-volume-panel,.ytp-progress-bar");
    const isGlobal = (el) =>
      el === window || el === document || el === document.documentElement || el === document.body;
    EventTarget.prototype.addEventListener = function (type, fn, opt) {
      if (
        isShorts() ||
        !CFG.cpu.eventThrottle ||
        typeof fn !== "function" ||
        isPlayer(this) ||
        (isGlobal(this) && (type === "wheel" || type === "scroll" || type === "resize"))
      )
        return origAdd.call(this, type, fn, opt);
      let wrapped = fn;
      if (throttleEvents.has(type)) wrapped = rafThrottle(fn);
      else if (debounceEvents.has(type)) wrapped = debounce(fn, debounceEvents.get(type));
      if (wrapped !== fn) wrapMap.set(fn, wrapped);
      return origAdd.call(this, type, wrapped, opt);
    };
    EventTarget.prototype.removeEventListener = function (type, fn, opt) {
      const wrapped = wrapMap.get(fn) || fn;
      return origRem.call(this, type, wrapped, opt);
    };
    log("Event throttle ok");
  }

  if (CFG.cpu.rafDecimation) {
    const origRAF = window.requestAnimationFrame.bind(window);
    const origCAF = window.cancelAnimationFrame.bind(window);
    let idc = 1;
    const rafQ = new Map();
    let rafSch = 0,
      nextFrm = performance.now();
    const getInterval = () =>
      document.visibilityState === "visible"
        ? 1000 / CFG.cpu.rafFpsVisible
        : 1000 / CFG.cpu.rafFpsHidden;
    const processQueue = () => {
      const now = performance.now();
      if (now >= nextFrm) {
        nextFrm = now + getInterval();
        const cbs = Array.from(rafQ.values());
        rafQ.clear();
        const bs = Math.min(cbs.length, CONSTANTS.RAF_BATCH_SIZE);
        for (let i = 0; i < bs; i++) {
          try {
            cbs[i](now);
          } catch {}
        }
        for (let i = bs; i < cbs.length; i++) origRAF(() => cbs[i](now));
      }
      origRAF(processQueue);
    };
    window.requestAnimationFrame = (cb) => {
      if (!CFG.cpu.rafDecimation) return origRAF(cb);
      const id = CONSTANTS.RAF_BASE_ID + idc++;
      rafQ.set(id, cb);
      if (!rafSch) {
        rafSch = 1;
        nextFrm = performance.now();
        origRAF(processQueue);
      }
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      if (typeof id === "number" && id >= CONSTANTS.RAF_BASE_ID) rafQ.delete(id);
      else origCAF(id);
    };
    document.addEventListener(
      "visibilitychange",
      throttle(() => {
        nextFrm = performance.now();
      }, 1000)
    );
    log("RAF decimation ok");
  }

  if (CFG.cpu.timerPatch) {
    (async () => {
      const natv = {
        setTimeout: window.setTimeout.bind(window),
        clearTimeout: window.clearTimeout.bind(window),
        setInterval: window.setInterval.bind(window),
        clearInterval: window.clearInterval.bind(window)
      };
      if (!document.documentElement)
        await new Promise((r) => {
          if (document.documentElement) r();
          else document.addEventListener("DOMContentLoaded", r, { once: true });
        });

      let iframeTimers = natv;
      if (document.visibilityState === "visible") {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.sandbox = "allow-same-origin allow-scripts";
        iframe.srcdoc = "<!doctype html><title>timer</title>";
        document.documentElement.appendChild(iframe);
        await new Promise((r) => {
          const check = () => {
            iframe.contentWindow?.setTimeout ? r() : setTimeout(check, CONSTANTS.TIMER_CHECK_INTERVAL);
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

      const wrapTimeout = (impl) => (fn, delay = 0, ...a) => {
        if (typeof fn !== "function" || isShorts() || delay < CFG.cpu.minDelayBase) {
          return natv.setTimeout(fn, delay, ...a);
        }
        return impl(() => fn.apply(window, a), delay);
      };
      const wrapInterval = (impl) => (fn, delay = 0, ...a) => {
        if (typeof fn !== "function" || isShorts() || delay < CFG.cpu.minDelayBase) {
          return natv.setInterval(fn, delay, ...a);
        }
        return impl(() => fn.apply(window, a), delay);
      };

      window.setTimeout = wrapTimeout(iframeTimers.setTimeout);
      window.clearTimeout = iframeTimers.clearTimeout;
      window.setInterval = wrapInterval(iframeTimers.setInterval);
      window.clearInterval = iframeTimers.clearInterval;

      if (CFG.cpu.idleBoost) {
        let lastActive = performance.now();
        let throttleTimers = 1;
        let minDelay = CFG.cpu.minDelayBase;
        const activityEv = [
          "mousemove",
          "mousedown",
          "keydown",
          "wheel",
          "touchstart",
          "pointerdown",
          "focusin"
        ];
        const thAct = throttle(() => {
          lastActive = performance.now();
          if (document.documentElement.hasAttribute(IDLE_ATTR)) {
            document.documentElement.removeAttribute(IDLE_ATTR);
            throttleTimers = 1;
            minDelay = CFG.cpu.minDelayBase;
            log("Idle OFF");
          }
        }, CONSTANTS.IDLE_THROTTLE);
        activityEv.forEach((evt) => window.addEventListener(evt, thAct, { capture: true, passive: true }));
        setInterval(() => {
          if (document.visibilityState !== "visible") return;
          const now = performance.now();
          const idleDelay = isShorts() ? CFG.cpu.idleDelayShorts : CFG.cpu.idleDelayNormal;
          if (now - lastActive >= idleDelay) {
            if (!document.documentElement.hasAttribute(IDLE_ATTR)) {
              document.documentElement.setAttribute(IDLE_ATTR, "1");
              const hv = document.querySelector("video.video-stream")?.paused === false;
              throttleTimers = !(hv || isShorts());
              minDelay = hv || isShorts() ? CONSTANTS.IDLE_MIN_DELAY_ACTIVE : CFG.cpu.minDelayIdle;
              log("Idle ON");
            }
          }
        }, CONSTANTS.IDLE_CHECK_INTERVAL);
        window.__YT_TIMER_STATE__ = { get throttleTimers() { return throttleTimers; }, get minDelay() { return minDelay; } };
      }
    })();
  }

  // ───────────────────────────── GPU / UI TWEAKS ───────────────────────────
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
    const disableAmbient = () => {
      const flexy = document.querySelector("ytd-watch-flexy");
      if (!flexy || flexy.dataset.ambientDis) return;
      flexy.dataset.ambientDis = "1";
      const ambientObs = new MutationObserver(() => {
        if (flexy.hasAttribute("ambient-mode-enabled")) flexy.removeAttribute("ambient-mode-enabled");
      });
      ambientObs.observe(flexy, { attributes: true, attributeFilter: ["ambient-mode-enabled"] });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", disableAmbient);
    else setTimeout(disableAmbient, 500);
    const throttledAmbient = throttle(disableAmbient, 1000);
    window.addEventListener("yt-navigate-finish", throttledAmbient);
  }

  if (CFG.gpu.lazyThumbs) {
    const thumbObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target.style.display === "none") entry.target.style.display = "";
            thumbObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: CONSTANTS.LAZY_THUMB_ROOT_MARGIN }
    );
    const lazyLoad = () => {
      const el = document.querySelectorAll(
        "ytd-rich-item-renderer:not([data-lazy-opt]),ytd-compact-video-renderer:not([data-lazy-opt]),ytd-thumbnail:not([data-lazy-opt])"
      );
      el.forEach((e) => {
        e.dataset.lazyOpt = "1";
        e.style.display = "none";
        thumbObserver.observe(e);
      });
    };
    const throttledLazyLoad = throttle(lazyLoad, 500);
    const lazyObs = new MutationObserver(throttledLazyLoad);
    if (document.body) lazyObs.observe(document.body, { childList: true, subtree: true });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", lazyLoad);
    else setTimeout(lazyLoad, 100);
  }

  if (CFG.ui.instantNav) {
    const throttledMouseover = throttle((e) => {
      const link = e.target.closest('a[href^="/watch"]');
      if (link) {
        const prefetch = document.createElement("link");
        prefetch.rel = "prefetch";
        prefetch.href = link.href;
        prefetch.fetchPriority = "low";
        document.head.appendChild(prefetch);
        setTimeout(() => {
          prefetch.parentNode?.removeChild(prefetch);
        }, CONSTANTS.PREFETCH_TIMEOUT);
      }
    }, 200);
    document.addEventListener("mouseover", throttledMouseover, { passive: true });
  }

  // ───────────────────────────── QUALITY CONTROL ───────────────────────────
  let recentVideo = "";
  let foundHFR = 0;
  if (CFG.quality.enabled) {
    const unwrap = (el) => (el?.wrappedJSObject ? el.wrappedJSObject : el);
    const getVideoID = (ytPlayer) => {
      const m = /(?:v=)([\w-]+)/.exec(ytPlayer.getVideoUrl());
      return m ? m[1] : "";
    };
    const setResolution = (ytPlayer, resolutions) => {
      if (!ytPlayer || !ytPlayer.getPlaybackQuality) return;
      const current = ytPlayer.getPlaybackQuality();
      let res = CFG.quality.targetRes;
      if (CFG.quality.highFramerateTargetRes && foundHFR) res = CFG.quality.highFramerateTargetRes;
      const shouldPremium =
        CFG.quality.preferPremium &&
        [...ytPlayer.getAvailableQualityData()].some(
          (q) => q.quality === res && q.qualityLabel.includes("Premium") && q.isPlayable
        );
      const useButtons = !CFG.quality.useAPI || shouldPremium;
      if (resolutions.indexOf(res) < resolutions.indexOf(current)) {
        const end = resolutions.length - 1;
        let nextBest = Math.max(resolutions.indexOf(res), 0);
        const avail = ytPlayer.getAvailableQualityLevels();
        while (avail.indexOf(resolutions[nextBest]) === -1 && nextBest < end) ++nextBest;
        if (!useButtons && CFG.quality.flushBuffer && current !== resolutions[nextBest]) {
          const id = getVideoID(ytPlayer);
          if (id && !id.includes("ERROR")) {
            const pos = ytPlayer.getCurrentTime();
            ytPlayer.loadVideoById(id, pos, resolutions[nextBest]);
          }
        }
        res = resolutions[nextBest];
      }
      if (CFG.quality.useAPI) {
        ytPlayer.setPlaybackQualityRange?.(res);
        ytPlayer.setPlaybackQuality(res);
        log("Quality (API):", res);
      }
      if (useButtons) {
        try {
          const settingsButton = document.querySelector(".ytp-settings-button:not(#ScaleBtn)");
          if (settingsButton) {
            unwrap(settingsButton).click();
            const qualityMenuButton = document.evaluate(
              './/*[contains(text(),"Quality")]/ancestor-or-self::*[@class="ytp-menuitem-label"]',
              ytPlayer,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            ).singleNodeValue;
            if (qualityMenuButton) {
              unwrap(qualityMenuButton).click();
              const qualityButton = document.evaluate(
                `.//*[contains(text(),"${HEIGHTS[resolutions.indexOf(res)]}") and not(@class)]/ancestor::*[@class="ytp-menuitem"]`,
                ytPlayer,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
              ).singleNodeValue;
              if (qualityButton) {
                unwrap(qualityButton).click();
                log("Quality (Buttons):", res);
              }
            }
          }
        } catch (e) {
          log("Quality button error:", e);
        }
      }
    };
    const setResOnReady = (ytPlayer, resolutions) => {
      if (CFG.quality.useAPI && ytPlayer.getPlaybackQuality === undefined) {
        window.setTimeout(setResOnReady, 100, ytPlayer, resolutions);
        return;
      }
      let framerateUpdate = 0;
      if (CFG.quality.highFramerateTargetRes) {
        const features = ytPlayer.getVideoData().video_quality_features;
        if (features) {
          const isHFR = features.includes("hfr");
          framerateUpdate = isHFR && !foundHFR;
          foundHFR = isHFR;
        }
      }
      const curVid = getVideoID(ytPlayer);
      if (curVid !== recentVideo || framerateUpdate) {
        recentVideo = curVid;
        setResolution(ytPlayer, resolutions);
        const storedQuality = localStorage.getItem("yt-player-quality");
        if (!storedQuality || !storedQuality.includes(CFG.quality.targetRes)) {
          const tc = Date.now();
          const te = tc + 2592e6;
          localStorage.setItem(
            "yt-player-quality",
            `{"data":"${CFG.quality.targetRes}","expiration":${te},"creation":${tc}}`
          );
        }
      }
    };
    const initQuality = () => {
      const ytPlayer = document.getElementById("movie_player") || document.getElementsByClassName("html5-video-player")[0];
      const unwrapped = unwrap(ytPlayer);
      if (unwrapped) setResOnReady(unwrapped, RESOLUTIONS);
    };
    window.addEventListener(
      "loadstart",
      (e) => {
        if (!(e.target instanceof window.HTMLMediaElement)) return;
        const ytPlayer =
          document.getElementById("movie_player") || document.getElementsByClassName("html5-video-player")[0];
        const unwrapped = unwrap(ytPlayer);
        if (unwrapped) {
          log("Loaded new video");
          setResOnReady(unwrapped, RESOLUTIONS);
        }
      },
      true
    );
    window.addEventListener("yt-navigate-finish", initQuality, true);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initQuality);
    else setTimeout(initQuality, 100);
  }

  // ───────────────────────────── FLAGS ─────────────────────────────────────
  const updateFlags = () => {
    const flags = window.yt?.config_?.EXPERIMENT_FLAGS;
    if (flags) Object.assign(flags, CFG.flags);
  };
  const throttledFlagUpdate = throttle(updateFlags, 1000);
  if (document.head) {
    const flagObs = new MutationObserver(throttledFlagUpdate);
    flagObs.observe(document.head, { childList: true, subtree: true });
  }
  window.addEventListener("yt-navigate-finish", throttledFlagUpdate);
  updateFlags();

  // ───────────────────────────── SETTINGS PERSIST ──────────────────────────
  (async () => {
    if (!GM.getValue) return;
    try {
      const settingsSaved = await getStoredValue("settingsSaved", false);
      if (CFG.quality.overwriteStoredSettings || !settingsSaved) {
        for (const [k, v] of Object.entries(CFG.quality)) await setStoredValue(`quality_${k}`, v);
        await setStoredValue("settingsSaved", true);
        log("Settings saved");
      } else {
        for (const k of Object.keys(CFG.quality)) {
          const nv = await getStoredValue(`quality_${k}`, CFG.quality[k]);
          if (k !== "overwriteStoredSettings") CFG.quality[k] = nv;
        }
        log("Settings loaded");
      }
    } catch (e) {
      log("Settings error:", e);
    }
  })();

  // ───────────────────────────── MISC GUARDS ───────────────────────────────
  if (CFG.ui.disableAnimations) document.documentElement.setAttribute("no-anim", "");
  if (CFG.ui.hideShorts) document.documentElement.setAttribute("hide-shorts", "");

  // JS engine tame: drop MediaSession locks (avoid stalls)
  (() => {
    const win = window;
    if (typeof win?.navigator?.locks?.request === "function") {
      win.navigator.locks.query = () => Promise.resolve({});
      win.navigator.locks.request = () => new (async () => {})().constructor();
    }
  })();

  // ───────────────────────────── LOG ───────────────────────────────────────
  log("YouTube Unified Optimizer v4.3.0 loaded");
})();
