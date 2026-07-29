import tempfile
import unittest
from io import BytesIO
from pathlib import Path

from tests.test_helpers import load_module


class FakeR2Client:
    def __init__(self):
        self.uploads = []
        self.objects = {}
        self.manifests = {}
        self.fail_key = None
        self.list_pages = None

    def upload_file(self, filename, bucket, key, ExtraArgs=None):
        if key == self.fail_key:
            raise RuntimeError(f"upload failed for {key}")
        self.uploads.append(
            {
                "filename": filename,
                "bucket": bucket,
                "key": key,
                "extra_args": dict(ExtraArgs or {}),
            }
        )
        self.objects[key] = Path(filename).stat().st_size

    def get_object(self, Bucket, Key):
        if Key not in self.manifests:
            error = RuntimeError("missing")
            error.response = {"Error": {"Code": "NoSuchKey"}}
            raise error
        return {"Body": BytesIO(self.manifests[Key])}

    def put_object(self, Bucket, Key, Body, ContentType):
        self.manifests[Key] = bytes(Body)

    def list_objects_v2(self, **kwargs):
        if self.list_pages is not None:
            index = int(kwargs.get("ContinuationToken", "0"))
            page = self.list_pages[index]
            result = {"Contents": page}
            if index + 1 < len(self.list_pages):
                result.update({"IsTruncated": True, "NextContinuationToken": str(index + 1)})
            return result
        prefix = kwargs.get("Prefix", "")
        return {
            "Contents": [
                {"Key": key, "Size": size}
                for key, size in sorted(self.objects.items())
                if key.startswith(prefix)
            ],
            "IsTruncated": False,
        }


class TestSyncR2Audio(unittest.TestCase):
    def setUp(self):
        self.sync = load_module("scripts/sync_r2_audio.py")

    def test_build_upload_plan_recurses_with_content_types(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            audio_dir = Path(tmpdir) / "docs" / "audio"
            nested = audio_dir / "nested"
            nested.mkdir(parents=True)
            (audio_dir / "episode.mp3").write_bytes(b"mp3")
            (audio_dir / "episode.json").write_text("{}", encoding="utf-8")
            (audio_dir / "index.html").write_text("<html></html>", encoding="utf-8")
            (nested / "notes.txt").write_text("notes", encoding="utf-8")

            plan = self.sync.build_upload_plan(audio_dir)

        by_key = {item.key: item.content_type for item in plan}
        self.assertEqual(by_key["episode.mp3"], "audio/mpeg")
        self.assertEqual(by_key["episode.json"], "application/json")
        self.assertEqual(by_key["index.html"], "text/html")
        self.assertEqual(by_key["nested/notes.txt"], "text/plain")

    def test_sync_audio_archive_uploads_to_bucket_root(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            audio_dir = Path(tmpdir) / "docs" / "audio"
            audio_dir.mkdir(parents=True)
            (audio_dir / "episode.mp3").write_bytes(b"mp3")
            (audio_dir / "episode.json").write_text("{}", encoding="utf-8")
            client = FakeR2Client()

            count = self.sync.sync_audio_archive(
                audio_dir=audio_dir,
                bucket="orapronobis-audio",
                client=client,
            )

        self.assertEqual(count, 2)
        self.assertEqual([upload["key"] for upload in client.uploads], ["episode.json", "episode.mp3"])
        self.assertEqual({upload["bucket"] for upload in client.uploads}, {"orapronobis-audio"})
        mp3_upload = next(upload for upload in client.uploads if upload["key"] == "episode.mp3")
        self.assertEqual(mp3_upload["extra_args"]["ContentType"], "audio/mpeg")
        self.assertRegex(mp3_upload["extra_args"]["Metadata"]["sha256"], r"^[0-9a-f]{64}$")

    def test_sync_audio_archive_skips_verified_unchanged_objects(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            audio_dir = Path(tmpdir) / "docs" / "audio"
            audio_dir.mkdir(parents=True)
            (audio_dir / "episode.mp3").write_bytes(b"mp3")
            client = FakeR2Client()

            self.assertEqual(self.sync.sync_audio_archive(audio_dir=audio_dir, bucket="bucket", client=client), 1)
            self.assertEqual(self.sync.sync_audio_archive(audio_dir=audio_dir, bucket="bucket", client=client), 0)

        self.assertEqual(len(client.uploads), 1)

    def test_sync_audio_archive_uploads_same_size_changed_content(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            audio_dir = Path(tmpdir) / "docs" / "audio"
            audio_dir.mkdir(parents=True)
            episode = audio_dir / "episode.mp3"
            episode.write_bytes(b"mp3")
            client = FakeR2Client()
            self.sync.sync_audio_archive(audio_dir=audio_dir, bucket="bucket", client=client)
            episode.write_bytes(b"wav")

            uploaded = self.sync.sync_audio_archive(audio_dir=audio_dir, bucket="bucket", client=client)

        self.assertEqual(uploaded, 1)
        self.assertEqual(len(client.uploads), 2)

    def test_sync_audio_archive_uploads_manifest_key_missing_from_r2(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            audio_dir = Path(tmpdir) / "docs" / "audio"
            audio_dir.mkdir(parents=True)
            (audio_dir / "episode.mp3").write_bytes(b"mp3")
            client = FakeR2Client()
            self.sync.sync_audio_archive(audio_dir=audio_dir, bucket="bucket", client=client)
            client.objects.clear()

            uploaded = self.sync.sync_audio_archive(audio_dir=audio_dir, bucket="bucket", client=client)

        self.assertEqual(uploaded, 1)

    def test_sync_audio_archive_does_not_write_manifest_after_upload_failure(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            audio_dir = Path(tmpdir) / "docs" / "audio"
            audio_dir.mkdir(parents=True)
            (audio_dir / "episode.mp3").write_bytes(b"mp3")
            client = FakeR2Client()
            client.fail_key = "episode.mp3"

            with self.assertRaisesRegex(RuntimeError, "upload failed"):
                self.sync.sync_audio_archive(audio_dir=audio_dir, bucket="bucket", client=client)

        self.assertEqual(client.manifests, {})

    def test_sync_audio_archive_rejects_nonpositive_worker_limit(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            audio_dir = Path(tmpdir) / "docs" / "audio"
            audio_dir.mkdir(parents=True)
            (audio_dir / "episode.mp3").write_bytes(b"mp3")

            with self.assertRaisesRegex(ValueError, "at least 1"):
                self.sync.sync_audio_archive(
                    audio_dir=audio_dir,
                    bucket="bucket",
                    client=FakeR2Client(),
                    max_workers=0,
                )

    def test_list_remote_objects_follows_pagination(self):
        client = FakeR2Client()
        client.list_pages = [
            [{"Key": "one.mp3", "Size": 1}],
            [{"Key": "two.mp3", "Size": 2}],
        ]

        objects = self.sync.list_remote_objects(bucket="bucket", client=client)

        self.assertEqual(objects, {"one.mp3": 1, "two.mp3": 2})

    def test_required_env_reports_missing_names_without_secret_values(self):
        with self.assertRaisesRegex(RuntimeError, "R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT") as caught:
            self.sync._required_env({"R2_ACCESS_KEY_ID": "visible-access-key"})

        self.assertNotIn("visible-access-key", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
