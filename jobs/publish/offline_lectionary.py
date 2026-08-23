from __future__ import annotations

import datetime as _dt
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LECTIONARY_PATH = ROOT / "config" / "publish" / "offline" / "lectionary.json"
DEFAULT_BIBLE_PATH = ROOT / "config" / "publish" / "offline" / "douay-rheims.json"
SOURCE = "offline-douay-rheims"
TRANSLATION = "Original Douay-Rheims"


class OfflineLectionaryError(RuntimeError):
    """The local lectionary or Bible cache cannot satisfy a requested lookup."""


@dataclass(frozen=True)
class OfflineGospel:
    citation: str
    text: str
    mass_title: str
    source: str = SOURCE
    translation: str = TRANSLATION
    catalog_version: str = ""
    bible_version: str = ""


def _load_json(path: Path) -> Dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise OfflineLectionaryError(f"Offline cache is missing: {path}") from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise OfflineLectionaryError(f"Offline cache could not be read: {path}") from exc
    if not isinstance(payload, dict):
        raise OfflineLectionaryError(f"Offline cache root must be an object: {path}")
    return payload


def _clean(value: Any) -> str:
    return " ".join(str(value or "").split()).strip()


def _date_key(value: Any) -> str:
    if isinstance(value, _dt.datetime):
        value = value.date()
    if isinstance(value, _dt.date):
        return value.isoformat()
    raw = _clean(value)
    try:
        return _dt.date.fromisoformat(raw).isoformat()
    except ValueError as exc:
        raise OfflineLectionaryError(f"Invalid offline lookup date: {raw!r}") from exc


def canonical_reference(value: Any) -> str:
    """Normalize harmless punctuation/spacing differences in Bible references."""
    text = _clean(value).replace("–", "-").replace("—", "-")
    text = re.sub(r"\s*:\s*", ":", text)
    text = re.sub(r"\s*,\s*", ", ", text)
    text = re.sub(r"\s*-\s*", "-", text)
    return text


def resolve_offline_gospel(
    date_value: Any,
    *,
    calendar: str = "general_roman",
    locale: str = "en",
    lectionary_path: Optional[Path] = None,
    bible_path: Optional[Path] = None,
) -> OfflineGospel:
    if _clean(calendar) != "general_roman" or _clean(locale) != "en":
        raise OfflineLectionaryError(
            f"Offline cache only supports calendar=general_roman and locale=en; got {calendar!r}/{locale!r}."
        )
    catalog = _load_json(lectionary_path or DEFAULT_LECTIONARY_PATH)
    bible = _load_json(bible_path or DEFAULT_BIBLE_PATH)
    date_key = _date_key(date_value)
    entries = catalog.get("entries")
    passages = bible.get("passages")
    if not isinstance(entries, dict) or not isinstance(passages, dict):
        raise OfflineLectionaryError("Offline cache must contain object-valued entries and passages.")
    entry = entries.get(date_key)
    if not isinstance(entry, dict):
        raise OfflineLectionaryError(f"No offline lectionary entry for {date_key}.")
    citation = canonical_reference(entry.get("gospel") or (entry.get("readings") or {}).get("gospel"))
    if not citation:
        raise OfflineLectionaryError(f"Offline lectionary entry has no Gospel citation for {date_key}.")
    text = _clean(passages.get(citation))
    if not text:
        raise OfflineLectionaryError(f"No cached Douay-Rheims text for {citation} ({date_key}).")
    return OfflineGospel(
        citation=citation,
        text=text,
        mass_title=_clean(entry.get("mass_title")) or citation,
        catalog_version=_clean(catalog.get("version")),
        bible_version=_clean(bible.get("version")),
    )
