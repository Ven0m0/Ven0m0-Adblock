import hashlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_root = Path(__file__).parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from Scripts import build  # noqa: E402  (after sys.path bootstrap)


class TestShrinkGuard(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.out = Path(self._tmp.name) / "adblock.txt"
        self.header = "[uBlock Origin]\n! Title: Test\n"

    def _old(self, count: int) -> None:
        self.out.write_text(self.header + "\n".join(f"||ad{i}.com^" for i in range(count)) + "\n", encoding="utf-8")

    def test_count_rules_skips_headers_and_comments(self):
        text = "[uBlock Origin]\n! c\n# hosts comment\n\n||a.com^\n##.ad\nexample.com#@#.x\n"
        self.assertEqual(build._count_rules(text), 3)

    def test_writes_when_no_old_file(self):
        build._write_release(self.out, self.header, ["||a.com^"])
        self.assertIn("||a.com^", self.out.read_text(encoding="utf-8"))

    def test_dies_on_empty_build_and_keeps_old_file(self):
        self._old(4)
        before = self.out.read_text(encoding="utf-8")
        with self.assertRaises(SystemExit):
            build._write_release(self.out, self.header, [])
        self.assertEqual(self.out.read_text(encoding="utf-8"), before)

    def test_dies_when_rules_drop_below_ratio(self):
        self._old(10)
        with self.assertRaises(SystemExit):
            build._write_release(self.out, self.header, ["||a.com^", "||b.com^", "||c.com^", "||d.com^"])

    def test_allows_shrink_at_ratio(self):
        self._old(10)
        build._write_release(self.out, self.header, [f"||n{i}.com^" for i in range(5)])
        self.assertEqual(build._count_rules(self.out.read_text(encoding="utf-8")), 5)

    def test_override_env_allows_shrink_but_not_empty(self):
        self._old(10)
        with patch.dict(os.environ, {"BUILD_ALLOW_SHRINK": "1"}):
            build._write_release(self.out, self.header, ["||a.com^"])
            self.assertEqual(build._count_rules(self.out.read_text(encoding="utf-8")), 1)
            with self.assertRaises(SystemExit):
                build._write_release(self.out, self.header, [])


class TestCatalog(unittest.TestCase):
    def test_write_catalog_describes_built_lists(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            content = "[uBlock Origin]\n! Title: Test List\n! Version: 202601010000\n||a.com^\n||b.com^\n"
            list_path = out_dir / "adblock.txt"
            list_path.write_text(content, encoding="utf-8")
            on_disk = list_path.read_bytes()  # newline translation differs per platform
            with patch.object(build, "FILTER_OUT", out_dir):
                build.write_catalog()
            meta = json.loads((out_dir / "metadata.json").read_text(encoding="utf-8"))

        entry = meta["lists"][0]
        self.assertEqual(entry["file"], "adblock.txt")
        self.assertEqual(entry["title"], "Test List")
        self.assertEqual(entry["version"], "202601010000")
        self.assertEqual(entry["rules"], 2)
        self.assertEqual(entry["sha256"], hashlib.sha256(on_disk).hexdigest())
        self.assertEqual(entry["bytes"], len(on_disk))

    def test_write_catalog_dies_without_lists(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(build, "FILTER_OUT", Path(tmp)):
            self.assertRaises(SystemExit, build.write_catalog)


if __name__ == "__main__":
    unittest.main()
