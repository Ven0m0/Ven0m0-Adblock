// ==UserScript==
// @name         YouTube Music Complete
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @description  Consolidated YouTube Music optimizer: Opus codec preference, autopause prevention, performance fixes, lazy loading, UI enhancements
// @author       Ven0m0
// @homepageURL  https://github.com/Ven0m0/Ven0m0-Adblock
// @match        *://music.youtube.com/*
// @exclude      /^https?://\S+\.(txt|png|jpg|jpeg|gif|xml|svg|manifest|log|ini)[^\/]*$/
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

/*
CONSOLIDATED FEATURES:

1. Opus Codec Preference - Blocks AAC to force Opus (more efficient)
2. AutoPause Prevention - Prevents "Still watching?" interruptions
3. Performance Fixes - Animation disabling, smooth scrolling
4. Lazy Loading - Optimized content loading
5. UI Enhancements - Minor cosmetic improvements
*/

(() => {
  const GUARD = "__ytmusic_complete__";
  if (window[GUARD]) return;
  window[GUARD] = 1;

  // Emergency disable
  if (localStorage.getItem("disable_ytmusic_complete") === "1") {
    console.warn("[YT Music Complete]: Disabled by user");
    return;
  }

  // Promise isolation (YouTube Music hacks Promise in some browsers)
  const IsolatedPromise = (() => {
    try {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      if (document.documentElement) {
        document.documentElement.appendChild(iframe);
        const cleanPromise = iframe.contentWindow.Promise;
        document.documentElement.removeChild(iframe);
        if (cleanPromise) return cleanPromise;
      }
    } catch (_e) {
      // Ignore errors
    }
    try {
      return (async () => {})().constructor;
    } catch (_e) {}
    return Promise;
  })();

  // ═══════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════

  const CONFIG = {
    opusCodec: GM_getValue("ytm_opus_codec", true),
    preventAutoPause: GM_getValue("ytm_prevent_autopause", true),
    performanceFixes: GM_getValue("ytm_performance", true),
    lazyLoading: GM_getValue("ytm_lazy_loading", true),
    uiEnhancements: GM_getValue("ytm_ui_enhance", true)
  };

  function saveConfig() {
    GM_setValue("ytm_opus_codec", CONFIG.opusCodec);
    GM_setValue("ytm_prevent_autopause", CONFIG.preventAutoPause);
    GM_setValue("ytm_performance", CONFIG.performanceFixes);
    GM_setValue("ytm_lazy_loading", CONFIG.lazyLoading);
    GM_setValue("ytm_ui_enhance", CONFIG.uiEnhancements);
  }

  // ═══════════════════════════════════════════════════════════
  // MODULE 1: OPUS CODEC PREFERENCE
  // ═══════════════════════════════════════════════════════════

  if (CONFIG.opusCodec) {
    // Modern API
    if (window.MediaSource) {
      const originalIsTypeSupported = window.MediaSource.isTypeSupported;
      window.MediaSource.isTypeSupported = function (mime) {
        // Block AAC to force YouTube Music to use Opus
        if (typeof mime === "string" && (mime.includes("mp4a") || mime.includes("aac"))) {
          return false;
        }
        return originalIsTypeSupported.call(this, mime);
      };
    }

    // Legacy fallback
    const originalCanPlayType = window.HTMLMediaElement.prototype.canPlayType;
    window.HTMLMediaElement.prototype.canPlayType = function (mime) {
      // Block AAC to force YouTube Music to use Opus
      if (typeof mime === "string" && (mime.includes("mp4a") || mime.includes("aac"))) {
        return "";
      }
      return originalCanPlayType.call(this, mime);
    };
  }

  // ═══════════════════════════════════════════════════════════
  // MODULE 2: AUTOPAUSE PREVENTION
  // ═══════════════════════════════════════════════════════════

  const AutoPauseModule = {
    youThereDataHashMapPauseDelay: new WeakMap(),
    youThereDataHashMapPromptDelay: new WeakMap(),
    youThereDataHashMapLactThreshold: new WeakMap(),
    noDelayLogUntil: 0,

    delayLog(...args) {
      if (Date.now() < this.noDelayLogUntil) return;
      this.noDelayLogUntil = Date.now() + 280;
      console.log("[AutoPause Prevention]", ...args);
    },

    defineProp1(youThereData, key, retType, constVal, fGet, fSet, hashMap) {
      Object.defineProperty(youThereData, key, {
        enumerable: true,
        configurable: true,
        get() {
          IsolatedPromise.resolve(new Date()).then(fGet).catch(console.warn);
          const ret = constVal;
          if (retType === 2) return `${ret}`;
          return ret;
        },
        set(newValue) {
          const oldValue = hashMap.get(this);
          IsolatedPromise.resolve([oldValue, newValue, new Date()]).then(fSet).catch(console.warn);
          hashMap.set(this, newValue);
        }
      });
    },

    init() {
      const insp = (o) => (o ? o.polymerController || o.inst || o || 0 : o || 0);

      // Hook into YouTube Music's autopause mechanism
      const checkInterval = setInterval(() => {
        const player = document.querySelector("ytmusic-player");
        if (!player) return;

        const youThereData = insp(player)?.youThereData_;
        if (!youThereData) return;

        clearInterval(checkInterval);

        // Override pause delay (set to very high value)
        this.defineProp1(
          youThereData,
          "pauseDelayMs",
          1,
          86400000, // 24 hours
          () => this.delayLog("pauseDelayMs get"),
          () => this.delayLog("pauseDelayMs set (blocked)"),
          this.youThereDataHashMapPauseDelay
        );

        // Override prompt delay
        this.defineProp1(
          youThereData,
          "promptDelayMs",
          1,
          86400000,
          () => this.delayLog("promptDelayMs get"),
          () => this.delayLog("promptDelayMs set (blocked)"),
          this.youThereDataHashMapPromptDelay
        );

        // Override LACT threshold
        this.defineProp1(
          youThereData,
          "lactThresholdMs",
          1,
          86400000,
          () => this.delayLog("lactThresholdMs get"),
          () => this.delayLog("lactThresholdMs set (blocked)"),
          this.youThereDataHashMapLactThreshold
        );
      }, 500);

      // Clear interval after 30 seconds if player not found
      setTimeout(() => clearInterval(checkInterval), 30000);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // MODULE 3: PERFORMANCE FIXES
  // ═══════════════════════════════════════════════════════════

  if (CONFIG.performanceFixes) {
    GM_addStyle(`
      /* Disable animations for better performance */
      * {
        animation-duration: 0.001ms !important;
        animation-delay: 0.001ms !important;
        transition-duration: 0.001ms !important;
        transition-delay: 0.001ms !important;
      }

      /* Smooth scrolling */
      html {
        scroll-behavior: smooth;
      }

      /* Optimize rendering */
      ytmusic-app {
        will-change: auto !important;
      }
    `);
  }

  // ═══════════════════════════════════════════════════════════
  // MODULE 4: LAZY LOADING OPTIMIZATION
  // ═══════════════════════════════════════════════════════════

  const LazyLoadingModule = {
    init() {
      if (!CONFIG.lazyLoading) return;

      // Use Intersection Observer for lazy loading images/content
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const img = entry.target;
              if (img.dataset.src) {
                img.src = img.dataset.src;
                delete img.dataset.src;
                observer.unobserve(img);
              }
            }
          });
        },
        { rootMargin: "50px" }
      );

      // Observe thumbnails
      const observeImages = () => {
        document.querySelectorAll("img[data-src]").forEach((img) => {
          observer.observe(img);
        });
      };

      // Initial observation
      if (document.readyState === "complete") {
        observeImages();
      } else {
        window.addEventListener("load", observeImages);
      }

      const queuedNodes = new Set();
      let isScheduled = false;

      const processQueuedNodes = () => {
        isScheduled = false;
        const nodesToProcess = Array.from(queuedNodes);
        queuedNodes.clear();

        // Deduplicate: Remove nodes that are descendants of other nodes in the queue
        const rootNodes = nodesToProcess.filter(
          (node) => !nodesToProcess.some((otherNode) => otherNode !== node && otherNode.contains(node))
        );

        rootNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === "IMG" && node.dataset.src) {
              observer.observe(node);
            }
            node.querySelectorAll("img[data-src]").forEach((img) => {
              observer.observe(img);
            });
          }
        });
      };

      // Observe dynamic content efficiently
      new MutationObserver((mutations) => {
        let hasNewNodes = false;
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              queuedNodes.add(node);
              hasNewNodes = true;
            }
          }
        }

        if (hasNewNodes && !isScheduled) {
          isScheduled = true;
          requestAnimationFrame(processQueuedNodes);
        }
      }).observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  };

  // ═══════════════════════════════════════════════════════════
  // MODULE 5: UI ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════

  if (CONFIG.uiEnhancements) {
    GM_addStyle(`
      /* Better font rendering */
      body {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      /* Improved player controls visibility */
      ytmusic-player-bar {
        backdrop-filter: blur(10px);
      }
    `);
  }

  // ═══════════════════════════════════════════════════════════
  // SETTINGS UI
  // ═══════════════════════════════════════════════════════════

  function createSettingsPanel() {
    if (document.getElementById("ytm-complete-settings")) return;
    const panel = document.createElement("div");
    panel.id = "ytm-complete-settings";
    Object.assign(panel.style, {
      position: "fixed",
      top: "10px",
      right: "10px",
      background: "rgba(0,0,0,0.95)",
      color: "#fff",
      padding: "15px",
      borderRadius: "8px",
      zIndex: "9999",
      fontSize: "13px",
      minWidth: "250px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
    });

    // Built with DOM APIs: innerHTML can be rejected by YouTube's Trusted Types policy
    const el = (tag, props, css = "") => {
      const node = document.createElement(tag);
      Object.assign(node, props);
      node.style.cssText = css;
      return node;
    };
    const toggles = [
      ["ytm-opus", "opusCodec", "Opus Codec Preference"],
      ["ytm-autopause", "preventAutoPause", "Prevent AutoPause"],
      ["ytm-perf", "performanceFixes", "Performance Fixes"],
      ["ytm-lazy", "lazyLoading", "Lazy Loading"],
      ["ytm-ui", "uiEnhancements", "UI Enhancements"]
    ];

    panel.appendChild(el("h3", { textContent: "YouTube Music Complete" }, "margin:0 0 10px 0;font-size:15px;"));
    const boxes = toggles.map(([id, key, text]) => {
      const label = el("label", {}, "display:block;margin:5px 0;");
      const box = el("input", { type: "checkbox", id, checked: CONFIG[key] });
      label.append(box, el("span", { textContent: ` ${text}` }));
      panel.appendChild(label);
      return [key, box];
    });

    const buttonCss = "color:#fff;border:none;border-radius:4px;cursor:pointer;";
    const save = el(
      "button",
      { id: "ytm-save", textContent: "Save & Reload" },
      `flex:1;padding:6px;background:#1db954;${buttonCss}`
    );
    const close = el(
      "button",
      { id: "ytm-close", textContent: "Close" },
      `padding:6px 12px;background:#333;${buttonCss}`
    );
    const buttons = el("div", {}, "margin-top:10px;display:flex;gap:10px;");
    buttons.append(save, close);
    panel.appendChild(buttons);

    document.body.appendChild(panel);

    save.onclick = () => {
      for (const [key, box] of boxes) CONFIG[key] = box.checked;
      saveConfig();
      window.location.reload();
    };
    close.onclick = () => panel.remove();
  }

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════

  // Register menu command
  GM_registerMenuCommand("YouTube Music Complete Settings", createSettingsPanel);

  // Wait for page load to initialize DOM-dependent modules
  window.addEventListener("load", () => {
    // Module 2: AutoPause Prevention
    if (CONFIG.preventAutoPause) {
      AutoPauseModule.init();
    }

    // Module 4: Lazy Loading
    LazyLoadingModule.init();
  });

  console.info(
    "[YT Music Complete] Initialized (5 modules, Opus codec:",
    CONFIG.opusCodec,
    ", Prevent autopause:",
    CONFIG.preventAutoPause,
    ")"
  );
})();
