#!/usr/bin/env python3
"""v305 step 9 — data port rehearsal (run in Implement; Ship re-runs
it against production). Exports the board D1's six prayer tables,
imports them into a scratch app D1 built from migration 0001, and
compares counts. Equality of the live counts — not the Scope-time
numbers — is the test. Exported rows are John's private data: they
live only in the --work dir under /tmp, never in the repo.
"""
import argparse
import importlib.util
import json
import sqlite3
import subprocess
import sys
from pathlib import Path

ACCOUNT = "19135db329e6018b318b33b72aa6e3f3"
BOARD_D1 = "2d96a2ac-d9ef-42b7-98c6-34aa92cd65c8"
TABLES = ["prayer_items", "prayer_intentions", "prayer_draws",
          "prayer_completions", "prayer_addenda", "prayer_block_labels"]
CF = Path.home() / "workspace/custom-connectors/custom.cloudflare/bin/cf.py"


def d1_query(sql):
    out = subprocess.run(
        [sys.executable, str(CF), "POST",
         f"/accounts/{ACCOUNT}/d1/database/{BOARD_D1}/query",
         json.dumps({"sql": sql})],
        capture_output=True, text=True, timeout=120)
    doc = json.loads(out.stdout)
    if not doc.get("success"):
        raise SystemExit(f"D1 query failed: {out.stdout[:300]} {out.stderr[:200]}")
    return doc["result"][0]["results"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", default="/tmp/v305-rehearsal")
    ap.add_argument("--app-root", default=str(Path(__file__).resolve().parent.parent))
    args = ap.parse_args()
    work = Path(args.work)
    work.mkdir(parents=True, exist_ok=True)
    app_root = Path(args.app_root)

    exported = {}
    for t in TABLES:
        rows = d1_query(f"SELECT * FROM {t}")
        exported[t] = rows
        (work / f"{t}.json").write_text(json.dumps(rows))
        print(f"export {t}: {len(rows)} rows")

    db_path = work / "scratch-app.db"
    if db_path.exists():
        db_path.unlink()
    db = sqlite3.connect(db_path)
    db.executescript((app_root / "migrations/0001_prayer_tables.sql").read_text())
    for t in TABLES:
        rows = exported[t]
        if not rows:
            continue
        cols = list(rows[0].keys())
        ph = ",".join("?" * len(cols))
        db.executemany(
            f"INSERT INTO {t} ({','.join(cols)}) VALUES ({ph})",
            [[r[c] for c in cols] for r in rows])
    db.commit()

    ok = True
    for t in TABLES:
        n = db.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        match = n == len(exported[t])
        ok &= match
        print(f"count {t}: board={len(exported[t])} app={n} {'OK' if match else 'MISMATCH'}")
    orphan = db.execute(
        "SELECT COUNT(*) FROM prayer_draws d LEFT JOIN prayer_intentions i ON i.id = d.intention_id WHERE i.id IS NULL"
    ).fetchone()[0]
    print(f"draw FK integrity: orphan draws = {orphan}")
    ok &= orphan == 0
    split = db.execute(
        "SELECT priority, COUNT(*) FROM prayer_intentions WHERE status='active' GROUP BY priority ORDER BY priority"
    ).fetchall()
    print(f"active pool split: {split}")
    print("REHEARSAL:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
