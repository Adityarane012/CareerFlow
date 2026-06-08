import unittest
import re
import html

# Import modules to test
from src.utils.text_cleaner import clean_html
from src.utils.query_parser import parse_query

class TestJobAgent(unittest.TestCase):

    def test_text_cleaner_mojibake(self):
        # 1. Emoji mojibake
        raw_mojibake = "Ready to embark... \u00e2\u0153\u00a8\u00f0\u0178\u2018\u00a9\u00e2\u20ac\u008d\u00f0\u0178\u2019\u00bb\u00f0\u0178\u2018\u00a8\u00e2\u20ac\u008d\u00f0\u0178\u2019\u00bb"
        cleaned = clean_html(raw_mojibake)
        # Expected UTF-8 emojis: ✨👩‍💻👨‍💻 (Sparkles, Woman, ZWJ, Laptop, Man, ZWJ, Laptop)
        self.assertIn("✨", cleaned)
        self.assertIn("👩‍💻", cleaned)
        self.assertIn("👨‍💻", cleaned)

    def test_text_cleaner_truncated_tags(self):
        # 2. Truncated span tag followed by structural tag (which converts to newline)
        text_with_truncated_span = "existing functionality.<span cl<br/><br/>Please mention..."
        cleaned = clean_html(text_with_truncated_span)
        self.assertNotIn("span", cleaned)
        self.assertNotIn("<span", cleaned)
        self.assertIn("existing functionality.", cleaned)
        self.assertIn("Please mention...", cleaned)

        # 3. Truncated strong tag
        text_with_truncated_strong = "Responsibilities<stron<br/><br/>Please mention..."
        cleaned = clean_html(text_with_truncated_strong)
        self.assertNotIn("stron", cleaned)
        self.assertNotIn("<stron", cleaned)
        self.assertIn("Responsibilities", cleaned)

    def test_text_cleaner_math_symbols(self):
        # 4. Less-than sign (mathematical) should remain intact
        text_with_math = "Recent (<2 years in the past) experience"
        cleaned = clean_html(text_with_math)
        self.assertIn("<2 years", cleaned)

    def test_query_parser(self):
        # 5. Role and location extraction
        role, loc = parse_query("software engineer in mumbai")
        self.assertEqual(role, "software engineer")
        self.assertEqual(loc, "mumbai")

        # 6. Leading action words and trailing job nouns stripping
        role, loc = parse_query("find python developer roles in bangalore")
        self.assertEqual(role, "python developer")
        self.assertEqual(loc, "bangalore")

        # 7. No location
        role, loc = parse_query("frontend dev")
        self.assertEqual(role, "frontend dev")
        self.assertEqual(loc, "")

        # 8. Extra whitespace normalization
        role, loc = parse_query("  get   data   scientist    jobs  ")
        self.assertEqual(role, "data scientist")
        self.assertEqual(loc, "")

if __name__ == "__main__":
    unittest.main()
