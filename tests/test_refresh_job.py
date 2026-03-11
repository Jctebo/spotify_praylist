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

    def test_spotify_value_to_bookmark_url_normalizes_supported_inputs(self):
        self.assertEqual(
            self.mod.spotify_value_to_bookmark_url("spotify:episode:abc123"),
            "https://open.spotify.com/episode/abc123",
        )
        self.assertEqual(
            self.mod.spotify_value_to_bookmark_url("https://open.spotify.com/track/xyz789?si=test"),
            "https://open.spotify.com/track/xyz789",
        )
        self.assertEqual(
            self.mod.spotify_value_to_bookmark_url("https://open.spotify.com/embed/episode/def456"),
            "https://open.spotify.com/episode/def456",
        )
        self.assertIsNone(self.mod.spotify_value_to_bookmark_url("not spotify"))

    def test_notion_sync_spotify_bookmark_replaces_existing_spotify_link_block(self):
        blocks = [
            {"id": "block_existing", "type": "embed", "embed": {"url": "https://open.spotify.com/embed/episode/old1"}},
            {"id": "block_para", "type": "paragraph", "paragraph": {"rich_text": []}},
        ]
        archived = []
        appended = []

        def fake_append(parent_id, children, token, position="end"):
            appended.append((parent_id, children, token, position))

        with patch.object(self.mod, "notion_list_block_children", return_value=blocks), patch.object(
            self.mod, "notion_archive_block", side_effect=lambda block_id, token: archived.append((block_id, token))
        ), patch.object(self.mod, "notion_append_children", side_effect=fake_append):
            updated, removed = self.mod.notion_sync_spotify_bookmark(
                "page_1", "spotify:episode:new2", "notion_token"
            )

        self.assertTrue(updated)
        self.assertFalse(removed)
        self.assertEqual(archived, [("block_existing", "notion_token")])
        self.assertEqual(len(appended), 1)
        self.assertEqual(appended[0][0], "page_1")
        self.assertEqual(appended[0][2], "notion_token")
        self.assertEqual(appended[0][3], "start")
        self.assertEqual(
            appended[0][1],
            [
                {
                    "object": "block",
                    "type": "bookmark",
                    "bookmark": {"url": "https://open.spotify.com/episode/new2"},
                }
            ],
        )

    def test_notion_sync_spotify_bookmark_replaces_legacy_embed_even_when_url_matches(self):
        blocks = [
            {
                "id": "block_existing",
                "type": "embed",
                "embed": {"url": "https://open.spotify.com/embed/episode/same1"},
            }
        ]
        archived = []
        appended = []

        def fake_append(parent_id, children, token, position="end"):
            appended.append((parent_id, children, token, position))

        with patch.object(self.mod, "notion_list_block_children", return_value=blocks), patch.object(
            self.mod, "notion_archive_block", side_effect=lambda block_id, token: archived.append((block_id, token))
        ), patch.object(self.mod, "notion_append_children", side_effect=fake_append):
            updated, removed = self.mod.notion_sync_spotify_bookmark(
                "page_1", "spotify:episode:same1", "notion_token"
            )

        self.assertTrue(updated)
        self.assertFalse(removed)
        self.assertEqual(archived, [("block_existing", "notion_token")])
        self.assertEqual(
            appended[0][1],
            [
                {
                    "object": "block",
                    "type": "bookmark",
                    "bookmark": {"url": "https://open.spotify.com/episode/same1"},
                }
            ],
        )

    def test_sync_notion_spotify_bookmarks_updates_only_spotify_rows(self):
        env = {
            "NOTION_TOKEN": "notion_token",
            "NOTION_DATABASE_ID": "db_1",
        }
        pages = [
            {
                "id": "page_spotify",
                "properties": {
                    "Name": _title_prop("Spotify Morning Prayer"),
                    "Platform": _select_prop("spotify"),
                    "Spotify Resolver": _rich_text_prop("MORNING"),
                    "Spotify Fallback Resolver": _rich_text_prop(""),
                    "URI": _rich_text_prop(""),
                },
            },
            {
                "id": "page_hallow",
                "properties": {
                    "Name": _title_prop("Hallow Rosary"),
                    "Platform": _select_prop("hallow"),
                    "Spotify Resolver": _rich_text_prop("HALLOW"),
                    "Spotify Fallback Resolver": _rich_text_prop(""),
                    "URI": _rich_text_prop(""),
                },
            },
        ]
        synced = []

        def fake_sync(page_id, embed_url, token):
            synced.append((page_id, embed_url, token))
            return True, False

        with temp_env(env):
            with patch.object(self.mod, "notion_get_all_pages", return_value=pages), patch.object(
                self.mod, "resolve_spec_uri", return_value="spotify:episode:morning123"
            ), patch.object(self.mod, "notion_sync_spotify_bookmark", side_effect=fake_sync):
                updated, removed, details, unresolved = self.mod.sync_notion_spotify_bookmarks(
                    object(), "Wednesday", {}, {}, {}
                )

        self.assertEqual(updated, 1)
        self.assertEqual(removed, 0)
        self.assertEqual(
            details,
            [("Spotify Morning Prayer", "https://open.spotify.com/episode/morning123")],
        )
        self.assertEqual(unresolved, [])
        self.assertEqual(synced, [("page_spotify", "spotify:episode:morning123", "notion_token")])

    def test_sunday_homily_resolvers_use_latest_available_episode_on_weekdays(self):
        status = {}

        def fake_latest(sp, show_id):
            return (f"spotify:episode:{show_id}", f"Latest {show_id}")

        with patch.object(self.mod, "latest_by_release_date", side_effect=fake_latest):
            fr_uri = self.mod.resolve_item_uri(
                object(),
                "SUNDAY_FRMIKE",
                "Wednesday",
                status,
                {"FRMIKE_SUNDAY": "fr_show", "BARRON_SUNDAY": "barron_show"},
                {},
                {},
            )
            barron_uri = self.mod.resolve_item_uri(
                object(),
                "SUNDAY_BARRON",
                "Wednesday",
                status,
                {"FRMIKE_SUNDAY": "fr_show", "BARRON_SUNDAY": "barron_show"},
                {},
                {},
            )

        self.assertEqual(fr_uri, "spotify:episode:fr_show")
        self.assertEqual(barron_uri, "spotify:episode:barron_show")
        self.assertTrue(status["Fr. Mike Sunday Homily"])
        self.assertTrue(status["Bp. Barron Sunday Sermon"])

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
                self.mod, "sync_notion_spotify_bookmarks", return_value=(0, 0, [], [])
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
                self.mod, "sync_notion_spotify_bookmarks", return_value=(0, 0, [], [])
            ), patch.object(
                self.mod, "distribute_prayer_intentions", return_value=(0, 0, 0)
            ):
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        load_playlists_mock.assert_called_once_with("notion_token", "Commute")
        recreate_mock.assert_called_once_with("token_123", "override123", ["spotify:track:111"])


if __name__ == "__main__":
    unittest.main()
