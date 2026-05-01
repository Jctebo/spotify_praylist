import datetime
import tempfile
import shutil
import unittest
from pathlib import Path

from tests.test_helpers import load_module, make_test_mp3_bytes


class TestPublishAudioFragments(unittest.TestCase):
    def setUp(self):
        self.contracts_mod = load_module("jobs/publish/contracts.py")
        self.audio_mod = load_module("jobs/publish/audio.py")
        self.fragments_mod = load_module("jobs/publish/fragments.py")
        self.contracts_mod.build_daily_intro_text = lambda date_value, **kwargs: (
            "Today the Church celebrates Saint Example. Praise be to God for his mercy. "
            "In today's Gospel, Jesus calls his sheep by name."
        )

    def test_expand_audio_fragments_preserves_order_and_selector_resolution(self):
        contracts = self.contracts_mod.load_publish_contracts()
        jobs = self.contracts_mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 4, 6))
        job = next(item for item in jobs if item["entry_id"] == "morning-prayer")

        fragments = job["audio_fragments"]

        self.assertEqual(len(fragments), 13)
        self.assertEqual(fragments[0]["label"], "Daily Intro")
        self.assertEqual(fragments[1]["label"], "Morning Offering")
        self.assertIn("April", fragments[5]["text"])
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

    def test_render_audio_job_reuses_restored_fragment_and_silence_cache(self):
        mp3_bytes = make_test_mp3_bytes()
        calls = {"count": 0}

        def renderer(text, audio_config):
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

            first = self.audio_mod.render_audio_job(job, renderer=renderer, docs_root=docs_root, cache_root=cache_root)
            self.assertTrue(first["rendered"])
            self.assertEqual(calls["count"], 1)

            silence_path = self.fragments_mod._silence_cache_path(
                cache_root,
                "mp3",
                self.fragments_mod.DEFAULT_FRAGMENT_SILENCE_MS,
            )
            self.assertTrue(silence_path.exists())

            restored_cache_root = Path(tmpdir) / "restored-cache"
            restored_cache_root.mkdir(parents=True, exist_ok=True)
            shutil.copytree(cache_root / "fragments", restored_cache_root / "fragments")
            shutil.copytree(cache_root / "silence", restored_cache_root / "silence")

            def unexpected_renderer(text, audio_config):
                raise AssertionError("renderer should not be called when the fragment cache is restored")

            def unexpected_ffmpeg(*args, **kwargs):
                raise AssertionError("ffmpeg should not run when the silence cache is restored")

            original_run_ffmpeg = self.fragments_mod._run_ffmpeg
            self.fragments_mod._run_ffmpeg = unexpected_ffmpeg
            try:
                second = self.audio_mod.render_audio_job(
                    job,
                    renderer=unexpected_renderer,
                    docs_root=Path(tmpdir) / "docs-restored",
                    cache_root=restored_cache_root,
                )
            finally:
                self.fragments_mod._run_ffmpeg = original_run_ffmpeg

            self.assertTrue(second["rendered"])
            self.assertEqual(calls["count"], 1)
            self.assertTrue((Path(tmpdir) / "docs-restored" / "audio" / "repeat-test.mp3").exists())
            self.assertTrue((restored_cache_root / "silence").exists())
