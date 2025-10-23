// ==UserScript==
// @name              Web Performance Tweaker
// @description       Use native lazy loading for <iframe> elements to reduce resource usage.
// @namespace         Ven0m0
// @version           1.0
// @match             *://*/*
// @exclude-match     *://web.archive.org/web/*
// @exclude-match     *://codepen.io/*
// @exclude-match     *://music.163.com/*
// @exclude-match     *://*.chaoxing.com/*
// @grant             none
// @inject-into       content
// @run-at            document-end
// ==/UserScript==

"use strict";

function lazyLoadIframes() {
  document.querySelectorAll("iframe").forEach( iframe => {
    const src = iframe.getAttribute("src");
    const srcdoc = iframe.getAttribute("srcdoc");
    if ( src && /^\s*https?:/i.test(src) && srcdoc === null ) {
      iframe.setAttribute("loading", "lazy");
      iframe.setAttribute("fetchpriority", "low");
    }
  });
}
function lazyLoadImages() {
  document.querySelectorAll("img").forEach( img => {
    if ( img.getAttribute("loading") === null ) {
      img.setAttribute("loading", "lazy");
    }
  });
}
function reduceThirdPartySprites() {
  // reduce heavy external scripts/widgets from loading until interaction
  document.querySelectorAll("script[src]").forEach( s => {
    const src = s.getAttribute("src");
    if ( src && /(?:ads|analytics|tracking)/i.test(src) ) {
      s.type = "lazy/script";
      // later logic could swap back when user interacts
    }
  });
}
function init() {
  lazyLoadIframes();
  lazyLoadImages();
  // TODO: add more tweaks here
}

init();

// Optionally observe DOM for dynamically inserted elements
const obs = new MutationObserver( (mutations) => {
  lazyLoadIframes();
  lazyLoadImages();
});
obs.observe(document.documentElement, { childList:true, subtree:true });
