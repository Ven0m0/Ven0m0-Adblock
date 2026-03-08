# AGENTS.md - AI Agent Quick Reference

**Project:** Ven0m0-Adblock
**Type:** Ad-blocking filter lists + userscripts
**License:** GPL-3.0

## Stack

- **Runtime:** Bun (primary), Node.js LTS (fallback)
- **Tool Manager:** Mise
- **Languages:** AdGuard filter syntax, JavaScript (ES2020), Python 3.13+, Bash
- **Build:** esbuild, terser, AGLint, HostlistCompiler
- **Quality:** ESLint (flat config), Biome, Oxlint, ruff (Python), shellcheck
- **Python Deps:** UV (package manager), prek (git hooks)
- **CI/CD:** GitHub Actions

## Repository Structure

```
package.json                   # NPM scripts, dependencies
mise.toml                      # Tool versions, tasks, env
eslint.config.mjs              # ESLint flat config
biome.json                     # Biome linter/formatter
pyproject.toml                 # Python project config (UV, ruff, prek)
.aglintrc.yml                  # Filter list linting config
esbuild.config.js              # Bundler config
hostlist-config.json           # Hostlist compiler config
lists/conf.json                # Filter list build config
lists/sources-urls.json        # External source URLs

lists/
  adblock/                     # Hand-edited adblock filter rules (EDIT)
    Combination.txt            # Main combined list
    Youtube.txt                # YouTube-specific rules
    Reddit.txt                 # Reddit-specific rules
    Twitter.txt, Twitch.txt, Spotify.txt, etc.
  hostlist/                    # Hand-edited DNS/hostlist rules (EDIT)
    Ads.txt, Native.txt, Spy.txt, etc.
  external/                    # Downloaded external lists (generated)
  releases/                    # Built filter output (generated)

userscripts/
  src/*.user.js                # Source userscripts (EDIT)
  dist/                        # Built userscripts (generated)
  list.txt                     # Userscript download manifest
  todo/                        # Work-in-progress scripts (not built)

Scripts/
  build.sh                     # Main build orchestrator
  lib-common.sh                # Shared shell functions
  hosts-creator.sh             # Hosts file builder
  userscript.sh                # Userscript builder
  update-lists.py              # External list updater
  deduplicate.py               # Rule deduplication
  move-pure-domains.py         # Domain extraction utility
  common.py                    # Shared Python utilities

.github/workflows/
  aglint.yml                   # Filter lint CI
  build-filter-lists.yml       # Daily filter builds
  lint-and-format.yml          # Code quality CI
  userscripts.yml              # Weekly userscript builds
  maintain-lists.yml           # List maintenance
  update-lists.yml             # Dependency updates
  pull_request.yml             # PR checks

Filters/                       # AdGuard compiled output (generated)
```

## Development Workflows

### Setup

```bash
# Install mise (if needed)
curl https://mise.run | sh

# Install all tools + dependencies
mise install && bun install

# Or use mise task
mise run install
```

### Build

```bash
bun run build               # Adblock filter lists
bun run build:adblock       # Adblock lists only
bun run build:hosts         # Hosts/DNS lists only
bun run build:userscripts   # Userscripts only
bun run build:all           # Everything (adblock + hosts + userscripts)
```

**Adblock Build Pipeline:**
1. Read source files from `lists/adblock/*.txt`
2. Run AGLint validation
3. Concatenate + deduplicate
4. Output to `lists/releases/adblock.txt`

**Hostlist Build Pipeline:**
1. Read sources from `lists/hostlist/*.txt`
2. Compile with HostlistCompiler
3. Output to `Filters/`

**Userscript Build Pipeline:**
1. Bundle with esbuild (ES2020, IIFE)
2. Minify with Terser (preserve headers)
3. Output to `userscripts/dist/*.js`

### Test & Lint

```bash
bun run lint                # All linters (JS + filters + markdown)
bun run lint:js             # ESLint only
bun run lint:filters        # AGLint only
bun run lint:md             # Markdown only
bun run lint:yaml           # YAML validation
bun run lint:shell          # Shell script checks
bun run lint:fix            # Auto-fix ESLint + AGLint
bun run lint:fix:all        # Fix + format all
bun run format              # Biome format all
bun run test                # Lint + format check
bun run validate            # Test + build
```

**Linters by type:**
- **JavaScript:** ESLint (flat config), Biome, Oxlint
- **Python:** ruff (via UV)
- **Filters:** AGLint (AdGuard/uBlock syntax)
- **Markdown:** markdownlint-cli2
- **YAML:** yamllint
- **Shell:** shellcheck, shfmt
- **Git hooks:** prek

**Python tests:**
```bash
python3 -m unittest discover Scripts/ 'test_*.py'
```

### Deploy

- **Automated:** CI runs on push to main, daily/weekly schedules
- **Manual:** GitHub Actions workflow dispatch

## Conventions

### Naming

- **Filter Lists:** `PascalCase.txt` or `Kebab-Case.txt` in `lists/adblock/` or `lists/hostlist/`
- **Userscripts:** `name-optimized.user.js` or `name-pro.user.js`
- **Python Scripts:** `kebab-case.py`
- **Shell Scripts:** `kebab-case.sh`

### Code Style

**JavaScript:**
- 2-space indentation
- Double quotes
- Semicolons required
- `const` over `let`, no `var`
- `===` over `==`
- Line width: 100 characters

**Python:**
- `ruff` enforced formatting and linting
- Python 3.13+ features allowed
- `uv` for dependency management

**Shell:**
- Bash strict mode: `set -Eeuo pipefail`
- Quote variables: `"$var"`
- Use `readonly` for constants
- Prefer `[[` over `[` for conditionals

**Filters:**
- AdGuard/uBlock Origin syntax
- One rule per line
- Comments: `! Comment text`
- Group related rules together

### File Operations

**EDIT source files:**
- `lists/adblock/*.txt` — Adblock filter rules
- `lists/hostlist/*.txt` — DNS/hostlist rules
- `userscripts/src/*.user.js` — Userscript sources
- `Scripts/*.sh` / `Scripts/*.py` — Build and utility scripts

**NEVER edit generated files:**
- `lists/releases/` — Rebuilt from adblock sources
- `lists/external/` — Downloaded from upstream
- `userscripts/dist/` — Rebuilt from userscript sources
- `Filters/` — Compiled from hostlist sources

### Commit Messages

Follow Conventional Commits:
- `feat:` New features
- `fix:` Bug fixes
- `ci:` CI/CD changes
- `style:` Formatting/linting
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Testing
- `chore:` Maintenance

Max subject line: 72 characters.

## Dependencies

### Core Tools (Mise-managed)

```toml
node = "latest"
bun = "latest"
uv = "latest"
ruff = "latest"
ghalint = "latest"
actionlint = "latest"
```

### NPM Packages

**AdBlock:**
- `@adguard/aglint` — Filter linter
- `@adguard/dead-domains-linter` — Domain validator
- `@adguard/hostlist-compiler` — Filter compiler

**Build:**
- `esbuild` — Bundler
- `terser` — Minifier

**Quality:**
- `eslint` — JavaScript linter
- `@biomejs/biome` — Fast linter/formatter
- `oxlint` — Fast JS linter
- `markdownlint-cli2` — Markdown linter

### Python Packages (UV-managed)

```toml
dependencies = ["aiohttp", "aiofiles"]
dev = ["prek", "ruff"]
```

## Common Tasks

### Add Adblock Filter Rule

1. **Choose file:** `lists/adblock/Youtube.txt`, `Reddit.txt`, etc.
2. **Add rule:**
   ```
   ! Block example ads
   ||example.com/ads/*
   example.com##.ad-container
   ```
3. **Validate:** `bun run lint:filters`
4. **Build:** `bun run build:adblock`
5. **Commit:** `git commit -m "feat: block new ad element"`

### Add Hostlist/DNS Rule

1. **Choose file:** `lists/hostlist/Ads.txt`, `Native.txt`, etc.
2. **Add domain:** `||example.com^`
3. **Validate:** `bun run lint:filters`
4. **Build:** `bun run build:hosts`

### Create Userscript

1. **Create:** `userscripts/src/my-script.user.js`
2. **Add header:**
   ```javascript
   // ==UserScript==
   // @name         Script Name
   // @version      1.0
   // @description  Description
   // @match        https://example.com/*
   // @grant        none
   // ==/UserScript==
   ```
3. **Build:** `bun run build:userscripts`
4. **Test:** Check `userscripts/dist/my-script.user.js`

### Fix Linting Errors

```bash
# Auto-fix everything
bun run lint:fix:all

# Individual fixes
eslint . --fix          # JavaScript
bunx aglint --fix       # Filters
bun run format          # Biome format
ruff check --fix .      # Python
ruff format .           # Python format
```

### Update Dependencies

```bash
bun update              # NPM packages
uv sync                 # Python packages
mise outdated           # Check mise tools
mise upgrade            # Update mise tools
```

### Clean Build Artifacts

```bash
bun run clean           # Remove built files + node_modules
bun run clean:cache     # Remove caches
bun run clean:all       # Full clean
```

## CI/CD Workflows

### aglint.yml

**Triggers:** Push, PRs
**Purpose:** Fast AdGuard filter lint check

### build-filter-lists.yml

**Triggers:** Push to main, daily 7:00 UTC, manual
**Jobs:**
1. `lint` — AGLint auto-fix
2. `build-adguard` — HostlistCompiler + DeadDomainsLinter
3. `build-ragibkl` — Alternative compilation
4. `build-custom` — Custom build script
5. `commit` — Commit built lists
6. `convert` — Convert for release branch (scheduled only)
7. `cleanup` — Delete old workflow runs

### lint-and-format.yml

**Triggers:** Push, PRs, manual
**Jobs:**
1. `lint` — ESLint, AGLint, Prettier (matrix)
2. `format` — Auto-fix (main only)
3. `yamllint` — YAML validation
4. `shellcheck` — Shell script validation
5. `summary` — Aggregate results

### userscripts.yml

**Triggers:** Push, PRs, weekly Monday 00:00 UTC, manual
**Jobs:** Detect changed scripts → Build with esbuild → Optimize with Terser → Commit

**Manual Options:**
- `force_rebuild` — Rebuild all scripts
- `fetch_updates` — Fetch latest external scripts

## Critical Rules

### Before Making Changes

1. **Read files first** — Never edit code you haven't read
2. **Edit source files only** — Never touch `lists/releases/`, `lists/external/`, `userscripts/dist/`, `Filters/`
3. **Validate syntax** — Run linters before committing
4. **No duplicate rules** — Check for existing rules before adding

### During Development

1. **Lint frequently** — `bun run lint`
2. **Atomic commits** — One logical change per commit
3. **Match code style** — Follow existing patterns
4. **Preserve comments** — Don't remove explanatory comments

### Before Committing

1. **Full validation** — `bun run validate`
2. **Review changes** — `git diff`
3. **Write good messages** — Follow conventional commits

## Quick Reference

### Essential Commands

```bash
# Setup
mise install && bun install

# Build
bun run build               # Adblock lists
bun run build:adblock       # Adblock only
bun run build:hosts         # Hosts/DNS only
bun run build:userscripts   # Userscripts
bun run build:all           # Everything

# Quality
bun run lint                # Check all
bun run lint:fix:all        # Fix all
bun run format              # Format all
bun run validate            # Test + build

# Python
python3 -m unittest discover Scripts/ 'test_*.py'
ruff check . && ruff format --check .

# Clean
bun run clean               # Build artifacts
bun run clean:all           # Everything
```

### Source vs Generated Files

| Type | Source (EDIT) | Generated (NEVER EDIT) |
|------|--------------|------------------------|
| Adblock filters | `lists/adblock/*.txt` | `lists/releases/adblock.txt` |
| Hostlist/DNS | `lists/hostlist/*.txt` | `Filters/` |
| External lists | `lists/sources-urls.json` | `lists/external/` |
| Userscripts | `userscripts/src/*.user.js` | `userscripts/dist/` |

### Key URLs

- **Repo:** https://github.com/Ven0m0/Ven0m0-Adblock
- **Issues:** https://github.com/Ven0m0/Ven0m0-Adblock/issues
- **Main List:** https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/refs/heads/main/lists/adblock/Combination.txt

## AI Assistant Guidelines

### DO

- Edit source files: `lists/adblock/`, `lists/hostlist/`, `userscripts/src/`, `Scripts/`
- Run `bun run lint` after filter changes, `ruff` after Python changes
- Check for duplicate rules before adding new ones
- Match existing code style and comment patterns
- Test builds before committing
- Use feature branches, never commit to main

### DON'T

- Modify generated files: `lists/releases/`, `lists/external/`, `userscripts/dist/`, `Filters/`
- Skip linting or validation
- Make bulk changes without incremental testing
- Remove comments without understanding their purpose
- Commit directly to `main` or `master`
- Create unnecessary documentation files

## External Resources

- [AdGuard Filters Syntax](https://adguard.com/kb/general/ad-filtering/create-own-filters/)
- [AGLint Docs](https://github.com/AdguardTeam/AGLint)
- [Mise Docs](https://mise.jdx.dev/)
- [Bun Docs](https://bun.sh/docs)
- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files)
- [UV Docs](https://docs.astral.sh/uv/)
- [Ruff Docs](https://docs.astral.sh/ruff/)

---

**Last Updated:** 2026-03-08
**For:** AI Agents (Claude, Gemini, Copilot, etc.)
