#!/usr/bin/env python3
"""push_episodes_to_app.py — v312 step 4B helper (Plan E8).

Pushes one published day's episodes into the Ora Pro Nobis app's own
store through the app's agent door (the prayer_door.py pattern —
Cloudflare Access service headers + the app's own Bearer AGENT_TOKEN;
values are read by the helper module and never printed).

Run by the nightly production run at step 4B: AFTER step 4's publish
verification and BEFORE the ledger flip. The push is part of the
publish tail — a timeout or failure is completed by --reconcile
exactly like the rest of the tail, ledger flip still last, and this
script is idempotent (re-running it for the same date replaces the
same day and changes nothing else).

Inputs: the run's report.json (the manifest: episodes dict keyed by
the short episode id, each with title / file / duration_s / bytes /
status) and the built MP3 files standing in the run directory.

What it does:
  1. Resolves each episode's block AT PUSH TIME (Scope §1's rule):
     mapped player_sources titles first (when readable), then the
     day's prayer-item names from the app's own day payload — longest
     name that the episode's title carries as its head wins, so
     "Daily Rosary - Sorrowful Mysteries - ..." resolves to the
     Morning block's "Daily Rosary". Unmatched -> 'unblocked'.
     Sort = manifest order.
  2. Stages each built episode's audio: POST
     /api/agent/player/episodes/audio (R2 only, no D1 write).
  3. Commits the replace-day: POST /api/agent/player/day. The commit
     verifies staged sizes, swaps the stored day in one D1 batch, and
     sweeps every OTHER date's objects — it can never delete a
     same-day Intentions segment, whether that segment arrives before
     or after this push (Plan E8's pinned ordering).
  4. Reads back GET /api/agent/player/stored-day and asserts the
     stored date and counts match the manifest; prints the mandatory
     closing-report field "App push (v312)". Any failed assert exits
     non-zero so the run's step fails loudly and reconcile re-runs
     the whole push.
"""
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

TOOLS = Path.home() / "workspace/.tools"
spec = importlib.util.spec_from_file_location("prayer_door", TOOLS / "prayer_door.py")
door = importlib.util.module_from_spec(spec)
spec.loader.exec_module(door)

DATE_SUFFIX = re.compile(r" - [A-Z][a-z]+ \d{1,2}, \d{4}$")


def strip_date(title: str) -> str:
    return DATE_SUFFIX.sub("", title or "").strip()


def resolve_blocks(report_date: str, episodes: dict) -> dict:
    """episode key -> block name (or 'unblocked')."""
    name_to_block = {}
    # Mapped player_sources titles first (Scope §1's push-time rule).
    try:
        status, sources = door.call("GET", "/api/player/sources")
        if status == 200:
            for s in sources.get("sources", []):
                if s.get("source_kind") == "rss" and s.get("title"):
                    name_to_block[s["title"]] = s["block"]
    except Exception:
        pass  # sources are a refinement; the day payload carries the names
    # The day's prayer-item names, from the app's own day payload.
    status, day = door.call("GET", f"/api/agent/prayer/day?date={report_date}")
    if status == 200:
        for b in day.get("blocks", []):
            for d in b.get("devotions", []):
                name_to_block[d["name"]] = b["block"]
    names = sorted(name_to_block, key=len, reverse=True)
    out = {}
    for key, ep in episodes.items():
        title = strip_date(ep.get("title", ""))
        block = "unblocked"
        for name in names:
            if title == name or title.startswith(name + " -") or title.startswith(name + ":"):
                block = name_to_block[name]
                break
        out[key] = block
    return out


def post_audio(date: str, episode_id: str, file_path: Path) -> dict:
    headers = door._headers({
        "X-Episode-Date": date,
        "X-Episode-Id": episode_id,
        "Content-Type": "audio/mpeg",
    })
    cmd = ["curl", "-s", "-X", "POST", *headers,
           "--data-binary", f"@{file_path}",
           f"{door.BASE}/api/agent/player/episodes/audio"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        raise SystemExit(f"audio staging for {episode_id}: unparseable reply {r.stdout[:200]!r}")


def main() -> int:
    args = sys.argv[1:]
    report_path = None
    rundir = None
    i = 0
    while i < len(args):
        if args[i] == "--report":
            report_path = Path(args[i + 1]); i += 2
        elif args[i] == "--rundir":
            rundir = Path(args[i + 1]); i += 2
        else:
            raise SystemExit(f"unknown arg {args[i]!r} — usage: push_episodes_to_app.py --report <report.json> [--rundir <dir>]")
    if report_path is None:
        raise SystemExit("usage: push_episodes_to_app.py --report <report.json> [--rundir <dir>]")
    report = json.loads(report_path.read_text())
    date = report["date"]
    if rundir is None:
        rundir = Path(report.get("rundir") or report_path.parent)
    episodes = report.get("episodes") or {}
    if not episodes:
        raise SystemExit("report carries no episodes — nothing to push")

    blocks = resolve_blocks(date, episodes)
    manifest = []
    for sort, (key, ep) in enumerate(episodes.items(), start=1):
        f = rundir / (ep.get("file") or "")
        built = ep.get("status") == "built" and ep.get("file") and f.exists()
        if built:
            res = post_audio(date, key, f)
            if not res.get("ok") or res.get("size") != f.stat().st_size:
                raise SystemExit(f"audio staging failed for {key}: {res}")
            manifest.append({
                "episode_id": key, "title": strip_date(ep.get("title", key)),
                "block": blocks[key], "sort": sort,
                "duration_s": ep.get("duration_s", 0),
                "size_bytes": f.stat().st_size, "audio_state": "present",
            })
        else:
            manifest.append({
                "episode_id": key, "title": strip_date(ep.get("title", key)),
                "block": blocks[key], "sort": sort,
                "duration_s": ep.get("duration_s", 0),
                "size_bytes": 0, "audio_state": "missing",
            })

    status, commit = door.call("POST", "/api/agent/player/day", {"date": date, "episodes": manifest})
    if status != 200 or not commit.get("ok"):
        raise SystemExit(f"replace-day commit failed ({status}): {commit}")
    present = sum(1 for m in manifest if m["audio_state"] == "present")
    missing = len(manifest) - present
    verified = sum(1 for t in commit.get("perTrack", []) if t.get("audio") == "verified")
    if commit.get("storedDate") != date or commit.get("rowCount") != len(manifest) or verified != present:
        raise SystemExit(f"commit read-back mismatch: {commit} vs manifest {len(manifest)} ({present} present)")

    status, stored = door.call("GET", "/api/agent/player/stored-day")
    if status != 200 or stored.get("storedDate") != date or stored.get("episodeCount") != len(manifest):
        raise SystemExit(f"stored-day read-back mismatch ({status}): {stored}")
    print(f"App push (v312): date pushed {date} · episodes {len(manifest)} "
          f"({present} present / {missing} missing) · per-track audio verified {verified} · "
          f"stored date after push {stored['storedDate']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
