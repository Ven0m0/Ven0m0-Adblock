#!/usr/bin/env python3
"""
Move pure domain entries from adblock lists to hostlist files.
Pure domains are entries without AdGuard filter syntax (||, ##, $, @@, etc.)
"""
import sys
import re
from pathlib import Path
from collections import defaultdict

# Regex to match pure domain names (basic validation)
DOMAIN_PATTERN = re.compile(r'^[a-z0-9][-a-z0-9]{0,61}(?:\.[a-z0-9][-a-z0-9]{0,61})+\.[a-z]{2,}$', re.I)

# AdGuard syntax indicators - if a line contains these, it's NOT a pure domain
ADGUARD_INDICATORS = [
    '||', '##', '#@#', '#?#', '@@', '$', '^', '*', '!', '[', ']',
    '##.', '###', '##:', '~', '|'
]

def is_pure_domain(line: str) -> bool:
    """Check if a line is a pure domain without AdGuard syntax"""
    line = line.strip()

    # Skip empty lines and comments
    if not line or line.startswith(('!', '#', '[', ';')):
        return False

    # Check for AdGuard syntax indicators
    for indicator in ADGUARD_INDICATORS:
        if indicator in line:
            return False

    # Validate as domain
    return bool(DOMAIN_PATTERN.match(line))

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

def process_adblock_files(adblock_dir: Path, hostlist_dir: Path) -> dict:
    """Process all adblock files and extract pure domains"""
    domain_moves = defaultdict(lambda: defaultdict(list))
    files_processed = 0

    for adblock_file in sorted(adblock_dir.glob('*.txt')):
        print(f"Processing: {adblock_file.name}")

        try:
            with adblock_file.open('r', encoding='utf-8') as f:
                lines = [line.rstrip() for line in f]
        except Exception as e:
            print(f"  Error reading: {e}", file=sys.stderr)
            continue

        # Separate pure domains from filter rules
        pure_domains = []
        filter_rules = []

        for line in lines:
            if is_pure_domain(line):
                pure_domains.append(line.strip())
            else:
                filter_rules.append(line)

        if pure_domains:
            files_processed += 1
            print(f"  Found {len(pure_domains)} pure domains")

            # Write back filter rules only
            try:
                with adblock_file.open('w', encoding='utf-8', newline='\n') as f:
                    for line in filter_rules:
                        f.write(f"{line}\n")
            except Exception as e:
                print(f"  Error writing: {e}", file=sys.stderr)
                continue

            # Categorize domains for hostlist
            for domain in pure_domains:
                target_file = categorize_domain(domain, adblock_file.name)
                domain_moves[target_file][adblock_file.name].append(domain)

    return domain_moves

def append_to_hostlist(hostlist_dir: Path, domain_moves: dict) -> None:
    """Append pure domains to appropriate hostlist files"""
    total_moved = 0

    for target_file, source_domains in sorted(domain_moves.items()):
        target_path = hostlist_dir / target_file
        all_domains = []

        # Collect all domains from different sources
        for source_file, domains in sorted(source_domains.items()):
            all_domains.extend(domains)

        if not all_domains:
            continue

        # Read existing hostlist
        existing_domains = set()
        if target_path.exists():
            try:
                with target_path.open('r', encoding='utf-8') as f:
                    for line in f:
                        stripped = line.strip()
                        # Only track pure domains, not regex patterns
                        if stripped and DOMAIN_PATTERN.match(stripped):
                            existing_domains.add(stripped)
            except Exception as e:
                print(f"Error reading {target_file}: {e}", file=sys.stderr)

        # Filter out duplicates
        new_domains = [d for d in all_domains if d not in existing_domains]

        if new_domains:
            # Append new domains
            try:
                with target_path.open('a', encoding='utf-8', newline='\n') as f:
                    for domain in sorted(new_domains):
                        f.write(f"{domain}\n")
                total_moved += len(new_domains)
                print(f"Appended {len(new_domains)} domains to {target_file}")
            except Exception as e:
                print(f"Error writing to {target_file}: {e}", file=sys.stderr)

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

    # Extract pure domains from adblock files
    domain_moves = process_adblock_files(adblock_dir, hostlist_dir)

    if not domain_moves:
        print("\n✓ No pure domains found in adblock lists")
        return 0

    print("\n" + "="*60)
    print("Appending domains to hostlist files")
    print("="*60 + "\n")

    # Append to hostlist files
    total_moved = append_to_hostlist(hostlist_dir, domain_moves)

    print("\n" + "="*60)
    print(f"✓ Successfully moved {total_moved} pure domains to hostlist")
    print("="*60)

    return 0

if __name__ == '__main__':
    sys.exit(main())
