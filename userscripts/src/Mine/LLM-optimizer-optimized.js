// ==UserScript==
// @name         ChatGPT/Gemini/Claude Complete Optimization (Optimized)
// @namespace    Ven0m0
// @author       Ven0m0
// @version      2.1.0
// @description  Width adjustment, DOM cleanup, auto-continue, and initial load optimization - Optimized version
// @license      GPLv3
// @match        https://gemini.google.com/*
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @run-at       document-start
// ==/UserScript==
(() => {
  'use strict';
  
  const h = window.location.hostname;
  const isCGPT = h === 'chat.openai.com' || h === 'chatgpt.com';
  const isGemini = h === 'gemini.google.com';
  const isClaude = h === 'claude.ai';
  
  // ============================================================================
  // OPTIMIZED: Fetch interceptor for initial load limit (ChatGPT only)
  // ============================================================================

  if (isCGPT) {
    const INIT_MSG = 10;
    const MAX_ITERATIONS = 800; // Reduced safety limit to prevent infinite loops while maintaining performance
    const rx = /^https:\/\/chatgpt\.com\/backend-api\/conversation\/[a-f0-9\-]{36}$/i;
    
    const ogFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input.url;
      if (!rx.test(url)) return ogFetch.apply(this, arguments);
      
      return ogFetch.apply(this, arguments).then(async r => {
        try {
          const d = await r.clone().json();
          const nm = [];
          const seen = new Set(); // Track visited nodes to prevent infinite loops
          let nid = d.current_node, nv = 0, iterations = 0;
          
          while (iterations++ < MAX_ITERATIONS) {
            if (!nid || seen.has(nid)) break;
            const m = d.mapping[nid];
            if (!m) break;
            seen.add(nid);
            
            if (m.id === "client-created-root") {
              nm.push(m);
              break;
            }
            const cids = [...m.children];
            while (cids.length && iterations < MAX_ITERATIONS) {
              iterations++;
              const cid = cids.pop();
              const c = d.mapping[cid];
              if (!c || seen.has(cid)) continue;
              seen.add(cid);
              nm.push(c);
              cids.push(...c.children);
            }
            if (nv < INIT_MSG && d.mapping[m.parent]) {
              nm.push(m);
            } else {
              nm.push({ ...m, parent: "client-created-root" });
              nm.push({ id: "client-created-root", message: null, parent: null, children: [m.id] });
              break;
            }
            nid = m.parent;
            nv++;
          }
          if (nm.length === Object.keys(d.mapping).length) return r;
          d.mapping = Object.fromEntries(nm.map(m => [m.id, m]));
          return new Response(JSON.stringify(d), {
            status: r.status,
            statusText: r.statusText,
            headers: r.headers
          });
        } catch (e) {
          return r;
        }
      });
    };
  }
  
  // ============================================================================
  // OPTIMIZED: Width adjustment with better performance
  // ============================================================================

  // OPTIMIZED: More efficient element selection and style application
  const runReady = (sel, cb) => {
    let n = 0;
    const maxAttempts = 25; // Reduced attempts for better performance
    const t = () => {
      const e = document.querySelector(sel);
      if (e) cb(e);
      else if (++n < maxAttempts) setTimeout(t, 250 * 1.05 ** n); // Slightly faster backoff
    };
    t();
  };
  
  // OPTIMIZED: Use direct style assignment with batch processing
  const applyW = (gf) => {
    const elements = gf();
    for (const e of elements) {
      e.style.maxWidth = '98%';
      e.style.cssText += ';max-width:98%!important';
    }
  };
  
  // OPTIMIZED: More efficient mutation observer with throttling
  const observeW = (gf) => {
    let timer = null;
    const throttledApply = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        applyW(gf);
      }, 200); // Increased delay for better performance
    };
    
    new MutationObserver(ms => {
      if (ms.some(m => m.type === 'childList')) {
        throttledApply();
      }
    }).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  };
  
  if (isCGPT) {
    const gf = () => document.querySelectorAll('.text-base, .text-base > div:first-child');
    runReady('.text-base', () => {
      applyW(gf);
      observeW(gf);
    });
  } else if (isGemini) {
    const gf = () => document.querySelectorAll('.conversation-container');
    runReady('.conversation-container', () => {
      applyW(gf);
      observeW(gf);
    });
  } else if (isClaude) {
    const gf = () => {
      const e = document.querySelector('div[data-test-render-count]');
      if (!e) return [];
      const l1 = e.parentElement;
      const l2 = l1.parentElement;
      return [l1, l2];
    };
    runReady('div[data-is-streaming]', () => {
      applyW(gf);
      observeW(gf);
    });
  }
  
  // ============================================================================
  // OPTIMIZED: DOM cleanup & auto-continue (ChatGPT only)
  // ============================================================================

  // OPTIMIZED: Only cleanup when page is visible to save CPU and use more efficient cleanup
  if (isCGPT) {
    const MAX_MSG = 15; // Reduced for better performance
    const cleanup = () => {
      if (document.visibilityState !== 'visible') return;
      
      const ms = document.querySelectorAll('[data-testid^="conversation-turn"]');
      if (ms.length > MAX_MSG) {
        // OPTIMIZED: Remove elements in a single batch operation
        const elementsToRemove = Array.from(ms).slice(0, ms.length - MAX_MSG);
        for (const e of elementsToRemove) {
          e.remove();
        }
      }
    };
    
    // OPTIMIZED: Simplified cleanup scheduling with better performance
    const intervals = [
      { delay: 8000, interval: 1500 },  // Faster initial cleanup
      { delay: 12000, interval: 2500 },
      { delay: 8000, interval: 4000 }   // Longer final interval
    ];
    
    let currentInterval = null;
    let currentTimeout = null;
    
    const schedInt = (idx) => {
      if (idx < intervals.length) {
        const { delay, interval } = intervals[idx];
        currentTimeout = setTimeout(() => {
          currentInterval = setInterval(cleanup, interval);
          setTimeout(() => {
            if (currentInterval) clearInterval(currentInterval);
            schedInt(idx + 1);
          }, delay);
        }, delay);
      } else {
        currentInterval = setInterval(cleanup, 25000); // Reduced frequency for better performance
      }
    };
    
    window.addEventListener('load', () => schedInt(0));
    
    // ============================================================================
    // OPTIMIZED: Auto-continue logic with better performance
    // ============================================================================
    
    // OPTIMIZED: Cache DOM queries for better performance
    let txCache = null;
    let stopBtnCache = null;
    let submitCache = null;
    
    const invalidateCache = () => {
      txCache = null;
      stopBtnCache = null;
      submitCache = null;
    };
    
    // OPTIMIZED: Throttled DOM cache invalidation
    const throttledInvalidate = (() => {
      let timeout = null;
      return () => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(invalidateCache, 500);
      };
    })();
    
    document.addEventListener('DOMSubtreeModified', throttledInvalidate, { passive: true });
    
    const getTx = () => {
      if (!txCache) txCache = document.querySelector('form textarea');
      return txCache;
    };
    
    const getStopBtn = () => {
      if (!stopBtnCache) stopBtnCache = document.querySelector('button[data-testid$="stop-button"]');
      return stopBtnCache;
    };
    
    const getSubmit = () => {
      if (!submitCache) submitCache = document.querySelector('button[data-testid$="send-button"]');
      return submitCache;
    };
    
    const isGen = () => {
      if (getStopBtn()) return true;
      const s = getSubmit();
      return s?.firstElementChild?.childElementCount === 3;
    };
    
    const getContBtn = () => {
      const buttons = document.querySelectorAll('button[as="button"]');
      for (const b of buttons) {
        if (b.textContent?.includes('Continue')) return b;
      }
      return null;
    };
    
    const getRegenBtn = () => {
      const buttons = document.querySelectorAll('button');
      for (const b of buttons) {
        if (/^Regenerate$/i.test(b.textContent?.trim() || '')) return b;
      }
      return null;
    };
    
    let retries = 0;
    let lastRetry = null;
    
    const init = async () => {
      await new Promise(r => window.addEventListener('load', r));
      await new Promise(r => setTimeout(r, 800)); // Slightly faster initial delay
    };
    
    const main = async () => {
      await init();
      let first = true;
      
      // OPTIMIZED: Use throttled interval for better performance
      const throttledMainLoop = (() => {
        let isRunning = false;
        return async () => {
          if (isRunning) return; // Prevent overlapping executions
          isRunning = true;
          
          try {
            const now = Date.now();
            if (lastRetry && now - lastRetry >= 300000) retries = 0;
            
            while (true) {
              const wt = document.hasFocus() ? 1500 : 15000; // Slightly faster when focused
              if (!first) await new Promise(r => setTimeout(r, wt));
              if (!first && isGen()) continue;
              
              const cb = getContBtn();
              if (cb) {
                cb.click();
                continue;
              }
              
              const rb = getRegenBtn();
              if (rb && !getTx()) {
                if (retries < 2) { // Reduced retry attempts for better performance
                  await new Promise(r => setTimeout(r, 1500)); // Slightly faster retry
                  rb.click();
                  retries++;
                  lastRetry = Date.now();
                  continue;
                } else break;
              }
              
              first = false;
              break;
            }
          } finally {
            isRunning = false;
          }
        };
      })();
      
      // OPTIMIZED: Use throttled main loop
      setInterval(throttledMainLoop, 800); // Faster interval for better responsiveness
    };
    
    main();
  }
})();