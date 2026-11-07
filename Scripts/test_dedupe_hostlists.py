import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from Scripts.dedupe_hostlists import dedupe_across, main


class TestDedupeHostlists(unittest.TestCase):
    def test_priority_file_keeps_shared_entry(self):
        result = dedupe_across(
            {
                "Spotify.txt": ["! aglint-disable", "shared.com", "only-spotify.com"],
                "Ads.txt": ["! aglint-disable", "shared.com"],
            }
        )
        self.assertEqual(result["Ads.txt"], ["! aglint-disable", "shared.com"])
        self.assertEqual(result["Spotify.txt"], ["! aglint-disable", "only-spotify.com"])

    def test_unlisted_files_follow_alphabetically(self):
        result = dedupe_across({"Games.txt": ["x.com"], "Native.txt": ["x.com"]})
        self.assertEqual(result["Games.txt"], ["x.com"])
        self.assertEqual(result["Native.txt"], [])

    def test_exempt_file_is_untouched_and_never_a_keeper(self):
        result = dedupe_across(
            {
                "Android.txt": ["shared.com", "shared.com"],
                "Ads.txt": ["shared.com"],
                "Spotify.txt": ["shared.com"],
            }
        )
        self.assertEqual(result["Android.txt"], ["shared.com", "shared.com"])
        self.assertEqual(result["Ads.txt"], ["shared.com"])
        self.assertEqual(result["Spotify.txt"], [])

    def test_comments_and_blank_lines_are_kept(self):
        lines = ["! shared.com", "# shared.com", "", "x.com"]
        self.assertEqual(dedupe_across({"Ads.txt": ["x.com"], "Other.txt": lines})["Other.txt"], lines[:3])

    def test_main_rewrites_files_and_keeps_them_separate(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "Ads.txt").write_text("a.com\nb.com\n", encoding="utf-8")
            (root / "Spotify.txt").write_text("b.com\nc.com\n", encoding="utf-8")
            with patch("sys.argv", ["dedupe_hostlists.py", str(root)]):
                self.assertEqual(main(), 0)
            self.assertEqual((root / "Ads.txt").read_text(encoding="utf-8"), "a.com\nb.com\n")
            self.assertEqual((root / "Spotify.txt").read_text(encoding="utf-8"), "c.com\n")
            self.assertEqual(sorted(p.name for p in root.iterdir()), ["Ads.txt", "Spotify.txt"])


if __name__ == "__main__":
    unittest.main()
