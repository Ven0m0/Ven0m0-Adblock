# Implementation Plan: Performance Booster Userscript

## Source of Work Item

- **File:** `userscripts/src/TODO.md`
- **Description:** Implement a userscript that merges the best parts of six GreasyFork performance-optimization scripts.
- **Status:** No tracked code TODOs, no open GitHub issues with TODO/FIXME in the title. This is the only outstanding work item and the most recently touched userscript source file (2 commits in the last 30 days).

## Inspiration Scripts

1. [Enhanced Faster Webpage Loading (Optimized)](https://greasyfork.org/en/scripts/506713-enhanced-faster-webpage-loading-optimized) by Shannon Turner
2. [Hardware Acceleration and Web Performance Enhancer](https://greasyfork.org/en/scripts/502818-hardware-acceleration-and-web-performance-enhancer) by Tae
3. [Absolute Performance](https://greasyfork.org/en/scripts/549367-absolute-performance) by Gugu8
4. [BACKGROUND WEB OPTIMIZER (Ultra Performance) v10.0](https://greasyfork.org/en/scripts/550646-background-web-optimizer-ultra-performance-v10-0-optimized) by Gugu8
5. [Performance Booster Pro](https://greasyfork.org/en/scripts/549600-performance-booster-pro) by Gugu8
6. [Extremely Strong Efficiency Booster From 30 To 120 FPS](https://greasyfork.org/en/scripts/549499-extremely-strong-efficiency-booster-from-30-to-120-fps) by Gugu8

## Features to Merge

### 1. Lazy Loading
- Use `IntersectionObserver` to load `img[data-src]`, `video[data-src]`, and `iframe[data-src]` elements.
- Mark regular below-the-fold images as `loading="lazy"` and `decoding="async"`.
- Observe dynamically added content.

### 2. Link Prefetching / Resource Hints
- Add `<link rel="prefetch">` for visible same-origin links with a cap (e.g., 6–10 links) using `IntersectionObserver`.
- Add `<link rel="dns-prefetch">` and `<link rel="preconnect">` for discovered third-party origins.
- Skip auth/logout/account URLs to avoid accidental session changes.

### 3. Media Optimization
- Stop autoplay on `<video>` and `<audio>` elements; set `preload="metadata"`.
- Optionally convert image `src` hints to WebP where supported.
- Replace GIFs with muted looping `<video>` where a matching `.mp4` can be inferred.

### 4. Script Loading Optimization
- Defer non-critical external scripts (`script[src]`) that are not flagged critical.
- Skip inline-script relocation to avoid breaking inline expectations.

### 5. DOM Cleanup
- Remove HTML comments and empty style tags.
- Remove obvious ad/analytics containers only when an opt-in config is enabled.

### 6. Network Blocking (opt-in)
- Block known analytics/tracking requests in `fetch` and `XMLHttpRequest.open`.
- Prefer returning an empty 204 Response for blocked `fetch` calls.
- Keep blocking disabled by default to avoid breaking sites.

### 7. GPU / Rendering Hints
- Apply conservative `will-change: transform` and `transform: translateZ(0)` to media and canvas elements only.
- Avoid forcing acceleration on every element (some upstream scripts do this and it causes breakage).

### 8. Configuration & UI (lightweight)
- Use `GM_setValue` / `GM_getValue` for persistent toggles.
- Provide a small, draggable floating panel with toggle switches for major features and a live memory/FPS readout.
- Do not include heavy CSS animations or external fonts.

### 9. Error Handling & Safety
- Wrap every optimization in try/catch.
- Run at `document-start` for network-level patches and wait for `DOMContentLoaded` for DOM work.
- Bail out in iframes (`window.top !== window.self`) unless explicitly enabled.

## Implementation Phases

### Phase 1: Scaffold
- Create `userscripts/src/performance-booster.user.js`.
- Add Userscript metadata block (`@name`, `@version`, `@match`, `@grant`, `@run-at`, `@license`).
- Define a single top-level IIFE and a `CONFIG` object with defaults and feature flags.

### Phase 2: Core Utilities
- Implement safe wrappers: `safeCall`, `throttle`, `debounce`, `scheduleIdle`, `matchesBlocked`, `isAuthUrl`.
- Implement a tiny LRU cache for selector results if needed.

### Phase 3: Network Layer
- Patch `fetch` and `XMLHttpRequest.prototype.open` to short-circuit blocked hosts.
- Implement same-origin prefetcher with `IntersectionObserver` and a cap.

### Phase 4: DOM Optimizations
- Lazy-load data-src media.
- Optimize `<video>`, `<audio>`, and `<img>` attributes.
- Add `MutationObserver` for dynamic content.

### Phase 5: UI & Configuration
- Build a minimal floating panel.
- Wire toggles to `GM_setValue` / `GM_getValue`.
- Add real-time memory display only when `performance.memory` is available.

### Phase 6: Validation
- Run `bun run lint:js` and `bun run build:userscripts`.
- Fix any lint errors.
- Update `userscripts/list.txt` if the build pipeline does not do it automatically.

## Target File

- `userscripts/src/performance-booster.user.js`
- Build output handled by existing pipeline: `userscripts/dist/performance-booster.user.js` and `userscripts/list.txt`.

## Constraints

- Keep changes surgical; do not modify unrelated userscripts or filter lists.
- Follow existing repo conventions: 2-space indent, double quotes, semicolons, `const`/`let` only.
- Do not hand-edit generated files unless the build pipeline requires it.
- Avoid aggressive defaults that break sites (some upstream scripts explicitly warn about breakage).

## Risks

- Overriding globals (`fetch`, `setTimeout`, etc.) can break sites; gate behind config and test on a few pages.
- Blocking trackers by host list is incomplete compared to a real ad blocker; keep it opt-in.
- Prefetching every link can waste bandwidth; enforce a same-origin cap and intersection threshold.

## Validation Commands

```bash
bun run lint:js
bun run build:userscripts
bun run test
```

## Recommended Next Step

**Create `userscripts/src/performance-booster.user.js` with the scaffold, config object, and blocked-host matcher, then implement the network patches and lazy loader before adding the UI.**
