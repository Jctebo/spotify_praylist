"""Date and text contracts for devotional phone/watch wallpapers."""

from __future__ import annotations

import datetime as dt
import re
import unicodedata
from dataclasses import dataclass
from typing import Optional
from zoneinfo import ZoneInfo


CHICAGO = ZoneInfo("America/Chicago")
WINDOW_DAYS = 10
WATCH_SIZE = (1024, 1024)
PHONE_SIZE = (1080, 1920)
PHONE_RENDER_SIZE = (1152, 2048)
WATCH_FOLDER_NAMES = {"watch-current", "watch-queue"}
PHONE_FOLDER_NAMES = {"phone-current", "phone-queue"}

MONTHLY_DEVOTIONS = {
    1: "HOLY NAME OF JESUS",
    2: "HOLY FAMILY",
    3: "SAINT JOSEPH",
    4: "HOLY EUCHARIST",
    5: "BLESSED VIRGIN MARY",
    6: "SACRED HEART OF JESUS",
    7: "PRECIOUS BLOOD",
    8: "IMMACULATE HEART OF MARY",
    9: "OUR LADY OF SORROWS",
    10: "OUR LADY OF THE ROSARY",
    11: "HOLY SOULS IN PURGATORY",
    12: "IMMACULATE CONCEPTION",
}

CLASSIFICATION_ORDER = {
    "SOLEMNITY": 0,
    "FEAST": 1,
    "MEMORIAL": 2,
    "OPTIONAL MEMORIAL": 3,
    "PRIVATE DEVOTION": 4,
}

MONTHLY_VARIATIONS = {
    1: ("HOLY NAME OF JESUS", "THE NAME ABOVE EVERY NAME", "JESUS, OUR SALVATION"),
    2: ("HOLY FAMILY", "JESUS, MARY AND JOSEPH", "A HOME OF FAITH"),
    3: ("SAINT JOSEPH", "GUARDIAN OF THE HOLY FAMILY", "PATRON OF WORKERS"),
    4: ("HOLY EUCHARIST", "BREAD OF LIFE", "MYSTERY OF HIS PRESENCE"),
    5: ("BLESSED VIRGIN MARY", "MOTHER OF THE CHURCH", "MARY, OUR MOTHER"),
    6: ("SACRED HEART OF JESUS", "HEART OF MERCY", "LOVE WITHOUT END"),
    7: ("PRECIOUS BLOOD", "CUP OF SALVATION", "REDEMPTION IN CHRIST"),
    8: ("IMMACULATE HEART OF MARY", "HEART OF FAITHFUL LOVE", "MARY'S PURE HEART"),
    9: ("OUR LADY OF SORROWS", "MARY AT THE CROSS", "MOTHER OF SORROWS"),
    10: ("OUR LADY OF THE ROSARY", "MYSTERIES OF CHRIST", "QUEEN OF THE ROSARY"),
    11: ("HOLY SOULS IN PURGATORY", "REMEMBER THE FAITHFUL DEPARTED", "HOPE OF ETERNAL LIFE"),
    12: ("IMMACULATE CONCEPTION", "FULL OF GRACE", "DAUGHTER OF THE FATHER"),
}


@dataclass(frozen=True)
class AssetKey:
    date: dt.date
    subject: str
    variant: str

    def __post_init__(self) -> None:
        if self.variant not in {"phone", "watch"}:
            raise ValueError(f"Unsupported image variant: {self.variant}")
        if not self.subject.strip():
            raise ValueError("Wallpaper subject identity is required")


@dataclass(frozen=True)
class DailyImageSpec:
    date: dt.date
    title: str
    classification: str
    source_kind: str
    subtitle: str
    priority: int = 100
    source_uid: str = ""
    recurrence_id: str = ""
    sequence_kind: str = ""
    sequence_day: Optional[int] = None
    iconography: str = ""
    monthly_fallback: bool = False

    def __post_init__(self) -> None:
        if self.classification not in CLASSIFICATION_ORDER:
            raise ValueError(f"Unsupported classification: {self.classification}")
        if not self.title.strip():
            raise ValueError("Image spec title is required")
        if self.priority < 1:
            raise ValueError("Image priority must be a positive integer")
        if self.sequence_kind:
            maximum = 3 if self.sequence_kind == "TRIDUUM" else 8 if self.sequence_kind == "OCTAVE" else 0
            if maximum == 0 or self.sequence_day is None or not 1 <= self.sequence_day <= maximum:
                raise ValueError("Invalid devotional sequence kind/day")

    @property
    def image_subtitle(self) -> str:
        if self.monthly_fallback:
            base = f"{self.date.strftime('%B').upper()} DEVOTION"
        elif self.classification == "PRIVATE DEVOTION" and self.sequence_kind:
            base = f"PRIVATE DEVOTION · {self.sequence_kind} DAY {self.sequence_day}"
        else:
            base = self.classification
        return f"{base} · {self.subtitle}" if self.subtitle else base


def build_window(run_date: dt.date, days: int = WINDOW_DAYS) -> list[dt.date]:
    if not 1 <= days <= 31:
        raise ValueError("Window length must be between 1 and 31 days")
    return [run_date + dt.timedelta(days=offset) for offset in range(days)]


def local_today(now: Optional[dt.datetime] = None) -> dt.date:
    return (now or dt.datetime.now(CHICAGO)).astimezone(CHICAGO).date()


def slugify(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value.lower()).strip("-")
    if not slug:
        raise ValueError("Title cannot produce a safe filename slug")
    return slug


def build_filename(spec: DailyImageSpec, variant: str) -> str:
    subject = slugify(spec.title)
    AssetKey(spec.date, subject, variant)
    return f"{subject}__{spec.date.isoformat()}.jpg"


def monthly_variation(date: dt.date) -> str:
    choices = MONTHLY_VARIATIONS[date.month]
    return choices[(date.day - 1) % len(choices)]


def variant_folder(variant: str, state: str) -> str:
    if variant not in {"phone", "watch"} or state not in {"current", "queue"}:
        raise ValueError("Unsupported devotional wallpaper folder")
    return f"{variant}-{state}"


def build_art_prompt(spec: DailyImageSpec, variant: str, variation: str = "") -> str:
    if variant not in {"phone", "watch"}:
        raise ValueError(f"Unsupported image variant: {variant}")
    subject = spec.title
    extra = f"\nSubtle composition variation: {variation}." if variation else ""
    common = (
        "Create a high-quality traditional Catholic devotional painting, reverent and historically respectful. "
        "Use crisp fine detail, rich luminous materials, natural anatomy, expressive but peaceful faces, "
        "and coherent recognizable Catholic iconography. The reference guides image quality and devotional "
        "typography hierarchy, not its subject. Do not render any letters, words, numbers, logos, watermarks, "
        "frames, device UI, clocks, or interface elements; exact text is overlaid separately.\n"
        f"SUBJECT: {subject}\nCLASSIFICATION: {spec.classification}\n"
        f"DEVOTIONAL ICONOGRAPHY: {spec.iconography or subject}\n"
    )
    if variant == "phone":
        return common + (
            "Compose an independently designed full-bleed vertical 9:16 wallpaper for the CLOSED outer display "
            "of a Samsung Galaxy Z Fold8 using Niagara Launcher. Place the devotional figure lower-middle/right. "
            "Keep the left 35 percent below the title visually calm and low-detail so Niagara app names and "
            "notifications remain readable; keep the rightmost 8 percent and bottom 10 percent free of essential "
            "symbols, faces, and text. The TOP 32 PERCENT must be completely free of the saint, face, head, halo, "
            "hair, hands, silhouette, and identity-defining objects; it is a quiet dark background reserved for "
            "the title and subtitle. Place the entire face below 35 percent of image height. Leave clean title space "
            "at the top. Do not leave half the canvas empty."
            + extra
        )
    return common + (
        "Compose an independently designed full-bleed square wallpaper for a Samsung Galaxy Watch Classic. "
        "Reserve the upper 38 percent as calm, darker, text-safe background with no face, halo, hands, or essential "
        "symbols; locally overlaid title and subtitle occupy this area. Place the devotional subject and its face "
        "below that title area, near the lower-middle of the square. Keep the face, gestures, and every identity-defining "
        "symbol comfortably inside the centered circular safe area with diameter 90 percent of the square; only "
        "nonessential decoration may approach the corners or circle edge. Do not draw a circular border."
        + extra
    )
