import datetime as dt
import hashlib
import unittest
from pathlib import Path

from sync.devotional_onedrive import RcloneConfig, RemoteAsset, recover_rotation, rotate_current


class MemoryStore:
    def __init__(self):
        self.config = RcloneConfig("onedrive", "DCIM")
        self.files = {}
        self.json = {}

    def validate_root(self):
        pass

    def mkdir(self, _path):
        pass

    def list_files(self, folder, recursive=True):
        prefix = folder.rstrip("/") + "/"
        found = []
        for path, body in self.files.items():
            if path.startswith(prefix):
                relative = path[len(prefix):]
                if recursive or "/" not in relative:
                    found.append({"Name": relative.rsplit("/", 1)[-1], "Path": relative, "Size": len(body)})
        return found

    def read_json(self, path):
        return self.json.get(path)

    def write_json(self, path, data):
        self.json[path] = data.copy()

    def download_bytes(self, path):
        if path not in self.files:
            raise RuntimeError("object not found")
        return self.files[path]

    def copy_remote(self, source, target, immutable=False):
        if target in self.files and self.files[target] != self.files[source]:
            raise RuntimeError("destination conflict")
        self.files.setdefault(target, self.files[source])

    def remove(self, path):
        self.files.pop(path, None)


def add_pair(store, date, phone=b"phone", watch=b"watch"):
    for variant, payload, title in (("phone", phone, "holy-eucharist"), ("watch", watch, "holy-eucharist")):
        name = f"{title}__{date}.jpg"
        store.files[f"{variant}-queue/{date}/{name}"] = payload


def add_subject_set(store, date, subjects):
    for subject in subjects:
        for variant in ("phone", "watch"):
            name = f"{subject}__{date}.jpg"
            store.files[f"{variant}-queue/{date}/{name}"] = f"{variant}-{subject}".encode()


class DevotionalRotationTests(unittest.TestCase):
    def _seed_wenceslaus_transition(self):
        store = MemoryStore()
        add_subject_set(store, "2026-09-28", ("saint-wenceslaus",))
        rotate_current(store, "2026-09-28")
        add_subject_set(store, "2026-09-29", ("saint-wenceslaus",))
        return store

    def test_first_rotation_promotes_both_and_replay_is_noop(self):
        store = MemoryStore()
        add_pair(store, "2026-10-01")
        result = rotate_current(store, "2026-10-01")
        self.assertTrue(result["rotated"])
        self.assertEqual(set(store.files), {"phone-current/holy-eucharist__2026-10-01.jpg", "watch-current/holy-eucharist__2026-10-01.jpg"})
        replay = rotate_current(store, "2026-10-01")
        self.assertFalse(replay["rotated"])

    def test_first_rotation_ignores_unmanaged_files_in_queue_root(self):
        store = MemoryStore()
        add_pair(store, "2026-10-01")
        store.files["phone-queue/undated-manual.jpg"] = b"manual"
        self.assertTrue(rotate_current(store, "2026-10-01")["rotated"])
        self.assertIn("phone-queue/undated-manual.jpg", store.files)

    def test_same_day_replacement_archives_old_bytes_before_promotion(self):
        store = MemoryStore()
        add_pair(store, "2026-10-01", b"old phone", b"old watch")
        rotate_current(store, "2026-10-01")
        old_state = store.json[".devotional_wallpapers/manifests/rotation-state.json"]
        for variant in ("phone", "watch"):
            store.files[f"{variant}-queue/2026-10-01/holy-eucharist__2026-10-01.jpg"] = f"new {variant}".encode()
        result = rotate_current(store, "2026-10-01")
        self.assertTrue(result["rotated"])
        self.assertEqual(store.files[".devotional_wallpapers/archive/2026-10-01/phone/holy-eucharist__2026-10-01.jpg"], b"old phone")
        self.assertEqual(store.files["phone-current/holy-eucharist__2026-10-01.jpg"], b"new phone")

    def test_pair_gap_keeps_current_unchanged(self):
        store = MemoryStore()
        add_pair(store, "2026-10-01")
        rotate_current(store, "2026-10-01")
        old = dict(store.files)
        store.files["phone-queue/2026-10-02/mary__2026-10-02.jpg"] = b"new phone"
        result = rotate_current(store, "2026-10-02")
        self.assertFalse(result["rotated"])
        self.assertEqual({k: v for k, v in store.files.items() if "current/" in k}, {k: v for k, v in old.items() if "current/" in k})

    def test_new_rotation_archives_old_pair_then_cleans_current_and_queue(self):
        store = MemoryStore()
        add_pair(store, "2026-10-01")
        rotate_current(store, "2026-10-01")
        add_pair(store, "2026-10-02", b"new phone", b"new watch")
        result = rotate_current(store, "2026-10-02")
        self.assertTrue(result["rotated"])
        self.assertEqual(store.json[".devotional_wallpapers/manifests/rotation-state.json"]["current_date"], "2026-10-02")
        self.assertEqual(store.files[".devotional_wallpapers/archive/2026-10-01/phone/holy-eucharist__2026-10-01.jpg"], b"phone")
        self.assertIn("phone-current/holy-eucharist__2026-10-02.jpg", store.files)
        self.assertNotIn("phone-queue/2026-10-02/holy-eucharist__2026-10-02.jpg", store.files)

    def test_missing_previous_current_uses_checksum_verified_archive(self):
        store = self._seed_wenceslaus_transition()
        date = "2026-09-28"
        filename = f"saint-wenceslaus__{date}.jpg"
        watch = f"watch-current/{filename}"
        archive = f".devotional_wallpapers/archive/{date}/watch/{filename}"
        store.files[archive] = store.files.pop(watch)

        result = rotate_current(store, "2026-09-29")

        self.assertTrue(result["rotated"])
        self.assertEqual(result["current_date"], "2026-09-29")
        self.assertEqual(result["missing_previous_files"], [])
        self.assertIn(archive, store.files)
        self.assertIn("watch-current/saint-wenceslaus__2026-09-29.jpg", store.files)

    def test_missing_previous_current_and_archive_do_not_block_due_pair(self):
        store = self._seed_wenceslaus_transition()
        date = "2026-09-28"
        filename = f"saint-wenceslaus__{date}.jpg"
        store.files.pop(f"watch-current/{filename}")

        result = rotate_current(store, "2026-09-29")

        self.assertTrue(result["rotated"])
        self.assertEqual(result["current_date"], "2026-09-29")
        self.assertEqual(result["missing_previous_files"], [f"watch-current/{filename}"])
        self.assertIn(f".devotional_wallpapers/archive/{date}/phone/{filename}", store.files)
        self.assertNotIn(f".devotional_wallpapers/archive/{date}/watch/{filename}", store.files)
        self.assertIn("watch-current/saint-wenceslaus__2026-09-29.jpg", store.files)

    def test_missing_previous_watch_waits_for_today_watch_then_promotes_matched_set(self):
        store = self._seed_wenceslaus_transition()
        old_filename = "saint-wenceslaus__2026-09-28.jpg"
        today_filename = "saint-wenceslaus__2026-09-29.jpg"
        store.files.pop(f"watch-current/{old_filename}")
        store.files.pop(f"watch-queue/2026-09-29/{today_filename}")

        before_watch_is_ready = rotate_current(store, "2026-09-29")

        self.assertFalse(before_watch_is_ready["rotated"])
        self.assertEqual(before_watch_is_ready["reason"], "today_subject_sets_incomplete")
        self.assertEqual(store.json[".devotional_wallpapers/manifests/rotation-state.json"]["current_date"], "2026-09-28")
        self.assertIn(f"phone-queue/2026-09-29/{today_filename}", store.files)

        store.files[f"watch-queue/2026-09-29/{today_filename}"] = b"watch image created for missing slot"
        after_watch_is_ready = rotate_current(store, "2026-09-29")

        self.assertTrue(after_watch_is_ready["rotated"])
        self.assertEqual(after_watch_is_ready["current_date"], "2026-09-29")
        self.assertIn(f"phone-current/{today_filename}", store.files)
        self.assertIn(f"watch-current/{today_filename}", store.files)

    def test_missing_previous_current_with_conflicting_archive_still_fails_safely(self):
        store = self._seed_wenceslaus_transition()
        date = "2026-09-28"
        filename = f"saint-wenceslaus__{date}.jpg"
        store.files.pop(f"watch-current/{filename}")
        store.files[f".devotional_wallpapers/archive/{date}/watch/{filename}"] = b"wrong bytes"
        before = dict(store.files)

        with self.assertRaisesRegex(RuntimeError, "archive conflicts with managed record"):
            rotate_current(store, "2026-09-29")

        self.assertEqual(store.files, before)

    def test_missing_current_fallback_does_not_swallow_storage_errors(self):
        store = self._seed_wenceslaus_transition()
        original_download = store.download_bytes

        def download(path):
            if path == "watch-current/saint-wenceslaus__2026-09-28.jpg":
                raise RuntimeError("rclone copyto failed: network timeout")
            return original_download(path)

        store.download_bytes = download
        with self.assertRaisesRegex(RuntimeError, "network timeout"):
            rotate_current(store, "2026-09-29")

    def test_unknown_current_file_blocks_without_deletion(self):
        store = MemoryStore()
        store.files["phone-current/handmade__2026-09-01.jpg"] = b"untouched"
        add_pair(store, "2026-10-01")
        with self.assertRaisesRegex(RuntimeError, "Unmanaged"):
            rotate_current(store, "2026-10-01")
        self.assertIn("phone-current/handmade__2026-09-01.jpg", store.files)

    def test_multiple_named_observances_rotate_as_a_matched_set(self):
        store = MemoryStore()
        add_subject_set(store, "2026-10-01", ("saint-wenceslaus", "saint-lawrence-ruiz"))
        result = rotate_current(store, "2026-10-01")
        self.assertTrue(result["rotated"])
        current = {path for path in store.files if path.startswith(("phone-current/", "watch-current/"))}
        self.assertEqual(len(current), 4)
        self.assertTrue(any("saint-wenceslaus" in path for path in current))
        self.assertTrue(any("saint-lawrence-ruiz" in path for path in current))

    def test_same_day_new_subject_preserves_existing_current_subjects(self):
        store = MemoryStore()
        add_pair(store, "2026-10-01")
        rotate_current(store, "2026-10-01")
        for variant in ("phone", "watch"):
            name = f"saint-lawrence-ruiz__2026-10-01.jpg"
            store.files[f"{variant}-queue/2026-10-01/{name}"] = f"new-{variant}".encode()
        result = rotate_current(store, "2026-10-01")
        self.assertTrue(result["rotated"])
        self.assertEqual(len([p for p in store.files if p.startswith("phone-current/")]), 2)
        self.assertEqual(len([p for p in store.files if p.startswith("watch-current/")]), 2)

    def test_same_day_canonical_subject_replaces_and_archives_legacy_suffix(self):
        store = MemoryStore()
        date = "2026-09-28"
        old_phone = b"old wenceslaus phone"
        old_watch = b"old wenceslaus watch"
        for variant, payload in (("phone", old_phone), ("watch", old_watch)):
            store.files[f"{variant}-current/saint-wenceslaus-martyr__{date}.jpg"] = payload
        store.json[".devotional_wallpapers/manifests/rotation-state.json"] = {
            "schema": 1,
            "current_date": date,
            "managed_current": {
                "phone": {"path": f"phone-current/saint-wenceslaus-martyr__{date}.jpg", "filenames": [f"saint-wenceslaus-martyr__{date}.jpg"], "sha256": hashlib.sha256(old_phone).hexdigest()},
                "watch": {"path": f"watch-current/saint-wenceslaus-martyr__{date}.jpg", "filenames": [f"saint-wenceslaus-martyr__{date}.jpg"], "sha256": hashlib.sha256(old_watch).hexdigest()},
            },
            "rotation": None,
        }
        add_subject_set(store, date, ("saint-wenceslaus", "saint-lawrence-ruiz-and-companions"))

        result = rotate_current(store, date)

        self.assertTrue(result["rotated"])
        self.assertEqual(store.files[f".devotional_wallpapers/archive/{date}/phone/saint-wenceslaus-martyr__{date}.jpg"], old_phone)
        self.assertEqual(store.files[f".devotional_wallpapers/archive/{date}/watch/saint-wenceslaus-martyr__{date}.jpg"], old_watch)
        for variant in ("phone", "watch"):
            current = {Path(path).name for path in store.files if path.startswith(f"{variant}-current/")}
            self.assertEqual(current, {f"saint-wenceslaus__{date}.jpg", f"saint-lawrence-ruiz-and-companions__{date}.jpg"})
        self.assertNotIn(f"phone-queue/{date}/saint-wenceslaus__{date}.jpg", store.files)
        self.assertNotIn(f"watch-queue/{date}/saint-wenceslaus__{date}.jpg", store.files)

    def test_incomplete_canonical_replacement_keeps_legacy_pair_current(self):
        store = MemoryStore()
        date = "2026-09-28"
        for variant, payload in (("phone", b"old phone"), ("watch", b"old watch")):
            store.files[f"{variant}-current/saint-wenceslaus-martyr__{date}.jpg"] = payload
        store.json[".devotional_wallpapers/manifests/rotation-state.json"] = {
            "schema": 1,
            "current_date": date,
            "managed_current": {
                variant: {"path": f"{variant}-current/saint-wenceslaus-martyr__{date}.jpg", "filenames": [f"saint-wenceslaus-martyr__{date}.jpg"], "sha256": hashlib.sha256(payload).hexdigest()}
                for variant, payload in (("phone", b"old phone"), ("watch", b"old watch"))
            },
            "rotation": None,
        }
        store.files[f"phone-queue/{date}/saint-wenceslaus__{date}.jpg"] = b"new phone"

        result = rotate_current(store, date)

        self.assertFalse(result["rotated"])
        self.assertEqual(store.files[f"phone-current/saint-wenceslaus-martyr__{date}.jpg"], b"old phone")
        self.assertEqual(store.files[f"watch-current/saint-wenceslaus-martyr__{date}.jpg"], b"old watch")
        self.assertNotIn(f".devotional_wallpapers/archive/{date}/phone/saint-wenceslaus-martyr__{date}.jpg", store.files)
        self.assertIn(f"phone-queue/{date}/saint-wenceslaus__{date}.jpg", store.files)

    def test_recovery_finishes_verified_journal(self):
        store = MemoryStore()
        date = "2026-10-01"
        next_items = {}
        for variant, payload in (("phone", b"p"), ("watch", b"w")):
            source = f"{variant}-queue/{date}/{variant}__{date}.jpg"
            target = f"{variant}-current/{variant}__{date}.jpg"
            store.files[source] = payload
            next_items[variant] = [{"path": target, "queue_path": source, "sha256": hashlib.sha256(payload).hexdigest()}]
        state_path = ".devotional_wallpapers/manifests/rotation-state.json"
        store.json[state_path] = {"rotation": {"schema": 1, "phase": "promoting", "date": date, "previous_managed": {}, "next": next_items}}
        result = recover_rotation(store)
        self.assertTrue(result["recovered"])
        self.assertEqual(store.json[state_path]["current_date"], date)
        self.assertIsNone(store.json[state_path]["rotation"])

    def test_tampered_rotation_manifest_path_is_rejected_before_cleanup(self):
        store = MemoryStore()
        date = "2026-10-01"
        store.files["phone-queue/2026-10-01/phone__2026-10-01.jpg"] = b"p"
        store.files["watch-queue/2026-10-01/watch__2026-10-01.jpg"] = b"w"
        state_path = ".devotional_wallpapers/manifests/rotation-state.json"
        store.json[state_path] = {"rotation": {"schema": 1, "phase": "promoting", "date": date, "previous_managed": {}, "next": {
            "phone": [{"path": "Current Devotion/infographic.jpg", "queue_path": "phone-queue/2026-10-01/phone__2026-10-01.jpg", "sha256": hashlib.sha256(b"p").hexdigest()}],
            "watch": [{"path": "watch-current/watch__2026-10-01.jpg", "queue_path": "watch-queue/2026-10-01/watch__2026-10-01.jpg", "sha256": hashlib.sha256(b"w").hexdigest()}],
        }}}
        with self.assertRaisesRegex(RuntimeError, "out-of-scope"):
            recover_rotation(store)
        self.assertNotIn("Current Devotion/infographic.jpg", store.files)


if __name__ == "__main__":
    unittest.main()
