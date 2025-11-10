#!/usr/bin/env bash
set -euo pipefail; shopt -s nullglob globstar extglob
IFS=$'\n\t'; export LC_ALL=C LANG=C

# Colors
readonly R=$'\e[31m' G=$'\e[32m' Y=$'\e[33m' B=$'\e[34m' C=$'\e[36m' N=$'\e[0m'

# Paths
readonly REPO="${GITHUB_REPOSITORY:-Ven0m0/Ven0m0-Adblock}"
readonly SRC_DIR="${1:-userscripts}"
readonly OUT_DIR="${2:-dist}"
readonly FILTER_DIR="Filters"
readonly BACKUP_DIR="backups"
readonly LIST_FILE="${3:-List}"
readonly HOSTS_CFG="config"

# Tools detection with fallbacks
FD=$(command -v fd || command -v fdfind || echo find)
RG=$(command -v rg || echo grep)
PARALLEL=$(command -v parallel || echo)
JOBS=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

# JS runtime detection
if command -v bun &>/dev/null; then
  RUNNER=(bun x)
elif command -v npx &>/dev/null; then
  RUNNER=(npx -y)
else
  RUNNER=()
fi

# Dependency checks
chk(){
  command -v "$1" &>/dev/null || { printf '%b✗%b %s missing\n' "$R" "$N" "$1" >&2; return 1; }
}

# Current timestamp
ts(){ date -u +"%Y%m%d%H%M"; }
tsfmt(){ date -u +"%Y-%m-%d %H:%M:%S UTC"; }

# === ADBLOCK FILTER BUILDER ===
build_adblock(){
  local -a src=(
    "3rd-party.txt" "Combination-Minimal.txt" "Combination-No-YT" "Combination.txt"
    "Other.txt" "RedditAnnoyances.txt" "Search-Engines.txt" "SpotifyTweaks.txt"
    "TwitchTweaks.txt" "TwitterAnnoyances.txt" "YoutubeTweaks.txt"
  )
  local out="$FILTER_DIR/filter.txt"
  
  printf '%b[adblock]%b Building filter...\n' "$B" "$N"
  mkdir -p "$FILTER_DIR"
  
  cat > "$out" <<EOF
[Adblock Plus 2.0]
! Title: Ven0m0's Adblock List
! Version: $(ts)
! Last Modified: $(tsfmt)
! Homepage: https://github.com/$REPO
! Syntax: Adblock Plus 2.0
EOF
  
  cat "${src[@]}" 2>/dev/null | \
    $RG -v '^\s*!|\[Adblock Plus|^\s*$' | \
    sort -u >> "$out"
  
  printf '%b✓%b %s (%d rules)\n' "$G" "$N" "$out" "$(wc -l < "$out")"
}

# === HOSTS BUILDER ===
build_hosts(){
  local -a src=("3rd-party.txt" "Other.txt")
  local out="hosts.txt"
  
  printf '%b[hosts]%b Building hosts file...\n' "$B" "$N"
  
  cat > "$out" <<EOF
# Hostlist compiled by $REPO
# Last Updated: $(tsfmt)
EOF
  
  cat "${src[@]}" 2>/dev/null | \
    $RG -o '[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+\.[a-zA-Z]{2,}' | \
    awk '{print "0.0.0.0 " $1}' | \
    sort -u >> "$out"
  
  printf '%b✓%b %s (%d hosts)\n' "$G" "$N" "$out" "$(wc -l < "$out")"
}

# === HOSTLIST COMPILER (AdGuard) ===
build_hostlist_compiler(){
  command -v hostlist-compiler &>/dev/null || {
    printf '%b[hostlist]%b Installing hostlist-compiler...\n' "$Y" "$N"
    npm i -g @adguard/hostlist-compiler
  }
  
  printf '%b[hostlist]%b Compiling with AdGuard...\n' "$B" "$N"
  mkdir -p "$FILTER_DIR"
  
  [[ -f hostlist-config.json ]] && \
    hostlist-compiler -c hostlist-config.json -o "$FILTER_DIR/filter.txt" --verbose
  
  [[ -f configuration_popup_filter.json ]] && {
    hostlist-compiler -c configuration_popup_filter.json -o "$FILTER_DIR/adguard_popup_filter.txt" --verbose
    [[ -f scripts/popup_filter_build.js ]] && \
      node scripts/popup_filter_build.js "$FILTER_DIR/adguard_popup_filter.txt"
  }
}

# === AGLINT SETUP ===
setup_aglint(){
  [[ -f package.json ]] || npm init -y
  npm list @adguard/aglint &>/dev/null || npm install -D @adguard/aglint
  [[ -f .aglintrc.yaml ]] || npx aglint init
  
  local script
  script=$(npm pkg get scripts.lint 2>/dev/null)
  [[ -z $script || $script == '""' || $script == "undefined" ]] && \
    npm pkg set scripts.lint="aglint"
  
  printf '%b[aglint]%b Running lint...\n' "$B" "$N"
  npm run lint
  
  [[ -d .husky ]] || {
    npm list husky &>/dev/null || npm install -D husky
    npx husky init
    echo 'npx aglint' > .husky/pre-commit
  }
}

# === HOSTS CREATOR (Download & Process) ===
build_hosts_creator(){
  [[ -f $HOSTS_CFG ]] && . "$HOSTS_CFG"
  
  local hosts_file="${syshosts_file:-/etc/hosts}"
  local backup_name="${backupfilename:-hosts.backup}"
  local new_name="${newhostsfn:-hosts-new}"
  local dl="${downloader:-curl}"
  local resolve="${RESOLVE_HOST:-127.0.0.1 localhost}"
  
  chk "$dl" || return 1
  
  mkdir -p "$BACKUP_DIR"
  
  # Backup
  [[ -f $BACKUP_DIR/$backup_name.old ]] || {
    [[ -f $BACKUP_DIR/$backup_name ]] && \
      mv "$BACKUP_DIR/$backup_name" "$BACKUP_DIR/$backup_name.old"
    cp "$hosts_file" "$BACKUP_DIR/$backup_name"
  }
  
  printf '%b[hosts-creator]%b Downloading hosts...\n' "$B" "$N"
  printf '%s\n' "$resolve" > "$new_name"
  
  local n=0
  for url in $HOSTS; do
    n=$((n+1))
    printf '%b%d)%b %s\n' "$C" "$n" "$N" "$url"
    $dl "$url" >> "$new_name" 2>/dev/null || :
  done
  
  # Process
  local awk_cmd=""
  [[ ${RM_COMMENTS:-0} == 1 ]] && awk_cmd="!/^#/"
  [[ ${RM_TRAILING_SPACES:-0} == 1 ]] && awk_cmd="${awk_cmd:+$awk_cmd && }{gsub(/^ +| +$/,\"\");print}"
  [[ ${RM_DUPLICATE_LINES:-0} == 1 ]] && awk_cmd="${awk_cmd:+$awk_cmd && }!seen[\$0]++"
  
  [[ -n $awk_cmd ]] && {
    local tmp
    tmp=$(mktemp)
    awk "$awk_cmd" "$new_name" > "$tmp" && mv "$tmp" "$new_name"
  }
  
  local size
  size=$(du -sh "$new_name" | awk '{print $1}')
  printf '%b✓%b %s (%s)\n' "$G" "$N" "$new_name" "$size"
  
  [[ ${replacehosts:-1} == 1 ]] && {
    local sudo=sudo
    command -v doas &>/dev/null && sudo=doas
    command -v rdo &>/dev/null && sudo=rdo
    $sudo mv -iv "$new_name" "$hosts_file"
  }
}

# === USERSCRIPT MINIFIER ===
process_js(){
  local f=$1 base fname meta code js len
  fname=${f##*/}
  base=${fname%.user.js}
  [[ $fname == *.user.js ]] || base=${fname%.*}
  
  # Extract metadata
  meta=$(sed -n '/^\/\/ ==UserScript==/,/^\/\/ ==\/UserScript==/{ /^\/\/ ==\/UserScript==/!p }' "$f")
  code=$(sed -n '/^\/\/ ==\/UserScript==/,$p' "$f" | tail -n +2)
  
  # Update URLs in metadata
  [[ -n $meta ]] && meta=$(sed -E \
    -e '/^\/\/ @(name|description):/!b; /^\/\/ @(name|description):en/!d' \
    -e "s|// @downloadURL .*|// @downloadURL https://raw.githubusercontent.com/$REPO/main/$OUT_DIR/$base.user.js|" \
    -e "s|// @updateURL .*|// @updateURL https://raw.githubusercontent.com/$REPO/main/$OUT_DIR/$base.meta.js|" \
    <<< "$meta")
  
  # Minify
  if ! js=$("${RUNNER[@]}" esbuild --minify --target=es2022 --format=iife --platform=browser --log-level=error <<< "$code" 2>&1); then
    printf '%b✗%b %s (esbuild)\n' "$R" "$N" "$fname" >&2
    return 1
  fi
  
  len=${#js}
  (( len < 50 )) && {
    printf '%b✗%b %s (%d bytes)\n' "$R" "$N" "$fname" "$len" >&2
    return 1
  }
  
  # Write output
  if [[ -n $meta ]]; then
    printf '%s\n' "$meta" > "$OUT_DIR/$base.meta.js"
    printf '%s\n%s\n' "$meta" "$js" > "$OUT_DIR/$base.user.js"
  else
    printf '%s\n' "$js" > "$OUT_DIR/$base.user.js"
  fi
  
  printf '%b✓%b %s (%d → %d)\n' "$G" "$N" "$fname" "$(wc -c < "$f")" "$len"
}

download_js(){
  local url=$1 fname base ts
  fname=${url##*/}
  fname=$(tr -cd '[:alnum.]_-' <<< "$fname")
  [[ $fname == *.user.js ]] || fname+=.user.js
  
  if [[ -f $SRC_DIR/$fname ]]; then
    ts=$(date +%s)
    base=${fname%.user.js}
    fname="${base}_${ts}.user.js"
  fi
  
  printf '%b↓%b %s\n' "$Y" "$N" "$fname"
  curl -fsSL -A "Mozilla/5.0 Firefox/124.0" -m 30 "$url" -o "$SRC_DIR/$fname" 2>/dev/null && \
    printf '%s' "$SRC_DIR/$fname" || return 1
}

build_userscripts(){
  [[ ${#RUNNER[@]} -eq 0 ]] && {
    printf '%b✗%b No JS runtime (install bun or node)\n' "$R" "$N" >&2
    return 1
  }
  
  mkdir -p "$SRC_DIR" "$OUT_DIR"
  
  # Process list file
  [[ -f $LIST_FILE ]] && {
    local -a updated=()
    while IFS= read -r line; do
      if [[ $line =~ https?://[^\ \"]+\.user\.js ]]; then
        local url=${BASH_REMATCH[0]} file fname
        if file=$(download_js "$url"); then
          process_js "$file" || continue
          fname=${file##*/}
          fname=${fname%.user.js}.user.js
          updated+=("$url|https://raw.githubusercontent.com/$REPO/main/$OUT_DIR/$fname")
        fi
      fi
    done < "$LIST_FILE"
    
    if (( ${#updated[@]} > 0 )); then
      local tmp
      tmp=$(mktemp)
      cp "$LIST_FILE" "$tmp"
      for pair in "${updated[@]}"; do
        IFS='|' read -r old new <<< "$pair"
        sed -i "s|$old|$new|g" "$tmp"
      done
      mv "$tmp" "$OUT_DIR/README.md"
    else
      cp "$LIST_FILE" "$OUT_DIR/README.md"
    fi
  }
  
  # Find and process local files
  local -a files=()
  if [[ $FD == *fd* ]]; then
    mapfile -t files < <($FD -e js -t f . "$SRC_DIR" 2>/dev/null)
  else
    mapfile -t files < <(find "$SRC_DIR" -type f -name "*.js" 2>/dev/null)
  fi
  
  (( ${#files[@]} == 0 )) && return 0
  
  printf '%b[userscripts]%b Processing %d files...\n' "$B" "$N" "${#files[@]}"
  
  # Run eslint if available
  if command -v eslint &>/dev/null; then
    eslint --fix --quiet --no-warn-ignored "${files[@]}" 2>/dev/null || :
  fi
  
  # Parallel or sequential processing
  export -f process_js
  export REPO OUT_DIR R G Y N RUNNER
  
  if [[ -n $PARALLEL ]] && (( ${#files[@]} > 1 )); then
    printf '%s\n' "${files[@]}" | $PARALLEL -j "$JOBS" --bar process_js {} 2>/dev/null || {
      for f in "${files[@]}"; do process_js "$f" || :; done
    }
  else
    for f in "${files[@]}"; do process_js "$f" || :; done
  fi
  
  local total
  total=$(find "$OUT_DIR" -name "*.user.js" -type f 2>/dev/null | wc -l)
  printf '\n%b✓%b %d scripts → %s/\n' "$G" "$N" "$total" "$OUT_DIR"
}

# === MAIN ===
usage(){
  cat <<EOF
Usage: ${0##*/} [options]

Options:
  adblock          Build adblock filter list
  hosts            Build hosts file
  hostlist         Build with AdGuard hostlist-compiler
  aglint           Setup and run AGLint
  hosts-creator    Download and process hosts (uses config file)
  userscripts      Minify userscripts
  all              Run all tasks
  
Environment:
  SRC_DIR=$SRC_DIR
  OUT_DIR=$OUT_DIR
  FILTER_DIR=$FILTER_DIR
EOF
}

main(){
  local task=${1:-all}
  
  case $task in
    adblock) build_adblock ;;
    hosts) build_hosts ;;
    hostlist) build_hostlist_compiler ;;
    aglint) setup_aglint ;;
    hosts-creator) build_hosts_creator ;;
    userscripts) build_userscripts ;;
    all)
      build_adblock
      build_hosts
      build_userscripts
      printf '\n%b✓%b All tasks complete\n' "$G" "$N"
      ;;
    -h|--help|help) usage ;;
    *) printf '%bUnknown task: %s%b\n' "$R" "$task" "$N" >&2; usage >&2; exit 1 ;;
  esac
}

main "$@"
