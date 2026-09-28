"""Bounded, fail-closed Outlook ICS parsing for devotional wallpapers."""

from __future__ import annotations

import datetime as dt
import hashlib
import html
import re
from dataclasses import dataclass
from email.message import Message
from typing import Any, Iterable, Optional
from zoneinfo import ZoneInfo

import recurring_ical_events
import requests
from icalendar import Calendar

from jobs.novena.devotional_image_contract import (
    CHICAGO,
    CLASSIFICATION_ORDER,
    MONTHLY_DEVOTIONS,
    DailyImageSpec,
)


MAX_FEED_BYTES = 10 * 1024 * 1024
FETCH_TIMEOUT = (10, 30)
SEQUENCE_RE = re.compile(r"\b(TRIDUUM|OCTAVE)\s+OF\s+(.+?)\s*\[\s*DAY\s*(\d+)\s*\]", re.I)
SEQUENCE_AFTER_SUBJECT_RE = re.compile(r"\b(TRIDUUM|OCTAVE)\s+DAY\s*(\d+)\b", re.I)
PRIVATE_RE = re.compile(r"\(private devotion\)", re.I)
PREFIX_RE = re.compile(r"^\s*\[(F|M|m)\]\s*")
DECORATION_RE = re.compile(r"^[\s\U0001f300-\U0001faff\u2600-\u27bf]+")
CLASS_SUFFIX_RE = re.compile(r"(?:,\s*)?(Solemnity|Feast|Optional Memorial|Memorial)\s*$", re.I)
CONTEXT_EVENT_RE = re.compile(r"^(?:\U0001f7e2\s*)?(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b|\d+[\wºª]*\s+(?:Sunday|Weekday)\b)", re.I)
ORDINAL_PREFIX_RE = re.compile(r"^.*?\bWeek\s+in\s+Ordinary\s+Time\s*(?:—|-|–)\s*", re.I)


@dataclass(frozen=True)
class CalendarSnapshot:
    body: bytes
    checksum: str
    etag: str = ""
    last_modified: str = ""
    retrieved_at: dt.datetime = dt.datetime.min.replace(tzinfo=dt.timezone.utc)


@dataclass(frozen=True)
class CalendarResolution:
    specs: dict[dt.date, DailyImageSpec]
    covered_through: Optional[dt.date]
    feed_checksum: str
    missing_dates: tuple[dt.date, ...]


def fetch_calendar(url: str, *, session: Any = requests, now: Optional[dt.datetime] = None) -> CalendarSnapshot:
    if not url:
        raise RuntimeError("DEVOTIONAL_ICS_URL is required")
    response = session.get(url, timeout=FETCH_TIMEOUT, allow_redirects=True, stream=True)
    final_url = getattr(response, "url", url)
    if not str(final_url).lower().startswith("https://"):
        raise RuntimeError("Devotional calendar redirects away from HTTPS")
    try:
        response.raise_for_status()
        content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if content_type not in {"text/calendar", "application/octet-stream", "application/ics"}:
            raise RuntimeError("Devotional calendar returned an unsupported content type")
        chunks = []
        total = 0
        for chunk in response.iter_content(chunk_size=64 * 1024):
            if not chunk:
                continue
            total += len(chunk)
            if total > MAX_FEED_BYTES:
                raise RuntimeError("Devotional calendar exceeds the 10 MiB size limit")
            chunks.append(chunk)
        body = b"".join(chunks)
        return CalendarSnapshot(
            body=body,
            checksum=hashlib.sha256(body).hexdigest(),
            etag=response.headers.get("ETag", ""),
            last_modified=response.headers.get("Last-Modified", ""),
            retrieved_at=now or dt.datetime.now(dt.timezone.utc),
        )
    except requests.RequestException as exc:
        raise RuntimeError(f"Unable to fetch devotional calendar ({type(exc).__name__})") from None
    finally:
        response.close()


def parse_calendar(body: bytes) -> Calendar:
    if len(body) > MAX_FEED_BYTES:
        raise RuntimeError("Devotional calendar exceeds the 10 MiB size limit")
    try:
        calendar = Calendar.from_ical(body)
    except Exception as exc:
        raise RuntimeError(f"Invalid iCalendar data ({type(exc).__name__})") from None
    if calendar.name != "VCALENDAR":
        raise RuntimeError("Calendar response did not contain VCALENDAR")
    if not any(component.name == "VEVENT" for component in calendar.walk()):
        raise RuntimeError("Calendar contains no events")
    return calendar


def _as_local_date(value: Any) -> dt.date:
    raw = value.dt if hasattr(value, "dt") else value
    if isinstance(raw, dt.datetime):
        if raw.tzinfo is not None:
            raw = raw.astimezone(CHICAGO)
        return raw.date()
    if isinstance(raw, dt.date):
        return raw
    raise RuntimeError("Calendar event has an unsupported date value")


def _clean_ics_text(value: Any) -> str:
    raw = html.unescape(str(value or ""))
    raw = raw.replace("\\n", " ").replace("\\N", " ")
    raw = re.sub(r"\\([,;\\])", r"\1", raw)
    raw = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", raw).strip()


def _date_component(component: Any, field: str) -> Optional[dt.date]:
    value = component.get(field)
    return _as_local_date(value) if value is not None else None


def _is_cancelled(event: Any) -> bool:
    status = event.get("STATUS")
    if status is None:
        return False
    return _clean_ics_text(status).upper() == "CANCELLED"


def _event_identity(event: Any) -> tuple[str, str]:
    uid = _clean_ics_text(event.get("UID"))
    recurrence = event.get("RECURRENCE-ID")
    rec_id = ""
    if recurrence is not None:
        rec_id = _as_local_date(recurrence).isoformat()
    return uid, rec_id


def _description_overrides(description: str) -> dict[str, str]:
    blocks = re.findall(r"\[DEVOTIONAL-IMAGE\](.*?)\[/DEVOTIONAL-IMAGE\]", description, re.I | re.S)
    if len(blocks) > 1:
        raise RuntimeError("Event contains more than one DEVOTIONAL-IMAGE block")
    if not blocks:
        return {}
    values: dict[str, str] = {}
    allowed = {"classification", "priority", "display_title", "subtitle", "sequence", "sequence_day", "iconography", "include"}
    for line in blocks[0].splitlines():
        if not line.strip():
            continue
        if ":" not in line:
            raise RuntimeError("Malformed DEVOTIONAL-IMAGE metadata line")
        key, value = line.split(":", 1)
        key = key.strip().lower()
        if key not in allowed:
            continue
        if key in values:
            raise RuntimeError(f"Duplicate DEVOTIONAL-IMAGE field: {key}")
        values[key] = value.strip()
    return values


def _classification_from_title(summary: str, fields: dict[str, str]) -> Optional[str]:
    explicit = fields.get("classification", "").upper()
    if explicit:
        if explicit not in CLASSIFICATION_ORDER:
            raise RuntimeError(f"Unsupported devotional classification: {explicit}")
        return explicit
    match = PREFIX_RE.match(summary)
    if match:
        return {"F": "FEAST", "M": "MEMORIAL", "m": "OPTIONAL MEMORIAL"}[match.group(1)]
    if PRIVATE_RE.search(summary):
        return "PRIVATE DEVOTION"
    suffix = CLASS_SUFFIX_RE.search(summary)
    if suffix:
        normalized = suffix.group(1).upper()
        return normalized
    return None


def _title_from_event(summary: str, fields: dict[str, str]) -> str:
    if fields.get("display_title"):
        return fields["display_title"].upper().strip()
    title = PREFIX_RE.sub("", summary, count=1)
    title = DECORATION_RE.sub("", title)
    title = CONTEXT_EVENT_RE.sub("", title).strip(" -–—,;[]")
    title = ORDINAL_PREFIX_RE.sub("", title)
    title = re.sub(r"^(?:IN\s+THE\s+)?\d+[\wºª]*\s+(?:WEEK|SUNDAY)\s+IN\s+ORDINARY\s+TIME\s*(?:—|-|–)\s*", "", title, flags=re.I)
    sequence = SEQUENCE_RE.search(title)
    if sequence:
        title = sequence.group(2)
    else:
        title = SEQUENCE_AFTER_SUBJECT_RE.sub("", title).strip(" -–—,;[]")
    title = PRIVATE_RE.sub("", title)
    title = CLASS_SUFFIX_RE.sub("", title).strip(" -–—,;[]")
    title = re.sub(r"\s*\[[FfMm]\]\s*", " ", title)
    return re.sub(r"\s+", " ", title).strip(" ,;–—-").upper()


def _event_spec(event: Any, target_date: dt.date) -> Optional[DailyImageSpec]:
    if _is_cancelled(event):
        return None
    raw_summary = _clean_ics_text(event.get("SUMMARY"))
    if not raw_summary:
        return None
    description = _clean_ics_text(event.get("DESCRIPTION"))
    fields = _description_overrides(description)
    include = fields.get("include", "true").lower()
    if include not in {"true", "false", "yes", "no", "1", "0"}:
        raise RuntimeError("DEVOTIONAL-IMAGE include must be true or false")
    if include in {"false", "no", "0"}:
        return None
    if _is_context_event(event):
        return None
    if PRIVATE_RE.search(raw_summary) and "(private devotion)" not in description.lower():
        description = f"{description} (private devotion)"
    sequence_match = SEQUENCE_RE.search(raw_summary)
    sequence_after_subject = SEQUENCE_AFTER_SUBJECT_RE.search(raw_summary)
    sequence_subject = ""
    if not sequence_match and sequence_after_subject:
        # A title can express a sequence after its subject; keep the subject
        # text while still displaying the correct day label.
        sequence_subject = raw_summary[:sequence_after_subject.start()].strip(" -–—,;[]")
    seq_kind = fields.get("sequence", "").upper() or (sequence_match.group(1).upper() if sequence_match else sequence_after_subject.group(1).upper() if sequence_after_subject else "")
    seq_day_raw = fields.get("sequence_day", "") or (sequence_match.group(3) if sequence_match else sequence_after_subject.group(2) if sequence_after_subject else "")
    seq_day: Optional[int] = None
    if seq_day_raw:
        if not re.fullmatch(r"\d+", seq_day_raw):
            raise RuntimeError("sequence_day must be an integer")
        seq_day = int(seq_day_raw)
    classification = _classification_from_title(raw_summary, fields)
    if classification is None:
        # Liturgical weekday and Sunday context events are not wallpaper subjects.
        if _is_context_event(event):
            return None
        raise RuntimeError(f"Unclassified devotional calendar event on {target_date.isoformat()}")
    title = sequence_subject.upper() if sequence_subject else _title_from_event(raw_summary, fields)
    if not title:
        raise RuntimeError(f"Calendar event on {target_date.isoformat()} has no usable display title")
    priority_raw = fields.get("priority", "100")
    if not re.fullmatch(r"\d+", priority_raw) or int(priority_raw) < 1:
        raise RuntimeError("DEVOTIONAL-IMAGE priority must be a positive integer")
    uid, recurrence_id = _event_identity(event)
    return DailyImageSpec(
        date=target_date,
        title=title,
        classification=classification,
        source_kind="calendar",
        subtitle=fields.get("subtitle", ""),
        priority=int(priority_raw),
        source_uid=uid,
        recurrence_id=recurrence_id,
        sequence_kind=seq_kind,
        sequence_day=seq_day,
        iconography=fields.get("iconography", ""),
    )


def _is_context_event(event: Any) -> bool:
    if _is_cancelled(event):
        return False
    summary = _clean_ics_text(event.get("SUMMARY"))
    return bool(CONTEXT_EVENT_RE.match(summary))


def _occurrences(calendar: Calendar, start: dt.date, end: dt.date) -> list[Any]:
    start_dt = dt.datetime.combine(start, dt.time.min, tzinfo=CHICAGO)
    stop_dt = dt.datetime.combine(end + dt.timedelta(days=1), dt.time.min, tzinfo=CHICAGO)
    try:
        return list(recurring_ical_events.of(calendar).between(start_dt, stop_dt))
    except Exception as exc:
        raise RuntimeError(f"Unable to expand devotional calendar recurrence ({type(exc).__name__})") from None


def resolve_calendar(
    body: bytes,
    dates: Iterable[dt.date],
) -> CalendarResolution:
    calendar = parse_calendar(body)
    targets = sorted(set(dates))
    if not targets:
        raise RuntimeError("At least one target date is required")
    end_date = targets[-1]
    occurrences = _occurrences(calendar, targets[0], end_date)
    by_date: dict[dt.date, list[DailyImageSpec]] = {d: [] for d in targets}
    represented_dates: set[dt.date] = set()
    context_dates: set[dt.date] = set()
    seen: set[tuple[str, str, dt.date]] = set()
    target_set = set(targets)
    for event in occurrences:
        start_date = _date_component(event, "DTSTART")
        if start_date not in target_set or _is_cancelled(event):
            continue
        represented_dates.add(start_date)
        if _is_context_event(event):
            context_dates.add(start_date)
        identity = (*_event_identity(event), start_date)
        if identity in seen:
            continue
        seen.add(identity)
        spec = _event_spec(event, start_date)
        if spec is not None:
            by_date[start_date].append(spec)

    resolved: dict[dt.date, DailyImageSpec] = {}
    for date, candidates in by_date.items():
        if not candidates and date in context_dates:
            resolved[date] = DailyImageSpec(
                date=date,
                title=MONTHLY_DEVOTIONS[date.month],
                classification="PRIVATE DEVOTION",
                source_kind="monthly",
                subtitle="",
                monthly_fallback=True,
            )
            continue
        if not candidates:
            continue
        candidates.sort(key=lambda spec: (spec.priority, CLASSIFICATION_ORDER[spec.classification]))
        winner = candidates[0]
        if len(candidates) > 1 and (winner.priority, CLASSIFICATION_ORDER[winner.classification]) == (
            candidates[1].priority,
            CLASSIFICATION_ORDER[candidates[1].classification],
        ):
            raise RuntimeError(f"Calendar has unresolved devotional subject tie on {date.isoformat()}")
        resolved[date] = winner
    return CalendarResolution(
        specs=resolved,
        covered_through=None,
        feed_checksum=hashlib.sha256(body).hexdigest(),
        missing_dates=tuple(d for d in targets if d not in represented_dates),
    )
