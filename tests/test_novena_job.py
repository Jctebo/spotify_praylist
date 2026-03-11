import datetime
import unittest
from unittest.mock import patch

from tests.test_helpers import load_module, temp_env


def _title_prop(text):
    return {"type": "title", "title": [{"plain_text": text}]}


def _rich_text_prop(text):
    return {"type": "rich_text", "rich_text": [{"plain_text": text}]}


class TestNovenaJob(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/novena/generate_daily_novena_prayer.py")

    def test_find_target_notion_page_accepts_alias_titles(self):
        pages = [
            {
                "id": "page_1",
                "properties": {
                    "Name": _title_prop("Daily Novenas from Liturgical Calendar"),
                },
            }
        ]

        page = self.mod.find_target_notion_page(
            pages,
            "Name",
            ["Daily Novena Prayer", "Daily Novenas from Liturgical Calendar"],
        )

        self.assertEqual(page["id"], "page_1")

    def test_mirror_calendar_page_to_novena_page_clones_toggle_and_audio(self):
        source_blocks = [
            {
                "id": "toggle_1",
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"plain_text": "Novena - Saint Patrick", "type": "text", "text": {"content": "Novena - Saint Patrick"}}],
                    "color": "default",
                },
            },
            {
                "id": "audio_1",
                "type": "audio",
                "audio": {
                    "type": "file",
                    "file": {"url": "https://example.com/novena.mp3"},
                    "caption": [{"plain_text": "Novena Audio", "type": "text", "text": {"content": "Novena Audio"}}],
                },
            },
        ]
        toggle_children = [
            {
                "id": "paragraph_1",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"plain_text": "Prayer text", "type": "text", "text": {"content": "Prayer text"}}],
                    "color": "default",
                },
            }
        ]

        def fake_list_block_children(block_id, _token):
            if block_id == "source_page":
                return source_blocks
            if block_id == "toggle_1":
                return toggle_children
            return []

        with patch.object(self.mod, "notion_list_block_children", side_effect=fake_list_block_children), patch.object(
            self.mod, "notion_download_bytes", return_value=(b"audio-bytes", "audio/mpeg")
        ), patch.object(
            self.mod, "notion_create_file_upload", return_value="upload_1"
        ), patch.object(
            self.mod, "notion_send_file_upload"
        ) as send_mock, patch.object(
            self.mod, "notion_replace_page_blocks"
        ) as replace_mock:
            mode = self.mod.mirror_calendar_page_to_novena_page(
                {"id": "target_page"},
                {"id": "source_page"},
                "token",
            )

        self.assertEqual(mode, "mirrored:2")
        send_mock.assert_called_once()
        replace_mock.assert_called_once()
        target_page_id = replace_mock.call_args.args[0]
        children = replace_mock.call_args.args[1]
        self.assertEqual(target_page_id, "target_page")
        self.assertEqual(children[0]["type"], "toggle")
        self.assertEqual(children[0]["toggle"]["children"][0]["type"], "paragraph")
        self.assertEqual(children[1]["type"], "audio")
        self.assertEqual(children[1]["audio"]["type"], "file_upload")
        self.assertEqual(children[1]["audio"]["file_upload"]["id"], "upload_1")

    def test_collect_saints_window_prefers_marked_saints(self):
        start = datetime.date(2026, 3, 3)
        day_data = {
            0: [
                {"name": "Saint Agnes", "isSaint": True},
                {"name": "Tuesday of Lent", "type": "weekday"},
            ],
            1: [
                {"name": "St. Patrick", "type": "memorial"},
                {"name": "Wednesday of Lent", "type": "weekday"},
            ],
        }

        def fake_fetch(_cal, _loc, dt):
            offset = (dt - start).days
            return day_data.get(offset, [])

        with patch.object(self.mod, "romcal_fetch_day", side_effect=fake_fetch):
            saints = self.mod.collect_saints_window("general_roman", "en", start, 2)

        names = [row["name"] for row in saints]
        self.assertIn("Saint Agnes", names)
        self.assertIn("St. Patrick", names)
        self.assertNotIn("Tuesday of Lent", names)

    def test_collect_saints_window_falls_back_when_no_saint_markers(self):
        start = datetime.date(2026, 3, 3)

        def fake_fetch(_cal, _loc, _dt):
            return [{"name": "Tuesday of Lent", "type": "weekday"}]

        with patch.object(self.mod, "romcal_fetch_day", side_effect=fake_fetch):
            saints = self.mod.collect_saints_window("general_roman", "en", start, 0)
        self.assertEqual(len(saints), 1)
        self.assertEqual(saints[0]["name"], "Tuesday of Lent")

    def test_write_prayer_to_notion_page_uses_rich_text_property(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Daily Novena Prayer"),
                "Prayer": _rich_text_prop("old"),
            },
        }
        with temp_env({"NOTION_NOVENA_PROPERTY": "Prayer"}):
            with patch.object(self.mod, "notion_update_rich_text_property") as update_mock, patch.object(
                self.mod, "notion_replace_page_content"
            ) as content_mock:
                mode = self.mod.write_prayer_to_notion_page(page, "new prayer", "token")
        self.assertEqual(mode, "property:Prayer")
        update_mock.assert_called_once()
        content_mock.assert_not_called()

    def test_main_happy_path(self):
        env = {
            "OPENAI_API_KEY": "key",
            "NOTION_TOKEN": "notion_token",
            "NOTION_DATABASE_ID": "db_1",
            "NOTION_NOVENA_ROW_TITLE": "Daily Novena Prayer",
        }
        pages = [
            {
                "id": "page_1",
                "properties": {
                    "Name": _title_prop("Daily Novena Prayer"),
                    "Prayer": _rich_text_prop("old"),
                },
            }
        ]
        saints = [{"date": "2026-03-03", "name": "Saint Agnes"}]

        with temp_env(env):
            with patch.object(self.mod, "local_today", return_value=datetime.date(2026, 3, 3)), patch.object(
                self.mod, "notion_find_database_id", return_value="db_1"
            ), patch.object(
                self.mod, "collect_saints_window", return_value=saints
            ), patch.object(
                self.mod, "call_openai_litany", return_value="Daily Novena Prayer\nSaint Agnes, pray for us."
            ), patch.object(
                self.mod, "notion_get_all_pages", return_value=pages
            ), patch.object(
                self.mod, "write_prayer_to_notion_page", return_value="page_content"
            ) as write_mock:
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        write_mock.assert_called_once()


if __name__ == "__main__":
    unittest.main()
