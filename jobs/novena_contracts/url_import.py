from __future__ import annotations

import dataclasses
import datetime as _dt
import html
import json
import os
import re
from functools import lru_cache
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from openai import OpenAI
import requests

from jobs.novena_contracts.contracts import DEFAULT_CONTRACT_DIR, DEFAULT_TEMPLATE_DIR, DEFAULT_AUDIO_CONFIG, DEFAULT_RSS_CONFIG
from jobs.novena_contracts.validators import normalize_contract_filename, resolve_romcal_date, resolve_romcal_identifier, validate_novena_contract


SOURCE_DOMAIN = "catholicnovenaapp.com"
DEFAULT_REPORT_DIR = Path(__file__).resolve().parents[2] / "artifacts" / "novena-url-overrides"
DEFAULT_OPENAI_ENV_FILE = Path(__file__).resolve().parents[2] / "config" / "local" / "openai.env"
DEFAULT_NOVENA_DURATION_DAYS = 9
DEFAULT_NOVENA_START_OFFSET_DAYS = -9
TRADITIONAL_NOVENA_TITLE_PATTERN = "Traditional Novena to {saint_name} Day {day} - {date_display}"
USER_AGENT = "Mozilla/5.0 (compatible; novena-url-import/1.0)"
OPENAI_API_KEY = "OPENAI_API_KEY"
OPENAI_API_KEY_FILE = "OPENAI_API_KEY_FILE"
OAI_API_BASE_URL = "OAI_API_BASE_URL"
OAI_MODEL = "OAI_MODEL"
ROSARY_TEMPLATE_DIR = Path(__file__).resolve().parents[2] / "config" / "publish" / "templates" / "rosary"
DAY_HEADING_ID_RE = re.compile(r"^day-(\d+)$", re.IGNORECASE)
TTS_PLACEHOLDER_RE = re.compile(r"\(mention request here…\)", re.IGNORECASE)
TTS_REPETITION_MARKER_RE = re.compile(r"\((?:three times each|say 3 times|repeat 3 times)\)", re.IGNORECASE)
TTS_REPETITION_PHRASE_RE = re.compile(r"\b(?:three times each|say 3 times|repeat 3 times)\b", re.IGNORECASE)
TTS_PROMPT_PREFIX_RE = re.compile(r"^\s*Pray the(?:\.{2,}|…)?\s*", re.IGNORECASE)
TTS_REPETITION_PREFIX_RE = re.compile(r"^\s*(?:say|repeat)\s+(?:this\s+)?(?:prayer\s+)?", re.IGNORECASE)
PRAYER_NAME_RE = re.compile(r"\b(Our Father|Hail Mary|Glory Be)\b", re.IGNORECASE)
PRAYER_NAME_ORDER = ("Our Father", "Hail Mary", "Glory Be")
PRAYER_NAME_TO_FILE = {
    "our father": "our-father.txt",
    "hail mary": "hail-mary.txt",
    "glory be": "glory-be.txt",
}
PRAYER_NAME_TO_KEY = {
    "our father": "our_father",
    "hail mary": "hail_mary",
    "glory be": "glory_be",
}

MONTH_LOOKUP = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}

FIXED_DATE_RE = re.compile(
    r"(?P<month>January|February|March|April|May|June|July|August|September|October|November|December)\s+"
    r"(?P<day>\d{1,2})(?:st|nd|rd|th)?(?:,\s*\d{4})?",
    re.IGNORECASE,
)
NOVENA_PREFIX_RE = re.compile(r"^\s*novena(?:\s+to|\s+for|\s+of)?\s+", re.IGNORECASE)
NOVENA_SUFFIX_RE = re.compile(r"\s+novena\s*$", re.IGNORECASE)
TITLE_TAG_RE = re.compile(r'<h1[^>]*class="[^"]*page__title[^"]*"[^>]*>(?P<title>.*?)</h1>', re.IGNORECASE | re.DOTALL)
OG_TITLE_RE = re.compile(r'<meta[^>]*property="og:title"[^>]*content="(?P<title>[^"]+)"', re.IGNORECASE)
PAGE_TITLE_RE = re.compile(r"<title>(?P<title>.*?)</title>", re.IGNORECASE | re.DOTALL)
FACTS_BLOCK_RE = re.compile(
    r'<div[^>]*class="[^"]*notice--info[^"]*"[^>]*>.*?<strong>Facts about (?P<subject>.*?)</strong>.*?<table[^>]*>(?P<table>.*?)</table>',
    re.IGNORECASE | re.DOTALL,
)
CATALOG_ITEM_RE = re.compile(
    r'<li[^>]*>.*?<strong><a href="(?P<href>/novenas/[^"]+)">(?P<title>.*?)</a></strong>.*?'
    r'<span[^>]*>(?P<meta>.*?)</span>.*?</li>',
    re.IGNORECASE | re.DOTALL,
)
ROW_RE = re.compile(
    r"<tr>\s*<td[^>]*>(?P<label>.*?)</td>\s*<td[^>]*>(?P<value>.*?)</td>\s*</tr>",
    re.IGNORECASE | re.DOTALL,
)


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: List[str] = []

    def handle_data(self, data: str) -> None:  # pragma: no cover - exercised indirectly
        if data:
            self.parts.append(data)

    def text(self) -> str:
        return re.sub(r"\s+", " ", html.unescape("".join(self.parts))).strip()


@dataclass(frozen=True)
class CatalogEntry:
    url: str
    title: str
    starts_text: str
    feast_text: str
    month: Optional[int] = None


@dataclass(frozen=True)
class TtsResolution:
    text: str
    notes: Tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class NovenaImportDraft:
    source_url: str
    title: str
    display_name: str
    contract_id: str
    starts_text: str
    feast_text: str
    feast_mode: str
    enabled: bool
    status: str
    issues: Tuple[str, ...] = field(default_factory=tuple)
    notes: Tuple[str, ...] = field(default_factory=tuple)
    payload: Optional[Dict[str, Any]] = None
    output_path: str = ""

    def report_dict(self) -> Dict[str, Any]:
        return {
            "source_url": self.source_url,
            "title": self.title,
            "display_name": self.display_name,
            "contract_id": self.contract_id,
            "starts_text": self.starts_text,
            "feast_text": self.feast_text,
            "feast_mode": self.feast_mode,
            "enabled": self.enabled,
            "status": self.status,
            "issues": list(self.issues),
            "notes": list(self.notes),
            "output_path": self.output_path,
        }


@dataclass
class NovenaImportReport:
    mode: str
    source_url: str
    entries: List[NovenaImportDraft] = field(default_factory=list)

    @property
    def hard_failures(self) -> int:
        return sum(1 for entry in self.entries if entry.status == "failed")

    @property
    def written(self) -> int:
        return sum(1 for entry in self.entries if entry.status == "written")

    @property
    def disabled(self) -> int:
        return sum(1 for entry in self.entries if entry.status == "disabled")

    def summary(self) -> Dict[str, Any]:
        return {
            "mode": self.mode,
            "source_url": self.source_url,
            "written": self.written,
            "disabled": self.disabled,
            "failed": self.hard_failures,
            "total": len(self.entries),
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mode": self.mode,
            "source_url": self.source_url,
            "summary": self.summary(),
            "entries": [entry.report_dict() for entry in self.entries],
        }

    def to_markdown(self) -> str:
        lines = [
            "# Novena URL Import Report",
            "",
            f"- Mode: {self.mode}",
            f"- Source: {self.source_url}",
            f"- Written: {self.written}",
            f"- Disabled: {self.disabled}",
            f"- Failed: {self.hard_failures}",
            f"- Total: {len(self.entries)}",
            "",
            "## Entries",
            "",
            "| Status | Enabled | Title | Contract | Output | Notes | Issues |",
            "| --- | --- | --- | --- | --- | --- | --- |",
        ]
        for entry in self.entries:
            notes = "; ".join(entry.notes) if entry.notes else ""
            issues = "; ".join(entry.issues) if entry.issues else ""
            lines.append(
                "| {status} | {enabled} | {title} | {contract} | {output} | {notes} | {issues} |".format(
                    status=entry.status,
                    enabled="yes" if entry.enabled else "no",
                    title=_escape_markdown_cell(entry.title or entry.display_name or entry.source_url),
                    contract=_escape_markdown_cell(entry.contract_id or ""),
                    output=_escape_markdown_cell(entry.output_path or ""),
                    notes=_escape_markdown_cell(notes),
                    issues=_escape_markdown_cell(issues),
                )
            )
        preview_lines = self._section_preview_markdown()
        if preview_lines:
            lines.extend(["", *preview_lines])
        return "\n".join(lines)

    def _section_preview_markdown(self) -> List[str]:
        if self.mode != "single" or len(self.entries) != 1:
            return []
        entry = self.entries[0]
        payload = entry.payload or {}
        contract = payload.get("contract") if isinstance(payload, dict) else None
        if not isinstance(contract, dict):
            return []
        novena = contract.get("novena")
        if not isinstance(novena, dict):
            return []
        template = novena.get("template")
        if not isinstance(template, dict):
            return []
        sections = template.get("blocks") if isinstance(template.get("blocks"), list) and template.get("blocks") else template.get("sections")
        if not isinstance(sections, list) or not sections:
            return []

        lines = [
            "## Contract Preview",
            "",
            f"- Contract: `{_escape_markdown_cell(entry.contract_id or '')}`",
            f"- Enabled: {'yes' if entry.enabled else 'no'}",
            f"- Source: {entry.source_url}",
            "",
        ]
        for section in sections:
            if not isinstance(section, dict):
                continue
            title = str(section.get("title", "")).strip() or str(section.get("key", "")).strip() or "Section"
            key = str(section.get("key", "")).strip()
            notes = str(section.get("notes", "")).strip()
            text = str(section.get("text", "")).strip()
            days = section.get("days")
            parts = section.get("parts")
            day_label = _format_day_tags(days) if isinstance(days, list) else ""
            lines.append(f"### {title}")
            if key:
                lines.append(f"- Key: `{_escape_markdown_cell(key)}`")
            if day_label:
                lines.append(f"- Days: {day_label}")
            if notes:
                lines.append(f"- Notes: {notes}")
            if isinstance(parts, list) and parts:
                formatted_parts: List[str] = []
                for part in parts:
                    if not isinstance(part, dict):
                        continue
                    part_kind = str(part.get("kind", "")).strip().lower()
                    repeat = int(part.get("repeat", 1) or 1)
                    if part_kind == "fragment":
                        fragment_key = str(part.get("fragment_key", "")).strip()
                        description = fragment_key or "fragment"
                    else:
                        description = "text"
                    if repeat > 1:
                        description = f"{description} x{repeat}"
                    formatted_parts.append(description)
                if formatted_parts:
                    lines.append(f"- Parts: {', '.join(formatted_parts)}")
            if text:
                lines.append("")
                lines.append("```text")
                lines.append(text)
                lines.append("```")
            else:
                lines.append("- Text: <empty>")
            lines.append("")
        fragments = template.get("fragments")
        if isinstance(fragments, list) and fragments:
            lines.extend(["## Fragment Library", ""])
            for fragment in fragments:
                if not isinstance(fragment, dict):
                    continue
                fragment_title = str(fragment.get("title", "")).strip() or str(fragment.get("key", "")).strip() or "Fragment"
                fragment_key = str(fragment.get("key", "")).strip()
                fragment_notes = str(fragment.get("notes", "")).strip()
                fragment_text = str(fragment.get("text", "")).strip()
                lines.append(f"### {fragment_title}")
                if fragment_key:
                    lines.append(f"- Key: `{_escape_markdown_cell(fragment_key)}`")
                if fragment_notes:
                    lines.append(f"- Notes: {fragment_notes}")
                if fragment_text:
                    lines.append("")
                    lines.append("```text")
                    lines.append(fragment_text)
                    lines.append("```")
                lines.append("")
        return lines


def _escape_markdown_cell(text: str) -> str:
    return str(text).replace("|", "\\|").replace("\n", " ").strip()


def _fetch_html(url: str, *, fetcher: Optional[Callable[[str], str]] = None) -> str:
    if fetcher is not None:
        return fetcher(url)
    response = requests.get(url, timeout=30, headers={"User-Agent": USER_AGENT})
    response.raise_for_status()
    return response.text


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


def _ensure_supported_domain(url: str) -> None:
    parsed = urlparse(url)
    if parsed.netloc.lower() != SOURCE_DOMAIN:
        raise RuntimeError(f"Unsupported novena source domain: {url}")


def _extract_text(fragment: str) -> str:
    parser = _TextExtractor()
    parser.feed(fragment)
    parser.close()
    return parser.text()


def _clean_title(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", html.unescape(str(text or ""))).strip(" \t\r\n-:|")
    cleaned = NOVENA_PREFIX_RE.sub("", cleaned)
    cleaned = NOVENA_SUFFIX_RE.sub("", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" \t\r\n-:|")
    if cleaned and cleaned[0].islower():
        cleaned = cleaned[0].upper() + cleaned[1:]
    return cleaned


def _extract_title(html_text: str) -> str:
    for pattern in (TITLE_TAG_RE, OG_TITLE_RE, PAGE_TITLE_RE):
        match = pattern.search(html_text)
        if match:
            title = _extract_text(match.group("title"))
            title = re.sub(r"\s*\|\s*Intercede\s*-\s*Catholic Novenas\s*$", "", title, flags=re.IGNORECASE)
            title = re.sub(r"\s*-\s*Intercede\s*-\s*Catholic Novenas\s*$", "", title, flags=re.IGNORECASE)
            title = title.strip()
            if title:
                return title
    raise RuntimeError("Unable to find novena page title.")


def _extract_detail_facts(html_text: str) -> Dict[str, str]:
    soup = BeautifulSoup(html_text, "html.parser")
    facts_block = soup.select_one("div.notice--info")
    if facts_block is not None:
        table = facts_block.find("table")
        if table is None:
            raise RuntimeError("Unable to find novena facts block.")
        table_html = str(table)
    else:
        match = FACTS_BLOCK_RE.search(html_text)
        if not match:
            raise RuntimeError("Unable to find novena facts block.")
        table_html = match.group("table")
    facts: Dict[str, str] = {}
    for row in ROW_RE.finditer(table_html):
        label = _extract_text(row.group("label")).lower().rstrip(":")
        value = _extract_text(row.group("value"))
        if label and value:
            facts[label] = value
    return facts


def _parse_fixed_date(text: str) -> Optional[Tuple[int, int]]:
    cleaned = re.sub(r"\s+", " ", html.unescape(str(text or ""))).strip()
    match = FIXED_DATE_RE.search(cleaned)
    if not match:
        return None
    month = MONTH_LOOKUP[match.group("month").lower()]
    day = int(match.group("day"))
    try:
        _dt.date(2000, month, day)
    except ValueError:
        return None
    return month, day


def _clean_paragraph_text(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(str(value or ""))).strip()


def _content_section_to_text(tag: Any) -> str:
    if tag is None:
        return ""
    text = tag.get_text("\n", strip=True)
    return _clean_paragraph_text(text)


def _has_tts_instruction(text: str) -> bool:
    return bool(
        TTS_PLACEHOLDER_RE.search(text)
        or TTS_REPETITION_MARKER_RE.search(text)
        or TTS_REPETITION_PHRASE_RE.search(text)
        or TTS_PROMPT_PREFIX_RE.search(text)
    )


def _has_repetition_instruction(text: str) -> bool:
    return bool(TTS_REPETITION_MARKER_RE.search(text) or TTS_REPETITION_PHRASE_RE.search(text) or TTS_REPETITION_PREFIX_RE.search(text))


def _strip_tts_instruction_text(text: str) -> str:
    cleaned = _clean_paragraph_text(text)
    cleaned = TTS_PROMPT_PREFIX_RE.sub("", cleaned)
    cleaned = TTS_REPETITION_MARKER_RE.sub("", cleaned)
    cleaned = TTS_REPETITION_PHRASE_RE.sub("", cleaned)
    cleaned = TTS_REPETITION_PREFIX_RE.sub("", cleaned)
    cleaned = re.sub(r"^\s*Pray the\.{3,}\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" \t\r\n-:;,.")
    return cleaned


def _split_paragraphs(text: str) -> List[str]:
    paragraphs = []
    for piece in re.split(r"\n\s*\n+", str(text or "")):
        cleaned_lines = [re.sub(r"\s+", " ", line).strip() for line in html.unescape(piece).splitlines()]
        cleaned = "\n".join(line for line in cleaned_lines if line)
        cleaned = cleaned.strip()
        if cleaned:
            paragraphs.append(cleaned)
    return [piece for piece in paragraphs if piece]


def _dedupe_preserve_order(values: List[str]) -> Tuple[str, ...]:
    seen = set()
    out: List[str] = []
    for value in values:
        cleaned = str(value or "").strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            out.append(cleaned)
    return tuple(out)


@lru_cache(maxsize=1)
def _canonical_prayer_fragments() -> Tuple[Dict[str, Any], ...]:
    fragments: List[Dict[str, Any]] = []
    for prayer_name in PRAYER_NAME_ORDER:
        filename = PRAYER_NAME_TO_FILE[prayer_name.lower()]
        path = ROSARY_TEMPLATE_DIR / filename
        try:
            text = path.read_text(encoding="utf-8").strip()
        except OSError as exc:
            raise RuntimeError(f"Unable to load canonical prayer text for {prayer_name}: {path}") from exc
        fragments.append(
            {
                "key": PRAYER_NAME_TO_KEY[prayer_name.lower()],
                "title": prayer_name,
                "kind": "fixed",
                "text": text,
                "notes": "canonical rosary prayer text",
            }
        )
    return tuple(fragments)


@lru_cache(maxsize=1)
def _canonical_prayer_text_lookup() -> Dict[str, str]:
    lookup: Dict[str, str] = {}
    for fragment in _canonical_prayer_fragments():
        lookup[_clean_paragraph_text(fragment["text"])] = str(fragment["key"])
    return lookup


def _text_to_parts(text: str) -> Tuple[List[Dict[str, Any]], Tuple[str, ...]]:
    paragraphs = _split_paragraphs(text)
    if not paragraphs:
        return [], tuple()

    lookup = _canonical_prayer_text_lookup()
    parts: List[Dict[str, Any]] = []
    notes: List[str] = []
    index = 0
    while index < len(paragraphs):
        paragraph = paragraphs[index]
        canonical_key = lookup.get(_clean_paragraph_text(paragraph))
        if canonical_key:
            repeat = 1
            while index + repeat < len(paragraphs):
                next_paragraph = paragraphs[index + repeat]
                if lookup.get(_clean_paragraph_text(next_paragraph)) != canonical_key:
                    break
                repeat += 1
            part: Dict[str, Any] = {"kind": "fragment", "fragment_key": canonical_key}
            if repeat > 1:
                part["repeat"] = repeat
                notes.append(f"reused canonical prayer fragment '{canonical_key}' {repeat} times")
            else:
                notes.append(f"reused canonical prayer fragment '{canonical_key}'")
            parts.append(part)
            index += repeat
            continue
        parts.append({"kind": "text", "text": paragraph})
        index += 1
    return parts, _dedupe_preserve_order(notes)


def _parse_day_number(section: Dict[str, Any]) -> Optional[int]:
    days = section.get("days")
    if isinstance(days, list) and len(days) == 1:
        try:
            return int(days[0])
        except Exception:
            return None
    key = str(section.get("key", "")).strip().lower()
    title = str(section.get("title", "")).strip().lower()
    for candidate in (key, title):
        match = re.match(r"^day[-\s]?(\d+)$", candidate)
        if match:
            return int(match.group(1))
    return None


def _format_day_tags(days: Any) -> str:
    if not isinstance(days, list):
        return ""
    cleaned: List[int] = []
    for day in days:
        try:
            day_number = int(day)
        except Exception:
            continue
        if day_number > 0 and day_number not in cleaned:
            cleaned.append(day_number)
    if not cleaned:
        return ""
    cleaned.sort()
    if len(cleaned) == 1:
        return f"Day {cleaned[0]}"
    spans: List[str] = []
    start = cleaned[0]
    previous = cleaned[0]
    for day in cleaned[1:]:
        if day == previous + 1:
            previous = day
            continue
        spans.append(f"{start}-{previous}" if start != previous else f"{start}")
        start = previous = day
    spans.append(f"{start}-{previous}" if start != previous else f"{start}")
    if len(spans) == 1 and "-" in spans[0]:
        return f"Days {spans[0]}"
    return "Days " + ", ".join(spans)


def _compact_template_sections(sections: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    expanded: List[Dict[str, Any]] = []
    grouped: List[Dict[str, Any]] = []
    groups: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
    order: List[Tuple[str, str, str]] = []
    used_fragment_keys: List[str] = []

    for section in sections:
        updated = dict(section)
        day_number = _parse_day_number(updated)
        if day_number is not None:
            updated["days"] = [day_number]
        elif isinstance(updated.get("days"), list):
            updated["days"] = [int(day) for day in updated.get("days", []) if str(day).strip()]
        expanded.append(updated)

        text = str(updated.get("text", "")).strip()
        prompt = str(updated.get("prompt", "")).strip()
        kind = str(updated.get("kind", "")).strip().lower()
        if day_number is None or not text:
            continue
        key = (kind, text, prompt)
        if key not in groups:
            groups[key] = {
                "key": str(updated.get("key", "")).strip() or f"block-{len(order) + 1}",
                "title": str(updated.get("title", "")).strip() or f"Day {day_number}",
                "kind": kind,
                "text": text,
                "prompt": prompt,
                "notes": [],
                "days": [],
            }
            order.append(key)
        bucket = groups[key]
        bucket["days"].append(day_number)
        note = str(updated.get("notes", "")).strip()
        if note:
            for part in [piece.strip() for piece in note.split(";") if piece.strip()]:
                if part not in bucket["notes"]:
                    bucket["notes"].append(part)

    for key in order:
        bucket = groups[key]
        days = sorted(set(bucket["days"]))
        title = _format_day_tags(days) or bucket["title"] or "Section"
        parts, part_notes = _text_to_parts(bucket["text"])
        for part in parts:
            if str(part.get("kind", "")).strip().lower() == "fragment":
                fragment_key = str(part.get("fragment_key", "")).strip()
                if fragment_key and fragment_key not in used_fragment_keys:
                    used_fragment_keys.append(fragment_key)
        block = {
            "key": f"days-{days[0]}" if len(days) == 1 else f"days-{days[0]}-{days[-1]}",
            "title": title,
            "kind": bucket["kind"],
            "days": days,
        }
        if bucket["prompt"]:
            block["prompt"] = bucket["prompt"]
        combined_notes = list(bucket["notes"]) + list(part_notes)
        if combined_notes:
            block["notes"] = "; ".join(_dedupe_preserve_order(combined_notes))
        if parts and any(str(part.get("kind", "")).strip().lower() == "fragment" for part in parts):
            block["parts"] = parts
        else:
            block["text"] = bucket["text"]
        grouped.append(block)

    intro_sections = [section for section in expanded if _parse_day_number(section) is None]
    fragment_library = [fragment for fragment in _canonical_prayer_fragments() if fragment["key"] in used_fragment_keys]
    return intro_sections + [section for section in expanded if _parse_day_number(section) is not None], intro_sections + grouped, fragment_library


@lru_cache(maxsize=1)
def _load_prayer_text(prayer_name: str) -> str:
    filename = PRAYER_NAME_TO_FILE.get(prayer_name.strip().lower())
    if not filename:
        raise RuntimeError(f"Unsupported canonical prayer name: {prayer_name}")
    path = ROSARY_TEMPLATE_DIR / filename
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise RuntimeError(f"Unable to load canonical prayer text for {prayer_name}: {path}") from exc
    return text.strip()


def _extract_prayer_names(text: str) -> Tuple[str, ...]:
    names: List[str] = []
    seen: set[str] = set()
    for match in PRAYER_NAME_RE.finditer(str(text or "")):
        canonical = next((name for name in PRAYER_NAME_ORDER if name.lower() == match.group(1).lower()), "")
        if canonical and canonical not in seen:
            seen.add(canonical)
            names.append(canonical)
    return tuple(names)


def _prepare_tts_source(text: str) -> TtsResolution:
    paragraphs = _split_paragraphs(text)
    if not paragraphs:
        return TtsResolution(text="")

    resolved: List[str] = []
    notes: List[str] = []
    for paragraph in paragraphs:
        prayer_names = _extract_prayer_names(paragraph)
        if not prayer_names:
            resolved.append(paragraph)
            continue

        first_match = PRAYER_NAME_RE.search(paragraph)
        last_match = None
        for match in PRAYER_NAME_RE.finditer(paragraph):
            last_match = match
        prefix = _clean_paragraph_text(paragraph[: first_match.start()]) if first_match else ""
        suffix = _clean_paragraph_text(paragraph[last_match.end() :]) if last_match else ""
        repetition_count = 3 if (TTS_REPETITION_MARKER_RE.search(paragraph) or TTS_REPETITION_PHRASE_RE.search(paragraph)) else 1
        if repetition_count > 1 and suffix:
            suffix = TTS_REPETITION_MARKER_RE.sub("", suffix)
            suffix = TTS_REPETITION_PHRASE_RE.sub("", suffix)
            suffix = TTS_REPETITION_PREFIX_RE.sub("", suffix)
            suffix = _clean_paragraph_text(suffix)
        prayer_blocks: List[str] = []

        for prayer_name in prayer_names:
            prayer_text = _load_prayer_text(prayer_name)
            if repetition_count > 1:
                prayer_blocks.append(f"You are going to say the following 3 times: {prayer_name}")
                prayer_blocks.extend([prayer_text] * repetition_count)
            else:
                prayer_blocks.append(prayer_text)

        if prefix:
            resolved.append(prefix)
        resolved.extend(prayer_blocks)
        if suffix:
            resolved.append(suffix)
        if repetition_count > 1:
            notes.append(
                "expanded canonical prayer references into full rosary texts and repeated each prayer three times"
            )
        else:
            notes.append("expanded canonical prayer references into full rosary texts")

    return TtsResolution(text="\n\n".join(resolved), notes=_dedupe_preserve_order(notes))


def _local_tts_resolution(text: str) -> TtsResolution:
    paragraphs = _split_paragraphs(text)
    if not paragraphs:
        return TtsResolution(text="")

    resolved: List[str] = []
    notes: List[str] = []
    index = 0
    while index < len(paragraphs):
        paragraph = paragraphs[index]
        if _has_repetition_instruction(paragraph):
            base = _strip_tts_instruction_text(paragraph)
            if base:
                while index + 1 < len(paragraphs):
                    next_paragraph = paragraphs[index + 1]
                    if not _has_repetition_instruction(next_paragraph):
                        break
                    if _strip_tts_instruction_text(next_paragraph) != base:
                        break
                    index += 1
                resolved.append(f"You are going to say this three times: {base}")
                resolved.extend([base, base, base])
                notes.append("expanded repetition instruction into three explicit spoken recitations")
            else:
                resolved.append(paragraph)
                notes.append("kept repetition instruction because the repeated prayer text could not be isolated")
        else:
            replaced = TTS_PLACEHOLDER_RE.sub("Pause here to mention your request.", paragraph)
            if replaced != paragraph:
                notes.append('replaced "mention request here" with a spoken pause prompt')
            replaced = re.sub(r"^\s*Pray the…\s*", "Pray the following: ", replaced, flags=re.IGNORECASE)
            if replaced != paragraph and "Pray the following:" in replaced:
                notes.append("normalized a truncated prayer prompt into a spoken instruction")
            resolved.append(replaced)
        index += 1
    return TtsResolution(text="\n\n".join(resolved), notes=_dedupe_preserve_order(notes))


def _openai_tts_resolution(
    text: str,
    *,
    page_title: str,
    section_title: str,
    api_key: str,
    base_url: str,
    model: str,
) -> TtsResolution:
    client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"), timeout=30.0)
    system = (
        "Return strict JSON only with keys text and notes. "
        "Rewrite Catholic novena prose so it is ready to read aloud by text-to-speech. "
        "Preserve the prayer meaning, prayer order, and paragraph structure. "
        "The importer has already expanded canonical prayer names from the repo's rosary library. "
        "Never paraphrase those canonical prayers, and never add markdown, code fences, bullets, or any commentary outside the JSON object."
    )
    user = (
        f"Page title: {page_title}\n"
        f"Section title: {section_title}\n\n"
        "Source text:\n"
        f"{text}\n\n"
        "Rules:\n"
        "- Keep the prayer text faithful to the source and easy to speak.\n"
        "- Preserve paragraph breaks where they help pacing.\n"
        "- The source has already been simplified so repeated novena blocks can be reused across days.\n"
        "- Canonical prayer names like Our Father, Hail Mary, and Glory Be have already been expanded to their full traditional text from the repo's rosary library.\n"
        "- When the source says 'mention request here', replace it with: 'Pause here to mention your request.'\n"
        "- Keep any spoken repetition preamble concise and clear.\n"
        "- Do not invent new devotional content.\n"
        "- If no normalization is needed, keep the text nearly unchanged and set notes to an empty string.\n"
        "- Return JSON only with keys text and notes.\n"
        "- Notes should be a single short sentence describing the normalization, or an empty string if nothing changed."
    )
    raw_text = ""
    try:
        response = client.responses.create(
            model=model,
            temperature=0,
            input=[
                {"role": "system", "content": [{"type": "input_text", "text": system}]},
                {"role": "user", "content": [{"type": "input_text", "text": user}]},
            ],
        )
        raw_text = re.sub(r"\s+", " ", str(getattr(response, "output_text", "") or "")).strip()
    except Exception:
        raw_text = ""
    if not raw_text:
        try:
            chat = client.chat.completions.create(
                model=model,
                temperature=0,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            )
            choices = getattr(chat, "choices", None) or []
            if choices:
                raw_text = re.sub(
                    r"\s+",
                    " ",
                    str(getattr(getattr(choices[0], "message", None), "content", "") or ""),
                ).strip()
        except Exception:
            raw_text = ""
    if not raw_text:
        raise RuntimeError("OpenAI TTS normalization returned no text.")
    try:
        payload = json.loads(raw_text)
    except Exception as exc:
        raise RuntimeError(f"OpenAI TTS normalization returned invalid JSON: {raw_text[:120]}") from exc
    resolved_text = _clean_paragraph_text(payload.get("text", ""))
    if not resolved_text:
        raise RuntimeError("OpenAI TTS normalization returned empty text.")
    notes_payload = payload.get("notes", "")
    notes = _dedupe_preserve_order([str(notes_payload).strip()] if str(notes_payload or "").strip() else [])
    return TtsResolution(text=resolved_text, notes=notes)


def _resolve_tts_text(
    text: str,
    *,
    page_title: str,
    section_title: str,
    resolve_with_openai: bool,
    openai_api_key: str,
    openai_base_url: str,
    openai_model: str,
    prepared_resolution: Optional[TtsResolution] = None,
) -> TtsResolution:
    prepared_resolution = prepared_resolution or _prepare_tts_source(text)
    local_resolution = _local_tts_resolution(prepared_resolution.text)
    merged_local_notes = _dedupe_preserve_order(list(prepared_resolution.notes) + list(local_resolution.notes))
    local_resolution = TtsResolution(text=local_resolution.text, notes=merged_local_notes)
    if not resolve_with_openai or not _has_tts_instruction(prepared_resolution.text):
        return local_resolution
    if not openai_api_key:
        return local_resolution
    try:
        remote_resolution = _openai_tts_resolution(
            prepared_resolution.text,
            page_title=page_title,
            section_title=section_title,
            api_key=openai_api_key,
            base_url=openai_base_url,
            model=openai_model,
        )
        merged_notes = _dedupe_preserve_order(list(remote_resolution.notes) + list(local_resolution.notes))
        return TtsResolution(text=remote_resolution.text, notes=merged_notes)
    except Exception:
        fallback_notes = list(local_resolution.notes)
        fallback_notes.append("OpenAI normalization failed; used local TTS fallback")
        return TtsResolution(text=local_resolution.text, notes=_dedupe_preserve_order(fallback_notes))


def _resolve_prayer_sections(
    sections: List[Dict[str, Any]],
    *,
    page_title: str,
    resolve_with_openai: bool,
    openai_api_key: str,
    openai_base_url: str,
    openai_model: str,
) -> Tuple[List[Dict[str, Any]], Tuple[str, ...]]:
    resolved_sections: List[Dict[str, Any]] = []
    notes: List[str] = []
    resolution_cache: Dict[str, TtsResolution] = {}
    for section in sections:
        text = str(section.get("text", "")).strip()
        if not text:
            resolved_sections.append(dict(section))
            continue
        section_title = str(section.get("title", "")).strip() or str(section.get("key", "")).strip()
        prepared = _prepare_tts_source(text)
        cache_key = prepared.text
        cache_hit = cache_key in resolution_cache
        if cache_hit:
            resolution = resolution_cache[cache_key]
        else:
            resolution = _resolve_tts_text(
                text,
                page_title=page_title,
                section_title=section_title,
                resolve_with_openai=resolve_with_openai,
                openai_api_key=openai_api_key,
                openai_base_url=openai_base_url,
                openai_model=openai_model,
                prepared_resolution=prepared,
            )
            resolution_cache[cache_key] = resolution
        updated = dict(section)
        updated["text"] = resolution.text
        section_notes = list(prepared.notes) + list(resolution.notes)
        if cache_hit:
            section_notes.append("reused compacted prayer source from an earlier section")
        section_notes = _dedupe_preserve_order(section_notes)
        if section_notes:
            updated["notes"] = "; ".join(section_notes)
            notes.extend(f"{section_title}: {note}" if section_title else note for note in section_notes)
        resolved_sections.append(updated)
    return resolved_sections, _dedupe_preserve_order(notes)


def _parse_month_filter(month: Optional[Any]) -> Optional[int]:
    if month is None:
        return None
    if isinstance(month, int):
        if 1 <= month <= 12:
            return month
        raise RuntimeError(f"Unsupported month value: {month}")
    cleaned = re.sub(r"\s+", " ", str(month or "")).strip().lower()
    if not cleaned:
        return None
    if cleaned.isdigit():
        value = int(cleaned)
        if 1 <= value <= 12:
            return value
        raise RuntimeError(f"Unsupported month value: {month}")
    if cleaned in MONTH_LOOKUP:
        return MONTH_LOOKUP[cleaned]
    raise RuntimeError(f"Unsupported month value: {month}")


def _month_heading_to_number(tag: Any) -> Optional[int]:
    if tag is None or getattr(tag, "name", "") != "h3":
        return None
    heading_id = str(tag.get("id", "") or "").strip().lower()
    if heading_id in MONTH_LOOKUP:
        return MONTH_LOOKUP[heading_id]
    heading_text = _clean_title(tag.get_text(" ", strip=True)).lower()
    return MONTH_LOOKUP.get(heading_text)


def _extract_prayer_sections(html_text: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html_text, "html.parser")
    content = soup.select_one("section.page__content")
    if content is None:
        raise RuntimeError("Unable to find novena page content.")

    children = [child for child in content.children if getattr(child, "name", None)]
    sections: List[Dict[str, Any]] = []

    def _is_day_heading(tag: Any) -> bool:
        return bool(tag and getattr(tag, "name", "") == "h2" and DAY_HEADING_ID_RE.match(str(tag.get("id", "")).strip()))

    def _flush_intro(paragraphs: List[str]) -> None:
        cleaned = [paragraph for paragraph in paragraphs if paragraph]
        if cleaned:
            sections.append(
                {
                    "key": "introduction",
                    "title": "Introduction",
                    "kind": "fixed",
                    "text": "\n\n".join(cleaned),
                }
            )

    intro_paragraphs: List[str] = []
    index = 0
    while index < len(children) and not _is_day_heading(children[index]):
        child = children[index]
        if getattr(child, "name", "") == "p":
            text = _content_section_to_text(child)
            if text:
                intro_paragraphs.append(text)
        index += 1
    _flush_intro(intro_paragraphs)

    current_day: Optional[int] = None
    current_paragraphs: List[str] = []

    def _flush_day() -> None:
        nonlocal current_day, current_paragraphs
        if current_day is None:
            return
        cleaned = [paragraph for paragraph in current_paragraphs if paragraph]
        sections.append(
            {
                "key": f"day-{current_day}",
                "title": f"Day {current_day}",
                "kind": "fixed",
                "text": "\n\n".join(cleaned),
            }
        )
        current_day = None
        current_paragraphs = []

    for child in children[index:]:
        if _is_day_heading(child):
            _flush_day()
            current_day = int(DAY_HEADING_ID_RE.match(str(child.get("id", "")).strip()).group(1))
            continue
        if current_day is not None:
            child_name = getattr(child, "name", "")
            child_id = str(getattr(child, "get", lambda *_: "")("id", "") or "").strip()
            if child_name in {"h1", "h2", "h3"} and not _is_day_heading(child):
                _flush_day()
                break
            if (
                child_name == "div"
                and current_day >= DEFAULT_NOVENA_DURATION_DAYS
                and re.match(rf"^social-share-{DEFAULT_NOVENA_DURATION_DAYS}$", child_id, re.IGNORECASE)
            ):
                _flush_day()
                break
        if current_day is None:
            continue
        if getattr(child, "name", "") == "p":
            text = _content_section_to_text(child)
            if text:
                current_paragraphs.append(text)
    _flush_day()

    if not sections:
        raise RuntimeError("Unable to extract prayer sections from novena page.")
    return sections


def _candidate_feast_identifiers(*values: str) -> List[str]:
    candidates: List[str] = []
    for raw in values:
        cleaned = _clean_title(raw)
        if cleaned and cleaned not in candidates:
            candidates.append(cleaned)
        if cleaned.lower().startswith("the ") and cleaned[4:] not in candidates:
            candidates.append(cleaned[4:])
        if cleaned.lower().startswith("st. ") and cleaned[4:] not in candidates:
            candidates.append(cleaned[4:])
        if cleaned.lower().startswith("st ") and cleaned[3:] not in candidates:
            candidates.append(cleaned[3:])
    return candidates


def _feast_text_aliases(feast_text: str) -> List[str]:
    cleaned = _clean_title(feast_text).lower()
    aliases: List[str] = []
    if "pentecost" in cleaned:
        aliases.extend(["Pentecost Sunday", "Pentecost"])
    return aliases


def _resolve_movable_feast(*, title: str, display_name: str, feast_text: str) -> Optional[str]:
    candidates = _candidate_feast_identifiers(*_feast_text_aliases(feast_text), display_name, title, feast_text)
    if not candidates:
        return None
    search_years = tuple(range(_dt.date.today().year - 5, _dt.date.today().year + 6))
    for candidate in candidates:
        for year in search_years:
            if resolve_romcal_date(candidate, year=year) is not None:
                return resolve_romcal_identifier(candidate, years=search_years)
    return None


def _build_contract_payload(
    *,
    contract_id: str,
    display_name: str,
    feast_payload: Dict[str, Any],
    template_sections: List[Dict[str, Any]],
    template_blocks: List[Dict[str, Any]],
    template_fragments: List[Dict[str, Any]],
    enabled: bool,
) -> Dict[str, Any]:
    template = {
        "template_id": f"url-import-{contract_id}",
        "sections": template_sections,
    }
    if template_blocks:
        template["blocks"] = template_blocks
    if template_fragments:
        template["fragments"] = template_fragments
    payload: Dict[str, Any] = {
        "contract": {
            "family_id": contract_id,
            "id": contract_id,
            "type": "novena_feast_rule",
            "enabled": enabled,
            "saint": {
                "id": contract_id,
                "name": display_name,
            },
            "feast": feast_payload,
            "novena": {
                "duration_days": DEFAULT_NOVENA_DURATION_DAYS,
                "start_offset_days": DEFAULT_NOVENA_START_OFFSET_DAYS,
                "content_mode": "fixed",
                "template": template,
            },
            "publishing": {
                "audio": dict(DEFAULT_AUDIO_CONFIG),
                "rss": {
                    **dict(DEFAULT_RSS_CONFIG),
                    "episode_title_pattern": TRADITIONAL_NOVENA_TITLE_PATTERN,
                },
            },
        }
    }
    return payload


def _validate_and_write_contract(
    *,
    payload: Dict[str, Any],
    output_path: Path,
    force: bool,
) -> None:
    validate_novena_contract(payload, source=str(output_path), template_dir=DEFAULT_TEMPLATE_DIR)
    if output_path.exists() and not force:
        raise RuntimeError(f"Contract already exists: {output_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _derive_output_path(contract_id: str, *, output_dir: Optional[Path] = None) -> Path:
    root = Path(output_dir) if output_dir else DEFAULT_CONTRACT_DIR / "feast-days"
    return root / f"{normalize_contract_filename(contract_id)}.json"


def _extract_detail_page(html_text: str, *, url: str) -> NovenaImportDraft:
    api_key, base_url, model = _resolve_openai_settings()
    return _extract_detail_page_with_resolution(
        html_text,
        url=url,
        resolve_with_openai=bool(api_key),
        openai_api_key=api_key,
        openai_base_url=base_url,
        openai_model=model,
    )


def _extract_detail_page_with_resolution(
    html_text: str,
    *,
    url: str,
    resolve_with_openai: bool,
    openai_api_key: str,
    openai_base_url: str,
    openai_model: str,
) -> NovenaImportDraft:
    title = _extract_title(html_text)
    facts = _extract_detail_facts(html_text)
    template_sections = _extract_prayer_sections(html_text)
    display_name = _clean_title(title)
    starts_text = facts.get("novena starts") or facts.get("starts") or ""
    feast_text = facts.get("feastday") or facts.get("feast day") or facts.get("feast") or ""
    if not feast_text:
        raise RuntimeError("Unable to find feast information.")

    template_sections, section_notes = _resolve_prayer_sections(
        template_sections,
        page_title=title,
        resolve_with_openai=resolve_with_openai,
        openai_api_key=openai_api_key,
        openai_base_url=openai_base_url,
        openai_model=openai_model,
    )
    template_sections, template_blocks, template_fragments = _compact_template_sections(template_sections)

    fixed_date = _parse_fixed_date(feast_text)
    issues: List[str] = []
    feast_mode = ""
    enabled = True
    feast_payload: Optional[Dict[str, Any]] = None

    if fixed_date is not None:
        month, day = fixed_date
        feast_mode = "fixed"
        feast_payload = {
            "mode": "fixed",
            "month": month,
            "day": day,
            "name": display_name,
        }
    else:
        movable_feast_id = _resolve_movable_feast(title=title, display_name=display_name, feast_text=feast_text)
        if movable_feast_id is None:
            enabled = False
            issues.append(f"unable to resolve feast id from '{feast_text}'")
            feast_mode = "romcal_id"
            feast_payload = {
                "mode": "romcal_id",
                "romcal_id": resolve_romcal_identifier(display_name),
                "name": display_name,
            }
        else:
            feast_mode = "romcal_id"
            feast_payload = {
                "mode": "romcal_id",
                "romcal_id": movable_feast_id,
                "name": display_name,
            }
            issues.append(f"movable feast resolved from '{feast_text}'")

    contract_id = resolve_romcal_identifier(display_name)
    payload = _build_contract_payload(
        contract_id=contract_id,
        display_name=display_name,
        feast_payload=feast_payload,
        template_sections=template_sections,
        template_blocks=template_blocks,
        template_fragments=template_fragments,
        enabled=enabled,
    )
    validate_novena_contract(payload, source=url, template_dir=DEFAULT_TEMPLATE_DIR)
    status = "written" if enabled else "disabled"
    return NovenaImportDraft(
        source_url=url,
        title=title,
        display_name=display_name,
        contract_id=contract_id,
        starts_text=starts_text,
        feast_text=feast_text,
        feast_mode=feast_mode,
        enabled=enabled,
        status=status,
        issues=tuple(issues),
        notes=section_notes,
        payload=payload,
        output_path=str(_derive_output_path(contract_id)),
    )


def discover_catalog_entries(
    html_text: str,
    *,
    catalog_url: str,
    month: Optional[Any] = None,
) -> List[CatalogEntry]:
    entries: List[CatalogEntry] = []
    target_month = _parse_month_filter(month)

    soup = BeautifulSoup(html_text, "html.parser")
    month_headings = [tag for tag in soup.find_all("h3") if _month_heading_to_number(tag) is not None]
    for heading in month_headings:
        heading_month = _month_heading_to_number(heading)
        if heading_month is None:
            continue
        if target_month is not None and heading_month != target_month:
            continue
        sibling = heading.next_sibling
        while sibling is not None:
            sibling_name = getattr(sibling, "name", None)
            if sibling_name == "h3":
                break
            if sibling_name == "ul":
                for item in sibling.find_all("li", recursive=False):
                    anchor = item.find("a", href=True)
                    meta = item.find("span")
                    if anchor is None or meta is None:
                        continue
                    href = html.unescape(anchor.get("href", ""))
                    title = _clean_title(anchor.get_text(" ", strip=True))
                    meta_text = _extract_text(str(meta))
                    starts_text = ""
                    feast_text = ""
                    meta_match = re.search(r"Starts:\s*(?P<starts>.*?)\s*(?:•|·)\s*Feast:\s*(?P<feast>.*)$", meta_text, re.IGNORECASE)
                    if meta_match:
                        starts_text = meta_match.group("starts").strip()
                        feast_text = meta_match.group("feast").strip()
                    else:
                        starts_match = re.search(r"Starts:\s*(?P<starts>.*)$", meta_text, re.IGNORECASE)
                        feast_match = re.search(r"Feast:\s*(?P<feast>.*)$", meta_text, re.IGNORECASE)
                        if starts_match:
                            starts_text = starts_match.group("starts").strip()
                        if feast_match:
                            feast_text = feast_match.group("feast").strip()
                    entries.append(
                        CatalogEntry(
                            url=urljoin(catalog_url, href),
                            title=title,
                            starts_text=starts_text,
                            feast_text=feast_text,
                            month=heading_month,
                        )
                    )
            sibling = sibling.next_sibling

    if not entries:
        for match in CATALOG_ITEM_RE.finditer(html_text):
            href = html.unescape(match.group("href"))
            title = _extract_text(match.group("title"))
            meta = _extract_text(match.group("meta"))
            starts_text = ""
            feast_text = ""
            meta_match = re.search(r"Starts:\s*(?P<starts>.*?)\s*(?:•|·)\s*Feast:\s*(?P<feast>.*)$", meta, re.IGNORECASE)
            if meta_match:
                starts_text = meta_match.group("starts").strip()
                feast_text = meta_match.group("feast").strip()
            else:
                starts_match = re.search(r"Starts:\s*(?P<starts>.*)$", meta, re.IGNORECASE)
                feast_match = re.search(r"Feast:\s*(?P<feast>.*)$", meta, re.IGNORECASE)
                if starts_match:
                    starts_text = starts_match.group("starts").strip()
                if feast_match:
                    feast_text = feast_match.group("feast").strip()
            entries.append(
                CatalogEntry(
                    url=urljoin(catalog_url, href),
                    title=title,
                    starts_text=starts_text,
                    feast_text=feast_text,
                )
            )
    return entries


def import_single_url(
    url: str,
    *,
    output_dir: Optional[Path] = None,
    output_path: Optional[Path] = None,
    force: bool = False,
    dry_run: bool = False,
    resolve_with_openai: bool = False,
    openai_api_key: str = "",
    openai_base_url: str = "https://api.openai.com/v1",
    openai_model: str = "gpt-4.1-mini",
    fetcher: Optional[Callable[[str], str]] = None,
) -> NovenaImportReport:
    _ensure_supported_domain(url)
    openai_api_key, openai_base_url, openai_model = _resolve_openai_settings(
        api_key=openai_api_key,
        base_url=openai_base_url,
        model=openai_model,
    )
    report = NovenaImportReport(mode="single", source_url=url)
    try:
        html_text = _fetch_html(url, fetcher=fetcher)
        draft = _extract_detail_page_with_resolution(
            html_text,
            url=url,
            resolve_with_openai=resolve_with_openai,
            openai_api_key=openai_api_key,
            openai_base_url=openai_base_url,
            openai_model=openai_model,
        )
        target_path = Path(output_path) if output_path else _derive_output_path(draft.contract_id, output_dir=output_dir)
        draft = dataclasses.replace(draft, output_path=str(target_path))
        if not dry_run:
            _validate_and_write_contract(payload=draft.payload or {}, output_path=target_path, force=force)
        report.entries.append(draft)
    except Exception as exc:
        report.entries.append(
            NovenaImportDraft(
                source_url=url,
                title="",
                display_name="",
                contract_id="",
                starts_text="",
                feast_text="",
                feast_mode="",
                enabled=False,
                status="failed",
                issues=(str(exc),),
                notes=(),
                payload=None,
                output_path="",
            )
        )
    return report


def import_bulk_catalog(
    catalog_url: str,
    *,
    output_dir: Optional[Path] = None,
    force: bool = False,
    dry_run: bool = False,
    month: Optional[Any] = None,
    resolve_with_openai: bool = False,
    openai_api_key: str = "",
    openai_base_url: str = "https://api.openai.com/v1",
    openai_model: str = "gpt-4.1-mini",
    fetcher: Optional[Callable[[str], str]] = None,
) -> NovenaImportReport:
    _ensure_supported_domain(catalog_url)
    openai_api_key, openai_base_url, openai_model = _resolve_openai_settings(
        api_key=openai_api_key,
        base_url=openai_base_url,
        model=openai_model,
    )
    report = NovenaImportReport(mode="bulk", source_url=catalog_url)
    try:
        catalog_html = _fetch_html(catalog_url, fetcher=fetcher)
        catalog_entries = discover_catalog_entries(catalog_html, catalog_url=catalog_url, month=month)
        if not catalog_entries:
            raise RuntimeError("Catalog page did not yield any novena entries.")
    except Exception as exc:
        report.entries.append(
            NovenaImportDraft(
                source_url=catalog_url,
                title="",
                display_name="",
                contract_id="",
                starts_text="",
                feast_text="",
                feast_mode="",
                enabled=False,
                status="failed",
                issues=(str(exc),),
                notes=(),
                payload=None,
                output_path="",
            )
        )
        return report

    for entry in catalog_entries:
        try:
            html_text = _fetch_html(entry.url, fetcher=fetcher)
            draft = _extract_detail_page_with_resolution(
                html_text,
                url=entry.url,
                resolve_with_openai=resolve_with_openai,
                openai_api_key=openai_api_key,
                openai_base_url=openai_base_url,
                openai_model=openai_model,
            )
            target_path = _derive_output_path(draft.contract_id, output_dir=output_dir)
            draft = dataclasses.replace(draft, output_path=str(target_path))
            if not dry_run:
                _validate_and_write_contract(payload=draft.payload or {}, output_path=target_path, force=force)
            report.entries.append(draft)
        except Exception as exc:
            report.entries.append(
                NovenaImportDraft(
                    source_url=entry.url,
                    title=entry.title,
                    display_name=_clean_title(entry.title),
                    contract_id="",
                    starts_text=entry.starts_text,
                    feast_text=entry.feast_text,
                    feast_mode="",
                    enabled=False,
                    status="failed",
                    issues=(str(exc),),
                    notes=(),
                    payload=None,
                    output_path="",
            )
        )

    return report


def write_single_report(report: NovenaImportReport, *, report_dir: Optional[Path] = None, report_path: Optional[Path] = None) -> Tuple[Path, Path]:
    root = Path(report_dir) if report_dir else DEFAULT_REPORT_DIR
    if report_path is not None:
        base = Path(report_path)
        if base.suffix:
            base = base.with_suffix("")
    else:
        root.mkdir(parents=True, exist_ok=True)
        base = root / "single-report"
    if not base.parent.exists():
        base.parent.mkdir(parents=True, exist_ok=True)
    json_path = base.with_suffix(".json")
    md_path = base.with_suffix(".md")
    json_path.write_text(json.dumps(report.to_dict(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
    md_path.write_text(report.to_markdown() + "\n", encoding="utf-8")
    return json_path, md_path


def write_bulk_report(report: NovenaImportReport, *, report_dir: Optional[Path] = None, report_path: Optional[Path] = None) -> Tuple[Path, Path]:
    root = Path(report_dir) if report_dir else DEFAULT_REPORT_DIR
    if report_path is not None:
        base = Path(report_path)
        if base.suffix:
            base = base.with_suffix("")
    else:
        root.mkdir(parents=True, exist_ok=True)
        base = root / "bulk-report"
    if not base.parent.exists():
        base.parent.mkdir(parents=True, exist_ok=True)
    json_path = base.with_suffix(".json")
    md_path = base.with_suffix(".md")
    json_path.write_text(json.dumps(report.to_dict(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
    md_path.write_text(report.to_markdown() + "\n", encoding="utf-8")
    return json_path, md_path
