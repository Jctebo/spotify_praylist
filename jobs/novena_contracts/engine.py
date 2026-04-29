from __future__ import annotations

import os
import re
from difflib import SequenceMatcher
from typing import Any, Callable, Dict, List, Mapping, Optional, Sequence, Tuple

from openai import OpenAI

from jobs.publish.formatting import render_publish_template

from .contracts import NovenaRuntime, TemplateFragment, TemplateSection


OPENAI_API_KEY = "OPENAI_API_KEY"
OAI_API_BASE_URL = "OAI_API_BASE_URL"
OAI_MODEL = "OAI_MODEL"


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").replace("\u00a0", " ")).strip()


def _looks_like_prompt_echo(text: str, prompt_text: str, user_prompt_text: str) -> bool:
    normalized = _normalize_whitespace(text)
    if not normalized:
        return True
    lowered = normalized.lower()
    prompt_lower = _normalize_whitespace(prompt_text).lower()
    user_lower = _normalize_whitespace(user_prompt_text).lower()
    if prompt_lower and lowered == prompt_lower:
        return True
    if user_lower and lowered == user_lower:
        return True
    if prompt_lower and prompt_lower in lowered:
        return True
    if user_lower and user_lower in lowered:
        return True
    if prompt_lower:
        ratio = SequenceMatcher(None, lowered, prompt_lower).ratio()
        if ratio >= 0.62 and len(lowered) <= max(len(prompt_lower), 1) * 2:
            return True
    if user_lower:
        ratio = SequenceMatcher(None, lowered, user_lower).ratio()
        if ratio >= 0.55 and len(lowered) <= max(len(user_lower), 1) * 2:
            return True
    return False


def _normalize_day_list(days: Sequence[Any]) -> Tuple[int, ...]:
    normalized: List[int] = []
    for value in days:
        try:
            day = int(value)
        except Exception:
            continue
        if day > 0 and day not in normalized:
            normalized.append(day)
    return tuple(sorted(normalized))


def _format_day_span(days: Sequence[int]) -> str:
    normalized = _normalize_day_list(days)
    if not normalized:
        return ""
    spans: List[str] = []
    start = normalized[0]
    previous = normalized[0]
    for day in normalized[1:]:
        if day == previous + 1:
            previous = day
            continue
        spans.append(f"{start}-{previous}" if start != previous else f"{start}")
        start = previous = day
    spans.append(f"{start}-{previous}" if start != previous else f"{start}")
    return ", ".join(spans)


def _openai_client() -> OpenAI:
    api_key = os.getenv(OPENAI_API_KEY, "").strip()
    if not api_key:
        raise RuntimeError("Missing required environment variable: OPENAI_API_KEY")
    base_url = os.getenv(OAI_API_BASE_URL, "https://api.openai.com/v1").strip() or "https://api.openai.com/v1"
    return OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))


def generate_text(prompt: str, context: Mapping[str, Any]) -> str:
    prompt_text = _normalize_whitespace(prompt)
    if not prompt_text:
        raise RuntimeError("Novena prompt rendered empty text.")
    model = str(os.getenv(OAI_MODEL, "") or "gpt-4.1-mini").strip() or "gpt-4.1-mini"
    saint_name = _normalize_whitespace(context.get("saint_name", ""))
    feast_name = _normalize_whitespace(context.get("feast_name", ""))
    day = _normalize_whitespace(context.get("day", ""))
    theme = _normalize_whitespace(context.get("theme", ""))
    client = _openai_client()
    system_prompt = (
        "You are a Catholic devotional writer for a novena podcast. "
        "Return only the finished devotional prose. "
        "Do not repeat the prompt, do not quote instructions, and do not add commentary."
    )
    user_prompt = "\n".join(
        line
        for line in (
            f"Saint: {saint_name}" if saint_name else "",
            f"Feast: {feast_name}" if feast_name else "",
            f"Day: {day}" if day else "",
            f"Theme: {theme}" if theme else "",
            "",
            "Write the devotional section requested below:",
            prompt_text,
        )
        if line or line == ""
    ).strip()
    user_prompt_text = _normalize_whitespace(user_prompt)
    try:
        response = client.responses.create(
            model=model,
            temperature=0,
            input=[
                {"role": "system", "content": [{"type": "input_text", "text": system_prompt}]},
                {"role": "user", "content": [{"type": "input_text", "text": user_prompt}]},
            ],
        )
        text = _normalize_whitespace(str(getattr(response, "output_text", "") or ""))
        if text and not _looks_like_prompt_echo(text, prompt_text, user_prompt_text):
            return text
    except Exception:
        pass

    chat = client.chat.completions.create(
        model=model,
        temperature=0,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    choices = getattr(chat, "choices", None) or []
    if not choices:
        raise RuntimeError("Novena generation returned no choices.")
    text = _normalize_whitespace(str(getattr(getattr(choices[0], "message", None), "content", "") or ""))
    if not text:
        raise RuntimeError("Novena generation returned empty text.")
    if _looks_like_prompt_echo(text, prompt_text, user_prompt_text):
        raise RuntimeError("Novena generation echoed the prompt instead of returning devotional text.")
    return text


def _section_to_fragment(runtime: NovenaRuntime, section: Dict[str, Any], *, index: int) -> Dict[str, Any]:
    episode_id = f"{runtime.date.isoformat()}-{runtime.contract_id}-day-{runtime.active_day}"
    return {
        "fragment_key": f"{episode_id}/section-{index}-{section['key']}",
        "block_path": f"section-{index}-{section['key']}",
        "kind": section["kind"],
        "label": section["title"],
        "text": section["text"],
    }


def _intro_fragment(runtime: NovenaRuntime, context: Mapping[str, Any]) -> Dict[str, Any]:
    episode_id = f"{runtime.date.isoformat()}-{runtime.contract_id}-day-{runtime.active_day}"
    saint_name = str(context.get("saint_name", runtime.saint.get("name", runtime.contract_id))).strip()
    title = f"Welcome to Day {runtime.active_day}"
    return {
        "fragment_key": f"{episode_id}/intro",
        "block_path": "intro",
        "kind": "fixed",
        "label": title,
        "text": f"Welcome to Day {runtime.active_day} of the Novena to {saint_name}.",
    }


def _render_template_section(
    section: TemplateSection,
    context: Mapping[str, Any],
    *,
    generate_text_fn: Callable[[str, Mapping[str, Any]], str],
) -> str:
    if section.kind == "fixed":
        return render_publish_template(section.text, context).strip()
    if section.kind == "generated":
        prompt = render_publish_template(section.prompt, context)
        return generate_text_fn(prompt, context).strip()
    raise RuntimeError(f"Unsupported novena section kind '{section.kind}'.")


def _section_fragment_from_template(
    runtime: NovenaRuntime,
    section: TemplateSection,
    context: Mapping[str, Any],
    *,
    generate_text_fn: Callable[[str, Mapping[str, Any]], str],
) -> Optional[Dict[str, Any]]:
    days = _normalize_day_list(section.days or ())
    if days and runtime.active_day not in days:
        return None
    if not days:
        return None
    episode_id = f"{runtime.date.isoformat()}-{runtime.contract_id}-day-{runtime.active_day}"
    label = section.title or section.key or "Section"
    if len(days) > 1:
        label = f"Days {_format_day_span(days)}"
    text = _render_template_section(section, context, generate_text_fn=generate_text_fn)
    return {
        "fragment_key": f"{episode_id}/block-{section.key}",
        "block_path": f"block-{section.key}",
        "kind": section.kind,
        "label": label,
        "text": text,
        "days": list(days),
    }


def _fragment_lookup(runtime: NovenaRuntime) -> Dict[str, TemplateFragment]:
    lookup: Dict[str, TemplateFragment] = {}
    for fragment in runtime.resolved_template.fragments or ():
        if fragment.key:
            lookup[fragment.key] = fragment
    return lookup


def _part_repeat_count(part: Mapping[str, Any]) -> int:
    try:
        repeat = int(part.get("repeat", 1) or 1)
    except Exception:
        repeat = 1
    return repeat if repeat > 0 else 1


def _render_part_text(
    part: Mapping[str, Any],
    context: Mapping[str, Any],
    fragment_lookup: Mapping[str, TemplateFragment],
) -> Tuple[str, str]:
    part_kind = str(part.get("kind", "")).strip().lower()
    if part_kind == "fragment":
        fragment_key = str(part.get("fragment_key", "")).strip()
        fragment = fragment_lookup.get(fragment_key)
        if fragment is None:
            raise RuntimeError(f"Missing canonical fragment reference '{fragment_key}'.")
        label = str(part.get("label", "")).strip() or fragment.title or fragment.key
        text = render_publish_template(fragment.text, context).strip()
        return label or fragment.key or fragment_key, text
    label = str(part.get("label", "")).strip() or str(part.get("title", "")).strip() or "Text"
    return label, render_publish_template(str(part.get("text", "")).strip(), context).strip()


def _block_parts_to_fragments(
    runtime: NovenaRuntime,
    block: TemplateSection,
    context: Mapping[str, Any],
    fragment_lookup: Mapping[str, TemplateFragment],
) -> List[Dict[str, Any]]:
    days = _normalize_day_list(block.days or ())
    episode_id = f"{runtime.date.isoformat()}-{runtime.contract_id}-day-{runtime.active_day}"
    fragments: List[Dict[str, Any]] = []
    parts = list(block.parts or ())
    for part_index, part in enumerate(parts, start=1):
        label, text = _render_part_text(part, context, fragment_lookup)
        repeat = _part_repeat_count(part)
        part_kind = str(part.get("kind", "")).strip().lower()
        source_fragment_key = str(part.get("fragment_key", "")).strip() if part_kind == "fragment" else ""
        for repeat_index in range(1, repeat + 1):
            fragment_key = f"{episode_id}/block-{block.key}/part-{part_index}"
            if repeat > 1:
                fragment_key = f"{fragment_key}/repeat-{repeat_index}"
            fragments.append(
                {
                    "fragment_key": fragment_key,
                    "block_path": f"block-{block.key}/part-{part_index}",
                    "kind": part_kind or block.kind,
                    "label": label,
                    "text": text,
                    "days": list(days),
                    "repeat_index": repeat_index,
                    "repeat_count": repeat,
                    "source_fragment_key": source_fragment_key,
                }
            )
    return fragments


def render_novena(
    runtime: NovenaRuntime,
    *,
    generate_text_fn: Callable[[str, Mapping[str, Any]], str] = generate_text,
) -> Dict[str, Any]:
    context = runtime_context(runtime)
    rendered_sections: List[Dict[str, Any]] = []
    for index, section in enumerate(runtime.resolved_template.sections, start=1):
        text = _render_template_section(section, context, generate_text_fn=generate_text_fn)
        rendered_sections.append(
            {
                "key": section.key,
                "title": section.title,
                "kind": section.kind,
                "text": text.strip(),
            }
        )
    compact_blocks = list(runtime.resolved_template.blocks or ())
    fragment_lookup = _fragment_lookup(runtime)
    audio_fragments: List[Dict[str, Any]] = []
    if compact_blocks and any(_normalize_day_list(block.days or ()) for block in compact_blocks):
        audio_fragments.append(_intro_fragment(runtime, context))
        for block in compact_blocks:
            if block.parts:
                audio_fragments.extend(_block_parts_to_fragments(runtime, block, context, fragment_lookup))
            else:
                fragment = _section_fragment_from_template(runtime, block, context, generate_text_fn=generate_text_fn)
                if fragment is not None:
                    audio_fragments.append(fragment)
    else:
        audio_fragments = [_section_to_fragment(runtime, section, index=index) for index, section in enumerate(rendered_sections, start=1)]
    text_body = "\n\n".join(fragment["text"] for fragment in audio_fragments if str(fragment.get("text", "")).strip()).strip()
    return {
        "family_id": runtime.family_id,
        "contract_id": runtime.contract_id,
        "date": runtime.date.isoformat(),
        "active_day": runtime.active_day,
        "saint": dict(runtime.saint),
        "feast": dict(runtime.feast),
        "novena": dict(runtime.novena),
        "template": runtime.resolved_template.to_dict(),
        "context": context,
        "content": {
            "sections": rendered_sections,
            "text": text_body,
        },
        "audio_fragments": audio_fragments,
    }


def runtime_context(runtime: NovenaRuntime) -> Dict[str, Any]:
    themes = list(runtime.novena.get("ai_config", {}).get("themes") or [])
    theme = themes[(runtime.active_day - 1) % len(themes)] if themes else runtime.feast.get("name", runtime.saint.get("name", runtime.contract_id))
    saint_name = str(runtime.saint.get("name", runtime.contract_id)).strip()
    feast_name = str(runtime.feast.get("name", runtime.contract_id)).strip()
    context = {
        "family_id": runtime.family_id,
        "day": runtime.active_day,
        "active_day": runtime.active_day,
        "novena_day": runtime.active_day,
        "saint_id": runtime.saint.get("id", runtime.contract_id),
        "saint_name": saint_name,
        "saint": dict(runtime.saint),
        "feast_name": feast_name,
        "feast": dict(runtime.feast),
        "theme": theme,
        "themes": themes,
        "themes_text": ", ".join(str(item).strip() for item in themes if str(item).strip()),
        "date": runtime.date,
        "date_iso": runtime.date.isoformat(),
        "date_display": f"{runtime.date:%B} {runtime.date.day}, {runtime.date:%Y}",
        "date_long": f"{runtime.date:%A, %B} {runtime.date.day}, {runtime.date:%Y}",
        "year": runtime.date.year,
        "month": runtime.date.month,
        "date_day": runtime.date.day,
        "weekday": runtime.date.strftime("%A").lower(),
        "weekday_name": runtime.date.strftime("%A"),
        "month_name": runtime.date.strftime("%B"),
        "contract_id": runtime.contract_id,
    }
    return context
