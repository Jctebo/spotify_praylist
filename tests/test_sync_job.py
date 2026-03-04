import datetime
import unittest
from unittest.mock import patch

from tests.test_helpers import load_module, temp_env


def _title_prop(text):
    return {"type": "title", "title": [{"plain_text": text}]}


def _select_prop(name):
    return {"type": "select", "select": {"name": name}}


def _checkbox_prop(value):
    return {"type": "checkbox", "checkbox": bool(value)}


def _url_prop(value):
    return {"type": "url", "url": value}


class TestSyncJob(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/notion/sync_notion_completions.py")
        self.env = {
            "SPOTIFY_CLIENT_ID": "cid",
            "SPOTIFY_CLIENT_SECRET": "secret",
            "SPOTIFY_REFRESH_TOKEN": "refresh",
            "NOTION_TOKEN": "notion_token",
            "NOTION_DATABASE_ID": "db_1",
        }

    def _run_main_with_payload(self, env, mappings, pages, listened):
        updates = []

        def fake_update(page_id, checkbox_property, value, token):
            updates.append((page_id, checkbox_property, value, token))

        with temp_env(env):
            with patch.object(self.mod, "hour_in_quiet_window", return_value=False), patch.object(
                self.mod, "refresh_access_token", return_value="spotify_token"
            ), patch.object(
                self.mod, "load_sync_config", return_value=mappings
            ), patch.object(
                self.mod, "lookup_notion_database_id", return_value="db_1"
            ), patch.object(
                self.mod, "collect_recent_spotify_activity", return_value=listened
            ), patch.object(
                self.mod, "notion_get_all_pages", return_value=pages
            ), patch.object(
                self.mod, "update_page_checkbox", side_effect=fake_update
            ):
                rc = self.mod.main()
        return rc, updates

    def test_main_uri_rows_fallback_to_text_by_default(self):
        mappings = [
            {
                "notion_name": "Morning Prayer",
                "match_any": ["morning prayer"],
                "time_of_day": "any",
                "profiles": ["any"],
            }
        ]
        pages = [
            {
                "id": "page_uri_unmatched",
                "properties": {
                    "Name": _title_prop("Morning Prayer"),
                    "Completed": _checkbox_prop(False),
                    "Platform": _select_prop("spotify"),
                    "URI": _url_prop("spotify:episode:unmatched"),
                },
            },
            {
                "id": "page_uri_matched",
                "properties": {
                    "Name": _title_prop("Morning Prayer"),
                    "Completed": _checkbox_prop(False),
                    "Platform": _select_prop("spotify"),
                    "URI": _url_prop("spotify:episode:matched"),
                },
            },
            {
                "id": "page_text_only",
                "properties": {
                    "Name": _title_prop("Morning Prayer"),
                    "Completed": _checkbox_prop(False),
                    "Platform": _select_prop("spotify"),
                    "URI": _url_prop(""),
                },
            },
        ]
        listened = {
            "all_texts": {"morning prayer"},
            "all_uris": {"spotify:episode:matched"},
            "morning_texts": set(),
            "midday_texts": set(),
            "night_texts": set(),
            "morning_uris": set(),
            "midday_uris": set(),
            "night_uris": set(),
        }
        rc, updates = self._run_main_with_payload(self.env, mappings, pages, listened)

        self.assertEqual(rc, 0)
        updated_ids = {row[0] for row in updates}
        self.assertIn("page_uri_matched", updated_ids)
        self.assertIn("page_text_only", updated_ids)
        self.assertIn("page_uri_unmatched", updated_ids)

    def test_main_strict_uri_rows_do_not_fallback_to_text(self):
        mappings = [
            {
                "notion_name": "Morning Prayer",
                "match_any": ["morning prayer"],
                "time_of_day": "any",
                "profiles": ["any"],
            }
        ]
        pages = [
            {
                "id": "page_uri_unmatched",
                "properties": {
                    "Name": _title_prop("Morning Prayer"),
                    "Completed": _checkbox_prop(False),
                    "Platform": _select_prop("spotify"),
                    "URI": _url_prop("spotify:episode:unmatched"),
                },
            },
            {
                "id": "page_uri_matched",
                "properties": {
                    "Name": _title_prop("Morning Prayer"),
                    "Completed": _checkbox_prop(False),
                    "Platform": _select_prop("spotify"),
                    "URI": _url_prop("spotify:episode:matched"),
                },
            },
            {
                "id": "page_text_only",
                "properties": {
                    "Name": _title_prop("Morning Prayer"),
                    "Completed": _checkbox_prop(False),
                    "Platform": _select_prop("spotify"),
                    "URI": _url_prop(""),
                },
            },
        ]
        listened = {
            "all_texts": {"morning prayer"},
            "all_uris": {"spotify:episode:matched"},
            "morning_texts": set(),
            "midday_texts": set(),
            "night_texts": set(),
            "morning_uris": set(),
            "midday_uris": set(),
            "night_uris": set(),
        }
        strict_env = dict(self.env)
        strict_env["NOTION_URI_STRICT_MATCH"] = "true"
        rc, updates = self._run_main_with_payload(strict_env, mappings, pages, listened)

        self.assertEqual(rc, 0)
        updated_ids = {row[0] for row in updates}
        self.assertIn("page_uri_matched", updated_ids)
        self.assertIn("page_text_only", updated_ids)
        self.assertNotIn("page_uri_unmatched", updated_ids)

    def test_main_quiet_hours_short_circuit(self):
        fixed_now = datetime.datetime(2026, 3, 2, 23, 5, 0, tzinfo=datetime.timezone.utc)
        with patch.object(self.mod, "local_now_for_job", return_value=fixed_now), patch.object(
            self.mod, "hour_in_quiet_window", return_value=True
        ), patch.object(self.mod, "refresh_access_token", side_effect=AssertionError("should not run")):
            rc = self.mod.main()
        self.assertEqual(rc, 0)


if __name__ == "__main__":
    unittest.main()
