import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from jobs.playlist.spotify_contracts import (
    SpotifyEpisodeLookupContract,
    load_spotify_queue_contracts,
)
from scripts import build_pages_artifact as pages


class TestPagesArtifactBuilder(unittest.TestCase):
    def test_builds_ordered_prayer_groups_and_preserves_podcast_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            with patch.object(pages, "_resolved_item_uris", return_value={}):
                payload = pages.build_artifact(output)

            self.assertEqual(
                [group["key"] for group in payload["groups"]],
                ["morning", "midmorning", "midday", "mid-afternoon", "evening", "night", "sunday"],
            )
            self.assertEqual([len(group["prayers"]) for group in payload["groups"]], [6, 2, 3, 4, 2, 2, 3])
            sunday = next(group for group in payload["groups"] if group["key"] == "sunday")
            self.assertEqual(sunday["name"], "Mass and Homilies")
            self.assertEqual(sunday["prayers"][-1]["key"], "daily-tv-mass-2026-10-23")
            self.assertEqual(
                sunday["prayers"][-1]["spotify_url"],
                "https://open.spotify.com/episode/0cwjeAbT8JYLoQXaSYeElc",
            )
            self.assertNotIn(
                "daily-mass-readings",
                [prayer["key"] for group in payload["groups"] for prayer in group["prayers"]],
            )
            self.assertEqual(payload["wallpaper"], None)
            self.assertEqual(json.loads((output / "prayers.json").read_text(encoding="utf-8")), payload)
            self.assertTrue((output / "index.html").is_file())
            self.assertTrue((output / "site.css").is_file())
            self.assertTrue((output / "site.js").is_file())
            self.assertTrue((output / "podcast.xml").is_file())
            self.assertTrue((output / "images/logo_ora_pro_nobis.png").is_file())
            page_html = (output / "index.html").read_text(encoding="utf-8")
            self.assertIn('aria-label="Podcast links"', page_html)
            self.assertEqual(page_html.count("https://open.spotify.com/show/4PNxb0OazrkcEp3FAggRoD"), 2)
            self.assertIn('href="podcast.xml">RSS feed', page_html)
            self.assertIn('href="podcast.xml">Open RSS feed', page_html)
            self.assertFalse(list((output / "images").glob("daily-wallpaper.*")))
            for group in payload["groups"]:
                self.assertTrue(group["playlist_url"].startswith("https://open.spotify.com/playlist/"))
                for prayer in group["prayers"]:
                    if prayer["spotify_url"] is not None:
                        self.assertTrue(
                            prayer["spotify_url"].startswith(
                                ("https://open.spotify.com/track/", "https://open.spotify.com/episode/")
                            )
                        )

    def test_copies_valid_wallpaper_and_removes_stale_wallpaper_variants(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "site"
            image = root / "today.webp"
            image.write_bytes(b"wallpaper")
            images = output / "images"
            images.mkdir(parents=True)
            (images / "daily-wallpaper.jpg").write_bytes(b"stale")

            with patch.object(pages, "_resolved_item_uris", return_value={}):
                payload = pages.build_artifact(output, wallpaper_path=image)

            self.assertEqual(payload["wallpaper"], "images/daily-wallpaper.webp")
            self.assertEqual((output / payload["wallpaper"]).read_bytes(), b"wallpaper")
            self.assertEqual(sorted(path.name for path in images.glob("daily-wallpaper.*")), ["daily-wallpaper.webp"])

    def test_rejects_missing_or_unsupported_wallpaper(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(pages, "_resolved_item_uris", return_value={}):
                with self.assertRaisesRegex(RuntimeError, "Wallpaper image not found"):
                    pages.build_prayer_data(wallpaper_path=root / "missing.jpg")

            unsupported = root / "today.gif"
            unsupported.write_bytes(b"wallpaper")
            with patch.object(pages, "_resolved_item_uris", return_value={}):
                with self.assertRaisesRegex(RuntimeError, "must be a JPEG, PNG, or WebP"):
                    pages.build_prayer_data(wallpaper_path=unsupported)

    def test_maps_resolved_spotify_episodes_and_never_falls_back_to_search_or_show(self):
        contract = load_spotify_queue_contracts()[0]
        self.assertEqual(
            pages._spotify_url(contract._replace(spotify_url_normal="spotify:track:39Jgl6ST4fQj4fNyRSQZFk", spotify_uri="")),
            "https://open.spotify.com/track/39Jgl6ST4fQj4fNyRSQZFk",
        )
        direct = "https://open.spotify.com/episode/2HNK8wLRWHh0mJ9xmJjlUD"
        self.assertEqual(
            pages._spotify_url(contract._replace(spotify_url_normal=direct, spotify_uri="")),
            direct,
        )
        episode = SpotifyEpisodeLookupContract(show_id="4PNxb0OazrkcEp3FAggRoD", searches=())
        self.assertEqual(
            pages._spotify_url(
                contract._replace(spotify_url_normal="", spotify_uri="", spotify_episode_lookup=episode),
                ["spotify:episode:2HNK8wLRWHh0mJ9xmJjlUD"],
            ),
            "https://open.spotify.com/episode/2HNK8wLRWHh0mJ9xmJjlUD",
        )
        fallback = contract._replace(spotify_url_normal="", spotify_uri="", spotify_episode_lookup=None)
        self.assertIsNone(pages._spotify_url(fallback))
        self.assertIsNone(pages._spotify_url(fallback._replace(resolver="SHOW_ONLY"), ["spotify:show:show123"]))

    def test_resolved_urls_change_prayer_item_only_and_leave_playlist_url_unchanged(self):
        contracts = load_spotify_queue_contracts()
        dynamic = next(contract for contract in contracts if contract.key == "morning-prayer")
        resolved = {dynamic.key: ["spotify:episode:2HNK8wLRWHh0mJ9xmJjlUD"]}
        payload = pages.build_prayer_data(date="2026-10-18", spotify_resolved_uris=resolved)
        morning = next(group for group in payload["groups"] if group["key"] == "morning")
        prayer = next(item for item in morning["prayers"] if item["key"] == dynamic.key)
        self.assertEqual(prayer["spotify_url"], "https://open.spotify.com/episode/2HNK8wLRWHh0mJ9xmJjlUD")
        self.assertEqual(morning["playlist_url"], "https://open.spotify.com/playlist/0sy9eBsySKuCppI0PxXRJN")

    def test_dynamic_item_resolution_uses_shared_resolver_and_handles_auth_failure(self):
        contract = load_spotify_queue_contracts()[0]
        environment = {
            pages.SPOTIFY_CLIENT_ID: "test-client",
            pages.SPOTIFY_CLIENT_SECRET: "test-secret",
            pages.SPOTIFY_REFRESH_TOKEN: "test-refresh-token",
        }
        with patch.dict("os.environ", environment), patch.object(pages, "sp_client", return_value=(object(), "token")), patch.object(
            pages, "load_resolver_runtime_config", return_value=({}, {}, {}, {})
        ), patch.object(pages, "resolve_contract_uris", return_value=["spotify:episode:episode123"]) as resolver:
            result = pages._resolved_item_uris([contract], pages.Date.fromisoformat("2026-10-18"))
        self.assertEqual(result[contract.key], ["spotify:episode:episode123"])
        resolver.assert_called_once()

        with patch.dict("os.environ", environment), patch.object(pages, "sp_client", side_effect=RuntimeError("auth failed")):
            self.assertEqual(pages._resolved_item_uris([contract], pages.Date.fromisoformat("2026-10-18")), {})

    def test_page_build_resolves_only_contracts_used_by_active_playlists(self):
        with patch.object(pages, "_resolved_item_uris", return_value={}) as resolve:
            pages.build_prayer_data()

        resolved_contracts = resolve.call_args.args[0]
        resolved_keys = {contract.key for contract in resolved_contracts}
        expected_keys = {
            key
            for definition in pages.load_spotify_playlist_definitions()
            for key in definition.contracts
        }
        all_contract_keys = {contract.key for contract in load_spotify_queue_contracts()}
        self.assertEqual(resolved_keys, expected_keys)
        self.assertLess(len(resolved_keys), len(all_contract_keys))


if __name__ == "__main__":
    unittest.main()
