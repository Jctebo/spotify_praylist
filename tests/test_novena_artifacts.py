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

    def setUp(self):
        self._intro_builder = engine_mod.build_devotional_intro

        def fake_intro(profile, context, **kwargs):
            saint_name = str(context.get("saint_name", "the saint")).strip()
            day = str(context.get("day", "1")).strip()
            theme = str(context.get("daily_theme_title", "") or context.get("theme", "Trust")).strip()
            return engine_mod.DevotionalIntroResult(
                text=f"Welcome to Day {day} of the Novena to {saint_name}, joining today's focus of {theme} to our prayer.",
                profile="novena",
                policy_version="devotional-intro-v1",
                source="openai",
            )

        engine_mod.build_devotional_intro = fake_intro

    def tearDown(self):
        engine_mod.build_devotional_intro = self._intro_builder

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
                "audio": {"enabled": True, "model": "gpt-4o-mini-tts", "voice": "ash", "format": "mp3", "speed": 1.0},
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
            self.assertEqual(first["audio_branding"]["status"], "applied")
            self.assertEqual(first["audio_branding"]["season"], "ordinary_time")
        self.assertTrue(first["rendered"])
        self.assertFalse(second["rendered"])
        self.assertEqual(fake_renderer_calls["count"], 4)
        self.assertTrue(job["audio_config"]["loudness_normalization"]["enabled"])
        self.assertEqual(payload["id"], "2026-06-03-most_sacred_heart_of_jesus-day-1")
        self.assertEqual(payload["audio_branding"]["status"], "applied")
        self.assertEqual(payload["audio"]["audio_branding"]["season"], "ordinary_time")
        self.assertEqual(payload["family_id"], "standard_9_day")
        self.assertEqual(payload["audio"]["file"], "2026-06-03-most_sacred_heart_of_jesus-day-1.mp3")
        self.assertEqual(payload["template"]["source"], "template_id:standard-9-day")
        self.assertEqual(payload["content"]["sections"][1]["kind"], "generated")
        self.assertEqual(payload["feast"]["color"], "green")
        self.assertEqual(payload["devotional_intro"]["policy_version"], "devotional-intro-v1")
        self.assertEqual(payload["context"]["devotional_intro"], payload["devotional_intro"])
        self.assertIn("June 3, 2026", payload["title"])

    def test_audio_rendering_generates_control_fragments_without_tts(self):
        runtime = self._runtime()
        rendered = engine_mod.render_novena(
            runtime,
            generate_text_fn=lambda prompt, context: f"{prompt} ({context['theme']})",
        )
        rendered["audio_fragments"] = [
            {"kind": "text", "fragment_key": "before", "label": "Before", "text": "Name your intention."},
            {"kind": "audio_cue", "fragment_key": "bell", "label": "Sacred Bell", "text": "", "cue": "sacred_bell"},
            {
                "kind": "pause",
                "fragment_key": "intention",
                "label": "Personal Intention",
                "text": "",
                "duration_ms": 500,
                "purpose": "personal_intention",
            },
            {"kind": "text", "fragment_key": "after", "label": "After", "text": "Let us continue."},
        ]
        rendered["content"]["text"] = "Name your intention.\n\nLet us continue."
        job = audio_mod.build_novena_audio_job(runtime, rendered)
        tts_inputs = []

        def fake_renderer(text, audio_config):
            tts_inputs.append(text)
            return make_test_mp3_bytes()

        with tempfile.TemporaryDirectory() as tmpdir:
            result = audio_mod.render_novena_audio_job(
                job,
                renderer=fake_renderer,
                docs_root=Path(tmpdir) / "docs",
                cache_root=Path(tmpdir) / ".cache",
                write_sidecar=True,
            )
            payload = json.loads(Path(result["audio_path"]).with_suffix(".json").read_text(encoding="utf-8"))

        fragment_results = payload["fragments"]
        self.assertEqual([item["kind"] for item in fragment_results], ["text", "audio_cue", "pause", "text"])
        self.assertEqual(fragment_results[1]["source"], "generated")
        self.assertEqual(fragment_results[1]["cue"], "sacred_bell")
        self.assertEqual(fragment_results[2]["duration_ms"], 500)
        self.assertEqual(fragment_results[2]["purpose"], "personal_intention")
        self.assertNotIn("", tts_inputs)
        self.assertNotIn("Sacred Bell", tts_inputs)
        self.assertNotIn("Personal Intention", tts_inputs)

    def test_artifact_writer_persists_top_level_daily_liturgical_context(self):
        runtime = self._runtime()
        rendered = engine_mod.render_novena(
            runtime,
            daily_theme_context={
                "daily_liturgical_context": {
                    "date": "2026-06-03",
                    "sharedThemeTitle": "Humility And Trust",
                    "sharedThemeVersion": "daily-theme-v1",
                    "sharedGospelBridge": "today's Gospel, Matthew 5:43-48, draws us into humility",
                    "gospelCitation": "Matthew 5:43-48",
                    "fallbackReason": "",
                    "sharedThemeSources": [{"kind": "gospel", "label": "Matthew 5:43-48", "theme": "humility"}],
                },
                "daily_theme_title": "Humility And Trust",
                "daily_theme_slug": "humility-and-trust",
                "daily_theme_explanation": "Today's focus is humility and trust.",
                "daily_theme_transition": "Carrying today's focus of humility and trust, we enter this novena.",
                "daily_theme_reflection_focus": "Today's focus is humility and trust.",
                "daily_gospel_bridge": "today's Gospel, Matthew 5:43-48, draws us into humility",
                "daily_theme_sources": [{"kind": "gospel", "label": "Matthew 5:43-48", "theme": "humility"}],
                "daily_theme_version": "daily-theme-v1",
            },
            generate_text_fn=lambda prompt, context: f"{prompt} ({context['theme']})",
        )
        rendered["title"] = "Short-Form Novena to The Most Sacred Heart of Jesus Day 1 - June 3, 2026"
        rendered["description"] = rendered["title"]

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            sidecar = artifact_writer_mod.write_novena_artifact(
                runtime,
                rendered,
                {
                    "audio_path": str(docs_root / "audio" / "2026-06-03-most_sacred_heart_of_jesus-day-1.mp3"),
                    "audio_url": "https://example.test/audio/2026-06-03-most_sacred_heart_of_jesus-day-1.mp3",
                    "rendered": True,
                    "content_hash": "hash-a",
                },
                docs_root=docs_root,
            )
            payload = json.loads(sidecar.read_text(encoding="utf-8"))

        self.assertEqual(payload["daily_liturgical_context"]["sharedThemeTitle"], "Humility And Trust")
        self.assertEqual(payload["daily_liturgical_context"]["sharedGospelBridge"], "today's Gospel, Matthew 5:43-48, draws us into humility")
        self.assertEqual(payload["daily_liturgical_context"]["gospelCitation"], "Matthew 5:43-48")
        self.assertEqual(payload["context"]["daily_theme_title"], "Humility And Trust")
        self.assertEqual(payload["context"]["novena_theme_title"], "Trust")
        self.assertEqual(payload["devotional_intro"]["profile"], "novena")

    def test_novena_audio_loudness_normalization_can_be_overridden(self):
        runtime = self._runtime()
        publishing = dict(runtime.publishing)
        publishing["audio"] = {
            "enabled": True,
            "model": "gpt-4o-mini-tts",
            "voice": "ash",
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
            "voice": "ash",
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
                    "voice": "ash",
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
        self.assertTrue(any(call.get("provider") == "openai" for call in calls))
        self.assertEqual(payload["fragments"][0]["provider"], "openai")
        self.assertEqual(payload["fragments"][0]["tts"]["provider"], "openai")
        self.assertEqual(payload["audio_branding"]["status"], "skipped")
        self.assertIn("branding_failed", payload["audio_branding"]["skip_reason"])

    def test_existing_novena_sidecar_is_refreshed_when_branding_changes_hash(self):
        runtime = self._runtime()
        rendered = engine_mod.render_novena(runtime, generate_text_fn=lambda prompt, context: f"{prompt} ({context['theme']})")
        rendered["title"] = "Short-Form Novena to The Most Sacred Heart of Jesus Day 1 - June 3, 2026"
        rendered["description"] = rendered["title"]

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            job = audio_mod.build_novena_audio_job(runtime, rendered)
            sidecar_path = docs_root / "audio" / "2026-06-03-most_sacred_heart_of_jesus-day-1.json"
            audio_path = sidecar_path.with_suffix(".mp3")
            sidecar_path.parent.mkdir(parents=True, exist_ok=True)
            audio_path.write_bytes(make_test_mp3_bytes())
            sidecar_path.write_text(
                json.dumps(
                    {
                        "episode_id": job["episode_id"],
                        "content_hash": "legacy-unbranded-hash",
                        "audio": {"content_hash": "legacy-unbranded-hash"},
                    }
                ),
                encoding="utf-8",
            )

            def fake_renderer(text, audio_config):
                return make_test_mp3_bytes()

            audio_result = audio_mod.render_novena_audio_job(
                job,
                renderer=fake_renderer,
                docs_root=docs_root,
                cache_root=cache_root,
                write_sidecar=False,
            )
            artifact_writer_mod.write_novena_artifact(runtime, rendered, audio_result, docs_root=docs_root)
            payload = json.loads(sidecar_path.read_text(encoding="utf-8"))

        self.assertTrue(audio_result["rendered"])
        self.assertNotEqual(audio_result["content_hash"], "legacy-unbranded-hash")
        self.assertEqual(payload["content_hash"], audio_result["content_hash"])
        self.assertEqual(payload["audio_branding"]["status"], "applied")

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
