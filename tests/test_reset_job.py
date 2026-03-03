import unittest
from unittest.mock import patch

from tests.test_helpers import load_module, temp_env


def _checkbox_prop(value):
    return {"type": "checkbox", "checkbox": bool(value)}


class TestResetJob(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/notion/reset_notion_completions.py")

    def test_main_unchecks_only_checked_rows(self):
        env = {"NOTION_TOKEN": "notion_token", "NOTION_DATABASE_ID": "db_1"}
        pages = [
            {"id": "page_1", "properties": {"Completed": _checkbox_prop(True)}},
            {"id": "page_2", "properties": {"Completed": _checkbox_prop(False)}},
            {"id": "page_3", "properties": {"Completed": _checkbox_prop(True)}},
        ]
        updates = []

        def fake_update(page_id, checkbox_property, value, token):
            updates.append((page_id, checkbox_property, value, token))

        with temp_env(env):
            with patch.object(self.mod, "lookup_notion_database_id", return_value="db_1"), patch.object(
                self.mod, "notion_get_all_pages", return_value=pages
            ), patch.object(self.mod, "update_page_checkbox", side_effect=fake_update):
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        self.assertEqual(len(updates), 2)
        self.assertEqual({row[0] for row in updates}, {"page_1", "page_3"})

    def test_main_fails_if_completed_property_not_checkbox(self):
        env = {"NOTION_TOKEN": "notion_token", "NOTION_DATABASE_ID": "db_1"}
        pages = [
            {
                "id": "page_bad",
                "properties": {"Completed": {"type": "rich_text", "rich_text": [{"plain_text": "yes"}]}},
            }
        ]

        with temp_env(env):
            with patch.object(self.mod, "lookup_notion_database_id", return_value="db_1"), patch.object(
                self.mod, "notion_get_all_pages", return_value=pages
            ):
                rc = self.mod.main()

        self.assertEqual(rc, 1)


if __name__ == "__main__":
    unittest.main()
