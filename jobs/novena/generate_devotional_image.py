import base64
import datetime
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Dict, List, Optional, Sequence

from openai import OpenAI

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from jobs.novena.generate_daily_novena_prayer import (
    OAI_API_BASE_URL,
    OPENAI_API_KEY,
    ROMCAL_CALENDAR,
    ROMCAL_LOCALE,
    ROMCAL_WINDOW_DAYS,
    collect_saints_window,
    int_env,
    local_today,
    require_env,
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
- Optional short devotional caption or invocation
- Typography implied as refined, classical, unobtrusive
- Keep on-image text very short (title + max one brief invocation line)
- Preserve safe text margins: leave at least 12% padding from all edges
- Place text in lower third or upper third with clear negative space
- Never place text touching borders, cropped areas, or bright/high-detail regions
- Prioritize legibility on phone lock screens

OUTPUT FORMAT (AUTOMATIC)
Return only one complete image prompt, fully structured and directly usable for image generation.
Do not include extra commentary."""


def parse_target_date() -> Optional[datetime.date]:
    raw = os.getenv(DEVOTIONAL_TARGET_DATE, "").strip()
    if not raw:
        return None
    try:
        return datetime.date.fromisoformat(raw)
    except Exception:
        raise RuntimeError(f"Invalid {DEVOTIONAL_TARGET_DATE}='{raw}'. Use YYYY-MM-DD.")


def select_target_saint(saints: Sequence[Dict[str, str]], today: datetime.date, target: Optional[datetime.date]) -> Dict[str, str]:
    if not saints:
        raise RuntimeError("No saints found in the configured window.")
    if target:
        for row in saints:
            if str(row.get("date", "")).strip() == target.isoformat():
                return row
        raise RuntimeError(f"No saint found for target date {target.isoformat()} in the configured window.")
    for row in saints:
        if str(row.get("date", "")).strip() == today.isoformat():
            return row
    return saints[0]


def saint_key(row: Dict[str, str]) -> str:
    day = str(row.get("date", "")).strip()
    name = str(row.get("name", "")).strip()
    return f"{day}|{slugify(name)}"


def parse_saint_key_from_filename(path: Path) -> Optional[str]:
    name = path.name
    # New format: ..._saint_YYYY-MM-DD_slug.ext
    new_match = re.search(r"_saint_(\d{4}-\d{2}-\d{2})_([a-z0-9_]+)\.(png|jpeg|webp)$", name, flags=re.IGNORECASE)
    if new_match:
        return f"{new_match.group(1)}|{new_match.group(2).lower()}"
    # Legacy format: YYYY-MM-DD_slug.ext (no saint date marker)
    old_match = re.search(r"^\d{4}-\d{2}-\d{2}_([a-z0-9_]+)\.(png|jpeg|webp)$", name, flags=re.IGNORECASE)
    if old_match:
        return f"|{old_match.group(1).lower()}"
    return None


def existing_generated_saint_keys(output_dirs: Sequence[Path]) -> set[str]:
    keys: set[str] = set()
    for folder in output_dirs:
        if not folder.exists():
            continue
        for ext in ("*.png", "*.jpeg", "*.webp"):
            for file in folder.glob(ext):
                key = parse_saint_key_from_filename(file)
                if key:
                    keys.add(key)
    return keys


def saint_date_from_filename(path: Path) -> Optional[datetime.date]:
    name = path.name
    match = re.search(r"_saint_(\d{4}-\d{2}-\d{2})_[a-z0-9_]+\.(png|jpeg|webp)$", name, flags=re.IGNORECASE)
    if not match:
        return None
    try:
        return datetime.date.fromisoformat(match.group(1))
    except Exception:
        return None


def month_devotion_folder_name(day: datetime.date) -> str:
    return day.strftime("%B Devotion")


def move_current_devotion_completed_saints(current_dir: Path, today: datetime.date) -> int:
    if not current_dir.exists():
        return 0
    moved = 0
    archive_dir = current_dir.parent / month_devotion_folder_name(today)
    archive_dir.mkdir(parents=True, exist_ok=True)

    image_files: List[Path] = []
    for ext in ("*.png", "*.jpeg", "*.webp"):
        image_files.extend(current_dir.glob(ext))

    for image_path in image_files:
        saint_day = saint_date_from_filename(image_path)
        if saint_day is None or saint_day >= today:
            continue

        # Move image and any sidecar files with same basename.
        base = image_path.with_suffix("")
        to_move = [image_path, base.with_suffix(".prompt.txt"), base.with_suffix(".window.txt")]
        for src in to_move:
            if not src.exists():
                continue
            dst = archive_dir / src.name
            if dst.exists():
                dst.unlink()
            shutil.move(str(src), str(dst))
        moved += 1
    return moved


def pick_next_unseen_saint(
    saints: Sequence[Dict[str, str]],
    today: datetime.date,
    generated_keys: set[str],
) -> Dict[str, str]:
    if not saints:
        raise RuntimeError("No saints found in the configured window.")
    # Prefer today's saint if unseen.
    for row in saints:
        if str(row.get("date", "")).strip() == today.isoformat():
            key = saint_key(row)
            if key not in generated_keys and f"|{key.split('|', 1)[1]}" not in generated_keys:
                return row
    # Then first unseen upcoming saint.
    for row in saints:
        key = saint_key(row)
        if key not in generated_keys and f"|{key.split('|', 1)[1]}" not in generated_keys:
            return row
    raise RuntimeError("All saints in the current window already have generated image files.")


def pick_all_unseen_saints(
    saints: Sequence[Dict[str, str]],
    generated_keys: set[str],
) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    for row in saints:
        key = saint_key(row)
        legacy_key = f"|{key.split('|', 1)[1]}"
        if key in generated_keys or legacy_key in generated_keys:
            continue
        out.append(row)
    return out


def slugify(text: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", str(text or "").strip().lower())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or "saint"


def default_dcim_dir() -> Path:
    user_profile = os.getenv("USERPROFILE", "").strip()
    if not user_profile:
        raise RuntimeError("USERPROFILE is not set; cannot infer OneDrive path.")
    return Path(user_profile) / Path(DEFAULT_DCIM_RELATIVE)


def resolve_output_dirs() -> List[Path]:
    root = Path(os.getenv(DEVOTIONAL_ONEDRIVE_DCIM_DIR, "").strip()) if os.getenv(DEVOTIONAL_ONEDRIVE_DCIM_DIR, "").strip() else default_dcim_dir()
    current_name = os.getenv(DEVOTIONAL_CURRENT_FOLDER, DEFAULT_CURRENT_FOLDER).strip() or DEFAULT_CURRENT_FOLDER
    wide_name = os.getenv(DEVOTIONAL_WIDE_FOLDER, DEFAULT_WIDE_FOLDER).strip() or DEFAULT_WIDE_FOLDER
    return [root / current_name, root / wide_name]


def extract_output_text(response: object) -> str:
    text = str(getattr(response, "output_text", "") or "").strip()
    if text:
        return text
    return ""


def format_saints_window(saints: Sequence[Dict[str, str]]) -> str:
    rows: List[str] = []
    for row in saints:
        day = str(row.get("date", "")).strip()
        name = str(row.get("name", "")).strip()
        if day and name:
            rows.append(f"- {day} - {name}")
    return "\n".join(rows)


def build_image_prompt(
    client: OpenAI,
    model: str,
    subject: str,
    today: datetime.date,
    window_start: datetime.date,
    window_end: datetime.date,
    saints: Sequence[Dict[str, str]],
    layout_hint: str,
) -> str:
    saint_lines = format_saints_window(saints)
    response = client.responses.create(
        model=model,
        input=[
            {"role": "system", "content": [{"type": "input_text", "text": PROMPT_INSTRUCTION}]},
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            f"SUBJECT:\n{subject}\n\n"
                            f"CURRENT DATE:\n{today.isoformat()}\n\n"
                            f"NINE DAY WINDOW:\n{window_start.isoformat()} to {window_end.isoformat()}\n\n"
                            f"UPCOMING SAINTS (9 DAYS):\n{saint_lines}\n\n"
                            f"OUTPUT COMPOSITION:\n{layout_hint}"
                        ),
                    }
                ],
            },
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


def main() -> int:
    try:
        openai_key = require_env(OPENAI_API_KEY)
        oai_base_url = os.getenv(OAI_API_BASE_URL, "https://api.openai.com/v1").strip() or "https://api.openai.com/v1"

        romcal_calendar = os.getenv(ROMCAL_CALENDAR, "general_roman").strip() or "general_roman"
        romcal_locale = os.getenv(ROMCAL_LOCALE, "en").strip() or "en"
        window_days = int_env(ROMCAL_WINDOW_DAYS, default=9, min_value=1, max_value=30)

        prompt_model = os.getenv(DEVOTIONAL_PROMPT_MODEL, "gpt-5-mini").strip() or "gpt-5-mini"
        image_model = os.getenv(DEVOTIONAL_IMAGE_MODEL, "gpt-image-1").strip() or "gpt-image-1"
        image_size = os.getenv(DEVOTIONAL_IMAGE_SIZE, "1024x1536").strip() or "1024x1536"
        image_size_wide = os.getenv(DEVOTIONAL_IMAGE_SIZE_WIDE, "1536x1024").strip() or "1536x1024"
        image_quality = os.getenv(DEVOTIONAL_IMAGE_QUALITY, "high").strip() or "high"
        image_format = os.getenv(DEVOTIONAL_IMAGE_FORMAT, "png").strip().lower() or "png"
        if image_format not in {"png", "jpeg", "webp"}:
            raise RuntimeError(f"Invalid {DEVOTIONAL_IMAGE_FORMAT}='{image_format}'.")

        today = local_today()
        window_start = today
        window_end = window_start + datetime.timedelta(days=window_days - 1)
        target_date = parse_target_date()
        saints = collect_saints_window(romcal_calendar, romcal_locale, today, window_days)
        output_dirs = resolve_output_dirs()
        current_dir, wide_dir = output_dirs[0], output_dirs[1]
        moved_count = move_current_devotion_completed_saints(output_dirs[0], today)
        generated_keys = existing_generated_saint_keys(output_dirs)
        if target_date:
            targets = [select_target_saint(saints, today, target_date)]
        else:
            targets = pick_all_unseen_saints(saints, generated_keys)
            if not targets:
                raise RuntimeError("All saints in the current window already have generated image files.")

        client = OpenAI(api_key=openai_key, base_url=oai_base_url.rstrip("/"))
        total_written = 0
        for target in targets:
            subject = str(target.get("name", "")).strip()
            if not subject:
                continue
            prompt_text = build_image_prompt(
                client=client,
                model=prompt_model,
                subject=subject,
                today=today,
                window_start=window_start,
                window_end=window_end,
                saints=saints,
                layout_hint=(
                    "Phone portrait devotional wallpaper. Vertical composition (9:16 feel), "
                    "subject centered with clear negative space for short title text."
                ),
            )
            prompt_text_wide = build_image_prompt(
                client=client,
                model=prompt_model,
                subject=subject,
                today=today,
                window_start=window_start,
                window_end=window_end,
                saints=saints,
                layout_hint=(
                    "Widescreen devotional background. Horizontal composition (16:9 feel), "
                    "subject framed for landscape displays with text-safe margins."
                ),
            )

            image_bytes = generate_image_bytes(client, image_model, prompt_text, image_size, image_quality, image_format)
            image_bytes_wide = generate_image_bytes(
                client, image_model, prompt_text_wide, image_size_wide, image_quality, image_format
            )

            safe_subject = slugify(subject)
            target_day = str(target.get("date", "")).strip() or today.isoformat()
            filename = (
                f"{today.isoformat()}_win_{window_start.isoformat()}_to_{window_end.isoformat()}_"
                f"saint_{target_day}_{safe_subject}.{image_format}"
            )
            written_portrait = write_image_file(image_bytes, current_dir, filename)
            written_wide = write_image_file(image_bytes_wide, wide_dir, filename)
            total_written += 1

            prompt_path = written_portrait.with_suffix(".prompt.txt")
            prompt_path.write_text(prompt_text, encoding="utf-8")
            window_path = written_portrait.with_suffix(".window.txt")
            window_path.write_text(
                (
                    f"today={today.isoformat()}\n"
                    f"window_start={window_start.isoformat()}\n"
                    f"window_end={window_end.isoformat()}\n"
                    f"saints_in_window={len(saints)}\n"
                    f"selected_saint_date={target_day}\n"
                    f"selected_saint_name={subject}\n\n"
                    f"{format_saints_window(saints)}\n"
                ),
                encoding="utf-8",
            )
            prompt_path_wide = written_wide.with_suffix(".prompt.txt")
            prompt_path_wide.write_text(prompt_text_wide, encoding="utf-8")
            window_path_wide = written_wide.with_suffix(".window.txt")
            window_path_wide.write_text(window_path.read_text(encoding="utf-8"), encoding="utf-8")

            print(
                f"INFO subject={subject} source_date={target.get('date','')} "
                f"filename={filename} outputs=2"
            )
            print(f"INFO wrote_image={written_portrait}")
            print(f"INFO wrote_image={written_wide}")
            print(f"INFO wrote_prompt={prompt_path}")
            print(f"INFO wrote_window={window_path}")
            print(f"INFO wrote_prompt={prompt_path_wide}")
            print(f"INFO wrote_window={window_path_wide}")

        print(
            f"SUMMARY saints_in_window={len(saints)} generated_now={total_written} "
            f"window_start={window_start.isoformat()} window_end={window_end.isoformat()} moved_to_month_folder={moved_count}"
        )
        return 0
    except Exception as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
