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

COMPOSITION (v526 spec, revised v535): landscape 1920×1080, wide
framing, NO watch clock zone (the clock-zone rule binds watch/phone
images only). The day's portrait phone art stands at full height,
right-of-center, with feathered edges, over a full-bleed ground that
is the art itself — cover-scaled across the whole frame, heavily
blurred so no second subject forms, at its own full brightness and
color, with NO added gradient and NO darkening — so the painting's
own background and light paint the frame edge to edge and the saint
subject stays the clear subject; never a naive center crop. (v526's
ground — the cover layer darkened to 0.45 and blended 0.55 over the
deep-blue gradient family — read as the art standing in dark space;
John's field feedback, 2026-11-18: "Wide images should paint more
of the background." v535 removes the gradient and the darkening.)
The burned-in title at the foot of the phone art stays legible.

A miss (no candidate, download failure) prints a WARN and exits 1 —
never silent, and it never touches the audio publish, the feed, or
the phone/watch wallpaper steps.

THE WHOLE SET (v554, John's approval 2026-11-20 — Q1 A separate wide
files, each named and standing · Q2 B EVERY image in the day's phone
set gets a wide version · Q3 A fixed role names): the step now
composes a wide version for every member of the day's phone set, not
only the pick. The set is enumerated from the pick's own candidate
pool (phone-queue + phone-current, date-stamped, deduped by name),
under the rotator's standing rules: the daily members are the day's
stamped subjects (one Gospel scene + the saint/devotion subjects),
the monthly member is the month's extra standing in phone-current,
and a daily-stamped file whose subject equals the monthly extra's
subject is the v416 private-devotion duplicate — excluded, the
monthly file being the set's one picture for that subject. Fixed
asset names: the pick keeps assets/daily-wallpaper-desktop.jpg
(unchanged); the Gospel member (the day's non-saint daily member,
when exactly one stands) publishes as
assets/daily-wallpaper-desktop-gospel.jpg; the monthly member as
assets/daily-wallpaper-desktop-monthly.jpg; every further member as
assets/daily-wallpaper-desktop-<subject-slug>.jpg. On a saintless
day the Gospel member IS the pick and its composition publishes to
both the pick and gospel assets. On a day with more than one
non-saint daily member (a feast image beside the Gospel scene) no
filename signal separates them, so each takes its subject name and
the run WARNs the ambiguity. With --apply all composed members
publish in ONE commit and one deploy dispatch. Failure posture is
the step's standing rule, extended: a miss on any one member WARNs
and never blocks the others or the pick publish; a miss on the pick
keeps the standing behavior — WARN, exit 1, nothing published.
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
ASSET_GOSPEL_PATH = "assets/daily-wallpaper-desktop-gospel.jpg"
ASSET_MONTHLY_PATH = "assets/daily-wallpaper-desktop-monthly.jpg"
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


def _download_drive_file(item: dict, name: str) -> bytes | None:
    """Raw bytes of one Drive file — the pick's download route, word
    for word in shape (v554: shared by every non-pick set member)."""
    suffix = Path(name).suffix.lower() or ".jpg"
    with tempfile.TemporaryDirectory() as td:
        local = Path(td) / f"wallpaper{suffix}"
        res = subprocess.run(
            [wr.DRIVE_CLI, "drive", "files", "get",
             "--params", json.dumps({"fileId": item["id"], "alt": "media"}),
             "--output", str(local)],
            capture_output=True, text=True,
        )
        if res.returncode != 0 or not local.exists() or local.stat().st_size == 0:
            print(f"WARN site desktop: Drive download failed for {name}: "
                  f"{(res.stderr or res.stdout)[:200]}")
            return None
        return local.read_bytes()


def _is_saint_subject(subject: str) -> bool:
    return subject.startswith(("saint-", "st-"))


def phone_set_members(date_iso: str, pick_name: str) -> dict:
    """The day's phone set as an ordered member list (v554).

    Returns {"members": [...], "monthly_missing": bool,
    "gospel_ambiguous": bool}. Each member: {"role", "source_name",
    "item", "assets", "local_name"} — role in pick · gospel ·
    monthly · extra; assets are the served paths its one composition
    publishes to (two for the saintless-day pick, which is also the
    Gospel member). Enumeration mirrors the rotator's rules from the
    pick's own candidate pool; see the module docstring.
    """
    stamp = re.compile(rf"__{re.escape(date_iso)}\.(?:jpg|jpeg|png|webp)$", re.I)
    pool: dict[str, dict] = {}
    for item in wr.list_queue("phone") + wr.list_children(wr.FOLDERS["phone-current"]):
        name = item.get("name") or ""
        if stamp.search(name) and item.get("mimeType") != wr.FOLDER_MIME:
            pool[name] = item

    # Monthly member: the month's extra standing in phone-current,
    # else the staged file in monthly-devotions/phone.
    month = date_iso[:7]
    mstamp = wr.monthly_stamp_re(month)
    current = wr.list_children(wr.FOLDERS["phone-current"])
    staged = wr.list_children(wr.FOLDERS["monthly-phone"])
    monthly_item = None
    for item in sorted(current, key=lambda x: x.get("name") or ""):
        if mstamp.search(item.get("name") or "") and item.get("mimeType") != wr.FOLDER_MIME:
            monthly_item = item
            break
    if monthly_item is None:
        for item in sorted(staged, key=lambda x: x.get("name") or ""):
            if mstamp.search(item.get("name") or "") and item.get("mimeType") != wr.FOLDER_MIME:
                monthly_item = item
                break
    # v416 one-picture-per-subject: the monthly subjects (extra in
    # current or staged) exclude their daily-stamped duplicates.
    monthly_subjects = {
        wr.subject_of(i.get("name") or "")
        for i in current + staged
        if wr.month_of(i.get("name") or "") is not None
    }

    daily = {
        name: item for name, item in pool.items()
        if wr.subject_of(name) not in monthly_subjects
    }

    members: list[dict] = []
    pick_member = {
        "role": "pick", "source_name": pick_name, "item": daily.get(pick_name),
        "assets": [ASSET_PATH], "local_name": f"desktop-wallpaper-{date_iso}.jpg",
    }
    members.append(pick_member)

    others = sorted(n for n in daily if n != pick_name)
    non_saints = [n for n in others if not _is_saint_subject(wr.subject_of(n))]
    gospel_ambiguous = False
    gospel_name = None
    if len(non_saints) == 1:
        gospel_name = non_saints[0]
    elif len(non_saints) > 1:
        gospel_ambiguous = True
    if pick_name not in daily or not _is_saint_subject(wr.subject_of(pick_name)):
        # The pick itself is a non-saint member: when it is the day's
        # only non-saint member it is the Gospel member too (the
        # saintless day), and its composition serves both assets.
        pick_non_saints = [n for n in daily
                           if not _is_saint_subject(wr.subject_of(n))]
        if len(pick_non_saints) == 1 and pick_non_saints[0] == pick_name:
            gospel_name = pick_name
            pick_member["assets"] = [ASSET_PATH, ASSET_GOSPEL_PATH]
        elif len(pick_non_saints) > 1:
            gospel_ambiguous = True

    if gospel_name is not None and gospel_name != pick_name:
        members.append({
            "role": "gospel", "source_name": gospel_name,
            "item": daily[gospel_name], "assets": [ASSET_GOSPEL_PATH],
            "local_name": f"desktop-wallpaper-gospel-{date_iso}.jpg",
        })
    if monthly_item is not None:
        members.append({
            "role": "monthly", "source_name": monthly_item.get("name") or "",
            "item": monthly_item, "assets": [ASSET_MONTHLY_PATH],
            "local_name": f"desktop-wallpaper-monthly-{month}.jpg",
        })
    named = {pick_name} | ({gospel_name} if gospel_name else set())
    for name in others:
        if name in named:
            continue
        subject = wr.subject_of(name)
        members.append({
            "role": "extra", "source_name": name, "item": daily[name],
            "assets": [f"assets/daily-wallpaper-desktop-{subject}.jpg"],
            "local_name": f"desktop-wallpaper-{subject}-{date_iso}.jpg",
        })
    return {"members": members,
            "monthly_missing": monthly_item is None,
            "gospel_ambiguous": gospel_ambiguous}


def composite_desktop(raw: bytes) -> bytes:
    """Compose the day's portrait phone art into a 1920×1080 desktop
    frame: a full-bleed ground of the art itself at full brightness
    (v535), the art at full height right-of-center with feathered
    edges and a gentle foot fade. No reserved clock zone anywhere."""
    from io import BytesIO

    from PIL import Image, ImageChops, ImageDraw, ImageFilter

    W, H = DESKTOP_W, DESKTOP_H
    art = Image.open(BytesIO(raw)).convert("RGB")

    # Full-bleed ground (v535): the art cover-scaled across the whole
    # wide frame, heavily blurred so no second subject forms, at its
    # OWN full brightness and color — no gradient under it, no
    # darkening, no blend. The frame is painted by the day's own
    # background and light, edge to edge. The cover crop anchors
    # toward the art's upper third (its lit scene). v526 darkened
    # this layer to 0.45 and blended it over a deep-blue gradient;
    # the gradient dominated and the frame read as dark space.
    cover_scale = max(W / art.width, H / art.height)
    cover = art.resize((round(art.width * cover_scale), round(art.height * cover_scale)))
    cx = (cover.width - W) // 2
    cy = round((cover.height - H) * 0.18)
    cover = cover.crop((cx, cy, cx + W, cy + H))
    canvas = cover.filter(ImageFilter.GaussianBlur(56))

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


def publish_desktop_set(files: list[tuple[str, bytes]],
                        date_iso: str) -> tuple[str, str]:
    """Commit every (asset path, composition) in `files` to main in
    Jctebo/spotify_praylist in ONE commit and dispatch the deploy-only
    workflow once — the refresh_site_wallpaper route, word for word
    in shape (v554: the whole wide set rides one commit, the pick's
    asset among them). Returns (commit_sha, deploy_run_url)."""
    import base64

    import pass2_build as p2  # lazy: the module's GitHub/deploy helpers

    tree_entries = []
    for asset_path, data in files:
        blob = p2._gh_request(
            "POST", f"/repos/{p2.GH_REPO}/git/blobs",
            {"content": base64.b64encode(data).decode(), "encoding": "base64"},
        )
        tree_entries.append({"path": asset_path, "mode": "100644",
                             "type": "blob", "sha": blob["sha"]})
    ref = p2._gh_request("GET", f"/repos/{p2.GH_REPO}/git/ref/heads/main")
    head_sha = ref["object"]["sha"]
    head_commit = p2._gh_request("GET", f"/repos/{p2.GH_REPO}/git/commits/{head_sha}")
    tree = p2._gh_request(
        "POST", f"/repos/{p2.GH_REPO}/git/trees",
        {"base_tree": head_commit["tree"]["sha"], "tree": tree_entries},
    )
    names = ", ".join(path.rsplit("/", 1)[-1] for path, _ in files)
    commit = p2._gh_request(
        "POST", f"/repos/{p2.GH_REPO}/git/commits",
        {"message": f"Site desktop wallpapers {date_iso}: {names}",
         "tree": tree["sha"], "parents": [head_sha]},
    )
    p2._gh_request("PATCH", f"/repos/{p2.GH_REPO}/git/refs/heads/main",
                   {"sha": commit["sha"], "force": False})
    run_url = p2._dispatch_deploy(commit["sha"])
    return commit["sha"], run_url


def publish_desktop(data: bytes, source_name: str, date_iso: str) -> tuple[str, str]:
    """The standing single-file publish (v526 shape), kept for
    callers that hold one composition: the pick alone, committed to
    ASSET_PATH with the standing message."""
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
                        help="Commit every composed set member to its asset "
                             "(the pick to assets/daily-wallpaper-desktop.jpg) "
                             "in one commit and dispatch the Pages deploy "
                             "(default: local files only)")
    parser.add_argument("--out", default=None,
                        help="Local output path (default: the date's run dir)")
    args = parser.parse_args()

    date_iso = args.date or dt.datetime.now(ZoneInfo("America/Chicago")).date().isoformat()
    pick = pick_site_wallpaper(date_iso)
    if not pick:
        print(f"Site desktop for {date_iso}: no candidate — nothing written.")
        return 1
    picked, pick_raw = pick

    # The whole phone set (v554). Enumeration failure falls back to
    # the pick alone — it never blocks the pick's standing publish.
    try:
        plan = phone_set_members(date_iso, picked)
        members = plan["members"]
        if plan["monthly_missing"]:
            print(f"WARN site desktop: no monthly extra for {date_iso[:7]} "
                  "in phone-current or staging — monthly wide skipped")
        if plan["gospel_ambiguous"]:
            print(f"WARN site desktop: more than one non-saint daily member "
                  f"for {date_iso} — no filename signal separates the Gospel "
                  "scene; each publishes under its subject name and the "
                  "gospel role name is not used today")
    except Exception as exc:  # Drive read failure mid-enumeration
        print(f"WARN site desktop: set enumeration failed ({exc}) — pick only")
        members = [{
            "role": "pick", "source_name": picked, "item": None,
            "assets": [ASSET_PATH],
            "local_name": f"desktop-wallpaper-{date_iso}.jpg",
        }]

    from PIL import Image
    run_dir = RUNS_ROOT / date_iso
    composed: list[tuple[dict, bytes]] = []
    for member in members:
        if member["role"] == "pick":
            raw = pick_raw
        else:
            if member["item"] is None:
                print(f"WARN site desktop: set member {member['source_name']} "
                      "not found in Drive — skipped")
                continue
            raw = _download_drive_file(member["item"], member["source_name"])
            if raw is None:
                continue  # WARN already printed; the others proceed
        data = composite_desktop(raw)
        if member["role"] == "pick" and args.out:
            out = Path(args.out)
        else:
            out = run_dir / member["local_name"]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(data)
        with Image.open(out) as im:
            size = im.size
        print(f"Site desktop for {date_iso}: {member['source_name']} "
              f"[{member['role']}] -> {out} ({len(data)} bytes, "
              f"{size[0]}x{size[1]})")
        composed.append((member, data))

    if args.apply:
        files = [(asset, data) for member, data in composed
                 for asset in member["assets"]]
        commit_sha, run_url = publish_desktop_set(files, date_iso)
        for member, _data in composed:
            print(f"Site desktop deployed: {member['source_name']} "
                  f"[{member['role']}] -> {', '.join(member['assets'])} "
                  f"(commit {commit_sha}, run {run_url})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
