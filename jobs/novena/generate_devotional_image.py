import base64
import calendar
import datetime
import hashlib
import io
import json
import os
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from openai import OpenAI
from PIL import Image, ImageDraw, ImageFont, ImageStat

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from jobs.novena.generate_daily_novena_prayer import (
    NOTION_DATABASE_ID,
    NOTION_DATABASE_NAME,
    NOTION_TOKEN,
    OAI_API_BASE_URL,
    OPENAI_API_KEY,
    ROMCAL_CALENDAR,
    ROMCAL_LOCALE,
    ROMCAL_WINDOW_DAYS,
    bool_env,
    infer_celebration_rank,
    infer_precedence,
    int_env,
    local_today,
    notion_call,
    notion_create_page,
    notion_find_database_id_by_name,
    notion_get_all_pages,
    notion_get_database,
    notion_update_page_properties,
    page_title,
    require_env,
    romcal_fetch_day,
)

DEFAULT_DCIM_RELATIVE = r"OneDrive\Pictures\Samsung Gallery\DCIM"
DEFAULT_CURRENT_FOLDER = "Current Devotion"
DEFAULT_ARCHIVE_FOLDER = "Non Current Devotion"
DEFAULT_CURRENT_WIDE_FOLDER = "Current Devotion Wide"
DEFAULT_ARCHIVE_WIDE_FOLDER = "Non Current Devotion Wide"
DEFAULT_METADATA_ARCHIVE_FOLDER = "Devotional Metadata Archive"

DEVOTIONAL_ONEDRIVE_DCIM_DIR = "DEVOTIONAL_ONEDRIVE_DCIM_DIR"
DEVOTIONAL_CURRENT_FOLDER = "DEVOTIONAL_CURRENT_FOLDER"
DEVOTIONAL_ARCHIVE_FOLDER = "DEVOTIONAL_ARCHIVE_FOLDER"
DEVOTIONAL_CURRENT_WIDE_FOLDER = "DEVOTIONAL_CURRENT_WIDE_FOLDER"
DEVOTIONAL_ARCHIVE_WIDE_FOLDER = "DEVOTIONAL_ARCHIVE_WIDE_FOLDER"
DEVOTIONAL_METADATA_ARCHIVE_FOLDER = "DEVOTIONAL_METADATA_ARCHIVE_FOLDER"
DEVOTIONAL_TARGET_DATE = "DEVOTIONAL_TARGET_DATE"  # YYYY-MM-DD
DEVOTIONAL_MANIFEST_NAME = "DEVOTIONAL_MANIFEST_NAME"  # default images_manifest.json
DEVOTIONAL_ROOT_MANIFEST_NAME = "DEVOTIONAL_ROOT_MANIFEST_NAME"  # default devotional_image_library.json

DEVOTIONAL_PROMPT_MODEL = "DEVOTIONAL_PROMPT_MODEL"  # default gpt-5-mini
DEVOTIONAL_IMAGE_MODEL = "DEVOTIONAL_IMAGE_MODEL"  # default gpt-image-1
DEVOTIONAL_IMAGE_SIZE = "DEVOTIONAL_IMAGE_SIZE"  # default 1024x1536 (phone portrait)
DEVOTIONAL_IMAGE_SIZE_WIDE = "DEVOTIONAL_IMAGE_SIZE_WIDE"  # default 1536x1024 (widescreen)
DEVOTIONAL_IMAGE_QUALITY = "DEVOTIONAL_IMAGE_QUALITY"  # default high
DEVOTIONAL_IMAGE_FORMAT = "DEVOTIONAL_IMAGE_FORMAT"  # default png
DEVOTIONAL_REUSE_ARCHIVE_ENABLED = "DEVOTIONAL_REUSE_ARCHIVE_ENABLED"  # default true
DEVOTIONAL_ALLOWED_RANKS = {"solemnity", "solemnity-easter octave", "feast", "memorial", "optional_memorial"}

DEVOTIONAL_NOTION_CONFIG_ENABLED = "DEVOTIONAL_NOTION_CONFIG_ENABLED"  # default true
NOTION_IMAGE_CONFIG_PARENT_PAGE_ID = "NOTION_IMAGE_CONFIG_PARENT_PAGE_ID"

NOTION_IMAGE_STYLE_DATABASE_ID = "NOTION_IMAGE_STYLE_DATABASE_ID"
NOTION_IMAGE_STYLE_DATABASE_NAME = "NOTION_IMAGE_STYLE_DATABASE_NAME"  # default Image Styles
NOTION_IMAGE_STYLE_ID_PROPERTY = "NOTION_IMAGE_STYLE_ID_PROPERTY"  # default Style id
NOTION_IMAGE_STYLE_PROMPT_PROPERTY = "NOTION_IMAGE_STYLE_PROMPT_PROPERTY"  # default Style prompt

NOTION_DEVOTIONS_DATABASE_ID = "NOTION_DEVOTIONS_DATABASE_ID"
NOTION_DEVOTIONS_DATABASE_NAME = "NOTION_DEVOTIONS_DATABASE_NAME"  # default Devotions
NOTION_DEVOTION_NAME_PROPERTY = "NOTION_DEVOTION_NAME_PROPERTY"  # default Devotion name
NOTION_DEVOTION_START_PROPERTY = "NOTION_DEVOTION_START_PROPERTY"  # default Devotion start day
NOTION_DEVOTION_END_PROPERTY = "NOTION_DEVOTION_END_PROPERTY"  # default Devotion end day
NOTION_DEVOTION_DESCRIPTION_PROPERTY = "NOTION_DEVOTION_DESCRIPTION_PROPERTY"  # default Devotion Description

NOTION_IMAGE_PIPELINE_DATABASE_ID = "NOTION_IMAGE_PIPELINE_DATABASE_ID"
NOTION_IMAGE_PIPELINE_DATABASE_NAME = "NOTION_IMAGE_PIPELINE_DATABASE_NAME"  # default Image Pipeline
NOTION_IMAGE_PIPELINE_NAME_PROPERTY = "NOTION_IMAGE_PIPELINE_NAME_PROPERTY"  # default Pipeline name
NOTION_IMAGE_PIPELINE_ENABLED_PROPERTY = "NOTION_IMAGE_PIPELINE_ENABLED_PROPERTY"  # default Enabled
NOTION_IMAGE_PIPELINE_SOURCE_PROPERTY = "NOTION_IMAGE_PIPELINE_SOURCE_PROPERTY"  # default Source
NOTION_IMAGE_PIPELINE_STYLE_ID_PROPERTY = "NOTION_IMAGE_PIPELINE_STYLE_ID_PROPERTY"  # default Style id
NOTION_IMAGE_PIPELINE_WINDOW_DAYS_PROPERTY = "NOTION_IMAGE_PIPELINE_WINDOW_DAYS_PROPERTY"  # default Window days
NOTION_IMAGE_PIPELINE_DESCRIPTION_PROPERTY = "NOTION_IMAGE_PIPELINE_DESCRIPTION_PROPERTY"  # default Description

DEFAULT_STYLE_ID = "mod_realism"
SOURCE_CALENDAR = "cal"
SOURCE_DEVOTION = "dev"
SUPPORTED_IMAGE_EXTS = ("png", "jpeg", "webp")
DEFAULT_MANIFEST_NAME = "images_manifest.json"
DEFAULT_ROOT_MANIFEST_NAME = "devotional_image_library.json"
SIDECAR_SUFFIXES = (".prompt.txt", ".window.txt")

PROMPT_INSTRUCTION = """IMAGE PROMPT GENERATION - HIGH-FINISH MODERN DEVOTIONAL STYLE

INSTRUCTION TO CHATGPT

The user will provide ONLY the SUBJECT first.
From the subject alone, ChatGPT will infer all necessary theological, symbolic, and compositional elements.

ChatGPT will then:
1. Generate a complete, finished, copy-paste-ready image prompt
2. Pause and ask for revisions before creating the image

REQUIRED
SUBJECT:
[Who or what is the image about?]

OPTIONAL (If not provided, ChatGPT will responsibly infer)
TYPE:
[Single image / Four-image sequence / Five-image Rosary set]

SETTING:
[Church / cathedral / home / outdoor / modern church / heavenly / celestial]

TONE:
[Joyful / sorrowful / contemplative / maternal / triumphant / penitential]

AUTOMATIC RULES (DO NOT DISPLAY TO USER)
- Select correct doctrinal framing for the subject
- Avoid ambiguity, sentimentality, or theatrical exaggeration
- Maintain reverence, restraint, and devotional clarity

ART STYLE - HIGH-FINISH MODERN DEVOTIONAL POLISH
- Ultra-high-finish devotional realism
- No visible brush strokes
- Smooth, seamless surface quality
- Modern sacred polish (museum-grade, gallery-ready)
- Clean, refined edges with soft transitions
- Photorealistic detail tempered by gentle idealization
- Not iconographic
- Not Renaissance
- Not illustrative
- Not textured, gritty, or sketch-like

LIGHTING
- Luminous, contained sacred light
- Low contrast, no harsh shadows
- Light should reveal dignity, not dramatize emotion
- Avoid fog, mist, glow clouds, or feathery haze

BACKGROUNDS
- Architecturally or structurally grounded
- Clear forms (arches, stone, walls, space)
- Depth without excessive blur
- No abstract emptiness unless theologically justified

COLOR PALETTE (AUTOMATIC)
- Martyrs -> deep red / crimson / wine
- Marian solemnities -> white, gold, Marian blue
- Sorrowful Mysteries -> purple with restrained crimson accents
- Ordinary Time / teaching saints -> green, parchment, warm neutrals

TEXT TREATMENT (AUTOMATIC)
- Reserve clean negative space for a later title overlay
- Absolutely do not render letters, words, captions, typography, banners, plaques, page text, or readable glyphs anywhere in the artwork
- If a book, scroll, mosaic, or architectural detail is shown, it must remain blank or purely ornamental with no readable marks
- Keep one clear title-safe area in the lower third near the bottom edge
- Preserve safe margins: leave at least 18% padding from left/right and 20% from top/bottom
- Never place important visual detail where a short title line would need to sit
- Prioritize legibility on phone lock screens

OUTPUT FORMAT (AUTOMATIC)
Return only one complete image prompt, fully structured and directly usable for image generation.
Do not include extra commentary."""

MONTHLY_DEVOTION_SEEDS: Sequence[Tuple[str, str, str]] = (
    (
        "The Holy Name of Jesus",
        "Honor and reverence for the name of Jesus; often connected with the Feast of the Holy Name (Jan 3 in the traditional calendar).",
        "January",
    ),
    (
        "The Holy Family",
        "Reflection on the family life of Jesus, Mary, and Joseph.",
        "February",
    ),
    (
        "St. Joseph",
        "Patron of the Universal Church; devotion intensified around the Feast of St. Joseph (March 19).",
        "March",
    ),
    (
        "The Holy Eucharist",
        "Meditation on Christ truly present in the Blessed Sacrament.",
        "April",
    ),
    (
        "The Blessed Virgin Mary",
        "Marian devotions, May crownings, and the Rosary are especially emphasized.",
        "May",
    ),
    (
        "The Sacred Heart of Jesus",
        "Focus on Christ's love and mercy, centered on the Solemnity of the Sacred Heart.",
        "June",
    ),
    (
        "The Precious Blood of Jesus",
        "Contemplation of Christ's sacrifice and redemption.",
        "July",
    ),
    (
        "The Immaculate Heart of Mary",
        "Closely tied to Marian devotion and Fatima spirituality.",
        "August",
    ),
    (
        "The Seven Sorrows of Mary",
        "Meditation on Mary's sufferings with Christ.",
        "September",
    ),
    (
        "The Holy Rosary",
        "Promoted especially after the Battle of Lepanto and the Feast of Our Lady of the Rosary (Oct 7).",
        "October",
    ),
    (
        "The Holy Souls in Purgatory",
        "Prayer for the dead, especially after All Souls' Day (Nov 2).",
        "November",
    ),
    (
        "The Immaculate Conception",
        "Reflection on Mary's sinless conception and preparation for Christmas.",
        "December",
    ),
)


@dataclass(frozen=True)
class StyleConfig:
    style_id: str
    style_prompt: str


@dataclass(frozen=True)
class DevotionConfig:
    devotion_name: str
    start_mmdd: str
    end_mmdd: str
    description: str


@dataclass(frozen=True)
class PipelineConfig:
    name: str
    source: str
    style_id: str
    window_days: int
    enabled: bool
    description: str


@dataclass(frozen=True)
class TitlePlacementCandidate:
    name: str
    left: int
    top: int
    width: int
    height: int
    preference_penalty: float = 0.0


@dataclass(frozen=True)
class RenderTarget:
    source: str
    subject: str
    subject_slug: str
    start_date: datetime.date
    end_date: datetime.date
    style_id: str
    style_prompt: str
    pipeline_name: str
    context: str
    source_date: str

    @property
    def base_name(self) -> str:
        return (
            f"{self.start_date.strftime('%m-%d')}_{self.end_date.strftime('%m-%d')}_"
            f"{self.source}_{self.subject_slug}_{self.style_id}"
        )


@dataclass(frozen=True)
class FileMeta:
    start_mmdd: str
    end_mmdd: str
    source: str
    subject_slug: str
    style_id: str

    @property
    def base_name(self) -> str:
        return f"{self.start_mmdd}_{self.end_mmdd}_{self.source}_{self.subject_slug}_{self.style_id}"


@dataclass(frozen=True)
class StorageDirs:
    root: Path
    current: Path
    archive: Path
    current_wide: Path
    archive_wide: Path
    metadata_archive: Path

    def active_dirs(self) -> List[Path]:
        return [self.current, self.current_wide]

    def all_dirs(self) -> List[Path]:
        return [self.current, self.archive, self.current_wide, self.archive_wide, self.metadata_archive]

    def manifest_folders(self) -> List[Tuple[str, str, Path]]:
        return [
            ("current", "portrait", self.current),
            ("archive", "portrait", self.archive),
            ("current", "wide", self.current_wide),
            ("archive", "wide", self.archive_wide),
        ]


def parse_target_date() -> Optional[datetime.date]:
    raw = os.getenv(DEVOTIONAL_TARGET_DATE, "").strip()
    if not raw:
        return None
    try:
        return datetime.date.fromisoformat(raw)
    except Exception:
        raise RuntimeError(f"Invalid {DEVOTIONAL_TARGET_DATE}='{raw}'. Use YYYY-MM-DD.")


def _event_name(event: Dict[str, str]) -> str:
    for key in ("name", "title", "localName", "commonName", "fullname", "id"):
        value = str(event.get(key, "")).strip()
        if value:
            return value
    return ""


def collect_image_candidates_window(
    calendar_name: str,
    locale: str,
    start_date: datetime.date,
    days: int,
) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    seen = set()
    for offset in range(days + 1):
        dt = start_date + datetime.timedelta(days=offset)
        events = romcal_fetch_day(calendar_name, locale, dt)
        for event in events:
            if not isinstance(event, dict):
                continue
            rank = infer_celebration_rank(event)
            if rank not in DEVOTIONAL_ALLOWED_RANKS:
                continue
            name = _event_name(event)
            if not name:
                continue
            key = (dt.isoformat(), name.lower())
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "date": dt.isoformat(),
                    "name": name,
                    "celebration_rank": rank,
                    "precedence": infer_precedence(event),
                }
            )
    return rows


def slugify_kebab(text: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", str(text or "").strip().lower())
    cleaned = re.sub(r"-+", "-", cleaned).strip("-")
    return cleaned or "subject"


def slugify_legacy(text: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", str(text or "").strip().lower())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or "subject"


def normalize_style_id(text: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "_", str(text or "").strip().lower())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or DEFAULT_STYLE_ID


def parse_mmdd_text(text: str) -> Optional[str]:
    raw = str(text or "").strip()
    if not raw:
        return None
    m = re.fullmatch(r"(\d{1,2})[-/](\d{1,2})", raw)
    if m:
        month = int(m.group(1))
        day = int(m.group(2))
    else:
        m2 = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", raw)
        if not m2:
            return None
        month = int(m2.group(2))
        day = int(m2.group(3))
    if month < 1 or month > 12:
        return None
    if day < 1 or day > 31:
        return None
    return f"{month:02d}-{day:02d}"


def mmdd_to_date(mmdd: str, year: int) -> datetime.date:
    month = int(mmdd[:2])
    day = int(mmdd[3:5])
    return datetime.date(year, month, day)


def default_dcim_dir() -> Path:
    user_profile = os.getenv("USERPROFILE", "").strip()
    if not user_profile:
        raise RuntimeError("USERPROFILE is not set; cannot infer OneDrive path.")
    return Path(user_profile) / Path(DEFAULT_DCIM_RELATIVE)


def resolve_output_dirs() -> StorageDirs:
    root_env = os.getenv(DEVOTIONAL_ONEDRIVE_DCIM_DIR, "").strip()
    root = Path(root_env) if root_env else default_dcim_dir()
    current_name = os.getenv(DEVOTIONAL_CURRENT_FOLDER, DEFAULT_CURRENT_FOLDER).strip() or DEFAULT_CURRENT_FOLDER
    archive_name = os.getenv(DEVOTIONAL_ARCHIVE_FOLDER, DEFAULT_ARCHIVE_FOLDER).strip() or DEFAULT_ARCHIVE_FOLDER
    current_wide_name = (
        os.getenv(DEVOTIONAL_CURRENT_WIDE_FOLDER, DEFAULT_CURRENT_WIDE_FOLDER).strip() or DEFAULT_CURRENT_WIDE_FOLDER
    )
    archive_wide_name = (
        os.getenv(DEVOTIONAL_ARCHIVE_WIDE_FOLDER, DEFAULT_ARCHIVE_WIDE_FOLDER).strip() or DEFAULT_ARCHIVE_WIDE_FOLDER
    )
    metadata_archive_name = (
        os.getenv(DEVOTIONAL_METADATA_ARCHIVE_FOLDER, DEFAULT_METADATA_ARCHIVE_FOLDER).strip()
        or DEFAULT_METADATA_ARCHIVE_FOLDER
    )
    return StorageDirs(
        root=root,
        current=root / current_name,
        archive=root / archive_name,
        current_wide=root / current_wide_name,
        archive_wide=root / archive_wide_name,
        metadata_archive=root / metadata_archive_name,
    )


def extract_output_text(response: object) -> str:
    text = str(getattr(response, "output_text", "") or "").strip()
    return text


def format_saints_window(saints: Sequence[Dict[str, str]]) -> str:
    rows: List[str] = []
    for row in saints:
        day = str(row.get("date", "")).strip()
        name = str(row.get("name", "")).strip()
        rank = str(row.get("celebration_rank", "")).strip()
        if day and name:
            if rank:
                rows.append(f"- {day} - {name} ({rank})")
            else:
                rows.append(f"- {day} - {name}")
    return "\n".join(rows)


def normalize_prop_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(name or "").lower())


def notion_create_database(parent: Dict[str, str], db_name: str, properties: Dict[str, Any], token: str) -> str:
    body = {
        "parent": parent,
        "title": [{"type": "text", "text": {"content": db_name}}],
        "properties": properties,
    }
    data = notion_call("POST", "https://api.notion.com/v1/databases", token, body)
    db_id = str(data.get("id", "")).strip()
    if not db_id:
        raise RuntimeError(f"Failed to create Notion database '{db_name}'.")
    return db_id


def notion_property_type(database: Dict[str, Any], prop_name: str) -> str:
    props = database.get("properties") or {}
    prop = props.get(prop_name) or {}
    return str(prop.get("type", "")).strip()


def notion_resolve_property_name(database: Dict[str, Any], preferred: str, aliases: Sequence[str]) -> str:
    props = database.get("properties") or {}
    if preferred in props:
        return preferred
    wanted = {normalize_prop_key(preferred)} | {normalize_prop_key(a) for a in aliases}
    for key in props.keys():
        if normalize_prop_key(str(key)) in wanted:
            return str(key)
    return preferred

def page_property_obj(page: Dict[str, Any], property_name: str) -> Dict[str, Any]:
    props = page.get("properties") or {}
    prop = props.get(property_name)
    if isinstance(prop, dict):
        return prop
    target = str(property_name or "").strip().lower()
    for key, value in props.items():
        if str(key).strip().lower() == target and isinstance(value, dict):
            return value
    return {}


def page_property_text(page: Dict[str, Any], property_name: str) -> str:
    prop = page_property_obj(page, property_name)
    ptype = str(prop.get("type", "")).strip()
    if ptype == "status":
        status = prop.get("status") or {}
        return str(status.get("name", "")).strip()
    if ptype == "select":
        sel = prop.get("select") or {}
        return str(sel.get("name", "")).strip()
    if ptype == "multi_select":
        vals = prop.get("multi_select") or []
        return " ".join(str(v.get("name", "")).strip() for v in vals if isinstance(v, dict)).strip()
    if ptype == "rich_text":
        vals = prop.get("rich_text") or []
        return " ".join(str(v.get("plain_text", "")).strip() for v in vals if isinstance(v, dict)).strip()
    if ptype == "title":
        vals = prop.get("title") or []
        return " ".join(str(v.get("plain_text", "")).strip() for v in vals if isinstance(v, dict)).strip()
    if ptype == "url":
        return str(prop.get("url", "")).strip()
    if ptype == "number":
        value = prop.get("number")
        return "" if value is None else str(value)
    if ptype == "date":
        obj = prop.get("date") or {}
        return str(obj.get("start", "")).strip()
    return ""


def page_property_number(page: Dict[str, Any], property_name: str) -> Optional[float]:
    prop = page_property_obj(page, property_name)
    ptype = str(prop.get("type", "")).strip()
    if ptype == "number":
        value = prop.get("number")
        if isinstance(value, (int, float)):
            return float(value)
        return None
    raw = page_property_text(page, property_name)
    if not raw:
        return None
    m = re.search(r"[-+]?\d+(?:\.\d+)?", raw)
    if not m:
        return None
    try:
        return float(m.group(0))
    except Exception:
        return None


def page_property_checkbox(page: Dict[str, Any], property_name: str) -> Optional[bool]:
    prop = page_property_obj(page, property_name)
    if str(prop.get("type", "")).strip() != "checkbox":
        return None
    return bool(prop.get("checkbox"))


def rich_text_fragments(text: str, max_len: int = 1900) -> List[Dict[str, Any]]:
    cleaned = str(text or "").strip()
    if not cleaned:
        return []
    chunks: List[str] = []
    remaining = cleaned
    while remaining:
        if len(remaining) <= max_len:
            chunks.append(remaining)
            break
        cut = remaining.rfind("\n", 0, max_len + 1)
        if cut < max_len // 2:
            cut = remaining.rfind(" ", 0, max_len + 1)
        if cut < max_len // 2:
            cut = max_len
        chunks.append(remaining[:cut].strip())
        remaining = remaining[cut:].strip()
    return [{"type": "text", "text": {"content": chunk}} for chunk in chunks if chunk]


def scalar_property_payload(prop_type: str, value: str) -> Dict[str, Any]:
    text = str(value or "").strip()
    if prop_type == "title":
        return {"title": rich_text_fragments(text, max_len=2000)} if text else {"title": []}
    if prop_type == "rich_text":
        return {"rich_text": rich_text_fragments(text)} if text else {"rich_text": []}
    if prop_type == "select":
        return {"select": {"name": text} if text else None}
    if prop_type == "url":
        return {"url": text if text.startswith("http") else None}
    if prop_type == "date":
        iso = ""
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
            iso = text
        elif re.fullmatch(r"\d{2}-\d{2}", text):
            iso = f"{local_today().year}-{text}"
        return {"date": {"start": iso} if iso else None}
    if prop_type == "number":
        try:
            return {"number": float(text)}
        except Exception:
            return {"number": None}
    return {"rich_text": rich_text_fragments(text)} if text else {"rich_text": []}


def checkbox_property_payload(value: bool) -> Dict[str, Any]:
    return {"checkbox": bool(value)}


def number_property_payload(value: int) -> Dict[str, Any]:
    return {"number": int(value)}


def resolve_notion_config_parent(token: str) -> Dict[str, str]:
    explicit_parent = os.getenv(NOTION_IMAGE_CONFIG_PARENT_PAGE_ID, "").strip()
    if explicit_parent:
        return {"type": "page_id", "page_id": explicit_parent}

    base_db_id = os.getenv(NOTION_DATABASE_ID, "").strip()
    if not base_db_id:
        base_name = os.getenv(NOTION_DATABASE_NAME, "Opus Dei").strip() or "Opus Dei"
        base_db_id = notion_find_database_id_by_name(token, base_name) or ""
    if not base_db_id:
        raise RuntimeError(
            "Cannot resolve Notion parent for image config databases. "
            "Set NOTION_IMAGE_CONFIG_PARENT_PAGE_ID or share NOTION_DATABASE_ID/NOTION_DATABASE_NAME."
        )

    base_db = notion_get_database(base_db_id, token)
    parent = base_db.get("parent") or {}
    if str(parent.get("type", "")).strip() == "page_id":
        page_id = str(parent.get("page_id", "")).strip()
        if page_id:
            return {"type": "page_id", "page_id": page_id}

    raise RuntimeError(
        "Cannot create image config databases: resolved parent is not a page. "
        "Set NOTION_IMAGE_CONFIG_PARENT_PAGE_ID explicitly."
    )


def find_or_create_database(
    token: str,
    env_id_name: str,
    db_name_env: str,
    default_db_name: str,
    schema: Dict[str, Any],
    parent: Dict[str, str],
) -> str:
    db_id = os.getenv(env_id_name, "").strip()
    db_name = os.getenv(db_name_env, default_db_name).strip() or default_db_name
    if not db_id:
        db_id = notion_find_database_id_by_name(token, db_name) or ""
    if db_id:
        return db_id
    return notion_create_database(parent=parent, db_name=db_name, properties=schema, token=token)


def upsert_page_by_title(
    database_id: str,
    database: Dict[str, Any],
    title_property: str,
    title_text: str,
    values: Dict[str, Any],
    token: str,
) -> None:
    pages = notion_get_all_pages(database_id, token)
    existing_page: Optional[Dict[str, Any]] = None
    wanted = str(title_text or "").strip().lower()
    for page in pages:
        if page_title(page, title_property).strip().lower() == wanted:
            existing_page = page
            break

    props_payload: Dict[str, Any] = {}
    title_type = notion_property_type(database, title_property)
    props_payload[title_property] = scalar_property_payload(title_type, title_text)

    for prop_name, value in values.items():
        prop_type = notion_property_type(database, prop_name)
        if isinstance(value, bool):
            if prop_type == "checkbox":
                props_payload[prop_name] = checkbox_property_payload(value)
            else:
                props_payload[prop_name] = scalar_property_payload(prop_type, "true" if value else "false")
        elif isinstance(value, int):
            if prop_type == "number":
                props_payload[prop_name] = number_property_payload(value)
            else:
                props_payload[prop_name] = scalar_property_payload(prop_type, str(value))
        else:
            props_payload[prop_name] = scalar_property_payload(prop_type, str(value or ""))

    if existing_page:
        page_id = str(existing_page.get("id", "")).strip()
        if page_id:
            notion_update_page_properties(page_id, props_payload, token)
    else:
        notion_create_page(database_id, props_payload, token)


def ensure_notion_image_config(
    token: str,
    default_window_days: int,
) -> Tuple[Dict[str, StyleConfig], List[DevotionConfig], List[PipelineConfig], Dict[str, str]]:
    parent = resolve_notion_config_parent(token)

    style_db_id = find_or_create_database(
        token=token,
        env_id_name=NOTION_IMAGE_STYLE_DATABASE_ID,
        db_name_env=NOTION_IMAGE_STYLE_DATABASE_NAME,
        default_db_name="Image Styles",
        schema={
            "Style id": {"title": {}},
            "Style prompt": {"rich_text": {}},
        },
        parent=parent,
    )
    devotion_db_id = find_or_create_database(
        token=token,
        env_id_name=NOTION_DEVOTIONS_DATABASE_ID,
        db_name_env=NOTION_DEVOTIONS_DATABASE_NAME,
        default_db_name="Devotions",
        schema={
            "Devotion name": {"title": {}},
            "Devotion start day": {"rich_text": {}},
            "Devotion end day": {"rich_text": {}},
            "Devotion Description": {"rich_text": {}},
        },
        parent=parent,
    )
    pipeline_db_id = find_or_create_database(
        token=token,
        env_id_name=NOTION_IMAGE_PIPELINE_DATABASE_ID,
        db_name_env=NOTION_IMAGE_PIPELINE_DATABASE_NAME,
        default_db_name="Image Pipeline",
        schema={
            "Pipeline name": {"title": {}},
            "Enabled": {"checkbox": {}},
            "Source": {"select": {"options": []}},
            "Style id": {"rich_text": {}},
            "Window days": {"number": {}},
            "Description": {"rich_text": {}},
        },
        parent=parent,
    )

    style_db = notion_get_database(style_db_id, token)
    devotion_db = notion_get_database(devotion_db_id, token)
    pipeline_db = notion_get_database(pipeline_db_id, token)

    style_title_prop = notion_resolve_property_name(
        style_db,
        os.getenv(NOTION_IMAGE_STYLE_ID_PROPERTY, "Style id").strip() or "Style id",
        ["style id", "style_id", "id", "name"],
    )
    style_prompt_prop = notion_resolve_property_name(
        style_db,
        os.getenv(NOTION_IMAGE_STYLE_PROMPT_PROPERTY, "Style prompt").strip() or "Style prompt",
        ["style prompt", "prompt", "style"],
    )

    devotion_title_prop = notion_resolve_property_name(
        devotion_db,
        os.getenv(NOTION_DEVOTION_NAME_PROPERTY, "Devotion name").strip() or "Devotion name",
        ["devotion name", "name"],
    )
    devotion_start_prop = notion_resolve_property_name(
        devotion_db,
        os.getenv(NOTION_DEVOTION_START_PROPERTY, "Devotion start day").strip() or "Devotion start day",
        ["devotion start day", "start day", "start"],
    )
    devotion_end_prop = notion_resolve_property_name(
        devotion_db,
        os.getenv(NOTION_DEVOTION_END_PROPERTY, "Devotion end day").strip() or "Devotion end day",
        ["devotion end day", "end day", "end"],
    )
    devotion_desc_prop = notion_resolve_property_name(
        devotion_db,
        os.getenv(NOTION_DEVOTION_DESCRIPTION_PROPERTY, "Devotion Description").strip() or "Devotion Description",
        ["devotion description", "description"],
    )

    pipeline_title_prop = notion_resolve_property_name(
        pipeline_db,
        os.getenv(NOTION_IMAGE_PIPELINE_NAME_PROPERTY, "Pipeline name").strip() or "Pipeline name",
        ["pipeline name", "name"],
    )
    pipeline_enabled_prop = notion_resolve_property_name(
        pipeline_db,
        os.getenv(NOTION_IMAGE_PIPELINE_ENABLED_PROPERTY, "Enabled").strip() or "Enabled",
        ["enabled", "active"],
    )
    pipeline_source_prop = notion_resolve_property_name(
        pipeline_db,
        os.getenv(NOTION_IMAGE_PIPELINE_SOURCE_PROPERTY, "Source").strip() or "Source",
        ["source", "pipeline source"],
    )
    pipeline_style_prop = notion_resolve_property_name(
        pipeline_db,
        os.getenv(NOTION_IMAGE_PIPELINE_STYLE_ID_PROPERTY, "Style id").strip() or "Style id",
        ["style id", "style"],
    )
    pipeline_window_prop = notion_resolve_property_name(
        pipeline_db,
        os.getenv(NOTION_IMAGE_PIPELINE_WINDOW_DAYS_PROPERTY, "Window days").strip() or "Window days",
        ["window days", "window", "days"],
    )
    pipeline_desc_prop = notion_resolve_property_name(
        pipeline_db,
        os.getenv(NOTION_IMAGE_PIPELINE_DESCRIPTION_PROPERTY, "Description").strip() or "Description",
        ["description"],
    )

    upsert_page_by_title(
        database_id=style_db_id,
        database=style_db,
        title_property=style_title_prop,
        title_text=DEFAULT_STYLE_ID,
        values={style_prompt_prop: PROMPT_INSTRUCTION},
        token=token,
    )

    for month_idx, (devotion_name, description, _month_label) in enumerate(MONTHLY_DEVOTION_SEEDS, start=1):
        end_day = calendar.monthrange(2026, month_idx)[1]
        start_mmdd = f"{month_idx:02d}-01"
        end_mmdd = f"{month_idx:02d}-{end_day:02d}"
        upsert_page_by_title(
            database_id=devotion_db_id,
            database=devotion_db,
            title_property=devotion_title_prop,
            title_text=devotion_name,
            values={
                devotion_start_prop: start_mmdd,
                devotion_end_prop: end_mmdd,
                devotion_desc_prop: description,
            },
            token=token,
        )

    upsert_page_by_title(
        database_id=pipeline_db_id,
        database=pipeline_db,
        title_property=pipeline_title_prop,
        title_text="Nine Day Devotional Images",
        values={
            pipeline_enabled_prop: True,
            pipeline_source_prop: SOURCE_CALENDAR,
            pipeline_style_prop: DEFAULT_STYLE_ID,
            pipeline_window_prop: default_window_days,
            pipeline_desc_prop: "Romcal saints in rolling window.",
        },
        token=token,
    )
    upsert_page_by_title(
        database_id=pipeline_db_id,
        database=pipeline_db,
        title_property=pipeline_title_prop,
        title_text="Monthly Devotion Images",
        values={
            pipeline_enabled_prop: True,
            pipeline_source_prop: SOURCE_DEVOTION,
            pipeline_style_prop: DEFAULT_STYLE_ID,
            pipeline_window_prop: 0,
            pipeline_desc_prop: "Monthly devotion subject for active month.",
        },
        token=token,
    )

    style_pages = notion_get_all_pages(style_db_id, token)
    styles: Dict[str, StyleConfig] = {}
    for page in style_pages:
        style_id = normalize_style_id(page_title(page, style_title_prop) or page_property_text(page, style_title_prop))
        prompt_text = page_property_text(page, style_prompt_prop)
        if not style_id:
            continue
        if not prompt_text:
            prompt_text = PROMPT_INSTRUCTION
        styles[style_id] = StyleConfig(style_id=style_id, style_prompt=prompt_text)
    if DEFAULT_STYLE_ID not in styles:
        styles[DEFAULT_STYLE_ID] = StyleConfig(style_id=DEFAULT_STYLE_ID, style_prompt=PROMPT_INSTRUCTION)

    devotion_pages = notion_get_all_pages(devotion_db_id, token)
    devotions: List[DevotionConfig] = []
    for page in devotion_pages:
        name = page_title(page, devotion_title_prop).strip()
        if not name:
            continue
        start_mmdd = parse_mmdd_text(page_property_text(page, devotion_start_prop) or "")
        end_mmdd = parse_mmdd_text(page_property_text(page, devotion_end_prop) or "")
        if not start_mmdd or not end_mmdd:
            continue
        description = page_property_text(page, devotion_desc_prop).strip()
        devotions.append(
            DevotionConfig(
                devotion_name=name,
                start_mmdd=start_mmdd,
                end_mmdd=end_mmdd,
                description=description,
            )
        )

    pipeline_pages = notion_get_all_pages(pipeline_db_id, token)
    pipelines: List[PipelineConfig] = []
    for page in pipeline_pages:
        name = page_title(page, pipeline_title_prop).strip()
        if not name:
            continue
        enabled = page_property_checkbox(page, pipeline_enabled_prop)
        if enabled is False:
            continue
        source_raw = (page_property_text(page, pipeline_source_prop) or "").strip().lower()
        if source_raw in {"calendar", "liturgical", "liturgical calendar"}:
            source_raw = SOURCE_CALENDAR
        if source_raw in {"devotion", "monthly"}:
            source_raw = SOURCE_DEVOTION
        if source_raw not in {SOURCE_CALENDAR, SOURCE_DEVOTION}:
            continue
        style_id = normalize_style_id(page_property_text(page, pipeline_style_prop) or DEFAULT_STYLE_ID)
        window_num = page_property_number(page, pipeline_window_prop)
        days = int(window_num) if window_num is not None else default_window_days
        days = max(1, min(30, days))
        description = page_property_text(page, pipeline_desc_prop).strip()
        pipelines.append(
            PipelineConfig(
                name=name,
                source=source_raw,
                style_id=style_id,
                window_days=days,
                enabled=True,
                description=description,
            )
        )

    ids = {
        "style_db": style_db_id,
        "devotion_db": devotion_db_id,
        "pipeline_db": pipeline_db_id,
    }
    return styles, devotions, pipelines, ids


def default_local_config(default_window_days: int) -> Tuple[Dict[str, StyleConfig], List[DevotionConfig], List[PipelineConfig], Dict[str, str]]:
    styles = {
        DEFAULT_STYLE_ID: StyleConfig(style_id=DEFAULT_STYLE_ID, style_prompt=PROMPT_INSTRUCTION),
    }
    pipelines = [
        PipelineConfig(
            name="Nine Day Devotional Images",
            source=SOURCE_CALENDAR,
            style_id=DEFAULT_STYLE_ID,
            window_days=default_window_days,
            enabled=True,
            description="Local fallback pipeline.",
        )
    ]
    return styles, [], pipelines, {"style_db": "", "devotion_db": "", "pipeline_db": ""}


def parse_new_file_meta(path: Path) -> Optional[FileMeta]:
    m = re.fullmatch(
        r"(\d{2}-\d{2})_(\d{2}-\d{2})_(cal|dev)_([a-z0-9][a-z0-9-]*)_([a-z0-9][a-z0-9_-]*)\.(png|jpeg|webp)",
        path.name.lower(),
    )
    if not m:
        return None
    return FileMeta(
        start_mmdd=m.group(1),
        end_mmdd=m.group(2),
        source=m.group(3),
        subject_slug=m.group(4),
        style_id=m.group(5),
    )


def target_id(target: RenderTarget) -> str:
    return target.base_name


def find_existing_image_by_base(folder: Path, base_name: str) -> Optional[Path]:
    for ext in SUPPORTED_IMAGE_EXTS:
        path = folder / f"{base_name}.{ext}"
        if path.exists():
            return path
    return None


def move_file_overwrite(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        dst.unlink()
    shutil.move(str(src), str(dst))


def image_variant_for_path(image_path: Path) -> str:
    return "wide" if "wide" in image_path.parent.name.lower() else "portrait"


def sidecar_archive_path(storage: StorageDirs, image_path: Path, suffix: str) -> Path:
    return storage.metadata_archive / f"{image_path.stem}.{image_variant_for_path(image_path)}{suffix}"


def write_archived_sidecar(storage: StorageDirs, image_path: Path, suffix: str, content: str) -> Path:
    path = sidecar_archive_path(storage, image_path, suffix)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def migrate_legacy_sidecars(storage: StorageDirs, image_path: Path) -> None:
    for suffix in SIDECAR_SUFFIXES:
        legacy_sidecar = image_path.with_suffix(suffix)
        if not legacy_sidecar.exists():
            continue
        move_file_overwrite(legacy_sidecar, sidecar_archive_path(storage, image_path, suffix))


def migrate_all_legacy_sidecars(storage: StorageDirs) -> None:
    for _state, _variant, folder in storage.manifest_folders():
        if not folder.exists():
            continue
        image_files: List[Path] = []
        for ext in SUPPORTED_IMAGE_EXTS:
            image_files.extend(folder.glob(f"*.{ext}"))
        for image_path in image_files:
            migrate_legacy_sidecars(storage, image_path)


def move_sidecars(storage: StorageDirs, old_image: Path, new_image: Path) -> None:
    for suffix in SIDECAR_SUFFIXES:
        legacy_sidecar = old_image.with_suffix(suffix)
        new_sidecar = sidecar_archive_path(storage, new_image, suffix)
        if legacy_sidecar.exists():
            move_file_overwrite(legacy_sidecar, new_sidecar)
            continue
        old_sidecar = sidecar_archive_path(storage, old_image, suffix)
        if old_sidecar.exists() and old_sidecar != new_sidecar:
            move_file_overwrite(old_sidecar, new_sidecar)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def iso_utc_mtime(path: Path) -> str:
    timestamp = datetime.datetime.fromtimestamp(path.stat().st_mtime, tz=datetime.timezone.utc)
    return timestamp.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def maybe_migrate_legacy_file(storage: StorageDirs, folder: Path, target: RenderTarget) -> bool:
    if target.source != SOURCE_CALENDAR:
        return False

    day_iso = target.source_date
    end_mmdd = target.end_date.strftime("%m-%d")
    legacy_slug = slugify_legacy(target.subject)
    candidates: List[Path] = []
    for ext in SUPPORTED_IMAGE_EXTS:
        candidates.extend(
            [
                folder / f"saint_md_{end_mmdd}_{legacy_slug}.{ext}",
                folder / f"saint_{day_iso}_{legacy_slug}.{ext}",
                folder / f"{day_iso}_{legacy_slug}.{ext}",
            ]
        )

    for candidate in candidates:
        if not candidate.exists():
            continue
        new_path = folder / f"{target.base_name}{candidate.suffix.lower()}"
        move_sidecars(storage, candidate, new_path)
        move_file_overwrite(candidate, new_path)
        print(f"INFO migrated_legacy_image old={candidate.name} new={new_path.name}")
        return True
    return False


def move_out_of_window_targets(storage: StorageDirs, source_dir: Path, archive_dir: Path, active_ids: set[str]) -> int:
    if not source_dir.exists():
        return 0
    moved = 0
    image_files: List[Path] = []
    for ext in SUPPORTED_IMAGE_EXTS:
        image_files.extend(source_dir.glob(f"*.{ext}"))

    for image_path in image_files:
        meta = parse_new_file_meta(image_path)
        if not meta:
            continue
        if meta.base_name in active_ids:
            continue
        archive_dir.mkdir(parents=True, exist_ok=True)
        dst_image = archive_dir / image_path.name
        move_sidecars(storage, image_path, dst_image)
        move_file_overwrite(image_path, dst_image)
        moved += 1
    return moved


def restore_target_from_archive(
    storage: StorageDirs,
    target: RenderTarget,
    current_dir: Path,
    archive_dir: Path,
    wide_dir: Path,
    archive_wide_dir: Path,
) -> Tuple[bool, bool]:
    if not archive_dir.exists() and not archive_wide_dir.exists():
        return False, False

    restored_portrait = False
    restored_wide = False

    if not find_existing_image_by_base(current_dir, target.base_name):
        src_portrait = find_existing_image_by_base(archive_dir, target.base_name)
        if not src_portrait:
            maybe_migrate_legacy_file(storage, archive_dir, target)
            src_portrait = find_existing_image_by_base(archive_dir, target.base_name)
        if src_portrait and src_portrait.exists():
            dst_portrait = current_dir / src_portrait.name
            move_sidecars(storage, src_portrait, dst_portrait)
            move_file_overwrite(src_portrait, dst_portrait)
            restored_portrait = True

    if not find_existing_image_by_base(wide_dir, target.base_name):
        src_wide = find_existing_image_by_base(archive_wide_dir, target.base_name)
        if not src_wide:
            maybe_migrate_legacy_file(storage, archive_wide_dir, target)
            src_wide = find_existing_image_by_base(archive_wide_dir, target.base_name)
        if src_wide and src_wide.exists():
            dst_wide = wide_dir / src_wide.name
            move_sidecars(storage, src_wide, dst_wide)
            move_file_overwrite(src_wide, dst_wide)
            restored_wide = True

    return restored_portrait, restored_wide


def file_manifest_record(path: Path, root: Path) -> Dict[str, Any]:
    return {
        "name": path.name,
        "relative_path": path.relative_to(root).as_posix(),
        "size_bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "modified_utc": iso_utc_mtime(path),
    }


def write_manifests(storage: StorageDirs) -> Tuple[int, Path]:
    manifest_name = os.getenv(DEVOTIONAL_MANIFEST_NAME, DEFAULT_MANIFEST_NAME).strip() or DEFAULT_MANIFEST_NAME
    root_manifest_name = (
        os.getenv(DEVOTIONAL_ROOT_MANIFEST_NAME, DEFAULT_ROOT_MANIFEST_NAME).strip() or DEFAULT_ROOT_MANIFEST_NAME
    )
    generated_at = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    folder_summaries: List[Dict[str, Any]] = []
    total_images = 0

    for state, variant, folder in storage.manifest_folders():
        folder.mkdir(parents=True, exist_ok=True)
        items: List[Dict[str, Any]] = []
        image_files: List[Path] = []
        for ext in SUPPORTED_IMAGE_EXTS:
            image_files.extend(sorted(folder.glob(f"*.{ext}")))

        for image_path in sorted(image_files, key=lambda item: item.name.lower()):
            migrate_legacy_sidecars(storage, image_path)
            meta = parse_new_file_meta(image_path)
            item: Dict[str, Any] = {
                "id": meta.base_name if meta else image_path.stem,
                "base_name": image_path.stem,
                "state": state,
                "variant": variant,
                "files": {
                    "image": file_manifest_record(image_path, storage.root),
                },
            }
            if meta:
                item["start_mmdd"] = meta.start_mmdd
                item["end_mmdd"] = meta.end_mmdd
                item["source"] = meta.source
                item["subject_slug"] = meta.subject_slug
                item["style_id"] = meta.style_id
            items.append(item)

        folder_manifest = {
            "generated_at_utc": generated_at,
            "folder_name": folder.name,
            "state": state,
            "variant": variant,
            "item_count": len(items),
            "items": items,
        }
        manifest_path = folder / manifest_name
        manifest_path.write_text(json.dumps(folder_manifest, indent=2), encoding="utf-8")
        total_images += len(items)
        folder_summaries.append(
            {
                "folder_name": folder.name,
                "state": state,
                "variant": variant,
                "manifest_path": manifest_path.relative_to(storage.root).as_posix(),
                "item_count": len(items),
            }
        )

    root_manifest = {
        "generated_at_utc": generated_at,
        "root_path": storage.root.name,
        "folder_count": len(folder_summaries),
        "image_count": total_images,
        "folders": folder_summaries,
    }
    root_manifest_path = storage.root / root_manifest_name
    root_manifest_path.write_text(json.dumps(root_manifest, indent=2), encoding="utf-8")
    return total_images, root_manifest_path


def build_image_prompt(
    client: OpenAI,
    model: str,
    target: RenderTarget,
    today: datetime.date,
    layout_hint: str,
) -> str:
    source_label = "Liturgical Calendar" if target.source == SOURCE_CALENDAR else "Monthly Devotion"
    context = target.context.strip()
    body = (
        f"SUBJECT:\n{target.subject}\n\n"
        f"CURRENT DATE:\n{today.isoformat()}\n\n"
        f"PIPELINE:\n{target.pipeline_name}\n\n"
        f"SOURCE:\n{source_label}\n\n"
        f"ACTIVE WINDOW:\n{target.start_date.isoformat()} to {target.end_date.isoformat()}\n\n"
        f"STYLE ID:\n{target.style_id}\n\n"
    )
    if context:
        body += f"CONTEXT:\n{context}\n\n"
    body += f"OUTPUT COMPOSITION:\n{layout_hint}"

    response = client.responses.create(
        model=model,
        input=[
            {"role": "system", "content": [{"type": "input_text", "text": target.style_prompt}]},
            {"role": "user", "content": [{"type": "input_text", "text": body}]},
        ],
    )
    text = extract_output_text(response)
    if not text:
        raise RuntimeError("Prompt generation returned empty output.")
    return text


def generate_image_bytes(
    client: OpenAI,
    model: str,
    prompt: str,
    size: str,
    quality: str,
    image_format: str,
) -> bytes:
    response = client.images.generate(
        model=model,
        prompt=prompt,
        size=size,
        quality=quality,
        output_format=image_format,
    )
    data = getattr(response, "data", None) or []
    if not data:
        raise RuntimeError("Image generation returned no data.")
    b64 = str(getattr(data[0], "b64_json", "") or "").strip()
    if not b64:
        raise RuntimeError("Image response missing b64 payload.")
    return base64.b64decode(b64)


def _font_candidates() -> List[Path]:
    candidates = [
        Path(r"C:\Windows\Fonts\georgia.ttf"),
        Path(r"C:\Windows\Fonts\times.ttf"),
        Path(r"C:\Windows\Fonts\georgiab.ttf"),
        Path(r"C:\Windows\Fonts\timesbd.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        Path("/Library/Fonts/Georgia.ttf"),
        Path("/Library/Fonts/Times New Roman.ttf"),
        Path("/Library/Fonts/Georgia Bold.ttf"),
        Path("/Library/Fonts/Times New Roman Bold.ttf"),
    ]
    return [path for path in candidates if path.exists()]


def _load_title_font(size: int) -> ImageFont.ImageFont:
    for path in _font_candidates():
        try:
            return ImageFont.truetype(str(path), size=size)
        except Exception:
            continue
    return ImageFont.load_default()


def _clamp_color(value: float) -> int:
    return max(0, min(255, int(round(value))))


def _blend_rgb(base: Tuple[int, int, int], target: Tuple[int, int, int], ratio: float) -> Tuple[int, int, int]:
    mix = max(0.0, min(1.0, float(ratio)))
    inv = 1.0 - mix
    return tuple(_clamp_color((base[idx] * inv) + (target[idx] * mix)) for idx in range(3))


def _sample_average_rgb(image: Image.Image, box: Tuple[int, int, int, int]) -> Tuple[int, int, int]:
    left, top, right, bottom = box
    crop = image.crop((left, top, max(left + 1, right), max(top + 1, bottom))).convert("RGB")
    stat = ImageStat.Stat(crop)
    means = list((stat.mean or [96.0, 88.0, 72.0])[:3])
    while len(means) < 3:
        means.append(means[-1] if means else 96.0)
    return tuple(_clamp_color(value) for value in means[:3])


def _wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> List[str]:
    words = [word for word in re.split(r"\s+", str(text or "").strip()) if word]
    if not words:
        return []
    lines: List[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}".strip()
        bbox = draw.textbbox((0, 0), trial, font=font)
        if (bbox[2] - bbox[0]) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _region_activity(image: Image.Image, box: Tuple[int, int, int, int]) -> float:
    crop = image.crop(box).convert("L").resize((64, 64))
    width, height = crop.size
    pixels = crop.tobytes()
    if not pixels:
        return 0.0
    total = 0
    for y in range(height):
        row = y * width
        for x in range(width):
            idx = row + x
            val = pixels[idx]
            if x + 1 < width:
                total += abs(val - pixels[idx + 1])
            if y + 1 < height:
                total += abs(val - pixels[idx + width])
    return total / float(len(pixels))


def _fit_title_to_box(
    draw: ImageDraw.ImageDraw,
    title: str,
    box_width: int,
    box_height: int,
    min_font: int,
    max_font: int,
    line_spacing: int,
) -> Optional[Tuple[ImageFont.ImageFont, List[str], Tuple[int, int, int, int]]]:
    for size in range(max_font, min_font - 1, -2):
        font = _load_title_font(size)
        lines = _wrap_text(draw, title, font, box_width)
        if not lines or len(lines) > 3:
            continue
        bbox = draw.multiline_textbbox((0, 0), "\n".join(lines), font=font, spacing=line_spacing, align="center")
        if (bbox[2] - bbox[0]) <= box_width and (bbox[3] - bbox[1]) <= box_height:
            return font, lines, bbox
    return None


def _title_box_candidates(width: int, height: int) -> List[TitlePlacementCandidate]:
    if width >= height:
        return [
            TitlePlacementCandidate(
                "bottom_center", int(width * 0.24), int(height * 0.74), int(width * 0.52), int(height * 0.16), 0.0
            ),
            TitlePlacementCandidate(
                "bottom_left", int(width * 0.05), int(height * 0.72), int(width * 0.28), int(height * 0.18), 1.0
            ),
            TitlePlacementCandidate(
                "bottom_right", int(width * 0.67), int(height * 0.72), int(width * 0.28), int(height * 0.18), 1.0
            ),
        ]
    return [
        TitlePlacementCandidate(
            "bottom_center", int(width * 0.22), int(height * 0.74), int(width * 0.56), int(height * 0.15), 0.0
        ),
        TitlePlacementCandidate(
            "bottom_left", int(width * 0.05), int(height * 0.72), int(width * 0.30), int(height * 0.18), 1.0
        ),
        TitlePlacementCandidate(
            "bottom_right", int(width * 0.65), int(height * 0.72), int(width * 0.30), int(height * 0.18), 1.0
        ),
    ]


def _select_title_placement(
    image: Image.Image,
    draw: ImageDraw.ImageDraw,
    title: str,
    min_font: int,
    max_font: int,
    line_spacing: int,
) -> Optional[Tuple[TitlePlacementCandidate, ImageFont.ImageFont, List[str], Tuple[int, int, int, int]]]:
    width, height = image.size
    scored: List[
        Tuple[
            float,
            float,
            float,
            TitlePlacementCandidate,
            ImageFont.ImageFont,
            List[str],
            Tuple[int, int, int, int],
        ]
    ] = []
    for candidate in _title_box_candidates(width, height):
        right = min(width, candidate.left + candidate.width)
        bottom = min(height, candidate.top + candidate.height)
        box_width = max(1, right - candidate.left)
        box_height = max(1, bottom - candidate.top)
        fit = _fit_title_to_box(draw, title, box_width, box_height, min_font, max_font, line_spacing)
        if not fit:
            continue
        font, lines, bbox = fit
        activity = _region_activity(image, (candidate.left, candidate.top, right, bottom))
        score = activity + candidate.preference_penalty
        scored.append((score, activity, candidate.preference_penalty, candidate, font, lines, bbox))
    if not scored:
        return None
    scored.sort(key=lambda item: (item[0], item[1], item[2], item[3].top, item[3].left))
    _score, _activity, _penalty, candidate, font, lines, bbox = scored[0]
    return candidate, font, lines, bbox


def apply_title_overlay(image_bytes: bytes, title: str, image_format: str) -> bytes:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    width, height = image.size
    draw = ImageDraw.Draw(image)

    title_text = overlay_title_for_subject(title)
    if not title_text:
        return image_bytes

    is_wide = width >= height
    band_top = int(height * (0.856 if is_wide else 0.84))
    sample_top = int(height * (0.54 if is_wide else 0.56))
    sample_bottom = max(sample_top + 1, band_top - int(height * 0.07))
    sample_box = (
        int(width * 0.08),
        sample_top,
        int(width * 0.92),
        sample_bottom,
    )
    base_rgb = _sample_average_rgb(image, sample_box)
    band_rgb = _blend_rgb(base_rgb, (232, 214, 184), 0.38)
    text_rgb = _blend_rgb(band_rgb, (34, 25, 16), 0.85)

    min_font = max(18, int(height * (0.019 if is_wide else 0.022)))
    max_font = max(min_font, int(height * (0.042 if is_wide else 0.05)))
    line_spacing = max(4, int(height * 0.006))
    text_box_width = int(width * 0.84)
    text_box_height = max(1, height - band_top - int(height * 0.045))
    fitted = _fit_title_to_box(draw, title_text, text_box_width, text_box_height, min_font, max_font, line_spacing)
    if not fitted:
        return image_bytes

    best_font, best_lines, bbox = fitted
    text = "\n".join(best_lines)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (width - text_width) / 2
    y = band_top + ((height - band_top - text_height) / 2)

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    fade_height = max(22, int(height * 0.064))
    for step in range(fade_height):
        fade_y = band_top - fade_height + step
        alpha = _clamp_color(72.0 + (183.0 * ((step + 1) / float(fade_height))))
        overlay_draw.rectangle((0, fade_y, width, fade_y + 1), fill=(*band_rgb, alpha))
    overlay_draw.rectangle((0, band_top, width, height), fill=(*band_rgb, 255))
    overlay_draw.multiline_text(
        (x, y),
        text,
        font=best_font,
        fill=(*text_rgb, 255),
        align="center",
        spacing=line_spacing,
    )
    image = Image.alpha_composite(image, overlay)

    out = io.BytesIO()
    save_format = "JPEG" if image_format.lower() in {"jpg", "jpeg"} else image_format.upper()
    save_image = image.convert("RGB") if save_format == "JPEG" else image
    save_image.save(out, format=save_format)
    return out.getvalue()


def apply_portrait_title_overlay(image_bytes: bytes, title: str, image_format: str) -> bytes:
    return apply_title_overlay(image_bytes, title, image_format)


def apply_wide_title_overlay(image_bytes: bytes, title: str, image_format: str) -> bytes:
    return apply_title_overlay(image_bytes, title, image_format)


def write_image_file(image_bytes: bytes, output_dir: Path, filename: str) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / filename
    out_path.write_bytes(image_bytes)
    return out_path


def overlay_title_for_subject(subject: str) -> str:
    text = re.sub(r"\s+", " ", str(subject or "").strip())
    if not text:
        return ""
    if "," in text and re.match(r"^(saint|st\.?)\s+", text, flags=re.IGNORECASE):
        text = text.split(",", 1)[0].strip()
    return text


def canonical_subject_key(subject_slug: str) -> str:
    slug = re.sub(r"^(saint|st)-", "", str(subject_slug or "").strip().lower())
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


def targets_overlap_subject(a: RenderTarget, b: RenderTarget) -> bool:
    a_key = canonical_subject_key(a.subject_slug)
    b_key = canonical_subject_key(b.subject_slug)
    if not a_key or not b_key:
        return False
    if a_key == b_key:
        return True
    shorter, longer = (a_key, b_key) if len(a_key) <= len(b_key) else (b_key, a_key)
    shorter_tokens = [token for token in shorter.split("-") if token]
    if len(shorter_tokens) > 2:
        return False
    return longer.startswith(f"{shorter}-")


def render_target_priority(target: RenderTarget) -> Tuple[int, int, int, str]:
    source_rank = 0 if target.source == SOURCE_CALENDAR else 1
    window_span = (target.end_date - target.start_date).days
    return (source_rank, window_span, len(canonical_subject_key(target.subject_slug)), target.subject_slug)


def dedupe_render_targets(targets: Sequence[RenderTarget]) -> List[RenderTarget]:
    selected: List[RenderTarget] = []
    for target in sorted(targets, key=render_target_priority):
        replaced = False
        for idx, existing in enumerate(selected):
            if not targets_overlap_subject(target, existing):
                continue
            if render_target_priority(target) < render_target_priority(existing):
                selected[idx] = target
            replaced = True
            break
        if not replaced:
            selected.append(target)
    return sorted(
        selected,
        key=lambda t: (t.start_date.isoformat(), t.end_date.isoformat(), t.source, t.subject_slug, t.style_id),
    )


def build_targets_from_config(
    today: datetime.date,
    calendar_name: str,
    locale: str,
    default_window_days: int,
    target_date: Optional[datetime.date],
    styles: Dict[str, StyleConfig],
    devotions: Sequence[DevotionConfig],
    pipelines: Sequence[PipelineConfig],
) -> List[RenderTarget]:
    targets: List[RenderTarget] = []
    seen: set[str] = set()

    for pipeline in pipelines:
        if not pipeline.enabled:
            continue
        style = styles.get(pipeline.style_id) or styles.get(DEFAULT_STYLE_ID)
        if not style:
            continue

        if pipeline.source == SOURCE_CALENDAR:
            days = max(1, min(30, pipeline.window_days or default_window_days))
            saints = collect_image_candidates_window(calendar_name, locale, today, days)
            if not saints:
                continue
            saints_text = format_saints_window(saints)
            for row in saints:
                feast_iso = str(row.get("date", "")).strip()
                if not feast_iso:
                    continue
                feast_day = datetime.date.fromisoformat(feast_iso)
                if target_date and feast_day != target_date:
                    continue
                start_day = feast_day - datetime.timedelta(days=days)
                end_day = feast_day
                if today < start_day or today > end_day:
                    continue
                subject = str(row.get("name", "")).strip()
                if not subject:
                    continue
                context_lines = [
                    f"Feast date: {feast_iso}",
                    f"Celebration rank: {str(row.get('celebration_rank', '')).strip()}",
                    f"Precedence: {str(row.get('precedence', '')).strip()}",
                ]
                if saints_text:
                    context_lines.append("Nine-day saint window:")
                    context_lines.append(saints_text)
                target = RenderTarget(
                    source=SOURCE_CALENDAR,
                    subject=subject,
                    subject_slug=slugify_kebab(subject),
                    start_date=start_day,
                    end_date=end_day,
                    style_id=style.style_id,
                    style_prompt=style.style_prompt,
                    pipeline_name=pipeline.name,
                    context="\n".join(x for x in context_lines if x.strip()),
                    source_date=feast_iso,
                )
                tid = target_id(target)
                if tid in seen:
                    continue
                seen.add(tid)
                targets.append(target)

        if pipeline.source == SOURCE_DEVOTION:
            for devotion in devotions:
                try:
                    start_day = mmdd_to_date(devotion.start_mmdd, today.year)
                    end_day = mmdd_to_date(devotion.end_mmdd, today.year)
                except Exception:
                    continue
                if end_day < start_day:
                    continue
                if today < start_day or today > end_day:
                    continue
                subject = devotion.devotion_name.strip()
                if not subject:
                    continue
                context_lines = [
                    f"Devotion active window: {start_day.isoformat()} to {end_day.isoformat()}",
                    devotion.description.strip(),
                ]
                target = RenderTarget(
                    source=SOURCE_DEVOTION,
                    subject=subject,
                    subject_slug=slugify_kebab(subject),
                    start_date=start_day,
                    end_date=end_day,
                    style_id=style.style_id,
                    style_prompt=style.style_prompt,
                    pipeline_name=pipeline.name,
                    context="\n".join(x for x in context_lines if x.strip()),
                    source_date=start_day.isoformat(),
                )
                tid = target_id(target)
                if tid in seen:
                    continue
                seen.add(tid)
                targets.append(target)

    return dedupe_render_targets(
        sorted(targets, key=lambda t: (t.start_date.isoformat(), t.end_date.isoformat(), t.source, t.subject_slug, t.style_id))
    )


def main() -> int:
    try:
        openai_key = require_env(OPENAI_API_KEY)
        oai_base_url = os.getenv(OAI_API_BASE_URL, "https://api.openai.com/v1").strip() or "https://api.openai.com/v1"

        romcal_calendar = os.getenv(ROMCAL_CALENDAR, "general_roman").strip() or "general_roman"
        romcal_locale = os.getenv(ROMCAL_LOCALE, "en").strip() or "en"
        default_window_days = int_env(ROMCAL_WINDOW_DAYS, default=9, min_value=1, max_value=30)

        prompt_model = os.getenv(DEVOTIONAL_PROMPT_MODEL, "gpt-5-mini").strip() or "gpt-5-mini"
        image_model = os.getenv(DEVOTIONAL_IMAGE_MODEL, "gpt-image-1").strip() or "gpt-image-1"
        image_size = os.getenv(DEVOTIONAL_IMAGE_SIZE, "1024x1536").strip() or "1024x1536"
        image_size_wide = os.getenv(DEVOTIONAL_IMAGE_SIZE_WIDE, "1536x1024").strip() or "1536x1024"
        image_quality = os.getenv(DEVOTIONAL_IMAGE_QUALITY, "high").strip() or "high"
        image_format = os.getenv(DEVOTIONAL_IMAGE_FORMAT, "png").strip().lower() or "png"
        if image_format not in SUPPORTED_IMAGE_EXTS:
            raise RuntimeError(f"Invalid {DEVOTIONAL_IMAGE_FORMAT}='{image_format}'.")

        today = local_today()
        target_date = parse_target_date()

        notion_enabled = bool_env(DEVOTIONAL_NOTION_CONFIG_ENABLED, default=True)
        notion_token = os.getenv(NOTION_TOKEN, "").strip()

        if notion_enabled and notion_token:
            styles, devotions, pipelines, db_ids = ensure_notion_image_config(
                token=notion_token,
                default_window_days=default_window_days,
            )
            config_mode = (
                f"notion:styles={len(styles)}:devotions={len(devotions)}:pipelines={len(pipelines)}:"
                f"style_db={db_ids.get('style_db','')}:devotion_db={db_ids.get('devotion_db','')}:"
                f"pipeline_db={db_ids.get('pipeline_db','')}"
            )
        else:
            styles, devotions, pipelines, _db_ids = default_local_config(default_window_days)
            if notion_enabled and not notion_token:
                config_mode = "local_fallback:missing_notion_token"
            elif not notion_enabled:
                config_mode = "local_fallback:disabled"
            else:
                config_mode = "local_fallback"

        targets = build_targets_from_config(
            today=today,
            calendar_name=romcal_calendar,
            locale=romcal_locale,
            default_window_days=default_window_days,
            target_date=target_date,
            styles=styles,
            devotions=devotions,
            pipelines=pipelines,
        )

        storage = resolve_output_dirs()
        current_dir = storage.current
        archive_dir = storage.archive
        wide_dir = storage.current_wide
        archive_wide_dir = storage.archive_wide
        storage.root.mkdir(parents=True, exist_ok=True)
        for folder in storage.all_dirs():
            folder.mkdir(parents=True, exist_ok=True)
        migrate_all_legacy_sidecars(storage)
        active_ids = {target_id(t) for t in targets}

        moved_count = 0
        moved_count += move_out_of_window_targets(storage, current_dir, archive_dir, active_ids)
        moved_count += move_out_of_window_targets(storage, wide_dir, archive_wide_dir, active_ids)

        if not targets:
            manifest_images, root_manifest_path = write_manifests(storage)
            print(
                "SUMMARY "
                f"targets=0 generated_now=0 restored_now=0 skipped_existing=0 moved_to_archive={moved_count} "
                f"manifest_images={manifest_images} root_manifest={root_manifest_path.name} "
                f"config_mode={config_mode}"
            )
            return 0

        client = OpenAI(api_key=openai_key, base_url=oai_base_url.rstrip("/"))
        reuse_enabled = str(os.getenv(DEVOTIONAL_REUSE_ARCHIVE_ENABLED, "true")).strip().lower() not in {
            "0",
            "false",
            "no",
            "off",
        }

        total_written = 0
        total_restored = 0
        total_skipped_existing = 0
        by_source: Dict[str, int] = {SOURCE_CALENDAR: 0, SOURCE_DEVOTION: 0}

        for target in targets:
            maybe_migrate_legacy_file(storage, current_dir, target)
            maybe_migrate_legacy_file(storage, wide_dir, target)

            existing_portrait = find_existing_image_by_base(current_dir, target.base_name)
            existing_wide = find_existing_image_by_base(wide_dir, target.base_name)
            has_portrait = existing_portrait is not None
            has_wide = existing_wide is not None

            if has_portrait and has_wide:
                total_skipped_existing += 1
                print(
                    f"INFO skip_existing source={target.source} subject={target.subject} "
                    f"base={target.base_name} style_id={target.style_id}"
                )
                continue

            if reuse_enabled:
                restored_portrait, restored_wide = restore_target_from_archive(
                    storage,
                    target,
                    current_dir,
                    archive_dir,
                    wide_dir,
                    archive_wide_dir,
                )
                if restored_portrait or restored_wide:
                    total_restored += int(restored_portrait) + int(restored_wide)
                    has_portrait = has_portrait or restored_portrait
                    has_wide = has_wide or restored_wide
                    print(
                        f"INFO restored_from_archive source={target.source} subject={target.subject} "
                        f"base={target.base_name} restored_portrait={str(restored_portrait).lower()} "
                        f"restored_wide={str(restored_wide).lower()} style_id={target.style_id}"
                    )
                    if has_portrait and has_wide:
                        continue

            filename = f"{target.base_name}.{image_format}"
            window_text = (
                f"today={today.isoformat()}\n"
                f"source={target.source}\n"
                f"pipeline={target.pipeline_name}\n"
                f"start_date={target.start_date.isoformat()}\n"
                f"end_date={target.end_date.isoformat()}\n"
                f"source_date={target.source_date}\n"
                f"subject={target.subject}\n"
                f"style_id={target.style_id}\n"
                f"context={target.context}\n"
            )

            outputs_written = 0
            if not has_portrait:
                prompt_text = build_image_prompt(
                    client=client,
                    model=prompt_model,
                    target=target,
                    today=today,
                    layout_hint=(
                        "Phone prayer-card composition in portrait 2:3/9:16 style (not square). "
                        "Reserve an uncluttered title-safe band in the lower third near the bottom edge, "
                        "keeping the composition intentionally low rather than high or centered, "
                        "and absolutely do not paint any lettering, captions, plaques, banners, or readable symbols into the artwork itself. "
                        "Leave enough margin for a later title overlay to breathe without pushing it up toward the middle."
                    ),
                )
                image_bytes = generate_image_bytes(client, image_model, prompt_text, image_size, image_quality, image_format)
                image_bytes = apply_portrait_title_overlay(
                    image_bytes,
                    overlay_title_for_subject(target.subject),
                    image_format,
                )
                written_portrait = write_image_file(image_bytes, current_dir, filename)
                prompt_path = write_archived_sidecar(storage, written_portrait, ".prompt.txt", prompt_text)
                window_path = write_archived_sidecar(storage, written_portrait, ".window.txt", window_text)
                outputs_written += 1
                total_written += 1
                by_source[target.source] = by_source.get(target.source, 0) + 1
                print(f"INFO wrote_image={written_portrait}")
                print(f"INFO wrote_prompt={prompt_path}")
                print(f"INFO wrote_window={window_path}")

            if not has_wide:
                prompt_text_wide = build_image_prompt(
                    client=client,
                    model=prompt_model,
                    target=target,
                    today=today,
                    layout_hint=(
                        "Widescreen devotional background in native 16:9 composition (not square, not portrait). "
                        "Frame the scene for full-width landscape use with strong negative space in the lower third near the bottom edge, "
                        "and absolutely no text, typography, banners, plaques, or readable symbols rendered into the artwork."
                    ),
                )
                image_bytes_wide = generate_image_bytes(
                    client=client,
                    model=image_model,
                    prompt=prompt_text_wide,
                    size=image_size_wide,
                    quality=image_quality,
                    image_format=image_format,
                )
                image_bytes_wide = apply_wide_title_overlay(
                    image_bytes_wide,
                    overlay_title_for_subject(target.subject),
                    image_format,
                )
                written_wide = write_image_file(image_bytes_wide, wide_dir, filename)
                prompt_path_wide = write_archived_sidecar(storage, written_wide, ".prompt.txt", prompt_text_wide)
                window_path_wide = write_archived_sidecar(storage, written_wide, ".window.txt", window_text)
                outputs_written += 1
                total_written += 1
                by_source[target.source] = by_source.get(target.source, 0) + 1
                print(f"INFO wrote_image={written_wide}")
                print(f"INFO wrote_prompt={prompt_path_wide}")
                print(f"INFO wrote_window={window_path_wide}")

            if outputs_written:
                print(
                    f"INFO subject={target.subject} source={target.source} source_date={target.source_date} "
                    f"base={target.base_name} outputs={outputs_written} style_id={target.style_id}"
                )

        manifest_images, root_manifest_path = write_manifests(storage)
        print(
            "SUMMARY "
            f"targets={len(targets)} generated_now={total_written} restored_now={total_restored} "
            f"skipped_existing={total_skipped_existing} moved_to_archive={moved_count} "
            f"manifest_images={manifest_images} root_manifest={root_manifest_path.name} "
            f"calendar_generated={by_source.get(SOURCE_CALENDAR, 0)} devotion_generated={by_source.get(SOURCE_DEVOTION, 0)} "
            f"config_mode={config_mode}"
        )
        return 0
    except Exception as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
