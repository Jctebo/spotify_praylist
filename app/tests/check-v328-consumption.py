#!/usr/bin/env python3
"""check-v328-consumption.py — v328 §2.5's consumption legs. Proves
the push helper's settings consumption against the golden oracle
(app/tests/fixtures/v328/golden-2026-11-08.json, captured from the
PRE-CHANGE helper on the real 2026-11-08 manifest + the v324
fixture feeds):

  (a) SEED EQUALITY — the seed settings resolve the real manifest
      to the golden on all three readings (blocks · per-block own
      sequences · externals). Carries check-v331's two placement
      assertions as a subset (novenas -> Midmorning, the Marian
      Antiphon -> Morning): they now hold by seed row, not by the
      deleted SEED_PLACEMENT code.
  (b) EDIT REFLECTION — Bible in a Year moved to Evening, Novenas
      off, Daily Rosary set to Fridays-only, run through the REAL
      helper main() end to end (staging transports stubbed; the
      door stubbed): the commit carries the edit, the excluded
      episodes never reach the commit, and the report names the
      version and every stood-out source with its reason. The
      edited read-back's sortOrders are produced by §2.2's own
      renumber rule applied to the fixture's array order (Bible in
      a Year precedes the Evening rows there, so it takes Evening
      position 1).
  (c) FALLBACK — the door read fails with a cache standing: the
      cache governs (blocks equal the golden in full) and the
      suffix names "(last-known cache)" + its version. The read
      fails with NO cache: the standing resolution governs, named
      "standing fallback (read failed)", and its blocks equal the
      golden EXCEPT the novenas and the antiphon, which stand
      'unblocked' — asserted openly: that is exactly the surface
      the settings (and before them v331's table) exist to cover.
  (d) FALLBACK INTERPLAY — Divine Office Morning Prayer missing
      from the feeds with Sing the Hours present: the slot fills
      with Sing the Hours at the primary's Morning position 5. With
      do-morning-prayer switched OFF, the slot stands missing, the
      fallback is NOT consulted, and the stood-out line names the
      primary with (off).

Run: python3 app/tests/check-v328-consumption.py
Exit 0 iff every check passes.
"""
import copy
import datetime
import importlib.util
import io
import json
import os
import re
import sys
import tempfile
import xml.etree.ElementTree as ET
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIX328 = ROOT / "app/tests/fixtures/v328"
FIX324 = ROOT / "app/tests/fixtures/v324"
GOLDEN = json.loads((FIX328 / "golden-2026-11-08.json").read_text())
SEED = json.loads((FIX328 / "settings-seed.json").read_text())
REPORT_PATH = Path.home() / "workspace/ora-runner-runs/2026-11-08/report.json"
REPORT = json.loads(REPORT_PATH.read_text())
EPISODES = REPORT["episodes"]
TARGET = datetime.date(2026, 11, 8)  # a Sunday

TMP = Path(tempfile.mkdtemp(prefix="opn-v328-check-"))
os.environ["OPN_SETTINGS_CACHE"] = str(TMP / "app-settings-cache.json")

results = []


def check(n, name, ok, detail=""):
    results.append((n, bool(ok)))
    print(f"{'ok' if ok else 'FAIL'} {n} - {name}" + (f" :: {detail}" if detail and not ok else ""))


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


resolver = load("externals_resolver_v328", ROOT / "jobs/externals_resolver.py")
helper = load("push_helper_v328", ROOT / "jobs/push_episodes_to_app.py")

DO_BYTES = (FIX324 / "divine-office.xml").read_bytes()
BIAY_BYTES = (FIX324 / "bible-in-a-year.xml").read_bytes()
STH_BYTES = (FIX324 / "sing-the-hours.xml").read_bytes()
URLS = resolver.FEED_URLS


def fetch_full(url):
    return {URLS["Divine Office"]: DO_BYTES, URLS["Bible in a Year"]: BIAY_BYTES,
            URLS["Sing the Hours"]: STH_BYTES}[url]


class ResolverShim:
    """main() calls the resolver with no fetch argument (the live
    feeds); the check pins the fixture feeds instead, so the run is
    deterministic and offline."""

    @staticmethod
    def resolve_externals_detailed(target, fetch=None):
        return resolver.resolve_externals_detailed(target, fetch=fetch_full)


helper.resolver = ResolverShim


def drop_items(xml_bytes, pred):
    root = ET.fromstring(xml_bytes)
    chan = root.find("channel")
    for item in list(chan.findall("item")):
        t = re.sub(r"\s+", " ", item.findtext("title") or "").strip()
        if pred(t):
            chan.remove(item)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


# ------------------------------------------------------------------
# (a) seed equality against the golden
# ------------------------------------------------------------------
by_key, prim, fb = helper.settings_maps(SEED)
placed, excluded, unmapped = helper.resolve_own_with_settings(EPISODES, TARGET, by_key)
# v337 §2.6: placed now carries a placement LIST per key (one per
# enabled governing row); the primary placement is the first. The
# seed fixtures carry no extra governing rows, so every list here
# is single and the assertions below read exactly as before.
blocks = {k: v[0][0] for k, v in placed.items()}
check("a1", "seed blocks equal the golden on all 17 episodes", blocks == GOLDEN["blocks"],
      str({k: (blocks.get(k), GOLDEN["blocks"].get(k)) for k in GOLDEN["blocks"] if blocks.get(k) != GOLDEN["blocks"].get(k)}))
check("a2", "check-v331 subset: every novena resolves to Midmorning",
      all(blocks.get(k) == "Midmorning" for k in EPISODES if k.startswith("novena-")))
check("a3", "check-v331 subset: marian-antiphon-angelus resolves to Morning",
      blocks.get("marian-antiphon-angelus") == "Morning")
check("a4", "seed stands nothing out and maps every family", excluded == [] and unmapped == [],
      f"excluded={excluded} unmapped={unmapped}")
seqs = {}
for key in EPISODES:
    if key in placed:
        for _blk, _srt in placed[key]:
            seqs.setdefault(_blk, []).append((_srt, key))
seqs = {b: [k for _s, k in sorted(v)] for b, v in seqs.items()}
check("a5", "per-block own sequences equal the golden (settings sorts preserve manifest order)",
      seqs == GOLDEN["sequences"], str(seqs))
entries, err, failed = resolver.resolve_externals_detailed(TARGET, fetch=fetch_full)
entries, ext_stood = helper.apply_settings_to_externals(entries, TARGET, prim, fb)
got_ext = [{k: e[k] for k in ("episode_id", "block", "source", "audio_state")} for e in entries]
check("a6", "externals under the seed equal the golden (id, block, source, state), nothing stood out",
      err is None and got_ext == GOLDEN["externals"] and ext_stood == [],
      f"err={err} stood={ext_stood} got={got_ext}")

# ------------------------------------------------------------------
# (b) edit reflection through the real main()
# ------------------------------------------------------------------
def server_renumber(rows):
    """§2.2's renumber, applied to the array order given: gapless
    1..n per block over enabled rows claiming a block; block '' or
    enabled 0 -> None."""
    counters = {}
    for r in rows:
        if r["enabled"] == 1 and r["block"]:
            counters[r["block"]] = counters.get(r["block"], 0) + 1
            r["sortOrder"] = counters[r["block"]]
        else:
            r["sortOrder"] = None
    return rows


edited = copy.deepcopy(SEED)
edited["version"] = 2
for r in edited["sources"]:
    if r["sourceKey"] == "bible-in-a-year":
        r["block"] = "Evening"
    if r["sourceKey"] == "novenas":
        r["enabled"] = 0
    if r["sourceKey"] == "daily-rosary":
        r["dayRule"] = "fridays"
edited["sources"] = server_renumber(edited["sources"])
biay = next(r for r in edited["sources"] if r["sourceKey"] == "bible-in-a-year")


class Door:
    """The door stub: serves the given settings document, captures
    the replace-day commit, and answers its read-backs from the
    captured body (the harness-v333 read-back shape)."""

    def __init__(self, settings_doc):
        self.settings_doc = settings_doc
        self.commit = None

    def call(self, method, path, body=None):
        if path == "/api/agent/player/settings":
            if self.settings_doc is None:
                return 500, {"error": "read failed"}
            return 200, copy.deepcopy(self.settings_doc)
        if path == "/api/agent/player/day" and method == "POST":
            self.commit = body
            own = [e for e in body["episodes"] if e.get("kind") != "external"]
            per = [{"episode_id": e["episode_id"],
                    "audio": "verified" if e["audio_state"] == "present" else "missing",
                    "text": "verified" if e.get("text_state") == "present" else "missing"}
                   for e in own]
            return 200, {"ok": True, "storedDate": body["date"],
                         "rowCount": len(body["episodes"]), "perTrack": per}
        if path == "/api/agent/player/stored-day":
            eps = self.commit["episodes"]
            own = [e for e in eps if e.get("kind") != "external"]
            ext = [e for e in eps if e.get("kind") == "external"]
            return 200, {"ok": True, "storedDate": self.commit["date"],
                         "episodeCount": len(eps),
                         "textsPresent": sum(1 for e in own if e.get("text_state") == "present"),
                         # the Worker's stored-day shape: textsMissing
                         # counts every stored row, externals included
                         "textsMissing": sum(1 for e in own if e.get("text_state") != "present") + len(ext),
                         "externalsPresent": sum(1 for e in ext if e["audio_state"] == "present"),
                         "externalsMissing": sum(1 for e in ext if e["audio_state"] != "present")}
        if path == "/api/player/sources":
            return 200, {"sources": []}
        if path.startswith("/api/agent/prayer/day"):
            # check-v331's proven reduction of the production day:
            # the four standing placements' prayer items.
            return 200, {"blocks": [
                {"block": "Morning", "devotions": [{"name": "Morning Prayer"}, {"name": "Daily Rosary"}]},
                {"block": "Afternoon", "devotions": [{"name": "Auxilium Christianorum"}]},
                {"block": "Night", "devotions": [{"name": "Daily Reflection"}]},
            ]}
        return 404, {"error": f"unstubbed {path}"}


def run_main(settings_doc):
    door = Door(settings_doc)
    helper.door = door
    helper.post_audio = lambda date, key, p: {"ok": True, "size": Path(p).stat().st_size}
    helper.post_text = lambda date, key, p: {"ok": True, "size": Path(p).stat().st_size}
    argv = sys.argv
    sys.argv = ["push_episodes_to_app.py", "--report", str(REPORT_PATH),
                "--rundir", str(REPORT_PATH.parent / "out")]
    buf = io.StringIO()
    try:
        with redirect_stdout(buf):
            try:
                rc = helper.main()
            except SystemExit as exc:  # the helper's failure shape
                rc = exc.code if isinstance(exc.code, int) else 1
                print(f"SystemExit: {exc.code}", file=sys.stderr)
    finally:
        sys.argv = argv
    return rc, buf.getvalue(), door.commit


rc, out, commit = run_main(edited)
committed = {e["episode_id"]: e for e in commit["episodes"]} if commit else {}
check("b1", "edited push exits 0", rc == 0, f"rc={rc} out={out[-300:]}")
check("b2", "Bible in a Year committed in Evening at its renumbered position (sort 500100)",
      committed.get("ext-bible-in-a-year", {}).get("block") == "Evening"
      and committed.get("ext-bible-in-a-year", {}).get("sort") == 500100,
      str(committed.get("ext-bible-in-a-year")))
check("b3", "Novenas off: no novena episode reaches the commit",
      not any(k.startswith("novena-") for k in committed))
check("b4", "Daily Rosary fridays-only on a Sunday: excluded from the commit",
      "daily-rosary" not in committed)
check("b5", "the App push line names the edited version: 'settings v2 (live read)'",
      "· settings v2 (live read)" in out, out.strip().splitlines()[0] if out.strip() else "")
check("b6", "the stood-out line names Novenas (off) and Daily Rosary (day rule: fridays)",
      "Settings (v328): stood out — " in out and "Novenas (off)" in out
      and "Daily Rosary (day rule: fridays)" in out,
      [ln for ln in out.splitlines() if "Settings (v328)" in ln])
check("b7", "the remaining own episodes stand in the commit (17 - 12 novenas - rosary = 4)",
      sum(1 for e in committed.values() if e.get("kind") != "external") == 4,
      str([k for k, e in committed.items() if e.get("kind") != "external"]))

# ------------------------------------------------------------------
# (c) fallback legs
# ------------------------------------------------------------------
cache_path = Path(os.environ["OPN_SETTINGS_CACHE"])
cache_path.write_text(json.dumps({"version": 1, "fetched_at": "2026-11-09T00:00:00+00:00",
                                  "sources": SEED["sources"]}))
helper.door = Door(None)
settings, version, label = helper.load_settings()
c_blocks = {}
if settings is not None:
    bk, _p, _f = helper.settings_maps(settings)
    p2, _e2, _u2 = helper.resolve_own_with_settings(EPISODES, TARGET, bk)
    c_blocks = {k: v[0][0] for k, v in p2.items()}
check("c1", "read fails with a cache standing: the cache governs — blocks equal the golden in full",
      settings is not None and c_blocks == GOLDEN["blocks"], str(c_blocks)[:200])
check("c2", "the suffix names it: 'settings v1 (last-known cache)'",
      helper.settings_suffix(settings, version, label) == " · settings v1 (last-known cache)",
      helper.settings_suffix(settings, version, label))
cache_path.unlink()
helper.door = Door(None)
settings2, version2, label2 = helper.load_settings()
check("c3", "read fails with no cache: settings None — the standing fallback governs",
      settings2 is None)
check("c4", "the suffix names it: 'settings: standing fallback (read failed)'",
      helper.settings_suffix(settings2, version2, label2) == " · settings: standing fallback (read failed)")
helper.door = Door(SEED)  # resolve_blocks reads sources (403) + the prayer day
fb_blocks = helper.resolve_blocks(REPORT["date"], EPISODES)
expected_fb = dict(GOLDEN["blocks"])
for k in expected_fb:
    if k.startswith("novena-") or k == "marian-antiphon-angelus":
        expected_fb[k] = "unblocked"
check("c5", "standing-fallback blocks equal the golden EXCEPT novenas + antiphon 'unblocked' (asserted openly)",
      fb_blocks == expected_fb,
      str({k: (fb_blocks.get(k), expected_fb.get(k)) for k in expected_fb if fb_blocks.get(k) != expected_fb.get(k)}))

# ------------------------------------------------------------------
# (d) fallback interplay
# ------------------------------------------------------------------
do_no_morning = drop_items(DO_BYTES, lambda t: "Morning Prayer" in t and "Nov" in t)


def fetch_no_morning(url):
    if url == URLS["Divine Office"]:
        return do_no_morning
    return fetch_full(url)


entries_d, err_d, _f_d = resolver.resolve_externals_detailed(TARGET, fetch=fetch_no_morning)
raw = {e["episode_id"]: e for e in entries_d}["ext-morning-prayer"]
check("d1", "the resolver itself fills the missed slot with Sing the Hours (pre-settings fact)",
      raw["audio_state"] == "present" and raw["source"] == "Sing the Hours", str(raw)[:160])
entries_d, stood_d = helper.apply_settings_to_externals(entries_d, TARGET, prim, fb)
filled = {e["episode_id"]: e for e in entries_d}["ext-morning-prayer"]
check("d2", "the filled fallback takes the primary's block + position (Morning, sort 100500), source named Sing the Hours",
      filled["audio_state"] == "present" and filled["block"] == "Morning"
      and filled["sort"] == 100500 and filled["source"] == "Sing the Hours" and stood_d == [],
      str(filled)[:200])
seed_off = copy.deepcopy(SEED)
for r in seed_off["sources"]:
    if r["sourceKey"] == "do-morning-prayer":
        r["enabled"] = 0
_bk3, prim3, fb3 = helper.settings_maps(seed_off)
entries_e, _e3, _f3 = resolver.resolve_externals_detailed(TARGET, fetch=fetch_no_morning)
entries_e, stood_e = helper.apply_settings_to_externals(entries_e, TARGET, prim3, fb3)
off_entry = {e["episode_id"]: e for e in entries_e}["ext-morning-prayer"]
check("d3", "primary OFF: the slot stands missing, the Sing the Hours fill is NOT consulted",
      off_entry["audio_state"] == "missing" and off_entry["stream_url"] == "", str(off_entry)[:160])
check("d4", "the stood-out list names the primary with (off)",
      stood_e == [("Divine Office — Morning Prayer", "off")], str(stood_e))

fails = [n for n, okk in results if not okk]
print(f"check-v328-consumption: {len(results) - len(fails)} ok / {len(fails)} FAIL")
sys.exit(1 if fails else 0)
