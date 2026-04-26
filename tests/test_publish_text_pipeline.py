import datetime
import unittest
from pathlib import Path

from tests.test_helpers import load_module


class FakeNotionClient:
    def __init__(self):
        self.pages = {}
        self.created = []
        self.updated = []
        self.queries = []

    def query_database(self, database_id, body):
        self.queries.append((database_id, body))
        filter_body = body["filter"]
        if "rich_text" in filter_body:
            entry_id = filter_body["rich_text"]["equals"]
        else:
            entry_id = filter_body["title"]["equals"]
        if entry_id in self.pages:
            return {"results": [{"id": self.pages[entry_id]}]}
        return {"results": []}

    def create_page(self, database_id, properties):
        page_id = f"page-{len(self.created) + 1}"
        entry_prop = next(value for key, value in properties.items() if key == "Entry ID")
        entry_id = entry_prop["rich_text"][0]["text"]["content"]
        self.pages[entry_id] = page_id
        self.created.append((database_id, properties))
        return {"id": page_id}

    def update_page(self, page_id, properties):
        self.updated.append((page_id, properties))
        return {"id": page_id}


class TestPublishTextPipeline(unittest.TestCase):
    def setUp(self):
        self.contracts_mod = load_module("jobs/publish/contracts.py")
        self.notion_mod = load_module("jobs/publish/notion.py")
        self.runner_mod = load_module("jobs/publish/run_text_pipeline.py")

    def test_upsert_text_jobs_uses_entry_id_as_the_stable_key(self):
        contracts = self.contracts_mod.load_publish_contracts()
        jobs = self.contracts_mod.build_text_jobs(contracts, target_date=datetime.date(2026, 4, 6))
        client = FakeNotionClient()

        first = self.notion_mod.upsert_text_jobs_to_notion(jobs, client=client)
        second = self.notion_mod.upsert_text_jobs_to_notion(jobs, client=client)

        self.assertEqual(first["created"], 2)
        self.assertEqual(first["updated"], 0)
        self.assertEqual(second["created"], 0)
        self.assertEqual(second["updated"], 2)
        self.assertEqual({entry_id for entry_id in client.pages.keys()}, {"morning-prayer", "rosary"})

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
        self.assertEqual(result["created"], 2)
        self.assertEqual(result["updated"], 0)
