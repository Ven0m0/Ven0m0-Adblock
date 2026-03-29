import unittest

# Add current directory to path to allow importing deduplicate
from Scripts.deduplicate import (
    process_content,
    is_header,
    is_valid_rule,
    find_cross_file_duplicates,
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

        headers, rules, stats = process_content(lines)

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

    def test_is_header(self):
        # Valid headers with prefixes
        self.assertTrue(is_header("! This is a comment"))
        self.assertTrue(is_header("# This is also a comment"))
        self.assertTrue(is_header("[Adblock Plus 2.0]"))
        self.assertTrue(is_header("; Semicolon comment"))

        # Empty lines
        self.assertTrue(is_header(""))

        # Non-headers
        self.assertFalse(is_header("||example.com^"))
        self.assertFalse(is_header("example.com##.ad"))
        self.assertFalse(is_header("example.com"))
        self.assertFalse(is_header("@@||example.com"))

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

        # Invalid domain patterns
        self.assertFalse(is_valid_rule("||invalid^"))
        self.assertFalse(is_valid_rule("||-start.com^"))
        self.assertFalse(is_valid_rule("||end-.com^"))

    def test_find_cross_file_duplicates(self):
        file_rules = {
            "file1.txt": ["rule1.com", "rule2.com", "  rule3.com  "],
            "file2.txt": ["rule2.com", "rule4.com"],
            "file3.txt": ["rule3.com", "rule5.com", "  "],
        }

        duplicates = find_cross_file_duplicates(file_rules)

        # rule2.com is in file1 and file2
        # rule3.com is in file1 and file3 (due to stripping)
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


if __name__ == "__main__":
    unittest.main()
