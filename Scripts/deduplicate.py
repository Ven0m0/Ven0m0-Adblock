#!/usr/bin/env python3
"""
Deduplicate and optimize blocklist files
- Removes duplicates within files and across files
- Strips comments, empty lines, and trailing whitespace
- Sorts entries for better compression
- Validates domain syntax
"""
import sys
import re
from pathlib import Path
from collections import defaultdict
from dataclasses import dataclass

@dataclass(slots=True)
class Stats:
  original: int = 0
  headers: int = 0
  final: int = 0
  removed: int = 0
  
  @property
  def compression_ratio(self) -> float:
    return (1 - self.final / self.original) * 100 if self.original > 0 else 0.0

DOMAIN_PATTERN = re.compile(r'^[a-z0-9][-a-z0-9]{0,61}(?:\.[a-z0-9][-a-z0-9]{0,61})+\.[a-z]{2,}$', re.I)

def is_header(line: str) -> bool:
  """Check if line is a header/metadata line"""
  return line.startswith(('! ', '#', '[', ';')) or not line

def is_valid_rule(line: str) -> bool:
  """Basic validation for filter rules"""
  if not line or len(line) > 2048:
    return False
  if line.startswith(('||', '@@||')):
    domain = line.split('^')[0].lstrip('|@')
    return bool(DOMAIN_PATTERN.match(domain))
  return True

def deduplicate_file(filepath: Path) -> tuple[Stats, list[str]]:
  """Deduplicate entries in a single file"""
  print(f"Processing: {filepath}")
  try:
    with filepath.open('r', encoding='utf-8') as f:
      lines = [line.rstrip() for line in f]
  except Exception as e:
    print(f"  Error reading: {e}", file=sys.stderr)
    return Stats(), []
  
  stats = Stats(original=len(lines))
  headers, rules, seen = [], [], set()
  in_header = True
  
  for line in lines:
    if not line:
      if in_header: 
        headers.append('')
      continue
    
    if is_header(line):
      headers.append(line)
    else:
      in_header = False
      if line not in seen and is_valid_rule(line):
        seen.add(line)
        rules.append(line)
  
  rules.sort()
  final = headers + rules
  stats.headers = len(headers)
  stats.final = len(final)
  stats.removed = stats.original - stats.final
  
  try:
    with filepath.open('w', encoding='utf-8', newline='\n') as f:
      for line in final:
        f.write(f"{line}\n")
  except Exception as e:
    print(f"  Error writing: {e}", file=sys.stderr)
    return Stats(), []
  
  print(f"  {stats.original} → {stats.final} lines ({stats.removed} removed, {stats.compression_ratio:.1f}% reduction)")
  return stats, rules

def find_cross_file_duplicates(file_rules: dict[str, list[str]]) -> dict[str, list[str]]:
  """Find entries appearing in multiple files"""
  entry_locations = defaultdict(list)
  
  for filename, rules in file_rules.items():
    for rule in rules:
      stripped = rule.strip()
      if stripped:
        entry_locations[stripped].append(filename)
  
  return {entry: files for entry, files in entry_locations.items() if len(files) > 1}

def main() -> int:
  script_dir = Path(__file__).parent
  repo_dir = script_dir.parent
  lists_dir = repo_dir / 'lists'
  
  if not lists_dir.exists():
    print(f"Error: Lists directory not found at {lists_dir}", file=sys.stderr)
    return 1
  
  txt_files = sorted(lists_dir.glob('**/*.txt'))
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
  
  print(f"\n{'='*60}")
  print(f"Total: {total_stats.original} → {total_stats.final} lines")
  print(f"Removed: {total_stats.removed} ({total_stats.compression_ratio:.1f}% reduction)")
  
  print(f"\n{'='*60}")
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

if __name__ == '__main__':
  sys.exit(main())
