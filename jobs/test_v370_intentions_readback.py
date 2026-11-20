#!/usr/bin/env python3
"""Fixture proof for v370 Item 2: the intentions helper's read-back
before MISSING, in jobs/compose_app_audio.py.

Drives the REAL main() in --intros-only --publish-only mode with the
composition seams stubbed (draw, presented tracks, renderer) and
publish_intentions stubbed to raise the exact 2026-11-11 failure
("intentions deploy did not complete within 15 minutes"). The site
fetch is NOT stubbed: PUB_SITE_BASE is retargeted at a local stand-in
host, so the read-back rides the real _pub_site_get opener and the
stand-in records the User-Agent on the wire.

Covers (v370 §2 V3):
  1. Poll-timeout + the fixture feed carries the date's full intro
     set standing -> the field opens "Intentions feed (v342):
     published" with the READ-BACK counts, names the poll timeout as
     a note, and rc carries no publish failure (rc == 0).
  2. Poll-timeout + the fixture feed carries NO items for the date
     -> MISSING prints, naming the publish failure; rc == 1.
  3. The read-back request itself carries the browser UA (header
     captured at the stand-in host) — the read-back target is
     Cloudflare-fronted and must not inherit Item 1's disease.
  4. The read-back fetch itself failing (stand-in answers 500) ->
     MISSING prints naming BOTH the publish failure and the
     read-back failure; rc == 1.

Run with the repo venv python:
  ~/workspace/scratch-daybuild/nv-venv/bin/python jobs/test_v370_intentions_readback.py
"""

from __future__ import annotations

import contextlib
import io
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

JOBS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(JOBS_DIR))

import compose_app_audio as capp  # noqa: E402

DATE = "2027-03-05"
TRACKS = ["morning-prayer", "daily-rosary", "marian-antiphon-angelus"]
POLL_TIMEOUT = "intentions deploy did not complete within 15 minutes"


def fixture_xml(date: str, episode_ids: list[str]) -> str:
    items = "".join(
        f'<item><title>Intention — {e}</title>'
        f'<guid isPermaLink="false">intentions-intro-{e}-{date}</guid>'
        f"<pubDate>Fri, 05 Mar 2027 00:00:00 -0600</pubDate>"
        f"<description>Intention audio.</description>"
        f'<enclosure url="https://audio.invalid/intentions/{date}/intro-{e}.mp3" '
        f'length="10" type="audio/mpeg"/></item>'
        for e in episode_ids)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">\n'
        "<channel>\n<title>Ora Pro Nobis — Intentions</title>\n"
        f"{items}\n</channel>\n</rss>\n")


class StandIn:
    """Serves one fixed body (or one fixed status) and records the
    User-Agent of every request."""

    def __init__(self, body: str = "", status: int = 200) -> None:
        self.body = body
        self.status = status
        self.uas: list[str] = []
        self.paths: list[str] = []

    def start(self) -> str:
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802 - BaseHTTPRequestHandler shape
                outer.uas.append(self.headers.get("User-Agent") or "")
                outer.paths.append(self.path)
                if outer.status != 200:
                    self.send_response(outer.status)
                    self.end_headers()
                    return
                data = outer.body.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        return f"http://127.0.0.1:{server.server_address[1]}"


def run_main(standin: StandIn) -> tuple[int, str]:
    """One stubbed main() run against the stand-in host. The read-
    back's 20 s re-poll spacing is compressed (the estate runs this
    fixture in seconds); every other seam is the module's own."""
    capp.read_draw = lambda date: {capp.OWN_PAIRING[t]: f"intention for {t}" for t in TRACKS}
    capp.presented_tracks = lambda date: (
        list(TRACKS), [], {t: f"Title {t}" for t in TRACKS})

    def fake_render(text, out_path):
        Path(out_path).write_bytes(b"FAKE-MP3")
    capp.render = fake_render

    def raising_publish(date, intro_files, segment_files):
        raise RuntimeError(POLL_TIMEOUT)
    capp.publish_intentions = raising_publish
    capp.PUB_SITE_BASE = standin.start()

    argv = sys.argv
    real_sleep = time.sleep
    sys.argv = ["compose_app_audio.py", "--date", DATE,
                "--intros-only", "--publish-only"]
    time.sleep = lambda s: None  # compress the read-back re-poll only
    out = io.StringIO()
    try:
        with contextlib.redirect_stdout(out):
            rc = capp.main()
    finally:
        sys.argv = argv
        time.sleep = real_sleep
    return rc, out.getvalue()


def field_line(text: str) -> str:
    for line in text.splitlines():
        if line.startswith("Intentions feed (v342):"):
            return line
    raise AssertionError(f"no Intentions field printed:\n{text}")


def case_1() -> None:
    print("— Case 1: poll timeout, full set standing -> published by read-back")
    standin = StandIn(fixture_xml(DATE, TRACKS))
    rc, text = run_main(standin)
    line = field_line(text)
    assert line.startswith("Intentions feed (v342): published"), line
    assert f"intros 3/3 for presented {DATE}" in line, line
    assert "verified standing by live read-back" in line, line
    assert POLL_TIMEOUT in line, line  # the exception is named as a note
    assert rc == 0, f"rc={rc}\n{text}"
    print(f"  1 OK — {line}")
    # Case 3 rides this case's wire record.
    print("— Case 3: the read-back request carries the browser UA")
    assert standin.paths and all(p == "/intentions.xml" for p in standin.paths), standin.paths
    for ua in standin.uas:
        assert ua == capp._PUB_BROWSER_UA, f"read-back UA {ua!r}"
        assert "Python-urllib" not in ua, f"read-back UA {ua!r}"
    print(f"  3 OK — {len(standin.uas)} read-back request(s), all browser UA")


def case_2() -> None:
    print("— Case 2: poll timeout, no items for the date -> MISSING")
    standin = StandIn(fixture_xml("2027-03-04", TRACKS))  # another date only
    rc, text = run_main(standin)
    line = field_line(text)
    assert line.startswith("Intentions feed (v342): MISSING"), line
    assert f"publish failed: {POLL_TIMEOUT}" in line, line
    assert rc == 1, f"rc={rc}\n{text}"
    print(f"  2 OK — {line}")


def case_4() -> None:
    print("— Case 4: read-back fetch fails -> MISSING names both failures")
    standin = StandIn(status=500)
    rc, text = run_main(standin)
    line = field_line(text)
    assert line.startswith("Intentions feed (v342): MISSING"), line
    assert f"publish failed: {POLL_TIMEOUT}" in line, line
    assert "read-back failed:" in line, line
    assert rc == 1, f"rc={rc}\n{text}"
    print(f"  4 OK — {line}")


def main() -> int:
    case_1()
    case_2()
    case_4()
    print("v370 intentions read-back fixture: ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
