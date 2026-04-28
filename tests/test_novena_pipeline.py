import datetime
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

import jobs.novena_contracts.pipeline as pipeline_mod
from jobs.publish.audio import load_published_audio_jobs
from jobs.publish.rss import build_rss_feed, write_podcast_feed
from tests.test_helpers import make_test_mp3_bytes


class TestNovenaPipeline(unittest.TestCase):
    def _write_contracts(self, root: Path, *, include_selector_family: bool = False) -> Path:
        contracts_root = root / "contracts" / "novenas"
        template_dir = contracts_root / "templates"
        feast_dir = contracts_root / "feast-days"
        family_dir = contracts_root / "families"
        template_dir.mkdir(parents=True, exist_ok=True)
        feast_dir.mkdir(parents=True, exist_ok=True)
        family_dir.mkdir(parents=True, exist_ok=True)
        (template_dir / "standard-9-day.json").write_text(
            json.dumps(
                {
                    "template_id": "standard-9-day",
                    "sections": [
                        {"key": "opening", "title": "Opening Prayer", "kind": "fixed", "text": "Pray with {saint_name}."},
                        {"key": "petition", "title": "Daily Petition", "kind": "generated", "prompt": "Day {day} petition for {theme}."},
                        {"key": "closing", "title": "Closing Prayer", "kind": "fixed", "text": "Amen."},
                    ],
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        if include_selector_family:
            (family_dir / "standard-9-day.json").write_text(
                json.dumps(
                    {
                        "contract": {
                            "id": "standard_9_day",
                            "type": "novena_feast_rule",
                            "selector": {
                                "mode": "auto",
                                "ranks": ["solemnity", "feast", "memorial", "optional_memorial"],
                            },
                            "novena": {
                                "duration_days": 9,
                                "start_offset_days": -9,
                                "content_mode": "hybrid",
                                "template_id": "standard-9-day",
                                "ai_config": {"themes": ["trust in the Sacred Heart"]},
                            },
                            "publishing": {
                                "audio": {"enabled": True, "model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
                                "rss": {
                                    "enabled": True,
                                    "feed_id": "ora-pro-nobis",
                                    "episode_title_pattern": "Day {day}: Novena to {saint_name} - {theme}",
                                    "episode_description_pattern": "Day {day} of the Novena to {saint_name} for {feast_name}.",
                                },
                            },
                        }
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
        (feast_dir / "most_sacred_heart_of_jesus.json").write_text(
            json.dumps(
                {
                    "contract": {
                        "id": "most_sacred_heart_of_jesus",
                        "type": "novena_feast_rule",
                        "saint": {"id": "most_sacred_heart_of_jesus", "name": "The Most Sacred Heart of Jesus"},
                        "feast": {"month": 6, "day": 12, "name": "The Most Sacred Heart of Jesus"},
                        "novena": {
                            "duration_days": 9,
                            "start_offset_days": -9,
                            "content_mode": "hybrid",
                            "template_id": "standard-9-day",
                            "ai_config": {"themes": ["trust in the Sacred Heart"]},
                        },
                        "publishing": {
                            "audio": {"enabled": True, "model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
                            "rss": {
                                "enabled": True,
                                "feed_id": "ora-pro-nobis",
                                "episode_title_pattern": "Day {day}: Novena to {saint_name} - {theme}",
                                "episode_description_pattern": "Day {day} of the Novena to {saint_name} for {feast_name}.",
                            },
                        },
                    }
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        return contracts_root

    def test_pipeline_renders_audio_writes_sidecar_and_rebuilds_feed(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contracts_root = self._write_contracts(root)
            docs_root = root / "docs"
            cache_root = root / ".cache"
            renderer_calls = {"count": 0}

            def fake_renderer(text, audio_config):
                renderer_calls["count"] += 1
                return make_test_mp3_bytes()

            def fake_generate_text(prompt, context):
                return f"generated::{prompt}"

            first = pipeline_mod.run_novena_pipeline(
                contract_dir=contracts_root,
                docs_root=docs_root,
                cache_root=cache_root,
                today=datetime.date(2026, 6, 3),
                renderer=fake_renderer,
                generate_text_fn=fake_generate_text,
            )
            second = pipeline_mod.run_novena_pipeline(
                contract_dir=contracts_root,
                docs_root=docs_root,
                cache_root=cache_root,
                today=datetime.date(2026, 6, 3),
                renderer=fake_renderer,
                generate_text_fn=fake_generate_text,
            )

            jobs = load_published_audio_jobs(docs_root=docs_root)
            feed_root = ET.fromstring((docs_root / "podcast.xml").read_text(encoding="utf-8"))
            self.assertEqual(first["active"], 1)
            self.assertEqual(second["active"], 1)
            self.assertEqual(first["rendered"], 1)
            self.assertEqual(second["rendered"], 1)
            self.assertEqual(renderer_calls["count"], 3)
            self.assertEqual(len(jobs), 1)
            self.assertTrue((docs_root / "audio" / "2026-06-03-most_sacred_heart_of_jesus-day-1.mp3").exists())
            self.assertTrue((docs_root / "audio" / "2026-06-03-most_sacred_heart_of_jesus-day-1.json").exists())
            self.assertEqual(feed_root.findtext("./channel/item/guid"), "2026-06-03-most_sacred_heart_of_jesus-day-1")
            self.assertEqual(feed_root.findtext("./channel/item/title"), "Day 1: Novena to The Most Sacred Heart of Jesus - trust in the Sacred Heart")

    def test_pipeline_preserves_existing_feed_items_when_rebuilding(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contracts_root = self._write_contracts(root)
            docs_root = root / "docs"
            cache_root = root / ".cache"
            docs_root.mkdir(parents=True, exist_ok=True)
            audio_dir = docs_root / "audio"
            audio_dir.mkdir(parents=True, exist_ok=True)
            existing_audio = audio_dir / "morning-prayer-2026-04-06.mp3"
            existing_audio.write_bytes(make_test_mp3_bytes())
            existing_feed_xml = build_rss_feed(
                [
                    {
                        "entry_id": "morning-prayer",
                        "episode_id": "morning-prayer-2026-04-06",
                        "title": "Morning Prayer for April 6, 2026",
                        "description": "Morning prayer episode.",
                        "published_date": "2026-04-06",
                        "audio_path": str(existing_audio),
                        "audio_url": "https://example.com/audio/morning-prayer-2026-04-06.mp3",
                    }
                ],
                base_url="https://example.com",
            )
            write_podcast_feed(existing_feed_xml, docs_root / "podcast.xml")

            def fake_renderer(text, audio_config):
                return make_test_mp3_bytes()

            def fake_generate_text(prompt, context):
                return f"generated::{prompt}"

            result = pipeline_mod.run_novena_pipeline(
                contract_dir=contracts_root,
                docs_root=docs_root,
                cache_root=cache_root,
                today=datetime.date(2026, 6, 3),
                renderer=fake_renderer,
                generate_text_fn=fake_generate_text,
                base_url="https://example.com",
            )

            root_xml = ET.fromstring((docs_root / "podcast.xml").read_text(encoding="utf-8"))
            guids = [item.findtext("guid") for item in root_xml.findall("./channel/item")]
            self.assertIn("morning-prayer-2026-04-06", guids)
            self.assertIn("2026-06-03-most_sacred_heart_of_jesus-day-1", guids)
            self.assertEqual(result["active"], 1)
