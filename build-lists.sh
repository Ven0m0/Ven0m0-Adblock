#!/usr/bin/env bash
set -Eeuo pipefail
shopt -s nullglob globstar
IFS=$'\n\t'
export LC_ALL=C LANG=C

readonly BIN="${HOME}/.local/bin"
readonly SRC="lists/sources"
readonly OUT="lists/releases"

declare -rA TOOLS=(
  [aglint]="https://github.com/AdguardTeam/AGLint/releases/latest/download/aglint-linux-amd64"
  [hostlist-compiler]="https://github.com/AdguardTeam/HostlistCompiler/releases/latest/download/HostlistCompiler-linux-amd64"
  [kompressor]="https://github.com/m0zgen/kompressor/releases/latest/download/kompressor-x86_64-unknown-linux-musl"
)

ensure_tool() {
  local -r name=$1 url=$2 dest="${BIN}/${name}"
  [[ -x $dest ]] && return 0
  printf '  -> Installing %s\n' "$name" >&2
  mkdir -p "$BIN"
  curl -sfL "$url" -o "$dest"
  chmod +x "$dest"
}

# Use mise-managed PATH if available, fallback to manual install
if command -v mise &>/dev/null; then
  eval "$(mise activate bash --shims)"
fi

export PATH="${BIN}:${PATH}"
mkdir -p "$OUT"

for tool in "${!TOOLS[@]}"; do
  ensure_tool "$tool" "${TOOLS[$tool]}"
done

printf '[1/2] Building Adblock...\n'
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
cat "$SRC"/*.txt > "$tmp"
aglint "$tmp" &>/dev/null || :
kompressor < "$tmp" > "${OUT}/adblock.txt"

printf '[2/2] Building Hostlist...\n'
hostlist-compiler -c hostlist-config. json &>/dev/null

printf 'Done.\n'
