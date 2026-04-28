import datetime
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests

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


def _queue_contract(
    mod,
    key,
    notion_name=None,
    resolver="",
    fallback_resolver="",
    spotify_uri="",
    spotify_url_normal="",
    spotify_uri_easter="",
    weekdays=(),
):
    display_name = notion_name or key.title()
    return mod.SpotifyQueueContract(
        key=key,
        notion_name=display_name,
        resolver=resolver,
        fallback_resolver=fallback_resolver,
        spotify_uri=spotify_uri,
        spotify_url_normal=spotify_url_normal,
        spotify_uri_easter=spotify_uri_easter,
        weekdays=tuple(weekdays),
        source_path=Path(f"config/spotify/contracts/{key}.json"),
    )


def _playlist_definition(mod, key, name=None, playlist_id=None, contracts=()):
    display_name = name or key.title()
    return mod.SpotifyPlaylistDefinition(
        key=key,
        name=display_name,
        playlist_id=playlist_id or f"{key}_playlist",
        contracts=tuple(contracts),
        source_path=Path(f"config/spotify/playlists/{key}.json"),
    )


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
            "NOTION_TOKEN": "notion_token",
        }
        queue = ["spotify:track:111", "spotify:episode:222"]
        contracts = [_queue_contract(self.mod, "morning-prayer-loh", notion_name="Morning Prayer (LOH)", resolver="MORNING")]
        playlists = [
            _playlist_definition(
                self.mod,
                "morning",
                name="Morning",
                playlist_id="playlist_123",
                contracts=("morning-prayer-loh",),
            )
        ]

        with temp_env(env):
            with patch.object(self.mod, "set_runtime_timezone"), patch.object(
                self.mod, "sp_client", return_value=(object(), "token_123")
            ), patch.object(self.mod, "load_spotify_queue_contracts", return_value=contracts), patch.object(
                self.mod, "load_spotify_playlist_definitions", return_value=playlists
            ), patch.object(
                self.mod, "build_queue_for_playlist_definition", return_value=queue
            ), patch.object(
                self.mod,
                "build_notion_playlist_memberships",
                return_value=self.mod.NotionPlaylistMembershipBuild(
                    contracts_by_playlist={"morning": tuple(contracts)},
                    stats={},
                ),
            ), patch.object(
                self.mod, "recreate_playlist_items", return_value=len(queue)
            ) as recreate_mock, patch.object(
                self.mod, "sync_notion_uris_for_playlist"
            ) as autosync_mock, patch.object(self.mod, "distribute_prayer_intentions", return_value=(0, 0, 0)) as intentions_mock:
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        recreate_mock.assert_called_once_with("token_123", "playlist_123", queue)
        autosync_mock.assert_not_called()
        intentions_mock.assert_called_once_with("Morning")

    def test_main_fails_when_queue_empty(self):
        env = {
            "SPOTIFY_CLIENT_ID": "cid",
            "SPOTIFY_CLIENT_SECRET": "secret",
            "SPOTIFY_REFRESH_TOKEN": "refresh",
            "NOTION_TOKEN": "notion_token",
        }
        contracts = [_queue_contract(self.mod, "morning-prayer-loh", resolver="MORNING")]
        playlists = [
            _playlist_definition(
                self.mod,
                "morning",
                name="Morning",
                playlist_id="playlist_123",
                contracts=("morning-prayer-loh",),
            )
        ]

        with temp_env(env):
            with patch.object(self.mod, "set_runtime_timezone"), patch.object(
                self.mod, "sp_client", return_value=(object(), "token_123")
            ), patch.object(self.mod, "load_spotify_queue_contracts", return_value=contracts), patch.object(
                self.mod, "load_spotify_playlist_definitions", return_value=playlists
            ), patch.object(
                self.mod, "build_queue_for_playlist_definition", return_value=[]
            ), patch.object(
                self.mod,
                "build_notion_playlist_memberships",
                return_value=self.mod.NotionPlaylistMembershipBuild(
                    contracts_by_playlist={"morning": tuple(contracts)},
                    stats={},
                ),
            ):
                rc = self.mod.main()

        self.assertEqual(rc, 1)

    def test_contract_runs_today_honors_weekday_lists(self):
        daily = _queue_contract(self.mod, "rosary", resolver="ROSARY")
        sunday_only = _queue_contract(self.mod, "fr-mike-sunday-homily", resolver="SUNDAY_FRMIKE", weekdays=("Sunday",))

        self.assertTrue(self.mod.contract_runs_today(daily, "Wednesday"))
        self.assertTrue(self.mod.contract_runs_today(sunday_only, "Sunday"))
        self.assertFalse(self.mod.contract_runs_today(sunday_only, "Wednesday"))

    def test_build_queue_for_playlist_definition_uses_fallback_resolver(self):
        playlist_definition = _playlist_definition(
            self.mod,
            "morning",
            contracts=("morning-prayer-loh", "rosary"),
        )
        contracts_by_key = {
            "morning-prayer-loh": _queue_contract(
                self.mod,
                "morning-prayer-loh",
                notion_name="Morning Prayer (LOH)",
                resolver="MORNING",
                fallback_resolver="DO_MORNING",
            ),
            "rosary": _queue_contract(self.mod, "rosary", resolver="ROSARY"),
        }
        status = {}

        def fake_resolve(sp, spec, weekday, status_map, shows_cfg, fixed_cfg, tokens_cfg):
            if spec == "MORNING":
                return None
            return f"spotify:episode:{spec.lower().replace('_', '')}"

        with patch.object(self.mod, "resolve_spec_uri", side_effect=fake_resolve):
            queue = self.mod.build_queue_for_playlist_definition(
                object(),
                playlist_definition,
                "Wednesday",
                datetime.date(2026, 6, 7),
                status,
                {},
                {},
                {},
                ordered_contracts=tuple(contracts_by_key.values()),
            )

        self.assertEqual(queue, ["spotify:episode:domorning", "spotify:episode:rosary"])
        self.assertTrue(status["Fallback used:Morning Prayer (LOH)"])

    def test_build_queue_for_playlist_definition_marks_all_gated_playlists(self):
        playlist_definition = _playlist_definition(
            self.mod,
            "sunday",
            contracts=("fr-mike-sunday-homily",),
        )
        contracts_by_key = {
            "fr-mike-sunday-homily": _queue_contract(
                self.mod,
                "fr-mike-sunday-homily",
                notion_name="Fr. Mike Sunday Homily",
                resolver="SUNDAY_FRMIKE",
                weekdays=("Sunday",),
            )
        }
        status = {}

        queue = self.mod.build_queue_for_playlist_definition(
            object(),
            playlist_definition,
            "Wednesday",
            datetime.date(2026, 6, 7),
            status,
            {},
            {},
            {},
            ordered_contracts=tuple(contracts_by_key.values()),
        )

        self.assertEqual(queue, [])
        self.assertTrue(status["__no_eligible_contracts__"])
        self.assertFalse(status["Gated:Fr. Mike Sunday Homily"])

    def test_build_queue_for_playlist_definition_selects_angelus_variant_by_season(self):
        playlist_definition = _playlist_definition(
            self.mod,
            "morning",
            contracts=("angelus-morning", "angelus-midday", "angelus-evening"),
        )
        contracts_by_key = {
            "angelus-morning": _queue_contract(
                self.mod,
                "angelus-morning",
                notion_name="Marian Antiphon (Morning)",
                spotify_url_normal="spotify:track:39Jgl6ST4fQj4fNyRSQZFk",
                spotify_uri_easter="spotify:episode:7ni2KH5KdbtK0JFL74V8x3",
            ),
            "angelus-midday": _queue_contract(
                self.mod,
                "angelus-midday",
                notion_name="Marian Antiphon (Midday)",
                spotify_url_normal="spotify:episode:2HNK8wLRWHh0mJ9xmJjlUD",
                spotify_uri_easter="spotify:episode:68xFE8g1JRFu62osp0tLNg",
            ),
            "angelus-evening": _queue_contract(
                self.mod,
                "angelus-evening",
                notion_name="Marian Antiphon (Evening)",
                spotify_url_normal="spotify:track:39Jgl6ST4fQj4fNyRSQZFk",
                spotify_uri_easter="spotify:episode:7ni2KH5KdbtK0JFL74V8x3",
            )
        }

        ordinary_status = {}
        easter_status = {}

        def fake_is_easter(calendar, locale, dt):
            return dt == datetime.date(2026, 4, 5)

        with patch.object(self.mod, "is_easter_season_for_date", side_effect=fake_is_easter):
            ordinary_queue = self.mod.build_queue_for_playlist_definition(
                object(),
                playlist_definition,
                "Wednesday",
                datetime.date(2026, 6, 7),
                ordinary_status,
                {},
                {},
                {},
                ordered_contracts=tuple(contracts_by_key.values()),
            )
            easter_queue = self.mod.build_queue_for_playlist_definition(
                object(),
                playlist_definition,
                "Wednesday",
                datetime.date(2026, 4, 5),
                easter_status,
                {},
                {},
                {},
                ordered_contracts=tuple(contracts_by_key.values()),
            )

        self.assertEqual(
            ordinary_queue,
            [
                "spotify:track:39Jgl6ST4fQj4fNyRSQZFk",
                "spotify:episode:2HNK8wLRWHh0mJ9xmJjlUD",
                "spotify:track:39Jgl6ST4fQj4fNyRSQZFk",
            ],
        )
        self.assertEqual(
            easter_queue,
            [
                "spotify:episode:7ni2KH5KdbtK0JFL74V8x3",
                "spotify:episode:68xFE8g1JRFu62osp0tLNg",
                "spotify:episode:7ni2KH5KdbtK0JFL74V8x3",
            ],
        )
        self.assertTrue(ordinary_status["Seasonal:Marian Antiphon (Morning):ordinary"])
        self.assertTrue(ordinary_status["Seasonal:Marian Antiphon (Midday):ordinary"])
        self.assertTrue(ordinary_status["Seasonal:Marian Antiphon (Evening):ordinary"])
        self.assertTrue(easter_status["Seasonal:Marian Antiphon (Morning):easter"])
        self.assertTrue(easter_status["Seasonal:Marian Antiphon (Midday):easter"])
        self.assertTrue(easter_status["Seasonal:Marian Antiphon (Evening):easter"])

    def test_shared_order_contract_normalizes_integer_display(self):
        self.assertEqual(self.mod.prayer_order_contract.format_top_level_order(2.0), "2")
        self.assertEqual(self.mod.prayer_order_contract.format_top_level_order(1.01), "1.01")

    def test_build_notion_playlist_memberships_groups_checked_rows_by_output_folder_and_order(self):
        contracts = [
            _queue_contract(self.mod, "second", notion_name="Second", resolver="SECOND"),
            _queue_contract(self.mod, "inactive", notion_name="Inactive", resolver="INACTIVE"),
            _queue_contract(self.mod, "first", notion_name="First", resolver="FIRST"),
            _queue_contract(self.mod, "night", notion_name="Night Prayer", resolver="NIGHT"),
            _queue_contract(self.mod, "unplaced", notion_name="Unplaced", resolver="UNPLACED"),
        ]
        playlists = [
            _playlist_definition(self.mod, "morning", name="Morning", playlist_id="playlist_morning"),
            _playlist_definition(self.mod, "night", name="Night", playlist_id="playlist_night"),
        ]
        pages = [
            {
                "id": "page_second",
                "properties": {
                    "Name": _title_prop("Second"),
                    "Enabled": _checkbox_prop(True),
                    "Output Folder": _rich_text_prop("Morning"),
                    "Order": _number_prop(2),
                },
            },
            {
                "id": "page_first",
                "properties": {
                    "Name": _title_prop("First"),
                    "Enabled": _checkbox_prop(True),
                    "Output Folder": _rich_text_prop("Morning"),
                    "Order": _number_prop(1),
                },
            },
            {
                "id": "page_night",
                "properties": {
                    "Name": _title_prop("Night Prayer"),
                    "Enabled": _checkbox_prop(True),
                    "Output Folder": _rich_text_prop("Night"),
                    "Order": _number_prop(3),
                },
            },
            {
                "id": "page_disabled",
                "properties": {
                    "Name": _title_prop("Inactive"),
                    "Enabled": _checkbox_prop(False),
                    "Output Folder": _rich_text_prop("Morning"),
                    "Order": _number_prop(4),
                },
            },
            {
                "id": "page_missing_enabled",
                "properties": {
                    "Name": _title_prop("Missing Enabled"),
                    "Output Folder": _rich_text_prop("Morning"),
                    "Order": _number_prop(5),
                },
            },
            {
                "id": "page_unplaced",
                "properties": {
                    "Name": _title_prop("Unplaced"),
                    "Enabled": _checkbox_prop(True),
                    "Order": _number_prop(6),
                },
            },
        ]

        with temp_env({"NOTION_DATABASE_ID": "db_1"}):
            with patch.object(self.mod, "notion_get_all_pages", return_value=pages):
                build = self.mod.build_notion_playlist_memberships("notion_token", contracts, playlists)

        self.assertEqual(
            [contract.key for contract in build.contracts_by_playlist["morning"]],
            ["first", "second"],
        )
        self.assertEqual([contract.key for contract in build.contracts_by_playlist["night"]], ["night"])
        self.assertEqual(build.stats["checked_rows"], 4)
        self.assertEqual(build.stats["ignored_non_enabled_rows"], 2)
        self.assertEqual(build.stats["ignored_missing_output_folder_rows"], 1)
        self.assertEqual(build.stats["inactive_contracts"], 1)

    def test_build_notion_playlist_memberships_fails_on_duplicate_checked_title(self):
        contracts = [_queue_contract(self.mod, "first", notion_name="First", resolver="FIRST")]
        playlists = [_playlist_definition(self.mod, "morning", name="Morning", playlist_id="playlist_morning")]
        pages = [
            {
                "id": "page_1",
                "properties": {
                    "Name": _title_prop("First"),
                    "Enabled": _checkbox_prop(True),
                    "Output Folder": _rich_text_prop("Morning"),
                    "Order": _number_prop(1),
                },
            },
            {
                "id": "page_2",
                "properties": {
                    "Name": _title_prop("First"),
                    "Enabled": _checkbox_prop(True),
                    "Output Folder": _rich_text_prop("Morning"),
                    "Order": _number_prop(2),
                },
            },
        ]

        with temp_env({"NOTION_DATABASE_ID": "db_1"}):
            with patch.object(self.mod, "notion_get_all_pages", return_value=pages):
                with self.assertRaisesRegex(RuntimeError, "Multiple checked Notion rows"):
                    self.mod.build_notion_playlist_memberships("notion_token", contracts, playlists)

    def test_build_notion_playlist_memberships_fails_on_bad_folder_or_order(self):
        contracts = [_queue_contract(self.mod, "first", notion_name="First", resolver="FIRST")]
        playlists = [_playlist_definition(self.mod, "morning", name="Morning", playlist_id="playlist_morning")]

        with temp_env({"NOTION_DATABASE_ID": "db_1"}):
            with patch.object(
                self.mod,
                "notion_get_all_pages",
                return_value=[
                    {
                        "id": "page_1",
                        "properties": {
                            "Name": _title_prop("First"),
                            "Enabled": _checkbox_prop(True),
                            "Output Folder": _rich_text_prop("Unknown"),
                            "Order": _number_prop(1),
                        },
                    }
                ],
            ):
                with self.assertRaisesRegex(RuntimeError, "unknown 'Output Folder'"):
                    self.mod.build_notion_playlist_memberships("notion_token", contracts, playlists)

            with patch.object(
                self.mod,
                "notion_get_all_pages",
                return_value=[
                    {
                        "id": "page_1",
                        "properties": {
                            "Name": _title_prop("First"),
                            "Enabled": _checkbox_prop(True),
                            "Output Folder": _rich_text_prop("Morning"),
                        },
                    }
                ],
            ):
                with self.assertRaisesRegex(RuntimeError, "missing 'Order'"):
                    self.mod.build_notion_playlist_memberships("notion_token", contracts, playlists)

    def test_spotify_value_to_bookmark_url_normalizes_supported_inputs(self):
        self.assertEqual(
            self.mod.spotify_value_to_bookmark_url("spotify:episode:abc123"),
            "https://open.spotify.com/episode/abc123",
        )
        self.assertEqual(
            self.mod.spotify_value_to_bookmark_url("https://open.spotify.com/track/xyz789?si=test"),
            "https://open.spotify.com/track/xyz789?si=test",
        )
        self.assertEqual(
            self.mod.spotify_value_to_bookmark_url("https://open.spotify.com/embed/episode/def456?si=share1"),
            "https://open.spotify.com/episode/def456?si=share1",
        )
        self.assertIsNone(self.mod.spotify_value_to_bookmark_url("not spotify"))

    def test_spotify_value_to_bookmark_compare_url_strips_share_query(self):
        self.assertEqual(
            self.mod.spotify_value_to_bookmark_compare_url("https://open.spotify.com/track/xyz789?si=test"),
            "https://open.spotify.com/track/xyz789",
        )
        self.assertEqual(
            self.mod.spotify_value_to_bookmark_compare_url("https://open.spotify.com/embed/episode/def456?si=share1"),
            "https://open.spotify.com/episode/def456",
        )

    def test_notion_sync_spotify_bookmark_replaces_existing_spotify_link_block(self):
        blocks = [
            {"id": "block_existing", "type": "bookmark", "bookmark": {"url": "https://open.spotify.com/episode/old1"}},
            {"id": "block_para", "type": "paragraph", "paragraph": {"rich_text": []}},
        ]
        archived = []
        appended = []
        patched = []

        def fake_append(parent_id, children, token, position="end", after=""):
            appended.append((parent_id, children, token, position, after))

        with patch.object(self.mod, "notion_list_block_children", return_value=blocks), patch.object(
            self.mod, "notion_archive_block", side_effect=lambda block_id, token: archived.append((block_id, token))
        ), patch.object(
            self.mod, "notion_update_bookmark_block", side_effect=lambda block_id, url, token, caption="": patched.append((block_id, url, token, caption))
        ), patch.object(self.mod, "notion_append_children", side_effect=fake_append):
            updated, removed = self.mod.notion_sync_spotify_bookmark(
                "page_1", "spotify:episode:new2", "notion_token"
            )

        self.assertTrue(updated)
        self.assertFalse(removed)
        self.assertEqual(
            patched,
            [("block_existing", "https://open.spotify.com/episode/new2", "notion_token", "")],
        )
        self.assertEqual(archived, [])
        self.assertEqual(appended, [])

    def test_notion_call_retries_timeout(self):
        success_response = Mock()
        success_response.raise_for_status.return_value = None
        success_response.json.return_value = {"results": []}

        with patch.object(
            self.mod.requests,
            "request",
            side_effect=[requests.exceptions.Timeout("timed out"), success_response],
        ) as request_mock, patch.object(self.mod.time, "sleep") as sleep_mock:
            data = self.mod.notion_call("GET", "https://api.notion.com/v1/pages/page_1", "token")

        self.assertEqual(data, {"results": []})
        self.assertEqual(request_mock.call_count, 2)
        sleep_mock.assert_called_once_with(1.0)

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
        patched = []

        def fake_append(parent_id, children, token, position="end", after=""):
            appended.append((parent_id, children, token, position, after))

        with patch.object(self.mod, "notion_list_block_children", return_value=blocks), patch.object(
            self.mod, "notion_archive_block", side_effect=lambda block_id, token: archived.append((block_id, token))
        ), patch.object(
            self.mod, "notion_update_bookmark_block", side_effect=lambda block_id, url, token, caption="": patched.append((block_id, url, token, caption))
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
        self.assertEqual(patched, [])

    def test_notion_sync_spotify_bookmark_preserves_existing_share_url_and_caption(self):
        blocks = [
            {
                "id": "block_existing",
                "type": "bookmark",
                "bookmark": {"url": "https://open.spotify.com/episode/same1?si=share123", "caption": []},
            }
        ]
        archived = []
        appended = []
        patched = []

        def fake_append(parent_id, children, token, position="end", after=""):
            appended.append((parent_id, children, token, position, after))

        with patch.object(self.mod, "notion_list_block_children", return_value=blocks), patch.object(
            self.mod, "notion_archive_block", side_effect=lambda block_id, token: archived.append((block_id, token))
        ), patch.object(
            self.mod, "notion_update_bookmark_block", side_effect=lambda block_id, url, token, caption="": patched.append((block_id, url, token, caption))
        ), patch.object(self.mod, "notion_append_children", side_effect=fake_append):
            updated, removed = self.mod.notion_sync_spotify_bookmark(
                "page_1", "spotify:episode:same1", "notion_token", "Resolved Episode Title"
            )

        self.assertTrue(updated)
        self.assertFalse(removed)
        self.assertEqual(archived, [])
        self.assertEqual(appended, [])
        self.assertEqual(
            patched,
            [
                (
                    "block_existing",
                    "https://open.spotify.com/episode/same1?si=share123",
                    "notion_token",
                    "Resolved Episode Title",
                )
            ],
        )

    def test_notion_sync_spotify_bookmark_updates_non_top_bookmark_in_place(self):
        blocks = [
            {"id": "intro_block", "type": "paragraph", "paragraph": {"rich_text": []}},
            {
                "id": "block_existing",
                "type": "bookmark",
                "bookmark": {"url": "https://open.spotify.com/episode/old1", "caption": []},
            },
        ]
        archived = []
        appended = []
        patched = []

        with patch.object(self.mod, "notion_list_block_children", return_value=blocks), patch.object(
            self.mod, "notion_archive_block", side_effect=lambda block_id, token: archived.append((block_id, token))
        ), patch.object(
            self.mod, "notion_update_bookmark_block", side_effect=lambda block_id, url, token, caption="": patched.append((block_id, url, token, caption))
        ), patch.object(self.mod, "notion_append_children", side_effect=lambda *args, **kwargs: appended.append((args, kwargs))):
            updated, removed = self.mod.notion_sync_spotify_bookmark(
                "page_1", "spotify:episode:new2", "notion_token", "New Title"
            )

        self.assertTrue(updated)
        self.assertFalse(removed)
        self.assertEqual(
            patched,
            [("block_existing", "https://open.spotify.com/episode/new2", "notion_token", "New Title")],
        )
        self.assertEqual(archived, [])
        self.assertEqual(appended, [])

    def test_notion_sync_spotify_bookmark_adds_playlist_block_under_primary(self):
        blocks = [
            {
                "id": "block_existing",
                "type": "bookmark",
                "bookmark": {"url": "https://open.spotify.com/episode/old1", "caption": []},
            }
        ]
        archived = []
        patched = []
        appended = []

        def fake_append(parent_id, children, token, position="end", after=""):
            appended.append((parent_id, children, token, position, after))
            return {"results": [{"id": "playlist_block_new"}]}

        with patch.object(self.mod, "notion_list_block_children", return_value=blocks), patch.object(
            self.mod, "notion_archive_block", side_effect=lambda block_id, token: archived.append((block_id, token))
        ), patch.object(
            self.mod, "notion_update_bookmark_block", side_effect=lambda block_id, url, token, caption="": patched.append((block_id, url, token, caption))
        ), patch.object(self.mod, "notion_append_children", side_effect=fake_append):
            updated, removed = self.mod.notion_sync_spotify_bookmark(
                "page_1",
                "spotify:episode:new2",
                "notion_token",
                "Track Title",
                playlist_url="https://open.spotify.com/playlist/playlist123",
                playlist_caption="Morning",
            )

        self.assertTrue(updated)
        self.assertFalse(removed)
        self.assertEqual(
            patched,
            [("block_existing", "https://open.spotify.com/episode/new2", "notion_token", "Track Title")],
        )
        self.assertEqual(archived, [])
        self.assertEqual(
            appended,
            [
                (
                    "page_1",
                    [
                        {
                            "object": "block",
                            "type": "bookmark",
                            "bookmark": {
                                "url": "https://open.spotify.com/playlist/playlist123",
                                "caption": [{"type": "text", "text": {"content": "Morning"}}],
                            },
                        }
                    ],
                    "notion_token",
                    "end",
                    "block_existing",
                )
            ],
        )

    def test_notion_sync_playlist_novena_link_adds_bookmark_block(self):
        appended = []

        def fake_append(parent_id, children, token, position="end", after=""):
            appended.append((parent_id, children, token, position, after))

        with patch.object(self.mod, "notion_list_block_children", return_value=[]), patch.object(
            self.mod, "notion_append_children", side_effect=fake_append
        ):
            changed = self.mod.notion_sync_playlist_novena_link(
                "playlist_page_1",
                "novena_page_1",
                "https://www.notion.so/novena_page_1",
                "notion_token",
            )

        self.assertTrue(changed)
        self.assertEqual(
            appended,
            [
                (
                    "playlist_page_1",
                    [
                        {
                            "object": "block",
                            "type": "bookmark",
                            "bookmark": {"url": "https://www.notion.so/novena_page_1"},
                        }
                    ],
                    "notion_token",
                    "start",
                    "",
                )
            ],
        )

    def test_notion_sync_playlist_novena_link_replaces_legacy_link_to_page(self):
        appended = []

        def fake_append(parent_id, children, token, position="end", after=""):
            appended.append((parent_id, children, token, position, after))

        existing_blocks = [
            {
                "id": "legacy_link_1",
                "type": "link_to_page",
                "link_to_page": {"type": "page_id", "page_id": "novena_page_1"},
            }
        ]

        with patch.object(self.mod, "notion_list_block_children", return_value=existing_blocks), patch.object(
            self.mod, "notion_append_children", side_effect=fake_append
        ), patch.object(self.mod, "notion_archive_block") as archive_mock:
            changed = self.mod.notion_sync_playlist_novena_link(
                "playlist_page_1",
                "novena_page_1",
                "https://www.notion.so/novena_page_1",
                "notion_token",
            )

        self.assertTrue(changed)
        archive_mock.assert_called_once_with("legacy_link_1", "notion_token")
        self.assertEqual(
            appended,
            [
                (
                    "playlist_page_1",
                    [
                        {
                            "object": "block",
                            "type": "bookmark",
                            "bookmark": {"url": "https://www.notion.so/novena_page_1"},
                        }
                    ],
                    "notion_token",
                    "start",
                    "",
                )
            ],
        )

    def test_sync_notion_playlist_novena_links_updates_enabled_playlist_pages(self):
        env = {
            "NOTION_TOKEN": "notion_token",
            "NOTION_PLAYLISTS_DATABASE_ID": "playlists_db_1",
        }
        playlist_pages = [
            {
                "id": "playlist_page_1",
                "properties": {
                    "Name": _title_prop("Morning"),
                    "Enabled": _checkbox_prop(True),
                },
            },
            {
                "id": "playlist_page_2",
                "properties": {
                    "Name": _title_prop("Night"),
                    "Enabled": _checkbox_prop(False),
                },
            },
        ]

        with temp_env(env):
            with patch.object(
                self.mod,
                "find_playlist_novena_page",
                return_value={"id": "novena_page_1", "url": "https://www.notion.so/novena_page_1"},
            ), patch.object(
                self.mod, "notion_get_all_pages", return_value=playlist_pages
            ), patch.object(
                self.mod, "notion_sync_playlist_novena_link", return_value=True
            ) as sync_mock:
                updated, names = self.mod.sync_notion_playlist_novena_links("notion_token")

        self.assertEqual(updated, 1)
        self.assertEqual(names, ["Morning"])

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
                    "Playlist": _rich_text_prop("Morning"),
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
                    "Playlist": _rich_text_prop("Morning"),
                    "Spotify Resolver": _rich_text_prop("HALLOW"),
                    "Spotify Fallback Resolver": _rich_text_prop(""),
                    "URI": _rich_text_prop(""),
                },
            },
        ]
        synced = []

        def fake_sync(page_id, embed_url, token, caption="", playlist_url="", playlist_caption=""):
            synced.append((page_id, embed_url, token, caption, playlist_url, playlist_caption))
            return True, False

        with temp_env(env):
            with patch.object(self.mod, "notion_get_all_pages", return_value=pages), patch.object(
                self.mod, "load_notion_playlists", return_value=[{"name": "Morning", "playlist_id": "playlistmorning"}]
            ), patch.object(
                self.mod, "resolve_spec_uri", return_value="spotify:episode:morning123"
            ), patch.object(
                self.mod, "spotify_bookmark_caption", return_value="Resolved Morning Episode"
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
        self.assertEqual(
            synced,
            [
                (
                    "page_spotify",
                    "https://open.spotify.com/episode/morning123",
                    "notion_token",
                    "Resolved Morning Episode",
                    "https://open.spotify.com/playlist/playlistmorning",
                    "Morning",
                )
            ],
        )

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

    def test_resolve_item_uri_uses_configured_morning_prayer_show_id(self):
        status = {}
        sp = object()

        with patch.object(
            self.mod,
            "monthly_morning_prayer_episode",
            return_value=("spotify:episode:morning", "Morning Prayer for April 27, 2026"),
        ) as resolver_mock:
            uri = self.mod.resolve_item_uri(
                sp,
                "MORNING_PRAYER_MONTHLY",
                "Wednesday",
                status,
                {"MORNING_PRAYER_MONTHLY": "show_new"},
                {},
                {},
            )

        resolver_mock.assert_called_once_with(sp, "show_new")
        self.assertEqual(uri, "spotify:episode:morning")
        self.assertTrue(status["Morning Prayer (Monthly Podcast)"])

    def test_monthly_morning_prayer_episode_matches_date_scoped_title(self):
        sp = Mock()
        sp.show_episodes.return_value = {
            "items": [
                {
                    "name": "Morning Prayer for April 27, 2026",
                    "uri": "spotify:episode:morning",
                }
            ]
        }

        with patch.object(
            self.mod,
            "local_now",
            return_value=datetime.datetime(2026, 4, 27, 6, 0, tzinfo=self.mod.RUNTIME_TZ),
        ):
            uri, name = self.mod.monthly_morning_prayer_episode(sp, "show_new")

        self.assertEqual(uri, "spotify:episode:morning")
        self.assertEqual(name, "Morning Prayer for April 27, 2026")
        sp.show_episodes.assert_called_once_with("show_new", limit=50, market="US")

    def test_monthly_morning_prayer_episode_rejects_old_month_year_title(self):
        sp = Mock()
        sp.show_episodes.return_value = {
            "items": [
                {
                    "name": "Morning Prayer - April 2026",
                    "uri": "spotify:episode:old",
                }
            ]
        }

        with patch.object(
            self.mod,
            "local_now",
            return_value=datetime.datetime(2026, 4, 27, 6, 0, tzinfo=self.mod.RUNTIME_TZ),
        ):
            uri, name = self.mod.monthly_morning_prayer_episode(sp, "show_new")

        self.assertIsNone(uri)
        self.assertIsNone(name)

    def test_daily_novenas_episode_uris_returns_empty_when_no_match(self):
        sp = Mock()
        sp.show_episodes.return_value = {
            "items": [
                {
                    "name": "Day 7: Novena to Saint X - hope - April 27, 2026",
                    "uri": "spotify:episode:skip",
                },
                {
                    "name": "Day 9: Prayer to Saint Y - hope - April 28, 2026",
                    "uri": "spotify:episode:skip-2",
                },
            ]
        }

        with patch.object(
            self.mod,
            "local_now",
            return_value=datetime.datetime(2026, 4, 28, 6, 0, tzinfo=self.mod.RUNTIME_TZ),
        ):
            uris = self.mod.daily_novenas_episode_uris(sp, "show_new")

        self.assertEqual(uris, [])
        sp.show_episodes.assert_called_once_with("show_new", limit=50, market="US")
        sp.next.assert_not_called()

    def test_daily_novenas_episode_uris_returns_single_match(self):
        sp = Mock()
        sp.show_episodes.return_value = {
            "items": [
                {
                    "name": "Day 8: Novena to Saint Y - hope - April 28, 2026",
                    "uri": "spotify:episode:keep-1",
                },
                {
                    "name": "Day 9: Prayer to Saint Y - hope - April 28, 2026",
                    "uri": "spotify:episode:skip",
                },
            ]
        }

        with patch.object(
            self.mod,
            "local_now",
            return_value=datetime.datetime(2026, 4, 28, 6, 0, tzinfo=self.mod.RUNTIME_TZ),
        ):
            uris = self.mod.daily_novenas_episode_uris(sp, "show_new")

        self.assertEqual(uris, ["spotify:episode:keep-1"])
        sp.show_episodes.assert_called_once_with("show_new", limit=50, market="US")
        sp.next.assert_not_called()

    def test_daily_novenas_episode_uris_scans_all_pages_and_preserves_order(self):
        sp = Mock()
        sp.show_episodes.return_value = {
            "items": [
                {
                    "name": "Day 7: Novena to Saint X - hope - April 27, 2026",
                    "uri": "spotify:episode:skip",
                },
                {
                    "name": "Day 8: Novena to Saint Y - hope - April 28, 2026",
                    "uri": "spotify:episode:keep-1",
                },
            ],
            "next": "next_cursor",
        }
        sp.next.return_value = {
            "items": [
                {
                    "name": "Day 9: Novena to Saint Z - hope - April 28, 2026",
                    "uri": "spotify:episode:keep-2",
                },
                {
                    "name": "Day 10: Novena to Saint Q - hope - April 28, 2026",
                    "uri": "spotify:episode:keep-3",
                },
            ]
        }

        with patch.object(
            self.mod,
            "local_now",
            return_value=datetime.datetime(2026, 4, 28, 6, 0, tzinfo=self.mod.RUNTIME_TZ),
        ):
            uris = self.mod.daily_novenas_episode_uris(sp, "show_new")

        self.assertEqual(
            uris,
            ["spotify:episode:keep-1", "spotify:episode:keep-2", "spotify:episode:keep-3"],
        )
        sp.show_episodes.assert_called_once_with("show_new", limit=50, market="US")
        sp.next.assert_called_once()

    def test_build_queue_for_playlist_definition_flattens_daily_novenas_matches(self):
        playlist_definition = _playlist_definition(
            self.mod,
            "morning",
            contracts=("daily-novenas", "rosary"),
        )
        contracts_by_key = {
            "daily-novenas": _queue_contract(
                self.mod,
                "daily-novenas",
                notion_name="Daily Novenas",
                resolver="DAILY_NOVENAS",
            ),
            "rosary": _queue_contract(self.mod, "rosary", resolver="ROSARY"),
        }
        status = {}

        def fake_resolve_contract_uris(
            sp,
            contract,
            weekday,
            current_date,
            status_map,
            shows_cfg,
            fixed_cfg,
            tokens_cfg,
        ):
            if contract.key == "daily-novenas":
                return ["spotify:episode:one", "spotify:episode:two"]
            return ["spotify:episode:three"]

        with patch.object(self.mod, "resolve_contract_uris", side_effect=fake_resolve_contract_uris):
            queue = self.mod.build_queue_for_playlist_definition(
                object(),
                playlist_definition,
                "Wednesday",
                datetime.date(2026, 4, 28),
                status,
                {"DAILY_NOVENAS": "show_new"},
                {},
                {},
                ordered_contracts=tuple(contracts_by_key.values()),
            )

        self.assertEqual(
            queue,
            ["spotify:episode:one", "spotify:episode:two", "spotify:episode:three"],
        )

    def test_main_refreshes_all_enabled_playlists_from_definitions(self):
        env = {
            "SPOTIFY_CLIENT_ID": "cid",
            "SPOTIFY_CLIENT_SECRET": "secret",
            "SPOTIFY_REFRESH_TOKEN": "refresh",
            "NOTION_TOKEN": "notion_token",
        }
        contracts = [
            _queue_contract(self.mod, "morning-prayer-loh", resolver="MORNING"),
            _queue_contract(self.mod, "daily-mass-readings", resolver="USCCB"),
        ]
        playlists = [
            _playlist_definition(
                self.mod,
                "morning",
                name="Morning",
                playlist_id="playlist_morning",
                contracts=("morning-prayer-loh",),
            ),
            _playlist_definition(
                self.mod,
                "midday",
                name="Midday",
                playlist_id="playlist_midday",
                contracts=("daily-mass-readings",),
            ),
        ]
        queues = {
            "Morning": ["spotify:track:111"],
            "Midday": ["spotify:episode:222", "spotify:episode:333"],
        }
        recreate_calls = []

        def fake_build(
            sp,
            playlist_definition,
            weekday,
            current_date,
            status,
            shows_cfg,
            fixed_cfg,
            tokens_cfg,
            ordered_contracts=None,
        ):
            return list(queues[playlist_definition.name])

        def fake_recreate(token, playlist_id, queue):
            recreate_calls.append((token, playlist_id, list(queue)))
            return len(queue)

        with temp_env(env):
            with patch.object(self.mod, "set_runtime_timezone"), patch.object(
                self.mod, "sp_client", return_value=(object(), "token_123")
            ), patch.object(
                self.mod, "load_spotify_queue_contracts", return_value=contracts
            ), patch.object(
                self.mod, "load_spotify_playlist_definitions", return_value=playlists
            ), patch.object(
                self.mod, "build_queue_for_playlist_definition", side_effect=fake_build
            ), patch.object(
                self.mod,
                "build_notion_playlist_memberships",
                return_value=self.mod.NotionPlaylistMembershipBuild(
                    contracts_by_playlist={
                        "morning": (contracts[0],),
                        "midday": (contracts[1],),
                    },
                    stats={},
                ),
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
                ("token_123", "playlist_midday", ["spotify:episode:222", "spotify:episode:333"]),
            ],
        )


if __name__ == "__main__":
    unittest.main()
