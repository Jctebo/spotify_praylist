"""Validated, private contracts for Responses API devotional infographics."""

from __future__ import annotations

import base64
import json
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Iterable, List


@dataclass(frozen=True)
class InfographicCopy:
    title: str
    subtitle: str = ""
    feast_day: str = ""
    sections: Dict[str, List[str]] = field(default_factory=dict)
    spiritual_themes: List[str] = field(default_factory=list)
    footer: str = ""
    sources: List[Dict[str, str]] = field(default_factory=list)

    def validate(self) -> None:
        if not self.title.strip():
            raise RuntimeError("Infographic copy requires a title.")
        if len(self.spiritual_themes) not in (0, 3):
            raise RuntimeError("Infographic copy must contain exactly three spiritual themes when supplied.")
        for heading, bullets in self.sections.items():
            if not heading.strip() or not isinstance(bullets, list) or len(bullets) > 3:
                raise RuntimeError("Each infographic section requires a heading and at most three bullets.")
            if any(not str(bullet).strip() for bullet in bullets):
                raise RuntimeError("Infographic bullets must not be blank.")

    def to_private_json(self) -> str:
        self.validate()
        return json.dumps(asdict(self), indent=2, sort_keys=True)


def extract_response_image_bytes(response: Any) -> bytes:
    """Extract an image-generation tool result without relying on SDK object types."""
    output: Iterable[Any] = getattr(response, "output", None) or []
    for item in output:
        item_type = getattr(item, "type", "") or (item.get("type", "") if isinstance(item, dict) else "")
        if item_type not in {"image_generation_call", "image_generation"}:
            continue
        result = getattr(item, "result", "") or (item.get("result", "") if isinstance(item, dict) else "")
        if result:
            return base64.b64decode(str(result))
    raise RuntimeError("Responses image generation returned no image result.")


def response_image_tool(*, size: str, quality: str) -> Dict[str, str]:
    """Return the current Responses API image-generation tool declaration."""
    return {"type": "image_generation", "size": size, "quality": quality, "input_fidelity": "high"}


def infographic_render_prompt(copy: InfographicCopy, *, subject_context: str) -> str:
    """Render only approved structured copy in the established devotional series."""
    copy.validate()
    sections = "\n".join(
        f"{heading}:\n" + "\n".join(f"- {bullet}" for bullet in bullets)
        for heading, bullets in copy.sections.items()
    )
    return (
        "Create a polished vertical Catholic devotional infographic using the supplied image as the master style reference. "
        "Preserve its ivory parchment, deep navy, antique-gold border, centered devotional portrait, organized panels, "
        "and Spiritual Themes footer. Render only the approved copy below; do not invent facts, quotations, dates, or patronage.\n\n"
        f"TITLE: {copy.title}\nSUBTITLE: {copy.subtitle}\nFEAST DAY: {copy.feast_day}\n"
        f"SECTIONS:\n{sections}\nSPIRITUAL THEMES: {' | '.join(copy.spiritual_themes)}\nFOOTER: {copy.footer}\n"
        f"SUBJECT CONTEXT:\n{subject_context}"
    )


def parse_infographic_copy(text: str) -> InfographicCopy:
    """Parse and validate the text-stage source of truth before image rendering."""
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Infographic research response must be valid JSON.") from exc
    if not isinstance(payload, dict):
        raise RuntimeError("Infographic research response must be a JSON object.")
    sections = payload.get("sections") or {}
    sources = payload.get("sources") or []
    if not isinstance(sections, dict) or not isinstance(sources, list):
        raise RuntimeError("Infographic sections and sources have invalid shapes.")
    copy = InfographicCopy(
        title=str(payload.get("title", "")).strip(),
        subtitle=str(payload.get("subtitle", "")).strip(),
        feast_day=str(payload.get("feast_day", "")).strip(),
        sections={str(key): [str(value).strip() for value in values] for key, values in sections.items() if isinstance(values, list)},
        spiritual_themes=[str(item).strip() for item in payload.get("spiritual_themes") or []],
        footer=str(payload.get("footer", "")).strip(),
        sources=[{"title": str(item.get("title", "")).strip(), "url": str(item.get("url", "")).strip()} for item in sources if isinstance(item, dict)],
    )
    if not copy.sources or any(not item["url"] for item in copy.sources):
        raise RuntimeError("Infographic research response requires cited sources.")
    copy.validate()
    return copy


def infographic_research_prompt(subject: str, context: str) -> str:
    return (
        "Research this Catholic devotional subject using authoritative Catholic sources and return JSON only. "
        "Do not invent missing facts. Keep bullets concise. Required JSON fields: title, subtitle, feast_day, "
        "sections (object with up to five headings and up to three bullets each), spiritual_themes (exactly three), "
        "footer, sources (array of title/url).\n"
        f"SUBJECT: {subject}\nCONTEXT: {context}"
    )


def parse_qa_result(text: str) -> Dict[str, Any]:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Infographic QA response must be valid JSON.") from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("approved"), bool):
        raise RuntimeError("Infographic QA response requires a boolean approved field.")
    issues = payload.get("issues") or []
    if not isinstance(issues, list):
        raise RuntimeError("Infographic QA issues must be a list.")
    return {"approved": payload["approved"], "issues": [str(item).strip() for item in issues if str(item).strip()]}


def infographic_qa_prompt(copy: InfographicCopy) -> str:
    return (
        "Inspect the supplied Catholic infographic against this approved copy. Return JSON only with boolean approved and issues array. "
        "Reject incorrect title, dates, feast day, factual text, malformed/gibberish text, clipped panels, unreadable footer, or wrong identity.\n"
        + copy.to_private_json()
    )
