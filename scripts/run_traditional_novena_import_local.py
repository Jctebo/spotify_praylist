#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.novena_contracts.traditional_import import (
    DEFAULT_TRADITIONAL_NOVENA_CATALOG_URL,
    DEFAULT_TRADITIONAL_NOVENA_IMPORT_MONTHS,
    DEFAULT_TRADITIONAL_NOVENA_REPORT_DIR,
    import_traditional_novena_months,
    write_traditional_novena_import_reports,
)
from jobs.novena_contracts.url_import import _resolve_openai_settings


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the July/August traditional novena import locally.")
    parser.add_argument(
        "--catalog-url",
        default=DEFAULT_TRADITIONAL_NOVENA_CATALOG_URL,
        help="Catholic Novena App catalog page used for month discovery.",
    )
    parser.add_argument(
        "--month",
        action="append",
        default=[],
        help="Override the default month window. Repeat for multiple months.",
    )
    parser.add_argument("--output-dir", default="", help="Where to write generated contract files.")
    parser.add_argument(
        "--report-dir",
        default="",
        help="Where to write bulk report files. Defaults to artifacts/novena-url-overrides/traditional-novena-july-august.",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite existing contract files.")
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing contract or report files.")
    parser.add_argument(
        "--resolve-with-openai",
        dest="resolve_with_openai",
        action="store_true",
        help="Use OpenAI to normalize instruction-heavy prayer sections.",
    )
    parser.add_argument(
        "--no-resolve-with-openai",
        dest="resolve_with_openai",
        action="store_false",
        help="Disable OpenAI normalization.",
    )
    parser.set_defaults(resolve_with_openai=None)
    args = parser.parse_args()

    months = args.month or list(DEFAULT_TRADITIONAL_NOVENA_IMPORT_MONTHS)
    output_dir = Path(args.output_dir) if args.output_dir else None
    report_dir = Path(args.report_dir) if args.report_dir else DEFAULT_TRADITIONAL_NOVENA_REPORT_DIR
    if args.resolve_with_openai is None:
        args.resolve_with_openai = bool(_resolve_openai_settings()[0])

    run = import_traditional_novena_months(
        args.catalog_url,
        months=months,
        output_dir=output_dir,
        force=args.force,
        dry_run=args.dry_run,
        resolve_with_openai=bool(args.resolve_with_openai),
    )

    if not args.dry_run:
        report_paths = write_traditional_novena_import_reports(run, report_dir=report_dir)
    else:
        report_paths = ()

    for month, report in zip(run.months, run.reports):
        print(
            f"traditional-novena-import month={month} "
            f"written={report.written} disabled={report.disabled} failed={report.hard_failures} total={len(report.entries)}"
        )
    for month, (report_json, report_md) in zip(run.months, report_paths):
        print(f"report_json={report_json}")
        print(f"report_md={report_md}")
    print(json.dumps(run.summary(), indent=2, sort_keys=True))

    return 1 if run.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
