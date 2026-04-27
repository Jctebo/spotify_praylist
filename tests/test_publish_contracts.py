import datetime
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tests.test_helpers import load_module


class TestPublishContracts(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/publish/contracts.py")
        self.mod.build_daily_intro_text = lambda date_value, **kwargs: (
            "Today the Church celebrates Saint Example. Praise be to God for his mercy. "
            "In today's Gospel, Jesus calls his sheep by name."
        )

    def test_render_publish_template_and_episode_id_are_date_scoped(self):
        contracts = self.mod.load_publish_contracts()
        target_date = datetime.date(2026, 4, 6)
        morning_contract = next(contract for contract in contracts if contract.contract_id == "morning-prayer")
        entry = morning_contract.entries[0]

        context = self.mod.build_publish_context(
            contract_id=morning_contract.contract_id,
            contract_type=morning_contract.contract_type,
            frequency=morning_contract.frequency,
            timezone=morning_contract.timezone,
            version=morning_contract.version,
            entry=entry,
            target_date=target_date,
        )
        rendered_title = self.mod.render_publish_template(morning_contract.metadata["title_template"], context)
        rendered_description = self.mod.render_publish_template(morning_contract.metadata["description_template"], context)

        self.assertEqual(rendered_title, "Morning Prayer for April 6, 2026")
        self.assertIn("April 6, 2026", rendered_description)
        self.assertEqual(context["episode_id"], "morning-prayer-2026-04-06")
        self.assertEqual(self.mod.derive_episode_id(context=context, template=morning_contract.metadata["episode_id_template"]), "morning-prayer-2026-04-06")

    def test_load_publish_contracts_reads_rewritten_contracts(self):
        contracts = self.mod.load_publish_contracts()

        self.assertEqual([contract.contract_id for contract in contracts], ["morning-prayer", "rosary"])
        self.assertEqual([contract.frequency for contract in contracts], ["daily", "daily"])
        self.assertEqual(contracts[0].entries[0]["entry_id"], "morning-prayer")
        self.assertEqual(contracts[1].entries[0]["entry_id"], "rosary")
        self.assertTrue(contracts[0].entries[0]["audio_config"]["enabled"])
        self.assertFalse(contracts[1].entries[0]["audio_config"]["enabled"])

    def test_resolve_text_jobs_uses_weekday_and_month_selectors(self):
        contracts = self.mod.load_publish_contracts()
        target_date = datetime.date(2026, 4, 6)  # Monday in April
        jobs = self.mod.build_text_jobs(contracts, target_date=target_date)

        self.assertEqual(len(jobs), 2)
        morning = next(job for job in jobs if job["entry_id"] == "morning-prayer")
        rosary = next(job for job in jobs if job["entry_id"] == "rosary")
        self.assertEqual(morning["title"], "Morning Prayer for April 6, 2026")
        self.assertEqual(morning["episode_id"], "morning-prayer-2026-04-06")
        self.assertIn("Today the Church celebrates", morning["text"])
        self.assertIn("April", morning["text"])
        self.assertIn("Joyful Mysteries", rosary["text"])
        self.assertEqual(
            [section["title"] for section in morning["sections"]],
            ["Daily Intro", "Opening Prayers", "Petitions", "Intercessory Litany"],
        )
        self.assertEqual(
            [section["title"] for section in rosary["sections"]],
            ["Opening Prayers", "Joyful Mysteries", "Closing Prayers"],
        )

    def test_expand_audio_fragments_flattens_leaf_blocks_in_order(self):
        contracts = self.mod.load_publish_contracts()
        target_date = datetime.date(2026, 4, 6)
        morning_contract = next(contract for contract in contracts if contract.contract_id == "morning-prayer")
        entry = morning_contract.entries[0]

        fragments = self.mod.expand_audio_fragments(morning_contract, entry, target_date=target_date)

        self.assertEqual(len(fragments), 13)
        self.assertEqual(fragments[0]["label"], "Daily Intro")
        self.assertEqual(fragments[0]["kind"], "daily-intro")
        self.assertEqual(fragments[1]["label"], "Morning Offering")
        self.assertIn("April", fragments[5]["text"])
        self.assertEqual(fragments[-1]["label"], "Intercessory Litany")
        self.assertEqual(
            [fragment["fragment_key"] for fragment in fragments[:4]],
            [
                "block-1/daily-intro",
                "block-2/sequence-1/file",
                "block-2/sequence-2/file",
                "block-2/sequence-3/file",
            ],
        )

    def test_load_publish_contracts_rejects_duplicate_entry_ids(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contracts_dir = root / "config" / "publish" / "contracts"
            templates_dir = root / "config" / "publish" / "templates"
            templates_dir.mkdir(parents=True, exist_ok=True)
            contracts_dir.mkdir(parents=True, exist_ok=True)
            template_path = templates_dir / "sample.txt"
            template_path.write_text("Sample", encoding="utf-8")

            payload = {
                "contract": {
                    "id": "sample",
                    "type": "daily-prayer",
                    "frequency": "daily",
                    "timezone": "America/Chicago",
                    "version": "1",
                },
                "entries": [
                    {
                        "entry_id": "duplicate",
                        "date": "daily",
                        "title": "Duplicate One",
                        "status": "approved",
                        "text": "Duplicate One",
                        "blocks": [{"kind": "file", "path": "config/publish/templates/sample.txt"}],
                    }
                ],
            }
            (contracts_dir / "one.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
            payload["contract"]["id"] = "sample-two"
            payload["entries"][0]["title"] = "Duplicate Two"
            (contracts_dir / "two.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

            with mock.patch.object(self.mod, "ROOT", root), self.assertRaises(RuntimeError) as ctx:
                self.mod.load_publish_contracts(contracts_dir)

        self.assertIn("Duplicate publish entry_id 'duplicate'", str(ctx.exception))
