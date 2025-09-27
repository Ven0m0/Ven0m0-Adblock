// ==UserScript==
// @name         Pinterest Dark Mode
// @namespace    https://github.com/trojaninfect
// @version      1.5
// @description  Force dark mode on pinterest.com, keeps images/svg normal, supports toggle and persists choice.
// @author       NoSleep
// @match        https://*.pinterest.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// @downloadURL https://update.greasyfork.org/scripts/550470/Pinterest%20Dark%20Mode.user.js
// @updateURL https://update.greasyfork.org/scripts/550470/Pinterest%20Dark%20Mode.meta.js
// ==/UserScript==

(function () {
  'use strict';

  // ID for the injected <style>
  const STYLE_ID = 'tm-pinterest-dark-style-v1';

  // Default: enabled
  let enabled = GM_getValue('tm_pinterest_dark_enabled', true);

  // The main dark CSS. It uses broad selectors and !important to override Pinterest's styles.
  const darkCSS = `
    /* container/backgrounds */
    html.tm-pinterest-dark, html.tm-pinterest-dark body {
      background: #0b0b0b !important;
      color: #e6e6e6 !important;
    }

    /* generic elements */
    html.tm-pinterest-dark body,
    html.tm-pinterest-dark header,
    html.tm-pinterest-dark main,
    html.tm-pinterest-dark nav,
    html.tm-pinterest-dark section,
    html.tm-pinterest-dark aside,
    html.tm-pinterest-dark footer,
    html.tm-pinterest-dark article,
    html.tm-pinterest-dark div,
    html.tm-pinterest-dark li,
    html.tm-pinterest-dark a,
    html.tm-pinterest-dark p,
    html.tm-pinterest-dark span,
    html.tm-pinterest-dark button,
    html.tm-pinterest-dark input,
    html.tm-pinterest-dark textarea {
      background-color: transparent !important;
      color: #e6e6e6 !important;
      border-color: rgba(255,255,255,0.06) !important;
    }

    /* pin cards / tiles / modal backgrounds */
    html.tm-pinterest-dark .BoardPage, /* board pages */
    html.tm-pinterest-dark .Grid,      /* generic grid */
    html.tm-pinterest-dark .GrowthUnauthPage,
    html.tm-pinterest-dark .Collection,
    html.tm-pinterest-dark .pin,
    html.tm-pinterest-dark .Modal,
    html.tm-pinterest-dark .modal,
    html.tm-pinterest-dark [data-test-id="pin"] {
      background: #0f0f10 !important;
      box-shadow: 0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 20px rgba(0,0,0,0.6) !important;
    }

    /* headers, top nav */
    html.tm-pinterest-dark header[role="banner"],
    html.tm-pinterest-dark nav[role="navigation"],
    html.tm-pinterest-dark .Header,
    html.tm-pinterest-dark .topNav {
      background: linear-gradient(180deg,#0d0d0d,#0a0a0a) !important;
      border-bottom: 1px solid rgba(255,255,255,0.04) !important;
    }

    /* inputs, search box */
    html.tm-pinterest-dark input,
    html.tm-pinterest-dark textarea,
    html.tm-pinterest-dark select {
      background: rgba(255,255,255,0.03) !important;
      color: #e6e6e6 !important;
      border: 1px solid rgba(255,255,255,0.04) !important;
    }

    /* links and accents */
    html.tm-pinterest-dark a,
    html.tm-pinterest-dark a:visited {
      color: #ff7a7a !important; /* gentle accent - tweak if you want */
    }

    /* keep images, svgs, videos, icons normal (no site-wide invert) */
    html.tm-pinterest-dark img,
    html.tm-pinterest-dark svg,
    html.tm-pinterest-dark video,
    html.tm-pinterest-dark picture {
      filter: none !important;
      background: transparent !important;
    }

    /* make sure pinned images still have rounded corners etc */
    html.tm-pinterest-dark img[style],
    html.tm-pinterest-dark img {
      image-rendering: auto !important;
    }

    /* text-muted & small text */
    html.tm-pinterest-dark .tappable,
    html.tm-pinterest-dark .small,
    html.tm-pinterest-dark .meta,
    html.tm-pinterest-dark .description {
      color: rgba(230,230,230,0.75) !important;
    }

    /* overlays and tooltips */
    html.tm-pinterest-dark .Overlay,
    html.tm-pinterest-dark .Tooltip,
    html.tm-pinterest-dark .Popover {
      background: rgba(12,12,12,0.95) !important;
      color: #e6e6e6 !important;
    }

    /* remove extremely bright borders */
    html.tm-pinterest-dark * {
      box-shadow: none !important;
    }

    /* scrollbars (if supported) */
    html.tm-pinterest-dark ::-webkit-scrollbar { width: 10px; height: 10px; }
    html.tm-pinterest-dark ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 10px; }
    html.tm-pinterest-dark ::-webkit-scrollbar-track { background: rgba(0,0,0,0.12); }

    /* keep images, svgs, videos, icons normal (no site-wide invert) */
html.tm-pinterest-dark img,
html.tm-pinterest-dark svg,
html.tm-pinterest-dark video,
html.tm-pinterest-dark picture {
    filter: none !important;
    background: transparent !important;
}

/* force all non-root SVGs to white */
html.tm-pinterest-dark svg:not(:root) {
    fill: #ffffff !important;
    stroke: #ffffff !important;
    background: transparent !important;
}

/* Fix all sticky/fixed profile header elements */
html.tm-pinterest-dark .ProfilePageHeader,
html.tm-pinterest-dark .ProfilePageHeader-content,
html.tm-pinterest-dark [data-test-id="profile-header"],
html.tm-pinterest-dark .ProfilePageHeader-content > *,
html.tm-pinterest-dark [data-test-id="profile-header"] > * {
    position: relative !important;  /* use relative to scroll normally */
    top: auto !important;
    z-index: auto !important;
    background: #0b0b0b !important;
}

/* Fix profile header from following scroll */
html.tm-pinterest-dark .qiB,
html.tm-pinterest-dark [data-test-id="self-profile-header"] {
    position: relative !important; /* force it into normal flow */
    top: auto !important;          /* reset top offset */
    z-index: auto !important;      /* reset stacking */
    background: #0b0b0b !important; /* match dark mode */
}


  `;

  // Injects or removes the style element and toggles the html class
  function applyStyle(on) {
    // add/remove class on <html>
    const html = document.documentElement;
    if (on) html.classList.add('tm-pinterest-dark'); else html.classList.remove('tm-pinterest-dark');

    let el = document.getElementById(STYLE_ID);
    if (on) {
      if (!el) {
        try {
          // Use GM_addStyle if available for best compatibility
          if (typeof GM_addStyle === 'function') {
            GM_addStyle(darkCSS);
            // GM_addStyle does not set id, so add a marker <style> so observer can find it
            el = document.querySelector('style');
            if (el) el.id = STYLE_ID;
          } else {
            el = document.createElement('style');
            el.id = STYLE_ID;
            el.type = 'text/css';
            el.textContent = darkCSS;
            document.head.appendChild(el);
          }
        } catch (e) {
          // fallback
          el = document.createElement('style');
          el.id = STYLE_ID;
          el.type = 'text/css';
          el.textContent = darkCSS;
          document.head.appendChild(el);
        }
      } else {
        el.textContent = darkCSS;
      }
    } else {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
  }

  // Persisted toggle
  function setEnabled(value) {
    enabled = !!value;
    GM_setValue('tm_pinterest_dark_enabled', enabled);
    applyStyle(enabled);
  }

  // Toggle function (used by keyboard shortcut)
  function toggle() {
    setEnabled(!enabled);
  }

  // Keyboard shortcut Ctrl+Shift+D to toggle
  window.addEventListener('keydown', function (e) {
    if (e.key === 'D' && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey) {
      toggle();
      e.preventDefault();
    }
  }, true);

  // Add Tampermonkey menu command
  try {
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand(enabled ? 'Disable Pinterest Dark Mode' : 'Enable Pinterest Dark Mode', toggle);
    }
  } catch (e) { /* ignore */ }

  // Observer: re-add style if Pinterest replaces head or removes style
  const observer = new MutationObserver(muts => {
    // if style removed but enabled, re-add
    if (enabled && !document.getElementById(STYLE_ID)) {
      applyStyle(true);
    }
    // ensure html class survives
    if (enabled && !document.documentElement.classList.contains('tm-pinterest-dark')) {
      document.documentElement.classList.add('tm-pinterest-dark');
    }
  });

  // Start observer on documentElement
  function startObserver() {
    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
      attributes: false
    });
  }

  // Wait for DOM to exist
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyStyle(enabled);
      startObserver();
    }, { once: true });
  } else {
    applyStyle(enabled);
    startObserver();
  }

  // In case the user wants immediate feedback before DOMContentLoaded, attempt early apply
  try { applyStyle(enabled); } catch (e) { /* noop */ }

})();
