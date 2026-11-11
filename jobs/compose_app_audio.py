#!/usr/bin/env python3
"""compose_app_audio.py — v337 §2.7: the amended nightly step 4D
SEGMENTS + INTROS (replacing v335 §2's step 4D in full; v335's
target-pinned enactment never lands).

One invocation per Ora nightly run, standing immediately after
step 4B's replace-day commit:

    python3 jobs/compose_app_audio.py [--date <consumption date>]

The date defaults to the Chicago date at invocation — the step
composes for the CONSUMPTION day (the calendar day the app
presents), never for the production target. It performs, in order:

  1. DRAW READ. The consumption day's prayer payload through the
     app agent door (GET /api/agent/prayer/day?date=) — per-item
     drawn intentions. This payload, and no other, is the content
     source for the intros.
  2. SEGMENTS (dual-compose leg). The six block segment TEXTS for
     the consumption date are taken from the Devotional Suite run's
     step-7b composition outputs for that same date — one
     composition, two consumers. The composition's readable
     standing output is the board's prayer tasks: step 7e of the
     Suite sheet files each block's script verbatim as the notes of
     that block's Intentions subtask AND of the parent Activities
     occurrence; this helper reads the parent occurrences' notes
     through the board door. Each text is rendered in voice
     avocado_v2:MAI_03 and pushed replace-in-place through
     prayer_door.push_audio("current", <Block>, file). If the
     composition does not stand when the step runs, the step
     retries on a bounded wait (three attempts, five minutes
     apart) and then reports the composition MISSING in the
     Segments field and exits non-zero — it never composes a
     substitute text (the one-composition rule), and it never
     blocks the rest of the nightly run's report.
  3. INTROS (the v338 generation contract). For every PRESENTED
     track of the consumption date with a paired prayer item,
     compose the intro text, render it avocado_v2:MAI_03, and push
     it to the standing intro family (POST /api/agent/prayer/intro,
     the literal 'current' only; R2 intros/current/<episode_id>.mp3
     + the prayer_intros index). A track whose render or push fails
     is NAMED in the Segments field; its prayer is never blocked.
     After pushing, intros whose episode is no longer presented are
     cleared (door DELETE + index row), so no stale intro survives
     its track.
  4. THE REPORT FIELD, printed last, exact shape:
       Segments (v337): standing — segments <n>/6 for presented
       <date> · intros <n>/<m> for presented <date> · missing:
       <names, or "none">
     On any shortfall the line opens "Segments (v337): MISSING — …"
     with the failed pieces named (a missing Suite composition
     reads "segments: composition missing for <date>"; failed
     intros are named by track title). <m> counts the presented
     tracks whose paired item carries a drawn intention (the
     intro-eligible set); presented tracks with no paired item, or
     whose item carries no drawn intention that day, get NO intro
     and are counted once as unpaired (detail line on stdout, not
     in the field).

THE PAIRING (helper data, §2.7's single statement of it; keys are
presented tracks, values are prayer-item names as they stand in the
consumption payload):
  own episodes — morning-prayer -> Morning Prayer · daily-rosary ->
  Daily Rosary · marian-antiphon-angelus -> Morning Marian Antiphon
  (the Antiphon item of the episode's home block; the intro belongs
  to the episode, not to each of its three block placements — paired
  once) · every novena-* episode -> Novenas (an intro per novena
  episode, keyed to that episode's own id, text from the Novenas
  item's draw — John's 2026-11-09 07:20 CT ruling) ·
  auxilium-christianorum -> Auxilium Christianorum ·
  daily-reflection -> Daily Reflection.
  external slots — ext-invitatory -> Invitatory ·
  ext-morning-prayer -> Morning Prayer (Liturgy of the Hours) ·
  ext-midmorning-prayer -> Midmorning (Terce) · ext-midday-prayer
  -> Midday Prayer · ext-midafternoon-prayer -> None (Liturgy of
  the Hours) · ext-office-of-readings -> Office of Readings ·
  ext-evening-prayer -> Vespers · ext-night-prayer -> Compline ·
  ext-bible-in-a-year -> Bible in a Year · ext-gospel-exegesis ->
  Daily Gospel Exegesis · ext-saint-of-the-day -> Saint of the Day.
  A Sing the Hours fallback fill inherits its slot's pairing.

THE INTRO TEXT (exact): "This prayer is for " + the drawn
intention's text, with ONE join rule: if the intention text begins
with the word "for " (case-insensitive), that leading "for " is
stripped before joining, so the template's own "for" is never
doubled. No saint line, no addendum, no per-prayer composition.

Harness seams (never set in production): OPN_APP_BASE retargets the
app door at a local wrangler dev · OPN_APP_TOKEN overrides the door's
app token for that local instance · OPN_SEGMENTS_FILE names a JSON
{Block: text} standing in for the board-notes composition read ·
OPN_RETRY_DELAY_S sets the bounded-retry spacing (default 300) ·
OPN_TTS_CMD sets the render command (default /opt/hatch/bin/tts).
"""
import datetime
import importlib.util
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from zoneinfo import ZoneInfo

TOOLS = Path.home() / "workspace/.tools"


def _load(name):
    spec = importlib.util.spec_from_file_location(name, TOOLS / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


door = _load("prayer_door")
if os.environ.get("OPN_APP_BASE"):
    door.BASE = os.environ["OPN_APP_BASE"]
if os.environ.get("OPN_APP_TOKEN"):
    # Harness seam (never set in production): point the door's app
    # token at the local instance under test.
    door._app_token = lambda: os.environ["OPN_APP_TOKEN"]
    door._cf = lambda: ("harness", "harness")
board_door = _load("curl_door")

BLOCKS = ["Morning", "Midmorning", "Midday", "Afternoon", "Evening", "Night"]
VOICE = "avocado_v2:MAI_03"
TTS_CMD = os.environ.get("OPN_TTS_CMD", "/opt/hatch/bin/tts")
RETRY_DELAY_S = int(os.environ.get("OPN_RETRY_DELAY_S", "300"))
RETRY_ATTEMPTS = 3

OWN_PAIRING = {
    "morning-prayer": "Morning Prayer",
    "daily-rosary": "Daily Rosary",
    "marian-antiphon-angelus": "Morning Marian Antiphon",
    "auxilium-christianorum": "Auxilium Christianorum",
    "daily-reflection": "Daily Reflection",
}
NOVENA_ITEM = "Novenas"
SLOT_PAIRING = {
    "ext-invitatory": "Invitatory",
    "ext-morning-prayer": "Morning Prayer (Liturgy of the Hours)",
    "ext-midmorning-prayer": "Midmorning (Terce)",
    "ext-midday-prayer": "Midday Prayer",
    "ext-midafternoon-prayer": "None (Liturgy of the Hours)",
    "ext-office-of-readings": "Office of Readings",
    "ext-evening-prayer": "Vespers",
    "ext-night-prayer": "Compline",
    "ext-bible-in-a-year": "Bible in a Year",
    "ext-gospel-exegesis": "Daily Gospel Exegesis",
    "ext-saint-of-the-day": "Saint of the Day",
    # v339 §2.5: the Mass and Homilies block's four slots pair to
    # the Mass item — each renders its OWN intro file from the
    # Mass item's drawn intention (the Novenas precedent). This
    # table and the Worker's INTRO_PAIRING mirror are one contract
    # in two places: a change lands in both or neither.
    "ext-usccb-readings": "Mass",
    "ext-daily-tv-mass": "Mass",
    "ext-fr-mike-homily": "Mass",
    "ext-barron-sermon": "Mass",
    # v368 §2.6 (D4-B, John's word 2026-11-10 20:48 CT — the NEW
    # module item, as designed): The AI Signal episode pairs to
    # the new item 'The AI Signal' (migration 0016 plants it in
    # its own module block). The Worker's INTRO_PAIRING carries
    # the same entry — the two tables are one contract, changed
    # together or not at all.
    "the-ai-signal": "The AI Signal",
}

# v368 §2.6.3: The AI Signal episode stands in neither the own
# feed nor the settings slots — the same store-only fact that
# forces the client's own leg — so the intros leg's presented
# set gains it by this named constant, appended before
# eligibility runs. Eligibility is then standing: pairing
# (SLOT_PAIRING above) + the item's draw for the consumption
# date (read_draw from the module payload — the item stands
# there because the module payload is not filtered).
APP_PRESENTED = ["the-ai-signal"]


def pairing_for(track_id: str):
    """The prayer-item name a presented track pairs with, or None."""
    if track_id in OWN_PAIRING:
        return OWN_PAIRING[track_id]
    if track_id.startswith("novena-"):
        return NOVENA_ITEM
    return SLOT_PAIRING.get(track_id)


def intro_text(intention: str) -> str:
    """The exact template + the for-join rule (§2.7)."""
    text = intention.strip()
    if text.lower().startswith("for "):
        text = text[4:].lstrip()
    return "This prayer is for " + text


def render(text: str, out_path: Path) -> None:
    """One TTS render in the locked voice; raises on failure."""
    r = subprocess.run(
        [TTS_CMD, "speak", "--output", str(out_path), "--voice", VOICE, "--text-stdin"],
        input=text, capture_output=True, text=True, timeout=300)
    if r.returncode != 0 or not out_path.exists() or out_path.stat().st_size == 0:
        raise RuntimeError(f"tts render failed ({r.returncode}): {(r.stderr or r.stdout)[:200]}")


def push_intro(episode_id: str, mp3_path: Path) -> dict:
    """POST /api/agent/prayer/intro — the standing intro family's
    push, raw MP3 with the segment push's header shape; the date
    header is the literal 'current' only (the route 400s dated)."""
    headers = door._headers({
        "Content-Type": "audio/mpeg",
        "X-Prayer-Date": "current",
        "X-Episode-Id": episode_id,
    })
    cmd = ["curl", "-s", "-X", "POST", *headers,
           "--data-binary", f"@{mp3_path}",
           f"{door.BASE}/api/agent/prayer/intro"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    try:
        return json.loads(r.stdout)
    except Exception:
        raise RuntimeError(f"intro push for {episode_id}: unparseable reply {r.stdout[:200]!r}")


def read_draw(date: str) -> dict:
    """item name -> drawn intention text, from the app module's day
    payload for the consumption date (door read; {} on failure —
    the caller names the shortfall)."""
    status, payload = door.call("GET", f"/api/agent/prayer/day?date={date}")
    if status != 200:
        return {}
    out = {}
    for block in payload.get("blocks", []):
        for dev in block.get("devotions", []):
            ints = dev.get("intentions") or []
            if ints and ints[0].get("text"):
                out[dev["name"]] = ints[0]["text"]
    return out


def read_composition_from_board(date: str) -> dict:
    """The Suite run's step-7b segment texts for the date, read from
    the board's prayer tasks: each block's open Activities
    occurrence carries its block's script as its notes (step 7e of
    the Suite sheet files them there verbatim). -> {Block: text}
    for the blocks whose script stands."""
    status, board = board_door.call("GET", "/api/board")
    if status != 200:
        return {}
    tasks = board.get("tasks", []) if isinstance(board, dict) else board
    out = {}
    for block in BLOCKS:
        cands = [t for t in tasks
                 if t.get("parent_id") is None
                 and str(t.get("title", "")).startswith(f"{block} Activities")
                 and t.get("status") not in ("Done", "Declined")
                 and (t.get("notes") or "").strip()]
        if cands:
            # The occurrence due for this date wins; else the open one.
            due = [t for t in cands if (t.get("due_date") or "")[:10] == date]
            pick = due[0] if due else cands[0]
            out[block] = pick["notes"]
    return out


def read_composition(date: str) -> dict:
    seam = os.environ.get("OPN_SEGMENTS_FILE")
    if seam:
        try:
            data = json.loads(Path(seam).read_text())
            return {b: data[b] for b in BLOCKS if (data.get(b) or "").strip()}
        except Exception:
            return {}
    return read_composition_from_board(date)


def presented_tracks(date: str):
    """-> (own_ids, slot_ids, titles): the consumption date's
    player_episodes rows with kind='episode' (read from the
    presented payload through the door) PLUS the enabled external
    slots from the settings payload (primaries; a fallback fill
    presents under its slot's id and inherits its pairing). titles
    maps every presented track to its display title (own tracks from
    the payload; slots from their settings names) for the report
    field's named failures."""
    own, titles = [], {}
    status, payload = door.call("GET", "/api/agent/player/day")
    if status == 200:
        for block in payload.get("blocks", []):
            for t in block.get("tracks", []):
                if t.get("kind") == "episode" and t.get("episodeId"):
                    own.append(t["episodeId"])
                    titles[t["episodeId"]] = t.get("title") or t["episodeId"]
        for t in payload.get("episodes", []):
            if t.get("kind") == "episode" and t.get("episodeId"):
                own.append(t["episodeId"])
                titles[t["episodeId"]] = t.get("title") or t["episodeId"]
    slots = []
    status, settings = door.call("GET", "/api/agent/player/settings")
    if status == 200:
        for s in settings.get("sources", []):
            if s.get("family") == "external" and s.get("enabled") == 1 \
                    and s.get("role") != "fallback" and s.get("slotId"):
                slots.append(s["slotId"])
                titles[s["slotId"]] = s.get("name") or s["slotId"]
    return own, slots, titles


# =====================================================================
# v342 §2.2/§2.6: THE PUBLISH LEG. The intentions feed is a ROLLING
# 7-DAY publication: intentions.xml (RSS 2.0) committed as
# docs/intentions.xml in the SAME publish repo as docs/podcast.xml
# (Jctebo/spotify_praylist), served at
# https://orapronobis.media/intentions.xml; the audio rides the
# same host under intentions/<date>/ in the PUBLIC audio bucket.
# PRIVACY (John, 2026-11-09 11:24 CT): the feed carries AUDIO ONLY
# — item descriptions hold no intention text; the drawn texts
# travel inside the app's signed-in day data (the shell's
# introTexts map). One publish step: audio PUTs first, then ONE
# Git Data API commit of docs/intentions.xml + the Pages deploy
# dispatch, then the out-of-window audio prune — any failure
# before the commit aborts the step NAMED (a feed never points at
# missing audio; audio without a feed is inert).
# Modes: --publish = ADDITIVE (push as today AND publish; the
# Step 0 precondition shape) · --publish-only = publish, no door
# pushes (the post-Ship shape). Harness seams (never set in
# production): OPN_PUB_CF_BASE / OPN_PUB_GH_BASE / OPN_PUB_SITE_BASE
# / OPN_PUB_AUDIO_BASE retarget the transports at a local stub and
# skip the credential surrogate for that transport;
# OPN_PUB_POLL_S sets the deploy poll spacing.
# =====================================================================
import base64
import urllib.error
import urllib.parse
import urllib.request
from xml.sax.saxutils import escape as _xml_escape

PUB_GH_REPO = "Jctebo/spotify_praylist"
PUB_CF_ACCOUNT = "19135db329e6018b318b33b72aa6e3f3"
PUB_CF_BUCKET = "orapronobis-audio"
PUB_CF_BASE = os.environ.get("OPN_PUB_CF_BASE", "https://api.cloudflare.com/client/v4")
PUB_GH_BASE = os.environ.get("OPN_PUB_GH_BASE", "https://api.github.com")
PUB_SITE_BASE = os.environ.get("OPN_PUB_SITE_BASE", "https://orapronobis.media")
PUB_AUDIO_BASE = os.environ.get("OPN_PUB_AUDIO_BASE", "https://audio.orapronobis.media")
PUB_POLL_S = int(os.environ.get("OPN_PUB_POLL_S", "15"))


class _PubNoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a):
        raise RuntimeError("redirect refused")


def _pub_cf_open(req, raw=False):
    if not os.environ.get("OPN_PUB_CF_BASE"):
        sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
        from dynamic_credentials import add_surrogate_to_request
        add_surrogate_to_request(req, "custom.cloudflare", allowed_hosts=["api.cloudflare.com"])
    opener = urllib.request.build_opener(_PubNoRedirect())
    try:
        with opener.open(req, timeout=180) as resp:
            body = resp.read()
            if raw:
                return body
            return json.loads(body.decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        body = e.read()
        if raw:
            raise RuntimeError(f"Cloudflare API HTTP {e.code}: {body[:300]!r}") from e
        try:
            return json.loads(body.decode("utf-8", "replace"))
        except Exception:
            return {"success": False, "status": e.code, "raw": body[:500]}


def _pub_r2_put(key: str, data: bytes, ctype: str) -> dict:
    url = f"{PUB_CF_BASE}/accounts/{PUB_CF_ACCOUNT}/r2/buckets/{PUB_CF_BUCKET}/objects/{urllib.parse.quote(key, safe='')}"
    req = urllib.request.Request(url, data=data, headers={"content-type": ctype}, method="PUT")
    return _pub_cf_open(req)


def _pub_r2_delete(key: str) -> dict:
    url = f"{PUB_CF_BASE}/accounts/{PUB_CF_ACCOUNT}/r2/buckets/{PUB_CF_BUCKET}/objects/{urllib.parse.quote(key, safe='')}"
    req = urllib.request.Request(url, method="DELETE")
    return _pub_cf_open(req)


def _pub_r2_list(prefix: str) -> list:
    out, cursor = [], None
    while True:
        url = (f"{PUB_CF_BASE}/accounts/{PUB_CF_ACCOUNT}/r2/buckets/{PUB_CF_BUCKET}/objects"
               f"?per_page=1000&prefix={urllib.parse.quote(prefix, safe='')}")
        if cursor:
            url += f"&cursor={urllib.parse.quote(cursor, safe='')}"
        r = _pub_cf_open(urllib.request.Request(url, method="GET"))
        # The R2 list response's result is the bare object array
        # itself; result_info (with the cursor) is its top-level
        # sibling — NOT a dict envelope holding "objects" (the
        # first live publish, 2026-11-09, died on that assumption
        # in this prune step, after its commit + deploy landed).
        for o in r.get("result") or []:
            out.append(o["key"])
        cursor = (r.get("result_info") or {}).get("cursor")
        if not cursor:
            return out


def _pub_gh_request(method: str, path: str, payload=None):
    url = f"{PUB_GH_BASE}{path}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"accept": "application/vnd.github+json", "content-type": "application/json"},
    )
    if not os.environ.get("OPN_PUB_GH_BASE"):
        sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
        from dynamic_credentials import add_surrogate_to_request, read_json_response
        add_surrogate_to_request(req, "custom.github", allowed_hosts=["api.github.com"])
    opener = urllib.request.build_opener(_PubNoRedirect())
    try:
        with opener.open(req, timeout=120) as resp:
            if resp.status == 204:
                return {"status": 204}
            return json.loads(resp.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"GitHub API {method} {path} -> HTTP {e.code}: {body[:400]}") from e


def _pub_duration_s(mp3_path: Path):
    """The rendered file's duration in whole seconds (ffprobe),
    or None when unmeasurable — the element is then omitted from
    the item rather than guessed (§2.2)."""
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(mp3_path)],
            capture_output=True, text=True, timeout=30)
        v = float((r.stdout or "").strip())
        return int(round(v)) if v > 0 else None
    except Exception:
        return None


def _pub_midnight_ct_rfc2822(date_iso: str) -> str:
    d = datetime.date.fromisoformat(date_iso)
    dt = datetime.datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=ZoneInfo("America/Chicago"))
    return dt.strftime("%a, %d %b %Y %H:%M:%S %z")


_PUB_ITEM_RE = re.compile(r"<item>.*?</item>", re.S)
_PUB_GUID_RE = re.compile(r"<guid[^>]*>([^<]+)</guid>")


def _pub_item_date(guid: str):
    m = re.search(r"-([0-9]{4}-[0-9]{2}-[0-9]{2})$", guid)
    return m.group(1) if m else None


def publish_intentions(date: str, intro_files: list, segment_files: list) -> dict:
    """One publish step for the consumption date. intro_files:
    [(episode_id, track_title, Path)] · segment_files: [(block,
    Path)]. Returns {intros: n, segments: n}. Raises RuntimeError
    named on any failure before the commit lands."""
    day = datetime.date.fromisoformat(date)
    window = {(day - datetime.timedelta(days=k)).isoformat() for k in range(7)}

    # (1) The live file's in-window items stand (except today's,
    # which this step regenerates whole). 404 = first publication.
    live_items = []
    try:
        req = urllib.request.Request(f"{PUB_SITE_BASE}/intentions.xml", method="GET")
        with urllib.request.build_opener(_PubNoRedirect()).open(req, timeout=60) as resp:
            live_xml = resp.read().decode("utf-8", "replace")
        for m in _PUB_ITEM_RE.finditer(live_xml):
            gm = _PUB_GUID_RE.search(m.group(0))
            if not gm:
                continue
            idate = _pub_item_date(gm.group(1).strip())
            if idate in window and idate != date:
                live_items.append((idate, m.group(0)))
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise RuntimeError(f"live intentions feed read failed: HTTP {e.code}") from e
    except Exception as exc:
        raise RuntimeError(f"live intentions feed read failed: {exc}") from exc

    # (2) Today's items + their audio PUTs (audio first — a feed
    # never points at missing audio).
    today_items = []
    for episode_id, title, f in intro_files:
        r = _pub_r2_put(f"intentions/{date}/intro-{episode_id}.mp3", f.read_bytes(), "audio/mpeg")
        if not r.get("success"):
            raise RuntimeError(f"R2 PUT intro {episode_id}: {r}")
        dur = _pub_duration_s(f)
        dur_el = f"<itunes:duration>{dur}</itunes:duration>" if dur else ""
        today_items.append(
            f"<item><title>{_xml_escape('Intention — ' + title)}</title>"
            f"<guid isPermaLink=\"false\">intentions-intro-{episode_id}-{date}</guid>"
            f"<pubDate>{_pub_midnight_ct_rfc2822(date)}</pubDate>"
            f"<description>Intention audio for {_xml_escape(title)}.</description>"
            f"<enclosure url=\"{PUB_AUDIO_BASE}/intentions/{date}/intro-{episode_id}.mp3\" "
            f"length=\"{f.stat().st_size}\" type=\"audio/mpeg\"/>{dur_el}</item>")
    for block, f in segment_files:
        r = _pub_r2_put(f"intentions/{date}/segment-{block}.mp3", f.read_bytes(), "audio/mpeg")
        if not r.get("success"):
            raise RuntimeError(f"R2 PUT segment {block}: {r}")
        dur = _pub_duration_s(f)
        dur_el = f"<itunes:duration>{dur}</itunes:duration>" if dur else ""
        today_items.append(
            f"<item><title>{_xml_escape('Intentions — ' + block)}</title>"
            f"<guid isPermaLink=\"false\">intentions-segment-{block}-{date}</guid>"
            f"<pubDate>{_pub_midnight_ct_rfc2822(date)}</pubDate>"
            f"<description>Intentions segment audio for the {_xml_escape(block)} block.</description>"
            f"<enclosure url=\"{PUB_AUDIO_BASE}/intentions/{date}/segment-{block}.mp3\" "
            f"length=\"{f.stat().st_size}\" type=\"audio/mpeg\"/>{dur_el}</item>")

    # (3) The regenerated file: newest day first, feed order kept
    # within a day; committed in ONE Git Data API commit.
    all_items = [(date, x) for x in today_items] + live_items
    all_items.sort(key=lambda t: t[0], reverse=True)
    items_xml = "".join(x for _, x in all_items)
    feed_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">\n'
        "<channel>\n<title>Ora Pro Nobis — Intentions</title>\n"
        f"<link>{PUB_SITE_BASE}/</link>\n"
        "<description>Daily intention audio for the Ora Pro Nobis prayer app. "
        "Intention texts are not published; this feed carries audio only.</description>\n"
        "<language>en-us</language>\n"
        f"{items_xml}\n</channel>\n</rss>\n")
    ref = _pub_gh_request("GET", f"/repos/{PUB_GH_REPO}/git/ref/heads/main")
    head_sha = ref["object"]["sha"]
    head_commit = _pub_gh_request("GET", f"/repos/{PUB_GH_REPO}/git/commits/{head_sha}")
    blob = _pub_gh_request(
        "POST", f"/repos/{PUB_GH_REPO}/git/blobs",
        {"content": base64.b64encode(feed_xml.encode("utf-8")).decode(), "encoding": "base64"})
    tree = _pub_gh_request(
        "POST", f"/repos/{PUB_GH_REPO}/git/trees",
        {"base_tree": head_commit["tree"]["sha"],
         "tree": [{"path": "docs/intentions.xml", "mode": "100644", "type": "blob", "sha": blob["sha"]}]})
    commit = _pub_gh_request(
        "POST", f"/repos/{PUB_GH_REPO}/git/commits",
        {"message": f"Publish Ora Pro Nobis intentions {date} (Muse-run runner)",
         "tree": tree["sha"], "parents": [head_sha]})
    _pub_gh_request("PATCH", f"/repos/{PUB_GH_REPO}/git/refs/heads/main",
                    {"sha": commit["sha"], "force": False})
    # The Pages deploy dispatch (pass2's pattern; a failed deploy
    # is named — the commit stands and the next publish re-points).
    _pub_gh_request("POST", f"/repos/{PUB_GH_REPO}/actions/workflows/deploy_pages.yml/dispatches", {"ref": "main"})
    deadline = time.time() + 900
    deployed = False
    while time.time() < deadline:
        time.sleep(PUB_POLL_S)
        runs = _pub_gh_request("GET", f"/repos/{PUB_GH_REPO}/actions/workflows/deploy_pages.yml/runs?per_page=5")
        cands = [r for r in runs.get("workflow_runs", []) if r.get("head_sha") == commit["sha"]]
        if not cands:
            continue
        run = cands[0]
        if run.get("status") == "completed":
            if run.get("conclusion") != "success":
                raise RuntimeError(f"intentions deploy finished with conclusion={run.get('conclusion')}")
            deployed = True
            break
    if not deployed:
        raise RuntimeError("intentions deploy did not complete within 15 minutes")

    # (4) Prune: out-of-window intentions/<date>/ audio, same step.
    for key in _pub_r2_list("intentions/"):
        parts = key.split("/")
        if len(parts) >= 2 and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", parts[1]) and parts[1] not in window:
            _pub_r2_delete(key)
    return {"intros": len(intro_files), "segments": len(segment_files)}


def feed_presented_tracks(date: str):
    """The post-push-model presented set (§2.6 era): when the
    player/day payload carries no own tracks (the v342 shell), the
    presented own episodes resolve from the live podcast feed —
    the same date discipline the client applies (pubDate's Chicago
    date AND the stem's date both equal the presented date) — and
    titles are the feed titles minus the date suffix. Returns
    own_ids, titles (slots still come from the settings payload)."""
    import email.utils
    import xml.etree.ElementTree as ET
    own, titles = [], {}
    try:
        req = urllib.request.Request(f"{PUB_SITE_BASE}/podcast.xml", method="GET")
        with urllib.request.build_opener(_PubNoRedirect()).open(req, timeout=60) as resp:
            root = ET.fromstring(resp.read())
    except Exception as exc:
        print(f"compose_app_audio: podcast feed read for presented set failed (named): {exc}")
        return own, titles
    ns = {"itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd"}
    for item in root.iter("item"):
        enc = item.find("enclosure")
        url = (enc.get("url") if enc is not None else "") or ""
        if not url:
            continue
        stem = url.split("?")[0].rstrip("/").split("/")[-1]
        stem = stem[:-4] if stem.endswith(".mp3") else stem
        m = re.search(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", stem)
        if not m or m.group(0) != date:
            continue
        pub = item.findtext("pubDate") or ""
        try:
            pub_dt = email.utils.parsedate_to_datetime(pub)
            pub_date = pub_dt.astimezone(ZoneInfo("America/Chicago")).date().isoformat()
        except Exception:
            continue
        if pub_date != date:
            continue
        # Canonical id from the stem (the client's rule).
        canon = None
        if stem.index(date) == 0:
            rest = stem[len(date) + 1:]
            at = rest.rfind("-day-")
            if at > 0:
                canon = "novena-" + rest[:at]
        else:
            base = stem[: -(len(date) + 1)] if stem.endswith("-" + date) else None
            canon = {"morning-prayer-elevenlabs": "morning-prayer",
                     "daily-rosary": "daily-rosary",
                     "marian-antiphon-angelus": "marian-antiphon-angelus",
                     "auxilium-christianorum": "auxilium-christianorum",
                     "daily-reflection": "daily-reflection"}.get(base or "")
        if not canon:
            continue
        title = (item.findtext("title") or canon).strip()
        tm = re.match(r"^(.*) - (?:January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{1,2}, [0-9]{4}$", title)
        if tm:
            title = tm.group(1)
        own.append(canon)
        titles[canon] = title
    return own, titles


def main() -> int:
    args = sys.argv[1:]
    date = None
    intros_only = False
    publish = False
    publish_only = False
    i = 0
    while i < len(args):
        if args[i] == "--date":
            date = args[i + 1]; i += 2
        elif args[i] == "--intros-only":
            # v338 §2.10(2): the segments dual-compose leg is
            # skipped and the report field prints the intros-only
            # shape (§2.10(4)). Default behavior (no flag) is the
            # as-built dual-compose — the standing sheet keeps
            # working until the Ship-time sheet switch lands.
            intros_only = True; i += 1
        elif args[i] == "--publish":
            # v342 §2.10 Step 0: ADDITIVE mode — push as today AND
            # publish the intentions feed in the same run.
            publish = True; i += 1
        elif args[i] == "--publish-only":
            # v342 §2.6: publish, no door pushes (the post-Ship
            # shape; the push retires at Ship, never before).
            publish = True; publish_only = True; i += 1
        else:
            raise SystemExit(f"unknown arg {args[i]!r} — usage: compose_app_audio.py [--date YYYY-MM-DD] [--intros-only] [--publish|--publish-only]")
    if date is None:
        date = datetime.datetime.now(ZoneInfo("America/Chicago")).date().isoformat()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        raise SystemExit(f"bad date {date!r}")

    tmp = Path(f"/tmp/compose-app-audio-{date}")
    tmp.mkdir(parents=True, exist_ok=True)

    missing = []          # named shortfalls for the field
    failed_intros = []    # track titles whose intro render/push failed
    pub_intro_files = []  # (episode_id, track title, file) rendered this run
    pub_segment_files = []  # (block, file) rendered this run
    seg_attempted = 0     # segment renders attempted (publish denominator)

    # ---- (1) the draw ------------------------------------------------
    draw = read_draw(date)

    # ---- (2) segments, dual-compose ----------------------------------
    # v338 §2.10(2): under --intros-only this leg is skipped whole —
    # no composition read, no segment renders, no segment pushes.
    segments_ok = 0
    if not intros_only:
        composition = {}
        for attempt in range(RETRY_ATTEMPTS):
            composition = read_composition(date)
            if len(composition) == len(BLOCKS):
                break
            if attempt < RETRY_ATTEMPTS - 1:
                time.sleep(RETRY_DELAY_S)
        if len(composition) < len(BLOCKS):
            missing.append(f"segments: composition missing for {date}")
        else:
            for block in BLOCKS:
                f = tmp / f"segment-{block}.mp3"
                seg_attempted += 1
                try:
                    render(composition[block], f)
                    pub_segment_files.append((block, f))
                    if publish_only:
                        segments_ok += 1
                        continue
                    status, res = door.push_audio("current", block, str(f))
                    if status != 200 or not res.get("ok"):
                        raise RuntimeError(f"push {status}: {res}")
                    segments_ok += 1
                except Exception as exc:  # named, never substituted
                    missing.append(f"segment {block}: {exc}")

    # ---- (3) intros ---------------------------------------------------
    own_ids, slot_ids, titles = presented_tracks(date)
    if publish and not own_ids:
        # The v342 shell payload carries no own tracks; the
        # presented own set resolves from the podcast feed (the
        # same date discipline the client applies).
        f_own, f_titles = feed_presented_tracks(date)
        if f_own:
            own_ids = f_own
            for k, v in f_titles.items():
                titles.setdefault(k, v)
    presented = list(dict.fromkeys(own_ids + slot_ids))
    # v368 §2.6.3: the store-only episode joins the presented set
    # by the named constant; its report title stands as the show
    # name. A night the item is not drawn reads the track
    # unpaired below — named in the report, never fatal.
    presented = list(dict.fromkeys(presented + APP_PRESENTED))
    titles["the-ai-signal"] = "The AI Signal"
    eligible, unpaired = [], 0
    for track in presented:
        item = pairing_for(track)
        if item is None or item not in draw:
            unpaired += 1
            continue
        eligible.append((track, item))
    intros_ok = 0
    retired_push_noted = False
    for track, item in eligible:
        f = tmp / f"intro-{track}.mp3"
        try:
            render(intro_text(draw[item]), f)
            pub_intro_files.append((track, titles.get(track, track), f))
            if publish_only:
                intros_ok += 1
                continue
            res = push_intro(track, f)
            if not res.get("ok"):
                if publish and res.get("error") == "unknown agent route":
                    # The v342 push family retired in production
                    # ahead of this release's Ship — the v343 ship
                    # (2026-11-09 16:18 CT) carried the v342 Worker
                    # live, and its agent door has no intro push
                    # route. In publish mode the feed is the intro's
                    # standing carrier: the rendered file already
                    # stands in pub_intro_files, and the Intentions
                    # feed field below judges the publish itself.
                    # Any OTHER push refusal stays a named failure.
                    if not retired_push_noted:
                        print("compose_app_audio: intro door push retired in production "
                              "(unknown agent route) — publish mode carries the intros by feed")
                        retired_push_noted = True
                    intros_ok += 1
                    continue
                raise RuntimeError(f"push: {res}")
            intros_ok += 1
        except Exception:
            failed_intros.append(titles.get(track, track))
    if failed_intros:
        missing.append("intros failed: " + ", ".join(failed_intros))
    # Stale clear: an intro no longer presented does not survive.
    # (Push-family bookkeeping — skipped whole in publish-only
    # mode; the feed's rolling window is its own retirement.)
    if not publish_only:
        try:
            status, cur = door.call("GET", "/api/agent/prayer/intros")
            if status == 200:
                keep = {t for t, _ in eligible}
                for row in cur.get("intros", []):
                    if row["episodeId"] not in keep:
                        door.call("DELETE", f"/api/agent/prayer/intro?episode_id={row['episodeId']}")
        except Exception as exc:
            print(f"compose_app_audio: stale-intro clear failed (named, non-fatal): {exc}")

    # ---- (4) the report fields ----------------------------------------
    print(f"compose_app_audio: presented {date} · paired tracks {len(eligible)} · unpaired {unpaired}")
    missing_txt = ", ".join(missing) if missing else "none"
    rc = 0
    if not publish_only:
        # The Segments field retires with the push at Ship; in
        # publish-only mode it does not print at all.
        if intros_only:
            # v338 §2.10(4): the field NAME stands; the shape is
            # intros-only (no segments clause).
            if missing:
                print(f"Segments (v337): MISSING — intros {intros_ok}/{len(eligible)} for presented {date} · "
                      f"missing: {missing_txt}")
                rc = 1
            else:
                print(f"Segments (v337): standing — intros {intros_ok}/{len(eligible)} for presented {date} · "
                      f"missing: none")
        elif missing:
            print(f"Segments (v337): MISSING — segments {segments_ok}/6 for presented {date} · "
                  f"intros {intros_ok}/{len(eligible)} for presented {date} · missing: {missing_txt}")
            rc = 1
        else:
            print(f"Segments (v337): standing — segments {segments_ok}/6 for presented {date} · "
                  f"intros {intros_ok}/{len(eligible)} for presented {date} · missing: none")
    if publish:
        # §2.6 ruling 7's field: the publish outcome — intros that
        # reached the feed over the eligible set; the segments
        # clause stands only on nights whose composed set includes
        # segments (dual-compose nights).
        pub_names = list(failed_intros)
        pub_intros = 0
        pub_segs = 0
        try:
            res = publish_intentions(date, pub_intro_files, pub_segment_files)
            pub_intros = res["intros"]
            pub_segs = res["segments"]
        except Exception as exc:
            pub_names.append(f"publish failed: {exc}")
        seg_clause = "" if intros_only else f" · segments {pub_segs}/{seg_attempted}"
        if pub_names:
            print(f"Intentions feed (v342): MISSING — intros {pub_intros}/{len(eligible)} for presented {date}"
                  f"{seg_clause} · missing: {', '.join(pub_names)}")
            rc = 1
        else:
            print(f"Intentions feed (v342): published — intros {pub_intros}/{len(eligible)} for presented {date}"
                  f"{seg_clause} · missing: none")
    return rc


if __name__ == "__main__":
    sys.exit(main())
