# GitHub Copilot Instructions - Ven0m0-Adblock

## Project Overview

**Ven0m0-Adblock** is an ad-blocking filter list and userscript project.

- **License:** GPL-3.0
- **Stack:** Bun, Mise, JavaScript (ES2020), AdGuard filter syntax
- **Build Tools:** esbuild, terser, AGLint, HostlistCompiler
- **Quality:** ESLint (flat config), Biome, Oxlint, Prettier, shellcheck

## Critical Rules

### File Operations

**ALWAYS edit source files:**
- `lists/sources/*.txt` - Hand-edited filter rules
- `userscripts/src/Mine/*.user.js` - Source userscripts
- `Scripts/*.sh` - Build scripts

**NEVER modify generated files:**
- `dist/` - Built userscripts (regenerated)
- `Filters/` - Compiled filters (regenerated)
- `lists/releases/` - Built filter lists (regenerated)

### Before Making Changes

1. **Read files first** - Never propose changes to code you haven't read
2. **Validate syntax** - Run appropriate linters before committing
3. **Test builds** - Ensure builds succeed locally
4. **Follow conventions** - Match existing code patterns

### Code Style

**JavaScript/TypeScript:**
- 2-space indentation
- Double quotes for strings
- Semicolons required
- Use `const` over `let`, never `var`
- Use `===` over `==`
- No trailing commas
- Line width: 100 characters

**Shell Scripts:**
- Bash strict mode: `set -Eeuo pipefail`
- Quote all variables: `"$var"`
- Use `readonly` for constants
- Prefer `[[` over `[` for conditionals

**Filter Lists (AdGuard/uBlock syntax):**
- One rule per line
- Use `!` for comments
- Group related rules together
- Follow uBlock Origin syntax

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

### Commit Message Convention

Follow Conventional Commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `ci:` - CI/CD changes
- `style:` - Formatting/linting
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Testing
- `chore:` - Maintenance

## Common Tasks

### Add Filter Rule

```bash
# 1. Edit appropriate source file
# lists/sources/Youtube.txt, Reddit.txt, etc.

# 2. Add rule following AdGuard syntax
! Block example ads
||example.com/ads/*
example.com##.ad-container

# 3. Validate
bun run lint:aglint

# 4. Build
bun run build

# 5. Commit
git commit -m "feat: block new ad element"
```

### Create Userscript

```bash
# 1. Create in userscripts/src/Mine/
touch userscripts/src/Mine/script-optimized.user.js

# 2. Add proper header + code
# (Include ==UserScript== metadata block)

# 3. Build
bun run build:userscripts

# 4. Test output in dist/
```

### Fix Linting Errors

```bash
# Auto-fix everything
bun run lint:fix:all

# Individual fixes
eslint . --fix                # JavaScript
bunx aglint --fix             # Filters
bun run format                # Format all
```

### Build Commands

```bash
bun run build                 # Filter lists only
bun run build:userscripts     # Userscripts only
bun run build:all             # Everything
bun run validate              # Test + build
```

## Essential Commands Reference

```bash
# Setup
mise install && bun install

# Quality Checks
bun run lint                  # All linters
bun run lint:fix              # Auto-fix ESLint + AGLint
bun run format                # Biome format
bun run test                  # Lint + format check

# Clean
bun run clean                 # Remove build artifacts
bun run clean:all             # Nuclear clean
```

## File Structure

```
lists/sources/*.txt           # Source filter rules (EDIT)
userscripts/src/Mine/*.user.js # Source userscripts (EDIT)
Scripts/*.sh                  # Build scripts (EDIT)

lists/releases/               # Built filters (GENERATED)
dist/                         # Built userscripts (GENERATED)
Filters/                      # Compiled filters (GENERATED)
```

## Configuration Files

- `@package.json` - NPM scripts, dependencies
- `@mise.toml` - Tool versions, tasks
- `@eslint.config.mjs` - ESLint flat config
- `@biome.json` - Biome linter/formatter
- `@.aglintrc.yml` - Filter list linting
- `@esbuild.config.js` - Bundler config
- `@hostlist-config.json` - Filter compilation
- `@.lefthook.yml` - Git hooks

## Development Workflow

1. **Setup:** `mise install && bun install`
2. **Make changes:** Edit source files only
3. **Validate:** `bun run lint`
4. **Build:** `bun run build`
5. **Test:** `bun run validate`
6. **Commit:** Follow conventional commits
7. **Push:** CI will run automated checks

## CI/CD Integration

- **build-filter-lists.yml** - Runs daily, builds filters
- **lint-and-format.yml** - Runs on push/PR
- **userscripts.yml** - Weekly builds, manual triggers
- All workflows use Mise for tool management
- Automated commits by `github-actions[bot]`

## Best Practices

### DO ✅

- Edit source files in `lists/sources/`, `userscripts/src/`
- Run linters after every change
- Match existing code style and patterns
- Check for duplicate filter rules before adding
- Preserve explanatory comments
- Test builds before committing
- Use feature branches (not main)
- Follow conventional commit messages

### DON'T ❌

- Modify generated files in `dist/`, `Filters/`, `lists/releases/`
- Skip validation or linting steps
- Make bulk changes without testing
- Ignore existing code style
- Remove comments without understanding context
- Commit directly to main branch
- Create unnecessary documentation files

## Linters & Tools

- **JavaScript:** ESLint (flat config), Biome, Oxlint
- **Filters:** AGLint (uBlock Origin syntax)
- **Markdown:** markdownlint-cli2
- **YAML:** yamllint
- **Shell:** shellcheck, shfmt
- **Git Hooks:** Lefthook (pre-commit, commit-msg, pre-push)

## Dependencies

**Runtimes:** Bun (latest), Node.js (LTS)
**Build:** esbuild, terser
**AdBlock:** @adguard/aglint, @adguard/hostlist-compiler, @adguard/dead-domains-linter
**Quality:** eslint, @biomejs/biome, markdownlint-cli2

## External Resources

- [AdGuard Filters Syntax](https://adguard.com/kb/general/ad-filtering/create-own-filters/)
- [AGLint Documentation](https://github.com/AdguardTeam/AGLint)
- [Mise Documentation](https://mise.jdx.dev/)
- [Bun Documentation](https://bun.sh/docs)
- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files)

## Quick Tips

1. **Filter syntax:** Use AGLint-recommended patterns
2. **Userscripts:** Always include proper metadata headers
3. **Testing:** Run `bun run validate` before committing
4. **Debugging:** Check `bun run lint` output for issues
5. **Performance:** Prefer Biome for fast formatting
6. **Security:** Never commit sensitive data or credentials

---

**For more details, see:** `CLAUDE.md`, `AGENTS.md`, or `README.md`
