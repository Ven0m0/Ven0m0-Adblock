#!/usr/bin/env python3
"""Remove hostlist entries that already appear in another hostlist file.

Files stay separate: nothing is merged. Each entry is kept in the first file by
priority and dropped from the files after it. Header and comment lines are never touched.
"""

import sys
from pathlib import Path

_root = Path(__file__).parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from Scripts.common import ok, read_lines, write_lines

# Earlier files win a shared entry; files not listed follow in alphabetical order.
PRIORITY = ("Ads.txt", "Other.txt")
# Used standalone (Morphe/Adobo), so they must stay complete: never edited, never a keeper.
EXEMPT = frozenset({"Android.txt"})


def _rank(name: str) -> tuple[int, str]:
    return (PRIORITY.index(name) if name in PRIORITY else len(PRIORITY), name)


def is_entry(line: str) -> bool:
    entry = line.strip()
    return bool(entry) and not entry.startswith(("!", "#"))


def dedupe_across(files: dict[str, list[str]]) -> dict[str, list[str]]:
    """Return the lines to keep per file name, dropping entries already kept in an earlier file."""
    seen: set[str] = set()
    result: dict[str, list[str]] = {}
    for name in sorted(files, key=_rank):
        if name in EXEMPT:
            result[name] = files[name]
            continue
        kept: list[str] = []
        for line in files[name]:
            if is_entry(line):
                entry = line.strip()
                if entry in seen:
                    continue
                seen.add(entry)
            kept.append(line)
        result[name] = kept
    return result


def main() -> int:
    hostlist_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "lists" / "hostlist"
    paths = sorted(p for p in hostlist_dir.glob("*.txt") if p.is_file())
    if not paths:
        print(f"Error: no .txt files in {hostlist_dir}", file=sys.stderr)
        return 1

    files = {p.name: read_lines(p) for p in paths}
    deduped = dedupe_across(files)

    total = 0
    for path in paths:
        removed = len(files[path.name]) - len(deduped[path.name])
        if removed:
            write_lines(path, deduped[path.name])
            print(f"  {path.name}: {removed} removed")
            total += removed
    ok(f"Cross-file dedup removed {total} entries; files kept separate")
    return 0


if __name__ == "__main__":
    sys.exit(main())
