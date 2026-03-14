import datetime
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tests.test_helpers import load_module, temp_env


def _title_prop(text):
    return {"type": "title", "title": [{"plain_text": text}]}


def _rich_text_prop(text):
    return {"type": "rich_text", "rich_text": [{"plain_text": text}]}


def _checkbox_prop(value):
    return {"type": "checkbox", "checkbox": bool(value)}


def _date_prop(start, end=""):
    payload = {"start": start}
    if end:
        payload["end"] = end
    return {"type": "date", "date": payload}


class TestPageAudioJob(unittest.TestCase):
    def setUp(self):
        self.mod = load_module("jobs/notion/generate_page_audio.py")
        self.mod._RSS_FEED_ENTRIES_CACHE.clear()
        self.mod._PAGE_AUDIO_BLOCKS_CACHE.clear()
        self.mod._AUXILIUM_SECTIONS_CACHE.clear()

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

    def test_divine_office_title_date_supports_sing_the_hours_numeric_format(self):
        parsed = self.mod.divine_office_title_date(
            "3.14.26 Lauds, Saturday Morning Prayer of the Liturgy of the Hours",
            2026,
        )
        self.assertEqual(parsed, datetime.date(2026, 3, 14))

    def test_fetch_rss_feed_entry_matches_day_of_year(self):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Day 73: Inheritance of Land (2026)</title>
      <link>https://example.com/day-73</link>
      <enclosure url="https://example.com/day-73.mp3" type="audio/mpeg" />
      <description><![CDATA[<p>Day 73 text.</p>]]></description>
    </item>
    <item>
      <title>Day 72: The Plains of Moab (2026)</title>
      <link>https://example.com/day-72</link>
      <enclosure url="https://example.com/day-72.mp3" type="audio/mpeg" />
      <description><![CDATA[<p>Day 72 text.</p>]]></description>
    </item>
  </channel>
</rss>"""

        class FakeResponse:
            def __init__(self, content):
                self.content = content.encode("utf-8")

        with patch.object(self.mod, "page_audio_http_get", return_value=FakeResponse(xml)):
            entry = self.mod.fetch_rss_feed_entry(
                datetime.date(2026, 3, 14),
                feed_url="https://example.com/feed.xml",
                match_strategy="day_of_year",
            )

        self.assertEqual(entry["title"], "Day 73: Inheritance of Land (2026)")
        self.assertEqual(entry["audio_url"], "https://example.com/day-73.mp3")

    def test_fetch_rss_feed_entry_matches_month_day_titles(self):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>3/14 - Matilda of Saxony</title>
      <link>https://example.com/saint-314</link>
      <enclosure url="https://example.com/saint-314.mp3" type="audio/mpeg" />
      <description><![CDATA[<p>Matilda text.</p>]]></description>
    </item>
    <item>
      <title>3/13 - St. Euhrasipa</title>
      <link>https://example.com/saint-313</link>
      <enclosure url="https://example.com/saint-313.mp3" type="audio/mpeg" />
      <description><![CDATA[<p>Euhrasipa text.</p>]]></description>
    </item>
  </channel>
</rss>"""

        class FakeResponse:
            def __init__(self, content):
                self.content = content.encode("utf-8")

        with patch.object(self.mod, "page_audio_http_get", return_value=FakeResponse(xml)):
            entry = self.mod.fetch_rss_feed_entry(
                datetime.date(2026, 3, 14),
                feed_url="https://example.com/feed.xml",
                match_strategy="month_day",
            )

        self.assertEqual(entry["title"], "3/14 - Matilda of Saxony")
        self.assertEqual(entry["audio_url"], "https://example.com/saint-314.mp3")

    def test_fetch_rss_feed_entry_matches_weekday_map(self):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>The Joyful Mysteries (Monday + Saturday)</title>
      <link>https://example.com/joyful</link>
      <enclosure url="https://example.com/joyful.mp3" type="audio/mpeg" />
    </item>
    <item>
      <title>The Sorrowful Mysteries (Tuesday + Friday)</title>
      <link>https://example.com/sorrowful</link>
      <enclosure url="https://example.com/sorrowful.mp3" type="audio/mpeg" />
    </item>
  </channel>
</rss>"""

        class FakeResponse:
            def __init__(self, content):
                self.content = content.encode("utf-8")

        with patch.object(self.mod, "page_audio_http_get", return_value=FakeResponse(xml)):
            entry = self.mod.fetch_rss_feed_entry(
                datetime.date(2026, 3, 13),
                feed_url="https://example.com/feed.xml",
                match_strategy="weekday_map",
                match_map={"friday": "The Sorrowful Mysteries"},
            )

        self.assertEqual(entry["title"], "The Sorrowful Mysteries (Tuesday + Friday)")

    def test_fetch_rss_feed_entry_matches_fixed_title(self):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>The Angelus Prayer</title>
      <link>https://example.com/angelus</link>
      <enclosure url="https://example.com/angelus.mp3" type="audio/mpeg" />
    </item>
  </channel>
</rss>"""

        class FakeResponse:
            def __init__(self, content):
                self.content = content.encode("utf-8")

        with patch.object(self.mod, "page_audio_http_get", return_value=FakeResponse(xml)):
            entry = self.mod.fetch_rss_feed_entry(
                datetime.date(2026, 3, 14),
                feed_url="https://example.com/feed.xml",
                match_strategy="fixed_title",
                match_text="The Angelus Prayer",
            )

        self.assertEqual(entry["audio_url"], "https://example.com/angelus.mp3")

    def test_fetch_rss_feed_entry_reuses_cached_feed_parse(self):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Angelus Podcast - Saturday</title>
      <link>https://example.com/angelus-sat</link>
      <enclosure url="https://example.com/angelus-sat.mp3" type="audio/mpeg" />
    </item>
    <item>
      <title>Angelus Podcast - Sunday</title>
      <link>https://example.com/angelus-sun</link>
      <enclosure url="https://example.com/angelus-sun.mp3" type="audio/mpeg" />
    </item>
  </channel>
</rss>"""

        class FakeResponse:
            def __init__(self, content):
                self.content = content.encode("utf-8")

        with patch.object(self.mod, "page_audio_http_get", return_value=FakeResponse(xml)) as http_mock:
            first = self.mod.fetch_rss_feed_entry(
                datetime.date(2026, 3, 14),
                feed_url="https://example.com/angelus.xml",
                match_strategy="fixed_title",
                match_text="Saturday",
            )
            second = self.mod.fetch_rss_feed_entry(
                datetime.date(2026, 3, 14),
                feed_url="https://example.com/angelus.xml",
                match_strategy="fixed_title",
                match_text="Sunday",
            )

        self.assertEqual(http_mock.call_count, 1)
        self.assertEqual(first["audio_url"], "https://example.com/angelus-sat.mp3")
        self.assertEqual(second["audio_url"], "https://example.com/angelus-sun.mp3")

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
                "content_html": "<p>Lord, open my lips.</p><p>And my mouth will proclaim your praise.</p>",
                "date": "2026-03-14",
            },
        ):
            plan = self.mod.build_divine_office_invitatory_plan(page, config, "https://api.openai.com/v1")

        self.assertEqual([fragment.kind for fragment in plan.fragments], ["tts", "source_audio"])
        self.assertIn("For today's intention:", plan.fragments[0].text)
        self.assertIn("For peace in my family.", plan.fragments[0].text)
        self.assertEqual(plan.fragments[1].source_url, "https://example.com/invitatory.mp3")
        self.assertEqual(plan.text_property, "Description")
        self.assertEqual(plan.text_target, "page_content")
        self.assertEqual([block["type"] for block in plan.content_blocks], ["toggle"])

    def test_build_page_intention_fragment_reuses_cached_audio(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Divine Office Invitatory"),
                "Intention": _rich_text_prop("For peace in my family."),
            },
        }
        settings = {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}
        with tempfile.TemporaryDirectory() as tmp_dir:
            with temp_env({"PAGE_AUDIO_CACHE_DIR": tmp_dir}):
                first = self.mod.build_page_intention_fragment(
                    page,
                    settings=settings,
                    base_url="https://api.openai.com/v1",
                    intention_property="Intention",
                    intention_prefix="For today's intention:",
                )
                self.assertIsNotNone(first)
                audio_path, meta_path = self.mod.page_audio_library_fragment_paths(
                    self.mod.page_audio_cache_dir(),
                    "daily_intentions",
                    "Divine Office Invitatory",
                    "mp3",
                )
                audio_path.write_bytes(b"existing")
                meta_path.write_text(
                    json.dumps(
                        {
                            "hash_value": first.hash_value,
                            "text": first.text,
                            "fragment_key": "Divine Office Invitatory",
                            "collection": "daily_intentions",
                        }
                    ),
                    encoding="utf-8",
                )
                second = self.mod.build_page_intention_fragment(
                    page,
                    settings=settings,
                    base_url="https://api.openai.com/v1",
                    intention_property="Intention",
                    intention_prefix="For today's intention:",
                )

        self.assertEqual(first.kind, "tts")
        self.assertEqual(second.kind, "source_audio")
        self.assertTrue(second.cache_path.endswith(".mp3"))

    def test_build_divine_office_morning_text_plan_uses_page_content(self):
        config = {"builder": "divine_office_morning_text_v1"}

        with patch.object(
            self.mod,
            "fetch_divine_office_feed_entry",
            return_value={
                "title": "Mar 14, Morning Prayer for Saturday of the 3rd week of Lent",
                "content_html": "<p>God, come to my assistance.</p><p>Lord, make haste to help me.</p>",
            },
        ):
            plan = self.mod.build_divine_office_morning_text_plan(config)

        self.assertEqual(plan.fragments, [])
        self.assertEqual(plan.text_target, "page_content")
        self.assertEqual([block["type"] for block in plan.content_blocks], ["toggle"])

    def test_apply_page_text_plan_syncs_text_only_builder(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Night Prayer (Optional)")}}
        plan = self.mod.PageAudioPlan(
            fragments=[],
            text_target="page_content",
            content_blocks=[
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {"rich_text": [{"type": "text", "text": {"content": "Night prayer text."}}]},
                }
            ],
        )

        with patch.object(self.mod, "sync_page_content_blocks", return_value=True) as sync_mock:
            mode = self.mod.apply_page_text_plan(page, plan, "token")

        self.assertEqual(mode, "text_updated")
        sync_mock.assert_called_once()

    def test_parse_monthly_intention_section_builds_spoken_text(self):
        parsed = self.mod.parse_monthly_intention_section(
            "MARCH",
            "For disarmament and peace. Let us pray that nations move toward dialogue instead of violence.",
        )

        self.assertEqual(parsed["month"], "March")
        self.assertEqual(parsed["title"], "For disarmament and peace")
        self.assertIn("For the Holy Father's monthly intention:", parsed["spoken_text"])
        self.assertIn("that nations move toward dialogue instead of violence.", parsed["spoken_text"])

    def test_desired_block_signature_reads_text_content_when_plain_text_missing(self):
        blocks = [
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [
                        {"type": "text", "text": {"content": "Ribbon Placement:"}},
                        {"type": "text", "text": {"content": " Invitatory"}},
                    ]
                },
            }
        ]

        self.assertEqual(
            self.mod.desired_block_signature(blocks),
            [("paragraph", "Ribbon Placement: Invitatory", tuple())],
        )

    def test_divine_office_content_blocks_builds_toggles(self):
        html = (
            "<p><span style=\"color: #ff0000;\">Ribbon Placement:</span><br />"
            "Liturgy of the Hours Vol. II:<br />Antiphon: 1043</p>"
            "<p>Lord, open my lips.<br />And my mouth will proclaim your praise.</p>"
            "<p><span style=\"color: #ff0000;\">HYMN</span></p>"
            "<p>O God, come to my assistance.</p>"
            "<p><span style=\"color: #ff0000;\">Psalm 24</span></p>"
            "<p>The Lord's is the earth and its fullness.</p>"
        )

        blocks = self.mod.divine_office_content_blocks_from_html(html)

        self.assertEqual([block["type"] for block in blocks], ["toggle", "toggle", "toggle", "toggle"])
        self.assertEqual(blocks[0]["toggle"]["rich_text"][0]["text"]["content"], "Ribbon Placement")
        self.assertEqual(blocks[1]["toggle"]["rich_text"][0]["text"]["content"], "Opening")
        self.assertEqual(blocks[2]["toggle"]["rich_text"][0]["text"]["content"], "Hymn")
        self.assertEqual(blocks[3]["toggle"]["rich_text"][0]["text"]["content"], "Psalm 24")

    def test_extract_auxilium_sections_from_pdf_text(self):
        text = (
            "Daily Prayers Offered for the Members of the Auxilium Christianorum\n"
            "Prayers to be said every day:\n"
            "V. Our help is in the name of the Lord.\n"
            "R. Who made heaven and earth.\n"
            "Most gracious Virgin Mary,\n"
            "protect us from the vengeance of the evil one. Amen.\n"
            "On Fridays:\n"
            "Litany of Humility\n"
            "O Jesus, meek and humble of heart, hear me.\n"
            "From the desire of being esteemed, deliver me, Jesus.\n"
            "On Saturdays:\n"
            "O God and Father of our Lord Jesus Christ,\n"
            "help us against Satan. Amen.\n"
            "Conclusion for Every Day\n"
            "August Queen of the Heavens,\n"
            "send thy holy legions. Amen.\n"
        )

        sections = self.mod.extract_auxilium_sections_from_pdf_text(text)

        self.assertEqual(
            sections["Every Day"][:3],
            [
                "V. Our help is in the name of the Lord.",
                "R. Who made heaven and earth.",
                "Most gracious Virgin Mary, protect us from the vengeance of the evil one. Amen.",
            ],
        )
        self.assertEqual(sections["Friday"][0], "Litany of Humility")
        self.assertEqual(sections["Friday"][1], "O Jesus, meek and humble of heart, hear me.")
        self.assertEqual(sections["Saturday"][0], "O God and Father of our Lord Jesus Christ, help us against Satan. Amen.")
        self.assertEqual(sections["Conclusion"][0], "August Queen of the Heavens, send thy holy legions. Amen.")

    def test_build_auxilium_daily_text_plan_uses_today_section(self):
        config = {
            "builder": "auxilium_daily_text_v1",
            "rss_feed_url": "https://example.com/auxilium.pdf",
        }
        fake_sections = {
            "Every Day": ["Daily prayer."],
            "Saturday": ["Saturday prayer."],
            "Conclusion": ["Daily conclusion."],
        }

        with patch.object(self.mod, "fetch_auxilium_sections", return_value=fake_sections), patch.object(
            self.mod.shared, "local_today", return_value=datetime.date(2026, 3, 14)
        ):
            plan = self.mod.build_auxilium_daily_text_plan(config)

        self.assertEqual(plan.text_target, "page_content")
        self.assertEqual([block["toggle"]["rich_text"][0]["text"]["content"] for block in plan.content_blocks], ["Every Day", "Saturday", "Conclusion"])

    def test_auxilium_sections_from_fragment_map(self):
        fragment_map = {
            "auxilium-every-day": {"text": "V. Our help is in the name of the Lord.\nR. Who made heaven and earth."},
            "auxilium-saturday": {"text": "O God and Father of our Lord Jesus Christ,\nhelp us against Satan. Amen."},
            "auxilium-conclusion": {"text": "August Queen of the Heavens,\nsend thy holy legions. Amen."},
        }

        sections = self.mod.auxilium_sections_from_fragment_map(fragment_map)

        self.assertEqual(sections["Every Day"], ["V. Our help is in the name of the Lord.", "R. Who made heaven and earth."])
        self.assertEqual(sections["Saturday"], ["O God and Father of our Lord Jesus Christ, help us against Satan. Amen."])
        self.assertEqual(sections["Conclusion"], ["August Queen of the Heavens, send thy holy legions. Amen."])

    def test_auxilium_daily_content_blocks_prefers_audio_fragments(self):
        fake_sections = {
            "Every Day": ["Daily prayer."],
            "Saturday": ["Saturday prayer."],
            "Conclusion": ["Daily conclusion."],
        }

        with patch.object(self.mod, "load_audio_fragments_from_notion", return_value={"fragments": {
            "auxilium-every-day": {"text": "Daily prayer."},
            "auxilium-saturday": {"text": "Saturday prayer."},
            "auxilium-conclusion": {"text": "Daily conclusion."},
        }}), patch.object(
            self.mod, "fetch_auxilium_sections"
        ) as pdf_mock:
            blocks = self.mod.auxilium_daily_content_blocks(datetime.date(2026, 3, 14), "https://example.com/auxilium.pdf", notion_token="token")

        pdf_mock.assert_not_called()
        self.assertEqual([block["toggle"]["rich_text"][0]["text"]["content"] for block in blocks], ["Every Day", "Saturday", "Conclusion"])

    def test_choose_rosary_mystery_set_uses_default_common_schedule(self):
        self.assertEqual(self.mod.choose_rosary_mystery_set(datetime.date(2026, 3, 16), ""), "joyful")
        self.assertEqual(self.mod.choose_rosary_mystery_set(datetime.date(2026, 3, 19), ""), "luminous")

    def test_split_rosary_intentions_expands_to_five(self):
        parts = self.mod.split_rosary_intentions("For family.\nFor priests.\nFor peace.")
        self.assertEqual(parts, ["For family.", "For priests.", "For peace.", "For peace.", "For peace."])

    def test_audio_output_config_from_notion_page_supports_rosary_mode(self):
        page = {
            "properties": {
                "Name": _title_prop("Rosary with Intentions"),
                "Output Key": _rich_text_prop("ROSARY_INTENTIONS_OUTPUT"),
                "Output Mode": _rich_text_prop("rosary"),
                "Target Row": _rich_text_prop("Rosary with Intentions"),
                "Weekday Map": _rich_text_prop("{\"Monday\":\"Joyful Mysteries\"}"),
                "Enabled": _checkbox_prop(True),
            }
        }
        parsed = self.mod.audio_output_config_from_notion_page(page, fragments={"rosary-hail-mary": {"text": "Hail Mary"}}, base_configs={})
        self.assertIsNotNone(parsed)
        key, config = parsed
        self.assertEqual(key, "ROSARY_INTENTIONS_OUTPUT")
        self.assertEqual(config["builder"], "rosary_dynamic_v1")
        self.assertEqual(config["weekday_map"], "{\"Monday\":\"Joyful Mysteries\"}")

    def test_load_prayer_intention_petitions_supports_status_property(self):
        pages = [
            {
                "properties": {
                    "Petition": _rich_text_prop("For peace."),
                    "Status": {"type": "status", "status": {"name": "Praying"}},
                    "Frequency": {"type": "number", "number": 5},
                }
            },
            {
                "properties": {
                    "Petition": _rich_text_prop("For a resolved need."),
                    "Status": {"type": "status", "status": {"name": "Resolved"}},
                    "Frequency": {"type": "number", "number": 50},
                }
            },
        ]

        with patch.object(self.mod, "prayer_intentions_database_id", return_value="db_1"), patch.object(
            self.mod.shared, "notion_get_all_pages", return_value=pages
        ), patch.object(
            self.mod.shared, "local_today", return_value=datetime.date(2026, 3, 16)
        ):
            petitions = self.mod.load_prayer_intention_petitions("token", count=5)

        self.assertEqual(petitions, ["For peace."])

    def test_build_rosary_dynamic_plan_reuses_repeated_prayers(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Rosary with Intentions"),
                "Intention": _rich_text_prop("For family.\nFor priests.\nFor peace.\nFor healing.\nFor vocations."),
            },
        }
        fragments_map = {
            "rosary-sign-of-cross": {"key": "rosary-sign-of-cross", "label": "Sign of the Cross", "text": "In the name of the Father.", "collection": "rosary"},
            "rosary-apostles-creed": {"key": "rosary-apostles-creed", "label": "Apostles' Creed", "text": "I believe in God.", "collection": "rosary"},
            "rosary-our-father": {"key": "rosary-our-father", "label": "Our Father", "text": "Our Father.", "collection": "rosary"},
            "rosary-hail-mary": {"key": "rosary-hail-mary", "label": "Hail Mary", "text": "Hail Mary.", "collection": "rosary"},
            "rosary-glory-be": {"key": "rosary-glory-be", "label": "Glory Be", "text": "Glory be.", "collection": "rosary"},
            "rosary-fatima-prayer": {"key": "rosary-fatima-prayer", "label": "Fatima Prayer", "text": "O my Jesus.", "collection": "rosary"},
            "rosary-hail-holy-queen": {"key": "rosary-hail-holy-queen", "label": "Hail Holy Queen", "text": "Hail, Holy Queen.", "collection": "rosary"},
            "rosary-closing-prayer": {"key": "rosary-closing-prayer", "label": "Closing Prayer", "text": "Let us pray.", "collection": "rosary"},
            "rosary-decade-meditation-template": {
                "key": "rosary-decade-meditation-template",
                "label": "Rosary Meditation",
                "prompt": "Tie {intention} to {mystery_title} and {fruit}.",
                "prompt_model": "gpt-4.1-mini",
                "collection": "rosary",
            },
        }
        for idx, title in enumerate(["Annunciation", "Visitation", "Nativity", "Presentation", "Finding in the Temple"], start=1):
            fragments_map[f"rosary-joyful-{idx}"] = {
                "key": f"rosary-joyful-{idx}",
                "label": title,
                "text": title,
                "collection": "rosary",
                "notes": json.dumps({"title": title, "fruit": "Humility"}),
            }
        config = {
            "builder": "rosary_dynamic_v1",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "fragments": fragments_map,
            "weekday_map": "{\"Monday\":\"Joyful Mysteries\"}",
        }

        with patch.object(self.mod.shared, "local_today", return_value=datetime.date(2026, 3, 16)):
            plan = self.mod.build_rosary_dynamic_plan(page=page, config=config, base_url="https://api.openai.com/v1")

        hail_marys = [fragment for fragment in plan.fragments if fragment.fragment_key == "rosary-hail-mary"]
        meditations = [fragment for fragment in plan.fragments if fragment.fragment_key.startswith("rosary-decade-meditation-")]
        self.assertEqual(len(hail_marys), 53)
        self.assertEqual(len(meditations), 5)
        self.assertTrue(all(fragment.kind == "prompt" for fragment in meditations))

    def test_build_rosary_dynamic_plan_prefers_intention_library(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Rosary with Intentions"),
                "Intention": _rich_text_prop("Fallback intention only."),
            },
        }
        fragments_map = {
            "rosary-sign-of-cross": {"key": "rosary-sign-of-cross", "label": "Sign of the Cross", "text": "In the name of the Father.", "collection": "rosary"},
            "rosary-apostles-creed": {"key": "rosary-apostles-creed", "label": "Apostles' Creed", "text": "I believe in God.", "collection": "rosary"},
            "rosary-our-father": {"key": "rosary-our-father", "label": "Our Father", "text": "Our Father.", "collection": "rosary"},
            "rosary-hail-mary": {"key": "rosary-hail-mary", "label": "Hail Mary", "text": "Hail Mary.", "collection": "rosary"},
            "rosary-glory-be": {"key": "rosary-glory-be", "label": "Glory Be", "text": "Glory be.", "collection": "rosary"},
            "rosary-fatima-prayer": {"key": "rosary-fatima-prayer", "label": "Fatima Prayer", "text": "O my Jesus.", "collection": "rosary"},
            "rosary-hail-holy-queen": {"key": "rosary-hail-holy-queen", "label": "Hail Holy Queen", "text": "Hail, Holy Queen.", "collection": "rosary"},
            "rosary-closing-prayer": {"key": "rosary-closing-prayer", "label": "Closing Prayer", "text": "Let us pray.", "collection": "rosary"},
            "rosary-decade-meditation-template": {
                "key": "rosary-decade-meditation-template",
                "label": "Rosary Meditation",
                "prompt": "Tie {intention} to {mystery_title} and {fruit}.",
                "prompt_model": "gpt-4.1-mini",
                "collection": "rosary",
            },
        }
        for idx, title in enumerate(["Annunciation", "Visitation", "Nativity", "Presentation", "Finding in the Temple"], start=1):
            fragments_map[f"rosary-joyful-{idx}"] = {
                "key": f"rosary-joyful-{idx}",
                "label": title,
                "text": title,
                "collection": "rosary",
                "notes": json.dumps({"title": title, "fruit": "Humility"}),
            }
        config = {
            "builder": "rosary_dynamic_v1",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "fragments": fragments_map,
            "weekday_map": "{\"Monday\":\"Joyful Mysteries\"}",
        }

        with patch.object(self.mod.shared, "local_today", return_value=datetime.date(2026, 3, 16)), patch.object(
            self.mod, "load_prayer_intention_petitions", return_value=["Library One", "Library Two", "Library Three", "Library Four", "Library Five"]
        ):
            plan = self.mod.build_rosary_dynamic_plan(page=page, config=config, base_url="https://api.openai.com/v1", notion_token="token")

        meditations = [fragment for fragment in plan.fragments if fragment.fragment_key.startswith("rosary-decade-meditation-")]
        self.assertIn("Library One", meditations[0].prompt)
        self.assertNotIn("Fallback intention only.", meditations[0].prompt)

    def test_build_rss_audio_plan_uses_page_content_for_divine_office_feed(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Evening Prayer"), "Intention": _rich_text_prop("For peace.")}}
        config = {
            "builder": "rss_audio_v1",
            "rss_feed_url": "https://divineoffice.org/feed/",
            "rss_match_strategy": "fixed_title",
            "rss_match_text": "Evening Prayer",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "intention_property": "Intention",
            "intention_prefix": "For today's intention:",
        }

        with patch.object(
            self.mod,
            "fetch_rss_feed_entry",
            return_value={
                "title": "Mar 14, Evening Prayer",
                "audio_url": "https://example.com/evening.mp3",
                "content_html": "<p><span style='color:#ff0000;'>HYMN</span></p><p>Evening hymn.</p>",
                "date": "2026-03-14",
            },
        ):
            plan = self.mod.build_rss_audio_plan(page, config, "https://api.openai.com/v1")

        self.assertEqual(plan.text_target, "page_content")
        self.assertEqual([block["type"] for block in plan.content_blocks], ["toggle"])

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

    def test_build_morning_prayer_fragments_reuses_library_audio_for_stable_section(self):
        page = {
            "id": "page_1",
            "properties": {"Name": _title_prop("Morning Prayer")},
        }
        novena_page = {
            "id": "page_2",
            "properties": {"Name": _title_prop("Daily Novenas from Liturgical Calendar")},
        }
        top_blocks = [
            {"id": "heading_1", "type": "heading_3", "heading_3": {"rich_text": [{"plain_text": "Morning Offering"}]}},
            {"id": "paragraph_1", "type": "paragraph", "paragraph": {"rich_text": [{"plain_text": "Offer my day."}]}},
            {"id": "paragraph_2", "type": "paragraph", "paragraph": {"rich_text": [{"plain_text": "(Daily Novena Fragment)"}]}},
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
            }
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

        with tempfile.TemporaryDirectory() as tmp_dir:
            with temp_env({"PAGE_AUDIO_CACHE_DIR": tmp_dir}):
                cache_root = self.mod.page_audio_cache_dir()
                with patch.object(self.mod.shared, "notion_list_block_children", side_effect=fake_children), patch.object(
                    self.mod, "fetch_monthly_intention", return_value={"title": "For peace", "spoken_text": "For the Holy Father's monthly intention: that peace may grow."}
                ):
                    first_fragments = self.mod.build_morning_prayer_fragments(
                        page=page,
                        pages=[page, novena_page],
                        title_property="Name",
                        config=config,
                        token="token",
                        base_url="https://api.openai.com/v1",
                    )
                audio_path, meta_path = self.mod.page_audio_library_fragment_paths(
                    cache_root, "morning_prayer", "Morning Offering", "mp3"
                )
                audio_path.write_bytes(b"existing")
                meta_path.write_text(json.dumps({"hash_value": first_fragments[0].hash_value}), encoding="utf-8")
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

        self.assertEqual(fragments[0].kind, "source_audio")
        self.assertEqual(Path(fragments[0].cache_path).suffix, ".mp3")
        self.assertEqual(fragments[1].kind, "source_audio")

    def test_ensure_tts_fragment_audio_persists_library_copy(self):
        fragment = self.mod.PageAudioFragment(
            kind="tts",
            label="Morning Offering",
            hash_value="abcd1234abcd1234",
            text="Morning Offering.",
        )
        settings = {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}

        with tempfile.TemporaryDirectory() as tmp_dir:
            with temp_env({"PAGE_AUDIO_CACHE_DIR": tmp_dir}):
                cache_root = self.mod.page_audio_cache_dir()
                audio_path, meta_path = self.mod.page_audio_library_fragment_paths(
                    cache_root, "morning_prayer", "Morning Offering", "mp3"
                )
                fragment.persist_path = str(audio_path)
                fragment.persist_meta_path = str(meta_path)
                with patch.object(self.mod.shared, "generate_openai_audio_bytes", return_value=b"audio-bytes"):
                    out = self.mod.ensure_tts_fragment_audio(
                        fragment,
                        settings,
                        cache_root,
                        "openai-key",
                        "https://api.openai.com/v1",
                    )

                self.assertTrue(Path(out).exists())
                self.assertEqual(audio_path.read_bytes(), b"audio-bytes")
                payload = json.loads(meta_path.read_text(encoding="utf-8"))
                self.assertEqual(payload["hash_value"], "abcd1234abcd1234")
                self.assertEqual(payload["text"], "Morning Offering.")

    def test_load_audio_fragments_from_notion_keeps_only_active_rows(self):
        env = {"NOTION_AUDIO_FRAGMENTS_DATABASE_ID": "fragments_db_1"}
        pages = [
            {
                "id": "frag_1",
                "properties": {
                    "Name": _title_prop("Morning Offering"),
                    "Fragment Key": _rich_text_prop("morning-offering"),
                    "Spoken Text": _rich_text_prop("Morning Offering."),
                    "Enabled": _checkbox_prop(True),
                    "Start Date": _date_prop("2026-03-01"),
                    "End Date": _date_prop("2026-03-31"),
                    "Collection": _rich_text_prop("morning_prayer"),
                },
            },
            {
                "id": "frag_2",
                "properties": {
                    "Name": _title_prop("Old Intention"),
                    "Fragment Key": _rich_text_prop("pope-intention-2026-02"),
                    "Spoken Text": _rich_text_prop("Old text."),
                    "Enabled": _checkbox_prop(True),
                    "Start Date": _date_prop("2026-02-01"),
                    "End Date": _date_prop("2026-02-28"),
                    "Collection": _rich_text_prop("monthly_intention"),
                },
            },
        ]

        with temp_env(env), patch.object(self.mod.shared, "notion_get_all_pages", return_value=pages), patch.object(
            self.mod.shared, "local_today", return_value=datetime.date(2026, 3, 14)
        ):
            payload = self.mod.load_audio_fragments_from_notion("token")

        self.assertEqual(sorted(payload["fragments"].keys()), ["morning-offering"])

    def test_load_audio_fragments_from_notion_supports_prompt_rows(self):
        env = {"NOTION_AUDIO_FRAGMENTS_DATABASE_ID": "fragments_db_1", "OAI_MODEL": "gpt-4.1-mini"}
        pages = [
            {
                "id": "frag_1",
                "properties": {
                    "Name": _title_prop("Daily Exhortation"),
                    "Fragment Key": _rich_text_prop("daily-exhortation"),
                    "Prompt": _rich_text_prop("Write a one-sentence exhortation for {page_title}."),
                    "Prompt Model": _rich_text_prop("gpt-4.1-mini"),
                    "Enabled": _checkbox_prop(True),
                    "Collection": _rich_text_prop("morning_prayer"),
                },
            }
        ]

        with temp_env(env), patch.object(self.mod.shared, "notion_get_all_pages", return_value=pages), patch.object(
            self.mod.shared, "local_today", return_value=datetime.date(2026, 3, 14)
        ):
            payload = self.mod.load_audio_fragments_from_notion("token")

        fragment = payload["fragments"]["daily-exhortation"]
        self.assertEqual(fragment["prompt"], "Write a one-sentence exhortation for {page_title}.")
        self.assertEqual(fragment["prompt_model"], "gpt-4.1-mini")

    def test_build_fragment_output_plan_supports_special_fragments(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Morning Prayer")}}
        novena_page = {
            "id": "page_2",
            "properties": {"Name": _title_prop("Daily Novenas from Liturgical Calendar")},
        }
        novena_blocks = [
            {
                "id": "audio_1",
                "type": "audio",
                "audio": {
                    "type": "file",
                    "file": {"url": "https://example.com/novena_1.mp3"},
                    "caption": [{"plain_text": "Novena One [AUTOGEN_NOVENA_AUDIO_HASH:abc12345] [AUTOGEN_NOVENA_AUDIO]"}],
                },
            }
        ]
        config = {
            "builder": "audio_fragments_v1",
            "audio_caption": "Morning Prayer (Audio)",
            "silence_ms": 450,
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "fragments": {
                "morning-offering": {
                    "key": "morning-offering",
                    "label": "Morning Offering",
                    "text": "Morning Offering.",
                    "collection": "morning_prayer",
                }
            },
            "fragment_sequence": ["morning-offering", "SPECIAL:monthly_intention", "SPECIAL:daily_novena_audio"],
            "daily_novena_page_title": "Daily Novenas from Liturgical Calendar",
        }

        def fake_children(block_id, _token):
            if block_id == "page_2":
                return novena_blocks
            return []

        with tempfile.TemporaryDirectory() as tmp_dir:
            with temp_env({"PAGE_AUDIO_CACHE_DIR": tmp_dir}), patch.object(
                self.mod.shared, "notion_list_block_children", side_effect=fake_children
            ), patch.object(
                self.mod, "fetch_monthly_intention", return_value={"title": "For peace", "month": "March", "spoken_text": "For the Holy Father's monthly intention: for peace."}
            ):
                plan = self.mod.build_fragment_output_plan(
                    page=page,
                    pages=[novena_page],
                    title_property="Name",
                    config=config,
                    token="token",
                    base_url="https://api.openai.com/v1",
                )

        self.assertEqual([fragment.kind for fragment in plan.fragments], ["tts", "tts", "source_audio"])
        self.assertEqual(plan.fragments[0].fragment_key, "morning-offering")
        self.assertEqual(plan.fragments[1].collection, "monthly_intention")
        self.assertEqual(plan.fragments[2].source_url, "https://example.com/novena_1.mp3")

    def test_build_fragment_output_plan_supports_prompt_fragments(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Morning Prayer")}}
        config = {
            "builder": "audio_fragments_v1",
            "audio_caption": "Morning Prayer (Audio)",
            "silence_ms": 450,
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "fragments": {
                "daily-exhortation": {
                    "key": "daily-exhortation",
                    "label": "Daily Exhortation",
                    "prompt": "Write one sentence for {page_title} in {month}.",
                    "prompt_model": "gpt-4.1-mini",
                    "collection": "morning_prayer",
                }
            },
            "fragment_sequence": ["daily-exhortation"],
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            with temp_env({"PAGE_AUDIO_CACHE_DIR": tmp_dir}):
                plan = self.mod.build_fragment_output_plan(
                    page=page,
                    pages=[page],
                    title_property="Name",
                    config=config,
                    token="token",
                    base_url="https://api.openai.com/v1",
                )

        self.assertEqual([fragment.kind for fragment in plan.fragments], ["prompt"])
        self.assertIn("Morning Prayer", plan.fragments[0].prompt)
        self.assertEqual(plan.fragments[0].prompt_model, "gpt-4.1-mini")

    def test_ensure_prompt_fragment_audio_persists_prompt_text_cache(self):
        fragment = self.mod.PageAudioFragment(
            kind="prompt",
            label="Daily Exhortation",
            hash_value="prompt1234abcd5678",
            prompt="Write one sentence.",
            prompt_model="gpt-4.1-mini",
            fragment_key="daily-exhortation",
            collection="morning_prayer",
        )
        settings = {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}

        with tempfile.TemporaryDirectory() as tmp_dir:
            with temp_env({"PAGE_AUDIO_CACHE_DIR": tmp_dir}), patch.object(
                self.mod, "call_openai_fragment_prompt", return_value="Generated exhortation."
            ), patch.object(
                self.mod.shared, "generate_openai_audio_bytes", return_value=b"audio-bytes"
            ):
                out = self.mod.ensure_prompt_fragment_audio(
                    fragment,
                    settings,
                    self.mod.page_audio_cache_dir(),
                    "openai-key",
                    "https://api.openai.com/v1",
                )
                cache_path = self.mod.prompt_text_cache_paths(self.mod.page_audio_cache_dir(), "morning_prayer", "daily-exhortation")
                self.assertTrue(Path(out).exists())
                payload = json.loads(cache_path.read_text(encoding="utf-8"))

        self.assertEqual(payload["text"], "Generated exhortation.")
        self.assertEqual(payload["prompt_model"], "gpt-4.1-mini")

    def test_load_page_audio_config_merges_audio_outputs(self):
        env = {
            "NOTION_PAGE_AUDIO_CONFIG_DATABASE_ID": "page_audio_db_1",
            "NOTION_AUDIO_OUTPUTS_DATABASE_ID": "audio_outputs_db_1",
        }
        config_pages = [
            {
                "id": "cfg_1",
                "properties": {
                    "Name": _title_prop("DIVINE_OFFICE_INVITATORY_PAGE_AUDIO"),
                    "Enabled": _checkbox_prop(True),
                    "Builder": _rich_text_prop("divine_office_invitatory_v1"),
                    "Audio Caption": _rich_text_prop("Invitatory (Audio)"),
                    "TTS Model": _rich_text_prop("gpt-4o-mini-tts"),
                    "TTS Voice": _rich_text_prop("alloy"),
                    "TTS Format": _rich_text_prop("mp3"),
                    "TTS Speed": {"type": "number", "number": 1.0},
                },
            }
        ]
        output_pages = [
            {
                "id": "out_1",
                "properties": {
                    "Name": _title_prop("Morning Prayer"),
                    "Output Key": _rich_text_prop("MORNING_PRAYER_OUTPUT"),
                    "Output Mode": _rich_text_prop("fragments"),
                    "Audio Caption": _rich_text_prop("Morning Prayer (Audio)"),
                    "Fragment Sequence": _rich_text_prop("morning-offering\nSPECIAL:monthly_intention"),
                    "TTS Model": _rich_text_prop("gpt-4o-mini-tts"),
                    "TTS Voice": _rich_text_prop("alloy"),
                    "TTS Format": _rich_text_prop("mp3"),
                    "TTS Speed": {"type": "number", "number": 1.0},
                    "Silence Ms": {"type": "number", "number": 450},
                    "Enabled": _checkbox_prop(True),
                },
            },
            {
                "id": "out_2",
                "properties": {
                    "Name": _title_prop("Divine Office Invitatory"),
                    "Output Key": _rich_text_prop("DIVINE_OFFICE_INVITATORY_OUTPUT"),
                    "Output Mode": _rich_text_prop("config"),
                    "Config Key": _rich_text_prop("DIVINE_OFFICE_INVITATORY_PAGE_AUDIO"),
                    "Audio Caption": _rich_text_prop("Divine Office Invitatory (Audio)"),
                    "Enabled": _checkbox_prop(True),
                },
            }
        ]
        fragments_payload = {
            "fragments": {
                "morning-offering": {
                    "key": "morning-offering",
                    "label": "Morning Offering",
                    "text": "Morning Offering.",
                    "collection": "morning_prayer",
                }
            }
        }

        def fake_get_all_pages(database_id, _token):
            if database_id == "page_audio_db_1":
                return config_pages
            if database_id == "audio_outputs_db_1":
                return output_pages
            raise AssertionError(database_id)

        with temp_env(env), patch.object(self.mod.shared, "notion_get_all_pages", side_effect=fake_get_all_pages), patch.object(
            self.mod, "load_audio_fragments_from_notion", return_value=fragments_payload
        ):
            payload = self.mod.load_page_audio_config("notion_token")

        self.assertIn("DIVINE_OFFICE_INVITATORY_PAGE_AUDIO", payload["configs"])
        self.assertIn("MORNING_PRAYER_OUTPUT", payload["configs"])
        self.assertIn("DIVINE_OFFICE_INVITATORY_OUTPUT", payload["configs"])
        self.assertEqual(payload["configs"]["MORNING_PRAYER_OUTPUT"]["builder"], "audio_fragments_v1")
        self.assertEqual(payload["configs"]["DIVINE_OFFICE_INVITATORY_OUTPUT"]["builder"], "divine_office_invitatory_v1")
        self.assertEqual(payload["configs"]["DIVINE_OFFICE_INVITATORY_OUTPUT"]["source_config_key"], "DIVINE_OFFICE_INVITATORY_PAGE_AUDIO")

    def test_load_page_audio_config_merges_config_outputs_without_fragments(self):
        env = {
            "NOTION_PAGE_AUDIO_CONFIG_DATABASE_ID": "page_audio_db_1",
            "NOTION_AUDIO_OUTPUTS_DATABASE_ID": "audio_outputs_db_1",
        }
        config_pages = [
            {
                "id": "cfg_1",
                "properties": {
                    "Name": _title_prop("SING_THE_HOURS_MORNING_PAGE_AUDIO"),
                    "Enabled": _checkbox_prop(True),
                    "Builder": _rich_text_prop("rss_audio_v1"),
                    "Audio Caption": _rich_text_prop("Morning Prayer - Liturgy of the Hours (Audio)"),
                    "Feed URL": _rich_text_prop("https://feeds.castos.com/x8g54"),
                    "Feed Match Text": _rich_text_prop("Lauds"),
                    "Feed Match Strategy": _rich_text_prop("contains_with_date"),
                    "TTS Model": _rich_text_prop("gpt-4o-mini-tts"),
                    "TTS Voice": _rich_text_prop("alloy"),
                    "TTS Format": _rich_text_prop("mp3"),
                    "TTS Speed": {"type": "number", "number": 1.0},
                },
            }
        ]
        output_pages = [
            {
                "id": "out_1",
                "properties": {
                    "Name": _title_prop("Morning Prayer - Liturgy of the Hours"),
                    "Output Key": _rich_text_prop("SING_THE_HOURS_MORNING_OUTPUT"),
                    "Output Mode": _rich_text_prop("config"),
                    "Config Key": _rich_text_prop("SING_THE_HOURS_MORNING_PAGE_AUDIO"),
                    "Enabled": _checkbox_prop(True),
                },
            }
        ]

        def fake_get_all_pages(database_id, _token):
            if database_id == "page_audio_db_1":
                return config_pages
            if database_id == "audio_outputs_db_1":
                return output_pages
            raise AssertionError(database_id)

        with temp_env(env), patch.object(self.mod.shared, "notion_get_all_pages", side_effect=fake_get_all_pages), patch.object(
            self.mod, "load_audio_fragments_from_notion", return_value={}
        ):
            payload = self.mod.load_page_audio_config("notion_token")

        self.assertIn("SING_THE_HOURS_MORNING_OUTPUT", payload["configs"])
        self.assertEqual(payload["configs"]["SING_THE_HOURS_MORNING_OUTPUT"]["builder"], "rss_audio_v1")
        self.assertEqual(payload["configs"]["SING_THE_HOURS_MORNING_OUTPUT"]["rss_match_strategy"], "contains_with_date")

    def test_render_page_audio_for_config_uses_cached_hash(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Morning Prayer")}}
        config = {
            "builder": "morning_prayer_v1",
            "audio_caption": "Morning Prayer (Audio)",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
        }
        plan = self.mod.PageAudioPlan(
            fragments=[self.mod.PageAudioFragment(kind="tts", label="Morning Offering", hash_value="hash_1", text="Morning Offering.")]
        )
        render_hash = self.mod.compute_page_render_hash("MORNING_PRAYER_PAGE_AUDIO", config, plan.fragments)

        with patch.object(self.mod, "page_audio_current_render_hash", return_value=render_hash
        ), patch.object(
            self.mod, "page_audio_is_positioned_near_top", return_value=True
        ), patch.object(
            self.mod, "page_audio_output_library_is_current", return_value=True
        ), patch.object(self.mod, "build_assembled_audio") as assemble_mock:
            mode = self.mod.render_page_audio_for_config(
                page=page,
                config_key="MORNING_PRAYER_PAGE_AUDIO",
                config=config,
                plan=plan,
                title_property="Name",
                notion_token="token",
                openai_key="openai",
                base_url="https://api.openai.com/v1",
            )

        self.assertEqual(mode, f"cached:mp3:gpt-4o-mini-tts:alloy:hash={render_hash}")
        assemble_mock.assert_not_called()

    def test_render_page_audio_for_config_exports_library_when_missing(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Bible in a Year"),
                "Playlist": _rich_text_prop("Morning"),
            },
        }
        config = {
            "builder": "rss_audio_v1",
            "audio_caption": "Bible in a Year (Audio)",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "output_folder": "Morning",
        }
        plan = self.mod.PageAudioPlan(
            fragments=[self.mod.PageAudioFragment(kind="source_audio", label="Day 73", hash_value="hash_1", source_url="https://example.com/day73.mp3")]
        )
        render_hash = self.mod.compute_page_render_hash("BIBLE_IN_A_YEAR_OUTPUT", config, plan.fragments)

        with tempfile.TemporaryDirectory() as tmp_dir:
            with temp_env({"PAGE_AUDIO_LIBRARY_DIR": tmp_dir}), patch.object(
                self.mod, "page_audio_current_render_hash", return_value=render_hash
            ), patch.object(
                self.mod, "page_audio_is_positioned_near_top", return_value=True
            ), patch.object(
                self.mod, "page_audio_output_library_is_current", return_value=False
            ), patch.object(
                self.mod, "build_assembled_audio", return_value=b"assembled-audio"
            ):
                mode = self.mod.render_page_audio_for_config(
                    page=page,
                    config_key="BIBLE_IN_A_YEAR_OUTPUT",
                    config=config,
                    plan=plan,
                    title_property="Name",
                    notion_token="token",
                    openai_key="openai",
                    base_url="https://api.openai.com/v1",
                )

            audio_path = Path(tmp_dir) / "Morning" / "Bible in a Year.mp3"
            meta_path = Path(tmp_dir) / "Morning" / "Bible in a Year.json"
            self.assertTrue(audio_path.exists())
            self.assertTrue(meta_path.exists())
            payload = json.loads(meta_path.read_text(encoding="utf-8"))

        self.assertEqual(mode, f"cached:mp3:gpt-4o-mini-tts:alloy:hash={render_hash}")
        self.assertEqual(payload["output_folder"], "Morning")
        self.assertEqual(payload["render_hash"], render_hash)

    def test_compute_page_render_hash_ignores_cache_promotion_kind(self):
        config = {
            "builder": "audio_fragments_v1",
            "audio_caption": "Morning Prayer (Audio)",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
        }
        first = [
            self.mod.PageAudioFragment(
                kind="tts",
                label="Morning Offering",
                fragment_key="morning-offering",
                collection="morning_prayer",
                hash_value="hash_1",
                text="Morning Offering.",
            )
        ]
        second = [
            self.mod.PageAudioFragment(
                kind="source_audio",
                label="Morning Offering",
                fragment_key="morning-offering",
                collection="morning_prayer",
                hash_value="hash_1",
                cache_path="C:/tmp/morning.mp3",
            )
        ]

        self.assertEqual(
            self.mod.compute_page_render_hash("MORNING_PRAYER_OUTPUT", config, first),
            self.mod.compute_page_render_hash("MORNING_PRAYER_OUTPUT", config, second),
        )

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
            with patch.object(self.mod.shared, "notion_get_all_pages", return_value=config_pages), patch.object(
                self.mod, "load_audio_fragments_from_notion", return_value={}
            ), patch.object(
                self.mod, "load_audio_outputs_from_notion", return_value={}
            ):
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
                    "Auto Audio Resolver 1": _rich_text_prop("MORNING_PRAYER_PAGE_AUDIO"),
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

        plan = self.mod.PageAudioPlan(
            fragments=[self.mod.PageAudioFragment(kind="tts", label="Morning Offering", hash_value="hash_1", text="Morning Offering.")]
        )
        with temp_env(env):
            with patch.object(self.mod, "load_page_audio_config", return_value={"configs": {"MORNING_PRAYER_PAGE_AUDIO": {"builder": "morning_prayer_v1", "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}}}}), patch.object(
                self.mod.shared, "notion_find_database_id", return_value="db_1"
            ), patch.object(
                self.mod.shared, "notion_get_all_pages", return_value=pages
            ), patch.object(
                self.mod, "build_page_audio_plan", return_value=plan
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
                self.mod, "build_page_audio_plan", return_value=self.mod.PageAudioPlan(
                    fragments=[self.mod.PageAudioFragment(kind="source_audio", label="Invitatory", hash_value="hash_1", source_url="https://example.com/audio.mp3")]
                )
            ), patch.object(
                self.mod, "render_page_audio_for_config", return_value="cached:mp3:gpt-4o-mini-tts:alloy:hash=abcd1234"
            ) as render_mock:
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        render_mock.assert_called_once()

    def test_main_matches_auto_text_rows(self):
        env = {
            "OPENAI_API_KEY": "key",
            "NOTION_TOKEN": "notion_token",
            "NOTION_DATABASE_ID": "db_1",
            "NOTION_AUDIO_PLATFORM_VALUE": "auto-audio,auto-text",
        }
        pages = [
            {
                "id": "page_1",
                "properties": {
                    "Name": _title_prop("Night Prayer (Optional)"),
                    "Platform": _rich_text_prop("Spotify, auto-text"),
                    "Text Resolver": _rich_text_prop("DIVINE_OFFICE_NIGHT_TEXT"),
                    "Enabled": _checkbox_prop(True),
                },
            }
        ]
        config_payload = {
            "configs": {
                "DIVINE_OFFICE_NIGHT_TEXT": {
                    "builder": "divine_office_night_text_v1",
                }
            }
        }

        with temp_env(env):
            with patch.object(self.mod, "load_page_audio_config", return_value=config_payload), patch.object(
                self.mod.shared, "notion_find_database_id", return_value="db_1"
            ), patch.object(
                self.mod.shared, "notion_get_all_pages", return_value=pages
            ), patch.object(
                self.mod, "build_page_audio_plan", return_value=self.mod.PageAudioPlan(fragments=[], text_target="page_content", content_blocks=[])
            ), patch.object(
                self.mod, "apply_page_text_plan", return_value="text_cached"
            ) as text_mock:
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        text_mock.assert_called_once()

    def test_resolve_page_sync_keys_supports_text_and_audio_together(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Morning Prayer - Liturgy of the Hours (Spotify)"),
                "Platform": _rich_text_prop("Spotify, auto-text, auto-audio"),
                "Text Resolver": _rich_text_prop("DIVINE_OFFICE_MORNING_TEXT"),
                "Auto Audio Resolver 1": _rich_text_prop("SING_THE_HOURS_MORNING_PAGE_AUDIO"),
                "Auto Audio Resolver 2": _rich_text_prop("DIVINE_OFFICE_MORNING_PAGE_AUDIO"),
            },
        }
        config_map = {
            "DIVINE_OFFICE_MORNING_TEXT": {"builder": "divine_office_morning_text_v1"},
            "SING_THE_HOURS_MORNING_PAGE_AUDIO": {"builder": "rss_audio_v1"},
            "DIVINE_OFFICE_MORNING_PAGE_AUDIO": {"builder": "rss_audio_v1"},
        }

        text_key, audio_keys = self.mod.resolve_page_sync_keys(
            page,
            config_map,
            text_resolver_property="Text Resolver",
            auto_audio_primary_property="Auto Audio Resolver 1",
            auto_audio_secondary_property="Auto Audio Resolver 2",
            legacy_config_property="Audio Configuration",
            legacy_resolver_property="Spotify Resolver",
            auto_text_enabled=True,
            auto_audio_enabled=True,
        )

        self.assertEqual(text_key, "DIVINE_OFFICE_MORNING_TEXT")
        self.assertEqual(audio_keys, ["SING_THE_HOURS_MORNING_PAGE_AUDIO", "DIVINE_OFFICE_MORNING_PAGE_AUDIO"])

    def test_main_falls_back_to_second_auto_audio_resolver(self):
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
                    "Name": _title_prop("Morning Prayer - Liturgy of the Hours (Spotify)"),
                    "Platform": _rich_text_prop("Spotify, auto-audio"),
                    "Auto Audio Resolver 1": _rich_text_prop("PRIMARY_AUDIO"),
                    "Auto Audio Resolver 2": _rich_text_prop("FALLBACK_AUDIO"),
                    "Enabled": _checkbox_prop(True),
                },
            }
        ]
        config_payload = {
            "configs": {
                "PRIMARY_AUDIO": {"builder": "rss_audio_v1", "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}},
                "FALLBACK_AUDIO": {"builder": "rss_audio_v1", "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}},
            }
        }
        plan = self.mod.PageAudioPlan(
            fragments=[self.mod.PageAudioFragment(kind="source_audio", label="Prayer", hash_value="hash_1", source_url="https://example.com/prayer.mp3")]
        )

        with temp_env(env):
            with patch.object(self.mod, "load_page_audio_config", return_value=config_payload), patch.object(
                self.mod.shared, "notion_find_database_id", return_value="db_1"
            ), patch.object(
                self.mod.shared, "notion_get_all_pages", return_value=pages
            ), patch.object(
                self.mod, "build_page_audio_plan", return_value=plan
            ), patch.object(
                self.mod, "render_page_audio_for_config", side_effect=[RuntimeError("primary failed"), "cached:mp3:gpt-4o-mini-tts:alloy:hash=abcd1234"]
            ) as render_mock:
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        self.assertEqual(render_mock.call_count, 2)


if __name__ == "__main__":
    unittest.main()
