// ==UserScript==
// @name         YouTube Web Tweaks Lite
// @version      1.5.6
// @description  This script is based on YouTube Web Tweaks (except it keeps most stuff including shorts player)
// @author       Magma_Craft
// @license MIT
// @match        *://www.youtube.com/*
// @namespace    https://greasyfork.org/en/users/933798
// @icon         https://www.youtube.com/favicon.ico
// @unwrap
// @run-at       document-start
// @unwrap
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/466374/YouTube%20Web%20Tweaks%20Lite.user.js
// @updateURL https://update.greasyfork.org/scripts/466374/YouTube%20Web%20Tweaks%20Lite.meta.js
// ==/UserScript==

// Enable strict mode to catch common coding mistakes

// Define the flags to assign to the EXPERIMENT_FLAGS object

const flagsToAssign = {
  desktop_delay_player_resizing: false,
  DISABLE_YT_IMG_DELAY_LOADING: true,
  web_animated_actions: false,
  web_animated_like: false,
  web_animated_like_lazy_load: false,
  web_animated_actions_v2: false,
  render_unicode_emojis_as_small_images: true,
  smartimation_background: false,
  kevlar_refresh_on_theme_change: false,
  // Disable cinematics (aka ambient lighting)
  kevlar_measure_ambient_mode_idle: false,
  kevlar_watch_cinematics_invisible: false,
  web_cinematic_theater_mode: false,
  web_cinematic_fullscreen: false,
  enable_cinematic_blur_desktop_loading: false,
  kevlar_watch_cinematics: false,
  web_cinematic_masthead: false,
  web_watch_cinematics_preferred_reduced_motion_default_disabled: false
};

const updateFlags = () => {
  // Check if the EXPERIMENT_FLAGS object exists in the window.yt.config_ property chain
  const expFlags = window?.yt?.config_?.EXPERIMENT_FLAGS;

  // If EXPERIMENT_FLAGS is not found, exit the function
  if (!expFlags) return;

  // Assign the defined flags to the EXPERIMENT_FLAGS object
  Object.assign(expFlags, flagsToAssign);
};

// Create a MutationObserver that calls the updateFlags function when changes occur in the document's subtree
const mutationObserver = new MutationObserver(updateFlags);
mutationObserver.observe(document, { subtree: true, childList: true });

(() => {
  const css = `
/* Remove filter categories on search results and playlists to make the UI less usable on low-entry machines */
ytd-item-section-renderer.style-scope.ytd-section-list-renderer[page-subtype="playlist"] > #header.ytd-item-section-renderer > ytd-feed-filter-chip-bar-renderer {
display: none !important;
}

div#chip-bar.style-scope.ytd-search-header-renderer > yt-chip-cloud-renderer.style-scope.ytd-search-header-renderer > div#container.style-scope.yt-chip-cloud-renderer {
display: none !important;
}

/* Remove (almost) all annoyances (excludes 'YT TV and Premium' banners) */
ytd-action-companion-ad-renderer, ytd-display-ad-renderer, ytd-video-masthead-ad-advertiser-info-renderer, ytd-video-masthead-ad-primary-video-renderer, ytd-in-feed-ad-layout-renderer, ytd-ad-slot-renderer, yt-about-this-ad-renderer, yt-mealbar-promo-renderer, ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, .ytd-video-masthead-ad-v3-renderer, div#root.style-scope.ytd-display-ad-renderer.yt-simple-endpoint, div#sparkles-container.style-scope.ytd-promoted-sparkles-web-renderer, div#main-container.style-scope.ytd-promoted-video-renderer, div#player-ads.style-scope.ytd-watch-flexy, ad-slot-renderer, ytm-promoted-sparkles-web-renderer, masthead-ad, #masthead-ad, ytd-video-quality-promo-renderer {
display: none !important
}`;
  if (typeof GM_addStyle !== "undefined") {
    GM_addStyle(css);
  } else {
    const styleNode = document.createElement("style");
    styleNode.appendChild(document.createTextNode(css));
    (document.querySelector("head") || document.documentElement).appendChild(styleNode);
  }
})();

// Auto skip ads and force disable autopause (special thanks to CY Fung for the ads skip script code
(() => {
  let popupState = 0;
  let popupElement = null;

  const rate = 1;

  const Promise = (async () => {})().constructor;

  const PromiseExternal = ((resolve_, reject_) => {
    const h = (resolve, reject) => {
      resolve_ = resolve;
      reject_ = reject;
    };
    return class PromiseExternal extends Promise {
      constructor(cb = h) {
        super(cb);
        if (cb === h) {
          /** @type {(value: any) => void} */
          this.resolve = resolve_;
          /** @type {(reason?: any) => void} */
          this.reject = reject_;
        }
      }
    };
  })();

  const insp = (o) => (o ? o.polymerController || o.inst || o || 0 : o || 0);

  let vload = null;

  const fastSeekFn = HTMLVideoElement.prototype.fastSeek || null;
  const addEventListenerFn = HTMLElement.prototype.addEventListener;
  if (!addEventListenerFn) return;
  const removeEventListenerFn = HTMLElement.prototype.removeEventListener;
  if (!removeEventListenerFn) return;

  const ytPremiumPopupSelector =
    "yt-mealbar-promo-renderer.style-scope.ytd-popup-container:not([hidden])";

  const DEBUG = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const log = DEBUG ? console.log.bind(console) : () => 0;

  //$0.$['dismiss-button'].click()
  const ytPremiumPopupClose = () => {
    const popup = document.querySelector(ytPremiumPopupSelector);
    if (popup instanceof HTMLElement) {
      if (HTMLElement.prototype.closest.call(popup, "[hidden]")) return;
      const cnt = insp(popup);
      const btn = cnt.$ ? cnt.$["dismiss-button"] : 0;
      if (btn instanceof HTMLElement && HTMLElement.prototype.closest.call(btn, "[hidden]")) return;
      btn?.click();
    }
  };

  //div.video-ads.ytp-ad-module
  const clickSkip = () => {
    // ytp-ad-skip-button
    const isAdsContainerContainsButton = document.querySelector(".video-ads.ytp-ad-module button");
    if (isAdsContainerContainsButton) {
      const btnFilter = (e) =>
        HTMLElement.prototype.matches.call(
          e,
          ".ytp-ad-overlay-close-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button"
        ) && !HTMLElement.prototype.closest.call(e, "[hidden]");
      const btns = [
        ...document.querySelectorAll('.video-ads.ytp-ad-module button[class*="ytp-ad-"]')
      ].filter(btnFilter);
      console.log("# of ads skip btns", btns.length);
      if (btns.length !== 1) return;
      const btn = btns[0];
      if (btn instanceof HTMLElement) {
        btn.click();
      }
    }
  };

  const adsEndHandlerHolder = (evt) => {
    adsEndHandler?.(evt);
  };

  let adsEndHandler = null;

  const videoPlayingHandler = async (evt) => {
    try {
      if (!evt || !evt.target || !evt.isTrusted || !(evt instanceof Event)) return;
      const video = evt.target;

      const checkPopup = popupState === 1;
      popupState = 0;

      const popupElementValue = popupElement;
      popupElement = null;

      if (video.duration < 0.8) return;

      await vload.then();
      if (!video.isConnected) return;

      const ytplayer = HTMLElement.prototype.closest.call(video, "ytd-player, ytmusic-player");
      if (!ytplayer || !ytplayer.is) return;

      const ytplayerCnt = insp(ytplayer);
      const player_ = await (ytplayerCnt.player_ ||
        ytplayer.player_ ||
        ytplayerCnt.playerApi ||
        ytplayer.playerApi ||
        0);
      if (!player_) return;

      if (typeof ytplayerCnt.getPlayer === "function" && !ytplayerCnt.getPlayer()) {
        await new Promise((r) => setTimeout(r, 40));
      }
      const playerController = (await ytplayerCnt.getPlayer()) || player_;
      if (!video.isConnected) return;

      if ("getPresentingPlayerType" in playerController && "getDuration" in playerController) {
        const ppType = await playerController.getPresentingPlayerType();

        log("m02a", ppType);
        if (ppType === 1 || typeof ppType !== "number") return; // ads shall be ppType === 2
        // const progressState = player_.getProgressState();
        // log('m02b', progressState);
        // if(!progressState) return;
        // const q = progressState.duration;

        // if (popupState === 1) console.debug('m05b:ytPremiumPopup', document.querySelector(ytPremiumPopupSelector))

        const q = video.duration;

        const ytDuration = await playerController.getDuration();
        log("m02c", q, ytDuration, Math.abs(ytDuration - q));

        if (q > 0.8 && ytDuration > 2.5 && Math.abs(ytDuration - q) > 1.4) {
          try {
            log("m02s", "fastSeek", q);
            video.muted = true;
            const w = Math.round(rand(582, 637) * rate);
            const sq = q - w / 1000;

            adsEndHandler = null;

            const expired = Date.now() + 968;

            removeEventListenerFn.call(video, "ended", adsEndHandlerHolder, false);
            removeEventListenerFn.call(video, "suspend", adsEndHandlerHolder, false);
            removeEventListenerFn.call(video, "durationchange", adsEndHandlerHolder, false);
            addEventListenerFn.call(video, "ended", adsEndHandlerHolder, false);
            addEventListenerFn.call(video, "suspend", adsEndHandlerHolder, false);
            addEventListenerFn.call(video, "durationchange", adsEndHandlerHolder, false);

            adsEndHandler = async (_evt) => {
              adsEndHandler = null;

              removeEventListenerFn.call(video, "ended", adsEndHandlerHolder, false);
              removeEventListenerFn.call(video, "suspend", adsEndHandlerHolder, false);
              removeEventListenerFn.call(video, "durationchange", adsEndHandlerHolder, false);

              if (Date.now() < expired) {
                const delay = Math.round(rand(92, 117));
                await new Promise((r) => setTimeout(r, delay));

                Promise.resolve()
                  .then(() => {
                    clickSkip();
                  })
                  .catch(console.warn);

                checkPopup &&
                  Promise.resolve()
                    .then(() => {
                      const currentPopup = document.querySelector(ytPremiumPopupSelector);
                      if (popupElementValue ? currentPopup === popupElementValue : currentPopup) {
                        ytPremiumPopupClose();
                      }
                    })
                    .catch(console.warn);
              }
            };

            if (fastSeekFn) fastSeekFn.call(video, sq);
            else video.currentTime = sq;
          } catch (e) {
            console.warn(e);
          }
        }
      }
    } catch (e) {
      console.warn(e);
    }
  };

  document.addEventListener(
    "loadedmetadata",
    async (evt) => {
      try {
        if (!evt || !evt.target || !evt.isTrusted || !(evt instanceof Event)) return;

        const video = evt.target;
        if (video.nodeName !== "VIDEO") return;
        if (video.duration < 0.8) return;
        if (!video.matches(".video-stream.html5-main-video")) return;

        popupState = 0;

        vload = new PromiseExternal();

        popupElement = document.querySelector(ytPremiumPopupSelector);

        removeEventListenerFn.call(video, "playing", videoPlayingHandler, {
          passive: true,
          capture: false
        });

        addEventListenerFn.call(video, "playing", videoPlayingHandler, {
          passive: true,
          capture: false
        });

        popupState = 1;

        let trial = 6;

        await new Promise((resolve) => {
          let io = new IntersectionObserver((entries) => {
            if (
              trial-- <= 0 ||
              (entries &&
                entries.length >= 1 &&
                video.matches("ytd-player video, ytmusic-player video"))
            ) {
              resolve();
              io.disconnect();
              io = null;
            }
          });
          io.observe(video);
        });

        vload.resolve();
      } catch (e) {
        console.warn(e);
      }
    },
    true
  );
})();

Object.defineProperties(document, {
  /*'hidden': {value: false},*/ webkitHidden: { value: false },
  visibilityState: { value: "visible" },
  webkitVisibilityState: { value: "visible" }
});

setInterval(() => {
  document.dispatchEvent(
    new KeyboardEvent("keyup", { bubbles: true, cancelable: true, keyCode: 143, which: 143 })
  );
}, 60000);
