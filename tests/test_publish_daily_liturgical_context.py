import datetime
import unittest
from types import SimpleNamespace

from tests.test_helpers import load_module


class TestDailyLiturgicalContext(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/publish/daily_liturgical_context.py")
        self.date = datetime.date(2026, 6, 12)

    def test_context_is_derived_from_target_first_saint_centered_brief(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [
            {"name": "The Most Sacred Heart of Jesus", "rank_name": "solemnity", "season": "Season.ORDINARY_TIME"},
            {"name": "Saint Example", "rank_name": "memorial", "season": "Season.ORDINARY_TIME"},
        ] if date_value == self.date else []
        self.mod.fetch_daily_gospel_context = lambda *args, **kwargs: SimpleNamespace(
            gospel_text="Jesus sent the disciples to proclaim the kingdom.",
            gospel_citation="Matthew 10:1-7",
        )

        context = self.mod.build_daily_liturgical_context(self.date)
        payload = context.to_dict()

        self.assertEqual(payload["date"], "2026-06-12")
        self.assertEqual(payload["feastDay"], "The Most Sacred Heart of Jesus")
        self.assertEqual(payload["liturgicalRank"], "solemnity")
        self.assertEqual(payload["source"], "saint-centered-calendar-window")
        self.assertEqual(payload["sharedThemeVersion"], "shared-liturgical-theme-v2")
        self.assertIn("mercy", payload["primaryTheme"])
        self.assertNotEqual(payload["gospelTheme"], "mission")
        self.assertTrue(payload["sharedThemeSources"])

    def test_missing_calendar_and_gospel_use_one_deterministic_fallback(self):
        self.mod.romcal_fetch_day = lambda *args: []
        self.mod.fetch_daily_gospel_context = lambda *args, **kwargs: None

        context = self.mod.build_daily_liturgical_context(self.date)

        self.assertEqual(context.primaryTheme, "trustful perseverance")
        self.assertEqual(context.sharedThemeVersion, "shared-liturgical-theme-v2")
        self.assertIn("No target-day observance", context.fallbackReason)

    def test_future_higher_ranked_observance_is_selected_when_today_is_only_weekday(self):
        def fetch(calendar, locale, date_value):
            if date_value == self.date:
                return [{"name": "Friday of Ordinary Time", "rank_name": "weekday", "season": "ordinary_time"}]
            if date_value == self.date + datetime.timedelta(days=1):
                return [{"name": "Future Solemnity", "rank_name": "solemnity", "season": "ordinary_time"}]
            return []

        self.mod.romcal_fetch_day = fetch
        self.mod.fetch_daily_gospel_context = lambda *args, **kwargs: None

        context = self.mod.build_daily_liturgical_context(self.date)

        self.assertEqual(context.feastDay, "Future Solemnity")
        self.assertEqual(context.liturgicalRank, "solemnity")
        self.assertEqual(context.primaryAnchorTiming, "upcoming")
        self.assertEqual(len(context.sharedThemeSources), 2)


if __name__ == "__main__":
    unittest.main()
