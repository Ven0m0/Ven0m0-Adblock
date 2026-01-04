#!/usr/bin/env bash
# shellcheck enable=all shell=bash source-path=SCRIPTDIR
set -euo pipefail; shopt -s nullglob globstar
IFS=$'\n\t' LC_ALL=C
readonly SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib-common.sh
. "${SCRIPT_DIR}/lib-common. sh"

readonly CONFIG="${SCRIPT_DIR}/hosts-config"
readonly HOSTS_FILE="${syshosts_file:-/etc/hosts}"
readonly BACKUP_NAME="${backupfilename:-hosts. backup}"
readonly NEW_NAME="${newhostsfn:-hosts-new}"
readonly DL="${downloader:-curl}"
readonly REPLACE="${replacehosts:-1}"
readonly BACKUP_DIR=backups
readonly RESOLVE="${RESOLVE_HOST:-127.0.0.1 $(hostname 2>/dev/null || echo localhost).local $(hostname 2>/dev/null || echo localhost) localhost}"

[[ -f $CONFIG ]] && .  "$CONFIG"

chk "$DL"
chk awk

backup(){
  mkdir -p "$BACKUP_DIR"
  if [[ !  -f $BACKUP_DIR/$BACKUP_NAME. old ]]; then
    [[ -f $BACKUP_DIR/$BACKUP_NAME ]] && mv "$BACKUP_DIR/$BACKUP_NAME" "$BACKUP_DIR/$BACKUP_NAME.old"
    cp "$HOSTS_FILE" "$BACKUP_DIR/$BACKUP_NAME"
    log backup "Saved $HOSTS_FILE"
  fi
}

download(){
  [[ -f $NEW_NAME ]] && rm "$NEW_NAME"
  log download "Fetching hosts"
  printf '%s\n' "$RESOLVE" > "$NEW_NAME"
  local n=0 url
  for url in ${HOSTS:-}; do
    ((n++))
    printf '%b%d)%b %s\n' "$C" "$n" "$N" "$url"
    "$DL" -fsSL "$url" >> "$NEW_NAME" 2>/dev/null || warn "Failed:  $url"
  done
}

process(){
  local awk_cmd=""
  [[ ${RM_COMMENTS:-1} == 1 ]] && awk_cmd="!/^#/"
  [[ ${RM_TRAILING_SPACES:-1} == 1 ]] && awk_cmd="${awk_cmd:+$awk_cmd && }{gsub(/^ +| +$/,\"\");print}"
  [[ ${RM_DUPLICATE_LINES:-1} == 1 ]] && awk_cmd="${awk_cmd:+$awk_cmd && }! seen[\$0]++"
  
  if [[ -n $awk_cmd ]]; then
    local tmp
    tmp=$(mktemp)
    cleanup_add "rm -f $tmp"
    awk "$awk_cmd" "$NEW_NAME" > "$tmp" && mv "$tmp" "$NEW_NAME"
    ok "Processed"
  fi
}

check_size(){
  local size
  size=$(du -sh "$NEW_NAME" | awk '{print $1}')
  [[ $size =~ ([0-9]+)M ]] && (( BASH_REMATCH[1] > 60 )) && warn "File >60MB"
  ok "$NEW_NAME ($size)"
}

replace(){
  [[ $REPLACE != 1 ]] && return 0
  local sudo=sudo
  has doas && sudo=doas
  has rdo && sudo=rdo
  log replace "Installing to $HOSTS_FILE"
  "$sudo" mv -f "$NEW_NAME" "$HOSTS_FILE" || die "Replace failed"
}

main(){
  backup
  download
  process
  check_size
  replace
  ok "Complete"
}

main "$@"
