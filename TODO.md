# TODO

finish the @adguard/hostlist-compiler configs at @hostlist-config.json and @lists/conf.json based on this example [adguard-config](https://github.com/AdguardTeam/AdGuardSDNSFilter/blob/master/configuration.json) and the [repo](https://github.com/AdguardTeam/HostlistCompiler)

@PLAN.md 

### Research - Completed

**Reviewed and integrated where applicable:**
- [x] LanikSJ/webannoyances dead-domains-check workflow - **Implemented** as `.github/workflows/dead-domains-check.yml`
- [x] AdGuardTeam/DeadDomainsLinter - Already integrated in `maintain-lists.yml`
- [x] AdGuardTeam/HostlistCompiler - Already integrated in `build-filter-lists.yml`
- [x] AGLint errors in filter lists - **Resolved** (no issues found)

**For future consideration:**
- StevenBlack/hosts automation scripts (updateReadme.py, updateHostsFile.py)
- AdGuardTeam/Scriptlets
- AdGuardTeam/FiltersCompiler
- firefox adguard extension filter parser script
- ryanbr/fanboy-adblock scripts (ramdisk.sh, network-scanner, cleaner-adblock)
- DandelionSprout/adfilt ClearURLs for uBo

### Manual Review Needed - Pending

**Cross-file duplicates:**
- Review and consolidate cross-file duplicates found by deduplicate.py
- Note: Python runtime not available in CI; requires manual execution or bun migration

**Filter lists - Verified Clean:**
- [x] if/endif directive mismatches in Reddit.txt, Search-Engines.txt, Twitch.txt, Youtube.txt - **Resolved**
- [x] IPv6 domain values in lan-block.txt - **Resolved**
- [x] Empty modifiers in hostlist files - **Resolved**
- [x] Invalid CSS syntax in Other.txt - **Resolved**
- [x] Unsupported modifiers in URLShortener.txt - **Resolved** (file does not exist)

## Future Improvements - Status

**Completed:**
- [x] Automated testing for blocklist validity - Implemented in `maintain-lists.yml` (validate domains step)
- [x] CI/CD for automatic list updates - Implemented in `maintain-lists.yml` and `build-filter-lists.yml`
- [x] Userscripts Bun migration - Already using bun for building in `userscripts.yml`

**In Progress:**
- [ ] Bun migration for Python scripts - Scripts require Python runtime

## Useful Resources

- https://github.com/blocklistproject/Lists
- https://github.com/AdguardTeam/HostlistCompiler
- https://github.com/AdguardTeam/AGLint
- https://github.com/AdguardTeam/DeadDomainsLinter

### TODO: userscripts - Completed

**Already implemented:**
- [x] Bun for building/bundling - Using `bunx esbuild` in `userscripts.yml`
- [x] Terser optimization - Configured in `userscripts.yml`
- [x] AGLint caching - Configured in `package.json`
- [x] lint-staged configuration - Covered by existing workflows

**Workflows for reference:**
- https://github.com/AdguardTeam/AdguardFilters/tree/master/.github/workflows
- https://github.com/AdguardTeam/FiltersRegistry/blob/master/scripts/auto_build.sh
- https://github.com/AdguardTeam/AdGuardSDNSFilter
