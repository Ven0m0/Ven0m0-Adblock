// ==UserScript==
// @name         ChatGPT/Gemini/Claude Complete Optimization (Compact)
// @namespace    Ven0m0
// @homepageURL  https://github.com/Ven0m0/Ven0m0-Adblock
// @version      2.1.1
// @description  DOM/width/cleanup/autoclick/fork handlers for LLM sites
// @match        https://gemini.google.com/*
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @run-at       document-start
// ==/UserScript==

(() => {
  // ═══════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════

  const CONFIG = {
    CHATGPT: {
      MAX_MESSAGES: 15,
      INIT_MSG: 10,
      MAX_ITER: 800,
      API_REGEX: /^https:\/\/chatgpt\.com\/backend-api\/conversation\/[a-f0-9-]{36}$/i,
      CLEANUP_INTERVALS: [
        { delay: 8000, interval: 1500 },
        { delay: 12000, interval: 2500 },
        { delay: 8000, interval: 4000 }
      ],
      FINAL_CLEANUP_INTERVAL: 25000,
      INIT_DELAY: 800,
      LOOP_WAIT_FOCUSED: 1500,
      LOOP_WAIT_UNFOCUSED: 15000,
      REGEN_DELAY: 1500,
      CACHE_INVALIDATION_DELAY: 500,
      MAX_RETRIES: 2,
      RETRY_RESET_TIME: 300000
    },
    CLAUDE: {
      MAX_MESSAGES: 20,
      CLEANUP_INTERVAL: 30000
    },
    WIDTH: {
      MAX_WIDTH: "98%",
      THROTTLE_DELAY: 200,
      MAX_ATTEMPTS: 25,
      RETRY_BASE_DELAY: 250,
      RETRY_MULTIPLIER: 1.05
    }
  };

  const SELECTORS = {
    CHATGPT: {
      TEXT_BASE: ".text-base, .text-base > div:first-child",
      FORM_TEXTAREA: "form textarea",
      STOP_BUTTON: 'button[data-testid$="stop-button"]',
      SEND_BUTTON: 'button[data-testid$="send-button"]',
      CONTINUE_BUTTON: 'button[as="button"]',
      REGENERATE_BUTTON: "button",
      CONVERSATION_TURN: '[data-testid^="conversation-turn"]'
    },
    GEMINI: {
      CONTAINER: ".conversation-container"
    },
    CLAUDE: {
      STREAMING: "div[data-is-streaming]",
      RENDER_COUNT: "div[data-test-render-count]"
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // SITE DETECTION
  // ═══════════════════════════════════════════════════════════════

  const h = location.hostname;
  const isCGPT = h === "chat.openai.com" || h === "chatgpt.com";
  const isGemini = h === "gemini.google.com";
  const isClaude = h === "claude.ai";

  // ═══════════════════════════════════════════════════════════════
  // CHATGPT: CONVERSATION PRUNING
  // ═══════════════════════════════════════════════════════════════

  if (isCGPT) {
    const origFetch = window.fetch;
    window.fetch = function (input, _init) {
      const url = typeof input === "string" ? input : input.url;
      if (!CONFIG.CHATGPT.API_REGEX.test(url)) {
        return origFetch.apply(this, arguments);
      }

      return origFetch.apply(this, arguments).then(async (res) => {
        try {
          const data = await res.clone().json();
          const newMapping = [];
          const seen = new Set();
          let nodeId = data.current_node;
          let nodeVisited = 0;
          let iterations = 0;

          while (iterations++ < CONFIG.CHATGPT.MAX_ITER) {
            if (!nodeId || seen.has(nodeId)) break;

            const msg = data.mapping[nodeId];
            if (!msg) break;

            seen.add(nodeId);

            if (msg.id === "client-created-root") {
              newMapping.push(msg);
              break;
            }

            const childIds = [...msg.children];
            while (childIds.length && iterations < CONFIG.CHATGPT.MAX_ITER) {
              iterations++;
              const childId = childIds.pop();
              const child = data.mapping[childId];
              if (!child || seen.has(childId)) continue;
              seen.add(childId);
              newMapping.push(child);
              childIds.push(...child.children);
            }

            if (nodeVisited < CONFIG.CHATGPT.INIT_MSG && data.mapping[msg.parent]) {
              newMapping.push(msg);
            } else {
              newMapping.push({ ...msg, parent: "client-created-root" });
              newMapping.push({
                id: "client-created-root",
                message: null,
                parent: null,
                children: [msg.id]
              });
              break;
            }

            nodeId = msg.parent;
            nodeVisited++;
          }

          if (newMapping.length === Object.keys(data.mapping).length) {
            return res;
          }

          data.mapping = Object.fromEntries(newMapping.map((m) => [m.id, m]));
          return new Response(JSON.stringify(data), {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers
          });
        } catch {
          return res;
        }
      });
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // WIDTH OPTIMIZATION
  // ═══════════════════════════════════════════════════════════════

  const runReady = (sel, cb) => {
    let attempts = 0;
    const check = () => {
      const el = document.querySelector(sel);
      if (el) {
        cb(el);
      } else if (++attempts < CONFIG.WIDTH.MAX_ATTEMPTS) {
        setTimeout(
          check,
          CONFIG.WIDTH.RETRY_BASE_DELAY * CONFIG.WIDTH.RETRY_MULTIPLIER ** attempts
        );
      }
    };
    check();
  };

  const applyWidth = (getElements) => {
    const els = getElements();
    if (!els.length) return;
    for (const el of els) {
      if (el.style.maxWidth === CONFIG.WIDTH.MAX_WIDTH) continue;
      el.style.cssText += `;max-width:${CONFIG.WIDTH.MAX_WIDTH}!important`;
    }
  };

  const observeWidth = (getElements) => {
    let timer = null;
    let isScheduled = false;

    const throttledApply = () => {
      if (isScheduled) return;
      isScheduled = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        applyWidth(getElements);
        isScheduled = false;
      }, CONFIG.WIDTH.THROTTLE_DELAY);
    };

    new MutationObserver((mutations) => {
      if (mutations.some((m) => m.type === "childList" && m.addedNodes.length > 0)) {
        throttledApply();
      }
    }).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  };

  if (isCGPT) {
    const getElements = () => document.querySelectorAll(SELECTORS.CHATGPT.TEXT_BASE);
    runReady(SELECTORS.CHATGPT.TEXT_BASE.split(",")[0], () => {
      applyWidth(getElements);
      observeWidth(getElements);
    });
  } else if (isGemini) {
    const getElements = () => document.querySelectorAll(SELECTORS.GEMINI.CONTAINER);
    runReady(SELECTORS.GEMINI.CONTAINER, () => {
      applyWidth(getElements);
      observeWidth(getElements);
    });
  } else if (isClaude) {
    const getElements = () => {
      const el = document.querySelector(SELECTORS.CLAUDE.RENDER_COUNT);
      if (!el) return [];
      const layer1 = el.parentElement;
      const layer2 = layer1.parentElement;
      return [layer1, layer2];
    };
    runReady(SELECTORS.CLAUDE.STREAMING, () => {
      applyWidth(getElements);
      observeWidth(getElements);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // CHATGPT: DOM CLEANUP & AUTO-CLICK
  // ═══════════════════════════════════════════════════════════════

  if (isCGPT) {
    // DOM cleanup
    const cleanup = () => {
      if (document.visibilityState !== "visible") return;
      const messages = document.querySelectorAll(SELECTORS.CHATGPT.CONVERSATION_TURN);
      if (messages.length > CONFIG.CHATGPT.MAX_MESSAGES) {
        const toRemove = Array.from(messages).slice(
          0,
          messages.length - CONFIG.CHATGPT.MAX_MESSAGES
        );
        for (const el of toRemove) el.remove();
      }
    };

    let currentInterval = null;
    let _currentTimeout = null;

    const scheduleIntervals = (idx) => {
      if (idx < CONFIG.CHATGPT.CLEANUP_INTERVALS.length) {
        const { delay, interval } = CONFIG.CHATGPT.CLEANUP_INTERVALS[idx];
        _currentTimeout = setTimeout(() => {
          currentInterval = setInterval(cleanup, interval);
          setTimeout(() => {
            if (currentInterval) clearInterval(currentInterval);
            scheduleIntervals(idx + 1);
          }, delay);
        }, delay);
      } else {
        currentInterval = setInterval(cleanup, CONFIG.CHATGPT.FINAL_CLEANUP_INTERVAL);
      }
    };

    window.addEventListener("load", () => scheduleIntervals(0));

    // Cached selectors
    let txCache = null;
    let stopBtnCache = null;
    let submitCache = null;
    let lastInvalidate = 0;

    const invalidateCache = () => {
      const now = Date.now();
      if (now - lastInvalidate < CONFIG.CHATGPT.CACHE_INVALIDATION_DELAY) return;
      lastInvalidate = now;
      txCache = stopBtnCache = submitCache = null;
    };

    new MutationObserver(invalidateCache).observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-testid"]
    });

    const getTextarea = () =>
      txCache || (txCache = document.querySelector(SELECTORS.CHATGPT.FORM_TEXTAREA));
    const getStopBtn = () =>
      stopBtnCache || (stopBtnCache = document.querySelector(SELECTORS.CHATGPT.STOP_BUTTON));
    const getSubmitBtn = () =>
      submitCache || (submitCache = document.querySelector(SELECTORS.CHATGPT.SEND_BUTTON));

    const isGenerating = () => {
      const stopBtn = getStopBtn();
      const submitBtn = getSubmitBtn();
      return stopBtn || submitBtn?.firstElementChild?.childElementCount === 3;
    };

    const getContinueBtn = () => {
      const buttons = document.querySelectorAll(SELECTORS.CHATGPT.CONTINUE_BUTTON);
      for (const btn of buttons) {
        if (btn.textContent?.includes("Continue")) return btn;
      }
      return null;
    };

    const getRegenerateBtn = () => {
      const buttons = document.querySelectorAll(SELECTORS.CHATGPT.REGENERATE_BUTTON);
      for (const btn of buttons) {
        if (/^Regenerate$/i.test(btn.textContent?.trim() || "")) return btn;
      }
      return null;
    };

    // Auto-click logic
    let retries = 0;
    let lastRetry = null;

    const init = async () => {
      await new Promise((r) => window.addEventListener("load", r));
      await new Promise((r) => setTimeout(r, CONFIG.CHATGPT.INIT_DELAY));
    };

    const main = async () => {
      await init();
      let first = true;

      const throttledMainLoop = (() => {
        let isRunning = false;
        return async () => {
          if (isRunning) return;
          isRunning = true;
          try {
            const now = Date.now();
            if (lastRetry && now - lastRetry >= CONFIG.CHATGPT.RETRY_RESET_TIME) {
              retries = 0;
            }

            while (true) {
              const waitTime = document.hasFocus()
                ? CONFIG.CHATGPT.LOOP_WAIT_FOCUSED
                : CONFIG.CHATGPT.LOOP_WAIT_UNFOCUSED;
              if (!first) await new Promise((r) => setTimeout(r, waitTime));
              if (!first && isGenerating()) continue;

              const continueBtn = getContinueBtn();
              if (continueBtn) {
                continueBtn.click();
                continue;
              }

              const regenBtn = getRegenerateBtn();
              if (regenBtn && !getTextarea()) {
                if (retries < CONFIG.CHATGPT.MAX_RETRIES) {
                  await new Promise((r) => setTimeout(r, CONFIG.CHATGPT.REGEN_DELAY));
                  regenBtn.click();
                  retries++;
                  lastRetry = Date.now();
                  continue;
                }
                break;
              }

              first = false;
              break;
            }
          } finally {
            isRunning = false;
          }
        };
      })();

      setInterval(throttledMainLoop, 800);
    };

    main();
  }

  // ═══════════════════════════════════════════════════════════════
  // CLAUDE: DOM CLEANUP
  // ═══════════════════════════════════════════════════════════════

  if (isClaude) {
    const cleanup = () => {
      if (document.visibilityState !== "visible") return;
      const messages = document.querySelectorAll(SELECTORS.CLAUDE.RENDER_COUNT);
      if (messages.length > CONFIG.CLAUDE.MAX_MESSAGES) {
        const toRemove = Array.from(messages).slice(
          0,
          messages.length - CONFIG.CLAUDE.MAX_MESSAGES
        );
        for (const el of toRemove) el.remove();
      }
    };

    setInterval(cleanup, CONFIG.CLAUDE.CLEANUP_INTERVAL);
  }
})();
