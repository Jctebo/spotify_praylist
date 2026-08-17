import datetime
import unittest
from types import SimpleNamespace

from jobs.publish.saint_centered_theme import build_saint_centered_theme_brief


class TestSaintCenteredTheme(unittest.TestCase):
    def setUp(self):
        self.target = datetime.date(2026, 8, 16)

    def test_window_is_inclusive_and_target_anchor_wins(self):
        def fetch(calendar, locale, date_value):
            if date_value == self.target:
                return [
                    {"name": "Saint Example", "rank_name": "memorial", "season": "ordinary_time"},
                    {"name": "The Assumption of the Blessed Virgin Mary", "rank_name": "solemnity", "season": "ordinary_time"},
                ]
            if date_value == self.target + datetime.timedelta(days=1):
                return [{"name": "A Future Solemnity", "rank_name": "solemnity", "season": "ordinary_time"}]
            return []

        brief = build_saint_centered_theme_brief(
            self.target,
            day_fetcher=fetch,
            gospel_fetcher=lambda *args, **kwargs: None,
        )

        self.assertEqual(brief.window_start, "2026-08-13")
        self.assertEqual(brief.window_end, "2026-08-25")
        self.assertEqual(brief.primary_anchor, "The Assumption of the Blessed Virgin Mary")
        self.assertEqual(brief.primary_anchor_date, "2026-08-16")
        self.assertEqual(len(brief.window_items), 3)
        self.assertEqual(brief.version, "saint-centered-theme-v1")
        self.assertIn("surrender", brief.themes)

    def test_missing_calendar_uses_one_deterministic_fallback(self):
        brief = build_saint_centered_theme_brief(
            self.target,
            day_fetcher=lambda *args: [],
            gospel_fetcher=lambda *args, **kwargs: None,
        )

        self.assertEqual(brief.primary_anchor, "Ordinary Time prayer")
        self.assertEqual(brief.primary_rank, "weekday")
        self.assertEqual(brief.themes[0], "trustful perseverance")
        self.assertEqual(brief.source, "deterministic-calendar-window")
        self.assertIn("No target-day observance", brief.fallback_reason)

    def test_duplicate_rows_are_collapsed(self):
        def fetch(calendar, locale, date_value):
            if date_value == self.target:
                return [
                    {"name": "Saint Example", "rank_name": "memorial", "season": "ordinary_time"},
                    {"name": "Saint Example", "rank_name": "memorial", "season": "ordinary_time"},
                ]
            return []

        brief = build_saint_centered_theme_brief(
            self.target,
            day_fetcher=fetch,
            gospel_fetcher=lambda *args, **kwargs: SimpleNamespace(gospel_citation="", gospel_theme=""),
        )

        self.assertEqual(len(brief.window_items), 1)
        self.assertEqual(brief.primary_anchor, "Saint Example")

    def test_target_day_easter_octave_does_not_yield_to_future_observance(self):
        target = datetime.date(2026, 4, 12)

        def fetch(calendar, locale, date_value):
            if date_value == target:
                return [{"name": "Second Sunday of Easter", "rank": "easter_octave", "season": "easter"}]
            if date_value == target + datetime.timedelta(days=1):
                return [{"name": "Saint Example the Martyr", "rank": "memorial", "season": "easter"}]
            return []

        brief = build_saint_centered_theme_brief(
            target,
            day_fetcher=fetch,
            gospel_fetcher=lambda *args, **kwargs: None,
        )

        self.assertEqual(brief.primary_anchor, "Second Sunday of Easter")
        self.assertEqual(brief.primary_anchor_date, "2026-04-12")


if __name__ == "__main__":
    unittest.main()
