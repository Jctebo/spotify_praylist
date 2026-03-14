import unittest
from unittest.mock import patch

from tests.test_helpers import load_module, temp_env


def _title_prop(text):
    return {"type": "title", "title": [{"plain_text": text}]}


def _rich_text_prop(text):
    return {"type": "rich_text", "rich_text": [{"plain_text": text}]}


def _checkbox_prop(value):
    return {"type": "checkbox", "checkbox": bool(value)}


class TestPageAudioJob(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/notion/generate_page_audio.py")

    def test_parse_monthly_intention_section_builds_spoken_text(self):
        parsed = self.mod.parse_monthly_intention_section(
            "MARCH",
            "For disarmament and peace. Let us pray that nations move toward dialogue instead of violence.",
        )

        self.assertEqual(parsed["month"], "March")
        self.assertEqual(parsed["title"], "For disarmament and peace")
        self.assertIn("For the Holy Father's monthly intention:", parsed["spoken_text"])
        self.assertIn("that nations move toward dialogue instead of violence.", parsed["spoken_text"])

    def test_build_morning_prayer_fragments_reuses_daily_novena_audio(self):
        page = {
            "id": "page_1",
            "properties": {"Name": _title_prop("Morning Prayer")},
        }
        novena_page = {
            "id": "page_2",
            "properties": {"Name": _title_prop("Daily Novenas from Liturgical Calendar")},
        }
        top_blocks = [
            {"id": "bookmark_1", "type": "bookmark", "bookmark": {"url": "https://example.com"}},
            {"id": "heading_1", "type": "heading_3", "heading_3": {"rich_text": [{"plain_text": "Morning Offering"}]}},
            {"id": "paragraph_1", "type": "paragraph", "paragraph": {"rich_text": [{"plain_text": "Offer my day."}]}},
            {"id": "heading_2", "type": "heading_3", "heading_3": {"rich_text": [{"plain_text": "Petitions"}]}},
            {"id": "paragraph_2", "type": "paragraph", "paragraph": {"rich_text": [{"plain_text": "I pray for these intentions."}]}},
            {
                "id": "list_1",
                "type": "numbered_list_item",
                "numbered_list_item": {"rich_text": [{"plain_text": "(monthly fragment For the Holy Father's monthly intention)"}]},
            },
            {"id": "paragraph_3", "type": "paragraph", "paragraph": {"rich_text": [{"plain_text": "(Daily Novena Fragment)"}]}},
        ]
        novena_blocks = [
            {
                "id": "audio_1",
                "type": "audio",
                "audio": {
                    "type": "file",
                    "file": {"url": "https://example.com/novena_1.mp3"},
                    "caption": [{"plain_text": "Novena One [AUTOGEN_NOVENA_AUDIO_HASH:abc12345] [AUTOGEN_NOVENA_AUDIO]"}],
                },
            },
            {
                "id": "audio_2",
                "type": "audio",
                "audio": {
                    "type": "file",
                    "file": {"url": "https://example.com/novena_2.mp3"},
                    "caption": [{"plain_text": "Novena Two [AUTOGEN_NOVENA_AUDIO_HASH:def67890] [AUTOGEN_NOVENA_AUDIO]"}],
                },
            },
        ]

        def fake_children(block_id, _token):
            if block_id == "page_1":
                return top_blocks
            if block_id == "page_2":
                return novena_blocks
            return []

        config = {
            "builder": "morning_prayer_v1",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "daily_novena_page_title": "Daily Novenas from Liturgical Calendar",
        }

        with patch.object(self.mod.shared, "notion_list_block_children", side_effect=fake_children), patch.object(
            self.mod, "fetch_monthly_intention", return_value={"title": "For peace", "spoken_text": "For the Holy Father's monthly intention: that peace may grow."}
        ):
            fragments = self.mod.build_morning_prayer_fragments(
                page=page,
                pages=[page, novena_page],
                title_property="Name",
                config=config,
                token="token",
                base_url="https://api.openai.com/v1",
            )

        self.assertEqual([fragment.kind for fragment in fragments], ["tts", "tts", "source_audio", "source_audio"])
        self.assertIn("Morning Offering", fragments[0].text)
        self.assertIn("For the Holy Father's monthly intention: that peace may grow.", fragments[1].text)
        self.assertEqual(fragments[2].source_url, "https://example.com/novena_1.mp3")
        self.assertEqual(fragments[3].hash_value, "def67890")

    def test_render_page_audio_for_config_uses_cached_hash(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Morning Prayer")}}
        config = {
            "builder": "morning_prayer_v1",
            "audio_caption": "Morning Prayer (Audio)",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
        }
        fragments = [self.mod.PageAudioFragment(kind="tts", label="Morning Offering", hash_value="hash_1", text="Morning Offering.")]
        render_hash = self.mod.compute_page_render_hash("MORNING_PRAYER_PAGE_AUDIO", config, fragments)

        with patch.object(self.mod, "build_morning_prayer_fragments", return_value=fragments), patch.object(
            self.mod, "page_audio_current_render_hash", return_value=render_hash
        ), patch.object(self.mod, "build_assembled_audio") as assemble_mock:
            mode = self.mod.render_page_audio_for_config(
                page=page,
                pages=[page],
                title_property="Name",
                config_key="MORNING_PRAYER_PAGE_AUDIO",
                config=config,
                notion_token="token",
                openai_key="openai",
                base_url="https://api.openai.com/v1",
            )

        self.assertEqual(mode, f"cached:mp3:gpt-4o-mini-tts:alloy:hash={render_hash}")
        assemble_mock.assert_not_called()

    def test_main_filters_auto_audio_rows(self):
        env = {
            "OPENAI_API_KEY": "key",
            "NOTION_TOKEN": "notion_token",
            "NOTION_DATABASE_ID": "db_1",
            "NOTION_AUDIO_PLATFORM_VALUE": "auto-audio",
        }
        pages = [
            {
                "id": "page_1",
                "properties": {
                    "Name": _title_prop("Morning Prayer"),
                    "Platform": _rich_text_prop("auto-audio"),
                    "Spotify Resolver": _rich_text_prop("MORNING_PRAYER_PAGE_AUDIO"),
                    "Enabled": _checkbox_prop(True),
                },
            },
            {
                "id": "page_2",
                "properties": {
                    "Name": _title_prop("Bible in a Year"),
                    "Platform": _rich_text_prop("spotify"),
                    "Spotify Resolver": _rich_text_prop("BIBLE_IN_A_YEAR"),
                    "Enabled": _checkbox_prop(True),
                },
            },
        ]

        with temp_env(env):
            with patch.object(self.mod, "load_page_audio_config", return_value={"configs": {"MORNING_PRAYER_PAGE_AUDIO": {"builder": "morning_prayer_v1", "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}}}}), patch.object(
                self.mod.shared, "notion_find_database_id", return_value="db_1"
            ), patch.object(
                self.mod.shared, "notion_get_all_pages", return_value=pages
            ), patch.object(
                self.mod, "render_page_audio_for_config", return_value="cached:mp3:gpt-4o-mini-tts:alloy:hash=abcd1234"
            ) as render_mock:
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        render_mock.assert_called_once()


if __name__ == "__main__":
    unittest.main()
