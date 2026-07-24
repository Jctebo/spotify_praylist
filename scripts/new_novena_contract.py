#!/usr/bin/env python3
from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path
from typing import Any, Dict, List

from jobs.novena_contracts.contracts import DEFAULT_AUDIO_CONFIG, DEFAULT_CONTRACT_DIR
from jobs.novena_contracts.validators import normalize_contract_filename, resolve_romcal_identifier, validate_novena_contract


def _read_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise RuntimeError(f"Template file must contain a JSON object: {path}")
    return payload


def _title_from_identifier(value: str) -> str:
    text = value.replace("_", " ").replace("-", " ").strip()
    return " ".join(part.capitalize() for part in text.split())


def build_contract_payload(args: argparse.Namespace) -> Dict[str, Any]:
    feast_id = resolve_romcal_identifier(args.id or args.saint_name or args.feast_name)
    contract: Dict[str, Any] = {
        "contract": {
            "id": feast_id,
            "type": "novena_feast_rule",
            "novena": {
                "duration_days": int(args.duration_days),
                "start_offset_days": int(args.start_offset_days),
                "content_mode": str(args.content_mode).strip().lower(),
                "ai_config": {
                    "themes": list(args.theme or []),
                },
            },
            "publishing": {
                "audio": {
                    "enabled": True,
                    "model": args.audio_model,
                    "voice": args.audio_voice,
                    "format": args.audio_format,
                    "speed": float(args.audio_speed),
                    "providers": copy.deepcopy(DEFAULT_AUDIO_CONFIG["providers"]),
                },
                "rss": {
                    "enabled": True,
                    "feed_id": args.feed_id,
                    "episode_title_pattern": args.title_pattern,
                    "episode_description_pattern": args.description_pattern,
                },
            },
        }
    }
    if getattr(args, "auto_populate", False):
        contract["contract"]["selector"] = {"mode": "auto"}
    else:
        saint_name = args.saint_name or args.feast_name or _title_from_identifier(feast_id)
        feast_name = args.feast_name or saint_name
        movable_feast_id = str(getattr(args, "feast_romcal_id", "") or "").strip()
        feast_payload: Dict[str, Any]
        if movable_feast_id:
            feast_payload = {
                "mode": "romcal_id",
                "romcal_id": resolve_romcal_identifier(movable_feast_id),
                "name": feast_name,
            }
        else:
            feast_payload = {
                "mode": "fixed",
                "month": int(args.month),
                "day": int(args.day),
                "name": feast_name,
            }
        contract["contract"]["saint"] = {
            "id": feast_id,
            "name": saint_name,
        }
        contract["contract"]["feast"] = feast_payload
    if args.template_id:
        contract["contract"]["novena"]["template_id"] = args.template_id
    theme_prompt = str(getattr(args, "theme_prompt", "") or "").strip()
    if theme_prompt:
        contract["contract"]["novena"]["ai_config"]["theme_prompt"] = theme_prompt
    if args.embedded_template_file:
        contract["contract"]["novena"]["template"] = _read_json(Path(args.embedded_template_file))
    return contract


def _default_output_path(args: argparse.Namespace, contract: Dict[str, Any]) -> Path:
    feast_id = contract["contract"]["id"]
    contract_root = DEFAULT_CONTRACT_DIR / ("families" if contract["contract"].get("selector") else "feast-days")
    return Path(args.output or contract_root / f"{normalize_contract_filename(feast_id)}.json")


def main() -> int:
    parser = argparse.ArgumentParser(description="Create or validate a novena feast contract.")
    parser.add_argument("--id", help="Explicit Romcal identifier or saint name to normalize.", default="")
    parser.add_argument("--saint-name", help="Display name for the saint or feast.", default="")
    parser.add_argument("--feast-name", help="Display name for the feast.", default="")
    parser.add_argument("--month", default="", help="Feast month (1-12) for fixed feasts.")
    parser.add_argument("--day", default="", help="Feast day (1-31) for fixed feasts.")
    parser.add_argument("--feast-romcal-id", default="", help="Movable feast or liturgical-day Romcal id.")
    parser.add_argument("--auto-populate", action="store_true", help="Create a selector-based family contract instead of a single feast contract.")
    parser.add_argument("--template-id", default="", help="Reference template file in contracts/novenas/templates.")
    parser.add_argument("--embedded-template-file", default="", help="Optional JSON file containing an embedded template.")
    parser.add_argument("--content-mode", default="hybrid", choices=["fixed", "ai_generated", "hybrid"])
    parser.add_argument("--duration-days", default=9, type=int)
    parser.add_argument("--start-offset-days", default=-9, type=int)
    parser.add_argument(
        "--theme",
        action="append",
        default=[],
        help="Legacy AI daily-focus line to include; short-form standard-9-day contracts should prefer --theme-prompt.",
    )
    parser.add_argument(
        "--theme-prompt",
        default="",
        help="Prompt seed used to generate the 9 unique short-form daily focuses for standard-9-day contracts.",
    )
    parser.add_argument("--feed-id", default="ora-pro-nobis")
    parser.add_argument("--title-pattern", default="Short-Form Novena to {saint_name} Day {day} - {date_display}")
    parser.add_argument("--description-pattern", default="Day {day} of the Novena to {saint_name} for {feast_name}.")
    parser.add_argument("--audio-model", default="gpt-4o-mini-tts")
    parser.add_argument("--audio-voice", default="ash")
    parser.add_argument("--audio-format", default="mp3")
    parser.add_argument("--audio-speed", default=1.0, type=float)
    parser.add_argument("--output", default="", help="Where to write the contract JSON.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print the contract without writing files.")
    parser.add_argument("--force", action="store_true", help="Overwrite the output file if it exists.")
    args = parser.parse_args()

    if not args.auto_populate and not args.feast_romcal_id and (not str(args.month).strip() or not str(args.day).strip()):
        raise RuntimeError("Fixed feast contracts require --month and --day, or provide --feast-romcal-id for movable feasts.")
    if str(args.template_id).strip() == "standard-9-day":
        theme_prompt = str(getattr(args, "theme_prompt", "") or "").strip()
        themes = [str(item).strip() for item in args.theme if str(item).strip()]
        if not theme_prompt and (len(themes) != 9 or len({item.lower() for item in themes}) != 9):
            raise RuntimeError("Short-form standard-9-day contracts require either --theme-prompt or exactly 9 unique --theme values.")

    payload = build_contract_payload(args)
    validate_novena_contract(payload, source="<cli>", template_dir=DEFAULT_CONTRACT_DIR / "templates")

    output_path = _default_output_path(args, payload)
    if args.dry_run:
        print(json.dumps(payload, indent=2, sort_keys=True))
        return 0

    if output_path.exists() and not args.force:
        raise RuntimeError(f"Contract already exists: {output_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(str(output_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
