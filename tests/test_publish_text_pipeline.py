import datetime
import unittest
from pathlib import Path

from tests.test_helpers import load_module


class FakeNotionClient:
    def __init__(self):
        self.pages = {"Morning Prayer": "page-1", "Daily Rosary": "page-2"}
        self.page_children = {}
        self.page_children["page-1"] = []
        self.page_children["page-2"] = []
        self.created = []
        self.updated = []
        self.queries = []

    def query_database(self, database_id, body):
        self.queries.append((database_id, body))
        filter_body = body["filter"]
        title_filter = filter_body.get("title") or {}
        entry_id = title_filter.get("equals")
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
            children = list(payload.get("children") or [])
            self.page_children.setdefault(page_id, []).extend(children)
            return {"results": children}
        if method == "PATCH" and path.startswith("/blocks/"):
            return {"id": path.split("/", 3)[2]}
        raise AssertionError(f"Unexpected request: {method} {path}")


class TestPublishTextPipeline(unittest.TestCase):
    def setUp(self):
        self.contracts_mod = load_module("jobs/publish/contracts.py")
        self.notion_mod = load_module("jobs/publish/notion.py")
        self.runner_mod = load_module("jobs/publish/run_text_pipeline.py")

    def test_upsert_text_jobs_updates_existing_pages_by_title(self):
        contracts = self.contracts_mod.load_publish_contracts()
        jobs = self.contracts_mod.build_text_jobs(contracts, target_date=datetime.date(2026, 4, 6))
        client = FakeNotionClient()

        first = self.notion_mod.upsert_text_jobs_to_notion(jobs, client=client)
        second = self.notion_mod.upsert_text_jobs_to_notion(jobs, client=client)

        self.assertEqual(first["created"], 0)
        self.assertEqual(first["updated"], 2)
        self.assertEqual(second["created"], 0)
        self.assertEqual(second["updated"], 2)
        self.assertEqual(set(client.pages.keys()), {"Morning Prayer", "Daily Rosary"})
        self.assertTrue(any(client.page_children[page_id] for page_id in client.page_children))
        self.assertEqual(client.page_children["page-1"][0]["type"], "toggle")
        self.assertEqual(client.page_children["page-2"][0]["type"], "toggle")

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

        self.assertEqual(result["jobs"], 2)
        self.assertEqual(result["created"], 0)
        self.assertEqual(result["updated"], 2)
