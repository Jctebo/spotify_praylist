import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tests.test_helpers import load_module


class TestNotionEpisodeMigration(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("scripts/migrate_notion_episodes.py")

    def _contract_dir(self, root: Path) -> Path:
        directory = root / "contracts"
        directory.mkdir()
        (directory / "sample.json").write_text(
            json.dumps({
                "contract": {"id": "sample", "type": "daily-prayer", "frequency": "daily", "timezone": "UTC", "version": "1"},
                "entries": [{"entry_id": "episode-1", "title": "Episode", "blocks": [{"kind": "inline", "text": "Body"}]}],
            }),
            encoding="utf-8",
        )
        return directory

    def test_property_parser_handles_supported_notion_property_types(self):
        page = {"id": "page", "properties": {
            "Entry ID": {"rich_text": [{"plain_text": "episode-"}, {"plain_text": "1"}]},
            "Date": {"date": {"start": "2026-10-16"}},
            "Status": {"select": {"name": "approved"}},
            "Text": {"rich_text": [{"plain_text": "Prayer body"}]},
            "Text Hash": {"rich_text": [{"plain_text": "hash"}]},
            "Audio Enabled": {"checkbox": True},
            "Audio URL": {"url": "https://example.test/episode.mp3"},
            "Audio Path": {"rich_text": [{"plain_text": "docs/audio/episode.mp3"}]},
            "Content Hash": {"rich_text": [{"plain_text": "content-hash"}]},
        }}
        row = self.mod._read_row(page)
        self.assertEqual(row["entry_id"], "episode-1")
        self.assertEqual(row["date"], "2026-10-16")
        self.assertEqual(row["status"], "approved")
        self.assertEqual(row["text"], "Prayer body")
        self.assertEqual(row["text_hash"], "hash")
        self.assertTrue(row["audio_enabled"])
        self.assertEqual(row["audio_url"], "https://example.test/episode.mp3")

    def test_row_parser_reports_database_schema_mismatch(self):
        with self.assertRaisesRegex(RuntimeError, "does not match the episode database schema") as error:
            self.mod._read_row({"id": "page", "properties": {"Name": {"title": []}}})
        self.assertIn("Entry ID", str(error.exception))
        self.assertIn("Name", str(error.exception))

    def test_fetch_all_pages_follows_cursor_and_rejects_missing_cursor(self):
        client = mock.Mock()
        client.query_database.side_effect = [
            {"results": [{"id": "one"}], "has_more": True, "next_cursor": "next"},
            {"results": [{"id": "two"}], "has_more": False},
        ]
        rows = self.mod.fetch_all_pages(client, "database")
        self.assertEqual([row["id"] for row in rows], ["one", "two"])
        self.assertEqual(client.query_database.call_args_list[1].args[1]["start_cursor"], "next")
        client.query_database.side_effect = None
        client.query_database.return_value = {"results": [], "has_more": True}
        with self.assertRaisesRegex(RuntimeError, "next_cursor"):
            self.mod.fetch_all_pages(client, "database")

    def test_migration_preserves_all_fields_and_is_repeatable(self):
        row = {
            "entry_id": "episode-1", "date": "2026-10-16", "status": "approved", "text": "Prayer text",
            "text_hash": "text-hash", "audio_enabled": True, "audio_url": "https://example.test/a.mp3",
            "audio_path": "docs/audio/a.mp3", "content_hash": "content-hash",
        }
        with tempfile.TemporaryDirectory() as temporary:
            directory = self._contract_dir(Path(temporary))
            first = self.mod.migrate_rows([row], contract_dir=directory)
            output = first[directory / "sample.json"]["entries"][0]["episode_state"]
            self.assertEqual(output, row)
            raw = (directory / "sample.json").read_bytes()
            self.mod.migrate_rows([row], contract_dir=directory)
            self.assertEqual((directory / "sample.json").read_bytes(), raw)

    def test_invalid_or_duplicate_rows_do_not_write_contracts(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = self._contract_dir(Path(temporary))
            contract_path = directory / "sample.json"
            original = contract_path.read_bytes()
            row = {"entry_id": "missing"}
            with self.assertRaisesRegex(RuntimeError, "No publish contract entry"):
                self.mod.migrate_rows([row], contract_dir=directory)
            with self.assertRaisesRegex(RuntimeError, "Duplicate Notion Entry ID"):
                self.mod.migrate_rows([{"entry_id": "episode-1"}, {"entry_id": "episode-1"}], contract_dir=directory)
            self.assertEqual(contract_path.read_bytes(), original)

