#!/usr/bin/env python3
"""Run the Traditional Novena catalog importer month-by-month with progress logs."""
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
    parser = argparse.ArgumentParser(description="Import the Traditional Novena catalog in resumable monthly slices.")
    parser.add_argument("--from-month", choices=MONTHS, default="january")
    parser.add_argument("--log", default="artifacts/novena-url-overrides/full-catalog/orchestrator.log")
    args = parser.parse_args()
    log_path = ROOT / args.log
    log_path.parent.mkdir(parents=True, exist_ok=True)
    start = MONTHS.index(args.from_month)
    with log_path.open("a", encoding="utf-8") as log:
        for month in MONTHS[start:]:
            command = [sys.executable, "scripts/new_novena_url_contract.py", "bulk", "--month", month, "--force", "--resolve-with-openai", "--report-path", f"artifacts/novena-url-overrides/full-catalog/{month}"]
            log.write(f"{dt.datetime.now().isoformat()} start month={month}\n")
            log.flush()
            process = subprocess.Popen(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            while process.poll() is None:
                log.write(f"{dt.datetime.now().isoformat()} running month={month}\n")
                log.flush()
                time.sleep(60)
            output = process.stdout.read() if process.stdout else ""
            log.write(output)
            log.write(f"{dt.datetime.now().isoformat()} complete month={month} exit={process.returncode}\n")
            log.flush()
            if process.returncode:
                return process.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
