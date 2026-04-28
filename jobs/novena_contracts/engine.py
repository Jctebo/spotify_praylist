from __future__ import annotations

from typing import Any, Callable, Dict, List, Mapping, Sequence

from jobs.publish.formatting import render_publish_template

from .contracts import NovenaRuntime, TemplateSection


def generate_text(prompt: str, context: Mapping[str, Any]) -> str:
    prompt_text = " ".join(str(prompt or "").split())
    saint_name = str(context.get("saint_name", "")).strip()
    theme = str(context.get("theme", "")).strip()
    day = str(context.get("day", "")).strip()
    pieces = [prompt_text]
    if saint_name:
        pieces.append(f"For {saint_name}.")
    if day:
        pieces.append(f"Day {day}.")
    if theme:
        pieces.append(f"Theme: {theme}.")
    return " ".join(piece for piece in pieces if piece).strip()


def _section_to_fragment(runtime: NovenaRuntime, section: Dict[str, Any], *, index: int) -> Dict[str, Any]:
    episode_id = f"{runtime.date.isoformat()}-{runtime.contract_id}-day-{runtime.active_day}"
    return {
        "fragment_key": f"{episode_id}/section-{index}-{section['key']}",
        "block_path": f"section-{index}-{section['key']}",
        "kind": section["kind"],
        "label": section["title"],
        "text": section["text"],
    }


def render_novena(
    runtime: NovenaRuntime,
    *,
    generate_text_fn: Callable[[str, Mapping[str, Any]], str] = generate_text,
) -> Dict[str, Any]:
    context = runtime_context(runtime)
    rendered_sections: List[Dict[str, Any]] = []
    for index, section in enumerate(runtime.resolved_template.sections, start=1):
        if section.kind == "fixed":
            text = render_publish_template(section.text, context)
        elif section.kind == "generated":
            prompt = render_publish_template(section.prompt, context)
            text = generate_text_fn(prompt, context)
        else:
            raise RuntimeError(f"Unsupported novena section kind '{section.kind}'.")
        rendered_sections.append(
            {
                "key": section.key,
                "title": section.title,
                "kind": section.kind,
                "text": text.strip(),
            }
        )
    fragments = [_section_to_fragment(runtime, section, index=index) for index, section in enumerate(rendered_sections, start=1)]
    text_body = "\n\n".join(section["text"] for section in rendered_sections if str(section.get("text", "")).strip()).strip()
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
        "audio_fragments": fragments,
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
