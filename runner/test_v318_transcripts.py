#!/usr/bin/env python3
"""Fixture proof for v318 (feed half): transcripts in runner/pass2_build.py.

Drives the REAL publish path (publish_drop + reconcile_drop) against
synthetic fixtures only — an in-memory R2 bucket, a local HTTP stand-in
host serving the fixture feed and the transcript files, and a fake feed
commit. No live publish, no real bucket, no GitHub, no network beyond
127.0.0.1.

Covers (v318 §2 T6):
  A. publish_drop end to end on a 3-episode fixture day — clean script ·
     guard-tripping script · missing script. The clean transcript uploads
     verbatim (final-newline normalization only) and its new item gains
     <podcast:transcript>; the guard episode is withheld, named, and
     publishes WITHOUT a tag; the missing-script episode likewise; the
     standing fixture items stay byte-identical; the Podcasting 2.0
     namespace stands exactly once on the feed root tag; publish
     verification incl. the transcript fetch (200 + opening words) passes;
     the "Transcripts (v318)" field is computed with the guard episode
     named in `missing`.
  B. A second reconcile run over the completed drop changes NOTHING —
     bucket, feed, and ledger snapshots identical (idempotency).
  C. reconcile_drop from scratch completes the whole tail (upload, graft,
     verify, ledger flip last) with the same transcript properties and
     the same computed field.

Run with the repo venv python (the pipeline's third-party deps live
there):  ~/workspace/scratch-daybuild/nv-venv/bin/python runner/test_v318_transcripts.py
"""

from __future__ import annotations

import contextlib
import io
import json
import sys
import tempfile
import threading
import types
import urllib.request
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

RUNNER_DIR = Path(__file__).resolve().parent
FORK_ROOT = RUNNER_DIR.parent
sys.path.insert(0, str(FORK_ROOT))
sys.path.insert(0, str(RUNNER_DIR))

# runner/_common.py stands only in the production checkout (untracked);
# when it does not stand beside pass2_build, install a stub that pins the
# repo paths at THIS tree, so the fixture always exercises the code in
# the checkout the test lives in — never another tree's copy.
try:
    import _common  # noqa: F401
except ImportError:
    _stub = types.ModuleType("_common")
    _stub.FORK = FORK_ROOT
    _stub.FRAGCACHE_DEFAULT = FORK_ROOT / ".fragcache-test"
    _stub.LEDGER_PATH = RUNNER_DIR / ".v318-test-ledger.json"
    _stub.TTS_CLI = ""
    _stub.TTS_SIDECAR = {}
    _stub.add_repo_paths = lambda: sys.path.insert(0, str(FORK_ROOT))
    _stub.ensure_repo_python = lambda: None
    _stub.normalized_tts_text = lambda t: t
    _stub.voice_full = lambda v: v
    sys.modules["_common"] = _stub

import pass2_build as p2  # noqa: E402

DATE = "2027-03-05"
EPS = ["clean-ep", "poison-ep", "novid-ep"]
CLEAN_SCRIPT = (
    "In the name of the Father, and of the Son, and of the Holy Spirit. Amen.\n"
    "\n"
    "Clean episode body, prayed slowly.\n"
    "\n\n  \n"
)
CLEAN_PUBLISHED = (
    "In the name of the Father, and of the Son, and of the Holy Spirit. Amen.\n"
    "\n"
    "Clean episode body, prayed slowly.\n"
)
POISON_SCRIPT = "Intro line.\n[production note: ring the bell]\nBody.\n"
EXPECTED_FIELD = (
    "Transcripts (v318): episodes published 3 · transcripts uploaded 1 · "
    "missing poison-ep, novid-ep · tag read-back ok"
)


class Fixture:
    """In-memory bucket + the mutable served feed + fake commit/deploy."""

    def __init__(self) -> None:
        self.bucket: dict[str, bytes] = {}
        self.feed = ""
        self.commit_count = 0

    def r2_put(self, key, data, ctype):
        self.bucket[key] = bytes(data)
        return {"success": True}

    def r2_get(self, key):
        return self.bucket.get(key)

    def r2_list(self):
        return sorted(self.bucket)

    def commit_feed(self, new_feed, date_iso):
        self.feed = new_feed
        self.commit_count += 1
        return "fakecommit0001", None

    def dispatch(self, sha):
        return "https://example.invalid/deploy/1"


def start_server(fx: Fixture) -> ThreadingHTTPServer:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802 - BaseHTTPRequestHandler shape
            if self.path == "/podcast.xml":
                body = fx.feed.encode("utf-8")
            elif self.path.lstrip("/") in fx.bucket:
                body = fx.bucket[self.path.lstrip("/")]
            else:
                self.send_response(404)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def install(fx: Fixture, base: str, ledger: Path) -> None:
    p2._cf_r2_put = fx.r2_put
    p2._cf_r2_get_bytes = fx.r2_get
    p2._cf_r2_list = fx.r2_list
    p2._commit_feed = fx.commit_feed
    p2._dispatch_deploy = fx.dispatch
    p2.LIVE_FEED_URL = f"{base}/podcast.xml"
    p2.AUDIO_PUBLIC_BASE = base
    p2.LEDGER_PATH = ledger


def fixture_feed(base: str) -> str:
    items = ""
    for n in (1, 2):
        items += (
            f"<item><title>Old Episode {n}</title>"
            f'<guid isPermaLink="false">old-guid-{n}</guid>'
            f"<link>{base}/old-ep-{n}.mp3</link>"
            f"<description>Standing item {n}.</description>"
            f"<pubDate>Mon, 01 Mar 2027 06:00:00 -0600</pubDate>"
            f'<enclosure url="{base}/old-ep-{n}.mp3" length="100" type="audio/mpeg" /></item>\n'
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">\n'
        "<channel>\n<title>Ora Pro Nobis</title>\n" + items + "</channel>\n</rss>\n"
    )


def build_rundir(root: Path) -> Path:
    rd = root / "run"
    (rd / "out").mkdir(parents=True)
    plan = {
        "date": DATE,
        "context": {"music_season": "ordinary-time"},
        "episodes": [
            {"episode_id": e, "entry_id": e, "key": e, "kind": "publish", "title": f"Title {e}"}
            for e in EPS
        ],
    }
    (rd / "plan.json").write_text(json.dumps(plan))
    report_eps = {}
    for e in EPS:
        mp3 = f"FAKE-MP3::{e}::".encode() * 4
        (rd / "out" / f"{e}.mp3").write_bytes(mp3)
        side = {
            "title": f"Title {e}",
            "description": f"Desc {e}",
            "content_hash": f"hash-{e}",
            "rss_guid": f"guid-{e}",
            "audio_length": len(mp3),
        }
        (rd / "out" / f"{e}.json").write_text(json.dumps(side))
        report_eps[e] = {
            "status": "built",
            "decode_ok": True,
            "bytes": len(mp3),
            "handstyle_file": f"{e}.mp3",
            "duration_s": 60.0,
            "spoken_chars": 100,
            "spoken_segments": 1,
            "lufs": -16.0,
            "true_peak": -1.5,
        }
    report = {
        "date": DATE,
        "totals": {"episodes": 3, "built": 3, "failed": 0, "duration_s": 180.0, "spoken_chars": 300},
        "render_stats": {"unique_fragments": 3, "rendered": 3, "cache_hits": 0, "failures": 0},
        "episodes": report_eps,
        "flags": [],
    }
    (rd / "report.json").write_text(json.dumps(report))
    (rd / "script-clean-ep.txt").write_text(CLEAN_SCRIPT)
    (rd / "script-poison-ep.txt").write_text(POISON_SCRIPT)
    # novid-ep deliberately has NO script file.
    return rd


def assert_drop(fx: Fixture, base: str, original_feed: str, label: str) -> None:
    feed = fx.feed
    # The namespace declaration stands exactly once on the ROOT TAG
    # (item-level declarations are the standing ET serialization shape,
    # exactly as xmlns:itunes already appears on grafted items).
    root_tag = p2._RSS_ROOT_RE.search(feed).group(0)
    assert root_tag.count("xmlns:podcast") == 1, f"{label}: root namespace count != 1"
    assert f'xmlns:podcast="{p2.PODCAST_NS}"' in root_tag, f"{label}: root namespace URI"
    # Standing items byte-identical, in order, after the new block.
    before_blocks = p2._ITEM_BLOCK_RE.findall(original_feed)
    after_blocks = p2._ITEM_BLOCK_RE.findall(feed)
    assert len(after_blocks) == len(before_blocks) + 3, f"{label}: item count"
    assert after_blocks[3:] == before_blocks, f"{label}: standing items changed"
    # Tag placement: clean tagged; guard + missing untagged.
    root = ET.fromstring(feed)
    items = root.find("channel").findall("item")
    by_enc = {i.find("enclosure").get("url"): i for i in items}
    tag = by_enc[f"{base}/clean-ep.mp3"].find(f"{{{p2.PODCAST_NS}}}transcript")
    assert tag is not None, f"{label}: clean-ep tag missing"
    assert tag.get("url") == f"{base}/clean-ep.txt", f"{label}: clean-ep tag url"
    assert tag.get("type") == "text/plain", f"{label}: clean-ep tag type"
    for e in ("poison-ep", "novid-ep"):
        assert by_enc[f"{base}/{e}.mp3"].find(f"{{{p2.PODCAST_NS}}}transcript") is None, (
            f"{label}: {e} must carry no tag"
        )
    # Bucket: only the clean transcript, byte-exact under the T1 rule.
    assert fx.bucket.get("clean-ep.txt") == CLEAN_PUBLISHED.encode("utf-8"), (
        f"{label}: clean-ep.txt bytes"
    )
    assert "poison-ep.txt" not in fx.bucket, f"{label}: poison-ep.txt must not upload"
    assert "novid-ep.txt" not in fx.bucket, f"{label}: novid-ep.txt must not upload"


def fixture_a(tmp: Path):
    print("— Fixture A: publish_drop end to end")
    fx = Fixture()
    server = start_server(fx)
    base = f"http://127.0.0.1:{server.server_address[1]}"
    fx.feed = fixture_feed(base)
    original_feed = fx.feed
    ledger = tmp / "ledger.json"
    install(fx, base, ledger)
    rd = build_rundir(tmp)
    report = json.loads((rd / "report.json").read_text())
    result = p2.publish_drop(rd, report)
    assert result["skipped"] is False
    assert result["transcripts"]["field"] == EXPECTED_FIELD, result["transcripts"]["field"]
    missing = result["transcripts"]["missing"]
    assert [m["episode_id"] for m in missing] == ["poison-ep", "novid-ep"], missing
    assert "guard" in missing[0]["reason"], missing[0]["reason"]
    assert_drop(fx, base, original_feed, "A")
    # The transcript fetch against the local stand-in host, directly.
    with urllib.request.urlopen(f"{base}/clean-ep.txt", timeout=10) as resp:
        assert resp.status == 200
        assert resp.read() == CLEAN_PUBLISHED.encode("utf-8")
    led = json.loads(ledger.read_text())
    assert led[DATE]["status"] == "published", "A: ledger not flipped"
    print("  A OK — upload + tag + guard named + byte-identity + fetch + field")
    return fx, rd, ledger


def fixture_b(fx: Fixture, rd: Path, ledger: Path) -> None:
    print("— Fixture B: second reconcile run changes nothing")
    bucket_before = dict(fx.bucket)
    feed_before = fx.feed
    ledger_before = ledger.read_text()
    commits_before = fx.commit_count
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        rc = p2.reconcile_drop(rd, ledger)
    assert rc == 0, f"B: reconcile rc={rc}"
    assert "already complete" in out.getvalue(), out.getvalue()
    assert fx.bucket == bucket_before, "B: bucket changed"
    assert fx.feed == feed_before, "B: feed changed"
    assert ledger.read_text() == ledger_before, "B: ledger changed"
    assert fx.commit_count == commits_before, "B: a new commit was made"
    print("  B OK — already complete, zero changes")


def fixture_c(tmp: Path) -> None:
    print("— Fixture C: reconcile_drop completes the tail from scratch")
    fx = Fixture()
    server = start_server(fx)
    base = f"http://127.0.0.1:{server.server_address[1]}"
    fx.feed = fixture_feed(base)
    original_feed = fx.feed
    ledger = tmp / "ledger.json"
    install(fx, base, ledger)
    rd = build_rundir(tmp)
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        rc = p2.reconcile_drop(rd, ledger)
    text = out.getvalue()
    assert rc == 0, f"C: reconcile rc={rc}\n{text}"
    assert EXPECTED_FIELD in text, f"C: field missing from reconcile output\n{text}"
    assert_drop(fx, base, original_feed, "C")
    led = json.loads(ledger.read_text())
    assert led[DATE]["status"] == "published", "C: ledger not flipped"
    print("  C OK — tail completed, same transcript properties + field")


def main() -> int:
    with tempfile.TemporaryDirectory() as td:
        fx, rd, ledger = fixture_a(Path(td))
        fixture_b(fx, rd, ledger)
    with tempfile.TemporaryDirectory() as td:
        fixture_c(Path(td))
    print("v318 transcript fixture: ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
