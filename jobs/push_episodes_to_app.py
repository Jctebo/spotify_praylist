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
  1. Resolves each episode's block AT PUSH TIME. v328: the authority
     is the app's source-mapping settings, read ONCE through the
     agent door (GET /api/agent/player/settings) — each episode
     family takes its governing row's block, day rule, on/off, and
     order, and the committed sort derives from the settings order
     (§2.4's formula). A failed read falls back to the last-known
     cache, and before any cache stands, to the standing resolution:
     mapped player_sources titles first (when readable), then the
     day's prayer-item names from the app's own day payload — longest
     name that the episode's title carries as its head wins, so
     "Daily Rosary - Sorrowful Mysteries - ..." resolves to the
     Morning block's "Daily Rosary"; unmatched -> 'unblocked'; sort
     = manifest order. Every leg is named in the report field, and
     any source that stood out (off, day-ruled, unmapped) is named
     in the companion "Settings (v328)" line.
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

# ---- v328: the source-mapping settings (Plan §2.4) -----------------
# Family matchers (mechanics, code constants — matching is not a
# setting; Scope §1's line): (match kind, episode-id pattern, settings
# source_key). The 2026-11-08 manifest's keys are the families'
# evidence. v331's SEED_PLACEMENT table is absorbed and DELETED: its
# two placements (novenas -> Midmorning, the Marian Antiphon ->
# Morning) are seed rows in the settings now.
FAMILY_MATCH = [
    ("exact", "morning-prayer", "morning-prayer"),
    ("exact", "daily-rosary", "daily-rosary"),
    ("exact", "marian-antiphon-angelus", "marian-antiphon"),
    ("prefix", "novena-", "novenas"),
    ("exact", "auxilium-christianorum", "auxilium-christianorum"),
    ("exact", "daily-reflection", "daily-reflection"),
]

BLOCK_ORDINAL = {"Morning": 1, "Midmorning": 2, "Midday": 3, "Afternoon": 4,
                 "Evening": 5, "Night": 6, "unblocked": 7}

# The last-known cache (D4): outside the per-date run dirs, so it
# survives across nights. OPN_SETTINGS_CACHE overrides it (the
# consumption check's seam); production never sets the override.
SETTINGS_CACHE = Path(
    __import__("os").environ.get(
        "OPN_SETTINGS_CACHE",
        str(Path.home() / "workspace/ora-runner-runs/app-settings-cache.json")))


def family_of(episode_id: str):
    """The settings source_key governing an episode id, or None."""
    for kind, match, key in FAMILY_MATCH:
        if kind == "prefix" and episode_id.startswith(match):
            return key
        if kind == "exact" and episode_id == match:
            return key
    return None


def load_settings():
    """One versioned door read (D4) -> (settings, version, label).
    Success: the cache is rewritten and the label is 'live read'.
    Any failure: the cache governs when it stands ('last-known
    cache'); before any cache stands, (None, None, 'standing
    fallback') and the standing resolution below governs."""
    try:
        status, body = door.call("GET", "/api/agent/player/settings")
        if status != 200 or not isinstance(body, dict) \
                or not isinstance(body.get("sources"), list) \
                or not isinstance(body.get("version"), int):
            raise ValueError(f"settings read malformed ({status})")
        try:
            SETTINGS_CACHE.parent.mkdir(parents=True, exist_ok=True)
            tmp = SETTINGS_CACHE.with_name(SETTINGS_CACHE.name + ".tmp")
            tmp.write_text(json.dumps({
                "version": body["version"],
                "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "sources": body["sources"],
            }))
            tmp.replace(SETTINGS_CACHE)
        except Exception:
            pass  # a cache-write failure never fails the read
        return body, body["version"], "live read"
    except Exception:
        pass
    try:
        cache = json.loads(SETTINGS_CACHE.read_text())
        if isinstance(cache.get("sources"), list) and isinstance(cache.get("version"), int):
            return {"version": cache["version"], "sources": cache["sources"]}, cache["version"], "last-known cache"
    except Exception:
        pass
    return None, None, "standing fallback"


def day_rule_passes(rule: str, target: datetime.date) -> bool:
    """The stored day-rule vocabulary against the target date
    (§2.4 step 4). 'fallback-only' on the row being evaluated as a
    play candidate never passes: on a primary row it means the row
    never plays; a fallback row's gate is day_rule_fills()."""
    if rule == "daily":
        return True
    if rule == "weekdays":
        return target.weekday() < 5
    if rule == "weekends":
        return target.weekday() >= 5
    if rule == "sundays":
        return target.weekday() == 6
    if rule == "fridays":
        return target.weekday() == 4
    return False


def day_rule_fills(rule: str, target: datetime.date) -> bool:
    """A fallback row's own day-rule gate (§2.4 step 5): the seed's
    'fallback-only' states the row's ROLE, not a day restriction —
    it fills whenever its primary misses; the calendar rules gate
    the days as usual."""
    if rule == "fallback-only":
        return True
    return day_rule_passes(rule, target)


def settings_maps(settings: dict):
    """-> (by_key, by_slot_primary, by_slot_fallback)."""
    by_key, prim, fb = {}, {}, {}
    for r in settings.get("sources", []):
        by_key[r.get("sourceKey")] = r
        slot = r.get("slotId")
        if slot:
            if r.get("role") == "fallback":
                fb[slot] = r
            else:
                prim[slot] = r
    return by_key, prim, fb


def _settings_sort(block: str, sort_order, intra: int = 0) -> int:
    """§2.4 step 6's formula: blockOrdinal x 100000 + sort_order x
    100 + intra-family index — the payload reads ORDER BY sort,
    episode_id, so the intra index is what keeps a family's episodes
    in manifest order instead of alphabetical."""
    return BLOCK_ORDINAL.get(block, 7) * 100000 + (sort_order or 0) * 100 + intra


def resolve_own_with_settings(episodes: dict, target: datetime.date, by_key: dict):
    """-> (placed, excluded, unmapped). placed: key -> (block, sort)
    for every episode that stands in the day; excluded: [(name,
    reason)] for family episodes the settings stand out (NOT pushed
    as tracks, §1 in-scope 3); unmapped: [keys] the settings do not
    name — committed as 'unblocked' in manifest order (§2.4 step
    3(c)), sorted after the block-mapped unblocked rows."""
    placed, excluded, unmapped = {}, [], []
    intra = {}
    for idx, key in enumerate(episodes):
        fam = family_of(key)
        n = intra.get(fam, 0) if fam else 0
        if fam:
            intra[fam] = n + 1
        row = by_key.get(fam) if fam else None
        if row is None:
            unmapped.append(key)
            placed[key] = ("unblocked", BLOCK_ORDINAL["unblocked"] * 100000 + 50000 + idx)
            continue
        if not row.get("enabled"):
            excluded.append((row.get("name") or key, "off"))
            continue
        if not day_rule_passes(row.get("dayRule") or "daily", target):
            excluded.append((row.get("name") or key, f"day rule: {row.get('dayRule')}"))
            continue
        block = row.get("block") or "unblocked"
        placed[key] = (block, _settings_sort(block, row.get("sortOrder"), n))
    return placed, excluded, unmapped


def _external_missing(entry: dict, block: str, sort: int) -> dict:
    e = dict(entry)
    e.update({"block": block, "sort": sort, "audio_state": "missing",
              "stream_url": "", "size_bytes": 0, "duration_s": 0})
    return e


def apply_settings_to_externals(entries: list, target: datetime.date, prim: dict, fb: dict):
    """§2.4 step 5: the slot's primary row governs block + position
    + on/off. Primary off or day-ruled out -> the entry stands
    missing at the primary row's position and the fallback is NOT
    consulted. A Sing the Hours fill stands only while its fallback
    row is enabled and its day rule lets it fill. -> (entries,
    stood_out [(name, reason)])."""
    out, stood = [], []
    for e in entries:
        slot = e["episode_id"]
        row = prim.get(slot)
        if row is None:
            out.append(e)  # no governing row: the resolver's entry stands
            continue
        block = row.get("block") or "unblocked"
        sort = _settings_sort(block, row.get("sortOrder"))
        if not row.get("enabled"):
            stood.append((row.get("name") or slot, "off"))
            out.append(_external_missing(e, block, sort))
            continue
        if not day_rule_passes(row.get("dayRule") or "daily", target):
            stood.append((row.get("name") or slot, f"day rule: {row.get('dayRule')}"))
            out.append(_external_missing(e, block, sort))
            continue
        e2 = dict(e)
        e2.update({"block": block, "sort": sort})
        if e["audio_state"] == "present" and e.get("source") == "Sing the Hours":
            frow = fb.get(slot)
            if frow is not None and (not frow.get("enabled")
                                     or not day_rule_fills(frow.get("dayRule") or "daily", target)):
                if not frow.get("enabled"):
                    stood.append((frow.get("name") or slot, "off"))
                else:
                    stood.append((frow.get("name") or slot, f"day rule: {frow.get('dayRule')}"))
                out.append(_external_missing(e, block, sort))
                continue
        out.append(e2)
    return out, stood


def settings_suffix(settings, version, label) -> str:
    """§2.4 step 7's suffix, exact forms."""
    if settings is None:
        return " · settings: standing fallback (read failed)"
    return f" · settings v{version} ({label})"


def stood_out_line(stood: list, unmapped: list) -> str:
    """The always-printed companion line (§2.4 step 7): its absence
    from a run report is itself a failure signal."""
    parts = [f"{name} ({reason})" for name, reason in stood]
    parts += [f"{key} (unmapped)" for key in unmapped]
    return f"Settings (v328): stood out — {' · '.join(parts) if parts else 'none'}"


def strip_date(title: str) -> str:
    return DATE_SUFFIX.sub("", title or "").strip()


def resolve_blocks(report_date: str, episodes: dict) -> dict:
    """episode key -> block name (or 'unblocked') — the STANDING
    resolution (v328 §2.4 step 2's fallback): the pre-v328 ladder
    minus v331's SEED_PLACEMENT, which the settings absorb. It
    governs only when no settings read and no cache stand, and the
    push names that leg in its report."""
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
    # v328 §2.4 steps 1+5+7: the morning leg consumes the settings
    # the same way the nightly push does — one read, the same
    # governance; the suffix names the leg on the re-resolve line,
    # and a settings exclusion that lands a slot missing is named.
    settings, set_version, set_label = load_settings()
    ext_stood = []
    if settings is not None:
        _by_key, slot_prim, slot_fb = settings_maps(settings)
        entries, ext_stood = apply_settings_to_externals(entries, target, slot_prim, slot_fb)
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
          f"filled: {', '.join(filled) or 'none'} · still missing: {', '.join(still) or 'none'}"
          f"{settings_suffix(settings, set_version, set_label)}")
    if ext_stood:
        print(stood_out_line(ext_stood, []))
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

    # v328 §2.4 step 1: ONE settings read per push, taken before any
    # resolution; every leg below is governed by what it returns.
    settings, set_version, set_label = load_settings()
    target_date = datetime.date.fromisoformat(date)
    slot_prim = slot_fb = None
    stood, unmapped = [], []
    if settings is not None:
        by_key, slot_prim, slot_fb = settings_maps(settings)
        placed, stood, unmapped = resolve_own_with_settings(episodes, target_date, by_key)
        order = [(key, placed[key][0], placed[key][1]) for key in episodes if key in placed]
    else:
        blocks = resolve_blocks(date, episodes)
        order = [(key, blocks[key], i + 1) for i, key in enumerate(episodes)]
    manifest = []
    for key, block, sort in order:
        ep = episodes[key]
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
                "block": block, "sort": sort,
                "duration_s": ep.get("duration_s", 0),
                "size_bytes": f.stat().st_size, "audio_state": "present",
                **text_fields,
            })
        else:
            manifest.append({
                "episode_id": key, "title": strip_date(ep.get("title", key)),
                "block": block, "sort": sort,
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
    # v328 §2.4 step 5: the settings govern the externals' blocks,
    # positions, and standing (a resolver failure already degraded
    # all nine to missing entries, which the settings then place).
    if settings is not None and ext_entries:
        ext_entries, ext_stood = apply_settings_to_externals(
            ext_entries, target_date, slot_prim, slot_fb)
        stood += ext_stood
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
          f"stored date after push {stored['storedDate']} · texts {texts_present} / {texts_missing}"
          f"{settings_suffix(settings, set_version, set_label)}")
    # §2.4 step 7: the companion line ALWAYS prints — in the
    # standing-fallback leg too (its counts describe the settings'
    # view, which that leg did not apply; the line still names the
    # read failure through the suffix above and 'none' here unless
    # the settings leg itself stood something out).
    print(stood_out_line(stood, unmapped))
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
