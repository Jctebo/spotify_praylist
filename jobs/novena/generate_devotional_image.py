import base64
import calendar
import datetime
import os
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from openai import OpenAI

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
DEFAULT_WIDE_FOLDER = "Devotion Wide"

DEVOTIONAL_ONEDRIVE_DCIM_DIR = "DEVOTIONAL_ONEDRIVE_DCIM_DIR"
DEVOTIONAL_CURRENT_FOLDER = "DEVOTIONAL_CURRENT_FOLDER"
DEVOTIONAL_WIDE_FOLDER = "DEVOTIONAL_WIDE_FOLDER"
DEVOTIONAL_TARGET_DATE = "DEVOTIONAL_TARGET_DATE"  # YYYY-MM-DD

DEVOTIONAL_PROMPT_MODEL = "DEVOTIONAL_PROMPT_MODEL"  # default gpt-5-mini
DEVOTIONAL_IMAGE_MODEL = "DEVOTIONAL_IMAGE_MODEL"  # default gpt-image-1
DEVOTIONAL_IMAGE_SIZE = "DEVOTIONAL_IMAGE_SIZE"  # default 1024x1536 (phone portrait)
DEVOTIONAL_IMAGE_SIZE_WIDE = "DEVOTIONAL_IMAGE_SIZE_WIDE"  # default 1536x1024 (widescreen)
DEVOTIONAL_IMAGE_QUALITY = "DEVOTIONAL_IMAGE_QUALITY"  # default high
DEVOTIONAL_IMAGE_FORMAT = "DEVOTIONAL_IMAGE_FORMAT"  # default png
DEVOTIONAL_REUSE_ARCHIVE_ENABLED = "DEVOTIONAL_REUSE_ARCHIVE_ENABLED"  # default true
DEVOTIONAL_ALLOWED_RANKS = {"solemnity", "feast", "memorial", "optional_memorial"}

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

ON-IMAGE TEXT (AUTOMATIC)
- Title (e.g., Mary, Mother of God)
- No secondary caption line by default (title-only unless explicitly requested)
- Typography implied as refined, classical, unobtrusive
- Keep on-image text short (single title line preferred)
- Preserve safe text margins: leave at least 18% padding from left/right and 20% from top/bottom
- Place text in lower third or upper third with clear negative space
- Never place text touching borders, cropped areas, or bright/high-detail regions
- Prioritize legibility on phone lock screens
- Do not place text in the bottom 25% of portrait images (lock screen UI overlap risk)
- Keep all text inside a centered safe box (middle 60% width x middle 50% height)
- If text safety conflicts with composition, reduce text length further and keep title only

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


def _normalized_rank(event: Dict[str, str]) -> str:
    raw = str(event.get("rank_name", "") or event.get("rank", "")).strip().lower()
    return raw.replace("rank.", "")


def collect_image_candidates_window(
    calendar_name: str,
    locale: str,
    start_date: datetime.date,
    days: int,
) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    seen = set()
    for offset in range(days):
        dt = start_date + datetime.timedelta(days=offset)
        events = romcal_fetch_day(calendar_name, locale, dt)
        for event in events:
            if not isinstance(event, dict):
                continue
            rank = _normalized_rank(event)
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


def resolve_output_dirs() -> List[Path]:
    root_env = os.getenv(DEVOTIONAL_ONEDRIVE_DCIM_DIR, "").strip()
    root = Path(root_env) if root_env else default_dcim_dir()
    current_name = os.getenv(DEVOTIONAL_CURRENT_FOLDER, DEFAULT_CURRENT_FOLDER).strip() or DEFAULT_CURRENT_FOLDER
    wide_name = os.getenv(DEVOTIONAL_WIDE_FOLDER, DEFAULT_WIDE_FOLDER).strip() or DEFAULT_WIDE_FOLDER
    return [root / current_name, root / wide_name]


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


def scalar_property_payload(prop_type: str, value: str) -> Dict[str, Any]:
    text = str(value or "").strip()
    if prop_type == "title":
        return {"title": [{"type": "text", "text": {"content": text[:2000]}}]} if text else {"title": []}
    if prop_type == "rich_text":
        return {"rich_text": [{"type": "text", "text": {"content": text[:2000]}}]} if text else {"rich_text": []}
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
    return {"rich_text": [{"type": "text", "text": {"content": text[:2000]}}]} if text else {"rich_text": []}


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


def month_devotion_folder_name(day: datetime.date, source_folder_name: str) -> str:
    base = day.strftime("%B Devotion")
    if "wide" in str(source_folder_name or "").lower():
        return f"{base} Wide"
    return base


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


def move_sidecars(old_image: Path, new_image: Path) -> None:
    old_base = old_image.with_suffix("")
    new_base = new_image.with_suffix("")
    for suffix in (".prompt.txt", ".window.txt"):
        old_sidecar = old_base.with_suffix(suffix)
        if not old_sidecar.exists():
            continue
        new_sidecar = new_base.with_suffix(suffix)
        move_file_overwrite(old_sidecar, new_sidecar)


def maybe_migrate_legacy_file(folder: Path, target: RenderTarget) -> bool:
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
        move_sidecars(candidate, new_path)
        move_file_overwrite(candidate, new_path)
        print(f"INFO migrated_legacy_image old={candidate.name} new={new_path.name}")
        return True
    return False


def move_out_of_window_targets(source_dir: Path, active_ids: set[str], today: datetime.date) -> int:
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
        try:
            month_num = int(meta.start_mmdd.split("-", 1)[0])
            month_num = max(1, min(12, month_num))
        except Exception:
            month_num = today.month
        month_anchor = datetime.date(today.year, month_num, 1)
        archive_dir = source_dir.parent / month_devotion_folder_name(month_anchor, source_dir.name)
        archive_dir.mkdir(parents=True, exist_ok=True)

        dst_image = archive_dir / image_path.name
        move_sidecars(image_path, dst_image)
        move_file_overwrite(image_path, dst_image)
        moved += 1
    return moved


def restore_target_from_archive(
    target: RenderTarget,
    current_dir: Path,
    wide_dir: Path,
) -> Tuple[bool, bool]:
    start_month_anchor = datetime.date(local_today().year, target.start_date.month, 1)
    portrait_archive = current_dir.parent / month_devotion_folder_name(start_month_anchor, current_dir.name)
    wide_archive = wide_dir.parent / month_devotion_folder_name(start_month_anchor, wide_dir.name)
    if not portrait_archive.exists() and not wide_archive.exists():
        return False, False

    restored_portrait = False
    restored_wide = False

    if not find_existing_image_by_base(current_dir, target.base_name):
        src_portrait = find_existing_image_by_base(portrait_archive, target.base_name)
        if src_portrait and src_portrait.exists():
            dst_portrait = current_dir / src_portrait.name
            move_sidecars(src_portrait, dst_portrait)
            move_file_overwrite(src_portrait, dst_portrait)
            restored_portrait = True

    if not find_existing_image_by_base(wide_dir, target.base_name):
        src_wide = find_existing_image_by_base(wide_archive, target.base_name)
        if src_wide and src_wide.exists():
            dst_wide = wide_dir / src_wide.name
            move_sidecars(src_wide, dst_wide)
            move_file_overwrite(src_wide, dst_wide)
            restored_wide = True

    return restored_portrait, restored_wide


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


def write_image_file(image_bytes: bytes, output_dir: Path, filename: str) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / filename
    out_path.write_bytes(image_bytes)
    return out_path


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
                start_day = feast_day - datetime.timedelta(days=days - 1)
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

    return sorted(targets, key=lambda t: (t.start_date.isoformat(), t.end_date.isoformat(), t.source, t.subject_slug, t.style_id))


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

        output_dirs = resolve_output_dirs()
        current_dir, wide_dir = output_dirs[0], output_dirs[1]
        active_ids = {target_id(t) for t in targets}

        moved_count = 0
        for folder in output_dirs:
            moved_count += move_out_of_window_targets(folder, active_ids, today)

        if not targets:
            print(
                "SUMMARY "
                f"targets=0 generated_now=0 restored_now=0 skipped_existing=0 moved_to_month_folder={moved_count} "
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
            maybe_migrate_legacy_file(current_dir, target)
            maybe_migrate_legacy_file(wide_dir, target)

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
                restored_portrait, restored_wide = restore_target_from_archive(target, current_dir, wide_dir)
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
                        "Dedicate an uncluttered text band in upper-middle area for one short title line only, "
                        "with generous margins so text cannot be clipped by lock-screen crop."
                    ),
                )
                image_bytes = generate_image_bytes(client, image_model, prompt_text, image_size, image_quality, image_format)
                written_portrait = write_image_file(image_bytes, current_dir, filename)
                prompt_path = written_portrait.with_suffix(".prompt.txt")
                prompt_path.write_text(prompt_text, encoding="utf-8")
                window_path = written_portrait.with_suffix(".window.txt")
                window_path.write_text(window_text, encoding="utf-8")
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
                        "Frame the scene for full-width landscape use with one short title line only, fully inside a centered safe area, "
                        "keeping at least 15% margin from every edge and avoiding edge-anchored typography."
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
                written_wide = write_image_file(image_bytes_wide, wide_dir, filename)
                prompt_path_wide = written_wide.with_suffix(".prompt.txt")
                prompt_path_wide.write_text(prompt_text_wide, encoding="utf-8")
                window_path_wide = written_wide.with_suffix(".window.txt")
                window_path_wide.write_text(window_text, encoding="utf-8")
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

        print(
            "SUMMARY "
            f"targets={len(targets)} generated_now={total_written} restored_now={total_restored} "
            f"skipped_existing={total_skipped_existing} moved_to_month_folder={moved_count} "
            f"calendar_generated={by_source.get(SOURCE_CALENDAR, 0)} devotion_generated={by_source.get(SOURCE_DEVOTION, 0)} "
            f"config_mode={config_mode}"
        )
        return 0
    except Exception as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
