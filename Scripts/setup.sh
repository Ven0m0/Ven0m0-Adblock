#!/usr/bin/env bash
# shellcheck enable=all shell=bash source-path=SCRIPTDIR
set -euo pipefail; shopt -s nullglob globstar
IFS=$'\n\t' LC_ALL=C
readonly SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib-common.sh
.  "${SCRIPT_DIR}/lib-common.sh"

readonly PACKAGES=(
  "@adguard/aglint"
  "@adguard/hostlist-compiler"
  "@adguard/dead-domains-linter"
)

setup_mise(){
  log mise "Installing packages"
  has bun && export MISE_NPM_BUN=true
  for pkg in "${PACKAGES[@]}"; do
    mise use -g "npm: ${pkg}" || warn "Failed:  $pkg"
  done
  mise up -y && mise reshim
}

setup_bun(){
  log bun "Installing packages"
  for pkg in "${PACKAGES[@]}"; do
    bun i -g "$pkg" || warn "Failed: $pkg"
  done
}

setup_npm(){
  log npm "Installing packages"
  for pkg in "${PACKAGES[@]}"; do
    npm i -g "$pkg" || warn "Failed: $pkg"
  done
}

setup_esbuild(){
  has esbuild && return 0
  log esbuild "Installing"
  npm install --save-exact --save-dev esbuild &>/dev/null || warn "esbuild install failed"
}

main(){
  if has mise; then
    setup_mise
  elif has bun; then
    setup_bun
  elif has npm; then
    setup_npm
  else
    die "No package manager found (mise/bun/npm required)"
  fi
  setup_esbuild
  ok "Setup complete"
}

main "$@"
