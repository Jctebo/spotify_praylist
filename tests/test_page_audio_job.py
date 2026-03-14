import datetime
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

    def test_fetch_divine_office_feed_entry_ignores_future_entry(self):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <item>
      <title>Mar 15, Invitatory for Sunday of the 4th week of Lent</title>
      <link>https://divineoffice.org/sun</link>
      <enclosure url="https://example.com/sun.mp3" type="audio/mpeg" />
      <content:encoded><![CDATA[<p>Future prayer.</p>]]></content:encoded>
    </item>
    <item>
      <title>Mar 14, Invitatory for Saturday of the 3rd week of Lent</title>
      <link>https://divineoffice.org/sat</link>
      <enclosure url="https://example.com/sat.mp3" type="audio/mpeg" />
      <content:encoded><![CDATA[<p>Lord, open my lips.</p><p>And my mouth will proclaim your praise.</p>]]></content:encoded>
    </item>
  </channel>
</rss>"""

        class FakeResponse:
            def __init__(self, content):
                self.content = content.encode("utf-8")

        with patch.object(self.mod, "page_audio_http_get", return_value=FakeResponse(xml)):
            entry = self.mod.fetch_divine_office_feed_entry(datetime.date(2026, 3, 14))

        self.assertEqual(entry["title"], "Mar 14, Invitatory for Saturday of the 3rd week of Lent")
        self.assertEqual(entry["audio_url"], "https://example.com/sat.mp3")
        self.assertIn("Lord, open my lips.", entry["text"])

    def test_build_divine_office_invitatory_plan_prepends_intention(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Divine Office Invitatory"),
                "Intention": _rich_text_prop("For peace in my family."),
                "Description": _rich_text_prop(""),
            },
        }
        config = {
            "builder": "divine_office_invitatory_v1",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "text_property": "Description",
        }

        with patch.object(
            self.mod,
            "fetch_divine_office_feed_entry",
            return_value={
                "title": "Mar 14, Invitatory for Saturday of the 3rd week of Lent",
                "audio_url": "https://example.com/invitatory.mp3",
                "text": "Lord, open my lips.\n\nAnd my mouth will proclaim your praise.",
                "date": "2026-03-14",
            },
        ):
            plan = self.mod.build_divine_office_invitatory_plan(page, config, "https://api.openai.com/v1")

        self.assertEqual([fragment.kind for fragment in plan.fragments], ["tts", "source_audio"])
        self.assertIn("For today's intention:", plan.fragments[0].text)
        self.assertIn("For peace in my family.", plan.fragments[0].text)
        self.assertEqual(plan.fragments[1].source_url, "https://example.com/invitatory.mp3")
        self.assertEqual(plan.text_property, "Description")
        self.assertIn("Lord, open my lips.", plan.synced_text)

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

    def test_build_morning_prayer_fragments_reads_nested_heading_children(self):
        page = {
            "id": "page_1",
            "properties": {"Name": _title_prop("Morning Prayer")},
        }
        novena_page = {
            "id": "page_2",
            "properties": {"Name": _title_prop("Daily Novenas from Liturgical Calendar")},
        }
        top_blocks = [
            {
                "id": "heading_offering",
                "type": "heading_3",
                "has_children": True,
                "heading_3": {"rich_text": [{"plain_text": "Morning Offering"}]},
            },
            {
                "id": "heading_petitions",
                "type": "heading_3",
                "has_children": True,
                "heading_3": {"rich_text": [{"plain_text": "Petitions"}]},
            },
            {"id": "placeholder_novena", "type": "paragraph", "paragraph": {"rich_text": [{"plain_text": "(Daily Novena Fragment)"}]}},
        ]
        nested_children = {
            "heading_offering": [
                {"id": "p_1", "type": "paragraph", "paragraph": {"rich_text": [{"plain_text": "I offer this day."}]}}
            ],
            "heading_petitions": [
                {"id": "p_2", "type": "paragraph", "paragraph": {"rich_text": [{"plain_text": "I offer these intentions."}]}},
                {"id": "n_1", "type": "numbered_list_item", "numbered_list_item": {"rich_text": [{"plain_text": "(monthly fragment For the Holy Father's monthly intention)"}]}},
            ],
            "page_2": [
                {
                    "id": "audio_1",
                    "type": "audio",
                    "audio": {
                        "type": "file",
                        "file": {"url": "https://example.com/novena_1.mp3"},
                        "caption": [{"plain_text": "Novena One [AUTOGEN_NOVENA_AUDIO_HASH:abc12345] [AUTOGEN_NOVENA_AUDIO]"}],
                    },
                }
            ],
        }

        def fake_children(block_id, _token):
            if block_id == "page_1":
                return top_blocks
            return nested_children.get(block_id, [])

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

        self.assertEqual([fragment.kind for fragment in fragments], ["tts", "tts", "source_audio"])
        self.assertIn("Morning Offering", fragments[0].text)
        self.assertIn("I offer this day.", fragments[0].text)
        self.assertIn("For the Holy Father's monthly intention: that peace may grow.", fragments[1].text)

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
        ), patch.object(
            self.mod, "page_audio_is_positioned_near_top", return_value=True
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

    def test_load_page_audio_config_prefers_notion_database(self):
        env = {
            "NOTION_PAGE_AUDIO_CONFIG_DATABASE_ID": "page_audio_db_1",
        }
        config_pages = [
            {
                "id": "cfg_1",
                "properties": {
                    "Name": _title_prop("MORNING_PRAYER_PAGE_AUDIO"),
                    "Enabled": _checkbox_prop(True),
                    "Builder": _rich_text_prop("morning_prayer_v1"),
                    "Audio Caption": _rich_text_prop("Morning Prayer (Audio)"),
                    "Silence Ms": {"type": "number", "number": 450},
                    "TTS Model": _rich_text_prop("gpt-4o-mini-tts"),
                    "TTS Voice": _rich_text_prop("alloy"),
                    "TTS Format": _rich_text_prop("mp3"),
                    "TTS Speed": {"type": "number", "number": 1.0},
                    "Monthly Intention Provider": _rich_text_prop("popes_prayer_network_pdf"),
                    "Monthly Intention Language": _rich_text_prop("en"),
                    "Daily Novena Page Title": _rich_text_prop("Daily Novenas from Liturgical Calendar"),
                },
            }
        ]

        with temp_env(env):
            with patch.object(self.mod.shared, "notion_get_all_pages", return_value=config_pages):
                payload = self.mod.load_page_audio_config("notion_token")

        config = payload["configs"]["MORNING_PRAYER_PAGE_AUDIO"]
        self.assertEqual(config["builder"], "morning_prayer_v1")
        self.assertEqual(config["audio_caption"], "Morning Prayer (Audio)")
        self.assertEqual(config["tts"]["model"], "gpt-4o-mini-tts")
        self.assertEqual(config["monthly_intention"]["provider"], "popes_prayer_network_pdf")
        self.assertEqual(config["daily_novena_page_title"], "Daily Novenas from Liturgical Calendar")

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

    def test_main_prefers_audio_configuration_property(self):
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
                    "Name": _title_prop("Divine Office Invitatory"),
                    "Platform": _rich_text_prop("Spotify, auto-audio"),
                    "Audio Configuration": _rich_text_prop("DIVINE_OFFICE_INVITATORY_PAGE_AUDIO"),
                    "Spotify Resolver": _rich_text_prop("DO_INVITATORY"),
                    "Enabled": _checkbox_prop(True),
                },
            }
        ]
        config_payload = {
            "configs": {
                "DIVINE_OFFICE_INVITATORY_PAGE_AUDIO": {
                    "builder": "divine_office_invitatory_v1",
                    "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
                }
            }
        }

        with temp_env(env):
            with patch.object(self.mod, "load_page_audio_config", return_value=config_payload), patch.object(
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
