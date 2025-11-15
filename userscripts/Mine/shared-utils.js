// ==UserScript==
// @name        Shared Utilities
// @description Common utilities for userscripts
// @namespace   Ven0m0
// @author      Ven0m0
// @version     1.0.0
// @grant       none
// ==/UserScript==
"use strict";

// ============================================================================
// SHARED UTILITIES MODULE
// ============================================================================
// This module provides common utilities to avoid code duplication across
// userscripts. Import these functions instead of redefining them.
// ============================================================================

/**
 * Debounce function - delays execution until after wait period
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export const debounce = (fn, ms) => {
  let t;
  return function(...a) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, a), ms);
  };
};

/**
 * Throttle function - limits execution to once per wait period
 * @param {Function} fn - Function to throttle
 * @param {number} ms - Milliseconds between executions
 * @returns {Function} Throttled function
 */
export const throttle = (fn, ms) => {
  let p = !1;
  return function(...a) {
    if (!p) {
      fn.apply(this, a);
      p = !0;
      setTimeout(() => p = !1, ms);
    }
  };
};

/**
 * RequestIdleCallback wrapper with timeout fallback
 * @param {Function} fn - Function to execute when idle
 * @param {number} timeout - Timeout in milliseconds (default: 1000)
 */
export const idle = (fn, timeout = 1e3) =>
  window.requestIdleCallback
    ? requestIdleCallback(fn, {timeout})
    : setTimeout(fn, 200);

/**
 * Mark element with attribute
 * @param {Element} e - Element to mark
 * @param {string} k - Attribute name (default: 'data-wp')
 */
export const mark = (e, k = 'data-wp') => e?.setAttribute(k, '1');

/**
 * Check if element is marked
 * @param {Element} e - Element to check
 * @param {string} k - Attribute name (default: 'data-wp')
 * @returns {boolean} True if marked
 */
export const marked = (e, k = 'data-wp') => e?.getAttribute(k) === '1';

/**
 * Check if URL is HTTP/HTTPS
 * @param {string} u - URL to check
 * @returns {boolean} True if HTTP/HTTPS
 */
export const isHttp = u => /^\s*https?:/i.test(u);

/**
 * Inject CSS into document
 * @param {string} css - CSS text to inject
 * @param {string} id - Optional ID for style element
 * @returns {HTMLStyleElement} Created style element
 */
export const injectCSS = (css, id) => {
  if (id && document.getElementById(id)) return;
  const style = document.createElement('style');
  if (id) style.id = id;
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
  return style;
};

/**
 * Optimized MutationObserver wrapper with debouncing
 * @param {Function} callback - Callback to execute on mutations
 * @param {Element} target - Element to observe
 * @param {Object} options - MutationObserver options
 * @param {number} debounceMs - Debounce delay (default: 100ms)
 * @returns {MutationObserver} Created observer
 */
export const createDebouncedObserver = (callback, target, options, debounceMs = 100) => {
  const debouncedCallback = debounce(callback, debounceMs);
  const obs = new MutationObserver(debouncedCallback);
  if (target) obs.observe(target, options);
  return obs;
};

/**
 * Query selector with caching
 */
export class QueryCache {
  constructor(ttl = 5000) {
    this.cache = new Map();
    this.ttl = ttl;
  }

  query(selector, useCache = true) {
    if (!useCache) return document.querySelectorAll(selector);

    const cached = this.cache.get(selector);
    if (cached && Date.now() - cached.ts < this.ttl) {
      return cached.elements;
    }

    const elements = document.querySelectorAll(selector);
    this.cache.set(selector, {elements, ts: Date.now()});
    return elements;
  }

  clear() {
    this.cache.clear();
  }
}

/**
 * RAF-based throttle for event handlers
 * @param {Function} fn - Function to throttle
 * @param {Object} ctx - Context to bind
 * @returns {Function} RAF-throttled function
 */
export const rafThrottle = (fn, ctx) => {
  let pending = !1, args = null;
  return function(...a) {
    args = a;
    if (!pending) {
      pending = !0;
      requestAnimationFrame(() => {
        pending = !1;
        fn.apply(ctx || this, args);
      });
    }
  };
};
