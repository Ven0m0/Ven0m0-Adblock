# Ven0m0's Filterlists

![Commit activity](https://img.shields.io/github/last-commit/Ven0m0/Ven0m0-Adblock?logo=github)
[![Formatted with Biome](https://img.shields.io/badge/Formatted_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev/)
[![Maintainability](https://qlty.sh/gh/Ven0m0/projects/Ven0m0-Adblock/maintainability.svg)](https://qlty.sh/gh/Ven0m0/projects/Ven0m0-Adblock)

Hand-maintained filter rules, DNS hostlists and userscripts for blocking ads and making the web more pleasant.
Built for uBlock Origin and AdGuard.

## Filter lists

Pick **one** combined list. Each one bundles the individual lists below via `!#include`.

| List | Includes | Subscribe |
| ---- | -------- | --------- |
| [Desktop][combo-desktop] | General, Other, Reddit, Search Engines, YouTube, Twitch | [subscribe][sub-combo-desktop] |
| [Full][combo-full] | General, Other, Reddit, Search Engines, Spotify, Twitter, YouTube | [subscribe][sub-combo-full] |
| [Minimal][combo-minimal] | General, Other, Reddit, Search Engines, Twitter, YouTube | [subscribe][sub-combo-minimal] |
| [Mobile][combo-mobile] | General, Other, Reddit, Search Engines | [subscribe][sub-combo-mobile] |

Individual lists, if you only want part of it:
[General][general] · [Other][other] · [Reddit][reddit] · [Search Engines][search] · [Spotify][spotify] ·
[Twitch][twitch] · [Twitter][twitter] · [YouTube][youtube]

Recommended third-party lists to pair with these, with one-click subscribe links: [lists/README.md](lists/README.md).

## Userscripts

One-click Tampermonkey / Violentmonkey install links: [docs/userscripts.md](docs/userscripts.md).

## Repository layout

| Path | Content |
| ---- | ------- |
| `lists/adblock/` | Filter rules (source of the lists above) |
| `lists/hostlist/` | DNS hostlist rules |
| `userscripts/src/` | Userscript sources |
| `Scripts/` | Build and maintenance tooling (Python, plus one Bun script) |
| `docs/` | Userscript install page, filter notes, backlog (`TODO.md`) |
| `.github/workflows/` | CI: lint, build, dead-domain cleanup, releases |

Contributor and agent instructions: [AGENTS.md](AGENTS.md).

## Development

```bash
mise install && bun install && uv sync
bun run lint     # JS, filter and markdown lint
bun run build    # filter list, hosts file, userscripts
```

## Tools

- [AGLint](https://github.com/AdguardTeam/AGLint)
- [HostlistCompiler](https://github.com/AdguardTeam/HostlistCompiler)
- [DeadDomainsLinter](https://github.com/AdguardTeam/DeadDomainsLinter)

## Credit

- [DandelionSprout/adfilt](https://github.com/DandelionSprout/adfilt)
- [yokoffing/filterlists](https://github.com/yokoffing/filterlists) (basis of `lists/README.md`)

## License

[MIT](LICENSE)

[combo-desktop]: lists/adblock/Combination-desktop.txt
[combo-full]: lists/adblock/Combination.txt
[combo-minimal]: lists/adblock/Combination-Minimal.txt
[combo-mobile]: lists/adblock/Combination-mobile.txt
[sub-combo-desktop]: https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/lists/adblock/Combination-desktop.txt&title=Ven0m0%20Desktop
[sub-combo-full]: https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/lists/adblock/Combination.txt&title=Ven0m0%20Full
[sub-combo-minimal]: https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/lists/adblock/Combination-Minimal.txt&title=Ven0m0%20Minimal
[sub-combo-mobile]: https://subscribe.adblockplus.org/?location=https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/lists/adblock/Combination-mobile.txt&title=Ven0m0%20Mobile
[general]: lists/adblock/General.txt
[other]: lists/adblock/Other.txt
[reddit]: lists/adblock/Reddit.txt
[search]: lists/adblock/Search-Engines.txt
[spotify]: lists/adblock/Spotify.txt
[twitch]: lists/adblock/Twitch.txt
[twitter]: lists/adblock/Twitter.txt
[youtube]: lists/adblock/Youtube.txt
