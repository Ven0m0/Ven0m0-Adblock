// ==UserScript==
// @name         GitHub Enhanced: Size & Editor (Lean)
// @namespace    Ven0m0
// @homepageURL  https://github.com/Ven0m0/Ven0m0-Adblock
// @version      2025.12.04.2
// @description  Show GitHub file/folder sizes + set editor defaults with minimal overhead.
// @match        https://github.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @require      https://cdn.jsdelivr.net/gh/kufii/My-UserScripts@22210afba13acf7303fc91590b8265faf3c7eda7/libs/gm_config.js
// @require      https://cdn.jsdelivr.net/gh/fuzetsu/userscripts@ec863aa92cea78a20431f92e80ac0e93262136df/wait-for-elements/wait-for-elements.js
// @license      MIT
// @run-at       document-idle
// ==/UserScript==
(() => {
  // prettier-ignore
  const CFG = {
    EDITOR: { indentMode: "space", indentWidth: 2, wrapMode: "on" },
    SIZE: {
      DEPTH: 4,
      INIT_DELAY: 1200,
      URL_DELAY: 1200,
      THR: 800,
      KB: 1024 * 1024,
      MB: 1024 * 1024 * 1024,
      API: "https://api.github.com/repos"
    }
  };
  const SEL = {
    CODE: ".CodeMirror-code",
    MODE: ".js-code-indent-mode",
    WIDTH: ".js-code-indent-width",
    WRAP: ".js-code-wrap-mode",
    TABLE: "table tbody",
    LINKS: 'a[href*="/blob/"], a[href*="/tree/"]',
    TAG: "gh-size-viewer"
  };
  const PAT = { NEW: /\/new\//, EDIT: /\/edit\// };
  const throttle = (fn, ms) => {
    let t = 0;
    return () => {
      const n = Date.now();
      if (n - t >= ms) {
        t = n;
        fn();
      }
    };
  };
  function initEditor() {
    // prettier-ignore
    const Config = GM_config([
      {
        key: "indentMode",
        label: "Indent mode",
        default: CFG.EDITOR.indentMode,
        type: "dropdown",
        values: [
          { value: "space", text: "Spaces" },
          { value: "tab", text: "Tabs" }
        ]
      },
      {
        key: "indentWidth",
        label: "Indent size",
        default: CFG.EDITOR.indentWidth,
        type: "dropdown",
        values: [2, 4, 8]
      },
      {
        key: "wrapMode",
        label: "Line wrap",
        default: CFG.EDITOR.wrapMode,
        type: "dropdown",
        values: [
          { value: "off", text: "No wrap" },
          { value: "on", text: "Soft wrap" }
        ]
      }
    ]);
    GM_registerMenuCommand("GitHub Editor Settings", Config.setup);
    const st = Config.load();
    const set = (el, v) => {
      if (!el) return;
      el.value = v;
      const e = document.createEvent("HTMLEvents");
      e.initEvent("change", false, true);
      el.dispatchEvent(e);
    };
    const apply = (cfg) => {
      const m = document.querySelector(SEL.MODE);
      const w = document.querySelector(SEL.WIDTH);
      const wr = document.querySelector(SEL.WRAP);
      if (PAT.NEW.test(location.href)) {
        set(m, cfg.indentMode);
        set(w, cfg.indentWidth);
        set(wr, cfg.wrapMode);
      } else if (PAT.EDIT.test(location.href)) {
        if (m && m.value === "tab") set(w, cfg.indentWidth);
        set(wr, cfg.wrapMode);
      }
    };
    waitForElems({
      sel: SEL.CODE,
      onmatch() {
        apply(st);
      }
    });
  }
  const fmt = (b) =>
    b < CFG.SIZE.KB
      ? `${(b / 1024).toFixed(2)} KB`
      : b < CFG.SIZE.MB
        ? `${(b / 1048576).toFixed(2)} MB`
        : `${(b / 1073741824).toFixed(2)} GB`;
  const calcDir = async (url, h, depth) => {
    if (depth > CFG.SIZE.DEPTH) return { size: 0, cnt: 0 };
    const r = await fetch(url, { headers: h });
    if (!r.ok) return { size: 0, cnt: 0 };
    const d = await r.json();
    if (!Array.isArray(d)) return { size: 0, cnt: 0 };
    const res = await Promise.all(
      d.map(async (it) => {
        if (it.type === "file") return { size: it.size || 0, cnt: 1 };
        if (it.type === "dir" && it.url) return calcDir(it.url, h, depth + 1);
        return { size: 0, cnt: 0 };
      })
    );
    return {
      size: res.reduce((s, x) => s + x.size, 0),
      cnt: res.reduce((s, x) => s + x.cnt, 0)
    };
  };
  const fetchSize = async (url) => {
    const tok = GM_getValue("GITHUB_TOKEN", "");
    const h = { Accept: "application/vnd.github.v3+json" };
    if (tok) h.Authorization = `token ${tok}`;
    const r = await fetch(url, { headers: h });
    if (!r.ok) return null;
    const d = await r.json();
    if (Array.isArray(d)) {
      const { size, cnt } = await calcDir(url, h, 0);
      return size
        ? `${fmt(size)} (${cnt} ${cnt === 1 ? "file" : "files"})`
        : `Folder (${cnt} ${cnt === 1 ? "file" : "files"})`;
    }
    if (d?.type === "file" && typeof d.size === "number") return `${fmt(d.size)} (1 file)`;
    return null;
  };
  const insert = (link, text) => {
    if (link.nextSibling?.classList?.contains(SEL.TAG)) return;
    const span = document.createElement("span");
    span.className = SEL.TAG;
    span.style.marginLeft = "8px";
    span.style.fontSize = "smaller";
    span.style.color = "#6a737d";
    span.textContent = `(${text})`;
    link.insertAdjacentElement("afterend", span);
  };
  const showSizes = async () => {
    const tbody = document.querySelector(SEL.TABLE);
    if (!tbody) return;
    const links = [...tbody.querySelectorAll(SEL.LINKS)].filter((l) => !l.nextSibling?.classList?.contains(SEL.TAG));
    if (!links.length) return;
    await Promise.all(
      links.map(async (l) => {
        const parts = l.href.split("/");
        const idx = parts.indexOf(parts.includes("blob") ? "blob" : "tree");
        if (idx < 0) return;
        const user = parts[3];
        const repo = parts[4];
        const branch = parts[idx + 1];
        const path = parts.slice(idx + 2).join("/");
        if (!user || !repo || !branch) return;
        const api = `${CFG.SIZE.API}/${user}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
        const v = await fetchSize(api);
        if (!v) return;
        insert(l, v);
      })
    );
  };
  const watchURL = (cb, delay) => {
    let last = location.href;
    let pending = 0;
    const run = () => {
      pending = 0;
      cb();
    };
    new MutationObserver(() => {
      const u = location.href;
      if (u !== last) {
        last = u;
        if (!pending) {
          pending = 1;
          setTimeout(run, delay);
        }
      }
    }).observe(document, { childList: true, subtree: true });
  };
  function initSize() {
    setTimeout(showSizes, CFG.SIZE.INIT_DELAY);
    watchURL(showSizes, CFG.SIZE.URL_DELAY);
    new MutationObserver(throttle(showSizes, CFG.SIZE.THR)).observe(document, {
      childList: true,
      subtree: true
    });
  }
  initEditor();
  window.addEventListener("load", initSize);
})();
