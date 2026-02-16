"""
Common utilities and constants for Ven0m0-Adblock scripts.
"""
import re
import hashlib
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

    # Use MD5 here for backward-compatible filename generation with the original update-lists.py.
    # This hash is for stable naming only and is not used for security purposes.
    url_hash = hashlib.md5(url.encode("utf-8")).hexdigest()[:12]
    domain = re.search(r'://([^/]+)', url)
    domain_part = domain.group(1).replace('.', '-') if domain else 'list'
    return f"{domain_part}-{url_hash}.txt"
