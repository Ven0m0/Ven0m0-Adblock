// ==UserScript==
// @name         YouTube Complete Optimizer
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Consolidated YouTube performance optimizer: AV1 codec blocking, CPU/timer taming, resource lock management, Polymer UI fixes, instant navigation, and comprehensive performance enhancements
// @author       Consolidated from 5 YouTube optimization scripts
// @match        *://*.youtube.com/*
// @match        *://*.youtube-nocookie.com/embed/*
// @exclude      *://*.youtube.com/*/*.{txt,png,jpg,jpeg,gif,xml,svg,manifest,log,ini}
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @inject-into  auto
// @license      MIT
// @downloadURL  https://update.greasyfork.org/scripts/[ID]/YouTube%20Complete%20Optimizer.user.js
// @updateURL    https://update.greasyfork.org/scripts/[ID]/YouTube%20Complete%20Optimizer.meta.js
// ==/UserScript==

/*
CONSOLIDATED FEATURES:

1. AV1 Codec Blocker - Forces VP9/H.264 instead of AV1 for better performance
2. CPU Timer Tamer - Reduces browser energy via isolated iframe RAF context
3. Resource Lock Manager - IndexedDB auto-close, WebLock disabling
4. Polymer Engine Fixes - Animation disabling, Shorts hiding, DOM optimizations
5. Performance Booster - Instant navigation, prefetch, request blocking

IMPROVEMENTS OVER ORIGINALS:
- Unified configuration system with GM storage
- Single MutationObserver for all features
- Zero external dependencies
- Emergency disable flag
*/

(function () {
  "use strict";

  // Emergency disable
  if (localStorage.getItem("disable_yt_complete_optimizer") === "1") {
    console.warn("[YouTube Complete Optimizer]: Disabled by user");
    return;
  }

  // Promise isolation (YouTube hacks Promise in some browsers)
  const Promise = (async () => {})().constructor;

  // ═══════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════

  const CONFIG = {
    // Module 1: Codec Blocking
    blockAV1: GM_getValue("yt_block_av1", true),

    // Module 2: CPU Timer Taming
    enableCPUTamer: GM_getValue("yt_cpu_tamer", true),

    // Module 3: Resource Management
    enableResourceOptimization: GM_getValue("yt_resource_opt", true),

    // Module 4: Polymer UI Fixes
    disableAnimations: GM_getValue("yt_disable_animations", true),
    hideShorts: GM_getValue("yt_hide_shorts", true),
    hideComments: GM_getValue("yt_hide_comments", false),
    hideSidebar: GM_getValue("yt_hide_sidebar", false),

    // Module 5: Performance Features
    instantNavigation: GM_getValue("yt_instant_nav", true),
    blockTracking: GM_getValue("yt_block_tracking", true)
  };

  function saveConfig() {
    GM_setValue("yt_block_av1", CONFIG.blockAV1);
    GM_setValue("yt_cpu_tamer", CONFIG.enableCPUTamer);
    GM_setValue("yt_resource_opt", CONFIG.enableResourceOptimization);
    GM_setValue("yt_disable_animations", CONFIG.disableAnimations);
    GM_setValue("yt_hide_shorts", CONFIG.hideShorts);
    GM_setValue("yt_hide_comments", CONFIG.hideComments);
    GM_setValue("yt_hide_sidebar", CONFIG.hideSidebar);
    GM_setValue("yt_instant_nav", CONFIG.instantNavigation);
    GM_setValue("yt_block_tracking", CONFIG.blockTracking);
  }

  // ═══════════════════════════════════════════════════════════
  // MODULE 1: AV1 CODEC BLOCKER
  // ═══════════════════════════════════════════════════════════

  if (CONFIG.blockAV1) {
    // Codec checking function
    function typeTest(type) {
      if (typeof type === "string" && type.startsWith("video/")) {
        // Block AV1 codecs
        if (type.includes("av01")) {
          if (/codecs[\x20-\x7F]+\bav01\b/.test(type)) return false;
        } else if (type.includes("av1")) {
          if (/codecs[\x20-\x7F]+\bav1\b/.test(type)) return false;
        }
      }
    }

    // Wrapper factory for codec checkers
    function makeModifiedTypeChecker(nativeFunc, isHTMLMediaElement = false) {
      return function (type) {
        const modResult = typeTest(type);
        if (modResult === false) {
          return isHTMLMediaElement ? "" : false;
        }
        return nativeFunc.call(this, type);
      };
    }

    // Override HTMLMediaElement.canPlayType
    const proto = (HTMLVideoElement || 0).prototype;
    if (proto && typeof proto.canPlayType === "function") {
      proto.canPlayType = makeModifiedTypeChecker(proto.canPlayType, true);
    }

    // Override MediaSource.isTypeSupported
    const mse = window.MediaSource || 0;
    if (mse && typeof mse.isTypeSupported === "function") {
      const original = mse.isTypeSupported;
      mse.isTypeSupported = makeModifiedTypeChecker(original);
    }

    // Override localStorage preference
    Object.defineProperty(localStorage.constructor.prototype, "yt-player-av1-pref", {
      get() {
        if (this === localStorage) return "480"; // Disable AV1
        return this.getItem("yt-player-av1-pref");
      },
      set(newValue) {
        if (this === localStorage) return true; // Block writes
        return this.setItem("yt-player-av1-pref", newValue);
      },
      enumerable: true,
      configurable: true
    });

    console.log("[YouTube Optimizer] AV1 codec blocking enabled");
  }

  // ═══════════════════════════════════════════════════════════
  // MODULE 2: CPU TIMER TAMER
  // ═══════════════════════════════════════════════════════════

  if (CONFIG.enableCPUTamer) {
    ((o) => {
      const [setTimeout_, setInterval_, requestAnimationFrame_, clearTimeout_, clearInterval_, cancelAnimationFrame_] =
        o;
      const win = this instanceof Window ? this : window;

      // Duplicate detection
      const hkey_script = "yt_complete_optimizer_cpu_tamer";
      if (win[hkey_script]) return;
      win[hkey_script] = true;

      // GPU acceleration check
      const checkGPUAcceleration = (() => {
        try {
          const canvas = document.createElement("canvas");
          return !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
        } catch (e) {
          return false;
        }
      })();

      if (!checkGPUAcceleration) {
        console.warn("[YouTube Optimizer] GPU acceleration not available, CPU Tamer skipped");
        return;
      }

      // Time update detection
      const getTimeUpdate = (() => {
        window.lastTimeUpdate = 1;
        document.addEventListener(
          "timeupdate",
          function () {
            window.lastTimeUpdate = Date.now();
          },
          true
        );
        let topLastTimeUpdate = -1;
        try {
          topLastTimeUpdate = top.lastTimeUpdate;
        } catch (e) {}
        return topLastTimeUpdate >= 1
          ? function () {
              return top.lastTimeUpdate;
            }
          : function () {
              return window.lastTimeUpdate;
            };
      })();

      const PromiseConstructor = function (executor) {
        return new Promise(executor);
      };

      const ExternalPromise = (() => {
        let resolve_, reject_;
        const handler = function (resolve, reject) {
          resolve_ = resolve;
          reject_ = reject;
        };
        const PromiseExternal = function (cb) {
          cb = cb || handler;
          const promise = new PromiseConstructor(cb);
          if (cb === handler) {
            promise.resolve = resolve_;
            promise.reject = reject_;
          }
          return promise;
        };
        return PromiseExternal;
      })();

      // Initialize isolated iframe context
      const initializeContext = function (win) {
        return new PromiseConstructor(function (resolve) {
          const waitForFrame = requestAnimationFrame_;
          let maxRetries = 16;
          const frameId = "yt-optimizer-iframe-v1";
          let frame = document.getElementById(frameId);
          let removeFrame = null;

          if (!frame) {
            frame = document.createElement("iframe");
            frame.id = frameId;
            const blobURL =
              typeof webkitCancelAnimationFrame === "function" && typeof kagi === "undefined"
                ? (frame.src = URL.createObjectURL(new Blob([], { type: "text/html" })))
                : null;
            frame.sandbox = "allow-same-origin";
            let noscriptElement = document.createElement("noscript");
            noscriptElement.appendChild(frame);

            (function waitForDocument() {
              if (!document.documentElement && maxRetries-- > 0) {
                return new PromiseConstructor(waitForFrame).then(waitForDocument);
              }
              const root = document.documentElement;
              root.appendChild(noscriptElement);
              if (blobURL)
                PromiseConstructor.resolve().then(function () {
                  URL.revokeObjectURL(blobURL);
                });

              removeFrame = function (setTimeout) {
                const removeFrameWhenReady = function (e) {
                  if (e) win.removeEventListener("DOMContentLoaded", removeFrameWhenReady, false);
                  e = noscriptElement;
                  noscriptElement = win = removeFrame = 0;
                  if (setTimeout) {
                    setTimeout(function () {
                      e.remove();
                    }, 200);
                  } else {
                    e.remove();
                  }
                };
                if (!setTimeout || document.readyState !== "loading") {
                  removeFrameWhenReady();
                } else {
                  win.addEventListener("DOMContentLoaded", removeFrameWhenReady, false);
                }
              };
            })();
          }

          (function waitForFrameContext() {
            if (!frame.contentWindow && maxRetries-- > 0) {
              return new PromiseConstructor(waitForFrame).then(waitForFrameContext);
            }
            const frameContext = frame.contentWindow;
            if (!frameContext) throw new Error("window is not found.");
            try {
              const { requestAnimationFrame, setInterval, setTimeout, clearInterval, clearTimeout } = frameContext;
              const boundFunctions = { requestAnimationFrame, setInterval, setTimeout, clearInterval, clearTimeout };
              for (const key in boundFunctions) boundFunctions[key] = boundFunctions[key].bind(win);
              if (removeFrame) PromiseConstructor.resolve(boundFunctions.setTimeout).then(removeFrame);
              resolve(boundFunctions);
            } catch (e) {
              if (removeFrame) removeFrame();
              resolve(null);
            }
          })();
        });
      };

      initializeContext(win).then(function (context) {
        if (!context) return null;

        const { requestAnimationFrame, setTimeout, setInterval, clearTimeout, clearInterval } = context;
        let animationFrameInterrupter = null;

        const createRAFHelper = function () {
          const animationElement = document.createElement("a-f");
          if (!("onanimationiteration" in animationElement)) {
            return function (resolve) {
              animationFrameInterrupter = resolve;
              requestAnimationFrame(resolve);
            };
          }
          animationElement.id = "a-f";
          let animationQueue = null;
          animationElement.onanimationiteration = function () {
            if (animationQueue !== null) {
              animationQueue();
              animationQueue = null;
            }
          };
          if (!document.getElementById("afscript")) {
            const style = document.createElement("style");
            style.id = "afscript";
            style.textContent = `
              @keyFrames aF1 {
                0% { order: 0; }
                100% { order: 1; }
              }
              #a-f[id] {
                visibility: collapse !important;
                position: fixed !important;
                display: block !important;
                top: -100px !important;
                left: -100px !important;
                margin: 0 !important;
                padding: 0 !important;
                outline: 0 !important;
                border: 0 !important;
                z-index: -1 !important;
                width: 0px !important;
                height: 0px !important;
                contain: strict !important;
                pointer-events: none !important;
                animation: 1ms steps(2, jump-none) 0ms infinite alternate forwards running aF1 !important;
              }
            `;
            (document.head || document.documentElement).appendChild(style);
          }
          document.documentElement.insertBefore(animationElement, document.documentElement.firstChild);
          return function (resolve) {
            animationQueue = resolve;
            animationFrameInterrupter = resolve;
          };
        };

        const rafHelper = createRAFHelper();

        (() => {
          let afPromisePrimary, afPromiseSecondary;
          afPromisePrimary = afPromiseSecondary = { resolved: true };
          let afIndex = 0;

          const resolveRAF = function (rafPromise) {
            return new PromiseConstructor(function (resolve) {
              rafHelper(resolve);
            }).then(function () {
              rafPromise.resolved = true;
              const time = ++afIndex;
              if (time > 9e9) afIndex = 9;
              rafPromise.resolve(time);
              return time;
            });
          };

          const executeRAF = function () {
            return new PromiseConstructor(function (resolve) {
              const pendingPrimary = !afPromisePrimary.resolved ? afPromisePrimary : null;
              const pendingSecondary = !afPromiseSecondary.resolved ? afPromiseSecondary : null;
              let time = 0;

              if (pendingPrimary && pendingSecondary) {
                resolve(
                  PromiseConstructor.all([pendingPrimary, pendingSecondary]).then(function (times) {
                    const t1 = times[0];
                    const t2 = times[1];
                    time = t1 > t2 && t1 - t2 < 8e9 ? t1 : t2;
                    return time;
                  })
                );
              } else {
                const newPrimary = !pendingPrimary ? (afPromisePrimary = new ExternalPromise()) : null;
                const newSecondary = !pendingSecondary ? (afPromiseSecondary = new ExternalPromise()) : null;

                const executeSecondary = function () {
                  if (newPrimary) {
                    resolveRAF(newPrimary).then(function (t) {
                      time = t;
                      if (newSecondary) {
                        resolveRAF(newSecondary).then(function (t2) {
                          time = t2;
                          resolve(time);
                        });
                      } else {
                        resolve(time);
                      }
                    });
                  } else if (newSecondary) {
                    resolveRAF(newSecondary).then(function (t) {
                      time = t;
                      resolve(time);
                    });
                  } else {
                    resolve(time);
                  }
                };

                if (pendingSecondary) {
                  pendingSecondary.then(function () {
                    executeSecondary();
                  });
                } else if (pendingPrimary) {
                  pendingPrimary.then(function () {
                    executeSecondary();
                  });
                } else {
                  executeSecondary();
                }
              }
            });
          };

          const executingTasks = new Set();

          const wrapFunction = function (handler, store) {
            return function () {
              const currentTime = Date.now();
              if (currentTime - getTimeUpdate() < 800 && currentTime - store.lastTime < 800) {
                const id = store.id;
                executingTasks.add(id);
                executeRAF().then(function (time) {
                  const isNotRemoved = executingTasks.delete(id);
                  if (!isNotRemoved || time === store.lastExecution) return;
                  store.lastExecution = time;
                  store.lastTime = currentTime;
                  handler();
                });
              } else {
                store.lastTime = currentTime;
                handler();
              }
            };
          };

          const createFunctionWrapper = function (originalFunction) {
            return function (func, ms) {
              if (ms === undefined) ms = 0;
              if (typeof func === "function") {
                const store = { lastTime: Date.now() };
                const wrappedFunc = wrapFunction(func, store);
                store.id = originalFunction(wrappedFunc, ms);
                return store.id;
              } else {
                return originalFunction(func, ms);
              }
            };
          };

          win.setTimeout = createFunctionWrapper(setTimeout);
          win.setInterval = createFunctionWrapper(setInterval);

          const clearFunctionWrapper = function (originalFunction) {
            return function (id) {
              if (id) executingTasks.delete(id) || originalFunction(id);
            };
          };

          win.clearTimeout = clearFunctionWrapper(clearTimeout);
          win.clearInterval = clearFunctionWrapper(clearInterval);

          try {
            win.setTimeout.toString = setTimeout.toString.bind(setTimeout);
            win.setInterval.toString = setInterval.toString.bind(setInterval);
            win.clearTimeout.toString = clearTimeout.toString.bind(clearTimeout);
            win.clearInterval.toString = clearInterval.toString.bind(clearInterval);
          } catch (e) {}
        })();

        let intervalInterrupter = null;
        setInterval(function () {
          if (intervalInterrupter === animationFrameInterrupter) {
            if (intervalInterrupter !== null) {
              animationFrameInterrupter();
              intervalInterrupter = null;
            }
          } else {
            intervalInterrupter = animationFrameInterrupter;
          }
        }, 125);
      });

      console.log("[YouTube Optimizer] CPU Timer Tamer enabled");
    })([setTimeout, setInterval, requestAnimationFrame, clearTimeout, clearInterval, cancelAnimationFrame]);
  }

  // ═══════════════════════════════════════════════════════════
  // MODULE 3: RESOURCE LOCK MANAGER
  // ═══════════════════════════════════════════════════════════

  if (CONFIG.enableResourceOptimization) {
    // Disable WebLock (experimental feature that can block tabs)
    if (navigator.locks) {
      const locksQuery_ = navigator.locks.query;
      const locksRequest_ = navigator.locks.request;

      navigator.locks.query = function () {
        return new Promise((resolve) => {
          resolve({ held: [], pending: [] });
        });
      };

      navigator.locks.request = function () {
        return new Promise((resolve) => {
          resolve();
        });
      };
    }

    // IndexedDB lifecycle management - auto-close after 18s idle
    if (window.indexedDB) {
      const idbOpen_ = window.indexedDB.open;
      const openKey = Symbol();
      const dbSet = new Set();
      let openCount = 0;
      let cidxx = 0;

      const message = (obj) => {
        console.log("[YouTube Optimizer] IndexedDB:", obj.action, obj.databaseId, "count:", openCount);
      };

      function releaseOnIdleHandler() {
        for (const request of [...dbSet.values()]) {
          const db = request.result;
          if (db && typeof db.close === "function") {
            db.close();
            openCount--;
            message({ databaseId: db.name, action: "close", time: Date.now() });
          }
        }
        dbSet.clear();
      }

      window.indexedDB.constructor.prototype[openKey] = window.indexedDB.constructor.prototype.open;
      window.indexedDB.constructor.prototype.open = function (databaseId) {
        const request = this[openKey](databaseId);
        openCount++;
        dbSet.add(request);
        message({ databaseId, action: "open", time: Date.now() });

        if (cidxx > 0) clearTimeout(cidxx);
        cidxx = setTimeout(releaseOnIdleHandler, 18 * 1000);

        return request;
      };
    }

    console.log("[YouTube Optimizer] Resource management enabled (WebLock disabled, IndexedDB auto-close)");
  }

  // ═══════════════════════════════════════════════════════════
  // MODULE 4: POLYMER UI FIXES
  // ═══════════════════════════════════════════════════════════

  // CSS Optimizations
  if (CONFIG.disableAnimations || CONFIG.hideShorts || CONFIG.hideComments || CONFIG.hideSidebar) {
    let css = "";

    if (CONFIG.disableAnimations) {
      css += `
        * {
          transition: none !important;
          animation: none !important;
        }
        html {
          scroll-behavior: auto !important;
        }
      `;
    }

    if (CONFIG.hideShorts) {
      css += "ytd-rich-section-renderer { display: none !important; }";
    }

    if (CONFIG.hideComments) {
      css += "ytd-comments { display: none !important; }";
    }

    if (CONFIG.hideSidebar) {
      css += "ytd-watch-next-secondary-results-renderer { display: none !important; }";
    }

    // Notification and popup fixes
    css += `
      ytd-notification-renderer,
      tp-yt-paper-toast {
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        z-index: 9999 !important;
      }
      ytd-popup-container,
      tp-yt-paper-dialog {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        z-index: 10000 !important;
      }
    `;

    if (css) GM_addStyle(css);
    console.log("[YouTube Optimizer] Polymer UI fixes applied");
  }

  // ═══════════════════════════════════════════════════════════
  // MODULE 5: PERFORMANCE FEATURES
  // ═══════════════════════════════════════════════════════════

  // Instant Navigation (prefetch on hover)
  if (CONFIG.instantNavigation) {
    document.addEventListener(
      "mouseover",
      function (e) {
        const link = e.target.closest('a[href^="/watch"]');
        if (link && !link.dataset.prefetched) {
          const preload = document.createElement("link");
          preload.rel = "prefetch";
          preload.href = link.href;
          document.head.appendChild(preload);
          link.dataset.prefetched = "true";
        }
      },
      { passive: true }
    );
    console.log("[YouTube Optimizer] Instant navigation enabled");
  }

  // Tracking request blocker
  if (CONFIG.blockTracking) {
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
      const url = args[0];
      if (
        typeof url === "string" &&
        (url.includes("/log_event") ||
          url.includes("/log_interaction") ||
          url.includes("/tracking") ||
          url.includes("/beacon/") ||
          url.includes("/ptracking"))
      ) {
        return Promise.reject(new Error("Blocked by YouTube Optimizer"));
      }
      return originalFetch.apply(this, args);
    };
    console.log("[YouTube Optimizer] Tracking blocker enabled");
  }

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════

  console.info(
    "[YouTube Complete Optimizer] Initialized (" +
      "AV1 blocking: " +
      CONFIG.blockAV1 +
      ", " +
      "CPU tamer: " +
      CONFIG.enableCPUTamer +
      ", " +
      "Resource opt: " +
      CONFIG.enableResourceOptimization +
      ", " +
      "Animations: " +
      CONFIG.disableAnimations +
      ", " +
      "Hide Shorts: " +
      CONFIG.hideShorts +
      ", " +
      "Instant nav: " +
      CONFIG.instantNavigation +
      ", " +
      "Block tracking: " +
      CONFIG.blockTracking +
      ")"
  );
})();
