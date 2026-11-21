"""Saints ladder for the Morning Prayer Intercessory Litany (v306).

The litany keeps its spoken form — Kyrie frame, one "Saint …, pray for
us" per saint, the closing line — but the named saints are resolved
nightly from three tiers (John's answers, 2026-11-08):

1. CORE — the nine fixed saints, in data order, never displaced.
2. THE DAY'S SAINTS — the devotional calendar's feast saint(s) first
   (calendar order), then every saint whose novena window is open
   (Rule A, no cap), in the production resolver's own order.
3. PATRONS — the show's sixteen patrons, in data order, skipping any
   saint already placed higher (a patron in a window is invoked in
   the window position and not repeated).

A saint is invoked once, in the highest tier they qualify for. No tier
name is ever rendered. Marian titles and non-saint feasts add no
invocation — since v580 that rule stands in code, not only here: the
feast intake classifies every feast name through
jobs.publish.feast_classification (event feasts are skipped,
dedication feasts yield their person), and a deterministic guard
strikes any resolved invocation that does not classify as a person.
Membership is data (config/publish/saints-ladder.json); this module
is the mechanism only.

Identity: saints are matched through the alias machinery
(jobs.novena_contracts.saint_aliases.canonical_saint_key) first, then
through the data file's match lists and window-name map; name forms
the alias table does not cover fall back to this module's normalized
matching (NFKD-folded, descriptor cut at the first comma).
"""

from __future__ import annotations

import datetime as _dt
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from jobs.novena_contracts.saint_aliases import (
    canonical_saint_key,
    normalize_saint_id,
    normalize_saint_name,
)

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "config" / "publish" / "saints-ladder.json"

_FRAME_HEAD = (
    "Litany of the Saints",
    "Lord, have mercy.",
    "Lord, have mercy.",
    "Christ, have mercy.",
    "Christ, have mercy.",
    "Lord, have mercy.",
    "Lord, have mercy.",
)
_FRAME_TAIL = (
    "All holy men and women, Saints of God,",
    "pray for us.",
)

_LAST_WARNINGS: List[str] = []
_PRIMED_WINDOWS: Dict[_dt.date, List[Any]] = {}


def last_warnings() -> List[str]:
    """Warnings collected by the most recent resolve (unmapped window
    identities, feast saints invoked as named). pass1 prints these
    into the nightly run output."""
    return list(_LAST_WARNINGS)


def prime_window_runtimes(target: _dt.date, runtimes: Sequence[Any]) -> None:
    """Inject the night's already-computed window runtimes so the
    ladder does not pay the resolver cost a second time."""
    _PRIMED_WINDOWS[target] = list(runtimes)


def load_ladder_data(path: Optional[Path] = None) -> Dict[str, Any]:
    """Load and validate the ladder data file. Raises on any problem —
    the contracts branch treats a raise as 'use the fallback file'."""
    data_file = Path(path) if path else DATA_PATH
    raw = json.loads(data_file.read_text(encoding="utf-8"))
    return _validate_ladder_data(raw, source=str(data_file))


def _validate_ladder_data(raw: Any, *, source: str = "data") -> Dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError(f"Saints ladder data in '{source}' is not an object.")
    core = raw.get("core")
    patrons = raw.get("patrons")
    window_names = raw.get("window_names")
    if not isinstance(core, list) or not core:
        raise ValueError("Saints ladder data has no core list.")
    if not isinstance(patrons, list) or not patrons:
        raise ValueError("Saints ladder data has no patrons list.")
    if not isinstance(window_names, dict):
        raise ValueError("Saints ladder data has no window_names map.")
    seen_keys = set()
    for entry in list(core) + list(patrons):
        if not isinstance(entry, dict) or not entry.get("key") or not entry.get("spoken"):
            raise ValueError(f"Saints ladder membership entry is malformed: {entry!r}")
        if entry["key"] in seen_keys:
            raise ValueError(f"Saints ladder membership key repeats: {entry['key']}")
        seen_keys.add(entry["key"])
    return raw


def minimum_invocation_count(data: Optional[Dict[str, Any]] = None) -> int:
    """Core + patrons: the floor a healthy resolve never falls below."""
    payload = data if data is not None else load_ladder_data()
    return len(payload["core"]) + len(payload["patrons"])


def _base_name(name: Any) -> str:
    """The name with trailing descriptors cut at the first comma."""
    return str(name or "").split(",")[0].strip()


def _nname(name: Any) -> str:
    return normalize_saint_name(_base_name(name))


def _nid(identifier: Any) -> str:
    return normalize_saint_id(identifier)


class _Index:
    def __init__(self, data: Dict[str, Any]) -> None:
        self.member_by_canonical: Dict[str, Dict[str, Any]] = {}
        self.member_by_id: Dict[str, Dict[str, Any]] = {}
        self.member_by_name: Dict[str, Dict[str, Any]] = {}
        for entry in list(data["core"]) + list(data["patrons"]):
            for identifier in entry.get("match_ids") or []:
                self.member_by_id[_nid(identifier)] = entry
                canonical = canonical_saint_key(saint_id=identifier)
                if canonical:
                    self.member_by_canonical[_nid(canonical)] = entry
            for name in entry.get("match_names") or []:
                self.member_by_name[_nname(name)] = entry
                canonical = canonical_saint_key(saint_name=name)
                if canonical:
                    self.member_by_canonical[_nid(canonical)] = entry
        self.window: Dict[str, Dict[str, Any]] = dict(data["window_names"])


def _match_member(
    index: _Index,
    *,
    contract_id: Any = None,
    saint_id: Any = None,
    saint_name: Any = None,
) -> Optional[Dict[str, Any]]:
    canonical = canonical_saint_key(
        contract_id=contract_id, saint_id=saint_id, saint_name=saint_name
    )
    if canonical and _nid(canonical) in index.member_by_canonical:
        return index.member_by_canonical[_nid(canonical)]
    if saint_id and _nid(saint_id) in index.member_by_id:
        return index.member_by_id[_nid(saint_id)]
    if saint_name and _nname(saint_name) in index.member_by_name:
        return index.member_by_name[_nname(saint_name)]
    return None


def _match_window(
    index: _Index,
    *,
    saint_id: Any = None,
    saint_name: Any = None,
) -> Optional[Dict[str, Any]]:
    if saint_id and _nid(saint_id) in index.window:
        return index.window[_nid(saint_id)]
    if saint_name and _nname(saint_name) in index.window:
        return index.window[_nname(saint_name)]
    return None


def _runtime_field(runtime: Any, field: str) -> Any:
    if isinstance(runtime, dict):
        return runtime.get(field)
    return getattr(runtime, field, None)


def _compute_windows(target: _dt.date) -> List[Any]:
    if target in _PRIMED_WINDOWS:
        return list(_PRIMED_WINDOWS[target])
    from jobs.novena_contracts.resolver import resolve_active_novenas

    return list(resolve_active_novenas(target))


def _compute_feast_saints(target: _dt.date) -> List[str]:
    from jobs.publish.devotional_calendar_saint import resolve_saint_of_day

    result = resolve_saint_of_day(target)
    names = [str(name).strip() for name in (result.get("saints") or []) if str(name).strip()]
    # v580: dedication feasts surface their associated person(s) on a
    # separate field; they join the feast intake as persons.
    for person in result.get("litany_persons") or []:
        person = str(person).strip()
        if person and person not in names:
            names.append(person)
    return names


def resolve_invocations(
    target: _dt.date,
    *,
    windows: Optional[Sequence[Any]] = None,
    feast_saints: Optional[Sequence[str]] = None,
    data: Optional[Dict[str, Any]] = None,
) -> List[str]:
    """The ordered spoken invocation names for ``target``.

    ``windows`` / ``feast_saints`` inject the sources (pass1 primes the
    windows; tests stub both). When omitted, the production sources
    are consulted: resolve_active_novenas for windows and
    resolve_saint_of_day for the feast input (empty on Sundays by that
    module's absolute rule — John's Sunday rule, inherited).
    """
    global _LAST_WARNINGS
    warnings: List[str] = []
    payload = data if data is not None else load_ladder_data()
    if data is not None:
        payload = _validate_ladder_data(payload)
    index = _Index(payload)

    placed: Dict[str, str] = {}
    ordered: List[str] = []

    def place(key: str, spoken: str) -> None:
        if key not in placed:
            placed[key] = spoken
            ordered.append(spoken)

    # Tier 1 — the core, in data order. Sticky: nothing below moves it.
    for entry in payload["core"]:
        place(f"member:{entry['key']}", str(entry["spoken"]))

    # Tier 2a — the day's feast saint(s), in calendar order.
    feast = list(feast_saints) if feast_saints is not None else _compute_feast_saints(target)

    def place_feast_person(name: str) -> None:
        member = _match_member(index, saint_name=name)
        if member is not None:
            place(f"member:{member['key']}", str(member["spoken"]))
            return
        window_entry = _match_window(index, saint_name=name)
        if window_entry is not None:
            if "excluded" in window_entry:
                return
            place(f"window:{window_entry['key']}", str(window_entry["spoken"]))
            return
        if _nname(name) == "mary":
            # Mary under a form the data does not carry: she stands
            # first in the core already; a Marian naming adds nothing.
            return
        warnings.append(f"saints_ladder: feast saint not in ladder data, invoked as named: {name}")
        place(f"feast:{_nname(name)}", _base_name(name))

    for name in feast:
        # v580 — feast-type classification before placement (John's
        # rules, 2026-11-21): an event feast adds no invocation; a
        # dedication feast yields its person; an event-form title
        # yields the person it names.
        from jobs.publish.feast_classification import classify_feast

        feast_class = classify_feast(name)
        if feast_class.kind == "event":
            continue
        if feast_class.kind == "dedication" or feast_class.extracted:
            for person in feast_class.persons:
                place_feast_person(person)
            continue
        place_feast_person(name)

    # Tier 2b — window saints, in the resolver's own order.
    runtimes = list(windows) if windows is not None else _compute_windows(target)
    for runtime in runtimes:
        saint = _runtime_field(runtime, "saint") or {}
        saint_id = saint.get("id") if isinstance(saint, dict) else None
        saint_name = saint.get("name") if isinstance(saint, dict) else None
        contract_id = _runtime_field(runtime, "contract_id")
        member = _match_member(
            index, contract_id=contract_id, saint_id=saint_id, saint_name=saint_name
        )
        if member is not None:
            place(f"member:{member['key']}", str(member["spoken"]))
            continue
        window_entry = _match_window(index, saint_id=saint_id, saint_name=saint_name)
        if window_entry is not None:
            if "excluded" in window_entry:
                continue
            place(f"window:{window_entry['key']}", str(window_entry["spoken"]))
            continue
        warnings.append(
            "saints_ladder: unmapped window identity skipped: "
            f"contract={contract_id} saint_id={saint_id} name={saint_name}"
        )

    # Tier 3 — the patrons, in data order, skipping keys already placed.
    for entry in payload["patrons"]:
        place(f"member:{entry['key']}", str(entry["spoken"]))

    # v580 — the deterministic guard: no resolved invocation may be a
    # feast event, a place, or an object. A struck slot stands empty;
    # no substitution is invented (John, Q3 A + Q5 A).
    from jobs.publish.feast_classification import guard_invocations

    guarded = guard_invocations(ordered)
    if len(guarded) != len(ordered):
        struck = [n for n in ordered if n not in guarded]
        for name in struck:
            warnings.append(f"saints_ladder: guard struck non-person invocation: {name}")
        ordered = guarded

    _LAST_WARNINGS = warnings
    return ordered


def render_litany_from_names(names: Sequence[str]) -> str:
    """The litany text around an already-resolved invocation list."""
    lines: List[str] = list(_FRAME_HEAD)
    for name in names:
        lines.append(f"{name},")
        lines.append("pray for us.")
    lines.extend(_FRAME_TAIL)
    return "\n".join(lines)


def render_litany(
    target: _dt.date,
    *,
    windows: Optional[Sequence[Any]] = None,
    feast_saints: Optional[Sequence[str]] = None,
    data: Optional[Dict[str, Any]] = None,
) -> str:
    """The full Intercessory Litany block text for ``target``: the
    template's exact frame around the resolved invocation list."""
    names = resolve_invocations(
        target, windows=windows, feast_saints=feast_saints, data=data
    )
    return render_litany_from_names(names)
