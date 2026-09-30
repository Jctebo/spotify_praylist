import datetime as dt
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

from jobs.novena.reflow_existing_watch_wallpapers import (
    build_output,
    discover_targets,
    migrate,
    remove_old_top_labels,
    square_repaired_art,
)
from jobs.novena.devotional_image_contract import DailyImageSpec


class ReflowExistingWatchTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "DCIM"
        self.current = self.root / "watch-current"
        self.queue = self.root / "watch-queue"
        self.current.mkdir(parents=True)
        self.queue.mkdir(parents=True)
        self.manifests = self.root / ".devotional_wallpapers" / "manifests" / "runs"
        self.manifests.mkdir(parents=True)
        self.paths = []
        for index in range(10):
            day = dt.date(2026, 9, 30) + dt.timedelta(days=index)
            title = "SAINT JEROME, PRIEST AND DOCTOR" if index == 0 else f"SAINT {index}"
            name = title.lower().replace(",", "").replace(" ", "-") + f"__{day.isoformat()}.jpg"
            folder = self.current if index == 0 else self.queue / day.isoformat()
            folder.mkdir(parents=True, exist_ok=True)
            path = folder / name
            image = Image.new("RGB", (1024, 1024), (35, 36, 38))
            # Existing top text is represented by bright painted pixels.
            from PIL import ImageDraw
            ImageDraw.Draw(image).text((250, 150), "OLD TOP TEXT", fill=(245, 245, 230))
            image.save(path, format="JPEG", quality=92)
            self.paths.append((path, day, title))
        for path, day, title in self.paths:
            asset_key = f"{day.isoformat()}:watch"
            spec = {
                "date": day.isoformat(), "title": title, "classification": "MEMORIAL",
                "source_kind": "calendar", "subtitle": "", "priority": 100,
                "monthly_fallback": False,
            }
            remote = path.relative_to(self.root).as_posix()
            payload = {"assets": {asset_key: {"variant": "watch", "state": "delivered_verified", "remote_path": remote, "spec": spec}}}
            (self.manifests / f"{day.isoformat()}.json").write_text(json.dumps(payload), encoding="utf-8")

    def test_dry_run_does_not_write_and_finds_exact_ten(self):
        before = {path: path.read_bytes() for path, _, _ in self.paths}
        result = migrate(self.root, Path(self.temp.name) / "backup", self.manifests)
        self.assertEqual(len(result), 10)
        self.assertEqual(before, {path: path.read_bytes() for path, _, _ in self.paths})

    def test_preview_directory_receives_rendered_outputs_without_changing_sources(self):
        preview = Path(self.temp.name) / "preview"
        before = {path: path.read_bytes() for path, _, _ in self.paths}
        result = migrate(self.root, Path(self.temp.name) / "backup", self.manifests, preview_dir=preview)
        self.assertEqual(len(result), 10)
        self.assertEqual(before, {path: path.read_bytes() for path, _, _ in self.paths})
        self.assertEqual(len(list(preview.rglob("*.jpg"))), 10)

    def test_top_cleanup_removes_old_label_and_preserves_pixels_below_band(self):
        path, day, title = self.paths[0]
        source = path.read_bytes()
        cleaned = remove_old_top_labels(source)
        with Image.open(io.BytesIO(source)) as original, Image.open(io.BytesIO(cleaned)) as result:
            original.load(); result.load()
            self.assertEqual(result.size, (1024, 1024))
            self.assertEqual(original.getpixel((600, 600)), result.getpixel((600, 600)))
            self.assertEqual(result.getpixel((250, 150)), (35, 36, 38))
        output = build_output(source, DailyImageSpec(day, title, "MEMORIAL", "calendar", ""))
        with Image.open(io.BytesIO(output)) as final:
            self.assertEqual(final.format, "JPEG")
            self.assertEqual(final.size, (1024, 1024))

    def test_discovery_rejects_unexpected_paths(self):
        (self.queue / "extra").mkdir()
        with self.assertRaises(ValueError):
            discover_targets(self.root)

    def test_apply_creates_byte_identical_backups_before_conversion(self):
        backup = Path(self.temp.name) / "outside-onedrive-backup"
        before = {path: path.read_bytes() for path, _, _ in self.paths}
        result = migrate(self.root, backup, self.manifests, apply=True)
        self.assertEqual(len(result), 10)
        for path, original in before.items():
            saved = backup / path.relative_to(self.root)
            self.assertEqual(saved.read_bytes(), original)
            self.assertNotEqual(path.read_bytes(), original)

    def test_partial_replace_failure_restores_every_original(self):
        backup = Path(self.temp.name) / "rollback-backup"
        before = {path: path.read_bytes() for path, _, _ in self.paths}
        import os
        real_replace = os.replace
        calls = 0

        def fail_second_replace(source, destination):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError("simulated OneDrive file lock")
            return real_replace(source, destination)

        with patch("jobs.novena.reflow_existing_watch_wallpapers.os.replace", side_effect=fail_second_replace):
            with self.assertRaisesRegex(OSError, "simulated OneDrive file lock"):
                migrate(self.root, backup, self.manifests, apply=True)
        self.assertEqual(before, {path: path.read_bytes() for path, _, _ in self.paths})
        self.assertFalse(list(self.root.rglob("*.tmp")))

    def test_apply_rejects_backup_inside_onedrive_target_tree(self):
        before = {path: path.read_bytes() for path, _, _ in self.paths}
        with self.assertRaisesRegex(ValueError, "outside the OneDrive DCIM tree"):
            migrate(self.root, self.root / "backup", self.manifests, apply=True)
        self.assertEqual(before, {path: path.read_bytes() for path, _, _ in self.paths})

    def test_repaired_landscape_art_is_padded_to_square_without_scaling(self):
        image = Image.new("RGB", (1200, 1040), (10, 18, 32))
        from PIL import ImageDraw
        ImageDraw.Draw(image).ellipse((500, 400, 700, 600), fill=(220, 180, 90))
        source = io.BytesIO()
        image.save(source, format="PNG")
        squared = square_repaired_art(source.getvalue())
        with Image.open(io.BytesIO(squared)) as result:
            result.load()
            self.assertEqual(result.size, (1200, 1200))
            self.assertEqual(result.getpixel((600, 728)), (220, 180, 90))

    def test_apply_accepts_named_replacement_for_non_square_legacy_image(self):
        target = self.paths[0][0]
        legacy = Image.new("RGB", (1023, 896), (20, 25, 40))
        legacy.save(target, format="JPEG")
        legacy_bytes = target.read_bytes()
        replacement = Path(self.temp.name) / "repaired.png"
        Image.new("RGB", (1200, 1040), (10, 18, 32)).save(replacement, format="PNG")
        backup = Path(self.temp.name) / "backup-with-override"
        migrate(self.root, backup, self.manifests, apply=True, image_overrides={target.name: replacement})
        with Image.open(target) as result:
            self.assertEqual(result.size, (1024, 1024))
            self.assertEqual(result.format, "JPEG")
        self.assertEqual((backup / target.relative_to(self.root)).read_bytes(), legacy_bytes)


if __name__ == "__main__":
    unittest.main()
