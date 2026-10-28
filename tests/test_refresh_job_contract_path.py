import os
import subprocess
import sys
import unittest
import datetime
from pathlib import Path
from unittest.mock import Mock, patch

from tests.test_helpers import ROOT, load_module, temp_env


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
    return mod.SpotifyQueueContract(
        key=key,
        name=name or key.title(),
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
    return mod.SpotifyPlaylistDefinition(
        key=key,
        name=name or key.title(),
        playlist_id=playlist_id or f"{key}_playlist",
        contracts=tuple(contracts),
        source_path=Path(f"config/spotify/playlists/{key}.json"),
    )


class TestRefreshJobContractPath(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/playlist/refresh_playlist.py")

    def test_direct_script_execution_bootstraps_repo_root(self):
        env = os.environ.copy()
        env.pop("PYTHONPATH", None)
        env["SPOTIFY_CLIENT_ID"] = ""
        env["SPOTIFY_CLIENT_SECRET"] = ""
        env["SPOTIFY_REFRESH_TOKEN"] = ""
        result = subprocess.run(
            [sys.executable, "jobs/playlist/refresh_playlist.py"],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
        )

        self.assertEqual(result.returncode, 1)
        self.assertIn("Missing required environment variable: SPOTIFY_CLIENT_ID", result.stderr)
        self.assertNotIn("ModuleNotFoundError: No module named 'jobs'", result.stderr)

    def test_morning_prayer_contract_file_still_resolves_date_scoped_episode(self):
        contracts = {contract.key: contract for contract in self.mod.load_spotify_queue_contracts()}
        morning_prayer = contracts["morning-prayer"]
        lookup = morning_prayer.spotify_episode_lookup
        self.assertIsNotNone(lookup)
        self.assertEqual(lookup.show_id, "4PNxb0OazrkcEp3FAggRoD")

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
            morning_prayer,
            "Monday",
            datetime.date(2026, 4, 27),
            status,
            {},
            {},
            {},
        )

        self.assertEqual(uris, ["spotify:episode:morning"])
        self.assertTrue(status["Morning Prayer"])
        sp.show_episodes.assert_called_once_with(lookup.show_id, limit=50, market="US")

    def test_daily_tv_mass_contract_resolves_weekday_and_sunday_titles_for_exact_date(self):
        contracts = {contract.key: contract for contract in self.mod.load_spotify_queue_contracts()}
        mass = contracts["daily-tv-mass"]
        cases = (
            (
                datetime.date(2026, 10, 26),
                "Daily TV Mass Monday October 26, 2026",
                "spotify:episode:weekday-current",
            ),
            (
                datetime.date(2026, 10, 25),
                "Sunday Daily TV Mass Sunday October 25, 2026",
                "spotify:episode:sunday-current",
            ),
        )

        for current_date, current_title, expected_uri in cases:
            with self.subTest(current_date=current_date):
                sp = Mock()
                sp.show_episodes.return_value = {
                    "items": [
                        {"name": current_title, "uri": expected_uri},
                        {
                            "name": "Daily TV Mass Friday October 23, 2026",
                            "uri": "spotify:episode:stale",
                        },
                    ]
                }
                status = {}

                uris = self.mod.resolve_contract_uris(
                    sp,
                    mass,
                    current_date.strftime("%A"),
                    current_date,
                    status,
                    {},
                    {},
                    {},
                )

                self.assertEqual(uris, [expected_uri])
                self.assertTrue(status["Daily TV Mass"])
                sp.show_episodes.assert_called_once_with("2WwFQr9a6BX7YQ4pkoIijp", limit=50, market="US")

    def test_daily_tv_mass_does_not_fall_back_when_current_episode_is_missing(self):
        contracts = {contract.key: contract for contract in self.mod.load_spotify_queue_contracts()}
        mass = contracts["daily-tv-mass"]
        sp = Mock()
        sp.show_episodes.return_value = {
            "items": [
                {
                    "name": "Daily TV Mass Friday October 23, 2026",
                    "uri": "spotify:episode:stale",
                }
            ]
        }
        status = {}

        uris = self.mod.resolve_contract_uris(
            sp,
            mass,
            "Monday",
            datetime.date(2026, 10, 26),
            status,
            {},
            {},
            {},
        )

        self.assertEqual(uris, [])
        self.assertFalse(status["Daily TV Mass"])
        playlist = next(
            definition for definition in self.mod.load_spotify_playlist_definitions() if definition.key == "sunday"
        )
        queue_status = {}

        def resolve_for_queue(_sp, contract, _weekday, _current_date, status, *_configs):
            resolved = {
                "fr-mike-sunday-homily": ["spotify:episode:frmike"],
                "barron-sunday-sermon": ["spotify:episode:barron"],
                "daily-tv-mass": [],
            }[contract.key]
            status[contract.name] = bool(resolved)
            return resolved

        with patch.object(self.mod, "resolve_contract_uris", side_effect=resolve_for_queue):
            queue = self.mod.build_queue_for_playlist_definition(
                sp,
                playlist,
                "Monday",
                datetime.date(2026, 10, 26),
                queue_status,
                {},
                {},
                {},
                tuple(contracts[key] for key in playlist.contracts),
            )

        self.assertEqual(queue, ["spotify:episode:frmike", "spotify:episode:barron"])
        self.assertFalse(queue_status["Unresolved:Daily TV Mass"])

    def test_daily_novenas_contract_routes_through_dedicated_show_slot(self):
        contracts = {contract.key: contract for contract in self.mod.load_spotify_queue_contracts()}
        daily_novenas = contracts["daily-novenas"]
        lookup = daily_novenas.spotify_episode_lookup
        self.assertIsNotNone(lookup)
        self.assertEqual(lookup.show_id, "4PNxb0OazrkcEp3FAggRoD")
        sp = Mock()
        sp.show_episodes.return_value = {
            "items": [
                {
                    "name": "Daily Novena - April 28, 2026",
                    "uri": "spotify:episode:one",
                },
                {
                    "name": "Daily Mass - April 28, 2026",
                    "uri": "spotify:episode:skip",
                },
            ]
        }
        status = {}

        uris = self.mod.resolve_contract_uris(
            sp,
            daily_novenas,
            "Monday",
            datetime.date(2026, 4, 28),
            status,
            {},
            {},
            {},
        )

        self.assertEqual(uris, ["spotify:episode:one"])
        self.assertTrue(status["Daily Novenas"])
        sp.show_episodes.assert_called_once_with(lookup.show_id, limit=50, market="US")

    def test_sunday_homily_contracts_resolve_latest_episode_on_weekdays(self):
        contracts = {contract.key: contract for contract in self.mod.load_spotify_queue_contracts()}
        fr_mike = contracts["fr-mike-sunday-homily"]
        barron = contracts["barron-sunday-sermon"]
        status = {}

        def fake_latest(sp, show_id):
            return (f"spotify:episode:{show_id}", f"Latest {show_id}")

        with patch.object(self.mod, "latest_by_release_date", side_effect=fake_latest):
            queue = self.mod.build_queue_for_playlist_definition(
                object(),
                _playlist_definition(self.mod, "sunday", name="Sunday"),
                "Wednesday",
                datetime.date(2026, 6, 10),
                status,
                {"FRMIKE_SUNDAY": "frshow", "BARRON_SUNDAY": "barronshow"},
                {},
                {},
                ordered_contracts=(fr_mike, barron),
            )

        self.assertEqual(queue, ["spotify:episode:frshow", "spotify:episode:barronshow"])
        self.assertTrue(status["Fr. Mike Sunday Homily"])
        self.assertTrue(status["Bp. Barron Sunday Sermon"])

    def test_angelus_contract_files_resolve_daily_marian_antiphon_episode(self):
        contracts = {contract.key: contract for contract in self.mod.load_spotify_queue_contracts()}

        for key, name in (
            ("angelus-morning", "Marian Antiphon  (Morning)"),
            ("angelus-midday", "Marian Antiphon (Midday)"),
            ("angelus-evening", "Marian Antiphon (Evening)"),
        ):
            contract = contracts[key]
            lookup = contract.spotify_episode_lookup
            self.assertIsNotNone(lookup)
            self.assertEqual(lookup.show_id, "4PNxb0OazrkcEp3FAggRoD")
            self.assertEqual(
                [search.required_name_terms for search in lookup.searches],
                [("Marian Antiphon",), ("Angelus",), ("Regina Caeli",)],
            )
            sp = Mock()
            sp.show_episodes.return_value = {
                "items": [
                    {
                        "name": "Marian Antiphon - Angelus - April 28, 2026",
                        "uri": f"spotify:episode:{key}",
                    }
                ]
            }
            status = {}

            uris = self.mod.resolve_contract_uris(
                sp,
                contract,
                "Tuesday",
                datetime.date(2026, 4, 28),
                status,
                {},
                {},
                {},
            )

            self.assertEqual(uris, [f"spotify:episode:{key}"])
            self.assertTrue(status[name])
            sp.show_episodes.assert_called_once_with(lookup.show_id, limit=50, market="US")

    def test_angelus_contract_files_fall_back_to_legacy_titles(self):
        contracts = {contract.key: contract for contract in self.mod.load_spotify_queue_contracts()}
        contract = contracts["angelus-midday"]
        lookup = contract.spotify_episode_lookup
        self.assertIsNotNone(lookup)
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
        status = {}

        uris = self.mod.resolve_contract_uris(
            sp,
            contract,
            "Tuesday",
            datetime.date(2026, 4, 28),
            status,
            {},
            {},
            {},
        )

        self.assertEqual(uris, ["spotify:episode:angelus"])
        self.assertTrue(status["Marian Antiphon (Midday)"])
        sp.show_episodes.assert_called_once_with(lookup.show_id, limit=50, market="US")

    def test_auxilium_contract_file_resolves_generated_daily_episode(self):
        contracts = {contract.key: contract for contract in self.mod.load_spotify_queue_contracts()}
        contract = contracts["auxilium-christianorum"]
        lookup = contract.spotify_episode_lookup
        self.assertIsNotNone(lookup)
        sp = Mock()
        sp.show_episodes.return_value = {
            "items": [
                {
                    "name": "Auxilium Christianorum - April 6, 2026",
                    "uri": "spotify:episode:auxilium",
                },
                {
                    "name": "Auxilium Christianorum - April 5, 2026",
                    "uri": "spotify:episode:old-auxilium",
                },
            ]
        }
        status = {}

        uris = self.mod.resolve_contract_uris(
            sp,
            contract,
            "Monday",
            datetime.date(2026, 4, 6),
            status,
            {},
            {},
            {},
        )

        self.assertEqual(uris, ["spotify:episode:auxilium"])
        self.assertTrue(status["Auxillium Christianorum"])
        sp.show_episodes.assert_called_once_with(lookup.show_id, limit=50, market="US")

    def test_main_single_playlist_filter_uses_override_id(self):
        env = {
            "SPOTIFY_CLIENT_ID": "cid",
            "SPOTIFY_CLIENT_SECRET": "secret",
            "SPOTIFY_REFRESH_TOKEN": "refresh",
            "SPOTIFY_PLAYLIST_NAME": "midday",
            "SPOTIFY_PLAYLIST_ID": "spotify:playlist:override123",
        }
        contracts = [_queue_contract(self.mod, "daily-mass-readings", resolver="USCCB")]
        playlists = [_playlist_definition(self.mod, "midday", name="Midday", playlist_id="playlist_midday", contracts=("daily-mass-readings",))]

        with temp_env(env):
            with patch.object(self.mod, "set_runtime_timezone"), patch.object(
                self.mod, "sp_client", return_value=(object(), "token_123")
            ), patch.object(self.mod, "load_spotify_queue_contracts", return_value=contracts), patch.object(
                self.mod, "load_spotify_playlist_definitions", return_value=playlists
            ), patch.object(self.mod, "build_queue_for_playlist_definition", return_value=["spotify:track:111"]), patch.object(
                self.mod, "recreate_playlist_items", return_value=1
            ) as recreate_mock:
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        recreate_mock.assert_called_once_with("token_123", "override123", ["spotify:track:111"])

    def test_main_skips_playlist_with_no_today_contracts_in_multi_run(self):
        env = {
            "SPOTIFY_CLIENT_ID": "cid",
            "SPOTIFY_CLIENT_SECRET": "secret",
            "SPOTIFY_REFRESH_TOKEN": "refresh",
        }
        contracts = [
            _queue_contract(self.mod, "morning-prayer-loh", resolver="MORNING"),
            _queue_contract(self.mod, "fr-mike-sunday-homily", resolver="SUNDAY_FRMIKE", weekdays=("Sunday",)),
        ]
        playlists = [
            _playlist_definition(self.mod, "morning", name="Morning", playlist_id="playlist_morning", contracts=("morning-prayer-loh",)),
            _playlist_definition(self.mod, "sunday", name="Sunday", playlist_id="playlist_sunday", contracts=("fr-mike-sunday-homily",)),
        ]
        recreate_calls = []

        def fake_build(sp, definition, weekday, current_date, status, shows, fixed, tokens, ordered_contracts=None):
            if definition.key == "sunday":
                status["__no_eligible_contracts__"] = True
                return []
            return ["spotify:track:111"]

        def fake_recreate(token, playlist_id, queue):
            recreate_calls.append((token, playlist_id, list(queue)))
            return len(queue)

        with temp_env(env):
            with patch.object(self.mod, "set_runtime_timezone"), patch.object(
                self.mod, "sp_client", return_value=(object(), "token_123")
            ), patch.object(self.mod, "load_spotify_queue_contracts", return_value=contracts), patch.object(
                self.mod, "load_spotify_playlist_definitions", return_value=playlists
            ), patch.object(self.mod, "build_queue_for_playlist_definition", side_effect=fake_build), patch.object(
                self.mod, "recreate_playlist_items", side_effect=fake_recreate
            ):
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        self.assertEqual(recreate_calls, [("token_123", "playlist_morning", ["spotify:track:111"])])

    def test_main_rejects_invalid_override_id(self):
        env = {
            "SPOTIFY_CLIENT_ID": "cid",
            "SPOTIFY_CLIENT_SECRET": "secret",
            "SPOTIFY_REFRESH_TOKEN": "refresh",
            "SPOTIFY_PLAYLIST_NAME": "midday",
            "SPOTIFY_PLAYLIST_ID": "not a spotify id",
        }
        contracts = [_queue_contract(self.mod, "daily-mass-readings", resolver="USCCB")]
        playlists = [_playlist_definition(self.mod, "midday", name="Midday", contracts=("daily-mass-readings",))]

        with temp_env(env):
            with patch.object(self.mod, "set_runtime_timezone"), patch.object(
                self.mod, "sp_client", return_value=(object(), "token_123")
            ), patch.object(self.mod, "load_spotify_queue_contracts", return_value=contracts), patch.object(
                self.mod, "load_spotify_playlist_definitions", return_value=playlists
            ), patch.object(self.mod, "build_queue_for_playlist_definition", return_value=["spotify:track:111"]), patch.object(
                self.mod, "recreate_playlist_items"
            ) as recreate_mock:
                rc = self.mod.main()

        self.assertEqual(rc, 1)
        recreate_mock.assert_not_called()

    def test_daily_refresh_workflow_uses_only_spotify_and_timezone_credentials(self):
        workflow = (ROOT / ".github" / "workflows" / "daily.yml").read_text(encoding="utf-8")

        self.assertIn("SPOTIFY_CLIENT_ID", workflow)
        self.assertIn("SPOTIFY_CLIENT_SECRET", workflow)
        self.assertIn("SPOTIFY_REFRESH_TOKEN", workflow)

    def test_main_runs_token(self):
        env = {
            "SPOTIFY_CLIENT_ID": "cid",
            "SPOTIFY_CLIENT_SECRET": "secret",
            "SPOTIFY_REFRESH_TOKEN": "refresh",
        }
        contracts = [_queue_contract(self.mod, "daily-mass-readings", resolver="USCCB")]
        playlists = [_playlist_definition(self.mod, "midday", name="Midday", contracts=("daily-mass-readings",))]

        with temp_env(env):
            with patch.object(self.mod, "set_runtime_timezone"), patch.object(
                self.mod, "sp_client", return_value=(object(), "token_123")
            ), patch.object(self.mod, "load_spotify_queue_contracts", return_value=contracts), patch.object(
                self.mod, "load_spotify_playlist_definitions", return_value=playlists
            ), patch.object(self.mod, "build_queue_for_playlist_definition", return_value=["spotify:track:111"]), patch.object(
                self.mod, "recreate_playlist_items", return_value=1
            ) as recreate_mock:
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        recreate_mock.assert_called_once_with("token_123", "midday_playlist", ["spotify:track:111"])

if __name__ == "__main__":
    unittest.main()
