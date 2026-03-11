import unittest
from unittest.mock import patch

from tests.test_helpers import load_module, temp_env


def _title_prop(text):
    return {"type": "title", "title": [{"plain_text": text}]}


def _select_prop(name):
    return {"type": "select", "select": {"name": name}}


def _checkbox_prop(value):
    return {"type": "checkbox", "checkbox": bool(value)}


def _rich_text_prop(text):
    return {"type": "rich_text", "rich_text": [{"plain_text": text}]}


def _number_prop(value):
    return {"type": "number", "number": value}


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
            "SPOTIFY_REFRESH_CONFIG_SOURCE": "file",
        }
        queue = ["spotify:track:111", "spotify:episode:222"]

        with temp_env(env):
            with patch.object(self.mod, "load_playlist_config_optional", return_value=self.cfg), patch.object(
                self.mod, "set_runtime_timezone"
            ), patch.object(self.mod, "sp_client", return_value=(object(), "token_123")), patch.object(
                self.mod, "build_queue_for_profile", return_value=queue
            ), patch.object(
                self.mod, "recreate_playlist_items", return_value=len(queue)
            ) as recreate_mock, patch.object(self.mod, "sync_notion_uris_for_playlist", return_value=(0, [], [], [])), patch.object(
                self.mod, "distribute_prayer_intentions", return_value=(0, 0, 0)
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
            "SPOTIFY_REFRESH_CONFIG_SOURCE": "file",
        }

        with temp_env(env):
            with patch.object(self.mod, "load_playlist_config_optional", return_value=self.cfg), patch.object(
                self.mod, "set_runtime_timezone"
            ), patch.object(self.mod, "sp_client", return_value=(object(), "token_123")), patch.object(
                self.mod, "build_queue_for_profile", return_value=[]
            ):
                rc = self.mod.main()

        self.assertEqual(rc, 1)

    def test_build_queue_for_playlist_from_notion_skips_non_spotify_rows(self):
        env = {
            "NOTION_TOKEN": "notion_token",
            "NOTION_DATABASE_ID": "db_1",
        }
        pages = [
            {
                "properties": {
                    "Name": _title_prop("Spotify Morning Prayer"),
                    "Platform": _select_prop("spotify"),
                    "Playlist": _rich_text_prop("Morning"),
                    "Playlist Order": _number_prop(2),
                    "Spotify Resolver": _rich_text_prop("MORNING"),
                    "Enabled": _checkbox_prop(True),
                    "URI": _rich_text_prop(""),
                }
            },
            {
                "properties": {
                    "Name": _title_prop("Hallow Rosary"),
                    "Platform": _select_prop("hallow"),
                    "Playlist": _rich_text_prop("Morning"),
                    "Playlist Order": _number_prop(1),
                    "Spotify Resolver": _rich_text_prop("HALLOW"),
                    "Enabled": _checkbox_prop(True),
                    "URI": _rich_text_prop(""),
                }
            },
            {
                "properties": {
                    "Name": _title_prop("Commute Prayer"),
                    "Platform": _select_prop("spotify"),
                    "Playlist": _rich_text_prop("Commute"),
                    "Playlist Order": _number_prop(1),
                    "Spotify Resolver": _rich_text_prop("COMMUTE"),
                    "Enabled": _checkbox_prop(True),
                    "URI": _rich_text_prop(""),
                }
            },
        ]

        def fake_resolve(sp, resolver, weekday, status, shows_cfg, fixed_cfg, tokens_cfg):
            return f"spotify:episode:{resolver.lower()}"

        with temp_env(env):
            with patch.object(self.mod, "notion_get_all_pages", return_value=pages), patch.object(
                self.mod, "resolve_spec_uri", side_effect=fake_resolve
            ):
                queue = self.mod.build_queue_for_playlist_from_notion(
                    object(), "Morning", "Wednesday", {}, {}, {}, {}
                )

        self.assertEqual(queue, ["spotify:episode:morning"])

    def test_main_notion_refreshes_all_enabled_playlists(self):
        env = {
            "SPOTIFY_CLIENT_ID": "cid",
            "SPOTIFY_CLIENT_SECRET": "secret",
            "SPOTIFY_REFRESH_TOKEN": "refresh",
            "SPOTIFY_REFRESH_CONFIG_SOURCE": "notion",
            "NOTION_TOKEN": "notion_token",
        }
        queues = {
            "Morning": ["spotify:track:111"],
            "Commute": ["spotify:episode:222", "spotify:episode:333"],
        }
        recreate_calls = []

        def fake_build(sp, playlist_name, weekday, status, shows_cfg, fixed_cfg, tokens_cfg):
            return list(queues[playlist_name])

        def fake_recreate(token, playlist_id, queue):
            recreate_calls.append((token, playlist_id, list(queue)))
            return len(queue)

        with temp_env(env):
            with patch.object(self.mod, "load_playlist_config_optional", return_value=self.cfg), patch.object(
                self.mod, "set_runtime_timezone"
            ), patch.object(self.mod, "sp_client", return_value=(object(), "token_123")), patch.object(
                self.mod, "load_notion_playlists",
                return_value=[
                    {"name": "Morning", "playlist_id": "playlist_morning"},
                    {"name": "Commute", "playlist_id": "playlist_commute"},
                ],
            ), patch.object(
                self.mod, "build_queue_for_playlist_from_notion", side_effect=fake_build
            ), patch.object(
                self.mod, "recreate_playlist_items", side_effect=fake_recreate
            ), patch.object(
                self.mod, "sync_notion_uris_for_playlist", return_value=(0, [], [], [])
            ), patch.object(
                self.mod, "distribute_prayer_intentions", return_value=(0, 0, 0)
            ):
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        self.assertEqual(
            recreate_calls,
            [
                ("token_123", "playlist_morning", ["spotify:track:111"]),
                ("token_123", "playlist_commute", ["spotify:episode:222", "spotify:episode:333"]),
            ],
        )

    def test_main_notion_single_playlist_filter_uses_override_id(self):
        env = {
            "SPOTIFY_CLIENT_ID": "cid",
            "SPOTIFY_CLIENT_SECRET": "secret",
            "SPOTIFY_REFRESH_TOKEN": "refresh",
            "SPOTIFY_REFRESH_CONFIG_SOURCE": "notion",
            "NOTION_TOKEN": "notion_token",
            "SPOTIFY_PLAYLIST_NAME": "Commute",
            "SPOTIFY_PLAYLIST_ID": "spotify:playlist:override123",
        }

        with temp_env(env):
            with patch.object(self.mod, "load_playlist_config_optional", return_value=self.cfg), patch.object(
                self.mod, "set_runtime_timezone"
            ), patch.object(self.mod, "sp_client", return_value=(object(), "token_123")), patch.object(
                self.mod, "load_notion_playlists", return_value=[{"name": "Commute", "playlist_id": "playlist_commute"}]
            ) as load_playlists_mock, patch.object(
                self.mod, "build_queue_for_playlist_from_notion", return_value=["spotify:track:111"]
            ), patch.object(
                self.mod, "recreate_playlist_items", return_value=1
            ) as recreate_mock, patch.object(
                self.mod, "sync_notion_uris_for_playlist", return_value=(0, [], [], [])
            ), patch.object(
                self.mod, "distribute_prayer_intentions", return_value=(0, 0, 0)
            ):
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        load_playlists_mock.assert_called_once_with("notion_token", "Commute")
        recreate_mock.assert_called_once_with("token_123", "override123", ["spotify:track:111"])


if __name__ == "__main__":
    unittest.main()
