import unittest
from unittest.mock import patch

from tests.test_helpers import load_module, temp_env


def _title_prop(text):
    return {"type": "title", "title": [{"plain_text": text}]}


class TestGeneratePrayer(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/notion/generate_prayer.py")

    def test_load_prayer_config_from_file(self):
        payload = self.mod.load_prayer_config_from_file()

        self.assertEqual(payload["key"], "morning-prayer")
        self.assertEqual(payload["title"], "Morning Prayer")
        self.assertGreater(len(payload["resolvers"]), 0)

    def test_main_uses_config_file_and_runs_morning_prayer(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Morning Prayer"),
                "Platform": {"type": "rich_text", "rich_text": [{"plain_text": "auto-audio,auto-text"}]},
                "Enabled": {"type": "checkbox", "checkbox": True},
            },
        }

        plan = self.mod.page_audio.PageAudioPlan(
            fragments=[self.mod.page_audio.PageAudioFragment(kind="tts", label="Morning Offering", hash_value="hash_1", text="Morning Offering.")]
        )

        env = {
            "OPENAI_API_KEY": "openai",
            "NOTION_TOKEN": "notion",
            "NOTION_DATABASE_ID": "db_1",
            "PRAYER_CONFIG_FILE": "config/morning-prayer/morning-prayer.json",
            "PRAYER_ROW_TITLE": "Morning Prayer",
        }

        with temp_env(env), patch.object(self.mod.page_audio.shared, "require_env", side_effect=lambda key: env[key]), patch.object(
            self.mod.page_audio.shared, "notion_find_database_id", return_value="db_1"
        ), patch.object(
            self.mod.page_audio.shared, "notion_get_all_pages", return_value=[page]
        ), patch.object(
            self.mod.page_audio, "list_audio_candidate_pages", return_value=[page]
        ), patch.object(
            self.mod.page_audio, "build_morning_prayer_plan", return_value=plan
        ) as build_mock, patch.object(
            self.mod.page_audio, "render_page_audio_for_config", return_value="cached:mp3:gpt-4o-mini-tts:alloy:hash=abc123"
        ) as render_mock:
            exit_code = self.mod.main()

        self.assertEqual(exit_code, 0)
        build_mock.assert_called_once()
        render_mock.assert_called_once()


if __name__ == "__main__":
    unittest.main()
