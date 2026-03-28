from __future__ import annotations

import datetime
import os
import re
import sys
import time
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from romcal import Romcal, get_bundled_calendar_definitions, get_bundled_resources
from romcal.types import CalendarDefinition, DayDefinition, Precedence

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

NOTION_VERSION = "2022-06-28"
NOTION_REQUEST_TIMEOUT_SECONDS = 30
NOTION_MAX_ATTEMPTS = 5
NOTION_RETRYABLE_STATUSES = {408, 409, 429, 500, 502, 503, 504}

DEFAULT_UTC_OFFSET = "-06:00"
ROMCAL_OVERLAY_SUFFIX = "__enhancement_003"
EASTER_OCTAVE_PSEUDO_RANK = "solemnity-easter octave"
SPECIAL_SUNDAY_SOLEMNITY_IDS = (
    "second_sunday_after_christmas",
    "sunday_of_the_word_of_god",
    "divine_mercy_sunday",
    "palm_sunday_of_the_passion_of_the_lord",
    "easter_sunday",
)

ROMCAL_CALENDAR = "ROMCAL_CALENDAR"
ROMCAL_LOCALE = "ROMCAL_LOCALE"
ROMCAL_WINDOW_DAYS = "ROMCAL_WINDOW_DAYS"
JOB_UTC_OFFSET = "JOB_UTC_OFFSET"

OPENAI_API_KEY = "OPENAI_API_KEY"
OAI_API_BASE_URL = "OAI_API_BASE_URL"
OAI_MODEL = "OAI_MODEL"

NOTION_TOKEN = "NOTION_TOKEN"
NOTION_DATABASE_ID = "NOTION_DATABASE_ID"
NOTION_DATABASE_NAME = "NOTION_DATABASE_NAME"

ALLOWED_DEVOTIONAL_RANKS: frozenset[str] = frozenset(
    {
        "optional_memorial",
        "memorial",
        "feast",
        "solemnity",
    }
)
EASTER_OCTAVE_PRECEDENCE_PREFIX = "Precedence.weekday_of_easter_octave_"


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


def notion_create_page(database_id: str, properties: Dict[str, Any], token: str) -> None:
    body = {"parent": {"database_id": database_id}, "properties": properties}
    notion_call("POST", "https://api.notion.com/v1/pages", token, body)


def notion_update_page_properties(page_id: str, properties: Dict[str, Any], token: str) -> None:
    notion_call("PATCH", f"https://api.notion.com/v1/pages/{page_id}", token, {"properties": properties})


def page_title(page: Dict[str, Any], title_property: str) -> str:
    props = page.get("properties") or {}
    prop = props.get(title_property) or {}
    vals = prop.get("title") or []
    if not isinstance(vals, list):
        return ""
    parts = [str(v.get("plain_text", "")).strip() for v in vals if isinstance(v, dict)]
    return " ".join(p for p in parts if p).strip()


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


def infer_precedence(event: Dict[str, Any]) -> str:
    return str(event.get("precedence", "")).strip() or "unknown"


def infer_celebration_rank(event: Dict[str, Any]) -> str:
    precedence = infer_precedence(event)
    if precedence.startswith("Precedence.weekday_of_easter_octave_"):
        return EASTER_OCTAVE_PSEUDO_RANK
    if celebration_id(event) in SPECIAL_SUNDAY_SOLEMNITY_IDS:
        return "solemnity"
    return str(event.get("rank_name", "")).strip() or str(event.get("rank", "")).strip() or "unknown"


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


def devotional_output_is_eligible(celebration_rank: str, precedence: str) -> bool:
    rank = str(celebration_rank or "").strip()
    precedence_key = str(precedence or "").strip()
    if precedence_key.startswith(EASTER_OCTAVE_PRECEDENCE_PREFIX):
        return False
    return rank in ALLOWED_DEVOTIONAL_RANKS
