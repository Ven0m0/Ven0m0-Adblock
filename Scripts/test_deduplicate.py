import unittest
import sys
from pathlib import Path

# Add current directory to path
if str(Path(__file__).parent) not in sys.path:
    sys.path.append(str(Path(__file__).parent))

from deduplicate import is_header, is_valid_rule, process_content, find_cross_file_duplicates, Stats

class TestDeduplicate(unittest.TestCase):
    def test_is_header(self):
        self.assertTrue(is_header("! Title: Test"))
        self.assertTrue(is_header("# Comment"))
        self.assertTrue(is_header("[Adblock Plus 2.0]"))
        self.assertTrue(is_header("; Comment"))
        self.assertTrue(is_header(""))

        self.assertFalse(is_header("!Comment without space"))
        self.assertFalse(is_header("example.com"))
        self.assertFalse(is_header("||example.com^"))

    def test_is_valid_rule(self):
        self.assertFalse(is_valid_rule(""))
        self.assertFalse(is_valid_rule("a" * 2049))

        self.assertTrue(is_valid_rule("||example.com^"))
        self.assertTrue(is_valid_rule("@@||example.com^"))

        # In deduplicate.py, domain extraction: domain = line.split('^')[0].lstrip('|@')
        # If line is "||example.com$important", domain becomes "example.com$important"
        # and is_valid_domain returns False. This is an existing limitation in deduplicate.py,
        # so we should test its actual behavior
        self.assertFalse(is_valid_rule("||example.com$important"))

        self.assertTrue(is_valid_rule("example.com##.ad"))
        self.assertTrue(is_valid_rule("some-other-rule"))

        # Test invalid domains
        self.assertFalse(is_valid_rule("||invalid-domain-.com^"))
        self.assertFalse(is_valid_rule("@@||-invalid.com^"))

    def test_process_content(self):
        lines = [
            "! Header 1",
            "",
            "! Header 2",
            "||example.com^",
            "||test.com^",
            "||example.com^",  # Duplicate
            "",               # Empty line outside header
            "! Not a header anymore because it's after rules",
            "||test.com^",    # Another duplicate
            "||apple.com^"
        ]

        headers, rules, stats = process_content(lines)

        self.assertEqual(headers, [
            "! Header 1",
            "",
            "! Header 2",
            "! Not a header anymore because it's after rules"
        ])
        self.assertEqual(rules, [
            "||apple.com^",
            "||example.com^",
            "||test.com^"
        ])

        self.assertEqual(stats.original, 10)
        self.assertEqual(stats.headers, 4)
        self.assertEqual(stats.final, 7)
        self.assertEqual(stats.removed, 3)

    def test_find_cross_file_duplicates(self):
        file_rules = {
            "list1.txt": [
                "||example.com^",
                "||test.com^",
                "  ||spaced.com^  "
            ],
            "list2.txt": [
                "||example.com^",
                "||other.com^"
            ],
            "list3.txt": [
                "||spaced.com^",
                "||unique.com^"
            ]
        }

        duplicates = find_cross_file_duplicates(file_rules)

        self.assertEqual(len(duplicates), 2)
        self.assertIn("||example.com^", duplicates)
        self.assertEqual(set(duplicates["||example.com^"]), {"list1.txt", "list2.txt"})

        self.assertIn("||spaced.com^", duplicates)
        self.assertEqual(set(duplicates["||spaced.com^"]), {"list1.txt", "list3.txt"})

        self.assertNotIn("||test.com^", duplicates)
        self.assertNotIn("||other.com^", duplicates)
        self.assertNotIn("||unique.com^", duplicates)

if __name__ == '__main__':
    unittest.main()
