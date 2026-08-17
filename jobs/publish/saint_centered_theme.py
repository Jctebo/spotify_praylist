from __future__ import annotations

import datetime as _dt
import re
from dataclasses import asdict, dataclass
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence

from jobs.novena.liturgical_helpers import celebration_name, infer_celebration_rank, romcal_fetch_day


THEME_VERSION = "saint-centered-theme-v1"
DEFAULT_CALENDAR = "general_roman"
DEFAULT_LOCALE = "en"
RANK_PRIORITY = {
    "sunday": 0,
    "solemnity": 1,
    "feast": 2,
    "memorial": 3,
    "optional_memorial": 4,
    "weekday": 5,
    "easter_octave": 6,
    "": 7,
}


@dataclass(frozen=True)
class CalendarWindowItem:
    date: str
    name: str
    rank: str
    season: str
    source: str = "romcal"
    gospel_citation: str = ""
    gospel_theme: str = ""

    def to_dict(self) -> Dict[str, str]:
        return asdict(self)


@dataclass(frozen=True)
class SaintCenteredThemeBrief:
    target_date: str
    timezone: str
    calendar: str
    locale: str
    window_start: str
    window_end: str
    primary_anchor: str
    primary_rank: str
    primary_anchor_date: str
    supporting_items: tuple[Dict[str, str], ...]
    themes: tuple[str, ...]
    season: str
    rationale: str
    confidence: str
    excluded_items: tuple[Dict[str, str], ...]
    window_items: tuple[Dict[str, str], ...]
    source: str
    fallback_reason: str = ""
    version: str = THEME_VERSION

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["supporting_items"] = [dict(item) for item in self.supporting_items]
        payload["excluded_items"] = [dict(item) for item in self.excluded_items]
        payload["window_items"] = [dict(item) for item in self.window_items]
        return payload

    @property
    def title(self) -> str:
        return " and ".join(_humanize(item) for item in self.themes[:2]) or "Trustful Perseverance"

    @property
    def summary(self) -> str:
        return f"Today's anchor is {self.primary_anchor}, inviting {self.title.lower()} through {self.season or 'the liturgical day'}."


def build_saint_centered_theme_brief(
    target_date: _dt.date,
    *,
    calendar: str = DEFAULT_CALENDAR,
    locale: str = DEFAULT_LOCALE,
    timezone: str = "America/Chicago",
    allow_missing_gospel: bool = True,
    day_fetcher: Callable[[str, str, _dt.date], Sequence[Any]] = romcal_fetch_day,
    gospel_fetcher: Optional[Callable[..., Any]] = None,
) -> SaintCenteredThemeBrief:
    effective_calendar = str(calendar or DEFAULT_CALENDAR).strip() or DEFAULT_CALENDAR
    effective_locale = str(locale or DEFAULT_LOCALE).strip() or DEFAULT_LOCALE
    start = target_date - _dt.timedelta(days=3)
    end = target_date + _dt.timedelta(days=9)
    rows: List[CalendarWindowItem] = []
    errors: List[str] = []
    gospel_fetcher = gospel_fetcher or _default_gospel_fetcher
    for offset in range(13):
        day = start + _dt.timedelta(days=offset)
        try:
            raw_rows = day_fetcher(effective_calendar, effective_locale, day)
        except Exception as exc:
            errors.append(f"{day.isoformat()}: calendar unavailable: {exc}")
            raw_rows = []
        gospel = (
            _fetch_gospel(gospel_fetcher, day, effective_calendar, effective_locale, errors, allow_missing_gospel)
            if day == target_date
            else None
        )
        rows.extend(_normalize_rows(day, raw_rows, gospel))

    rows = _deduplicate(rows)
    target_rows = [row for row in rows if row.date == target_date.isoformat()]
    anchor = _select_anchor(target_rows, target_date)
    season = _season_for(target_rows, rows)
    if anchor is None:
        anchor = CalendarWindowItem(
            date=target_date.isoformat(),
            name=f"{season or 'Ordinary Time'} prayer",
            rank="weekday",
            season=season,
            source="deterministic-fallback",
        )
        errors.append("No target-day observance was available; deterministic seasonal fallback selected.")

    supporting = _supporting(rows, anchor, target_date)
    themes = _themes(anchor, supporting, season)
    excluded = [row.to_dict() for row in rows if row not in [anchor, *supporting]][:12]
    confidence = "high" if anchor.source == "romcal" and anchor.rank not in {"weekday", ""} else "medium"
    rationale = _rationale(anchor, supporting, themes, season)
    return SaintCenteredThemeBrief(
        target_date=target_date.isoformat(),
        timezone=str(timezone or "America/Chicago"),
        calendar=effective_calendar,
        locale=effective_locale,
        window_start=start.isoformat(),
        window_end=end.isoformat(),
        primary_anchor=anchor.name,
        primary_rank=anchor.rank,
        primary_anchor_date=anchor.date,
        supporting_items=tuple(item.to_dict() for item in supporting),
        themes=tuple(themes),
        season=season,
        rationale=rationale,
        confidence=confidence,
        excluded_items=tuple(excluded),
        window_items=tuple(item.to_dict() for item in rows),
        source="deterministic-calendar-window",
        fallback_reason="; ".join(errors),
    )


def _default_gospel_fetcher(*args: Any, **kwargs: Any) -> Any:
    try:
        from jobs.publish.daily_intro import fetch_daily_gospel_context

        return fetch_daily_gospel_context(*args, **kwargs)
    except Exception:
        return None


def _fetch_gospel(
    fetcher: Callable[..., Any],
    day: _dt.date,
    calendar: str,
    locale: str,
    errors: List[str],
    allow_missing_gospel: bool,
) -> Any:
    try:
        return fetcher(day, calendar=calendar, locale=locale, allow_missing_gospel=allow_missing_gospel)
    except Exception as exc:
        errors.append(f"{day.isoformat()}: Gospel unavailable: {exc}")
        return None


def _normalize_rows(day: _dt.date, raw_rows: Sequence[Any], gospel: Any) -> List[CalendarWindowItem]:
    result: List[CalendarWindowItem] = []
    citation = _clean(getattr(gospel, "gospel_citation", ""))
    gospel_theme = _clean(getattr(gospel, "gospel_theme", ""))
    for raw in raw_rows or ():
        if not isinstance(raw, dict):
            continue
        name = _clean(celebration_name(raw))
        if not name:
            continue
        rank = _rank(raw, name)
        season = _season(raw)
        result.append(CalendarWindowItem(day.isoformat(), name, rank, season, "romcal", citation, gospel_theme))
    if not result and gospel is not None and (citation or gospel_theme):
        result.append(CalendarWindowItem(day.isoformat(), "Weekday Gospel", "weekday", "", "gospel", citation, gospel_theme))
    return result


def _rank(raw: Dict[str, Any], name: str) -> str:
    value = str(infer_celebration_rank(raw) or raw.get("rank") or raw.get("rank_name") or "").strip().lower()
    value = value.replace("-", "_").replace(" ", "_")
    if "easter" in value and "octave" in value:
        return "easter_octave"
    if "sunday" in name.lower() and value in {"", "weekday"}:
        return "sunday"
    return value


def _season(raw: Dict[str, Any]) -> str:
    value = raw.get("season") or raw.get("season_name") or ""
    value = str(getattr(value, "value", value)).replace("Season.", "").replace("_", " ").strip()
    if value.lower() == "easter time":
        return "Easter season"
    return value.title()


def _deduplicate(rows: Iterable[CalendarWindowItem]) -> List[CalendarWindowItem]:
    seen: set[tuple[str, str, str]] = set()
    result: List[CalendarWindowItem] = []
    for row in rows:
        key = (row.date, row.name.casefold(), row.rank)
        if key not in seen:
            seen.add(key)
            result.append(row)
    return sorted(result, key=lambda row: (row.date, RANK_PRIORITY.get(row.rank, 99), row.name.casefold()))


def _select_anchor(rows: Sequence[CalendarWindowItem], target_date: _dt.date) -> Optional[CalendarWindowItem]:
    if not rows:
        return None
    target = target_date.isoformat()
    target_rows = [row for row in rows if row.date == target]
    candidates = target_rows or list(rows)
    return sorted(candidates, key=lambda row: (RANK_PRIORITY.get(row.rank, 99), 0 if row.source == "romcal" else 1, row.name.casefold()))[0]


def _supporting(rows: Sequence[CalendarWindowItem], anchor: CalendarWindowItem, target_date: _dt.date) -> List[CalendarWindowItem]:
    candidates = [row for row in rows if row != anchor and row.name != anchor.name]
    candidates.sort(key=lambda row: (0 if row.date == target_date.isoformat() else 1, RANK_PRIORITY.get(row.rank, 99), abs((_dt.date.fromisoformat(row.date) - target_date).days), row.name.casefold()))
    return candidates[:3]


def _season_for(target_rows: Sequence[CalendarWindowItem], rows: Sequence[CalendarWindowItem]) -> str:
    for row in target_rows:
        if row.season:
            return row.season
    for row in rows:
        if row.season:
            return row.season
    return "Ordinary Time"


def _themes(anchor: CalendarWindowItem, supporting: Sequence[CalendarWindowItem], season: str) -> List[str]:
    text = f"{anchor.name} {' '.join(item.name for item in supporting)} {season}".lower()
    themes: List[str] = []
    rules = (
        ("mercy", ("mercy", "heart", "compassion", "forgiv")),
        ("mission", ("apostle", "evangel", "mission", "martyr")),
        ("surrender", ("mary", "immaculate", "assumption", "annunciation")),
        ("resurrection hope", ("easter", "resurrection")),
        ("repentance", ("lent", "ash", "penance")),
        ("charity", ("charity", "poor", "love")),
        ("perseverance", ("confessor", "persever", "virgin")),
    )
    for theme, needles in rules:
        if any(needle in text for needle in needles):
            themes.append(theme)
    if not themes:
        themes.append("trustful perseverance")
    if "easter" in season.lower() and "resurrection hope" not in themes:
        themes.append("resurrection hope")
    if len(themes) < 3:
        themes.append("faithful prayer")
    return list(dict.fromkeys(themes))[:5]


def _rationale(anchor: CalendarWindowItem, supporting: Sequence[CalendarWindowItem], themes: Sequence[str], season: str) -> str:
    support = ", ".join(item.name for item in supporting) or "the surrounding liturgical days"
    return f"The target-day {anchor.rank or 'proper'} anchor remains primary. {support} support continuity without displacing it. The season is {season or 'the liturgical day'}, and the shared themes are {', '.join(themes)}."


def _humanize(value: str) -> str:
    return " ".join(part.capitalize() for part in re.split(r"\s+", value.strip()) if part)


def _clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())
