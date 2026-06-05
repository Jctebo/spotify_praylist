from __future__ import annotations

import hashlib
import json
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PUBLISH_AUDIO_CACHE_DIR = ROOT / ".cache" / "publish_audio"
DEFAULT_FRAGMENT_SILENCE_MS = 350
FFMPEG_BINARY = imageio_ffmpeg.get_ffmpeg_exe()
TTS_LABEL_PREFIXES = {
    "antiphon",
    "conclusion",
    "devotion",
    "intercession",
    "meditation",
    "memorare",
    "petition",
    "prayer",
    "reflection",
    "response",
    "verse",
}
TTS_LABEL_PREFIX_RE = re.compile(
    rf"(?im)(^|[\r\n]+)\s*(?P<label>{'|'.join(sorted(TTS_LABEL_PREFIXES))})\s*:\s+"
)
TTS_LEADING_COLON_LABEL_RE = re.compile(
    rf"(?im)(^|[\r\n]+)\s*colon\s+(?={'|'.join(sorted(TTS_LABEL_PREFIXES))}\s*:)"
)
TTS_LABEL_WORD_COLON_RE = re.compile(
    rf"(?im)(^|[\r\n]+)\s*(?P<label>{'|'.join(sorted(TTS_LABEL_PREFIXES))})\s+colon\s+"
)
TTS_STANDALONE_COLON_LINE_RE = re.compile(r"(?im)(^|[\r\n]+)\s*colon\s*(?=$|[\r\n]+)")


def publish_audio_cache_root(cache_root: Optional[Path] = None) -> Path:
    return Path(cache_root) if cache_root else DEFAULT_PUBLISH_AUDIO_CACHE_DIR


def sanitize_tts_input(text: Any) -> str:
    spoken = str(text or "").replace("\u00a0", " ").strip()
    if not spoken:
        return ""
    spoken = TTS_LEADING_COLON_LABEL_RE.sub(lambda match: match.group(1), spoken)
    spoken = TTS_LABEL_WORD_COLON_RE.sub(lambda match: match.group(1), spoken)
    spoken = TTS_LABEL_PREFIX_RE.sub(lambda match: match.group(1), spoken)
    spoken = TTS_STANDALONE_COLON_LINE_RE.sub(lambda match: match.group(1), spoken)
    spoken = re.sub(r"[ \t]+", " ", spoken)
    spoken = re.sub(r" *\r?\n *", "\n", spoken)
    spoken = re.sub(r"\n{3,}", "\n\n", spoken)
    return spoken.strip()


def sanitize_fragment_for_tts(fragment: Dict[str, Any]) -> Dict[str, Any]:
    sanitized = dict(fragment)
    sanitized["text"] = sanitize_tts_input(fragment.get("text", ""))
    return sanitized


def _normalize_tts_value(value: Any) -> Any:
    if isinstance(value, dict):
        normalized: Dict[str, Any] = {}
        for key in sorted(value.keys(), key=lambda item: str(item)):
            if str(key).strip() == "api_key_env":
                continue
            normalized[str(key)] = _normalize_tts_value(value[key])
        return normalized
    if isinstance(value, list):
        return [_normalize_tts_value(item) for item in value]
    if isinstance(value, tuple):
        return [_normalize_tts_value(item) for item in value]
    return value


def normalize_audio_settings(audio_config: Dict[str, Any]) -> Dict[str, Any]:
    settings = {
        "model": str(audio_config.get("model", "gpt-4o-mini-tts")).strip() or "gpt-4o-mini-tts",
        "voice": str(audio_config.get("voice", "alloy")).strip() or "alloy",
        "format": str(audio_config.get("format", "mp3")).strip().lower() or "mp3",
    }
    try:
        settings["speed"] = float(audio_config.get("speed", 1.0))
    except Exception:
        settings["speed"] = 1.0
    provider = str(audio_config.get("provider", "")).strip().lower()
    if provider:
        settings["provider"] = provider
    if "voice_id" in audio_config:
        settings["voice_id"] = str(audio_config.get("voice_id", "")).strip()
    if "model_id" in audio_config:
        settings["model_id"] = str(audio_config.get("model_id", "")).strip()
    if "voice_settings" in audio_config and isinstance(audio_config.get("voice_settings"), dict):
        settings["voice_settings"] = _normalize_tts_value(dict(audio_config.get("voice_settings") or {}))
    providers = audio_config.get("providers")
    if isinstance(providers, list) and providers:
        settings["providers"] = [_normalize_tts_value(dict(provider)) if isinstance(provider, dict) else provider for provider in providers]
    return settings


def effective_fragment_audio_config(fragment: Dict[str, Any], audio_config: Dict[str, Any]) -> Dict[str, Any]:
    configured = fragment.get("effective_audio_config")
    if isinstance(configured, dict):
        return dict(configured)
    return dict(audio_config)


def _hash_payload(payload: Dict[str, Any]) -> str:
    text = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def fragment_content_hash(fragment: Dict[str, Any], audio_config: Dict[str, Any]) -> str:
    effective_audio_config = effective_fragment_audio_config(fragment, audio_config)
    payload = {
        "text": sanitize_tts_input(fragment.get("text", "")),
        "audio_role": str(fragment.get("audio_role", "")).strip(),
        "tts": normalize_audio_settings(effective_audio_config),
    }
    return _hash_payload(payload)


def audio_manifest_hash(
    job: Dict[str, Any],
    fragments: Sequence[Dict[str, Any]],
    audio_config: Dict[str, Any],
) -> str:
    fragment_rows = [
        {
            "fragment_key": str(fragment.get("fragment_key", "")).strip(),
            "fragment_hash": fragment_content_hash(fragment, audio_config),
        }
        for fragment in fragments
    ]
    payload = {
        "entry_id": str(job.get("entry_id", "")).strip(),
        "episode_id": str(job.get("episode_id", "")).strip() or str(job.get("entry_id", "")).strip(),
        "contract_id": str(job.get("contract_id", "")).strip(),
        "title": str(job.get("title", "")).strip(),
        "description": str(job.get("description", "")).strip(),
        "date": str(job.get("date", "")).strip(),
        "published_date": str(job.get("published_date", "")).strip(),
        "tts": normalize_audio_settings(audio_config),
        "fragments": fragment_rows,
    }
    return _hash_payload(payload)


def fragment_cache_path(cache_root: Path, fragment_hash: str, audio_format: str) -> Path:
    fmt = str(audio_format or "").strip().lower() or "mp3"
    return cache_root / "fragments" / fragment_hash[:2] / fragment_hash[2:4] / f"{fragment_hash}.{fmt}"


def fragment_sidecar_path(audio_path: Path) -> Path:
    return audio_path.with_suffix(".json")


def _audio_output_args(audio_format: str) -> List[str]:
    fmt = str(audio_format or "").strip().lower()
    if fmt == "mp3":
        return ["-c:a", "libmp3lame", "-q:a", "0"]
    if fmt == "wav":
        return ["-c:a", "pcm_s16le"]
    if fmt == "aac":
        return ["-c:a", "aac", "-b:a", "256k"]
    if fmt == "opus":
        return ["-c:a", "libopus", "-b:a", "192k", "-vbr", "on", "-compression_level", "10"]
    if fmt == "flac":
        return ["-c:a", "flac", "-compression_level", "8"]
    raise RuntimeError(f"Unsupported ffmpeg audio format '{audio_format}'.")


def _run_ffmpeg(args: Sequence[str]) -> None:
    completed = subprocess.run([FFMPEG_BINARY, *args], capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        stderr = str(completed.stderr or "").strip()
        raise RuntimeError(stderr or f"ffmpeg failed with exit code {completed.returncode}.")


def _silence_cache_path(cache_root: Path, audio_format: str, silence_ms: int) -> Path:
    silence_hash = _hash_payload(
        {
            "kind": "silence",
            "format": str(audio_format or "").strip().lower() or "mp3",
            "silence_ms": int(silence_ms),
        }
    )
    return cache_root / "silence" / silence_hash[:2] / silence_hash[2:4] / f"{silence_hash}.{str(audio_format or '').strip().lower() or 'mp3'}"


def ensure_silence_fragment(cache_root: Path, audio_format: str, silence_ms: int) -> Optional[Path]:
    if silence_ms <= 0:
        return None
    silence_path = _silence_cache_path(cache_root, audio_format, silence_ms)
    if silence_path.exists():
        return silence_path
    silence_path.parent.mkdir(parents=True, exist_ok=True)
    duration_seconds = max(0.0, silence_ms / 1000.0)
    _run_ffmpeg(
        [
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=44100:cl=stereo",
            "-t",
            f"{duration_seconds:.3f}",
            * _audio_output_args(audio_format),
            str(silence_path),
        ]
    )
    return silence_path


def _fragment_sidecar_payload(
    fragment: Dict[str, Any],
    audio_config: Dict[str, Any],
    fragment_hash: str,
    audio_path: Path,
) -> Dict[str, Any]:
    return {
        "fragment_hash": fragment_hash,
        "fragment_key": str(fragment.get("fragment_key", "")).strip(),
        "block_path": str(fragment.get("block_path", "")).strip(),
        "kind": str(fragment.get("kind", "")).strip(),
        "label": str(fragment.get("label", "")).strip(),
        "text": sanitize_tts_input(fragment.get("text", "")),
        "audio_path": str(audio_path),
        "tts": normalize_audio_settings(audio_config),
    }


def render_fragment_audio(
    fragment: Dict[str, Any],
    audio_config: Dict[str, Any],
    renderer,
    *,
    cache_root: Optional[Path] = None,
    force_rebuild: bool = False,
) -> Dict[str, Any]:
    settings = normalize_audio_settings(audio_config)
    root = publish_audio_cache_root(cache_root)
    fragment_hash = fragment_content_hash(fragment, settings)
    audio_path = fragment_cache_path(root, fragment_hash, settings["format"])
    sidecar_path = fragment_sidecar_path(audio_path)
    audio_path.parent.mkdir(parents=True, exist_ok=True)

    if not force_rebuild and audio_path.exists():
        if not sidecar_path.exists():
            sidecar_path.write_text(
                json.dumps(_fragment_sidecar_payload(fragment, settings, fragment_hash, audio_path), indent=2, sort_keys=True),
                encoding="utf-8",
            )
        else:
            try:
                payload = json.loads(sidecar_path.read_text(encoding="utf-8"))
            except Exception:
                payload = {}
            if str(payload.get("fragment_hash", "")).strip() != fragment_hash:
                sidecar_path.write_text(
                    json.dumps(_fragment_sidecar_payload(fragment, settings, fragment_hash, audio_path), indent=2, sort_keys=True),
                    encoding="utf-8",
                )
        return {"audio_path": audio_path, "fragment_hash": fragment_hash, "rendered": False}

    raw_audio = renderer(sanitize_tts_input(fragment.get("text", "")), dict(settings))
    if not raw_audio:
        raise RuntimeError(f"Audio renderer returned empty output for fragment '{fragment.get('fragment_key', '')}'.")
    audio_path.write_bytes(raw_audio)
    sidecar_path.write_text(
        json.dumps(_fragment_sidecar_payload(fragment, settings, fragment_hash, audio_path), indent=2, sort_keys=True),
        encoding="utf-8",
    )
    return {"audio_path": audio_path, "fragment_hash": fragment_hash, "rendered": True}


def assemble_audio_fragments(
    fragment_paths: Sequence[Path],
    audio_format: str,
    *,
    cache_root: Optional[Path] = None,
    silence_ms: int = DEFAULT_FRAGMENT_SILENCE_MS,
) -> bytes:
    if not fragment_paths:
        raise RuntimeError("No audio fragments were assembled.")
    target_format = str(audio_format or "").strip().lower() or "mp3"
    root = publish_audio_cache_root(cache_root)
    silence_path = ensure_silence_fragment(root, target_format, silence_ms)
    ordered_paths: List[Path] = []
    for index, path in enumerate(fragment_paths):
        ordered_paths.append(Path(path))
        if silence_path is not None and index + 1 < len(fragment_paths):
            ordered_paths.append(silence_path)
    tmp_dir = root / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=tmp_dir) as temp_dir:
        concat_path = Path(temp_dir) / "inputs.txt"
        output_path = Path(temp_dir) / f"assembled.{target_format}"
        concat_lines = [f"file '{path.as_posix()}'" for path in ordered_paths]
        concat_path.write_text("\n".join(concat_lines), encoding="utf-8")
        _run_ffmpeg(
            [
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(concat_path),
                "-vn",
                * _audio_output_args(target_format),
                str(output_path),
            ]
        )
        return output_path.read_bytes()
