from __future__ import annotations

import json
import os
import sys
import shutil
import datetime as _dt
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence

from openai import OpenAI

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.publish.contracts import DEFAULT_GITHUB_PAGES_BASE_URL, ROOT, build_audio_jobs as _build_audio_jobs
from jobs.publish.fragments import (
    assemble_audio_fragments,
    audio_manifest_hash,
    publish_audio_cache_root,
    render_fragment_audio,
)
from jobs.publish.formatting import compose_rss_guid, episode_date_from_episode_id

PUBLISH_DOCS_DIR = ROOT / "docs"
DEFAULT_AUDIO_DIR = PUBLISH_DOCS_DIR / "audio"
DEFAULT_PODCAST_FEED_PATH = PUBLISH_DOCS_DIR / "podcast.xml"
DEFAULT_PODCAST_COVER_ART_SOURCE = ROOT / "config" / "publish" / "images" / "logo_ora_pro_nobis.png"
DEFAULT_PODCAST_COVER_ART_RELATIVE_PATH = Path("images") / DEFAULT_PODCAST_COVER_ART_SOURCE.name
PUBLISH_GITHUB_PAGES_BASE_URL = "PUBLISH_GITHUB_PAGES_BASE_URL"
PUBLISH_PODCAST_FEED_URL = "PUBLISH_PODCAST_FEED_URL"
OPENAI_API_KEY = "OPENAI_API_KEY"
OAI_API_BASE_URL = "OAI_API_BASE_URL"
DEFAULT_PODCAST_FEED_PUBLIC_URL = "https://jctebo.github.io/spotify_praylist/podcast.xml"



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



def _is_current_audio_file(audio_path: Path, sidecar_path: Path, content_hash: str) -> bool:
    if not audio_path.exists() or not sidecar_path.exists():
        return False
    try:
        payload = json.loads(sidecar_path.read_text(encoding="utf-8"))
    except Exception:
        return False
    return str(payload.get("content_hash", "")).strip() == content_hash


def _payload_audio_length(payload: Dict[str, Any], *, sidecar_path: Path) -> int:
    for field_name in ("audio_length", "audio_length_bytes", "audio_bytes", "length"):
        candidate = payload.get(field_name)
        try:
            length = int(candidate)
        except Exception:
            continue
        if length > 0:
            return length
    audio_path = str(payload.get("audio_path", "")).strip()
    if audio_path:
        path = Path(audio_path)
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


def load_published_audio_jobs(*, docs_root: Optional[Path] = None, base_url: Optional[str] = None) -> List[Dict[str, Any]]:
    root = Path(docs_root) if docs_root else PUBLISH_DOCS_DIR
    audio_dir = root / "audio"
    if not audio_dir.exists():
        return []
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
        audio_length = _payload_audio_length(payload, sidecar_path=sidecar_path)
        content_hash = str(payload.get("content_hash", "")).strip()
        generated_at = str(payload.get("generated_at", "")).strip()
        rss_guid = str(payload.get("rss_guid", "")).strip() or compose_rss_guid(episode_id, content_hash)
        audio_path = str(payload.get("audio_path", "")).strip()
        if not audio_path:
            audio_path = str(audio_output_path(episode_id, docs_root=root))
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
                "audio_path": audio_path,
                "audio_url": audio_public_url(episode_id, base_url=base_url),
                "audio_length": audio_length,
                "generated_at": generated_at,
                "rss_guid": rss_guid,
                "content_hash": content_hash,
                "audio_config": dict(payload.get("tts") or {}),
                "fragments": list(payload.get("fragments") or []),
            }
        )
    return jobs


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
    if _is_current_audio_file(audio_path, sidecar_path, content_hash):
        rendered = dict(job)
        rendered["audio_path"] = str(audio_path)
        rendered["audio_url"] = audio_public_url(episode_id)
        rendered["rendered"] = False
        rendered["content_hash"] = content_hash
        rendered["audio_length"] = _job_audio_length(audio_path, fallback=job.get("audio_length"))
        rendered["generated_at"] = str(job.get("generated_at", "")).strip()
        rendered["rss_guid"] = str(job.get("rss_guid", "")).strip() or rss_guid
        return rendered

    renderer = renderer or openai_tts_renderer
    fragment_root = publish_audio_cache_root(cache_root)
    fragment_paths: List[Path] = []
    fragment_results: List[Dict[str, Any]] = []
    for fragment in fragments:
        rendered_fragment = render_fragment_audio(fragment, audio_config, renderer, cache_root=fragment_root)
        fragment_paths.append(Path(rendered_fragment["audio_path"]))
        fragment_results.append(
            {
                "fragment_key": str(fragment.get("fragment_key", "")).strip(),
                "block_path": str(fragment.get("block_path", "")).strip(),
                "kind": str(fragment.get("kind", "")).strip(),
                "label": str(fragment.get("label", "")).strip(),
                "text": str(fragment.get("text", "")).strip(),
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
    audio_length = len(raw_audio)
    audio_path.write_bytes(raw_audio)
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
                "generated_at": generated_at,
                "rss_guid": rss_guid,
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
    rendered["audio_path"] = str(audio_path)
    rendered["audio_url"] = audio_public_url(episode_id)
    rendered["rendered"] = True
    rendered["content_hash"] = content_hash
    rendered["audio_length"] = audio_length
    rendered["generated_at"] = generated_at
    rendered["rss_guid"] = rss_guid
    rendered["audio_fragments"] = fragments
    return rendered
