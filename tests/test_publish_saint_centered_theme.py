import datetime
import unittest
from types import SimpleNamespace

from jobs.publish.saint_centered_theme import build_saint_centered_theme_brief


class TestSaintCenteredTheme(unittest.TestCase):
    def setUp(self):
        self.target = datetime.date(2026, 8, 16)

    def test_window_is_forward_only_and_target_observance_wins(self):
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

        self.assertEqual(brief.window_start, "2026-08-16")
        self.assertEqual(brief.window_end, "2026-08-16")
        self.assertEqual(brief.primary_anchor, "The Assumption of the Blessed Virgin Mary")
        self.assertEqual(brief.primary_anchor_date, "2026-08-16")
        self.assertEqual(len(brief.window_items), 2)
        self.assertEqual(brief.version, "shared-liturgical-theme-v2")
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

    def test_target_gospel_provenance_is_retained_in_shared_brief(self):
        gospel = SimpleNamespace(
            gospel_citation="Matthew 5:43-48",
            gospel_theme="mercy",
            source="offline-douay-rheims",
            translation="Original Douay-Rheims",
        )

        brief = build_saint_centered_theme_brief(
            self.target,
            day_fetcher=lambda calendar, locale, date_value: (
                [{"name": "Saint Example", "rank_name": "memorial", "season": "ordinary_time"}]
                if date_value == self.target else []
            ),
            gospel_fetcher=lambda *args, **kwargs: gospel,
        )

        self.assertEqual(brief.gospel_citation, "Matthew 5:43-48")
        self.assertEqual(brief.gospel_theme, "mercy")
        self.assertEqual(brief.gospel_source, "offline-douay-rheims")
        self.assertEqual(brief.gospel_translation, "Original Douay-Rheims")
        self.assertEqual(brief.window_items[0]["gospel_source"], "offline-douay-rheims")

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

    def test_does_not_select_forward_observance_when_today_has_only_weekday(self):
        target = datetime.date(2026, 8, 17)

        def fetch(calendar, locale, date_value):
            if date_value == target + datetime.timedelta(days=2):
                return [{"name": "Saint John Eudes, Priest", "rank_name": "memorial", "season": "ordinary_time"}]
            if date_value == target:
                return [{"name": "Monday of the twentieth week of Ordinary Time", "rank_name": "weekday", "season": "ordinary_time"}]
            return []

        brief = build_saint_centered_theme_brief(
            target,
            day_fetcher=fetch,
            gospel_fetcher=lambda *args, **kwargs: None,
        )

        self.assertEqual(brief.primary_anchor, "Monday of the twentieth week of Ordinary Time")
        self.assertEqual(brief.primary_anchor_date, "2026-08-17")
        self.assertEqual(brief.primary_anchor_timing, "today")
        self.assertEqual(brief.saint_witness, "")
        self.assertNotIn("Saint John Eudes, Priest", brief.primary_anchor)

    def test_future_observances_are_not_fetched_or_retained(self):
        target = datetime.date(2026, 8, 17)

        def fetch(calendar, locale, date_value):
            if date_value == target + datetime.timedelta(days=9):
                return [{"name": "Saint At The Edge", "rank_name": "memorial", "season": "ordinary_time"}]
            if date_value == target + datetime.timedelta(days=10):
                return [{"name": "Saint Outside Window", "rank_name": "solemnity", "season": "ordinary_time"}]
            return [{"name": "Tuesday of Ordinary Time", "rank_name": "weekday", "season": "ordinary_time"}] if date_value == target else []

        brief = build_saint_centered_theme_brief(
            target,
            day_fetcher=fetch,
            gospel_fetcher=lambda *args, **kwargs: None,
        )

        self.assertEqual(brief.primary_anchor, "Tuesday of Ordinary Time")
        self.assertEqual(brief.primary_anchor_date, "2026-08-17")
        self.assertEqual(len(brief.window_items), 1)
        self.assertEqual(brief.window_items[0]["date"], "2026-08-17")
        self.assertNotIn("Saint At The Edge", {item["name"] for item in brief.window_items})
        self.assertNotIn("Saint Outside Window", {item["name"] for item in brief.window_items})
        self.assertEqual(brief.window_end, "2026-08-17")

    def test_target_gospel_is_used_when_today_has_no_suitable_saint(self):
        gospel = SimpleNamespace(
            gospel_citation="Matthew 5:43-48",
            gospel_theme="mercy",
            source="offline-douay-rheims",
            translation="Original Douay-Rheims",
        )

        def fetch(calendar, locale, date_value):
            if date_value == self.target:
                return [{"name": "Monday of Ordinary Time", "rank_name": "weekday", "season": "ordinary_time"}]
            if date_value == self.target + datetime.timedelta(days=1):
                return [{"name": "A Future Solemnity", "rank_name": "solemnity", "season": "ordinary_time"}]
            return []

        brief = build_saint_centered_theme_brief(
            self.target,
            day_fetcher=fetch,
            gospel_fetcher=lambda *args, **kwargs: gospel,
        )

        self.assertEqual(brief.primary_anchor, "Weekday Gospel")
        self.assertEqual(brief.primary_anchor_date, self.target.isoformat())
        self.assertEqual(brief.primary_anchor_timing, "today")
        self.assertEqual(brief.selection_source, "today")
        self.assertEqual(brief.gospel_citation, "Matthew 5:43-48")
        self.assertNotIn("A Future Solemnity", brief.primary_anchor)


if __name__ == "__main__":
    unittest.main()
