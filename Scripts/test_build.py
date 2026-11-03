import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_root = Path(__file__).parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from Scripts import build  # noqa: E402  (after sys.path bootstrap)

SOURCE = """// ==UserScript==
// @name         Demo
// @downloadURL  https://old.example/demo.user.js
// ==/UserScript==
console.log("demo");
"""
MINIFIED = 'console.log("demo");' + " " * 50


def _missing(*_args, **_kwargs):
    raise FileNotFoundError


class TestRunJs(unittest.TestCase):
    def test_missing_tool_is_a_failed_run_not_an_exception(self):
        with patch.object(build, "_js_runner", return_value=None), patch("subprocess.run", side_effect=_missing):
            result = build._run_js("esbuild", "--minify")
        self.assertEqual(result.returncode, build.TOOL_MISSING)
        self.assertIn(b"esbuild", result.stderr)

    def test_prefixes_bun_x_when_available(self):
        done = subprocess.CompletedProcess([], 0)
        with (
            patch.object(build, "_js_runner", return_value=["bun", "x"]),
            patch("subprocess.run", return_value=done) as run,
        ):
            build._run_js("esbuild")
        self.assertEqual(run.call_args.args[0], ["bun", "x", "esbuild"])


class TestMinify(unittest.TestCase):
    def test_missing_esbuild_raises_value_error(self):
        with (
            patch.object(build, "_js_runner", return_value=None),
            patch("subprocess.run", side_effect=_missing),
            self.assertRaises(ValueError) as cm,
        ):
            build._minify("x")
        self.assertIn("esbuild failed", str(cm.exception))

    def test_failure_carries_stderr(self):
        failed = subprocess.CompletedProcess([], 1, b"", b"syntax error")
        with patch.object(build, "_run_js", return_value=failed), self.assertRaises(ValueError) as cm:
            build._minify("x")
        self.assertIn("syntax error", str(cm.exception))


class TestBuildUserscripts(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.src = Path(tmp.name) / "src"
        self.out = Path(tmp.name) / "dist"
        self.src.mkdir()
        for name, patcher in {
            "SCRIPT_SRC": self.src,
            "SCRIPT_OUT": self.out,
        }.items():
            p = patch.object(build, name, patcher)
            p.start()
            self.addCleanup(p.stop)
        for p in (
            patch.object(build, "_js_runner", return_value=["bun", "x"]),
            patch.object(build, "has", return_value=False),  # skip the real oxlint/biome passes
        ):
            p.start()
            self.addCleanup(p.stop)

    def test_builds_every_script(self):
        (self.src / "demo.user.js").write_text(SOURCE, encoding="utf-8")
        with patch.object(build, "_minify", return_value=MINIFIED):
            build.build_userscripts()
        self.assertTrue((self.out / "demo.user.js").exists())
        self.assertTrue((self.out / "demo.meta.js").exists())

    def test_missing_minifier_fails_each_file_without_aborting_the_build(self):
        (self.src / "a.user.js").write_text(SOURCE, encoding="utf-8")
        (self.src / "b.user.js").write_text(SOURCE, encoding="utf-8")
        with patch("subprocess.run", side_effect=_missing):
            build.build_userscripts()  # must not raise FileNotFoundError
        self.assertEqual(list(self.out.glob("*.user.js")), [])


if __name__ == "__main__":
    unittest.main()
