import unittest
import importlib.util
import tempfile
from pathlib import Path

from unittest.mock import Mock

# Import the module dynamically
file_path = Path(__file__).parent / "move_pure_domains.py"
spec = importlib.util.spec_from_file_location("move_pure_domains", file_path)
if spec is None or spec.loader is None:
    raise ImportError("Could not load module")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
is_pure_domain = module.is_pure_domain
scan_adblock_files = module.scan_adblock_files
categorize_domain = module.categorize_domain
apply_updates = module.apply_updates


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
            "https://example.com",  # URL
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
        self.assertFalse(is_pure_domain("example.c"))  # 1 char TLD
        self.assertFalse(is_pure_domain("example.123"))  # numeric TLD


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
        mock_file.read_text.return_value = content

        # Create a mock directory object
        mock_dir = Mock(spec=Path)
        mock_dir.glob.return_value = [mock_file]

        # Run the function
        domain_moves, file_updates = scan_adblock_files(mock_dir)

        # 1. Check if pure domains were identified and moved
        # Categorization logic defaults to 'Other.txt' unless filename matches
        self.assertIn("Other.txt", domain_moves)
        moved_domains = domain_moves["Other.txt"]["test_list.txt"]
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
        mock_file.read_text.return_value = content

        mock_dir = Mock(spec=Path)
        mock_dir.glob.return_value = [mock_file]

        domain_moves, _ = scan_adblock_files(mock_dir)

        # Should be categorized into Spotify.txt based on filename
        self.assertIn("Spotify.txt", domain_moves)
        if "Spotify.txt" in domain_moves:
            self.assertIn(
                "spotify-tracker.com", domain_moves["Spotify.txt"]["spotify_ads.txt"]
            )


class TestCategorizeDomain(unittest.TestCase):
    def test_source_file_matching(self):
        # Match by source file name
        self.assertEqual(
            categorize_domain("example.com", "spotify_filters.txt"), "Spotify.txt"
        )
        self.assertEqual(
            categorize_domain("example.com", "YouTube-Ads.txt"), "Social-Media.txt"
        )
        self.assertEqual(
            categorize_domain("example.com", "twitch_adblock.txt"), "Social-Media.txt"
        )
        self.assertEqual(
            categorize_domain("example.com", "reddit_promoted.txt"), "Social-Media.txt"
        )
        self.assertEqual(
            categorize_domain("example.com", "TWITTER.txt"), "Social-Media.txt"
        )
        self.assertEqual(
            categorize_domain("example.com", "game_servers.txt"), "Games.txt"
        )

    def test_domain_keyword_matching_ads(self):
        # Match by domain keywords (Ads)
        self.assertEqual(categorize_domain("ad.example.com", "unknown.txt"), "Ads.txt")
        self.assertEqual(categorize_domain("google-ads.com", "unknown.txt"), "Ads.txt")
        self.assertEqual(
            categorize_domain("analytics.google.com", "unknown.txt"), "Ads.txt"
        )
        self.assertEqual(
            categorize_domain("tracking.example.net", "unknown.txt"), "Ads.txt"
        )
        self.assertEqual(
            categorize_domain("telemetry.microsoft.com", "unknown.txt"), "Ads.txt"
        )
        self.assertEqual(
            categorize_domain("metrics.apple.com", "unknown.txt"), "Ads.txt"
        )

    def test_domain_keyword_matching_social(self):
        # Match by domain keywords (Social Media)
        self.assertEqual(
            categorize_domain("social.network.com", "unknown.txt"), "Social-Media.txt"
        )
        self.assertEqual(
            categorize_domain("api.facebook.com", "unknown.txt"), "Social-Media.txt"
        )
        self.assertEqual(
            categorize_domain("cdn.twitter.com", "unknown.txt"), "Social-Media.txt"
        )
        self.assertEqual(
            categorize_domain("instagram-images.net", "unknown.txt"), "Social-Media.txt"
        )

    def test_fallback_category(self):
        # Match fallback
        self.assertEqual(categorize_domain("example.com", "unknown.txt"), "Other.txt")
        self.assertEqual(categorize_domain("randomsite.org", "filter.txt"), "Other.txt")


class TestApplyUpdates(unittest.TestCase):
    def test_apply_updates_basic(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            hostlist_dir = tmpdir_path / "hostlist"
            hostlist_dir.mkdir()
            adblock_dir = tmpdir_path / "adblock"
            adblock_dir.mkdir()

            # Setup target file
            target_file = "Other.txt"
            target_path = hostlist_dir / target_file
            target_path.write_text("existing.com\n")

            # Setup source file
            source_file = "test_list.txt"
            source_path = adblock_dir / source_file
            source_path.write_text("domain1.com\ndomain2.com\n||ad.com^\n")

            domain_moves = {
                "Other.txt": {"test_list.txt": ["domain1.com", "domain2.com"]}
            }
            file_updates = {source_path: ["||ad.com^"]}

            total_moved = apply_updates(hostlist_dir, domain_moves, file_updates)

            self.assertEqual(total_moved, 2)

            # Check target file content
            self.assertEqual(
                target_path.read_text(), "existing.com\ndomain1.com\ndomain2.com\n"
            )

            # Check source file content
            self.assertEqual(source_path.read_text(), "||ad.com^\n")

    def test_apply_updates_deduplication(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            hostlist_dir = tmpdir_path / "hostlist"
            hostlist_dir.mkdir()
            adblock_dir = tmpdir_path / "adblock"
            adblock_dir.mkdir()

            # Setup target file with existing domain
            target_file = "Other.txt"
            target_path = hostlist_dir / target_file
            target_path.write_text("existing.com\n")

            source_path = adblock_dir / "test_list.txt"
            source_path.write_text("existing.com\nnew.com\n")

            domain_moves = {"Other.txt": {"test_list.txt": ["existing.com", "new.com"]}}
            file_updates = {source_path: []}

            total_moved = apply_updates(hostlist_dir, domain_moves, file_updates)

            self.assertEqual(total_moved, 1)  # Only new.com is moved
            self.assertEqual(target_path.read_text(), "existing.com\nnew.com\n")

    def test_apply_updates_source_update_failure(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            hostlist_dir = tmpdir_path / "hostlist"
            hostlist_dir.mkdir()
            adblock_dir = tmpdir_path / "adblock"
            adblock_dir.mkdir()
            source_path = adblock_dir / "test_list.txt"

            domain_moves = {"Other.txt": {"test_list.txt": ["new.com"]}}
            file_updates = {source_path: ["||ad.com^"]}

            original_write_lines = module.write_lines
            module.write_lines = Mock(return_value=False)
            try:
                total_moved = apply_updates(hostlist_dir, domain_moves, file_updates)
                self.assertEqual(total_moved, 0)
            finally:
                module.write_lines = original_write_lines


if __name__ == "__main__":
    unittest.main()
