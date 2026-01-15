// ==UserScript==
// @name         YouTube Music Complete
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Consolidated YouTube Music optimizer: Opus codec preference, auto audio-only mode, autopause prevention, performance fixes, lazy loading, UI enhancements
// @author       Consolidated from 7 YouTube Music scripts
// @match        *://music.youtube.com/*
// @exclude      /^https?://\S+\.(txt|png|jpg|jpeg|gif|xml|svg|manifest|log|ini)[^\/]*$/
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @license      MIT
// @inject-into  page
// @downloadURL  https://update.greasyfork.org/scripts/[ID]/YouTube%20Music%20Complete.user.js
// @updateURL    https://update.greasyfork.org/scripts/[ID]/YouTube%20Music%20Complete.meta.js
// ==/UserScript==

/*
CONSOLIDATED FEATURES:

1. Opus Codec Preference - Blocks AAC to force Opus (more efficient)
2. Auto Audio-Only Mode - Automatically switches to audio mode to save bandwidth
3. AutoPause Prevention - Prevents "Still watching?" interruptions
4. Performance Fixes - Animation disabling, smooth scrolling
5. Lazy Loading - Optimized content loading
6. New Releases Fixer - Fixes layout issues in New Releases section
7. UI Enhancements - Minor cosmetic improvements
*/

(function () {
  "use strict";

  // Emergency disable
  if (localStorage.getItem("disable_ytmusic_complete") === "1") {
    console.warn("[YT Music Complete]: Disabled by user");
    return;
  }

  // Promise isolation (YouTube Music hacks Promise in some browsers)
  const Promise = (async () => {})().constructor;

  // ═══════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════

  const CONFIG = {
    opusCodec: GM_getValue("ytm_opus_codec", true),
    autoAudioMode: GM_getValue("ytm_auto_audio", true),
    preventAutoPause: GM_getValue("ytm_prevent_autopause", true),
    performanceFixes: GM_getValue("ytm_performance", true),
    lazyLoading: GM_getValue("ytm_lazy_loading", true),
    fixNewReleases: GM_getValue("ytm_fix_releases", true),
    uiEnhancements: GM_getValue("ytm_ui_enhance", true)
  };

  function saveConfig() {
    GM_setValue("ytm_opus_codec", CONFIG.opusCodec);
    GM_setValue("ytm_auto_audio", CONFIG.autoAudioMode);
    GM_setValue("ytm_prevent_autopause", CONFIG.preventAutoPause);
    GM_setValue("ytm_performance", CONFIG.performanceFixes);
    GM_setValue("ytm_lazy_loading", CONFIG.lazyLoading);
    GM_setValue("ytm_fix_releases", CONFIG.fixNewReleases);
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
  // MODULE 2: AUTO AUDIO-ONLY MODE
  // ═══════════════════════════════════════════════════════════

  const AutoAudioModule = {
    intervalId: null,

    switchToAudio() {
      try {
        const toggle = document.querySelector('ytmusic-av-toggle[class="style-scope ytmusic-player-page"]');
        if (toggle && toggle.getAttribute("playback-mode") === "OMV_PREFERRED") {
          const button = document.querySelector(".song-button.style-scope.ytmusic-av-toggle");
          if (button) button.click();
        }
      } catch (e) {
        // Silently fail if elements not found
      }
    },

    start() {
      this.switchToAudio();
      this.intervalId = setInterval(() => this.switchToAudio(), 10000);
    },

    stop() {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }
  };

  // ═══════════════════════════════════════════════════════════
  // MODULE 3: AUTOPAUSE PREVENTION
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
          Promise.resolve(new Date()).then(fGet).catch(console.warn);
          const ret = constVal;
          if (retType === 2) return `${ret}`;
          return ret;
        },
        set(newValue) {
          const oldValue = hashMap.get(this);
          Promise.resolve([oldValue, newValue, new Date()]).then(fSet).catch(console.warn);
          hashMap.set(this, newValue);
          return true;
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
  // MODULE 4: PERFORMANCE FIXES
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
  // MODULE 5: LAZY LOADING OPTIMIZATION
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
        document.querySelectorAll("img[data-src]").forEach((img) => observer.observe(img));
      };

      // Initial observation
      if (document.readyState === "complete") {
        observeImages();
      } else {
        window.addEventListener("load", observeImages);
      }

      // Observe dynamic content
      new MutationObserver(observeImages).observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  };

  // ═══════════════════════════════════════════════════════════
  // MODULE 6: NEW RELEASES FIXER
  // ═══════════════════════════════════════════════════════════

  if (CONFIG.fixNewReleases) {
    GM_addStyle(`
      /* Fix New Releases section layout */
      ytmusic-carousel-shelf-renderer[system-id="new-releases"] {
        display: block !important;
      }

      ytmusic-carousel-shelf-renderer[system-id="new-releases"] .carousel {
        display: flex !important;
        overflow-x: auto !important;
      }

      ytmusic-carousel-shelf-renderer[system-id="new-releases"] .carousel-item {
        flex: 0 0 auto !important;
      }
    `);
  }

  // ═══════════════════════════════════════════════════════════
  // MODULE 7: UI ENHANCEMENTS
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

    panel.innerHTML = `
      <h3 style="margin:0 0 10px 0;font-size:15px;">YouTube Music Complete</h3>
      <label style="display:block;margin:5px 0;">
        <input type="checkbox" id="ytm-opus" ${CONFIG.opusCodec ? "checked" : ""}>
        Opus Codec Preference
      </label>
      <label style="display:block;margin:5px 0;">
        <input type="checkbox" id="ytm-audio" ${CONFIG.autoAudioMode ? "checked" : ""}>
        Auto Audio-Only Mode
      </label>
      <label style="display:block;margin:5px 0;">
        <input type="checkbox" id="ytm-autopause" ${CONFIG.preventAutoPause ? "checked" : ""}>
        Prevent AutoPause
      </label>
      <label style="display:block;margin:5px 0;">
        <input type="checkbox" id="ytm-perf" ${CONFIG.performanceFixes ? "checked" : ""}>
        Performance Fixes
      </label>
      <label style="display:block;margin:5px 0;">
        <input type="checkbox" id="ytm-lazy" ${CONFIG.lazyLoading ? "checked" : ""}>
        Lazy Loading
      </label>
      <label style="display:block;margin:5px 0;">
        <input type="checkbox" id="ytm-releases" ${CONFIG.fixNewReleases ? "checked" : ""}>
        Fix New Releases
      </label>
      <label style="display:block;margin:5px 0;">
        <input type="checkbox" id="ytm-ui" ${CONFIG.uiEnhancements ? "checked" : ""}>
        UI Enhancements
      </label>
      <div style="margin-top:10px;display:flex;gap:10px;">
        <button id="ytm-save" style="flex:1;padding:6px;background:#1db954;color:#fff;border:none;border-radius:4px;cursor:pointer;">Save & Reload</button>
        <button id="ytm-close" style="padding:6px 12px;background:#333;color:#fff;border:none;border-radius:4px;cursor:pointer;">Close</button>
      </div>
    `;

    document.body.appendChild(panel);

    document.getElementById("ytm-save").onclick = () => {
      CONFIG.opusCodec = document.getElementById("ytm-opus").checked;
      CONFIG.autoAudioMode = document.getElementById("ytm-audio").checked;
      CONFIG.preventAutoPause = document.getElementById("ytm-autopause").checked;
      CONFIG.performanceFixes = document.getElementById("ytm-perf").checked;
      CONFIG.lazyLoading = document.getElementById("ytm-lazy").checked;
      CONFIG.fixNewReleases = document.getElementById("ytm-releases").checked;
      CONFIG.uiEnhancements = document.getElementById("ytm-ui").checked;
      saveConfig();
      window.location.reload();
    };

    document.getElementById("ytm-close").onclick = () => {
      panel.remove();
    };
  }

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════

  // Register menu command
  GM_registerMenuCommand("YouTube Music Complete Settings", createSettingsPanel);

  // Wait for page load to initialize DOM-dependent modules
  window.addEventListener("load", () => {
    // Module 2: Auto Audio-Only Mode
    if (CONFIG.autoAudioMode) {
      AutoAudioModule.start();
    }

    // Module 3: AutoPause Prevention
    if (CONFIG.preventAutoPause) {
      AutoPauseModule.init();
    }

    // Module 5: Lazy Loading
    LazyLoadingModule.init();
  });

  console.info(
    "[YT Music Complete] Initialized (7 modules, Opus codec:",
    CONFIG.opusCodec,
    ", Auto audio:",
    CONFIG.autoAudioMode,
    ", Prevent autopause:",
    CONFIG.preventAutoPause,
    ")"
  );
})();
