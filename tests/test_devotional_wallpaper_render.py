import io
import unittest
from unittest.mock import patch

from PIL import Image

from jobs.novena.devotional_image_contract import DailyImageSpec
from jobs.novena.devotional_wallpaper_render import (
    WATCH_SAFE_RADIUS,
    _circular_chord_width,
    image_tool,
    overlay_wallpaper_text,
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

    def test_circle_chord_contract_and_model_tool_sizes(self):
        self.assertLessEqual(_circular_chord_width(512, 512, WATCH_SAFE_RADIUS), 920)
        self.assertEqual(image_tool(variant="phone", model="image-model")["size"], "1152x2048")
        self.assertEqual(image_tool(variant="watch", model="image-model")["size"], "1024x1024")

    def test_local_qa_rejects_missing_title_and_invalid_image(self):
        final = overlay_wallpaper_text(self.art, self.spec, "watch")
        result = validate_local_qa(final, self.spec, "watch", recognize=lambda _image: ("", "WRONG\nFEAST"))
        self.assertFalse(result.approved)
        with self.assertRaises(RuntimeError):
            validate_local_qa(b"not an image", self.spec, "watch", recognize=lambda _image: ("", ""))


if __name__ == "__main__":
    unittest.main()
