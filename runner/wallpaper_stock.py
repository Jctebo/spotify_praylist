#!/usr/bin/env python3
"""Wallpaper shuffle stocking for the Ora Pro Nobis Muse-run pipeline (v386 §2.2).

The nightly rotation (runner/wallpaper_rotate.py) keeps producing the
images exactly as before. This program is the ADDITIVE stocking step
that runs after the rotation lands (Plan §2.2 P1–P3):

    python3 runner/wallpaper_stock.py --date <RUN_DATE> [--apply]
                                      [--monthly-only] [--drive-only | --backend-only]
                                      [--ledger PATH]

Default is DRY-RUN: the exact copies/uploads/posts are printed,
nothing changes. With --apply:

- Drive side (P1 + P2): the day's saint sets standing in the
  <variant>-current folders (and, state-based, EVERY staged monthly
  devotion in monthly-devotions/<variant>) are filed as COPIES into
  the standing shuffle sets (phone-shuffle / watch-shuffle — copies,
  never moves, so the rotation's archive/rename flow can never touch
  a shuffle file), and the ONE accumulating manifest
  manifests/shuffle-manifest.json is updated. Manifest shape is
  §2.2 P2: { "version": 1, "updated": <ISO>, "entries": [ { "name",
  "slug", "date", "variant", "kind", "sha256", "bytes" } ] } —
  append-only by identity (name, variant); a changed source hash
  REPLACES its entry and its shuffle copy (a re-delivery).
- Backend side (P3): every manifest entry whose
  (name, variant, sha256) does not stand in the stocked ledger is
  posted to the app backend's door stock route
  (POST /api/agent/wallpaper/stock — the Worker verifies the body's
  SHA-256 before storing; this program never trusts its own hash
  alone). The ledger (default:
  ~/workspace/goals/saint-of-the-day-picture-rotation/hidden_files/wallpaper-stock-ledger.json)
  records what the backend already holds; the route's own
  idempotence is the backstop, so a lost ledger costs re-posts,
  never wrong state.

The Jul 2027 watch Precious Blood image was never rendered: it is
simply absent from monthly staging, so it is absent here too — no
placeholder, no substitute (P4).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from wallpaper_rotate import FOLDERS, VARIANTS, drive, list_children  # noqa: E402

# .devotional_wallpapers shuffle sets (created 2026-11-12, v386 Implement).
SHUFFLE_FOLDERS = {
    "phone": "1zHbwoyZUHmWCsMKQREY6L3JtVFofvt-h",
    "watch": "1Sat_6r6Er59XBJHxHT7qCT5FnFC0zEOE",
}
MANIFEST_NAME = "shuffle-manifest.json"
NAME_RE = re.compile(r"^([a-z0-9]+(?:-[a-z0-9]+)*)__(\d{4}-\d{2}-\d{2}|\d{4}-\d{2})\.jpg$", re.I)
APP_BASE = "https://ora-pro-nobis-app.john-thibeaux.workers.dev"
TOKEN_FILE = Path.home() / "workspace/.tools/prayer-app.dev.vars"
CF_TOKEN_FILE = Path.home() / "workspace/custom-connectors/custom.cloudflare/service-token.json"
DEFAULT_LEDGER = (Path.home() / "workspace/goals/saint-of-the-day-picture-rotation"
                  / "hidden_files/wallpaper-stock-ledger.json")


def parse_name(name: str) -> tuple[str, str, str] | None:
    """(slug, date, kind) for a production wallpaper name, or None."""
    m = NAME_RE.match(name)
    if not m:
        return None
    return m.group(1), m.group(2), ("saint" if len(m.group(2)) == 10 else "monthly")


def download_bytes(file_id: str, tmpdir: Path) -> bytes:
    out = tmpdir / f"{file_id}.jpg"
    drive("files", "get", "--params",
          json.dumps({"fileId": file_id, "alt": "media"}), "--output", str(out))
    return out.read_bytes()


def copy_into(file_id: str, name: str, folder_id: str) -> str:
    payload = drive("files", "copy",
                    "--params", json.dumps({"fileId": file_id, "ignoreDefaultVisibility": True}),
                    "--json", json.dumps({"name": name, "parents": [folder_id]}))
    return payload["id"]


def trash(file_id: str) -> None:
    drive("files", "update", "--params", json.dumps({"fileId": file_id}),
          "--json", json.dumps({"trashed": True}))


def read_drive_manifest(tmpdir: Path) -> tuple[dict[str, Any], str | None]:
    """The accumulating manifest as it stands in Drive, plus its file id.

    Read through stdout, NOT download_bytes: the Drive CLI prints a
    .json file's content to stdout and writes an EMPTY file to
    --output (it treats JSON as a readable document; JPEG bytes do
    land in the output file, which is why the image path works)."""
    for f in list_children(FOLDERS["manifests"]):
        if f["name"] == MANIFEST_NAME:
            manifest = drive("files", "get", "--params",
                             json.dumps({"fileId": f["id"], "alt": "media"}))
            if not isinstance(manifest, dict) or not isinstance(manifest.get("entries"), list):
                raise RuntimeError("shuffle-manifest.json in Drive is not the expected shape")
            return manifest, f["id"]
    return {"version": 1, "updated": None, "entries": []}, None


def write_drive_manifest(manifest: dict[str, Any], existing_id: str | None,
                         tmpdir: Path) -> None:
    local = tmpdir / MANIFEST_NAME
    local.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if existing_id:
        drive("files", "update", "--params", json.dumps({"fileId": existing_id}),
              "--upload", str(local))
    else:
        drive("+upload", str(local), "--parent", FOLDERS["manifests"], "--name", MANIFEST_NAME)


def candidates(date: str, monthly_only: bool) -> list[dict[str, Any]]:
    """Source files to stock: staged monthly devotions (all, state-based)
    plus — unless --monthly-only — the given date's saint sets standing
    in the current folders."""
    found: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for variant in VARIANTS:
        # Monthly devotions: the staging folders hold every month's
        # file EXCEPT the live month's — the rotation MOVES that one
        # into <variant>-current. The full staged set is staging ∪
        # the monthly file standing in current.
        for folder in (FOLDERS[f"monthly-{variant}"], FOLDERS[f"{variant}-current"]):
            for f in list_children(folder):
                p = parse_name(f["name"])
                if p and p[2] == "monthly" and (f["name"], variant) not in seen:
                    seen.add((f["name"], variant))
                    found.append({"id": f["id"], "name": f["name"], "variant": variant,
                                  "slug": p[0], "date": p[1], "kind": "monthly"})
        if not monthly_only:
            stamp = re.compile(rf"__{re.escape(date)}\.jpg$", re.I)
            for f in list_children(FOLDERS[f"{variant}-current"]):
                p = parse_name(f["name"])
                if p and p[2] == "saint" and stamp.search(f["name"]):
                    found.append({"id": f["id"], "name": f["name"], "variant": variant,
                                  "slug": p[0], "date": p[1], "kind": "saint"})
    return sorted(found, key=lambda c: (c["variant"], c["name"]))


def stock_drive(date: str, monthly_only: bool, apply: bool, tmpdir: Path) -> dict[str, Any]:
    manifest, manifest_id = read_drive_manifest(tmpdir)
    by_key = {(e["name"], e["variant"]): e for e in manifest["entries"]}
    shuffle = {v: {f["name"]: f for f in list_children(SHUFFLE_FOLDERS[v])} for v in VARIANTS}
    actions: list[str] = []
    changed = False
    for cand in candidates(date, monthly_only):
        data = download_bytes(cand["id"], tmpdir)
        sha = hashlib.sha256(data).hexdigest()
        entry = {"name": cand["name"], "slug": cand["slug"], "date": cand["date"],
                 "variant": cand["variant"], "kind": cand["kind"],
                 "sha256": sha, "bytes": len(data)}
        key = (cand["name"], cand["variant"])
        held = shuffle[cand["variant"]].get(cand["name"])
        if by_key.get(key, {}).get("sha256") == sha and held:
            actions.append(f"skip {cand['variant']}/{cand['name']} (already stocked)")
            continue
        verb = "restock" if key in by_key else "stock"
        actions.append(f"{verb} {cand['variant']}/{cand['name']} sha256={sha[:12]}… bytes={len(data)}")
        if apply:
            if held:
                trash(held["id"])
            copy_into(cand["id"], cand["name"], SHUFFLE_FOLDERS[cand["variant"]])
            by_key[key] = entry
            changed = True
    if apply and changed:
        import datetime as dt
        manifest["entries"] = sorted(by_key.values(), key=lambda e: (e["variant"], e["name"]))
        manifest["updated"] = dt.datetime.now(dt.timezone.utc).isoformat()
        write_drive_manifest(manifest, manifest_id, tmpdir)
        actions.append(f"manifest updated: {len(manifest['entries'])} entries")
    return {"actions": actions, "entries": len(by_key)}


def _app_headers() -> list[str]:
    token = ""
    for line in TOKEN_FILE.read_text().splitlines():
        if line.startswith("AGENT_TOKEN"):
            token = line.split("=", 1)[1].strip().strip('"')
    cf = json.loads(CF_TOKEN_FILE.read_text())
    return ["-H", f"CF-Access-Client-Id: {cf['client_id']}",
            "-H", f"CF-Access-Client-Secret: {cf['client_secret']}",
            "-H", f"Authorization: Bearer {token}"]


def stock_backend(apply: bool, ledger_path: Path, tmpdir: Path) -> dict[str, Any]:
    manifest, _ = read_drive_manifest(tmpdir)
    ledger: dict[str, str] = {}
    if ledger_path.exists():
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    actions: list[str] = []
    # Source bytes for a backend post come from the shuffle copy itself:
    # what the backend holds is byte-identical to what the phone gets.
    shuffle = {v: {f["name"]: f for f in list_children(SHUFFLE_FOLDERS[v])} for v in VARIANTS}
    for entry in manifest["entries"]:
        key = f"{entry['variant']}/{entry['name']}"
        if ledger.get(key) == entry["sha256"]:
            actions.append(f"skip backend {key} (ledger: already stocked)")
            continue
        actions.append(f"post backend {key} sha256={entry['sha256'][:12]}…")
        if not apply:
            continue
        held = shuffle[entry["variant"]].get(entry["name"])
        if not held:
            actions.append(f"  ERROR no shuffle copy stands for {key}; skipped")
            continue
        data = download_bytes(held["id"], tmpdir)
        if hashlib.sha256(data).hexdigest() != entry["sha256"]:
            actions.append(f"  ERROR shuffle copy hash drift for {key}; skipped")
            continue
        q = (f"name={entry['name']}&variant={entry['variant']}"
             f"&kind={entry['kind']}&sha256={entry['sha256']}")
        body_file = tmpdir / f"post-{entry['variant']}-{entry['name']}"
        body_file.write_bytes(data)
        result = subprocess.run(
            ["curl", "-sS", "--max-time", "60", "-X", "POST",
             f"{APP_BASE}/api/agent/wallpaper/stock?{q}",
             *_app_headers(), "-H", "Content-Type: image/jpeg",
             "--data-binary", f"@{body_file}"],
            capture_output=True, text=True, check=False)
        try:
            reply = json.loads(result.stdout or "{}")
        except json.JSONDecodeError:
            reply = {}
        if result.returncode == 0 and reply.get("ok"):
            ledger[key] = entry["sha256"]
            actions.append(f"  stocked (unchanged={reply.get('unchanged')})")
        else:
            actions.append(f"  ERROR backend refused {key}: {str(reply)[:200]}")
    if apply:
        ledger_path.parent.mkdir(parents=True, exist_ok=True)
        ledger_path.write_text(json.dumps(ledger, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {"actions": actions, "ledger": len(ledger)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", required=True, help="Rotation date YYYY-MM-DD (the saint sets)")
    parser.add_argument("--apply", action="store_true", help="Execute (default: dry-run only)")
    parser.add_argument("--monthly-only", action="store_true",
                        help="Stock only the staged monthly devotions (the P4 initial stock)")
    parser.add_argument("--drive-only", action="store_true")
    parser.add_argument("--backend-only", action="store_true")
    parser.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER)
    args = parser.parse_args()
    mode = "APPLY" if args.apply else "DRY-RUN"
    with tempfile.TemporaryDirectory(prefix="wallpaper-stock-") as td:
        tmpdir = Path(td)
        if not args.backend_only:
            out = stock_drive(args.date, args.monthly_only, args.apply, tmpdir)
            print(f"[{mode}] drive stocking for {args.date}:")
            for a in out["actions"]:
                print(f"  {a}")
        if not args.drive_only:
            out = stock_backend(args.apply, args.ledger, tmpdir)
            print(f"[{mode}] backend stocking:")
            for a in out["actions"]:
                print(f"  {a}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
