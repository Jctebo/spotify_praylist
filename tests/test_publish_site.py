import json
import tempfile
import unittest
from pathlib import Path

from tests.test_helpers import make_test_mp3_bytes


class TestPublishSite(unittest.TestCase):
    def setUp(self):
        import jobs.publish.site as site

        self.site = site

    def _write_publish_contract(self, contract_dir, contract_id, *, slug=None, family="", title=None):
        payload = {
            "contract": {
                "id": contract_id,
                "type": "daily-prayer",
                "frequency": "daily",
                "timezone": "America/Chicago",
                "version": "1",
                "metadata": {
                    "title_template": f"{title or contract_id} - {{date_display}}",
                    "description_template": f"{title or contract_id} for {{date_display}}.",
                    "episode_id_template": f"{contract_id}-{{date_iso}}",
                    "website": {
                        "enabled": True,
                        "slug": slug or contract_id,
                        "title": title or contract_id.replace("-", " ").title(),
                        "summary": f"Summary for {title or contract_id}.",
                        "group": "ora-pro-nobis",
                        "order": 10,
                        "source_label": "Ora Pro Nobis",
                        "availability": "daily",
                        "primary_action_label": "Pray",
                    },
                },
            },
            "entries": [
                {
                    "entry_id": contract_id,
                    "date": "daily",
                    "title": title or contract_id.replace("-", " ").title(),
                    "status": "approved",
                    "text": "Prayer text.",
                    "text_config": {"enabled": True},
                    "audio_config": {"enabled": False},
                }
            ],
        }
        if family:
            payload["contract"]["metadata"]["website"]["prayer_family"] = family
        path = Path(contract_dir) / f"{contract_id}.json"
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return path

    def _write_spotify_contract(self, contract_dir, key="external-prayer"):
        payload = {
            "key": key,
            "notion_name": "External Prayer",
            "resolver": "EXTERNAL",
            "website": {
                "enabled": True,
                "slug": key,
                "title": "External Prayer",
                "summary": "External Spotify prayer.",
                "group": "external-spotify",
                "order": 20,
                "source_label": "Spotify",
                "availability": "daily",
                "external_url": "https://open.spotify.com/show/abc123",
                "primary_action_label": "Open in Spotify",
            },
        }
        path = Path(contract_dir) / f"{key}.json"
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return path

    def _write_disabled_spotify_contract(self, contract_dir):
        payload = {
            "key": "disabled-prayer",
            "notion_name": "Disabled Prayer",
            "resolver": "DISABLED",
            "website": {"enabled": False},
        }
        path = Path(contract_dir) / "disabled-prayer.json"
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return path

    def test_write_prayer_site_generates_index_manifest_and_pages(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            publish_dir = root / "publish"
            spotify_dir = root / "spotify"
            docs_root = root / "docs"
            publish_dir.mkdir()
            spotify_dir.mkdir()
            self._write_publish_contract(publish_dir, "morning-prayer", title="Morning Prayer")
            self._write_spotify_contract(spotify_dir, "external-prayer")

            result = self.site.write_prayer_site(
                docs_root=docs_root,
                base_url="https://example.test/site",
                publish_contract_dir=publish_dir,
                spotify_contract_dir=spotify_dir,
            )

            self.assertEqual(result["count"], 2)
            self.assertTrue((docs_root / "index.html").exists())
            self.assertTrue((docs_root / "prayers" / "index.json").exists())
            self.assertTrue((docs_root / "prayers" / "morning-prayer" / "index.html").exists())
            self.assertTrue((docs_root / "prayers" / "external-prayer" / "index.html").exists())

            html = (docs_root / "index.html").read_text(encoding="utf-8")
            self.assertIn("Ora Pro Nobis", html)
            self.assertIn("Spotify prayers", html)
            self.assertIn("External Prayer", html)

            manifest = json.loads((docs_root / "prayers" / "index.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["count"], 2)
            urls = {item["slug"]: item["url"] for item in manifest["items"]}
            self.assertEqual(urls["morning-prayer"], "https://example.test/site/prayers/morning-prayer/")
            self.assertEqual(urls["external-prayer"], "https://example.test/site/prayers/external-prayer/")

    def test_write_prayer_site_merges_shared_prayer_family(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            publish_dir = root / "publish"
            spotify_dir = root / "spotify"
            docs_root = root / "docs"
            publish_dir.mkdir()
            spotify_dir.mkdir()
            self._write_publish_contract(publish_dir, "angelus", slug="marian-antiphon", family="marian-antiphon")
            self._write_publish_contract(publish_dir, "regina-caeli", slug="marian-antiphon", family="marian-antiphon")
            self._write_disabled_spotify_contract(spotify_dir)

            result = self.site.write_prayer_site(
                docs_root=docs_root,
                publish_contract_dir=publish_dir,
                spotify_contract_dir=spotify_dir,
            )

            self.assertEqual(result["count"], 1)
            manifest = json.loads((docs_root / "prayers" / "index.json").read_text(encoding="utf-8"))
            item = manifest["items"][0]
            self.assertEqual(item["slug"], "marian-antiphon")
            self.assertEqual(item["related_contracts"], ["angelus", "regina-caeli"])

    def test_write_prayer_site_attaches_latest_audio_from_sidecar(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            publish_dir = root / "publish"
            spotify_dir = root / "spotify"
            docs_root = root / "docs"
            audio_dir = docs_root / "audio"
            publish_dir.mkdir()
            spotify_dir.mkdir()
            audio_dir.mkdir(parents=True)
            self._write_publish_contract(publish_dir, "morning-prayer", title="Morning Prayer")
            self._write_disabled_spotify_contract(spotify_dir)
            episode_id = "morning-prayer-2026-06-13"
            (audio_dir / f"{episode_id}.mp3").write_bytes(make_test_mp3_bytes())
            (audio_dir / f"{episode_id}.json").write_text(
                json.dumps(
                    {
                        "entry_id": "morning-prayer",
                        "episode_id": episode_id,
                        "contract_id": "morning-prayer",
                        "title": "Morning Prayer - June 13, 2026",
                        "description": "Morning Prayer.",
                        "published_date": "2026-06-13",
                        "content_hash": "abc",
                        "audio_length": 123,
                    }
                ),
                encoding="utf-8",
            )

            self.site.write_prayer_site(
                docs_root=docs_root,
                base_url="https://example.test/site",
                publish_contract_dir=publish_dir,
                spotify_contract_dir=spotify_dir,
            )

            page = (docs_root / "prayers" / "morning-prayer" / "index.html").read_text(encoding="utf-8")
            self.assertIn("Listen to latest audio", page)
            self.assertIn("https://example.test/site/audio/morning-prayer-2026-06-13.mp3", page)

    def test_write_prayer_site_rejects_duplicate_slug_without_family(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            publish_dir = root / "publish"
            spotify_dir = root / "spotify"
            docs_root = root / "docs"
            publish_dir.mkdir()
            spotify_dir.mkdir()
            self._write_publish_contract(publish_dir, "one", slug="duplicate")
            self._write_publish_contract(publish_dir, "two", slug="duplicate")
            self._write_disabled_spotify_contract(spotify_dir)

            with self.assertRaisesRegex(RuntimeError, "Duplicate prayer website slug"):
                self.site.write_prayer_site(
                    docs_root=docs_root,
                    publish_contract_dir=publish_dir,
                    spotify_contract_dir=spotify_dir,
                )

    def test_write_prayer_site_removes_stale_generated_pages(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            publish_dir = root / "publish"
            spotify_dir = root / "spotify"
            docs_root = root / "docs"
            stale_page = docs_root / "prayers" / "old-prayer" / "index.html"
            publish_dir.mkdir()
            spotify_dir.mkdir()
            stale_page.parent.mkdir(parents=True)
            stale_page.write_text("stale", encoding="utf-8")
            self._write_publish_contract(publish_dir, "morning-prayer", title="Morning Prayer")
            self._write_disabled_spotify_contract(spotify_dir)

            self.site.write_prayer_site(
                docs_root=docs_root,
                publish_contract_dir=publish_dir,
                spotify_contract_dir=spotify_dir,
            )

            self.assertFalse(stale_page.exists())
            self.assertTrue((docs_root / "prayers" / "morning-prayer" / "index.html").exists())

    def test_workflows_call_prayer_site_generator(self):
        publish_audio = Path(".github/workflows/publish_audio.yml").read_text(encoding="utf-8")
        devotional = Path(".github/workflows/daily_devotional_image_remote.yml").read_text(encoding="utf-8")
        validation = Path(".github/workflows/morning_prayer_page_audio_test.yml").read_text(encoding="utf-8")

        self.assertIn("python -m jobs.publish.site", publish_audio)
        self.assertIn('python -m jobs.publish.site --docs-root "${GITHUB_WORKSPACE}/pages"', devotional)
        self.assertIn("Website Publish Validation", validation)
        self.assertIn("tests.test_publish_site", validation)
        self.assertIn("tests.test_page_audio_job", validation)


if __name__ == "__main__":
    unittest.main()
