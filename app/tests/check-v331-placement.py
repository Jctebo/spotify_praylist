#!/usr/bin/env python3
"""check-v331-placement — the v331 placement gate.

Runs the push helper's resolve_blocks() against the REAL 2026-11-08
manifest (17 episodes, 12 with underscore novena ids) with the app
door stubbed to the answers that produce today's standing placements
(the day payload's prayer-item names). Asserts all 17 placements:

  morning-prayer -> Morning · daily-rosary -> Morning (name-match,
  unchanged) · marian-antiphon-angelus -> Morning (v331 seed) ·
  auxilium-christianorum -> Afternoon · daily-reflection -> Night
  (name-match, unchanged) · every novena-* -> Midmorning (v331 seed)

Usage: check-v331-placement.py [path-to-push_episodes_to_app.py]
Defaults to the fork's jobs/push_episodes_to_app.py beside this
test's repo root. Exit 0 = all placements as asserted; exit 1 with
one FAIL line per wrong placement (the base tree's resolver fails
13 — the defect itself).
"""
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
HELPER = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parents[2] / "jobs" / "push_episodes_to_app.py"
REPORT = Path.home() / "workspace/ora-runner-runs/2026-11-08/report.json"

spec = importlib.util.spec_from_file_location("push_helper", HELPER)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class FakeDoor:
    """The production answers, reduced to what the resolver reads:
    no rss player_sources rows match these producers; the day
    payload names the four standing placements' prayer items."""

    def call(self, method, path, body=None):
        if path == "/api/player/sources":
            return 200, {"sources": []}
        if path.startswith("/api/agent/prayer/day"):
            return 200, {"blocks": [
                {"block": "Morning", "devotions": [{"name": "Morning Prayer"}, {"name": "Daily Rosary"}]},
                {"block": "Afternoon", "devotions": [{"name": "Auxilium Christianorum"}]},
                {"block": "Night", "devotions": [{"name": "Daily Reflection"}]},
            ]}
        raise AssertionError(f"unexpected door call {method} {path}")


helper.door = FakeDoor()

report = json.loads(REPORT.read_text())
episodes = report["episodes"]
blocks = helper.resolve_blocks(report["date"], episodes)

EXPECTED = {
    "morning-prayer": "Morning",
    "daily-rosary": "Morning",
    "marian-antiphon-angelus": "Morning",
    "auxilium-christianorum": "Afternoon",
    "daily-reflection": "Night",
}

fails = 0
n = 0
for key in episodes:
    n += 1
    want = EXPECTED.get(key) or ("Midmorning" if key.startswith("novena-") else None)
    got = blocks.get(key)
    good = want is not None and got == want
    if not good:
        fails += 1
    print(f"{'ok' if good else 'FAIL'} {n} - {key} -> {got} (want {want})")
print(f"RESULT: {n - fails} ok / {fails} FAIL of {n}")
sys.exit(1 if fails else 0)
