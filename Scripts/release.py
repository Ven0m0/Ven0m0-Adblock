"""Publishing built lists: the shrink guard, the atomic write, and the catalog."""

import hashlib
import json
import os
from collections.abc import Iterable
from pathlib import Path

from Scripts.common import die, log, ok, read_lines, ts_read, write_lines
from Scripts.rules import is_rule

# A rebuild that keeps less than this share of the committed rules is treated as broken.
MIN_KEEP_RATIO = 0.5


def count_rules(lines: Iterable[str]) -> int:
    return sum(1 for line in lines if is_rule(line))


def publish(out: Path, lines: list[str]) -> int:
    """Write `lines` to `out` unless that would empty or heavily shrink the list.

    Dying keeps the last committed list intact when a source or compiler failure
    empties the output. Returns the rule count written.
    """
    new_count = count_rules(lines)
    if new_count == 0:
        die(f"{out.name}: new build has 0 rules, keeping existing file")
    if out.exists() and not os.environ.get("BUILD_ALLOW_SHRINK"):
        old_count = count_rules(read_lines(out))
        if old_count and new_count < old_count * MIN_KEEP_RATIO:
            die(
                f"{out.name}: rules dropped {old_count} -> {new_count} "
                f"(under {MIN_KEEP_RATIO:.0%}); set BUILD_ALLOW_SHRINK=1 to override"
            )
    out.parent.mkdir(parents=True, exist_ok=True)
    write_lines(out, lines)
    return new_count


def write_catalog(list_dir: Path, repo: str) -> None:
    """Index the built lists so consumers can detect changes and verify downloads."""
    log("catalog", "Writing list catalog")
    lists = []
    for f in sorted(list_dir.glob("*.txt")):
        data = f.read_bytes()
        lines = data.decode("utf-8").splitlines()
        title = version = None
        for line in lines:
            if line.startswith("! Title:"):
                title = line.removeprefix("! Title:").strip()
            elif line.startswith("! Version:"):
                version = line.removeprefix("! Version:").strip()
        lists.append(
            {
                "file": f.name,
                "title": title,
                "url": f"https://raw.githubusercontent.com/{repo}/main/{list_dir.as_posix()}/{f.name}",
                "rules": count_rules(lines),
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
                "version": version,
            }
        )
    if not lists:
        die(f"No built lists found in {list_dir}")
    out = list_dir / "metadata.json"
    write_lines(out, json.dumps({"generated": ts_read(), "lists": lists}, indent=2).splitlines())
    ok(f"{out} ({len(lists)} lists)")
