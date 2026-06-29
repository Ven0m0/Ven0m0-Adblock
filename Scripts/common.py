"""
Common utilities and constants for Ven0m0-Adblock scripts.
"""

import hashlib
import os
import re
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Final

# ============================================================================
# ANSI COLORS
# ============================================================================
_color: bool = not os.environ.get("NO_COLOR") and (
    sys.stdout.isatty() or bool(os.environ.get("FORCE_COLOR"))
)
R: Final = "\x1b[31m" if _color else ""
G: Final = "\x1b[32m" if _color else ""
Y: Final = "\x1b[33m" if _color else ""
B: Final = "\x1b[34m" if _color else ""
C: Final = "\x1b[36m" if _color else ""
N: Final = "\x1b[0m" if _color else ""

# ============================================================================
# LOGGING
# ============================================================================


def log(tag: str, msg: str) -> None:
    print(f"{B}[{tag}]{N} {msg}", flush=True)


def ok(msg: str) -> None:
    print(f"{G}✓{N} {msg}", flush=True)


def err(msg: str) -> None:
    print(f"{R}✗{N} {msg}", file=sys.stderr, flush=True)


def warn(msg: str) -> None:
    print(f"{Y}⚠{N} {msg}", file=sys.stderr, flush=True)


def dbg(msg: str) -> None:
    if os.environ.get("DEBUG") == "1":
        print(f"{C}[dbg]{N} {msg}", file=sys.stderr, flush=True)


def die(msg: str, code: int = 1) -> None:
    err(msg)
    sys.exit(code)


# ============================================================================
# UTILITIES
# ============================================================================


def has(cmd: str) -> bool:
    return shutil.which(cmd) is not None


def ncpu() -> int:
    return os.cpu_count() or 4


def ts_short() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M")


def ts_read() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


# ============================================================================
# DOMAIN / FILTER UTILITIES
# ============================================================================

DOMAIN_PATTERN: Final[re.Pattern] = re.compile(
    r"^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?(?:\.[a-z0-9](?:[-a-z0-9]*[a-z0-9])?)*\.[a-z]{2,}$",
    re.IGNORECASE,
)

ADGUARD_INDICATORS: Final[list[str]] = [
    "||",
    "##",
    "#@#",
    "#?#",
    "@@",
    "$",
    "^",
    "*",
    "!",
    "[",
    "]",
    "##.",
    "###",
    "##:",
    "~",
    "|",
]


def is_valid_domain(domain: str) -> bool:
    """Check if a string is a valid domain name."""
    return bool(DOMAIN_PATTERN.match(domain))


def sanitize_filename(url: str, name: str | None = None) -> str:
    """Generate safe filename from URL or provided name."""
    if name:
        safe = re.sub(r"[^\w\-.]", "-", name)
        return f"{safe}.txt" if not safe.endswith(".txt") else safe

    # SHA-256 for stable naming only, not security.
    url_hash = hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]
    domain = re.search(r"://([^/]+)", url)
    domain_part = (
        domain.group(1).replace(".", "-").replace(":", "-") if domain else "list"
    )
    return f"{domain_part}-{url_hash}.txt"


def read_lines(filepath: Path) -> list[str] | None:
    """Read lines from file. Returns None on error."""
    try:
        with filepath.open("r", encoding="utf-8") as f:
            return [line.rstrip() for line in f]
    except (OSError, UnicodeError) as e:
        print(f"  Error reading {filepath}: {e}", file=sys.stderr)
        return None


def write_lines(filepath: Path, lines: list[str], mode: str = "w") -> bool:
    """Write lines to file. Returns True on success."""
    try:
        if mode == "a":
            with filepath.open(mode, encoding="utf-8", newline="\n") as f:
                if lines:
                    f.write("\n".join(lines) + "\n")
            return True

        # Atomic replace via temp file in same directory.
        fd, temp_path = tempfile.mkstemp(dir=filepath.parent, text=True)
        try:
            with open(fd, "w", encoding="utf-8", newline="\n") as f:
                if lines:
                    f.write("\n".join(lines) + "\n")
            os.replace(temp_path, filepath)
            return True
        except Exception:
            os.unlink(temp_path)
            raise
    except (OSError, UnicodeError) as e:
        print(f"  Error writing {filepath}: {e}", file=sys.stderr)
        return False
