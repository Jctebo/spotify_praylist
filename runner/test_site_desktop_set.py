#!/usr/bin/env python3
"""Simulation test for the v554 whole-set extension in site_desktop.py.

Covers phone_set_members() — the set enumeration and fixed role
assignment — with the Drive reads (wallpaper_rotate.list_queue /
list_children) replaced by in-memory listings. No downloads, no
composition: the member/role contract only.

  A. Standard day (2026-11-20 shape): pick + gospel + monthly.
  B. Two-saint day (2026-11-16 shape): the second saint is an extra
     member with a subject-named asset (Q2 B — every image).
  C. Saintless day (2026-11-15 shape): the pick IS the Gospel
     member; its assets carry both the pick and gospel paths.
  D. v416 exclusion: a daily-stamped copy of the monthly subject is
     not a set member; the monthly file is the subject's one picture.
  E. Feast day (2026-11-18 shape): two non-saint daily members —
     gospel_ambiguous, each takes its subject name, the gospel role
     asset is used by nobody.
  F. Missing monthly: monthly_missing, daily members stand.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import wallpaper_rotate as wr  # noqa: E402
import site_desktop as sd  # noqa: E402

OK = 0
NOT_OK = 0


def check(label: str, cond: bool) -> None:
    global OK, NOT_OK
    if cond:
        OK += 1
        print(f"ok {label}")
    else:
        NOT_OK += 1
        print(f"not-ok {label}")


def item(name: str) -> dict:
    return {"id": f"fake-{name}", "name": name, "mimeType": "image/jpeg"}


def run_case(queue: list[str], current: list[str], staged: list[str],
             date_iso: str, pick: str) -> dict:
    listings = {
        wr.FOLDERS["phone-current"]: [item(n) for n in current],
        wr.FOLDERS["monthly-phone"]: [item(n) for n in staged],
    }
    orig_queue, orig_children = wr.list_queue, wr.list_children
    wr.list_queue = lambda variant: [item(n) for n in queue]  # noqa: E731
    wr.list_children = lambda folder_id: listings.get(folder_id, [])  # noqa: E731
    try:
        return sd.phone_set_members(date_iso, pick)
    finally:
        wr.list_queue, wr.list_children = orig_queue, orig_children


def by_role(plan: dict) -> dict:
    return {m["role"]: m for m in plan["members"]}


# A — standard day
plan = run_case(
    [], ["saint-felix-de-valois__2026-11-20.jpg",
         "jesus-cleanses-the-temple__2026-11-20.jpg",
         "holy-souls-in-purgatory__2026-11.jpg"],
    [], "2026-11-20", "saint-felix-de-valois__2026-11-20.jpg")
roles = by_role(plan)
check("A roles are pick+gospel+monthly",
      [m["role"] for m in plan["members"]] == ["pick", "gospel", "monthly"])
check("A pick asset unchanged", roles["pick"]["assets"] == [sd.ASSET_PATH])
check("A pick local unchanged",
      roles["pick"]["local_name"] == "desktop-wallpaper-2026-11-20.jpg")
check("A gospel asset", roles["gospel"]["assets"] == [sd.ASSET_GOSPEL_PATH])
check("A gospel source", roles["gospel"]["source_name"] ==
      "jesus-cleanses-the-temple__2026-11-20.jpg")
check("A gospel local", roles["gospel"]["local_name"] ==
      "desktop-wallpaper-gospel-2026-11-20.jpg")
check("A monthly asset", roles["monthly"]["assets"] == [sd.ASSET_MONTHLY_PATH])
check("A monthly local", roles["monthly"]["local_name"] ==
      "desktop-wallpaper-monthly-2026-11.jpg")
check("A no flags", not plan["monthly_missing"] and not plan["gospel_ambiguous"])

# B — two-saint day
plan = run_case(
    [], ["saint-gertrude__2026-11-16.jpg",
         "saint-margaret-of-scotland__2026-11-16.jpg",
         "the-blind-man-at-jericho__2026-11-16.jpg",
         "holy-souls-in-purgatory__2026-11.jpg"],
    [], "2026-11-16", "saint-gertrude__2026-11-16.jpg")
extras = [m for m in plan["members"] if m["role"] == "extra"]
check("B four members", len(plan["members"]) == 4)
check("B gospel is the scene", by_role(plan)["gospel"]["source_name"] ==
      "the-blind-man-at-jericho__2026-11-16.jpg")
check("B second saint is an extra", len(extras) == 1 and
      extras[0]["source_name"] == "saint-margaret-of-scotland__2026-11-16.jpg")
check("B extra asset is subject-named", extras and extras[0]["assets"] ==
      ["assets/daily-wallpaper-desktop-saint-margaret-of-scotland.jpg"])

# C — saintless day: the pick is the Gospel member
plan = run_case(
    [], ["the-parable-of-the-talents__2026-11-15.jpg",
         "holy-souls-in-purgatory__2026-11.jpg"],
    [], "2026-11-15", "the-parable-of-the-talents__2026-11-15.jpg")
roles = by_role(plan)
check("C members are pick+monthly", sorted(roles) == ["monthly", "pick"])
check("C pick carries both assets",
      roles["pick"]["assets"] == [sd.ASSET_PATH, sd.ASSET_GOSPEL_PATH])

# D — v416 monthly-duplicate exclusion
plan = run_case(
    [], ["holy-souls-in-purgatory__2026-11-04.jpg",
         "saint-charles-borromeo__2026-11-04.jpg",
         "holy-souls-in-purgatory__2026-11.jpg"],
    [], "2026-11-04", "saint-charles-borromeo__2026-11-04.jpg")
sources = [m["source_name"] for m in plan["members"]]
check("D daily duplicate excluded",
      "holy-souls-in-purgatory__2026-11-04.jpg" not in sources)
check("D monthly member stands",
      "holy-souls-in-purgatory__2026-11.jpg" in sources)

# E — feast day: two non-saint daily members
plan = run_case(
    [], ["dedication-of-the-basilicas-of-saints-peter-and-paul__2026-11-18.jpg",
         "saint-rose-philippine-duchesne__2026-11-18.jpg",
         "the-parable-of-the-pounds__2026-11-18.jpg",
         "holy-souls-in-purgatory__2026-11.jpg"],
    [], "2026-11-18", "saint-rose-philippine-duchesne__2026-11-18.jpg")
check("E gospel ambiguous flagged", plan["gospel_ambiguous"])
check("E gospel role asset unused",
      all(sd.ASSET_GOSPEL_PATH not in m["assets"] for m in plan["members"]))
check("E both non-saints are extras", len(
    [m for m in plan["members"] if m["role"] == "extra"]) == 2)

# F — missing monthly
plan = run_case(
    [], ["saint-nicholas__2026-12-05.jpg",
         "jesus-teaches-in-the-temple__2026-12-05.jpg"],
    [], "2026-12-05", "saint-nicholas__2026-12-05.jpg")
check("F monthly missing flagged", plan["monthly_missing"])
check("F daily members stand",
      [m["role"] for m in plan["members"]] == ["pick", "gospel"])

print(f"{OK} ok / {NOT_OK} not-ok")
raise SystemExit(1 if NOT_OK else 0)
