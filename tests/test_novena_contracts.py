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
            title_pattern="Day {day}: Novena to {saint_name} - {theme}",
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
            title_pattern="Day {day}: Novena to {saint_name} - {theme}",
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
            title_pattern="Day {day}: Novena to {saint_name} - {theme}",
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
            title_pattern="Day {day}: Novena to {saint_name} - {theme}",
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

            with self.assertRaises(RuntimeError) as ctx:
                self.contracts_mod.load_novena_contracts(root)

        self.assertIn("content_mode 'fixed'", str(ctx.exception))
