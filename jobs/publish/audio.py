from __future__ import annotations

import json
import logging
import os
import sys
import shutil
import datetime as _dt
import tempfile
from html import escape as _html_escape
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence

from openai import OpenAI
import requests

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.publish.contracts import DEFAULT_GITHUB_PAGES_BASE_URL, ROOT, build_audio_jobs as _build_audio_jobs
from jobs.publish.fragments import (
    assemble_audio_fragments,
    audio_manifest_hash,
    effective_fragment_audio_config,
    _audio_output_args,
    _run_ffmpeg,
    publish_audio_cache_root,
    normalize_audio_settings,
    render_fragment_audio,
)
from jobs.publish.formatting import compose_rss_guid, episode_date_from_episode_id

PUBLISH_DOCS_DIR = ROOT / "docs"
DEFAULT_AUDIO_DIR = PUBLISH_DOCS_DIR / "audio"
DEFAULT_PODCAST_FEED_PATH = PUBLISH_DOCS_DIR / "podcast.xml"
DEFAULT_AUDIO_ARCHIVE_INDEX_PATH = DEFAULT_AUDIO_DIR / "index.html"
DEFAULT_AUDIO_ARCHIVE_MANIFEST_PATH = DEFAULT_AUDIO_DIR / "index.json"
DEFAULT_PODCAST_COVER_ART_SOURCE = ROOT / "config" / "publish" / "images" / "logo_ora_pro_nobis.png"
DEFAULT_PODCAST_COVER_ART_RELATIVE_PATH = Path("images") / DEFAULT_PODCAST_COVER_ART_SOURCE.name
PUBLISH_GITHUB_PAGES_BASE_URL = "PUBLISH_GITHUB_PAGES_BASE_URL"
PUBLISH_PODCAST_FEED_URL = "PUBLISH_PODCAST_FEED_URL"
PUBLISH_AUDIO_FORCE_REBUILD = "PUBLISH_AUDIO_FORCE_REBUILD"
OPENAI_API_KEY = "OPENAI_API_KEY"
OAI_API_BASE_URL = "OAI_API_BASE_URL"
ELEVENLABS_API_BASE_URL = "https://api.elevenlabs.io/v1"
DEFAULT_PODCAST_FEED_PUBLIC_URL = "https://jctebo.github.io/spotify_praylist/podcast.xml"

logger = logging.getLogger(__name__)



def github_pages_base_url() -> str:
    configured = os.getenv(PUBLISH_GITHUB_PAGES_BASE_URL, "").strip()
    return configured or DEFAULT_GITHUB_PAGES_BASE_URL


def podcast_feed_public_url() -> str:
    configured = os.getenv(PUBLISH_PODCAST_FEED_URL, "").strip()
    return configured or DEFAULT_PODCAST_FEED_PUBLIC_URL



def audio_output_path(episode_id: str, *, docs_root: Optional[Path] = None) -> Path:
    root = Path(docs_root) if docs_root else PUBLISH_DOCS_DIR
    return root / "audio" / f"{episode_id}.mp3"



def audio_sidecar_path(episode_id: str, *, docs_root: Optional[Path] = None) -> Path:
    return audio_output_path(episode_id, docs_root=docs_root).with_suffix(".json")


def audio_public_url(episode_id: str, *, base_url: Optional[str] = None) -> str:
    url_root = (base_url or github_pages_base_url()).rstrip("/")
    return f"{url_root}/audio/{episode_id}.mp3"


def podcast_cover_art_public_url(*, base_url: Optional[str] = None) -> str:
    url_root = (base_url or github_pages_base_url()).rstrip("/")
    return f"{url_root}/{DEFAULT_PODCAST_COVER_ART_RELATIVE_PATH.as_posix()}"


def _env_flag(name: str, *, default: bool = False) -> bool:
    raw = str(os.getenv(name, "")).strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def ensure_podcast_cover_art(*, docs_root: Optional[Path] = None, source_path: Optional[Path] = None) -> Path:
    root = Path(docs_root) if docs_root else PUBLISH_DOCS_DIR
    source = Path(source_path) if source_path else DEFAULT_PODCAST_COVER_ART_SOURCE
    if not source.exists():
        raise RuntimeError(f"Podcast cover art not found: {source}")
    target = root / DEFAULT_PODCAST_COVER_ART_RELATIVE_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    return target



def content_hash_for_entry(entry: Dict[str, Any], audio_config: Dict[str, Any]) -> str:
    fragments = list(entry.get("audio_fragments") or [])
    if not fragments:
        text = str(entry.get("text", "")).strip()
        if not text:
            fragments = []
        else:
            fragments = [
                {
                    "fragment_key": f"entry-text/{str(entry.get('entry_id', '')).strip() or 'entry'}",
                    "block_path": f"entry-text/{str(entry.get('entry_id', '')).strip() or 'entry'}",
                    "kind": "inline",
                    "label": str(entry.get("title", "")).strip() or "Fragment",
                    "text": text,
                }
            ]
    return audio_manifest_hash(entry, fragments, audio_config)



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


def _provider_name(audio_config: Dict[str, Any]) -> str:
    return str(audio_config.get("provider", "")).strip().lower()


def _base_provider_config(audio_config: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "provider": "openai",
        "api_key_env": OPENAI_API_KEY,
        "model": str(audio_config.get("model", "gpt-4o-mini-tts")).strip() or "gpt-4o-mini-tts",
        "voice": str(audio_config.get("voice", "alloy")).strip() or "alloy",
        "format": str(audio_config.get("format", "mp3")).strip().lower() or "mp3",
        "speed": float(audio_config.get("speed", 1.0)),
    }


def _provider_preferences(audio_config: Dict[str, Any]) -> List[Dict[str, Any]]:
    providers = audio_config.get("providers")
    if isinstance(providers, list) and providers:
        return [dict(provider) for provider in providers if isinstance(provider, dict)]
    return [_base_provider_config(audio_config)]


def _effective_provider_audio_config(audio_config: Dict[str, Any], provider_config: Dict[str, Any]) -> Dict[str, Any]:
    effective = dict(audio_config)
    effective.pop("providers", None)
    effective.update(provider_config)
    effective["provider"] = _provider_name(effective) or _provider_name(provider_config) or "openai"
    effective["format"] = str(effective.get("format", audio_config.get("format", "mp3"))).strip().lower() or "mp3"
    try:
        effective["speed"] = float(effective.get("speed", audio_config.get("speed", 1.0)))
    except Exception:
        effective["speed"] = 1.0
    if effective["provider"] == "openai":
        effective["model"] = str(effective.get("model", "gpt-4o-mini-tts")).strip() or "gpt-4o-mini-tts"
        effective["voice"] = str(effective.get("voice", "alloy")).strip() or "alloy"
        effective.pop("voice_settings", None)
        effective.pop("voice_id", None)
        effective.pop("model_id", None)
    elif effective["provider"] == "elevenlabs":
        effective["api_key_env"] = str(effective.get("api_key_env", "ELEVENLABS_API_KEY")).strip() or "ELEVENLABS_API_KEY"
        effective["voice_id"] = str(effective.get("voice_id", "")).strip()
        effective["model_id"] = str(effective.get("model_id", "")).strip() or "eleven_multilingual_v2"
        voice_settings = effective.get("voice_settings")
        if isinstance(voice_settings, dict):
            voice_settings = dict(voice_settings)
        else:
            voice_settings = {}
        voice_settings.setdefault("speed", effective["speed"])
        effective["voice_settings"] = voice_settings
    return effective


def _elevenlabs_output_format(audio_format: str) -> str:
    fmt = str(audio_format or "").strip().lower() or "mp3"
    if fmt == "mp3":
        return "mp3_44100_128"
    raise RuntimeError(f"Unsupported ElevenLabs audio format '{audio_format}'.")


def elevenlabs_tts_renderer(text: str, audio_config: Dict[str, Any]) -> bytes:
    api_key_env = str(audio_config.get("api_key_env", "ELEVENLABS_API_KEY")).strip() or "ELEVENLABS_API_KEY"
    api_key = os.getenv(api_key_env, "").strip()
    if not api_key:
        raise RuntimeError(f"Missing required environment variable: {api_key_env}")
    voice_id = str(audio_config.get("voice_id", "")).strip()
    if not voice_id:
        raise RuntimeError("Missing required ElevenLabs voice_id.")
    model_id = str(audio_config.get("model_id", "")).strip() or "eleven_multilingual_v2"
    payload: Dict[str, Any] = {
        "text": str(text or ""),
        "model_id": model_id,
    }
    voice_settings = audio_config.get("voice_settings")
    if isinstance(voice_settings, dict) and voice_settings:
        payload["voice_settings"] = {key: value for key, value in dict(voice_settings).items() if value is not None}
    response = requests.post(
        f"{ELEVENLABS_API_BASE_URL}/text-to-speech/{voice_id}",
        params={"output_format": _elevenlabs_output_format(audio_config.get("format", "mp3"))},
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        json=payload,
        timeout=120,
    )
    response.raise_for_status()
    raw = bytes(response.content)
    if not raw:
        raise RuntimeError("ElevenLabs audio generation returned empty content.")
    return raw


def _renderer_for_provider(provider_audio_config: Dict[str, Any], renderer):
    if renderer is not None:
        return renderer
    provider = _provider_name(provider_audio_config)
    if provider in {"", "openai"}:
        return openai_tts_renderer
    if provider == "elevenlabs":
        return elevenlabs_tts_renderer
    raise RuntimeError(f"Unsupported audio provider '{provider}'.")


def _render_fragment_with_provider_fallback(
    fragment: Dict[str, Any],
    audio_config: Dict[str, Any],
    renderer,
    *,
    cache_root: Path,
    force_rebuild: bool,
) -> Dict[str, Any]:
    provider_configs = _provider_preferences(audio_config)
    errors: List[str] = []
    last_error: Optional[Exception] = None
    for provider_config in provider_configs:
        effective_audio_config = _effective_provider_audio_config(audio_config, provider_config)
        provider_renderer = _renderer_for_provider(effective_audio_config, renderer)
        provider_name = _provider_name(effective_audio_config) or "openai"
        try:
            rendered_fragment = render_fragment_audio(
                fragment,
                effective_audio_config,
                provider_renderer,
                cache_root=cache_root,
                force_rebuild=force_rebuild,
            )
            return {
                "provider": provider_name,
                "audio_config": effective_audio_config,
                **rendered_fragment,
            }
        except Exception as exc:
            last_error = exc
            errors.append(f"{provider_name}: {exc}")
            logger.warning(
                "Audio provider failed fragment=%s provider=%s error=%s",
                fragment.get("fragment_key", ""),
                provider_name,
                exc,
            )
            continue
    error_message = "; ".join(errors) or "no audio providers were configured."
    raise RuntimeError(
        f"All audio providers failed for fragment '{fragment.get('fragment_key', '')}': {error_message}"
    ) from last_error



def _is_current_audio_file(audio_path: Path, sidecar_path: Path, content_hash: str) -> bool:
    if not audio_path.exists() or not sidecar_path.exists():
        return False
    try:
        payload = json.loads(sidecar_path.read_text(encoding="utf-8"))
    except Exception:
        return False
    return str(payload.get("content_hash", "")).strip() == content_hash


def _payload_audio_length(
    payload: Dict[str, Any],
    *,
    sidecar_path: Path,
    audio_path: Optional[Path] = None,
) -> int:
    for field_name in ("audio_length", "audio_length_bytes", "audio_bytes", "length"):
        candidate = payload.get(field_name)
        try:
            length = int(candidate)
        except Exception:
            continue
        if length > 0:
            return length
    candidate_path = Path(audio_path) if audio_path else None
    if candidate_path and candidate_path.exists():
        try:
            return candidate_path.stat().st_size
        except Exception:
            return 0
    stored_audio_path = str(payload.get("audio_path", "")).strip()
    if stored_audio_path:
        path = Path(stored_audio_path)
        if not path.is_absolute():
            path = sidecar_path.parent / path
        if path.exists():
            try:
                return path.stat().st_size
            except Exception:
                return 0
    return 0


def _iso_utc_now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


def _job_audio_length(audio_path: Path, *, fallback: Any = None) -> int:
    if audio_path.exists():
        try:
            size = audio_path.stat().st_size
            if size > 0:
                return size
        except Exception:
            pass
    try:
        return int(fallback)
    except Exception:
        return 0


def _normalize_loudness_settings(audio_config: Dict[str, Any]) -> Dict[str, Any]:
    settings = audio_config.get("loudness_normalization")
    if isinstance(settings, dict):
        enabled = bool(settings.get("enabled", False))
    else:
        enabled = bool(settings)
        settings = {}
    if not enabled:
        return {"enabled": False}
    try:
        integrated_lufs = float(settings.get("integrated_lufs", -16))
    except Exception:
        integrated_lufs = -16.0
    try:
        true_peak_db = float(settings.get("true_peak_db", -1.5))
    except Exception:
        true_peak_db = -1.5
    try:
        lra = float(settings.get("lra", 11))
    except Exception:
        lra = 11.0
    return {
        "enabled": True,
        "integrated_lufs": integrated_lufs,
        "true_peak_db": true_peak_db,
        "lra": lra,
    }


def normalize_episode_loudness(raw_audio: bytes, audio_format: str, audio_config: Dict[str, Any], *, cache_root: Optional[Path] = None) -> bytes:
    settings = _normalize_loudness_settings(audio_config)
    if not settings["enabled"]:
        return raw_audio
    target_format = str(audio_format or "").strip().lower() or "mp3"
    root = publish_audio_cache_root(cache_root)
    tmp_dir = root / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=tmp_dir) as temp_dir:
        input_path = Path(temp_dir) / f"input.{target_format}"
        output_path = Path(temp_dir) / f"normalized.{target_format}"
        input_path.write_bytes(raw_audio)
        loudnorm = (
            f"loudnorm=I={settings['integrated_lufs']:g}:"
            f"TP={settings['true_peak_db']:g}:"
            f"LRA={settings['lra']:g}:"
            "print_format=summary"
        )
        _run_ffmpeg(
            [
                "-y",
                "-i",
                str(input_path),
                "-af",
                loudnorm,
                "-vn",
                *_audio_output_args(target_format),
                str(output_path),
            ]
        )
        normalized = output_path.read_bytes()
    if not normalized:
        raise RuntimeError("Loudness normalization returned empty audio.")
    return normalized


def load_published_audio_jobs(
    *,
    docs_root: Optional[Path] = None,
    base_url: Optional[str] = None,
    exclude_episode_ids: Optional[Sequence[str]] = None,
) -> List[Dict[str, Any]]:
    root = Path(docs_root) if docs_root else PUBLISH_DOCS_DIR
    audio_dir = root / "audio"
    if not audio_dir.exists():
        return []
    excluded = {str(value).strip() for value in (exclude_episode_ids or []) if str(value).strip()}
    jobs: List[Dict[str, Any]] = []
    for sidecar_path in sorted(audio_dir.glob("*.json")):
        try:
            payload = json.loads(sidecar_path.read_text(encoding="utf-8"))
        except Exception as exc:
            raise RuntimeError(f"Invalid published audio sidecar '{sidecar_path}': {exc}") from exc
        episode_id = str(payload.get("episode_id", "")).strip()
        if not episode_id:
            continue
        published_date = _published_date_from_payload(payload, sidecar_path=sidecar_path)
        if not published_date:
            print(f"WARN skipping legacy published audio sidecar without published_date: {sidecar_path}", file=sys.stderr)
            continue
        content_hash = str(payload.get("content_hash", "")).strip()
        generated_at = str(payload.get("generated_at", "")).strip()
        rss_guid = str(payload.get("rss_guid", "")).strip() or compose_rss_guid(episode_id, content_hash)
        resolved_audio_path = audio_output_path(episode_id, docs_root=root)
        if not resolved_audio_path.exists():
            audio_path = str(payload.get("audio_path", "")).strip()
            if not audio_path:
                audio_path = str(resolved_audio_path)
            candidate_audio_path = Path(audio_path)
            if not candidate_audio_path.is_absolute():
                candidate_audio_path = sidecar_path.parent / candidate_audio_path
            resolved_audio_path = candidate_audio_path
        if not resolved_audio_path.exists():
            audio_block = payload.get("audio") or {}
            if isinstance(audio_block, dict) and not bool(audio_block.get("rendered", True)):
                continue
            print(f"WARN skipping published audio sidecar without audio file: {sidecar_path}", file=sys.stderr)
            continue
        audio_length = _payload_audio_length(payload, sidecar_path=sidecar_path, audio_path=resolved_audio_path)
        if episode_id in excluded:
            continue
        title = str(payload.get("title", "")).strip() or str(payload.get("entry_id", "")).strip() or episode_id
        description = str(payload.get("description", "")).strip() or title
        jobs.append(
            {
                "entry_id": str(payload.get("entry_id", "")).strip() or episode_id,
                "episode_id": episode_id,
                "family_id": str(payload.get("family_id", "")).strip(),
                "contract_id": str(payload.get("contract_id", "")).strip(),
                "contract_type": str(payload.get("contract_type", "")).strip(),
                "frequency": str(payload.get("frequency", "")).strip(),
                "title": title,
                "description": description,
                "published_date": published_date,
                "content_hash": str(payload.get("content_hash", "")).strip(),
                "audio_path": str(audio_output_path(episode_id, docs_root=root)),
                "audio_url": audio_public_url(episode_id, base_url=base_url),
                "audio_length": audio_length,
                "generated_at": generated_at,
                "rss_guid": rss_guid,
                "content_hash": content_hash,
                "audio_config": dict(payload.get("tts") or {}),
                "fragments": list(payload.get("fragments") or []),
                "resume_markers": list(payload.get("resume_markers") or []),
            }
        )
    jobs.sort(
        key=lambda job: (
            str(job.get("published_date", "")).strip(),
            str(job.get("episode_id", "")).strip() or str(job.get("entry_id", "")).strip(),
        ),
        reverse=True,
    )
    return jobs


def _audio_archive_item_path(root: Path, job: Dict[str, Any]) -> Path:
    episode_id = str(job.get("episode_id", "")).strip() or str(job.get("entry_id", "")).strip()
    if not episode_id:
        raise RuntimeError("Archive item is missing an episode_id.")
    return audio_output_path(episode_id, docs_root=root)


def build_audio_archive_manifest(
    jobs: Sequence[Dict[str, Any]],
    *,
    docs_root: Optional[Path] = None,
    base_url: Optional[str] = None,
) -> Dict[str, Any]:
    root = Path(docs_root) if docs_root else PUBLISH_DOCS_DIR
    site_base = str(base_url or github_pages_base_url()).strip().rstrip("/")
    items: List[Dict[str, Any]] = []
    for job in jobs:
        episode_id = str(job.get("episode_id", "")).strip() or str(job.get("entry_id", "")).strip()
        if not episode_id:
            continue
        audio_path = _audio_archive_item_path(root, job)
        sidecar_path = audio_path.with_suffix(".json")
        if not audio_path.exists() or not sidecar_path.exists():
            print(
                f"WARN skipping archive entry without complete files: {sidecar_path if sidecar_path.exists() else audio_path}",
                file=sys.stderr,
            )
            continue
        items.append(
            {
                "entry_id": str(job.get("entry_id", "")).strip() or episode_id,
                "episode_id": episode_id,
                "title": str(job.get("title", "")).strip() or episode_id,
                "description": str(job.get("description", "")).strip() or str(job.get("title", "")).strip() or episode_id,
                "published_date": str(job.get("published_date", "")).strip(),
                "generated_at": str(job.get("generated_at", "")).strip(),
                "rss_guid": str(job.get("rss_guid", "")).strip() or compose_rss_guid(episode_id, job.get("content_hash")),
                "content_hash": str(job.get("content_hash", "")).strip(),
                "audio_length": int(job.get("audio_length") or 0),
                "audio_url": audio_public_url(episode_id, base_url=site_base),
                "audio_path": audio_path.relative_to(root).as_posix(),
                "audio_filename": audio_path.name,
                "sidecar_path": sidecar_path.relative_to(root).as_posix(),
                "sidecar_url": f"{site_base}/audio/{sidecar_path.name}",
            }
        )
    items.sort(
        key=lambda item: (
            str(item.get("published_date", "")).strip(),
            str(item.get("episode_id", "")).strip(),
        ),
        reverse=True,
    )
    return {
        "generated_at": _iso_utc_now(),
        "count": len(items),
        "items": items,
    }


def _archive_index_html(manifest: Dict[str, Any], *, base_url: Optional[str] = None) -> str:
    site_base = str(base_url or github_pages_base_url()).strip().rstrip("/")
    items = list(manifest.get("items") or [])
    count = int(manifest.get("count") or len(items))
    generated_at = str(manifest.get("generated_at", "")).strip() or _iso_utc_now()
    rows = []
    for item in items:
        title = _html_escape(str(item.get("title", "")).strip() or str(item.get("episode_id", "")).strip())
        episode_id = _html_escape(str(item.get("episode_id", "")).strip())
        published_date = _html_escape(str(item.get("published_date", "")).strip())
        audio_href = _html_escape(str(item.get("audio_filename", "")).strip() or f"{episode_id}.mp3")
        sidecar_href = _html_escape(str(item.get("sidecar_url", "")).strip() or f"{episode_id}.json")
        audio_length = _html_escape(str(item.get("audio_length", "")).strip() or "-")
        rows.append(
            f"""
            <tr>
              <td>
                <strong>{title}</strong>
                <div class=\"meta\">{episode_id}</div>
              </td>
              <td>{published_date}</td>
              <td><a href=\"{audio_href}\">MP3</a></td>
              <td><a href=\"{sidecar_href}\">JSON</a></td>
              <td>{audio_length}</td>
            </tr>
            """
        )
    empty_state = (
        """
        <div class=\"empty\">
          <h2>Archive not seeded yet</h2>
          <p>The publish workflow has not restored any historical audio artifacts into this workspace yet.</p>
        </div>
        """
        if not rows
        else ""
    )
    table = (
        f"""
        <table>
          <thead>
            <tr>
              <th>Episode</th>
              <th>Published</th>
              <th>Audio</th>
              <th>Sidecar</th>
              <th>Bytes</th>
            </tr>
          </thead>
          <tbody>
            {''.join(rows)}
          </tbody>
        </table>
        """
        if rows
        else ""
    )
    feed_href = _html_escape(f"{site_base}/podcast.xml")
    root_href = _html_escape(site_base or "/")
    return f"""<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
  <meta name=\"color-scheme\" content=\"light\">
  <title>Spotify Praylist Archive</title>
  <style>
    :root {{
      --bg: #f7f1e8;
      --bg-alt: #efe2cf;
      --card: rgba(255, 255, 255, 0.84);
      --card-border: rgba(83, 62, 40, 0.12);
      --ink: #2d231a;
      --muted: #665646;
      --accent: #8d4d2f;
      --accent-soft: #f3d2bf;
      --shadow: 0 24px 70px rgba(68, 45, 28, 0.12);
    }}

    * {{ box-sizing: border-box; }}

    html, body {{
      margin: 0;
      min-height: 100%;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(205, 143, 108, 0.18), transparent 34%),
        radial-gradient(circle at 80% 10%, rgba(141, 77, 47, 0.12), transparent 28%),
        linear-gradient(180deg, var(--bg), var(--bg-alt));
      font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
    }}

    main {{
      max-width: 1120px;
      margin: 0 auto;
      padding: 48px 20px 72px;
    }}

    .hero {{
      padding: 32px;
      border-radius: 28px;
      border: 1px solid var(--card-border);
      background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.7));
      box-shadow: var(--shadow);
    }}

    .eyebrow {{
      margin: 0 0 10px;
      color: var(--accent);
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-size: 0.76rem;
    }}

    h1 {{
      margin: 0;
      font-size: clamp(2.4rem, 6vw, 4.8rem);
      line-height: 0.96;
      letter-spacing: -0.04em;
    }}

    .lede {{
      max-width: 70ch;
      margin: 14px 0 0;
      color: var(--muted);
      line-height: 1.7;
      font-size: 1.04rem;
    }}

    .links {{
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }}

    .link {{
      display: inline-flex;
      align-items: center;
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid rgba(141, 77, 47, 0.16);
      background: rgba(255, 255, 255, 0.84);
      color: var(--ink);
      text-decoration: none;
    }}

    .stats {{
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-top: 18px;
    }}

    .stat {{
      padding: 16px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(141, 77, 47, 0.12);
    }}

    .stat label {{
      display: block;
      margin-bottom: 6px;
      color: var(--muted);
      font-size: 0.78rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }}

    .stat code {{
      font-size: 0.92rem;
      color: var(--ink);
      word-break: break-word;
    }}

    .panel {{
      margin-top: 20px;
      padding: 22px;
      border: 1px solid var(--card-border);
      border-radius: 24px;
      background: var(--card);
      box-shadow: 0 14px 40px rgba(68, 45, 28, 0.08);
    }}

    .panel h2 {{
      margin: 0 0 8px;
      font-size: 1.15rem;
    }}

    .panel p {{
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
    }}

    table {{
      width: 100%;
      border-collapse: collapse;
      margin-top: 14px;
      overflow: hidden;
    }}

    th, td {{
      padding: 14px 10px;
      text-align: left;
      border-bottom: 1px solid rgba(83, 62, 40, 0.12);
      vertical-align: top;
    }}

    th {{
      font-size: 0.77rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }}

    td .meta {{
      margin-top: 4px;
      color: var(--muted);
      font-size: 0.9rem;
    }}

    .empty {{
      padding: 24px;
      border-radius: 18px;
      border: 1px dashed rgba(141, 77, 47, 0.22);
      background: rgba(255, 255, 255, 0.6);
    }}

    .empty h2 {{
      margin: 0 0 8px;
      font-size: 1.05rem;
    }}

    .empty p {{
      margin: 0;
      color: var(--muted);
    }}

    footer {{
      margin-top: 18px;
      color: var(--muted);
      font-size: 0.92rem;
    }}

    @media (max-width: 820px) {{
      main {{
        padding: 24px 14px 44px;
      }}

      .hero {{
        padding: 22px;
        border-radius: 22px;
      }}

      .stats {{
        grid-template-columns: 1fr;
      }}
    }}
  </style>
</head>
<body>
  <main>
    <section class=\"hero\">
      <p class=\"eyebrow\">GitHub Pages archive</p>
      <h1>Published audio archive</h1>
      <p class=\"lede\">
        This page mirrors the published audio files that ship with the podcast feed.
        It is rebuilt from the local archive snapshot so future runs can restore the same files
        without depending on the remote feed being available first.
      </p>
      <div class=\"links\">
        <a class=\"link\" href=\"{feed_href}\">Open feed XML</a>
        <a class=\"link\" href=\"{root_href}/\">Go to site root</a>
      </div>
      <div class=\"stats\">
        <div class=\"stat\">
          <label>Archive items</label>
          <code>{count}</code>
        </div>
        <div class=\"stat\">
          <label>Generated at</label>
          <code>{_html_escape(generated_at)}</code>
        </div>
        <div class=\"stat\">
          <label>Archive path</label>
          <code>/audio/</code>
        </div>
      </div>
    </section>

    <section class=\"panel\">
      <h2>Episode listing</h2>
      <p>Each row points to the MP3 enclosure and its JSON sidecar.</p>
      {empty_state}
      {table}
    </section>

    <footer>
      The archive dashboard is static and published with the rest of <code>docs/</code>.
    </footer>
  </main>
</body>
</html>
"""


def write_audio_archive_index(*, docs_root: Optional[Path] = None, base_url: Optional[str] = None) -> Dict[str, Any]:
    root = Path(docs_root) if docs_root else PUBLISH_DOCS_DIR
    audio_dir = root / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    jobs = load_published_audio_jobs(docs_root=root, base_url=base_url)
    manifest = build_audio_archive_manifest(jobs, docs_root=root, base_url=base_url)
    manifest_path = audio_dir / "index.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    html_path = audio_dir / "index.html"
    html_path.write_text(_archive_index_html(manifest, base_url=base_url), encoding="utf-8")
    return {
        "archive_index_path": str(html_path),
        "archive_manifest_path": str(manifest_path),
        "archive_items": len(manifest["items"]),
    }


def _published_date_from_payload(payload: Dict[str, Any], *, sidecar_path: Path) -> str:
    for field_name in ("published_date", "date", "published"):
        candidate = str(payload.get(field_name, "")).strip()
        if candidate:
            try:
                return _dt.date.fromisoformat(candidate).isoformat()
            except Exception:
                pass
    episode_id = str(payload.get("episode_id", "")).strip()
    parsed = episode_date_from_episode_id(episode_id)
    if parsed is not None:
        return parsed.isoformat()
    audio_path = str(payload.get("audio_path", "")).strip()
    if audio_path:
        path = Path(audio_path)
        if not path.is_absolute():
            path = sidecar_path.parent / path
        if path.exists():
            try:
                return _dt.datetime.fromtimestamp(path.stat().st_mtime, tz=_dt.timezone.utc).date().isoformat()
            except Exception:
                return ""
    return ""



def render_audio_job(
    job: Dict[str, Any],
    *,
    renderer: Optional[Callable[[str, Dict[str, Any]], bytes]] = None,
    docs_root: Optional[Path] = None,
    cache_root: Optional[Path] = None,
) -> Dict[str, Any]:
    root = Path(docs_root) if docs_root else PUBLISH_DOCS_DIR
    episode_id = str(job.get("episode_id") or job.get("entry_id") or "").strip()
    if not episode_id:
        raise RuntimeError("Audio job is missing an episode_id.")
    audio_path = audio_output_path(episode_id, docs_root=root)
    sidecar_path = audio_sidecar_path(episode_id, docs_root=root)
    audio_path.parent.mkdir(parents=True, exist_ok=True)
    audio_config = dict(job.get("audio_config") or {})
    fragments = list(job.get("audio_fragments") or [])
    if not fragments:
        text = str(job.get("text", "")).strip()
        if text:
            fragments = [
                {
                    "fragment_key": f"entry-text/{str(job.get('entry_id', '')).strip() or 'entry'}",
                    "block_path": f"entry-text/{str(job.get('entry_id', '')).strip() or 'entry'}",
                    "kind": "inline",
                    "label": str(job.get("title", "")).strip() or "Fragment",
                    "text": text,
                }
            ]
    content_hash = str(job.get("content_hash", "")).strip() or content_hash_for_entry(job, audio_config)
    generated_at = _iso_utc_now()
    rss_guid = compose_rss_guid(episode_id, content_hash)
    if not _env_flag(PUBLISH_AUDIO_FORCE_REBUILD) and _is_current_audio_file(audio_path, sidecar_path, content_hash):
        rendered = dict(job)
        rendered["audio_path"] = str(audio_path)
        rendered["audio_url"] = audio_public_url(episode_id)
        rendered["rendered"] = False
        rendered["content_hash"] = content_hash
        rendered["audio_length"] = _job_audio_length(audio_path, fallback=job.get("audio_length"))
        rendered["generated_at"] = str(job.get("generated_at", "")).strip()
        rendered["rss_guid"] = str(job.get("rss_guid", "")).strip() or rss_guid
        rendered["resume_markers"] = list(job.get("resume_markers") or [])
        return rendered

    fragment_root = publish_audio_cache_root(cache_root)
    errors: List[str] = []
    last_error: Optional[Exception] = None
    force_rebuild = _env_flag(PUBLISH_AUDIO_FORCE_REBUILD)

    fragment_paths: List[Path] = []
    fragment_results: List[Dict[str, Any]] = []
    rendered_providers: List[str] = []
    try:
        for fragment in fragments:
            fragment_audio_config = effective_fragment_audio_config(fragment, audio_config)
            rendered_fragment = _render_fragment_with_provider_fallback(
                fragment,
                fragment_audio_config,
                renderer,
                cache_root=fragment_root,
                force_rebuild=force_rebuild,
            )
            rendered_effective_config = dict(rendered_fragment["audio_config"])
            fragment_paths.append(Path(rendered_fragment["audio_path"]))
            provider_name = str(rendered_fragment.get("provider", "")).strip() or "openai"
            rendered_providers.append(provider_name)
            fragment_results.append(
                {
                    "fragment_key": str(fragment.get("fragment_key", "")).strip(),
                    "block_path": str(fragment.get("block_path", "")).strip(),
                    "kind": str(fragment.get("kind", "")).strip(),
                    "label": str(fragment.get("label", "")).strip(),
                    "text": str(fragment.get("text", "")).strip(),
                    "audio_role": str(fragment.get("audio_role", "")).strip(),
                    "tts": normalize_audio_settings(rendered_effective_config),
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
            raise RuntimeError(f"Audio assembly returned empty output for entry '{job.get('entry_id', '')}'.")
        loudness_settings = _normalize_loudness_settings(audio_config)
        raw_audio = normalize_episode_loudness(raw_audio, target_format, audio_config, cache_root=fragment_root)
        audio_length = len(raw_audio)
        audio_path.write_bytes(raw_audio)
        rendered_audio_config = normalize_audio_settings(audio_config)
        fragment_manifest_hash = audio_manifest_hash(job, fragments, audio_config)
        provider_name = rendered_providers[0] if len(set(rendered_providers)) == 1 else "mixed"
        if provider_name != "mixed":
            rendered_audio_config["provider"] = provider_name
        sidecar_path.write_text(
            json.dumps(
                {
                    "entry_id": job.get("entry_id", ""),
                    "episode_id": episode_id,
                    "published_date": str(job.get("published_date", "")).strip(),
                    "contract_id": str(job.get("contract_id", "")).strip(),
                    "contract_type": str(job.get("contract_type", "")).strip(),
                    "frequency": str(job.get("frequency", "")).strip(),
                    "title": str(job.get("title", "")).strip(),
                    "description": str(job.get("description", "")).strip(),
                    "content_hash": content_hash,
                    "audio_path": str(audio_path),
                    "audio_url": audio_public_url(episode_id),
                    "audio_length": audio_length,
                    "loudness_normalization": loudness_settings,
                    "generated_at": generated_at,
                    "rss_guid": rss_guid,
                    "tts": rendered_audio_config,
                    "fragment_manifest_hash": fragment_manifest_hash,
                    "fragments": fragment_results,
                    "resume_markers": list(job.get("resume_markers") or []),
                },
                indent=2,
                sort_keys=True,
            ),
            encoding="utf-8",
        )
        rendered = dict(job)
        rendered["audio_path"] = str(audio_path)
        rendered["audio_url"] = audio_public_url(episode_id)
        rendered["rendered"] = True
        rendered["content_hash"] = content_hash
        rendered["audio_length"] = audio_length
        rendered["loudness_normalization"] = loudness_settings
        rendered["generated_at"] = generated_at
        rendered["rss_guid"] = rss_guid
        rendered["audio_fragments"] = fragments
        rendered["resume_markers"] = list(job.get("resume_markers") or [])
        rendered["audio_config"] = rendered_audio_config
        rendered["fragment_manifest_hash"] = fragment_manifest_hash
        rendered["provider"] = provider_name
        return rendered
    except Exception as exc:
        last_error = exc
        errors.append(str(exc))
        logger.warning("Audio rendering failed episode=%s error=%s", episode_id, exc)

    error_message = "; ".join(errors) or "no audio providers were configured."
    raise RuntimeError(f"All audio providers failed for entry '{job.get('entry_id', '')}': {error_message}") from last_error
