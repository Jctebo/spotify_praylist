import base64
import datetime
import importlib.util
import json
import os
import random
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, NamedTuple, Optional, Tuple
from urllib.parse import urlsplit, urlunsplit

import requests
import spotipy
from spotipy.exceptions import SpotifyException

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.playlist.spotify_contracts import (
    SpotifyEpisodeLookupContract,
    SpotifyEpisodeLookupSearch,
    SpotifyPlaylistDefinition,
    SpotifyQueueContract,
    load_spotify_playlist_definitions,
    load_spotify_queue_contracts,
    normalize_spotify_contract_key as normalize_spotify_output_folder,
    normalize_spotify_queue_uri,
    playlist_definition_matches_filter,
)
from jobs.novena.liturgical_helpers import is_easter_season_for_date

TOKEN_URL = "https://accounts.spotify.com/api/token"
SCOPES_NOTE = "playlist-modify-private playlist-modify-public playlist-read-private"
NOTION_VERSION = "2022-06-28"
NOTION_REQUEST_TIMEOUT_SECONDS = 30
NOTION_MAX_ATTEMPTS = 5
NOTION_RETRYABLE_STATUSES = {408, 409, 429, 500, 502, 503, 504}

# ===== Environment variables (required) =====
SPOTIFY_CLIENT_ID = "SPOTIFY_CLIENT_ID"
SPOTIFY_CLIENT_SECRET = "SPOTIFY_CLIENT_SECRET"
SPOTIFY_REFRESH_TOKEN = "SPOTIFY_REFRESH_TOKEN"
SPOTIFY_PLAYLIST_ID = "SPOTIFY_PLAYLIST_ID"
SPOTIFY_PLAYLIST_NAME = "SPOTIFY_PLAYLIST_NAME"  # notion mode optional single-playlist filter

# Optional environment variable; only used for compatibility with existing setups.
SPOTIFY_USER_ID = "SPOTIFY_USER_ID"

# Optional selector for legacy file-mode profile config.
SPOTIFY_PLAYLIST_PROFILE = "SPOTIFY_PLAYLIST_PROFILE"  # file mode only; default morning
SPOTIFY_CONFIG_FILE = "SPOTIFY_CONFIG_FILE"  # optional, defaults to config/playlist_config.json
SPOTIFY_REFRESH_CONFIG_SOURCE = "SPOTIFY_REFRESH_CONFIG_SOURCE"  # notion|file, default notion
SPOTIFY_NOTION_SYNC_CONFIG = "SPOTIFY_NOTION_SYNC_CONFIG"  # optional, defaults to config/notion_spotify_sync_config.json
SPOTIFY_ENABLE_URI_AUTOSYNC = "SPOTIFY_ENABLE_URI_AUTOSYNC"  # default false
JOB_UTC_OFFSET = "JOB_UTC_OFFSET"  # optional override for runtime offset, e.g. -06:00

# Optional Notion URI sync.
NOTION_TOKEN = "NOTION_TOKEN"
NOTION_DATABASE_ID = "NOTION_DATABASE_ID"
NOTION_DATABASE_NAME = "NOTION_DATABASE_NAME"  # fallback search; defaults to Opus Dei
NOTION_PLAYLISTS_DATABASE_ID = "NOTION_PLAYLISTS_DATABASE_ID"  # optional explicit Spotify Playlists db id
NOTION_PLAYLISTS_DATABASE_NAME = "NOTION_PLAYLISTS_DATABASE_NAME"  # defaults to Spotify Playlists
NOTION_TITLE_PROPERTY = "NOTION_TITLE_PROPERTY"  # defaults to Name
NOTION_PLATFORM_PROPERTY = "NOTION_PLATFORM_PROPERTY"  # defaults to Platform
NOTION_PLATFORM_SPOTIFY_VALUE = "NOTION_PLATFORM_SPOTIFY_VALUE"  # defaults to spotify
NOTION_PLATFORM_NOSYNC_VALUE = "NOTION_PLATFORM_NOSYNC_VALUE"  # defaults to spotify-nosync
NOTION_URI_PROPERTY = "NOTION_URI_PROPERTY"  # defaults to URI
NOTION_URI_LOG_LIMIT = "NOTION_URI_LOG_LIMIT"  # defaults to 25
NOTION_SPOTIFY_BOOKMARKS_ENABLED = "NOTION_SPOTIFY_BOOKMARKS_ENABLED"  # default true
NOTION_SPOTIFY_EMBEDS_ENABLED = "NOTION_SPOTIFY_EMBEDS_ENABLED"  # default true
NOTION_PLAYLIST_NOVENA_LINKS_ENABLED = "NOTION_PLAYLIST_NOVENA_LINKS_ENABLED"  # default true
NOTION_PLAYLIST_NOVENA_ROW_TITLE = "NOTION_PLAYLIST_NOVENA_ROW_TITLE"  # optional explicit novena row title
NOTION_PLAYLISTS_TITLE_PROPERTY = "NOTION_PLAYLISTS_TITLE_PROPERTY"  # defaults to Name
NOTION_PLAYLISTS_ID_PROPERTY = "NOTION_PLAYLISTS_ID_PROPERTY"  # defaults to Spotify Playlist ID
NOTION_PLAYLISTS_ENABLED_PROPERTY = "NOTION_PLAYLISTS_ENABLED_PROPERTY"  # defaults to Enabled
NOTION_PLAYLISTS_SUNDAY_MATCH = "NOTION_PLAYLISTS_SUNDAY_MATCH"  # default sunday
NOTION_QUEUE_PLAYLIST_PROPERTY = "NOTION_QUEUE_PLAYLIST_PROPERTY"  # defaults to Playlist
NOTION_QUEUE_PROFILE_PROPERTY = "NOTION_QUEUE_PROFILE_PROPERTY"  # legacy alias for Playlist field
NOTION_QUEUE_ORDER_PROPERTY = "NOTION_QUEUE_ORDER_PROPERTY"  # defaults to Order
NOTION_QUEUE_RESOLVER_PROPERTY = "NOTION_QUEUE_RESOLVER_PROPERTY"  # defaults to Spotify Resolver
NOTION_QUEUE_FALLBACK_PROPERTY = "NOTION_QUEUE_FALLBACK_PROPERTY"  # defaults to Spotify Fallback Resolver
NOTION_QUEUE_ENABLED_PROPERTY = "NOTION_QUEUE_ENABLED_PROPERTY"  # defaults to Enabled
NOTION_INTENTION_PROPERTY = "NOTION_INTENTION_PROPERTY"  # defaults to Intention
NOTION_INTENTIONS_ENABLED = "NOTION_INTENTIONS_ENABLED"  # default true
NOTION_INTENTIONS_RUN_PROFILE = "NOTION_INTENTIONS_RUN_PROFILE"  # default morning
NOTION_INTENTIONS_RUN_PLAYLIST = "NOTION_INTENTIONS_RUN_PLAYLIST"  # optional playlist-name selector
NOTION_INTENTIONS_DATABASE_ID = "NOTION_INTENTIONS_DATABASE_ID"  # optional explicit Prayer Intentions db id
NOTION_INTENTIONS_DATABASE_NAME = "NOTION_INTENTIONS_DATABASE_NAME"  # default Prayer Intentions
NOTION_INTENTIONS_PETITION_PROPERTY = "NOTION_INTENTIONS_PETITION_PROPERTY"  # default Petition
NOTION_INTENTIONS_STATUS_PROPERTY = "NOTION_INTENTIONS_STATUS_PROPERTY"  # default Status
NOTION_INTENTIONS_FREQUENCY_PROPERTY = "NOTION_INTENTIONS_FREQUENCY_PROPERTY"  # default Frequency
NOTION_INTENTIONS_STATUS_ALLOWED = "NOTION_INTENTIONS_STATUS_ALLOWED"  # default praying


MARKETS_TO_TRY = ["US", None, "GB", "CA", "AU"]
MAX_BIAY_EPISODES_TO_SCAN = 2500
DEFAULT_UTC_OFFSET = "-06:00"
DEPRECATED_TIMESYNC_PLATFORM_VALUE = "spotify timesync"
RUNTIME_TZ = datetime.timezone(datetime.timedelta(hours=-6))
SPOTIFY_BOOKMARK_BASE_URL = "https://open.spotify.com"
DEFAULT_PLAYLIST_NOVENA_TITLES = (
    "Daily Novenas from Liturgical Calendar",
    "Daily Novenas from Liturgical Cakendar",
    "Daily Novena Prayer",
)
OUTPUT_FOLDER_PROPERTY = "Output Folder"


class NotionPlaylistMembership(NamedTuple):
    contract: SpotifyQueueContract
    playlist_key: str
    playlist_name: str
    order: float
    title: str
    page_id: str


class NotionPlaylistMembershipBuild(NamedTuple):
    contracts_by_playlist: Dict[str, Tuple[SpotifyQueueContract, ...]]
    stats: Dict[str, int]

DEFAULT_SHOWS = {
    "DIVINE_OFFICE": "70ydTdzunoqWAsvutFIkHM",
    "DTH": "4SYYL51uogYDtHxDPznYP1",
    "STH": "5MvuGtXFIbfej3dz8cKBVp",
    "BARRON_ROSARY": "0aWJbTYTENolXYpBDSgzcH",
    "LBS_EXEGESIS": "753FVUsio4Y6GjFvbGpvF0",
    "DAILY_MASS_READINGS": "3IANujvjklSBVf6ioZd03N",
    "DAILY_TV_MASS": "2WwFQr9a6BX7YQ4pkoIijp",
    "FRMIKE_SUNDAY": "1CK5AHgLneCo2sE17UOfdV",
    "BARRON_SUNDAY": "5G6vtvZBIQMpQ8TLgXLBiK",
    "SAINT_OF_DAY": "1skJeU3tBmO7ftJ2ugNyYd",
    "BIBLE_IN_A_YEAR": "4Pppt42NPK2XzKwNIoW7BR",
}
DEFAULT_FIXED = {
    "ANGELUS_SONG": "spotify:track:39Jgl6ST4fQj4fNyRSQZFk",
    "ANGELUS_POD": "spotify:episode:2HNK8wLRWHh0mJ9xmJjlUD",
    "DAILY_EXAMEN_LABOR": "spotify:episode:6QhBBdf8ZHx4bZu3prT59i",
    "DAILY_EXAMEN_PARENTS": "spotify:episode:14Fx8ZOSRANeKVGXuYMudc",
    "NIGHT_PRE_COMPLINE": "spotify:episode:1I8pCawzp1Wd5pE0NcHmUj",
    "FRIDAY_STATIONS": "spotify:episode:4rZ8YJKq1iuqiypu3Q5TRm",
}
DEFAULT_TOKENS: Dict[str, Any] = {
    "AUXILIUM": "Auxilium Christianorum",
    "STH_LAUDS": "Lauds",
    "DO_INVITATORY": ["Invitatory", "Invitatory Psalm"],
    "STH_VESPERS": "Vespers",
    "DO_MORNING": "Morning Prayer",
    "DO_OFFICE": "Office of Readings",
    "DO_MIDMORNING": "Midmorning Prayer",
    "DO_MIDDAY": "Midday Prayer",
    "DO_MIDAFTERNOON": "Midafternoon Prayer",
    "DO_EVENING": ["Evening Prayer", "Vespers"],
    "DO_NIGHT_ANY": ["Night Prayer", "Compline"],
}


def load_prayer_order_contract():
    contract_path = ROOT / "jobs" / "prayer_order_contract.py"
    spec = importlib.util.spec_from_file_location("playlist_prayer_order_contract", contract_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load prayer order contract at {contract_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


prayer_order_contract = load_prayer_order_contract()

def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "y", "on"}


def notion_spotify_bookmarks_enabled() -> bool:
    if os.getenv(NOTION_SPOTIFY_BOOKMARKS_ENABLED, "").strip():
        return bool_env(NOTION_SPOTIFY_BOOKMARKS_ENABLED, default=True)
    return bool_env(NOTION_SPOTIFY_EMBEDS_ENABLED, default=True)


def notion_playlist_novena_links_enabled() -> bool:
    return bool_env(NOTION_PLAYLIST_NOVENA_LINKS_ENABLED, default=True)


def load_playlist_config() -> Dict[str, Any]:
    config_path = os.getenv(SPOTIFY_CONFIG_FILE, "config/playlist_config.json").strip() or "config/playlist_config.json"
    with open(config_path, "r", encoding="utf-8") as fh:
        cfg = json.load(fh)
    if not isinstance(cfg, dict):
        raise RuntimeError(f"Invalid config format in {config_path}: root must be an object.")
    profiles = cfg.get("profiles")
    if not isinstance(profiles, dict) or not profiles:
        raise RuntimeError(f"Invalid config format in {config_path}: missing or empty 'profiles' object.")
    catalog = cfg.get("catalog")
    if not isinstance(catalog, dict) or not catalog:
        raise RuntimeError(f"Invalid config format in {config_path}: missing or empty 'catalog' object.")
    shows = cfg.get("shows")
    if not isinstance(shows, dict) or not shows:
        raise RuntimeError(f"Invalid config format in {config_path}: missing or empty 'shows' object.")
    fixed = cfg.get("fixed")
    if not isinstance(fixed, dict) or not fixed:
        raise RuntimeError(f"Invalid config format in {config_path}: missing or empty 'fixed' object.")
    tokens = cfg.get("tokens")
    if not isinstance(tokens, dict) or not tokens:
        raise RuntimeError(f"Invalid config format in {config_path}: missing or empty 'tokens' object.")
    return cfg


def load_playlist_config_optional() -> Dict[str, Any]:
    config_path = os.getenv(SPOTIFY_CONFIG_FILE, "config/playlist_config.json").strip() or "config/playlist_config.json"
    if not os.path.exists(config_path):
        return {}
    try:
        with open(config_path, "r", encoding="utf-8") as fh:
            payload = json.load(fh)
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def parse_utc_offset(offset_text: str) -> datetime.timezone:
    text = (offset_text or "").strip()
    match = re.fullmatch(r"([+-])(\d{1,2})(?::?(\d{2}))?", text)
    if not match:
        raise RuntimeError(f"Invalid utc_offset '{offset_text}'. Use format like -06:00 or +05:30.")
    sign = -1 if match.group(1) == "-" else 1
    hours = int(match.group(2))
    minutes = int(match.group(3) or "0")
    if hours > 14 or minutes > 59:
        raise RuntimeError(f"Invalid utc_offset '{offset_text}'.")
    delta = datetime.timedelta(hours=hours, minutes=minutes) * sign
    return datetime.timezone(delta)


def set_runtime_timezone(cfg: Optional[Dict[str, Any]] = None) -> None:
    global RUNTIME_TZ
    cfg_map = cfg if isinstance(cfg, dict) else {}
    raw = os.getenv(JOB_UTC_OFFSET, "").strip() or str(cfg_map.get("utc_offset", DEFAULT_UTC_OFFSET)).strip() or DEFAULT_UTC_OFFSET
    RUNTIME_TZ = parse_utc_offset(raw)


def local_now() -> datetime.datetime:
    return datetime.datetime.now(RUNTIME_TZ)


def cfg_value(cfg_map: Dict[str, Any], key: str, section: str) -> str:
    value = str(cfg_map.get(key, "")).strip()
    if not value:
        raise RuntimeError(f"Missing config value: {section}.{key}")
    return value


def cfg_token_text(tokens_cfg: Dict[str, Any], key: str) -> str:
    value = tokens_cfg.get(key)
    if isinstance(value, str):
        value = value.strip()
    if not isinstance(value, str) or not value:
        raise RuntimeError(f"Missing or invalid token: tokens.{key} (expected non-empty string).")
    return value


def cfg_token_terms(tokens_cfg: Dict[str, Any], key: str) -> Tuple[str, ...]:
    value = tokens_cfg.get(key)
    if isinstance(value, str):
        token = value.strip()
        if token:
            return (token,)
    if isinstance(value, (list, tuple)):
        terms = [str(v).strip() for v in value if str(v).strip()]
        if terms:
            return tuple(terms)
    raise RuntimeError(f"Missing or invalid token: tokens.{key} (expected string or non-empty list of strings).")


def refresh_access_token(client_id: str, client_secret: str, refresh_token: str) -> str:
    basic = base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("utf-8")
    headers = {
        "Authorization": f"Basic {basic}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    response = requests.post(TOKEN_URL, headers=headers, data=data, timeout=30)
    response.raise_for_status()
    payload = response.json()
    token = str(payload.get("access_token", "")).strip()
    if not token:
        raise RuntimeError("Token refresh succeeded but no access_token was returned.")
    return token


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


def notion_find_database_id(token: str, database_name: str) -> Optional[str]:
    body = {"query": database_name, "filter": {"value": "database", "property": "object"}}
    data = notion_call("POST", "https://api.notion.com/v1/search", token, body)
    results = data.get("results") or []
    for item in results:
        if not isinstance(item, dict):
            continue
        title = ""
        title_parts = item.get("title") or []
        if isinstance(title_parts, list) and title_parts:
            title = str((title_parts[0] or {}).get("plain_text", "")).strip()
        if title.lower() == database_name.lower():
            db_id = str(item.get("id", "")).strip()
            if db_id:
                return db_id
    for item in results:
        if not isinstance(item, dict):
            continue
        db_id = str(item.get("id", "")).strip()
        if db_id:
            return db_id
    return None


def notion_get_all_pages(database_id: str, token: str) -> List[Dict[str, Any]]:
    pages: List[Dict[str, Any]] = []
    next_cursor: Optional[str] = None
    while True:
        body: Dict[str, Any] = {"page_size": 100}
        if next_cursor:
            body["start_cursor"] = next_cursor
        data = notion_call("POST", f"https://api.notion.com/v1/databases/{database_id}/query", token, body)
        for result in (data.get("results") or []):
            if isinstance(result, dict):
                pages.append(result)
        if not data.get("has_more"):
            break
        next_cursor = str(data.get("next_cursor", "")).strip() or None
    return pages


def notion_list_block_children(block_id: str, token: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    next_cursor: Optional[str] = None
    while True:
        params = "page_size=100"
        if next_cursor:
            params += f"&start_cursor={next_cursor}"
        data = notion_call("GET", f"https://api.notion.com/v1/blocks/{block_id}/children?{params}", token)
        for row in data.get("results") or []:
            if isinstance(row, dict):
                out.append(row)
        if not data.get("has_more"):
            break
        next_cursor = str(data.get("next_cursor", "")).strip() or None
    return out


def notion_archive_block(block_id: str, token: str) -> None:
    notion_call("PATCH", f"https://api.notion.com/v1/blocks/{block_id}", token, {"archived": True})


def notion_append_children(
    parent_id: str,
    children: List[Dict[str, Any]],
    token: str,
    position: str = "end",
    after: str = "",
) -> Dict[str, Any]:
    if not children:
        return {}
    body: Dict[str, Any] = {"children": list(children)}
    if after:
        body["after"] = str(after).strip()
    elif position == "start":
        body["position"] = {"type": "start"}
    return notion_call("PATCH", f"https://api.notion.com/v1/blocks/{parent_id}/children", token, body)


def notion_update_bookmark_block(block_id: str, url: str, token: str, caption: str = "") -> None:
    bookmark_payload: Dict[str, Any] = {"url": str(url or "").strip()}
    value = str(caption or "").strip()[:2000]
    bookmark_payload["caption"] = [{"type": "text", "text": {"content": value}}] if value else []
    notion_call("PATCH", f"https://api.notion.com/v1/blocks/{block_id}", token, {"bookmark": bookmark_payload})


def notion_bookmark_block_payload(url: str, caption: str = "") -> Dict[str, Any]:
    bookmark_payload: Dict[str, Any] = {"url": str(url or "").strip()}
    value = str(caption or "").strip()[:2000]
    if value:
        bookmark_payload["caption"] = [{"type": "text", "text": {"content": value}}]
    return {"object": "block", "type": "bookmark", "bookmark": bookmark_payload}


def notion_append_bookmark_block(
    parent_id: str,
    url: str,
    token: str,
    caption: str = "",
    position: str = "end",
    after: str = "",
) -> str:
    response = notion_append_children(
        parent_id,
        [notion_bookmark_block_payload(url, caption)],
        token,
        position=position,
        after=after,
    )
    results = response.get("results") if isinstance(response, dict) else []
    if isinstance(results, list) and results:
        first = results[0]
        if isinstance(first, dict):
            return str(first.get("id", "")).strip()
    return ""


def block_bookmark_url(block: Dict[str, Any]) -> str:
    if str(block.get("type", "")).strip() != "bookmark":
        return ""
    return str((block.get("bookmark") or {}).get("url", "")).strip()


def block_bookmark_caption(block: Dict[str, Any]) -> str:
    if str(block.get("type", "")).strip() != "bookmark":
        return ""
    vals = (block.get("bookmark") or {}).get("caption") or []
    parts = [str(v.get("plain_text", "")).strip() for v in vals if isinstance(v, dict) and v.get("plain_text")]
    return " ".join(parts).strip()


def block_link_to_page_id(block: Dict[str, Any]) -> str:
    if str(block.get("type", "")).strip() != "link_to_page":
        return ""
    payload = block.get("link_to_page") or {}
    if str(payload.get("type", "")).strip() != "page_id":
        return ""
    return str(payload.get("page_id", "")).strip()


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", text.lower())).strip()


def token_set(text: str) -> set:
    return {tok for tok in normalize_text(text).split(" ") if tok and len(tok) > 2}


def page_title(page: Dict[str, Any], title_property: str) -> str:
    props = page.get("properties") or {}
    prop = props.get(title_property) or {}
    title = prop.get("title") or []
    if not isinstance(title, list):
        return ""
    parts: List[str] = []
    for item in title:
        if isinstance(item, dict):
            plain = str(item.get("plain_text", "")).strip()
            if plain:
                parts.append(plain)
    return " ".join(parts).strip()


def page_property_obj(page: Dict[str, Any], property_name: str) -> Dict[str, Any]:
    props = page.get("properties") or {}
    prop = props.get(property_name)
    if isinstance(prop, dict):
        return prop
    # Fallback to case-insensitive match for resilient Notion schema changes.
    target = str(property_name or "").strip().lower()
    if not target:
        return {}
    for key, value in props.items():
        if str(key).strip().lower() == target and isinstance(value, dict):
            return value
    return {}


def page_property_text(page: Dict[str, Any], property_name: str) -> str:
    prop = page_property_obj(page, property_name)
    ptype = str(prop.get("type", "")).strip()
    if ptype == "status":
        status = prop.get("status") or {}
        return str(status.get("name", "")).strip()
    if ptype == "select":
        sel = prop.get("select") or {}
        return str(sel.get("name", "")).strip()
    if ptype == "multi_select":
        vals = prop.get("multi_select") or []
        return " ".join(str(v.get("name", "")).strip() for v in vals if isinstance(v, dict)).strip()
    if ptype == "rich_text":
        vals = prop.get("rich_text") or []
        return " ".join(str(v.get("plain_text", "")).strip() for v in vals if isinstance(v, dict)).strip()
    if ptype == "title":
        vals = prop.get("title") or []
        return " ".join(str(v.get("plain_text", "")).strip() for v in vals if isinstance(v, dict)).strip()
    if ptype == "url":
        return str(prop.get("url", "")).strip()
    return ""


def page_property_values(page: Dict[str, Any], property_name: str) -> List[str]:
    prop = page_property_obj(page, property_name)
    ptype = str(prop.get("type", "")).strip()
    if ptype == "status":
        status = str((prop.get("status") or {}).get("name", "")).strip()
        return [status] if status else []
    if ptype == "select":
        value = str((prop.get("select") or {}).get("name", "")).strip()
        return [value] if value else []
    if ptype == "multi_select":
        values = [str(v.get("name", "")).strip() for v in (prop.get("multi_select") or []) if isinstance(v, dict)]
        return [value for value in values if value]
    if ptype in {"rich_text", "title"}:
        values = prop.get(ptype) or []
        joined = " ".join(str(v.get("plain_text", "")).strip() for v in values if isinstance(v, dict)).strip()
        return [joined] if joined else []
    if ptype == "url":
        value = str(prop.get("url", "")).strip()
        return [value] if value else []
    return []


def page_property_number(page: Dict[str, Any], property_name: str) -> Optional[float]:
    def to_float(value: Any) -> Optional[float]:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        text = str(value).strip()
        if not text:
            return None
        match = re.search(r"[-+]?\d+(?:\.\d+)?", text)
        if not match:
            return None
        try:
            return float(match.group(0))
        except Exception:
            return None

    prop = page_property_obj(page, property_name)
    ptype = str(prop.get("type", "")).strip()
    if ptype == "number":
        return to_float(prop.get("number"))
    if ptype == "formula":
        formula = prop.get("formula") or {}
        ftype = str(formula.get("type", "")).strip()
        if ftype == "number":
            return to_float(formula.get("number"))
        if ftype == "string":
            return to_float(formula.get("string"))
    if ptype in {"rich_text", "title"}:
        values = prop.get(ptype) or []
        parts = [str(v.get("plain_text", "")).strip() for v in values if isinstance(v, dict)]
        return to_float(" ".join(p for p in parts if p))
    if ptype == "select":
        sel = prop.get("select") or {}
        return to_float(sel.get("name"))
    if ptype == "multi_select":
        values = prop.get("multi_select") or []
        names = [str(v.get("name", "")).strip() for v in values if isinstance(v, dict)]
        return to_float(" ".join(n for n in names if n))
    if ptype == "rollup":
        roll = prop.get("rollup") or {}
        rtype = str(roll.get("type", "")).strip()
        if rtype == "number":
            return to_float(roll.get("number"))
        if rtype == "array":
            arr = roll.get("array") or []
            nums: List[float] = []
            for item in arr:
                if isinstance(item, dict):
                    item_type = str(item.get("type", "")).strip()
                    if item_type == "number":
                        value = to_float(item.get("number"))
                        if value is not None:
                            nums.append(value)
            if nums:
                return min(nums)
    return None


def page_property_checkbox(page: Dict[str, Any], property_name: str) -> Optional[bool]:
    prop = page_property_obj(page, property_name)
    ptype = str(prop.get("type", "")).strip()
    if ptype != "checkbox":
        return None
    return bool(prop.get("checkbox"))


def page_uri_value(page: Dict[str, Any], uri_property: str) -> Optional[str]:
    prop = page_property_obj(page, uri_property)
    ptype = str(prop.get("type", "")).strip()
    if ptype == "rich_text":
        vals = prop.get("rich_text") or []
        parts = [str(v.get("plain_text", "")).strip() for v in vals if isinstance(v, dict) and v.get("plain_text")]
        return " ".join(parts).strip() or None
    if ptype == "url":
        value = str(prop.get("url", "")).strip()
        return value or None
    return None


def normalize_spotify_playlist_id(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    match = re.fullmatch(r"spotify:playlist:([A-Za-z0-9]+)", raw, flags=re.IGNORECASE)
    if match:
        return match.group(1)
    match = re.search(r"open\.spotify\.com/playlist/([A-Za-z0-9]+)(?:[/?].*)?$", raw, flags=re.IGNORECASE)
    if match:
        return match.group(1)
    if re.fullmatch(r"[A-Za-z0-9]+", raw):
        return raw
    return ""


def spotify_value_to_bookmark_parts(value: str) -> Optional[Tuple[str, str, str]]:
    raw = str(value or "").strip()
    if not raw:
        return None
    match = re.fullmatch(r"spotify:([a-z]+):([A-Za-z0-9]+)", raw, flags=re.IGNORECASE)
    if match:
        return match.group(1).lower(), match.group(2), ""
    try:
        parsed = urlsplit(raw)
    except Exception:
        return None
    host = str(parsed.netloc or "").strip().lower()
    if host not in {"open.spotify.com", "play.spotify.com"}:
        return None
    parts = [part for part in str(parsed.path or "").split("/") if part]
    if len(parts) >= 3 and str(parts[0]).strip().lower() == "embed":
        parts = parts[1:]
    if len(parts) < 2:
        return None
    kind = str(parts[0]).strip().lower()
    spotify_id = str(parts[1]).strip()
    if not re.fullmatch(r"[a-z]+", kind) or not re.fullmatch(r"[A-Za-z0-9]+", spotify_id):
        return None
    return kind, spotify_id, str(parsed.query or "")


def spotify_value_to_bookmark_url(value: str) -> Optional[str]:
    parts = spotify_value_to_bookmark_parts(value)
    if not parts:
        return None
    kind, spotify_id, query = parts
    if query:
        return urlunsplit(("https", "open.spotify.com", f"/{kind}/{spotify_id}", query, ""))
    return f"{SPOTIFY_BOOKMARK_BASE_URL}/{kind}/{spotify_id}"


def spotify_value_to_bookmark_compare_url(value: str) -> Optional[str]:
    parts = spotify_value_to_bookmark_parts(value)
    if not parts:
        return None
    kind, spotify_id, _ = parts
    return f"{SPOTIFY_BOOKMARK_BASE_URL}/{kind}/{spotify_id}"


def spotify_bookmark_caption(sp: spotipy.Spotify, value: str, fallback: str = "") -> str:
    parts = spotify_value_to_bookmark_parts(value)
    if not parts:
        return str(fallback or "").strip()[:2000]
    kind, spotify_id, _ = parts

    payload: Optional[Dict[str, Any]] = None
    if kind == "episode":
        payload = safe_call(sp.episode, spotify_id)
    elif kind == "track":
        payload = safe_call(sp.track, spotify_id)
    elif kind == "show":
        payload = safe_call(sp.show, spotify_id)
    elif kind == "album":
        payload = safe_call(sp.album, spotify_id)
    elif kind == "artist":
        payload = safe_call(sp.artist, spotify_id)
    elif kind == "playlist":
        payload = safe_call(sp.playlist, spotify_id, fields="name")

    if isinstance(payload, dict):
        name = str(payload.get("name", "")).strip()
        if name:
            return name[:2000]
    return str(fallback or "").strip()[:2000]


def spotify_value_to_embed_url(value: str) -> Optional[str]:
    return spotify_value_to_bookmark_url(value)


def block_spotify_link_url(block: Dict[str, Any]) -> str:
    block_type = str(block.get("type", "")).strip()
    if block_type == "bookmark":
        return str((block.get("bookmark") or {}).get("url", "")).strip()
    if block_type == "embed":
        return str((block.get("embed") or {}).get("url", "")).strip()
    return ""


def notion_sync_spotify_bookmark(
    page_id: str,
    bookmark_url: Optional[str],
    token: str,
    caption: str = "",
    playlist_url: str = "",
    playlist_caption: str = "",
) -> Tuple[bool, bool]:
    desired_url = spotify_value_to_bookmark_url(bookmark_url or "") or ""
    desired_compare_url = spotify_value_to_bookmark_compare_url(bookmark_url or "") or ""
    desired_caption = str(caption or "").strip()[:2000]
    desired_playlist_url = spotify_value_to_bookmark_url(playlist_url or "") or ""
    desired_playlist_compare_url = spotify_value_to_bookmark_compare_url(playlist_url or "") or ""
    desired_playlist_caption = str(playlist_caption or "").strip()[:2000]
    if desired_playlist_compare_url and desired_playlist_compare_url == desired_compare_url:
        desired_playlist_url = ""
        desired_playlist_compare_url = ""
        desired_playlist_caption = ""
    blocks = notion_list_block_children(page_id, token)

    spotify_blocks: List[Dict[str, str]] = []
    for block in blocks:
        raw_url = block_spotify_link_url(block) or ""
        parts = spotify_value_to_bookmark_parts(raw_url)
        compare_url = spotify_value_to_bookmark_compare_url(raw_url) or ""
        if not compare_url or not parts:
            continue
        block_id = str(block.get("id", "")).strip()
        if block_id:
            spotify_blocks.append(
                {
                    "id": block_id,
                    "type": str(block.get("type", "")).strip(),
                    "url": str(raw_url).strip(),
                    "compare_url": compare_url,
                    "caption": block_bookmark_caption(block),
                    "slot": "playlist" if parts[0] == "playlist" else "primary",
                }
            )

    primary_blocks = [block for block in spotify_blocks if block.get("slot") == "primary"]
    playlist_blocks = [block for block in spotify_blocks if block.get("slot") == "playlist"]

    def sync_slot(
        existing_blocks: List[Dict[str, str]],
        desired_slot_url: str,
        desired_slot_compare_url: str,
        desired_slot_caption: str,
        *,
        position: str = "end",
        after: str = "",
    ) -> Tuple[bool, bool, str]:
        if not desired_slot_url:
            removed = False
            for block in existing_blocks:
                notion_archive_block(block["id"], token)
                removed = True
            return False, removed, ""

        primary = existing_blocks[0] if existing_blocks else {}
        primary_type = primary.get("type", "")
        primary_url = primary.get("url", "")
        primary_compare_url = primary.get("compare_url", "")
        primary_caption = primary.get("caption", "")

        final_slot_url = desired_slot_url
        if primary_type == "bookmark" and primary_compare_url == desired_slot_compare_url:
            # Keep an existing richer Spotify share URL when it resolves to the same item.
            final_slot_url = primary_url or desired_slot_url

        if (
            len(existing_blocks) == 1
            and primary_type == "bookmark"
            and primary_compare_url == desired_slot_compare_url
            and primary_caption == desired_slot_caption
            and primary_url == final_slot_url
        ):
            return False, False, primary.get("id", "")

        if primary_type == "bookmark" and primary.get("id", ""):
            notion_update_bookmark_block(primary["id"], final_slot_url, token, desired_slot_caption)
            for extra_block in existing_blocks[1:]:
                notion_archive_block(extra_block["id"], token)
            return True, False, primary["id"]

        for block in existing_blocks:
            notion_archive_block(block["id"], token)
        block_id = notion_append_bookmark_block(
            page_id,
            final_slot_url,
            token,
            desired_slot_caption,
            position=position,
            after=after,
        )
        return True, False, block_id

    primary_changed, primary_removed, primary_block_id = sync_slot(
        primary_blocks,
        desired_url,
        desired_compare_url,
        desired_caption,
        position="start",
    )
    playlist_changed, playlist_removed, _ = sync_slot(
        playlist_blocks,
        desired_playlist_url if desired_url else "",
        desired_playlist_compare_url if desired_url else "",
        desired_playlist_caption,
        position="start" if not primary_block_id else "end",
        after=primary_block_id,
    )
    return primary_changed or playlist_changed, primary_removed or playlist_removed


def notion_sync_spotify_embed(page_id: str, embed_url: Optional[str], token: str) -> Tuple[bool, bool]:
    return notion_sync_spotify_bookmark(page_id, embed_url, token)


def notion_update_uri(page_id: str, page: Dict[str, Any], uri_property: str, uri: str, token: str) -> None:
    prop = page_property_obj(page, uri_property)
    ptype = str(prop.get("type", "")).strip()
    if ptype == "url":
        body = {"properties": {uri_property: {"url": uri}}}
    else:
        body = {"properties": {uri_property: {"rich_text": [{"type": "text", "text": {"content": uri[:2000]}}]}}}
    notion_call("PATCH", f"https://api.notion.com/v1/pages/{page_id}", token, body)


def notion_update_text_property(page_id: str, page: Dict[str, Any], property_name: str, text: str, token: str) -> bool:
    prop = page_property_obj(page, property_name)
    ptype = str(prop.get("type", "")).strip()
    value = str(text or "").strip()
    if ptype == "rich_text":
        body = {
            "properties": {
                property_name: {
                    "rich_text": [{"type": "text", "text": {"content": value[:2000]}}] if value else []
                }
            }
        }
    elif ptype == "title":
        body = {
            "properties": {
                property_name: {"title": [{"type": "text", "text": {"content": value[:2000]}}] if value else []}
            }
        }
    elif ptype == "select":
        body = {"properties": {property_name: {"select": {"name": value} if value else None}}}
    elif ptype == "url":
        body = {"properties": {property_name: {"url": value if value.startswith("http") else None}}}
    else:
        # Unknown property type.
        return False
    notion_call("PATCH", f"https://api.notion.com/v1/pages/{page_id}", token, body)
    return True


def notion_update_checkbox_property(page_id: str, property_name: str, value: bool, token: str) -> None:
    body = {"properties": {property_name: {"checkbox": bool(value)}}}
    notion_call("PATCH", f"https://api.notion.com/v1/pages/{page_id}", token, body)


def parse_csv_values(text: str) -> List[str]:
    raw = str(text or "").strip()
    if not raw:
        return []
    out: List[str] = []
    for part in re.split(r"[,;|]+", raw):
        norm = normalize_text(part)
        if norm and norm not in out:
            out.append(norm)
    return out


def page_property_normalized_values(page: Dict[str, Any], property_name: str) -> List[str]:
    out: List[str] = []
    for value in page_property_values(page, property_name):
        for norm in parse_csv_values(value):
            if norm and norm not in out:
                out.append(norm)
    return out


def notion_playlist_membership_database_id(token: str) -> str:
    database_id = os.getenv(NOTION_DATABASE_ID, "").strip()
    if database_id:
        return database_id
    db_name = os.getenv(NOTION_DATABASE_NAME, "Opus Dei").strip() or "Opus Dei"
    database_id = notion_find_database_id(token, db_name) or ""
    if not database_id:
        raise RuntimeError("Notion database not found. Set NOTION_DATABASE_ID or share database with integration.")
    return database_id


def _page_debug_id(page: Dict[str, Any]) -> str:
    return str(page.get("id", "")).strip() or "unknown_page"


def build_notion_playlist_memberships(
    token: str,
    contracts: List[SpotifyQueueContract],
    playlist_definitions: List[SpotifyPlaylistDefinition],
) -> NotionPlaylistMembershipBuild:
    database_id = notion_playlist_membership_database_id(token)
    title_property = os.getenv(NOTION_TITLE_PROPERTY, "Name").strip() or "Name"
    order_property = os.getenv(NOTION_QUEUE_ORDER_PROPERTY, "Order").strip() or "Order"
    enabled_property = os.getenv(NOTION_QUEUE_ENABLED_PROPERTY, "Enabled").strip() or "Enabled"
    output_folder_property = OUTPUT_FOLDER_PROPERTY

    pages = notion_get_all_pages(database_id, token)
    checked_pages_by_title: Dict[str, List[Dict[str, Any]]] = {}
    ignored_non_enabled_rows = 0
    for page in pages:
        if page_property_checkbox(page, enabled_property) is not True:
            ignored_non_enabled_rows += 1
            continue
        title = page_title(page, title_property).strip()
        if title:
            checked_pages_by_title.setdefault(title, []).append(page)

    playlists_by_folder: Dict[str, SpotifyPlaylistDefinition] = {}
    for definition in playlist_definitions:
        for value in (definition.key, definition.name):
            folder_key = normalize_spotify_output_folder(value)
            if folder_key:
                playlists_by_folder[folder_key] = definition

    memberships_by_playlist: Dict[str, List[NotionPlaylistMembership]] = {
        definition.key: [] for definition in playlist_definitions
    }
    inactive_contracts = 0
    ignored_missing_output_folder_rows = 0
    matched_rows = 0
    for contract in contracts:
        matching_pages = checked_pages_by_title.get(contract.notion_name, [])
        if not matching_pages:
            inactive_contracts += 1
            continue
        if len(matching_pages) > 1:
            page_ids = ", ".join(_page_debug_id(page) for page in matching_pages)
            raise RuntimeError(
                f"Multiple checked Notion rows match Spotify contract notion_name "
                f"'{contract.notion_name}' (pages: {page_ids})."
            )

        page = matching_pages[0]
        output_folder_values = page_property_normalized_values(page, output_folder_property)
        raw_output_folder = page_property_text(page, output_folder_property).strip()
        if not output_folder_values:
            ignored_missing_output_folder_rows += 1
            continue
        if len(output_folder_values) > 1:
            raise RuntimeError(
                f"Spotify row '{contract.notion_name}' has multiple '{output_folder_property}' values: "
                f"{raw_output_folder or ', '.join(output_folder_values)}."
            )

        playlist_definition = playlists_by_folder.get(output_folder_values[0])
        if not playlist_definition:
            raise RuntimeError(
                f"Spotify row '{contract.notion_name}' has unknown '{output_folder_property}' value "
                f"'{raw_output_folder or output_folder_values[0]}'."
            )

        order_value = prayer_order_contract.parse_top_level_order(page_property_number(page, order_property))
        if order_value is None:
            raise RuntimeError(f"Spotify row '{contract.notion_name}' is missing '{order_property}'.")

        memberships_by_playlist[playlist_definition.key].append(
            NotionPlaylistMembership(
                contract=contract,
                playlist_key=playlist_definition.key,
                playlist_name=playlist_definition.name,
                order=order_value,
                title=contract.notion_name,
                page_id=_page_debug_id(page),
            )
        )
        matched_rows += 1

    ordered_contracts_by_playlist: Dict[str, Tuple[SpotifyQueueContract, ...]] = {}
    for playlist_key, memberships in memberships_by_playlist.items():
        memberships.sort(
            key=lambda membership: (
                membership.order,
                normalize_spotify_output_folder(membership.contract.notion_name),
                membership.contract.key,
            )
        )
        ordered_contracts_by_playlist[playlist_key] = tuple(membership.contract for membership in memberships)

    return NotionPlaylistMembershipBuild(
        contracts_by_playlist=ordered_contracts_by_playlist,
        stats={
            "notion_rows": len(pages),
            "checked_rows": sum(len(rows) for rows in checked_pages_by_title.values()),
            "ignored_non_enabled_rows": ignored_non_enabled_rows,
            "ignored_missing_output_folder_rows": ignored_missing_output_folder_rows,
            "matched_rows": matched_rows,
            "inactive_contracts": inactive_contracts,
        },
    )


def env_normalized_values(name: str, default: str) -> List[str]:
    raw = os.getenv(name, default).strip() or default
    values = parse_csv_values(raw)
    return values or parse_csv_values(default)


def page_has_any_normalized_value(page: Dict[str, Any], property_name: str, wanted_values: List[str]) -> bool:
    if not wanted_values:
        return False
    values = set(page_property_normalized_values(page, property_name))
    raw = normalize_text(page_property_text(page, property_name))
    for wanted in wanted_values:
        if wanted in values:
            return True
        if raw and wanted in raw:
            return True
    return False


def resolve_notion_playlist_property_name() -> str:
    explicit = os.getenv(NOTION_QUEUE_PLAYLIST_PROPERTY, "").strip()
    if explicit:
        return explicit
    legacy = os.getenv(NOTION_QUEUE_PROFILE_PROPERTY, "").strip()
    if legacy:
        return legacy
    return "Playlist"


def sunday_match_tokens() -> set[str]:
    sunday_match = normalize_text(os.getenv(NOTION_PLAYLISTS_SUNDAY_MATCH, "sunday").strip() or "sunday")
    return {token for token in sunday_match.split(" ") if token} or {"sunday"}


def notion_playlist_novena_titles() -> List[str]:
    explicit = os.getenv(NOTION_PLAYLIST_NOVENA_ROW_TITLE, "").strip()
    titles = [explicit] if explicit else []
    titles.extend(DEFAULT_PLAYLIST_NOVENA_TITLES)
    out: List[str] = []
    seen = set()
    for title in titles:
        norm = normalize_text(title)
        if norm and norm not in seen:
            seen.add(norm)
            out.append(title)
    return out


def find_playlist_novena_page(token: str) -> Optional[Dict[str, Any]]:
    database_id = os.getenv(NOTION_DATABASE_ID, "").strip()
    if not database_id:
        db_name = os.getenv(NOTION_DATABASE_NAME, "Opus Dei").strip() or "Opus Dei"
        database_id = notion_find_database_id(token, db_name) or ""
    if not database_id:
        return None
    title_property = os.getenv(NOTION_TITLE_PROPERTY, "Name").strip() or "Name"
    pages = notion_get_all_pages(database_id, token)
    wanted = {normalize_text(title) for title in notion_playlist_novena_titles()}
    for page in pages:
        title = page_title(page, title_property).strip()
        if normalize_text(title) in wanted:
            return page
    return None


def notion_sync_playlist_novena_link(
    playlist_page_id: str,
    target_page_id: str,
    target_page_url: str,
    token: str,
) -> bool:
    blocks = notion_list_block_children(playlist_page_id, token)
    matching_block_ids: List[str] = []
    first_is_target_bookmark = False
    for idx, block in enumerate(blocks):
        link_page_id = block_link_to_page_id(block)
        bookmark_url = block_bookmark_url(block)
        matches_target = bool(
            (target_page_id and link_page_id == target_page_id)
            or (target_page_url and bookmark_url.strip() == target_page_url.strip())
        )
        if idx == 0 and target_page_url and bookmark_url.strip() == target_page_url.strip():
            first_is_target_bookmark = True
        if matches_target:
            block_id = str(block.get("id", "")).strip()
            if block_id:
                matching_block_ids.append(block_id)

    if len(matching_block_ids) == 1 and first_is_target_bookmark:
        return False

    for block_id in matching_block_ids:
        notion_archive_block(block_id, token)
    notion_append_children(
        playlist_page_id,
        [
            {
                "object": "block",
                "type": "bookmark",
                "bookmark": {"url": target_page_url},
            }
        ],
        token,
        position="start",
    )
    return True


def sync_notion_playlist_novena_links(token: str) -> Tuple[int, List[str]]:
    if not notion_playlist_novena_links_enabled():
        return 0, []

    target_page = find_playlist_novena_page(token)
    if not target_page:
        return 0, []
    target_page_id = str(target_page.get("id", "")).strip()
    target_page_url = str(target_page.get("url", "")).strip()
    if not target_page_id:
        return 0, []

    database_id = os.getenv(NOTION_PLAYLISTS_DATABASE_ID, "").strip()
    if not database_id:
        db_name = os.getenv(NOTION_PLAYLISTS_DATABASE_NAME, "Spotify Playlists").strip() or "Spotify Playlists"
        database_id = notion_find_database_id(token, db_name) or ""
    if not database_id:
        return 0, []

    title_property = os.getenv(NOTION_PLAYLISTS_TITLE_PROPERTY, "Name").strip() or "Name"
    enabled_property = os.getenv(NOTION_PLAYLISTS_ENABLED_PROPERTY, "Enabled").strip() or "Enabled"
    updated = 0
    updated_names: List[str] = []
    for row in notion_get_all_pages(database_id, token):
        enabled = page_property_checkbox(row, enabled_property)
        if enabled is False:
            continue
        page_id = str(row.get("id", "")).strip()
        if not page_id:
            continue
        playlist_name = page_title(row, title_property).strip() or page_property_text(row, title_property).strip() or page_id
        if notion_sync_playlist_novena_link(page_id, target_page_id, target_page_url, token):
            updated += 1
            updated_names.append(playlist_name)
    return updated, updated_names


def load_notion_playlists(token: str, playlist_filter: str = "") -> List[Dict[str, str]]:
    database_id = os.getenv(NOTION_PLAYLISTS_DATABASE_ID, "").strip()
    if not database_id:
        db_name = os.getenv(NOTION_PLAYLISTS_DATABASE_NAME, "Spotify Playlists").strip() or "Spotify Playlists"
        database_id = notion_find_database_id(token, db_name) or ""
    if not database_id:
        raise RuntimeError(
            "Notion playlists database not found. Set NOTION_PLAYLISTS_DATABASE_ID or share the playlists database with the integration."
        )

    title_property = os.getenv(NOTION_PLAYLISTS_TITLE_PROPERTY, "Name").strip() or "Name"
    playlist_id_property = os.getenv(NOTION_PLAYLISTS_ID_PROPERTY, "Spotify Playlist ID").strip() or "Spotify Playlist ID"
    enabled_property = os.getenv(NOTION_PLAYLISTS_ENABLED_PROPERTY, "Enabled").strip() or "Enabled"
    playlist_filter_norm = normalize_text(playlist_filter)

    rows = notion_get_all_pages(database_id, token)
    out: List[Dict[str, str]] = []
    seen_names = set()
    for row in rows:
        enabled = page_property_checkbox(row, enabled_property)
        if enabled is False:
            continue
        playlist_name = page_title(row, title_property).strip() or page_property_text(row, title_property).strip()
        if not playlist_name:
            continue
        playlist_name_norm = normalize_text(playlist_name)
        if playlist_filter_norm and playlist_name_norm != playlist_filter_norm:
            continue
        if playlist_name_norm in seen_names:
            raise RuntimeError(f"Duplicate enabled playlist row for '{playlist_name}'.")
        raw_id = (page_uri_value(row, playlist_id_property) or page_property_text(row, playlist_id_property) or "").strip()
        playlist_id = normalize_spotify_playlist_id(raw_id)
        if not playlist_id:
            raise RuntimeError(f"Enabled playlist '{playlist_name}' is missing '{playlist_id_property}'.")
        seen_names.add(playlist_name_norm)
        out.append({"name": playlist_name, "playlist_id": playlist_id})
    out.sort(key=lambda row: normalize_text(row["name"]))
    if playlist_filter_norm and not out:
        raise RuntimeError(f"No enabled playlist named '{playlist_filter}' found in the Notion playlists database.")
    return out


def weighted_shuffle_indices(weights: List[float], rng: random.Random) -> List[int]:
    keyed: List[Tuple[float, int]] = []
    for idx, weight in enumerate(weights):
        w = max(0.0001, float(weight))
        key = rng.random() ** (1.0 / w)
        keyed.append((key, idx))
    keyed.sort(key=lambda x: x[0], reverse=True)
    return [idx for _, idx in keyed]


def distribute_prayer_intentions(playlist_name: str) -> Tuple[int, int, int]:
    if not bool_env(NOTION_INTENTIONS_ENABLED, default=True):
        print("INFO notion_intentions_distributed skipped reason=disabled")
        return (0, 0, 0)
    run_playlist = normalize_text(os.getenv(NOTION_INTENTIONS_RUN_PLAYLIST, "").strip())
    if not run_playlist:
        legacy_value = os.environ.get(NOTION_INTENTIONS_RUN_PROFILE, "")
        run_playlist = normalize_text(legacy_value.strip() or "morning")
    if run_playlist and normalize_text(playlist_name) != run_playlist:
        print(
            "INFO notion_intentions_distributed skipped "
            f"reason=playlist_mismatch playlist={playlist_name} run_playlist={run_playlist}"
        )
        return (0, 0, 0)

    token = os.getenv(NOTION_TOKEN, "").strip()
    if not token:
        print("INFO notion_intentions_distributed skipped reason=missing_notion_token")
        return (0, 0, 0)

    opus_db_id = os.getenv(NOTION_DATABASE_ID, "").strip()
    if not opus_db_id:
        opus_name = os.getenv(NOTION_DATABASE_NAME, "Opus Dei").strip() or "Opus Dei"
        opus_db_id = notion_find_database_id(token, opus_name) or ""
    if not opus_db_id:
        print("INFO notion_intentions_distributed skipped reason=opus_db_not_found")
        return (0, 0, 0)

    intentions_db_id = os.getenv(NOTION_INTENTIONS_DATABASE_ID, "").strip()
    if not intentions_db_id:
        intentions_name = os.getenv(NOTION_INTENTIONS_DATABASE_NAME, "Prayer Intentions").strip() or "Prayer Intentions"
        intentions_db_id = notion_find_database_id(token, intentions_name) or ""
    if not intentions_db_id:
        print("INFO notion_intentions_distributed skipped reason=intentions_db_not_found")
        return (0, 0, 0)

    platform_property = os.getenv(NOTION_PLATFORM_PROPERTY, "Platform").strip() or "Platform"
    enabled_property = os.getenv(NOTION_QUEUE_ENABLED_PROPERTY, "Enabled").strip() or "Enabled"
    intention_property = os.getenv(NOTION_INTENTION_PROPERTY, "Intention").strip() or "Intention"
    title_property = os.getenv(NOTION_TITLE_PROPERTY, "Name").strip() or "Name"

    petition_property = os.getenv(NOTION_INTENTIONS_PETITION_PROPERTY, "Petition").strip() or "Petition"
    status_property = os.getenv(NOTION_INTENTIONS_STATUS_PROPERTY, "Status").strip() or "Status"
    frequency_property = os.getenv(NOTION_INTENTIONS_FREQUENCY_PROPERTY, "Frequency").strip() or "Frequency"
    allowed_statuses = parse_csv_values(
        os.getenv(NOTION_INTENTIONS_STATUS_ALLOWED, "praying").strip() or "praying"
    )

    opus_pages = notion_get_all_pages(opus_db_id, token)
    targets: List[Dict[str, Any]] = []
    for page in opus_pages:
        enabled = page_property_checkbox(page, enabled_property)
        if enabled is not True:
            continue
        platform = normalize_text(page_property_text(page, platform_property))
        if "container" in platform:
            continue
        page_id = str(page.get("id", "")).strip()
        if not page_id:
            continue
        targets.append({"id": page_id, "page": page, "name": page_title(page, title_property).strip()})
    if not targets:
        print("INFO notion_intentions_distributed skipped reason=no_eligible_targets")
        return (0, 0, 0)

    intention_pages = notion_get_all_pages(intentions_db_id, token)
    petitions: List[str] = []
    weights: List[float] = []
    for page in intention_pages:
        petition = page_property_text(page, petition_property).strip()
        if not petition:
            continue
        status_checkbox = page_property_checkbox(page, status_property)
        status_text = normalize_text(page_property_text(page, status_property))
        if status_checkbox is not None:
            if status_checkbox is not True:
                continue
        elif allowed_statuses and (not status_text or status_text not in allowed_statuses):
            continue
        freq = page_property_number(page, frequency_property)
        weight = float(freq) if freq is not None else 1.0
        weight = max(1.0, min(100.0, weight))
        petitions.append(petition)
        weights.append(weight)
    if not petitions:
        print("INFO notion_intentions_distributed skipped reason=no_eligible_petitions")
        return (len(targets), 0, 0)

    rng = random.Random(int(local_now().strftime("%Y%m%d")))
    petition_order: List[int] = []
    assigned = 0
    for target in targets:
        if not petition_order:
            petition_order = weighted_shuffle_indices(weights, rng)
        idx = petition_order.pop(0)
        petition_text = petitions[idx]
        ok = notion_update_text_property(str(target["id"]), target["page"], intention_property, petition_text, token)
        if ok:
            assigned += 1
    return (len(targets), len(petitions), assigned)


def normalize_profile_token(text: str) -> str:
    raw = normalize_text(text)
    if raw in {"day", "morning"}:
        return "morning"
    if raw in {"midday", "noon"}:
        return "midday"
    if raw in {"night", "evening"}:
        return "night"
    if raw == "any":
        return "any"
    return ""


def parse_profile_set(text: str) -> List[str]:
    value = str(text or "")
    if not value.strip():
        return []
    tokens = re.split(r"[,/|;]+|\s{2,}", value)
    out: List[str] = []
    for tok in tokens:
        normalized = normalize_profile_token(tok)
        if normalized and normalized not in out:
            out.append(normalized)
    if not out:
        normalized = normalize_profile_token(value)
        if normalized:
            out.append(normalized)
    return out


def load_notion_match_terms_by_name() -> Dict[str, List[str]]:
    config_path = os.getenv(SPOTIFY_NOTION_SYNC_CONFIG, "config/notion_spotify_sync_config.json").strip()
    if not config_path or not os.path.exists(config_path):
        return {}
    with open(config_path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)
    mappings = payload.get("mappings")
    if not isinstance(mappings, list):
        return {}
    out: Dict[str, List[str]] = {}
    for row in mappings:
        if not isinstance(row, dict):
            continue
        notion_name = normalize_text(str(row.get("notion_name", "")).strip())
        match_any = row.get("match_any")
        if not notion_name or not isinstance(match_any, list):
            continue
        terms = [normalize_text(str(v)) for v in match_any if normalize_text(str(v))]
        if terms:
            out[notion_name] = terms
    return out


def load_notion_mapping_meta_by_name() -> Dict[str, Dict[str, Any]]:
    config_path = os.getenv(SPOTIFY_NOTION_SYNC_CONFIG, "config/notion_spotify_sync_config.json").strip()
    if not config_path or not os.path.exists(config_path):
        return {}
    with open(config_path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)
    mappings = payload.get("mappings")
    if not isinstance(mappings, list):
        return {}
    out: Dict[str, Dict[str, Any]] = {}
    for row in mappings:
        if not isinstance(row, dict):
            continue
        notion_name = normalize_text(str(row.get("notion_name", "")).strip())
        if not notion_name:
            continue
        match_any = row.get("match_any")
        if not isinstance(match_any, list):
            match_any = []
        terms = [normalize_text(str(v)) for v in match_any if normalize_text(str(v))]
        playlists = row.get("playlists")
        if not isinstance(playlists, list):
            playlists = row.get("profiles")
        if not isinstance(playlists, list):
            playlists = ["any"]
        playlist_values = [normalize_text(str(v)) for v in playlists if normalize_text(str(v))]
        if not playlist_values:
            playlist_values = ["any"]
        time_of_day = normalize_text(str(row.get("time_of_day", "any")).strip() or "any")
        if time_of_day not in {"any", "morning", "midday", "evening"}:
            time_of_day = "any"
        out[notion_name] = {"terms": terms, "playlists": playlist_values, "time_of_day": time_of_day}
    return out


def current_time_of_day_local() -> str:
    h = local_now().hour
    if 4 <= h <= 10:
        return "morning"
    if 11 <= h <= 15:
        return "midday"
    return "evening"


def spotify_uri_text_index(sp: spotipy.Spotify, uris: List[str]) -> Dict[str, str]:
    text_index: Dict[str, str] = {}
    for uri in uris:
        if uri in text_index:
            continue
        if uri.startswith("spotify:track:"):
            obj = safe_call(sp.track, uri)
            if isinstance(obj, dict):
                name = str(obj.get("name", "")).strip()
                artists = " ".join(
                    str(a.get("name", "")).strip() for a in (obj.get("artists") or []) if isinstance(a, dict)
                ).strip()
                album = str((obj.get("album") or {}).get("name", "")).strip()
                text_index[uri] = normalize_text(" ".join([name, artists, album]))
        elif uri.startswith("spotify:episode:"):
            obj = safe_call(sp.episode, uri, market="US")
            if isinstance(obj, dict):
                name = str(obj.get("name", "")).strip()
                show = str((obj.get("show") or {}).get("name", "")).strip()
                text_index[uri] = normalize_text(" ".join([name, show]))
    return text_index


def best_uri_for_notion_title(
    title: str, uri_texts: Dict[str, str], match_terms_by_name: Dict[str, List[str]]
) -> Optional[str]:
    title_norm = normalize_text(title)
    if not title_norm:
        return None
    title_tokens = token_set(title)
    terms = match_terms_by_name.get(title_norm, [])
    best_uri = None
    best_score = 0
    for uri, text in uri_texts.items():
        score = 0
        if title_norm in text:
            score += 4
        if terms and any(term in text for term in terms):
            score += 3
        if title_tokens:
            overlap = len(title_tokens.intersection(token_set(text)))
            score += min(overlap, 3)
        if score > best_score:
            best_score = score
            best_uri = uri
    return best_uri if best_score >= 3 else None


def uri_candidates_for_notion_title(
    title: str, uri_texts: Dict[str, str], terms: List[str]
) -> List[Tuple[str, int]]:
    title_norm = normalize_text(title)
    if not title_norm:
        return []
    title_tokens = token_set(title)
    out: List[Tuple[str, int]] = []
    for uri, text in uri_texts.items():
        score = 0
        if title_norm in text:
            score += 4
        if terms and any(term in text for term in terms):
            score += 3
        if title_tokens:
            overlap = len(title_tokens.intersection(token_set(text)))
            score += min(overlap, 3)
        if score >= 3:
            out.append((uri, score))
    out.sort(key=lambda x: x[1], reverse=True)
    return out


def sync_notion_uris_for_playlist(
    sp: spotipy.Spotify, queue: List[str], playlist_name: str
) -> Tuple[int, List[Tuple[str, str]], List[str], List[str]]:
    token = os.getenv(NOTION_TOKEN, "").strip()
    if not token:
        return 0, [], [], []
    database_id = os.getenv(NOTION_DATABASE_ID, "").strip()
    if not database_id:
        db_name = os.getenv(NOTION_DATABASE_NAME, "Opus Dei").strip() or "Opus Dei"
        database_id = notion_find_database_id(token, db_name) or ""
    if not database_id:
        raise RuntimeError("Notion database not found. Set NOTION_DATABASE_ID or share database with integration.")

    title_property = os.getenv(NOTION_TITLE_PROPERTY, "Name").strip() or "Name"
    platform_property = os.getenv(NOTION_PLATFORM_PROPERTY, "Platform").strip() or "Platform"
    platform_values = env_normalized_values(NOTION_PLATFORM_SPOTIFY_VALUE, "spotify")
    nosync_values = env_normalized_values(NOTION_PLATFORM_NOSYNC_VALUE, "spotify-nosync")
    uri_property = os.getenv(NOTION_URI_PROPERTY, "URI").strip() or "URI"

    pages = notion_get_all_pages(database_id, token)
    uri_texts = spotify_uri_text_index(sp, queue)
    match_terms_by_name = load_notion_match_terms_by_name()
    mapping_meta_by_name = load_notion_mapping_meta_by_name()
    now_time_of_day = current_time_of_day_local()

    updated = 0
    updates: List[Tuple[str, str]] = []
    unchanged: List[str] = []
    no_match: List[str] = []
    candidates: List[Dict[str, Any]] = []
    for page in pages:
        platform_text = normalize_text(page_property_text(page, platform_property))
        if page_has_any_normalized_value(page, platform_property, nosync_values):
            continue
        if DEPRECATED_TIMESYNC_PLATFORM_VALUE in platform_text:
            continue
        if not page_has_any_normalized_value(page, platform_property, platform_values):
            continue
        title = page_title(page, title_property)
        if not title:
            continue
        title_norm = normalize_text(title)
        mapping_meta = mapping_meta_by_name.get(title_norm)
        if mapping_meta:
            mapping_playlists = mapping_meta.get("playlists", ["any"])
            if "any" not in mapping_playlists and normalize_text(playlist_name) not in mapping_playlists:
                continue
            mapping_tod = str(mapping_meta.get("time_of_day", "any"))
            if mapping_tod != "any" and mapping_tod != now_time_of_day:
                continue
            terms = list(mapping_meta.get("terms", []))
        else:
            terms = match_terms_by_name.get(title_norm, [])
        row_candidates = uri_candidates_for_notion_title(title, uri_texts, terms)
        if not row_candidates:
            no_match.append(title)
            continue
        page_id = str(page.get("id", "")).strip()
        if not page_id:
            continue
        existing_uri = page_uri_value(page, uri_property) or ""
        candidates.append(
            {
                "page": page,
                "page_id": page_id,
                "title": title,
                "existing_uri": existing_uri.strip(),
                "candidates": row_candidates,
            }
        )

    # Choose best unique URI per row (avoid same URI assigned to multiple rows).
    proposals: List[Tuple[int, int, str]] = []
    for idx, row in enumerate(candidates):
        for uri, score in row["candidates"]:
            proposals.append((score, idx, uri))
    proposals.sort(key=lambda x: x[0], reverse=True)

    assigned_rows = set()
    assigned_uris = set()
    chosen: Dict[int, str] = {}
    for score, idx, uri in proposals:
        if idx in assigned_rows:
            continue
        if uri in assigned_uris:
            continue
        assigned_rows.add(idx)
        assigned_uris.add(uri)
        chosen[idx] = uri

    for idx, uri in chosen.items():
        row = candidates[idx]
        uri_changed = row["existing_uri"] != uri
        if uri_changed:
            notion_update_uri(row["page_id"], row["page"], uri_property, uri, token)
            updated += 1
            updates.append((row["title"], uri))
        else:
            unchanged.append(row["title"])
    return updated, updates, unchanged, no_match


def sync_notion_uris_for_profile(
    sp: spotipy.Spotify, queue: List[str], profile_name: str
) -> Tuple[int, List[Tuple[str, str]], List[str], List[str]]:
    return sync_notion_uris_for_playlist(sp, queue, profile_name)


def sync_notion_spotify_bookmarks(
    sp: spotipy.Spotify,
    weekday: str,
    shows_cfg: Dict[str, Any],
    fixed_cfg: Dict[str, Any],
    tokens_cfg: Dict[str, Any],
) -> Tuple[int, int, List[Tuple[str, str]], List[str]]:
    if not notion_spotify_bookmarks_enabled():
        return 0, 0, [], []

    token = os.getenv(NOTION_TOKEN, "").strip()
    if not token:
        return 0, 0, [], []
    database_id = os.getenv(NOTION_DATABASE_ID, "").strip()
    if not database_id:
        db_name = os.getenv(NOTION_DATABASE_NAME, "Opus Dei").strip() or "Opus Dei"
        database_id = notion_find_database_id(token, db_name) or ""
    if not database_id:
        raise RuntimeError("Notion database not found. Set NOTION_DATABASE_ID or share database with integration.")

    title_property = os.getenv(NOTION_TITLE_PROPERTY, "Name").strip() or "Name"
    platform_property = os.getenv(NOTION_PLATFORM_PROPERTY, "Platform").strip() or "Platform"
    playlist_property = resolve_notion_playlist_property_name()
    resolver_property = os.getenv(NOTION_QUEUE_RESOLVER_PROPERTY, "Spotify Resolver").strip() or "Spotify Resolver"
    fallback_property = os.getenv(NOTION_QUEUE_FALLBACK_PROPERTY, "Spotify Fallback Resolver").strip() or "Spotify Fallback Resolver"
    uri_property = os.getenv(NOTION_URI_PROPERTY, "URI").strip() or "URI"
    platform_values = env_normalized_values(NOTION_PLATFORM_SPOTIFY_VALUE, "spotify")
    nosync_values = env_normalized_values(NOTION_PLATFORM_NOSYNC_VALUE, "spotify-nosync")

    updated = 0
    removed = 0
    updates: List[Tuple[str, str]] = []
    unresolved: List[str] = []
    pages = notion_get_all_pages(database_id, token)
    bookmark_meta_cache: Dict[str, Tuple[Optional[str], str]] = {}
    playlist_url_by_name: Dict[str, str] = {}
    playlist_label_by_name: Dict[str, str] = {}
    for playlist_row in load_notion_playlists(token):
        playlist_name = str(playlist_row.get("name", "")).strip()
        playlist_id = normalize_spotify_playlist_id(str(playlist_row.get("playlist_id", "")).strip())
        playlist_key = normalize_text(playlist_name)
        if not playlist_key or not playlist_id:
            continue
        playlist_url_by_name[playlist_key] = f"{SPOTIFY_BOOKMARK_BASE_URL}/playlist/{playlist_id}"
        playlist_label_by_name[playlist_key] = playlist_name

    for page in pages:
        platform_text = normalize_text(page_property_text(page, platform_property))
        if page_has_any_normalized_value(page, platform_property, nosync_values):
            continue
        if DEPRECATED_TIMESYNC_PLATFORM_VALUE in platform_text:
            continue
        if not page_has_any_normalized_value(page, platform_property, platform_values):
            continue
        page_id = str(page.get("id", "")).strip()
        if not page_id:
            continue
        title = page_title(page, title_property).strip() or "Untitled"
        playlist_name = page_property_text(page, playlist_property).strip()
        resolver = page_property_text(page, resolver_property).strip()
        fallback = page_property_text(page, fallback_property).strip()
        direct_uri = (page_uri_value(page, uri_property) or "").strip()

        resolved_uri = ""
        if resolver:
            resolved_uri = resolve_spec_uri(sp, resolver, weekday, {}, shows_cfg, fixed_cfg, tokens_cfg) or ""
        if not resolved_uri and fallback:
            resolved_uri = resolve_spec_uri(sp, fallback, weekday, {}, shows_cfg, fixed_cfg, tokens_cfg) or ""
        if not resolved_uri and spotify_value_to_bookmark_url(direct_uri):
            resolved_uri = direct_uri

        cache_key = str(resolved_uri or "").strip()
        if cache_key in bookmark_meta_cache:
            bookmark_url, bookmark_caption = bookmark_meta_cache[cache_key]
        else:
            bookmark_url = spotify_value_to_bookmark_url(cache_key)
            bookmark_caption = spotify_bookmark_caption(sp, cache_key, fallback=title) if bookmark_url else ""
            bookmark_meta_cache[cache_key] = (bookmark_url, bookmark_caption)

        playlist_key = normalize_text(playlist_name)
        playlist_url = playlist_url_by_name.get(playlist_key, "")
        playlist_caption = playlist_label_by_name.get(playlist_key, playlist_name)
        did_update, did_remove = notion_sync_spotify_bookmark(
            page_id,
            bookmark_url,
            token,
            bookmark_caption,
            playlist_url=playlist_url,
            playlist_caption=playlist_caption,
        )
        if did_update and bookmark_url:
            updated += 1
            updates.append((title, bookmark_url))
        elif did_remove:
            removed += 1
        elif not bookmark_url:
            unresolved.append(title)

    return updated, removed, updates, unresolved


def sync_notion_spotify_embeds(
    sp: spotipy.Spotify,
    weekday: str,
    shows_cfg: Dict[str, Any],
    fixed_cfg: Dict[str, Any],
    tokens_cfg: Dict[str, Any],
) -> Tuple[int, int, List[Tuple[str, str]], List[str]]:
    return sync_notion_spotify_bookmarks(sp, weekday, shows_cfg, fixed_cfg, tokens_cfg)


def sp_client() -> Tuple[spotipy.Spotify, str]:
    client_id = require_env(SPOTIFY_CLIENT_ID)
    client_secret = require_env(SPOTIFY_CLIENT_SECRET)
    refresh_token = require_env(SPOTIFY_REFRESH_TOKEN)

    token = refresh_access_token(client_id, client_secret, refresh_token)
    client = spotipy.Spotify(
        auth=token,
        requests_timeout=25,
        retries=3,
        status_forcelist=(429, 500, 502, 503, 504),
        backoff_factor=0.5,
    )
    return client, token


def safe_call(fn, *args, **kwargs):
    for i in range(5):
        try:
            return fn(*args, **kwargs)
        except SpotifyException as exc:
            if exc.http_status == 429:
                wait = int((exc.headers or {}).get("Retry-After", "2"))
                time.sleep(wait)
                continue
            if exc.http_status in (500, 502, 503, 504):
                time.sleep(2 * (i + 1))
                continue
            return None
        except Exception:
            time.sleep(1.5 * (i + 1))
    return None


def spotify_web_json(
    method: str,
    url: str,
    token: str,
    payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    last_error: Optional[Exception] = None
    for i in range(5):
        try:
            response = requests.request(method, url, headers=headers, json=payload, timeout=30)
            if response.status_code == 429:
                wait = int((response.headers or {}).get("Retry-After", "2"))
                time.sleep(wait)
                continue
            if response.status_code in (500, 502, 503, 504):
                time.sleep(2 * (i + 1))
                continue
            response.raise_for_status()
            if not response.content:
                return {}
            data = response.json()
            if isinstance(data, dict):
                return data
            return {}
        except requests.HTTPError as exc:
            last_error = exc
            raise
        except Exception as exc:
            last_error = exc
            time.sleep(1.5 * (i + 1))
    if last_error:
        raise RuntimeError(f"Spotify API request failed: {method} {url}") from last_error
    raise RuntimeError(f"Spotify API request failed: {method} {url}")


def recreate_playlist_items(token: str, playlist_id: str, uris: List[str]) -> int:
    filtered = [uri for uri in uris if uri]
    auth_token = str(token or "").strip()
    if not auth_token:
        raise RuntimeError("Missing Spotify access token.")

    endpoint = f"https://api.spotify.com/v1/playlists/{playlist_id}/items"
    # Replace the playlist with the first 100 items (or empty list to clear).
    first_batch = filtered[:100]
    spotify_web_json("PUT", endpoint, auth_token, {"uris": first_batch})

    # Append remaining items in 100-item chunks.
    for idx in range(100, len(filtered), 100):
        batch = filtered[idx : idx + 100]
        spotify_web_json("POST", endpoint, auth_token, {"uris": batch})
    return len(filtered)


def first_episode(sp: spotipy.Spotify, show_id: str, market: Optional[str] = "US") -> Tuple[Optional[str], Optional[str]]:
    res = safe_call(sp.show_episodes, show_id, limit=1, market=market)
    if isinstance(res, dict):
        items = res.get("items") or []
        if items and isinstance(items[0], dict) and items[0].get("uri"):
            return items[0]["uri"], items[0].get("name")
    return None, None


def latest_by_release_date(sp: spotipy.Spotify, show_id: str) -> Tuple[Optional[str], Optional[str]]:
    best = None
    for market in MARKETS_TO_TRY:
        res = safe_call(sp.show_episodes, show_id, limit=50, market=market)
        if not isinstance(res, dict):
            continue
        items = list(res.get("items") or [])
        if res.get("next"):
            res2 = safe_call(sp.next, res)
            if isinstance(res2, dict):
                items += list(res2.get("items") or [])
        for ep in items:
            if not isinstance(ep, dict):
                continue
            uri = ep.get("uri")
            if not uri:
                continue
            release_date = ep.get("release_date") or ""
            parts = []
            for part in release_date.split("-"):
                try:
                    parts.append(int(part))
                except Exception:
                    break
            while len(parts) < 3:
                parts.append(1)
            key = tuple(parts[:3])
            if best is None or key > best[0]:
                best = (key, uri, ep.get("name"), market)
        if best:
            break
    if best:
        return best[1], best[2]
    return None, None


def episode_title_contains(sp: spotipy.Spotify, show_id: str, needles) -> Tuple[Optional[str], Optional[str]]:
    if isinstance(needles, str):
        needles = [needles]
    res = safe_call(sp.show_episodes, show_id, limit=50, market="US")
    if not isinstance(res, dict):
        return None, None
    for ep in (res.get("items") or []):
        if not isinstance(ep, dict):
            continue
        name = ep.get("name") or ""
        if any(needle.lower() in name.lower() for needle in needles):
            uri = ep.get("uri")
            if uri:
                return uri, name
    return None, None


def sth_date_prefix(dt: datetime.datetime) -> str:
    return f"{dt.month}.{dt.day}.{dt.strftime('%y')}"


def sth_match_today(sp: spotipy.Spotify, show_id: str, must_contain_tokens: List[str]) -> Tuple[Optional[str], Optional[str]]:
    prefix = sth_date_prefix(local_now())
    res = safe_call(sp.show_episodes, show_id, limit=50, market="US")
    if not isinstance(res, dict):
        return None, None
    for ep in (res.get("items") or []):
        if not isinstance(ep, dict):
            continue
        name = ep.get("name") or ""
        if prefix in name:
            ok = True
            for token in must_contain_tokens:
                if token.lower() not in name.lower():
                    ok = False
                    break
            if ok and ep.get("uri"):
                return ep["uri"], name
    return None, None


def month_tokens(dt: datetime.datetime) -> Tuple[str, str]:
    return dt.strftime("%B"), dt.strftime("%b")


def date_regex(month_str: str, day: int) -> str:
    return rf"(?:^|[^A-Za-z]){re.escape(month_str)}\s*[-,]*\s*0?{day}(?:st|nd|rd|th)?(?:\s*,?\s*\d{{4}})?(?!\w)"


def matches_month_day(title: str, dt: datetime.datetime) -> bool:
    full, abbr = month_tokens(dt)
    return bool(
        re.search(date_regex(full, dt.day), title, re.IGNORECASE)
        or re.search(date_regex(abbr, dt.day), title, re.IGNORECASE)
    )


def do_date_aware(sp: spotipy.Spotify, show_id: str, terms) -> Tuple[Optional[str], Optional[str]]:
    now = local_now()
    yst = now - datetime.timedelta(days=1)

    res = safe_call(sp.show_episodes, show_id, limit=50, market="US")
    if not isinstance(res, dict):
        return None, None
    items = res.get("items") or []

    for dt in (now, yst):
        for ep in items:
            if not isinstance(ep, dict):
                continue
            name = ep.get("name") or ""
            if any(term.lower() in name.lower() for term in terms) and matches_month_day(name, dt):
                uri = ep.get("uri")
                if uri:
                    return uri, name
    return None, None


def _episode_name_normalized(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).casefold()


def _episode_day_ordinal(day: int) -> str:
    if 10 <= day % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    return f"{day}{suffix}"


def _episode_date_render_context(dt: datetime.date) -> Dict[str, str]:
    return {
        "year": str(dt.year),
        "month": str(dt.month),
        "month_zero": f"{dt.month:02d}",
        "month_name": dt.strftime("%B"),
        "month_short": dt.strftime("%b"),
        "day": str(dt.day),
        "day_zero": f"{dt.day:02d}",
        "day_ordinal": _episode_day_ordinal(dt.day),
        "date_iso": dt.isoformat(),
    }


def _render_episode_date_pattern(pattern: str, dt: datetime.date) -> str:
    template = str(pattern or "").strip()
    if not template:
        return ""
    try:
        rendered = template.format(**_episode_date_render_context(dt))
    except KeyError as exc:
        missing = str(exc).strip("'")
        raise RuntimeError(f"Invalid Spotify episode lookup date format '{template}': unknown placeholder '{missing}'.")
    return re.sub(r"\s+", " ", rendered).strip()


def _episode_date_candidates(date_formats: Tuple[str, ...], dt: datetime.date) -> List[str]:
    candidates: List[str] = []
    seen = set()
    for pattern in date_formats:
        rendered = _render_episode_date_pattern(pattern, dt)
        if not rendered:
            continue
        key = rendered.casefold()
        if key in seen:
            continue
        seen.add(key)
        candidates.append(key)
    return candidates


def _collect_spotify_show_episodes(sp: spotipy.Spotify, show_id: str, market: Optional[str] = "US") -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    seen_markers = set()
    first = safe_call(sp.show_episodes, show_id, limit=50, market=market)
    if not isinstance(first, dict):
        return items
    pages = [first]
    while pages and pages[-1].get("next"):
        next_page = safe_call(sp.next, pages[-1])
        if not isinstance(next_page, dict):
            break
        pages.append(next_page)

    for page in pages:
        for ep in (page.get("items") or []):
            if not isinstance(ep, dict):
                continue
            marker = ep.get("uri") or ep.get("id") or ep.get("name")
            if marker in seen_markers:
                continue
            seen_markers.add(marker)
            items.append(ep)
    return items


def _spotify_episode_search_matches(
    episodes: List[Dict[str, Any]],
    required_name_terms: Tuple[str, ...],
    date_formats: Tuple[str, ...],
    current_date: datetime.date,
) -> List[str]:
    required_terms = tuple(_episode_name_normalized(term) for term in required_name_terms if str(term or "").strip())
    if not required_terms:
        return []
    date_candidates = _episode_date_candidates(date_formats, current_date)
    if not date_candidates:
        return []

    uris: List[str] = []
    for ep in episodes:
        name = _episode_name_normalized(ep.get("name", ""))
        uri = str(ep.get("uri", "")).strip()
        if not name or not uri:
            continue
        if not all(term in name for term in required_terms):
            continue
        if not any(candidate in name for candidate in date_candidates):
            continue
        uris.append(uri)
    return uris


def spotify_episode_lookup_search_uris(
    sp: spotipy.Spotify,
    show_id: str,
    searches: Tuple[SpotifyEpisodeLookupSearch, ...],
    current_date: datetime.date,
    market: Optional[str] = "US",
) -> List[str]:
    if not searches:
        return []
    episodes = _collect_spotify_show_episodes(sp, show_id, market=market)
    for search in searches:
        uris = _spotify_episode_search_matches(
            episodes,
            search.required_name_terms,
            search.date_formats,
            current_date,
        )
        if uris:
            return uris
    return []


def spotify_episode_lookup_uris(
    sp: spotipy.Spotify,
    show_id: str,
    required_name_terms: Tuple[str, ...],
    date_formats: Tuple[str, ...],
    current_date: datetime.date,
    market: Optional[str] = "US",
) -> List[str]:
    return spotify_episode_lookup_search_uris(
        sp,
        show_id,
        (
            SpotifyEpisodeLookupSearch(
                required_name_terms=required_name_terms,
                date_formats=date_formats,
            ),
        ),
        current_date,
        market=market,
    )


def usccb_daily_mass_for_date(
    sp: spotipy.Spotify, show_id: str, dt: datetime.datetime
) -> Tuple[Optional[str], Optional[str]]:
    month_full = dt.strftime("%B")
    month_abbr = dt.strftime("%b")
    day = dt.day
    year = dt.strftime("%Y")
    patterns = [
        rf"\bdaily\s*mass\s*reading\s*podcast\s*for\s*{re.escape(month_full)}\s*{day},?\s*{re.escape(year)}\b",
        rf"\bdaily\s*mass\s*reading\s*podcast\s*for\s*{re.escape(month_abbr)}\.?\s*{day},?\s*{re.escape(year)}\b",
    ]

    res = safe_call(sp.show_episodes, show_id, limit=50, market="US")
    if not isinstance(res, dict):
        return None, None
    items = list(res.get("items") or [])
    if res.get("next"):
        res2 = safe_call(sp.next, res)
        if isinstance(res2, dict):
            items += list(res2.get("items") or [])

    for ep in items:
        if not isinstance(ep, dict):
            continue
        name = str(ep.get("name", "")).strip()
        if not name:
            continue
        if any(re.search(pattern, name, re.IGNORECASE) for pattern in patterns):
            uri = ep.get("uri")
            if uri:
                return uri, name
    return None, None


def usccb_daily_mass_for_today_window(sp: spotipy.Spotify, show_id: str) -> Tuple[Optional[str], Optional[str]]:
    now = local_now()
    # Prefer today's titled episode; if unavailable, fall back to latest available release.
    uri, name = usccb_daily_mass_for_date(sp, show_id, now)
    if uri:
        return uri, name
    return latest_by_release_date(sp, show_id)


def day_of_year_1_to_365(now: datetime.datetime) -> int:
    doy = int(now.timetuple().tm_yday)
    return 365 if doy > 365 else doy


def bible_in_a_year_for_today(sp: spotipy.Spotify, show_id: str, status: Dict[str, bool]):
    n = day_of_year_1_to_365(local_now())
    pattern = re.compile(rf"\bDay\s*0*{n}\b", re.IGNORECASE)

    def release_key(release_date: str) -> Tuple[int, int, int]:
        parts: List[int] = []
        for part in (release_date or "").split("-"):
            try:
                parts.append(int(part))
            except Exception:
                break
        while len(parts) < 3:
            parts.append(1)
        return tuple(parts[:3])  # type: ignore[return-value]

    def episode_year(name: str, release_date: str) -> int:
        years = [int(y) for y in re.findall(r"\b(20\d{2})\b", name)]
        if years:
            return max(years)
        return release_key(release_date)[0]

    best = None
    for market in MARKETS_TO_TRY:
        first = safe_call(sp.show_episodes, show_id, limit=50, offset=0, market=market)
        if not isinstance(first, dict):
            continue

        total = first.get("total")
        try:
            total_int = int(total)
        except Exception:
            total_int = len(first.get("items") or [])
        to_scan = min(total_int, MAX_BIAY_EPISODES_TO_SCAN)

        pages = [first]
        for offset in range(50, to_scan, 50):
            page = safe_call(sp.show_episodes, show_id, limit=50, offset=offset, market=market)
            if isinstance(page, dict):
                pages.append(page)

        for page in pages:
            for ep in (page.get("items") or []):
                if not isinstance(ep, dict):
                    continue
                name = ep.get("name") or ""
                if not pattern.search(name):
                    continue
                uri = ep.get("uri")
                if not uri:
                    continue
                rkey = release_key(ep.get("release_date") or "")
                eyear = episode_year(name, ep.get("release_date") or "")
                key = (eyear, rkey)
                if best is None or key > best[0]:
                    best = (key, uri, name)

    if best:
        status["Bible in a Year"] = True
        print(f"INFO biay_day={n} selected={best[2]}")
        return best[1], best[2], n

    status["Bible in a Year"] = False
    return None, None, n


def get_auxilium_for_weekday(
    sp: spotipy.Spotify, show_id: str, weekday_name: str, tokens_cfg: Dict[str, Any]
) -> Tuple[Optional[str], Optional[str]]:
    res = safe_call(sp.show_episodes, show_id, limit=50, market="US")
    if not isinstance(res, dict):
        return None, None
    for ep in (res.get("items") or []):
        if not isinstance(ep, dict):
            continue
        name = ep.get("name") or ""
        if cfg_token_text(tokens_cfg, "AUXILIUM").lower() in name.lower() and weekday_name.lower() in name.lower():
            uri = ep.get("uri")
            if uri:
                return uri, name
    return None, None


def rosary_mystery_for_weekday(weekday: str) -> str:
    w = weekday.lower()
    if w in ("monday", "saturday"):
        return "Joyful"
    if w in ("tuesday", "friday"):
        return "Sorrowful"
    if w in ("wednesday", "sunday"):
        return "Glorious"
    return "Luminous"


def get_morning_prayer(
    sp: spotipy.Spotify, shows_cfg: Dict[str, Any], tokens_cfg: Dict[str, Any], status: Dict[str, bool]
) -> Tuple[Optional[str], Optional[str]]:
    uri, name = do_date_aware(
        sp, cfg_value(shows_cfg, "DIVINE_OFFICE", "shows"), cfg_token_terms(tokens_cfg, "DO_MORNING")
    )
    if uri:
        status["Morning Prayer (DO)"] = True
        status["Morning Prayer (STH fallback)"] = False
        return uri, name
    uri, name = sth_match_today(
        sp, cfg_value(shows_cfg, "STH", "shows"), list(cfg_token_terms(tokens_cfg, "STH_LAUDS"))
    )
    status["Morning Prayer (DO)"] = False
    status["Morning Prayer (STH fallback)"] = bool(uri)
    return uri, name


def get_evening_prayer(
    sp: spotipy.Spotify, shows_cfg: Dict[str, Any], tokens_cfg: Dict[str, Any], status: Dict[str, bool]
) -> Tuple[Optional[str], Optional[str]]:
    uri, name = do_date_aware(
        sp, cfg_value(shows_cfg, "DIVINE_OFFICE", "shows"), cfg_token_terms(tokens_cfg, "DO_EVENING")
    )
    if uri:
        status["Evening Prayer (DO)"] = True
        status["Evening Prayer (STH fallback)"] = False
        return uri, name
    uri, name = sth_match_today(
        sp, cfg_value(shows_cfg, "STH", "shows"), list(cfg_token_terms(tokens_cfg, "STH_VESPERS"))
    )
    status["Evening Prayer (DO)"] = False
    status["Evening Prayer (STH fallback)"] = bool(uri)
    return uri, name


def get_night_prayer(
    sp: spotipy.Spotify, shows_cfg: Dict[str, Any], tokens_cfg: Dict[str, Any], status: Dict[str, bool]
) -> Tuple[Optional[str], Optional[str]]:
    uri, name = do_date_aware(
        sp, cfg_value(shows_cfg, "DIVINE_OFFICE", "shows"), cfg_token_terms(tokens_cfg, "DO_NIGHT_ANY")
    )
    status["Night/Compline (DO)"] = bool(uri)
    return uri, name


def resolve_item_uri(
    sp: spotipy.Spotify,
    key: str,
    weekday: str,
    status: Dict[str, bool],
    shows_cfg: Dict[str, Any],
    fixed_cfg: Dict[str, Any],
    tokens_cfg: Dict[str, Any],
) -> Optional[str]:
    if key == "ANGELUS_SONG":
        status["Angelus Song (Daughters of Mary)"] = True
        return cfg_value(fixed_cfg, "ANGELUS_SONG", "fixed")

    if key == "ANGELUS_POD":
        status["Angelus Podcast (The Prayer Podcast)"] = True
        return cfg_value(fixed_cfg, "ANGELUS_POD", "fixed")

    if key == "NIGHT_PRE_COMPLINE":
        status["Night Pre-Compline (fixed episode)"] = True
        return cfg_value(fixed_cfg, "NIGHT_PRE_COMPLINE", "fixed")

    if key == "DAILY_EXAMEN_LABOR":
        status["Daily Examen for Labor"] = True
        return cfg_value(fixed_cfg, "DAILY_EXAMEN_LABOR", "fixed")

    if key == "DAILY_EXAMEN_PARENTS":
        status["Daily Examen for Parents"] = True
        return cfg_value(fixed_cfg, "DAILY_EXAMEN_PARENTS", "fixed")

    if key == "BIBLE_IN_A_YEAR":
        uri, _, _ = bible_in_a_year_for_today(sp, cfg_value(shows_cfg, "BIBLE_IN_A_YEAR", "shows"), status)
        return uri

    if key == "SAINT_OF_DAY":
        uri, _ = latest_by_release_date(sp, cfg_value(shows_cfg, "SAINT_OF_DAY", "shows"))
        status["Saint of the Day"] = bool(uri)
        return uri

    if key == "AUXILIUM":
        uri, _ = get_auxilium_for_weekday(sp, cfg_value(shows_cfg, "DTH", "shows"), weekday, tokens_cfg)
        status["Auxilium Christianorum"] = bool(uri)
        return uri

    if key == "SUNDAY_FRMIKE":
        uri, _ = latest_by_release_date(sp, cfg_value(shows_cfg, "FRMIKE_SUNDAY", "shows"))
        status["Fr. Mike Sunday Homily"] = bool(uri)
        return uri

    if key == "SUNDAY_BARRON":
        uri, _ = latest_by_release_date(sp, cfg_value(shows_cfg, "BARRON_SUNDAY", "shows"))
        status["Bp. Barron Sunday Sermon"] = bool(uri)
        return uri

    if key == "MORNING":
        uri, _ = get_morning_prayer(sp, shows_cfg, tokens_cfg, status)
        return uri

    if key == "STH_MORNING":
        uri, _ = sth_match_today(sp, cfg_value(shows_cfg, "STH", "shows"), list(cfg_token_terms(tokens_cfg, "STH_LAUDS")))
        status["Morning Prayer (STH)"] = bool(uri)
        return uri

    if key == "STH_EVENING":
        uri, _ = sth_match_today(
            sp, cfg_value(shows_cfg, "STH", "shows"), list(cfg_token_terms(tokens_cfg, "STH_VESPERS"))
        )
        status["Evening Prayer (STH Vespers)"] = bool(uri)
        return uri

    if key == "DO_MORNING":
        uri, _ = do_date_aware(
            sp, cfg_value(shows_cfg, "DIVINE_OFFICE", "shows"), cfg_token_terms(tokens_cfg, "DO_MORNING")
        )
        status["Morning Prayer (DO)"] = bool(uri)
        return uri

    if key == "INVITATORY":
        uri, _ = do_date_aware(
            sp, cfg_value(shows_cfg, "DIVINE_OFFICE", "shows"), cfg_token_terms(tokens_cfg, "DO_INVITATORY")
        )
        status["Invitatory"] = bool(uri)
        return uri

    if key == "EVENING":
        uri, _ = get_evening_prayer(sp, shows_cfg, tokens_cfg, status)
        return uri

    if key == "NIGHT":
        uri, _ = get_night_prayer(sp, shows_cfg, tokens_cfg, status)
        return uri

    if key == "USCCB":
        uri, _ = usccb_daily_mass_for_today_window(sp, cfg_value(shows_cfg, "DAILY_MASS_READINGS", "shows"))
        status["USCCB Daily Readings"] = bool(uri)
        return uri

    if key == "DGE":
        uri, _ = latest_by_release_date(sp, cfg_value(shows_cfg, "LBS_EXEGESIS", "shows"))
        status["Daily Gospel Exegesis"] = bool(uri)
        return uri

    if key == "TVMASS":
        uri, _ = first_episode(sp, cfg_value(shows_cfg, "DAILY_TV_MASS", "shows"))
        status["Daily TV Mass"] = bool(uri)
        return uri

    if key == "OFFICE":
        uri, _ = do_date_aware(
            sp, cfg_value(shows_cfg, "DIVINE_OFFICE", "shows"), cfg_token_terms(tokens_cfg, "DO_OFFICE")
        )
        status["Office of Readings"] = bool(uri)
        return uri

    if key == "MIDMORNING":
        uri, _ = do_date_aware(
            sp, cfg_value(shows_cfg, "DIVINE_OFFICE", "shows"), cfg_token_terms(tokens_cfg, "DO_MIDMORNING")
        )
        status["Midmorning Prayer"] = bool(uri)
        return uri

    if key == "MIDDAY":
        uri, _ = do_date_aware(
            sp, cfg_value(shows_cfg, "DIVINE_OFFICE", "shows"), cfg_token_terms(tokens_cfg, "DO_MIDDAY")
        )
        status["Midday Prayer"] = bool(uri)
        return uri

    if key == "MIDAFTERNOON":
        uri, _ = do_date_aware(
            sp, cfg_value(shows_cfg, "DIVINE_OFFICE", "shows"), cfg_token_terms(tokens_cfg, "DO_MIDAFTERNOON")
        )
        status["Midafternoon Prayer"] = bool(uri)
        return uri

    if key == "ROSARY":
        mystery = rosary_mystery_for_weekday(weekday)
        uri, _ = episode_title_contains(sp, cfg_value(shows_cfg, "BARRON_ROSARY", "shows"), mystery)
        status[f"Rosary ({mystery})"] = bool(uri)
        return uri

    if key == "FRIDAY_STATIONS":
        status["Stations of the Cross (Friday)"] = weekday == "Friday"
        return cfg_value(fixed_cfg, "FRIDAY_STATIONS", "fixed") if weekday == "Friday" else None

    status[f"UNKNOWN:{key}"] = False
    return None


def resolve_spec_uri(
    sp: spotipy.Spotify,
    spec: str,
    weekday: str,
    status: Dict[str, bool],
    shows_cfg: Dict[str, Any],
    fixed_cfg: Dict[str, Any],
    tokens_cfg: Dict[str, Any],
) -> Optional[str]:
    raw = str(spec or "").strip()
    if not raw:
        return None
    if raw.startswith("spotify:"):
        status[f"Fixed URI:{raw}"] = True
        return raw
    key = re.sub(r"[^A-Za-z0-9]+", "_", raw).strip("_").upper()
    if not key:
        return None
    return resolve_item_uri(sp, key, weekday, status, shows_cfg, fixed_cfg, tokens_cfg)


def load_resolver_runtime_config(cfg: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    profiles_cfg = cfg.get("profiles") if isinstance(cfg.get("profiles"), dict) else {}
    shows_cfg = cfg.get("shows") if isinstance(cfg.get("shows"), dict) else DEFAULT_SHOWS
    fixed_cfg = cfg.get("fixed") if isinstance(cfg.get("fixed"), dict) else DEFAULT_FIXED
    tokens_cfg = cfg.get("tokens") if isinstance(cfg.get("tokens"), dict) else DEFAULT_TOKENS
    return profiles_cfg, shows_cfg, fixed_cfg, tokens_cfg


def contract_runs_today(contract: SpotifyQueueContract, weekday: str) -> bool:
    if not contract.weekdays:
        return True
    today = str(weekday or "").strip().lower()
    return today in {day.lower() for day in contract.weekdays}


def resolve_contract_uris(
    sp: spotipy.Spotify,
    contract: SpotifyQueueContract,
    weekday: str,
    current_date: datetime.date,
    status: Dict[str, bool],
    shows_cfg: Dict[str, Any],
    fixed_cfg: Dict[str, Any],
    tokens_cfg: Dict[str, Any],
) -> List[str]:
    if contract.spotify_url_normal and contract.spotify_uri_easter:
        romcal_calendar = os.getenv("ROMCAL_CALENDAR", "general_roman").strip() or "general_roman"
        romcal_locale = os.getenv("ROMCAL_LOCALE", "en").strip() or "en"
        is_easter = is_easter_season_for_date(romcal_calendar, romcal_locale, current_date)
        season_label = "easter" if is_easter else "ordinary"
        status[f"Seasonal:{contract.notion_name}:{season_label}"] = True
        primary_spec = contract.spotify_uri_easter if is_easter else contract.spotify_url_normal
        uri = normalize_spotify_queue_uri(primary_spec) or None
        return [uri] if uri else []

    if contract.spotify_episode_lookup:
        lookup = contract.spotify_episode_lookup
        uris = spotify_episode_lookup_search_uris(
            sp,
            lookup.show_id,
            lookup.searches,
            current_date,
        )
        status[contract.notion_name] = bool(uris)
        return uris

    primary_spec = contract.spotify_uri or contract.resolver

    uri = resolve_spec_uri(sp, primary_spec, weekday, status, shows_cfg, fixed_cfg, tokens_cfg)
    if not uri and contract.fallback_resolver:
        uri = resolve_spec_uri(sp, contract.fallback_resolver, weekday, status, shows_cfg, fixed_cfg, tokens_cfg)
        status[f"Fallback used:{contract.notion_name}"] = bool(uri)
    return [normalize_spotify_queue_uri(uri)] if uri else []


def resolve_contract_uri(
    sp: spotipy.Spotify,
    contract: SpotifyQueueContract,
    weekday: str,
    current_date: datetime.date,
    status: Dict[str, bool],
    shows_cfg: Dict[str, Any],
    fixed_cfg: Dict[str, Any],
    tokens_cfg: Dict[str, Any],
) -> Optional[str]:
    uris = resolve_contract_uris(sp, contract, weekday, current_date, status, shows_cfg, fixed_cfg, tokens_cfg)
    return uris[0] if uris else None


def build_queue_for_playlist_definition(
    sp: spotipy.Spotify,
    playlist_definition: SpotifyPlaylistDefinition,
    weekday: str,
    current_date: datetime.date,
    status: Dict[str, bool],
    shows_cfg: Dict[str, Any],
    fixed_cfg: Dict[str, Any],
    tokens_cfg: Dict[str, Any],
    ordered_contracts: Optional[Tuple[SpotifyQueueContract, ...]] = None,
) -> List[str]:
    contracts = tuple(ordered_contracts or ())

    queue: List[str] = []
    eligible_contracts = 0
    for contract in contracts:
        if not contract_runs_today(contract, weekday):
            status[f"Gated:{contract.notion_name}"] = False
            continue

        eligible_contracts += 1
        uris = resolve_contract_uris(sp, contract, weekday, current_date, status, shows_cfg, fixed_cfg, tokens_cfg)
        if uris:
            queue.extend(uris)
        else:
            status[f"Unresolved:{contract.notion_name}"] = False

    if eligible_contracts == 0:
        status["__no_eligible_contracts__"] = True
    return queue


def build_queue_for_profile(
    sp: spotipy.Spotify,
    profile_name: str,
    weekday: str,
    status: Dict[str, bool],
    profiles_cfg: Dict[str, Any],
    catalog_cfg: Dict[str, Any],
    shows_cfg: Dict[str, Any],
    fixed_cfg: Dict[str, Any],
    tokens_cfg: Dict[str, Any],
) -> List[str]:
    cfg = profiles_cfg.get(profile_name)
    if not cfg:
        raise RuntimeError(f"Invalid profile '{profile_name}'. Use one of: {', '.join(sorted(profiles_cfg.keys()))}")

    order = cfg.get("order", [])
    if not isinstance(order, list) or not order:
        raise RuntimeError(f"Profile '{profile_name}' must define a non-empty 'order' list.")

    queue: List[str] = []

    for key in order:
        key = str(key)
        if key not in catalog_cfg:
            raise RuntimeError(f"Profile '{profile_name}' references unknown key '{key}' (missing in catalog).")
        uri = resolve_item_uri(sp, key, weekday, status, shows_cfg, fixed_cfg, tokens_cfg)
        if uri:
            queue.append(uri)

    return queue


def main() -> int:
    try:
        set_runtime_timezone({})
        _, shows_cfg, fixed_cfg, tokens_cfg = load_resolver_runtime_config({})

        sp, spotify_token = sp_client()
        current_now = local_now()
        current_date = current_now.date()
        weekday = current_now.strftime("%A")
        source = "notion_membership"
        uri_autosync_enabled = bool_env(SPOTIFY_ENABLE_URI_AUTOSYNC, default=False)
        runs: List[Dict[str, Any]] = []

        _ = os.getenv(SPOTIFY_USER_ID, "")
        notion_token = require_env(NOTION_TOKEN)
        all_contracts = load_spotify_queue_contracts()
        playlist_filter = os.getenv(SPOTIFY_PLAYLIST_NAME, "").strip()
        all_playlists = load_spotify_playlist_definitions(contracts=all_contracts)
        selected_playlists = [
            playlist for playlist in all_playlists if playlist_definition_matches_filter(playlist, playlist_filter)
        ]
        if playlist_filter and not selected_playlists:
            raise RuntimeError(f"No Spotify playlist definition matched '{playlist_filter}'.")
        membership_build = build_notion_playlist_memberships(notion_token, all_contracts, all_playlists)
        runs = []
        for target in selected_playlists:
            status = {}
            ordered_contracts = membership_build.contracts_by_playlist.get(target.key, ())
            queue = build_queue_for_playlist_definition(
                sp,
                target,
                weekday,
                current_date,
                status,
                shows_cfg,
                fixed_cfg,
                tokens_cfg,
                ordered_contracts=ordered_contracts,
            )
            if not queue:
                if status.get("__no_eligible_contracts__"):
                    if len(selected_playlists) == 1:
                        raise RuntimeError(f"No Spotify contracts run today for selected playlist '{target.name}'.")
                    print(f"INFO spotify_playlist_skipped playlist={target.name} reason=no_eligible_contracts weekday={weekday}")
                    continue
                raise RuntimeError(f"No tracks/episodes resolved for Spotify playlist '{target.name}'.")
            runs.append(
                {
                    "name": target.name,
                    "playlist_id": target.playlist_id,
                    "queue": queue,
                    "status": status,
                    "membership_stats": membership_build.stats,
                }
            )
        override_playlist_id_raw = os.getenv(SPOTIFY_PLAYLIST_ID, "").strip()
        override_playlist_id = normalize_spotify_playlist_id(override_playlist_id_raw)
        if override_playlist_id_raw and not override_playlist_id:
            raise RuntimeError(
                f"{SPOTIFY_PLAYLIST_ID} must be a raw playlist id, spotify:playlist:<id>, "
                "or an open.spotify.com playlist URL."
            )
        if override_playlist_id:
            if len(runs) != 1:
                raise RuntimeError(
                    f"{SPOTIFY_PLAYLIST_ID} override requires exactly one target playlist. "
                    f"Set {SPOTIFY_PLAYLIST_NAME} to a single playlist name."
                )
            runs[0]["playlist_id"] = override_playlist_id
        if not runs:
            if playlist_filter:
                raise RuntimeError(f"No Spotify playlists produced a queue for selected filter '{playlist_filter}'.")
            raise RuntimeError("No Spotify playlist definitions produced a queue.")

        for run in runs:
            playlist_name = str(run["name"])
            playlist_id = str(run["playlist_id"])
            queue = list(run["queue"])
            status = dict(run["status"])
            membership_stats = dict(run.get("membership_stats") or {})

            written = recreate_playlist_items(spotify_token, playlist_id, queue)
            notion_uri_updates = 0
            notion_uri_update_details: List[Tuple[str, str]] = []
            notion_uri_unchanged: List[str] = []
            notion_uri_no_match: List[str] = []
            if uri_autosync_enabled and notion_token:
                notion_uri_updates, notion_uri_update_details, notion_uri_unchanged, notion_uri_no_match = (
                    sync_notion_uris_for_playlist(sp, queue, playlist_name)
                )
            if notion_token:
                intention_targets, intention_source_count, intention_assigned = distribute_prayer_intentions(playlist_name)
            else:
                intention_targets, intention_source_count, intention_assigned = (0, 0, 0)

            print(f"SUMMARY playlist={playlist_name} playlist_id={playlist_id} tracks_written={written}")
            print(f"INFO playlist={playlist_name} weekday={weekday} playlist_recreated=true source={source}")
            if membership_stats:
                print(
                    "INFO notion_membership "
                    f"playlist={playlist_name} "
                    f"notion_rows={membership_stats.get('notion_rows', 0)} "
                    f"checked_rows={membership_stats.get('checked_rows', 0)} "
                    f"matched_rows={membership_stats.get('matched_rows', 0)} "
                    f"ignored_non_enabled_rows={membership_stats.get('ignored_non_enabled_rows', 0)} "
                    f"ignored_missing_output_folder_rows={membership_stats.get('ignored_missing_output_folder_rows', 0)} "
                    f"inactive_contracts={membership_stats.get('inactive_contracts', 0)}"
                )
            print(f"INFO utc_offset={current_now.strftime('%z')}")
            print(f"INFO uri_autosync_enabled={str(uri_autosync_enabled).lower()}")
            for name, ok in sorted(status.items()):
                print(f"INFO resolver_status playlist={playlist_name} name={name} ok={str(ok).lower()}")
            if uri_autosync_enabled and os.getenv(NOTION_TOKEN, "").strip():
                print(f"INFO notion_uri_rows_updated playlist={playlist_name} count={notion_uri_updates}")
                log_limit = int(os.getenv(NOTION_URI_LOG_LIMIT, "25").strip() or "25")
                for title, uri in notion_uri_update_details[: max(0, log_limit)]:
                    print(f"INFO notion_uri_mapped playlist={playlist_name} title={title} uri={uri}")
                for title in notion_uri_unchanged[: max(0, log_limit)]:
                    print(f"INFO notion_uri_unchanged playlist={playlist_name} title={title}")
                for title in notion_uri_no_match[: max(0, log_limit)]:
                    print(f"INFO notion_uri_no_match playlist={playlist_name} title={title}")
                if len(notion_uri_update_details) > max(0, log_limit):
                    print(
                        "INFO notion_uri_mapped_truncated "
                        f"playlist={playlist_name} shown={max(0, log_limit)} total={len(notion_uri_update_details)}"
                    )
                if len(notion_uri_unchanged) > max(0, log_limit):
                    print(
                        "INFO notion_uri_unchanged_truncated "
                        f"playlist={playlist_name} shown={max(0, log_limit)} total={len(notion_uri_unchanged)}"
                    )
                if len(notion_uri_no_match) > max(0, log_limit):
                    print(
                        "INFO notion_uri_no_match_truncated "
                        f"playlist={playlist_name} shown={max(0, log_limit)} total={len(notion_uri_no_match)}"
                    )
            if intention_targets or intention_source_count or intention_assigned:
                print(
                    "INFO notion_intentions_distributed "
                    f"playlist={playlist_name} targets={intention_targets} source_petitions={intention_source_count} assigned={intention_assigned}"
                )

        return 0
    except requests.HTTPError as exc:
        print(f"ERROR HTTP token/API failure: {exc}", file=sys.stderr)
        return 1
    except SpotifyException as exc:
        print(f"ERROR Spotify API failure: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
