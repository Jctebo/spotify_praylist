from __future__ import annotations

import asyncio
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, NamedTuple, Optional, Sequence, Tuple

from catholic_mass_readings import USCCB, models
from openai import OpenAI

from jobs.novena.liturgical_helpers import celebration_name, romcal_fetch_day

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OPENAI_ENV_FILE = ROOT / "config" / "local" / "openai.env"
OPENAI_API_KEY = "OPENAI_API_KEY"
OPENAI_API_KEY_FILE = "OPENAI_API_KEY_FILE"
OAI_API_BASE_URL = "OAI_API_BASE_URL"
OAI_MODEL = "OAI_MODEL"
ROMCAL_CALENDAR = "ROMCAL_CALENDAR"
ROMCAL_LOCALE = "ROMCAL_LOCALE"


class DailyIntroContext(NamedTuple):
    date: Any
    calendar: str
    locale: str
    celebration_names: tuple[str, ...]
    celebration_clause: str
    gospel_citation: str
    gospel_text: str
    mass_title: str


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


@lru_cache(maxsize=8)
def _load_env_file(path_text: str) -> Dict[str, str]:
    path = Path(path_text)
    if not path.exists():
        return {}
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return {}
    values: Dict[str, str] = {}
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"").strip("'")
        if key:
            values[key] = value
    return values


def _resolve_openai_settings(*, api_key: str = "", base_url: str = "", model: str = "") -> Tuple[str, str, str]:
    configured_path = os.getenv(OPENAI_API_KEY_FILE, "").strip()
    env_path = configured_path or str(DEFAULT_OPENAI_ENV_FILE)
    file_values = _load_env_file(env_path)
    resolved_api_key = (
        str(api_key or "").strip()
        or os.getenv(OPENAI_API_KEY, "").strip()
        or file_values.get(OPENAI_API_KEY, "").strip()
    )
    resolved_base_url = (
        str(base_url or "").strip()
        or os.getenv(OAI_API_BASE_URL, "").strip()
        or file_values.get(OAI_API_BASE_URL, "").strip()
        or "https://api.openai.com/v1"
    )
    resolved_model = (
        str(model or "").strip()
        or os.getenv(OAI_MODEL, "").strip()
        or file_values.get(OAI_MODEL, "").strip()
        or "gpt-4.1-mini"
    )
    return resolved_api_key, resolved_base_url, resolved_model


def _resolve_calendar(calendar: Optional[str]) -> str:
    raw = str(calendar or os.getenv(ROMCAL_CALENDAR, "general_roman")).strip()
    return raw or "general_roman"


def _resolve_locale(locale: Optional[str]) -> str:
    raw = str(locale or os.getenv(ROMCAL_LOCALE, "en")).strip()
    return raw or "en"


async def _fetch_mass(date_value) -> Optional[models.Mass]:
    async with USCCB() as usccb:
        return await usccb.get_mass_from_date(date_value, [models.MassType.DEFAULT])


def _mass_to_gospel_context(mass: models.Mass) -> tuple[str, str]:
    if mass is None:
        raise RuntimeError("Mass readings returned no mass object.")
    gospel_section = None
    for section in mass.sections or []:
        if getattr(section, "type_", None) == models.SectionType.GOSPEL:
            gospel_section = section
            break
    if gospel_section is None:
        raise RuntimeError(f"Mass readings did not include a Gospel section for '{mass.title}'.")
    readings = list(getattr(gospel_section, "readings", []) or [])
    if not readings:
        raise RuntimeError(f"Mass readings did not include Gospel text for '{mass.title}'.")
    reading = readings[0]
    gospel_text = _normalize_whitespace(getattr(reading, "text", ""))
    if not gospel_text:
        raise RuntimeError(f"Mass readings returned empty Gospel text for '{mass.title}'.")
    verses = list(getattr(reading, "verses", []) or [])
    citation = _normalize_whitespace(getattr(verses[0], "text", "") if verses else "")
    if not citation:
        citation = _normalize_whitespace(getattr(mass, "url", ""))
    return citation, gospel_text


def fetch_daily_gospel_context(
    date_value,
    *,
    calendar: Optional[str] = None,
    locale: Optional[str] = None,
) -> DailyIntroContext:
    effective_calendar = _resolve_calendar(calendar)
    effective_locale = _resolve_locale(locale)
    rows = romcal_fetch_day(effective_calendar, effective_locale, date_value)
    if not rows:
        raise RuntimeError(
            f"Romcal returned no celebrations for {date_value.isoformat()} "
            f"(calendar={effective_calendar}, locale={effective_locale})."
        )

    celebration_names: List[str] = []
    seen_names: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = _normalize_whitespace(celebration_name(row))
        if not name:
            continue
        key = name.lower()
        if key in seen_names:
            continue
        seen_names.add(key)
        celebration_names.append(name)

    if not celebration_names:
        raise RuntimeError(
            f"Romcal returned no usable celebration names for {date_value.isoformat()} "
            f"(calendar={effective_calendar}, locale={effective_locale})."
        )

    mass = asyncio.run(_fetch_mass(date_value))
    citation, gospel_text = _mass_to_gospel_context(mass)
    mass_title = _normalize_whitespace(getattr(mass, "title", ""))
    if not mass_title:
        mass_title = citation

    return DailyIntroContext(
        date=date_value,
        calendar=effective_calendar,
        locale=effective_locale,
        celebration_names=tuple(celebration_names),
        celebration_clause=_join_with_and(celebration_names),
        gospel_citation=citation,
        gospel_text=gospel_text,
        mass_title=mass_title,
    )


def _openai_client() -> OpenAI:
    api_key, base_url, _ = _resolve_openai_settings()
    if not api_key:
        raise RuntimeError(f"Missing required environment variable: {OPENAI_API_KEY}")
    return OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))


def _call_openai_prompt(model: str, prompt: str) -> str:
    client = _openai_client()
    system = "Return plain text only. Exactly three sentences. No markdown, no bullets, no commentary."
    user = _normalize_whitespace(prompt)
    if not user:
        raise RuntimeError("Daily intro prompt rendered empty text.")
    try:
        response = client.responses.create(
            model=model,
            temperature=0,
            input=[
                {"role": "system", "content": [{"type": "input_text", "text": system}]},
                {"role": "user", "content": [{"type": "input_text", "text": user}]},
            ],
        )
        text = _normalize_whitespace(str(getattr(response, "output_text", "") or "").strip())
        if text:
            return text
    except Exception:
        pass
    chat = client.chat.completions.create(
        model=model,
        temperature=0,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    choices = getattr(chat, "choices", None) or []
    if not choices:
        raise RuntimeError("Daily intro generation returned no choices.")
    text = _normalize_whitespace(str(getattr(getattr(choices[0], "message", None), "content", "") or "").strip())
    if not text:
        raise RuntimeError("Daily intro generation returned empty text.")
    return text


def _split_sentences(text: str) -> List[str]:
    body = _normalize_whitespace(text).replace("’", "'")
    if not body:
        return []
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", body) if part.strip()]


def _validate_daily_intro(text: str) -> str:
    sentences = _split_sentences(text)
    if len(sentences) != 3:
        raise RuntimeError(f"Daily intro must contain exactly three sentences, got {len(sentences)}.")
    if not sentences[0].lower().startswith("today the church celebrates"):
        raise RuntimeError("Daily intro must begin with a liturgical celebration sentence.")
    if not sentences[2].lower().startswith("in today's gospel"):
        raise RuntimeError("Daily intro must end with a Gospel summary sentence.")
    return " ".join(sentences).strip()


def build_daily_intro_text(
    date_value,
    *,
    calendar: Optional[str] = None,
    locale: Optional[str] = None,
    prompt_model: Optional[str] = None,
) -> str:
    context = fetch_daily_gospel_context(date_value, calendar=calendar, locale=locale)
    model = str(prompt_model or os.getenv(OAI_MODEL, "") or "gpt-4.1-mini").strip() or "gpt-4.1-mini"
    prompt = f"""
Write exactly three sentences for the opening block of a Catholic prayer podcast.

Sentence 1 must begin with "Today the Church celebrates" and must include this liturgical context exactly: {context.celebration_clause}.
Sentence 2 must be a short sentence of praise to God.
Sentence 3 must begin with "In today's Gospel" and summarize the Gospel reading below in one reverent sentence without adding facts not present in the text.

Date: {date_value.isoformat()}
Liturgical context: {context.celebration_clause}
Gospel citation: {context.gospel_citation}
Gospel text:
{context.gospel_text}
""".strip()
    rendered = _call_openai_prompt(model, prompt)
    return _validate_daily_intro(rendered)
