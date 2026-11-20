#!/usr/bin/env python3
"""Simulation test for the monthly-devotion extra in wallpaper_rotate.py.

Runs the real rotator against an in-memory fake Drive (the module-level
`drive` function is replaced). Covers:
  A. Nov 8 / Nov 15 / Dec 1 sequence: daily sets rotate every time; the
     monthly extra is promoted on Nov 8, untouched on Nov 15, and swapped
     (old archived, new promoted) on Dec 1.
  B. Fix-up: daily set already live + manifest filed, one variant's extra
     staged later -> monthly-only WOULD_ROTATE, then ALREADY_ROTATED.
  C. A month whose extras are not staged never blocks the daily rotation.
  D. Monthly name matching never confuses daily names.
"""

from __future__ import annotations

import json
import re
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import wallpaper_rotate as wr  # noqa: E402


class FakeDrive:
    def __init__(self) -> None:
        self.files: dict[str, dict] = {}
        self.counter = 0
        for folder_id in wr.FOLDERS.values():
            self.files[folder_id] = {"id": folder_id, "name": folder_id,
                                     "mimeType": wr.FOLDER_MIME, "parents": set()}

    def add(self, name: str, parent: str) -> str:
        self.counter += 1
        fid = f"fake-{self.counter:04d}"
        mime = wr.FOLDER_MIME if name.endswith("/") else "image/jpeg"
        self.files[fid] = {"id": fid, "name": name.rstrip("/"), "mimeType": mime,
                           "parents": {parent}}
        return fid

    def by_name(self, name: str, parent: str) -> dict | None:
        for f in self.files.values():
            if f["name"] == name and parent in f["parents"]:
                return f
        return None

    def names_in(self, parent: str) -> list[str]:
        return sorted(f["name"] for f in self.files.values() if parent in f["parents"])

    def __call__(self, *args: str) -> dict:
        if args[0] == "+upload":
            local, parent, name = args[1], args[3], args[5]
            fid = self.add(name, parent)
            Path(local)  # path must exist per caller contract
            return {"id": fid, "name": name}
        assert args[0] == "files", args
        op = args[1]
        params = json.loads(args[args.index("--params") + 1]) if "--params" in args else {}
        if op == "list":
            parent = re.search(r"'([^']+)' in parents", params["q"]).group(1)
            files = [{"id": f["id"], "name": f["name"], "mimeType": f["mimeType"]}
                     for f in self.files.values() if parent in f["parents"]]
            return {"files": files}
        if op == "update":
            f = self.files[params["fileId"]]
            if params.get("addParents"):
                f["parents"].add(params["addParents"])
            if params.get("removeParents"):
                f["parents"].discard(params["removeParents"])
            if "--json" in args:
                body = json.loads(args[args.index("--json") + 1])
                if body.get("name"):
                    f["name"] = body["name"]
            return {"id": f["id"]}
        raise AssertionError(f"unexpected drive call: {args}")


def seed_daily(fake: FakeDrive, date: str, where: str) -> None:
    for variant in wr.VARIANTS:
        for subject in ("saint-a", "gospel-scene"):
            fake.add(f"{subject}__{date}.jpg", wr.FOLDERS[f"{variant}-{where}"])


def run(fake: FakeDrive, date: str, apply: bool, rundir: Path) -> tuple[int, str]:
    wr.drive = fake  # type: ignore[assignment]
    argv = ["wallpaper_rotate.py", "--date", date, "--rundir", str(rundir)]
    if apply:
        argv.append("--apply")
    old_argv = sys.argv
    sys.argv = argv
    import io
    from contextlib import redirect_stdout
    buf = io.StringIO()
    try:
        with redirect_stdout(buf):
            code = wr.main()
    finally:
        sys.argv = old_argv
    return code, buf.getvalue()


def check(cond: bool, label: str, failures: list[str]) -> None:
    print(("PASS " if cond else "FAIL ") + label)
    if not cond:
        failures.append(label)


def main() -> int:
    failures: list[str] = []
    rundir = Path(tempfile.mkdtemp(prefix="rotation-sim-"))

    # ---- Scenario A: Nov 8 -> Nov 15 -> Dec 1 --------------------------
    fake = FakeDrive()
    seed_daily(fake, "2026-11-07", "current")
    for d in ("2026-11-08", "2026-11-15", "2026-12-01"):
        seed_daily(fake, d, "queue")
    for variant in wr.VARIANTS:
        fake.add("holy-souls-in-purgatory__2026-11.jpg", wr.FOLDERS[f"monthly-{variant}"])
        fake.add("divine-infancy-of-christ__2026-12.jpg", wr.FOLDERS[f"monthly-{variant}"])

    code, out = run(fake, "2026-11-08", apply=True, rundir=rundir)
    check(code == 0 and '"status": "ROTATED"' in out, "A1 Nov 8 rotates", failures)
    for variant in wr.VARIANTS:
        names = fake.names_in(wr.FOLDERS[f"{variant}-current"])
        check("saint-a__2026-11-08.jpg" in names
              and "holy-souls-in-purgatory__2026-11.jpg" in names
              and not any("__2026-11-07" in n for n in names),
              f"A1 {variant}-current = Nov 8 daily + Holy Souls extra", failures)
    nov_extra_ids = {v: fake.by_name("holy-souls-in-purgatory__2026-11.jpg",
                                     wr.FOLDERS[f"{v}-current"])["id"]
                     for v in wr.VARIANTS}

    code, out = run(fake, "2026-11-08", apply=False, rundir=rundir)
    check('"status": "ALREADY_ROTATED"' in out, "A2 Nov 8 re-run is ALREADY_ROTATED", failures)

    code, out = run(fake, "2026-11-15", apply=True, rundir=rundir)
    check(code == 0 and '"status": "ROTATED"' in out, "A3 Nov 15 rotates", failures)
    manifest = json.loads((rundir / "rotation-2026-11-15.json").read_text())
    check(all(not m.get("monthly") for m in manifest["moved_to_archive"] + manifest["moved_to_current"]),
          "A3 Nov 15 manifest records NO monthly moves", failures)
    check(all(manifest["monthly_extras"][v]["action"] == "already_current" for v in wr.VARIANTS),
          "A3 Nov 15 monthly_extras = already_current", failures)
    for variant in wr.VARIANTS:
        cur = fake.by_name("holy-souls-in-purgatory__2026-11.jpg", wr.FOLDERS[f"{variant}-current"])
        check(cur is not None and cur["id"] == nov_extra_ids[variant]
              and "saint-a__2026-11-15.jpg" in fake.names_in(wr.FOLDERS[f"{variant}-current"]),
              f"A3 {variant}: same extra file, daily set is Nov 15", failures)

    code, out = run(fake, "2026-12-01", apply=True, rundir=rundir)
    check(code == 0 and '"status": "ROTATED"' in out, "A4 Dec 1 rotates", failures)
    for variant in wr.VARIANTS:
        names = fake.names_in(wr.FOLDERS[f"{variant}-current"])
        check("divine-infancy-of-christ__2026-12.jpg" in names
              and "holy-souls-in-purgatory__2026-11.jpg" not in names
              and "saint-a__2026-12-01.jpg" in names,
              f"A4 {variant}-current = Dec 1 daily + Divine Infancy extra", failures)
        check(fake.by_name("holy-souls-in-purgatory__2026-11.jpg", wr.FOLDERS["archive"]) is not None,
              f"A4 {variant} November extra archived", failures)
    manifest = json.loads((rundir / "rotation-2026-12-01.json").read_text())
    check(all(manifest["monthly_extras"][v]["action"] == "promoted" for v in wr.VARIANTS),
          "A4 Dec 1 monthly_extras = promoted", failures)

    # ---- Scenario B: monthly-only fix-up --------------------------------
    fake = FakeDrive()
    seed_daily(fake, "2026-11-08", "current")
    fake.add("rotation-2026-11-08.json", wr.FOLDERS["manifests"])
    fake.add("holy-souls-in-purgatory__2026-11.jpg", wr.FOLDERS["monthly-phone"])
    wr.drive = fake  # type: ignore[assignment]
    plan = wr.plan_rotation("2026-11-08")
    check(plan["status"] == "WOULD_ROTATE" and plan["monthly_fixup"] is True
          and all(m.get("monthly") for m in plan["archive_moves"] + plan["promote_moves"]),
          "B1 fix-up plan is monthly-only WOULD_ROTATE", failures)
    code, out = run(fake, "2026-11-08", apply=True, rundir=rundir)
    check(code == 0 and fake.by_name("holy-souls-in-purgatory__2026-11.jpg",
                                     wr.FOLDERS["phone-current"]) is not None
          and fake.by_name("holy-souls-in-purgatory__2026-11.jpg",
                           wr.FOLDERS["watch-current"]) is None,
          "B2 fix-up promotes phone extra; watch extra still missing", failures)
    manifest = json.loads((rundir / "rotation-2026-11-08.json").read_text())
    check(manifest.get("monthly_fixup") is True
          and manifest["monthly_extras"]["watch"]["action"] == "missing",
          "B2 fix-up manifest flags fixup + watch missing", failures)
    fake.add("holy-souls-in-purgatory__2026-11.jpg", wr.FOLDERS["monthly-watch"])
    code, out = run(fake, "2026-11-08", apply=True, rundir=rundir)
    check(fake.by_name("holy-souls-in-purgatory__2026-11.jpg",
                       wr.FOLDERS["watch-current"]) is not None,
          "B3 second fix-up promotes watch extra", failures)
    code, out = run(fake, "2026-11-08", apply=False, rundir=rundir)
    check('"status": "ALREADY_ROTATED"' in out, "B4 converged: ALREADY_ROTATED", failures)

    # ---- Scenario C: unstaged month never blocks the daily rotation -----
    fake = FakeDrive()
    seed_daily(fake, "2026-11-07", "current")
    seed_daily(fake, "2026-11-08", "queue")
    code, out = run(fake, "2026-11-08", apply=True, rundir=rundir)
    check(code == 0 and '"status": "ROTATED"' in out
          and '"phone": "missing"' in out and '"watch": "missing"' in out,
          "C1 daily rotation proceeds with extras unstaged", failures)
    manifest = json.loads((rundir / "rotation-2026-11-08.json").read_text())
    check(all(manifest["monthly_extras"][v]["action"] == "missing" for v in wr.VARIANTS),
          "C1 manifest records monthly missing for both variants", failures)

    # ---- Scenario D: name matching --------------------------------------
    check(wr.month_of("saint-a__2026-11-08.jpg") is None
          and wr.month_of("holy-souls-in-purgatory__2026-11.jpg") == "2026-11"
          and not wr.monthly_stamp_re("2026-11").search("saint-a__2026-11-08.jpg")
          and wr.monthly_stamp_re("2026-11").search("holy-souls-in-purgatory__2026-11.jpg"),
          "D1 monthly patterns never match daily names", failures)

    print(f"\n{'ALL CHECKS PASSED' if not failures else 'FAILURES: ' + str(failures)}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
