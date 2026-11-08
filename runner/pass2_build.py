#!/usr/bin/env python3
"""Pass 2 — render, assemble, brand, verify, and (only with --publish) publish.

Render: every unique (voice, normalized text) segment is cache-first in the
persistent fragment cache (default ~/workspace/ora-runner-cache/fragcache,
key = sha1("<full voice>|<normalized text>")). Cache misses are rendered with
/opt/hatch/bin/tts; the JSON result's voice must read back exactly equal to
the requested voice (one retry), else the episode is marked TTS_FAILED.
ElevenLabs is excluded by design — there is no fallback provider, ever.

Assemble: ffmpeg concat of 48 kHz mono fragment WAVs (head/tail silence trim
keeping 0.05 s, the Nov 6 method) with the episode's gap (350 ms default;
Daily Reflection 15000 ms) between fragments, contract pauses carried as
segment items, and the synthesized church bell (jobs.publish.bell v3:
inharmonic partial stack, per-partial exponential decays, strike
transient; 4.8 s, RMS-matched to the retired 392/784/1176 Hz sine bell)
for novena bell items.

Brand: repo jobs.publish.audio_branding._mix_audio with the loaded branding
config (welcome = the episode's first segment, rendered in the main voice;
seasonal bed resolved from the EPISODE date via repo code; 3.5 s lead-in;
bed -30 dB; 6 s outro). Loudness AFTER branding at the repo targets
(-16 LUFS / -1.5 dBTP / LRA 11), applied as the hand runs applied it:
MEASURED two-pass loudnorm with linear=true. The repo's own
normalize_episode_loudness is a single-pass DYNAMIC loudnorm — measured on
the Nov 7 dry run, it pumped the branded music-only head from -57 dB to
-15.3 dB, destroying the branding head the settled verification checks for;
the two-pass linear form preserves it (hand-run heads: -37 to -38 dB).
Final MP3 encode uses the repo output args (libmp3lame -q:a 0).

Verify: a SETTLED pass (probes retry until the file size is stable — this VM
has write-visibility lag) does a full decode, duration, loudness, and the
branding head-check on publish episodes. All reported numbers come from the
settled pass.

Outputs: RUNDIR/out/<episode_id>.mp3 (publish-name final) +
RUNDIR/out/<file_base>.mp3 (hand-run-name copy of the same final) +
RUNDIR/out/<episode_id>.json sidecars + RUNDIR/report.json + report.md.

--publish: see publish_drop() — ledger skip first, R2 upload with manifest
RECONCILIATION (merge into the bucket's existing .audio-sync-manifest.json,
never rewrite it from the local plan), live-feed graft, GitHub commit via the
connector, deploy-pages dispatch, live verification, ledger flip. Publishing
requires the FULL expected set: any failed episode aborts before any upload.

--reconcile: see reconcile_drop() — the idempotent tail finisher. Checks, in
publish order, the local set (report.json settled pass + out/ files), the R2
manifest/bucket, the live feed (items matched by GUID/enclosure identity),
and the ledger; then completes ONLY the missing tail steps with the publish
path's own functions (R2 upload of the missing objects + manifest
reconciliation, graft of the missing items only, commit + deploy, live
verify, ledger flip LAST with the feed commit + deploy run recorded). A
partial/unverified local set aborts before any external write; a fully
published date prints "already complete — no changes" and touches nothing.
Built for the 2026-11-07 failure: the Nov 9 publish had finished R2, graft,
commit, and deploy when the 1700 s wrapper timeout killed the run during
live-feed verification polling, before the in-code ledger flip.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import (  # noqa: E402
    FORK,
    FRAGCACHE_DEFAULT,
    LEDGER_PATH,
    TTS_CLI,
    TTS_SIDECAR,
    add_repo_paths,
    ensure_repo_python,
    normalized_tts_text,
    voice_full,
)

ensure_repo_python()
add_repo_paths()

TRIM = (
    "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB,areverse,"
    "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB,areverse"
)
LOUDNORM_CFG = {"loudness_normalization": {"enabled": True, "integrated_lufs": -16, "true_peak_db": -1.5, "lra": 11}}
AUDIO_PUBLIC_BASE = "https://audio.orapronobis.media"
LIVE_FEED_URL = "https://jctebo.github.io/spotify_praylist/podcast.xml"
GH_REPO = "Jctebo/spotify_praylist"
CF_ACCOUNT = "19135db329e6018b318b33b72aa6e3f3"
CF_BUCKET = "orapronobis-audio"
CF_BASE = "https://api.cloudflare.com/client/v4"
MANIFEST_KEY = ".audio-sync-manifest.json"


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def dur(path) -> float:
    r = run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "json", str(path)])
    return float(json.loads(r.stdout)["format"]["duration"])


def mean_vol(path, start, length):
    r = run(["ffmpeg", "-ss", str(start), "-t", str(length), "-i", str(path), "-af", "volumedetect", "-f", "null", "-"])
    m = re.search(r"mean_volume: (-?[\d.]+) dB", r.stderr)
    return float(m.group(1)) if m else None


def loudness(path):
    r = run(["ffmpeg", "-i", str(path), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"])
    m = re.search(r"\{[^}]*\"input_i\"[^}]*\}", r.stderr, re.S)
    if not m:
        return None, None
    j = json.loads(m.group(0))
    return float(j["input_i"]), float(j["input_tp"])


class EpisodeFail(Exception):
    pass


# ---------------------------------------------------------------- render --
def frag_cache_path(cache: Path, voice: str, normalized: str) -> Path:
    key = hashlib.sha1(f"{voice}|{normalized}".encode()).hexdigest()
    return cache / f"{key}.mp3"


def render_one(item, cache: Path):
    (voice, normalized), path = item
    if path.exists() and path.stat().st_size > 1000:
        return (voice, normalized), "hit"
    last = ""
    for _attempt in range(2):
        r = run([TTS_CLI, "speak", "--text-stdin", "--voice", voice, "--output", str(path)], input=normalized)
        last = (r.stdout or "") + (r.stderr or "")
        ok = False
        try:
            j = json.loads(r.stdout.strip().splitlines()[-1])
            ok = bool(j.get("ok")) and j.get("voice") == voice and path.exists() and path.stat().st_size > 0
        except Exception:
            ok = False
        if ok:
            return (voice, normalized), "rendered"
        if path.exists():
            path.unlink()
    return (voice, normalized), f"FAILED {last[:200]}"


def ensure_bell(cache: Path) -> Path:
    # Church bell synthesis v3 (jobs.publish.bell, shared with the repo
    # publish pipeline): inharmonic partial stack with per-partial
    # exponential decays + a strike transient, still exactly 4.8 s and
    # RMS-matched to the old 392/784/1176 sine bell. New filename so a
    # stale v2 bell.wav in the cache is never picked up.
    from jobs.publish.bell import church_bell_ffmpeg_args

    bell = cache / "bell-v3.wav"
    if bell.exists():
        return bell
    cmd = ["ffmpeg", *church_bell_ffmpeg_args(bell, 48000, ["-ar", "48000", "-ac", "1"])]
    run(cmd, check=True)
    return bell


# ----------------------------------------------------------------- build --
def loudnorm_two_pass(src: Path, dst: Path) -> str:
    """Measured two-pass loudnorm at the repo targets (-16 / -1.5 / 11),
    linear=true, repo MP3 output args. Falls back to single-pass (repo
    settings) when the measurement pass cannot be parsed — the hand-run
    fallback pattern."""
    r = run(["ffmpeg", "-i", str(src), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"])
    m = re.search(r"\{[^}]*\"input_i\"[^}]*\}", r.stderr, re.S)
    if m:
        j = json.loads(m.group(0))
        af = (
            f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}"
            f":measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true"
        )
        rr = run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-af", af, "-c:a", "libmp3lame", "-q:a", "0", str(dst)])
        if rr.returncode == 0:
            return "two-pass"
    run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
         "-c:a", "libmp3lame", "-q:a", "0", str(dst)], check=True)
    return "single-pass-fallback"


def build(rundir: Path, cache: Path) -> dict:
    from jobs.publish.audio import content_hash_for_entry
    from jobs.publish.audio_branding import _mix_audio, _resolve_asset, load_audio_branding_config

    plan = json.loads((rundir / "plan.json").read_text())
    date_iso = plan["date"]
    welcome_text = plan["welcome_text"]
    outdir = rundir / "out"
    outdir.mkdir(parents=True, exist_ok=True)
    work = rundir / "work"
    work.mkdir(parents=True, exist_ok=True)
    brand_cache = rundir / "branding-cache"
    brand_cache.mkdir(parents=True, exist_ok=True)
    cache.mkdir(parents=True, exist_ok=True)

    # Load episodes in plan order with normalized segment texts.
    episodes = []
    for ep in plan["episodes"]:
        data = json.loads((rundir / ep["segment_file"]).read_text())
        segs = []
        for s in data["segments"]:
            if "text" in s:
                voice = voice_full(s.get("voice", "MAI_03"))
                segs.append({"text": s["text"], "voice": voice, "normalized": normalized_tts_text(s["text"])})
            elif "bell" in s:
                segs.append({"bell": True})
            else:
                segs.append({"pause_ms": int(s["pause_ms"])})
        episodes.append({**ep, "segments_norm": segs})

    # Render phase (unique fragments, cache-first, parallel like the hand runs).
    uniq: dict[tuple[str, str], Path] = {}
    for ep in episodes:
        for s in ep["segments_norm"]:
            if "text" in s:
                uniq[(s["voice"], s["normalized"])] = frag_cache_path(cache, s["voice"], s["normalized"])
    render_log: dict[tuple[str, str], str] = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        for key, status in ex.map(lambda it: render_one(it, cache), uniq.items()):
            render_log[key] = status
    render_stats = {
        "unique_fragments": len(uniq),
        "rendered": sum(1 for v in render_log.values() if v == "rendered"),
        "cache_hits": sum(1 for v in render_log.values() if v == "hit"),
        "failures": sum(1 for v in render_log.values() if v.startswith("FAILED")),
    }
    print(f"render: {render_stats}", flush=True)

    bell = ensure_bell(cache)

    def frag_wav(voice, normalized, tag):
        src = frag_cache_path(cache, voice, normalized)
        out = work / f"{tag}.wav"
        if not out.exists():
            run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-af", TRIM, "-ar", "48000", "-ac", "1", str(out)], check=True)
        return out

    def pause_wav(ms):
        out = work / f"pause-{ms}.wav"
        if not out.exists():
            run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono",
                 "-t", str(ms / 1000), str(out)], check=True)
        return out

    config = load_audio_branding_config()
    season = plan["context"]["music_season"]
    _, music_path = _resolve_asset(config, season)

    results: dict[str, dict] = {}
    gen_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
    for ep in episodes:
        key = ep["key"]
        failed = [s for s in ep["segments_norm"] if "text" in s and render_log.get((s["voice"], s["normalized"]), "").startswith("FAILED")]
        if failed:
            results[key] = {"status": "FAILED_RENDER", "failed_fragments": len(failed), "episode_id": ep["episode_id"]}
            print(key, "FAILED_RENDER", flush=True)
            continue
        segs = ep["segments_norm"]
        # Publish segment files carry the branding welcome as segment 0.
        # Novena segment files (hand-run layout) start with the novena intro;
        # production branding still places the Ora Pro Nobis welcome before
        # the contract's own intro text, so the body is the whole file and
        # the welcome fragment is the shared one.
        if segs and "text" in segs[0] and segs[0]["text"] == welcome_text:
            body = segs[1:]
        else:
            body = segs
        parts: list[tuple[Path, bool]] = []
        for idx, s in enumerate(body):
            if "text" in s:
                parts.append((frag_wav(s["voice"], s["normalized"], f"{key}-{idx}"), False))
            elif "bell" in s:
                parts.append((bell, False))
            else:
                parts.append((pause_wav(s["pause_ms"]), True))
        seq: list[Path] = []
        for i, (p, is_pause) in enumerate(parts):
            if i > 0 and not (is_pause or parts[i - 1][1]) and ep["gap_ms"] > 0:
                seq.append(pause_wav(ep["gap_ms"]))
            seq.append(p)
        listfile = work / f"{key}-list.txt"
        listfile.write_text("".join(f"file '{p}'\n" for p in seq))
        spoken_wav = work / f"{key}-spoken.wav"
        run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(listfile),
             "-ar", "48000", "-ac", "1", str(spoken_wav)], check=True)
        # Dry (pre-branding) MP3, hand-run naming, kept under work/.
        dry_mp3 = work / f"{ep['file_base']}-dry.mp3"
        run(["ffmpeg", "-y", "-v", "error", "-i", str(spoken_wav), "-c:a", "libmp3lame", "-q:a", "0", str(dry_mp3)], check=True)

        welcome_norm = normalized_tts_text(welcome_text)
        welcome_frag = frag_cache_path(cache, voice_full("MAI_03"), welcome_norm)
        if not welcome_frag.exists():
            _, status = render_one(((voice_full("MAI_03"), welcome_norm), welcome_frag), cache)
            if status.startswith("FAILED"):
                results[key] = {"status": "FAILED_RENDER", "failed_fragments": 1, "episode_id": ep["episode_id"]}
                print(key, "FAILED_RENDER (welcome)", flush=True)
                continue
        branded = _mix_audio(spoken_path=spoken_wav, welcome_path=welcome_frag, music_path=music_path,
                             target_format="mp3", config=config, cache_root=brand_cache)
        branded_path = work / f"{key}-branded-raw.mp3"
        branded_path.write_bytes(branded)
        final = outdir / f"{ep['episode_id']}.mp3"
        loudnorm_mode = loudnorm_two_pass(branded_path, final)
        (outdir / f"{ep['file_base']}.mp3").write_bytes(final.read_bytes())

        texts = [s["text"] for s in segs if "text" in s]
        frags = [
            {"fragment_key": f"muse-runner/{ep['episode_id']}/{i}", "block_path": f"muse-runner/{ep['episode_id']}/{i}",
             "kind": "inline", "label": "Fragment", "text": t}
            for i, t in enumerate(texts)
        ]
        chash = content_hash_for_entry(
            {"entry_id": ep["episode_id"], "title": ep["title"], "audio_fragments": frags}, dict(TTS_SIDECAR)
        )
        side = {
            "audio_length": final.stat().st_size,
            "audio_path": f"audio/{ep['episode_id']}.mp3",
            "content_hash": chash,
            "contract_id": ep["contract_id"],
            "date": date_iso,
            "description": ep["description"],
            "entry_id": ep["entry_id"],
            "episode_id": ep["episode_id"],
            "family_id": "",
            "generated_at": gen_at,
            "published_date": date_iso,
            "rss_guid": f"{ep['episode_id']}::{chash}",
            "source": "muse-run runner (pass2_build)",
            "title": ep["title"],
            "tts": dict(TTS_SIDECAR),
        }
        if ep["kind"] == "novena":
            side["contract_type"] = "novena"
            side["novena_day"] = ep["novena_day"]
        (outdir / f"{ep['episode_id']}.json").write_text(json.dumps(side, indent=2, sort_keys=True))
        (outdir / f"{ep['file_base']}-script.txt").write_text("\n\n".join(texts) + "\n")
        results[key] = {
            "status": "built",
            "episode_id": ep["episode_id"],
            "title": ep["title"],
            "kind": ep["kind"],
            "file": final.name,
            "handstyle_file": f"{ep['file_base']}.mp3",
            "spoken_chars": sum(len(s["normalized"]) for s in segs if "text" in s),
            "spoken_segments": sum(1 for s in segs if "text" in s),
            "total_segments": len(segs),
            "loudnorm": loudnorm_mode,
        }
        print(key, "built", flush=True)

    # ---------------- settled verification pass ----------------
    time.sleep(3)
    for ep in episodes:
        key = ep["key"]
        if results[key]["status"] != "built":
            continue
        final = outdir / f"{ep['episode_id']}.mp3"
        last_size = -1
        for _ in range(6):
            size = final.stat().st_size
            if size == last_size and size > 0:
                break
            last_size = size
            time.sleep(1)
        dec = run(["ffmpeg", "-v", "error", "-i", str(final), "-f", "null", "-"])
        li, tp = loudness(final)
        entry = results[key]
        entry.update(
            {
                "duration_s": round(dur(final), 1),
                "bytes": final.stat().st_size,
                "lufs": li,
                "true_peak": tp,
                "decode_ok": dec.returncode == 0 and not dec.stderr.strip(),
            }
        )
        if ep["kind"] == "publish":
            welcome_seg = ep["segments_norm"][0]
            wdur = dur(frag_cache_path(cache, welcome_seg["voice"], welcome_seg["normalized"]))
            head = mean_vol(final, 0, 3.0)
            voice = mean_vol(final, 4.0, max(1.0, min(wdur - 0.6, 4.0)))
            entry["head_mean_db"] = head
            entry["welcome_mean_db"] = voice
            entry["head_ok"] = bool(head is not None and voice is not None and head < voice - 6 and head > -60)
        print(key, "verified", entry["duration_s"], flush=True)

    built = [r for r in results.values() if r["status"] == "built"]
    failed_eps = [r for r in results.values() if r["status"] != "built"]
    report = {
        "date": date_iso,
        "rundir": str(rundir),
        "episodes": results,
        "render_stats": render_stats,
        "totals": {
            "episodes": len(results),
            "built": len(built),
            "failed": len(failed_eps),
            "duration_s": round(sum(r.get("duration_s", 0) for r in built), 1),
            "spoken_chars": sum(r.get("spoken_chars", 0) for r in built),
        },
        "flags": list(plan.get("flags") or [])
        + [f"{r['episode_id']}: TTS_FAILED — episode not built; publish is blocked for the whole day."
           for r in failed_eps],
        "published": False,
    }
    (rundir / "report.json").write_text(json.dumps(report, indent=1))
    (rundir / "report.md").write_text(render_report_md(report, plan))
    print(f"BUILD_DONE built={len(built)} failed={len(failed_eps)} "
          f"duration_s={report['totals']['duration_s']} chars={report['totals']['spoken_chars']}", flush=True)
    return report


def _mmss(seconds: float) -> str:
    m, s = divmod(int(round(seconds)), 60)
    return f"{m}:{s:02d}"


def render_report_md(report: dict, plan: dict) -> str:
    eps = report["episodes"]
    lines = [
        f"# Ora Pro Nobis — Muse-run runner set — {plan['date']}",
        "",
        "- **Status:** built locally by runner/pass2_build.py, **NOT published** "
        "(no R2 upload, no feed edit, no GitHub commit, no deploy; published-drops ledger untouched)"
        if not report.get("published")
        else "- **Status:** PUBLISHED by runner/pass2_build.py --publish (see report.json publish block).",
        "- **Method:** runner pipeline — repo contracts/resolver collection (pass 1), agent texts at the "
        "stub-bridge seam (pass 1b), fragment cache + ffmpeg assembly, repo `_mix_audio` branding with the "
        f"{plan['context']['music_season']} asset, welcome = first segment, 3.5 s lead-in, -30 dB bed, 6 s outro, "
        "repo loudnorm (-16 LUFS / -1.5 dBTP / LRA 11) after branding.",
        "- **Voices:** avocado_v2:MAI_03 for all spoken content; avocado_v2:MAI_01 for the Auxilium "
        "Christianorum versicle/response role parts only. No ElevenLabs, no other provider. Every render's "
        "voice was read back from the TTS result and matched the requested voice.",
        "- **All durations/chars/loudness below are from the settled post-build verification pass** "
        "(full-decode durations, loudness measured on the finished files).",
        "",
        "## Publish episodes",
        "",
        "| Episode | File | Duration | Spoken chars | Segments | Loudness |",
        "|---|---|---|---|---|---|",
    ]
    for ep in plan["episodes"]:
        r = eps.get(ep["key"], {})
        if ep["kind"] != "publish":
            continue
        if r.get("status") != "built":
            lines.append(f"| {ep['title']} | — | FAILED | — | — | — |")
            continue
        lines.append(
            f"| {ep['title']} | {r['handstyle_file']} | {_mmss(r['duration_s'])} ({r['duration_s']} s) | "
            f"{r['spoken_chars']:,} | {r['spoken_segments']} | {r['lufs']} LUFS / {r['true_peak']} dBTP |"
        )
    lines += ["", "## Novena episodes", "", "| Novena | Day | File | Duration | Spoken chars | Loudness |", "|---|---|---|---|---|---|"]
    for ep in plan["episodes"]:
        r = eps.get(ep["key"], {})
        if ep["kind"] != "novena":
            continue
        if r.get("status") != "built":
            lines.append(f"| {ep['saint']} | {ep['novena_day']} | — | FAILED | — | — |")
            continue
        lines.append(
            f"| {ep['saint']} | {ep['novena_day']} | {r['handstyle_file']} | {_mmss(r['duration_s'])} ({r['duration_s']} s) | "
            f"{r['spoken_chars']:,} | {r['lufs']} LUFS / {r['true_peak']} dBTP |"
        )
    t = report["totals"]
    rs = report["render_stats"]
    lines += [
        "",
        "## Totals",
        "",
        f"- **Episodes:** {t['episodes']} (built {t['built']}, failed {t['failed']})",
        f"- **Total audio:** {_mmss(t['duration_s'])} ({t['duration_s']} s)",
        f"- **Total spoken chars:** {t['spoken_chars']:,}",
        f"- **Fragments:** {rs['unique_fragments']} unique, {rs['rendered']} rendered, "
        f"{rs['cache_hits']} cache hits, {rs['failures']} failures",
        "",
        "## Flags and notes",
        "",
    ]
    lines += [f"{i}. {f}" for i, f in enumerate(report["flags"], start=1)] or ["- None."]
    return "\n".join(lines) + "\n"


# --------------------------------------------------------------- publish --
class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a):
        raise RuntimeError("redirect refused")


def _cf_open(req, raw=False):
    sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
    from dynamic_credentials import add_surrogate_to_request, read_json_response

    add_surrogate_to_request(req, "custom.cloudflare", allowed_hosts=["api.cloudflare.com"])
    opener = urllib.request.build_opener(_NoRedirect())
    try:
        with opener.open(req, timeout=180) as resp:
            return resp.read() if raw else read_json_response(resp)
    except urllib.error.HTTPError as e:
        body = e.read()
        if raw:
            raise RuntimeError(f"Cloudflare API HTTP {e.code}: {body[:300]!r}") from e
        try:
            return json.loads(body.decode("utf-8", "replace"))
        except Exception:
            return {"success": False, "status": e.code, "raw": body[:500]}


def _cf_r2_put(key: str, data: bytes, ctype: str) -> dict:
    url = f"{CF_BASE}/accounts/{CF_ACCOUNT}/r2/buckets/{CF_BUCKET}/objects/{urllib.parse.quote(key, safe='')}"
    req = urllib.request.Request(url, data=data, headers={"content-type": ctype}, method="PUT")
    return _cf_open(req)


def _cf_r2_get_bytes(key: str):
    url = f"{CF_BASE}/accounts/{CF_ACCOUNT}/r2/buckets/{CF_BUCKET}/objects/{urllib.parse.quote(key, safe='')}"
    req = urllib.request.Request(url, method="GET")
    try:
        return _cf_open(req, raw=True)
    except RuntimeError as exc:
        if "HTTP 404" in str(exc):
            return None
        raise


def _cf_r2_list() -> list[str]:
    keys, cursor = [], ""
    while True:
        url = f"{CF_BASE}/accounts/{CF_ACCOUNT}/r2/buckets/{CF_BUCKET}/objects?per_page=1000" + (
            f"&cursor={cursor}" if cursor else ""
        )
        req = urllib.request.Request(url, method="GET")
        res = _cf_open(req)
        if not res.get("success"):
            raise RuntimeError(f"R2 list failed: {json.dumps(res)[:300]}")
        keys += [o["key"] for o in res["result"]]
        cursor = (res.get("result_info") or {}).get("cursor") or ""
        if not cursor:
            return keys


def _gh_request(method: str, path: str, payload=None):
    sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
    from dynamic_credentials import add_surrogate_to_request, read_json_response

    url = f"https://api.github.com{path}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"accept": "application/vnd.github+json", "content-type": "application/json"},
    )
    add_surrogate_to_request(req, "custom.github", allowed_hosts=["api.github.com"])
    opener = urllib.request.build_opener(_NoRedirect())
    try:
        with opener.open(req, timeout=120) as resp:
            if resp.status == 204:
                return {"status": 204}
            return read_json_response(resp)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"GitHub API {method} {path} -> HTTP {e.code}: {body[:400]}") from e


def _dispatch_deploy(head_sha: str) -> str:
    """Dispatch the deploy-only Pages workflow for a commit and poll to
    completion; returns the run URL. Raises SystemExit on failure."""
    _gh_request("POST", f"/repos/{GH_REPO}/actions/workflows/deploy_pages.yml/dispatches", {"ref": "main"})
    deploy_run_url = ""
    deadline = time.time() + 900
    while time.time() < deadline:
        time.sleep(15)
        runs = _gh_request("GET", f"/repos/{GH_REPO}/actions/workflows/deploy_pages.yml/runs?per_page=5")
        candidates = [r for r in runs.get("workflow_runs", []) if r.get("head_sha") == head_sha]
        if not candidates:
            continue
        deploy = candidates[0]
        deploy_run_url = deploy.get("html_url", "")
        if deploy.get("status") == "completed":
            if deploy.get("conclusion") != "success":
                raise SystemExit(f"Deploy workflow finished with conclusion={deploy.get('conclusion')}: {deploy_run_url}")
            break
    else:
        raise SystemExit("Deploy workflow did not complete within 15 minutes.")
    return deploy_run_url


def _composite_site_square(raw: bytes) -> bytes:
    """Blend the day's phone wallpaper into a deep-blue square canvas —
    the site hero's restored treatment (John's design note, 2026-11-04):
    a square with a deep-blue gradient ground, the saint image set into
    it with feathered edges, fading to dark blue toward the bottom. The
    Actions-era pipeline never composited image-side (the site fed the
    raw phone file to a CSS hero); this step makes the runner's daily
    site output the blended square itself. Phone/watch Drive files are
    untouched — this only shapes the site's copy.
    """
    from io import BytesIO

    from PIL import Image, ImageChops, ImageDraw, ImageFilter

    S = 1440
    top = (16, 41, 77)     # #10294d deep blue
    mid = (10, 28, 58)     # #0a1c3a
    bottom = (4, 11, 26)   # #040b1a near-black blue
    strip = Image.new("RGB", (1, S))
    for y in range(S):
        t = y / (S - 1)
        if t < 0.55:
            a, b, u = top, mid, t / 0.55
        else:
            a, b, u = mid, bottom, (t - 0.55) / 0.45
        strip.putpixel((0, y), tuple(round(a[i] + (b[i] - a[i]) * u) for i in range(3)))
    canvas = strip.resize((S, S))

    art = Image.open(BytesIO(raw)).convert("RGB")
    scale = S / art.height
    art = art.resize((round(art.width * scale), S))
    x0 = (S - art.width) // 2

    # Feathered frame mask (soft edges all round, gentler at the top so
    # the burned-in title stays crisp).
    m = Image.new("L", art.size, 0)
    d = ImageDraw.Draw(m)
    d.rectangle([110, 28, art.width - 110, art.height], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(48))
    # Bottom fade: alpha ramps to 0 over the bottom 40% — the image
    # melts into the dark blue at the foot of the square.
    fade = Image.new("L", art.size, 255)
    fd = ImageDraw.Draw(fade)
    y_start = int(art.height * 0.60)
    for y in range(y_start, art.height):
        v = int(255 * (1 - (y - y_start) / (art.height - y_start)) ** 1.3)
        fd.line([(0, y), (art.width, y)], fill=v)
    mask = ImageChops.multiply(m, fade)

    canvas.paste(art, (x0, 0), mask)
    out = BytesIO()
    canvas.save(out, "JPEG", quality=88)
    return out.getvalue()


def _site_wallpaper_blob() -> dict | None:
    """Pick the site's background for TODAY (America/Chicago) from the
    Google Drive wallpaper rotation and stage it as a GitHub blob.

    The Pages site renders prayers.json's "wallpaper" — the day's saint
    phone wallpaper. The deploy-only workflow used to stage it from the
    OneDrive rclone remote; the 2026-11-03 cutover moved rotation to
    Google Drive and nothing updated OneDrive again, so the staging
    silently no-oped and the site shipped wallpaper=null (found
    2026-11-04). The runner now commits the picked file to
    assets/daily-wallpaper.jpg in the same commit as the feed, and
    build_pages_artifact.py falls back to that committed asset.

    Candidates: the site date's stamped phone files in phone-queue
    (staged two nights ahead; rotation into current happens later in
    the nightly run) and phone-current. Pick order: the saint subject
    (slug starts "saint-"/"st-"), else first alphabetically. Returns
    {"blob_sha", "source", "path"} or None — a failure here must not
    block the audio publish, but it is never silent: the caller records
    the outcome in the publish result for the run report.
    """
    import datetime as dt
    import tempfile
    from zoneinfo import ZoneInfo

    import wallpaper_rotate as wr

    site_date = dt.datetime.now(ZoneInfo("America/Chicago")).date().isoformat()
    stamp = re.compile(rf"__{re.escape(site_date)}\.(?:jpg|jpeg|png|webp)$", re.I)
    candidates: dict[str, dict] = {}
    for item in wr.list_queue("phone") + wr.list_children(wr.FOLDERS["phone-current"]):
        name = item.get("name") or ""
        if stamp.search(name) and item.get("mimeType") != wr.FOLDER_MIME:
            candidates[name] = item
    if not candidates:
        print(f"WARN site wallpaper: no phone file stamped {site_date} in Drive queue/current")
        return None
    names = sorted(candidates)
    saints = [n for n in names if n.split("__", 1)[0].startswith(("saint-", "st-"))]
    picked = saints[0] if saints else names[0]
    item = candidates[picked]
    suffix = Path(picked).suffix.lower() or ".jpg"
    with tempfile.TemporaryDirectory() as td:
        local = Path(td) / f"wallpaper{suffix}"
        res = subprocess.run(
            [wr.DRIVE_CLI, "drive", "files", "get",
             "--params", json.dumps({"fileId": item["id"], "alt": "media"}),
             "--output", str(local)],
            capture_output=True, text=True,
        )
        if res.returncode != 0 or not local.exists() or local.stat().st_size == 0:
            print(f"WARN site wallpaper: Drive download failed for {picked}: "
                  f"{(res.stderr or res.stdout)[:200]}")
            return None
        data = local.read_bytes()
    composited = False
    try:
        data = _composite_site_square(data)
        composited = True
    except Exception as exc:  # noqa: BLE001 - reported via result, never silent
        print(f"WARN site wallpaper composite failed for {picked}: {exc}; "
              "shipping the raw phone image instead")
    blob = _gh_request(
        "POST", f"/repos/{GH_REPO}/git/blobs",
        {"content": base64.b64encode(data).decode(), "encoding": "base64"},
    )
    print(f"Site wallpaper for {site_date}: {picked} ({len(data)} bytes, "
          f"composited square: {composited}) -> assets/daily-wallpaper{suffix}")
    return {"blob_sha": blob["sha"], "source": picked,
            "path": f"assets/daily-wallpaper{suffix}", "composited": composited}


def refresh_site_wallpaper() -> int:
    """Standalone site-background refresh (--site-wallpaper-only): commit
    today's picked Drive wallpaper to assets/daily-wallpaper.jpg and
    re-deploy the Pages site, touching nothing else.

    The nightly run's wallpaper step uses this after it generates and
    rotates RUN_DATE's set: pass 2's publish (and its in-commit site
    wallpaper pick) runs BEFORE that step, so on a night when the day's
    set was not already staged in the Drive queue, the publish deploys
    with the previous committed asset and this refresh corrects the
    site the same night. In steady state (set staged two nights ahead)
    it is a harmless no-op-equivalent: it re-commits the same pick the
    publish already shipped.
    """
    entry = _site_wallpaper_blob()
    if not entry:
        print("Site wallpaper refresh: no candidate for today in Drive queue/current.")
        return 1
    ref = _gh_request("GET", f"/repos/{GH_REPO}/git/ref/heads/main")
    head_sha = ref["object"]["sha"]
    head_commit = _gh_request("GET", f"/repos/{GH_REPO}/git/commits/{head_sha}")
    tree = _gh_request(
        "POST", f"/repos/{GH_REPO}/git/trees",
        {"base_tree": head_commit["tree"]["sha"],
         "tree": [{"path": entry["path"], "mode": "100644", "type": "blob", "sha": entry["blob_sha"]}]},
    )
    commit = _gh_request(
        "POST", f"/repos/{GH_REPO}/git/commits",
        {"message": f"Site wallpaper refresh: {entry['source']}",
         "tree": tree["sha"], "parents": [head_sha]},
    )
    _gh_request("PATCH", f"/repos/{GH_REPO}/git/refs/heads/main", {"sha": commit["sha"], "force": False})
    run_url = _dispatch_deploy(commit["sha"])
    print(f"Site wallpaper refresh deployed: {entry['source']} "
          f"(composited square: {entry['composited']}, "
          f"commit {commit['sha']}, run {run_url})")
    return 0


_ITEM_OPEN_RE = re.compile(r"<item(?:\s[^>]*)?>")
_ITEM_BLOCK_RE = re.compile(r"<item(?:\s[^>]*)?>.*?</item>", re.S)


def graft_items(live_feed: str, new_items: list[str]) -> str:
    """Splice new item blocks at the TOP of the live feed's item list.

    The anchor is the first item open tag, attribute-bearing or plain.
    Items this runner grafts are serialized with ET.tostring, which puts
    the namespace declarations on the item element itself
    (<item xmlns:itunes=...>); a search for the literal "<item>" misses
    every such item. On 2026-11-05 that made the Nov 7 graft splice its
    items in front of the first plain <item> — the first Nov 5 item,
    below the whole Nov 6 block — and the drop needed a repair commit.

    Verified by construction before returning: the merged feed must parse,
    and its item blocks must be exactly new_items followed by the live
    feed's original blocks, byte-identical and in order. Any mismatch
    aborts the publish instead of committing a mis-ordered feed.
    """
    import xml.etree.ElementTree as ET

    m = _ITEM_OPEN_RE.search(live_feed)
    if m is not None:
        marker = m.start()
    else:
        marker = live_feed.find("</channel>")
        if marker == -1:
            raise SystemExit("FEED GRAFT ABORTED: no <item> and no </channel> in the live feed.")
    new_feed = live_feed[:marker] + "\n".join(new_items) + "\n" + live_feed[marker:]
    merged_blocks = _ITEM_BLOCK_RE.findall(new_feed)
    if merged_blocks != list(new_items) + _ITEM_BLOCK_RE.findall(live_feed):
        raise SystemExit(
            "FEED GRAFT ABORTED: merged feed item blocks are not the new items "
            "followed by the live items unchanged; nothing was committed."
        )
    ET.fromstring(new_feed)
    return new_feed


def _expected_files(rundir: Path, plan: dict):
    """The publish set: exactly RUNDIR/out/<episode_id>.mp3 + .json per plan
    episode (never a glob — out/ also holds hand-run-name copies and
    -script.txt files). Returns (files, missing)."""
    outdir = rundir / "out"
    files, missing = [], []
    for ep in plan["episodes"]:
        for suffix in (".mp3", ".json"):
            p = outdir / f"{ep['episode_id']}{suffix}"
            (files if p.exists() else missing).append(p)
    return files, missing


def _backup_feed_once(live_feed: str, date_iso: str) -> None:
    """First time a date is published, keep the pre-drop live feed next to
    the ledger."""
    import datetime as dt

    backup = LEDGER_PATH.parent / f"podcast-feed-backup-{dt.date.today().isoformat()}-before-{date_iso}.xml"
    first_for_date = not any(
        p.name.endswith(f"before-{date_iso}.xml") for p in LEDGER_PATH.parent.glob("podcast-feed-backup-*.xml")
    )
    if first_for_date and not backup.exists():
        backup.write_text(live_feed)


def _upload_to_r2(files: list[Path], upload_names: set[str] | None = None) -> None:
    """Publish steps (1)+(2): upload the day's objects (all of them, or only
    upload_names when given), then manifest reconciliation — GET the bucket's
    existing .audio-sync-manifest.json, merge the FULL set's entries into it
    in the sync_r2_audio.py schema, PUT the merged manifest back LAST — then
    verify every key by listing the bucket."""
    for p in files:
        if upload_names is not None and p.name not in upload_names:
            continue
        ctype = "audio/mpeg" if p.suffix == ".mp3" else "application/json"
        res = _cf_r2_put(p.name, p.read_bytes(), ctype)
        if not res.get("success"):
            raise SystemExit(f"R2 upload failed for {p.name}: {json.dumps(res)[:300]}")
    manifest: dict = {"version": 1, "objects": {}}
    raw_manifest = _cf_r2_get_bytes(MANIFEST_KEY)
    if raw_manifest:
        try:
            parsed = json.loads(raw_manifest.decode("utf-8"))
            if parsed.get("version") == 1 and isinstance(parsed.get("objects"), dict):
                manifest = parsed
        except Exception:
            pass
    for p in files:
        data = p.read_bytes()
        manifest["objects"][p.name] = {"size": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    res = _cf_r2_put(
        MANIFEST_KEY,
        json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode("utf-8"),
        "application/json",
    )
    if not res.get("success"):
        raise SystemExit(f"R2 manifest PUT failed: {json.dumps(res)[:300]}")
    bucket_keys = set(_cf_r2_list())
    missing = [p.name for p in files if p.name not in bucket_keys]
    if missing:
        raise SystemExit(f"R2 verification failed; missing keys: {missing}")


def _build_new_items(rundir: Path, plan: dict, date_iso: str, only_episode_ids: set[str] | None = None):
    """Publish step (3), item side: build the day's RSS item blocks with the
    repo RSS code, from the out/ sidecars. Returns (jobs, new_items). With
    only_episode_ids, only those episodes' items are built (reconcile's
    partial graft)."""
    from jobs.publish.rss import build_rss_feed

    outdir = rundir / "out"
    jobs = []
    for ep in plan["episodes"]:
        if only_episode_ids is not None and ep["episode_id"] not in only_episode_ids:
            continue
        side = json.loads((outdir / f"{ep['episode_id']}.json").read_text())
        jobs.append(
            {
                "episode_id": ep["episode_id"],
                "entry_id": ep["entry_id"],
                "title": side["title"],
                "description": side["description"],
                "published_date": date_iso,
                "content_hash": side["content_hash"],
                "rss_guid": side["rss_guid"],
                "audio_url": f"{AUDIO_PUBLIC_BASE}/{ep['episode_id']}.mp3",
                "audio_length": side["audio_length"],
                # Real local path: rss._audio_length_bytes stats it. An empty
                # string becomes Path(".") whose directory stat size (408)
                # was emitted as every Nov 6 enclosure length on 2026-11-04.
                "audio_path": str(outdir / f"{ep['episode_id']}.mp3"),
            }
        )
    import xml.etree.ElementTree as ET

    built_feed = build_rss_feed(jobs)
    built_root = ET.fromstring(built_feed)
    new_items = [ET.tostring(item, encoding="unicode") for item in built_root.find("channel").findall("item")]
    return jobs, new_items


def _commit_feed(new_feed: str, date_iso: str):
    """Publish step (4): commit docs/podcast.xml to main via the Git Data
    API. The site wallpaper blob rides in the same commit when the Drive
    pick succeeds (see _site_wallpaper_blob); a miss never blocks the audio
    publish and is reported through the return value. Returns
    (commit_sha, site_wallpaper)."""
    ref = _gh_request("GET", f"/repos/{GH_REPO}/git/ref/heads/main")
    head_sha = ref["object"]["sha"]
    head_commit = _gh_request("GET", f"/repos/{GH_REPO}/git/commits/{head_sha}")
    blob = _gh_request(
        "POST", f"/repos/{GH_REPO}/git/blobs",
        {"content": base64.b64encode(new_feed.encode("utf-8")).decode(), "encoding": "base64"},
    )
    tree_entries = [{"path": "docs/podcast.xml", "mode": "100644", "type": "blob", "sha": blob["sha"]}]
    site_wallpaper = None
    try:
        site_wallpaper = _site_wallpaper_blob()
    except Exception as exc:  # noqa: BLE001 - reported via result, never silent
        print(f"WARN site wallpaper pick failed: {exc}")
    if site_wallpaper:
        tree_entries.append({"path": site_wallpaper["path"], "mode": "100644",
                             "type": "blob", "sha": site_wallpaper["blob_sha"]})
    tree = _gh_request(
        "POST", f"/repos/{GH_REPO}/git/trees",
        {"base_tree": head_commit["tree"]["sha"], "tree": tree_entries},
    )
    commit = _gh_request(
        "POST", f"/repos/{GH_REPO}/git/commits",
        {"message": f"Publish Ora Pro Nobis {date_iso} (Muse-run runner)",
         "tree": tree["sha"], "parents": [head_sha]},
    )
    _gh_request("PATCH", f"/repos/{GH_REPO}/git/refs/heads/main", {"sha": commit["sha"], "force": False})
    return commit["sha"], site_wallpaper


def _verify_live_feed(plan: dict, date_iso: str) -> str:
    """Publish step (6): poll the live feed until the day's episodes are the
    top items with R2 enclosures. Returns the verification string, or ""
    when the 300 s deadline passes."""
    import xml.etree.ElementTree as ET

    verification = ""
    deadline = time.time() + 300
    while time.time() < deadline:
        text = urllib.request.urlopen(LIVE_FEED_URL, timeout=120).read().decode("utf-8")
        root = ET.fromstring(text)
        items = root.find("channel").findall("item")
        top_ids = []
        for item in items[: len(plan["episodes"])]:
            enc = item.find("enclosure")
            top_ids.append((enc.get("url") or "") if enc is not None else "")
        if all(f"{AUDIO_PUBLIC_BASE}/{ep['episode_id']}.mp3" in top_ids for ep in plan["episodes"]):
            verification = f"Live feed verified: {len(items)} items, {date_iso} episodes on top with R2 enclosures."
            break
        time.sleep(20)
    return verification


def publish_drop(rundir: Path, report: dict) -> dict:
    """Publish the built day. Coded per the Nov 5 packet mechanics; the ledger
    skip runs FIRST, and any failed episode aborts before any external write."""
    import datetime as dt

    date_iso = report["date"]
    ledger = json.loads(LEDGER_PATH.read_text()) if LEDGER_PATH.exists() else {}
    entry = ledger.get(date_iso) or {}
    if entry.get("status") == "published":
        print(f"SKIP {date_iso}: ledger already marks this date published.")
        return {"skipped": True, "reason": "ledger_published"}
    if report["totals"]["failed"] or report["totals"]["built"] != report["totals"]["episodes"]:
        raise SystemExit("PUBLISH ABORTED: the day is not fully built (partial days are never published).")

    plan = json.loads((rundir / "plan.json").read_text())
    files, missing_files = _expected_files(rundir, plan)
    if missing_files:
        raise SystemExit(f"PUBLISH ABORTED: missing output {missing_files[0]}")

    # Feed backup: first time each new date is published, keep the pre-drop
    # live feed next to the ledger.
    live_feed = urllib.request.urlopen(LIVE_FEED_URL, timeout=120).read().decode("utf-8")
    _backup_feed_once(live_feed, date_iso)

    # (1)+(2) R2 uploads + manifest reconciliation (merged manifest LAST).
    _upload_to_r2(files)

    # (3) Feed graft: build ONLY the new items with repo RSS code, insert them
    # at the top of the CURRENT live feed; live items stay byte-identical.
    _jobs, new_items = _build_new_items(rundir, plan, date_iso)
    new_feed = graft_items(live_feed, new_items)

    # (4) Commit docs/podcast.xml (+ site wallpaper) to main via the Git
    # Data API, then (5) dispatch the deploy-only Pages workflow and poll to
    # completion.
    commit_sha, site_wallpaper = _commit_feed(new_feed, date_iso)
    deploy_run_url = _dispatch_deploy(commit_sha)

    # (6) Verify the live feed lists the new date's items on top.
    verification = _verify_live_feed(plan, date_iso)
    if not verification:
        raise SystemExit("Live feed verification failed: new items not on top after deploy.")

    # (7) Flip the ledger.
    ledger[date_iso] = {
        "status": "published",
        "published_at": dt.datetime.now(dt.timezone(dt.timedelta(hours=-6))).isoformat(),
        "feed_commit": commit_sha,
        "deploy_run": deploy_run_url,
        "verification": verification,
    }
    LEDGER_PATH.write_text(json.dumps(ledger, indent=1, sort_keys=True))
    return {
        "skipped": False,
        "feed_commit": commit_sha,
        "deploy_run": deploy_run_url,
        "verification": verification,
        "uploaded_objects": len(files),
        "site_wallpaper": site_wallpaper["source"] if site_wallpaper else None,
        "site_wallpaper_composited": site_wallpaper["composited"] if site_wallpaper else None,
    }


# ------------------------------------------------------------- reconcile --
def _local_set_state(rundir: Path, plan: dict):
    """Reconcile check (a): the rundir's own evidence that the day is fully
    built and verified — report.json (the settled verification pass) plus
    the out/ files and sidecars it vouches for. Returns (ok, problems,
    files)."""
    date_iso = plan["date"]
    problems: list[str] = []
    report_path = rundir / "report.json"
    if not report_path.exists():
        return False, ["report.json missing — the day was never built/verified by pass 2"], []
    report = json.loads(report_path.read_text())
    if report.get("date") != date_iso:
        problems.append(f"report.json date {report.get('date')} != plan date {date_iso}")
    totals = report.get("totals") or {}
    if totals.get("failed"):
        problems.append(f"report totals show {totals['failed']} failed episode(s)")
    if totals.get("built") != totals.get("episodes"):
        problems.append("report totals: built != episodes")
    results = report.get("episodes") or {}
    files, missing = _expected_files(rundir, plan)
    for p in missing:
        problems.append(f"missing output {p}")
    for ep in plan["episodes"]:
        r = results.get(ep["key"]) or {}
        if r.get("status") != "built":
            problems.append(f"{ep['episode_id']}: report status is {r.get('status')!r}, not 'built'")
            continue
        if r.get("decode_ok") is not True:
            problems.append(f"{ep['episode_id']}: settled verification decode_ok is not true")
        mp3 = rundir / "out" / f"{ep['episode_id']}.mp3"
        side_path = rundir / "out" / f"{ep['episode_id']}.json"
        if mp3.exists() and side_path.exists():
            try:
                side = json.loads(side_path.read_text())
            except Exception as exc:  # noqa: BLE001 - named in the problem list
                problems.append(f"{ep['episode_id']}: sidecar JSON unreadable: {exc}")
                continue
            if not side.get("rss_guid"):
                problems.append(f"{ep['episode_id']}: sidecar carries no rss_guid")
            if side.get("audio_length") != mp3.stat().st_size:
                problems.append(
                    f"{ep['episode_id']}: MP3 size {mp3.stat().st_size} != sidecar audio_length {side.get('audio_length')}"
                )
            if r.get("bytes") and r["bytes"] != mp3.stat().st_size:
                problems.append(f"{ep['episode_id']}: MP3 size != settled verification bytes {r['bytes']}")
    return not problems, problems, files


def _r2_state(files: list[Path]):
    """Reconcile check (b): the bucket manifest must carry every file with
    matching size + sha256, and the bucket listing must hold every key.
    Returns (ok, bad_names, detail)."""
    raw = _cf_r2_get_bytes(MANIFEST_KEY)
    objects: dict = {}
    if raw:
        try:
            parsed = json.loads(raw.decode("utf-8"))
            if isinstance(parsed.get("objects"), dict):
                objects = parsed["objects"]
        except Exception:
            objects = {}
    bad = []
    for p in files:
        entry = objects.get(p.name)
        data = p.read_bytes()
        if not entry or entry.get("size") != len(data) or entry.get("sha256") != hashlib.sha256(data).hexdigest():
            bad.append(p.name)
    bucket_keys = set(_cf_r2_list())
    unlisted = [p.name for p in files if p.name not in bucket_keys]
    return (
        not bad and not unlisted,
        sorted(set(bad) | set(unlisted)),
        {"manifest_entries": len(objects), "bucket_keys": len(bucket_keys)},
    )


def _feed_state(rundir: Path, plan: dict):
    """Reconcile check (c): which of the day's items are already in the LIVE
    feed, matched by the feed's own item identity — the item GUID (the
    sidecar rss_guid the graft path emits) or the item's R2 enclosure URL.
    Returns (present_ids, missing_ids, total_items, feed_text)."""
    import xml.etree.ElementTree as ET

    feed_text = urllib.request.urlopen(LIVE_FEED_URL, timeout=120).read().decode("utf-8")
    root = ET.fromstring(feed_text)
    items = root.find("channel").findall("item")
    guids, urls = set(), set()
    for item in items:
        g = item.find("guid")
        if g is not None and g.text:
            guids.add(g.text.strip())
        enc = item.find("enclosure")
        if enc is not None and enc.get("url"):
            urls.add(enc.get("url"))
    present, missing = [], []
    for ep in plan["episodes"]:
        side = json.loads((rundir / "out" / f"{ep['episode_id']}.json").read_text())
        if side.get("rss_guid") in guids or f"{AUDIO_PUBLIC_BASE}/{ep['episode_id']}.mp3" in urls:
            present.append(ep["episode_id"])
        else:
            missing.append(ep["episode_id"])
    return present, missing, len(items), feed_text


def _recover_feed_refs(rundir: Path, date_iso: str, report: dict | None):
    """Feed commit + deploy run URL for a graft that already happened (the
    reconcile case this mode exists for): the rundir report's publish block
    first; else the newest commit touching docs/podcast.xml and the deploy
    run on its head_sha."""
    pub = (report or {}).get("publish") or {}
    if pub.get("feed_commit") and pub.get("deploy_run"):
        return pub["feed_commit"], pub["deploy_run"]
    commits = _gh_request("GET", f"/repos/{GH_REPO}/commits?path=docs/podcast.xml&per_page=5")
    for c in commits:
        runs = _gh_request("GET", f"/repos/{GH_REPO}/actions/workflows/deploy_pages.yml/runs?per_page=10")
        match = [r for r in runs.get("workflow_runs", []) if r.get("head_sha") == c["sha"]]
        if match:
            return c["sha"], match[0].get("html_url", "")
    if commits:
        return commits[0]["sha"], ""
    return "", ""


def reconcile_drop(rundir: Path, ledger_path: Path) -> int:
    """--reconcile: finish a publish's tail idempotently.

    Built for the 2026-11-07 failure (target 2026-11-09): --publish had
    completed R2 upload, manifest reconciliation, feed graft, commit, and
    deploy when the 1700 s wrapper timeout killed the run during live-feed
    verification polling — before the in-code ledger flip; the ledger was
    flipped by hand on verified evidence. This mode re-derives that
    evidence mechanically and completes only what is missing.

    Checks, in publish order: (a) local set complete + verified (report.json
    settled pass + out/ files + sidecars); (b) R2 manifest + bucket listing;
    (c) live feed items by GUID/enclosure identity; (d) ledger entry. Then
    it completes only the missing tail steps, reusing the publish path's own
    functions: R2 upload of the missing objects + manifest reconciliation,
    graft of the missing items only (graft_items verifies the splice, so a
    present item is never duplicated), commit + deploy-only workflow,
    live-feed verify, and the ledger flip LAST (feed commit + deploy run
    recorded). If (a) fails, exit 2 and change nothing — a partial day is
    never published. If everything is already done, print the explicit
    already-complete result and change nothing.
    """
    import datetime as dt

    plan = json.loads((rundir / "plan.json").read_text())
    date_iso = plan["date"]
    print(f"RECONCILE {date_iso}: checking the publish tail in order — local set, R2, live feed, ledger.")
    report = None
    if (rundir / "report.json").exists():
        report = json.loads((rundir / "report.json").read_text())

    # (a) Local set.
    ok, problems, files = _local_set_state(rundir, plan)
    if not ok:
        print(f"RECONCILE ABORTED: PARTIAL DAY — the local set for {date_iso} is incomplete or unverified; "
              "nothing was uploaded or published.")
        for p in problems:
            print(f"  - {p}")
        return 2
    print(f"CHECK local set: OK — {len(files)} files ({len(plan['episodes'])} episodes), "
          "all verified by the run's settled pass.")

    # (b) R2.
    try:
        r2_ok, r2_bad, r2_detail = _r2_state(files)
    except (RuntimeError, SystemExit) as exc:
        print(f"RECONCILE FAILED at the R2 check: {exc}")
        return 1
    print(f"CHECK R2: {'OK' if r2_ok else 'INCOMPLETE'} — manifest {r2_detail['manifest_entries']} entries, "
          f"bucket {r2_detail['bucket_keys']} keys" + (f"; missing/mismatched: {r2_bad}" if r2_bad else ""))

    # (c) Live feed.
    present, missing_eps, total_items, _feed_text = _feed_state(rundir, plan)
    feed_ok = not missing_eps
    print(f"CHECK live feed: {'OK' if feed_ok else 'INCOMPLETE'} — {len(present)}/{len(plan['episodes'])} "
          f"of the day's items present among {total_items} feed items"
          + (f"; missing: {missing_eps}" if missing_eps else ""))

    # (d) Ledger.
    ledger = json.loads(ledger_path.read_text()) if ledger_path.exists() else {}
    entry = ledger.get(date_iso) or {}
    ledger_done = entry.get("status") == "published"
    print(f"CHECK ledger: {'published' if ledger_done else 'NOT published'} ({ledger_path})")

    if r2_ok and feed_ok and ledger_done:
        print(f"RECONCILE RESULT {date_iso}: already complete — no changes "
              "(no re-upload, no re-graft, no new commit, no ledger rewrite).")
        return 0
    if ledger_done and not (r2_ok and feed_ok):
        print("NOTE: the ledger already marks this date published but an earlier step is incomplete; "
              "completing the external steps only — the ledger entry is left untouched.")

    completed: list[str] = []
    commit_sha = entry.get("feed_commit", "")
    deploy_run_url = entry.get("deploy_run", "")
    verification = ""
    try:
        # Tail step 1: R2 upload (missing objects only) + manifest reconciliation.
        if not r2_ok:
            _upload_to_r2(files, upload_names=set(r2_bad))
            completed.append(f"R2 upload of {len(r2_bad)} object(s) + manifest reconciliation")
            print(f"DONE R2: uploaded {len(r2_bad)} missing/mismatched object(s); manifest reconciled "
                  "over the full set; bucket listing verified.")
        # Tail step 2: graft the missing items only + commit + deploy + verify.
        if not feed_ok:
            live_feed = urllib.request.urlopen(LIVE_FEED_URL, timeout=120).read().decode("utf-8")
            _backup_feed_once(live_feed, date_iso)
            _jobs, new_items = _build_new_items(rundir, plan, date_iso, only_episode_ids=set(missing_eps))
            new_feed = graft_items(live_feed, new_items)
            commit_sha, _site_wallpaper = _commit_feed(new_feed, date_iso)
            deploy_run_url = _dispatch_deploy(commit_sha)
            completed.append(f"feed graft of {len(new_items)} item(s) + commit {commit_sha} + deploy {deploy_run_url}")
            print(f"DONE feed: grafted {len(new_items)} item(s); commit {commit_sha}; deploy {deploy_run_url}.")
            verification = _verify_live_feed(plan, date_iso)
            if not verification:
                print("RECONCILE FAILED: live feed verification failed after the graft/deploy; "
                      "the ledger was NOT flipped. Re-run --reconcile to resume.")
                return 1
        else:
            _p, _m, total_now, _t = _feed_state(rundir, plan)
            verification = (f"Live feed verified: {total_now} items, {date_iso} episodes present "
                            "with R2 enclosures (GUID/enclosure match).")
        # Tail step 3: ledger flip LAST.
        if not ledger_done:
            if not commit_sha:
                commit_sha, deploy_run_url = _recover_feed_refs(rundir, date_iso, report)
            if not commit_sha:
                print("RECONCILE FAILED: no feed commit could be recovered for the ledger record; "
                      "the ledger was NOT flipped. Re-run --reconcile to resume.")
                return 1
            ledger[date_iso] = {
                "status": "published",
                "published_at": dt.datetime.now(dt.timezone(dt.timedelta(hours=-6))).isoformat(),
                "feed_commit": commit_sha,
                "deploy_run": deploy_run_url,
                "verification": verification,
                "reconciled_by": "runner/pass2_build.py --reconcile",
            }
            ledger_path.write_text(json.dumps(ledger, indent=1, sort_keys=True))
            completed.append(f"ledger flip (feed_commit {commit_sha}, deploy_run {deploy_run_url})")
            print(f"DONE ledger: {date_iso} marked published in {ledger_path}.")
            if report is not None:
                report["published"] = True
                report["publish"] = {
                    "skipped": False,
                    "feed_commit": commit_sha,
                    "deploy_run": deploy_run_url,
                    "verification": verification,
                    "uploaded_objects": len(files),
                    "reconciled": True,
                }
                (rundir / "report.json").write_text(json.dumps(report, indent=1))
                (rundir / "report.md").write_text(render_report_md(report, plan))
    except SystemExit as exc:
        print(f"RECONCILE FAILED mid-tail: {exc} Completed so far: {completed or 'none'}. "
              "The ledger was flipped only if listed above; re-run --reconcile to resume.")
        return 1
    print(f"RECONCILE RESULT {date_iso}: tail completed — {'; '.join(completed)}. Final state: published.")
    return 0

def main() -> int:
    parser = argparse.ArgumentParser(description="Pass 2: render + assemble + brand + verify (and optionally publish).")
    parser.add_argument("--rundir", required=False, default=None, help="Run directory produced by pass1/pass1b")
    parser.add_argument("--cache-dir", default=str(FRAGCACHE_DEFAULT), help="Persistent fragment cache directory")
    parser.add_argument("--publish", action="store_true", help="Publish the built day (R2 + feed + deploy + ledger)")
    parser.add_argument("--reconcile", action="store_true",
                        help="Idempotently finish a publish's tail (R2/feed/ledger checks, missing steps only); no rebuild")
    parser.add_argument("--ledger", default=str(LEDGER_PATH),
                        help="Published-drops ledger path for --reconcile (default: the production ledger)")
    parser.add_argument("--site-wallpaper-only", action="store_true",
                        help="Only refresh the Pages site background from today's Drive wallpaper pick and re-deploy; no build/publish")
    args = parser.parse_args()
    if args.site_wallpaper_only:
        return refresh_site_wallpaper()
    if args.reconcile:
        if not args.rundir:
            parser.error("--rundir is required with --reconcile")
        return reconcile_drop(Path(args.rundir), Path(args.ledger))
    if not args.rundir:
        parser.error("--rundir is required unless --site-wallpaper-only is given")
    rundir = Path(args.rundir)
    report = build(rundir, Path(args.cache_dir))
    if args.publish:
        result = publish_drop(rundir, report)
        report["published"] = not result.get("skipped", False)
        report["publish"] = result
        (rundir / "report.json").write_text(json.dumps(report, indent=1))
        plan = json.loads((rundir / "plan.json").read_text())
        (rundir / "report.md").write_text(render_report_md(report, plan))
        print(f"PUBLISH_RESULT {json.dumps(result)}")
    return 0 if report["totals"]["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
