import base64
import datetime
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional, Set

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

SPOTIFY_NOTION_SYNC_CONFIG = "SPOTIFY_NOTION_SYNC_CONFIG"  # defaults to notion_spotify_sync_config.json
SPOTIFY_RECENT_LOOKBACK_HOURS = "SPOTIFY_RECENT_LOOKBACK_HOURS"  # default 3


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
        validated.append({"notion_name": notion_name, "match_any": terms})

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


def collect_recent_spotify_texts(token: str) -> Set[str]:
    lookback_hours = int(os.getenv(SPOTIFY_RECENT_LOOKBACK_HOURS, "3").strip() or "3")
    lookback_hours = max(1, min(24, lookback_hours))
    after = int((datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=lookback_hours)).timestamp() * 1000)

    seen_texts: Set[str] = set()

    recent = spotify_get(
        "https://api.spotify.com/v1/me/player/recently-played",
        token,
        {"limit": 50, "after": after},
    )
    for item in recent.get("items") or []:
        if not isinstance(item, dict):
            continue
        track = item.get("track")
        if not isinstance(track, dict):
            continue
        name = str(track.get("name", "")).strip()
        if name:
            seen_texts.add(normalize_text(name))
        artists = track.get("artists") or []
        artist_names = [str(a.get("name", "")).strip() for a in artists if isinstance(a, dict)]
        if artist_names:
            seen_texts.add(normalize_text(" ".join(artist_names)))
        if name and artist_names:
            seen_texts.add(normalize_text(f"{name} {' '.join(artist_names)}"))

    # Include currently playing in case user is listening to a podcast episode right now.
    response = requests.get(
        "https://api.spotify.com/v1/me/player/currently-playing",
        headers=spotify_headers(token),
        timeout=30,
    )
    if response.status_code == 200:
        current = response.json()
        if isinstance(current, dict):
            item = current.get("item")
            if isinstance(item, dict):
                current_name = str(item.get("name", "")).strip()
                if current_name:
                    seen_texts.add(normalize_text(current_name))
                show = item.get("show")
                if isinstance(show, dict):
                    show_name = str(show.get("name", "")).strip()
                    if show_name:
                        seen_texts.add(normalize_text(show_name))
                    if current_name and show_name:
                        seen_texts.add(normalize_text(f"{current_name} {show_name}"))

    return seen_texts


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

        listened_texts = collect_recent_spotify_texts(spotify_token)
        if not listened_texts:
            print("INFO no_recent_spotify_items_found")

        matches: Set[str] = set()
        for mapping in mappings:
            notion_name = str(mapping["notion_name"])
            terms = mapping["match_any"]
            for text in listened_texts:
                if any(term in text for term in terms):
                    matches.add(normalize_text(notion_name))
                    break

        pages = notion_get_all_pages(db_id, notion_token)
        updated = 0
        scanned = 0
        for page in pages:
            scanned += 1
            title = page_title(page, title_property)
            if not title:
                continue
            if normalize_text(title) not in matches:
                continue
            checked = page_checkbox(page, completed_property)
            if checked is None:
                raise RuntimeError(
                    f"Property '{completed_property}' is missing or not a checkbox in at least one row."
                )
            if checked:
                continue
            page_id = str(page.get("id", "")).strip()
            if not page_id:
                continue
            update_page_checkbox(page_id, completed_property, True, notion_token)
            updated += 1

        print(
            f"SUMMARY notion_db={db_id} rows_scanned={scanned} rows_marked_completed={updated} "
            f"matched_targets={len(matches)}"
        )
        return 0
    except requests.HTTPError as exc:
        print(f"ERROR HTTP failure: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
