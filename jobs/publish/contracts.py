from __future__ import annotations

import datetime as _dt
import json
import re
from pathlib import Path
from typing import Any, Dict, List, NamedTuple, Optional, Sequence, Tuple
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONTRACT_DIR = ROOT / "config" / "publish" / "contracts"
DEFAULT_GITHUB_PAGES_BASE_URL = "https://jctebo.github.io/spotify_praylist"
DEFAULT_NOTION_DATABASE_NAME = "Opus Dei"
DEFAULT_NOTION_FIELDS = {
    "entry_id": "Entry ID",
    "title": "Title",
    "date": "Date",
    "status": "Status",
    "frequency": "Frequency",
    "contract": "Contract",
    "text": "Text",
    "text_hash": "Text Hash",
    "audio_enabled": "Audio Enabled",
    "audio_url": "Audio URL",
    "audio_path": "Audio Path",
    "content_hash": "Content Hash",
}
DEFAULT_AUDIO_SETTINGS = {
    "enabled": False,
    "model": "gpt-4o-mini-tts",
    "voice": "alloy",
    "format": "mp3",
    "speed": 1.0,
}

VALID_STATUS_VALUES = {"approved", "skipped"}
VALID_SELECTOR_VALUES = {"current_calendar_month", "weekday", "date", "entry_id", "title", "contract_id"}


class PublishContract(NamedTuple):
    contract_id: str
    contract_type: str
    frequency: str
    timezone: str
    version: str
    notion_target: Dict[str, Any]
    audio_target: Dict[str, Any]
    metadata: Dict[str, Any]
    entries: Tuple[Dict[str, Any], ...]
    source_path: Path



def normalize_publish_key(value: Any) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower())).strip("-")



def _load_payload(path: Path, label: str) -> Dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except FileNotFoundError as exc:
        raise RuntimeError(f"{label} file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Invalid JSON in {label} '{path}': {exc.msg} (line {exc.lineno}, column {exc.colno})."
        ) from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"Invalid {label} '{path}': root must be a JSON object.")
    return payload



def _require_text(payload: Dict[str, Any], field_name: str, path: Path, label: str) -> str:
    value = str(payload.get(field_name, "")).strip()
    if not value:
        raise RuntimeError(f"{label} '{path}' is missing required field '{field_name}'.")
    return value



def _optional_text(payload: Dict[str, Any], field_name: str, default: str = "") -> str:
    value = payload.get(field_name, default)
    return str(value).strip() if value is not None else ""



def _optional_dict(payload: Dict[str, Any], field_name: str, default: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    value = payload.get(field_name, default or {})
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise RuntimeError(f"Expected '{field_name}' to be a JSON object.")
    return dict(value)



def _optional_list(payload: Dict[str, Any], field_name: str) -> List[Any]:
    value = payload.get(field_name)
    if value is None:
        return []
    if not isinstance(value, list):
        raise RuntimeError(f"Expected '{field_name}' to be a JSON array.")
    return list(value)



def _normalize_frequency(value: Any, path: Path) -> str:
    frequency = str(value or "").strip().lower()
    if not frequency:
        raise RuntimeError(f"Publish contract '{path}' is missing required field 'frequency'.")
    return frequency



def _normalize_timezone(value: Any, path: Path) -> str:
    timezone = str(value or "").strip()
    if not timezone:
        raise RuntimeError(f"Publish contract '{path}' is missing required field 'timezone'.")
    return timezone



def _normalize_status(value: Any, path: Path, entry_id: str) -> str:
    status = str(value or "").strip().lower()
    if not status:
        raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' is missing required field 'status'.")
    if status not in VALID_STATUS_VALUES:
        valid = ", ".join(sorted(VALID_STATUS_VALUES))
        raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' has invalid status '{status}'. Use one of: {valid}.")
    return status



def _normalize_text_config(payload: Dict[str, Any]) -> Dict[str, Any]:
    text_config = dict(payload.get("text_config") or {}) if isinstance(payload.get("text_config"), dict) else {}
    if "enabled" not in text_config:
        text_config["enabled"] = True
    else:
        text_config["enabled"] = bool(text_config.get("enabled"))
    return text_config



def _normalize_audio_config(payload: Dict[str, Any]) -> Dict[str, Any]:
    audio_config = dict(payload.get("audio_config") or {}) if isinstance(payload.get("audio_config"), dict) else {}
    for key, value in DEFAULT_AUDIO_SETTINGS.items():
        if key not in audio_config:
            audio_config[key] = value
    audio_config["enabled"] = bool(audio_config.get("enabled", False))
    audio_config["model"] = str(audio_config.get("model", DEFAULT_AUDIO_SETTINGS["model"])).strip() or DEFAULT_AUDIO_SETTINGS["model"]
    audio_config["voice"] = str(audio_config.get("voice", DEFAULT_AUDIO_SETTINGS["voice"])).strip() or DEFAULT_AUDIO_SETTINGS["voice"]
    audio_config["format"] = str(audio_config.get("format", DEFAULT_AUDIO_SETTINGS["format"])).strip().lower() or DEFAULT_AUDIO_SETTINGS["format"]
    try:
        audio_config["speed"] = float(audio_config.get("speed", DEFAULT_AUDIO_SETTINGS["speed"]))
    except Exception:
        audio_config["speed"] = float(DEFAULT_AUDIO_SETTINGS["speed"])
    return audio_config



def _normalize_block(block: Any, path: Path, entry_id: str) -> Dict[str, Any]:
    if isinstance(block, str):
        return {"kind": "inline", "text": block}
    if not isinstance(block, dict):
        raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' contains an invalid block; expected an object.")
    kind = normalize_publish_key(block.get("kind"))
    if not kind:
        raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' contains a block missing 'kind'.")
    normalized = dict(block)
    normalized["kind"] = kind
    if kind == "sequence":
        normalized["blocks"] = [_normalize_block(item, path, entry_id) for item in _optional_list(normalized, "blocks")]
        if not normalized["blocks"]:
            raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' has an empty sequence block.")
    elif kind == "repeat":
        child = normalized.get("block") or normalized.get("item")
        if child is None:
            raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' has a repeat block without a child block.")
        try:
            count = int(normalized.get("count", 0))
        except Exception:
            count = 0
        if count <= 0:
            raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' has a repeat block with an invalid count.")
        normalized["count"] = count
        normalized["block"] = _normalize_block(child, path, entry_id)
    elif kind == "weekday-map":
        mapping = normalized.get("map") or normalized.get("values")
        if not isinstance(mapping, dict) or not mapping:
            raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' has a weekday_map block without values.")
        normalized["map"] = {str(key).strip().lower(): _normalize_block(value, path, entry_id) for key, value in mapping.items()}
        selector = str(normalized.get("selector", "weekday")).strip().lower() or "weekday"
        normalized["selector"] = selector
    elif kind == "monthly-template":
        folder = str(normalized.get("folder", "")).strip()
        if not folder:
            raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' has a monthly_template block without 'folder'.")
        normalized["folder"] = folder
        selector = str(normalized.get("selector", "current_calendar_month")).strip().lower() or "current_calendar_month"
        normalized["selector"] = selector
    elif kind == "file":
        file_path = str(normalized.get("path", "")).strip()
        if not file_path:
            raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' has a file block without 'path'.")
        normalized["path"] = file_path
    elif kind == "inline":
        normalized["text"] = str(normalized.get("text", ""))
    else:
        raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' uses unsupported block kind '{kind}'.")
    return normalized



def _normalize_entry(entry: Any, path: Path) -> Dict[str, Any]:
    if not isinstance(entry, dict):
        raise RuntimeError(f"Publish contract '{path}' contains an invalid entry; expected an object.")
    entry_id = _require_text(entry, "entry_id", path, "Publish entry")
    normalized = dict(entry)
    normalized["entry_id"] = entry_id
    normalized["date"] = _optional_text(entry, "date") or "daily"
    normalized["title"] = _require_text(entry, "title", path, "Publish entry")
    normalized["status"] = _normalize_status(entry.get("status"), path, entry_id)
    normalized["text"] = _optional_text(entry, "text") or normalized["title"]
    normalized["text_config"] = _normalize_text_config(entry)
    normalized["audio_config"] = _normalize_audio_config(entry)
    blocks = _optional_list(entry, "blocks")
    normalized["blocks"] = [_normalize_block(block, path, entry_id) for block in blocks]
    if not normalized["blocks"] and not normalized["text"]:
        raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' must define either 'text' or 'blocks'.")
    return normalized



def _normalize_target(payload: Dict[str, Any]) -> Dict[str, Any]:
    target = _optional_dict(payload, "notion_target", {})
    target.setdefault("database_name", DEFAULT_NOTION_DATABASE_NAME)
    target.setdefault("fields", dict(DEFAULT_NOTION_FIELDS))
    target.setdefault("database_id_env", "NOTION_PUBLISH_DATABASE_ID")
    return target



def _normalize_audio_target(payload: Dict[str, Any]) -> Dict[str, Any]:
    audio_target = _optional_dict(payload, "audio_target", {})
    audio_target.setdefault("docs_root", "docs")
    audio_target.setdefault("audio_dir", "docs/audio")
    audio_target.setdefault("feed_path", "docs/podcast.xml")
    audio_target.setdefault("public_base_url", DEFAULT_GITHUB_PAGES_BASE_URL)
    return audio_target



def validate_publish_contract(contract: Dict[str, Any], *, source: str, source_path: Optional[Path] = None) -> None:
    if not isinstance(contract, dict):
        raise RuntimeError(f"Invalid publish contract in {source}: root must be an object.")
    contract_root = contract.get("contract")
    if not isinstance(contract_root, dict):
        raise RuntimeError(f"Invalid publish contract in {source}: missing 'contract' object.")
    contract_id = _require_text(contract_root, "id", Path(source), "Publish contract")
    _require_text(contract_root, "type", Path(source), "Publish contract")
    _normalize_frequency(contract_root.get("frequency"), Path(source))
    _normalize_timezone(contract_root.get("timezone"), Path(source))
    _require_text(contract_root, "version", Path(source), "Publish contract")
    entries = contract.get("entries")
    if not isinstance(entries, list) or not entries:
        raise RuntimeError(f"Invalid publish contract '{source}': missing or empty 'entries' array.")

    seen_entry_ids: Dict[str, str] = {}
    for raw_entry in entries:
        entry = _normalize_entry(raw_entry, Path(source))
        entry_key = normalize_publish_key(entry["entry_id"])
        if not entry_key:
            raise RuntimeError(f"Publish entry in '{source}' has an invalid 'entry_id'.")
        duplicate_source = seen_entry_ids.get(entry_key)
        if duplicate_source:
            raise RuntimeError(
                f"Duplicate publish entry_id '{entry['entry_id']}' in '{duplicate_source}' and '{source}'."
            )
        seen_entry_ids[entry_key] = source
        _validate_entry_blocks(entry.get("blocks") or [], Path(source), entry["entry_id"])



def _validate_entry_blocks(blocks: Sequence[Dict[str, Any]], path: Path, entry_id: str) -> None:
    for block in blocks:
        kind = normalize_publish_key(block.get("kind"))
        if kind == "sequence":
            _validate_entry_blocks(block.get("blocks") or [], path, entry_id)
        elif kind == "repeat":
            _validate_entry_blocks([block.get("block")], path, entry_id)
        elif kind == "weekday-map":
            mapping = block.get("map") or {}
            for nested in mapping.values():
                _validate_entry_blocks([nested], path, entry_id)
        elif kind == "file":
            file_path = str(block.get("path", "")).strip()
            resolved_path = Path(file_path)
            if not resolved_path.is_absolute():
                resolved_path = ROOT / resolved_path
            if not resolved_path.exists():
                raise RuntimeError(
                    f"Publish entry '{entry_id}' in '{path}' references missing template file '{resolved_path}'."
                )
        elif kind == "monthly-template":
            folder_path = str(block.get("folder", "")).strip()
            resolved_folder = Path(folder_path)
            if not resolved_folder.is_absolute():
                resolved_folder = ROOT / resolved_folder
            if not resolved_folder.exists():
                raise RuntimeError(
                    f"Publish entry '{entry_id}' in '{path}' references missing monthly template folder '{resolved_folder}'."
                )
        elif kind == "inline":
            continue
        else:
            raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' uses unsupported block kind '{kind}'.")



def load_publish_contracts(contract_dir: Optional[Path] = None) -> List[PublishContract]:
    base_dir = Path(contract_dir) if contract_dir else DEFAULT_CONTRACT_DIR
    if not base_dir.exists():
        raise RuntimeError(f"Publish contract directory not found: {base_dir}")

    contract_files = sorted(path for path in base_dir.glob("*.json") if path.is_file())
    if not contract_files:
        raise RuntimeError(f"No publish contract files found in {base_dir}.")

    contracts: List[PublishContract] = []
    seen_contract_ids: Dict[str, Path] = {}
    seen_entry_ids: Dict[str, Path] = {}

    for contract_path in contract_files:
        payload = _load_payload(contract_path, "Publish contract")
        validate_publish_contract(payload, source=str(contract_path), source_path=contract_path)
        contract_root = payload["contract"]
        contract_id = normalize_publish_key(_require_text(contract_root, "id", contract_path, "Publish contract"))
        if not contract_id:
            raise RuntimeError(f"Publish contract '{contract_path}' has an invalid 'id'.")
        duplicate_contract = seen_contract_ids.get(contract_id)
        if duplicate_contract:
            raise RuntimeError(f"Duplicate publish contract id '{contract_id}' in '{duplicate_contract}' and '{contract_path}'.")

        normalized_entries = tuple(_normalize_entry(entry, contract_path) for entry in payload.get("entries") or [])
        for entry in normalized_entries:
            entry_key = normalize_publish_key(entry["entry_id"])
            duplicate_entry = seen_entry_ids.get(entry_key)
            if duplicate_entry:
                raise RuntimeError(
                    f"Duplicate publish entry_id '{entry['entry_id']}' in '{duplicate_entry}' and '{contract_path}'."
                )
            seen_entry_ids[entry_key] = contract_path

        seen_contract_ids[contract_id] = contract_path
        contracts.append(
            PublishContract(
                contract_id=contract_id,
                contract_type=str(contract_root.get("type", "")).strip().lower(),
                frequency=_normalize_frequency(contract_root.get("frequency"), contract_path),
                timezone=_normalize_timezone(contract_root.get("timezone"), contract_path),
                version=_require_text(contract_root, "version", contract_path, "Publish contract"),
                notion_target=_normalize_target(contract_root),
                audio_target=_normalize_audio_target(contract_root),
                metadata=dict(contract_root.get("metadata") or {}),
                entries=normalized_entries,
                source_path=contract_path,
            )
        )

    contracts.sort(key=lambda contract: (normalize_publish_key(contract.contract_id), contract.source_path.name))
    return contracts



def _local_date_for_timezone(timezone: str) -> _dt.date:
    try:
        zone = ZoneInfo(timezone)
    except Exception:
        zone = _dt.timezone.utc
    return _dt.datetime.now(zone).date()



def evaluate_selector(selector: Any, *, target_date: Optional[_dt.date] = None, timezone: str = "UTC", contract: Optional[PublishContract] = None, entry: Optional[Dict[str, Any]] = None) -> str:
    date_value = target_date or _local_date_for_timezone(timezone)
    if isinstance(selector, dict):
        selector_type = normalize_publish_key(selector.get("type") or selector.get("kind") or selector.get("selector"))
        if selector_type:
            selector = selector_type
        elif "value" in selector:
            return str(selector.get("value", "")).strip()
        else:
            return ""
    selector_name = str(selector or "").strip().lower()
    if selector_name in {"weekday", "current_weekday"}:
        return date_value.strftime("%A").lower()
    if selector_name in {"current_calendar_month", "month"}:
        return date_value.strftime("%B").lower()
    if selector_name == "date":
        return date_value.isoformat()
    if selector_name == "entry_id" and entry is not None:
        return str(entry.get("entry_id", "")).strip()
    if selector_name == "title" and entry is not None:
        return str(entry.get("title", "")).strip()
    if selector_name == "contract_id" and contract is not None:
        return str(contract.contract_id).strip()
    if selector_name in VALID_SELECTOR_VALUES:
        return selector_name
    return str(selector or "").strip()



def _read_text_file(path_text: str) -> str:
    path = Path(path_text)
    if not path.is_absolute():
        path = ROOT / path
    if not path.exists():
        raise RuntimeError(f"Publish template file not found: {path}")
    return path.read_text(encoding="utf-8").strip()



def resolve_block_content(
    block: Any,
    *,
    contract: PublishContract,
    entry: Dict[str, Any],
    target_date: Optional[_dt.date] = None,
) -> str:
    if isinstance(block, str):
        return block.strip()
    if not isinstance(block, dict):
        raise RuntimeError(f"Publish entry '{entry.get('entry_id', '')}' uses an invalid block.")

    kind = normalize_publish_key(block.get("kind"))
    effective_date = target_date or _local_date_for_timezone(contract.timezone)

    if kind == "inline":
        return str(block.get("text", "")).strip()
    if kind == "file":
        return _read_text_file(str(block.get("path", "")).strip())
    if kind == "monthly-template":
        month_name = evaluate_selector(block.get("selector", "current_calendar_month"), target_date=effective_date, timezone=contract.timezone, contract=contract, entry=entry)
        folder = str(block.get("folder", "")).strip()
        template_path = Path(folder)
        if not template_path.is_absolute():
            template_path = ROOT / template_path
        template_file = template_path / f"{month_name}.txt"
        return _read_text_file(str(template_file))
    if kind == "weekday-map":
        weekday = evaluate_selector(block.get("selector", "weekday"), target_date=effective_date, timezone=contract.timezone, contract=contract, entry=entry)
        mapping = block.get("map") or {}
        chosen = mapping.get(weekday.lower()) or mapping.get(weekday.title())
        if chosen is None:
            raise RuntimeError(f"Publish entry '{entry.get('entry_id', '')}' has no weekday_map entry for '{weekday}'.")
        return resolve_block_content(chosen, contract=contract, entry=entry, target_date=effective_date)
    if kind == "sequence":
        children = [resolve_block_content(child, contract=contract, entry=entry, target_date=effective_date) for child in block.get("blocks", [])]
        children = [child for child in children if child.strip()]
        separator = str(block.get("separator", "\n\n"))
        return separator.join(children).strip()
    if kind == "repeat":
        repeated = resolve_block_content(block.get("block"), contract=contract, entry=entry, target_date=effective_date)
        separator = str(block.get("separator", "\n"))
        count = int(block.get("count", 0))
        return separator.join(repeated for _ in range(count)).strip()
    raise RuntimeError(f"Publish entry '{entry.get('entry_id', '')}' uses unsupported block kind '{kind}'.")



def _entry_text_body(contract: PublishContract, entry: Dict[str, Any], *, target_date: Optional[_dt.date] = None) -> str:
    blocks = entry.get("blocks") or []
    if blocks:
        parts = [resolve_block_content(block, contract=contract, entry=entry, target_date=target_date) for block in blocks]
        parts = [part.strip() for part in parts if part.strip()]
        return "\n\n".join(parts).strip()
    return str(entry.get("text", "")).strip()



def _text_hash(text: str) -> str:
    import hashlib

    return hashlib.sha256(text.encode("utf-8")).hexdigest()



def build_text_jobs(contracts: Sequence[PublishContract], *, target_date: Optional[_dt.date] = None) -> List[Dict[str, Any]]:
    jobs: List[Dict[str, Any]] = []
    for contract in contracts:
        effective_date = target_date or _local_date_for_timezone(contract.timezone)
        for entry in contract.entries:
            if entry.get("status") != "approved":
                continue
            text_config = dict(entry.get("text_config") or {})
            if not bool(text_config.get("enabled", True)):
                continue
            text_body = _entry_text_body(contract, entry, target_date=effective_date)
            if not text_body.strip():
                continue
            jobs.append(
                {
                    "entry_id": entry["entry_id"],
                    "contract_id": contract.contract_id,
                    "contract_type": contract.contract_type,
                    "frequency": contract.frequency,
                    "timezone": contract.timezone,
                    "version": contract.version,
                    "title": entry["title"],
                    "date": str(entry.get("date", "daily")).strip() or "daily",
                    "status": entry["status"],
                    "text": text_body,
                    "text_hash": _text_hash(text_body),
                    "text_config": text_config,
                    "audio_config": dict(entry.get("audio_config") or {}),
                    "notion_target": dict(contract.notion_target),
                    "audio_target": dict(contract.audio_target),
                    "metadata": dict(contract.metadata),
                    "source_path": str(contract.source_path),
                }
            )
    return jobs



def resolve_text_jobs(contracts: Sequence[PublishContract], *, target_date: Optional[_dt.date] = None) -> List[Dict[str, Any]]:
    return build_text_jobs(contracts, target_date=target_date)



def build_audio_jobs(contracts: Sequence[PublishContract], *, target_date: Optional[_dt.date] = None) -> List[Dict[str, Any]]:
    jobs: List[Dict[str, Any]] = []
    for contract in contracts:
        effective_date = target_date or _local_date_for_timezone(contract.timezone)
        for entry in contract.entries:
            if entry.get("status") != "approved":
                continue
            audio_config = dict(contract.audio_target or {})
            audio_config.update(dict(entry.get("audio_config") or {}))
            audio_config.setdefault("enabled", False)
            audio_config.setdefault("model", DEFAULT_AUDIO_SETTINGS["model"])
            audio_config.setdefault("voice", DEFAULT_AUDIO_SETTINGS["voice"])
            audio_config.setdefault("format", DEFAULT_AUDIO_SETTINGS["format"])
            audio_config.setdefault("speed", DEFAULT_AUDIO_SETTINGS["speed"])
            audio_config["enabled"] = bool(audio_config.get("enabled", False))
            audio_config["format"] = str(audio_config.get("format", DEFAULT_AUDIO_SETTINGS["format"])).strip().lower() or DEFAULT_AUDIO_SETTINGS["format"]
            try:
                audio_config["speed"] = float(audio_config.get("speed", DEFAULT_AUDIO_SETTINGS["speed"]))
            except Exception:
                audio_config["speed"] = float(DEFAULT_AUDIO_SETTINGS["speed"])
            if not audio_config["enabled"]:
                continue
            text_body = _entry_text_body(contract, entry, target_date=effective_date)
            if not text_body.strip():
                continue
            jobs.append(
                {
                    "entry_id": entry["entry_id"],
                    "contract_id": contract.contract_id,
                    "contract_type": contract.contract_type,
                    "frequency": contract.frequency,
                    "timezone": contract.timezone,
                    "version": contract.version,
                    "title": entry["title"],
                    "date": str(entry.get("date", "daily")).strip() or "daily",
                    "status": entry["status"],
                    "text": text_body,
                    "text_hash": _text_hash(text_body),
                    "content_hash": _text_hash(
                        json.dumps(
                            {
                                "entry_id": entry["entry_id"],
                                "contract_id": contract.contract_id,
                                "title": entry["title"],
                                "date": str(entry.get("date", "daily")).strip() or "daily",
                                "text": text_body,
                                "tts": {
                                    "model": audio_config.get("model", DEFAULT_AUDIO_SETTINGS["model"]),
                                    "voice": audio_config.get("voice", DEFAULT_AUDIO_SETTINGS["voice"]),
                                    "format": audio_config.get("format", DEFAULT_AUDIO_SETTINGS["format"]),
                                    "speed": audio_config.get("speed", DEFAULT_AUDIO_SETTINGS["speed"]),
                                },
                            },
                            sort_keys=True,
                            separators=(",", ":"),
                        )
                    ),
                    "audio_config": audio_config,
                    "notion_target": dict(contract.notion_target),
                    "audio_target": dict(contract.audio_target),
                    "metadata": dict(contract.metadata),
                    "source_path": str(contract.source_path),
                }
            )
    return jobs



def resolve_audio_jobs(contracts: Sequence[PublishContract], *, target_date: Optional[_dt.date] = None) -> List[Dict[str, Any]]:
    return build_audio_jobs(contracts, target_date=target_date)
