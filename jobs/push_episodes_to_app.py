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

v324: the push also carries step 4C EXTERNALS — the nine external
RSS slots resolved by jobs/externals_resolver.py ride the same
replace-day commit. The morning mode `--externals-only` (no other
args) re-resolves the stored day's external rows through the
externals-only door route and prints the "Externals re-resolve
(v324)" field.

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
import datetime
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

TOOLS = Path.home() / "workspace/.tools"
spec = importlib.util.spec_from_file_location("prayer_door", TOOLS / "prayer_door.py")
door = importlib.util.module_from_spec(spec)
spec.loader.exec_module(door)

# v324 §2.6/§2.7: the externals resolver lives beside this helper.
_rspec = importlib.util.spec_from_file_location(
    "externals_resolver", Path(__file__).parent / "externals_resolver.py")
resolver = importlib.util.module_from_spec(_rspec)
_rspec.loader.exec_module(resolver)

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


def externals_only() -> int:
    """v324 §2.8 — the morning re-resolve leg (the 05:40 watchdog):
    re-resolve the STORED day's nine external rows and swap only
    those, through the externals-only door route. A stored day that
    is absent or not the current Chicago date is a named no-op; a
    resolver or feed failure leaves the rows exactly as they stand
    (nothing is posted) and is named."""
    status, stored = door.call("GET", "/api/agent/player/stored-day")
    stored_date = stored.get("storedDate") if status == 200 else None
    today = datetime.datetime.now(ZoneInfo("America/Chicago")).date().isoformat()
    if not stored_date or stored_date != today:
        print(f"Externals re-resolve (v324): stored day is {stored_date or 'none'} — re-resolve skipped")
        return 0
    target = datetime.date.fromisoformat(stored_date)
    entries, error, failed_feeds = resolver.resolve_externals_detailed(target)
    if error or failed_feeds:
        why = error or f"feed failure: {', '.join(sorted(failed_feeds))}"
        print(f"Externals re-resolve (v324): FAILED — {why} · rows stand as pushed")
        return 1
    status, reply = door.call("POST", "/api/agent/player/externals",
                              {"date": stored_date, "tracks": entries})
    if status != 200 or not reply.get("ok"):
        print(f"Externals re-resolve (v324): FAILED — externals route refused ({status}): {reply} · rows stand as pushed")
        return 1
    status, after = door.call("GET", "/api/agent/player/stored-day")
    if status != 200 or after.get("externalsPresent") != reply.get("externalsPresent") \
            or after.get("externalsMissing") != reply.get("externalsMissing"):
        raise SystemExit(f"externals read-back mismatch ({status}): {after} vs route {reply}")
    filled = reply.get("filled") or []
    still = [t["episode_id"] for t in reply.get("perSlot", []) if t["audio_state"] == "missing"]
    print(f"Externals re-resolve (v324): {reply['externalsPresent']}/9 present · "
          f"filled: {', '.join(filled) or 'none'} · still missing: {', '.join(still) or 'none'}")
    return 0


def main() -> int:
    args = sys.argv[1:]
    if "--externals-only" in args:
        return externals_only()
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

    # v324 §2.7 — step 4C stage: resolve the day's nine external
    # slots and append them to the manifest; the replace-day commit
    # stays the day's single write path. Externals never block the
    # own-episode commit (§2.6): a resolver failure degrades all nine
    # to missing and is named in the field below.
    ext_entries, ext_error, _ext_failed = resolver.resolve_externals_detailed(
        datetime.date.fromisoformat(date))
    combined = manifest + ext_entries

    status, commit = door.call("POST", "/api/agent/player/day", {"date": date, "episodes": combined})
    if status != 200 or not commit.get("ok"):
        raise SystemExit(f"replace-day commit failed ({status}): {commit}")
    present = sum(1 for m in manifest if m["audio_state"] == "present")
    missing = len(manifest) - present
    own_ids = {m["episode_id"] for m in manifest}
    # §2.4: verification counts are the OWN episodes' — an external
    # row's perTrack "verified" means stored-as-resolved, and the
    # helper counts externals from the read-back fields instead.
    verified = sum(1 for t in commit.get("perTrack", []) if t.get("audio") == "verified" and t.get("episode_id") in own_ids)
    texts_present = sum(1 for m in manifest if m["text_state"] == "present")
    texts_missing = len(manifest) - texts_present
    texts_verified = sum(1 for t in commit.get("perTrack", []) if t.get("text") == "verified" and t.get("episode_id") in own_ids)
    ext_present = sum(1 for e in ext_entries if e["audio_state"] == "present")
    if commit.get("storedDate") != date or commit.get("rowCount") != len(combined) or verified != present or texts_verified != texts_present:
        raise SystemExit(f"commit read-back mismatch: {commit} vs manifest {len(combined)} ({present} present, texts {texts_present} present)")

    status, stored = door.call("GET", "/api/agent/player/stored-day")
    if status != 200 or stored.get("storedDate") != date or stored.get("episodeCount") != len(combined) \
            or stored.get("textsPresent") != texts_present or stored.get("textsMissing") != texts_missing + len(ext_entries) \
            or stored.get("externalsPresent") != ext_present or stored.get("externalsMissing") != len(ext_entries) - ext_present:
        raise SystemExit(f"stored-day read-back mismatch ({status}): {stored}")
    print(f"App push (v312): date pushed {date} · episodes {len(manifest)} "
          f"({present} present / {missing} missing) · per-track audio verified {verified} · "
          f"stored date after push {stored['storedDate']} · texts {texts_present} / {texts_missing}")
    if ext_error:
        print(f"Externals (v324): RESOLVER FAILED — {ext_error} · all slots stand missing")
    else:
        ext_missing_ids = [e["episode_id"] for e in ext_entries if e["audio_state"] == "missing"]
        ext_present_fmt = ", ".join(f"{e['episode_id']}={e['source']}" for e in ext_entries if e["audio_state"] == "present")
        print(f"Externals (v324): {ext_present}/9 present · {ext_present_fmt} · "
              f"missing: {', '.join(ext_missing_ids) or 'none'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
