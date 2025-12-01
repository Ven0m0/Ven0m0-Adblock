#!/usr/bin/env bash -euo pipefail
shopt -s nullglob globstar
IFS=$'\n\t'; export LC_ALL=C LANG=C
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
  [[ -f $dest ]] && return 0
  printf '  -> Installing %s\n' "$name"
  mkdir -p "$BIN"
  curl -sfL "$url" -o "$dest"
  chmod +x "$dest"
}
export PATH="${BIN}:${PATH}"
mkdir -p "$OUT"
for tool in "${!TOOLS[@]}"; do
  ensure_tool "$tool" "${TOOLS[$tool]}"
done
# Adblock
printf '[1/2] Building Adblock...\n'
tmp=$(mktemp)
cat "$SRC"/*.txt > "$tmp"
aglint "$tmp" &>/dev/null || :
kompressor < "$tmp" > "${OUT}/adblock.txt"
rm "$tmp"
# Hostlist
printf '[2/2] Building Hostlist...\n'
hostlist-compiler -c hostlist-config.json &>/dev/null
printf 'Done.\n'
