import os
import sys
import time
from typing import Any, Dict, List, Optional

import requests

NOTION_VERSION = "2022-06-28"
NOTION_REQUEST_TIMEOUT_SECONDS = 30
NOTION_MAX_ATTEMPTS = 5
NOTION_RETRYABLE_STATUSES = {408, 409, 429, 500, 502, 503, 504}

NOTION_TOKEN = "NOTION_TOKEN"
NOTION_DATABASE_ID = "NOTION_DATABASE_ID"
NOTION_DATABASE_NAME = "NOTION_DATABASE_NAME"  # fallback search; defaults to Opus Dei
NOTION_COMPLETED_PROPERTY = "NOTION_COMPLETED_PROPERTY"  # defaults to Completed


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def notion_headers(token: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
    }


def notion_should_retry(exc: requests.exceptions.RequestException) -> bool:
    if isinstance(exc, (requests.exceptions.Timeout, requests.exceptions.ConnectionError)):
        return True
    if isinstance(exc, requests.exceptions.HTTPError):
        response = exc.response
        return bool(response is not None and response.status_code in NOTION_RETRYABLE_STATUSES)
    return False


def notion_retry_delay_seconds(exc: requests.exceptions.RequestException, attempt: int) -> float:
    if isinstance(exc, requests.exceptions.HTTPError) and exc.response is not None:
        retry_after = str(exc.response.headers.get("Retry-After", "")).strip()
        if retry_after:
            try:
                return max(0.0, float(retry_after))
            except ValueError:
                pass
    return min(30.0, float(2 ** max(attempt - 1, 0)))


def notion_call(method: str, url: str, token: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    for attempt in range(1, NOTION_MAX_ATTEMPTS + 1):
        try:
            response = requests.request(
                method,
                url,
                headers=notion_headers(token),
                json=payload,
                timeout=NOTION_REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                raise RuntimeError("Unexpected Notion API response format.")
            return data
        except requests.exceptions.RequestException as exc:
            if attempt >= NOTION_MAX_ATTEMPTS or not notion_should_retry(exc):
                raise
            delay = notion_retry_delay_seconds(exc, attempt)
            print(
                f"WARN notion_retry attempt={attempt} delay={delay:.1f}s method={method} url={url}",
                file=sys.stderr,
            )
            time.sleep(delay)
    raise RuntimeError("Notion request retry loop exited unexpectedly.")


def lookup_notion_database_id(token: str) -> str:
    db_id = os.getenv(NOTION_DATABASE_ID, "").strip()
    if db_id:
        return db_id

    db_name = os.getenv(NOTION_DATABASE_NAME, "Opus Dei").strip() or "Opus Dei"
    body = {"query": db_name, "filter": {"value": "database", "property": "object"}}
    data = notion_call("POST", "https://api.notion.com/v1/search", token, body)
    results = data.get("results") or []
    for item in results:
        if not isinstance(item, dict):
            continue
        title = ""
        title_parts = item.get("title") or []
        if isinstance(title_parts, list) and title_parts:
            title = str((title_parts[0] or {}).get("plain_text", "")).strip()
        if title.lower() == db_name.lower():
            found = str(item.get("id", "")).strip()
            if found:
                return found
    for item in results:
        if not isinstance(item, dict):
            continue
        found = str(item.get("id", "")).strip()
        if found:
            return found
    raise RuntimeError("Could not find Notion database. Set NOTION_DATABASE_ID or check NOTION_DATABASE_NAME + sharing.")


def notion_get_all_pages(database_id: str, token: str) -> List[Dict[str, Any]]:
    pages: List[Dict[str, Any]] = []
    next_cursor: Optional[str] = None
    while True:
        body: Dict[str, Any] = {"page_size": 100}
        if next_cursor:
            body["start_cursor"] = next_cursor
        data = notion_call("POST", f"https://api.notion.com/v1/databases/{database_id}/query", token, body)
        results = data.get("results") or []
        for result in results:
            if isinstance(result, dict):
                pages.append(result)
        if not data.get("has_more"):
            break
        next_cursor = str(data.get("next_cursor", "")).strip() or None
    return pages


def page_checkbox(page: Dict[str, Any], checkbox_property: str) -> Optional[bool]:
    props = page.get("properties") or {}
    prop = props.get(checkbox_property) or {}
    if prop.get("type") != "checkbox":
        return None
    return bool(prop.get("checkbox"))


def update_page_checkbox(page_id: str, checkbox_property: str, value: bool, token: str) -> None:
    body = {"properties": {checkbox_property: {"checkbox": value}}}
    notion_call("PATCH", f"https://api.notion.com/v1/pages/{page_id}", token, body)


def main() -> int:
    try:
        notion_token = require_env(NOTION_TOKEN)
        db_id = lookup_notion_database_id(notion_token)
        completed_property = os.getenv(NOTION_COMPLETED_PROPERTY, "Completed").strip() or "Completed"

        pages = notion_get_all_pages(db_id, notion_token)
        unchecked = 0
        scanned = 0
        for page in pages:
            scanned += 1
            checked = page_checkbox(page, completed_property)
            if checked is None:
                raise RuntimeError(
                    f"Property '{completed_property}' is missing or not a checkbox in at least one row."
                )
            if not checked:
                continue
            page_id = str(page.get("id", "")).strip()
            if not page_id:
                continue
            update_page_checkbox(page_id, completed_property, False, notion_token)
            unchecked += 1

        print(f"SUMMARY notion_db={db_id} rows_scanned={scanned} rows_unchecked={unchecked}")
        return 0
    except requests.HTTPError as exc:
        print(f"ERROR HTTP failure: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
