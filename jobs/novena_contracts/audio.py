from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from jobs.publish.audio import audio_public_url, normalize_episode_loudness, openai_tts_renderer
from jobs.publish.fragments import (
    audio_manifest_hash,
    assemble_audio_fragments,
    publish_audio_cache_root,
    render_fragment_audio,
    sanitize_tts_input,
)

from .contracts import DEFAULT_LOUDNESS_NORMALIZATION, NovenaRuntime


def _normalize_loudness_config(config: Any) -> Dict[str, Any]:
    if config is None:
        settings = dict(DEFAULT_LOUDNESS_NORMALIZATION)
    elif isinstance(config, dict):
        settings = dict(DEFAULT_LOUDNESS_NORMALIZATION)
        settings.update(config)
    else:
        settings = dict(DEFAULT_LOUDNESS_NORMALIZATION)
        settings["enabled"] = bool(config)
    settings["enabled"] = bool(settings.get("enabled", True))
    try:
        settings["integrated_lufs"] = float(settings.get("integrated_lufs", DEFAULT_LOUDNESS_NORMALIZATION["integrated_lufs"]))
    except Exception:
        settings["integrated_lufs"] = float(DEFAULT_LOUDNESS_NORMALIZATION["integrated_lufs"])
    try:
        settings["true_peak_db"] = float(settings.get("true_peak_db", DEFAULT_LOUDNESS_NORMALIZATION["true_peak_db"]))
    except Exception:
        settings["true_peak_db"] = float(DEFAULT_LOUDNESS_NORMALIZATION["true_peak_db"])
    try:
        settings["lra"] = float(settings.get("lra", DEFAULT_LOUDNESS_NORMALIZATION["lra"]))
    except Exception:
        settings["lra"] = float(DEFAULT_LOUDNESS_NORMALIZATION["lra"])
    return settings


def build_novena_audio_job(runtime: NovenaRuntime, rendered: Dict[str, Any]) -> Dict[str, Any]:
    episode_id = f"{runtime.date.isoformat()}-{runtime.contract_id}-day-{runtime.active_day}"
    audio_config = dict(runtime.publishing.get("audio") or {})
    audio_config["enabled"] = bool(audio_config.get("enabled", True))
    audio_config["model"] = str(audio_config.get("model", "gpt-4o-mini-tts")).strip() or "gpt-4o-mini-tts"
    audio_config["voice"] = str(audio_config.get("voice", "alloy")).strip() or "alloy"
    audio_config["format"] = str(audio_config.get("format", "mp3")).strip().lower() or "mp3"
    try:
        audio_config["speed"] = float(audio_config.get("speed", 1.0))
    except Exception:
        audio_config["speed"] = 1.0
    audio_config["loudness_normalization"] = _normalize_loudness_config(
        audio_config.get("loudness_normalization")
    )
    fragments = list(rendered.get("audio_fragments") or [])
    text = str(rendered.get("content", {}).get("text", "")).strip()
    job = {
        "family_id": runtime.family_id,
        "entry_id": episode_id,
        "episode_id": episode_id,
        "contract_id": runtime.contract_id,
        "contract_type": "novena_feast_rule",
        "frequency": "daily",
        "timezone": "UTC",
        "version": "1",
        "title": str(rendered.get("title", "")).strip() or str(runtime.saint.get("name", runtime.contract_id)).strip(),
        "description": str(rendered.get("description", "")).strip() or str(rendered.get("title", "")).strip(),
        "date": runtime.date.isoformat(),
        "published_date": runtime.date.isoformat(),
        "status": "approved",
        "text": text,
        "audio_fragments": fragments,
        "audio_config": audio_config,
    }
    job["content_hash"] = audio_manifest_hash(job, fragments, audio_config)
    return job


def _sidecar_matches(audio_path: Path, sidecar_path: Path, content_hash: str) -> bool:
    if not audio_path.exists() or not sidecar_path.exists():
        return False
    try:
        payload = json.loads(sidecar_path.read_text(encoding="utf-8"))
    except Exception:
        return False
    return str(payload.get("content_hash", "")).strip() == content_hash


def render_novena_audio_job(
    job: Dict[str, Any],
    *,
    renderer: Optional[Callable[[str, Dict[str, Any]], bytes]] = None,
    docs_root: Optional[Path] = None,
    cache_root: Optional[Path] = None,
    write_sidecar: bool = True,
) -> Dict[str, Any]:
    root = Path(docs_root) if docs_root else Path(__file__).resolve().parents[2] / "docs"
    episode_id = str(job.get("episode_id", "")).strip()
    if not episode_id:
        raise RuntimeError("Novena audio job is missing an episode_id.")
    audio_path = root / "audio" / f"{episode_id}.mp3"
    sidecar_path = audio_path.with_suffix(".json")
    audio_path.parent.mkdir(parents=True, exist_ok=True)
    audio_config = dict(job.get("audio_config") or {})
    fragments = list(job.get("audio_fragments") or [])
    content_hash = str(job.get("content_hash", "")).strip() or audio_manifest_hash(job, fragments, audio_config)
    if _sidecar_matches(audio_path, sidecar_path, content_hash):
        rendered = dict(job)
        rendered.update(
            {
                "audio_path": str(audio_path),
                "audio_url": audio_public_url(episode_id),
                "rendered": False,
                "content_hash": content_hash,
            }
        )
        return rendered

    renderer = renderer or openai_tts_renderer
    fragment_root = publish_audio_cache_root(cache_root)
    fragment_paths = []
    fragment_results = []
    if audio_path.exists():
        rendered = dict(job)
        rendered.update(
            {
                "audio_path": str(audio_path),
                "audio_url": audio_public_url(episode_id),
                "rendered": False,
                "content_hash": content_hash,
            }
        )
        return rendered
    for fragment in fragments:
        rendered_fragment = render_fragment_audio(fragment, audio_config, renderer, cache_root=fragment_root)
        fragment_paths.append(Path(rendered_fragment["audio_path"]))
        fragment_results.append(
            {
                "fragment_key": str(fragment.get("fragment_key", "")).strip(),
                "block_path": str(fragment.get("block_path", "")).strip(),
                "kind": str(fragment.get("kind", "")).strip(),
                "label": str(fragment.get("label", "")).strip(),
                "text": sanitize_tts_input(fragment.get("text", "")),
                "days": list(fragment.get("days") or []),
                "repeat_index": int(fragment.get("repeat_index", 1) or 1),
                "repeat_count": int(fragment.get("repeat_count", 1) or 1),
                "source_fragment_key": str(fragment.get("source_fragment_key", "")).strip(),
                "fragment_hash": rendered_fragment["fragment_hash"],
                "audio_path": str(rendered_fragment["audio_path"]),
                "rendered": bool(rendered_fragment.get("rendered", False)),
            }
        )

    target_format = str(audio_config.get("format", "mp3")).strip().lower() or "mp3"
    if len(fragment_paths) == 1 and fragment_paths[0].suffix.lower().lstrip(".") == target_format:
        raw_audio = fragment_paths[0].read_bytes()
    else:
        raw_audio = assemble_audio_fragments(fragment_paths, target_format, cache_root=fragment_root)
    if not raw_audio:
        raise RuntimeError(f"Audio assembly returned empty output for novena '{episode_id}'.")
    loudness_settings = _normalize_loudness_config(audio_config.get("loudness_normalization"))
    raw_audio = normalize_episode_loudness(raw_audio, target_format, audio_config, cache_root=fragment_root)
    audio_path.write_bytes(raw_audio)
    if write_sidecar:
        sidecar_path.write_text(
            json.dumps(
                {
                    "entry_id": job.get("entry_id", ""),
                    "episode_id": episode_id,
                    "family_id": str(job.get("family_id", "")).strip(),
                    "published_date": str(job.get("published_date", "")).strip(),
                    "contract_id": str(job.get("contract_id", "")).strip(),
                    "contract_type": str(job.get("contract_type", "")).strip(),
                    "frequency": str(job.get("frequency", "")).strip(),
                    "title": str(job.get("title", "")).strip(),
                    "description": str(job.get("description", "")).strip(),
                    "content_hash": content_hash,
                    "audio_path": str(audio_path),
                    "audio_url": audio_public_url(episode_id),
                    "audio_length": len(raw_audio),
                    "loudness_normalization": loudness_settings,
                    "tts": audio_config,
                    "fragment_manifest_hash": content_hash,
                    "fragments": fragment_results,
                },
                indent=2,
                sort_keys=True,
            ),
            encoding="utf-8",
        )
    rendered = dict(job)
    rendered.update(
        {
            "audio_path": str(audio_path),
            "audio_url": audio_public_url(episode_id),
            "rendered": True,
            "content_hash": content_hash,
            "audio_length": len(raw_audio),
            "loudness_normalization": loudness_settings,
            "fragment_results": fragment_results,
        }
    )
    return rendered
