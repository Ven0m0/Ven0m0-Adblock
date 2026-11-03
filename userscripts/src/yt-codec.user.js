// ==UserScript==
// @name         YouTube Codec Preference (VP9)
// @author       Ven0m0
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Blocks AV1, prefers VP9 and falls back to H.264 (AVC) when a video has no VP9
// @match        https://youtube.com/*
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @match        https://www.youtube-nocookie.com/*
// @grant        none
// @run-at       document-start
// @license      GPL-3.0
// @homepageURL  https://github.com/Ven0m0/Ven0m0-Adblock
// ==/UserScript==

(() => {
  const GUARD = "__yt_codec_pref__";
  if (window[GUARD]) return;
  window[GUARD] = 1;

  const AV1 = /av01/i;
  const VP9_PROBES = ['video/webm; codecs="vp09.00.10.08"', 'video/webm; codecs="vp9"'];
  const isAv1 = (t) => typeof t === "string" && AV1.test(t);

  // Capture the native check before patching so the VP9 probe is not affected by our own hooks.
  const nativeSupported = window.MediaSource?.isTypeSupported?.bind(window.MediaSource);
  const canVP9 = Boolean(nativeSupported && VP9_PROBES.some((t) => nativeSupported(t)));

  // Layer 1: capability block. Every path YouTube uses to ask "can you play AV1" says no.
  for (const ms of [window.MediaSource, window.ManagedMediaSource]) {
    const orig = ms?.isTypeSupported;
    if (!orig) continue;
    ms.isTypeSupported = function (t) {
      return isAv1(t) ? false : orig.call(this, t);
    };
  }
  const cpt = window.HTMLMediaElement?.prototype?.canPlayType;
  if (cpt) {
    window.HTMLMediaElement.prototype.canPlayType = function (t) {
      return isAv1(t) ? "" : cpt.call(this, t);
    };
  }
  const mc = window.navigator?.mediaCapabilities;
  if (mc?.decodingInfo) {
    const od = mc.decodingInfo.bind(mc);
    mc.decodingInfo = (cfg) =>
      isAv1(cfg?.video?.contentType)
        ? Promise.resolve({ supported: false, smooth: false, powerEfficient: false })
        : od(cfg);
  }

  // Layer 2: per-video steering. With VP9 on offer, drop AVC too; without it, only AV1 goes so AVC stays.
  const family = (f) => {
    const m = String(f?.mimeType || "");
    if (!m.startsWith("video/")) return null;
    if (/vp0?9/i.test(m)) return "vp9";
    if (/av01/i.test(m)) return "av1";
    return "avc";
  };
  const steer = (pr) => {
    const sd = pr?.streamingData;
    if (!canVP9 || !Array.isArray(sd?.adaptiveFormats)) return;
    const hasVP9 = sd.adaptiveFormats.some((f) => family(f) === "vp9");
    sd.adaptiveFormats = sd.adaptiveFormats.filter((f) => {
      const fam = family(f);
      return fam === null || fam === "vp9" || (!hasVP9 && fam === "avc");
    });
  };

  // shortcut: SABR/HLS-only streams (live) carry no adaptiveFormats, so only the AV1 block applies there;
  // upgrade to SABR format-id filtering if that becomes common for regular videos.
  let held = window.ytInitialPlayerResponse;
  const prev = Object.getOwnPropertyDescriptor(window, "ytInitialPlayerResponse");
  try {
    Object.defineProperty(window, "ytInitialPlayerResponse", {
      configurable: true,
      enumerable: true,
      get: () => (prev?.get ? prev.get.call(window) : held),
      set(v) {
        try {
          steer(v);
        } catch {
          // Never break the player over a steering failure
        }
        if (prev?.set) prev.set.call(window, v);
        else held = v;
      }
    });
  } catch {
    // Property is non-configurable; the fetch hook below still covers navigations
  }

  const nativeFetch = window.fetch;
  window.fetch = async function (input, init) {
    const res = await nativeFetch.call(this, input, init);
    try {
      const url = typeof input === "string" ? input : input?.url || String(input);
      if (!url.includes("/youtubei/v1/player")) return res;
      const data = await res.clone().json();
      steer(data);
      return new Response(JSON.stringify(data), {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers
      });
    } catch {
      return res;
    }
  };
})();
