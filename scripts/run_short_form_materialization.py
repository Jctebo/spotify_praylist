#!/usr/bin/env python3
"""Run short-form materialization month by month with one-minute progress logs."""
from __future__ import annotations

import argparse
import datetime as dt
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MONTHS = ("january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december")


def main() -> int:
    parser = argparse.ArgumentParser(description="Materialize short-form catalog in resumable monthly slices.")
    parser.add_argument("--from-month", choices=MONTHS, default="january")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true", help="Refresh existing materialized contracts without reseeding existing intros.")
    parser.add_argument("--log", default="artifacts/short-form-catalog/orchestrator.log")
    args = parser.parse_args()
    log_path = ROOT / args.log
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as log:
        for month in MONTHS[MONTHS.index(args.from_month):]:
            report = f"artifacts/short-form-catalog/{month}"
            command = [sys.executable, "scripts/materialize_short_form_catalog.py", "--month", month, "--report-path", report]
            if args.dry_run:
                command.append("--dry-run")
            if args.force:
                command.append("--force")
            log.write(f"{dt.datetime.now().isoformat()} start month={month}\n")
            log.flush()
            process = subprocess.Popen(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            next_status = time.monotonic() + 60
            while process.poll() is None:
                if time.monotonic() >= next_status:
                    log.write(f"{dt.datetime.now().isoformat()} running month={month}\n")
                    log.flush()
                    next_status = time.monotonic() + 60
                time.sleep(5)
            output = process.stdout.read() if process.stdout else ""
            log.write(output)
            log.write(f"{dt.datetime.now().isoformat()} complete month={month} exit={process.returncode}\n")
            log.flush()
            if process.returncode:
                return process.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
