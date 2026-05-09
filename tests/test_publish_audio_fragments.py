import datetime
import tempfile
import shutil
import unittest
from pathlib import Path
from unittest import mock

from tests.test_helpers import load_module, make_test_mp3_bytes, temp_env


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
        job = next(item for item in jobs if item["entry_id"] == "morning-prayer-elevenlabs")

        fragments = job["audio_fragments"]

        self.assertEqual(len(fragments), 12)
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
        self.assertNotEqual(
            base_hash,
            self.fragments_mod.fragment_content_hash(
                fragment,
                {
                    **base,
                    "provider": "elevenlabs",
                    "voice_id": "voice-123",
                    "model_id": "eleven_multilingual_v2",
                },
            ),
        )
        self.assertNotEqual(
            base_hash,
            self.fragments_mod.fragment_content_hash(
                fragment,
                {
                    **base,
                    "provider": "elevenlabs",
                    "voice_id": "voice-123",
                    "model_id": "eleven_multilingual_v2",
                    "voice_settings": {"stability": 0.7, "speed": 1.1},
                },
            ),
        )

    def test_elevenlabs_renderer_posts_to_voice_endpoint(self):
        response = mock.Mock()
        response.content = make_test_mp3_bytes()
        response.raise_for_status.return_value = None

        with temp_env({"ELEVENLABS_API_KEY": "test-elevenlabs-key"}), mock.patch.object(
            self.audio_mod.requests, "post", return_value=response
        ) as post:
            raw = self.audio_mod.elevenlabs_tts_renderer(
                "Hello from ElevenLabs",
                {
                    "api_key_env": "ELEVENLABS_API_KEY",
                    "voice_id": "voice-123",
                    "model_id": "eleven_multilingual_v2",
                    "format": "mp3",
                    "voice_settings": {"stability": 0.7, "speed": 1.1},
                },
            )

        self.assertGreater(len(raw), 0)
        post.assert_called_once()
        args, kwargs = post.call_args
        self.assertEqual(args[0], "https://api.elevenlabs.io/v1/text-to-speech/voice-123")
        self.assertEqual(kwargs["params"], {"output_format": "mp3_44100_128"})
        self.assertEqual(kwargs["headers"]["xi-api-key"], "test-elevenlabs-key")
        self.assertEqual(kwargs["json"]["text"], "Hello from ElevenLabs")
        self.assertEqual(kwargs["json"]["model_id"], "eleven_multilingual_v2")
        self.assertEqual(kwargs["json"]["voice_settings"]["stability"], 0.7)
        self.assertEqual(kwargs["json"]["voice_settings"]["speed"], 1.1)
        self.assertEqual(kwargs["timeout"], 120)

    def test_render_audio_job_falls_back_to_next_provider(self):
        mp3_bytes = make_test_mp3_bytes()
        calls = []

        def fake_renderer(text, audio_config):
            calls.append(dict(audio_config))
            if audio_config.get("provider") == "elevenlabs":
                raise RuntimeError("ElevenLabs is unavailable")
            return mp3_bytes

        job = {
            "entry_id": "fallback-test",
            "contract_id": "test-contract",
            "title": "Fallback Test",
            "date": "daily",
            "text": "Fallback Test",
            "audio_config": {
                "enabled": True,
                "format": "mp3",
                "speed": 1.0,
                "providers": [
                    {
                        "provider": "elevenlabs",
                        "api_key_env": "ELEVENLABS_API_KEY",
                        "voice_id": "voice-123",
                        "model_id": "eleven_multilingual_v2",
                    },
                    {
                        "provider": "openai",
                        "api_key_env": "OPENAI_API_KEY",
                        "model": "gpt-4o-mini-tts",
                        "voice": "alloy",
                        "format": "mp3",
                        "speed": 1.0,
                    },
                ],
            },
            "audio_fragments": [
                {
                    "fragment_key": "block-1/file",
                    "block_path": "block-1/file",
                    "kind": "file",
                    "label": "Fallback Fragment",
                    "text": "Fallback fragment text.",
                }
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            rendered = self.audio_mod.render_audio_job(job, renderer=fake_renderer, docs_root=docs_root, cache_root=cache_root)
            rendered_path = Path(rendered["audio_path"])
            self.assertTrue(rendered_path.exists())

        self.assertTrue(rendered["rendered"])
        self.assertEqual(rendered["provider"], "openai")
        self.assertEqual(rendered["audio_config"]["provider"], "openai")
        self.assertGreaterEqual(len(calls), 2)
        self.assertEqual(calls[0]["provider"], "elevenlabs")
        self.assertEqual(calls[-1]["provider"], "openai")

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
