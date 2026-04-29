from __future__ import annotations

import datetime as _dt
from pathlib import Path
from typing import Iterable, List, Optional, Sequence

from jobs.novena.liturgical_helpers import celebration_id, celebration_name, devotional_output_is_eligible, infer_celebration_rank, infer_precedence, romcal_fetch_day

from .contracts import DEFAULT_CONTRACT_DIR, FeastRule, NovenaContract, NovenaRuntime, TemplateSpec, load_novena_contracts


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
    resolved.sort(key=lambda runtime: (runtime.feast.get("feast_date", ""), runtime.family_id, runtime.contract_id))
    return resolved


def _date_range(start: _dt.date, end: _dt.date) -> Iterable[_dt.date]:
    cursor = start
    while cursor <= end:
        yield cursor
        cursor += _dt.timedelta(days=1)
