"""Common utilities and constants for Ven0m0-Adblock scripts."""

import os
import re
import shutil
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Final

# ============================================================================
# ANSI COLORS
# ============================================================================
_color: bool = not os.environ.get("NO_COLOR") and (sys.stdout.isatty() or bool(os.environ.get("FORCE_COLOR")))
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
    return datetime.now(UTC).strftime("%Y%m%d%H%M")


def ts_read() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")


# ============================================================================
# DOMAIN / FILTER UTILITIES
# ============================================================================

DOMAIN_PATTERN: Final[re.Pattern] = re.compile(
    r"^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?(?:\.[a-z0-9](?:[-a-z0-9]*[a-z0-9])?)*\.[a-z]{2,}$",
    re.IGNORECASE,
)


def is_valid_domain(domain: str) -> bool:
    """Check if a string is a valid domain name."""
    return bool(DOMAIN_PATTERN.match(domain))


def read_lines(filepath: Path) -> list[str]:
    """Read right-stripped lines. Raises OSError or UnicodeError."""
    with filepath.open("r", encoding="utf-8") as f:
        return [line.rstrip() for line in f]


def write_lines(filepath: Path, lines: list[str], *, append: bool = False) -> None:
    """Write lines, replacing the file atomically unless appending. Raises OSError or UnicodeError."""
    text = "\n".join(lines) + "\n" if lines else ""
    if append:
        with filepath.open("a", encoding="utf-8", newline="\n") as f:
            f.write(text)
        return

    # Temp file in the same directory so the replace stays on one filesystem.
    fd, temp_path = tempfile.mkstemp(dir=filepath.parent, text=True)
    tmp = Path(temp_path)
    try:
        # open() here wraps the fd from mkstemp; Path.open cannot.
        with open(fd, "w", encoding="utf-8", newline="\n") as f:  # noqa: PTH123
            f.write(text)
        tmp.replace(filepath)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise
