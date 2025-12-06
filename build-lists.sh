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

ensure_tool(){
  local -r name=$1 url=$2 dest="${BIN}/${name}"
  [[ -x $dest ]] && return 0
  printf '  -> Installing %s\n' "$name" >&2
  mkdir -p "$BIN" || { printf 'Failed to create %s\n' "$BIN" >&2; return 1; }
  curl -sfL "$url" -o "$dest" || { printf 'Failed to download %s\n' "$name" >&2; return 1; }
  chmod +x "$dest" || { printf 'Failed to make %s executable\n' "$name" >&2; return 1; }
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
tmp=$(mktemp) || { printf 'Failed to create temp file\n' >&2; exit 1; }
trap 'rm -f "$tmp"' EXIT INT TERM

shopt -s nullglob
files=("$SRC"/*.txt)
(( ${#files[@]} == 0 )) && { printf 'No source files in %s\n' "$SRC" >&2; exit 1; }
cat "${files[@]}" > "$tmp" || { printf 'Failed to concatenate sources\n' >&2; exit 1; }

aglint "$tmp" &>/dev/null || :
kompressor < "$tmp" > "${OUT}/adblock.txt" || { printf 'Compression failed\n' >&2; exit 1; }

printf '[2/2] Building Hostlist...\n'
[[ -f hostlist-config.json ]] || { printf 'Missing hostlist-config.json\n' >&2; exit 1; }
hostlist-compiler -c hostlist-config.json &>/dev/null || { printf 'Hostlist compilation failed\n' >&2; exit 1; }

printf 'Done.\n'
