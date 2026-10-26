"""Summarize cumulative devotional wallpaper image-attempt telemetry."""

from __future__ import annotations

import argparse
from collections import defaultdict
import json
from pathlib import Path
from typing import Any


def summarize(payload: dict[str, Any]) -> dict[str, Any]:
    records = payload.get("records", [])
    if not isinstance(records, list):
        raise ValueError("telemetry input must contain a records array")
    monthly: dict[str, dict[str, dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: {
            "assets": 0,
            "generation_requests": 0,
            "generation_responses": 0,
            "multi_generation_assets": 0,
            "qa_fallbacks": 0,
            "failed_assets": 0,
        })
    )
    issue_categories: dict[str, dict[str, dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(int))
    )
    for record in records:
        if not isinstance(record, dict):
            continue
        recorded_at = str(record.get("recorded_at") or record.get("asset_date", ""))
        month = recorded_at[:7]
        variant = str(record.get("variant", "unknown"))
        if len(month) != 7 or not month[:4].isdigit() or not month[5:].isdigit():
            month = "unknown"
        bucket = monthly[month][variant]
        bucket["assets"] += 1
        requests = int(record.get("generation_request_count", 0) or 0)
        bucket["generation_requests"] += requests
        bucket["generation_responses"] += int(record.get("generation_response_count", 0) or 0)
        bucket["multi_generation_assets"] += requests > 1
        bucket["qa_fallbacks"] += bool(record.get("fallback_used"))
        bucket["failed_assets"] += record.get("status") == "failed"
        for attempt in record.get("generation_attempts", []):
            if not isinstance(attempt, dict):
                continue
            for field in ("local_qa_issue_categories", "vision_qa_issue_categories"):
                for category in attempt.get(field, []):
                    issue_categories[month][variant][str(category)] += 1

    result: dict[str, Any] = {"schema": 1, "months": {}, "qa_issue_categories": {}}
    for month, variants in sorted(monthly.items()):
        result["months"][month] = {}
        for variant, values in sorted(variants.items()):
            assets = values["assets"]
            result["months"][month][variant] = {
                **values,
                "multi_generation_rate": round(values["multi_generation_assets"] / assets, 4) if assets else 0,
                "qa_fallback_rate": round(values["qa_fallbacks"] / assets, 4) if assets else 0,
            }
    for month, variants in sorted(issue_categories.items()):
        result["qa_issue_categories"][month] = {
            variant: dict(sorted(counts.items()))
            for variant, counts in sorted(variants.items())
        }
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("history", type=Path, help="Downloaded cumulative telemetry.json")
    parser.add_argument("--format", choices=("json", "markdown"), default="markdown")
    args = parser.parse_args()
    payload = json.loads(args.history.read_text(encoding="utf-8"))
    report = summarize(payload)
    if args.format == "json":
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0

    print("# Wallpaper generation telemetry")
    print()
    if not report["months"]:
        print("No image-generation records found.")
        return 0
    print("| Month | Variant | Images | Image requests | >1 generation | QA fallback | Failed |")
    print("|---|---|---:|---:|---:|---:|---:|")
    for month, variants in report["months"].items():
        for variant, values in variants.items():
            print(
                f"| {month} | {variant} | {values['assets']} | {values['generation_requests']} "
                f"| {values['multi_generation_assets']} ({values['multi_generation_rate']:.0%}) "
                f"| {values['qa_fallbacks']} ({values['qa_fallback_rate']:.0%}) | {values['failed_assets']} |"
            )
    print()
    print("QA issue categories (counts across recorded QA attempts):")
    for month, variants in report["qa_issue_categories"].items():
        for variant, counts in variants.items():
            categories = ", ".join(f"{name}={count}" for name, count in counts.items())
            print(f"- {month} {variant}: {categories}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
