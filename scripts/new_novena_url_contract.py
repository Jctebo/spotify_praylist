#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.novena_contracts.url_import import (
    import_bulk_catalog,
    import_single_url,
    _resolve_openai_settings,
    write_bulk_report,
    write_single_report,
)


def _add_common_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing contract or report files.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing contract files if present.")
    parser.add_argument("--output-dir", default="", help="Where to write generated contract files.")
    parser.add_argument("--report-dir", default="", help="Directory for generated report files.")
    parser.add_argument("--report-path", default="", help="Base path for report files. The CLI writes .json and .md siblings.")
    parser.add_argument(
        "--resolve-with-openai",
        dest="resolve_with_openai",
        action="store_true",
        help="Use OpenAI to normalize instruction-heavy prayer sections into TTS-friendly text.",
    )
    parser.add_argument(
        "--no-resolve-with-openai",
        dest="resolve_with_openai",
        action="store_false",
        help="Disable OpenAI normalization even when configured in the environment.",
    )
    parser.add_argument(
        "--openai-model",
        default="",
        help="OpenAI model to use for TTS normalization. Defaults to OAI_MODEL or gpt-4.1-mini.",
    )
    parser.add_argument(
        "--openai-base-url",
        default="",
        help="OpenAI base URL. Defaults to OAI_API_BASE_URL or https://api.openai.com/v1.",
    )
    parser.set_defaults(resolve_with_openai=None)


def _parse_month_value(value: str) -> str:
    cleaned = value.strip().lower()
    if not cleaned:
        raise argparse.ArgumentTypeError("month cannot be empty")
    if cleaned.isdigit():
        number = int(cleaned)
        if 1 <= number <= 12:
            return cleaned
        raise argparse.ArgumentTypeError("month must be between 1 and 12")
    month_names = {
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
    }
    if cleaned in month_names:
        return cleaned
    raise argparse.ArgumentTypeError("month must be a number 1-12 or a month name")


def _run_single(args: argparse.Namespace) -> int:
    output_path = Path(args.output) if args.output else None
    output_dir = Path(args.output_dir) if args.output_dir else None
    report_path = Path(args.report_path) if args.report_path else None
    report_dir = Path(args.report_dir) if args.report_dir else None
    openai_api_key, openai_base_url, openai_model = _resolve_openai_settings(
        api_key=os.getenv("OPENAI_API_KEY", "").strip(),
        base_url=args.openai_base_url,
        model=args.openai_model,
    )
    report = import_single_url(
        args.url,
        output_dir=output_dir,
        output_path=output_path,
        force=args.force,
        dry_run=args.dry_run,
        resolve_with_openai=bool(args.resolve_with_openai),
        openai_api_key=openai_api_key,
        openai_base_url=openai_base_url,
        openai_model=openai_model,
    )
    entry = report.entries[-1]
    if args.dry_run:
        print(json.dumps(report.to_dict(), indent=2, sort_keys=True))
    else:
        report_json, report_md = write_single_report(report, report_dir=report_dir, report_path=report_path)
        if entry.status == "failed":
            print(f"failed url={args.url} issues={'; '.join(entry.issues)}")
        else:
            print(
                f"{entry.status} url={args.url} contract_id={entry.contract_id} output={entry.output_path} enabled={entry.enabled}"
            )
        print(f"report_json={report_json}")
        print(f"report_md={report_md}")
    return 1 if report.hard_failures else 0


def _run_bulk(args: argparse.Namespace) -> int:
    output_dir = Path(args.output_dir) if args.output_dir else None
    report_dir = Path(args.report_dir) if args.report_dir else None
    report_path = Path(args.report_path) if args.report_path else None
    openai_api_key, openai_base_url, openai_model = _resolve_openai_settings(
        api_key=os.getenv("OPENAI_API_KEY", "").strip(),
        base_url=args.openai_base_url,
        model=args.openai_model,
    )
    report = import_bulk_catalog(
        args.catalog_url,
        output_dir=output_dir,
        force=args.force,
        dry_run=args.dry_run,
        month=args.month,
        resolve_with_openai=bool(args.resolve_with_openai),
        openai_api_key=openai_api_key,
        openai_base_url=openai_base_url,
        openai_model=openai_model,
    )
    if args.dry_run:
        print(report.to_markdown())
        print(json.dumps(report.to_dict(), indent=2, sort_keys=True))
    else:
        report_json, report_md = write_bulk_report(report, report_dir=report_dir, report_path=report_path)
        print(
            f"bulk catalog={args.catalog_url} written={report.written} disabled={report.disabled} failed={report.hard_failures} total={len(report.entries)}"
        )
        print(f"report_json={report_json}")
        print(f"report_md={report_md}")
    return 1 if report.hard_failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Import novena override contracts from Catholic Novena App URLs.")
    subparsers = parser.add_subparsers(dest="mode", required=True)

    single = subparsers.add_parser("single", help="Import one novena page URL.")
    single.add_argument("--url", required=True, help="Catholic Novena App novena detail page URL.")
    single.add_argument("--output", default="", help="Exact output path for the generated contract file.")
    _add_common_options(single)

    bulk = subparsers.add_parser("bulk", help="Import the Catholic Novena App catalog and every linked novena page.")
    bulk.add_argument("--catalog-url", default="https://catholicnovenaapp.com/list-of-all-novenas/", help="Catalog page URL.")
    bulk.add_argument(
        "--month",
        type=_parse_month_value,
        default=None,
        help="Only import one catalog month (1-12 or month name).",
    )
    _add_common_options(bulk)

    args = parser.parse_args()
    if args.resolve_with_openai is None:
        args.resolve_with_openai = bool(_resolve_openai_settings()[0])
    if args.mode == "single":
        return _run_single(args)
    return _run_bulk(args)


if __name__ == "__main__":
    raise SystemExit(main())
