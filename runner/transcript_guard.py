#!/usr/bin/env python3
"""Transcript guard (2026-11-18, John's order after the Nov 18 rosary defect).

WHY: the 2026-11-18 Daily Rosary aired ~55 s of hallucinated speech inside
its first-intention fragment. The avocado_v2:MAI_03 render of that fragment
ran 76.6 s for a 266-char text (expected ~19 s): the TTS model spoke the
intended sentence and then invented five more "mysteries" of gibberish
("twenches the twenches", "casting the peasant as Savior in parable
manner"). The pipeline's only render check verified the TTS JSON's ok/voice
fields, and the published "transcript" was the clean script, so the
divergence between script and audio was invisible and shipped.

This guard is the publish gate John ordered: no episode publishes unless
its AUDIO matches its SCRIPT. Checks, cheapest first:

1. FRAGMENT DURATION SCREEN — every rendered fragment's duration against
   the expectation from its normalized char count (calibrated ~14
   chars/s for the locked voice). A hallucinated render runs long; the
   poisoned fragment scored ratio 4.0. Bounds [0.62, 1.50].
2. SCRIPT-SIDE SCREEN of the agent-authored seam texts (the texts the
   production agent writes at the pass-1/pass-2 seam):
   - repeated 4-gram runs (the gibberish signature), and
   - corpus non-word rate: lowercase tokens absent from the vocabulary
     of every script this runner has ever produced (proper nouns are
     capitalized and excluded). Catches generation-side gibberish.
   - MULTI-MEMORIAL OBSERVANCE CHECK (John's rule, same call): when the
     plan context carries both a feast_day and a distinct saint_of_day,
     the rosary intro + overall intention must name BOTH observances.
3. ASR VERIFICATION — the rendered episode is transcribed locally
   (faster-whisper, base model, the transcribe_recordings chunk helper)
   and compared against the script:
   - global MULTISET coverage/extra ratios (word counts, order-free):
     repetitive prayer text collapses sequence alignment — 53 Hail Marys
     misalign under difflib and false-fail — while counts stay sound.
     Known-good corrected rosary measures coverage 0.885 / extra 0.015;
     thresholds are 0.80 / 0.08.
   - INTERVAL span check between the episode's UNIQUE segments (seam
     texts, announcements, the Creed — texts occurring once): each is
     located in order in the ASR stream (exact opening anchor, with a
     rarest-token coverage fallback for openings ASR ate at a chunk
     boundary), and every interval between consecutive anchors must
     carry roughly the script's token count for that stretch (ratio
     within [0.60, 1.45]). Extra speech inserted inside a segment —
     exactly the Nov 18 failure, ~110 garbage tokens inside the first
     intention's interval — blows its interval ratio (~3.7) even though
     the global ratios dilute it; ASR chunk-boundary noise averages out
     over the 100+ token intervals.

A failure HOLDS the episode: pass2 marks it FAILED_GUARD, the day is not
fully built, and publish aborts (partial days never publish). The failure
is written into report.json/report.md flags and a guard-<episode_id>.json
file in the rundir — loud, never silent.

NOT covered, stated plainly: semantic nonsense written INTO a script by
the generating agent passes the audio checks (the audio faithfully speaks
the script). The seam screens (2) catch its mechanical signatures —
repetition and non-words — and the multi-memorial check enforces the
observance rule, but no ASR comparison can judge meaning. The nightly
closing review still reads the day's texts.

ASR runs through a dedicated venv (~/workspace/ora-runner-cache/asr-venv)
so the runner venv stays lean. If the venv or model is unavailable the
guard returns "unavailable" and pass2 treats it as a FAILURE — a check
that did not run is not a pass. ORA_GUARD_SKIP=1 exists for manual test
builds only; the nightly cron never sets it.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from collections import Counter

from pathlib import Path

CHARS_PER_SEC = 14.0
FRAG_RATIO_MIN, FRAG_RATIO_MAX = 0.62, 1.50
GLOBAL_COVERAGE_MIN = 0.80
EXTRA_RATIO_MAX = 0.08
SEGMENT_SPAN_RATIO_MAX = 1.45
INTERVAL_RATIO_MIN = 0.60
SEGMENT_WINDOW_COVERAGE_MIN = 0.60
NONWORD_RATE_MAX = 0.06

ASR_VENV_PYTHON = Path.home() / "workspace" / "ora-runner-cache" / "asr-venv" / "bin" / "python"
TRANSCRIBE_HELPER = Path("/opt/muse/assets/audio/transcribe_chunks.py")
RUNS_ROOT = Path.home() / "workspace" / "ora-runner-runs"

_TOKEN_RE = re.compile(r"[a-z0-9']+")


def tokens(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower().replace("\u2019", "'"))


def _ngrams(toks: list[str], n: int) -> Counter:
    return Counter(tuple(toks[i : i + n]) for i in range(len(toks) - n + 1))


def _ffprobe_duration(path: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(r.stdout.strip())


# ---------------------------------------------------------------- screens --
def fragment_duration_screen(fragments) -> list[str]:
    """fragments: iterable of (voice, normalized_text, cache_path)."""
    problems = []
    for _voice, normalized, path in fragments:
        if len(normalized) < 40 or not Path(path).exists():
            continue
        try:
            dur = _ffprobe_duration(Path(path))
        except Exception as exc:  # noqa: BLE001 - named, not silent
            problems.append(f"fragment probe failed ({Path(path).name}): {exc}")
            continue
        expected = len(normalized) / CHARS_PER_SEC
        ratio = dur / expected if expected else 0.0
        if ratio < FRAG_RATIO_MIN or ratio > FRAG_RATIO_MAX:
            problems.append(
                f"fragment duration ratio {ratio:.2f} (actual {dur:.1f}s vs expected "
                f"{expected:.1f}s for {len(normalized)} chars): {normalized[:70]!r}"
            )
    return problems


_CORPUS_VOCAB: set[str] | None = None


def _corpus_vocab() -> set[str]:
    global _CORPUS_VOCAB
    if _CORPUS_VOCAB is not None:
        return _CORPUS_VOCAB
    vocab: set[str] = set()
    if RUNS_ROOT.exists():
        for script in RUNS_ROOT.glob("*/out/*-script.txt"):
            try:
                vocab.update(tokens(script.read_text(encoding="utf-8", errors="replace")))
            except OSError:
                continue
    _CORPUS_VOCAB = vocab
    return vocab


_OBS_STOPWORDS = {
    "the", "of", "saint", "saints", "st", "dedication", "basilicas", "basilica",
    "virgin", "martyr", "martyrs", "apostle", "apostles", "pope", "bishop",
    "abbot", "priest", "companions", "memorial", "feast", "solemnity",
}


def _observance_like(name: str) -> bool:
    """Mirror of pass1_collect._observance_like: ferial descriptors like
    'Weekday Gospel' are not observances and never have to be named."""
    low = (name or "").lower()
    if "dedication of" in low[:22]:
        return True
    if "blessed virgin mary" in low or "our lady" in low:
        return True
    return bool(re.search(r"\bsaints?\b", low)) or name.startswith(("Blessed ", "St. ", "Sts. "))


def _observance_tokens(name: str) -> list[str]:
    words = re.findall(r"[A-Z][a-zA-Z\u00C0-\u024F'\-]+", name or "")
    return [w for w in words if w.lower().strip("'-") not in _OBS_STOPWORDS]


def script_screen(seam_texts: dict[str, str], context: dict | None) -> list[str]:
    """Generation-side screens over the agent-authored seam texts."""
    problems = []
    vocab = _corpus_vocab()
    for label, text in (seam_texts or {}).items():
        toks = tokens(text)
        if len(toks) >= 8:
            rep = [g for g, c in _ngrams(toks, 4).items() if c >= 3]
            if rep:
                problems.append(f"{label}: repeated 4-gram runs in script text: {' '.join(rep[0])!r} x{_ngrams(toks, 4)[rep[0]]}")
        raw_words = re.findall(r"[A-Za-z']+", text)
        lower_toks = [w.lower() for w in raw_words if w.islower() or (w.isalpha() and w[:1].islower())]
        if len(lower_toks) >= 12 and vocab:
            unknown = [w for w in lower_toks if w not in vocab]
            rate = len(unknown) / len(lower_toks)
            if rate > NONWORD_RATE_MAX:
                problems.append(
                    f"{label}: corpus non-word rate {rate:.2f} ({len(unknown)}/{len(lower_toks)}), "
                    f"e.g. {sorted(set(unknown))[:6]}"
                )
    # Multi-memorial observance check (John's rule): a day carrying more
    # than one observance must name ALL of them in the rosary's intro +
    # overall intention. The pipeline's context observances list (pass1,
    # 2026-11-18) is authoritative when present; the feast_day /
    # saint_of_day pair is the fallback for older plans.
    if context:
        obs_list = [str(o).strip() for o in (context.get("observances") or []) if str(o).strip()]
        if len(obs_list) < 2:
            feast = (context.get("feast_day") or "").strip()
            saint = (context.get("saint_of_day") or "").strip()
            obs_list = ([feast, saint] if feast and saint and feast.lower() != saint.lower()
                        and _observance_like(feast) else [])
        if len(obs_list) >= 2:
            hay = " ".join(
                v for k, v in (seam_texts or {}).items()
                if k.endswith("rosary-intro") or k.endswith("rosary-overall-intention")
            )
            if hay:
                for obs_name in obs_list:
                    need = _observance_tokens(obs_name)
                    if need and not all(t.lower() in hay.lower() for t in need):
                        problems.append(
                            f"multi-memorial: observance {obs_name!r} not fully named in the "
                            f"rosary intro/overall intention (missing {[t for t in need if t.lower() not in hay.lower()]})"
                        )
    return problems


# -------------------------------------------------------------------- ASR --
def _asr_model() -> str:
    """The cached faster-whisper-base snapshot dir (the model the
    transcribe_recordings tooling already uses on this machine)."""
    snaps = sorted(Path.home().glob(
        ".cache/huggingface/hub/models--Systran--faster-whisper-base/snapshots/*"))
    return str(snaps[0]) if snaps else "Systran/faster-whisper-base"


def transcribe_episode(mp3: Path, workdir: Path) -> str:
    if not ASR_VENV_PYTHON.exists():
        raise RuntimeError(f"ASR venv missing at {ASR_VENV_PYTHON}")
    if not TRANSCRIBE_HELPER.exists():
        raise RuntimeError(f"transcribe helper missing at {TRANSCRIBE_HELPER}")
    outdir = workdir / "asr"
    env = dict(os.environ, HF_HUB_OFFLINE="1")
    r = subprocess.run(
        [str(ASR_VENV_PYTHON), str(TRANSCRIBE_HELPER),
         "--input", str(mp3), "--model", _asr_model(),
         "--output-dir", str(outdir), "--language", "en", "--chunk-seconds", "60"],
        capture_output=True, text=True, env=env, timeout=3600,
    )
    if r.returncode != 0:
        raise RuntimeError(f"ASR failed rc={r.returncode}: {r.stderr.strip()[-400:]}")
    txt = outdir / "transcript.txt"
    if not txt.exists():
        raise RuntimeError("ASR produced no transcript.txt")
    raw = txt.read_text(encoding="utf-8", errors="replace")
    # The chunk helper prefixes each chunk with "[start - end]" timestamps;
    # strip them so digits do not pollute the token stream.
    return re.sub(r"\[\d+\.\d+ - \d+\.\d+\]\s*", " ", raw)


def _find_anchor(a_toks: list[str], anchor: list[str], start: int, window: int = 3000) -> int:
    """First index >= start where the anchor token run occurs, else -1."""
    if not anchor:
        return -1
    limit = min(len(a_toks) - len(anchor), start + window)
    for i in range(start, limit + 1):
        if a_toks[i : i + len(anchor)] == anchor:
            return i
    return -1


def _find_segment_soft(a_toks: list[str], stoks: list[str], start: int) -> int:
    """Fallback locator for a unique segment whose opening words ASR ate
    or mangled (chunk boundaries do this): anchor on the segment's rarest
    long token, then accept the occurrence whose surrounding window
    covers >= 55% of the segment's tokens. Returns the estimated segment
    start index, or -1."""
    a_counts = Counter(a_toks)
    candidates = [t for t in stoks if len(t) >= 4]
    if not candidates:
        return -1
    rare = min(candidates, key=lambda t: a_counts.get(t, 0))
    if a_counts.get(rare, 0) == 0:
        return -1
    rare_pos_in_seg = stoks.index(rare)
    seg_counts = Counter(stoks)
    span = int(len(stoks) * 1.35) + 6
    for i in range(start, len(a_toks)):
        if a_toks[i] != rare:
            continue
        est_start = max(start, i - rare_pos_in_seg)
        window_counts = Counter(a_toks[est_start : est_start + span])
        covered = sum((seg_counts & window_counts).values())
        if covered / len(stoks) >= 0.55:
            return est_start
    return -1


def asr_compare(script_text: str, segment_texts: list[str], asr_text: str) -> tuple[list[str], dict]:
    problems: list[str] = []
    s_toks = tokens(script_text)
    a_toks = tokens(asr_text)
    if not s_toks or not a_toks:
        return ["ASR compare: empty script or transcript"], {}
    # Global word-count (multiset) comparison — repetition-safe.
    s_counts, a_counts = Counter(s_toks), Counter(a_toks)
    inter = sum((s_counts & a_counts).values())
    coverage = inter / len(s_toks)
    extra_ratio = 1.0 - (inter / len(a_toks))
    metrics = {
        "script_tokens": len(s_toks),
        "asr_tokens": len(a_toks),
        "coverage": round(coverage, 3),
        "extra_ratio": round(extra_ratio, 3),
    }
    if coverage < GLOBAL_COVERAGE_MIN:
        problems.append(f"global script coverage {coverage:.2f} < {GLOBAL_COVERAGE_MIN}")
    if extra_ratio > EXTRA_RATIO_MAX:
        problems.append(f"ASR extra-content ratio {extra_ratio:.2f} > {EXTRA_RATIO_MAX}")

    # Interval check between UNIQUE segments. Repetitive filler (53 Hail
    # Marys) plus 60 s ASR chunk boundaries make per-segment anchoring
    # unreliable mid-decade, so the span discipline runs between the
    # episode's unique segments (seam texts, announcements, the Creed —
    # texts occurring once): locate each in order in the ASR stream, then
    # every interval between consecutive anchors must carry roughly the
    # script's token count for that stretch. Inserted speech concentrates
    # in one interval and blows its ratio; boundary noise averages out
    # over 100+ token intervals.
    seg_toks = [tokens(t) for t in segment_texts]
    text_counts = Counter(" ".join(st) for st in seg_toks)
    unique_idx = [i for i, st in enumerate(seg_toks)
                  if len(st) >= 12 and text_counts[" ".join(st)] == 1]
    anchors: dict[int, int] = {}
    cursor = 0
    unlocated = 0
    for i in unique_idx:
        pos = _find_anchor(a_toks, seg_toks[i][:5], cursor)
        if pos < 0:
            pos = _find_anchor(a_toks, seg_toks[i][:3], cursor)
        if pos < 0:
            pos = _find_segment_soft(a_toks, seg_toks[i], cursor)
        if pos < 0:
            unlocated += 1
            continue
        anchors[i] = pos
        cursor = pos + 1
    seg_problems: list[str] = []
    worst_span = 0.0
    located = sorted(anchors)
    # Script token offsets per segment index.
    offsets = []
    run = 0
    for st in seg_toks:
        offsets.append(run)
        run += len(st)
    total_script = run
    bounds = [(0, 0)] + [(i, anchors[i]) for i in located] + [(len(seg_toks), len(a_toks))]
    for (si, ai), (sj, aj) in zip(bounds, bounds[1:]):
        script_interval = (offsets[sj] if sj < len(offsets) else total_script) - offsets[si]
        asr_interval = aj - ai
        if script_interval < 30:
            continue
        ratio = asr_interval / script_interval
        worst_span = max(worst_span, ratio)
        if ratio < INTERVAL_RATIO_MIN or ratio > SEGMENT_SPAN_RATIO_MAX:
            seg_problems.append(
                f"interval span ratio {ratio:.2f} before segment: {segment_texts[sj][:60]!r}"
                if sj < len(segment_texts) else
                f"interval span ratio {ratio:.2f} in the episode tail"
            )
    for j, i in enumerate(located):
        start = anchors[i]
        end = anchors[located[j + 1]] if j + 1 < len(located) else len(a_toks)
        window_counts = Counter(a_toks[start:end])
        seg_inter = sum((Counter(seg_toks[i]) & window_counts).values())
        if seg_inter / len(seg_toks[i]) < SEGMENT_WINDOW_COVERAGE_MIN:
            seg_problems.append(
                f"unique segment window coverage {seg_inter / len(seg_toks[i]):.2f}: "
                f"{segment_texts[i][:60]!r}"
            )
    # Unlocated anchors degrade interval granularity but do not by
    # themselves prove divergence (ASR drops short announcement segments
    # whole — 4 of 30 on the known-good 2026-11-19 rosary); the merged
    # intervals around them still bound the region, and the fragment
    # duration screen independently catches inserted speech. Only a
    # majority-unlocated stream means the ASR does not match the episode
    # at all — that holds.
    if unlocated > max(2, len(unique_idx) // 2):
        seg_problems.append(f"{unlocated} of {len(unique_idx)} unique segments not located in ASR stream")
    metrics["worst_segment_span_ratio"] = round(worst_span, 2)
    metrics["segment_problems"] = len(seg_problems)
    metrics["unlocated_segments"] = unlocated
    problems.extend(seg_problems[:4])
    return problems, metrics


# --------------------------------------------------------------- main API --
def guard_episode(
    *,
    episode_id: str,
    mp3: Path,
    script_text: str,
    segment_texts: list[str],
    fragments=(),
    seam_texts: dict[str, str] | None = None,
    context: dict | None = None,
    workdir: Path,
) -> dict:
    """Run every guard layer for one built episode. Returns a verdict dict;
    passed=False means HOLD. ASR/infra failure is a hold, never a pass."""
    result: dict = {"episode_id": episode_id, "passed": False, "problems": [], "metrics": {}}
    if os.environ.get("ORA_GUARD_SKIP") == "1":
        result.update(passed=True, skipped=True, problems=["guard skipped via ORA_GUARD_SKIP (manual test build only)"])
        return result
    problems: list[str] = []
    problems += [f"[fragment] {p}" for p in fragment_duration_screen(fragments)]
    problems += [f"[script] {p}" for p in script_screen(seam_texts or {}, context)]
    try:
        asr_text = transcribe_episode(Path(mp3), Path(workdir))
        asr_problems, metrics = asr_compare(script_text, segment_texts, asr_text)
        problems += [f"[asr] {p}" for p in asr_problems]
        result["metrics"] = metrics
    except Exception as exc:  # noqa: BLE001 - a guard that cannot run holds the episode
        problems.append(f"[asr] guard unavailable: {exc}")
    result["problems"] = problems
    result["passed"] = not problems
    return result


if __name__ == "__main__":
    print(json.dumps({"module": "transcript_guard", "asr_python": str(ASR_VENV_PYTHON),
                      "asr_python_exists": ASR_VENV_PYTHON.exists()}, indent=1))
