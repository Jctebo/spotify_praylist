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
                    "episode_title_pattern": "Day {day}: Novena to {saint_name} - {theme}",
                    "episode_description_pattern": "Day {day} of the Novena to {saint_name} for {feast_name}.",
                },
            },
            source_path=contracts_mod.DEFAULT_FEAST_DIR / "most_sacred_heart_of_jesus.json",
        )

    def test_audio_rendering_is_idempotent_and_writes_sidecar(self):
        runtime = self._runtime()
        rendered = engine_mod.render_novena(runtime, generate_text_fn=lambda prompt, context: f"{prompt} ({context['theme']})")

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            job = audio_mod.build_novena_audio_job(runtime, rendered)
            fake_renderer_calls = {"count": 0}

            def fake_renderer(text, audio_config):
                fake_renderer_calls["count"] += 1
                return make_test_mp3_bytes()

            first = audio_mod.render_novena_audio_job(job, renderer=fake_renderer, docs_root=docs_root, cache_root=cache_root)
            second = audio_mod.render_novena_audio_job(job, renderer=fake_renderer, docs_root=docs_root, cache_root=cache_root)
            sidecar = artifact_writer_mod.write_novena_artifact(runtime, rendered, first, docs_root=docs_root)
            payload = json.loads(sidecar.read_text(encoding="utf-8"))

            self.assertTrue(Path(first["audio_path"]).exists())
            self.assertTrue(Path(first["audio_path"]).with_suffix(".json").exists())
            self.assertTrue(first["rendered"])
            self.assertFalse(second["rendered"])
            self.assertEqual(fake_renderer_calls["count"], 2)
            self.assertEqual(payload["id"], "2026-06-03-most_sacred_heart_of_jesus-day-1")
            self.assertEqual(payload["family_id"], "standard_9_day")
            self.assertEqual(payload["audio"]["file"], "2026-06-03-most_sacred_heart_of_jesus-day-1.mp3")
            self.assertEqual(payload["template"]["source"], "template_id:standard-9-day")
            self.assertEqual(payload["content"]["sections"][1]["kind"], "generated")
            self.assertEqual(payload["feast"]["color"], "green")
