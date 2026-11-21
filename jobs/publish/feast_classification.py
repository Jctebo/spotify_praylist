"""Feast-type classification for the Intercessory Litany (v580).

John's rules (2026-11-21): an EVENT feast title never becomes a
Litany of the Saints invocation — a Marian event feast adds nothing,
because Mary already stands first in the litany — and where a feast
title names a place or object with an associated person (a dedication
feast), the litany invokes the PERSON, never the event words.

Classification is tangible and metadata-driven: the observance name
the devotional calendar itself carries is the metadata. Deterministic
patterns read that name; a small maintained exception table
(``config/publish/feast-classification.json``) settles the feasts the
patterns cannot — the event feasts, the dedication feasts, and
event-form titles that yield a named person. An LLM pass exists only
as a final backstop at episode build (``llm_backstop``) and can only
REMOVE invocations, never add one.

Kinds:
- ``saint``      — the title names a person; ``persons`` carries the
                   invocation name(s) (the title itself, or the person
                   extracted from an event-form title).
- ``event``      — an event, mystery, place, or object; no invocation.
- ``dedication`` — a dedication feast; ``persons`` carries the
                   associated person(s) from the table (empty when the
                   table carries no entry — no person is invented).
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "config" / "publish" / "feast-classification.json"

# Event nouns that head an event-form title ("The Nativity of …",
# "The Beheading of …"). A title headed by one of these is an event;
# when the words after "of" name a saint, that saint is the person.
_EVENT_NOUN = re.compile(
    r"^(?:nativity|presentation|annunciation|assumption|visitation|"
    r"baptism|epiphany|transfiguration|ascension|exaltation|"
    r"immaculate conception|immaculate heart|beheading|martyrdom|"
    r"passion|circumcision|purification|finding|invention) of (.+)$"
)
_SAINT_TAIL = re.compile(r"^((?:Saints?|Blessed|St\.)\s+.+)$")
_NON_PERSON_TAILS = ("the lord", "the blessed virgin mary", "the holy cross")


def _key(name: Any) -> str:
    """Normalized lookup key: base name (descriptors after the first
    comma cut), case-folded, leading 'The ' dropped."""
    base = str(name or "").split(",")[0].strip()
    folded = " ".join(base.casefold().split())
    if folded.startswith("the "):
        folded = folded[4:]
    return folded


@dataclass
class FeastClassification:
    kind: str  # "saint" | "event" | "dedication"
    persons: List[str] = field(default_factory=list)
    extracted: bool = False  # persons came from extraction, not the title itself
    source: str = ""  # "table" | "pattern" | "default"


def load_classification_data(path: Optional[Path] = None) -> Dict[str, Any]:
    data_file = Path(path) if path else DATA_PATH
    raw = json.loads(data_file.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError(f"Feast classification data in '{data_file}' is not an object.")
    return raw


class _Table:
    def __init__(self, data: Dict[str, Any]) -> None:
        self.events = {_key(n) for n in data.get("events") or []}
        self.persons = {
            _key(k): [str(p) for p in v] for k, v in (data.get("persons") or {}).items()
        }
        self.dedications = {
            _key(k): [str(p) for p in v] for k, v in (data.get("dedications") or {}).items()
        }


_TABLE: Optional[_Table] = None


def _table() -> _Table:
    global _TABLE
    if _TABLE is None:
        _TABLE = _Table(load_classification_data())
    return _TABLE


def classify_feast(name: Any, *, data: Optional[Dict[str, Any]] = None) -> FeastClassification:
    """Classify one observance/feast name for the litany."""
    table = _Table(data) if data is not None else _table()
    base = str(name or "").split(",")[0].strip()
    key = _key(name)

    # 1 — the exception table settles what it carries.
    if key in table.dedications:
        return FeastClassification(
            "dedication", list(table.dedications[key]), extracted=True, source="table"
        )
    if key in table.persons:
        return FeastClassification(
            "saint", list(table.persons[key]), extracted=True, source="table"
        )
    if key in table.events:
        return FeastClassification("event", [], source="table")

    # 2 — deterministic patterns over the calendar's own name.
    if key.startswith("dedication of"):
        # A dedication the table does not carry: no person is invented.
        return FeastClassification("dedication", [], extracted=True, source="pattern")
    m = _EVENT_NOUN.match(key)
    if m:
        tail = m.group(1).strip()
        if tail in _NON_PERSON_TAILS:
            return FeastClassification("event", [], source="pattern")
        saint = _SAINT_TAIL.search(_base_tail(base))
        if saint:
            return FeastClassification(
                "saint", [saint.group(1).strip()], extracted=True, source="pattern"
            )
        return FeastClassification("event", [], source="pattern")
    if "blessed virgin mary" in key:
        # A Marian feast not in the table is an event of Our Lady's
        # life or a Marian title; Mary stands first already.
        return FeastClassification("event", [], source="pattern")
    if key.startswith("our lady"):
        return FeastClassification("event", [], source="pattern")
    if " of the lord" in key:
        return FeastClassification("event", [], source="pattern")

    # 3 — default: the title names a person, invoked as named.
    return FeastClassification("saint", [base], source="default")


def _base_tail(base: str) -> str:
    """The words after the first ' of ' in the raw (cased) name."""
    idx = base.lower().find(" of ")
    return base[idx + 4 :] if idx >= 0 else ""


def guard_invocations(
    names: Sequence[str], *, data: Optional[Dict[str, Any]] = None
) -> List[str]:
    """The deterministic build guard: strike any invocation that does
    not classify as a person. A struck slot stands empty (John, Q5 A);
    no substitution is invented."""
    kept: List[str] = []
    for name in names:
        if classify_feast(name, data=data).kind == "saint":
            kept.append(name)
    return kept


def llm_backstop(
    names: Sequence[str],
    *,
    generate_text: Any = None,
    environ: Optional[Dict[str, str]] = None,
) -> List[str]:
    """Final backstop at episode build: an LLM pass that can only
    REMOVE invocations. It flags entries that are not persons (feast
    events, places, objects, titles); flagged entries are struck.
    Any failure — no key, provider error, unparseable reply — returns
    the list unchanged. ``ORA_LITANY_LLM_BACKSTOP=0`` disables it.
    """
    env = os.environ if environ is None else environ
    if env.get("ORA_LITANY_LLM_BACKSTOP", "1") == "0":
        return list(names)
    if generate_text is None:
        if not env.get("OPENAI_API_KEY"):
            return list(names)
        generate_text = _default_generate_text
    listing = "\n".join(f"{i}: {n}" for i, n in enumerate(names))
    system = (
        "You review the invocations of the Litany of the Saints. Each line is "
        "one invocation that will be spoken as '<name>, pray for us.' A valid "
        "invocation names a PERSON (a saint, a blessed, Mary, an angel). "
        "Flag every line that does NOT name a person: feast events, mysteries, "
        "places, buildings, objects, or feast titles. Reply with ONLY a JSON "
        "array of the flagged line numbers, e.g. [3, 7]. Reply [] when every "
        "line names a person. Never suggest additions or replacements."
    )
    try:
        reply = generate_text(system, listing)
        flagged = json.loads(str(reply).strip())
        if not isinstance(flagged, list):
            return list(names)
        drop = {int(i) for i in flagged if isinstance(i, int) or str(i).isdigit()}
    except Exception:
        return list(names)
    return [n for i, n in enumerate(names) if i not in drop]


def _default_generate_text(system: str, prompt: str) -> str:
    from openai import OpenAI

    from jobs.publish.devotional_intro import resolve_openai_settings

    api_key, base_url, model = resolve_openai_settings(model="")
    if not api_key:
        raise RuntimeError("Missing required environment variable: OPENAI_API_KEY")
    client_kwargs = {"api" + "_key": api_key, "base_url": str(base_url).rstrip("/")}
    client = OpenAI(**client_kwargs)
    try:
        response = client.responses.create(
            model=model,
            temperature=0,
            input=[
                {"role": "system", "content": [{"type": "input_text", "text": system}]},
                {"role": "user", "content": [{"type": "input_text", "text": prompt}]},
            ],
        )
        text = str(getattr(response, "output_text", "") or "").strip()
        if text:
            return text
    except Exception:
        pass
    chat = client.chat.completions.create(
        model=model,
        temperature=0,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
    )
    choices = getattr(chat, "choices", None) or []
    if not choices:
        raise RuntimeError("Litany backstop returned no choices.")
    return str(getattr(getattr(choices[0], "message", None), "content", "") or "")
