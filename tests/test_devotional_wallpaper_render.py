import io
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image, ImageChops

from jobs.novena.devotional_image_contract import DailyImageSpec
from jobs.novena.devotional_wallpaper_render import (
    WATCH_SAFE_RADIUS,
    WATCH_LABEL_BOTTOM_MARGIN,
    RENDER_VERSION,
    WATCH_TEXT_LAYOUT,
    WATCH_RENDER_VERSION,
    QAResult,
    _circular_chord_width,
    image_tool,
    ocr_text,
    overlay_wallpaper_text,
    render_variant,
    validate_local_qa,
)


class WallpaperRenderTests(unittest.TestCase):
    def setUp(self):
        self.spec = DailyImageSpec(__import__("datetime").date(2026, 10, 7), "OUR LADY OF THE ROSARY", "FEAST", "calendar", "")
        image = Image.new("RGB", (1024, 1024), (45, 56, 75))
        output = io.BytesIO()
        image.save(output, format="PNG")
        self.art = output.getvalue()

    def test_independent_device_sizes_and_text_contract(self):
        phone = overlay_wallpaper_text(self.art, self.spec, "phone")
        watch = overlay_wallpaper_text(self.art, self.spec, "watch")
        with Image.open(io.BytesIO(phone)) as image:
            self.assertEqual(image.size, (1080, 1920))
            self.assertEqual(image.format, "JPEG")
        with Image.open(io.BytesIO(watch)) as image:
            self.assertEqual(image.size, (1024, 1024))
        recognize = lambda _image: ("", "OUR LADY OF THE ROSARY\nFEAST")
        self.assertTrue(validate_local_qa(phone, self.spec, "phone", recognize=recognize).approved)

    def test_render_metadata_versions_watch_layout_without_relabeling_phone(self):
        with (
            patch("jobs.novena.devotional_wallpaper_render.generate_artwork", return_value=self.art),
            patch("jobs.novena.devotional_wallpaper_render.validate_local_qa", return_value=QAResult(True, (), "", "")),
            patch("jobs.novena.devotional_wallpaper_render.vision_qa", return_value={"approved": True, "issues": []}),
        ):
            _phone, phone_info = render_variant(
                object(), self.spec, "phone", caller_model="caller", image_model="image", qa_model="review",
            )
            _watch, watch_info = render_variant(
                object(), self.spec, "watch", caller_model="caller", image_model="image", qa_model="review",
            )
        self.assertEqual(phone_info["render_version"], "wallpaper-v1")
        self.assertEqual(watch_info["render_version"], "wallpaper-v3")

    def test_circle_chord_contract_and_model_tool_sizes(self):
        self.assertLessEqual(_circular_chord_width(512, 512, WATCH_SAFE_RADIUS), 920)
        self.assertEqual(image_tool(variant="phone", model="image-model")["size"], "1152x2048")
        self.assertEqual(image_tool(variant="watch", model="image-model")["size"], "1024x1024")
        self.assertEqual(RENDER_VERSION, "wallpaper-v1")
        self.assertEqual(WATCH_RENDER_VERSION, "wallpaper-v3")
        self.assertEqual(WATCH_TEXT_LAYOUT.circle_inset, 130)
        self.assertEqual(WATCH_TEXT_LAYOUT.title_short_ratio, 0.045)
        self.assertEqual(WATCH_TEXT_LAYOUT.subtitle_size_ratio, 0.035)

    def test_watch_labels_are_bottom_aligned_and_leave_upper_clock_space_clear(self):
        watch = overlay_wallpaper_text(self.art, self.spec, "watch")
        with Image.open(io.BytesIO(watch)) as image:
            self.assertEqual(image.size, (1024, 1024))
            # The test art is a flat color, so non-background pixels come from the label overlay.
            pixels = image.convert("RGB")
            text_y = []
            for y in range(image.height):
                for x in range(image.width):
                    r, g, b = pixels.getpixel((x, y))
                    # Bright ivory label glyphs stand out from both the flat art and dark fade.
                    if r > 190 and g > 175 and b > 150:
                        text_y.append(y)
            self.assertTrue(text_y)
            self.assertGreaterEqual(min(text_y), 0.67 * image.height)
            self.assertLessEqual(max(text_y), 0.97 * image.height)
            self.assertLess(max(text_y), image.height - 70)

    def test_watch_label_pixels_keep_extra_clearance_from_circular_corners(self):
        watch = overlay_wallpaper_text(self.art, self.spec, "watch")
        with Image.open(io.BytesIO(watch)) as image:
            background = Image.new("RGB", image.size, (45, 56, 75))
            mask = ImageChops.difference(image.convert("RGB"), background).convert("L")
            mask = mask.point(lambda value: 255 if value >= 24 else 0)
            for y in range(image.height):
                row = mask.crop((0, y, image.width, y + 1)).getbbox()
                if row is None:
                    continue
                chord = _circular_chord_width(y, 512, WATCH_SAFE_RADIUS)
                edge = (image.width - chord) / 2
                self.assertGreaterEqual(row[0], edge + 28)
                self.assertLessEqual(row[2] - 1, image.width - edge - 28)

    def test_phone_title_stays_at_top(self):
        phone = overlay_wallpaper_text(self.art, self.spec, "phone")
        with Image.open(io.BytesIO(phone)) as image:
            self.assertEqual(image.size, (1080, 1920))
            pixels = image.convert("RGB")
            # Phone's existing title overlay remains in the top portion.
            self.assertNotEqual(pixels.getpixel((image.width // 2, int(image.height * 0.06))), (45, 56, 75))

    def test_long_monthly_watch_label_fits_using_tracked_glyph_widths(self):
        spec = DailyImageSpec(
            __import__("datetime").date(2026, 9, 27),
            "OUR LADY OF SORROWS",
            "PRIVATE DEVOTION",
            "monthly_fallback",
            "MARY AT THE CROSS",
            monthly_fallback=True,
        )
        watch = overlay_wallpaper_text(self.art, spec, "watch")
        with Image.open(io.BytesIO(watch)) as image:
            self.assertEqual(image.size, (1024, 1024))
            self.assertEqual(image.format, "JPEG")
            bright_y = [
                y for y in range(image.height) for x in range(image.width)
                if (lambda pixel: pixel[0] > 190 and pixel[1] > 175 and pixel[2] > 150)(image.getpixel((x, y)))
            ]
            self.assertTrue(bright_y)
            self.assertLessEqual(max(bright_y), image.height - WATCH_LABEL_BOTTOM_MARGIN + 6)

    def test_local_qa_tolerates_minor_ocr_character_errors_but_checks_both_labels(self):
        spec = DailyImageSpec(
            __import__("datetime").date(2026, 9, 27),
            "OUR LADY OF SORROWS",
            "PRIVATE DEVOTION",
            "monthly_fallback",
            "MARY AT THE CROSS",
            monthly_fallback=True,
        )
        final = overlay_wallpaper_text(self.art, spec, "watch")
        recognized = "OUR LADY OF SORROW5\nSEPTEMBER DEVOTION MARY AT THE CROS5"
        accepted = validate_local_qa(final, spec, "watch", recognize=lambda _image: (recognized, recognized))
        self.assertTrue(accepted.approved)
        rejected = validate_local_qa(final, spec, "watch", recognize=lambda _image: ("WRONG TITLE", "WRONG TITLE"))
        self.assertFalse(rejected.approved)

    def test_local_qa_finds_title_words_amid_false_reads_from_artwork(self):
        spec = DailyImageSpec(
            __import__("datetime").date(2026, 9, 29),
            "SAINTS MICHAEL GABRIEL AND RAPHAEL",
            "FEAST",
            "calendar",
            "",
        )
        final = overlay_wallpaper_text(self.art, spec, "watch")
        recognized = "SAINTS MICHAEL GABRIEL AND TRUAUPIGLANBIE AUR CISLAINIGISILS RAPHAEL\nFEAST"
        result = validate_local_qa(final, spec, "watch", recognize=lambda _image: (recognized, recognized))
        self.assertTrue(result.approved)

    def test_local_qa_normalizes_accents_without_changing_rendered_title(self):
        spec = DailyImageSpec(
            __import__("datetime").date(2026, 10, 1),
            "SAINT THÉRÈSE OF THE CHILD JESUS VIRGIN AND DOCTOR",
            "MEMORIAL",
            "calendar",
            "",
        )
        final = overlay_wallpaper_text(self.art, spec, "phone")
        recognized = "SAINT THERESE OF THE CHILD JESUS VIRGIN AND DOCTOR\nMEMORIAL"
        result = validate_local_qa(final, spec, "phone", recognize=lambda _image: (recognized, recognized))
        self.assertTrue(result.approved)

    def test_local_qa_tolerates_ocr_joining_sequence_day_number(self):
        spec = DailyImageSpec(
            __import__("datetime").date(2026, 10, 5),
            "OUR LADY OF THE ROSARY",
            "PRIVATE DEVOTION",
            "calendar",
            "",
            sequence_kind="TRIDUUM",
            sequence_day=2,
        )
        final = overlay_wallpaper_text(self.art, spec, "watch")
        recognized = "OUR LADY OF THE ROSARY\nPRIVATE DEVOTION TRIDUUM DAY2"
        result = validate_local_qa(final, spec, "watch", recognize=lambda _image: (recognized, recognized))
        self.assertTrue(result.approved)

    def test_last_render_is_saved_and_returned_when_qa_rejects_all_attempts(self):
        with tempfile.TemporaryDirectory() as directory:
            rejected = Path(directory) / ".rejected" / "watch.jpg"
            expected = b"rejected final render"
            with (
                patch("jobs.novena.devotional_wallpaper_render.generate_artwork", return_value=self.art),
                patch("jobs.novena.devotional_wallpaper_render.overlay_wallpaper_text", return_value=expected),
                patch(
                    "jobs.novena.devotional_wallpaper_render.validate_local_qa",
                    return_value=QAResult(False, ("bad title",), "", ""),
                ),
            ):
                final, qa = render_variant(
                    object(), self.spec, "watch", caller_model="caller", image_model="image",
                    qa_model="review", rejected_path=rejected,
                )
            self.assertEqual(rejected.read_bytes(), expected)
            self.assertEqual(final, expected)
            self.assertFalse(qa["approved"])
            self.assertTrue(qa["fallback_used"])
            self.assertEqual(qa["fallback_stage"], "local_qa")
            self.assertEqual(qa["render_attempts"], 3)

    def test_local_qa_rejects_missing_title_and_invalid_image(self):
        final = overlay_wallpaper_text(self.art, self.spec, "watch")
        result = validate_local_qa(final, self.spec, "watch", recognize=lambda _image: ("", "WRONG\nFEAST"))
        self.assertFalse(result.approved)
        with self.assertRaises(RuntimeError):
            validate_local_qa(b"not an image", self.spec, "watch", recognize=lambda _image: ("", ""))

    def test_ocr_uses_dictionary_output_and_preserves_title_lines_without_pandas(self):
        words = ["OUR", "LADY", "OF", "SORROWS", "SEPTEMBER", "DEVOTION", ""]
        line_numbers = [1, 1, 1, 1, 2, 2, 2]
        observed_sizes = []

        def fake_image_to_data(image, **_kwargs):
            observed_sizes.append(image.size)
            return {
                "text": words,
                "block_num": [1] * len(words),
                "par_num": [1] * len(words),
                "line_num": line_numbers,
            }

        fake_tesseract = SimpleNamespace(
            Output=SimpleNamespace(DICT="dict"),
            image_to_data=fake_image_to_data,
        )
        with patch.dict(sys.modules, {"pytesseract": fake_tesseract}):
            text, lines = ocr_text(self.art)
        self.assertEqual(text, "OUR LADY OF SORROWS SEPTEMBER DEVOTION")
        self.assertEqual(lines, "OUR LADY OF SORROWS\nSEPTEMBER DEVOTION")
        self.assertEqual(observed_sizes[0], (922, 276))
        self.assertEqual(observed_sizes[-2:], [(2580, 525), (2580, 525)])
        self.assertEqual(len(observed_sizes), 6)

    def test_ocr_focuses_a_separate_watch_subtitle_band(self):
        observed_configs = []

        def fake_image_to_data(image, *, config, **_kwargs):
            observed_configs.append(config)
            words = ["MEMORIAL"] if image.size == (2580, 525) else ["OUR", "LADY", "OF", "THE", "ROSARY"]
            return {
                "text": words,
                "block_num": [1] * len(words),
                "par_num": [1] * len(words),
                "line_num": [1] * len(words),
            }

        fake_tesseract = SimpleNamespace(Output=SimpleNamespace(DICT="dict"), image_to_data=fake_image_to_data)
        with patch.dict(sys.modules, {"pytesseract": fake_tesseract}):
            text, _lines = ocr_text(self.art)
        self.assertIn("MEMORIAL", text)
        self.assertEqual(observed_configs[-2:], ["--psm 6", "--psm 7"])


if __name__ == "__main__":
    unittest.main()
