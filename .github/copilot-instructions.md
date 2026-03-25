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
| `lists/sources/` | Auto-normalized mirrors of adblock sources |
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
- Script names use `snake_case.py` (e.g. `update_lists.py`, `move_pure_domains.py`)

**Shell Scripts:**
- Bash strict mode: `set -Eeuo pipefail`
- Quote all variables: `"$var"`
- Use `readonly` for constants; `[[` over `[`

**Filter Lists (AdGuard/uBlock syntax):**
- One rule per line; `!` for comments
- Group related rules; check for duplicates with `rg` before adding

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
# Check for duplicates first
rg "example.com" lists/adblock/

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
# Check for duplicates first
rg "example.com" lists/hostlist/

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
uv sync                       # Install Python dependencies
```

## Repository Structure

```
lists/adblock/     # Adblock filter sources (EDIT)
lists/hostlist/    # DNS/hostlist sources (EDIT)
lists/releases/    # Built adblock filters (GENERATED)
lists/sources/     # Normalized source mirrors (GENERATED)
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

## CI/CD Workflows

- `aglint.yml` — Filter lint on push/PR
- `build-filter-lists.yml` — Daily filter builds (push to main + 7:00 UTC)
- `lint-and-format.yml` — Code quality on push/PR
- `userscripts.yml` — Weekly userscript builds (Monday 00:00 UTC)
- `automerge-open-prs.yml` — Auto-merge eligible PRs
- `dependabot-auto-merge.yml` — Auto-merge Dependabot updates
- All workflows use Mise for tool management

## Best Practices

**DO:**
- Read files before proposing changes
- Use `rg` to check for duplicate rules before adding
- Run `bun run lint` after filter edits
- Use feature branches (never commit to `main`)
- Follow conventional commit messages
- Run `bun run validate` before committing

**DON'T:**
- Edit generated directories (`lists/releases/`, `lists/sources/`, `lists/external/`, `userscripts/dist/`, `Filters/`)
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
