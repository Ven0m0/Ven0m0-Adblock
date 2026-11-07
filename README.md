# Ven0m0's Filterlists

![Commit activity](https://img.shields.io/github/last-commit/Ven0m0/Ven0m0-Adblock?logo=github)
[![Formatted with Biome](https://img.shields.io/badge/Formatted_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev/)
[![Maintainability](https://qlty.sh/gh/Ven0m0/projects/Ven0m0-Adblock/maintainability.svg)](https://qlty.sh/gh/Ven0m0/projects/Ven0m0-Adblock)

Hand-maintained filter rules, DNS hostlists and userscripts for blocking ads and making the web more pleasant.
Built for uBlock Origin and AdGuard.

## Filter lists

One-click subscribe links for the combined and individual lists, plus the Android apps hostlist: [docs/filterlists.md](docs/filterlists.md).

Recommended third-party lists to pair with these, with one-click subscribe links:
[docs/filterlists.md](docs/filterlists.md#recommended-third-party-lists).

Search every rule in these lists: [ven0m0.github.io/Ven0m0-Adblock](https://ven0m0.github.io/Ven0m0-Adblock/).

The built lists in `lists/releases/` are indexed in
[`metadata.json`](https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/main/lists/releases/metadata.json)
(rule count, size, SHA-256 and version per file).

## Userscripts

One-click Tampermonkey / Violentmonkey install links: [docs/userscripts.md](docs/userscripts.md).

## Repository layout

| Path                 | Content                                                     |
| -------------------- | ----------------------------------------------------------- |
| `lists/adblock/`     | Filter rules (source of the lists above)                    |
| `lists/hostlist/`    | DNS hostlist rules                                          |
| `userscripts/src/`   | Userscript sources                                          |
| `Scripts/`           | Build and maintenance tooling (Python, plus one Bun script) |
| `site/`              | Static rule search page, deployed to GitHub Pages           |
| `docs/`              | Install pages for filter lists and userscripts              |
| `.github/workflows/` | CI: lint, build, dead-domain cleanup, releases              |

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
- [yokoffing/filterlists](https://github.com/yokoffing/filterlists) (basis of the recommended third-party lists in `docs/filterlists.md`)

## License

[MIT](LICENSE)
