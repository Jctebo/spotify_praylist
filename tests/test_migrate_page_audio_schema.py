import unittest

from tests.test_helpers import load_module


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

        self.assertEqual(
            values[0][self.script.mod.DETAILED_FRAGMENT_KIND_PROPERTY],
            self.script.mod.FRAGMENT_TYPE_RANDOM_INTENTION,
        )
        self.assertEqual(
            values[1][self.script.mod.DETAILED_FRAGMENT_KIND_PROPERTY],
            self.script.mod.FRAGMENT_KIND_RSS_AUDIO,
        )
        self.assertEqual(
            values[1][self.script.mod.DETAILED_FRAGMENT_ASSEMBLY_ROLE_PROPERTY],
            self.script.mod.ASSEMBLY_ROLE_PRIMARY_SOURCE,
        )


if __name__ == "__main__":
    unittest.main()
