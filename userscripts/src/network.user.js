// ==UserScript==
// @name         Network Optimizer
// @namespace    https://tampermonkey.net/
// @version      1.0
// @license      MIT
// @description  Connection-aware: tracker/font/beacon blocking, lazy load, hover prefetch,
//               inline minify, preconnect, YouTube download button. Replaces: Enhanced Faster
//               Webpage Loading, HyperLite, Lazy Load Image, Lazy Load Images and Videos,
//               Super Fast Load.
// @author       merged + fixed
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    // Per-site kill switch (HyperLite toggle)
    const SITE_KEY = 'netopt:disable:' + location.hostname;
    if (localStorage.getItem(SITE_KEY) === '1') return;

    /* ── Connection-aware mode ─────────────────────────────────────────────── */
    // 0 = balanced  |  1 = slow (2g / saveData)  |  2 = extreme (slow-2g)
    const conn = navigator.connection;
    const eff  = conn?.effectiveType;
    const MODE = eff === 'slow-2g' ? 2 : (conn?.saveData || eff?.includes('2g')) ? 1 : 0;

    /* ── Config ────────────────────────────────────────────────────────────── */
    const CFG = {
        // always-on
        BLOCK_PREFETCH  : true,
        BLOCK_TRACKERS  : true,
        BLOCK_BEACONS   : true,
        LAZY_IMAGES     : true,   // native loading=lazy + data-src IntersectionObserver
        HOVER_PREFETCH  : true,   // prefetch links on hover / touchstart

        // slow / extreme only
        BLOCK_FONTS     : MODE >= 1,
        STOP_AUTOPLAY   : MODE >= 1,
        LAZY_IFRAMES    : MODE >= 1,
        OPTIMIZE_INLINE : MODE >= 1,  // regex-minify inline <style> / <script>

        // extreme only
        FINGERPRINT_REDUCE : MODE === 2,

        // site-specific (carried over from Super Fast Load)
        TRUSTED_DOMAINS : [
            'digikala.com', 'dkstatics-public.digikala.com',
            'aparat.com',   'cdn.asset.aparat.com',
        ],
        REMOVE_JUNK        : true,
        JUNK_SELECTORS     : ['#disqus_thread', '.twitter-timeline', 'iframe[src*="facebook.com"]'],
        YOUTUBE_BUTTON     : true,
    };

    /* ── Tracker list (combined from HyperLite + Super Fast Load) ──────────── */
    const TRACKER_HOSTS = new Set([
        'google-analytics.com', 'googletagmanager.com', 'doubleclick.net',
        'googlesyndication.com', 'adservice.google.com',
        'facebook.com', 'connect.facebook.net',
        'clarity.ms', 'hotjar.com', 'sentry.io',
        'mixpanel.com', 'segment.com', 'fullstory.com',
        'onesignal.com', 'adverge.com',
    ]);
    const TRACKER_KW = ['analytics', 'googletagmanager', 'tracking', 'beacon', 'hotjar', 'clarity'];
    const ALLOW_KW   = ['jquery', 'bootstrap', 'core', 'essential', 'react', 'chunk', 'runtime', 'main', 'cloudflare', 'captcha'];

    /* ── URL helpers ───────────────────────────────────────────────────────── */
    const pageHost   = location.hostname;
    const mainDomain = pageHost.split('.').slice(-2).join('.');
    const trusted    = new Set([mainDomain.split('.')[0], ...CFG.TRUSTED_DOMAINS]);

    const isTrusted = url => {
        if (!url) return false;
        try {
            const h = new URL(url, location.origin).hostname;
            if (h.endsWith(mainDomain)) return true;
            for (const t of trusted) if (h.includes(t)) return true;
        } catch {}
        return false;
    };

    const isTracker = url => {
        if (!url || isTrusted(url)) return false;
        try {
            const h  = new URL(url, location.origin).hostname;
            if ([...TRACKER_HOSTS].some(t => h.endsWith(t))) return true;
            const lc = url.toLowerCase();
            if (ALLOW_KW.some(k => lc.includes(k)))   return false;
            if (TRACKER_KW.some(k => lc.includes(k))) return true;
        } catch {}
        return false;
    };

    const isFontUrl = url => {
        if (!CFG.BLOCK_FONTS || !url) return false;
        const lc = url.toLowerCase();
        return lc.includes('fonts.googleapis.com') || lc.endsWith('.woff') || lc.endsWith('.woff2');
    };

    /* ── Fingerprint reduction (extreme only) ──────────────────────────────── */
    if (CFG.FINGERPRINT_REDUCE) {
        const prop = (k, v) => Object.defineProperty(navigator, k, { get: () => v, configurable: true });
        prop('hardwareConcurrency', 2);
        prop('deviceMemory', 2);
        prop('plugins', []);
        prop('mimeTypes', []);
    }

    /* ── Beacon + fetch overrides ───────────────────────────────────────────── */
    if (CFG.BLOCK_BEACONS) {
        const origBeacon = navigator.sendBeacon?.bind(navigator);
        if (origBeacon) {
            navigator.sendBeacon = (url, data) =>
                isTracker(url) ? false : origBeacon(url, data);
        }
    }

    if (CFG.BLOCK_TRACKERS) {
        const origFetch = window.fetch;
        window.fetch = (url, ...args) => {
            if (typeof url === 'string' && isTracker(url)) return new Promise(() => {});
            return origFetch.call(window, url, ...args);
        };
    }

    /* ── Inline CSS/JS minification ─────────────────────────────────────────── */
    const minify = str => str.replace(/\s*([{}:;,])\s*/g, '$1').replace(/;}/g, '}').trim();

    /* ── IntersectionObserver for data-src elements ─────────────────────────── */
    const dataSrcIO = new IntersectionObserver((entries, obs) => {
        for (const { isIntersecting, target: el } of entries) {
            if (!isIntersecting) continue;
            el.src = el.dataset.src;
            el.removeAttribute('data-src');
            if (el.tagName === 'VIDEO') el.load();
            obs.unobserve(el);
        }
    }, { rootMargin: '200px' });

    /* ── Process a single newly-added node ──────────────────────────────────── */
    const processed = new WeakSet();

    const processNode = node => {
        if (!(node instanceof HTMLElement) || processed.has(node)) return;
        processed.add(node);

        const src = node.src || node.href || '';
        const tag = node.tagName;

        // Tracker blocking
        if (src && isTracker(src)) {
            if (tag === 'SCRIPT' || tag === 'IFRAME') {
                node.type = 'javascript/blocked';
                node.src  = 'about:blank';
            } else {
                node.remove();
            }
            return;
        }

        switch (tag) {
            case 'LINK':
                if (CFG.BLOCK_PREFETCH && (node.rel === 'prefetch' || node.rel === 'preload')) {
                    node.remove(); return;
                }
                if (isFontUrl(node.href)) { node.remove(); return; }
                break;

            case 'STYLE':
                if (CFG.OPTIMIZE_INLINE && node.textContent?.length < 15000)
                    node.textContent = minify(node.textContent);
                break;

            case 'SCRIPT':
                if (CFG.OPTIMIZE_INLINE && node.textContent?.length < 15000)
                    node.textContent = minify(node.textContent);
                break;

            case 'IMG':
                if (CFG.LAZY_IMAGES) {
                    if (node.dataset.src) dataSrcIO.observe(node);
                    else node.loading = 'lazy';
                    node.decoding = 'async';
                }
                break;

            case 'VIDEO':
            case 'AUDIO':
                if (CFG.STOP_AUTOPLAY) {
                    node.autoplay = false;
                    node.preload  = 'metadata';
                }
                break;

            case 'IFRAME':
                // FIXED: was node.replaceWith(node) — a no-op
                if (CFG.LAZY_IFRAMES && src) {
                    const btn = document.createElement('button');
                    btn.textContent   = 'Load content';
                    btn.style.cssText = 'padding:6px;font-size:12px;touch-action:manipulation';
                    btn.onclick       = () => btn.replaceWith(node);
                    node.replaceWith(btn);
                }
                break;
        }
    };

    /* ── Single MutationObserver for all DOM work ───────────────────────────── */
    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType !== 1) continue;
                processNode(node);
                node.querySelectorAll?.('img,video,audio,script,link,style,iframe')
                    .forEach(processNode);
            }
        }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    /* ── Hover / touchstart prefetch ────────────────────────────────────────── */
    if (CFG.HOVER_PREFETCH) {
        const EXCL      = /\/log(?:in|out)|\/sign(?:in|out)|\/auth|\/account/;
        const prefetched = new Set();

        const doPrefetch = e => {
            const a = e.target.closest('a[href]');
            if (!a || a.dataset.noPrefetch) return;
            const { href } = a;
            if (prefetched.has(href) || EXCL.test(href) || isTracker(href)) return;
            prefetched.add(href);
            const link = document.createElement('link');
            link.rel = 'prefetch'; link.href = href; link.as = 'document';
            document.head?.appendChild(link);
        };

        document.addEventListener('mouseover',  doPrefetch, { passive: true });
        document.addEventListener('touchstart', doPrefetch, { passive: true });
    }

    /* ── Preconnect trusted domains ─────────────────────────────────────────── */
    const preconnect = () => {
        const seen = new Set();
        for (const domain of CFG.TRUSTED_DOMAINS) {
            try {
                if (pageHost.endsWith(domain) || seen.has(domain)) continue;
                seen.add(domain);
                const origin = `https://${domain}`;
                const head   = document.head || document.documentElement;
                const pc  = Object.assign(document.createElement('link'), { rel: 'preconnect',  href: origin, crossOrigin: 'anonymous' });
                const dns = Object.assign(document.createElement('link'), { rel: 'dns-prefetch', href: origin });
                head.appendChild(pc);
                head.appendChild(dns);
            } catch {}
        }
    };

    /* ── YouTube download button ─────────────────────────────────────────────── */
    const addYouTubeButton = () => {
        if (!CFG.YOUTUBE_BUTTON || !pageHost.includes('youtube.com')) return;

        const run = () => {
            if (document.getElementById('netopt-yt-btn')) return;
            const ctrl = document.querySelector('.ytp-right-controls');
            if (!ctrl) return;
            const btn = document.createElement('button');
            btn.id        = 'netopt-yt-btn';
            btn.className = 'ytp-button';
            btn.title     = 'Download Video';
            btn.innerHTML = '<svg height="100%" viewBox="0 0 36 36" width="100%"><path d="M17 18v1H6v-1h11zm-.5-6.6-.7-.7-3.8 3.7V4h-1v10.4l-3.8-3.8-.7.7 5 5 5-4.9z" fill="#fff"/></svg>';
            btn.onclick   = () => window.open(`https://yt1s.com/?q=${encodeURIComponent(location.href)}`, '_blank');
            ctrl.insertBefore(btn, ctrl.firstChild);
        };

        run();
        const title = document.querySelector('title');
        if (title) new MutationObserver(run).observe(title, { childList: true });
    };

    /* ── DOMContentLoaded: scan existing DOM ────────────────────────────────── */
    const onReady = () => {
        // Scan elements that existed before the observer attached
        document.querySelectorAll('img,video,audio,script,link,style,iframe').forEach(processNode);

        // data-src lazy load for pre-existing elements
        document.querySelectorAll('img[data-src],video[data-src],iframe[data-src]')
            .forEach(el => dataSrcIO.observe(el));

        // Native lazy on all remaining images
        if (CFG.LAZY_IMAGES) {
            document.querySelectorAll('img:not([data-src])').forEach(img => {
                img.loading  = 'lazy';
                img.decoding = 'async';
            });
        }

        if (CFG.REMOVE_JUNK) {
            CFG.JUNK_SELECTORS.forEach(sel =>
                document.querySelectorAll(sel).forEach(el => el.remove())
            );
        }

        preconnect();
        addYouTubeButton();
    };

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', onReady, { once: true })
        : onReady();

    /* ── Per-site toggle button ─────────────────────────────────────────────── */
    const addToggle = () => {
        const btn = document.createElement('button');
        btn.textContent   = '⚡ NetOpt OFF';
        btn.title         = 'Disable Network Optimizer for this site';
        btn.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:99999;'
            + 'font-size:11px;padding:5px 9px;background:#222;color:#fff;'
            + 'border:none;border-radius:4px;cursor:pointer;touch-action:manipulation;opacity:.8';
        btn.onclick = () => { localStorage.setItem(SITE_KEY, '1'); location.reload(); };
        document.body?.appendChild(btn);
    };

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', addToggle, { once: true })
        : addToggle();

})();
