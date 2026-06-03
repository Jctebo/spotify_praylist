from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass
from typing import Any, List, Optional, Sequence

from openai import OpenAI

from jobs.publish.daily_intro import OAI_MODEL, _normalize_whitespace, _resolve_openai_settings, fetch_daily_gospel_context


MAX_REFLECTION_CHARS = 280


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
    season_phrase = "today"
    normalized_season = str(season or "").strip().lower()
    if normalized_season == "easter":
        season_phrase = "in this Easter season"
    reflections = []
    for mystery in mysteries:
        reflections.append(
            f"As we contemplate {mystery.title}, we ask for the grace of {mystery.fruit.lower()} {season_phrase}."
        )
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
    try:
        context = fetch_daily_gospel_context(
            date_value,
            calendar=calendar,
            locale=locale,
            allow_missing_gospel=allow_missing_gospel,
        )
    except Exception as exc:
        print(f"WARN rosary_reflections using fallback reason=gospel_context_unavailable detail={exc}", file=sys.stderr)
        return fallback_rosary_reflections(mysteries, season=season)

    if not str(getattr(context, "gospel_text", "") or "").strip():
        print("INFO rosary_reflections using fallback reason=missing_gospel_text", file=sys.stderr)
        return fallback_rosary_reflections(mysteries, season=season)

    model = str(prompt_model or os.getenv(OAI_MODEL, "") or "gpt-4.1-mini").strip() or "gpt-4.1-mini"
    prompt = _build_prompt(date_value, context, mysteries)
    try:
        rendered = _call_openai_reflections(model, prompt)
        return validate_rosary_reflections(rendered, mysteries)
    except Exception as exc:
        print(f"WARN rosary_reflections using fallback reason=generation_invalid detail={exc}", file=sys.stderr)
        return fallback_rosary_reflections(mysteries, season=season)


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


def _build_prompt(date_value, context: Any, mysteries: Sequence[RosaryMystery]) -> str:
    mystery_lines = "\n".join(f"{mystery.number}. {mystery.title} - {mystery.fruit}" for mystery in mysteries)
    return f"""
Write exactly five short Catholic Rosary decade reflections, one line per mystery.

Each line must:
- Stay under {MAX_REFLECTION_CHARS} characters.
- Connect the listed mystery and fruit to today's Gospel.
- Avoid adding details not present in the Gospel text.
- Be reverent, warm, and suitable for spoken prayer.
- Return plain text only, with one reflection per line and no numbering.

Date: {date_value.isoformat()}
Liturgical context: {getattr(context, "celebration_clause", "")}
Gospel citation: {getattr(context, "gospel_citation", "")}
Mysteries:
{mystery_lines}

Gospel text:
{getattr(context, "gospel_text", "")}
""".strip()


def _call_openai_reflections(model: str, prompt: str) -> str:
    api_key, base_url, resolved_model = _resolve_openai_settings(model=model)
    if not api_key:
        raise RuntimeError("Missing OpenAI API key for Rosary reflection generation.")
    client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))
    system = "Return plain text only. Exactly five lines. No markdown, no bullets, no numbering, no commentary."
    response = client.responses.create(
        model=resolved_model or model,
        temperature=0,
        input=[
            {"role": "system", "content": [{"type": "input_text", "text": system}]},
            {"role": "user", "content": [{"type": "input_text", "text": _normalize_whitespace(prompt)}]},
        ],
    )
    text = str(getattr(response, "output_text", "") or "").strip()
    if text:
        return text
    raise RuntimeError("Rosary reflection generation returned empty text.")
