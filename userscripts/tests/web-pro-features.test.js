import { afterEach, describe, expect, test } from "bun:test";
import { loadUserscript, makeElement, readScript } from "./harness.js";

const NAME = "web-pro.user.js";
const loaded = [];
const load = (opts) => {
  const s = loadUserscript(NAME, opts);
  loaded.push(s);
  return s;
};
afterEach(() => {
  for (const s of loaded.splice(0)) s.dispose();
});

// Runs the main pass (cleanURL, lazy loading, ...) the way DOMContentLoaded does.
const domReady = (s) => {
  s.document.readyState = "interactive";
  s.document.fire("DOMContentLoaded");
};
const cleanedURL = (url) => {
  const s = load({ url });
  domReady(s);
  return s.calls.replaceState.at(-1)?.[2];
};

describe("page URL cleaning", () => {
  test("strips tracking params and keeps the rest", () => {
    expect(cleanedURL("https://example.com/p?utm_source=x&id=5&fbclid=abc&q=shoes")).toBe(
      "https://example.com/p?id=5&q=shoes"
    );
  });

  test("leaves a clean URL untouched", () => {
    const s = load({ url: "https://example.com/p?id=5&q=shoes" });
    domReady(s);
    expect(s.calls.replaceState).toEqual([]);
  });

  test("does nothing when cleanURL is disabled", () => {
    const s = load({
      url: "https://example.com/p?utm_source=x",
      storage: { "ven0m0.webpro.v6": JSON.stringify({ cleanURL: 0 }) }
    });
    domReady(s);
    expect(s.calls.replaceState).toEqual([]);
  });

  // Regression: cleanURL rebuilt the URL without the #fragment.
  test("keeps the #fragment when stripping params", () => {
    expect(cleanedURL("https://example.com/docs?utm_source=x#install")).toBe("https://example.com/docs#install");
  });

  test.each([
    ["https://www.amazon.de/Some-Product/dp/b00test123/ref=sr_1_1?keywords=x&qid=1", "/dp/B00TEST123/"],
    ["https://www.amazon.com/gp/product/B00TEST123?th=1", "/dp/B00TEST123/"],
    ["https://www.amazon.co.uk/exec/obidos/ASIN/B00TEST123", "/dp/B00TEST123/"]
  ])("Amazon product URL %s is canonicalised", (url, path) => {
    expect(cleanedURL(url)).toBe(new URL(url).origin + path);
  });

  test("canonical Amazon URL is left alone", () => {
    const s = load({ url: "https://www.amazon.de/dp/B00TEST123/" });
    domReady(s);
    expect(s.calls.replaceState).toEqual([]);
  });
});

describe("link cleaning", () => {
  const withLinks = (hrefs) => {
    const links = hrefs.map((href) => Object.assign(makeElement("a"), { href }));
    const s = load({
      setup: (w) => {
        w.document.querySelectorAll = (sel) => (sel.startsWith("a[href]") ? links : []);
      }
    });
    // cleanLinks only runs from the MutationObserver on <html>.
    const mo = s.calls.observed.find((o) => o.target === s.document.documentElement);
    mo.observer.cb([]);
    return links.map((a) => a.href);
  };

  test("strips tracking params from cross-origin links only", () => {
    expect(
      withLinks([
        "https://other.test/a?utm_source=x&id=1",
        "https://other.test/b?id=1",
        "https://example.com/c?utm_source=x",
        "javascript:void(0)"
      ])
    ).toEqual([
      "https://other.test/a?id=1",
      "https://other.test/b?id=1",
      "https://example.com/c?utm_source=x",
      "javascript:void(0)"
    ]);
  });
});

describe("fetch cache", () => {
  test("non-string input and non-cacheable URLs go straight to the original fetch", async () => {
    const s = load();
    const req = new Request("https://example.com/a.css");
    const init = { method: "POST" };
    await s.window.fetch(req, init);
    await s.window.fetch("https://example.com/api/data", init);
    await s.window.fetch("https://example.com/a.css?v=2");
    expect(s.calls.fetch).toEqual([
      [req, init],
      ["https://example.com/api/data", init],
      ["https://example.com/a.css?v=2"]
    ]);
  });

  test("a cacheable URL is fetched once and served from cache afterwards", async () => {
    const s = load();
    const a = await s.window.fetch("https://example.com/a.css");
    const b = await s.window.fetch("https://example.com/a.css");
    expect(s.calls.fetch).toHaveLength(1);
    expect(await a.text()).toBe("body");
    expect(await b.text()).toBe("body");
  });

  test("failed responses are returned as-is and not cached", async () => {
    const s = load({
      setup: (w) => {
        w.fetch = () => Promise.resolve(new Response("nope", { status: 404 }));
      }
    });
    expect((await s.window.fetch("https://example.com/a.css")).status).toBe(404);
    expect((await s.window.fetch("https://example.com/a.css")).status).toBe(404);
  });

  test("caching disabled leaves every request alone", async () => {
    const s = load({ storage: { "ven0m0.webpro.v6": JSON.stringify({ caching: 0 }) } });
    await s.window.fetch("https://example.com/a.css");
    await s.window.fetch("https://example.com/a.css");
    expect(s.calls.fetch).toHaveLength(2);
  });

  // Regression: cache hits returned `new Response(text)`, dropping status, Content-Type and every other header.
  test("cache hit keeps response status and headers", async () => {
    const s = load();
    await s.window.fetch("https://example.com/a.css");
    const hit = await s.window.fetch("https://example.com/a.css");
    expect(hit.status).toBe(200);
    expect(hit.headers.get("content-type")).toBe("text/css");
    expect(hit.headers.get("x-test")).toBe("1");
  });

  // Regression: the cache key is the URL only, so a POST was answered from cache.
  test("requests with a non-GET method are not served from cache", async () => {
    const s = load();
    await s.window.fetch("https://example.com/b.json", { method: "POST", body: "1" });
    await s.window.fetch("https://example.com/b.json", { method: "POST", body: "2" });
    expect(s.calls.fetch).toHaveLength(2);
  });

  // Regression: woff2/ttf/eot matched CACHE.RX and were round-tripped through .text(), corrupting binary data
  // (even on the first, uncached request).
  test("binary font responses are returned byte-for-byte", async () => {
    const bytes = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0x00, 0xff, 0xfe, 0x80]);
    const s = load({
      setup: (w) => {
        w.fetch = () => Promise.resolve(new Response(bytes, { status: 200 }));
      }
    });
    const r = await s.window.fetch("https://example.com/font.woff2");
    expect([...new Uint8Array(await r.arrayBuffer())]).toEqual([...bytes]);
  });
});

// 6.2.0 removed script deferral: it ran after parser scripts had executed, so restoring them ran them twice,
// and its unanchored /ads?|.../ pattern caught names like download.js.
describe("script deferral is gone", () => {
  const withScript = (src) => {
    const script = makeElement("script");
    script.setAttribute("src", src);
    const s = load({
      setup: (w) => {
        w.document.querySelectorAll = (sel) => (sel.startsWith("script[src]") ? [script] : []);
      }
    });
    domReady(s);
    return script;
  };

  test.each([
    "https://www.googletagmanager.com/gtag/js?id=G-1",
    "https://cdn.example.com/app.js",
    "/static/js/lazyloader.js",
    "/assets/download.js",
    "/js/shadow-dom.js"
  ])("script %s keeps its src and type", (src) => {
    const script = withScript(src);
    expect(script.type).toBeUndefined();
    expect(script.getAttribute("src")).toBe(src);
    expect(script.getAttribute("data-wp-id")).toBeNull();
  });

  test("deferral code does not appear in the source", () => {
    expect(readScript(NAME).match(/SCRIPT_DENY|deferScripts|restoreScripts|text\/wp-blocked/g) ?? []).toEqual([]);
  });
});

// `ref` and `src` carry meaning on many sites; they are stripped on Amazon only.
describe("ref and src params", () => {
  test("are kept on ordinary sites", () => {
    expect(cleanedURL("https://example.com/p?ref=home&src=feed")).toBeUndefined();
  });

  test("are stripped next to real tracking params only on Amazon", () => {
    expect(cleanedURL("https://example.com/p?ref=home&utm_source=x")).toBe("https://example.com/p?ref=home");
    expect(cleanedURL("https://www.amazon.de/gp/bestsellers?ref=nav&src=x")).toBe(
      "https://www.amazon.de/gp/bestsellers"
    );
  });

  test("a /ref= path segment is rewritten on Amazon only", () => {
    expect(cleanedURL("https://example.com/docs/ref=guide")).toBeUndefined();
    expect(cleanedURL("https://www.amazon.de/gp/bestsellers/ref=zg_bs_nav")).toBe(
      "https://www.amazon.de/gp/bestsellers"
    );
  });
});

describe("page preloads", () => {
  test("prefetch links are removed, preload links are left alone", () => {
    const seen = [];
    const s = load({
      setup: (w) => {
        w.document.querySelectorAll = (sel) => {
          seen.push(sel);
          return [];
        };
      }
    });
    domReady(s);
    expect(seen.some((sel) => sel.includes('rel="prefetch"'))).toBe(true);
    expect(seen.some((sel) => sel.includes('rel="preload"'))).toBe(false);
  });
});

// Script tags are no longer removed by host name; that is left to the filter lists.
describe("DOM cleanup", () => {
  test("tracker script tags are left in place", () => {
    const script = makeElement("script");
    script.setAttribute("src", "https://www.googletagmanager.com/gtag/js?id=G-1");
    let removed = false;
    script.remove = () => {
      removed = true;
    };
    const s = load({
      setup: (w) => {
        w.document.querySelectorAll = (sel) => (sel.startsWith("script") ? [script] : []);
      }
    });
    domReady(s);
    expect(removed).toBe(false);
    expect(readScript(NAME)).not.toContain("TRACKER_SCRIPTS");
  });
});
