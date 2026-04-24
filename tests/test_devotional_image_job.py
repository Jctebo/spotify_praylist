import io
import json
import datetime
import os
import subprocess
import tempfile
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from tests.test_helpers import load_module


class TestDevotionalImageJob(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/novena/generate_devotional_image.py")

    def test_direct_script_import_bootstraps_repo_root_without_pythonpath(self):
        script_path = Path("jobs/novena/generate_devotional_image.py").resolve()
        code = (
            "import importlib.util; "
            f"spec = importlib.util.spec_from_file_location('devotional_image_bootstrap', r'{script_path}'); "
            "module = importlib.util.module_from_spec(spec); "
            "spec.loader.exec_module(module)"
        )

        env = {key: value for key, value in os.environ.items() if key != "PYTHONPATH"}
        result = subprocess.run(
            [sys.executable, "-c", code],
            cwd=tempfile.gettempdir(),
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(
            result.returncode,
            0,
            msg=f"stdout={result.stdout}\nstderr={result.stderr}",
        )

    def make_storage(self, root: Path):
        return self.mod.StorageDirs(
            root=root,
            current=root / "Current Devotion",
            archive=root / "Non Current Devotion",
            current_wide=root / "Current Devotion Wide",
            archive_wide=root / "Non Current Devotion Wide",
            metadata_archive=root / "Devotional Metadata Archive",
        )

    def test_apply_portrait_title_overlay_draws_text_without_resizing(self):
        image = Image.new("RGB", (1024, 1536), color=(32, 48, 64))
        raw = io.BytesIO()
        image.save(raw, format="PNG")
        source_bytes = raw.getvalue()

        overlaid = self.mod.apply_portrait_title_overlay(source_bytes, "St. Joseph", "png")

        self.assertNotEqual(overlaid, source_bytes)
        result = Image.open(io.BytesIO(overlaid))
        self.assertEqual(result.size, (1024, 1536))

    def test_apply_wide_title_overlay_draws_text_without_resizing(self):
        image = Image.new("RGB", (1536, 1024), color=(28, 40, 56))
        raw = io.BytesIO()
        image.save(raw, format="PNG")
        source_bytes = raw.getvalue()

        overlaid = self.mod.apply_wide_title_overlay(source_bytes, "St. Joseph", "png")

        self.assertNotEqual(overlaid, source_bytes)
        result = Image.open(io.BytesIO(overlaid))
        self.assertEqual(result.size, (1536, 1024))

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

    def test_collect_image_candidates_window_excludes_easter_octave_pseudo_rank(self):
        start = datetime.date(2026, 4, 6)

        def fake_fetch(_calendar, _locale, _dt):
            return [
                {
                    "id": "easter_monday",
                    "name": "Monday within the Octave of Easter",
                    "rank_name": "solemnity",
                    "precedence": "Precedence.weekday_of_easter_octave_2",
                }
            ]

        with patch.object(self.mod, "romcal_fetch_day", side_effect=fake_fetch):
            rows = self.mod.collect_image_candidates_window("general_roman", "en", start, 0)

        self.assertEqual(rows, [])

    def test_collect_image_candidates_window_accepts_ordinary_solemnity(self):
        start = datetime.date(2026, 12, 25)

        def fake_fetch(_calendar, _locale, _dt):
            return [
                {
                    "id": "nativity_of_the_lord",
                    "name": "The Nativity of the Lord (Christmas)",
                    "rank_name": "solemnity",
                    "precedence": "Precedence.proper_of_time_solemnity_2",
                }
            ]

        with patch.object(self.mod, "romcal_fetch_day", side_effect=fake_fetch):
            rows = self.mod.collect_image_candidates_window("general_roman", "en", start, 0)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["celebration_rank"], "solemnity")

    def test_select_title_placement_prefers_lower_center_box_on_uniform_portrait(self):
        image = Image.new("RGBA", (1024, 1536), color=(64, 64, 64, 255))
        draw = self.mod.ImageDraw.Draw(image)
        min_font = max(24, int(image.size[1] * 0.026))
        max_font = max(min_font, int(image.size[1] * 0.07))
        line_spacing = max(8, int(image.size[1] * 0.012))

        placement = self.mod._select_title_placement(image, draw, "Saint Joseph", min_font, max_font, line_spacing)

        self.assertIsNotNone(placement)
        candidate, _font, _lines, _bbox = placement
        self.assertEqual(candidate.name, "bottom_center")

    def test_select_title_placement_prefers_lower_center_box_on_uniform_widescreen(self):
        image = Image.new("RGBA", (1536, 1024), color=(64, 64, 64, 255))
        draw = self.mod.ImageDraw.Draw(image)
        min_font = max(24, int(image.size[1] * 0.026))
        max_font = max(min_font, int(image.size[1] * 0.07))
        line_spacing = max(8, int(image.size[1] * 0.012))

        placement = self.mod._select_title_placement(image, draw, "Saint Joseph", min_font, max_font, line_spacing)

        self.assertIsNotNone(placement)
        candidate, _font, _lines, _bbox = placement
        self.assertEqual(candidate.name, "bottom_center")

    def test_select_title_placement_avoids_busy_lower_boxes_and_chooses_clear_lower_box(self):
        image = Image.new("RGBA", (1024, 1536), color=(72, 72, 72, 255))
        candidates = {candidate.name: candidate for candidate in self.mod._title_box_candidates(*image.size)}
        noisy_names = {"bottom_left", "bottom_center"}
        pixels = image.load()

        for name in noisy_names:
            candidate = candidates[name]
            for y in range(candidate.top, min(image.size[1], candidate.top + candidate.height), 12):
                for x in range(candidate.left, min(image.size[0], candidate.left + candidate.width), 12):
                    color = (220, 180, 96, 255) if ((x + y) // 12) % 2 == 0 else (24, 24, 24, 255)
                    for dy in range(12):
                        for dx in range(12):
                            px = x + dx
                            py = y + dy
                            if px < image.size[0] and py < image.size[1]:
                                pixels[px, py] = color

        draw = self.mod.ImageDraw.Draw(image)
        min_font = max(24, int(image.size[1] * 0.026))
        max_font = max(min_font, int(image.size[1] * 0.07))
        line_spacing = max(8, int(image.size[1] * 0.012))

        placement = self.mod._select_title_placement(image, draw, "Saint Joseph", min_font, max_font, line_spacing)

        self.assertIsNotNone(placement)
        candidate, _font, _lines, _bbox = placement
        self.assertEqual(candidate.name, "bottom_right")

    def test_migrate_legacy_sidecars_moves_prompt_and_window_into_metadata_archive(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            storage = self.make_storage(root)
            storage.current.mkdir(parents=True)
            storage.metadata_archive.mkdir(parents=True)
            image_path = storage.current / "03-10_03-19_cal_saint-joseph_mod_realism.png"
            image_path.write_bytes(b"img")
            image_path.with_suffix(".prompt.txt").write_text("prompt body", encoding="utf-8")
            image_path.with_suffix(".window.txt").write_text("window body", encoding="utf-8")

            self.mod.migrate_legacy_sidecars(storage, image_path)

            self.assertFalse(image_path.with_suffix(".prompt.txt").exists())
            self.assertFalse(image_path.with_suffix(".window.txt").exists())
            self.assertEqual(
                self.mod.sidecar_archive_path(storage, image_path, ".prompt.txt").read_text(encoding="utf-8"),
                "prompt body",
            )
            self.assertEqual(
                self.mod.sidecar_archive_path(storage, image_path, ".window.txt").read_text(encoding="utf-8"),
                "window body",
            )

    def test_write_manifests_excludes_archived_sidecars_from_public_file_listing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            storage = self.make_storage(root)
            for folder in storage.all_dirs():
                folder.mkdir(parents=True, exist_ok=True)
            image_path = storage.current / "03-10_03-19_cal_saint-joseph_mod_realism.png"
            image_path.write_bytes(b"img")
            self.mod.write_archived_sidecar(storage, image_path, ".prompt.txt", "prompt body")
            self.mod.write_archived_sidecar(storage, image_path, ".window.txt", "window body")

            self.mod.write_manifests(storage)

            manifest = json.loads((storage.current / "images_manifest.json").read_text(encoding="utf-8"))
            files = manifest["items"][0]["files"]
            self.assertEqual(set(files.keys()), {"image"})


if __name__ == "__main__":
    unittest.main()
