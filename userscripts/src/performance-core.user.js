// ==UserScript==
// @name         Performance Core
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Timer clamping, background throttle, 30fps cap, dark mode, WebGL block,
//               GIF freeze, script defer — all configurable via the Tampermonkey menu.
//               Replaces: Absolute Performance, Ultimate Battery Saver.
// @author       merged + fixed
// @match        *://*/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(() => {
    'use strict';

    /* ── Defaults ────────────────────────────────────────────────────────────── */
    const DEFAULTS = {
        timerClamp    : true,   // setTimeout ≥10ms, setInterval ≥16ms  (was Absolute Performance)
        throttleBG    : true,   // push timers to ≥2000ms when tab is hidden
        limitFPS      : false,  // cap requestAnimationFrame at 30fps
        silenceConsole: false,  // suppress all console output
        darkMode      : false,  // force dark background (can break sites)
        disableWebGL  : false,  // null-return WebGL context (saves GPU)
        pauseGIFs     : false,  // canvas-snapshot GIFs to freeze animation
        deferScripts  : false,  // add defer= to blocking <script src> tags
    };

    /* ── Settings load/save ──────────────────────────────────────────────────── */
    const STORE_KEY = 'perf-core-v1';
    let S = {};

    const save = () => GM_setValue(STORE_KEY, JSON.stringify(S));
    const load = () => {
        try   { S = { ...DEFAULTS, ...JSON.parse(GM_getValue(STORE_KEY, '{}')) }; }
        catch { S = { ...DEFAULTS }; }
    };
    load();

    /* ── Capture native APIs before any wrapping ─────────────────────────────── */
    const nativeST  = window.setTimeout.bind(window);
    const nativeSI  = window.setInterval.bind(window);
    const nativeCT  = window.clearTimeout.bind(window);
    const nativeCI  = window.clearInterval.bind(window);
    const nativeRAF = window.requestAnimationFrame.bind(window);

    /* ── Timer clamping (Absolute Performance) ───────────────────────────────── */
    // Build "active" versions once — reused on visibility restore
    const clampST = S.timerClamp
        ? (fn, ms, ...a) => nativeST(fn, Math.max(ms | 0, 10), ...a)
        : nativeST;
    const clampSI = S.timerClamp
        ? (fn, ms, ...a) => nativeSI(fn, Math.max(ms | 0, 16), ...a)
        : nativeSI;

    window.setTimeout  = clampST;
    window.setInterval = clampSI;

    /* ── Background throttle ─────────────────────────────────────────────────── */
    if (S.throttleBG) {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Push all timers to ≥2s when hidden
                window.setTimeout  = (fn, ms, ...a) => nativeST(fn, Math.max(ms | 0, 2000), ...a);
                window.setInterval = (fn, ms, ...a) => nativeSI(fn, Math.max(ms | 0, 2000), ...a);
            } else {
                // Restore to clamped (or native) versions
                window.setTimeout  = clampST;
                window.setInterval = clampSI;
            }
        });
    }

    /* ── Console silencing ───────────────────────────────────────────────────── */
    if (S.silenceConsole) {
        const noop = () => {};
        ['log', 'warn', 'error', 'debug', 'info'].forEach(m => { console[m] = noop; });
    }

    /* ── 30fps cap ───────────────────────────────────────────────────────────── */
    if (S.limitFPS) {
        const frameMs  = 1000 / 30;
        let   lastFrame = 0;
        // Always return a valid handle; skip invoking callback if frame is too soon
        window.requestAnimationFrame = cb => nativeRAF(ts => {
            const now = Date.now();
            if (now - lastFrame >= frameMs) { lastFrame = now; cb(ts); }
        });
    }

    /* ── WebGL block ─────────────────────────────────────────────────────────── */
    if (S.disableWebGL) {
        try {
            const origGetContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (type, ...args) {
                if (type === 'webgl' || type === 'webgl2') return null;
                return origGetContext.call(this, type, ...args);
            };
        } catch {}
    }

    /* ── Dark mode ───────────────────────────────────────────────────────────── */
    if (S.darkMode) {
        GM_addStyle(`
            html, body                          { background: #121212 !important; color: #e0e0e0 !important; }
            :not(pre) > code, pre               { background: #212121 !important; color: #e0e0e0 !important; }
            img, video, canvas                  { filter: invert(1) hue-rotate(180deg); }
        `);
    }

    /* ── DOM-ready features ──────────────────────────────────────────────────── */
    const onReady = () => {
        // GIF pauser: draw first frame to canvas — no broken-image icon
        // FIXED: original cleared img.src causing the broken image flash
        if (S.pauseGIFs) {
            document.querySelectorAll('img[src$=".gif"]').forEach(img => {
                const snap = () => {
                    if (!img.naturalWidth) return;
                    const c = document.createElement('canvas');
                    c.width       = img.naturalWidth;
                    c.height      = img.naturalHeight;
                    c.style.cssText = img.style.cssText;
                    c.className   = img.className;
                    c.title       = 'Click to play GIF';
                    try { c.getContext('2d').drawImage(img, 0, 0); } catch { return; }
                    c.onclick = () => c.replaceWith(img);
                    img.replaceWith(c);
                };
                img.complete ? snap() : img.addEventListener('load', snap, { once: true });
            });
        }

        // Script defer: add defer= to all blocking external scripts
        // FIXED: original suspended idle tabs by navigating to about:blank (broken)
        if (S.deferScripts) {
            document.querySelectorAll('script[src]:not([defer]):not([async])')
                .forEach(s => { s.defer = true; });
        }
    };

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', onReady, { once: true })
        : onReady();

    /* ── Settings UI (Tampermonkey / Violentmonkey menu) ────────────────────── */
    GM_registerMenuCommand('Performance Core ⚡ Settings', showUI);

    function showUI() {
        const ID = 'perf-core-panel';
        if (document.getElementById(ID)) return;

        const LABELS = {
            timerClamp    : 'Clamp timers  (setTimeout ≥10ms, setInterval ≥16ms)',
            throttleBG    : 'Throttle timers in background/hidden tabs  (≥2000ms)',
            limitFPS      : 'Cap frame rate at 30fps  (saves CPU/battery)',
            silenceConsole: 'Silence all console output',
            darkMode      : 'Force dark background on all sites',
            disableWebGL  : 'Disable WebGL  (saves GPU power)',
            pauseGIFs     : 'Freeze GIF animations  (canvas snapshot)',
            deferScripts  : 'Add defer= to blocking <script> tags',
        };

        const rows = Object.entries(LABELS).map(([k, label]) => `
            <label class="pc-row">
                <input type="checkbox" data-k="${k}" ${S[k] ? 'checked' : ''}>
                <span>${label}</span>
            </label>`).join('');

        const panel = document.createElement('div');
        panel.id = ID;
        panel.innerHTML = `
            <style>
                #${ID} {
                    font-family: sans-serif; position: fixed; inset: 0; z-index: 999999;
                    display: flex; align-items: center; justify-content: center;
                    background: rgba(0,0,0,.82); backdrop-filter: blur(4px);
                }
                .pc-modal {
                    background: #1e1e1e; color: #eee; border-radius: 10px;
                    padding: 20px; max-width: 460px; width: 92%;
                }
                .pc-modal h2   { margin: 0 0 14px; font-size: 1.05em; border-bottom: 1px solid #444; padding-bottom: 8px; }
                .pc-row        { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 9px; cursor: pointer; font-size: .88em; line-height: 1.4; }
                .pc-row input  { margin-top: 2px; flex-shrink: 0; }
                .pc-note       { font-size: .78em; color: #888; margin: 6px 0 0; }
                .pc-modal button {
                    background: #0070f3; color: #fff; border: none; border-radius: 6px;
                    cursor: pointer; width: 100%; padding: 8px; margin-top: 10px; font-size: .9em;
                }
                .pc-modal button:hover { background: #0058c4; }
            </style>
            <div class="pc-modal">
                <h2>⚡ Performance Core</h2>
                ${rows}
                <p class="pc-note">Changes take effect on the next page load.</p>
                <button id="pc-close">Close</button>
            </div>`;

        document.body.appendChild(panel);

        panel.querySelector('#pc-close').onclick = () => panel.remove();
        panel.querySelectorAll('input[type=checkbox]').forEach(cb => {
            cb.onchange = e => { S[e.target.dataset.k] = e.target.checked; save(); };
        });
    }

})();
