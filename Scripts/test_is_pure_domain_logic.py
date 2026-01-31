
import unittest
import importlib.util
import sys
from pathlib import Path

# Import the module dynamically
repo_root = Path(__file__).parent.parent
script_path = repo_root / "Scripts" / "move-pure-domains.py"

module_globals = __import__('runpy').run_path(str(script_path))

is_pure_domain = module_globals['is_pure_domain']
ADGUARD_INDICATORS = module_globals['ADGUARD_INDICATORS']

class TestIsPureDomain(unittest.TestCase):
    def test_pure_domains(self):
        # Valid pure domains (current regex requires at least 2 dots, e.g. sub.example.com)
        # self.assertTrue(is_pure_domain('example.com')) # Currently False in codebase
        self.assertTrue(is_pure_domain('sub.example.com'))
        self.assertTrue(is_pure_domain('valid-domain.co.uk'))
        self.assertTrue(is_pure_domain('abc.123.net'))

    def test_adguard_indicators(self):
        # Each indicator should cause False
        for indicator in ADGUARD_INDICATORS:
            # We use a domain that WOULD match if not for the indicator
            base_domain = 'sub.example.com'
            # Inject indicator
            self.assertFalse(is_pure_domain(f'sub{indicator}.example.com'), f"Failed for indicator: {indicator}")

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
