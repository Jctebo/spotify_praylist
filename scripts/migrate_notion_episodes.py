from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.publish.notion import NotionClient

CONTRACT_DIR = ROOT / "config" / "publish" / "contracts"
DEFAULT_DATABASE_NAME = "Opus Dei"
PROPERTY_NAMES = {
    "entry_id": "Entry ID",
    "date": "Date",
    "status": "Status",
    "text": "Text",
    "text_hash": "Text Hash",
    "audio_enabled": "Audio Enabled",
    "audio_url": "Audio URL",
    "audio_path": "Audio Path",
    "content_hash": "Content Hash",
}


def _property_value(prop: Any) -> Any:
    if not isinstance(prop, dict):
        return ""
    if "title" in prop or "rich_text" in prop:
        chunks = prop.get("title", prop.get("rich_text", [])) or []
        return "".join(str(item.get("plain_text", item.get("text", {}).get("content", ""))) for item in chunks if isinstance(item, dict))
    if "select" in prop:
        selected = prop.get("select")
        return str(selected.get("name", "")) if isinstance(selected, dict) else ""
    if "date" in prop:
        dated = prop.get("date")
        return str(dated.get("start", "")) if isinstance(dated, dict) else ""
    if "checkbox" in prop:
        return bool(prop.get("checkbox"))
    if "url" in prop:
        return str(prop.get("url") or "")
    if "number" in prop:
        return prop.get("number")
    return ""


def _read_row(page: Dict[str, Any]) -> Dict[str, Any]:
    props = page.get("properties")
    if not isinstance(props, dict):
        raise RuntimeError(f"Notion page {page.get('id', '<unknown>')} has no properties object.")
    missing_properties = sorted(set(PROPERTY_NAMES.values()) - set(props))
    if missing_properties:
        available = ", ".join(sorted(str(name) for name in props)) or "<none>"
        raise RuntimeError(
            f"Notion page {page.get('id', '<unknown>')} does not match the episode database schema; "
            f"missing properties: {', '.join(missing_properties)}. Available: {available}."
        )
    values = {key: _property_value(props.get(name)) for key, name in PROPERTY_NAMES.items()}
    values["entry_id"] = str(values["entry_id"]).strip()
    if not values["entry_id"]:
        raise RuntimeError(f"Notion page {page.get('id', '<unknown>')} is missing Entry ID.")
    values["audio_enabled"] = bool(values["audio_enabled"])
    return values


def fetch_all_pages(client: NotionClient, database_id: str) -> List[Dict[str, Any]]:
    pages: List[Dict[str, Any]] = []
    cursor: Optional[str] = None
    while True:
        body: Dict[str, Any] = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        response = client.query_database(database_id, body)
        results = response.get("results")
        if not isinstance(results, list):
            raise RuntimeError("Notion database query returned no results array.")
        pages.extend(item for item in results if isinstance(item, dict))
        if not response.get("has_more"):
            return pages
        cursor = str(response.get("next_cursor") or "").strip()
        if not cursor:
            raise RuntimeError("Notion database response says has_more but provides no next_cursor.")


def _load_contract_payloads(contract_dir: Path) -> Dict[Path, Dict[str, Any]]:
    payloads: Dict[Path, Dict[str, Any]] = {}
    for path in sorted(contract_dir.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict) or not isinstance(payload.get("entries"), list):
            raise RuntimeError(f"Invalid publish contract structure in {path}.")
        payloads[path] = payload
    if not payloads:
        raise RuntimeError(f"No publish contract files found in {contract_dir}.")
    return payloads


def migrate_rows(rows: Iterable[Dict[str, Any]], *, contract_dir: Path = CONTRACT_DIR, write: bool = True) -> Dict[Path, Dict[str, Any]]:
    payloads = _load_contract_payloads(contract_dir)
    entry_lookup: Dict[str, tuple[Path, Dict[str, Any]]] = {}
    for path, payload in payloads.items():
        for entry in payload["entries"]:
            entry_id = str(entry.get("entry_id", "")).strip()
            if not entry_id:
                raise RuntimeError(f"Contract entry in {path} has no entry_id.")
            if entry_id in entry_lookup:
                raise RuntimeError(f"Duplicate contract entry_id '{entry_id}'.")
            entry_lookup[entry_id] = (path, entry)

    seen: set[str] = set()
    for row in rows:
        entry_id = str(row.get("entry_id", "")).strip()
        if not entry_id:
            raise RuntimeError("Exported Notion row is missing Entry ID.")
        if entry_id in seen:
            raise RuntimeError(f"Duplicate Notion Entry ID '{entry_id}'.")
        seen.add(entry_id)
        if entry_id not in entry_lookup:
            raise RuntimeError(f"No publish contract entry matches Notion Entry ID '{entry_id}'.")
        _, entry = entry_lookup[entry_id]
        entry["episode_state"] = {key: row.get(key, "") for key in PROPERTY_NAMES}
        entry["episode_state"]["audio_enabled"] = bool(row.get("audio_enabled", False))

    if write:
        _write_contracts(payloads)
    return payloads


def _write_contracts(payloads: Dict[Path, Dict[str, Any]]) -> None:
    staged: List[tuple[Path, Path]] = []
    try:
        for path, payload in payloads.items():
            descriptor, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
            temp_path = Path(temp_name)
            with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
                json.dump(payload, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
            staged.append((temp_path, path))
        for temp_path, path in staged:
            os.replace(temp_path, path)
    finally:
        for temp_path, _ in staged:
            if temp_path.exists():
                temp_path.unlink()


def run_migration(*, client: NotionClient, database_id: str, contract_dir: Path = CONTRACT_DIR) -> int:
    pages = fetch_all_pages(client, database_id)
    rows = [_read_row(page) for page in pages]
    migrate_rows(rows, contract_dir=contract_dir)
    return len(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="One-time export of Opus Dei episode rows into local publish contracts.")
    parser.add_argument("--database-id", default=os.getenv("NOTION_PUBLISH_DATABASE_ID"))
    parser.add_argument("--database-name", default=os.getenv("NOTION_DATABASE_NAME", DEFAULT_DATABASE_NAME))
    args = parser.parse_args()
    token = os.getenv("NOTION_TOKEN", "").strip()
    if not token:
        parser.error("NOTION_TOKEN is required for this one-time migration.")
    client = NotionClient(token=token)
    database_id = str(args.database_id or "").strip()
    if not database_id:
        database_id = client.find_database_id_by_name(args.database_name)
    try:
        count = run_migration(client=client, database_id=database_id)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(f"migrated_notion_episode_rows={count} database={args.database_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
