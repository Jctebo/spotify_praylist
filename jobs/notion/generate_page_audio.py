import datetime
import hashlib
import html
import importlib.util
import io
import json
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
import time
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Set
import xml.etree.ElementTree as ET

import imageio_ffmpeg
import requests
from openai import OpenAI
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[2]
FFMPEG_BINARY = imageio_ffmpeg.get_ffmpeg_exe()

NOTION_DATABASE_ID = "NOTION_DATABASE_ID"
NOTION_DATABASE_NAME = "NOTION_DATABASE_NAME"
NOTION_TITLE_PROPERTY = "NOTION_TITLE_PROPERTY"
NOTION_PLATFORM_PROPERTY = "NOTION_PLATFORM_PROPERTY"
NOTION_QUEUE_ORDER_PROPERTY = "NOTION_QUEUE_ORDER_PROPERTY"
JOB_UTC_OFFSET = "JOB_UTC_OFFSET"

OPENAI_API_KEY = "OPENAI_API_KEY"
OAI_API_BASE_URL = "OAI_API_BASE_URL"
OAI_MODEL = "OAI_MODEL"
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
MORNING_PRAYER_CONTRACT_FILE = "MORNING_PRAYER_CONTRACT_FILE"
PAGE_AUDIO_CACHE_DIR = "PAGE_AUDIO_CACHE_DIR"
PAGE_AUDIO_LIBRARY_DIR = "PAGE_AUDIO_LIBRARY_DIR"
PAGE_AUDIO_LIBRARY_GROUP_PROPERTY = "PAGE_AUDIO_LIBRARY_GROUP_PROPERTY"
PAGE_AUDIO_TRUNCATE_MANAGED_OUTPUTS = "PAGE_AUDIO_TRUNCATE_MANAGED_OUTPUTS"
PAGE_AUDIO_FAIL_OPEN = "PAGE_AUDIO_FAIL_OPEN"

DEFAULT_PAGE_AUDIO_CONFIG_FILE = "config/page_audio_config.json"
DEFAULT_MORNING_PRAYER_CONTRACT_FILE = "config/morning-prayer/morning-prayer.json"
DEFAULT_PAGE_AUDIO_CACHE_DIR = ".cache/page_audio"
DEFAULT_PAGE_AUDIO_LIBRARY_RELATIVE = r"OneDrive\Praylist Audio\Playlist Audio"
DEFAULT_PAGE_AUDIO_LIBRARY_FALLBACK = ".cache/page_audio_library"
DEFAULT_PAGE_AUDIO_CONFIG_DATABASE_NAME = "Page Audio Configuration"
DEFAULT_AUDIO_FRAGMENTS_DATABASE_NAME = "Audio Fragments"
DEFAULT_AUDIO_OUTPUTS_DATABASE_NAME = "Audio Outputs"
DEFAULT_AUTO_AUDIO_PLATFORM_VALUE = "auto-audio,auto-text"
DEFAULT_AUDIO_CONFIG_PROPERTY = "Audio Configuration"
DEFAULT_TEXT_RESOLVER_PROPERTY = "Text Resolver"
DEFAULT_AUTO_AUDIO_RESOLVER_PRIMARY_PROPERTY = "Auto Audio Resolver 1"
DEFAULT_AUTO_AUDIO_RESOLVER_SECONDARY_PROPERTY = "Auto Audio Resolver 2"
DEFAULT_PAGE_AUDIO_LIBRARY_GROUP_PROPERTY = "Playlist"
PCM_NORMALIZE_SAMPLE_RATE = 44100
PCM_NORMALIZE_CHANNELS = 2
PCM_NORMALIZE_EXTENSION = "wav"
PCM_NORMALIZE_PROFILE = f"{PCM_NORMALIZE_EXTENSION}_{PCM_NORMALIZE_SAMPLE_RATE}hz_{PCM_NORMALIZE_CHANNELS}ch_v1"
PAGE_AUDIO_MARKER = "[AUTOGEN_PAGE_AUDIO]"
PAGE_AUDIO_HASH_MARKER_PREFIX = "[AUTOGEN_PAGE_AUDIO_HASH:"
PRAYER_TEXT_SECTION_MARKER_PREFIX = "[AUTOGEN_PRAYER_TEXT_SECTION:"
PAGE_AUDIO_RENDER_VERSION = "page_audio_v2"
PAGE_AUDIO_PROMPT_RENDER_VERSION = "page_audio_prompt_v1"
DEFAULT_SILENCE_MS = 450
DEFAULT_DAILY_NOVENA_PAGE_TITLE = "Daily Novenas from Liturgical Calendar"
MORNING_PRAYER_BUILDER = "morning_prayer_v1"
DIVINE_OFFICE_INVITATORY_BUILDER = "divine_office_invitatory_v1"
DIVINE_OFFICE_NIGHT_TEXT_BUILDER = "divine_office_night_text_v1"
DIVINE_OFFICE_EVENING_TEXT_BUILDER = "divine_office_evening_text_v1"
DIVINE_OFFICE_MORNING_TEXT_BUILDER = "divine_office_morning_text_v1"
AUXILIUM_DAILY_TEXT_BUILDER = "auxilium_daily_text_v1"
RSS_AUDIO_BUILDER = "rss_audio_v1"
AUDIO_FRAGMENTS_BUILDER = "audio_fragments_v1"
ROSARY_DYNAMIC_BUILDER = "rosary_dynamic_v1"
POPES_PRAYER_MEDIA_API_URL = "https://www.popesprayer.va/wp-json/wp/v2/media"
DIVINE_OFFICE_FEED_URL = "https://divineoffice.org/feed/"
DEFAULT_RSS_TEXT_PROPERTY = "Description"
DEFAULT_INTENTION_PROPERTY = "Intention"
DEFAULT_INTENTION_PREFIX = "For today's intention:"
NOTION_INTENTIONS_DATABASE_ID = "NOTION_INTENTIONS_DATABASE_ID"
NOTION_INTENTIONS_DATABASE_NAME = "NOTION_INTENTIONS_DATABASE_NAME"
NOTION_INTENTIONS_PETITION_PROPERTY = "NOTION_INTENTIONS_PETITION_PROPERTY"
NOTION_INTENTIONS_STATUS_PROPERTY = "NOTION_INTENTIONS_STATUS_PROPERTY"
NOTION_INTENTIONS_FREQUENCY_PROPERTY = "NOTION_INTENTIONS_FREQUENCY_PROPERTY"
NOTION_INTENTIONS_STATUS_ALLOWED = "NOTION_INTENTIONS_STATUS_ALLOWED"
HTTP_RETRYABLE_STATUSES = {408, 409, 425, 429, 500, 502, 503, 504}
HTTP_MAX_ATTEMPTS = 4
PAGE_AUDIO_HTTP_USER_AGENT = "Mozilla/5.0 (compatible; spotify-praylist/1.0; +https://github.com/Jctebo/spotify_praylist)"
PAGE_AUDIO_HTTP_ACCEPT = "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8"
TITLE_MATCH_ALIAS_GROUPS: Sequence[tuple[str, ...]] = (
    ("lauds", "morning prayer"),
    ("vespers", "evening prayer"),
    ("compline", "night prayer"),
)

_RSS_FEED_ENTRIES_CACHE: Dict[str, List[Dict[str, Any]]] = {}
_PAGE_AUDIO_BLOCKS_CACHE: Dict[str, List[Dict[str, Any]]] = {}
_AUXILIUM_SECTIONS_CACHE: Dict[str, Dict[str, List[str]]] = {}
_AUDIO_FRAGMENTS_CACHE: Dict[str, Dict[str, Dict[str, Any]]] = {}
_INTENTION_LIBRARY_CACHE: Dict[str, List[str]] = {}
_PAGE_AUDIO_DEPRECATION_WARNINGS: Set[str] = set()
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
PAGE_AUDIO_CONFIG_FEED_MATCH_STRATEGY_PROPERTY = "Feed Match Strategy"
PAGE_AUDIO_CONFIG_FEED_MATCH_MAP_PROPERTY = "Feed Match Map"
PAGE_AUDIO_CONFIG_INTENTION_PROPERTY = "Intention Property"
PAGE_AUDIO_CONFIG_INTENTION_PREFIX_PROPERTY = "Intention Prefix"

AUDIO_FRAGMENT_TITLE_PROPERTY = "Name"
AUDIO_FRAGMENT_KEY_PROPERTY = "Fragment Key"
AUDIO_FRAGMENT_TYPE_PROPERTY = "Fragment Type"
AUDIO_FRAGMENT_BUILDER_PROPERTY = "Builder"
AUDIO_FRAGMENT_TEXT_PROPERTY = "Spoken Text"
AUDIO_FRAGMENT_PROMPT_PROPERTY = "Prompt"
AUDIO_FRAGMENT_PROMPT_MODEL_PROPERTY = "Prompt Model"
AUDIO_FRAGMENT_ENABLED_PROPERTY = "Enabled"
AUDIO_FRAGMENT_START_DATE_PROPERTY = "Start Date"
AUDIO_FRAGMENT_END_DATE_PROPERTY = "End Date"
AUDIO_FRAGMENT_COLLECTION_PROPERTY = "Collection"
AUDIO_FRAGMENT_SEQUENCE_PROPERTY = "Fragment Sequence"
AUDIO_FRAGMENT_CONFIG_KEY_PROPERTY = "Config Key"
AUDIO_FRAGMENT_TEXT_TARGET_ROW_PROPERTY = "Target Row"
AUDIO_FRAGMENT_OUTPUT_FOLDER_PROPERTY = "Output Folder"
AUDIO_FRAGMENT_ORDER_PROPERTY = "Order"
AUDIO_FRAGMENT_NOTES_PROPERTY = "Notes"
AUDIO_FRAGMENT_DEFAULT_COLLECTION = "audio_fragments"
AUDIO_FRAGMENT_MONTHLY_COLLECTION = "monthly_intention"
AUDIO_FRAGMENT_MONTHLY_PREFIX = "pope-intention-"
RANDOM_INTENTION_FRAGMENT_KEY = "random-intention"
RANDOM_INTENTION_FRAGMENT_LABEL = "Random Intention"
RANDOM_INTENTION_FRAGMENT_COLLECTION = "random_intentions"
FRAGMENT_TYPE_TEXT = "text"
FRAGMENT_TYPE_PROMPT = "prompt"
FRAGMENT_TYPE_SEQUENCE = "sequence"
FRAGMENT_TYPE_CONFIG = "config"
FRAGMENT_TYPE_BUILDER = "builder"
FRAGMENT_TYPE_MONTHLY_INTENTION = "monthly_intention"
FRAGMENT_TYPE_RANDOM_INTENTION = "random_intention"
FRAGMENT_TYPE_DAILY_NOVENA_AUDIO = "daily_novena_audio"

AUDIO_OUTPUT_TITLE_PROPERTY = "Name"
AUDIO_OUTPUT_KEY_PROPERTY = "Output Key"
AUDIO_OUTPUT_MODE_PROPERTY = "Output Mode"
AUDIO_OUTPUT_TARGET_ROW_PROPERTY = "Target Row"
AUDIO_OUTPUT_AUDIO_CAPTION_PROPERTY = "Audio Caption"
AUDIO_OUTPUT_FRAGMENT_KEY_PROPERTY = "Fragment Key"
AUDIO_OUTPUT_FRAGMENT_SEQUENCE_PROPERTY = "Fragment Sequence"
AUDIO_OUTPUT_CONFIG_KEY_PROPERTY = "Config Key"
AUDIO_OUTPUT_FOLDER_PROPERTY = "Output Folder"
AUDIO_OUTPUT_WEEKDAY_MAP_PROPERTY = "Weekday Map"
AUDIO_OUTPUT_TTS_MODEL_PROPERTY = "TTS Model"
AUDIO_OUTPUT_TTS_VOICE_PROPERTY = "TTS Voice"
AUDIO_OUTPUT_TTS_FORMAT_PROPERTY = "TTS Format"
AUDIO_OUTPUT_TTS_SPEED_PROPERTY = "TTS Speed"
AUDIO_OUTPUT_SILENCE_MS_PROPERTY = "Silence Ms"
AUDIO_OUTPUT_ENABLED_PROPERTY = "Enabled"
AUDIO_OUTPUT_NOTES_PROPERTY = "Notes"
AUDIO_OUTPUT_MODE_FRAGMENTS = "fragments"
AUDIO_OUTPUT_MODE_CONFIG = "config"
AUDIO_OUTPUT_MODE_ROSARY = "rosary"
SPECIAL_DAILY_NOVENA_AUDIO = "SPECIAL:daily_novena_audio"
SPECIAL_MONTHLY_INTENTION = "SPECIAL:monthly_intention"
MORNING_PRAYER_NOVENA_BLOCK_MARKER_PREFIX = "[AUTOGEN_MORNING_PRAYER_NOVENA:"
RSS_MATCH_CONTAINS_WITH_DATE = "contains_with_date"
RSS_MATCH_DAY_OF_YEAR = "day_of_year"
RSS_MATCH_MONTH_DAY = "month_day"
RSS_MATCH_WEEKDAY_MAP = "weekday_map"
RSS_MATCH_FIXED_TITLE = "fixed_title"
DEFAULT_ROSARY_INTENTION_PROPERTY = "Intention"
DEFAULT_ROSARY_MEDITATION_FRAGMENT_KEY = "rosary-decade-meditation-template"
ROSARY_MYSTERY_KEYS = ("joyful", "sorrowful", "glorious", "luminous")
DEFAULT_ROSARY_WEEKDAY_MAP = {
    "monday": "joyful",
    "tuesday": "sorrowful",
    "wednesday": "glorious",
    "thursday": "luminous",
    "friday": "sorrowful",
    "saturday": "joyful",
    "sunday": "glorious",
}

OPUS_DEI_ASSEMBLY_MODE_PROPERTY = "Assembly Mode"
OPUS_DEI_DETAILED_FRAGMENTS_PROPERTY = "Detailed Fragments"
OPUS_DEI_SPECIAL_BUILDER_PROPERTY = "Special Builder"
OPUS_DEI_TEXT_SYNC_MODE_PROPERTY = "Text Sync Mode"
OPUS_DEI_TEXT_PROPERTY_PROPERTY = "Text Property"
OPUS_DEI_AUDIO_CAPTION_PROPERTY = "Audio Caption"
OPUS_DEI_OUTPUT_FOLDER_PROPERTY = "Output Folder"
OPUS_DEI_ORDER_PROPERTY = "Order"
OPUS_DEI_SILENCE_MS_PROPERTY = "Silence Ms"
OPUS_DEI_TTS_MODEL_PROPERTY = "TTS Model"
OPUS_DEI_TTS_VOICE_PROPERTY = "TTS Voice"
OPUS_DEI_TTS_FORMAT_PROPERTY = "TTS Format"
OPUS_DEI_TTS_SPEED_PROPERTY = "TTS Speed"
OPUS_DEI_WEEKDAY_MAP_PROPERTY = "Weekday Map"
OPUS_DEI_ASSEMBLY_MODE_FRAGMENTS = "fragments"
OPUS_DEI_ASSEMBLY_MODE_SPECIAL = "special"
OPUS_DEI_SPECIAL_BUILDER_ROSARY = "rosary"
OPUS_DEI_TEXT_SYNC_MODE_NONE = "none"
OPUS_DEI_TEXT_SYNC_MODE_PAGE_CONTENT = "page_content"
OPUS_DEI_TEXT_SYNC_MODE_TEXT_PROPERTY = "property"
PAGE_CONTENT_MODE_REPLACE = "replace"
PAGE_CONTENT_MODE_MANAGED_SECTION = "managed_section"

DETAILED_FRAGMENT_OPUS_DEI_RELATION_PROPERTY = "Opus Dei Item"
DETAILED_FRAGMENT_GROUP_PROPERTY = "Group"
DETAILED_FRAGMENT_KIND_PROPERTY = "Fragment Kind"
DETAILED_FRAGMENT_ASSEMBLY_ROLE_PROPERTY = "Assembly Role"
DETAILED_FRAGMENT_SOURCE_URL_PROPERTY = "Source URL"
DETAILED_FRAGMENT_FEED_URL_PROPERTY = "Feed URL"
DETAILED_FRAGMENT_FEED_MATCH_TEXT_PROPERTY = "Feed Match Text"
DETAILED_FRAGMENT_FEED_MATCH_STRATEGY_PROPERTY = "Feed Match Strategy"
DETAILED_FRAGMENT_FEED_MATCH_MAP_PROPERTY = "Feed Match Map"
DETAILED_FRAGMENT_INTENTION_PROPERTY = "Intention Property"
DETAILED_FRAGMENT_INTENTION_PREFIX_PROPERTY = "Intention Prefix"
FRAGMENT_KIND_RSS_AUDIO = "rss_audio"
FRAGMENT_KIND_SOURCE_AUDIO = "source_audio"
FRAGMENT_KIND_BUILDER = "builder"
ASSEMBLY_ROLE_APPEND = "append"
ASSEMBLY_ROLE_PRIMARY_SOURCE = "primary_source"
ASSEMBLY_ROLE_FALLBACK_SOURCE = "fallback_source"
MORNING_PRAYER_TITLE = "Morning Prayer"
MORNING_PRAYER_FRAGMENT_GROUP = "morning_prayer"
MORNING_PRAYER_DAILY_NOVENA_GROUP = "daily_novena"
MORNING_PRAYER_FRAGMENT_KEY_ALIASES: Dict[str, str] = {
    "petition church": "petition-church",
    "petition technology": "petition-church",
    "petition sick departed": "petition-sick-departed",
    "petition sanctification of the church": "petition-sick-departed",
    "petition 7": "petition-7",
    "petition sick and departed": "petition-7",
}
MORNING_PRAYER_FRAGMENT_CONTRACT: Sequence[tuple[str, str, str, str]] = (
    ("morning-offering", "Morning Offering", FRAGMENT_TYPE_TEXT, MORNING_PRAYER_FRAGMENT_GROUP),
    ("daily-consecration", "Daily Consecration", FRAGMENT_TYPE_TEXT, MORNING_PRAYER_FRAGMENT_GROUP),
    ("baptismal-renewal", "Baptismal Renewal", FRAGMENT_TYPE_TEXT, MORNING_PRAYER_FRAGMENT_GROUP),
    ("petitions-intro", "Petitions Intro", FRAGMENT_TYPE_TEXT, MORNING_PRAYER_FRAGMENT_GROUP),
    ("monthly-intention", "Monthly Intention", FRAGMENT_TYPE_MONTHLY_INTENTION, AUDIO_FRAGMENT_MONTHLY_COLLECTION),
    ("petition-families", "Petition - Families", FRAGMENT_TYPE_TEXT, MORNING_PRAYER_FRAGMENT_GROUP),
    ("petition-marriages", "Petition - Marriages", FRAGMENT_TYPE_TEXT, MORNING_PRAYER_FRAGMENT_GROUP),
    ("petition-conversion", "Petition - Conversion", FRAGMENT_TYPE_TEXT, MORNING_PRAYER_FRAGMENT_GROUP),
    ("petition-church", "Petition - Right Use of Technology", FRAGMENT_TYPE_TEXT, MORNING_PRAYER_FRAGMENT_GROUP),
    (
        "petition-sick-departed",
        "Petition - Sanctification of the Church",
        FRAGMENT_TYPE_TEXT,
        MORNING_PRAYER_FRAGMENT_GROUP,
    ),
    ("petition-7", "Petition - Sick and Departed", FRAGMENT_TYPE_TEXT, MORNING_PRAYER_FRAGMENT_GROUP),
    ("daily-novena-audio", "Daily Novena Audio", FRAGMENT_TYPE_DAILY_NOVENA_AUDIO, MORNING_PRAYER_DAILY_NOVENA_GROUP),
    ("intercessory-litany", "Intercessory Litany", FRAGMENT_TYPE_TEXT, MORNING_PRAYER_FRAGMENT_GROUP),
)


def normalize_morning_prayer_fragment_key(spec: Dict[str, Any]) -> str:
    raw_key = normalize_flag_value(spec_fragment_key(spec))
    raw_label = normalize_flag_value(spec_fragment_label(spec))
    if raw_key in MORNING_PRAYER_FRAGMENT_KEY_ALIASES:
        return MORNING_PRAYER_FRAGMENT_KEY_ALIASES[raw_key]
    if raw_label in MORNING_PRAYER_FRAGMENT_KEY_ALIASES:
        return MORNING_PRAYER_FRAGMENT_KEY_ALIASES[raw_label]
    return raw_key


def load_shared_module():
    shared_path = ROOT / "jobs" / "novena" / "generate_daily_novena_prayer.py"
    spec = importlib.util.spec_from_file_location("page_audio_shared", shared_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load shared module at {shared_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


shared = load_shared_module()


def load_prayer_order_contract():
    contract_path = ROOT / "jobs" / "prayer_order_contract.py"
    spec = importlib.util.spec_from_file_location("page_audio_prayer_order_contract", contract_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load prayer order contract at {contract_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


prayer_order_contract = load_prayer_order_contract()


@dataclass
class PageAudioFragment:
    kind: str
    label: str
    hash_value: str
    text: str = ""
    prompt: str = ""
    prompt_model: str = ""
    source_url: str = ""
    content_type: str = ""
    cache_path: str = ""
    persist_path: str = ""
    persist_meta_path: str = ""
    fragment_key: str = ""
    collection: str = ""
    artwork_url: str = ""


@dataclass
class PageAudioPlan:
    fragments: List[PageAudioFragment]
    synced_text: str = ""
    text_property: str = ""
    text_target: str = ""
    content_blocks: List[Dict[str, Any]] = field(default_factory=list)
    page_content_mode: str = PAGE_CONTENT_MODE_REPLACE
    page_content_label: str = ""


@dataclass
class PageAudioExportMetadata:
    folder_name: str
    entry_name: str
    order_value: float
    order_display: str
    file_stem: str
    audio_extension: str


@dataclass
class DailyNovenaSection:
    marker_id: str
    header: str
    content_block: Optional[Dict[str, Any]] = None


def slugify(text: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", str(text or "").lower()).strip("-")
    return value or "page-audio"


def safe_path_component(text: str, fallback: str) -> str:
    value = re.sub(r'[<>:"/\\\\|?*]+', "-", str(text or "").strip())
    value = re.sub(r"\s{2,}", " ", value).strip().strip(".")
    return value or fallback


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


def page_property_number_or_none(page: Dict[str, Any], prop_name: str) -> Optional[float]:
    props = page.get("properties") or {}
    prop = props.get(prop_name) or {}
    if str(prop.get("type", "")).strip() == "number":
        value = prop.get("number")
        return prayer_order_contract.parse_top_level_order(value)
    return prayer_order_contract.parse_top_level_order(page_property_text(page, prop_name).strip())


def resolve_top_level_order_property_name() -> str:
    return os.getenv(NOTION_QUEUE_ORDER_PROPERTY, OPUS_DEI_ORDER_PROPERTY).strip() or OPUS_DEI_ORDER_PROPERTY


def prayer_text_section_marker(page_id: str) -> str:
    return f"{PRAYER_TEXT_SECTION_MARKER_PREFIX}{str(page_id or '').strip() or 'page'}]"


def block_has_text_marker(block: Dict[str, Any], marker: str) -> bool:
    needle = str(marker or "").strip()
    if not needle:
        return False
    return needle in shared.block_rich_text_plain(block)


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


def page_property_relation_ids(page: Dict[str, Any], prop_name: str) -> List[str]:
    props = page.get("properties") or {}
    prop = props.get(prop_name) or {}
    if str(prop.get("type", "")).strip() != "relation":
        return []
    ids = [str(item.get("id", "")).strip() for item in (prop.get("relation") or []) if isinstance(item, dict)]
    return [value for value in ids if value]


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


def normalize_fragment_type_name(value: Any) -> str:
    return normalize_flag_value(value)


def fragment_type_matches(value: Any, expected: str) -> bool:
    return normalize_fragment_type_name(value) == normalize_fragment_type_name(expected)


def emit_page_audio_deprecation_warning(message: str) -> None:
    warning = str(message or "").strip()
    if not warning or warning in _PAGE_AUDIO_DEPRECATION_WARNINGS:
        return
    _PAGE_AUDIO_DEPRECATION_WARNINGS.add(warning)
    print(f"WARN page_audio_deprecated {warning}")


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


def strip_autogen_markers(text: str) -> str:
    value = str(text or "").strip()
    value = re.sub(r"\s*\[[^\]]*AUTOGEN_[^\]]*\]\s*", " ", value)
    return normalize_whitespace(value)


def extract_novena_marker_id(text: str) -> str:
    match = re.search(r"\[AUTOGEN_NOVENA_DAY:([^\]]+)\]", str(text or ""))
    return str(match.group(1)).strip() if match else ""


def morning_prayer_novena_marker(marker_id: str) -> str:
    value = str(marker_id or "").strip() or "novena"
    return f"{MORNING_PRAYER_NOVENA_BLOCK_MARKER_PREFIX}{value}]"


def is_morning_prayer_autogen_novena_block(block: Dict[str, Any]) -> bool:
    text = shared.block_rich_text_plain(block)
    if MORNING_PRAYER_NOVENA_BLOCK_MARKER_PREFIX in str(text or ""):
        return True
    return False


def novena_header_from_text(text: str) -> str:
    cleaned = strip_autogen_markers(text)
    if not cleaned:
        return ""
    toggle_match = re.match(r"^Novena\s*-\s*(.+?)\s*\(Day\s*(\d+)\s+of\s+9\)$", cleaned, flags=re.IGNORECASE)
    if toggle_match:
        return normalize_whitespace(f"Novena to {toggle_match.group(1)} Day {toggle_match.group(2)}")
    audio_match = re.match(r"^Novena Audio\s*-\s*(.+?)\s+Day\s*(\d+)\b", cleaned, flags=re.IGNORECASE)
    if audio_match:
        return normalize_whitespace(f"Novena to {audio_match.group(1)} Day {audio_match.group(2)}")
    return cleaned


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


def audio_builder_config_from_page(page: Dict[str, Any]) -> Dict[str, Any]:
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
    feed_match_strategy = page_property_text(page, PAGE_AUDIO_CONFIG_FEED_MATCH_STRATEGY_PROPERTY).strip()
    feed_match_map = page_property_text(page, PAGE_AUDIO_CONFIG_FEED_MATCH_MAP_PROPERTY).strip()
    intention_property = page_property_text(page, PAGE_AUDIO_CONFIG_INTENTION_PROPERTY).strip()
    intention_prefix = page_property_text(page, PAGE_AUDIO_CONFIG_INTENTION_PREFIX_PROPERTY).strip()
    target_row = page_property_text(page, AUDIO_FRAGMENT_TEXT_TARGET_ROW_PROPERTY).strip()
    output_folder = page_property_text(page, AUDIO_FRAGMENT_OUTPUT_FOLDER_PROPERTY).strip()
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
    if feed_match_strategy:
        config["rss_match_strategy"] = feed_match_strategy
    if feed_match_map:
        config["rss_match_map"] = feed_match_map
    if intention_property:
        config["intention_property"] = intention_property
    if intention_prefix:
        config["intention_prefix"] = intention_prefix
    if target_row:
        config["target_row"] = target_row
    if output_folder:
        config["output_folder"] = output_folder
    return config


def page_audio_config_from_notion_page(page: Dict[str, Any]) -> Optional[tuple[str, Dict[str, Any]]]:
    key = shared.page_title(page, PAGE_AUDIO_CONFIG_TITLE_PROPERTY).strip()
    if not key:
        return None
    if not page_property_checkbox(page, PAGE_AUDIO_CONFIG_ENABLED_PROPERTY, default=True):
        return None
    config = audio_builder_config_from_page(page)
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


def load_morning_prayer_contract_from_file() -> Dict[str, Any]:
    config_path = ROOT / (
        os.getenv(MORNING_PRAYER_CONTRACT_FILE, DEFAULT_MORNING_PRAYER_CONTRACT_FILE).strip()
        or DEFAULT_MORNING_PRAYER_CONTRACT_FILE
    )
    if not config_path.exists():
        return {}
    with open(config_path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)
    if not isinstance(payload, dict):
        raise RuntimeError(f"Invalid Morning Prayer contract format in {config_path}: root must be an object.")
    resolvers = payload.get("resolvers")
    if not isinstance(resolvers, list) or not resolvers:
        raise RuntimeError(f"Invalid Morning Prayer contract format in {config_path}: missing or empty 'resolvers'.")
    return payload


def morning_prayer_contract_resolvers(contract: Dict[str, Any]) -> List[Dict[str, Any]]:
    resolvers = contract.get("resolvers") if isinstance(contract, dict) else None
    if not isinstance(resolvers, list):
        return []
    out: List[Dict[str, Any]] = []
    for resolver in resolvers:
        if isinstance(resolver, dict):
            out.append(resolver)
    return out


def morning_prayer_contract_resolver_keys(contract: Dict[str, Any]) -> List[str]:
    keys: List[str] = []
    for resolver in morning_prayer_contract_resolvers(contract):
        key = str(resolver.get("key", "")).strip()
        if key:
            keys.append(key)
    return keys


def morning_prayer_contract_resolver_titles(contract: Dict[str, Any]) -> List[str]:
    titles: List[str] = []
    for resolver in morning_prayer_contract_resolvers(contract):
        title = str(resolver.get("title", "")).strip()
        if title:
            titles.append(title)
    return titles


def morning_prayer_contract_page_content_titles(contract: Dict[str, Any]) -> List[str]:
    titles: List[str] = []
    for resolver in morning_prayer_contract_resolvers(contract):
        targets = resolver.get("targets") if isinstance(resolver, dict) else None
        if not isinstance(targets, list):
            continue
        if "page_content" not in {str(target).strip() for target in targets}:
            continue
        title = str(resolver.get("title", "")).strip()
        if title:
            titles.append(title)
    return titles


def morning_prayer_content_path(resolver_key: str) -> Path:
    return ROOT / "config" / "morning-prayer" / "content" / f"{resolver_key}.txt"


def load_morning_prayer_content_text(resolver_key: str) -> str:
    path = morning_prayer_content_path(resolver_key)
    if not path.exists():
        return ""
    return normalize_whitespace(path.read_text(encoding="utf-8"))


def morning_prayer_content_block(title: str, text: str) -> Dict[str, Any]:
    body = normalize_whitespace(text)
    if not body:
        return {}
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    children = [notion_paragraph_block(line) for line in lines]
    return {
        "object": "block",
        "type": "toggle",
        "toggle": {
            "rich_text": notion_rich_text_chunks(title),
            "children": children,
        },
    }


def load_page_audio_config_from_file() -> Dict[str, Any]:
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
    morning_prayer_contract = load_morning_prayer_contract_from_file()
    if morning_prayer_contract:
        payload["morning_prayer_contract"] = morning_prayer_contract
        morning_prayer_config = configs.get("MORNING_PRAYER_PAGE_AUDIO")
        if isinstance(morning_prayer_config, dict):
            morning_prayer_config["resolver_contract_mode"] = "file_driven"
    return payload


def load_page_audio_config(notion_token: str = "") -> Dict[str, Any]:
    token = str(notion_token or "").strip()
    payload: Dict[str, Any] = load_page_audio_config_from_file()
    configs = dict(payload.get("configs") or {})
    if token:
        notion_payload = load_page_audio_config_from_notion(token)
        notion_configs = notion_payload.get("configs") if isinstance(notion_payload, dict) else None
        if isinstance(notion_configs, dict) and notion_configs:
            configs.update(notion_configs)
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
    if prop_type == "relation":
        raw_values = value if isinstance(value, (list, tuple, set)) else [value]
        relation_ids: List[str] = []
        for entry in raw_values:
            if isinstance(entry, dict):
                relation_id = str(entry.get("id", "")).strip()
            else:
                relation_id = str(entry or "").strip()
            if relation_id and relation_id not in relation_ids:
                relation_ids.append(relation_id)
        return {"relation": [{"id": relation_id} for relation_id in relation_ids]}
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
    enforce_date_window: bool = True,
) -> Optional[tuple[str, Dict[str, Any]]]:
    if not page_property_checkbox(page, AUDIO_FRAGMENT_ENABLED_PROPERTY, default=True):
        return None
    if enforce_date_window and not page_is_active_for_date(
        page,
        start_property=AUDIO_FRAGMENT_START_DATE_PROPERTY,
        end_property=AUDIO_FRAGMENT_END_DATE_PROPERTY,
        target_date=target_date,
    ):
        return None
    title = shared.page_title(page, AUDIO_FRAGMENT_TITLE_PROPERTY).strip()
    key = page_property_text(page, AUDIO_FRAGMENT_KEY_PROPERTY).strip() or slugify(title)
    fragment_type = normalize_fragment_type_name(page_property_text(page, AUDIO_FRAGMENT_TYPE_PROPERTY))
    text = normalize_whitespace(page_property_text(page, AUDIO_FRAGMENT_TEXT_PROPERTY))
    prompt = normalize_whitespace(page_property_text(page, AUDIO_FRAGMENT_PROMPT_PROPERTY))
    sequence = parse_fragment_sequence(page_property_text(page, AUDIO_FRAGMENT_SEQUENCE_PROPERTY))
    source_config_key = page_property_text(page, AUDIO_FRAGMENT_CONFIG_KEY_PROPERTY).strip()
    builder_config = audio_builder_config_from_page(page)
    has_builder_definition = bool(str(builder_config.get("builder", "")).strip())
    if not fragment_type:
        if text:
            fragment_type = FRAGMENT_TYPE_TEXT
        elif prompt:
            fragment_type = FRAGMENT_TYPE_PROMPT
        elif sequence:
            fragment_type = FRAGMENT_TYPE_SEQUENCE
        elif source_config_key:
            fragment_type = FRAGMENT_TYPE_CONFIG
        elif has_builder_definition:
            fragment_type = FRAGMENT_TYPE_BUILDER
    if not key or not fragment_type:
        return None
    collection = page_property_text(page, AUDIO_FRAGMENT_COLLECTION_PROPERTY).strip() or AUDIO_FRAGMENT_DEFAULT_COLLECTION
    payload = {
        "key": key,
        "label": title or key,
        "type": fragment_type,
        "collection": collection,
        "order": page_property_number(page, AUDIO_FRAGMENT_ORDER_PROPERTY, default=0.0),
        "notes": page_property_text(page, AUDIO_FRAGMENT_NOTES_PROPERTY).strip(),
    }
    if fragment_type_matches(fragment_type, FRAGMENT_TYPE_TEXT):
        if not text:
            return None
        payload["text"] = text
        return key, payload
    if fragment_type_matches(fragment_type, FRAGMENT_TYPE_PROMPT):
        if not prompt:
            return None
        payload["prompt"] = prompt
        payload["prompt_model"] = (
            page_property_text(page, AUDIO_FRAGMENT_PROMPT_MODEL_PROPERTY).strip()
            or os.getenv(OAI_MODEL, "").strip()
            or "gpt-4.1-mini"
        )
        return key, payload
    if fragment_type_matches(fragment_type, FRAGMENT_TYPE_SEQUENCE):
        if not sequence:
            return None
        payload["fragment_sequence"] = sequence
        if builder_config:
            payload["config"] = builder_config
        return key, payload
    if fragment_type_matches(fragment_type, FRAGMENT_TYPE_CONFIG):
        if not source_config_key:
            return None
        payload["source_config_key"] = source_config_key
        if builder_config:
            payload["config"] = builder_config
        return key, payload
    if fragment_type_matches(fragment_type, FRAGMENT_TYPE_BUILDER):
        if not has_builder_definition:
            return None
        payload["config"] = builder_config
        return key, payload
    if any(
        fragment_type_matches(fragment_type, special_type)
        for special_type in (
            FRAGMENT_TYPE_MONTHLY_INTENTION,
            FRAGMENT_TYPE_RANDOM_INTENTION,
            FRAGMENT_TYPE_DAILY_NOVENA_AUDIO,
        )
    ):
        if builder_config:
            payload["config"] = builder_config
        if fragment_type_matches(fragment_type, FRAGMENT_TYPE_DAILY_NOVENA_AUDIO):
            payload["daily_novena_page_title"] = str(
                (payload.get("config") or {}).get("daily_novena_page_title", "")
            ).strip() or DEFAULT_DAILY_NOVENA_PAGE_TITLE
        return key, payload
    return None


def load_audio_fragments_from_notion(token: str) -> Dict[str, Any]:
    database_id = notion_audio_fragments_database_id(token)
    if not database_id:
        return {}
    cache_key = f"{database_id}|{shared.local_today().isoformat()}"
    cached = _AUDIO_FRAGMENTS_CACHE.get(cache_key)
    if isinstance(cached, dict) and cached:
        return {"fragments": deepcopy(cached)}
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
    if fragments:
        _AUDIO_FRAGMENTS_CACHE[cache_key] = deepcopy(fragments)
    return {"fragments": fragments} if fragments else {}


def audio_fragment_date_sort_key(page: Dict[str, Any]) -> tuple[datetime.date, datetime.date]:
    start_text, end_text = page_property_date_range(page, AUDIO_FRAGMENT_START_DATE_PROPERTY)
    start_date = parse_iso_date(start_text) or datetime.date.min
    end_date = parse_iso_date(end_text) or start_date
    return (start_date, end_date)


def monthly_intention_fragment_from_notion(
    token: str,
    *,
    target_date: datetime.date,
) -> Optional[Dict[str, Any]]:
    database_id = notion_audio_fragments_database_id(token)
    if not database_id:
        return None
    pages = shared.notion_get_all_pages(database_id, token)
    candidates: List[tuple[Dict[str, Any], Dict[str, Any]]] = []
    active: List[tuple[Dict[str, Any], Dict[str, Any]]] = []
    for page in pages:
        if not isinstance(page, dict):
            continue
        parsed = audio_fragment_from_notion_page(page, target_date=target_date, enforce_date_window=False)
        if not parsed:
            continue
        _, fragment = parsed
        if str(fragment.get("collection", "")).strip() != AUDIO_FRAGMENT_MONTHLY_COLLECTION:
            continue
        candidates.append((page, fragment))
        if page_is_active_for_date(
            page,
            start_property=AUDIO_FRAGMENT_START_DATE_PROPERTY,
            end_property=AUDIO_FRAGMENT_END_DATE_PROPERTY,
            target_date=target_date,
        ):
            active.append((page, fragment))
    source = active if active else candidates
    if not source:
        return None
    source.sort(key=lambda item: audio_fragment_date_sort_key(item[0]), reverse=True)
    return deepcopy(source[0][1])


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
    output_folder = page_property_text(page, AUDIO_OUTPUT_FOLDER_PROPERTY).strip()
    if output_folder:
        overrides["output_folder"] = output_folder
    weekday_map = page_property_text(page, AUDIO_OUTPUT_WEEKDAY_MAP_PROPERTY).strip()
    if weekday_map:
        overrides["rss_match_map"] = weekday_map
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


def default_output_tts_settings() -> Dict[str, Any]:
    return {
        "model": "gpt-4o-mini-tts",
        "voice": "alloy",
        "format": "mp3",
        "speed": 1.0,
    }


def synthetic_output_wrapper_fragment_key(output_key: str, source_key: str) -> str:
    output_slug = slugify(output_key)
    source_slug = slugify(source_key)
    return f"output-{output_slug}-{source_slug}-wrapper"


def build_output_fragment_config(
    *,
    output_key: str,
    output_title: str,
    fragments: Dict[str, Dict[str, Any]],
    base_configs: Dict[str, Any],
    overrides: Dict[str, Any],
    sequence: Sequence[str],
) -> Dict[str, Any]:
    default_config: Dict[str, Any] = {
        "builder": AUDIO_FRAGMENTS_BUILDER,
        "audio_caption": f"{output_title or output_key} (Audio)",
        "silence_ms": DEFAULT_SILENCE_MS,
        "tts": default_output_tts_settings(),
        "fragment_sequence": list(sequence),
        "fragments": fragments,
        "config_map": base_configs,
    }
    return apply_audio_output_overrides(default_config, overrides)


def build_output_config_wrapper(
    *,
    output_key: str,
    output_title: str,
    source_key: str,
    fragments: Dict[str, Dict[str, Any]],
    base_configs: Dict[str, Any],
    overrides: Dict[str, Any],
) -> Dict[str, Any]:
    if not isinstance(base_configs.get(source_key), dict):
        raise RuntimeError(f"Audio output '{output_key}' references unknown config '{source_key}'.")
    wrapper_key = synthetic_output_wrapper_fragment_key(output_key, source_key)
    wrapper_spec: Dict[str, Any] = {
        "key": wrapper_key,
        "label": f"{output_title or output_key} Wrapper",
        "type": FRAGMENT_TYPE_CONFIG,
        "source_config_key": source_key,
    }
    if overrides:
        wrapper_spec["config"] = deepcopy(overrides)
    fragments_map = dict(fragments)
    fragments_map[wrapper_key] = wrapper_spec
    config = build_output_fragment_config(
        output_key=output_key,
        output_title=output_title,
        fragments=fragments_map,
        base_configs=base_configs,
        overrides=overrides,
        sequence=[wrapper_key],
    )
    config["source_config_key"] = source_key
    config["legacy_output_mode"] = AUDIO_OUTPUT_MODE_CONFIG
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
    output_title = shared.page_title(page, AUDIO_OUTPUT_TITLE_PROPERTY).strip() or key
    mode = normalize_flag_value(page_property_text(page, AUDIO_OUTPUT_MODE_PROPERTY)) or AUDIO_OUTPUT_MODE_FRAGMENTS
    overrides = audio_output_common_overrides(page)
    if mode == AUDIO_OUTPUT_MODE_ROSARY:
        default_config = {
            "builder": ROSARY_DYNAMIC_BUILDER,
            "audio_caption": f"{output_title} (Audio)",
            "silence_ms": DEFAULT_SILENCE_MS,
            "tts": default_output_tts_settings(),
            "fragments": fragments,
            "weekday_map": page_property_text(page, AUDIO_OUTPUT_WEEKDAY_MAP_PROPERTY).strip(),
            "target_row": page_property_text(page, AUDIO_OUTPUT_TARGET_ROW_PROPERTY).strip(),
            "notes": page_property_text(page, AUDIO_OUTPUT_NOTES_PROPERTY).strip(),
        }
        return key, apply_audio_output_overrides(default_config, overrides)
    fragment_key = page_property_text(page, AUDIO_OUTPUT_FRAGMENT_KEY_PROPERTY).strip()
    sequence = parse_fragment_sequence(page_property_text(page, AUDIO_OUTPUT_FRAGMENT_SEQUENCE_PROPERTY))
    if fragment_key:
        sequence = [fragment_key]
    source_key = page_property_text(page, AUDIO_OUTPUT_CONFIG_KEY_PROPERTY).strip()
    for message in audio_output_deprecation_messages(
        page,
        output_key=key,
        output_mode=mode,
        fragment_sequence=sequence,
        source_config_key=source_key,
    ):
        emit_page_audio_deprecation_warning(message)
    if sequence:
        return key, build_output_fragment_config(
            output_key=key,
            output_title=output_title,
            fragments=fragments,
            base_configs=base_configs,
            overrides=overrides,
            sequence=sequence,
        )
    if source_key:
        return key, build_output_config_wrapper(
            output_key=key,
            output_title=output_title,
            source_key=source_key,
            fragments=fragments,
            base_configs=base_configs,
            overrides=overrides,
        )
    if mode not in {AUDIO_OUTPUT_MODE_FRAGMENTS, AUDIO_OUTPUT_MODE_CONFIG}:
        return None
    return None


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


def normalize_opus_dei_assembly_mode(value: str) -> str:
    text = normalize_flag_value(value).replace(" ", "_")
    if text == OPUS_DEI_ASSEMBLY_MODE_SPECIAL:
        return OPUS_DEI_ASSEMBLY_MODE_SPECIAL
    if text == OPUS_DEI_ASSEMBLY_MODE_FRAGMENTS:
        return OPUS_DEI_ASSEMBLY_MODE_FRAGMENTS
    return ""


def normalize_opus_dei_text_sync_mode(value: str) -> str:
    text = normalize_flag_value(value).replace(" ", "_")
    if text == OPUS_DEI_TEXT_SYNC_MODE_PAGE_CONTENT:
        return OPUS_DEI_TEXT_SYNC_MODE_PAGE_CONTENT
    if text == OPUS_DEI_TEXT_SYNC_MODE_TEXT_PROPERTY:
        return OPUS_DEI_TEXT_SYNC_MODE_TEXT_PROPERTY
    if text == OPUS_DEI_TEXT_SYNC_MODE_NONE:
        return OPUS_DEI_TEXT_SYNC_MODE_NONE
    return ""


def normalize_detailed_fragment_kind(value: str) -> str:
    text = normalize_flag_value(value).replace(" ", "_")
    aliases = {
        FRAGMENT_TYPE_TEXT: FRAGMENT_TYPE_TEXT,
        FRAGMENT_TYPE_PROMPT: FRAGMENT_TYPE_PROMPT,
        FRAGMENT_TYPE_MONTHLY_INTENTION: FRAGMENT_TYPE_MONTHLY_INTENTION,
        FRAGMENT_TYPE_RANDOM_INTENTION: FRAGMENT_TYPE_RANDOM_INTENTION,
        FRAGMENT_TYPE_DAILY_NOVENA_AUDIO: FRAGMENT_TYPE_DAILY_NOVENA_AUDIO,
        FRAGMENT_KIND_RSS_AUDIO: FRAGMENT_KIND_RSS_AUDIO,
        FRAGMENT_KIND_SOURCE_AUDIO: FRAGMENT_KIND_SOURCE_AUDIO,
        FRAGMENT_KIND_BUILDER: FRAGMENT_KIND_BUILDER,
        FRAGMENT_TYPE_BUILDER: FRAGMENT_KIND_BUILDER,
    }
    return aliases.get(text, "")


def normalize_fragment_assembly_role(value: str) -> str:
    text = normalize_flag_value(value).replace(" ", "_")
    aliases = {
        ASSEMBLY_ROLE_APPEND: ASSEMBLY_ROLE_APPEND,
        ASSEMBLY_ROLE_PRIMARY_SOURCE: ASSEMBLY_ROLE_PRIMARY_SOURCE,
        ASSEMBLY_ROLE_FALLBACK_SOURCE: ASSEMBLY_ROLE_FALLBACK_SOURCE,
    }
    return aliases.get(text, "")


def is_morning_prayer_title(title: str) -> bool:
    return normalize_flag_value(title) == normalize_flag_value(MORNING_PRAYER_TITLE)


def morning_prayer_contract_items() -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for index, (key, label, kind, group) in enumerate(MORNING_PRAYER_FRAGMENT_CONTRACT, start=1):
        items.append(
            {
                "key": key,
                "label": label,
                "kind": kind,
                "group": group,
                "assembly_role": ASSEMBLY_ROLE_APPEND,
                "order": float(index),
            }
        )
    return items


def spec_fragment_label(spec: Dict[str, Any]) -> str:
    return (
        str(spec.get("label", "")).strip()
        or str(spec.get("title", "")).strip()
        or str(spec.get(AUDIO_FRAGMENT_TITLE_PROPERTY, "")).strip()
    )


def spec_fragment_key(spec: Dict[str, Any]) -> str:
    return (
        str(spec.get("key", "")).strip()
        or str(spec.get(AUDIO_FRAGMENT_KEY_PROPERTY, "")).strip()
        or slugify(spec_fragment_label(spec))
    )


def spec_fragment_kind(spec: Dict[str, Any]) -> str:
    raw = (
        str(spec.get("kind", "")).strip()
        or str(spec.get("type", "")).strip()
        or str(spec.get(DETAILED_FRAGMENT_KIND_PROPERTY, "")).strip()
        or str(spec.get(AUDIO_FRAGMENT_TYPE_PROPERTY, "")).strip()
    )
    return normalize_detailed_fragment_kind(raw)


def spec_fragment_group(spec: Dict[str, Any]) -> str:
    return (
        str(spec.get("group", "")).strip()
        or str(spec.get("collection", "")).strip()
        or str(spec.get(DETAILED_FRAGMENT_GROUP_PROPERTY, "")).strip()
        or str(spec.get(AUDIO_FRAGMENT_COLLECTION_PROPERTY, "")).strip()
    )


def spec_fragment_order(spec: Dict[str, Any]) -> float:
    try:
        return float(spec.get("order", spec.get(AUDIO_FRAGMENT_ORDER_PROPERTY, 0.0)))
    except Exception:
        return 0.0


def morning_prayer_contract_errors(specs: Sequence[Dict[str, Any]]) -> List[str]:
    errors: List[str] = []
    matched_orders: List[tuple[str, float]] = []
    items = morning_prayer_contract_items()
    for item in items:
        key_matches = [
            spec
            for spec in specs
            if normalize_flag_value(normalize_morning_prayer_fragment_key(spec)) == normalize_flag_value(item["key"])
        ]
        if not key_matches:
            errors.append(f"missing fragment '{item['key']}' ({item['label']})")
            continue
        if len(key_matches) > 1:
            errors.append(f"duplicate fragment '{item['key']}' ({item['label']})")
            continue
        match = key_matches[0]
        actual_kind = spec_fragment_kind(match)
        if actual_kind != item["kind"]:
            errors.append(
                f"fragment '{item['key']}' ({item['label']}) has kind '{actual_kind or 'missing'}' instead of '{item['kind']}'"
            )
        actual_group = normalize_flag_value(spec_fragment_group(match))
        expected_group = normalize_flag_value(str(item["group"]))
        if expected_group and actual_group != expected_group:
            errors.append(
                f"fragment '{item['key']}' ({item['label']}) has group '{spec_fragment_group(match) or 'missing'}' instead of '{item['group']}'"
            )
        actual_role = normalize_fragment_assembly_role(
            str(match.get("assembly_role", "")).strip() or str(match.get(DETAILED_FRAGMENT_ASSEMBLY_ROLE_PROPERTY, "")).strip()
        ) or ASSEMBLY_ROLE_APPEND
        if actual_role != item["assembly_role"]:
            errors.append(
                f"fragment '{item['key']}' ({item['label']}) has assembly role '{actual_role}' instead of '{item['assembly_role']}'"
            )
        matched_orders.append((item["key"], spec_fragment_order(match)))
    previous_label = ""
    previous_order: Optional[float] = None
    for label, order in matched_orders:
        if previous_order is not None and order <= previous_order:
            errors.append(f"fragment '{label}' must sort after '{previous_label}'")
            break
        previous_label = label
        previous_order = order
    return errors


def opus_dei_row_tts_settings(page: Dict[str, Any]) -> Dict[str, Any]:
    tts: Dict[str, Any] = {
        "model": page_property_text(page, OPUS_DEI_TTS_MODEL_PROPERTY).strip() or "gpt-4o-mini-tts",
        "voice": page_property_text(page, OPUS_DEI_TTS_VOICE_PROPERTY).strip() or "alloy",
        "format": page_property_text(page, OPUS_DEI_TTS_FORMAT_PROPERTY).strip().lower() or "mp3",
        "speed": 1.0,
    }
    speed_raw = page_property_text(page, OPUS_DEI_TTS_SPEED_PROPERTY).strip()
    if speed_raw:
        tts["speed"] = page_property_number(page, OPUS_DEI_TTS_SPEED_PROPERTY, default=1.0)
    return tts


def opus_dei_row_audio_config(page: Dict[str, Any], *, title_property: str) -> Dict[str, Any]:
    title = shared.page_title(page, title_property).strip() or str(page.get("id", "")).strip() or "Page Audio"
    config: Dict[str, Any] = {
        "audio_caption": page_property_text(page, OPUS_DEI_AUDIO_CAPTION_PROPERTY).strip() or f"{title} (Audio)",
        "silence_ms": DEFAULT_SILENCE_MS,
        "tts": opus_dei_row_tts_settings(page),
        "output_folder": page_property_text(page, OPUS_DEI_OUTPUT_FOLDER_PROPERTY).strip(),
    }
    silence_raw = page_property_text(page, OPUS_DEI_SILENCE_MS_PROPERTY).strip()
    if silence_raw:
        config["silence_ms"] = int(page_property_number(page, OPUS_DEI_SILENCE_MS_PROPERTY, default=DEFAULT_SILENCE_MS))
    return config


def detailed_fragment_key(page: Dict[str, Any]) -> str:
    explicit_key = page_property_text(page, AUDIO_FRAGMENT_KEY_PROPERTY).strip()
    if explicit_key:
        return explicit_key
    page_id = str(page.get("id", "")).strip()
    if page_id:
        return page_id
    title = shared.page_title(page, AUDIO_FRAGMENT_TITLE_PROPERTY).strip()
    return slugify(title) or "fragment"


def detailed_fragment_from_notion_page(
    page: Dict[str, Any],
    *,
    target_date: datetime.date,
    enforce_date_window: bool = True,
) -> Optional[Dict[str, Any]]:
    if not page_property_checkbox(page, AUDIO_FRAGMENT_ENABLED_PROPERTY, default=True):
        return None
    if enforce_date_window and not page_is_active_for_date(
        page,
        start_property=AUDIO_FRAGMENT_START_DATE_PROPERTY,
        end_property=AUDIO_FRAGMENT_END_DATE_PROPERTY,
        target_date=target_date,
    ):
        return None
    owner_ids = page_property_relation_ids(page, DETAILED_FRAGMENT_OPUS_DEI_RELATION_PROPERTY)
    if not owner_ids:
        return None

    title = shared.page_title(page, AUDIO_FRAGMENT_TITLE_PROPERTY).strip()
    text = normalize_whitespace(page_property_text(page, AUDIO_FRAGMENT_TEXT_PROPERTY))
    prompt = normalize_whitespace(page_property_text(page, AUDIO_FRAGMENT_PROMPT_PROPERTY))
    source_url = page_property_text(page, DETAILED_FRAGMENT_SOURCE_URL_PROPERTY).strip()
    group = page_property_text(page, DETAILED_FRAGMENT_GROUP_PROPERTY).strip() or page_property_text(page, AUDIO_FRAGMENT_COLLECTION_PROPERTY).strip() or AUDIO_FRAGMENT_DEFAULT_COLLECTION
    builder_config = audio_builder_config_from_page(page)
    kind = normalize_detailed_fragment_kind(page_property_text(page, DETAILED_FRAGMENT_KIND_PROPERTY))
    if not kind:
        legacy_type = normalize_detailed_fragment_kind(page_property_text(page, AUDIO_FRAGMENT_TYPE_PROPERTY))
        if legacy_type:
            kind = legacy_type
        elif source_url:
            kind = FRAGMENT_KIND_SOURCE_AUDIO
        elif text:
            kind = FRAGMENT_TYPE_TEXT
        elif prompt:
            kind = FRAGMENT_TYPE_PROMPT
        elif str(builder_config.get("builder", "")).strip() == RSS_AUDIO_BUILDER or str(builder_config.get("rss_feed_url", "")).strip():
            kind = FRAGMENT_KIND_RSS_AUDIO
        elif str(builder_config.get("builder", "")).strip():
            kind = FRAGMENT_KIND_BUILDER
    if not kind:
        return None

    if kind == FRAGMENT_KIND_RSS_AUDIO and not str(builder_config.get("builder", "")).strip():
        builder_config["builder"] = RSS_AUDIO_BUILDER
    role = normalize_fragment_assembly_role(page_property_text(page, DETAILED_FRAGMENT_ASSEMBLY_ROLE_PROPERTY)) or ASSEMBLY_ROLE_APPEND
    payload: Dict[str, Any] = {
        "id": str(page.get("id", "")).strip(),
        "key": detailed_fragment_key(page),
        "label": title or detailed_fragment_key(page),
        "owner_ids": owner_ids,
        "group": group,
        "kind": kind,
        "assembly_role": role,
        "order": page_property_number(page, AUDIO_FRAGMENT_ORDER_PROPERTY, default=0.0),
        "notes": page_property_text(page, AUDIO_FRAGMENT_NOTES_PROPERTY).strip(),
        "config": builder_config,
    }
    if kind == FRAGMENT_TYPE_TEXT:
        payload["text"] = text
    elif kind == FRAGMENT_TYPE_PROMPT:
        payload["prompt"] = prompt
        payload["prompt_model"] = (
            page_property_text(page, AUDIO_FRAGMENT_PROMPT_MODEL_PROPERTY).strip()
            or str(builder_config.get("prompt_model", "")).strip()
            or os.getenv(OAI_MODEL, "").strip()
            or "gpt-4.1-mini"
        )
    elif kind == FRAGMENT_KIND_SOURCE_AUDIO:
        payload["source_url"] = source_url
    elif kind == FRAGMENT_KIND_RSS_AUDIO:
        payload["config"] = builder_config
    elif kind == FRAGMENT_KIND_BUILDER:
        payload["config"] = builder_config
    elif kind == FRAGMENT_TYPE_DAILY_NOVENA_AUDIO:
        payload["daily_novena_page_title"] = (
            str(builder_config.get("daily_novena_page_title", "")).strip() or DEFAULT_DAILY_NOVENA_PAGE_TITLE
        )
    return payload


def load_detailed_fragments_from_notion(token: str) -> Dict[str, Any]:
    database_id = notion_audio_fragments_database_id(token)
    if not database_id:
        return {}
    cache_key = f"detailed|{database_id}|{shared.local_today().isoformat()}"
    cached = _AUDIO_FRAGMENTS_CACHE.get(cache_key)
    if isinstance(cached, dict) and cached:
        return deepcopy(cached)
    pages = shared.notion_get_all_pages(database_id, token)
    fragments_by_page_id: Dict[str, List[Dict[str, Any]]] = {}
    fragments_by_id: Dict[str, Dict[str, Any]] = {}
    for page in pages:
        if not isinstance(page, dict):
            continue
        parsed = detailed_fragment_from_notion_page(page, target_date=shared.local_today())
        if not isinstance(parsed, dict):
            continue
        fragment_id = str(parsed.get("id", "")).strip() or detailed_fragment_key(page)
        fragments_by_id[fragment_id] = deepcopy(parsed)
        for owner_id in parsed.get("owner_ids") or []:
            owner_key = str(owner_id or "").strip()
            if not owner_key:
                continue
            fragments_by_page_id.setdefault(owner_key, []).append(deepcopy(parsed))
    for specs in fragments_by_page_id.values():
        specs.sort(
            key=lambda spec: (
                float(spec.get("order", 0.0)),
                str(spec.get("key", "")).lower(),
                str(spec.get("label", "")).lower(),
            )
        )
    payload = {"fragments_by_page_id": fragments_by_page_id, "fragments_by_id": fragments_by_id}
    if fragments_by_page_id:
        _AUDIO_FRAGMENTS_CACHE[cache_key] = deepcopy(payload)
    return payload


def page_audio_cache_dir() -> Path:
    value = os.getenv(PAGE_AUDIO_CACHE_DIR, DEFAULT_PAGE_AUDIO_CACHE_DIR).strip() or DEFAULT_PAGE_AUDIO_CACHE_DIR
    path = ROOT / value
    path.mkdir(parents=True, exist_ok=True)
    return path


def default_page_audio_library_dir() -> Path:
    user_profile = os.getenv("USERPROFILE", "").strip()
    if user_profile:
        return Path(user_profile) / Path(DEFAULT_PAGE_AUDIO_LIBRARY_RELATIVE)
    return ROOT / DEFAULT_PAGE_AUDIO_LIBRARY_FALLBACK


def page_audio_library_dir() -> Path:
    raw = os.getenv(PAGE_AUDIO_LIBRARY_DIR, "").strip()
    path = Path(raw) if raw else default_page_audio_library_dir()
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
            response = requests.get(
                url,
                params=params,
                timeout=timeout,
                headers={
                    "User-Agent": PAGE_AUDIO_HTTP_USER_AGENT,
                    "Accept": PAGE_AUDIO_HTTP_ACCEPT,
                },
            )
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


def cached_rss_feed_entries_key(feed_url: str, target_year: int) -> str:
    return f"{str(feed_url or '').strip()}|{int(target_year)}"


def page_audio_cached_blocks(page_id: str, token: str, *, refresh: bool = False) -> List[Dict[str, Any]]:
    key = str(page_id or "").strip()
    if not key:
        return []
    if refresh or key not in _PAGE_AUDIO_BLOCKS_CACHE:
        _PAGE_AUDIO_BLOCKS_CACHE[key] = shared.notion_list_block_children(key, token)
    return list(_PAGE_AUDIO_BLOCKS_CACHE.get(key) or [])


def invalidate_page_audio_cached_blocks(page_id: str) -> None:
    key = str(page_id or "").strip()
    if key:
        _PAGE_AUDIO_BLOCKS_CACHE.pop(key, None)


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


def build_monthly_intention_fragment_from_notion_or_provider(
    token: str,
    settings: Dict[str, Any],
    base_url: str,
) -> PageAudioFragment:
    notion_fragment = None
    if str(token or "").strip():
        try:
            notion_fragment = monthly_intention_fragment_from_notion(token, target_date=shared.local_today())
        except Exception as exc:
            print(f"page_audio monthly_intention_source=provider fallback_reason={type(exc).__name__}")
    if isinstance(notion_fragment, dict):
        key = str(notion_fragment.get("key", "")).strip() or "monthly-intention"
        label = str(notion_fragment.get("label", "")).strip() or key
        text = normalize_whitespace(str(notion_fragment.get("text", "")).strip())
        if text:
            return stable_text_fragment(
                cache_root=page_audio_cache_dir(),
                collection=AUDIO_FRAGMENT_MONTHLY_COLLECTION,
                key=key,
                label=label,
                text=text,
                settings=settings,
                base_url=base_url,
            )
    monthly_intention = fetch_monthly_intention(shared.local_today())
    return build_monthly_intention_fragment(monthly_intention, settings, base_url)


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


def render_fragment_prompt_template(
    prompt: str,
    page: Optional[Dict[str, Any]],
    target_date: datetime.date,
    extra_replacements: Optional[Dict[str, Any]] = None,
) -> str:
    title_property = os.getenv(NOTION_TITLE_PROPERTY, "Name").strip() or "Name"
    page_title = shared.page_title(page or {}, title_property).strip() if isinstance(page, dict) else ""
    replacements = {
        "{today}": target_date.strftime("%B %d, %Y"),
        "{today_iso}": target_date.isoformat(),
        "{month}": target_date.strftime("%B"),
        "{year}": str(target_date.year),
        "{page_title}": page_title,
    }
    if isinstance(extra_replacements, dict):
        for key, value in extra_replacements.items():
            replacements[str(key)] = str(value)
    value = str(prompt or "")
    for needle, replacement in replacements.items():
        value = value.replace(needle, replacement)
    return normalize_whitespace(value)


def prompt_fragment_hash(prompt_text: str, prompt_model: str) -> str:
    payload = {
        "type": PAGE_AUDIO_PROMPT_RENDER_VERSION,
        "prompt": normalize_whitespace(prompt_text),
        "prompt_model": str(prompt_model or "").strip(),
    }
    return shared.compute_render_hash(payload)


def prompt_text_cache_paths(cache_root: Path, collection: str, key: str) -> Path:
    directory = cache_root / "prompt_text" / slugify(collection)
    directory.mkdir(parents=True, exist_ok=True)
    return directory / f"{slugify(key)}.json"


def load_prompt_text_cache(cache_root: Path, collection: str, key: str, prompt_hash: str) -> str:
    path = prompt_text_cache_paths(cache_root, collection, key)
    if not path.exists():
        return ""
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return ""
    cached_hash = str(payload.get("prompt_hash", "")).strip().lower()
    if cached_hash != str(prompt_hash or "").strip().lower():
        return ""
    return normalize_whitespace(str(payload.get("text", "")).strip())


def save_prompt_text_cache(
    cache_root: Path,
    collection: str,
    key: str,
    *,
    prompt_hash: str,
    prompt: str,
    prompt_model: str,
    text: str,
) -> None:
    path = prompt_text_cache_paths(cache_root, collection, key)
    payload = {
        "prompt_hash": str(prompt_hash or "").strip(),
        "prompt": normalize_whitespace(prompt),
        "prompt_model": str(prompt_model or "").strip(),
        "text": normalize_whitespace(text),
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def call_openai_fragment_prompt(
    api_key: str,
    base_url: str,
    model: str,
    prompt: str,
) -> str:
    client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))
    system = "Return plain text only. No markdown, no commentary, no surrounding quotes."
    user = str(prompt or "").strip()
    try:
        response = client.responses.create(
            model=model,
            temperature=0,
            input=[
                {"role": "system", "content": [{"type": "input_text", "text": system}]},
                {"role": "user", "content": [{"type": "input_text", "text": user}]},
            ],
        )
        text = normalize_whitespace(str(getattr(response, "output_text", "") or "").strip())
        if text:
            return text
    except Exception:
        pass
    chat = client.chat.completions.create(
        model=model,
        temperature=0,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    choices = getattr(chat, "choices", None) or []
    if not choices:
        raise RuntimeError("Prompt fragment generation returned no choices.")
    content = normalize_whitespace(str(getattr(getattr(choices[0], "message", None), "content", "") or "").strip())
    if not content:
        raise RuntimeError("Prompt fragment generation returned empty text.")
    return content


def stable_prompt_fragment(
    *,
    cache_root: Path,
    collection: str,
    key: str,
    label: str,
    prompt: str,
    prompt_model: str,
    settings: Dict[str, Any],
    base_url: str,
) -> PageAudioFragment:
    rendered_prompt = normalize_whitespace(prompt)
    if not rendered_prompt:
        raise RuntimeError(f"Prompt fragment '{label}' rendered empty prompt text.")
    hash_value = prompt_fragment_hash(rendered_prompt, prompt_model)
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
        reusable.prompt = rendered_prompt
        reusable.prompt_model = prompt_model
        return reusable
    audio_path, meta_path = page_audio_library_fragment_paths(
        cache_root,
        collection,
        key,
        str(settings["format"]),
    )
    cached_text = load_prompt_text_cache(cache_root, collection, key, hash_value)
    return PageAudioFragment(
        kind="prompt",
        label=label,
        hash_value=hash_value,
        text=cached_text,
        prompt=rendered_prompt,
        prompt_model=prompt_model,
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
    spoken = normalize_whitespace(f"{intention_prefix} {intention_text}")
    return stable_text_fragment(
        cache_root=page_audio_cache_dir(),
        collection=RANDOM_INTENTION_FRAGMENT_COLLECTION,
        key=RANDOM_INTENTION_FRAGMENT_KEY,
        label=RANDOM_INTENTION_FRAGMENT_LABEL,
        text=spoken,
        settings=settings,
        base_url=base_url,
    )


def is_random_intention_fragment(fragment: Optional[PageAudioFragment]) -> bool:
    if fragment is None:
        return False
    fragment_key = normalize_flag_value(fragment.fragment_key)
    if fragment_key == normalize_flag_value(RANDOM_INTENTION_FRAGMENT_KEY):
        return True
    collection = normalize_flag_value(fragment.collection)
    label = normalize_flag_value(fragment.label)
    return collection == normalize_flag_value(RANDOM_INTENTION_FRAGMENT_COLLECTION) and label == normalize_flag_value(
        RANDOM_INTENTION_FRAGMENT_LABEL
    )


def strip_duplicate_leading_random_intention(
    existing_fragments: Sequence[PageAudioFragment],
    plan: PageAudioPlan,
) -> PageAudioPlan:
    if not existing_fragments or not plan.fragments:
        return plan
    prior = existing_fragments[-1]
    leading = plan.fragments[0]
    if not (is_random_intention_fragment(prior) and is_random_intention_fragment(leading)):
        return plan
    if str(prior.hash_value or "").strip() != str(leading.hash_value or "").strip():
        return plan
    return PageAudioPlan(
        fragments=list(plan.fragments[1:]),
        synced_text=plan.synced_text,
        text_property=plan.text_property,
        text_target=plan.text_target,
        content_blocks=deepcopy(plan.content_blocks),
        page_content_mode=plan.page_content_mode,
        page_content_label=plan.page_content_label,
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


def stable_daily_novena_header_fragment(
    header: str,
    marker_id: str,
    *,
    settings: Dict[str, Any],
    base_url: str,
) -> Optional[PageAudioFragment]:
    title = normalize_whitespace(header)
    if not title:
        return None
    spoken = title if re.search(r"[.!?]$", title) else f"{title}."
    return stable_text_fragment(
        cache_root=page_audio_cache_dir(),
        collection="daily_novena_headers",
        key=marker_id or title,
        label=title,
        text=spoken,
        settings=settings,
        base_url=base_url,
    )


def extract_daily_novena_text_block(
    block: Dict[str, Any],
    token: str,
) -> Optional[DailyNovenaSection]:
    title = shared.block_rich_text_plain(block)
    marker_id = extract_novena_marker_id(title)
    header = novena_header_from_text(title)
    if not header:
        return None
    block_id = str(block.get("id", "")).strip()
    if not block_id:
        return DailyNovenaSection(marker_id=marker_id, header=header, content_block=None)
    prayer_toggle: Dict[str, Any] = {}
    for child in shared.notion_list_block_children(block_id, token):
        child_title = strip_autogen_markers(shared.block_rich_text_plain(child))
        if str(child.get("type", "")).strip() == "toggle" and re.match(r"^Day\s+\d+\s+Novena Prayer$", child_title):
            prayer_toggle = child
            break
    if not prayer_toggle:
        return DailyNovenaSection(marker_id=marker_id, header=header, content_block=None)
    prayer_block_id = str(prayer_toggle.get("id", "")).strip()
    lines: List[str] = []
    if prayer_block_id:
        for child in shared.notion_list_block_children(prayer_block_id, token):
            lines.extend(child_text_lines(child, token, ""))
    if not lines:
        return DailyNovenaSection(marker_id=marker_id, header=header, content_block=None)
    return DailyNovenaSection(
        marker_id=marker_id,
        header=header,
        content_block={
            "object": "block",
            "type": "toggle",
            "toggle": {
                "rich_text": notion_rich_text_chunks(f"{header} {morning_prayer_novena_marker(marker_id)}"),
                "children": paragraphs_to_notion_blocks(lines),
            },
        },
    )


def build_daily_novena_sections(
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    daily_novena_page_title: str,
    token: str,
    *,
    settings: Dict[str, Any],
    base_url: str,
) -> tuple[List[PageAudioFragment], List[Dict[str, Any]]]:
    page = find_page_by_title(pages, title_property, daily_novena_page_title)
    page_id = str(page.get("id", "")).strip()
    if not page_id:
        raise RuntimeError("Daily novena source page has no id.")
    fragments: List[PageAudioFragment] = []
    mystery_rows: List[Dict[str, str]] = []
    mystery_rows: List[Dict[str, str]] = []
    content_blocks: List[Dict[str, Any]] = []
    sections_by_marker: Dict[str, DailyNovenaSection] = {}
    blocks = shared.notion_list_block_children(page_id, token)
    for block in blocks:
        if str(block.get("type", "")).strip() != "toggle":
            continue
        section = extract_daily_novena_text_block(block, token)
        if section is None:
            continue
        if section.content_block is not None:
            content_blocks.append(section.content_block)
        if section.marker_id:
            sections_by_marker[section.marker_id] = section
    for block in blocks:
        if str(block.get("type", "")).strip() != "audio":
            continue
        caption = shared.audio_block_caption(block)
        if shared.NOVENA_AUDIO_MARKER not in caption:
            continue
        url = audio_block_source_url(block)
        if not url:
            continue
        marker_id = extract_novena_marker_id(caption)
        header = sections_by_marker.get(marker_id, DailyNovenaSection(marker_id=marker_id, header=novena_header_from_text(caption))).header
        header_fragment = stable_daily_novena_header_fragment(
            header,
            marker_id or novena_header_from_text(caption),
            settings=settings,
            base_url=base_url,
        )
        if header_fragment is not None:
            fragments.append(header_fragment)
        fragments.append(
            PageAudioFragment(
                kind="source_audio",
                label=caption or header or "Daily Novena Audio",
                hash_value=source_audio_fragment_hash(block),
                source_url=url,
            )
        )
    if not fragments:
        raise RuntimeError(f"No generated novena audio blocks found on '{daily_novena_page_title}'.")
    return fragments, content_blocks


def build_daily_novena_audio_fragments(
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    daily_novena_page_title: str,
    token: str,
    *,
    settings: Dict[str, Any],
    base_url: str,
) -> List[PageAudioFragment]:
    fragments, _content_blocks = build_daily_novena_sections(
        pages,
        title_property,
        daily_novena_page_title,
        token,
        settings=settings,
        base_url=base_url,
    )
    return fragments


def build_named_audio_fragment(
    key: str,
    *,
    fragments_map: Dict[str, Dict[str, Any]],
    settings: Dict[str, Any],
    page: Dict[str, Any],
    base_url: str,
    prompt_context: Optional[Dict[str, Any]] = None,
    key_override: str = "",
    label_override: str = "",
) -> PageAudioFragment:
    spec = fragments_map.get(key)
    if not isinstance(spec, dict):
        raise RuntimeError(f"Unknown audio fragment '{key}'.")
    collection = str(spec.get("collection", AUDIO_FRAGMENT_DEFAULT_COLLECTION)).strip() or AUDIO_FRAGMENT_DEFAULT_COLLECTION
    fragment_key = str(key_override or spec.get("key", key)).strip() or key
    label = str(label_override or spec.get("label", key)).strip() or key
    text = str(spec.get("text", "")).strip()
    prompt = str(spec.get("prompt", "")).strip()
    if prompt and not text:
        prompt_model = str(spec.get("prompt_model", "")).strip() or os.getenv(OAI_MODEL, "").strip() or "gpt-4.1-mini"
        return stable_prompt_fragment(
            cache_root=page_audio_cache_dir(),
            collection=collection,
            key=fragment_key,
            label=label,
            prompt=render_fragment_prompt_template(prompt, page, shared.local_today(), extra_replacements=prompt_context),
            prompt_model=prompt_model,
            settings=settings,
            base_url=base_url,
        )
    return stable_text_fragment(
        cache_root=page_audio_cache_dir(),
        collection=collection,
        key=fragment_key,
        label=label,
        text=text,
        settings=settings,
        base_url=base_url,
    )


def resolved_audio_fragment_type(spec: Dict[str, Any]) -> str:
    fragment_type = normalize_fragment_type_name(spec.get("type", ""))
    if fragment_type:
        return fragment_type
    if normalize_whitespace(str(spec.get("text", "")).strip()):
        return normalize_fragment_type_name(FRAGMENT_TYPE_TEXT)
    if normalize_whitespace(str(spec.get("prompt", "")).strip()):
        return normalize_fragment_type_name(FRAGMENT_TYPE_PROMPT)
    sequence = spec.get("fragment_sequence") or []
    if isinstance(sequence, list) and any(str(item or "").strip() for item in sequence):
        return normalize_fragment_type_name(FRAGMENT_TYPE_SEQUENCE)
    if str(spec.get("source_config_key", "")).strip():
        return normalize_fragment_type_name(FRAGMENT_TYPE_CONFIG)
    nested_config = spec.get("config") or {}
    if isinstance(nested_config, dict) and str(nested_config.get("builder", "")).strip():
        return normalize_fragment_type_name(FRAGMENT_TYPE_BUILDER)
    return ""


def append_synced_text(existing: str, addition: str) -> str:
    current = normalize_whitespace(existing)
    extra = normalize_whitespace(addition)
    if not current:
        return extra
    if not extra:
        return current
    return f"{current}\n\n{extra}"


def merge_page_audio_plans(target: PageAudioPlan, addition: PageAudioPlan, *, source_label: str = "") -> None:
    target.fragments.extend(addition.fragments)
    label = f"fragment '{source_label}'" if source_label else "fragment"
    addition_targets_page_content = addition.text_target == "page_content" or bool(addition.content_blocks)
    addition_synced_text = normalize_whitespace(addition.synced_text)

    if addition_targets_page_content:
        if addition_synced_text:
            raise RuntimeError(f"Cannot merge {label}: page-content fragments cannot also sync plain text.")
        if target.text_target and target.text_target != "page_content":
            raise RuntimeError(f"Cannot merge {label}: page content conflicts with text-property sync.")
        target.text_target = "page_content"
        addition_mode = str(addition.page_content_mode or PAGE_CONTENT_MODE_REPLACE).strip() or PAGE_CONTENT_MODE_REPLACE
        target_mode = str(target.page_content_mode or PAGE_CONTENT_MODE_REPLACE).strip() or PAGE_CONTENT_MODE_REPLACE
        replace_mode_selected = False
        if target.content_blocks and target_mode != addition_mode:
            if PAGE_CONTENT_MODE_REPLACE in {target_mode, addition_mode}:
                target_mode = PAGE_CONTENT_MODE_REPLACE
                replace_mode_selected = True
            else:
                raise RuntimeError(f"Cannot merge {label}: conflicting page-content sync modes.")
        target.page_content_mode = addition_mode
        if replace_mode_selected:
            target.page_content_mode = PAGE_CONTENT_MODE_REPLACE
        if addition.page_content_label:
            effective_mode = str(target.page_content_mode or PAGE_CONTENT_MODE_REPLACE).strip() or PAGE_CONTENT_MODE_REPLACE
            if not target.page_content_label or effective_mode != PAGE_CONTENT_MODE_MANAGED_SECTION:
                target.page_content_label = addition.page_content_label
        if addition.text_property:
            if target.text_property and target.text_property != addition.text_property:
                raise RuntimeError(f"Cannot merge {label}: conflicting text properties.")
            target.text_property = addition.text_property
        target.content_blocks.extend(deepcopy(addition.content_blocks))
        return

    if addition.text_target:
        if target.text_target == "page_content" or (target.text_target and target.text_target != addition.text_target):
            raise RuntimeError(f"Cannot merge {label}: conflicting text targets.")
        target.text_target = addition.text_target

    if addition.text_property:
        if target.text_target == "page_content":
            raise RuntimeError(f"Cannot merge {label}: text-property sync conflicts with page-content sync.")
        if target.text_property and target.text_property != addition.text_property:
            raise RuntimeError(f"Cannot merge {label}: conflicting text properties.")
        target.text_property = addition.text_property

    if addition_synced_text:
        if target.text_target == "page_content":
            raise RuntimeError(f"Cannot merge {label}: plain text sync conflicts with page-content sync.")
        target.synced_text = append_synced_text(target.synced_text, addition_synced_text)


def build_nested_fragment_config(
    base_config: Dict[str, Any],
    overrides: Optional[Dict[str, Any]],
    *,
    settings: Dict[str, Any],
    fragments_map: Dict[str, Dict[str, Any]],
    config_map: Dict[str, Any],
) -> Dict[str, Any]:
    config = apply_audio_output_overrides(base_config, overrides or {})
    merged_tts = dict(settings)
    merged_tts.update(dict(config.get("tts") or {}))
    config["tts"] = merged_tts
    if not isinstance(config.get("fragments"), dict):
        config["fragments"] = fragments_map
    if not isinstance(config.get("config_map"), dict):
        config["config_map"] = config_map
    return config


def resolve_output_sequence_fragment(
    sequence_key: str,
    *,
    fragments_map: Dict[str, Dict[str, Any]],
    config_map: Dict[str, Any],
    settings: Dict[str, Any],
    page: Dict[str, Any],
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    config: Dict[str, Any],
    token: str,
    base_url: str,
    fragment_stack: Optional[Sequence[str]] = None,
) -> PageAudioPlan:
    value = str(sequence_key or "").strip()
    if not value:
        return PageAudioPlan(fragments=[])
    if value.upper() == SPECIAL_DAILY_NOVENA_AUDIO.upper():
        novena_page_title = (
            str(config.get("daily_novena_page_title", DEFAULT_DAILY_NOVENA_PAGE_TITLE)).strip()
            or DEFAULT_DAILY_NOVENA_PAGE_TITLE
        )
        return PageAudioPlan(
            fragments=build_daily_novena_audio_fragments(
                pages,
                title_property,
                novena_page_title,
                token,
                settings=settings,
                base_url=base_url,
            )
        )
    if value.upper() == SPECIAL_MONTHLY_INTENTION.upper():
        return PageAudioPlan(
            fragments=[build_monthly_intention_fragment_from_notion_or_provider(token, settings, base_url)]
        )
    spec = fragments_map.get(value)
    if not isinstance(spec, dict):
        raise RuntimeError(f"Unknown audio fragment '{value}'.")
    fragment_type = resolved_audio_fragment_type(spec)
    if not fragment_type:
        raise RuntimeError(f"Audio fragment '{value}' is missing a supported fragment type.")
    if fragment_type_matches(fragment_type, FRAGMENT_TYPE_TEXT) or fragment_type_matches(fragment_type, FRAGMENT_TYPE_PROMPT):
        return PageAudioPlan(
            fragments=[
                build_named_audio_fragment(
                    value,
                    fragments_map=fragments_map,
                    settings=settings,
                    page=page,
                    base_url=base_url,
                )
            ]
        )

    stack = list(fragment_stack or [])
    if value in stack:
        cycle = " -> ".join([*stack, value])
        raise RuntimeError(f"Audio fragment cycle detected: {cycle}")
    next_stack = [*stack, value]

    if fragment_type_matches(fragment_type, FRAGMENT_TYPE_SEQUENCE):
        children = spec.get("fragment_sequence") or []
        if not isinstance(children, list):
            raise RuntimeError(f"Audio fragment '{value}' has invalid fragment_sequence.")
        plan = PageAudioPlan(fragments=[])
        for child_key in children:
            child_plan = resolve_output_sequence_fragment(
                str(child_key or "").strip(),
                fragments_map=fragments_map,
                config_map=config_map,
                settings=settings,
                page=page,
                pages=pages,
                title_property=title_property,
                config=config,
                token=token,
                base_url=base_url,
                fragment_stack=next_stack,
            )
            merge_page_audio_plans(plan, child_plan, source_label=value)
        return plan

    if fragment_type_matches(fragment_type, FRAGMENT_TYPE_CONFIG):
        source_key = str(spec.get("source_config_key", "")).strip()
        source_config = config_map.get(source_key)
        if not isinstance(source_config, dict):
            raise RuntimeError(f"Audio fragment '{value}' references unknown config '{source_key}'.")
        nested_config = build_nested_fragment_config(
            source_config,
            spec.get("config") if isinstance(spec.get("config"), dict) else None,
            settings=settings,
            fragments_map=fragments_map,
            config_map=config_map,
        )
        nested_config["source_config_key"] = source_key
        nested_config["_fragment_stack"] = next_stack
        return build_page_audio_plan(
            page=page,
            pages=pages,
            title_property=title_property,
            config=nested_config,
            notion_token=token,
            base_url=base_url,
        )

    if fragment_type_matches(fragment_type, FRAGMENT_TYPE_BUILDER):
        builder_config = spec.get("config") or {}
        if not isinstance(builder_config, dict) or not str(builder_config.get("builder", "")).strip():
            raise RuntimeError(f"Audio fragment '{value}' is missing a builder config.")
        nested_config = build_nested_fragment_config(
            builder_config,
            None,
            settings=settings,
            fragments_map=fragments_map,
            config_map=config_map,
        )
        nested_config["_fragment_stack"] = next_stack
        return build_page_audio_plan(
            page=page,
            pages=pages,
            title_property=title_property,
            config=nested_config,
            notion_token=token,
            base_url=base_url,
        )

    if fragment_type_matches(fragment_type, FRAGMENT_TYPE_MONTHLY_INTENTION):
        return PageAudioPlan(
            fragments=[build_monthly_intention_fragment_from_notion_or_provider(token, settings, base_url)]
        )

    if fragment_type_matches(fragment_type, FRAGMENT_TYPE_RANDOM_INTENTION):
        special_config = spec.get("config") or {}
        intention_property = str(special_config.get("intention_property", DEFAULT_INTENTION_PROPERTY)).strip() or DEFAULT_INTENTION_PROPERTY
        intention_prefix = str(special_config.get("intention_prefix", DEFAULT_INTENTION_PREFIX)).strip() or DEFAULT_INTENTION_PREFIX
        fragment = build_page_intention_fragment(
            page,
            settings=settings,
            base_url=base_url,
            intention_property=intention_property,
            intention_prefix=intention_prefix,
        )
        return PageAudioPlan(fragments=[fragment] if fragment is not None else [])

    if fragment_type_matches(fragment_type, FRAGMENT_TYPE_DAILY_NOVENA_AUDIO):
        special_config = spec.get("config") or {}
        novena_page_title = (
            str(special_config.get("daily_novena_page_title", spec.get("daily_novena_page_title", ""))).strip()
            or str(config.get("daily_novena_page_title", DEFAULT_DAILY_NOVENA_PAGE_TITLE)).strip()
            or DEFAULT_DAILY_NOVENA_PAGE_TITLE
        )
        return PageAudioPlan(
            fragments=build_daily_novena_audio_fragments(
                pages,
                title_property,
                novena_page_title,
                token,
                settings=settings,
                base_url=base_url,
            )
        )

    raise RuntimeError(f"Unsupported audio fragment type '{fragment_type}' for '{value}'.")


def build_fragment_output_plan(
    page: Dict[str, Any],
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
    config_map = config.get("config_map") or {}
    if not isinstance(config_map, dict):
        raise RuntimeError("Invalid audio output config: config_map must be a map.")
    fragment_stack = config.get("_fragment_stack") or []
    if not isinstance(fragment_stack, list):
        fragment_stack = []
    sequence = config.get("fragment_sequence") or []
    if not isinstance(sequence, list):
        raise RuntimeError("Invalid audio output config: fragment_sequence must be a list.")
    plan = PageAudioPlan(fragments=[])
    for entry in sequence:
        child_plan = resolve_output_sequence_fragment(
            str(entry or "").strip(),
            fragments_map=fragments_map,
            config_map=config_map,
            settings=settings,
            page=page,
            pages=pages,
            title_property=title_property,
            config=config,
            token=token,
            base_url=base_url,
            fragment_stack=fragment_stack,
        )
        merge_page_audio_plans(plan, child_plan, source_label=str(entry or "").strip())
    if not plan.fragments:
        raise RuntimeError("Audio output did not produce any fragments.")
    return plan


def notion_rich_text_plain(items: Sequence[Dict[str, Any]]) -> str:
    parts: List[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        plain = str(item.get("plain_text", "")).strip()
        if not plain:
            plain = str(((item.get("text") or {}).get("content", ""))).strip()
        if plain:
            parts.append(plain)
    return normalize_whitespace(" ".join(parts))


def notion_block_plain_text(block: Dict[str, Any]) -> str:
    block_type = str(block.get("type", "")).strip()
    payload = block.get(block_type) or {}
    rich_text = payload.get("rich_text") or []
    if isinstance(rich_text, list):
        return notion_rich_text_plain(rich_text)
    return ""


def notion_blocks_plain_text(blocks: Sequence[Dict[str, Any]]) -> str:
    paragraphs: List[str] = []

    def visit(block: Dict[str, Any]) -> None:
        text = notion_block_plain_text(block)
        if text:
            paragraphs.append(text)
        block_type = str(block.get("type", "")).strip()
        payload = block.get(block_type) or {}
        for child in payload.get("children") or []:
            if isinstance(child, dict):
                visit(child)

    for block in blocks:
        if isinstance(block, dict):
            visit(block)
    return "\n\n".join(paragraphs)


def strip_fragment_label_prefix(label: str, text: str) -> str:
    clean_label = normalize_whitespace(label)
    value = normalize_whitespace(text)
    if not clean_label or not value:
        return value
    lowered_value = value.lower()
    lowered_label = clean_label.lower()
    if lowered_value == lowered_label:
        return ""
    if lowered_value.startswith(f"{lowered_label}."):
        return normalize_whitespace(value[len(clean_label) + 1 :])
    if lowered_value.startswith(f"{lowered_label}:"):
        return normalize_whitespace(value[len(clean_label) + 1 :])
    return value


def notion_toggle_block(text: str, children: Optional[Sequence[Dict[str, Any]]] = None) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"rich_text": notion_rich_text_chunks(text)}
    child_blocks = list(children or [])
    if child_blocks:
        payload["children"] = child_blocks
    return {"object": "block", "type": "toggle", "toggle": payload}


def fragment_text_content_blocks(label: str, text: str) -> List[Dict[str, Any]]:
    body = strip_fragment_label_prefix(label, text)
    paragraphs = plain_text_paragraphs_from_html(body) if "<" in body and ">" in body else [
        normalize_whitespace(part) for part in re.split(r"\n\s*\n", body) if normalize_whitespace(part)
    ]
    if not paragraphs and body:
        paragraphs = [body]
    return [notion_toggle_block(label, paragraphs_to_notion_blocks(paragraphs))] if paragraphs else [notion_toggle_block(label)]


def ensure_prompt_fragment_text(fragment: PageAudioFragment, *, base_url: str) -> str:
    current = normalize_whitespace(fragment.text)
    if current:
        return current
    prompt = normalize_whitespace(fragment.prompt)
    prompt_model = str(fragment.prompt_model or "").strip()
    api_key = os.getenv(OPENAI_API_KEY, "").strip()
    if not prompt or not prompt_model or not api_key:
        return current
    generated = call_openai_fragment_prompt(api_key, base_url, prompt_model, prompt)
    save_prompt_text_cache(
        page_audio_cache_dir(),
        fragment.collection or AUDIO_FRAGMENT_DEFAULT_COLLECTION,
        fragment.fragment_key or fragment.label,
        prompt_hash=fragment.hash_value,
        prompt=prompt,
        prompt_model=prompt_model,
        text=generated,
    )
    fragment.text = generated
    return normalize_whitespace(generated)


def source_audio_fragment_hash_value(label: str, source_url: str) -> str:
    raw = f"{normalize_whitespace(label)}|{str(source_url or '').strip()}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


def normalize_plan_for_row_text_sync(
    plan: PageAudioPlan,
    *,
    label: str,
    text_sync_mode: str,
    text_property: str,
) -> PageAudioPlan:
    normalized = PageAudioPlan(fragments=list(plan.fragments))
    mode = normalize_opus_dei_text_sync_mode(text_sync_mode)
    if mode == OPUS_DEI_TEXT_SYNC_MODE_NONE:
        return normalized
    if mode == OPUS_DEI_TEXT_SYNC_MODE_TEXT_PROPERTY:
        normalized.synced_text = normalize_whitespace(plan.synced_text) or normalize_whitespace(
            notion_blocks_plain_text(plan.content_blocks)
        )
        normalized.text_property = text_property
        return normalized
    if mode == OPUS_DEI_TEXT_SYNC_MODE_PAGE_CONTENT:
        if plan.text_target == "page_content" or plan.content_blocks:
            normalized.text_target = "page_content"
            normalized.content_blocks = deepcopy(plan.content_blocks)
            normalized.page_content_mode = str(plan.page_content_mode or PAGE_CONTENT_MODE_REPLACE).strip() or PAGE_CONTENT_MODE_REPLACE
            normalized.page_content_label = str(plan.page_content_label or label).strip()
            return normalized
        synced = normalize_whitespace(plan.synced_text)
        if synced:
            normalized.text_target = "page_content"
            normalized.content_blocks = fragment_text_content_blocks(label, synced)
            normalized.page_content_mode = PAGE_CONTENT_MODE_MANAGED_SECTION
            normalized.page_content_label = str(label or "").strip()
        return normalized
    return normalized


def plan_has_text_output(plan: PageAudioPlan) -> bool:
    return bool(plan.text_target or plan.text_property or normalize_whitespace(plan.synced_text) or plan.content_blocks)


def strip_plan_text_output(plan: PageAudioPlan) -> PageAudioPlan:
    return PageAudioPlan(fragments=list(plan.fragments))


def build_detailed_fragment_nested_config(
    spec: Dict[str, Any],
    row_config: Dict[str, Any],
    *,
    default_builder: str = "",
) -> Dict[str, Any]:
    config = deepcopy(spec.get("config") or {})
    builder = str(config.get("builder", "")).strip() or str(default_builder or "").strip()
    if builder:
        config["builder"] = builder
    merged_tts = dict(row_config.get("tts") or {})
    merged_tts.update(dict(config.get("tts") or {}))
    config["tts"] = merged_tts
    if "audio_caption" not in config and row_config.get("audio_caption"):
        config["audio_caption"] = row_config["audio_caption"]
    if "silence_ms" not in config:
        config["silence_ms"] = int(row_config.get("silence_ms", DEFAULT_SILENCE_MS))
    if row_config.get("output_folder") and "output_folder" not in config:
        config["output_folder"] = row_config["output_folder"]
    return config


def build_detailed_fragment_child_plan(
    spec: Dict[str, Any],
    *,
    page: Dict[str, Any],
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    row_config: Dict[str, Any],
    token: str,
    base_url: str,
) -> PageAudioPlan:
    label = str(spec.get("label", "")).strip() or str(spec.get("key", "")).strip() or "Fragment"
    key = str(spec.get("key", "")).strip() or label
    group = str(spec.get("group", AUDIO_FRAGMENT_DEFAULT_COLLECTION)).strip() or AUDIO_FRAGMENT_DEFAULT_COLLECTION
    kind = normalize_detailed_fragment_kind(str(spec.get("kind", "")).strip())
    settings = tts_settings_from_config(row_config)
    if kind == FRAGMENT_TYPE_TEXT:
        fragment = stable_text_fragment(
            cache_root=page_audio_cache_dir(),
            collection=group,
            key=key,
            label=label,
            text=str(spec.get("text", "")).strip(),
            settings=settings,
            base_url=base_url,
        )
        return PageAudioPlan(fragments=[fragment], synced_text=fragment.text)
    if kind == FRAGMENT_TYPE_PROMPT:
        fragment = stable_prompt_fragment(
            cache_root=page_audio_cache_dir(),
            collection=group,
            key=key,
            label=label,
            prompt=render_fragment_prompt_template(str(spec.get("prompt", "")).strip(), page, shared.local_today()),
            prompt_model=str(spec.get("prompt_model", "")).strip() or os.getenv(OAI_MODEL, "").strip() or "gpt-4.1-mini",
            settings=settings,
            base_url=base_url,
        )
        return PageAudioPlan(fragments=[fragment], synced_text=ensure_prompt_fragment_text(fragment, base_url=base_url))
    if kind == FRAGMENT_TYPE_MONTHLY_INTENTION:
        fragment = build_monthly_intention_fragment_from_notion_or_provider(token, settings, base_url)
        return PageAudioPlan(fragments=[fragment], synced_text=fragment.text)
    if kind == FRAGMENT_TYPE_RANDOM_INTENTION:
        fragment = build_page_intention_fragment(
            page,
            settings=settings,
            base_url=base_url,
            intention_property=str((spec.get("config") or {}).get("intention_property", DEFAULT_INTENTION_PROPERTY)).strip()
            or DEFAULT_INTENTION_PROPERTY,
            intention_prefix=str((spec.get("config") or {}).get("intention_prefix", DEFAULT_INTENTION_PREFIX)).strip()
            or DEFAULT_INTENTION_PREFIX,
        )
        return PageAudioPlan(
            fragments=[fragment] if fragment is not None else [],
            synced_text=normalize_whitespace(fragment.text) if fragment is not None else "",
        )
    if kind == FRAGMENT_TYPE_DAILY_NOVENA_AUDIO:
        novena_page_title = str(spec.get("daily_novena_page_title", "")).strip() or str(
            (spec.get("config") or {}).get("daily_novena_page_title", "")
        ).strip() or DEFAULT_DAILY_NOVENA_PAGE_TITLE
        fragments, content_blocks = build_daily_novena_sections(
            pages,
            title_property,
            novena_page_title,
            token,
            settings=settings,
            base_url=base_url,
        )
        return PageAudioPlan(fragments=fragments, text_target="page_content", content_blocks=content_blocks)
    if kind == FRAGMENT_KIND_SOURCE_AUDIO:
        source_url = str(spec.get("source_url", "")).strip()
        if not source_url:
            raise RuntimeError(f"Detailed fragment '{label}' is missing a source URL.")
        return PageAudioPlan(
            fragments=[
                PageAudioFragment(
                    kind="source_audio",
                    label=label,
                    hash_value=source_audio_fragment_hash_value(label, source_url),
                    source_url=source_url,
                    fragment_key=key,
                    collection=group,
                )
            ]
        )
    if kind == FRAGMENT_KIND_RSS_AUDIO:
        config = build_detailed_fragment_nested_config(spec, row_config, default_builder=RSS_AUDIO_BUILDER)
        return build_rss_audio_plan(page=page, config=config, base_url=base_url)
    if kind == FRAGMENT_KIND_BUILDER:
        config = build_detailed_fragment_nested_config(spec, row_config)
        if not str(config.get("builder", "")).strip():
            raise RuntimeError(f"Detailed fragment '{label}' is missing a builder.")
        return build_page_audio_plan(
            page=page,
            pages=pages,
            title_property=title_property,
            config=config,
            notion_token=token,
            base_url=base_url,
        )
    raise RuntimeError(f"Unsupported detailed fragment kind '{kind}' for '{label}'.")


def parse_weekday_mapping(raw: Any) -> Dict[str, str]:
    parsed = rss_match_map_values(raw)
    mapping: Dict[str, str] = {}
    for weekday, mystery_value in parsed.items():
        normalized = normalize_rosary_mystery_value(mystery_value)
        if normalized:
            mapping[weekday] = normalized
    return mapping


def normalize_rosary_mystery_value(value: str) -> str:
    text = normalize_flag_value(value)
    if not text:
        return ""
    if "joyful" in text:
        return "joyful"
    if "sorrowful" in text or "sorrow" in text:
        return "sorrowful"
    if "glorious" in text or "glory" in text:
        return "glorious"
    if "luminous" in text or "light" in text:
        return "luminous"
    return ""


def choose_rosary_mystery_set(target_date: datetime.date, raw_map: Any) -> str:
    mapping = dict(DEFAULT_ROSARY_WEEKDAY_MAP)
    mapping.update(parse_weekday_mapping(raw_map))
    key = normalize_flag_value(target_date.strftime("%A"))
    mystery_set = normalize_rosary_mystery_value(mapping.get(key, ""))
    if not mystery_set:
        raise RuntimeError(f"No rosary mystery mapping configured for {target_date.strftime('%A')}.")
    return mystery_set


def split_rosary_intentions(text: str, count: int = 5) -> List[str]:
    value = str(text or "").replace("\r", "").strip()
    if not value:
        return []
    normalized = re.sub(r"\n\s*(?:[-*]|\d+[.)])\s*", "\n", value)
    normalized = normalized.replace("||", "\n")
    parts = [normalize_whitespace(part) for part in re.split(r"\n{1,}|;{2,}", normalized) if normalize_whitespace(part)]
    if not parts:
        return []
    if len(parts) >= count:
        return parts[:count]
    out = list(parts)
    while len(out) < count:
        out.append(parts[min(len(out), len(parts) - 1)])
    return out


def rosary_mystery_fragment_key(mystery_set: str, decade_number: int) -> str:
    return f"rosary-{mystery_set}-{int(decade_number)}"


def prayer_intentions_database_id(token: str) -> str:
    return notion_database_id_by_env_or_name(
        token,
        NOTION_INTENTIONS_DATABASE_ID,
        NOTION_INTENTIONS_DATABASE_NAME,
        "Prayer Intentions",
    )


def page_primary_title_text(page: Dict[str, Any]) -> str:
    props = page.get("properties") or {}
    for key, prop in props.items():
        if str((prop or {}).get("type", "")).strip() != "title":
            continue
        value = page_property_text(page, str(key))
        if value:
            return value
    return ""


def abbreviate_intention_label(text: str, max_len: int = 48) -> str:
    value = normalize_whitespace(text)
    if len(value) <= max_len:
        return value
    clipped = value[: max(1, max_len - 3)].rstrip()
    if " " in clipped:
        clipped = clipped.rsplit(" ", 1)[0].rstrip()
    return f"{clipped}..."


def intention_entry_label(page: Dict[str, Any], petition: str) -> str:
    title = page_primary_title_text(page)
    if title:
        return abbreviate_intention_label(title)
    prayer_need = page_property_text(page, "Prayer Need").strip()
    if prayer_need:
        return abbreviate_intention_label(prayer_need)
    first_clause = re.split(r"(?<=[.!?])\s+|,\s+", normalize_whitespace(petition), maxsplit=1)[0].strip()
    return abbreviate_intention_label(first_clause or petition)


def weighted_shuffle_indices(weights: Sequence[float], rng: random.Random) -> List[int]:
    keyed: List[tuple[float, int]] = []
    for idx, weight in enumerate(weights):
        w = max(0.0001, float(weight))
        key = rng.random() ** (1.0 / w)
        keyed.append((key, idx))
    keyed.sort(key=lambda item: item[0], reverse=True)
    return [idx for _, idx in keyed]


def load_prayer_intention_entries(token: str, *, count: int = 5) -> List[Dict[str, str]]:
    db_id = prayer_intentions_database_id(token)
    if not db_id:
        return []
    cache_key = f"{db_id}|{shared.local_today().isoformat()}|{int(count)}"
    cached = _INTENTION_LIBRARY_CACHE.get(cache_key)
    if isinstance(cached, list) and cached:
        return deepcopy(cached)
    petition_property = os.getenv(NOTION_INTENTIONS_PETITION_PROPERTY, "Petition").strip() or "Petition"
    status_property = os.getenv(NOTION_INTENTIONS_STATUS_PROPERTY, "Status").strip() or "Status"
    frequency_property = os.getenv(NOTION_INTENTIONS_FREQUENCY_PROPERTY, "Frequency").strip() or "Frequency"
    allowed_statuses = parse_normalized_values(os.getenv(NOTION_INTENTIONS_STATUS_ALLOWED, "praying").strip() or "praying")
    pages = shared.notion_get_all_pages(db_id, token)
    entries: List[Dict[str, str]] = []
    weights: List[float] = []
    for page in pages:
        petition = page_property_text(page, petition_property).strip()
        if not petition:
            continue
        status_prop = ((page.get("properties") or {}).get(status_property) or {})
        status_type = str(status_prop.get("type", "")).strip()
        if status_type == "checkbox":
            if not bool(status_prop.get("checkbox")):
                continue
        elif status_type == "status":
            status_text = normalize_flag_value(str((status_prop.get("status") or {}).get("name", "")).strip())
            if allowed_statuses and status_text not in allowed_statuses:
                continue
        else:
            status_text = normalize_flag_value(page_property_text(page, status_property))
            if allowed_statuses and status_text not in allowed_statuses:
                continue
        weight = max(1.0, min(100.0, page_property_number(page, frequency_property, default=1.0)))
        entries.append(
            {
                "petition": petition,
                "label": intention_entry_label(page, petition),
            }
        )
        weights.append(weight)
    if not entries:
        return []
    rng = random.Random(int(shared.local_today().strftime("%Y%m%d")))
    order = weighted_shuffle_indices(weights, rng)
    selected = [entries[idx] for idx in order[: max(1, int(count))]]
    if selected and len(selected) < count:
        original = list(selected)
        while len(selected) < count:
            selected.append(deepcopy(original[min(len(selected), len(original) - 1)]))
    _INTENTION_LIBRARY_CACHE[cache_key] = deepcopy(selected)
    return selected


def load_prayer_intention_petitions(token: str, *, count: int = 5) -> List[str]:
    return [str(item.get("petition", "")).strip() for item in load_prayer_intention_entries(token, count=count) if str(item.get("petition", "")).strip()]


def rosary_mystery_metadata(fragments_map: Dict[str, Dict[str, Any]], mystery_set: str, decade_number: int) -> Dict[str, str]:
    key = rosary_mystery_fragment_key(mystery_set, decade_number)
    spec = fragments_map.get(key)
    if not isinstance(spec, dict):
        raise RuntimeError(f"Missing rosary mystery fragment '{key}'.")
    notes = str(spec.get("notes", "")).strip()
    metadata: Dict[str, str] = {}
    if notes:
        try:
            payload = json.loads(notes)
            if isinstance(payload, dict):
                metadata = {str(k): str(v).strip() for k, v in payload.items() if str(v).strip()}
        except Exception:
            metadata = {}
    title = metadata.get("title") or str(spec.get("label", "")).strip() or key
    fruit = metadata.get("fruit", "")
    return {"key": key, "title": title, "fruit": fruit}


def build_rosary_dynamic_plan(
    page: Dict[str, Any],
    config: Dict[str, Any],
    *,
    base_url: str,
    notion_token: str = "",
) -> PageAudioPlan:
    settings = tts_settings_from_config(config)
    fragments_map = config.get("fragments") or {}
    if not isinstance(fragments_map, dict) or not fragments_map:
        raise RuntimeError("Rosary output requires loaded audio fragments.")
    target_date = shared.local_today()
    include_intentions = bool(config.get("include_intentions", True))
    mystery_set = normalize_rosary_mystery_value(str(config.get("mystery_set", "")).strip()) or choose_rosary_mystery_set(
        target_date,
        config.get("weekday_map", {}),
    )
    intention_property = str(config.get("intention_property", DEFAULT_ROSARY_INTENTION_PROPERTY)).strip() or DEFAULT_ROSARY_INTENTION_PROPERTY
    intention_entries = load_prayer_intention_entries(notion_token, count=5) if include_intentions and str(notion_token or "").strip() else []
    intentions = [str(item.get("petition", "")).strip() for item in intention_entries if str(item.get("petition", "")).strip()]
    if include_intentions:
        if not intentions:
            intentions = split_rosary_intentions(page_property_text(page, intention_property), count=5)
        elif str(notion_token or "").strip():
            short_lines = "\n".join(str(item.get("label", "")).strip() for item in intention_entries if str(item.get("label", "")).strip())
            if short_lines:
                maybe_update_page_text_property(page, intention_property, short_lines, notion_token)
        if not intentions:
            raise RuntimeError(f"Rosary row is missing intentions in '{intention_property}'.")
    else:
        intentions = [""] * 5
    meditation_key = str(config.get("meditation_fragment_key", DEFAULT_ROSARY_MEDITATION_FRAGMENT_KEY)).strip() or DEFAULT_ROSARY_MEDITATION_FRAGMENT_KEY

    fragments: List[PageAudioFragment] = []
    mystery_rows: List[Dict[str, str]] = []
    intro_sequence = [
        "rosary-sign-of-cross",
        "rosary-apostles-creed",
        "rosary-our-father",
        "rosary-hail-mary",
        "rosary-hail-mary",
        "rosary-hail-mary",
        "rosary-glory-be",
    ]
    closing_sequence = [
        "rosary-hail-holy-queen",
        "rosary-closing-prayer",
        "rosary-sign-of-cross",
    ]
    for key in intro_sequence:
        fragments.append(build_named_audio_fragment(key, fragments_map=fragments_map, settings=settings, page=page, base_url=base_url))

    for decade_number in range(1, 6):
        mystery = rosary_mystery_metadata(fragments_map, mystery_set, decade_number)
        decade_intention = intentions[decade_number - 1]
        fragments.append(
            build_named_audio_fragment(
                mystery["key"],
                fragments_map=fragments_map,
                settings=settings,
                page=page,
                base_url=base_url,
            )
        )
        if include_intentions:
            fragments.append(
                build_named_audio_fragment(
                    meditation_key,
                    fragments_map=fragments_map,
                    settings=settings,
                    page=page,
                    base_url=base_url,
                    prompt_context={
                        "{mystery_set}": mystery_set.title(),
                        "{mystery_title}": mystery["title"],
                        "{fruit}": mystery["fruit"],
                        "{intention}": decade_intention,
                        "{decade_number}": str(decade_number),
                    },
                    key_override=f"rosary-decade-meditation-{mystery_set}-{decade_number}",
                    label_override=f"Rosary Meditation {decade_number}",
                )
            )
        fragments.append(build_named_audio_fragment("rosary-our-father", fragments_map=fragments_map, settings=settings, page=page, base_url=base_url))
        for _ in range(10):
            fragments.append(build_named_audio_fragment("rosary-hail-mary", fragments_map=fragments_map, settings=settings, page=page, base_url=base_url))
        fragments.append(build_named_audio_fragment("rosary-glory-be", fragments_map=fragments_map, settings=settings, page=page, base_url=base_url))
        fragments.append(build_named_audio_fragment("rosary-fatima-prayer", fragments_map=fragments_map, settings=settings, page=page, base_url=base_url))
        mystery_rows.append(
            {
                "title": mystery["title"],
                "fruit": mystery["fruit"],
                "intention": decade_intention,
            }
        )

    for key in closing_sequence:
        fragments.append(build_named_audio_fragment(key, fragments_map=fragments_map, settings=settings, page=page, base_url=base_url))
    toggle_children: List[Dict[str, Any]] = [
        notion_paragraph_block(f"{target_date.strftime('%A, %B %d, %Y')}: {mystery_set.title()} Mysteries.")
    ]
    for mystery in mystery_rows:
        item_children: List[Dict[str, Any]] = []
        fruit = normalize_whitespace(str(mystery.get("fruit", "")).strip())
        intention = normalize_whitespace(str(mystery.get("intention", "")).strip())
        if fruit:
            item_children.append(notion_paragraph_block(f"Fruit: {fruit}"))
        if include_intentions and intention:
            item_children.append(notion_paragraph_block(f"Intention: {intention}"))
        toggle_children.append(
            notion_numbered_list_item_block(
                normalize_whitespace(str(mystery.get("title", "")).strip()),
                item_children,
            )
        )
    return PageAudioPlan(
        fragments=fragments,
        text_target="page_content",
        content_blocks=[
            {
                "object": "block",
                "type": "toggle",
                "toggle": {
                    "rich_text": notion_rich_text_chunks("Rosary Mysteries"),
                    "children": toggle_children,
                },
            }
        ],
    )


def build_morning_prayer_plan(
    page: Dict[str, Any],
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    config: Dict[str, Any],
    token: str,
    base_url: str,
) -> PageAudioPlan:
    page_id = str(page.get("id", "")).strip()
    if not page_id:
        raise RuntimeError("Target page has no id.")
    contract = load_morning_prayer_contract_from_file()
    contract_keys = morning_prayer_contract_resolver_keys(contract)
    expected_keys = [
        "random-intention",
        "morning-offering",
        "daily-consecration",
        "baptismal-renewal",
        "petitions-intro",
        "monthly-intention",
        "petition-families",
        "petition-marriages",
        "petition-conversion",
        "petition-church",
        "petition-sanctification-of-the-church",
        "petition-sick-and-departed",
        "daily-novena-audio",
        "intercessory-litany",
        "spotify-playlist",
    ]
    if contract_keys:
        if contract_keys != expected_keys:
            raise RuntimeError(
                "Morning Prayer contract file resolver order does not match the runtime expectation."
            )
    contract_titles = morning_prayer_contract_resolver_titles(contract)
    contract_page_content_titles = morning_prayer_contract_page_content_titles(contract)
    contract_mode = str(config.get("resolver_contract_mode", "")).strip()
    if contract_mode == "file_driven":
        settings = tts_settings_from_config(config)
        cache_root = page_audio_cache_dir()
        monthly_fragment = build_monthly_intention_fragment_from_notion_or_provider(token, settings, base_url)
        novena_page_title = (
            str(config.get("daily_novena_page_title", DEFAULT_DAILY_NOVENA_PAGE_TITLE)).strip()
            or DEFAULT_DAILY_NOVENA_PAGE_TITLE
        )
        daily_novena_fragments, daily_novena_content_blocks = build_daily_novena_sections(
            pages,
            title_property,
            novena_page_title,
            token,
            settings=settings,
            base_url=base_url,
        )
        fragments: List[PageAudioFragment] = []
        content_blocks: List[Dict[str, Any]] = []
        resolver_map = {str(resolver.get("key", "")).strip(): resolver for resolver in morning_prayer_contract_resolvers(contract)}

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

        for resolver_key in contract_keys:
            resolver = resolver_map.get(resolver_key, {})
            title = str(resolver.get("title", resolver_key)).strip() or resolver_key
            kind = str(resolver.get("kind", "")).strip()
            targets = {str(target).strip() for target in (resolver.get("targets") or []) if str(target).strip()}
            if resolver_key == "daily-novena-audio":
                fragments.extend(daily_novena_fragments)
                continue
            if resolver_key == "monthly-intention":
                fragments.append(monthly_fragment)
                if "page_content" in targets:
                    content_blocks.append(morning_prayer_content_block(title, monthly_fragment.text))
                continue
            if resolver_key == "random-intention":
                intention = normalize_whitespace(page_property_text(page, DEFAULT_INTENTION_PROPERTY))
                if not intention:
                    continue
                spoken_text = normalize_whitespace(f"For today's intention: {intention}")
                fragments.append(
                    stable_text_fragment(
                        cache_root=cache_root,
                        collection=RANDOM_INTENTION_FRAGMENT_COLLECTION,
                        key=RANDOM_INTENTION_FRAGMENT_KEY,
                        label=RANDOM_INTENTION_FRAGMENT_LABEL,
                        text=spoken_text,
                        settings=settings,
                        base_url=base_url,
                    )
                )
                if "page_content" in targets:
                    content_blocks.append(morning_prayer_content_block(title, spoken_text))
                continue
            if kind == "spotify":
                if "page_content" in targets:
                    content_blocks.append(morning_prayer_content_block(title, "Spotify playlist resolver."))
                continue
            if kind != "file":
                continue
            file_text = load_morning_prayer_content_text(resolver_key)
            if not file_text:
                raise RuntimeError(f"Morning Prayer content file is missing or empty for resolver '{resolver_key}'.")
            fragments.append(stable_morning_fragment(title, file_text))
            if "page_content" in targets:
                content_blocks.append(morning_prayer_content_block(title, file_text))

        if not fragments:
            raise RuntimeError("No audio fragments were produced for Morning Prayer.")
        return PageAudioPlan(
            fragments=fragments,
            text_target="page_content",
            content_blocks=content_blocks,
        )
    settings = tts_settings_from_config(config)
    cache_root = page_audio_cache_dir()
    monthly_fragment = build_monthly_intention_fragment_from_notion_or_provider(token, settings, base_url)
    novena_page_title = (
        str(config.get("daily_novena_page_title", DEFAULT_DAILY_NOVENA_PAGE_TITLE)).strip()
        or DEFAULT_DAILY_NOVENA_PAGE_TITLE
    )
    daily_novena_fragments, daily_novena_content_blocks = build_daily_novena_sections(
        pages,
        title_property,
        novena_page_title,
        token,
        settings=settings,
        base_url=base_url,
    )

    fragments: List[PageAudioFragment] = []
    content_blocks: List[Dict[str, Any]] = []
    resolver_map = {str(resolver.get("key", "")).strip(): resolver for resolver in morning_prayer_contract_resolvers(contract)}

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

    for resolver_key in contract_keys:
        resolver = resolver_map.get(resolver_key, {})
        title = str(resolver.get("title", resolver_key)).strip() or resolver_key
        kind = str(resolver.get("kind", "")).strip()
        targets = {str(target).strip() for target in (resolver.get("targets") or []) if str(target).strip()}
        if resolver_key == "daily-novena-audio":
            fragments.extend(daily_novena_fragments)
            continue
        if resolver_key == "monthly-intention":
            fragments.append(monthly_fragment)
            if "page_content" in targets:
                content_blocks.append(morning_prayer_content_block(title, monthly_fragment.text))
            continue
        if resolver_key == "random-intention":
            intention = normalize_whitespace(page_property_text(page, DEFAULT_INTENTION_PROPERTY))
            if not intention:
                continue
            spoken_text = normalize_whitespace(f"For today's intention: {intention}")
            fragments.append(
                stable_text_fragment(
                    cache_root=cache_root,
                    collection=RANDOM_INTENTION_FRAGMENT_COLLECTION,
                    key=RANDOM_INTENTION_FRAGMENT_KEY,
                    label=RANDOM_INTENTION_FRAGMENT_LABEL,
                    text=spoken_text,
                    settings=settings,
                    base_url=base_url,
                )
            )
            if "page_content" in targets:
                content_blocks.append(morning_prayer_content_block(title, spoken_text))
            continue
        if kind == "spotify":
            if "page_content" in targets:
                content_blocks.append(morning_prayer_content_block(title, "Spotify playlist resolver."))
            continue
        if kind != "file":
            continue
        file_text = load_morning_prayer_content_text(resolver_key)
        if not file_text:
            raise RuntimeError(f"Morning Prayer content file is missing or empty for resolver '{resolver_key}'.")
        fragments.append(stable_morning_fragment(title, file_text))
        if "page_content" in targets:
            content_blocks.append(morning_prayer_content_block(title, file_text))
    if not fragments:
        raise RuntimeError("No audio fragments were produced for Morning Prayer.")
    if contract_page_content_titles:
        emitted_titles = [
            str(block.get("heading_3", {}).get("rich_text", [{}])[0].get("text", {}).get("content", "")).strip()
            for block in content_blocks
            if str(block.get("type", "")).strip() == "heading_3"
        ]
        contract_heading_titles = contract_page_content_titles
        if emitted_titles:
            visible_titles = [title for title in emitted_titles if title]
            if visible_titles[: len(contract_heading_titles)] != contract_heading_titles[: len(visible_titles)]:
                raise RuntimeError("Morning Prayer content order does not match the Morning Prayer resolver contract.")
    return PageAudioPlan(
        fragments=fragments,
        text_target="page_content",
        content_blocks=content_blocks,
    )


def build_morning_prayer_fragments(
    page: Dict[str, Any],
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    config: Dict[str, Any],
    token: str,
    base_url: str,
) -> List[PageAudioFragment]:
    return build_morning_prayer_plan(
        page=page,
        pages=pages,
        title_property=title_property,
        config=config,
        token=token,
        base_url=base_url,
    ).fragments


def rosary_fragment_key_from_label(label: str) -> str:
    lowered = normalize_flag_value(label)
    prayer_map = {
        "sign of the cross": "rosary-sign-of-cross",
        "apostles creed": "rosary-apostles-creed",
        "our father": "rosary-our-father",
        "hail mary": "rosary-hail-mary",
        "glory be": "rosary-glory-be",
        "fatima prayer": "rosary-fatima-prayer",
        "hail holy queen": "rosary-hail-holy-queen",
        "closing prayer": "rosary-closing-prayer",
        "rosary meditation template": DEFAULT_ROSARY_MEDITATION_FRAGMENT_KEY,
    }
    if lowered in prayer_map:
        return prayer_map[lowered]
    match = re.match(r"^(joyful|sorrowful|glorious|luminous)\s+([1-5])\b", lowered)
    if match:
        return f"rosary-{match.group(1)}-{match.group(2)}"
    return ""


def detailed_fragments_to_legacy_fragments_map(specs: Sequence[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    fragments_map: Dict[str, Dict[str, Any]] = {}
    for spec in specs:
        kind = normalize_detailed_fragment_kind(str(spec.get("kind", "")).strip())
        if kind not in {FRAGMENT_TYPE_TEXT, FRAGMENT_TYPE_PROMPT}:
            continue
        key = rosary_fragment_key_from_label(str(spec.get("label", "")).strip()) or str(spec.get("key", "")).strip()
        if not key:
            continue
        payload: Dict[str, Any] = {
            "key": key,
            "label": str(spec.get("label", "")).strip() or key,
            "collection": str(spec.get("group", "rosary")).strip() or "rosary",
            "notes": str(spec.get("notes", "")).strip(),
        }
        if kind == FRAGMENT_TYPE_PROMPT:
            payload["prompt"] = str(spec.get("prompt", "")).strip()
            payload["prompt_model"] = str(spec.get("prompt_model", "")).strip() or os.getenv(OAI_MODEL, "").strip() or "gpt-4.1-mini"
        else:
            payload["text"] = str(spec.get("text", "")).strip()
        fragments_map[key] = payload
    return fragments_map


def opus_dei_two_list_settings(
    page: Dict[str, Any],
    *,
    title_property: str,
    fragments_by_page_id: Dict[str, List[Dict[str, Any]]],
) -> Dict[str, Any]:
    page_id = str(page.get("id", "")).strip()
    related_specs = list(fragments_by_page_id.get(page_id) or [])
    assembly_mode = normalize_opus_dei_assembly_mode(page_property_text(page, OPUS_DEI_ASSEMBLY_MODE_PROPERTY))
    special_builder = normalize_flag_value(page_property_text(page, OPUS_DEI_SPECIAL_BUILDER_PROPERTY)).replace(" ", "_")
    if not assembly_mode:
        if special_builder:
            assembly_mode = OPUS_DEI_ASSEMBLY_MODE_SPECIAL
        elif related_specs:
            assembly_mode = OPUS_DEI_ASSEMBLY_MODE_FRAGMENTS
    if not assembly_mode and not related_specs:
        return {}
    title = shared.page_title(page, title_property).strip() or page_id or "Page Audio"
    text_sync_mode = normalize_opus_dei_text_sync_mode(page_property_text(page, OPUS_DEI_TEXT_SYNC_MODE_PROPERTY))
    include_intentions = "intentions" in title.lower()
    if not text_sync_mode and special_builder == OPUS_DEI_SPECIAL_BUILDER_ROSARY and include_intentions:
        text_sync_mode = OPUS_DEI_TEXT_SYNC_MODE_PAGE_CONTENT
    return {
        "title": title,
        "assembly_mode": assembly_mode or OPUS_DEI_ASSEMBLY_MODE_FRAGMENTS,
        "special_builder": special_builder,
        "text_sync_mode": text_sync_mode or OPUS_DEI_TEXT_SYNC_MODE_NONE,
        "text_property": page_property_text(page, OPUS_DEI_TEXT_PROPERTY_PROPERTY).strip() or DEFAULT_RSS_TEXT_PROPERTY,
        "audio_config": opus_dei_row_audio_config(page, title_property=title_property),
        "weekday_map": page_property_text(page, OPUS_DEI_WEEKDAY_MAP_PROPERTY).strip(),
        "fragment_specs": related_specs,
        "include_intentions": include_intentions,
    }


def opus_dei_row_config_key(page: Dict[str, Any], *, title_property: str) -> str:
    page_id = str(page.get("id", "")).strip()
    if page_id:
        return f"opus_dei:{page_id}"
    title = shared.page_title(page, title_property).strip()
    return f"opus_dei:{slugify(title)}"


def opus_dei_row_matches_filter(page: Dict[str, Any], config_key_filter: str, *, title_property: str) -> bool:
    wanted = str(config_key_filter or "").strip()
    if not wanted:
        return True
    title = shared.page_title(page, title_property).strip()
    candidates = {
        opus_dei_row_config_key(page, title_property=title_property),
        f"opus_dei:{slugify(title)}" if title else "",
        title,
    }
    return wanted in {candidate for candidate in candidates if candidate}


def build_opus_dei_two_list_plan(
    page: Dict[str, Any],
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    *,
    row_settings: Dict[str, Any],
    token: str,
    base_url: str,
) -> PageAudioPlan:
    assembly_mode = str(row_settings.get("assembly_mode", "")).strip()
    text_sync_mode = str(row_settings.get("text_sync_mode", OPUS_DEI_TEXT_SYNC_MODE_NONE)).strip() or OPUS_DEI_TEXT_SYNC_MODE_NONE
    text_property = str(row_settings.get("text_property", DEFAULT_RSS_TEXT_PROPERTY)).strip() or DEFAULT_RSS_TEXT_PROPERTY
    row_audio_config = deepcopy(row_settings.get("audio_config") or {})
    fragment_specs = list(row_settings.get("fragment_specs") or [])
    row_title = str(row_settings.get("title", "")).strip() or shared.page_title(page, title_property).strip()
    if assembly_mode == OPUS_DEI_ASSEMBLY_MODE_SPECIAL:
        special_builder = str(row_settings.get("special_builder", "")).strip()
        if special_builder != OPUS_DEI_SPECIAL_BUILDER_ROSARY:
            raise RuntimeError(f"Unsupported special builder '{special_builder}'.")
        config = {
            **row_audio_config,
            "builder": ROSARY_DYNAMIC_BUILDER,
            "fragments": detailed_fragments_to_legacy_fragments_map(fragment_specs),
            "weekday_map": row_settings.get("weekday_map", ""),
            "include_intentions": bool(row_settings.get("include_intentions", True)),
        }
        plan = build_rosary_dynamic_plan(page=page, config=config, base_url=base_url, notion_token=token)
        return normalize_plan_for_row_text_sync(
            plan,
            label=str(row_settings.get("title", "")).strip() or shared.page_title(page, title_property).strip() or "Rosary",
            text_sync_mode=text_sync_mode,
            text_property=text_property,
        )

    if not fragment_specs:
        raise RuntimeError("Two-list assembly row has no related detailed fragments.")
    if assembly_mode == OPUS_DEI_ASSEMBLY_MODE_FRAGMENTS and is_morning_prayer_title(row_title):
        contract_errors = morning_prayer_contract_errors(fragment_specs)
        if contract_errors:
            raise RuntimeError(
                "Morning Prayer detailed fragments are incomplete: "
                + "; ".join(contract_errors)
                + ". Re-run the Morning Prayer two-list migration before generating page audio."
            )

    plan = PageAudioPlan(fragments=[])
    source_roles_present = False
    source_selected = False
    source_errors: List[str] = []
    text_only_append_selected = False
    for spec in fragment_specs:
        label = str(spec.get("label", "")).strip() or str(spec.get("key", "")).strip() or "Fragment"
        role = normalize_fragment_assembly_role(str(spec.get("assembly_role", "")).strip()) or ASSEMBLY_ROLE_APPEND
        if role in {ASSEMBLY_ROLE_PRIMARY_SOURCE, ASSEMBLY_ROLE_FALLBACK_SOURCE}:
            source_roles_present = True
            if source_selected:
                continue
        try:
            child_plan = build_detailed_fragment_child_plan(
                spec,
                page=page,
                pages=pages,
                title_property=title_property,
                row_config=row_audio_config,
                token=token,
                base_url=base_url,
            )
        except Exception as exc:
            if role in {ASSEMBLY_ROLE_PRIMARY_SOURCE, ASSEMBLY_ROLE_FALLBACK_SOURCE}:
                source_errors.append(f"{label}: {exc}")
                continue
            raise
        normalized_child = normalize_plan_for_row_text_sync(
            child_plan,
            label=label,
            text_sync_mode=text_sync_mode,
            text_property=text_property,
        )
        if role == ASSEMBLY_ROLE_APPEND and not child_plan.fragments and plan_has_text_output(normalized_child):
            text_only_append_selected = True
        if role in {ASSEMBLY_ROLE_PRIMARY_SOURCE, ASSEMBLY_ROLE_FALLBACK_SOURCE} and text_only_append_selected:
            normalized_child = strip_plan_text_output(normalized_child)
        if role in {ASSEMBLY_ROLE_PRIMARY_SOURCE, ASSEMBLY_ROLE_FALLBACK_SOURCE}:
            normalized_child = strip_duplicate_leading_random_intention(plan.fragments, normalized_child)
            if not normalized_child.fragments:
                source_errors.append(f"{label}: no audio fragments were produced")
                continue
            source_selected = True
        merge_page_audio_plans(plan, normalized_child, source_label=label)

    if source_roles_present and not source_selected:
        raise RuntimeError("; ".join(source_errors) if source_errors else "No source fragment could be resolved.")
    if text_sync_mode == OPUS_DEI_TEXT_SYNC_MODE_PAGE_CONTENT and not (
        plan.text_target == "page_content" and bool(plan.content_blocks)
    ):
        raise RuntimeError(f'"{row_title}" is configured for page_content but no reliable text content was produced.')
    return plan


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


def notion_rich_text_chunks(text: str) -> List[Dict[str, Any]]:
    value = normalize_whitespace(text)
    if not value:
        return []
    return [{"type": "text", "text": {"content": chunk}} for chunk in shared.split_text_chunks(value, 1900)]


def notion_paragraph_block(text: str) -> Dict[str, Any]:
    return {"object": "block", "type": "paragraph", "paragraph": {"rich_text": notion_rich_text_chunks(text)}}


def notion_numbered_list_item_block(text: str, children: Optional[Sequence[Dict[str, Any]]] = None) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"rich_text": notion_rich_text_chunks(text)}
    child_blocks = list(children or [])
    if child_blocks:
        payload["children"] = child_blocks
    return {"object": "block", "type": "numbered_list_item", "numbered_list_item": payload}


def paragraphs_to_notion_blocks(paragraphs: Sequence[str]) -> List[Dict[str, Any]]:
    blocks: List[Dict[str, Any]] = []
    for paragraph in paragraphs:
        text = normalize_whitespace(paragraph)
        if not text:
            continue
        blocks.append(notion_paragraph_block(text))
    return blocks


DIVINE_OFFICE_EXACT_HEADERS = {
    "HYMN": "Hymn",
    "PSALMODY": "Psalmody",
    "READING": "Reading",
    "SHORT READING": "Reading",
    "RESPONSORY": "Responsory",
    "INTERCESSIONS": "Intercessions",
    "CONCLUDING PRAYER": "Concluding Prayer",
    "CONCLUSION": "Conclusion",
    "BLESSING AND DISMISSAL": "Blessing and Dismissal",
    "GOSPEL CANTICLE": "Gospel Canticle",
    "CANTICLE OF ZECHARIAH": "Canticle of Zechariah",
    "CANTICLE OF MARY": "Canticle of Mary",
    "EXAMINATION OF CONSCIENCE": "Examination of Conscience",
}


def strip_divine_office_nonprayer_html(raw_html: str) -> str:
    value = str(raw_html or "").strip()
    if not value:
        return ""
    value = re.sub(r'(?is)<div\b[^>]*class=["\'][^"\']*table-container[^"\']*["\'][^>]*>.*?</div>', "", value)
    value = re.sub(r"(?is)<table\b[^>]*>.*?</table>", "", value)
    return value


def looks_like_divine_office_title(paragraph: str) -> bool:
    value = normalize_whitespace(paragraph)
    if not value:
        return False
    lowered = value.lower()
    return bool(
        re.search(
            r"\b(invitatory|lauds|morning prayer|midmorning prayer|midday prayer|midafternoon prayer|afternoon prayer|vespers|evening prayer|compline|night prayer)\b",
            lowered,
        )
        and re.search(r"\bfor\b", lowered)
    )


def divine_office_section_header(paragraph: str) -> tuple[str, str]:
    value = normalize_whitespace(paragraph)
    if not value:
        return "", ""
    if value.startswith("Ribbon Placement:"):
        remainder = normalize_whitespace(re.sub(r"^Ribbon Placement:\s*", "", value))
        return "Ribbon Placement", remainder
    exact = DIVINE_OFFICE_EXACT_HEADERS.get(value.upper())
    if exact:
        return exact, ""
    if re.fullmatch(r"(Psalm|Canticle)\s+.+", value, flags=re.IGNORECASE):
        return value, ""
    if re.fullmatch(r"Ant\.\s*\d+.*", value, flags=re.IGNORECASE):
        return value, ""
    return "", ""


def divine_office_content_blocks_from_html(raw_html: str) -> List[Dict[str, Any]]:
    paragraphs = plain_text_paragraphs_from_html(strip_divine_office_nonprayer_html(raw_html))
    sections: List[tuple[str, List[str]]] = []
    current_title = ""
    current_body: List[str] = []

    def flush() -> None:
        nonlocal current_title, current_body
        body = [normalize_whitespace(part) for part in current_body if normalize_whitespace(part)]
        title = normalize_whitespace(current_title)
        if not title and not body:
            current_body = []
            return
        if not title:
            title = "Prayer Text"
        sections.append((title, body))
        current_title = ""
        current_body = []

    for paragraph in paragraphs:
        text = normalize_whitespace(paragraph)
        if not text:
            continue
        if looks_like_divine_office_title(text):
            if not current_title:
                current_title = "Opening"
            current_body.append(text)
            continue
        header, remainder = divine_office_section_header(text)
        if header:
            flush()
            current_title = header
            if remainder:
                current_body.append(remainder)
            continue
        if current_title == "Ribbon Placement" and re.match(
            r"^(Lord, open my lips|God, come to my assistance|O God, come to my assistance|Examine your conscience)\b",
            text,
            flags=re.IGNORECASE,
        ):
            flush()
            current_title = "Opening"
        if not current_title:
            current_title = "Opening"
        current_body.append(text)
    flush()

    blocks: List[Dict[str, Any]] = []
    for title, body in sections:
        child_blocks = [notion_paragraph_block(part) for part in body if normalize_whitespace(part)]
        toggle_payload: Dict[str, Any] = {"rich_text": notion_rich_text_chunks(title)}
        if child_blocks:
            toggle_payload["children"] = child_blocks
        blocks.append({"object": "block", "type": "toggle", "toggle": toggle_payload})
    return blocks


AUXILIUM_SECTION_MARKERS: Sequence[tuple[str, str]] = (
    ("Every Day", "Prayers to be said every day:"),
    ("Sunday", "On Sundays:"),
    ("Monday", "On Mondays:"),
    ("Tuesday", "On Tuesdays:"),
    ("Wednesday", "On Wednesdays:"),
    ("Thursday", "On Thursdays:"),
    ("Friday", "On Fridays:"),
    ("Saturday", "On Saturdays:"),
    ("Conclusion", "Conclusion for Every Day"),
)

AUXILIUM_FRAGMENT_KEYS: Dict[str, str] = {
    "Every Day": "auxilium-every-day",
    "Sunday": "auxilium-sunday",
    "Monday": "auxilium-monday",
    "Tuesday": "auxilium-tuesday",
    "Wednesday": "auxilium-wednesday",
    "Thursday": "auxilium-thursday",
    "Friday": "auxilium-friday",
    "Saturday": "auxilium-saturday",
    "Conclusion": "auxilium-conclusion",
}


def clean_pdf_extracted_text(text: str) -> str:
    lines: List[str] = []
    for raw_line in str(text or "").replace("\r", "").splitlines():
        line = raw_line.strip()
        if not line:
            lines.append("")
            continue
        if re.fullmatch(r"\d+", line):
            continue
        lines.append(raw_line)
    return "\n".join(lines)


def auxilium_section_paragraphs(text: str) -> List[str]:
    paragraphs: List[str] = []
    current_parts: List[str] = []
    for raw_line in clean_pdf_extracted_text(text).splitlines():
        line = normalize_whitespace(raw_line)
        if not line:
            if current_parts:
                paragraphs.append(normalize_whitespace(" ".join(current_parts)))
                current_parts = []
            continue
        if line.lower().startswith("litany of "):
            if current_parts:
                paragraphs.append(normalize_whitespace(" ".join(current_parts)))
                current_parts = []
            paragraphs.append(line)
            continue
        current_parts.append(line)
        if re.search(r"[.!?:]$", line):
            paragraphs.append(normalize_whitespace(" ".join(current_parts)))
            current_parts = []
    if current_parts:
        paragraphs.append(normalize_whitespace(" ".join(current_parts)))
    return [paragraph for paragraph in paragraphs if paragraph]


def extract_auxilium_sections_from_pdf_text(text: str) -> Dict[str, List[str]]:
    cleaned = clean_pdf_extracted_text(text)
    matches: List[tuple[int, int, str]] = []
    for title, marker in AUXILIUM_SECTION_MARKERS:
        match = re.search(re.escape(marker), cleaned, flags=re.IGNORECASE)
        if not match:
            continue
        matches.append((match.start(), match.end(), title))
    matches.sort()
    sections: Dict[str, List[str]] = {}
    for index, (_, end_pos, title) in enumerate(matches):
        next_start = matches[index + 1][0] if index + 1 < len(matches) else len(cleaned)
        body = cleaned[end_pos:next_start].strip()
        paragraphs = auxilium_section_paragraphs(body)
        if paragraphs:
            sections[title] = paragraphs
    return sections


def fetch_auxilium_sections(pdf_url: str) -> Dict[str, List[str]]:
    url = str(pdf_url or "").strip()
    if not url:
        raise RuntimeError("Auxilium text builder requires a PDF source URL.")
    cached = _AUXILIUM_SECTIONS_CACHE.get(url)
    if isinstance(cached, dict) and cached:
        return cached
    response = page_audio_http_get(url, timeout=60)
    reader = PdfReader(io.BytesIO(response.content))
    extracted = "\n".join((page.extract_text() or "") for page in reader.pages)
    sections = extract_auxilium_sections_from_pdf_text(extracted)
    if not sections:
        raise RuntimeError(f"Could not parse Auxilium prayer sections from {url}.")
    _AUXILIUM_SECTIONS_CACHE[url] = sections
    return sections


def auxilium_sections_from_fragment_map(fragments_map: Dict[str, Dict[str, Any]]) -> Dict[str, List[str]]:
    out: Dict[str, List[str]] = {}
    for title, key in AUXILIUM_FRAGMENT_KEYS.items():
        fragment = fragments_map.get(key)
        if not isinstance(fragment, dict):
            continue
        text = normalize_whitespace(str(fragment.get("text", "")).strip())
        if not text:
            continue
        paragraphs = auxilium_section_paragraphs(text)
        if paragraphs:
            out[title] = paragraphs
    return out


def auxilium_daily_content_blocks(
    target_date: datetime.date,
    pdf_url: str,
    *,
    notion_token: str = "",
) -> List[Dict[str, Any]]:
    sections: Dict[str, List[str]] = {}
    token = str(notion_token or "").strip()
    if token:
        fragments_payload = load_audio_fragments_from_notion(token)
        fragment_map = fragments_payload.get("fragments") or {}
        if isinstance(fragment_map, dict) and fragment_map:
            sections = auxilium_sections_from_fragment_map(fragment_map)
    if not sections:
        sections = fetch_auxilium_sections(pdf_url)
    weekday_title = target_date.strftime("%A")
    ordered_titles = ["Every Day", weekday_title, "Conclusion"]
    blocks: List[Dict[str, Any]] = []
    for title in ordered_titles:
        paragraphs = sections.get(title) or []
        if not paragraphs:
            continue
        child_blocks = [notion_paragraph_block(paragraph) for paragraph in paragraphs if normalize_whitespace(paragraph)]
        toggle_payload: Dict[str, Any] = {"rich_text": notion_rich_text_chunks(title)}
        if child_blocks:
            toggle_payload["children"] = child_blocks
        blocks.append({"object": "block", "type": "toggle", "toggle": toggle_payload})
    if not blocks:
        raise RuntimeError(f"No Auxilium prayer content found for {weekday_title}.")
    return blocks


def block_rich_text_signature(rich: Any) -> str:
    if not isinstance(rich, list):
        return ""
    parts: List[str] = []
    for item in rich:
        if not isinstance(item, dict):
            continue
        plain = str(item.get("plain_text", "")).strip()
        if plain:
            parts.append(plain)
            continue
        text_payload = item.get("text") or {}
        content = str(text_payload.get("content", "")).strip()
        if content:
            parts.append(content)
    return normalize_whitespace(" ".join(parts))


def desired_block_signature(blocks: Sequence[Dict[str, Any]]) -> List[tuple[str, str, tuple[Any, ...]]]:
    out: List[tuple[str, str, tuple[Any, ...]]] = []
    for block in blocks:
        block_type = str(block.get("type", "")).strip()
        payload = block.get(block_type) or {}
        text = block_rich_text_signature(payload.get("rich_text") or [])
        children = payload.get("children") or []
        child_signature = tuple(desired_block_signature(children)) if isinstance(children, list) and children else tuple()
        out.append((block_type, text, child_signature))
    return out


def existing_content_signature(
    blocks: Sequence[Dict[str, Any]],
    token: str,
) -> List[tuple[str, str, tuple[Any, ...]]]:
    out: List[tuple[str, str, tuple[Any, ...]]] = []
    for block in blocks:
        block_type = str(block.get("type", "")).strip()
        text = normalize_whitespace(shared.block_rich_text_plain(block))
        child_signature: tuple[Any, ...] = tuple()
        block_id = str(block.get("id", "")).strip()
        if block_id and bool(block.get("has_children")):
            child_signature = tuple(existing_content_signature(page_audio_cached_blocks(block_id, token), token))
        out.append((block_type, text, child_signature))
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
    if existing_content_signature(removable, token) == desired_block_signature(desired_blocks):
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


def managed_prayer_text_section_block(page_id: str, label: str, desired_blocks: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    heading = normalize_whitespace(label) or "Prayer Text"
    return notion_toggle_block(f"{heading} {prayer_text_section_marker(page_id)}", deepcopy(list(desired_blocks)))


def sync_managed_page_content_section(
    page_id: str,
    token: str,
    *,
    label: str,
    desired_blocks: Sequence[Dict[str, Any]],
) -> bool:
    existing = shared.notion_list_block_children(page_id, token)
    marker = prayer_text_section_marker(page_id)
    removable = [block for block in existing if block_has_text_marker(block, marker)]
    desired_section = [managed_prayer_text_section_block(page_id, label, desired_blocks)] if desired_blocks else []
    if existing_content_signature(removable, token) == desired_block_signature(desired_section):
        return False
    for block in removable:
        block_id = str(block.get("id", "")).strip()
        if block_id:
            shared.notion_archive_block(block_id, token)
    if not desired_section:
        return bool(removable)
    insert_after = ""
    for block in existing:
        if block_has_text_marker(block, marker):
            continue
        block_type = str(block.get("type", "")).strip()
        if block_type in {"audio", "bookmark", "embed"}:
            insert_after = str(block.get("id", "")).strip()
            continue
        break
    if insert_after:
        shared.notion_append_children(page_id, desired_section, token, after=insert_after)
    else:
        shared.notion_append_children(page_id, desired_section, token, position="start")
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
    long_match = re.search(r"\b([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\b", value)
    if long_match:
        month_token = long_match.group(1).strip()
        day = int(long_match.group(2))
        year = int(long_match.group(3))
        for fmt in ("%b", "%B"):
            try:
                month = datetime.datetime.strptime(month_token, fmt).month
                return datetime.date(year, month, day)
            except ValueError:
                continue
    numeric_match = re.match(r"^(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b", value)
    if not numeric_match:
        slash_match = re.match(r"^(\d{1,2})/(\d{1,2})\b", value)
        if not slash_match:
            return None
        month = int(slash_match.group(1))
        day = int(slash_match.group(2))
        try:
            return datetime.date(target_year, month, day)
        except ValueError:
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


def rss_title_day_of_year(title: str) -> Optional[int]:
    match = re.search(r"\bDay\s+(\d{1,3})\b", str(title or ""), re.IGNORECASE)
    if not match:
        return None
    try:
        value = int(match.group(1))
    except Exception:
        return None
    return value if 1 <= value <= 366 else None


def rss_entry_pubdate(item: ET.Element) -> Optional[datetime.date]:
    raw = str(item.findtext("pubDate", "")).strip()
    if not raw:
        return None
    for fmt in (
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
    ):
        try:
            return datetime.datetime.strptime(raw, fmt).date()
        except Exception:
            continue
    return None


def rss_match_map_values(raw: Any) -> Dict[str, str]:
    if isinstance(raw, dict):
        out: Dict[str, str] = {}
        for key, item in raw.items():
            norm_key = normalize_flag_value(str(key or ""))
            norm_value = str(item or "").strip()
            if norm_key and norm_value:
                out[norm_key] = norm_value
        return out
    value = str(raw or "").strip()
    if not value:
        return {}
    try:
        payload = json.loads(value)
        if isinstance(payload, dict):
            out: Dict[str, str] = {}
            for key, item in payload.items():
                norm_key = normalize_flag_value(str(key or ""))
                norm_value = str(item or "").strip()
                if norm_key and norm_value:
                    out[norm_key] = norm_value
            if out:
                return out
    except Exception:
        pass
    out: Dict[str, str] = {}
    for line in re.split(r"[\r\n]+", value):
        part = str(line or "").strip()
        if not part or "=" not in part:
            continue
        key, mapped = part.split("=", 1)
        norm_key = normalize_flag_value(key)
        norm_value = str(mapped or "").strip()
        if norm_key and norm_value:
            out[norm_key] = norm_value
    return out


def render_feed_match_text(template: str, target_date: datetime.date) -> str:
    text = str(template or "").strip()
    if not text:
        return ""
    replacements = {
        "{today_iso}": target_date.isoformat(),
        "{year}": str(target_date.year),
        "{month}": str(target_date.month),
        "{month_zero}": f"{target_date.month:02d}",
        "{month_name}": target_date.strftime("%B"),
        "{month_short}": target_date.strftime("%b"),
        "{day}": str(target_date.day),
        "{day_zero}": f"{target_date.day:02d}",
        "{day_of_year}": str(target_date.timetuple().tm_yday),
        "{weekday}": target_date.strftime("%A"),
        "{weekday_short}": target_date.strftime("%a"),
    }
    rendered = text
    for needle, replacement in replacements.items():
        rendered = rendered.replace(needle, replacement)
    return normalize_whitespace(rendered)


def xml_local_name(tag: Any) -> str:
    value = str(tag or "").strip()
    if "}" in value:
        value = value.rsplit("}", 1)[-1]
    if ":" in value:
        value = value.rsplit(":", 1)[-1]
    return value.lower()


def rss_image_url_from_element(element: Optional[ET.Element]) -> str:
    if element is None:
        return ""
    for child in list(element):
        local_name = xml_local_name(child.tag)
        if local_name == "image":
            href = str(child.attrib.get("href", "")).strip()
            if href:
                return href
            url_attr = str(child.attrib.get("url", "")).strip()
            if url_attr:
                return url_attr
            text = str(child.text or "").strip()
            if text.lower().startswith(("http://", "https://")):
                return text
            for grandchild in list(child):
                if xml_local_name(grandchild.tag) == "url":
                    value = str(grandchild.text or "").strip()
                    if value.lower().startswith(("http://", "https://")):
                        return value
        if local_name == "thumbnail":
            value = str(child.attrib.get("url", "")).strip() or str(child.attrib.get("href", "")).strip()
            if value:
                return value
        if local_name == "content":
            medium = str(child.attrib.get("medium", "")).strip().lower()
            content_type = str(child.attrib.get("type", "")).strip().lower()
            if medium == "image" or content_type.startswith("image/"):
                value = str(child.attrib.get("url", "")).strip() or str(child.attrib.get("href", "")).strip()
                if value:
                    return value
    return ""


def title_matches_filter(title: str, filter_text: str) -> bool:
    wanted = normalize_whitespace(filter_text).lower()
    if not wanted:
        return True
    lowered = normalize_whitespace(title).lower()
    if wanted in lowered:
        return True
    for aliases in TITLE_MATCH_ALIAS_GROUPS:
        if any(alias in wanted for alias in aliases) and any(alias in lowered for alias in aliases):
            return True
    return False


def rss_item_to_entry(
    item: ET.Element,
    feed_url: str,
    target_date: datetime.date,
    *,
    channel_artwork_url: str = "",
) -> Optional[Dict[str, Any]]:
    title = str(item.findtext("title", "")).strip()
    if not title:
        return None
    enclosure = item.find("enclosure")
    audio_url = str((enclosure.attrib if enclosure is not None else {}).get("url", "")).strip()
    if not audio_url:
        return None
    content_node = item.find("{http://purl.org/rss/1.0/modules/content/}encoded")
    html_body = str(content_node.text if content_node is not None else item.findtext("description", "") or "").strip()
    entry_date = divine_office_title_date(title, target_date.year) or rss_entry_pubdate(item)
    day_of_year = rss_title_day_of_year(title)
    return {
        "title": title,
        "audio_url": audio_url,
        "source_url": str(item.findtext("link", "")).strip(),
        "text": "\n\n".join(plain_text_paragraphs_from_html(html_body)),
        "content_html": html_body,
        "feed_url": feed_url,
        "date": entry_date.isoformat() if entry_date else "",
        "entry_date": entry_date,
        "day_of_year": day_of_year,
        "artwork_url": rss_image_url_from_element(item) or str(channel_artwork_url or "").strip(),
    }


def choose_dated_feed_entry(
    entries: Sequence[Dict[str, Any]],
    target_date: datetime.date,
    *,
    title_filter: Optional[str] = None,
) -> Dict[str, Any]:
    exact: Optional[Dict[str, Any]] = None
    latest_past: Optional[Dict[str, Any]] = None
    latest_date: Optional[datetime.date] = None
    for entry in entries:
        title = str(entry.get("title", "")).strip()
        if not title_matches_filter(title, str(title_filter or "")):
            continue
        entry_date = entry.get("entry_date")
        if not isinstance(entry_date, datetime.date):
            continue
        if entry_date == target_date:
            exact = entry
            break
        if entry_date <= target_date and (latest_date is None or entry_date > latest_date):
            latest_past = entry
            latest_date = entry_date
    chosen = exact or latest_past
    if chosen is None:
        raise RuntimeError(
            f"No dated feed entry found in {str((entries[0] if entries else {}).get('feed_url', '')).strip() or 'feed'} "
            f"for {target_date.isoformat()}."
        )
    return chosen


def choose_day_of_year_feed_entry(
    entries: Sequence[Dict[str, Any]],
    target_date: datetime.date,
    *,
    title_filter: str = "",
) -> Dict[str, Any]:
    target_doy = int(target_date.timetuple().tm_yday)
    exact: Optional[Dict[str, Any]] = None
    latest_past: Optional[Dict[str, Any]] = None
    latest_doy: Optional[int] = None
    for entry in entries:
        title = str(entry.get("title", "")).strip()
        if not title_matches_filter(title, title_filter):
            continue
        item_doy = entry.get("day_of_year")
        if not isinstance(item_doy, int):
            continue
        if item_doy == target_doy:
            exact = entry
            break
        if item_doy <= target_doy and (latest_doy is None or item_doy > latest_doy):
            latest_past = entry
            latest_doy = item_doy
    chosen = exact or latest_past
    if chosen is None:
        raise RuntimeError(
            f"No day-of-year feed entry found in {str((entries[0] if entries else {}).get('feed_url', '')).strip() or 'feed'} "
            f"for day {target_doy}."
        )
    return chosen


def choose_weekday_map_feed_entry(
    entries: Sequence[Dict[str, Any]],
    target_date: datetime.date,
    match_map: Dict[str, str],
) -> Dict[str, Any]:
    weekday_key = normalize_flag_value(target_date.strftime("%A"))
    wanted = (
        match_map.get(weekday_key)
        or match_map.get(normalize_flag_value(target_date.strftime("%a")))
        or match_map.get("default")
        or ""
    ).strip()
    if not wanted:
        raise RuntimeError(f"weekday_map strategy has no mapping for {target_date.strftime('%A')}.")
    lowered = wanted.lower()
    for entry in entries:
        title = str(entry.get("title", "")).strip()
        if lowered in title.lower():
            return entry
    raise RuntimeError(
        f"No weekday-mapped entry found in {str((entries[0] if entries else {}).get('feed_url', '')).strip() or 'feed'} "
        f"for {target_date.strftime('%A')} using '{wanted}'."
    )


def choose_fixed_title_feed_entry(entries: Sequence[Dict[str, Any]], match_text: str) -> Dict[str, Any]:
    wanted = str(match_text or "").strip().lower()
    if not wanted:
        raise RuntimeError("fixed_title strategy requires Feed Match Text.")
    for entry in entries:
        title = str(entry.get("title", "")).strip()
        lowered = title.lower()
        if lowered == wanted or title_matches_filter(title, match_text):
            return entry
    raise RuntimeError(
        f"No fixed-title entry found in {str((entries[0] if entries else {}).get('feed_url', '')).strip() or 'feed'} "
        f"matching '{match_text}'."
    )


def fetch_rss_feed_entry(
    target_date: datetime.date,
    *,
    feed_url: str,
    match_text: str = "",
    match_strategy: str = RSS_MATCH_CONTAINS_WITH_DATE,
    match_map: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    cache_key = cached_rss_feed_entries_key(feed_url, target_date.year)
    entries = _RSS_FEED_ENTRIES_CACHE.get(cache_key)
    if entries is None:
        response = page_audio_http_get(feed_url, timeout=30)
        root = ET.fromstring(response.content)
        channel = root.find("channel")
        if channel is None:
            raise RuntimeError(f"Invalid RSS feed at {feed_url}.")
        channel_artwork_url = rss_image_url_from_element(channel)
        entries = [
            entry
            for entry in (
                rss_item_to_entry(item, feed_url, target_date, channel_artwork_url=channel_artwork_url)
                for item in channel.findall("item")
            )
            if isinstance(entry, dict)
        ]
        if not entries:
            raise RuntimeError(f"No RSS audio entries found in {feed_url}.")
        _RSS_FEED_ENTRIES_CACHE[cache_key] = list(entries)

    strategy = normalize_flag_value(match_strategy) or normalize_flag_value(RSS_MATCH_CONTAINS_WITH_DATE)
    rendered_match_text = render_feed_match_text(match_text, target_date)
    parsed_map = match_map or {}
    if strategy == normalize_flag_value(RSS_MATCH_DAY_OF_YEAR):
        return choose_day_of_year_feed_entry(entries, target_date, title_filter=rendered_match_text)
    if strategy == normalize_flag_value(RSS_MATCH_MONTH_DAY):
        return choose_dated_feed_entry(entries, target_date, title_filter=rendered_match_text)
    if strategy == normalize_flag_value(RSS_MATCH_WEEKDAY_MAP):
        return choose_weekday_map_feed_entry(entries, target_date, parsed_map)
    if strategy == normalize_flag_value(RSS_MATCH_FIXED_TITLE):
        return choose_fixed_title_feed_entry(entries, rendered_match_text)
    return choose_dated_feed_entry(entries, target_date, title_filter=rendered_match_text)


def fetch_divine_office_feed_entry(
    target_date: datetime.date,
    feed_url: str = DIVINE_OFFICE_FEED_URL,
    match_text: str = "Invitatory",
) -> Dict[str, str]:
    entry = fetch_rss_feed_entry(
        target_date,
        feed_url=feed_url,
        match_text=match_text,
        match_strategy=RSS_MATCH_CONTAINS_WITH_DATE,
    )
    return {str(key): value for key, value in entry.items()}


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
            artwork_url=str(feed_entry.get("artwork_url", "")).strip(),
        )
    )
    content_blocks = divine_office_content_blocks_from_html(feed_entry.get("content_html", ""))
    return PageAudioPlan(
        fragments=fragments,
        synced_text="",
        text_property=str(config.get("text_property", DEFAULT_RSS_TEXT_PROPERTY)).strip() or DEFAULT_RSS_TEXT_PROPERTY,
        text_target="page_content",
        content_blocks=content_blocks,
    )


def build_divine_office_night_text_plan(config: Dict[str, Any]) -> PageAudioPlan:
    feed_entry = fetch_divine_office_feed_entry(shared.local_today(), feed_url=DIVINE_OFFICE_FEED_URL, match_text="Night Prayer")
    content_blocks = divine_office_content_blocks_from_html(feed_entry.get("content_html", ""))
    return PageAudioPlan(
        fragments=[],
        text_target="page_content",
        content_blocks=content_blocks,
    )


def build_divine_office_evening_text_plan(config: Dict[str, Any]) -> PageAudioPlan:
    feed_entry = fetch_divine_office_feed_entry(shared.local_today(), feed_url=DIVINE_OFFICE_FEED_URL, match_text="Evening Prayer")
    content_blocks = divine_office_content_blocks_from_html(feed_entry.get("content_html", ""))
    return PageAudioPlan(
        fragments=[],
        text_target="page_content",
        content_blocks=content_blocks,
    )


def build_divine_office_morning_text_plan(config: Dict[str, Any]) -> PageAudioPlan:
    entry = fetch_divine_office_feed_entry(shared.local_today(), feed_url=DIVINE_OFFICE_FEED_URL, match_text="Morning Prayer")
    content_blocks = divine_office_content_blocks_from_html(entry.get("content_html", ""))
    return PageAudioPlan(
        fragments=[],
        text_target="page_content",
        content_blocks=content_blocks,
    )


def build_auxilium_daily_text_plan(config: Dict[str, Any], notion_token: str = "") -> PageAudioPlan:
    pdf_url = str(config.get("rss_feed_url", "")).strip()
    if not pdf_url:
        raise RuntimeError("auxilium_daily_text_v1 requires 'rss_feed_url' to point at the source PDF.")
    return PageAudioPlan(
        fragments=[],
        text_target="page_content",
        content_blocks=auxilium_daily_content_blocks(shared.local_today(), pdf_url, notion_token=notion_token),
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
    match_strategy = str(config.get("rss_match_strategy", RSS_MATCH_CONTAINS_WITH_DATE)).strip() or RSS_MATCH_CONTAINS_WITH_DATE
    match_map = rss_match_map_values(config.get("rss_match_map", ""))
    feed_entry = fetch_rss_feed_entry(
        shared.local_today(),
        feed_url=feed_url,
        match_text=match_text,
        match_strategy=match_strategy,
        match_map=match_map,
    )

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
            artwork_url=str(feed_entry.get("artwork_url", "")).strip(),
        )
    )
    paragraphs = plain_text_paragraphs_from_html(feed_entry.get("content_html", ""))
    text_property = str(config.get("text_property", "")).strip()
    if "divineoffice.org" in feed_url.lower():
        return PageAudioPlan(
            fragments=fragments,
            text_target="page_content",
            content_blocks=divine_office_content_blocks_from_html(feed_entry.get("content_html", "")),
        )
    return PageAudioPlan(
        fragments=fragments,
        synced_text="\n\n".join(paragraphs),
        text_property=text_property,
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
            {
                "label": fragment.label,
                "hash": fragment.hash_value,
                "key": fragment.fragment_key,
                "collection": fragment.collection,
                "artwork_url": str(fragment.artwork_url or "").strip(),
            }
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


def page_audio_export_group_name(page: Dict[str, Any], *, title_property: str, config: Dict[str, Any]) -> str:
    output_folder = str(config.get("output_folder", "")).strip()
    if output_folder:
        return output_folder
    title = shared.page_title(page, title_property).strip() or str(page.get("id", "")).strip() or "page-audio"
    raise RuntimeError(f'Row "{title}" is missing a valid "Output Folder" required for ordered Playlist Audio export.')


def page_audio_export_entry_name(page: Dict[str, Any], *, title_property: str) -> str:
    title = shared.page_title(page, title_property).strip() or str(page.get("id", "")).strip() or "page-audio"
    return safe_path_component(title, slugify(title))


def page_audio_export_metadata(
    page: Dict[str, Any],
    *,
    title_property: str,
    audio_format: str,
    config: Dict[str, Any],
) -> PageAudioExportMetadata:
    folder_name = safe_path_component(page_audio_export_group_name(page, title_property=title_property, config=config), "Unassigned")
    entry_name = page_audio_export_entry_name(page, title_property=title_property)
    order_property = resolve_top_level_order_property_name()
    order_value = page_property_number_or_none(page, order_property)
    if order_value is None:
        title = shared.page_title(page, title_property).strip() or str(page.get("id", "")).strip() or "page-audio"
        raise RuntimeError(f'Row "{title}" is missing a valid "{order_property}" required for ordered Playlist Audio export.')
    order_display = prayer_order_contract.format_top_level_order(order_value)
    if not order_display:
        title = shared.page_title(page, title_property).strip() or str(page.get("id", "")).strip() or "page-audio"
        raise RuntimeError(f'Row "{title}" has an invalid "{order_property}" for ordered Playlist Audio export.')
    file_stem = safe_path_component(
        f"{order_display} - {folder_name} - {entry_name}",
        slugify(f"{order_display}-{folder_name}-{entry_name}"),
    )
    clean_ext = str(audio_format or "").strip().lstrip(".") or "bin"
    return PageAudioExportMetadata(
        folder_name=folder_name,
        entry_name=entry_name,
        order_value=float(order_value),
        order_display=order_display,
        file_stem=file_stem,
        audio_extension=clean_ext,
    )


def page_audio_output_library_paths(
    metadata: PageAudioExportMetadata,
) -> tuple[Path, Path]:
    root = page_audio_library_dir()
    directory = root / metadata.folder_name
    directory.mkdir(parents=True, exist_ok=True)
    return directory / f"{metadata.file_stem}.{metadata.audio_extension}", directory / f"{metadata.file_stem}.json"


def page_audio_output_library_is_current(audio_path: Path, meta_path: Path, render_hash: str) -> bool:
    if not audio_path.exists() or not meta_path.exists():
        return False
    try:
        payload = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception:
        return False
    return str(payload.get("render_hash", "")).strip().lower() == str(render_hash or "").strip().lower()


def persist_page_audio_output_library(
    page: Dict[str, Any],
    *,
    title_property: str,
    config_key: str,
    config: Dict[str, Any],
    fragments: Sequence[PageAudioFragment],
    render_hash: str,
    audio_bytes: bytes,
) -> tuple[Path, Path]:
    settings = tts_settings_from_config(config)
    export_metadata = page_audio_export_metadata(
        page,
        title_property=title_property,
        audio_format=str(settings["format"]),
        config=config,
    )
    audio_path, meta_path = page_audio_output_library_paths(
        export_metadata,
    )
    audio_path.write_bytes(audio_bytes)
    artwork_url = page_audio_cover_art_url(fragments)
    payload = {
        "title": shared.page_title(page, title_property).strip(),
        "page_id": str(page.get("id", "")).strip(),
        "playlist": page_property_text(
            page,
            os.getenv(PAGE_AUDIO_LIBRARY_GROUP_PROPERTY, DEFAULT_PAGE_AUDIO_LIBRARY_GROUP_PROPERTY).strip()
            or DEFAULT_PAGE_AUDIO_LIBRARY_GROUP_PROPERTY,
        ).strip(),
        "output_folder": str(config.get("output_folder", "")).strip(),
        "config_key": str(config_key or "").strip(),
        "builder": str(config.get("builder", "")).strip(),
        "audio_caption": str(config.get("audio_caption", "")).strip(),
        "render_hash": str(render_hash or "").strip(),
        "date": shared.local_today().isoformat(),
        "tts": settings,
        "export_order": export_metadata.order_value,
        "export_order_display": export_metadata.order_display,
        "export_stem": export_metadata.file_stem,
        "managed_output": True,
        "artwork_url": artwork_url,
        "fragments": [
            {
                "label": fragment.label,
                "kind": fragment.kind,
                "hash_value": fragment.hash_value,
                "fragment_key": fragment.fragment_key,
                "collection": fragment.collection,
                "source_url": fragment.source_url,
                "artwork_url": fragment.artwork_url,
            }
            for fragment in fragments
        ],
    }
    meta_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return audio_path, meta_path


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
            prompt=normalize_whitespace(str(payload.get("prompt", "")).strip()),
            prompt_model=str(payload.get("prompt_model", "")).strip(),
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
        "prompt": normalize_whitespace(fragment.prompt),
        "prompt_model": str(fragment.prompt_model or "").strip(),
        "fragment_key": str(fragment.fragment_key or "").strip(),
        "collection": str(fragment.collection or "").strip(),
    }
    meta_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def page_audio_current_render_hash(page_id: str, token: str) -> str:
    for block in page_audio_cached_blocks(page_id, token):
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
    blocks = page_audio_cached_blocks(page_id, token)
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
    for block in page_audio_cached_blocks(page_id, token):
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
    if removed:
        invalidate_page_audio_cached_blocks(page_id)
    return removed


def page_audio_remove_blank_placeholders(page_id: str, token: str) -> int:
    removed = 0
    for block in page_audio_cached_blocks(page_id, token):
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
    if removed:
        invalidate_page_audio_cached_blocks(page_id)
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
    invalidate_page_audio_cached_blocks(page_id)


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


def ffmpeg_audio_output_args(audio_format: str) -> List[str]:
    fmt = str(audio_format or "").strip().lower()
    if fmt == "mp3":
        return ["-c:a", ffmpeg_audio_codec(fmt), "-q:a", "0"]
    if fmt == "wav":
        return ["-c:a", ffmpeg_audio_codec(fmt)]
    if fmt == "aac":
        return ["-c:a", ffmpeg_audio_codec(fmt), "-b:a", "256k"]
    if fmt == "opus":
        return [
            "-c:a",
            ffmpeg_audio_codec(fmt),
            "-b:a",
            "192k",
            "-vbr",
            "on",
            "-compression_level",
            "10",
        ]
    if fmt == "flac":
        return ["-c:a", ffmpeg_audio_codec(fmt), "-compression_level", "8"]
    raise RuntimeError(f"Unsupported ffmpeg audio format '{audio_format}'.")


def pcm_normalize_channel_layout() -> str:
    return "mono" if PCM_NORMALIZE_CHANNELS == 1 else "stereo"


def ffmpeg_pcm_normalize_args() -> List[str]:
    return [
        "-vn",
        "-ar",
        str(PCM_NORMALIZE_SAMPLE_RATE),
        "-ac",
        str(PCM_NORMALIZE_CHANNELS),
        "-c:a",
        "pcm_s16le",
    ]


def audio_format_supports_embedded_artwork(audio_format: str) -> bool:
    return str(audio_format or "").strip().lower() == "mp3"


def page_audio_cover_art_url(fragments: Sequence[PageAudioFragment]) -> str:
    for fragment in fragments:
        if fragment.kind == "source_audio" and str(fragment.artwork_url or "").strip():
            return str(fragment.artwork_url).strip()
    for fragment in fragments:
        if str(fragment.artwork_url or "").strip():
            return str(fragment.artwork_url).strip()
    return ""


def cached_cover_art_path(cache_root: Path, artwork_hash: str) -> Optional[Path]:
    directory = cache_root / "artwork" / artwork_hash[:2] / artwork_hash[2:4]
    if not directory.exists():
        return None
    matches = [path for path in directory.glob(f"{artwork_hash}.*") if path.is_file()]
    return matches[0] if matches else None


def ensure_cover_art_path(artwork_url: str, cache_root: Path) -> Optional[Path]:
    url = str(artwork_url or "").strip()
    if not url:
        return None
    artwork_hash = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
    cached = cached_cover_art_path(cache_root, artwork_hash)
    if cached is not None:
        return cached
    response = page_audio_http_get(url, timeout=30)
    raw = bytes(response.content or b"")
    if not raw:
        return None
    content_type = str(response.headers.get("Content-Type", "")).strip()
    filename = shared.infer_filename_from_url(url, fallback_stem=f"cover_art_{artwork_hash}", content_type=content_type)
    extension = Path(filename).suffix.lstrip(".").lower() or "jpg"
    if extension == "jpeg":
        extension = "jpg"
    path = page_audio_cache_path(cache_root, "artwork", artwork_hash, extension)
    if not path.exists():
        path.write_bytes(raw)
    return path


def embed_cover_art_with_ffmpeg(audio_bytes: bytes, audio_format: str, cover_art_path: Path, cache_root: Path) -> bytes:
    fmt = str(audio_format or "").strip().lower()
    if not audio_format_supports_embedded_artwork(fmt):
        return audio_bytes
    tmp_dir = cache_root / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=tmp_dir) as temp_dir:
        audio_input_path = Path(temp_dir) / f"input.{fmt}"
        audio_output_path = Path(temp_dir) / f"output.{fmt}"
        audio_input_path.write_bytes(audio_bytes)
        run_ffmpeg(
            [
                "-y",
                "-i",
                str(audio_input_path),
                "-i",
                str(cover_art_path),
                "-map",
                "0:a:0",
                "-map",
                "1:v:0",
                "-c:a",
                "copy",
                "-c:v",
                "mjpeg",
                "-id3v2_version",
                "3",
                "-metadata:s:v",
                "title=Album cover",
                "-metadata:s:v",
                "comment=Cover (front)",
                "-disposition:v:0",
                "attached_pic",
                str(audio_output_path),
            ]
        )
        return audio_output_path.read_bytes()


def maybe_embed_cover_art(
    audio_bytes: bytes,
    audio_format: str,
    fragments: Sequence[PageAudioFragment],
    cache_root: Path,
) -> bytes:
    if not audio_bytes or not audio_format_supports_embedded_artwork(audio_format):
        return audio_bytes
    artwork_url = page_audio_cover_art_url(fragments)
    if not artwork_url:
        return audio_bytes
    try:
        cover_art_path = ensure_cover_art_path(artwork_url, cache_root)
        if cover_art_path is None:
            return audio_bytes
        return embed_cover_art_with_ffmpeg(audio_bytes, audio_format, cover_art_path, cache_root)
    except Exception as exc:
        print(
            f"WARN page_audio_cover_art skipped reason={type(exc).__name__} detail={str(exc).strip() or 'unknown'}",
            file=sys.stderr,
        )
        return audio_bytes


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


def ensure_prompt_fragment_audio(
    fragment: PageAudioFragment,
    settings: Dict[str, Any],
    cache_root: Path,
    openai_key: str,
    base_url: str,
) -> Path:
    cache_path = page_audio_cache_path(cache_root, "tts", fragment.hash_value, str(settings["format"]))
    if not fragment.text:
        fragment.text = load_prompt_text_cache(cache_root, fragment.collection, fragment.fragment_key or fragment.label, fragment.hash_value)
    if cache_path.exists():
        persist_library_audio_fragment(fragment, cache_path, settings)
        return cache_path
    if not fragment.text:
        prompt_model = str(fragment.prompt_model or "").strip() or os.getenv(OAI_MODEL, "").strip() or "gpt-4.1-mini"
        fragment.text = call_openai_fragment_prompt(openai_key, base_url, prompt_model, fragment.prompt)
        save_prompt_text_cache(
            cache_root,
            fragment.collection or AUDIO_FRAGMENT_DEFAULT_COLLECTION,
            fragment.fragment_key or fragment.label,
            prompt_hash=fragment.hash_value,
            prompt=fragment.prompt,
            prompt_model=prompt_model,
            text=fragment.text,
        )
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
    source_url = str(fragment.source_url or "").strip()
    if not source_url:
        raise RuntimeError("Source audio fragment is missing source_url.")
    if source_url.lower().startswith("http"):
        response = page_audio_http_get(source_url, timeout=60)
        raw = response.content
        content_type = str(response.headers.get("Content-Type", "")).strip()
    else:
        raw, content_type = shared.notion_download_bytes(source_url)
    filename = shared.infer_filename_from_url(
        source_url,
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


def ensure_normalized_audio_fragment(path: Path, hash_value: str, cache_root: Path) -> Path:
    normalized_hash = hashlib.sha256(f"{hash_value}|{PCM_NORMALIZE_PROFILE}".encode("utf-8")).hexdigest()[:16]
    normalized_path = page_audio_cache_path(cache_root, "normalized", normalized_hash, PCM_NORMALIZE_EXTENSION)
    if normalized_path.exists():
        return normalized_path
    run_ffmpeg(
        [
            "-y",
            "-i",
            str(path),
            *ffmpeg_pcm_normalize_args(),
            str(normalized_path),
        ]
    )
    return normalized_path


def ensure_silence_fragment(cache_root: Path, silence_ms: int) -> Optional[Path]:
    if silence_ms <= 0:
        return None
    silence_hash = hashlib.sha256(f"{PCM_NORMALIZE_PROFILE}|{silence_ms}".encode("utf-8")).hexdigest()[:16]
    silence_path = page_audio_cache_path(cache_root, "silence", silence_hash, PCM_NORMALIZE_EXTENSION)
    if silence_path.exists():
        return silence_path
    duration_seconds = max(0.0, silence_ms / 1000.0)
    run_ffmpeg(
        [
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"anullsrc=r={PCM_NORMALIZE_SAMPLE_RATE}:cl={pcm_normalize_channel_layout()}",
            "-t",
            f"{duration_seconds:.3f}",
            *ffmpeg_pcm_normalize_args(),
            str(silence_path),
        ]
    )
    return silence_path


def assemble_audio_with_ffmpeg(fragment_paths: Sequence[Path], target_format: str, silence_ms: int, cache_root: Path) -> bytes:
    if not fragment_paths:
        raise RuntimeError("No audio fragments were assembled.")
    silence_path = ensure_silence_fragment(cache_root, silence_ms)
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
                "-vn",
                *ffmpeg_audio_output_args(target_format),
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
    source_paths: List[Path] = []
    for fragment in fragments:
        if fragment.kind == "tts":
            path = ensure_tts_fragment_audio(fragment, settings, cache_root, openai_key, base_url)
        elif fragment.kind == "prompt":
            path = ensure_prompt_fragment_audio(fragment, settings, cache_root, openai_key, base_url)
        elif fragment.kind == "source_audio":
            path = ensure_source_audio_fragment(fragment, cache_root)
        else:
            raise RuntimeError(f"Unsupported fragment kind '{fragment.kind}'.")
        source_paths.append(path)
    target_format = str(settings["format"])
    # Preserve single-fragment files as-is when the source already matches the requested output format.
    if len(source_paths) == 1 and source_paths[0].suffix.lower().lstrip(".") == target_format:
        return source_paths[0].read_bytes()
    fragment_paths = [
        ensure_normalized_audio_fragment(path, fragment.hash_value, cache_root)
        for fragment, path in zip(fragments, source_paths)
    ]
    return assemble_audio_with_ffmpeg(fragment_paths, target_format, silence_ms, cache_root)


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


def clean_monthly_intention_body_clause(text: str) -> str:
    value = re.sub(r"^Let us pray\s+", "", str(text or "").strip(), flags=re.IGNORECASE).strip().rstrip(".")
    value = re.sub(
        r"\s+(?:Francis|Leo)\s+Vatican,.*?(?:Original:\s*[A-Za-z]+)?$",
        "",
        value,
        flags=re.IGNORECASE,
    ).strip().rstrip(".")
    return normalize_whitespace(value)


def parse_monthly_intention_section(month_name: str, section: str) -> Dict[str, str]:
    value = str(section or "").strip()
    title = value.strip().strip(".")
    body = ""
    match = re.search(r"\bLet us pray\b", value, re.IGNORECASE)
    if match:
        title = value[: match.start()].strip().strip(".")
        body = value[match.start() :].strip()
    body_clause = clean_monthly_intention_body_clause(body)
    spoken_text = f"For the Holy Father's monthly intention: {body_clause}." if body_clause else (
        f"For the Holy Father's monthly intention this month: {title}."
    )
    return {
        "month": month_name.title(),
        "title": title,
        "body": body,
        "spoken_text": normalize_whitespace(spoken_text),
    }


def normalize_monthly_intention_payload(payload: Dict[str, Any]) -> Dict[str, str]:
    month = str(payload.get("month", "")).strip()
    title = normalize_whitespace(str(payload.get("title", "")).strip().strip("."))
    body = normalize_whitespace(str(payload.get("body", "")).strip())
    body_clause = clean_monthly_intention_body_clause(body)
    spoken_text = (
        f"For the Holy Father's monthly intention: {body_clause}."
        if body_clause
        else f"For the Holy Father's monthly intention this month: {title or month}."
    )
    normalized = {
        "month": month,
        "title": title,
        "body": body,
        "spoken_text": normalize_whitespace(spoken_text),
    }
    source_url = str(payload.get("source_url", "")).strip()
    if source_url:
        normalized["source_url"] = source_url
    return normalized


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
            return normalize_monthly_intention_payload(cached_month)

    pdf_url = popes_prayer_pdf_url_for_year(year, language="en")
    response = page_audio_http_get(pdf_url, timeout=60)
    reader = PdfReader(io.BytesIO(response.content))
    extracted = "\n".join((page.extract_text() or "") for page in reader.pages)
    sections = extract_month_sections_from_pdf_text(extracted)
    months_payload: Dict[str, Dict[str, str]] = {}
    for parsed_month, section in sections.items():
        parsed = parse_monthly_intention_section(parsed_month, section)
        parsed["source_url"] = pdf_url
        months_payload[parsed_month] = normalize_monthly_intention_payload(parsed)
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
        return build_morning_prayer_plan(
            page=page,
            pages=pages,
            title_property=title_property,
            config=config,
            token=notion_token,
            base_url=base_url,
        )
    if builder == DIVINE_OFFICE_INVITATORY_BUILDER:
        return build_divine_office_invitatory_plan(page=page, config=config, base_url=base_url)
    if builder == DIVINE_OFFICE_NIGHT_TEXT_BUILDER:
        return build_divine_office_night_text_plan(config=config)
    if builder == DIVINE_OFFICE_EVENING_TEXT_BUILDER:
        return build_divine_office_evening_text_plan(config=config)
    if builder == DIVINE_OFFICE_MORNING_TEXT_BUILDER:
        return build_divine_office_morning_text_plan(config=config)
    if builder == AUXILIUM_DAILY_TEXT_BUILDER:
        return build_auxilium_daily_text_plan(config=config, notion_token=notion_token)
    if builder == RSS_AUDIO_BUILDER:
        return build_rss_audio_plan(page=page, config=config, base_url=base_url)
    if builder == AUDIO_FRAGMENTS_BUILDER:
        return build_fragment_output_plan(
            page=page,
            pages=pages,
            title_property=title_property,
            config=config,
            token=notion_token,
            base_url=base_url,
        )
    if builder == ROSARY_DYNAMIC_BUILDER:
        return build_rosary_dynamic_plan(page=page, config=config, base_url=base_url, notion_token=notion_token)
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
        if not plan.content_blocks:
            raise RuntimeError("Page-content sync expected content blocks, but none were produced.")
        if str(plan.page_content_mode or PAGE_CONTENT_MODE_REPLACE).strip() == PAGE_CONTENT_MODE_MANAGED_SECTION:
            content_changed = sync_managed_page_content_section(
                page_id,
                notion_token,
                label=str(plan.page_content_label or "").strip() or "Prayer Text",
                desired_blocks=plan.content_blocks,
            )
        else:
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
    cache_root = page_audio_cache_dir()
    export_metadata = page_audio_export_metadata(
        page,
        title_property=title_property,
        audio_format=str(settings["format"]),
        config=config,
    )
    library_audio_path, library_meta_path = page_audio_output_library_paths(
        export_metadata,
    )
    if current_hash == render_hash and page_audio_is_positioned_near_top(page_id, notion_token):
        if not page_audio_output_library_is_current(library_audio_path, library_meta_path, render_hash):
            audio_bytes = build_assembled_audio(fragments, config, openai_key, base_url)
            audio_bytes = maybe_embed_cover_art(audio_bytes, str(settings["format"]), fragments, cache_root)
            persist_page_audio_output_library(
                page,
                title_property=title_property,
                config_key=config_key,
                config=config,
                fragments=fragments,
                render_hash=render_hash,
                audio_bytes=audio_bytes,
            )
        return f"cached:{settings['format']}:{settings['model']}:{settings['voice']}:hash={render_hash}"

    audio_bytes = build_assembled_audio(fragments, config, openai_key, base_url)
    audio_bytes = maybe_embed_cover_art(audio_bytes, str(settings["format"]), fragments, cache_root)
    persist_page_audio_output_library(
        page,
        title_property=title_property,
        config_key=config_key,
        config=config,
        fragments=fragments,
        render_hash=render_hash,
        audio_bytes=audio_bytes,
    )
    page_audio_remove_old_blocks(page_id, notion_token)
    page_audio_remove_blank_placeholders(page_id, notion_token)
    filename = f"{slugify(shared.page_title(page, title_property))}_{shared.local_today().isoformat()}.{settings['format']}"
    content_type = shared.audio_content_type(str(settings["format"]))
    upload_id = shared.notion_upload_file(
        filename=filename,
        content_type=content_type,
        file_bytes=audio_bytes,
        token=notion_token,
    )
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


def resolved_config_key_with_source(
    config_map: Dict[str, Any],
    property_candidates: Sequence[tuple[str, str]],
) -> tuple[str, str]:
    for prop_name, raw_key in property_candidates:
        value = str(raw_key or "").strip()
        if not value:
            continue
        resolved = config_key_if_defined(config_map, value)
        if resolved:
            return resolved, str(prop_name or "").strip()
    return "", ""


def resolved_audio_config_keys_with_sources(
    page: Dict[str, Any],
    config_map: Dict[str, Any],
    *,
    primary_property: str,
    secondary_property: str,
    legacy_config_property: str,
    legacy_resolver_property: str,
) -> List[tuple[str, str]]:
    out: List[tuple[str, str]] = []
    seen: Set[str] = set()
    for prop_name in (primary_property, secondary_property, legacy_config_property, legacy_resolver_property):
        raw_key = page_property_text(page, prop_name).strip()
        resolved = config_key_if_defined(config_map, raw_key)
        if resolved and resolved not in seen:
            seen.add(resolved)
            out.append((resolved, prop_name))
    return out


def page_sync_deprecation_messages(
    page: Dict[str, Any],
    config_map: Dict[str, Any],
    *,
    title_property: str,
    text_resolver_property: str,
    auto_audio_primary_property: str,
    auto_audio_secondary_property: str,
    legacy_config_property: str,
    legacy_resolver_property: str,
    auto_text_enabled: bool,
    auto_audio_enabled: bool,
) -> List[str]:
    title = shared.page_title(page, title_property).strip() or str(page.get("id", "")).strip() or "page"
    messages: List[str] = []
    if auto_text_enabled:
        _, source_property = resolved_config_key_with_source(
            config_map,
            [
                (text_resolver_property, page_property_text(page, text_resolver_property).strip()),
                (legacy_config_property, page_property_text(page, legacy_config_property).strip()),
                (legacy_resolver_property, page_property_text(page, legacy_resolver_property).strip()),
            ],
        )
        if source_property == legacy_config_property:
            messages.append(
                f'row="{title}" uses deprecated property "{legacy_config_property}" for text sync; move that key to "{text_resolver_property}"'
            )
        elif source_property == legacy_resolver_property:
            messages.append(
                f'row="{title}" uses deprecated property "{legacy_resolver_property}" for text sync; move that key to "{text_resolver_property}"'
            )
    if auto_audio_enabled:
        audio_sources = resolved_audio_config_keys_with_sources(
            page,
            config_map,
            primary_property=auto_audio_primary_property,
            secondary_property=auto_audio_secondary_property,
            legacy_config_property=legacy_config_property,
            legacy_resolver_property=legacy_resolver_property,
        )
        if any(source_property == legacy_config_property for _, source_property in audio_sources):
            messages.append(
                f'row="{title}" uses deprecated property "{legacy_config_property}" for audio sync; move those keys to "{auto_audio_primary_property}" and "{auto_audio_secondary_property}"'
            )
        if any(source_property == legacy_resolver_property for _, source_property in audio_sources):
            messages.append(
                f'row="{title}" uses deprecated property "{legacy_resolver_property}" for audio sync; move those keys to "{auto_audio_primary_property}" and "{auto_audio_secondary_property}"'
            )
    return messages


def audio_output_deprecation_messages(
    page: Dict[str, Any],
    *,
    output_key: str,
    output_mode: str,
    fragment_sequence: Sequence[str],
    source_config_key: str,
) -> List[str]:
    title = shared.page_title(page, AUDIO_OUTPUT_TITLE_PROPERTY).strip() or output_key
    messages: List[str] = []
    if normalize_flag_value(output_mode) == AUDIO_OUTPUT_MODE_CONFIG:
        messages.append(
            f'output="{output_key}" title="{title}" uses deprecated Output Mode "{output_mode}"; replace it with a top-level wrapper fragment and "Fragment Key"'
        )
    if str(source_config_key or "").strip():
        messages.append(
            f'output="{output_key}" title="{title}" uses deprecated output-level "Config Key"; move "{source_config_key}" into a fragment row of type "{FRAGMENT_TYPE_CONFIG}"'
        )
    for token in fragment_sequence:
        value = str(token or "").strip()
        if value.upper() == SPECIAL_MONTHLY_INTENTION.upper():
            messages.append(
                f'output="{output_key}" title="{title}" uses deprecated sequence token "{value}"; replace it with a fragment row of type "{FRAGMENT_TYPE_MONTHLY_INTENTION}"'
            )
        elif value.upper() == SPECIAL_DAILY_NOVENA_AUDIO.upper():
            messages.append(
                f'output="{output_key}" title="{title}" uses deprecated sequence token "{value}"; replace it with a fragment row of type "{FRAGMENT_TYPE_DAILY_NOVENA_AUDIO}"'
            )
    return messages


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
        text_key, _ = resolved_config_key_with_source(
            config_map,
            [
                (text_resolver_property, page_text_config_key_from_page(page, text_resolver_property, legacy_config_property)),
                (legacy_resolver_property, page_property_text(page, legacy_resolver_property).strip()),
            ],
        )

    audio_keys: List[str] = []
    if auto_audio_enabled:
        for resolved, _ in resolved_audio_config_keys_with_sources(
            page,
            config_map,
            primary_property=auto_audio_primary_property,
            secondary_property=auto_audio_secondary_property,
            legacy_config_property=legacy_config_property,
            legacy_resolver_property=legacy_resolver_property,
        ):
            if resolved and resolved not in audio_keys:
                audio_keys.append(resolved)
    return text_key, audio_keys


def emit_page_sync_deprecation_warnings(
    page: Dict[str, Any],
    config_map: Dict[str, Any],
    *,
    title_property: str,
    text_resolver_property: str,
    auto_audio_primary_property: str,
    auto_audio_secondary_property: str,
    legacy_config_property: str,
    legacy_resolver_property: str,
    auto_text_enabled: bool,
    auto_audio_enabled: bool,
) -> None:
    for message in page_sync_deprecation_messages(
        page,
        config_map,
        title_property=title_property,
        text_resolver_property=text_resolver_property,
        auto_audio_primary_property=auto_audio_primary_property,
        auto_audio_secondary_property=auto_audio_secondary_property,
        legacy_config_property=legacy_config_property,
        legacy_resolver_property=legacy_resolver_property,
        auto_text_enabled=auto_text_enabled,
        auto_audio_enabled=auto_audio_enabled,
    ):
        emit_page_audio_deprecation_warning(message)


def validate_unique_page_audio_export_targets(entries: Sequence[tuple[str, PageAudioExportMetadata]]) -> None:
    seen: Dict[tuple[str, str], str] = {}
    for title, metadata in entries:
        key = (metadata.folder_name.lower(), metadata.file_stem.lower())
        prior = seen.get(key)
        if prior:
            raise RuntimeError(
                f'Ordered Playlist Audio export collision: "{prior}" and "{title}" both resolve to '
                f'"{metadata.folder_name}/{metadata.file_stem}.{metadata.audio_extension}".'
            )
        seen[key] = title


def truncate_managed_page_audio_outputs(entries: Sequence[tuple[str, PageAudioExportMetadata]]) -> int:
    directory_extensions: Dict[Path, Set[str]] = {}
    for _title, metadata in entries:
        directory = page_audio_library_dir() / metadata.folder_name
        ext_set = directory_extensions.setdefault(directory, set())
        ext_set.add(metadata.audio_extension.lower())
        ext_set.add("json")
    removed = 0
    for directory, extensions in directory_extensions.items():
        if not directory.exists():
            continue
        for child in directory.iterdir():
            if not child.is_file():
                continue
            ext = child.suffix.lower().lstrip(".")
            if ext not in extensions:
                continue
            child.unlink()
            removed += 1
    return removed


def main() -> int:
    try:
        _PAGE_AUDIO_DEPRECATION_WARNINGS.clear()
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
            print(f"page_audio_deprecations={len(_PAGE_AUDIO_DEPRECATION_WARNINGS)}")
            return 0

        detailed_fragments_payload = load_detailed_fragments_from_notion(notion_token)
        detailed_fragments_by_page_id: Dict[str, List[Dict[str, Any]]] = detailed_fragments_payload.get("fragments_by_page_id") or {}

        attached = 0
        cached = 0
        failed = 0
        processed = 0
        two_list_rows = 0
        row_jobs: List[Dict[str, Any]] = []
        managed_exports: List[tuple[str, PageAudioExportMetadata]] = []

        for page in candidates:
            title = shared.page_title(page, title_property).strip() or str(page.get("id", "")).strip()
            auto_text_enabled = page_has_platform_value(page, platform_property, "auto-text")
            auto_audio_enabled = page_has_platform_value(page, platform_property, "auto-audio")
            row_settings = opus_dei_two_list_settings(
                page,
                title_property=title_property,
                fragments_by_page_id=detailed_fragments_by_page_id,
            )
            if not row_settings:
                raise RuntimeError(
                    f"No two-list page-audio configuration found for '{title}'. Expected '{OPUS_DEI_ASSEMBLY_MODE_PROPERTY}' and related '{OPUS_DEI_DETAILED_FRAGMENTS_PROPERTY}' rows."
                )
            if config_key_filter and not opus_dei_row_matches_filter(
                page,
                config_key_filter,
                title_property=title_property,
            ):
                continue
            row_config = deepcopy(row_settings.get("audio_config") or {})
            row_config["builder"] = f"opus_dei_{row_settings.get('assembly_mode', OPUS_DEI_ASSEMBLY_MODE_FRAGMENTS)}_v1"
            row_config_key = opus_dei_row_config_key(page, title_property=title_property)
            if auto_audio_enabled:
                managed_exports.append(
                    (
                        title,
                        page_audio_export_metadata(
                            page,
                            title_property=title_property,
                            audio_format=str(tts_settings_from_config(row_config)["format"]),
                            config=row_config,
                        ),
                    )
                )
            row_jobs.append(
                {
                    "page": page,
                    "title": title,
                    "auto_text_enabled": auto_text_enabled,
                    "auto_audio_enabled": auto_audio_enabled,
                    "row_settings": row_settings,
                    "row_config": row_config,
                    "row_config_key": row_config_key,
                }
            )

        if not row_jobs:
            print("page_audio_rows=0")
            print(f"page_audio_deprecations={len(_PAGE_AUDIO_DEPRECATION_WARNINGS)}")
            return 0

        validate_unique_page_audio_export_targets(managed_exports)
        if shared.bool_env(PAGE_AUDIO_TRUNCATE_MANAGED_OUTPUTS, default=False):
            removed_outputs = truncate_managed_page_audio_outputs(managed_exports)
            print(f"page_audio_truncated_outputs={removed_outputs}")

        for job in row_jobs:
            page = job["page"]
            title = job["title"]
            page_started = time.perf_counter()
            processed += 1
            two_list_rows += 1
            try:
                text_mode = ""
                row_plan = build_opus_dei_two_list_plan(
                    page=page,
                    pages=pages,
                    title_property=title_property,
                    row_settings=job["row_settings"],
                    token=notion_token,
                    base_url=base_url,
                )
                row_config = deepcopy(job["row_config"])
                row_config_key = str(job["row_config_key"])
                should_apply_text = bool(row_plan.text_target or row_plan.text_property)
                if job["auto_text_enabled"] and should_apply_text:
                    text_mode = apply_page_text_plan(page, row_plan, notion_token)

                audio_mode = ""
                if job["auto_audio_enabled"]:
                    audio_mode = render_page_audio_for_config(
                        page=page,
                        config_key=row_config_key,
                        config=row_config,
                        plan=row_plan,
                        title_property=title_property,
                        notion_token=notion_token,
                        openai_key=openai_key,
                        base_url=base_url,
                        apply_text=should_apply_text and not bool(text_mode),
                    )
                config_summary = row_config_key

                mode_parts = [part for part in [text_mode, audio_mode] if part]
                mode = " | ".join(mode_parts) if mode_parts else "noop"
                if audio_mode.startswith("attached:"):
                    attached += 1
                if audio_mode.startswith("cached:"):
                    cached += 1
                elapsed = time.perf_counter() - page_started
                print(f"page_audio title={title} {config_summary} mode={mode} duration_s={elapsed:.1f}".strip())
            except Exception as exc:
                failed += 1
                print(f"page_audio_error title={title} error={exc}", file=sys.stderr)
                if not fail_open:
                    raise
        print(
            f"page_audio_rows={processed} two_list_rows={two_list_rows} legacy_rows=0 attached={attached} cached={cached} failed={failed}"
        )
        print(f"page_audio_deprecations={len(_PAGE_AUDIO_DEPRECATION_WARNINGS)}")
        return 0 if failed == 0 or fail_open else 1
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
