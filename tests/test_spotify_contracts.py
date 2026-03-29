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
                    "name": "Morning Prayer (LOH)",
                    "resolver": "MORNING",
                    "fallback_resolver": "DO_MORNING",
                },
            )
            _write_json(
                contract_dir / "fr-mike-sunday-homily.json",
                {
                    "key": "fr-mike-sunday-homily",
                    "name": "Fr. Mike Sunday Homily",
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
                    "name": "Marian Antiphon (Morning)",
                    "spotify_url_normal": "spotify:track:39Jgl6ST4fQj4fNyRSQZFk",
                    "spotify_uri_easter": "spotify:episode:7ni2KH5KdbtK0JFL74V8x3",
                },
            )
            _write_json(
                contract_dir / "angelus-midday.json",
                {
                    "key": "angelus-midday",
                    "name": "Marian Antiphon (Midday)",
                    "spotify_url_normal": "spotify:episode:2HNK8wLRWHh0mJ9xmJjlUD",
                    "spotify_uri_easter": "spotify:episode:68xFE8g1JRFu62osp0tLNg",
                },
            )
            _write_json(
                contract_dir / "angelus-evening.json",
                {
                    "key": "angelus-evening",
                    "name": "Marian Antiphon (Evening)",
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
                    "name": "Broken",
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
                    "name": "Broken",
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
                    "name": "Broken",
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
                    "name": "Marian Antiphon (Morning)",
                    "spotify_url_normal": "spotify:track:1dbE76sfAobxVwYYjQ6yb6",
                },
            )

            with self.assertRaisesRegex(RuntimeError, "must define both 'spotify_url_normal' and 'spotify_uri_easter'"):
                self.mod.load_spotify_queue_contracts(contract_dir=contract_dir)

    def test_load_spotify_playlist_definitions_matches_filter_and_validates_refs(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contract_dir = root / "contracts"
            playlist_dir = root / "playlists"
            _write_json(
                contract_dir / "morning-prayer-loh.json",
                {
                    "key": "morning-prayer-loh",
                    "name": "Morning Prayer (LOH)",
                    "resolver": "MORNING",
                },
            )
            _write_json(
                contract_dir / "rosary.json",
                {
                    "key": "rosary",
                    "name": "Rosary",
                    "resolver": "ROSARY",
                },
            )
            _write_json(
                playlist_dir / "morning.json",
                {
                    "key": "morning",
                    "name": "Morning",
                    "playlist_id": "spotify:playlist:morning123",
                    "contracts": ["rosary", "morning-prayer-loh"],
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
        self.assertEqual(definitions[0].contracts, ("rosary", "morning-prayer-loh"))

    def test_load_spotify_playlist_definitions_rejects_missing_contract_refs_and_bad_playlist_ids(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contract_dir = root / "contracts"
            playlist_dir = root / "playlists"
            _write_json(
                contract_dir / "rosary.json",
                {
                    "key": "rosary",
                    "name": "Rosary",
                    "resolver": "ROSARY",
                },
            )
            _write_json(
                playlist_dir / "morning.json",
                {
                    "key": "morning",
                    "name": "Morning",
                    "playlist_id": "morning123",
                    "contracts": ["rosary", "missing-contract"],
                },
            )

            with self.assertRaisesRegex(RuntimeError, "unknown contract key 'missing-contract'"):
                self.mod.load_spotify_playlist_definitions(
                    playlist_dir=playlist_dir,
                    contract_dir=contract_dir,
                )

        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contract_dir = root / "contracts"
            playlist_dir = root / "playlists"
            _write_json(
                contract_dir / "rosary.json",
                {
                    "key": "rosary",
                    "name": "Rosary",
                    "resolver": "ROSARY",
                },
            )
            _write_json(
                playlist_dir / "morning.json",
                {
                    "key": "morning",
                    "name": "Morning",
                    "playlist_id": "not a spotify id",
                    "contracts": ["rosary"],
                },
            )

            with self.assertRaisesRegex(RuntimeError, "invalid 'playlist_id'"):
                self.mod.load_spotify_playlist_definitions(
                    playlist_dir=playlist_dir,
                    contract_dir=contract_dir,
                )


if __name__ == "__main__":
    unittest.main()
