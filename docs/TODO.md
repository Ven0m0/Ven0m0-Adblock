# TODO

Single backlog for the repo. Add new items here instead of creating more TODO or PLAN files.

## Open

- [ ] Browser-test `userscripts/src/web-pro.user.js` 6.1.0 in Tampermonkey or Violentmonkey: a login flow,
      a checkout/cart page, and a media site. Toggle `viewportPrefetch`, `asyncDecode` and
      `blockExtraTrackers`; confirm no console errors and no prefetch of excluded URLs.
- [ ] Decide whether `lists/hostlist/windows-telemetry.txt` and `lists/hostlist/Spotify.txt` are hand-maintained
      or upstream copies (no source header). Remove them if they are upstream copies.
- [ ] `lists/adblock/exp.txt`, `lists/hostlist/Experimental.txt` and `lists/hostlist/Test.txt` are not part of any
      build or combination list. Promote their rules into a real list or delete them.

## Done

- [x] Hostlist-compiler config (`hostlist-config.json`)
- [x] Cross-file duplicate rules consolidated
- [x] Redundant rule checker (`bun run lint:redundancy`)
- [x] Reddit login fix (`accounts.google.com` third-party block now excludes `reddit.com`)
- [x] Removed upstream list and userscript downloads; repo holds own content only

## Decided against

- Migrating the Python tooling in `Scripts/` to Bun/JS: it works and is tested; not worth the rewrite.
