import base64
import datetime
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional, Set
from zoneinfo import ZoneInfo

import requests

TOKEN_URL = "https://accounts.spotify.com/api/token"
NOTION_VERSION = "2022-06-28"

SPOTIFY_CLIENT_ID = "SPOTIFY_CLIENT_ID"
SPOTIFY_CLIENT_SECRET = "SPOTIFY_CLIENT_SECRET"
SPOTIFY_REFRESH_TOKEN = "SPOTIFY_REFRESH_TOKEN"

NOTION_TOKEN = "NOTION_TOKEN"
NOTION_DATABASE_ID = "NOTION_DATABASE_ID"
NOTION_DATABASE_NAME = "NOTION_DATABASE_NAME"  # fallback search; defaults to Opus Dei
NOTION_TITLE_PROPERTY = "NOTION_TITLE_PROPERTY"  # defaults to Name
NOTION_COMPLETED_PROPERTY = "NOTION_COMPLETED_PROPERTY"  # defaults to Completed
NOTION_URI_PROPERTY = "NOTION_URI_PROPERTY"  # defaults to URI
NOTION_PLATFORM_PROPERTY = "NOTION_PLATFORM_PROPERTY"  # defaults to Platform
NOTION_PLATFORM_NOSYNC_VALUE = "NOTION_PLATFORM_NOSYNC_VALUE"  # defaults to spotify-nosync

SPOTIFY_NOTION_SYNC_CONFIG = "SPOTIFY_NOTION_SYNC_CONFIG"  # defaults to notion_spotify_sync_config.json
SPOTIFY_RECENT_LOOKBACK_HOURS = "SPOTIFY_RECENT_LOOKBACK_HOURS"  # default 3
SPOTIFY_SYNC_TIMEZONE = "SPOTIFY_SYNC_TIMEZONE"  # default America/Chicago
SPOTIFY_CONFIG_FILE = "SPOTIFY_CONFIG_FILE"  # defaults to playlist_config.json
SPOTIFY_COMPLETION_LOG_LIMIT = "SPOTIFY_COMPLETION_LOG_LIMIT"  # defaults to 25
SPOTIFY_URI_DEBUG_LOG_LIMIT = "SPOTIFY_URI_DEBUG_LOG_LIMIT"  # defaults to 25
SPOTIFY_EPISODE_PROBE_ENABLED = "SPOTIFY_EPISODE_PROBE_ENABLED"  # defaults to true
SPOTIFY_EPISODE_PROBE_MIN_PROGRESS_PCT = "SPOTIFY_EPISODE_PROBE_MIN_PROGRESS_PCT"  # defaults to 0.7


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


def spotify_headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def spotify_get(url: str, token: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    response = requests.get(url, headers=spotify_headers(token), params=params, timeout=30)
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict):
        raise RuntimeError("Unexpected Spotify API response format.")
    return data


def episode_id_from_uri(uri: str) -> str:
    text = str(uri or "").strip()
    match = re.match(r"^spotify:episode:([A-Za-z0-9]+)$", text)
    if not match:
        return ""
    return match.group(1)


def bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "y", "on"}


def float_env(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
        return max(0.0, min(1.0, value))
    except Exception:
        return default


def spotify_episode_probe_status(token: str, uri: str) -> Dict[str, Any]:
    episode_id = episode_id_from_uri(uri)
    if not episode_id:
        return {"ok": False, "reason": "not_episode_uri"}
    try:
        data = spotify_get(f"https://api.spotify.com/v1/episodes/{episode_id}", token, {"market": "US"})
    except requests.HTTPError as exc:
        return {"ok": False, "reason": f"http_{getattr(exc.response, 'status_code', 'error')}"}

    resume = data.get("resume_point") or {}
    fully_played = bool(resume.get("fully_played"))
    progress_ms = int(resume.get("resume_position_ms") or 0)
    duration_ms = int(data.get("duration_ms") or 0)
    pct = (progress_ms / duration_ms) if duration_ms > 0 else 0.0
    return {
        "ok": True,
        "fully_played": fully_played,
        "progress_ms": progress_ms,
        "duration_ms": duration_ms,
        "progress_pct": pct,
    }


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


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", text.lower())).strip()


def infer_time_of_day_from_name(notion_name: str) -> str:
    lowered = notion_name.lower()
    if "(morning)" in lowered:
        return "morning"
    if "(midday)" in lowered:
        return "midday"
    if "(evening)" in lowered:
        return "evening"
    return "any"


def current_time_of_day() -> str:
    tz_name = os.getenv(SPOTIFY_SYNC_TIMEZONE, "America/Chicago").strip() or "America/Chicago"
    now = datetime.datetime.now(ZoneInfo(tz_name))
    hour = now.hour
    if 4 <= hour <= 10:
        return "morning"
    if 11 <= hour <= 15:
        return "midday"
    return "evening"


def load_sync_config() -> List[Dict[str, Any]]:
    config_path = os.getenv(SPOTIFY_NOTION_SYNC_CONFIG, "notion_spotify_sync_config.json").strip()
    with open(config_path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)

    mappings = payload.get("mappings")
    if not isinstance(mappings, list) or not mappings:
        raise RuntimeError("Sync config must include a non-empty 'mappings' list.")

    validated: List[Dict[str, Any]] = []
    for row in mappings:
        if not isinstance(row, dict):
            continue
        notion_name = str(row.get("notion_name", "")).strip()
        match_any = row.get("match_any")
        if not notion_name or not isinstance(match_any, list):
            continue
        terms = [normalize_text(str(term)) for term in match_any if str(term).strip()]
        terms = [term for term in terms if term]
        if not terms:
            continue
        time_of_day = str(row.get("time_of_day", "")).strip().lower() or infer_time_of_day_from_name(notion_name)
        if time_of_day not in {"any", "morning", "midday", "evening"}:
            continue
        profiles = row.get("profiles")
        if not isinstance(profiles, list):
            profiles = ["any"]
        profile_values = [str(p).strip().lower() for p in profiles if str(p).strip()]
        if not profile_values:
            profile_values = ["any"]
        if any(p not in {"any", "morning", "midday", "night"} for p in profile_values):
            continue
        validated.append(
            {"notion_name": notion_name, "match_any": terms, "time_of_day": time_of_day, "profiles": profile_values}
        )

    if not validated:
        raise RuntimeError("No valid mappings found in sync config.")
    return validated


def lookup_notion_database_id(token: str) -> str:
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
        title = ""
        title_parts = item.get("title") or []
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


def load_playlist_profile_by_id() -> Dict[str, str]:
    config_path = os.getenv(SPOTIFY_CONFIG_FILE, "playlist_config.json").strip() or "playlist_config.json"
    with open(config_path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)
    profiles = payload.get("profiles")
    if not isinstance(profiles, dict):
        return {}
    out: Dict[str, str] = {}
    for profile_name, profile_value in profiles.items():
        if not isinstance(profile_value, dict):
            continue
        playlist_id = str(profile_value.get("playlist_id", "")).strip()
        if playlist_id:
            out[playlist_id] = str(profile_name).strip().lower()
    return out


def playlist_id_from_context_uri(context_uri: str) -> str:
    if not context_uri:
        return ""
    match = re.match(r"^spotify:playlist:([A-Za-z0-9]+)$", context_uri.strip())
    if not match:
        return ""
    return match.group(1)


def collect_recent_spotify_activity(token: str) -> Dict[str, Set[str]]:
    lookback_hours = int(os.getenv(SPOTIFY_RECENT_LOOKBACK_HOURS, "3").strip() or "3")
    lookback_hours = max(1, min(24, lookback_hours))
    after = int((datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=lookback_hours)).timestamp() * 1000)

    profile_by_playlist = load_playlist_profile_by_id()

    seen_texts: Set[str] = set()
    seen_uris: Set[str] = set()
    texts_by_profile: Dict[str, Set[str]] = {"morning": set(), "midday": set(), "night": set()}
    uris_by_profile: Dict[str, Set[str]] = {"morning": set(), "midday": set(), "night": set()}

    def add_text(text: str, profile: str) -> None:
        normalized = normalize_text(text)
        if not normalized:
            return
        seen_texts.add(normalized)
        if profile in texts_by_profile:
            texts_by_profile[profile].add(normalized)

    def add_uri(uri: str, profile: str) -> None:
        value = str(uri).strip()
        if not value:
            return
        seen_uris.add(value)
        if profile in uris_by_profile:
            uris_by_profile[profile].add(value)

    recent = spotify_get(
        "https://api.spotify.com/v1/me/player/recently-played",
        token,
        {"limit": 50, "after": after},
    )
    for item in recent.get("items") or []:
        if not isinstance(item, dict):
            continue
        context = item.get("context")
        profile = ""
        if isinstance(context, dict):
            playlist_id = playlist_id_from_context_uri(str(context.get("uri", "")))
            profile = profile_by_playlist.get(playlist_id, "")
        track = item.get("track")
        if not isinstance(track, dict):
            continue
        add_uri(str(track.get("uri", "")).strip(), profile)
        name = str(track.get("name", "")).strip()
        if name:
            add_text(name, profile)
        artists = track.get("artists") or []
        artist_names = [str(a.get("name", "")).strip() for a in artists if isinstance(a, dict)]
        if artist_names:
            add_text(" ".join(artist_names), profile)
        if name and artist_names:
            add_text(f"{name} {' '.join(artist_names)}", profile)

    # Include currently playing in case user is listening to a podcast episode right now.
    response = requests.get(
        "https://api.spotify.com/v1/me/player/currently-playing",
        headers=spotify_headers(token),
        timeout=30,
    )
    if response.status_code == 200:
        current = response.json()
        if isinstance(current, dict):
            profile = ""
            context = current.get("context")
            if isinstance(context, dict):
                playlist_id = playlist_id_from_context_uri(str(context.get("uri", "")))
                profile = profile_by_playlist.get(playlist_id, "")
            item = current.get("item")
            if isinstance(item, dict):
                add_uri(str(item.get("uri", "")).strip(), profile)
                current_name = str(item.get("name", "")).strip()
                if current_name:
                    add_text(current_name, profile)
                show = item.get("show")
                if isinstance(show, dict):
                    show_name = str(show.get("name", "")).strip()
                    if show_name:
                        add_text(show_name, profile)
                    if current_name and show_name:
                        add_text(f"{current_name} {show_name}", profile)

    out: Dict[str, Set[str]] = {"all_texts": seen_texts, "all_uris": seen_uris}
    for k, v in texts_by_profile.items():
        out[f"{k}_texts"] = v
    for k, v in uris_by_profile.items():
        out[f"{k}_uris"] = v
    return out


def notion_get_all_pages(database_id: str, token: str) -> List[Dict[str, Any]]:
    pages: List[Dict[str, Any]] = []
    next_cursor: Optional[str] = None
    while True:
        body: Dict[str, Any] = {"page_size": 100}
        if next_cursor:
            body["start_cursor"] = next_cursor
        data = notion_call("POST", f"https://api.notion.com/v1/databases/{database_id}/query", token, body)
        results = data.get("results") or []
        for result in results:
            if isinstance(result, dict):
                pages.append(result)
        if not data.get("has_more"):
            break
        next_cursor = str(data.get("next_cursor", "")).strip() or None
    return pages


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


def page_checkbox(page: Dict[str, Any], checkbox_property: str) -> Optional[bool]:
    props = page.get("properties") or {}
    prop = props.get(checkbox_property) or {}
    if prop.get("type") != "checkbox":
        return None
    return bool(prop.get("checkbox"))


def page_uri(page: Dict[str, Any], uri_property: str) -> str:
    props = page.get("properties") or {}
    prop = props.get(uri_property) or {}
    ptype = str(prop.get("type", "")).strip()
    if ptype == "url":
        return str(prop.get("url", "")).strip()
    if ptype == "rich_text":
        vals = prop.get("rich_text") or []
        parts = [str(v.get("plain_text", "")).strip() for v in vals if isinstance(v, dict) and v.get("plain_text")]
        return " ".join(parts).strip()
    return ""


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


def update_page_checkbox(page_id: str, checkbox_property: str, value: bool, token: str) -> None:
    body = {"properties": {checkbox_property: {"checkbox": value}}}
    notion_call("PATCH", f"https://api.notion.com/v1/pages/{page_id}", token, body)


def main() -> int:
    try:
        spotify_token = refresh_access_token(
            require_env(SPOTIFY_CLIENT_ID),
            require_env(SPOTIFY_CLIENT_SECRET),
            require_env(SPOTIFY_REFRESH_TOKEN),
        )
        notion_token = require_env(NOTION_TOKEN)
        mappings = load_sync_config()

        db_id = lookup_notion_database_id(notion_token)
        title_property = os.getenv(NOTION_TITLE_PROPERTY, "Name").strip() or "Name"
        completed_property = os.getenv(NOTION_COMPLETED_PROPERTY, "Completed").strip() or "Completed"
        uri_property = os.getenv(NOTION_URI_PROPERTY, "URI").strip() or "URI"
        platform_property = os.getenv(NOTION_PLATFORM_PROPERTY, "Platform").strip() or "Platform"
        nosync_value = normalize_text(os.getenv(NOTION_PLATFORM_NOSYNC_VALUE, "spotify-nosync").strip() or "spotify-nosync")

        listened = collect_recent_spotify_activity(spotify_token)
        listened_texts = listened.get("all_texts", set())
        listened_uris = listened.get("all_uris", set())
        episode_probe_enabled = bool_env(SPOTIFY_EPISODE_PROBE_ENABLED, True)
        episode_probe_min_pct = float_env(SPOTIFY_EPISODE_PROBE_MIN_PROGRESS_PCT, 0.7)
        if not listened_texts:
            print("INFO no_recent_spotify_items_found")
        print(f"INFO spotify_activity texts={len(listened_texts)} uris={len(listened_uris)}")

        matches: Set[str] = set()
        now_time_of_day = current_time_of_day()
        for mapping in mappings:
            notion_name = str(mapping["notion_name"])
            terms = mapping["match_any"]
            mapping_time_of_day = str(mapping.get("time_of_day", "any"))
            if mapping_time_of_day != "any" and mapping_time_of_day != now_time_of_day:
                continue
            mapping_profiles = [str(p) for p in mapping.get("profiles", ["any"])]
            candidate_texts: Set[str] = set()
            if "any" in mapping_profiles:
                candidate_texts = listened_texts
            else:
                for profile in mapping_profiles:
                    candidate_texts |= listened.get(f"{profile}_texts", set())
                if not candidate_texts:
                    # Spotify does not always provide playlist context; fall back to all texts.
                    candidate_texts = listened_texts
            for text in candidate_texts:
                if any(term in text for term in terms):
                    matches.add(normalize_text(notion_name))
                    break

        pages = notion_get_all_pages(db_id, notion_token)
        updated = 0
        scanned = 0
        skipped_nosync = 0
        matched_by_uri = 0
        matched_by_probe = 0
        rows_with_uri = 0
        uri_row_matched_titles: List[str] = []
        uri_row_unmatched_titles: List[str] = []
        uri_row_probe_matched_titles: List[str] = []
        uri_row_probe_unmatched_titles: List[str] = []
        uri_row_already_checked_titles: List[str] = []
        probe_debug_rows: List[str] = []
        updated_by_uri_titles: List[str] = []
        updated_by_probe_titles: List[str] = []
        updated_by_text_titles: List[str] = []
        probe_cache: Dict[str, Dict[str, Any]] = {}
        for page in pages:
            scanned += 1
            platform_text = normalize_text(page_property_text(page, platform_property))
            if nosync_value and nosync_value in platform_text:
                skipped_nosync += 1
                continue
            title = page_title(page, title_property)
            if not title:
                continue
            uri_match = False
            row_uri = page_uri(page, uri_property)
            if row_uri:
                rows_with_uri += 1
                if row_uri in listened_uris:
                    uri_match = True
                    matched_by_uri += 1
                    uri_row_matched_titles.append(title)
                else:
                    probe_match = False
                    if episode_probe_enabled and episode_id_from_uri(row_uri):
                        if row_uri not in probe_cache:
                            probe_cache[row_uri] = spotify_episode_probe_status(spotify_token, row_uri)
                        probe = probe_cache[row_uri]
                        if probe.get("ok"):
                            probe_debug_rows.append(
                                f"title={title} uri={row_uri} fully_played={bool(probe.get('fully_played'))} "
                                f"progress_pct={float(probe.get('progress_pct', 0.0)):.3f}"
                            )
                        else:
                            probe_debug_rows.append(
                                f"title={title} uri={row_uri} probe_error={probe.get('reason', 'unknown')}"
                            )
                        if probe.get("ok"):
                            if bool(probe.get("fully_played")) or float(probe.get("progress_pct", 0.0)) >= episode_probe_min_pct:
                                probe_match = True
                    if probe_match:
                        uri_match = True
                        matched_by_probe += 1
                        uri_row_probe_matched_titles.append(title)
                    else:
                        uri_row_unmatched_titles.append(title)
                        if episode_probe_enabled and episode_id_from_uri(row_uri):
                            uri_row_probe_unmatched_titles.append(title)
                        # If a row has a URI, require URI/probe match. Do not fall back to text.
                        continue
            elif normalize_text(title) not in matches:
                continue
            checked = page_checkbox(page, completed_property)
            if checked is None:
                raise RuntimeError(
                    f"Property '{completed_property}' is missing or not a checkbox in at least one row."
                )
            if checked:
                if uri_match:
                    uri_row_already_checked_titles.append(title)
                continue
            page_id = str(page.get("id", "")).strip()
            if not page_id:
                continue
            update_page_checkbox(page_id, completed_property, True, notion_token)
            updated += 1
            if uri_match:
                if title in uri_row_probe_matched_titles:
                    updated_by_probe_titles.append(title)
                else:
                    updated_by_uri_titles.append(title)
            else:
                updated_by_text_titles.append(title)

        print(
            f"SUMMARY notion_db={db_id} rows_scanned={scanned} rows_marked_completed={updated} "
            f"matched_targets={len(matches)} matched_by_uri={matched_by_uri} matched_by_probe={matched_by_probe} "
            f"rows_with_uri={rows_with_uri} rows_skipped_nosync={skipped_nosync}"
        )
        log_limit = int(os.getenv(SPOTIFY_COMPLETION_LOG_LIMIT, "25").strip() or "25")
        uri_log_limit = int(os.getenv(SPOTIFY_URI_DEBUG_LOG_LIMIT, "25").strip() or "25")
        for uri in sorted(listened_uris)[: max(0, uri_log_limit)]:
            print(f"INFO listened_uri uri={uri}")
        if len(listened_uris) > max(0, uri_log_limit):
            print(f"INFO listened_uri_truncated shown={max(0, uri_log_limit)} total={len(listened_uris)}")
        for title in uri_row_matched_titles[: max(0, uri_log_limit)]:
            print(f"INFO notion_uri_match title={title}")
        for title in uri_row_unmatched_titles[: max(0, uri_log_limit)]:
            print(f"INFO notion_uri_not_played title={title}")
        for title in uri_row_probe_matched_titles[: max(0, uri_log_limit)]:
            print(f"INFO notion_uri_probe_match title={title}")
        for title in uri_row_probe_unmatched_titles[: max(0, uri_log_limit)]:
            print(f"INFO notion_uri_probe_not_matched title={title}")
        for row in probe_debug_rows[: max(0, uri_log_limit)]:
            print(f"INFO episode_probe {row}")
        for title in uri_row_already_checked_titles[: max(0, uri_log_limit)]:
            print(f"INFO notion_uri_already_checked title={title}")
        for title in updated_by_uri_titles[: max(0, log_limit)]:
            print(f"INFO completion_marked method=uri title={title}")
        for title in updated_by_probe_titles[: max(0, log_limit)]:
            print(f"INFO completion_marked method=episode_probe title={title}")
        for title in updated_by_text_titles[: max(0, log_limit)]:
            print(f"INFO completion_marked method=text title={title}")
        return 0
    except requests.HTTPError as exc:
        print(f"ERROR HTTP failure: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
