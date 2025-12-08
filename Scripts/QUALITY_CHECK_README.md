# JS/TS Quality & High-Performance Enforcer

## Overview

`quality-check.sh` is a high-performance Bash script designed to enforce JavaScript and TypeScript code quality standards using modern Rust-based tooling. It replaces traditional ESLint/Prettier workflows with faster alternatives while maintaining comprehensive quality checks.

## Architecture

### Toolchain Stack

1. **Biome** (Rust-based) - Fast formatter and linter
   - Replaces: Prettier + Basic ESLint rules
   - Speed: 100x faster than Prettier
   - Features: Format + Lint + Import organization

2. **Oxlint** (Rust-based) - Deep static analysis
   - Part of Oxc project (Oxidation Compiler)
   - Replaces: Advanced ESLint semantic checks
   - Speed: 50-100x faster than ESLint
   - Features: Correctness, security, performance analysis

3. **fd** (Rust-based) - File discovery
   - Replaces: find command
   - Speed: 10x faster than find
   - Features: Parallel directory traversal, smart gitignore handling

## Workflow Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│                    1. Tool Verification                      │
│  Check: biome, oxlint, fd availability                      │
└─────────────────────┬────────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────────┐
│                    2. File Discovery                         │
│  fd -tf -e js -e jsx -e ts -e tsx -E node_modules          │
│  Finds: *.{js,jsx,ts,tsx,mjs,cjs}                          │
└─────────────────────┬────────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────────┐
│                    3. Format (Write)                         │
│  biome format --write <files>                               │
│  Actions: Fix indentation, quotes, spacing, semicolons      │
└─────────────────────┬────────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────────┐
│                    4. Lint (Fix)                             │
│  biome check --write --unsafe=false <files>                 │
│  Actions: Auto-fix safe issues, organize imports            │
└─────────────────────┬────────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────────┐
│                    5. Deep Analysis (Check)                  │
│  oxlint -D all --deny-warnings <files>                      │
│  Checks: Correctness, security, performance, complexity     │
└─────────────────────┬────────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────────┐
│                    6. Report Generation                      │
│  - Summary table (human-readable)                           │
│  - JSON report (CI-friendly, if CI=true)                    │
│  - Exit code: 0 (pass) or 1 (fail)                         │
└──────────────────────────────────────────────────────────────┘
```

## Usage

### Local Development

```bash
# Run quality checks (format, lint, analyze)
./Scripts/quality-check.sh

# Or via npm/bun script
bun run quality:check
```

### CI/CD Integration

```bash
# Enable CI mode (generates JSON report)
CI=true ./Scripts/quality-check.sh

# Or via npm/bun script
bun run quality:ci
```

### Exit Codes

- `0` - All quality checks passed
- `1` - Quality checks failed (unfixable errors found)

## Configuration Files

### biome.json

Primary configuration for formatting and linting rules.

**Key Settings:**

```json
{
  "formatter": {
    "indentWidth": 2,
    "lineWidth": 100,
    "quoteStyle": "double",
    "semicolons": "always"
  },
  "linter": {
    "rules": {
      "correctness": { "noUnusedVariables": "error" },
      "style": { "noVar": "error", "useConst": "error" },
      "suspicious": { "noDoubleEquals": "error" },
      "security": { "noDangerouslySetInnerHtml": "error" }
    }
  }
}
```

**File-specific Overrides:**

- `*.user.js` - Console logs allowed (for userscripts)
- `*.config.js` - Node globals, relaxed rules
- `Scripts/*.sh` - Shell script context

### .oxlintrc.json

Configuration for deep static analysis.

**Key Settings:**

```json
{
  "rules": {
    "correctness": "error",
    "suspicious": "error",
    "perf": "warn",
    "style": "warn"
  },
  "env": {
    "browser": true,
    "es2020": true,
    "greasemonkey": true
  }
}
```

## Features

### 1. Multi-stage Quality Enforcement

- **Format First** - Normalize code style before linting
- **Safe Auto-fix** - Only apply fixes that preserve semantics
- **Deep Analysis** - Catch issues beyond formatting

### 2. High Performance

| Tool | Traditional | New (Rust) | Speedup |
|------|------------|------------|---------|
| Formatting | Prettier | Biome | 100x |
| Linting | ESLint | Biome + Oxlint | 50-100x |
| File Search | find | fd | 10x |

### 3. Comprehensive Checks

**Correctness:**
- Unused variables and imports
- Unreachable code
- Invalid syntax
- Type inconsistencies (TS)

**Security:**
- Dangerous HTML injection
- Eval usage
- XSS vulnerabilities

**Performance:**
- Inefficient patterns
- Unnecessary loops
- Memory leaks

**Style:**
- Consistent formatting
- Naming conventions
- Code complexity

### 4. CI/CD Ready

**Normal Mode:**
```
┌──────────────────────────────┬──────────┬───────────┬────────────┐
│ Metric                       │ Value    │ Biome     │ Oxc Issues │
├──────────────────────────────┼──────────┼───────────┼────────────┤
│ Total Files Scanned          │       42 │ -         │ -          │
│ Biome Check Results          │ -        │ 3 errors  │ -          │
│ Oxlint Analysis Results      │ -        │ -         │ 5 errors   │
│ Total Issues Found           │        8 │ -         │ -          │
└──────────────────────────────┴──────────┴───────────┴────────────┘
```

**CI Mode (JSON):**
```json
{
  "timestamp": "2025-12-08T10:30:00Z",
  "total_files": 42,
  "total_errors": 8,
  "exit_code": 1,
  "checks": {
    "biome": { "status": 1, "errors": ["3 errors found"] },
    "oxlint": { "status": 1, "errors": ["5 issues found"] }
  },
  "files": ["src/file1.js", "src/file2.ts", ...]
}
```

## Installation Requirements

### Install Biome

```bash
# Via npm (global)
npm install -g @biomejs/biome

# Via mise (recommended)
mise install biome@latest

# Via cargo (from source)
cargo install biome
```

### Install Oxlint

```bash
# Via npm (global)
npm install -g oxlint

# Via cargo (from source)
cargo install oxc

# Via mise (if available)
mise install oxc@latest
```

### Install fd

```bash
# Via mise (recommended)
mise install fd@latest

# Via package manager
# Ubuntu/Debian
apt install fd-find

# macOS
brew install fd

# Via cargo
cargo install fd-find
```

### Verify Installation

```bash
# Check all tools
biome --version
oxlint --version
fd --version

# Or let the script check for you
./Scripts/quality-check.sh
```

## Comparison with Traditional Setup

### Before (ESLint + Prettier)

```bash
# Separate commands
npx prettier --write .
npx eslint . --fix

# Slow (Node.js-based)
# Time: ~30-60s for medium projects
```

### After (Biome + Oxlint)

```bash
# Single integrated command
./Scripts/quality-check.sh

# Fast (Rust-based)
# Time: ~1-3s for same projects
# Speedup: 10-50x faster
```

### Feature Comparison

| Feature | ESLint+Prettier | Biome+Oxlint |
|---------|----------------|--------------|
| Formatting | ✅ Prettier | ✅ Biome |
| Linting | ✅ ESLint | ✅ Biome + Oxlint |
| Import Sort | ⚠️ Plugin | ✅ Built-in |
| Auto-fix | ✅ Limited | ✅ Comprehensive |
| Performance | ❌ Slow (Node) | ✅ Fast (Rust) |
| Config | ⚠️ Multiple files | ✅ Single file |
| JSON Support | ⚠️ Separate | ✅ Integrated |

## Troubleshooting

### Tools Not Found

**Error:** `Required tool 'biome' not found`

**Solution:**
```bash
# Install via mise (recommended)
mise install

# Or install individually
npm install -g @biomejs/biome oxlint
```

### Permission Denied

**Error:** `Permission denied: ./Scripts/quality-check.sh`

**Solution:**
```bash
chmod +x Scripts/quality-check.sh
```

### Formatting Conflicts

**Issue:** Biome and Prettier produce different output

**Solution:**
```bash
# Remove Prettier from workflow
# Update biome.json to match desired style
# Run quality check to apply Biome formatting
bun run quality:check
```

### False Positives (Oxlint)

**Issue:** Oxlint reports valid patterns as errors

**Solution:**
```bash
# Update .oxlintrc.json to disable specific rules
{
  "rules": {
    "suspicious/noExplicitAny": "off"
  }
}
```

### Large Codebases

**Issue:** Script takes too long on very large projects

**Solution:**
```bash
# Process specific directories
fd -tf -e js userscripts/ | xargs biome check --write

# Or use ignore patterns in biome.json
{
  "files": {
    "ignore": ["legacy/**", "vendor/**"]
  }
}
```

## Integration Examples

### GitHub Actions

```yaml
name: Quality Check

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install tools
        run: |
          npm install -g @biomejs/biome oxlint

      - name: Run quality check
        run: CI=true ./Scripts/quality-check.sh

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: quality-report
          path: quality-report.json
```

### Pre-commit Hook

```bash
#!/bin/bash
# .husky/pre-commit

echo "Running quality checks..."
./Scripts/quality-check.sh || {
  echo "Quality checks failed. Fix issues before committing."
  exit 1
}
```

### Makefile

```makefile
.PHONY: quality
quality:
	@./Scripts/quality-check.sh

.PHONY: quality-ci
quality-ci:
	@CI=true ./Scripts/quality-check.sh
```

## Best Practices

### 1. Run Before Commits

Always run quality checks before committing:

```bash
# Add to pre-commit hook
bun run quality:check
git add -u
git commit -m "fix: apply quality fixes"
```

### 2. Integrate with CI

Make quality checks mandatory in CI:

```yaml
- name: Quality Gate
  run: bun run quality:ci
```

### 3. Configure for Your Project

Customize `biome.json` to match your style guide:

```json
{
  "formatter": {
    "indentWidth": 4,  // Your preference
    "lineWidth": 120   // Your preference
  }
}
```

### 4. Handle Exceptions

Use inline comments for intentional violations:

```javascript
// biome-ignore lint/suspicious/noExplicitAny: Legacy API contract
function legacyApi(data: any) { ... }
```

### 5. Monitor Performance

Track execution time:

```bash
time ./Scripts/quality-check.sh
```

## Advanced Usage

### Custom File Patterns

Edit script to check only specific files:

```bash
# In discover_files() function
mapfile -t SCANNED_FILES < <(
  "$FD_BIN" -tf -e js -e ts \
    --base-directory src/ \
    . 2>/dev/null || true
)
```

### Skip Specific Checks

Comment out pipeline stages:

```bash
# main() function
# run_biome_format    # Skip formatting
run_biome_lint
run_oxlint
```

### Environment Variables

```bash
# Use alternative binaries
BIOME_BIN=/custom/path/biome ./Scripts/quality-check.sh

# Force CI mode
CI=true ./Scripts/quality-check.sh
```

## Future Enhancements

- [ ] Parallel file processing
- [ ] Incremental checking (git diff only)
- [ ] Custom reporter formats (HTML, SARIF)
- [ ] Integration with code coverage tools
- [ ] Auto-fix suggestions for manual review

## Resources

### Official Documentation

- [Biome Docs](https://biomejs.dev/)
- [Oxc Project](https://oxc.rs/)
- [fd Documentation](https://github.com/sharkdp/fd)

### Related Tools

- [Biome VS Code Extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)
- [Oxc Playground](https://oxc.rs/playground)

## Support

For issues or questions:

1. Check troubleshooting section above
2. Review configuration files
3. Open issue in repository
4. Consult tool documentation

---

**Version:** 1.0.0
**Last Updated:** 2025-12-08
**Maintained By:** Ven0m0
**License:** GPL-3.0
