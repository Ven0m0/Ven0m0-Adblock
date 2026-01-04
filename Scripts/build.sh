#!/usr/bin/env bash
# shellcheck enable=all shell=bash source-path=SCRIPTDIR
set -euo pipefail; shopt -s nullglob globstar extglob
IFS=$'\n\t' LC_ALL=C
readonly SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib-common.sh
.  "${SCRIPT_DIR}/lib-common.sh"

readonly REPO="${GITHUB_REPOSITORY:-Ven0m0/Ven0m0-Adblock}"
readonly FILTER_SRC="lists/sources"
readonly FILTER_OUT="lists/releases"
readonly SCRIPT_SRC="userscripts/src"
readonly SCRIPT_OUT="userscripts/dist"
readonly SCRIPT_LIST="userscripts/list. txt"
readonly BIN="${HOME}/.local/bin"

declare -rA TOOLS=(
  [aglint]="https://github.com/AdguardTeam/AGLint/releases/latest/download/aglint-linux-amd64"
  [hostlist-compiler]="https://github.com/AdguardTeam/HostlistCompiler/releases/latest/download/HostlistCompiler-linux-amd64"
)

_FD= _RG= _PAR= _JOBS= _RUNNER=
fd(){ [[ -n $_FD ]] && echo "$_FD" || { _FD=$(has fd && echo fd || has fdfind && echo fdfind || echo find); echo "$_FD"; }; }
rg(){ [[ -n $_RG ]] && echo "$_RG" || { _RG=$(has rg && echo rg || echo grep); echo "$_RG"; }; }
par(){ [[ -n $_PAR ]] && echo "$_PAR" || { _PAR=$(has parallel && echo parallel || echo ""); echo "$_PAR"; }; }
jobs(){ [[ -n $_JOBS ]] && echo "$_JOBS" || { _JOBS=$(ncpu); echo "$_JOBS"; }; }
runner(){ [[ -n $_RUNNER ]] && echo "$_RUNNER" || { _RUNNER=$(jsrun); echo "$_RUNNER"; }; }

ensure_tool(){
  local -r name=$1 url=$2 dest="${BIN}/${name}"
  [[ -x $dest ]] && return 0
  log tool "Installing $name"
  mkdir -p "$BIN" || die "Cannot create $BIN"
  curl -fsSL "$url" -o "$dest" || die "Download failed:  $name"
  chmod +x "$dest" || die "chmod failed: $name"
}

setup_tools(){
  if has mise; then
    eval "$(mise activate bash --shims)" 2>/dev/null || :
  fi
  export PATH="${BIN}:${PATH}"
  for tool in "${! TOOLS[@]}"; do
    ensure_tool "$tool" "${TOOLS[$tool]}"
  done
}

build_adblock(){
  local -a src=(Combination*. txt Other.txt Reddit.txt Twitter.txt Youtube.txt Twitch.txt Spotify.txt Search-Engines.txt General.txt)
  local out=$FILTER_OUT/adblock.txt v ts rule_count
  log adblock "Building filter list"
  mkdir -p "$FILTER_OUT"
  v=$(ts_short) ts=$(ts_read)
  cat > "$out" <<EOF
[uBlock Origin]
!  Title:  Ven0m0's Adblock List
! Version: $v
! Last Modified: $ts
! Homepage: https://github.com/$REPO
! Syntax: uBlock Origin
EOF
  cd "$FILTER_SRC" || die "Cannot access $FILTER_SRC"
  local -a ex=() f
  for f in "${src[@]}"; do
    [[ -f $f ]] && ex+=("$f")
  done
  (( ${#ex[@]} == 0 )) && die "No filter source files found"
  cat "${ex[@]}" | "$(rg)" -v '^[[:space:]]*!|\|Adblock|^[[:space:]]*$' | LC_ALL=C sort -u >> "$OLDPWD/$out"
  cd "$OLDPWD"
  rule_count=$(wc -l < "$out")
  ok "$out ($rule_count rules)"
}

build_hosts(){
  local -a src=(Other.txt)
  local out=$FILTER_OUT/hosts.txt ts
  log hosts "Building hosts file"
  mkdir -p "$FILTER_OUT"
  ts=$(ts_read)
  cat > "$out" <<EOF
# Hostlist by $REPO
# Updated: $ts
EOF
  cd "$FILTER_SRC" || die "Cannot access $FILTER_SRC"
  local -a ex=() f
  for f in "${src[@]}"; do
    [[ -f $f ]] && ex+=("$f")
  done
  (( ${#ex[@]} == 0 )) && die "No host source files found"
  cat "${ex[@]}" | "$(rg)" -io '[a-z0-9][-a-z0-9]{0,61}(\.[a-z0-9][-a-z0-9]{0,61})+\.[a-z]{2,}' | \
    awk '{print "0.0.0.0",tolower($1)}' | LC_ALL=C sort -u >> "$OLDPWD/$out"
  cd "$OLDPWD"
  ok "$out ($(wc -l < "$out") entries)"
}

build_hostlist(){
  chk hostlist-compiler
  log hostlist "Compiling hostlist"
  mkdir -p "$FILTER_OUT"
  [[ -f hostlist-config.json ]] && {
    hostlist-compiler -c hostlist-config.json -o "$FILTER_OUT/hostlist.txt" --verbose || warn "Hostlist compilation failed"
  }
  [[ -f configuration_popup_filter.json ]] && {
    hostlist-compiler -c configuration_popup_filter.json -o "$FILTER_OUT/adguard_popup_filter.txt" --verbose || warn "Popup filter compilation failed"
    [[ -f scripts/popup_filter_build.js ]] && node scripts/popup_filter_build.js "$FILTER_OUT/adguard_popup_filter.txt" || : 
  }
}

lint_filters(){
  [[ -z $(runner) ]] && { warn "No JS runtime available, skipping lint"; return 0; }
  log lint "Setting up AGLint"
  [[ -f package.json ]] || npm init -y &>/dev/null
  npm list @adguard/aglint &>/dev/null || npm i -D @adguard/aglint &>/dev/null
  [[ -f .aglintrc.yaml ]] || npx aglint init &>/dev/null
  local s
  s=$(npm pkg get scripts. lint 2>/dev/null || echo '""')
  [[ $s == '""' || $s == "undefined" ]] && npm pkg set scripts.lint=aglint &>/dev/null
  npm run lint || warn "Lint found issues"
}

download_userscripts(){
  [[ ! -f $SCRIPT_LIST ]] && { log download "No $SCRIPT_LIST found, skipping"; return 0; }
  log download "Processing $SCRIPT_LIST"
  mkdir -p "$SCRIPT_SRC"
  local line url fn suffix
  while IFS= read -r line; do
    [[ -z $line || $line == \#* ]] && continue
    url=$("$(rg)" -o 'https://[^[: space:]]+\. user\.js' <<< "$line" | head -n1)
    [[ -z $url ]] && continue
    fn=$(basename "$url" | tr -cd '[:alnum:]._-')
    [[ $fn != *.user.js ]] && fn="${fn}.user.js"
    if [[ -f $SCRIPT_SRC/$fn ]]; then
      suffix=1
      while [[ -f $SCRIPT_SRC/${suffix}_${fn} ]]; do
        ((suffix++))
      done
      fn="${suffix}_${fn}"
    fi
    dbg "Downloading $fn from $url"
    curl -fsSL -A "Mozilla/5.0 (Android 14; Mobile; rv:138.0) Gecko/138.0 Firefox/138.0" \
      -H "Accept-Language: en-US,en;q=0.9" \
      -m 30 "$url" -o "$SCRIPT_SRC/$fn" || warn "Failed to download:  $url"
  done < "$SCRIPT_LIST"
  ok "Downloaded to $SCRIPT_SRC/"
}

_process_js(){
  local f=$1 fn base meta code js len orig_size
  fn=${f##*/}
  base=${fn%.user.js}
  [[ $fn != *.user.js ]] && base=${fn%.*}
  meta=$(sed -n '/^\/\/ ==UserScript==/,/^\/\/ ==\/UserScript==/p' "$f" | sed '$d')
  code=$(sed -n '/^\/\/ ==\/UserScript==/,$p' "$f" | tail -n +2)
  [[ -z $meta || -z $code ]] && { err "$fn (missing metadata or code block)"; return 1; }
  meta=$(sed -E \
    -e '/^\/\/ @(name|description):/!b;/: en/!d' \
    -e "s|^(// @downloadURL).*|\1 https://raw.githubusercontent.com/$REPO/main/$SCRIPT_OUT/$base. user.js|" \
    -e "s|^(// @updateURL).*|\1 https://raw.githubusercontent.com/$REPO/main/$SCRIPT_OUT/$base.meta.js|" \
    <<< "$meta")
  js=$("$(runner)" esbuild --minify --target=es2022 --format=iife --platform=browser --log-level=error <<< "$code" 2>&1) || {
    err "$fn (esbuild failed)"
    return 1
  }
  len=${#js}
  (( len < 50 )) && { err "$fn ($len bytes, suspiciously small)"; return 1; }
  printf '%s\n' "$meta" > "$SCRIPT_OUT/$base. meta.js"
  printf '%s\n%s\n' "$meta" "$js" > "$SCRIPT_OUT/$base.user.js"
  orig_size=$(wc -c < "$f")
  ok "$fn → $base.user.js ($orig_size → $len bytes)"
}

build_userscripts(){
  [[ -z $(runner) ]] && { warn "No JS runtime (bun/npx) found, skipping userscripts"; return 0; }
  mkdir -p "$SCRIPT_SRC" "$SCRIPT_OUT"
  local -a files=()
  [[ $(fd) == *fd* ]] && mapfile -t files < <("$(fd)" -e js -t f . "$SCRIPT_SRC" 2>/dev/null) || \
    mapfile -t files < <(find "$SCRIPT_SRC" -type f -name "*.js" 2>/dev/null)
  (( ${#files[@]} == 0 )) && { log userscripts "No files in $SCRIPT_SRC"; return 0; }
  log userscripts "Processing ${#files[@]} files"
  has eslint && eslint --fix --quiet --no-warn-ignored "${files[@]}" 2>/dev/null || : 
  export -f _process_js ok err warn
  export REPO SCRIPT_OUT R G Y N RUNNER
  RUNNER=$(runner)
  if [[ -n $(par) ]] && (( ${#files[@]} > 1 )); then
    printf '%s\n' "${files[@]}" | "$(par)" -j "$(jobs)" --bar _process_js {} 2>/dev/null || : 
  else
    for f in "${files[@]}"; do
      _process_js "$f" || : 
    done
  fi
  [[ -f $SCRIPT_LIST ]] && cp "$SCRIPT_LIST" "$SCRIPT_OUT/README.md"
  local count
  count=$(find "$SCRIPT_OUT" -name "*.user.js" -type f 2>/dev/null | wc -l)
  ok "$count scripts → $SCRIPT_OUT/"
}

usage(){
  cat <<EOF
Usage: ${0##*/} [TASK...]

Tasks:
  adblock       Build adblock filter list
  hosts         Build hosts file
  hostlist      Compile hostlist configs
  lint          Lint filter lists with AGLint
  download      Download userscripts from list
  userscripts   Process userscripts (download + build)
  all           Run all tasks (default)

Examples:
  ${0##*/}                    # Run all tasks
  ${0##*/} adblock lint       # Build adblock and lint
  ${0##*/} userscripts        # Download and process userscripts
EOF
}

main(){
  local -a tasks=("${@:-all}")
  [[ ${tasks[0]} =~ ^(-h|--help|help)$ ]] && { usage; exit 0; }
  setup_tools
  for task in "${tasks[@]}"; do
    case $task in
      adblock) build_adblock;;
      hosts) build_hosts;;
      hostlist) build_hostlist;;
      lint) lint_filters;;
      download) download_userscripts;;
      userscripts) download_userscripts; build_userscripts;;
      all) build_adblock; build_hosts; build_hostlist; download_userscripts; build_userscripts;;
      *) err "Unknown task: $task"; usage >&2; exit 1;;
    esac
  done
  ok "Build complete"
}
main "$@"
