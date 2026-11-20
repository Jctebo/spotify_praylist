from __future__ import annotations

import datetime as _dt
from pathlib import Path
from typing import Iterable, List, Optional, Sequence

from jobs.novena.liturgical_helpers import celebration_id, celebration_name, devotional_output_is_eligible, infer_celebration_rank, infer_precedence, romcal_fetch_day

from .contracts import DEFAULT_CONTRACT_DIR, FeastRule, NovenaContract, NovenaRuntime, TemplateSpec, load_novena_contracts
from .saint_aliases import canonical_contract_id, normalize_saint_id, normalize_saint_name


def _resolve_contracts(contracts: Optional[Sequence[NovenaContract]], contract_dir: Optional[Path]) -> List[NovenaContract]:
    if contracts is not None:
        return list(contracts)
    return load_novena_contracts(contract_dir or DEFAULT_CONTRACT_DIR)


def _active_window(feast: FeastRule, novena: dict, today: _dt.date) -> tuple[_dt.date, _dt.date, _dt.date]:
    feast_date = feast.feast_date(today.year)
    start_date = feast_date + _dt.timedelta(days=int(novena.get("start_offset_days", -9)))
    end_date = start_date + _dt.timedelta(days=int(novena.get("duration_days", 9)) - 1)
    return feast_date, start_date, end_date


def _selector_window(novena: dict, today: _dt.date) -> tuple[_dt.date, _dt.date]:
    duration_days = int(novena.get("duration_days", 9))
    start_offset_days = int(novena.get("start_offset_days", -9))
    lower = today - _dt.timedelta(days=start_offset_days + duration_days - 1)
    upper = today - _dt.timedelta(days=start_offset_days)
    return lower, upper


def _runtime_from_contract(
    contract: NovenaContract,
    *,
    contract_id: str,
    feast_date: _dt.date,
    start_date: _dt.date,
    end_date: _dt.date,
    today: _dt.date,
    saint: dict,
    feast: dict,
) -> NovenaRuntime:
    active_day = (today - start_date).days + 1
    resolved_template = contract.novena.template if contract.novena.template is not None else TemplateSpec(template_id=contract.novena.template_id, sections=tuple(), source="unknown")
    feast_payload = dict(feast)
    feast_payload.update(
        {
            "feast_date": feast_date.isoformat(),
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        }
    )
    return NovenaRuntime(
        family_id=contract.family_id,
        contract_id=contract_id,
        saint=dict(saint),
        intro=dict(contract.intro),
        feast=feast_payload,
        novena=contract.novena.to_dict(),
        resolved_template=resolved_template,
        date=today,
        active_day=active_day,
        publishing=contract.publishing.to_dict(),
        source_path=contract.source_path,
    )


def resolve_active_novenas(
    today: _dt.date,
    *,
    contracts: Optional[Sequence[NovenaContract]] = None,
    contract_dir: Optional[Path] = None,
) -> List[NovenaRuntime]:
    resolved: List[NovenaRuntime] = []
    loaded = list(_resolve_contracts(contracts, contract_dir))
    explicit_ids = {contract.contract_id for contract in loaded if contract.feast is not None and contract.enabled}
    # Canonical (alias-resolved) identities of the explicit contracts, so a
    # calendar saint whose name form differs from the contract's form still
    # counts as covered by its explicit contract.
    explicit_canonical_ids = {
        canonical
        for contract in loaded
        if contract.feast is not None and contract.enabled
        for canonical in [
            canonical_contract_id(
                contract_id=contract.contract_id,
                saint_id=(contract.saint or {}).get("id"),
                saint_name=(contract.saint or {}).get("name"),
            )
        ]
        if canonical
    }

    for contract in loaded:
        if not contract.enabled:
            continue
        if contract.feast is None or contract.selector is not None:
            continue
        feast_date, start_date, end_date = _active_window(contract.feast, contract.novena.to_dict(), today)
        if start_date <= today <= end_date:
            resolved.append(
                _runtime_from_contract(
                    contract,
                    contract_id=contract.contract_id,
                    feast_date=feast_date,
                    start_date=start_date,
                    end_date=end_date,
                    today=today,
                    saint=contract.saint,
                    feast=contract.feast.to_dict(),
                )
            )

    for contract in loaded:
        if not contract.enabled:
            continue
        if contract.selector is None:
            continue
        feast_window_start, feast_window_end = _selector_window(contract.novena.to_dict(), today)
        selector_ranks = {str(rank).strip().lower() for rank in contract.selector.ranks if str(rank).strip()}
        for feast_date in _date_range(feast_window_start, feast_window_end):
            rows = romcal_fetch_day("general_roman", "en", feast_date)
            if not rows:
                continue
            for primary in rows:
                rank = infer_celebration_rank(primary)
                precedence = infer_precedence(primary)
                if not devotional_output_is_eligible(rank, precedence):
                    continue
                normalized_rank = str(rank).strip().lower()
                if selector_ranks and normalized_rank not in selector_ranks:
                    continue
                selected_id = celebration_id(primary) or " ".join(str(rank or "").split()).strip().lower().replace(" ", "_")
                if not selected_id or selected_id in explicit_ids:
                    continue
                selected_canonical = canonical_contract_id(saint_id=selected_id, saint_name=celebration_name(primary))
                if selected_canonical and (selected_canonical in explicit_ids or selected_canonical in explicit_canonical_ids):
                    continue
                start_date = feast_date + _dt.timedelta(days=int(contract.novena.start_offset_days))
                end_date = start_date + _dt.timedelta(days=int(contract.novena.duration_days) - 1)
                if not (start_date <= today <= end_date):
                    continue
                feast = dict(primary)
                feast.update(
                    {
                        "id": selected_id,
                        "name": celebration_name(primary) or selected_id,
                        "rank": rank,
                        "precedence": precedence,
                    }
                )
                saint = {
                    "id": selected_id,
                    "name": celebration_name(primary) or selected_id,
                }
                resolved.append(
                    _runtime_from_contract(
                        contract,
                        contract_id=selected_id,
                        feast_date=feast_date,
                        start_date=start_date,
                        end_date=end_date,
                        today=today,
                        saint=saint,
                        feast=feast,
                    )
                )
                break
    resolved = _dedupe_aliased_saints(resolved)
    resolved = _enforce_traditional_priority(resolved)
    resolved.sort(key=lambda runtime: (runtime.feast.get("feast_date", ""), runtime.family_id, runtime.contract_id))
    return resolved


def _dedupe_aliased_saints(resolved: List[NovenaRuntime]) -> List[NovenaRuntime]:
    """Collapse duplicate novenas for one saint resolved under name aliases.

    Two contracts can cover the same saint under different name forms (the
    curated traditional contract and the auto-materialized short-form one).
    When their windows overlap, keep exactly one runtime per aliased saint:
    the canonical contract named in the alias table wins; otherwise a
    fixed-content (traditional) runtime beats a generated one; otherwise the
    earliest runtime in resolution order stands. Saints outside the alias
    table are never merged.
    """
    groups: dict[str, List[int]] = {}
    for index, runtime in enumerate(resolved):
        canonical = canonical_contract_id(
            contract_id=runtime.contract_id,
            saint_id=(runtime.saint or {}).get("id"),
            saint_name=(runtime.saint or {}).get("name"),
        )
        if canonical:
            groups.setdefault(canonical, []).append(index)
    dropped: set[int] = set()
    for canonical, indexes in groups.items():
        if len(indexes) < 2:
            continue

        def _preference(index: int) -> tuple[int, int, int]:
            runtime = resolved[index]
            is_canonical = 0 if runtime.contract_id == canonical else 1
            is_fixed = 0 if str((runtime.novena or {}).get("content_mode", "")).strip().lower() == "fixed" else 1
            return (is_canonical, is_fixed, index)

        keeper = min(indexes, key=_preference)
        dropped.update(index for index in indexes if index != keeper)
    if not dropped:
        return resolved
    return [runtime for index, runtime in enumerate(resolved) if index not in dropped]


# Tokens that carry no saint identity when comparing name forms loosely.
_LOOSE_TOKEN_DROPS = frozenset({"the", "of", "and", "holy", "saint", "saints", "st", "sts"})


def _is_traditional(runtime: NovenaRuntime) -> bool:
    """A traditional novena is a fixed-content contract (feast-days/)."""
    return str((runtime.novena or {}).get("content_mode", "")).strip().lower() == "fixed"


def _loose_saint_tokens(name) -> frozenset:
    """Folded token set of a saint name for subset comparison.

    Drops glue words ("the", "of", "holy", ...) and folds simple plurals
    ("angels" -> "angel"), so name forms like "Guardian Angel" and
    "The Holy Guardian Angels" fold to the same set.
    """
    tokens = set()
    for token in normalize_saint_name(name).split():
        if token in _LOOSE_TOKEN_DROPS:
            continue
        if len(token) > 3 and token.endswith("s") and not token.endswith(("ss", "us", "is")):
            token = token[:-1]
        tokens.add(token)
    return frozenset(tokens)


def _enforce_traditional_priority(resolved: List[NovenaRuntime]) -> List[NovenaRuntime]:
    """General rule: a traditional novena beats a short-form one.

    Whenever two active runtimes resolve to the same saint and at least
    one is a traditional (fixed-content) contract, every generated
    short-form runtime (any other content mode) for that saint is
    dropped — whether or not the saint appears in the alias table.
    Two traditional runtimes are never merged, and a short-form runtime
    with no traditional counterpart that day is always kept (the rule
    is per-day: a short-form still runs on days its traditional
    counterpart is not active).

    Same-saint identity is established by, in order:
    - the alias table's canonical contract id;
    - the normalized saint id (falling back to the contract id);
    - the normalized saint name;
    - folded name-token sets where one is a subset of the other
      (smaller set >= 2 tokens), which covers form variants like
      "Guardian Angel" vs "The Holy Guardian Angels" and pairs whose
      contracts anchor to slightly different feast dates for the same
      celebration (e.g. a traditional contract dated Mar 19 whose
      calendar short-form twin is anchored to the Mar 18 romcal feast),
      without merging distinct saints who merely share a feast day or
      a single name token.
    """
    if len(resolved) < 2:
        return resolved
    parent = list(range(len(resolved)))

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(a: int, b: int) -> None:
        root_a, root_b = find(a), find(b)
        if root_a != root_b:
            parent[root_b] = root_a

    key_owners: dict = {}
    for index, runtime in enumerate(resolved):
        saint = runtime.saint or {}
        keys = []
        canonical = canonical_contract_id(
            contract_id=runtime.contract_id,
            saint_id=saint.get("id"),
            saint_name=saint.get("name"),
        )
        if canonical:
            keys.append(("alias", canonical))
        saint_id_key = normalize_saint_id(saint.get("id") or runtime.contract_id)
        if saint_id_key:
            keys.append(("id", saint_id_key))
        saint_name_key = normalize_saint_name(saint.get("name"))
        if saint_name_key:
            keys.append(("name", saint_name_key))
        for key in keys:
            if key in key_owners:
                union(index, key_owners[key])
            else:
                key_owners[key] = index

    folded = [_loose_saint_tokens((runtime.saint or {}).get("name")) for runtime in resolved]
    for a in range(len(resolved)):
        for b in range(a + 1, len(resolved)):
            tokens_a, tokens_b = folded[a], folded[b]
            if len(tokens_a) >= 2 and len(tokens_b) >= 2 and (tokens_a <= tokens_b or tokens_b <= tokens_a):
                union(a, b)

    groups: dict = {}
    for index in range(len(resolved)):
        groups.setdefault(find(index), []).append(index)
    dropped: set = set()
    for indexes in groups.values():
        if len(indexes) < 2:
            continue
        if any(_is_traditional(resolved[index]) for index in indexes):
            dropped.update(index for index in indexes if not _is_traditional(resolved[index]))
    if not dropped:
        return resolved
    return [runtime for index, runtime in enumerate(resolved) if index not in dropped]


def _date_range(start: _dt.date, end: _dt.date) -> Iterable[_dt.date]:
    cursor = start
    while cursor <= end:
        yield cursor
        cursor += _dt.timedelta(days=1)
