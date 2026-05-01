from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, Optional, Sequence

from jobs.publish.audio import ensure_podcast_cover_art, github_pages_base_url, podcast_cover_art_public_url
from jobs.publish.rss import build_rss_feed, load_podcast_feed_jobs, write_podcast_feed

logger = logging.getLogger(__name__)


def _episode_id_list(jobs: Sequence[Dict[str, Any]], *, limit: int = 8) -> str:
    episode_ids = [
        str(job.get("episode_id", "")).strip() or str(job.get("entry_id", "")).strip()
        for job in jobs
        if str(job.get("episode_id", "")).strip() or str(job.get("entry_id", "")).strip()
    ]
    if not episode_ids:
        return "-"
    if len(episode_ids) <= limit:
        return ",".join(episode_ids)
    remaining = len(episode_ids) - limit
    return f"{','.join(episode_ids[:limit])},...(+{remaining} more)"


def build_novena_rss_feed(
    *,
    docs_root: Optional[Path] = None,
    base_url: Optional[str] = None,
    current_jobs: Optional[Sequence[Dict[str, Any]]] = None,
    reset_feed: bool = False,
    remote_feed_url: Optional[str] = None,
) -> str:
    root = Path(docs_root) if docs_root else Path(__file__).resolve().parents[2] / "docs"
    feed_base_url = base_url or github_pages_base_url()
    existing_jobs = [] if reset_feed else load_podcast_feed_jobs(
        root / "podcast.xml",
        base_url=base_url,
        remote_feed_url=remote_feed_url,
    )
    cover_art_url = podcast_cover_art_public_url(base_url=feed_base_url)
    current = list(current_jobs or [])
    logger.info(
        "novena_rss start base_url=%s reset_feed=%s existing=%d current=%d current_ids=%s existing_ids=%s",
        feed_base_url,
        reset_feed,
        len(existing_jobs),
        len(current),
        _episode_id_list(current),
        _episode_id_list(existing_jobs),
    )
    return build_rss_feed([*existing_jobs, *current], base_url=feed_base_url, cover_art_url=cover_art_url)


def publish_novena_rss(
    *,
    docs_root: Optional[Path] = None,
    base_url: Optional[str] = None,
    current_jobs: Optional[Sequence[Dict[str, Any]]] = None,
    reset_feed: bool = False,
    remote_feed_url: Optional[str] = None,
) -> Path:
    root = Path(docs_root) if docs_root else Path(__file__).resolve().parents[2] / "docs"
    ensure_podcast_cover_art(docs_root=root)
    feed_xml = build_novena_rss_feed(
        docs_root=root,
        base_url=base_url,
        current_jobs=current_jobs,
        reset_feed=reset_feed,
        remote_feed_url=remote_feed_url,
    )
    feed_path = root / "podcast.xml"
    written = write_podcast_feed(feed_xml, feed_path)
    logger.info("novena_rss write feed_path=%s", written)
    return written
