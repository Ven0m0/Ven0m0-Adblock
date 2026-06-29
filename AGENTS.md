# AGENTS.md

Canonical agent instructions for `Ven0m0/Ven0m0-Adblock`.
`CLAUDE.md` is a symlink to this file and reflects all changes automatically.
`.github/copilot-instructions.md` is a secondary reference for Copilot; this file takes precedence.

## Project

Ad-blocking filter lists, hostlists, and userscripts.
Tooling: Bun (JS runtime and package manager), Python 3.13+ via uv, Mise (tool manager), GitHub Actions.
Filter syntax: AdGuard and uBlock Origin rule formats.

## Source files — edit these

| Path | Content |
|------|---------|
| `lists/adblock/` | Hand-maintained adblock filter rules |
| `lists/hostlist/` | Hand-maintained DNS hostlist rules |
| `userscripts/src/` | Userscript source files |
| `Scripts/` | Python build and maintenance tooling |
| `.github/workflows/` | CI workflow definitions |
| Root configs | `package.json`, `mise.toml`, `pyproject.toml`, `.aglintrc.yml`, `.oxlintrc.json`, `biome.json` |

## CI-generated paths — owned by pipeline

These are absent from a fresh checkout and written by CI or build scripts.
Edit source files; the pipeline regenerates these automatically.

| Path | Written by |
|------|-----------|
| `lists/sources/` | `Scripts/update_lists.py` and CI (treat as pipeline-managed unless the task targets the update pipeline directly) |
| `lists/releases/` | `Scripts/build.py` via `.github/workflows/build-filter-lists.yml` |
| `Filters/` | AdGuard hostlist-compiler via `.github/workflows/build-filter-lists.yml` |
| `userscripts/dist/` | `Scripts/build.py` via `.github/workflows/userscripts.yml` |
| `dist/` | `.github/workflows/userscripts.yml` artifact step |

## Agent workflow

1. Read the file before editing it.
2. Use `rg` to find existing rules, domains, selectors, or references before adding new ones.
3. Change source files; the pipeline handles generated outputs.
4. Keep changes surgical — leave unrelated code untouched.
5. Match the style of the file being edited.
6. Preserve comments and metadata blocks unless the task requires changing them.
7. When adding filter rules, verify no duplicate exists first.
8. Userscript work: edit `userscripts/src/`; `userscripts/todo/` is out of scope for lint and build.
9. Build or CI changes: check `Scripts/build.py` and the relevant workflow file together.
10. When updating agent instructions: edit `AGENTS.md`; `CLAUDE.md` updates automatically.

## CI and release process

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `.github/workflows/build-filter-lists.yml` | Push to `main` touching `lists/sources/` or `Scripts/build.py` | Lints sources, compiles filter outputs, auto-commits |
| `.github/workflows/update-lists.yml` | Schedule / dispatch | Downloads upstream filter lists into `lists/sources/` |
| `.github/workflows/maintain-lists.yml` | Manual dispatch | Deduplicates, removes dead domains, creates a dated GitHub release (tag format: vYYYY.MM.DD-HHMM) with a compiled `blocklist` artifact |
| `.github/workflows/userscripts.yml` | Push | Builds and publishes userscript dist outputs |
| `.github/workflows/lint-and-format.yml` | PR | Runs JS and markdown linters |
| `.github/workflows/aglint.yml` | PR and push | Lints and auto-fixes filter rules |

Releases are created automatically by `.github/workflows/maintain-lists.yml` — no manual tagging needed.

## Commands

```bash
# Setup
mise install && bun install && uv sync

# Lint (JS + filters + markdown)
bun run lint

# Lint subsets
bun run lint:js        # biome + oxlint
bun run lint:filters   # AGLint
bun run lint:md        # markdownlint

# Format
bun run format         # write
bun run format:check   # check only

# Build
bun run build              # all outputs
bun run build:adblock      # adblock filter list
bun run build:hosts        # hosts file
bun run build:userscripts  # userscripts

# Python checks (run when editing .py files)
uv run ruff check .
uv run ruff format --check .

# YAML and workflow checks (run when editing .yml files)
yamllint .             # requires: pip install yamllint
```

`bun run test` = lint + format check. `bun run validate` = test + build.

## Style conventions

**JavaScript** — 2-space indent, double quotes, semicolons required, `const` preferred over `let`.

**Python** — 3.13+, `ruff` for lint and format, `snake_case` filenames, internal imports use the `Scripts` package namespace.

**Filter rules** — one rule per line, `!` prefix for comments, group related rules together, no duplicates.

## Commit and PR conventions

Prefixes: `feat:`, `fix:`, `docs:`, `ci:`, `refactor:`, `test:`, `chore:`.
Keep commit subjects concise.
In PRs: name the source files changed; mention generated outputs only when intentionally regenerated.
