from __future__ import annotations

import re
import sys
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Sequence

from jobs.novena.liturgical_helpers import celebration_name, infer_celebration_rank, romcal_fetch_day
from jobs.publish.daily_intro import _normalize_whitespace, fetch_daily_gospel_context

FEAST_RANKS = frozenset({"solemnity", "feast", "memorial", "optional_memorial"})
MAJOR_RANKS = frozenset({"solemnity", "feast"})
SAINT_FALLBACK = "Saint Ignatius of Loyola"
SHARED_THEME_VERSION = "daily-theme-v1"


@dataclass(frozen=True)
class DailyLiturgicalContext:
    date: str
    liturgicalSeason: str
    liturgicalWeek: str
    feastDay: str
    liturgicalRank: str
    saintOfDay: str
    gospelTheme: str
    primaryTheme: str
    secondaryThemes: tuple[str, ...]
    emotionalTone: str
    reflectionFocus: str
    suggestedImagery: tuple[str, ...]
    suggestedMusicMood: str
    openingTone: str
    closingTone: str
    saintIntercessions: tuple[str, ...]
    shortSummary: str
    source: str
    fallbackReason: str = ""
    gospelCitation: str = ""
    calendar: str = "general_roman"
    locale: str = "en"
    sharedThemeTitle: str = ""
    sharedThemeSlug: str = ""
    sharedThemeExplanation: str = ""
    sharedThemeTransition: str = ""
    sharedThemeReflectionFocus: str = ""
    sharedThemeSources: tuple[Dict[str, str], ...] = ()
    sharedThemeVersion: str = SHARED_THEME_VERSION

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["secondaryThemes"] = list(self.secondaryThemes)
        payload["suggestedImagery"] = list(self.suggestedImagery)
        payload["saintIntercessions"] = list(self.saintIntercessions)
        payload["sharedThemeSources"] = [dict(item) for item in self.sharedThemeSources]
        return payload


def build_daily_liturgical_context(
    date_value,
    *,
    calendar: Optional[str] = None,
    locale: Optional[str] = None,
    allow_missing_gospel: bool = True,
) -> DailyLiturgicalContext:
    effective_calendar = str(calendar or "general_roman").strip() or "general_roman"
    effective_locale = str(locale or "en").strip() or "en"
    rows: Sequence[Any] = []
    romcal_error = ""
    try:
        rows = romcal_fetch_day(effective_calendar, effective_locale, date_value)
    except Exception as exc:
        romcal_error = str(exc)
        print(f"WARN daily_liturgical_context romcal_unavailable detail={exc}", file=sys.stderr)

    gospel_context: Any = None
    gospel_error = ""
    try:
        gospel_context = fetch_daily_gospel_context(
            date_value,
            calendar=effective_calendar,
            locale=effective_locale,
            allow_missing_gospel=allow_missing_gospel,
        )
    except Exception as exc:
        gospel_error = str(exc)
        print(f"WARN daily_liturgical_context gospel_unavailable detail={exc}", file=sys.stderr)

    celebrations = _celebrations(rows)
    feast = _primary_feast(celebrations)
    season = _season_label_from_rows(rows)
    liturgical_week = _liturgical_week_from_rows(rows)
    gospel_text = str(getattr(gospel_context, "gospel_text", "") or "").strip()
    gospel_citation = _normalize_whitespace(getattr(gospel_context, "gospel_citation", ""))
    gospel_theme = _theme_from_gospel(gospel_text)

    if feast and feast["rank"] in MAJOR_RANKS:
        source = "feast"
        primary_theme = _theme_from_feast(feast["name"], feast["rank"])
    elif gospel_theme:
        source = "gospel"
        primary_theme = gospel_theme
    elif feast:
        source = "memorial"
        primary_theme = _theme_from_feast(feast["name"], feast["rank"])
    elif season:
        source = "season"
        primary_theme = _theme_from_season(season)
    else:
        source = "fallback"
        primary_theme = "trust"

    saint_name = _saint_name(feast["name"] if feast else "")
    if not saint_name and feast and feast["rank"] in {"memorial", "optional_memorial"}:
        saint_name = feast["name"]
    secondary = _secondary_themes(primary_theme, gospel_theme, season, feast["rank"] if feast else "")
    tone = _tone_for(primary_theme, source, season)
    imagery = _imagery_for(primary_theme, season)
    focus_label = _focus_label(source, feast["name"] if feast else "", gospel_citation, season)
    fallback_reason = "; ".join(part for part in (romcal_error, gospel_error) if part)
    summary = _summary(primary_theme, focus_label, season)
    shared_theme = _shared_theme_payload(
        primary_theme=primary_theme,
        gospel_theme=gospel_theme,
        season=season,
        feast=feast,
        celebrations=celebrations,
        gospel_citation=gospel_citation,
        source=source,
    )

    return DailyLiturgicalContext(
        date=date_value.isoformat(),
        liturgicalSeason=season or "Ordinary Time",
        liturgicalWeek=liturgical_week,
        feastDay=feast["name"] if feast else "",
        liturgicalRank=feast["rank"] if feast else "",
        saintOfDay=saint_name,
        gospelTheme=gospel_theme,
        primaryTheme=primary_theme,
        secondaryThemes=tuple(secondary),
        emotionalTone=tone,
        reflectionFocus=f"Notice where God invites {primary_theme} through {focus_label}.",
        suggestedImagery=tuple(imagery),
        suggestedMusicMood=_music_mood_for(tone),
        openingTone=_opening_tone_for(tone),
        closingTone=_closing_tone_for(tone),
        saintIntercessions=tuple([saint_name] if saint_name else []),
        shortSummary=summary,
        source=source,
        fallbackReason=fallback_reason,
        gospelCitation=gospel_citation,
        calendar=effective_calendar,
        locale=effective_locale,
        sharedThemeTitle=shared_theme["title"],
        sharedThemeSlug=shared_theme["slug"],
        sharedThemeExplanation=shared_theme["explanation"],
        sharedThemeTransition=shared_theme["transition"],
        sharedThemeReflectionFocus=shared_theme["reflection_focus"],
        sharedThemeSources=tuple(shared_theme["sources"]),
        sharedThemeVersion=SHARED_THEME_VERSION,
    )


def _celebrations(rows: Sequence[Any]) -> List[Dict[str, str]]:
    celebrations: List[Dict[str, str]] = []
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
        rank = infer_celebration_rank(row).strip().lower().replace("-", "_").replace(" ", "_")
        celebrations.append({"name": name, "rank": rank})
    return celebrations


def _primary_feast(celebrations: Sequence[Dict[str, str]]) -> Optional[Dict[str, str]]:
    ranked = [item for item in celebrations if item.get("rank") in FEAST_RANKS]
    if not ranked:
        return None
    priority = {"solemnity": 0, "feast": 1, "memorial": 2, "optional_memorial": 3}
    return sorted(ranked, key=lambda item: priority.get(item.get("rank", ""), 99))[0]


def _season_label_from_rows(rows: Sequence[Any]) -> str:
    primary = rows[0] if rows and isinstance(rows[0], dict) else {}
    value = primary.get("season") or primary.get("season_name")
    raw = getattr(value, "value", value)
    text = str(raw or "").strip()
    if text.startswith("Season."):
        text = text.split(".", 1)[1]
    text = re.sub(r"[_-]+", " ", text).strip()
    if not text:
        return ""
    normalized = text.lower()
    if normalized == "easter time":
        return "Easter season"
    if normalized == "ordinary time":
        return "Ordinary Time"
    return text.title()


def _liturgical_week_from_rows(rows: Sequence[Any]) -> str:
    primary = rows[0] if rows and isinstance(rows[0], dict) else {}
    for key in ("week", "week_of_season", "season_week", "liturgical_week"):
        value = primary.get(key)
        raw = getattr(value, "value", value)
        text = _normalize_whitespace(raw)
        if text:
            return text
    return ""


def _theme_from_gospel(text: str) -> str:
    lowered = str(text or "").lower()
    checks = (
        ("mercy", ("mercy", "forgive", "forgiven", "compassion")),
        ("trust", ("do not be afraid", "fear not", "trust", "faith")),
        ("mission", ("sent", "proclaim", "preach", "witness", "go therefore")),
        ("humility", ("humble", "least", "child", "servant")),
        ("sacrificial love", ("lay down", "love one another", "cross")),
        ("gratitude", ("thanks", "thanksgiving", "praised god")),
        ("repentance", ("repent", "conversion", "sin no more")),
        ("discernment", ("listen", "hear my voice", "follow me", "choose")),
        ("resurrection hope", ("risen", "resurrection", "life", "empty tomb")),
        ("perseverance", ("remain", "abide", "endure", "watch")),
    )
    for theme, needles in checks:
        if any(needle in lowered for needle in needles):
            return theme
    return "hidden holiness" if lowered else ""


def _theme_from_feast(name: str, rank: str) -> str:
    lowered = str(name or "").lower()
    if any(word in lowered for word in ("martyr", "cross", "passion")):
        return "sacrificial love"
    if any(word in lowered for word in ("mary", "immaculate", "assumption")):
        return "surrender"
    if "apostle" in lowered or "evangelist" in lowered:
        return "mission"
    if "heart" in lowered or "mercy" in lowered:
        return "mercy"
    if "resurrection" in lowered or "easter" in lowered:
        return "resurrection hope"
    if str(rank or "") == "solemnity":
        return "gratitude"
    return "hidden holiness"


def _theme_from_season(season: str) -> str:
    lowered = str(season or "").lower()
    if "advent" in lowered:
        return "hopeful waiting"
    if "christmas" in lowered:
        return "gratitude"
    if "lent" in lowered:
        return "repentance"
    if "holy week" in lowered:
        return "sacrificial love"
    if "easter" in lowered:
        return "resurrection hope"
    return "trust"


def _secondary_themes(primary: str, gospel: str, season: str, rank: str) -> List[str]:
    values = [gospel, _theme_from_season(season), "discernment" if rank in {"memorial", "optional_memorial"} else ""]
    result: List[str] = []
    for value in values:
        value = _normalize_whitespace(value)
        if value and value != primary and value not in result:
            result.append(value)
    if "discernment" not in result:
        result.append("discernment")
    return result[:3]


def _tone_for(theme: str, source: str, season: str) -> str:
    lowered = f"{theme} {source} {season}".lower()
    if "lent" in lowered or "repentance" in lowered:
        return "penitential"
    if "solemnity" in lowered or "sacrificial" in lowered:
        return "solemn"
    if "resurrection" in lowered or "gratitude" in lowered or "easter" in lowered:
        return "joyful"
    if "perseverance" in lowered:
        return "quietly resilient"
    return "contemplative"


def _imagery_for(theme: str, season: str) -> List[str]:
    lowered = f"{theme} {season}".lower()
    if "resurrection" in lowered or "easter" in lowered:
        return ["morning light", "an open doorway", "a quiet garden"]
    if "repentance" in lowered or "lent" in lowered:
        return ["desert path", "ashes", "returning home"]
    if "mission" in lowered:
        return ["open roads", "lamplight", "hands extended"]
    if "mercy" in lowered:
        return ["healing hands", "a table set for return", "soft light"]
    return ["ordinary rooms", "steady candlelight", "a quiet threshold"]


def _music_mood_for(tone: str) -> str:
    if tone == "joyful":
        return "warm and hopeful"
    if tone == "penitential":
        return "spare and contemplative"
    if tone == "solemn":
        return "reverent and spacious"
    if tone == "quietly resilient":
        return "gentle and steady"
    return "soft and contemplative"


def _opening_tone_for(tone: str) -> str:
    return {
        "joyful": "warm and grateful",
        "penitential": "quiet and honest",
        "solemn": "reverent and attentive",
        "quietly resilient": "gentle and steady",
    }.get(tone, "peaceful and attentive")


def _closing_tone_for(tone: str) -> str:
    return {
        "joyful": "hopeful thanksgiving",
        "penitential": "trusting surrender",
        "solemn": "reverent peace",
        "quietly resilient": "renewed courage",
    }.get(tone, "peaceful trust")


def _saint_name(name: str) -> str:
    match = re.search(r"\bSaints?\s+(.+)", str(name or ""), flags=re.IGNORECASE)
    if not match:
        return ""
    raw = _normalize_whitespace(match.group(0))
    return raw


def _focus_label(source: str, feast: str, gospel_citation: str, season: str) -> str:
    if source in {"feast", "memorial"} and feast:
        return f"the Church's celebration of {feast}"
    if source == "gospel" and gospel_citation:
        return f"today's Gospel, {gospel_citation}"
    if source == "gospel":
        return "today's Gospel"
    if season:
        return f"the {season}"
    return "ordinary life today"


def _summary(theme: str, focus_label: str, season: str) -> str:
    season_clause = f" in {season}" if season else ""
    return f"Today's shared focus is {theme}, received through {focus_label}{season_clause}."


def _humanize_theme(value: str) -> str:
    return " ".join(part.capitalize() for part in _normalize_whitespace(value or "trust").split())


def _slug(value: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", str(value or "").lower())).strip("-") or "trust"


def _join_with_and(items: Sequence[str]) -> str:
    values = [_normalize_whitespace(item) for item in items if _normalize_whitespace(item)]
    if not values:
        return ""
    if len(values) == 1:
        return values[0]
    if len(values) == 2:
        return f"{values[0]} and {values[1]}"
    return f"{', '.join(values[:-1])}, and {values[-1]}"


def _truncate_sentence(value: str, *, limit: int = 220) -> str:
    text = _normalize_whitespace(value)
    if len(text) <= limit:
        return text
    trimmed = text[:limit].rsplit(" ", 1)[0].rstrip(" ,;:")
    return f"{trimmed}."


def _source_row(kind: str, label: str, theme: str = "") -> Dict[str, str]:
    row = {"kind": kind, "label": _normalize_whitespace(label)}
    if theme:
        row["theme"] = _normalize_whitespace(theme)
    return row


def _shared_theme_sources(
    *,
    primary_theme: str,
    gospel_theme: str,
    season: str,
    feast: Optional[Dict[str, str]],
    celebrations: Sequence[Dict[str, str]],
    gospel_citation: str,
) -> List[Dict[str, str]]:
    sources: List[Dict[str, str]] = []
    names = [item.get("name", "") for item in celebrations if item.get("name")]
    if names:
        sources.append(_source_row("calendar", _join_with_and(names), primary_theme))
    elif feast:
        sources.append(_source_row(feast.get("rank", "feast"), feast.get("name", ""), _theme_from_feast(feast.get("name", ""), feast.get("rank", ""))))
    if gospel_theme:
        label = f"today's Gospel, {gospel_citation}" if gospel_citation else "today's Gospel"
        sources.append(_source_row("gospel", label, gospel_theme))
    if season:
        sources.append(_source_row("season", season, _theme_from_season(season)))
    if not sources:
        sources.append(_source_row("fallback", "ordinary life today", primary_theme or "trust"))
    return sources


def _theme_title(primary_theme: str, gospel_theme: str, season: str, feast: Optional[Dict[str, str]]) -> str:
    values = [_normalize_whitespace(primary_theme)]
    for value in (gospel_theme, _theme_from_season(season)):
        cleaned = _normalize_whitespace(value)
        if cleaned and cleaned not in values:
            values.append(cleaned)
    if feast and feast.get("rank") in {"memorial", "optional_memorial"} and "discernment" not in values:
        values.append("discernment")
    if len(values) == 1:
        return _humanize_theme(values[0])
    return _humanize_theme(" and ".join(values[:2]))


def _shared_theme_payload(
    *,
    primary_theme: str,
    gospel_theme: str,
    season: str,
    feast: Optional[Dict[str, str]],
    celebrations: Sequence[Dict[str, str]],
    gospel_citation: str,
    source: str,
) -> Dict[str, Any]:
    title = _theme_title(primary_theme, gospel_theme, season, feast)
    title_lc = title[:1].lower() + title[1:] if title else "trust"
    sources = _shared_theme_sources(
        primary_theme=primary_theme,
        gospel_theme=gospel_theme,
        season=season,
        feast=feast,
        celebrations=celebrations,
        gospel_citation=gospel_citation,
    )
    day_label = sources[0]["label"] if sources else "ordinary life today"
    gospel_clause = ""
    if gospel_theme:
        gospel_label = next((item["label"] for item in sources if item.get("kind") == "gospel"), "today's Gospel")
        gospel_clause = f", while {gospel_label} draws out {gospel_theme}"
    season_clause = f" in {season}" if season else ""
    explanation = _truncate_sentence(
        f"Today's focus is {title_lc}: the Church gives us {day_label}{season_clause}{gospel_clause}, so the whole day can be prayed as one invitation to {primary_theme}."
    )
    transition = _truncate_sentence(
        f"Carrying today's focus of {title_lc}, we place ourselves and the needs of this day before the Lord."
    )
    reflection_focus = _truncate_sentence(
        f"Pray with {title_lc} by holding together {day_label}, the light of the Gospel, and the grace of {season or 'this liturgical day'}."
    )
    if source == "fallback":
        explanation = "Today's focus is Trust: even with limited liturgical data, the Church invites us to receive ordinary life as a place of grace."
        transition = "Carrying today's focus of trust, we place ourselves and the needs of this day before the Lord."
        reflection_focus = "Pray with trust by noticing where God is present in ordinary life today."
    return {
        "title": title,
        "slug": _slug(title),
        "explanation": explanation,
        "transition": transition,
        "reflection_focus": reflection_focus,
        "sources": sources,
    }
