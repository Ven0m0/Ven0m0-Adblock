"""Filter-list line grammar shared by every script that reads a list file."""

import re
from enum import StrEnum

from Scripts.common import is_valid_domain

# "!" covers every comment shape (including "!!!", "!---", "!/regex/" disabled rules);
# "# " needs the space so "##"/"#@#"/"#?#" cosmetic rules are not mistaken for comments.
COMMENT_PREFIXES = ("!", "# ", ";")
# AdGuard/uBO preprocessor directives: structural block markers, not comments.
# They must keep their exact position and must never be deduplicated away -
# nested "!#if"/"!#endif" pairs can repeat identical text per block.
DIRECTIVE_PREFIXES = ("!#if", "!#endif", "!#else", "!#include")
MAX_NETWORK_RULE_LEN = 2048

_COSMETIC_RE = re.compile(r"#[@$%?]*#")
# The only network rule a hosts file can express: a bare host with no modifiers.
_HOST_BLOCK_RE = re.compile(r"^\|\|([^/^$*|\s]+)\^$")


class Kind(StrEnum):
    BLANK = "blank"
    COMMENT = "comment"
    HEADER = "header"
    DIRECTIVE = "directive"
    COSMETIC = "cosmetic"
    EXCEPTION = "exception"
    NETWORK = "network"
    DOMAIN = "domain"


_NOT_RULES = frozenset({Kind.BLANK, Kind.COMMENT, Kind.HEADER, Kind.DIRECTIVE})


def classify(line: str) -> Kind:
    """Say what kind of list line this is. Order matters: directives are comments by prefix."""
    s = line.strip()
    if not s:
        return Kind.BLANK
    if s.startswith(DIRECTIVE_PREFIXES):
        return Kind.DIRECTIVE
    if s.startswith(COMMENT_PREFIXES):
        return Kind.COMMENT
    if s.startswith("["):
        return Kind.HEADER
    if _COSMETIC_RE.search(s):
        return Kind.COSMETIC
    if s.startswith("@@"):
        return Kind.EXCEPTION
    if is_valid_domain(s):
        return Kind.DOMAIN
    return Kind.NETWORK


def is_rule(line: str) -> bool:
    """True for lines that block, hide, or allow something."""
    return classify(line) not in _NOT_RULES


def is_valid(line: str) -> bool:
    """Basic validation for filter rules."""
    s = line.strip()
    kind = classify(s)
    if kind is Kind.BLANK:
        return False
    # Selectors and scriptlets legitimately exceed the network-rule length cap.
    if kind is Kind.COSMETIC:
        return True
    if len(s) > MAX_NETWORK_RULE_LEN:
        return False
    if s.startswith(("||", "@@||")):
        # Domain part: drop the leading ||/@@|| and stop at ^ or $ options.
        return is_valid_domain(s.split("^", maxsplit=1)[0].lstrip("|@"))
    return True


def blocked_host(line: str) -> str | None:
    """The host a hosts file should null-route for this line, or None.

    Cosmetic rules, exceptions and modified network rules name a domain but do not
    block it outright, so they yield nothing.
    """
    s = line.strip()
    kind = classify(s)
    if kind is Kind.DOMAIN:
        return s.lower()
    if kind is Kind.NETWORK and (m := _HOST_BLOCK_RE.match(s)) and is_valid_domain(m.group(1)):
        return m.group(1).lower()
    return None
