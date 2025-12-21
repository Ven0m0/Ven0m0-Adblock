// ==UserScript==
// @name         Amazon Page Smoother (Lean)
// @namespace    Ven0m0
// @version      0.1.2
// @description  Lightweight Amazon perf: containment + prioritized lazyload
// @match        https://www.amazon.*/*
// @exclude      */cart/*
// @exclude      */buy/*
// @exclude      */checkout/*
// @exclude      */gp/buy/*
// @license      Unlicense
// @run-at       document-start
// ==/UserScript==
(() => {
  // prettier-ignore
  const CFG = { HIGH: 4, DEBOUNCE: 240 };
  const sens = /(checkout|signin|payment|addressselect|huc)/i;
  if (sens.test(location.pathname)) return;
  const inject = () => {
    const css = `
.s-main-slot .s-result-item{content-visibility:auto;contain-intrinsic-size:1px 350px;}
img.s-image{transform:translateZ(0);will-change:opacity;}
#navFooter{content-visibility:auto;contain-intrinsic-size:1px 600px;}
`;
    const s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  };
  const opt = (root = document) => {
    const imgs = root.querySelectorAll("img:not([data-opt])");
    if (!imgs.length) return;
    const prio = "fetchPriority" in HTMLImageElement.prototype;
    imgs.forEach((img, i) => {
      img.dataset.opt = "1";
      if (img.closest("#navFooter")) {
        img.loading = "lazy";
        img.decoding = "async";
        if (prio) img.fetchPriority = "low";
        return;
      }
      if (img.classList.contains("s-image")) {
        if (i < CFG.HIGH) {
          img.loading = "eager";
          if (prio) img.fetchPriority = "high";
        } else {
          img.loading = "lazy";
          img.decoding = "async";
          if (prio) img.fetchPriority = "low";
        }
        return;
      }
      if (!img.loading) {
        img.loading = "lazy";
        img.decoding = "async";
      }
    });
  };
  const main = () => {
    inject();
    opt(document);
    let t;
    new MutationObserver((m) => {
      if (!m.some((x) => x.addedNodes.length)) return;
      clearTimeout(t);
      t = setTimeout(
        () => ("requestIdleCallback" in window ? requestIdleCallback(() => opt(document.body)) : opt(document.body)),
        CFG.DEBOUNCE
      );
    }).observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", main, { once: true }) : main();
})();
