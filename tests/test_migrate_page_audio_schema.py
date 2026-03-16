import unittest
from unittest.mock import patch

from tests.test_helpers import load_module


def _title_prop(text):
    return {"type": "title", "title": [{"plain_text": text}]}


def _rich_text_prop(text):
    return {"type": "rich_text", "rich_text": [{"plain_text": text}]}


class TestMigratePageAudioSchema(unittest.TestCase):
    def setUp(self):
        self.script = load_module("scripts/migrate_page_audio_notion_schema.py")

    def test_build_property_schema_supports_relations(self):
        payload = self.script.build_property_schema(
            {"type": "relation", "database_id_ref": "fragments"},
            database_ids={"opus": "db_opus", "fragments": "db_fragments"},
        )

        self.assertEqual(payload["relation"]["database_id"], "db_fragments")
        self.assertEqual(payload["relation"]["type"], "single_property")

    def test_source_or_builder_fragment_values_splits_random_intention_from_rss_audio(self):
        values = self.script.source_or_builder_fragment_values(
            owner_page_id="page_1",
            title="Morning Prayer Source",
            order=1,
            role=self.script.mod.ASSEMBLY_ROLE_PRIMARY_SOURCE,
            config_key="DIVINE_OFFICE_MORNING_PAGE_AUDIO",
            config={
                "builder": self.script.mod.RSS_AUDIO_BUILDER,
                "rss_feed_url": "https://example.com/feed.xml",
                "rss_match_text": "Morning Prayer",
                "intention_property": "Intention",
                "intention_prefix": "For today's intention:",
            },
            for_text_only=False,
        )

        self.assertEqual(values[0][self.script.mod.DETAILED_FRAGMENT_KIND_PROPERTY], self.script.mod.FRAGMENT_TYPE_RANDOM_INTENTION)
        self.assertEqual(values[1][self.script.mod.DETAILED_FRAGMENT_KIND_PROPERTY], self.script.mod.FRAGMENT_KIND_RSS_AUDIO)
        self.assertEqual(values[1][self.script.mod.DETAILED_FRAGMENT_ASSEMBLY_ROLE_PROPERTY], self.script.mod.ASSEMBLY_ROLE_PRIMARY_SOURCE)

    def test_morning_prayer_fragment_values_from_page_creates_special_fragments(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Morning Prayer")}}
        blocks = [
            {"id": "heading_1", "type": "heading_3", "heading_3": {"rich_text": [{"plain_text": "Morning Offering"}]}},
            {"id": "paragraph_1", "type": "paragraph", "paragraph": {"rich_text": [{"plain_text": "Offer my day."}]}},
            {"id": "paragraph_2", "type": "paragraph", "paragraph": {"rich_text": [{"plain_text": "(monthly fragment For the Holy Father's monthly intention)"}]}},
            {"id": "paragraph_3", "type": "paragraph", "paragraph": {"rich_text": [{"plain_text": "(Daily Novena Fragment)"}]}},
        ]

        with patch.object(self.script.mod.shared, "notion_list_block_children", return_value=blocks):
            values = self.script.morning_prayer_fragment_values_from_page(page, "token")

        self.assertEqual(values[0][self.script.mod.DETAILED_FRAGMENT_KIND_PROPERTY], self.script.mod.FRAGMENT_TYPE_TEXT)
        self.assertEqual(values[1][self.script.mod.DETAILED_FRAGMENT_KIND_PROPERTY], self.script.mod.FRAGMENT_TYPE_MONTHLY_INTENTION)
        self.assertEqual(values[2][self.script.mod.DETAILED_FRAGMENT_KIND_PROPERTY], self.script.mod.FRAGMENT_TYPE_DAILY_NOVENA_AUDIO)
