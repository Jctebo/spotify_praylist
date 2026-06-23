from __future__ import annotations

import asyncio
import html
import os
import re
import time
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, NamedTuple, Optional, Sequence, Tuple

from catholic_mass_readings import USCCB, models
from curl_cffi import requests
from openai import OpenAI

from jobs.novena.liturgical_helpers import celebration_name, romcal_fetch_day
from jobs.publish.errors import DailyIntroMissingDataError

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OPENAI_ENV_FILE = ROOT / "config" / "local" / "openai.env"
OPENAI_API_KEY = "OPENAI_API_KEY"
OPENAI_API_KEY_FILE = "OPENAI_API_KEY_FILE"
OAI_API_BASE_URL = "OAI_API_BASE_URL"
OAI_MODEL = "OAI_MODEL"
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


def _validate_daily_intro(text: str, *, allow_missing_gospel: bool = False) -> str:
    sentences = _split_sentences(text)
    if not sentences:
        if allow_missing_gospel:
            return ""
        raise RuntimeError("Daily intro must contain at least one sentence.")
    if not allow_missing_gospel and len(sentences) != 3:
        raise RuntimeError(f"Daily intro must contain exactly 3 sentences, got {len(sentences)}.")
    if not sentences[0].lower().startswith("today the church celebrates"):
        raise RuntimeError("Daily intro must begin with a liturgical celebration sentence.")
    if not allow_missing_gospel and not sentences[2].lower().startswith("in today's gospel"):
        raise RuntimeError("Daily intro must end with a Gospel summary sentence.")
    return " ".join(sentences).strip()


def _shared_theme_value(shared_theme: Optional[Dict[str, Any]], key: str) -> str:
    if not isinstance(shared_theme, dict):
        return ""
    return _normalize_whitespace(shared_theme.get(key, ""))


def _validate_theme_intro(text: str, *, has_gospel: bool, allow_missing_gospel: bool = False) -> str:
    if not has_gospel:
        rendered = _validate_daily_intro(text, allow_missing_gospel=allow_missing_gospel)
        if not rendered:
            return rendered
        lowered = rendered.lower()
        if "gospel" in lowered:
            raise RuntimeError("Daily intro must not mention the Gospel when Gospel text is unavailable.")
        if "today's focus" not in lowered and "the grace" not in lowered:
            raise RuntimeError("Daily intro must explain today's focus.")
        return rendered

    rendered = _normalize_whitespace(text)
    if not rendered:
        raise RuntimeError("Daily intro must contain at least one sentence.")
    sentences = _split_sentences(rendered)
    if len(sentences) != 3:
        raise RuntimeError(f"Daily intro must contain exactly 3 sentences, got {len(sentences)}.")
    if not sentences[0].lower().startswith("in today's gospel"):
        raise RuntimeError("Daily intro must begin with a Gospel sentence.")
    if not sentences[1].lower().startswith("today's focus is"):
        raise RuntimeError("Daily intro second sentence must explain today's focus.")
    third = sentences[2].lower()
    if "church celebrates" not in third and "liturgical" not in third and "season" not in third:
        raise RuntimeError("Daily intro third sentence must name the liturgical day or season.")
    rendered = " ".join(sentences).strip()
    lowered = rendered.lower()
    if "today's focus" not in lowered and "the grace" not in lowered:
        raise RuntimeError("Daily intro must explain today's focus.")
    if "gospel" not in lowered and not allow_missing_gospel:
        raise RuntimeError("Daily intro must mention the Gospel when Gospel text is available.")
    return rendered


def _deterministic_theme_intro(date_value, context: DailyIntroContext, shared_theme: Dict[str, Any]) -> str:
    title = _shared_theme_value(shared_theme, "sharedThemeTitle") or _shared_theme_value(shared_theme, "daily_theme_title") or "Trust"
    explanation = (
        _shared_theme_value(shared_theme, "sharedThemeExplanation")
        or _shared_theme_value(shared_theme, "daily_theme_explanation")
        or f"Today's focus is {title}."
    )
    gospel_bridge = _shared_theme_value(shared_theme, "sharedGospelBridge") or _shared_theme_value(shared_theme, "daily_gospel_bridge")
    if context.gospel_text:
        if gospel_bridge:
            gospel = f"In {gospel_bridge}, helping us receive this focus with faith"
        else:
            gospel = f"In today's Gospel, {context.gospel_citation or 'the Lord'} helps us receive this focus with faith"
        liturgical = f"Today the Church celebrates {context.celebration_clause}, and this liturgical day gathers our prayer around that grace."
        return _normalize_whitespace(f"{gospel}. {explanation} {liturgical}")
    else:
        gospel = "We receive this focus through the Church's prayer for this liturgical day."
        return _normalize_whitespace(
            f"Today the Church celebrates {context.celebration_clause}. {explanation} {gospel}"
        )


def build_daily_intro_text(
    date_value,
    *,
    calendar: Optional[str] = None,
    locale: Optional[str] = None,
    prompt_model: Optional[str] = None,
    allow_missing_gospel: bool = False,
    shared_theme: Optional[Dict[str, Any]] = None,
) -> str:
    context = fetch_daily_gospel_context(
        date_value,
        calendar=calendar,
        locale=locale,
        allow_missing_gospel=allow_missing_gospel,
    )
    model = str(prompt_model or os.getenv(OAI_MODEL, "") or "gpt-4.1-mini").strip() or "gpt-4.1-mini"
    theme_title = _shared_theme_value(shared_theme, "sharedThemeTitle") or _shared_theme_value(shared_theme, "daily_theme_title")
    theme_explanation = _shared_theme_value(shared_theme, "sharedThemeExplanation") or _shared_theme_value(shared_theme, "daily_theme_explanation")
    gospel_bridge = _shared_theme_value(shared_theme, "sharedGospelBridge") or _shared_theme_value(shared_theme, "daily_gospel_bridge")
    if theme_title or theme_explanation:
        if context.gospel_text:
            sentence_rules = f"""
Sentence 1 must begin with "In today's Gospel" and explain how the Gospel supports today's focus.
Sentence 2 must begin with "Today's focus is" and explain this focus in plain spoken language: {theme_explanation or theme_title}.
Sentence 3 must name this liturgical context exactly and explain how the Church receives the day in prayer: {context.celebration_clause}.
""".strip()
        else:
            sentence_rules = f"""
Sentence 1 must begin with "Today the Church celebrates" and must include this liturgical context exactly: {context.celebration_clause}.
Sentence 2 must begin with "Today's focus is" and explain this focus in plain spoken language: {theme_explanation or theme_title}.
Sentence 3 must explain that this focus is received through the liturgical day without referring to scripture readings.
""".strip()
        prompt = f"""
Write exactly three sentences for the opening block of a Catholic morning prayer podcast.

{sentence_rules}

Date: {date_value.isoformat()}
Liturgical context: {context.celebration_clause}
Shared focus title: {theme_title}
Shared focus explanation: {theme_explanation}
""".strip()
        if context.gospel_text:
            prompt = f"""
{prompt}
Gospel bridge: {gospel_bridge}
Gospel citation: {context.gospel_citation}
Gospel text:
{context.gospel_text}
""".strip()
        try:
            rendered = _call_openai_prompt(model, prompt)
            return _validate_theme_intro(
                rendered,
                has_gospel=bool(context.gospel_text),
                allow_missing_gospel=allow_missing_gospel,
            )
        except Exception:
            return _validate_theme_intro(
                _deterministic_theme_intro(date_value, context, dict(shared_theme or {})),
                has_gospel=bool(context.gospel_text),
                allow_missing_gospel=True,
            )

    if context.gospel_text:
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
    else:
        prompt = f"""
Write exactly two sentences for the opening block of a Catholic prayer podcast.

Sentence 1 must begin with "Today the Church celebrates" and must include this liturgical context exactly: {context.celebration_clause}.
Sentence 2 must be a short sentence of praise to God.
Do not refer to scripture readings because no scripture text is available.

Date: {date_value.isoformat()}
Liturgical context: {context.celebration_clause}
    """.strip()
    rendered = _call_openai_prompt(model, prompt)
    return _validate_daily_intro(rendered, allow_missing_gospel=allow_missing_gospel)
