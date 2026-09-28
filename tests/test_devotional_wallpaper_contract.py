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
        self.assertIn("upper 38 percent", prompt)
        self.assertIn("Place the devotional subject and its face below that title area", prompt)
        self.assertIn("every identity-defining symbol comfortably inside the centered circular safe area", prompt)


if __name__ == "__main__":
    unittest.main()
