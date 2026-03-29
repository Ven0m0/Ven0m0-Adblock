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
.pre-commit-config.yaml        # Pre-commit hooks config
esbuild.config.js              # Bundler config
hostlist-config.json           # Hostlist compiler config
lists/conf.json                # Filter list build config
lists/sources-urls.json        # External source URLs
lists/ext.md                   # Notes on potential external sources to add

lists/
  adblock/                     # Hand-edited adblock filter rules (EDIT)
    Combination.txt            # Main combined list
    Combination-Minimal.txt    # Minimal variant
    Combination-desktop.txt    # Desktop variant
    Combination-mobile.txt     # Mobile variant
    Youtube.txt                # YouTube-specific rules
    Reddit.txt                 # Reddit-specific rules
    Twitter.txt                # Twitter/X rules
    Twitch.txt                 # Twitch rules
    Spotify.txt                # Spotify rules
    General.txt                # General ad rules
    Search-Engines.txt         # Search engine rules
    antiadblock.txt            # Anti-adblock bypass rules
    dynamic-rules.txt          # Dynamic/scriptlet rules
    ublock-filters.txt         # uBlock Origin filters
    fanboy-anti-font.txt       # Anti-font tracking rules
    lan-block.txt              # LAN block rules
    exp.txt                    # Experimental rules
    Other.txt                  # Miscellaneous rules
  sources/                     # Cleaned/normalized source mirrors (generated)
  hostlist/                    # Hand-edited DNS/hostlist rules (EDIT)
    Ads.txt                    # Ad servers
    Native.txt                 # Native ad trackers
    spy.txt                    # Spyware/telemetry domains
    windows-telemetry.txt      # Windows telemetry domains
    Social-Media.txt           # Social media trackers
    Smart-TV.txt               # Smart TV trackers
    Games.txt                  # Gaming ad/tracker domains
    adservers-and-trackers.txt # Combined ad servers + trackers
    Regex.txt                  # Regex-based rules
    Lists.txt                  # List aggregation rules
    Experimental.txt           # Experimental DNS rules
    configuration.json         # HostlistCompiler config
    exclusions.txt             # Excluded domains
    extra.txt                  # Extra rules
    hermit.txt                 # Hermit-specific rules
    Spotify.txt                # Spotify DNS rules
    Other.txt                  # Miscellaneous DNS rules
    Test.txt                   # Test rules
  external/                    # Downloaded external lists (generated)
  releases/                    # Built filter output (generated)

userscripts/
  src/                         # Source userscripts (EDIT)
    yt-pro.user.js             # YouTube enhancements
    web-pro.user.js            # General web enhancements
    gh-pro.user.js             # GitHub enhancements
    LLM-pro.user.js            # LLM site enhancements
    google-search-fixer.user.js
    SteamWorkshopImageRepair.user.js
  dist/                        # Built userscripts (generated)
  list.txt                     # Userscript download manifest
  todo/                        # Work-in-progress scripts (not built)

Scripts/
  build.sh                     # Main build orchestrator
  lib-common.sh                # Shared shell functions
  hosts-creator.sh             # Hosts file builder
  userscript.sh                # Userscript builder
  automerge-open-prs.sh        # Auto-merge PR helper
  hosts-config/                # Hosts build configuration files
  update_lists.py              # External list updater
  deduplicate.py               # Rule deduplication
  move_pure_domains.py         # Domain extraction utility
  common.py                    # Shared Python utilities
  __init__.py                  # Python package init
  test_common.py               # Tests for common.py
  test_deduplicate.py          # Tests for deduplicate.py
  test_move_pure_domains.py    # Tests for move_pure_domains.py
  test_update_lists.py         # Tests for update_lists.py
  test_is_pure_domain_logic.py # Tests for domain logic

.github/workflows/
  aglint.yml                   # Filter lint CI
  build-filter-lists.yml       # Daily filter builds
  lint-and-format.yml          # Code quality CI
  userscripts.yml              # Weekly userscript builds
  maintain-lists.yml           # List maintenance
  update-lists.yml             # Dependency updates
  pull_request.yml             # PR checks
  automerge-open-prs.yml       # Auto-merge eligible PRs
  dependabot-auto-merge.yml    # Auto-merge Dependabot PRs

Filters/                       # AdGuard compiled output (generated)
```

## Development Workflows

### Setup

```bash
# Install mise (if needed)
curl https://mise.run | sh

# Install all tools + dependencies
mise install && bun install

# Install Python dependencies
uv sync

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

- **Filter Lists:** `PascalCase.txt` or `kebab-case.txt` in `lists/adblock/` or `lists/hostlist/`
- **Userscripts:** `name-pro.user.js` or `name-optimized.user.js`
- **Python Scripts:** `snake_case.py`
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
- `lists/sources/` — Auto-normalized mirrors of adblock sources
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
prek = "latest"
uv = "latest"
ruff = "latest"
ghalint = "latest"
act = "latest"              # Local GitHub Actions runner
action-validator = "latest"
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
2. **Check for duplicates:** `rg "example.com" lists/adblock/`
3. **Add rule:**
   ```
   ! Block example ads
   ||example.com/ads/*
   example.com##.ad-container
   ```
4. **Validate:** `bun run lint:filters`
5. **Build:** `bun run build:adblock`
6. **Commit:** `git commit -m "feat: block new ad element"`

### Add Hostlist/DNS Rule

1. **Choose file:** `lists/hostlist/Ads.txt`, `Native.txt`, etc.
2. **Check for duplicates:** `rg "example.com" lists/hostlist/`
3. **Add domain:** `||example.com^`
4. **Validate:** `bun run lint:filters`
5. **Build:** `bun run build:hosts`

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

### automerge-open-prs.yml

**Triggers:** Manual, scheduled
**Purpose:** Auto-merge PRs that meet merge criteria

### dependabot-auto-merge.yml

**Triggers:** Dependabot PR events
**Purpose:** Automatically merge Dependabot dependency updates

## Critical Rules

### Before Making Changes

1. **Read files first** — Never edit code you haven't read
2. **Edit source files only** — Never touch `lists/releases/`, `lists/sources/`, `lists/external/`, `userscripts/dist/`, `Filters/`
3. **Validate syntax** — Run linters before committing
4. **No duplicate rules** — Use `rg` to check before adding: `rg "pattern" lists/adblock/`

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
mise install && bun install && uv sync

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

# Search (use rg, not grep)
rg "pattern" lists/adblock/    # Search filter rules
rg "domain.com" lists/         # Search all lists

# Clean
bun run clean               # Build artifacts
bun run clean:all           # Everything
```

### Source vs Generated Files

| Type | Source (EDIT) | Generated (NEVER EDIT) |
|------|--------------|------------------------|
| Adblock filters | `lists/adblock/*.txt` | `lists/releases/`, `lists/sources/` |
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
- Use `rg` to check for duplicate rules before adding
- Match existing code style and comment patterns
- Test builds before committing
- Use feature branches, never commit to main
- Use snake_case for Python scripts (`update_lists.py`, not `update-lists.py`)

### DON'T

- Modify generated files: `lists/releases/`, `lists/sources/`, `lists/external/`, `userscripts/dist/`, `Filters/`
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

**Last Updated:** 2026-03-25
**For:** AI Agents (Claude, Gemini, Copilot, etc.)
