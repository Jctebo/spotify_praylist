from __future__ import annotations

import datetime as _dt
import json
from enum import Enum
from pathlib import Path
from typing import Any, Dict, Optional

from jobs.publish.audio import audio_public_url
from jobs.publish.formatting import compose_rss_guid

from .contracts import NovenaRuntime


def _json_default(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if hasattr(value, "model_dump"):
        dumped = value.model_dump()
        if isinstance(dumped, dict):
            return dumped
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            pass
    return str(value)


def audio_output_path(episode_id: str, *, docs_root: Optional[Path] = None) -> Path:
    root = Path(docs_root) if docs_root else Path(__file__).resolve().parents[2] / "docs"
    return root / "audio" / f"{episode_id}.mp3"


def audio_sidecar_path(episode_id: str, *, docs_root: Optional[Path] = None) -> Path:
    return audio_output_path(episode_id, docs_root=docs_root).with_suffix(".json")


def write_novena_artifact(runtime: NovenaRuntime, rendered: Dict[str, Any], audio_result: Dict[str, Any], *, docs_root: Optional[Path] = None) -> Path:
    episode_id = str(rendered.get("episode_id") or f"{runtime.date.isoformat()}-{runtime.contract_id}-day-{runtime.active_day}").strip()
    root = Path(docs_root) if docs_root else Path(__file__).resolve().parents[2] / "docs"
    sidecar_path = audio_sidecar_path(episode_id, docs_root=root)
    if sidecar_path.exists():
        return sidecar_path
    sidecar_path.parent.mkdir(parents=True, exist_ok=True)
    title = str(rendered.get("title", "")).strip()
    description = str(rendered.get("description", "")).strip() or title
    payload = {
        "id": episode_id,
        "episode_id": episode_id,
        "entry_id": episode_id,
        "family_id": runtime.family_id,
        "contract_id": runtime.contract_id,
        "contract_type": "novena_feast_rule",
        "frequency": "daily",
        "title": title,
        "description": description,
        "date": runtime.date.isoformat(),
        "published_date": runtime.date.isoformat(),
        "active_day": runtime.active_day,
        "saint": dict(runtime.saint),
        "feast": dict(runtime.feast),
        "novena": dict(runtime.novena),
        "template": rendered.get("template") or runtime.resolved_template.to_dict(),
        "content": dict(rendered.get("content") or {}),
        "fragments": list(rendered.get("audio_fragments") or []),
        "audio": {
            "file": f"{episode_id}.mp3",
            "path": str(audio_result.get("audio_path", audio_output_path(episode_id, docs_root=root))),
            "url": str(audio_result.get("audio_url", audio_public_url(episode_id))),
            "rendered": bool(audio_result.get("rendered", False)),
            "content_hash": str(audio_result.get("content_hash", rendered.get("content_hash", ""))).strip(),
        },
        "audio_path": str(audio_result.get("audio_path", audio_output_path(episode_id, docs_root=root))),
        "audio_url": str(audio_result.get("audio_url", audio_public_url(episode_id))),
        "content_hash": str(audio_result.get("content_hash", rendered.get("content_hash", ""))).strip(),
        "rss_guid": compose_rss_guid(episode_id, str(audio_result.get("content_hash", rendered.get("content_hash", ""))).strip()),
        "tts": dict(audio_result.get("audio_config") or runtime.publishing.get("audio") or {}),
        "publishing": dict(runtime.publishing),
        "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
    }
    sidecar_path.write_text(json.dumps(payload, indent=2, sort_keys=True, default=_json_default), encoding="utf-8")
    return sidecar_path
