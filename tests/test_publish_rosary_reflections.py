import datetime
import unittest
from types import SimpleNamespace
from unittest import mock

from tests.test_helpers import load_module


JOYFUL_TEXT = """Joyful Mysteries
1. The Annunciation - Humility
2. The Visitation - Love of Neighbor
3. The Nativity - Poverty of Spirit
4. The Presentation - Obedience
5. The Finding of Jesus in the Temple - Joy in Finding Jesus
"""


class TestPublishRosaryReflections(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/publish/rosary_reflections.py")

    def test_parse_rosary_mysteries_reads_title_mysteries_and_fruits(self):
        title, mysteries = self.mod.parse_rosary_mysteries(JOYFUL_TEXT)

        self.assertEqual(title, "Joyful Mysteries")
        self.assertEqual(len(mysteries), 5)
        self.assertEqual(mysteries[0].number, 1)
        self.assertEqual(mysteries[0].title, "The Annunciation")
        self.assertEqual(mysteries[0].fruit, "Humility")
        self.assertEqual(mysteries[-1].title, "The Finding of Jesus in the Temple")

    def test_parse_rosary_mysteries_requires_five_ordered_rows(self):
        with self.assertRaisesRegex(RuntimeError, "exactly 5 mystery rows"):
            self.mod.parse_rosary_mysteries("Joyful Mysteries\n1. The Annunciation - Humility\n")

        with self.assertRaisesRegex(RuntimeError, "number mysteries 1 through 5"):
            self.mod.parse_rosary_mysteries(
                """Joyful Mysteries
1. A - One
2. B - Two
3. C - Three
4. D - Four
6. E - Five
"""
            )

    def test_validate_rosary_reflections_accepts_exactly_five_lines(self):
        _, mysteries = self.mod.parse_rosary_mysteries(JOYFUL_TEXT)

        reflections = self.mod.validate_rosary_reflections(
            "\n".join(f"{index}. Reflection {index}." for index in range(1, 6)),
            mysteries,
        )

        self.assertEqual(reflections[0], "Reflection 1.")
        self.assertEqual(len(reflections), 5)

    def test_validate_rosary_reflections_rejects_wrong_count_and_long_items(self):
        _, mysteries = self.mod.parse_rosary_mysteries(JOYFUL_TEXT)

        with self.assertRaisesRegex(RuntimeError, "exactly 5 reflections"):
            self.mod.validate_rosary_reflections("Only one reflection.", mysteries)

        with self.assertRaisesRegex(RuntimeError, "too long"):
            self.mod.validate_rosary_reflections(["x" * 651] * 5, mysteries)

    def test_build_rosary_reflections_uses_generated_output_when_valid(self):
        _, mysteries = self.mod.parse_rosary_mysteries(JOYFUL_TEXT)
        context = SimpleNamespace(
            celebration_clause="Monday of Easter Week",
            gospel_citation="John 10:1-10",
            gospel_text="Jesus calls his sheep by name.",
        )

        with mock.patch.object(self.mod, "fetch_daily_gospel_context", return_value=context), mock.patch.object(
            self.mod,
            "_call_openai_reflections",
            return_value="\n".join(f"Generated reflection {index}." for index in range(1, 6)),
        ):
            reflections = self.mod.build_rosary_reflections(datetime.date(2026, 4, 6), mysteries)

        self.assertEqual(reflections, tuple(f"Generated reflection {index}." for index in range(1, 6)))

    def test_rosary_day_context_prioritizes_optional_memorial_then_gospel_then_season(self):
        _, mysteries = self.mod.parse_rosary_mysteries(JOYFUL_TEXT)
        gospel_context = SimpleNamespace(
            celebration_clause="Saint Example",
            gospel_citation="John 10:1-10",
            gospel_text="Jesus calls his sheep by name.",
        )

        with mock.patch.object(self.mod, "fetch_daily_gospel_context", return_value=gospel_context), mock.patch.object(
            self.mod,
            "romcal_fetch_day",
            return_value=[
                {
                    "name": "Ferial Weekday",
                    "rank_name": "weekday",
                    "season": "easter_time",
                },
                {
                    "name": "Saint Optional",
                    "rank_name": "optional_memorial",
                    "suppressed": True,
                },
            ],
        ):
            feast = self.mod.build_rosary_day_context(datetime.date(2026, 4, 6), JOYFUL_TEXT)

        self.assertEqual(feast.focus_source, "feast")
        self.assertEqual(feast.focus_title, "Saint Optional")
        self.assertEqual(feast.focus_prompt_label, "the feast of Saint Optional")

        with mock.patch.object(self.mod, "fetch_daily_gospel_context", return_value=gospel_context), mock.patch.object(
            self.mod,
            "romcal_fetch_day",
            return_value=[{"name": "Ferial Weekday", "rank_name": "weekday", "season": "ordinary_time"}],
        ):
            gospel = self.mod.build_rosary_day_context(datetime.date(2026, 6, 3), JOYFUL_TEXT)

        self.assertEqual(gospel.focus_source, "gospel")
        self.assertEqual(gospel.focus_title, "Today's Gospel")
        self.assertEqual(gospel.focus_prompt_label, "today's Gospel, John 10:1-10")

        missing_gospel = SimpleNamespace(celebration_clause="Ferial Weekday", gospel_citation="", gospel_text="")
        with mock.patch.object(self.mod, "fetch_daily_gospel_context", return_value=missing_gospel), mock.patch.object(
            self.mod,
            "romcal_fetch_day",
            return_value=[{"name": "Ferial Weekday", "rank_name": "weekday", "season": "ordinary_time"}],
        ):
            season = self.mod.build_rosary_day_context(datetime.date(2026, 6, 3), JOYFUL_TEXT)

        self.assertEqual(season.focus_source, "season")
        self.assertEqual(season.focus_title, "Ordinary Time")

        with mock.patch.object(self.mod, "fetch_daily_gospel_context", side_effect=RuntimeError("no gospel")), mock.patch.object(
            self.mod,
            "romcal_fetch_day",
            side_effect=RuntimeError("no romcal"),
        ):
            fruit = self.mod.build_rosary_day_context(
                datetime.date(2026, 6, 3),
                "",
                mysteries=mysteries,
                mystery_set_title="Joyful Mysteries",
                season="",
            )

        self.assertEqual(fruit.focus_source, "fruit")
        self.assertEqual(fruit.focus_title, "Mystery Fruits")

    def test_build_rosary_intro_uses_generated_text_or_deterministic_fallback(self):
        _, mysteries = self.mod.parse_rosary_mysteries(JOYFUL_TEXT)
        day_context = self.mod.RosaryDayContext(
            date=datetime.date(2026, 4, 6),
            mystery_set_title="Joyful Mysteries",
            mysteries=mysteries,
            focus_source="feast",
            focus_title="Saint Example",
            focus_prompt_label="the feast of Saint Example",
            celebration_clause="Saint Example",
            season_label="Easter season",
            feast_names=("Saint Example",),
            gospel_citation="John 10:1-10",
            gospel_text="Jesus calls his sheep by name.",
            calendar="general_roman",
            locale="en",
        )

        generated = (
            "Today is Monday in the Easter season. "
            "For today's rosary, we will focus on the feast of Saint Example. "
            "The Joyful Mysteries help us pray with Mary."
        )
        with mock.patch.object(self.mod, "_call_openai_text", return_value=generated):
            intro = self.mod.build_rosary_intro_text(
                datetime.date(2026, 4, 6),
                "Joyful Mysteries",
                mysteries,
                day_context=day_context,
            )

        self.assertEqual(intro, generated)

        with mock.patch.object(self.mod, "_call_openai_text", side_effect=RuntimeError("model down")):
            fallback = self.mod.build_rosary_intro_text(
                datetime.date(2026, 4, 6),
                "Joyful Mysteries",
                mysteries,
                day_context=day_context,
            )

        self.assertIn("For today's rosary, we will focus on the feast of Saint Example.", fallback)
        self.assertIn("Joyful Mysteries", fallback)

    def test_build_rosary_reflections_uses_season_generation_when_gospel_is_missing(self):
        _, mysteries = self.mod.parse_rosary_mysteries(JOYFUL_TEXT)
        missing_context = SimpleNamespace(celebration_clause="Monday", gospel_citation="", gospel_text="")
        prompts = []

        def fake_openai_reflections(model, prompt):
            prompts.append(prompt)
            return "\n".join(f"Seasonal reflection {index} for The Annunciation and humility." for index in range(1, 6))

        with mock.patch.object(self.mod, "fetch_daily_gospel_context", return_value=missing_context), mock.patch.object(
            self.mod,
            "_call_openai_reflections",
            side_effect=fake_openai_reflections,
        ):
            reflections = self.mod.build_rosary_reflections(datetime.date(2026, 4, 6), mysteries, season="easter")

        self.assertEqual(len(reflections), 5)
        self.assertIn("Seasonal reflection 1", reflections[0])
        self.assertEqual(len(prompts), 1)
        self.assertIn("Season: Easter season", prompts[0])

    def test_build_rosary_reflections_uses_resolved_day_context_season_when_gospel_is_missing(self):
        _, mysteries = self.mod.parse_rosary_mysteries(JOYFUL_TEXT)
        day_context = self.mod.RosaryDayContext(
            date=datetime.date(2026, 12, 7),
            mystery_set_title="Joyful Mysteries",
            mysteries=mysteries,
            focus_source="season",
            focus_title="Advent",
            focus_prompt_label="the Advent",
            celebration_clause="Monday of Advent",
            season_label="Advent",
            feast_names=(),
            gospel_citation="",
            gospel_text="",
            calendar="general_roman",
            locale="en",
        )
        prompts = []

        def fake_openai_reflections(model, prompt):
            prompts.append(prompt)
            return "\n".join(f"Advent reflection {index} for The Annunciation and humility." for index in range(1, 6))

        with mock.patch.object(self.mod, "_call_openai_reflections", side_effect=fake_openai_reflections):
            reflections = self.mod.build_rosary_reflections(
                datetime.date(2026, 12, 7),
                mysteries,
                day_context=day_context,
            )

        self.assertEqual(len(reflections), 5)
        self.assertEqual(len(prompts), 1)
        self.assertIn("Season: Advent", prompts[0])

    def test_build_rosary_reflections_falls_back_without_gospel_or_valid_model_output(self):
        _, mysteries = self.mod.parse_rosary_mysteries(JOYFUL_TEXT)
        missing_context = SimpleNamespace(celebration_clause="Monday", gospel_citation="", gospel_text="")

        with mock.patch.object(self.mod, "fetch_daily_gospel_context", return_value=missing_context), mock.patch.object(
            self.mod,
            "_call_openai_reflections",
            side_effect=RuntimeError("season generation failed"),
        ):
            reflections = self.mod.build_rosary_reflections(datetime.date(2026, 4, 6), mysteries, season="easter")

        self.assertEqual(len(reflections), 5)
        self.assertIn("In this Easter season", reflections[0])
        self.assertIn("The Annunciation", reflections[0])
        self.assertIn("humility", reflections[0])
        self.assertIn("risen Christ", reflections[0])

        context = SimpleNamespace(
            celebration_clause="Monday",
            gospel_citation="John 10:1-10",
            gospel_text="Jesus calls his sheep by name.",
        )
        with mock.patch.object(self.mod, "fetch_daily_gospel_context", return_value=context), mock.patch.object(
            self.mod,
            "_call_openai_reflections",
            return_value="Only one reflection.",
        ):
            fallback = self.mod.build_rosary_reflections(datetime.date(2026, 4, 6), mysteries)

        self.assertIn("The Annunciation", fallback[0])
        self.assertIn("Easter season", fallback[0])
        self.assertIn("humility", fallback[0])


if __name__ == "__main__":
    unittest.main()
