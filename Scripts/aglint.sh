#!/bin/bash
# https://github.com/AdguardTeam/AGLint
# OPTIMIZED: Better error handling and logging

set -euo pipefail

# Source shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$SCRIPT_DIR/lib-common.sh" ]] && source "$SCRIPT_DIR/lib-common.sh" || {
  log_info() { printf '[info] %s\n' "$*"; }
  log_success() { printf '✓ %s\n' "$*"; }
  log_error() { printf '✗ %s\n' "$*" >&2; }
}

# Only initialize if package.json doesn't exist
if [[ ! -f package.json ]]; then
  log_info "Initializing npm package..."
  npm init -y
fi

# Only install if not already present
if ! npm list @adguard/aglint >/dev/null 2>&1; then
  log_info "Installing @adguard/aglint..."
  npm install -D @adguard/aglint || {
    log_error "Failed to install @adguard/aglint"
    exit 1
  }
fi

# Only initialize aglint if config doesn't exist
if [[ ! -f .aglintrc.yaml ]]; then
  log_info "Initializing aglint config..."
  npx aglint init
fi

# Set lint script if not already set
lint_script=$(npm pkg get scripts.lint 2>/dev/null || echo '""')
if [[ -z $lint_script || $lint_script == '""' || $lint_script == "undefined" ]]; then
  log_info "Setting lint script in package.json..."
  npm pkg set scripts.lint="aglint"
fi

log_info "Running aglint..."
npm run lint

# Precommit - only if not already configured
if [[ ! -d .husky ]]; then
  log_info "Setting up Husky pre-commit hook..."

  if ! npm list husky >/dev/null 2>&1; then
    npm install -D husky
  fi

  npx husky init
  printf 'npx aglint\n' > .husky/pre-commit
  chmod +x .husky/pre-commit

  log_success "Husky pre-commit hook configured"
fi

log_success "AGLint setup and execution complete"
