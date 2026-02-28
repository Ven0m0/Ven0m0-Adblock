import unittest
import sys
from pathlib import Path

# Add current directory to path to allow importing deduplicate
if str(Path(__file__).parent) not in sys.path:
    sys.path.append(str(Path(__file__).parent))

from deduplicate import process_content, Stats

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
            "rule4.com"
        ]

        headers, rules, stats = process_content(lines)

        expected_headers = [
            "! Header line 1",
            "! Header line 2"
        ]

        # rule3.com appears twice, the second instance should be ignored
        # along with its preceding comment "! Another comment for rule3".
        expected_rules = [
            "rule1.com",
            "! Comment for rule2",
            "rule2.com",
            "! Comment for rule3",
            "rule3.com",
            "! Comment for rule4",
            "rule4.com"
        ]

        self.assertEqual(headers, expected_headers)
        self.assertEqual(rules, expected_rules)

if __name__ == '__main__':
    unittest.main()
