from __future__ import annotations

import datetime as _dt
import json
import logging
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Sequence, Tuple

from jobs.novena.liturgical_helpers import LITURGICAL_MUSIC_SEASONS, resolve_liturgical_music_season
from jobs.publish.fragments import (
    FFMPEG_BINARY,
    _audio_output_args,
    _run_ffmpeg,
    normalize_audio_settings,
    publish_audio_cache_root,
)

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_AUDIO_BRANDING_CONFIG = ROOT / "config" / "publish" / "audio_branding.json"
DEFAULT_WELCOME_TEXT = "Welcome to Ora Pro Nobis, where we pray with the Saints."

logger = logging.getLogger(__name__)


def _bool_value(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "on"}:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    return bool(value)


def _float_value(value: Any, default: float, *, minimum: Optional[float] = None) -> float:
    try:
        parsed = float(value)
    except Exception:
        parsed = float(default)
    if minimum is not None:
        parsed = max(float(minimum), parsed)
    return parsed


def _repo_path(path_text: Any) -> Path:
    path = Path(str(path_text or "").strip())
    if not path.is_absolute():
        path = ROOT / path
    return path


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return str(value)


def load_audio_branding_config(path: Optional[Path] = None) -> Dict[str, Any]:
    config_path = Path(path) if path else DEFAULT_AUDIO_BRANDING_CONFIG
    if not config_path.exists():
        return normalize_audio_branding_config({"enabled": False, "missing_config": str(config_path)})
    try:
        payload = json.loads(config_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Invalid audio branding config '{config_path}': {exc.msg} "
            f"(line {exc.lineno}, column {exc.colno})."
        ) from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"Invalid audio branding config '{config_path}': root must be a JSON object.")
    config = normalize_audio_branding_config(payload)
    config["source_path"] = str(config_path)
    return config


def normalize_audio_branding_config(payload: Dict[str, Any]) -> Dict[str, Any]:
    timing = dict(payload.get("timing") or {}) if isinstance(payload.get("timing"), dict) else {}
    levels = dict(payload.get("levels") or {}) if isinstance(payload.get("levels"), dict) else {}
    welcome = dict(payload.get("welcome") or {}) if isinstance(payload.get("welcome"), dict) else {}
    background_bed = dict(payload.get("background_bed") or {}) if isinstance(payload.get("background_bed"), dict) else {}
    seasons = dict(payload.get("seasons") or {}) if isinstance(payload.get("seasons"), dict) else {}
    normalized_seasons: Dict[str, str] = {}
    for season in sorted(LITURGICAL_MUSIC_SEASONS):
        value = seasons.get(season, "")
        if value:
            normalized_seasons[season] = str(value).strip()
    return {
        "enabled": _bool_value(payload.get("enabled"), False),
        "exclude_entry_ids": [str(value).strip() for value in payload.get("exclude_entry_ids", []) if str(value).strip()],
        "missing_config": str(payload.get("missing_config", "")).strip(),
        "calendar": str(payload.get("calendar", "general_roman")).strip() or "general_roman",
        "locale": str(payload.get("locale", "en")).strip() or "en",
        "welcome": {
            "text": str(welcome.get("text", DEFAULT_WELCOME_TEXT)).strip() or DEFAULT_WELCOME_TEXT,
            "tts_text": str(welcome.get("tts_text", "")).strip(),
            "providers": [dict(item) for item in welcome.get("providers", []) if isinstance(item, dict)],
        },
        "timing": {
            "intro_lead_in_seconds": _float_value(timing.get("intro_lead_in_seconds"), 3.5, minimum=0),
            "intro_fade_in_seconds": _float_value(timing.get("intro_fade_in_seconds"), 1.25, minimum=0),
            "fade_under_welcome_seconds": _float_value(timing.get("fade_under_welcome_seconds"), 1.5, minimum=0),
            "welcome_gap_seconds": _float_value(timing.get("welcome_gap_seconds"), 0.35, minimum=0),
            "outro_seconds": _float_value(timing.get("outro_seconds"), 6.0, minimum=0),
            "outro_fade_seconds": _float_value(timing.get("outro_fade_seconds"), 6.0, minimum=0),
        },
        "levels": {
            "intro_db": _float_value(levels.get("intro_db"), -8.0),
            "under_welcome_db": _float_value(levels.get("under_welcome_db"), -18.0),
            "background_bed_db": _float_value(levels.get("background_bed_db"), -32.0),
            "outro_db": _float_value(levels.get("outro_db"), -12.0),
        },
        "background_bed": {
            "enabled": _bool_value(background_bed.get("enabled"), True),
        },
        "seasons": normalized_seasons,
    }


def _published_date(job: Dict[str, Any]) -> Optional[_dt.date]:
    candidate = str(job.get("published_date") or job.get("date") or "").strip()
    if not candidate or candidate == "daily":
        return None
    try:
        return _dt.date.fromisoformat(candidate)
    except Exception:
        return None


def _resolve_asset(config: Dict[str, Any], season: str) -> Tuple[str, Path]:
    path_text = str((config.get("seasons") or {}).get(season, "")).strip()
    return path_text, _repo_path(path_text) if path_text else Path()


def _asset_identity(path: Path) -> Dict[str, Any]:
    if not path or not path.exists():
        return {"exists": False}
    stat = path.stat()
    return {
        "exists": True,
        "path": str(path),
        "size": int(stat.st_size),
        "mtime_ns": int(stat.st_mtime_ns),
    }


def audio_branding_hash_metadata(
    job: Dict[str, Any],
    audio_config: Dict[str, Any],
    *,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    resolved_config = normalize_audio_branding_config(config or load_audio_branding_config())
    metadata: Dict[str, Any] = {
        "enabled": bool(resolved_config.get("enabled")),
        "config": _json_safe(resolved_config),
    }
    if not resolved_config.get("enabled"):
        metadata["status"] = "disabled"
        return metadata
    if str(job.get("entry_id", "")).strip() in set(resolved_config.get("exclude_entry_ids") or []):
        metadata["status"] = "skipped"
        metadata["skip_reason"] = "entry_excluded"
        return metadata
    target_date = _published_date(job)
    if target_date is None:
        metadata["status"] = "skipped"
        metadata["skip_reason"] = "missing_published_date"
        return metadata
    season = resolve_liturgical_music_season(
        str(resolved_config.get("calendar", "general_roman")),
        str(resolved_config.get("locale", "en")),
        target_date,
    )
    path_text, asset_path = _resolve_asset(resolved_config, season)
    metadata.update(
        {
            "status": "resolved",
            "season": season,
            "season_asset": path_text,
            "asset": _asset_identity(asset_path),
            "welcome_tts": normalize_audio_settings(
                {
                    "format": str(audio_config.get("format", "mp3")).strip().lower() or "mp3",
                    "providers": list((resolved_config.get("welcome") or {}).get("providers") or []),
                }
            ),
        }
    )
    return metadata


def _skip_metadata(hash_metadata: Dict[str, Any], reason: str) -> Dict[str, Any]:
    metadata = dict(hash_metadata)
    metadata["status"] = "skipped"
    metadata["skip_reason"] = reason
    return metadata


def _duration_seconds(path: Path) -> float:
    completed = subprocess.run(
        [FFMPEG_BINARY, "-hide_banner", "-i", str(path)],
        capture_output=True,
        text=True,
        check=False,
    )
    output = f"{completed.stderr}\n{completed.stdout}"
    match = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", output)
    if not match:
        raise RuntimeError(f"Unable to determine audio duration for {path}.")
    hours, minutes, seconds = match.groups()
    return (int(hours) * 3600) + (int(minutes) * 60) + float(seconds)


def _render_welcome_audio(
    config: Dict[str, Any],
    audio_config: Dict[str, Any],
    render_tts_fragment: Callable[[Dict[str, Any], Dict[str, Any]], Dict[str, Any]],
) -> Dict[str, Any]:
    welcome = dict(config.get("welcome") or {})
    providers = list(welcome.get("providers") or [])
    if not providers:
        raise RuntimeError("Audio branding welcome has no providers configured.")
    welcome_audio_config = {
        "enabled": True,
        "format": str(audio_config.get("format", "mp3")).strip().lower() or "mp3",
        "providers": providers,
    }
    fragment = {
        "fragment_key": "audio-branding/welcome",
        "block_path": "audio-branding/welcome",
        "kind": "audio-branding-welcome",
        "label": "Ora Pro Nobis Welcome",
        "text": str(welcome.get("tts_text") or welcome.get("text", DEFAULT_WELCOME_TEXT)).strip() or DEFAULT_WELCOME_TEXT,
    }
    return render_tts_fragment(fragment, welcome_audio_config)


def _delay_ms(seconds: float) -> int:
    return int(round(max(0.0, seconds) * 1000))


def _build_filter_graph(
    *,
    spoken_duration: float,
    welcome_duration: float,
    config: Dict[str, Any],
) -> Tuple[str, float]:
    timing = dict(config.get("timing") or {})
    levels = dict(config.get("levels") or {})
    bed_enabled = bool((config.get("background_bed") or {}).get("enabled", True))
    intro_lead = float(timing.get("intro_lead_in_seconds", 3.5))
    intro_fade = float(timing.get("intro_fade_in_seconds", 1.25))
    fade_under = float(timing.get("fade_under_welcome_seconds", 1.5))
    welcome_gap = float(timing.get("welcome_gap_seconds", 0.35))
    outro_seconds = float(timing.get("outro_seconds", 6.0))
    outro_fade = min(float(timing.get("outro_fade_seconds", 6.0)), max(outro_seconds, 0.001))
    welcome_start = intro_lead
    spoken_start = intro_lead + welcome_duration + welcome_gap
    total_duration = spoken_start + spoken_duration + outro_seconds
    outro_start = spoken_start + spoken_duration
    parts = [
        f"[2:a]adelay={_delay_ms(welcome_start)}:all=1[welcome]",
        f"[0:a]adelay={_delay_ms(spoken_start)}:all=1[spoken]",
    ]
    labels = ["[welcome]", "[spoken]"]
    if bed_enabled:
        parts.append(
            (
                f"[1:a]atrim=0:{total_duration:.3f},asetpts=PTS-STARTPTS,"
                f"afade=t=in:st=0:d={intro_fade:.3f},"
                f"volume={float(levels.get('background_bed_db', -32.0)):.3f}dB,"
                f"afade=t=out:st={outro_start:.3f}:d={outro_fade:.3f}[bed]"
            )
        )
        labels.append("[bed]")
    else:
        intro_duration = max(spoken_start, intro_lead + fade_under)
        fade_under_start = max(0.0, welcome_start)
        parts.insert(
            0,
            (
                f"[1:a]atrim=0:{intro_duration:.3f},asetpts=PTS-STARTPTS,"
                f"afade=t=in:st=0:d={intro_fade:.3f},"
                f"afade=t=out:st={fade_under_start:.3f}:d={fade_under:.3f},"
                f"volume={float(levels.get('intro_db', -8.0)):.3f}dB[intro]"
            ),
        )
        parts.append(
            (
                f"[1:a]atrim=0:{outro_seconds:.3f},asetpts=PTS-STARTPTS,"
                f"volume={float(levels.get('outro_db', -12.0)):.3f}dB,"
                f"adelay={_delay_ms(outro_start)}:all=1,"
                f"afade=t=out:st=0:d={outro_fade:.3f}[outro]"
            )
        )
        labels.insert(0, "[intro]")
        labels.append("[outro]")
    parts.append(
        "".join(labels)
        + f"amix=inputs={len(labels)}:duration=longest:dropout_transition=0,"
        + f"atrim=0:{total_duration:.3f},asetpts=PTS-STARTPTS[out]"
    )
    return ";".join(parts), total_duration


def _mix_audio(
    *,
    spoken_path: Path,
    welcome_path: Path,
    music_path: Path,
    target_format: str,
    config: Dict[str, Any],
    cache_root: Path,
) -> bytes:
    spoken_duration = _duration_seconds(spoken_path)
    welcome_duration = _duration_seconds(welcome_path)
    filter_graph, _ = _build_filter_graph(
        spoken_duration=spoken_duration,
        welcome_duration=welcome_duration,
        config=config,
    )
    tmp_dir = cache_root / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=tmp_dir) as temp_dir:
        output_path = Path(temp_dir) / f"branded.{target_format}"
        _run_ffmpeg(
            [
                "-y",
                "-i",
                str(spoken_path),
                "-stream_loop",
                "-1",
                "-i",
                str(music_path),
                "-i",
                str(welcome_path),
                "-filter_complex",
                filter_graph,
                "-map",
                "[out]",
                "-vn",
                *_audio_output_args(target_format),
                str(output_path),
            ]
        )
        return output_path.read_bytes()


def apply_audio_branding(
    raw_audio: bytes,
    audio_format: str,
    job: Dict[str, Any],
    audio_config: Dict[str, Any],
    *,
    render_tts_fragment: Callable[[Dict[str, Any], Dict[str, Any]], Dict[str, Any]],
    cache_root: Optional[Path] = None,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    target_format = str(audio_format or "").strip().lower() or "mp3"
    root = publish_audio_cache_root(cache_root)
    resolved_config = normalize_audio_branding_config(config or load_audio_branding_config())
    try:
        hash_metadata = audio_branding_hash_metadata(job, audio_config, config=resolved_config)
    except Exception as exc:
        logger.warning("Audio branding season resolution failed episode=%s error=%s", job.get("episode_id", ""), exc)
        return {"audio": raw_audio, "metadata": {"status": "skipped", "skip_reason": f"season_resolution_failed: {exc}"}}
    if not resolved_config.get("enabled"):
        return {"audio": raw_audio, "metadata": {"status": "disabled"}}
    if hash_metadata.get("status") == "skipped":
        return {"audio": raw_audio, "metadata": hash_metadata}
    season = str(hash_metadata.get("season", "")).strip()
    _, music_path = _resolve_asset(resolved_config, season)
    if not music_path.exists():
        logger.warning(
            "Audio branding music missing episode=%s season=%s path=%s",
            job.get("episode_id", ""),
            season,
            music_path,
        )
        return {"audio": raw_audio, "metadata": _skip_metadata(hash_metadata, "missing_music_asset")}
    try:
        welcome = _render_welcome_audio(resolved_config, audio_config, render_tts_fragment)
        welcome_path = Path(welcome["audio_path"])
        (root / "tmp").mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=(root / "tmp")) as temp_dir:
            spoken_path = Path(temp_dir) / f"spoken.{target_format}"
            spoken_path.write_bytes(raw_audio)
            branded = _mix_audio(
                spoken_path=spoken_path,
                welcome_path=welcome_path,
                music_path=music_path,
                target_format=target_format,
                config=resolved_config,
                cache_root=root,
            )
        if not branded:
            raise RuntimeError("Audio branding mix returned empty audio.")
    except Exception as exc:
        logger.warning("Audio branding skipped episode=%s error=%s", job.get("episode_id", ""), exc)
        return {"audio": raw_audio, "metadata": _skip_metadata(hash_metadata, f"branding_failed: {exc}")}
    metadata = dict(hash_metadata)
    metadata["status"] = "applied"
    metadata["welcome"] = {
        "fragment_hash": str(welcome.get("fragment_hash", "")).strip(),
        "audio_path": str(welcome.get("audio_path", "")).strip(),
        "rendered": bool(welcome.get("rendered", False)),
        "provider": str(welcome.get("provider", "")).strip(),
        "tts": normalize_audio_settings(dict(welcome.get("audio_config") or {})),
    }
    return {"audio": branded, "metadata": metadata}
