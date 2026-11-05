"""Saint-witness ladder for the Daily Reflection (John, approved 2026-11-05).

The Daily Reflection's saint witness is resolved by a fixed ladder. The
base calendar is the CURRENT calendar, unchanged:

1. The current calendar names a saint -> that saint (source "calendar").
2. No saint + the date is a Saturday -> the Blessed Virgin Mary
   (source "saturday"; Saturday is dedicated to Our Lady — an in-day
   source, no backup needed).
3. No saint + not Saturday -> BACKUP SOURCES, paired: the Roman
   Martyrology's lead commemoration for the date names the saint, and the
   1962 calendar's observance for the date is carried alongside
   (source "backup").
4. The backups name none -> no saint; the reflection is Gospel only
   (source "none").

Backup data is vendored offline in
``config/publish/offline/martyrology-1962.json`` (built by
``scripts/build_martyrology_dataset.py`` from the pre-conciliar
public-domain English Martyrology — the Divinum Officium text, also at
laudatedominum.net — and a 1962 observance name derived from the Divinum
Officium Sancti/Kalendaria data).

Wording rules that consume this module (cron step 2, runner README):
in-day saints (rungs 1-2) are carried by "The Church celebrates ..." with
no "Today's saint is ..." sentence; backup saints (rung 3) take both
"Today's saint is [name]." and "This saint was chosen based on the Roman
Martyrology and the traditional calendar of 1962, which this podcast
keeps as a private devotion."
"""

from __future__ import annotations

import datetime as dt
import json
from functools import lru_cache
from pathlib import Path

_DATASET_PATH = (
    Path(__file__).resolve().parents[2]
    / "config"
    / "publish"
    / "offline"
    / "martyrology-1962.json"
)

BLESSED_VIRGIN_MARY = "the Blessed Virgin Mary"
QUOTE_SOURCE = "Roman Martyrology"


@lru_cache(maxsize=1)
def _entries() -> dict:
    try:
        payload = json.loads(_DATASET_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    entries = payload.get("entries")
    return entries if isinstance(entries, dict) else {}


def backup_for(target: dt.date) -> dict | None:
    """The vendored backup entry for the date, or None when it names no lead."""
    entry = _entries().get(target.strftime("%m-%d"))
    if not isinstance(entry, dict):
        return None
    if not str(entry.get("martyrology_lead", "")).strip():
        return None
    return entry


def resolve_witness(target: dt.date, calendar_saint: str = "") -> dict:
    """Resolve the Daily Reflection witness for ``target`` by the ladder.

    Returns a dict with the witness name, its source rung, the backup
    fields (populated on rung 3), and the witness-quote schema fields
    (saintWitnessQuote / saintWitnessQuoteSource /
    saintWitnessQuoteSourceUrl, populated on rung 3 from the Martyrology
    eulogy).
    """
    result = {
        "witness_name": "",
        "witness_source": "none",
        "martyrology_lead": "",
        "martyrology_text": "",
        "calendar_1962": "",
        "saintWitnessQuote": "",
        "saintWitnessQuoteSource": "",
        "saintWitnessQuoteSourceUrl": "",
    }
    saint = str(calendar_saint or "").strip()
    if saint:
        result["witness_name"] = saint
        result["witness_source"] = "calendar"
        return result
    if target.weekday() == 5:  # Saturday is dedicated to the Blessed Virgin Mary.
        result["witness_name"] = BLESSED_VIRGIN_MARY
        result["witness_source"] = "saturday"
        return result
    entry = backup_for(target)
    if entry is not None:
        lead = str(entry.get("martyrology_lead", "")).strip()
        text = str(entry.get("martyrology_text", "")).strip()
        result["witness_name"] = lead
        result["witness_source"] = "backup"
        result["martyrology_lead"] = lead
        result["martyrology_text"] = text
        result["calendar_1962"] = str(entry.get("calendar_1962", "")).strip()
        if text:
            result["saintWitnessQuote"] = text
            result["saintWitnessQuoteSource"] = QUOTE_SOURCE
            result["saintWitnessQuoteSourceUrl"] = str(
                entry.get("martyrology_url", "")
            ).strip()
        return result
    return result
