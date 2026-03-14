import datetime
import hashlib
import importlib.util
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

import imageio_ffmpeg
import requests
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[2]
FFMPEG_BINARY = imageio_ffmpeg.get_ffmpeg_exe()

NOTION_DATABASE_ID = "NOTION_DATABASE_ID"
NOTION_DATABASE_NAME = "NOTION_DATABASE_NAME"
NOTION_TITLE_PROPERTY = "NOTION_TITLE_PROPERTY"
NOTION_PLATFORM_PROPERTY = "NOTION_PLATFORM_PROPERTY"
JOB_UTC_OFFSET = "JOB_UTC_OFFSET"

OPENAI_API_KEY = "OPENAI_API_KEY"
OAI_API_BASE_URL = "OAI_API_BASE_URL"
NOTION_TOKEN = "NOTION_TOKEN"

NOTION_AUDIO_PLATFORM_VALUE = "NOTION_AUDIO_PLATFORM_VALUE"
NOTION_AUDIO_RESOLVER_PROPERTY = "NOTION_AUDIO_RESOLVER_PROPERTY"
NOTION_AUDIO_ENABLED_PROPERTY = "NOTION_AUDIO_ENABLED_PROPERTY"
PAGE_AUDIO_CONFIG_KEY = "PAGE_AUDIO_CONFIG_KEY"
PAGE_AUDIO_ROW_TITLE = "PAGE_AUDIO_ROW_TITLE"
PAGE_AUDIO_CONFIG_FILE = "PAGE_AUDIO_CONFIG_FILE"
PAGE_AUDIO_CACHE_DIR = "PAGE_AUDIO_CACHE_DIR"
PAGE_AUDIO_FAIL_OPEN = "PAGE_AUDIO_FAIL_OPEN"

DEFAULT_PAGE_AUDIO_CONFIG_FILE = "config/page_audio_config.json"
DEFAULT_PAGE_AUDIO_CACHE_DIR = ".cache/page_audio"
DEFAULT_AUTO_AUDIO_PLATFORM_VALUE = "auto-audio"
PAGE_AUDIO_MARKER = "[AUTOGEN_PAGE_AUDIO]"
PAGE_AUDIO_HASH_MARKER_PREFIX = "[AUTOGEN_PAGE_AUDIO_HASH:"
PAGE_AUDIO_RENDER_VERSION = "page_audio_v1"
DEFAULT_SILENCE_MS = 450
DEFAULT_DAILY_NOVENA_PAGE_TITLE = "Daily Novenas from Liturgical Calendar"
MORNING_PRAYER_BUILDER = "morning_prayer_v1"
POPES_PRAYER_MEDIA_API_URL = "https://www.popesprayer.va/wp-json/wp/v2/media"
HTTP_RETRYABLE_STATUSES = {408, 409, 425, 429, 500, 502, 503, 504}
HTTP_MAX_ATTEMPTS = 4
MONTH_NAMES = (
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
)
TEXT_SANITIZE_REPLACEMENTS = {
    "without reserve.tog": "without reserve.",
}


def load_shared_module():
    shared_path = ROOT / "jobs" / "novena" / "generate_daily_novena_prayer.py"
    spec = importlib.util.spec_from_file_location("page_audio_shared", shared_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load shared module at {shared_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


shared = load_shared_module()


@dataclass
class PageAudioFragment:
    kind: str
    label: str
    hash_value: str
    text: str = ""
    source_url: str = ""
    content_type: str = ""
    cache_path: str = ""


def slugify(text: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", str(text or "").lower()).strip("-")
    return value or "page-audio"


def page_audio_hash_marker(render_hash: str) -> str:
    return f"{PAGE_AUDIO_HASH_MARKER_PREFIX}{str(render_hash or '').strip()}]"


def extract_page_audio_render_hash(text: str) -> str:
    match = re.search(r"\[AUTOGEN_PAGE_AUDIO_HASH:([0-9a-f]{8,64})\]", str(text or "").strip(), re.IGNORECASE)
    return str(match.group(1)).lower() if match else ""


def page_property_text(page: Dict[str, Any], prop_name: str) -> str:
    props = page.get("properties") or {}
    prop = props.get(prop_name) or {}
    ptype = str(prop.get("type", "")).strip()
    if ptype == "title":
        return " ".join(
            str(item.get("plain_text", "")).strip()
            for item in (prop.get("title") or [])
            if isinstance(item, dict) and str(item.get("plain_text", "")).strip()
        ).strip()
    if ptype == "rich_text":
        return " ".join(
            str(item.get("plain_text", "")).strip()
            for item in (prop.get("rich_text") or [])
            if isinstance(item, dict) and str(item.get("plain_text", "")).strip()
        ).strip()
    if ptype == "select":
        return str((prop.get("select") or {}).get("name", "")).strip()
    if ptype == "multi_select":
        return ", ".join(
            str(item.get("name", "")).strip()
            for item in (prop.get("multi_select") or [])
            if isinstance(item, dict) and str(item.get("name", "")).strip()
        ).strip()
    if ptype == "number":
        value = prop.get("number")
        return "" if value is None else str(value).strip()
    if ptype == "url":
        return str(prop.get("url", "")).strip()
    if ptype == "formula":
        formula = prop.get("formula") or {}
        if "string" in formula:
            return str(formula.get("string", "")).strip()
    return ""


def page_property_checkbox(page: Dict[str, Any], prop_name: str, default: bool = False) -> bool:
    props = page.get("properties") or {}
    prop = props.get(prop_name) or {}
    if str(prop.get("type", "")).strip() == "checkbox":
        return bool(prop.get("checkbox"))
    value = page_property_text(page, prop_name).strip().lower()
    if not value:
        return default
    return value in {"1", "true", "yes", "y", "on"}


def normalize_whitespace(text: str) -> str:
    value = str(text or "")
    for bad, good in TEXT_SANITIZE_REPLACEMENTS.items():
        value = value.replace(bad, good)
    value = value.replace("\xa0", " ")
    value = re.sub(r"\s+\n", "\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    value = re.sub(r"[ \t]{2,}", " ", value)
    return value.strip()


def is_parenthesized_placeholder(text: str) -> bool:
    value = str(text or "").strip()
    return len(value) >= 2 and value.startswith("(") and value.endswith(")")


def placeholder_kind(text: str) -> str:
    if not is_parenthesized_placeholder(text):
        return ""
    inner = str(text or "").strip()[1:-1].strip().lower()
    if "daily novena fragment" in inner:
        return "daily_novena"
    if "monthly fragment" in inner:
        return "monthly_intention"
    return ""


def load_page_audio_config() -> Dict[str, Any]:
    config_path = ROOT / (
        os.getenv(PAGE_AUDIO_CONFIG_FILE, DEFAULT_PAGE_AUDIO_CONFIG_FILE).strip()
        or DEFAULT_PAGE_AUDIO_CONFIG_FILE
    )
    with open(config_path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)
    if not isinstance(payload, dict):
        raise RuntimeError(f"Invalid page audio config format in {config_path}: root must be an object.")
    configs = payload.get("configs")
    if not isinstance(configs, dict) or not configs:
        raise RuntimeError(f"Invalid page audio config format in {config_path}: missing or empty 'configs'.")
    return payload


def page_audio_cache_dir() -> Path:
    value = os.getenv(PAGE_AUDIO_CACHE_DIR, DEFAULT_PAGE_AUDIO_CACHE_DIR).strip() or DEFAULT_PAGE_AUDIO_CACHE_DIR
    path = ROOT / value
    path.mkdir(parents=True, exist_ok=True)
    return path


def page_audio_http_should_retry(exc: requests.exceptions.RequestException) -> bool:
    if isinstance(exc, (requests.exceptions.Timeout, requests.exceptions.ConnectionError)):
        return True
    if isinstance(exc, requests.exceptions.HTTPError):
        response = exc.response
        return bool(response is not None and response.status_code in HTTP_RETRYABLE_STATUSES)
    return False


def page_audio_http_retry_delay(exc: requests.exceptions.RequestException, attempt: int) -> float:
    if isinstance(exc, requests.exceptions.HTTPError) and exc.response is not None:
        retry_after = str(exc.response.headers.get("Retry-After", "")).strip()
        if retry_after:
            try:
                return max(0.0, float(retry_after))
            except ValueError:
                pass
    return min(20.0, float(2 ** max(attempt - 1, 0)))


def page_audio_http_get(url: str, *, params: Optional[Dict[str, Any]] = None, timeout: int = 30) -> requests.Response:
    for attempt in range(1, HTTP_MAX_ATTEMPTS + 1):
        try:
            response = requests.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as exc:
            if attempt >= HTTP_MAX_ATTEMPTS or not page_audio_http_should_retry(exc):
                raise
            delay = page_audio_http_retry_delay(exc, attempt)
            print(
                f"WARN page_audio_http_retry attempt={attempt} delay={delay:.1f}s url={url}",
                file=sys.stderr,
            )
            time.sleep(delay)
    raise RuntimeError("HTTP retry loop exited unexpectedly.")


def tts_settings_from_config(config: Dict[str, Any]) -> Dict[str, Any]:
    tts = config.get("tts") or {}
    if not isinstance(tts, dict):
        raise RuntimeError("Invalid page audio config: 'tts' must be an object.")
    model = str(tts.get("model", "gpt-4o-mini-tts")).strip() or "gpt-4o-mini-tts"
    voice = str(tts.get("voice", "alloy")).strip() or "alloy"
    audio_format = str(tts.get("format", "mp3")).strip().lower() or "mp3"
    if audio_format not in {"mp3", "opus", "aac", "flac", "wav"}:
        raise RuntimeError(f"Invalid page audio format '{audio_format}'.")
    try:
        speed = float(tts.get("speed", 1.0))
    except Exception as exc:
        raise RuntimeError("Invalid page audio speed.") from exc
    return {"model": model, "voice": voice, "format": audio_format, "speed": speed}


def list_audio_candidate_pages(
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    platform_property: str,
    platform_value: str,
    resolver_property: str,
    enabled_property: str,
    config_key_filter: str,
    row_title_filter: str,
) -> List[Dict[str, Any]]:
    wanted_platform = str(platform_value or "").strip().lower()
    wanted_key = str(config_key_filter or "").strip().lower()
    wanted_title = str(row_title_filter or "").strip().lower()
    out: List[Dict[str, Any]] = []
    for page in pages:
        if not isinstance(page, dict):
            continue
        title = shared.page_title(page, title_property).strip()
        if wanted_title and title.lower() != wanted_title:
            continue
        if not page_property_checkbox(page, enabled_property, default=False):
            continue
        platform = page_property_text(page, platform_property).lower()
        if wanted_platform not in platform:
            continue
        config_key = page_property_text(page, resolver_property).strip()
        if not config_key:
            continue
        if wanted_key and config_key.lower() != wanted_key:
            continue
        out.append(page)
    return out


def find_page_by_title(pages: Sequence[Dict[str, Any]], title_property: str, wanted_title: str) -> Dict[str, Any]:
    wanted = str(wanted_title or "").strip().lower()
    for page in pages:
        if not isinstance(page, dict):
            continue
        if shared.page_title(page, title_property).strip().lower() == wanted:
            return page
    raise RuntimeError(f"Could not find page titled '{wanted_title}'.")


def resolved_placeholder_text(text: str, monthly_text: str) -> Optional[str]:
    value = normalize_whitespace(text)
    kind = placeholder_kind(value)
    if kind == "monthly_intention":
        return monthly_text
    if kind == "daily_novena":
        return None
    return value


def child_text_lines(block: Dict[str, Any], token: str, monthly_text: str) -> List[str]:
    block_type = str(block.get("type", "")).strip()
    text = resolved_placeholder_text(shared.block_rich_text_plain(block), monthly_text)
    lines: List[str] = []
    if text and block_type not in {"heading_1", "heading_2", "heading_3"}:
        lines.append(text)
    if bool(block.get("has_children")):
        block_id = str(block.get("id", "")).strip()
        if block_id:
            for child in shared.notion_list_block_children(block_id, token):
                child_text = resolved_placeholder_text(shared.block_rich_text_plain(child), monthly_text)
                if child_text:
                    lines.append(child_text)
    return [line for line in lines if line]


def build_monthly_intention_fragment(monthly_intention: Dict[str, str], settings: Dict[str, Any], base_url: str) -> PageAudioFragment:
    spoken_text = str(monthly_intention.get("spoken_text", "")).strip()
    if not spoken_text:
        raise RuntimeError("Monthly intention resolver returned empty text.")
    hash_value = shared.compute_audio_render_hash(spoken_text, base_url, settings)
    return PageAudioFragment(
        kind="tts",
        label=f"Monthly Intention - {monthly_intention.get('title', '').strip() or monthly_intention.get('month', '').strip()}",
        hash_value=hash_value,
        text=spoken_text,
    )


def audio_block_source_url(block: Dict[str, Any]) -> str:
    audio = block.get("audio") or {}
    audio_type = str(audio.get("type", "")).strip()
    if audio_type == "file":
        return str((audio.get("file") or {}).get("url", "")).strip()
    if audio_type == "external":
        return str((audio.get("external") or {}).get("url", "")).strip()
    return ""


def source_audio_fragment_hash(block: Dict[str, Any]) -> str:
    caption = shared.audio_block_caption(block)
    render_hash = shared.extract_render_hash(caption)
    if render_hash:
        return render_hash
    url = audio_block_source_url(block)
    raw = f"{caption}|{url}|{str(block.get('id', '')).strip()}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


def build_daily_novena_audio_fragments(
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    daily_novena_page_title: str,
    token: str,
) -> List[PageAudioFragment]:
    page = find_page_by_title(pages, title_property, daily_novena_page_title)
    page_id = str(page.get("id", "")).strip()
    if not page_id:
        raise RuntimeError("Daily novena source page has no id.")
    out: List[PageAudioFragment] = []
    for block in shared.notion_list_block_children(page_id, token):
        if str(block.get("type", "")).strip() != "audio":
            continue
        caption = shared.audio_block_caption(block)
        if shared.NOVENA_AUDIO_MARKER not in caption:
            continue
        url = audio_block_source_url(block)
        if not url:
            continue
        out.append(
            PageAudioFragment(
                kind="source_audio",
                label=caption or "Daily Novena Audio",
                hash_value=source_audio_fragment_hash(block),
                source_url=url,
            )
        )
    if not out:
        raise RuntimeError(f"No generated novena audio blocks found on '{daily_novena_page_title}'.")
    return out


def build_morning_prayer_fragments(
    page: Dict[str, Any],
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    config: Dict[str, Any],
    token: str,
    base_url: str,
) -> List[PageAudioFragment]:
    page_id = str(page.get("id", "")).strip()
    if not page_id:
        raise RuntimeError("Target page has no id.")
    settings = tts_settings_from_config(config)
    monthly_intention = fetch_monthly_intention(shared.local_today())
    monthly_fragment = build_monthly_intention_fragment(monthly_intention, settings, base_url)
    novena_page_title = (
        str(config.get("daily_novena_page_title", DEFAULT_DAILY_NOVENA_PAGE_TITLE)).strip()
        or DEFAULT_DAILY_NOVENA_PAGE_TITLE
    )
    daily_novena_fragments = build_daily_novena_audio_fragments(pages, title_property, novena_page_title, token)

    fragments: List[PageAudioFragment] = []
    current_heading = ""
    current_lines: List[str] = []

    def flush_heading() -> None:
        nonlocal current_heading, current_lines
        if not current_heading or not current_lines:
            current_heading = ""
            current_lines = []
            return
        body = normalize_whitespace("\n".join(current_lines))
        if not body:
            current_heading = ""
            current_lines = []
            return
        text = normalize_whitespace(f"{current_heading}.\n\n{body}")
        hash_value = shared.compute_audio_render_hash(text, base_url, settings)
        fragments.append(PageAudioFragment(kind="tts", label=current_heading, hash_value=hash_value, text=text))
        current_heading = ""
        current_lines = []

    for block in shared.notion_list_block_children(page_id, token):
        block_type = str(block.get("type", "")).strip()
        if block_type in {"bookmark", "audio"}:
            continue
        text = normalize_whitespace(shared.block_rich_text_plain(block))
        kind = placeholder_kind(text)
        if block_type == "heading_2":
            continue
        if block_type == "heading_3":
            flush_heading()
            current_heading = text
            current_lines = child_text_lines(block, token, monthly_fragment.text)
            continue
        if kind == "daily_novena":
            flush_heading()
            fragments.extend(daily_novena_fragments)
            continue
        lines = child_text_lines(block, token, monthly_fragment.text)
        if not lines:
            continue
        if current_heading:
            current_lines.extend(lines)
        else:
            text = normalize_whitespace("\n".join(lines))
            hash_value = shared.compute_audio_render_hash(text, base_url, settings)
            fragments.append(PageAudioFragment(kind="tts", label=text[:80], hash_value=hash_value, text=text))

    flush_heading()
    if not fragments:
        raise RuntimeError("No audio fragments were produced for Morning Prayer.")
    return fragments


def compute_page_render_hash(
    config_key: str,
    config: Dict[str, Any],
    fragments: Sequence[PageAudioFragment],
) -> str:
    payload = {
        "type": PAGE_AUDIO_RENDER_VERSION,
        "config_key": str(config_key or "").strip(),
        "builder": str(config.get("builder", "")).strip(),
        "audio_caption": str(config.get("audio_caption", "")).strip(),
        "silence_ms": int(config.get("silence_ms", DEFAULT_SILENCE_MS)),
        "tts": tts_settings_from_config(config),
        "fragments": [
            {"kind": fragment.kind, "label": fragment.label, "hash": fragment.hash_value}
            for fragment in fragments
        ],
    }
    return shared.compute_render_hash(payload)


def page_audio_cache_path(cache_root: Path, bucket: str, hash_value: str, extension: str) -> Path:
    clean_ext = str(extension or "").strip().lstrip(".") or "bin"
    path = cache_root / bucket / hash_value[:2] / hash_value[2:4]
    path.mkdir(parents=True, exist_ok=True)
    return path / f"{hash_value}.{clean_ext}"


def page_audio_current_render_hash(page_id: str, token: str) -> str:
    for block in shared.notion_list_block_children(page_id, token):
        if str(block.get("type", "")).strip() != "audio":
            continue
        caption = shared.audio_block_caption(block)
        if PAGE_AUDIO_MARKER not in caption:
            continue
        render_hash = extract_page_audio_render_hash(caption)
        if render_hash:
            return render_hash
    return ""


def page_audio_remove_old_blocks(page_id: str, token: str) -> int:
    removed = 0
    for block in shared.notion_list_block_children(page_id, token):
        if str(block.get("type", "")).strip() != "audio":
            continue
        caption = shared.audio_block_caption(block)
        if PAGE_AUDIO_MARKER not in caption:
            continue
        block_id = str(block.get("id", "")).strip()
        if not block_id:
            continue
        shared.notion_archive_block(block_id, token)
        removed += 1
    return removed


def page_audio_remove_blank_placeholders(page_id: str, token: str) -> int:
    removed = 0
    for block in shared.notion_list_block_children(page_id, token):
        if str(block.get("type", "")).strip() != "audio":
            continue
        caption = shared.audio_block_caption(block)
        url = audio_block_source_url(block)
        if caption or url:
            continue
        block_id = str(block.get("id", "")).strip()
        if not block_id:
            continue
        shared.notion_archive_block(block_id, token)
        removed += 1
    return removed


def page_audio_append_block(page_id: str, upload_id: str, caption: str, token: str) -> None:
    full_caption = f"{str(caption or '').strip()} {PAGE_AUDIO_MARKER}".strip()
    block = {
        "object": "block",
        "type": "audio",
        "audio": {
            "type": "file_upload",
            "file_upload": {"id": upload_id},
            "caption": [{"type": "text", "text": {"content": full_caption}}],
        },
    }
    shared.notion_append_children(page_id, [block], token)


def ffmpeg_audio_codec(audio_format: str) -> str:
    fmt = str(audio_format or "").strip().lower()
    if fmt == "mp3":
        return "libmp3lame"
    if fmt == "wav":
        return "pcm_s16le"
    if fmt == "aac":
        return "aac"
    if fmt == "opus":
        return "libopus"
    if fmt == "flac":
        return "flac"
    raise RuntimeError(f"Unsupported ffmpeg audio format '{audio_format}'.")


def run_ffmpeg(args: Sequence[str]) -> None:
    command = [FFMPEG_BINARY, *args]
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        stderr = str(completed.stderr or "").strip()
        raise RuntimeError(stderr or f"ffmpeg failed with exit code {completed.returncode}.")


def ensure_tts_fragment_audio(
    fragment: PageAudioFragment,
    settings: Dict[str, Any],
    cache_root: Path,
    openai_key: str,
    base_url: str,
) -> Path:
    cache_path = page_audio_cache_path(cache_root, "tts", fragment.hash_value, str(settings["format"]))
    if cache_path.exists():
        return cache_path
    audio_bytes = shared.generate_openai_audio_bytes(
        api_key=openai_key,
        base_url=base_url,
        model=str(settings["model"]),
        voice=str(settings["voice"]),
        audio_format=str(settings["format"]),
        speed=float(settings["speed"]),
        text=fragment.text,
    )
    cache_path.write_bytes(audio_bytes)
    return cache_path


def ensure_source_audio_fragment(fragment: PageAudioFragment, cache_root: Path) -> Path:
    existing = str(fragment.cache_path or "").strip()
    if existing:
        path = Path(existing)
        if path.exists():
            return path
    raw, content_type = shared.notion_download_bytes(fragment.source_url)
    filename = shared.infer_filename_from_url(
        fragment.source_url,
        fallback_stem=f"source_audio_{fragment.hash_value}",
        content_type=content_type,
    )
    extension = Path(filename).suffix.lstrip(".") or "mp3"
    cache_path = page_audio_cache_path(cache_root, "source", fragment.hash_value, extension)
    if not cache_path.exists():
        cache_path.write_bytes(raw)
    fragment.cache_path = str(cache_path)
    fragment.content_type = content_type
    return cache_path


def ensure_normalized_audio_fragment(path: Path, hash_value: str, target_format: str, cache_root: Path) -> Path:
    if path.suffix.lower().lstrip(".") == target_format:
        return path
    normalized_hash = hashlib.sha256(f"{hash_value}|{target_format}".encode("utf-8")).hexdigest()[:16]
    normalized_path = page_audio_cache_path(cache_root, "normalized", normalized_hash, target_format)
    if normalized_path.exists():
        return normalized_path
    run_ffmpeg(
        [
            "-y",
            "-i",
            str(path),
            "-vn",
            "-c:a",
            ffmpeg_audio_codec(target_format),
            str(normalized_path),
        ]
    )
    return normalized_path


def ensure_silence_fragment(cache_root: Path, target_format: str, silence_ms: int) -> Optional[Path]:
    if silence_ms <= 0:
        return None
    silence_hash = hashlib.sha256(f"{target_format}|{silence_ms}".encode("utf-8")).hexdigest()[:16]
    silence_path = page_audio_cache_path(cache_root, "silence", silence_hash, target_format)
    if silence_path.exists():
        return silence_path
    duration_seconds = max(0.0, silence_ms / 1000.0)
    run_ffmpeg(
        [
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=24000:cl=mono",
            "-t",
            f"{duration_seconds:.3f}",
            "-c:a",
            ffmpeg_audio_codec(target_format),
            str(silence_path),
        ]
    )
    return silence_path


def assemble_audio_with_ffmpeg(fragment_paths: Sequence[Path], target_format: str, silence_ms: int, cache_root: Path) -> bytes:
    if not fragment_paths:
        raise RuntimeError("No audio fragments were assembled.")
    silence_path = ensure_silence_fragment(cache_root, target_format, silence_ms)
    ordered_paths: List[Path] = []
    for idx, path in enumerate(fragment_paths):
        ordered_paths.append(path)
        if silence_path is not None and idx + 1 < len(fragment_paths):
            ordered_paths.append(silence_path)
    tmp_dir = cache_root / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=tmp_dir) as temp_dir:
        concat_path = Path(temp_dir) / "inputs.txt"
        output_path = Path(temp_dir) / f"assembled.{target_format}"
        concat_lines = [f"file '{path.as_posix()}'" for path in ordered_paths]
        concat_path.write_text("\n".join(concat_lines), encoding="utf-8")
        run_ffmpeg(
            [
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(concat_path),
                "-c:a",
                ffmpeg_audio_codec(target_format),
                str(output_path),
            ]
        )
        return output_path.read_bytes()


def build_assembled_audio(
    fragments: Sequence[PageAudioFragment],
    config: Dict[str, Any],
    openai_key: str,
    base_url: str,
) -> bytes:
    settings = tts_settings_from_config(config)
    cache_root = page_audio_cache_dir()
    silence_ms = int(config.get("silence_ms", DEFAULT_SILENCE_MS))
    fragment_paths: List[Path] = []
    for fragment in fragments:
        if fragment.kind == "tts":
            path = ensure_tts_fragment_audio(fragment, settings, cache_root, openai_key, base_url)
        elif fragment.kind == "source_audio":
            path = ensure_source_audio_fragment(fragment, cache_root)
        else:
            raise RuntimeError(f"Unsupported fragment kind '{fragment.kind}'.")
        normalized = ensure_normalized_audio_fragment(path, fragment.hash_value, str(settings["format"]), cache_root)
        fragment_paths.append(normalized)
    return assemble_audio_with_ffmpeg(fragment_paths, str(settings["format"]), silence_ms, cache_root)


def monthly_intention_cache_path(year: int) -> Path:
    cache_dir = page_audio_cache_dir() / "monthly_intentions"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / f"{year}.json"


def fetch_media_candidates(search_term: str) -> List[Dict[str, Any]]:
    response = page_audio_http_get(
        POPES_PRAYER_MEDIA_API_URL,
        params={"search": search_term, "per_page": 100},
        timeout=30,
    )
    payload = response.json()
    return payload if isinstance(payload, list) else []


def english_pdf_score(item: Dict[str, Any], year: int) -> int:
    slug = str(item.get("slug", "")).lower()
    source_url = str(item.get("source_url", "")).lower()
    if not source_url.endswith(".pdf"):
        return -1
    if str(year) not in source_url and str(year) not in slug:
        return -1
    score = 0
    if f"{year}.pdf" in source_url:
        score += 50
    if "ing-" in source_url or slug.startswith("ing-"):
        score += 80
    if "eng-" in source_url or slug.startswith("eng-"):
        score += 70
    if "holy-father" in source_url or "holy-father" in slug:
        score += 30
    if "pope-leo" in source_url or "pope-leo" in slug:
        score += 20
    return score


def popes_prayer_pdf_url_for_year(year: int, language: str = "en") -> str:
    lang = str(language or "en").strip().lower()
    search_terms = []
    if lang == "en":
        search_terms.extend(
            [
                f"ING PRAYER INTENTIONS {year}",
                f"ENG POPE LEO XIV PRAYER INTENTIONS {year}",
                f"Prayer Intentions {year}",
            ]
        )
    else:
        search_terms.append(f"Prayer Intentions {year}")

    best_score = -1
    best_url = ""
    for term in search_terms:
        for item in fetch_media_candidates(term):
            if not isinstance(item, dict):
                continue
            score = english_pdf_score(item, year)
            if score > best_score:
                best_score = score
                best_url = str(item.get("source_url", "")).strip()
    if best_url:
        return best_url
    raise RuntimeError(f"Could not find Pope's Prayer Network PDF for {year}.")


def extract_month_sections_from_pdf_text(text: str) -> Dict[str, str]:
    cleaned = re.sub(r"\s+", " ", str(text or "").replace("\xa0", " ")).strip()
    positions: List[tuple[int, str]] = []
    for month_name in MONTH_NAMES:
        idx = cleaned.find(month_name)
        if idx >= 0:
            positions.append((idx, month_name))
    positions.sort()
    out: Dict[str, str] = {}
    for idx, (start, month_name) in enumerate(positions):
        end = positions[idx + 1][0] if idx + 1 < len(positions) else len(cleaned)
        section = cleaned[start + len(month_name) : end].strip()
        if section:
            out[month_name] = section
    return out


def parse_monthly_intention_section(month_name: str, section: str) -> Dict[str, str]:
    value = str(section or "").strip()
    title = value.strip().strip(".")
    body = ""
    match = re.search(r"\bLet us pray\b", value, re.IGNORECASE)
    if match:
        title = value[: match.start()].strip().strip(".")
        body = value[match.start() :].strip()
    body_clause = re.sub(r"^Let us pray\s+", "", body, flags=re.IGNORECASE).strip().rstrip(".")
    spoken_text = f"For the Holy Father's monthly intention: {body_clause}." if body_clause else (
        f"For the Holy Father's monthly intention this month: {title}."
    )
    return {
        "month": month_name.title(),
        "title": title,
        "body": body,
        "spoken_text": normalize_whitespace(spoken_text),
    }


def fetch_monthly_intention(target_date: datetime.date) -> Dict[str, str]:
    year = int(target_date.year)
    month_name = MONTH_NAMES[target_date.month - 1]
    cache_path = monthly_intention_cache_path(year)
    cached_payload: Dict[str, Any] = {}
    if cache_path.exists():
        try:
            cached_payload = json.loads(cache_path.read_text(encoding="utf-8"))
        except Exception:
            cached_payload = {}
    if isinstance(cached_payload, dict):
        cached_months = cached_payload.get("months") or {}
        cached_month = cached_months.get(month_name)
        if isinstance(cached_month, dict) and str(cached_month.get("spoken_text", "")).strip():
            return cached_month

    pdf_url = popes_prayer_pdf_url_for_year(year, language="en")
    response = page_audio_http_get(pdf_url, timeout=60)
    reader = PdfReader(io.BytesIO(response.content))
    extracted = "\n".join((page.extract_text() or "") for page in reader.pages)
    sections = extract_month_sections_from_pdf_text(extracted)
    months_payload: Dict[str, Dict[str, str]] = {}
    for parsed_month, section in sections.items():
        parsed = parse_monthly_intention_section(parsed_month, section)
        parsed["source_url"] = pdf_url
        months_payload[parsed_month] = parsed
    cache_path.write_text(json.dumps({"source_url": pdf_url, "months": months_payload}, indent=2), encoding="utf-8")
    result = months_payload.get(month_name)
    if not isinstance(result, dict) or not str(result.get("spoken_text", "")).strip():
        raise RuntimeError(f"Could not parse {month_name.title()} intention from {pdf_url}.")
    return result


def render_page_audio_for_config(
    page: Dict[str, Any],
    pages: Sequence[Dict[str, Any]],
    title_property: str,
    config_key: str,
    config: Dict[str, Any],
    notion_token: str,
    openai_key: str,
    base_url: str,
) -> str:
    builder = str(config.get("builder", "")).strip() or MORNING_PRAYER_BUILDER
    if builder != MORNING_PRAYER_BUILDER:
        raise RuntimeError(f"Unsupported page audio builder '{builder}'.")

    fragments = build_morning_prayer_fragments(
        page=page,
        pages=pages,
        title_property=title_property,
        config=config,
        token=notion_token,
        base_url=base_url,
    )
    render_hash = compute_page_render_hash(config_key, config, fragments)
    page_id = str(page.get("id", "")).strip()
    current_hash = page_audio_current_render_hash(page_id, notion_token)
    settings = tts_settings_from_config(config)
    if current_hash == render_hash:
        return f"cached:{settings['format']}:{settings['model']}:{settings['voice']}:hash={render_hash}"

    audio_bytes = build_assembled_audio(fragments, config, openai_key, base_url)
    page_audio_remove_old_blocks(page_id, notion_token)
    page_audio_remove_blank_placeholders(page_id, notion_token)
    filename = f"{slugify(shared.page_title(page, title_property))}_{shared.local_today().isoformat()}.{settings['format']}"
    content_type = shared.audio_content_type(str(settings["format"]))
    upload_id = shared.notion_create_file_upload(filename=filename, content_type=content_type, token=notion_token)
    shared.notion_send_file_upload(upload_id, filename, content_type, audio_bytes, notion_token)
    caption = str(config.get("audio_caption", "Page Audio")).strip() or "Page Audio"
    page_audio_append_block(page_id, upload_id, f"{caption} {page_audio_hash_marker(render_hash)}", notion_token)
    shared.notion_update_audio_render_metadata(page, render_hash, notion_token)
    return f"attached:{settings['format']}:{settings['model']}:{settings['voice']}:hash={render_hash}"


def main() -> int:
    try:
        openai_key = shared.require_env(OPENAI_API_KEY)
        notion_token = shared.require_env(NOTION_TOKEN)
        base_url = os.getenv(OAI_API_BASE_URL, "https://api.openai.com/v1").strip() or "https://api.openai.com/v1"
        title_property = os.getenv(NOTION_TITLE_PROPERTY, "Name").strip() or "Name"
        platform_property = os.getenv(NOTION_PLATFORM_PROPERTY, "Platform").strip() or "Platform"
        platform_value = os.getenv(NOTION_AUDIO_PLATFORM_VALUE, DEFAULT_AUTO_AUDIO_PLATFORM_VALUE).strip() or DEFAULT_AUTO_AUDIO_PLATFORM_VALUE
        resolver_property = os.getenv(NOTION_AUDIO_RESOLVER_PROPERTY, "Spotify Resolver").strip() or "Spotify Resolver"
        enabled_property = os.getenv(NOTION_AUDIO_ENABLED_PROPERTY, "Enabled").strip() or "Enabled"
        config_key_filter = os.getenv(PAGE_AUDIO_CONFIG_KEY, "").strip()
        row_title_filter = os.getenv(PAGE_AUDIO_ROW_TITLE, "").strip()
        fail_open = shared.bool_env(PAGE_AUDIO_FAIL_OPEN, default=False)
        notion_db_id = shared.notion_find_database_id(notion_token)

        config_payload = load_page_audio_config()
        config_map = config_payload.get("configs") or {}
        pages = shared.notion_get_all_pages(notion_db_id, notion_token)
        candidates = list_audio_candidate_pages(
            pages=pages,
            title_property=title_property,
            platform_property=platform_property,
            platform_value=platform_value,
            resolver_property=resolver_property,
            enabled_property=enabled_property,
            config_key_filter=config_key_filter,
            row_title_filter=row_title_filter,
        )

        if not candidates:
            print("page_audio_rows=0")
            return 0

        attached = 0
        cached = 0
        failed = 0
        for page in candidates:
            title = shared.page_title(page, title_property).strip() or str(page.get("id", "")).strip()
            config_key = page_property_text(page, resolver_property).strip()
            config = config_map.get(config_key)
            if not isinstance(config, dict):
                raise RuntimeError(f"Missing page audio config '{config_key}' for '{title}'.")
            try:
                mode = render_page_audio_for_config(
                    page=page,
                    pages=pages,
                    title_property=title_property,
                    config_key=config_key,
                    config=config,
                    notion_token=notion_token,
                    openai_key=openai_key,
                    base_url=base_url,
                )
                if mode.startswith("attached:"):
                    attached += 1
                if mode.startswith("cached:"):
                    cached += 1
                print(f"page_audio title={title} config={config_key} mode={mode}")
            except Exception as exc:
                failed += 1
                print(f"page_audio_error title={title} config={config_key} error={exc}", file=sys.stderr)
                if not fail_open:
                    raise
        print(f"page_audio_rows={len(candidates)} attached={attached} cached={cached} failed={failed}")
        return 0 if failed == 0 or fail_open else 1
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
