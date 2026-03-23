import datetime
from contextlib import ExitStack
import os
import tempfile
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests

from tests.test_helpers import load_module, temp_env


def _title_prop(text):
    return {"type": "title", "title": [{"plain_text": text}]}


def _rich_text_prop(text):
    return {"type": "rich_text", "rich_text": [{"plain_text": text}]}


class TestNovenaJob(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/novena/generate_daily_novena_prayer.py")

    def test_notion_archive_block_ignores_already_archived_error(self):
        response = Mock()
        response.status_code = 400
        response.json.return_value = {
            "message": "Can't edit block that is archived. You must unarchive the block before editing."
        }
        error = requests.HTTPError("bad request")
        error.response = response

        with patch.object(self.mod, "notion_call", side_effect=error):
            self.mod.notion_archive_block("block_1", "token")

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

    def test_direct_script_import_bootstraps_repo_root_without_pythonpath(self):
        script_path = Path("jobs/novena/generate_daily_novena_prayer.py").resolve()
        code = (
            "import importlib.util; "
            f"spec = importlib.util.spec_from_file_location('novena_job_bootstrap', r'{script_path}'); "
            "module = importlib.util.module_from_spec(spec); "
            "spec.loader.exec_module(module)"
        )

        env = {key: value for key, value in os.environ.items() if key != "PYTHONPATH"}
        result = subprocess.run(
            [sys.executable, "-c", code],
            cwd=tempfile.gettempdir(),
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(
            result.returncode,
            0,
            msg=f"stdout={result.stdout}\nstderr={result.stderr}",
        )

    def test_mirror_calendar_page_to_novena_page_clones_only_novena_toggle_and_audio(self):
        source_blocks = [
            {
                "id": "toggle_reading_1",
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"plain_text": "Reading 1", "type": "text", "text": {"content": "Reading 1"}}],
                    "color": "default",
                },
            },
            {
                "id": "toggle_1",
                "type": "toggle",
                "toggle": {
                    "rich_text": [{
                        "plain_text": "Novena - Saint Patrick [AUTOGEN_NOVENA_DAY:saint-patrick:2026-03-11]",
                        "type": "text",
                        "text": {"content": "Novena - Saint Patrick [AUTOGEN_NOVENA_DAY:saint-patrick:2026-03-11]"},
                    }],
                    "color": "default",
                },
            },
            {
                "id": "audio_1",
                "type": "audio",
                "audio": {
                    "type": "file",
                    "file": {"url": "https://example.com/novena.mp3"},
                    "caption": [{
                        "plain_text": "Novena Audio [AUTOGEN_NOVENA_DAY:saint-patrick:2026-03-11]",
                        "type": "text",
                        "text": {"content": "Novena Audio [AUTOGEN_NOVENA_DAY:saint-patrick:2026-03-11]"},
                    }],
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

        self.assertEqual(mode, "mirrored_novena:2")
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

    def test_notion_clone_block_tree_preserves_heading_children(self):
        heading = {
            "id": "heading_1",
            "type": "heading_3",
            "has_children": True,
            "heading_3": {
                "rich_text": [{"plain_text": "Morning Offering", "type": "text", "text": {"content": "Morning Offering"}}]
            },
        }
        child_blocks = [
            {
                "id": "paragraph_1",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"plain_text": "Offer my day.", "type": "text", "text": {"content": "Offer my day."}}],
                    "color": "default",
                },
            }
        ]

        with patch.object(self.mod, "notion_list_block_children", return_value=child_blocks):
            cloned = self.mod.notion_clone_block_tree(heading, "token")

        self.assertIsNotNone(cloned)
        self.assertEqual(cloned["type"], "heading_3")
        self.assertEqual(cloned["heading_3"]["children"][0]["type"], "paragraph")

    def test_append_usccb_readings_to_extra_pages_replaces_content_preserving_bookmarks(self):
        existing_blocks = [
            {
                "id": "bookmark_1",
                "type": "bookmark",
                "bookmark": {"url": "https://open.spotify.com/episode/abc123"},
            },
            {
                "id": "old_toggle_1",
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"plain_text": "Reading 1", "type": "text", "text": {"content": "Reading 1"}}],
                    "color": "default",
                },
            },
        ]
        readings_blocks = [
            {
                "object": "block",
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"plain_text": "USCCB Daily Mass Readings [AUTOGEN_USCCB_READINGS]", "type": "text", "text": {"content": "USCCB Daily Mass Readings [AUTOGEN_USCCB_READINGS]"}}],
                    "color": "default",
                },
            }
        ]

        with patch.object(self.mod, "notion_list_block_children", return_value=existing_blocks), patch.object(
            self.mod, "notion_replace_page_blocks"
        ) as replace_mock:
            wrote = self.mod.append_usccb_readings_to_extra_pages(["page_1"], readings_blocks, "token")

        self.assertEqual(wrote, 1)
        replace_mock.assert_called_once()
        page_id = replace_mock.call_args.args[0]
        children = replace_mock.call_args.args[1]
        self.assertEqual(page_id, "page_1")
        self.assertEqual(children[0]["type"], "bookmark")
        self.assertEqual(children[1]["type"], "toggle")

    def test_sync_saint_radar_skips_archived_pages_and_creates_new_rows(self):
        page = {
            "id": "page_1",
            "archived": True,
            "in_trash": True,
            "properties": {
                "Name": _title_prop("Saint Leo the Great, Pope and Doctor of the Church"),
                "Feast Day": {"type": "date", "date": {"start": "2027-11-10"}},
            },
        }
        database = {
            "properties": {
                "Name": {"type": "title"},
                "Feast Day": {"type": "date"},
                "Celebration Rank": {"type": "select"},
                "Precedence": {"type": "rich_text"},
                "Background": {"type": "rich_text"},
            }
        }
        saints = [
            {
                "date": "2027-11-10",
                "name": "Saint Leo the Great, Pope and Doctor of the Church",
                "celebration_rank": "solemnity",
                "precedence": "Precedence.memorial_1",
                "entry_kind": "calendar_day",
            }
        ]

        with temp_env(
            {
                "NOTION_SAINT_RADAR_ENABLED": "true",
                "NOTION_SAINT_DATABASE_ID": "db_1",
                "NOTION_SAINT_TITLE_PROPERTY": "Name",
                "NOTION_SAINT_FEAST_DAY_PROPERTY": "Feast Day",
                "NOTION_SAINT_CELEBRATION_PROPERTY": "Celebration Rank",
                "NOTION_SAINT_PRECEDENCE_PROPERTY": "Precedence",
                "NOTION_SAINT_BACKGROUND_PROPERTY": "Background",
            }
        ):
            with patch.object(self.mod, "notion_get_database", return_value=database), patch.object(
                self.mod, "notion_get_all_pages", return_value=[page]
            ), patch.object(self.mod, "notion_create_page") as create_mock, patch.object(
                self.mod, "notion_update_page_properties"
            ) as update_mock:
                mode = self.mod.sync_saint_radar(
                    notion_token="token",
                    default_parent_database_id="parent_db",
                    default_parent_page_id="",
                    saints=saints,
                    openai_key="",
                    oai_base_url="https://api.openai.com/v1",
                    oai_model="gpt-4.1-mini",
                )

        self.assertEqual(mode, "existing:db_1:upserted=1:regenerated=0:refresh_all=false")
        update_mock.assert_not_called()
        create_mock.assert_called_once()
        created_db_id = create_mock.call_args.args[0]
        self.assertEqual(created_db_id, "db_1")
        created_props = create_mock.call_args.args[1]
        self.assertEqual(created_props["Name"]["title"][0]["text"]["content"], "Saint Leo the Great, Pope and Doctor of the Church")
        self.assertEqual(created_props["Feast Day"]["date"]["start"], "2027-11-10")

    def test_collect_saints_window_uses_rank_based_contract(self):
        start = datetime.date(2026, 3, 3)
        day_data = {
            0: [
                {"name": "Saint Agnes", "rank_name": "memorial", "precedence": "Precedence.general_memorial_10"},
                {"name": "Tuesday of Lent", "rank_name": "weekday", "precedence": "Precedence.ferial_day_13"},
            ],
            1: [
                {"name": "The Presentation of the Lord", "rank_name": "feast", "precedence": "Precedence.general_lord_feast_5"},
                {"name": "Wednesday of Lent", "rank_name": "weekday", "precedence": "Precedence.ferial_day_13"},
            ],
        }

        def fake_fetch(_cal, _loc, dt):
            offset = (dt - start).days
            return day_data.get(offset, [])

        with patch.object(self.mod, "romcal_fetch_day", side_effect=fake_fetch):
            saints = self.mod.collect_saints_window("general_roman", "en", start, 2)

        names = [row["name"] for row in saints]
        self.assertIn("Saint Agnes", names)
        self.assertIn("The Presentation of the Lord", names)
        self.assertNotIn("Tuesday of Lent", names)
        self.assertNotIn("Wednesday of Lent", names)

    def test_collect_saints_window_excludes_non_eligible_weekday(self):
        start = datetime.date(2026, 3, 3)

        def fake_fetch(_cal, _loc, _dt):
            return [{"name": "Tuesday of Lent", "rank_name": "weekday", "precedence": "Precedence.ferial_day_13"}]

        with patch.object(self.mod, "romcal_fetch_day", side_effect=fake_fetch):
            saints = self.mod.collect_saints_window("general_roman", "en", start, 0)
        self.assertEqual(saints, [])

    def test_collect_saints_window_excludes_easter_octave_by_precedence(self):
        start = datetime.date(2026, 4, 6)

        def fake_fetch(_cal, _loc, _dt):
            return [
                {
                    "name": "Monday within the Octave of Easter",
                    "rank_name": "solemnity",
                    "precedence": "Precedence.weekday_of_easter_octave_2",
                }
            ]

        with patch.object(self.mod, "romcal_fetch_day", side_effect=fake_fetch):
            saints = self.mod.collect_saints_window("general_roman", "en", start, 0)

        self.assertEqual(saints, [])

    def test_collect_saints_window_accepts_non_saint_solemnity(self):
        start = datetime.date(2026, 3, 29)

        def fake_fetch(_cal, _loc, _dt):
            return [
                {
                    "name": "Palm Sunday of the Passion of the Lord",
                    "rank_name": "solemnity",
                    "precedence": "Precedence.privileged_sunday_2",
                }
            ]

        with patch.object(self.mod, "romcal_fetch_day", side_effect=fake_fetch):
            saints = self.mod.collect_saints_window("general_roman", "en", start, 0)

        self.assertEqual(len(saints), 1)
        self.assertEqual(saints[0]["name"], "Palm Sunday of the Passion of the Lord")
        self.assertEqual(saints[0]["entry_kind"], "liturgical_subject")

    def test_cleanup_ineligible_novena_outputs_removes_holy_week_markers(self):
        pages = [
            {
                "id": "page_1",
                "properties": {
                    "Name": _title_prop("Monday of Holy Week"),
                    "Feast Day": {"type": "date", "date": {"start": "2026-03-30"}},
                },
            }
        ]
        celebrations = [
            {
                "date": "2026-03-31",
                "name": "Tuesday of Holy Week",
                "celebration_rank": "weekday",
                "precedence": "Precedence.ferial_day_13",
            }
        ]
        marker = self.mod.saint_day_marker("Tuesday of Holy Week", datetime.date(2026, 3, 30))
        audio_marker = f"{marker}:{self.mod.NOVENA_AUDIO_MARKER}"

        with patch.object(self.mod, "notion_remove_old_autogen_sections_by_markers", return_value=1) as sections_mock, patch.object(
            self.mod, "notion_remove_old_autogen_audio", return_value=1
        ) as audio_mock:
            counts = self.mod.cleanup_ineligible_novena_outputs(
                pages=pages,
                feast_day_property="Feast Day",
                celebrations=celebrations,
                token="token",
            )

        self.assertEqual(counts, {"sections": 1, "audio": 1})
        sections_mock.assert_called_once_with("page_1", "token", [marker])
        audio_mock.assert_called_once_with("page_1", "token", marker=audio_marker)

    def test_build_romcal_wraps_requested_calendar_in_overlay_child(self):
        romcal = self.mod.build_romcal("argentina", "en")

        self.assertEqual(romcal.calendar, "argentina__enhancement_003")

    def test_collect_calendar_days_window_normalizes_special_sundays_and_keeps_regressions(self):
        cases = {
            "2026-01-04": "solemnity",
            "2026-01-18": "Sunday",
            "2026-01-25": "solemnity",
            "2026-03-29": "solemnity",
            "2026-04-05": "solemnity",
            "2026-04-06": "solemnity-easter octave",
            "2026-04-12": "solemnity",
            "2026-05-24": "solemnity",
            "2026-11-22": "solemnity",
            "2026-12-25": "solemnity",
        }

        for ds, expected_rank in cases.items():
            with self.subTest(date=ds):
                rows = self.mod.collect_calendar_days_window(
                    "general_roman",
                    "en",
                    datetime.date.fromisoformat(ds),
                    0,
                )
                self.assertEqual(rows[0]["celebration_rank"], expected_rank)

    def test_infer_celebration_rank_maps_easter_octave_precedence_to_pseudo_rank(self):
        event = {
            "id": "easter_monday",
            "rank_name": "solemnity",
            "precedence": "Precedence.weekday_of_easter_octave_2",
        }

        self.assertEqual(self.mod.infer_celebration_rank(event), "solemnity-easter octave")

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

    def test_notion_call_retries_transient_http_error(self):
        error_response = Mock()
        error_response.status_code = 502
        error_response.headers = {}
        http_error = requests.exceptions.HTTPError("Bad Gateway")
        http_error.response = error_response

        failing_response = Mock()
        failing_response.raise_for_status.side_effect = http_error

        success_response = Mock()
        success_response.raise_for_status.return_value = None
        success_response.json.return_value = {"results": []}

        with patch.object(
            self.mod.requests,
            "request",
            side_effect=[failing_response, success_response],
        ) as request_mock, patch.object(self.mod.time, "sleep") as sleep_mock:
            data = self.mod.notion_call("GET", "https://api.notion.com/v1/pages/page_1", "token")

        self.assertEqual(data, {"results": []})
        self.assertEqual(request_mock.call_count, 2)
        sleep_mock.assert_called_once_with(1.0)

    def test_notion_upload_file_uses_single_part_path_under_limit(self):
        create_response = Mock()
        create_response.raise_for_status.return_value = None
        create_response.json.return_value = {"id": "upload_1"}
        send_response = Mock()
        send_response.raise_for_status.return_value = None

        with patch.object(self.mod.requests, "post", side_effect=[create_response, send_response]) as post_mock:
            upload_id = self.mod.notion_upload_file(
                filename="sample.mp3",
                content_type="audio/mpeg",
                file_bytes=b"a" * 1024,
                token="notion_token",
            )

        self.assertEqual(upload_id, "upload_1")
        self.assertEqual(post_mock.call_count, 2)
        create_call = post_mock.call_args_list[0]
        self.assertEqual(create_call.args[0], "https://api.notion.com/v1/file_uploads")
        self.assertEqual(
            create_call.kwargs["json"],
            {"filename": "sample.mp3", "content_type": "audio/mpeg"},
        )
        send_call = post_mock.call_args_list[1]
        self.assertEqual(send_call.args[0], "https://api.notion.com/v1/file_uploads/upload_1/send")
        self.assertEqual(send_call.kwargs["files"]["file"], ("sample.mp3", b"a" * 1024, "audio/mpeg"))
        self.assertIsNone(send_call.kwargs["data"])

    def test_notion_upload_file_uses_multi_part_path_over_limit(self):
        file_bytes = b"a" * (self.mod.NOTION_FILE_UPLOAD_SINGLE_PART_MAX_BYTES + 1)
        expected_parts = self.mod.notion_split_file_upload_parts(file_bytes)
        create_response = Mock()
        create_response.raise_for_status.return_value = None
        create_response.json.return_value = {"id": "upload_1"}
        send_responses = []
        for _ in expected_parts:
            response = Mock()
            response.raise_for_status.return_value = None
            send_responses.append(response)
        complete_response = Mock()
        complete_response.raise_for_status.return_value = None

        with patch.object(
            self.mod.requests,
            "post",
            side_effect=[create_response, *send_responses, complete_response],
        ) as post_mock:
            upload_id = self.mod.notion_upload_file(
                filename="large.mp3",
                content_type="audio/mpeg",
                file_bytes=file_bytes,
                token="notion_token",
            )

        self.assertEqual(upload_id, "upload_1")
        self.assertEqual(post_mock.call_count, len(expected_parts) + 2)
        create_call = post_mock.call_args_list[0]
        self.assertEqual(
            create_call.kwargs["json"],
            {
                "filename": "large.mp3",
                "content_type": "audio/mpeg",
                "mode": "multi_part",
                "number_of_parts": len(expected_parts),
            },
        )
        for part_index, expected_part in enumerate(expected_parts, start=1):
            send_call = post_mock.call_args_list[part_index]
            self.assertEqual(send_call.args[0], "https://api.notion.com/v1/file_uploads/upload_1/send")
            self.assertEqual(send_call.kwargs["data"], {"part_number": str(part_index)})
            self.assertEqual(
                send_call.kwargs["files"]["file"],
                ("large.mp3", expected_part, "audio/mpeg"),
            )
        complete_call = post_mock.call_args_list[-1]
        self.assertEqual(complete_call.args[0], "https://api.notion.com/v1/file_uploads/upload_1/complete")

    def test_maybe_generate_and_attach_audio_uses_cached_render_hash(self):
        page = {"id": "page_1", "properties": {}}
        env = {
            "NOVENA_AUDIO_ENABLED": "true",
            "NOVENA_AUDIO_MODEL": "gpt-4o-mini-tts",
            "NOVENA_AUDIO_VOICE": "alloy",
            "NOVENA_AUDIO_FORMAT": "mp3",
            "NOVENA_AUDIO_SPEED": "1.0",
        }
        settings = {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}
        saints = [{"date": "2026-03-03", "name": "Saint Agnes"}]
        render_hash = self.mod.compute_daily_novena_audio_render_hash(
            "https://api.openai.com/v1",
            settings,
            saints,
            datetime.date(2026, 3, 3),
            datetime.date(2026, 3, 12),
            "gpt-4.1-mini",
        )
        blocks = [
            {
                "id": "audio_1",
                "type": "audio",
                "audio": {
                    "caption": [
                        {
                            "plain_text": (
                                f"Daily Novena Prayer (Audio) {self.mod.NOVENA_AUDIO_MARKER} "
                                f"{self.mod.render_hash_marker(render_hash)}"
                            )
                        }
                    ]
                },
            }
        ]

        with temp_env(env):
            with patch.object(self.mod, "notion_list_block_children", return_value=blocks), patch.object(
                self.mod, "generate_openai_audio_bytes"
            ) as generate_mock, patch.object(
                self.mod, "notion_remove_old_autogen_audio"
            ) as remove_mock, patch.object(
                self.mod, "notion_create_file_upload"
            ) as create_mock, patch.object(
                self.mod, "notion_send_file_upload"
            ) as send_mock, patch.object(
                self.mod, "notion_append_audio_block"
            ) as append_mock:
                mode = self.mod.maybe_generate_and_attach_audio(
                    page,
                    "Daily prayer text",
                    "notion_token",
                    "openai_key",
                    "https://api.openai.com/v1",
                    "gpt-4.1-mini",
                    saints,
                    datetime.date(2026, 3, 3),
                    datetime.date(2026, 3, 12),
                )

        self.assertEqual(mode, f"cached:mp3:gpt-4o-mini-tts:alloy:hash={render_hash}")
        generate_mock.assert_not_called()
        remove_mock.assert_not_called()
        create_mock.assert_not_called()
        send_mock.assert_not_called()
        append_mock.assert_not_called()

    def test_maybe_generate_and_attach_audio_writes_render_hash_marker(self):
        page = {"id": "page_1", "properties": {}}
        env = {
            "NOVENA_AUDIO_ENABLED": "true",
            "NOVENA_AUDIO_MODEL": "gpt-4o-mini-tts",
            "NOVENA_AUDIO_VOICE": "alloy",
            "NOVENA_AUDIO_FORMAT": "mp3",
            "NOVENA_AUDIO_SPEED": "1.0",
            "NOVENA_AUDIO_CAPTION": "Daily Novena Prayer (Audio)",
        }
        settings = {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}
        saints = [{"date": "2026-03-03", "name": "Saint Agnes"}]
        expected_hash = self.mod.compute_daily_novena_audio_render_hash(
            "https://api.openai.com/v1",
            settings,
            saints,
            datetime.date(2026, 3, 3),
            datetime.date(2026, 3, 12),
            "gpt-4.1-mini",
        )

        with temp_env(env):
            with patch.object(self.mod, "notion_list_block_children", return_value=[]), patch.object(
                self.mod, "generate_openai_audio_bytes", return_value=b"audio-bytes"
            ), patch.object(
                self.mod, "notion_create_file_upload", return_value="upload_1"
            ), patch.object(
                self.mod, "notion_send_file_upload"
            ), patch.object(
                self.mod, "notion_remove_old_autogen_audio"
            ) as remove_mock, patch.object(
                self.mod, "notion_append_audio_block"
            ) as append_mock, patch.object(
                self.mod, "notion_update_audio_render_metadata"
            ) as meta_mock:
                mode = self.mod.maybe_generate_and_attach_audio(
                    page,
                    "Daily prayer text",
                    "notion_token",
                    "openai_key",
                    "https://api.openai.com/v1",
                    "gpt-4.1-mini",
                    saints,
                    datetime.date(2026, 3, 3),
                    datetime.date(2026, 3, 12),
                )

        self.assertEqual(mode, f"attached:mp3:gpt-4o-mini-tts:alloy:hash={expected_hash}")
        remove_mock.assert_called_once_with("page_1", "notion_token")
        append_mock.assert_called_once()
        self.assertIn(self.mod.render_hash_marker(expected_hash), append_mock.call_args.args[2])
        meta_mock.assert_called_once_with(page, expected_hash, "notion_token")

    def test_ensure_saint_devotional_payload_cache_reuses_cached_payload(self):
        payload = {
            "opening_prayer": "Opening prayer.",
            "daily_prayers": [{"day": day_num, "daily_prayer": f"Prayer {day_num}"} for day_num in range(1, 10)],
            "closing_prayer": "Closing prayer.",
        }
        with tempfile.TemporaryDirectory() as tmpdir, temp_env({"NOVENA_AUDIO_LIBRARY_DIR": tmpdir}):
            with patch.object(self.mod, "call_openai_saint_devotional_content", return_value=payload) as call_mock:
                first_payload, first_mode, first_path = self.mod.ensure_saint_devotional_payload_cache(
                    library_root=self.mod.novena_audio_library_dir(),
                    saint_name="Saint Agnes",
                    feast_day="2026-03-12",
                    celebration_type="memorial",
                    api_key="key",
                    base_url="https://api.openai.com/v1",
                    model="gpt-4.1-mini",
                )
                second_payload, second_mode, second_path = self.mod.ensure_saint_devotional_payload_cache(
                    library_root=self.mod.novena_audio_library_dir(),
                    saint_name="Saint Agnes",
                    feast_day="2026-03-12",
                    celebration_type="memorial",
                    api_key="key",
                    base_url="https://api.openai.com/v1",
                    model="gpt-4.1-mini",
                )
                path_exists = first_path.exists()
                call_count = call_mock.call_count

        self.assertEqual(first_mode, "generated")
        self.assertEqual(second_mode, "cached")
        self.assertEqual(first_payload, payload)
        self.assertEqual(second_payload, payload)
        self.assertEqual(first_path, second_path)
        self.assertTrue(path_exists)
        self.assertEqual(call_count, 1)

    def test_ensure_saint_novena_audio_library_reuses_readable_filenames(self):
        payload = {
            "opening_prayer": "Opening prayer.",
            "daily_prayers": [
                {"day": day_num, "theme": f"Theme {day_num}", "intercession": f"Intercession {day_num}", "daily_prayer": f"Prayer {day_num}"}
                for day_num in range(1, 10)
            ],
            "closing_prayer": "Closing prayer.",
        }
        settings = {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}
        with tempfile.TemporaryDirectory() as tmpdir, temp_env({"NOVENA_AUDIO_LIBRARY_DIR": tmpdir}):
            with patch.object(self.mod, "generate_openai_audio_bytes", return_value=b"audio") as generate_mock:
                first = self.mod.ensure_saint_novena_audio_library(
                    saint_name="Saint Agnes",
                    feast_day="2026-03-12",
                    celebration_type="memorial",
                    devotional_payload=payload,
                    settings=settings,
                    api_key="key",
                    base_url="https://api.openai.com/v1",
                    oai_model="gpt-4.1-mini",
                )
                second = self.mod.ensure_saint_novena_audio_library(
                    saint_name="Saint Agnes",
                    feast_day="2026-03-12",
                    celebration_type="memorial",
                    devotional_payload=payload,
                    settings=settings,
                    api_key="key",
                    base_url="https://api.openai.com/v1",
                    oai_model="gpt-4.1-mini",
                )
                audio_exists = first[1]["audio_path"].exists()
                meta_exists = first[1]["meta_path"].exists()
                call_count = generate_mock.call_count

        self.assertEqual(call_count, 9)
        self.assertEqual(first[1]["mode"], "generated")
        self.assertEqual(second[1]["mode"], "cached")
        self.assertTrue(str(first[1]["audio_path"]).endswith("day-01_2026-03-03_saint-agnes.mp3"))
        self.assertTrue(audio_exists)
        self.assertTrue(meta_exists)

    def test_truncate_managed_novena_audio_outputs_clears_stale_library_before_regeneration(self):
        payload = {
            "opening_prayer": "Opening prayer.",
            "daily_prayers": [
                {"day": day_num, "theme": f"Theme {day_num}", "intercession": f"Intercession {day_num}", "daily_prayer": f"Prayer {day_num}"}
                for day_num in range(1, 10)
            ],
            "closing_prayer": "Closing prayer.",
        }
        settings = {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}
        with tempfile.TemporaryDirectory() as tmpdir, temp_env({"NOVENA_AUDIO_LIBRARY_DIR": tmpdir}):
            root = self.mod.novena_audio_library_dir()
            stale_folder = root / "2026-03-12_saint-agnes"
            stale_folder.mkdir(parents=True, exist_ok=True)
            stale_audio = stale_folder / "obsolete.mp3"
            stale_audio.write_bytes(b"stale-audio")
            stale_meta = stale_folder / "obsolete.json"
            stale_meta.write_text("{}", encoding="utf-8")

            removed = self.mod.truncate_managed_novena_audio_outputs(root)

            with patch.object(self.mod, "call_openai_saint_devotional_content", return_value=payload), patch.object(
                self.mod, "generate_openai_audio_bytes", return_value=b"audio"
            ):
                devotional_payload, payload_mode, payload_path = self.mod.ensure_saint_devotional_payload_cache(
                    library_root=root,
                    saint_name="Saint Agnes",
                    feast_day="2026-03-12",
                    celebration_type="memorial",
                    api_key="key",
                    base_url="https://api.openai.com/v1",
                    model="gpt-4.1-mini",
                )
                audio_map = self.mod.ensure_saint_novena_audio_library(
                    saint_name="Saint Agnes",
                    feast_day="2026-03-12",
                    celebration_type="memorial",
                    devotional_payload=devotional_payload,
                    settings=settings,
                    api_key="key",
                    base_url="https://api.openai.com/v1",
                    oai_model="gpt-4.1-mini",
                )

            self.assertGreaterEqual(removed, 2)
            self.assertEqual(payload_mode, "generated")
            self.assertTrue(payload_path.exists())
            self.assertFalse(stale_audio.exists())
            self.assertFalse(stale_meta.exists())
            self.assertTrue(audio_map[1]["audio_path"].exists())
            self.assertTrue(audio_map[1]["meta_path"].exists())
            self.assertTrue((root / "2026-03-12_saint-agnes").exists())

        self.assertFalse(stale_audio.exists())
        self.assertFalse(stale_meta.exists())

    def test_main_truncates_managed_novena_audio_outputs_before_regeneration(self):
        env = {
            "OPENAI_API_KEY": "key",
            "NOTION_TOKEN": "notion_token",
            "NOTION_DATABASE_ID": "db_1",
            "NOTION_SAINT_DATABASE_ID": "db_1",
            "NOTION_NOVENA_ROW_TITLE": "Daily Novenas from Liturgical Calendar",
            "NOTION_WRITE_DAILY_NOVENA_PAGE": "false",
            "NOTION_SAINT_RADAR_ENABLED": "true",
            "NOVENA_AUDIO_ENABLED": "true",
            "USCCB_READINGS_ENABLED": "false",
        }
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Daily Novenas from Liturgical Calendar"),
            },
        }
        saints = [{"date": "2026-03-12", "name": "Saint Agnes"}]
        devotional_payload = {
            "opening_prayer": "Opening prayer.",
            "daily_prayers": [{"day": day_num, "daily_prayer": f"Prayer {day_num}"} for day_num in range(1, 10)],
            "closing_prayer": "Closing prayer.",
        }
        audio_map = {
            1: {
                "mode": "generated",
                "render_hash": "render_hash_1",
                "audio_text": "Prayer 1",
                "audio_path": Path("audio.mp3"),
                "meta_path": Path("audio.json"),
                "target_day": datetime.date(2026, 3, 3),
            }
        }

        with tempfile.TemporaryDirectory() as tmpdir, temp_env({**env, "NOVENA_AUDIO_LIBRARY_DIR": tmpdir}):
            stale_root = Path(tmpdir)
            stale_folder = stale_root / "2026-03-12_saint-agnes"
            stale_folder.mkdir(parents=True, exist_ok=True)
            stale_file = stale_folder / "obsolete.mp3"
            stale_file.write_bytes(b"stale-audio")
            with ExitStack() as stack:
                stack.enter_context(patch.object(self.mod, "local_today", return_value=datetime.date(2026, 3, 3)))
                stack.enter_context(patch.object(self.mod, "notion_find_database_id", return_value="db_1"))
                stack.enter_context(patch.object(self.mod, "collect_saints_window", return_value=saints))
                stack.enter_context(patch.object(self.mod, "sync_saint_radar", return_value="existing:db_1"))
                stack.enter_context(
                    patch.object(self.mod, "collect_calendar_days_window", return_value=[{"date": "2026-03-03", "name": "Monday"}])
                )
                stack.enter_context(
                    patch.object(self.mod, "build_primary_calendar_titles", return_value={"2026-03-03": "Monday"})
                )
                stack.enter_context(patch.object(self.mod, "notion_get_all_pages", return_value=[page]))
                stack.enter_context(patch.object(self.mod, "find_target_notion_page", return_value=page))
                stack.enter_context(patch.object(self.mod, "find_calendar_page_for_date", return_value=page))
                stack.enter_context(patch.object(self.mod, "notion_has_autogen_section_marker", return_value=False))
                stack.enter_context(patch.object(self.mod, "notion_remove_autogen_markers_from_other_pages_for_day"))
                stack.enter_context(patch.object(self.mod, "notion_remove_old_autogen_sections_by_markers"))
                stack.enter_context(patch.object(self.mod, "notion_append_children"))
                stack.enter_context(patch.object(self.mod, "notion_get_autogen_audio_render_hash", return_value="render_hash_1"))
                stack.enter_context(patch.object(self.mod, "notion_append_audio_block"))
                stack.enter_context(patch.object(self.mod, "notion_update_audio_render_metadata"))
                stack.enter_context(patch.object(self.mod, "mirror_calendar_page_to_novena_page", return_value="mirrored_novena:0"))
                stack.enter_context(
                    patch.object(
                        self.mod,
                        "ensure_saint_devotional_payload_cache",
                        return_value=(devotional_payload, "generated", Path(tmpdir) / "payload.json"),
                    )
                )
                stack.enter_context(patch.object(self.mod, "ensure_saint_novena_audio_library", return_value=audio_map))
                truncate_mock = stack.enter_context(
                    patch.object(
                        self.mod,
                        "truncate_managed_novena_audio_outputs",
                        wraps=self.mod.truncate_managed_novena_audio_outputs,
                    )
                )
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        truncate_mock.assert_called_once()
        self.assertFalse(stale_file.exists())

    def test_saint_novena_day_audio_fragments_keeps_configured_intercession(self):
        fragments = self.mod.saint_novena_day_audio_fragments(
            day_num=4,
            opening="Opening prayer.",
            closing="Closing prayer.",
            theme="Perseverance",
            intercession="Saint Agnes, pray for us.",
            daily_prayer="Lord, strengthen us through Saint Agnes's intercession. Amen.",
        )

        self.assertEqual(
            [row["key"] for row in fragments],
            ["day_intro", "theme", "intercession", "opening_prayer", "daily_prayer", "closing_prayer"],
        )
        self.assertTrue(any("Intercession:" in row["text"] for row in fragments))

    def test_saint_novena_day_audio_fragments_strips_exact_duplicate_intercession_from_prayer(self):
        fragments = self.mod.saint_novena_day_audio_fragments(
            day_num=2,
            opening="Opening prayer.",
            closing="Closing prayer.",
            theme="Hope",
            intercession="Saint Agnes, pray that we remain steadfast.",
            daily_prayer="Saint Agnes, pray that we remain steadfast. Lord, deepen our hope and fidelity. Amen.",
        )

        self.assertEqual(fragments[2]["key"], "intercession")
        self.assertEqual(fragments[4]["key"], "daily_prayer")
        self.assertEqual(fragments[4]["text"], "Lord, deepen our hope and fidelity. Amen.")

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
