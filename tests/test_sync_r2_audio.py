import tempfile
import unittest
from pathlib import Path

from tests.test_helpers import load_module


class FakeR2Client:
    def __init__(self):
        self.uploads = []

    def upload_file(self, filename, bucket, key, ExtraArgs=None):
        self.uploads.append(
            {
                "filename": filename,
                "bucket": bucket,
                "key": key,
                "extra_args": dict(ExtraArgs or {}),
            }
        )


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
        self.assertEqual(mp3_upload["extra_args"], {"ContentType": "audio/mpeg"})

    def test_required_env_reports_missing_names_without_secret_values(self):
        with self.assertRaisesRegex(RuntimeError, "R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT") as caught:
            self.sync._required_env({"R2_ACCESS_KEY_ID": "visible-access-key"})

        self.assertNotIn("visible-access-key", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
