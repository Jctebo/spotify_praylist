import datetime as dt
import unittest

from jobs.novena.devotional_image_contract import (
    MONTHLY_DEVOTIONS,
    DailyImageSpec,
    build_art_prompt,
    build_filename,
    build_window,
    local_today,
    monthly_variation,
)


class WallpaperContractTests(unittest.TestCase):
    def test_daily_window_includes_today_and_next_nine_across_month_boundary(self):
        self.assertEqual(
            build_window(dt.date(2026, 9, 27)),
            [dt.date(2026, 9, 27) + dt.timedelta(days=i) for i in range(10)],
        )
        self.assertEqual(build_window(dt.date(2026, 9, 27))[-1], dt.date(2026, 10, 6))

    def test_chicago_date_and_fallback_titles(self):
        utc = dt.datetime(2026, 10, 1, 4, 30, tzinfo=dt.timezone.utc)
        self.assertEqual(local_today(utc), dt.date(2026, 9, 30))
        self.assertEqual(len(MONTHLY_DEVOTIONS), 12)
        self.assertEqual(MONTHLY_DEVOTIONS[10], "OUR LADY OF THE ROSARY")
        self.assertEqual(monthly_variation(dt.date(2026, 10, 2)), "MYSTERIES OF CHRIST")

    def test_filename_is_date_keyed_and_has_variant_independent_identity(self):
        spec = DailyImageSpec(dt.date(2026, 10, 7), "Our Lady of the Rosary", "MEMORIAL", "calendar", "")
        self.assertEqual(build_filename(spec, "phone"), "our-lady-of-the-rosary__2026-10-07.jpg")
        self.assertIn("FEAST", spec.__class__(spec.date, spec.title, "FEAST", "calendar", "").image_subtitle)

    def test_watch_prompt_reserves_title_area_and_keeps_subject_in_circle(self):
        spec = DailyImageSpec(dt.date(2026, 9, 30), "SAINT JEROME PRIEST AND DOCTOR", "MEMORIAL", "calendar", "")
        prompt = build_art_prompt(spec, "watch")
        self.assertIn("upper 35 percent", prompt)
        self.assertIn("Keep the devotional subject large, prominent, and centered", prompt)
        self.assertIn("overlaid separately at the bottom over the artwork", prompt)
        self.assertIn("with no banner or fade behind them", prompt)
        self.assertIn("lower 24 percent to nonessential robe, ground, or background detail", prompt)
        self.assertNotIn("Place the devotional subject and its face below", prompt)
        self.assertIn("every identity-defining symbol comfortably inside the centered circular safe area", prompt)


class GospelSceneSubtitleTests(unittest.TestCase):
    def test_gospel_scene_subtitle_ignores_classification_and_subtitle(self):
        empty = DailyImageSpec(
            dt.date(2026, 11, 10), "THE UNPROFITABLE SERVANT", "MEMORIAL",
            "gospel", "", gospel_scene=True,
        )
        self.assertEqual(empty.image_subtitle, "TODAY'S GOSPEL")
        filled = DailyImageSpec(
            dt.date(2026, 11, 10), "THE UNPROFITABLE SERVANT", "SOLEMNITY",
            "gospel", "A BORROWED LINE", gospel_scene=True,
        )
        self.assertEqual(filled.image_subtitle, "TODAY'S GOSPEL")
        sequenced = DailyImageSpec(
            dt.date(2026, 11, 10), "THE UNPROFITABLE SERVANT", "PRIVATE DEVOTION",
            "gospel", "", sequence_kind="OCTAVE", sequence_day=2, gospel_scene=True,
        )
        self.assertEqual(sequenced.image_subtitle, "TODAY'S GOSPEL")

    def test_gospel_scene_keeps_production_filename(self):
        spec = DailyImageSpec(
            dt.date(2026, 11, 10), "THE UNPROFITABLE SERVANT", "MEMORIAL",
            "gospel", "", gospel_scene=True,
        )
        self.assertEqual(build_filename(spec, "phone"), "the-unprofitable-servant__2026-11-10.jpg")
        self.assertEqual(build_filename(spec, "watch"), "the-unprofitable-servant__2026-11-10.jpg")

    def test_non_gospel_subtitles_are_unchanged(self):
        solemnity = DailyImageSpec(dt.date(2026, 12, 8), "IMMACULATE CONCEPTION", "SOLEMNITY", "calendar", "")
        self.assertEqual(solemnity.image_subtitle, "SOLEMNITY")
        memorial = DailyImageSpec(
            dt.date(2026, 11, 10), "SAINT MARTIN OF TOURS", "MEMORIAL", "calendar", "SOLDIER OF CHRIST",
        )
        self.assertEqual(memorial.image_subtitle, "MEMORIAL · SOLDIER OF CHRIST")
        devotion = DailyImageSpec(
            dt.date(2026, 11, 10), "HOLY SOULS", "PRIVATE DEVOTION", "devotion", "",
            sequence_kind="OCTAVE", sequence_day=3,
        )
        self.assertEqual(devotion.image_subtitle, "PRIVATE DEVOTION · OCTAVE DAY 3")
        devotion_filled = DailyImageSpec(
            dt.date(2026, 11, 10), "HOLY SOULS", "PRIVATE DEVOTION", "devotion", "FOR THE FAITHFUL DEPARTED",
            sequence_kind="TRIDUUM", sequence_day=1,
        )
        self.assertEqual(devotion_filled.image_subtitle, "PRIVATE DEVOTION · TRIDUUM DAY 1 · FOR THE FAITHFUL DEPARTED")
        monthly = DailyImageSpec(
            dt.date(2026, 11, 10), "HOLY SOULS IN PURGATORY", "PRIVATE DEVOTION", "monthly", "",
            monthly_fallback=True,
        )
        self.assertEqual(monthly.image_subtitle, "NOVEMBER DEVOTION")
        monthly_filled = DailyImageSpec(
            dt.date(2026, 11, 10), "HOLY SOULS IN PURGATORY", "PRIVATE DEVOTION", "monthly",
            "HOPE OF ETERNAL LIFE", monthly_fallback=True,
        )
        self.assertEqual(monthly_filled.image_subtitle, "NOVEMBER DEVOTION · HOPE OF ETERNAL LIFE")


if __name__ == "__main__":
    unittest.main()
