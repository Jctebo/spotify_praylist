import datetime
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tests.test_helpers import load_module, make_test_mp3_bytes


class TestPublishAudioBranding(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/publish/audio_branding.py")
        self.fragments_mod = load_module("jobs/publish/fragments.py")

    def _config(self, music_path):
        return self.mod.normalize_audio_branding_config(
            {
                "enabled": True,
                "calendar": "general_roman",
                "locale": "en",
                "welcome": {
                    "text": "Welcome to Ora Pro Nobis, where we pray with the Saints.",
                    "tts_text": "Welcome to Oh-rah Pro No-bees, where we pray with the Saints.",
                    "providers": [
                        {
                            "provider": "elevenlabs",
                            "voice_id": "pGAwIQNN9UjOkKxjAyGQ",
                            "model_id": "eleven_multilingual_v2",
                            "format": "mp3",
                            "speed": 1.0,
                        }
                    ],
                },
                "timing": {
                    "intro_lead_in_seconds": 3.5,
                    "welcome_gap_seconds": 0.0,
                    "outro_seconds": 4.0,
                    "outro_fade_seconds": 4.0,
                },
                "levels": {
                    "intro_db": -30,
                    "under_welcome_db": -30,
                    "background_bed_db": -30,
                    "outro_db": -30,
                },
                "seasons": {
                    "easter": str(music_path),
                },
            }
        )

    def test_default_config_maps_all_season_assets_under_publish_audio(self):
        config = self.mod.load_audio_branding_config()

        self.assertTrue(config["enabled"])
        self.assertEqual(
            set(config["seasons"]),
            {"advent", "christmas", "ordinary_time", "lent", "holy_week", "easter"},
        )
        self.assertTrue(all("config/publish/audio/" in path for path in config["seasons"].values()))

    def test_hash_metadata_uses_season_asset_and_welcome_voice(self):
        with tempfile.TemporaryDirectory() as tmpdir, mock.patch.object(
            self.mod,
            "resolve_liturgical_music_season",
            return_value="easter",
        ):
            music_path = Path(tmpdir) / "easter.mp3"
            music_path.write_bytes(make_test_mp3_bytes(duration_seconds=0.4))
            config = self._config(music_path)
            metadata = self.mod.audio_branding_hash_metadata(
                {"episode_id": "episode-1", "published_date": "2026-04-05"},
                {"format": "mp3"},
                config=config,
            )

        self.assertEqual(metadata["status"], "resolved")
        self.assertEqual(metadata["season"], "easter")
        self.assertTrue(metadata["asset"]["exists"])
        self.assertEqual(metadata["config"]["welcome"]["text"], "Welcome to Ora Pro Nobis, where we pray with the Saints.")
        self.assertEqual(metadata["config"]["welcome"]["tts_text"], "Welcome to Oh-rah Pro No-bees, where we pray with the Saints.")
        self.assertEqual(metadata["welcome_tts"]["providers"][0]["voice_id"], "pGAwIQNN9UjOkKxjAyGQ")

    def test_apply_audio_branding_skips_missing_music_asset(self):
        with tempfile.TemporaryDirectory() as tmpdir, mock.patch.object(
            self.mod,
            "resolve_liturgical_music_season",
            return_value="easter",
        ):
            config = self._config(Path(tmpdir) / "missing.mp3")
            raw_audio = make_test_mp3_bytes(duration_seconds=0.2)

            def unexpected_renderer(fragment, audio_config):
                raise AssertionError("welcome should not render when music is missing")

            result = self.mod.apply_audio_branding(
                raw_audio,
                "mp3",
                {"episode_id": "episode-1", "published_date": "2026-04-05"},
                {"format": "mp3"},
                render_tts_fragment=unexpected_renderer,
                cache_root=Path(tmpdir) / ".cache",
                config=config,
            )

        self.assertEqual(result["audio"], raw_audio)
        self.assertEqual(result["metadata"]["status"], "skipped")
        self.assertEqual(result["metadata"]["skip_reason"], "missing_music_asset")

    def test_apply_audio_branding_renders_non_empty_mix(self):
        with tempfile.TemporaryDirectory() as tmpdir, mock.patch.object(
            self.mod,
            "resolve_liturgical_music_season",
            return_value="easter",
        ):
            music_path = Path(tmpdir) / "easter.mp3"
            music_path.write_bytes(make_test_mp3_bytes(duration_seconds=2.0, frequency=330))
            config = self._config(music_path)
            raw_audio = make_test_mp3_bytes(duration_seconds=0.4, frequency=440)
            welcome_audio = make_test_mp3_bytes(duration_seconds=0.2, frequency=660)
            captured = {}

            def renderer(fragment, audio_config):
                captured["fragment"] = dict(fragment)
                welcome_path = Path(tmpdir) / "welcome.mp3"
                welcome_path.write_bytes(welcome_audio)
                return {
                    "audio_path": welcome_path,
                    "fragment_hash": "welcome-hash",
                    "rendered": True,
                    "provider": "elevenlabs",
                    "audio_config": {
                        "provider": "elevenlabs",
                        "voice_id": "pGAwIQNN9UjOkKxjAyGQ",
                        "model_id": "eleven_multilingual_v2",
                        "format": "mp3",
                        "speed": 1.0,
                    },
                }

            result = self.mod.apply_audio_branding(
                raw_audio,
                "mp3",
                {"episode_id": "episode-1", "published_date": "2026-04-05"},
                {"format": "mp3"},
                render_tts_fragment=renderer,
                cache_root=Path(tmpdir) / ".cache",
                config=config,
            )

        self.assertEqual(result["metadata"]["status"], "applied")
        self.assertEqual(result["metadata"]["season"], "easter")
        self.assertGreater(len(result["audio"]), len(raw_audio))
        self.assertEqual(result["metadata"]["welcome"]["provider"], "elevenlabs")
        self.assertEqual(captured["fragment"]["text"], "Welcome to Oh-rah Pro No-bees, where we pray with the Saints.")

    def test_filter_graph_contains_expected_levels_and_fades(self):
        config = self._config("music.mp3")
        graph, duration = self.mod._build_filter_graph(
            spoken_duration=10.0,
            welcome_duration=1.0,
            config=config,
        )

        self.assertGreater(duration, 14.0)
        self.assertIn("afade=t=in", graph)
        self.assertIn("afade=t=out", graph)
        self.assertIn("volume=-30.000dB", graph)
        self.assertNotIn("[intro]", graph)
        self.assertNotIn("[underwelcome]", graph)
        self.assertNotIn("volume=-30.000dB,adelay", graph)
        self.assertIn("[0:a]adelay=4500:all=1[spoken]", graph)
        self.assertIn("amix=inputs=3", graph)

    def test_audio_manifest_hash_changes_with_branding_metadata(self):
        job = {
            "entry_id": "episode",
            "episode_id": "episode-2026-04-05",
            "contract_id": "contract",
            "title": "Episode",
            "description": "Episode",
            "date": "daily",
            "published_date": "2026-04-05",
        }
        fragments = [
            {
                "fragment_key": "block-1/inline",
                "block_path": "block-1/inline",
                "kind": "inline",
                "label": "Fragment",
                "text": "Test text.",
            }
        ]
        base_audio = {"format": "mp3", "model": "gpt-4o-mini-tts", "voice": "alloy", "speed": 1.0}

        first = self.fragments_mod.audio_manifest_hash(
            job,
            fragments,
            {**base_audio, "audio_branding": {"season": "easter", "asset": {"size": 1}}},
        )
        second = self.fragments_mod.audio_manifest_hash(
            job,
            fragments,
            {**base_audio, "audio_branding": {"season": "easter", "asset": {"size": 2}}},
        )

        self.assertNotEqual(first, second)


if __name__ == "__main__":
    unittest.main()
