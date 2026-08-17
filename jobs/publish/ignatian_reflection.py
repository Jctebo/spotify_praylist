from __future__ import annotations

import os
import re
import sys
from dataclasses import asdict, dataclass
from typing import Any, Dict, Optional

from openai import OpenAI

from jobs.publish.daily_intro import OAI_MODEL, _normalize_whitespace, _resolve_openai_settings
from jobs.publish.daily_liturgical_context import SAINT_FALLBACK, DailyLiturgicalContext

WELCOME = "Welcome to Ora Pro Nobis, where we pray with the Saints."
FINAL_PEACE = "And may the peace of Christ remain with you."
SOURCE_GENERATED = "generated"
SOURCE_FALLBACK = "fallback"
DEFAULT_REFLECTION_PAUSE_MS = 15000


@dataclass(frozen=True)
class IgnatianReflectionEpisode:
    title: str
    text: str
    source: str
    fallback_reason: str = ""
    saint_name: str = SAINT_FALLBACK
    word_count: int = 0
    pause_ms: int = DEFAULT_REFLECTION_PAUSE_MS
    segments: tuple[str, ...] = ()

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def build_ignatian_reflection_episode(
    date_value,
    context: DailyLiturgicalContext,
    *,
    prompt_model: Optional[str] = None,
    pause_ms: int = DEFAULT_REFLECTION_PAUSE_MS,
) -> IgnatianReflectionEpisode:
    model = str(prompt_model or os.getenv(OAI_MODEL, "") or "gpt-4.1-mini").strip() or "gpt-4.1-mini"
    title = build_episode_title(date_value, context)
    try:
        text = _call_openai_reflection(model, _build_prompt(date_value, context, title))
        return _validate_episode(title, text, context, source=SOURCE_GENERATED, pause_ms=pause_ms)
    except Exception as exc:
        print(f"WARN ignatian_reflection using_deterministic_fallback detail={exc}", file=sys.stderr)
        fallback = deterministic_ignatian_reflection(date_value, context, title)
        return _validate_episode(
            title,
            fallback,
            context,
            source=SOURCE_FALLBACK,
            fallback_reason=str(exc),
            pause_ms=pause_ms,
        )


def build_episode_title(date_value, context: DailyLiturgicalContext) -> str:
    date_display = (
        f"{date_value.strftime('%B')} {date_value.day}, {date_value.year}"
        if hasattr(date_value, "strftime")
        else str(date_value)
    )
    theme = str(context.sharedThemeTitle or "").strip() or _title_case_theme(context.primaryTheme)
    return f"Daily Reflection - {theme} - {date_display}"


def _title_case_theme(value: str) -> str:
    return " ".join(part.capitalize() for part in str(value or "Trust").split())


def _saint_for_context(context: DailyLiturgicalContext) -> str:
    saint = str(getattr(context, "saintWitness", "") or context.saintOfDay or SAINT_FALLBACK).strip()
    saint = re.sub(r"^Saints?\s+", "", saint, flags=re.IGNORECASE).strip()
    return saint or "Ignatius of Loyola"


def _saint_quote_for_context(context: DailyLiturgicalContext) -> str:
    return str(getattr(context, "saintWitnessQuote", "") or "").strip()


def _build_prompt(date_value, context: DailyLiturgicalContext, title: str) -> str:
    payload = context.to_dict()
    return f"""
Write a Catholic Ignatian-style daily reflection prayer for audio narration.

Rules:
- Return plain text only, no markdown bullets.
- Write exactly four short paragraphs separated by blank lines.
- Do not use any section headings.
- Paragraph 1 must begin exactly with: {WELCOME}
- Paragraphs 1, 2, and 3 must each end with a question so the audio can pause after them.
- The reflection should be shorter and more spacious than before, with several contemplative pauses.
- Paragraph 1 should introduce the day's liturgical context naturally.
- When sharedGospelBridge or gospelCitation is present, explicitly ground Paragraph 1 in that Gospel context.
- Paragraph 2 should draw the day into ordinary life through the shared daily focus, saint, imagery, and emotional tone.
- Paragraph 2 must name the saint witness and include the supplied quotation exactly, explicitly attributing it to the saint before praying with the saint's intercession.
- Paragraph 3 should guide a brief examen with gratitude, reviewing the day, consolation/desolation, speaking with Jesus, and hope for tomorrow.
- Paragraph 4 should include the closing prayer and end exactly with these two final lines:
Saint {_saint_for_context(context)}, pray for us.
{FINAL_PEACE}
- Do not invent liturgical facts beyond the provided context.
- Keep the tone contemplative, intimate, and natural aloud.

Date: {date_value.isoformat()}
Episode title: {title}
Gospel bridge: {context.sharedGospelBridge or context.gospelCitation}
Shared helper context:
{payload}
""".strip()


def _call_openai_reflection(model: str, prompt: str) -> str:
    api_key, base_url, resolved_model = _resolve_openai_settings(model=model)
    if not api_key:
        raise RuntimeError("Missing OpenAI API key for Daily Reflection generation.")
    client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))
    response = client.responses.create(
        model=resolved_model or model,
        temperature=0.45,
        input=[
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": "Return reverent Catholic audio narration text only. No commentary.",
                    }
                ],
            },
            {"role": "user", "content": [{"type": "input_text", "text": _normalize_whitespace(prompt)}]},
        ],
    )
    text = str(getattr(response, "output_text", "") or "").strip()
    if not text:
        raise RuntimeError("Daily Reflection generation returned empty text.")
    return text


def deterministic_ignatian_reflection(date_value, context: DailyLiturgicalContext, title: str) -> str:
    saint = _saint_for_context(context)
    quote = _saint_quote_for_context(context)
    focus = context.sharedThemeReflectionFocus or context.reflectionFocus
    theme = context.sharedThemeTitle or context.primaryTheme
    tone = context.emotionalTone
    summary = context.sharedThemeExplanation or context.shortSummary
    feast_sentence = f"The Church's calendar gives us {context.feastDay} as a companion today." if context.feastDay else ""
    if context.sharedGospelBridge:
        gospel_sentence = f"In {context.sharedGospelBridge}, the Lord gives this day its Gospel shape."
    elif context.gospelCitation and context.gospelTheme:
        gospel_sentence = f"Today's Gospel, {context.gospelCitation}, draws us into {context.gospelTheme}."
    elif context.gospelTheme:
        gospel_sentence = f"The Gospel theme before us is {context.gospelTheme}."
    else:
        gospel_sentence = "The Church invites us to receive this day through the steady light of the liturgical season."
    quote_sentence = f'Saint {saint} teaches us, "{quote}"' if quote else f"With Saint {saint}, we ask the Lord to make this prayer concrete in our lives."
    reflection = f"""
{WELCOME} Today {summary.lower()} {feast_sentence} {gospel_sentence} We enter this prayer in a {tone} spirit and ask for the grace to notice God in ordinary life. What is the Lord already revealing in this day?

This day speaks through the saint's witness. {quote_sentence} It may have shown itself in a welcome, a delay, a small mercy, or a resistance you did not expect. {focus} Where did the saint's witness quietly touch your ordinary life today?

In the examen, let gratitude come first, then the review, then the places of consolation and desolation. Bring the day honestly before Jesus, and ask what faithful step he is asking of you tonight. Where is hope opening for tomorrow, and what does the Spirit want you to notice before tomorrow arrives?

Lord Jesus Christ, teach us to find you in the ordinary places of our lives. Give us the grace of {theme}, the honesty to notice your movements in our hearts, and the courage to follow where you gently lead. Amen.
Saint {saint}, pray for us.
{FINAL_PEACE}
""".strip()
    return reflection


def _validate_episode(
    title: str,
    text: str,
    context: DailyLiturgicalContext,
    *,
    source: str,
    fallback_reason: str = "",
    pause_ms: int = DEFAULT_REFLECTION_PAUSE_MS,
) -> IgnatianReflectionEpisode:
    cleaned = _clean_text(text)
    if not cleaned:
        raise RuntimeError("Daily Reflection text is empty.")
    for heading in (
        "Episode Title",
        "Opening Welcome",
        "Liturgical Context Introduction",
        "Ignatian Reflection",
        "Guided Examen",
        "Closing Prayer",
        "Final Closing",
    ):
        if re.search(rf"(?m)^\s*{re.escape(heading)}\s*$", cleaned):
            raise RuntimeError(f"Daily Reflection should not speak the '{heading}' heading.")
    if WELCOME not in cleaned:
        raise RuntimeError("Daily Reflection opening welcome is missing.")
    if not cleaned.rstrip().endswith(FINAL_PEACE):
        raise RuntimeError("Daily Reflection final peace line is missing.")
    saint = _saint_for_context(context)
    quote = _saint_quote_for_context(context)
    saint_line = f"Saint {saint}, pray for us."
    if saint_line not in cleaned:
        raise RuntimeError("Daily Reflection saint closing is missing.")
    saint_mentions = len(re.findall(rf"\b{re.escape(saint)}\b", cleaned, flags=re.IGNORECASE))
    if saint_mentions < 2:
        raise RuntimeError("Daily Reflection must materially mention the saint beyond the closing invocation.")
    if quote and quote not in cleaned:
        raise RuntimeError("Daily Reflection approved saint quotation is missing.")
    for phrase in ("gratitude", "consolation", "desolation", "Jesus", "hope"):
        if phrase.lower() not in cleaned.lower():
            raise RuntimeError(f"Daily Reflection examen is missing '{phrase}'.")
    paragraphs = _spoken_paragraphs(cleaned)
    if len(paragraphs) != 4:
        raise RuntimeError(f"Daily Reflection must contain exactly 4 spoken paragraphs, got {len(paragraphs)}.")
    if not paragraphs[0].startswith(WELCOME):
        raise RuntimeError("Daily Reflection opening paragraph must begin with the welcome.")
    for index, paragraph in enumerate(paragraphs[:3], start=1):
        if not paragraph.rstrip().endswith("?"):
            raise RuntimeError(f"Daily Reflection paragraph {index} must end with a question before the pause.")
    spoken_body = " ".join(paragraphs[:3])
    reflection_word_count = len(re.findall(r"\b[\w']+\b", spoken_body))
    if not 100 <= reflection_word_count <= 350:
        raise RuntimeError(f"Daily Reflection spoken body word count out of range: {reflection_word_count}.")
    return IgnatianReflectionEpisode(
        title=title,
        text=cleaned,
        source=source,
        fallback_reason=fallback_reason,
        saint_name=saint,
        word_count=reflection_word_count,
        pause_ms=int(pause_ms or DEFAULT_REFLECTION_PAUSE_MS),
        segments=tuple(paragraphs),
    )


def _clean_text(text: Any) -> str:
    lines = [_normalize_whitespace(line) for line in str(text or "").splitlines()]
    result = []
    previous_blank = False
    for line in lines:
        if not line:
            if not previous_blank and result:
                result.append("")
            previous_blank = True
            continue
        result.append(line)
        previous_blank = False
    return "\n".join(result).strip()


def _spoken_paragraphs(text: str) -> list[str]:
    paragraphs = [part.strip() for part in re.split(r"\n{2,}", str(text or "").strip()) if part.strip()]
    return paragraphs
