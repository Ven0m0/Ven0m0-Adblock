# GitHub Copilot Instructions

Use `/AGENTS.md` as the canonical long-form guide for this repository.

## Project focus

This repository maintains ad-blocking filter lists, hostlists, userscripts, and the scripts/workflows that build them.

## Edit these by hand

- `lists/adblock/*.txt`
- `lists/hostlist/*.txt`
- `userscripts/src/*.user.js`
- `Scripts/*.sh`
- `Scripts/*.py`
- Relevant config or workflow files for the task

## Do not hand-edit generated paths

- `lists/sources/**`
- `lists/external/**`
- `lists/releases/**`
- `Filters/**`
- `userscripts/dist/**`
- `dist/**`

## Repo rules

- Read files before editing them.
- Use `rg` to find existing rules, domains, selectors, and references before adding new ones.
- Prefer source changes over generated-file changes.
- Keep changes small and task-focused.
- Match existing file style and metadata/header conventions.
- Avoid duplicate filter rules.
- Treat `userscripts/todo/` as out of scope for normal lint/build work.
- Keep `CLAUDE.md` as a symlink to `AGENTS.md`.

## Path clarifications

- Human-maintained filter rules live in `lists/adblock/` and `lists/hostlist/`.
- `Scripts/build.sh` and parts of CI build from normalized inputs in `lists/sources/`.
- Userscripts build from `userscripts/src/` to `userscripts/dist/`.
- Some workflows also publish artifacts under the repo-root `dist/` directory.

## Commands

```bash
mise install && bun install && uv sync
bun run lint
bun run test
bun run validate
bun run build:adblock
bun run build:hosts
bun run build:userscripts
bun run lint:yaml
bun run lint:shell
uv run ruff check .
uv run ruff format --check .
```
