#!/usr/bin/env python3
"""Harness for the v555 wide-render step in site_desktop.py.

Covers the amended shape's new units only — the member/role
enumeration contract stays under test_site_desktop_set.py (v554),
which must also stay green.

  A. display_name — the band name from the subject slug: the three
     2026-11-20 production subjects (the approved exemplars) plus
     further production slugs from the v554 harness days.
  B. wide_raw_for — the wide-raw lookup in a synthetic run dir:
     found per subject; a missing subject reads None; the monthly
     member's subject resolves the same way as a daily member's.
  C. compose_wide_member — a synthetic 2048×1152 raw (the exemplar
     size) composes to a 1920×1080 JPEG: the band foot is navy, gold
     name/rule pixels stand in the band, and the scene above the
     band is the fitted raw — not navy, not a portrait pillar.
  D. stale_extra_deletions — the pure deletion selection: exactly
     the stale subject-named extras; the fixed role assets are never
     selected; today's extras are kept; non-desktop paths ignored.
"""

from __future__ import annotations

import sys
import tempfile
from io import BytesIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
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


# A — display_name from production subject slugs
check("A pick name", sd.display_name("saint-felix-de-valois") == "Saint Felix de Valois")
check("A gospel name", sd.display_name("jesus-cleanses-the-temple") == "Jesus Cleanses the Temple")
check("A monthly name", sd.display_name("holy-souls-in-purgatory") == "Holy Souls in Purgatory")
check("A scotland name", sd.display_name("saint-margaret-of-scotland") == "Saint Margaret of Scotland")
check("A sorrows name", sd.display_name("our-lady-of-sorrows") == "Our Lady of Sorrows")
check("A dedication name",
      sd.display_name("dedication-of-the-basilicas-of-saints-peter-and-paul")
      == "Dedication of the Basilicas of Saints Peter and Paul")
check("A jericho name", sd.display_name("the-blind-man-at-jericho") == "The Blind Man at Jericho")

# B — wide_raw_for in a synthetic run dir
with tempfile.TemporaryDirectory() as td:
    root = Path(td)
    raw_dir = root / "2026-11-20" / "wp-raw-2026-11-20"
    raw_dir.mkdir(parents=True)
    (raw_dir / "wide-saint-felix-de-valois.webp").write_bytes(b"x")
    (raw_dir / "wide-holy-souls-in-purgatory.jpg").write_bytes(b"x")
    (raw_dir / "media-generation-felix-0-abc.webp").write_bytes(b"x")
    hit = sd.wide_raw_for("2026-11-20", "saint-felix-de-valois", runs_root=root)
    check("B daily member raw found", hit is not None and hit.name == "wide-saint-felix-de-valois.webp")
    hit = sd.wide_raw_for("2026-11-20", "holy-souls-in-purgatory", runs_root=root)
    check("B monthly member raw found", hit is not None and hit.name == "wide-holy-souls-in-purgatory.jpg")
    check("B missing subject reads None",
          sd.wide_raw_for("2026-11-20", "jesus-cleanses-the-temple", runs_root=root) is None)
    check("B phone raw is not a wide raw",
          sd.wide_raw_for("2026-11-20", "felix", runs_root=root) is None)
    check("B missing run dir reads None",
          sd.wide_raw_for("2026-11-21", "saint-felix-de-valois", runs_root=root) is None)

# C — compose_wide_member: fit + band dress
from PIL import Image  # noqa: E402

scene = Image.new("RGB", (2048, 1152), (122, 84, 40))
buf = BytesIO()
scene.save(buf, "PNG")
out = sd.compose_wide_member(buf.getvalue(), "Saint Felix de Valois")
img = Image.open(BytesIO(out)).convert("RGB")
check("C output is 1920x1080", img.size == (1920, 1080))
check("C output is JPEG bytes", out[:2] == b"\xff\xd8")


def near(px, target, tol=28):
    return all(abs(px[i] - target[i]) <= tol for i in range(3))


band_top = 1080 - sd.BAND_H
check("C band foot is navy", near(img.getpixel((660, 1072)), sd.BAND_NAVY))
check("C band left-mid is navy", near(img.getpixel((420, band_top + 70)), sd.BAND_NAVY))
gold_px = 0
for y in range(band_top, 1080, 2):
    for x in range(0, 1920, 2):
        px = img.getpixel((x, y))
        if px[0] > 175 and px[1] > 125 and px[2] < 140 and px[0] > px[2] + 60:
            gold_px += 1
check("C gold dress stands in the band (name + rules + flourishes)", gold_px > 400)
check("C scene above the band is the fitted raw",
      near(img.getpixel((960, 400)), (122, 84, 40), tol=12))
check("C scene fills the left edge (no pillar)",
      near(img.getpixel((24, 500)), (122, 84, 40), tol=12))

# D — stale_extra_deletions
head = [
    "assets/daily-wallpaper-desktop.jpg",
    "assets/daily-wallpaper-desktop-gospel.jpg",
    "assets/daily-wallpaper-desktop-monthly.jpg",
    "assets/daily-wallpaper-desktop-saint-gertrude.jpg",
    "assets/daily-wallpaper-desktop-saint-margaret-of-scotland.jpg",
    "assets/daily-wallpaper.jpg",
    "assets/other/daily-wallpaper-desktop-nested.jpg",
    "index.html",
]
published = [
    "assets/daily-wallpaper-desktop.jpg",
    "assets/daily-wallpaper-desktop-gospel.jpg",
    "assets/daily-wallpaper-desktop-monthly.jpg",
    "assets/daily-wallpaper-desktop-saint-gertrude.jpg",
]
check("D exactly the stale extra is selected",
      sd.stale_extra_deletions(head, published)
      == ["assets/daily-wallpaper-desktop-saint-margaret-of-scotland.jpg"])
check("D fixed assets never selected when unpublished",
      sd.stale_extra_deletions(head, ["assets/daily-wallpaper-desktop-saint-gertrude.jpg"])
      == ["assets/daily-wallpaper-desktop-saint-margaret-of-scotland.jpg"])
check("D nothing stale, nothing selected",
      sd.stale_extra_deletions(published, published) == [])

print(f"{OK} ok / {NOT_OK} not-ok")
raise SystemExit(1 if NOT_OK else 0)
