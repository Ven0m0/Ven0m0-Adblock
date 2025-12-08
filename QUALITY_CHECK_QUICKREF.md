# Quality Check Quick Reference

## 🚀 Quick Start

```bash
# Install tools
mise install

# Run quality check
bun run quality:check
```

## 📋 Commands

| Command | Description |
|---------|-------------|
| `bun run quality:check` | Run all quality checks (format, lint, analyze) |
| `bun run quality:ci` | CI mode with JSON report |
| `mise run quality` | Same as quality:check via mise |
| `./Scripts/quality-check.sh` | Direct script execution |

## 🎯 What It Does

```
1. Tool Check  → Verify biome, oxlint, fd installed
2. File Scan   → Find all JS/TS files (exclude node_modules)
3. Format      → Apply consistent style (Biome)
4. Lint & Fix  → Auto-fix safe issues (Biome)
5. Deep Check  → Static analysis (Oxlint)
6. Report      → Summary table + optional JSON
```

## ⚙️ Configuration

- **biome.json** - Formatting & linting rules
- **.oxlintrc.json** - Deep analysis rules

## 🔧 Common Tasks

### Fix All Issues
```bash
bun run quality:check
```
Auto-fixes applied, unfixable issues reported.

### CI Integration
```bash
CI=true bun run quality:check
```
Generates `quality-report.json` for parsers.

### Check Specific Files
```bash
biome check --write src/file.js
oxlint src/file.js
```

## 📊 Output

### Success
```
✓ All quality checks passed!
```

### Failure
```
✗ Quality checks failed with N total issues
```
Details shown inline. Exit code: 1

## 🛠️ Troubleshooting

### Tools Missing
```bash
mise install  # Install all tools
```

### Permission Denied
```bash
chmod +x Scripts/quality-check.sh
```

### Ignore False Positives
```javascript
// biome-ignore lint/rule-name: Reason
```

## 📖 Full Docs

- **Detailed Guide:** `Scripts/QUALITY_CHECK_README.md`
- **System Overview:** `QUALITY_ENFORCEMENT.md`

## ⚡ Performance

- **Traditional (ESLint+Prettier):** ~45s
- **New (Biome+Oxlint):** ~2-3s
- **Speedup:** 15-20x faster

## 🎨 Code Style

- Indent: 2 spaces
- Quotes: Double (`"`)
- Semicolons: Always (`;`)
- Line width: 100 chars
- Trailing commas: None

## 🔒 What Gets Checked

✅ Unused variables/imports
✅ Security issues (XSS, injection)
✅ Performance anti-patterns
✅ Code complexity
✅ Type safety (TS)
✅ Consistent formatting
✅ Import organization

## 💡 Tips

1. **Run before commit** - Catches issues early
2. **Review auto-fixes** - Verify changes make sense
3. **Customize config** - Adjust rules to your workflow
4. **Use IDE integration** - Install Biome extension

---

**Quick Help:** `./Scripts/quality-check.sh --help` (not implemented yet)
**Issues:** See troubleshooting section in main docs
