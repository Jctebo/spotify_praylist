from __future__ import annotations

import datetime as _dt
import re
from dataclasses import dataclass
from string import Formatter
from typing import Any, Dict, Mapping, Optional

_TEMPLATE_FIELD_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_EPISODE_DATE_RE = re.compile(r"(?<!\d)(\d{4}-\d{2}-\d{2})(?!\d)")
_RSS_GUID_SEPARATOR = "::"


@dataclass(frozen=True)
class TemplateDate:
    value: _dt.date

    def __format__(self, format_spec: str) -> str:
        spec = str(format_spec or "")
        if not spec:
            return self.value.isoformat()

        rendered_spec = spec
        markers: Dict[str, str] = {}
        for token, marker, replacement in (
            ("%-d", "__DAY_NO_PAD__", str(self.value.day)),
            ("%#d", "__DAY_NO_PAD__", str(self.value.day)),
            ("%-m", "__MONTH_NO_PAD__", str(self.value.month)),
            ("%#m", "__MONTH_NO_PAD__", str(self.value.month)),
        ):
            if token in rendered_spec:
                rendered_spec = rendered_spec.replace(token, marker)
                markers[marker] = replacement

        rendered = self.value.strftime(rendered_spec)
        for marker, replacement in markers.items():
            rendered = rendered.replace(marker, replacement)
        return rendered


def _normalize_date(value: Optional[_dt.date]) -> _dt.date:
    if value is None:
        return _dt.date.today()
    if isinstance(value, _dt.datetime):
        return value.date()
    if not isinstance(value, _dt.date):
        raise RuntimeError(f"Invalid template date value: {value!r}")
    return value


def format_date(value: _dt.date, format_spec: str) -> str:
    return format(TemplateDate(_normalize_date(value)), format_spec)


def build_publish_context(
    *,
    contract_id: str,
    contract_type: str,
    frequency: str,
    timezone: str,
    version: str,
    entry: Mapping[str, Any],
    target_date: Optional[_dt.date] = None,
    season: str = "",
) -> Dict[str, Any]:
    effective_date = _normalize_date(target_date)
    entry_id = str(entry.get("entry_id", "")).strip()
    entry_title = str(entry.get("title", "")).strip()
    normalized_season = str(season or "").strip().lower()
    season_label = ""
    if normalized_season == "easter":
        season_label = "Easter Season"
    elif normalized_season == "ordinary":
        season_label = "Ordinary Time"
    return {
        "contract_id": str(contract_id or "").strip(),
        "contract_type": str(contract_type or "").strip(),
        "frequency": str(frequency or "").strip(),
        "timezone": str(timezone or "").strip(),
        "version": str(version or "").strip(),
        "season": normalized_season,
        "season_label": season_label,
        "entry_id": entry_id,
        "entry_title": entry_title,
        "title": entry_title,
        "date": TemplateDate(effective_date),
        "date_iso": effective_date.isoformat(),
        "date_display": format_date(effective_date, "%B %-d, %Y"),
        "date_long": format_date(effective_date, "%A, %B %-d, %Y"),
        "date_year": effective_date.year,
        "date_month": effective_date.month,
        "date_day": effective_date.day,
        "year": effective_date.year,
        "month": effective_date.month,
        "day": effective_date.day,
        "weekday": effective_date.strftime("%A").lower(),
        "weekday_name": effective_date.strftime("%A"),
        "month_name": effective_date.strftime("%B"),
        "episode_id": f"{entry_id}-{effective_date.isoformat()}" if entry_id else effective_date.isoformat(),
    }


def render_publish_template(template: Any, context: Mapping[str, Any]) -> str:
    text = str(template or "").strip()
    if not text:
        return ""

    formatter = Formatter()
    rendered_parts = []
    for literal, field_name, format_spec, conversion in formatter.parse(text):
        rendered_parts.append(literal)
        if field_name is None:
            continue
        if conversion:
            raise RuntimeError(f"Unsupported template conversion '!{conversion}' in '{text}'.")
        if not _TEMPLATE_FIELD_RE.fullmatch(field_name):
            raise RuntimeError(f"Unsupported template placeholder '{field_name}' in '{text}'.")
        if field_name not in context:
            raise RuntimeError(f"Unknown template placeholder '{field_name}' in '{text}'.")
        rendered_parts.append(format(context[field_name], format_spec))

    return "".join(rendered_parts).strip()


def derive_episode_id(*, context: Mapping[str, Any], template: Any = None) -> str:
    fallback = str(context.get("episode_id", "")).strip()
    candidate = render_publish_template(template, context) if str(template or "").strip() else fallback
    value = re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", str(candidate or "").strip().lower())).strip("-")
    if not value:
        raise RuntimeError("Derived episode id rendered empty.")
    return value


def episode_date_from_episode_id(episode_id: str) -> Optional[_dt.date]:
    text = str(episode_id or "").strip()
    if not text:
        return None
    matches = list(_EPISODE_DATE_RE.finditer(text))
    for match in reversed(matches):
        try:
            return _dt.date.fromisoformat(match.group(1))
        except Exception:
            continue
    return None


def compose_rss_guid(episode_id: str, revision_token: str) -> str:
    episode = str(episode_id or "").strip()
    revision = str(revision_token or "").strip()
    if not revision:
        return episode
    if not episode:
        return revision
    return f"{episode}{_RSS_GUID_SEPARATOR}{revision}"


def split_rss_guid(rss_guid: str) -> tuple[str, str]:
    text = str(rss_guid or "").strip()
    if not text:
        return "", ""
    if _RSS_GUID_SEPARATOR in text:
        episode_id, revision = text.split(_RSS_GUID_SEPARATOR, 1)
        return episode_id.strip(), revision.strip()
    return text, ""
