import json
import tempfile
import unittest
from pathlib import Path

from jobs.playlist.spotify_contracts import (
    SpotifyEpisodeLookupContract,
    load_spotify_queue_contracts,
)
from scripts import build_pages_artifact as pages


class TestPagesArtifactBuilder(unittest.TestCase):
    def test_builds_ordered_prayer_groups_and_preserves_podcast_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            payload = pages.build_artifact(output)

            self.assertEqual([group["key"] for group in payload["groups"]], ["morning", "midday", "night", "sunday"])
            self.assertEqual([len(group["prayers"]) for group in payload["groups"]], [7, 8, 4, 2])
            self.assertEqual(payload["wallpaper"], None)
            self.assertEqual(json.loads((output / "prayers.json").read_text(encoding="utf-8")), payload)
            self.assertTrue((output / "index.html").is_file())
            self.assertTrue((output / "site.css").is_file())
            self.assertTrue((output / "site.js").is_file())
            self.assertTrue((output / "podcast.xml").is_file())
            self.assertTrue((output / "images/logo_ora_pro_nobis.png").is_file())
            self.assertFalse(list((output / "images").glob("daily-wallpaper.*")))
            for group in payload["groups"]:
                self.assertTrue(group["playlist_url"].startswith("https://open.spotify.com/playlist/"))
                for prayer in group["prayers"]:
                    self.assertTrue(prayer["spotify_url"].startswith("https://open.spotify.com/"))

    def test_copies_valid_wallpaper_and_removes_stale_wallpaper_variants(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "site"
            image = root / "today.webp"
            image.write_bytes(b"wallpaper")
            images = output / "images"
            images.mkdir(parents=True)
            (images / "daily-wallpaper.jpg").write_bytes(b"stale")

            payload = pages.build_artifact(output, wallpaper_path=image)

            self.assertEqual(payload["wallpaper"], "images/daily-wallpaper.webp")
            self.assertEqual((output / payload["wallpaper"]).read_bytes(), b"wallpaper")
            self.assertEqual(sorted(path.name for path in images.glob("daily-wallpaper.*")), ["daily-wallpaper.webp"])

    def test_rejects_missing_or_unsupported_wallpaper(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaisesRegex(RuntimeError, "Wallpaper image not found"):
                pages.build_prayer_data(wallpaper_path=root / "missing.jpg")

            unsupported = root / "today.gif"
            unsupported.write_bytes(b"wallpaper")
            with self.assertRaisesRegex(RuntimeError, "must be a JPEG, PNG, or WebP"):
                pages.build_prayer_data(wallpaper_path=unsupported)

    def test_maps_spotify_destinations_and_search_fallback(self):
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
            pages._spotify_url(contract._replace(spotify_url_normal="", spotify_uri="", spotify_episode_lookup=episode)),
            "https://open.spotify.com/show/4PNxb0OazrkcEp3FAggRoD",
        )
        fallback = contract._replace(spotify_url_normal="", spotify_uri="", spotify_episode_lookup=None)
        self.assertEqual(pages._spotify_url(fallback), "https://open.spotify.com/search/" + pages.quote(fallback.name, safe=""))


if __name__ == "__main__":
    unittest.main()
