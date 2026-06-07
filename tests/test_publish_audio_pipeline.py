import datetime
import json
import os
import shutil
import xml.etree.ElementTree as ET
import tempfile
import unittest
from types import SimpleNamespace
from pathlib import Path

from tests.test_helpers import load_module, make_test_mp3_bytes, temp_env


class TestPublishAudioPipeline(unittest.TestCase):
    def setUp(self):
        import jobs.publish.contracts as package_contracts

        self.contracts_mod = load_module("jobs/publish/contracts.py")
        self.audio_mod = load_module("jobs/publish/audio.py")
        self.rss_mod = load_module("jobs/publish/rss.py")
        self.runner_mod = load_module("jobs/publish/run_audio_pipeline.py")
        self.runner_mod.load_podcast_feed_jobs = lambda *args, **kwargs: []
        stub = lambda date_value, **kwargs: (
            "Today the Church celebrates Saint Example. Praise be to God for his mercy. "
            "In today's Gospel, Jesus calls his sheep by name."
        )
        announcement_stub = lambda date_value, **kwargs: (
            f"Today is {date_value.strftime('%A, %B')} {date_value.day}, {date_value.year}. "
            "Today the Church celebrates Saint Example."
        )
        self.contracts_mod.build_daily_intro_text = stub
        package_contracts.build_daily_intro_text = stub
        self.contracts_mod.build_liturgical_announcement_text = announcement_stub
        package_contracts.build_liturgical_announcement_text = announcement_stub
        self.contracts_mod.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        package_contracts.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        self.contracts_mod.build_rosary_day_context = self._fake_rosary_day_context
        package_contracts.build_rosary_day_context = self._fake_rosary_day_context
        self.contracts_mod.build_rosary_intro_text = self._fake_rosary_intro_text
        package_contracts.build_rosary_intro_text = self._fake_rosary_intro_text
        self.contracts_mod.build_rosary_reflection_set = self._fake_rosary_reflection_set
        package_contracts.build_rosary_reflection_set = self._fake_rosary_reflection_set

    def _fake_rosary_intro_text(self, date_value, mystery_set_title, mysteries, **kwargs):
        return (
            f"Today is {date_value.strftime('%A, %B')} {date_value.day}, {date_value.year}, in the Easter season. "
            "For today's rosary, we will focus on the feast of Saint Example. "
            f"As we pray the {mystery_set_title}, we ask for grace."
        )

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

    def _normalize(self, text):
        return " ".join(str(text or "").split())

    def _fake_renderer(self):
        mp3_bytes = make_test_mp3_bytes()
        calls = {"count": 0}

        def renderer(text, audio_config):
            calls["count"] += 1
            return mp3_bytes

        return renderer, calls

    def test_build_audio_jobs_only_includes_enabled_entries(self):
        contracts = self.contracts_mod.load_publish_contracts()
        jobs = self.audio_mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 4, 6))

        self.assertEqual(len(jobs), 4)
        self.assertEqual({job["entry_id"] for job in jobs}, {"auxilium-christianorum", "morning-prayer-elevenlabs", "marian-antiphon-regina-caeli", "rosary"})
        morning_job = next(job for job in jobs if job["entry_id"] == "morning-prayer-elevenlabs")
        regina_job = next(job for job in jobs if job["entry_id"] == "marian-antiphon-regina-caeli")
        auxilium_job = next(job for job in jobs if job["entry_id"] == "auxilium-christianorum")
        rosary_job = next(job for job in jobs if job["entry_id"] == "rosary")
        self.assertTrue(morning_job["audio_config"]["enabled"])
        self.assertTrue(regina_job["audio_config"]["enabled"])
        self.assertTrue(auxilium_job["audio_config"]["enabled"])
        self.assertTrue(rosary_job["audio_config"]["enabled"])
        self.assertGreater(len(morning_job["audio_fragments"]), 0)
        self.assertGreater(len(regina_job["audio_fragments"]), 0)
        self.assertGreater(len(auxilium_job["audio_fragments"]), 0)
        self.assertGreater(len(rosary_job["audio_fragments"]), 0)
        self.assertEqual(rosary_job["title"], "Daily Rosary - Joyful Mysteries - Saint Example - April 6, 2026")
        self.assertEqual(rosary_job["render_context"]["rosary_reflection_source"], "generated_feast")
        self.assertEqual(rosary_job["render_context"]["rosary_reflection_count"], 5)
        self.assertEqual(rosary_job["rosary_reflections"]["source"], "generated_feast")
        self.assertEqual(rosary_job["rosary_reflections"]["count"], 5)
        self.assertEqual(rosary_job["audio_fragments"][0]["kind"], "rosary-intro")
        self.assertEqual(rosary_job["audio_fragments"][0]["label"], "Rosary Intro")
        self.assertEqual(auxilium_job["resume_markers"][0]["source"], "audio_fragment")

    def test_render_audio_job_skips_when_hash_matches(self):
        contracts = self.contracts_mod.load_publish_contracts()
        jobs = self.audio_mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 4, 6))
        job = next(job for job in jobs if job["entry_id"] == "morning-prayer-elevenlabs")

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            fake_renderer, calls = self._fake_renderer()

            first = self.audio_mod.render_audio_job(job, renderer=fake_renderer, docs_root=docs_root, cache_root=cache_root)
            first_calls = calls["count"]
            second = self.audio_mod.render_audio_job(job, renderer=fake_renderer, docs_root=docs_root, cache_root=cache_root)

            self.assertTrue(first["rendered"])
            self.assertFalse(second["rendered"])
            self.assertEqual(calls["count"], first_calls)
            self.assertTrue(Path(first["audio_path"]).exists())
            sidecar_path = Path(first["audio_path"]).with_suffix(".json")
            self.assertTrue(sidecar_path.exists())
            sidecar = json.loads(sidecar_path.read_text(encoding="utf-8"))
            self.assertEqual(sidecar["resume_markers"][0]["source"], "audio_fragment")
            self.assertEqual(sidecar["resume_markers"][0]["fragment_key"], first["audio_fragments"][0]["fragment_key"])
            self.assertEqual(sidecar["audio_branding"]["status"], "applied")
            self.assertEqual(sidecar["audio_branding"]["season"], "easter")
            self.assertIn("Easter Podcast.mp3", sidecar["audio_branding"]["season_asset"])
            self.assertGreater(Path(first["audio_path"]).stat().st_size, 0)
            self.assertEqual(first["rss_guid"], second["rss_guid"])

    def test_render_audio_job_normalizes_final_episode_when_configured(self):
        job = {
            "entry_id": "normalize-test",
            "episode_id": "normalize-test-2026-04-06",
            "contract_id": "test-contract",
            "title": "Normalize Test",
            "description": "Normalize Test",
            "date": "daily",
            "published_date": "2026-04-06",
            "text": "Normalize Test",
            "audio_config": {
                "enabled": True,
                "model": "gpt-4o-mini-tts",
                "voice": "alloy",
                "format": "mp3",
                "speed": 1.0,
                "loudness_normalization": {
                    "enabled": True,
                    "integrated_lufs": -16,
                    "true_peak_db": -1.5,
                    "lra": 11,
                },
            },
            "audio_fragments": [
                {
                    "fragment_key": "block-1/inline",
                    "block_path": "block-1/inline",
                    "kind": "inline",
                    "label": "Normalize Fragment",
                    "text": "Normalize this fragment.",
                }
            ],
        }
        fake_renderer, _ = self._fake_renderer()

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            rendered = self.audio_mod.render_audio_job(job, renderer=fake_renderer, docs_root=docs_root, cache_root=cache_root)
            sidecar = json.loads(Path(rendered["audio_path"]).with_suffix(".json").read_text(encoding="utf-8"))
            self.assertGreater(Path(rendered["audio_path"]).stat().st_size, 0)

        self.assertTrue(rendered["loudness_normalization"]["enabled"])
        self.assertEqual(rendered["loudness_normalization"]["integrated_lufs"], -16.0)
        self.assertTrue(sidecar["loudness_normalization"]["enabled"])
        self.assertEqual(sidecar["loudness_normalization"]["true_peak_db"], -1.5)

    def test_render_auxilium_sidecar_records_response_roles(self):
        contracts = self.contracts_mod.load_publish_contracts()
        jobs = self.audio_mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 4, 6))
        job = next(job for job in jobs if job["entry_id"] == "auxilium-christianorum")
        fake_renderer, _ = self._fake_renderer()

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            rendered = self.audio_mod.render_audio_job(job, renderer=fake_renderer, docs_root=docs_root, cache_root=cache_root)
            sidecar_path = Path(rendered["audio_path"]).with_suffix(".json")
            sidecar = json.loads(sidecar_path.read_text(encoding="utf-8"))

        response_fragments = [fragment for fragment in sidecar["fragments"] if fragment.get("audio_role") == "response"]
        self.assertEqual(
            [fragment["text"] for fragment in response_fragments],
            [
                "Who made heaven and earth.",
                "And made of us a kingdom for our God.",
                "Amen.",
            ],
        )
        self.assertTrue(all(fragment["tts"]["voice_id"] == "nPczCjzI2devNBz1zQrb" for fragment in response_fragments))
        self.assertTrue(all(fragment["tts"]["provider"] == "elevenlabs" for fragment in response_fragments))

    def test_render_rosary_sidecar_records_reflection_metadata(self):
        contracts = self.contracts_mod.load_publish_contracts()
        jobs = self.audio_mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 4, 6))
        job = next(job for job in jobs if job["entry_id"] == "rosary")
        fake_renderer, _ = self._fake_renderer()

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            rendered = self.audio_mod.render_audio_job(job, renderer=fake_renderer, docs_root=docs_root, cache_root=cache_root)
            sidecar_path = Path(rendered["audio_path"]).with_suffix(".json")
            sidecar = json.loads(sidecar_path.read_text(encoding="utf-8"))

        self.assertEqual(sidecar["render_context"]["rosary_reflection_source"], "generated_feast")
        self.assertEqual(sidecar["render_context"]["rosary_reflection_count"], 5)
        self.assertEqual(sidecar["rosary_reflections"]["source"], "generated_feast")
        self.assertEqual(sidecar["rosary_reflections"]["count"], 5)

    def test_render_audio_job_force_rebuild_ignores_existing_cache(self):
        contracts = self.contracts_mod.load_publish_contracts()
        jobs = self.audio_mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 4, 6))
        job = next(job for job in jobs if job["entry_id"] == "morning-prayer-elevenlabs")

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            fake_renderer, calls = self._fake_renderer()

            with temp_env({"PUBLISH_AUDIO_FORCE_REBUILD": "true"}):
                first = self.audio_mod.render_audio_job(job, renderer=fake_renderer, docs_root=docs_root, cache_root=cache_root)
                second = self.audio_mod.render_audio_job(job, renderer=fake_renderer, docs_root=docs_root, cache_root=cache_root)

            self.assertTrue(first["rendered"])
            self.assertTrue(second["rendered"])
            self.assertEqual(calls["count"], (len(job["audio_fragments"]) + 1) * 2)
            self.assertTrue(Path(first["audio_path"]).exists())
            self.assertTrue(Path(second["audio_path"]).exists())
            self.assertEqual(first["rss_guid"], second["rss_guid"])

    def test_render_audio_job_changes_guid_when_content_revision_changes(self):
        contracts = self.contracts_mod.load_publish_contracts()
        jobs = self.audio_mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 4, 6))
        job = next(job for job in jobs if job["entry_id"] == "morning-prayer-elevenlabs")

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            fake_renderer, _ = self._fake_renderer()

            first = self.audio_mod.render_audio_job(job, renderer=fake_renderer, docs_root=docs_root, cache_root=cache_root)
            revised_job = dict(job)
            revised_job["content_hash"] = f"{job['content_hash']}-revision"
            second = self.audio_mod.render_audio_job(revised_job, renderer=fake_renderer, docs_root=docs_root, cache_root=cache_root)

            self.assertNotEqual(first["rss_guid"], second["rss_guid"])
            self.assertTrue(second["rss_guid"].startswith("morning-prayer-elevenlabs-2026-04-06::"))

    def test_build_rss_feed_contains_enclosure_and_guid(self):
        contracts = self.contracts_mod.load_publish_contracts()
        jobs = self.audio_mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 4, 6))
        job = next(job for job in jobs if job["entry_id"] == "morning-prayer-elevenlabs")

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            fake_renderer, _ = self._fake_renderer()

            rendered = self.audio_mod.render_audio_job(job, renderer=fake_renderer, docs_root=docs_root, cache_root=cache_root)
            feed_xml = self.rss_mod.build_rss_feed([rendered], base_url=self.audio_mod.github_pages_base_url())
            root = ET.fromstring(feed_xml)
            item = root.find("./channel/item")
        self.assertIsNotNone(item)
        self.assertEqual(item.findtext("guid"), rendered["rss_guid"])
        self.assertTrue((item.findtext("guid") or "").startswith("morning-prayer-elevenlabs-2026-04-06::"))
        enclosure = item.find("enclosure")
        self.assertIsNotNone(enclosure)
        self.assertTrue(enclosure.get("url", "").endswith("/audio/morning-prayer-elevenlabs-2026-04-06.mp3"))
        self.assertIn("Morning Prayer - April 6, 2026", item.findtext("title") or "")
        self.assertIn("Morning Prayer for April 6, 2026", item.findtext("description") or "")
        self.assertEqual(root.findtext("./channel/title"), "Ora Pro Nobis")
        self.assertEqual(
            self._normalize(root.findtext("./channel/description")),
            self._normalize(
                "Ora Pro Nobis is a daily Catholic prayer podcast rooted in the life and tradition of the Church. "
                "Each episode offers a simple, structured time of prayer, featuring traditional Catholic prayers, guided novenas to the saints, and reflections drawn from Scripture and the liturgical calendar. "
                "Whether you are beginning your morning, commuting, or setting aside quiet time, Ora Pro Nobis helps you enter into a consistent rhythm of prayer. Through the Communion of Saints and the rich devotional life of the Church, this podcast invites you to deepen your faith, grow in discipline, and remain attentive to God throughout the day. "
                "Pray with the Church. Walk with the saints. Ora pro nobis - pray for us."
            ),
        )
        self.assertEqual(root.findtext("./channel/author"), "john.thibeaux@gmail.com (John Thibeaux)")
        self.assertEqual(root.findtext("./channel/image/url"), "https://jctebo.github.io/spotify_praylist/images/logo_ora_pro_nobis.png")
        self.assertEqual(root.findtext("./channel/{http://www.itunes.com/dtds/podcast-1.0.dtd}author"), "John Thibeaux")
        self.assertEqual(
            self._normalize(root.findtext("./channel/{http://www.itunes.com/dtds/podcast-1.0.dtd}summary")),
            self._normalize(
                "Daily Catholic prayer podcast featuring traditional prayers, guided novenas, and reflections rooted in Scripture and the Communion of Saints. "
                "Pray with the Church and walk with the saints - Ora pro nobis."
            ),
        )
        owner_email = root.find("./channel/{http://www.itunes.com/dtds/podcast-1.0.dtd}owner/{http://www.itunes.com/dtds/podcast-1.0.dtd}email")
        self.assertIsNotNone(owner_email)
        self.assertEqual(owner_email.text, "john.thibeaux@gmail.com")

    def test_run_audio_pipeline_writes_feed(self):
        contracts = self.contracts_mod.load_publish_contracts()
        fake_renderer, _ = self._fake_renderer()
        current_target_date = datetime.date(2026, 4, 7)
        expected_date = datetime.date.today() + datetime.timedelta(days=1)

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            self.runner_mod.load_publish_contracts = lambda contract_dir=None: contracts
            self.runner_mod.build_audio_jobs = lambda contracts, target_date=None: self.audio_mod.build_audio_jobs(
                contracts, target_date=target_date or expected_date
            )
            result = self.runner_mod.run_audio_pipeline(docs_root=docs_root, renderer=fake_renderer, cache_root=cache_root)
            feed_root = ET.fromstring((docs_root / "podcast.xml").read_text(encoding="utf-8"))
            titles = [item.findtext("title") or "" for item in feed_root.findall("./channel/item")]

            self.assertEqual(result["jobs"], 4)
            self.assertEqual(result["rendered"], 4)
            self.assertEqual(result["archived"], 0)
            self.assertTrue((docs_root / "podcast.xml").exists())
            self.assertTrue((docs_root / "audio" / f"auxilium-christianorum-{expected_date.isoformat()}.mp3").exists())
            self.assertTrue((docs_root / "audio" / f"morning-prayer-elevenlabs-{expected_date.isoformat()}.mp3").exists())
            self.assertTrue((docs_root / "audio" / f"daily-rosary-{expected_date.isoformat()}.mp3").exists())
            self.assertTrue(any(title.startswith("Auxilium Christianorum - ") for title in titles))
            self.assertTrue(any(title.startswith("Morning Prayer - ") for title in titles))
            self.assertTrue(any(title.startswith("Daily Rosary - ") for title in titles))
            self.assertTrue(
                any(
                    title.startswith("Marian Antiphon - Angelus - ")
                    or title.startswith("Marian Antiphon - Regina Caeli - ")
                    for title in titles
                )
            )
            self.assertTrue((docs_root / "images" / "logo_ora_pro_nobis.png").exists())

    def test_run_audio_pipeline_uses_local_archive_snapshot(self):
        contracts = self.contracts_mod.load_publish_contracts()
        fake_renderer, _ = self._fake_renderer()
        captured = {}

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            self.runner_mod.load_publish_contracts = lambda contract_dir=None: contracts

            def fake_load_published_audio_jobs(**kwargs):
                captured["kwargs"] = dict(kwargs)
                return []

            self.runner_mod.load_published_audio_jobs = fake_load_published_audio_jobs
            result = self.runner_mod.run_audio_pipeline(docs_root=docs_root, renderer=fake_renderer, cache_root=cache_root)

        self.assertEqual(result["jobs"], 4)
        self.assertEqual(result["archived"], 0)
        self.assertEqual(Path(captured["kwargs"]["docs_root"]).name, "docs")
        self.assertIn("github.io", str(captured["kwargs"]["base_url"]))

    def test_run_audio_pipeline_rebuilds_feed_from_local_archive_snapshot(self):
        contracts = self.contracts_mod.load_publish_contracts()
        fake_renderer, _ = self._fake_renderer()
        archived_episode_id = "morning-prayer-elevenlabs-2026-04-06"
        current_target_date = datetime.date(2026, 4, 7)

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            audio_dir = docs_root / "audio"
            audio_dir.mkdir(parents=True, exist_ok=True)
            archive_sidecar = audio_dir / f"{archived_episode_id}.json"
            archive_sidecar.write_text(
                json.dumps(
                    {
                        "entry_id": "morning-prayer-elevenlabs",
                        "episode_id": archived_episode_id,
                        "title": "Morning Prayer",
                        "description": "Archived morning prayer episode.",
                        "published_date": "2026-04-06",
                        "generated_at": "2026-04-06T06:00:00+00:00",
                        "rss_guid": f"{archived_episode_id}::revision-a",
                        "content_hash": "archive-hash",
                        "audio_path": str(audio_dir / f"{archived_episode_id}.mp3"),
                        "audio_length": 1234,
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            (audio_dir / f"{archived_episode_id}.mp3").write_bytes(make_test_mp3_bytes())
            cache_root = Path(tmpdir) / ".cache"
            self.runner_mod.load_publish_contracts = lambda contract_dir=None: contracts

            result = self.runner_mod.run_audio_pipeline(
                docs_root=docs_root,
                renderer=fake_renderer,
                cache_root=cache_root,
                target_date=current_target_date,
            )

            feed_root = ET.fromstring((docs_root / "podcast.xml").read_text(encoding="utf-8"))
            guids = [item.findtext("guid") or "" for item in feed_root.findall("./channel/item")]
            archive_manifest = json.loads((audio_dir / "index.json").read_text(encoding="utf-8"))
            archive_html = (audio_dir / "index.html").read_text(encoding="utf-8")

        self.assertEqual(result["jobs"], 4)
        self.assertEqual(result["rendered"], 4)
        self.assertEqual(result["archived"], 1)
        self.assertTrue(any(guid.startswith(f"auxilium-christianorum-{current_target_date.isoformat()}::") for guid in guids))
        self.assertTrue(any(guid.startswith(f"morning-prayer-elevenlabs-{current_target_date.isoformat()}::") for guid in guids))
        self.assertTrue(any(guid.startswith(f"marian-antiphon-regina-caeli-{current_target_date.isoformat()}::") for guid in guids))
        self.assertTrue(any(guid.startswith(f"daily-rosary-{current_target_date.isoformat()}::") for guid in guids))
        self.assertTrue(any(guid.startswith(f"{archived_episode_id}::") for guid in guids))
        self.assertEqual(len(guids), 5)
        self.assertEqual(archive_manifest["count"], 5)
        self.assertIn("Published audio archive", archive_html)
        self.assertIn(f"{archived_episode_id}.mp3", archive_html)

    def test_run_audio_pipeline_targets_next_day_by_default(self):
        contracts = self.contracts_mod.load_publish_contracts()
        fake_renderer, _ = self._fake_renderer()

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            captured = {"target_date": None}

            self.runner_mod.load_publish_contracts = lambda contract_dir=None: contracts

            def fake_build_audio_jobs(contracts, target_date=None):
                captured["target_date"] = target_date
                return self.audio_mod.build_audio_jobs(contracts, target_date=target_date)

            self.runner_mod.build_audio_jobs = fake_build_audio_jobs
            self.runner_mod.run_audio_pipeline(docs_root=docs_root, renderer=fake_renderer, cache_root=cache_root)

            self.assertEqual(captured["target_date"], datetime.date.today() + datetime.timedelta(days=1))

    def test_main_reset_mode_targets_today_and_tomorrow(self):
        contracts = self.contracts_mod.load_publish_contracts()
        captured = {"target_dates": None}

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            self.runner_mod.load_publish_contracts = lambda contract_dir=None: contracts

            def fake_run_audio_pipeline(**kwargs):
                captured["target_dates"] = list(kwargs.get("target_dates") or [])
                return {
                    "contracts": 1,
                    "jobs": len(captured["target_dates"]),
                    "rendered": len(captured["target_dates"]),
                    "archived": 0,
                    "feed_path": str(docs_root / "podcast.xml"),
                    "cover_art_path": str(docs_root / "images" / "logo_ora_pro_nobis.png"),
                    "rendered_jobs": [],
                }

            self.runner_mod.run_audio_pipeline = fake_run_audio_pipeline
            original_mode = os.environ.get("PUBLISH_MODE")
            os.environ["PUBLISH_MODE"] = "reset"
            try:
                rc = self.runner_mod.main()
            finally:
                if original_mode is None:
                    os.environ.pop("PUBLISH_MODE", None)
                else:
                    os.environ["PUBLISH_MODE"] = original_mode

        self.assertEqual(rc, 0)
        today = datetime.date.today()
        self.assertEqual(captured["target_dates"], [today, today + datetime.timedelta(days=1)])

    def test_main_bootstrap_no_cache_mode_targets_today_and_tomorrow(self):
        contracts = self.contracts_mod.load_publish_contracts()
        captured = {"target_dates": None, "force_rebuild": None}

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            self.runner_mod.load_publish_contracts = lambda contract_dir=None: contracts

            def fake_run_audio_pipeline(**kwargs):
                captured["target_dates"] = list(kwargs.get("target_dates") or [])
                captured["force_rebuild"] = os.environ.get("PUBLISH_AUDIO_FORCE_REBUILD")
                return {
                    "contracts": 1,
                    "jobs": len(captured["target_dates"]),
                    "rendered": len(captured["target_dates"]),
                    "archived": 0,
                    "feed_path": str(docs_root / "podcast.xml"),
                    "cover_art_path": str(docs_root / "images" / "logo_ora_pro_nobis.png"),
                    "rendered_jobs": [],
                }

            self.runner_mod.run_audio_pipeline = fake_run_audio_pipeline
            original_mode = os.environ.get("PUBLISH_MODE")
            original_force = os.environ.get("PUBLISH_AUDIO_FORCE_REBUILD")
            os.environ["PUBLISH_MODE"] = "bootstrap-no-cache"
            os.environ.pop("PUBLISH_AUDIO_FORCE_REBUILD", None)
            try:
                rc = self.runner_mod.main()
            finally:
                if original_mode is None:
                    os.environ.pop("PUBLISH_MODE", None)
                else:
                    os.environ["PUBLISH_MODE"] = original_mode
                if original_force is None:
                    os.environ.pop("PUBLISH_AUDIO_FORCE_REBUILD", None)
                else:
                    os.environ["PUBLISH_AUDIO_FORCE_REBUILD"] = original_force

        self.assertEqual(rc, 0)
        today = datetime.date.today()
        self.assertEqual(captured["target_dates"], [today, today + datetime.timedelta(days=1)])
        self.assertEqual(captured["force_rebuild"], "true")

    def test_publish_audio_workflow_dispatch_defaults_to_daily(self):
        workflow_text = Path(".github/workflows/publish_audio.yml").read_text(encoding="utf-8")

        self.assertIn("default: daily", workflow_text)
        self.assertIn("Manual runs default to daily.", workflow_text)
        self.assertNotIn("default: reset", workflow_text)
        self.assertIn("bootstrap-no-cache", workflow_text)

    def test_publish_audio_workflow_restores_and_saves_fragment_cache(self):
        workflow_text = Path(".github/workflows/publish_audio.yml").read_text(encoding="utf-8")

        self.assertIn("Restore publish audio cache", workflow_text)
        self.assertIn("Save publish audio cache", workflow_text)
        self.assertIn("actions/cache/restore@v4", workflow_text)
        self.assertIn("actions/cache/save@v4", workflow_text)
        self.assertIn(".cache/publish_audio/fragments", workflow_text)
        self.assertIn(".cache/publish_audio/silence", workflow_text)
        self.assertIn("restore-keys: |", workflow_text)
        self.assertIn("publish-audio-${{ runner.os }}-py311-fragments-v1-", workflow_text)
        self.assertIn("publish-audio-${{ runner.os }}-py311-fragments-v1-${{ github.run_id }}-${{ hashFiles('requirements.txt') }}", workflow_text)
        self.assertIn("publish-audio-${{ runner.os }}-py311-fragments-v1-${{ hashFiles('requirements.txt') }}", workflow_text)

    def test_publish_audio_workflow_restores_and_saves_podcast_archive(self):
        workflow_text = Path(".github/workflows/publish_audio.yml").read_text(encoding="utf-8")

        self.assertIn("Restore published audio archive", workflow_text)
        self.assertIn("Save published audio archive", workflow_text)
        self.assertIn("docs/audio", workflow_text)
        self.assertIn("publish-audio-archive-${{ runner.os }}-v1-", workflow_text)

    def test_publish_audio_workflow_exports_elevenlabs_secret(self):
        workflow_text = Path(".github/workflows/publish_audio.yml").read_text(encoding="utf-8")

        self.assertIn("ELEVENLABS_API_KEY: ${{ secrets.ELEVENLABS_API_KEY }}", workflow_text)
        self.assertIn("PUBLISH_AUDIO_FORCE_REBUILD: ${{ github.event.inputs.novena_publish_mode == 'bootstrap-no-cache' }}", workflow_text)

    def test_daily_devotional_image_workflow_rebuilds_podcast_feed_from_archive(self):
        workflow_text = Path(".github/workflows/daily_devotional_image_remote.yml").read_text(encoding="utf-8")

        self.assertIn("Rebuilt podcast.xml from", workflow_text)
        self.assertIn("from jobs.publish.audio import (", workflow_text)
        self.assertIn("load_published_audio_jobs,", workflow_text)
        self.assertIn("refusing to publish a blank podcast feed", workflow_text)
        self.assertIn("podcast_cover_art_public_url", workflow_text)

    def test_run_audio_pipeline_can_render_today_and_tomorrow_together(self):
        contracts = self.contracts_mod.load_publish_contracts()
        fake_renderer, _ = self._fake_renderer()
        today = datetime.date(2026, 6, 2)
        tomorrow = today + datetime.timedelta(days=1)

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            self.runner_mod.load_publish_contracts = lambda contract_dir=None: contracts

            result = self.runner_mod.run_audio_pipeline(
                docs_root=docs_root,
                renderer=fake_renderer,
                cache_root=cache_root,
                target_dates=[today, tomorrow],
            )

            root = ET.fromstring((docs_root / "podcast.xml").read_text(encoding="utf-8"))
            guids = [item.findtext("guid") or "" for item in root.findall("./channel/item")]

            self.assertEqual(result["jobs"], 8)
            self.assertEqual(result["rendered"], 8)
            self.assertTrue(any(guid.startswith(f"auxilium-christianorum-{today.isoformat()}::") for guid in guids))
            self.assertTrue(any(guid.startswith(f"morning-prayer-elevenlabs-{today.isoformat()}::") for guid in guids))
            self.assertTrue(any(guid.startswith(f"marian-antiphon-angelus-{today.isoformat()}::") for guid in guids))
            self.assertTrue(any(guid.startswith(f"daily-rosary-{today.isoformat()}::") for guid in guids))
            self.assertTrue(any(guid.startswith(f"auxilium-christianorum-{tomorrow.isoformat()}::") for guid in guids))
            self.assertTrue(any(guid.startswith(f"morning-prayer-elevenlabs-{tomorrow.isoformat()}::") for guid in guids))
            self.assertTrue(any(guid.startswith(f"marian-antiphon-angelus-{tomorrow.isoformat()}::") for guid in guids))
            self.assertTrue(any(guid.startswith(f"daily-rosary-{tomorrow.isoformat()}::") for guid in guids))

    def test_run_audio_pipeline_rebuilds_feed_from_local_archive_only(self):
        contracts = self.contracts_mod.load_publish_contracts()
        fake_renderer, _ = self._fake_renderer()
        current_target_date = datetime.date(2026, 4, 7)

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            audio_dir = docs_root / "audio"
            audio_dir.mkdir(parents=True, exist_ok=True)
            archived_episode_id = "morning-prayer-elevenlabs-2026-04-06"
            (audio_dir / f"{archived_episode_id}.json").write_text(
                json.dumps(
                    {
                        "entry_id": "morning-prayer-elevenlabs",
                        "episode_id": archived_episode_id,
                        "title": "Morning Prayer",
                        "description": "Morning prayer episode.",
                        "published_date": "2026-04-06",
                        "generated_at": "2026-04-06T06:00:00+00:00",
                        "rss_guid": f"{archived_episode_id}::revision-a",
                        "content_hash": "archive-hash",
                        "audio_path": str(audio_dir / f"{archived_episode_id}.mp3"),
                        "audio_length": 1234,
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            (audio_dir / f"{archived_episode_id}.mp3").write_bytes(make_test_mp3_bytes())
            self.runner_mod.load_publish_contracts = lambda contract_dir=None: contracts
            result = self.runner_mod.run_audio_pipeline(
                docs_root=docs_root,
                renderer=fake_renderer,
                cache_root=cache_root,
                target_date=current_target_date,
            )

            root = ET.fromstring((docs_root / "podcast.xml").read_text(encoding="utf-8"))
            guids = [item.findtext("guid") or "" for item in root.findall("./channel/item")]

        self.assertEqual(result["jobs"], 4)
        self.assertEqual(result["archived"], 1)
        self.assertEqual(len(guids), 5)
        self.assertTrue(any(guid.startswith(f"auxilium-christianorum-{current_target_date.isoformat()}::") for guid in guids))
        self.assertTrue(any(guid.startswith(f"morning-prayer-elevenlabs-{current_target_date.isoformat()}::") for guid in guids))
        self.assertTrue(any(guid.startswith(f"marian-antiphon-regina-caeli-{current_target_date.isoformat()}::") for guid in guids))
        self.assertTrue(any(guid.startswith(f"daily-rosary-{current_target_date.isoformat()}::") for guid in guids))
        self.assertTrue(any(guid.startswith(f"{archived_episode_id}::") for guid in guids))

    def test_load_published_audio_jobs_skips_sidecars_without_audio_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            audio_dir = docs_root / "audio"
            audio_dir.mkdir(parents=True, exist_ok=True)
            (audio_dir / "morning-prayer-elevenlabs-2026-04-06.json").write_text(
                json.dumps(
                    {
                        "entry_id": "morning-prayer-elevenlabs",
                        "episode_id": "morning-prayer-elevenlabs-2026-04-06",
                        "title": "Morning Prayer",
                        "description": "Morning prayer episode.",
                        "audio_path": str(audio_dir / "morning-prayer-elevenlabs-2026-04-06.mp3"),
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )

            jobs = self.audio_mod.load_published_audio_jobs(docs_root=docs_root)

        self.assertEqual(len(jobs), 0)

    def test_load_published_audio_jobs_recovers_date_from_episode_suffix_with_audio_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            audio_dir = docs_root / "audio"
            audio_dir.mkdir(parents=True, exist_ok=True)
            (audio_dir / "morning-prayer-elevenlabs-2026-04-06.json").write_text(
                json.dumps(
                    {
                        "entry_id": "morning-prayer-elevenlabs",
                        "episode_id": "morning-prayer-elevenlabs-2026-04-06",
                        "title": "Morning Prayer",
                        "description": "Morning prayer episode.",
                        "audio_path": "/tmp/old-workspace/docs/audio/morning-prayer-elevenlabs-2026-04-06.mp3",
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            (audio_dir / "morning-prayer-elevenlabs-2026-04-06.mp3").write_bytes(make_test_mp3_bytes())

            jobs = self.audio_mod.load_published_audio_jobs(docs_root=docs_root)

        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["episode_id"], "morning-prayer-elevenlabs-2026-04-06")
        self.assertEqual(jobs[0]["published_date"], "2026-04-06")
        self.assertGreater(jobs[0]["audio_length"], 0)

    def test_load_published_audio_jobs_recovers_length_from_sidecar(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            audio_dir = docs_root / "audio"
            audio_dir.mkdir(parents=True, exist_ok=True)
            (audio_dir / "morning-prayer-elevenlabs-2026-04-06.json").write_text(
                json.dumps(
                    {
                        "entry_id": "morning-prayer-elevenlabs",
                        "episode_id": "morning-prayer-elevenlabs-2026-04-06",
                        "title": "Morning Prayer",
                        "description": "Morning prayer episode.",
                        "audio_path": str(audio_dir / "morning-prayer-elevenlabs-2026-04-06.mp3"),
                        "audio_length": 1234,
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            (audio_dir / "morning-prayer-elevenlabs-2026-04-06.mp3").write_bytes(make_test_mp3_bytes())

            jobs = self.audio_mod.load_published_audio_jobs(docs_root=docs_root)

        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["audio_length"], 1234)

    def test_write_audio_archive_index_writes_manifest_and_listing(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            audio_dir = docs_root / "audio"
            audio_dir.mkdir(parents=True, exist_ok=True)
            sidecar_path = audio_dir / "morning-prayer-elevenlabs-2026-04-06.json"
            sidecar_path.write_text(
                json.dumps(
                    {
                        "entry_id": "morning-prayer-elevenlabs",
                        "episode_id": "morning-prayer-elevenlabs-2026-04-06",
                        "title": "Morning Prayer",
                        "description": "Morning prayer episode.",
                        "published_date": "2026-04-06",
                        "generated_at": "2026-04-06T06:00:00+00:00",
                        "rss_guid": "morning-prayer-elevenlabs-2026-04-06::revision-a",
                        "content_hash": "archive-hash",
                        "audio_path": str(audio_dir / "morning-prayer-elevenlabs-2026-04-06.mp3"),
                        "audio_length": 1234,
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            (audio_dir / "morning-prayer-elevenlabs-2026-04-06.mp3").write_bytes(make_test_mp3_bytes())

            result = self.audio_mod.write_audio_archive_index(docs_root=docs_root, base_url="https://example.com")
            manifest = json.loads((audio_dir / "index.json").read_text(encoding="utf-8"))
            archive_html = (audio_dir / "index.html").read_text(encoding="utf-8")

        self.assertEqual(result["archive_items"], 1)
        self.assertEqual(manifest["count"], 1)
        self.assertEqual(manifest["items"][0]["episode_id"], "morning-prayer-elevenlabs-2026-04-06")
        self.assertIn("Published audio archive", archive_html)
        self.assertIn("morning-prayer-elevenlabs-2026-04-06.mp3", archive_html)
        self.assertIn("morning-prayer-elevenlabs-2026-04-06.json", archive_html)
        self.assertIn("https://example.com/audio/morning-prayer-elevenlabs-2026-04-06.json", archive_html)

    def test_load_podcast_feed_jobs_recovers_date_from_episode_suffix_without_audio_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            docs_root.mkdir(parents=True, exist_ok=True)
            feed_path = docs_root / "podcast.xml"
            feed_root = ET.Element("rss", version="2.0")
            channel = ET.SubElement(feed_root, "channel")
            ET.SubElement(channel, "title").text = "Ora Pro Nobis"
            item = ET.SubElement(channel, "item")
            ET.SubElement(item, "title").text = "Morning Prayer"
            ET.SubElement(item, "guid", isPermaLink="false").text = "morning-prayer-elevenlabs-2026-04-06::revision-a"
            ET.SubElement(item, "link").text = "https://example.com/audio/morning-prayer-elevenlabs-2026-04-06.mp3"
            ET.SubElement(item, "description").text = "Morning prayer episode."
            ET.SubElement(item, "enclosure", url="https://example.com/audio/morning-prayer-elevenlabs-2026-04-06.mp3", length="1234", type="audio/mpeg")
            ET.ElementTree(feed_root).write(feed_path, encoding="utf-8", xml_declaration=True)

            jobs = self.rss_mod.load_podcast_feed_jobs(feed_path)

        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["episode_id"], "morning-prayer-elevenlabs-2026-04-06")
        self.assertEqual(jobs[0]["rss_guid"], "morning-prayer-elevenlabs-2026-04-06::revision-a")
        self.assertEqual(jobs[0]["published_date"], "2026-04-06")
        self.assertEqual(jobs[0]["audio_length"], 1234)

    def test_build_rss_feed_preserves_audio_length_when_audio_file_missing(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            docs_root.mkdir(parents=True, exist_ok=True)
            job = {
                "entry_id": "morning-prayer-elevenlabs-2026-04-06",
                "episode_id": "morning-prayer-elevenlabs-2026-04-06",
                "title": "Morning Prayer",
                "description": "Morning prayer episode.",
                "published_date": "2026-04-06",
                "audio_path": str(docs_root / "audio" / "morning-prayer-elevenlabs-2026-04-06.mp3"),
                "audio_url": "https://example.com/audio/morning-prayer-elevenlabs-2026-04-06.mp3",
                "audio_length": 1234,
            }

            feed_xml = self.rss_mod.build_rss_feed([job], base_url="https://example.com")
            root = ET.fromstring(feed_xml)
            enclosure = root.find("./channel/item/enclosure")

        self.assertIsNotNone(enclosure)
        self.assertEqual(enclosure.get("length"), "1234")
