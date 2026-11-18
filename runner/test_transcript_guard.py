#!/usr/bin/env python3
"""Two-way fixture for the transcript guard (2026-11-18).

The guard must FAIL on the original 2026-11-18 Daily Rosary — the episode
whose first-intention TTS fragment hallucinated ~55 s of gibberish — and
PASS on a known-good recent episode (the 2026-11-19 Daily Rosary, whose
fragments all screened clean). Both legs drive the REAL guard against the
REAL published audio and scripts in the run dirs. ASR makes this slow
(~4 min per leg); it is a release fixture, not a unit test.

Run: ~/workspace/scratch-daybuild/nv-venv/bin/python runner/test_transcript_guard.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import FRAGCACHE_DEFAULT, normalized_tts_text, voice_full  # noqa: E402
from pass2_build import frag_cache_path  # noqa: E402
from transcript_guard import guard_episode  # noqa: E402

RUNS = Path.home() / "workspace" / "ora-runner-runs"
WORK = Path.home() / "workspace" / "ora-rosary-fix-2026-11-18" / "guard-test"


def episode_inputs(date_iso: str, episode_id: str):
    rundir = RUNS / date_iso
    plan = json.loads((rundir / "plan.json").read_text())
    ep = next(e for e in plan["episodes"] if e["episode_id"] == episode_id)
    data = json.loads((rundir / ep["segment_file"]).read_text())
    seg_texts, frags = [], []
    cache = Path(FRAGCACHE_DEFAULT)
    for s in data["segments"]:
        if "text" not in s:
            continue
        seg_texts.append(s["text"])
        voice = voice_full(s.get("voice", "MAI_03"))
        norm = normalized_tts_text(s["text"])
        frags.append((voice, norm, frag_cache_path(cache, voice, norm)))
    script = (rundir / "out" / f"{ep['file_base']}-script.txt").read_text()
    provided = json.loads((rundir / "texts-provided.json").read_text())
    seam = {k: v for k, v in (provided.get("blocks") or {}).items() if k.startswith(f"{ep['key']}/")}
    return {
        "episode_id": episode_id,
        "mp3": rundir / "out" / f"{episode_id}.mp3",
        "script_text": script,
        "segment_texts": seg_texts,
        "fragments": frags,
        "seam_texts": seam,
        "context": plan.get("context"),
    }


def main() -> int:
    WORK.mkdir(parents=True, exist_ok=True)

    print("LEG A — the bad 2026-11-18 rosary must FAIL ...", flush=True)
    bad = episode_inputs("2026-11-18", "daily-rosary-2026-11-18")
    # The poisoned fragment was evicted from the cache after diagnosis; its
    # decoded work wav stands in for the fragment-duration leg.
    bad_wav = RUNS / "2026-11-18" / "work" / "daily-rosary-10.wav"
    intention = next(t for t in bad["segment_texts"] if t.startswith("For the first Glorious Mystery"))
    bad["fragments"] = [
        (voice_full("MAI_03"), normalized_tts_text(intention), bad_wav)
    ] + [f for f in bad["fragments"] if f[1] != normalized_tts_text(intention)]
    verdict_a = guard_episode(**bad, workdir=WORK / "bad")
    print(json.dumps(verdict_a, indent=1)[:1500], flush=True)
    assert not verdict_a["passed"], "LEG A FAILED: the guard PASSED the known-bad rosary"
    joined = " ".join(verdict_a["problems"])
    assert "fragment" in joined or "span" in joined or "extra" in joined, (
        f"LEG A: expected a duration/span/extra-content problem, got: {joined[:400]}"
    )
    print("LEG A OK — guard fails the bad episode", flush=True)

    print("LEG B — the known-good 2026-11-19 rosary must PASS ...", flush=True)
    good = episode_inputs("2026-11-19", "daily-rosary-2026-11-19")
    verdict_b = guard_episode(**good, workdir=WORK / "good")
    print(json.dumps(verdict_b, indent=1)[:1200], flush=True)
    assert verdict_b["passed"], f"LEG B FAILED: guard held a known-good episode: {verdict_b['problems']}"
    print("LEG B OK — guard passes the good episode", flush=True)

    print("transcript guard fixture: ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
