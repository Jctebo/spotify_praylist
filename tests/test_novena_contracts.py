import argparse
import json
import tempfile
import unittest
from pathlib import Path

from tests.test_helpers import load_module


class TestNovenaContracts(unittest.TestCase):
    def setUp(self):
        import jobs.novena_contracts.contracts as contracts_mod
        import jobs.novena_contracts.validators as validators_mod

        self.contracts_mod = contracts_mod
        self.validators_mod = validators_mod
        self.script_mod = load_module("scripts/new_novena_contract.py")

    def test_load_novena_contracts_reads_repo_fixture(self):
        contracts = self.contracts_mod.load_novena_contracts()
        contract = next(item for item in contracts if item.contract_id == "most_sacred_heart_of_jesus")

        self.assertEqual(contract.saint["name"], "The Most Sacred Heart of Jesus")
        self.assertEqual(contract.feast.month, 6)
        self.assertEqual(contract.feast.day, 12)
        self.assertEqual(contract.novena.template.template_id, "standard-9-day")
        self.assertEqual(contract.novena.template.source, "template_id:standard-9-day")
        self.assertEqual(contract.novena.content_mode, "hybrid")
        self.assertEqual(contract.family_id, "most_sacred_heart_of_jesus")
        self.assertIn("Sacred Heart", contract.novena.ai_config["theme_prompt"])
        self.assertIn("reign of Christ in homes and families", contract.novena.ai_config["theme_prompt"])

    def test_load_novena_contracts_reads_selector_family_fixture(self):
        contracts = self.contracts_mod.load_novena_contracts()
        contract = next(item for item in contracts if item.contract_id == "standard_9_day")

        self.assertIsNone(contract.feast)
        self.assertIsNotNone(contract.selector)
        self.assertEqual(contract.selector.mode, "auto")
        self.assertEqual(
            contract.selector.ranks,
            ("solemnity", "feast", "memorial", "optional_memorial"),
        )
        self.assertIn("saint-life outline", contract.novena.ai_config["theme_prompt"])
        self.assertIn("final perseverance", contract.novena.ai_config["theme_prompt"])

    def test_load_novena_contracts_reads_short_form_fatima_fixture(self):
        contracts = self.contracts_mod.load_novena_contracts()
        contract = next(item for item in contracts if item.contract_id == "our_lady_of_fatima_short_form")

        self.assertEqual(contract.family_id, "our_lady_of_fatima_short_form")
        self.assertEqual(contract.saint["name"], "Our Lady of Fatima")
        self.assertEqual(contract.feast.month, 5)
        self.assertEqual(contract.feast.day, 13)
        self.assertEqual(contract.novena.template.template_id, "standard-9-day")
        self.assertEqual(contract.novena.content_mode, "hybrid")
        self.assertEqual(
            contract.publishing.rss["episode_title_pattern"],
            "Short-Form Novena to {saint_name} Day {day} - {date_display}",
        )
        self.assertIn("Fatima apparitions", contract.novena.ai_config["theme_prompt"])
        self.assertIn("entrusting the world to Mary", contract.novena.ai_config["theme_prompt"])

    def test_load_novena_contracts_reads_traditional_fatima_fixture_with_single_cycle(self):
        contracts = self.contracts_mod.load_novena_contracts()
        contract = next(item for item in contracts if item.contract_id == "our_lady_of_fatima")
        block = contract.novena.template.blocks[1]
        fragment_parts = [part for part in block.parts if part.get("kind") == "fragment"]

        self.assertEqual(len(block.parts), 9)
        self.assertEqual(
            [part["fragment_key"] for part in fragment_parts],
            ["our_father", "hail_mary", "glory_be"],
        )
        self.assertEqual([part.get("repeat", 1) for part in fragment_parts], [3, 3, 3])
        self.assertEqual(
            [part["text"] for part in block.parts if part.get("kind") == "text" and "You are going to say the following 3 times:" in part.get("text", "")],
            [
                "You are going to say the following 3 times: Our Father",
                "You are going to say the following 3 times: Hail Mary",
                "You are going to say the following 3 times: Glory Be",
            ],
        )

    def test_load_novena_contracts_defaults_enabled_when_missing(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contract_dir = root / "feast-days"
            contract_dir.mkdir(parents=True, exist_ok=True)
            (contract_dir / "sample.json").write_text(
                json.dumps(
                    {
                        "contract": {
                            "id": "sample",
                            "type": "novena_feast_rule",
                            "saint": {"id": "sample", "name": "Sample"},
                            "feast": {"month": 6, "day": 12, "name": "Sample"},
                            "novena": {
                                "duration_days": 9,
                                "start_offset_days": -9,
                                "content_mode": "fixed",
                                "template": {
                                    "template_id": "embedded-fixed",
                                    "sections": [
                                        {"key": "opening", "title": "Opening", "kind": "fixed", "text": "Pray.", "days": [1]},
                                    ],
                                    "blocks": [
                                        {"key": "opening", "title": "Opening", "kind": "fixed", "text": "Pray.", "days": [1]},
                                    ],
                                },
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

            contracts = self.contracts_mod.load_novena_contracts(root)

        contract = contracts[0]
        self.assertTrue(contract.enabled)
        self.assertEqual(contract.to_dict()["contract"]["enabled"], True)

    def test_load_novena_contracts_preserves_disabled_flag(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contract_dir = root / "feast-days"
            contract_dir.mkdir(parents=True, exist_ok=True)
            (contract_dir / "sample.json").write_text(
                json.dumps(
                    {
                        "contract": {
                            "id": "sample",
                            "type": "novena_feast_rule",
                            "enabled": False,
                            "saint": {"id": "sample", "name": "Sample"},
                            "feast": {"month": 6, "day": 12, "name": "Sample"},
                            "novena": {
                                "duration_days": 9,
                                "start_offset_days": -9,
                                "content_mode": "fixed",
                                "template": {
                                    "template_id": "embedded-fixed",
                                    "sections": [
                                        {"key": "opening", "title": "Opening", "kind": "fixed", "text": "Pray."},
                                    ],
                                },
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

            contracts = self.contracts_mod.load_novena_contracts(root)

        contract = contracts[0]
        self.assertFalse(contract.enabled)
        self.assertFalse(contract.to_dict()["contract"]["enabled"])

    def test_load_novena_contracts_preserves_embedded_template_notes(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contract_dir = root / "feast-days"
            contract_dir.mkdir(parents=True, exist_ok=True)
            (contract_dir / "sample.json").write_text(
                json.dumps(
                    {
                        "contract": {
                            "id": "sample",
                            "type": "novena_feast_rule",
                            "saint": {"id": "sample", "name": "Sample"},
                            "feast": {"month": 6, "day": 12, "name": "Sample"},
                            "novena": {
                                "duration_days": 9,
                                "start_offset_days": -9,
                                "content_mode": "fixed",
                                "template": {
                                    "template_id": "embedded-fixed",
                                    "sections": [
                                        {
                                            "key": "opening",
                                            "title": "Opening",
                                            "kind": "fixed",
                                            "text": "Pray.",
                                            "notes": "expanded repetition instruction into three explicit spoken recitations",
                                            "days": [1],
                                        },
                                    ],
                                    "blocks": [
                                        {
                                            "key": "opening",
                                            "title": "Opening",
                                            "kind": "fixed",
                                            "text": "Pray.",
                                            "notes": "expanded repetition instruction into three explicit spoken recitations",
                                            "days": [1],
                                        },
                                    ],
                                },
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

            contracts = self.contracts_mod.load_novena_contracts(root)

        contract = contracts[0]
        self.assertEqual(contract.novena.template.sections[0].notes, "expanded repetition instruction into three explicit spoken recitations")
        self.assertEqual(contract.novena.template.sections[0].days, (1,))
        self.assertEqual(contract.novena.template.blocks[0].days, (1,))
        self.assertEqual(
            contract.to_dict()["contract"]["novena"]["template"]["sections"][0]["notes"],
            "expanded repetition instruction into three explicit spoken recitations",
        )
        self.assertEqual(contract.to_dict()["contract"]["novena"]["template"]["blocks"][0]["days"], [1])

    def test_load_novena_contracts_preserves_embedded_template_fragments(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contract_dir = root / "feast-days"
            contract_dir.mkdir(parents=True, exist_ok=True)
            (contract_dir / "sample.json").write_text(
                json.dumps(
                    {
                        "contract": {
                            "id": "sample",
                            "type": "novena_feast_rule",
                            "saint": {"id": "sample", "name": "Sample"},
                            "feast": {"month": 6, "day": 12, "name": "Sample"},
                            "novena": {
                                "duration_days": 9,
                                "start_offset_days": -9,
                                "content_mode": "fixed",
                                "template": {
                                    "template_id": "embedded-fixed",
                                    "sections": [
                                        {
                                            "key": "opening",
                                            "title": "Opening",
                                            "kind": "fixed",
                                            "text": "Pray.",
                                            "days": [1],
                                        },
                                    ],
                                    "blocks": [
                                        {
                                            "key": "opening",
                                            "title": "Opening",
                                            "kind": "fixed",
                                            "parts": [
                                                {"kind": "text", "text": "Pray."},
                                                {"kind": "fragment", "fragment_key": "our_father", "repeat": 3},
                                            ],
                                            "days": [1],
                                        },
                                    ],
                                    "fragments": [
                                        {
                                            "key": "our_father",
                                            "title": "Our Father",
                                            "kind": "fixed",
                                            "text": "Our Father text.",
                                        },
                                    ],
                                },
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

            contracts = self.contracts_mod.load_novena_contracts(root)

        contract = contracts[0]
        self.assertEqual(contract.novena.template.fragments[0].key, "our_father")
        self.assertEqual(contract.novena.template.blocks[0].parts[1]["fragment_key"], "our_father")
        self.assertEqual(
            contract.to_dict()["contract"]["novena"]["template"]["fragments"][0]["title"],
            "Our Father",
        )

    def test_load_novena_contracts_rejects_short_form_without_focus_prompt_or_theme_list(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            template_dir = root / "templates"
            contract_dir = root / "feast-days"
            template_dir.mkdir(parents=True, exist_ok=True)
            contract_dir.mkdir(parents=True, exist_ok=True)
            (template_dir / "standard-9-day.json").write_text(
                json.dumps(
                    {
                        "template_id": "standard-9-day",
                        "sections": [
                            {"key": "opening", "title": "Opening Prayer", "kind": "fixed", "text": "Pray."},
                            {"key": "petition", "title": "Daily Petition", "kind": "generated", "prompt": "Day {day} for {theme}."},
                        ],
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            (contract_dir / "sample.json").write_text(
                json.dumps(
                    {
                        "contract": {
                            "id": "sample",
                            "type": "novena_feast_rule",
                            "saint": {"id": "sample", "name": "Sample"},
                            "feast": {"month": 6, "day": 12, "name": "Sample"},
                            "novena": {
                                "duration_days": 9,
                                "start_offset_days": -9,
                                "content_mode": "hybrid",
                                "template_id": "standard-9-day",
                                "ai_config": {},
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

            with self.assertRaises(RuntimeError) as ctx:
                self.contracts_mod.load_novena_contracts(root)

        self.assertIn("theme_prompt or a legacy themes list", str(ctx.exception))

    def test_resolve_romcal_identifier_normalizes_saint_name(self):
        resolved = self.validators_mod.resolve_romcal_identifier("Most Sacred Heart of Jesus")

        self.assertEqual(resolved, "most_sacred_heart_of_jesus")

    def test_resolve_romcal_date_handles_movable_feasts(self):
        resolved = self.validators_mod.resolve_romcal_date("easter_time_5_thursday", year=2026)

        self.assertEqual(resolved.isoformat(), "2026-05-07")

    def test_build_contract_payload_uses_normalized_romcal_id(self):
        args = argparse.Namespace(
            id="Most Sacred Heart of Jesus",
            saint_name="",
            feast_name="",
            month="6",
            day="12",
            template_id="standard-9-day",
            embedded_template_file="",
            content_mode="hybrid",
            duration_days=9,
            start_offset_days=-9,
            theme=["trust in the Sacred Heart"],
            feed_id="ora-pro-nobis",
            title_pattern="Short-Form Novena to {saint_name} Day {day} - {date_display}",
            description_pattern="Day {day} of the Novena to {saint_name} for {feast_name}.",
            audio_model="gpt-4o-mini-tts",
            audio_voice="alloy",
            audio_format="mp3",
            audio_speed=1.0,
            output="",
            dry_run=True,
            force=False,
        )

        payload = self.script_mod.build_contract_payload(args)

        self.assertEqual(payload["contract"]["id"], "most_sacred_heart_of_jesus")
        self.assertEqual(payload["contract"]["saint"]["id"], "most_sacred_heart_of_jesus")
        self.assertEqual(payload["contract"]["novena"]["template_id"], "standard-9-day")
        self.assertEqual(payload["contract"]["novena"]["ai_config"]["themes"], ["trust in the Sacred Heart"])

    def test_build_contract_payload_supports_movable_feasts(self):
        args = argparse.Namespace(
            id="easter_time_5_thursday",
            saint_name="",
            feast_name="",
            month="",
            day="",
            feast_romcal_id="easter_time_5_thursday",
            template_id="standard-9-day",
            embedded_template_file="",
            content_mode="hybrid",
            duration_days=9,
            start_offset_days=-9,
            theme=[],
            feed_id="ora-pro-nobis",
            title_pattern="Short-Form Novena to {saint_name} Day {day} - {date_display}",
            description_pattern="Day {day} of the Novena to {saint_name} for {feast_name}.",
            audio_model="gpt-4o-mini-tts",
            audio_voice="alloy",
            audio_format="mp3",
            audio_speed=1.0,
            output="",
            dry_run=True,
            force=False,
        )

        payload = self.script_mod.build_contract_payload(args)

        self.assertEqual(payload["contract"]["id"], "easter_time_5_thursday")
        self.assertEqual(payload["contract"]["feast"]["mode"], "romcal_id")
        self.assertEqual(payload["contract"]["feast"]["romcal_id"], "easter_time_5_thursday")

    def test_build_contract_payload_supports_auto_populate_selector_families(self):
        args = argparse.Namespace(
            id="standard 9 day",
            saint_name="",
            feast_name="",
            month="",
            day="",
            feast_romcal_id="",
            auto_populate=True,
            template_id="standard-9-day",
            embedded_template_file="",
            content_mode="hybrid",
            duration_days=9,
            start_offset_days=-9,
            theme=[],
            feed_id="ora-pro-nobis",
            title_pattern="Short-Form Novena to {saint_name} Day {day} - {date_display}",
            description_pattern="Day {day} of the Novena to {saint_name} for {feast_name}.",
            audio_model="gpt-4o-mini-tts",
            audio_voice="alloy",
            audio_format="mp3",
            audio_speed=1.0,
            output="",
            dry_run=True,
            force=False,
        )

        payload = self.script_mod.build_contract_payload(args)
        output_path = self.script_mod._default_output_path(args, payload)

        self.assertEqual(payload["contract"]["id"], "standard_9_day")
        self.assertNotIn("saint", payload["contract"])
        self.assertNotIn("feast", payload["contract"])
        self.assertEqual(payload["contract"]["selector"]["mode"], "auto")
        self.assertEqual(output_path.name, "standard_9_day.json")
        self.assertTrue(str(output_path).endswith("contracts/novenas/families/standard_9_day.json"))

    def test_helper_script_writes_expected_filename(self):
        args = argparse.Namespace(
            id="Most Sacred Heart of Jesus",
            saint_name="",
            feast_name="",
            month="6",
            day="12",
            template_id="standard-9-day",
            embedded_template_file="",
            content_mode="hybrid",
            duration_days=9,
            start_offset_days=-9,
            theme=[],
            feed_id="ora-pro-nobis",
            title_pattern="Short-Form Novena to {saint_name} Day {day} - {date_display}",
            description_pattern="Day {day} of the Novena to {saint_name} for {feast_name}.",
            audio_model="gpt-4o-mini-tts",
            audio_voice="alloy",
            audio_format="mp3",
            audio_speed=1.0,
            output="",
            dry_run=True,
            force=False,
        )
        payload = self.script_mod.build_contract_payload(args)
        output_path = self.script_mod._default_output_path(args, payload)

        self.assertEqual(output_path.name, "most_sacred_heart_of_jesus.json")
        self.assertTrue(str(output_path).endswith("contracts/novenas/feast-days/most_sacred_heart_of_jesus.json"))

    def test_validate_novena_contract_rejects_mode_mismatch(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            template_dir = root / "templates"
            template_dir.mkdir(parents=True, exist_ok=True)
            contract_dir = root / "feast-days"
            contract_dir.mkdir(parents=True, exist_ok=True)
            (template_dir / "fixed-only.json").write_text(
                json.dumps(
                    {
                        "template_id": "fixed-only",
                        "sections": [
                            {
                                "key": "opening",
                                "title": "Opening",
                                "kind": "fixed",
                                "text": "Pray.",
                            },
                            {
                                "key": "petition",
                                "title": "Petition",
                                "kind": "generated",
                                "prompt": "Generate petition for {saint_name}.",
                            },
                        ],
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            (contract_dir / "sample.json").write_text(
                json.dumps(
                    {
                        "contract": {
                            "id": "sample",
                            "type": "novena_feast_rule",
                            "saint": {"id": "sample", "name": "Sample"},
                            "feast": {"month": 6, "day": 12, "name": "Sample"},
                            "novena": {
                                "duration_days": 9,
                                "start_offset_days": -9,
                                "content_mode": "fixed",
                                "template_id": "fixed-only",
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

            with self.assertRaises(RuntimeError) as ctx:
                self.contracts_mod.load_novena_contracts(root)

        self.assertIn("content_mode 'fixed'", str(ctx.exception))
