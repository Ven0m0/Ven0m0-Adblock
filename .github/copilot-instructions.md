# GitHub Copilot Instructions

`AGENTS.md` is the canonical long-form guide for this repository. Read it first.

## Project focus

Ad-blocking filter lists, hostlists, userscripts, and the CI workflows and scripts that build them.

## Edit these by hand

- `lists/adblock/` — adblock filter rules
- `lists/hostlist/` — DNS hostlist rules
- `userscripts/src/` — userscript source files
- `Scripts/` — Python build and maintenance tooling
- Config files at repo root: `package.json`, `mise.toml`, `pyproject.toml`, `.aglintrc.yml`, `.oxlintrc.json`, `biome.json`
- Workflow files under `.github/workflows/` when the task requires it

## CI-managed paths — edit source files instead

The following are written by CI and absent from a fresh checkout:
`lists/sources/`, `lists/external/`, `lists/releases/`, `Filters/`, `userscripts/dist/`, `dist/`

## Repo rules

- Read files before editing them.
- Use `rg` to find existing rules, domains, selectors, and references before adding new ones.
- Keep changes small and task-focused.
- Match existing file style and file metadata conventions.
- Avoid duplicate filter rules.
- Treat `userscripts/todo/` as out of scope for the lint and build pipeline.
- Keep `CLAUDE.md` as a symlink to `AGENTS.md`.

## Path clarifications

- Human-maintained filter rules live in `lists/adblock/` and `lists/hostlist/`.
- `Scripts/build.py` and CI build from normalized inputs in `lists/sources/`.
- Userscripts build from `userscripts/src/` into the dist output directory.

## Commands

```bash
mise install && bun install && uv sync
bun run lint
bun run test
bun run validate
bun run build:adblock
bun run build:hosts
bun run build:userscripts
yamllint .
uv run ruff check .
uv run ruff format --check .
```
