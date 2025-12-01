#!/usr/bin/env bash
set -euo pipefail; shopt -s nullglob globstar extglob
IFS=$'\n\t'; export LC_ALL=C LANG=C
#── Config ──
readonly REPO="${GITHUB_REPOSITORY:-Ven0m0/Ven0m0-Adblock}"
readonly FILTER_SRC="lists/sources"
readonly FILTER_OUT="lists/releases"
readonly SCRIPT_SRC="userscripts/src"
readonly SCRIPT_OUT="userscripts/dist"
readonly SCRIPT_LIST="userscripts/list.txt"
#── Load lib ──
D=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
[[ -f $D/lib-common.sh ]] && . "$D/lib-common.sh" || {
  R=$'\e[31m' G=$'\e[32m' Y=$'\e[33m' B=$'\e[34m' N=$'\e[0m'
  ok(){ printf '%b✓%b %s\n' "$G" "$N" "$*"; }
  err(){ printf '%b✗%b %s\n' "$R" "$N" "$*" >&2; }
  log(){ printf '%b[%s]%b %s\n' "$B" "${1:-i}" "$N" "${*:2}"; }
  has(){ command -v "$1" &>/dev/null; }
  ts_short(){ date -u +%Y%m%d%H%M; }
  ts_read(){ date -u '+%Y-%m-%d %H:%M:%S UTC'; }
  ncpu(){ nproc 2>/dev/null || echo 4; }
  jsrun(){ has bun && echo "bunx --bun" || has npx && echo "npx -y" || echo ""; }
}
#── Tools (cached) ──
_FD= _RG= _PAR= _JOBS= _RUNNER=
fd(){ [[ -n $_FD ]] && echo "$ _FD" || { _FD=$(has fd && echo fd || has fdfind && echo fdfind || echo find); echo "$ _FD"; }; }
rg(){ [[ -n $_RG ]] && echo "$ _RG" || { _RG=$(has rg && echo rg || echo grep); echo "$ _RG"; }; }
par(){ [[ -n $_PAR ]] && echo "$ _PAR" || { _PAR=$(has parallel && echo parallel || echo ""); echo "$ _PAR"; }; }
jobs(){ [[ -n $_JOBS ]] && echo "$ _JOBS" || { _JOBS=$(ncpu); echo "$ _JOBS"; }; }
runner(){ [[ -n $_RUNNER ]] && echo "$ _RUNNER" || { _RUNNER=$(jsrun); echo "$ _RUNNER"; }; }

#── Adblock filter ──
build_adblock(){
  local -a src=(Combination*.txt Other.txt Reddit.txt Twitter.txt Youtube.txt Twitch.txt Spotify.txt Search-Engines.txt General.txt)
  local out=$FILTER_OUT/adblock.txt v ts
  log adblock "Building..."
  mkdir -p "$FILTER_OUT"
  v=$(ts_short); ts=$(ts_read)
  cat > "$out" <<EOF
[Adblock Plus 2.0]
! Title: Ven0m0's Adblock List
! Version: $v
! Last Modified: $ts
! Homepage: https://github.com/$REPO
! Syntax: Adblock Plus 2.0
EOF
  cd "$FILTER_SRC" || { err "Cannot access $FILTER_SRC"; return 1; }
  local -a ex=(); for f in "${src[@]}"; do [[ -f $f ]] && ex+=("$f"); done
  if (( ${#ex[@]} > 0 )); then
    cat "${ex[@]}" | $(rg) -v '^[[:space:]]*!|\[Adblock|^[[:space:]]*$' | LC_ALL=C sort -u >> "$OLDPWD/$out"
  else
    err "No filter files found"; return 1;
  fi
  cd "$OLDPWD"
  ok "$out ($(wc -l < "$out") rules)"
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
    cat "${ex[@]}" | $(rg) -io '[a-z0-9][-a-z0-9]{0,61}(\.[a-z0-9][-a-z0-9]{0,61})+\.[a-z]{2,}' | \
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
  [[ -d .husky ]] || {
    npm list husky &>/dev/null || npm i -D husky
    npx husky init
    echo 'npx aglint' > .husky/pre-commit
    chmod +x .husky/pre-commit
  }
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
    url=$($(rg) -o 'https://[^[:space:]]+\.user\.js' <<< "$line" | head -n1)
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
  local f=$1 fn base meta code js len
  fn=${f##*/}; base=${fn%.user.js}; [[ $fn != *.user.js ]] && base=${fn%.*}
  meta=$(sed -n '/^\/\/ ==UserScript==/,/^\/\/ ==\/UserScript==/p' "$f" | sed '$d')
  code=$(sed -n '/^\/\/ ==\/UserScript==/,$p' "$f" | tail -n +2)
  [[ -z $meta || -z $code ]] && { err "$fn (no meta/code block)"; return 1; }
  meta=$(sed -E '/^\/\/ @(name|description):/!b;/:en/!d' <<< "$meta" | \
    sed -E "s|^(// @downloadURL).*|\1 https://raw.githubusercontent.com/$REPO/main/$SCRIPT_OUT/$base.user.js|;\
s|^(// @updateURL).*|\1 https://raw.githubusercontent.com/$REPO/main/$SCRIPT_OUT/$base.meta.js|")
  js=$($(runner) esbuild --minify --target=es2022 --format=iife --platform=browser --log-level=error <<< "$code" 2>&1) || { err "$fn (esbuild)"; return 1; }
  len=${#js}; (( len < 100 )) && { err "$fn ($len bytes, too small)"; return 1; }
  printf '%s\n' "$meta" > "$SCRIPT_OUT/$base.meta.js"
  printf '%s\n%s\n' "$meta" "$js" > "$SCRIPT_OUT/$base.user.js"
  ok "$fn → $base.user.js ($(wc -c < "$f") → $len)"
}

build_userscripts(){
  [[ -z $(runner) ]] && { err "No JS runtime (bun/npx)"; return 1; }
  mkdir -p "$SCRIPT_SRC" "$SCRIPT_OUT"
  local -a files=()
  [[ $(fd) == *fd* ]] && mapfile -t files < <($(fd) -e js -t f . "$SCRIPT_SRC" 2>/dev/null) || \
    mapfile -t files < <(find "$SCRIPT_SRC" -type f -name "*.js" 2>/dev/null)
  (( ${#files[@]} == 0 )) && { log userscripts "No files in $SCRIPT_SRC"; return 0; }
  log userscripts "Processing ${#files[@]} files..."
  has eslint && eslint --fix --quiet --no-warn-ignored "${files[@]}" 2>/dev/null || :
  export -f _process_js ok err; export REPO SCRIPT_OUT R G N
  local rn; rn=$(runner); export RUNNER=$rn
  [[ -n $(par) ]] && (( ${#files[@]} > 1 )) && printf '%s\n' "${files[@]}" | $(par) -j "$(jobs)" --bar _process_js {} 2>/dev/null || \
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
