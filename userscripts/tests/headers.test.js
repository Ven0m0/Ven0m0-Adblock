import { describe, expect, test } from "bun:test";
import { listScripts, readScript } from "./harness.js";

const parse = (src) => {
  const m = src.match(/^\/\/ ==UserScript==\r?\n([\s\S]*?)\r?\n\/\/ ==\/UserScript==/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^\/\/\s+@(\S+)\s*(.*)$/);
    if (!kv) continue;
    meta[kv[1]] ??= [];
    meta[kv[1]].push(kv[2].trim());
  }
  return { meta, body: src.slice(m[0].length) };
};

// GM_info is always available and takes no @grant
const gmUsed = (body) =>
  [...new Set([...body.matchAll(/\b(GM_\w+|GM\.\w+|unsafeWindow)\b/g)].map((x) => x[1]))].filter(
    (u) => u !== "GM_info"
  );

const scripts = listScripts();

test("userscripts/src contains scripts", () => {
  expect(scripts.length).toBeGreaterThan(0);
});

describe.each(scripts)("%s", (name) => {
  const src = readScript(name);
  const parsed = parse(src);
  const meta = parsed?.meta ?? {};
  const body = parsed?.body ?? "";
  // Libraries pulled in via @require may define GM_* helpers (GM_config) and consume grants themselves.
  const hasRequire = Boolean(meta.require?.length);

  test("parses as JavaScript", () => {
    expect(() => new Function(src)).not.toThrow();
  });

  test("has a well-formed metadata block", () => {
    expect(parsed).not.toBeNull();
    expect(meta.name?.[0]).toBeTruthy();
    expect((meta.match?.length ?? 0) + (meta.include?.length ?? 0)).toBeGreaterThan(0);
  });

  // Userscript managers compare dotted numeric versions; date-based ones (2025.12.04.2) are valid
  test("@version is dotted numeric", () => {
    expect(meta.version?.[0]).toMatch(/^\d+(\.\d+)+$/);
  });

  test("single-value keys are not duplicated", () => {
    for (const k of ["name", "namespace", "version", "run-at", "author", "license"]) {
      expect([k, meta[k]?.length ?? 0]).toEqual([k, Math.min(meta[k]?.length ?? 0, 1)]);
    }
  });

  test("every GM API used in the body is granted", () => {
    const grants = meta.grant ?? [];
    const missing = gmUsed(body).filter((u) => !grants.includes(u) && !(hasRequire && u === "GM_config"));
    expect(missing).toEqual([]);
  });

  test("no @grant is declared but unused", () => {
    if (hasRequire) return;
    const used = gmUsed(body);
    const unused = (meta.grant ?? []).filter((g) => g !== "none" && !used.includes(g));
    expect(unused).toEqual([]);
  });

  test("@grant none is not combined with GM APIs", () => {
    const grants = meta.grant ?? [];
    if (grants.includes("none")) expect(grants).toEqual(["none"]);
  });
});

// yt-music owns music.youtube.com; both scripts patch canPlayType and timers there.
test("yt-pro does not run on music.youtube.com", () => {
  const src = readScript("yt-pro.user.js");
  expect(src.match(/^\/\/ @(?:match|include)\s+.*music\.youtube\.com.*$/gm) ?? []).toEqual([]);
  expect(src).toMatch(/^\/\/ @match\s+https:\/\/www\.youtube\.com\/\*$/m);
});
