import datetime
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tests.test_helpers import load_module


class TestPublishContracts(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/publish/contracts.py")
        self.calls = []

        def fake_build_daily_intro_text(date_value, **kwargs):
            self.calls.append((date_value, dict(kwargs)))
            return (
                "Today the Church celebrates Saint Example. Praise be to God for his mercy. "
                "In today's Gospel, Jesus calls his sheep by name."
            )

        self.mod.build_daily_intro_text = fake_build_daily_intro_text

    def test_render_publish_template_and_episode_id_are_date_scoped(self):
        contracts = self.mod.load_publish_contracts()
        target_date = datetime.date(2026, 4, 6)
        morning_contract = next(contract for contract in contracts if contract.contract_id == "morning-prayer-elevenlabs")
        entry = morning_contract.entries[0]

        context = self.mod.build_publish_context(
            contract_id=morning_contract.contract_id,
            contract_type=morning_contract.contract_type,
            frequency=morning_contract.frequency,
            timezone=morning_contract.timezone,
            version=morning_contract.version,
            entry=entry,
            target_date=target_date,
            season="easter",
        )
        rendered_title = self.mod.render_publish_template(morning_contract.metadata["title_template"], context)
        rendered_description = self.mod.render_publish_template(morning_contract.metadata["description_template"], context)

        self.assertEqual(rendered_title, "Morning Prayer - April 6, 2026")
        self.assertIn("April 6, 2026", rendered_description)
        self.assertEqual(context["season"], "easter")
        self.assertEqual(context["season_label"], "Easter Season")
        self.assertEqual(context["episode_id"], "morning-prayer-elevenlabs-2026-04-06")
        self.assertEqual(self.mod.derive_episode_id(context=context, template=morning_contract.metadata["episode_id_template"]), "morning-prayer-elevenlabs-2026-04-06")

    def test_load_publish_contracts_reads_rewritten_contracts(self):
        contracts = self.mod.load_publish_contracts()
        contracts_by_id = {contract.contract_id: contract for contract in contracts}

        self.assertEqual(
            [contract.contract_id for contract in contracts],
            [
                "marian-antiphon-angelus",
                "marian-antiphon-regina-caeli",
                "morning-prayer-elevenlabs",
                "rosary",
            ],
        )
        self.assertEqual([contract.frequency for contract in contracts], ["daily", "daily", "daily", "daily"])
        self.assertEqual(contracts_by_id["marian-antiphon-angelus"].season, "ordinary")
        self.assertEqual(contracts_by_id["marian-antiphon-regina-caeli"].season, "easter")
        self.assertEqual(
            contracts_by_id["marian-antiphon-angelus"].metadata["title_template"],
            "Marian Antiphon - Angelus - {date_display}",
        )
        self.assertEqual(
            contracts_by_id["marian-antiphon-regina-caeli"].metadata["title_template"],
            "Marian Antiphon - Regina Caeli - {date_display}",
        )
        self.assertEqual(contracts_by_id["marian-antiphon-angelus"].entries[0]["entry_id"], "marian-antiphon-angelus")
        self.assertEqual(contracts_by_id["marian-antiphon-regina-caeli"].entries[0]["entry_id"], "marian-antiphon-regina-caeli")
        self.assertFalse(contracts_by_id["marian-antiphon-angelus"].entries[0]["text_config"]["enabled"])
        self.assertFalse(contracts_by_id["marian-antiphon-regina-caeli"].entries[0]["text_config"]["enabled"])
        self.assertTrue(contracts_by_id["marian-antiphon-angelus"].entries[0]["audio_config"]["enabled"])
        self.assertTrue(contracts_by_id["marian-antiphon-regina-caeli"].entries[0]["audio_config"]["enabled"])
        self.assertTrue(contracts_by_id["morning-prayer-elevenlabs"].entries[0]["text_config"]["enabled"])
        self.assertEqual(contracts_by_id["morning-prayer-elevenlabs"].metadata["title_template"], "Morning Prayer - {date:%B %-d, %Y}")
        self.assertEqual(
            contracts_by_id["morning-prayer-elevenlabs"].metadata["description_template"],
            "Morning Prayer for {date:%B %-d, %Y}. The daily opening block follows the liturgical day and the day's Gospel.",
        )
        self.assertEqual(
            contracts_by_id["morning-prayer-elevenlabs"].entries[0]["audio_config"]["providers"][0]["provider"],
            "elevenlabs",
        )
        self.assertEqual(
            contracts_by_id["morning-prayer-elevenlabs"].entries[0]["audio_config"]["providers"][0]["voice_id"],
            "2NfTQuOn6dRQvgKuC2le",
        )
        self.assertEqual(
            contracts_by_id["morning-prayer-elevenlabs"].entries[0]["audio_config"]["providers"][0]["model_id"],
            "eleven_multilingual_v2",
        )
        self.assertEqual(
            contracts_by_id["morning-prayer-elevenlabs"].entries[0]["audio_config"]["providers"][1]["provider"],
            "openai",
        )
        self.assertFalse(contracts_by_id["rosary"].entries[0]["audio_config"]["enabled"])
        self.assertFalse(contracts_by_id["morning-prayer-elevenlabs"].entries[0]["blocks"][0]["skip_if_missing"])
        self.assertTrue(contracts_by_id["morning-prayer-elevenlabs"].metadata["daily_intro"]["allow_missing_gospel"])
        self.assertNotIn("allow_missing_gospel", contracts_by_id["morning-prayer-elevenlabs"].entries[0]["blocks"][0])

    def test_build_audio_jobs_routes_marian_antiphons_by_season(self):
        contracts = self.mod.load_publish_contracts()
        easter_jobs = self.mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 4, 6))
        ordinary_jobs = self.mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 6, 2))

        self.assertEqual({job["entry_id"] for job in easter_jobs}, {"morning-prayer-elevenlabs", "marian-antiphon-regina-caeli"})
        self.assertEqual({job["entry_id"] for job in ordinary_jobs}, {"morning-prayer-elevenlabs", "marian-antiphon-angelus"})
        easter_marian = next(job for job in easter_jobs if job["entry_id"] == "marian-antiphon-regina-caeli")
        ordinary_marian = next(job for job in ordinary_jobs if job["entry_id"] == "marian-antiphon-angelus")
        self.assertEqual(easter_marian["title"], "Marian Antiphon - Regina Caeli - April 6, 2026")
        self.assertEqual(ordinary_marian["title"], "Marian Antiphon - Angelus - June 2, 2026")
        self.assertEqual(easter_marian["episode_id"], "marian-antiphon-regina-caeli-2026-04-06")
        self.assertEqual(ordinary_marian["episode_id"], "marian-antiphon-angelus-2026-06-02")

    def test_build_text_jobs_uses_metadata_allow_missing_gospel_when_block_omits_it(self):
        contracts = self.mod.load_publish_contracts()
        target_date = datetime.date(2026, 4, 6)

        stderr = io.StringIO()
        with mock.patch.object(self.mod.sys, "stderr", stderr):
            jobs = self.mod.build_text_jobs(contracts, target_date=target_date)

        morning = next(job for job in jobs if job["entry_id"] == "morning-prayer-elevenlabs")
        self.assertIn("Today the Church celebrates", morning["text"])
        self.assertGreaterEqual(len(self.calls), 1)
        self.assertTrue(any(call[1]["allow_missing_gospel"] for call in self.calls))
        self.assertTrue(all(call[1]["allow_missing_gospel"] for call in self.calls))
        self.assertTrue(any(call[1]["calendar"] == "general_roman" for call in self.calls))
        self.assertTrue(any(call[1]["locale"] == "en" for call in self.calls))
        self.assertTrue(any(call[1]["prompt_model"] == "gpt-4.1-mini" for call in self.calls))
        self.assertIn("allow_missing_gospel=true", stderr.getvalue())

    def test_build_text_jobs_allows_explicit_daily_intro_override(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contracts_dir = root / "config" / "publish" / "contracts"
            contracts_dir.mkdir(parents=True, exist_ok=True)

            payload = {
                "contract": {
                    "id": "sample",
                    "type": "daily-prayer",
                    "frequency": "daily",
                    "timezone": "America/Chicago",
                    "version": "1",
                    "metadata": {
                        "daily_intro": {
                            "calendar": "general_roman",
                            "locale": "en",
                            "prompt_model": "gpt-4.1-mini",
                            "allow_missing_gospel": True,
                        }
                    },
                },
                "entries": [
                    {
                        "entry_id": "sample-entry",
                        "date": "daily",
                        "title": "Sample Entry",
                        "status": "approved",
                        "text": "Sample Entry",
                        "blocks": [
                            {
                                "kind": "daily_intro",
                                "title": "Daily Intro",
                                "allow_missing_gospel": False,
                            }
                        ],
                    }
                ],
            }
            (contracts_dir / "sample.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

            with mock.patch.object(self.mod, "ROOT", root):
                contracts = self.mod.load_publish_contracts(contracts_dir)
                stderr = io.StringIO()
                with mock.patch.object(self.mod.sys, "stderr", stderr):
                    jobs = self.mod.build_text_jobs(contracts, target_date=datetime.date(2026, 4, 6))

        self.assertEqual(len(jobs), 1)
        self.assertFalse(contracts[0].entries[0]["blocks"][0]["allow_missing_gospel"])
        self.assertGreaterEqual(len(self.calls), 1)
        self.assertTrue(any(not call[1]["allow_missing_gospel"] for call in self.calls))
        self.assertTrue(all(not call[1]["allow_missing_gospel"] for call in self.calls))
        self.assertIn("allow_missing_gospel=false", stderr.getvalue())
        self.assertIn("Daily Intro", stderr.getvalue())

    def test_build_text_jobs_skips_missing_monthly_template_when_flagged(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contracts_dir = root / "config" / "publish" / "contracts"
            templates_dir = root / "config" / "publish" / "templates" / "sample"
            contracts_dir.mkdir(parents=True, exist_ok=True)
            templates_dir.mkdir(parents=True, exist_ok=True)
            (templates_dir / "opening.txt").write_text("Opening line", encoding="utf-8")
            (templates_dir / "closing.txt").write_text("Closing line", encoding="utf-8")
            (templates_dir / "may.txt").write_text("May line", encoding="utf-8")

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
                        "entry_id": "sample-entry",
                        "date": "daily",
                        "title": "Sample Entry",
                        "status": "approved",
                        "text": "Sample Entry",
                        "blocks": [
                            {
                                "kind": "sequence",
                                "title": "Calendar Sequence",
                                "blocks": [
                                    {"kind": "file", "path": "config/publish/templates/sample/opening.txt"},
                                    {
                                        "kind": "monthly_template",
                                        "folder": "config/publish/templates/sample",
                                        "selector": "current_calendar_month",
                                        "skip_if_missing": True,
                                    },
                                    {"kind": "file", "path": "config/publish/templates/sample/closing.txt"},
                                ],
                            }
                        ],
                    }
                ],
            }
            (contracts_dir / "sample.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

            with mock.patch.object(self.mod, "ROOT", root):
                contracts = self.mod.load_publish_contracts(contracts_dir)
                jobs = self.mod.build_text_jobs(contracts, target_date=datetime.date(2026, 4, 6))

        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["text"], "Opening line\n\nClosing line")
        self.assertEqual([section["title"] for section in jobs[0]["sections"]], ["Calendar Sequence"])
        self.assertNotIn("May line", jobs[0]["text"])

    def test_resolve_text_jobs_uses_weekday_and_month_selectors(self):
        contracts = self.mod.load_publish_contracts()
        target_date = datetime.date(2026, 4, 6)  # Monday in April
        jobs = self.mod.build_text_jobs(contracts, target_date=target_date)

        self.assertEqual(len(jobs), 2)
        morning = next(job for job in jobs if job["entry_id"] == "morning-prayer-elevenlabs")
        rosary = next(job for job in jobs if job["entry_id"] == "rosary")
        self.assertEqual(morning["title"], "Morning Prayer - April 6, 2026")
        self.assertEqual(morning["episode_id"], "morning-prayer-elevenlabs-2026-04-06")
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
        morning_contract = next(contract for contract in contracts if contract.contract_id == "morning-prayer-elevenlabs")
        entry = morning_contract.entries[0]

        fragments = self.mod.expand_audio_fragments(morning_contract, entry, target_date=target_date)

        self.assertEqual(len(fragments), 12)
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
