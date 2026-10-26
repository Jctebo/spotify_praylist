import datetime
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

import jobs.novena_contracts.contracts as contracts_mod
import jobs.novena_contracts.engine as engine_mod
import jobs.novena_contracts.pipeline as pipeline_mod
from jobs.publish.audio import load_published_audio_jobs
from tests.test_helpers import make_test_mp3_bytes, temp_env


class TestNovenaPipeline(unittest.TestCase):
    class FakeDailyThemeRuntimeCache:
        def __init__(self):
            self.calls = []

        def get(self, target_date, config):
            self.calls.append((target_date, dict(config)))
            return {
                "daily_liturgical_context": {
                    "date": target_date.isoformat(),
                    "liturgicalSeason": "Ordinary Time",
                    "gospelCitation": "Matthew 5:43-48",
                    "fallbackReason": "",
                    "sharedThemeTitle": "Humility And Trust",
                    "sharedThemeSlug": "humility-and-trust",
                    "sharedThemeExplanation": "Today's focus is humility and trust.",
                    "sharedThemeTransition": "Carrying today's focus of humility and trust, we enter this novena.",
                    "sharedThemeReflectionFocus": "Today's focus is humility and trust.",
                    "sharedGospelBridge": "today's Gospel, Matthew 5:43-48, draws us into humility",
                    "sharedThemeSources": [
                        {"kind": "calendar", "label": "Tuesday of the Eleventh Week in Ordinary Time", "theme": "humility"},
                        {"kind": "gospel", "label": "Matthew 5:43-48", "theme": "humility"},
                        {"kind": "season", "label": "Ordinary Time", "theme": "trust"},
                    ],
                    "sharedThemeVersion": "saint-centered-theme-v1",
                },
                "daily_theme_title": "Humility And Trust",
                "daily_theme_slug": "humility-and-trust",
                "daily_theme_explanation": "Today's focus is humility and trust.",
                "daily_theme_transition": "Carrying today's focus of humility and trust, we enter this novena.",
                "daily_theme_reflection_focus": "Today's focus is humility and trust.",
                "daily_gospel_bridge": "today's Gospel, Matthew 5:43-48, draws us into humility",
                "daily_theme_sources": [
                    {"kind": "calendar", "label": "Tuesday of the Eleventh Week in Ordinary Time", "theme": "humility"},
                    {"kind": "gospel", "label": "Matthew 5:43-48", "theme": "humility"},
                    {"kind": "season", "label": "Ordinary Time", "theme": "trust"},
                ],
                    "daily_theme_version": "saint-centered-theme-v1",
            }

    def setUp(self):
        self._daily_theme_cache = pipeline_mod.DailyThemeRuntimeCache
        self._intro_builder = engine_mod.build_devotional_intro
        pipeline_mod.DailyThemeRuntimeCache = self.FakeDailyThemeRuntimeCache
        engine_mod.build_devotional_intro = self._fake_intro
        self.addCleanup(self._restore_daily_theme_cache)

    def _restore_daily_theme_cache(self):
        pipeline_mod.DailyThemeRuntimeCache = self._daily_theme_cache
        engine_mod.build_devotional_intro = self._intro_builder

    def _fake_intro(self, profile, context, **kwargs):
        saint_name = str(context.get("saint_name", "the saint")).strip()
        day = str(context.get("day", "1")).strip()
        theme = str(context.get("daily_theme_title", "Humility And Trust")).strip()
        return engine_mod.DevotionalIntroResult(
            text=f"Welcome to Day {day} of the Novena to {saint_name}, joining today's focus of {theme} to our prayer.",
            profile="novena",
            policy_version=pipeline_mod.DEVOTIONAL_INTRO_POLICY_VERSION,
            source="openai",
        )

    def _short_form_theme_prompt(self):
        return "Create a 9-day saint-life outline for {saint_name}. Return nine distinct daily focus lines, each rooted in a different stage or witness of the saint's life."

    def _fake_generate_text(self, prompt, context):
        if "JSON array of 9 strings" in prompt or "unique daily focus lines" in prompt:
            saint_name = str(context.get("saint_name", "Saint")).strip() or "Saint"
            outline = [f"{saint_name} focus {index}" for index in range(1, 10)]
            return json.dumps(outline)
        return f"generated::{prompt}"

    def test_sidecar_freshness_requires_current_devotional_intro_policy(self):
        target_date = datetime.date(2026, 6, 3)
        expected = self.FakeDailyThemeRuntimeCache().get(target_date, {})
        payload = {
            "date": target_date.isoformat(),
            "daily_liturgical_context": dict(expected["daily_liturgical_context"]),
            "devotional_intro": {
                "profile": "novena",
                "policy_version": pipeline_mod.DEVOTIONAL_INTRO_POLICY_VERSION,
                "source": "openai",
                "text": "Welcome.",
                "fallback_reason": "",
            },
            "context": {
                "daily_theme_version": "saint-centered-theme-v1",
                "daily_theme_explanation": expected["daily_theme_explanation"],
                "daily_theme_transition": expected["daily_theme_transition"],
                "daily_theme_reflection_focus": expected["daily_theme_reflection_focus"],
                "devotional_intro": {
                    "profile": "novena",
                    "policy_version": pipeline_mod.DEVOTIONAL_INTRO_POLICY_VERSION,
                    "source": "openai",
                    "text": "Welcome.",
                    "fallback_reason": "",
                },
            },
        }

        self.assertTrue(pipeline_mod._sidecar_has_current_daily_theme(payload, expected))
        payload["devotional_intro"]["policy_version"] = "devotional-intro-v1"
        self.assertFalse(pipeline_mod._sidecar_has_current_daily_theme(payload, expected))

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
                                "audio": {"enabled": True, "model": "gpt-4o-mini-tts", "voice": "ash", "format": "mp3", "speed": 1.0},
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
                            "audio": {"enabled": True, "model": "gpt-4o-mini-tts", "voice": "ash", "format": "mp3", "speed": 1.0},
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
            self.assertEqual(renderer_calls["count"], 5)
            self.assertEqual(generate_calls["count"], calls_after_first)
            self.assertEqual(len(jobs), 1)
            self.assertEqual(len(list((docs_root / "audio").glob("*.json"))), 9)
            self.assertEqual(len(list((docs_root / "audio").glob("*.mp3"))), 1)
            self.assertTrue((docs_root / "audio" / "2026-06-03-most_sacred_heart_of_jesus-day-1.mp3").exists())
            sidecar_path = docs_root / "audio" / "2026-06-03-most_sacred_heart_of_jesus-day-1.json"
            self.assertTrue(sidecar_path.exists())
            sidecar = json.loads(sidecar_path.read_text(encoding="utf-8"))
            self.assertEqual(sidecar["daily_liturgical_context"]["sharedThemeTitle"], "Humility And Trust")
            self.assertEqual(sidecar["daily_liturgical_context"]["gospelCitation"], "Matthew 5:43-48")
            self.assertEqual(sidecar["daily_liturgical_context"]["fallbackReason"], "")
            self.assertEqual(sidecar["context"]["daily_theme_title"], "Humility And Trust")
            self.assertEqual(sidecar["context"]["novena_daily_focus"], "The Most Sacred Heart of Jesus focus 1")
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

    def test_pipeline_preserves_stale_rendered_sidecar_outside_target_dates(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contracts_root = self._write_contracts(root)
            docs_root = root / "docs"
            cache_root = root / ".cache"

            def fake_renderer(text, audio_config):
                return make_test_mp3_bytes()

            def fake_generate_text(prompt, context):
                return self._fake_generate_text(prompt, context)

            pipeline_mod.run_novena_pipeline(
                contract_dir=contracts_root,
                docs_root=docs_root,
                cache_root=cache_root,
                publish_dates=[datetime.date(2026, 6, 3), datetime.date(2026, 6, 4)],
                renderer=fake_renderer,
                generate_text_fn=fake_generate_text,
            )
            stale_sidecar = docs_root / "audio" / "2026-06-03-most_sacred_heart_of_jesus-day-1.json"
            payload = json.loads(stale_sidecar.read_text(encoding="utf-8"))
            payload.pop("context", None)
            payload["content_hash"] = "legacy-rendered-hash"
            payload["audio"]["content_hash"] = "legacy-rendered-hash"
            payload["audio"]["rendered"] = True
            stale_sidecar.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")

            pipeline_mod.run_novena_pipeline(
                contract_dir=contracts_root,
                docs_root=docs_root,
                cache_root=cache_root,
                today=datetime.date(2026, 6, 4),
                renderer=fake_renderer,
                generate_text_fn=fake_generate_text,
            )

            preserved = json.loads(stale_sidecar.read_text(encoding="utf-8"))
            self.assertNotIn("context", preserved)
            self.assertEqual(preserved["content_hash"], "legacy-rendered-hash")
            self.assertTrue(preserved["audio"]["rendered"])

    def test_pipeline_refreshes_target_sidecar_missing_canonical_daily_context(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contracts_root = self._write_contracts(root)
            docs_root = root / "docs"
            cache_root = root / ".cache"

            def fake_renderer(text, audio_config):
                return make_test_mp3_bytes()

            def fake_generate_text(prompt, context):
                return self._fake_generate_text(prompt, context)

            pipeline_mod.run_novena_pipeline(
                contract_dir=contracts_root,
                docs_root=docs_root,
                cache_root=cache_root,
                today=datetime.date(2026, 6, 3),
                renderer=fake_renderer,
                generate_text_fn=fake_generate_text,
            )
            sidecar_path = docs_root / "audio" / "2026-06-03-most_sacred_heart_of_jesus-day-1.json"
            payload = json.loads(sidecar_path.read_text(encoding="utf-8"))
            payload["daily_liturgical_context"] = {
                "date": "2026-06-03",
                "sharedThemeTitle": "Humility And Trust",
                "sharedThemeVersion": "saint-centered-theme-v1",
            }
            payload["context"] = {
                "daily_theme_title": "The Most Sacred Heart of Jesus",
                "daily_theme_version": "saint-centered-theme-v1",
            }
            sidecar_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")

            pipeline_mod.run_novena_pipeline(
                contract_dir=contracts_root,
                docs_root=docs_root,
                cache_root=cache_root,
                today=datetime.date(2026, 6, 3),
                renderer=fake_renderer,
                generate_text_fn=fake_generate_text,
            )

            refreshed = json.loads(sidecar_path.read_text(encoding="utf-8"))
            self.assertEqual(refreshed["daily_liturgical_context"]["sharedThemeTitle"], "Humility And Trust")
            self.assertEqual(refreshed["context"]["daily_theme_title"], "Humility And Trust")
            self.assertEqual(refreshed["context"]["novena_daily_focus"], "The Most Sacred Heart of Jesus focus 1")

    def test_pipeline_refreshes_target_sidecar_with_stale_canonical_daily_transition(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contracts_root = self._write_contracts(root)
            docs_root = root / "docs"
            cache_root = root / ".cache"

            def fake_renderer(text, audio_config):
                return make_test_mp3_bytes()

            def fake_generate_text(prompt, context):
                return self._fake_generate_text(prompt, context)

            pipeline_mod.run_novena_pipeline(
                contract_dir=contracts_root,
                docs_root=docs_root,
                cache_root=cache_root,
                today=datetime.date(2026, 6, 3),
                renderer=fake_renderer,
                generate_text_fn=fake_generate_text,
            )
            sidecar_path = docs_root / "audio" / "2026-06-03-most_sacred_heart_of_jesus-day-1.json"
            payload = json.loads(sidecar_path.read_text(encoding="utf-8"))
            payload["daily_liturgical_context"]["sharedThemeTransition"] = (
                "Carrying today's focus of humility And Trust, we enter this novena."
            )
            payload["context"]["daily_theme_transition"] = payload["daily_liturgical_context"]["sharedThemeTransition"]
            payload["fragments"][0]["text"] = payload["fragments"][0]["text"].replace(
                "humility and trust",
                "humility And Trust",
            )
            sidecar_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")

            pipeline_mod.run_novena_pipeline(
                contract_dir=contracts_root,
                docs_root=docs_root,
                cache_root=cache_root,
                today=datetime.date(2026, 6, 3),
                renderer=fake_renderer,
                generate_text_fn=fake_generate_text,
            )

            refreshed = json.loads(sidecar_path.read_text(encoding="utf-8"))
            self.assertEqual(
                refreshed["daily_liturgical_context"]["sharedThemeTransition"],
                "Carrying today's focus of humility and trust, we enter this novena.",
            )
            self.assertIn("humility and trust", refreshed["fragments"][0]["text"].lower())
            self.assertNotIn("humility And Trust", refreshed["fragments"][0]["text"])

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
                                "audio": {"enabled": True, "model": "gpt-4o-mini-tts", "voice": "ash", "format": "mp3", "speed": 1.0},
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

    def test_pipeline_publishes_traditional_fatima_title_without_short_form_contract(self):
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

            self.assertEqual(result["active"], 1)
            self.assertEqual(result["rendered"], 1)
            self.assertEqual(result["audio"], 1)
            self.assertEqual(len(jobs), 1)
            self.assertIn("Traditional Novena to Our Lady of Fatima Day 1 - May 4, 2026", titles)
            self.assertTrue((docs_root / "audio" / "2026-05-04-our_lady_of_fatima-day-1.mp3").exists())
            self.assertTrue(
                any(job["episode_id"] == "2026-05-04-our_lady_of_fatima-day-1" for job in jobs)
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

    def test_main_bootstrap_no_cache_mode_targets_today_and_tomorrow(self):
        captured = {"publish_dates": None, "reset_feed": None}

        original_run = pipeline_mod.run_novena_pipeline

        def fake_run_novena_pipeline(**kwargs):
            captured["publish_dates"] = list(kwargs.get("publish_dates") or [])
            captured["reset_feed"] = kwargs.get("reset_feed")
            return {
                "contracts": 1,
                "active": 1,
                "rendered": 1,
                "feed_path": "/tmp/podcast.xml",
                "publish_dates": [date.isoformat() for date in captured["publish_dates"]],
            }

        with temp_env({"NOVENA_PUBLISH_MODE": "bootstrap-no-cache"}):
            pipeline_mod.run_novena_pipeline = fake_run_novena_pipeline
            try:
                rc = pipeline_mod.main()
            finally:
                pipeline_mod.run_novena_pipeline = original_run

        self.assertEqual(rc, 0)
        today = datetime.date.today()
        self.assertEqual(captured["publish_dates"], [today, today + datetime.timedelta(days=1)])
        self.assertFalse(captured["reset_feed"])

    def test_targeted_repair_revises_only_the_matching_sidecar_part(self):
        contract = next(
            item for item in contracts_mod.load_novena_contracts()
            if item.contract_id == "st_martin_de_porres"
        )
        runtime = pipeline_mod.resolve_active_novenas(
            datetime.date(2026, 10, 25), contracts=[contract]
        )[0]
        block = next(item for item in runtime.resolved_template.blocks if item.key == "days_1")
        source_text = block.parts[0]["text"]
        template = runtime.resolved_template.to_dict()
        template_block = next(item for item in template["blocks"] if item["key"] == block.key)
        template_block["parts"][0].pop("cache_revision", None)
        payload = {
            "template": template,
            "context": {"saint_name": "St. Martin de Porres"},
            "fragments": [
                {"block_path": "block-days_1/part-1", "text": source_text},
                {"block_path": "block-days_1/part-2", "text": "The ordinary closing."},
            ],
        }

        pipeline_mod._apply_contract_fragment_revisions(runtime, payload)

        self.assertEqual(payload["fragments"][0]["cache_revision"], 1)
        self.assertNotIn("cache_revision", payload["fragments"][1])
        self.assertEqual(template_block["parts"][0]["cache_revision"], 1)

    def test_targeted_repair_fails_closed_when_sidecar_source_differs(self):
        contract = next(
            item for item in contracts_mod.load_novena_contracts()
            if item.contract_id == "st_martin_de_porres"
        )
        runtime = pipeline_mod.resolve_active_novenas(
            datetime.date(2026, 10, 25), contracts=[contract]
        )[0]
        payload = {
            "template": runtime.resolved_template.to_dict(),
            "context": {"saint_name": "St. Martin de Porres"},
            "fragments": [{"block_path": "block-days_1/part-1", "text": "Divergent prayer."}],
        }

        with self.assertRaisesRegex(RuntimeError, "matching source text"):
            pipeline_mod._apply_contract_fragment_revisions(runtime, payload)

    def test_targeted_repair_rebuilds_both_live_days_from_revisioned_shared_fragment(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            docs_root = root / "docs"
            cache_root = root / ".cache"
            dates = [datetime.date(2026, 10, 25), datetime.date(2026, 10, 26)]
            renderer_calls = []

            def fake_renderer(text, audio_config):
                renderer_calls.append(text)
                return make_test_mp3_bytes()

            result = pipeline_mod.run_novena_pipeline(
                docs_root=docs_root,
                cache_root=cache_root,
                publish_dates=dates,
                contract_id="st_martin_de_porres",
                force_episode_rebuild=True,
                renderer=fake_renderer,
                generate_text_fn=self._fake_generate_text,
            )
            self.assertEqual(result["audio"], 2)
            first_render_count = len(renderer_calls)
            st_martin_contract = next(
                item for item in contracts_mod.load_novena_contracts()
                if item.contract_id == "st_martin_de_porres"
            )
            opening_text = next(
                part["text"]
                for block in st_martin_contract.novena.template.blocks
                if block.key == "days_1"
                for part in block.parts[:1]
            )
            self.assertEqual(renderer_calls.count(opening_text), 1)
            sidecar_paths = [
                docs_root / "audio" / f"{date.isoformat()}-st_martin_de_porres-day-{index}.json"
                for index, date in enumerate(dates, start=1)
            ]
            for sidecar_path in sidecar_paths:
                payload = json.loads(sidecar_path.read_text(encoding="utf-8"))
                target = next(
                    fragment for fragment in payload["fragments"]
                    if fragment.get("cache_revision") == 1
                )
                target.pop("cache_revision")
                matching_block = next(
                    block for block in payload["template"]["blocks"]
                    if f"block-{block['key']}/part-1" == target["block_path"]
                )
                matching_block["parts"][0].pop("cache_revision", None)
                payload["content_hash"] = "legacy-content-hash"
                payload["audio"]["content_hash"] = "legacy-content-hash"
                sidecar_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

            feed_path = docs_root / "podcast.xml"
            feed_root = ET.fromstring(feed_path.read_text(encoding="utf-8"))
            for item in feed_root.findall("./channel/item"):
                guid = item.find("guid")
                if guid is not None:
                    guid.text = f"{guid.text}::legacy"
            channel = feed_root.find("./channel")
            unrelated = ET.SubElement(channel, "item")
            ET.SubElement(unrelated, "title").text = "Unrelated episode"
            ET.SubElement(unrelated, "guid", isPermaLink="false").text = "unrelated-episode::stable"
            ET.SubElement(unrelated, "link").text = "https://audio.example/unrelated.mp3"
            ET.SubElement(unrelated, "description").text = "Keep this feed entry."
            ET.SubElement(unrelated, "pubDate").text = "Mon, 26 Oct 2026 12:00:00 +0000"
            ET.SubElement(
                unrelated,
                "enclosure",
                url="https://audio.example/unrelated.mp3",
                length="10",
                type="audio/mpeg",
            )
            ET.ElementTree(feed_root).write(feed_path, encoding="utf-8", xml_declaration=True)

            repaired = pipeline_mod.run_novena_pipeline(
                docs_root=docs_root,
                cache_root=cache_root,
                publish_dates=dates,
                contract_id="st_martin_de_porres",
                force_episode_rebuild=True,
                renderer=fake_renderer,
                generate_text_fn=self._fake_generate_text,
            )

            self.assertEqual(repaired["audio"], 2)
            self.assertEqual(len(renderer_calls), first_render_count)
            feed_root = ET.fromstring(feed_path.read_text(encoding="utf-8"))
            feed_items = feed_root.findall("./channel/item")
            self.assertEqual(len(feed_items), 3)
            self.assertTrue(
                any((entry.findtext("guid") or "") == "unrelated-episode::stable" for entry in feed_items)
            )
            for item, sidecar_path in zip(repaired["items"], sidecar_paths):
                self.assertTrue(item["audio"]["rendered"])
                payload = json.loads(sidecar_path.read_text(encoding="utf-8"))
                self.assertEqual(payload["audio"]["content_hash"], item["audio"]["content_hash"])
                self.assertTrue(any(fragment.get("cache_revision") == 1 for fragment in payload["fragments"]))
                fragments = payload["fragments"]
                opening_index = next(
                    index for index, fragment in enumerate(fragments)
                    if fragment.get("cache_revision") == 1
                )
                self.assertTrue(fragments[opening_index]["text"].endswith("state in which God has placed us."))
                self.assertEqual(fragments[opening_index + 1]["cue"], "sacred_bell")
                self.assertEqual(fragments[opening_index + 2]["duration_ms"], 5000)
                self.assertTrue(
                    any(
                        (entry.findtext("guid") or "") == payload["rss_guid"]
                        for entry in feed_items
                    )
                )
                self.assertFalse(any((entry.findtext("guid") or "").endswith("::legacy") for entry in feed_items))

    def test_main_targeted_repair_parses_dates_and_forces_episode_only_rebuild(self):
        captured = {}
        original = pipeline_mod.run_novena_pipeline

        def fake_run_novena_pipeline(**kwargs):
            captured.update(kwargs)
            return {
                "contracts": 1,
                "active": 2,
                "rendered": 2,
                "feed_path": "/tmp/podcast.xml",
                "publish_dates": [value.isoformat() for value in kwargs["publish_dates"]],
            }

        pipeline_mod.run_novena_pipeline = fake_run_novena_pipeline
        try:
            with temp_env({
                "NOVENA_PUBLISH_MODE": "targeted-novena-repair",
                "NOVENA_REPAIR_CONTRACT_ID": "st_martin_de_porres",
                "NOVENA_REPAIR_DATES": "2026-10-26,2026-10-25",
            }):
                rc = pipeline_mod.main()
        finally:
            pipeline_mod.run_novena_pipeline = original

        self.assertEqual(rc, 0)
        self.assertEqual(captured["contract_id"], "st_martin_de_porres")
        self.assertEqual(
            captured["publish_dates"],
            [datetime.date(2026, 10, 25), datetime.date(2026, 10, 26)],
        )
        self.assertTrue(captured["force_episode_rebuild"])
        self.assertFalse(captured["reset_feed"])

    def test_main_targeted_repair_rejects_duplicate_dates(self):
        with temp_env({
            "NOVENA_PUBLISH_MODE": "targeted-novena-repair",
            "NOVENA_REPAIR_CONTRACT_ID": "st_martin_de_porres",
            "NOVENA_REPAIR_DATES": "2026-10-25,2026-10-25",
        }):
            with self.assertRaisesRegex(RuntimeError, "duplicates"):
                pipeline_mod.main()

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
                                "audio": {"enabled": True, "model": "gpt-4o-mini-tts", "voice": "ash", "format": "mp3", "speed": 1.0},
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
            enclosures = [
                item.find("./enclosure").get("url")
                for item in root_xml.findall("./channel/item")
                if item.find("./enclosure") is not None
            ]
            self.assertTrue(any((guid or "").startswith("morning-prayer-2026-04-06::") for guid in guids))
            self.assertTrue(any((guid or "").startswith("2026-06-03-most_sacred_heart_of_jesus-day-1::") for guid in guids))
            self.assertTrue(any(url == "https://example.com/audio/2026-06-03-most_sacred_heart_of_jesus-day-1.mp3" for url in enclosures))
            self.assertEqual(result["active"], 1)
