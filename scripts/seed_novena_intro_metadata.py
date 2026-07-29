#!/usr/bin/env python3
"""Seed contract-owned novena intro metadata with OpenAI-generated JSON."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Iterable

from openai import OpenAI

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.novena_contracts.contracts import DEFAULT_CONTRACT_DIR, DEFAULT_TEMPLATE_DIR
from jobs.novena_contracts.validators import validate_novena_contract


DEFAULT_ENV = ROOT / "config" / "local" / "openai.env"


def _load_local_env() -> None:
    if os.getenv("OPENAI_API_KEY") or not DEFAULT_ENV.exists():
        return
    for raw in DEFAULT_ENV.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _paths(contract: str = "") -> Iterable[Path]:
    if contract:
        yield Path(contract)
        return
    for path in sorted(DEFAULT_CONTRACT_DIR.rglob("*.json")):
        if "templates" not in path.parts and "families" not in path.parts:
            yield path


def _seed_record(client: OpenAI, contract: Dict[str, Any], model: str) -> Dict[str, Any]:
    row = contract["contract"]
    saint = dict(row.get("saint") or {})
    feast = dict(row.get("feast") or {})
    name = str(saint.get("name") or feast.get("name") or row.get("id")).strip()
    prompt = f"""Return only JSON for one Catholic novena contract.
Name: {name}
Feast: {feast.get('name', '')}

Use kind \"saint\" only for a named saint or blessed person; otherwise use \"event\".
Write a factual, spoken, one-sentence summary under 190 characters. For a saint, provide one to three concise patronage areas. For an event, patronage must be [].
Return exactly {{"kind":"saint|event","summary":"...","patronage":["..."]}}. Do not include citations, markdown, uncertain claims, or extra fields."""
    response = client.responses.create(
        model=model,
        temperature=0,
        input=prompt,
    )
    raw = str(getattr(response, "output_text", "") or "").strip()
    try:
        result = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"OpenAI returned invalid intro JSON for {name}: {raw[:160]}") from exc
    if not isinstance(result, dict):
        raise RuntimeError(f"OpenAI returned a non-object intro record for {name}.")
    result["seed"] = {"provider": "openai", "model": model, "generated_at": dt.date.today().isoformat()}
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed LLM-generated intro metadata into explicit novena contracts.")
    parser.add_argument("--contract", default="", help="Optional single contract JSON path.")
    parser.add_argument("--model", default=os.getenv("OAI_MODEL", "gpt-4.1-mini"))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true", help="Replace existing intro metadata.")
    args = parser.parse_args()
    _load_local_env()
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("Missing OPENAI_API_KEY; set it or configure config/local/openai.env.")
    client = OpenAI(api_key=api_key, base_url=(os.getenv("OAI_API_BASE_URL", "https://api.openai.com/v1").rstrip("/")))
    changed = 0
    for path in _paths(args.contract):
        payload = json.loads(path.read_text(encoding="utf-8"))
        contract = payload.get("contract") or {}
        if contract.get("selector"):
            continue
        if contract.get("intro") and not args.force:
            continue
        contract["intro"] = _seed_record(client, payload, str(args.model).strip() or "gpt-4.1-mini")
        validate_novena_contract(payload, source=str(path), template_dir=DEFAULT_TEMPLATE_DIR)
        if args.dry_run:
            print(f"would update {path}")
        else:
            path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            print(f"updated {path}")
        changed += 1
    print(f"seeded={changed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
