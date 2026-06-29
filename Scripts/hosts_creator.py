#!/usr/bin/env python3
"""Download, process, and install a system-wide hosts file for ad-blocking."""

import socket
import subprocess
import sys
import urllib.request
from pathlib import Path

_root = Path(__file__).parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from Scripts.common import die, has, log, ok, warn  # noqa: E402

CONFIG_PATH = Path(__file__).parent / "hosts-config"
BACKUP_DIR = Path("backups")


def _load_config() -> dict[str, str]:
    defaults: dict[str, str] = {
        "syshosts_file": "/etc/hosts",
        "backupfilename": "hosts.backup",
        "newhostsfn": "hosts-new",
        "replacehosts": "1",
        "RM_COMMENTS": "1",
        "RM_DUPLICATE_LINES": "1",
        "RM_TRAILING_SPACES": "1",
        "HOSTS": "",
    }
    if not CONFIG_PATH.exists():
        return defaults

    # Join backslash-continued lines before parsing.
    lines = CONFIG_PATH.read_text(encoding="utf-8").splitlines()
    joined: list[str] = []
    buf = ""
    for line in lines:
        if line.endswith("\\"):
            buf += line[:-1] + " "
        else:
            buf += line
            joined.append(buf.strip())
            buf = ""
    if buf:
        joined.append(buf.strip())

    cfg = dict(defaults)
    for line in joined:
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in ('"', "'"):
            val = val[1:-1]
        cfg[key] = val
    return cfg


def _resolve_host() -> str:
    try:
        hostname = socket.gethostname()
    except Exception:
        hostname = "localhost"
    return f"127.0.0.1 {hostname}.local {hostname} localhost"


def backup(hosts_file: Path, backup_name: str) -> None:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    old = BACKUP_DIR / f"{backup_name}.old"
    current = BACKUP_DIR / backup_name
    if not old.exists():
        if current.exists():
            current.rename(old)
        if hosts_file.exists():
            import shutil
            shutil.copy2(hosts_file, current)
            log("backup", f"Saved {hosts_file}")


def download(urls: list[str], new_path: Path) -> None:
    if new_path.exists():
        new_path.unlink()
    log("download", "Fetching hosts")
    new_path.write_text(_resolve_host() + "\n", encoding="utf-8")

    for n, url in enumerate(urls, 1):
        print(f"  {n}) {url}")
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:138.0) Gecko/138.0 Firefox/138.0"},
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                with new_path.open("ab") as fh:
                    fh.write(resp.read())
        except Exception as e:
            warn(f"Failed: {url}: {e}")


def process(new_path: Path, rm_comments: bool, rm_trailing: bool, rm_dupes: bool) -> None:
    lines = new_path.read_text(encoding="utf-8", errors="replace").splitlines()
    if rm_trailing:
        lines = [ln.strip() for ln in lines]
    if rm_comments:
        lines = [ln for ln in lines if not ln.startswith("#")]
    if rm_dupes:
        seen: set[str] = set()
        deduped: list[str] = []
        for ln in lines:
            if ln not in seen:
                seen.add(ln)
                deduped.append(ln)
        lines = deduped
    new_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    ok("Processed")


def check_size(new_path: Path) -> None:
    size_mb = new_path.stat().st_size / (1024 * 1024)
    if size_mb > 60:
        warn(f"File >{size_mb:.0f}MB")
    ok(f"{new_path} ({size_mb:.1f}MB)")


def replace(new_path: Path, hosts_file: Path) -> None:
    sudo = "doas" if has("doas") else "sudo"
    log("replace", f"Installing to {hosts_file}")
    result = subprocess.run([sudo, "mv", "-f", str(new_path), str(hosts_file)], check=False)
    if result.returncode != 0:
        die("Replace failed")


def main() -> None:
    cfg = _load_config()
    hosts_file = Path(cfg["syshosts_file"])
    new_path = Path(cfg["newhostsfn"])
    backup_name = cfg["backupfilename"]
    do_replace = cfg.get("replacehosts", "1") == "1"
    rm_comments = cfg.get("RM_COMMENTS", "1") == "1"
    rm_trailing = cfg.get("RM_TRAILING_SPACES", "1") == "1"
    rm_dupes = cfg.get("RM_DUPLICATE_LINES", "1") == "1"
    urls = [u for u in cfg.get("HOSTS", "").split() if u.startswith("http")]

    backup(hosts_file, backup_name)
    download(urls, new_path)
    process(new_path, rm_comments, rm_trailing, rm_dupes)
    check_size(new_path)
    if do_replace:
        replace(new_path, hosts_file)
    ok("Complete")


if __name__ == "__main__":
    main()
