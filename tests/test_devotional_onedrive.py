import datetime as dt
import hashlib
import subprocess
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from jobs.novena.devotional_image_contract import DailyImageSpec
from sync.devotional_onedrive import (
    RcloneConfig,
    RcloneStore,
    RemoteAsset,
    asset_path,
    deliver_missing_asset,
    parse_asset_listing,
)


class MemoryStore:
    def __init__(self):
        self.config = RcloneConfig("onedrive", "Pictures/Samsung Gallery/DCIM")
        self.files = {}

    def validate_root(self):
        pass

    def mkdir(self, _folder):
        pass

    def run(self, *args, check=True):
        path = args[1].removeprefix("onedrive:Pictures/Samsung Gallery/DCIM/")
        class Result:
            returncode = 0 if path in self.files else 3
        return Result()

    def upload(self, local_path, path):
        self.files[path] = local_path.read_bytes()

    def download_bytes(self, path):
        return self.files[path]


class DevotionalOneDriveTests(unittest.TestCase):
    def setUp(self):
        self.spec = DailyImageSpec(dt.date(2026, 10, 1), "Our Lady of the Rosary", "PRIVATE DEVOTION", "monthly", "", monthly_fallback=True)

    def test_root_and_paths_are_scoped_and_validated(self):
        config = RcloneConfig.from_env()
        self.assertTrue(config.remote_path("phone-queue/2026-10-01").endswith("phone-queue/2026-10-01"))
        with self.assertRaises(ValueError):
            config.remote_path("phone-queue/../Current Devotion")
        with self.assertRaises(ValueError):
            config.remote_path("Current Devotion")

    def test_listing_extracts_iso_date_and_variant(self):
        records = [{"Name": "our-lady-of-the-rosary__2026-10-01.jpg", "Path": "2026-10-01/our-lady-of-the-rosary__2026-10-01.jpg", "Size": 7}]
        assets = parse_asset_listing("phone-queue", records)
        self.assertEqual(len(assets), 1)
        self.assertEqual((assets[0].date, assets[0].variant), ("2026-10-01", "phone"))

    def test_delivery_is_verified_and_conflicts_are_never_overwritten(self):
        store = MemoryStore()
        payload = b"image-bytes"
        with TemporaryDirectory() as folder:
            local = Path(folder) / "image.jpg"
            local.write_bytes(payload)
            target = deliver_missing_asset(store, local, self.spec, "phone")
            self.assertEqual(target, asset_path(self.spec, "phone", state="queue"))
            self.assertEqual(hashlib.sha256(store.files[target]).digest(), hashlib.sha256(payload).digest())
            local.write_bytes(b"different")
            with self.assertRaisesRegex(RuntimeError, "Refusing to overwrite"):
                deliver_missing_asset(store, local, self.spec, "phone")

    def test_remote_config_cannot_resolve_into_infographic_root(self):
        import os
        old = os.environ.get("RCLONE_REMOTE_ROOT")
        try:
            os.environ["RCLONE_REMOTE_ROOT"] = "Pictures/Current Devotion"
            with self.assertRaisesRegex(RuntimeError, "overlaps"):
                RcloneConfig.from_env()
        finally:
            if old is None:
                os.environ.pop("RCLONE_REMOTE_ROOT", None)
            else:
                os.environ["RCLONE_REMOTE_ROOT"] = old

    def test_missing_remote_folder_is_an_empty_listing(self):
        def runner(command, **_kwargs):
            return subprocess.CompletedProcess(
                command,
                3,
                stdout="",
                stderr="ERROR : error listing: directory not found",
            )

        store = RcloneStore(RcloneConfig("onedrive", "Pictures/Samsung Gallery/DCIM"), runner=runner)
        self.assertEqual(store.list_files("phone-queue"), [])

    def test_missing_wallpaper_root_is_not_treated_as_an_empty_folder(self):
        def runner(command, **_kwargs):
            return subprocess.CompletedProcess(
                command,
                3,
                stdout="",
                stderr="ERROR : error listing: directory not found",
            )

        store = RcloneStore(RcloneConfig("onedrive", "Pictures/Samsung Gallery/DCIM"), runner=runner)
        with self.assertRaisesRegex(RuntimeError, "wallpaper root check failed"):
            store.validate_root()

    def test_non_missing_folder_listing_errors_still_fail(self):
        def runner(command, **_kwargs):
            return subprocess.CompletedProcess(
                command,
                3,
                stdout="",
                stderr="ERROR : unauthorized: token expired",
            )

        store = RcloneStore(RcloneConfig("onedrive", "Pictures/Samsung Gallery/DCIM"), runner=runner)
        with self.assertRaisesRegex(RuntimeError, "unauthorized: token expired"):
            store.list_files("phone-queue")


if __name__ == "__main__":
    unittest.main()
