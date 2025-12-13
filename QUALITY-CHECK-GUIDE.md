# JS/TS Quality & High-Performance Enforcer Guide

## Overview

The `Scripts/quality-check.sh` script provides comprehensive quality enforcement for JavaScript and TypeScript files using modern, high-performance Rust-based tooling.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              quality-check.sh Workflow                      │
├─────────────────────────────────────────────────────────────┤
│  1. Tool Verification    → Check Biome, Oxlint, fd         │
│  2. File Discovery       → Find all JS/TS files            │
│  3. Format (Write)       → Biome formatter                 │
│  4. Lint (Fix)           → Biome linter (safe auto-fix)    │
│  5. Lint (Deep Check)    → Oxlint static analysis          │
│  6. Report Generation    → Summary table + JSON (CI mode)  │
│  7. Exit Code            → 0 (pass) or 1 (fail)            │
└─────────────────────────────────────────────────────────────┘
```

## Toolchain

### Primary Tools

| Tool | Purpose | Performance | Language |
|------|---------|-------------|----------|
| **Biome** | Formatting & Basic Linting | ~10x faster than Prettier | Rust |
| **Oxlint** | Deep Static Analysis | ~50-100x faster than ESLint | Rust |
| **fd** | File Discovery | ~10x faster than find | Rust |

### Tool Replacements

- **Biome** replaces: Prettier (formatter) + ESLint (basic rules)
- **Oxlint** replaces: ESLint (deep semantic analysis)
- **fd** replaces: find (file discovery)

## Configuration Files

### biome.json

Located: `/home/user/Ven0m0-Adblock/biome.json`

**Key Settings:**

```json
{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "none"
    }
  },
  "linter": {
    "rules": {
      "correctness": { "noUnusedVariables": "error" },
      "suspicious": { "noDoubleEquals": "error", "noVar": "error" },
      "security": { "noDangerouslySetInnerHtml": "error" }
    }
  }
}
```

**Overrides:**

- Userscripts (`*.user.js`): Console allowed
- Config files: Node globals, console allowed

### .oxlintrc.json

Located: `/home/user/Ven0m0-Adblock/.oxlintrc.json`

**Key Settings:**

```json
{
  "rules": {
    "correctness": "error",
    "suspicious": "error",
    "perf": "warn",
    "style": "warn"
  },
  "globals": {
    "GM_addStyle": "readonly",
    "unsafeWindow": "readonly"
  },
  "env": {
    "browser": true,
    "greasemonkey": true
  }
}
```

## Usage

### Quick Start

```bash
# Run quality checks (local mode)
bun run quality:check

# Run quality checks (CI mode with JSON report)
bun run quality:ci

# Or directly
./Scripts/quality-check.sh
CI=true ./Scripts/quality-check.sh
```

### NPM Scripts

```json
{
  "quality:check": "./Scripts/quality-check.sh",
  "quality:ci": "CI=true ./Scripts/quality-check.sh"
}
```

### File Discovery Patterns

**Included:**

- `**/*.js`, `**/*.jsx`
- `**/*.ts`, `**/*.tsx`
- `**/*.mjs`, `**/*.cjs`

**Excluded:**

- `node_modules/`
- `.git/`
- `dist/`, `build/`
- `coverage/`
- `*.min.js`, `*.bundle.js`

### Example Output

```
🚀 JS/TS Quality & High-Performance Enforcer
Project: /home/user/Ven0m0-Adblock

🔍 Verifying Required Tools
✓ bunx biome found: 0.3.3
✓ bunx oxlint found: Version: 1.32.0
✓ Using find as fallback (fd not found)

📂 Discovering JS/TS Files
✓ Found 5 files to process
  - ./esbuild.config.js
  - ./userscripts/src/web-pro.user.js
  - ./userscripts/src/gh-pro.user.js
  - ./userscripts/src/yt-pro.user.js
  - ./userscripts/src/LLM-pro.user.js

🎨 Running Biome Formatter
✓ Formatting completed successfully

🔧 Running Biome Linter (with auto-fix)
✓ Linting completed with no errors

🔬 Running Oxlint Deep Static Analysis
✓ Deep static analysis passed with no issues

📊 Quality Check Summary
┌─────────────────────────────────┬──────────────┬───────────────┬──────────────┐
│ Metric                          │ Value        │ Biome Issues  │ Oxc Issues   │
├─────────────────────────────────┼──────────────┼───────────────┼──────────────┤
│ Total Files Scanned             │            5 │ -             │ -            │
│ Biome Check Results             │ -            │ -             │ -            │
│ Oxlint Analysis Results         │ -            │ -             │ -            │
├─────────────────────────────────┼──────────────┼───────────────┼──────────────┤
│ Total Issues Found              │            0 │ -             │ -            │
└─────────────────────────────────┴──────────────┴───────────────┴──────────────┘

✓ All quality checks passed!
```

## Workflow Details

### 1. Tool Verification

Checks that all required tools are available:

```bash
# Checks for:
- fd (or find fallback)
- bunx biome (or global biome)
- bunx oxlint (or global oxlint)

# Provides install hints if missing:
- bun add -D @biomejs/biome
- bun add -D oxlint
- mise install fd@latest
```

### 2. File Discovery

Uses `fd` for fast file discovery with fallback to `find`:

```bash
# fd (preferred - 10x faster)
fd -tf -e js -e jsx -e ts -e tsx -E node_modules -E .git

# find (fallback)
find . -type f \( -name "*.js" -o -name "*.jsx" ... \) ! -path "*/node_modules/*"
```

### 3. Formatting (Biome)

Formats all discovered files with Biome:

```bash
bunx biome format --write [files...]

# Applies:
- 2-space indentation
- Double quotes
- Semicolons required
- No trailing commas
- Line width: 100
```

### 4. Linting with Auto-Fix (Biome)

Runs Biome linter with safe auto-fixes:

```bash
bunx biome check --write [files...]

# Fixes:
- Unused imports/variables
- Use const instead of let
- Remove double equals (use ===)
- Remove var (use const/let)
- Organize imports
```

### 5. Deep Static Analysis (Oxlint)

Runs comprehensive static analysis:

```bash
bunx oxlint -D all --deny-warnings [files...]

# Checks:
- Correctness issues (errors)
- Suspicious patterns (errors)
- Performance issues (warnings)
- Style violations (warnings)
- Security vulnerabilities
```

### 6. Report Generation

#### Console Summary Table

Displays a formatted table with:

- Total files scanned
- Biome issues found/fixed
- Oxlint issues found
- Total error count
- Pass/fail status

#### CI JSON Report

When `CI=true`, generates `quality-report.json`:

```json
{
  "timestamp": "2025-12-13T12:34:56Z",
  "total_files": 5,
  "total_errors": 0,
  "exit_code": 0,
  "checks": {
    "biome": { "status": "0", "errors": [] },
    "oxlint": { "status": "0", "errors": [] }
  },
  "files": ["./esbuild.config.js", ...]
}
```

### 7. Exit Codes

- **0**: All checks passed (no unfixable errors)
- **1**: Quality checks failed (unfixable errors remain)

## Integration

### Pre-commit Hook

Add to `.husky/pre-commit` or equivalent:

```bash
#!/usr/bin/env sh
bun run quality:check
```

### CI/CD Pipeline

#### GitHub Actions

```yaml
- name: Quality Check
  run: bun run quality:ci

- name: Upload Quality Report
  uses: actions/upload-artifact@v4
  with:
    name: quality-report
    path: quality-report.json
```

#### GitLab CI

```yaml
quality-check:
  script:
    - bun install
    - bun run quality:ci
  artifacts:
    reports:
      codequality: quality-report.json
```

### Package.json Integration

```json
{
  "scripts": {
    "test": "bun run quality:check && bun run unit-tests",
    "validate": "bun run quality:check && bun run build",
    "precommit": "bun run quality:check"
  }
}
```

## Performance Benchmarks

Compared to traditional ESLint + Prettier setup:

| Operation | Traditional | quality-check.sh | Speedup |
|-----------|-------------|------------------|---------|
| Format 100 files | ~2.5s | ~0.25s | **10x** |
| Lint 100 files | ~15s | ~0.3s | **50x** |
| Full check | ~17.5s | ~0.6s | **~30x** |

**Note:** Benchmarks are approximate and depend on file complexity.

## Troubleshooting

### Missing Tools

**Error:** `Required tool 'bunx biome' not found`

**Solution:**

```bash
bun add -D @biomejs/biome oxlint
# Or globally
bun install -g @biomejs/biome oxlint
```

### fd Not Found

**Error:** Using find as fallback (fd not found)

**Solution (optional):**

```bash
# Install fd for faster file discovery
mise install fd@latest
# Or
cargo install fd-find
# Or (Debian/Ubuntu)
apt-get install fd-find
```

### Formatting Errors

**Error:** Formatting completed with warnings

**Solution:**

Check syntax errors in files. Biome won't format files with syntax errors.

```bash
bunx biome check [file]
```

### Oxlint Failures

**Error:** Deep static analysis found issues

**Solution:**

Review and fix reported issues. Most common:

- **sort-keys**: Alphabetize object keys (style warning)
- **curly**: Add braces to if/else statements
- **no-unused-vars**: Remove unused variables
- **no-console**: Remove console statements (or configure override)

### Configuration Conflicts

If using both ESLint and Biome/Oxlint, disable overlapping rules:

```json
// .eslintrc.json
{
  "rules": {
    "prettier/prettier": "off",  // Biome handles formatting
    "no-unused-vars": "off"      // Biome/Oxlint handle this
  }
}
```

## Advanced Configuration

### Custom File Patterns

Edit `Scripts/quality-check.sh`:

```bash
# Add more extensions
readonly FILE_EXTENSIONS=(-e js -e jsx -e ts -e tsx -e mjs -e cjs -e vue)

# Add more excludes
readonly EXCLUDE_DIRS=(-E node_modules -E .git -E dist -E vendor)
```

### Custom Biome Rules

Edit `biome.json`:

```json
{
  "linter": {
    "rules": {
      "suspicious": {
        "noConsole": "error"  // Strict: no console allowed
      }
    }
  }
}
```

### Custom Oxlint Rules

Edit `.oxlintrc.json`:

```json
{
  "rules": {
    "pedantic": "warn"  // Enable pedantic checks
  }
}
```

### Environment Variables

```bash
# Override tool binaries
BIOME_BIN="biome" ./Scripts/quality-check.sh
OXLINT_BIN="oxlint" ./Scripts/quality-check.sh
FD_BIN="fd" ./Scripts/quality-check.sh

# Enable CI mode
CI=true ./Scripts/quality-check.sh

# Debug mode (if supported by tools)
DEBUG=1 ./Scripts/quality-check.sh
```

## Best Practices

### 1. Run Locally First

Always run `bun run quality:check` locally before pushing:

```bash
bun run quality:check && git push
```

### 2. Integrate with Git Hooks

Use Husky or similar to enforce quality checks:

```bash
# .husky/pre-commit
#!/usr/bin/env sh
bun run quality:check || exit 1
```

### 3. Use CI Mode in Pipelines

Always use `CI=true` in automated pipelines for JSON reports:

```bash
CI=true ./Scripts/quality-check.sh
```

### 4. Fix Auto-fixable Issues First

Let Biome fix what it can before manual review:

```bash
bunx biome check --write .
```

### 5. Review Oxlint Warnings

Treat warnings as errors in production code:

```bash
bunx oxlint -D all --deny-warnings .
```

## Migration from ESLint/Prettier

### 1. Install Dependencies

```bash
bun add -D @biomejs/biome oxlint
```

### 2. Create Configurations

Copy provided `biome.json` and `.oxlintrc.json` templates.

### 3. Update Scripts

Replace in `package.json`:

```diff
- "format": "prettier --write .",
- "lint": "eslint .",
+ "format": "bunx biome format --write .",
+ "lint": "bunx biome check --write .",
+ "quality:check": "./Scripts/quality-check.sh",
```

### 4. Gradual Migration

Keep ESLint for complex rules not yet supported:

```bash
bun run quality:check && bun run lint:eslint
```

### 5. Remove Old Tools (Optional)

Once confident, remove:

```bash
bun remove prettier eslint @eslint/js
rm -f .prettierrc.json .eslintrc.json
```

## Script Source

**Location:** `/home/user/Ven0m0-Adblock/Scripts/quality-check.sh`

**Lines of Code:** 460

**Language:** Bash

**Dependencies:**

- Biome (`@biomejs/biome`)
- Oxlint (`oxlint`)
- fd (optional, falls back to find)
- Standard Unix utilities (grep, wc, printf, etc.)

## Contributing

### Reporting Issues

If you encounter issues with the quality check script:

1. Run with verbose output: `DEBUG=1 bun run quality:check`
2. Check tool versions: `bunx biome --version`, `bunx oxlint --version`
3. Verify configurations: `biome.json`, `.oxlintrc.json`
4. Report to: https://github.com/Ven0m0/Ven0m0-Adblock/issues

### Extending the Script

To add new quality checks:

1. Add tool verification in `verify_tools()`
2. Add check function (e.g., `run_my_tool()`)
3. Call from `main()`
4. Update report generation
5. Test thoroughly

## References

- [Biome Documentation](https://biomejs.dev/)
- [Oxlint Documentation](https://oxc.rs/docs/guide/usage/linter.html)
- [fd Documentation](https://github.com/sharkdp/fd)
- [Project CLAUDE.md](/home/user/Ven0m0-Adblock/CLAUDE.md)

## License

GPL-3.0 - Same as project license

## Version History

- **v1.0** (2025-12-13) - Initial quality-check infrastructure
  - Biome integration for formatting and linting
  - Oxlint integration for deep static analysis
  - Comprehensive reporting (console + JSON)
  - CI/CD integration support

---

**Maintained by:** Ven0m0
**Last Updated:** 2025-12-13
