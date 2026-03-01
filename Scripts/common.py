"""
Common utilities and constants for Ven0m0-Adblock scripts.
"""
import sys
from pathlib import Path
import re
import hashlib
import os
import tempfile
from typing import Final

# Regex to match pure domain names (basic validation)
# RFC 1035: labels limited to 63 chars, start with alphanumeric, end with alphanumeric
# This regex is a simplified version commonly used in adblock lists
DOMAIN_PATTERN: Final[re.Pattern] = re.compile(
    r'^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?(?:\.[a-z0-9](?:[-a-z0-9]*[a-z0-9])?)*\.[a-z]{2,}$',
    re.IGNORECASE
)

# AdGuard syntax indicators - if a line contains these, it's NOT a pure domain
ADGUARD_INDICATORS: Final[list[str]] = [
    '||', '##', '#@#', '#?#', '@@', '$', '^', '*', '!', '[', ']',
    '##.', '###', '##:', '~', '|'
]
ADGUARD_INDICATORS_REGEX: Final[re.Pattern] = re.compile(
    '|'.join(map(re.escape, ADGUARD_INDICATORS))
)

def is_valid_domain(domain: str) -> bool:
    """Check if a string is a valid domain name."""
    return bool(DOMAIN_PATTERN.match(domain))

def is_adguard_rule(line: str) -> bool:
    """
    Check if a line contains AdGuard/uBlock Origin syntax indicators.
    Returns True if it looks like a rule, False if it might be a pure domain or something else.
    """
    if ADGUARD_INDICATORS_REGEX.search(line):
        return True
    return False

def sanitize_filename(url: str, name: str | None = None) -> str:
    """Generate safe filename from URL or provided name."""
    if name:
        safe = re.sub(r'[^\w\-.]', '-', name)
        return f"{safe}.txt" if not safe.endswith('.txt') else safe

    # Use SHA-256 here for filename generation.
    # This hash is for stable naming only and is not used for security purposes.
    url_hash = hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]
    domain = re.search(r'://([^/]+)', url)
    domain_part = domain.group(1).replace('.', '-') if domain else 'list'
    return f"{domain_part}-{url_hash}.txt"

def read_lines(filepath: Path) -> list[str] | None:
    """Read lines from file. Returns None on error."""
    try:
        with filepath.open('r', encoding='utf-8') as f:
            return [line.rstrip() for line in f]
    except (OSError, UnicodeError) as e:
        print(f"  Error reading {filepath}: {e}", file=sys.stderr)
        return None

def write_lines(filepath: Path, lines: list[str], mode: str = 'w') -> bool:
    """Write lines to file. Returns True on success."""
    import tempfile
    import os
    try:
        if mode == 'a':
            with filepath.open(mode, encoding='utf-8', newline='\n') as f:
                for line in lines:
                    f.write(f"{line}\n")
            return True

        # Write to a temporary file in the same directory to ensure atomic replace
        # handles cross-device link issues
        fd, temp_path = tempfile.mkstemp(dir=filepath.parent, text=True)
        try:
            with open(fd, 'w', encoding='utf-8', newline='\n') as f:
                for line in lines:
                    f.write(f"{line}\n")

            os.replace(temp_path, filepath)
            return True
        except Exception:
            os.unlink(temp_path)
            raise
    except (OSError, UnicodeError) as e:
        print(f"  Error writing {filepath}: {e}", file=sys.stderr)
        return False
