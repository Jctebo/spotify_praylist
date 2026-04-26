import datetime
import xml.etree.ElementTree as ET
import tempfile
import unittest
from pathlib import Path

from tests.test_helpers import load_module


class TestPublishAudioPipeline(unittest.TestCase):
    def setUp(self):
        self.contracts_mod = load_module("jobs/publish/contracts.py")
        self.audio_mod = load_module("jobs/publish/audio.py")
        self.rss_mod = load_module("jobs/publish/rss.py")
        self.runner_mod = load_module("jobs/publish/run_audio_pipeline.py")

    def test_build_audio_jobs_only_includes_enabled_entries(self):
        contracts = self.contracts_mod.load_publish_contracts()
        jobs = self.audio_mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 4, 6))

        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["entry_id"], "morning-prayer")
        self.assertTrue(jobs[0]["audio_config"]["enabled"])

    def test_render_audio_job_skips_when_hash_matches(self):
        contracts = self.contracts_mod.load_publish_contracts()
        jobs = self.audio_mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 4, 6))
        job = jobs[0]

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            calls = {"count": 0}

            def fake_renderer(text, audio_config):
                calls["count"] += 1
                return b"FAKE-MP3"

            first = self.audio_mod.render_audio_job(job, renderer=fake_renderer, docs_root=docs_root)
            second = self.audio_mod.render_audio_job(job, renderer=fake_renderer, docs_root=docs_root)

            self.assertTrue(first["rendered"])
            self.assertFalse(second["rendered"])
            self.assertEqual(calls["count"], 1)
            self.assertTrue(Path(first["audio_path"]).exists())
            self.assertTrue(Path(first["audio_path"]).with_suffix(".json").exists())

    def test_build_rss_feed_contains_enclosure_and_guid(self):
        contracts = self.contracts_mod.load_publish_contracts()
        jobs = self.audio_mod.build_audio_jobs(contracts, target_date=datetime.date(2026, 4, 6))
        job = jobs[0]

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"

            def fake_renderer(text, audio_config):
                return b"FAKE-MP3"

            rendered = self.audio_mod.render_audio_job(job, renderer=fake_renderer, docs_root=docs_root)
            feed_xml = self.rss_mod.build_rss_feed([rendered], base_url=self.audio_mod.github_pages_base_url())
            root = ET.fromstring(feed_xml)
            item = root.find("./channel/item")
            self.assertIsNotNone(item)
            self.assertEqual(item.findtext("guid"), "morning-prayer")
            enclosure = item.find("enclosure")
            self.assertIsNotNone(enclosure)
            self.assertTrue(enclosure.get("url", "").endswith("/docs/audio/morning-prayer.mp3"))

    def test_run_audio_pipeline_writes_feed(self):
        contracts = self.contracts_mod.load_publish_contracts()

        def fake_renderer(text, audio_config):
            return b"FAKE-MP3"

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir) / "docs"
            self.runner_mod.load_publish_contracts = lambda contract_dir=None: contracts
            self.runner_mod.build_audio_jobs = lambda contracts, target_date=None: self.audio_mod.build_audio_jobs(
                contracts, target_date=datetime.date(2026, 4, 6)
            )
            result = self.runner_mod.run_audio_pipeline(docs_root=docs_root, renderer=fake_renderer)

            self.assertEqual(result["jobs"], 1)
            self.assertEqual(result["rendered"], 1)
            self.assertTrue((docs_root / "podcast.xml").exists())
            self.assertTrue((docs_root / "audio" / "morning-prayer.mp3").exists())
