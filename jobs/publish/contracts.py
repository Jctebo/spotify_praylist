from __future__ import annotations

import datetime as _dt
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, NamedTuple, Optional, Sequence, Tuple
from zoneinfo import ZoneInfo

from jobs.publish.daily_intro import build_daily_intro_text
from jobs.publish.formatting import build_publish_context, derive_episode_id, render_publish_template
from jobs.publish.liturgical_announcement import build_liturgical_announcement_text
from jobs.publish.rosary_reflections import build_rosary_day_context, build_rosary_intro_text, build_rosary_reflection_set
from jobs.publish.fragments import audio_manifest_hash
from jobs.publish.errors import PublishMissingDataError
from jobs.novena.liturgical_helpers import celebration_name, is_easter_season_for_date, romcal_fetch_day

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
DEFAULT_LOUDNESS_NORMALIZATION = {
    "enabled": True,
    "integrated_lufs": -16,
    "true_peak_db": -1.5,
    "lra": 11,
}

VALID_STATUS_VALUES = {"approved", "skipped"}
VALID_SELECTOR_VALUES = {"current_calendar_month", "weekday", "date", "entry_id", "title", "contract_id"}
VALID_SEASON_VALUES = {"easter", "ordinary"}
SEASON_ALIASES = {
    "ordinary_time": "ordinary",
    "ordinary-time": "ordinary",
    "easter_time": "easter",
    "easter-time": "easter",
}


class PublishContract(NamedTuple):
    contract_id: str
    contract_type: str
    frequency: str
    timezone: str
    version: str
    season: str
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


def _normalize_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        raw = value.strip().lower()
        if raw in {"1", "true", "yes", "y", "on"}:
            return True
        if raw in {"0", "false", "no", "n", "off"}:
            return False
    return bool(value)



def _optional_list(payload: Dict[str, Any], field_name: str) -> List[Any]:
    value = payload.get(field_name)
    if value is None:
        return []
    if not isinstance(value, list):
        raise RuntimeError(f"Expected '{field_name}' to be a JSON array.")
    return list(value)


def _normalize_provider_config(provider: Any, path: Path, entry_id: str, index: int) -> Dict[str, Any]:
    if not isinstance(provider, dict):
        raise RuntimeError(
            f"Publish entry '{entry_id}' in '{path}' has an invalid provider at index {index}; expected an object."
        )
    normalized = dict(provider)
    provider_name = normalize_publish_key(normalized.get("provider"))
    if not provider_name:
        raise RuntimeError(
            f"Publish entry '{entry_id}' in '{path}' has a provider at index {index} without a 'provider' field."
        )
    normalized["provider"] = provider_name
    api_key_env = str(normalized.get("api_key_env", "")).strip()
    if not api_key_env:
        if provider_name == "openai":
            api_key_env = "OPENAI_API_KEY"
        elif provider_name == "elevenlabs":
            api_key_env = "ELEVENLABS_API_KEY"
    normalized["api_key_env"] = api_key_env

    if provider_name == "openai":
        normalized["model"] = str(normalized.get("model", DEFAULT_AUDIO_SETTINGS["model"])).strip() or DEFAULT_AUDIO_SETTINGS["model"]
        normalized["voice"] = str(normalized.get("voice", DEFAULT_AUDIO_SETTINGS["voice"])).strip() or DEFAULT_AUDIO_SETTINGS["voice"]
    if provider_name == "elevenlabs":
        voice_id = str(normalized.get("voice_id", "")).strip()
        if not voice_id:
            raise RuntimeError(
                f"Publish entry '{entry_id}' in '{path}' has an ElevenLabs provider at index {index} without 'voice_id'."
            )
        normalized["voice_id"] = voice_id
        model_id = str(normalized.get("model_id", "")).strip()
        if not model_id:
            raise RuntimeError(
                f"Publish entry '{entry_id}' in '{path}' has an ElevenLabs provider at index {index} without 'model_id'."
            )
        normalized["model_id"] = model_id
        if "voice_settings" in normalized:
            voice_settings = normalized.get("voice_settings") or {}
            if not isinstance(voice_settings, dict):
                raise RuntimeError(
                    f"Publish entry '{entry_id}' in '{path}' has an ElevenLabs provider at index {index} with invalid 'voice_settings'."
                )
            normalized["voice_settings"] = dict(voice_settings)

    normalized["format"] = str(normalized.get("format", DEFAULT_AUDIO_SETTINGS["format"])).strip().lower() or DEFAULT_AUDIO_SETTINGS["format"]
    try:
        normalized["speed"] = float(normalized.get("speed", DEFAULT_AUDIO_SETTINGS["speed"]))
    except Exception:
        normalized["speed"] = float(DEFAULT_AUDIO_SETTINGS["speed"])
    return normalized


def _normalize_loudness_normalization(config: Any) -> Dict[str, Any]:
    if config is None:
        settings: Dict[str, Any] = dict(DEFAULT_LOUDNESS_NORMALIZATION)
    elif isinstance(config, dict):
        settings = dict(DEFAULT_LOUDNESS_NORMALIZATION)
        settings.update(config)
    else:
        settings = dict(DEFAULT_LOUDNESS_NORMALIZATION)
        settings["enabled"] = bool(config)
    settings["enabled"] = _normalize_bool(settings.get("enabled", True))
    try:
        settings["integrated_lufs"] = float(settings.get("integrated_lufs", DEFAULT_LOUDNESS_NORMALIZATION["integrated_lufs"]))
    except Exception:
        settings["integrated_lufs"] = float(DEFAULT_LOUDNESS_NORMALIZATION["integrated_lufs"])
    try:
        settings["true_peak_db"] = float(settings.get("true_peak_db", DEFAULT_LOUDNESS_NORMALIZATION["true_peak_db"]))
    except Exception:
        settings["true_peak_db"] = float(DEFAULT_LOUDNESS_NORMALIZATION["true_peak_db"])
    try:
        settings["lra"] = float(settings.get("lra", DEFAULT_LOUDNESS_NORMALIZATION["lra"]))
    except Exception:
        settings["lra"] = float(DEFAULT_LOUDNESS_NORMALIZATION["lra"])
    return settings



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


def _normalize_season(value: Any, path: Path) -> str:
    season = str(value or "").strip().lower().replace(" ", "_").replace("-", "_")
    if not season:
        return ""
    season = SEASON_ALIASES.get(season, season)
    if season not in VALID_SEASON_VALUES:
        valid = ", ".join(sorted(VALID_SEASON_VALUES))
        raise RuntimeError(f"Publish contract '{path}' has invalid 'season' '{season}'. Use one of: {valid}.")
    return season


def _season_label_for_value(season: str) -> str:
    normalized = str(season or "").strip().lower()
    if normalized == "easter":
        return "Easter Season"
    if normalized == "ordinary":
        return "Ordinary Time"
    return ""



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



def _normalize_audio_config(payload: Dict[str, Any], path: Path, entry_id: str) -> Dict[str, Any]:
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
    audio_config["loudness_normalization"] = _normalize_loudness_normalization(
        audio_config.get("loudness_normalization")
    )
    providers = audio_config.get("providers")
    if providers is not None:
        if not isinstance(providers, list):
            raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' has an invalid 'providers' list.")
        if not providers:
            raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' has an empty 'providers' list.")
        audio_config["providers"] = [
            _normalize_provider_config(provider, path, entry_id, index)
            for index, provider in enumerate(providers, start=1)
        ]
    role_overrides = audio_config.get("role_overrides")
    if role_overrides is not None:
        if not isinstance(role_overrides, dict):
            raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' has an invalid 'role_overrides' object.")
        normalized_overrides: Dict[str, Any] = {}
        for role_name, override in role_overrides.items():
            normalized_role = normalize_publish_key(role_name)
            if not normalized_role:
                raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' has a role override without a valid role name.")
            if not isinstance(override, dict):
                raise RuntimeError(
                    f"Publish entry '{entry_id}' in '{path}' has an invalid role override for '{role_name}'; expected an object."
                )
            normalized_override = dict(override)
            override_providers = normalized_override.get("providers")
            if override_providers is not None:
                if not isinstance(override_providers, list) or not override_providers:
                    raise RuntimeError(
                        f"Publish entry '{entry_id}' in '{path}' has an invalid providers list for role '{role_name}'."
                    )
                normalized_override["providers"] = [
                    _normalize_provider_config(provider, path, entry_id, index)
                    for index, provider in enumerate(override_providers, start=1)
                ]
            elif "provider" in normalized_override:
                normalized_override = _normalize_provider_config(normalized_override, path, entry_id, 1)
            if "format" in normalized_override:
                normalized_override["format"] = str(normalized_override.get("format", audio_config["format"])).strip().lower() or audio_config["format"]
            if "speed" in normalized_override:
                try:
                    normalized_override["speed"] = float(normalized_override.get("speed", audio_config["speed"]))
                except Exception:
                    normalized_override["speed"] = float(audio_config["speed"])
            normalized_overrides[normalized_role] = normalized_override
        audio_config["role_overrides"] = normalized_overrides
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
        if "audio_role" in normalized:
            normalized["audio_role"] = normalize_publish_key(normalized.get("audio_role"))
    elif kind == "inline":
        normalized["text"] = str(normalized.get("text", ""))
        if "audio_role" in normalized:
            normalized["audio_role"] = normalize_publish_key(normalized.get("audio_role"))
    elif kind == "daily-intro":
        normalized["title"] = str(normalized.get("title", "")).strip()
        if "calendar" in normalized:
            normalized["calendar"] = str(normalized.get("calendar", "")).strip()
        if "locale" in normalized:
            normalized["locale"] = str(normalized.get("locale", "")).strip()
        if "prompt_model" in normalized:
            normalized["prompt_model"] = str(normalized.get("prompt_model", "")).strip()
        if "allow_missing_gospel" in normalized:
            normalized["allow_missing_gospel"] = _normalize_bool(normalized.get("allow_missing_gospel", False))
    elif kind == "liturgical-announcement":
        normalized["title"] = str(normalized.get("title", "")).strip()
        if "calendar" in normalized:
            normalized["calendar"] = str(normalized.get("calendar", "")).strip()
        if "locale" in normalized:
            normalized["locale"] = str(normalized.get("locale", "")).strip()
        if "include_season" in normalized:
            normalized["include_season"] = _normalize_bool(normalized.get("include_season", False))
    elif kind == "prayer-intro":
        normalized["title"] = str(normalized.get("title", "")).strip()
        normalized["prayer_title"] = str(normalized.get("prayer_title", "")).strip()
        normalized["devotion"] = str(normalized.get("devotion", "")).strip()
        normalized["template"] = str(normalized.get("template", "")).strip()
        if "calendar" in normalized:
            normalized["calendar"] = str(normalized.get("calendar", "")).strip()
        if "locale" in normalized:
            normalized["locale"] = str(normalized.get("locale", "")).strip()
    elif kind == "rosary-intro":
        normalized["title"] = str(normalized.get("title", "")).strip()
        if "calendar" in normalized:
            normalized["calendar"] = str(normalized.get("calendar", "")).strip()
        if "locale" in normalized:
            normalized["locale"] = str(normalized.get("locale", "")).strip()
        if "prompt_model" in normalized:
            normalized["prompt_model"] = str(normalized.get("prompt_model", "")).strip()
        if "allow_missing_gospel" in normalized:
            normalized["allow_missing_gospel"] = _normalize_bool(normalized.get("allow_missing_gospel", True))
    elif kind == "rosary-decades":
        mysteries = normalized.get("mysteries")
        if not isinstance(mysteries, dict):
            raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' has a rosary_decades block without a 'mysteries' object.")
        mapping = mysteries.get("map") or mysteries.get("values")
        if not isinstance(mapping, dict) or not mapping:
            raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' has a rosary_decades block without mystery map values.")
        normalized["mysteries"] = {
            "selector": str(mysteries.get("selector", "weekday")).strip().lower() or "weekday",
            "map": {str(key).strip().lower(): str(value).strip() for key, value in mapping.items()},
        }
        prayers = normalized.get("prayers")
        if not isinstance(prayers, dict):
            raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' has a rosary_decades block without a 'prayers' object.")
        required_prayers = ("our_father", "hail_mary", "glory_be", "fatima_prayer")
        normalized_prayers = {}
        for prayer_name in required_prayers:
            prayer_path = str(prayers.get(prayer_name, "")).strip()
            if not prayer_path:
                raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' has a rosary_decades block missing prayer '{prayer_name}'.")
            normalized_prayers[prayer_name] = prayer_path
        normalized["prayers"] = normalized_prayers
        normalized["hail_mary_count"] = int(normalized.get("hail_mary_count", 10))
        if normalized["hail_mary_count"] <= 0:
            raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' has an invalid rosary_decades hail_mary_count.")
        if "calendar" in normalized:
            normalized["calendar"] = str(normalized.get("calendar", "")).strip()
        if "locale" in normalized:
            normalized["locale"] = str(normalized.get("locale", "")).strip()
        if "prompt_model" in normalized:
            normalized["prompt_model"] = str(normalized.get("prompt_model", "")).strip()
        if "allow_missing_gospel" in normalized:
            normalized["allow_missing_gospel"] = _normalize_bool(normalized.get("allow_missing_gospel", True))
    else:
        raise RuntimeError(f"Publish entry '{entry_id}' in '{path}' uses unsupported block kind '{kind}'.")
    normalized["skip_if_missing"] = _normalize_bool(normalized.get("skip_if_missing", False))
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
    normalized["audio_config"] = _normalize_audio_config(entry, path, entry_id)
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
    _normalize_season(contract_root.get("season"), Path(source))
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
        elif kind == "daily-intro":
            continue
        elif kind == "liturgical-announcement":
            continue
        elif kind == "prayer-intro":
            continue
        elif kind == "rosary-intro":
            continue
        elif kind == "rosary-decades":
            mysteries = block.get("mysteries") or {}
            mapping = mysteries.get("map") or {}
            for file_path in list(mapping.values()) + list((block.get("prayers") or {}).values()):
                resolved_path = Path(str(file_path).strip())
                if not resolved_path.is_absolute():
                    resolved_path = ROOT / resolved_path
                if not resolved_path.exists():
                    raise RuntimeError(
                        f"Publish entry '{entry_id}' in '{path}' references missing rosary template file '{resolved_path}'."
                    )
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
                season=_normalize_season(contract_root.get("season"), contract_path),
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


def _contract_liturgical_context(contract: PublishContract) -> Tuple[str, str]:
    metadata = dict(contract.metadata or {})
    daily_intro = metadata.get("daily_intro")
    if not isinstance(daily_intro, dict):
        daily_intro = {}
    calendar = str(daily_intro.get("calendar") or metadata.get("calendar") or "general_roman").strip() or "general_roman"
    locale = str(daily_intro.get("locale") or metadata.get("locale") or "en").strip() or "en"
    return calendar, locale


def _contract_matches_target_date(contract: PublishContract, target_date: _dt.date) -> bool:
    season = str(contract.season or "").strip().lower()
    if not season:
        return True
    calendar, locale = _contract_liturgical_context(contract)
    is_easter = is_easter_season_for_date(calendar, locale, target_date)
    if season == "easter":
        return is_easter
    if season == "ordinary":
        return not is_easter
    return True



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
        raise PublishMissingDataError(f"Publish template file not found: {path}")
    return path.read_text(encoding="utf-8").strip()


def _compact_text(value: Any) -> str:
    return " ".join(str(value or "").split()).strip()


def _join_with_and(items: Sequence[str]) -> str:
    cleaned = [str(item or "").strip() for item in items if str(item or "").strip()]
    if not cleaned:
        return ""
    if len(cleaned) == 1:
        return cleaned[0]
    if len(cleaned) == 2:
        return f"{cleaned[0]} and {cleaned[1]}"
    return ", ".join(cleaned[:-1]) + f", and {cleaned[-1]}"


def _prayer_intro_liturgical_context(block: Dict[str, Any], contract: PublishContract) -> Tuple[str, str]:
    metadata = dict(contract.metadata or {})
    for key in ("prayer_intro", "liturgical_announcement", "daily_intro"):
        config = metadata.get(key)
        if isinstance(config, dict):
            calendar = str(block.get("calendar") or config.get("calendar") or "").strip()
            locale = str(block.get("locale") or config.get("locale") or "").strip()
            if calendar or locale:
                return calendar or "general_roman", locale or "en"
    return (
        str(block.get("calendar") or metadata.get("calendar") or "general_roman").strip() or "general_roman",
        str(block.get("locale") or metadata.get("locale") or "en").strip() or "en",
    )


def _prayer_intro_day_theme(date_value: _dt.date, *, calendar: str, locale: str) -> str:
    rows = romcal_fetch_day(calendar, locale, date_value)
    if not rows:
        raise PublishMissingDataError(
            f"Romcal returned no celebrations for {date_value.isoformat()} "
            f"(calendar={calendar}, locale={locale})."
        )
    names: List[str] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = _compact_text(celebration_name(row))
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        names.append(name)
    if not names:
        raise PublishMissingDataError(
            f"Romcal returned no usable celebration names for {date_value.isoformat()} "
            f"(calendar={calendar}, locale={locale})."
        )
    return _join_with_and(names)


def _validate_prayer_intro_sentence(text: str) -> str:
    rendered = _compact_text(text)
    if not rendered:
        raise RuntimeError("Prayer intro rendered empty text.")
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", rendered) if part.strip()]
    if len(sentences) != 1:
        raise RuntimeError(f"Prayer intro must contain exactly 1 sentence, got {len(sentences)}.")
    if not re.search(r"[.!?]$", sentences[0]):
        raise RuntimeError("Prayer intro must end with sentence punctuation.")
    return sentences[0]


def _resolve_prayer_intro_content(
    block: Dict[str, Any],
    *,
    contract: PublishContract,
    entry: Dict[str, Any],
    target_date: _dt.date,
) -> str:
    prayer_title = _compact_text(block.get("prayer_title") or entry.get("title") or contract.contract_id)
    devotion = _compact_text(block.get("devotion") or prayer_title)
    template = _compact_text(block.get("template"))
    if not template:
        template = "In today's {devotion}, we turn toward {day_theme} as we enter the {prayer_title}."
    calendar, locale = _prayer_intro_liturgical_context(block, contract)
    day_theme = _prayer_intro_day_theme(target_date, calendar=calendar, locale=locale)
    try:
        rendered = template.format(
            day_theme=day_theme,
            prayer_title=prayer_title,
            devotion=devotion,
        )
    except KeyError as exc:
        raise RuntimeError(f"Prayer intro template contains unsupported placeholder '{exc.args[0]}'.") from exc
    return _validate_prayer_intro_sentence(rendered)


def _block_display_name(block: Dict[str, Any]) -> str:
    return str(block.get("title") or block.get("heading") or block.get("label") or block.get("kind") or "block").strip()


def _season_for_date(contract: PublishContract, target_date: _dt.date) -> str:
    season = str(contract.season or "").strip().lower()
    if season:
        return season
    metadata = dict(contract.metadata or {})
    config = dict(metadata.get("rosary_reflections") or {}) if isinstance(metadata.get("rosary_reflections"), dict) else {}
    calendar = str(config.get("calendar") or metadata.get("calendar") or "general_roman").strip() or "general_roman"
    locale = str(config.get("locale") or metadata.get("locale") or "en").strip() or "en"
    return "easter" if is_easter_season_for_date(calendar, locale, target_date) else "ordinary"


def _selected_rosary_mystery_text(
    block: Dict[str, Any],
    *,
    contract: PublishContract,
    entry: Dict[str, Any],
    target_date: _dt.date,
) -> str:
    mysteries = block.get("mysteries") or {}
    selector = str(mysteries.get("selector") or "weekday").strip().lower() or "weekday"
    selected = evaluate_selector(selector, target_date=target_date, timezone=contract.timezone, contract=contract, entry=entry)
    mapping = mysteries.get("map") or {}
    path_text = str(mapping.get(str(selected).lower()) or mapping.get(str(selected).title()) or "").strip()
    if not path_text:
        raise PublishMissingDataError(f"Publish entry '{entry.get('entry_id', '')}' has no rosary mystery entry for '{selected}'.")
    return _read_text_file(path_text)


def _rosary_reflection_config(block: Dict[str, Any], contract: PublishContract) -> Dict[str, Any]:
    metadata = dict(contract.metadata or {})
    config = dict(metadata.get("rosary_reflections") or {}) if isinstance(metadata.get("rosary_reflections"), dict) else {}
    for key in ("calendar", "locale", "prompt_model", "allow_missing_gospel"):
        if key in block:
            config[key] = block.get(key)
    config["allow_missing_gospel"] = _normalize_bool(config.get("allow_missing_gospel", True))
    return config


def _find_first_block_by_kind(blocks: Sequence[Any], kind_name: str) -> Optional[Dict[str, Any]]:
    target = normalize_publish_key(kind_name)
    for block in blocks:
        if not isinstance(block, dict):
            continue
        kind = normalize_publish_key(block.get("kind"))
        if kind == target:
            return block
        nested: Sequence[Any] = []
        if kind == "sequence":
            nested = block.get("blocks") or []
        elif kind == "repeat":
            nested = [block.get("block")]
        elif kind == "weekday-map":
            mapping = block.get("map") or {}
            nested = list(mapping.values())
        found = _find_first_block_by_kind(nested, target) if nested else None
        if found is not None:
            return found
    return None


def _build_rosary_day_runtime_context(
    contract: PublishContract,
    entry: Dict[str, Any],
    target_date: _dt.date,
) -> Dict[str, Any]:
    rosary_block = _find_first_block_by_kind(entry.get("blocks") or [], "rosary-decades")
    if not rosary_block:
        return {}
    config = _rosary_reflection_config(rosary_block, contract)
    mystery_text = _selected_rosary_mystery_text(rosary_block, contract=contract, entry=entry, target_date=target_date)
    day_context = build_rosary_day_context(
        target_date,
        mystery_text,
        calendar=str(config.get("calendar") or "").strip() or None,
        locale=str(config.get("locale") or "").strip() or None,
        allow_missing_gospel=_normalize_bool(config.get("allow_missing_gospel", True)),
        season=_season_for_date(contract, target_date),
    )
    return {
        "rosary_day_context": day_context,
        "rosary_mystery_set_title": day_context.mystery_set_title,
        "rosary_focus_title": day_context.focus_title,
        "rosary_focus_source": day_context.focus_source,
        "rosary_focus_prompt_label": day_context.focus_prompt_label,
        "rosary_season_label": day_context.season_label,
        "rosary_gospel_citation": day_context.gospel_citation,
    }


def _entry_runtime_context(
    contract: PublishContract,
    entry: Dict[str, Any],
    target_date: _dt.date,
) -> Dict[str, Any]:
    runtime: Dict[str, Any] = {}
    runtime.update(_build_rosary_day_runtime_context(contract, entry, target_date))
    return runtime


def _build_rosary_reflection_set(
    block: Dict[str, Any],
    *,
    contract: PublishContract,
    entry: Dict[str, Any],
    target_date: _dt.date,
    runtime_context: Optional[Dict[str, Any]] = None,
):
    return _get_or_build_rosary_reflection_set(
        block,
        contract=contract,
        entry=entry,
        target_date=target_date,
        runtime_context=runtime_context,
    )


def _get_or_build_rosary_reflection_set(
    block: Dict[str, Any],
    *,
    contract: PublishContract,
    entry: Dict[str, Any],
    target_date: _dt.date,
    runtime_context: Optional[Dict[str, Any]] = None,
):
    if runtime_context is not None and runtime_context.get("rosary_reflection_set") is not None:
        return runtime_context["rosary_reflection_set"]
    config = _rosary_reflection_config(block, contract)
    mystery_text = _selected_rosary_mystery_text(block, contract=contract, entry=entry, target_date=target_date)
    reflection_set = build_rosary_reflection_set(
        target_date,
        mystery_text,
        calendar=str(config.get("calendar") or "").strip() or None,
        locale=str(config.get("locale") or "").strip() or None,
        prompt_model=str(config.get("prompt_model") or "").strip() or None,
        allow_missing_gospel=_normalize_bool(config.get("allow_missing_gospel", True)),
        season=_season_for_date(contract, target_date),
        day_context=(runtime_context or {}).get("rosary_day_context"),
    )
    if runtime_context is not None:
        runtime_context["rosary_reflection_set"] = reflection_set
    return reflection_set


def _rosary_reflection_metadata(reflection_set: Any) -> Dict[str, Any]:
    if reflection_set is None:
        return {}
    context = getattr(reflection_set, "day_context", None)
    return {
        "source": str(getattr(reflection_set, "source", "") or "").strip(),
        "fallback_reason": str(getattr(reflection_set, "fallback_reason", "") or "").strip(),
        "count": len(tuple(getattr(reflection_set, "reflections", ()) or ())),
        "focus_source": str(getattr(context, "focus_source", "") or "").strip(),
        "focus_title": str(getattr(context, "focus_title", "") or "").strip(),
        "focus_prompt_label": str(getattr(context, "focus_prompt_label", "") or "").strip(),
    }


def _rosary_reflection_metadata_from_context(runtime_context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    return _rosary_reflection_metadata((runtime_context or {}).get("rosary_reflection_set"))


def _attach_rosary_reflection_context(render_context: Dict[str, Any], runtime_context: Optional[Dict[str, Any]]) -> None:
    metadata = _rosary_reflection_metadata_from_context(runtime_context)
    if not metadata:
        return
    render_context["rosary_reflection_source"] = metadata["source"]
    render_context["rosary_reflection_fallback_reason"] = metadata["fallback_reason"]
    render_context["rosary_reflection_count"] = metadata["count"]


def _resolve_rosary_intro_content(
    block: Dict[str, Any],
    *,
    contract: PublishContract,
    entry: Dict[str, Any],
    target_date: _dt.date,
    runtime_context: Optional[Dict[str, Any]] = None,
) -> str:
    rosary_block = _find_first_block_by_kind(entry.get("blocks") or [], "rosary-decades")
    if not rosary_block:
        raise PublishMissingDataError(f"Publish entry '{entry.get('entry_id', '')}' has a rosary_intro block without rosary_decades.")
    config = _rosary_reflection_config(rosary_block, contract)
    for key in ("calendar", "locale", "prompt_model", "allow_missing_gospel"):
        if key in block:
            config[key] = block.get(key)
    day_context = (runtime_context or {}).get("rosary_day_context")
    if day_context is None:
        mystery_text = _selected_rosary_mystery_text(rosary_block, contract=contract, entry=entry, target_date=target_date)
        day_context = build_rosary_day_context(
            target_date,
            mystery_text,
            calendar=str(config.get("calendar") or "").strip() or None,
            locale=str(config.get("locale") or "").strip() or None,
            allow_missing_gospel=_normalize_bool(config.get("allow_missing_gospel", True)),
            season=_season_for_date(contract, target_date),
        )
    return build_rosary_intro_text(
        target_date,
        day_context.mystery_set_title,
        day_context.mysteries,
        calendar=str(config.get("calendar") or "").strip() or None,
        locale=str(config.get("locale") or "").strip() or None,
        prompt_model=str(config.get("prompt_model") or "").strip() or None,
        allow_missing_gospel=_normalize_bool(config.get("allow_missing_gospel", True)),
        season=_season_for_date(contract, target_date),
        day_context=day_context,
    )


def _read_rosary_prayer_text(block: Dict[str, Any], prayer_name: str) -> str:
    prayers = block.get("prayers") or {}
    path_text = str(prayers.get(prayer_name, "")).strip()
    if not path_text:
        raise PublishMissingDataError(f"Rosary decades block is missing prayer '{prayer_name}'.")
    return _read_text_file(path_text)


def _rosary_decade_heading(number: int, title: str) -> str:
    labels = {1: "First", 2: "Second", 3: "Third", 4: "Fourth", 5: "Fifth"}
    return f"The {labels.get(number, str(number))} Mystery: {title}"


def _resolve_rosary_decades_content(
    block: Dict[str, Any],
    *,
    contract: PublishContract,
    entry: Dict[str, Any],
    target_date: _dt.date,
    runtime_context: Optional[Dict[str, Any]] = None,
) -> str:
    reflection_set = _build_rosary_reflection_set(
        block,
        contract=contract,
        entry=entry,
        target_date=target_date,
        runtime_context=runtime_context,
    )
    our_father = _read_rosary_prayer_text(block, "our_father")
    hail_mary = _read_rosary_prayer_text(block, "hail_mary")
    glory_be = _read_rosary_prayer_text(block, "glory_be")
    fatima_prayer = _read_rosary_prayer_text(block, "fatima_prayer")
    hail_mary_count = int(block.get("hail_mary_count", 10))

    decades = [reflection_set.mystery_set_title]
    for mystery, reflection in zip(reflection_set.mysteries, reflection_set.reflections):
        decade_parts = [
            _rosary_decade_heading(mystery.number, mystery.title),
            f"Fruit of the Mystery: {mystery.fruit}.",
            f"Reflection: {reflection}",
            our_father,
            "\n".join(hail_mary for _ in range(hail_mary_count)),
            glory_be,
            fatima_prayer,
        ]
        decades.append("\n\n".join(part for part in decade_parts if str(part).strip()))
    return "\n\n".join(decades).strip()



def resolve_block_content(
    block: Any,
    *,
    contract: PublishContract,
    entry: Dict[str, Any],
    target_date: Optional[_dt.date] = None,
    runtime_context: Optional[Dict[str, Any]] = None,
) -> str:
    if isinstance(block, str):
        return block.strip()
    if not isinstance(block, dict):
        raise RuntimeError(f"Publish entry '{entry.get('entry_id', '')}' uses an invalid block.")

    kind = normalize_publish_key(block.get("kind"))
    effective_date = target_date or _local_date_for_timezone(contract.timezone)
    skip_if_missing = _normalize_bool(block.get("skip_if_missing", False))

    try:
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
                raise PublishMissingDataError(f"Publish entry '{entry.get('entry_id', '')}' has no weekday_map entry for '{weekday}'.")
            return resolve_block_content(chosen, contract=contract, entry=entry, target_date=effective_date, runtime_context=runtime_context)
        if kind == "sequence":
            children = [
                resolve_block_content(
                    child,
                    contract=contract,
                    entry=entry,
                    target_date=effective_date,
                    runtime_context=runtime_context,
                )
                for child in block.get("blocks", [])
            ]
            children = [child for child in children if child.strip()]
            separator = str(block.get("separator", "\n\n"))
            return separator.join(children).strip()
        if kind == "repeat":
            repeated = resolve_block_content(
                block.get("block"),
                contract=contract,
                entry=entry,
                target_date=effective_date,
                runtime_context=runtime_context,
            )
            separator = str(block.get("separator", "\n"))
            count = int(block.get("count", 0))
            return separator.join(repeated for _ in range(count)).strip()
        if kind == "rosary-decades":
            return _resolve_rosary_decades_content(
                block,
                contract=contract,
                entry=entry,
                target_date=effective_date,
                runtime_context=runtime_context,
            )
        if kind == "rosary-intro":
            return _resolve_rosary_intro_content(
                block,
                contract=contract,
                entry=entry,
                target_date=effective_date,
                runtime_context=runtime_context,
            )
        if kind == "daily-intro":
            metadata = dict(contract.metadata or {})
            intro_config = dict(metadata.get("daily_intro") or {}) if isinstance(metadata.get("daily_intro"), dict) else {}
            intro_config.update({k: v for k, v in block.items() if k not in {"kind", "title"}})
            calendar = str(intro_config.get("calendar") or "").strip() or None
            locale = str(intro_config.get("locale") or "").strip() or None
            prompt_model = str(intro_config.get("prompt_model") or "").strip() or None
            allow_missing_gospel = _normalize_bool(intro_config.get("allow_missing_gospel", False))
            print(
                "INFO daily_intro resolved "
                f"entry={entry.get('entry_id', '')} "
                f"block={_block_display_name(block)} "
                f"calendar={calendar or '-'} "
                f"locale={locale or '-'} "
                f"prompt_model={prompt_model or '-'} "
                f"allow_missing_gospel={str(allow_missing_gospel).lower()}",
                file=sys.stderr,
            )
            return build_daily_intro_text(
                effective_date,
                calendar=calendar,
                locale=locale,
                prompt_model=prompt_model,
                allow_missing_gospel=allow_missing_gospel,
            )
        if kind == "liturgical-announcement":
            metadata = dict(contract.metadata or {})
            announcement_config = (
                dict(metadata.get("liturgical_announcement") or {})
                if isinstance(metadata.get("liturgical_announcement"), dict)
                else {}
            )
            announcement_config.update({k: v for k, v in block.items() if k not in {"kind", "title"}})
            calendar = str(announcement_config.get("calendar") or "").strip() or None
            locale = str(announcement_config.get("locale") or "").strip() or None
            include_season = _normalize_bool(announcement_config.get("include_season", False))
            print(
                "INFO liturgical_announcement resolved "
                f"entry={entry.get('entry_id', '')} "
                f"block={_block_display_name(block)} "
                f"calendar={calendar or '-'} "
                f"locale={locale or '-'} "
                f"include_season={str(include_season).lower()}",
                file=sys.stderr,
            )
            return build_liturgical_announcement_text(
                effective_date,
                calendar=calendar,
                locale=locale,
                include_season=include_season,
            )
        if kind == "prayer-intro":
            return _resolve_prayer_intro_content(
                block,
                contract=contract,
                entry=entry,
                target_date=effective_date,
            )
        raise RuntimeError(f"Publish entry '{entry.get('entry_id', '')}' uses unsupported block kind '{kind}'.")
    except PublishMissingDataError as exc:
        if skip_if_missing:
            print(
                f"WARN skipping missing publish block entry={entry.get('entry_id', '')} kind={kind} block={_block_display_name(block)} reason={exc}",
                file=sys.stderr,
            )
            return ""
        raise



def _entry_text_body(
    contract: PublishContract,
    entry: Dict[str, Any],
    *,
    target_date: Optional[_dt.date] = None,
    runtime_context: Optional[Dict[str, Any]] = None,
) -> str:
    effective_date = target_date or _local_date_for_timezone(contract.timezone)
    runtime_context = runtime_context if runtime_context is not None else _entry_runtime_context(contract, entry, effective_date)
    blocks = entry.get("blocks") or []
    if blocks:
        parts = [
            resolve_block_content(
                block,
                contract=contract,
                entry=entry,
                target_date=effective_date,
                runtime_context=runtime_context,
            )
            for block in blocks
        ]
        parts = [part.strip() for part in parts if part.strip()]
        return "\n\n".join(parts).strip()
    return str(entry.get("text", "")).strip()


def _fragment_label_for_block(block: Dict[str, Any], text: str) -> str:
    explicit = str(block.get("title") or block.get("heading") or block.get("label") or "").strip()
    if explicit:
        return explicit

    kind = normalize_publish_key(block.get("kind"))
    if kind == "monthly-template":
        folder = str(block.get("folder", "")).strip()
        folder_name = Path(folder).name if folder else ""
        return _humanize_slug(folder_name) or "Monthly Intention"

    if kind == "file":
        path_text = str(block.get("path", "")).strip()
        return _humanize_slug(Path(path_text).stem) if path_text else "Fragment"

    if kind == "daily-intro":
        return explicit or "Daily Intro"

    if kind == "liturgical-announcement":
        return explicit or "Liturgical Announcement"

    if kind == "prayer-intro":
        return explicit or "Prayer Intro"

    if kind == "rosary-intro":
        return explicit or "Rosary Intro"

    if kind == "inline":
        first_line = _first_non_empty_line(text)
        if first_line and len(first_line) <= 80:
            return first_line
        return "Fragment"

    first_line = _first_non_empty_line(text)
    if first_line and len(first_line) <= 80:
        return first_line
    return "Fragment"


def _fragment_path_segment(kind: str, *, index: Optional[int] = None, value: Optional[str] = None) -> str:
    parts = [normalize_publish_key(kind) or "fragment"]
    if index is not None:
        parts.append(str(index))
    if value:
        parts.append(normalize_publish_key(value) or str(value).strip().lower())
    return "-".join(part for part in parts if part)


def _fragment_audio_role(block: Dict[str, Any]) -> str:
    return normalize_publish_key(block.get("audio_role"))


def _fragment_payload(
    *,
    fragment_key: str,
    kind: str,
    label: str,
    text: str,
    block: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    fragment: Dict[str, Any] = {
        "fragment_key": fragment_key,
        "block_path": fragment_key,
        "kind": kind,
        "label": label,
        "text": text,
    }
    if block:
        audio_role = _fragment_audio_role(block)
        if audio_role:
            fragment["audio_role"] = audio_role
    return fragment


def _rosary_prayer_fragment(
    *,
    block: Dict[str, Any],
    prayer_name: str,
    fragment_key: str,
    label: str,
) -> Dict[str, Any]:
    text = _read_rosary_prayer_text(block, prayer_name)
    return _fragment_payload(
        fragment_key=fragment_key,
        kind="file",
        label=label,
        text=text,
        block={"kind": "file", "path": str((block.get("prayers") or {}).get(prayer_name, "")).strip()},
    )


def _expand_rosary_decade_audio_fragments(
    block: Dict[str, Any],
    *,
    contract: PublishContract,
    entry: Dict[str, Any],
    target_date: _dt.date,
    path_parts: Sequence[str],
    runtime_context: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    reflection_set = _build_rosary_reflection_set(
        block,
        contract=contract,
        entry=entry,
        target_date=target_date,
        runtime_context=runtime_context,
    )
    fragments: List[Dict[str, Any]] = []
    hail_mary_count = int(block.get("hail_mary_count", 10))
    for mystery, reflection in zip(reflection_set.mysteries, reflection_set.reflections):
        decade_segment = _fragment_path_segment("decade", index=mystery.number, value=mystery.title)
        decade_path = (*path_parts, decade_segment)
        announcement = "\n".join(
            [
                _rosary_decade_heading(mystery.number, mystery.title),
                f"Fruit of the Mystery: {mystery.fruit}.",
                "",
                f"Reflection: {reflection}",
            ]
        )
        fragments.append(
            _fragment_payload(
                fragment_key="/".join((*decade_path, "reflection")),
                kind="rosary-reflection",
                label=_rosary_decade_heading(mystery.number, mystery.title),
                text=announcement,
            )
        )
        fragments.append(
            _rosary_prayer_fragment(
                block=block,
                prayer_name="our_father",
                fragment_key="/".join((*decade_path, "our-father")),
                label="Our Father",
            )
        )
        for index in range(1, hail_mary_count + 1):
            fragments.append(
                _rosary_prayer_fragment(
                    block=block,
                    prayer_name="hail_mary",
                    fragment_key="/".join((*decade_path, f"hail-mary-{index}")),
                    label="Hail Mary",
                )
            )
        fragments.append(
            _rosary_prayer_fragment(
                block=block,
                prayer_name="glory_be",
                fragment_key="/".join((*decade_path, "glory-be")),
                label="Glory Be",
            )
        )
        fragments.append(
            _rosary_prayer_fragment(
                block=block,
                prayer_name="fatima_prayer",
                fragment_key="/".join((*decade_path, "fatima-prayer")),
                label="Fatima Prayer",
            )
        )
    return fragments


def effective_audio_config_for_fragment(audio_config: Dict[str, Any], fragment: Dict[str, Any]) -> Dict[str, Any]:
    effective = dict(audio_config)
    role_overrides = effective.pop("role_overrides", None)
    audio_role = normalize_publish_key(fragment.get("audio_role"))
    if audio_role and isinstance(role_overrides, dict):
        override = role_overrides.get(audio_role)
        if isinstance(override, dict):
            effective.update(dict(override))
    return effective


def attach_effective_audio_configs(
    fragments: Sequence[Dict[str, Any]],
    audio_config: Dict[str, Any],
) -> List[Dict[str, Any]]:
    enriched: List[Dict[str, Any]] = []
    for fragment in fragments:
        row = dict(fragment)
        row["effective_audio_config"] = effective_audio_config_for_fragment(audio_config, row)
        enriched.append(row)
    return enriched


def _expand_audio_fragments_from_block(
    block: Any,
    *,
    contract: PublishContract,
    entry: Dict[str, Any],
    target_date: Optional[_dt.date],
    path_parts: Sequence[str],
    runtime_context: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    if isinstance(block, str):
        text = block.strip()
        if not text:
            return []
        fragment_key = "/".join((*path_parts, "inline")) if path_parts else "inline"
        return [
            _fragment_payload(
                fragment_key=fragment_key,
                kind="inline",
                label=_fragment_label_for_block({"kind": "inline", "text": text}, text),
                text=text,
            )
        ]

    if not isinstance(block, dict):
        raise RuntimeError(f"Publish entry '{entry.get('entry_id', '')}' uses an invalid block.")

    kind = normalize_publish_key(block.get("kind"))
    effective_date = target_date or _local_date_for_timezone(contract.timezone)

    if kind == "sequence":
        fragments: List[Dict[str, Any]] = []
        for index, child in enumerate(block.get("blocks", []) or [], start=1):
            child_segment = _fragment_path_segment("sequence", index=index)
            fragments.extend(
                _expand_audio_fragments_from_block(
                    child,
                    contract=contract,
                    entry=entry,
                    target_date=effective_date,
                    path_parts=(*path_parts, child_segment),
                    runtime_context=runtime_context,
                )
            )
        return fragments

    if kind == "repeat":
        fragments = []
        count = int(block.get("count", 0))
        child = block.get("block")
        for index in range(1, count + 1):
            child_segment = _fragment_path_segment("repeat", index=index)
            fragments.extend(
                _expand_audio_fragments_from_block(
                    child,
                    contract=contract,
                    entry=entry,
                    target_date=effective_date,
                    path_parts=(*path_parts, child_segment),
                    runtime_context=runtime_context,
                )
            )
        return fragments

    if kind == "weekday-map":
        weekday = evaluate_selector(block.get("selector", "weekday"), target_date=effective_date, timezone=contract.timezone, contract=contract, entry=entry)
        mapping = block.get("map") or {}
        chosen = mapping.get(weekday.lower()) or mapping.get(weekday.title())
        if chosen is None:
            raise RuntimeError(f"Publish entry '{entry.get('entry_id', '')}' has no weekday_map entry for '{weekday}'.")
        child_segment = _fragment_path_segment("weekday-map", value=weekday)
        return _expand_audio_fragments_from_block(
            chosen,
            contract=contract,
            entry=entry,
            target_date=effective_date,
            path_parts=(*path_parts, child_segment),
            runtime_context=runtime_context,
        )

    if kind == "monthly-template":
        month_name = evaluate_selector(block.get("selector", "current_calendar_month"), target_date=effective_date, timezone=contract.timezone, contract=contract, entry=entry)
        text = resolve_block_content(
            block,
            contract=contract,
            entry=entry,
            target_date=effective_date,
            runtime_context=runtime_context,
        )
        if not text.strip():
            return []
        fragment_key = "/".join((*path_parts, _fragment_path_segment("monthly-template", value=month_name)))
        return [
            _fragment_payload(
                fragment_key=fragment_key,
                kind=kind,
                label=_fragment_label_for_block(block, text),
                text=text,
                block=block,
            )
        ]

    if kind == "rosary-decades":
        return _expand_rosary_decade_audio_fragments(
            block,
            contract=contract,
            entry=entry,
            target_date=effective_date,
            path_parts=path_parts,
            runtime_context=runtime_context,
        )

    if kind in {"file", "inline", "daily-intro", "liturgical-announcement", "prayer-intro", "rosary-intro"}:
        text = resolve_block_content(
            block,
            contract=contract,
            entry=entry,
            target_date=effective_date,
            runtime_context=runtime_context,
        )
        if not text.strip():
            return []
        fragment_key = "/".join((*path_parts, _fragment_path_segment(kind)))
        return [
            _fragment_payload(
                fragment_key=fragment_key,
                kind=kind,
                label=_fragment_label_for_block(block, text),
                text=text,
                block=block,
            )
        ]

    raise RuntimeError(f"Publish entry '{entry.get('entry_id', '')}' uses unsupported block kind '{kind}'.")


def expand_audio_fragments(
    contract: PublishContract,
    entry: Dict[str, Any],
    *,
    target_date: Optional[_dt.date] = None,
    runtime_context: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    fragments: List[Dict[str, Any]] = []
    blocks = list(entry.get("blocks") or [])
    effective_date = target_date or _local_date_for_timezone(contract.timezone)
    runtime_context = runtime_context if runtime_context is not None else _entry_runtime_context(contract, entry, effective_date)
    if blocks:
        for index, block in enumerate(blocks, start=1):
            fragments.extend(
                _expand_audio_fragments_from_block(
                    block,
                    contract=contract,
                    entry=entry,
                    target_date=effective_date,
                    path_parts=(f"block-{index}",),
                    runtime_context=runtime_context,
                )
            )
        return fragments

    text = str(entry.get("text", "")).strip()
    if not text:
        return []
    return [
        {
            "fragment_key": f"entry-text/{entry['entry_id']}",
            "block_path": f"entry-text/{entry['entry_id']}",
            "kind": "inline",
            "label": _fragment_label_for_block({"kind": "inline", "text": text}, text),
            "text": text,
        }
    ]



def _text_hash(text: str) -> str:
    import hashlib

    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _humanize_slug(value: str) -> str:
    text = re.sub(r"[-_]+", " ", str(value or "").strip())
    return text.title().strip()


def _first_non_empty_line(text: str) -> str:
    for line in str(text or "").splitlines():
        value = " ".join(line.split()).strip()
        if value:
            return value
    return ""


def _section_title_for_block(block: Dict[str, Any], text: str, *, index: int, total: int) -> str:
    explicit = str(block.get("title") or block.get("heading") or block.get("label") or "").strip()
    if explicit:
        return explicit

    kind = normalize_publish_key(block.get("kind"))
    if kind == "sequence":
        if index == total:
            return "Closing Prayers"
        return "Opening Prayers"

    if kind == "weekday-map":
        first_line = _first_non_empty_line(text)
        if first_line and len(first_line) <= 80:
            return first_line
        return "Mysteries"

    if kind == "rosary-decades":
        first_line = _first_non_empty_line(text)
        if first_line and len(first_line) <= 80:
            return first_line
        return "Rosary Decades"

    if kind == "monthly-template":
        folder = str(block.get("folder", "")).strip()
        folder_name = Path(folder).name if folder else ""
        return _humanize_slug(folder_name) or "Monthly Intention"

    if kind == "file":
        first_line = _first_non_empty_line(text)
        if first_line and len(first_line) <= 80:
            return first_line
        path_text = str(block.get("path", "")).strip()
        return _humanize_slug(Path(path_text).stem) if path_text else f"Section {index}"

    if kind == "daily-intro":
        return explicit or "Daily Intro"

    if kind == "liturgical-announcement":
        return explicit or "Liturgical Announcement"

    if kind == "prayer-intro":
        return explicit or "Prayer Intro"

    if kind == "rosary-intro":
        return explicit or "Rosary Intro"

    if kind == "inline":
        first_line = _first_non_empty_line(text)
        if first_line and len(first_line) <= 80:
            return first_line
        return f"Section {index}"

    return f"Section {index}"


def _build_text_sections(
    contract: PublishContract,
    entry: Dict[str, Any],
    *,
    target_date: Optional[_dt.date] = None,
    runtime_context: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    sections: List[Dict[str, Any]] = []
    blocks = list(entry.get("blocks") or [])
    effective_date = target_date or _local_date_for_timezone(contract.timezone)
    runtime_context = runtime_context if runtime_context is not None else _entry_runtime_context(contract, entry, effective_date)
    for index, block in enumerate(blocks, start=1):
        text = resolve_block_content(
            block,
            contract=contract,
            entry=entry,
            target_date=effective_date,
            runtime_context=runtime_context,
        )
        if not text.strip():
            continue
        sections.append(
            {
                "title": _section_title_for_block(block, text, index=index, total=len(blocks)),
                "text": text,
                "kind": normalize_publish_key(block.get("kind")),
            }
        )
    return sections


def build_resume_markers(
    *,
    sections: Optional[Sequence[Dict[str, Any]]] = None,
    fragments: Optional[Sequence[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    markers: List[Dict[str, Any]] = []
    if fragments is not None:
        for order, fragment in enumerate(fragments, start=1):
            fragment_key = str(fragment.get("fragment_key", "")).strip()
            label = str(fragment.get("label", "")).strip() or fragment_key or f"Fragment {order}"
            marker_id = normalize_publish_key(fragment_key or label or f"fragment-{order}") or f"fragment-{order}"
            markers.append(
                {
                    "marker_id": marker_id,
                    "order": order,
                    "source": "audio_fragment",
                    "label": label,
                    "kind": str(fragment.get("kind", "")).strip(),
                    "fragment_key": fragment_key,
                    "block_path": str(fragment.get("block_path", "")).strip(),
                }
            )
        return markers

    for order, section in enumerate(sections or [], start=1):
        title = str(section.get("title", "")).strip() or f"Section {order}"
        marker_id = normalize_publish_key(f"section-{order}-{title}") or f"section-{order}"
        markers.append(
            {
                "marker_id": marker_id,
                "order": order,
                "source": "text_section",
                "label": title,
                "kind": str(section.get("kind", "")).strip(),
                "section_index": order - 1,
            }
        )
    return markers


def _render_entry_metadata(
    contract: PublishContract,
    entry: Dict[str, Any],
    *,
    target_date: Optional[_dt.date] = None,
    runtime_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    effective_date = target_date or _local_date_for_timezone(contract.timezone)
    season = str(contract.season or "").strip().lower()
    context = build_publish_context(
        contract_id=contract.contract_id,
        contract_type=contract.contract_type,
        frequency=contract.frequency,
        timezone=contract.timezone,
        version=contract.version,
        entry=entry,
        target_date=effective_date,
        season=season,
    )
    if season:
        context["season_label"] = _season_label_for_value(season)
    if runtime_context:
        for key, value in runtime_context.items():
            if key == "rosary_day_context":
                continue
            context[key] = value
    metadata = dict(contract.metadata or {})
    title_template = str(metadata.get("title_template") or metadata.get("title") or "").strip()
    description_template = str(metadata.get("description_template") or metadata.get("description") or "").strip()
    episode_id_template = str(metadata.get("episode_id_template") or "").strip()
    title = render_publish_template(title_template, context) if title_template else str(entry.get("title", "")).strip()
    if not title:
        title = str(entry.get("entry_id", "")).strip()
    description = render_publish_template(description_template, context) if description_template else title
    episode_id = derive_episode_id(context=context, template=episode_id_template)
    return {
        "context": context,
        "title": title,
        "description": description,
        "episode_id": episode_id,
        "published_date": effective_date.isoformat(),
    }



def build_text_jobs(contracts: Sequence[PublishContract], *, target_date: Optional[_dt.date] = None) -> List[Dict[str, Any]]:
    jobs: List[Dict[str, Any]] = []
    for contract in contracts:
        effective_date = target_date or _local_date_for_timezone(contract.timezone)
        if not _contract_matches_target_date(contract, effective_date):
            continue
        for entry in contract.entries:
            if entry.get("status") != "approved":
                continue
            text_config = dict(entry.get("text_config") or {})
            if not bool(text_config.get("enabled", True)):
                continue
            runtime_context = _entry_runtime_context(contract, entry, effective_date)
            rendered_metadata = _render_entry_metadata(
                contract,
                entry,
                target_date=effective_date,
                runtime_context=runtime_context,
            )
            text_body = _entry_text_body(
                contract,
                entry,
                target_date=effective_date,
                runtime_context=runtime_context,
            )
            if not text_body.strip():
                continue
            sections = _build_text_sections(
                contract,
                entry,
                target_date=effective_date,
                runtime_context=runtime_context,
            )
            render_context = dict(rendered_metadata["context"])
            _attach_rosary_reflection_context(render_context, runtime_context)
            rosary_reflections = _rosary_reflection_metadata_from_context(runtime_context)
            jobs.append(
                {
                    "entry_id": entry["entry_id"],
                    "episode_id": rendered_metadata["episode_id"],
                    "contract_id": contract.contract_id,
                    "contract_type": contract.contract_type,
                    "frequency": contract.frequency,
                    "timezone": contract.timezone,
                    "version": contract.version,
                    "title": rendered_metadata["title"],
                    "description": rendered_metadata["description"],
                    "date": str(entry.get("date", "daily")).strip() or "daily",
                    "published_date": rendered_metadata["published_date"],
                    "status": entry["status"],
                    "text": text_body,
                    "text_hash": _text_hash(text_body),
                    "sections": sections,
                    "resume_markers": build_resume_markers(sections=sections),
                    "text_config": text_config,
                    "audio_config": dict(entry.get("audio_config") or {}),
                    "notion_target": dict(contract.notion_target),
                    "audio_target": dict(contract.audio_target),
                    "metadata": dict(contract.metadata),
                    "render_context": render_context,
                    "rosary_reflections": rosary_reflections,
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
        if not _contract_matches_target_date(contract, effective_date):
            continue
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
            audio_config.setdefault("loudness_normalization", dict(DEFAULT_LOUDNESS_NORMALIZATION))
            audio_config["enabled"] = bool(audio_config.get("enabled", False))
            audio_config["format"] = str(audio_config.get("format", DEFAULT_AUDIO_SETTINGS["format"])).strip().lower() or DEFAULT_AUDIO_SETTINGS["format"]
            try:
                audio_config["speed"] = float(audio_config.get("speed", DEFAULT_AUDIO_SETTINGS["speed"]))
            except Exception:
                audio_config["speed"] = float(DEFAULT_AUDIO_SETTINGS["speed"])
            audio_config["loudness_normalization"] = _normalize_loudness_normalization(
                audio_config.get("loudness_normalization")
            )
            if not audio_config["enabled"]:
                continue
            runtime_context = _entry_runtime_context(contract, entry, effective_date)
            rendered_metadata = _render_entry_metadata(
                contract,
                entry,
                target_date=effective_date,
                runtime_context=runtime_context,
            )
            audio_fragments = attach_effective_audio_configs(
                expand_audio_fragments(
                    contract,
                    entry,
                    target_date=effective_date,
                    runtime_context=runtime_context,
                ),
                audio_config,
            )
            text_body = _entry_text_body(
                contract,
                entry,
                target_date=effective_date,
                runtime_context=runtime_context,
            )
            if not text_body.strip():
                continue
            if not audio_fragments:
                continue
            render_context = dict(rendered_metadata["context"])
            _attach_rosary_reflection_context(render_context, runtime_context)
            rosary_reflections = _rosary_reflection_metadata_from_context(runtime_context)
            job = {
                "entry_id": entry["entry_id"],
                "episode_id": rendered_metadata["episode_id"],
                "contract_id": contract.contract_id,
                "contract_type": contract.contract_type,
                "frequency": contract.frequency,
                "timezone": contract.timezone,
                "version": contract.version,
                "title": rendered_metadata["title"],
                "description": rendered_metadata["description"],
                "date": str(entry.get("date", "daily")).strip() or "daily",
                "published_date": rendered_metadata["published_date"],
                "status": entry["status"],
                "text": text_body,
                "text_hash": _text_hash(text_body),
                "audio_fragments": audio_fragments,
                "resume_markers": build_resume_markers(fragments=audio_fragments),
                "content_hash": "",
                "audio_config": audio_config,
                "notion_target": dict(contract.notion_target),
                "audio_target": dict(contract.audio_target),
                "metadata": dict(contract.metadata),
                "render_context": render_context,
                "rosary_reflections": rosary_reflections,
                "source_path": str(contract.source_path),
            }
            job["content_hash"] = audio_manifest_hash(job, audio_fragments, audio_config)
            jobs.append(
                job
            )
    return jobs



def resolve_audio_jobs(contracts: Sequence[PublishContract], *, target_date: Optional[_dt.date] = None) -> List[Dict[str, Any]]:
    return build_audio_jobs(contracts, target_date=target_date)
