# AGENTS.md - AI Agent Quick Reference

**Project:** Ven0m0-Adblock
**Type:** Ad-blocking filter lists + userscripts
**License:** GPL-3.0

## Stack

- **Runtime:** Bun (primary), Node.js 18+ (fallback)
- **Tool Manager:** Mise
- **Languages:** AdGuard filter syntax, JavaScript (ES2020)
- **Build:** esbuild, terser, AGLint, HostlistCompiler
- **Quality:** ESLint (flat config), Biome, Oxlint, Prettier
- **CI/CD:** GitHub Actions
- **Git Hooks:** Lefthook

## Repository Structure

```
@package.json                  # NPM scripts, dependencies
@mise.toml                     # Tool versions, tasks
@eslint.config.mjs            # ESLint flat config
@biome.json                   # Biome linter/formatter
@.aglintrc.yml                # Filter list linting
@esbuild.config.js            # Bundler config
@hostlist-config.json         # Filter compilation
@.lefthook.yml                # Git hooks

lists/
  sources/*.txt               # Hand-edited filter rules
  releases/                   # Built filter lists (generated)

userscripts/
  src/Mine/*.user.js          # Source userscripts
  dist/                       # Built userscripts (generated)

Scripts/
  build-lists.sh              # Main filter builder
  build-all.sh                # Master orchestrator
  quality-check.sh            # Quality validation

.github/workflows/
  build-filter-lists.yml      # Daily filter builds
  lint-and-format.yml         # Code quality CI
  userscripts.yml             # Weekly userscript builds
  maintain-lists.yml          # List maintenance
  update-lists.yml            # Dependency updates

Filters/                      # AdGuard compiled (generated)
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
bun run build                 # Filter lists
bun run build:userscripts     # Userscripts only
bun run build:all             # Everything
```

**Filter Build Pipeline:**
1. Concatenate `lists/sources/*.txt`
2. Run AGLint validation
3. Compress with kompressor
4. Output to `lists/releases/adblock.txt`
5. Build hostlist from `hostlist-config.json`

**Userscript Build Pipeline:**
1. Bundle with esbuild (ES2020, IIFE)
2. Minify with Terser (preserve headers)
3. Output to `dist/*.js`

### Test & Lint

```bash
bun run lint                  # All linters
bun run lint:fix              # Auto-fix ESLint + AGLint
bun run lint:fix:all          # Fix + format all
bun run format                # Biome format all
bun run test                  # Lint + format check
bun run validate              # Test + build
```

**Linters:**
- **JavaScript:** ESLint, Biome, Oxlint
- **Filters:** AGLint (uBlock Origin syntax)
- **Markdown:** markdownlint-cli2
- **YAML:** yamllint
- **Shell:** shellcheck, shfmt

### Deploy

- **Automated:** CI runs on push to main, daily schedule
- **Manual:** GitHub Actions workflow dispatch

## Conventions

### Naming

- **Filter Lists:** `PascalCase.txt` or `Kebab-Case.txt`
- **Userscripts:** `kebab-case-optimized.user.js`
- **Scripts:** `kebab-case.sh`

### Code Style

**JavaScript:**
- 2-space indentation
- Double quotes
- Semicolons required
- `const` over `let`, no `var`
- `===` over `==`

**Shell:**
- Bash strict mode: `set -Eeuo pipefail`
- Quote variables: `"$var"`
- Use `readonly` for constants

**Filters:**
- AdGuard/uBlock syntax
- One rule per line
- Comments: `! Comment text`

### File Operations

**EDIT source files:**
- `lists/sources/*.txt` - Filter rules
- `userscripts/src/Mine/*.user.js` - Userscripts
- `Scripts/*.sh` - Build scripts

**NEVER edit generated files:**
- `dist/`, `Filters/`, `lists/releases/`
- These are rebuilt from source

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

## Dependencies

### Core Tools (Mise-managed)

```toml
node = "lts"
bun = "latest"
lefthook = "latest"
```

### NPM Packages

**AdBlock:**
- @adguard/aglint - Filter linter
- @adguard/dead-domains-linter - Domain validator
- @adguard/hostlist-compiler - Filter compiler

**Build:**
- esbuild - Bundler
- terser - Minifier

**Quality:**
- eslint - JavaScript linter
- @biomejs/biome - Fast linter/formatter
- markdownlint-cli2 - Markdown linter

## Common Tasks

### Add Filter Rule

1. **Choose file:** `lists/sources/Youtube.txt`, `Reddit.txt`, etc.
2. **Add rule:**
   ```
   ! Block example ads
   ||example.com/ads/*
   example.com##.ad-container
   ```
3. **Validate:** `bun run lint:aglint`
4. **Build:** `bun run build`
5. **Commit:** `git commit -m "feat: block new ad element"`

### Create Userscript

1. **Create:** `userscripts/src/Mine/script-optimized.user.js`
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
4. **Test:** Check `dist/script-optimized.user.js`

### Fix Linting Errors

```bash
# Auto-fix everything
bun run lint:fix:all

# Individual fixes
eslint . --fix                # JavaScript
bunx aglint --fix             # Filters
bun run format                # Format all
```

### Update Dependencies

```bash
bun update                    # NPM packages
mise outdated                 # Check mise tools
mise upgrade                  # Update mise tools
```

### Clean Build Artifacts

```bash
bun run clean                 # Remove built files
bun run clean:cache           # Remove caches
bun run clean:all             # Nuclear clean
```

## CI/CD Workflows

### build-filter-lists.yml

**Triggers:** Push to main, daily 7:00 UTC, manual
**Jobs:**
1. `lint` - AGLint auto-fix
2. `build-adguard` - HostlistCompiler + DeadDomainsLinter
3. `build-ragibkl` - Alternative compilation
4. `build-custom` - Custom build script
5. `commit` - Commit built lists
6. `convert` - Convert for release branch (scheduled only)
7. `cleanup` - Delete old runs

### lint-and-format.yml

**Triggers:** Push, PRs, manual
**Jobs:**
1. `lint` - ESLint, AGLint, Prettier (matrix)
2. `format` - Auto-fix (main/develop only)
3. `yamllint` - YAML validation
4. `shellcheck` - Shell script validation
5. `summary` - Aggregate results

### userscripts.yml

**Triggers:** Push, PRs, weekly Monday 00:00 UTC, manual
**Jobs:**
1. Detect changed scripts
2. Fetch external scripts (optional)
3. Build with esbuild
4. Optimize with Terser
5. Generate README
6. Commit (skip on PRs)

**Manual Options:**
- `force_rebuild` - Rebuild all
- `fetch_updates` - Fetch latest externals

## Git Hooks (Lefthook)

**Pre-commit:**
- Shell formatting (shfmt, shellcheck, shellharden)
- YAML linting (yamlfmt, yamllint)
- TOML linting (taplo)
- JSON validation (jq/jaq)
- AGLint for filters
- Biome for JavaScript
- Markdown linting
- Security scanning
- Branch protection (blocks main/master)

**Commit-msg:**
- Conventional Commits validation
- Subject length check (max 72)
- WIP/TODO detection

**Pre-push:**
- Automated testing
- Branch naming validation
- Security audits

## Critical Rules

### Before Making Changes

1. **Read files first** - Never edit code you haven't read
2. **Edit source files only** - Never modify `dist/`, `Filters/`, `lists/releases/`
3. **Validate syntax** - Run linters before committing
4. **Test builds** - Ensure builds succeed

### During Development

1. **Run linters frequently** - `bun run lint`
2. **Keep commits atomic** - One logical change per commit
3. **Follow conventions** - Match existing code style
4. **Preserve comments** - Don't remove explanatory comments

### Before Committing

1. **Full validation** - `bun run validate`
2. **Review changes** - `git diff`
3. **Stage selectively** - `git add -p`
4. **Write good messages** - Follow conventional commits

## Quick Reference

### Essential Commands

```bash
# Setup
mise install && bun install

# Build
bun run build                 # Filter lists
bun run build:userscripts     # Userscripts
bun run build:all             # Everything

# Quality
bun run lint                  # Check all
bun run lint:fix:all          # Fix all
bun run format                # Format all
bun run validate              # Test + build

# Clean
bun run clean                 # Build artifacts
bun run clean:all             # Everything
```

### File Paths

| What | Path |
|------|------|
| Filter sources | `lists/sources/*.txt` |
| Userscript sources | `userscripts/src/Mine/*.user.js` |
| Build scripts | `Scripts/*.sh` |
| Built filters | `lists/releases/`, `Filters/` |
| Built userscripts | `dist/` |
| Config | Root `*.json`, `*.yml`, `*.mjs` |

### Key URLs

- **Repo:** https://github.com/Ven0m0/Ven0m0-Adblock
- **Issues:** https://github.com/Ven0m0/Ven0m0-Adblock/issues
- **Main List:** https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/refs/heads/main/Combination.txt

## AI Assistant Guidelines

### DO

✅ Edit source files (`lists/sources/`, `userscripts/src/`)
✅ Run linters after changes
✅ Match existing code style
✅ Check for duplicate rules
✅ Preserve comments
✅ Test builds before committing
✅ Use feature branches
✅ Follow conventional commits

### DON'T

❌ Modify generated files (`dist/`, `Filters/`, `lists/releases/`)
❌ Skip validation
❌ Make bulk changes without testing
❌ Ignore code style
❌ Remove comments without understanding
❌ Commit directly to main
❌ Create unnecessary documentation

## External Resources

- [AdGuard Filters Syntax](https://adguard.com/kb/general/ad-filtering/create-own-filters/)
- [AGLint Docs](https://github.com/AdguardTeam/AGLint)
- [Mise Docs](https://mise.jdx.dev/)
- [Bun Docs](https://bun.sh/docs)
- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files)

---

**Last Updated:** 2026-02-10
**For:** AI Agents (Claude, Gemini, Copilot, etc.)
