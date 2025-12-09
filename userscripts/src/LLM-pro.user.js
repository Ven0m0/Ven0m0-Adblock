// ==UserScript==
// @name         ChatGPT/Gemini/Claude Complete Optimization (Compact)
// @namespace    Ven0m0
// @homepageURL  https://github.com/Ven0m0/Ven0m0-Adblock
// @version      2.1.0-c
// @description  DOM/width/cleanup/autoclick/fork handlers for LLM sites
// @match        https://gemini.google.com/*
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @run-at       document-start
// ==/UserScript==
"use strict";
(() => {
    const h = location.hostname;
    const isCGPT = h === "chat.openai.com" || h === "chatgpt.com";
    const isGemini = h === "gemini.google.com";
    const isClaude = h === "claude.ai";
    if (isCGPT) {
        const INIT_MSG = 10,
            MAX_ITER = 800,
            rx = /^https:\/\/chatgpt\.com\/backend-api\/conversation\/[a-f0-9-]{36}$/i;
        const ogFetch = window.fetch;
        window.fetch = function(input, _init) {
            const url = typeof input === "string" ? input : input.url;
            if (!rx.test(url)) return ogFetch.apply(this, arguments);
            return ogFetch.apply(this, arguments).then(async (r) => {
                try {
                    const d = await r.clone().json();
                    const nm = [],
                        seen = new Set();
                    let nid = d.current_node,
                        nv = 0,
                        iterations = 0;
                    while (iterations++ < MAX_ITER) {
                        if (!nid || seen.has(nid)) break;
                        const m = d.mapping[nid];
                        if (!m) break;
                        seen.add(nid);
                        if (m.id === "client-created-root") {
                            nm.push(m);
                            break;
                        }
                        const cids = [...m.children];
                        while (cids.length && iterations < MAX_ITER) {
                            iterations++;
                            const cid = cids.pop(),
                                c = d.mapping[cid];
                            if (!c || seen.has(cid)) continue;
                            seen.add(cid);
                            nm.push(c);
                            cids.push(...c.children);
                        }
                        if (nv < INIT_MSG && d.mapping[m.parent]) nm.push(m);
                        else {
                            nm.push({
                                ...m,
                                parent: "client-created-root"
                            });
                            nm.push({
                                id: "client-created-root",
                                message: null,
                                parent: null,
                                children: [m.id]
                            });
                            break;
                        }
                        nid = m.parent;
                        nv++;
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
    const runReady = (sel, cb) => {
        let n = 0,
            maxAttempts = 25;
        const t = () => {
            const e = document.querySelector(sel);
            if (e) cb(e);
            else if (++n < maxAttempts) setTimeout(t, 250 * 1.05 ** n);
        };
        t();
    };
    const applyW = (gf) => {
        const els = gf();
        if (els.length === 0) return;
        for (const e of els) {
            if (e.style.maxWidth === "98%") continue;
            e.style.cssText += ";max-width:98%!important";
        }
    };
    const observeW = (gf) => {
        let timer = null,
            isScheduled = false;
        const throttledApply = () => {
            if (isScheduled) return;
            isScheduled = true;
            clearTimeout(timer);
            timer = setTimeout(() => {
                applyW(gf);
                isScheduled = false;
            }, 200);
        };
        new MutationObserver((ms) => {
            if (ms.some((m) => m.type === "childList" && m.addedNodes.length > 0)) throttledApply();
        }).observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    };
    if (isCGPT) {
        const gf = () => document.querySelectorAll(".text-base, .text-base > div:first-child");
        runReady(".text-base", () => {
            applyW(gf);
            observeW(gf);
        });
    } else if (isGemini) {
        const gf = () => document.querySelectorAll(".conversation-container");
        runReady(".conversation-container", () => {
            applyW(gf);
            observeW(gf);
        });
    } else if (isClaude) {
        const gf = () => {
            const e = document.querySelector("div[data-test-render-count]");
            if (!e) return [];
            const l1 = e.parentElement,
                l2 = l1.parentElement;
            return [l1, l2];
        };
        runReady("div[data-is-streaming]", () => {
            applyW(gf);
            observeW(gf);
        });
    }
    if (isCGPT) {
        const MAX_MSG = 15;
        const cleanup = () => {
            if (document.visibilityState !== "visible") return;
            const ms = document.querySelectorAll('[data-testid^="conversation-turn"]');
            if (ms.length > MAX_MSG) {
                const rm = Array.from(ms).slice(0, ms.length - MAX_MSG);
                for (const e of rm) e.remove();
            }
        };
        const intervals = [{
                delay: 8e3,
                interval: 1500
            },
            {
                delay: 12e3,
                interval: 2500
            },
            {
                delay: 8e3,
                interval: 4000
            }
        ];
        let currentInterval = null,
            _currentTimeout = null;
        const schedInt = (idx) => {
            if (idx < intervals.length) {
                const {
                    delay,
                    interval
                } = intervals[idx];
                _currentTimeout = setTimeout(() => {
                    currentInterval = setInterval(cleanup, interval);
                    setTimeout(() => {
                        if (currentInterval) clearInterval(currentInterval);
                        schedInt(idx + 1);
                    }, delay);
                }, delay);
            } else {
                currentInterval = setInterval(cleanup, 25e3);
            }
        };
        window.addEventListener("load", () => schedInt(0));
        let txCache = null,
            stopBtnCache = null,
            submitCache = null,
            lastInvalidate = 0;
        const invalidateCache = () => {
            const now = Date.now();
            if (now - lastInvalidate < 500) return;
            lastInvalidate = now;
            txCache = stopBtnCache = submitCache = null;
        };
        new MutationObserver(invalidateCache).observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["data-testid"]
        });
        const getTx = () => txCache || (txCache = document.querySelector("form textarea"));
        const getStopBtn = () =>
            stopBtnCache || (stopBtnCache = document.querySelector('button[data-testid$="stop-button"]'));
        const getSubmit = () =>
            submitCache || (submitCache = document.querySelector('button[data-testid$="send-button"]'));
        const isGen = () => getStopBtn() || getSubmit()?.firstElementChild?.childElementCount === 3;
        const getContBtn = () => {
            const buttons = document.querySelectorAll('button[as="button"]');
            for (const b of buttons)
                if (b.textContent?.includes("Continue")) return b;
            return null;
        };
        const getRegenBtn = () => {
            const buttons = document.querySelectorAll("button");
            for (const b of buttons)
                if (/^Regenerate$/i.test(b.textContent?.trim() || "")) return b;
            return null;
        };
        let retries = 0,
            lastRetry = null;
        const init = async () => {
            await new Promise((r) => window.addEventListener("load", r));
            await new Promise((r) => setTimeout(r, 800));
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
                        if (lastRetry && now - lastRetry >= 3e5) retries = 0;
                        while (true) {
                            const wt = document.hasFocus() ? 1500 : 15000;
                            if (!first) await new Promise((r) => setTimeout(r, wt));
                            if (!first && isGen()) continue;
                            const cb = getContBtn();
                            if (cb) {
                                cb.click();
                                continue;
                            }
                            const rb = getRegenBtn();
                            if (rb && !getTx()) {
                                if (retries < 2) {
                                    await new Promise((r) => setTimeout(r, 1500));
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
            setInterval(throttledMainLoop, 800);
        };
        main();
    }
    if (isClaude) {
        const cleanup = () => {
            if (document.visibilityState !== "visible") return;
            const msgs = document.querySelectorAll("[data-test-render-count]");
            if (msgs.length > 20) {
                const rm = Array.from(msgs).slice(0, msgs.length - 20);
                for (const e of rm) e.remove();
            }
        };
        setInterval(cleanup, 30e3);
    }
})();
// end
