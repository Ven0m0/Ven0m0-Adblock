# GitHub Workflows

This directory contains optimized GitHub Actions workflows for the Ven0m0-Adblock project.

## Active Workflows

### 🔍 Lint & Format (`lint-and-format.yml`)

Comprehensive linting and formatting workflow that runs on push/PR.

- **Linters:**
  - ESLint (JavaScript/Node.js)
  - AGLint (AdGuard filter lists)
  - Prettier (All files)
  - YAML Lint (Workflow files)
  - ShellCheck (Shell scripts)

- **Auto-fix:** Automatically fixes and commits linting issues on main branch
- **Concurrency:** Runs linters in parallel for faster feedback
- **Caching:** Aggressive dependency caching for performance

### 📜 Build Userscripts (`userscripts.yml`)

Builds, optimizes, and minifies userscripts.

- **Triggers:**
  - Push to main (userscripts changed)
  - Pull requests
  - Weekly scheduled updates (Mondays at 00:00 UTC)
  - Manual dispatch

- **Features:**
  - Smart change detection (only rebuild changed scripts)
  - External script fetching (from List file)
  - Multi-stage optimization (esbuild + terser)
  - Automatic README generation
  - Artifact uploads

### 🛡️ Build Filter Lists (`build-filter-lists.yml`)

Compiles and optimizes ad-blocking filter lists.

- **Triggers:**
  - Push to main (filter lists changed)
  - Daily scheduled build (07:00 UTC)
  - Manual dispatch

- **Features:**
  - Pre-build linting with AGLint
  - Multiple compilation strategies:
    - AdGuard toolchain (hostlist-compiler)
    - Ragibkl compiler (Python-based)
    - Custom build scripts
  - Dead domain cleaning
  - Format conversion (scheduled)
  - Parallel job execution

## Deprecated Workflows

Files prefixed with `_deprecated_` are old workflows that have been replaced by the
optimized versions above. They are kept for reference but will not run.

To remove them entirely:

```bash
rm .github/workflows/_deprecated_*.old
```

## Performance Optimizations

All workflows implement:

1. **Dependency Caching:**
   - Bun install cache
   - Node modules cache
   - Python pip cache
   - Tool binaries cache

2. **Concurrency Control:**
   - Cancel in-progress runs on new push
   - Group runs by workflow and ref

3. **Smart Triggers:**
   - Path-based filtering
   - Change detection
   - Skip CI when appropriate

4. **Artifact Management:**
   - 30-day retention for build artifacts
   - Automatic cleanup of old workflow runs

## Configuration Files

Related configuration files in the repository:

- `.editorconfig` - Editor consistency
- `.prettierrc.json` - Prettier formatting rules
- `.markdownlint.json` - Markdown linting rules
- `.yamllint.yml` - YAML linting rules
- `.aglintrc.yml` - AGLint filter list rules
- `eslint.config.mjs` - ESLint JavaScript rules

## Local Development

Run the same checks locally:

```bash
# Install dependencies
bun install

# Run all linters
bun run lint

# Run specific linters
bun run lint:js        # ESLint
bun run lint:filters   # AGLint
bun run lint:yaml      # YAML
bun run lint:md        # Markdown
bun run lint:shell     # ShellCheck

# Auto-fix issues
bun run lint:fix       # Fix JS and filters
bun run format         # Format all files
bun run lint:fix:all   # Fix and format everything

# Build
bun run build              # Build filter lists
bun run build:userscripts  # Build userscripts
bun run build:all          # Build everything

# Test (lint + format check)
bun run test

# Validate (test + build)
bun run validate
```

## CI/CD Best Practices

These workflows follow GitHub Actions best practices:

- ✅ Pinned action versions for reproducibility
- ✅ Minimal permissions (contents: write only when needed)
- ✅ Fail-fast disabled for parallel jobs
- ✅ Continue-on-error for non-critical steps
- ✅ Descriptive job and step names
- ✅ Comprehensive logging and annotations
- ✅ Artifact retention management
- ✅ Bot commit identity for automation

## Maintenance

### Adding a New Linter

1. Add to `package.json` devDependencies
2. Add npm script to `package.json`
3. Add to `lint-and-format.yml` matrix
4. Update this README

### Modifying Build Process

1. Update the relevant workflow
2. Test locally with `bun run build`
3. Commit and push to test in CI

### Troubleshooting

If a workflow fails:

1. Check the Actions tab for detailed logs
2. Run the same command locally: `bun run <script>`
3. Verify configuration files are valid
4. Check for dependency issues: `bun install`
5. Clear cache and retry

---

*Last updated: 2025-11-20*
