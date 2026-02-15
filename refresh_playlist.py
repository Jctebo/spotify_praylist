import base64
import datetime
import os
import re
import sys
import time
from typing import Dict, List, Optional, Tuple

import requests
import spotipy
from spotipy.exceptions import SpotifyException

TOKEN_URL = "https://accounts.spotify.com/api/token"
SCOPES_NOTE = "playlist-modify-private playlist-modify-public playlist-read-private"

# ===== Environment variables (required) =====
SPOTIFY_CLIENT_ID = "SPOTIFY_CLIENT_ID"
SPOTIFY_CLIENT_SECRET = "SPOTIFY_CLIENT_SECRET"
SPOTIFY_REFRESH_TOKEN = "SPOTIFY_REFRESH_TOKEN"
SPOTIFY_PLAYLIST_ID = "SPOTIFY_PLAYLIST_ID"

# Optional environment variable; only used for compatibility with existing setups.
SPOTIFY_USER_ID = "SPOTIFY_USER_ID"

# Optional selector for which playlist profile to build into SPOTIFY_PLAYLIST_ID.
SPOTIFY_PLAYLIST_PROFILE = "SPOTIFY_PLAYLIST_PROFILE"  # morning|midday|night, default morning


# ===== Core show IDs =====
DIVINE_OFFICE_SHOW_ID = "70ydTdzunoqWAsvutFIkHM"
DTH_SHOW_ID = "4SYYL51uogYDtHxDPznYP1"
STH_SHOW_ID = "5MvuGtXFIbfej3dz8cKBVp"
BARRON_ROSARY_SHOW_ID = "0aWJbTYTENolXYpBDSgzcH"
LBS_EXEGESIS_SHOW_ID = "753FVUsio4Y6GjFvbGpvF0"
DAILY_MASS_READINGS_SHOW_ID = "3IANujvjklSBVf6ioZd03N"
DAILY_TV_MASS_SHOW_ID = "2WwFQr9a6BX7YQ4pkoIijp"
FRMIKE_SUNDAY_SHOW_ID = "1CK5AHgLneCo2sE17UOfdV"
BARRON_SUNDAY_SHOW_ID = "5G6vtvZBIQMpQ8TLgXLBiK"
STATIONS_FRIDAY_URI = "spotify:episode:4rZ8YJKq1iuqiypu3Q5TRm"
SAINT_OF_DAY_SHOW_ID = "1skJeU3tBmO7ftJ2ugNyYd"
BIBLE_IN_A_YEAR_SHOW_ID = "4Pppt42NPK2XzKwNIoW7BR"

# ===== Fixed items =====
ANGELUS_SONG_URI = "spotify:track:39Jgl6ST4fQj4fNyRSQZFk"
ANGELUS_PODCAST_URI = "spotify:episode:2HNK8wLRWHh0mJ9xmJjlUD"
NIGHT_BEFORE_COMPLINE_URI = "spotify:episode:1I8pCawzp1Wd5pE0NcHmUj"

# ===== Matching tokens =====
MATCH_AC = "Auxilium Christianorum"
STH_MATCH_LAUDS = "Lauds"
STH_MATCH_VESPERS = "Vespers"
DO_MATCH_MORNING = "Morning Prayer"
DO_MATCH_OFFICE = "Office of Readings"
DO_MATCH_MIDMORNING = "Midmorning Prayer"
DO_MATCH_MIDDAY = "Midday Prayer"
DO_MATCH_MIDAFT = "Midafternoon Prayer"
DO_MATCH_EVENING = "Evening Prayer"
DO_MATCH_NIGHT_ANY = ("Night Prayer", "Compline")

# ===== Playlist profiles =====
PLAYLISTS = {
    "morning": {
        "enable": {
            "ANGELUS_SONG": True,
            "AUXILIUM": True,
            "SUNDAY_FRMIKE": True,
            "SUNDAY_BARRON": True,
            "MORNING": True,
            "USCCB": False,
            "DGE": False,
            "TVMASS": False,
            "OFFICE": False,
            "MIDMORNING": False,
            "MIDDAY": False,
            "ROSARY": False,
            "MIDAFTERNOON": False,
            "ANGELUS_POD": False,
            "EVENING": False,
            "NIGHT": False,
            "FRIDAY_STATIONS": False,
            "SAINT_OF_DAY": False,
            "NIGHT_PRE_COMPLINE": False,
            "BIBLE_IN_A_YEAR": False,
        },
        "order": [
            "ANGELUS_SONG",
            "MORNING",
            "AUXILIUM",
            "SUNDAY_FRMIKE",
            "SUNDAY_BARRON",
        ],
    },
    "midday": {
        "enable": {
            "ANGELUS_SONG": True,
            "AUXILIUM": False,
            "SUNDAY_FRMIKE": False,
            "SUNDAY_BARRON": False,
            "MORNING": False,
            "USCCB": True,
            "DGE": False,
            "TVMASS": False,
            "OFFICE": False,
            "MIDMORNING": False,
            "MIDDAY": False,
            "ROSARY": True,
            "MIDAFTERNOON": True,
            "ANGELUS_POD": False,
            "EVENING": False,
            "NIGHT": False,
            "FRIDAY_STATIONS": False,
            "SAINT_OF_DAY": True,
            "NIGHT_PRE_COMPLINE": False,
            "BIBLE_IN_A_YEAR": True,
        },
        "order": [
            "BIBLE_IN_A_YEAR",
            "SAINT_OF_DAY",
            "ROSARY",
            "MIDAFTERNOON",
            "USCCB",
            "ANGELUS_SONG",
        ],
    },
    "night": {
        "enable": {
            "ANGELUS_SONG": True,
            "AUXILIUM": False,
            "SUNDAY_FRMIKE": False,
            "SUNDAY_BARRON": False,
            "MORNING": False,
            "USCCB": False,
            "DGE": False,
            "TVMASS": False,
            "OFFICE": False,
            "MIDMORNING": False,
            "MIDDAY": False,
            "ROSARY": False,
            "MIDAFTERNOON": False,
            "ANGELUS_POD": False,
            "EVENING": True,
            "NIGHT": True,
            "FRIDAY_STATIONS": False,
            "SAINT_OF_DAY": False,
            "NIGHT_PRE_COMPLINE": True,
            "BIBLE_IN_A_YEAR": False,
        },
        "order": [
            "ANGELUS_SONG",
            "EVENING",
            "NIGHT_PRE_COMPLINE",
            "NIGHT",
        ],
    },
}

MARKETS_TO_TRY = ["US", None, "GB", "CA", "AU"]
MAX_PAGES = 10


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


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


def do_date_aware(sp: spotipy.Spotify, terms) -> Tuple[Optional[str], Optional[str]]:
    now = datetime.datetime.now()
    yst = now - datetime.timedelta(days=1)

    res = safe_call(sp.show_episodes, DIVINE_OFFICE_SHOW_ID, limit=50, market="US")
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


def day_of_year_1_to_365(now: datetime.datetime) -> int:
    doy = int(now.timetuple().tm_yday)
    return 365 if doy > 365 else doy


def bible_in_a_year_for_today(sp: spotipy.Spotify, status: Dict[str, bool]):
    n = day_of_year_1_to_365(datetime.datetime.now())
    pattern = re.compile(rf"\bDay\s*0*{n}\b", re.IGNORECASE)

    res = safe_call(sp.show_episodes, BIBLE_IN_A_YEAR_SHOW_ID, limit=50, market="US")
    if not isinstance(res, dict):
        status["Bible in a Year"] = False
        return None, None, n

    items = list(res.get("items") or [])
    if res.get("next"):
        res2 = safe_call(sp.next, res)
        if isinstance(res2, dict):
            items += list(res2.get("items") or [])

    for ep in items:
        if not isinstance(ep, dict):
            continue
        name = ep.get("name") or ""
        if pattern.search(name):
            uri = ep.get("uri")
            if uri:
                status["Bible in a Year"] = True
                return uri, name, n

    status["Bible in a Year"] = False
    return None, None, n


def get_auxilium_for_weekday(sp: spotipy.Spotify, weekday_name: str) -> Tuple[Optional[str], Optional[str]]:
    res = safe_call(sp.show_episodes, DTH_SHOW_ID, limit=50, market="US")
    if not isinstance(res, dict):
        return None, None
    for ep in (res.get("items") or []):
        if not isinstance(ep, dict):
            continue
        name = ep.get("name") or ""
        if MATCH_AC.lower() in name.lower() and weekday_name.lower() in name.lower():
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


def get_morning_prayer(sp: spotipy.Spotify, status: Dict[str, bool]) -> Tuple[Optional[str], Optional[str]]:
    uri, name = sth_match_today(sp, STH_SHOW_ID, [STH_MATCH_LAUDS])
    if uri:
        status["Morning Prayer (STH)"] = True
        status["Morning Prayer (DO fallback)"] = False
        return uri, name
    uri, name = do_date_aware(sp, (DO_MATCH_MORNING,))
    status["Morning Prayer (STH)"] = False
    status["Morning Prayer (DO fallback)"] = bool(uri)
    return uri, name


def get_evening_prayer(sp: spotipy.Spotify, status: Dict[str, bool]) -> Tuple[Optional[str], Optional[str]]:
    uri, name = sth_match_today(sp, STH_SHOW_ID, [STH_MATCH_VESPERS])
    if uri:
        status["Evening Prayer (STH Vespers)"] = True
        status["Evening Prayer (DO fallback)"] = False
        return uri, name
    uri, name = do_date_aware(sp, (DO_MATCH_EVENING, "Vespers"))
    status["Evening Prayer (STH Vespers)"] = False
    status["Evening Prayer (DO fallback)"] = bool(uri)
    return uri, name


def get_night_prayer(sp: spotipy.Spotify, status: Dict[str, bool]) -> Tuple[Optional[str], Optional[str]]:
    uri, name = do_date_aware(sp, DO_MATCH_NIGHT_ANY)
    status["Night/Compline (DO)"] = bool(uri)
    return uri, name


def resolve_item_uri(sp: spotipy.Spotify, key: str, weekday: str, status: Dict[str, bool]) -> Optional[str]:
    if key == "ANGELUS_SONG":
        status["Angelus Song (Daughters of Mary)"] = True
        return ANGELUS_SONG_URI

    if key == "ANGELUS_POD":
        status["Angelus Podcast (The Prayer Podcast)"] = True
        return ANGELUS_PODCAST_URI

    if key == "NIGHT_PRE_COMPLINE":
        status["Night Pre-Compline (fixed episode)"] = True
        return NIGHT_BEFORE_COMPLINE_URI

    if key == "BIBLE_IN_A_YEAR":
        uri, _, _ = bible_in_a_year_for_today(sp, status)
        return uri

    if key == "SAINT_OF_DAY":
        uri, _ = latest_by_release_date(sp, SAINT_OF_DAY_SHOW_ID)
        status["Saint of the Day"] = bool(uri)
        return uri

    if key == "AUXILIUM":
        uri, _ = get_auxilium_for_weekday(sp, weekday)
        status["Auxilium Christianorum"] = bool(uri)
        return uri

    if key == "SUNDAY_FRMIKE":
        if weekday != "Sunday":
            status["Fr. Mike Sunday Homily"] = False
            return None
        uri, _ = first_episode(sp, FRMIKE_SUNDAY_SHOW_ID)
        status["Fr. Mike Sunday Homily"] = bool(uri)
        return uri

    if key == "SUNDAY_BARRON":
        if weekday != "Sunday":
            status["Bp. Barron Sunday Sermon"] = False
            return None
        uri, _ = first_episode(sp, BARRON_SUNDAY_SHOW_ID)
        status["Bp. Barron Sunday Sermon"] = bool(uri)
        return uri

    if key == "MORNING":
        uri, _ = get_morning_prayer(sp, status)
        return uri

    if key == "EVENING":
        uri, _ = get_evening_prayer(sp, status)
        return uri

    if key == "NIGHT":
        uri, _ = get_night_prayer(sp, status)
        return uri

    if key == "USCCB":
        uri, _ = latest_by_release_date(sp, DAILY_MASS_READINGS_SHOW_ID)
        status["USCCB Daily Readings"] = bool(uri)
        return uri

    if key == "DGE":
        uri, _ = latest_by_release_date(sp, LBS_EXEGESIS_SHOW_ID)
        status["Daily Gospel Exegesis"] = bool(uri)
        return uri

    if key == "TVMASS":
        uri, _ = first_episode(sp, DAILY_TV_MASS_SHOW_ID)
        status["Daily TV Mass"] = bool(uri)
        return uri

    if key == "OFFICE":
        uri, _ = do_date_aware(sp, (DO_MATCH_OFFICE,))
        status["Office of Readings"] = bool(uri)
        return uri

    if key == "MIDMORNING":
        uri, _ = do_date_aware(sp, (DO_MATCH_MIDMORNING,))
        status["Midmorning Prayer"] = bool(uri)
        return uri

    if key == "MIDDAY":
        uri, _ = do_date_aware(sp, (DO_MATCH_MIDDAY,))
        status["Midday Prayer"] = bool(uri)
        return uri

    if key == "MIDAFTERNOON":
        uri, _ = do_date_aware(sp, (DO_MATCH_MIDAFT,))
        status["Midafternoon Prayer"] = bool(uri)
        return uri

    if key == "ROSARY":
        mystery = rosary_mystery_for_weekday(weekday)
        uri, _ = episode_title_contains(sp, BARRON_ROSARY_SHOW_ID, mystery)
        status[f"Rosary ({mystery})"] = bool(uri)
        return uri

    if key == "FRIDAY_STATIONS":
        status["Stations of the Cross (Friday)"] = weekday == "Friday"
        return STATIONS_FRIDAY_URI if weekday == "Friday" else None

    status[f"UNKNOWN:{key}"] = False
    return None


def build_queue_for_profile(sp: spotipy.Spotify, profile_name: str, weekday: str, status: Dict[str, bool]) -> List[str]:
    cfg = PLAYLISTS.get(profile_name)
    if not cfg:
        raise RuntimeError(f"Invalid profile '{profile_name}'. Use one of: {', '.join(sorted(PLAYLISTS.keys()))}")

    enable = cfg.get("enable", {})
    order = cfg.get("order", [])

    queue: List[str] = []
    resolved: Dict[str, Optional[str]] = {}

    for key in order:
        if not enable.get(key, False):
            continue
        uri = resolve_item_uri(sp, key, weekday, status)
        resolved[key] = uri
        if uri:
            queue.append(uri)

    if enable.get("FRIDAY_STATIONS", False) and weekday == "Friday":
        stations_uri = STATIONS_FRIDAY_URI
        if "ROSARY" in resolved and resolved.get("ROSARY") in queue:
            idx = queue.index(resolved["ROSARY"]) + 1
            queue.insert(idx, stations_uri)
        else:
            queue.append(stations_uri)

    return queue


def main() -> int:
    try:
        playlist_id = require_env(SPOTIFY_PLAYLIST_ID)
        profile = os.getenv(SPOTIFY_PLAYLIST_PROFILE, "morning").strip().lower() or "morning"
        if profile == "day":
            # Backward compatibility for older env values.
            profile = "morning"

        # Optional compatibility read; not used by default flow.
        _ = os.getenv(SPOTIFY_USER_ID, "")

        sp = sp_client()
        weekday = datetime.datetime.now().strftime("%A")
        status: Dict[str, bool] = {}

        removed = clear_streaming_keep_locals(sp, playlist_id)
        queue = build_queue_for_profile(sp, profile, weekday, status)
        written = add_items(sp, playlist_id, queue)

        print(f"SUMMARY playlist_id={playlist_id} tracks_written={written}")
        print(f"INFO profile={profile} weekday={weekday} removed_streaming_items={removed}")

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
