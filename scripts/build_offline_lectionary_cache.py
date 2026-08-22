"""Validate and merge reviewed offline lectionary and Bible cache JSON files."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from jobs.publish.offline_lectionary import canonical_reference


def load_object(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return payload


def validate(lectionary: dict, bible: dict) -> None:
    entries = lectionary.get("entries")
    passages = bible.get("passages")
    if not isinstance(entries, dict) or not isinstance(passages, dict):
        raise ValueError("Both inputs must contain object-valued entries/passages")
    seen_dates = set()
    for date_key, entry in entries.items():
        if date_key in seen_dates:
            raise ValueError(f"Duplicate lectionary date: {date_key}")
        seen_dates.add(date_key)
        if not isinstance(entry, dict):
            raise ValueError(f"Entry {date_key} must be an object")
        citation = canonical_reference(entry.get("gospel"))
        if not citation:
            raise ValueError(f"Entry {date_key} has no Gospel citation")
        if not str(passages.get(citation, "")).strip():
            raise ValueError(f"Missing Bible passage for {date_key}: {citation}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("lectionary", type=Path)
    parser.add_argument("bible", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    lectionary = load_object(args.lectionary)
    bible = load_object(args.bible)
    validate(lectionary, bible)
    if args.output:
        payload = {"lectionary": lectionary, "bible": bible}
        args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Validated {len(lectionary['entries'])} lectionary entries and {len(bible['passages'])} Bible passages.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
