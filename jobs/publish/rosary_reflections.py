from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass
from typing import Any, List, Optional, Sequence

from openai import OpenAI

from jobs.publish.daily_intro import OAI_MODEL, _normalize_whitespace, _resolve_openai_settings, fetch_daily_gospel_context


MAX_REFLECTION_CHARS = 650


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
    normalized_season = str(season or "").strip().lower()
    reflections = []
    for mystery in mysteries:
        fruit = mystery.fruit.lower()
        if normalized_season == "easter":
            reflection = (
                f"{mystery.title} shows the light of the risen Christ breaking into ordinary fear and waiting. "
                f"In this Easter season, the mystery of {mystery.title} teaches us to recognize hope where God is already at work. "
                f"The fruit of this mystery is {fruit}, the grace that lets the heart answer God with trust. "
                f"As we pray {mystery.title}, we ask for {fruit} to take root in this decade and in our day."
            )
        else:
            reflection = (
                f"{mystery.title} places before us a concrete moment in the life of Jesus and Mary. "
                f"In Ordinary Time, the mystery of {mystery.title} teaches us to meet grace in the steady duties of the day. "
                f"The fruit of this mystery is {fruit}, the grace that shapes how we listen, choose, and love. "
                f"As we pray {mystery.title}, we ask for {fruit} to become visible in this decade and in our daily life."
            )
        reflections.append(reflection)
    return tuple(reflections)


def validate_rosary_reflections(raw: Any, mysteries: Sequence[RosaryMystery]) -> tuple[str, ...]:
    if isinstance(raw, str):
        lines = [_normalize_reflection_line(line) for line in raw.splitlines()]
    else:
        lines = [_normalize_reflection_line(line) for line in list(raw or [])]
    cleaned = [line for line in lines if line]
    if len(cleaned) != len(mysteries):
        raise RuntimeError(f"Rosary reflection generation must return exactly {len(mysteries)} reflections, got {len(cleaned)}.")
    for index, reflection in enumerate(cleaned, start=1):
        if len(reflection) > MAX_REFLECTION_CHARS:
            raise RuntimeError(f"Rosary reflection {index} is too long.")
    return tuple(cleaned)


def build_rosary_reflections(
    date_value,
    mysteries: Sequence[RosaryMystery],
    *,
    calendar: Optional[str] = None,
    locale: Optional[str] = None,
    prompt_model: Optional[str] = None,
    allow_missing_gospel: bool = True,
    season: Optional[str] = None,
) -> tuple[str, ...]:
    model = str(prompt_model or os.getenv(OAI_MODEL, "") or "gpt-4.1-mini").strip() or "gpt-4.1-mini"
    try:
        context = fetch_daily_gospel_context(
            date_value,
            calendar=calendar,
            locale=locale,
            allow_missing_gospel=allow_missing_gospel,
        )
    except Exception as exc:
        print(f"WARN rosary_reflections gospel_context_unavailable detail={exc}", file=sys.stderr)
        return _build_seasonal_or_generic_reflections(date_value, mysteries, model=model, season=season)

    if not str(getattr(context, "gospel_text", "") or "").strip():
        print("INFO rosary_reflections missing_gospel_text; trying season_only_generation", file=sys.stderr)
        return _build_seasonal_or_generic_reflections(date_value, mysteries, model=model, season=season)

    prompt = _build_prompt(date_value, context, mysteries)
    try:
        rendered = _call_openai_reflections(model, prompt)
        return validate_rosary_reflections(rendered, mysteries)
    except Exception as exc:
        print(f"WARN rosary_reflections gospel_generation_invalid detail={exc}; trying season_only_generation", file=sys.stderr)
        return _build_seasonal_or_generic_reflections(date_value, mysteries, model=model, season=season)


def build_rosary_reflection_set(
    date_value,
    mystery_text: str,
    *,
    calendar: Optional[str] = None,
    locale: Optional[str] = None,
    prompt_model: Optional[str] = None,
    allow_missing_gospel: bool = True,
    season: Optional[str] = None,
) -> RosaryReflectionSet:
    title, mysteries = parse_rosary_mysteries(mystery_text)
    reflections = build_rosary_reflections(
        date_value,
        mysteries,
        calendar=calendar,
        locale=locale,
        prompt_model=prompt_model,
        allow_missing_gospel=allow_missing_gospel,
        season=season,
    )
    source = "fallback" if reflections == fallback_rosary_reflections(mysteries, season=season) else "generated"
    return RosaryReflectionSet(mystery_set_title=title, mysteries=mysteries, reflections=reflections, source=source)


def _normalize_reflection_line(value: Any) -> str:
    line = _normalize_whitespace(value)
    line = re.sub(r"^\s*(?:[-*]|\d+[\).])\s*", "", line).strip()
    return line


def _season_label(season: Optional[str]) -> str:
    normalized = str(season or "").strip().lower()
    if normalized == "easter":
        return "Easter season"
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


def _build_seasonal_or_generic_reflections(
    date_value,
    mysteries: Sequence[RosaryMystery],
    *,
    model: str,
    season: Optional[str] = None,
) -> tuple[str, ...]:
    prompt = _build_season_prompt(date_value, mysteries, season=season)
    try:
        rendered = _call_openai_reflections(model, prompt)
        return validate_rosary_reflections(rendered, mysteries)
    except Exception as exc:
        print(f"WARN rosary_reflections using generic_fallback reason=season_generation_invalid detail={exc}", file=sys.stderr)
        return fallback_rosary_reflections(mysteries, season=season)


def _call_openai_reflections(model: str, prompt: str) -> str:
    api_key, base_url, resolved_model = _resolve_openai_settings(model=model)
    if not api_key:
        raise RuntimeError("Missing OpenAI API key for Rosary reflection generation.")
    client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))
    system = "Return plain text only. Exactly five lines. No markdown, no bullets, no numbering, no commentary."
    response = client.responses.create(
        model=resolved_model or model,
        temperature=0.4,
        input=[
            {"role": "system", "content": [{"type": "input_text", "text": system}]},
            {"role": "user", "content": [{"type": "input_text", "text": _normalize_whitespace(prompt)}]},
        ],
    )
    text = str(getattr(response, "output_text", "") or "").strip()
    if text:
        return text
    raise RuntimeError("Rosary reflection generation returned empty text.")
