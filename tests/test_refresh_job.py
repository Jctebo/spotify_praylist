import datetime
import unittest
from pathlib import Path
from types import SimpleNamespace
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
    name=None,
    resolver="",
    fallback_resolver="",
    spotify_uri="",
    spotify_url_normal="",
    spotify_uri_easter="",
    weekdays=(),
    spotify_episode_lookup=None,
):
    display_name = name or key.title()
    return mod.SpotifyQueueContract(
        key=key,
        name=display_name,
        resolver=resolver,
        fallback_resolver=fallback_resolver,
        spotify_uri=spotify_uri,
        spotify_url_normal=spotify_url_normal,
        spotify_uri_easter=spotify_uri_easter,
        weekdays=tuple(weekdays),
        spotify_episode_lookup=spotify_episode_lookup,
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

    def test_main_success_path_credentials(self):
        env = {
            "SPOTIFY_CLIENT_ID": "cid",
            "SPOTIFY_CLIENT_SECRET": "secret",
            "SPOTIFY_REFRESH_TOKEN": "refresh",
        }
        queue = ["spotify:track:111", "spotify:episode:222"]
        contracts = [_queue_contract(self.mod, "morning-prayer-loh", name="Morning Prayer (LOH)", resolver="MORNING")]
        playlists = [_playlist_definition(self.mod, "morning", name="Morning", playlist_id="playlist_123", contracts=("morning-prayer-loh",))]

        with temp_env(env):
            with patch.object(self.mod, "set_runtime_timezone"), patch.object(self.mod, "sp_client", return_value=(object(), "token_123")), patch.object(
                self.mod, "load_spotify_queue_contracts", return_value=contracts
            ), patch.object(self.mod, "load_spotify_playlist_definitions", return_value=playlists), patch.object(
                self.mod, "build_queue_for_playlist_definition", return_value=queue
            ), patch.object(self.mod, "recreate_playlist_items", return_value=len(queue)) as recreate_mock:
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        recreate_mock.assert_called_once_with("token_123", "playlist_123", queue)

    def test_main_fails_when_queue_empty_without_writing(self):
        env = {
            "SPOTIFY_CLIENT_ID": "cid",
            "SPOTIFY_CLIENT_SECRET": "secret",
            "SPOTIFY_REFRESH_TOKEN": "refresh",
        }
        contracts = [_queue_contract(self.mod, "morning-prayer-loh", resolver="MORNING")]
        playlists = [_playlist_definition(self.mod, "morning", name="Morning", playlist_id="playlist_123", contracts=("morning-prayer-loh",))]

        with temp_env(env):
            with patch.object(self.mod, "set_runtime_timezone"), patch.object(self.mod, "sp_client", return_value=(object(), "token_123")), patch.object(
                self.mod, "load_spotify_queue_contracts", return_value=contracts
            ), patch.object(self.mod, "load_spotify_playlist_definitions", return_value=playlists), patch.object(
                self.mod, "build_queue_for_playlist_definition", return_value=[]
            ), patch.object(self.mod, "recreate_playlist_items") as recreate_mock:
                rc = self.mod.main()

        self.assertEqual(rc, 1)
        recreate_mock.assert_not_called()
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
                name="Morning Prayer (LOH)",
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
                name="Fr. Mike Sunday Homily",
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
                name="Marian Antiphon (Morning)",
                spotify_url_normal="spotify:track:39Jgl6ST4fQj4fNyRSQZFk",
                spotify_uri_easter="spotify:episode:7ni2KH5KdbtK0JFL74V8x3",
            ),
            "angelus-midday": _queue_contract(
                self.mod,
                "angelus-midday",
                name="Marian Antiphon (Midday)",
                spotify_url_normal="spotify:episode:2HNK8wLRWHh0mJ9xmJjlUD",
                spotify_uri_easter="spotify:episode:68xFE8g1JRFu62osp0tLNg",
            ),
            "angelus-evening": _queue_contract(
                self.mod,
                "angelus-evening",
                name="Marian Antiphon (Evening)",
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

    def test_evening_sing_the_hours_resolver_is_still_available(self):
        status = {}
        sp = object()

        with patch.object(self.mod, "sth_match_today", return_value=("spotify:episode:sth-evening", "Sing the Hours Evening")) as sth_mock:
            uri = self.mod.resolve_item_uri(
                sp,
                "STH_EVENING",
                "Wednesday",
                status,
                {"STH": "sth_show"},
                {},
                {"STH_VESPERS": "Vespers"},
            )

        self.assertEqual(uri, "spotify:episode:sth-evening")
        sth_mock.assert_called_once_with(sp, "sth_show", ["Vespers"])
        self.assertTrue(status["Evening Prayer (STH Vespers)"])

    def test_morning_prayer_prefers_divine_office_before_sing_the_hours(self):
        status = {}
        sp = object()

        with patch.object(self.mod, "do_date_aware", return_value=("spotify:episode:do-morning", "Divine Office Morning")) as do_mock, patch.object(
            self.mod, "sth_match_today", return_value=("spotify:episode:sth-morning", "Sing the Hours Morning")
        ) as sth_mock:
            uri, name = self.mod.get_morning_prayer(
                sp,
                {"DIVINE_OFFICE": "do_show", "STH": "sth_show"},
                {"DO_MORNING": "Morning Prayer", "STH_LAUDS": "Lauds"},
                status,
            )

        self.assertEqual(uri, "spotify:episode:do-morning")
        self.assertEqual(name, "Divine Office Morning")
        do_mock.assert_called_once_with(sp, "do_show", ("Morning Prayer",))
        sth_mock.assert_not_called()
        self.assertTrue(status["Morning Prayer (DO)"])
        self.assertFalse(status["Morning Prayer (STH fallback)"])

    def test_morning_prayer_falls_back_to_sing_the_hours_when_divine_office_missing(self):
        status = {}
        sp = object()

        with patch.object(self.mod, "do_date_aware", return_value=(None, None)) as do_mock, patch.object(
            self.mod, "sth_match_today", return_value=("spotify:episode:sth-morning", "Sing the Hours Morning")
        ) as sth_mock:
            uri, name = self.mod.get_morning_prayer(
                sp,
                {"DIVINE_OFFICE": "do_show", "STH": "sth_show"},
                {"DO_MORNING": "Morning Prayer", "STH_LAUDS": "Lauds"},
                status,
            )

        self.assertEqual(uri, "spotify:episode:sth-morning")
        self.assertEqual(name, "Sing the Hours Morning")
        do_mock.assert_called_once_with(sp, "do_show", ("Morning Prayer",))
        sth_mock.assert_called_once_with(sp, "sth_show", ["Lauds"])
        self.assertFalse(status["Morning Prayer (DO)"])
        self.assertTrue(status["Morning Prayer (STH fallback)"])

    def test_evening_prayer_prefers_divine_office_before_sing_the_hours(self):
        status = {}
        sp = object()

        with patch.object(self.mod, "do_date_aware", return_value=("spotify:episode:do-evening", "Divine Office Evening")) as do_mock, patch.object(
            self.mod, "sth_match_today", return_value=("spotify:episode:sth-evening", "Sing the Hours Evening")
        ) as sth_mock:
            uri, name = self.mod.get_evening_prayer(
                sp,
                {"DIVINE_OFFICE": "do_show", "STH": "sth_show"},
                {"DO_EVENING": "Evening Prayer", "STH_VESPERS": "Vespers"},
                status,
            )

        self.assertEqual(uri, "spotify:episode:do-evening")
        self.assertEqual(name, "Divine Office Evening")
        do_mock.assert_called_once_with(sp, "do_show", ("Evening Prayer",))
        sth_mock.assert_not_called()
        self.assertTrue(status["Evening Prayer (DO)"])
        self.assertFalse(status["Evening Prayer (STH fallback)"])

    def test_evening_prayer_falls_back_to_sing_the_hours_when_divine_office_missing(self):
        status = {}
        sp = object()

        with patch.object(self.mod, "do_date_aware", return_value=(None, None)) as do_mock, patch.object(
            self.mod, "sth_match_today", return_value=("spotify:episode:sth-evening", "Sing the Hours Evening")
        ) as sth_mock:
            uri, name = self.mod.get_evening_prayer(
                sp,
                {"DIVINE_OFFICE": "do_show", "STH": "sth_show"},
                {"DO_EVENING": "Evening Prayer", "STH_VESPERS": "Vespers"},
                status,
            )

        self.assertEqual(uri, "spotify:episode:sth-evening")
        self.assertEqual(name, "Sing the Hours Evening")
        do_mock.assert_called_once_with(sp, "do_show", ("Evening Prayer",))
        sth_mock.assert_called_once_with(sp, "sth_show", ["Vespers"])
        self.assertFalse(status["Evening Prayer (DO)"])
        self.assertTrue(status["Evening Prayer (STH fallback)"])

    def test_resolve_spec_uri_does_not_alias_legacy_resolver_names(self):
        status = {}
        sp = object()

        with patch.object(self.mod, "resolve_item_uri", return_value="spotify:episode:resolved") as resolve_mock:
            uri = self.mod.resolve_spec_uri(
                sp,
                "DO_INVITATORY",
                "Wednesday",
                status,
                {"INVITATORY": "show_inv"},
                {},
                {},
            )

        self.assertEqual(uri, "spotify:episode:resolved")
        resolve_mock.assert_called_once_with(
            sp,
            "DO_INVITATORY",
            "Wednesday",
            status,
            {"INVITATORY": "show_inv"},
            {},
            {},
        )

    def test_spotify_episode_lookup_uris_matches_canonical_date(self):
        sp = Mock()
        sp.show_episodes.return_value = {
            "items": [
                {
                    "name": "Morning Prayer for April 27, 2026",
                    "uri": "spotify:episode:morning",
                },
                {
                    "name": "Morning Prayer for April 26, 2026",
                    "uri": "spotify:episode:old",
                },
            ]
        }

        uris = self.mod.spotify_episode_lookup_uris(
            sp,
            "show_new",
            ("Morning Prayer",),
            ("{month_name} {day}, {year}",),
            datetime.date(2026, 4, 27),
        )

        self.assertEqual(uris, ["spotify:episode:morning"])
        sp.show_episodes.assert_called_once_with("show_new", limit=50, market="US")
        sp.next.assert_not_called()

    def test_spotify_episode_lookup_uris_matches_expanded_daily_rosary_title(self):
        sp = Mock()
        sp.show_episodes.return_value = {
            "items": [
                {
                    "name": "Daily Rosary - Joyful Mysteries - Saint Example - April 6, 2026",
                    "uri": "spotify:episode:rosary",
                },
                {
                    "name": "Daily Rosary - Joyful Mysteries - Saint Example - April 5, 2026",
                    "uri": "spotify:episode:old",
                },
            ]
        }

        uris = self.mod.spotify_episode_lookup_uris(
            sp,
            "show_new",
            ("Daily Rosary",),
            ("{month_name} {day}, {year}",),
            datetime.date(2026, 4, 6),
        )

        self.assertEqual(uris, ["spotify:episode:rosary"])
        sp.show_episodes.assert_called_once_with("show_new", limit=50, market="US")
        sp.next.assert_not_called()

    def test_spotify_episode_lookup_uris_tries_alternate_dates_pages_and_dedupes(self):
        sp = Mock()
        sp.show_episodes.return_value = {
            "items": [
                {
                    "name": "Daily Novena - Apr. 28, 2026",
                    "uri": "spotify:episode:keep-1",
                },
                {
                    "name": "Daily Novena - April 27, 2026",
                    "uri": "spotify:episode:skip",
                },
            ],
            "next": "next_cursor",
        }
        sp.next.return_value = {
            "items": [
                {
                    "name": "Daily Novena - April 28, 2026",
                    "uri": "spotify:episode:keep-1",
                },
                {
                    "name": "Daily Novena - April 28, 2026",
                    "uri": "spotify:episode:keep-2",
                },
            ]
        }

        uris = self.mod.spotify_episode_lookup_uris(
            sp,
            "show_new",
            ("novena",),
            ("{month_name} {day}, {year}", "{month_short}. {day}, {year}"),
            datetime.date(2026, 4, 28),
        )

        self.assertEqual(uris, ["spotify:episode:keep-1", "spotify:episode:keep-2"])
        sp.show_episodes.assert_called_once_with("show_new", limit=50, market="US")
        sp.next.assert_called_once()

    def test_spotify_episode_lookup_uris_scans_all_pages_and_preserves_order(self):
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
        uris = self.mod.spotify_episode_lookup_uris(
            sp,
            "show_new",
            ("novena",),
            ("{month_name} {day}, {year}",),
            datetime.date(2026, 4, 28),
        )

        self.assertEqual(
            uris,
            ["spotify:episode:keep-1", "spotify:episode:keep-2", "spotify:episode:keep-3"],
        )
        sp.show_episodes.assert_called_once_with("show_new", limit=50, market="US")
        sp.next.assert_called_once()

    def test_spotify_episode_lookup_search_uris_uses_first_successful_search(self):
        sp = Mock()
        sp.show_episodes.return_value = {
            "items": [
                {
                    "name": "Marian Antiphon - Angelus - April 28, 2026",
                    "uri": "spotify:episode:primary",
                },
                {
                    "name": "Angelus - April 28, 2026",
                    "uri": "spotify:episode:fallback",
                },
            ]
        }

        uris = self.mod.spotify_episode_lookup_search_uris(
            sp,
            "show_new",
            (
                self.mod.SpotifyEpisodeLookupSearch(
                    required_name_terms=("Marian Antiphon",),
                    date_formats=("{month_name} {day}, {year}",),
                ),
                self.mod.SpotifyEpisodeLookupSearch(
                    required_name_terms=("Angelus",),
                    date_formats=("{month_name} {day}, {year}",),
                ),
            ),
            datetime.date(2026, 4, 28),
        )

        self.assertEqual(uris, ["spotify:episode:primary"])
        sp.show_episodes.assert_called_once_with("show_new", limit=50, market="US")
        sp.next.assert_not_called()

    def test_spotify_episode_lookup_search_uris_falls_back_in_order(self):
        sp = Mock()
        sp.show_episodes.return_value = {
            "items": [
                {
                    "name": "Angelus - April 28, 2026",
                    "uri": "spotify:episode:angelus",
                },
                {
                    "name": "Regina Caeli - April 28, 2026",
                    "uri": "spotify:episode:regina-caeli",
                },
            ]
        }

        uris = self.mod.spotify_episode_lookup_search_uris(
            sp,
            "show_new",
            (
                self.mod.SpotifyEpisodeLookupSearch(
                    required_name_terms=("Marian Antiphon",),
                    date_formats=("{month_name} {day}, {year}",),
                ),
                self.mod.SpotifyEpisodeLookupSearch(
                    required_name_terms=("Angelus",),
                    date_formats=("{month_name} {day}, {year}",),
                ),
                self.mod.SpotifyEpisodeLookupSearch(
                    required_name_terms=("Regina Caeli",),
                    date_formats=("{month_name} {day}, {year}",),
                ),
            ),
            datetime.date(2026, 4, 28),
        )

        self.assertEqual(uris, ["spotify:episode:angelus"])
        sp.show_episodes.assert_called_once_with("show_new", limit=50, market="US")

    def test_spotify_episode_lookup_search_uris_does_not_merge_later_searches(self):
        sp = Mock()
        sp.show_episodes.return_value = {
            "items": [
                {
                    "name": "Angelus - April 28, 2026",
                    "uri": "spotify:episode:angelus",
                },
                {
                    "name": "Regina Caeli - April 28, 2026",
                    "uri": "spotify:episode:regina-caeli",
                },
            ]
        }

        uris = self.mod.spotify_episode_lookup_search_uris(
            sp,
            "show_new",
            (
                self.mod.SpotifyEpisodeLookupSearch(
                    required_name_terms=("Angelus",),
                    date_formats=("{month_name} {day}, {year}",),
                ),
                self.mod.SpotifyEpisodeLookupSearch(
                    required_name_terms=("Regina Caeli",),
                    date_formats=("{month_name} {day}, {year}",),
                ),
            ),
            datetime.date(2026, 4, 28),
        )

        self.assertEqual(uris, ["spotify:episode:angelus"])
        sp.show_episodes.assert_called_once_with("show_new", limit=50, market="US")

    def test_resolve_contract_uris_uses_spotify_episode_lookup(self):
        lookup = self.mod.SpotifyEpisodeLookupContract(
            show_id="show_new",
            searches=(
                self.mod.SpotifyEpisodeLookupSearch(
                    required_name_terms=("Morning Prayer",),
                    date_formats=("{month_name} {day}, {year}",),
                ),
            ),
        )
        contract = _queue_contract(
            self.mod,
            "morning-prayer",
            name="Morning Prayer",
            spotify_episode_lookup=lookup,
        )
        sp = Mock()
        sp.show_episodes.return_value = {
            "items": [
                {
                    "name": "Morning Prayer for April 27, 2026",
                    "uri": "spotify:episode:morning",
                }
            ]
        }
        status = {}

        uris = self.mod.resolve_contract_uris(
            sp,
            contract,
            "Wednesday",
            datetime.date(2026, 4, 27),
            status,
            {},
            {},
            {},
        )

        self.assertEqual(uris, ["spotify:episode:morning"])
        self.assertTrue(status["Morning Prayer"])
        sp.show_episodes.assert_called_once_with("show_new", limit=50, market="US")
        sp.next.assert_not_called()

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
                name="Daily Novenas",
                spotify_episode_lookup=SimpleNamespace(
                    show_id="show_new",
                    required_name_terms=("novena",),
                    date_formats=("{month_name} {day}, {year}",),
                ),
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
                {},
                {},
                {},
                ordered_contracts=tuple(contracts_by_key.values()),
            )

        self.assertEqual(
            queue,
            ["spotify:episode:one", "spotify:episode:two", "spotify:episode:three"],
        )

    def test_main_refreshes_all_defined_playlists_from_contract_order(self):
        env = {
            "SPOTIFY_CLIENT_ID": "cid",
            "SPOTIFY_CLIENT_SECRET": "secret",
            "SPOTIFY_REFRESH_TOKEN": "refresh",
        }
        contracts = [
            _queue_contract(self.mod, "morning-prayer-loh", name="Morning Prayer (LOH)", resolver="MORNING"),
            _queue_contract(self.mod, "daily-mass-readings", name="Daily Mass Readings", resolver="USCCB"),
        ]
        playlists = [
            _playlist_definition(self.mod, "morning", name="Morning", playlist_id="playlist_morning", contracts=("morning-prayer-loh",)),
            _playlist_definition(self.mod, "midday", name="Midday", playlist_id="playlist_midday", contracts=("daily-mass-readings",)),
        ]
        queues = {"Morning": ["spotify:track:111"], "Midday": ["spotify:episode:222", "spotify:episode:333"]}
        recreate_calls = []
        contract_order = []

        def fake_build(sp, definition, weekday, current_date, status, shows, fixed, tokens, ordered_contracts=None):
            contract_order.append((definition.key, tuple(contract.key for contract in ordered_contracts)))
            return queues[definition.name]

        def fake_recreate(token, playlist_id, queue):
            recreate_calls.append((token, playlist_id, list(queue)))
            return len(queue)

        with temp_env(env):
            with patch.object(self.mod, "set_runtime_timezone"), patch.object(self.mod, "sp_client", return_value=(object(), "token_123")), patch.object(
                self.mod, "load_spotify_queue_contracts", return_value=contracts
            ), patch.object(self.mod, "load_spotify_playlist_definitions", return_value=playlists), patch.object(
                self.mod, "build_queue_for_playlist_definition", side_effect=fake_build
            ), patch.object(self.mod, "recreate_playlist_items", side_effect=fake_recreate):
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        self.assertEqual(contract_order, [("morning", ("morning-prayer-loh",)), ("midday", ("daily-mass-readings",))])
        self.assertEqual(
            recreate_calls,
            [
                ("token_123", "playlist_morning", ["spotify:track:111"]),
                ("token_123", "playlist_midday", ["spotify:episode:222", "spotify:episode:333"]),
            ],
        )
if __name__ == "__main__":
    unittest.main()
