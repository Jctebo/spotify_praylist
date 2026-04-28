import datetime
import json
import xml.etree.ElementTree as ET
import tempfile
import unittest
from pathlib import Path

from tests.test_helpers import load_module, make_test_mp3_bytes


class TestPublishAudioPipeline(unittest.TestCase):
    def setUp(self):
        import jobs.publish.contracts as package_contracts

        self.contracts_mod = load_module("jobs/publish/contracts.py")
        self.audio_mod = load_module("jobs/publish/audio.py")
        self.rss_mod = load_module("jobs/publish/rss.py")
        self.runner_mod = load_module("jobs/publish/run_audio_pipeline.py")
        stub = lambda date_value, **kwargs: (
            "Today the Church celebrates Saint Example. Praise be to God for his mercy. "
            "In today's Gospel, Jesus calls his sheep by name."
        )
        self.contracts_mod.build_daily_intro_text = stub
        package_contracts.build_daily_intro_text = stub

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

        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["entry_id"], "morning-prayer")
        self.assertTrue(jobs[0]["audio_config"]["enabled"])
        self.assertGreater(len(jobs[0]["audio_fragments"]), 0)

    def test_render_audio_job_skips_when_hash_matches(self):
        contracts = self.contracts_mod.load_publish_contracts()
        jobs = self.audio_mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 4, 6))
        job = jobs[0]

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
            self.assertTrue(Path(first["audio_path"]).with_suffix(".json").exists())
            self.assertGreater(Path(first["audio_path"]).stat().st_size, 0)

    def test_build_rss_feed_contains_enclosure_and_guid(self):
        contracts = self.contracts_mod.load_publish_contracts()
        jobs = self.audio_mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 4, 6))
        job = jobs[0]

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            fake_renderer, _ = self._fake_renderer()

            rendered = self.audio_mod.render_audio_job(job, renderer=fake_renderer, docs_root=docs_root, cache_root=cache_root)
            feed_xml = self.rss_mod.build_rss_feed([rendered], base_url=self.audio_mod.github_pages_base_url())
            root = ET.fromstring(feed_xml)
            item = root.find("./channel/item")
        self.assertIsNotNone(item)
        self.assertEqual(item.findtext("guid"), "morning-prayer-2026-04-06")
        enclosure = item.find("enclosure")
        self.assertIsNotNone(enclosure)
        self.assertTrue(enclosure.get("url", "").endswith("/audio/morning-prayer-2026-04-06.mp3"))
        self.assertIn("Morning Prayer for April 6, 2026", item.findtext("title") or "")
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

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            self.runner_mod.load_publish_contracts = lambda contract_dir=None: contracts
            self.runner_mod.build_audio_jobs = lambda contracts, target_date=None: self.audio_mod.build_audio_jobs(
                contracts, target_date=datetime.date(2026, 4, 6)
            )
            result = self.runner_mod.run_audio_pipeline(docs_root=docs_root, renderer=fake_renderer, cache_root=cache_root)

            self.assertEqual(result["jobs"], 1)
            self.assertEqual(result["rendered"], 1)
            self.assertEqual(result["archived"], 1)
            self.assertTrue((docs_root / "podcast.xml").exists())
            self.assertTrue((docs_root / "audio" / "morning-prayer-2026-04-06.mp3").exists())
            self.assertTrue((docs_root / "images" / "logo_ora_pro_nobis.png").exists())

    def test_run_audio_pipeline_rebuilds_feed_from_archived_sidecars(self):
        contracts = self.contracts_mod.load_publish_contracts()
        fake_renderer, _ = self._fake_renderer()

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            cache_root = Path(tmpdir) / ".cache"
            date_state = {"value": datetime.date(2026, 4, 6)}
            self.runner_mod.load_publish_contracts = lambda contract_dir=None: contracts
            self.runner_mod.build_audio_jobs = lambda contracts, target_date=None: self.audio_mod.build_audio_jobs(
                contracts, target_date=date_state["value"]
            )

            first = self.runner_mod.run_audio_pipeline(docs_root=docs_root, renderer=fake_renderer, cache_root=cache_root)
            date_state["value"] = datetime.date(2026, 4, 7)
            second = self.runner_mod.run_audio_pipeline(docs_root=docs_root, renderer=fake_renderer, cache_root=cache_root)

            self.assertEqual(first["jobs"], 1)
            self.assertEqual(second["jobs"], 1)
            root = ET.fromstring((docs_root / "podcast.xml").read_text(encoding="utf-8"))
            guids = [item.findtext("guid") for item in root.findall("./channel/item")]
            self.assertEqual(guids, ["morning-prayer-2026-04-07", "morning-prayer-2026-04-06"])

    def test_load_published_audio_jobs_recovers_date_from_episode_suffix_without_audio_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            audio_dir = docs_root / "audio"
            audio_dir.mkdir(parents=True, exist_ok=True)
            (audio_dir / "morning-prayer-2026-04-06.json").write_text(
                json.dumps(
                    {
                        "entry_id": "morning-prayer",
                        "episode_id": "morning-prayer-2026-04-06",
                        "title": "Morning Prayer",
                        "description": "Morning prayer episode.",
                        "audio_path": str(audio_dir / "morning-prayer-2026-04-06.mp3"),
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )

            jobs = self.audio_mod.load_published_audio_jobs(docs_root=docs_root)

        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["episode_id"], "morning-prayer-2026-04-06")
        self.assertEqual(jobs[0]["published_date"], "2026-04-06")
        self.assertEqual(jobs[0]["audio_length"], 0)

    def test_load_published_audio_jobs_recovers_length_from_sidecar(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            audio_dir = docs_root / "audio"
            audio_dir.mkdir(parents=True, exist_ok=True)
            (audio_dir / "morning-prayer-2026-04-06.json").write_text(
                json.dumps(
                    {
                        "entry_id": "morning-prayer",
                        "episode_id": "morning-prayer-2026-04-06",
                        "title": "Morning Prayer",
                        "description": "Morning prayer episode.",
                        "audio_path": str(audio_dir / "morning-prayer-2026-04-06.mp3"),
                        "audio_length": 1234,
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )

            jobs = self.audio_mod.load_published_audio_jobs(docs_root=docs_root)

        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["audio_length"], 1234)

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
            ET.SubElement(item, "guid", isPermaLink="false").text = "morning-prayer-2026-04-06"
            ET.SubElement(item, "link").text = "https://example.com/audio/morning-prayer-2026-04-06.mp3"
            ET.SubElement(item, "description").text = "Morning prayer episode."
            ET.SubElement(item, "enclosure", url="https://example.com/audio/morning-prayer-2026-04-06.mp3", length="1234", type="audio/mpeg")
            ET.ElementTree(feed_root).write(feed_path, encoding="utf-8", xml_declaration=True)

            jobs = self.rss_mod.load_podcast_feed_jobs(feed_path)

        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["episode_id"], "morning-prayer-2026-04-06")
        self.assertEqual(jobs[0]["published_date"], "2026-04-06")
        self.assertEqual(jobs[0]["audio_length"], 1234)

    def test_build_rss_feed_preserves_audio_length_when_audio_file_missing(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            docs_root.mkdir(parents=True, exist_ok=True)
            job = {
                "entry_id": "morning-prayer-2026-04-06",
                "episode_id": "morning-prayer-2026-04-06",
                "title": "Morning Prayer",
                "description": "Morning prayer episode.",
                "published_date": "2026-04-06",
                "audio_path": str(docs_root / "audio" / "morning-prayer-2026-04-06.mp3"),
                "audio_url": "https://example.com/audio/morning-prayer-2026-04-06.mp3",
                "audio_length": 1234,
            }

            feed_xml = self.rss_mod.build_rss_feed([job], base_url="https://example.com")
            root = ET.fromstring(feed_xml)
            enclosure = root.find("./channel/item/enclosure")

        self.assertIsNotNone(enclosure)
        self.assertEqual(enclosure.get("length"), "1234")
