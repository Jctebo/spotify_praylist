#!/usr/bin/env python3
"""push-leg-v338 — run the REAL standing push helper
(jobs/push_episodes_to_app.py, with the v337 §2.6 placement
replication) against a local harness instance. Identical in shape to
push-leg-v333.py; the helper is loaded from THIS worktree.
Usage: push-leg-v338.py <port> <report.json> <rundir>
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

fork = Path(__file__).resolve().parents[2]
hspec = importlib.util.spec_from_file_location(
    "push_helper", fork / "jobs/push_episodes_to_app.py")
helper = importlib.util.module_from_spec(hspec)
hspec.loader.exec_module(helper)
helper.door = door

sys.argv = ["push_episodes_to_app.py", "--report", report, "--rundir", rundir]
sys.exit(helper.main())
