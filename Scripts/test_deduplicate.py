import sys
import tempfile
import unittest
from io import StringIO
from pathlib import Path
from unittest.mock import patch

# Add current directory to path to allow importing deduplicate
from Scripts.deduplicate import (
    find_cross_file_duplicates,
    is_header,
    is_valid_rule,
    main,
    process_content,
)


class TestDeduplicate(unittest.TestCase):
    def test_process_content_keeps_comments(self):
        lines = [
            "! Header line 1",
            "! Header line 2",
            "rule1.com",
            "! Comment for rule2",
            "rule2.com",
            "! Comment for rule3",
            "rule3.com",
            "! Another comment for rule3",
            "rule3.com",
            "! Comment for rule4",
            "rule4.com",
        ]

        headers, rules, _stats = process_content(lines)

        expected_headers = ["! Header line 1", "! Header line 2"]

        # rule3.com appears twice, the second instance should be ignored
        # along with its preceding comment "! Another comment for rule3".
        expected_rules = [
            "rule1.com",
            "! Comment for rule2",
            "rule2.com",
            "! Comment for rule3",
            "rule3.com",
            "! Comment for rule4",
            "rule4.com",
        ]

        self.assertEqual(headers, expected_headers)
        self.assertEqual(rules, expected_rules)

    def test_process_content_keeps_section_comments_above_their_rules(self):
        # Regression: comments used to travel with the first rule of a run and
        # get scattered by the sort, and "#"-prefixed cosmetic rules were
        # mistaken for comments, clumping every heading at the top of the file.
        lines = [
            "! header",
            "! Cosmetic",
            "##.zed",
            "##.alpha",
            "! Tracking params",
            "$removeparam=utm_source",
            "$removeparam=utm_campaign",
            "!!! Old section",
            "||b.com^",
            "||a.com^",
        ]

        headers, rules, _stats = process_content(lines)

        self.assertEqual(headers, ["! header", "! Cosmetic"])
        self.assertEqual(
            rules,
            [
                "##.alpha",
                "##.zed",
                "! Tracking params",
                "$removeparam=utm_source",
                "$removeparam=utm_campaign",
                "!!! Old section",
                "||b.com^",
                "||a.com^",
            ],
        )

    def test_process_content_keeps_blank_lines_as_run_boundaries(self):
        lines = [
            "! header",
            "",
            "aaa.com",
            "! Heading",
            "zzz.com",
            "",
            "ccc.com",
            "bbb.com",
            "",
        ]

        _headers, rules, _stats = process_content(lines)

        # Headed run keeps author order; the unheaded run after the blank is sorted.
        self.assertEqual(rules, ["aaa.com", "! Heading", "zzz.com", "", "bbb.com", "ccc.com"])

    def test_process_content_preserves_directive_blocks(self):
        # Regression: !#if/!#endif must keep exact position and must never
        # be deduplicated, since nested blocks repeat identical directive
        # text (e.g. three nested "!#endif" closing three "!#if" blocks).
        lines = [
            "! header",
            "",
            "zzz.com",
            "!#if !adguard",
            "aaa.com",
            "aaa.com",
            "!#if !env_mv3",
            "bbb.com",
            "!#endif",
            "!#endif",
            "ccc.com",
        ]

        headers, rules, _stats = process_content(lines)

        self.assertEqual(headers, ["! header", ""])
        self.assertEqual(
            rules,
            [
                "zzz.com",
                "!#if !adguard",
                "aaa.com",
                "!#if !env_mv3",
                "bbb.com",
                "!#endif",
                "!#endif",
                "ccc.com",
            ],
        )

    def test_process_content_dedup_is_segment_local(self):
        # A rule repeated inside a different conditional block must survive:
        # collapsing it globally could remove it from a branch that needs it.
        lines = [
            "!#if adguard",
            "same.com",
            "!#endif",
            "!#if !adguard",
            "same.com",
            "!#endif",
        ]

        _headers, rules, _stats = process_content(lines)

        self.assertEqual(
            rules,
            [
                "!#if adguard",
                "same.com",
                "!#endif",
                "!#if !adguard",
                "same.com",
                "!#endif",
            ],
        )

    def test_is_header(self):
        # Valid headers with prefixes
        self.assertTrue(is_header("! This is a comment"))
        self.assertTrue(is_header("# This is also a comment"))
        self.assertTrue(is_header("[Adblock Plus 2.0]"))
        self.assertTrue(is_header("; Semicolon comment"))
        self.assertTrue(is_header("!!! Old Reddit"))
        self.assertTrue(is_header("!/disabled-rule/$doc"))

        # Empty lines
        self.assertTrue(is_header(""))

        # Non-headers
        self.assertFalse(is_header("||example.com^"))
        self.assertFalse(is_header("example.com##.ad"))
        self.assertFalse(is_header("example.com"))
        self.assertFalse(is_header("@@||example.com"))
        self.assertFalse(is_header("##.ad"))
        self.assertFalse(is_header("###banner"))
        self.assertFalse(is_header("example.com#@#.ad"))

    def test_is_valid_rule(self):
        # Valid rules
        self.assertTrue(is_valid_rule("example.com"))
        self.assertTrue(is_valid_rule("||example.com^"))
        self.assertTrue(is_valid_rule("@@||example.com"))
        self.assertTrue(is_valid_rule("example.com$domain=example.com"))
        self.assertTrue(is_valid_rule("||example.com^$important"))

        # Empty or too long
        self.assertFalse(is_valid_rule(""))
        long_line = "a" * 2049
        self.assertFalse(is_valid_rule(long_line))

        # Exactly 2048 chars should be valid
        max_line = "a" * 2048
        self.assertTrue(is_valid_rule(max_line))

        # Cosmetic rules and scriptlets are exempt from the network-rule length cap
        self.assertTrue(is_valid_rule("example.com##" + "a" * 3000))
        self.assertTrue(is_valid_rule("#%#" + "a" * 3000))

        # Invalid domain patterns
        self.assertFalse(is_valid_rule("||invalid^"))
        self.assertFalse(is_valid_rule("||-start.com^"))
        self.assertFalse(is_valid_rule("||end-.com^"))

    def test_find_cross_file_duplicates(self):
        file_rules = {
            "file1.txt": ["rule1.com", "rule2.com", "rule3.com"],
            "file2.txt": ["rule2.com", "rule4.com"],
            "file3.txt": ["rule3.com", "rule5.com"],
        }

        duplicates = find_cross_file_duplicates(file_rules)

        # rule2.com is in file1 and file2
        # rule3.com is in file1 and file3
        expected = {
            "rule2.com": ["file1.txt", "file2.txt"],
            "rule3.com": ["file1.txt", "file3.txt"],
        }

        self.assertEqual(duplicates, expected)

        # Test no duplicates
        no_dupes = {"f1": ["a"], "f2": ["b"]}
        self.assertEqual(find_cross_file_duplicates(no_dupes), {})

        # Test empty input
        self.assertEqual(find_cross_file_duplicates({}), {})


class TestMain(unittest.TestCase):
    def test_main_with_valid_directory(self):
        with tempfile.TemporaryDirectory() as tmpdirname:
            tmpdir = Path(tmpdirname)

            # Create a test file
            file1 = tmpdir / "file1.txt"
            file1.write_text("rule1.com\nrule1.com\nrule2.com\n")

            # Create another test file
            file2 = tmpdir / "file2.txt"
            file2.write_text("rule2.com\nrule3.com\n")

            with (
                patch.object(sys, "argv", ["deduplicate.py", str(tmpdir)]),
                patch("sys.stdout", new=StringIO()),
                patch("sys.stderr", new=StringIO()),
            ):
                result = main()

            self.assertEqual(result, 0)

            # Check files were deduplicated
            self.assertEqual(file1.read_text(), "rule1.com\nrule2.com\n")
            self.assertEqual(file2.read_text(), "rule2.com\nrule3.com\n")

    def test_main_directory_not_found(self):
        with tempfile.TemporaryDirectory() as tmpdirname:
            tmpdir = Path(tmpdirname) / "nonexistent"

            with (
                patch.object(sys, "argv", ["deduplicate.py", str(tmpdir)]),
                patch("sys.stderr", new_callable=StringIO) as mock_stderr,
                patch("sys.stdout", new_callable=StringIO),
            ):
                result = main()

            self.assertEqual(result, 1)
            self.assertIn("Error: Lists directory not found", mock_stderr.getvalue())

    def test_main_no_txt_files(self):
        with tempfile.TemporaryDirectory() as tmpdirname:
            tmpdir = Path(tmpdirname)

            # Create a non-txt file
            file1 = tmpdir / "file1.log"
            file1.write_text("rule1.com\n")

            with (
                patch.object(sys, "argv", ["deduplicate.py", str(tmpdir)]),
                patch("sys.stderr", new_callable=StringIO) as mock_stderr,
                patch("sys.stdout", new_callable=StringIO),
            ):
                result = main()

            self.assertEqual(result, 1)
            self.assertIn("No .txt files found", mock_stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
