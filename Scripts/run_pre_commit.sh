#!/usr/bin/env bash
# Run pre-commit hooks via prek
# Usage: ./run_pre_commit.sh [--all-files]
set -Eeuo pipefail

uv run prek run "${@}"
