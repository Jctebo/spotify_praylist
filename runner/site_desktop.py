#!/usr/bin/env python3
"""Site DESKTOP wallpaper for the Ora Pro Nobis Muse-run pipeline (v526).

The desktop variant of the daily-images production (John's direction,
Ora thread, 2026-11-18): a new nightly job that makes the day's image
fit for a wide screen desktop.

    python3 runner/site_desktop.py [--date YYYY-MM-DD] [--apply]
                                   [--out PATH]

Default is LOCAL-ONLY: the day's pick is composed and written to
~/workspace/ora-runner-runs/<date>/desktop-wallpaper-<date>.jpg (or
--out); nothing external changes. With --apply the composition is also
committed to assets/daily-wallpaper-desktop.jpg in
Jctebo/spotify_praylist and the deploy-only Pages workflow is
dispatched, so https://orapronobis.media/assets/daily-wallpaper-desktop.jpg
serves it — the address always carries the CURRENT day's desktop
image, overwritten each night. (The Pages artifact builder stages the
committed asset into the artifact at the same path; the phone
wallpaper rides the twin route through assets/daily-wallpaper.jpg →
images/daily-wallpaper.jpg.)

THE PICK is the site's pick, by construction: the same candidate rule
as pass2_build._site_wallpaper_blob — the target date's stamped phone
files in Drive phone-queue + phone-current, the saint subject first
(slug starts "saint-"/"st-"), else first alphabetically. Same Drive
file the site's square is composed from, every night.

COMPOSITION (the job's own spec): landscape 1920×1080, wide framing,
NO watch clock zone (the clock-zone rule binds watch/phone images
only). The day's portrait phone art stands at full height,
right-of-center, with feathered edges over an extended ground — the
art itself scaled to cover, blurred and darkened, blended over the
site's deep-blue gradient family (#10294d → #0a1c3a → #040b1a, the
_composite_site_square palette) — so the saint subject stays the
clear subject and the frame is filled, never a naive center crop.
The burned-in title at the foot of the phone art stays legible.

A miss (no candidate, download failure) prints a WARN and exits 1 —
never silent, and it never touches the audio publish, the feed, or
the phone/watch wallpaper steps.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import add_repo_paths, ensure_repo_python  # noqa: E402

ensure_repo_python()
add_repo_paths()

import wallpaper_rotate as wr  # noqa: E402

DESKTOP_W, DESKTOP_H = 1920, 1080
ASSET_PATH = "assets/daily-wallpaper-desktop.jpg"
RUNS_ROOT = Path.home() / "workspace" / "ora-runner-runs"


def pick_site_wallpaper(date_iso: str) -> tuple[str, bytes] | None:
    """(production name, raw bytes) of the site's pick for date_iso —
    the identical rule to pass2_build._site_wallpaper_blob."""
    stamp = re.compile(rf"__{re.escape(date_iso)}\.(?:jpg|jpeg|png|webp)$", re.I)
    candidates: dict[str, dict] = {}
    for item in wr.list_queue("phone") + wr.list_children(wr.FOLDERS["phone-current"]):
        name = item.get("name") or ""
        if stamp.search(name) and item.get("mimeType") != wr.FOLDER_MIME:
            candidates[name] = item
    if not candidates:
        print(f"WARN site desktop: no phone file stamped {date_iso} in Drive queue/current")
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
            print(f"WARN site desktop: Drive download failed for {picked}: "
                  f"{(res.stderr or res.stdout)[:200]}")
            return None
        return picked, local.read_bytes()


def composite_desktop(raw: bytes) -> bytes:
    """Compose the day's portrait phone art into a 1920×1080 desktop
    frame: blurred extended ground over the deep-blue gradient, the
    art at full height right-of-center with feathered edges and a
    gentle foot fade. No reserved clock zone anywhere."""
    from io import BytesIO

    from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

    W, H = DESKTOP_W, DESKTOP_H
    top = (16, 41, 77)     # #10294d deep blue
    mid = (10, 28, 58)     # #0a1c3a
    bottom = (4, 11, 26)   # #040b1a near-black blue
    strip = Image.new("RGB", (1, H))
    for y in range(H):
        t = y / (H - 1)
        if t < 0.55:
            a, b, u = top, mid, t / 0.55
        else:
            a, b, u = mid, bottom, (t - 0.55) / 0.45
        strip.putpixel((0, y), tuple(round(a[i] + (b[i] - a[i]) * u) for i in range(3)))
    canvas = strip.resize((W, H))

    art = Image.open(BytesIO(raw)).convert("RGB")

    # Extended ground: the art scaled to cover the wide frame, blurred
    # and darkened, blended over the gradient — the frame's ground is
    # the day's own image, carried wide. The cover crop anchors toward
    # the art's upper third (its lit scene, not the subject's dark
    # midsection) and the blend keeps the deep-blue gradient dominant,
    # so the ground reads as atmosphere, never a second subject.
    cover_scale = max(W / art.width, H / art.height)
    cover = art.resize((round(art.width * cover_scale), round(art.height * cover_scale)))
    cx = (cover.width - W) // 2
    cy = round((cover.height - H) * 0.18)
    cover = cover.crop((cx, cy, cx + W, cy + H))
    cover = cover.filter(ImageFilter.GaussianBlur(56))
    cover = ImageEnhance.Brightness(cover).enhance(0.45)
    canvas = Image.blend(canvas, cover, 0.55)

    # Subject panel: full height, right-of-center (panel center at
    # 63% of the width — desktop composition, clear space to the left).
    panel = art.resize((round(art.width * (H / art.height)), H))
    x0 = round(W * 0.63 - panel.width / 2)
    x0 = max(0, min(x0, W - panel.width))

    # Feathered frame mask (soft edges all round, gentler at the top
    # so the art's head stays crisp — the _composite_site_square idiom).
    m = Image.new("L", panel.size, 0)
    d = ImageDraw.Draw(m)
    d.rectangle([72, 16, panel.width - 72, panel.height], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(36))
    # Foot fade: alpha ramps down over the bottom 18% — the panel
    # grounds into the frame at its foot; the burned-in title sits
    # above the fade's reach and stays legible.
    fade = Image.new("L", panel.size, 255)
    fd = ImageDraw.Draw(fade)
    y_start = int(panel.height * 0.82)
    for y in range(y_start, panel.height):
        v = int(255 * (1 - 0.82 * (y - y_start) / (panel.height - y_start)))
        fd.line([(0, y), (panel.width, y)], fill=v)
    mask = ImageChops.multiply(m, fade)

    canvas.paste(panel, (x0, 0), mask)
    out = BytesIO()
    canvas.save(out, "JPEG", quality=88)
    return out.getvalue()


def publish_desktop(data: bytes, source_name: str, date_iso: str) -> tuple[str, str]:
    """Commit the composition to ASSET_PATH on main in
    Jctebo/spotify_praylist and dispatch the deploy-only workflow —
    the refresh_site_wallpaper route, word for word in shape.
    Returns (commit_sha, deploy_run_url)."""
    import base64

    import pass2_build as p2  # lazy: the module's GitHub/deploy helpers

    blob = p2._gh_request(
        "POST", f"/repos/{p2.GH_REPO}/git/blobs",
        {"content": base64.b64encode(data).decode(), "encoding": "base64"},
    )
    ref = p2._gh_request("GET", f"/repos/{p2.GH_REPO}/git/ref/heads/main")
    head_sha = ref["object"]["sha"]
    head_commit = p2._gh_request("GET", f"/repos/{p2.GH_REPO}/git/commits/{head_sha}")
    tree = p2._gh_request(
        "POST", f"/repos/{p2.GH_REPO}/git/trees",
        {"base_tree": head_commit["tree"]["sha"],
         "tree": [{"path": ASSET_PATH, "mode": "100644", "type": "blob", "sha": blob["sha"]}]},
    )
    commit = p2._gh_request(
        "POST", f"/repos/{p2.GH_REPO}/git/commits",
        {"message": f"Site desktop wallpaper {date_iso}: {source_name}",
         "tree": tree["sha"], "parents": [head_sha]},
    )
    p2._gh_request("PATCH", f"/repos/{p2.GH_REPO}/git/refs/heads/main",
                   {"sha": commit["sha"], "force": False})
    run_url = p2._dispatch_deploy(commit["sha"])
    return commit["sha"], run_url


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", default=None,
                        help="Site date YYYY-MM-DD (default: today, America/Chicago)")
    parser.add_argument("--apply", action="store_true",
                        help="Commit the composition to assets/daily-wallpaper-desktop.jpg "
                             "and dispatch the Pages deploy (default: local file only)")
    parser.add_argument("--out", default=None,
                        help="Local output path (default: the date's run dir)")
    args = parser.parse_args()

    date_iso = args.date or dt.datetime.now(ZoneInfo("America/Chicago")).date().isoformat()
    pick = pick_site_wallpaper(date_iso)
    if not pick:
        print(f"Site desktop for {date_iso}: no candidate — nothing written.")
        return 1
    picked, raw = pick
    data = composite_desktop(raw)

    out = Path(args.out) if args.out else (
        RUNS_ROOT / date_iso / f"desktop-wallpaper-{date_iso}.jpg")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(data)
    from PIL import Image
    with Image.open(out) as im:
        size = im.size
    print(f"Site desktop for {date_iso}: {picked} -> {out} "
          f"({len(data)} bytes, {size[0]}x{size[1]})")

    if args.apply:
        commit_sha, run_url = publish_desktop(data, picked, date_iso)
        print(f"Site desktop deployed: {picked} -> {ASSET_PATH} "
              f"(commit {commit_sha}, run {run_url})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
