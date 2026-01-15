# TODO

## Maintenance Tasks

### Completed ✅
- ✅ Added uBlockOrigin resource-abuse.txt filter to `lists/sources-urls.json`
- ✅ Added adguard-extra userscript to `userscripts/list.txt`
- ✅ Ran deduplicate.py (found 348 cross-file duplicates for manual review)
- ✅ Ran format command (formatted 26 files, fixed 15)
- ✅ Ran lint:fix command (ESLint passed, AGLint found 133 issues)

### Manual Review Needed
- Review and consolidate 348 cross-file duplicates found by deduplicate.py
- Fix AGLint errors in filter lists:
  - if/endif directive mismatches in Reddit.txt, Search-Engines.txt, Twitch.txt, Youtube.txt
  - IPv6 domain values in lan-block.txt
  - Empty modifiers in hostlist files
  - Invalid CSS syntax in Other.txt
  - Unsupported modifiers in URLShortener.txt

## Future Improvements

- Consider consolidating cross-file duplicates into appropriate categories
- Add automated testing for blocklist validity
- Set up CI/CD for automatic list updates

## Useful Resources

- https://github.com/blocklistproject/Lists
- https://github.com/AdguardTeam/HostlistCompiler
- https://github.com/AdguardTeam/AGLint
- https://github.com/AdguardTeam/DeadDomainsLinter



### TODO: userscripts

Use bun for building/bundling

```bash
bun build --compile --bytecode --minify --sourcemap --outdir=./dist --target=bun ./src/index.ts
bun build ./index.ts --production --outfile=out.js
```


package.json:

```json
    "scripts": {
        "aglint": "aglint --cache --cache-location .aglintcache --cache-strategy content \"**/*.txt\"",
        "markdownlint": "markdownlint .",
        "lint": "npm run aglint && npm run markdownlint"
    },
    "lint-staged": {
        "*.txt": "aglint",
        "*.md": "markdownlint"
    },
```

- https://github.com/AdguardTeam/AdguardFilters/tree/master/.github/workflows
- https://github.com/AdguardTeam/FiltersRegistry/blob/master/scripts/auto_build.sh
- https://github.com/AdguardTeam/AdGuardSDNSFilter
