"""Calendar-only saint of the day for the Daily Reflection (John, 2026-11-05).

The podcast's saint of the day comes from ONE source: John's devotional
calendar — the same ICS that sits on his Outlook Devotion calendar
(``devotional-calendar-2026-11-06-to-2027-12-31.ics``). No runtime
resolution from romcal, the Roman Martyrology dataset, or the retired
witness ladder (``jobs/publish/saint_witness_ladder.py``, kept for
history and used only as the out-of-range fallback below).

Selection from the calendar, for the target date:

* SUNDAY -> no saint, ever. The Daily Reflection focuses on the day's
  Gospel message only (state ``gospel_only``, reason ``sunday``).
* Liturgical entries name saint(s) -> those saints, all of them, never
  trimmed (source ``calendar``). Entries the calendar itself marks
  superseded (``Superseded:`` descriptions) are not celebrated and do
  not count.
* No liturgical saint, but the day carries a roster entry -> the
  entry's ``Principal:`` saint (source ``roster``), framed as the
  calendar frames it: a private devotion. Roster titles name the
  Principal, and the ending names the bracket's source:
  ``[P2] 🔵 <Principal> — 1962 Calendar (private devotion)`` (the
  traditional calendar of 1962), ``[P3] 🔵 <Principal> — Roman
  Martyrology (private devotion)`` (the Martyrology's own order).
  A ferial Saturday's roster event carries instead the plain
  optional-memorial title ``[m] ⚪ The Blessed Virgin Mary, Optional
  Memorial`` — Our Lady is in the day itself and takes no
  private-devotion label; it is recognized as the roster carrier by
  its roster description (the genuine liturgical Saturday memorial
  bears the identical title but a ``Church observance:``
  description). Older files use the unbracketed ``🔵 Roman
  Martyrology (private devotion)``. The bracket is carried through
  as ``roster_bracket`` (``P2`` / ``P3`` / ``m``).
* Otherwise (solemnities and feasts of the Lord, Ash Wednesday, Holy
  Week, the Easter octave, named observances) -> no saint
  (state ``gospel_only``, reason ``no_saint_named``).

For target dates outside the calendar file's coverage, the resolver
falls back to the previous behavior (the witness ladder over the
repo's liturgical context saint) and says so in the README; the file's
range covers all of 2027 and a new calendar file will supersede it.
"""

from __future__ import annotations

import datetime as dt
import os
import re
from functools import lru_cache
from pathlib import Path

_CALENDAR_PATH = Path(
    os.environ.get(
        "ORA_DEVOTIONAL_CALENDAR_ICS",
        str(
            Path.home()
            / "workspace/goals/saint-of-the-day-picture-rotation/files"
            / "devotional-calendar-2026-11-06-to-2027-12-31.ics"
        ),
    )
)

_ROSTER_TITLE = "🔵 Roman Martyrology (private devotion)"  # legacy unbracketed form
# Current [P2]/[P3] forms: the ending names the bracket's source. Both
# endings are accepted for either bracket here (the calendar build's
# validator enforces the exact pairing); a transitional form ended
# every bracket with the Roman Martyrology label.
_ROSTER_TITLE_RE = re.compile(
    r"^\[(P2|P3)\] 🔵 .+ — (?:1962 Calendar|Roman Martyrology) \(private devotion\)$"
)
# Transitional Saturday form (bracket + circle + Martyrology ending).
_ROSTER_SATURDAY_LEGACY_RE = re.compile(
    r"^\[m\] [🔵⚪] .+ — Roman Martyrology \(private devotion\)$"
)
# Current Saturday form: the plain optional-memorial title. It is the
# day's roster carrier ONLY when its description is the roster
# description — the genuine liturgical Saturday memorial carries the
# identical title with a "Church observance:" description and must
# stay on the liturgical path.
_ROSTER_SATURDAY_TITLE = "[m] ⚪ The Blessed Virgin Mary, Optional Memorial"


def _roster_bracket(summary: str, description: str = "") -> str | None:
    """A roster event's source bracket ('P2'/'P3'/'m'); '' for the legacy
    unbracketed title; None when the event is not a roster event."""
    if summary == _ROSTER_TITLE:
        return ""
    m = _ROSTER_TITLE_RE.match(summary)
    if m:
        return m.group(1)
    if _ROSTER_SATURDAY_LEGACY_RE.match(summary):
        return "m"
    if summary == _ROSTER_SATURDAY_TITLE and description.startswith(
        "Private devotion:"
    ):
        return "m"
    return None

# Observances that name saints without a "Saint"/"Blessed" word in them.
_EXTRA_SAINT_PATTERNS = (
    "Holy Innocents",
    "Holy Founders",
    "Mother of God",
    "Guardian Angels",
    "First Martyrs of the Holy Roman Church",
)


def _unescape(text: str) -> str:
    return (
        text.replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\n", "\n")
        .replace("\\\\", "\\")
    )


@lru_cache(maxsize=1)
def _events_by_date() -> dict:
    """Parse the devotional calendar ICS into {date: [(summary, description)]}."""
    try:
        raw = _CALENDAR_PATH.read_bytes().decode("utf-8")
    except OSError:
        return {}
    raw = re.sub(r"\r\n[ \t]", "", raw)
    raw = re.sub(r"(?<!\r)\n[ \t]", "", raw)
    by_date: dict = {}
    for block in re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", raw, re.S):
        m = re.search(r"DTSTART;VALUE=DATE:(\d{4})(\d{2})(\d{2})", block)
        s = re.search(r"^SUMMARY:(.*)$", block, re.M)
        d = re.search(r"^DESCRIPTION:(.*?)$", block, re.M | re.S)
        if not (m and s and d):
            continue
        day = dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        description = _unescape(d.group(1).strip())
        # DESCRIPTION is the last long field before TRANSP in these events.
        description = description.split("\nTRANSP")[0].strip()
        by_date.setdefault(day, []).append((_unescape(s.group(1).strip()), description))
    return by_date


def calendar_coverage() -> tuple | None:
    """(first, last) date covered by the calendar file, or None if unreadable."""
    by_date = _events_by_date()
    if not by_date:
        return None
    return (min(by_date), max(by_date))


def _observance_name(description: str) -> str:
    """The observance name from a 'Church observance: ...' description."""
    seg = description[len("Church observance: ") :]
    seg = seg.split("Prayer focus:")[0].strip()
    seg = seg.split(". ")[0].rstrip(".").strip()
    # Drop calendar annotations in trailing parentheses, e.g.
    # "The Blessed Virgin Mary (Saturday memorial)".
    seg = re.sub(r"\s*\((?:Saturday memorial)\)\s*$", "", seg)
    return seg


def _names_saint(name: str) -> bool:
    """True when a liturgical observance name names saint(s)."""
    if "Dedication of" in name[:22]:  # Lateran; Basilica of St Mary Major
        return False
    if "Blessed Virgin Mary" in name or "Our Lady" in name:
        return True
    if re.search(r"\bSaints?\b", name):
        return True
    if name.startswith(("Blessed ", "St. ", "Sts. ", "The Holy Family")):
        return True
    return any(p in name for p in _EXTRA_SAINT_PATTERNS)


def _empty_result() -> dict:
    return {
        "witness_name": "",
        "witness_source": "gospel_only",
        "witness_state": "gospel_only",
        "gospel_reason": "",
        "roster_bracket": "",
        "saints": [],
        "litany_persons": [],
        "principal": "",
        "martyrology_lead": "",
        "martyrology_text": "",
        "calendar_1962": "",
        "saintWitnessQuote": "",
        "saintWitnessQuoteSource": "",
        "saintWitnessQuoteSourceUrl": "",
    }


def calendar_saint_for(target: dt.date) -> dict | None:
    """The day's saint from the devotional calendar, or None out of range."""
    coverage = calendar_coverage()
    if coverage is None or not (coverage[0] <= target <= coverage[1]):
        return None
    result = _empty_result()
    if target.weekday() == 6:  # Sunday: Gospel only, absolute.
        result["gospel_reason"] = "sunday"
        return result
    saints: list[str] = []
    litany_persons: list[str] = []
    principal = ""
    roster_bracket = ""
    for summary, description in _events_by_date().get(target, []):
        bracket = _roster_bracket(summary, description)
        if bracket is not None:
            roster_bracket = bracket
            m = re.search(r"Principal:\s*(.+?)\.\s*Source:", description, re.S)
            if m:
                principal = m.group(1).strip()
            continue
        if description.startswith("Superseded:"):
            continue  # The calendar itself says this observance is not kept.
        if description.startswith("Church observance: "):
            name = _observance_name(description)
            if not name:
                continue
            # v580: a dedication feast yields its associated person(s)
            # to the litany (never the event words). The persons ride
            # a separate field — the Daily Reflection's saint stands
            # exactly as before.
            from jobs.publish.feast_classification import classify_feast

            feast = classify_feast(name)
            if feast.kind == "dedication":
                for person in feast.persons:
                    if person not in litany_persons:
                        litany_persons.append(person)
            if _names_saint(name) and name not in saints:
                saints.append(name)
    result["litany_persons"] = litany_persons
    if saints:
        result["witness_name"] = "; ".join(saints)
        result["witness_source"] = "calendar"
        result["witness_state"] = "saint"
        result["saints"] = saints
        return result
    if principal:
        result["witness_name"] = principal
        result["witness_source"] = "roster"
        result["witness_state"] = "saint"
        result["roster_bracket"] = roster_bracket
        result["principal"] = principal
        return result
    result["gospel_reason"] = "no_saint_named"
    return result


def resolve_saint_of_day(target: dt.date, calendar_saint: str = "") -> dict:
    """Resolve the Daily Reflection saint for ``target``.

    Inside the devotional calendar's range the calendar is the ONLY
    source. Outside it, fall back to the previous behavior — the witness
    ladder (``jobs/publish/saint_witness_ladder.py``) over the repo
    liturgical context's saint — until a new calendar file supersedes.
    """
    result = calendar_saint_for(target)
    if result is not None:
        return result
    from jobs.publish.saint_witness_ladder import resolve_witness

    legacy = resolve_witness(target, calendar_saint=calendar_saint)
    legacy["witness_state"] = "saint" if legacy["witness_name"] else "gospel_only"
    legacy["gospel_reason"] = "" if legacy["witness_name"] else "no_saint_named"
    legacy["saints"] = [legacy["witness_name"]] if legacy["witness_name"] else []
    legacy["litany_persons"] = []
    legacy["principal"] = ""
    legacy["roster_bracket"] = legacy.get("roster_bracket", "")
    return legacy
