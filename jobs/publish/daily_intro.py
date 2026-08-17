from __future__ import annotations

import asyncio
import html
import os
import re
import time
from typing import Any, Dict, List, NamedTuple, Optional, Sequence, Tuple

from catholic_mass_readings import USCCB, models
from curl_cffi import requests

from jobs.novena.liturgical_helpers import celebration_name, romcal_fetch_day
from jobs.publish.devotional_intro import (
    DevotionalIntroResult,
    IntroTextGenerator,
    MORNING_PRAYER_PROFILE,
    build_devotional_intro,
    resolve_openai_settings,
)
from jobs.publish.errors import DailyIntroMissingDataError

OAI_MODEL = "OAI_MODEL"
DEVOTIONAL_OFFLINE_TESTS = "DEVOTIONAL_OFFLINE_TESTS"
ROMCAL_CALENDAR = "ROMCAL_CALENDAR"
ROMCAL_LOCALE = "ROMCAL_LOCALE"
USCCB_READINGS_BASE_URL = "https://bible.usccb.org/bible/readings"
USCCB_REQUEST_TIMEOUT_SECONDS = 30
USCCB_REQUEST_ATTEMPTS = 2
USCCB_BROWSER_IMPERSONATIONS = ("chrome124", "chrome123", "chrome120", "chrome110")
USCCB_BROWSER_HEADERS = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    "pragma": "no-cache",
    "upgrade-insecure-requests": "1",
}


class DailyIntroContext(NamedTuple):
    date: Any
    calendar: str
    locale: str
    celebration_names: tuple[str, ...]
    celebration_clause: str
    gospel_citation: str
    gospel_text: str
    mass_title: str


def _usccb_daily_readings_url(date_value) -> str:
    slug = date_value.strftime("%m%d%y")
    base_url = str(os.getenv("USCCB_READINGS_BASE_URL", USCCB_READINGS_BASE_URL)).strip()
    base_url = (base_url or USCCB_READINGS_BASE_URL).rstrip("/")
    return f"{base_url}/{slug}.cfm"


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


def _resolve_openai_settings(*, api_key: str = "", base_url: str = "", model: str = "") -> Tuple[str, str, str]:
    return resolve_openai_settings(api_key=api_key, base_url=base_url, model=model)


def _resolve_calendar(calendar: Optional[str]) -> str:
    raw = str(calendar or os.getenv(ROMCAL_CALENDAR, "general_roman")).strip()
    return raw or "general_roman"


def _resolve_locale(locale: Optional[str]) -> str:
    raw = str(locale or os.getenv(ROMCAL_LOCALE, "en")).strip()
    return raw or "en"


async def _fetch_mass(date_value) -> Optional[models.Mass]:
    async with USCCB() as usccb:
        return await usccb.get_mass_from_date(date_value)


def _fetch_mass_with_retry(date_value) -> Optional[models.Mass]:
    for attempt in range(1, USCCB_REQUEST_ATTEMPTS + 1):
        try:
            mass = asyncio.run(_fetch_mass(date_value))
        except Exception:
            mass = None
        if mass is not None:
            return mass
        if attempt < USCCB_REQUEST_ATTEMPTS:
            time.sleep(0.2 * attempt)
    return None


def _clean_html_fragment(value: Any) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", " ", str(value or "")))
    return _normalize_whitespace(text.replace("\xa0", " "))


def _mass_to_gospel_context(mass: models.Mass) -> tuple[str, str]:
    if mass is None:
        raise DailyIntroMissingDataError("Mass readings returned no mass object.")
    gospel_section = None
    for section in mass.sections or []:
        if getattr(section, "type_", None) == models.SectionType.GOSPEL:
            gospel_section = section
            break
    if gospel_section is None:
        raise DailyIntroMissingDataError(f"Mass readings did not include a Gospel section for '{mass.title}'.")
    readings = list(getattr(gospel_section, "readings", []) or [])
    if not readings:
        raise DailyIntroMissingDataError(f"Mass readings did not include Gospel text for '{mass.title}'.")
    reading = readings[0]
    gospel_text = _normalize_whitespace(getattr(reading, "text", ""))
    if not gospel_text:
        raise DailyIntroMissingDataError(f"Mass readings returned empty Gospel text for '{mass.title}'.")
    verses = list(getattr(reading, "verses", []) or [])
    citation = _normalize_whitespace(getattr(verses[0], "text", "") if verses else "")
    if not citation:
        citation = _normalize_whitespace(getattr(mass, "url", ""))
    return citation, gospel_text


def _parse_usccb_gospel_from_html(html_text: str, url: str) -> tuple[str, str, str]:
    title_match = re.search(r"(?is)<title>\s*(.*?)\s*</title>", html_text)
    mass_title = ""
    if title_match:
        mass_title = _clean_html_fragment(title_match.group(1).split("|", 1)[0])
    pattern = re.compile(
        r'(?is)<div[^>]*class="content-header"[^>]*>.*?<h3[^>]*class="name"[^>]*>\s*(.*?)\s*</h3>.*?'
        r'<div[^>]*class="address"[^>]*>\s*(.*?)\s*</div>.*?</div>\s*'
        r'<div[^>]*class="content-body"[^>]*>\s*(.*?)\s*</div>'
    )
    for match in pattern.finditer(html_text):
        section_title = _clean_html_fragment(match.group(1))
        if "gospel" not in section_title.lower():
            continue
        citation = _clean_html_fragment(match.group(2))
        gospel_text = _clean_html_fragment(match.group(3))
        if not gospel_text:
            continue
        if not citation:
            citation = _normalize_whitespace(url)
        if not mass_title:
            mass_title = citation
        return citation, gospel_text, mass_title
    raise DailyIntroMissingDataError(f"USCCB readings page did not include a Gospel section for '{url}'.")


def _fetch_usccb_html(date_value) -> str:
    url = _usccb_daily_readings_url(date_value)
    last_error: Optional[BaseException] = None
    for attempt in range(1, USCCB_REQUEST_ATTEMPTS + 1):
        for impersonation in USCCB_BROWSER_IMPERSONATIONS:
            try:
                response = requests.get(
                    url,
                    timeout=USCCB_REQUEST_TIMEOUT_SECONDS,
                    impersonate=impersonation,
                    default_headers=False,
                    headers=USCCB_BROWSER_HEADERS,
                )
                response.raise_for_status()
                html_text = str(getattr(response, "text", "") or "")
                lowered = html_text.lower()
                if "checking connection" in lowered or "checking your connection" in lowered:
                    last_error = DailyIntroMissingDataError(
                        f"USCCB readings page returned a challenge page for {date_value.isoformat()}."
                    )
                    continue
                return html_text
            except Exception as exc:
                last_error = exc
                continue
        if attempt < USCCB_REQUEST_ATTEMPTS:
            time.sleep(0.2 * attempt)
    if last_error is not None:
        raise DailyIntroMissingDataError(f"USCCB readings page was unavailable for {date_value.isoformat()}.") from last_error
    raise DailyIntroMissingDataError(f"USCCB readings page was unavailable for {date_value.isoformat()}.")


def fetch_daily_gospel_context(
    date_value,
    *,
    calendar: Optional[str] = None,
    locale: Optional[str] = None,
    allow_missing_gospel: bool = False,
) -> DailyIntroContext:
    effective_calendar = _resolve_calendar(calendar)
    effective_locale = _resolve_locale(locale)
    rows = romcal_fetch_day(effective_calendar, effective_locale, date_value)
    if not rows:
        raise DailyIntroMissingDataError(
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
        raise DailyIntroMissingDataError(
            f"Romcal returned no usable celebration names for {date_value.isoformat()} "
            f"(calendar={effective_calendar}, locale={effective_locale})."
        )

    if str(os.getenv(DEVOTIONAL_OFFLINE_TESTS, "")).strip().lower() in {"1", "true", "yes", "on"}:
        if allow_missing_gospel:
            return DailyIntroContext(
                date=date_value,
                calendar=effective_calendar,
                locale=effective_locale,
                celebration_names=tuple(celebration_names),
                celebration_clause=_join_with_and(celebration_names),
                gospel_citation="",
                gospel_text="",
                mass_title="",
            )
        raise DailyIntroMissingDataError("Live Gospel lookup is disabled by DEVOTIONAL_OFFLINE_TESTS.")

    context_errors: List[BaseException] = []
    mass = _fetch_mass_with_retry(date_value)
    if mass is not None:
        try:
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
        except DailyIntroMissingDataError as exc:
            context_errors.append(exc)

    try:
        html_text = _fetch_usccb_html(date_value)
        citation, gospel_text, mass_title = _parse_usccb_gospel_from_html(html_text, _usccb_daily_readings_url(date_value))
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
    except DailyIntroMissingDataError as exc:
        context_errors.append(exc)

    if allow_missing_gospel:
        return DailyIntroContext(
            date=date_value,
            calendar=effective_calendar,
            locale=effective_locale,
            celebration_names=tuple(celebration_names),
            celebration_clause=_join_with_and(celebration_names),
            gospel_citation="",
            gospel_text="",
            mass_title="",
        )

    message = (
        f"Mass readings returned no usable Gospel data for {date_value.isoformat()} "
        f"(calendar={effective_calendar}, locale={effective_locale})."
    )
    if context_errors:
        raise DailyIntroMissingDataError(message) from context_errors[-1]
    raise DailyIntroMissingDataError(message)


def _shared_theme_value(shared_theme: Optional[Dict[str, Any]], key: str) -> str:
    if not isinstance(shared_theme, dict):
        return ""
    return _normalize_whitespace(shared_theme.get(key, ""))


def build_daily_intro_result(
    date_value,
    *,
    calendar: Optional[str] = None,
    locale: Optional[str] = None,
    prompt_model: Optional[str] = None,
    temperature: float = 0.4,
    allow_missing_gospel: bool = False,
    shared_theme: Optional[Dict[str, Any]] = None,
    generate_text_fn: Optional[IntroTextGenerator] = None,
) -> DevotionalIntroResult:
    context = fetch_daily_gospel_context(
        date_value,
        calendar=calendar,
        locale=locale,
        allow_missing_gospel=allow_missing_gospel,
    )
    model = str(prompt_model or os.getenv(OAI_MODEL, "") or "gpt-4.1-mini").strip() or "gpt-4.1-mini"
    theme_title = (
        _shared_theme_value(shared_theme, "sharedThemeTitle")
        or _shared_theme_value(shared_theme, "daily_theme_title")
        or context.celebration_clause
    )
    theme_explanation = (
        _shared_theme_value(shared_theme, "sharedThemeExplanation")
        or _shared_theme_value(shared_theme, "daily_theme_explanation")
    )
    gospel_bridge = (
        _shared_theme_value(shared_theme, "sharedGospelBridge")
        or _shared_theme_value(shared_theme, "daily_gospel_bridge")
    )
    if not gospel_bridge and (context.gospel_text or context.gospel_citation):
        gospel_bridge = f"Today's Gospel is proclaimed in {context.gospel_citation or context.mass_title}"
    intro_context = {
        "date": date_value.isoformat(),
        "prayer_title": "Morning Prayer",
        "devotion": "Morning Prayer",
        "celebration_clause": context.celebration_clause,
        "daily_theme_title": theme_title,
        "daily_theme_explanation": theme_explanation,
        "daily_theme_transition": (
            _shared_theme_value(shared_theme, "sharedThemeTransition")
            or _shared_theme_value(shared_theme, "daily_theme_transition")
        ),
        "season_label": (
            _shared_theme_value(shared_theme, "seasonLabel")
            or _shared_theme_value(shared_theme, "season_label")
        ),
        "daily_gospel_bridge": gospel_bridge,
        "daily_gospel_citation": context.gospel_citation,
        "daily_gospel_text": context.gospel_text,
        "saint_witness": _shared_theme_value(shared_theme, "saintWitness") or _shared_theme_value(shared_theme, "saint_witness"),
        "saint_witness_date": _shared_theme_value(shared_theme, "saintWitnessDate") or _shared_theme_value(shared_theme, "saint_witness_date"),
        "saint_witness_quote": _shared_theme_value(shared_theme, "saintWitnessQuote") or _shared_theme_value(shared_theme, "saint_witness_quote"),
        "saint_witness_quote_source": _shared_theme_value(shared_theme, "saintWitnessQuoteSource") or _shared_theme_value(shared_theme, "saint_witness_quote_source"),
    }
    return build_devotional_intro(
        MORNING_PRAYER_PROFILE,
        intro_context,
        prompt_model=model,
        temperature=temperature,
        generate_text_fn=generate_text_fn,
    )


def build_daily_intro_text(
    date_value,
    *,
    calendar: Optional[str] = None,
    locale: Optional[str] = None,
    prompt_model: Optional[str] = None,
    temperature: float = 0.4,
    allow_missing_gospel: bool = False,
    shared_theme: Optional[Dict[str, Any]] = None,
    generate_text_fn: Optional[IntroTextGenerator] = None,
) -> str:
    return build_daily_intro_result(
        date_value,
        calendar=calendar,
        locale=locale,
        prompt_model=prompt_model,
        temperature=temperature,
        allow_missing_gospel=allow_missing_gospel,
        shared_theme=shared_theme,
        generate_text_fn=generate_text_fn,
    ).text
