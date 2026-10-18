import base64
import datetime
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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
    normalize_spotify_queue_uri,
    playlist_definition_matches_filter,
)
from jobs.novena.liturgical_helpers import is_easter_season_for_date

TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_CLIENT_ID = "SPOTIFY_CLIENT_ID"
SPOTIFY_CLIENT_SECRET = "SPOTIFY_CLIENT_SECRET"
SPOTIFY_REFRESH_TOKEN = "SPOTIFY_REFRESH_TOKEN"
SPOTIFY_PLAYLIST_ID = "SPOTIFY_PLAYLIST_ID"
SPOTIFY_PLAYLIST_NAME = "SPOTIFY_PLAYLIST_NAME"
JOB_UTC_OFFSET = "JOB_UTC_OFFSET"
DEFAULT_UTC_OFFSET = "-06:00"
RUNTIME_TZ = datetime.timezone(datetime.timedelta(hours=-6))
MARKETS_TO_TRY = ["US", None, "GB", "CA", "AU"]
MAX_BIAY_EPISODES_TO_SCAN = 2500

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


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


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
        status[f"Seasonal:{contract.name}:{season_label}"] = True
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
        status[contract.name] = bool(uris)
        return uris

    primary_spec = contract.spotify_uri or contract.resolver

    uri = resolve_spec_uri(sp, primary_spec, weekday, status, shows_cfg, fixed_cfg, tokens_cfg)
    if not uri and contract.fallback_resolver:
        uri = resolve_spec_uri(sp, contract.fallback_resolver, weekday, status, shows_cfg, fixed_cfg, tokens_cfg)
        status[f"Fallback used:{contract.name}"] = bool(uri)
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
            status[f"Gated:{contract.name}"] = False
            continue

        eligible_contracts += 1
        uris = resolve_contract_uris(sp, contract, weekday, current_date, status, shows_cfg, fixed_cfg, tokens_cfg)
        if uris:
            queue.extend(uris)
        else:
            status[f"Unresolved:{contract.name}"] = False

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
def main() -> int:
    try:
        set_runtime_timezone({})
        _, shows_cfg, fixed_cfg, tokens_cfg = load_resolver_runtime_config({})

        sp, spotify_token = sp_client()
        current_now = local_now()
        current_date = current_now.date()
        weekday = current_now.strftime("%A")
        source = "playlist_contracts"
        all_contracts = load_spotify_queue_contracts()
        contracts_by_key = {contract.key: contract for contract in all_contracts}
        playlist_filter = os.getenv(SPOTIFY_PLAYLIST_NAME, "").strip()
        all_playlists = load_spotify_playlist_definitions(contracts=all_contracts)
        selected_playlists = [
            playlist for playlist in all_playlists if playlist_definition_matches_filter(playlist, playlist_filter)
        ]
        if playlist_filter and not selected_playlists:
            raise RuntimeError(f"No Spotify playlist definition matched '{playlist_filter}'.")

        runs: List[Dict[str, Any]] = []
        for target in selected_playlists:
            status: Dict[str, bool] = {}
            ordered_contracts = tuple(contracts_by_key[key] for key in target.contracts)
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
            written = recreate_playlist_items(spotify_token, playlist_id, queue)
            print(f"SUMMARY playlist={playlist_name} playlist_id={playlist_id} tracks_written={written}")
            print(f"INFO playlist={playlist_name} weekday={weekday} playlist_recreated=true source={source}")
            print(f"INFO utc_offset={current_now.strftime('%z')}")
            for name, ok in sorted(status.items()):
                print(f"INFO resolver_status playlist={playlist_name} name={name} ok={str(ok).lower()}")
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
