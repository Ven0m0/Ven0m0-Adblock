#!/usr/bin/env bash
# shellcheck enable=all shell=bash source-path=SCRIPTDIR
set -euo pipefail; shopt -s nullglob globstar extglob
IFS=$'\n\t' LC_ALL=C

# ────────────────────────────────────────────────────────────────────
# BEGIN INLINED lib-common.sh (statically linked for portability)
# ────────────────────────────────────────────────────────────────────
readonly R=$'\e[31m' G=$'\e[32m' Y=$'\e[33m' B=$'\e[34m' C=$'\e[36m' N=$'\e[0m'
log(){ printf '%b[%s]%b %s\n' "$B" "${1:-info}" "$N" "${*:2}"; }
ok(){ printf '%b✓%b %s\n' "$G" "$N" "$*"; }
err(){ printf '%b✗%b %s\n' "$R" "$N" "$*" >&2; }
warn(){ printf '%b⚠%b %s\n' "$Y" "$N" "$*" >&2; }
dbg(){ [[ ${DEBUG:-0} == 1 ]] && printf '%b[dbg]%b %s\n' "$C" "$N" "$*" >&2 || :; }
die(){ err "$@"; exit "${2:-1}"; }
has(){ command -v "$1" &>/dev/null; }
chk(){ has "$1" || die "$1 missing"; }
ncpu(){ nproc 2>/dev/null || echo 4; }
jsrun(){ has bun && echo "bunx --bun" || has npx && echo "npx -y" || echo ""; }
mktmp(){ mktemp -d "${TMPDIR:-/tmp}/${1:-tmp}.XXXXXX"; }
bak(){ [[ -f $1 ]] && cp "$1" "${1}.$(date +%s).bak"; }
ts_short(){ TZ=UTC printf '%(%Y%m%d%H%M)T\n' -1; }
ts_read(){ TZ=UTC printf '%(%Y-%m-%d %H:%M:%S UTC)T\n' -1; }
_cleanup_hooks=()
cleanup_add(){ _cleanup_hooks+=("$1"); }
cleanup_run(){ local h; for h in "${_cleanup_hooks[@]}"; do eval "$h" || :; done; }
trap cleanup_run EXIT INT TERM
# ────────────────────────────────────────────────────────────────────
# END INLINED lib-common.sh
# ────────────────────────────────────────────────────────────────────
#── Config ──
readonly REPO="${GITHUB_REPOSITORY:-Ven0m0/Ven0m0-Adblock}"
readonly FILTER_SRC="lists/sources"
readonly FILTER_OUT="lists/releases"
readonly SCRIPT_SRC="userscripts/src"
readonly SCRIPT_OUT="userscripts/dist"
readonly SCRIPT_LIST="userscripts/list.txt"
D=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
#── Tools (cached) ──
_FD= _RG= _PAR= _JOBS= _RUNNER=
fd(){ [[ -n $_FD ]] && echo "$_FD" || { _FD=$(has fd && echo fd || has fdfind && echo fdfind || echo find); echo "$_FD"; }; }
rg(){ [[ -n $_RG ]] && echo "$_RG" || { _RG=$(has rg && echo rg || echo grep); echo "$_RG"; }; }
par(){ [[ -n $_PAR ]] && echo "$_PAR" || { _PAR=$(has parallel && echo parallel || echo ""); echo "$_PAR"; }; }
jobs(){ [[ -n $_JOBS ]] && echo "$_JOBS" || { _JOBS=$(ncpu); echo "$_JOBS"; }; }
runner(){ [[ -n $_RUNNER ]] && echo "$_RUNNER" || { _RUNNER=$(jsrun); echo "$_RUNNER"; }; }
#── Adblock filter ──
build_adblock(){
  local -a src=(Combination*.txt Other.txt Reddit.txt Twitter.txt Youtube.txt Twitch.txt Spotify.txt Search-Engines.txt General.txt)
  local out=$FILTER_OUT/adblock.txt v ts rule_count
  log adblock "Building..."
  mkdir -p "$FILTER_OUT"
  v=$(ts_short) ts=$(ts_read)
  cat > "$out" <<EOF
[uBlock Origin]
! Title: Ven0m0's Adblock List
! Version: $v
! Last Modified: $ts
! Homepage: https://github.com/$REPO
! Syntax: uBlock Origin
EOF

  cd "$FILTER_SRC" || { err "Cannot access $FILTER_SRC"; return 1; }
  # Build array of existing files
  local -a ex=()
  local f
  for f in "${src[@]}"; do
    [[ -f $f ]] && ex+=("$f")
  done
  if (( ${#ex[@]} == 0 )); then
    err "No filter files found"
    return 1
  fi
  # Process: cat → filter → sort → dedupe (single pipeline)
  cat "${ex[@]}" | \
    "$(rg)" -v '^[[:space:]]*!|\[Adblock|^[[:space:]]*$' | sort -u >> "$OLDPWD/$out"
  cd "$OLDPWD"
  rule_count=$(wc -l < "$out")
  ok "$out ($rule_count rules)"
}

#── Hosts ──
build_hosts(){
  local -a src=(Other.txt)
  local out=$FILTER_OUT/hosts.txt ts
  log hosts "Building..."
  mkdir -p "$FILTER_OUT"
  ts=$(ts_read)
  cat > "$out" <<EOF
# Hostlist by $REPO
# Updated: $ts
EOF
  cd "$FILTER_SRC" || { err "Cannot access $FILTER_SRC"; return 1; }
  local -a ex=(); for f in "${src[@]}"; do [[ -f $f ]] && ex+=("$f"); done
  if (( ${#ex[@]} > 0 )); then
    cat "${ex[@]}" | "$(rg)" -io '[a-z0-9][-a-z0-9]{0,61}(\.[a-z0-9][-a-z0-9]{0,61})+\.[a-z]{2,}' | \
      awk '{print "0.0.0.0",tolower($1)}' | LC_ALL=C sort -u >> "$OLDPWD/$out"
  else
    err "No host source files found"; return 1;
  fi
  cd "$OLDPWD"
  ok "$out ($(wc -l < "$out") hosts)"
}
#── AGLint ──
setup_aglint(){
  [[ -f package.json ]] || npm init -y
  npm list @adguard/aglint &>/dev/null || npm i -D @adguard/aglint
  [[ -f .aglintrc.yaml ]] || npx aglint init
  local s; s=$(npm pkg get scripts.lint 2>/dev/null || echo '""')
  [[ $s == '""' || $s == "undefined" ]] && npm pkg set scripts.lint=aglint
  log aglint "Running..."
  npm run lint
}
#── Hostlist compiler ──
build_hostlist(){
  has hostlist-compiler || npm i -g @adguard/hostlist-compiler
  log hostlist "Compiling..."
  mkdir -p "$FILTER_OUT"
  [[ -f hostlist-config.json ]] && hostlist-compiler -c hostlist-config.json -o "$FILTER_OUT/hostlist.txt" --verbose
  [[ -f configuration_popup_filter.json ]] && {
    hostlist-compiler -c configuration_popup_filter.json -o "$FILTER_OUT/adguard_popup_filter.txt" --verbose
    [[ -f scripts/popup_filter_build.js ]] && node scripts/popup_filter_build.js "$FILTER_OUT/adguard_popup_filter.txt"
  }
}
#── Userscripts: download from List ──
download_userscripts(){
  [[ ! -f $SCRIPT_LIST ]] && { log dl "No $SCRIPT_LIST found, skipping"; return 0; }
  log dl "Processing $SCRIPT_LIST..."
  mkdir -p "$SCRIPT_SRC"
  local line url fn base suffix
  while IFS= read -r line; do
    [[ -z $line || $line == \#* ]] && continue
    url=$("$(rg)" -o 'https://[^[:space:]]+\.user\.js' <<< "$line" | head -n1)
    [[ -z $url ]] && continue
    fn=$(basename "$url" | tr -cd '[:alnum:]._-')
    [[ $fn != *.user.js ]] && fn="${fn}.user.js"
    if [[ -f $SCRIPT_SRC/$fn ]]; then
      suffix=A
      while [[ -f $SCRIPT_SRC/$suffix$fn ]]; do
        suffix=$(echo "$suffix" | tr "0-9A-Z" "1-9A-Z_")
      done
      fn="$suffix$fn"
    fi
    log dl "$fn ← $url"
    curl -fsSL -A "Mozilla/5.0 (Android 14; Mobile; rv:138.0) Gecko/138.0 Firefox/138.0" \
      -H "Content-Type: application/octet-stream" \
      -H "Accept-Language: en-US,en;q=0.9" \
      -H "Connection: keep-alive" \
      -H "Cache-Control: max-age=0" \
      -m 30 "$url" -o "$SCRIPT_SRC/$fn" || err "Failed: $url"
  done < "$SCRIPT_LIST"
  ok "Downloaded to $SCRIPT_SRC/"
}
#── Userscripts: process ──
_process_js(){
  local f=$1 fn base meta code js len orig_size
  fn=${f##*/}
  base=${fn%.user.js}
  [[ $fn != *.user.js ]] && base=${fn%.*}
  # Extract metadata block (from first marker to last marker)
  meta=$(sed -n '/^\/\/ ==UserScript==/,/^\/\/ ==\/UserScript==/p' "$f" | sed '$d')
  # Extract code (everything after last marker)
  code=$(sed -n '/^\/\/ ==\/UserScript==/,$p' "$f" | tail -n +2)
  [[ -z $meta || -z $code ]] && { err "$fn (no meta/code block)"; return 1; }
  # Update URLs in metadata (single pass)
  meta=$(sed -E \
    -e '/^\/\/ @(name|description):/!b;/:en/!d' \
    -e "s|^(// @downloadURL).*|\1 https://raw.githubusercontent.com/$REPO/main/$SCRIPT_OUT/$base.user.js|" \
    -e "s|^(// @updateURL).*|\1 https://raw.githubusercontent.com/$REPO/main/$SCRIPT_OUT/$base.meta.js|" \
    <<< "$meta")
  # Minify with esbuild
  js=$("$(runner)" esbuild --minify --target=es2022 --format=iife --platform=browser --log-level=error <<< "$code" 2>&1) || {
    err "$fn (esbuild failed)"
    return 1
  }
  len=${#js}
  (( len < 100 )) && { err "$fn ($len bytes, suspiciously small)"; return 1; }
  # Write outputs
  printf '%s\n' "$meta" > "$SCRIPT_OUT/$base.meta.js"
  printf '%s\n%s\n' "$meta" "$js" > "$SCRIPT_OUT/$base.user.js"
  orig_size=$(wc -c < "$f")
  ok "$fn → $base.user.js ($orig_size → $len bytes)"
}
build_userscripts(){
  [[ -z $(runner) ]] && { err "No JS runtime (bun/npx)"; return 1; }
  mkdir -p "$SCRIPT_SRC" "$SCRIPT_OUT"
  local -a files=()
  [[ $(fd) == *fd* ]] && mapfile -t files < <("$(fd)" -e js -t f . "$SCRIPT_SRC" 2>/dev/null) || \
    mapfile -t files < <(find "$SCRIPT_SRC" -type f -name "*.js" 2>/dev/null)
  (( ${#files[@]} == 0 )) && { log userscripts "No files in $SCRIPT_SRC"; return 0; }
  log userscripts "Processing ${#files[@]} files..."
  has eslint && eslint --fix --quiet --no-warn-ignored "${files[@]}" 2>/dev/null || :
  export -f _process_js ok err; export REPO SCRIPT_OUT R G N
  local rn; rn=$(runner); export RUNNER=$rn
  [[ -n $(par) ]] && (( ${#files[@]} > 1 )) && printf '%s\n' "${files[@]}" | "$(par)" -j "$(jobs)" --bar _process_js {} 2>/dev/null || \
    { for f in "${files[@]}"; do _process_js "$f" || :; done; }
  [[ -f $SCRIPT_LIST ]] && cp "$SCRIPT_LIST" "$SCRIPT_OUT/README.md"
  ok "$(find "$SCRIPT_OUT" -name "*.user.js" -type f 2>/dev/null | wc -l) scripts → $SCRIPT_OUT/"
}
#── Main ──
usage(){ cat <<EOF
Usage: ${0##*/} [task]
Tasks:
  adblock       Build adblock filter
  hosts         Build hosts file
  hostlist      Compile hostlist
  aglint        Lint filter lists
  download      Download userscripts from List
  userscripts   Process userscripts (download+build)
  all           Run all tasks
EOF
}
main(){
  case ${1:-all} in
    adblock) build_adblock;;
    hosts) build_hosts;;
    hostlist) build_hostlist;;
    aglint) setup_aglint;;
    download) download_userscripts;;
    userscripts) download_userscripts; build_userscripts;;
    all) build_adblock; build_hosts; download_userscripts; build_userscripts; ok "All done";;
    -h|--help|help) usage;;
    *) err "Unknown: $1"; usage >&2; exit 1;;
  esac
}
main "$@"
