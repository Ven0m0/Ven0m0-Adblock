import { afterEach, describe, expect, test } from "bun:test";
import { loadUserscript, readScript, sleep } from "./harness.js";

const NAME = "web-pro.user.js";
const CFG_KEY = "ven0m0.webpro.v6";
const loaded = [];
const load = (opts) => {
  const s = loadUserscript(NAME, opts);
  loaded.push(s);
  return s;
};
afterEach(() => {
  for (const s of loaded.splice(0)) s.dispose();
});

// Opens the settings panel and returns its checkboxes (label > input[type=checkbox]).
const openPanel = (s) => {
  s.calls.menu[0].fn();
  const panel = s.document.body.children.find((c) => c.id === "wp-panel");
  const modal = panel.children.find((c) => c.className === "wp-modal");
  return modal.children.filter((c) => c.className === "wp-row").map((row) => row.children[0]);
};
// Toggling any checkbox persists the whole merged config, which exposes the default keys.
const configKeys = (s) => {
  const [cb] = openPanel(s);
  cb.onchange({ target: cb });
  return Object.keys(JSON.parse(s.store.get(CFG_KEY)));
};

describe("load", () => {
  test("runs with default config without throwing", () => {
    const s = load();
    expect(s.error).toBeNull();
    expect(s.window.__webpro_v6__).toBe(true);
    expect(s.calls.menu).toHaveLength(1);
  });

  test("runs when the document is already complete", () => {
    expect(load({ readyState: "complete" }).error).toBeNull();
  });

  test("DOMContentLoaded handlers run without throwing", () => {
    const s = load();
    s.document.readyState = "interactive";
    expect(() => s.document.fire("DOMContentLoaded")).not.toThrow();
  });

  test("per-site disable key stops the script before it patches anything", () => {
    const s = load({ storage: { "webpro:disable:example.com": "1" } });
    expect(s.error).toBeNull();
    // Only the "Enable on this site" command is registered, not the settings one
    expect(s.calls.menu.map((m) => m.label)).toEqual(["Web Pro ⚡ Enable on this site"]);
    expect(s.window.fetch).toBe(s.natives.fetch);
    expect(s.window.setTimeout).toBe(s.natives.setTimeout);
  });

  test("duplicate-load guard stops a second instance", () => {
    const s = load({
      setup: (w) => {
        w.__webpro_v6__ = true;
      }
    });
    expect(s.calls.menu).toHaveLength(0);
    expect(s.window.fetch).toBe(s.natives.fetch);
  });

  test("corrupt stored config falls back to defaults", () => {
    const s = load({ storage: { [CFG_KEY]: "{not json" } });
    expect(s.error).toBeNull();
    expect(configKeys(s)).toContain("cpuTamer");
  });

  // Regression: captcha branch used document.head at document-start, before <head> exists.
  test("reCAPTCHA frame: survives document-start before <head> exists", () => {
    const s = load({ noHead: true, url: "https://www.google.com/recaptcha/api2/bframe?k=1" });
    expect(s.error).toBeNull();
  });

  // Regression: initAmazon used document.head synchronously at document-start.
  test("Amazon: survives document-start before <head> exists", () => {
    const s = load({ noHead: true, url: "https://www.amazon.de/dp/B00TEST123" });
    expect(s.error).toBeNull();
  });
});

describe("6.1.1 removals stay removed", () => {
  test("no sendBeacon or XMLHttpRequest.open override is installed", () => {
    const s = load();
    expect(s.window.navigator.sendBeacon).toBe(s.natives.sendBeacon);
    expect(s.window.XMLHttpRequest.prototype.open).toBe(s.natives.xhrOpen);
  });

  test("removed identifiers do not appear in the source", () => {
    const gone =
      /\b(limitFPS|ytPrivacy|darkMode|disableWebGL|pauseGIFs|blockExtraTrackers|blockBeacons|xhrBlock|TRACKER_HOSTS|EXTRA_TRACKER_HOSTS|ALLOW_KW|isTracker|isTrusted|mainDomain|sendBeacon|XMLHttpRequest|GM_addStyle)\b/g;
    expect(readScript(NAME).match(gone) ?? []).toEqual([]);
  });

  test("removed keys are absent from default config and settings labels", () => {
    const s = load();
    const removed = [
      "limitFPS",
      "ytPrivacy",
      "darkMode",
      "disableWebGL",
      "pauseGIFs",
      "blockExtraTrackers",
      "blockBeacons",
      "xhrBlock"
    ];
    const labels = openPanel(s).map((cb) => cb.dataset.k);
    const keys = configKeys(s);
    for (const k of removed) {
      expect(keys).not.toContain(k);
      expect(labels).not.toContain(k);
    }
  });

  test("every settings label has a default config key", () => {
    const s = load();
    const labels = openPanel(s).map((cb) => cb.dataset.k);
    const keys = configKeys(s);
    expect(labels.filter((k) => !keys.includes(k))).toEqual([]);
  });

  // Regression: cfg.prefetch ("Link prefetch hints" label) and cfg.linkPrefetch were never read.
  test("every boolean config key is read somewhere", () => {
    const s = load();
    const src = readScript(NAME);
    const dead = configKeys(s).filter((k) => !new RegExp(`cfg\\.${k}\\b`).test(src));
    expect(dead).toEqual([]);
  });

  test("opening the settings panel twice does not duplicate it", () => {
    const s = load();
    s.document.getElementById = (id) => s.document.body.children.find((c) => c.id === id) ?? null;
    s.calls.menu[0].fn();
    s.calls.menu[0].fn();
    expect(s.document.body.children.filter((c) => c.id === "wp-panel")).toHaveLength(1);
  });
});

describe("CPU / RAF tamer", () => {
  test("overrides are installed by default and skipped on YouTube", () => {
    const s = load();
    expect(s.window.setTimeout).not.toBe(s.natives.setTimeout);
    expect(s.window.requestAnimationFrame).not.toBe(s.natives.requestAnimationFrame);
    const yt = load({ url: "https://www.youtube.com/watch?v=x" });
    expect(yt.window.requestAnimationFrame).toBe(yt.natives.requestAnimationFrame);
  });

  test("requestAnimationFrame callback runs with a numeric timestamp", async () => {
    const { window } = load();
    let ts;
    window.requestAnimationFrame((t) => {
      ts = t;
    });
    await sleep(80);
    expect(typeof ts).toBe("number");
    expect(Number.isNaN(ts)).toBe(false);
  });

  test("cancelAnimationFrame prevents the callback", async () => {
    const { window } = load();
    let ran = false;
    const id = window.requestAnimationFrame(() => {
      ran = true;
    });
    window.cancelAnimationFrame(id);
    await sleep(80);
    expect(ran).toBe(false);
  });

  test("setTimeout callback runs and receives extra arguments", async () => {
    const { window } = load();
    let got;
    window.setTimeout(
      (a, b) => {
        got = [a, b];
      },
      0,
      1,
      2
    );
    await sleep(80);
    expect(got).toEqual([1, 2]);
  });

  test("setTimeout delay is clamped to minTimeout", () => {
    const s = load();
    s.calls.native.setTimeout.length = 0;
    s.window.clearTimeout(s.window.setTimeout(() => {}, 0));
    expect(s.calls.native.setTimeout).toEqual([15]);
  });

  test("clearTimeout prevents the callback", async () => {
    const { window } = load();
    let ran = false;
    const id = window.setTimeout(() => {
      ran = true;
    }, 0);
    window.clearTimeout(id);
    await sleep(80);
    expect(ran).toBe(false);
  });

  test("setInterval fires repeatedly and clearInterval stops it", async () => {
    const { window } = load();
    let n = 0;
    const id = window.setInterval(() => n++, 20);
    await sleep(150);
    window.clearInterval(id);
    const seen = n;
    expect(seen).toBeGreaterThan(1);
    await sleep(80);
    expect(n).toBe(seen);
  });

  test("a throwing callback does not break later timers", async () => {
    // The tamer rethrows callback errors from a microtask; capture that rethrow here.
    const realMicro = globalThis.queueMicrotask;
    const errors = [];
    const t = load({
      setup: (w) => {
        w.queueMicrotask = (fn) =>
          realMicro(() => {
            try {
              fn();
            } catch (e) {
              errors.push(e);
            }
          });
      }
    });
    let ran = false;
    t.window.setTimeout(() => {
      throw new Error("boom");
    }, 0);
    t.window.setTimeout(() => {
      ran = true;
    }, 20);
    await sleep(120);
    expect(errors.map((e) => e.message)).toEqual(["boom"]);
    expect(ran).toBe(true);
  });
});

describe("background throttle and tab save", () => {
  const setHidden = (s, hidden) => {
    s.document.hidden = hidden;
    s.document.visibilityState = hidden ? "hidden" : "visible";
    s.document.fire("visibilitychange");
  };

  test("hidden tab clamps new timers to 2s; visible tab restores the tamed timers", () => {
    const s = load();
    const tamedTO = s.window.setTimeout;
    const tamedSI = s.window.setInterval;
    setHidden(s, true);
    s.calls.native.setTimeout.length = 0;
    s.window.clearTimeout(s.window.setTimeout(() => {}, 10));
    expect(s.calls.native.setTimeout).toEqual([2000]);
    setHidden(s, false);
    expect(s.window.setTimeout).toBe(tamedTO);
    expect(s.window.setInterval).toBe(tamedSI);
  });

  test("a timer created while hidden can still be cleared", async () => {
    const s = load();
    setHidden(s, true);
    let ran = false;
    const id = s.window.setTimeout(() => {
      ran = true;
    }, 0);
    s.window.clearTimeout(id);
    setHidden(s, false);
    await sleep(50);
    expect(ran).toBe(false);
  });

  test("tabSave is off by default", () => {
    const s = load();
    setHidden(s, true);
    expect(s.document.documentElement.style.display).toBeUndefined();
  });

  test("a timer patch installed later by the page survives a hide/show cycle", () => {
    const s = load();
    const pagePatch = () => 0;
    s.window.setTimeout = pagePatch;
    setHidden(s, true);
    expect(s.window.setTimeout).toBe(pagePatch);
    setHidden(s, false);
    expect(s.window.setTimeout).toBe(pagePatch);
  });

  test("tabSave, when enabled, hides the document while hidden and restores it", () => {
    const s = load({ storage: { "ven0m0.webpro.v6": JSON.stringify({ tabSave: 1 }) } });
    setHidden(s, true);
    expect(s.document.documentElement.style.display).toBe("none");
    setHidden(s, false);
    expect(s.document.documentElement.style.display).toBe("");
  });
});

describe("6.2.0 behaviour", () => {
  // With @grant the script runs in a sandbox: patches have to land on the page window (unsafeWindow).
  test("page globals are patched on unsafeWindow, not on the sandbox window", () => {
    let page;
    const s = load({
      setup: (w) => {
        page = { navigator: w.navigator, console };
        for (const k of [
          "setTimeout",
          "setInterval",
          "clearTimeout",
          "clearInterval",
          "requestAnimationFrame",
          "cancelAnimationFrame",
          "fetch"
        ])
          page[k] = w[k];
        w.unsafeWindow = page;
      }
    });
    expect(s.error).toBeNull();
    for (const k of ["setTimeout", "setInterval", "requestAnimationFrame", "fetch"]) {
      expect(page[k]).not.toBe(s.natives[k]);
      expect(s.window[k]).toBe(s.natives[k]);
    }
  });

  test("a site disabled with the toggle offers a menu command that re-enables it", () => {
    const key = "webpro:disable:example.com";
    const s = load({ storage: { [key]: "1" } });
    expect(s.window.setTimeout).toBe(s.natives.setTimeout);
    expect(s.calls.menu).toHaveLength(1);
    s.calls.menu[0].fn();
    expect(s.store.has(key)).toBe(false);
  });

  test("survives a frame where localStorage access throws", () => {
    const s = load({
      setup: (w) => {
        Object.defineProperty(w, "localStorage", {
          get() {
            throw new Error("SecurityError");
          }
        });
      }
    });
    expect(s.error).toBeNull();
  });

  // Regression: every tick of an interval shared one pending slot, so a tick that fired while
  // the previous one was still waiting was dropped.
  test("clearInterval from inside the callback stops further ticks", async () => {
    const s = load();
    let ticks = 0;
    const id = s.window.setInterval(() => {
      if (++ticks === 2) s.window.clearInterval(id);
    }, 20);
    await sleep(160);
    expect(ticks).toBe(2);
  });
});
