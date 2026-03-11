import io
import datetime
import unittest

from PIL import Image

from tests.test_helpers import load_module


class TestDevotionalImageJob(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/novena/generate_devotional_image.py")

    def test_apply_portrait_title_overlay_draws_text_without_resizing(self):
        image = Image.new("RGB", (1024, 1536), color=(32, 48, 64))
        raw = io.BytesIO()
        image.save(raw, format="PNG")
        source_bytes = raw.getvalue()

        overlaid = self.mod.apply_portrait_title_overlay(source_bytes, "St. Joseph", "png")

        self.assertNotEqual(overlaid, source_bytes)
        result = Image.open(io.BytesIO(overlaid))
        self.assertEqual(result.size, (1024, 1536))

    def test_dedupe_render_targets_prefers_calendar_saint_joseph_over_monthly_devotion(self):
        calendar_target = self.mod.RenderTarget(
            source=self.mod.SOURCE_CALENDAR,
            subject="Saint Joseph, Spouse of the Blessed Virgin Mary",
            subject_slug="saint-joseph-spouse-of-the-blessed-virgin-mary",
            start_date=datetime.date(2026, 3, 10),
            end_date=datetime.date(2026, 3, 19),
            style_id="mod_realism",
            style_prompt="style",
            pipeline_name="calendar",
            context="calendar context",
            source_date="2026-03-19",
        )
        devotion_target = self.mod.RenderTarget(
            source=self.mod.SOURCE_DEVOTION,
            subject="St. Joseph",
            subject_slug="st-joseph",
            start_date=datetime.date(2026, 3, 1),
            end_date=datetime.date(2026, 3, 31),
            style_id="mod_realism",
            style_prompt="style",
            pipeline_name="devotion",
            context="devotion context",
            source_date="2026-03-01",
        )

        deduped = self.mod.dedupe_render_targets([devotion_target, calendar_target])

        self.assertEqual(len(deduped), 1)
        self.assertEqual(deduped[0].source, self.mod.SOURCE_CALENDAR)
        self.assertEqual(deduped[0].subject_slug, "saint-joseph-spouse-of-the-blessed-virgin-mary")


if __name__ == "__main__":
    unittest.main()
