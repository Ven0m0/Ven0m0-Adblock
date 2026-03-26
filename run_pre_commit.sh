#!/usr/bin/env bash
# Run pre-commit hooks via prek
# Usage: ./run_pre_commit.sh [--all-files]
set -Eeuo pipefail

if command -v uv >/dev/null 2>&1; then
  uv run prek run "${@}"
else
  # Fallback: run checks manually if uv/prek is unavailable
  python3 -m unittest discover -s Scripts/ -p 'test_*.py'
fi
