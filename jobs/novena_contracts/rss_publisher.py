from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from jobs.publish.audio import (
    ensure_podcast_cover_art,
    github_pages_base_url,
    load_published_audio_jobs,
    podcast_cover_art_public_url,
)
from jobs.publish.rss import build_rss_feed, write_podcast_feed


def _episode_id_from_feed_url(url_text: str) -> str:
    parsed = urlparse(str(url_text or "").strip())
    name = Path(parsed.path).name
    if not name:
        return ""
    stem = Path(name).stem
    return stem.strip()


def _load_existing_feed_jobs(feed_path: Path, *, docs_root: Path, base_url: str) -> List[Dict[str, Any]]:
    if not feed_path.exists():
        return []
    try:
        root = ET.fromstring(feed_path.read_text(encoding="utf-8"))
    except Exception:
        return []
    jobs: List[Dict[str, Any]] = []
    for item in root.findall("./channel/item"):
        episode_id = str(item.findtext("guid", "") or "").strip()
        if not episode_id:
            episode_id = _episode_id_from_feed_url(item.findtext("link", "") or "")
        if not episode_id:
            continue
        audio_path = docs_root / "audio" / f"{episode_id}.mp3"
        audio_url = str(item.findtext("link", "") or "").strip() or f"{base_url.rstrip('/')}/audio/{episode_id}.mp3"
        jobs.append(
            {
                "entry_id": episode_id,
                "episode_id": episode_id,
                "title": str(item.findtext("title", "") or "").strip() or episode_id,
                "description": str(item.findtext("description", "") or "").strip(),
                "published_date": _published_date_from_feed_item(item),
                "audio_path": str(audio_path),
                "audio_url": audio_url,
            }
        )
    return jobs


def _published_date_from_feed_item(item: ET.Element) -> str:
    raw = str(item.findtext("pubDate", "") or "").strip()
    if not raw:
        return ""
    try:
        from email.utils import parsedate_to_datetime

        return parsedate_to_datetime(raw).date().isoformat()
    except Exception:
        return ""


def build_novena_rss_feed(*, docs_root: Optional[Path] = None, base_url: Optional[str] = None):
    root = Path(docs_root) if docs_root else Path(__file__).resolve().parents[2] / "docs"
    feed_base_url = base_url or github_pages_base_url()
    archived_jobs = load_published_audio_jobs(docs_root=root, base_url=feed_base_url)
    existing_jobs = _load_existing_feed_jobs(root / "podcast.xml", docs_root=root, base_url=feed_base_url)
    cover_art_url = podcast_cover_art_public_url(base_url=feed_base_url)
    return build_rss_feed([*existing_jobs, *archived_jobs], base_url=feed_base_url, cover_art_url=cover_art_url)


def publish_novena_rss(*, docs_root: Optional[Path] = None, base_url: Optional[str] = None) -> Path:
    root = Path(docs_root) if docs_root else Path(__file__).resolve().parents[2] / "docs"
    ensure_podcast_cover_art(docs_root=root)
    feed_xml = build_novena_rss_feed(docs_root=root, base_url=base_url)
    feed_path = root / "podcast.xml"
    return write_podcast_feed(feed_xml, feed_path)
