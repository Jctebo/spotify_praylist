from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import shutil
import sys
from html import escape as _html_escape
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.playlist.spotify_contracts import DEFAULT_CONTRACT_DIR as DEFAULT_SPOTIFY_CONTRACT_DIR  # noqa: E402
from jobs.playlist.spotify_contracts import DEFAULT_PLAYLIST_DIR as DEFAULT_SPOTIFY_PLAYLIST_DIR  # noqa: E402
from jobs.playlist.spotify_contracts import (  # noqa: E402
    load_spotify_playlist_definitions,
    load_spotify_queue_contracts,
    normalize_spotify_contract_key,
    normalize_spotify_queue_uri,
)
from jobs.publish.audio import (  # noqa: E402
    PUBLISH_DOCS_DIR,
    github_pages_base_url,
    load_published_audio_jobs,
    podcast_feed_public_url,
)
from jobs.publish.contracts import (  # noqa: E402
    DEFAULT_CONTRACT_DIR as DEFAULT_PUBLISH_CONTRACT_DIR,
    load_publish_contracts,
    normalize_publish_key,
)

VALID_GROUPS = {"ora-pro-nobis", "external-spotify"}
VALID_AVAILABILITY = {"daily", "seasonal", "weekday", "sunday", "fixed"}
GROUP_LABELS = {
    "ora-pro-nobis": "Ora Pro Nobis",
    "external-spotify": "Spotify prayers",
}
PRAYLIST_GROUPS = [
    {"key": "morning-praylist", "label": "Morning Praylist"},
    {"key": "daily-praylist", "label": "Daily Praylist"},
    {"key": "night-praylist", "label": "Night Praylist"},
]
PRAYLIST_LABELS = {group["key"]: group["label"] for group in PRAYLIST_GROUPS}
PLAYLIST_TO_PRAYLIST = {
    "morning": "morning-praylist",
    "midday": "daily-praylist",
    "sunday": "daily-praylist",
    "night": "night-praylist",
}
GENERATED_SPOTIFY_ALIASES = {
    "morning-prayer": ("morning-prayer-elevenlabs",),
    "auxilium-christianorum": ("auxilium-christianorum",),
    "daily-rosary": ("rosary",),
    "daily-examen": ("daily-reflection",),
    "daily-novenas": ("daily-novenas",),
    "angelus-morning": ("marian-antiphon-angelus", "marian-antiphon-regina-caeli"),
    "angelus-midday": ("marian-antiphon-angelus", "marian-antiphon-regina-caeli"),
    "angelus-evening": ("marian-antiphon-angelus", "marian-antiphon-regina-caeli"),
}


def _iso_utc_now() -> str:
    return _dt.datetime.now(tz=_dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _slug(value: Any) -> str:
    return normalize_publish_key(value)


def _html(value: Any) -> str:
    return _html_escape(_clean(value), quote=True)


def _trim_trailing_ws(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.splitlines()) + "\n"


def _reset_generated_prayers_dir(root: Path) -> Path:
    prayers_dir = root / "prayers"
    resolved_root = root.resolve()
    resolved_prayers = prayers_dir.resolve()
    if resolved_prayers == resolved_root or resolved_root not in resolved_prayers.parents:
        raise RuntimeError(f"Refusing to reset unsafe prayers directory: {prayers_dir}")
    if prayers_dir.exists():
        shutil.rmtree(prayers_dir)
    prayers_dir.mkdir(parents=True, exist_ok=True)
    return prayers_dir


def _json_default(value: Any) -> Any:
    if isinstance(value, Path):
        return value.as_posix()
    return str(value)


def spotify_open_url(value: str) -> str:
    uri = normalize_spotify_queue_uri(value)
    if not uri:
        return ""
    _, kind, spotify_id = uri.split(":", 2)
    return f"https://open.spotify.com/{kind}/{spotify_id}"


def _normalize_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        raw = value.strip().lower()
        if raw in {"1", "true", "yes", "y", "on"}:
            return True
        if raw in {"0", "false", "no", "n", "off", ""}:
            return False
    return bool(value)


def _norm_key(value: Any) -> str:
    return normalize_spotify_contract_key(str(value or "").strip())


def _entry_identity_keys(entry: Dict[str, Any]) -> List[str]:
    values: List[str] = []
    for field_name in ("contract_id", "slug"):
        values.append(_norm_key(entry.get(field_name)))
    values.extend(_norm_key(value) for value in entry.get("related_contracts") or [])
    values.extend(_norm_key(value) for value in entry.get("related_entry_ids") or [])
    values.extend(_norm_key(value) for value in entry.get("aliases") or [])
    values.extend(_norm_key(value) for value in entry.get("active_aliases") or [])
    out: List[str] = []
    for value in values:
        if value and value not in out:
            out.append(value)
    return out


def _active_aliases_for_spotify_key(key: str) -> List[str]:
    normalized = _norm_key(key)
    aliases = [normalized]
    aliases.extend(_norm_key(value) for value in GENERATED_SPOTIFY_ALIASES.get(normalized, ()))
    return [value for value in aliases if value]


def _build_active_praylist_index(
    *,
    playlist_dir: Optional[Path] = None,
    spotify_contract_dir: Optional[Path] = None,
) -> Dict[str, Dict[str, Any]]:
    contracts = load_spotify_queue_contracts(spotify_contract_dir or DEFAULT_SPOTIFY_CONTRACT_DIR)
    playlists = load_spotify_playlist_definitions(
        playlist_dir=playlist_dir or DEFAULT_SPOTIFY_PLAYLIST_DIR,
        contracts=contracts,
    )
    index: Dict[str, Dict[str, Any]] = {}
    for playlist_order, playlist in enumerate(playlists):
        praylist_key = PLAYLIST_TO_PRAYLIST.get(playlist.key)
        if not praylist_key:
            continue
        for contract_order, contract_key in enumerate(playlist.contracts):
            normalized_contract = _norm_key(contract_key)
            if not normalized_contract:
                continue
            aliases = _active_aliases_for_spotify_key(normalized_contract)
            for alias in aliases:
                info = index.setdefault(
                    alias,
                    {
                        "active_contract_key": normalized_contract,
                        "praylists": [],
                        "sort_order": playlist_order * 1000 + contract_order,
                    },
                )
                if not any(item["key"] == praylist_key for item in info["praylists"]):
                    info["praylists"].append({"key": praylist_key, "label": PRAYLIST_LABELS[praylist_key]})
                info["sort_order"] = min(info["sort_order"], playlist_order * 1000 + contract_order)
    return index


def _apply_active_praylists(entries: Sequence[Dict[str, Any]], active_index: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    active_entries: List[Dict[str, Any]] = []
    for entry in entries:
        matched_infos = []
        for key in _entry_identity_keys(entry):
            info = active_index.get(key)
            if info:
                matched_infos.append(info)
        if not matched_infos:
            continue
        updated = dict(entry)
        praylists: List[Dict[str, str]] = []
        for info in sorted(matched_infos, key=lambda item: item.get("sort_order", 999999)):
            for praylist in info.get("praylists") or []:
                if not any(existing["key"] == praylist["key"] for existing in praylists):
                    praylists.append(dict(praylist))
        updated["praylists"] = praylists
        updated["praylist_groups"] = [item["key"] for item in praylists]
        updated["sort_order"] = min(int(info.get("sort_order", 999999)) for info in matched_infos)
        active_entries.append(updated)
    return active_entries


def _validate_website_metadata(
    raw: Any,
    *,
    source_label: str,
    default_enabled: bool,
    spotify_uri: str = "",
) -> Dict[str, Any]:
    if raw is None:
        return {"enabled": False}
    if not isinstance(raw, dict):
        raise RuntimeError(f"{source_label} website metadata must be an object.")
    website = dict(raw)
    website["enabled"] = _normalize_bool(website.get("enabled", default_enabled))
    if not website["enabled"]:
        return website

    for field_name in ("slug", "title", "summary", "group", "source_label", "availability"):
        if not _clean(website.get(field_name)):
            raise RuntimeError(f"{source_label} website metadata is missing '{field_name}'.")

    website["slug"] = _slug(website["slug"])
    if not website["slug"]:
        raise RuntimeError(f"{source_label} website metadata has an invalid slug.")

    group = _clean(website["group"])
    if group not in VALID_GROUPS:
        raise RuntimeError(f"{source_label} website metadata has invalid group '{group}'.")
    website["group"] = group

    availability = _clean(website["availability"])
    if availability not in VALID_AVAILABILITY:
        raise RuntimeError(f"{source_label} website metadata has invalid availability '{availability}'.")
    website["availability"] = availability

    try:
        website["order"] = float(website.get("order", 0))
    except Exception as exc:
        raise RuntimeError(f"{source_label} website metadata has invalid order.") from exc

    aliases = website.get("aliases")
    if aliases is not None:
        if not isinstance(aliases, list):
            raise RuntimeError(f"{source_label} website metadata aliases must be a list.")
        website["aliases"] = [_clean(alias) for alias in aliases if _clean(alias)]

    external_url = _clean(website.get("external_url"))
    if external_url and not re.fullmatch(r"https?://[^\s]+", external_url):
        raise RuntimeError(f"{source_label} website metadata has invalid external_url.")
    if group == "external-spotify" and not external_url:
        external_url = spotify_open_url(spotify_uri)
    if group == "external-spotify" and not external_url:
        raise RuntimeError(f"{source_label} website metadata needs external_url.")
    if external_url:
        website["external_url"] = external_url

    return website


def _load_publish_contracts_for_site(contract_dir: Optional[Path]) -> List[Any]:
    base_dir = Path(contract_dir) if contract_dir else DEFAULT_PUBLISH_CONTRACT_DIR
    if not base_dir.exists() or not any(base_dir.glob("*.json")):
        return []
    return load_publish_contracts(base_dir)


def _publish_entry_from_contract(contract: Any) -> Optional[Dict[str, Any]]:
    website = _validate_website_metadata(
        contract.metadata.get("website"),
        source_label=f"publish contract '{contract.contract_id}'",
        default_enabled=False,
    )
    if not website.get("enabled"):
        return None
    entry_ids = [_clean(entry.get("entry_id")) for entry in contract.entries if _clean(entry.get("entry_id"))]
    return {
        "id": f"publish:{contract.contract_id}",
        "source": "publish",
        "contract_id": contract.contract_id,
        "related_contracts": [contract.contract_id],
        "related_entry_ids": entry_ids,
        "slug": website["slug"],
        "title": _clean(website["title"]),
        "subtitle": _clean(website.get("subtitle")),
        "summary": _clean(website["summary"]),
        "group": website["group"],
        "group_label": GROUP_LABELS[website["group"]],
        "order": float(website.get("order", 0)),
        "source_label": _clean(website["source_label"]),
        "availability": website["availability"],
        "prayer_family": _clean(website.get("prayer_family")),
        "primary_action_label": _clean(website.get("primary_action_label")) or "Listen",
        "external_url": "",
        "notes": _clean(website.get("notes")),
        "aliases": list(website.get("aliases") or []),
        "feed_url": podcast_feed_public_url(),
        "archive_url": "audio/",
        "latest_audio": None,
    }


def _spotify_entry_from_contract(contract: Any) -> Optional[Dict[str, Any]]:
    website = _validate_website_metadata(
        contract.website,
        source_label=f"Spotify contract '{contract.key}'",
        default_enabled=False,
        spotify_uri=contract.spotify_uri,
    )
    if not website.get("enabled"):
        return None
    return {
        "id": f"spotify:{contract.key}",
        "source": "spotify",
        "contract_id": contract.key,
        "related_contracts": [contract.key],
        "related_entry_ids": [contract.key],
        "slug": website["slug"],
        "title": _clean(website["title"]),
        "subtitle": _clean(website.get("subtitle")),
        "summary": _clean(website["summary"]),
        "group": website["group"],
        "group_label": GROUP_LABELS[website["group"]],
        "order": float(website.get("order", 0)),
        "source_label": _clean(website["source_label"]),
        "availability": website["availability"],
        "prayer_family": _clean(website.get("prayer_family")),
        "primary_action_label": _clean(website.get("primary_action_label")) or "Open in Spotify",
        "external_url": _clean(website.get("external_url")),
        "notes": _clean(website.get("notes")),
        "aliases": list(website.get("aliases") or []),
        "feed_url": podcast_feed_public_url() if website["group"] == "ora-pro-nobis" else "",
        "archive_url": "audio/" if website["group"] == "ora-pro-nobis" else "",
        "latest_audio": None,
    }


def _merge_entry(existing: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    family = _clean(existing.get("prayer_family"))
    if not family or family != _clean(incoming.get("prayer_family")):
        raise RuntimeError(
            f"Duplicate prayer website slug '{existing['slug']}' for {existing['id']} and {incoming['id']}."
        )
    merged = dict(existing)
    merged["related_contracts"] = sorted(set(existing["related_contracts"]) | set(incoming["related_contracts"]))
    merged["related_entry_ids"] = sorted(set(existing["related_entry_ids"]) | set(incoming["related_entry_ids"]))
    merged["aliases"] = sorted(set(existing.get("aliases") or []) | set(incoming.get("aliases") or []))
    if not merged.get("notes") and incoming.get("notes"):
        merged["notes"] = incoming["notes"]
    return merged


def _prayer_text_from_sidecar_job(job: Dict[str, Any]) -> Dict[str, Any]:
    sections: List[Dict[str, Any]] = []
    for fragment in job.get("fragments") or []:
        if not isinstance(fragment, dict):
            continue
        text = _clean(fragment.get("text"))
        if not text:
            continue
        label = _clean(fragment.get("label")) or _clean(fragment.get("kind")) or "Prayer"
        section = {
            "label": label,
            "text": text,
            "fragment_key": _clean(fragment.get("fragment_key")),
            "kind": _clean(fragment.get("kind")),
            "repeat_count": 1,
        }
        if sections and sections[-1]["label"] == section["label"] and sections[-1]["text"] == section["text"]:
            sections[-1]["repeat_count"] = int(sections[-1].get("repeat_count", 1)) + 1
            continue
        sections.append(section)
    return {
        "section_count": len(sections),
        "sections": sections,
    }


def _novena_episode_from_job(job: Dict[str, Any]) -> Dict[str, Any]:
    prayer_text = _prayer_text_from_sidecar_job(job)
    return {
        "title": _clean(job.get("title")),
        "episode_id": _clean(job.get("episode_id")),
        "contract_id": _clean(job.get("contract_id")),
        "family_id": _clean(job.get("family_id")),
        "published_date": _clean(job.get("published_date")),
        "audio_url": _clean(job.get("audio_url")),
        "prayer_text": prayer_text if prayer_text["sections"] else None,
    }


def _attach_latest_audio(entries: Sequence[Dict[str, Any]], jobs: Sequence[Dict[str, Any]]) -> None:
    novena_episodes = [
        _novena_episode_from_job(job)
        for job in jobs
        if _clean(job.get("contract_type")) == "novena_feast_rule"
    ]
    for entry in entries:
        if entry.get("slug") == "daily-novenas":
            entry["novena_episodes"] = novena_episodes
            if novena_episodes and not entry.get("latest_audio"):
                latest = novena_episodes[0]
                entry["latest_audio"] = {
                    "title": latest["title"],
                    "episode_id": latest["episode_id"],
                    "published_date": latest["published_date"],
                    "audio_url": latest["audio_url"],
                    "has_prayer_text": bool((latest.get("prayer_text") or {}).get("sections")),
                }
        contract_ids = set(entry.get("related_contracts") or [])
        entry_ids = set(entry.get("related_entry_ids") or [])
        for job in jobs:
            if _clean(job.get("contract_id")) in contract_ids or _clean(job.get("entry_id")) in entry_ids:
                prayer_text = _prayer_text_from_sidecar_job(job)
                entry["latest_audio"] = {
                    "title": _clean(job.get("title")),
                    "episode_id": _clean(job.get("episode_id")),
                    "published_date": _clean(job.get("published_date")),
                    "audio_url": _clean(job.get("audio_url")),
                    "has_prayer_text": bool(prayer_text["sections"]),
                }
                if prayer_text["sections"]:
                    entry["latest_prayer_text"] = prayer_text
                break


def load_prayer_site_entries(
    *,
    publish_contract_dir: Optional[Path] = None,
    spotify_contract_dir: Optional[Path] = None,
    spotify_playlist_dir: Optional[Path] = None,
    docs_root: Optional[Path] = None,
    base_url: Optional[str] = None,
) -> List[Dict[str, Any]]:
    entries_by_slug: Dict[str, Dict[str, Any]] = {}
    for contract in _load_publish_contracts_for_site(publish_contract_dir):
        entry = _publish_entry_from_contract(contract)
        if not entry:
            continue
        if entry["slug"] in entries_by_slug:
            entry = _merge_entry(entries_by_slug[entry["slug"]], entry)
        entries_by_slug[entry["slug"]] = entry

    for contract in load_spotify_queue_contracts(spotify_contract_dir or DEFAULT_SPOTIFY_CONTRACT_DIR):
        entry = _spotify_entry_from_contract(contract)
        if not entry:
            continue
        if entry["slug"] in entries_by_slug:
            entry = _merge_entry(entries_by_slug[entry["slug"]], entry)
        entries_by_slug[entry["slug"]] = entry

    active_index = _build_active_praylist_index(
        playlist_dir=spotify_playlist_dir,
        spotify_contract_dir=spotify_contract_dir,
    )
    entries = _apply_active_praylists(entries_by_slug.values(), active_index)
    entries = sorted(
        entries,
        key=lambda item: (
            int(item.get("sort_order", 999999)),
            float(item.get("order", 0)),
            item["title"].lower(),
        ),
    )
    jobs = load_published_audio_jobs(docs_root=docs_root, base_url=base_url)
    _attach_latest_audio(entries, jobs)
    return entries


def build_site_manifest(entries: Sequence[Dict[str, Any]], *, base_url: Optional[str] = None) -> Dict[str, Any]:
    site_base = _clean(base_url or github_pages_base_url()).rstrip("/")
    items: List[Dict[str, Any]] = []
    for entry in entries:
        item = {key: value for key, value in entry.items() if key not in {"order"}}
        item["url"] = f"{site_base}/prayers/{entry['slug']}/" if site_base else f"prayers/{entry['slug']}/"
        item["path"] = f"prayers/{entry['slug']}/index.html"
        items.append(item)
    return {
        "generated_at": _iso_utc_now(),
        "base_url": site_base,
        "count": len(items),
        "groups": list(PRAYLIST_GROUPS),
        "items": items,
    }


def _primary_href(entry: Dict[str, Any]) -> str:
    latest = entry.get("latest_audio") or {}
    if latest.get("audio_url"):
        return _clean(latest["audio_url"])
    if entry.get("external_url"):
        return _clean(entry["external_url"])
    if entry.get("feed_url"):
        return _clean(entry["feed_url"])
    return _clean(entry.get("archive_url")) or "#"


def _availability_label(value: str) -> str:
    labels = {
        "daily": "Daily",
        "seasonal": "Seasonal",
        "weekday": "Weekday",
        "sunday": "Sunday",
        "fixed": "Fixed",
    }
    return labels.get(value, value.title())


def _site_css() -> str:
    return """
    :root {
      color-scheme: light;
      --bg: #f7f4ed;
      --paper: #fffdf8;
      --ink: #1f2720;
      --muted: #5f665f;
      --line: #d8d0c2;
      --green: #315f4d;
      --green-dark: #234538;
      --gold: #a56f2c;
      --wine: #7b2f42;
      --shadow: 0 12px 28px rgba(54, 45, 31, 0.10);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-width: 320px;
      background: var(--bg);
      color: var(--ink);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.55;
      letter-spacing: 0;
    }
    a { color: var(--green-dark); }
    a:focus-visible { outline: 3px solid var(--gold); outline-offset: 3px; }
    .wrap { width: min(1120px, calc(100% - 32px)); margin: 0 auto; }
    header { padding: 28px 0 18px; border-bottom: 1px solid var(--line); background: var(--paper); }
    .topline { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .brand { font-size: 0.88rem; font-weight: 800; color: var(--green-dark); text-transform: uppercase; }
    nav { display: flex; gap: 12px; flex-wrap: wrap; font-size: 0.94rem; }
    nav a { text-decoration: none; font-weight: 700; }
    .hero { padding: 28px 0 24px; background: var(--paper); }
    h1 { margin: 0; max-width: 840px; font-family: Georgia, "Times New Roman", serif; font-size: clamp(2rem, 5vw, 4.1rem); line-height: 1.02; }
    .lede { max-width: 780px; margin: 14px 0 0; color: var(--muted); font-size: 1.08rem; }
    main { padding: 26px 0 44px; }
    section + section { margin-top: 34px; }
    .section-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--line); margin-bottom: 14px; padding-bottom: 10px; }
    h2 { margin: 0; font-size: 1.2rem; }
    .count { color: var(--muted); font-size: 0.92rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 14px; align-items: stretch; }
    .card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 240px;
      padding: 18px;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
    }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.82rem; color: var(--muted); }
    .pill { border: 1px solid var(--line); border-radius: 999px; padding: 3px 8px; background: #fbf8f1; }
    .card h3 { margin: 0; font-size: 1.15rem; line-height: 1.2; }
    .subtitle { margin: -6px 0 0; color: var(--wine); font-weight: 700; font-size: 0.92rem; }
    .summary { margin: 0; color: var(--muted); }
    .actions { margin-top: auto; display: flex; gap: 10px; flex-wrap: wrap; }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 9px 13px;
      border-radius: 7px;
      text-decoration: none;
      font-weight: 800;
      border: 1px solid var(--green);
      background: var(--green);
      color: #fff;
    }
    .button.secondary { background: transparent; color: var(--green-dark); }
    .detail { max-width: 760px; padding: 24px 0 48px; }
    .detail-panel { margin-top: 20px; padding: 20px; border: 1px solid var(--line); border-radius: 8px; background: var(--paper); }
    .links { display: grid; gap: 10px; margin-top: 18px; }
    .player { display: grid; gap: 10px; margin-top: 14px; }
    audio { width: 100%; }
    .prayer-text { margin-top: 24px; display: grid; gap: 14px; }
    .prayer-section { padding-top: 14px; border-top: 1px solid var(--line); }
    .prayer-section h2 { font-size: 1rem; margin: 0 0 6px; }
    .prayer-section p { margin: 0 0 10px; }
    .novena-list { margin-top: 24px; display: grid; gap: 14px; }
    .episode { padding: 16px; border: 1px solid var(--line); border-radius: 8px; background: #fbf8f1; }
    .episode h2 { font-size: 1rem; margin: 0 0 6px; }
    footer { padding: 20px 0 32px; color: var(--muted); border-top: 1px solid var(--line); }
    @media (max-width: 640px) {
      .wrap { width: min(100% - 22px, 1120px); }
      header { padding-top: 20px; }
      .section-head { align-items: start; flex-direction: column; }
      .card { min-height: 0; }
      .button { width: 100%; }
    }
"""


def _paragraphs_html(text: str) -> str:
    paragraphs = [part.strip() for part in re.split(r"\n{2,}", str(text or "").strip()) if part.strip()]
    if not paragraphs and _clean(text):
        paragraphs = [_clean(text)]
    return "\n".join(f"<p>{_html(paragraph).replace(chr(10), '<br>')}</p>" for paragraph in paragraphs)


def _prayer_text_html(
    prayer_text: Optional[Dict[str, Any]],
    *,
    heading_id: str = "prayer-text-heading",
    heading: str = "Prayer text",
) -> str:
    if not prayer_text or not prayer_text.get("sections"):
        return ""
    sections = []
    for section in prayer_text.get("sections") or []:
        label = _clean(section.get("label")) or "Prayer"
        repeat_count = int(section.get("repeat_count", 1) or 1)
        repeat = f" <span class=\"pill\">x{repeat_count}</span>" if repeat_count > 1 else ""
        sections.append(
            f"""
            <section class="prayer-section">
              <h2>{_html(label)}{repeat}</h2>
              {_paragraphs_html(_clean(section.get("text")))}
            </section>
            """
        )
    return f"""
    <section class="prayer-text" aria-labelledby="{_html(heading_id)}">
      <h2 id="{_html(heading_id)}">{_html(heading)}</h2>
      {"".join(sections)}
    </section>
    """


def _novena_episodes_html(entry: Dict[str, Any]) -> str:
    episodes = list(entry.get("novena_episodes") or [])
    if entry.get("slug") != "daily-novenas":
        return ""
    if not episodes:
        return """
        <section class="novena-list" aria-labelledby="novena-episodes-heading">
          <h2 id="novena-episodes-heading">Individual novena episodes</h2>
          <p class="summary">Individual novena episodes appear after publication.</p>
        </section>
        """
    cards = []
    for episode in episodes[:12]:
        action = (
            f"""<a class="button secondary" href="{_html(episode.get('audio_url'))}">Listen to episode</a>"""
            if episode.get("audio_url")
            else ""
        )
        text_preview = _prayer_text_html(
            episode.get("prayer_text"),
            heading_id=f"novena-text-{_slug(episode.get('episode_id')) or len(cards)}",
            heading="Episode text",
        )
        cards.append(
            f"""
            <article class="episode">
              <h2>{_html(episode.get('title'))}</h2>
              <p class="summary">{_html(episode.get('published_date'))}</p>
              <div class="links">{action}</div>
              {text_preview}
            </article>
            """
        )
    return f"""
    <section class="novena-list" aria-labelledby="novena-episodes-heading">
      <h2 id="novena-episodes-heading">Individual novena episodes</h2>
      {"".join(cards)}
    </section>
    """


def _entry_card(entry: Dict[str, Any]) -> str:
    detail_href = f"prayers/{_html(entry['slug'])}/"
    latest = entry.get("latest_audio") or {}
    latest_text = (
        f"<span class=\"pill\">Latest: {_html(latest.get('published_date'))}</span>"
        if latest.get("published_date")
        else ""
    )
    subtitle = f"<p class=\"subtitle\">{_html(entry.get('subtitle'))}</p>" if entry.get("subtitle") else ""
    return f"""
      <article class="card">
        <div class="meta">
          <span class="pill">{_html(entry.get('source_label'))}</span>
          <span class="pill">{_html(_availability_label(entry.get('availability', '')))}</span>
          {latest_text}
        </div>
        <h3>{_html(entry.get('title'))}</h3>
        {subtitle}
        <p class="summary">{_html(entry.get('summary'))}</p>
        <div class="actions">
          <a class="button" href="{detail_href}">Open prayer</a>
        </div>
      </article>
    """


def _site_index_html(entries: Sequence[Dict[str, Any]], manifest: Dict[str, Any]) -> str:
    sections = []
    for group in PRAYLIST_GROUPS:
        group_key = group["key"]
        group_entries = [entry for entry in entries if group_key in set(entry.get("praylist_groups") or [])]
        cards = "\n".join(_entry_card(entry) for entry in group_entries)
        sections.append(
            f"""
            <section id="{_html(group_key)}">
              <div class="section-head">
                <h2>{_html(group["label"])}</h2>
                <span class="count">{len(group_entries)} prayers</span>
              </div>
              <div class="grid">{cards}</div>
            </section>
            """
        )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ora Pro Nobis Daily Prayer Directory</title>
  <meta name="description" content="A mobile and desktop friendly directory for Ora Pro Nobis daily prayers and external Spotify prayer links.">
  <style>{_site_css()}</style>
</head>
<body>
  <header>
    <div class="wrap topline">
      <div class="brand">Ora Pro Nobis</div>
      <nav aria-label="Prayer groups">
        <a href="#morning-praylist">Morning Praylist</a>
        <a href="#daily-praylist">Daily Praylist</a>
        <a href="#night-praylist">Night Praylist</a>
        <a href="audio/">Audio archive</a>
        <a href="podcast.xml">Podcast feed</a>
      </nav>
    </div>
  </header>
  <div class="hero">
    <div class="wrap">
      <h1>Daily Praylists</h1>
      <p class="lede">Open active Morning, Daily, and Night Praylist prayers from one responsive directory.</p>
    </div>
  </div>
  <main class="wrap">
    {"".join(sections)}
  </main>
  <footer>
    <div class="wrap">Generated {_html(manifest.get("generated_at"))}.</div>
  </footer>
</body>
</html>
"""


def _prayer_page_html(entry: Dict[str, Any], manifest: Dict[str, Any]) -> str:
    latest = entry.get("latest_audio") or {}
    latest_block = ""
    if latest.get("audio_url"):
        latest_block = (
            f"""
            <div class="player">
              <p class="summary">Latest episode: {_html(latest.get('title'))} ({_html(latest.get('published_date'))})</p>
              <audio controls src="{_html(latest['audio_url'])}">Your browser does not support audio playback.</audio>
              <a class="button" href="{_html(latest['audio_url'])}">Open latest audio</a>
            </div>
            """
        )
    spotify_block = ""
    if entry.get("external_url"):
        spotify_block = f"""<a class="button" href="{_html(entry['external_url'])}">{_html(entry.get('primary_action_label'))}</a>"""
    feed_block = ""
    if entry.get("feed_url"):
        feed_block = f"""<a class="button secondary" href="{_html(entry['feed_url'])}">Podcast feed</a>"""
    archive_block = ""
    if entry.get("archive_url"):
        archive_block = f"""<a class="button secondary" href="../../{_html(entry['archive_url'])}">Audio archive</a>"""
    notes = f"<p>{_html(entry.get('notes'))}</p>" if entry.get("notes") else ""
    prayer_text = _prayer_text_html(entry.get("latest_prayer_text"))
    novena_episodes = _novena_episodes_html(entry)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{_html(entry.get('title'))} | Ora Pro Nobis</title>
  <meta name="description" content="{_html(entry.get('summary'))}">
  <style>{_site_css()}</style>
</head>
<body>
  <header>
    <div class="wrap topline">
      <div class="brand">Ora Pro Nobis</div>
      <nav aria-label="Prayer navigation">
        <a href="../../">Directory</a>
        <a href="../../audio/">Audio archive</a>
        <a href="../../podcast.xml">Podcast feed</a>
      </nav>
    </div>
  </header>
  <main class="wrap detail">
    <div class="meta">
      <span class="pill">{_html(entry.get('source_label'))}</span>
      <span class="pill">{_html(_availability_label(entry.get('availability', '')))}</span>
      <span class="pill">{_html(entry.get('group_label'))}</span>
    </div>
    <h1>{_html(entry.get('title'))}</h1>
    <p class="lede">{_html(entry.get('summary'))}</p>
    <div class="detail-panel">
      {notes}
      <div class="links">
        {latest_block}
        {spotify_block}
        {feed_block}
        {archive_block}
      </div>
    </div>
    {prayer_text}
    {novena_episodes}
  </main>
  <footer>
    <div class="wrap">Generated {_html(manifest.get("generated_at"))}.</div>
  </footer>
</body>
</html>
"""


def write_prayer_site(
    *,
    docs_root: Optional[Path] = None,
    base_url: Optional[str] = None,
    publish_contract_dir: Optional[Path] = None,
    spotify_contract_dir: Optional[Path] = None,
    spotify_playlist_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    root = Path(docs_root) if docs_root else PUBLISH_DOCS_DIR
    site_base = _clean(base_url or github_pages_base_url()).rstrip("/")
    entries = load_prayer_site_entries(
        publish_contract_dir=publish_contract_dir,
        spotify_contract_dir=spotify_contract_dir,
        spotify_playlist_dir=spotify_playlist_dir,
        docs_root=root,
        base_url=site_base,
    )
    if not entries:
        raise RuntimeError("No enabled prayer website entries were found.")
    manifest = build_site_manifest(entries, base_url=site_base)

    prayers_dir = _reset_generated_prayers_dir(root)
    index_path = root / "index.html"
    manifest_path = prayers_dir / "index.json"
    index_path.write_text(_trim_trailing_ws(_site_index_html(entries, manifest)), encoding="utf-8")
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True, default=_json_default) + "\n", encoding="utf-8")

    page_paths: List[Path] = []
    for entry in entries:
        page_dir = prayers_dir / entry["slug"]
        page_dir.mkdir(parents=True, exist_ok=True)
        page_path = page_dir / "index.html"
        page_path.write_text(_trim_trailing_ws(_prayer_page_html(entry, manifest)), encoding="utf-8")
        page_paths.append(page_path)

    return {
        "site_index_path": index_path,
        "site_manifest_path": manifest_path,
        "site_pages": page_paths,
        "count": len(entries),
    }


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Build the Ora Pro Nobis static prayer website.")
    parser.add_argument("--docs-root", type=Path, default=None, help="Docs or staged Pages root to write into.")
    parser.add_argument("--base-url", default=None, help="Public base URL for generated manifest/audio links.")
    args = parser.parse_args(argv)
    result = write_prayer_site(docs_root=args.docs_root, base_url=args.base_url)
    print(
        f"Wrote prayer website: {result['site_index_path']} "
        f"({result['count']} entries, {len(result['site_pages'])} pages)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
