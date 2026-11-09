#!/usr/bin/env python3
"""push-leg-v327 — run the REAL standing push helper (jobs/push_episodes_to_app.py,
unmodified) against a local harness instance, with the real 2026-11-08 manifest.

The helper binds its prayer_door at import from ~/workspace/.tools; this
driver rebinds the helper module's `door` global to the same door module
repointed at the local instance (BASE + token) before calling main().
The helper code itself is never edited.
Usage: push-leg-v327.py <port> <report.json> <rundir>
"""
import importlib.util
import sys
from pathlib import Path

port, report, rundir = sys.argv[1], sys.argv[2], sys.argv[3]

spec = importlib.util.spec_from_file_location(
    "prayer_door", Path.home() / "workspace/.tools/prayer_door.py")
door = importlib.util.module_from_spec(spec)
spec.loader.exec_module(door)
door.BASE = f"http://127.0.0.1:{port}"
door._app_token = lambda: "harness-token"
door._cf = lambda: ("harness", "harness")

fork = Path.home() / "workspace/.worktrees/v327"
hspec = importlib.util.spec_from_file_location(
    "push_helper", fork / "jobs/push_episodes_to_app.py")
helper = importlib.util.module_from_spec(hspec)
hspec.loader.exec_module(helper)
helper.door = door

sys.argv = ["push_episodes_to_app.py", "--report", report, "--rundir", rundir]
sys.exit(helper.main())
