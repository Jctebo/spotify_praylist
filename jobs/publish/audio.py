from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence

from openai import OpenAI

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.publish.contracts import DEFAULT_GITHUB_PAGES_BASE_URL, ROOT, build_audio_jobs as _build_audio_jobs

PUBLISH_DOCS_DIR = ROOT / "docs"
DEFAULT_AUDIO_DIR = PUBLISH_DOCS_DIR / "audio"
DEFAULT_PODCAST_FEED_PATH = PUBLISH_DOCS_DIR / "podcast.xml"
PUBLISH_GITHUB_PAGES_BASE_URL = "PUBLISH_GITHUB_PAGES_BASE_URL"
OPENAI_API_KEY = "OPENAI_API_KEY"
OAI_API_BASE_URL = "OAI_API_BASE_URL"



def github_pages_base_url() -> str:
    configured = os.getenv(PUBLISH_GITHUB_PAGES_BASE_URL, "").strip()
    return configured or DEFAULT_GITHUB_PAGES_BASE_URL



def audio_output_path(entry_id: str, *, docs_root: Optional[Path] = None) -> Path:
    root = Path(docs_root) if docs_root else PUBLISH_DOCS_DIR
    return root / "audio" / f"{entry_id}.mp3"



def audio_sidecar_path(entry_id: str, *, docs_root: Optional[Path] = None) -> Path:
    return audio_output_path(entry_id, docs_root=docs_root).with_suffix(".json")



def content_hash_for_entry(entry: Dict[str, Any], audio_config: Dict[str, Any]) -> str:
    payload = {
        "entry_id": entry.get("entry_id", ""),
        "contract_id": entry.get("contract_id", ""),
        "title": entry.get("title", ""),
        "date": entry.get("date", ""),
        "text": entry.get("text", ""),
        "tts": {
            "model": audio_config.get("model", "gpt-4o-mini-tts"),
            "voice": audio_config.get("voice", "alloy"),
            "format": audio_config.get("format", "mp3"),
            "speed": audio_config.get("speed", 1.0),
        },
    }
    text = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()



def build_audio_jobs(contracts: Sequence[Any], *, target_date: Optional[Any] = None) -> List[Dict[str, Any]]:
    return _build_audio_jobs(contracts, target_date=target_date)



def openai_tts_renderer(text: str, audio_config: Dict[str, Any]) -> bytes:
    api_key = os.getenv(OPENAI_API_KEY, "").strip()
    if not api_key:
        raise RuntimeError("Missing required environment variable: OPENAI_API_KEY")
    base_url = os.getenv(OAI_API_BASE_URL, "https://api.openai.com/v1").strip() or "https://api.openai.com/v1"
    client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))
    response = client.audio.speech.create(
        model=str(audio_config.get("model", "gpt-4o-mini-tts")).strip() or "gpt-4o-mini-tts",
        voice=str(audio_config.get("voice", "alloy")).strip() or "alloy",
        input=str(text or ""),
        response_format=str(audio_config.get("format", "mp3")).strip().lower() or "mp3",
        speed=float(audio_config.get("speed", 1.0)),
    )
    raw = bytes(response.content)
    if not raw:
        raise RuntimeError("OpenAI audio generation returned empty content.")
    return raw



def _is_current_audio_file(audio_path: Path, sidecar_path: Path, content_hash: str) -> bool:
    if not audio_path.exists() or not sidecar_path.exists():
        return False
    try:
        payload = json.loads(sidecar_path.read_text(encoding="utf-8"))
    except Exception:
        return False
    return str(payload.get("content_hash", "")).strip() == content_hash



def render_audio_job(
    job: Dict[str, Any],
    *,
    renderer: Optional[Callable[[str, Dict[str, Any]], bytes]] = None,
    docs_root: Optional[Path] = None,
) -> Dict[str, Any]:
    root = Path(docs_root) if docs_root else PUBLISH_DOCS_DIR
    audio_path = audio_output_path(str(job["entry_id"]), docs_root=root)
    sidecar_path = audio_sidecar_path(str(job["entry_id"]), docs_root=root)
    audio_path.parent.mkdir(parents=True, exist_ok=True)
    content_hash = str(job.get("content_hash", "")).strip() or content_hash_for_entry(job, dict(job.get("audio_config") or {}))
    if _is_current_audio_file(audio_path, sidecar_path, content_hash):
        rendered = dict(job)
        rendered["audio_path"] = str(audio_path)
        rendered["audio_url"] = f"{github_pages_base_url().rstrip('/')}/docs/audio/{audio_path.name}"
        rendered["rendered"] = False
        return rendered

    renderer = renderer or openai_tts_renderer
    raw_audio = renderer(str(job.get("text", "")), dict(job.get("audio_config") or {}))
    if not raw_audio:
        raise RuntimeError(f"Audio renderer returned empty output for entry '{job.get('entry_id', '')}'.")
    audio_path.write_bytes(raw_audio)
    sidecar_path.write_text(
        json.dumps(
            {
                "entry_id": job.get("entry_id", ""),
                "content_hash": content_hash,
                "audio_path": str(audio_path),
                "tts": dict(job.get("audio_config") or {}),
            },
            indent=2,
            sort_keys=True,
        ),
        encoding="utf-8",
    )
    rendered = dict(job)
    rendered["audio_path"] = str(audio_path)
    rendered["audio_url"] = f"{github_pages_base_url().rstrip('/')}/docs/audio/{audio_path.name}"
    rendered["rendered"] = True
    rendered["content_hash"] = content_hash
    return rendered
