#!/usr/bin/env python3
"""Deduplicate and optimize blocklist files.

- Removes duplicates within files and across files
- Strips comments, empty lines, and trailing whitespace
- Sorts entries for better compression
- Validates domain syntax
"""

import sys
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

from Scripts.common import read_lines, write_lines
from Scripts.rules import Kind, classify, is_rule, is_valid


@dataclass(slots=True)
class Stats:
    original: int = 0
    headers: int = 0
    final: int = 0
    removed: int = 0

    @property
    def compression_ratio(self) -> float:
        return (1 - self.final / self.original) * 100 if self.original > 0 else 0.0


def process_content(lines: Iterable[str]) -> tuple[list[str], list[str], Stats]:
    """Process lines to separate headers and rules, and deduplicate rules while keeping comments attached.

    Preprocessor directives (!#if/!#endif/!#else/!#include) are block
    boundaries: they keep their exact position and are never deduplicated
    or reordered. Dedup and alphabetical sort only apply within the run of
    plain rules between directives, since the same rule text can validly
    repeat under different conditional blocks.

    A run of rules headed by a comment keeps its author order: the comment
    usually describes specific rules in it, and sorting would separate them.
    Blank lines between sections are kept as run boundaries.
    """
    stats = Stats()
    headers: list[str] = []
    rules: list[str] = []
    segment: list[str] = []
    seen: set[str] = set()
    in_header = True
    current_comments: list[str] = []
    headed = False

    def flush_segment() -> None:
        rules.extend(segment if headed else sorted(segment))
        segment.clear()

    for raw_line in lines:
        stats.original += 1
        line = raw_line.strip()
        if not line:
            if in_header:
                headers.append("")
            else:
                flush_segment()
                rules.extend(current_comments)
                current_comments = []
                if rules and rules[-1]:
                    rules.append("")
            continue

        kind = classify(line)
        if kind is Kind.DIRECTIVE:
            in_header = False
            flush_segment()
            seen.clear()
            rules.extend(current_comments)
            current_comments = []
            rules.append(line)
        elif kind in (Kind.COMMENT, Kind.HEADER):
            if in_header:
                headers.append(line)
            else:
                # A comment ends the sorted run, so a section heading stays
                # above the rules it describes instead of drifting to the top.
                flush_segment()
                current_comments.append(line)
        else:
            in_header = False
            if line not in seen and is_valid(line):
                seen.add(line)
                if not segment:
                    headed = bool(current_comments)
                rules.extend(current_comments)
                current_comments = []
                segment.append(line)
            else:
                current_comments = []

    flush_segment()
    rules.extend(current_comments)
    while rules and not rules[-1]:
        rules.pop()

    stats.headers = len(headers)
    stats.final = len(headers) + len(rules)
    stats.removed = stats.original - stats.final

    return headers, rules, stats


def deduplicate_file(filepath: Path) -> tuple[Stats, list[str]]:
    """Deduplicate entries in a single file."""
    print(f"Processing: {filepath}")

    try:
        headers, rules, stats = process_content(read_lines(filepath))
        write_lines(filepath, headers + rules)
    except (OSError, UnicodeError) as e:
        print(f"  Error processing {filepath}: {e}", file=sys.stderr)
        return Stats(), []

    print(
        f"  {stats.original} → {stats.final} lines ({stats.removed} removed, {stats.compression_ratio:.1f}% reduction)"
    )
    # Return only actual rules (not comments/directives) for cross-file duplicate detection
    return stats, [r for r in rules if is_rule(r)]


def find_cross_file_duplicates(
    file_rules: dict[str, list[str]],
) -> dict[str, list[str]]:
    """Find entries appearing in multiple files."""
    entry_locations = defaultdict(list)

    for filename, rules in file_rules.items():
        for rule in rules:
            if rule:
                entry_locations[rule].append(filename)

    return {entry: files for entry, files in entry_locations.items() if len(files) > 1}


def main() -> int:
    script_dir = Path(__file__).parent
    repo_dir = script_dir.parent

    lists_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else repo_dir / "lists"

    if not lists_dir.exists():
        print(f"Error: Lists directory not found at {lists_dir}", file=sys.stderr)
        return 1

    txt_files = sorted(lists_dir.glob("**/*.txt"))
    if not txt_files:
        print("No .txt files found in lists directory", file=sys.stderr)
        return 1

    print(f"Found {len(txt_files)} files\n")

    total_stats = Stats()
    file_rules = {}
    for filepath in txt_files:
        stats, rules = deduplicate_file(filepath)
        file_rules[filepath.name] = rules
        total_stats.original += stats.original
        total_stats.final += stats.final
        total_stats.removed += stats.removed

    print(f"\n{'=' * 60}")
    print(f"Total: {total_stats.original} → {total_stats.final} lines")
    print(f"Removed: {total_stats.removed} ({total_stats.compression_ratio:.1f}% reduction)")

    print(f"\n{'=' * 60}")
    print("Checking for cross-file duplicates...")
    duplicates = find_cross_file_duplicates(file_rules)

    if duplicates:
        file_groups = defaultdict(list)
        for entry, files in duplicates.items():
            file_groups[tuple(sorted(files))].append(entry)

        print(f"Found {len(duplicates)} cross-file duplicates:\n")
        for file_tuple, entries in sorted(file_groups.items()):
            print(f"{len(entries)} entries in: {', '.join(file_tuple)}")
            for entry in sorted(entries)[:5]:
                print(f"  {entry}")
            if len(entries) > 5:
                print(f"  ... and {len(entries) - 5} more")
    else:
        print("✓ No cross-file duplicates")

    return 0


if __name__ == "__main__":
    sys.exit(main())
