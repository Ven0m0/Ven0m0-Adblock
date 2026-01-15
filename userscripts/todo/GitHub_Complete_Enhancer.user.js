// ==UserScript==
// @name         GitHub Complete Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Consolidated GitHub enhancements: Useful Forks button, auto device authorization, enhanced image preview with zoom/drag/keyboard controls
// @author       Consolidated from GitHub Useful Forks + Auto Device Auth + Image Preview Plus
// @match        https://github.com/*/*
// @match        https://github.com/login/device*
// @match        https://github.com/login/oauth*
// @grant        none
// @license      MIT
// @downloadURL  https://update.greasyfork.org/scripts/[ID]/GitHub%20Complete%20Enhancer.user.js
// @updateURL    https://update.greasyfork.org/scripts/[ID]/GitHub%20Complete%20Enhancer.meta.js
// ==/UserScript==

(function () {
  "use strict";

  // Emergency disable
  if (localStorage.getItem("disable_github_enhancer") === "1") {
    console.warn("[GitHub Enhancer]: Disabled by user");
    return;
  }

  // ═══════════════════════════════════════════════════════════
  // MODULE 1: USEFUL FORKS BUTTON
  // ═══════════════════════════════════════════════════════════

  const UsefulForksModule = {
    UI_IDS: {
      li: "useful_forks_li",
      btn: "useful_forks_btn",
      tip: "useful_forks_tooltip"
    },

    getRepoUrl() {
      const pathComponents = window.location.pathname.split("/");
      const user = pathComponents[1],
        repo = pathComponents[2];
      return `https://useful-forks.github.io/?repo=${user}/${repo}`;
    },

    createButton() {
      const li = document.createElement("li");
      li.id = this.UI_IDS.li;
      li.innerHTML = `
        <div class="float-left">
          <button id="${this.UI_IDS.btn}" class="btn-sm btn" aria-describedby="${this.UI_IDS.tip}">
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-search">
              <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"></path>
            </svg>
            Useful
          </button>
          <tool-tip for="${this.UI_IDS.btn}" id="${this.UI_IDS.tip}" popover="manual" class="position-absolute sr-only">
            Search for useful forks in a new tab
          </tool-tip>
        </div>
      `;
      return li;
    },

    init() {
      // Remove old instance (for navigation)
      const oldLi = document.getElementById(this.UI_IDS.li);
      if (oldLi) oldLi.remove();

      const forkBtn = document.getElementById("repo-network-counter");
      if (!forkBtn) return; // Not on a repository page

      const forksAmount = parseInt(forkBtn.textContent);
      if (forksAmount < 1) return; // No forks

      const parentLi = forkBtn.closest("li");
      const newLi = this.createButton();
      parentLi.parentNode.insertBefore(newLi, parentLi);

      // Set button click handler
      document.getElementById(this.UI_IDS.btn).addEventListener("click", () => {
        window.open(this.getRepoUrl(), "_blank");
      });
    }
  };

  // ═══════════════════════════════════════════════════════════
  // MODULE 2: AUTO DEVICE AUTHORIZATION
  // ═══════════════════════════════════════════════════════════

  const AutoAuthModule = {
    waitForElement(selector, delay = 50, maxAttempts = 20) {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(() => {
          const element = document.querySelector(selector);
          attempts++;
          if (element) {
            clearInterval(interval);
            resolve(element);
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            reject(new Error(`Element ${selector} not found`));
          }
        }, delay);
      });
    },

    async fillAndSubmitCode() {
      try {
        const userCode = await navigator.clipboard.readText();
        const codeParts = userCode.split("-");
        if (codeParts.length !== 2) {
          console.error("[GitHub Enhancer] Invalid device code format");
          return;
        }

        // Fill first part
        for (let i = 0; i < codeParts[0].length; i++) {
          this.waitForElement(`#user-code-${i}`).then((el) => (el.value = codeParts[0][i]));
        }

        // Fill second part
        for (let i = 0; i < codeParts[1].length; i++) {
          this.waitForElement(`#user-code-${i + 5}`).then((el) => (el.value = codeParts[1][i])).catch(err => console.error('[GitHub Enhancer] Error filling code part 2:', err));
        }

        // Submit after 1 second
        this.waitForElement('input[type="submit"][name="commit"]').then((button) =>
          setTimeout(() => button.click(), 1000)
        );
      } catch (error) {
        console.error("[GitHub Enhancer] Auto-auth error:", error);
      }
    },

    autoSubmitConfirmation() {
      window.addEventListener("load", () => {
        this.waitForElement('form[action="/login/device/authorize"] button[name="authorize"][value="1"]')
          .then((button) => setTimeout(() => button.click(), 1000))
          .catch((error) => console.error("[GitHub Enhancer] Auto-confirm error:", error));
      });
    },

    init() {
      // Auto-select account
      const selectAccountForm = document.querySelector('form[action="/login/device/select_account"]');
      if (selectAccountForm) {
        selectAccountForm.querySelector('input[type="submit"]')?.click();
      }

      // Auto-fill device code
      if (window.location.pathname.includes("/login/device")) {
        this.fillAndSubmitCode();
      }

      // Auto-confirm authorization
      if (window.location.pathname.includes("/login/device/confirmation")) {
        this.autoSubmitConfirmation();
      }

      // OAuth local server verification
      if (window.location.pathname.includes("/login/oauth")) {
        document.querySelector("form > input.btn-primary")?.click();
      }
    }
  };

  // ═══════════════════════════════════════════════════════════
  // MODULE 3: IMAGE PREVIEW ENHANCEMENT
  // ═══════════════════════════════════════════════════════════

  const ImagePreviewModule = {
    init() {
      // Inject CSS
      document.head.insertAdjacentHTML(
        "beforeend",
        `<style>
        #gh-img-preview-mask {
          position: fixed; inset: 0; background: rgba(0,0,0,0.95); backdrop-filter: blur(8px);
          z-index: 999999; display: none; align-items: center; justify-content: center;
          cursor: zoom-out; opacity: 0; transition: opacity .3s;
        }
        body.img-preview-active #gh-img-preview-mask { display: flex; opacity: 1; }
        #gh-img-preview-container { position: relative; cursor: move; will-change: transform; }
        #gh-img-preview-img {
          max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 8px;
          box-shadow: 0 20px 60px rgba(0,0,0,.7); opacity: 0; transition: opacity .4s;
          user-select: none; pointer-events: none;
        }
        #gh-img-preview-img.loaded { opacity: 1; }
        #gh-img-preview-controls {
          position: fixed; top: 20px; right: 20px; display: flex; gap: 12px; z-index: 40;
        }
        #gh-img-preview-download, #gh-img-preview-close {
          width: 36px; height: 36px; background: rgba(0,0,0,.7); border-radius: 50%;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          border: 2px solid rgba(255,255,255,.3); backdrop-filter: blur(4px);
          transition: all .25s;
        }
        #gh-img-preview-download:hover, #gh-img-preview-close:hover {
          transform: scale(1.15); border-color: #fff;
        }
        #gh-img-preview-close:hover { background: rgba(220,38,38,.9); }
        #gh-img-preview-controls svg { width: 18px; height: 18px; stroke: #fff; stroke-width: 2.5; fill: none; }
        #gh-img-preview-prev, #gh-img-preview-next {
          position: fixed; top: 50%; transform: translateY(-50%);
          width: 56px; height: 56px; background: rgba(0,0,0,.6); border-radius: 50%;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          opacity: .8; transition: all .25s; z-index: 30;
        }
        #gh-img-preview-prev { left: 30px; }
        #gh-img-preview-next { right: 30px; }
        #gh-img-preview-prev:hover, #gh-img-preview-next:hover {
          opacity: 1; background: rgba(0,0,0,.85); transform: translateY(-50%) scale(1.15);
        }
        #gh-img-preview-prev svg, #gh-img-preview-next svg {
          width: 30px; height: 30px; stroke: #fff; stroke-width: 3.5; fill: none;
        }
        #gh-img-preview-prev.disabled, #gh-img-preview-next.disabled { opacity: .3; cursor: not-allowed; }
        @media (max-width: 768px) {
          #gh-img-preview-controls { top: 12px; right: 12px; gap: 10px; }
          #gh-img-preview-download, #gh-img-preview-close { width: 32px; height: 32px; }
          #gh-img-preview-controls svg { width: 16px; height: 16px; }
          #gh-img-preview-prev, #gh-img-preview-next { width: 48px; height: 48px; }
          #gh-img-preview-prev { left: 15px; } #gh-img-preview-next { right: 15px; }
        }
      </style>`
      );

      // Inject DOM
      document.body.insertAdjacentHTML(
        "beforeend",
        `
        <div id="gh-img-preview-mask">
          <div id="gh-img-preview-container">
            <img id="gh-img-preview-img" alt="Preview">
          </div>
          <div id="gh-img-preview-controls">
            <div id="gh-img-preview-download" title="Download">
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
            </div>
            <div id="gh-img-preview-close" title="Close (Esc)">
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
          </div>
          <div id="gh-img-preview-prev" title="Previous (←)"><svg viewBox="0 0 24 24"><line x1="15" y1="18" x2="9" y2="12"/><line x1="15" y1="6" x2="9" y2="12"/></svg></div>
          <div id="gh-img-preview-next" title="Next (→)"><svg viewBox="0 0 24 24"><line x1="9" y1="18" x2="15" y2="12"/><line x1="9" y1="6" x2="15" y2="12"/></svg></div>
        </div>
      `
      );

      const mask = document.getElementById("gh-img-preview-mask");
      const container = document.getElementById("gh-img-preview-container");
      const img = document.getElementById("gh-img-preview-img");
      const closeBtn = document.getElementById("gh-img-preview-close");
      const downloadBtn = document.getElementById("gh-img-preview-download");
      const prevBtn = document.getElementById("gh-img-preview-prev");
      const nextBtn = document.getElementById("gh-img-preview-next");

      let scale = 1,
        tx = 0,
        ty = 0,
        dragging = false,
        rafId = null;
      let images = [],
        currentIdx = 0,
        clickTimer = null;

      const reset = () => {
        scale = 1;
        tx = ty = 0;
        container.style.transform = "translate(0px,0px) scale(1)";
        img.classList.remove("loaded");
      };

      const close = () => {
        document.body.classList.remove("img-preview-active");
        document.body.style.overflow = "";
        setTimeout(reset, 300);
      };

      const download = () => {
        const url = img.src;
        const name = url.split("/").pop().split("?")[0] || "github-image.png";
        fetch(url)
          .then((r) => r.blob())
          .then((blob) => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = name;
            a.click();
            URL.revokeObjectURL(a.href);
          });
      };

      const updateNav = () => {
        prevBtn.classList.toggle("disabled", currentIdx === 0);
        nextBtn.classList.toggle("disabled", currentIdx === images.length - 1);
      };

      const load = (idx) => {
        if (idx < 0 || idx >= images.length) return;
        currentIdx = idx;
        const el = images[idx];
        img.src = el.dataset.src || el.src;
        reset();
        img.onload = () => img.classList.add("loaded");
        updateNav();
      };

      const open = (clickedEl) => {
        images = Array.from(
          document.querySelectorAll(".markdown-body img, .comment-body img, .blob-wrapper img")
        ).filter((el) => el.src && !el.src.endsWith(".svg") && !el.closest("[data-lightbox]"));
        currentIdx = images.indexOf(clickedEl);
        if (currentIdx === -1) currentIdx = 0;
        load(currentIdx);
        document.body.classList.add("img-preview-active");
        document.body.style.overflow = "hidden";
        updateNav();
      };

      // Event handlers
      mask.onclick = (e) => e.target === mask && close();
      closeBtn.onclick = close;
      downloadBtn.onclick = download;
      prevBtn.onclick = () => load(currentIdx - 1);
      nextBtn.onclick = () => load(currentIdx + 1);

      document.onkeydown = (e) => {
        if (!document.body.classList.contains("img-preview-active")) return;
        if (e.key === "Escape") close();
        if (e.key === "ArrowLeft") load(currentIdx - 1);
        if (e.key === "ArrowRight") load(currentIdx + 1);
      };

      container.onwheel = (e) => {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const ox = e.clientX - rect.left - rect.width / 2;
        const oy = e.clientY - rect.top - rect.height / 2;
        const delta = e.deltaY < 0 ? 1.15 : 0.85;
        const newScale = Math.max(0.3, Math.min(8, scale * delta));
        tx = e.clientX - rect.left - rect.width / 2 - (ox / scale) * newScale;
        ty = e.clientY - rect.top - rect.height / 2 - (oy / scale) * newScale;
        scale = newScale;
        container.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
      };

      container.onmousedown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        dragging = true;
        const startX = e.clientX - tx;
        const startY = e.clientY - ty;
        container.style.cursor = "grabbing";

        const move = (e) => {
          tx = e.clientX - startX;
          ty = e.clientY - startY;
          cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            container.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
          });
        };

        const up = () => {
          dragging = false;
          container.style.cursor = "move";
          document.removeEventListener("mousemove", move);
          document.removeEventListener("mouseup", up);
        };

        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", up);
      };

      container.ondblclick = reset;

      // Bind image clicks
      const bind = () => {
        document.querySelectorAll(".markdown-body img, .comment-body img, .blob-wrapper img").forEach((el) => {
          if (el.dataset.bound || el.src.endsWith(".svg") || el.closest("[data-lightbox]")) return;
          el.dataset.bound = "1";
          el.dataset.src = el.currentSrc || el.src;

          el.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (clickTimer) {
              clearTimeout(clickTimer);
              clickTimer = null;
              const link = el.closest("a");
              window.location.href = link?.href || el.src;
              return;
            }

            clickTimer = setTimeout(() => {
              clickTimer = null;
              open(el);
            }, 300);
          };
        });
      };

      new MutationObserver(bind).observe(document.body, { childList: true, subtree: true });
      bind();
    }
  };

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════

  // Module 1: Useful Forks (on repository pages)
  if (window.location.pathname.match(/^\/[^/]+\/[^/]+\/?$/)) {
    UsefulForksModule.init();

    // Re-init on GitHub's SPA navigation
    let timeout;
    const observer = new MutationObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(() => UsefulForksModule.init(), 10);
    });
    observer.observe(document.body, { childList: true, subtree: false });
  }

  // Module 2: Auto Device Authorization (on auth pages)
  if (window.location.pathname.includes("/login/device") || window.location.pathname.includes("/login/oauth")) {
    AutoAuthModule.init();
  }

  // Module 3: Image Preview (everywhere on GitHub)
  ImagePreviewModule.init();

  console.info("[GitHub Enhancer] Initialized (3 modules: Useful Forks, Auto Auth, Image Preview)");
})();
