import unittest
import sys
from pathlib import Path
import hashlib

# Add current directory to path
if str(Path(__file__).parent) not in sys.path:
    sys.path.append(str(Path(__file__).parent))

from common import sanitize_filename, is_valid_domain, is_adguard_rule

class TestCommon(unittest.TestCase):
    def test_sanitize_filename_with_name(self):
        self.assertEqual(sanitize_filename("http://example.com", "My List"), "My-List.txt")
        self.assertEqual(sanitize_filename("http://example.com", "My List.txt"), "My-List.txt")
        self.assertEqual(sanitize_filename("http://example.com", "safe-name"), "safe-name.txt")

    def test_sanitize_filename_without_name(self):
        url = "https://example.com/list.txt"
        filename = sanitize_filename(url)
        # Check structure: domain-hash.txt
        self.assertTrue(filename.startswith("example-com-"))
        self.assertTrue(filename.endswith(".txt"))

        expected_hash = hashlib.md5(url.encode("utf-8")).hexdigest()[:12]
        self.assertIn(expected_hash, filename)


    def test_sanitize_filename_with_name_special_chars(self):
        self.assertEqual(sanitize_filename("http://example.com", "My!@#$%^&*()_+=List"), "My----------_--List.txt")
        self.assertEqual(sanitize_filename("http://example.com", "a/b\\c:d*e?f\"g<h>i|j"), "a-b-c-d-e-f-g-h-i-j.txt")
        self.assertEqual(sanitize_filename("http://example.com", "My List.txt"), "My-List.txt")
        self.assertEqual(sanitize_filename("http://example.com", "a/b.txt"), "a-b.txt")
        self.assertEqual(sanitize_filename("http://example.com", "c.txt.txt"), "c.txt.txt")

    def test_sanitize_filename_without_name_special_urls(self):
        # Missing scheme (no ://)
        url = "example.com/list.txt"
        filename = sanitize_filename(url)
        self.assertTrue(filename.startswith("list-"))
        self.assertTrue(filename.endswith(".txt"))
        expected_hash = hashlib.md5(url.encode("utf-8")).hexdigest()[:12]
        self.assertEqual(filename, f"list-{expected_hash}.txt")

        # Empty string
        url = ""
        filename = sanitize_filename(url)
        self.assertTrue(filename.startswith("list-"))
        expected_hash = hashlib.md5(url.encode("utf-8")).hexdigest()[:12]
        self.assertEqual(filename, f"list-{expected_hash}.txt")

        # URL with port
        url = "http://example.com:8080/list.txt"
        filename = sanitize_filename(url)
        self.assertTrue(filename.startswith("example-com-8080-"))
        expected_hash = hashlib.md5(url.encode("utf-8")).hexdigest()[:12]
        self.assertEqual(filename, f"example-com-8080-{expected_hash}.txt")

    def test_is_valid_domain(self):
        self.assertTrue(is_valid_domain("example.com"))
        self.assertTrue(is_valid_domain("sub.example.com"))
        self.assertTrue(is_valid_domain("my-domain.co.uk"))
        self.assertFalse(is_valid_domain("invalid"))
        self.assertFalse(is_valid_domain("-start.com"))
        self.assertFalse(is_valid_domain("end-.com"))
        self.assertFalse(is_valid_domain("http://example.com"))

    def test_is_adguard_rule(self):
        self.assertTrue(is_adguard_rule("||example.com^"))
        self.assertTrue(is_adguard_rule("example.com##.ad"))
        self.assertTrue(is_adguard_rule("! comment"))
        self.assertFalse(is_adguard_rule("example.com"))

if __name__ == '__main__':
    unittest.main()
