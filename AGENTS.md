# AGENTS.md

Canonical repository instructions for AI coding agents working in `Ven0m0/Ven0m0-Adblock`.
`CLAUDE.md` should remain a symlink to this file.

## Project summary

- Ad-blocking filter lists, hostlists, and userscripts.
- Primary tooling: Bun, Node.js, Mise, UV, GitHub Actions.
- Main languages: AdGuard/uBlock filter syntax, JavaScript, Python, Bash.

## Source of truth

### Edit these by hand

- `lists/adblock/*.txt` - hand-maintained adblock rules
- `lists/hostlist/*.txt` - hand-maintained DNS/hostlist rules
- `userscripts/src/*.user.js` - userscript source files
- `Scripts/*.sh` - shell tooling
- `Scripts/*.py` - Python tooling
- Root configs such as `package.json`, `mise.toml`, `pyproject.toml`,
  `.aglintrc.yml`, `.oxlintrc.json`, `biome.json`, and workflow files
  when the task requires them

### Generated or pipeline-managed paths - do not hand-edit

- `lists/sources/**` - normalized/generated filter inputs consumed by `Scripts/build.sh` and CI
- `lists/external/**` - downloaded upstream content
- `lists/releases/**` - built list outputs
- `Filters/**` - compiled filter and hostlist outputs
- `userscripts/dist/**` - built userscripts
- `dist/**` - workflow-generated userscript artifacts

## Repository-specific rules

1. Read the file you are changing before editing it.
2. Use `rg` to find existing rules, domains, selectors, scripts, or workflow references before adding new ones.
3. Prefer changing hand-authored source files over generated outputs.
4. Keep changes surgical; do not clean up unrelated code.
5. Match the existing style of the touched file.
6. Preserve comments and metadata blocks unless the task requires changing them.
7. When working on filter rules, avoid duplicates and group related rules together.
8. When working on userscripts, edit `userscripts/src` and treat `userscripts/dist` as generated output.
9. When working on build or CI logic, check both `Scripts/build.sh` and the relevant workflow files.
10. If a task mentions Claude guidance, update `AGENTS.md` and keep `CLAUDE.md` as a symlink to it.

## Important path clarifications

- Human-authored filter content lives in `lists/adblock/` and `lists/hostlist/`.
- The custom build script reads normalized inputs from `lists/sources/` and writes outputs to `lists/releases/`.
- `Scripts/update_lists.py` also writes into `lists/sources/`, so treat
  that directory as pipeline-managed unless the task is specifically about
  the update pipeline.
- Userscripts are built from `userscripts/src/` into `userscripts/dist/`.
- Some workflows also write temporary or published artifacts under the repository-root `dist/` directory.
- `userscripts/todo/` is work-in-progress content and is excluded from the normal userscript lint/build flow.

## Commands

### Setup

```bash
mise install && bun install && uv sync
```

### Core commands

```bash
bun run build
bun run build:adblock
bun run build:hosts
bun run build:userscripts
bun run lint
bun run test
bun run validate
```

### File-type specific checks

```bash
bun run lint:js
bun run lint:filters
bun run lint:md
bun run lint:yaml
bun run lint:shell
bun run format
bun run format:check
uv run ruff check .
uv run ruff format --check .
```

## Build and validation expectations

- `bun run lint` covers JavaScript, filter lists, and Markdown.
- `bun run test` runs `lint` plus `format:check`.
- `bun run validate` runs `test` plus `build`.
- YAML, shell, and Python checks are separate and should be run when you touch those file types.
- If the environment lacks Bun, use the closest existing project tooling
  available, but do not invent new validation steps.

## Style conventions

### JavaScript

- 2-space indentation
- Double quotes
- Semicolons required
- Prefer `const` over `let`; never use `var`
- Use strict equality

### Python

- Python 3.13+
- `ruff` for linting and formatting
- Use `snake_case.py`
- Internal imports use the `Scripts` package namespace when applicable

### Shell

- Use Bash
- Start scripts with strict mode such as `set -Eeuo pipefail` or existing repo equivalent
- Quote variables
- Prefer `[[ ... ]]`

### Filter rules

- One rule per line
- Use `!` comments
- Keep related rules grouped
- Check for duplicates with `rg` before adding rules

## Workflow notes

- CI workflows may auto-commit generated artifacts from `Filters/`, `lists/releases/`, `dist/`, and `userscripts/dist/`.
- Do not hand-edit those generated artifacts unless the task explicitly requires it.
- For workflow changes, review the matching files under `.github/workflows/` and any script they call.

## Commit and PR guidance

- Use conventional commit prefixes such as `feat:`, `fix:`, `docs:`, `ci:`, `refactor:`, `test:`, and `chore:`.
- Keep commit subjects concise.
- In PRs, explain the source files changed and mention generated outputs only if they were intentionally regenerated.
