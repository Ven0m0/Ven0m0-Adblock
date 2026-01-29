import unittest
import importlib.util
import sys
from pathlib import Path

# Import the module dynamically because of the hyphens in the filename
repo_root = Path(__file__).parent.parent
script_path = repo_root / "Scripts" / "move-pure-domains.py"

spec = importlib.util.spec_from_file_location("move_pure_domains", str(script_path))
module = importlib.util.module_from_spec(spec)
sys.modules["move_pure_domains"] = module
spec.loader.exec_module(module)

categorize_domain = module.categorize_domain

class TestCategorizeDomain(unittest.TestCase):
    def test_source_file_priority(self):
        # Source file name based categorization
        self.assertEqual(categorize_domain('example.com', 'spotify_ads.txt'), 'Spotify.txt')
        self.assertEqual(categorize_domain('example.com', 'youtube_ads.txt'), 'Social-Media.txt')
        self.assertEqual(categorize_domain('example.com', 'twitch_trackers.txt'), 'Social-Media.txt')
        self.assertEqual(categorize_domain('example.com', 'reddit_block.txt'), 'Social-Media.txt')
        self.assertEqual(categorize_domain('example.com', 'twitter_tracking.txt'), 'Social-Media.txt')
        self.assertEqual(categorize_domain('example.com', 'game_trackers.txt'), 'Games.txt')

    def test_domain_content_ads(self):
        # Domain content based categorization - Ads
        source = 'generic_list.txt'
        self.assertEqual(categorize_domain('ads.example.com', source), 'Ads.txt')
        self.assertEqual(categorize_domain('my-ad-server.com', source), 'Ads.txt')
        self.assertEqual(categorize_domain('analytics.google.com', source), 'Ads.txt')
        self.assertEqual(categorize_domain('tracking.site.net', source), 'Ads.txt')
        self.assertEqual(categorize_domain('telemetry.os.org', source), 'Ads.txt')
        self.assertEqual(categorize_domain('metrics.api.com', source), 'Ads.txt')

    def test_domain_content_social(self):
        # Domain content based categorization - Social
        source = 'generic_list.txt'
        self.assertEqual(categorize_domain('social.network.com', source), 'Social-Media.txt')
        self.assertEqual(categorize_domain('api.facebook.com', source), 'Social-Media.txt')
        self.assertEqual(categorize_domain('twitter.com', source), 'Social-Media.txt')
        self.assertEqual(categorize_domain('static.instagram.com', source), 'Social-Media.txt')

    def test_other(self):
        # Fallback
        source = 'generic_list.txt'
        self.assertEqual(categorize_domain('example.com', source), 'Other.txt')
        self.assertEqual(categorize_domain('wikipedia.org', source), 'Other.txt')

    def test_case_insensitivity(self):
        source = 'generic_list.txt'
        self.assertEqual(categorize_domain('ADS.EXAMPLE.COM', source), 'Ads.txt')
        self.assertEqual(categorize_domain('FaceBook.com', source), 'Social-Media.txt')

    def test_precedence(self):
        # Source file takes precedence over domain content
        # Even if domain has 'ad', if source is 'game', it should be 'Games.txt'
        self.assertEqual(categorize_domain('ads.example.com', 'game_list.txt'), 'Games.txt')

        # If source is generic, domain content decides order
        # Code checks ads first, then social
        # If a domain has both? e.g. "social-ads.com"
        # "ad" is in "ads", so it matches 'ad' keyword.
        self.assertEqual(categorize_domain('social-ads.com', 'generic.txt'), 'Ads.txt')

if __name__ == '__main__':
    unittest.main()
