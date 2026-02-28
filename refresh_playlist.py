import base64
import datetime
import json
import os
import re
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

import requests
import spotipy
from spotipy.exceptions import SpotifyException

TOKEN_URL = "https://accounts.spotify.com/api/token"
SCOPES_NOTE = "playlist-modify-private playlist-modify-public playlist-read-private"
NOTION_VERSION = "2022-06-28"

# ===== Environment variables (required) =====
SPOTIFY_CLIENT_ID = "SPOTIFY_CLIENT_ID"
SPOTIFY_CLIENT_SECRET = "SPOTIFY_CLIENT_SECRET"
SPOTIFY_REFRESH_TOKEN = "SPOTIFY_REFRESH_TOKEN"
SPOTIFY_PLAYLIST_ID = "SPOTIFY_PLAYLIST_ID"

# Optional environment variable; only used for compatibility with existing setups.
SPOTIFY_USER_ID = "SPOTIFY_USER_ID"

# Optional selector for which playlist profile to build into SPOTIFY_PLAYLIST_ID.
SPOTIFY_PLAYLIST_PROFILE = "SPOTIFY_PLAYLIST_PROFILE"  # morning|midday|night, default morning
SPOTIFY_CONFIG_FILE = "SPOTIFY_CONFIG_FILE"  # optional, defaults to playlist_config.json
SPOTIFY_NOTION_SYNC_CONFIG = "SPOTIFY_NOTION_SYNC_CONFIG"  # optional, defaults to notion_spotify_sync_config.json

# Optional Notion URI sync.
NOTION_TOKEN = "NOTION_TOKEN"
NOTION_DATABASE_ID = "NOTION_DATABASE_ID"
NOTION_DATABASE_NAME = "NOTION_DATABASE_NAME"  # fallback search; defaults to Opus Dei
NOTION_TITLE_PROPERTY = "NOTION_TITLE_PROPERTY"  # defaults to Name
NOTION_PLATFORM_PROPERTY = "NOTION_PLATFORM_PROPERTY"  # defaults to Platform
NOTION_PLATFORM_SPOTIFY_VALUE = "NOTION_PLATFORM_SPOTIFY_VALUE"  # defaults to spotify
NOTION_URI_PROPERTY = "NOTION_URI_PROPERTY"  # defaults to URI
NOTION_URI_LOG_LIMIT = "NOTION_URI_LOG_LIMIT"  # defaults to 25


MARKETS_TO_TRY = ["US", None, "GB", "CA", "AU"]
MAX_PAGES = 10
MAX_BIAY_EPISODES_TO_SCAN = 2500


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def load_playlist_config() -> Dict[str, Any]:
    config_path = os.getenv(SPOTIFY_CONFIG_FILE, "playlist_config.json").strip() or "playlist_config.json"
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


def notion_call(method: str, url: str, token: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    response = requests.request(method, url, headers=notion_headers(token), json=payload, timeout=30)
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict):
        raise RuntimeError("Unexpected Notion API response format.")
    return data


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


def page_property_text(page: Dict[str, Any], property_name: str) -> str:
    props = page.get("properties") or {}
    prop = props.get(property_name) or {}
    ptype = str(prop.get("type", "")).strip()
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


def page_uri_value(page: Dict[str, Any], uri_property: str) -> Optional[str]:
    props = page.get("properties") or {}
    prop = props.get(uri_property) or {}
    ptype = str(prop.get("type", "")).strip()
    if ptype == "rich_text":
        vals = prop.get("rich_text") or []
        parts = [str(v.get("plain_text", "")).strip() for v in vals if isinstance(v, dict) and v.get("plain_text")]
        return " ".join(parts).strip() or None
    if ptype == "url":
        value = str(prop.get("url", "")).strip()
        return value or None
    return None


def notion_update_uri(page_id: str, page: Dict[str, Any], uri_property: str, uri: str, token: str) -> None:
    props = page.get("properties") or {}
    prop = props.get(uri_property) or {}
    ptype = str(prop.get("type", "")).strip()
    if ptype == "url":
        body = {"properties": {uri_property: {"url": uri}}}
    else:
        body = {"properties": {uri_property: {"rich_text": [{"type": "text", "text": {"content": uri[:2000]}}]}}}
    notion_call("PATCH", f"https://api.notion.com/v1/pages/{page_id}", token, body)


def load_notion_match_terms_by_name() -> Dict[str, List[str]]:
    config_path = os.getenv(SPOTIFY_NOTION_SYNC_CONFIG, "notion_spotify_sync_config.json").strip()
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


def sync_notion_uris_for_profile(sp: spotipy.Spotify, queue: List[str]) -> Tuple[int, List[Tuple[str, str]]]:
    token = os.getenv(NOTION_TOKEN, "").strip()
    if not token:
        return 0, []
    database_id = os.getenv(NOTION_DATABASE_ID, "").strip()
    if not database_id:
        db_name = os.getenv(NOTION_DATABASE_NAME, "Opus Dei").strip() or "Opus Dei"
        database_id = notion_find_database_id(token, db_name) or ""
    if not database_id:
        raise RuntimeError("Notion database not found. Set NOTION_DATABASE_ID or share database with integration.")

    title_property = os.getenv(NOTION_TITLE_PROPERTY, "Name").strip() or "Name"
    platform_property = os.getenv(NOTION_PLATFORM_PROPERTY, "Platform").strip() or "Platform"
    platform_value = normalize_text(os.getenv(NOTION_PLATFORM_SPOTIFY_VALUE, "spotify").strip() or "spotify")
    uri_property = os.getenv(NOTION_URI_PROPERTY, "URI").strip() or "URI"

    pages = notion_get_all_pages(database_id, token)
    uri_texts = spotify_uri_text_index(sp, queue)
    match_terms_by_name = load_notion_match_terms_by_name()

    updated = 0
    updates: List[Tuple[str, str]] = []
    for page in pages:
        platform_text = normalize_text(page_property_text(page, platform_property))
        if platform_value and platform_value not in platform_text:
            continue
        title = page_title(page, title_property)
        if not title:
            continue
        matched_uri = best_uri_for_notion_title(title, uri_texts, match_terms_by_name)
        if not matched_uri:
            continue
        existing_uri = page_uri_value(page, uri_property) or ""
        if existing_uri.strip() == matched_uri:
            continue
        page_id = str(page.get("id", "")).strip()
        if not page_id:
            continue
        notion_update_uri(page_id, page, uri_property, matched_uri, token)
        updated += 1
        updates.append((title, matched_uri))
    return updated, updates


def sp_client() -> spotipy.Spotify:
    client_id = require_env(SPOTIFY_CLIENT_ID)
    client_secret = require_env(SPOTIFY_CLIENT_SECRET)
    refresh_token = require_env(SPOTIFY_REFRESH_TOKEN)

    token = refresh_access_token(client_id, client_secret, refresh_token)
    return spotipy.Spotify(
        auth=token,
        requests_timeout=25,
        retries=3,
        status_forcelist=(429, 500, 502, 503, 504),
        backoff_factor=0.5,
    )


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


def paged_items(sp: spotipy.Spotify, first_page: dict):
    pages = 0
    page = first_page
    while isinstance(page, dict):
        for item in (page.get("items") or []):
            yield item
        pages += 1
        if pages >= MAX_PAGES or not page.get("next"):
            return
        page = safe_call(sp.next, page)


def clear_streaming_keep_locals(sp: spotipy.Spotify, playlist_id: str) -> int:
    to_remove: List[str] = []
    results = safe_call(sp.playlist_items, playlist_id, additional_types=["track", "episode"], limit=100)
    if not isinstance(results, dict):
        return 0

    for item in paged_items(sp, results):
        obj = item.get("track")
        if not isinstance(obj, dict):
            continue
        if obj.get("is_local"):
            continue
        uri = obj.get("uri")
        if uri:
            to_remove.append(uri)

    seen = set()
    to_remove = [uri for uri in to_remove if not (uri in seen or seen.add(uri))]

    for idx in range(0, len(to_remove), 100):
        safe_call(sp.playlist_remove_all_occurrences_of_items, playlist_id, to_remove[idx : idx + 100])

    return len(to_remove)


def add_items(sp: spotipy.Spotify, playlist_id: str, uris: List[str]) -> int:
    filtered = [uri for uri in uris if uri]
    if not filtered:
        return 0
    added = 0
    for idx in range(0, len(filtered), 100):
        batch = filtered[idx : idx + 100]
        safe_call(sp.playlist_add_items, playlist_id, batch)
        added += len(batch)
    return added


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
    prefix = sth_date_prefix(datetime.datetime.now())
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
    now = datetime.datetime.now()
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


def monthly_morning_prayer_episode(sp: spotipy.Spotify, show_id: str) -> Tuple[Optional[str], Optional[str]]:
    now = datetime.datetime.now()
    month_full = now.strftime("%B")
    month_abbr = now.strftime("%b")
    year = now.strftime("%Y")
    patterns = [
        rf"\bmorning prayer\s*-\s*{re.escape(month_full)}\s+{re.escape(year)}\b",
        rf"\bmorning prayer\s*-\s*{re.escape(month_abbr)}\s+{re.escape(year)}\b",
        rf"\bmorning prayer\b.*\b{re.escape(month_full)}\b.*\b{re.escape(year)}\b",
        rf"\bmorning prayer\b.*\b{re.escape(month_abbr)}\b.*\b{re.escape(year)}\b",
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


def day_of_year_1_to_365(now: datetime.datetime) -> int:
    doy = int(now.timetuple().tm_yday)
    return 365 if doy > 365 else doy


def bible_in_a_year_for_today(sp: spotipy.Spotify, show_id: str, status: Dict[str, bool]):
    n = day_of_year_1_to_365(datetime.datetime.now())
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
    uri, name = sth_match_today(sp, cfg_value(shows_cfg, "STH", "shows"), list(cfg_token_terms(tokens_cfg, "STH_LAUDS")))
    if uri:
        status["Morning Prayer (STH)"] = True
        status["Morning Prayer (DO fallback)"] = False
        return uri, name
    uri, name = do_date_aware(
        sp, cfg_value(shows_cfg, "DIVINE_OFFICE", "shows"), cfg_token_terms(tokens_cfg, "DO_MORNING")
    )
    status["Morning Prayer (STH)"] = False
    status["Morning Prayer (DO fallback)"] = bool(uri)
    return uri, name


def get_evening_prayer(
    sp: spotipy.Spotify, shows_cfg: Dict[str, Any], tokens_cfg: Dict[str, Any], status: Dict[str, bool]
) -> Tuple[Optional[str], Optional[str]]:
    uri, name = sth_match_today(sp, cfg_value(shows_cfg, "STH", "shows"), list(cfg_token_terms(tokens_cfg, "STH_VESPERS")))
    if uri:
        status["Evening Prayer (STH Vespers)"] = True
        status["Evening Prayer (DO fallback)"] = False
        return uri, name
    uri, name = do_date_aware(
        sp, cfg_value(shows_cfg, "DIVINE_OFFICE", "shows"), cfg_token_terms(tokens_cfg, "DO_EVENING")
    )
    status["Evening Prayer (STH Vespers)"] = False
    status["Evening Prayer (DO fallback)"] = bool(uri)
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
        if weekday != "Sunday":
            status["Fr. Mike Sunday Homily"] = False
            return None
        uri, _ = first_episode(sp, cfg_value(shows_cfg, "FRMIKE_SUNDAY", "shows"))
        status["Fr. Mike Sunday Homily"] = bool(uri)
        return uri

    if key == "SUNDAY_BARRON":
        if weekday != "Sunday":
            status["Bp. Barron Sunday Sermon"] = False
            return None
        uri, _ = first_episode(sp, cfg_value(shows_cfg, "BARRON_SUNDAY", "shows"))
        status["Bp. Barron Sunday Sermon"] = bool(uri)
        return uri

    if key == "MORNING":
        uri, _ = get_morning_prayer(sp, shows_cfg, tokens_cfg, status)
        return uri

    if key == "EVENING":
        uri, _ = get_evening_prayer(sp, shows_cfg, tokens_cfg, status)
        return uri

    if key == "NIGHT":
        uri, _ = get_night_prayer(sp, shows_cfg, tokens_cfg, status)
        return uri

    if key == "USCCB":
        uri, _ = latest_by_release_date(sp, cfg_value(shows_cfg, "DAILY_MASS_READINGS", "shows"))
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

    if key == "MORNING_PRAYER_MONTHLY":
        uri, _ = monthly_morning_prayer_episode(sp, cfg_value(shows_cfg, "MORNING_PRAYER_MONTHLY", "shows"))
        status["Morning Prayer (Monthly Podcast)"] = bool(uri)
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
        cfg = load_playlist_config()
        profiles_cfg = cfg.get("profiles", {})
        catalog_cfg = cfg.get("catalog", {})
        shows_cfg = cfg.get("shows", {})
        fixed_cfg = cfg.get("fixed", {})
        tokens_cfg = cfg.get("tokens", {})

        profile = os.getenv(SPOTIFY_PLAYLIST_PROFILE, "morning").strip().lower() or "morning"
        if profile == "day":
            # Backward compatibility for older env values.
            profile = "morning"

        playlist_id = os.getenv(SPOTIFY_PLAYLIST_ID, "").strip()
        if not playlist_id:
            profile_cfg = profiles_cfg.get(profile)
            if isinstance(profile_cfg, dict):
                playlist_id = str(profile_cfg.get("playlist_id", "")).strip()
        if not playlist_id:
            raise RuntimeError(
                f"Missing required environment variable: {SPOTIFY_PLAYLIST_ID}. "
                f"Set it, or add playlist_id for profile '{profile}' in playlist_config.json profiles."
            )

        # Optional compatibility read; not used by default flow.
        _ = os.getenv(SPOTIFY_USER_ID, "")

        sp = sp_client()
        weekday = datetime.datetime.now().strftime("%A")
        status: Dict[str, bool] = {}

        removed = clear_streaming_keep_locals(sp, playlist_id)
        queue = build_queue_for_profile(
            sp, profile, weekday, status, profiles_cfg, catalog_cfg, shows_cfg, fixed_cfg, tokens_cfg
        )
        written = add_items(sp, playlist_id, queue)
        notion_uri_updates, notion_uri_update_details = sync_notion_uris_for_profile(sp, queue)

        print(f"SUMMARY playlist_id={playlist_id} tracks_written={written}")
        print(f"INFO profile={profile} weekday={weekday} removed_streaming_items={removed}")
        if os.getenv(NOTION_TOKEN, "").strip():
            print(f"INFO notion_uri_rows_updated={notion_uri_updates}")
            log_limit = int(os.getenv(NOTION_URI_LOG_LIMIT, "25").strip() or "25")
            for title, uri in notion_uri_update_details[: max(0, log_limit)]:
                print(f"INFO notion_uri_mapped title={title} uri={uri}")
            if len(notion_uri_update_details) > max(0, log_limit):
                print(
                    f"INFO notion_uri_mapped_truncated shown={max(0, log_limit)} total={len(notion_uri_update_details)}"
                )

        if written == 0:
            raise RuntimeError("No tracks/episodes resolved for this run.")

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
