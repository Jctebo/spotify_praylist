#!/usr/bin/env python3
"""Google Drive wallpaper rotation for the Ora Pro Nobis Muse-run pipeline.

Rotates one date's devotional wallpapers from the Drive queue folders into
the Drive current folders, archiving whatever current holds now:

    python3 runner/wallpaper_rotate.py --date YYYY-MM-DD [--apply] [--rundir DIR]

Default is DRY-RUN: the exact moves are printed, nothing in Drive changes.
With --apply the moves are executed through the Google Drive connector CLI
(/opt/hatch/bin/hatch_gws_cli) and a manifest is uploaded to the manifests
folder as rotation-<date>.json.

Contract (see runner/README-wallpapers.md):
- Production file names only: "<slug>__<YYYY-MM-DD>.jpg" (the "__<date>"
  stamp is how a date's files are found). Variant (phone/watch) is carried
  by the folder, never by the filename.
- Queue layout: files sit directly in phone-queue / watch-queue, or in a
  dated subfolder queue/<YYYY-MM-DD>/ (both are read).
- If the target date's files are missing from either queue, the program
  exits nonzero with status MISSING_QUEUE and makes NO moves. The caller
  (cron agent) then generates the set, uploads it to the queues with
  production names, and re-runs this program.
- Idempotent: if current already holds the date's files and the manifest
  rotation-<date>.json exists, status ALREADY_ROTATED, exit 0, no moves.
- Monthly-devotion extra (added 2026-11-05): beside the daily set, each
  current folder also carries ONE monthly image named
  "<slug>__<YYYY-MM>.jpg" (the month's traditional devotion), staged in
  monthly-devotions/<variant> on Drive. The extra is purely additive and
  state-based: whenever a rotation runs, a current folder that lacks the
  target month's extra gains it from staging, and a previous month's
  extra is archived. The daily rotation proceeds identically with or
  without the extra — a month whose extra is not staged is recorded in
  the manifest as monthly "missing" and never blocks the daily moves.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

DRIVE_CLI = "/opt/hatch/bin/hatch_gws_cli"

# .devotional_wallpapers tree on Google Drive (created 2026-11-03).
# monthly-devotions staging (created 2026-11-05) holds the monthly extras,
# one file per month per variant, named "<slug>__<YYYY-MM>.jpg".
FOLDERS = {
    "root": "1DrN1peGwLz8O8Qzl38_V0L1LV6Yd8fFQ",
    "phone-current": "1_hnPWfMMzmiKA69iMsGYGsviKI1N8nrF",
    "watch-current": "18jAoBLxH_ZfHn-Kz0kd0zalgFrF34Od-",
    "phone-queue": "1r4KubuzXUBDlNJqpD6nx7Di-4w-x264t",
    "watch-queue": "1hdgGQ0UTIFklZydZcvF3G4bwlZ8QlNs3",
    "archive": "1zH1eb943aKW7kzrck2IpSt4ytlZ_Cazy",
    "manifests": "183LEoYcNrU0fCF129NQ4-e1klOcshn7l",
    "monthly-root": "1JgGt63u8ny4bY3wt47rnSVmBTN4nJd-X",
    "monthly-phone": "1_xCNj4HfKiU9CyPbSoYobjkpCHbXCbmr",
    "monthly-watch": "1OrOog7pvNkIos8-3GfTy1tjJeI1_Z6AQ",
}
FOLDER_MIME = "application/vnd.google-apps.folder"
IMAGE_EXTS = ("jpg", "jpeg", "png", "webp")
VARIANTS = ("phone", "watch")


def drive(*args: str) -> dict[str, Any]:
    result = subprocess.run(
        [DRIVE_CLI, "drive", *args], capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"drive {' '.join(args[:2])} failed (exit {result.returncode}): "
            f"{(result.stderr or result.stdout or '').strip()[:500]}"
        )
    try:
        return json.loads(result.stdout or "{}")
    except json.JSONDecodeError as exc:
        raise RuntimeError("Drive CLI returned non-JSON output") from exc


def list_children(folder_id: str) -> list[dict[str, Any]]:
    files: list[dict[str, Any]] = []
    page_token: str | None = None
    while True:
        params: dict[str, Any] = {
            "q": f"'{folder_id}' in parents and trashed=false",
            "pageSize": 100,
            "fields": "nextPageToken,files(id,name,mimeType,modifiedTime,size)",
        }
        if page_token:
            params["pageToken"] = page_token
        payload = drive("files", "list", "--params", json.dumps(params))
        files.extend(payload.get("files") or [])
        page_token = payload.get("nextPageToken")
        if not page_token:
            return files


def list_queue(variant: str) -> list[dict[str, Any]]:
    """Queue files for one variant, each tagged with its actual parent id.

    Accepts both the flat layout (files directly in <variant>-queue) and
    the dated-subfolder layout (<variant>-queue/<YYYY-MM-DD>/<file>).
    """
    queue_id = FOLDERS[f"{variant}-queue"]
    found: list[dict[str, Any]] = []
    for item in list_children(queue_id):
        if item.get("mimeType") == FOLDER_MIME:
            for child in list_children(item["id"]):
                if child.get("mimeType") != FOLDER_MIME:
                    found.append({**child, "_parent": item["id"],
                                  "_parent_name": f"{variant}-queue/{item['name']}"})
        else:
            found.append({**item, "_parent": queue_id, "_parent_name": f"{variant}-queue"})
    return found


def stamp_re(date: str) -> re.Pattern[str]:
    return re.compile(rf"__(?:{re.escape(date)})\.(?:{'|'.join(IMAGE_EXTS)})$", re.I)


def monthly_stamp_re(month: str) -> re.Pattern[str]:
    """Match one month's extra name: "<slug>__<YYYY-MM>.<ext>".

    The "." required right after the two month digits is what keeps a
    daily name ("<slug>__<YYYY-MM-DD>.jpg") from ever matching: after its
    month digits comes "-", not ".".
    """
    return re.compile(rf"__(?:{re.escape(month)})\.(?:{'|'.join(IMAGE_EXTS)})$", re.I)


MONTHLY_ANY_RE = re.compile(
    rf"__(\d{{4}}-\d{{2}})\.(?:{'|'.join(IMAGE_EXTS)})$", re.I)


def month_of(name: str) -> str | None:
    """The YYYY-MM stamp of a monthly-extra name, or None for other names."""
    match = MONTHLY_ANY_RE.search(name)
    return match.group(1) if match else None


def subject_of(name: str) -> str:
    return name.split("__", 1)[0]


def archived_name(name: str, taken: set[str], rotation_date: str) -> str:
    """Archive name for a displaced current file; suffix on collision."""
    if name not in taken:
        return name
    stem, dot, ext = name.rpartition(".")
    base = f"{stem}-rotated-{rotation_date}" if dot else f"{name}-rotated-{rotation_date}"
    candidate = f"{base}{dot}{ext}" if dot else base
    counter = 2
    while candidate in taken:
        candidate = f"{base}-{counter}{dot}{ext}" if dot else f"{base}-{counter}"
        counter += 1
    return candidate


def move_file(file_id: str, from_parent: str, to_parent: str) -> None:
    drive(
        "files", "update",
        "--params", json.dumps({"fileId": file_id, "addParents": to_parent,
                                "removeParents": from_parent}),
        "--json", "{}",
    )


def rename_file(file_id: str, new_name: str) -> None:
    drive("files", "update", "--params", json.dumps({"fileId": file_id}),
          "--json", json.dumps({"name": new_name}))


def _monthly_moves(monthly: dict[str, Any], taken: set[str], date: str
                   ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Archive stale monthly extras and promote staged ones.

    `taken` is the archive-name set shared with the daily moves so a
    displaced extra never collides with a displaced daily file.
    """
    archive_moves: list[dict[str, Any]] = []
    promote_moves: list[dict[str, Any]] = []
    for variant in VARIANTS:
        for f in sorted(monthly["stale"][variant], key=lambda x: x["name"]):
            target_name = archived_name(f["name"], taken, date)
            taken.add(target_name)
            archive_moves.append({
                "id": f["id"], "name": f["name"], "variant": variant,
                "from_folder": f"{variant}-current",
                "from_parent": FOLDERS[f"{variant}-current"],
                "to_folder": "archive", "to_parent": FOLDERS["archive"],
                "archived_as": target_name, "monthly": True,
            })
        if monthly["state"][variant] == "would_promote":
            for f in sorted(monthly["staged"][variant], key=lambda x: x["name"]):
                promote_moves.append({
                    "id": f["id"], "name": f["name"], "variant": variant,
                    "from_folder": f"monthly-{variant}",
                    "from_parent": FOLDERS[f"monthly-{variant}"],
                    "to_folder": f"{variant}-current",
                    "to_parent": FOLDERS[f"{variant}-current"],
                    "monthly": True,
                })
    return archive_moves, promote_moves


def plan_rotation(date: str) -> dict[str, Any]:
    """Read Drive state and compute the rotation plan. No writes."""
    today_stamp = stamp_re(date)
    current = {
        variant: list_children(FOLDERS[f"{variant}-current"])
        for variant in VARIANTS
    }
    queue = {variant: list_queue(variant) for variant in VARIANTS}
    queued = {
        variant: [f for f in queue[variant] if today_stamp.search(f["name"])]
        for variant in VARIANTS
    }
    in_current = {
        variant: [f for f in current[variant] if today_stamp.search(f["name"])]
        for variant in VARIANTS
    }
    manifests = list_children(FOLDERS["manifests"])
    manifest_name = f"rotation-{date}.json"
    manifest_exists = any(f["name"] == manifest_name for f in manifests)

    # Monthly-devotion extra state (additive; never gates the daily plan).
    month = date[:7]
    this_month = monthly_stamp_re(month)
    monthly: dict[str, Any] = {
        "month": month,
        "in_current": {
            variant: [f for f in current[variant] if this_month.search(f["name"])]
            for variant in VARIANTS
        },
        "stale": {
            variant: [f for f in current[variant]
                      if (m := month_of(f["name"])) is not None and m != month]
            for variant in VARIANTS
        },
        "staged": {
            variant: [f for f in list_children(FOLDERS[f"monthly-{variant}"])
                      if this_month.search(f["name"])]
            for variant in VARIANTS
        },
    }
    monthly["state"] = {
        variant: ("current" if monthly["in_current"][variant]
                  else "would_promote" if monthly["staged"][variant]
                  else "missing")
        for variant in VARIANTS
    }

    plan: dict[str, Any] = {
        "date": date,
        "manifest_name": manifest_name,
        "manifest_exists": manifest_exists,
        "current": current,
        "queued": queued,
        "in_current": in_current,
        "monthly": monthly,
    }

    # Idempotency first: the date is already live and its manifest is filed.
    # The monthly extra is checked state-wise even here: if the daily set
    # is live but an extra is promotable (or a stale extra lingers), the
    # plan is a monthly-only fix-up rotation instead.
    if all(in_current[v] for v in VARIANTS):
        if (any(monthly["state"][v] == "would_promote" for v in VARIANTS)
                or any(monthly["stale"][v] for v in VARIANTS)):
            taken = {f["name"] for f in list_children(FOLDERS["archive"])}
            m_arch, m_prom = _monthly_moves(monthly, taken, date)
            plan["status"] = "WOULD_ROTATE"
            plan["monthly_fixup"] = manifest_exists
            plan["archive_moves"] = m_arch
            plan["promote_moves"] = m_prom
            return plan
        plan["status"] = ("ALREADY_ROTATED" if manifest_exists
                          else "ALREADY_IN_CURRENT_MANIFEST_MISSING")
        return plan

    # Missing-queue gate: per variant, and per subject within a variant.
    missing: list[str] = []
    for variant in VARIANTS:
        if not queued[variant]:
            missing.append(variant)
    if not missing:
        phone_subjects = {subject_of(f["name"]) for f in queued["phone"]}
        watch_subjects = {subject_of(f["name"]) for f in queued["watch"]}
        for subject in sorted(phone_subjects - watch_subjects):
            missing.append(f"watch:{subject}")
        for subject in sorted(watch_subjects - phone_subjects):
            missing.append(f"phone:{subject}")
    if missing:
        plan["status"] = "MISSING_QUEUE"
        plan["missing"] = missing
        return plan

    # Displaced current files -> archive (names preserved; suffix on collision).
    # Monthly-stamped files are partitioned out of the daily moves: the
    # target month's extra stays, stale extras move via _monthly_moves.
    archive_names = {f["name"] for f in list_children(FOLDERS["archive"])}
    taken = set(archive_names)
    archive_moves: list[dict[str, Any]] = []
    for variant in VARIANTS:
        daily_current = [f for f in current[variant] if month_of(f["name"]) is None]
        for f in sorted(daily_current, key=lambda x: x["name"]):
            target_name = archived_name(f["name"], taken, date)
            taken.add(target_name)
            archive_moves.append({
                "id": f["id"], "name": f["name"], "variant": variant,
                "from_folder": f"{variant}-current",
                "from_parent": FOLDERS[f"{variant}-current"],
                "to_folder": "archive", "to_parent": FOLDERS["archive"],
                "archived_as": target_name,
            })
    promote_moves: list[dict[str, Any]] = []
    for variant in VARIANTS:
        for f in sorted(queued[variant], key=lambda x: x["name"]):
            promote_moves.append({
                "id": f["id"], "name": f["name"], "variant": variant,
                "from_folder": f["_parent_name"], "from_parent": f["_parent"],
                "to_folder": f"{variant}-current",
                "to_parent": FOLDERS[f"{variant}-current"],
            })
    m_arch, m_prom = _monthly_moves(monthly, taken, date)
    plan["status"] = "WOULD_ROTATE"
    plan["archive_moves"] = archive_moves + m_arch
    plan["promote_moves"] = promote_moves + m_prom
    return plan


def build_manifest(date: str, plan: dict[str, Any], rotated_at: str) -> dict[str, Any]:
    monthly = plan.get("monthly") or {}
    m_state = monthly.get("state") or {}

    def monthly_entry(variant: str) -> dict[str, Any]:
        promoted = [m for m in plan.get("promote_moves", [])
                    if m.get("monthly") and m["variant"] == variant]
        if promoted:
            first = promoted[0]
            return {"month": monthly.get("month"), "action": "promoted",
                    "name": first["name"], "id": first["id"]}
        in_current = (monthly.get("in_current") or {}).get(variant) or []
        if in_current:
            first = sorted(in_current, key=lambda x: x["name"])[0]
            return {"month": monthly.get("month"), "action": "already_current",
                    "name": first["name"], "id": first["id"]}
        return {"month": monthly.get("month"),
                "action": m_state.get(variant, "missing"),
                "name": None, "id": None}

    manifest = {
        "schema": 1,
        "date": date,
        "rotated_at": rotated_at,
        "source_folders": {
            "phone_queue": FOLDERS["phone-queue"],
            "watch_queue": FOLDERS["watch-queue"],
            "phone_current": FOLDERS["phone-current"],
            "watch_current": FOLDERS["watch-current"],
            "archive": FOLDERS["archive"],
            "manifests": FOLDERS["manifests"],
            "monthly_phone": FOLDERS["monthly-phone"],
            "monthly_watch": FOLDERS["monthly-watch"],
        },
        "moved_to_archive": [
            {"name": m["name"], "archived_as": m["archived_as"], "id": m["id"],
             "from": m["from_folder"], "to": "archive",
             "monthly": bool(m.get("monthly"))}
            for m in plan.get("archive_moves", [])
        ],
        "moved_to_current": [
            {"name": m["name"], "id": m["id"], "from": m["from_folder"],
             "to": m["to_folder"], "monthly": bool(m.get("monthly"))}
            for m in plan.get("promote_moves", [])
        ],
        "monthly_extras": {variant: monthly_entry(variant) for variant in VARIANTS},
    }
    if plan.get("monthly_fixup"):
        # This manifest replaces the date's earlier one after a monthly-only
        # fix-up run; the daily moves it records are the fix-up's own.
        manifest["monthly_fixup"] = True
    return manifest


def _describe_monthly(plan: dict[str, Any]) -> None:
    monthly = plan.get("monthly")
    if not monthly:
        return
    for variant in VARIANTS:
        state = monthly["state"][variant]
        if state == "current":
            names = ", ".join(sorted(f["name"] for f in monthly["in_current"][variant]))
            print(f"  monthly extra {monthly['month']} [{variant}]: "
                  f"already in current ({names})")
        elif state == "would_promote":
            names = ", ".join(sorted(f["name"] for f in monthly["staged"][variant]))
            print(f"  monthly extra {monthly['month']} [{variant}]: "
                  f"staged ({names}) -> will promote")
        else:
            print(f"  monthly extra {monthly['month']} [{variant}]: NOT staged; "
                  "daily rotation unaffected (stage it in "
                  f"monthly-devotions/{variant} and re-run for a fix-up)")


def describe(plan: dict[str, Any], *, apply: bool) -> None:
    date = plan["date"]
    status = plan["status"]
    mode = "APPLY" if apply else "DRY-RUN"
    print(f"[{mode}] wallpaper rotation for {date}: status={status}")
    if status == "ALREADY_ROTATED":
        for variant in VARIANTS:
            names = [f["name"] for f in plan["in_current"][variant]]
            print(f"  current already holds {variant}: {', '.join(sorted(names))}")
        print(f"  manifest {plan['manifest_name']} already in manifests; no moves.")
        _describe_monthly(plan)
        return
    if status == "ALREADY_IN_CURRENT_MANIFEST_MISSING":
        print("  current already holds this date's files, but no manifest exists;")
        print("  no moves made. File the manifest manually before trusting this date.")
        _describe_monthly(plan)
        return
    if status == "MISSING_QUEUE":
        print(f"  MISSING_QUEUE missing: {', '.join(plan['missing'])}")
        for variant in VARIANTS:
            names = [f["name"] for f in plan["queued"][variant]]
            print(f"  {variant}-queue has for {date}: {', '.join(sorted(names)) or '(none)'}")
        print("  No moves made. Generate the set, upload it to the queue(s) with")
        print("  production names ('<slug>__<YYYY-MM-DD>.jpg'), then re-run.")
        _describe_monthly(plan)
        return
    for m in plan["archive_moves"]:
        suffix = "" if m["archived_as"] == m["name"] else f" (renamed: {m['archived_as']})"
        tag = " (monthly extra)" if m.get("monthly") else ""
        print(f"  MOVE {m['name']} [{m['id']}] {m['from_folder']} -> archive{suffix}{tag}")
    for m in plan["promote_moves"]:
        tag = " (monthly extra)" if m.get("monthly") else ""
        print(f"  MOVE {m['name']} [{m['id']}] {m['from_folder']} -> {m['to_folder']}{tag}")
    _describe_monthly(plan)
    print(f"  WRITE manifest {plan['manifest_name']} -> manifests folder"
          " (local copy kept in --rundir when passed)")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", required=True, help="Target date YYYY-MM-DD")
    parser.add_argument("--apply", action="store_true",
                        help="Execute the moves in Drive (default: dry-run only)")
    parser.add_argument("--rundir", type=Path,
                        help="Run directory; with --apply the manifest JSON is also kept here")
    args = parser.parse_args()
    try:
        if dt.date.fromisoformat(args.date).isoformat() != args.date:
            raise ValueError("noncanonical date")
    except ValueError:
        print("ERROR --date must use YYYY-MM-DD", file=sys.stderr)
        return 2

    try:
        plan = plan_rotation(args.date)
    except RuntimeError as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        print(json.dumps({"status": "ERROR", "date": args.date, "error": str(exc)}))
        return 1

    describe(plan, apply=args.apply)
    status = plan["status"]
    monthly_state = (plan.get("monthly") or {}).get("state") or {}
    if status == "MISSING_QUEUE":
        print(json.dumps({"status": status, "date": args.date,
                          "missing": plan["missing"], "monthly": monthly_state}))
        return 2
    if status in {"ALREADY_ROTATED", "ALREADY_IN_CURRENT_MANIFEST_MISSING"}:
        print(json.dumps({"status": status, "date": args.date,
                          "monthly": monthly_state}))
        return 0
    if not args.apply:
        manifest = build_manifest(
            args.date, plan, dt.datetime.now(dt.timezone.utc).isoformat())
        print("  manifest that WOULD be uploaded:")
        print(json.dumps(manifest, indent=2, sort_keys=True))
        print(json.dumps({"status": "WOULD_ROTATE", "date": args.date,
                          "archive_moves": len(plan["archive_moves"]),
                          "promote_moves": len(plan["promote_moves"]),
                          "monthly": monthly_state}))
        return 0

    # --apply: archive displaced current files, then promote the queue set.
    for m in plan["archive_moves"]:
        move_file(m["id"], m["from_parent"], m["to_parent"])
        if m["archived_as"] != m["name"]:
            rename_file(m["id"], m["archived_as"])
    for m in plan["promote_moves"]:
        move_file(m["id"], m["from_parent"], m["to_parent"])

    rotated_at = dt.datetime.now(dt.timezone.utc).isoformat()
    manifest = build_manifest(args.date, plan, rotated_at)
    local_dir = args.rundir or (Path(__file__).resolve().parent / ".rotation-manifests")
    local_dir.mkdir(parents=True, exist_ok=True)
    local_path = local_dir / plan["manifest_name"]
    local_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n",
                          encoding="utf-8")
    drive("+upload", str(local_path), "--parent", FOLDERS["manifests"],
          "--name", plan["manifest_name"])
    print(f"  manifest uploaded: {plan['manifest_name']} (local copy: {local_path})")
    print(json.dumps({"status": "ROTATED", "date": args.date,
                      "archive_moves": len(plan["archive_moves"]),
                      "promote_moves": len(plan["promote_moves"]),
                      "monthly": monthly_state,
                      "manifest": plan["manifest_name"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
