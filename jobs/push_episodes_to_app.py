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
     The v331 SEED_PLACEMENT table is consulted first: it carries
     the placement for the producers the name-match cannot place
     (novenas -> Midmorning, the Marian Antiphon -> Morning) until
     v328's settings read supersedes it.
     Sort = manifest order.
  2. Stages each built episode's audio: POST
     /api/agent/player/episodes/audio (R2 only, no D1 write).
  2B. (v318 T8) Stages each episode's text: the run directory's
     script-<episode_id>.txt, published under the feed half's T1 rule —
     a script carrying production markup ([, {, <), a script that is
     not valid UTF-8, or no script at all enters text_state 'missing',
     named and counted, never edited into shape. Staging is POST
     /api/agent/player/episodes/text (R2 only, no D1 write), so a
     failed push leaves the prior stored day intact.
  3. Commits the replace-day: POST /api/agent/player/day. The commit
     verifies staged sizes (audio and text), swaps the stored day in
     one D1 batch, and sweeps every OTHER date's objects — it can
     never delete a same-day Intentions segment, whether that segment
     arrives before or after this push (Plan E8's pinned ordering).
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

# v331 seed placement — DATA, not logic: the v328 seed rows for the
# producers the name-match below cannot place (no prayer item is named
# for the novenas or the Marian Antiphon, so both fell to 'unblocked'
# and rendered under "FROM TODAY'S PODCAST", outside the blocks).
# (match, block): "prefix" matches an episode-id prefix, "exact" the
# whole id. v328's settings read supersedes this table when it lands;
# until then this is the placement of record for these producers.
SEED_PLACEMENT = [
    ("prefix", "novena-", "Midmorning"),
    ("exact", "marian-antiphon-angelus", "Morning"),
]


def seed_block(episode_id: str):
    """The seed block for an episode id, or None when the seed does
    not name it (the episode then resolves by name-match as before)."""
    for kind, match, block in SEED_PLACEMENT:
        if kind == "prefix" and episode_id.startswith(match):
            return block
        if kind == "exact" and episode_id == match:
            return block
    return None


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
        seeded = seed_block(key)
        if seeded is not None:
            out[key] = seeded
            continue
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


def post_text(date: str, episode_id: str, file_path: Path) -> dict:
    headers = door._headers({
        "X-Episode-Date": date,
        "X-Episode-Id": episode_id,
        "Content-Type": "text/plain; charset=utf-8",
    })
    cmd = ["curl", "-s", "-X", "POST", *headers,
           "--data-binary", f"@{file_path}",
           f"{door.BASE}/api/agent/player/episodes/text"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        raise SystemExit(f"text staging for {episode_id}: unparseable reply {r.stdout[:200]!r}")


def resolve_text(rundir: Path, episode_id: str):
    """The episode's script bytes under the feed half's T1 rule, or
    None when the text stands missing: no script file, a script that
    is not valid UTF-8, or a script carrying production markup
    ([, {, <). Bytes are returned verbatim — never edited."""
    f = rundir / f"script-{episode_id}.txt"
    if not f.exists():
        return None
    data = f.read_bytes()
    if any(mark in data for mark in (b"[", b"{", b"<")):
        return None
    try:
        data.decode("utf-8")
    except UnicodeDecodeError:
        return None
    return data


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
        # v318 T8: the text resolves for every manifest episode,
        # independent of the audio's built state — the script stands
        # in the run directory whether or not its audio rendered.
        text_bytes = resolve_text(rundir, key)
        if text_bytes is not None:
            res = post_text(date, key, rundir / f"script-{key}.txt")
            if not res.get("ok") or res.get("size") != len(text_bytes):
                raise SystemExit(f"text staging failed for {key}: {res}")
            text_fields = {"text_state": "present", "text_size_bytes": len(text_bytes)}
        else:
            text_fields = {"text_state": "missing", "text_size_bytes": 0}
        if built:
            res = post_audio(date, key, f)
            if not res.get("ok") or res.get("size") != f.stat().st_size:
                raise SystemExit(f"audio staging failed for {key}: {res}")
            manifest.append({
                "episode_id": key, "title": strip_date(ep.get("title", key)),
                "block": blocks[key], "sort": sort,
                "duration_s": ep.get("duration_s", 0),
                "size_bytes": f.stat().st_size, "audio_state": "present",
                **text_fields,
            })
        else:
            manifest.append({
                "episode_id": key, "title": strip_date(ep.get("title", key)),
                "block": blocks[key], "sort": sort,
                "duration_s": ep.get("duration_s", 0),
                "size_bytes": 0, "audio_state": "missing",
                **text_fields,
            })

    status, commit = door.call("POST", "/api/agent/player/day", {"date": date, "episodes": manifest})
    if status != 200 or not commit.get("ok"):
        raise SystemExit(f"replace-day commit failed ({status}): {commit}")
    present = sum(1 for m in manifest if m["audio_state"] == "present")
    missing = len(manifest) - present
    verified = sum(1 for t in commit.get("perTrack", []) if t.get("audio") == "verified")
    texts_present = sum(1 for m in manifest if m["text_state"] == "present")
    texts_missing = len(manifest) - texts_present
    texts_verified = sum(1 for t in commit.get("perTrack", []) if t.get("text") == "verified")
    if commit.get("storedDate") != date or commit.get("rowCount") != len(manifest) or verified != present or texts_verified != texts_present:
        raise SystemExit(f"commit read-back mismatch: {commit} vs manifest {len(manifest)} ({present} present, texts {texts_present} present)")

    status, stored = door.call("GET", "/api/agent/player/stored-day")
    if status != 200 or stored.get("storedDate") != date or stored.get("episodeCount") != len(manifest) \
            or stored.get("textsPresent") != texts_present or stored.get("textsMissing") != texts_missing:
        raise SystemExit(f"stored-day read-back mismatch ({status}): {stored}")
    print(f"App push (v312): date pushed {date} · episodes {len(manifest)} "
          f"({present} present / {missing} missing) · per-track audio verified {verified} · "
          f"stored date after push {stored['storedDate']} · texts {texts_present} / {texts_missing}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
