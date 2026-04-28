from __future__ import annotations

from pathlib import Path
from typing import Optional

from jobs.publish.audio import (
    ensure_podcast_cover_art,
    github_pages_base_url,
    load_published_audio_jobs,
    podcast_cover_art_public_url,
)
from jobs.publish.rss import build_rss_feed, load_podcast_feed_jobs, write_podcast_feed


def build_novena_rss_feed(
    *,
    docs_root: Optional[Path] = None,
    base_url: Optional[str] = None,
    reset_feed: bool = False,
) -> str:
    root = Path(docs_root) if docs_root else Path(__file__).resolve().parents[2] / "docs"
    feed_base_url = base_url or github_pages_base_url()
    existing_jobs = [] if reset_feed else load_podcast_feed_jobs(root / "podcast.xml", base_url=base_url)
    archived_jobs = load_published_audio_jobs(docs_root=root, base_url=base_url)
    cover_art_url = podcast_cover_art_public_url(base_url=feed_base_url)
    return build_rss_feed([*existing_jobs, *archived_jobs], base_url=feed_base_url, cover_art_url=cover_art_url)


def publish_novena_rss(*, docs_root: Optional[Path] = None, base_url: Optional[str] = None, reset_feed: bool = False) -> Path:
    root = Path(docs_root) if docs_root else Path(__file__).resolve().parents[2] / "docs"
    ensure_podcast_cover_art(docs_root=root)
    feed_xml = build_novena_rss_feed(docs_root=root, base_url=base_url, reset_feed=reset_feed)
    feed_path = root / "podcast.xml"
    return write_podcast_feed(feed_xml, feed_path)
