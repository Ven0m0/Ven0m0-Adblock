import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { findShadowedRules, isNetworkRule } from "./check-redundant-rules.mjs";

const kinds = JSON.parse(readFileSync(new URL("./rule_kinds.json", import.meta.url), "utf8"));
const NETWORK_KINDS = new Set(["exception", "network", "domain"]);

describe("isNetworkRule agrees with the shared line kinds", () => {
  for (const [kind, lines] of Object.entries(kinds)) {
    test.each(lines)(`${kind}: %j`, (line) => {
      expect(isNetworkRule(line)).toBe(NETWORK_KINDS.has(kind));
    });
  }
});

test("findShadowedRules flags a domain-scoped rule shadowed by a broader one", () => {
  const findings = findShadowedRules([
    { file: "t", line: 41, text: "||accounts.google.com^$3p" },
    { file: "t", line: 42, text: "||accounts.google.com^$3p,domain=~youtube.com|~x.com" }
  ]);
  expect(findings.map((f) => f.line)).toEqual([42]);
});
