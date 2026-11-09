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
}


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


def main() -> int:
    args = sys.argv[1:]
    date = None
    intros_only = False
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
        else:
            raise SystemExit(f"unknown arg {args[i]!r} — usage: compose_app_audio.py [--date YYYY-MM-DD] [--intros-only]")
    if date is None:
        date = datetime.datetime.now(ZoneInfo("America/Chicago")).date().isoformat()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        raise SystemExit(f"bad date {date!r}")

    tmp = Path(f"/tmp/compose-app-audio-{date}")
    tmp.mkdir(parents=True, exist_ok=True)

    missing = []          # named shortfalls for the field
    failed_intros = []    # track titles whose intro render/push failed

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
                try:
                    render(composition[block], f)
                    status, res = door.push_audio("current", block, str(f))
                    if status != 200 or not res.get("ok"):
                        raise RuntimeError(f"push {status}: {res}")
                    segments_ok += 1
                except Exception as exc:  # named, never substituted
                    missing.append(f"segment {block}: {exc}")

    # ---- (3) intros ---------------------------------------------------
    own_ids, slot_ids, titles = presented_tracks(date)
    presented = list(dict.fromkeys(own_ids + slot_ids))
    eligible, unpaired = [], 0
    for track in presented:
        item = pairing_for(track)
        if item is None or item not in draw:
            unpaired += 1
            continue
        eligible.append((track, item))
    intros_ok = 0
    for track, item in eligible:
        f = tmp / f"intro-{track}.mp3"
        try:
            render(intro_text(draw[item]), f)
            res = push_intro(track, f)
            if not res.get("ok"):
                raise RuntimeError(f"push: {res}")
            intros_ok += 1
        except Exception:
            failed_intros.append(titles.get(track, track))
    if failed_intros:
        missing.append("intros failed: " + ", ".join(failed_intros))
    # Stale clear: an intro no longer presented does not survive.
    try:
        status, cur = door.call("GET", "/api/agent/prayer/intros")
        if status == 200:
            keep = {t for t, _ in eligible}
            for row in cur.get("intros", []):
                if row["episodeId"] not in keep:
                    door.call("DELETE", f"/api/agent/prayer/intro?episode_id={row['episodeId']}")
    except Exception as exc:
        print(f"compose_app_audio: stale-intro clear failed (named, non-fatal): {exc}")

    # ---- (4) the report field -----------------------------------------
    print(f"compose_app_audio: presented {date} · paired tracks {len(eligible)} · unpaired {unpaired}")
    missing_txt = ", ".join(missing) if missing else "none"
    if intros_only:
        # v338 §2.10(4): the field NAME stands; the shape is
        # intros-only (no segments clause).
        if missing:
            print(f"Segments (v337): MISSING — intros {intros_ok}/{len(eligible)} for presented {date} · "
                  f"missing: {missing_txt}")
            return 1
        print(f"Segments (v337): standing — intros {intros_ok}/{len(eligible)} for presented {date} · "
              f"missing: none")
        return 0
    if missing:
        print(f"Segments (v337): MISSING — segments {segments_ok}/6 for presented {date} · "
              f"intros {intros_ok}/{len(eligible)} for presented {date} · missing: {missing_txt}")
        return 1
    print(f"Segments (v337): standing — segments {segments_ok}/6 for presented {date} · "
          f"intros {intros_ok}/{len(eligible)} for presented {date} · missing: none")
    return 0


if __name__ == "__main__":
    sys.exit(main())
