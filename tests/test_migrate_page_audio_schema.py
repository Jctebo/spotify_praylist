import unittest
from unittest.mock import patch

from tests.test_helpers import load_module


def _title_prop(text):
    return {"type": "title", "title": [{"plain_text": text}]}


def _rich_text_prop(text):
    return {"type": "rich_text", "rich_text": [{"plain_text": text}]}


def _checkbox_prop(value):
    return {"type": "checkbox", "checkbox": bool(value)}


def _relation_prop(ids):
    return {"type": "relation", "relation": [{"id": value} for value in ids]}


def _number_prop(value):
    return {"type": "number", "number": value}


def _fragment_page(
    title,
    *,
    page_id,
    text="",
    group="morning_prayer",
    kind="",
    legacy_type="",
    relation_ids=None,
):
    properties = {
        "Name": _title_prop(title),
        "Enabled": _checkbox_prop(True),
        "Collection": _rich_text_prop(group),
        "Group": _rich_text_prop(group),
        "Opus Dei Item": _relation_prop(relation_ids or []),
    }
    if text:
        properties["Spoken Text"] = _rich_text_prop(text)
    if kind:
        properties["Fragment Kind"] = _rich_text_prop(kind)
    if legacy_type:
        properties["Fragment Type"] = _rich_text_prop(legacy_type)
    return {"id": page_id, "properties": properties}


def _morning_prayer_fragments_map(script):
    fragments_map = {}
    sequence_entries = []
    for item in script.mod.morning_prayer_contract_items():
        label = item["label"]
        kind = item["kind"]
        key = script.mod.slugify(label)
        if kind == script.mod.FRAGMENT_TYPE_TEXT:
            fragments_map[key] = {
                "type": kind,
                "label": label,
                "text": f"{label}.",
            }
            sequence_entries.append(key)
        elif kind == script.mod.FRAGMENT_TYPE_MONTHLY_INTENTION:
            sequence_entries.append(script.mod.SPECIAL_MONTHLY_INTENTION)
        elif kind == script.mod.FRAGMENT_TYPE_DAILY_NOVENA_AUDIO:
            sequence_entries.append(script.mod.SPECIAL_DAILY_NOVENA_AUDIO)
    return fragments_map, sequence_entries


def _output_page(sequence_entries):
    return {
        "id": "output_1",
        "properties": {
            "Name": _title_prop("Morning Prayer"),
            "Fragment Sequence": _rich_text_prop("\n".join(sequence_entries)),
        },
    }


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

    def test_morning_prayer_fragment_values_from_legacy_output_matches_canonical_contract(self):
        fragments_map, sequence_entries = _morning_prayer_fragments_map(self.script)

        values = self.script.morning_prayer_fragment_values_from_legacy_output(
            _output_page(sequence_entries),
            owner_page_id="page_1",
            fragments_map=fragments_map,
        )

        contract = self.script.mod.morning_prayer_contract_items()
        self.assertEqual(
            [value[self.script.mod.AUDIO_FRAGMENT_TITLE_PROPERTY] for value in values],
            [item["label"] for item in contract],
        )
        self.assertEqual(
            [value[self.script.mod.DETAILED_FRAGMENT_KIND_PROPERTY] for value in values],
            [item["kind"] for item in contract],
        )

    def test_build_fragment_page_resolutions_reuses_ownerless_rows(self):
        values = [
            self.script.text_fragment_values(
                owner_page_id="page_1",
                title="Morning Offering",
                order=1,
                text="Morning Offering.",
                group="morning_prayer",
                notes="legacy",
            )
        ]
        fragment_pages = [
            _fragment_page(
                "Morning Offering",
                page_id="fragment_1",
                text="Morning Offering.",
                group="morning_prayer",
                legacy_type=self.script.mod.FRAGMENT_TYPE_TEXT,
            )
        ]

        resolutions = self.script.build_fragment_page_resolutions(
            fragment_pages,
            owner_page_id="page_1",
            values_list=values,
            reuse_ownerless=True,
        )

        self.assertEqual(resolutions[0]["action"], "relink")
        self.assertEqual(resolutions[0]["page"]["id"], "fragment_1")

    def test_build_fragment_page_resolutions_flags_ambiguous_ownerless_rows(self):
        values = [
            self.script.text_fragment_values(
                owner_page_id="page_1",
                title="Morning Offering",
                order=1,
                text="Morning Offering.",
                group="morning_prayer",
                notes="legacy",
            )
        ]
        fragment_pages = [
            _fragment_page(
                "Morning Offering",
                page_id="fragment_1",
                text="Morning Offering.",
                group="morning_prayer",
                legacy_type=self.script.mod.FRAGMENT_TYPE_TEXT,
            ),
            _fragment_page(
                "Morning Offering",
                page_id="fragment_2",
                text="Morning Offering.",
                group="morning_prayer",
                legacy_type=self.script.mod.FRAGMENT_TYPE_TEXT,
            ),
        ]

        resolutions = self.script.build_fragment_page_resolutions(
            fragment_pages,
            owner_page_id="page_1",
            values_list=values,
            reuse_ownerless=True,
        )

        self.assertEqual(resolutions[0]["action"], "ambiguous_ownerless")

    def test_preflight_morning_prayer_migration_reports_missing_contract(self):
        page = {"id": "page_1", "properties": {"Name": _title_prop("Morning Prayer")}}
        output_page = _output_page([self.script.mod.SPECIAL_DAILY_NOVENA_AUDIO])

        preflight = self.script.preflight_morning_prayer_migration(
            page=page,
            output_page=output_page,
            fragment_pages=[],
            fragments_map={},
            title_property="Name",
            apply=False,
        )

        self.assertTrue(any("missing fragment 'Morning Offering'" in error for error in preflight["errors"]))
        self.assertEqual(preflight["create_titles"], ["Monthly Intention", "Daily Novena Audio"])

    def test_migrate_page_rows_does_not_fallback_to_page_body_for_invalid_morning_prayer(self):
        page = {
            "id": "page_1",
            "properties": {
                "Name": _title_prop("Morning Prayer"),
                "Platform": _rich_text_prop("auto-audio"),
                "Enabled": _checkbox_prop(True),
            },
        }
        output_page = _output_page([self.script.mod.SPECIAL_DAILY_NOVENA_AUDIO])

        with patch.object(self.script, "refresh_pages", side_effect=[[page], [output_page], []]), patch.object(
            self.script.mod, "notion_audio_outputs_database_id", return_value="outputs_db"
        ), patch.object(
            self.script.mod, "list_audio_candidate_pages", return_value=[page]
        ), patch.object(
            self.script.mod, "resolve_page_sync_keys", return_value=("", [])
        ), patch.object(
            self.script, "morning_prayer_fragment_values_from_page", side_effect=AssertionError("page fallback should not run")
        ), patch.object(
            self.script, "upsert_fragment_pages"
        ) as upsert_mock, patch.object(
            self.script, "create_or_update_page"
        ) as update_mock:
            self.script.migrate_page_rows(
                token="token",
                opus_db_id="opus_db",
                opus_db={},
                fragments_db_id="fragments_db",
                fragments_db={},
                config_map={},
                apply=False,
            )

        upsert_mock.assert_not_called()
        update_mock.assert_not_called()


if __name__ == "__main__":
    unittest.main()
