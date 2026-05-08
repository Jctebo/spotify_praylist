import datetime
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

import jobs.novena_contracts.contracts as contracts_mod
import jobs.novena_contracts.pipeline as pipeline_mod
from jobs.publish.audio import load_published_audio_jobs
from tests.test_helpers import make_test_mp3_bytes


class TestNovenaPipeline(unittest.TestCase):
    def _short_form_theme_prompt(self):
        return "Create a 9-day saint-life outline for {saint_name}. Return nine distinct daily focus lines, each rooted in a different stage or witness of the saint's life."

    def _fake_generate_text(self, prompt, context):
        if "JSON array of 9 strings" in prompt or "unique daily focus lines" in prompt:
            saint_name = str(context.get("saint_name", "Saint")).strip() or "Saint"
            outline = [f"{saint_name} focus {index}" for index in range(1, 10)]
            return json.dumps(outline)
        return f"generated::{prompt}"

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
                                "ai_config": {"theme_prompt": self._short_form_theme_prompt()},
                            },
                            "publishing": {
                                "audio": {"enabled": True, "model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
                                "rss": {
                                    "enabled": True,
                                    "feed_id": "ora-pro-nobis",
                                    "episode_title_pattern": "Short-Form Novena to {saint_name} Day {day} - {date_display}",
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
                            "ai_config": {"theme_prompt": self._short_form_theme_prompt()},
                        },
                        "publishing": {
                            "audio": {"enabled": True, "model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
                                "rss": {
                                    "enabled": True,
                                    "feed_id": "ora-pro-nobis",
                                    "episode_title_pattern": "Short-Form Novena to {saint_name} Day {day} - {date_display}",
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
            generate_calls = {"count": 0}

            def fake_renderer(text, audio_config):
                renderer_calls["count"] += 1
                return make_test_mp3_bytes()

            def fake_generate_text(prompt, context):
                generate_calls["count"] += 1
                return self._fake_generate_text(prompt, context)

            first = pipeline_mod.run_novena_pipeline(
                contract_dir=contracts_root,
                docs_root=docs_root,
                cache_root=cache_root,
                today=datetime.date(2026, 6, 3),
                renderer=fake_renderer,
                generate_text_fn=fake_generate_text,
            )
            calls_after_first = generate_calls["count"]
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
            self.assertEqual(first["rendered"], 9)
            self.assertEqual(second["rendered"], 9)
            self.assertEqual(first["audio"], 1)
            self.assertEqual(second["audio"], 1)
            self.assertEqual(len(first["seeded_items"]), 9)
            self.assertEqual(renderer_calls["count"], 3)
            self.assertEqual(generate_calls["count"], calls_after_first)
            self.assertEqual(len(jobs), 1)
            self.assertEqual(len(list((docs_root / "audio").glob("*.json"))), 9)
            self.assertEqual(len(list((docs_root / "audio").glob("*.mp3"))), 1)
            self.assertTrue((docs_root / "audio" / "2026-06-03-most_sacred_heart_of_jesus-day-1.mp3").exists())
            self.assertTrue((docs_root / "audio" / "2026-06-03-most_sacred_heart_of_jesus-day-1.json").exists())
            guid = feed_root.findtext("./channel/item/guid") or ""
            self.assertTrue(guid.startswith("2026-06-03-most_sacred_heart_of_jesus-day-1::"))
            self.assertEqual(
                feed_root.findtext("./channel/item/title"),
                "Short-Form Novena to The Most Sacred Heart of Jesus Day 1 - June 3, 2026",
            )

    def test_pipeline_can_seed_today_and_tomorrow_together(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contracts_root = self._write_contracts(root)
            docs_root = root / "docs"
            cache_root = root / ".cache"

            def fake_renderer(text, audio_config):
                return make_test_mp3_bytes()

            def fake_generate_text(prompt, context):
                return self._fake_generate_text(prompt, context)

            result = pipeline_mod.run_novena_pipeline(
                contract_dir=contracts_root,
                docs_root=docs_root,
                cache_root=cache_root,
                publish_dates=[datetime.date(2026, 6, 3), datetime.date(2026, 6, 4)],
                renderer=fake_renderer,
                generate_text_fn=fake_generate_text,
            )

            root_xml = ET.fromstring((docs_root / "podcast.xml").read_text(encoding="utf-8"))
            guids = [item.findtext("guid") or "" for item in root_xml.findall("./channel/item")]

            self.assertEqual(result["active"], 2)
            self.assertEqual(result["rendered"], 9)
            self.assertEqual(result["audio"], 2)
            self.assertEqual(len(list((docs_root / "audio").glob("*.json"))), 9)
            self.assertTrue(any(guid.startswith("2026-06-03-most_sacred_heart_of_jesus-day-1::") for guid in guids))
            self.assertTrue(any(guid.startswith("2026-06-04-most_sacred_heart_of_jesus-day-2::") for guid in guids))

    def test_pipeline_renders_traditional_novena_title_with_publish_date_suffix(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contracts_root = self._write_contracts(root)
            (contracts_root / "feast-days" / "most_sacred_heart_of_jesus.json").unlink()
            (contracts_root / "feast-days" / "st_damien_of_molokai.json").write_text(
                json.dumps(
                    {
                        "contract": {
                            "id": "st_damien_of_molokai",
                            "type": "novena_feast_rule",
                            "saint": {"id": "st_damien_of_molokai", "name": "St Damien of Molokai"},
                            "feast": {"month": 6, "day": 12, "name": "St Damien of Molokai"},
                            "novena": {
                                "duration_days": 9,
                                "start_offset_days": -9,
                                "content_mode": "hybrid",
                                "template_id": "standard-9-day",
                                "ai_config": {"theme_prompt": self._short_form_theme_prompt()},
                            },
                            "publishing": {
                                "audio": {"enabled": True, "model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
                                "rss": {
                                    "enabled": True,
                                    "feed_id": "ora-pro-nobis",
                                    "episode_title_pattern": "Traditional Novena to {saint_name} Day {day} - {date_display}",
                                    "episode_description_pattern": "Day {day} of the Novena to {saint_name} for {feast_name}.",
                                },
                            },
                        }
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            docs_root = root / "docs"
            cache_root = root / ".cache"

            def fake_renderer(text, audio_config):
                return make_test_mp3_bytes()

            def fake_generate_text(prompt, context):
                return self._fake_generate_text(prompt, context)

            result = pipeline_mod.run_novena_pipeline(
                contract_dir=contracts_root,
                docs_root=docs_root,
                cache_root=cache_root,
                today=datetime.date(2026, 6, 4),
                renderer=fake_renderer,
                generate_text_fn=fake_generate_text,
            )

            feed_root = ET.fromstring((docs_root / "podcast.xml").read_text(encoding="utf-8"))
            title = feed_root.findtext("./channel/item/title") or ""

            self.assertEqual(result["active"], 1)
            self.assertTrue(title.endswith(" - June 4, 2026"))
            self.assertEqual(title, "Traditional Novena to St Damien of Molokai Day 2 - June 4, 2026")

    def test_pipeline_publishes_traditional_and_short_form_fatima_titles(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contracts_root = root / "contracts" / "novenas"
            template_dir = contracts_root / "templates"
            feast_dir = contracts_root / "feast-days"
            template_dir.mkdir(parents=True, exist_ok=True)
            feast_dir.mkdir(parents=True, exist_ok=True)

            for source, target in (
                (contracts_mod.DEFAULT_TEMPLATE_DIR / "standard-9-day.json", template_dir / "standard-9-day.json"),
                (contracts_mod.DEFAULT_FEAST_DIR / "our_lady_of_fatima.json", feast_dir / "our_lady_of_fatima.json"),
                (
                    contracts_mod.DEFAULT_FEAST_DIR / "our_lady_of_fatima_short_form.json",
                    feast_dir / "our_lady_of_fatima_short_form.json",
                ),
            ):
                target.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")

            docs_root = root / "docs"
            cache_root = root / ".cache"

            def fake_renderer(text, audio_config):
                return make_test_mp3_bytes()

            def fake_generate_text(prompt, context):
                return self._fake_generate_text(prompt, context)

            result = pipeline_mod.run_novena_pipeline(
                contract_dir=contracts_root,
                docs_root=docs_root,
                cache_root=cache_root,
                today=datetime.date(2026, 5, 4),
                renderer=fake_renderer,
                generate_text_fn=fake_generate_text,
            )

            jobs = load_published_audio_jobs(docs_root=docs_root)
            feed_root = ET.fromstring((docs_root / "podcast.xml").read_text(encoding="utf-8"))
            titles = [item.findtext("./title") or "" for item in feed_root.findall("./channel/item")]

            self.assertEqual(result["active"], 2)
            self.assertEqual(result["rendered"], 10)
            self.assertEqual(result["audio"], 2)
            self.assertEqual(len(jobs), 2)
            self.assertIn("Traditional Novena to Our Lady of Fatima Day 1 - May 4, 2026", titles)
            self.assertIn("Short-Form Novena to Our Lady of Fatima Day 1 - May 4, 2026", titles)
            self.assertTrue((docs_root / "audio" / "2026-05-04-our_lady_of_fatima-day-1.mp3").exists())
            self.assertTrue((docs_root / "audio" / "2026-05-04-our_lady_of_fatima_short_form-day-1.mp3").exists())
            self.assertTrue(
                any(job["episode_id"] == "2026-05-04-our_lady_of_fatima-day-1" for job in jobs)
            )
            self.assertTrue(
                any(job["episode_id"] == "2026-05-04-our_lady_of_fatima_short_form-day-1" for job in jobs)
            )

    def test_pipeline_reset_truncates_existing_feed_items(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contracts_root = self._write_contracts(root)
            docs_root = root / "docs"
            cache_root = root / ".cache"
            docs_root.mkdir(parents=True, exist_ok=True)
            feed_root = ET.Element("rss", version="2.0")
            channel = ET.SubElement(feed_root, "channel")
            ET.SubElement(channel, "title").text = "Ora Pro Nobis"
            item = ET.SubElement(channel, "item")
            ET.SubElement(item, "title").text = "Morning Prayer"
            ET.SubElement(item, "guid", isPermaLink="false").text = "morning-prayer-2026-04-06::revision-a"
            ET.SubElement(item, "link").text = "https://example.com/audio/morning-prayer-2026-04-06.mp3"
            ET.SubElement(item, "description").text = "Morning prayer episode."
            ET.SubElement(item, "pubDate").text = "Mon, 06 Apr 2026 12:00:00 +0000"
            ET.ElementTree(feed_root).write(docs_root / "podcast.xml", encoding="utf-8", xml_declaration=True)

            def fake_renderer(text, audio_config):
                return make_test_mp3_bytes()

            def fake_generate_text(prompt, context):
                return self._fake_generate_text(prompt, context)

            result = pipeline_mod.run_novena_pipeline(
                contract_dir=contracts_root,
                docs_root=docs_root,
                cache_root=cache_root,
                publish_dates=[datetime.date(2026, 6, 3), datetime.date(2026, 6, 4)],
                renderer=fake_renderer,
                generate_text_fn=fake_generate_text,
                reset_feed=True,
            )

            root_xml = ET.fromstring((docs_root / "podcast.xml").read_text(encoding="utf-8"))
            guids = [item.findtext("guid") or "" for item in root_xml.findall("./channel/item")]

            self.assertEqual(result["active"], 2)
            self.assertNotIn("morning-prayer", guids)
            self.assertTrue(any(guid.startswith("2026-06-03-most_sacred_heart_of_jesus-day-1::") for guid in guids))
            self.assertTrue(any(guid.startswith("2026-06-04-most_sacred_heart_of_jesus-day-2::") for guid in guids))

    def test_pipeline_skips_disabled_novena_contracts(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contracts_root = root / "contracts" / "novenas"
            contract_dir = contracts_root / "feast-days"
            contract_dir.mkdir(parents=True, exist_ok=True)
            template_dir = contracts_root / "templates"
            template_dir.mkdir(parents=True, exist_ok=True)
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
            (contract_dir / "disabled.json").write_text(
                json.dumps(
                    {
                        "contract": {
                            "id": "most_sacred_heart_of_jesus",
                            "type": "novena_feast_rule",
                            "enabled": False,
                            "saint": {"id": "most_sacred_heart_of_jesus", "name": "The Most Sacred Heart of Jesus"},
                            "feast": {"month": 6, "day": 12, "name": "The Most Sacred Heart of Jesus"},
                            "novena": {
                                "duration_days": 9,
                                "start_offset_days": -9,
                                "content_mode": "hybrid",
                                "template_id": "standard-9-day",
                                "ai_config": {"theme_prompt": self._short_form_theme_prompt()},
                            },
                            "publishing": {
                                "audio": {"enabled": True, "model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
                                "rss": {
                                    "enabled": True,
                                    "feed_id": "ora-pro-nobis",
                                    "episode_title_pattern": "Short-Form Novena to {saint_name} Day {day} - {date_display}",
                                    "episode_description_pattern": "Day {day} of the Novena to {saint_name} for {feast_name}.",
                                },
                            },
                        }
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            docs_root = root / "docs"
            cache_root = root / ".cache"

            def fake_renderer(text, audio_config):
                return make_test_mp3_bytes()

            def fake_generate_text(prompt, context):
                return self._fake_generate_text(prompt, context)

            result = pipeline_mod.run_novena_pipeline(
                contract_dir=contracts_root,
                docs_root=docs_root,
                cache_root=cache_root,
                today=datetime.date(2026, 6, 3),
                renderer=fake_renderer,
                generate_text_fn=fake_generate_text,
            )

            self.assertEqual(result["contracts"], 1)
            self.assertEqual(result["active"], 0)
            self.assertEqual(result["rendered"], 0)
            self.assertFalse((docs_root / "podcast.xml").exists())

    def test_pipeline_preserves_existing_feed_items_when_rebuilding(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contracts_root = self._write_contracts(root)
            docs_root = root / "docs"
            cache_root = root / ".cache"
            docs_root.mkdir(parents=True, exist_ok=True)
            feed_root = ET.Element("rss", version="2.0")
            channel = ET.SubElement(feed_root, "channel")
            ET.SubElement(channel, "title").text = "Ora Pro Nobis"
            item = ET.SubElement(channel, "item")
            ET.SubElement(item, "title").text = "Morning Prayer"
            ET.SubElement(item, "guid", isPermaLink="false").text = "morning-prayer-2026-04-06::revision-a"
            ET.SubElement(item, "link").text = "https://example.com/audio/morning-prayer-2026-04-06.mp3"
            ET.SubElement(item, "description").text = "Morning prayer episode."
            ET.SubElement(item, "pubDate").text = "Mon, 06 Apr 2026 12:00:00 +0000"
            ET.ElementTree(feed_root).write(docs_root / "podcast.xml", encoding="utf-8", xml_declaration=True)

            def fake_renderer(text, audio_config):
                return make_test_mp3_bytes()

            def fake_generate_text(prompt, context):
                return self._fake_generate_text(prompt, context)

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
            self.assertTrue(any((guid or "").startswith("morning-prayer-2026-04-06::") for guid in guids))
            self.assertTrue(any((guid or "").startswith("2026-06-03-most_sacred_heart_of_jesus-day-1::") for guid in guids))
            self.assertEqual(result["active"], 1)
