#!/usr/bin/env python3
"""app-text-leg-v342.py — harness-v342 leg 11 driver.

Drives the REAL publish-tail transcript path (pass2_build's
_publish_transcripts + the v342 _publish_app_texts leg) against a
fixture rundir. The public-bucket writes are recorded in memory;
the APP-bucket writes land in the candidate instance's LOCAL R2
(wrangler r2 object put --local, the instance's persist dir), so
the harness reads the staged text back through the candidate's
existence-gate route with player_episodes EMPTY.

Usage: app-text-leg-v342.py <port> <persist-dir> <date>
"""
import json
import subprocess
import sys
import tempfile
import types
from pathlib import Path

RUNNER_DIR = Path(__file__).resolve().parent.parent.parent / "runner"
FORK_ROOT = RUNNER_DIR.parent
APP_DIR = FORK_ROOT / "app"
WRANGLER = "/home/hatch/workspace/.tools/wrangler-env/node_modules/.bin/wrangler"
sys.path.insert(0, str(FORK_ROOT))
sys.path.insert(0, str(RUNNER_DIR))

# runner/_common.py stands only in the production checkout
# (untracked); the v318 test's stub pattern pins the repo paths at
# THIS tree when it does not stand beside pass2_build.
try:
    import _common  # noqa: F401
except ImportError:
    _stub = types.ModuleType("_common")
    _stub.FORK = FORK_ROOT
    _stub.FRAGCACHE_DEFAULT = FORK_ROOT / ".fragcache-test"
    _stub.LEDGER_PATH = RUNNER_DIR / ".v342-test-ledger.json"
    _stub.TTS_CLI = ""
    _stub.TTS_SIDECAR = {}
    _stub.add_repo_paths = lambda: sys.path.insert(0, str(FORK_ROOT))
    _stub.ensure_repo_python = lambda: None
    _stub.normalized_tts_text = lambda t: t
    _stub.voice_full = lambda v: v
    sys.modules["_common"] = _stub

import pass2_build as p2  # noqa: E402

PORT, PERSIST, DATE = sys.argv[1], sys.argv[2], sys.argv[3]

rundir = Path(tempfile.mkdtemp(prefix="opn-v342-texts-"))
plan = {"episodes": [
    {"key": "morning-prayer", "episode_id": f"morning-prayer-elevenlabs-{DATE}"},
    {"key": "daily-rosary", "episode_id": f"daily-rosary-{DATE}"},
]}
(rundir / "plan.json").write_text(json.dumps(plan))
(rundir / "script-morning-prayer.txt").write_text("Fixture script for morning prayer.")
(rundir / "script-daily-rosary.txt").write_text("Rosary script <with production markup>.")

public_puts = {}


def fake_cf_r2_put(key, data, ctype, bucket=None):
    if bucket == p2.APP_TEXT_BUCKET:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as f:
            f.write(data)
            tmp = f.name
        r = subprocess.run(
            [WRANGLER, "r2", "object", "put", f"{p2.APP_TEXT_BUCKET}/{key}",
             "--local", "--config", str(APP_DIR / "wrangler.toml"),
             "--persist-to", PERSIST, "--file", tmp],
            cwd=str(APP_DIR), capture_output=True, text=True,
            env={"PATH": "/usr/bin:/bin:/usr/local/bin", "HOME": "/home/hatch", "CLOUDFLARE_API_TOKEN": ""})
        if r.returncode != 0:
            print("wrangler r2 put failed:", r.stdout[-300:], r.stderr[-300:])
            return {"success": False}
        return {"success": True}
    public_puts[key] = bytes(data)
    return {"success": True}


p2._cf_r2_put = fake_cf_r2_put
p2._cf_r2_list = lambda: sorted(public_puts.keys())

tinfo = p2._publish_transcripts(rundir, plan)
res = p2._publish_app_texts(plan, DATE, tinfo)
assert res["uploaded"] == ["morning-prayer"], res
assert res["withheld"] == ["daily-rosary"], res
assert public_puts.get(f"morning-prayer-elevenlabs-{DATE}.txt") == b"Fixture script for morning prayer.\n", public_puts.keys()
print("APP-TEXT-LEG OK")
