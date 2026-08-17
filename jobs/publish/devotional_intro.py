from __future__ import annotations

import os
import re
from dataclasses import asdict, dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable, Dict, Mapping, Optional, Sequence, Tuple

from openai import OpenAI

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OPENAI_ENV_FILE = ROOT / "config" / "local" / "openai.env"
OPENAI_API_KEY = "OPENAI_API_KEY"
OPENAI_API_KEY_FILE = "OPENAI_API_KEY_FILE"
OAI_API_BASE_URL = "OAI_API_BASE_URL"
OAI_MODEL = "OAI_MODEL"

DEVOTIONAL_INTRO_POLICY_VERSION = "devotional-intro-v10"
SOURCE_OPENAI = "openai"
SOURCE_FALLBACK_DETERMINISTIC = "fallback-deterministic"


@dataclass(frozen=True)
class DevotionalIntroProfile:
    key: str
    purpose: str
    sentence_guidance: str
    min_chars: int
    require_gospel_when_available: bool = False


@dataclass(frozen=True)
class DevotionalIntroResult:
    text: str
    profile: str
    policy_version: str
    source: str
    fallback_reason: str = ""

    def metadata(self) -> Dict[str, str]:
        return asdict(self)


MORNING_PRAYER_PROFILE = DevotionalIntroProfile(
    key="morning-prayer",
    purpose=(
        "Orient the listener to Morning Prayer through the Church's liturgical day, "
        "the shared daily focus, and the Gospel when it is supplied."
    ),
    sentence_guidance="Write the introduction in 2-4 sentences.",
    min_chars=80,
    require_gospel_when_available=True,
)

AUXILIUM_CHRISTIANORUM_PROFILE = DevotionalIntroProfile(
    key="auxilium-christianorum",
    purpose=(
        "Lead from the liturgical announcement into the Auxilium Christianorum prayers, "
        "placing the listener, families, and the needs of the day under Mary's protection."
    ),
    sentence_guidance="Write the introduction in 1-2 sentences.",
    min_chars=40,
)

ANGELUS_PROFILE = DevotionalIntroProfile(
    key="angelus",
    purpose=(
        "Lead naturally into the Angelus by joining the day's grace to Mary's faithful "
        "reception of the Incarnation without repeating a separate daily announcement."
    ),
    sentence_guidance="Write the introduction in 1-2 sentences.",
    min_chars=40,
)

REGINA_CAELI_PROFILE = DevotionalIntroProfile(
    key="regina-caeli",
    purpose=(
        "Lead naturally into the Regina Caeli by joining the day's grace to Easter joy "
        "and Mary's rejoicing without repeating a separate daily announcement."
    ),
    sentence_guidance="Write the introduction in 1-2 sentences.",
    min_chars=40,
)

NOVENA_PROFILE = DevotionalIntroProfile(
    key="novena",
    purpose=(
        "Welcome the listener into the current day of this specific novena, centering the saint "
        "or devotion before the prayer begins."
    ),
    sentence_guidance="Write the introduction in 4-6 short sentences.",
    min_chars=40,
)

DEVOTIONAL_INTRO_PROFILES: Dict[str, DevotionalIntroProfile] = {
    profile.key: profile
    for profile in (
        MORNING_PRAYER_PROFILE,
        AUXILIUM_CHRISTIANORUM_PROFILE,
        ANGELUS_PROFILE,
        REGINA_CAELI_PROFILE,
        NOVENA_PROFILE,
    )
}

IntroTextGenerator = Callable[[str, str, str, float], str]


def normalize_intro_profile(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(value or "").lower()).strip("-")


def get_devotional_intro_profile(value: Any) -> DevotionalIntroProfile:
    key = normalize_intro_profile(value)
    profile = DEVOTIONAL_INTRO_PROFILES.get(key)
    if profile is None:
        supported = ", ".join(sorted(DEVOTIONAL_INTRO_PROFILES))
        raise RuntimeError(f"Unsupported devotional intro profile '{value}'. Expected one of: {supported}.")
    return profile


def _normalize_whitespace(value: Any) -> str:
    return " ".join(str(value or "").split()).strip()


def _complete_sentence(value: Any) -> str:
    text = _normalize_whitespace(value)
    if not text:
        return ""
    return text if text.endswith((".", "!", "?")) else f"{text}."


def _spoken_phrase(value: Any) -> str:
    return _normalize_whitespace(value).rstrip(".!? ")


def _spoken_list(value: Any) -> str:
    items = [item.strip() for item in _normalize_whitespace(value).split(",") if item.strip()]
    if len(items) < 2:
        return items[0] if items else ""
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return f"{', '.join(items[:-1])}, and {items[-1]}"


def _spoken_sentences(value: Any) -> Tuple[str, ...]:
    text = _normalize_whitespace(value)
    if not text:
        return ()
    return tuple(sentence for sentence in re.split(r"(?<!St\.)(?<=[.!?])\s+", text) if sentence)


def _normalize_for_match(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _sanitize_fallback_reason(value: Any) -> str:
    text = _normalize_whitespace(value)
    text = re.sub(r"(?i)\bbearer\s+\S+", "Bearer [redacted]", text)
    text = re.sub(
        r"(?i)\b(api[_ -]?key|authorization)\b\s*[:=]?\s*\S+",
        r"\1=[redacted]",
        text,
    )
    text = re.sub(r"https?://\S+", "[url]", text)
    return text[:300]


def _context_value(context: Mapping[str, Any], *keys: str) -> str:
    for key in keys:
        value = _normalize_whitespace(context.get(key, ""))
        if value:
            return value
    return ""


def _context_rows(context: Mapping[str, Any]) -> Tuple[Tuple[str, str], ...]:
    rows = (
        ("Date", _context_value(context, "date", "date_iso")),
        ("Prayer", _context_value(context, "prayer_title", "devotion")),
        ("Devotion", _context_value(context, "devotion")),
        ("Liturgical celebration", _context_value(context, "celebration_clause", "celebration_names")),
        ("Liturgical season", _context_value(context, "season_label", "liturgical_season")),
        ("Shared daily focus", _context_value(context, "daily_theme_title", "sharedThemeTitle")),
        (
            "Shared focus explanation",
            _context_value(context, "daily_theme_explanation", "sharedThemeExplanation"),
        ),
        (
            "Shared transition",
            _context_value(context, "daily_theme_transition", "sharedThemeTransition"),
        ),
        ("Gospel bridge", _context_value(context, "daily_gospel_bridge", "sharedGospelBridge")),
        ("Gospel citation", _context_value(context, "daily_gospel_citation", "gospel_citation")),
        ("Gospel text", _context_value(context, "daily_gospel_text", "gospel_text")),
        ("Saint", _context_value(context, "saint_name")),
        ("Saint witness", _context_value(context, "saint_witness")),
        ("Saint witness quotation", _context_value(context, "saint_witness_quote")),
        ("Saint quotation source", _context_value(context, "saint_witness_quote_source")),
        ("Identity description", _context_value(context, "intro_summary")),
        ("Patronage", _context_value(context, "intro_patronage")),
        ("Standard short-form guidance", _context_value(context, "short_form_intro_prompt")),
        ("Calendar bridge", _context_value(context, "calendar_bridge")),
        ("Feast", _context_value(context, "feast_name")),
        ("Novena day", _context_value(context, "day", "active_day")),
        ("Novena focus", _context_value(context, "daily_focus", "theme", "novena_theme")),
    )
    return tuple((label, value) for label, value in rows if value)


def build_devotional_intro_prompt(
    profile: DevotionalIntroProfile,
    context: Mapping[str, Any],
    *,
    correction: str = "",
) -> str:
    prayer_title = _context_value(context, "prayer_title", "devotion", "saint_name")
    gospel_supplied = bool(
        _context_value(
            context,
            "daily_gospel_bridge",
            "sharedGospelBridge",
            "daily_gospel_citation",
            "gospel_citation",
            "daily_gospel_text",
            "gospel_text",
        )
    )
    context_rows = _context_rows(context)
    if profile.key == "novena":
        allowed_labels = {"Prayer", "Saint", "Identity description", "Patronage", "Standard short-form guidance", "Novena day"}
        context_rows = tuple((label, value) for label, value in context_rows if label in allowed_labels)
    rows = "\n".join(f"{label}: {value}" for label, value in context_rows)
    correction_block = f"\nCorrection required after validation: {correction}" if correction else ""
    if profile.key == "novena":
        gospel_rule = ""
    elif gospel_supplied:
        gospel_rule = (
            "You may use the supplied Gospel context, but do not introduce another Scripture citation."
            if profile.key == "novena"
            else "Use the supplied Gospel context and do not introduce another Scripture citation."
        )
    else:
        gospel_rule = "No Gospel context is supplied. Do not mention a Gospel, reading, or Scripture citation."
    novena_rules = ""
    if profile.key == "novena":
        novena_day = _context_value(context, "day", "active_day")
        short_form_guidance = _context_value(context, "short_form_intro_prompt")
        novena_rules = f"""
For this novena, make the opening feel like a natural invitation to pray, not a summary of the day's liturgy.
Write exactly 4 to 6 sentences in this order: begin with 2 to 4 sentences about the named saint or devotion, then one sentence that explicitly names Day {novena_day} of this novena, then a final invitation into prayer beginning with "Let us".
Use the supplied identity description faithfully, with patronage when present. Do not mention any daily theme, Gospel, Scripture, calendar bridge, feast, liturgical season, or novena focus.
{short_form_guidance}
        Let the saint's life and witness give shape to the opening; do not summarize the day's liturgy.
""".strip()
    saint_rules = """
The saint witness is a required participant in this prayer, not an abstract theme label.
Name the supplied saint witness naturally, address God while asking for that saint's intercession, and explicitly use the supplied quotation as the saint's words.
Quote the supplied wording exactly; attribute it to the named saint and do not invent, paraphrase, or substitute a quotation.
If no quotation is supplied, do not create one; still name the saint witness and pray with the saint's intercession.
""".strip()
    return f"""
Write a concise Catholic devotional introduction for the profile "{profile.key}".

Purpose: {profile.purpose}
{profile.sentence_guidance}
Use natural, varied, prayerful spoken language. Do not force a stock opening phrase.
Clearly identify the prayer as "{prayer_title}".
Ground the prose in the supplied {"prayer-specific" if profile.key == "novena" else "daily and prayer-specific"} context.
{gospel_rule}
{novena_rules}
{saint_rules}
Do not invent quotations, saints, feasts, seasons, Scripture citations, doctrine, or current events. When Standard short-form guidance is supplied, use only modest, well-known saint/event identity details and omit patronage if uncertain.
Return plain prose only: no heading, markdown, bullets, production notes, or commentary.
Keep the result at least {profile.min_chars} characters long.
{correction_block}

Approved context:
{rows}
""".strip()


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


def resolve_openai_settings(
    *,
    api_key: str = "",
    base_url: str = "",
    model: str = "",
) -> Tuple[str, str, str]:
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


def _default_generate_text(model: str, system: str, prompt: str, temperature: float) -> str:
    api_key, base_url, resolved_model = resolve_openai_settings(model=model)
    if not api_key:
        raise RuntimeError(f"Missing required environment variable: {OPENAI_API_KEY}")
    client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))
    try:
        response = client.responses.create(
            model=resolved_model,
            temperature=temperature,
            input=[
                {"role": "system", "content": [{"type": "input_text", "text": system}]},
                {"role": "user", "content": [{"type": "input_text", "text": prompt}]},
            ],
        )
        text = _normalize_whitespace(str(getattr(response, "output_text", "") or ""))
        if text:
            return text
    except Exception:
        pass
    chat = client.chat.completions.create(
        model=resolved_model,
        temperature=temperature,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
    )
    choices = getattr(chat, "choices", None) or []
    if not choices:
        raise RuntimeError("Devotional intro generation returned no choices.")
    text = _normalize_whitespace(str(getattr(getattr(choices[0], "message", None), "content", "") or ""))
    if not text:
        raise RuntimeError("Devotional intro generation returned empty text.")
    return text


def _contains_any(text: str, values: Sequence[str]) -> bool:
    normalized = _normalize_for_match(text)
    return any(_normalize_for_match(value) in normalized for value in values if _normalize_for_match(value))


def _reject_foreign_scripture_citations(text: str, allowed_citation: str) -> None:
    citations = re.findall(r"\b(?:[1-3]\s*)?[A-Z][a-z]+\s+\d{1,3}:\d{1,3}(?:-\d{1,3})?\b", text)
    allowed = _normalize_for_match(allowed_citation)
    for citation in citations:
        if not allowed or _normalize_for_match(citation) not in allowed:
            raise RuntimeError(f"Intro introduced an unsupported Scripture citation: {citation}.")


def validate_devotional_intro(
    text: Any,
    profile: DevotionalIntroProfile,
    context: Mapping[str, Any],
) -> str:
    rendered = _normalize_whitespace(text).replace("â€™", "'")
    if len(rendered) < profile.min_chars:
        raise RuntimeError(f"Intro is shorter than {profile.min_chars} characters.")
    if re.search(r"(^|\s)(?:```|#{1,6}\s|\*\*|[*-]\s)", rendered):
        raise RuntimeError("Intro must not contain markdown or bullets.")
    lowered = rendered.lower()
    prompt_echoes = (
        "approved context:",
        "correction required",
        "sentence guidance",
        "return plain prose",
        "as an ai",
        "i cannot",
    )
    if any(value in lowered for value in prompt_echoes):
        raise RuntimeError("Intro contains prompt or production commentary.")

    prayer_title = _context_value(context, "prayer_title", "devotion", "saint_name")
    identity_candidates = tuple(
        value
        for value in (
            prayer_title,
            _context_value(context, "devotion"),
        )
        if value
    )
    if identity_candidates and not _contains_any(rendered, identity_candidates):
        raise RuntimeError(f"Intro must identify the prayer '{prayer_title}'.")

    daily_anchors = tuple(
        value
        for value in (
            _context_value(context, "daily_theme_title", "sharedThemeTitle"),
            _context_value(context, "celebration_clause", "celebration_names"),
            _context_value(context, "season_label", "liturgical_season"),
            _context_value(context, "daily_gospel_bridge", "sharedGospelBridge"),
            _context_value(context, "daily_gospel_citation", "gospel_citation"),
        )
        if value
    )
    if profile.key != "novena" and daily_anchors and not _contains_any(rendered, daily_anchors):
        raise RuntimeError("Intro must use at least one supplied daily liturgical anchor.")

    saint_witness = _context_value(context, "saint_witness", "saintWitness")
    saint_quote = _context_value(context, "saint_witness_quote", "saintWitnessQuote")
    if profile.key != "novena" and saint_witness:
        if not _contains_any(rendered, (saint_witness,)):
            raise RuntimeError("Intro must name the supplied saint witness.")
        if saint_quote and saint_quote not in rendered:
            raise RuntimeError("Intro must include the approved saint witness quotation exactly.")

    if profile.key == "novena":
        day = _context_value(context, "day", "active_day")
        if day and not _contains_any(rendered, (f"Day {day}",)):
            raise RuntimeError(f"Novena intro must identify Day {day}.")
        forbidden_context = tuple(
            value
            for value in (
                _context_value(context, "daily_focus", "theme", "novena_theme"),
                _context_value(context, "daily_theme_title", "sharedThemeTitle"),
                _context_value(context, "daily_gospel_bridge", "sharedGospelBridge"),
                _context_value(context, "calendar_bridge"),
                _context_value(context, "feast_name"),
            )
            if _normalize_for_match(value) not in {
                _normalize_for_match(prayer_title),
                _normalize_for_match(_context_value(context, "saint_name")),
            }
        )
        if forbidden_context and _contains_any(rendered, forbidden_context):
            raise RuntimeError("Novena intro must not use daily liturgical context.")
        if "gospel" in lowered or re.search(r"\bscripture\b|\breadings?\b", lowered):
            raise RuntimeError("Novena intro must not mention Gospel or Scripture.")
        sentences = _spoken_sentences(rendered)
        if not 4 <= len(sentences) <= 6:
            raise RuntimeError("Novena intro must contain 4 to 6 spoken sentences.")
        if day and sum(_contains_any(sentence, (f"Day {day}",)) for sentence in sentences) != 1:
            raise RuntimeError(f"Novena intro must use Day {day} in exactly one sentence.")
        if not sentences[-1].lower().startswith("let us "):
            raise RuntimeError('Novena intro must end with a prayer invitation beginning "Let us".')

    gospel_citation = _context_value(context, "daily_gospel_citation", "gospel_citation")
    gospel_supplied = bool(
        _context_value(
            context,
            "daily_gospel_bridge",
            "sharedGospelBridge",
            "daily_gospel_citation",
            "gospel_citation",
            "daily_gospel_text",
            "gospel_text",
        )
    )
    if not gospel_supplied and ("gospel" in lowered or re.search(r"\bscripture\b|\breadings?\b", lowered)):
        raise RuntimeError("Intro must not mention Gospel or Scripture when none was supplied.")
    if profile.require_gospel_when_available and gospel_supplied:
        gospel_anchors = (
            "gospel",
            gospel_citation,
            _context_value(context, "daily_gospel_bridge", "sharedGospelBridge"),
        )
        if not _contains_any(rendered, gospel_anchors):
            raise RuntimeError("Intro must use the supplied Gospel context.")
    _reject_foreign_scripture_citations(rendered, gospel_citation)
    return rendered


def _fallback_text(profile: DevotionalIntroProfile, context: Mapping[str, Any]) -> str:
    prayer_title = _context_value(context, "prayer_title", "devotion", "saint_name") or "this prayer"
    theme = _spoken_phrase(_context_value(context, "daily_theme_title", "sharedThemeTitle")) or "faithful prayer"
    celebration = _spoken_phrase(_context_value(context, "celebration_clause", "celebration_names"))
    gospel_bridge = _context_value(context, "daily_gospel_bridge", "sharedGospelBridge")
    saint_witness = _context_value(context, "saint_witness", "saintWitness")
    saint_quote = _context_value(context, "saint_witness_quote", "saintWitnessQuote")
    saint_sentence = ""
    if saint_witness:
        saint_sentence = f"We pray with {saint_witness}, who teaches us, \"{saint_quote}\"." if saint_quote else f"We pray with {saint_witness} and ask for the saint's intercession."
    if profile.key == "morning-prayer":
        sentences = [f"As we begin {prayer_title}, the Church gathers our hearts around {theme}."]
        if saint_sentence:
            sentences.append(saint_sentence)
        if celebration:
            sentences.append(f"Today the Church celebrates {celebration}.")
        if gospel_bridge:
            sentences.append(_complete_sentence(gospel_bridge))
        sentences.append("We receive this grace through the Church's prayer and offer the whole day to God.")
        return _normalize_whitespace(" ".join(sentences))
    if profile.key == "auxilium-christianorum":
        return _normalize_whitespace(
            f"As we enter the {prayer_title}, {saint_sentence} We carry the grace of {theme} into prayer, "
            "placing ourselves, our families, and the needs of this day under Mary's protection."
        )
    if profile.key == "angelus":
        return _normalize_whitespace(
            f"As we pray the {prayer_title}, {saint_sentence} The grace of {theme} draws us to Mary's faithful yes "
            "and the mystery of the Word made flesh."
        )
    if profile.key == "regina-caeli":
        return _normalize_whitespace(
            f"As we pray the {prayer_title}, {saint_sentence} The grace of {theme} joins our prayer to Mary's Easter joy "
            "in the risen Christ."
        )
    day = _context_value(context, "day", "active_day")
    saint_name = _context_value(context, "saint_name") or prayer_title
    summary = _context_value(context, "intro_summary")
    patronage = _context_value(context, "intro_patronage")
    sentences = []
    identity_sentence = summary or f"We remember {saint_name} as we turn our hearts to God."
    sentences.append(_complete_sentence(identity_sentence))
    if patronage:
        sentences.append(f"We ask {saint_name}'s intercession for {_spoken_list(patronage)}.")
    else:
        sentences.append(f"May {saint_name}'s witness strengthen us in faith.")
    novena_sentence = f"On Day {day} of the Novena to {saint_name}" if day else f"In the Novena to {saint_name}"
    sentences.append(f"{novena_sentence}, we bring our needs before the Lord.")
    sentences.append("Let us begin this novena in prayer.")
    return _normalize_whitespace(" ".join(sentences))


def _fallback_result(
    profile: DevotionalIntroProfile,
    context: Mapping[str, Any],
    reason: str,
) -> DevotionalIntroResult:
    text = _normalize_whitespace(_fallback_text(profile, context))
    return DevotionalIntroResult(
        text=text,
        profile=profile.key,
        policy_version=DEVOTIONAL_INTRO_POLICY_VERSION,
        source=SOURCE_FALLBACK_DETERMINISTIC,
        fallback_reason=_sanitize_fallback_reason(reason),
    )


def build_devotional_intro(
    profile: DevotionalIntroProfile | str,
    context: Mapping[str, Any],
    *,
    prompt_model: str = "",
    temperature: float = 0.4,
    generate_text_fn: Optional[IntroTextGenerator] = None,
) -> DevotionalIntroResult:
    resolved_profile = get_devotional_intro_profile(profile) if isinstance(profile, str) else profile
    model = resolve_openai_settings(model=prompt_model)[2]
    generator = generate_text_fn or _default_generate_text
    system = (
        "You are a Catholic devotional writer. Return only the finished spoken introduction "
        "as plain text, grounded exclusively in the supplied context."
    )
    first_error = ""
    for attempt in range(2):
        prompt = build_devotional_intro_prompt(
            resolved_profile,
            context,
            correction=first_error if attempt else "",
        )
        try:
            raw = generator(model, system, prompt, float(temperature))
            rendered = validate_devotional_intro(raw, resolved_profile, context)
            return DevotionalIntroResult(
                text=rendered,
                profile=resolved_profile.key,
                policy_version=DEVOTIONAL_INTRO_POLICY_VERSION,
                source=SOURCE_OPENAI,
            )
        except Exception as exc:
            first_error = _normalize_whitespace(exc) or exc.__class__.__name__
    return _fallback_result(resolved_profile, context, first_error or "Generation failed.")
