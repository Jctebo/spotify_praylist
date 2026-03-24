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


def _relation_prop(ids):
    return {"type": "relation", "relation": [{"id": value} for value in ids]}


def _number_prop(value):
    return {"type": "number", "number": value}


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

    def test_choose_dated_feed_entry_matches_vespers_alias(self):
        entry = self.mod.choose_dated_feed_entry(
            [
                {
                    "title": "Mar 14, Evening Prayer for Saturday of the 3rd week of Lent",
                    "feed_url": "https://example.com/feed.xml",
                    "entry_date": datetime.date(2026, 3, 14),
                }
            ],
            datetime.date(2026, 3, 14),
            title_filter="Vespers",
        )

        self.assertEqual(entry["title"], "Mar 14, Evening Prayer for Saturday of the 3rd week of Lent")

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

    def test_fetch_rss_feed_entry_uses_item_artwork_over_channel_artwork(self):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:do="http://www.divineoffice.org/iphonemodule/">
  <channel>
    <itunes:image href="https://example.com/channel.jpg" />
    <item>
      <title>Mar 14, Evening Prayer for Saturday of the 3rd week of Lent</title>
      <link>https://example.com/evening</link>
      <enclosure url="https://example.com/evening.mp3" type="audio/mpeg" />
      <do:image>https://example.com/item.png</do:image>
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
                match_text="Evening Prayer",
            )

        self.assertEqual(entry["artwork_url"], "https://example.com/item.png")

    def test_fetch_rss_feed_entry_falls_back_to_channel_artwork(self):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <itunes:image href="https://example.com/channel.jpg" />
    <item>
      <title>3.14.26 Vespers I, Saturday Evening Prayer of the Liturgy of the Hours</title>
      <link>https://example.com/vespers</link>
      <enclosure url="https://example.com/vespers.mp3" type="audio/mpeg" />
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
                match_text="Vespers",
            )

        self.assertEqual(entry["artwork_url"], "https://example.com/channel.jpg")

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

    def test_choose_fixed_title_feed_entry_matches_compline_alias(self):
        entry = self.mod.choose_fixed_title_feed_entry(
            [
                {
                    "title": "Mar 14, Night Prayer for Saturday of the 3rd week of Lent",
                    "feed_url": "https://example.com/feed.xml",
                }
            ],
            "Compline",
        )

        self.assertEqual(entry["title"], "Mar 14, Night Prayer for Saturday of the 3rd week of Lent")

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
            "builder": "rss_audio_v1",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "text_property": "Description",
            "rss_feed_url": "https://divineoffice.org/feed/",
            "rss_match_text": "Invitatory",
            "intention_property": "Intention",
            "intention_prefix": "For today's intention:",
        }

        with patch.object(
            self.mod,
            "fetch_rss_feed_entry",
            return_value={
                "title": "Mar 14, Invitatory for Saturday of the 3rd week of Lent",
                "audio_url": "https://example.com/invitatory.mp3",
                "content_html": "<p>Lord, open my lips.</p><p>And my mouth will proclaim your praise.</p>",
                "date": "2026-03-14",
            },
        ):
            plan = self.mod.build_rss_audio_plan(page, config, "https://api.openai.com/v1")

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
                    "random_intentions",
                    "random-intention",
                    "mp3",
                )
                audio_path.write_bytes(b"existing")
                meta_path.write_text(
                    json.dumps(
                        {
                            "hash_value": first.hash_value,
                            "text": first.text,
                            "fragment_key": "random-intention",
                            "collection": "random_intentions",
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
        self.assertEqual(first.fragment_key, "random-intention")
        self.assertEqual(first.collection, "random_intentions")
        self.assertEqual(first.label, "Random Intention")
        self.assertEqual(second.kind, "source_audio")
        self.assertTrue(second.cache_path.endswith(".mp3"))

    def test_build_divine_office_night_text_plan_uses_page_content(self):
        config = {"builder": "divine_office_night_text_v1"}

        with patch.object(
            self.mod,
            "fetch_divine_office_feed_entry",
            return_value={
                "title": "Mar 14, Night Prayer for Saturday of the 3rd week of Lent",
                "content_html": "<p>God, come to my assistance.</p><p>Lord, make haste to help me.</p>",
            },
        ):
            plan = self.mod.build_divine_office_night_text_plan(config)

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

    def test_apply_page_text_plan_uses_managed_section_mode(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Daily Examen")}}
        plan = self.mod.PageAudioPlan(
            fragments=[],
            text_target="page_content",
            content_blocks=[
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {"rich_text": [{"type": "text", "text": {"content": "Examen text."}}]},
                }
            ],
            page_content_mode=self.mod.PAGE_CONTENT_MODE_MANAGED_SECTION,
            page_content_label="Daily Examen",
        )

        with patch.object(self.mod, "sync_managed_page_content_section", return_value=True) as sync_mock:
            mode = self.mod.apply_page_text_plan(page, plan, "token")

        self.assertEqual(mode, "text_updated")
        sync_mock.assert_called_once()

    def test_sync_managed_page_content_section_preserves_manual_blocks(self):
        existing_blocks = [
            {"id": "audio_1", "type": "audio", "audio": {"caption": [{"plain_text": "Prayer Audio"}]}},
            {
                "id": "managed_1",
                "type": "toggle",
                "has_children": False,
                "toggle": {"rich_text": [{"plain_text": "Prayer Text [AUTOGEN_PRAYER_TEXT_SECTION:page_1]"}]},
            },
            {
                "id": "paragraph_1",
                "type": "paragraph",
                "paragraph": {"rich_text": [{"plain_text": "My manual notes."}]},
            },
        ]
        desired_blocks = [
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {"rich_text": [{"type": "text", "text": {"content": "Updated prayer text."}}]},
            }
        ]

        with patch.object(self.mod.shared, "notion_list_block_children", return_value=existing_blocks), patch.object(
            self.mod.shared, "notion_archive_block"
        ) as archive_mock, patch.object(self.mod.shared, "notion_append_children") as append_mock:
            changed = self.mod.sync_managed_page_content_section(
                "page_1",
                "token",
                label="Daily Examen",
                desired_blocks=desired_blocks,
            )

        self.assertTrue(changed)
        archive_mock.assert_called_once_with("managed_1", "token")
        append_mock.assert_called_once()
        self.assertEqual(append_mock.call_args.kwargs["after"], "audio_1")

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
        self.assertEqual(config["rosary_contract_file"], "config/rosary.json")

    def test_audio_output_config_from_notion_page_supports_fragment_key(self):
        page = {
            "properties": {
                "Name": _title_prop("Morning Prayer"),
                "Output Key": _rich_text_prop("MORNING_PRAYER_OUTPUT"),
                "Output Mode": _rich_text_prop("fragments"),
                "Fragment Key": _rich_text_prop("morning-prayer"),
                "Enabled": _checkbox_prop(True),
            }
        }

        parsed = self.mod.audio_output_config_from_notion_page(
            page,
            fragments={"morning-prayer": {"type": "sequence", "fragment_sequence": ["morning-offering"]}},
            base_configs={"SING_THE_HOURS_MORNING_PAGE_AUDIO": {"builder": "rss_audio_v1"}},
        )

        self.assertIsNotNone(parsed)
        key, config = parsed
        self.assertEqual(key, "MORNING_PRAYER_OUTPUT")
        self.assertEqual(config["builder"], "audio_fragments_v1")
        self.assertEqual(config["fragment_sequence"], ["morning-prayer"])
        self.assertIn("SING_THE_HOURS_MORNING_PAGE_AUDIO", config["config_map"])

    def test_audio_output_config_from_notion_page_normalizes_config_key_to_wrapper_fragment(self):
        page = {
            "properties": {
                "Name": _title_prop("Divine Office Invitatory"),
                "Output Key": _rich_text_prop("DIVINE_OFFICE_INVITATORY_OUTPUT"),
                "Output Mode": _rich_text_prop("config"),
                "Config Key": _rich_text_prop("DIVINE_OFFICE_INVITATORY_PAGE_AUDIO"),
                "Audio Caption": _rich_text_prop("Divine Office Invitatory (Audio)"),
                "Enabled": _checkbox_prop(True),
            }
        }

        parsed = self.mod.audio_output_config_from_notion_page(
            page,
            fragments={},
            base_configs={"DIVINE_OFFICE_INVITATORY_PAGE_AUDIO": {"builder": "rss_audio_v1"}},
        )

        self.assertIsNotNone(parsed)
        key, config = parsed
        wrapper_key = self.mod.synthetic_output_wrapper_fragment_key(
            "DIVINE_OFFICE_INVITATORY_OUTPUT",
            "DIVINE_OFFICE_INVITATORY_PAGE_AUDIO",
        )
        self.assertEqual(key, "DIVINE_OFFICE_INVITATORY_OUTPUT")
        self.assertEqual(config["builder"], "audio_fragments_v1")
        self.assertEqual(config["fragment_sequence"], [wrapper_key])
        self.assertEqual(config["source_config_key"], "DIVINE_OFFICE_INVITATORY_PAGE_AUDIO")
        self.assertEqual(config["legacy_output_mode"], "config")
        self.assertEqual(config["fragments"][wrapper_key]["type"], "config")
        self.assertEqual(config["fragments"][wrapper_key]["source_config_key"], "DIVINE_OFFICE_INVITATORY_PAGE_AUDIO")

    def test_audio_output_config_from_notion_page_accepts_config_key_without_legacy_mode(self):
        page = {
            "properties": {
                "Name": _title_prop("Sing the Hours Morning"),
                "Output Key": _rich_text_prop("SING_THE_HOURS_MORNING_OUTPUT"),
                "Config Key": _rich_text_prop("SING_THE_HOURS_MORNING_PAGE_AUDIO"),
                "Enabled": _checkbox_prop(True),
            }
        }

        parsed = self.mod.audio_output_config_from_notion_page(
            page,
            fragments={},
            base_configs={"SING_THE_HOURS_MORNING_PAGE_AUDIO": {"builder": "rss_audio_v1"}},
        )

        self.assertIsNotNone(parsed)
        key, config = parsed
        self.assertEqual(key, "SING_THE_HOURS_MORNING_OUTPUT")
        self.assertEqual(config["builder"], "audio_fragments_v1")
        self.assertEqual(config["source_config_key"], "SING_THE_HOURS_MORNING_PAGE_AUDIO")

    def test_audio_output_deprecation_messages_cover_legacy_mode_and_special_tokens(self):
        page = {
            "properties": {
                "Name": _title_prop("Morning Prayer"),
            }
        }

        messages = self.mod.audio_output_deprecation_messages(
            page,
            output_key="MORNING_PRAYER_OUTPUT",
            output_mode="config",
            fragment_sequence=["SPECIAL:monthly_intention", "SPECIAL:daily_novena_audio"],
            source_config_key="MORNING_PRAYER_PAGE_AUDIO",
        )

        self.assertEqual(len(messages), 4)
        self.assertTrue(any('deprecated Output Mode "config"' in message for message in messages))
        self.assertTrue(any('deprecated output-level "Config Key"' in message for message in messages))
        self.assertTrue(any('SPECIAL:monthly_intention' in message for message in messages))
        self.assertTrue(any('SPECIAL:daily_novena_audio' in message for message in messages))

    def test_load_prayer_intention_petitions_supports_status_property(self):
        pages = [
            {
                "properties": {
                    "Person Name": _title_prop("Family in the Church"),
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

        self.assertEqual(petitions, ["For peace.", "For peace.", "For peace.", "For peace.", "For peace."])

    def test_load_prayer_intention_entries_returns_short_labels(self):
        pages = [
            {
                "properties": {
                    "Person Name": _title_prop("Family in the Church"),
                    "Prayer Need": _rich_text_prop("All my Family members to return to full participation in the Holy Catholic Church"),
                    "Petition": _rich_text_prop("For all my family members to return to the Church."),
                    "Status": {"type": "status", "status": {"name": "Praying"}},
                    "Frequency": {"type": "number", "number": 5},
                }
            }
        ]

        with patch.object(self.mod, "prayer_intentions_database_id", return_value="db_1"), patch.object(
            self.mod.shared, "notion_get_all_pages", return_value=pages
        ), patch.object(
            self.mod.shared, "local_today", return_value=datetime.date(2026, 3, 16)
        ):
            entries = self.mod.load_prayer_intention_entries("token", count=5)

        self.assertEqual(entries[0]["petition"], "For all my family members to return to the Church.")
        self.assertEqual(entries[0]["label"], "Family in the Church")

    def test_build_rosary_dynamic_plan_reuses_repeated_prayers(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Rosary with Intentions"),
                "Intention": _rich_text_prop("For family.\nFor priests.\nFor peace.\nFor healing.\nFor vocations."),
            },
        }
        config = {
            "builder": "rosary_v1",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "rosary_contract_file": "config/rosary.json",
        }

        with patch.object(self.mod.shared, "local_today", return_value=datetime.date(2026, 3, 16)):
            plan = self.mod.build_rosary_dynamic_plan(page=page, config=config, base_url="https://api.openai.com/v1")

        hail_marys = [fragment for fragment in plan.fragments if fragment.fragment_key == "hail-mary"]
        meditations = [fragment for fragment in plan.fragments if fragment.fragment_key.startswith("rosary-decade-meditation-")]
        self.assertEqual(len(hail_marys), 53)
        self.assertEqual(len(meditations), 5)
        self.assertTrue(all(fragment.fragment_key.startswith("rosary-decade-meditation-") for fragment in meditations))
        self.assertEqual(plan.text_target, "page_content")
        self.assertEqual([block["type"] for block in plan.content_blocks], ["toggle"])
        self.assertEqual(plan.content_blocks[0]["toggle"]["rich_text"][0]["text"]["content"], "Rosary Mysteries")
        self.assertEqual(plan.content_blocks[0]["toggle"]["children"][1]["type"], "numbered_list_item")
        self.assertEqual(
            plan.content_blocks[0]["toggle"]["children"][1]["numbered_list_item"]["rich_text"][0]["text"]["content"],
            "The Annunciation",
        )
        self.assertEqual(
            [child["paragraph"]["rich_text"][0]["text"]["content"] for child in plan.content_blocks[0]["toggle"]["children"][1]["numbered_list_item"]["children"]],
            ["Fruit: Humility", "Intention: For family."],
        )

    def test_build_rosary_dynamic_plan_uses_page_intentions(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Rosary with Intentions"),
                "Intention": _rich_text_prop("For families.\nFor priests.\nFor peace.\nFor healing.\nFor vocations."),
            },
        }
        config = {
            "builder": "rosary_v1",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "rosary_contract_file": "config/rosary.json",
        }

        with patch.object(self.mod.shared, "local_today", return_value=datetime.date(2026, 3, 16)), patch.object(
            self.mod, "load_prayer_intention_entries", side_effect=AssertionError("Rosary should not use Notion intentions")
        ):
            plan = self.mod.build_rosary_dynamic_plan(page=page, config=config, base_url="https://api.openai.com/v1", notion_token="token")

        meditations = [fragment for fragment in plan.fragments if fragment.fragment_key.startswith("rosary-decade-meditation-")]
        self.assertTrue(all(fragment.fragment_key.startswith("rosary-decade-meditation-") for fragment in meditations))
        self.assertEqual(
            [child["paragraph"]["rich_text"][0]["text"]["content"] for child in plan.content_blocks[0]["toggle"]["children"][1]["numbered_list_item"]["children"]],
            ["Fruit: Humility", "Intention: For families."],
        )

    def test_build_rosary_dynamic_plan_uses_contract_flow_counts(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Rosary with Intentions"),
                "Intention": _rich_text_prop("For families.\nFor priests."),
            },
        }
        config = {
            "builder": "rosary_v1",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "rosary_contract_file": "config/rosary.json",
        }

        with patch.object(self.mod.shared, "local_today", return_value=datetime.date(2026, 3, 16)):
            plan = self.mod.build_rosary_dynamic_plan(page=page, config=config, base_url="https://api.openai.com/v1")

        hail_marys = [fragment for fragment in plan.fragments if fragment.fragment_key == "hail-mary"]
        meditations = [fragment for fragment in plan.fragments if fragment.fragment_key.startswith("rosary-decade-meditation-")]
        self.assertEqual(len(hail_marys), 53)
        self.assertEqual(len(meditations), 5)
        self.assertEqual(
            [child["paragraph"]["rich_text"][0]["text"]["content"] for child in plan.content_blocks[0]["toggle"]["children"][1]["numbered_list_item"]["children"]],
            ["Fruit: Humility", "Intention: For families."],
        )

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
                "artwork_url": "https://example.com/evening.jpg",
            },
        ):
            plan = self.mod.build_rss_audio_plan(page, config, "https://api.openai.com/v1")

        self.assertEqual(plan.text_target, "page_content")
        self.assertEqual([block["type"] for block in plan.content_blocks], ["toggle"])
        self.assertEqual(plan.fragments[-1].artwork_url, "https://example.com/evening.jpg")

    def test_build_page_audio_plan_falls_back_to_nested_rss_contract(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Morning Prayer"), "Intention": _rich_text_prop("For peace.")}}
        config = {
            "builder": "rss_audio_v1",
            "audio_caption": "Morning Prayer - Liturgy of the Hours (Audio)",
            "rss_feed_url": "https://feeds.castos.com/x8g54",
            "rss_match_strategy": "contains_with_date",
            "rss_match_text": "Lauds",
            "intention_property": "Intention",
            "intention_prefix": "For today's intention:",
            "resolvers": [
                {
                    "key": "random-intention",
                },
                {
                    "key": "main",
                    "fallback_resolver": {
                        "builder": "rss_audio_v1",
                        "audio_caption": "Morning Prayer - Liturgy of the Hours (Audio)",
                        "rss_feed_url": "https://divineoffice.org/feed/",
                        "rss_match_strategy": "contains_with_date",
                        "rss_match_text": "Morning Prayer",
                        "intention_property": "Intention",
                        "intention_prefix": "For today's intention:",
                    },
                },
            ],
        }

        fallback_entry = {
            "title": "Mar 14, Morning Prayer",
            "audio_url": "https://example.com/morning.mp3",
            "content_html": "<p><span style='color:#ff0000;'>HYMN</span></p><p>Morning hymn.</p>",
            "date": "2026-03-14",
            "artwork_url": "https://example.com/morning.jpg",
        }

        with patch.object(self.mod, "fetch_rss_feed_entry", side_effect=[RuntimeError("primary failed"), fallback_entry]):
            plan = self.mod.build_page_audio_plan(page, [page], "Name", config, "token", "https://api.openai.com/v1")

        self.assertEqual(plan.text_target, "page_content")
        self.assertEqual([block["type"] for block in plan.content_blocks], ["toggle"])
        self.assertEqual(plan.fragments[-1].artwork_url, "https://example.com/morning.jpg")

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

    def test_monthly_intention_fragment_from_notion_prefers_active_row(self):
        env = {"NOTION_AUDIO_FRAGMENTS_DATABASE_ID": "fragments_db_1"}
        pages = [
            {
                "id": "frag_1",
                "properties": {
                    "Name": _title_prop("March Intention"),
                    "Fragment Key": _rich_text_prop("pope-intention-2026-03"),
                    "Spoken Text": _rich_text_prop("March text."),
                    "Enabled": _checkbox_prop(True),
                    "Start Date": _date_prop("2026-03-01"),
                    "End Date": _date_prop("2026-03-31"),
                    "Collection": _rich_text_prop("monthly_intention"),
                },
            },
            {
                "id": "frag_2",
                "properties": {
                    "Name": _title_prop("February Intention"),
                    "Fragment Key": _rich_text_prop("pope-intention-2026-02"),
                    "Spoken Text": _rich_text_prop("February text."),
                    "Enabled": _checkbox_prop(True),
                    "Start Date": _date_prop("2026-02-01"),
                    "End Date": _date_prop("2026-02-28"),
                    "Collection": _rich_text_prop("monthly_intention"),
                },
            },
        ]

        with temp_env(env), patch.object(self.mod.shared, "notion_get_all_pages", return_value=pages):
            fragment = self.mod.monthly_intention_fragment_from_notion("token", target_date=datetime.date(2026, 3, 14))

        self.assertIsNotNone(fragment)
        self.assertEqual(fragment["key"], "pope-intention-2026-03")

    def test_monthly_intention_fragment_from_notion_falls_back_to_latest_row(self):
        env = {"NOTION_AUDIO_FRAGMENTS_DATABASE_ID": "fragments_db_1"}
        pages = [
            {
                "id": "frag_1",
                "properties": {
                    "Name": _title_prop("December Intention"),
                    "Fragment Key": _rich_text_prop("pope-intention-2026-12"),
                    "Spoken Text": _rich_text_prop("December text."),
                    "Enabled": _checkbox_prop(True),
                    "Start Date": _date_prop("2026-12-01"),
                    "End Date": _date_prop("2026-12-31"),
                    "Collection": _rich_text_prop("monthly_intention"),
                },
            },
            {
                "id": "frag_2",
                "properties": {
                    "Name": _title_prop("November Intention"),
                    "Fragment Key": _rich_text_prop("pope-intention-2026-11"),
                    "Spoken Text": _rich_text_prop("November text."),
                    "Enabled": _checkbox_prop(True),
                    "Start Date": _date_prop("2026-11-01"),
                    "End Date": _date_prop("2026-11-30"),
                    "Collection": _rich_text_prop("monthly_intention"),
                },
            },
        ]

        with temp_env(env), patch.object(self.mod.shared, "notion_get_all_pages", return_value=pages):
            fragment = self.mod.monthly_intention_fragment_from_notion("token", target_date=datetime.date(2027, 1, 5))

        self.assertIsNotNone(fragment)
        self.assertEqual(fragment["key"], "pope-intention-2026-12")

    def test_parse_monthly_intention_section_strips_trailing_pdf_footer(self):
        parsed = self.mod.parse_monthly_intention_section(
            "December",
            "For single-parent families Let us pray for families experiencing the absence of a mother or father, that they may find support and accompaniment in the Church, and help and strength in the Faith during difficult times. Francis Vatican, December 31, 2024 Original: Italian",
        )

        self.assertEqual(parsed["title"], "For single-parent families")
        self.assertEqual(
            parsed["spoken_text"],
            "For the Holy Father's monthly intention: for families experiencing the absence of a mother or father, that they may find support and accompaniment in the Church, and help and strength in the Faith during difficult times.",
        )

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

    def test_audio_fragment_from_notion_page_supports_typed_config_wrappers(self):
        page = {
            "properties": {
                "Name": _title_prop("Evening Prayer Wrapper"),
                "Fragment Key": _rich_text_prop("evening-prayer-wrapper"),
                "Fragment Type": _rich_text_prop("config"),
                "Config Key": _rich_text_prop("SING_THE_HOURS_EVENING_PAGE_AUDIO"),
                "Feed Match Text": _rich_text_prop("Vespers"),
                "Intention Prefix": _rich_text_prop("For this intention:"),
                "Enabled": _checkbox_prop(True),
                "Collection": _rich_text_prop("evening_prayer"),
            }
        }

        parsed = self.mod.audio_fragment_from_notion_page(page, target_date=datetime.date(2026, 3, 14))

        self.assertIsNotNone(parsed)
        key, fragment = parsed
        self.assertEqual(key, "evening-prayer-wrapper")
        self.assertEqual(fragment["type"], "config")
        self.assertEqual(fragment["source_config_key"], "SING_THE_HOURS_EVENING_PAGE_AUDIO")
        self.assertEqual(fragment["config"]["rss_match_text"], "Vespers")
        self.assertEqual(fragment["config"]["intention_prefix"], "For this intention:")

    def test_build_fragment_output_plan_supports_special_fragments(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Morning Prayer"), "Order": _number_prop(1.0)}}
        novena_page = {
            "id": "page_2",
            "properties": {"Name": _title_prop("Daily Novenas from Liturgical Calendar")},
        }
        novena_blocks = [
            {
                "id": "toggle_1",
                "type": "toggle",
                "toggle": {"rich_text": [{"plain_text": "Novena - Saint Joseph (Day 6 of 9) [AUTOGEN_NOVENA_DAY:saint-joseph:2026-03-15]"}]},
            },
            {
                "id": "audio_1",
                "type": "audio",
                "audio": {
                    "type": "file",
                    "file": {"url": "https://example.com/novena_1.mp3"},
                    "caption": [{"plain_text": "Novena Audio - Saint Joseph Day 6 [AUTOGEN_NOVENA_AUDIO_HASH:abc12345] [AUTOGEN_NOVENA_DAY:saint-joseph:2026-03-15]:[AUTOGEN_NOVENA_AUDIO]"}],
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

        self.assertEqual([fragment.kind for fragment in plan.fragments], ["tts", "tts", "tts", "source_audio"])
        self.assertEqual(plan.fragments[0].fragment_key, "morning-offering")
        self.assertEqual(plan.fragments[1].collection, "monthly_intention")
        self.assertIn("Novena to Saint Joseph Day 6", plan.fragments[2].text)
        self.assertEqual(plan.fragments[3].source_url, "https://example.com/novena_1.mp3")

    def test_build_fragment_output_plan_supports_typed_random_intention_fragment(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Morning Prayer"),
                "Intention": _rich_text_prop("For peace."),
            },
        }
        config = {
            "builder": "audio_fragments_v1",
            "audio_caption": "Morning Prayer (Audio)",
            "silence_ms": 450,
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "fragments": {
                "random-intention-wrapper": {
                    "key": "random-intention-wrapper",
                    "label": "Random Intention Wrapper",
                    "type": "random_intention",
                    "config": {"intention_prefix": "For today's intention:"},
                }
            },
            "fragment_sequence": ["random-intention-wrapper"],
            "config_map": {},
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

        self.assertEqual([fragment.kind for fragment in plan.fragments], ["tts"])
        self.assertEqual(plan.fragments[0].fragment_key, "random-intention")
        self.assertEqual(plan.fragments[0].collection, "random_intentions")

    def test_build_fragment_output_plan_supports_wrapper_fragments_with_text(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Evening Prayer")}}
        config = {
            "builder": "audio_fragments_v1",
            "audio_caption": "Evening Prayer (Audio)",
            "silence_ms": 450,
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "fragments": {
                "intro": {
                    "key": "intro",
                    "label": "Intro",
                    "text": "Evening Prayer.",
                    "collection": "evening_prayer",
                },
                "evening-text": {
                    "key": "evening-text",
                    "label": "Evening Text",
                    "type": "config",
                    "source_config_key": "DIVINE_OFFICE_NIGHT_TEXT",
                },
                "evening-wrapper": {
                    "key": "evening-wrapper",
                    "label": "Evening Wrapper",
                    "type": "sequence",
                    "fragment_sequence": ["intro", "evening-text"],
                },
            },
            "fragment_sequence": ["evening-wrapper"],
            "config_map": {
                "DIVINE_OFFICE_NIGHT_TEXT": {
                    "builder": "divine_office_night_text_v1",
                }
            },
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            with temp_env({"PAGE_AUDIO_CACHE_DIR": tmp_dir}), patch.object(
                self.mod,
                "fetch_divine_office_feed_entry",
                return_value={"content_html": "<p><span>HYMN</span></p><p>Evening hymn.</p>"},
            ):
                plan = self.mod.build_fragment_output_plan(
                    page=page,
                    pages=[page],
                    title_property="Name",
                    config=config,
                    token="token",
                    base_url="https://api.openai.com/v1",
                )

        self.assertEqual([fragment.label for fragment in plan.fragments], ["Intro"])
        self.assertEqual(plan.text_target, "page_content")
        self.assertEqual([block["type"] for block in plan.content_blocks], ["toggle"])

    def test_normalize_morning_prayer_fragment_key_maps_legacy_aliases(self):
        self.assertEqual(
            self.mod.normalize_morning_prayer_fragment_key({"key": "petition technology", "label": "Petition - Right Use of Technology"}),
            "petition-church",
        )
        self.assertEqual(
            self.mod.normalize_morning_prayer_fragment_key({"key": "petition sanctification of the church", "label": "Petition - Sanctification of the Church"}),
            "petition-sanctification-of-the-church",
        )
        self.assertEqual(
            self.mod.normalize_morning_prayer_fragment_key({"key": "petition sick and departed", "label": "Petition - Sick and Departed"}),
            "petition-sick-and-departed",
        )

    def test_detailed_fragment_key_prefers_explicit_fragment_key_property(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Petition - Right Use of Technology"),
                "Fragment Key": _rich_text_prop("petition-church"),
            },
        }

        self.assertEqual(self.mod.detailed_fragment_key(page), "petition-church")

    def test_build_fragment_output_plan_rejects_fragment_cycles(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Morning Prayer"), "Order": _number_prop(1.0)}}
        config = {
            "builder": "audio_fragments_v1",
            "audio_caption": "Morning Prayer (Audio)",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "fragments": {
                "fragment-a": {"key": "fragment-a", "type": "sequence", "fragment_sequence": ["fragment-b"]},
                "fragment-b": {"key": "fragment-b", "type": "sequence", "fragment_sequence": ["fragment-a"]},
            },
            "fragment_sequence": ["fragment-a"],
            "config_map": {},
        }

        with self.assertRaisesRegex(RuntimeError, "cycle detected"):
            self.mod.build_fragment_output_plan(
                page=page,
                pages=[page],
                title_property="Name",
                config=config,
                token="token",
                base_url="https://api.openai.com/v1",
            )

    def test_build_fragment_output_plan_supports_prompt_fragments(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Morning Prayer"), "Order": _number_prop(1.0)}}
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

    def test_ffmpeg_audio_output_args_prefers_high_quality_mp3(self):
        self.assertEqual(
            self.mod.ffmpeg_audio_output_args("mp3"),
            ["-c:a", "libmp3lame", "-q:a", "0"],
        )

    def test_ensure_normalized_audio_fragment_uses_pcm_profile(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            source_path = Path(tmp_dir) / "input.mp3"
            source_path.write_bytes(b"input-audio")
            with temp_env({"PAGE_AUDIO_CACHE_DIR": tmp_dir}), patch.object(self.mod, "run_ffmpeg") as ffmpeg_mock:
                normalized = self.mod.ensure_normalized_audio_fragment(
                    source_path,
                    "hash1234abcd5678",
                    self.mod.page_audio_cache_dir(),
                )

        args = ffmpeg_mock.call_args.args[0]
        self.assertEqual(Path(normalized).suffix, ".wav")
        self.assertIn("-ar", args)
        self.assertIn(str(self.mod.PCM_NORMALIZE_SAMPLE_RATE), args)
        self.assertIn("-ac", args)
        self.assertIn(str(self.mod.PCM_NORMALIZE_CHANNELS), args)
        self.assertIn("pcm_s16le", args)

    def test_build_assembled_audio_passthroughs_single_matching_fragment(self):
        config = {
            "builder": "rss_audio_v1",
            "audio_caption": "Bible in a Year (Audio)",
            "silence_ms": 450,
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
        }
        fragment = self.mod.PageAudioFragment(
            kind="source_audio",
            label="Day 73",
            hash_value="hash_1",
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            source_path = Path(tmp_dir) / "source.mp3"
            source_path.write_bytes(b"source-audio")
            fragment.cache_path = str(source_path)
            with temp_env({"PAGE_AUDIO_CACHE_DIR": tmp_dir}), patch.object(
                self.mod, "assemble_audio_with_ffmpeg"
            ) as assemble_mock, patch.object(
                self.mod, "ensure_normalized_audio_fragment"
            ) as normalize_mock:
                audio_bytes = self.mod.build_assembled_audio(
                    [fragment],
                    config,
                    "openai-key",
                    "https://api.openai.com/v1",
                )

        self.assertEqual(audio_bytes, b"source-audio")
        assemble_mock.assert_not_called()
        normalize_mock.assert_not_called()

    def test_page_audio_cover_art_url_prefers_source_audio_fragment(self):
        fragments = [
            self.mod.PageAudioFragment(kind="tts", label="Intro", hash_value="hash_intro", artwork_url="https://example.com/tts.jpg"),
            self.mod.PageAudioFragment(kind="source_audio", label="Source", hash_value="hash_src", artwork_url="https://example.com/source.jpg"),
        ]

        self.assertEqual(self.mod.page_audio_cover_art_url(fragments), "https://example.com/source.jpg")

    def test_maybe_embed_cover_art_runs_ffmpeg_for_mp3(self):
        fragments = [
            self.mod.PageAudioFragment(kind="source_audio", label="Source", hash_value="hash_src", artwork_url="https://example.com/source.jpg")
        ]

        with tempfile.TemporaryDirectory() as tmp_dir:
            cover_path = Path(tmp_dir) / "cover.jpg"
            cover_path.write_bytes(b"cover")

            def fake_run_ffmpeg(args):
                output_path = Path(args[-1])
                output_path.write_bytes(b"tagged-audio")

            with temp_env({"PAGE_AUDIO_CACHE_DIR": tmp_dir}), patch.object(
                self.mod, "ensure_cover_art_path", return_value=cover_path
            ) as cover_mock, patch.object(
                self.mod, "run_ffmpeg", side_effect=fake_run_ffmpeg
            ) as ffmpeg_mock:
                output = self.mod.maybe_embed_cover_art(
                    b"input-audio",
                    "mp3",
                    fragments,
                    self.mod.page_audio_cache_dir(),
                )

        args = ffmpeg_mock.call_args.args[0]
        self.assertEqual(output, b"tagged-audio")
        self.assertEqual(str(args[4]), str(cover_path))
        self.assertIn("attached_pic", args)
        cover_mock.assert_called_once()

    def test_load_page_audio_config_merges_audio_outputs(self):
        payload = self.mod.load_page_audio_config("notion_token")
        self.assertIn("sing_the_hours_morning_page_audio", payload["configs"])
        self.assertIn("divine_office_invitatory_page_audio", payload["configs"])

    def test_load_page_audio_config_file_includes_evening_and_night_defaults(self):
        payload = self.mod.load_page_audio_config()

        self.assertIn("sing_the_hours_evening_page_audio", payload["configs"])
        self.assertIn("divine_office_night_page_audio", payload["configs"])
        self.assertIn("morning_prayer_contract", payload)
        self.assertEqual(payload["morning_prayer_contract"]["key"], "morning-prayer")
        self.assertEqual(len(payload["morning_prayer_contract"]["resolvers"]), 13)

    def test_load_page_audio_config_uses_file_contracts_only(self):
        env = {
            "NOTION_PAGE_AUDIO_CONFIG_DATABASE_ID": "page_audio_db_1",
        }

        with temp_env(env), patch.object(
            self.mod, "load_page_audio_config_from_file", return_value={"configs": {"SING_THE_HOURS_MORNING_PAGE_AUDIO": {"builder": "rss_audio_v1", "audio_caption": "Morning Prayer - Liturgy of the Hours (Audio)"}}}
        ), patch.object(
            self.mod, "load_page_audio_config_from_notion", side_effect=AssertionError("Notion config overrides should not be used")
        ), patch.object(
            self.mod, "load_audio_fragments_from_notion", side_effect=AssertionError("Notion fragments should not be used")
        ), patch.object(
            self.mod, "load_audio_outputs_from_notion", side_effect=AssertionError("Notion outputs should not be used")
        ):
            payload = self.mod.load_page_audio_config("notion_token")

        self.assertEqual(payload["configs"]["SING_THE_HOURS_MORNING_PAGE_AUDIO"]["audio_caption"], "Morning Prayer - Liturgy of the Hours (Audio)")

    def test_load_page_audio_config_merges_config_outputs_without_fragments(self):
        payload = self.mod.load_page_audio_config("notion_token")
        self.assertIn("SING_THE_HOURS_MORNING_PAGE_AUDIO", payload["configs"])
        self.assertNotIn("SING_THE_HOURS_MORNING_OUTPUT", payload["configs"])

    def test_render_page_audio_for_config_uses_cached_hash(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Morning Prayer"), "Order": _number_prop(1.0)}}
        config = {
            "builder": "morning_prayer_v1",
            "audio_caption": "Morning Prayer (Audio)",
            "output_folder": "Morning",
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
                "Order": _number_prop(1.01),
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

            audio_path = Path(tmp_dir) / "Morning" / "1.01 - Morning - Bible in a Year.mp3"
            meta_path = Path(tmp_dir) / "Morning" / "1.01 - Morning - Bible in a Year.json"
            self.assertTrue(audio_path.exists())
            self.assertTrue(meta_path.exists())
            payload = json.loads(meta_path.read_text(encoding="utf-8"))

        self.assertEqual(mode, f"cached:mp3:gpt-4o-mini-tts:alloy:hash={render_hash}")
        self.assertEqual(payload["output_folder"], "Morning")
        self.assertEqual(payload["render_hash"], render_hash)
        self.assertEqual(payload["export_order_display"], "1.01")
        self.assertEqual(payload["export_stem"], "1.01 - Morning - Bible in a Year")

    def test_page_audio_export_metadata_requires_valid_order(self):
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

        with self.assertRaisesRegex(RuntimeError, 'missing a valid "Order"'):
            self.mod.page_audio_export_metadata(
                page,
                title_property="Name",
                audio_format="mp3",
                config=config,
            )

    def test_page_audio_export_metadata_requires_output_folder(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Bible in a Year"),
                "Order": _number_prop(1.01),
            },
        }
        config = {
            "builder": "rss_audio_v1",
            "audio_caption": "Bible in a Year (Audio)",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
        }

        with self.assertRaisesRegex(RuntimeError, 'missing a valid "Output Folder"'):
            self.mod.page_audio_export_metadata(
                page,
                title_property="Name",
                audio_format="mp3",
                config=config,
            )

    def test_page_audio_export_metadata_normalizes_integer_order_display(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Morning Prayer"),
                "Playlist": _rich_text_prop("Morning"),
                "Order": _number_prop(2.0),
            },
        }
        config = {
            "builder": "rss_audio_v1",
            "audio_caption": "Morning Prayer (Audio)",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "output_folder": "Morning",
        }

        metadata = self.mod.page_audio_export_metadata(
            page,
            title_property="Name",
            audio_format="mp3",
            config=config,
        )

        self.assertEqual(metadata.order_display, "2")
        self.assertEqual(metadata.file_stem, "2 - Morning - Morning Prayer")

    def test_validate_unique_page_audio_export_targets_rejects_duplicate_stems(self):
        first = self.mod.PageAudioExportMetadata(
            folder_name="Morning",
            entry_name="Morning Prayer",
            order_value=1.01,
            order_display="1.01",
            file_stem="1.01 - Morning - Morning Prayer",
            audio_extension="mp3",
        )
        second = self.mod.PageAudioExportMetadata(
            folder_name="Morning",
            entry_name="Morning Prayer",
            order_value=1.01,
            order_display="1.01",
            file_stem="1.01 - Morning - Morning Prayer",
            audio_extension="mp3",
        )

        with self.assertRaisesRegex(RuntimeError, "Ordered Playlist Audio export collision"):
            self.mod.validate_unique_page_audio_export_targets(
                [("Morning Prayer", first), ("Morning Prayer Copy", second)]
            )

    def test_truncate_managed_page_audio_outputs_removes_audio_and_json(self):
        metadata = self.mod.PageAudioExportMetadata(
            folder_name="Morning",
            entry_name="Morning Prayer",
            order_value=1.01,
            order_display="1.01",
            file_stem="1.01 - Morning - Morning Prayer",
            audio_extension="mp3",
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            morning_dir = Path(tmp_dir) / "Morning"
            morning_dir.mkdir(parents=True, exist_ok=True)
            (morning_dir / "1.01 - Morning - Morning Prayer.mp3").write_bytes(b"audio")
            (morning_dir / "1.01 - Morning - Morning Prayer.json").write_text("{}", encoding="utf-8")
            (morning_dir / "keep.txt").write_text("notes", encoding="utf-8")

            with temp_env({"PAGE_AUDIO_LIBRARY_DIR": tmp_dir}):
                removed = self.mod.truncate_managed_page_audio_outputs([("Morning Prayer", metadata)])

            self.assertEqual(removed, 2)
            self.assertFalse((morning_dir / "1.01 - Morning - Morning Prayer.mp3").exists())
            self.assertFalse((morning_dir / "1.01 - Morning - Morning Prayer.json").exists())
            self.assertTrue((morning_dir / "keep.txt").exists())

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
        payload = self.mod.load_page_audio_config("notion_token")
        self.assertIn("sing_the_hours_morning_page_audio", payload["configs"])

    def test_main_filters_contract_rows_by_title(self):
        env = {
            "OPENAI_API_KEY": "key",
            "NOTION_TOKEN": "notion_token",
            "NOTION_DATABASE_ID": "db_1",
        }
        pages = [
            {
                "id": "page_1",
                "properties": {
                    "Name": _title_prop("Morning Prayer"),
                    "Output Folder": _rich_text_prop("Morning"),
                    "Order": _number_prop(1.0),
                },
            },
            {
                "id": "page_2",
                "properties": {
                    "Name": _title_prop("Bible in a Year"),
                    "Output Folder": _rich_text_prop("Morning"),
                    "Order": _number_prop(1.05),
                },
            },
        ]

        plan = self.mod.PageAudioPlan(
            fragments=[self.mod.PageAudioFragment(kind="tts", label="Morning Offering", hash_value="hash_1", text="Morning Offering.")]
        )
        morning_config = {
            "builder": "morning_prayer_v1",
            "target_row": "Morning Prayer",
            "output_folder": "Morning",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "resolvers": [{"key": "main", "kind": "builder", "builder": "morning_prayer_v1"}],
        }
        with temp_env(env):
            with patch.object(self.mod.shared, "notion_find_database_id", return_value="db_1"), patch.object(
                self.mod.shared, "notion_get_all_pages", return_value=pages
            ), patch.object(
                self.mod, "load_page_audio_config", return_value={"configs": {"morning_prayer": morning_config}}
            ), patch.object(
                self.mod, "build_morning_prayer_plan", return_value=plan
            ), patch.object(
                self.mod, "render_page_audio_for_config", return_value="cached:mp3:gpt-4o-mini-tts:alloy:hash=abcd1234"
            ) as render_mock:
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        render_mock.assert_called_once()

    def test_main_uses_contract_rows_without_legacy_config(self):
        env = {
            "OPENAI_API_KEY": "key",
            "NOTION_TOKEN": "notion_token",
            "NOTION_DATABASE_ID": "db_1",
        }
        pages = [
            {
                "id": "page_1",
                "properties": {
                    "Name": _title_prop("Divine Office Invitatory"),
                    "Output Folder": _rich_text_prop("Morning"),
                    "Order": _number_prop(1.03),
                },
            }
        ]
        config = {
            "builder": "rss_audio_v1",
            "target_row": "Divine Office Invitatory",
            "output_folder": "Morning",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "rss_feed_url": "https://example.com/feed.xml",
            "rss_match_strategy": "fixed_title",
            "rss_match_text": "Divine Office Invitatory",
            "resolvers": [{"key": "main", "kind": "builder", "builder": "rss_audio_v1"}],
        }
        plan = self.mod.PageAudioPlan(
            fragments=[self.mod.PageAudioFragment(kind="source_audio", label="Divine Office Invitatory", hash_value="hash_1", source_url="https://example.com/audio.mp3")]
        )

        with temp_env(env):
            with patch.object(self.mod.shared, "notion_find_database_id", return_value="db_1"), patch.object(
                self.mod.shared, "notion_get_all_pages", return_value=pages
            ), patch.object(
                self.mod, "load_page_audio_config", return_value={"configs": {"divine_office_invitatory_page_audio": config}}
            ), patch.object(
                self.mod, "build_rss_audio_plan", return_value=plan
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
        row_settings = {
            "title": "Night Prayer (Optional)",
            "assembly_mode": self.mod.OPUS_DEI_ASSEMBLY_MODE_FRAGMENTS,
            "text_sync_mode": self.mod.OPUS_DEI_TEXT_SYNC_MODE_PAGE_CONTENT,
            "text_property": "Description",
            "audio_config": {"tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}},
            "fragment_specs": [{"label": "Night Text", "kind": self.mod.FRAGMENT_KIND_BUILDER}],
        }

        with temp_env(env):
            with patch.object(self.mod.shared, "notion_find_database_id", return_value="db_1"), patch.object(
                self.mod.shared, "notion_get_all_pages", return_value=pages
            ), patch.object(
                self.mod, "load_detailed_fragments_from_notion", return_value={"fragments_by_page_id": {"page_1": []}}
            ), patch.object(
                self.mod, "opus_dei_two_list_settings", return_value=row_settings
            ), patch.object(
                self.mod, "build_opus_dei_two_list_plan", return_value=self.mod.PageAudioPlan(fragments=[], text_target="page_content", content_blocks=[])
            ):
                rc = self.mod.main()

        self.assertEqual(rc, 0)

    def test_build_opus_dei_two_list_plan_prefers_text_only_append_text_over_source_text(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Morning Prayer - Liturgy of the Hours")}}
        row_settings = {
            "title": "Morning Prayer - Liturgy of the Hours",
            "assembly_mode": self.mod.OPUS_DEI_ASSEMBLY_MODE_FRAGMENTS,
            "text_sync_mode": self.mod.OPUS_DEI_TEXT_SYNC_MODE_PAGE_CONTENT,
            "text_property": "Description",
            "audio_config": {"tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}},
            "fragment_specs": [
                {
                    "label": "Morning Text",
                    "kind": self.mod.FRAGMENT_KIND_BUILDER,
                    "assembly_role": self.mod.ASSEMBLY_ROLE_APPEND,
                    "config": {"builder": self.mod.DIVINE_OFFICE_NIGHT_TEXT_BUILDER},
                },
                {
                    "label": "Morning Audio",
                    "kind": self.mod.FRAGMENT_KIND_RSS_AUDIO,
                    "assembly_role": self.mod.ASSEMBLY_ROLE_PRIMARY_SOURCE,
                    "config": {"builder": self.mod.RSS_AUDIO_BUILDER, "rss_feed_url": "https://example.com/feed.xml"},
                },
            ],
        }
        text_plan = self.mod.PageAudioPlan(fragments=[], text_target="page_content", content_blocks=[{"marker": "text"}])
        audio_plan = self.mod.PageAudioPlan(
            fragments=[self.mod.PageAudioFragment(kind="source_audio", label="Morning Audio", hash_value="hash_1", source_url="https://example.com/audio.mp3")],
            text_target="page_content",
            content_blocks=[{"marker": "audio"}],
        )

        with patch.object(self.mod, "build_page_audio_plan", return_value=text_plan), patch.object(
            self.mod, "build_rss_audio_plan", return_value=audio_plan
        ):
            plan = self.mod.build_opus_dei_two_list_plan(
                page=page,
                pages=[page],
                title_property="Name",
                row_settings=row_settings,
                token="token",
                base_url="https://api.openai.com/v1",
            )

        self.assertEqual([block["marker"] for block in plan.content_blocks], ["text"])
        self.assertEqual([fragment.label for fragment in plan.fragments], ["Morning Audio"])

    def test_build_morning_prayer_plan_uses_repo_monthly_template_and_skips_novena(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Morning Prayer"),
                "Intention": _rich_text_prop("For peace in my family."),
            },
        }
        config = {"builder": "morning_prayer_v1", "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}}

        plan = self.mod.build_morning_prayer_plan(
            page=page,
            pages=[page],
            title_property="Name",
            config=config,
            token="token",
            base_url="https://api.openai.com/v1",
        )

        labels = [fragment.label for fragment in plan.fragments]
        self.assertIn("Monthly Intention", labels)
        self.assertIn("Random Intention", labels)
        self.assertNotIn("Daily Novena Audio", labels)
        monthly_fragment = next(fragment for fragment in plan.fragments if fragment.fragment_key == "monthly-intention")
        self.assertIn("For the Holy Father's monthly intention", monthly_fragment.text)

    def test_build_opus_dei_two_list_plan_requires_reliable_text_for_page_content(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Daily Examen")}}
        row_settings = {
            "title": "Daily Examen",
            "assembly_mode": self.mod.OPUS_DEI_ASSEMBLY_MODE_FRAGMENTS,
            "text_sync_mode": self.mod.OPUS_DEI_TEXT_SYNC_MODE_PAGE_CONTENT,
            "text_property": "Description",
            "audio_config": {"tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}},
            "fragment_specs": [
                {
                    "label": "Daily Examen Audio",
                    "kind": self.mod.FRAGMENT_KIND_SOURCE_AUDIO,
                    "assembly_role": self.mod.ASSEMBLY_ROLE_PRIMARY_SOURCE,
                    "source_url": "https://example.com/examen.mp3",
                }
            ],
        }

        with self.assertRaisesRegex(RuntimeError, "configured for page_content but no reliable text content was produced"):
            self.mod.build_opus_dei_two_list_plan(
                page=page,
                pages=[page],
                title_property="Name",
                row_settings=row_settings,
                token="token",
                base_url="https://api.openai.com/v1",
            )

    def test_main_uses_contract_rows_without_loading_legacy_config(self):
        env = {
            "OPENAI_API_KEY": "key",
            "NOTION_TOKEN": "notion_token",
            "NOTION_DATABASE_ID": "db_1",
        }
        pages = [
            {
                "id": "page_1",
                "properties": {
                    "Name": _title_prop("Evening Prayer"),
                    "Output Folder": _rich_text_prop("Night"),
                    "Order": _number_prop(3.0),
                },
            }
        ]
        config = {
            "builder": "rss_audio_v1",
            "target_row": "Evening Prayer",
            "output_folder": "Night",
            "tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0},
            "rss_feed_url": "https://example.com/feed.xml",
            "rss_match_strategy": "fixed_title",
            "rss_match_text": "Evening Prayer",
            "resolvers": [{"key": "main", "kind": "builder", "builder": "rss_audio_v1"}],
        }
        plan = self.mod.PageAudioPlan(
            fragments=[self.mod.PageAudioFragment(kind="source_audio", label="Evening Audio", hash_value="hash_1", source_url="https://example.com/audio.mp3")]
        )

        with temp_env(env):
            with patch.object(self.mod.shared, "notion_find_database_id", return_value="db_1"), patch.object(
                self.mod.shared, "notion_get_all_pages", return_value=pages
            ), patch.object(
                self.mod, "load_page_audio_config", return_value={"configs": {"evening_prayer": config}}
            ), patch.object(
                self.mod, "build_rss_audio_plan", return_value=plan
            ), patch.object(
                self.mod, "render_page_audio_for_config", return_value="cached:mp3:gpt-4o-mini-tts:alloy:hash=abcd1234"
            ) as render_mock:
                rc = self.mod.main()

        self.assertEqual(rc, 0)
        render_mock.assert_called_once()

    def test_resolve_page_sync_keys_supports_text_and_audio_together(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Morning Prayer - Liturgy of the Hours (Spotify)"),
                "Platform": _rich_text_prop("Spotify, auto-text, auto-audio"),
                "Text Resolver": _rich_text_prop("DIVINE_OFFICE_NIGHT_TEXT"),
                "Auto Audio Resolver 1": _rich_text_prop("SING_THE_HOURS_MORNING_PAGE_AUDIO"),
                "Auto Audio Resolver 2": _rich_text_prop("SING_THE_HOURS_MORNING_PAGE_AUDIO"),
            },
        }
        config_map = {
            "DIVINE_OFFICE_NIGHT_TEXT": {"builder": "divine_office_night_text_v1"},
            "SING_THE_HOURS_MORNING_PAGE_AUDIO": {"builder": "rss_audio_v1"},
            "SING_THE_HOURS_MORNING_PAGE_AUDIO": {"builder": "rss_audio_v1"},
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

        self.assertEqual(text_key, "DIVINE_OFFICE_NIGHT_TEXT")
        self.assertEqual(audio_keys, ["SING_THE_HOURS_MORNING_PAGE_AUDIO"])

    def test_page_sync_deprecation_messages_identify_legacy_row_fields(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Morning Prayer"),
                "Platform": _rich_text_prop("Spotify, auto-text, auto-audio"),
                "Audio Configuration": _rich_text_prop("MORNING_PRAYER_TEXT"),
                "Spotify Resolver": _rich_text_prop("MORNING_PRAYER_AUDIO"),
            },
        }
        config_map = {
            "MORNING_PRAYER_TEXT": {"builder": "divine_office_night_text_v1"},
            "MORNING_PRAYER_AUDIO": {"builder": "rss_audio_v1"},
        }

        messages = self.mod.page_sync_deprecation_messages(
            page,
            config_map,
            title_property="Name",
            text_resolver_property="Text Resolver",
            auto_audio_primary_property="Auto Audio Resolver 1",
            auto_audio_secondary_property="Auto Audio Resolver 2",
            legacy_config_property="Audio Configuration",
            legacy_resolver_property="Spotify Resolver",
            auto_text_enabled=True,
            auto_audio_enabled=True,
        )

        self.assertEqual(len(messages), 3)
        self.assertTrue(any('"Audio Configuration"' in message and "text sync" in message for message in messages))
        self.assertTrue(any('"Audio Configuration"' in message and "audio sync" in message for message in messages))
        self.assertTrue(any('"Spotify Resolver"' in message and "audio sync" in message for message in messages))

    def test_build_opus_dei_two_list_plan_falls_back_to_fallback_source(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Morning Prayer - Liturgy of the Hours (Spotify)")}}
        row_settings = {
            "title": "Morning Prayer - Liturgy of the Hours (Spotify)",
            "assembly_mode": self.mod.OPUS_DEI_ASSEMBLY_MODE_FRAGMENTS,
            "text_sync_mode": self.mod.OPUS_DEI_TEXT_SYNC_MODE_NONE,
            "text_property": "Description",
            "audio_config": {"tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}},
            "fragment_specs": [
                {"label": "Primary Source", "kind": self.mod.FRAGMENT_KIND_RSS_AUDIO, "assembly_role": self.mod.ASSEMBLY_ROLE_PRIMARY_SOURCE, "config": {}},
                {"label": "Fallback Source", "kind": self.mod.FRAGMENT_KIND_RSS_AUDIO, "assembly_role": self.mod.ASSEMBLY_ROLE_FALLBACK_SOURCE, "config": {}},
            ],
        }
        fallback_plan = self.mod.PageAudioPlan(
            fragments=[self.mod.PageAudioFragment(kind="source_audio", label="Fallback Source", hash_value="hash_1", source_url="https://example.com/prayer.mp3")]
        )

        with patch.object(self.mod, "build_rss_audio_plan", side_effect=[RuntimeError("primary failed"), fallback_plan]):
            plan = self.mod.build_opus_dei_two_list_plan(
                page=page,
                pages=[page],
                title_property="Name",
                row_settings=row_settings,
                token="token",
                base_url="https://api.openai.com/v1",
            )

        self.assertEqual([fragment.label for fragment in plan.fragments], ["Fallback Source"])

    def test_build_opus_dei_two_list_plan_strips_duplicate_leading_random_intention_from_source(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Saint of the Day")}}
        row_settings = {
            "title": "Saint of the Day",
            "assembly_mode": self.mod.OPUS_DEI_ASSEMBLY_MODE_FRAGMENTS,
            "text_sync_mode": self.mod.OPUS_DEI_TEXT_SYNC_MODE_NONE,
            "text_property": "Description",
            "audio_config": {"tts": {"model": "gpt-4o-mini-tts", "voice": "alloy", "format": "mp3", "speed": 1.0}},
            "fragment_specs": [
                {"label": "Random Intention", "kind": self.mod.FRAGMENT_TYPE_RANDOM_INTENTION, "assembly_role": self.mod.ASSEMBLY_ROLE_APPEND},
                {"label": "Saint Source", "kind": self.mod.FRAGMENT_KIND_RSS_AUDIO, "assembly_role": self.mod.ASSEMBLY_ROLE_PRIMARY_SOURCE, "config": {}},
            ],
        }
        intention_a = self.mod.PageAudioFragment(
            kind="tts",
            label=self.mod.RANDOM_INTENTION_FRAGMENT_LABEL,
            hash_value="same_hash",
            fragment_key=self.mod.RANDOM_INTENTION_FRAGMENT_KEY,
            collection=self.mod.RANDOM_INTENTION_FRAGMENT_COLLECTION,
        )
        intention_b = self.mod.PageAudioFragment(
            kind="tts",
            label=self.mod.RANDOM_INTENTION_FRAGMENT_LABEL,
            hash_value="same_hash",
            fragment_key=self.mod.RANDOM_INTENTION_FRAGMENT_KEY,
            collection=self.mod.RANDOM_INTENTION_FRAGMENT_COLLECTION,
        )
        source_fragment = self.mod.PageAudioFragment(
            kind="source_audio",
            label="Saint Source",
            hash_value="audio_hash",
            source_url="https://example.com/saint.mp3",
        )

        with patch.object(
            self.mod,
            "build_detailed_fragment_child_plan",
            side_effect=[
                self.mod.PageAudioPlan(fragments=[intention_a]),
                self.mod.PageAudioPlan(fragments=[intention_b, source_fragment]),
            ],
        ):
            plan = self.mod.build_opus_dei_two_list_plan(
                page=page,
                pages=[page],
                title_property="Name",
                row_settings=row_settings,
                token="token",
                base_url="https://api.openai.com/v1",
            )

        self.assertEqual([fragment.label for fragment in plan.fragments], ["Random Intention", "Saint Source"])


if __name__ == "__main__":
    unittest.main()
