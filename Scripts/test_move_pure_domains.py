import unittest
import importlib.util
from pathlib import Path
from unittest.mock import Mock, patch, mock_open

# Import the module dynamically
file_path = Path(__file__).parent / 'move-pure-domains.py'
spec = importlib.util.spec_from_file_location("move_pure_domains", file_path)
if spec is None or spec.loader is None:
    raise ImportError("Could not load module")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
is_pure_domain = module.is_pure_domain
scan_adblock_files = module.scan_adblock_files

class TestIsPureDomain(unittest.TestCase):
    def test_pure_domains(self):
        valid_domains = [
            "www.example.com",
            "sub.example.com",
            "test.co.uk",
            "very.long.domain.name.with.many.parts.org",
            "example.com",
            "a-b.com",
            "123.com",
        ]
        for domain in valid_domains:
            with self.subTest(domain=domain):
                self.assertTrue(is_pure_domain(domain), f"Should be True: {domain}")

    def test_adguard_syntax(self):
        invalid_lines = [
            "||example.com^",
            "@@||example.com",
            "example.com$script",
            "##.ad-class",
            "example.com##.ad",
            "! Comment",
            "[Adblock Plus 2.0]",
            "|http://example.com",
            "example.com#@#.ad",
            "/pattern/",
            "http://example.com",  # URL, not pure domain
            "https://example.com", # URL
        ]
        for line in invalid_lines:
            with self.subTest(line=line):
                self.assertFalse(is_pure_domain(line), f"Should be False: {line}")

    def test_edge_cases(self):
        self.assertFalse(is_pure_domain(""))
        self.assertFalse(is_pure_domain("   "))
        # Regex expects start with [a-z0-9]
        self.assertFalse(is_pure_domain("-start-dash.com"))

        # Regex expects end with .[a-z]{2,}
        self.assertFalse(is_pure_domain("example.c")) # 1 char TLD
        self.assertFalse(is_pure_domain("example.123")) # numeric TLD

class TestScanAdblockFiles(unittest.TestCase):
    def test_scan_adblock_files_logic(self):
        # Create a mock file object
        mock_file = Mock(spec=Path)
        mock_file.name = "test_list.txt"

        # Content with pure domains, comments, and adblock rules
        content = """! Title
||ad.com^
pure-domain.com
another-pure.net
! Another comment
##.element
"""
        # Mock the open() context manager
        # Since the code does `with adblock_file.open(...) as f:`, we need to mock the return value of open()
        # mock_open returns a file object that also acts as a context manager
        mock_file_handle = mock_open(read_data=content)
        mock_file.open.side_effect = mock_file_handle

        # Create a mock directory object
        mock_dir = Mock(spec=Path)
        mock_dir.glob.return_value = [mock_file]

        # Run the function
        domain_moves, file_updates = scan_adblock_files(mock_dir)

        # 1. Check if pure domains were identified and moved
        # Categorization logic defaults to 'Other.txt' unless filename matches
        self.assertIn('Other.txt', domain_moves)
        moved_domains = domain_moves['Other.txt']['test_list.txt']
        self.assertIn("pure-domain.com", moved_domains)
        self.assertIn("another-pure.net", moved_domains)
        self.assertEqual(len(moved_domains), 2)

        # 2. Check if file updates contain the REST of the file (comments + rules)
        self.assertIn(mock_file, file_updates)
        updated_lines = file_updates[mock_file]

        # Verify specific lines are present/absent
        # Note: the implementation stores lines rstrip()ed.
        self.assertIn("! Title", updated_lines)
        self.assertIn("||ad.com^", updated_lines)
        self.assertIn("##.element", updated_lines)

        # Pure domains should NOT be in the updated file content
        self.assertNotIn("pure-domain.com", updated_lines)
        self.assertNotIn("another-pure.net", updated_lines)

    def test_scan_adblock_files_categorization(self):
        mock_file = Mock(spec=Path)
        mock_file.name = "spotify_ads.txt"
        content = "spotify-tracker.com\n"
        mock_file_handle = mock_open(read_data=content)
        mock_file.open.side_effect = mock_file_handle

        mock_dir = Mock(spec=Path)
        mock_dir.glob.return_value = [mock_file]

        domain_moves, _ = scan_adblock_files(mock_dir)

        # Should be categorized into Spotify.txt based on filename
        self.assertIn('Spotify.txt', domain_moves)
        if 'Spotify.txt' in domain_moves:
             self.assertIn("spotify-tracker.com", domain_moves['Spotify.txt']['spotify_ads.txt'])

if __name__ == '__main__':
    unittest.main()
