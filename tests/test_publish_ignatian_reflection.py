import datetime
import unittest
from unittest import mock

from tests.test_helpers import load_module


class TestIgnatianReflection(unittest.TestCase):
    def setUp(self):
        self.context_mod = load_module("jobs/publish/daily_liturgical_context.py")
        self.mod = load_module("jobs/publish/ignatian_reflection.py")

    def _context(self, saint=""):
        return self.context_mod.DailyLiturgicalContext(
            date="2026-06-09",
            liturgicalSeason="Ordinary Time",
            liturgicalWeek="",
            feastDay="",
            liturgicalRank="",
            saintOfDay=saint,
            gospelTheme="trust",
            primaryTheme="trust",
            secondaryThemes=("discernment",),
            emotionalTone="contemplative",
            reflectionFocus="Notice where God invites trust in ordinary life.",
            suggestedImagery=("steady candlelight",),
            suggestedMusicMood="soft and contemplative",
            openingTone="peaceful and attentive",
            closingTone="peaceful trust",
            saintIntercessions=tuple([saint] if saint else []),
            shortSummary="Today's shared focus is trust.",
            source="gospel",
            gospelCitation="Mark 5:36",
            sharedThemeTitle="Trust",
            sharedThemeExplanation="Today's focus is trust.",
            sharedThemeReflectionFocus="Notice where God invites trust in ordinary life.",
            sharedGospelBridge="today's Gospel, Mark 5:36, draws us into trust",
        )

    def test_missing_openai_uses_structured_fallback_with_ignatius(self):
        with mock.patch.object(self.mod, "_resolve_openai_settings", return_value=("", "https://api.openai.com/v1", "gpt-4.1-mini")):
            episode = self.mod.build_ignatian_reflection_episode(
                datetime.date(2026, 6, 9),
                self._context(),
            )

        self.assertEqual(episode.source, "fallback")
        self.assertEqual(episode.saint_name, "Ignatius of Loyola")
        self.assertIn("Welcome to Ora Pro Nobis, where we pray with the Saints.", episode.text)
        self.assertIn("today's Gospel, Mark 5:36, draws us into trust", episode.text)
        self.assertNotIn("Episode Title", episode.text)
        self.assertEqual(len(episode.segments), 4)
        self.assertEqual(episode.pause_ms, 15000)
        self.assertIn("consolation and desolation", episode.text)
        self.assertIn("?", episode.segments[0])
        self.assertTrue(episode.segments[0].startswith("Welcome to Ora Pro Nobis, where we pray with the Saints."))
        self.assertTrue(episode.text.endswith("And may the peace of Christ remain with you."))
        self.assertIn("Saint Ignatius of Loyola, pray for us.", episode.text)
        self.assertGreaterEqual(episode.word_count, 100)
        self.assertLessEqual(episode.word_count, 350)

    def test_saint_name_is_not_double_prefixed(self):
        with mock.patch.object(self.mod, "_resolve_openai_settings", return_value=("", "https://api.openai.com/v1", "gpt-4.1-mini")):
            episode = self.mod.build_ignatian_reflection_episode(
                datetime.date(2026, 6, 9),
                self._context("Saint Example"),
            )

        self.assertIn("Saint Example, pray for us.", episode.text)
        self.assertNotIn("Saint Saint Example", episode.text)
        self.assertEqual(episode.saint_name, "Example")


if __name__ == "__main__":
    unittest.main()
