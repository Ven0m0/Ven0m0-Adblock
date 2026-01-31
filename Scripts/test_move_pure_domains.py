import unittest
import importlib.util
from pathlib import Path

# Import the module dynamically
file_path = Path(__file__).parent / 'move-pure-domains.py'
spec = importlib.util.spec_from_file_location("move_pure_domains", file_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
is_pure_domain = module.is_pure_domain

class TestIsPureDomain(unittest.TestCase):
    def test_pure_domains(self):
        valid_domains = [
            "www.example.com",
            "sub.example.com",
            "test.co.uk",
            "very.long.domain.name.with.many.parts.org"
        ]
        for domain in valid_domains:
            with self.subTest(domain=domain):
                self.assertTrue(is_pure_domain(domain), f"Should be True: {domain}")

    def test_currently_rejected_domains(self):
        # These SHOULD be valid but are rejected by the current regex
        rejected_domains = [
            "example.com",
            "a-b.com",
            "123.com",
        ]
        for domain in rejected_domains:
            with self.subTest(domain=domain):
                self.assertFalse(is_pure_domain(domain), f"Should be False (current limitation): {domain}")

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

if __name__ == '__main__':
    unittest.main()
