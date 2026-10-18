from __future__ import annotations

import datetime as _dt
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, Optional
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_STATE_PATH = ROOT / ".cache" / "publish_state" / "state.json"
STATE_SCHEMA_VERSION = 1
DEFAULT_STATE_TIMEZONE = "America/Chicago"


def _empty_state(local_date: str) -> Dict[str, Any]:
    return {
        "schema_version": STATE_SCHEMA_VERSION,
        "reset_date": local_date,
        "completions": {},
        "episodes": {},
    }


def load_publish_state(path: Optional[Path] = None) -> Dict[str, Any]:
    state_path = Path(path or DEFAULT_STATE_PATH)
    if not state_path.exists():
        return _empty_state(_dt.datetime.now(ZoneInfo(DEFAULT_STATE_TIMEZONE)).date().isoformat())
    try:
        payload = json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Unable to read publish state '{state_path}': {exc}") from exc
    if not isinstance(payload, dict) or payload.get("schema_version") != STATE_SCHEMA_VERSION:
        raise RuntimeError(f"Unsupported or invalid publish state file: {state_path}")
    if not isinstance(payload.get("completions"), dict) or not isinstance(payload.get("episodes"), dict):
        raise RuntimeError(f"Invalid publish state structure in {state_path}: completions and episodes must be objects.")
    return payload


def _completion_key(job: Mapping[str, Any]) -> str:
    return f"{str(job.get('contract_id', '')).strip()}:{str(job.get('entry_id', '')).strip()}"


def _record_for_job(job: Mapping[str, Any], existing: Mapping[str, Any]) -> Dict[str, Any]:
    migrated = job.get("episode_state")
    record = dict(existing)
    if isinstance(migrated, dict):
        record.update(migrated)
    record.update({
        "entry_id": str(job.get("entry_id", "")).strip(),
        "episode_id": str(job.get("episode_id", "")).strip() or str(job.get("entry_id", "")).strip(),
        "contract_id": str(job.get("contract_id", "")).strip(),
        "date": str(job.get("published_date", job.get("date", ""))).strip(),
        "status": str(job.get("status", "approved")).strip(),
        "title": str(job.get("title", "")).strip(),
        "description": str(job.get("description", "")).strip(),
        "text": str(job.get("text", record.get("text", ""))),
        "text_hash": str(job.get("text_hash", record.get("text_hash", ""))).strip(),
        "audio_enabled": bool(dict(job.get("audio_config") or {}).get("enabled", record.get("audio_enabled", False))),
        "audio_url": str(job.get("audio_url", record.get("audio_url", ""))).strip(),
        "audio_path": str(job.get("audio_path", record.get("audio_path", ""))).strip(),
        "content_hash": str(job.get("content_hash", record.get("content_hash", ""))).strip(),
    })
    return record


def _atomic_write(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def update_publish_state(
    jobs: Iterable[Mapping[str, Any]],
    *,
    path: Optional[Path] = None,
    completion_keys: Iterable[str] = (),
    local_date: Optional[_dt.date] = None,
) -> Dict[str, Any]:
    state_path = Path(path or DEFAULT_STATE_PATH)
    today = (local_date or _dt.datetime.now(ZoneInfo(DEFAULT_STATE_TIMEZONE)).date()).isoformat()
    state = load_publish_state(state_path) if state_path.exists() else _empty_state(today)
    if state.get("reset_date") != today:
        state["reset_date"] = today
        state["completions"] = {}
    for key in completion_keys:
        normalized = str(key).strip()
        if normalized:
            state["completions"].setdefault(normalized, False)
    count = 0
    for job in jobs:
        entry_key = _completion_key(job)
        if entry_key != ":":
            state["completions"].setdefault(entry_key, False)
        episode_id = str(job.get("episode_id", "")).strip() or str(job.get("entry_id", "")).strip()
        if not episode_id:
            raise RuntimeError("Cannot write publish state for a job without episode_id or entry_id.")
        state["episodes"][episode_id] = _record_for_job(job, state["episodes"].get(episode_id) or {})
        count += 1
    _atomic_write(state_path, state)
    return {"state_path": str(state_path), "episodes_updated": count, "reset_date": today}


def contract_completion_keys(contracts: Iterable[Any]) -> list[str]:
    keys: list[str] = []
    for contract in contracts:
        for entry in contract.entries:
            if entry.get("status") == "approved":
                keys.append(f"{contract.contract_id}:{entry.get('entry_id', '')}")
    return keys
