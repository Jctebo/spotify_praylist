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
        self.assertIn("April", morning["text"])
        self.assertIn("Joyful Mysteries", rosary["text"])
        self.assertEqual(
            [section["title"] for section in morning["sections"]],
            ["Opening Prayers", "Petitions", "Intercessory Litany"],
        )
        self.assertEqual(
            [section["title"] for section in rosary["sections"]],
            ["Opening Prayers", "Joyful Mysteries", "Closing Prayers"],
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
