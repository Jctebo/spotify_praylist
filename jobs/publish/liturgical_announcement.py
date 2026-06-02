from __future__ import annotations

import datetime as _dt
import re
from typing import Any, List, Optional, Sequence

from jobs.novena.liturgical_helpers import celebration_name, romcal_fetch_day
from jobs.publish.errors import DailyIntroMissingDataError
from jobs.publish.formatting import format_date


def _normalize_whitespace(value: Any) -> str:
    return " ".join(str(value or "").split()).strip()


def _join_with_and(items: Sequence[str]) -> str:
    cleaned = [str(item or "").strip() for item in items if str(item or "").strip()]
    if not cleaned:
        return ""
    if len(cleaned) == 1:
        return cleaned[0]
    if len(cleaned) == 2:
        return f"{cleaned[0]} and {cleaned[1]}"
    return ", ".join(cleaned[:-1]) + f", and {cleaned[-1]}"


def _normalize_season_label(value: Any) -> str:
    raw = getattr(value, "value", value)
    text = str(raw or "").strip()
    if not text:
        return ""
    if text.startswith("Season."):
        text = text.split(".", 1)[1]
    text = re.sub(r"[_-]+", " ", text).strip()
    return text.title()


def _celebration_names(rows: Sequence[Any]) -> List[str]:
    names: List[str] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = _normalize_whitespace(celebration_name(row))
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        names.append(name)
    return names


def build_liturgical_announcement_text(
    date_value: _dt.date,
    *,
    calendar: Optional[str] = None,
    locale: Optional[str] = None,
    include_season: bool = False,
) -> str:
    effective_calendar = str(calendar or "").strip() or "general_roman"
    effective_locale = str(locale or "").strip() or "en"
    rows = romcal_fetch_day(effective_calendar, effective_locale, date_value)
    if not rows:
        raise DailyIntroMissingDataError(
            f"Romcal returned no celebrations for {date_value.isoformat()} "
            f"(calendar={effective_calendar}, locale={effective_locale})."
        )

    names = _celebration_names(rows)
    if not names:
        raise DailyIntroMissingDataError(
            f"Romcal returned no usable celebration names for {date_value.isoformat()} "
            f"(calendar={effective_calendar}, locale={effective_locale})."
        )

    date_display = format_date(date_value, "%A, %B %-d, %Y")
    parts = [f"Today is {date_display}.", f"Today the Church celebrates {_join_with_and(names)}."]
    if include_season:
        primary = rows[0] if isinstance(rows[0], dict) else {}
        season_label = _normalize_season_label(primary.get("season") or primary.get("season_name"))
        if season_label:
            parts.append(f"Liturgical season: {season_label}.")
    return " ".join(parts).strip()
