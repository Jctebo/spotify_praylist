import datetime
import io
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
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
        self.mod.build_liturgical_announcement_text = lambda date_value, **kwargs: (
            f"Today is {date_value.strftime('%A, %B')} {date_value.day}, {date_value.year}. "
            "Today the Church celebrates Saint Example."
        )
        self.mod.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        self.mod.build_rosary_day_context = self._fake_rosary_day_context
        self.mod.build_rosary_intro_text = lambda date_value, mystery_set_title, mysteries, **kwargs: (
            "Today is Monday, April 6, 2026, in the Easter season. "
            "For today's rosary, we will focus on the feast of Saint Example. "
            f"As we pray the {mystery_set_title}, we ask for grace."
        )
        self.mod.build_rosary_reflection_set = self._fake_rosary_reflection_set
        self.mod.build_daily_liturgical_context = self._fake_daily_liturgical_context
        self.mod.build_ignatian_reflection_episode = self._fake_ignatian_reflection_episode

    def _fake_rosary_day_context(self, date_value, mystery_text, **kwargs):
        lines = [line.strip() for line in mystery_text.splitlines() if line.strip()]
        mysteries = []
        for line in lines[1:]:
            number, rest = line.split(".", 1)
            title, fruit = rest.split(" - ", 1)
            mysteries.append(SimpleNamespace(number=int(number), title=title.strip(), fruit=fruit.strip()))
        return SimpleNamespace(
            date=date_value,
            mystery_set_title=lines[0],
            mysteries=tuple(mysteries),
            focus_source="feast",
            focus_title="Saint Example",
            focus_prompt_label="the feast of Saint Example",
            celebration_clause="Saint Example",
            season_label="Easter season",
            feast_names=("Saint Example",),
            gospel_citation="John 10:1-10",
            gospel_text="Jesus calls his sheep by name.",
            calendar="general_roman",
            locale="en",
        )

    def _fake_rosary_reflection_set(self, date_value, mystery_text, **kwargs):
        lines = [line.strip() for line in mystery_text.splitlines() if line.strip()]
        mysteries = []
        for line in lines[1:]:
            number, rest = line.split(".", 1)
            title, fruit = rest.split(" - ", 1)
            mysteries.append(SimpleNamespace(number=int(number), title=title.strip(), fruit=fruit.strip()))
        return SimpleNamespace(
            mystery_set_title=lines[0],
            mysteries=tuple(mysteries),
            reflections=tuple(f"Reflection for {mystery.title}." for mystery in mysteries),
            source="generated_feast",
            day_context=self._fake_rosary_day_context(date_value, mystery_text),
            fallback_reason="",
        )

    def _fake_daily_liturgical_context(self, date_value, **kwargs):
        payload = {
            "date": date_value.isoformat(),
            "liturgicalSeason": "Easter season",
            "liturgicalWeek": "",
            "feastDay": "Saint Example",
            "liturgicalRank": "memorial",
            "saintOfDay": "Saint Example",
            "gospelTheme": "trust",
            "primaryTheme": "trust",
            "secondaryThemes": ["discernment", "resurrection hope"],
            "emotionalTone": "contemplative",
            "reflectionFocus": "Notice where God invites trust through Saint Example.",
            "suggestedImagery": ["steady candlelight"],
            "suggestedMusicMood": "soft and contemplative",
            "openingTone": "peaceful and attentive",
            "closingTone": "peaceful trust",
            "saintIntercessions": ["Saint Example"],
            "shortSummary": "Today's shared focus is trust.",
            "source": "gospel",
            "fallbackReason": "",
            "gospelCitation": "John 10:1-10",
            "calendar": "general_roman",
            "locale": "en",
        }
        return SimpleNamespace(**payload, to_dict=lambda: dict(payload))

    def _fake_ignatian_reflection_episode(self, date_value, context, **kwargs):
        text = (
            "Welcome to Ora Pro Nobis, where we pray with the Saints. Today's shared focus is trust, and the day asks us to notice the quiet ways God meets us. What is the grace already present in this day?\n\n"
            "This day speaks the language of trust. It arrives through a welcome, a delay, or a small mercy you almost missed. Where did trust quietly touch your ordinary life today?\n\n"
            "In the examen, let gratitude come first, then the review, then the places of consolation and desolation. Bring the day honestly before Jesus, and ask what faithful step he is asking of you tonight. What does the Spirit want you to notice before tomorrow arrives?\n\n"
            "Lord Jesus Christ, teach us to find you in the ordinary places of our lives. Give us the grace of trust, the honesty to notice your movements in our hearts, and the courage to follow where you gently lead. Amen.\n"
            "Saint Example, pray for us.\n"
            "And may the peace of Christ remain with you."
        )
        return SimpleNamespace(
            title="Daily Reflection - Trust - April 6, 2026",
            text=text,
            source="fallback",
            fallback_reason="test",
            saint_name="Example",
            word_count=120,
            pause_ms=15000,
            segments=tuple(text.split("\n\n")),
        )

    def assert_standard_loudness_normalization(self, audio_config):
        settings = audio_config.get("loudness_normalization")
        self.assertIsInstance(settings, dict)
        self.assertTrue(settings["enabled"])
        self.assertEqual(settings["integrated_lufs"], -16)
        self.assertEqual(settings["true_peak_db"], -1.5)
        self.assertEqual(settings["lra"], 11)

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
                "auxilium-christianorum",
                "daily-reflection",
                "marian-antiphon-angelus",
                "marian-antiphon-regina-caeli",
                "morning-prayer-elevenlabs",
                "rosary",
            ],
        )
        self.assertEqual([contract.frequency for contract in contracts], ["daily", "daily", "daily", "daily", "daily", "daily"])
        self.assertEqual(contracts_by_id["auxilium-christianorum"].metadata["title_template"], "Auxilium Christianorum - {date_display}")
        self.assertEqual(
            contracts_by_id["daily-reflection"].metadata["title_template"],
            "Daily Reflection - {daily_reflection_primary_theme_title} - {date_display}",
        )
        self.assertEqual(contracts_by_id["daily-reflection"].entries[0]["blocks"][0]["kind"], "ignatian-reflection")
        self.assert_standard_loudness_normalization(contracts_by_id["daily-reflection"].entries[0]["audio_config"])
        self.assertTrue(contracts_by_id["auxilium-christianorum"].entries[0]["text_config"]["enabled"])
        self.assertTrue(contracts_by_id["auxilium-christianorum"].entries[0]["audio_config"]["enabled"])
        self.assertEqual(contracts_by_id["auxilium-christianorum"].entries[0]["blocks"][0]["kind"], "liturgical-announcement")
        self.assertEqual(
            contracts_by_id["auxilium-christianorum"].entries[0]["audio_config"]["providers"][0]["voice_id"],
            "pGAwIQNN9UjOkKxjAyGQ",
        )
        self.assertEqual(
            contracts_by_id["auxilium-christianorum"].entries[0]["audio_config"]["providers"][0]["voice_settings"]["speed"],
            0.98,
        )
        self.assert_standard_loudness_normalization(contracts_by_id["auxilium-christianorum"].entries[0]["audio_config"])
        self.assertEqual(contracts_by_id["marian-antiphon-angelus"].season, "ordinary")
        self.assertEqual(contracts_by_id["marian-antiphon-regina-caeli"].season, "easter")
        for contract_id in (
            "auxilium-christianorum",
            "daily-reflection",
            "marian-antiphon-angelus",
            "marian-antiphon-regina-caeli",
            "morning-prayer-elevenlabs",
            "rosary",
        ):
            website = contracts_by_id[contract_id].metadata.get("website")
            self.assertIsInstance(website, dict)
            self.assertTrue(website["enabled"])
            self.assertIn(website["group"], {"ora-pro-nobis"})
            self.assertTrue(website["slug"])
            self.assertTrue(website["title"])
            self.assertTrue(website["summary"])
            self.assertTrue(website["source_label"])
            self.assertIn(website["availability"], {"daily", "seasonal"})
        self.assertEqual(
            contracts_by_id["marian-antiphon-angelus"].metadata["website"]["prayer_family"],
            "marian-antiphon",
        )
        self.assertEqual(
            contracts_by_id["marian-antiphon-regina-caeli"].metadata["website"]["prayer_family"],
            "marian-antiphon",
        )
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
        self.assert_standard_loudness_normalization(contracts_by_id["marian-antiphon-angelus"].entries[0]["audio_config"])
        self.assert_standard_loudness_normalization(contracts_by_id["marian-antiphon-regina-caeli"].entries[0]["audio_config"])
        self.assertEqual(
            contracts_by_id["marian-antiphon-angelus"].entries[0]["audio_config"]["providers"][0]["voice_id"],
            "2NfTQuOn6dRQvgKuC2le",
        )
        self.assertEqual(
            contracts_by_id["marian-antiphon-regina-caeli"].entries[0]["audio_config"]["providers"][0]["voice_id"],
            "2NfTQuOn6dRQvgKuC2le",
        )
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
        self.assert_standard_loudness_normalization(contracts_by_id["morning-prayer-elevenlabs"].entries[0]["audio_config"])
        self.assertEqual(
            contracts_by_id["morning-prayer-elevenlabs"].entries[0]["audio_config"]["providers"][0]["model_id"],
            "eleven_multilingual_v2",
        )
        self.assertEqual(
            contracts_by_id["morning-prayer-elevenlabs"].entries[0]["audio_config"]["providers"][1]["provider"],
            "openai",
        )
        self.assertEqual(
            contracts_by_id["rosary"].metadata["title_template"],
            "Daily Rosary - {rosary_mystery_set_title} - {rosary_focus_title} - {date_display}",
        )
        self.assertTrue(contracts_by_id["rosary"].entries[0]["audio_config"]["enabled"])
        self.assert_standard_loudness_normalization(contracts_by_id["rosary"].entries[0]["audio_config"])
        self.assertEqual(
            contracts_by_id["rosary"].entries[0]["audio_config"]["providers"][0]["voice_id"],
            "2NfTQuOn6dRQvgKuC2le",
        )
        self.assertFalse(contracts_by_id["morning-prayer-elevenlabs"].entries[0]["blocks"][0]["skip_if_missing"])
        self.assertTrue(contracts_by_id["morning-prayer-elevenlabs"].metadata["daily_intro"]["allow_missing_gospel"])
        self.assertNotIn("allow_missing_gospel", contracts_by_id["morning-prayer-elevenlabs"].entries[0]["blocks"][0])

    def test_all_active_audio_jobs_use_standard_loudness_normalization(self):
        contracts = self.mod.load_publish_contracts()
        target_dates = [
            datetime.date(2026, 4, 6),
            datetime.date(2026, 6, 2),
        ]
        jobs_by_entry_id = {}

        for target_date in target_dates:
            for job in self.mod.build_audio_jobs(contracts, target_date=target_date):
                jobs_by_entry_id[job["entry_id"]] = job

        self.assertEqual(
            set(jobs_by_entry_id),
            {
                "auxilium-christianorum",
                "daily-reflection",
                "morning-prayer-elevenlabs",
                "marian-antiphon-angelus",
                "marian-antiphon-regina-caeli",
                "rosary",
            },
        )
        for entry_id, job in jobs_by_entry_id.items():
            with self.subTest(entry_id=entry_id):
                self.assert_standard_loudness_normalization(job["audio_config"])

    def test_audio_loudness_normalization_can_be_overridden_by_contract(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contracts_dir = root / "config" / "publish" / "contracts"
            templates_dir = root / "config" / "publish" / "templates"
            contracts_dir.mkdir(parents=True, exist_ok=True)
            templates_dir.mkdir(parents=True, exist_ok=True)
            (templates_dir / "sample.txt").write_text("Sample prayer.", encoding="utf-8")
            (contracts_dir / "sample.json").write_text(
                json.dumps(
                    {
                        "contract": {
                            "id": "sample",
                            "type": "daily-prayer",
                            "frequency": "daily",
                            "timezone": "America/Chicago",
                            "version": "1",
                        },
                        "entries": [
                            {
                                "entry_id": "custom-loudness",
                                "date": "daily",
                                "title": "Custom Loudness",
                                "status": "approved",
                                "text": "Custom Loudness",
                                "audio_config": {
                                    "enabled": True,
                                    "loudness_normalization": {
                                        "enabled": True,
                                        "integrated_lufs": -18,
                                        "true_peak_db": -2,
                                        "lra": 9,
                                    },
                                },
                                "blocks": [{"kind": "file", "path": "config/publish/templates/sample.txt"}],
                            },
                            {
                                "entry_id": "disabled-loudness",
                                "date": "daily",
                                "title": "Disabled Loudness",
                                "status": "approved",
                                "text": "Disabled Loudness",
                                "audio_config": {
                                    "enabled": True,
                                    "loudness_normalization": False,
                                },
                                "blocks": [{"kind": "file", "path": "config/publish/templates/sample.txt"}],
                            },
                        ],
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )

            with mock.patch.object(self.mod, "ROOT", root):
                contracts = self.mod.load_publish_contracts(contracts_dir)
                jobs = self.mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 4, 6))

        jobs_by_id = {job["entry_id"]: job for job in jobs}
        custom = jobs_by_id["custom-loudness"]["audio_config"]["loudness_normalization"]
        disabled = jobs_by_id["disabled-loudness"]["audio_config"]["loudness_normalization"]
        self.assertTrue(custom["enabled"])
        self.assertEqual(custom["integrated_lufs"], -18.0)
        self.assertEqual(custom["true_peak_db"], -2.0)
        self.assertEqual(custom["lra"], 9.0)
        self.assertFalse(disabled["enabled"])
        self.assertEqual(disabled["integrated_lufs"], -16.0)

    def test_build_audio_jobs_routes_marian_antiphons_by_season(self):
        contracts = self.mod.load_publish_contracts()
        easter_jobs = self.mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 4, 6))
        ordinary_jobs = self.mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 6, 2))

        self.assertEqual({job["entry_id"] for job in easter_jobs}, {"auxilium-christianorum", "daily-reflection", "morning-prayer-elevenlabs", "marian-antiphon-regina-caeli", "rosary"})
        self.assertEqual({job["entry_id"] for job in ordinary_jobs}, {"auxilium-christianorum", "daily-reflection", "morning-prayer-elevenlabs", "marian-antiphon-angelus", "rosary"})
        easter_marian = next(job for job in easter_jobs if job["entry_id"] == "marian-antiphon-regina-caeli")
        ordinary_marian = next(job for job in ordinary_jobs if job["entry_id"] == "marian-antiphon-angelus")
        self.assertEqual(easter_marian["title"], "Marian Antiphon - Regina Caeli - April 6, 2026")
        self.assertEqual(ordinary_marian["title"], "Marian Antiphon - Angelus - June 2, 2026")
        self.assertEqual(easter_marian["episode_id"], "marian-antiphon-regina-caeli-2026-04-06")
        self.assertEqual(ordinary_marian["episode_id"], "marian-antiphon-angelus-2026-06-02")
        self.assertEqual(easter_marian["audio_fragments"][0]["kind"], "daily-intro")
        self.assertEqual(easter_marian["audio_fragments"][1]["kind"], "prayer-intro")
        self.assertIn("Regina Caeli", easter_marian["audio_fragments"][1]["text"])
        self.assertIn("Saint Example", easter_marian["audio_fragments"][1]["text"])
        self.assertEqual(ordinary_marian["audio_fragments"][0]["kind"], "daily-intro")
        self.assertEqual(ordinary_marian["audio_fragments"][1]["kind"], "prayer-intro")
        self.assertIn("Angelus", ordinary_marian["audio_fragments"][1]["text"])
        self.assertIn("Saint Example", ordinary_marian["audio_fragments"][1]["text"])

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

    def test_prayer_intro_rejects_multi_sentence_template(self):
        contracts = self.mod.load_publish_contracts()
        auxilium_contract = next(contract for contract in contracts if contract.contract_id == "auxilium-christianorum")
        entry = dict(auxilium_contract.entries[0])
        block = {
            "kind": "prayer-intro",
            "title": "Prayer Intro",
            "prayer_title": "Auxilium Christianorum prayers",
            "devotion": "Auxilium Christianorum",
            "template": "First sentence for {day_theme}. Second sentence for {prayer_title}.",
        }

        with self.assertRaisesRegex(RuntimeError, "exactly 1 sentence"):
            self.mod.resolve_block_content(
                block,
                contract=auxilium_contract,
                entry=entry,
                target_date=datetime.date(2026, 4, 6),
            )

    def test_prayer_intro_rejects_unsupported_template_placeholder(self):
        contracts = self.mod.load_publish_contracts()
        auxilium_contract = next(contract for contract in contracts if contract.contract_id == "auxilium-christianorum")
        entry = dict(auxilium_contract.entries[0])
        block = {
            "kind": "prayer-intro",
            "title": "Prayer Intro",
            "prayer_title": "Auxilium Christianorum prayers",
            "devotion": "Auxilium Christianorum",
            "template": "In today's {devotion}, we reflect on {missing_theme}.",
        }

        with self.assertRaisesRegex(RuntimeError, "unsupported placeholder 'missing_theme'"):
            self.mod.resolve_block_content(
                block,
                contract=auxilium_contract,
                entry=entry,
                target_date=datetime.date(2026, 4, 6),
            )

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

        self.assertEqual(len(jobs), 4)
        morning = next(job for job in jobs if job["entry_id"] == "morning-prayer-elevenlabs")
        rosary = next(job for job in jobs if job["entry_id"] == "rosary")
        auxilium = next(job for job in jobs if job["entry_id"] == "auxilium-christianorum")
        daily_reflection = next(job for job in jobs if job["entry_id"] == "daily-reflection")
        self.assertEqual(morning["title"], "Morning Prayer - April 6, 2026")
        self.assertEqual(morning["episode_id"], "morning-prayer-elevenlabs-2026-04-06")
        self.assertIn("Today the Church celebrates", morning["text"])
        self.assertIn("Today is Monday, April 6, 2026", auxilium["text"])
        self.assertIn("Our help is in the name of the Lord.", auxilium["text"])
        self.assertIn("Who made heaven and earth.", auxilium["text"])
        self.assertIn("Thou hast redeemed us with Thy Blood, O Lord.", auxilium["text"])
        self.assertIn("And made of us a kingdom for our God.", auxilium["text"])
        self.assertIn("Amen.", auxilium["text"])
        self.assertNotIn("V.", auxilium["text"])
        self.assertNotIn("R.", auxilium["text"])
        self.assertIn("In Thy name, Lord Jesus Christ", auxilium["text"])
        self.assertNotIn("O Glorious Queen of Heaven and Earth", auxilium["text"])
        self.assertEqual(auxilium["title"], "Auxilium Christianorum - April 6, 2026")
        self.assertEqual(auxilium["episode_id"], "auxilium-christianorum-2026-04-06")
        self.assertEqual(
            [section["title"] for section in auxilium["sections"]],
            ["Liturgical Announcement", "Prayer Intro", "Opening Prayers", "Litany of the Most Precious Blood", "Weekday Prayer", "Conclusion"],
        )
        self.assertIn(
            "As we begin today's Auxilium Christianorum prayers, we place Saint Example under Mary's protection and ask for strength in the spiritual battle.",
            auxilium["text"],
        )
        self.assertEqual(auxilium["resume_markers"][0]["label"], "Liturgical Announcement")
        self.assertEqual(auxilium["resume_markers"][1]["label"], "Prayer Intro")
        self.assertEqual(auxilium["resume_markers"][0]["source"], "text_section")
        self.assertIn("April", morning["text"])
        self.assertIn("Joyful Mysteries", rosary["text"])
        self.assertIn("The First Mystery: The Annunciation", rosary["text"])
        self.assertIn("Reflection for The Annunciation.", rosary["text"])
        self.assertEqual(rosary["title"], "Daily Rosary - Joyful Mysteries - Saint Example - April 6, 2026")
        self.assertEqual(rosary["render_context"]["rosary_mystery_set_title"], "Joyful Mysteries")
        self.assertEqual(rosary["render_context"]["rosary_focus_title"], "Saint Example")
        self.assertEqual(rosary["episode_id"], "daily-rosary-2026-04-06")
        self.assertEqual(daily_reflection["title"], "Daily Reflection - Trust - April 6, 2026")
        self.assertEqual(daily_reflection["episode_id"], "daily-reflection-2026-04-06")
        self.assertEqual(daily_reflection["render_context"]["daily_reflection_primary_theme"], "trust")
        self.assertEqual(daily_reflection["daily_reflection"]["helper"]["primaryTheme"], "trust")
        self.assertEqual(daily_reflection["daily_reflection"]["episode"]["source"], "fallback")
        self.assertIn("Welcome to Ora Pro Nobis", daily_reflection["text"])
        self.assertEqual(
            [section["title"] for section in morning["sections"]],
            ["Daily Intro", "Opening Prayers", "Petitions", "Intercessory Litany"],
        )
        self.assertEqual(
            [section["title"] for section in rosary["sections"]],
            ["Rosary Intro", "Opening Prayers", "Joyful Mysteries", "Closing Prayers"],
        )
        self.assertEqual([section["title"] for section in daily_reflection["sections"]], ["Daily Reflection"])

    def test_daily_reflection_audio_fragment_uses_cached_episode(self):
        contracts = self.mod.load_publish_contracts()
        contract = next(contract for contract in contracts if contract.contract_id == "daily-reflection")

        jobs = self.mod.build_audio_jobs([contract], target_date=datetime.date(2026, 4, 6))

        self.assertEqual(len(jobs), 1)
        job = jobs[0]
        self.assertEqual([fragment["kind"] for fragment in job["audio_fragments"]], ["ignatian-reflection"] * 4)
        self.assertEqual([fragment["label"] for fragment in job["audio_fragments"]], ["Opening Welcome", "Reflection", "Guided Examen", "Closing Prayer"])
        self.assertGreaterEqual(len(job["audio_fragments"]), 4)
        self.assertEqual(job["audio_config"]["silence_ms"], 15000)
        self.assertEqual(job["daily_reflection"]["helper"]["suggestedMusicMood"], "soft and contemplative")
        self.assertEqual(job["render_context"]["daily_reflection_source"], "fallback")

    def test_rosary_audio_fragments_use_cached_standard_prayers(self):
        contracts = self.mod.load_publish_contracts()
        rosary_contract = next(contract for contract in contracts if contract.contract_id == "rosary")

        jobs = self.mod.build_audio_jobs([rosary_contract], target_date=datetime.date(2026, 4, 6))

        self.assertEqual(len(jobs), 1)
        job = jobs[0]
        self.assertEqual(job["title"], "Daily Rosary - Joyful Mysteries - Saint Example - April 6, 2026")
        self.assertEqual(job["episode_id"], "daily-rosary-2026-04-06")
        fragments = job["audio_fragments"]
        self.assertEqual(fragments[0]["kind"], "rosary-intro")
        self.assertEqual(fragments[0]["label"], "Rosary Intro")
        self.assertTrue(any(fragment["kind"] == "rosary-reflection" for fragment in fragments))
        reflection_fragment = next(fragment for fragment in fragments if fragment["kind"] == "rosary-reflection")
        self.assertIn(".\n\nReflection:", reflection_fragment["text"])
        hail_mary_fragments = [fragment for fragment in fragments if fragment["label"] == "Hail Mary"]
        decade_hail_mary_fragments = [fragment for fragment in hail_mary_fragments if "/decade-" in fragment["fragment_key"]]
        our_father_fragments = [fragment for fragment in fragments if fragment["label"] == "Our Father"]
        glory_be_fragments = [fragment for fragment in fragments if fragment["label"] == "Glory Be"]
        fatima_fragments = [fragment for fragment in fragments if fragment["label"] == "Fatima Prayer"]
        self.assertEqual(len(hail_mary_fragments), 53)
        self.assertEqual(len(decade_hail_mary_fragments), 50)
        self.assertEqual(len(our_father_fragments), 6)
        self.assertEqual(len(glory_be_fragments), 6)
        self.assertEqual(len(fatima_fragments), 5)
        self.assertEqual(len({fragment["text"] for fragment in decade_hail_mary_fragments}), 1)
        self.assertEqual(len({fragment["effective_audio_config"]["providers"][0]["provider"] for fragment in decade_hail_mary_fragments}), 1)
        self.assertEqual(len(job["resume_markers"]), len(fragments))

    def test_auxilium_weekday_map_selects_each_weekday_prayer(self):
        contracts = self.mod.load_publish_contracts()
        auxilium_contract = next(contract for contract in contracts if contract.contract_id == "auxilium-christianorum")
        expected = {
            datetime.date(2026, 4, 5): "O Glorious Queen of Heaven and Earth",
            datetime.date(2026, 4, 6): "In Thy name, Lord Jesus Christ",
            datetime.date(2026, 4, 7): "Lord Jesus Christ, we beg Thee",
            datetime.date(2026, 4, 8): "render all spirits impotent",
            datetime.date(2026, 4, 9): "From anxiety, sadness and obsessions",
            datetime.date(2026, 4, 10): "Litany of Humility",
            datetime.date(2026, 4, 11): "O God and Father of our Lord Jesus Christ",
        }

        for target_date, phrase in expected.items():
            with self.subTest(target_date=target_date):
                jobs = self.mod.build_text_jobs([auxilium_contract], target_date=target_date)
                self.assertEqual(len(jobs), 1)
                self.assertIn(phrase, jobs[0]["text"])

    def test_auxilium_audio_fragments_include_resume_markers(self):
        contracts = self.mod.load_publish_contracts()
        auxilium_contract = next(contract for contract in contracts if contract.contract_id == "auxilium-christianorum")

        jobs = self.mod.build_audio_jobs([auxilium_contract], target_date=datetime.date(2026, 4, 6))

        self.assertEqual(len(jobs), 1)
        job = jobs[0]
        self.assertEqual(job["audio_fragments"][0]["kind"], "liturgical-announcement")
        self.assertEqual(job["audio_fragments"][0]["label"], "Liturgical Announcement")
        self.assertEqual(job["audio_fragments"][1]["kind"], "prayer-intro")
        self.assertEqual(job["audio_fragments"][1]["label"], "Prayer Intro")
        self.assertEqual(job["audio_fragments"][1]["fragment_key"], "block-2/prayer-intro")
        self.assertIn("Auxilium Christianorum prayers", job["audio_fragments"][1]["text"])
        self.assertTrue(any("weekday-map-monday" in fragment["fragment_key"] for fragment in job["audio_fragments"]))
        versicle_fragments = [fragment for fragment in job["audio_fragments"] if fragment.get("audio_role") == "versicle"]
        response_fragments = [fragment for fragment in job["audio_fragments"] if fragment.get("audio_role") == "response"]
        self.assertEqual(
            [fragment["text"] for fragment in versicle_fragments],
            [
                "Our help is in the name of the Lord.",
                "Thou hast redeemed us with Thy Blood, O Lord.",
            ],
        )
        self.assertEqual(
            [fragment["text"] for fragment in response_fragments],
            [
                "Who made heaven and earth.",
                "And made of us a kingdom for our God.",
                "Amen.",
            ],
        )
        self.assertTrue(
            all(fragment["effective_audio_config"]["providers"][0]["voice_id"] == "nPczCjzI2devNBz1zQrb" for fragment in versicle_fragments)
        )
        self.assertTrue(
            all(fragment["effective_audio_config"]["providers"][1]["voice"] == "alloy" for fragment in versicle_fragments)
        )
        self.assertTrue(
            all(fragment["effective_audio_config"]["providers"][0]["voice_id"] == "nPczCjzI2devNBz1zQrb" for fragment in response_fragments)
        )
        self.assertTrue(
            all(fragment["effective_audio_config"]["providers"][1]["voice"] == "echo" for fragment in response_fragments)
        )
        self.assertEqual(len(job["resume_markers"]), len(job["audio_fragments"]))
        self.assertEqual(job["resume_markers"][0]["source"], "audio_fragment")
        self.assertEqual(job["resume_markers"][0]["fragment_key"], job["audio_fragments"][0]["fragment_key"])
        self.assertEqual(job["resume_markers"][1]["fragment_key"], job["audio_fragments"][1]["fragment_key"])

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
