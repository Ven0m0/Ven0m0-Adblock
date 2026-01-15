// ==UserScript==
// @name         AI Chat Universal Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Universal AI chat interface optimizer: width optimization, window enhancements, Enter key behavior, code block improvements for ChatGPT, Claude, Gemini, DeepSeek, Perplexity, Grok, and more
// @author       Consolidated from 3 AI chat scripts
// @match        *://chatgpt.com/*
// @match        *://chat.openai.com/*
// @match        *://claude.ai/*
// @match        *://gemini.google.com/*
// @match        *://chat.deepseek.com/*
// @match        *://www.perplexity.ai/*
// @match        *://grok.com/*
// @match        *://felo.ai/*
// @match        *://duckduckgo.com/*
// @match        *://kimi.moonshot.cn/*
// @match        *://tongyi.aliyun.com/qianwen*
// @match        *://www.tiangong.cn/*
// @match        *://chatglm.cn/*
// @match        *://new.oaifree.com/*
// @match        *://shared.oaifree.com/*
// @match        *://www.aicnn.cn/oaifree/*
// @match        *://chat.aicnn.xyz/*
// @match        *://plus.aivvm.com/*
// @match        *://chat.kelaode.ai/*
// @include      *://*claude*/*
// @include      http://192.168.*.*:*/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-end
// @license      MIT
// @noframes
// @downloadURL  https://update.greasyfork.org/scripts/[ID]/AI%20Chat%20Universal%20Enhancer.user.js
// @updateURL    https://update.greasyfork.org/scripts/[ID]/AI%20Chat%20Universal%20Enhancer.meta.js
// ==/UserScript==

/*
CONSOLIDATED FEATURES:

1. Width Optimization - Increases chat box width for better readability
2. Window Enhancements - Code block styles, scrollbar optimization, layout fixes
3. Enter Key Behavior - Enter for newline, Ctrl/Cmd+Enter to send
4. Link Enhancement - Fixes broken links in AI responses
5. Multi-language Support - English, Chinese (Simplified/Traditional)
*/

(function () {
  "use strict";

  // Emergency disable
  if (localStorage.getItem("disable_ai_chat_enhancer") === "1") {
    console.warn("[AI Chat Enhancer]: Disabled by user");
    return;
  }

  // ═══════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════

  const STYLE_CONFIG = {
    maxWidth: "95%",
    maxViewportWidth: "90vw",
    scrollbarWidth: "thin",
    scrollbarThumbColor: "#aaaa",
    scrollbarTrackColor: "#1111",
    codeBlockScrollbarHeight: "8px",
    codeBlockScrollbarThumbColor: "#666",
    codeBlockScrollbarTrackColor: "#f1f1f1",
    codeSelectionBgColor: "rgba(70, 130, 180, 0.5)",
    codeSelectionTextColor: "white",
    lightCodeSelectionBgColor: "rgba(0, 120, 215, 0.3)",
    lightCodeSelectionTextColor: "black"
  };

  // Enter key configuration
  const DEFAULT_SHORTCUTS = {
    ctrl: true,
    alt: false,
    meta: true
  };

  function loadEnterConfig() {
    try {
      const saved = GM_getValue("aiEnterConfig");
      if (saved) {
        const config = JSON.parse(saved);
        return {
          ctrl: config.shortcuts?.send?.ctrl ?? DEFAULT_SHORTCUTS.ctrl,
          alt: config.shortcuts?.send?.alt ?? DEFAULT_SHORTCUTS.alt,
          meta: config.shortcuts?.send?.meta ?? DEFAULT_SHORTCUTS.meta
        };
      }
    } catch (e) {
      console.error("[AI Chat Enhancer] Error loading config:", e);
    }
    return DEFAULT_SHORTCUTS;
  }

  function saveEnterConfig(shortcuts) {
    try {
      GM_setValue("aiEnterConfig", JSON.stringify({ shortcuts: { send: shortcuts } }));
      return true;
    } catch (e) {
      console.error("[AI Chat Enhancer] Error saving config:", e);
      return false;
    }
  }

  let currentShortcuts = loadEnterConfig();

  // ═══════════════════════════════════════════════════════════
  // MODULE 1: PLATFORM DETECTION
  // ═══════════════════════════════════════════════════════════

  const PLATFORM_MAP = {
    "chatgpt.com": "chatgpt",
    "chat.openai.com": "chatgpt",
    "claude.ai": "claude",
    "gemini.google.com": "gemini",
    "chat.deepseek.com": "deepseek",
    "kimi.moonshot.cn": "kimi",
    "tongyi.aliyun.com": "tongyi",
    "tiangong.cn": "tiangong",
    "chatglm.cn": "chatglm",
    "perplexity.ai": "perplexity",
    "grok.com": "grok",
    "felo.ai": "felo",
    "duckduckgo.com": "duckduckgo"
  };

  function detectPlatform() {
    const host = window.location.hostname;
    for (const [domain, platform] of Object.entries(PLATFORM_MAP)) {
      if (host.includes(domain)) return platform;
    }
    return "default";
  }

  const currentPlatform = detectPlatform();

  // ═══════════════════════════════════════════════════════════
  // MODULE 2: WIDTH OPTIMIZATION & WINDOW ENHANCEMENTS
  // ═══════════════════════════════════════════════════════════

  const CODE_BLOCK_STYLES = `
    /* Code block optimization */
    pre > div.rounded-md,
    .code-block__code {
      min-height: 1.5em;
      height: auto !important;
    }

    pre > div.rounded-md > div.overflow-y-auto,
    .code-block__code {
      max-height: none !important;
      height: auto !important;
      overflow-y: visible !important;
      overflow-x: auto !important;
    }

    /* Remove collapse buttons */
    button[class*="code-block-collapse-button"],
    div[class*="code-block-collapse"] {
      display: none !important;
    }

    div[class*="code-block-wrapper"].collapsed {
      max-height: none !important;
      height: auto !important;
    }

    /* Scrollbar styling */
    pre > div.rounded-md > div.overflow-y-auto::-webkit-scrollbar,
    .code-block__code::-webkit-scrollbar {
      height: ${STYLE_CONFIG.codeBlockScrollbarHeight};
      width: ${STYLE_CONFIG.codeBlockScrollbarHeight};
    }

    pre > div.rounded-md > div.overflow-y-auto::-webkit-scrollbar-thumb,
    .code-block__code::-webkit-scrollbar-thumb {
      background: ${STYLE_CONFIG.codeBlockScrollbarThumbColor};
      border-radius: 4px;
    }

    pre > div.rounded-md > div.overflow-y-auto::-webkit-scrollbar-track,
    .code-block__code::-webkit-scrollbar-track {
      background: ${STYLE_CONFIG.codeBlockScrollbarTrackColor};
    }

    /* Code selection styling - dark theme */
    pre code::selection,
    .code-block__code code::selection,
    pre div::selection,
    .code-block__code div::selection,
    pre span::selection,
    .code-block__code span::selection,
    div[class*="codeBlockContainer"] *::selection,
    div[class*="code-block"] *::selection {
      background-color: ${STYLE_CONFIG.codeSelectionBgColor} !important;
      color: ${STYLE_CONFIG.codeSelectionTextColor} !important;
    }

    /* Code selection styling - light theme */
    pre.bg-white code::selection,
    pre.bg-gray-50 code::selection,
    pre.bg-slate-50 code::selection,
    .light-theme pre code::selection,
    .light pre code::selection {
      background-color: ${STYLE_CONFIG.lightCodeSelectionBgColor} !important;
      color: ${STYLE_CONFIG.lightCodeSelectionTextColor} !important;
    }

    /* Hover highlight */
    pre:hover,
    .code-block__code:hover,
    div[class*="codeBlockContainer"]:hover,
    div[class*="code-block"]:hover {
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
      transition: box-shadow 0.2s ease-in-out;
    }
  `;

  const PLATFORM_STYLES = {
    chatgpt: `
      .text-base, .text-base > div:first-child {
        max-width: 98% !important;
      }
      .xl\\:max-w-\\[48rem\\] {
        width: ${STYLE_CONFIG.maxWidth} !important;
        max-width: 96% !important;
      }
      div.mx-auto.md\\:max-w-3xl,
      div.mx-auto.flex {
        max-width: calc(100% - 10px);
      }
      main > div.composer-parent article > div.text-base > div.mx-auto,
      main article > div.text-base > div.mx-auto {
        max-width: ${STYLE_CONFIG.maxWidth};
      }
      body > div.flex.min-h-screen.w-full > div > main > div.top-5.z-10.mx-auto.w-full.max-w-2xl.md,
      body > div.flex.min-h-screen.w-full > div > main > div.mx-auto.w-full.max-w-2xl.px-1.md {
        max-width: 100%;
      }
      body > div.flex.min-h-screen.w-full > div > main.max-w-7xl {
        max-width: 90rem;
      }
      ${CODE_BLOCK_STYLES}
    `,

    claude: `
      div[data-test-render-count] {
        max-width: 98% !important;
      }
      ${CODE_BLOCK_STYLES}
    `,

    gemini: `
      .conversation-container {
        max-width: 98% !important;
      }
      #chat-history > infinite-scroller > div,
      #app-root > main > side-navigation-v2 > bard-sidenav-container > bard-sidenav-content > div > div > div.content-container > chat-window > div.chat-container.ng-star-inserted > div.bottom-container.response-optimization.ng-star-inserted,
      #app-root > main > side-navigation-v2 > bard-sidenav-container > bard-sidenav-content > div > div > div.content-container > chat-window > div.chat-container.ng-star-inserted > div.bottom-container.response-optimization.ng-star-inserted > div.input-area-container.ng-star-inserted {
        max-width: calc(100% - 20px);
      }
      ${CODE_BLOCK_STYLES}
    `,

    deepseek: `
      div:has(> #latest-context-divider) {
        width: ${STYLE_CONFIG.maxWidth} !important;
      }
      div:has(> div > #chat-input) {
        width: ${STYLE_CONFIG.maxWidth} !important;
        max-width: ${STYLE_CONFIG.maxViewportWidth};
      }
      ${CODE_BLOCK_STYLES}
    `,

    kimi: `
      div[data-testid] div[data-index] div.MuiBox-root {
        max-width: 100% !important;
      }
      div[class^=mainContent] div.MuiBox-root > div[class^=chatBottom_] {
        max-width: calc(100% - 100px);
      }
      div[class^=mainContent] div[class^=chatInput_] div[class^=inputInner_] div[class^=editor] {
        max-height: 360px;
      }
      #scroll-list div[class^=chatItemBox_].MuiBox-root {
        max-width: 100%;
      }
      div.MuiBox-root[class^=homepage] div[class^=mainContent] div[class^=chatInput_] div[class^=inputInner_] div[class^=editor] {
        max-height: 600px;
      }
      #root > div > div[class*=mainContent] > div[class*=layoutContent] > div.MuiBox-root > div.MuiBox-root[class*=homepage] > div.MuiContainer-root.MuiContainer-maxWidthMd {
        max-width: calc(100% - 100px);
      }
      ${CODE_BLOCK_STYLES}
    `,

    tongyi: `
      div[class^=mainContent] div[class^=questionItem--],
      div[class^=mainContent] div[class^=answerItem--] {
        width: 90% !important;
        max-width: ${STYLE_CONFIG.maxViewportWidth};
      }
      ${CODE_BLOCK_STYLES}
    `,

    tiangong: `
      #app > div > div > main > div.overflow-y-scroll.w-full > div.search-content.relative.flex.w-full.flex-row.justify-center,
      #app > div > div > main > div.overflow-y-scroll.w-full > div.search-content.relative.flex.w-full.flex-row.justify-center > label.w-full.cursor-default.select-auto,
      label.w-full {
        max-width: calc(100% - 100px);
        --search-max-width: calc(100% - 100px);
      }
      :root {
        --search-max-width: calc(100% - 100px);
      }
      ${CODE_BLOCK_STYLES}
    `,

    chatglm: `
      div.conversation-inner.dialogue > div.conversation-list.detail > div.item.conversation-item,
      .markdown-body.md-body {
        max-width: ${STYLE_CONFIG.maxViewportWidth} !important;
      }
      ${CODE_BLOCK_STYLES}
    `,

    default: `
      ${CODE_BLOCK_STYLES}
    `
  };

  function applyPlatformStyles() {
    try {
      const styleToApply = PLATFORM_STYLES[currentPlatform] || PLATFORM_STYLES.default;
      GM_addStyle(styleToApply);
      console.log(`[AI Chat Enhancer] Applied styles for platform: ${currentPlatform}`);
    } catch (e) {
      console.error("[AI Chat Enhancer] Error applying styles:", e);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // MODULE 3: LINK ENHANCEMENT
  // ═══════════════════════════════════════════════════════════

  const LinkEnhancer = {
    timer: null,
    observer: null,

    enhance() {
      if (LinkEnhancer.timer) clearTimeout(LinkEnhancer.timer);

      try {
        const links = document.querySelectorAll('div[data-message-id] a[rel="noreferrer"]');
        if (links.length > 0) {
          links.forEach((link) => {
            if (!link.href && link.innerText && link.innerText.trim()) {
              const linkText = link.innerText.trim();
              if (linkText.startsWith("http") || linkText.includes("www.")) {
                link.href = linkText;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
              }
            }
          });
        }
      } catch (e) {
        console.error("[AI Chat Enhancer] Error enhancing links:", e);
      }

      LinkEnhancer.timer = setTimeout(() => {
        if (!LinkEnhancer.observer) {
          LinkEnhancer.observer = new MutationObserver((mutations) => {
            const shouldProcess = mutations.some(
              (mutation) =>
                mutation.addedNodes.length > 0 || (mutation.type === "attributes" && mutation.attributeName === "href")
            );
            if (shouldProcess) LinkEnhancer.enhance();
          });

          LinkEnhancer.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["href"]
          });
        }
      }, 2000);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // MODULE 4: ENTER KEY BEHAVIOR
  // ═══════════════════════════════════════════════════════════

  // Multi-language support
  const TRANSLATIONS = {
    en: {
      settings: "Settings",
      close: "✕",
      sendShortcut: "Send Message Shortcut (+ Enter):",
      save: "Save",
      reset: "Reset",
      saveSuccess: "Settings saved!",
      saveFailed: "Failed to save settings!",
      resetConfirm: "Are you sure you want to reset to default settings?",
      resetSuccess: "Settings reset to default!",
      ctrlEnter: "Ctrl + Enter",
      altEnter: "Alt + Enter",
      cmdEnter: "Cmd + Enter",
      winEnter: "Win + Enter",
      superEnter: "Super + Enter"
    },
    "zh-tw": {
      settings: "設定",
      close: "✕",
      sendShortcut: "傳送訊息快捷鍵（+ Enter）：",
      save: "儲存",
      reset: "重設",
      saveSuccess: "設定已儲存！",
      saveFailed: "儲存設定失敗！",
      resetConfirm: "確定要重設為預設設定嗎？",
      resetSuccess: "設定已重設為預設值！",
      ctrlEnter: "Ctrl + Enter",
      altEnter: "Alt + Enter",
      cmdEnter: "Cmd + Enter",
      winEnter: "Win + Enter",
      superEnter: "Super + Enter"
    },
    "zh-cn": {
      settings: "设置",
      close: "✕",
      sendShortcut: "发送消息快捷键（+ Enter）：",
      save: "保存",
      reset: "重置",
      saveSuccess: "设置已保存！",
      saveFailed: "保存设置失败！",
      resetConfirm: "确定要重置为默认设置吗？",
      resetSuccess: "设置已重置为默认值！",
      ctrlEnter: "Ctrl + Enter",
      altEnter: "Alt + Enter",
      cmdEnter: "Cmd + Enter",
      winEnter: "Win + Enter",
      superEnter: "Super + Enter"
    }
  };

  function detectLanguage() {
    const lang = navigator.language || navigator.userLanguage;
    if (lang.startsWith("zh")) {
      return lang.includes("TW") || lang.includes("HK") || lang.includes("MO") ? "zh-tw" : "zh-cn";
    }
    return "en";
  }

  function t(key) {
    const lang = detectLanguage();
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
  }

  function detectOS() {
    const ua = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();

    if (platform.includes("mac") || ua.includes("mac")) return "mac";
    if (platform.includes("win") || ua.includes("win")) return "windows";
    if (platform.includes("linux") || ua.includes("linux")) return "linux";
    return "other";
  }

  function createSettingsUI() {
    const existing = document.getElementById("ai-enter-config");
    if (existing) {
      existing.remove();
      return;
    }

    const os = detectOS();
    const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

    const colors = {
      background: isDark ? "#2d2d2d" : "#ffffff",
      text: isDark ? "#e0e0e0" : "#333333",
      border: isDark ? "#555555" : "#dddddd",
      inputBg: isDark ? "#3d3d3d" : "#ffffff",
      buttonBg: isDark ? "#3d3d3d" : "#f5f5f5",
      buttonText: isDark ? "#e0e0e0" : "#333333",
      primary: "#4caf50",
      shadow: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.15)"
    };

    const dialog = document.createElement("div");
    dialog.id = "ai-enter-config";
    Object.assign(dialog.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      backgroundColor: colors.background,
      color: colors.text,
      border: `1px solid ${colors.border}`,
      borderRadius: "8px",
      padding: "20px",
      width: "350px",
      maxWidth: "90vw",
      maxHeight: "90vh",
      overflowY: "auto",
      zIndex: "10000",
      boxShadow: `0 4px 12px ${colors.shadow}`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    });

    const titleDiv = document.createElement("div");
    titleDiv.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;";

    const title = document.createElement("h2");
    title.textContent = t("settings");
    title.style.cssText = `margin: 0; fontSize: 18px; color: ${colors.text};`;

    const closeBtn = document.createElement("button");
    closeBtn.textContent = t("close");
    closeBtn.style.cssText = `background: none; border: none; color: ${colors.text}; cursor: pointer; font-size: 18px;`;
    closeBtn.onclick = () => dialog.remove();

    titleDiv.appendChild(title);
    titleDiv.appendChild(closeBtn);
    dialog.appendChild(titleDiv);

    const label = document.createElement("label");
    label.textContent = t("sendShortcut");
    label.style.cssText = `display: block; margin-bottom: 12px; color: ${colors.text}; font-weight: bold;`;
    dialog.appendChild(label);

    const container = document.createElement("div");
    container.style.cssText = `margin-bottom: 16px; padding: 12px; background-color: ${isDark ? "#3a3a3a" : "#f8f9fa"}; border: 1px solid ${colors.border}; border-radius: 6px;`;

    const shortcuts = [
      { key: "ctrl", label: os === "mac" ? `⌃ ${t("ctrlEnter")}` : t("ctrlEnter") },
      { key: "alt", label: os === "mac" ? `⌥ ${t("altEnter")}` : t("altEnter") },
      {
        key: "meta",
        label: os === "mac" ? `⌘ ${t("cmdEnter")}` : os === "windows" ? `⊞ ${t("winEnter")}` : t("superEnter")
      }
    ];

    shortcuts.forEach((shortcut) => {
      const optionDiv = document.createElement("div");
      optionDiv.style.cssText = "display: flex; align-items: center; margin-bottom: 8px;";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `shortcut-${shortcut.key}`;
      checkbox.checked = currentShortcuts[shortcut.key];
      if (isDark) checkbox.style.accentColor = colors.primary;

      const labelEl = document.createElement("label");
      labelEl.htmlFor = `shortcut-${shortcut.key}`;
      labelEl.style.cssText = `margin-left: 8px; color: ${colors.text}; cursor: pointer; flex-grow: 1;`;
      labelEl.textContent = shortcut.label;

      optionDiv.appendChild(checkbox);
      optionDiv.appendChild(labelEl);
      container.appendChild(optionDiv);
    });

    dialog.appendChild(container);

    const buttonDiv = document.createElement("div");
    buttonDiv.style.cssText = "display: flex; justify-content: flex-end; margin-top: 16px;";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = t("save");
    saveBtn.style.cssText = `padding: 8px 16px; background-color: ${colors.primary}; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 8px;`;
    saveBtn.onclick = () => {
      const newShortcuts = {
        ctrl: document.getElementById("shortcut-ctrl").checked,
        alt: document.getElementById("shortcut-alt").checked,
        meta: document.getElementById("shortcut-meta").checked
      };
      if (saveEnterConfig(newShortcuts)) {
        alert(t("saveSuccess"));
        dialog.remove();
        currentShortcuts = newShortcuts;
      } else {
        alert(t("saveFailed"));
      }
    };

    const resetBtn = document.createElement("button");
    resetBtn.textContent = t("reset");
    resetBtn.style.cssText = `padding: 8px 16px; background-color: ${colors.buttonBg}; color: ${colors.buttonText}; border: 1px solid ${colors.border}; border-radius: 4px; cursor: pointer;`;
    resetBtn.onclick = () => {
      if (confirm(t("resetConfirm"))) {
        saveEnterConfig(DEFAULT_SHORTCUTS);
        alert(t("resetSuccess"));
        dialog.remove();
        currentShortcuts = DEFAULT_SHORTCUTS;
        createSettingsUI();
      }
    };

    buttonDiv.appendChild(resetBtn);
    buttonDiv.appendChild(saveBtn);
    dialog.appendChild(buttonDiv);

    document.body.appendChild(dialog);

    const overlay = document.createElement("div");
    overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: ${isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)"}; z-index: 9999;`;
    overlay.onclick = () => {
      overlay.remove();
      dialog.remove();
    };
    document.body.insertBefore(overlay, dialog);
  }

  // Keyboard event handlers
  function getEventTarget(e) {
    return e.composedPath ? e.composedPath()[0] || e.target : e.target;
  }

  function isChineseInputMode(e) {
    return e.isComposing || e.keyCode === 229;
  }

  function isInTextInput(target) {
    return (
      target.id === "prompt-textarea" ||
      target.closest("#prompt-textarea") ||
      /INPUT|TEXTAREA|SELECT|LABEL/.test(target.tagName) ||
      (target.getAttribute && target.getAttribute("contenteditable") === "true")
    );
  }

  function isPotentialSendShortcut(e) {
    if (e.key !== "Enter") return false;
    const isCtrlOnly = e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
    const isAltOnly = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
    const isMetaOnly = e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
    return isCtrlOnly || isAltOnly || isMetaOnly;
  }

  function isSendShortcut(e) {
    if (e.key !== "Enter") return false;
    return (
      (currentShortcuts.ctrl && e.ctrlKey && !e.altKey && !e.metaKey) ||
      (currentShortcuts.alt && e.altKey && !e.ctrlKey && !e.metaKey) ||
      (currentShortcuts.meta && e.metaKey && !e.ctrlKey && !e.altKey)
    );
  }

  function findChatGPTSubmitButton() {
    return document.querySelector('button[data-testid="send-button"]');
  }

  window.addEventListener(
    "keydown",
    (e) => {
      if (isChineseInputMode(e)) return;

      const target = getEventTarget(e);

      // ChatGPT special handling
      if (currentPlatform === "chatgpt") {
        if (e.key === "Enter" && !e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
          if (isInTextInput(target)) {
            e.stopPropagation();
            e.preventDefault();

            const shiftEnterEvent = new KeyboardEvent("keydown", {
              key: "Enter",
              code: "Enter",
              shiftKey: true,
              bubbles: true,
              cancelable: true
            });
            target.dispatchEvent(shiftEnterEvent);

            if (!shiftEnterEvent.defaultPrevented) {
              document.execCommand("insertParagraph");
            }
            return;
          }
        }

        if (isSendShortcut(e)) {
          if (isInTextInput(target)) {
            const submitButton = findChatGPTSubmitButton();
            if (submitButton && !submitButton.disabled) {
              e.preventDefault();
              e.stopPropagation();
              submitButton.click();
            }
          }
        }

        if (isPotentialSendShortcut(e)) {
          if (isInTextInput(target)) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      } else {
        // Other platforms
        if (e.key === "Enter" && !e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
          if (isInTextInput(target)) {
            e.stopPropagation();
          }
        }

        if (isSendShortcut(e)) {
          return; // Let native behavior execute
        }

        if (isPotentialSendShortcut(e)) {
          // Special case for felo.ai - allow ctrl+enter for web search
          if (currentPlatform === "felo" && e.ctrlKey && e.key === "Enter" && !e.altKey && !e.metaKey) {
            return;
          }

          if (isInTextInput(target)) {
            e.stopPropagation();
          }
        }
      }
    },
    true
  );

  window.addEventListener(
    "keypress",
    (e) => {
      if (currentPlatform === "chatgpt") return;
      if (isChineseInputMode(e)) return;

      const target = getEventTarget(e);

      if (e.key === "Enter" && !e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
        if (isInTextInput(target)) {
          e.stopPropagation();
        }
      }

      if (isSendShortcut(e)) return;

      if (isPotentialSendShortcut(e)) {
        if (currentPlatform === "felo" && e.ctrlKey && e.key === "Enter" && !e.altKey && !e.metaKey) {
          return;
        }

        if (isInTextInput(target)) {
          e.stopPropagation();
        }
      }
    },
    true
  );

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════

  GM_registerMenuCommand("⚙️ AI Chat Enhancer Settings", createSettingsUI);

  function init() {
    applyPlatformStyles();
    LinkEnhancer.enhance();

    // Monitor page changes for SPAs
    window.addEventListener("popstate", applyPlatformStyles);
    window.addEventListener("pushstate", applyPlatformStyles);
    window.addEventListener("replacestate", applyPlatformStyles);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  console.info("[AI Chat Enhancer] Initialized for platform:", currentPlatform, "| Shortcuts:", currentShortcuts);
})();
