#!/usr/bin/env python3
"""Main build script for Ven0m0-Adblock.

Tasks:
  adblock       Build adblock filter list
  hosts         Build hosts file
  hostlist      Compile hostlist configs
  catalog       Write lists/releases/metadata.json for the built lists
  lint          Lint filter lists with AGLint
  userscripts   Lint, minify and build userscripts
  all           Run all tasks (default)
"""

import argparse
import os
import subprocess
import sys
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

_root = Path(__file__).parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from Scripts import release, userscript  # noqa: E402  (after sys.path bootstrap)
from Scripts.common import (  # noqa: E402
    die,
    err,
    has,
    log,
    ncpu,
    ok,
    ts_read,
    ts_short,
    warn,
)
from Scripts.rules import blocked_host, is_rule  # noqa: E402

REPO = os.environ.get("GITHUB_REPOSITORY", "Ven0m0/Ven0m0-Adblock")
FILTER_SRC = Path("lists/adblock")
FILTER_OUT = Path("lists/releases")
SCRIPT_SRC = Path("userscripts/src")
SCRIPT_OUT = Path("userscripts/dist")


def _js_runner() -> list[str] | None:
    return ["bun", "x"] if has("bun") else None


def _run_js(*args: str, **kwargs) -> subprocess.CompletedProcess:
    runner = _js_runner()
    cmd = [*runner, *args] if runner else list(args)
    check = kwargs.pop("check", False)
    return subprocess.run(cmd, check=check, **kwargs)


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
        rules.update(line for line in f.read_text(encoding="utf-8").splitlines() if is_rule(line))

    header = (
        "[uBlock Origin]\n"
        "! Title: Ven0m0's Adblock List\n"
        "! Expires: 1 day\n"
        f"! Version: {ts_short()}\n"
        f"! Last Modified: {ts_read()}\n"
        f"! Homepage: https://github.com/{REPO}\n"
        f"! Syntax: uBlock Origin\n"
    )
    count = release.publish(out, [*header.splitlines(), *sorted(rules)])
    ok(f"{out} ({count} rules)")


def build_hosts() -> None:
    src = FILTER_SRC / "Other.txt"
    out = FILTER_OUT / "hosts.txt"
    log("hosts", "Building hosts file")
    FILTER_OUT.mkdir(parents=True, exist_ok=True)

    if not src.exists():
        die(f"No host source file found: {src}")

    entries = {
        f"0.0.0.0 {host}" for line in src.read_text(encoding="utf-8").splitlines() if (host := blocked_host(line))
    }

    header = f"# Hostlist by {REPO}\n# Updated: {ts_read()}\n"
    count = release.publish(out, [*header.splitlines(), *sorted(entries)])
    ok(f"{out} ({count} entries)")


def build_hostlist() -> None:
    has_compiler = Path("node_modules/.bin/hostlist-compiler").exists() or has("hostlist-compiler")
    if not has_compiler:
        warn("hostlist-compiler missing")
        return

    log("hostlist", "Compiling hostlist")
    FILTER_OUT.mkdir(parents=True, exist_ok=True)

    if Path("hostlist-config.json").exists():
        out = FILTER_OUT / "hostlist.txt"
        tmp = out.with_name(out.name + ".tmp")
        try:
            r = _run_js(
                "hostlist-compiler",
                "-c",
                "hostlist-config.json",
                "-o",
                str(tmp),
                "--verbose",
                check=False,
            )
            if r.returncode != 0 or not tmp.exists():
                warn("Hostlist compilation failed")
                return
            release.publish(out, tmp.read_text(encoding="utf-8").splitlines())
        finally:
            tmp.unlink(missing_ok=True)


def write_catalog() -> None:
    release.write_catalog(FILTER_OUT, REPO)


def lint_filters() -> None:
    runner = _js_runner()
    if runner is None:
        warn("bun not found, skipping lint")
        return

    log("lint", "Installing dependencies and running lint")
    if not Path("node_modules").exists():
        subprocess.run(["bun", "install"], capture_output=True, check=False)

    if subprocess.run(["bun", "run", "lint"], check=False).returncode != 0:
        warn("Lint found issues")


def _minify(code: str) -> str:
    result = _run_js(
        "esbuild",
        "--minify",
        "--target=es2022",
        "--format=iife",
        "--platform=browser",
        "--log-level=error",
        input=code.encode(),
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        msg = "esbuild failed"
        raise ValueError(msg)
    return result.stdout.decode().strip()


def _process_js(f: Path) -> bool:
    fn = f.name
    base = fn[: -len(".user.js")] if fn.endswith(".user.js") else f.stem
    try:
        packaged = userscript.package(
            f.read_text(encoding="utf-8"), base, repo=REPO, dist=SCRIPT_OUT.as_posix(), minify=_minify
        )
    except ValueError as e:
        err(f"{fn} ({e})")
        return False

    SCRIPT_OUT.mkdir(parents=True, exist_ok=True)
    (SCRIPT_OUT / f"{base}.meta.js").write_text(packaged.meta, encoding="utf-8")
    (SCRIPT_OUT / f"{base}.user.js").write_text(packaged.script, encoding="utf-8")
    ok(f"{fn} -> {base}.user.js ({f.stat().st_size} -> {len(packaged.script)} bytes)")
    return True


def build_userscripts() -> None:
    if _js_runner() is None:
        warn("bun not found, skipping userscripts")
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

    count = sum(1 for _ in SCRIPT_OUT.glob("*.user.js"))
    ok(f"{count} scripts -> {SCRIPT_OUT}/")


def _task_all() -> None:
    build_adblock()
    build_hosts()
    build_hostlist()
    write_catalog()
    build_userscripts()


_TASKS: dict[str, Callable[[], None]] = {
    "adblock": build_adblock,
    "hosts": build_hosts,
    "hostlist": build_hostlist,
    "catalog": write_catalog,
    "lint": lint_filters,
    "userscripts": build_userscripts,
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
            "  catalog       Write lists/releases/metadata.json\n"
            "  lint         Lint filter lists with AGLint\n"
            "  userscripts   Lint, minify and build userscripts\n"
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
