import datetime
import hashlib
import html
import json
import mimetypes
import os
import shutil
import re
import sys
import time
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence
from urllib.parse import unquote, urlparse

import requests
from openai import OpenAI
from romcal import Romcal, get_bundled_calendar_definitions, get_bundled_resources
from romcal.types import CalendarDefinition, DayDefinition, Precedence

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from jobs.novena.liturgical_model import devotional_output_is_eligible

NOTION_VERSION = "2022-06-28"
NOTION_FILE_UPLOAD_VERSION = "2025-09-03"
NOTION_REQUEST_TIMEOUT_SECONDS = 30
NOTION_MAX_ATTEMPTS = 5
NOTION_RETRYABLE_STATUSES = {408, 409, 429, 500, 502, 503, 504}
NOTION_FILE_UPLOAD_SINGLE_PART_MAX_BYTES = 20 * 1024 * 1024
NOTION_FILE_UPLOAD_PART_SIZE_BYTES = 10 * 1024 * 1024
DEFAULT_UTC_OFFSET = "-06:00"
DEFAULT_NOVENA_ROW_TITLES = (
    "Daily Novenas from Liturgical Calendar",
    "Daily Novena Prayer",
)

ROMCAL_CALENDAR = "ROMCAL_CALENDAR"  # default general_roman
ROMCAL_LOCALE = "ROMCAL_LOCALE"  # default en
ROMCAL_WINDOW_DAYS = "ROMCAL_WINDOW_DAYS"  # default 9
JOB_UTC_OFFSET = "JOB_UTC_OFFSET"  # optional override like -06:00

OPENAI_API_KEY = "OPENAI_API_KEY"
OAI_API_BASE_URL = "OAI_API_BASE_URL"  # default https://api.openai.com/v1
OAI_MODEL = "OAI_MODEL"  # default gpt-4.1-mini

NOTION_TOKEN = "NOTION_TOKEN"
NOTION_DATABASE_ID = "NOTION_DATABASE_ID"
NOTION_DATABASE_NAME = "NOTION_DATABASE_NAME"  # fallback, default Opus Dei
NOTION_TITLE_PROPERTY = "NOTION_TITLE_PROPERTY"  # default Name
NOTION_NOVENA_ROW_TITLE = "NOTION_NOVENA_ROW_TITLE"  # default Daily Novenas from Liturgical Calendar
NOTION_NOVENA_PROPERTY = "NOTION_NOVENA_PROPERTY"  # optional rich_text property for prayer text
NOTION_WRITE_DAILY_NOVENA_PAGE = "NOTION_WRITE_DAILY_NOVENA_PAGE"  # default true
NOTION_SAINT_RADAR_ENABLED = "NOTION_SAINT_RADAR_ENABLED"  # default false
NOTION_SAINT_DATABASE_ID = "NOTION_SAINT_DATABASE_ID"  # optional explicit saint radar database id
NOTION_SAINT_DATABASE_NAME = "NOTION_SAINT_DATABASE_NAME"  # default Saint Radar
NOTION_SAINT_PARENT_PAGE_ID = "NOTION_SAINT_PARENT_PAGE_ID"  # optional explicit parent page id for database creation
NOTION_SAINT_TITLE_PROPERTY = "NOTION_SAINT_TITLE_PROPERTY"  # default Name
NOTION_SAINT_FEAST_DAY_PROPERTY = "NOTION_SAINT_FEAST_DAY_PROPERTY"  # default Feast Day
NOTION_SAINT_CELEBRATION_PROPERTY = "NOTION_SAINT_CELEBRATION_PROPERTY"  # default Celebration Rank
NOTION_SAINT_PRECEDENCE_PROPERTY = "NOTION_SAINT_PRECEDENCE_PROPERTY"  # default Precedence
NOTION_SAINT_BACKGROUND_PROPERTY = "NOTION_SAINT_BACKGROUND_PROPERTY"  # default Background
NOTION_SAINT_REFRESH_ALL = "NOTION_SAINT_REFRESH_ALL"  # default false; true regenerates all saint content each run
NOTION_SAINT_INCLUDE_CALENDAR_DAYS = "NOTION_SAINT_INCLUDE_CALENDAR_DAYS"  # default false
NOTION_AUDIO_RENDER_HASH_PROPERTY = "NOTION_AUDIO_RENDER_HASH_PROPERTY"  # optional, default Render Hash
NOTION_AUDIO_SAVED_PROPERTY = "NOTION_AUDIO_SAVED_PROPERTY"  # optional, default Audio Saved

NOVENA_AUDIO_ENABLED = "NOVENA_AUDIO_ENABLED"  # default false
NOVENA_AUDIO_LIBRARY_DIR = "NOVENA_AUDIO_LIBRARY_DIR"
NOVENA_AUDIO_MODEL = "NOVENA_AUDIO_MODEL"  # default gpt-4o-mini-tts
NOVENA_AUDIO_VOICE = "NOVENA_AUDIO_VOICE"  # default alloy
NOVENA_AUDIO_FORMAT = "NOVENA_AUDIO_FORMAT"  # default mp3
NOVENA_AUDIO_SPEED = "NOVENA_AUDIO_SPEED"  # default 1.0
NOVENA_AUDIO_CAPTION = "NOVENA_AUDIO_CAPTION"  # default Daily Novena Prayer (Audio)
NOVENA_AUDIO_FAIL_OPEN = "NOVENA_AUDIO_FAIL_OPEN"  # default true
NOVENA_AUDIO_MARKER = "[AUTOGEN_NOVENA_AUDIO]"
NOVENA_AUDIO_HASH_MARKER_PREFIX = "[AUTOGEN_NOVENA_AUDIO_HASH:"
DAILY_NOVENA_AUDIO_RENDER_VERSION = "daily_novena_audio_v1"
SAINT_NOVENA_AUDIO_RENDER_VERSION = "saint_novena_audio_v2"
SAINT_NOVENA_PAYLOAD_RENDER_VERSION = "saint_novena_payload_v2"
NOVENA_SECTION_MARKER = "[AUTOGEN_DAILY_ROLLING_NOVENA]"
NOVENA_DAY_MODE = "NOVENA_DAY_MODE"  # default true when writing into calendar rows
NOVENA_TEST_SAINT_NAME = "NOVENA_TEST_SAINT_NAME"  # optional saint name for day-by-day backfill test
NOVENA_TEST_POPULATE_ALL_DAYS = "NOVENA_TEST_POPULATE_ALL_DAYS"  # default false
NOVENA_DAY_SECTION_MARKER = "AUTOGEN_NOVENA_DAY"
USCCB_SECTION_MARKER = "[AUTOGEN_USCCB_READINGS]"
NOTION_MAX_BLOCK_CHILDREN = 100
DEFAULT_NOVENA_AUDIO_LIBRARY_RELATIVE = r"OneDrive\Praylist Audio\Novena Audio Library"
DEFAULT_NOVENA_AUDIO_LIBRARY_FALLBACK = ".cache/novena_audio_library"
ROOT = Path(__file__).resolve().parents[2]

ROMCAL_OVERLAY_SUFFIX = "__enhancement_003"
EASTER_OCTAVE_PSEUDO_RANK = "solemnity-easter octave"
SPECIAL_SUNDAY_SOLEMNITY_IDS = (
    "second_sunday_after_christmas",
    "sunday_of_the_word_of_god",
    "divine_mercy_sunday",
    "palm_sunday_of_the_passion_of_the_lord",
    "easter_sunday",
)

USCCB_READINGS_ENABLED = "USCCB_READINGS_ENABLED"  # default true
USCCB_READINGS_FAIL_OPEN = "USCCB_READINGS_FAIL_OPEN"  # default true
USCCB_READINGS_BASE_URL = "USCCB_READINGS_BASE_URL"  # default https://bible.usccb.org/bible/readings
USCCB_READINGS_EXTRA_PAGE_IDS = "USCCB_READINGS_EXTRA_PAGE_IDS"  # optional comma/newline-separated page ids


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def int_env(name: str, default: int, min_value: int, max_value: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except Exception:
        return default
    return max(min_value, min(max_value, value))


def bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    if raw in {"1", "true", "yes", "y", "on"}:
        return True
    if raw in {"0", "false", "no", "n", "off"}:
        return False
    return default


def split_env_list(name: str) -> List[str]:
    raw = os.getenv(name, "")
    if not raw:
        return []
    parts = re.split(r"[\s,;]+", raw.strip())
    return [part.strip() for part in parts if part.strip()]


def float_env(name: str, default: float, min_value: float, max_value: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except Exception:
        return default
    return max(min_value, min(max_value, value))


def slugify_kebab(text: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", str(text or "").strip().lower()).strip("-")
    return value or "item"


def default_novena_audio_library_dir() -> Path:
    user_profile = os.getenv("USERPROFILE", "").strip()
    if user_profile:
        return Path(user_profile) / Path(DEFAULT_NOVENA_AUDIO_LIBRARY_RELATIVE)
    return ROOT / DEFAULT_NOVENA_AUDIO_LIBRARY_FALLBACK


def novena_audio_library_dir() -> Path:
    raw = os.getenv(NOVENA_AUDIO_LIBRARY_DIR, "").strip()
    root = Path(raw) if raw else default_novena_audio_library_dir()
    root.mkdir(parents=True, exist_ok=True)
    return root


def parse_utc_offset(offset_text: str) -> datetime.timezone:
    text = (offset_text or "").strip()
    match = re.fullmatch(r"([+-])(\d{1,2})(?::?(\d{2}))?", text)
    if not match:
        raise RuntimeError(f"Invalid utc offset '{offset_text}'. Use format like -06:00 or +05:30.")
    sign = -1 if match.group(1) == "-" else 1
    hours = int(match.group(2))
    minutes = int(match.group(3) or "0")
    if hours > 14 or minutes > 59:
        raise RuntimeError(f"Invalid utc offset '{offset_text}'.")
    delta = datetime.timedelta(hours=hours, minutes=minutes) * sign
    return datetime.timezone(delta)


def local_today() -> datetime.date:
    raw_offset = os.getenv(JOB_UTC_OFFSET, "").strip() or DEFAULT_UTC_OFFSET
    now_local = datetime.datetime.now(parse_utc_offset(raw_offset))
    return now_local.date()


def notion_headers(token: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
    }


def notion_file_upload_headers(token: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_FILE_UPLOAD_VERSION,
    }


def notion_file_upload_raise_for_status(response: requests.Response, context: str) -> None:
    try:
        response.raise_for_status()
    except requests.exceptions.HTTPError as exc:
        detail = ""
        try:
            body = str(response.text or "").strip()
        except Exception:
            body = ""
        if body:
            detail = f" response={body[:500]}"
        raise requests.exceptions.HTTPError(f"{context} failed: {exc}{detail}", response=response) from exc


def notion_file_upload_post(
    url: str,
    token: str,
    *,
    json_payload: Optional[Dict[str, Any]] = None,
    data_payload: Optional[Dict[str, Any]] = None,
    files: Optional[Dict[str, Any]] = None,
    timeout: int = 30,
) -> requests.Response:
    headers = notion_file_upload_headers(token)
    if json_payload is not None:
        headers = {**headers, "Content-Type": "application/json"}
    for attempt in range(1, NOTION_MAX_ATTEMPTS + 1):
        try:
            response = requests.post(
                url,
                headers=headers,
                json=json_payload,
                data=data_payload,
                files=files,
                timeout=timeout,
            )
            notion_file_upload_raise_for_status(response, f"Notion file upload POST {url}")
            return response
        except requests.exceptions.RequestException as exc:
            if attempt >= NOTION_MAX_ATTEMPTS or not notion_should_retry(exc):
                raise
            delay = notion_retry_delay_seconds(exc, attempt)
            print(
                f"WARN notion_file_upload_retry attempt={attempt} delay={delay:.1f}s url={url}",
                file=sys.stderr,
            )
            time.sleep(delay)
    raise RuntimeError("Notion file upload retry loop exited unexpectedly.")


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


def notion_find_database_id(token: str) -> str:
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
        title_parts = item.get("title") or []
        title = ""
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
        for result in data.get("results") or []:
            if isinstance(result, dict):
                pages.append(result)
        if not data.get("has_more"):
            break
        next_cursor = str(data.get("next_cursor", "")).strip() or None
    return pages


def notion_get_database(database_id: str, token: str) -> Dict[str, Any]:
    return notion_call("GET", f"https://api.notion.com/v1/databases/{database_id}", token)


def notion_find_database_id_by_name(token: str, db_name: str) -> Optional[str]:
    body = {"query": db_name, "filter": {"value": "database", "property": "object"}}
    data = notion_call("POST", "https://api.notion.com/v1/search", token, body)
    results = data.get("results") or []
    for item in results:
        if not isinstance(item, dict):
            continue
        title_parts = item.get("title") or []
        title = ""
        if isinstance(title_parts, list) and title_parts:
            title = str((title_parts[0] or {}).get("plain_text", "")).strip()
        if title.lower() == db_name.lower():
            found = str(item.get("id", "")).strip()
            if found:
                return found
    return None


def notion_create_saint_radar_database(parent: Dict[str, Any], token: str, db_name: str) -> str:
    body = {
        "parent": parent,
        "title": [{"type": "text", "text": {"content": db_name}}],
        "properties": {
            "Name": {"title": {}},
            "Feast Day": {"date": {}},
            "Celebration Rank": {"select": {"options": []}},
            "Precedence": {"rich_text": {}},
            "Background": {"rich_text": {}},
        },
    }
    data = notion_call("POST", "https://api.notion.com/v1/databases", token, body)
    db_id = str(data.get("id", "")).strip()
    if not db_id:
        raise RuntimeError("Failed to create Saint Radar database.")
    return db_id


def page_title(page: Dict[str, Any], title_property: str) -> str:
    props = page.get("properties") or {}
    prop = props.get(title_property) or {}
    vals = prop.get("title") or []
    if not isinstance(vals, list):
        return ""
    parts = [str(v.get("plain_text", "")).strip() for v in vals if isinstance(v, dict)]
    return " ".join(p for p in parts if p).strip()


def page_date(page: Dict[str, Any], date_property: str) -> str:
    props = page.get("properties") or {}
    prop = props.get(date_property) or {}
    date_obj = prop.get("date") or {}
    if not isinstance(date_obj, dict):
        return ""
    return str(date_obj.get("start", "")).strip()


def split_text_chunks(text: str, max_len: int = 1800) -> List[str]:
    cleaned = str(text or "").strip()
    if not cleaned:
        return []
    out: List[str] = []
    remaining = cleaned
    while remaining:
        if len(remaining) <= max_len:
            out.append(remaining)
            break
        cut = remaining.rfind("\n", 0, max_len + 1)
        if cut < max_len // 2:
            cut = remaining.rfind(" ", 0, max_len + 1)
        if cut < max_len // 2:
            cut = max_len
        out.append(remaining[:cut].strip())
        remaining = remaining[cut:].strip()
    return [c for c in out if c]


def notion_update_rich_text_property(page_id: str, property_name: str, text: str, token: str) -> None:
    chunks = split_text_chunks(text, 1900)
    rich_text = [{"type": "text", "text": {"content": chunk}} for chunk in chunks] if chunks else []
    body = {"properties": {property_name: {"rich_text": rich_text}}}
    notion_call("PATCH", f"https://api.notion.com/v1/pages/{page_id}", token, body)


def notion_list_block_children(block_id: str, token: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    next_cursor: Optional[str] = None
    while True:
        params = "page_size=100"
        if next_cursor:
            params += f"&start_cursor={next_cursor}"
        url = f"https://api.notion.com/v1/blocks/{block_id}/children?{params}"
        data = notion_call("GET", url, token)
        for row in data.get("results") or []:
            if isinstance(row, dict):
                out.append(row)
        if not data.get("has_more"):
            break
        next_cursor = str(data.get("next_cursor", "")).strip() or None
    return out


def notion_archive_block(block_id: str, token: str) -> None:
    try:
        notion_call("PATCH", f"https://api.notion.com/v1/blocks/{block_id}", token, {"archived": True})
    except requests.HTTPError as exc:
        response = exc.response
        if response is not None and response.status_code == 400:
            try:
                payload = response.json()
            except Exception:
                payload = {}
            message = str((payload or {}).get("message", "")).strip().lower()
            if "block that is archived" in message:
                return
        raise


def notion_append_children(
    parent_id: str,
    children: Sequence[Dict[str, Any]],
    token: str,
    position: str = "end",
    after: str = "",
) -> None:
    if not children:
        return
    insert_after = str(after or "").strip()
    insert_position = str(position or "end").strip().lower() or "end"
    if insert_after and len(children) > 100:
        raise RuntimeError("notion_append_children with 'after' supports at most 100 children per call.")
    for idx in range(0, len(children), 100):
        batch = list(children[idx : idx + 100])
        payload: Dict[str, Any] = {"children": batch}
        if insert_after and idx == 0:
            payload["after"] = insert_after
        elif insert_position == "start" and idx == 0:
            payload["position"] = {"type": "start"}
        notion_call("PATCH", f"https://api.notion.com/v1/blocks/{parent_id}/children", token, payload)


def block_rich_text_plain(block: Dict[str, Any]) -> str:
    block_type = str(block.get("type", "")).strip()
    payload = block.get(block_type) or {}
    rich = payload.get("rich_text") or []
    if not isinstance(rich, list):
        return ""
    parts: List[str] = []
    for item in rich:
        if not isinstance(item, dict):
            continue
        plain = str(item.get("plain_text", "")).strip()
        if plain:
            parts.append(plain)
    return " ".join(parts).strip()


def notion_remove_old_autogen_sections(page_id: str, token: str) -> int:
    return notion_remove_old_autogen_sections_by_markers(
        page_id,
        token,
        markers=[NOVENA_SECTION_MARKER, USCCB_SECTION_MARKER],
    )


def notion_remove_old_autogen_sections_by_markers(page_id: str, token: str, markers: Sequence[str]) -> int:
    removed = 0
    marker_set = [m for m in markers if str(m or "").strip()]
    if not marker_set:
        return 0
    for block in notion_list_block_children(page_id, token):
        block_id = str(block.get("id", "")).strip()
        if not block_id:
            continue
        title = block_rich_text_plain(block)
        if any(marker in title for marker in marker_set):
            notion_archive_block(block_id, token)
            removed += 1
    return removed


def notion_has_autogen_section_marker(page_id: str, token: str, marker: str) -> bool:
    needle = str(marker or "").strip()
    if not needle:
        return False
    for block in notion_list_block_children(page_id, token):
        title = block_rich_text_plain(block)
        if needle in title:
            return True
    return False


def notion_replace_page_blocks(page_id: str, children: Sequence[Dict[str, Any]], token: str) -> None:
    existing = notion_list_block_children(page_id, token)
    for block in existing:
        block_type = str(block.get("type", "")).strip()
        if block_type in {"child_page", "child_database"}:
            continue
        block_id = str(block.get("id", "")).strip()
        if block_id:
            notion_archive_block(block_id, token)
    notion_append_children(page_id, children, token)


def prayer_to_paragraph_blocks(text: str) -> List[Dict[str, Any]]:
    stanzas = [s.strip() for s in re.split(r"\n\s*\n", str(text or "").strip()) if s.strip()]
    blocks: List[Dict[str, Any]] = []
    for stanza in stanzas:
        for chunk in split_text_chunks(stanza, 1800):
            blocks.append(
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {"rich_text": [{"type": "text", "text": {"content": chunk}}]},
                }
            )
    if not blocks:
        blocks.append(
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {"rich_text": [{"type": "text", "text": {"content": "No prayer content generated."}}]},
            }
        )
    return blocks


def _strip_html_tags(text: str) -> str:
    return re.sub(r"(?is)<[^>]+>", "", text or "")


def _clean_html_fragment(text: str) -> str:
    cleaned = str(text or "")
    cleaned = re.sub(r"(?is)<br\s*/?>", "\n", cleaned)
    cleaned = re.sub(r"(?is)</p\s*>", "\n\n", cleaned)
    cleaned = re.sub(r"(?is)<p[^>]*>", "", cleaned)
    cleaned = _strip_html_tags(cleaned)
    cleaned = html.unescape(cleaned).replace("\xa0", " ")
    cleaned = re.sub(r"\r\n?", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    lines = [line.rstrip() for line in cleaned.split("\n")]
    return "\n".join(lines).strip()


def usccb_daily_readings_url(day: datetime.date) -> str:
    slug = day.strftime("%m%d%y")
    base_url = os.getenv(USCCB_READINGS_BASE_URL, "https://bible.usccb.org/bible/readings").strip()
    base_url = (base_url or "https://bible.usccb.org/bible/readings").rstrip("/")
    return f"{base_url}/{slug}.cfm"


def fetch_usccb_daily_readings(day: datetime.date) -> Dict[str, Any]:
    url = usccb_daily_readings_url(day)
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    html_text = response.text

    liturgical_day = ""
    lectionary = ""
    header_match = re.search(
        r"(?is)<div[^>]*class=\"innerblock\"[^>]*>.*?<h2[^>]*>\s*(.*?)\s*</h2>.*?"
        r"<p>\s*Lectionary:\s*(.*?)\s*</p>.*?</div>",
        html_text,
    )
    if header_match:
        liturgical_day = _clean_html_fragment(header_match.group(1))
        lectionary = _clean_html_fragment(header_match.group(2))

    sections: List[Dict[str, str]] = []
    pattern = re.compile(
        r'(?is)<div[^>]*class="content-header"[^>]*>.*?<h3[^>]*class="name"[^>]*>\s*(.*?)\s*</h3>.*?'
        r'<div[^>]*class="address"[^>]*>\s*(.*?)\s*</div>.*?</div>\s*'
        r'<div[^>]*class="content-body"[^>]*>\s*(.*?)\s*</div>'
    )
    for match in pattern.finditer(html_text):
        title = _clean_html_fragment(match.group(1))
        reference = _clean_html_fragment(match.group(2))
        body = _clean_html_fragment(match.group(3))
        if title and body:
            sections.append({"title": title, "reference": reference, "text": body})

    if not sections:
        raise RuntimeError("Could not parse USCCB readings sections from page.")

    return {"url": url, "liturgical_day": liturgical_day, "lectionary": lectionary, "sections": sections}


def usccb_readings_blocks(readings: Dict[str, Any]) -> List[Dict[str, Any]]:
    liturgical_day = str(readings.get("liturgical_day", "")).strip()
    lectionary = str(readings.get("lectionary", "")).strip()
    url = str(readings.get("url", "")).strip()
    sections = readings.get("sections") or []

    intro_children: List[Dict[str, Any]] = []
    if liturgical_day:
        intro_children.append(paragraph_block(f"Liturgical Day: {liturgical_day}"))
    if lectionary:
        intro_children.append(paragraph_block(f"Lectionary: {lectionary}"))
    if url:
        intro_children.append(paragraph_block(f"Source: {url}"))
    blocks: List[Dict[str, Any]] = [toggle_block(f"USCCB Daily Mass Readings {USCCB_SECTION_MARKER}", intro_children)]

    for section in sections:
        if not isinstance(section, dict):
            continue
        title = str(section.get("title", "")).strip() or "Reading"
        reference = str(section.get("reference", "")).strip()
        body_text = str(section.get("text", "")).strip()
        section_children: List[Dict[str, Any]] = []
        if reference:
            section_children.append(paragraph_block(reference))
        for paragraph in [p.strip() for p in re.split(r"\n\s*\n", body_text) if p.strip()]:
            for chunk in split_text_chunks(paragraph, 1800):
                section_children.append(paragraph_block(chunk))
        if section_children:
            blocks.append(toggle_block(title, section_children))
    return blocks


def notion_replace_page_content(page_id: str, text: str, token: str, extra_blocks: Optional[Sequence[Dict[str, Any]]] = None) -> None:
    blocks = prayer_to_paragraph_blocks(text)
    if extra_blocks:
        blocks.extend(list(extra_blocks))
    notion_replace_page_blocks(page_id, blocks, token)


def rolling_novena_blocks(prayer_text: str) -> List[Dict[str, Any]]:
    children: List[Dict[str, Any]] = []
    stanzas = [s.strip() for s in re.split(r"\n\s*\n", str(prayer_text or "").strip()) if s.strip()]
    for stanza in stanzas:
        for chunk in split_text_chunks(stanza, 1800):
            children.append(paragraph_block(chunk))
    if not children:
        children = [paragraph_block("No prayer content generated.")]
    return [toggle_block(f"Daily Rolling Novena {NOVENA_SECTION_MARKER}", children)]


def saint_day_marker(saint_name: str, target_day: datetime.date) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", normalize_name_for_match(saint_name)).strip("-")
    return f"[{NOVENA_DAY_SECTION_MARKER}:{slug}:{target_day.isoformat()}]"


def date_from_iso(text: str) -> datetime.date:
    return datetime.date.fromisoformat(str(text or "").strip())


def saint_novena_day_blocks(
    saint_name: str,
    feast_day: str,
    target_day: datetime.date,
    day_num: int,
    devotional_payload: Dict[str, Any],
) -> List[Dict[str, Any]]:
    marker = saint_day_marker(saint_name, target_day)
    feast_date = date_from_iso(feast_day)
    prep_start = feast_date - datetime.timedelta(days=9)
    feast_overview = str(devotional_payload.get("feast_overview", "")).strip()
    opening = str(devotional_payload.get("opening_prayer", "")).strip()
    closing = str(devotional_payload.get("closing_prayer", "")).strip()
    daily = devotional_payload.get("daily_prayers") or []
    by_day: Dict[int, Dict[str, Any]] = {}
    if isinstance(daily, list):
        for row in daily:
            if isinstance(row, dict):
                try:
                    dn = int(row.get("day", 0))
                except Exception:
                    dn = 0
                if 1 <= dn <= 9:
                    by_day[dn] = row
    row = by_day.get(day_num, {})
    theme = str(row.get("theme", "")).strip() or f"Day {day_num} theme"
    intercession = str(row.get("intercession", "")).strip() or "Intercede for us."
    daily_prayer = str(row.get("daily_prayer", "")).strip() or "Daily novena prayer."

    placement_children: List[Dict[str, Any]] = [
        paragraph_block(f"Saint: {saint_name}"),
        paragraph_block(f"Feast Day: {feast_day}"),
        paragraph_block(
            "Why this feast day: liturgical calendar placement and significance for this saint."
        ),
    ]
    for chunk in split_text_chunks(feast_overview or f"{saint_name} is commemorated on {feast_day}.", 1800):
        placement_children.append(paragraph_block(chunk))

    life_children: List[Dict[str, Any]] = [
        paragraph_block(f"Novena Day: {day_num} of 9 ({target_day.strftime('%b %d')})"),
        paragraph_block(f"Novena Window: {prep_start.isoformat()} to {(feast_date - datetime.timedelta(days=1)).isoformat()}"),
    ]
    life_sections = devotional_payload.get("life_sections") or []
    if isinstance(life_sections, list) and life_sections:
        for section in life_sections:
            if not isinstance(section, dict):
                continue
            heading = str(section.get("heading", "")).strip() or "Life Section"
            content = str(section.get("content", "")).strip() or f"Life details for {saint_name}."
            life_children.append(paragraph_block(f"{heading}:"))
            for chunk in split_text_chunks(content, 1800):
                life_children.append(paragraph_block(chunk))
    else:
        for chunk in split_text_chunks(feast_overview or f"Life details for {saint_name}.", 1800):
            life_children.append(paragraph_block(chunk))

    day_children: List[Dict[str, Any]] = [
        paragraph_block(f"Theme: {theme}"),
        paragraph_block(f"Intercession: {intercession}"),
        paragraph_block("Personal intention: [Write your intention here]"),
    ]
    for chunk in split_text_chunks(opening or "Opening prayer.", 1800):
        day_children.append(paragraph_block(chunk))
    for chunk in split_text_chunks(daily_prayer, 1800):
        day_children.append(paragraph_block(chunk))
    for chunk in split_text_chunks(closing or "Closing prayer.", 1800):
        day_children.append(paragraph_block(chunk))

    top_children = [
        toggle_block("Saint Background & Feast Placement", placement_children),
        toggle_block("Life of the Saint", life_children),
        toggle_block(f"Day {day_num} Novena Prayer", day_children),
    ]
    return [toggle_block(f"Novena - {saint_name} (Day {day_num} of 9) {marker}", top_children)]


def saint_novena_day_audio_text(day_num: int, devotional_payload: Dict[str, Any]) -> str:
    opening = str(devotional_payload.get("opening_prayer", "")).strip()
    closing = str(devotional_payload.get("closing_prayer", "")).strip()
    daily = devotional_payload.get("daily_prayers") or []
    by_day: Dict[int, Dict[str, Any]] = {}
    if isinstance(daily, list):
        for row in daily:
            if isinstance(row, dict):
                try:
                    dn = int(row.get("day", 0))
                except Exception:
                    dn = 0
                if 1 <= dn <= 9:
                    by_day[dn] = row
    row = by_day.get(day_num, {})
    theme = str(row.get("theme", "")).strip()
    intercession = str(row.get("intercession", "")).strip()
    daily_prayer = str(row.get("daily_prayer", "")).strip() or "Daily novena prayer."
    parts = [
        row["text"]
        for row in saint_novena_day_audio_fragments(
            day_num=day_num,
            opening=opening,
            closing=closing,
            theme=theme,
            intercession=intercession,
            daily_prayer=daily_prayer,
        )
        if str(row.get("text", "")).strip()
    ]
    return "\n\n".join(parts)


def saint_novena_day_audio_fragments(
    day_num: int,
    opening: str,
    closing: str,
    theme: str,
    intercession: str,
    daily_prayer: str,
) -> List[Dict[str, str]]:
    prayer_text = str(daily_prayer or "").strip() or "Daily novena prayer."
    intercession_text = str(intercession or "").strip()
    if prayer_text and intercession_text:
        first_sentence, separator, remainder = prayer_text.partition(".")
        if separator and normalize_name_for_match(first_sentence) == normalize_name_for_match(intercession_text.rstrip(".!?")):
            prayer_text = remainder.strip() or prayer_text
    fragments: List[Dict[str, str]] = [
        {"key": "day_intro", "label": "Day Intro", "text": f"Day {day_num} of the novena."},
    ]
    if theme:
        fragments.append({"key": "theme", "label": "Theme", "text": f"Theme: {theme}."})
    if intercession_text:
        fragments.append({"key": "intercession", "label": "Intercession", "text": f"Intercession: {intercession_text}."})
    if opening:
        fragments.append({"key": "opening_prayer", "label": "Opening Prayer", "text": opening})
    fragments.append({"key": "daily_prayer", "label": "Daily Prayer", "text": prayer_text})
    if closing:
        fragments.append({"key": "closing_prayer", "label": "Closing Prayer", "text": closing})
    return fragments


def saint_novena_fragments_for_day(day_num: int, devotional_payload: Dict[str, Any]) -> List[Dict[str, str]]:
    opening = str(devotional_payload.get("opening_prayer", "")).strip()
    closing = str(devotional_payload.get("closing_prayer", "")).strip()
    daily = devotional_payload.get("daily_prayers") or []
    by_day: Dict[int, Dict[str, Any]] = {}
    if isinstance(daily, list):
        for row in daily:
            if isinstance(row, dict):
                try:
                    dn = int(row.get("day", 0))
                except Exception:
                    dn = 0
                if 1 <= dn <= 9:
                    by_day[dn] = row
    row = by_day.get(day_num, {})
    return saint_novena_day_audio_fragments(
        day_num=day_num,
        opening=opening,
        closing=closing,
        theme=str(row.get("theme", "")).strip(),
        intercession=str(row.get("intercession", "")).strip(),
        daily_prayer=str(row.get("daily_prayer", "")).strip() or "Daily novena prayer.",
    )


def notion_split_file_upload_parts(file_bytes: bytes, part_size_bytes: int = NOTION_FILE_UPLOAD_PART_SIZE_BYTES) -> List[bytes]:
    if part_size_bytes <= 0:
        raise RuntimeError("Notion file upload part size must be positive.")
    if not file_bytes:
        raise RuntimeError("Notion file upload content is empty.")
    return [file_bytes[idx : idx + part_size_bytes] for idx in range(0, len(file_bytes), part_size_bytes)]


def notion_create_file_upload(
    filename: str,
    content_type: str,
    token: str,
    *,
    mode: str = "single_part",
    number_of_parts: Optional[int] = None,
) -> str:
    payload = {"filename": filename, "content_type": content_type}
    if mode == "multi_part":
        if number_of_parts is None or number_of_parts < 2:
            raise RuntimeError("Notion multi-part uploads require at least 2 parts.")
        payload["mode"] = "multi_part"
        payload["number_of_parts"] = number_of_parts
    response = notion_file_upload_post(
        "https://api.notion.com/v1/file_uploads",
        token,
        json_payload=payload,
        timeout=30,
    )
    data = response.json()
    if not isinstance(data, dict):
        raise RuntimeError("Unexpected Notion file_upload create response format.")
    upload_id = str(data.get("id", "")).strip()
    if not upload_id:
        raise RuntimeError("Notion file_upload id missing from create response.")
    return upload_id


def notion_send_file_upload(
    upload_id: str,
    filename: str,
    content_type: str,
    file_bytes: bytes,
    token: str,
    *,
    part_number: Optional[int] = None,
) -> None:
    data_payload = {"part_number": str(part_number)} if part_number is not None else None
    notion_file_upload_post(
        f"https://api.notion.com/v1/file_uploads/{upload_id}/send",
        token,
        data_payload=data_payload,
        files={"file": (filename, file_bytes, content_type)},
        timeout=120,
    )


def notion_complete_file_upload(upload_id: str, token: str) -> None:
    notion_file_upload_post(
        f"https://api.notion.com/v1/file_uploads/{upload_id}/complete",
        token,
        timeout=30,
    )


def notion_upload_file(filename: str, content_type: str, file_bytes: bytes, token: str) -> str:
    if len(file_bytes) <= NOTION_FILE_UPLOAD_SINGLE_PART_MAX_BYTES:
        upload_id = notion_create_file_upload(filename=filename, content_type=content_type, token=token)
        notion_send_file_upload(upload_id, filename, content_type, file_bytes, token)
        return upload_id

    parts = notion_split_file_upload_parts(file_bytes)
    upload_id = notion_create_file_upload(
        filename=filename,
        content_type=content_type,
        token=token,
        mode="multi_part",
        number_of_parts=len(parts),
    )
    for part_index, part_bytes in enumerate(parts, start=1):
        notion_send_file_upload(
            upload_id,
            filename,
            content_type,
            part_bytes,
            token,
            part_number=part_index,
        )
    notion_complete_file_upload(upload_id, token)
    return upload_id


def notion_download_bytes(url: str) -> tuple[bytes, str]:
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    raw = bytes(response.content)
    if not raw:
        raise RuntimeError("Notion source file download returned empty content.")
    return raw, str(response.headers.get("Content-Type", "")).strip()


def ensure_saint_devotional_payload_cache(
    *,
    library_root: Path,
    saint_name: str,
    feast_day: str,
    celebration_type: str,
    api_key: str,
    base_url: str,
    model: str,
) -> tuple[Dict[str, Any], str, Path]:
    payload_hash = compute_saint_novena_payload_render_hash(base_url, model, saint_name, feast_day, celebration_type)
    cache_path = saint_novena_payload_path(library_root, saint_name, feast_day)
    cached = json_read(cache_path)
    if cached and str(cached.get("render_hash", "")).strip() == payload_hash and isinstance(cached.get("payload"), dict):
        return dict(cached.get("payload") or {}), "cached", cache_path
    payload = call_openai_saint_devotional_content(
        api_key=api_key,
        base_url=base_url,
        model=model,
        saint_name=saint_name,
        feast_day=feast_day,
        celebration_type=celebration_type,
    )
    json_write(
        cache_path,
        {
            "render_hash": payload_hash,
            "generated_at": iso_utc_now(),
            "saint_name": saint_name,
            "feast_day": feast_day,
            "celebration_type": celebration_type,
            "model": model,
            "base_url": str(base_url or "").rstrip("/"),
            "payload": payload,
        },
    )
    return payload, "generated", cache_path


def ensure_saint_novena_audio_library(
    *,
    saint_name: str,
    feast_day: str,
    celebration_type: str,
    devotional_payload: Dict[str, Any],
    settings: Dict[str, Any],
    api_key: str,
    base_url: str,
    oai_model: str,
) -> Dict[int, Dict[str, Any]]:
    library_root = novena_audio_library_dir()
    feast_date = date_from_iso(feast_day)
    prep_start = feast_date - datetime.timedelta(days=9)
    results: Dict[int, Dict[str, Any]] = {}
    for day_num in range(1, 10):
        target_day = prep_start + datetime.timedelta(days=day_num - 1)
        fragments = saint_novena_fragments_for_day(day_num, devotional_payload)
        audio_text = "\n\n".join(str(row.get("text", "")).strip() for row in fragments if str(row.get("text", "")).strip())
        render_hash = compute_saint_day_audio_render_hash(
            base_url=base_url,
            settings=settings,
            saint_name=saint_name,
            feast_day=feast_day,
            celebration_type=celebration_type,
            day_num=day_num,
            oai_model=oai_model,
            fragments=fragments,
            full_text=audio_text,
        )
        audio_path, meta_path = saint_novena_day_audio_paths(
            library_root,
            saint_name,
            feast_day,
            day_num,
            target_day,
            str(settings.get("format", "mp3")),
        )
        cached_meta = json_read(meta_path)
        if audio_path.exists() and cached_meta and str(cached_meta.get("render_hash", "")).strip() == render_hash:
            results[day_num] = {
                "mode": "cached",
                "render_hash": render_hash,
                "audio_text": audio_text,
                "fragments": fragments,
                "audio_path": audio_path,
                "meta_path": meta_path,
                "target_day": target_day,
            }
            continue

        audio_bytes = generate_openai_audio_bytes(
            api_key=api_key,
            base_url=base_url,
            model=str(settings["model"]),
            voice=str(settings["voice"]),
            audio_format=str(settings["format"]),
            speed=float(settings["speed"]),
            text=audio_text,
        )
        audio_path.parent.mkdir(parents=True, exist_ok=True)
        audio_path.write_bytes(audio_bytes)
        json_write(
            meta_path,
            {
                "generated_at": iso_utc_now(),
                "saint_name": saint_name,
                "feast_day": feast_day,
                "celebration_type": celebration_type,
                "day_num": day_num,
                "target_day": target_day.isoformat(),
                "render_hash": render_hash,
                "audio_format": str(settings.get("format", "")).strip(),
                "tts_model": str(settings.get("model", "")).strip(),
                "tts_voice": str(settings.get("voice", "")).strip(),
                "tts_speed": float(settings.get("speed", 1.0)),
                "text_model": str(oai_model or "").strip(),
                "audio_file": audio_path.name,
                "fragments": fragments,
                "full_text": audio_text,
            },
        )
        results[day_num] = {
            "mode": "generated",
            "render_hash": render_hash,
            "audio_text": audio_text,
            "fragments": fragments,
            "audio_path": audio_path,
            "meta_path": meta_path,
            "target_day": target_day,
        }
    return results


def infer_filename_from_url(url: str, fallback_stem: str, content_type: str) -> str:
    path = unquote(urlparse(url).path or "").strip()
    filename = os.path.basename(path)
    if filename and "." in filename:
        return filename
    ext = mimetypes.guess_extension(content_type or "") or ""
    if ext == ".jpe":
        ext = ".jpg"
    return f"{fallback_stem}{ext}"


def notion_novena_row_titles(explicit_title: str) -> List[str]:
    titles = [explicit_title] if explicit_title else []
    titles.extend(DEFAULT_NOVENA_ROW_TITLES)
    out: List[str] = []
    seen = set()
    for title in titles:
        norm = str(title or "").strip().lower()
        if norm and norm not in seen:
            seen.add(norm)
            out.append(str(title).strip())
    return out


def render_hash_marker(render_hash: str) -> str:
    return f"{NOVENA_AUDIO_HASH_MARKER_PREFIX}{str(render_hash or '').strip()}]"


def extract_render_hash(text: str) -> str:
    match = re.search(r"\[AUTOGEN_NOVENA_AUDIO_HASH:([0-9a-f]{8,64})\]", str(text or "").strip(), re.IGNORECASE)
    return str(match.group(1)).lower() if match else ""


def audio_block_caption(block: Dict[str, Any]) -> str:
    audio = block.get("audio") or {}
    caption = audio.get("caption") or []
    if not isinstance(caption, list):
        return ""
    parts = []
    for item in caption:
        if not isinstance(item, dict):
            continue
        plain = str(item.get("plain_text", "")).strip()
        if plain:
            parts.append(plain)
    return " ".join(parts).strip()


def notion_remove_old_autogen_audio(page_id: str, token: str, marker: str = NOVENA_AUDIO_MARKER) -> int:
    removed = 0
    for block in notion_list_block_children(page_id, token):
        if str(block.get("type", "")).strip() != "audio":
            continue
        caption = audio_block_caption(block)
        if marker not in caption:
            continue
        block_id = str(block.get("id", "")).strip()
        if not block_id:
            continue
        notion_archive_block(block_id, token)
        removed += 1
    return removed


def notion_has_autogen_audio_marker(page_id: str, token: str, marker: str = NOVENA_AUDIO_MARKER) -> bool:
    needle = str(marker or "").strip()
    if not needle:
        return False
    for block in notion_list_block_children(page_id, token):
        if str(block.get("type", "")).strip() != "audio":
            continue
        caption = audio_block_caption(block)
        if needle in caption:
            return True
    return False


def notion_get_autogen_audio_render_hash(page_id: str, token: str, marker: str = NOVENA_AUDIO_MARKER) -> str:
    needle = str(marker or "").strip()
    if not needle:
        return ""
    for block in notion_list_block_children(page_id, token):
        if str(block.get("type", "")).strip() != "audio":
            continue
        caption = audio_block_caption(block)
        if needle not in caption:
            continue
        render_hash = extract_render_hash(caption)
        if render_hash:
            return render_hash
    return ""


def notion_append_audio_block(
    page_id: str,
    upload_id: str,
    caption: str,
    token: str,
    marker: str = NOVENA_AUDIO_MARKER,
) -> None:
    full_caption = f"{caption.strip()} {marker}".strip()
    block = {
        "object": "block",
        "type": "audio",
        "audio": {
            "type": "file_upload",
            "file_upload": {"id": upload_id},
            "caption": [{"type": "text", "text": {"content": full_caption}}],
        },
    }
    notion_append_children(page_id, [block], token)


def novena_audio_settings() -> Dict[str, Any]:
    audio_model = os.getenv(NOVENA_AUDIO_MODEL, "gpt-4o-mini-tts").strip() or "gpt-4o-mini-tts"
    audio_voice = os.getenv(NOVENA_AUDIO_VOICE, "alloy").strip() or "alloy"
    audio_format = os.getenv(NOVENA_AUDIO_FORMAT, "mp3").strip().lower() or "mp3"
    if audio_format not in {"mp3", "opus", "aac", "flac", "wav", "pcm"}:
        raise RuntimeError(f"Invalid {NOVENA_AUDIO_FORMAT} '{audio_format}'.")
    audio_speed = float_env(NOVENA_AUDIO_SPEED, default=1.0, min_value=0.25, max_value=4.0)
    return {
        "model": audio_model,
        "voice": audio_voice,
        "format": audio_format,
        "speed": audio_speed,
    }


def audio_content_type(audio_format: str) -> str:
    return "audio/mpeg" if audio_format == "mp3" else f"audio/{audio_format}"


def compute_render_hash(payload: Dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


def compute_audio_render_hash(text: str, base_url: str, settings: Dict[str, Any]) -> str:
    payload = {
        "base_url": str(base_url or "").rstrip("/"),
        "format": str(settings.get("format", "")).strip().lower(),
        "model": str(settings.get("model", "")).strip(),
        "speed": float(settings.get("speed", 1.0)),
        "text": str(text or "").strip(),
        "voice": str(settings.get("voice", "")).strip(),
    }
    return compute_render_hash(payload)


def compute_daily_novena_audio_render_hash(
    base_url: str,
    settings: Dict[str, Any],
    saints: Sequence[Dict[str, str]],
    start_date: datetime.date,
    end_date: datetime.date,
    oai_model: str,
) -> str:
    payload = {
        "type": DAILY_NOVENA_AUDIO_RENDER_VERSION,
        "base_url": str(base_url or "").rstrip("/"),
        "tts_model": str(settings.get("model", "")).strip(),
        "tts_voice": str(settings.get("voice", "")).strip(),
        "tts_format": str(settings.get("format", "")).strip().lower(),
        "tts_speed": float(settings.get("speed", 1.0)),
        "text_model": str(oai_model or "").strip(),
        "window_start": start_date.isoformat(),
        "window_end": end_date.isoformat(),
        "saints": [
            {
                "date": str(row.get("date", "")).strip(),
                "name": str(row.get("name", "")).strip(),
            }
            for row in saints
        ],
    }
    return compute_render_hash(payload)


def compute_saint_day_audio_render_hash(
    base_url: str,
    settings: Dict[str, Any],
    saint_name: str,
    feast_day: str,
    celebration_type: str,
    day_num: int,
    oai_model: str,
    fragments: Optional[Sequence[Dict[str, Any]]] = None,
    full_text: str = "",
) -> str:
    payload = {
        "type": SAINT_NOVENA_AUDIO_RENDER_VERSION,
        "base_url": str(base_url or "").rstrip("/"),
        "tts_model": str(settings.get("model", "")).strip(),
        "tts_voice": str(settings.get("voice", "")).strip(),
        "tts_format": str(settings.get("format", "")).strip().lower(),
        "tts_speed": float(settings.get("speed", 1.0)),
        "text_model": str(oai_model or "").strip(),
        "saint_name": str(saint_name or "").strip(),
        "feast_day": str(feast_day or "").strip(),
        "celebration_type": str(celebration_type or "").strip(),
        "day_num": int(day_num),
        "full_text": str(full_text or "").strip(),
        "fragments": [
            {
                "key": str((row or {}).get("key", "")).strip(),
                "label": str((row or {}).get("label", "")).strip(),
                "text": str((row or {}).get("text", "")).strip(),
            }
            for row in (fragments or [])
            if isinstance(row, dict)
        ],
    }
    return compute_render_hash(payload)


def compute_saint_novena_payload_render_hash(
    base_url: str,
    model: str,
    saint_name: str,
    feast_day: str,
    celebration_type: str,
) -> str:
    payload = {
        "type": SAINT_NOVENA_PAYLOAD_RENDER_VERSION,
        "base_url": str(base_url or "").rstrip("/"),
        "text_model": str(model or "").strip(),
        "saint_name": str(saint_name or "").strip(),
        "feast_day": str(feast_day or "").strip(),
        "celebration_type": str(celebration_type or "").strip(),
    }
    return compute_render_hash(payload)


def iso_utc_now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def json_read(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return data if isinstance(data, dict) else None


def json_write(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")


def truncate_managed_novena_audio_outputs(root: Path) -> int:
    if not root.exists():
        root.mkdir(parents=True, exist_ok=True)
        return 0
    removed = sum(1 for _ in root.rglob("*"))
    shutil.rmtree(root)
    root.mkdir(parents=True, exist_ok=True)
    return removed


def saint_novena_library_folder(root: Path, saint_name: str, feast_day: str) -> Path:
    return root / f"{str(feast_day or '').strip()}_{slugify_kebab(saint_name)}"


def saint_novena_payload_path(root: Path, saint_name: str, feast_day: str) -> Path:
    folder = saint_novena_library_folder(root, saint_name, feast_day)
    return folder / f"{str(feast_day or '').strip()}_{slugify_kebab(saint_name)}_payload.json"


def saint_novena_day_audio_paths(
    root: Path,
    saint_name: str,
    feast_day: str,
    day_num: int,
    target_day: datetime.date,
    audio_format: str,
) -> tuple[Path, Path]:
    folder = saint_novena_library_folder(root, saint_name, feast_day)
    base = f"day-{int(day_num):02d}_{target_day.isoformat()}_{slugify_kebab(saint_name)}"
    return folder / f"{base}.{audio_format}", folder / f"{base}.json"


def normalize_romcal_calendar(calendar: str) -> str:
    value = str(calendar or "").strip().lower()
    aliases = {
        "general": "general_roman",
        "roman": "general_roman",
    }
    return aliases.get(value, value or "general_roman")


@lru_cache(maxsize=1)
def bundled_calendar_definitions_by_id() -> Dict[str, CalendarDefinition]:
    return {str(calendar.id).strip(): calendar for calendar in get_bundled_calendar_definitions()}


def celebration_id(event: Dict[str, Any]) -> str:
    return str(event.get("id", "")).strip().lower()


def special_sunday_normalization_rows(calendar: str) -> Dict[str, DayDefinition]:
    base_calendar_id = normalize_romcal_calendar(calendar)
    bundled = bundled_calendar_definitions_by_id()
    temporal_cycle = bundled.get("temporal_cycle")
    if temporal_cycle is None:
        raise RuntimeError("Could not find Romcal temporal_cycle calendar for special Sunday normalization.")

    overrides: Dict[str, DayDefinition] = {}
    missing: List[str] = []
    for day_id in SPECIAL_SUNDAY_SOLEMNITY_IDS:
        base_day = temporal_cycle.days_definitions.get(day_id) if temporal_cycle.days_definitions else None
        if base_day is None:
            missing.append(day_id)
            continue
        overrides[day_id] = base_day.model_copy(update={"precedence": Precedence.general_solemnity_3}, deep=True)

    if missing:
        raise RuntimeError(
            "Could not build Romcal special Sunday overlay for "
            f"{base_calendar_id}; missing temporal_cycle day definitions: {', '.join(sorted(missing))}"
        )
    return overrides


def build_romcal_overlay_calendar(calendar: str) -> CalendarDefinition:
    base_calendar_id = normalize_romcal_calendar(calendar)
    bundled = bundled_calendar_definitions_by_id()
    base_calendar = bundled.get(base_calendar_id)
    if base_calendar is None:
        raise RuntimeError(f"Could not find bundled Romcal calendar '{base_calendar_id}'.")
    overlay_id = f"{base_calendar_id}{ROMCAL_OVERLAY_SUFFIX}"
    return base_calendar.model_copy(
        update={
            "id": overlay_id,
            "parent_calendar_ids": [base_calendar_id],
            "days_definitions": special_sunday_normalization_rows(base_calendar_id),
        },
        deep=True,
    )


def infer_celebration_rank(event: Dict[str, Any]) -> str:
    precedence = infer_precedence(event)
    if precedence.startswith("Precedence.weekday_of_easter_octave_"):
        return EASTER_OCTAVE_PSEUDO_RANK
    if celebration_id(event) in SPECIAL_SUNDAY_SOLEMNITY_IDS:
        return "solemnity"
    # Keep Romcal rank as-is (for example: optional_memorial, memorial, feast, solemnity).
    return str(event.get("rank_name", "")).strip() or str(event.get("rank", "")).strip() or "unknown"


def infer_precedence(event: Dict[str, Any]) -> str:
    # Keep Romcal precedence key as-is (for example: Precedence.optional_memorial_12).
    return str(event.get("precedence", "")).strip() or "unknown"


@lru_cache(maxsize=8)
def build_romcal(calendar: str, locale: str) -> Romcal:
    calendar_id = normalize_romcal_calendar(calendar)
    overlay_calendar = build_romcal_overlay_calendar(calendar_id)
    return Romcal(
        calendar=overlay_calendar.id,
        locale=(str(locale or "").strip() or "en"),
        resources=get_bundled_resources(),
        calendar_definitions=[*get_bundled_calendar_definitions(), overlay_calendar],
    )


@lru_cache(maxsize=16)
def romcal_year_calendar(calendar: str, locale: str, year: int) -> Dict[str, List[Any]]:
    romcal = build_romcal(calendar, locale)
    data = romcal.liturgical_calendar(year)
    if not isinstance(data, dict):
        raise RuntimeError("Romcal returned unexpected calendar format.")
    return data


@lru_cache(maxsize=16)
def romcal_year_mass_calendar(calendar: str, locale: str, year: int) -> Dict[str, List[Any]]:
    romcal = build_romcal(calendar, locale)
    data = romcal.mass_calendar(year)
    if not isinstance(data, dict):
        raise RuntimeError("Romcal returned unexpected mass calendar format.")
    return data


def celebration_name(event: Dict[str, Any]) -> str:
    for key in ("name", "title", "localName", "commonName", "fullname", "id"):
        value = str(event.get(key, "")).strip()
        if value:
            return value
    return ""


def romcal_fetch_day(calendar: str, locale: str, dt: datetime.date) -> List[Dict[str, Any]]:
    try:
        mass_cal = romcal_year_mass_calendar(calendar, locale, dt.year)
        mass_events = mass_cal.get(dt.isoformat(), []) or []
    except Exception as exc:
        raise RuntimeError(
            f"Failed to fetch Romcal data for {dt.isoformat()} (calendar={normalize_romcal_calendar(calendar)}, locale={locale})"
        ) from exc

    out: List[Dict[str, Any]] = []
    if mass_events:
        first = mass_events[0]
        primary = first.model_dump() if hasattr(first, "model_dump") else (dict(first) if isinstance(first, dict) else {})
        if isinstance(primary, dict) and primary:
            primary["suppressed"] = False
            out.append(primary)
            optionals = primary.get("optional_celebrations") or []
            if isinstance(optionals, list):
                for opt in optionals:
                    if not isinstance(opt, dict):
                        continue
                    row = dict(opt)
                    row["suppressed"] = True
                    row["date"] = dt.isoformat()
                    out.append(row)
    else:
        # Fallback path if mass_calendar has no row for a date.
        cal = romcal_year_calendar(calendar, locale, dt.year)
        events = cal.get(dt.isoformat(), []) or []
        for event in events:
            if hasattr(event, "model_dump"):
                dumped = event.model_dump()
                if isinstance(dumped, dict):
                    dumped["suppressed"] = False
                    out.append(dumped)
            elif isinstance(event, dict):
                row = dict(event)
                row["suppressed"] = False
                out.append(row)
    return out


def collect_saints_window(
    calendar: str,
    locale: str,
    start_date: datetime.date,
    days: int,
) -> List[Dict[str, str]]:
    celebrations: List[Dict[str, str]] = []
    seen = set()

    for offset in range(days + 1):
        dt = start_date + datetime.timedelta(days=offset)
        events = romcal_fetch_day(calendar, locale, dt)
        for event in events:
            if not isinstance(event, dict):
                continue
            name = celebration_name(event)
            if not name:
                continue
            key = (dt.isoformat(), name.lower())
            if key in seen:
                continue
            seen.add(key)
            celebration_rank = infer_celebration_rank(event)
            precedence = infer_precedence(event)
            if not devotional_output_is_eligible(celebration_rank, precedence):
                continue
            row = {
                "date": dt.isoformat(),
                "name": name,
                "celebration_rank": celebration_rank,
                "precedence": precedence,
                "entry_kind": "liturgical_subject",
            }
            celebrations.append(row)

    return celebrations


def collect_calendar_days_window(
    calendar: str,
    locale: str,
    start_date: datetime.date,
    days: int,
) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    seen = set()
    for offset in range(days + 1):
        dt = start_date + datetime.timedelta(days=offset)
        events = romcal_fetch_day(calendar, locale, dt)
        if not events:
            continue
        # Include all celebrations surfaced by Romcal for the day (primary + suppressed/optional).
        for ev in events:
            if not isinstance(ev, dict):
                continue
            name = celebration_name(ev)
            if not name:
                continue
            key = (dt.isoformat(), name.lower())
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "date": dt.isoformat(),
                    "name": name,
                    "celebration_rank": infer_celebration_rank(ev),
                    "precedence": infer_precedence(ev),
                    "entry_kind": "calendar_day",
                }
            )
    return rows


def find_named_saint_feast(
    calendar: str,
    locale: str,
    saint_name_query: str,
    search_start: datetime.date,
    search_days: int,
) -> Optional[Dict[str, str]]:
    q = normalize_name_for_match(saint_name_query)
    if not q:
        return None
    for offset in range(max(1, search_days)):
        dt = search_start + datetime.timedelta(days=offset)
        events = romcal_fetch_day(calendar, locale, dt)
        for event in events:
            if not isinstance(event, dict):
                continue
            name = celebration_name(event)
            if not name:
                continue
            nn = normalize_name_for_match(name)
            if q in nn or nn in q:
                celebration_rank = infer_celebration_rank(event)
                precedence = infer_precedence(event)
                if not devotional_output_is_eligible(celebration_rank, precedence):
                    continue
                return {
                    "date": dt.isoformat(),
                    "name": name,
                    "celebration_rank": celebration_rank,
                    "precedence": precedence,
                    "entry_kind": "liturgical_subject",
                }
    return None


def format_saints_for_prompt(saints: Sequence[Dict[str, str]]) -> str:
    rows = []
    for row in saints:
        rows.append(f"{row.get('date', '').strip()} - {row.get('name', '').strip()}")
    return "\n".join(rows)


def normalize_name_for_match(text: str) -> str:
    s = str(text or "").lower()
    s = s.replace("st.", "saint ").replace("st ", "saint ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def extract_saint_like_mentions(text: str) -> List[str]:
    # Capture phrases starting with Saint/Saints/St. followed by title-cased words.
    pattern = re.compile(
        r"\b(?:Saint|Saints|St\.)\s+[A-Z][A-Za-z'`\-]*(?:\s+[A-Z][A-Za-z'`\-]*){0,8}",
        flags=re.MULTILINE,
    )
    out: List[str] = []
    for m in pattern.finditer(str(text or "")):
        phrase = m.group(0).strip()
        # Ignore generic headings like "Saints" with no actual name content.
        tokens = re.findall(r"[A-Za-z'`\-]+", phrase)
        if len(tokens) < 2:
            continue
        # Require at least one token after prefix that looks like a person name.
        tail = tokens[1:]
        if not any(len(t) >= 3 for t in tail):
            continue
        out.append(phrase)
    return out


def validate_mentions_against_romcal(text: str, saints: Sequence[Dict[str, str]]) -> List[str]:
    allowed = [normalize_name_for_match(str(row.get("name", ""))) for row in saints]
    allowed = [x for x in allowed if x]
    allowed_tokens = set()
    for a in allowed:
        for t in a.split():
            if len(t) >= 3:
                allowed_tokens.add(t)
    mentions = extract_saint_like_mentions(text)
    noise_tokens = {
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    }
    invalid: List[str] = []
    for m in mentions:
        nm = normalize_name_for_match(m)
        if not nm:
            continue
        nm_tokens = [t for t in nm.split() if len(t) >= 3]
        # Drop generic prefix tokens.
        nm_tokens = [t for t in nm_tokens if t not in {"saint", "saints"}]
        nm_tokens = [t for t in nm_tokens if t not in noise_tokens]
        # If nothing meaningful remains, ignore this mention.
        if not nm_tokens:
            continue
        if not any((nm in a) or (a in nm) for a in allowed):
            # Secondary fuzzy check: significant overlap with known saint tokens.
            overlap = [t for t in nm_tokens if t in allowed_tokens]
            if len(overlap) >= 2:
                continue
            invalid.append(m)
    # de-dup preserve order
    out: List[str] = []
    seen = set()
    for x in invalid:
        k = x.lower()
        if k not in seen:
            seen.add(k)
            out.append(x)
    return out


def call_openai_litany(
    api_key: str,
    base_url: str,
    model: str,
    saints: Sequence[Dict[str, str]],
    start_date: datetime.date,
    end_date: datetime.date,
) -> str:
    saint_list = format_saints_for_prompt(saints)
    allowed_names = [str(row.get("name", "")).strip() for row in saints if str(row.get("name", "")).strip()]
    allowed_names_text = "\n".join(f"- {name}" for name in allowed_names)
    system_prompt = (
        "ROLE\n"
        "You are a Catholic devotional writer who creates concise daily prayers based on the liturgical calendar."
    )
    user_prompt = (
        "TASK\n"
        "Generate a short Rolling Novena prayer that honors saints whose feast days fall within the next 9 days. "
        "The focus should be on the saint whose feast day is today, while future saints are mentioned briefly to prepare "
        "the faithful for their upcoming feasts.\n\n"
        "INPUTS\n"
        f"Current Date: {start_date.isoformat()}\n\n"
        "Upcoming Saints (within the next 9 days):\n"
        "[List in format: Date - Saint Name - Title or brief identifier]\n"
        f"{saint_list}\n\n"
        "INSTRUCTIONS\n"
        "1. Begin with a short 1-2 sentence introduction explaining that this prayer prepares the faithful for the saints whose feast days are approaching.\n"
        "2. Identify the saint whose feast day is TODAY.\n"
        "3. Create a section for the saint whose feast is today with the following format:\n"
        "Saint: [Name]\n"
        "Feast Day: [Date]\n\n"
        "Write a short 1-2 sentence description of the saint explaining:\n"
        "- Who they were\n"
        "- Their significance to the Church\n\n"
        "Then include:\n\n"
        "Prayer\n"
        "A short 2-3 line intercession prayer asking for the saint's help.\n\n"
        "Feast Day Prayer\n"
        "A brief prayer thanking God for the saint and asking for the grace to imitate their virtue.\n\n"
        "4. Create a section titled:\n"
        "Upcoming Saints\n\n"
        "List each future saint in this format:\n"
        "Date - Saint Name\n"
        "One short sentence describing who the saint was or their key virtue.\n\n"
        "Do NOT include individual prayers for these future saints.\n\n"
        "5. End with:\n"
        "Rolling Novena Prayer\n\n"
        "A short communal prayer that:\n"
        "- Mentions the saints collectively\n"
        "- Asks for their intercession as their feast days approach\n"
        "- Ends with 'Through Christ our Lord. Amen.'\n\n"
        "6. End with a short section:\n"
        "Reflection\n\n"
        "Include 2-3 brief reflection questions about imitating the saints' virtues.\n\n"
        "HARD CONSTRAINTS (MUST FOLLOW)\n"
        "1) Use only saints explicitly listed in Upcoming Saints.\n"
        "2) Use saint names exactly as written (no substitutions or alternate saints).\n"
        "3) If no saint in Upcoming Saints matches Current Date, explicitly state that today's focus is preparation "
        "for upcoming feasts and do not invent a saint for today.\n"
        "4) Never add extra saint names not in the list.\n\n"
        "Allowed Saint Names (exact):\n"
        f"{allowed_names_text}\n\n"
        "STYLE\n"
        "- Concise and devotional\n"
        "- Faithful to Catholic teaching\n"
        "- Suitable for daily prayer\n"
        "- Future saints should be summarized briefly (one sentence each)\n"
    )
    client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))

    last_text = ""
    for _ in range(2):
        try:
            response = client.responses.create(
                model=model,
                input=[
                    {"role": "system", "content": [{"type": "input_text", "text": system_prompt}]},
                    {"role": "user", "content": [{"type": "input_text", "text": user_prompt}]},
                ],
            )
            text = str(getattr(response, "output_text", "") or "").strip()
            if text:
                bad = validate_mentions_against_romcal(text, saints)
                if not bad:
                    return text
                last_text = text
        except Exception:
            pass

        chat = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        choices = getattr(chat, "choices", None) or []
        if not choices:
            continue
        message = getattr(choices[0], "message", None)
        content = str(getattr(message, "content", "") or "").strip()
        if content:
            bad = validate_mentions_against_romcal(content, saints)
            if not bad:
                return content
            last_text = content

    bad = validate_mentions_against_romcal(last_text, saints)
    raise RuntimeError(f"Generated prayer mentioned non-Romcal saints: {', '.join(bad[:5])}")


def call_openai_saint_background(
    api_key: str,
    base_url: str,
    model: str,
    saint_name: str,
    feast_day: str,
    celebration_type: str,
) -> str:
    client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))
    system = (
        "You are a Catholic devotional writer. Write concise, factual saint summaries for Notion."
    )
    user = (
        f"Saint: {saint_name}\n"
        f"Feast Day: {feast_day}\n"
        f"Celebration Type: {celebration_type}\n\n"
        "Write 3-4 sentences: who the saint was, key witness/virtue, and why the Church remembers them."
    )
    try:
        response = client.responses.create(
            model=model,
            input=[
                {"role": "system", "content": [{"type": "input_text", "text": system}]},
                {"role": "user", "content": [{"type": "input_text", "text": user}]},
            ],
        )
        text = str(getattr(response, "output_text", "") or "").strip()
        if text:
            return text
    except Exception:
        pass
    chat = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    choices = getattr(chat, "choices", None) or []
    if not choices:
        return f"{saint_name} is commemorated by the Church on {feast_day} as a {celebration_type.lower()}."
    content = str(getattr(getattr(choices[0], "message", None), "content", "") or "").strip()
    return content or f"{saint_name} is commemorated by the Church on {feast_day} as a {celebration_type.lower()}."


def _extract_first_json_object(text: str) -> str:
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < 0 or end <= start:
        raise RuntimeError("No JSON object found in model output.")
    return text[start : end + 1]


def call_openai_saint_devotional_content(
    api_key: str,
    base_url: str,
    model: str,
    saint_name: str,
    feast_day: str,
    celebration_type: str,
) -> Dict[str, Any]:
    client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))
    system = (
        "You are a Catholic devotional writer. Return valid JSON only. "
        "No markdown, no code fences."
    )
    user = (
        f"Saint: {saint_name}\n"
        f"Feast Day: {feast_day}\n"
        f"Celebration Type: {celebration_type}\n\n"
        "Create devotional content JSON with keys:\n"
        "{\n"
        '  "feast_overview": "2-4 sentences including feast placement and short who-is-the-saint summary",\n'
        '  "life_sections": [{"heading":"...", "content":"..."}],\n'
        '  "opening_prayer": "...",\n'
        '  "daily_prayers": [\n'
        '    {"day":1,"theme":"...","intercession":"...","daily_prayer":"..."} ... day 9\n'
        "  ],\n"
        '  "closing_prayer": "..."\n'
        "}\n"
        "Requirements:\n"
        "- life_sections can have multiple subsections\n"
        "- daily themes must connect to saint's life\n"
        '- "intercession" must contain the daily petition or request for the saint\'s help\n'
        '- "daily_prayer" must be the main prayer body for the day and must not repeat or restate the same intercession request\n'
        '- do not include "Intercession:" labels or personal-intention placeholders inside "daily_prayer"\n'
        "- theological fidelity and devotional tone\n"
    )
    text = ""
    try:
        response = client.responses.create(
            model=model,
            input=[
                {"role": "system", "content": [{"type": "input_text", "text": system}]},
                {"role": "user", "content": [{"type": "input_text", "text": user}]},
            ],
        )
        text = str(getattr(response, "output_text", "") or "").strip()
    except Exception:
        text = ""
    if not text:
        chat = client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        )
        choices = getattr(chat, "choices", None) or []
        if choices:
            text = str(getattr(getattr(choices[0], "message", None), "content", "") or "").strip()
    if not text:
        raise RuntimeError("Could not generate saint devotional content.")
    obj = json.loads(_extract_first_json_object(text))
    if not isinstance(obj, dict):
        raise RuntimeError("Invalid devotional JSON format.")
    return obj


def rich_text(content: str) -> List[Dict[str, Any]]:
    return [{"type": "text", "text": {"content": content}}]


def paragraph_block(content: str) -> Dict[str, Any]:
    return {"object": "block", "type": "paragraph", "paragraph": {"rich_text": rich_text(content)}}


def bounded_toggle_children(title: str, children: Sequence[Dict[str, Any]], depth: int = 1) -> List[Dict[str, Any]]:
    child_list = list(children)
    if len(child_list) <= NOTION_MAX_BLOCK_CHILDREN:
        return child_list
    head = child_list[: NOTION_MAX_BLOCK_CHILDREN - 1]
    tail = child_list[NOTION_MAX_BLOCK_CHILDREN - 1 :]
    suffix = " (continued)" if depth == 1 else f" (continued {depth})"
    head.append(
        {
            "object": "block",
            "type": "toggle",
            "toggle": {
                "rich_text": rich_text(f"{title}{suffix}"),
                "children": bounded_toggle_children(title, tail, depth + 1),
            },
        }
    )
    return head


def toggle_block(title: str, children: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "object": "block",
        "type": "toggle",
        "toggle": {"rich_text": rich_text(title), "children": bounded_toggle_children(title, children)},
    }


def to_do_block(content: str, checked: bool = False) -> Dict[str, Any]:
    return {
        "object": "block",
        "type": "to_do",
        "to_do": {"rich_text": rich_text(content), "checked": checked},
    }


def saint_devotional_blocks(
    saint_name: str,
    feast_day: str,
    celebration_type: str,
    payload: Dict[str, Any],
) -> List[Dict[str, Any]]:
    feast_overview = str(payload.get("feast_overview", "")).strip()
    life_sections = payload.get("life_sections") or []
    opening_prayer = str(payload.get("opening_prayer", "")).strip()
    daily_prayers = payload.get("daily_prayers") or []
    closing_prayer = str(payload.get("closing_prayer", "")).strip()

    feast_date = datetime.date.fromisoformat(feast_day)
    prep_start = feast_date - datetime.timedelta(days=8)

    blocks: List[Dict[str, Any]] = []
    placement_children: List[Dict[str, Any]] = [
        paragraph_block(f"Saint: {saint_name}"),
        paragraph_block(f"Feast Day: {feast_day} ({celebration_type})"),
        paragraph_block(
            "Why this feast day: liturgical calendar placement and significance for this saint."
        ),
    ]
    for chunk in split_text_chunks(feast_overview or f"{saint_name} is commemorated on {feast_day}.", 1800):
        placement_children.append(paragraph_block(chunk))
    blocks.append(toggle_block("Saint Background & Feast Placement", placement_children))

    life_children: List[Dict[str, Any]] = []
    if isinstance(life_sections, list) and life_sections:
        for section in life_sections:
            if not isinstance(section, dict):
                continue
            heading = str(section.get("heading", "")).strip() or "Life Section"
            content = str(section.get("content", "")).strip()
            section_children: List[Dict[str, Any]] = []
            for chunk in split_text_chunks(content or f"Life details for {saint_name}.", 1800):
                section_children.append(paragraph_block(chunk))
            life_children.append(toggle_block(heading, section_children))
    else:
        life_children.append(paragraph_block(f"Life details for {saint_name}."))
    blocks.append(toggle_block("Life of the Saint", life_children))

    opening_children = [paragraph_block(chunk) for chunk in split_text_chunks(opening_prayer or "Opening prayer.", 1800)]
    blocks.append(toggle_block("Opening Prayer", opening_children))

    # Ensure 9 daily toggles, aligned to prep-start day sequence.
    by_day: Dict[int, Dict[str, Any]] = {}
    if isinstance(daily_prayers, list):
        for row in daily_prayers:
            if isinstance(row, dict):
                try:
                    day_n = int(row.get("day", 0))
                except Exception:
                    day_n = 0
                if 1 <= day_n <= 9:
                    by_day[day_n] = row
    for day_n in range(1, 10):
        row = by_day.get(day_n, {})
        day_date = prep_start + datetime.timedelta(days=day_n - 1)
        theme = str(row.get("theme", "")).strip() or f"Theme for Day {day_n}"
        intercession = str(row.get("intercession", "")).strip() or "Intercede for us."
        daily_prayer = str(row.get("daily_prayer", "")).strip() or "Daily novena prayer."
        day_children = [
            paragraph_block(f"Theme: {theme}"),
            paragraph_block(f"Intercession: {intercession}"),
            paragraph_block("Personal intention: [Write your intention here]"),
        ]
        for chunk in split_text_chunks(daily_prayer, 1800):
            day_children.append(paragraph_block(chunk))
        blocks.append(toggle_block(f"Day {day_n} - {day_date.strftime('%b %d')}", day_children))

    closing_children = [paragraph_block(chunk) for chunk in split_text_chunks(closing_prayer or "Closing prayer.", 1800)]
    blocks.append(toggle_block("Closing Prayer", closing_children))
    return blocks


def generate_openai_audio_bytes(
    api_key: str,
    base_url: str,
    model: str,
    voice: str,
    audio_format: str,
    speed: float,
    text: str,
) -> bytes:
    client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))
    response = client.audio.speech.create(
        model=model,
        voice=voice,
        input=text,
        response_format=audio_format,
        speed=speed,
    )
    raw = bytes(response.content)
    if not raw:
        raise RuntimeError("OpenAI audio generation returned empty content.")
    return raw


def find_target_notion_page(
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    target_title: str | Sequence[str],
) -> Dict[str, Any]:
    if isinstance(target_title, str):
        candidates = [target_title]
    else:
        candidates = [str(title or "").strip() for title in target_title if str(title or "").strip()]
    wanted = {title.lower() for title in candidates}
    for page in pages:
        if not isinstance(page, dict):
            continue
        title = page_title(page, title_property).strip().lower()
        if title in wanted:
            return page
    raise RuntimeError(
        f"Could not find Notion page titled one of {candidates!r} using title property '{title_property}'."
    )


def notion_clone_block_tree(block: Dict[str, Any], token: str) -> Optional[Dict[str, Any]]:
    block_type = str(block.get("type", "")).strip()
    payload = block.get(block_type) or {}
    if block_type in {
        "paragraph",
        "heading_1",
        "heading_2",
        "heading_3",
        "bulleted_list_item",
        "numbered_list_item",
        "to_do",
        "toggle",
        "quote",
        "divider",
        "callout",
        "bookmark",
        "embed",
    }:
        cloned_payload = deepcopy(payload)
        if str(block.get("id", "")).strip() and block_type in {
            "heading_1",
            "heading_2",
            "heading_3",
            "bulleted_list_item",
            "numbered_list_item",
            "to_do",
            "toggle",
            "quote",
            "callout",
        }:
            children: List[Dict[str, Any]] = []
            for child in notion_list_block_children(str(block.get("id", "")).strip(), token):
                cloned_child = notion_clone_block_tree(child, token)
                if cloned_child:
                    children.append(cloned_child)
            if children:
                cloned_payload["children"] = children
        return {"object": "block", "type": block_type, block_type: cloned_payload}

    if block_type == "audio":
        audio = payload if isinstance(payload, dict) else {}
        caption = deepcopy(audio.get("caption") or [])
        audio_type = str(audio.get("type", "")).strip()
        if audio_type == "external":
            url = str((audio.get("external") or {}).get("url", "")).strip()
            if not url:
                return None
            return {
                "object": "block",
                "type": "audio",
                "audio": {"type": "external", "external": {"url": url}, "caption": caption},
            }
        if audio_type == "file":
            url = str((audio.get("file") or {}).get("url", "")).strip()
            if not url:
                return None
            file_bytes, content_type = notion_download_bytes(url)
            filename = infer_filename_from_url(
                url,
                fallback_stem=f"notion_audio_{str(block.get('id', '')).strip() or 'mirror'}",
                content_type=content_type,
            )
            upload_id = notion_upload_file(filename, content_type or "application/octet-stream", file_bytes, token)
            return {
                "object": "block",
                "type": "audio",
                "audio": {"type": "file_upload", "file_upload": {"id": upload_id}, "caption": caption},
            }
    return None


def mirror_calendar_page_to_novena_page(
    target_page: Dict[str, Any],
    source_page: Dict[str, Any],
    token: str,
) -> str:
    target_page_id = str(target_page.get("id", "")).strip()
    source_page_id = str(source_page.get("id", "")).strip()
    if not target_page_id:
        raise RuntimeError("Target novena page has no id.")
    if not source_page_id:
        raise RuntimeError("Source calendar page has no id.")

    children: List[Dict[str, Any]] = []
    for block in notion_list_block_children(source_page_id, token):
        title = block_rich_text_plain(block)
        caption = audio_block_caption(block)
        if NOVENA_DAY_SECTION_MARKER not in title and NOVENA_DAY_SECTION_MARKER not in caption:
            continue
        cloned = notion_clone_block_tree(block, token)
        if cloned:
            children.append(cloned)

    notion_replace_page_blocks(target_page_id, children, token)
    return f"mirrored_novena:{len(children)}"


def write_prayer_to_notion_page(
    page: Dict[str, Any],
    prayer_text: str,
    token: str,
    extra_blocks: Optional[Sequence[Dict[str, Any]]] = None,
) -> str:
    page_id = str(page.get("id", "")).strip()
    if not page_id:
        raise RuntimeError("Target Notion page has no id.")

    output_property = os.getenv(NOTION_NOVENA_PROPERTY, "").strip()
    if output_property:
        prop = (page.get("properties") or {}).get(output_property) or {}
        ptype = str(prop.get("type", "")).strip()
        if ptype == "rich_text":
            notion_update_rich_text_property(page_id, output_property, prayer_text, token)
            if extra_blocks:
                return f"property:{output_property}:body_extra_skipped"
            return f"property:{output_property}"

    notion_replace_page_content(page_id, prayer_text, token, extra_blocks=extra_blocks)
    return "page_content"


def parse_saint_radar_db_id(sync_mode: str) -> str:
    # Format: "<created|existing>:<db_id>:upserted=...:..."
    parts = [p.strip() for p in str(sync_mode or "").split(":") if p.strip()]
    if len(parts) >= 2 and parts[0] in {"created", "existing"}:
        return parts[1]
    return ""


def find_saint_radar_page(
    database_id: str,
    token: str,
    title_property: str,
    feast_day_property: str,
    saint_name: str,
    feast_day: str,
) -> Optional[Dict[str, Any]]:
    pages = notion_get_all_pages(database_id, token)
    wanted_name = saint_name.strip().lower()
    wanted_day = feast_day.strip()
    for page in pages:
        if not isinstance(page, dict):
            continue
        p_name = page_title(page, title_property).strip().lower()
        p_day = page_date(page, feast_day_property).strip()
        if p_name == wanted_name and p_day == wanted_day:
            return page
    return None


def find_calendar_page_for_date(
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    feast_day_property: str,
    target_day: str,
    preferred_title: str = "",
) -> Optional[Dict[str, Any]]:
    wanted_day = str(target_day or "").strip()
    wanted_title = str(preferred_title or "").strip().lower()
    by_day: List[Dict[str, Any]] = []
    for page in pages:
        if not isinstance(page, dict):
            continue
        if page_date(page, feast_day_property).strip() == wanted_day:
            by_day.append(page)
    if not by_day:
        return None
    if wanted_title:
        for page in by_day:
            if page_title(page, title_property).strip().lower() == wanted_title:
                return page
    # Deterministic fallback if multiple rows share a day.
    by_day.sort(key=lambda p: str(p.get("created_time", "")))
    return by_day[0]


def list_calendar_pages_for_date(
    pages: Sequence[Dict[str, Any]],
    feast_day_property: str,
    target_day: str,
) -> List[Dict[str, Any]]:
    wanted_day = str(target_day or "").strip()
    if not wanted_day:
        return []
    out: List[Dict[str, Any]] = []
    for page in pages:
        if not isinstance(page, dict):
            continue
        if page_date(page, feast_day_property).strip() == wanted_day:
            out.append(page)
    return out


def build_primary_calendar_titles(rows: Sequence[Dict[str, str]]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for row in rows:
        day = str(row.get("date", "")).strip()
        name = str(row.get("name", "")).strip()
        if day and name and day not in out:
            out[day] = name
    return out


def notion_remove_autogen_markers_from_other_pages_for_day(
    pages: Sequence[Dict[str, Any]],
    feast_day_property: str,
    target_day: str,
    keep_page_id: str,
    token: str,
    section_markers: Sequence[str],
    audio_markers: Sequence[str],
) -> None:
    keep = str(keep_page_id or "").strip()
    for page in list_calendar_pages_for_date(pages, feast_day_property, target_day):
        page_id = str(page.get("id", "")).strip()
        if not page_id or page_id == keep:
            continue
        if section_markers:
            notion_remove_old_autogen_sections_by_markers(page_id, token, section_markers)
        for marker in audio_markers:
            notion_remove_old_autogen_audio(page_id, token, marker=marker)


def cleanup_ineligible_novena_outputs(
    pages: Sequence[Dict[str, Any]],
    feast_day_property: str,
    celebrations: Sequence[Dict[str, str]],
    token: str,
) -> Dict[str, int]:
    removed_sections = 0
    removed_audio = 0
    seen: set[tuple[str, str]] = set()
    for row in celebrations:
        feast_iso = str(row.get("date", "")).strip()
        name = str(row.get("name", "")).strip()
        rank = str(row.get("celebration_rank", "")).strip()
        precedence = str(row.get("precedence", "")).strip()
        if not feast_iso or not name:
            continue
        if devotional_output_is_eligible(rank, precedence):
            continue
        feast_date = date_from_iso(feast_iso)
        prep_start = feast_date - datetime.timedelta(days=9)
        prep_end = feast_date - datetime.timedelta(days=1)
        for offset in range((prep_end - prep_start).days + 1):
            target_day = prep_start + datetime.timedelta(days=offset)
            target_iso = target_day.isoformat()
            marker = saint_day_marker(name, target_day)
            audio_marker = f"{marker}:{NOVENA_AUDIO_MARKER}"
            for page in list_calendar_pages_for_date(pages, feast_day_property, target_iso):
                page_id = str(page.get("id", "")).strip()
                if not page_id:
                    continue
                key = (page_id, marker)
                if key in seen:
                    continue
                seen.add(key)
                removed_sections += notion_remove_old_autogen_sections_by_markers(page_id, token, [marker])
                removed_audio += notion_remove_old_autogen_audio(page_id, token, marker=audio_marker)
    return {"sections": removed_sections, "audio": removed_audio}


def append_usccb_readings_to_extra_pages(
    page_ids: Sequence[str],
    readings_blocks: Sequence[Dict[str, Any]],
    token: str,
) -> int:
    wrote = 0
    seen: set[str] = set()
    for raw_page_id in page_ids:
        page_id = str(raw_page_id or "").strip()
        if not page_id or page_id in seen:
            continue
        seen.add(page_id)
        preserved: List[Dict[str, Any]] = []
        for block in notion_list_block_children(page_id, token):
            if str(block.get("type", "")).strip() not in {"bookmark", "embed"}:
                continue
            cloned = notion_clone_block_tree(block, token)
            if cloned:
                preserved.append(cloned)
        notion_replace_page_blocks(page_id, preserved + list(readings_blocks), token)
        wrote += 1
    return wrote


def notion_create_page(database_id: str, properties: Dict[str, Any], token: str) -> None:
    body = {"parent": {"database_id": database_id}, "properties": properties}
    notion_call("POST", "https://api.notion.com/v1/pages", token, body)


def notion_update_page_properties(page_id: str, properties: Dict[str, Any], token: str) -> None:
    notion_call("PATCH", f"https://api.notion.com/v1/pages/{page_id}", token, {"properties": properties})


def notion_property_type(database: Dict[str, Any], prop_name: str) -> str:
    props = database.get("properties") or {}
    prop = props.get(prop_name) or {}
    return str(prop.get("type", "")).strip()


def normalize_prop_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(name or "").lower())


def notion_resolve_property_name(database: Dict[str, Any], preferred: str, aliases: Sequence[str]) -> str:
    props = database.get("properties") or {}
    if preferred in props:
        return preferred
    wanted = {normalize_prop_key(preferred)} | {normalize_prop_key(a) for a in aliases}
    for key in props.keys():
        if normalize_prop_key(str(key)) in wanted:
            return str(key)
    return preferred


def notion_scalar_property_value(prop_type: str, value: str) -> Dict[str, Any]:
    text = str(value or "").strip()
    if prop_type == "select":
        return {"select": {"name": text}} if text else {"select": None}
    if prop_type == "rich_text":
        return {"rich_text": [{"type": "text", "text": {"content": text}}]} if text else {"rich_text": []}
    if prop_type == "title":
        return {"title": [{"type": "text", "text": {"content": text}}]} if text else {"title": []}
    if prop_type == "url":
        return {"url": text}
    # Fallback to rich_text for unsupported scalar fields.
    return {"rich_text": [{"type": "text", "text": {"content": text}}]} if text else {"rich_text": []}


def notion_page_property_type(page: Dict[str, Any], prop_name: str) -> str:
    props = page.get("properties") or {}
    prop = props.get(prop_name) or {}
    return str(prop.get("type", "")).strip()


def notion_page_is_archived(page: Dict[str, Any]) -> bool:
    return bool(page.get("archived")) or bool(page.get("in_trash"))


def notion_update_scalar_page_property_if_present(page: Dict[str, Any], prop_name: str, value: str, token: str) -> bool:
    page_id = str(page.get("id", "")).strip()
    prop_type = notion_page_property_type(page, prop_name)
    if not page_id or prop_type not in {"select", "rich_text", "title", "url"}:
        return False
    notion_update_page_properties(page_id, {prop_name: notion_scalar_property_value(prop_type, value)}, token)
    return True


def notion_update_audio_saved_property_if_present(page: Dict[str, Any], prop_name: str, token: str) -> bool:
    page_id = str(page.get("id", "")).strip()
    prop_type = notion_page_property_type(page, prop_name)
    if not page_id or not prop_type:
        return False
    if prop_type == "date":
        notion_update_page_properties(
            page_id,
            {prop_name: {"date": {"start": local_now().replace(microsecond=0).isoformat()}}},
            token,
        )
        return True
    if prop_type == "checkbox":
        notion_update_page_properties(page_id, {prop_name: {"checkbox": True}}, token)
        return True
    return notion_update_scalar_page_property_if_present(
        page,
        prop_name,
        local_now().replace(microsecond=0).isoformat(),
        token,
    )


def notion_update_audio_render_metadata(page: Dict[str, Any], render_hash: str, token: str) -> None:
    render_hash_prop = os.getenv(NOTION_AUDIO_RENDER_HASH_PROPERTY, "Render Hash").strip() or "Render Hash"
    audio_saved_prop = os.getenv(NOTION_AUDIO_SAVED_PROPERTY, "Audio Saved").strip() or "Audio Saved"
    notion_update_scalar_page_property_if_present(page, render_hash_prop, render_hash, token)
    notion_update_audio_saved_property_if_present(page, audio_saved_prop, token)


def sync_saint_radar(
    notion_token: str,
    default_parent_database_id: str,
    default_parent_page_id: str,
    saints: Sequence[Dict[str, str]],
    openai_key: str,
    oai_base_url: str,
    oai_model: str,
) -> str:
    if not bool_env(NOTION_SAINT_RADAR_ENABLED, default=False):
        return "disabled"

    title_prop = os.getenv(NOTION_SAINT_TITLE_PROPERTY, "Name").strip() or "Name"
    feast_prop = os.getenv(NOTION_SAINT_FEAST_DAY_PROPERTY, "Feast Day").strip() or "Feast Day"
    rank_prop = os.getenv(NOTION_SAINT_CELEBRATION_PROPERTY, "Celebration Rank").strip() or "Celebration Rank"
    precedence_prop = os.getenv(NOTION_SAINT_PRECEDENCE_PROPERTY, "Precedence").strip() or "Precedence"
    background_prop = os.getenv(NOTION_SAINT_BACKGROUND_PROPERTY, "Background").strip() or "Background"
    refresh_all = bool_env(NOTION_SAINT_REFRESH_ALL, default=False)
    db_name = os.getenv(NOTION_SAINT_DATABASE_NAME, "Saint Radar").strip() or "Saint Radar"

    saint_db_id = os.getenv(NOTION_SAINT_DATABASE_ID, "").strip()
    created = False
    if not saint_db_id:
        saint_db_id = notion_find_database_id_by_name(notion_token, db_name) or ""
    if not saint_db_id:
        explicit_parent_page_id = os.getenv(NOTION_SAINT_PARENT_PAGE_ID, "").strip()
        if explicit_parent_page_id:
            parent = {"type": "page_id", "page_id": explicit_parent_page_id}
        else:
            base_db = notion_get_database(default_parent_database_id, notion_token)
            parent = base_db.get("parent") or {}
            ptype = str(parent.get("type", "")).strip()
            if ptype == "page_id" and str(parent.get("page_id", "")).strip():
                parent = {"type": "page_id", "page_id": str(parent.get("page_id", "")).strip()}
            else:
                if default_parent_page_id:
                    parent = {"type": "page_id", "page_id": default_parent_page_id}
                else:
                    raise RuntimeError(
                        "Cannot create Saint Radar database: unsupported parent type. "
                        "Set NOTION_SAINT_PARENT_PAGE_ID explicitly."
                    )
        saint_db_id = notion_create_saint_radar_database(parent, notion_token, db_name)
        created = True

    saint_db = notion_get_database(saint_db_id, notion_token)
    rank_prop = notion_resolve_property_name(saint_db, rank_prop, ["celebration rank", "celebration type"])
    precedence_prop = notion_resolve_property_name(
        saint_db, precedence_prop, ["precedence", "precendence", "rank precedence"]
    )
    background_prop = notion_resolve_property_name(saint_db, background_prop, ["background"])
    rank_prop_type = notion_property_type(saint_db, rank_prop)
    precedence_prop_type = notion_property_type(saint_db, precedence_prop)
    background_prop_type = notion_property_type(saint_db, background_prop)

    pages = notion_get_all_pages(saint_db_id, notion_token)
    existing: Dict[str, Dict[str, Any]] = {}
    for page in pages:
        if notion_page_is_archived(page):
            continue
        name = page_title(page, title_prop).strip().lower()
        day = page_date(page, feast_prop).strip()
        if name and day:
            existing[f"{day}|{name}"] = page

    upserted = 0
    regenerated = 0
    for row in saints:
        day = str(row.get("date", "")).strip()
        name = str(row.get("name", "")).strip()
        celebration_rank = str(row.get("celebration_rank", "unknown")).strip() or "unknown"
        precedence = str(row.get("precedence", "unknown")).strip() or "unknown"
        entry_kind = str(row.get("entry_kind", "saint")).strip() or "saint"
        if not day or not name:
            continue
        key = f"{day}|{name.lower()}"
        base_props = {
            title_prop: {"title": [{"type": "text", "text": {"content": name}}]},
            feast_prop: {"date": {"start": day}},
        }
        if rank_prop_type:
            base_props[rank_prop] = notion_scalar_property_value(rank_prop_type, celebration_rank)
        if precedence_prop_type:
            base_props[precedence_prop] = notion_scalar_property_value(precedence_prop_type, precedence)
        if key in existing:
            page_id = str(existing[key].get("id", "")).strip()
            if page_id:
                notion_update_page_properties(page_id, base_props, notion_token)
                if refresh_all and entry_kind == "saint":
                    devotional_payload = call_openai_saint_devotional_content(
                        api_key=openai_key,
                        base_url=oai_base_url,
                        model=oai_model,
                        saint_name=name,
                        feast_day=day,
                        celebration_type=celebration_rank,
                    )
                    notion_replace_page_blocks(
                        page_id,
                        saint_devotional_blocks(name, day, celebration_rank, devotional_payload),
                        notion_token,
                    )
                    regenerated += 1
                upserted += 1
        else:
            create_props = dict(base_props)
            if background_prop_type:
                if entry_kind == "saint":
                    create_props[background_prop] = notion_scalar_property_value(background_prop_type, "")
                else:
                    create_props[background_prop] = notion_scalar_property_value(
                        background_prop_type,
                        f"Primary liturgical celebration for {day}: {name}. Rank: {celebration_rank}. Precedence: {precedence}.",
                    )
            notion_create_page(saint_db_id, create_props, notion_token)
            if entry_kind == "saint":
                # Only saint entries need immediate block regeneration lookup.
                refreshed_pages = notion_get_all_pages(saint_db_id, notion_token)
                created_page = None
                for p in refreshed_pages:
                    if page_title(p, title_prop).strip().lower() == name.lower() and page_date(p, feast_prop).strip() == day:
                        created_page = p
                        break
                if created_page:
                    created_page_id = str(created_page.get("id", "")).strip()
                    if created_page_id:
                        devotional_payload = call_openai_saint_devotional_content(
                            api_key=openai_key,
                            base_url=oai_base_url,
                            model=oai_model,
                            saint_name=name,
                            feast_day=day,
                            celebration_type=celebration_rank,
                        )
                        notion_replace_page_blocks(
                            created_page_id,
                            saint_devotional_blocks(name, day, celebration_rank, devotional_payload),
                            notion_token,
                        )
                        regenerated += 1
            upserted += 1
    mode = "created" if created else "existing"
    return f"{mode}:{saint_db_id}:upserted={upserted}:regenerated={regenerated}:refresh_all={str(refresh_all).lower()}"


def maybe_generate_and_attach_audio(
    page: Dict[str, Any],
    prayer_text: str,
    notion_token: str,
    openai_key: str,
    oai_base_url: str,
    oai_model: str,
    saints: Sequence[Dict[str, str]],
    start_date: datetime.date,
    end_date: datetime.date,
) -> str:
    if not bool_env(NOVENA_AUDIO_ENABLED, default=False):
        return "disabled"

    page_id = str(page.get("id", "")).strip()
    if not page_id:
        raise RuntimeError("Target Notion page has no id.")

    settings = novena_audio_settings()
    caption = os.getenv(NOVENA_AUDIO_CAPTION, "Daily Novena Prayer (Audio)").strip() or "Daily Novena Prayer (Audio)"
    render_hash = compute_daily_novena_audio_render_hash(
        base_url=oai_base_url,
        settings=settings,
        saints=saints,
        start_date=start_date,
        end_date=end_date,
        oai_model=oai_model,
    )
    current_hash = notion_get_autogen_audio_render_hash(page_id, notion_token)
    if current_hash == render_hash:
        return (
            f"cached:{settings['format']}:{settings['model']}:{settings['voice']}:hash={render_hash}"
        )

    # Ensure one generated audio block per page by removing prior generated block(s).
    notion_remove_old_autogen_audio(page_id, notion_token)

    audio_bytes = generate_openai_audio_bytes(
        api_key=openai_key,
        base_url=oai_base_url,
        model=str(settings["model"]),
        voice=str(settings["voice"]),
        audio_format=str(settings["format"]),
        speed=float(settings["speed"]),
        text=prayer_text,
    )
    filename = f"daily_novena_prayer_{local_today().isoformat()}.{settings['format']}"
    content_type = audio_content_type(str(settings["format"]))
    upload_id = notion_upload_file(filename=filename, content_type=content_type, file_bytes=audio_bytes, token=notion_token)
    notion_append_audio_block(page_id, upload_id, f"{caption} {render_hash_marker(render_hash)}", notion_token)
    notion_update_audio_render_metadata(page, render_hash, notion_token)
    return f"attached:{settings['format']}:{settings['model']}:{settings['voice']}:hash={render_hash}"


def main() -> int:
    try:
        romcal_calendar = os.getenv(ROMCAL_CALENDAR, "general_roman").strip() or "general_roman"
        romcal_locale = os.getenv(ROMCAL_LOCALE, "en").strip() or "en"
        window_days = int_env(ROMCAL_WINDOW_DAYS, default=9, min_value=1, max_value=30)

        openai_key = require_env(OPENAI_API_KEY)
        oai_base_url = os.getenv(OAI_API_BASE_URL, "https://api.openai.com/v1").strip() or "https://api.openai.com/v1"
        oai_model = os.getenv(OAI_MODEL, "gpt-4.1-mini").strip() or "gpt-4.1-mini"

        notion_token = require_env(NOTION_TOKEN)
        notion_db_id = notion_find_database_id(notion_token)
        title_property = os.getenv(NOTION_TITLE_PROPERTY, "Name").strip() or "Name"
        target_row_title = (
            os.getenv(NOTION_NOVENA_ROW_TITLE, "Daily Novenas from Liturgical Calendar").strip()
            or "Daily Novenas from Liturgical Calendar"
        )
        write_daily_novena_page = bool_env(NOTION_WRITE_DAILY_NOVENA_PAGE, default=True)

        start_date = local_today()
        end_date = start_date + datetime.timedelta(days=window_days)
        saints = collect_saints_window(romcal_calendar, romcal_locale, start_date, window_days)
        if not saints:
            raise RuntimeError("No eligible devotional celebrations found from Romcal for requested date window.")
        saint_radar_rows: List[Dict[str, str]] = list(saints)
        test_saint_raw = os.getenv(NOVENA_TEST_SAINT_NAME, "").strip()
        test_saint = normalize_name_for_match(test_saint_raw)
        if test_saint and not any(
            test_saint in normalize_name_for_match(str(s.get("name", "")))
            or normalize_name_for_match(str(s.get("name", ""))) in test_saint
            for s in saints
        ):
            found = find_named_saint_feast(
                calendar=romcal_calendar,
                locale=romcal_locale,
                saint_name_query=test_saint_raw,
                search_start=start_date - datetime.timedelta(days=40),
                search_days=140,
            )
            if found:
                saints.append(found)
                saint_radar_rows.append(found)
        if bool_env(NOTION_SAINT_INCLUDE_CALENDAR_DAYS, default=False):
            calendar_rows = collect_calendar_days_window(romcal_calendar, romcal_locale, start_date, window_days)
            merged: Dict[str, Dict[str, str]] = {}
            for row in saint_radar_rows:
                key = f"{row.get('date','')}|{str(row.get('name','')).lower()}"
                merged[key] = row
            for row in calendar_rows:
                key = f"{row.get('date','')}|{str(row.get('name','')).lower()}"
                if key not in merged:
                    merged[key] = row
            saint_radar_rows = list(merged.values())

        prayer_text = ""
        if write_daily_novena_page:
            prayer_text = call_openai_litany(openai_key, oai_base_url, oai_model, saints, start_date, end_date)
            if not prayer_text.strip():
                raise RuntimeError("Generated prayer is empty.")

        readings_blocks: List[Dict[str, Any]] = []
        readings_mode = "disabled"
        extra_readings_page_ids = split_env_list(USCCB_READINGS_EXTRA_PAGE_IDS)
        extra_readings_pages_written = 0
        if bool_env(USCCB_READINGS_ENABLED, default=True):
            try:
                readings = fetch_usccb_daily_readings(start_date)
                readings_blocks = usccb_readings_blocks(readings)
                readings_mode = f"attached:{len(readings.get('sections') or [])}"
            except Exception:
                if bool_env(USCCB_READINGS_FAIL_OPEN, default=True):
                    readings_mode = "error_ignored"
                    readings_blocks = []
                else:
                    raise

        saint_radar_mode = sync_saint_radar(
            notion_token=notion_token,
            default_parent_database_id=notion_db_id,
            default_parent_page_id="",
            saints=saint_radar_rows,
            openai_key=openai_key,
            oai_base_url=oai_base_url,
            oai_model=oai_model,
        )
        main_pages = notion_get_all_pages(notion_db_id, notion_token)
        target_page: Optional[Dict[str, Any]] = None
        try:
            target_page = find_target_notion_page(
                main_pages,
                title_property,
                notion_novena_row_titles(target_row_title),
            )
        except RuntimeError:
            if write_daily_novena_page:
                raise
            target_page = None
        write_mode = "skipped"
        mirror_mode = "skipped"
        if write_daily_novena_page:
            write_mode = write_prayer_to_notion_page(
                target_page,
                prayer_text,
                notion_token,
                extra_blocks=readings_blocks,
            )
        else:
            if not bool_env(NOTION_SAINT_RADAR_ENABLED, default=False):
                raise RuntimeError(
                    f"{NOTION_WRITE_DAILY_NOVENA_PAGE}=false requires {NOTION_SAINT_RADAR_ENABLED}=true."
                )
            saint_db_id = os.getenv(NOTION_SAINT_DATABASE_ID, "").strip() or parse_saint_radar_db_id(saint_radar_mode)
            if not saint_db_id:
                raise RuntimeError("Could not resolve Saint Radar database id for daily write target.")
            saint_title_prop = os.getenv(NOTION_SAINT_TITLE_PROPERTY, "Name").strip() or "Name"
            saint_day_prop = os.getenv(NOTION_SAINT_FEAST_DAY_PROPERTY, "Feast Day").strip() or "Feast Day"
            pages = notion_get_all_pages(saint_db_id, notion_token)
            calendar_rows = collect_calendar_days_window(romcal_calendar, romcal_locale, start_date, window_days)
            calendar_by_date = build_primary_calendar_titles(calendar_rows)
            day_mode = bool_env(NOVENA_DAY_MODE, default=True)
            test_backfill = bool_env(NOVENA_TEST_POPULATE_ALL_DAYS, default=False)
            force_refresh = bool_env(NOTION_SAINT_REFRESH_ALL, default=False)
            audio_enabled = bool_env(NOVENA_AUDIO_ENABLED, default=False)
            audio_settings = novena_audio_settings() if audio_enabled else {}
            audio_truncated_outputs = 0
            if audio_enabled:
                audio_truncated_outputs = truncate_managed_novena_audio_outputs(novena_audio_library_dir())
            wrote_sections = 0
            wrote_audio = 0
            skipped_existing = 0
            payload_cached = 0
            payload_generated = 0
            library_cached = 0
            library_generated = 0
            cleanup_removed_sections = 0
            cleanup_removed_audio = 0
            today_page: Optional[Dict[str, Any]] = None

            # Keep USCCB daily readings append for today's calendar row.
            if readings_blocks:
                today_page = find_calendar_page_for_date(
                    pages=pages,
                    title_property=saint_title_prop,
                    feast_day_property=saint_day_prop,
                    target_day=start_date.isoformat(),
                    preferred_title=calendar_by_date.get(start_date.isoformat(), ""),
                )
                if today_page:
                    today_page_id = str(today_page.get("id", "")).strip()
                    if today_page_id:
                        notion_remove_autogen_markers_from_other_pages_for_day(
                            pages=pages,
                            feast_day_property=saint_day_prop,
                            target_day=start_date.isoformat(),
                            keep_page_id=today_page_id,
                            token=notion_token,
                            section_markers=[USCCB_SECTION_MARKER],
                            audio_markers=[],
                        )
                        notion_remove_old_autogen_sections_by_markers(today_page_id, notion_token, [USCCB_SECTION_MARKER])
                        notion_append_children(today_page_id, readings_blocks, notion_token)
                if extra_readings_page_ids:
                    try:
                        extra_readings_pages_written = append_usccb_readings_to_extra_pages(
                            extra_readings_page_ids,
                            readings_blocks,
                            notion_token,
                        )
                    except Exception:
                        if not bool_env(USCCB_READINGS_FAIL_OPEN, default=True):
                            raise
                        extra_readings_pages_written = 0

            if not day_mode:
                write_mode = "saint_radar_day_mode_disabled"
            else:
                cleanup_counts = cleanup_ineligible_novena_outputs(
                    pages=pages,
                    feast_day_property=saint_day_prop,
                    celebrations=calendar_rows,
                    token=notion_token,
                )
                cleanup_removed_sections = int(cleanup_counts.get("sections", 0))
                cleanup_removed_audio = int(cleanup_counts.get("audio", 0))
                for saint in saints:
                    saint_name = str(saint.get("name", "")).strip()
                    feast_iso = str(saint.get("date", "")).strip()
                    if not saint_name or not feast_iso:
                        continue
                    feast_date = date_from_iso(feast_iso)
                    prep_start = feast_date - datetime.timedelta(days=9)
                    prep_end = feast_date - datetime.timedelta(days=1)
                    target_days: List[datetime.date] = []
                    today = start_date
                    in_window_today = prep_start <= today <= prep_end
                    saint_matches_test = bool(test_saint) and (
                        test_saint in normalize_name_for_match(saint_name)
                        or normalize_name_for_match(saint_name) in test_saint
                    )
                    if saint_matches_test and test_backfill:
                        target_days = [prep_start + datetime.timedelta(days=i) for i in range(9)]
                    elif in_window_today:
                        target_days = [today]
                    if not target_days:
                        continue

                    target_jobs: List[Dict[str, Any]] = []
                    for target_day in target_days:
                        day_num = (target_day - prep_start).days + 1
                        if not (1 <= day_num <= 9):
                            continue
                        target_iso = target_day.isoformat()
                        cal_title = calendar_by_date.get(target_iso, "")
                        cal_page = find_calendar_page_for_date(
                            pages=pages,
                            title_property=saint_title_prop,
                            feast_day_property=saint_day_prop,
                            target_day=target_iso,
                            preferred_title=cal_title,
                        )
                        if not cal_page:
                            continue
                        page_id = str(cal_page.get("id", "")).strip()
                        if not page_id:
                            continue
                        marker = saint_day_marker(saint_name, target_day)
                        section_exists = notion_has_autogen_section_marker(page_id, notion_token, marker)
                        audio_marker = f"{marker}:{NOVENA_AUDIO_MARKER}"
                        if (not force_refresh) and section_exists and not audio_enabled:
                            skipped_existing += 1
                            continue

                        target_jobs.append(
                            {
                                "page": cal_page,
                                "page_id": page_id,
                                "target_day": target_day,
                                "day_num": day_num,
                                "marker": marker,
                                "audio_marker": audio_marker,
                                "needs_section": (not section_exists) or force_refresh,
                            }
                        )

                    if not target_jobs:
                        continue

                    celebration_type = str(saint.get("celebration_rank", "unknown"))
                    devotional_payload, payload_mode, _payload_path = ensure_saint_devotional_payload_cache(
                        library_root=novena_audio_library_dir(),
                        saint_name=saint_name,
                        feast_day=feast_iso,
                        celebration_type=celebration_type,
                        api_key=openai_key,
                        base_url=oai_base_url,
                        model=oai_model,
                    )
                    if payload_mode == "generated":
                        payload_generated += 1
                    else:
                        payload_cached += 1
                    library_audio: Dict[int, Dict[str, Any]] = {}
                    if audio_enabled:
                        library_audio = ensure_saint_novena_audio_library(
                            saint_name=saint_name,
                            feast_day=feast_iso,
                            celebration_type=celebration_type,
                            devotional_payload=devotional_payload,
                            settings=audio_settings,
                            api_key=openai_key,
                            base_url=oai_base_url,
                            oai_model=oai_model,
                        )
                        for day_payload in library_audio.values():
                            if str(day_payload.get("mode", "")).strip() == "generated":
                                library_generated += 1
                            else:
                                library_cached += 1
                    for job in target_jobs:
                        page = job.get("page") if isinstance(job.get("page"), dict) else {}
                        page_id = str(job.get("page_id", "")).strip()
                        target_day = job.get("target_day")
                        day_num = int(job.get("day_num", 0))
                        marker = str(job.get("marker", "")).strip()
                        audio_marker = str(job.get("audio_marker", "")).strip()
                        needs_section = bool(job.get("needs_section"))
                        if not page_id or not isinstance(target_day, datetime.date) or day_num < 1 or not marker:
                            continue
                        audio_text = ""
                        current_audio_hash = ""
                        render_hash = ""
                        audio_path: Optional[Path] = None
                        needs_audio = False
                        if audio_enabled:
                            audio_info = library_audio.get(day_num) or {}
                            audio_text = str(audio_info.get("audio_text", "")).strip()
                            render_hash = str(audio_info.get("render_hash", "")).strip()
                            audio_path = audio_info.get("audio_path") if isinstance(audio_info.get("audio_path"), Path) else None
                            current_audio_hash = notion_get_autogen_audio_render_hash(
                                page_id,
                                notion_token,
                                marker=audio_marker,
                            )
                            needs_audio = bool(render_hash and audio_path and audio_path.exists()) and (
                                force_refresh or (current_audio_hash != render_hash)
                            )
                        if not needs_section and not needs_audio:
                            skipped_existing += 1
                            continue
                        if needs_section:
                            notion_remove_autogen_markers_from_other_pages_for_day(
                                pages=pages,
                                feast_day_property=saint_day_prop,
                                target_day=target_day.isoformat(),
                                keep_page_id=page_id,
                                token=notion_token,
                                section_markers=[marker],
                                audio_markers=[audio_marker] if audio_enabled else [],
                            )
                            notion_remove_old_autogen_sections_by_markers(page_id, notion_token, [marker])
                            blocks = saint_novena_day_blocks(
                                saint_name=saint_name,
                                feast_day=feast_iso,
                                target_day=target_day,
                                day_num=day_num,
                                devotional_payload=devotional_payload,
                            )
                            notion_append_children(page_id, blocks, notion_token)
                            wrote_sections += len(blocks)

                        if needs_audio:
                            try:
                                notion_remove_autogen_markers_from_other_pages_for_day(
                                    pages=pages,
                                    feast_day_property=saint_day_prop,
                                    target_day=target_day.isoformat(),
                                    keep_page_id=page_id,
                                    token=notion_token,
                                    section_markers=[],
                                    audio_markers=[audio_marker],
                                )
                                if force_refresh:
                                    notion_remove_old_autogen_audio(page_id, notion_token, marker=audio_marker)
                                if (not force_refresh) and current_audio_hash != render_hash:
                                    notion_remove_old_autogen_audio(page_id, notion_token, marker=audio_marker)
                                if not audio_path or not audio_path.exists():
                                    raise RuntimeError(
                                        f"Missing cached novena audio file for {saint_name} day {day_num}."
                                    )
                                audio_bytes = audio_path.read_bytes()
                                filename = audio_path.name
                                content_type = audio_content_type(str(audio_settings["format"]))
                                upload_id = notion_upload_file(
                                    filename=filename,
                                    content_type=content_type,
                                    file_bytes=audio_bytes,
                                    token=notion_token,
                                )
                                notion_append_audio_block(
                                    page_id,
                                    upload_id,
                                    f"Novena Audio - {saint_name} Day {day_num} {render_hash_marker(render_hash)}",
                                    notion_token,
                                    marker=audio_marker,
                                )
                                if page:
                                    notion_update_audio_render_metadata(page, render_hash, notion_token)
                                wrote_audio += 1
                            except Exception:
                                if not bool_env(NOVENA_AUDIO_FAIL_OPEN, default=True):
                                    raise
                write_mode = (
                    f"saint_radar_novena_day_by_day:sections={wrote_sections}:audio={wrote_audio}:"
                    f"payload_cached={payload_cached}:payload_generated={payload_generated}:"
                    f"library_cached={library_cached}:library_generated={library_generated}:"
                    f"cleanup_sections={cleanup_removed_sections}:cleanup_audio={cleanup_removed_audio}:"
                    f"audio_truncated_outputs={audio_truncated_outputs}:"
                    f"skipped_existing={skipped_existing}:force_refresh={str(force_refresh).lower()}"
                )
            if target_page:
                if not today_page:
                    today_page = find_calendar_page_for_date(
                        pages=pages,
                        title_property=saint_title_prop,
                        feast_day_property=saint_day_prop,
                        target_day=start_date.isoformat(),
                        preferred_title=calendar_by_date.get(start_date.isoformat(), ""),
                    )
                if today_page:
                    mirror_mode = mirror_calendar_page_to_novena_page(target_page, today_page, notion_token)
                else:
                    mirror_mode = "calendar_page_missing"
        if readings_mode.startswith("attached:") and extra_readings_pages_written:
            readings_mode = f"{readings_mode}:extra_pages={extra_readings_pages_written}"
        audio_mode = "disabled"
        if target_page and write_daily_novena_page:
            try:
                audio_mode = maybe_generate_and_attach_audio(
                    page=target_page,
                    prayer_text=prayer_text,
                    notion_token=notion_token,
                    openai_key=openai_key,
                    oai_base_url=oai_base_url,
                    oai_model=oai_model,
                    saints=saints,
                    start_date=start_date,
                    end_date=end_date,
                )
            except Exception:
                if bool_env(NOVENA_AUDIO_FAIL_OPEN, default=True):
                    audio_mode = "error_ignored"
                else:
                    raise

        print(
            f"SUMMARY notion_db={notion_db_id} target_title={target_row_title} "
            f"saints_count={len(saints)} window_days={window_days} write_mode={write_mode} "
            f"mirror_mode={mirror_mode} audio_mode={audio_mode} readings_mode={readings_mode} "
            f"saint_radar_mode={saint_radar_mode}"
        )
        print(
            f"INFO romcal_calendar={romcal_calendar} locale={romcal_locale} "
            f"window_start={start_date.isoformat()} window_end={end_date.isoformat()}"
        )
        return 0
    except requests.HTTPError as exc:
        detail = ""
        try:
            detail = f" response={exc.response.text[:500]}"
        except Exception:
            detail = ""
        print(f"ERROR HTTP failure: {exc}{detail}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
