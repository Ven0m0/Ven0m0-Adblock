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

    def test_write_lines_atomic(self):
        import tempfile
        import os
        from common import write_lines

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_dir_path = Path(temp_dir)
            target_file = temp_dir_path / "target.txt"

            # Test write
            result = write_lines(target_file, ["line1", "line2"])
            self.assertTrue(result)
            self.assertTrue(target_file.exists())
            self.assertEqual(target_file.read_text(encoding='utf-8'), "line1\nline2\n")

            # Test atomic overwrite
            result = write_lines(target_file, ["line3", "line4"])
            self.assertTrue(result)
            self.assertEqual(target_file.read_text(encoding='utf-8'), "line3\nline4\n")

            # Test append
            result = write_lines(target_file, ["line5"], mode='a')
            self.assertTrue(result)
            self.assertEqual(target_file.read_text(encoding='utf-8'), "line3\nline4\nline5\n")

if __name__ == '__main__':
    unittest.main()
