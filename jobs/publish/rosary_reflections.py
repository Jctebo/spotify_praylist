from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass
from typing import Any, List, Optional, Sequence

from openai import OpenAI
from pydantic import BaseModel

from jobs.novena.liturgical_helpers import celebration_name, infer_celebration_rank, romcal_fetch_day
from jobs.publish.daily_intro import OAI_MODEL, _normalize_whitespace, _resolve_openai_settings, fetch_daily_gospel_context


MAX_REFLECTION_CHARS = 650
FEAST_RANKS = frozenset({"solemnity", "feast", "memorial", "optional_memorial"})
SOURCE_GENERATED_FEAST = "generated_feast"
SOURCE_GENERATED_GOSPEL = "generated_gospel"
SOURCE_GENERATED_SEASON = "generated_season"
SOURCE_FALLBACK_FEAST = "fallback_feast"
SOURCE_FALLBACK_GENERIC = "fallback_generic"


@dataclass(frozen=True)
class RosaryMystery:
    number: int
    title: str
    fruit: str


@dataclass(frozen=True)
class RosaryReflectionSet:
    mystery_set_title: str
    mysteries: tuple[RosaryMystery, ...]
    reflections: tuple[str, ...]
    source: str
    day_context: "RosaryDayContext"
    fallback_reason: str = ""


@dataclass(frozen=True)
class RosaryReflectionResult:
    reflections: tuple[str, ...]
    source: str
    fallback_reason: str = ""


@dataclass(frozen=True)
class RosaryDayContext:
    date: Any
    mystery_set_title: str
    mysteries: tuple[RosaryMystery, ...]
    focus_source: str
    focus_title: str
    focus_prompt_label: str
    celebration_clause: str
    season_label: str
    feast_names: tuple[str, ...]
    gospel_citation: str
    gospel_text: str
    calendar: str
    locale: str


class _StructuredRosaryReflection(BaseModel):
    number: int
    reflection: str


class _StructuredRosaryReflectionResponse(BaseModel):
    reflections: list[_StructuredRosaryReflection]


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
        number = int(match.group(1))
        mystery_title = _normalize_whitespace(match.group(2))
        fruit = _normalize_whitespace(match.group(3))
        if mystery_title and fruit:
            mysteries.append(RosaryMystery(number=number, title=mystery_title, fruit=fruit))
    if len(mysteries) != 5:
        raise RuntimeError(f"Rosary mystery template '{title}' must contain exactly 5 mystery rows, got {len(mysteries)}.")
    expected = list(range(1, 6))
    actual = [mystery.number for mystery in mysteries]
    if actual != expected:
        raise RuntimeError(f"Rosary mystery template '{title}' must number mysteries 1 through 5 in order.")
    return title, tuple(mysteries)


def fallback_rosary_reflections(mysteries: Sequence[RosaryMystery], season: Optional[str] = None) -> tuple[str, ...]:
    season_label = _season_label(season)
    normalized_season = season_label.strip().lower()
    reflections = []
    for mystery in mysteries:
        fruit = mystery.fruit.lower()
        if normalized_season == "easter season":
            reflection = (
                f"{mystery.title} shows the light of the risen Christ breaking into ordinary fear and waiting. "
                f"In this Easter season, the mystery of {mystery.title} teaches us to recognize hope where God is already at work. "
                f"The fruit of this mystery is {fruit}, the grace that lets the heart answer God with trust. "
                f"As we pray {mystery.title}, we ask for {fruit} to take root in this decade and in our day."
            )
        else:
            reflection = (
                f"{mystery.title} places before us a concrete moment in the life of Jesus and Mary. "
                f"In {season_label}, the mystery of {mystery.title} teaches us to meet grace in the steady duties of the day. "
                f"The fruit of this mystery is {fruit}, the grace that shapes how we listen, choose, and love. "
                f"As we pray {mystery.title}, we ask for {fruit} to become visible in this decade and in our daily life."
            )
        reflections.append(reflection)
    return tuple(reflections)


def fallback_feast_rosary_reflections(mysteries: Sequence[RosaryMystery], focus: RosaryDayContext) -> tuple[str, ...]:
    feast_label = focus.focus_prompt_label or "today's feast"
    season_label = focus.season_label or "the liturgical season"
    reflections = []
    for mystery in mysteries:
        fruit = mystery.fruit.lower()
        reflection = (
            f"{mystery.title} draws this decade into {feast_label}. "
            f"As the Church keeps this celebration in {season_label}, the mystery of {mystery.title} teaches us to receive the day through Christ. "
            f"The fruit of this mystery is {fruit}, the grace that lets this feast shape how we listen, choose, and love. "
            f"As we pray {mystery.title}, we ask for {fruit} to become visible in this decade and in our life today."
        )
        reflections.append(reflection)
    return tuple(reflections)


def validate_rosary_reflections(raw: Any, mysteries: Sequence[RosaryMystery]) -> tuple[str, ...]:
    if isinstance(raw, _StructuredRosaryReflectionResponse):
        lines = [_normalize_reflection_line(item.reflection) for item in raw.reflections]
    elif isinstance(raw, dict) and isinstance(raw.get("reflections"), list):
        lines = [_normalize_reflection_line(_reflection_text_from_item(item)) for item in raw.get("reflections") or []]
    elif isinstance(raw, str):
        lines = [_normalize_reflection_line(line) for line in raw.splitlines()]
    else:
        lines = [_normalize_reflection_line(_reflection_text_from_item(line)) for line in list(raw or [])]
    cleaned = [line for line in lines if line]
    if len(cleaned) != len(mysteries):
        raise RuntimeError(f"Rosary reflection generation must return exactly {len(mysteries)} reflections, got {len(cleaned)}.")
    for index, reflection in enumerate(cleaned, start=1):
        if len(reflection) > MAX_REFLECTION_CHARS:
            raise RuntimeError(f"Rosary reflection {index} is too long.")
    return tuple(cleaned)


def build_rosary_reflection_result(
    date_value,
    mysteries: Sequence[RosaryMystery],
    *,
    calendar: Optional[str] = None,
    locale: Optional[str] = None,
    prompt_model: Optional[str] = None,
    allow_missing_gospel: bool = True,
    season: Optional[str] = None,
    day_context: Optional[RosaryDayContext] = None,
) -> RosaryReflectionResult:
    model = str(prompt_model or os.getenv(OAI_MODEL, "") or "gpt-4.1-mini").strip() or "gpt-4.1-mini"
    context = day_context or build_rosary_day_context(
        date_value,
        "",
        mysteries=mysteries,
        calendar=calendar,
        locale=locale,
        allow_missing_gospel=allow_missing_gospel,
        season=season,
    )

    if context.focus_source == "feast":
        prompt = _build_feast_prompt(date_value, context, mysteries)
        try:
            rendered = _call_openai_reflections(model, prompt)
            return RosaryReflectionResult(
                reflections=validate_rosary_reflections(rendered, mysteries),
                source=SOURCE_GENERATED_FEAST,
            )
        except Exception as exc:
            print(f"WARN rosary_reflections feast_generation_invalid detail={exc}; using feast_fallback", file=sys.stderr)
            return RosaryReflectionResult(
                reflections=validate_rosary_reflections(fallback_feast_rosary_reflections(mysteries, context), mysteries),
                source=SOURCE_FALLBACK_FEAST,
                fallback_reason=str(exc),
            )

    if not str(context.gospel_text or "").strip():
        print("INFO rosary_reflections missing_gospel_text; trying season_only_generation", file=sys.stderr)
        return _build_seasonal_or_generic_reflection_result(date_value, mysteries, model=model, season=context.season_label or season)

    prompt = _build_prompt_from_day_context(date_value, context, mysteries)
    try:
        rendered = _call_openai_reflections(model, prompt)
        return RosaryReflectionResult(
            reflections=validate_rosary_reflections(rendered, mysteries),
            source=SOURCE_GENERATED_GOSPEL,
        )
    except Exception as exc:
        print(f"WARN rosary_reflections gospel_generation_invalid detail={exc}; trying season_only_generation", file=sys.stderr)
        return _build_seasonal_or_generic_reflection_result(
            date_value,
            mysteries,
            model=model,
            season=context.season_label or season,
            fallback_reason=str(exc),
        )


def build_rosary_reflections(
    date_value,
    mysteries: Sequence[RosaryMystery],
    *,
    calendar: Optional[str] = None,
    locale: Optional[str] = None,
    prompt_model: Optional[str] = None,
    allow_missing_gospel: bool = True,
    season: Optional[str] = None,
    day_context: Optional[RosaryDayContext] = None,
) -> tuple[str, ...]:
    return build_rosary_reflection_result(
        date_value,
        mysteries=mysteries,
        calendar=calendar,
        locale=locale,
        prompt_model=prompt_model,
        allow_missing_gospel=allow_missing_gospel,
        season=season,
        day_context=day_context,
    ).reflections


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
        print(f"WARN rosary_reflections gospel_context_unavailable detail={exc}", file=sys.stderr)
    rows: Sequence[Any] = []
    try:
        rows = romcal_fetch_day(effective_calendar, effective_locale, date_value)
    except Exception as exc:
        print(f"WARN rosary_focus romcal_unavailable detail={exc}", file=sys.stderr)

    feast_names = _feast_names(rows)
    season_label = _season_label_from_rows(rows) or (_season_label(season) if str(season or "").strip() else "")
    celebration_clause = _normalize_whitespace(getattr(daily_context, "celebration_clause", ""))
    if not celebration_clause:
        celebration_clause = _join_with_and(_celebration_names(rows))
    gospel_text = str(getattr(daily_context, "gospel_text", "") or "").strip()
    gospel_citation = _normalize_whitespace(getattr(daily_context, "gospel_citation", ""))

    if feast_names:
        focus_source = "feast"
        focus_title = ", ".join(feast_names)
        focus_prompt_label = f"the feast of {_join_with_and(feast_names)}"
    elif gospel_text:
        focus_source = "gospel"
        focus_title = "Today's Gospel"
        focus_prompt_label = "today's Gospel"
        if gospel_citation:
            focus_prompt_label = f"today's Gospel, {gospel_citation}"
    elif season_label:
        focus_source = "season"
        focus_title = season_label
        focus_prompt_label = f"the {season_label}"
    else:
        focus_source = "fruit"
        focus_title = "Mystery Fruits"
        focus_prompt_label = "the fruit of each mystery"

    return RosaryDayContext(
        date=date_value,
        mystery_set_title=parsed_title,
        mysteries=tuple(parsed_mysteries),
        focus_source=focus_source,
        focus_title=focus_title,
        focus_prompt_label=focus_prompt_label,
        celebration_clause=celebration_clause,
        season_label=season_label,
        feast_names=tuple(feast_names),
        gospel_citation=gospel_citation,
        gospel_text=gospel_text,
        calendar=effective_calendar,
        locale=effective_locale,
    )


def build_rosary_reflection_set(
    date_value,
    mystery_text: str,
    *,
    calendar: Optional[str] = None,
    locale: Optional[str] = None,
    prompt_model: Optional[str] = None,
    allow_missing_gospel: bool = True,
    season: Optional[str] = None,
    day_context: Optional[RosaryDayContext] = None,
) -> RosaryReflectionSet:
    title, mysteries = parse_rosary_mysteries(mystery_text)
    day_context = day_context or build_rosary_day_context(
        date_value,
        mystery_text,
        calendar=calendar,
        locale=locale,
        allow_missing_gospel=allow_missing_gospel,
        season=season,
    )
    result = build_rosary_reflection_result(
        date_value,
        mysteries,
        calendar=calendar,
        locale=locale,
        prompt_model=prompt_model,
        allow_missing_gospel=allow_missing_gospel,
        season=season,
        day_context=day_context,
    )
    return RosaryReflectionSet(
        mystery_set_title=title,
        mysteries=mysteries,
        reflections=result.reflections,
        source=result.source,
        day_context=day_context,
        fallback_reason=result.fallback_reason,
    )


def build_rosary_intro_text(
    date_value,
    mystery_set_title: str,
    mysteries: Sequence[RosaryMystery],
    *,
    calendar: Optional[str] = None,
    locale: Optional[str] = None,
    prompt_model: Optional[str] = None,
    allow_missing_gospel: bool = True,
    season: Optional[str] = None,
    day_context: Optional[RosaryDayContext] = None,
) -> str:
    model = str(prompt_model or os.getenv(OAI_MODEL, "") or "gpt-4.1-mini").strip() or "gpt-4.1-mini"
    try:
        context = day_context or build_rosary_day_context(
            date_value,
            "",
            mystery_set_title=mystery_set_title,
            mysteries=mysteries,
            calendar=calendar,
            locale=locale,
            allow_missing_gospel=allow_missing_gospel,
            season=season,
        )
    except Exception as exc:
        print(f"WARN rosary_intro context_unavailable detail={exc}; using fruit_focus", file=sys.stderr)
        context = RosaryDayContext(
            date=date_value,
            mystery_set_title=mystery_set_title,
            mysteries=tuple(mysteries),
            calendar=str(calendar or "general_roman").strip() or "general_roman",
            locale=str(locale or "en").strip() or "en",
            celebration_clause="the liturgical day",
            season_label=_season_label(season),
            focus_source="fruit",
            focus_title="Mystery Fruits",
            focus_prompt_label="the fruit of each mystery",
            feast_names=(),
            gospel_citation="",
            gospel_text="",
        )
    prompt = _build_intro_prompt(date_value, mystery_set_title, mysteries, context)
    try:
        rendered = _call_openai_text(
            model,
            prompt,
            system="Return plain text only. Exactly three or four sentences. No markdown, no bullets, no commentary.",
            temperature=0.3,
        )
        return _validate_rosary_intro(rendered)
    except Exception as exc:
        print(f"WARN rosary_intro using_deterministic_fallback detail={exc}", file=sys.stderr)
        return _deterministic_rosary_intro(date_value, mystery_set_title, context)


def _normalize_reflection_line(value: Any) -> str:
    line = _normalize_whitespace(value)
    line = re.sub(r"^\s*(?:[-*]|\d+[\).])\s*", "", line).strip()
    return line


def _reflection_text_from_item(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("reflection") or value.get("text") or value.get("value") or "").strip()
    return str(getattr(value, "reflection", value) or "").strip()


def _join_with_and(items: Sequence[str]) -> str:
    cleaned = [str(item or "").strip() for item in items if str(item or "").strip()]
    if not cleaned:
        return ""
    if len(cleaned) == 1:
        return cleaned[0]
    if len(cleaned) == 2:
        return f"{cleaned[0]} and {cleaned[1]}"
    return ", ".join(cleaned[:-1]) + f", and {cleaned[-1]}"


def _feast_names(rows: Sequence[Any]) -> tuple[str, ...]:
    names: List[str] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        rank = infer_celebration_rank(row).strip().lower().replace("-", "_").replace(" ", "_")
        if rank not in FEAST_RANKS:
            continue
        name = _normalize_whitespace(celebration_name(row))
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        names.append(name)
    return tuple(names)


def _celebration_names(rows: Sequence[Any]) -> tuple[str, ...]:
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
    return tuple(names)


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
    if text.lower() == "easter time":
        return "Easter season"
    return text.title()


def _season_label(season: Optional[str]) -> str:
    raw = str(season or "").strip()
    normalized = raw.lower().replace("_", " ").replace("-", " ")
    if normalized in {"easter", "easter season", "easter time"}:
        return "Easter season"
    if normalized in {"ordinary", "ordinary time"}:
        return "Ordinary Time"
    if normalized in {"advent", "advent season"}:
        return "Advent"
    if normalized in {"christmas", "christmas season", "christmastide"}:
        return "Christmas season"
    if normalized in {"lent", "lenten season"}:
        return "Lent"
    if raw:
        return raw[0].upper() + raw[1:]
    return "Ordinary Time"


def _reflection_style_rules() -> str:
    return f"""
Each line must:
- Stay under {MAX_REFLECTION_CHARS} characters.
- Be one paragraph of 4 sentences.
- Describe what the mystery is in 1-2 sentences.
- Describe the fruit of the mystery in 1 sentence.
- Repeat the mystery title and the fruit naturally at least once in the reflection.
- Be reverent, warm, and suitable for spoken prayer.
- Return plain text only, with one reflection per line and no numbering.
""".strip()


def _build_prompt(date_value, context: Any, mysteries: Sequence[RosaryMystery]) -> str:
    mystery_lines = "\n".join(f"{mystery.number}. {mystery.title} - {mystery.fruit}" for mystery in mysteries)
    return f"""
Write exactly five Catholic Rosary decade reflections, one line per mystery.

{_reflection_style_rules()}

Additional Gospel rule:
- Connect the listed mystery and fruit to today's Gospel.
- Avoid adding details not present in the Gospel text.

Date: {date_value.isoformat()}
Liturgical context: {getattr(context, "celebration_clause", "")}
Gospel citation: {getattr(context, "gospel_citation", "")}
Mysteries:
{mystery_lines}

Gospel text:
{getattr(context, "gospel_text", "")}
""".strip()


def _build_prompt_from_day_context(date_value, context: RosaryDayContext, mysteries: Sequence[RosaryMystery]) -> str:
    mystery_lines = "\n".join(f"{mystery.number}. {mystery.title} - {mystery.fruit}" for mystery in mysteries)
    return f"""
Write exactly five Catholic Rosary decade reflections, one line per mystery.

{_reflection_style_rules()}

Additional Gospel rule:
- Connect the listed mystery and fruit to {context.focus_prompt_label}.
- Avoid adding details not present in the Gospel text.

Date: {date_value.isoformat()}
Liturgical context: {context.celebration_clause}
Gospel citation: {context.gospel_citation}
Mysteries:
{mystery_lines}

Gospel text:
{context.gospel_text}
""".strip()


def _build_feast_prompt(date_value, focus: RosaryDayContext, mysteries: Sequence[RosaryMystery]) -> str:
    mystery_lines = "\n".join(f"{mystery.number}. {mystery.title} - {mystery.fruit}" for mystery in mysteries)
    return f"""
Write exactly five Catholic Rosary decade reflections, one line per mystery.

{_reflection_style_rules()}

Additional feast day rule:
- Today's highest priority focus is {focus.focus_prompt_label}; orient every reflection toward that celebration before using Gospel or seasonal themes.
- Do not invent biographical details about saints or feasts.

Date: {date_value.isoformat()}
Liturgical context: {focus.celebration_clause}
Liturgical season: {focus.season_label}
Gospel citation: {focus.gospel_citation}
Mysteries:
{mystery_lines}

Gospel text, if useful:
{focus.gospel_text}
""".strip()


def _build_intro_prompt(
    date_value,
    mystery_set_title: str,
    mysteries: Sequence[RosaryMystery],
    focus: RosaryDayContext,
) -> str:
    mystery_lines = "\n".join(f"{mystery.number}. {mystery.title} - {mystery.fruit}" for mystery in mysteries)
    return f"""
Write a three to four sentence introduction for a Catholic Rosary podcast.

Rules:
- Sentence 1 must announce the calendar day and liturgical season.
- Sentence 2 must begin with "For today's rosary, we will focus on" and name this focus exactly: {focus.focus_prompt_label}.
- Mention {mystery_set_title} naturally once.
- Keep the tone reverent and suitable for spoken prayer.
- Do not use markdown, bullets, or numbering.

Date: {date_value.isoformat()}
Liturgical day: {focus.celebration_clause or "the liturgical day"}
Liturgical season: {focus.season_label or "the liturgical season"}
Focus source: {focus.focus_source}
Mysteries:
{mystery_lines}
""".strip()


def _validate_rosary_intro(text: str) -> str:
    cleaned = _normalize_whitespace(text)
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", cleaned) if part.strip()]
    if len(sentences) not in {3, 4}:
        raise RuntimeError(f"Rosary intro must contain 3 or 4 sentences, got {len(sentences)}.")
    if "liturgical season" not in sentences[0].lower() and "season" not in sentences[0].lower():
        raise RuntimeError("Rosary intro first sentence must announce the liturgical season.")
    if not sentences[1].lower().startswith("for today's rosary, we will focus on"):
        raise RuntimeError("Rosary intro second sentence must announce today's rosary focus.")
    return " ".join(sentences).strip()


def _deterministic_rosary_intro(date_value, mystery_set_title: str, focus: RosaryDayContext) -> str:
    date_display = date_value.strftime("%A, %B %d, %Y").replace(" 0", " ")
    liturgical_day = focus.celebration_clause or "the liturgical day"
    season_label = focus.season_label or "the liturgical season"
    return (
        f"Today is {date_display}, as the Church marks {liturgical_day} in {season_label}. "
        f"For today's rosary, we will focus on {focus.focus_prompt_label}. "
        f"As we pray the {mystery_set_title}, we ask the Lord to draw each mystery into the needs of this day."
    )


def _build_season_prompt(date_value, mysteries: Sequence[RosaryMystery], *, season: Optional[str] = None) -> str:
    mystery_lines = "\n".join(f"{mystery.number}. {mystery.title} - {mystery.fruit}" for mystery in mysteries)
    return f"""
Write exactly five Catholic Rosary decade reflections, one line per mystery.

{_reflection_style_rules()}

Additional season rule:
- Since Gospel text is unavailable, connect each mystery and fruit to the liturgical season instead.
- Season: {_season_label(season)}.

Date: {date_value.isoformat()}
Mysteries:
{mystery_lines}
""".strip()


def _build_seasonal_or_generic_reflection_result(
    date_value,
    mysteries: Sequence[RosaryMystery],
    *,
    model: str,
    season: Optional[str] = None,
    fallback_reason: str = "",
) -> RosaryReflectionResult:
    prompt = _build_season_prompt(date_value, mysteries, season=season)
    try:
        rendered = _call_openai_reflections(model, prompt)
        return RosaryReflectionResult(
            reflections=validate_rosary_reflections(rendered, mysteries),
            source=SOURCE_GENERATED_SEASON,
            fallback_reason=fallback_reason,
        )
    except Exception as exc:
        print(f"WARN rosary_reflections using generic_fallback reason=season_generation_invalid detail={exc}", file=sys.stderr)
        reason = "; ".join(part for part in (fallback_reason, str(exc)) if part)
        return RosaryReflectionResult(
            reflections=validate_rosary_reflections(fallback_rosary_reflections(mysteries, season=season), mysteries),
            source=SOURCE_FALLBACK_GENERIC,
            fallback_reason=reason,
        )


def _call_openai_reflections(model: str, prompt: str) -> Any:
    api_key, base_url, resolved_model = _resolve_openai_settings(model=model)
    if not api_key:
        raise RuntimeError("Missing OpenAI API key for Rosary text generation.")
    client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))
    user = _normalize_whitespace(prompt)
    system = (
        "Return JSON only. Provide exactly five reflections in order, one for each mystery. "
        "Each item must include number and reflection."
    )
    try:
        response = client.responses.parse(
            model=resolved_model or model,
            temperature=0.4,
            input=[
                {"role": "system", "content": [{"type": "input_text", "text": system}]},
                {"role": "user", "content": [{"type": "input_text", "text": user}]},
            ],
            text_format=_StructuredRosaryReflectionResponse,
        )
        parsed = getattr(response, "output_parsed", None)
        if parsed:
            return parsed
    except Exception as exc:
        print(f"WARN rosary_reflections structured_generation_unavailable detail={exc}; trying plain_text", file=sys.stderr)

    response = client.responses.create(
        model=resolved_model or model,
        temperature=0.4,
        input=[
            {
                "role": "system",
                "content": [{"type": "input_text", "text": "Return plain text only. Exactly five lines. No markdown, no bullets, no numbering, no commentary."}],
            },
            {"role": "user", "content": [{"type": "input_text", "text": user}]},
        ],
    )
    text = str(getattr(response, "output_text", "") or "").strip()
    if text:
        return text
    raise RuntimeError("Rosary reflection generation returned empty text.")


def _call_openai_text(model: str, prompt: str, *, system: str, temperature: float) -> str:
    api_key, base_url, resolved_model = _resolve_openai_settings(model=model)
    if not api_key:
        raise RuntimeError("Missing OpenAI API key for Rosary text generation.")
    client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))
    response = client.responses.create(
        model=resolved_model or model,
        temperature=temperature,
        input=[
            {"role": "system", "content": [{"type": "input_text", "text": system}]},
            {"role": "user", "content": [{"type": "input_text", "text": _normalize_whitespace(prompt)}]},
        ],
    )
    text = str(getattr(response, "output_text", "") or "").strip()
    if text:
        return text
    raise RuntimeError("Rosary reflection generation returned empty text.")
