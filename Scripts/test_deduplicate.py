import unittest

from deduplicate import process_content, is_header, is_valid_rule


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


if __name__ == "__main__":
    unittest.main()
