import datetime
import unittest
from types import SimpleNamespace

from tests.test_helpers import load_module


class TestDailyLiturgicalContext(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/publish/daily_liturgical_context.py")

    def test_solemnity_beats_gospel_theme(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [
            {
                "name": "The Most Sacred Heart of Jesus",
                "rank_name": "solemnity",
                "season": "Season.ORDINARY_TIME",
            }
        ]
        self.mod.fetch_daily_gospel_context = lambda *args, **kwargs: SimpleNamespace(
            gospel_text="Jesus sent the disciples to proclaim the kingdom.",
            gospel_citation="Matthew 10:1-7",
        )

        context = self.mod.build_daily_liturgical_context(datetime.date(2026, 6, 12))
        payload = context.to_dict()

        self.assertEqual(payload["date"], "2026-06-12")
        self.assertEqual(payload["feastDay"], "The Most Sacred Heart of Jesus")
        self.assertEqual(payload["liturgicalRank"], "solemnity")
        self.assertEqual(payload["gospelTheme"], "mission")
        self.assertEqual(payload["primaryTheme"], "mercy")
        self.assertEqual(payload["source"], "feast")
        self.assertIn("discernment", payload["secondaryThemes"])
        self.assertEqual(payload["sharedThemeVersion"], "daily-theme-v1")
        self.assertIn("Mercy", payload["sharedThemeTitle"])
        self.assertIn("The Most Sacred Heart of Jesus", payload["sharedThemeExplanation"])
        self.assertIn("today's Gospel, Matthew 10:1-7", payload["sharedThemeExplanation"])
        self.assertIn("today's Gospel, Matthew 10:1-7", payload["sharedGospelBridge"])
        self.assertIn("mission", payload["sharedGospelBridge"])
        self.assertTrue(any(source["kind"] == "gospel" for source in payload["sharedThemeSources"]))
        self.assertTrue(any(source["kind"] == "season" for source in payload["sharedThemeSources"]))

    def test_memorial_subtly_yields_to_gospel_theme(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [
            {
                "name": "Saint Example",
                "rank_name": "memorial",
                "season": "Season.ORDINARY_TIME",
            }
        ]
        self.mod.fetch_daily_gospel_context = lambda *args, **kwargs: SimpleNamespace(
            gospel_text="Do not be afraid; have faith and trust in the Lord.",
            gospel_citation="Mark 5:36",
        )

        context = self.mod.build_daily_liturgical_context(datetime.date(2026, 6, 9))

        self.assertEqual(context.primaryTheme, "trust")
        self.assertEqual(context.source, "gospel")
        self.assertEqual(context.saintOfDay, "Saint Example")
        self.assertEqual(context.saintIntercessions, ("Saint Example",))
        self.assertIn("Trust", context.sharedThemeTitle)
        self.assertIn("Saint Example", context.sharedThemeExplanation)
        self.assertIn("Mark 5:36", context.sharedThemeExplanation)
        self.assertIn("today's focus", context.sharedThemeTransition)
        self.assertNotIn("And", context.sharedThemeTransition)

    def test_missing_gospel_falls_back_to_season(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [
            {
                "name": "Tuesday of the First Week of Lent",
                "rank_name": "weekday",
                "season": "Season.LENT",
            }
        ]

        def missing_gospel(*args, **kwargs):
            raise RuntimeError("network unavailable")

        self.mod.fetch_daily_gospel_context = missing_gospel

        context = self.mod.build_daily_liturgical_context(datetime.date(2026, 2, 24))

        self.assertEqual(context.liturgicalSeason, "Lent")
        self.assertEqual(context.primaryTheme, "repentance")
        self.assertEqual(context.source, "season")
        self.assertIn("network unavailable", context.fallbackReason)
        self.assertIn("Repentance", context.sharedThemeTitle)
        self.assertIn("Lent", context.sharedThemeExplanation)
        self.assertEqual(context.sharedGospelBridge, "")
        self.assertTrue(any(source["kind"] == "season" for source in context.to_dict()["sharedThemeSources"]))

    def test_multiple_calendar_names_are_joined_in_shared_theme_source(self):
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [
            {
                "name": "Tuesday of the Eleventh Week in Ordinary Time",
                "rank_name": "weekday",
                "season": "Season.ORDINARY_TIME",
            },
            {
                "name": "Saint Example",
                "rank_name": "optional_memorial",
                "season": "Season.ORDINARY_TIME",
            },
        ]
        self.mod.fetch_daily_gospel_context = lambda *args, **kwargs: SimpleNamespace(
            gospel_text="The Lord teaches us to forgive and love.",
            gospel_citation="Matthew 5:43-48",
        )

        context = self.mod.build_daily_liturgical_context(datetime.date(2026, 6, 16))
        payload = context.to_dict()

        calendar_source = next(source for source in payload["sharedThemeSources"] if source["kind"] == "calendar")
        self.assertEqual(
            calendar_source["label"],
            "Tuesday of the Eleventh Week in Ordinary Time and Saint Example",
        )
        self.assertIn("Tuesday of the Eleventh Week in Ordinary Time and Saint Example", payload["sharedThemeExplanation"])
        self.assertIn("mercy and trust", payload["sharedThemeTransition"])
        self.assertNotIn("And", payload["sharedThemeTransition"])


if __name__ == "__main__":
    unittest.main()
