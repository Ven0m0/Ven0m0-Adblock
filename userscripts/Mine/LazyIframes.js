// ==UserScript==
// @name              <iframe> lazy load
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
document.querySelectorAll('iframe').forEach(iframe => {
  const src = iframe.getAttribute("src");
  const srcdoc = iframe.getAttribute("srcdoc");
  if (
    src &&
    /^https?:/.test(src) &&
    srcdoc === null
  ) {
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("fetchpriority", "low");
  }
});
