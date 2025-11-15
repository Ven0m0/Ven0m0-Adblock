#!/usr/bin/env bash
# ==============================================================================
# SHARED BASH UTILITIES LIBRARY
# ==============================================================================
# Common functions and utilities for bash scripts in this project
# Source this file in other scripts: source "$(dirname "$0")/lib-common.sh"
# ==============================================================================
set -euo pipefail
shopt -s nullglob globstar
# ==============================================================================
# COLORS
# ==============================================================================
readonly RED=$'\e[31m'
readonly GREEN=$'\e[32m'
readonly YELLOW=$'\e[33m'
readonly BLUE=$'\e[34m'
readonly CYAN=$'\e[36m'
readonly RESET=$'\e[0m'
# ==============================================================================
# LOGGING FUNCTIONS
# ==============================================================================
log_info(){ printf '%b[info]%b %s\n' "$BLUE" "$RESET" "$*"; }
log_success(){ printf '%b✓%b %s\n' "$GREEN" "$RESET" "$*"; }
log_error(){ printf '%b✗%b %s\n' "$RED" "$RESET" "$*" >&2; }
log_warn(){ printf '%b⚠%b %s\n' "$YELLOW" "$RESET" "$*" >&2; }
log_debug(){ [[ ${DEBUG:-0} == 1 ]] && printf '%b[debug]%b %s\n' "$CYAN" "$RESET" "$*" >&2; }

# ==============================================================================
# COMMAND CHECKING
# ==============================================================================
# Check if command exists
check_cmd(){ command -v "$1" &>/dev/null || { log_error "Required command '$1' not found"; return 1; }; }
# Check if command exists, install if not (npm packages)
ensure_npm_global(){
  local pkg="$1"
  local cmd="${2:-$pkg}"
  if ! command -v "$cmd" &>/dev/null; then
    log_info "Installing $pkg globally..."
    bun i -g "$pkg" || {
      log_error "Failed to install $pkg"; return 1
    }
  fi
}

# ==============================================================================
# SYSTEM DETECTION
# ==============================================================================
# Get number of CPU cores
get_cpu_cores(){ nproc 2>/dev/null || echo 4; }

# Detect JS runtime (bun, node, or none)
detect_js_runtime(){
  if command -v bun &>/dev/null; then
    echo "bunx --bun"
  elif command -v npx &>/dev/null; then
    echo "npx -y"
  else
    echo ""
  fi
}

# ==============================================================================
# FILE OPERATIONS
# ==============================================================================
# Create directory with error handling
safe_mkdir(){ mkdir -p "$@" || { log_error "Failed to create directory: $*"; return 1; }; }

# Backup file with timestamp
backup_file(){
  local file="$1"
  local backup_dir="${2:-.backups}"
  [[ -f $file ]] || return 0
  safe_mkdir "$backup_dir"
  local ts=$(date +%Y%m%d_%H%M%S)
  local basename="${file##*/}"
  cp "$file" "$backup_dir/${basename}.${ts}" && log_success "Backed up: $file → $backup_dir/${basename}.${ts}"
}

# Safe file write with atomic operation
safe_write(){
  local content="$1" dest="$2" tmp
  tmp=$(mktemp) || return 1
  printf '%s\n' "$content" > "$tmp" || return 1
  mv "$tmp" "$dest" || return 1
}

# ==============================================================================
# STRING OPERATIONS
# ==============================================================================
# Trim whitespace from string
trim(){
  local var="$*"
  var="${var#"${var%%[![:space:]]*}"}"
  var="${var%"${var##*[![:space:]]}"}"
  printf '%s' "$var"
}
# Convert string to lowercase
lowercase(){ printf '%s' "$*" | tr '[:upper:]' '[:lower:]'; }
# Convert string to uppercase
uppercase(){ printf '%s' "$*" | tr '[:lower:]' '[:upper:]'; }

# ==============================================================================
# TIMESTAMP FUNCTIONS
# ==============================================================================
timestamp_short(){ date -u +"%Y%m%d%H%M"; }
timestamp_readable(){ date -u +"%Y-%m-%d %H:%M:%S UTC"; }
timestamp_unix(){ date +%s; }

# ==============================================================================
# PERFORMANCE HELPERS
# ==============================================================================
# Time a command execution
time_cmd(){
  local start end elapsed
  start=$(date +%s%N 2>/dev/null || date +%s)
  "$@"
  local ret="$?"
  end=$(date +%s%N 2>/dev/null || date +%s)
  elapsed=$(( (end - start) / 1000000 ))
  log_debug "Execution time: ${elapsed}ms"
  return "$ret"
}
# Check if parallel processing is available
can_parallel(){ command -v parallel &>/dev/null && [[ ${1:-1} -gt 1 ]]; }

# ==============================================================================
# CLEANUP HANDLERS
# ==============================================================================
# Register cleanup function
cleanup_handlers=()
register_cleanup(){ cleanup_handlers+=("$1"); }
# Execute all cleanup handlers
run_cleanup(){ local handler; for handler in "${cleanup_handlers[@]}"; do eval "$handler"; done; }
# Trap cleanup on exit
trap run_cleanup EXIT INT TERM

# ==============================================================================
# VALIDATION
# ==============================================================================
# Check if string is a valid URL
is_url(){ [[ $1 =~ ^https?:// ]]; }
# Check if file is executable
is_executable(){ [[ -x $1 ]]; }
# Check if running as root
is_root(){ [[ $EUID -eq 0 ]]; }

# ==============================================================================
# EXPORTS
# ==============================================================================
# Export commonly used functions and variables
export -f log_info log_success log_error log_warn log_debug
export -f check_cmd ensure_npm_global get_cpu_cores detect_js_runtime
export -f safe_mkdir backup_file safe_write trim
export -f timestamp_short timestamp_readable timestamp_unix
export RED GREEN YELLOW BLUE CYAN RESET
