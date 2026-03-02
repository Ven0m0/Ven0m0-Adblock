# TODO

### Research

**Look into these and integrate them:**

- https://github.com/StevenBlack/hosts/blob/master/updateReadme.py
- https://github.com/StevenBlack/hosts/blob/master/updateHostsFile.py
- https://github.com/AdguardTeam/Scriptlets
- https://github.com/LanikSJ/webannoyances/blob/master/.github/workflows/dead-domains-check.yml
- add script on schedule that parses specific lists from [firefox adguard extension filter](https://github.com/AdguardTeam/FiltersrsRegistry/blob/master/platforms/extension/firefox/filters.json), [ublock filter](https://github.com/AdguardTeam/FiltersRegistry/blob/master/platforms/extension/ublock/filters.json) and pretty prints them in a markdown table md file. only adguard-german, no need for parsing all other language filters.
- https://github.com/ryanbr/fanboy-adblock/blob/master/scripts/ramdisk.sh
- https://github.com/ryanbr/network-scanner
- https://github.com/ryanbr/cleaner-adblock
- https://github.com/DandelionSprout/adfilt/tree/master/ClearURLs%20for%20uBo

Fully implememt:

- https://github.com/AdguardTeam/HostlistCompiler
- https://github.com/AdguardTeam/DeadDomainsLinter
- https://github.com/AdguardTeam/FiltersCompiler

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
