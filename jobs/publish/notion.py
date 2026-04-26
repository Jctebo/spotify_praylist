from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence

import requests

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.publish.contracts import DEFAULT_NOTION_DATABASE_NAME, DEFAULT_NOTION_FIELDS, normalize_publish_key

NOTION_VERSION = "2022-06-28"
NOTION_REQUEST_TIMEOUT_SECONDS = 30
NOTION_MAX_ATTEMPTS = 5
NOTION_RETRYABLE_STATUSES = {408, 409, 429, 500, 502, 503, 504}
NOTION_TOKEN = "NOTION_TOKEN"
NOTION_DATABASE_ID = "NOTION_DATABASE_ID"
NOTION_DATABASE_NAME = "NOTION_DATABASE_NAME"


class NotionClient:
    def __init__(self, token: str, base_url: str = "https://api.notion.com/v1", session: Optional[requests.Session] = None):
        self.token = token
        self.base_url = base_url
        self.session = session

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "Notion-Version": NOTION_VERSION,
        }

    def request(self, method: str, path: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.base_url.rstrip('/')}{path}"
        session = self.session or requests
        for attempt in range(1, NOTION_MAX_ATTEMPTS + 1):
            try:
                response = session.request(
                    method,
                    url,
                    headers=self._headers(),
                    json=payload,
                    timeout=NOTION_REQUEST_TIMEOUT_SECONDS,
                )
                response.raise_for_status()
                data = response.json()
                if not isinstance(data, dict):
                    raise RuntimeError("Unexpected Notion API response format.")
                return data
            except requests.exceptions.RequestException:
                if attempt >= NOTION_MAX_ATTEMPTS:
                    raise
                continue
        raise RuntimeError("Notion request retry loop exited unexpectedly.")

    def query_database(self, database_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
        return self.request("POST", f"/databases/{database_id}/query", body)

    def create_page(self, database_id: str, properties: Dict[str, Any]) -> Dict[str, Any]:
        return self.request("POST", "/pages", {"parent": {"database_id": database_id}, "properties": properties})

    def update_page(self, page_id: str, properties: Dict[str, Any]) -> Dict[str, Any]:
        return self.request("PATCH", f"/pages/{page_id}", {"properties": properties})

    def find_database_id_by_name(self, database_name: str) -> str:
        body = {"query": database_name, "filter": {"value": "database", "property": "object"}}
        data = self.request("POST", "/search", body)
        for item in data.get("results") or []:
            if not isinstance(item, dict):
                continue
            title_parts = item.get("title") or []
            title = ""
            if isinstance(title_parts, list) and title_parts:
                title = str((title_parts[0] or {}).get("plain_text", "")).strip()
            if title.lower() == database_name.lower():
                found = str(item.get("id", "")).strip()
                if found:
                    return found
        raise RuntimeError(f"Unable to find Notion database named '{database_name}'.")



def notion_rich_text(value: str) -> List[Dict[str, Any]]:
    text = str(value or "")
    if not text:
        return []
    return [{"type": "text", "text": {"content": text}}]


def notion_paragraph_block(text: str) -> Dict[str, Any]:
    return {"object": "block", "type": "paragraph", "paragraph": {"rich_text": notion_rich_text(text)}}


def paragraphs_to_notion_blocks(text: str) -> List[Dict[str, Any]]:
    body = str(text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not body:
        return []
    paragraphs = [paragraph.strip() for paragraph in body.split("\n\n") if paragraph.strip()]
    if not paragraphs:
        paragraphs = [body]
    return [notion_paragraph_block(paragraph) for paragraph in paragraphs]



def _notion_text_property(value: str) -> Dict[str, Any]:
    return {"rich_text": notion_rich_text(value)}



def _notion_title_property(value: str) -> Dict[str, Any]:
    return {"title": notion_rich_text(value)}



def _notion_select_property(value: str) -> Dict[str, Any]:
    return {"select": {"name": str(value or "").strip()}}



def _notion_checkbox_property(value: Any) -> Dict[str, Any]:
    return {"checkbox": bool(value)}



def _notion_date_property(value: str) -> Dict[str, Any]:
    text = str(value or "").strip()
    if not text:
        return {"date": None}
    return {"date": {"start": text}}



def _notion_url_property(value: str) -> Dict[str, Any]:
    text = str(value or "").strip()
    return {"url": text or None}


def _page_title_for_job(job: Dict[str, Any]) -> str:
    entry_id = str(job.get("entry_id", "")).strip()
    title = str(job.get("title", "")).strip()
    if not entry_id:
        return title
    if not title:
        return entry_id
    return f"{entry_id} - {title}"



def _resolve_database_id(client: NotionClient, target: Dict[str, Any]) -> str:
    database_id = str(target.get("database_id", "")).strip()
    if database_id:
        return database_id
    database_id_env = str(target.get("database_id_env", NOTION_DATABASE_ID)).strip() or NOTION_DATABASE_ID
    env_database_id = os.getenv(database_id_env, "").strip()
    if env_database_id:
        return env_database_id
    database_name = str(target.get("database_name", DEFAULT_NOTION_DATABASE_NAME)).strip() or DEFAULT_NOTION_DATABASE_NAME
    env_database_name = os.getenv(NOTION_DATABASE_NAME, "").strip()
    resolved_name = env_database_name or database_name
    finder = getattr(client, "find_database_id_by_name", None)
    if callable(finder):
        return finder(resolved_name)
    return resolved_name



def build_text_job_properties(job: Dict[str, Any], target: Dict[str, Any]) -> Dict[str, Any]:
    fields = dict(DEFAULT_NOTION_FIELDS)
    fields.update(dict(target.get("fields") or {}))
    return {fields["title"]: _notion_title_property(_page_title_for_job(job))}


def _list_block_children(client: NotionClient, block_id: str) -> List[Dict[str, Any]]:
    children: List[Dict[str, Any]] = []
    next_cursor: Optional[str] = None
    while True:
        query = "page_size=100"
        if next_cursor:
            query += f"&start_cursor={next_cursor}"
        data = client.request("GET", f"/blocks/{block_id}/children?{query}")
        for result in data.get("results") or []:
            if isinstance(result, dict):
                children.append(result)
        if not data.get("has_more"):
            break
        next_cursor = str(data.get("next_cursor", "")).strip() or None
    return children


def _archive_block(client: NotionClient, block_id: str) -> None:
    client.request("PATCH", f"/blocks/{block_id}", {"archived": True})


def _append_children(client: NotionClient, parent_id: str, children: Sequence[Dict[str, Any]]) -> None:
    if not children:
        return
    for offset in range(0, len(children), 100):
        batch = list(children[offset : offset + 100])
        client.request("PATCH", f"/blocks/{parent_id}/children", {"children": batch})


def replace_page_body(client: NotionClient, page_id: str, text: str) -> None:
    desired_children = paragraphs_to_notion_blocks(text)
    existing_children = _list_block_children(client, page_id)
    for child in existing_children:
        child_id = str(child.get("id", "")).strip()
        if child_id:
            _archive_block(client, child_id)
    if desired_children:
        _append_children(client, page_id, desired_children)



def _find_matching_page(client: NotionClient, database_id: str, entry_id: str, *, entry_id_field: str) -> Optional[Dict[str, Any]]:
    entry_id_field = str(entry_id_field or "").strip() or "Name"
    query_attempts = [
        {"property": entry_id_field, "title": {"starts_with": entry_id}},
        {"property": entry_id_field, "title": {"equals": entry_id}},
        {"property": entry_id_field, "rich_text": {"equals": entry_id}},
    ]
    if normalize_publish_key(entry_id_field) != "name":
        query_attempts.append({"property": "Name", "title": {"starts_with": entry_id}})

    last_error: Optional[Exception] = None
    for filter_body in query_attempts:
        try:
            data = client.query_database(database_id, {"page_size": 100, "filter": filter_body})
        except Exception as exc:
            last_error = exc
            continue
        for result in data.get("results") or []:
            if isinstance(result, dict):
                return result
        return None

    if last_error is not None:
        raise last_error
    return None



def upsert_text_jobs_to_notion(
    jobs: Sequence[Dict[str, Any]],
    *,
    client: Optional[NotionClient] = None,
    notion_token: Optional[str] = None,
) -> Dict[str, Any]:
    if client is None:
        token = notion_token or os.getenv(NOTION_TOKEN, "").strip()
        if not token:
            raise RuntimeError("Missing required environment variable: NOTION_TOKEN")
        client = NotionClient(token=token)

    created = 0
    updated = 0
    skipped = 0
    for job in jobs:
        target = dict(job.get("notion_target") or {})
        database_id = _resolve_database_id(client, target)
        fields = dict(DEFAULT_NOTION_FIELDS)
        fields.update(dict(target.get("fields") or {}))
        entry_id_field = fields["entry_id"]
        existing = _find_matching_page(client, database_id, str(job["entry_id"]), entry_id_field=entry_id_field)
        properties = build_text_job_properties(job, target)
        if existing and existing.get("id"):
            page_id = str(existing["id"])
            client.update_page(page_id, properties)
            replace_page_body(client, page_id, str(job.get("text", "")))
            updated += 1
        else:
            created_page = client.create_page(database_id, properties)
            page_id = str(created_page.get("id", "")).strip()
            if page_id:
                replace_page_body(client, page_id, str(job.get("text", "")))
            created += 1
    return {"created": created, "updated": updated, "skipped": skipped, "count": len(jobs)}



def build_notion_client(token: Optional[str] = None) -> NotionClient:
    resolved = token or os.getenv(NOTION_TOKEN, "").strip()
    if not resolved:
        raise RuntimeError("Missing required environment variable: NOTION_TOKEN")
    return NotionClient(token=resolved)
