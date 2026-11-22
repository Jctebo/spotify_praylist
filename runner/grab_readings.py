#!/usr/bin/env python3
"""v608 — the nightly USCCB readings grab.

Design: additive, isolated, never blocks the run. Once a
night this script asks the app (through the standing
prayer_door helper) to pull the CURRENT Chicago day's
readings from the USCCB Daily Readings RSS feed, verify
them, and store them in the app's readings_cache display
store (migration 0046) — the feed carries today + the
previous nine days and no future days, so the grab is for
the run date itself, not the pipeline's TARGET date. The
Mass tab then serves the day from the store with zero
outbound fetches; a missed night degrades to the standing
live-fetch fallback at first open, never to an empty Mass.

Contract: prints EXACTLY ONE line —
  Readings grab: <date> ok — <N> parts, <M> memorials stored
  Readings grab: FAILED <date> — <reason>
Exit 0 when a verdict was obtained (stored, or judged
failed by the app); exit 1 only when the door call itself
failed. Nothing here may raise into the nightly run.
"""
import datetime
import importlib.util
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

TOOLS = Path.home() / "workspace/.tools"


def main() -> int:
    date = datetime.datetime.now(ZoneInfo("America/Chicago")).date().isoformat()
    try:
        spec = importlib.util.spec_from_file_location("prayer_door", TOOLS / "prayer_door.py")
        door = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(door)
        _code, verdict = door.call("POST", "/api/agent/prayer/readings-grab", {"date": date})
    except Exception as e:  # noqa: BLE001 — the door call itself failed
        print(f"Readings grab: FAILED {date} — door call failed: {e}")
        return 1
    try:
        if verdict.get("ok"):
            print(f"Readings grab: {date} ok — {verdict.get('parts', 0)} parts, {verdict.get('memorials', 0)} memorials stored")
        else:
            print(f"Readings grab: FAILED {date} — {verdict.get('reason', 'no verdict reason')}")
    except Exception as e:  # noqa: BLE001 — a malformed verdict still yields the one line
        print(f"Readings grab: FAILED {date} — unreadable verdict: {e}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # noqa: BLE001 — never raise a traceback into the run
        print(f"Readings grab: FAILED — {e}")
        sys.exit(1)
