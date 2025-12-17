#!/usr/bin/env python3
"""
Deduplicate blocklist files
- Removes duplicate entries within each file
- Removes empty lines and whitespace-only lines
- Sorts entries for better organization
- Preserves line endings
"""

import os
import sys
from pathlib import Path


def deduplicate_file(filepath):
  """Deduplicate entries in a single file"""
  print(f"Processing: {filepath}")

  try:
    with open(filepath, 'r', encoding='utf-8') as f:
      lines = f.readlines()
  except Exception as e:
    print(f"  Error reading file: {e}")
    return False

  original_count = len(lines)

  # Remove duplicates while preserving order, then sort
  seen = set()
  unique_lines = []

  for line in lines:
    # Strip trailing whitespace but keep the content
    stripped = line.rstrip()

    # Skip empty lines
    if not stripped:
      continue

    # Check if we've seen this line before (case-sensitive)
    if stripped not in seen:
      seen.add(stripped)
      unique_lines.append(stripped)

  # Sort the unique lines
  unique_lines.sort()

  deduplicated_count = len(unique_lines)
  removed_count = original_count - deduplicated_count

  # Write back to file with LF line endings
  try:
    with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
      for line in unique_lines:
        f.write(line + '\n')
  except Exception as e:
    print(f"  Error writing file: {e}")
    return False

  print(f"  Original: {original_count} lines")
  print(f"  After deduplication: {deduplicated_count} lines")
  print(f"  Removed: {removed_count} duplicates/empty lines")

  return True


def main():
  # Get the lists directory
  script_dir = Path(__file__).parent
  repo_dir = script_dir.parent
  lists_dir = repo_dir / 'lists'

  if not lists_dir.exists():
    print(f"Error: Lists directory not found at {lists_dir}")
    sys.exit(1)

  # Find all .txt files in the lists directory
  txt_files = sorted(lists_dir.glob('*.txt'))

  if not txt_files:
    print("No .txt files found in lists directory")
    sys.exit(1)

  print(f"Found {len(txt_files)} files to process\n")

  success_count = 0
  for filepath in txt_files:
    if deduplicate_file(filepath):
      success_count += 1
    print()

  print(f"Successfully processed {success_count}/{len(txt_files)} files")


if __name__ == '__main__':
  main()
