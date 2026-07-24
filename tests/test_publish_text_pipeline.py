import datetime
import unittest
from pathlib import Path
from types import SimpleNamespace

from tests.test_helpers import load_module


class FakeNotionClient:
    def __init__(self):
        self.pages = {
            "Morning Prayer - April 6, 2026": "page-1",
            "Daily Rosary - Joyful Mysteries - Saint Example - April 6, 2026": "page-2",
            "Auxilium Christianorum - April 6, 2026": "page-3",
            "Daily Reflection - Resurrection Hope - April 6, 2026": "page-4",
        }
        self.page_children = {}
        self.page_children["page-1"] = []
        self.page_children["page-2"] = []
        self.page_children["page-3"] = []
        self.page_children["page-4"] = []
        self.updated = []
        self.queries = []

    def query_database(self, database_id, body):
        self.queries.append((database_id, body))
        filter_body = body["filter"]
        title_filter = filter_body.get("title") or {}
        entry_id = title_filter.get("equals")
        if str(entry_id).startswith("Daily Reflection - ") and str(entry_id).endswith(" - April 6, 2026"):
            return {"results": [{"id": "page-4"}]}
        for page_title, page_id in self.pages.items():
            if page_title == entry_id:
                return {"results": [{"id": page_id}]}
        return {"results": []}

    def create_page(self, database_id, properties):
        raise AssertionError("create_page should not be called")

    def update_page(self, page_id, properties):
        self.updated.append((page_id, properties))
        return {"id": page_id}

    def request(self, method, path, payload=None):
        if method == "GET" and path.startswith("/blocks/") and path.endswith("/children?page_size=100"):
            page_id = path.split("/", 3)[2]
            return {"results": list(self.page_children.get(page_id, [])), "has_more": False}
        if method == "PATCH" and path.startswith("/blocks/") and path.endswith("/children"):
            page_id = path.split("/", 3)[2]
            children = []
            for child in payload.get("children") or []:
                stored = dict(child)
                stored.setdefault("id", f"{page_id}-{len(self.page_children.get(page_id, [])) + len(children) + 1}")
                children.append(stored)
            self.page_children.setdefault(page_id, []).extend(children)
            return {"results": children}
        if method == "PATCH" and path.startswith("/blocks/"):
            block_id = path.split("/", 3)[2]
            if payload and payload.get("archived"):
                for page_id, children in list(self.page_children.items()):
                    self.page_children[page_id] = [child for child in children if str(child.get("id")) != block_id]
            return {"id": block_id}
        raise AssertionError(f"Unexpected request: {method} {path}")


def _toggle_title(block):
    rich_text = block.get("toggle", {}).get("rich_text") or []
    if not rich_text:
        return ""
    return str((rich_text[0] or {}).get("text", {}).get("content", "")).strip()


class TestPublishTextPipeline(unittest.TestCase):
    def setUp(self):
        self.contracts_mod = load_module("jobs/publish/contracts.py")
        self.notion_mod = load_module("jobs/publish/notion.py")
        self.runner_mod = load_module("jobs/publish/run_text_pipeline.py")
        self.contracts_mod.build_daily_intro_text = lambda date_value, **kwargs: (
            "Today the Church celebrates Saint Example. Praise be to God for his mercy. "
            "In today's Gospel, Jesus calls his sheep by name."
        )
        self.contracts_mod.build_liturgical_announcement_text = lambda date_value, **kwargs: (
            f"Today is {date_value.strftime('%A, %B')} {date_value.day}, {date_value.year}. "
            "Today the Church celebrates Saint Example."
        )
        self.contracts_mod.romcal_fetch_day = lambda calendar, locale, date_value: [{"name": "Saint Example"}]
        self.contracts_mod.build_rosary_day_context = self._fake_rosary_day_context
        self.contracts_mod.build_rosary_intro_text = lambda date_value, mystery_set_title, mysteries, **kwargs: (
            "Today is Monday, April 6, 2026, in the Easter season. "
            "For today's rosary, we will focus on the feast of Saint Example. "
            f"As we pray the {mystery_set_title}, we ask for grace."
        )
        self.contracts_mod.build_rosary_reflection_set = self._fake_rosary_reflection_set

    def _fake_rosary_day_context(self, date_value, mystery_text, **kwargs):
        lines = [line.strip() for line in mystery_text.splitlines() if line.strip()]
        mysteries = []
        for line in lines[1:]:
            number, rest = line.split(".", 1)
            title, fruit = rest.split(" - ", 1)
            mysteries.append(SimpleNamespace(number=int(number), title=title.strip(), fruit=fruit.strip()))
        return SimpleNamespace(
            date=date_value,
            mystery_set_title=lines[0],
            mysteries=tuple(mysteries),
            focus_source="feast",
            focus_title="Saint Example",
            focus_prompt_label="the feast of Saint Example",
            celebration_clause="Saint Example",
            season_label="Easter season",
            feast_names=("Saint Example",),
            gospel_citation="John 10:1-10",
            gospel_text="Jesus calls his sheep by name.",
            calendar="general_roman",
            locale="en",
        )

    def _fake_rosary_reflection_set(self, date_value, mystery_text, **kwargs):
        lines = [line.strip() for line in mystery_text.splitlines() if line.strip()]
        mysteries = []
        for line in lines[1:]:
            number, rest = line.split(".", 1)
            title, fruit = rest.split(" - ", 1)
            mysteries.append(SimpleNamespace(number=int(number), title=title.strip(), fruit=fruit.strip()))
        return SimpleNamespace(
            mystery_set_title=lines[0],
            mysteries=tuple(mysteries),
            reflections=tuple(f"Reflection for {mystery.title}." for mystery in mysteries),
            source="generated_feast",
            day_context=self._fake_rosary_day_context(date_value, mystery_text),
            fallback_reason="",
        )

    def test_upsert_text_jobs_updates_existing_pages_by_title(self):
        contracts = self.contracts_mod.load_publish_contracts()
        jobs = self.contracts_mod.build_text_jobs(contracts, target_date=datetime.date(2026, 4, 6))
        client = FakeNotionClient()

        first = self.notion_mod.upsert_text_jobs_to_notion(jobs, client=client)
        second = self.notion_mod.upsert_text_jobs_to_notion(jobs, client=client)

        self.assertEqual(first["created"], 0)
        self.assertEqual(first["updated"], 4)
        self.assertEqual(second["created"], 0)
        self.assertEqual(second["updated"], 4)
        self.assertEqual(
            set(client.pages.keys()),
            {
                "Morning Prayer - April 6, 2026",
                "Daily Rosary - Joyful Mysteries - Saint Example - April 6, 2026",
                "Auxilium Christianorum - April 6, 2026",
                "Daily Reflection - Resurrection Hope - April 6, 2026",
            },
        )
        self.assertEqual([_toggle_title(block) for block in client.page_children["page-1"]], [
            "Daily Intro",
            "Opening Prayers",
            "Petitions",
            "Intercessory Litany",
        ])
        self.assertEqual([_toggle_title(block) for block in client.page_children["page-2"]], [
            "Rosary Intro",
            "Rosary Intention",
            "Opening Prayers",
            "Joyful Mysteries",
            "Closing Prayers",
        ])
        self.assertEqual([_toggle_title(block) for block in client.page_children["page-3"]], [
            "Liturgical Announcement",
            "Prayer Intro",
            "Opening Prayers",
            "Litany of the Most Precious Blood",
            "Weekday Prayer",
            "Conclusion",
        ])
        self.assertTrue(all(child["type"] == "paragraph" for child in client.page_children["page-1"][0]["toggle"]["children"]))
        self.assertTrue(all(child["type"] == "paragraph" for child in client.page_children["page-2"][1]["toggle"]["children"]))

    def test_run_text_pipeline_returns_summary(self):
        contracts = self.contracts_mod.load_publish_contracts()
        fake_client = FakeNotionClient()

        def fake_build_notion_client(token=None):
            return fake_client

        self.runner_mod.load_publish_contracts = lambda contract_dir=None: contracts
        self.runner_mod.build_notion_client = fake_build_notion_client
        self.runner_mod.build_text_jobs = lambda contracts, target_date=None: self.contracts_mod.build_text_jobs(
            contracts, target_date=datetime.date(2026, 4, 6)
        )

        result = self.runner_mod.run_text_pipeline()

        self.assertEqual(result["jobs"], 4)
        self.assertEqual(result["created"], 0)
        self.assertEqual(result["updated"], 4)

    def test_publish_text_workflow_is_not_active(self):
        active_path = Path(".github/workflows/publish_text.yml")
        archived_path = Path(".github/disabled_workflows/publish_text.yml")

        self.assertFalse(active_path.exists())
        self.assertTrue(archived_path.exists())
        self.assertIn("name: Publish Prayer Text", archived_path.read_text(encoding="utf-8"))
