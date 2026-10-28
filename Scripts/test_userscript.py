import unittest

from Scripts.userscript import package

SOURCE = """// ==UserScript==
// @name         Demo
// @name:de      Demo DE
// @description  en
// @downloadURL  https://old.example/demo.user.js
// @updateURL    https://old.example/demo.meta.js
// ==/UserScript==
const answer = 42;
console.log(answer);
"""


def _identity(code: str) -> str:
    return code.strip() + " " * 50  # long enough to pass the size check


def _package(source: str = SOURCE, minify=_identity):
    return package(source, "demo", repo="o/r", dist="userscripts/dist", minify=minify)


class TestPackage(unittest.TestCase):
    def test_points_update_urls_at_dist(self):
        meta = _package().meta
        self.assertIn("// @downloadURL https://raw.githubusercontent.com/o/r/main/userscripts/dist/demo.user.js", meta)
        self.assertIn("// @updateURL https://raw.githubusercontent.com/o/r/main/userscripts/dist/demo.meta.js", meta)
        self.assertNotIn("old.example", meta)

    def test_drops_localized_name(self):
        self.assertNotIn("@name:de", _package().meta)
        self.assertIn("// @name         Demo", _package().meta)

    def test_script_is_meta_then_minified_code(self):
        seen = []

        def spy(code: str) -> str:
            seen.append(code)
            return _identity(code)

        out = _package(minify=spy)
        self.assertEqual(seen, ["const answer = 42;\nconsole.log(answer);"])
        self.assertTrue(out.script.startswith(out.meta))
        self.assertIn("console.log(answer);", out.script)

    def test_missing_metadata_raises(self):
        with self.assertRaises(ValueError):
            _package("const x = 1;\n")

    def test_missing_code_raises(self):
        with self.assertRaises(ValueError):
            _package("// ==UserScript==\n// @name X\n// ==/UserScript==\n")

    def test_tiny_output_raises(self):
        with self.assertRaises(ValueError):
            _package(minify=lambda _: "x")

    def test_minifier_failure_propagates(self):
        def boom(_: str) -> str:
            raise ValueError("esbuild failed")

        with self.assertRaises(ValueError):
            _package(minify=boom)


if __name__ == "__main__":
    unittest.main()
