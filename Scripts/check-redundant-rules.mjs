#!/usr/bin/env bun
// Flags a domain-scoped rule that is permanently unreachable because a
// broader rule with the same body and no domain restriction already
// exists earlier in the same file set (the class of bug fixed in
// General.txt where an unconditional block shadowed a narrower exception).
import { globSync, readFileSync } from "node:fs";

function parseRules(file) {
  const lines = readFileSync(file, "utf8").split("\n");
  const rules = [];
  lines.forEach((raw, i) => {
    const text = raw.trim();
    if (!text || text.startsWith("!") || text.startsWith("[") || /#[@$%]?#/.test(text)) return;
    rules.push({ file, line: i + 1, text });
  });
  return rules;
}

function domainModifier(text) {
  const m = text.match(/[,$]domain=([^,]+)/i);
  return m ? m[1] : null;
}

function bodyOf(text) {
  return text.replace(/^@@/, "").replace(/[,$]domain=[^,]+/i, "");
}

export function findShadowedRules(rules) {
  const findings = [];
  const seenBroad = new Map();
  for (const rule of rules) {
    const kind = rule.text.startsWith("@@") ? "exception" : "block";
    const key = `${kind}|${bodyOf(rule.text)}`;
    const domain = domainModifier(rule.text);
    if (!domain) {
      if (!seenBroad.has(key)) seenBroad.set(key, rule);
      continue;
    }
    const broad = seenBroad.get(key);
    if (broad) {
      findings.push({
        file: rule.file,
        line: rule.line,
        text: rule.text,
        reason: `shadowed by broader ${kind} rule at ${broad.file}:${broad.line}`,
      });
    }
  }
  return findings;
}

function selfTest() {
  const sample = [
    { file: "test", line: 41, text: "||accounts.google.com^$3p" },
    { file: "test", line: 42, text: "||accounts.google.com^$3p,domain=~youtube.com|~twitter.com|~x.com" },
  ];
  const findings = findShadowedRules(sample);
  console.assert(findings.length === 1, "expected 1 shadowed finding");
  console.assert(findings[0]?.line === 42, "expected line 42 flagged");
  console.log("self-test passed");
}

if (process.argv[2] === "--test") {
  selfTest();
  process.exit(0);
}

const patterns = process.argv.slice(2);
if (patterns.length === 0) {
  console.error("Usage: check-redundant-rules.mjs <file-or-glob>... | --test");
  process.exit(1);
}

const files = [...new Set(patterns.flatMap((p) => (p.includes("*") ? globSync(p) : [p])))];
const findings = findShadowedRules(files.flatMap(parseRules));

if (findings.length === 0) {
  console.log("No redundant/shadowed rules found.");
} else {
  for (const f of findings) console.log(`${f.file}:${f.line} — ${f.reason} — ${f.text}`);
}
