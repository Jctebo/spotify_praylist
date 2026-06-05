import datetime
import json
import tempfile
import unittest
from pathlib import Path
from enum import Enum

import jobs.novena_contracts.audio as audio_mod
import jobs.novena_contracts.artifact_writer as artifact_writer_mod
import jobs.novena_contracts.contracts as contracts_mod
import jobs.novena_contracts.engine as engine_mod
from jobs.publish.audio import load_published_audio_jobs
from tests.test_helpers import make_test_mp3_bytes


class TestNovenaArtifacts(unittest.TestCase):
    class DummyColor(Enum):
        GREEN = "green"

    def _runtime(self):
        return contracts_mod.NovenaRuntime(
            family_id="standard_9_day",
            contract_id="most_sacred_heart_of_jesus",
            saint={"id": "most_sacred_heart_of_jesus", "name": "The Most Sacred Heart of Jesus"},
            feast={
                "month": 6,
                "day": 12,
                "name": "The Most Sacred Heart of Jesus",
                "color": self.DummyColor.GREEN,
                "feast_date": "2026-06-12",
                "start_date": "2026-06-03",
                "end_date": "2026-06-11",
            },
            novena={"duration_days": 9, "start_offset_days": -9, "content_mode": "hybrid", "ai_config": {"themes": ["trust"]}},
            resolved_template=contracts_mod.TemplateSpec(
                template_id="standard-9-day",
                source="template_id:standard-9-day",
                sections=(
                    contracts_mod.TemplateSection(
                        key="opening",
                        title="Opening Prayer",
                        kind="fixed",
                        text="Pray with {saint_name}.",
                    ),
                    contracts_mod.TemplateSection(
                        key="petition",
                        title="Daily Petition",
                        kind="generated",
                        prompt="Day {day} petition for {theme}.",
                    ),
                ),
            ),
            date=datetime.date(2026, 6, 3),
            active_day=1,
            publishing={
                "audio": {"enabled": True, "model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
                "rss": {
                    "enabled": True,
                    "feed_id": "ora-pro-nobis",
                    "episode_title_pattern": "Short-Form Novena to {saint_name} Day {day} - {date_display}",
                    "episode_description_pattern": "Day {day} of the Novena to {saint_name} for {feast_name}.",
                },
            },
            source_path=contracts_mod.DEFAULT_FEAST_DIR / "most_sacred_heart_of_jesus.json",
        )

    def test_audio_rendering_is_idempotent_and_writes_sidecar(self):
        runtime = self._runtime()
        rendered = engine_mod.render_novena(runtime, generate_text_fn=lambda prompt, context: f"{prompt} ({context['theme']})")
        rendered["title"] = "Short-Form Novena to The Most Sacred Heart of Jesus Day 1 - June 3, 2026"
        rendered["description"] = rendered["title"]

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            job = audio_mod.build_novena_audio_job(runtime, rendered)
            fake_renderer_calls = {"count": 0}

            def fake_renderer(text, audio_config):
                fake_renderer_calls["count"] += 1
                return make_test_mp3_bytes()

            first = audio_mod.render_novena_audio_job(
                job,
                renderer=fake_renderer,
                docs_root=docs_root,
                cache_root=cache_root,
                write_sidecar=False,
            )
            second = audio_mod.render_novena_audio_job(
                job,
                renderer=fake_renderer,
                docs_root=docs_root,
                cache_root=cache_root,
                write_sidecar=False,
            )
            sidecar = artifact_writer_mod.write_novena_artifact(runtime, rendered, first, docs_root=docs_root)
            payload = json.loads(sidecar.read_text(encoding="utf-8"))

            self.assertTrue(Path(first["audio_path"]).exists())
            self.assertTrue(Path(first["audio_path"]).with_suffix(".json").exists())
            self.assertTrue(first["loudness_normalization"]["enabled"])
            self.assertEqual(first["loudness_normalization"]["integrated_lufs"], -16.0)
        self.assertTrue(first["rendered"])
        self.assertFalse(second["rendered"])
        self.assertEqual(fake_renderer_calls["count"], 2)
        self.assertTrue(job["audio_config"]["loudness_normalization"]["enabled"])
        self.assertEqual(payload["id"], "2026-06-03-most_sacred_heart_of_jesus-day-1")
        self.assertEqual(payload["family_id"], "standard_9_day")
        self.assertEqual(payload["audio"]["file"], "2026-06-03-most_sacred_heart_of_jesus-day-1.mp3")
        self.assertEqual(payload["template"]["source"], "template_id:standard-9-day")
        self.assertEqual(payload["content"]["sections"][1]["kind"], "generated")
        self.assertEqual(payload["feast"]["color"], "green")
        self.assertIn("June 3, 2026", payload["title"])

    def test_novena_audio_loudness_normalization_can_be_overridden(self):
        runtime = self._runtime()
        publishing = dict(runtime.publishing)
        publishing["audio"] = {
            "enabled": True,
            "model": "gpt-4o-mini-tts",
            "voice": "alloy",
            "format": "mp3",
            "speed": 1.0,
            "loudness_normalization": {
                "enabled": True,
                "integrated_lufs": -18,
                "true_peak_db": -2,
                "lra": 9,
            },
        }
        runtime = contracts_mod.NovenaRuntime(
            family_id=runtime.family_id,
            contract_id=runtime.contract_id,
            saint=runtime.saint,
            feast=runtime.feast,
            novena=runtime.novena,
            resolved_template=runtime.resolved_template,
            date=runtime.date,
            active_day=runtime.active_day,
            publishing=publishing,
            source_path=runtime.source_path,
        )
        rendered = engine_mod.render_novena(runtime, generate_text_fn=lambda prompt, context: f"{prompt} ({context['theme']})")

        job = audio_mod.build_novena_audio_job(runtime, rendered)

        settings = job["audio_config"]["loudness_normalization"]
        self.assertTrue(settings["enabled"])
        self.assertEqual(settings["integrated_lufs"], -18.0)
        self.assertEqual(settings["true_peak_db"], -2.0)
        self.assertEqual(settings["lra"], 9.0)

    def test_novena_audio_falls_back_to_openai_after_elevenlabs_failure(self):
        runtime = self._runtime()
        publishing = dict(runtime.publishing)
        publishing["audio"] = {
            "enabled": True,
            "model": "gpt-4o-mini-tts",
            "voice": "alloy",
            "format": "mp3",
            "speed": 1.0,
            "providers": [
                {
                    "provider": "elevenlabs",
                    "api_key_env": "ELEVENLABS_API_KEY",
                    "voice_id": "pGAwIQNN9UjOkKxjAyGQ",
                    "model_id": "eleven_multilingual_v2",
                    "format": "mp3",
                    "speed": 1.0,
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
        }
        runtime = contracts_mod.NovenaRuntime(
            family_id=runtime.family_id,
            contract_id=runtime.contract_id,
            saint=runtime.saint,
            feast=runtime.feast,
            novena=runtime.novena,
            resolved_template=runtime.resolved_template,
            date=runtime.date,
            active_day=runtime.active_day,
            publishing=publishing,
            source_path=runtime.source_path,
        )
        rendered = engine_mod.render_novena(runtime, generate_text_fn=lambda prompt, context: f"{prompt} ({context['theme']})")
        job = audio_mod.build_novena_audio_job(runtime, rendered)
        calls = []

        def fake_renderer(text, audio_config):
            calls.append(dict(audio_config))
            if audio_config.get("provider") == "elevenlabs":
                raise RuntimeError("ElevenLabs unavailable")
            return make_test_mp3_bytes()

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            result = audio_mod.render_novena_audio_job(
                job,
                renderer=fake_renderer,
                docs_root=docs_root,
                cache_root=cache_root,
                write_sidecar=True,
            )
            payload = json.loads(Path(result["audio_path"]).with_suffix(".json").read_text(encoding="utf-8"))

        self.assertTrue(result["rendered"])
        self.assertGreaterEqual(len(calls), 2)
        self.assertEqual(calls[0]["provider"], "elevenlabs")
        self.assertEqual(calls[-1]["provider"], "openai")
        self.assertEqual(payload["fragments"][0]["provider"], "openai")
        self.assertEqual(payload["fragments"][0]["tts"]["provider"], "openai")

    def test_placeholder_sidecar_is_skipped_from_published_audio_jobs(self):
        runtime = self._runtime()
        rendered = engine_mod.render_novena(runtime, generate_text_fn=lambda prompt, context: f"{prompt} ({context['theme']})")
        rendered["title"] = "Short-Form Novena to The Most Sacred Heart of Jesus Day 1 - June 3, 2026"
        rendered["description"] = rendered["title"]

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            docs_root.mkdir(parents=True, exist_ok=True)
            sidecar = artifact_writer_mod.write_novena_artifact(
                runtime,
                rendered,
                {
                    "episode_id": "2026-06-03-most_sacred_heart_of_jesus-day-1",
                    "entry_id": "2026-06-03-most_sacred_heart_of_jesus-day-1",
                    "audio_path": str(docs_root / "audio" / "2026-06-03-most_sacred_heart_of_jesus-day-1.mp3"),
                    "audio_url": "https://example.com/audio/2026-06-03-most_sacred_heart_of_jesus-day-1.mp3",
                    "audio_config": dict(runtime.publishing.get("audio") or {}),
                    "content_hash": "placeholder-hash",
                    "rendered": False,
                },
                docs_root=docs_root,
            )

            jobs = load_published_audio_jobs(docs_root=docs_root)
            self.assertTrue(sidecar.exists())
            self.assertEqual(jobs, [])
