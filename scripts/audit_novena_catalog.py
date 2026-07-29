"""Audit checked-in novena contracts without making catalog changes."""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.novena_contracts.contracts import DEFAULT_CONTRACT_DIR, load_novena_contracts


def audit_catalog(*, contract_dir: Path = DEFAULT_CONTRACT_DIR, years: Iterable[int] = range(2025, 2031)) -> dict:
    contracts = load_novena_contracts(contract_dir)
    active = [contract for contract in contracts if contract.enabled]
    dates_by_year: dict[str, dict[str, list[str]]] = {}
    failures: list[str] = []
    for year in years:
        dated = defaultdict(list)
        for contract in active:
            if contract.feast is None:
                continue
            try:
                date_value = contract.feast.feast_date(year)
            except RuntimeError as exc:
                failures.append(f"{contract.contract_id} ({year}): {exc}")
                continue
            dated[date_value.isoformat()].append(contract.contract_id)
        dates_by_year[str(year)] = {date: sorted(ids) for date, ids in sorted(dated.items()) if len(ids) > 1}
    return {
        "active_contract_count": len(active),
        "disabled_contract_count": len(contracts) - len(active),
        "unresolved": failures,
        "shared_dates": dates_by_year,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit the checked-in novena catalog.")
    parser.add_argument("--year", action="append", type=int, dest="years", help="Year to validate; repeatable.")
    parser.add_argument("--json", action="store_true", help="Emit the complete report as JSON.")
    args = parser.parse_args()
    report = audit_catalog(years=args.years or range(2025, 2031))
    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print(f"active={report['active_contract_count']} disabled={report['disabled_contract_count']}")
        print(f"unresolved={len(report['unresolved'])}")
        for item in report["unresolved"]:
            print(f"  {item}")
        shared = sum(len(dates) for dates in report["shared_dates"].values())
        print(f"shared_dates={shared} (informational; distinct devotions may share a date)")
    return 1 if report["unresolved"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
