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
from urllib.parse import quote

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
    DEFAULT_PODCAST_COVER_ART_SOURCE,
    PUBLISH_DOCS_DIR,
    audio_archive_public_url,
    github_pages_base_url,
    load_published_audio_jobs,
    podcast_feed_public_url,
    resolve_audio_public_base_url,
)
from jobs.publish.contracts import (  # noqa: E402
    DEFAULT_CONTRACT_DIR as DEFAULT_PUBLISH_CONTRACT_DIR,
    load_publish_contracts,
    normalize_publish_key,
)
from jobs.publish.daily_liturgical_context import build_daily_liturgical_context  # noqa: E402
from jobs.novena.liturgical_helpers import local_today  # noqa: E402

try:  # noqa: E402
    from PIL import Image
except Exception:  # pragma: no cover - exercised by environments without Pillow
    Image = None  # type: ignore[assignment]

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
SITE_IMAGE_DIR = Path("images") / "site"
DEVOTIONAL_PUBLIC_ROOT = Path("devotional") / "DCIM"
DEVOTIONAL_ROOT_MANIFEST = "devotional_image_library.json"
DEVOTIONAL_FOLDER_MANIFEST = "images_manifest.json"
LOGO_ASSET_SPECS = (
    ("mark_160", "ora-pro-nobis-mark-160.png", 160),
    ("mark_320", "ora-pro-nobis-mark-320.png", 320),
)


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


def _site_today(value: Optional[Any] = None) -> _dt.date:
    if isinstance(value, _dt.date):
        return value
    if value:
        return _dt.date.fromisoformat(str(value))
    return local_today()


def _parse_iso_date(value: Any) -> Optional[_dt.date]:
    text = _clean(value)
    if not text:
        return None
    try:
        return _dt.date.fromisoformat(text)
    except Exception:
        return None


def _root_relative_url(path: Any) -> str:
    text = _clean(path)
    if not text:
        return ""
    return quote(text.replace("\\", "/"), safe="/")


def _page_relative_url(path: Any) -> str:
    text = _root_relative_url(path)
    return f"../../{text}" if text else ""


def _image_alt_from_record(record: Dict[str, Any], fallback: str = "Ora Pro Nobis devotional image") -> str:
    subject = _clean(record.get("subject_slug") or record.get("id") or record.get("base_name")).replace("-", " ")
    if subject:
        return subject.title()
    return fallback


def _save_resized_image(source: Path, target: Path, *, max_size: int, quality: int = 82) -> Optional[Path]:
    if Image is None or not source.exists():
        return None
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        with Image.open(source) as image:
            image = image.convert("RGBA") if image.mode in {"P", "LA", "RGBA"} else image.convert("RGB")
            image.thumbnail((max_size, max_size))
            if target.suffix.lower() in {".jpg", ".jpeg"}:
                background = Image.new("RGB", image.size, (255, 253, 248))
                if image.mode == "RGBA":
                    background.paste(image, mask=image.getchannel("A"))
                    image = background
                else:
                    image = image.convert("RGB")
                image.save(target, format="JPEG", quality=quality, optimize=True)
            else:
                image.save(target, optimize=True)
    except Exception as exc:
        print(f"WARN site image optimization failed source={source} target={target} detail={exc}", file=sys.stderr)
        return None
    return target


def _prepare_logo_assets(root: Path) -> Dict[str, Dict[str, str]]:
    assets: Dict[str, Dict[str, str]] = {}
    source = DEFAULT_PODCAST_COVER_ART_SOURCE
    if not source.exists():
        return assets
    for key, filename, size in LOGO_ASSET_SPECS:
        relative = SITE_IMAGE_DIR / filename
        target = root / relative
        if _save_resized_image(source, target, max_size=size, quality=90):
            assets[key] = {"path": relative.as_posix(), "url": _root_relative_url(relative), "alt": "Ora Pro Nobis logo"}
    return assets


def _liturgical_color_token(context: Dict[str, Any]) -> str:
    season = _clean(context.get("season")).lower()
    feast = _clean(context.get("feast")).lower()
    rank = _clean(context.get("rank")).lower()
    source = f"{season} {feast} {rank}"
    if "pentecost" in source or "martyr" in source or "passion" in source:
        return "red"
    if "advent" in source or "lent" in source:
        return "purple"
    if "easter" in source or "christmas" in source:
        return "gold"
    return "green"


def _build_site_liturgical_context(today: _dt.date) -> Dict[str, Any]:
    try:
        context = build_daily_liturgical_context(today)
        payload = {
            "date": today.isoformat(),
            "season": _clean(context.liturgicalSeason) or "Ordinary Time",
            "feast": _clean(context.feastDay),
            "rank": _clean(context.liturgicalRank),
            "summary": _clean(context.shortSummary),
            "source": _clean(context.source),
        }
    except Exception as exc:
        print(f"WARN site liturgical context unavailable date={today.isoformat()} detail={exc}", file=sys.stderr)
        payload = {
            "date": today.isoformat(),
            "season": "Ordinary Time",
            "feast": "",
            "rank": "",
            "summary": f"Today's prayer focus follows Ordinary Time on {today.isoformat()}.",
            "source": "fallback",
        }
    payload["color"] = _liturgical_color_token(payload)
    return payload


def _mmdd_in_window(today: _dt.date, start_mmdd: str, end_mmdd: str) -> bool:
    start = _clean(start_mmdd)
    end = _clean(end_mmdd)
    if not start or not end:
        return False
    current = f"{today.month:02d}-{today.day:02d}"
    if start <= end:
        return start <= current <= end
    return current >= start or current <= end


def _mmdd_sort_value(value: str) -> int:
    text = _clean(value)
    try:
        month, day = text.split("-", 1)
        return int(month) * 100 + int(day)
    except Exception:
        return 0


def _load_json_file(path: Path) -> Optional[Dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"WARN site json load failed path={path} detail={exc}", file=sys.stderr)
        return None
    return payload if isinstance(payload, dict) else None


def _load_devotional_public_library(root: Path) -> Dict[str, Any]:
    manifest_path = root / DEVOTIONAL_PUBLIC_ROOT / DEVOTIONAL_ROOT_MANIFEST
    if not manifest_path.exists():
        return {"folders": [], "items": []}
    root_manifest = _load_json_file(manifest_path) or {}
    items: List[Dict[str, Any]] = []
    folders = []
    for folder in root_manifest.get("folders") or []:
        if not isinstance(folder, dict):
            continue
        if _clean(folder.get("state")) != "current":
            continue
        manifest_rel = _clean(folder.get("manifest_path"))
        if not manifest_rel:
            continue
        folder_manifest = _load_json_file(root / DEVOTIONAL_PUBLIC_ROOT / manifest_rel)
        if not folder_manifest:
            continue
        folders.append(dict(folder))
        for item in folder_manifest.get("items") or []:
            if isinstance(item, dict):
                merged = dict(item)
                merged.setdefault("variant", _clean(folder.get("variant")))
                merged.setdefault("state", _clean(folder.get("state")))
                items.append(merged)
    return {"folders": folders, "items": items}


def _prepare_site_image_asset(root: Path, source_path: Path, slug: str, *, max_size: int, variant: str) -> Optional[Dict[str, str]]:
    safe_slug = _slug(slug) or "devotional-image"
    filename = f"devotional-{safe_slug}-{variant}.jpg"
    relative = SITE_IMAGE_DIR / filename
    target = root / relative
    if not _save_resized_image(source_path, target, max_size=max_size, quality=82):
        return None
    return {"path": relative.as_posix(), "url": _root_relative_url(relative)}


def _select_devotional_images(library: Dict[str, Any], root: Path, today: _dt.date) -> Dict[str, Dict[str, str]]:
    selected: Dict[str, Dict[str, str]] = {}
    items = [item for item in library.get("items") or [] if isinstance(item, dict)]
    for variant, max_size in (("wide", 1280), ("portrait", 760)):
        candidates = [item for item in items if _clean(item.get("variant")) == variant]
        candidates.sort(
            key=lambda item: (
                0 if _mmdd_in_window(today, _clean(item.get("start_mmdd")), _clean(item.get("end_mmdd"))) else 1,
                -_mmdd_sort_value(_clean(item.get("start_mmdd"))),
                _clean(item.get("id")),
            )
        )
        for item in candidates:
            image_file = ((item.get("files") or {}).get("image") or {}) if isinstance(item.get("files"), dict) else {}
            rel_path = _clean(image_file.get("relative_path")) if isinstance(image_file, dict) else ""
            if not rel_path:
                continue
            source = root / DEVOTIONAL_PUBLIC_ROOT / rel_path
            prepared = _prepare_site_image_asset(
                root,
                source,
                _clean(item.get("id") or item.get("subject_slug") or variant),
                max_size=max_size,
                variant=variant,
            )
            if not prepared:
                continue
            selected[variant] = {
                **prepared,
                "source_path": (DEVOTIONAL_PUBLIC_ROOT / rel_path).as_posix(),
                "alt": _image_alt_from_record(item),
                "id": _clean(item.get("id")),
                "subject_slug": _clean(item.get("subject_slug")),
                "variant": variant,
            }
            break
    return selected


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
        "archive_url": audio_archive_public_url(),
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
        "archive_url": audio_archive_public_url() if website["group"] == "ora-pro-nobis" else "",
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
        "audio_status": _clean(job.get("audio_status")),
    }


def _audio_payload_from_job(job: Dict[str, Any], *, status: str) -> Dict[str, Any]:
    prayer_text = _prayer_text_from_sidecar_job(job)
    return {
        "title": _clean(job.get("title")),
        "episode_id": _clean(job.get("episode_id")),
        "published_date": _clean(job.get("published_date")),
        "audio_url": _clean(job.get("audio_url")),
        "audio_status": status,
        "has_prayer_text": bool(prayer_text["sections"]),
    }


def _audio_date_status(job: Dict[str, Any], today: _dt.date) -> str:
    published = _parse_iso_date(job.get("published_date"))
    if not published:
        return "none"
    if published == today:
        return "today"
    if published > today:
        return "upcoming"
    return "fallback"


def _job_matches_entry(job: Dict[str, Any], entry: Dict[str, Any]) -> bool:
    contract_ids = set(entry.get("related_contracts") or [])
    entry_ids = set(entry.get("related_entry_ids") or [])
    return _clean(job.get("contract_id")) in contract_ids or _clean(job.get("entry_id")) in entry_ids


def _select_audio_for_entry(entry: Dict[str, Any], jobs: Sequence[Dict[str, Any]], today: _dt.date) -> Dict[str, Any]:
    today_jobs: List[Dict[str, Any]] = []
    fallback_jobs: List[Dict[str, Any]] = []
    upcoming_jobs: List[Dict[str, Any]] = []
    for job in jobs:
        if not _job_matches_entry(job, entry):
            continue
        status = _audio_date_status(job, today)
        if status == "today":
            today_jobs.append(job)
        elif status == "fallback":
            fallback_jobs.append(job)
        elif status == "upcoming":
            upcoming_jobs.append(job)
    selected_status = "none"
    selected_job: Optional[Dict[str, Any]] = None
    if today_jobs:
        selected_status = "today"
        selected_job = today_jobs[0]
    elif fallback_jobs:
        selected_status = "fallback"
        selected_job = fallback_jobs[0]
    elif upcoming_jobs:
        selected_status = "upcoming"
        selected_job = upcoming_jobs[-1]
    return {"status": selected_status, "job": selected_job}


def _audio_label(entry: Dict[str, Any]) -> str:
    audio = entry.get("selected_audio") or {}
    date_text = _clean(audio.get("published_date"))
    status = _clean(entry.get("audio_status"))
    if status == "today" and date_text:
        return f"Today: {date_text}"
    if status == "fallback" and date_text:
        return f"Most recent: {date_text}"
    if status == "upcoming" and date_text:
        return f"Upcoming: {date_text}"
    return ""


def _audio_heading(entry: Dict[str, Any]) -> str:
    status = _clean(entry.get("audio_status"))
    if status == "today":
        return "Today's episode"
    if status == "fallback":
        return "Most recent available episode"
    if status == "upcoming":
        return "Upcoming episode"
    return ""


def _attach_today_audio(entries: Sequence[Dict[str, Any]], jobs: Sequence[Dict[str, Any]], today: _dt.date) -> None:
    novena_episodes = [
        _novena_episode_from_job(dict(job, audio_status=_audio_date_status(job, today)))
        for job in jobs
        if _clean(job.get("contract_type")) == "novena_feast_rule"
    ]
    novena_episodes.sort(
        key=lambda item: (
            0 if item.get("audio_status") == "today" else 1 if item.get("audio_status") == "fallback" else 2,
            -(_parse_iso_date(item.get("published_date")) or _dt.date.min).toordinal(),
            item.get("episode_id", ""),
        )
    )
    for entry in entries:
        entry["audio_status"] = "none"
        entry["today_audio"] = None
        entry["fallback_audio"] = None
        entry["upcoming_audio"] = None
        entry["selected_audio"] = None
        if entry.get("slug") == "daily-novenas":
            entry["novena_episodes"] = novena_episodes
            for status in ("today", "fallback", "upcoming"):
                matching = [episode for episode in novena_episodes if episode.get("audio_status") == status]
                if matching:
                    latest = matching[0]
                    entry[f"{status}_audio"] = {
                        "title": latest["title"],
                        "episode_id": latest["episode_id"],
                        "published_date": latest["published_date"],
                        "audio_url": latest["audio_url"],
                        "audio_status": status,
                        "has_prayer_text": bool((latest.get("prayer_text") or {}).get("sections")),
                    }
                    if not entry.get("selected_audio"):
                        entry["selected_audio"] = entry[f"{status}_audio"]
                        entry["audio_status"] = status
            if entry.get("selected_audio"):
                entry["latest_audio"] = entry["selected_audio"]
            continue
        selection = _select_audio_for_entry(entry, jobs, today)
        selected_job = selection.get("job")
        selected_status = _clean(selection.get("status")) or "none"
        if not selected_job:
            continue
        audio_payload = _audio_payload_from_job(selected_job, status=selected_status)
        entry[f"{selected_status}_audio"] = audio_payload
        entry["selected_audio"] = audio_payload
        entry["latest_audio"] = audio_payload
        entry["audio_status"] = selected_status
        prayer_text = _prayer_text_from_sidecar_job(selected_job)
        if prayer_text["sections"] and selected_status in {"today", "fallback"}:
            entry["latest_prayer_text"] = prayer_text


def load_prayer_site_entries(
    *,
    publish_contract_dir: Optional[Path] = None,
    spotify_contract_dir: Optional[Path] = None,
    spotify_playlist_dir: Optional[Path] = None,
    docs_root: Optional[Path] = None,
    base_url: Optional[str] = None,
    audio_base_url: Optional[str] = None,
    today: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    site_today = _site_today(today)
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
    jobs = load_published_audio_jobs(docs_root=docs_root, base_url=base_url, audio_base_url=audio_base_url)
    _attach_today_audio(entries, jobs, site_today)
    return entries


def build_site_manifest(
    entries: Sequence[Dict[str, Any]],
    *,
    base_url: Optional[str] = None,
    audio_base_url: Optional[str] = None,
    today: Optional[Any] = None,
    liturgical_context: Optional[Dict[str, Any]] = None,
    brand_assets: Optional[Dict[str, Any]] = None,
    devotional_images: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    site_base = _clean(base_url or github_pages_base_url()).rstrip("/")
    audio_archive_url = audio_archive_public_url(base_url=site_base, audio_base_url=audio_base_url)
    site_today = _site_today(today)
    context = liturgical_context or _build_site_liturgical_context(site_today)
    items: List[Dict[str, Any]] = []
    for entry in entries:
        item = {key: value for key, value in entry.items() if key not in {"order"}}
        item["url"] = f"{site_base}/prayers/{entry['slug']}/" if site_base else f"prayers/{entry['slug']}/"
        item["path"] = f"prayers/{entry['slug']}/index.html"
        items.append(item)
    return {
        "generated_at": _iso_utc_now(),
        "today": site_today.isoformat(),
        "base_url": site_base,
        "audio_archive_url": audio_archive_url,
        "liturgical_context": context,
        "brand_assets": brand_assets or {},
        "devotional_images": devotional_images or {},
        "count": len(items),
        "groups": list(PRAYLIST_GROUPS),
        "items": items,
    }


def _primary_href(entry: Dict[str, Any]) -> str:
    selected = entry.get("selected_audio") or entry.get("latest_audio") or {}
    if selected.get("audio_url"):
        return _clean(selected["audio_url"])
    if entry.get("external_url"):
        return _clean(entry["external_url"])
    if entry.get("feed_url"):
        return _clean(entry["feed_url"])
    return _clean(entry.get("archive_url")) or "#"


def _href_from_prayer_page(value: Any) -> str:
    href = _clean(value)
    if not href:
        return "#"
    if re.fullmatch(r"https?://[^\s]+", href):
        return href
    return f"../../{href.lstrip('/')}"


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
      --bg: #f8f3e9;
      --paper: #fffdf8;
      --ink: #071f3d;
      --muted: #5e6470;
      --line: #d8c8a4;
      --navy: #08284f;
      --navy-soft: #12365f;
      --gold: #a77b32;
      --gold-soft: #efe2bf;
      --ivory: #fff8ea;
      --accent: #2f6b4f;
      --accent-soft: #dfeee5;
      --shadow: 0 12px 28px rgba(8, 40, 79, 0.10);
    }
    body.theme-green { --accent: #2f6b4f; --accent-soft: #dfeee5; }
    body.theme-purple { --accent: #6e447d; --accent-soft: #eadff0; }
    body.theme-gold { --accent: #a77b32; --accent-soft: #f2e6c9; }
    body.theme-red { --accent: #9d3038; --accent-soft: #f0dddd; }
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
    a { color: var(--navy); }
    a:focus-visible { outline: 3px solid var(--gold); outline-offset: 3px; }
    .wrap { width: min(1120px, calc(100% - 32px)); margin: 0 auto; }
    header { padding: 18px 0; border-bottom: 1px solid var(--line); background: var(--paper); }
    .topline { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .brand { display: inline-flex; align-items: center; gap: 10px; color: var(--navy); text-decoration: none; font-weight: 800; text-transform: uppercase; }
    .brand img { width: 44px; height: 44px; object-fit: contain; }
    nav { display: flex; gap: 12px; flex-wrap: wrap; font-size: 0.94rem; }
    nav a { text-decoration: none; font-weight: 700; }
    .hero { padding: 34px 0 26px; background: linear-gradient(180deg, var(--paper), var(--ivory)); border-bottom: 1px solid var(--line); }
    .hero-grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(280px, 0.95fr); gap: 28px; align-items: center; }
    .hero-mark { width: 116px; height: 116px; object-fit: contain; margin-bottom: 18px; }
    h1 { margin: 0; max-width: 840px; font-family: Georgia, "Times New Roman", serif; font-size: clamp(2rem, 5vw, 4.1rem); line-height: 1.02; color: var(--navy); }
    .lede { max-width: 780px; margin: 14px 0 0; color: var(--muted); font-size: 1.08rem; }
    .hero-visual { aspect-ratio: 16 / 10; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--accent-soft); box-shadow: var(--shadow); }
    .hero-visual img { width: 100%; height: 100%; display: block; object-fit: cover; }
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
      border-top: 4px solid var(--accent);
    }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.82rem; color: var(--muted); }
    .pill { border: 1px solid var(--line); border-radius: 999px; padding: 3px 8px; background: #fbf8f1; }
    .pill.accent { border-color: var(--accent); color: var(--navy); background: var(--accent-soft); }
    .card h3 { margin: 0; font-size: 1.15rem; line-height: 1.2; }
    .subtitle { margin: -6px 0 0; color: var(--gold); font-weight: 700; font-size: 0.92rem; }
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
      border: 1px solid var(--navy);
      background: var(--navy);
      color: #fff;
    }
    .button.secondary { background: transparent; color: var(--navy); }
    .detail { max-width: 760px; padding: 24px 0 48px; }
    .detail-panel { margin-top: 20px; padding: 20px; border: 1px solid var(--line); border-radius: 8px; background: var(--paper); }
    .detail-visual { margin-top: 20px; aspect-ratio: 4 / 5; max-height: 520px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--accent-soft); }
    .detail-visual img { width: 100%; height: 100%; display: block; object-fit: cover; }
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
      .hero-grid { grid-template-columns: 1fr; }
      .hero-mark { width: 88px; height: 88px; }
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
        label = {
            "today": "Today",
            "fallback": "Most recent",
            "upcoming": "Upcoming",
        }.get(_clean(episode.get("audio_status")), "Episode")
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
              <p class="summary">{_html(label)}: {_html(episode.get('published_date'))}</p>
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
    audio_label = _audio_label(entry)
    audio_text = f"<span class=\"pill accent\">{_html(audio_label)}</span>" if audio_label else ""
    subtitle = f"<p class=\"subtitle\">{_html(entry.get('subtitle'))}</p>" if entry.get("subtitle") else ""
    return f"""
      <article class="card">
        <div class="meta">
          <span class="pill">{_html(entry.get('source_label'))}</span>
          <span class="pill">{_html(_availability_label(entry.get('availability', '')))}</span>
          {audio_text}
        </div>
        <h3>{_html(entry.get('title'))}</h3>
        {subtitle}
        <p class="summary">{_html(entry.get('summary'))}</p>
        <div class="actions">
          <a class="button" href="{detail_href}">Open prayer</a>
        </div>
      </article>
    """


def _brand_html(manifest: Dict[str, Any], *, root_prefix: str = "") -> str:
    mark = ((manifest.get("brand_assets") or {}).get("mark_160") or {}).get("url", "")
    image = f"""<img src="{_html(root_prefix + _clean(mark))}" alt="Ora Pro Nobis logo">""" if mark else ""
    return f"""<a class="brand" href="{_html(root_prefix or './')}">{image}<span>Ora Pro Nobis</span></a>"""


def _hero_visual_html(manifest: Dict[str, Any]) -> str:
    image = (manifest.get("devotional_images") or {}).get("wide") or {}
    if not image.get("url"):
        return ""
    return f"""
      <figure class="hero-visual">
        <img src="{_html(image.get('url'))}" alt="{_html(image.get('alt'))}" loading="lazy">
      </figure>
    """


def _detail_visual_html(manifest: Dict[str, Any]) -> str:
    image = (manifest.get("devotional_images") or {}).get("portrait") or {}
    if not image.get("url"):
        return ""
    return f"""
      <figure class="detail-visual">
        <img src="{_html(_page_relative_url(image.get('path')))}" alt="{_html(image.get('alt'))}" loading="lazy">
      </figure>
    """


def _site_index_html(entries: Sequence[Dict[str, Any]], manifest: Dict[str, Any]) -> str:
    audio_archive_url = _clean(manifest.get("audio_archive_url")) or "audio/"
    context = manifest.get("liturgical_context") or {}
    color = _clean(context.get("color")) or "green"
    mark = ((manifest.get("brand_assets") or {}).get("mark_320") or {}).get("url", "")
    mark_html = f"""<img class="hero-mark" src="{_html(mark)}" alt="Ora Pro Nobis logo">""" if mark else ""
    hero_visual = _hero_visual_html(manifest)
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
<body class="theme-{_html(color)}">
  <header>
    <div class="wrap topline">
      {_brand_html(manifest)}
      <nav aria-label="Prayer groups">
        <a href="#morning-praylist">Morning Praylist</a>
        <a href="#daily-praylist">Daily Praylist</a>
        <a href="#night-praylist">Night Praylist</a>
        <a href="{_html(audio_archive_url)}">Audio archive</a>
        <a href="podcast.xml">Podcast feed</a>
      </nav>
    </div>
  </header>
  <div class="hero">
    <div class="wrap hero-grid">
      <div>
        {mark_html}
        <div class="meta">
          <span class="pill accent">{_html(context.get('season') or 'Ordinary Time')}</span>
          <span class="pill">{_html(manifest.get('today'))}</span>
        </div>
        <h1>Ora Pro Nobis</h1>
        <p class="lede">{_html(context.get('summary') or 'Open active Morning, Daily, and Night Praylist prayers from one responsive directory.')}</p>
      </div>
      {hero_visual}
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
    selected_audio = entry.get("selected_audio") or entry.get("latest_audio") or {}
    audio_archive_url = _clean(manifest.get("audio_archive_url")) or "../../audio/"
    context = manifest.get("liturgical_context") or {}
    color = _clean(context.get("color")) or "green"
    audio_block = ""
    if selected_audio.get("audio_url"):
        heading = _audio_heading(entry)
        open_label = "Open audio"
        if entry.get("audio_status") == "today":
            open_label = "Open today's audio"
        audio_block = (
            f"""
            <div class="player">
              <p class="summary">{_html(heading)}: {_html(selected_audio.get('title'))} ({_html(selected_audio.get('published_date'))})</p>
              <audio controls src="{_html(selected_audio['audio_url'])}">Your browser does not support audio playback.</audio>
              <a class="button" href="{_html(selected_audio['audio_url'])}">{_html(open_label)}</a>
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
        archive_block = f"""<a class="button secondary" href="{_html(_href_from_prayer_page(entry['archive_url']))}">Audio archive</a>"""
    notes = f"<p>{_html(entry.get('notes'))}</p>" if entry.get("notes") else ""
    prayer_text = _prayer_text_html(entry.get("latest_prayer_text"))
    novena_episodes = _novena_episodes_html(entry)
    visual = _detail_visual_html(manifest)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{_html(entry.get('title'))} | Ora Pro Nobis</title>
  <meta name="description" content="{_html(entry.get('summary'))}">
  <style>{_site_css()}</style>
</head>
<body class="theme-{_html(color)}">
  <header>
    <div class="wrap topline">
      {_brand_html(manifest, root_prefix="../../")}
      <nav aria-label="Prayer navigation">
        <a href="../../">Directory</a>
        <a href="{_html(audio_archive_url)}">Audio archive</a>
        <a href="../../podcast.xml">Podcast feed</a>
      </nav>
    </div>
  </header>
  <main class="wrap detail">
    <div class="meta">
      <span class="pill">{_html(entry.get('source_label'))}</span>
      <span class="pill">{_html(_availability_label(entry.get('availability', '')))}</span>
      <span class="pill">{_html(entry.get('group_label'))}</span>
      <span class="pill accent">{_html(context.get('season') or 'Ordinary Time')}</span>
    </div>
    <h1>{_html(entry.get('title'))}</h1>
    <p class="lede">{_html(entry.get('summary'))}</p>
    {visual}
    <div class="detail-panel">
      {notes}
      <div class="links">
        {audio_block}
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
    audio_base_url: Optional[str] = None,
    today: Optional[Any] = None,
) -> Dict[str, Any]:
    root = Path(docs_root) if docs_root else PUBLISH_DOCS_DIR
    site_base = _clean(base_url or github_pages_base_url()).rstrip("/")
    resolved_audio_base = resolve_audio_public_base_url(base_url=site_base, audio_base_url=audio_base_url)
    site_today = _site_today(today)
    liturgical_context = _build_site_liturgical_context(site_today)
    brand_assets = _prepare_logo_assets(root)
    devotional_images = _select_devotional_images(_load_devotional_public_library(root), root, site_today)
    entries = load_prayer_site_entries(
        publish_contract_dir=publish_contract_dir,
        spotify_contract_dir=spotify_contract_dir,
        spotify_playlist_dir=spotify_playlist_dir,
        docs_root=root,
        base_url=site_base,
        audio_base_url=resolved_audio_base,
        today=site_today,
    )
    if not entries:
        raise RuntimeError("No enabled prayer website entries were found.")
    manifest = build_site_manifest(
        entries,
        base_url=site_base,
        audio_base_url=resolved_audio_base,
        today=site_today,
        liturgical_context=liturgical_context,
        brand_assets=brand_assets,
        devotional_images=devotional_images,
    )

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
    parser.add_argument("--audio-base-url", default=None, help="Public base URL for generated audio links.")
    parser.add_argument("--today", default=None, help="Override the local site date for testing, in YYYY-MM-DD format.")
    args = parser.parse_args(argv)
    result = write_prayer_site(
        docs_root=args.docs_root,
        base_url=args.base_url,
        audio_base_url=args.audio_base_url,
        today=args.today,
    )
    print(
        f"Wrote prayer website: {result['site_index_path']} "
        f"({result['count']} entries, {len(result['site_pages'])} pages)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
