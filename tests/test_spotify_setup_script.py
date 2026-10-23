import json
import re
import unittest
from pathlib import Path


class TestSpotifySetupScript(unittest.TestCase):
    def test_setup_wizard_reads_and_writes_every_repository_playlist_id(self):
        playlist_dir = Path("config/spotify/playlists")
        configured_keys = {
            json.loads(path.read_text(encoding="utf-8"))["key"]
            for path in playlist_dir.glob("*.json")
        }
        script = Path("scripts/setup_spotify.ps1").read_text(encoding="utf-8")

        prompted_keys = set(re.findall(r'Get-PlaylistDefinitionPlaylistId -Key "([^"]+)"', script))
        written_keys = set(re.findall(r'Set-PlaylistDefinitionPlaylistId -Key "([^"]+)"', script))

        self.assertEqual(prompted_keys, configured_keys)
        self.assertEqual(written_keys, configured_keys)


if __name__ == "__main__":
    unittest.main()
