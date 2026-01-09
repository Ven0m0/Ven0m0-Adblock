#!/usr/bin/env bash
# Common library functions for Ven0m0-Adblock scripts
# Provides logging, error handling, utility functions, and cleanup hooks
# shellcheck shell=bash

# Prevent multiple sourcing
[[ ${_LIB_COMMON_SOURCED:-} == 1 ]] && return 0
readonly _LIB_COMMON_SOURCED=1

# ============================================================================
# ANSI COLOR CODES
# ============================================================================
readonly R=$'\e[31m' G=$'\e[32m' Y=$'\e[33m' B=$'\e[34m' C=$'\e[36m' N=$'\e[0m'

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================
log() { printf '%b[%s]%b %s\n' "$B" "${1:-info}" "$N" "${*:2}"; }
ok() { printf '%b✓%b %s\n' "$G" "$N" "$*"; }
err() { printf '%b✗%b %s\n' "$R" "$N" "$*" >&2; }
warn() { printf '%b⚠%b %s\n' "$Y" "$N" "$*" >&2; }
dbg() { [[ ${DEBUG:-0} == 1 ]] && printf '%b[dbg]%b %s\n' "$C" "$N" "$*" >&2 || :; }
die() { err "$@"; exit "${2:-1}"; }

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================
has() { command -v "$1" &>/dev/null; }
chk() { has "$1" || die "$1 missing"; }
ncpu() { nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4; }
jsrun() { has bun && echo "bunx --bun" || has npx && echo "npx -y" || echo ""; }
mktmp() { mktemp -d "${TMPDIR:-/tmp}/${1:-tmp}.XXXXXX"; }
bak() { [[ -f $1 ]] && cp "$1" "${1}.$(date +%s).bak"; }

# ============================================================================
# TIMESTAMP FUNCTIONS
# ============================================================================
ts_short() { TZ=UTC printf '%(%Y%m%d%H%M)T\n' -1; }
ts_read() { TZ=UTC printf '%(%Y-%m-%d %H:%M:%S UTC)T\n' -1; }

# ============================================================================
# CLEANUP HOOKS
# ============================================================================
_cleanup_hooks=()
cleanup_add() { _cleanup_hooks+=("$1"); }
cleanup_run() { local h; for h in "${_cleanup_hooks[@]}"; do eval "$h" || :; done; }
trap cleanup_run EXIT INT TERM
