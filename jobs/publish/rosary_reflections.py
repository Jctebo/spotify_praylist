from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from typing import Any, List, Mapping, Optional, Sequence

from openai import OpenAI
from pydantic import BaseModel

from jobs.novena.liturgical_helpers import celebration_name, infer_celebration_rank, romcal_fetch_day
from jobs.publish.daily_intro import OAI_MODEL, _normalize_whitespace, _resolve_openai_settings, fetch_daily_gospel_context


MAJOR_RANKS = frozenset({"solemnity", "feast"})
MEMORIAL_RANKS = frozenset({"memorial", "optional_memorial"})
EASTER_OCTAVE_RANK = "solemnity_easter_octave"
APPROVED_HUMAN_NEED_CATEGORIES = (
    "families",
    "church",
    "conversion",
    "peace",
    "suffering",
    "poor_and_vulnerable",
    "dead",
    "vocations",
    "leaders",
    "personal_needs",
)
INTRO_MIN_CHARS = 120
INTRO_MAX_CHARS = 700
OVERALL_INTENTION_MIN_CHARS = 60
OVERALL_INTENTION_MAX_CHARS = 400
DECADE_INTENTION_MIN_CHARS = 40
DECADE_INTENTION_MAX_CHARS = 280
REFLECTION_MIN_CHARS = 120
REFLECTION_MAX_CHARS = 650
SOURCE_GENERATED_STRUCTURED = "generated_structured"
SOURCE_GENERATED_JSON = "generated_json"
SOURCE_FALLBACK_DETERMINISTIC = "fallback_deterministic"
DEFAULT_TEMPERATURE = 0.65


@dataclass(frozen=True)
class RosaryMystery:
    number: int
    title: str
    fruit: str


@dataclass(frozen=True)
class RosaryPriority:
    key: str
    source: str
    title: str
    prompt_context: str
    anchors: tuple[str, ...]


@dataclass(frozen=True)
class RosaryDayContext:
    date: Any
    mystery_set_title: str
    mysteries: tuple[RosaryMystery, ...]
    season_mode: str
    priorities: tuple[RosaryPriority, ...]
    dominant_priority: RosaryPriority
    focus_source: str
    focus_title: str
    focus_prompt_label: str
    celebration_clause: str
    season_label: str
    feast_names: tuple[str, ...]
    memorial_names: tuple[str, ...]
    gospel_citation: str
    gospel_text: str
    calendar: str
    locale: str
    shared_theme_title: str = ""
    shared_theme_explanation: str = ""
    shared_theme_reflection_focus: str = ""
    shared_theme_transition: str = ""
    shared_gospel_bridge: str = ""
    shared_theme_sources: tuple[dict[str, str], ...] = ()
    shared_theme_version: str = ""


@dataclass(frozen=True)
class RosaryDecadeDevotional:
    number: int
    mystery: RosaryMystery
    human_need_category: str
    intention: str
    reflection: str


@dataclass(frozen=True)
class RosaryDevotionalSet:
    mystery_set_title: str
    mysteries: tuple[RosaryMystery, ...]
    introduction: str
    overall_intention: str
    decades: tuple[RosaryDecadeDevotional, ...]
    source: str
    day_context: RosaryDayContext
    fallback_reason: str = ""

    @property
    def reflections(self) -> tuple[str, ...]:
        return tuple(decade.reflection for decade in self.decades)


# Compatibility aliases for callers that still describe the package as a reflection set.
RosaryReflectionSet = RosaryDevotionalSet


@dataclass(frozen=True)
class RosaryReflectionResult:
    reflections: tuple[str, ...]
    source: str
    fallback_reason: str = ""


class _StructuredRosaryDecade(BaseModel):
    number: int
    human_need_category: str
    intention: str
    reflection: str


class _StructuredRosaryDevotionalResponse(BaseModel):
    dominant_priority_key: str
    introduction: str
    overall_intention: str
    decades: list[_StructuredRosaryDecade]


def parse_rosary_mysteries(text: str) -> tuple[str, tuple[RosaryMystery, ...]]:
    lines = [line.strip() for line in str(text or "").splitlines() if line.strip()]
    if not lines:
        raise RuntimeError("Rosary mystery template is empty.")
    title = lines[0]
    mysteries: List[RosaryMystery] = []
    pattern = re.compile(r"^\s*(\d+)\.\s+(.+?)\s+-\s+(.+?)\s*$")
    for line in lines[1:]:
        match = pattern.match(line)
        if not match:
            continue
        mystery_title = _normalize_whitespace(match.group(2))
        fruit = _normalize_whitespace(match.group(3))
        if mystery_title and fruit:
            mysteries.append(RosaryMystery(number=int(match.group(1)), title=mystery_title, fruit=fruit))
    if len(mysteries) != 5:
        raise RuntimeError(f"Rosary mystery template '{title}' must contain exactly 5 mystery rows, got {len(mysteries)}.")
    if [mystery.number for mystery in mysteries] != list(range(1, 6)):
        raise RuntimeError(f"Rosary mystery template '{title}' must number mysteries 1 through 5 in order.")
    return title, tuple(mysteries)


def build_rosary_day_context(
    date_value,
    mystery_text: str,
    *,
    mysteries: Optional[Sequence[RosaryMystery]] = None,
    mystery_set_title: str = "",
    calendar: Optional[str] = None,
    locale: Optional[str] = None,
    allow_missing_gospel: bool = True,
    season: Optional[str] = None,
    shared_theme: Optional[Mapping[str, Any]] = None,
) -> RosaryDayContext:
    if mysteries is None:
        parsed_title, parsed_mysteries = parse_rosary_mysteries(mystery_text)
    else:
        parsed_title = str(mystery_set_title or "").strip()
        parsed_mysteries = tuple(mysteries)
    effective_calendar = str(calendar or "general_roman").strip() or "general_roman"
    effective_locale = str(locale or "en").strip() or "en"

    daily_context: Any = None
    try:
        daily_context = fetch_daily_gospel_context(
            date_value,
            calendar=effective_calendar,
            locale=effective_locale,
            allow_missing_gospel=allow_missing_gospel,
        )
    except Exception as exc:
        print(f"WARN rosary_devotional gospel_context_unavailable detail={exc}", file=sys.stderr)

    rows: Sequence[Any] = []
    try:
        rows = romcal_fetch_day(effective_calendar, effective_locale, date_value)
    except Exception as exc:
        print(f"WARN rosary_devotional romcal_unavailable detail={exc}", file=sys.stderr)

    shared = dict(shared_theme or {})
    shared_season = shared.get("liturgicalSeason") or shared.get("liturgical_season")
    season_label = _season_label_from_rows(rows) or _season_label(shared_season) or _season_label(season)
    season_mode = _season_mode(season_label)
    major_names, memorial_names = _ranked_celebration_names(rows)
    celebration_clause = _normalize_whitespace(getattr(daily_context, "celebration_clause", ""))
    if not celebration_clause:
        celebration_clause = _join_with_and(_celebration_names(rows))
    gospel_text = str(getattr(daily_context, "gospel_text", "") or "").strip()
    gospel_citation = _normalize_whitespace(getattr(daily_context, "gospel_citation", ""))

    available = _available_priorities(
        season_mode=season_mode,
        season_label=season_label,
        major_names=major_names,
        memorial_names=memorial_names,
        gospel_citation=gospel_citation,
        gospel_text=gospel_text,
    )
    ordered_keys = {
        "ordinary": ("major-celebration", "gospel", "memorial", "ordinary-time", "mystery-fruits"),
        "nonordinary": ("major-celebration", "season", "gospel", "memorial", "mystery-fruits"),
        "unknown": ("major-celebration", "gospel", "memorial", "mystery-fruits"),
    }[season_mode]
    priorities = tuple(available[key] for key in ordered_keys if key in available)
    dominant = priorities[0]

    shared_title = _normalize_whitespace(shared.get("sharedThemeTitle") or shared.get("daily_theme_title"))
    shared_explanation = _normalize_whitespace(shared.get("sharedThemeExplanation") or shared.get("daily_theme_explanation"))
    shared_reflection_focus = _normalize_whitespace(
        shared.get("sharedThemeReflectionFocus") or shared.get("daily_theme_reflection_focus")
    )
    shared_transition = _normalize_whitespace(shared.get("sharedThemeTransition") or shared.get("daily_theme_transition"))
    shared_gospel_bridge = _normalize_whitespace(shared.get("sharedGospelBridge") or shared.get("daily_gospel_bridge"))
    shared_sources = tuple(
        dict(item)
        for item in (shared.get("sharedThemeSources") or shared.get("daily_theme_sources") or ())
        if isinstance(item, dict)
    )
    shared_version = _normalize_whitespace(shared.get("sharedThemeVersion") or shared.get("daily_theme_version"))

    return RosaryDayContext(
        date=date_value,
        mystery_set_title=parsed_title,
        mysteries=tuple(parsed_mysteries),
        season_mode=season_mode,
        priorities=priorities,
        dominant_priority=dominant,
        focus_source=dominant.source,
        focus_title=dominant.title,
        focus_prompt_label=dominant.prompt_context,
        celebration_clause=celebration_clause,
        season_label=season_label,
        feast_names=major_names,
        memorial_names=memorial_names,
        gospel_citation=gospel_citation,
        gospel_text=gospel_text,
        calendar=effective_calendar,
        locale=effective_locale,
        shared_theme_title=shared_title,
        shared_theme_explanation=shared_explanation,
        shared_theme_reflection_focus=shared_reflection_focus,
        shared_theme_transition=shared_transition,
        shared_gospel_bridge=shared_gospel_bridge,
        shared_theme_sources=shared_sources,
        shared_theme_version=shared_version,
    )


def build_rosary_devotional_set(
    date_value,
    mystery_text: str,
    *,
    calendar: Optional[str] = None,
    locale: Optional[str] = None,
    prompt_model: Optional[str] = None,
    temperature: float = DEFAULT_TEMPERATURE,
    allow_missing_gospel: bool = True,
    season: Optional[str] = None,
    day_context: Optional[RosaryDayContext] = None,
    shared_theme: Optional[Mapping[str, Any]] = None,
) -> RosaryDevotionalSet:
    title, mysteries = parse_rosary_mysteries(mystery_text)
    context = day_context or build_rosary_day_context(
        date_value,
        mystery_text,
        calendar=calendar,
        locale=locale,
        allow_missing_gospel=allow_missing_gospel,
        season=season,
        shared_theme=shared_theme,
    )
    context = _ensure_priority_context(context)
    model = str(prompt_model or os.getenv(OAI_MODEL, "") or "gpt-4.1-mini").strip() or "gpt-4.1-mini"
    prompt = _build_devotional_prompt(date_value, context)
    failures: list[str] = []

    try:
        raw = _call_openai_structured(model, prompt, temperature=temperature)
        return _devotional_from_validated(
            validate_rosary_devotional_response(raw, context),
            title=title,
            mysteries=mysteries,
            context=context,
            source=SOURCE_GENERATED_STRUCTURED,
        )
    except Exception as exc:
        failures.append(f"structured: {exc}")
        print(f"WARN rosary_devotional structured_generation_invalid detail={exc}; trying_json", file=sys.stderr)

    try:
        raw = _call_openai_json(model, prompt, temperature=temperature)
        return _devotional_from_validated(
            validate_rosary_devotional_response(raw, context),
            title=title,
            mysteries=mysteries,
            context=context,
            source=SOURCE_GENERATED_JSON,
        )
    except Exception as exc:
        failures.append(f"json: {exc}")
        print(f"WARN rosary_devotional json_generation_invalid detail={exc}; using_atomic_fallback", file=sys.stderr)

    return _deterministic_devotional_set(
        date_value,
        title,
        mysteries,
        context,
        fallback_reason="; ".join(failures),
    )


def build_rosary_reflection_set(date_value, mystery_text: str, **kwargs: Any) -> RosaryDevotionalSet:
    return build_rosary_devotional_set(date_value, mystery_text, **kwargs)


def build_rosary_reflection_result(
    date_value,
    mysteries: Sequence[RosaryMystery],
    *,
    mystery_set_title: str = "Rosary Mysteries",
    day_context: Optional[RosaryDayContext] = None,
    **kwargs: Any,
) -> RosaryReflectionResult:
    mystery_text = _mystery_text(mystery_set_title, mysteries)
    devotional = build_rosary_devotional_set(date_value, mystery_text, day_context=day_context, **kwargs)
    return RosaryReflectionResult(
        reflections=devotional.reflections,
        source=devotional.source,
        fallback_reason=devotional.fallback_reason,
    )


def build_rosary_reflections(
    date_value,
    mysteries: Sequence[RosaryMystery],
    *,
    mystery_set_title: str = "Rosary Mysteries",
    day_context: Optional[RosaryDayContext] = None,
    **kwargs: Any,
) -> tuple[str, ...]:
    return build_rosary_reflection_result(
        date_value,
        mysteries,
        mystery_set_title=mystery_set_title,
        day_context=day_context,
        **kwargs,
    ).reflections


def build_rosary_intro_text(
    date_value,
    mystery_set_title: str,
    mysteries: Sequence[RosaryMystery],
    *,
    day_context: Optional[RosaryDayContext] = None,
    **kwargs: Any,
) -> str:
    mystery_text = _mystery_text(mystery_set_title, mysteries)
    return build_rosary_devotional_set(date_value, mystery_text, day_context=day_context, **kwargs).introduction


def validate_rosary_devotional_response(
    raw: Any,
    context: RosaryDayContext,
) -> _StructuredRosaryDevotionalResponse:
    if isinstance(raw, _StructuredRosaryDevotionalResponse):
        parsed = raw
    else:
        payload = json.loads(raw) if isinstance(raw, str) else raw
        parsed = _StructuredRosaryDevotionalResponse.model_validate(payload)

    if parsed.dominant_priority_key != context.dominant_priority.key:
        raise RuntimeError("Rosary devotional response returned the wrong dominant priority key.")
    if len(parsed.decades) != 5:
        raise RuntimeError(f"Rosary devotional response must contain exactly 5 decades, got {len(parsed.decades)}.")
    if [item.number for item in parsed.decades] != [1, 2, 3, 4, 5]:
        raise RuntimeError("Rosary devotional response must number decades 1 through 5 in order.")

    introduction = _validated_prose("introduction", parsed.introduction, INTRO_MIN_CHARS, INTRO_MAX_CHARS)
    overall = _validated_prose(
        "overall intention",
        parsed.overall_intention,
        OVERALL_INTENTION_MIN_CHARS,
        OVERALL_INTENTION_MAX_CHARS,
    )
    _reject_foreign_scripture_citations(f"{introduction} {overall}", context)
    _require_dominant_anchor(f"{introduction} {overall}", context)

    categories = [item.human_need_category for item in parsed.decades]
    unknown = sorted(set(categories) - set(APPROVED_HUMAN_NEED_CATEGORIES))
    if unknown:
        raise RuntimeError(f"Rosary devotional response used unsupported human-need categories: {', '.join(unknown)}.")
    if len(set(categories)) != 5:
        raise RuntimeError("Rosary devotional response must use five distinct human-need categories.")

    normalized_decades: list[_StructuredRosaryDecade] = []
    for mystery, item in zip(context.mysteries, parsed.decades):
        intention = _validated_prose(
            f"decade {item.number} intention",
            item.intention,
            DECADE_INTENTION_MIN_CHARS,
            DECADE_INTENTION_MAX_CHARS,
        )
        reflection = _validated_prose(
            f"decade {item.number} reflection",
            item.reflection,
            REFLECTION_MIN_CHARS,
            REFLECTION_MAX_CHARS,
        )
        pair = f"{intention} {reflection}"
        _reject_foreign_scripture_citations(pair, context)
        _require_dominant_anchor(pair, context)
        if not _contains_any(pair, (mystery.title, mystery.fruit)):
            raise RuntimeError(f"Rosary decade {item.number} must mention its mystery title or fruit.")
        normalized_decades.append(
            _StructuredRosaryDecade(
                number=item.number,
                human_need_category=item.human_need_category,
                intention=intention,
                reflection=reflection,
            )
        )

    return _StructuredRosaryDevotionalResponse(
        dominant_priority_key=parsed.dominant_priority_key,
        introduction=introduction,
        overall_intention=overall,
        decades=normalized_decades,
    )


def validate_rosary_reflections(raw: Any, mysteries: Sequence[RosaryMystery]) -> tuple[str, ...]:
    if isinstance(raw, str):
        values = raw.splitlines()
    elif isinstance(raw, dict):
        values = raw.get("reflections") or ()
    else:
        values = raw or ()
    cleaned: list[str] = []
    for value in values:
        text = value.get("reflection", "") if isinstance(value, dict) else getattr(value, "reflection", value)
        normalized = re.sub(r"^\s*(?:[-*]|\d+[\).])\s*", "", _normalize_whitespace(text)).strip()
        if normalized:
            cleaned.append(normalized)
    if len(cleaned) != len(mysteries):
        raise RuntimeError(f"Rosary reflection generation must return exactly {len(mysteries)} reflections, got {len(cleaned)}.")
    for index, reflection in enumerate(cleaned, start=1):
        if len(reflection) > REFLECTION_MAX_CHARS:
            raise RuntimeError(f"Rosary reflection {index} is too long.")
    return tuple(cleaned)


def fallback_rosary_reflections(
    mysteries: Sequence[RosaryMystery],
    season: Optional[str] = None,
) -> tuple[str, ...]:
    season_label = _season_label(season) or "the liturgical day"
    return tuple(
        (
            f"{mystery.title} places a saving moment from the life of Jesus and Mary before us. "
            f"Within {season_label}, its fruit of {mystery.fruit.lower()} teaches us to receive grace in ordinary duties. "
            f"May this mystery shape how we listen, choose, and love as we carry its fruit into the needs of this day."
        )
        for mystery in mysteries
    )


def _available_priorities(
    *,
    season_mode: str,
    season_label: str,
    major_names: Sequence[str],
    memorial_names: Sequence[str],
    gospel_citation: str,
    gospel_text: str,
) -> dict[str, RosaryPriority]:
    priorities: dict[str, RosaryPriority] = {}
    if major_names:
        title = _join_with_and(major_names)
        priorities["major-celebration"] = RosaryPriority(
            key="major-celebration",
            source="major",
            title=title,
            prompt_context=f"the solemnity or feast of {title}",
            anchors=tuple(major_names),
        )
    if season_mode == "nonordinary" and season_label:
        priorities["season"] = RosaryPriority(
            key="season",
            source="season",
            title=season_label,
            prompt_context=f"the Church's prayer in {season_label}",
            anchors=(season_label,),
        )
    if gospel_text:
        gospel_title = f"Today's Gospel, {gospel_citation}" if gospel_citation else "Today's Gospel"
        priorities["gospel"] = RosaryPriority(
            key="gospel",
            source="gospel",
            title=gospel_title,
            prompt_context=gospel_title,
            anchors=tuple(value for value in ("today's Gospel", gospel_citation) if value),
        )
    if memorial_names:
        title = _join_with_and(memorial_names)
        priorities["memorial"] = RosaryPriority(
            key="memorial",
            source="memorial",
            title=title,
            prompt_context=f"the memorial of {title}",
            anchors=tuple(memorial_names),
        )
    if season_mode == "ordinary":
        priorities["ordinary-time"] = RosaryPriority(
            key="ordinary-time",
            source="ordinary",
            title="Ordinary Time",
            prompt_context="the steady discipleship of Ordinary Time",
            anchors=("Ordinary Time",),
        )
    priorities["mystery-fruits"] = RosaryPriority(
        key="mystery-fruits",
        source="fruit",
        title="Mystery Fruits",
        prompt_context="the fruit of each mystery",
        anchors=("mystery", "fruit"),
    )
    return priorities


def _ensure_priority_context(context: Any) -> RosaryDayContext:
    """Upgrade older test/provider context objects to the typed priority contract."""
    if getattr(context, "dominant_priority", None) is not None and getattr(context, "priorities", None):
        return context
    source = str(getattr(context, "focus_source", "") or "").strip().lower()
    title = str(getattr(context, "focus_title", "") or "").strip() or "Mystery Fruits"
    prompt_context = str(getattr(context, "focus_prompt_label", "") or "").strip() or title
    key_by_source = {
        "feast": "major-celebration",
        "major": "major-celebration",
        "gospel": "gospel",
        "memorial": "memorial",
        "season": "season",
        "ordinary": "ordinary-time",
        "fruit": "mystery-fruits",
    }
    key = key_by_source.get(source, "mystery-fruits")
    anchors = tuple(
        value
        for value in (
            title,
            getattr(context, "gospel_citation", "") if key == "gospel" else "",
            "mystery" if key == "mystery-fruits" else "",
        )
        if str(value or "").strip()
    )
    dominant = RosaryPriority(
        key=key,
        source="major" if source == "feast" else source or "fruit",
        title=title,
        prompt_context=prompt_context,
        anchors=anchors,
    )
    season_label = str(getattr(context, "season_label", "") or "").strip()
    return RosaryDayContext(
        date=getattr(context, "date", None),
        mystery_set_title=str(getattr(context, "mystery_set_title", "") or "").strip(),
        mysteries=tuple(getattr(context, "mysteries", ()) or ()),
        season_mode=_season_mode(season_label),
        priorities=(dominant,),
        dominant_priority=dominant,
        focus_source=dominant.source,
        focus_title=dominant.title,
        focus_prompt_label=dominant.prompt_context,
        celebration_clause=str(getattr(context, "celebration_clause", "") or "").strip(),
        season_label=season_label,
        feast_names=tuple(getattr(context, "feast_names", ()) or ()),
        memorial_names=tuple(getattr(context, "memorial_names", ()) or ()),
        gospel_citation=str(getattr(context, "gospel_citation", "") or "").strip(),
        gospel_text=str(getattr(context, "gospel_text", "") or "").strip(),
        calendar=str(getattr(context, "calendar", "general_roman") or "general_roman"),
        locale=str(getattr(context, "locale", "en") or "en"),
        shared_theme_title=str(getattr(context, "shared_theme_title", "") or "").strip(),
        shared_theme_explanation=str(getattr(context, "shared_theme_explanation", "") or "").strip(),
        shared_theme_reflection_focus=str(
            getattr(context, "shared_theme_reflection_focus", "") or ""
        ).strip(),
        shared_theme_transition=str(getattr(context, "shared_theme_transition", "") or "").strip(),
        shared_gospel_bridge=str(getattr(context, "shared_gospel_bridge", "") or "").strip(),
        shared_theme_sources=tuple(getattr(context, "shared_theme_sources", ()) or ()),
        shared_theme_version=str(getattr(context, "shared_theme_version", "") or "").strip(),
    )


def _ranked_celebration_names(rows: Sequence[Any]) -> tuple[tuple[str, ...], tuple[str, ...]]:
    major: list[str] = []
    memorial: list[str] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        rank = _normalized_rank(infer_celebration_rank(row))
        name = _normalize_whitespace(celebration_name(row))
        if not name or name.lower() in seen:
            continue
        target = major if rank in MAJOR_RANKS else memorial if rank in MEMORIAL_RANKS else None
        if target is None or rank == EASTER_OCTAVE_RANK:
            continue
        seen.add(name.lower())
        target.append(name)
    return tuple(major), tuple(memorial)


def _normalized_rank(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower()).strip("_")


def _celebration_names(rows: Sequence[Any]) -> tuple[str, ...]:
    names: list[str] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = _normalize_whitespace(celebration_name(row))
        if name and name.lower() not in seen:
            seen.add(name.lower())
            names.append(name)
    return tuple(names)


def _season_label_from_rows(rows: Sequence[Any]) -> str:
    for row in rows:
        if not isinstance(row, dict):
            continue
        label = _season_label(row.get("season") or row.get("season_name"))
        if label:
            return label
    return ""


def _season_label(value: Any) -> str:
    raw_value = getattr(value, "value", value)
    raw = str(raw_value or "").strip()
    if raw.startswith("Season."):
        raw = raw.split(".", 1)[1]
    normalized = re.sub(r"[_-]+", " ", raw).strip().lower()
    aliases = {
        "ordinary": "Ordinary Time",
        "ordinary time": "Ordinary Time",
        "advent": "Advent",
        "advent season": "Advent",
        "christmas": "Christmas season",
        "christmas time": "Christmas season",
        "christmas season": "Christmas season",
        "christmastide": "Christmas season",
        "lent": "Lent",
        "lenten season": "Lent",
        "holy week": "Holy Week",
        "easter": "Easter season",
        "easter time": "Easter season",
        "easter season": "Easter season",
    }
    if normalized in aliases:
        return aliases[normalized]
    return normalized.title() if normalized else ""


def _season_mode(season_label: str) -> str:
    if season_label == "Ordinary Time":
        return "ordinary"
    return "nonordinary" if season_label else "unknown"


def _build_devotional_prompt(date_value, context: RosaryDayContext) -> str:
    priority_lines = "\n".join(
        f"{index}. key={priority.key}; source={priority.source}; title={priority.title}; context={priority.prompt_context}"
        for index, priority in enumerate(context.priorities, start=1)
    )
    mystery_lines = "\n".join(
        f"{mystery.number}. {mystery.title} - fruit: {mystery.fruit}" for mystery in context.mysteries
    )
    categories = ", ".join(APPROVED_HUMAN_NEED_CATEGORIES)
    supporting = "\n".join(
        line
        for line in (
            f"Shared daily theme: {context.shared_theme_title}" if context.shared_theme_title else "",
            f"Shared explanation: {context.shared_theme_explanation}" if context.shared_theme_explanation else "",
            f"Gospel bridge: {context.shared_gospel_bridge}" if context.shared_gospel_bridge else "",
        )
        if line
    )
    return f"""
Create one coherent Catholic Rosary devotional package for {date_value.isoformat()}.

The dominant priority is {context.dominant_priority.key}: {context.dominant_priority.prompt_context}.
It must shape the introduction, overall intention, and all five decade intention/reflection pairs.
Lower priorities may support it naturally but must never displace it.
Use varied, prayerful language. Do not force a sentence count or a stock opening phrase.
Write the introduction in 2-4 sentences.
Use only the supplied liturgical facts. Do not invent biographies, events, quotations, citations, or Gospel details.
Return plain prose inside the JSON fields, with no markdown, headings, or production commentary.

Ordered priorities:
{priority_lines}

Liturgical day: {context.celebration_clause or "not supplied"}
Season: {context.season_label or "not supplied"}
Gospel citation: {context.gospel_citation or "not supplied"}
Gospel text:
{context.gospel_text or "not supplied"}
{supporting}

Mysteries:
{mystery_lines}

Requirements:
- dominant_priority_key must be exactly "{context.dominant_priority.key}".
- introduction: {INTRO_MIN_CHARS}-{INTRO_MAX_CHARS} characters and natural spoken welcome.
- overall_intention: {OVERALL_INTENTION_MIN_CHARS}-{OVERALL_INTENTION_MAX_CHARS} characters.
- exactly five numbered decades in order.
- each decade uses one distinct human_need_category from: {categories}.
- each intention is {DECADE_INTENTION_MIN_CHARS}-{DECADE_INTENTION_MAX_CHARS} characters.
- each reflection is {REFLECTION_MIN_CHARS}-{REFLECTION_MAX_CHARS} characters.
- every decade pair applies the same dominant priority through that decade's mystery or fruit.
""".strip()


def _call_openai_structured(model: str, prompt: str, *, temperature: float) -> Any:
    api_key, base_url, resolved_model = _resolve_openai_settings(model=model)
    if not api_key:
        raise RuntimeError("Missing OpenAI API key for Rosary devotional generation.")
    client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))
    response = client.responses.parse(
        model=resolved_model or model,
        temperature=temperature,
        input=[
            {
                "role": "system",
                "content": [{"type": "input_text", "text": "Return the requested Rosary package using the supplied schema."}],
            },
            {"role": "user", "content": [{"type": "input_text", "text": prompt}]},
        ],
        text_format=_StructuredRosaryDevotionalResponse,
    )
    parsed = getattr(response, "output_parsed", None)
    if parsed is not None:
        return parsed
    refusal = _response_refusal(response)
    if refusal:
        raise RuntimeError(f"Rosary devotional generation was refused: {refusal}")
    raise RuntimeError("Rosary devotional structured generation returned no parsed output.")


def _call_openai_json(model: str, prompt: str, *, temperature: float) -> str:
    api_key, base_url, resolved_model = _resolve_openai_settings(model=model)
    if not api_key:
        raise RuntimeError("Missing OpenAI API key for Rosary devotional generation.")
    client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))
    response = client.responses.create(
        model=resolved_model or model,
        temperature=temperature,
        input=[
            {
                "role": "system",
                "content": [{
                    "type": "input_text",
                    "text": (
                        "Return one JSON object only with keys dominant_priority_key, introduction, "
                        "overall_intention, and decades. Each decade has number, human_need_category, "
                        "intention, and reflection. No markdown."
                    ),
                }],
            },
            {"role": "user", "content": [{"type": "input_text", "text": prompt}]},
        ],
    )
    text = str(getattr(response, "output_text", "") or "").strip()
    if not text:
        refusal = _response_refusal(response)
        if refusal:
            raise RuntimeError(f"Rosary devotional generation was refused: {refusal}")
        raise RuntimeError("Rosary devotional JSON generation returned empty text.")
    return text


def _response_refusal(response: Any) -> str:
    for item in getattr(response, "output", ()) or ():
        for content in getattr(item, "content", ()) or ():
            if getattr(content, "type", "") == "refusal":
                return _normalize_whitespace(getattr(content, "refusal", "") or getattr(content, "text", ""))
    return ""


def _devotional_from_validated(
    parsed: _StructuredRosaryDevotionalResponse,
    *,
    title: str,
    mysteries: Sequence[RosaryMystery],
    context: RosaryDayContext,
    source: str,
    fallback_reason: str = "",
) -> RosaryDevotionalSet:
    decades = tuple(
        RosaryDecadeDevotional(
            number=item.number,
            mystery=mystery,
            human_need_category=item.human_need_category,
            intention=item.intention,
            reflection=item.reflection,
        )
        for mystery, item in zip(mysteries, parsed.decades)
    )
    return RosaryDevotionalSet(
        mystery_set_title=title,
        mysteries=tuple(mysteries),
        introduction=parsed.introduction,
        overall_intention=parsed.overall_intention,
        decades=decades,
        source=source,
        day_context=context,
        fallback_reason=fallback_reason,
    )


def _deterministic_devotional_set(
    date_value,
    title: str,
    mysteries: Sequence[RosaryMystery],
    context: RosaryDayContext,
    *,
    fallback_reason: str,
) -> RosaryDevotionalSet:
    anchor = context.dominant_priority.anchors[0]
    date_display = date_value.strftime("%A, %B %d, %Y").replace(" 0", " ")
    introduction = (
        f"On {date_display}, we bring the {title} into {anchor}. "
        f"Each mystery gives us a different way to receive this grace, while the whole Rosary remains centered on one prayerful focus. "
        "With Mary, let us listen for Christ and carry the needs of the Church and the world before him."
    )
    overall = (
        f"We offer this Rosary for the grace revealed through {anchor}, asking that it renew our faith "
        "and guide the intentions we place before the Lord in every decade."
    )
    categories = APPROVED_HUMAN_NEED_CATEGORIES[:5]
    applications = (
        "families seeking patience and faithful love",
        "the Church in her mission of prayer and service",
        "hearts in need of conversion and reconciliation",
        "all who long for peace amid fear or division",
        "those carrying illness, grief, or hidden suffering",
    )
    decades: list[_StructuredRosaryDecade] = []
    for mystery, category, application in zip(mysteries, categories, applications):
        intention = (
            f"Through {anchor}, we pray this decade for {application}, that the fruit of "
            f"{mystery.fruit.lower()} may strengthen them."
        )
        reflection = (
            f"In {mystery.title}, we contemplate Christ's grace through {anchor}. "
            f"The fruit of {mystery.fruit.lower()} shows how this same focus can enter concrete choices, relationships, and burdens. "
            "As the decade unfolds, may this mystery teach us to receive that grace and offer it for the needs entrusted to our prayer."
        )
        decades.append(
            _StructuredRosaryDecade(
                number=mystery.number,
                human_need_category=category,
                intention=intention,
                reflection=reflection,
            )
        )
    parsed = validate_rosary_devotional_response(
        _StructuredRosaryDevotionalResponse(
            dominant_priority_key=context.dominant_priority.key,
            introduction=introduction,
            overall_intention=overall,
            decades=decades,
        ),
        context,
    )
    return _devotional_from_validated(
        parsed,
        title=title,
        mysteries=mysteries,
        context=context,
        source=SOURCE_FALLBACK_DETERMINISTIC,
        fallback_reason=fallback_reason,
    )


def _validated_prose(label: str, value: Any, minimum: int, maximum: int) -> str:
    text = _normalize_whitespace(value)
    if len(text) < minimum:
        raise RuntimeError(f"Rosary {label} is too short.")
    if len(text) > maximum:
        raise RuntimeError(f"Rosary {label} is too long.")
    if re.search(r"(^|\s)(?:```|#{1,6}\s|\*\*|[*-]\s)", text):
        raise RuntimeError(f"Rosary {label} must not contain markdown.")
    prompt_echoes = ("dominant_priority_key", "human_need_category", "requirements:", "return json")
    if any(echo in text.lower() for echo in prompt_echoes):
        raise RuntimeError(f"Rosary {label} contains prompt or schema commentary.")
    return text


def _require_dominant_anchor(text: str, context: RosaryDayContext) -> None:
    if not _contains_any(text, context.dominant_priority.anchors):
        raise RuntimeError(
            f"Rosary devotional prose must anchor the dominant priority '{context.dominant_priority.key}'."
        )


def _reject_foreign_scripture_citations(text: str, context: RosaryDayContext) -> None:
    citations = re.findall(r"\b(?:[1-3]\s*)?[A-Z][a-z]+\s+\d{1,3}:\d{1,3}(?:-\d{1,3})?\b", text)
    if not citations:
        return
    allowed = _normalize_for_match(context.gospel_citation)
    for citation in citations:
        if not allowed or _normalize_for_match(citation) not in allowed:
            raise RuntimeError(f"Rosary devotional prose introduced an unsupported Scripture citation: {citation}.")


def _contains_any(text: str, values: Sequence[str]) -> bool:
    normalized = _normalize_for_match(text)
    return any(_normalize_for_match(value) in normalized for value in values if _normalize_for_match(value))


def _normalize_for_match(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _join_with_and(items: Sequence[str]) -> str:
    cleaned = [str(item or "").strip() for item in items if str(item or "").strip()]
    if not cleaned:
        return ""
    if len(cleaned) == 1:
        return cleaned[0]
    if len(cleaned) == 2:
        return f"{cleaned[0]} and {cleaned[1]}"
    return ", ".join(cleaned[:-1]) + f", and {cleaned[-1]}"


def _mystery_text(title: str, mysteries: Sequence[RosaryMystery]) -> str:
    rows = "\n".join(f"{item.number}. {item.title} - {item.fruit}" for item in mysteries)
    return f"{title}\n{rows}\n"
