import datetime
import hashlib
import html
import importlib.util
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence
import xml.etree.ElementTree as ET

import imageio_ffmpeg
import requests
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[2]
FFMPEG_BINARY = imageio_ffmpeg.get_ffmpeg_exe()

NOTION_DATABASE_ID = "NOTION_DATABASE_ID"
NOTION_DATABASE_NAME = "NOTION_DATABASE_NAME"
NOTION_TITLE_PROPERTY = "NOTION_TITLE_PROPERTY"
NOTION_PLATFORM_PROPERTY = "NOTION_PLATFORM_PROPERTY"
JOB_UTC_OFFSET = "JOB_UTC_OFFSET"

OPENAI_API_KEY = "OPENAI_API_KEY"
OAI_API_BASE_URL = "OAI_API_BASE_URL"
NOTION_TOKEN = "NOTION_TOKEN"

NOTION_AUDIO_PLATFORM_VALUE = "NOTION_AUDIO_PLATFORM_VALUE"
NOTION_AUDIO_CONFIG_PROPERTY = "NOTION_AUDIO_CONFIG_PROPERTY"
NOTION_AUDIO_RESOLVER_PROPERTY = "NOTION_AUDIO_RESOLVER_PROPERTY"
NOTION_TEXT_RESOLVER_PROPERTY = "NOTION_TEXT_RESOLVER_PROPERTY"
NOTION_AUTO_AUDIO_RESOLVER_PRIMARY_PROPERTY = "NOTION_AUTO_AUDIO_RESOLVER_PRIMARY_PROPERTY"
NOTION_AUTO_AUDIO_RESOLVER_SECONDARY_PROPERTY = "NOTION_AUTO_AUDIO_RESOLVER_SECONDARY_PROPERTY"
NOTION_AUDIO_ENABLED_PROPERTY = "NOTION_AUDIO_ENABLED_PROPERTY"
NOTION_PAGE_AUDIO_CONFIG_DATABASE_ID = "NOTION_PAGE_AUDIO_CONFIG_DATABASE_ID"
NOTION_PAGE_AUDIO_CONFIG_DATABASE_NAME = "NOTION_PAGE_AUDIO_CONFIG_DATABASE_NAME"
NOTION_AUDIO_FRAGMENTS_DATABASE_ID = "NOTION_AUDIO_FRAGMENTS_DATABASE_ID"
NOTION_AUDIO_FRAGMENTS_DATABASE_NAME = "NOTION_AUDIO_FRAGMENTS_DATABASE_NAME"
NOTION_AUDIO_OUTPUTS_DATABASE_ID = "NOTION_AUDIO_OUTPUTS_DATABASE_ID"
NOTION_AUDIO_OUTPUTS_DATABASE_NAME = "NOTION_AUDIO_OUTPUTS_DATABASE_NAME"
PAGE_AUDIO_CONFIG_KEY = "PAGE_AUDIO_CONFIG_KEY"
PAGE_AUDIO_ROW_TITLE = "PAGE_AUDIO_ROW_TITLE"
PAGE_AUDIO_CONFIG_FILE = "PAGE_AUDIO_CONFIG_FILE"
PAGE_AUDIO_CACHE_DIR = "PAGE_AUDIO_CACHE_DIR"
PAGE_AUDIO_FAIL_OPEN = "PAGE_AUDIO_FAIL_OPEN"

DEFAULT_PAGE_AUDIO_CONFIG_FILE = "config/page_audio_config.json"
DEFAULT_PAGE_AUDIO_CACHE_DIR = ".cache/page_audio"
DEFAULT_PAGE_AUDIO_CONFIG_DATABASE_NAME = "Page Audio Configuration"
DEFAULT_AUDIO_FRAGMENTS_DATABASE_NAME = "Audio Fragments"
DEFAULT_AUDIO_OUTPUTS_DATABASE_NAME = "Audio Outputs"
DEFAULT_AUTO_AUDIO_PLATFORM_VALUE = "auto-audio,auto-text"
DEFAULT_AUDIO_CONFIG_PROPERTY = "Audio Configuration"
DEFAULT_TEXT_RESOLVER_PROPERTY = "Text Resolver"
DEFAULT_AUTO_AUDIO_RESOLVER_PRIMARY_PROPERTY = "Auto Audio Resolver 1"
DEFAULT_AUTO_AUDIO_RESOLVER_SECONDARY_PROPERTY = "Auto Audio Resolver 2"
PAGE_AUDIO_MARKER = "[AUTOGEN_PAGE_AUDIO]"
PAGE_AUDIO_HASH_MARKER_PREFIX = "[AUTOGEN_PAGE_AUDIO_HASH:"
PAGE_AUDIO_RENDER_VERSION = "page_audio_v1"
DEFAULT_SILENCE_MS = 450
DEFAULT_DAILY_NOVENA_PAGE_TITLE = "Daily Novenas from Liturgical Calendar"
MORNING_PRAYER_BUILDER = "morning_prayer_v1"
DIVINE_OFFICE_INVITATORY_BUILDER = "divine_office_invitatory_v1"
DIVINE_OFFICE_NIGHT_TEXT_BUILDER = "divine_office_night_text_v1"
DIVINE_OFFICE_MORNING_TEXT_BUILDER = "divine_office_morning_text_v1"
RSS_AUDIO_BUILDER = "rss_audio_v1"
AUDIO_FRAGMENTS_BUILDER = "audio_fragments_v1"
POPES_PRAYER_MEDIA_API_URL = "https://www.popesprayer.va/wp-json/wp/v2/media"
DIVINE_OFFICE_FEED_URL = "https://divineoffice.org/feed/"
DEFAULT_RSS_TEXT_PROPERTY = "Description"
DEFAULT_INTENTION_PROPERTY = "Intention"
DEFAULT_INTENTION_PREFIX = "For today's intention:"
HTTP_RETRYABLE_STATUSES = {408, 409, 425, 429, 500, 502, 503, 504}
HTTP_MAX_ATTEMPTS = 4
MONTH_NAMES = (
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
)
TEXT_SANITIZE_REPLACEMENTS = {
    "without reserve.tog": "without reserve.",
}

PAGE_AUDIO_CONFIG_TITLE_PROPERTY = "Name"
PAGE_AUDIO_CONFIG_ENABLED_PROPERTY = "Enabled"
PAGE_AUDIO_CONFIG_BUILDER_PROPERTY = "Builder"
PAGE_AUDIO_CONFIG_AUDIO_CAPTION_PROPERTY = "Audio Caption"
PAGE_AUDIO_CONFIG_SILENCE_MS_PROPERTY = "Silence Ms"
PAGE_AUDIO_CONFIG_TTS_MODEL_PROPERTY = "TTS Model"
PAGE_AUDIO_CONFIG_TTS_VOICE_PROPERTY = "TTS Voice"
PAGE_AUDIO_CONFIG_TTS_FORMAT_PROPERTY = "TTS Format"
PAGE_AUDIO_CONFIG_TTS_SPEED_PROPERTY = "TTS Speed"
PAGE_AUDIO_CONFIG_MONTHLY_PROVIDER_PROPERTY = "Monthly Intention Provider"
PAGE_AUDIO_CONFIG_MONTHLY_LANGUAGE_PROPERTY = "Monthly Intention Language"
PAGE_AUDIO_CONFIG_DAILY_NOVENA_TITLE_PROPERTY = "Daily Novena Page Title"
PAGE_AUDIO_CONFIG_TEXT_PROPERTY = "Text Property"
PAGE_AUDIO_CONFIG_FEED_URL_PROPERTY = "Feed URL"
PAGE_AUDIO_CONFIG_FEED_MATCH_TEXT_PROPERTY = "Feed Match Text"
PAGE_AUDIO_CONFIG_INTENTION_PROPERTY = "Intention Property"
PAGE_AUDIO_CONFIG_INTENTION_PREFIX_PROPERTY = "Intention Prefix"

AUDIO_FRAGMENT_TITLE_PROPERTY = "Name"
AUDIO_FRAGMENT_KEY_PROPERTY = "Fragment Key"
AUDIO_FRAGMENT_TEXT_PROPERTY = "Spoken Text"
AUDIO_FRAGMENT_ENABLED_PROPERTY = "Enabled"
AUDIO_FRAGMENT_START_DATE_PROPERTY = "Start Date"
AUDIO_FRAGMENT_END_DATE_PROPERTY = "End Date"
AUDIO_FRAGMENT_COLLECTION_PROPERTY = "Collection"
AUDIO_FRAGMENT_ORDER_PROPERTY = "Order"
AUDIO_FRAGMENT_NOTES_PROPERTY = "Notes"
AUDIO_FRAGMENT_DEFAULT_COLLECTION = "audio_fragments"
AUDIO_FRAGMENT_MONTHLY_COLLECTION = "monthly_intention"
AUDIO_FRAGMENT_MONTHLY_PREFIX = "pope-intention-"

AUDIO_OUTPUT_TITLE_PROPERTY = "Name"
AUDIO_OUTPUT_KEY_PROPERTY = "Output Key"
AUDIO_OUTPUT_MODE_PROPERTY = "Output Mode"
AUDIO_OUTPUT_TARGET_ROW_PROPERTY = "Target Row"
AUDIO_OUTPUT_AUDIO_CAPTION_PROPERTY = "Audio Caption"
AUDIO_OUTPUT_FRAGMENT_SEQUENCE_PROPERTY = "Fragment Sequence"
AUDIO_OUTPUT_CONFIG_KEY_PROPERTY = "Config Key"
AUDIO_OUTPUT_TTS_MODEL_PROPERTY = "TTS Model"
AUDIO_OUTPUT_TTS_VOICE_PROPERTY = "TTS Voice"
AUDIO_OUTPUT_TTS_FORMAT_PROPERTY = "TTS Format"
AUDIO_OUTPUT_TTS_SPEED_PROPERTY = "TTS Speed"
AUDIO_OUTPUT_SILENCE_MS_PROPERTY = "Silence Ms"
AUDIO_OUTPUT_ENABLED_PROPERTY = "Enabled"
AUDIO_OUTPUT_NOTES_PROPERTY = "Notes"
AUDIO_OUTPUT_MODE_FRAGMENTS = "fragments"
AUDIO_OUTPUT_MODE_CONFIG = "config"
SPECIAL_DAILY_NOVENA_AUDIO = "SPECIAL:daily_novena_audio"
SPECIAL_MONTHLY_INTENTION = "SPECIAL:monthly_intention"


def load_shared_module():
    shared_path = ROOT / "jobs" / "novena" / "generate_daily_novena_prayer.py"
    spec = importlib.util.spec_from_file_location("page_audio_shared", shared_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load shared module at {shared_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


shared = load_shared_module()


@dataclass
class PageAudioFragment:
    kind: str
    label: str
    hash_value: str
    text: str = ""
    source_url: str = ""
    content_type: str = ""
    cache_path: str = ""
    persist_path: str = ""
    persist_meta_path: str = ""
    fragment_key: str = ""
    collection: str = ""


@dataclass
class PageAudioPlan:
    fragments: List[PageAudioFragment]
    synced_text: str = ""
    text_property: str = ""
    text_target: str = ""
    content_blocks: List[Dict[str, Any]] = field(default_factory=list)


def slugify(text: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", str(text or "").lower()).strip("-")
    return value or "page-audio"


def page_audio_hash_marker(render_hash: str) -> str:
    return f"{PAGE_AUDIO_HASH_MARKER_PREFIX}{str(render_hash or '').strip()}]"


def extract_page_audio_render_hash(text: str) -> str:
    match = re.search(r"\[AUTOGEN_PAGE_AUDIO_HASH:([0-9a-f]{8,64})\]", str(text or "").strip(), re.IGNORECASE)
    return str(match.group(1)).lower() if match else ""


def page_property_text(page: Dict[str, Any], prop_name: str) -> str:
    props = page.get("properties") or {}
    prop = props.get(prop_name) or {}
    ptype = str(prop.get("type", "")).strip()
    if ptype == "title":
        return " ".join(
            str(item.get("plain_text", "")).strip()
            for item in (prop.get("title") or [])
            if isinstance(item, dict) and str(item.get("plain_text", "")).strip()
        ).strip()
    if ptype == "rich_text":
        return " ".join(
            str(item.get("plain_text", "")).strip()
            for item in (prop.get("rich_text") or [])
            if isinstance(item, dict) and str(item.get("plain_text", "")).strip()
        ).strip()
    if ptype == "select":
        return str((prop.get("select") or {}).get("name", "")).strip()
    if ptype == "multi_select":
        return ", ".join(
            str(item.get("name", "")).strip()
            for item in (prop.get("multi_select") or [])
            if isinstance(item, dict) and str(item.get("name", "")).strip()
        ).strip()
    if ptype == "number":
        value = prop.get("number")
        return "" if value is None else str(value).strip()
    if ptype == "url":
        return str(prop.get("url", "")).strip()
    if ptype == "formula":
        formula = prop.get("formula") or {}
        if "string" in formula:
            return str(formula.get("string", "")).strip()
    return ""


def page_property_number(page: Dict[str, Any], prop_name: str, default: float = 0.0) -> float:
    props = page.get("properties") or {}
    prop = props.get(prop_name) or {}
    if str(prop.get("type", "")).strip() == "number":
        value = prop.get("number")
        if value is None:
            return default
        try:
            return float(value)
        except Exception:
            return default
    raw = page_property_text(page, prop_name).strip()
    if not raw:
        return default
    try:
        return float(raw)
    except Exception:
        return default


def page_property_date_range(page: Dict[str, Any], prop_name: str) -> tuple[str, str]:
    props = page.get("properties") or {}
    prop = props.get(prop_name) or {}
    if str(prop.get("type", "")).strip() != "date":
        return "", ""
    value = prop.get("date") or {}
    return str(value.get("start", "")).strip(), str(value.get("end", "")).strip()


def parse_iso_date(value: str) -> Optional[datetime.date]:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.date.fromisoformat(text[:10])
    except Exception:
        return None


def page_property_values(page: Dict[str, Any], prop_name: str) -> List[str]:
    props = page.get("properties") or {}
    prop = props.get(prop_name) or {}
    ptype = str(prop.get("type", "")).strip()
    if ptype == "select":
        value = str((prop.get("select") or {}).get("name", "")).strip()
        return [value] if value else []
    if ptype == "multi_select":
        values = [str(item.get("name", "")).strip() for item in (prop.get("multi_select") or []) if isinstance(item, dict)]
        return [value for value in values if value]
    if ptype in {"title", "rich_text"}:
        value = page_property_text(page, prop_name)
        return [value] if value else []
    if ptype == "formula":
        value = page_property_text(page, prop_name)
        return [value] if value else []
    return []


def page_property_checkbox(page: Dict[str, Any], prop_name: str, default: bool = False) -> bool:
    props = page.get("properties") or {}
    prop = props.get(prop_name) or {}
    if str(prop.get("type", "")).strip() == "checkbox":
        return bool(prop.get("checkbox"))
    value = page_property_text(page, prop_name).strip().lower()
    if not value:
        return default
    return value in {"1", "true", "yes", "y", "on"}


def notion_database_id_by_env_or_name(
    token: str,
    env_id_name: str,
    env_name_name: str,
    default_name: str,
) -> str:
    database_id = os.getenv(env_id_name, "").strip()
    if database_id:
        return database_id
    database_name = os.getenv(env_name_name, default_name).strip() or default_name
    return shared.notion_find_database_id_by_name(token, database_name) or ""


def normalize_flag_value(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(text or "").lower()).strip()


def parse_normalized_values(text: str) -> List[str]:
    raw = str(text or "").strip()
    if not raw:
        return []
    out: List[str] = []
    for part in re.split(r"[,;|\n]+", raw):
        norm = normalize_flag_value(part)
        if norm and norm not in out:
            out.append(norm)
    if not out:
        norm = normalize_flag_value(raw)
        if norm:
            out.append(norm)
    return out


def page_property_normalized_values(page: Dict[str, Any], prop_name: str) -> List[str]:
    out: List[str] = []
    for value in page_property_values(page, prop_name):
        for norm in parse_normalized_values(value):
            if norm and norm not in out:
                out.append(norm)
    return out


def page_has_platform_value(page: Dict[str, Any], prop_name: str, wanted_value: str) -> bool:
    wanted = normalize_flag_value(wanted_value)
    if not wanted:
        return False
    values = page_property_normalized_values(page, prop_name)
    if wanted in values:
        return True
    raw = normalize_flag_value(page_property_text(page, prop_name))
    return bool(raw) and wanted in raw


def normalize_whitespace(text: str) -> str:
    value = str(text or "")
    for bad, good in TEXT_SANITIZE_REPLACEMENTS.items():
        value = value.replace(bad, good)
    value = value.replace("\xa0", " ")
    value = re.sub(r"\s+\n", "\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    value = re.sub(r"[ \t]{2,}", " ", value)
    return value.strip()


def is_parenthesized_placeholder(text: str) -> bool:
    value = str(text or "").strip()
    return len(value) >= 2 and value.startswith("(") and value.endswith(")")


def placeholder_kind(text: str) -> str:
    if not is_parenthesized_placeholder(text):
        return ""
    inner = str(text or "").strip()[1:-1].strip().lower()
    if "daily novena fragment" in inner:
        return "daily_novena"
    if "monthly fragment" in inner:
        return "monthly_intention"
    return ""


def notion_page_audio_config_database_id(token: str) -> str:
    return notion_database_id_by_env_or_name(
        token,
        NOTION_PAGE_AUDIO_CONFIG_DATABASE_ID,
        NOTION_PAGE_AUDIO_CONFIG_DATABASE_NAME,
        DEFAULT_PAGE_AUDIO_CONFIG_DATABASE_NAME,
    )


def notion_audio_fragments_database_id(token: str) -> str:
    return notion_database_id_by_env_or_name(
        token,
        NOTION_AUDIO_FRAGMENTS_DATABASE_ID,
        NOTION_AUDIO_FRAGMENTS_DATABASE_NAME,
        DEFAULT_AUDIO_FRAGMENTS_DATABASE_NAME,
    )


def notion_audio_outputs_database_id(token: str) -> str:
    return notion_database_id_by_env_or_name(
        token,
        NOTION_AUDIO_OUTPUTS_DATABASE_ID,
        NOTION_AUDIO_OUTPUTS_DATABASE_NAME,
        DEFAULT_AUDIO_OUTPUTS_DATABASE_NAME,
    )


def page_audio_config_from_notion_page(page: Dict[str, Any]) -> Optional[tuple[str, Dict[str, Any]]]:
    key = shared.page_title(page, PAGE_AUDIO_CONFIG_TITLE_PROPERTY).strip()
    if not key:
        return None
    if not page_property_checkbox(page, PAGE_AUDIO_CONFIG_ENABLED_PROPERTY, default=True):
        return None

    builder = page_property_text(page, PAGE_AUDIO_CONFIG_BUILDER_PROPERTY).strip()
    audio_caption = page_property_text(page, PAGE_AUDIO_CONFIG_AUDIO_CAPTION_PROPERTY).strip()
    silence_ms_raw = page_property_text(page, PAGE_AUDIO_CONFIG_SILENCE_MS_PROPERTY).strip()
    tts_model = page_property_text(page, PAGE_AUDIO_CONFIG_TTS_MODEL_PROPERTY).strip()
    tts_voice = page_property_text(page, PAGE_AUDIO_CONFIG_TTS_VOICE_PROPERTY).strip()
    tts_format = page_property_text(page, PAGE_AUDIO_CONFIG_TTS_FORMAT_PROPERTY).strip().lower()
    tts_speed_raw = page_property_text(page, PAGE_AUDIO_CONFIG_TTS_SPEED_PROPERTY).strip()
    monthly_provider = page_property_text(page, PAGE_AUDIO_CONFIG_MONTHLY_PROVIDER_PROPERTY).strip()
    monthly_language = page_property_text(page, PAGE_AUDIO_CONFIG_MONTHLY_LANGUAGE_PROPERTY).strip()
    daily_novena_page_title = page_property_text(page, PAGE_AUDIO_CONFIG_DAILY_NOVENA_TITLE_PROPERTY).strip()
    text_property = page_property_text(page, PAGE_AUDIO_CONFIG_TEXT_PROPERTY).strip()
    feed_url = page_property_text(page, PAGE_AUDIO_CONFIG_FEED_URL_PROPERTY).strip()
    feed_match_text = page_property_text(page, PAGE_AUDIO_CONFIG_FEED_MATCH_TEXT_PROPERTY).strip()
    intention_property = page_property_text(page, PAGE_AUDIO_CONFIG_INTENTION_PROPERTY).strip()
    intention_prefix = page_property_text(page, PAGE_AUDIO_CONFIG_INTENTION_PREFIX_PROPERTY).strip()

    config: Dict[str, Any] = {}
    if builder:
        config["builder"] = builder
    if audio_caption:
        config["audio_caption"] = audio_caption
    if silence_ms_raw:
        try:
            config["silence_ms"] = int(float(silence_ms_raw))
        except Exception:
            pass

    tts: Dict[str, Any] = {}
    if tts_model:
        tts["model"] = tts_model
    if tts_voice:
        tts["voice"] = tts_voice
    if tts_format:
        tts["format"] = tts_format
    if tts_speed_raw:
        try:
            tts["speed"] = float(tts_speed_raw)
        except Exception:
            pass
    if tts:
        config["tts"] = tts

    monthly_intention: Dict[str, Any] = {}
    if monthly_provider:
        monthly_intention["provider"] = monthly_provider
    if monthly_language:
        monthly_intention["language"] = monthly_language
    if monthly_intention:
        config["monthly_intention"] = monthly_intention

    if daily_novena_page_title:
        config["daily_novena_page_title"] = daily_novena_page_title
    if text_property:
        config["text_property"] = text_property
    if feed_url:
        config["rss_feed_url"] = feed_url
    if feed_match_text:
        config["rss_match_text"] = feed_match_text
    if intention_property:
        config["intention_property"] = intention_property
    if intention_prefix:
        config["intention_prefix"] = intention_prefix
    return key, config


def load_page_audio_config_from_notion(token: str) -> Dict[str, Any]:
    database_id = notion_page_audio_config_database_id(token)
    if not database_id:
        return {}
    pages = shared.notion_get_all_pages(database_id, token)
    configs: Dict[str, Any] = {}
    for page in pages:
        if not isinstance(page, dict):
            continue
        parsed = page_audio_config_from_notion_page(page)
        if not parsed:
            continue
        key, config = parsed
        configs[key] = config
    return {"configs": configs} if configs else {}


def load_page_audio_config(notion_token: str = "") -> Dict[str, Any]:
    token = str(notion_token or "").strip()
    payload: Dict[str, Any] = {}
    if token:
        notion_payload = load_page_audio_config_from_notion(token)
        notion_configs = notion_payload.get("configs") if isinstance(notion_payload, dict) else None
        if isinstance(notion_configs, dict) and notion_configs:
            payload = notion_payload
    if not payload:
        config_path = ROOT / (
            os.getenv(PAGE_AUDIO_CONFIG_FILE, DEFAULT_PAGE_AUDIO_CONFIG_FILE).strip()
            or DEFAULT_PAGE_AUDIO_CONFIG_FILE
        )
        with open(config_path, "r", encoding="utf-8") as fh:
            payload = json.load(fh)
        if not isinstance(payload, dict):
            raise RuntimeError(f"Invalid page audio config format in {config_path}: root must be an object.")
        configs = payload.get("configs")
        if not isinstance(configs, dict) or not configs:
            raise RuntimeError(f"Invalid page audio config format in {config_path}: missing or empty 'configs'.")

    configs = dict(payload.get("configs") or {})
    if token:
        fragments_payload = load_audio_fragments_from_notion(token)
        fragment_map = fragments_payload.get("fragments") or {}
        output_payload = load_audio_outputs_from_notion(token, fragment_map, configs)
        output_configs = output_payload.get("configs") or {}
        if isinstance(output_configs, dict):
            configs.update(output_configs)
        if fragment_map:
            payload["audio_fragments"] = fragment_map
    payload["configs"] = configs
    return payload


def page_is_active_for_date(
    page: Dict[str, Any],
    *,
    start_property: str,
    end_property: str,
    target_date: datetime.date,
) -> bool:
    start_text, _ = page_property_date_range(page, start_property)
    end_text, _ = page_property_date_range(page, end_property)
    start_date = parse_iso_date(start_text)
    end_date = parse_iso_date(end_text)
    if start_date and target_date < start_date:
        return False
    if end_date and target_date > end_date:
        return False
    return True


def notion_property_payload_for_database(database: Dict[str, Any], prop_name: str, value: Any) -> Optional[Dict[str, Any]]:
    prop_type = shared.notion_property_type(database, prop_name)
    if not prop_type:
        return None
    if prop_type == "checkbox":
        return {"checkbox": bool(value)}
    if prop_type == "date":
        if isinstance(value, tuple):
            start, end = value
        else:
            start, end = value, ""
        start_text = str(start or "").strip()
        end_text = str(end or "").strip()
        return {"date": {"start": start_text, "end": end_text or None}} if start_text else {"date": None}
    if prop_type == "number":
        if value in ("", None):
            return {"number": None}
        return {"number": float(value)}
    return shared.notion_scalar_property_value(prop_type, str(value or "").strip())


def page_property_matches_value(page: Dict[str, Any], prop_name: str, value: Any) -> bool:
    props = page.get("properties") or {}
    prop = props.get(prop_name) or {}
    prop_type = str(prop.get("type", "")).strip()
    if prop_type == "checkbox":
        return bool(prop.get("checkbox")) == bool(value)
    if prop_type == "date":
        current_start, current_end = page_property_date_range(page, prop_name)
        if isinstance(value, tuple):
            wanted_start, wanted_end = value
        else:
            wanted_start, wanted_end = value, ""
        return current_start == str(wanted_start or "").strip() and current_end == str(wanted_end or "").strip()
    if prop_type == "number":
        try:
            current = float(prop.get("number")) if prop.get("number") is not None else None
        except Exception:
            current = None
        if value in ("", None):
            return current is None
        try:
            return current == float(value)
        except Exception:
            return False
    return page_property_text(page, prop_name).strip() == str(value or "").strip()


def audio_fragment_from_notion_page(
    page: Dict[str, Any],
    *,
    target_date: datetime.date,
) -> Optional[tuple[str, Dict[str, Any]]]:
    if not page_property_checkbox(page, AUDIO_FRAGMENT_ENABLED_PROPERTY, default=True):
        return None
    if not page_is_active_for_date(
        page,
        start_property=AUDIO_FRAGMENT_START_DATE_PROPERTY,
        end_property=AUDIO_FRAGMENT_END_DATE_PROPERTY,
        target_date=target_date,
    ):
        return None
    title = shared.page_title(page, AUDIO_FRAGMENT_TITLE_PROPERTY).strip()
    key = page_property_text(page, AUDIO_FRAGMENT_KEY_PROPERTY).strip() or slugify(title)
    text = normalize_whitespace(page_property_text(page, AUDIO_FRAGMENT_TEXT_PROPERTY))
    if not key or not text:
        return None
    collection = page_property_text(page, AUDIO_FRAGMENT_COLLECTION_PROPERTY).strip() or AUDIO_FRAGMENT_DEFAULT_COLLECTION
    return key, {
        "key": key,
        "label": title or key,
        "text": text,
        "collection": collection,
        "order": page_property_number(page, AUDIO_FRAGMENT_ORDER_PROPERTY, default=0.0),
        "notes": page_property_text(page, AUDIO_FRAGMENT_NOTES_PROPERTY).strip(),
    }


def load_audio_fragments_from_notion(token: str) -> Dict[str, Any]:
    database_id = notion_audio_fragments_database_id(token)
    if not database_id:
        return {}
    pages = shared.notion_get_all_pages(database_id, token)
    fragments: Dict[str, Dict[str, Any]] = {}
    for page in pages:
        if not isinstance(page, dict):
            continue
        parsed = audio_fragment_from_notion_page(page, target_date=shared.local_today())
        if not parsed:
            continue
        key, fragment = parsed
        fragments[key] = fragment
    return {"fragments": fragments} if fragments else {}


def parse_fragment_sequence(text: str) -> List[str]:
    out: List[str] = []
    for line in re.split(r"[\r\n]+", str(text or "").strip()):
        for part in re.split(r",", line):
            value = str(part or "").strip()
            if value and value not in out:
                out.append(value)
    return out


def audio_output_common_overrides(page: Dict[str, Any]) -> Dict[str, Any]:
    overrides: Dict[str, Any] = {}
    audio_caption = page_property_text(page, AUDIO_OUTPUT_AUDIO_CAPTION_PROPERTY).strip()
    if audio_caption:
        overrides["audio_caption"] = audio_caption

    silence_raw = page_property_text(page, AUDIO_OUTPUT_SILENCE_MS_PROPERTY).strip()
    if silence_raw:
        overrides["silence_ms"] = int(page_property_number(page, AUDIO_OUTPUT_SILENCE_MS_PROPERTY, default=DEFAULT_SILENCE_MS))

    tts_overrides: Dict[str, Any] = {}
    tts_model = page_property_text(page, AUDIO_OUTPUT_TTS_MODEL_PROPERTY).strip()
    tts_voice = page_property_text(page, AUDIO_OUTPUT_TTS_VOICE_PROPERTY).strip()
    tts_format = page_property_text(page, AUDIO_OUTPUT_TTS_FORMAT_PROPERTY).strip().lower()
    tts_speed_raw = page_property_text(page, AUDIO_OUTPUT_TTS_SPEED_PROPERTY).strip()
    if tts_model:
        tts_overrides["model"] = tts_model
    if tts_voice:
        tts_overrides["voice"] = tts_voice
    if tts_format:
        tts_overrides["format"] = tts_format
    if tts_speed_raw:
        tts_overrides["speed"] = page_property_number(page, AUDIO_OUTPUT_TTS_SPEED_PROPERTY, default=1.0)
    if tts_overrides:
        overrides["tts"] = tts_overrides

    target_row = page_property_text(page, AUDIO_OUTPUT_TARGET_ROW_PROPERTY).strip()
    if target_row:
        overrides["target_row"] = target_row
    notes = page_property_text(page, AUDIO_OUTPUT_NOTES_PROPERTY).strip()
    if notes:
        overrides["notes"] = notes
    return overrides


def apply_audio_output_overrides(base_config: Dict[str, Any], overrides: Dict[str, Any]) -> Dict[str, Any]:
    config = deepcopy(base_config)
    if not overrides:
        return config
    for key, value in overrides.items():
        if key == "tts" and isinstance(value, dict):
            merged_tts = dict(config.get("tts") or {})
            merged_tts.update(value)
            config["tts"] = merged_tts
            continue
        config[key] = value
    return config


def audio_output_config_from_notion_page(
    page: Dict[str, Any],
    fragments: Dict[str, Dict[str, Any]],
    base_configs: Dict[str, Any],
) -> Optional[tuple[str, Dict[str, Any]]]:
    key = page_property_text(page, AUDIO_OUTPUT_KEY_PROPERTY).strip() or shared.page_title(page, AUDIO_OUTPUT_TITLE_PROPERTY).strip()
    if not key:
        return None
    if not page_property_checkbox(page, AUDIO_OUTPUT_ENABLED_PROPERTY, default=True):
        return None
    mode = normalize_flag_value(page_property_text(page, AUDIO_OUTPUT_MODE_PROPERTY)) or AUDIO_OUTPUT_MODE_FRAGMENTS
    overrides = audio_output_common_overrides(page)
    if mode == AUDIO_OUTPUT_MODE_CONFIG:
        source_key = page_property_text(page, AUDIO_OUTPUT_CONFIG_KEY_PROPERTY).strip()
        if not source_key:
            return None
        source_config = base_configs.get(source_key)
        if not isinstance(source_config, dict):
            raise RuntimeError(f"Audio output '{key}' references unknown config '{source_key}'.")
        config = apply_audio_output_overrides(source_config, overrides)
        config["source_config_key"] = source_key
        return key, config
    if mode != AUDIO_OUTPUT_MODE_FRAGMENTS:
        return None
    sequence = parse_fragment_sequence(page_property_text(page, AUDIO_OUTPUT_FRAGMENT_SEQUENCE_PROPERTY))
    if not sequence:
        return None
    default_config: Dict[str, Any] = {
        "builder": AUDIO_FRAGMENTS_BUILDER,
        "audio_caption": f"{shared.page_title(page, AUDIO_OUTPUT_TITLE_PROPERTY).strip() or key} (Audio)",
        "silence_ms": DEFAULT_SILENCE_MS,
        "tts": {
            "model": "gpt-4o-mini-tts",
            "voice": "alloy",
            "format": "mp3",
            "speed": 1.0,
        },
        "fragment_sequence": sequence,
        "fragments": fragments,
        "target_row": page_property_text(page, AUDIO_OUTPUT_TARGET_ROW_PROPERTY).strip(),
        "notes": page_property_text(page, AUDIO_OUTPUT_NOTES_PROPERTY).strip(),
    }
    config = apply_audio_output_overrides(default_config, overrides)
    return key, config


def load_audio_outputs_from_notion(token: str, fragments: Dict[str, Dict[str, Any]], base_configs: Dict[str, Any]) -> Dict[str, Any]:
    database_id = notion_audio_outputs_database_id(token)
    if not database_id:
        return {}
    pages = shared.notion_get_all_pages(database_id, token)
    configs: Dict[str, Any] = {}
    for page in pages:
        if not isinstance(page, dict):
            continue
        parsed = audio_output_config_from_notion_page(page, fragments, base_configs)
        if not parsed:
            continue
        key, config = parsed
        configs[key] = config
    return {"configs": configs} if configs else {}


def page_audio_cache_dir() -> Path:
    value = os.getenv(PAGE_AUDIO_CACHE_DIR, DEFAULT_PAGE_AUDIO_CACHE_DIR).strip() or DEFAULT_PAGE_AUDIO_CACHE_DIR
    path = ROOT / value
    path.mkdir(parents=True, exist_ok=True)
    return path


def page_audio_http_should_retry(exc: requests.exceptions.RequestException) -> bool:
    if isinstance(exc, (requests.exceptions.Timeout, requests.exceptions.ConnectionError)):
        return True
    if isinstance(exc, requests.exceptions.HTTPError):
        response = exc.response
        return bool(response is not None and response.status_code in HTTP_RETRYABLE_STATUSES)
    return False


def page_audio_http_retry_delay(exc: requests.exceptions.RequestException, attempt: int) -> float:
    if isinstance(exc, requests.exceptions.HTTPError) and exc.response is not None:
        retry_after = str(exc.response.headers.get("Retry-After", "")).strip()
        if retry_after:
            try:
                return max(0.0, float(retry_after))
            except ValueError:
                pass
    return min(20.0, float(2 ** max(attempt - 1, 0)))


def page_audio_http_get(url: str, *, params: Optional[Dict[str, Any]] = None, timeout: int = 30) -> requests.Response:
    for attempt in range(1, HTTP_MAX_ATTEMPTS + 1):
        try:
            response = requests.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as exc:
            if attempt >= HTTP_MAX_ATTEMPTS or not page_audio_http_should_retry(exc):
                raise
            delay = page_audio_http_retry_delay(exc, attempt)
            print(
                f"WARN page_audio_http_retry attempt={attempt} delay={delay:.1f}s url={url}",
                file=sys.stderr,
            )
            time.sleep(delay)
    raise RuntimeError("HTTP retry loop exited unexpectedly.")


def tts_settings_from_config(config: Dict[str, Any]) -> Dict[str, Any]:
    tts = config.get("tts") or {}
    if not isinstance(tts, dict):
        raise RuntimeError("Invalid page audio config: 'tts' must be an object.")
    model = str(tts.get("model", "gpt-4o-mini-tts")).strip() or "gpt-4o-mini-tts"
    voice = str(tts.get("voice", "alloy")).strip() or "alloy"
    audio_format = str(tts.get("format", "mp3")).strip().lower() or "mp3"
    if audio_format not in {"mp3", "opus", "aac", "flac", "wav"}:
        raise RuntimeError(f"Invalid page audio format '{audio_format}'.")
    try:
        speed = float(tts.get("speed", 1.0))
    except Exception as exc:
        raise RuntimeError("Invalid page audio speed.") from exc
    return {"model": model, "voice": voice, "format": audio_format, "speed": speed}


def list_audio_candidate_pages(
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    platform_property: str,
    platform_value: str,
    enabled_property: str,
    row_title_filter: str,
) -> List[Dict[str, Any]]:
    wanted_platforms = parse_normalized_values(platform_value) or parse_normalized_values(DEFAULT_AUTO_AUDIO_PLATFORM_VALUE)
    wanted_title = str(row_title_filter or "").strip().lower()
    out: List[Dict[str, Any]] = []
    for page in pages:
        if not isinstance(page, dict):
            continue
        title = shared.page_title(page, title_property).strip()
        if wanted_title and title.lower() != wanted_title:
            continue
        if not page_property_checkbox(page, enabled_property, default=False):
            continue
        if not any(page_has_platform_value(page, platform_property, value) for value in wanted_platforms):
            continue
        out.append(page)
    return out


def page_text_config_key_from_page(
    page: Dict[str, Any],
    text_resolver_property: str,
    legacy_config_property: str,
) -> str:
    primary = page_property_text(page, text_resolver_property).strip()
    if primary:
        return primary
    return page_property_text(page, legacy_config_property).strip()


def page_auto_audio_config_keys_from_page(
    page: Dict[str, Any],
    primary_property: str,
    secondary_property: str,
    legacy_config_property: str,
    legacy_resolver_property: str,
) -> List[str]:
    out: List[str] = []
    for prop_name in (primary_property, secondary_property, legacy_config_property, legacy_resolver_property):
        value = page_property_text(page, prop_name).strip()
        if value and value not in out:
            out.append(value)
    return out


def find_page_by_title(pages: Sequence[Dict[str, Any]], title_property: str, wanted_title: str) -> Dict[str, Any]:
    wanted = str(wanted_title or "").strip().lower()
    for page in pages:
        if not isinstance(page, dict):
            continue
        if shared.page_title(page, title_property).strip().lower() == wanted:
            return page
    raise RuntimeError(f"Could not find page titled '{wanted_title}'.")


def resolved_placeholder_text(text: str, monthly_text: str) -> Optional[str]:
    value = normalize_whitespace(text)
    kind = placeholder_kind(value)
    if kind == "monthly_intention":
        return monthly_text
    if kind == "daily_novena":
        return None
    return value


def child_text_lines(block: Dict[str, Any], token: str, monthly_text: str) -> List[str]:
    block_type = str(block.get("type", "")).strip()
    text = resolved_placeholder_text(shared.block_rich_text_plain(block), monthly_text)
    lines: List[str] = []
    if text and block_type not in {"heading_1", "heading_2", "heading_3"}:
        lines.append(text)
    if bool(block.get("has_children")):
        block_id = str(block.get("id", "")).strip()
        if block_id:
            for child in shared.notion_list_block_children(block_id, token):
                child_text = resolved_placeholder_text(shared.block_rich_text_plain(child), monthly_text)
                if child_text:
                    lines.append(child_text)
    return [line for line in lines if line]


def build_monthly_intention_fragment(monthly_intention: Dict[str, str], settings: Dict[str, Any], base_url: str) -> PageAudioFragment:
    spoken_text = str(monthly_intention.get("spoken_text", "")).strip()
    if not spoken_text:
        raise RuntimeError("Monthly intention resolver returned empty text.")
    return stable_text_fragment(
        cache_root=page_audio_cache_dir(),
        collection=AUDIO_FRAGMENT_MONTHLY_COLLECTION,
        key=monthly_intention.get("month", "") or monthly_intention.get("title", "") or "monthly-intention",
        label=f"Monthly Intention - {monthly_intention.get('title', '').strip() or monthly_intention.get('month', '').strip()}",
        text=spoken_text,
        settings=settings,
        base_url=base_url,
    )


def stable_text_fragment(
    *,
    cache_root: Path,
    collection: str,
    key: str,
    label: str,
    text: str,
    settings: Dict[str, Any],
    base_url: str,
) -> PageAudioFragment:
    value = normalize_whitespace(text)
    hash_value = shared.compute_audio_render_hash(value, base_url, settings)
    reusable = load_library_audio_fragment(
        cache_root=cache_root,
        collection=collection,
        key=key,
        label=label,
        hash_value=hash_value,
        audio_format=str(settings["format"]),
    )
    if reusable is not None:
        reusable.fragment_key = key
        reusable.collection = collection
        return reusable
    audio_path, meta_path = page_audio_library_fragment_paths(
        cache_root,
        collection,
        key,
        str(settings["format"]),
    )
    return PageAudioFragment(
        kind="tts",
        label=label,
        hash_value=hash_value,
        text=value,
        persist_path=str(audio_path),
        persist_meta_path=str(meta_path),
        fragment_key=key,
        collection=collection,
    )


def build_page_intention_fragment(
    page: Dict[str, Any],
    *,
    settings: Dict[str, Any],
    base_url: str,
    intention_property: str,
    intention_prefix: str,
) -> Optional[PageAudioFragment]:
    intention_text = page_property_text(page, intention_property).strip()
    if not intention_text:
        return None
    title_property = os.getenv(NOTION_TITLE_PROPERTY, "Name").strip() or "Name"
    page_key = shared.page_title(page, title_property).strip() or str(page.get("id", "")).strip() or "page"
    spoken = normalize_whitespace(f"{intention_prefix} {intention_text}")
    return stable_text_fragment(
        cache_root=page_audio_cache_dir(),
        collection="daily_intentions",
        key=page_key,
        label=f"Daily Intention - {page_key}",
        text=spoken,
        settings=settings,
        base_url=base_url,
    )


def audio_block_source_url(block: Dict[str, Any]) -> str:
    audio = block.get("audio") or {}
    audio_type = str(audio.get("type", "")).strip()
    if audio_type == "file":
        return str((audio.get("file") or {}).get("url", "")).strip()
    if audio_type == "external":
        return str((audio.get("external") or {}).get("url", "")).strip()
    return ""


def source_audio_fragment_hash(block: Dict[str, Any]) -> str:
    caption = shared.audio_block_caption(block)
    render_hash = shared.extract_render_hash(caption)
    if render_hash:
        return render_hash
    url = audio_block_source_url(block)
    raw = f"{caption}|{url}|{str(block.get('id', '')).strip()}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


def build_daily_novena_audio_fragments(
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    daily_novena_page_title: str,
    token: str,
) -> List[PageAudioFragment]:
    page = find_page_by_title(pages, title_property, daily_novena_page_title)
    page_id = str(page.get("id", "")).strip()
    if not page_id:
        raise RuntimeError("Daily novena source page has no id.")
    out: List[PageAudioFragment] = []
    for block in shared.notion_list_block_children(page_id, token):
        if str(block.get("type", "")).strip() != "audio":
            continue
        caption = shared.audio_block_caption(block)
        if shared.NOVENA_AUDIO_MARKER not in caption:
            continue
        url = audio_block_source_url(block)
        if not url:
            continue
        out.append(
            PageAudioFragment(
                kind="source_audio",
                label=caption or "Daily Novena Audio",
                hash_value=source_audio_fragment_hash(block),
                source_url=url,
            )
        )
    if not out:
        raise RuntimeError(f"No generated novena audio blocks found on '{daily_novena_page_title}'.")
    return out


def resolve_output_sequence_fragment(
    sequence_key: str,
    *,
    fragments_map: Dict[str, Dict[str, Any]],
    settings: Dict[str, Any],
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    config: Dict[str, Any],
    token: str,
    base_url: str,
) -> List[PageAudioFragment]:
    cache_root = page_audio_cache_dir()
    value = str(sequence_key or "").strip()
    if not value:
        return []
    if value.upper() == SPECIAL_DAILY_NOVENA_AUDIO.upper():
        novena_page_title = (
            str(config.get("daily_novena_page_title", DEFAULT_DAILY_NOVENA_PAGE_TITLE)).strip()
            or DEFAULT_DAILY_NOVENA_PAGE_TITLE
        )
        return build_daily_novena_audio_fragments(pages, title_property, novena_page_title, token)
    if value.upper() == SPECIAL_MONTHLY_INTENTION.upper():
        monthly_intention = fetch_monthly_intention(shared.local_today())
        return [build_monthly_intention_fragment(monthly_intention, settings, base_url)]
    spec = fragments_map.get(value)
    if not isinstance(spec, dict):
        raise RuntimeError(f"Unknown audio fragment '{value}'.")
    return [
        stable_text_fragment(
            cache_root=cache_root,
            collection=str(spec.get("collection", AUDIO_FRAGMENT_DEFAULT_COLLECTION)).strip() or AUDIO_FRAGMENT_DEFAULT_COLLECTION,
            key=str(spec.get("key", value)).strip() or value,
            label=str(spec.get("label", value)).strip() or value,
            text=str(spec.get("text", "")).strip(),
            settings=settings,
            base_url=base_url,
        )
    ]


def build_fragment_output_plan(
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    config: Dict[str, Any],
    token: str,
    base_url: str,
) -> PageAudioPlan:
    settings = tts_settings_from_config(config)
    fragments_map = config.get("fragments") or {}
    if not isinstance(fragments_map, dict):
        raise RuntimeError("Invalid audio output config: fragments must be a map.")
    sequence = config.get("fragment_sequence") or []
    if not isinstance(sequence, list):
        raise RuntimeError("Invalid audio output config: fragment_sequence must be a list.")
    fragments: List[PageAudioFragment] = []
    for entry in sequence:
        fragments.extend(
            resolve_output_sequence_fragment(
                str(entry or "").strip(),
                fragments_map=fragments_map,
                settings=settings,
                pages=pages,
                title_property=title_property,
                config=config,
                token=token,
                base_url=base_url,
            )
        )
    if not fragments:
        raise RuntimeError("Audio output did not produce any fragments.")
    return PageAudioPlan(fragments=fragments)


def build_morning_prayer_fragments(
    page: Dict[str, Any],
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    config: Dict[str, Any],
    token: str,
    base_url: str,
) -> List[PageAudioFragment]:
    page_id = str(page.get("id", "")).strip()
    if not page_id:
        raise RuntimeError("Target page has no id.")
    settings = tts_settings_from_config(config)
    cache_root = page_audio_cache_dir()
    monthly_intention = fetch_monthly_intention(shared.local_today())
    monthly_fragment = build_monthly_intention_fragment(monthly_intention, settings, base_url)
    novena_page_title = (
        str(config.get("daily_novena_page_title", DEFAULT_DAILY_NOVENA_PAGE_TITLE)).strip()
        or DEFAULT_DAILY_NOVENA_PAGE_TITLE
    )
    daily_novena_fragments = build_daily_novena_audio_fragments(pages, title_property, novena_page_title, token)

    fragments: List[PageAudioFragment] = []
    current_heading = ""
    current_lines: List[str] = []

    def stable_morning_fragment(label: str, text: str) -> PageAudioFragment:
        return stable_text_fragment(
            cache_root=cache_root,
            collection="morning_prayer",
            key=label,
            label=label,
            text=text,
            settings=settings,
            base_url=base_url,
        )

    def flush_heading() -> None:
        nonlocal current_heading, current_lines
        if not current_heading or not current_lines:
            current_heading = ""
            current_lines = []
            return
        body = normalize_whitespace("\n".join(current_lines))
        if not body:
            current_heading = ""
            current_lines = []
            return
        text = normalize_whitespace(f"{current_heading}.\n\n{body}")
        fragments.append(stable_morning_fragment(current_heading, text))
        current_heading = ""
        current_lines = []

    for block in shared.notion_list_block_children(page_id, token):
        block_type = str(block.get("type", "")).strip()
        if block_type in {"bookmark", "audio"}:
            continue
        text = normalize_whitespace(shared.block_rich_text_plain(block))
        kind = placeholder_kind(text)
        if block_type == "heading_2":
            continue
        if block_type == "heading_3":
            flush_heading()
            current_heading = text
            current_lines = child_text_lines(block, token, monthly_fragment.text)
            continue
        if kind == "daily_novena":
            flush_heading()
            fragments.extend(daily_novena_fragments)
            continue
        lines = child_text_lines(block, token, monthly_fragment.text)
        if not lines:
            continue
        if current_heading:
            current_lines.extend(lines)
        else:
            text = normalize_whitespace("\n".join(lines))
            fragments.append(stable_morning_fragment(text[:80], text))

    flush_heading()
    if not fragments:
        raise RuntimeError("No audio fragments were produced for Morning Prayer.")
    return fragments


def plain_text_paragraphs_from_html(raw_html: str) -> List[str]:
    value = str(raw_html or "").strip()
    if not value:
        return []
    value = re.sub(r"(?is)<\s*br\s*/?\s*>", "\n", value)
    value = re.sub(r"(?is)</\s*p\s*>", "\n\n", value)
    value = re.sub(r"(?is)</\s*li\s*>", "\n", value)
    value = re.sub(r"(?is)<\s*li\b[^>]*>", "\n- ", value)
    value = re.sub(r"(?is)</\s*h[1-6]\s*>", "\n\n", value)
    value = re.sub(r"(?is)<[^>]+>", "", value)
    value = html.unescape(value)
    value = value.replace("\r", "")
    value = re.sub(r"\n{3,}", "\n\n", value)
    paragraphs = [normalize_whitespace(part) for part in re.split(r"\n\s*\n", value) if normalize_whitespace(part)]
    return paragraphs


def paragraphs_to_notion_blocks(paragraphs: Sequence[str]) -> List[Dict[str, Any]]:
    blocks: List[Dict[str, Any]] = []
    for paragraph in paragraphs:
        text = normalize_whitespace(paragraph)
        if not text:
            continue
        rich_text = [{"type": "text", "text": {"content": chunk}} for chunk in shared.split_text_chunks(text, 1900)]
        blocks.append({"object": "block", "type": "paragraph", "paragraph": {"rich_text": rich_text}})
    return blocks


def desired_block_signature(blocks: Sequence[Dict[str, Any]]) -> List[tuple[str, str]]:
    out: List[tuple[str, str]] = []
    for block in blocks:
        block_type = str(block.get("type", "")).strip()
        payload = block.get(block_type) or {}
        rich = payload.get("rich_text") or []
        text = ""
        if isinstance(rich, list):
            text = " ".join(str(item.get("plain_text", "")).strip() for item in rich if isinstance(item, dict)).strip()
        out.append((block_type, normalize_whitespace(text)))
    return out


def existing_content_signature(blocks: Sequence[Dict[str, Any]]) -> List[tuple[str, str]]:
    out: List[tuple[str, str]] = []
    for block in blocks:
        block_type = str(block.get("type", "")).strip()
        out.append((block_type, normalize_whitespace(shared.block_rich_text_plain(block))))
    return out


def sync_page_content_blocks(page_id: str, token: str, desired_blocks: Sequence[Dict[str, Any]]) -> bool:
    existing = shared.notion_list_block_children(page_id, token)
    preserved: List[Dict[str, Any]] = []
    removable: List[Dict[str, Any]] = []
    for block in existing:
        block_type = str(block.get("type", "")).strip()
        if block_type in {"bookmark", "audio"}:
            preserved.append(block)
        else:
            removable.append(block)
    if existing_content_signature(removable) == desired_block_signature(desired_blocks):
        return False
    for block in removable:
        block_id = str(block.get("id", "")).strip()
        if block_id:
            shared.notion_archive_block(block_id, token)
    if not desired_blocks:
        return bool(removable)
    if preserved:
        shared.notion_append_children(page_id, list(desired_blocks), token, position="end")
    else:
        shared.notion_append_children(page_id, list(desired_blocks), token, position="start")
    return True


def divine_office_title_date(title: str, target_year: int) -> Optional[datetime.date]:
    value = str(title or "").strip()
    match = re.match(r"^([A-Za-z]{3,9})\s+(\d{1,2}),", value)
    if match:
        month_token = match.group(1).strip()
        day = int(match.group(2))
        for fmt in ("%b", "%B"):
            try:
                month = datetime.datetime.strptime(month_token, fmt).month
                return datetime.date(target_year, month, day)
            except ValueError:
                continue
    numeric_match = re.match(r"^(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b", value)
    if not numeric_match:
        return None
    month = int(numeric_match.group(1))
    day = int(numeric_match.group(2))
    year_token = numeric_match.group(3)
    year = int(year_token)
    if len(year_token) == 2:
        year += 2000
    try:
        return datetime.date(year, month, day)
    except ValueError:
        return None


def fetch_divine_office_feed_entry(
    target_date: datetime.date,
    feed_url: str = DIVINE_OFFICE_FEED_URL,
    match_text: str = "Invitatory",
) -> Dict[str, str]:
    response = page_audio_http_get(feed_url, timeout=30)
    root = ET.fromstring(response.content)
    channel = root.find("channel")
    if channel is None:
        raise RuntimeError(f"Invalid RSS feed at {feed_url}.")
    wanted = str(match_text or "").strip().lower()
    exact: Optional[Dict[str, str]] = None
    latest_past: Optional[Dict[str, str]] = None
    latest_past_date: Optional[datetime.date] = None
    for item in channel.findall("item"):
        title = str(item.findtext("title", "")).strip()
        if wanted and wanted not in title.lower():
            continue
        item_date = divine_office_title_date(title, target_date.year)
        if item_date is None:
            continue
        enclosure = item.find("enclosure")
        audio_url = str((enclosure.attrib if enclosure is not None else {}).get("url", "")).strip()
        if not audio_url:
            continue
        content_node = item.find("{http://purl.org/rss/1.0/modules/content/}encoded")
        html_body = str(content_node.text if content_node is not None else item.findtext("description", "") or "").strip()
        text_body = "\n\n".join(plain_text_paragraphs_from_html(html_body))
        entry = {
            "title": title,
            "audio_url": audio_url,
            "source_url": str(item.findtext("link", "")).strip(),
            "text": text_body,
            "content_html": html_body,
            "match_text": match_text,
            "feed_url": feed_url,
            "date": item_date.isoformat(),
        }
        if item_date == target_date:
            exact = entry
            break
        if item_date <= target_date and (latest_past_date is None or item_date > latest_past_date):
            latest_past = entry
            latest_past_date = item_date
    chosen = exact or latest_past
    if chosen is None:
        raise RuntimeError(f"No '{match_text}' entry found in {feed_url} for {target_date.isoformat()} or earlier.")
    return chosen


def build_divine_office_invitatory_plan(
    page: Dict[str, Any],
    config: Dict[str, Any],
    base_url: str,
) -> PageAudioPlan:
    settings = tts_settings_from_config(config)
    intention_property = str(config.get("intention_property", DEFAULT_INTENTION_PROPERTY)).strip() or DEFAULT_INTENTION_PROPERTY
    intention_prefix = str(config.get("intention_prefix", DEFAULT_INTENTION_PREFIX)).strip() or DEFAULT_INTENTION_PREFIX
    feed_url = str(config.get("rss_feed_url", DIVINE_OFFICE_FEED_URL)).strip() or DIVINE_OFFICE_FEED_URL
    match_text = str(config.get("rss_match_text", "Invitatory")).strip() or "Invitatory"
    feed_entry = fetch_divine_office_feed_entry(shared.local_today(), feed_url=feed_url, match_text=match_text)

    fragments: List[PageAudioFragment] = []
    intention_fragment = build_page_intention_fragment(
        page,
        settings=settings,
        base_url=base_url,
        intention_property=intention_property,
        intention_prefix=intention_prefix,
    )
    if intention_fragment is not None:
        fragments.append(intention_fragment)

    audio_hash = hashlib.sha256(
        f"{feed_entry['title']}|{feed_entry['audio_url']}|{feed_entry['date']}".encode("utf-8")
    ).hexdigest()[:16]
    fragments.append(
        PageAudioFragment(
            kind="source_audio",
            label=feed_entry["title"],
            hash_value=audio_hash,
            source_url=feed_entry["audio_url"],
        )
    )
    paragraphs = plain_text_paragraphs_from_html(feed_entry.get("content_html", ""))
    return PageAudioPlan(
        fragments=fragments,
        synced_text="",
        text_property=str(config.get("text_property", DEFAULT_RSS_TEXT_PROPERTY)).strip() or DEFAULT_RSS_TEXT_PROPERTY,
        text_target="page_content",
        content_blocks=paragraphs_to_notion_blocks(paragraphs),
    )


def build_divine_office_night_text_plan(config: Dict[str, Any]) -> PageAudioPlan:
    feed_entry = fetch_divine_office_feed_entry(shared.local_today(), feed_url=DIVINE_OFFICE_FEED_URL, match_text="Night Prayer")
    paragraphs = plain_text_paragraphs_from_html(feed_entry.get("content_html", ""))
    return PageAudioPlan(
        fragments=[],
        text_target="page_content",
        content_blocks=paragraphs_to_notion_blocks(paragraphs),
    )


def build_divine_office_morning_text_plan(config: Dict[str, Any]) -> PageAudioPlan:
    entry = fetch_divine_office_feed_entry(shared.local_today(), feed_url=DIVINE_OFFICE_FEED_URL, match_text="Morning Prayer")
    paragraphs = plain_text_paragraphs_from_html(entry.get("content_html", ""))
    return PageAudioPlan(
        fragments=[],
        text_target="page_content",
        content_blocks=paragraphs_to_notion_blocks(paragraphs),
    )


def build_rss_audio_plan(
    page: Dict[str, Any],
    config: Dict[str, Any],
    base_url: str,
) -> PageAudioPlan:
    settings = tts_settings_from_config(config)
    feed_url = str(config.get("rss_feed_url", "")).strip()
    if not feed_url:
        raise RuntimeError("rss_audio_v1 requires 'rss_feed_url'.")
    match_text = str(config.get("rss_match_text", "")).strip()
    if not match_text:
        raise RuntimeError("rss_audio_v1 requires 'rss_match_text'.")
    feed_entry = fetch_divine_office_feed_entry(shared.local_today(), feed_url=feed_url, match_text=match_text)

    fragments: List[PageAudioFragment] = []
    intention_property = str(config.get("intention_property", DEFAULT_INTENTION_PROPERTY)).strip() or DEFAULT_INTENTION_PROPERTY
    intention_prefix = str(config.get("intention_prefix", DEFAULT_INTENTION_PREFIX)).strip() or DEFAULT_INTENTION_PREFIX
    intention_fragment = build_page_intention_fragment(
        page,
        settings=settings,
        base_url=base_url,
        intention_property=intention_property,
        intention_prefix=intention_prefix,
    )
    if intention_fragment is not None:
        fragments.append(intention_fragment)

    audio_hash = hashlib.sha256(
        f"{feed_entry['title']}|{feed_entry['audio_url']}|{feed_entry['date']}".encode("utf-8")
    ).hexdigest()[:16]
    fragments.append(
        PageAudioFragment(
            kind="source_audio",
            label=feed_entry["title"],
            hash_value=audio_hash,
            source_url=feed_entry["audio_url"],
        )
    )
    paragraphs = plain_text_paragraphs_from_html(feed_entry.get("content_html", ""))
    return PageAudioPlan(
        fragments=fragments,
        text_target="page_content",
        content_blocks=paragraphs_to_notion_blocks(paragraphs),
        text_property=str(config.get("text_property", DEFAULT_RSS_TEXT_PROPERTY)).strip() or DEFAULT_RSS_TEXT_PROPERTY,
    )


def compute_page_render_hash(
    config_key: str,
    config: Dict[str, Any],
    fragments: Sequence[PageAudioFragment],
) -> str:
    payload = {
        "type": PAGE_AUDIO_RENDER_VERSION,
        "config_key": str(config_key or "").strip(),
        "builder": str(config.get("builder", "")).strip(),
        "audio_caption": str(config.get("audio_caption", "")).strip(),
        "silence_ms": int(config.get("silence_ms", DEFAULT_SILENCE_MS)),
        "tts": tts_settings_from_config(config),
        "fragments": [
            {"label": fragment.label, "hash": fragment.hash_value, "key": fragment.fragment_key, "collection": fragment.collection}
            for fragment in fragments
        ],
    }
    return shared.compute_render_hash(payload)


def page_audio_cache_path(cache_root: Path, bucket: str, hash_value: str, extension: str) -> Path:
    clean_ext = str(extension or "").strip().lstrip(".") or "bin"
    path = cache_root / bucket / hash_value[:2] / hash_value[2:4]
    path.mkdir(parents=True, exist_ok=True)
    return path / f"{hash_value}.{clean_ext}"


def page_audio_library_fragment_paths(
    cache_root: Path,
    collection: str,
    key: str,
    extension: str,
) -> tuple[Path, Path]:
    clean_ext = str(extension or "").strip().lstrip(".") or "bin"
    collection_slug = slugify(collection)
    key_slug = slugify(key)
    directory = cache_root / "fragments" / collection_slug
    directory.mkdir(parents=True, exist_ok=True)
    return directory / f"{key_slug}.{clean_ext}", directory / f"{key_slug}.json"


def legacy_page_audio_library_fragment_paths(
    cache_root: Path,
    collection: str,
    key: str,
    extension: str,
) -> tuple[Path, Path]:
    clean_ext = str(extension or "").strip().lstrip(".") or "bin"
    collection_slug = slugify(collection)
    key_slug = slugify(key)
    directory = cache_root / "library" / collection_slug
    return directory / f"{key_slug}.{clean_ext}", directory / f"{key_slug}.json"


def load_library_audio_fragment(
    cache_root: Path,
    collection: str,
    key: str,
    label: str,
    hash_value: str,
    audio_format: str,
) -> Optional[PageAudioFragment]:
    for audio_path, meta_path in (
        page_audio_library_fragment_paths(cache_root, collection, key, audio_format),
        legacy_page_audio_library_fragment_paths(cache_root, collection, key, audio_format),
    ):
        if not audio_path.exists() or not meta_path.exists():
            continue
        try:
            payload = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        cached_hash = str(payload.get("hash_value", "")).strip().lower()
        if not cached_hash or cached_hash != str(hash_value or "").strip().lower():
            continue
        return PageAudioFragment(
            kind="source_audio",
            label=label,
            hash_value=hash_value,
            cache_path=str(audio_path),
            text=normalize_whitespace(str(payload.get("text", "")).strip()),
            fragment_key=str(payload.get("fragment_key", "")).strip() or key,
            collection=str(payload.get("collection", "")).strip() or collection,
        )
    return None


def persist_library_audio_fragment(
    fragment: PageAudioFragment,
    source_path: Path,
    settings: Dict[str, Any],
) -> None:
    persist_path = str(fragment.persist_path or "").strip()
    persist_meta_path = str(fragment.persist_meta_path or "").strip()
    if not persist_path or not persist_meta_path:
        return
    target_path = Path(persist_path)
    meta_path = Path(persist_meta_path)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    if source_path.resolve() != target_path.resolve():
        shutil.copyfile(source_path, target_path)
    payload = {
        "label": fragment.label,
        "hash_value": fragment.hash_value,
        "format": str(settings.get("format", "")),
        "model": str(settings.get("model", "")),
        "voice": str(settings.get("voice", "")),
        "speed": float(settings.get("speed", 1.0)),
        "text": normalize_whitespace(fragment.text),
        "fragment_key": str(fragment.fragment_key or "").strip(),
        "collection": str(fragment.collection or "").strip(),
    }
    meta_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def page_audio_current_render_hash(page_id: str, token: str) -> str:
    for block in shared.notion_list_block_children(page_id, token):
        if str(block.get("type", "")).strip() != "audio":
            continue
        caption = shared.audio_block_caption(block)
        if PAGE_AUDIO_MARKER not in caption:
            continue
        render_hash = extract_page_audio_render_hash(caption)
        if render_hash:
            return render_hash
    return ""


def page_audio_is_positioned_near_top(page_id: str, token: str) -> bool:
    blocks = shared.notion_list_block_children(page_id, token)
    for idx, block in enumerate(blocks):
        if str(block.get("type", "")).strip() != "audio":
            continue
        caption = shared.audio_block_caption(block)
        if PAGE_AUDIO_MARKER not in caption:
            continue
        return idx == 0
    return False


def page_audio_remove_old_blocks(page_id: str, token: str) -> int:
    removed = 0
    for block in shared.notion_list_block_children(page_id, token):
        if str(block.get("type", "")).strip() != "audio":
            continue
        caption = shared.audio_block_caption(block)
        if PAGE_AUDIO_MARKER not in caption:
            continue
        block_id = str(block.get("id", "")).strip()
        if not block_id:
            continue
        shared.notion_archive_block(block_id, token)
        removed += 1
    return removed


def page_audio_remove_blank_placeholders(page_id: str, token: str) -> int:
    removed = 0
    for block in shared.notion_list_block_children(page_id, token):
        if str(block.get("type", "")).strip() != "audio":
            continue
        caption = shared.audio_block_caption(block)
        url = audio_block_source_url(block)
        if caption or url:
            continue
        block_id = str(block.get("id", "")).strip()
        if not block_id:
            continue
        shared.notion_archive_block(block_id, token)
        removed += 1
    return removed


def page_audio_append_block(page_id: str, upload_id: str, caption: str, token: str, position: str = "start") -> None:
    full_caption = f"{str(caption or '').strip()} {PAGE_AUDIO_MARKER}".strip()
    block = {
        "object": "block",
        "type": "audio",
        "audio": {
            "type": "file_upload",
            "file_upload": {"id": upload_id},
            "caption": [{"type": "text", "text": {"content": full_caption}}],
        },
    }
    shared.notion_append_children(page_id, [block], token, position=position)


def ffmpeg_audio_codec(audio_format: str) -> str:
    fmt = str(audio_format or "").strip().lower()
    if fmt == "mp3":
        return "libmp3lame"
    if fmt == "wav":
        return "pcm_s16le"
    if fmt == "aac":
        return "aac"
    if fmt == "opus":
        return "libopus"
    if fmt == "flac":
        return "flac"
    raise RuntimeError(f"Unsupported ffmpeg audio format '{audio_format}'.")


def run_ffmpeg(args: Sequence[str]) -> None:
    command = [FFMPEG_BINARY, *args]
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        stderr = str(completed.stderr or "").strip()
        raise RuntimeError(stderr or f"ffmpeg failed with exit code {completed.returncode}.")


def ensure_tts_fragment_audio(
    fragment: PageAudioFragment,
    settings: Dict[str, Any],
    cache_root: Path,
    openai_key: str,
    base_url: str,
) -> Path:
    cache_path = page_audio_cache_path(cache_root, "tts", fragment.hash_value, str(settings["format"]))
    if cache_path.exists():
        persist_library_audio_fragment(fragment, cache_path, settings)
        return cache_path
    audio_bytes = shared.generate_openai_audio_bytes(
        api_key=openai_key,
        base_url=base_url,
        model=str(settings["model"]),
        voice=str(settings["voice"]),
        audio_format=str(settings["format"]),
        speed=float(settings["speed"]),
        text=fragment.text,
    )
    cache_path.write_bytes(audio_bytes)
    persist_library_audio_fragment(fragment, cache_path, settings)
    return cache_path


def ensure_source_audio_fragment(fragment: PageAudioFragment, cache_root: Path) -> Path:
    existing = str(fragment.cache_path or "").strip()
    if existing:
        path = Path(existing)
        if path.exists():
            return path
    raw, content_type = shared.notion_download_bytes(fragment.source_url)
    filename = shared.infer_filename_from_url(
        fragment.source_url,
        fallback_stem=f"source_audio_{fragment.hash_value}",
        content_type=content_type,
    )
    extension = Path(filename).suffix.lstrip(".") or "mp3"
    cache_path = page_audio_cache_path(cache_root, "source", fragment.hash_value, extension)
    if not cache_path.exists():
        cache_path.write_bytes(raw)
    fragment.cache_path = str(cache_path)
    fragment.content_type = content_type
    return cache_path


def ensure_normalized_audio_fragment(path: Path, hash_value: str, target_format: str, cache_root: Path) -> Path:
    if path.suffix.lower().lstrip(".") == target_format:
        return path
    normalized_hash = hashlib.sha256(f"{hash_value}|{target_format}".encode("utf-8")).hexdigest()[:16]
    normalized_path = page_audio_cache_path(cache_root, "normalized", normalized_hash, target_format)
    if normalized_path.exists():
        return normalized_path
    run_ffmpeg(
        [
            "-y",
            "-i",
            str(path),
            "-vn",
            "-c:a",
            ffmpeg_audio_codec(target_format),
            str(normalized_path),
        ]
    )
    return normalized_path


def ensure_silence_fragment(cache_root: Path, target_format: str, silence_ms: int) -> Optional[Path]:
    if silence_ms <= 0:
        return None
    silence_hash = hashlib.sha256(f"{target_format}|{silence_ms}".encode("utf-8")).hexdigest()[:16]
    silence_path = page_audio_cache_path(cache_root, "silence", silence_hash, target_format)
    if silence_path.exists():
        return silence_path
    duration_seconds = max(0.0, silence_ms / 1000.0)
    run_ffmpeg(
        [
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=24000:cl=mono",
            "-t",
            f"{duration_seconds:.3f}",
            "-c:a",
            ffmpeg_audio_codec(target_format),
            str(silence_path),
        ]
    )
    return silence_path


def assemble_audio_with_ffmpeg(fragment_paths: Sequence[Path], target_format: str, silence_ms: int, cache_root: Path) -> bytes:
    if not fragment_paths:
        raise RuntimeError("No audio fragments were assembled.")
    silence_path = ensure_silence_fragment(cache_root, target_format, silence_ms)
    ordered_paths: List[Path] = []
    for idx, path in enumerate(fragment_paths):
        ordered_paths.append(path)
        if silence_path is not None and idx + 1 < len(fragment_paths):
            ordered_paths.append(silence_path)
    tmp_dir = cache_root / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=tmp_dir) as temp_dir:
        concat_path = Path(temp_dir) / "inputs.txt"
        output_path = Path(temp_dir) / f"assembled.{target_format}"
        concat_lines = [f"file '{path.as_posix()}'" for path in ordered_paths]
        concat_path.write_text("\n".join(concat_lines), encoding="utf-8")
        run_ffmpeg(
            [
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(concat_path),
                "-c:a",
                ffmpeg_audio_codec(target_format),
                str(output_path),
            ]
        )
        return output_path.read_bytes()


def build_assembled_audio(
    fragments: Sequence[PageAudioFragment],
    config: Dict[str, Any],
    openai_key: str,
    base_url: str,
) -> bytes:
    settings = tts_settings_from_config(config)
    cache_root = page_audio_cache_dir()
    silence_ms = int(config.get("silence_ms", DEFAULT_SILENCE_MS))
    fragment_paths: List[Path] = []
    for fragment in fragments:
        if fragment.kind == "tts":
            path = ensure_tts_fragment_audio(fragment, settings, cache_root, openai_key, base_url)
        elif fragment.kind == "source_audio":
            path = ensure_source_audio_fragment(fragment, cache_root)
        else:
            raise RuntimeError(f"Unsupported fragment kind '{fragment.kind}'.")
        normalized = ensure_normalized_audio_fragment(path, fragment.hash_value, str(settings["format"]), cache_root)
        fragment_paths.append(normalized)
    return assemble_audio_with_ffmpeg(fragment_paths, str(settings["format"]), silence_ms, cache_root)


def monthly_intention_cache_path(year: int) -> Path:
    cache_dir = page_audio_cache_dir() / "monthly_intentions"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / f"{year}.json"


def fetch_media_candidates(search_term: str) -> List[Dict[str, Any]]:
    response = page_audio_http_get(
        POPES_PRAYER_MEDIA_API_URL,
        params={"search": search_term, "per_page": 100},
        timeout=30,
    )
    payload = response.json()
    return payload if isinstance(payload, list) else []


def english_pdf_score(item: Dict[str, Any], year: int) -> int:
    slug = str(item.get("slug", "")).lower()
    source_url = str(item.get("source_url", "")).lower()
    if not source_url.endswith(".pdf"):
        return -1
    if str(year) not in source_url and str(year) not in slug:
        return -1
    score = 0
    if f"{year}.pdf" in source_url:
        score += 50
    if "ing-" in source_url or slug.startswith("ing-"):
        score += 80
    if "eng-" in source_url or slug.startswith("eng-"):
        score += 70
    if "holy-father" in source_url or "holy-father" in slug:
        score += 30
    if "pope-leo" in source_url or "pope-leo" in slug:
        score += 20
    return score


def popes_prayer_pdf_url_for_year(year: int, language: str = "en") -> str:
    lang = str(language or "en").strip().lower()
    search_terms = []
    if lang == "en":
        search_terms.extend(
            [
                f"ING PRAYER INTENTIONS {year}",
                f"ENG POPE LEO XIV PRAYER INTENTIONS {year}",
                f"Prayer Intentions {year}",
            ]
        )
    else:
        search_terms.append(f"Prayer Intentions {year}")

    best_score = -1
    best_url = ""
    for term in search_terms:
        for item in fetch_media_candidates(term):
            if not isinstance(item, dict):
                continue
            score = english_pdf_score(item, year)
            if score > best_score:
                best_score = score
                best_url = str(item.get("source_url", "")).strip()
    if best_url:
        return best_url
    raise RuntimeError(f"Could not find Pope's Prayer Network PDF for {year}.")


def extract_month_sections_from_pdf_text(text: str) -> Dict[str, str]:
    cleaned = re.sub(r"\s+", " ", str(text or "").replace("\xa0", " ")).strip()
    positions: List[tuple[int, str]] = []
    for month_name in MONTH_NAMES:
        idx = cleaned.find(month_name)
        if idx >= 0:
            positions.append((idx, month_name))
    positions.sort()
    out: Dict[str, str] = {}
    for idx, (start, month_name) in enumerate(positions):
        end = positions[idx + 1][0] if idx + 1 < len(positions) else len(cleaned)
        section = cleaned[start + len(month_name) : end].strip()
        if section:
            out[month_name] = section
    return out


def parse_monthly_intention_section(month_name: str, section: str) -> Dict[str, str]:
    value = str(section or "").strip()
    title = value.strip().strip(".")
    body = ""
    match = re.search(r"\bLet us pray\b", value, re.IGNORECASE)
    if match:
        title = value[: match.start()].strip().strip(".")
        body = value[match.start() :].strip()
    body_clause = re.sub(r"^Let us pray\s+", "", body, flags=re.IGNORECASE).strip().rstrip(".")
    spoken_text = f"For the Holy Father's monthly intention: {body_clause}." if body_clause else (
        f"For the Holy Father's monthly intention this month: {title}."
    )
    return {
        "month": month_name.title(),
        "title": title,
        "body": body,
        "spoken_text": normalize_whitespace(spoken_text),
    }


def fetch_monthly_intention(target_date: datetime.date) -> Dict[str, str]:
    year = int(target_date.year)
    month_name = MONTH_NAMES[target_date.month - 1]
    cache_path = monthly_intention_cache_path(year)
    cached_payload: Dict[str, Any] = {}
    if cache_path.exists():
        try:
            cached_payload = json.loads(cache_path.read_text(encoding="utf-8"))
        except Exception:
            cached_payload = {}
    if isinstance(cached_payload, dict):
        cached_months = cached_payload.get("months") or {}
        cached_month = cached_months.get(month_name)
        if isinstance(cached_month, dict) and str(cached_month.get("spoken_text", "")).strip():
            return cached_month

    pdf_url = popes_prayer_pdf_url_for_year(year, language="en")
    response = page_audio_http_get(pdf_url, timeout=60)
    reader = PdfReader(io.BytesIO(response.content))
    extracted = "\n".join((page.extract_text() or "") for page in reader.pages)
    sections = extract_month_sections_from_pdf_text(extracted)
    months_payload: Dict[str, Dict[str, str]] = {}
    for parsed_month, section in sections.items():
        parsed = parse_monthly_intention_section(parsed_month, section)
        parsed["source_url"] = pdf_url
        months_payload[parsed_month] = parsed
    cache_path.write_text(json.dumps({"source_url": pdf_url, "months": months_payload}, indent=2), encoding="utf-8")
    result = months_payload.get(month_name)
    if not isinstance(result, dict) or not str(result.get("spoken_text", "")).strip():
        raise RuntimeError(f"Could not parse {month_name.title()} intention from {pdf_url}.")
    return result


def maybe_update_page_text_property(
    page: Dict[str, Any],
    property_name: str,
    text: str,
    token: str,
    *,
    allow_empty: bool = False,
) -> bool:
    prop_name = str(property_name or "").strip()
    value = normalize_whitespace(text)
    if not prop_name or (not value and not allow_empty):
        return False
    current = normalize_whitespace(page_property_text(page, prop_name))
    if current == value:
        return False
    page_id = str(page.get("id", "")).strip()
    if not page_id:
        raise RuntimeError("Target page has no id.")
    shared.notion_update_rich_text_property(page_id, prop_name, value, token)
    return True


def build_page_audio_plan(
    page: Dict[str, Any],
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    config: Dict[str, Any],
    notion_token: str,
    base_url: str,
) -> PageAudioPlan:
    builder = str(config.get("builder", "")).strip() or MORNING_PRAYER_BUILDER
    if builder == MORNING_PRAYER_BUILDER:
        return PageAudioPlan(
            fragments=build_morning_prayer_fragments(
                page=page,
                pages=pages,
                title_property=title_property,
                config=config,
                token=notion_token,
                base_url=base_url,
            )
        )
    if builder == DIVINE_OFFICE_INVITATORY_BUILDER:
        return build_divine_office_invitatory_plan(page=page, config=config, base_url=base_url)
    if builder == DIVINE_OFFICE_NIGHT_TEXT_BUILDER:
        return build_divine_office_night_text_plan(config=config)
    if builder == DIVINE_OFFICE_MORNING_TEXT_BUILDER:
        return build_divine_office_morning_text_plan(config=config)
    if builder == RSS_AUDIO_BUILDER:
        return build_rss_audio_plan(page=page, config=config, base_url=base_url)
    if builder == AUDIO_FRAGMENTS_BUILDER:
        return build_fragment_output_plan(
            pages=pages,
            title_property=title_property,
            config=config,
            token=notion_token,
            base_url=base_url,
        )
    raise RuntimeError(f"Unsupported page audio builder '{builder}'.")


def apply_page_text_plan(
    page: Dict[str, Any],
    plan: PageAudioPlan,
    notion_token: str,
) -> str:
    page_id = str(page.get("id", "")).strip()
    if not page_id:
        raise RuntimeError("Target page has no id.")
    content_changed = False
    if plan.text_target == "page_content":
        content_changed = sync_page_content_blocks(page_id, notion_token, plan.content_blocks)
        if plan.text_property:
            maybe_update_page_text_property(page, plan.text_property, "", notion_token, allow_empty=True)
    elif plan.text_property:
        content_changed = maybe_update_page_text_property(page, plan.text_property, plan.synced_text, notion_token)
    return "text_updated" if content_changed else "text_cached"


def render_page_audio_for_config(
    page: Dict[str, Any],
    config_key: str,
    config: Dict[str, Any],
    plan: PageAudioPlan,
    title_property: str,
    notion_token: str,
    openai_key: str,
    base_url: str,
    *,
    apply_text: bool = False,
) -> str:
    fragments = plan.fragments
    page_id = str(page.get("id", "")).strip()
    if apply_text:
        apply_page_text_plan(page, plan, notion_token)
    if not fragments:
        raise RuntimeError(f"Auto-audio config '{config_key}' did not produce any audio fragments.")

    render_hash = compute_page_render_hash(config_key, config, fragments)
    current_hash = page_audio_current_render_hash(page_id, notion_token)
    settings = tts_settings_from_config(config)
    if current_hash == render_hash and page_audio_is_positioned_near_top(page_id, notion_token):
        return f"cached:{settings['format']}:{settings['model']}:{settings['voice']}:hash={render_hash}"

    audio_bytes = build_assembled_audio(fragments, config, openai_key, base_url)
    page_audio_remove_old_blocks(page_id, notion_token)
    page_audio_remove_blank_placeholders(page_id, notion_token)
    filename = f"{slugify(shared.page_title(page, title_property))}_{shared.local_today().isoformat()}.{settings['format']}"
    content_type = shared.audio_content_type(str(settings["format"]))
    upload_id = shared.notion_create_file_upload(filename=filename, content_type=content_type, token=notion_token)
    shared.notion_send_file_upload(upload_id, filename, content_type, audio_bytes, notion_token)
    caption = str(config.get("audio_caption", "Page Audio")).strip() or "Page Audio"
    page_audio_append_block(page_id, upload_id, f"{caption} {page_audio_hash_marker(render_hash)}", notion_token, position="start")
    shared.notion_update_audio_render_metadata(page, render_hash, notion_token)
    return f"attached:{settings['format']}:{settings['model']}:{settings['voice']}:hash={render_hash}"


def config_key_if_defined(config_map: Dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = str(key or "").strip()
        if value and isinstance(config_map.get(value), dict):
            return value
    return ""


def resolve_page_sync_keys(
    page: Dict[str, Any],
    config_map: Dict[str, Any],
    *,
    text_resolver_property: str,
    auto_audio_primary_property: str,
    auto_audio_secondary_property: str,
    legacy_config_property: str,
    legacy_resolver_property: str,
    auto_text_enabled: bool,
    auto_audio_enabled: bool,
) -> tuple[str, List[str]]:
    text_key = ""
    if auto_text_enabled:
        text_key = config_key_if_defined(
            config_map,
            page_text_config_key_from_page(page, text_resolver_property, legacy_config_property),
            page_property_text(page, legacy_resolver_property).strip(),
        )

    audio_keys: List[str] = []
    if auto_audio_enabled:
        for key in page_auto_audio_config_keys_from_page(
            page,
            auto_audio_primary_property,
            auto_audio_secondary_property,
            legacy_config_property,
            legacy_resolver_property,
        ):
            resolved = config_key_if_defined(config_map, key)
            if resolved and resolved not in audio_keys:
                audio_keys.append(resolved)
    return text_key, audio_keys


def main() -> int:
    try:
        openai_key = shared.require_env(OPENAI_API_KEY)
        notion_token = shared.require_env(NOTION_TOKEN)
        base_url = os.getenv(OAI_API_BASE_URL, "https://api.openai.com/v1").strip() or "https://api.openai.com/v1"
        title_property = os.getenv(NOTION_TITLE_PROPERTY, "Name").strip() or "Name"
        platform_property = os.getenv(NOTION_PLATFORM_PROPERTY, "Platform").strip() or "Platform"
        platform_value = os.getenv(NOTION_AUDIO_PLATFORM_VALUE, DEFAULT_AUTO_AUDIO_PLATFORM_VALUE).strip() or DEFAULT_AUTO_AUDIO_PLATFORM_VALUE
        config_property = os.getenv(NOTION_AUDIO_CONFIG_PROPERTY, DEFAULT_AUDIO_CONFIG_PROPERTY).strip() or DEFAULT_AUDIO_CONFIG_PROPERTY
        legacy_resolver_property = os.getenv(NOTION_AUDIO_RESOLVER_PROPERTY, "Spotify Resolver").strip() or "Spotify Resolver"
        text_resolver_property = os.getenv(NOTION_TEXT_RESOLVER_PROPERTY, DEFAULT_TEXT_RESOLVER_PROPERTY).strip() or DEFAULT_TEXT_RESOLVER_PROPERTY
        auto_audio_primary_property = (
            os.getenv(NOTION_AUTO_AUDIO_RESOLVER_PRIMARY_PROPERTY, DEFAULT_AUTO_AUDIO_RESOLVER_PRIMARY_PROPERTY).strip()
            or DEFAULT_AUTO_AUDIO_RESOLVER_PRIMARY_PROPERTY
        )
        auto_audio_secondary_property = (
            os.getenv(NOTION_AUTO_AUDIO_RESOLVER_SECONDARY_PROPERTY, DEFAULT_AUTO_AUDIO_RESOLVER_SECONDARY_PROPERTY).strip()
            or DEFAULT_AUTO_AUDIO_RESOLVER_SECONDARY_PROPERTY
        )
        enabled_property = os.getenv(NOTION_AUDIO_ENABLED_PROPERTY, "Enabled").strip() or "Enabled"
        config_key_filter = str(os.getenv(PAGE_AUDIO_CONFIG_KEY, "")).strip()
        row_title_filter = os.getenv(PAGE_AUDIO_ROW_TITLE, "").strip()
        fail_open = shared.bool_env(PAGE_AUDIO_FAIL_OPEN, default=False)
        notion_db_id = shared.notion_find_database_id(notion_token)

        config_payload = load_page_audio_config(notion_token)
        config_map = config_payload.get("configs") or {}
        pages = shared.notion_get_all_pages(notion_db_id, notion_token)
        candidates = list_audio_candidate_pages(
            pages=pages,
            title_property=title_property,
            platform_property=platform_property,
            platform_value=platform_value,
            enabled_property=enabled_property,
            row_title_filter=row_title_filter,
        )

        if not candidates:
            print("page_audio_rows=0")
            return 0

        attached = 0
        cached = 0
        failed = 0
        processed = 0
        for page in candidates:
            title = shared.page_title(page, title_property).strip() or str(page.get("id", "")).strip()
            auto_text_enabled = page_has_platform_value(page, platform_property, "auto-text")
            auto_audio_enabled = page_has_platform_value(page, platform_property, "auto-audio")
            text_key, audio_keys = resolve_page_sync_keys(
                page,
                config_map,
                text_resolver_property=text_resolver_property,
                auto_audio_primary_property=auto_audio_primary_property,
                auto_audio_secondary_property=auto_audio_secondary_property,
                legacy_config_property=config_property,
                legacy_resolver_property=legacy_resolver_property,
                auto_text_enabled=auto_text_enabled,
                auto_audio_enabled=auto_audio_enabled,
            )
            if config_key_filter:
                wanted = config_key_if_defined(config_map, config_key_filter)
                if not wanted:
                    raise RuntimeError(f"Unknown page audio config '{config_key_filter}'.")
                if text_key != wanted and wanted not in audio_keys:
                    continue
            if not text_key and not audio_keys:
                raise RuntimeError(f"No page-sync resolver configured for '{title}'.")
            processed += 1
            try:
                text_mode = ""
                if text_key:
                    text_plan = build_page_audio_plan(
                        page=page,
                        pages=pages,
                        title_property=title_property,
                        config=config_map[text_key],
                        notion_token=notion_token,
                        base_url=base_url,
                    )
                    text_mode = apply_page_text_plan(page, text_plan, notion_token)

                audio_mode = ""
                chosen_audio_key = ""
                audio_errors: List[str] = []
                for index, audio_key in enumerate(audio_keys):
                    chosen_audio_key = audio_key
                    audio_config = config_map[audio_key]
                    audio_plan = build_page_audio_plan(
                        page=page,
                        pages=pages,
                        title_property=title_property,
                        config=audio_config,
                        notion_token=notion_token,
                        base_url=base_url,
                    )
                    try:
                        audio_mode = render_page_audio_for_config(
                            page=page,
                            config_key=audio_key,
                            config=audio_config,
                            plan=audio_plan,
                            title_property=title_property,
                            notion_token=notion_token,
                            openai_key=openai_key,
                            base_url=base_url,
                            apply_text=not bool(text_key) and index == 0,
                        )
                        break
                    except Exception as exc:
                        audio_errors.append(f"{audio_key}: {exc}")
                        audio_mode = ""
                        chosen_audio_key = ""
                if auto_audio_enabled and audio_keys and not audio_mode:
                    raise RuntimeError("; ".join(audio_errors) if audio_errors else "Auto-audio failed.")

                mode_parts = [part for part in [text_mode, audio_mode] if part]
                mode = " | ".join(mode_parts) if mode_parts else "noop"
                if audio_mode.startswith("attached:"):
                    attached += 1
                if audio_mode.startswith("cached:"):
                    cached += 1
                config_bits = [bit for bit in [f"text={text_key}" if text_key else "", f"audio={chosen_audio_key}" if chosen_audio_key else ""] if bit]
                config_summary = " ".join(config_bits).strip()
                print(f"page_audio title={title} {config_summary} mode={mode}".strip())
            except Exception as exc:
                failed += 1
                print(f"page_audio_error title={title} error={exc}", file=sys.stderr)
                if not fail_open:
                    raise
        print(f"page_audio_rows={processed} attached={attached} cached={cached} failed={failed}")
        return 0 if failed == 0 or fail_open else 1
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
