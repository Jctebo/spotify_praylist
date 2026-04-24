import datetime
import os
import unittest
from unittest.mock import patch

from tests.test_helpers import load_module, temp_env


class TestLiturgicalCalendarSync(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/novena/sync_liturgical_calendar.py")

    def test_compute_range_prefers_target_year_over_other_inputs(self):
        with temp_env(
            {
                "LITURGICAL_SYNC_TARGET_YEAR": "2028",
                "LITURGICAL_SYNC_START_DATE": "2026-01-01",
                "LITURGICAL_SYNC_END_YEAR": "2027",
            }
        ):
            start_date, end_date = self.mod.compute_range(datetime.date(2025, 1, 1))

        self.assertEqual(start_date, datetime.date(2028, 1, 1))
        self.assertEqual(end_date, datetime.date(2028, 12, 31))

    def test_compute_range_uses_bootstrap_start_date_and_end_year(self):
        with temp_env(
            {
                "LITURGICAL_SYNC_START_DATE": "2026-01-01",
                "LITURGICAL_SYNC_END_YEAR": "2027",
            }
        ):
            start_date, end_date = self.mod.compute_range(datetime.date(2025, 1, 1))

        self.assertEqual(start_date, datetime.date(2026, 1, 1))
        self.assertEqual(end_date, datetime.date(2027, 12, 31))

    def test_dedupe_exact_rows_archives_duplicate_rows_by_day_and_title(self):
        pages = [
            {
                "id": "page_1",
                "created_time": "2026-01-01T08:00:00.000Z",
                "feast_day": "2026-03-29",
                "name": "Palm Sunday",
            },
            {
                "id": "page_2",
                "created_time": "2026-01-02T08:00:00.000Z",
                "feast_day": "2026-03-29",
                "name": "Palm Sunday",
            },
            {
                "id": "page_3",
                "created_time": "2026-01-03T08:00:00.000Z",
                "feast_day": "2026-03-29",
                "name": "Easter Sunday",
            },
            {
                "id": "page_4",
                "created_time": "2026-01-04T08:00:00.000Z",
                "feast_day": "2026-04-05",
                "name": "Palm Sunday",
            },
            {
                "id": "page_5",
                "created_time": "2026-01-05T08:00:00.000Z",
                "feast_day": "2026-03-29",
                "name": "Palm Sunday",
                "archived": True,
                "in_trash": True,
            },
        ]

        with patch.object(self.mod, "notion_get_all_pages", return_value=pages), patch.object(
            self.mod, "page_date", side_effect=lambda page, _prop: str(page.get("feast_day", ""))
        ), patch.object(
            self.mod, "page_title", side_effect=lambda page, _prop: str(page.get("name", ""))
        ), patch.object(
            self.mod, "notion_call"
        ) as notion_call_mock:
            keys, archived = self.mod.dedupe_exact_rows(
                database_id="db_1",
                token="token",
                start=datetime.date(2026, 1, 1),
                end=datetime.date(2026, 12, 31),
            )

        self.assertEqual(keys, 1)
        self.assertEqual(archived, 1)
        notion_call_mock.assert_called_once()
        self.assertEqual(notion_call_mock.call_args.args[0], "PATCH")
        self.assertEqual(notion_call_mock.call_args.args[1], "https://api.notion.com/v1/pages/page_2")

    def test_main_runs_collect_upsert_and_dedupe_for_requested_window(self):
        with temp_env(
            {
                "NOTION_TOKEN": "token",
                "NOTION_DATABASE_ID": "db_1",
                "LITURGICAL_CALENDAR_DATABASE_NAME": "Liturgical Calendar",
                "LITURGICAL_SYNC_START_DATE": "2026-01-01",
                "LITURGICAL_SYNC_END_YEAR": "2027",
                "ROMCAL_CALENDAR": "general_roman",
                "ROMCAL_LOCALE": "en",
            }
        ):
            with patch.object(self.mod, "local_today", return_value=datetime.date(2025, 1, 1)), patch.object(
                self.mod, "notion_find_database_id", return_value="parent_db"
            ), patch.object(
                self.mod, "notion_find_database_id_by_name", return_value="lit_db_1"
            ), patch.object(
                self.mod,
                "collect_calendar_days_window",
                return_value=[
                    {
                        "date": "2026-03-29",
                        "name": "Palm Sunday of the Passion of the Lord",
                        "celebration_rank": "solemnity",
                        "precedence": "Precedence.privileged_sunday_2",
                        "entry_kind": "calendar_day",
                    }
                ],
            ) as collect_mock, patch.object(
                self.mod,
                "sync_saint_radar",
                return_value="existing:db_1:upserted=1:regenerated=0:refresh_all=false",
            ) as sync_mock, patch.object(
                self.mod, "dedupe_exact_rows", return_value=(1, 0)
            ) as dedupe_mock:
                exit_code = self.mod.main()

        self.assertEqual(exit_code, 0)
        collect_mock.assert_called_once_with("general_roman", "en", datetime.date(2026, 1, 1), 730)
        sync_mock.assert_called_once()
        dedupe_mock.assert_called_once_with(
            database_id="lit_db_1",
            token="token",
            start=datetime.date(2026, 1, 1),
            end=datetime.date(2027, 12, 31),
        )
        self.assertEqual(os.environ["NOTION_SAINT_DATABASE_ID"], "lit_db_1")
        self.assertEqual(os.environ["NOTION_SAINT_DATABASE_NAME"], "Liturgical Calendar")
