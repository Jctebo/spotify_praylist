from __future__ import annotations

import datetime as _dt
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
    saint = str(getattr(context, "saintWitness", "") or context.saintOfDay or "").strip()
    if not saint:
        return ""
    saint = re.sub(r"^Saints?\s+", "", saint, flags=re.IGNORECASE).strip()
    return saint


def _saint_quote_for_context(context: DailyLiturgicalContext) -> str:
    return str(getattr(context, "saintWitnessQuote", "") or "").strip()


def _build_prompt(date_value, context: DailyLiturgicalContext, title: str) -> str:
    payload = context.to_dict()
    return f"""
Write a Catholic daily reflection prayer for audio narration, using the selected liturgical observance as a spiritual lens for ordinary Christian life.

Rules:
- Return plain text only, no markdown bullets.
- Write exactly four short paragraphs separated by blank lines.
- Do not use any section headings.
- Paragraph 1 must begin exactly with: {WELCOME}
- Keep the reflection concise, spacious, contemplative, and natural aloud. Use questions, examen language, and pauses where they serve the prayer, without forcing identical sentence patterns.
- Paragraph 1 should introduce the selected observance naturally and distinguish whether it is celebrated today or approaching. If it is upcoming, include its actual date and never call it today's celebration.
- When sharedGospelBridge or gospelCitation is present, use the supplied Gospel context when it genuinely supports the reflection, but do not introduce another Scripture citation.
- Paragraph 2 should identify one central spiritual theme from the observance and draw it into ordinary Christian life through prayer, relationships, work, family, vocation, stewardship, health, rest, charity, conversion, perseverance, trust, or fidelity to ordinary responsibilities.
- Do not give a long biography. Use the saint or feast as a spiritual guide, not merely a historical subject, and do not force a weak connection.
- Paragraph 3 should guide prayerful reflection or examen toward interior life, gratitude, conversion, trust in God, and a faithful next step. Let the content determine whether questions or explicit consolation/desolation language are helpful.
- Paragraph 4 should contain a natural closing prayer and end exactly with:
{FINAL_PEACE}
- If a saint witness is supplied, it may be named naturally and may receive a final intercession. A quotation is optional; never invent one or require one merely because legacy context contains it.
- Do not invent liturgical facts beyond the provided context.
- Keep the tone contemplative, intimate, and natural aloud.

Date: {date_value.isoformat()}
Episode title: {title}
Gospel bridge: {context.sharedGospelBridge or context.gospelCitation}
Selected observance: {context.feastDay}
Selected observance date: {getattr(context, 'primaryAnchorDate', '')}
Selected observance rank: {getattr(context, 'primaryAnchorRank', '') or context.liturgicalRank}
Selected observance timing: {getattr(context, 'primaryAnchorTiming', '')}
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
    anchor_date = str(getattr(context, "primaryAnchorDate", "") or "").strip()
    try:
        parsed_anchor_date = _dt.date.fromisoformat(anchor_date)
        anchor_display = f"{parsed_anchor_date.strftime('%B')} {parsed_anchor_date.day}, {parsed_anchor_date.year}"
    except (ValueError, TypeError):
        anchor_display = anchor_date
    if context.feastDay and getattr(context, "primaryAnchorTiming", "") == "upcoming":
        feast_sentence = f"As we approach {context.feastDay} on {anchor_display}, the Church gives us this observance as a companion."
    elif context.feastDay:
        feast_sentence = f"The Church's calendar gives us {context.feastDay} as a companion today."
    else:
        feast_sentence = ""
    if context.sharedGospelBridge:
        gospel_sentence = f"In {context.sharedGospelBridge}, the Lord gives this day its Gospel shape."
    elif context.gospelCitation and context.gospelTheme:
        gospel_sentence = f"Today's Gospel, {context.gospelCitation}, draws us into {context.gospelTheme}."
    elif context.gospelTheme:
        gospel_sentence = f"The Gospel theme before us is {context.gospelTheme}."
    else:
        gospel_sentence = "The Church invites us to receive this day through the steady light of the liturgical season."
    quote_sentence = f'Saint {saint} teaches us, "{quote}"' if quote else f"With Saint {saint}, we ask the Lord to make this prayer concrete in our lives." if saint else "We ask the Lord to make this observance concrete in our lives."
    saint_sentence = f"Saint {saint}, pray for us.\n" if saint else ""
    witness_subject = f"Saint {saint}'s witness" if saint else "the Church's observance"
    reflection = f"""
{WELCOME} {summary} {feast_sentence} {gospel_sentence} We enter this prayer in a {tone} spirit and ask for the grace to notice God in ordinary life. What is the Lord already revealing in this day?

This day speaks through {witness_subject}. {quote_sentence} It may have shown itself in a welcome, a delay, a small mercy, or a resistance you did not expect. {focus} Where did this observance quietly touch your ordinary life today?

In the examen, let gratitude come first, then the review, then the places of consolation and desolation. Bring the day honestly before Jesus, and ask what faithful step he is asking of you tonight. Where is hope opening for tomorrow, and what does the Spirit want you to notice before tomorrow arrives?

Lord Jesus Christ, teach us to find you in the ordinary places of our lives. Give us the grace of {theme}, the honesty to notice your movements in our hearts, and the courage to follow where you gently lead. Amen.
{saint_sentence}{FINAL_PEACE}
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
    selected = str(getattr(context, "feastDay", "") or "").strip()
    if selected and selected.casefold() not in cleaned.casefold():
        raise RuntimeError("Daily Reflection must identify the selected observance.")
    if saint:
        saint_mentions = len(re.findall(rf"\b{re.escape(saint)}\b", cleaned, flags=re.IGNORECASE))
        if saint_mentions < 1:
            raise RuntimeError("Daily Reflection must use the supplied saint naturally when present.")
    paragraphs = _spoken_paragraphs(cleaned)
    if len(paragraphs) != 4:
        raise RuntimeError(f"Daily Reflection must contain exactly 4 spoken paragraphs, got {len(paragraphs)}.")
    if not paragraphs[0].startswith(WELCOME):
        raise RuntimeError("Daily Reflection opening paragraph must begin with the welcome.")
    spoken_body = " ".join(paragraphs[:3])
    reflection_word_count = len(re.findall(r"\b[\w']+\b", spoken_body))
    if not 80 <= reflection_word_count <= 400:
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
