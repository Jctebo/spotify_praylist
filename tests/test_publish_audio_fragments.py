import datetime
import tempfile
import unittest
from pathlib import Path

from tests.test_helpers import load_module, make_test_mp3_bytes


class TestPublishAudioFragments(unittest.TestCase):
    def setUp(self):
        self.contracts_mod = load_module("jobs/publish/contracts.py")
        self.audio_mod = load_module("jobs/publish/audio.py")
        self.fragments_mod = load_module("jobs/publish/fragments.py")

    def test_expand_audio_fragments_preserves_order_and_selector_resolution(self):
        contracts = self.contracts_mod.load_publish_contracts()
        jobs = self.contracts_mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 4, 6))
        job = next(item for item in jobs if item["entry_id"] == "morning-prayer")

        fragments = job["audio_fragments"]

        self.assertEqual(len(fragments), 12)
        self.assertEqual(fragments[0]["label"], "Morning Offering")
        self.assertIn("April", fragments[4]["text"])
        self.assertEqual(fragments[-1]["label"], "Intercessory Litany")
        self.assertTrue(all(fragment["fragment_key"] for fragment in fragments))

    def test_fragment_hash_changes_with_tts_settings(self):
        fragment = {
            "fragment_key": "block-1/sequence-1/file",
            "block_path": "block-1/sequence-1/file",
            "kind": "file",
            "label": "Morning Offering",
            "text": "Test fragment text.",
        }
        base = {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}

        base_hash = self.fragments_mod.fragment_content_hash(fragment, base)
        self.assertNotEqual(base_hash, self.fragments_mod.fragment_content_hash(fragment, {**base, "model": "gpt-4o"}))
        self.assertNotEqual(base_hash, self.fragments_mod.fragment_content_hash(fragment, {**base, "voice": "echo"}))
        self.assertNotEqual(base_hash, self.fragments_mod.fragment_content_hash(fragment, {**base, "format": "wav"}))
        self.assertNotEqual(base_hash, self.fragments_mod.fragment_content_hash(fragment, {**base, "speed": 0.8}))

    def test_render_audio_job_reuses_identical_leaf_text(self):
        mp3_bytes = make_test_mp3_bytes()
        calls = {"count": 0}

        def fake_renderer(text, audio_config):
            calls["count"] += 1
            return mp3_bytes

        job = {
            "entry_id": "repeat-test",
            "contract_id": "test-contract",
            "title": "Repeat Test",
            "date": "daily",
            "text": "Repeat Test",
            "audio_config": {"enabled": True, "model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "audio_fragments": [
                {
                    "fragment_key": "block-1/repeat-1/file",
                    "block_path": "block-1/repeat-1/file",
                    "kind": "file",
                    "label": "Repeated Prayer",
                    "text": "Repeated prayer text.",
                },
                {
                    "fragment_key": "block-1/repeat-2/file",
                    "block_path": "block-1/repeat-2/file",
                    "kind": "file",
                    "label": "Repeated Prayer",
                    "text": "Repeated prayer text.",
                },
                {
                    "fragment_key": "block-1/repeat-3/file",
                    "block_path": "block-1/repeat-3/file",
                    "kind": "file",
                    "label": "Repeated Prayer",
                    "text": "Repeated prayer text.",
                },
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"

            first = self.audio_mod.render_audio_job(job, renderer=fake_renderer, docs_root=docs_root, cache_root=cache_root)
            second = self.audio_mod.render_audio_job(job, renderer=fake_renderer, docs_root=docs_root, cache_root=cache_root)
            self.assertTrue(first["rendered"])
            self.assertFalse(second["rendered"])
            self.assertEqual(calls["count"], 1)
            self.assertTrue(Path(first["audio_path"]).exists())
            self.assertGreater(Path(first["audio_path"]).stat().st_size, 0)
