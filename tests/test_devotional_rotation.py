import datetime as dt
import hashlib
import unittest

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


class DevotionalRotationTests(unittest.TestCase):
    def test_first_rotation_promotes_both_and_replay_is_noop(self):
        store = MemoryStore()
        add_pair(store, "2026-10-01")
        result = rotate_current(store, "2026-10-01")
        self.assertTrue(result["rotated"])
        self.assertEqual(set(store.files), {"phone-current/holy-eucharist__2026-10-01.jpg", "watch-current/holy-eucharist__2026-10-01.jpg"})
        replay = rotate_current(store, "2026-10-01")
        self.assertFalse(replay["rotated"])

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

    def test_unknown_current_file_blocks_without_deletion(self):
        store = MemoryStore()
        store.files["phone-current/handmade__2026-09-01.jpg"] = b"untouched"
        add_pair(store, "2026-10-01")
        with self.assertRaisesRegex(RuntimeError, "Unmanaged"):
            rotate_current(store, "2026-10-01")
        self.assertIn("phone-current/handmade__2026-09-01.jpg", store.files)

    def test_recovery_finishes_verified_journal(self):
        store = MemoryStore()
        date = "2026-10-01"
        next_items = {}
        for variant, payload in (("phone", b"p"), ("watch", b"w")):
            source = f"{variant}-queue/{date}/{variant}__{date}.jpg"
            target = f"{variant}-current/{variant}__{date}.jpg"
            store.files[source] = payload
            next_items[variant] = {"path": target, "queue_path": source, "sha256": hashlib.sha256(payload).hexdigest()}
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
            "phone": {"path": "Current Devotion/infographic.jpg", "queue_path": "phone-queue/2026-10-01/phone__2026-10-01.jpg", "sha256": hashlib.sha256(b"p").hexdigest()},
            "watch": {"path": "watch-current/watch__2026-10-01.jpg", "queue_path": "watch-queue/2026-10-01/watch__2026-10-01.jpg", "sha256": hashlib.sha256(b"w").hexdigest()},
        }}}
        with self.assertRaisesRegex(RuntimeError, "out-of-scope"):
            recover_rotation(store)
        self.assertNotIn("Current Devotion/infographic.jpg", store.files)


if __name__ == "__main__":
    unittest.main()
