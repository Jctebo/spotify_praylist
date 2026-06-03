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
            self.mod.validate_rosary_reflections(["x" * 281] * 5, mysteries)

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

    def test_build_rosary_reflections_falls_back_without_gospel_or_valid_model_output(self):
        _, mysteries = self.mod.parse_rosary_mysteries(JOYFUL_TEXT)
        missing_context = SimpleNamespace(celebration_clause="Monday", gospel_citation="", gospel_text="")

        with mock.patch.object(self.mod, "fetch_daily_gospel_context", return_value=missing_context):
            reflections = self.mod.build_rosary_reflections(datetime.date(2026, 4, 6), mysteries, season="easter")

        self.assertEqual(len(reflections), 5)
        self.assertIn("in this Easter season", reflections[0])
        self.assertIn("The Annunciation", reflections[0])

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


if __name__ == "__main__":
    unittest.main()
