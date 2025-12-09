// ==UserScript==
// @name         YouTube Unified Optimizer
// @namespace    http://tampermonkey.net/
// @version      3.0.0
// @description  Unified YouTube optimizer: CPU/GPU optimizations + automatic quality control & premium playback
// @author       Ven0m0 (optimizer), adisib/Fznhq (quality control)
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
"use strict";
(() => {
    const GUARD = "__yt_unified_optimizer__";
    if (window[GUARD]) return;
    window[GUARD] = 1;

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
        gpu: {
            blockAV1: 1,
            disableAmbient: 1,
            lazyThumbs: 1
        },
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
            polymer_verifiy_app_state: 0,
            desktop_delay_player_resizing: 0,
            web_animated_actions: 0,
            web_animated_like: 0,
            render_unicode_emojis_as_small_images: 1,
            smartimation_background: 0,
            kevlar_refresh_on_theme_change: 0,
            kevlar_watch_cinematics: 0,
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
    const log = (...a) => CFG.debug && console.log("[YT Unified]", ...a);
    const isShorts = () => location.pathname.startsWith("/shorts");
    const IDLE_ATTR = "data-yt-idle";
    const CV_OFF_ATTR = "data-yt-cv-off";

    const throttle = (fn, ms) => {
        let last = 0;
        return function(...a) {
            const now = Date.now();
            if (now - last >= ms) {
                fn.apply(this, a);
                last = now;
            }
        };
    };

    const debounce = (fn, delay) => {
        let t;
        return function(...a) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, a), delay);
        };
    };

    const rafThrottle = (fn) => {
        let q = 0;
        return function(...a) {
            if (!q) {
                q = 1;
                requestAnimationFrame(() => {
                    fn.apply(this, a);
                    q = 0;
                });
            }
        };
    };

    const GM = window.GM || {
        getValue: GM_getValue,
        setValue: GM_setValue
    };
    const getStoredValue = async (key, def) => {
        try {
            if (GM.getValue) return await GM.getValue(`yt_opt_${key}`, def);
            return def;
        } catch {
            return def;
        }
    };
    const setStoredValue = async (key, val) => {
        try {
            if (GM.setValue) await GM.setValue(`yt_opt_${key}`, val);
        } catch {
            /* ignore */
        }
    };

    let recentVideo = "",
        foundHFR = 0;

    (() => {
        const win = window;
        if (typeof win?.navigator?.locks?.request === "function") {
            win.navigator.locks.query = () => Promise.resolve({});
            win.navigator.locks.request = () => new(async () => {}).constructor();
        }
        if (win?.indexedDB?.constructor?.name === "IDBFactory") {
            const origOpen = win.indexedDB.constructor.prototype.open;
            const openDBs = new Set(),
                closedDBs = new Map();
            let cleanupTimer = 0;
            const cleanup = () => {
                for (const req of openDBs) {
                    try {
                        req.result?.close();
                    } catch {
                        /* noop */
                    }
                }
                openDBs.clear();
                for (const [db] of closedDBs) {
                    try {
                        db?.close();
                    } catch {
                        /* noop */
                    }
                }
                closedDBs.clear();
            };
            const dbCloseMap = new WeakMap();
            const scheduleClose = (db) => {
                clearTimeout(cleanupTimer);
                closedDBs.set(db, Date.now());
                cleanupTimer = setTimeout(cleanup, 20e3);
            };
            win.indexedDB.constructor.prototype.open = function(name, ver) {
                const req = origOpen.call(this, name, ver);
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    dbCloseMap.set(db, {
                        name,
                        openTime: Date.now()
                    });
                    scheduleClose(db, name);
                };
                openDBs.add(req);
                return req;
            };
        }
    })();

    if (CFG.gpu.blockAV1) {
        const cp = HTMLMediaElement.prototype.canPlayType;
        HTMLMediaElement.prototype.canPlayType = function(type) {
            if (type && /av01/i.test(type)) return "";
            return cp.call(this, type);
        };
        if (navigator.mediaCapabilities?.decodingInfo) {
            const origDecode = navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);
            navigator.mediaCapabilities.decodingInfo = async (config) => {
                if (/av01/i.test(config?.video?.contentType || ""))
                    return {
                        supported: 0,
                        powerEfficient: 0,
                        smooth: 0
                    };
                return origDecode(config);
            };
        }
        log("AV1 blocked");
    }

    (() => {
        let css = "";
        if (CFG.ui.disableAnimations)
            css +=
            "[no-anim] *{transition:none!important;animation:none!important}html{scroll-behavior:auto!important}.ytd-ghost-grid-renderer *,.ytd-continuation-item-renderer *{animation:none!important}";
        if (CFG.ui.contentVisibility)
            css += `html:not([${CV_OFF_ATTR}]) #comments,html:not([${CV_OFF_ATTR}]) #related,html:not([${CV_OFF_ATTR}]) ytd-watch-next-secondary-results-renderer{content-visibility:auto!important;contain-intrinsic-size:auto 1px 1000px}`;
        if (CFG.ui.hideSpinner)
            css +=
            ".ytp-spinner,.ytp-spinner *{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}";
        if (CFG.gpu.disableAmbient)
            css +=
            ".ytp-ambient-light,ytd-watch-flexy[ambient-mode-enabled] .ytp-ambient-light{display:none!important}ytd-app,ytd-watch-flexy,#content,#page-manager{backdrop-filter:none!important;filter:none!important}";
        if (CFG.ui.hideShorts)
            css +=
            '[hide-shorts] ytd-rich-section-renderer,ytd-reel-shelf-renderer,#endpoint[title="Shorts"],a[title="Shorts"]{display:none!important}';
        if (css) {
            const s = document.createElement("style");
            s.textContent = css;
            (document.head || document.documentElement).appendChild(s);
        }
    })();

    if (CFG.cpu.eventThrottle) {
        const origAdd = EventTarget.prototype.addEventListener;
        const origRem = EventTarget.prototype.removeEventListener;
        const wrapMap = new WeakMap();
        const throttleEvents = new Set(["mousemove", "pointermove", "touchmove"]);
        const debounceEvents = new Map([
            ["scroll", 60],
            ["wheel", 60],
            ["resize", 120]
        ]);
        const isPlayer = (el) =>
            el instanceof HTMLVideoElement ||
            el.closest?.(".ytp-chrome-bottom,.ytp-volume-panel,.ytp-progress-bar");
        const isGlobal = (el) =>
            el === window || el === document || el === document.documentElement || el === document.body;

        EventTarget.prototype.addEventListener = function(type, fn, opt) {
            if (
                isShorts() ||
                !CFG.cpu.eventThrottle ||
                typeof fn !== "function" ||
                isPlayer(this) ||
                (isGlobal(this) && (type === "wheel" || type === "scroll" || type === "resize"))
            )
                return origAdd.call(this, type, fn, opt);
            let wrapped = fn;
            if (throttleEvents.has(type)) wrapped = rafThrottle(fn, this);
            else if (debounceEvents.has(type)) wrapped = debounce(fn, this, debounceEvents.get(type));
            if (wrapped !== fn) wrapMap.set(fn, wrapped);
            return origAdd.call(this, type, wrapped, opt);
        };
        EventTarget.prototype.removeEventListener = function(type, fn, opt) {
            const wrapped = wrapMap.get(fn) || fn;
            return origRem.call(this, type, wrapped, opt);
        };
        log("Event throttle ok");
    }

    if (CFG.cpu.rafDecimation) {
        const origRAF = window.requestAnimationFrame.bind(window),
            origCAF = window.cancelAnimationFrame.bind(window),
            BASE_ID = 1e9;
        let idc = 1;
        const rafQ = new Map();
        let rafSch = 0,
            nextFrm = performance.now();
        const getInterval = () =>
            document.visibilityState === "visible" ?
            1e3 / CFG.cpu.rafFpsVisible :
            1e3 / CFG.cpu.rafFpsHidden;
        const processQueue = () => {
            const now = performance.now();
            if (now >= nextFrm) {
                nextFrm = now + getInterval();
                const cbs = Array.from(rafQ.values());
                rafQ.clear();
                const bs = Math.min(cbs.length, 10);
                for (let i = 0; i < bs; i++) {
                    try {
                        cbs[i](now);
                    } catch {
                        /* noop */
                    }
                }
                for (let i = bs; i < cbs.length; i++)
                    origRAF(() => {
                        try {
                            cbs[i](now);
                        } catch {
                            /* noop */
                        }
                    });
            }
            origRAF(processQueue);
        };
        window.requestAnimationFrame = (cb) => {
            if (!CFG.cpu.rafDecimation) return origRAF(cb);
            const id = BASE_ID + idc++;
            rafQ.set(id, cb);
            if (!rafSch) {
                rafSch = 1;
                nextFrm = performance.now();
                origRAF(processQueue);
            }
            return id;
        };
        window.cancelAnimationFrame = (id) => {
            typeof id === "number" && id >= BASE_ID ? rafQ.delete(id) : origCAF(id);
        };
        document.addEventListener(
            "visibilitychange",
            throttle(() => {
                nextFrm = performance.now();
            }, 1e3)
        );
        log("RAF decimation ok");
    }

    (async () => {
        if (!CFG.cpu.timerPatch) return;
        const natv = {
            setTimeout: window.setTimeout.bind(window),
            clearTimeout: window.clearTimeout.bind(window),
            setInterval: window.setInterval.bind(window),
            clearInterval: window.clearInterval.bind(window)
        };
        if (!document.documentElement)
            await new Promise((r) => {
                if (document.documentElement) r();
                else document.addEventListener("DOMContentLoaded", r, {
                    once: true
                });
            });
        let iframeTimers = natv;
        if (document.visibilityState === "visible") {
            const iframe = document.createElement("iframe");
            iframe.id = "yt-timer-provider";
            iframe.style.display = "none";
            iframe.sandbox = "allow-same-origin allow-scripts";
            iframe.srcdoc = "<!doctype html><title>timer</title>";
            document.documentElement.appendChild(iframe);
            await new Promise((r) => {
                const check = () => {
                    iframe.contentWindow?.setTimeout ? r() : setTimeout(check, 10);
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

        let throttleTimers = 1,
            minDelay = CFG.cpu.minDelayBase,
            lastActive = performance.now();
        const scheduleCallback = (cb) => {
            if (document.visibilityState === "visible")
                return new Promise((r) => {
                    const ob = new MutationObserver(() => {
                        ob.disconnect();
                        r();
                    });
                    ob.observe(trigger, {
                        attributes: true
                    });
                    trigger.setAttribute("data-trigger", Math.random().toString(36).slice(2));
                }).then(cb);
            return new Promise(requestAnimationFrame).then(cb);
        };

        const wrapTimeout =
            (impl, tracked) =>
            (fn, delay = 0, ...a) => {
                const exec = typeof fn === "function" ? () => fn.apply(window, a) : () => eval(String(fn));
                if (isShorts() || !throttleTimers || delay < minDelay) return natv.setTimeout(exec, delay);
                const id = impl(() => scheduleCallback(exec), delay);
                tracked.add(id);
                return id;
            };
        const wrapClear = (tracked) => (id) => {
            if (tracked.has(id)) {
                tracked.delete(id);
                iframeTimers.clearTimeout(id);
            } else natv.clearTimeout(id);
        };
        const wrapInterval =
            (impl) =>
            (fn, delay = 0, ...a) => {
                if (isShorts() || typeof fn !== "function" || delay < minDelay || !throttleTimers)
                    return natv.setInterval(() => fn.apply(window, a), delay);
                return impl(() => scheduleCallback(() => fn.apply(window, a)), delay);
            };

        const patchTimers = () => {
            const tracked = new Set();
            window.setTimeout = wrapTimeout(iframeTimers.setTimeout, tracked);
            window.clearTimeout = wrapClear(tracked);
            window.setInterval = wrapInterval(iframeTimers.setInterval);
            window.clearInterval = iframeTimers.clearInterval;
            log("Timer patch ok");
        };
        const unpatchTimers = () => {
            Object.assign(window, natv);
            log("Timer patch removed");
        };
        patchTimers();
        if (CFG.cpu.idleBoost) {
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
            }, 100);
            activityEv.forEach((evt) =>
                window.addEventListener(evt, thAct, {
                    capture: true,
                    passive: true
                })
            );
            setInterval(() => {
                if (document.visibilityState !== "visible") return;
                const now = performance.now(),
                    idl = isShorts() ? CFG.cpu.idleDelayShorts : CFG.cpu.idleDelayNormal;
                if (now - lastActive >= idl) {
                    if (!document.documentElement.hasAttribute(IDLE_ATTR)) {
                        document.documentElement.setAttribute(IDLE_ATTR, "1");
                        const hv = document.querySelector("video.video-stream")?.paused === false;
                        throttleTimers = !(hv || isShorts());
                        minDelay = hv || isShorts() ? 150 : CFG.cpu.minDelayIdle;
                        log("Idle ON");
                    }
                }
            }, 2e3);
        }
        const throttledNavigate = debounce(() => {
            unpatchTimers();
            setTimeout(patchTimers, 800);
        }, 500);
        window.addEventListener("yt-navigate-finish", throttledNavigate);
    })();

    const updateFlags = () => {
        const flags = window.yt?.config_?.EXPERIMENT_FLAGS;
        if (flags) Object.assign(flags, CFG.flags);
    };
    const throttledFlagUpdate = throttle(updateFlags, 1e3);
    if (document.head) {
        const flagObs = new MutationObserver(throttledFlagUpdate);
        flagObs.observe(document.head, {
            childList: true,
            subtree: true
        });
    }
    window.addEventListener("yt-navigate-finish", throttledFlagUpdate);
    updateFlags();

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
                }, 3e4);
            }
        }, 200);
        document.addEventListener("mouseover", throttledMouseover, {
            passive: true
        });
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
            }, {
                rootMargin: "1000px"
            }
        );
        const lazyLoad = () => {
            const el = document.querySelectorAll(
                "ytd-rich-item-renderer:not([data-lazy-opt])," +
                "ytd-compact-video-renderer:not([data-lazy-opt])," +
                "ytd-thumbnail:not([data-lazy-opt])"
            );
            el.forEach((e) => {
                e.dataset.lazyOpt = "1";
                e.style.display = "none";
                thumbObserver.observe(e);
            });
        };
        const throttledLazyLoad = throttle(lazyLoad, 500);
        const lazyObs = new MutationObserver(throttledLazyLoad);
        if (document.body) lazyObs.observe(document.body, {
            childList: true,
            subtree: true
        });
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", lazyLoad);
        else setTimeout(lazyLoad, 100);
    }

    if (CFG.gpu.disableAmbient) {
        const disableAmbient = () => {
            const flexy = document.querySelector("ytd-watch-flexy");
            if (!flexy || flexy.dataset.ambientDis) return;
            flexy.dataset.ambientDis = "1";
            const ambientObs = new MutationObserver((mutations) => {
                mutations.forEach((m) => {
                    if (
                        m.type === "attributes" &&
                        m.attributeName === "ambient-mode-enabled" &&
                        flexy.hasAttribute("ambient-mode-enabled")
                    )
                        flexy.removeAttribute("ambient-mode-enabled");
                });
            });
            ambientObs.observe(flexy, {
                attributes: true,
                attributeFilter: ["ambient-mode-enabled"]
            });
        };
        if (document.readyState === "loading")
            document.addEventListener("DOMContentLoaded", disableAmbient);
        else setTimeout(disableAmbient, 500);
        const throttledAmbient = throttle(disableAmbient, 1e3);
        window.addEventListener("yt-navigate-finish", throttledAmbient);
    }

    if (CFG.quality.enabled) {
        const unwrapElement = (el) => (el?.wrappedJSObject ? el.wrappedJSObject : el);
        const getVideoIDFromURL = (ytPlayer) => {
            const idMatch = /(?:v=)([\w-]+)/;
            const matches = idMatch.exec(ytPlayer.getVideoUrl());
            return matches ? matches[1] : "";
        };

        const setResolution = (ytPlayer, resolutions) => {
            if (!ytPlayer || !ytPlayer.getPlaybackQuality) return;
            const currentQuality = ytPlayer.getPlaybackQuality();
            let res = CFG.quality.targetRes;
            if (CFG.quality.highFramerateTargetRes && foundHFR) res = CFG.quality.highFramerateTargetRes;

            const shouldPremium =
                CFG.quality.preferPremium && [...ytPlayer.getAvailableQualityData()].some(
                    (q) => q.quality === res && q.qualityLabel.includes("Premium") && q.isPlayable
                );
            const useButtons = !CFG.quality.useAPI || shouldPremium;

            if (resolutions.indexOf(res) < resolutions.indexOf(currentQuality)) {
                const end = resolutions.length - 1;
                let nextBestIndex = Math.max(resolutions.indexOf(res), 0);
                const ytResolutions = ytPlayer.getAvailableQualityLevels();
                log("Available:", ytResolutions.join(","));

                while (ytResolutions.indexOf(resolutions[nextBestIndex]) === -1 && nextBestIndex < end)
                    ++nextBestIndex;

                if (
                    !useButtons &&
                    CFG.quality.flushBuffer &&
                    currentQuality !== resolutions[nextBestIndex]
                ) {
                    const id = getVideoIDFromURL(ytPlayer);
                    if (id && id.indexOf("ERROR") === -1) {
                        const pos = ytPlayer.getCurrentTime();
                        ytPlayer.loadVideoById(id, pos, resolutions[nextBestIndex]);
                    }
                }
                res = resolutions[nextBestIndex];
            }

            if (CFG.quality.useAPI) {
                if (ytPlayer.setPlaybackQualityRange !== undefined) ytPlayer.setPlaybackQualityRange(res);
                ytPlayer.setPlaybackQuality(res);
                log("Quality (API):", res);
            }
            if (useButtons) {
                if (shouldPremium) {
                    const premiumData = [...ytPlayer.getAvailableQualityData()].find(
                        (q) => q.quality === res && q.qualityLabel.includes("Premium")
                    );
                    if (premiumData) log("Premium quality available:", premiumData.qualityLabel);
                }
                try {
                    const settingsButton = document.querySelector(".ytp-settings-button:not(#ScaleBtn)");
                    if (settingsButton) {
                        unwrapElement(settingsButton).click();
                        const qualityMenuButton = document.evaluate(
                            './/*[contains(text(),"Quality")]/ancestor-or-self::*[@class="ytp-menuitem-label"]',
                            ytPlayer,
                            null,
                            XPathResult.FIRST_ORDERED_NODE_TYPE,
                            null
                        ).singleNodeValue;
                        if (qualityMenuButton) {
                            unwrapElement(qualityMenuButton).click();
                            const qualityButton = document.evaluate(
                                './/*[contains(text(),"' +
                                HEIGHTS[resolutions.indexOf(res)] +
                                '") and not(@class)]/ancestor::*[@class="ytp-menuitem"]',
                                ytPlayer,
                                null,
                                XPathResult.FIRST_ORDERED_NODE_TYPE,
                                null
                            ).singleNodeValue;
                            if (qualityButton) {
                                unwrapElement(qualityButton).click();
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
            } else {
                let framerateUpdate = 0;
                if (CFG.quality.highFramerateTargetRes) {
                    const features = ytPlayer.getVideoData().video_quality_features;
                    if (features) {
                        const isHFR = features.includes("hfr");
                        framerateUpdate = isHFR && !foundHFR;
                        foundHFR = isHFR;
                    }
                }
                const curVid = getVideoIDFromURL(ytPlayer);
                if (curVid !== recentVideo || framerateUpdate) {
                    recentVideo = curVid;
                    setResolution(ytPlayer, resolutions);
                    const storedQuality = localStorage.getItem("yt-player-quality");
                    if (!storedQuality || storedQuality.indexOf(CFG.quality.targetRes) === -1) {
                        const tc = Date.now(),
                            te = tc + 2592000000;
                        localStorage.setItem(
                            "yt-player-quality",
                            `{"data":"${CFG.quality.targetRes}","expiration":${te},"creation":${tc}}`
                        );
                    }
                }
            }
        };

        const initQuality = () => {
            const ytPlayer =
                document.getElementById("movie_player") ||
                document.getElementsByClassName("html5-video-player")[0];
            const ytPlayerUnwrapped = unwrapElement(ytPlayer);
            if (ytPlayerUnwrapped) setResOnReady(ytPlayerUnwrapped, RESOLUTIONS);
        };

        window.addEventListener(
            "loadstart",
            (e) => {
                if (!(e.target instanceof window.HTMLMediaElement)) return;
                const ytPlayer =
                    document.getElementById("movie_player") ||
                    document.getElementsByClassName("html5-video-player")[0];
                const ytPlayerUnwrapped = unwrapElement(ytPlayer);
                if (ytPlayerUnwrapped) {
                    log("Loaded new video");
                    setResOnReady(ytPlayerUnwrapped, RESOLUTIONS);
                }
            },
            true
        );

        window.addEventListener("yt-navigate-finish", initQuality, true);
        if (document.readyState === "loading")
            document.addEventListener("DOMContentLoaded", initQuality);
        else setTimeout(initQuality, 100);
    }

    if (CFG.ui.disableAnimations) document.documentElement.setAttribute("no-anim", "");
    if (CFG.ui.hideShorts) document.documentElement.setAttribute("hide-shorts", "");

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

    log("YouTube Unified Optimizer v3.0.0 loaded");
})();
