---
name: new-userscript
description: Scaffold a new userscript in userscripts/src/ with the correct header, guard pattern, and project conventions for this repo.
---

When the user asks to create a new userscript, collect (ask if not provided):
- Script name (human-readable, e.g. "Reddit Cleaner")
- Target URL pattern(s) — one or more `@match` values
- What the script does (one sentence for `@description`)
- Any GM grants needed (`GM_getValue`, `GM_setValue`, `GM_addStyle`, etc.) — default to `none` if unsure

Then create `userscripts/src/<kebab-name>.user.js` with this exact structure:

```js
// ==UserScript==
// @name         <Name>
// @author       Ven0m0
// @namespace    http://tampermonkey.net/
// @homepageURL  https://github.com/Ven0m0/Ven0m0-Adblock
// @version      1.0.0
// @description  <description>
// @match        <match pattern>
// @grant        <grant or none>
// @run-at       document-start
// @license      MIT
// ==/UserScript==
(() => {
  const GUARD = "__<script_slug>__";
  if (window[GUARD]) return;
  window[GUARD] = 1;

  if (localStorage.getItem("disable_<script_slug>") === "1") return;

  // implementation
})();
```

Rules to follow:
- `<script_slug>` = lowercase snake_case of the name, e.g. `reddit_cleaner`
- Use `const`/`let`, never `var`
- Use `===` not `==`; no `eval`
- 2-space indent, double quotes, semicolons (biome enforces this)
- Only declare `@grant` values that are actually called in the body
- Use `@run-at document-start` for prototype patches; `document-end` for DOM-only work

After writing the file, run:
```
bun x biome check --write userscripts/src/<file>
```

Then confirm the file was created and formatted cleanly.
