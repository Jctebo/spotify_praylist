from __future__ import annotations

import datetime
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.notion import generate_page_audio as page_audio

PRAYER_CONFIG_FILE = "PRAYER_CONFIG_FILE"
PRAYER_ROW_TITLE = "PRAYER_ROW_TITLE"
DEFAULT_PRAYER_CONFIG_FILE = "config/morning-prayer.json"


def load_prayer_config_from_file() -> Dict[str, Any]:
    configured = os.getenv(PRAYER_CONFIG_FILE, "").strip()
    raw_path = configured or DEFAULT_PRAYER_CONFIG_FILE
    config_path = Path(raw_path)
    if not config_path.is_absolute():
        config_path = ROOT / config_path
    if not config_path.exists():
        raise RuntimeError(f"Missing prayer config file: {config_path}")
    with open(config_path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)
    if not isinstance(payload, dict):
        raise RuntimeError(f"Invalid prayer config format in {config_path}: root must be an object.")
    resolvers = payload.get("resolvers")
    if not isinstance(resolvers, list) or not resolvers:
        raise RuntimeError(f"Invalid prayer config format in {config_path}: missing or empty 'resolvers'.")
    return payload


def prayer_runtime_config(contract: Dict[str, Any]) -> Dict[str, Any]:
    header = contract.get("header") if isinstance(contract, dict) else None
    if not isinstance(header, dict):
        header = {}
    title = str(contract.get("title", "")).strip() or "Prayer"
    model = str(header.get("model", "")).strip() or os.getenv("OAI_MODEL", "").strip() or "gpt-4o-mini-tts"
    return {
        "builder": "morning_prayer_v1",
        "audio_caption": f"{title} (Audio)",
        "output_folder": "Morning",
        "tts": {"model": model, "voice": "alloy", "format": "mp3", "speed": 1.0},
    }


def prayer_title(contract: Dict[str, Any]) -> str:
    header = contract.get("header") if isinstance(contract, dict) else None
    if not isinstance(header, dict):
        header = {}
    row_title = os.getenv(PRAYER_ROW_TITLE, "").strip()
    return row_title or str(contract.get("title", "")).strip() or str(header.get("title", "")).strip() or "Prayer"


def select_prayer_page(
    pages: List[Dict[str, Any]],
    *,
    title_property: str,
    title: str,
    platform_property: str,
    platform_value: str,
    enabled_property: str,
) -> Optional[Dict[str, Any]]:
    candidates = page_audio.list_audio_candidate_pages(
        pages=pages,
        title_property=title_property,
        platform_property=platform_property,
        platform_value=platform_value,
        enabled_property=enabled_property,
        row_title_filter=title,
    )
    if not candidates:
        return None
    for page in candidates:
        if page_audio.shared.page_title(page, title_property).strip() == title:
            return page
    return candidates[0]


def main() -> int:
    try:
        openai_key = page_audio.shared.require_env(page_audio.OPENAI_API_KEY)
        notion_token = page_audio.shared.require_env(page_audio.NOTION_TOKEN)
        base_url = os.getenv(page_audio.OAI_API_BASE_URL, "https://api.openai.com/v1").strip() or "https://api.openai.com/v1"
        title_property = os.getenv(page_audio.NOTION_TITLE_PROPERTY, "Name").strip() or "Name"
        platform_property = os.getenv(page_audio.NOTION_PLATFORM_PROPERTY, "Platform").strip() or "Platform"
        platform_value = os.getenv(page_audio.NOTION_AUDIO_PLATFORM_VALUE, page_audio.DEFAULT_AUTO_AUDIO_PLATFORM_VALUE).strip() or page_audio.DEFAULT_AUTO_AUDIO_PLATFORM_VALUE
        enabled_property = os.getenv(page_audio.NOTION_AUDIO_ENABLED_PROPERTY, "Enabled").strip() or "Enabled"

        contract = load_prayer_config_from_file()
        title = prayer_title(contract)
        runtime_config = prayer_runtime_config(contract)

        notion_db_id = page_audio.shared.notion_find_database_id(notion_token)
        pages = page_audio.shared.notion_get_all_pages(notion_db_id, notion_token)
        page = select_prayer_page(
            pages,
            title_property=title_property,
            title=title,
            platform_property=platform_property,
            platform_value=platform_value,
            enabled_property=enabled_property,
        )
        if page is None:
            raise RuntimeError(f"No prayer page found for '{title}'.")

        plan = page_audio.build_morning_prayer_plan(
            page=page,
            pages=pages,
            title_property=title_property,
            config=runtime_config,
            token=notion_token,
            base_url=base_url,
        )
        mode = page_audio.render_page_audio_for_config(
            page=page,
            config_key=str(contract.get("key", "")).strip() or "morning-prayer",
            config=runtime_config,
            plan=plan,
            title_property=title_property,
            notion_token=notion_token,
            openai_key=openai_key,
            base_url=base_url,
            apply_text=True,
        )
        print(f"prayer title={title} mode={mode} fragments={len(plan.fragments)}")
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
