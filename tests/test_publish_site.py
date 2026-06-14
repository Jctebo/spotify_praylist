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

    def _write_publish_contract_with_alias(self, contract_dir, contract_id, alias, *, title=None):
        path = self._write_publish_contract(contract_dir, contract_id, title=title)
        payload = json.loads(path.read_text(encoding="utf-8"))
        payload["contract"]["metadata"]["website"]["aliases"] = [alias]
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return path

    def _write_spotify_contract(self, contract_dir, key="external-prayer", *, website_enabled=True, title="External Prayer"):
        payload = {
            "key": key,
            "notion_name": title,
            "resolver": "EXTERNAL",
            "website": (
                {
                    "enabled": True,
                    "slug": key,
                    "title": title,
                    "summary": f"{title} Spotify prayer.",
                    "group": "external-spotify",
                    "order": 20,
                    "source_label": "Spotify",
                    "availability": "daily",
                    "external_url": "https://open.spotify.com/show/abc123",
                    "primary_action_label": "Open in Spotify",
                }
                if website_enabled
                else {"enabled": False}
            ),
        }
        path = Path(contract_dir) / f"{key}.json"
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return path

    def _write_spotify_contract_with_website(self, contract_dir, key="external-prayer"):
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

    def _write_playlist(self, playlist_dir, contracts, *, key="morning", name="Morning"):
        payload = {
            "key": key,
            "name": name,
            "playlist_id": f"playlist{key}123",
            "contracts": list(contracts),
        }
        path = Path(playlist_dir) / f"{key}.json"
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return path

    def test_write_prayer_site_generates_index_manifest_and_pages(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            publish_dir = root / "publish"
            spotify_dir = root / "spotify"
            playlist_dir = root / "playlists"
            docs_root = root / "docs"
            publish_dir.mkdir()
            spotify_dir.mkdir()
            playlist_dir.mkdir()
            self._write_publish_contract(publish_dir, "morning-prayer", title="Morning Prayer")
            self._write_spotify_contract(spotify_dir, "morning-prayer", website_enabled=False, title="Morning Prayer")
            self._write_spotify_contract(spotify_dir, "external-prayer")
            self._write_playlist(playlist_dir, ["morning-prayer", "external-prayer"])

            result = self.site.write_prayer_site(
                docs_root=docs_root,
                base_url="https://example.test/site",
                publish_contract_dir=publish_dir,
                spotify_contract_dir=spotify_dir,
                spotify_playlist_dir=playlist_dir,
            )

            self.assertEqual(result["count"], 2)
            self.assertTrue((docs_root / "index.html").exists())
            self.assertTrue((docs_root / "prayers" / "index.json").exists())
            self.assertTrue((docs_root / "prayers" / "morning-prayer" / "index.html").exists())
            self.assertTrue((docs_root / "prayers" / "external-prayer" / "index.html").exists())

            html = (docs_root / "index.html").read_text(encoding="utf-8")
            self.assertIn("Morning Praylist", html)
            self.assertNotIn("Spotify prayers", html)
            self.assertIn("External Prayer", html)
            self.assertEqual(html.count("Open prayer"), 2)
            self.assertNotIn("Open in Spotify</a>", html)

            manifest = json.loads((docs_root / "prayers" / "index.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["count"], 2)
            self.assertEqual(manifest["groups"][0]["label"], "Morning Praylist")
            urls = {item["slug"]: item["url"] for item in manifest["items"]}
            self.assertEqual(urls["morning-prayer"], "https://example.test/site/prayers/morning-prayer/")
            self.assertEqual(urls["external-prayer"], "https://example.test/site/prayers/external-prayer/")
            morning = next(item for item in manifest["items"] if item["slug"] == "morning-prayer")
            self.assertEqual(morning["praylist_groups"], ["morning-praylist"])

    def test_write_prayer_site_merges_shared_prayer_family(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            publish_dir = root / "publish"
            spotify_dir = root / "spotify"
            playlist_dir = root / "playlists"
            docs_root = root / "docs"
            publish_dir.mkdir()
            spotify_dir.mkdir()
            playlist_dir.mkdir()
            self._write_publish_contract(publish_dir, "angelus", slug="marian-antiphon", family="marian-antiphon")
            self._write_publish_contract(publish_dir, "regina-caeli", slug="marian-antiphon", family="marian-antiphon")
            self._write_spotify_contract(spotify_dir, "angelus", website_enabled=False, title="Angelus")
            self._write_spotify_contract(spotify_dir, "regina-caeli", website_enabled=False, title="Regina Caeli")
            self._write_playlist(playlist_dir, ["angelus", "regina-caeli"])

            result = self.site.write_prayer_site(
                docs_root=docs_root,
                publish_contract_dir=publish_dir,
                spotify_contract_dir=spotify_dir,
                spotify_playlist_dir=playlist_dir,
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
            playlist_dir = root / "playlists"
            docs_root = root / "docs"
            audio_dir = docs_root / "audio"
            publish_dir.mkdir()
            spotify_dir.mkdir()
            playlist_dir.mkdir()
            audio_dir.mkdir(parents=True)
            self._write_publish_contract(publish_dir, "morning-prayer", title="Morning Prayer")
            self._write_spotify_contract(spotify_dir, "morning-prayer", website_enabled=False, title="Morning Prayer")
            self._write_playlist(playlist_dir, ["morning-prayer"])
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
                        "fragments": [
                            {"label": "Opening", "text": "Lord, open my lips."},
                            {"label": "Opening", "text": "Lord, open my lips."},
                            {"label": "Petition", "text": "Keep <us> close."},
                        ],
                    }
                ),
                encoding="utf-8",
            )

            self.site.write_prayer_site(
                docs_root=docs_root,
                base_url="https://example.test/site",
                publish_contract_dir=publish_dir,
                spotify_contract_dir=spotify_dir,
                spotify_playlist_dir=playlist_dir,
            )

            page = (docs_root / "prayers" / "morning-prayer" / "index.html").read_text(encoding="utf-8")
            self.assertIn("<audio controls", page)
            self.assertIn("Prayer text", page)
            self.assertIn("Lord, open my lips.", page)
            self.assertIn("x2", page)
            self.assertIn("Keep &lt;us&gt; close.", page)
            self.assertIn("https://example.test/site/audio/morning-prayer-2026-06-13.mp3", page)

    def test_write_prayer_site_rejects_duplicate_slug_without_family(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            publish_dir = root / "publish"
            spotify_dir = root / "spotify"
            playlist_dir = root / "playlists"
            docs_root = root / "docs"
            publish_dir.mkdir()
            spotify_dir.mkdir()
            playlist_dir.mkdir()
            self._write_publish_contract(publish_dir, "one", slug="duplicate")
            self._write_publish_contract(publish_dir, "two", slug="duplicate")
            self._write_spotify_contract(spotify_dir, "one", website_enabled=False, title="One")
            self._write_spotify_contract(spotify_dir, "two", website_enabled=False, title="Two")
            self._write_playlist(playlist_dir, ["one", "two"])

            with self.assertRaisesRegex(RuntimeError, "Duplicate prayer website slug"):
                self.site.write_prayer_site(
                    docs_root=docs_root,
                    publish_contract_dir=publish_dir,
                    spotify_contract_dir=spotify_dir,
                    spotify_playlist_dir=playlist_dir,
                )

    def test_write_prayer_site_removes_stale_generated_pages(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            publish_dir = root / "publish"
            spotify_dir = root / "spotify"
            playlist_dir = root / "playlists"
            docs_root = root / "docs"
            stale_page = docs_root / "prayers" / "old-prayer" / "index.html"
            publish_dir.mkdir()
            spotify_dir.mkdir()
            playlist_dir.mkdir()
            stale_page.parent.mkdir(parents=True)
            stale_page.write_text("stale", encoding="utf-8")
            self._write_publish_contract(publish_dir, "morning-prayer", title="Morning Prayer")
            self._write_spotify_contract(spotify_dir, "morning-prayer", website_enabled=False, title="Morning Prayer")
            self._write_playlist(playlist_dir, ["morning-prayer"])

            self.site.write_prayer_site(
                docs_root=docs_root,
                publish_contract_dir=publish_dir,
                spotify_contract_dir=spotify_dir,
                spotify_playlist_dir=playlist_dir,
            )

            self.assertFalse(stale_page.exists())
            self.assertTrue((docs_root / "prayers" / "morning-prayer" / "index.html").exists())

    def test_write_prayer_site_filters_playlist_unbound_entries(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            publish_dir = root / "publish"
            spotify_dir = root / "spotify"
            playlist_dir = root / "playlists"
            docs_root = root / "docs"
            publish_dir.mkdir()
            spotify_dir.mkdir()
            playlist_dir.mkdir()
            self._write_spotify_contract(spotify_dir, "active-prayer", title="Active Prayer")
            self._write_spotify_contract(spotify_dir, "inactive-prayer", title="Inactive Prayer")
            self._write_playlist(playlist_dir, ["active-prayer"])

            self.site.write_prayer_site(
                docs_root=docs_root,
                publish_contract_dir=publish_dir,
                spotify_contract_dir=spotify_dir,
                spotify_playlist_dir=playlist_dir,
            )

            manifest = json.loads((docs_root / "prayers" / "index.json").read_text(encoding="utf-8"))
            self.assertEqual([item["slug"] for item in manifest["items"]], ["active-prayer"])
            self.assertTrue((docs_root / "prayers" / "active-prayer" / "index.html").exists())
            self.assertFalse((docs_root / "prayers" / "inactive-prayer" / "index.html").exists())

    def test_write_prayer_site_matches_active_playlist_by_website_alias(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            publish_dir = root / "publish"
            spotify_dir = root / "spotify"
            playlist_dir = root / "playlists"
            docs_root = root / "docs"
            publish_dir.mkdir()
            spotify_dir.mkdir()
            playlist_dir.mkdir()
            self._write_publish_contract_with_alias(
                publish_dir,
                "canonical-prayer",
                "Alias Prayer",
                title="Canonical Prayer",
            )
            self._write_spotify_contract(spotify_dir, "alias-prayer", website_enabled=False, title="Alias Prayer")
            self._write_playlist(playlist_dir, ["alias-prayer"])

            self.site.write_prayer_site(
                docs_root=docs_root,
                publish_contract_dir=publish_dir,
                spotify_contract_dir=spotify_dir,
                spotify_playlist_dir=playlist_dir,
            )

            manifest = json.loads((docs_root / "prayers" / "index.json").read_text(encoding="utf-8"))
            self.assertEqual([item["slug"] for item in manifest["items"]], ["canonical-prayer"])
            self.assertTrue((docs_root / "prayers" / "canonical-prayer" / "index.html").exists())

    def test_external_spotify_action_lives_on_detail_page_only(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            publish_dir = root / "publish"
            spotify_dir = root / "spotify"
            playlist_dir = root / "playlists"
            docs_root = root / "docs"
            publish_dir.mkdir()
            spotify_dir.mkdir()
            playlist_dir.mkdir()
            self._write_spotify_contract(spotify_dir, "external-prayer")
            self._write_playlist(playlist_dir, ["external-prayer"])

            self.site.write_prayer_site(
                docs_root=docs_root,
                publish_contract_dir=publish_dir,
                spotify_contract_dir=spotify_dir,
                spotify_playlist_dir=playlist_dir,
            )

            home = (docs_root / "index.html").read_text(encoding="utf-8")
            page = (docs_root / "prayers" / "external-prayer" / "index.html").read_text(encoding="utf-8")
            self.assertIn("Open prayer", home)
            self.assertNotIn("Open in Spotify</a>", home)
            self.assertIn("Open in Spotify</a>", page)
            self.assertNotIn("Prayer text", page)

    def test_daily_novenas_page_lists_individual_sidecar_episodes(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            publish_dir = root / "publish"
            spotify_dir = root / "spotify"
            playlist_dir = root / "playlists"
            docs_root = root / "docs"
            audio_dir = docs_root / "audio"
            publish_dir.mkdir()
            spotify_dir.mkdir()
            playlist_dir.mkdir()
            audio_dir.mkdir(parents=True)
            self._write_spotify_contract(spotify_dir, "daily-novenas", title="Daily Novenas")
            self._write_playlist(playlist_dir, ["daily-novenas"], key="midday", name="Midday")
            episode_id = "2026-06-13-sacred-heart-day-1"
            (audio_dir / f"{episode_id}.mp3").write_bytes(make_test_mp3_bytes())
            (audio_dir / f"{episode_id}.json").write_text(
                json.dumps(
                    {
                        "entry_id": episode_id,
                        "episode_id": episode_id,
                        "family_id": "sacred_heart",
                        "contract_id": "sacred_heart",
                        "contract_type": "novena_feast_rule",
                        "title": "Novena to the Sacred Heart Day 1 - June 13, 2026",
                        "description": "Novena.",
                        "published_date": "2026-06-13",
                        "content_hash": "abc",
                        "audio_length": 123,
                        "fragments": [{"label": "Opening", "text": "Jesus, meek and humble of heart."}],
                    }
                ),
                encoding="utf-8",
            )

            self.site.write_prayer_site(
                docs_root=docs_root,
                base_url="https://example.test/site",
                publish_contract_dir=publish_dir,
                spotify_contract_dir=spotify_dir,
                spotify_playlist_dir=playlist_dir,
            )

            page = (docs_root / "prayers" / "daily-novenas" / "index.html").read_text(encoding="utf-8")
            self.assertIn("Individual novena episodes", page)
            self.assertIn("Novena to the Sacred Heart Day 1", page)
            self.assertIn("Jesus, meek and humble of heart.", page)
            self.assertIn("https://example.test/site/audio/2026-06-13-sacred-heart-day-1.mp3", page)

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
