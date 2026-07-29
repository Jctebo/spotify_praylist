#!/usr/bin/env python3
"""Materialize one standard short-form contract for each uncovered Romcal celebration."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from openai import OpenAI

from jobs.novena.liturgical_helpers import celebration_id, celebration_name, devotional_output_is_eligible, infer_celebration_rank, infer_precedence, romcal_fetch_day
from jobs.novena_contracts.contracts import DEFAULT_AUDIO_CONFIG, DEFAULT_CONTRACT_DIR, DEFAULT_TEMPLATE_DIR, load_novena_contracts
from jobs.novena_contracts.validators import resolve_romcal_identifier, validate_novena_contract
from scripts.seed_novena_intro_metadata import _load_local_env, _seed_record

MONTHS = tuple(name.lower() for name in ("January February March April May June July August September October November December").split())
_STOP = frozenset({"saint", "saints", "st", "the", "of", "and", "blessed", "virgin", "martyr", "bishop", "priest", "pope", "religious", "abbot", "doctor", "church"})


def _tokens(value: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]+", value.lower()) if token not in _STOP}


def _traditional_coverage(years: tuple[int, ...]) -> tuple[dict[str, list[tuple[dt.date, set[str]]]], set[str]]:
    coverage: dict[str, list[tuple[dt.date, set[str]]]] = {}
    direct_ids: set[str] = set()
    for contract in load_novena_contracts():
        if not contract.enabled or contract.feast is None or contract.novena.template.template_id == "standard-9-day":
            continue
        if contract.feast.mode in {"romcal_id", "relative_to_romcal"}:
            direct_ids.add(resolve_romcal_identifier(contract.feast.romcal_id, years=years))
        for year in years:
            date_value = contract.feast.feast_date(year)
            coverage.setdefault(str(year), []).append((date_value, _tokens(contract.saint.get("name") or contract.feast.name)))
    return coverage, direct_ids


def _is_covered(*, date_value: dt.date, name: str, coverage: dict[str, list[tuple[dt.date, set[str]]]]) -> bool:
    candidate = _tokens(name)
    if not candidate:
        return False
    for contract_date, contract_tokens in coverage.get(str(date_value.year), []):
        if contract_date != date_value or not contract_tokens:
            continue
        if candidate <= contract_tokens or contract_tokens <= candidate:
            return True
    return False


def _payload(event: dict[str, Any], dates: set[dt.date]) -> dict[str, Any]:
    feast_id = celebration_id(event)
    name = celebration_name(event) or feast_id.replace("_", " ").title()
    feast = {"mode": "romcal_id", "romcal_id": feast_id, "name": name}
    return {"contract": {"id": feast_id, "type": "novena_feast_rule", "saint": {"id": feast_id, "name": name}, "feast": feast, "novena": {"duration_days": 9, "start_offset_days": -9, "content_mode": "hybrid", "template_id": "standard-9-day", "ai_config": {"intro_prompt": "Welcome the listener to the named day of this standard short-form novena. Briefly identify the calendar saint or sacred celebration and, for a saint, name a well-known patronage only when you are confident. Then connect this novena to the selected daily calendar focus in one prayerful sentence.", "theme_prompt": "Create a 9-day saint-life outline for {saint_name}. Return nine distinct daily focus lines, each rooted in a different stage or witness of the saint's life, so the arc moves from call and formation through prayer, trial, charity, fidelity, hidden sacrifice, hope, and final perseverance."}}, "publishing": {"audio": {"enabled": True, "model": "gpt-4o-mini-tts", "voice": "ash", "format": "mp3", "speed": 1.0, "providers": DEFAULT_AUDIO_CONFIG["providers"]}, "rss": {"enabled": True, "feed_id": "ora-pro-nobis", "episode_title_pattern": "Short-Form Novena to {saint_name} Day {day} - {date_display}", "episode_description_pattern": "Day {day} of the Novena to {saint_name} for {feast_name}."}}}}


def main() -> int:
    parser = argparse.ArgumentParser(description="Materialize short-form novena contracts month by month.")
    parser.add_argument("--month", choices=MONTHS, required=True)
    parser.add_argument("--year", action="append", type=int, dest="years")
    parser.add_argument("--report-path", default="")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    years = tuple(args.years or range(2025, 2031))
    month_number = MONTHS.index(args.month) + 1
    coverage, direct_ids = _traditional_coverage(years)
    candidates: dict[str, tuple[dict[str, Any], set[dt.date]]] = {}
    for year in years:
        day = dt.date(year, month_number, 1)
        while day.month == month_number:
            for event in romcal_fetch_day("general_roman", "en", day):
                feast_id = celebration_id(event)
                if not feast_id or not devotional_output_is_eligible(infer_celebration_rank(event), infer_precedence(event)):
                    continue
                if feast_id not in direct_ids and not _is_covered(date_value=day, name=celebration_name(event), coverage=coverage):
                    candidates.setdefault(feast_id, (event, set()))[1].add(day)
            day += dt.timedelta(days=1)
    client = None
    if not args.dry_run:
        _load_local_env()
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("Missing OPENAI_API_KEY; refusing to write unseeded short-form contracts.")
        client = OpenAI(api_key=api_key, base_url=os.getenv("OAI_API_BASE_URL", "https://api.openai.com/v1").rstrip("/"))
    written, skipped = [], []
    out_dir = DEFAULT_CONTRACT_DIR / "short-form"
    for feast_id, (event, dates) in sorted(candidates.items()):
        path = out_dir / f"{feast_id}.json"
        if path.exists() and not args.force:
            skipped.append(feast_id)
            continue
        payload = _payload(event, dates)
        existing_intro = None
        if path.exists():
            existing_intro = json.loads(path.read_text(encoding="utf-8"))["contract"].get("intro")
        if existing_intro:
            payload["contract"]["intro"] = existing_intro
        elif client is not None:
            payload["contract"]["intro"] = _seed_record(client, payload, os.getenv("OAI_MODEL", "gpt-4.1-mini"))
        validate_novena_contract(payload, source=str(path), template_dir=DEFAULT_TEMPLATE_DIR)
        if not args.dry_run:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        written.append(feast_id)
    report = {"month": args.month, "years": list(years), "candidates": len(candidates), "written": written, "skipped_existing": skipped, "dry_run": args.dry_run}
    if args.report_path:
        path = ROOT / f"{args.report_path}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
