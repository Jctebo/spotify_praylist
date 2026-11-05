#!/usr/bin/env python3
"""Pass 1 — collect one day's Ora Pro Nobis episode plan, offline/deterministically.

Uses the repo's own builders:
  * publish episodes: jobs.publish.contracts.load_publish_contracts +
    jobs.publish.audio.build_audio_jobs (IDs / titles / descriptions come from
    the publish contracts with their deterministic offline fallbacks);
  * novenas: jobs.novena_contracts.resolver.resolve_active_novenas +
    jobs.novena_contracts.engine.render_novena;
  * rosary mystery set: whatever the rosary contract's weekday map produced
    inside build_audio_jobs for the target date (never assumed here);
  * lectionary: the repo offline lectionary (config/publish/offline);
  * liturgical context + music season: repo daily_liturgical_context and
    jobs.novena.liturgical_helpers.resolve_liturgical_music_season.

Model-seam blocks (the texts production took from a model) are NOT silently
filled with fallbacks: each becomes an entry in RUNDIR/texts-needed.json with
its deterministic fallback text (when one exists). Segment files are written
with the fallback text in place; runner/pass1b_merge.py replaces the seam
segments with RUNDIR/texts-provided.json content (or flags fallback use).

Outputs in RUNDIR:
  plan.json, texts-needed.json, texts/<episode>.json, novenas/<contract>.json,
  script-<episode>.txt (spoken script per episode, fallback state).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import FORK, add_repo_paths, ensure_repo_python

ensure_repo_python()
add_repo_paths()

GENERIC_PETITION_FALLBACK = (
    "Lord, we bring before You the intention of this novena, and we ask You to hear us, "
    "through the intercession of Your saints. Amen."
)

# Fragment kinds whose text production took from a model (the stub-bridge seam).
SEAM_KINDS = {
    "daily-intro",
    "prayer-intro",
    "liturgical-announcement",
    "rosary-intro",
    "rosary-overall-intention",
    "rosary-intention",
    "rosary-reflection",
}
SEAM_PURPOSE = {
    "daily-intro": "Daily intro text for Morning Prayer (date, liturgical day, saint witness weave-in).",
    "prayer-intro": "Short prayer intro (saint-of-the-day weave-in) before the fixed prayer text.",
    "liturgical-announcement": "Liturgical announcement: date, weekday, and the day's celebration.",
    "rosary-intro": "Rosary intro: date, mystery set, and saint witness weave-in.",
    "rosary-overall-intention": "Rosary overall intention for the whole rosary.",
    "rosary-intention": "Per-decade rosary intention (spoken before the 750 ms intention pause).",
    "rosary-reflection": "Per-decade rosary reflection (spoken after the 750 ms intention pause).",
}

ENTRY_KEY = {
    "morning-prayer-elevenlabs": "morning-prayer",
    "rosary": "daily-rosary",
    "marian-antiphon-angelus": "marian-antiphon-angelus",
    "marian-antiphon-regina-caeli": "marian-antiphon-regina-caeli",
    "auxilium-christianorum": "auxilium-christianorum",
    "daily-reflection": "daily-reflection",
}
EPISODE_ORDER = [
    "morning-prayer",
    "daily-rosary",
    "marian-antiphon-angelus",
    "marian-antiphon-regina-caeli",
    "auxilium-christianorum",
    "daily-reflection",
]


def _voice_for_role(role) -> str:
    return "MAI_01" if str(role or "").strip() in ("versicle", "response") else "MAI_03"


def _write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=1, ensure_ascii=False))


def collect(target: dt.date, outdir: Path) -> dict:
    import logging

    logging.basicConfig(level=logging.WARNING, format="%(message)s")

    from jobs.novena.liturgical_helpers import resolve_liturgical_music_season
    from jobs.novena_contracts import pipeline as novena_pipeline
    from jobs.novena_contracts.engine import render_novena, runtime_context
    from jobs.novena_contracts.resolver import resolve_active_novenas
    from jobs.publish.audio import build_audio_jobs
    from jobs.publish.audio_branding import load_audio_branding_config
    from jobs.publish.contracts import DEFAULT_CONTRACT_DIR, load_publish_contracts
    from jobs.publish.daily_liturgical_context import build_daily_liturgical_context
    from jobs.publish.offline_lectionary import resolve_offline_gospel

    date_iso = target.isoformat()
    branding = load_audio_branding_config()
    welcome_text = str(branding.get("welcome", {}).get("text", "")).strip() or (
        "Welcome to Ora Pro Nobis. Where we pray with the saints."
    )
    calendar = str(branding.get("calendar", "general_roman"))
    locale = str(branding.get("locale", "en"))
    season = resolve_liturgical_music_season(calendar, locale, target)
    music_asset = str(branding.get("seasons", {}).get(season, ""))

    ctx = build_daily_liturgical_context(target, calendar=calendar, locale=locale)
    ctxd = ctx.to_dict()
    gospel = resolve_offline_gospel(target, calendar=calendar, locale=locale)
    from jobs.publish.saint_witness_ladder import resolve_witness

    # Saint ladder (John, approved 2026-11-05): calendar saint -> Blessed
    # Virgin Mary on Saturdays -> Roman Martyrology lead (1962 calendar
    # paired) -> none (Gospel only).
    witness = resolve_witness(target, calendar_saint=str(ctxd.get("saintWitness", "")).strip())
    lect = json.loads((FORK / "config/publish/offline/lectionary.json").read_text())
    lect_entry = (lect.get("entries") or {}).get(date_iso, {})
    readings = lect_entry.get("readings") or {}

    shared_context = {
        "date": date_iso,
        "weekday": target.strftime("%A"),
        "liturgical_season": ctxd.get("liturgicalSeason", ""),
        "feast_day": ctxd.get("feastDay", ""),
        "saint_of_day": ctxd.get("saintOfDay", ""),
        "saint_witness": ctxd.get("saintWitness", ""),
        "witness_name": witness["witness_name"],
        "witness_source": witness["witness_source"],
        "martyrology_lead": witness["martyrology_lead"],
        "martyrology_text": witness["martyrology_text"],
        "calendar_1962": witness["calendar_1962"],
        "saintWitnessQuote": witness["saintWitnessQuote"],
        "saintWitnessQuoteSource": witness["saintWitnessQuoteSource"],
        "saintWitnessQuoteSourceUrl": witness["saintWitnessQuoteSourceUrl"],
        "shared_theme_title": ctxd.get("sharedThemeTitle", ""),
        "gospel_citation": gospel.citation,
        "gospel_text": gospel.text,
        "first_reading": readings.get("firstReading", ""),
        "psalm": readings.get("psalm", ""),
        "music_season": season,
        "music_asset": music_asset,
    }

    blocks: list[dict] = []
    episodes: list[dict] = []
    flags: list[str] = []

    def register_block(block_id, episode_key, purpose, fallback, segment_file, indices, splice, extra_ctx):
        blocks.append(
            {
                "id": block_id,
                "episode": episode_key,
                "purpose": purpose,
                "context": {**shared_context, **extra_ctx},
                "fallback": fallback,
                "segment_file": segment_file,
                "segment_indices": indices,
                "splice": bool(splice),
            }
        )

    # ---------------- publish episodes ----------------
    contracts = load_publish_contracts(DEFAULT_CONTRACT_DIR)
    jobs = build_audio_jobs(contracts, target_date=target)
    jobs.sort(key=lambda j: EPISODE_ORDER.index(ENTRY_KEY.get(j.get("entry_id", ""), j.get("entry_id", "")))
              if ENTRY_KEY.get(j.get("entry_id", "")) in EPISODE_ORDER else 99)
    for job in jobs:
        entry_id = str(job.get("entry_id", "")).strip()
        key = ENTRY_KEY.get(entry_id, entry_id)
        episode_id = str(job.get("episode_id", "")).strip()
        title = str(job.get("title", "")).strip()
        description = str(job.get("description", "")).strip()
        gap_ms = int((job.get("audio_config") or {}).get("silence_ms") or 350)
        file_base = f"{key}-{date_iso}-full"
        seg_rel = f"texts/{key}.json"

        segments: list[dict] = [{"text": welcome_text, "voice": "MAI_03"}]
        reflection_indices: list[int] = []
        reflection_texts: list[str] = []
        decade = 0
        last_announcement = ""
        for frag in job.get("audio_fragments") or []:
            kind = str(frag.get("kind", "")).strip()
            text = str(frag.get("text", "") or "").strip()
            if kind == "pause":
                segments.append({"pause_ms": int(frag.get("duration_ms") or 0)})
                continue
            if not text:
                continue
            voice = _voice_for_role(frag.get("audio_role"))
            if kind == "rosary-announcement":
                decade += 1
                last_announcement = text
                segments.append({"text": text, "voice": voice})
                continue
            if kind == "ignatian-reflection":
                reflection_indices.append(len(segments))
                reflection_texts.append(text)
                segments.append({"text": text, "voice": voice})
                continue
            if kind in SEAM_KINDS:
                block_id = f"{key}/{kind}"
                extra = {"episode_title": title}
                if key == "daily-rosary" and kind in ("rosary-intention", "rosary-reflection"):
                    block_id = f"{key}/decade-{decade}-{kind.split('-', 1)[1]}"
                    extra["decade"] = decade
                    extra["mystery_announcement"] = last_announcement
                register_block(block_id, key, SEAM_PURPOSE[kind], text, seg_rel, [len(segments)], False, extra)
                segments.append({"text": text, "voice": voice})
                continue
            segments.append({"text": text, "voice": voice})
        if key == "daily-reflection" and reflection_indices:
            register_block(
                "daily-reflection/body",
                key,
                "Daily Reflection body (Ignatian reflection; EVERY day it joins two threads: a "
                "reflection on the day's Gospel (context gospel_citation / gospel_text, from the "
                "day's Mass readings) AND the day's saint witness (context witness_name / "
                "witness_source). Saint ladder (John, approved 2026-11-05): witness_source "
                "'calendar' = the current calendar's saint; 'saturday' = the Blessed Virgin Mary "
                "(no calendar saint, and Saturday is dedicated to her); 'backup' = the Roman "
                "Martyrology's lead commemoration for the date (context martyrology_lead / "
                "martyrology_text), paired with the 1962 calendar observance (context "
                "calendar_1962); 'none' = no saint anywhere. WORDING: for 'calendar' and "
                "'saturday', the saint is carried by a 'The Church celebrates ...' sentence and "
                "there is NO 'Today's saint is ...' sentence; for 'backup', include BOTH "
                "sentences in these forms: 'Today's saint is [witness_name].' and 'This saint "
                "was chosen based on the Roman Martyrology and the traditional calendar of "
                "1962, which this podcast keeps as a private devotion.'; for 'none', no saint "
                "is named and the Gospel alone carries the reflection. Paragraphs are separated "
                "by blank lines and by 15000 ms pauses).",
                "\n\n".join(reflection_texts),
                seg_rel,
                reflection_indices,
                True,
                {"episode_title": title},
            )
        if "praying with  and" in description:
            # Safety net for the saint ladder (John, approved 2026-11-05):
            # the render site (jobs/publish/contracts.py) resolves the slot
            # by the ladder (calendar / Our Lady on Saturdays / Martyrology
            # lead on backup days); if an empty slot ever reaches the runner
            # anyway, the day is rung 4 — fill it from the day's Gospel here.
            # An empty slot never ships.
            gospel_citation = str(shared_context.get("gospel_citation", "")).strip()
            gospel_clause = (
                f"praying with the day's Gospel, {gospel_citation}"
                if gospel_citation
                else "praying with the day's Gospel"
            )
            description = description.replace(
                "praying with  and the saint's approved saying", gospel_clause
            )
            flags.append(
                f"{episode_id}: repo description had an empty saint slot; rewritten to the "
                "day's Gospel focus (saint ladder rung 4, John 2026-11-05)."
            )
        _write_json(outdir / seg_rel, {"episode": key, "file_base": file_base, "gap_ms": gap_ms, "segments": segments})
        spoken = [s["text"] for s in segments if "text" in s]
        (outdir / f"script-{key}.txt").write_text("\n\n".join(spoken) + "\n")
        episodes.append(
            {
                "kind": "publish",
                "key": key,
                "episode_id": episode_id,
                "entry_id": entry_id,
                "contract_id": str(job.get("contract_id", "")).strip(),
                "title": title,
                "description": description,
                "published_date": date_iso,
                "file_base": file_base,
                "segment_file": seg_rel,
                "gap_ms": gap_ms,
                "segments_count": len(segments),
                "spoken_chars": sum(len(t) for t in spoken),
            }
        )

    # ---------------- novenas ----------------
    for runtime in resolve_active_novenas(target):
        cid = runtime.contract_id
        day = runtime.active_day
        saint = str(runtime.saint.get("name", "")).strip()
        episode_id = f"{date_iso}-{cid}-day-{day}"
        key = f"novena-{cid}"
        file_base = f"novena-{cid}-{date_iso}-full"
        seg_rel = f"novenas/{cid}.json"

        captures: list[dict] = []

        def gen_text(prompt, context, _captures=captures, _cid=cid):
            token = f"__MUSE_PETITION__{_cid}__"
            _captures.append(
                {"prompt": str(prompt), "saint_name": str(context.get("saint_name", "")), "token": token}
            )
            return token

        rendered = render_novena(runtime, generate_text_fn=gen_text)
        rctx = runtime_context(runtime)
        try:
            ntitle = novena_pipeline._render_title(runtime, rctx)
            ndesc = novena_pipeline._render_description(runtime, rctx)
        except Exception:
            pattern = str(runtime.publishing.get("rss", {}).get("episode_title_pattern", ""))
            kind_label = "Traditional" if "Traditional" in pattern else "Short-Form"
            ntitle = f"{kind_label} Novena to {saint} Day {day} - {target.strftime('%B ')}{target.day}, {target.year}"
            ndesc = f"Day {day} of the Novena to {saint} for {saint}."

        segments = []
        token_to_block: dict[str, str] = {}
        for frag in rendered.get("audio_fragments") or []:
            kind = str(frag.get("kind", "")).strip()
            if kind == "audio_cue":
                segments.append({"bell": True})
                continue
            if kind == "pause":
                segments.append({"pause_ms": int(frag.get("duration_ms") or 5000)})
                continue
            text = str(frag.get("text", "") or "").strip()
            if not text:
                continue
            segments.append({"text": text})
        # Intro = first text segment (engine places the devotional intro first).
        intro_idx = next(i for i, s in enumerate(segments) if "text" in s)
        register_block(
            f"{key}/intro",
            key,
            f"Novena intro for day {day} of the novena to {saint} "
            "('Welcome to Day N of the Novena to ...' in the hand-run style).",
            segments[intro_idx]["text"],
            seg_rel,
            [intro_idx],
            False,
            {"saint": saint, "contract_id": cid, "day": day, "feast_date": runtime.feast.get("feast_date", "")},
        )
        for cap in captures:
            idx = next(
                (i for i, s in enumerate(segments) if s.get("text") == cap["token"]),
                None,
            )
            if idx is None:
                continue
            segments[idx]["text"] = GENERIC_PETITION_FALLBACK
            register_block(
                f"{key}/petition",
                key,
                "Generated novena petition (short-form contracts take this text from the model).",
                GENERIC_PETITION_FALLBACK,
                seg_rel,
                [idx],
                False,
                {"saint": saint, "contract_id": cid, "day": day, "engine_prompt": cap["prompt"]},
            )
        _write_json(
            outdir / seg_rel,
            {
                "contract_id": cid,
                "day": day,
                "saint": saint,
                "feast_date": runtime.feast.get("feast_date", ""),
                "episode_id": episode_id,
                "title": ntitle,
                "description": ndesc,
                "segments": segments,
            },
        )
        spoken = [s["text"] for s in segments if "text" in s]
        (outdir / f"script-{key}.txt").write_text("\n\n".join(spoken) + "\n")
        episodes.append(
            {
                "kind": "novena",
                "key": key,
                "episode_id": episode_id,
                "entry_id": episode_id,
                "contract_id": cid,
                "title": ntitle,
                "description": ndesc,
                "published_date": date_iso,
                "file_base": file_base,
                "segment_file": seg_rel,
                "gap_ms": 350,
                "novena_day": day,
                "saint": saint,
                "segments_count": len(segments),
                "spoken_chars": sum(len(t) for t in spoken),
            }
        )

    if witness["witness_source"] == "saturday":
        flags.append(
            "SAINT LADDER (John, approved 2026-11-05): the current calendar names no saint "
            "for this date and the date is a Saturday, so the Daily Reflection witness is "
            "the Blessed Virgin Mary (context witness_name / witness_source = 'saturday'; "
            "Saturday is dedicated to her — an in-day source, no backup needed). WORDING: "
            "the witness is carried by a 'The Church celebrates ...' sentence; do NOT add a "
            "'Today's saint is ...' sentence. The reflection joins the day's Gospel "
            "(context gospel_citation / gospel_text) with Our Lady, as it joins the Gospel "
            "with the witness every day."
        )
    elif witness["witness_source"] == "backup":
        flags.append(
            "SAINT LADDER (John, approved 2026-11-05): the current calendar names no saint "
            f"for this date, so the witness comes from the BACKUP SOURCES: {witness['martyrology_lead']} "
            "(context witness_name / witness_source = 'backup'), the Roman Martyrology's lead "
            f"commemoration for the date, paired with the 1962 calendar observance "
            f"\"{witness['calendar_1962']}\". WORDING: include BOTH sentences in these forms: "
            f"\"Today's saint is {witness['martyrology_lead']}.\" and \"This saint was chosen "
            "based on the Roman Martyrology and the traditional calendar of 1962, which "
            "this podcast keeps as a private devotion.\" The Martyrology eulogy is in "
            "context martyrology_text and in the saintWitnessQuote fields as the sourced "
            "quote. The reflection joins the day's Gospel (context gospel_citation / "
            "gospel_text) with the witness, as it does every day. Do NOT substitute any "
            "other saint (no novena-completion pick)."
        )
    elif witness["witness_source"] == "none":
        flags.append(
            "SAINT LADDER (John, approved 2026-11-05): the current calendar names no saint "
            "for this date and the backup sources (Roman Martyrology / 1962 calendar) name "
            "none either (context witness_source = 'none'). No saint is named in any text; "
            "the Daily Reflection is Gospel only (context gospel_citation / gospel_text, "
            "from the offline lectionary)."
        )
    plan = {
        "date": date_iso,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "welcome_text": welcome_text,
        "context": shared_context,
        "episodes": episodes,
        "totals_estimate": {
            "episodes": len(episodes),
            "publish_episodes": sum(1 for e in episodes if e["kind"] == "publish"),
            "novena_episodes": sum(1 for e in episodes if e["kind"] == "novena"),
            "spoken_chars": sum(e["spoken_chars"] for e in episodes),
        },
        "flags": flags,
    }
    _write_json(outdir / "plan.json", plan)
    _write_json(outdir / "texts-needed.json", {"date": date_iso, "blocks": blocks})
    return plan


def main() -> int:
    parser = argparse.ArgumentParser(description="Pass 1: collect the day's episode plan (offline, deterministic).")
    parser.add_argument("--date", required=True, help="Target date YYYY-MM-DD")
    parser.add_argument("--out", required=True, help="Run directory (RUNDIR)")
    args = parser.parse_args()
    target = dt.date.fromisoformat(args.date)
    outdir = Path(args.out)
    outdir.mkdir(parents=True, exist_ok=True)
    plan = collect(target, outdir)
    totals = plan["totals_estimate"]
    print(
        f"pass1 date={plan['date']} episodes={totals['episodes']} "
        f"(publish={totals['publish_episodes']} novenas={totals['novena_episodes']}) "
        f"spoken_chars_est={totals['spoken_chars']} blocks={(len(json.loads((outdir / 'texts-needed.json').read_text())['blocks']))} "
        f"out={outdir}"
    )
    for e in plan["episodes"]:
        print(f"  {e['episode_id']} | {e['title']}")
    for f in plan["flags"]:
        print(f"  FLAG: {f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
