import unittest
from unittest.mock import patch

from tests.test_helpers import load_module, temp_env


class TestRefreshJob(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/playlist/refresh_playlist.py")
        self.cfg = {
            "utc_offset": "-06:00",
            "profiles": {"morning": {"playlist_id": "playlist_123", "order": ["MORNING"]}},
            "catalog": {"MORNING": {"kind": "dynamic"}},
            "shows": {"STH": "show_sth"},
            "fixed": {"ANGELUS_SONG": "spotify:track:abc"},
            "tokens": {"STH_LAUDS": "Lauds"},
        }

    def test_recreate_playlist_items_chunks_with_put_then_post(self):
        calls = []

        def fake_web_json(method, url, token, payload=None):
            calls.append((method, url, token, payload))
            return {}

        uris = [f"spotify:track:{i}" for i in range(205)]
        with patch.object(self.mod, "spotify_web_json", side_effect=fake_web_json):
            written = self.mod.recreate_playlist_items("token_1", "playlist_1", uris)

        self.assertEqual(written, 205)
        self.assertEqual(len(calls), 3)
        self.assertEqual(calls[0][0], "PUT")
        self.assertEqual(calls[1][0], "POST")
        self.assertEqual(calls[2][0], "POST")
        self.assertTrue(calls[0][1].endswith("/playlists/playlist_1/items"))
        self.assertEqual(len(calls[0][3]["uris"]), 100)
        self.assertEqual(len(calls[1][3]["uris"]), 100)
        self.assertEqual(len(calls[2][3]["uris"]), 5)

    def test_main_success_path(self):
        env = {
            "SPOTIFY_CLIENT_ID": "cid",
            "SPOTIFY_CLIENT_SECRET": "secret",
            "SPOTIFY_REFRESH_TOKEN": "refresh",
            "SPOTIFY_PLAYLIST_ID": "playlist_123",
            "SPOTIFY_PLAYLIST_PROFILE": "morning",
        }
        queue = ["spotify:track:111", "spotify:episode:222"]

        with temp_env(env):
            with patch.object(self.mod, "load_playlist_config", return_value=self.cfg), patch.object(
                self.mod, "set_runtime_timezone"
            ), patch.object(self.mod, "sp_client", return_value=(object(), "token_123")), patch.object(
                self.mod, "build_queue_for_profile", return_value=queue
            ), patch.object(
                self.mod, "recreate_playlist_items", return_value=len(queue)
            ) as recreate_mock, patch.object(
                self.mod, "sync_notion_uris_for_profile", return_value=(0, [], [], [])
            ):
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        recreate_mock.assert_called_once_with("token_123", "playlist_123", queue)

    def test_main_fails_when_queue_empty(self):
        env = {
            "SPOTIFY_CLIENT_ID": "cid",
            "SPOTIFY_CLIENT_SECRET": "secret",
            "SPOTIFY_REFRESH_TOKEN": "refresh",
            "SPOTIFY_PLAYLIST_ID": "playlist_123",
            "SPOTIFY_PLAYLIST_PROFILE": "morning",
        }

        with temp_env(env):
            with patch.object(self.mod, "load_playlist_config", return_value=self.cfg), patch.object(
                self.mod, "set_runtime_timezone"
            ), patch.object(self.mod, "sp_client", return_value=(object(), "token_123")), patch.object(
                self.mod, "build_queue_for_profile", return_value=[]
            ):
                rc = self.mod.main()

        self.assertEqual(rc, 1)


if __name__ == "__main__":
    unittest.main()
