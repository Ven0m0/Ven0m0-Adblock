# CLAUDE.md - AI Assistant Guide

This document provides a comprehensive guide for AI assistants working with the Ven0m0-Adblock repository. It covers the codebase structure, development workflows, conventions, and best practices.

## Table of Contents

- [Repository Overview](#repository-overview)
- [Codebase Structure](#codebase-structure)
- [Development Environment](#development-environment)
- [Build System](#build-system)
- [CI/CD Workflows](#cicd-workflows)
- [Code Quality & Linting](#code-quality--linting)
- [Testing & Validation](#testing--validation)
- [Git Workflow](#git-workflow)
- [Key Conventions](#key-conventions)
- [Common Tasks](#common-tasks)
- [Important Files](#important-files)
- [Troubleshooting](#troubleshooting)

---

## Repository Overview

**Repository:** Ven0m0/Ven0m0-Adblock
**License:** GPL-3.0
**Purpose:** Comprehensive ad-blocking and web experience enhancement project with filter lists and userscripts

### Main Components

1. **Filter Lists** - AdGuard-compatible ad-blocking rules in `lists/sources/`
2. **Userscripts** - Browser userscripts for web enhancement in `userscripts/src/`
3. **Build Scripts** - Automation tools in `Scripts/`
4. **Configuration** - Linting and build configs in root directory

### Key Deliverables

- **Combined Filter Lists:**
  - `lists/releases/adblock.txt` - Main combined list
  - `Filters/Venom-Combined.txt` - AdGuard compiled version
  - `Filters/Ragibkl-Combined.txt` - Alternative compilation
- **Individual Lists:**
  - Youtube, Reddit, Spotify, Twitter, Twitch, Search Engines, etc.
- **Optimized Userscripts:**
  - Built and minified in `dist/` directory

---

## Codebase Structure

```
Ven0m0-Adblock/
├── .github/
│   └── workflows/              # GitHub Actions CI/CD pipelines
│       ├── build-filter-lists.yml
│       ├── lint-and-format.yml
│       └── userscripts.yml
├── lists/
│   ├── sources/                # Source filter lists (.txt files)
│   │   ├── Youtube.txt
│   │   ├── Reddit.txt
│   │   ├── Twitter.txt
│   │   ├── Twitch.txt
│   │   ├── Spotify.txt
│   │   ├── General.txt
│   │   ├── Search-Engines.txt
│   │   ├── URLShortener.txt
│   │   ├── Combination.txt
│   │   └── Combination-Minimal.txt
│   └── releases/               # Built/compiled filter lists
├── userscripts/
│   ├── src/                   # Source userscripts (.user.js or .user.ts)
│   │   ├── yt-pro.user.js     # YouTube optimizer
│   │   ├── web-pro.user.js    # Web global enhancements
│   │   ├── gh-pro.user.js     # GitHub enhancements
│   │   ├── LLM-pro.user.js    # LLM optimizer
│   │   └── Amazon-Page-Smoother.user.js
│   ├── dist/                  # Built userscripts (generated)
│   ├── build.ts               # TypeScript build script
│   ├── README.md              # Userscripts documentation
│   └── list.txt               # External scripts to download
├── Scripts/                   # Build and utility scripts
│   ├── build-all.sh          # Master build orchestrator
│   ├── aglint.sh             # AGLint wrapper
│   ├── hostlist-build.sh     # Hostlist compilation
│   ├── kompressor.sh         # Compression utility
│   ├── lib-common.sh         # Shared functions
│   ├── setup.sh              # Environment setup
│   └── hosts-creator/        # Hosts file generator
├── Filters/                   # Compiled AdGuard filters (generated)
├── dist/                      # Built userscripts (generated)
├── hostlist-config.json      # Hostlist compiler configuration
├── mise.toml                 # Mise tool version manager config
├── package.json              # NPM/Bun package configuration
├── tsconfig.json             # TypeScript configuration
├── eslint.config.mjs         # ESLint configuration (flat config)
├── .prettierrc.json          # Prettier code formatter config
├── .aglintrc.yml             # AGLint filter list linter config
├── .markdownlint-cli2.jsonc  # Markdownlint-cli2 config
├── .yamllint.yml             # YAML linter config
├── .lefthook.yml             # Lefthook git hooks config
├── biome.json                # Biome linter/formatter config
├── .oxlintrc.json            # Oxlint configuration
├── .editorconfig             # Editor configuration
├── esbuild.config.js         # ESBuild bundler config (legacy)
├── README.md                 # Project documentation
├── SECURITY.md               # Security policy
└── LICENSE                   # GPL-3.0 license

Generated Directories (gitignored):
├── node_modules/             # NPM dependencies
├── .eslintcache              # ESLint cache
└── coverage/                 # Test coverage reports
```

### Directory Purposes

- **lists/sources/** - Hand-maintained filter rules (human-edited)
- **lists/releases/** - Compiled, optimized, production-ready lists
- **Filters/** - AdGuard-specific compiled outputs
- **userscripts/src/** - Source userscripts (human-edited)
- **dist/** - Minified, optimized userscripts for production
- **Scripts/** - Build automation and tooling

---

## Development Environment

### Package Manager

**Primary:** [Bun](https://bun.sh/) (>=1.0.0)
**Alternative:** Node.js (>=18.0.0)

The project uses Bun as the primary package manager (configured in `package.json` via `packageManager: "bun@1.0.0"`).

### Tool Version Manager

**[Mise](https://mise.jdx.dev/)** - Manages all development tools and runtimes

Configuration in `mise.toml`:

```toml
[tools]
node = "lts"
bun = "latest"
python = "3.13"
# Plus various npm packages and system tools
```

### Environment Setup

```bash
# Install mise (if not installed)
curl https://mise.run | sh

# Install all tools and dependencies
mise install && bun install

# Or use the mise task
mise run install
```

### Core Tools

#### Runtimes

- **Node.js** (LTS) - JavaScript runtime
- **Bun** (latest) - Fast JS runtime and package manager
- **Python** (3.13) - For Python-based tools
- **TypeScript** (^5.7.2) - TypeScript compiler for type-safe development

#### AdBlock Tooling

- **@adguard/aglint** - Filter list linter and fixer
- **@adguard/dead-domains-linter** - Removes dead/expired domains
- **@adguard/hostlist-compiler** - Compiles filter lists into various formats

#### Linting & Formatting

- **ESLint** - JavaScript linter (flat config format)
- **Biome** - Fast Rust-based JavaScript/TypeScript linter and formatter
- **Oxlint** - Rust-based fast linter for JavaScript/TypeScript
- **Prettier** - Code formatter (JS, JSON, YAML, Markdown)
- **markdownlint-cli2** - Markdown linter
- **yamllint** - YAML linter
- **shellcheck** - Shell script linter
- **shfmt** - Shell script formatter
- **Lefthook** - Fast git hooks manager

#### Build Tools

- **esbuild** - Fast JavaScript/TypeScript bundler
- **terser** - JavaScript minifier
- **minify** - General minification tool
- **yargs** - Command-line argument parser (for build scripts)
- **glob** - File pattern matching utility

#### Utilities

- **fd** - Fast file finder
- **ripgrep** - Fast grep alternative
- **sd** - Find and replace tool

---

## Build System

### Build Scripts

#### Primary Build Script: `Scripts/build-lists.sh`

Located in `Scripts/`, this is the main entry point for building filter lists.

**Process:**
1. Ensures required tools are installed (aglint, hostlist-compiler, kompressor)
2. Concatenates all source lists from `lists/sources/*.txt`
3. Runs AGLint validation (non-blocking)
4. Compresses output with kompressor
5. Outputs to `lists/releases/adblock.txt`
6. Builds hostlist using `hostlist-config.json`

**Usage:**
```bash
./Scripts/build-lists.sh
# Or via npm/bun script:
bun run build
```

#### Master Build Script: `Scripts/build-all.sh`

Orchestrates building multiple components.

**Usage:**
```bash
./Scripts/build-all.sh [adblock] [hosts] [userscripts]
./Scripts/build-all.sh all  # Build everything
```

**Individual builds:**
```bash
bun run build:adblock      # Filter lists only
bun run build:hosts        # Hosts file only
bun run build:userscripts  # Userscripts only
bun run build:all          # Everything
```

### Userscript Build Process

The repository supports **two build systems** for userscripts:

#### Modern TypeScript Build System (Recommended)

**File:** `userscripts/build.ts`

**Features:**
- Full TypeScript support for `.user.ts` files
- JavaScript support for `.user.js` files
- Development mode with watch and hot reload
- Automatic metadata URL updates
- Inline source maps in dev mode
- Modern ES2023 compilation with Bun

**Commands:**
```bash
# Development mode with watch (recommended)
bun run dev:userscripts

# Production build (minified)
bun run build:userscripts:new

# Development build (no watch)
bun run build:userscripts:dev
```

**Pipeline:**
1. Scan `userscripts/src/` for `*.user.js` and `*.user.ts` files
2. Extract userscript metadata headers
3. Compile TypeScript (if needed) with Bun.build
4. Bundle imports and dependencies
5. Minify in production mode
6. Update `@updateURL` and `@downloadURL` in metadata
7. Generate two files per script:
   - `{name}.user.js` - Full userscript (header + code)
   - `{name}.meta.js` - Metadata only (for update checks)
8. Output to `userscripts/dist/`

**Key Settings:**
- Target: ES2023 (modern browsers)
- Format: IIFE (Immediately Invoked Function Expression)
- Tree Shaking: Enabled
- Minification: Production only
- Source Maps: Inline in dev, none in production

#### Legacy Bash Build System

**File:** `Scripts/build-all.sh userscripts`

**Command:**
```bash
bun run build:userscripts
```

**Pipeline:**
1. Download external scripts from `userscripts/list.txt`
2. Run ESLint with auto-fix
3. Extract metadata headers
4. Minify with esbuild (ES2022, IIFE)
5. Update metadata URLs
6. Generate `.user.js` and `.meta.js` files
7. Parallel processing with GNU `parallel`

**When to use:**
- CI/CD workflows (already configured)
- Batch processing of external scripts
- Backward compatibility

**Key Settings:**
- Target: ES2022
- Format: IIFE
- Comments preserved: UserScript headers, licenses
- Minification: Always enabled

### HostlistCompiler Configuration

File: `hostlist-config.json`

Defines:
- Source files to include
- Output path (`lists/releases/hosts.txt`)
- Transformations: RemoveComments, Validate, Deduplicate, Sort, Compress

---

## CI/CD Workflows

All workflows use GitHub Actions and are located in `.github/workflows/`.

### 1. Build Filter Lists (build-filter-lists.yml)

**Triggers:**
- Push to main (when filter sources change)
- Schedule: Daily at 7:00 AM UTC
- Manual dispatch

**Jobs:**

1. **lint** - Runs AGLint with auto-fix, commits fixes
2. **build-adguard** - Compiles with HostlistCompiler, cleans with DeadDomainsLinter
3. **build-ragibkl** - Alternative compilation (if ragibkl-config.json exists)
4. **build-custom** - Runs custom build-lists.sh script
5. **commit** - Downloads artifacts, commits built lists to main
6. **convert** - (Scheduled only) Converts lists, pushes to release branch
7. **cleanup** - Deletes old workflow runs (7+ days)

**Important:**
- All jobs run in parallel except commit (needs builds)
- Uses mise for tool management
- Commits as `github-actions[bot]`

### 2. Lint & Format (lint-and-format.yml)

**Triggers:**
- Push to main
- Pull requests to main
- Manual dispatch

**Jobs:**

1. **lint** (matrix strategy):
   - ESLint for JavaScript files
   - AGLint for filter lists
   - Prettier format checking
   - Only runs if relevant files changed

2. **format** - Auto-fixes and commits (main/develop only, not PRs)
3. **yamllint** - Lints workflow YAML files
4. **shellcheck** - Lints and formats shell scripts
5. **summary** - Aggregates results

**Note:** Auto-fix only runs on main/develop branches, not PRs.

### 3. Build Userscripts (userscripts.yml)

**Triggers:**
- Push to main (when userscripts change)
- PRs affecting userscripts
- Weekly schedule (Monday 00:00 UTC)
- Manual dispatch (with force rebuild option)

**Process:**
1. Detects changed scripts
2. Optionally fetches external scripts from `List` file
3. Builds with esbuild
4. Optimizes with Terser
5. Generates README
6. Commits built scripts (skips on PRs)
7. Uploads artifacts

**Manual Options:**
- `force_rebuild` - Rebuild all scripts regardless of changes
- `fetch_updates` - Fetch latest versions of external scripts

---

## Code Quality & Linting

### Filter List Linting (AGLint)

**Config:** `.aglintrc.yml`

- Syntax: Common (AdGuard syntax)
- Extends: `aglint:recommended`
- Special handling for excluded patterns (no-excluded-rules)

**Commands:**
```bash
bun run lint:aglint       # Check only
bunx aglint --fix         # Auto-fix
bun run lint:filters      # Same as lint:aglint
```

**Integration:** Runs in CI on every commit, auto-fixes and commits changes.

### JavaScript Linting (ESLint)

**Config:** `eslint.config.mjs` (flat config format)

**Rules:**
- No unused variables (except prefixed with `_`)
- Enforce `===` over `==`
- No `eval()` or implied eval
- Prefer `const` over `let`, warn on `var`
- Semicolons required
- Double quotes (with escape allowance)
- 2-space indentation
- No trailing commas

**File-specific:**
- `*.user.js` - Script sourceType, Greasemonkey globals
- `Scripts/*.sh`, `*.config.js` - Node globals, console allowed

**Commands:**
```bash
bun run lint:js           # Check only
bun run lint:eslint       # Same as lint:js
eslint . --fix            # Auto-fix
bun run lint:fix          # Fix ESLint + AGLint
```

### Code Formatting (Prettier)

**Config:** `.prettierrc.json`

**Settings:**
- 2-space indentation
- Double quotes
- Semicolons required
- Trailing commas: none
- Print width: 100

**Commands:**
```bash
bun run format            # Format all files
bun run format:check      # Check only (CI mode)
bun run format:js         # JavaScript only
bun run format:json       # JSON only
bun run format:yaml       # YAML only
bun run format:md         # Markdown only
```

### Biome (Fast Linter & Formatter)

**Config:** `biome.json`

Biome is a fast, Rust-based toolchain for JavaScript/TypeScript that combines linting and formatting. It provides excellent performance and is configured to work alongside ESLint and Prettier.

**Commands:**
```bash
biome check --write .            # Lint and format with auto-fix
biome check .                    # Check only
biome format --write .           # Format only
```

**Integration:** Runs in Lefthook pre-commit hooks for staged files.

### Oxlint (Fast JavaScript Linter)

**Config:** `.oxlintrc.json`

Oxlint is a high-performance Rust-based linter for JavaScript and TypeScript, offering faster linting than traditional tools.

**Commands:**
```bash
oxlint .                         # Lint all files
mise exec -- oxlint .            # Lint via mise
```

**Integration:** Can be integrated into quality checks for additional validation.

### Markdown Linting

**Config:** `.markdownlint-cli2.jsonc`

**Command:**
```bash
bun run lint:md
bunx markdownlint-cli2 --fix     # Auto-fix
```

### YAML Linting

**Config:** `.yamllint.yml`

**Command:**
```bash
bun run lint:yaml
```

### Shell Script Linting

**Tools:** shellcheck, shfmt

**Commands:**
```bash
bun run lint:shell        # ShellCheck only (continue on error)
mise exec -- shellcheck Scripts/*.sh
mise exec -- shfmt -d -i 2 -ci Scripts/*.sh
```

### Comprehensive Linting

```bash
bun run lint              # All linters
bun run lint:fix:all      # Auto-fix all + format
bun run test              # Lint + format check
bun run test:ci           # Same as test
bun run validate          # Test + build
```

---

## Testing & Validation

### Pre-commit Testing

The project uses **Lefthook** for git hooks management.

**Config:** `.lefthook.yml`

**Pre-commit hooks include:**
- Shell script formatting (shfmt, shellcheck, shellharden)
- YAML linting (yamlfmt, yamllint)
- TOML linting (taplo)
- JSON validation (jq/jaq)
- AGLint for filter lists
- Biome for JavaScript/TypeScript
- Markdown linting
- File normalization (whitespace, encoding)
- Security scanning (secrets detection, merge conflicts)
- GitHub Actions linting (actionlint)
- Branch protection (blocks direct commits to main/master)

**Commit message hooks:**
- Conventional Commits validation
- Subject length check (max 72 chars)
- WIP/TODO detection

**Pre-push hooks:**
- Automated testing
- Branch naming validation (git-flow patterns)
- Security audits

**Installation:**
```bash
lefthook install               # Install git hooks
lefthook run pre-commit        # Run pre-commit hooks manually
```

### Manual Validation

```bash
# Full validation (lint + format + build)
bun run validate

# Just testing (no build)
bun run test

# CI mode (no fixes, just check)
bun run test:ci
```

### What Gets Validated

1. **JavaScript** - ESLint rules compliance
2. **Filter Lists** - AGLint validation (AdGuard syntax)
3. **Code Formatting** - Prettier formatting consistency
4. **Markdown** - Markdownlint rules
5. **YAML** - YAML syntax and style
6. **Shell Scripts** - ShellCheck static analysis
7. **Build Success** - All build scripts execute without errors

---

## Git Workflow

### Branch Strategy

**Main Branch:** `main` - Production-ready code
**Release Branch:** `release` - Converted filter lists (auto-created)
**Feature Branches:** `claude/*` or descriptive names

### Commit Conventions

The project follows conventional commit messages:

- `ci:` - CI/CD changes
- `style:` - Code formatting, linting fixes
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions/changes
- `chore:` - Maintenance tasks

**Examples:**
```
ci: build and update filter lists
style: auto-format code and fix linting issues
feat: add new YouTube ad-blocking rules
fix: resolve AGLint validation errors
```

### Automated Commits

**Bot Commits:** `github-actions[bot]`
Email: `41898282+github-actions[bot]@users.noreply.github.com`

These are created by CI workflows for:
- Lint fixes
- Built filter lists
- Compiled userscripts
- Converted lists on release branch

### Git Ignore

**Ignored directories:**
- `node_modules/` - Dependencies
- `dist/` - Built files
- `lists/releases/` - Generated lists (actually committed in some workflows)
- `userscripts/dist/` - Generated userscripts
- `*.min.js` - Minified files
- `coverage/` - Test coverage
- `.eslintcache` - Linter cache

---

## Key Conventions

### File Naming

**Filter Lists:**
- PascalCase or descriptive names: `Youtube.txt`, `Search-Engines.txt`
- Stored in `lists/sources/`
- Use `.txt` extension

**Userscripts:**
- kebab-case with `.user.js` or `.user.ts` extension
- JavaScript: `youtube-pro.user.js`
- TypeScript: `youtube-pro.user.ts`
- Must have `.user.js` or `.user.ts` extension for build system
- Output will always be `.user.js` for Greasemonkey compatibility

**Scripts:**
- kebab-case with `.sh` extension
- Example: `build-all.sh`
- Should be executable (`chmod +x`)

### Code Style

**JavaScript:**
- 2-space indentation
- Double quotes for strings
- Semicolons required
- Prefer `const` over `let`, avoid `var`
- Use descriptive variable names
- Document complex logic with comments

**TypeScript:**
- All JavaScript conventions apply
- Use explicit types for function parameters and return values
- Prefer interfaces over type aliases for object shapes
- Enable strict mode in tsconfig.json
- Use `unknown` instead of `any` when type is truly unknown
- Leverage type inference where obvious (no redundant types)
- Document public APIs with JSDoc comments

**Shell Scripts:**
- Bash strict mode: `set -Eeuo pipefail`
- Use `readonly` for constants
- Use local variables in functions
- Quote all variables: `"$var"`
- Prefer `[[` over `[` for conditionals

**Filter Lists:**
- Follow AdGuard syntax
- One rule per line
- Use comments to explain complex rules: `! Comment`
- Group related rules together

### UserScript Headers

All userscripts must include proper metadata:

```javascript
// ==UserScript==
// @name         Script Name
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  What it does
// @author       Ven0m0
// @match        https://example.com/*
// @grant        none
// ==/UserScript==
```

These headers are preserved during minification.

---

## Common Tasks

### Adding a New Filter Rule

1. Identify the appropriate source file in `lists/sources/`:
   - YouTube → `Youtube.txt`
   - Reddit → `Reddit.txt`
   - General web → `General.txt`
   - etc.

2. Add the rule following AdGuard syntax:
   ```
   ! Block example ads
   ||example.com/ads/*
   example.com##.ad-container
   ```

3. Validate:
   ```bash
   bun run lint:aglint
   ```

4. Build:
   ```bash
   bun run build
   ```

5. Commit:
   ```bash
   git add lists/sources/Youtube.txt
   git commit -m "feat: block new YouTube ad element"
   ```

### Creating a New Userscript

1. Create file in `userscripts/src/Mine/`:
   ```bash
   touch userscripts/src/Mine/my-script-optimized.user.js
   ```

2. Add UserScript header and code:
   ```javascript
   // ==UserScript==
   // @name         My Script
   // @version      1.0
   // @description  Does something cool
   // @match        https://example.com/*
   // @grant        none
   // ==/UserScript==

   (function() {
     "use strict";
     // Your code here
   })();
   ```

3. Build:
   ```bash
   bun run build:userscripts
   ```

4. Test the output in `dist/my-script-optimized.user.js`

### Updating Dependencies

**Bun dependencies:**
```bash
bun update
```

**Mise tools:**
```bash
mise outdated          # Check for updates
mise upgrade           # Update all tools
```

**Check specific tool:**
```bash
mise list              # See installed versions
```

### Running Specific Linters

```bash
# JavaScript only
bun run lint:eslint

# Filter lists only
bun run lint:aglint

# Markdown only
bun run lint:md

# YAML only
bun run lint:yaml

# Shell scripts only
bun run lint:shell
```

### Cleaning Build Artifacts

```bash
# Remove build outputs and dependencies
bun run clean

# Remove caches only
bun run clean:cache

# Nuclear option (everything)
bun run clean:all
```

### Manual Workflow Dispatch

Trigger workflows manually from GitHub Actions UI:

- **Build Filter Lists** - Force rebuild of filter lists
- **Lint & Format** - Run all linters on-demand
- **Build Userscripts** - Options:
  - `force_rebuild` - Rebuild all scripts
  - `fetch_updates` - Download external scripts

---

## Important Files

### Configuration Files

| File | Purpose | Format |
|------|---------|--------|
| `package.json` | NPM/Bun package config, scripts | JSON |
| `tsconfig.json` | TypeScript compiler configuration | JSON |
| `mise.toml` | Tool version management | TOML |
| `eslint.config.mjs` | JavaScript linting rules | ES Module |
| `biome.json` | Biome linter/formatter config | JSON |
| `.oxlintrc.json` | Oxlint configuration | JSON |
| `.prettierrc.json` | Code formatting rules | JSON |
| `.aglintrc.yml` | Filter list linting rules | YAML |
| `.markdownlint-cli2.jsonc` | Markdownlint-cli2 config | JSONC |
| `.yamllint.yml` | YAML linting rules | YAML |
| `.lefthook.yml` | Git hooks configuration | YAML |
| `.editorconfig` | Editor behavior | INI-like |
| `esbuild.config.js` | Bundler configuration (legacy) | CommonJS |
| `hostlist-config.json` | Filter compilation config | JSON |

### Build Scripts

| Script | Purpose |
|--------|---------|
| `Scripts/build-lists.sh` | Main filter list builder |
| `Scripts/build-all.sh` | Master build orchestrator |
| `userscripts/build.ts` | TypeScript userscript build system |
| `Scripts/aglint.sh` | AGLint wrapper |
| `Scripts/hostlist-build.sh` | Hostlist compilation |
| `Scripts/kompressor.sh` | Compression utility |
| `Scripts/lib-common.sh` | Shared shell functions |
| `Scripts/setup.sh` | Development setup |

### Workflow Files

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build-filter-lists.yml` | Push, daily | Build and deploy filter lists |
| `lint-and-format.yml` | Push, PR | Code quality checks |
| `userscripts.yml` | Push, weekly | Build userscripts |

---

## Troubleshooting

### Common Issues

#### 1. `mise: command not found`

**Solution:** Install mise:
```bash
curl https://mise.run | sh
# Add to shell profile if needed
```

#### 2. `bun: command not found`

**Solution:** Install via mise:
```bash
mise install bun@latest
```

Or directly:
```bash
curl -fsSL https://bun.sh/install | bash
```

#### 3. AGLint Validation Errors

**Symptoms:** Build fails with filter syntax errors

**Solution:**
```bash
# Auto-fix most issues
bunx aglint --fix

# Check what's wrong
bunx aglint
```

Common issues:
- Duplicate rules → Removed by auto-fix
- Invalid syntax → Check `.aglintrc.yml` for excluded patterns
- Unknown modifiers → Ensure using AdGuard Common syntax

#### 4. ESLint Errors

**Solution:**
```bash
# Auto-fix
eslint . --fix

# Or use the npm script
bun run lint:fix
```

Common issues:
- Unused variables → Remove or prefix with `_`
- Missing semicolons → Add or run Prettier
- Wrong quotes → Prefer double quotes

#### 5. Build Script Permission Denied

**Symptoms:** `./build-lists.sh: Permission denied`

**Solution:**
```bash
chmod +x build-lists.sh
chmod +x Scripts/*.sh
```

#### 6. Userscript Build Fails

**Check:**
1. Valid UserScript headers present
2. JavaScript syntax is valid
3. esbuild and terser are installed

**Debug:**
```bash
# Verbose esbuild output
mise exec -- bunx esbuild userscripts/src/Mine/script.user.js --outfile=test.js --log-level=info
```

#### 7. Git Pre-commit Hook Fails

**Symptoms:** Commit rejected by pre-commit hook

**Cause:** Linting or formatting issues

**Solution:**
```bash
# Fix all issues
bun run lint:fix:all

# Then retry commit
git commit
```

**Skip hook (not recommended):**
```bash
git commit --no-verify
```

#### 8. CI Workflow Failures

**Check:**
1. Workflow logs in GitHub Actions tab
2. Ensure all required files are committed
3. Check for syntax errors in YAML workflows

**Common causes:**
- Missing configuration files
- Invalid YAML syntax
- Tool installation failures

**Validate YAML locally:**
```bash
bun run lint:yaml
```

#### 9. Dead Domains Linter Takes Too Long

**Expected:** Can take 5-10+ minutes for large lists

**Solution:** Be patient, it's network-intensive (DNS lookups)

**Alternative:** Skip in local builds:
```bash
# Edit build script to comment out dead-domains-linter step
```

#### 10. Mise Tool Installation Fails

**Check mise doctor:**
```bash
mise doctor
```

**Common fixes:**
```bash
# Clear cache and reinstall
mise cache clear
mise install
```

---

## Development Best Practices

### Before Making Changes

1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **Ensure clean working directory:**
   ```bash
   git status
   ```

3. **Update dependencies:**
   ```bash
   mise install && bun install
   ```

### While Working

1. **Run linters frequently:**
   ```bash
   bun run lint
   ```

2. **Test builds locally:**
   ```bash
   bun run build
   ```

3. **Keep commits atomic** - One logical change per commit

4. **Write descriptive commit messages** - Follow conventional commits

### Before Committing

1. **Run full validation:**
   ```bash
   bun run validate
   ```

2. **Review changes:**
   ```bash
   git diff
   ```

3. **Stage selectively:**
   ```bash
   git add -p  # Interactive staging
   ```

### After Committing

1. **Push to remote:**
   ```bash
   git push origin your-branch
   ```

2. **Monitor CI workflows** in GitHub Actions

3. **Verify artifacts** are generated correctly

---

## AI Assistant Guidelines

### When Working with This Repository

1. **Always read files before editing** - Never propose changes to code you haven't read

2. **Use appropriate tools:**
   - Filter lists → Edit `.txt` files in `lists/sources/`
   - Userscripts → Edit `.user.js` files in `userscripts/src/Mine/`
   - Build process → Modify scripts in `Scripts/` or root

3. **Validate syntax:**
   - Filter lists: `bun run lint:aglint`
   - JavaScript: `bun run lint:js`
   - All: `bun run lint`

4. **Test builds:**
   ```bash
   bun run build        # Filter lists
   bun run build:userscripts  # Userscripts
   bun run validate     # Everything
   ```

5. **Follow conventions:**
   - AdGuard syntax for filter rules
   - ESLint rules for JavaScript
   - Conventional commits for messages

6. **Document changes:**
   - Add comments for complex rules
   - Update README if adding major features
   - Explain reasoning in commit messages

7. **Respect existing patterns:**
   - Match coding style of surrounding code
   - Use existing utilities and functions
   - Don't introduce unnecessary dependencies

8. **Handle errors gracefully:**
   - Check linter output carefully
   - Fix validation errors before committing
   - Test edge cases

### Common AI Assistant Mistakes to Avoid

❌ **Don't:**
- Modify generated files (`dist/`, `Filters/`, `lists/releases/`)
- Skip linting/validation steps
- Make bulk changes without testing
- Ignore existing code style
- Create duplicate rules
- Remove comments without understanding them
- Commit directly to main (use feature branches)

✅ **Do:**
- Edit source files (`lists/sources/`, `userscripts/src/`)
- Run linters after every change
- Test incrementally
- Match existing code patterns
- Check for duplicate rules before adding
- Preserve explanatory comments
- Use descriptive branch names

---

## Quick Reference

### Essential Commands

```bash
# Setup
mise install && bun install

# Development
bun run lint                 # Check all code quality
bun run lint:fix            # Auto-fix issues
bun run format              # Format all code
bun run build               # Build filter lists
bun run build:userscripts   # Build userscripts
bun run validate            # Full validation + build

# Testing
bun run test                # Lint + format check
bun run test:ci             # CI mode (check only)

# Cleanup
bun run clean               # Remove build artifacts
bun run clean:all           # Nuclear clean
```

### File Locations

| What | Where |
|------|-------|
| Filter list sources | `lists/sources/*.txt` |
| Userscript sources | `userscripts/src/Mine/*.user.js` |
| Build scripts | `Scripts/*.sh`, `build-lists.sh` |
| Configuration | Root directory (`*.json`, `*.yml`, `*.mjs`) |
| CI workflows | `.github/workflows/*.yml` |
| Built filter lists | `lists/releases/`, `Filters/` |
| Built userscripts | `dist/` |

### Key URLs

- **Repository:** https://github.com/Ven0m0/Ven0m0-Adblock
- **Issues:** https://github.com/Ven0m0/Ven0m0-Adblock/issues
- **Main List:** https://raw.githubusercontent.com/Ven0m0/Ven0m0-Adblock/refs/heads/main/Combination.txt

---

## Version History

- **v1.0** (2025-12-04) - Initial CLAUDE.md creation

---

## Additional Resources

### External Documentation

- [AdGuard Filters Syntax](https://adguard.com/kb/general/ad-filtering/create-own-filters/)
- [AGLint Documentation](https://github.com/AdguardTeam/AGLint)
- [Mise Documentation](https://mise.jdx.dev/)
- [Bun Documentation](https://bun.sh/docs)
- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files)
- [Greasemonkey API](https://wiki.greasespot.net/Greasemonkey_Manual:API)

### Related Projects

- [AdGuard Filters](https://github.com/AdguardTeam/AdguardFilters)
- [AdGuard Scriptlets](https://github.com/AdguardTeam/Scriptlets)
- [HostlistCompiler](https://github.com/AdguardTeam/HostlistCompiler)
- [DandelionSprout's adfilt](https://github.com/DandelionSprout/adfilt)

---

**Last Updated:** 2025-12-04
**Maintained By:** Ven0m0
**For AI Assistants:** This document is specifically designed to help AI assistants understand and work with this codebase effectively.
