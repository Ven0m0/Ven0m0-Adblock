#!/usr/bin/env python3
"""
Check for and report duplicate entries across different blocklist files
This helps identify entries that appear in multiple lists
"""

import sys
from pathlib import Path
from collections import defaultdict


def find_cross_file_duplicates(lists_dir):
  """Find entries that appear in multiple files"""

  # Dictionary to track which files contain each entry
  entry_locations = defaultdict(list)

  # Read all files
  txt_files = sorted(lists_dir.glob('*.txt'))

  print(f"Scanning {len(txt_files)} files for cross-file duplicates...\n")

  for filepath in txt_files:
    filename = filepath.name
    try:
      with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
          stripped = line.strip()
          if stripped:
            entry_locations[stripped].append(filename)
    except Exception as e:
      print(f"Error reading {filename}: {e}")

  # Find duplicates
  duplicates = {entry: files for entry, files in entry_locations.items() if len(files) > 1}

  if duplicates:
    print(f"Found {len(duplicates)} entries that appear in multiple files:\n")

    # Group by file combinations for better readability
    file_groups = defaultdict(list)
    for entry, files in duplicates.items():
      file_key = tuple(sorted(files))
      file_groups[file_key].append(entry)

    for files, entries in sorted(file_groups.items()):
      print(f"\n{len(entries)} entries appear in: {', '.join(files)}")
      for entry in sorted(entries)[:10]:  # Show first 10
        print(f"  - {entry}")
      if len(entries) > 10:
        print(f"  ... and {len(entries) - 10} more")

    return True
  else:
    print("✓ No cross-file duplicates found!")
    return False


def main():
  script_dir = Path(__file__).parent
  repo_dir = script_dir.parent
  lists_dir = repo_dir / 'lists'

  if not lists_dir.exists():
    print(f"Error: Lists directory not found at {lists_dir}")
    sys.exit(1)

  has_duplicates = find_cross_file_duplicates(lists_dir)

  if has_duplicates:
    print("\n" + "="*60)
    print("Note: Cross-file duplicates are not automatically removed.")
    print("Review the duplicates above to determine if they should be")
    print("consolidated into a single file or kept separate by design.")
    print("="*60)


if __name__ == '__main__':
  main()
