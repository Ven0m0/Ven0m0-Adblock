# GitHub Copilot Instructions - Ven0m0-Adblock

## Project Overview

**Ven0m0-Adblock** is an ad-blocking filter list and userscript project.

- **License:** GPL-3.0
- **Stack:** Bun, Mise, JavaScript (ES2020), Python 3.13+, AdGuard filter syntax
- **Build Tools:** esbuild, terser, AGLint, HostlistCompiler
- **Quality:** ESLint (flat config), Biome, Oxlint, ruff, shellcheck

## Critical Rules

### Source vs Generated Files

**EDIT source files only:**

| Type | Path |
|------|------|
| Adblock filter rules | `lists/adblock/*.txt` |
| Hostlist/DNS rules | `lists/hostlist/*.txt` |
| Userscript sources | `userscripts/src/*.user.js` |
| Build/utility scripts | `Scripts/*.sh`, `Scripts/*.py` |

**NEVER modify generated files:**

| Path | Reason |
|------|--------|
| `lists/releases/` | Rebuilt from `lists/adblock/` |
| `lists/external/` | Downloaded from upstream |
| `userscripts/dist/` | Rebuilt from `userscripts/src/` |
| `Filters/` | Compiled from `lists/hostlist/` |

### Code Style

**JavaScript:**
- 2-space indentation, double quotes, semicolons required
- `const` over `let`, never `var`; `===` over `==`
- Line width: 100 characters

**Python:**
- Python 3.13+, managed with UV
- Formatting and linting enforced by ruff

**Shell Scripts:**
- Bash strict mode: `set -Eeuo pipefail`
- Quote all variables: `"$var"`
- Use `readonly` for constants; `[[` over `[`

**Filter Lists (AdGuard/uBlock syntax):**
- One rule per line; `!` for comments
- Group related rules; check for duplicates before adding

**UserScript Headers:**
```javascript
// ==UserScript==
// @name         Script Name
// @version      1.0
// @description  Description
// @match        https://example.com/*
// @grant        none
// ==/UserScript==
```

### Commit Messages

Follow Conventional Commits (max 72 chars):

| Prefix | Use for |
|--------|---------|
| `feat:` | New features |
| `fix:` | Bug fixes |
| `ci:` | CI/CD changes |
| `style:` | Formatting/linting |
| `docs:` | Documentation |
| `refactor:` | Code refactoring |
| `chore:` | Maintenance |

## Build Commands

```bash
bun run build               # Adblock filter lists
bun run build:adblock       # Adblock lists only
bun run build:hosts         # Hosts/DNS lists only
bun run build:userscripts   # Userscripts only
bun run build:all           # Everything
```

## Quality Commands

```bash
bun run lint                # All linters (JS + filters + markdown)
bun run lint:filters        # AGLint filters only
bun run lint:fix:all        # Auto-fix JS + filters + format
bun run format              # Biome format
bun run validate            # lint + build (use before committing)

# Python
ruff check --fix .
ruff format .
python3 -m unittest discover Scripts/ 'test_*.py'
```

## Common Tasks

### Add Filter Rule

```
# Edit: lists/adblock/Youtube.txt (or appropriate file)
! Block example ads
||example.com/ads/*
example.com##.ad-container

# Validate, then build
bun run lint:filters
bun run build:adblock
```

### Add Hostlist/DNS Rule

```
# Edit: lists/hostlist/Ads.txt (or appropriate file)
||trackers.example.com^

bun run lint:filters
bun run build:hosts
```

### Create Userscript

```javascript
// Create: userscripts/src/my-script.user.js
// ==UserScript==
// @name         My Script
// @version      1.0
// @description  Description
// @match        https://example.com/*
// @grant        none
// ==/UserScript==

// ... script code here

// Then build:
// bun run build:userscripts -> output: userscripts/dist/my-script.user.js
```

## Setup

```bash
mise install && bun install   # Install all tools and dependencies
uv sync                        # Install Python dependencies
```

## Repository Structure

```
lists/adblock/     # Adblock filter sources (EDIT)
lists/hostlist/    # DNS/hostlist sources (EDIT)
lists/releases/    # Built adblock filters (GENERATED)
lists/external/    # Downloaded external lists (GENERATED)

userscripts/src/   # Userscript sources (EDIT)
userscripts/dist/  # Built userscripts (GENERATED)

Scripts/           # Build and utility scripts (EDIT)
Filters/           # Compiled hostlist output (GENERATED)
```

## Linters

- **JavaScript:** ESLint (flat config), Biome, Oxlint
- **Python:** ruff
- **Filters:** AGLint (uBlock Origin / AdGuard syntax)
- **Markdown:** markdownlint-cli2
- **YAML:** yamllint
- **Shell:** shellcheck, shfmt
- **Git hooks:** prek

## CI/CD

- `aglint.yml` — Filter lint on push/PR
- `build-filter-lists.yml` — Daily filter builds
- `lint-and-format.yml` — Code quality on push/PR
- `userscripts.yml` — Weekly userscript builds
- All workflows use Mise for tool management

## Best Practices

**DO:**
- Read files before proposing changes
- Run `bun run lint` after filter edits
- Check for duplicate rules before adding
- Use feature branches (never commit to `main`)
- Follow conventional commit messages
- Run `bun run validate` before committing

**DON'T:**
- Edit generated directories (`lists/releases/`, `lists/external/`, `userscripts/dist/`, `Filters/`)
- Skip validation or linting
- Remove comments without understanding their purpose
- Add error handling for scenarios that can't happen
- Over-engineer or add unnecessary abstractions

## References

- [AdGuard Filter Syntax](https://adguard.com/kb/general/ad-filtering/create-own-filters/)
- [AGLint Docs](https://github.com/AdguardTeam/AGLint)
- [Bun Docs](https://bun.sh/docs)
- [UV Docs](https://docs.astral.sh/uv/)
- [Mise Docs](https://mise.jdx.dev/)

**See also:** `AGENTS.md` (full reference), `README.md`
