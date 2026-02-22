#!/usr/bin/env python3
"""
Move pure domain entries from adblock lists to hostlist files.
Pure domains are entries without AdGuard filter syntax (||, ##, $, @@, etc.)
"""
import sys
from pathlib import Path
from collections import defaultdict

# Import common utilities
if str(Path(__file__).parent) not in sys.path:
    sys.path.append(str(Path(__file__).parent))

from common import is_valid_domain

def is_pure_domain(line: str) -> bool:
    """Check if a line is a pure domain without AdGuard syntax"""
    line = line.strip()

    # Skip empty lines, comments, and common adblock start patterns
    if not line or line.startswith(('!', '#', '[', ';', '|', '@', '$', '^', '*', ']', '~')):
        return False


    # Validate as domain
    return is_valid_domain(line)

def categorize_domain(domain: str, source_file: str) -> str:
    """Determine which hostlist category a domain belongs to"""
    domain_lower = domain.lower()

    # Map based on source file name
    if 'spotify' in source_file.lower():
        return 'Spotify.txt'
    elif 'youtube' in source_file.lower() or 'twitch' in source_file.lower():
        return 'Social-Media.txt'
    elif 'reddit' in source_file.lower() or 'twitter' in source_file.lower():
        return 'Social-Media.txt'
    elif 'game' in source_file.lower():
        return 'Games.txt'

    # Map based on domain content
    if any(keyword in domain_lower for keyword in ['ad', 'ads', 'analytics', 'tracking', 'telemetry', 'metric']):
        return 'Ads.txt'
    elif any(keyword in domain_lower for keyword in ['social', 'facebook', 'twitter', 'instagram']):
        return 'Social-Media.txt'
    else:
        return 'Other.txt'

def scan_adblock_files(adblock_dir: Path) -> tuple[dict, dict]:
    """
    Scan adblock files, identify pure domains.
    Returns:
        domain_moves: dict[target_hostlist_file][source_file] -> list[domains]
        file_updates: dict[filepath] -> list[str] (new content for source file)
    """
    domain_moves = defaultdict(lambda: defaultdict(list))
    file_updates = {}

    # sorted glob for consistent order
    for adblock_file in sorted(adblock_dir.glob('*.txt')):
        print(f"Scanning: {adblock_file.name}")

        lines = read_lines(adblock_file)
        if lines is None:
            continue

        pure_domains = []
        filter_rules = []

        for line in lines:
            if is_pure_domain(line):
                pure_domains.append(line.strip())
            else:
                filter_rules.append(line)

        if pure_domains:
            print(f"  Found {len(pure_domains)} pure domains")
            file_updates[adblock_file] = filter_rules

            for domain in pure_domains:
                target_file = categorize_domain(domain, adblock_file.name)
                domain_moves[target_file][adblock_file.name].append(domain)

    return domain_moves, file_updates

def apply_updates(hostlist_dir: Path, domain_moves: dict, file_updates: dict) -> int:
    """Append domains to hostlists and update source files."""
    total_moved = 0

    print("\n" + "="*60)
    print("Appending domains to hostlist files")
    print("="*60 + "\n")

    for target_file, source_domains in sorted(domain_moves.items()):
        target_path = hostlist_dir / target_file
        all_domains = []

        # Collect all domains from different sources
        for _, domains in sorted(source_domains.items()):
            all_domains.extend(domains)

        if not all_domains:
            continue

        # Read existing hostlist
        existing_domains = set()
        if target_path.exists():
            lines = read_lines(target_path)
            if lines is None:
                continue
            for line in lines:
                stripped = line.strip()
                # Only track pure domains, not regex patterns
                if stripped and is_valid_domain(stripped):
                    existing_domains.add(stripped)

        # Filter out duplicates
        new_domains = [d for d in all_domains if d not in existing_domains]

        if new_domains:
            # Append new domains
            if write_lines(target_path, sorted(new_domains), mode='a'):
                total_moved += len(new_domains)
                print(f"Appended {len(new_domains)} domains to {target_file}")

    print("\n" + "="*60)
    print("Updating source adblock files")
    print("="*60 + "\n")

    for filepath, new_lines in file_updates.items():
        if write_lines(filepath, new_lines):
            print(f"Updated {filepath.name}")

    return total_moved

def main() -> int:
    script_dir = Path(__file__).parent
    repo_dir = script_dir.parent
    adblock_dir = repo_dir / 'lists' / 'adblock'
    hostlist_dir = repo_dir / 'lists' / 'hostlist'

    if not adblock_dir.exists():
        print(f"Error: Adblock directory not found at {adblock_dir}", file=sys.stderr)
        return 1

    if not hostlist_dir.exists():
        print(f"Error: Hostlist directory not found at {hostlist_dir}", file=sys.stderr)
        return 1

    print("="*60)
    print("Moving pure domain entries from adblock to hostlist")
    print("="*60 + "\n")

    # Extract pure domains from adblock files (read only)
    domain_moves, file_updates = scan_adblock_files(adblock_dir)

    if not domain_moves:
        print("\n✓ No pure domains found in adblock lists")
        return 0

    # Apply updates (write)
    total_moved = apply_updates(hostlist_dir, domain_moves, file_updates)

    print("\n" + "="*60)
    print(f"✓ Successfully moved {total_moved} pure domains to hostlist")
    print("="*60)

    return 0

if __name__ == '__main__':
    sys.exit(main())
