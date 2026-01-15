// ==UserScript==
// @name         ChatGPT Performance Optimizer
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Consolidated ChatGPT performance optimizer: DOM cleanup + memory trimming via fetch interception. Prevents lag in long conversations through dual-layer optimization.
// @author       Consolidated from ChatGPT AutoCleaner v5 + ChatGPT Optimizer
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @run-at       document-start
// @grant        unsafeWindow
// @license      MIT
// @downloadURL  https://update.greasyfork.org/scripts/[ID]/ChatGPT%20Performance%20Optimizer.user.js
// @updateURL    https://update.greasyfork.org/scripts/[ID]/ChatGPT%20Performance%20Optimizer.meta.js
// ==/UserScript==

/*
DUAL-LAYER OPTIMIZATION STRATEGY:

Layer 1: Fetch Interception (Memory Optimization)
- Intercepts conversation API responses
- Trims conversation mapping to last N messages
- Prevents React from loading entire conversation history into memory
- Runs at document-start for maximum effectiveness

Layer 2: DOM Cleanup (Visual Performance)
- Removes old message elements from Browser DOM
- Prevents excessive reflows/repaints
- Keeps UI responsive even with stale data in memory
- Runs on interval when tab is visible

Why Both?
- Fetch interception prevents memory bloat (React's internal state)
- DOM cleanup ensures smooth rendering (browser paint workload)
- Together they address both memory and rendering bottlenecks
*/

(function () {
  "use strict";

  const w = unsafeWindow;
  const DEBUG = false;

  // Emergency disable
  if (localStorage.getItem("disable_chatgpt_optimizer") === "1") {
    console.warn("[ChatGPT Optimizer]: Disabled by user");
    return;
  }

  function log(...args) {
    if (DEBUG) console.log("[ChatGPT Optimizer]", ...args);
  }

  // ═══════════════════════════════════════════════════════════
  // LAYER 1: FETCH INTERCEPTION (Memory Optimization)
  // ═══════════════════════════════════════════════════════════

  const FETCH_CONFIG = {
    DEFAULT_KEEP_LAST: 40,
    STEP: 20,
    SOFT_CAP: 400,
    KEY_KEEP_LAST: "cgpt_optimizer_keep_last",
    KEY_DISABLE_ONCE: "cgpt_optimizer_disable_once"
  };

  function getKeepLast() {
    const raw = w.localStorage.getItem(FETCH_CONFIG.KEY_KEEP_LAST);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : FETCH_CONFIG.DEFAULT_KEEP_LAST;
  }

  function setKeepLast(n) {
    w.localStorage.setItem(FETCH_CONFIG.KEY_KEEP_LAST, String(n));
  }

  function shouldDisableOnce() {
    return w.sessionStorage.getItem(FETCH_CONFIG.KEY_DISABLE_ONCE) === "1";
  }

  function setDisableOnce(val) {
    if (val) w.sessionStorage.setItem(FETCH_CONFIG.KEY_DISABLE_ONCE, "1");
    else w.sessionStorage.removeItem(FETCH_CONFIG.KEY_DISABLE_ONCE);
  }

  function shouldIntercept(url) {
    return /conversation/i.test(url);
  }

  function trimConversationPayload(json, keepLast) {
    try {
      if (!json || typeof json !== "object") return json;

      const mapping = json.mapping;
      const current = json.current_node;

      if (!mapping || typeof mapping !== "object" || !current || !mapping[current]) {
        return json;
      }

      // Build conversation path from current node back to root
      const path = [];
      let nodeId = current;
      const seen = new Set();

      while (nodeId && mapping[nodeId] && !seen.has(nodeId)) {
        seen.add(nodeId);
        path.push(nodeId);
        nodeId = mapping[nodeId].parent;
      }

      // Keep only last N nodes in path
      const keepIds = new Set(path.slice(0, keepLast));
      const newMapping = {};

      for (const id of keepIds) {
        const node = mapping[id];
        if (!node) continue;

        const copy = { ...node };

        // Filter children to only kept nodes
        if (Array.isArray(copy.children)) {
          copy.children = copy.children.filter((ch) => keepIds.has(ch));
        }

        // Nullify parent if not kept
        if (copy.parent && !keepIds.has(copy.parent)) {
          copy.parent = null;
        }

        newMapping[id] = copy;
      }

      const before = Object.keys(mapping).length;
      const after = Object.keys(newMapping).length;
      if (after < before) log(`Trimmed mapping ${before} → ${after} (keepLast=${keepLast})`);

      return { ...json, mapping: newMapping };
    } catch (e) {
      log("Trim failed:", e);
      return json;
    }
  }

  // Install fetch interceptor
  const originalFetch = w.fetch?.bind(w);
  if (originalFetch) {
    const keepLastNow = getKeepLast();
    const trimmingEnabled = !shouldDisableOnce();

    if (!trimmingEnabled) {
      setDisableOnce(false);
      log("Trimming disabled for this reload (one-time).");
    }

    w.fetch = async (...args) => {
      const res = await originalFetch(...args);

      try {
        if (!trimmingEnabled) return res;

        const url =
          typeof args[0] === "string" ? args[0] : args[0] && typeof args[0] === "object" ? args[0].url || "" : "";

        if (!shouldIntercept(url)) return res;

        const clone = res.clone();
        const ct = clone.headers.get("content-type") || "";
        if (!ct.includes("application/json")) return res;

        const data = await clone.json();
        const trimmed = trimConversationPayload(data, keepLastNow);

        // Only replace if actually trimmed
        if (data?.mapping && trimmed?.mapping) {
          const sameSize = Object.keys(data.mapping).length === Object.keys(trimmed.mapping).length;
          if (sameSize) return res;
        }

        const body = JSON.stringify(trimmed);
        const headers = new w.Headers(res.headers);

        return new w.Response(body, {
          status: res.status,
          statusText: res.statusText,
          headers
        });
      } catch {
        return res;
      }
    };

    log(`Fetch interceptor installed. keepLast=${keepLastNow} enabled=${trimmingEnabled}`);
  }

  // ═══════════════════════════════════════════════════════════
  // LAYER 2: DOM CLEANUP (Visual Performance)
  // ═══════════════════════════════════════════════════════════

  const DOM_CONFIG = {
    DEFAULT_LEAVE_ONLY: 5,
    DEFAULT_INTERVAL_SEC: 10,
    MIN_INTERVAL_SEC: 2,
    KEY_LEAVE_ONLY: "cgpt_optimizer_leave_only",
    KEY_INTERVAL_SEC: "cgpt_optimizer_interval_sec",
    KEY_ENABLED: "cgpt_optimizer_enabled"
  };

  function cleanOldMessages(leaveOnly, manual = false) {
    try {
      if (manual) console.info("[DOM Cleanup] Manual clean triggered");

      const all = document.querySelectorAll('[data-testid^="conversation-turn-"]');
      if (all.length === 0) return;

      const lastAttr = all[all.length - 1].getAttribute("data-testid");
      const last = parseInt(lastAttr?.split("-")[2]);

      if (!isNaN(last)) {
        let removed = 0;
        all.forEach((item) => {
          const idx = parseInt(item.getAttribute("data-testid")?.split("-")[2]);
          if (!isNaN(idx) && idx < last - leaveOnly) {
            item.remove();
            removed++;
          }
        });
        if (removed > 0) log(`Removed ${removed} old DOM nodes`);
      }
    } catch (e) {
      console.error("[DOM Cleanup] Error:", e);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // UNIFIED UI PANEL
  // ═══════════════════════════════════════════════════════════

  function createUI() {
    if (document.getElementById("cgpt-optimizer-ui")) return;

    // Load settings
    const domSettings = {
      leaveOnly: parseInt(localStorage.getItem(DOM_CONFIG.KEY_LEAVE_ONLY)) || DOM_CONFIG.DEFAULT_LEAVE_ONLY,
      intervalSec: parseInt(localStorage.getItem(DOM_CONFIG.KEY_INTERVAL_SEC)) || DOM_CONFIG.DEFAULT_INTERVAL_SEC,
      enabled: localStorage.getItem(DOM_CONFIG.KEY_ENABLED) !== "false"
    };

    let intervalId = null;
    let panelVisible = false;

    // Create container
    const container = document.createElement("div");
    container.id = "cgpt-optimizer-ui";
    Object.assign(container.style, {
      position: "fixed",
      bottom: "8px",
      right: "8px",
      zIndex: "999999",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      fontSize: "12px",
      userSelect: "none"
    });

    // Toggle button
    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "⚡";
    toggleBtn.title = "ChatGPT Optimizer";
    Object.assign(toggleBtn.style, {
      background: domSettings.enabled ? "#444" : "#c00",
      color: "#fff",
      border: "none",
      borderRadius: "50%",
      width: "32px",
      height: "32px",
      cursor: "pointer",
      fontSize: "16px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
    });

    // Panel
    const panel = document.createElement("div");
    panel.id = "cgpt-optimizer-panel";
    Object.assign(panel.style, {
      display: "none",
      position: "absolute",
      bottom: "40px",
      right: "0",
      background: "rgba(0,0,0,0.9)",
      backdropFilter: "blur(10px)",
      color: "#fff",
      padding: "12px",
      borderRadius: "8px",
      minWidth: "240px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
      border: "1px solid rgba(255,255,255,0.15)"
    });

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <strong style="font-size:13px;">ChatGPT Optimizer</strong>
        <button id="cgpt-close" style="background:none;border:none;color:#ccc;cursor:pointer;font-size:18px;padding:0;">×</button>
      </div>

      <div style="font-size:11px;opacity:0.8;margin-bottom:10px;line-height:1.4;">
        <strong>Layer 1:</strong> Memory (fetch) - keep <span id="cgpt-keep-display">${getKeepLast()}</span> msgs<br>
        <strong>Layer 2:</strong> DOM cleanup - keep <span id="cgpt-leave-display">${domSettings.leaveOnly}</span> msgs
      </div>

      <div style="margin-bottom:8px;">
        <label style="display:flex;align-items:center;gap:6px;">
          <input type="checkbox" id="cgpt-dom-enabled" ${domSettings.enabled ? "checked" : ""}>
          <span>DOM auto-clean enabled</span>
        </label>
      </div>

      <div style="margin-bottom:8px;">
        <label style="display:block;margin-bottom:4px;">DOM: Keep last</label>
        <input id="cgpt-dom-keep" type="number" value="${domSettings.leaveOnly}" min="1" max="100"
          style="width:60px;padding:4px;background:#222;color:#fff;border:1px solid #555;border-radius:4px;">
        <span style="margin-left:6px;opacity:0.8;">messages</span>
      </div>

      <div style="margin-bottom:10px;">
        <label style="display:block;margin-bottom:4px;">DOM: Interval</label>
        <input id="cgpt-dom-interval" type="number" value="${domSettings.intervalSec}" min="2" max="60"
          style="width:60px;padding:4px;background:#222;color:#fff;border:1px solid #555;border-radius:4px;">
        <span style="margin-left:6px;opacity:0.8;">seconds</span>
      </div>

      <button id="cgpt-clean-now" style="
        width:100%;padding:8px;background:#008000;color:#fff;border:none;
        border-radius:4px;cursor:pointer;font-size:12px;margin-bottom:8px;">
        Clean DOM Now
      </button>

      <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;margin-top:8px;">
        <div style="font-size:11px;opacity:0.8;margin-bottom:6px;">Memory optimization:</div>
        <button id="cgpt-load-older" style="
          width:100%;padding:6px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);
          border-radius:4px;cursor:pointer;font-size:11px;margin-bottom:4px;">
          Load +${FETCH_CONFIG.STEP} older messages
        </button>
        <button id="cgpt-reset-fast" style="
          width:100%;padding:6px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);
          border-radius:4px;cursor:pointer;font-size:11px;margin-bottom:4px;">
          Reset to default (${FETCH_CONFIG.DEFAULT_KEEP_LAST} msgs)
        </button>
        <button id="cgpt-full-history" style="
          width:100%;padding:6px;background:rgba(255,255,0,0.2);color:#ff0;border:1px solid rgba(255,255,0,0.3);
          border-radius:4px;cursor:pointer;font-size:11px;">
          Load full history (slow!)
        </button>
      </div>
    `;

    container.appendChild(toggleBtn);
    container.appendChild(panel);
    document.body.appendChild(container);

    // Get elements
    const closeBtn = panel.querySelector("#cgpt-close");
    const domEnabledCheckbox = panel.querySelector("#cgpt-dom-enabled");
    const domKeepInput = panel.querySelector("#cgpt-dom-keep");
    const domIntervalInput = panel.querySelector("#cgpt-dom-interval");
    const cleanNowBtn = panel.querySelector("#cgpt-clean-now");
    const loadOlderBtn = panel.querySelector("#cgpt-load-older");
    const resetFastBtn = panel.querySelector("#cgpt-reset-fast");
    const fullHistoryBtn = panel.querySelector("#cgpt-full-history");
    const keepDisplay = panel.querySelector("#cgpt-keep-display");
    const leaveDisplay = panel.querySelector("#cgpt-leave-display");

    // State
    let currentLeaveOnly = domSettings.leaveOnly;
    let currentIntervalMs = Math.max(2000, domSettings.intervalSec * 1000);
    let currentEnabled = domSettings.enabled;

    // DOM cleanup scheduler
    function scheduleDOMClean(force = false) {
      if (!force) {
        if (!currentEnabled) return;
        if (document.hidden) return;
      }
      cleanOldMessages(currentLeaveOnly, force);
    }

    function startDOMCleaner() {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => scheduleDOMClean(false), currentIntervalMs);
      log(`DOM cleaner started: interval=${currentIntervalMs}ms, keep=${currentLeaveOnly}`);
    }

    // Event handlers
    toggleBtn.onclick = () => {
      panelVisible = !panelVisible;
      panel.style.display = panelVisible ? "block" : "none";
    };

    closeBtn.onclick = () => {
      panelVisible = false;
      panel.style.display = "none";
    };

    domEnabledCheckbox.onchange = () => {
      currentEnabled = domEnabledCheckbox.checked;
      localStorage.setItem(DOM_CONFIG.KEY_ENABLED, currentEnabled);
      toggleBtn.style.background = currentEnabled ? "#444" : "#c00";
      log("DOM cleanup enabled:", currentEnabled);
    };

    domKeepInput.oninput = () => {
      const val = parseInt(domKeepInput.value);
      if (!isNaN(val) && val > 0) {
        currentLeaveOnly = val;
        localStorage.setItem(DOM_CONFIG.KEY_LEAVE_ONLY, val);
        leaveDisplay.textContent = val;
        log("DOM keep set to", val);
      }
    };

    domIntervalInput.oninput = () => {
      const val = parseInt(domIntervalInput.value);
      if (!isNaN(val) && val >= DOM_CONFIG.MIN_INTERVAL_SEC) {
        currentIntervalMs = Math.max(2000, val * 1000);
        localStorage.setItem(DOM_CONFIG.KEY_INTERVAL_SEC, val);
        startDOMCleaner();
      }
    };

    cleanNowBtn.onclick = () => {
      console.info("[ChatGPT Optimizer] Manual DOM clean triggered");
      scheduleDOMClean(true);
    };

    loadOlderBtn.onclick = () => {
      const cur = getKeepLast();
      setKeepLast(cur + FETCH_CONFIG.STEP);
      w.location.reload();
    };

    resetFastBtn.onclick = () => {
      setKeepLast(FETCH_CONFIG.DEFAULT_KEEP_LAST);
      w.location.reload();
    };

    fullHistoryBtn.onclick = () => {
      if (confirm("Load full history? This may cause significant lag.")) {
        setDisableOnce(true);
        w.location.reload();
      }
    };

    // Start DOM cleaner
    if (currentEnabled) {
      startDOMCleaner();
    }

    // Re-inject UI if removed by ChatGPT navigation
    const observer = new MutationObserver(() => {
      if (!document.getElementById("cgpt-optimizer-ui")) {
        observer.disconnect();
        setTimeout(createUI, 100);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Initialize UI when DOM ready
  if (document.readyState === "complete" || document.readyState === "interactive") {
    createUI();
  } else {
    window.addEventListener("DOMContentLoaded", createUI);
  }

  // Fallback: ensure UI exists
  const uiTimer = w.setInterval(() => {
    if (w.document?.body && !document.getElementById("cgpt-optimizer-ui")) {
      createUI();
      w.clearInterval(uiTimer);
    }
  }, 500);

  console.info("[ChatGPT Optimizer] Initialized (dual-layer: fetch + DOM)");
})();
