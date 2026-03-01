// ==UserScript==
// @name         Google Search Fixer (Userscript Port)
// @namespace    https://github.com/Ven0m0/Ven0m0-Adblock
// @version      0.1.0
// @description  Port of google-search-fixer Firefox extension to a userscript (Android-friendly).
// @author       Ven0m0
// @match        https://www.google.*/search*
// @match        https://www.google.*/url*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  const onReady = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true, passive: true });
      return;
    }
    fn();
  };

  const isElement = (v) => v instanceof Element;

  const decodeGoogleRedirect = (u) => {
    // Common redirect forms:
    // 1) https://www.google.com/url?q=<target>&sa=...
    // 2) https://www.google.com/url?url=<target>&...
    // 3) Sometimes embedded in "q" parameter even on /search links
    try {
      const url = new URL(u, location.href);
      if (!/\.google\./i.test(url.hostname)) return null;
      if (url.pathname !== "/url") return null;

      const q = url.searchParams.get("q") || url.searchParams.get("url");
      if (!q) return null;

      // Reject non-http(s) to avoid weirdness
      if (!/^https?:\/\//i.test(q)) return null;
      return q;
    } catch {
      return null;
    }
  };

  const fixAnchor = (a) => {
    if (!a || a.tagName !== "A") return;
    const href = a.getAttribute("href");
    if (!href) return;

    const target = decodeGoogleRedirect(href);
    if (!target) return;

    // Preserve original in case you want rollback / debugging
    if (!a.hasAttribute("data-gsf-orig-href")) a.setAttribute("data-gsf-orig-href", href);

    a.setAttribute("href", target);
    // Defensive: don’t let Google re-inject click handlers relying on ping/redirect
    // (we’re not removing listeners globally; we just make the href direct)
    a.removeAttribute("ping");
  };

  const scan = (root) => {
    const anchors = root.querySelectorAll?.('a[href^="/url?"], a[href^="https://www.google."][href*="/url?"]') ?? [];
    for (const a of anchors) fixAnchor(a);
  };

  const observe = () => {
    let timeoutId = null;
    const mo = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (!isElement(n)) continue;
          if (n.tagName === "A") {
            fixAnchor(n);
            continue;
          }
          shouldScan = true;
        }
      }
      if (shouldScan && !timeoutId) {
        if (typeof requestAnimationFrame !== "undefined") {
          timeoutId = requestAnimationFrame(() => {
            timeoutId = null;
            scan(document);
          });
        } else {
          timeoutId = setTimeout(() => {
            timeoutId = null;
            scan(document);
          }, 100);
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  };

  // Document-start: patch early, then keep patching.
  scan(document);
  observe();

  // Also re-scan after DOMContentLoaded because Google swaps DOM aggressively.
  onReady(() => scan(document));
})();
