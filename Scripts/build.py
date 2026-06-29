#!/usr/bin/env python3
"""Main build script for Ven0m0-Adblock.

Tasks:
  adblock       Build adblock filter list
  hosts         Build hosts file
  hostlist      Compile hostlist configs
  lint          Lint filter lists with AGLint
  download      Download userscripts from list
  userscripts   Process userscripts (download + build)
  all           Run all tasks (default)
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
import urllib.request
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

_root = Path(__file__).parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from Scripts.common import dbg, die, err, has, log, ncpu, ok, ts_read, ts_short, warn  # noqa: E402

REPO = os.environ.get("GITHUB_REPOSITORY", "Ven0m0/Ven0m0-Adblock")
FILTER_SRC = Path("lists/sources")
FILTER_OUT = Path("lists/releases")
SCRIPT_SRC = Path("userscripts/src")
SCRIPT_OUT = Path("userscripts/dist")
SCRIPT_LIST = Path("userscripts/list.txt")

_FILTER_RE = re.compile(r"^\s*!|\[Adblock|^\s*$")
_DOMAIN_RE = re.compile(
    r"[a-z0-9][-a-z0-9]{0,61}(?:\.[a-z0-9][-a-z0-9]{0,61})+\.[a-z]{2,}",
    re.IGNORECASE,
)
_URL_RE = re.compile(r"https://[^\s]+\.user\.js")


def _js_runner() -> list[str] | None:
    if has("bun"):
        return ["bun", "x"]
    if has("npx"):
        return ["npx", "-y"]
    return None


def _run_js(*args: str, **kwargs) -> subprocess.CompletedProcess:
    runner = _js_runner()
    cmd = [*runner, *args] if runner else list(args)
    return subprocess.run(cmd, **kwargs)


def _fetch(url: str, dest: Path) -> bool:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Android 14; Mobile; rv:138.0) Gecko/138.0 Firefox/138.0",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            dest.write_bytes(resp.read())
        return True
    except Exception as e:
        warn(f"Failed to download {url}: {e}")
        return False


def build_adblock() -> None:
    src_patterns = [
        "Combination*.txt",
        "Other.txt",
        "Reddit.txt",
        "Twitter.txt",
        "Youtube.txt",
        "Twitch.txt",
        "Spotify.txt",
        "Search-Engines.txt",
        "General.txt",
    ]
    out = FILTER_OUT / "adblock.txt"
    log("adblock", "Building filter list")
    FILTER_OUT.mkdir(parents=True, exist_ok=True)

    files: list[Path] = []
    for pattern in src_patterns:
        files.extend(sorted(FILTER_SRC.glob(pattern)))
    if not files:
        die("No filter source files found")

    rules: set[str] = set()
    for f in files:
        for line in f.read_text(encoding="utf-8").splitlines():
            if not _FILTER_RE.search(line):
                rules.add(line)

    header = (
        "[uBlock Origin]\n"
        f"!  Title:  Ven0m0's Adblock List\n"
        f"! Version: {ts_short()}\n"
        f"! Last Modified: {ts_read()}\n"
        f"! Homepage: https://github.com/{REPO}\n"
        f"! Syntax: uBlock Origin\n"
    )
    out.write_text(header + "\n".join(sorted(rules)) + "\n", encoding="utf-8")
    ok(f"{out} ({len(rules)} rules)")


def build_hosts() -> None:
    src = FILTER_SRC / "Other.txt"
    out = FILTER_OUT / "hosts.txt"
    log("hosts", "Building hosts file")
    FILTER_OUT.mkdir(parents=True, exist_ok=True)

    if not src.exists():
        die(f"No host source file found: {src}")

    entries: set[str] = set()
    for line in src.read_text(encoding="utf-8").splitlines():
        m = _DOMAIN_RE.search(line)
        if m:
            entries.add(f"0.0.0.0 {m.group(0).lower()}")

    header = f"# Hostlist by {REPO}\n# Updated: {ts_read()}\n"
    out.write_text(header + "\n".join(sorted(entries)) + "\n", encoding="utf-8")
    ok(f"{out} ({len(entries)} entries)")


def build_hostlist() -> None:
    has_compiler = (
        Path("node_modules/.bin/hostlist-compiler").exists() or has("hostlist-compiler")
    )
    if not has_compiler:
        warn("hostlist-compiler missing")
        return

    log("hostlist", "Compiling hostlist")
    FILTER_OUT.mkdir(parents=True, exist_ok=True)

    if Path("hostlist-config.json").exists():
        r = _run_js(
            "hostlist-compiler",
            "-c",
            "hostlist-config.json",
            "-o",
            str(FILTER_OUT / "hostlist.txt"),
            "--verbose",
            check=False,
        )
        if r.returncode != 0:
            warn("Hostlist compilation failed")

    if Path("configuration_popup_filter.json").exists():
        r = _run_js(
            "hostlist-compiler",
            "-c",
            "configuration_popup_filter.json",
            "-o",
            str(FILTER_OUT / "adguard_popup_filter.txt"),
            "--verbose",
            check=False,
        )
        if r.returncode != 0:
            warn("Popup filter compilation failed")
        popup_build = Path("scripts/popup_filter_build.js")
        if popup_build.exists():
            subprocess.run(
                ["node", str(popup_build), str(FILTER_OUT / "adguard_popup_filter.txt")],
                check=False,
            )


def lint_filters() -> None:
    runner = _js_runner()
    if runner is None:
        warn("No JS runtime available, skipping lint")
        return

    log("lint", "Setting up AGLint")
    if not Path("package.json").exists():
        subprocess.run(["npm", "init", "-y"], capture_output=True, check=False)
    if subprocess.run(["npm", "list", "@adguard/aglint"], capture_output=True, check=False).returncode != 0:
        subprocess.run(["npm", "i", "-D", "@adguard/aglint"], capture_output=True, check=False)
    if not Path(".aglintrc.yaml").exists():
        _run_js("@adguard/aglint", "init", capture_output=True, check=False)

    if subprocess.run(["npm", "run", "lint"], check=False).returncode != 0:
        warn("Lint found issues")


def download_userscripts() -> None:
    if not SCRIPT_LIST.exists():
        log("download", f"No {SCRIPT_LIST} found, skipping")
        return

    log("download", f"Processing {SCRIPT_LIST}")
    SCRIPT_SRC.mkdir(parents=True, exist_ok=True)

    for line in SCRIPT_LIST.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = _URL_RE.search(line)
        if not m:
            continue
        url = m.group(0)
        fn = re.sub(r"[^\w._-]", "", Path(url).name)
        if not fn.endswith(".user.js"):
            fn += ".user.js"
        dest = SCRIPT_SRC / fn
        if dest.exists():
            n = 1
            while (SCRIPT_SRC / f"{n}_{fn}").exists():
                n += 1
            fn = f"{n}_{fn}"
            dest = SCRIPT_SRC / fn
        dbg(f"Downloading {fn} from {url}")
        _fetch(url, dest)

    ok(f"Downloaded to {SCRIPT_SRC}/")


def _process_js(f: Path) -> bool:
    fn = f.name
    base = fn[: -len(".user.js")] if fn.endswith(".user.js") else f.stem

    text = f.read_text(encoding="utf-8")
    meta_lines: list[str] = []
    code_lines: list[str] = []
    in_meta = False
    after_meta = False

    for line in text.splitlines():
        if line.strip() == "// ==UserScript==":
            in_meta = True
            meta_lines.append(line)
        elif line.strip() == "// ==/UserScript==":
            in_meta = False
            after_meta = True
        elif in_meta:
            meta_lines.append(line)
        elif after_meta:
            code_lines.append(line)

    if not meta_lines or not code_lines:
        err(f"{fn} (missing metadata or code block)")
        return False

    filtered_meta: list[str] = []
    for line in meta_lines:
        if re.match(r"^// @(name|description):", line) and ": en" not in line:
            continue
        line = re.sub(
            r"^(// @downloadURL).*",
            rf"\1 https://raw.githubusercontent.com/{REPO}/main/{SCRIPT_OUT}/{base}.user.js",
            line,
        )
        line = re.sub(
            r"^(// @updateURL).*",
            rf"\1 https://raw.githubusercontent.com/{REPO}/main/{SCRIPT_OUT}/{base}.meta.js",
            line,
        )
        filtered_meta.append(line)

    meta_text = "\n".join(filtered_meta)
    code_text = "\n".join(code_lines)

    result = _run_js(
        "esbuild",
        "--minify",
        "--target=es2022",
        "--format=iife",
        "--platform=browser",
        "--log-level=error",
        input=code_text.encode(),
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        err(f"{fn} (esbuild failed)")
        return False

    js = result.stdout.decode().strip()
    if len(js) < 50:
        err(f"{fn} ({len(js)} bytes, suspiciously small)")
        return False

    SCRIPT_OUT.mkdir(parents=True, exist_ok=True)
    (SCRIPT_OUT / f"{base}.meta.js").write_text(meta_text + "\n", encoding="utf-8")
    (SCRIPT_OUT / f"{base}.user.js").write_text(meta_text + "\n" + js + "\n", encoding="utf-8")
    ok(f"{fn} -> {base}.user.js ({f.stat().st_size} -> {len(js)} bytes)")
    return True


def build_userscripts() -> None:
    if _js_runner() is None:
        warn("No JS runtime (bun/npx) found, skipping userscripts")
        return

    SCRIPT_SRC.mkdir(parents=True, exist_ok=True)
    SCRIPT_OUT.mkdir(parents=True, exist_ok=True)

    files = sorted(SCRIPT_SRC.glob("*.js"))
    if not files:
        log("userscripts", f"No files in {SCRIPT_SRC}")
        return

    log("userscripts", f"Processing {len(files)} files")

    str_files = [str(f) for f in files]
    if has("oxlint"):
        subprocess.run(
            ["oxlint", "--config", ".oxlintrc.json", "--fix", "--quiet", *str_files],
            capture_output=True,
            check=False,
        )
    if has("biome"):
        subprocess.run(
            [
                "biome",
                "check",
                "--write",
                "--no-errors-on-unmatched",
                "--files-ignore-unknown=true",
                *str_files,
            ],
            capture_output=True,
            check=False,
        )

    with ThreadPoolExecutor(max_workers=ncpu()) as pool:
        list(pool.map(_process_js, files))

    if SCRIPT_LIST.exists():
        shutil.copy(SCRIPT_LIST, SCRIPT_OUT / "README.md")

    count = sum(1 for _ in SCRIPT_OUT.glob("*.user.js"))
    ok(f"{count} scripts -> {SCRIPT_OUT}/")


def _task_userscripts() -> None:
    download_userscripts()
    build_userscripts()


def _task_all() -> None:
    build_adblock()
    build_hosts()
    build_hostlist()
    download_userscripts()
    build_userscripts()


_TASKS: dict[str, Callable[[], None]] = {
    "adblock": build_adblock,
    "hosts": build_hosts,
    "hostlist": build_hostlist,
    "lint": lint_filters,
    "download": download_userscripts,
    "userscripts": _task_userscripts,
    "all": _task_all,
}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build Ven0m0-Adblock assets",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Tasks:\n"
            "  adblock       Build adblock filter list\n"
            "  hosts         Build hosts file\n"
            "  hostlist      Compile hostlist configs\n"
            "  lint          Lint filter lists with AGLint\n"
            "  download      Download userscripts from list\n"
            "  userscripts   Process userscripts (download + build)\n"
            "  all           Run all tasks (default)\n"
        ),
    )
    parser.add_argument("tasks", nargs="*", default=["all"])
    args = parser.parse_args()

    for task in args.tasks:
        if task not in _TASKS:
            parser.error(f"Unknown task: {task}. Choose from: {', '.join(_TASKS)}")
        _TASKS[task]()

    ok("Build complete")


if __name__ == "__main__":
    main()
