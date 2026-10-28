"""Turn a userscript source file into its published .meta.js and .user.js text."""

import re
from collections.abc import Callable
from dataclasses import dataclass

META_START = "// ==UserScript=="
META_END = "// ==/UserScript=="
# Below this the minifier almost certainly produced an empty or truncated bundle.
MIN_MINIFIED_LEN = 50


@dataclass(frozen=True, slots=True)
class Packaged:
    meta: str  # contents of <base>.meta.js
    script: str  # contents of <base>.user.js


def _split(source: str) -> tuple[list[str], list[str]]:
    meta: list[str] = []
    code: list[str] = []
    in_meta = after_meta = False
    for line in source.splitlines():
        if line.strip() == META_START:
            in_meta = True
            meta.append(line)
        elif line.strip() == META_END:
            in_meta = False
            after_meta = True
        elif in_meta:
            meta.append(line)
        elif after_meta:
            code.append(line)
    return meta, code


def package(source: str, base: str, *, repo: str, dist: str, minify: Callable[[str], str]) -> Packaged:
    """Rewrite the metadata block to point at `dist` and minify the code below it.

    `minify` maps code to minified code and raises ValueError on failure.
    Raises ValueError when the source cannot be packaged.
    """
    meta_lines, code_lines = _split(source)
    if not meta_lines or not code_lines:
        raise ValueError("missing metadata or code block")  # noqa: EM101, TRY003

    raw = f"https://raw.githubusercontent.com/{repo}/main/{dist}/{base}"
    kept: list[str] = []
    for line in meta_lines:
        if re.match(r"^// @(name|description):", line) and ": en" not in line:
            continue
        line = re.sub(r"^(// @downloadURL).*", rf"\1 {raw}.user.js", line)
        line = re.sub(r"^(// @updateURL).*", rf"\1 {raw}.meta.js", line)
        kept.append(line)

    js = minify("\n".join(code_lines))
    if len(js) < MIN_MINIFIED_LEN:
        raise ValueError(f"{len(js)} bytes, suspiciously small")  # noqa: EM102, TRY003

    meta = "\n".join(kept)
    return Packaged(meta=meta + "\n", script=meta + "\n" + js + "\n")
