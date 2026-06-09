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


@dataclass(frozen=True)
class IgnatianReflectionEpisode:
    title: str
    text: str
    source: str
    fallback_reason: str = ""
    saint_name: str = SAINT_FALLBACK
    word_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def build_ignatian_reflection_episode(
    date_value,
    context: DailyLiturgicalContext,
    *,
    prompt_model: Optional[str] = None,
) -> IgnatianReflectionEpisode:
    model = str(prompt_model or os.getenv(OAI_MODEL, "") or "gpt-4.1-mini").strip() or "gpt-4.1-mini"
    title = build_episode_title(date_value, context)
    try:
        text = _call_openai_reflection(model, _build_prompt(date_value, context, title))
        return _validate_episode(title, text, context, source=SOURCE_GENERATED)
    except Exception as exc:
        print(f"WARN ignatian_reflection using_deterministic_fallback detail={exc}", file=sys.stderr)
        fallback = deterministic_ignatian_reflection(date_value, context, title)
        return _validate_episode(title, fallback, context, source=SOURCE_FALLBACK, fallback_reason=str(exc))


def build_episode_title(date_value, context: DailyLiturgicalContext) -> str:
    date_display = (
        f"{date_value.strftime('%B')} {date_value.day}, {date_value.year}"
        if hasattr(date_value, "strftime")
        else str(date_value)
    )
    theme = _title_case_theme(context.primaryTheme)
    return f"Daily Reflection - {theme} - {date_display}"


def _title_case_theme(value: str) -> str:
    return " ".join(part.capitalize() for part in str(value or "Trust").split())


def _saint_for_context(context: DailyLiturgicalContext) -> str:
    saint = str(context.saintOfDay or SAINT_FALLBACK).strip()
    saint = re.sub(r"^Saints?\s+", "", saint, flags=re.IGNORECASE).strip()
    return saint or "Ignatius of Loyola"


def _build_prompt(date_value, context: DailyLiturgicalContext, title: str) -> str:
    payload = context.to_dict()
    return f"""
Write a Catholic Ignatian-style daily reflection prayer for audio narration.

Rules:
- Return plain text only, no markdown bullets.
- Use these exact section headings: Episode Title, Opening Welcome, Liturgical Context Introduction, Ignatian Reflection, Guided Examen, Closing Prayer, Final Closing.
- Opening Welcome must begin exactly with: {WELCOME}
- Ignatian Reflection must be 500-900 words, contemplative, personal, emotionally grounded, and suitable over soft background music.
- Guided Examen must include gratitude, reviewing the day, consolation/desolation, speaking with Jesus, and hope for tomorrow.
- Final Closing must end exactly with these two final lines:
Saint {_saint_for_context(context)}, pray for us.
{FINAL_PEACE}
- Do not invent liturgical facts beyond the provided context.

Date: {date_value.isoformat()}
Episode title: {title}
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
    focus = context.reflectionFocus
    theme = context.primaryTheme
    tone = context.emotionalTone
    summary = context.shortSummary
    feast_sentence = (
        f"The Church's calendar gives us {context.feastDay} as a particular companion today. "
        if context.feastDay
        else ""
    )
    gospel_sentence = (
        f"The Gospel theme before us is {context.gospelTheme}. "
        if context.gospelTheme
        else "The Church invites us to receive this day through the steady light of the liturgical season. "
    )
    reflection = f"""
Episode Title
{title}

Opening Welcome
{WELCOME}

Liturgical Context Introduction
{summary} {feast_sentence}{gospel_sentence}We enter this prayer in a {tone} spirit, asking for the grace to notice God in ordinary life.

Ignatian Reflection
Begin by becoming still. Let the day come before God without hurry. You do not need to improve it before you offer it. You do not need to explain it perfectly. You only need to bring the truth of your life into the presence of Jesus, who already knows you with tenderness.

Today the Church gives us the theme of {theme}. This is not an abstract idea. It is a grace that can become visible in small places: in the first words you speak when you are tired, in the way you receive an interruption, in the silence after a disappointment, in the simple choice to begin again. Ignatian prayer asks us to notice these places. It asks us to trust that God is not only found in dramatic moments, but also in the hidden movements of the heart.

Consider where this theme has touched your life today. Perhaps {theme} appeared as an invitation you welcomed. Perhaps it appeared as a resistance inside you. Perhaps you noticed yourself wanting control, approval, speed, or certainty. Do not judge that movement too quickly. In the examen, even resistance can become a doorway. It can show you where you are afraid. It can show you where Jesus is gently asking to be trusted.

{focus} Stay with that invitation for a moment. Imagine Christ looking at the ordinary rooms of your day: the work left unfinished, the people you carried in your mind, the words you wish you had spoken differently, the small mercies you almost missed. His gaze is not harsh. His gaze tells the truth and restores the soul.

If there was consolation today, receive it again. Consolation may have been peace, courage, gratitude, clarity, or a quiet desire for God. It may have been very small, like a breath of patience before answering someone, or a moment when beauty interrupted your worry. Let that gift become prayer. Say simply, Lord, I noticed this. Thank you.

If there was desolation today, bring that too. Desolation may have been heaviness, isolation, resentment, distraction, or a shrinking of hope. Place it near Jesus without pretending it was something else. Ask him what he wants you to see there. Sometimes the grace is not to solve the whole sorrow, but to learn that you were not alone inside it.

The Gospel always draws faith into life. It does not leave us as spectators. It asks for a response in the concrete shape of tomorrow. So listen gently: where is the next faithful step? Not the perfect step. Not the grand gesture. The next faithful step. It may be an apology, a patient beginning, a hidden act of service, a simpler schedule, a few minutes of prayer before reaching for noise.

Let your heart answer God in its own words. If you feel grateful, speak gratitude. If you feel empty, speak emptiness. If you feel unsure, speak honestly. Jesus is not waiting for a polished prayer. He is waiting for you.

Guided Examen
First, give thanks. Name one gift from this day, however small, and let it rest in God's hands.

Now review the day. Move gently from morning to evening. Notice where you were present, where you were hurried, where love was easy, and where love became difficult.

Notice consolation and desolation. Where did your heart move toward faith, hope, and charity? Where did it move toward fear, resentment, or discouragement?

Speak with Jesus as with a friend. Tell him what you noticed. Ask forgiveness where you need mercy. Ask for light where you need discernment. Ask for courage where tomorrow feels heavy.

Finally, look toward tomorrow with hope. Choose one small grace to ask for, one faithful step to take, and one person to carry in prayer.

Closing Prayer
Lord Jesus Christ, teach us to find you in the ordinary places of our lives. Give us the grace of {theme}, the honesty to notice your movements in our hearts, and the courage to follow where you gently lead. Amen.

Final Closing
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
) -> IgnatianReflectionEpisode:
    cleaned = _clean_text(text)
    if not cleaned:
        raise RuntimeError("Daily Reflection text is empty.")
    if WELCOME not in cleaned:
        raise RuntimeError("Daily Reflection opening welcome is missing.")
    if not cleaned.rstrip().endswith(FINAL_PEACE):
        raise RuntimeError("Daily Reflection final peace line is missing.")
    saint = _saint_for_context(context)
    saint_line = f"Saint {saint}, pray for us."
    if saint_line not in cleaned:
        raise RuntimeError("Daily Reflection saint closing is missing.")
    for phrase in ("gratitude", "consolation", "desolation", "Jesus", "hope"):
        if phrase.lower() not in cleaned.lower():
            raise RuntimeError(f"Daily Reflection examen is missing '{phrase}'.")
    reflection_word_count = _section_word_count(cleaned, "Ignatian Reflection", "Guided Examen")
    if not 500 <= reflection_word_count <= 900:
        raise RuntimeError(f"Daily Reflection Ignatian Reflection word count out of range: {reflection_word_count}.")
    return IgnatianReflectionEpisode(
        title=title,
        text=cleaned,
        source=source,
        fallback_reason=fallback_reason,
        saint_name=saint,
        word_count=reflection_word_count,
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


def _section_word_count(text: str, start_heading: str, end_heading: str) -> int:
    pattern = re.compile(
        rf"{re.escape(start_heading)}\n(.*?)\n\n{re.escape(end_heading)}",
        flags=re.DOTALL | re.IGNORECASE,
    )
    match = pattern.search(text)
    if not match:
        raise RuntimeError(f"Daily Reflection is missing '{start_heading}' section.")
    return len(re.findall(r"\b[\w']+\b", match.group(1)))
