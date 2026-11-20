#!/usr/bin/env python3
"""Site DESKTOP wallpapers for the Ora Pro Nobis Muse-run pipeline.

    python3 runner/site_desktop.py [--date YYYY-MM-DD] [--apply]
                                   [--out PATH]

Default is LOCAL-ONLY: the day's wide set is composed and written to
~/workspace/ora-runner-runs/<date>/ (the pick at
desktop-wallpaper-<date>.jpg, or --out); nothing external changes.
With --apply the set is also committed to assets/ in
Jctebo/spotify_praylist and the deploy-only Pages workflow is
dispatched, so https://orapronobis.media/assets/daily-wallpaper-desktop*.jpg
serve it — each address carries the CURRENT set, overwritten each
night. (The Pages artifact builder stages the committed assets into
the artifact at the same paths.)

THE SET (v554, John's approval 2026-11-20 — Q1 A separate wide files,
each named and standing · Q2 B EVERY image in the day's phone set
gets a wide version · Q3 A fixed role names): one wide file for every
member of the day's phone set. The set is enumerated from the pick's
own candidate pool (phone-queue + phone-current, date-stamped,
deduped by name), under the rotator's standing rules: the daily
members are the day's stamped subjects (one Gospel scene + the
saint/devotion subjects), the monthly member is the month's extra
standing in phone-current, and a daily-stamped file whose subject
equals the monthly extra's subject is the v416 private-devotion
duplicate — excluded, the monthly file being the set's one picture
for that subject. Fixed asset names: the pick keeps
assets/daily-wallpaper-desktop.jpg; the Gospel member (the day's
non-saint daily member, when exactly one stands) publishes as
assets/daily-wallpaper-desktop-gospel.jpg; the monthly member as
assets/daily-wallpaper-desktop-monthly.jpg; every further member as
assets/daily-wallpaper-desktop-<subject-slug>.jpg. On a saintless
day the Gospel member IS the pick and its composition publishes to
both the pick and gospel assets. On a day with more than one
non-saint daily member no filename signal separates them, so each
takes its subject name and the run WARNs the ambiguity. With --apply
all composed members publish in ONE commit and one deploy dispatch.

THE WIDE IMAGE (v555, John's amendment 2026-11-20 13:41 CT, verdict
"Perfect. Push this" 13:42 CT — supersedes the v526/v535 phone-edit
composition and the rejected cover-fit crop of the original art):
each member's wide image is a NEW, UNIQUE wide render of the
member's subject — the way the watch gets its own unique image —
with the subject's NAME standing in the image. The nightly agent
generates one wide raw per set member with the image tool (16:9, a
full-frame scene of the subject, NO text in the image — this
pipeline never generates text) into the day's raw dir beside the
phone/watch raws:

    ora-runner-runs/<date>/wp-raw-<date>/wide-<subject-slug>.<ext>

This step composes each final from its member's wide raw: cover-fit
to 1920×1080, then the NAME BAND drawn in code — an opaque navy band
at the foot of the frame, the subject's name centered in gold EB
Garamond (the pipeline's pinned font), a gold double rule at the
band's top edge, gold corner flourishes. The band constants are
measured from John's three approved exemplars of 2026-11-20 (navy
≈ RGB 10,28,60 · gold ≈ RGB 216,170,92 · band ≈ 13% of the frame
height). The name is data (the member's subject, title-cased from
its slug) and is exact every night because code draws it — the same
discipline as the phone/watch titles in
jobs/novena/devotional_wallpaper_render.py. The Drive phone file is
no longer a composition source for any member; the pick rule below
still names the pick, and the set enumeration is unchanged.

STALE EXTRAS (v555, John's standing word on the v554 line): the
publish deletes, in the same commit, every standing
assets/daily-wallpaper-desktop-<subject>.jpg that is not in the
day's published set — a prior multi-saint day's extras never linger.
The three fixed role assets are standing addresses and are never
deleted; a fixed asset whose member misses a night keeps its last
image and the step WARNs.

Failure posture (the step's standing rule, extended): a member with
no wide raw standing WARNs and is skipped — the step never falls
back to a phone-edit composition; the rejected shapes never publish
again. A miss on the pick keeps the standing behavior — WARN, exit
1, nothing published. A miss never touches the audio publish, the
feed, or the phone/watch wallpaper steps.
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
FIXED_ASSETS = {ASSET_PATH, ASSET_GOSPEL_PATH, ASSET_MONTHLY_PATH}
RUNS_ROOT = Path.home() / "workspace" / "ora-runner-runs"

# The v555 name band (measured from the approved exemplars — see the
# module docstring). Band height is the exemplars' ~13% of the frame.
BAND_H = 140
BAND_NAVY = (10, 28, 60)
BAND_GOLD = (216, 170, 92)
FONT_PATH = (Path(__file__).resolve().parents[1]
             / "config" / "devotional_images" / "fonts"
             / "EBGaramond-Regular.ttf")
WIDE_RAW_SUFFIXES = {".webp", ".jpg", ".jpeg", ".png"}
_SMALL_WORDS = {"a", "and", "at", "de", "for", "in", "of", "on", "the", "to"}


def pick_site_wallpaper(date_iso: str) -> tuple[str, bytes] | None:
    """(production name, raw bytes) of the site's pick for date_iso —
    the identical rule to pass2_build._site_wallpaper_blob. Since
    v555 the bytes are no longer a composition source; the rule
    stands as the pick's naming rule and its no-candidate gate."""
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


def display_name(subject: str) -> str:
    """The name that stands in the band, from the member's subject
    slug: title-case, small words lowercase mid-name. Production
    shapes: saint-felix-de-valois → Saint Felix de Valois ·
    jesus-cleanses-the-temple → Jesus Cleanses the Temple ·
    holy-souls-in-purgatory → Holy Souls in Purgatory."""
    words = subject.split("-")
    return " ".join(
        w if (i > 0 and w in _SMALL_WORDS) else w.capitalize()
        for i, w in enumerate(words)
    )


def wide_raw_for(date_iso: str, subject: str,
                 runs_root: Path = RUNS_ROOT) -> Path | None:
    """The member's wide raw in the day's raw dir —
    wp-raw-<date>/wide-<subject-slug>.<ext> — or None when the
    nightly generation has not stood one up. More than one match:
    the first name alphabetically stands and the step WARNs."""
    raw_dir = runs_root / date_iso / f"wp-raw-{date_iso}"
    if not raw_dir.is_dir():
        return None
    hits = sorted(
        p for p in raw_dir.glob(f"wide-{subject}.*")
        if p.suffix.lower() in WIDE_RAW_SUFFIXES
    )
    if not hits:
        return None
    if len(hits) > 1:
        print(f"WARN site desktop: {len(hits)} wide raws stand for "
              f"{subject} in {raw_dir} — using {hits[0].name}")
    return hits[0]


def _band_font(size: int):
    from PIL import ImageFont

    if not FONT_PATH.is_file():
        raise RuntimeError(f"Pinned EB Garamond font is missing: {FONT_PATH}")
    return ImageFont.truetype(str(FONT_PATH), size=size)


def _corner_flourish(draw, x: int, y: int, sx: int, sy: int) -> None:
    """A gold corner flourish for the name band: an L rule running
    right and down from the corner point, with a small diamond at
    each arm's end. (sx, sy) mirror it into the band's corners."""
    arm_x, arm_y = 64, 30
    ex, ey = x + sx * arm_x, y + sy * arm_y
    draw.line([x, y, ex, y], fill=BAND_GOLD, width=2)
    draw.line([x, y, x, ey], fill=BAND_GOLD, width=2)
    for cx, cy in ((ex, y), (x, ey)):
        r = 5
        draw.polygon([cx, cy - r, cx + r, cy, cx, cy + r, cx - r, cy],
                     outline=BAND_GOLD, width=2)


def compose_wide_member(raw: bytes, name: str) -> bytes:
    """Compose one member's wide final (v555): the member's own wide
    render cover-fit to 1920×1080, with the name band drawn at the
    foot — navy band, the subject's name in gold EB Garamond, a gold
    double rule at the band's top edge, gold corner flourishes."""
    from io import BytesIO

    from PIL import Image, ImageDraw, ImageOps

    W, H = DESKTOP_W, DESKTOP_H
    art = Image.open(BytesIO(raw)).convert("RGB")
    img = ImageOps.fit(art, (W, H), method=Image.Resampling.LANCZOS,
                       centering=(0.5, 0.5))
    draw = ImageDraw.Draw(img)

    top = H - BAND_H
    draw.rectangle([0, top, W, H], fill=BAND_NAVY)
    # Gold double rule at the band's top edge; a single rule at its foot.
    draw.rectangle([0, top, W, top + 2], fill=BAND_GOLD)
    draw.line([0, top + 6, W, top + 6], fill=BAND_GOLD, width=1)
    draw.line([0, H - 3, W, H - 3], fill=BAND_GOLD, width=1)
    # Corner flourishes, inset inside the band.
    inset_x, inset_y = 26, 15
    _corner_flourish(draw, inset_x, top + inset_y, 1, 1)
    _corner_flourish(draw, W - inset_x, top + inset_y, -1, 1)
    _corner_flourish(draw, inset_x, H - inset_y, 1, -1)
    _corner_flourish(draw, W - inset_x, H - inset_y, -1, -1)

    # The name, centered in the band, shrunk to fit 86% of the width.
    size = 78
    while size > 20:
        font = _band_font(size)
        if draw.textlength(name, font=font) <= W * 0.86:
            break
        size -= 2
    bbox = draw.textbbox((0, 0), name, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (W - tw) / 2 - bbox[0]
    y = top + (BAND_H - th) / 2 - bbox[1]
    draw.text((x, y), name, font=font, fill=BAND_GOLD)

    out = BytesIO()
    img.save(out, "JPEG", quality=88)
    return out.getvalue()


def stale_extra_deletions(head_paths: list[str],
                          published_paths: list[str]) -> list[str]:
    """The v555 stale-extra cleanup, as a pure selection: standing
    assets/daily-wallpaper-desktop-<subject>.jpg paths that are not
    in the day's published set. The three fixed role assets are
    standing addresses — never selected, even when absent today."""
    published = set(published_paths)
    return sorted(
        p for p in head_paths
        if p.startswith("assets/daily-wallpaper-desktop")
        and p.endswith(".jpg")
        and p.count("/") == 1
        and p not in FIXED_ASSETS
        and p not in published
    )


def publish_desktop_set(files: list[tuple[str, bytes]],
                        date_iso: str) -> tuple[str, str]:
    """Commit every (asset path, composition) in `files` to main in
    Jctebo/spotify_praylist in ONE commit and dispatch the deploy-only
    workflow once — the refresh_site_wallpaper route, word for word
    in shape (v554: the whole wide set rides one commit, the pick's
    asset among them). v555: the same commit also deletes the stale
    subject-named extras (stale_extra_deletions). Returns
    (commit_sha, deploy_run_url)."""
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
    full_tree = p2._gh_request(
        "GET", f"/repos/{p2.GH_REPO}/git/trees/{head_commit['tree']['sha']}?recursive=1")
    head_paths = [e["path"] for e in full_tree.get("tree", [])
                  if e.get("type") == "blob"]
    deletions = stale_extra_deletions(head_paths, [path for path, _ in files])
    for path in deletions:
        tree_entries.append({"path": path, "mode": "100644",
                             "type": "blob", "sha": None})
        print(f"Site desktop: deleting stale extra {path} "
              f"(not in the {date_iso} set)")
    tree = p2._gh_request(
        "POST", f"/repos/{p2.GH_REPO}/git/trees",
        {"base_tree": head_commit["tree"]["sha"], "tree": tree_entries},
    )
    names = ", ".join(path.rsplit("/", 1)[-1] for path, _ in files)
    if deletions:
        names += "; removed stale: " + ", ".join(
            p.rsplit("/", 1)[-1] for p in deletions)
    commit = p2._gh_request(
        "POST", f"/repos/{p2.GH_REPO}/git/commits",
        {"message": f"Site desktop wallpapers {date_iso}: {names}",
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
    picked, _pick_bytes = pick

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
        subject = wr.subject_of(member["source_name"])
        raw_path = wide_raw_for(date_iso, subject)
        if raw_path is None:
            print(f"WARN site desktop: no wide render standing for "
                  f"{subject} [{member['role']}] in "
                  f"{run_dir / f'wp-raw-{date_iso}'} — member skipped")
            if member["role"] == "pick":
                print(f"Site desktop for {date_iso}: the pick has no wide "
                      "render — nothing published.")
                return 1
            continue
        data = compose_wide_member(raw_path.read_bytes(), display_name(subject))
        if member["role"] == "pick" and args.out:
            out = Path(args.out)
        else:
            out = run_dir / member["local_name"]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(data)
        with Image.open(out) as im:
            size = im.size
        print(f"Site desktop for {date_iso}: {member['source_name']} "
              f"[{member['role']}] from {raw_path.name} -> {out} "
              f"({len(data)} bytes, {size[0]}x{size[1]})")
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
