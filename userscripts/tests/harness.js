// Loads a real userscript source file into a stubbed browser-like sandbox.
// The source runs inside `with (window) { ... }` so bare identifiers (setTimeout, document, GM_*)
// resolve to the fake window first, exactly like globals in a page, and fall back to Bun's
// real globals (URL, Response, Promise, performance, queueMicrotask) otherwise.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const SRC_DIR = join(import.meta.dir, "..", "src");
export const listScripts = () =>
  readdirSync(SRC_DIR)
    .filter((f) => f.endsWith(".user.js"))
    .sort();
export const readScript = (name) => readFileSync(join(SRC_DIR, name), "utf8");

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeTarget() {
  const listeners = {};
  return {
    listeners,
    addEventListener(type, fn) {
      listeners[type] ??= [];
      listeners[type].push(fn);
    },
    removeEventListener(type, fn) {
      listeners[type] = (listeners[type] || []).filter((f) => f !== fn);
    },
    fire(type, ev = {}) {
      for (const fn of [...(listeners[type] || [])]) fn({ type, target: this, ...ev });
    }
  };
}

export function makeElement(tag) {
  const attrs = {};
  const el = {
    tagName: String(tag).toUpperCase(),
    nodeType: 1,
    style: {},
    dataset: {},
    children: [],
    parentNode: null,
    setAttribute: (k, v) => {
      attrs[k] = String(v);
    },
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    hasAttribute: (k) => k in attrs,
    removeAttribute: (k) => {
      delete attrs[k];
    },
    appendChild(c) {
      el.children.push(c);
      c.parentNode = el;
      return c;
    },
    append(...cs) {
      for (const c of cs) el.appendChild(c);
    },
    removeChild(c) {
      el.children = el.children.filter((x) => x !== c);
      return c;
    },
    remove() {
      el.parentNode?.removeChild(el);
    },
    querySelectorAll: () => [],
    getElementsByTagName: () => [],
    querySelector: () => null,
    contains: () => false
  };
  return el;
}

// characterData observers fire as a microtask when the observed comment's data changes,
// which is all the CPU tamer needs. Other observe() calls are only recorded.
function makeMutationObserver(observed) {
  return class FakeMutationObserver {
    constructor(cb) {
      this.cb = cb;
    }
    observe(target, opts) {
      observed.push({ target, opts, observer: this });
      target?.__observers?.push(this);
    }
    disconnect() {}
  };
}

function makeComment() {
  let data = "";
  const node = {
    nodeType: 8,
    __observers: [],
    get data() {
      return data;
    },
    set data(v) {
      data = v;
      queueMicrotask(() => {
        for (const o of node.__observers) o.cb([], o);
      });
    }
  };
  return node;
}

/**
 * @param {string} name file name in userscripts/src
 * @param {object} [opts]
 * @param {string} [opts.url] page URL
 * @param {Record<string, string>} [opts.storage] initial localStorage
 * @param {Record<string, unknown>} [opts.gmValues] initial GM storage
 * @param {"loading"|"interactive"|"complete"} [opts.readyState]
 * @param {boolean} [opts.noHead] simulate document-start before <head>/<body> exist
 * @param {(window: object) => void} [opts.setup] mutate the fake window before the script runs
 */
export function loadUserscript(name, opts = {}) {
  const url = new URL(opts.url || "https://example.com/page");
  const store = new Map(Object.entries(opts.storage || {}));
  const gm = new Map(Object.entries(opts.gmValues || {}));
  const timers = new Set();
  const calls = {
    fetch: [],
    replaceState: [],
    menu: [],
    styles: [],
    gmGet: [],
    gmSet: [],
    observed: [],
    native: { setTimeout: [], setInterval: [] }
  };

  const document = Object.assign(makeTarget(), {
    readyState: opts.readyState || "loading",
    hidden: false,
    visibilityState: "visible",
    documentElement: makeElement("html"),
    head: opts.noHead ? null : makeElement("head"),
    body: opts.noHead ? null : makeElement("body"),
    createElement: makeElement,
    createComment: makeComment,
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementsByTagName: () => []
  });

  const nativeFetch = (...args) => {
    calls.fetch.push(args);
    return Promise.resolve(
      new Response("body", { status: 200, headers: { "Content-Type": "text/css", "X-Test": "1" } })
    );
  };
  class HTMLMediaElement {}
  HTMLMediaElement.prototype.canPlayType = () => "probably";
  class HTMLImageElement {}

  const window = Object.assign(makeTarget(), {
    document,
    location: {
      href: url.href,
      hostname: url.hostname,
      origin: url.origin,
      pathname: url.pathname,
      search: url.search,
      reload() {}
    },
    navigator: { sendBeacon: () => true },
    history: { replaceState: (...a) => calls.replaceState.push(a) },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    },
    setTimeout: (fn, ms, ...a) => {
      calls.native.setTimeout.push(ms);
      const id = setTimeout(fn, ms, ...a);
      timers.add(id);
      return id;
    },
    setInterval: (fn, ms, ...a) => {
      calls.native.setInterval.push(ms);
      const id = setInterval(fn, ms, ...a);
      timers.add(id);
      return id;
    },
    clearTimeout: (id) => clearTimeout(id),
    clearInterval: (id) => clearInterval(id),
    requestAnimationFrame: (cb) => {
      const id = setTimeout(() => cb(performance.now()), 1);
      timers.add(id);
      return id;
    },
    cancelAnimationFrame: (id) => clearTimeout(id),
    fetch: nativeFetch,
    XMLHttpRequest: class XMLHttpRequest {
      open() {}
    },
    MutationObserver: makeMutationObserver(calls.observed),
    IntersectionObserver: class IntersectionObserver {
      observe() {}
      unobserve() {}
    },
    MediaSource: { isTypeSupported: () => true },
    HTMLMediaElement,
    HTMLImageElement,
    Node: { ELEMENT_NODE: 1 },
    GM_registerMenuCommand: (label, fn) => calls.menu.push({ label, fn }),
    GM_addStyle: (css) => calls.styles.push(css),
    GM_getValue: (k, d) => {
      calls.gmGet.push(k);
      return gm.has(k) ? gm.get(k) : d;
    },
    GM_setValue: (k, v) => {
      calls.gmSet.push(k);
      gm.set(k, v);
    }
  });
  window.window = window;
  window.self = window;
  window.top = window;
  const natives = {
    fetch: window.fetch,
    sendBeacon: window.navigator.sendBeacon,
    xhrOpen: window.XMLHttpRequest.prototype.open,
    setTimeout: window.setTimeout,
    setInterval: window.setInterval,
    requestAnimationFrame: window.requestAnimationFrame
  };
  opts.setup?.(window);

  let error = null;
  try {
    new Function("window", `with (window) {\n${readScript(name)}\n}`)(window);
  } catch (e) {
    error = e;
  }

  return {
    window,
    document,
    calls,
    natives,
    store,
    gm,
    error,
    dispose() {
      for (const id of timers) clearTimeout(id);
    }
  };
}
