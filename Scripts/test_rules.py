import json
import unittest
from pathlib import Path

from Scripts.rules import Kind, blocked_host, classify, is_rule, is_valid

# Shared with Scripts/check-redundant-rules.test.mjs so both grammars stay in step.
CASES = {
    Kind(kind): lines
    for kind, lines in json.loads(Path(__file__).with_name("rule_kinds.json").read_text("utf-8")).items()
}


class TestClassify(unittest.TestCase):
    def test_kinds(self):
        for kind, lines in CASES.items():
            for line in lines:
                with self.subTest(line=line):
                    self.assertIs(classify(line), kind)

    def test_invalid_domains_are_not_domain(self):
        for line in ["invalid_domain.com", "example", "-example.com", "example.c", "example.123"]:
            with self.subTest(line=line):
                self.assertIsNot(classify(line), Kind.DOMAIN)

    def test_is_rule_excludes_non_rules(self):
        for kind, lines in CASES.items():
            for line in lines:
                with self.subTest(line=line):
                    self.assertEqual(is_rule(line), kind not in {Kind.BLANK, Kind.COMMENT, Kind.HEADER, Kind.DIRECTIVE})


class TestIsValid(unittest.TestCase):
    def test_valid(self):
        for line in ["example.com", "||example.com^", "@@||example.com", "example.com$domain=example.com"]:
            with self.subTest(line=line):
                self.assertTrue(is_valid(line))

    def test_length_cap_exempts_cosmetic(self):
        self.assertFalse(is_valid("a" * 2049))
        self.assertTrue(is_valid("a" * 2048))
        self.assertTrue(is_valid("example.com##" + "a" * 3000))
        self.assertTrue(is_valid("#%#" + "a" * 3000))

    def test_blank_and_bad_domain(self):
        for line in ["", "||invalid^", "||-start.com^", "||end-.com^"]:
            with self.subTest(line=line):
                self.assertFalse(is_valid(line))


class TestBlockedHost(unittest.TestCase):
    def test_hosts_that_block_outright(self):
        self.assertEqual(blocked_host("Example.COM"), "example.com")
        self.assertEqual(blocked_host("||ads.example.com^"), "ads.example.com")

    def test_lines_that_only_mention_a_domain(self):
        for line in [
            "web.archive.org###donate_banner",
            "github.com##.mr-1.btn-sm.btn",
            "example.com#@#.ad",
            "@@||example.com^",
            "||example.com^$3p",
            "||example.com/path^",
            "||*.example.com^",
            "! example.com",
            "",
        ]:
            with self.subTest(line=line):
                self.assertIsNone(blocked_host(line))


if __name__ == "__main__":
    unittest.main()
