// ==UserScript==
// @name         ChatGPT/Gemini/Claude Optimizer (Lean)
// @namespace    Ven0m0
// @homepageURL  https://github.com/Ven0m0/Ven0m0-Adblock
// @version      2.1.2
// @description  Width, cleanup, auto-continue/regenerate with minimal overhead.
// @match        https://gemini.google.com/*
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @grant        none
// @run-at       document-start
// ==/UserScript==
(() => {
  // prettier-ignore
  const CFG = {
    CHATGPT: {
      MAX: 15,
      INIT: 10,
      MAX_ITER: 400,
      API: /^https:\/\/chatgpt\.com\/backend-api\/conversation\/[a-f0-9-]{36}$/i,
      INIT_DELAY: 800,
      LOOP_FOCUS: 1500,
      LOOP_BLUR: 12000,
      REGEN_DELAY: 1200,
      MAX_RETRIES: 2,
      RETRY_RESET: 3e5,
      CLEAN: [
        { delay: 7000, interval: 1200 },
        { delay: 10000, interval: 1800 }
      ],
      FINAL: 16000,
      CACHE_WAIT: 400
    },
    CLAUDE: { MAX: 20, CLEAN: 25000 },
    WIDTH: { MAX: "98%", TH: 180, ATTEMPTS: 20, BASE: 200, MUL: 1.08 }
  };
  const SEL = {
    CGPT: {
      TEXT: ".text-base, .text-base > div:first-child",
      TX: "form textarea",
      STOP: 'button[data-testid$="stop-button"]',
      SEND: 'button[data-testid$="send-button"]',
      CONT: 'button[as="button"]',
      REGEN: "button",
      TURN: '[data-testid^="conversation-turn"]'
    },
    GEMINI: { BOX: ".conversation-container" },
    CLAUDE: {
      STREAM: "div[data-is-streaming]",
      RENDER: "div[data-test-render-count]"
    }
  };
  const h = location.hostname;
  const isCGPT = h === "chat.openai.com" || h === "chatgpt.com";
  const isGem = h === "gemini.google.com";
  const isCl = h === "claude.ai";
  const runReady = (sel, cb) => {
    let a = 0;
    const go = () => {
      const el = document.querySelector(sel);
      if (el) cb(el);
      else if (++a < CFG.WIDTH.ATTEMPTS) setTimeout(go, CFG.WIDTH.BASE * CFG.WIDTH.MUL ** a);
    };
    go();
  };
  const applyW = (get) => {
    const els = get();
    if (!els.length) return;
    els.forEach((el) => {
      if (el.style.maxWidth !== CFG.WIDTH.MAX) el.style.cssText += `;max-width:${CFG.WIDTH.MAX}!important`;
    });
  };
  const obsW = (get) => {
    let t = null;
    let b = 0;
    const sched = () => {
      if (b) return;
      b = 1;
      clearTimeout(t);
      t = setTimeout(() => {
        applyW(get);
        b = 0;
      }, CFG.WIDTH.TH);
    };
    new MutationObserver((m) => {
      if (m.some((x) => x.addedNodes.length)) sched();
    }).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (isCGPT) {
    const of = window.fetch;
    window.fetch = function (i, _n) {
      const u = typeof i === "string" ? i : i.url;
      if (!CFG.CHATGPT.API.test(u)) return of.apply(this, arguments);
      return of.apply(this, arguments).then(async (r) => {
        try {
          const d = await r.clone().json();
          const nm = [];
          const seen = new Set();
          let id = d.current_node;
          let v = 0;
          let it = 0;
          while (it++ < CFG.CHATGPT.MAX_ITER && id && !seen.has(id)) {
            const m = d.mapping[id];
            if (!m) break;
            seen.add(id);
            if (m.id === "client-created-root") {
              nm.push(m);
              break;
            }
            const ch = [...m.children];
            while (ch.length && it < CFG.CHATGPT.MAX_ITER) {
              it++;
              const cid = ch.pop();
              const c = d.mapping[cid];
              if (!c || seen.has(cid)) continue;
              seen.add(cid);
              nm.push(c);
              ch.push(...c.children);
            }
            if (v < CFG.CHATGPT.INIT && d.mapping[m.parent]) nm.push(m);
            else {
              nm.push({ ...m, parent: "client-created-root" });
              nm.push({
                id: "client-created-root",
                message: null,
                parent: null,
                children: [m.id]
              });
              break;
            }
            id = m.parent;
            v++;
          }
          if (nm.length === Object.keys(d.mapping).length) return r;
          d.mapping = Object.fromEntries(nm.map((m) => [m.id, m]));
          return new Response(JSON.stringify(d), {
            status: r.status,
            statusText: r.statusText,
            headers: r.headers
          });
        } catch {
          return r;
        }
      });
    };
  }
  if (isCGPT || isGem || isCl) {
    const getEls = isCGPT
      ? () => document.querySelectorAll(SEL.CGPT.TEXT)
      : isGem
        ? () => document.querySelectorAll(SEL.GEMINI.BOX)
        : () => {
            const el = document.querySelector(SEL.CLAUDE.RENDER);
            if (!el) return [];
            return [el.parentElement, el.parentElement?.parentElement].filter(Boolean);
          };
    runReady((isCGPT ? SEL.CGPT.TEXT : SEL.GEMINI.BOX).split(",")[0], () => {
      applyW(getEls);
      obsW(getEls);
    });
  }
  if (isCGPT) {
    const cleanup = () => {
      if (document.visibilityState !== "visible") return;
      const msgs = document.querySelectorAll(SEL.CGPT.TURN);
      if (msgs.length > CFG.CHATGPT.MAX) msgs.forEach((el, i) => i < msgs.length - CFG.CHATGPT.MAX && el.remove());
    };
    let int = null;
    const sched = (i) => {
      if (i < CFG.CHATGPT.CLEAN.length) {
        const { delay, interval } = CFG.CHATGPT.CLEAN[i];
        setTimeout(() => {
          int = setInterval(cleanup, interval);
          setTimeout(() => {
            clearInterval(int);
            sched(i + 1);
          }, delay);
        }, delay);
      } else int = setInterval(cleanup, CFG.CHATGPT.FINAL);
    };
    window.addEventListener("load", () => sched(0));
    let tx = null;
    let stop = null;
    let send = null;
    let lastInv = 0;
    const inv = () => {
      const n = Date.now();
      if (n - lastInv < CFG.CHATGPT.CACHE_WAIT) return;
      lastInv = n;
      tx = stop = send = null;
    };
    new MutationObserver(inv).observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-testid"]
    });
    const getTx = () => tx || (tx = document.querySelector(SEL.CGPT.TX));
    const getStop = () => stop || (stop = document.querySelector(SEL.CGPT.STOP));
    const getSend = () => send || (send = document.querySelector(SEL.CGPT.SEND));
    const isGen = () => getStop() || getSend()?.firstElementChild?.childElementCount === 3;
    const getCont = () =>
      [...document.querySelectorAll(SEL.CGPT.CONT)].find((b) => b.textContent?.includes("Continue"));
    const getRegen = () =>
      [...document.querySelectorAll(SEL.CGPT.REGEN)].find((b) => /^Regenerate$/i.test(b.textContent?.trim() || ""));
    let retries = 0;
    let lastRetry = null;
    const init = async () => {
      await new Promise((r) => window.addEventListener("load", r));
      await new Promise((r) => setTimeout(r, CFG.CHATGPT.INIT_DELAY));
    };
    const loop = (() => {
      let run = 0;
      return async () => {
        if (run) return;
        run = 1;
        try {
          const now = Date.now();
          if (lastRetry && now - lastRetry >= CFG.CHATGPT.RETRY_RESET) retries = 0;
          let first = true;
          while (true) {
            await new Promise((r) =>
              setTimeout(r, document.hasFocus() ? CFG.CHATGPT.LOOP_FOCUS : CFG.CHATGPT.LOOP_BLUR)
            );
            if (!first && isGen()) continue;
            const c = getCont();
            if (c) {
              c.click();
              continue;
            }
            const rg = getRegen();
            if (rg && !getTx()) {
              if (retries < CFG.CHATGPT.MAX_RETRIES) {
                await new Promise((r) => setTimeout(r, CFG.CHATGPT.REGEN_DELAY));
                rg.click();
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
          run = 0;
        }
      };
    })();
    init().then(() => setInterval(loop, 700));
  }
  if (isCl) {
    const clean = () => {
      if (document.visibilityState !== "visible") return;
      const m = document.querySelectorAll(SEL.CLAUDE.RENDER);
      if (m.length > CFG.CLAUDE.MAX) m.forEach((el, i) => i < m.length - CFG.CLAUDE.MAX && el.remove());
    };
    setInterval(clean, CFG.CLAUDE.CLEAN);
  }
})();
