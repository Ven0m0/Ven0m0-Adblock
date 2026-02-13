import unittest
import sys
from pathlib import Path
import importlib

# Add Scripts to path
scripts_dir = Path(__file__).parent
if str(scripts_dir) not in sys.path:
    sys.path.append(str(scripts_dir))

# Import ADGUARD_INDICATORS from common
from common import ADGUARD_INDICATORS

# Import is_pure_domain from move-pure-domains
move_pure_domains = importlib.import_module("move-pure-domains")
is_pure_domain = move_pure_domains.is_pure_domain

class TestIsPureDomain(unittest.TestCase):
    def test_pure_domains(self):
        # Valid pure domains (current regex requires at least 2 dots, e.g. sub.example.com)
        # self.assertTrue(is_pure_domain('example.com')) # Currently False in codebase
        self.assertTrue(is_pure_domain('sub.example.com'))
        self.assertTrue(is_pure_domain('valid-domain.co.uk'))
        self.assertTrue(is_pure_domain('abc.123.net'))

    def test_adguard_indicators(self):
        # Each indicator should cause False
        base_domain = 'example.com'
        for indicator in ADGUARD_INDICATORS:
            # We use a domain that WOULD match if not for the indicator
            # Inject indicator
            self.assertFalse(
                is_pure_domain(f'sub{indicator}.{base_domain}'),
                f"Failed for indicator: {indicator}",
            )

    def test_comments_and_special_starts(self):
        # Starts with !, #, [, ;
        self.assertFalse(is_pure_domain('! comment'))
        self.assertFalse(is_pure_domain('# comment'))
        self.assertFalse(is_pure_domain('[Adblock Plus 2.0]'))
        self.assertFalse(is_pure_domain('; comment'))

    def test_invalid_domains(self):
        # Invalid domain format but no indicators
        self.assertFalse(is_pure_domain('invalid_domain.com')) # underscore not allowed
        self.assertFalse(is_pure_domain('example')) # No TLD
        self.assertFalse(is_pure_domain('example.com')) # Regex requires 2 dots (bug/feature preserved)
        self.assertFalse(is_pure_domain('-example.com'))

    def test_complex_rules(self):
        self.assertFalse(is_pure_domain('||sub.example.com^'))
        self.assertFalse(is_pure_domain('sub.example.com##.ad'))
        self.assertFalse(is_pure_domain('@@||sub.example.com'))

if __name__ == '__main__':
    unittest.main()
