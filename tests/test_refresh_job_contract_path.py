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
    notion_name=None,
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
        notion_name=notion_name or key.title(),
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
        env["NOTION_TOKEN"] = ""

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

    def test_main_single_playlist_filter_uses_override_id(self):
        env = {
            "SPOTIFY_CLIENT_ID": "cid",
            "SPOTIFY_CLIENT_SECRET": "secret",
            "SPOTIFY_REFRESH_TOKEN": "refresh",
            "SPOTIFY_PLAYLIST_NAME": "midday",
            "SPOTIFY_PLAYLIST_ID": "spotify:playlist:override123",
            "NOTION_TOKEN": "notion_token",
        }
        contracts = [
            _queue_contract(self.mod, "daily-mass-readings", resolver="USCCB"),
        ]
        playlists = [
            _playlist_definition(
                self.mod,
                "midday",
                name="Midday",
                playlist_id="playlist_midday",
                contracts=("daily-mass-readings",),
            )
        ]

        with temp_env(env):
            with patch.object(self.mod, "set_runtime_timezone"), patch.object(
                self.mod, "sp_client", return_value=(object(), "token_123")
            ), patch.object(
                self.mod, "load_spotify_queue_contracts", return_value=contracts
            ), patch.object(
                self.mod, "load_spotify_playlist_definitions", return_value=playlists
            ), patch.object(
                self.mod, "build_queue_for_playlist_definition", return_value=["spotify:track:111"]
            ), patch.object(
                self.mod,
                "build_notion_playlist_memberships",
                return_value=self.mod.NotionPlaylistMembershipBuild(
                    contracts_by_playlist={"midday": tuple(contracts)},
                    stats={},
                ),
            ), patch.object(
                self.mod, "recreate_playlist_items", return_value=1
            ) as recreate_mock, patch.object(
                self.mod, "sync_notion_uris_for_playlist"
            ) as autosync_mock, patch.object(self.mod, "distribute_prayer_intentions", return_value=(0, 0, 0)) as intentions_mock:
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        recreate_mock.assert_called_once_with("token_123", "override123", ["spotify:track:111"])
        autosync_mock.assert_not_called()
        intentions_mock.assert_called_once_with("Midday")

    def test_main_skips_playlist_with_no_today_contracts_in_multi_run(self):
        env = {
            "SPOTIFY_CLIENT_ID": "cid",
            "SPOTIFY_CLIENT_SECRET": "secret",
            "SPOTIFY_REFRESH_TOKEN": "refresh",
            "NOTION_TOKEN": "notion_token",
        }
        contracts = [
            _queue_contract(self.mod, "morning-prayer-loh", resolver="MORNING"),
            _queue_contract(self.mod, "fr-mike-sunday-homily", resolver="SUNDAY_FRMIKE", weekdays=("Sunday",)),
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
                "sunday",
                name="Sunday",
                playlist_id="playlist_sunday",
                contracts=("fr-mike-sunday-homily",),
            ),
        ]
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
            if playlist_definition.key == "sunday":
                status["__no_eligible_contracts__"] = True
                return []
            return ["spotify:track:111"]

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
                        "sunday": (contracts[1],),
                    },
                    stats={},
                ),
            ), patch.object(
                self.mod, "recreate_playlist_items", side_effect=fake_recreate
            ), patch.object(
                self.mod, "distribute_prayer_intentions", return_value=(0, 0, 0)
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
            "NOTION_TOKEN": "notion_token",
        }
        contracts = [_queue_contract(self.mod, "daily-mass-readings", resolver="USCCB")]
        playlists = [
            _playlist_definition(
                self.mod,
                "midday",
                name="Midday",
                playlist_id="playlist_midday",
                contracts=("daily-mass-readings",),
            )
        ]

        with temp_env(env):
            with patch.object(self.mod, "set_runtime_timezone"), patch.object(
                self.mod, "sp_client", return_value=(object(), "token_123")
            ), patch.object(
                self.mod, "load_spotify_queue_contracts", return_value=contracts
            ), patch.object(
                self.mod, "load_spotify_playlist_definitions", return_value=playlists
            ), patch.object(
                self.mod, "build_queue_for_playlist_definition", return_value=["spotify:track:111"]
            ), patch.object(
                self.mod,
                "build_notion_playlist_memberships",
                return_value=self.mod.NotionPlaylistMembershipBuild(
                    contracts_by_playlist={"midday": tuple(contracts)},
                    stats={},
                ),
            ):
                rc = self.mod.main()

        self.assertEqual(rc, 1)

    def test_main_requires_notion_token_for_membership(self):
        env = {
            "SPOTIFY_CLIENT_ID": "cid",
            "SPOTIFY_CLIENT_SECRET": "secret",
            "SPOTIFY_REFRESH_TOKEN": "refresh",
            "NOTION_TOKEN": "",
        }

        with temp_env(env):
            with patch.object(self.mod, "set_runtime_timezone"), patch.object(
                self.mod, "sp_client", return_value=(object(), "token_123")
            ):
                rc = self.mod.main()

        self.assertEqual(rc, 1)


if __name__ == "__main__":
    unittest.main()
