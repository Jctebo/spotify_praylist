import datetime as dt
import contextlib
import io
import json
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from jobs.novena.devotional_calendar import CalendarResolution, UnclassifiedCalendarItem
from jobs.novena.devotional_image_contract import DailyImageSpec
from jobs.novena import generate_devotional_wallpapers as pipeline
from sync.devotional_onedrive import RemoteAsset


class PipelineOrchestrationTests(unittest.TestCase):
    def setUp(self):
        self.date = dt.date(2026, 10, 1)
        self.spec = DailyImageSpec(self.date, "HOLY EUCHARIST", "PRIVATE DEVOTION", "monthly", "", monthly_fallback=True)
        self.args = SimpleNamespace(
            run_date="2026-10-01", skip_delivery=False, dry_run_rotation=False,
            rotate_only=False, resolve_only=False, resume_run=None,
            artifact_dir=Path("artifacts/test-wallpapers"), tesseract_cmd=None, rclone_exe="rclone",
        )

    def test_missing_only_generation_retries_rotation_and_skips_absent_dates(self):
        present = [
            RemoteAsset("phone-current/holy-eucharist__2026-10-01.jpg", "holy-eucharist__2026-10-01.jpg", 1, "2026-10-01", "phone", subject="holy-eucharist"),
        ]
        staged = []
        class FakeStore:
            def mkdir(self, _path): pass
            def upload(self, local_path, _path): self.staged_bytes = local_path.read_bytes()
            def download_bytes(self, _path): return self.staged_bytes
            def write_json(self, _path, _payload): pass
        fake_store = FakeStore()
        inventory = [present]
        for offset in range(10):
            day = self.date + dt.timedelta(days=offset)
            if day == self.date:
                continue
            if day.day % 2:
                for variant in ("phone", "watch"):
                    inventory[0].append(RemoteAsset(f"{variant}-queue/{day}/{variant}__{day}.jpg", f"{variant}__{day}.jpg", 1, day.isoformat(), variant, subject=variant))
        extra = DailyImageSpec(self.date, "SAINT EXAMPLE", "FEAST", "calendar", "")
        resolution = CalendarResolution({self.date: (self.spec, extra)}, None, "f" * 64, tuple())
        rotations = [{"rotated": False}, {"rotated": True}]
        def deliver(_store, local_path, spec, variant):
            staged.append((spec.date, variant))
            subject = local_path.name.split("__", 1)[0]
            inventory[0][:] = [a for a in inventory[0] if not (a.date == spec.date.isoformat() and a.variant == variant and a.subject == subject)]
            inventory[0].append(RemoteAsset(f"{variant}-queue/{spec.date}/{local_path.name}", local_path.name, 1, spec.date.isoformat(), variant, subject=subject))
            if variant == "watch":
                for paired_variant in ("phone", "watch"):
                    for paired_subject in ("holy-eucharist", "saint-example"):
                        if not any(a.date == spec.date.isoformat() and a.variant == paired_variant and a.subject == paired_subject for a in inventory[0]):
                            filename = f"{paired_subject}__{spec.date}.jpg"
                            inventory[0].append(RemoteAsset(f"{paired_variant}-queue/{spec.date}/{filename}", filename, 1, spec.date.isoformat(), paired_variant, subject=paired_subject))
            return f"{variant}-queue/{spec.date}/{local_path.name}"
        with patch.object(pipeline, "local_today", return_value=self.date), \
             patch.object(pipeline.RcloneConfig, "from_env", return_value=SimpleNamespace()), \
             patch.object(pipeline, "RcloneStore", return_value=fake_store), \
             patch.object(pipeline, "rotate_current", side_effect=rotations) as rotate, \
             patch.object(pipeline, "inventory_assets", side_effect=lambda _s: inventory[0]), \
             patch.object(pipeline, "fetch_calendar", return_value=SimpleNamespace(body=b"calendar")), \
             patch.object(pipeline, "resolve_calendar", return_value=resolution), \
             patch.object(pipeline, "_provider", return_value=object()), \
             patch.object(pipeline, "render_variant", return_value=(b"fake-jpeg", {"approved": True})), \
             patch.object(pipeline, "deliver_missing_asset", side_effect=deliver), \
             patch.object(pipeline, "_persist_remote_state"), \
             patch.object(pipeline, "_load_remote_state", return_value={"schema": 1, "run_id": "a" * 20, "assets": {}}), \
             patch.object(pipeline, "_write_json_atomic"), \
             patch.object(pipeline, "_slot_paths", side_effect=lambda root, spec, variant: (root / variant / f"{spec.date}.jpg", root / ".stage" / variant / f"{spec.date}.jpg")), \
             patch.object(pipeline, "_run_id", return_value="a" * 20):
            result = pipeline.run_pipeline(self.args)
        self.assertEqual(result, 0)
        self.assertEqual(staged, [(self.date, "watch"), (self.date, "phone"), (self.date, "watch")])
        self.assertEqual(rotate.call_count, 2)

    def test_no_missing_assets_still_checks_calendar_and_runs_rotation(self):
        dates = pipeline.build_window(self.date)
        ready = [RemoteAsset(f"{variant}-queue/{day}/holy-eucharist__{day}.jpg", f"holy-eucharist__{day}.jpg", 1, day.isoformat(), variant, subject="holy-eucharist")
                 for day in dates for variant in ("phone", "watch")]
        resolution = CalendarResolution({self.date: (self.spec,)}, None, "f" * 64, tuple())
        with patch.object(pipeline, "local_today", return_value=self.date), \
             patch.object(pipeline.RcloneConfig, "from_env", return_value=SimpleNamespace()), \
             patch.object(pipeline, "RcloneStore", return_value=object()), \
             patch.object(pipeline, "rotate_current", return_value={"rotated": False}) as rotate, \
             patch.object(pipeline, "inventory_assets", return_value=ready), \
             patch.object(pipeline, "fetch_calendar", return_value=SimpleNamespace(body=b"calendar")) as fetch, \
             patch.object(pipeline, "resolve_calendar", return_value=resolution):
            self.assertEqual(pipeline.run_pipeline(self.args), 0)
        fetch.assert_called_once()
        self.assertEqual(rotate.call_count, 2)

    def test_resolve_only_artifact_records_skipped_entry_and_retains_same_day_subject(self):
        date = self.date
        valid_spec = DailyImageSpec(date, "THE BLESSED VIRGIN MARY", "MEMORIAL", "calendar", "")
        resolution = CalendarResolution(
            {date: (valid_spec,)}, None, "f" * 64, tuple(),
            (UnclassifiedCalendarItem(date, "Unrecognized calendar note"),),
        )
        self.args.resolve_only = True
        with patch.object(pipeline, "local_today", return_value=date), \
             patch.object(pipeline, "fetch_calendar", return_value=SimpleNamespace(body=b"calendar")), \
             patch.object(pipeline, "resolve_calendar", return_value=resolution), \
             patch.object(pipeline.RcloneConfig, "from_env", return_value=SimpleNamespace()), \
             patch.object(pipeline, "RcloneStore", return_value=object()), \
             patch.object(pipeline, "inventory_assets", return_value=[]), \
             contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(pipeline.run_pipeline(self.args), 0)
        report = json.loads((self.args.artifact_dir / "resolve-report.json").read_text(encoding="utf-8"))
        self.assertEqual([spec["title"] for spec in report["specs"]], ["THE BLESSED VIRGIN MARY"])
        self.assertEqual(report["unclassified_events_skipped"], [
            {"date": date.isoformat(), "summary": "Unrecognized calendar note"},
        ])

    def test_generation_delivers_last_qa_rejected_render_and_completes_with_warning(self):
        date = self.date
        valid_spec = DailyImageSpec(date, "THE BLESSED VIRGIN MARY", "MEMORIAL", "calendar", "")
        resolution = CalendarResolution(
            {date: (valid_spec,)}, None, "f" * 64, tuple(),
            (UnclassifiedCalendarItem(date, "Unrecognized calendar note"),),
        )
        rendered = []
        inventory = []
        class FakeStore:
            def __init__(self): self.objects = {}
            def mkdir(self, _path): pass
            def write_json(self, _path, _payload): pass
            def upload(self, local_path, path): self.objects[path] = local_path.read_bytes()
            def download_bytes(self, path): return self.objects[path]

        def deliver(_store, local_path, spec, variant):
            rendered.append((spec.title, variant))
            inventory.append(RemoteAsset(
                f"{variant}-queue/{date}/{local_path.name}", local_path.name, 1,
                date.isoformat(), variant, subject=local_path.name.split("__", 1)[0],
            ))
            return f"{variant}-queue/{date}/{local_path.name}"

        with patch.object(pipeline, "local_today", return_value=date), \
             patch.object(pipeline.RcloneConfig, "from_env", return_value=SimpleNamespace()), \
             patch.object(pipeline, "RcloneStore", return_value=FakeStore()), \
             patch.object(pipeline, "rotate_current", side_effect=[{"rotated": False}, {"rotated": False}]), \
             patch.object(pipeline, "inventory_assets", side_effect=lambda _store: inventory), \
             patch.object(pipeline, "fetch_calendar", return_value=SimpleNamespace(body=b"calendar")), \
             patch.object(pipeline, "resolve_calendar", return_value=resolution), \
             patch.object(pipeline, "_provider", return_value=object()), \
             patch.object(pipeline, "render_variant", return_value=(b"fake-jpeg", {
                 "approved": False, "fallback_used": True, "fallback_stage": "local_qa",
                 "issues": ["OCR did not confirm exact title"],
             })), \
             patch.object(pipeline, "deliver_missing_asset", side_effect=deliver), \
             patch.object(pipeline, "_persist_remote_state"), \
             patch.object(pipeline, "_load_remote_state", return_value={"schema": 1, "run_id": "a" * 20, "assets": {}}), \
             patch.object(pipeline, "_run_id", return_value="a" * 20), \
             contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(pipeline.run_pipeline(self.args), 0)
        self.assertEqual(rendered, [("THE BLESSED VIRGIN MARY", "phone"), ("THE BLESSED VIRGIN MARY", "watch")])
        report = json.loads((self.args.artifact_dir / "resolve-report.json").read_text(encoding="utf-8"))
        self.assertEqual(report["status"], "complete_with_warnings")
        self.assertEqual(report["quality_fallbacks"][0]["qa"]["fallback_used"], True)
        self.assertEqual(report["quality_fallbacks"][0]["qa"]["issues"], ["OCR did not confirm exact title"])
        self.assertEqual(report["unclassified_events_skipped"][0]["summary"], "Unrecognized calendar note")

    def test_main_writes_run_status_artifact_when_pipeline_fails(self):
        args = SimpleNamespace(
            run_date=self.date.isoformat(), resume_run=None, rotate_only=False,
            resolve_only=False, skip_delivery=False, dry_run_rotation=False,
            artifact_dir=self.args.artifact_dir,
        )
        with patch.object(pipeline, "build_parser", return_value=SimpleNamespace(parse_args=lambda: args)), \
             patch.object(pipeline, "run_pipeline", side_effect=RuntimeError("calendar unavailable")), \
             contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(pipeline.main(), 1)
        status = json.loads((args.artifact_dir / "run-status.json").read_text(encoding="utf-8"))
        self.assertEqual(status["status"], "failed")
        self.assertEqual(status["error"], "calendar unavailable")


if __name__ == "__main__":
    unittest.main()
