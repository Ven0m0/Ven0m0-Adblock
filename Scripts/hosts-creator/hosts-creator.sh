#!/usr/bin/env bash
set -euo pipefail; shopt -s nullglob globstar
IFS=$'\n\t'; export LC_ALL=C LANG=C
#── Config ──
D=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
[[ -f $D/../lib-common.sh ]] && . "$D/../lib-common.sh" || {
  R=$'\e[31m' G=$'\e[32m' Y=$'\e[33m' B=$'\e[34m' C=$'\e[36m' N=$'\e[0m'
  log(){ printf '%b[%s]%b %s\n' "$B" "$1" "$N" "${*:2}"; }
  ok(){ printf '%b✓%b %s\n' "$G" "$N" "$*"; }
  err(){ printf '%b✗%b %s\n' "$R" "$N" "$*" >&2; exit "${2:-1}"; }
}
[[ -f config ]] && . config
readonly HOSTS_FILE="${syshosts_file:-/etc/hosts}"
readonly BACKUP_NAME="${backupfilename:-hosts.backup}"
readonly NEW_NAME="${newhostsfn:-hosts-new}"
readonly DL="${downloader:-curl}"
readonly REPLACE="${replacehosts:-1}"
readonly BACKUP_DIR=backups
readonly RESOLVE="${RESOLVE_HOST:-127.0.0.1 localhost}"
#── Checks ──
command -v "$DL" &>/dev/null || err "$DL missing"
command -v awk &>/dev/null || err "awk missing"
#── Backup ──
mkdir -p "$BACKUP_DIR"
[[ -f $BACKUP_DIR/$BACKUP_NAME.old ]] || {
  [[ -f $BACKUP_DIR/$BACKUP_NAME ]] && mv "$BACKUP_DIR/$BACKUP_NAME" "$BACKUP_DIR/$BACKUP_NAME.old"
  cp "$HOSTS_FILE" "$BACKUP_DIR/$BACKUP_NAME"
  log info "Backed up $HOSTS_FILE"
}
[[ -f $NEW_NAME ]] && rm "$NEW_NAME"
#── Download ──
log info "Downloading hosts"
printf '%s\n' "$RESOLVE" > "$NEW_NAME"
n=0
for url in $HOSTS; do
  n=$((n+1))
  printf '%b%d)%b %s\n' "$C" "$n" "$N" "$url"
  $DL "$url" >> "$NEW_NAME" 2>/dev/null || :
done
#── Process ──
awk_cmd=""
[[ ${RM_COMMENTS:-0} == 1 ]] && { log info "Removing comments"; awk_cmd="!/^#/"; }
[[ ${RM_TRAILING_SPACES:-0} == 1 ]] && { log info "Removing trailing spaces"; awk_cmd="${awk_cmd:+$awk_cmd && }{gsub(/^ +| +$/,\"\");print}"; }
[[ ${RM_DUPLICATE_LINES:-0} == 1 ]] && { log info "Removing duplicates"; awk_cmd="${awk_cmd:+$awk_cmd && }!seen[\$0]++"; }
[[ -n $awk_cmd ]] && {
  tmp=$(mktemp)
  awk "$awk_cmd" "$NEW_NAME" > "$tmp" && mv "$tmp" "$NEW_NAME"
  ok "Processed"
}
#── Size check ──
size=$(du -sh "$NEW_NAME" | awk '{print $1}')
[[ $size =~ ([0-9]+)M ]] && (( ${BASH_REMATCH[1]} > 60 )) && printf '%b⚠ File >60MB%b\n' "$Y" "$N" >&2
ok "$NEW_NAME ($size)"
#── Replace ──
[[ $REPLACE == 1 ]] || exit 0
sudo=sudo; command -v doas &>/dev/null && sudo=doas; command -v rdo &>/dev/null && sudo=rdo
log info "Replacing $HOSTS_FILE"
$sudo mv -iv "$NEW_NAME" "$HOSTS_FILE" || err "Replace failed"
ok "Complete"
