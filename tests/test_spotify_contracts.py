import json
import tempfile
import unittest
from pathlib import Path

from tests.test_helpers import load_module


def _write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


class TestSpotifyContracts(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/playlist/spotify_contracts.py")

    def test_load_spotify_queue_contracts_normalizes_and_sorts_contracts(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            contract_dir = Path(tmpdir)
            _write_json(
                contract_dir / "morning-prayer-loh.json",
                {
                    "key": "Morning Prayer LOH",
                    "notion_name": "Morning Prayer (LOH)",
                    "resolver": "MORNING",
                    "fallback_resolver": "DO_MORNING",
                },
            )
            _write_json(
                contract_dir / "fr-mike-sunday-homily.json",
                {
                    "key": "fr-mike-sunday-homily",
                    "notion_name": "Fr. Mike Sunday Homily",
                    "resolver": "SUNDAY_FRMIKE",
                    "weekdays": ["sunday"],
                },
            )

            contracts = self.mod.load_spotify_queue_contracts(contract_dir=contract_dir)

        self.assertEqual([contract.key for contract in contracts], ["fr-mike-sunday-homily", "morning-prayer-loh"])
        self.assertEqual(contracts[0].weekdays, ("Sunday",))
        self.assertEqual(contracts[1].fallback_resolver, "DO_MORNING")

    def test_load_spotify_queue_contracts_accepts_seasonal_angelus_shape(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            contract_dir = Path(tmpdir)
            _write_json(
                contract_dir / "angelus-morning.json",
                {
                    "key": "angelus-morning",
                    "notion_name": "Marian Antiphon (Morning)",
                    "spotify_url_normal": "spotify:track:39Jgl6ST4fQj4fNyRSQZFk",
                    "spotify_uri_easter": "spotify:episode:7ni2KH5KdbtK0JFL74V8x3",
                },
            )
            _write_json(
                contract_dir / "angelus-midday.json",
                {
                    "key": "angelus-midday",
                    "notion_name": "Marian Antiphon (Midday)",
                    "spotify_url_normal": "spotify:episode:2HNK8wLRWHh0mJ9xmJjlUD",
                    "spotify_uri_easter": "spotify:episode:68xFE8g1JRFu62osp0tLNg",
                },
            )
            _write_json(
                contract_dir / "angelus-evening.json",
                {
                    "key": "angelus-evening",
                    "notion_name": "Marian Antiphon (Evening)",
                    "spotify_url_normal": "spotify:track:39Jgl6ST4fQj4fNyRSQZFk",
                    "spotify_uri_easter": "spotify:episode:7ni2KH5KdbtK0JFL74V8x3",
                },
            )

            contracts = self.mod.load_spotify_queue_contracts(contract_dir=contract_dir)

        contracts_by_key = {contract.key: contract for contract in contracts}
        self.assertEqual(
            contracts_by_key["angelus-morning"].spotify_url_normal,
            "spotify:track:39Jgl6ST4fQj4fNyRSQZFk",
        )
        self.assertEqual(
            contracts_by_key["angelus-morning"].spotify_uri_easter,
            "spotify:episode:7ni2KH5KdbtK0JFL74V8x3",
        )
        self.assertEqual(
            contracts_by_key["angelus-midday"].spotify_url_normal,
            "spotify:episode:2HNK8wLRWHh0mJ9xmJjlUD",
        )
        self.assertEqual(
            contracts_by_key["angelus-midday"].spotify_uri_easter,
            "spotify:episode:68xFE8g1JRFu62osp0tLNg",
        )
        self.assertEqual(
            contracts_by_key["angelus-evening"].spotify_url_normal,
            "spotify:track:39Jgl6ST4fQj4fNyRSQZFk",
        )
        self.assertEqual(
            contracts_by_key["angelus-evening"].spotify_uri_easter,
            "spotify:episode:7ni2KH5KdbtK0JFL74V8x3",
        )
        for contract in contracts:
            self.assertEqual(contract.spotify_uri, "")
            self.assertEqual(contract.resolver, "")

    def test_load_spotify_queue_contracts_rejects_invalid_contract_shapes(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            contract_dir = Path(tmpdir)
            _write_json(
                contract_dir / "broken.json",
                {
                    "key": "broken",
                    "notion_name": "Broken",
                    "resolver": "MORNING",
                    "spotify_uri": "spotify:track:abc123",
                },
            )

            with self.assertRaisesRegex(RuntimeError, "exactly one of 'resolver' or 'spotify_uri'"):
                self.mod.load_spotify_queue_contracts(contract_dir=contract_dir)

        with tempfile.TemporaryDirectory() as tmpdir:
            contract_dir = Path(tmpdir)
            _write_json(
                contract_dir / "broken.json",
                {
                    "key": "broken",
                    "notion_name": "Broken",
                    "resolver": "MORNING",
                    "spotify_episode_lookup": {
                        "show_id": "show_123",
                        "required_name_terms": ["Morning Prayer"],
                        "date_formats": ["{month_name} {day}, {year}"],
                    },
                },
            )

            with self.assertRaisesRegex(RuntimeError, "cannot mix 'spotify_episode_lookup'"):
                self.mod.load_spotify_queue_contracts(contract_dir=contract_dir)

        with tempfile.TemporaryDirectory() as tmpdir:
            contract_dir = Path(tmpdir)
            _write_json(
                contract_dir / "broken.json",
                {
                    "key": "broken",
                    "notion_name": "Broken",
                    "spotify_uri": "https://open.spotify.com/track/abc123",
                },
            )

            with self.assertRaisesRegex(RuntimeError, "invalid 'spotify_uri'"):
                self.mod.load_spotify_queue_contracts(contract_dir=contract_dir)

        with tempfile.TemporaryDirectory() as tmpdir:
            contract_dir = Path(tmpdir)
            _write_json(
                contract_dir / "broken.json",
                {
                    "key": "broken",
                    "notion_name": "Broken",
                    "spotify_episode_lookup": {
                        "required_name_terms": ["Morning Prayer"],
                        "date_formats": ["{month_name} {day}, {year}"],
                    },
                },
            )

            with self.assertRaisesRegex(RuntimeError, "missing required field 'show_id'"):
                self.mod.load_spotify_queue_contracts(contract_dir=contract_dir)

        with tempfile.TemporaryDirectory() as tmpdir:
            contract_dir = Path(tmpdir)
            _write_json(
                contract_dir / "broken.json",
                {
                    "key": "broken",
                    "notion_name": "Broken",
                    "resolver": "MORNING",
                    "weekdays": ["Funday"],
                },
            )

            with self.assertRaisesRegex(RuntimeError, "invalid weekday 'Funday'"):
                self.mod.load_spotify_queue_contracts(contract_dir=contract_dir)

    def test_load_spotify_queue_contracts_rejects_partial_seasonal_shape(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            contract_dir = Path(tmpdir)
            _write_json(
                contract_dir / "broken.json",
                {
                    "key": "angelus-morning",
                    "notion_name": "Marian Antiphon (Morning)",
                    "spotify_url_normal": "spotify:track:1dbE76sfAobxVwYYjQ6yb6",
                },
            )

            with self.assertRaisesRegex(RuntimeError, "must define both 'spotify_url_normal' and 'spotify_uri_easter'"):
                self.mod.load_spotify_queue_contracts(contract_dir=contract_dir)

    def test_load_spotify_queue_contracts_rejects_legacy_name_only_contract(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            contract_dir = Path(tmpdir)
            _write_json(
                contract_dir / "broken.json",
                {
                    "key": "broken",
                    "name": "Broken",
                    "resolver": "MORNING",
                },
            )

            with self.assertRaisesRegex(RuntimeError, "legacy field 'name'"):
                self.mod.load_spotify_queue_contracts(contract_dir=contract_dir)

    def test_load_spotify_queue_contracts_includes_daily_novenas_contract(self):
        contracts = {contract.key: contract for contract in self.mod.load_spotify_queue_contracts()}

        self.assertIn("daily-novenas", contracts)
        self.assertEqual(contracts["daily-novenas"].notion_name, "Daily Novenas")
        self.assertEqual(contracts["daily-novenas"].resolver, "")
        lookup = contracts["daily-novenas"].spotify_episode_lookup
        self.assertIsNotNone(lookup)
        self.assertEqual(lookup.show_id, "4PNxb0OazrkcEp3FAggRoD")
        self.assertEqual(len(lookup.searches), 1)
        self.assertEqual(lookup.required_name_terms, ("novena",))
        self.assertEqual(
            lookup.date_formats,
            (
                "{month_name} {day}, {year}",
                "{month_name} {day_ordinal}, {year}",
                "{month_short} {day}, {year}",
                "{month_short}. {day}, {year}",
                "{month_short} {day_ordinal}, {year}",
                "{month_short}. {day_ordinal}, {year}",
            ),
        )

    def test_load_spotify_queue_contracts_accepts_episode_lookup_shape(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            contract_dir = Path(tmpdir)
            _write_json(
                contract_dir / "lookup.json",
                {
                    "key": "lookup",
                    "notion_name": "Lookup",
                    "spotify_episode_lookup": {
                        "show_id": "show_123",
                        "required_name_terms": ["Morning Prayer", "April"],
                        "date_formats": ["{month_name} {day}, {year}"],
                    },
                },
            )

            contracts = self.mod.load_spotify_queue_contracts(contract_dir=contract_dir)

        lookup = {contract.key: contract for contract in contracts}["lookup"].spotify_episode_lookup
        self.assertIsNotNone(lookup)
        self.assertEqual(lookup.show_id, "show_123")
        self.assertEqual(len(lookup.searches), 1)
        self.assertEqual(lookup.required_name_terms, ("Morning Prayer", "April"))
        self.assertEqual(lookup.date_formats, ("{month_name} {day}, {year}",))

    def test_load_spotify_queue_contracts_accepts_ordered_episode_lookup_searches(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            contract_dir = Path(tmpdir)
            _write_json(
                contract_dir / "lookup.json",
                {
                    "key": "lookup",
                    "notion_name": "Lookup",
                    "spotify_episode_lookup": {
                        "show_id": "show_123",
                        "searches": [
                            {
                                "required_name_terms": ["Marian Antiphon"],
                                "date_formats": ["{month_name} {day}, {year}"],
                            },
                            {
                                "required_name_terms": ["Angelus"],
                                "date_formats": ["{month_short}. {day}, {year}"],
                            },
                        ],
                    },
                },
            )

            contracts = self.mod.load_spotify_queue_contracts(contract_dir=contract_dir)

        lookup = {contract.key: contract for contract in contracts}["lookup"].spotify_episode_lookup
        self.assertIsNotNone(lookup)
        self.assertEqual(lookup.show_id, "show_123")
        self.assertEqual(
            lookup.searches,
            (
                self.mod.SpotifyEpisodeLookupSearch(
                    required_name_terms=("Marian Antiphon",),
                    date_formats=("{month_name} {day}, {year}",),
                ),
                self.mod.SpotifyEpisodeLookupSearch(
                    required_name_terms=("Angelus",),
                    date_formats=("{month_short}. {day}, {year}",),
                ),
            ),
        )
        self.assertEqual(lookup.required_name_terms, ("Marian Antiphon",))
        self.assertEqual(lookup.date_formats, ("{month_name} {day}, {year}",))

    def test_load_spotify_queue_contracts_rejects_invalid_episode_lookup_searches(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            contract_dir = Path(tmpdir)
            _write_json(
                contract_dir / "broken.json",
                {
                    "key": "broken",
                    "notion_name": "Broken",
                    "spotify_episode_lookup": {
                        "show_id": "show_123",
                        "searches": [],
                    },
                },
            )

            with self.assertRaisesRegex(RuntimeError, "non-empty 'searches'"):
                self.mod.load_spotify_queue_contracts(contract_dir=contract_dir)

        with tempfile.TemporaryDirectory() as tmpdir:
            contract_dir = Path(tmpdir)
            _write_json(
                contract_dir / "broken.json",
                {
                    "key": "broken",
                    "notion_name": "Broken",
                    "spotify_episode_lookup": {
                        "show_id": "show_123",
                        "required_name_terms": ["Marian Antiphon"],
                        "date_formats": ["{month_name} {day}, {year}"],
                        "searches": [
                            {
                                "required_name_terms": ["Angelus"],
                                "date_formats": ["{month_name} {day}, {year}"],
                            }
                        ],
                    },
                },
            )

            with self.assertRaisesRegex(RuntimeError, "cannot mix 'searches'"):
                self.mod.load_spotify_queue_contracts(contract_dir=contract_dir)

        with tempfile.TemporaryDirectory() as tmpdir:
            contract_dir = Path(tmpdir)
            _write_json(
                contract_dir / "broken.json",
                {
                    "key": "broken",
                    "notion_name": "Broken",
                    "spotify_episode_lookup": {
                        "show_id": "show_123",
                        "searches": [
                            {
                                "required_name_terms": [],
                                "date_formats": ["{month_name} {day}, {year}"],
                            }
                        ],
                    },
                },
            )

            with self.assertRaisesRegex(RuntimeError, "required_name_terms"):
                self.mod.load_spotify_queue_contracts(contract_dir=contract_dir)

    def test_load_spotify_queue_contracts_includes_angelus_lookup_contracts(self):
        contracts = {contract.key: contract for contract in self.mod.load_spotify_queue_contracts()}

        for key in ("angelus-morning", "angelus-midday", "angelus-evening"):
            lookup = contracts[key].spotify_episode_lookup
            self.assertIsNotNone(lookup)
            self.assertEqual(lookup.show_id, "4PNxb0OazrkcEp3FAggRoD")
            self.assertEqual(contracts[key].spotify_url_normal, "")
            self.assertEqual(contracts[key].spotify_uri_easter, "")
            self.assertEqual(
                [search.required_name_terms for search in lookup.searches],
                [("Marian Antiphon",), ("Angelus",), ("Regina Caeli",)],
            )

    def test_load_spotify_queue_contracts_includes_auxilium_lookup_contract(self):
        contracts = {contract.key: contract for contract in self.mod.load_spotify_queue_contracts()}
        contract = contracts["auxilium-christianorum"]
        lookup = contract.spotify_episode_lookup

        self.assertEqual(contract.notion_name, "Auxillium Christianorum")
        self.assertEqual(contract.resolver, "")
        self.assertIsNotNone(lookup)
        self.assertEqual(lookup.show_id, "4PNxb0OazrkcEp3FAggRoD")
        self.assertEqual(lookup.required_name_terms, ("Auxilium Christianorum",))
        self.assertEqual(
            lookup.date_formats,
            (
                "{month_name} {day}, {year}",
                "{month_short} {day}, {year}",
                "{month_short}. {day}, {year}",
            ),
        )

    def test_load_spotify_queue_contracts_includes_daily_rosary_lookup_contract(self):
        contracts = {contract.key: contract for contract in self.mod.load_spotify_queue_contracts()}
        contract = contracts["daily-rosary"]
        lookup = contract.spotify_episode_lookup

        self.assertEqual(contract.notion_name, "Daily Rosary")
        self.assertEqual(contract.resolver, "")
        self.assertIsNotNone(lookup)
        self.assertEqual(lookup.show_id, "4PNxb0OazrkcEp3FAggRoD")
        self.assertEqual(lookup.required_name_terms, ("Daily Rosary",))
        self.assertEqual(
            lookup.date_formats,
            (
                "{month_name} {day}, {year}",
                "{month_short} {day}, {year}",
                "{month_short}. {day}, {year}",
            ),
        )

    def test_load_spotify_queue_contracts_includes_daily_examen_episode_contract(self):
        contracts = {contract.key: contract for contract in self.mod.load_spotify_queue_contracts()}

        self.assertIn("daily-examen", contracts)
        self.assertEqual(contracts["daily-examen"].notion_name, "Daily Examen")
        self.assertEqual(contracts["daily-examen"].spotify_uri, "spotify:episode:1I8pCawzp1Wd5pE0NcHmUj")

    def test_load_spotify_queue_contracts_keeps_sunday_homilies_ungated(self):
        contracts = {contract.key: contract for contract in self.mod.load_spotify_queue_contracts()}

        self.assertEqual(contracts["fr-mike-sunday-homily"].resolver, "SUNDAY_FRMIKE")
        self.assertEqual(contracts["fr-mike-sunday-homily"].weekdays, ())
        self.assertEqual(contracts["barron-sunday-sermon"].resolver, "SUNDAY_BARRON")
        self.assertEqual(contracts["barron-sunday-sermon"].weekdays, ())

    def test_load_spotify_playlist_definitions_matches_filter_with_identity_only_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contract_dir = root / "contracts"
            playlist_dir = root / "playlists"
            _write_json(
                contract_dir / "morning-prayer-loh.json",
                {
                    "key": "morning-prayer-loh",
                    "notion_name": "Morning Prayer (LOH)",
                    "resolver": "MORNING",
                },
            )
            _write_json(
                contract_dir / "rosary.json",
                {
                    "key": "rosary",
                    "notion_name": "Rosary",
                    "resolver": "ROSARY",
                },
            )
            _write_json(
                playlist_dir / "morning.json",
                {
                    "key": "morning",
                    "name": "Morning",
                    "playlist_id": "spotify:playlist:morning123",
                },
            )

            definitions = self.mod.load_spotify_playlist_definitions(
                playlist_filter="MORNING",
                playlist_dir=playlist_dir,
                contract_dir=contract_dir,
            )

        self.assertEqual(len(definitions), 1)
        self.assertEqual(definitions[0].key, "morning")
        self.assertEqual(definitions[0].playlist_id, "morning123")
        self.assertEqual(definitions[0].contracts, ())

    def test_load_spotify_playlist_definitions_rejects_bad_playlist_ids(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contract_dir = root / "contracts"
            playlist_dir = root / "playlists"
            _write_json(
                contract_dir / "rosary.json",
                {
                    "key": "rosary",
                    "notion_name": "Rosary",
                    "resolver": "ROSARY",
                },
            )
            _write_json(
                playlist_dir / "morning.json",
                {
                    "key": "morning",
                    "name": "Morning",
                    "playlist_id": "not a spotify id",
                },
            )

            with self.assertRaisesRegex(RuntimeError, "invalid 'playlist_id'"):
                self.mod.load_spotify_playlist_definitions(
                    playlist_dir=playlist_dir,
                    contract_dir=contract_dir,
                )


if __name__ == "__main__":
    unittest.main()
