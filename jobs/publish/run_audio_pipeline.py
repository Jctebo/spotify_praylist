from __future__ import annotations

import datetime as _dt
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Sequence

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.publish.audio import (
    DEFAULT_PODCAST_FEED_PATH,
    audio_public_url,
    build_audio_jobs,
    ensure_podcast_cover_art,
    github_pages_base_url,
    load_published_audio_jobs,
    podcast_feed_public_url,
    podcast_cover_art_public_url,
    render_audio_job,
    resolve_audio_public_base_url,
    write_audio_archive_index,
)
from jobs.publish.contracts import DEFAULT_CONTRACT_DIR, load_publish_contracts
from jobs.publish.rss import build_rss_feed, load_podcast_feed_jobs, write_podcast_feed

logger = logging.getLogger(__name__)


def _default_target_date() -> _dt.date:
    return _dt.date.today() + _dt.timedelta(days=1)


def _target_dates_for_mode(mode: str) -> list[_dt.date]:
    today = _dt.date.today()
    normalized = str(mode or "").strip().lower()
    if normalized in {"bootstrap", "bootstrap-no-cache", "reset"}:
        return [today, today + _dt.timedelta(days=1)]
    return [today + _dt.timedelta(days=1)]


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


def run_audio_pipeline(
    *,
    contract_dir: Optional[Path] = None,
    docs_root: Optional[Path] = None,
    renderer=None,
    cache_root: Optional[Path] = None,
    base_url: Optional[str] = None,
    target_date: Optional[_dt.date] = None,
    target_dates: Optional[Sequence[_dt.date]] = None,
    remote_feed_url: Optional[str] = None,
) -> Dict[str, Any]:
    contracts = load_publish_contracts(contract_dir or DEFAULT_CONTRACT_DIR)
    if target_dates is not None:
        dates = list(target_dates)
    elif target_date is not None:
        dates = [target_date]
    else:
        dates = [_default_target_date()]
    logger.info(
        "audio_pipeline start base_url=%s audio_base_url=%s target_dates=%s contracts=%d",
        base_url or github_pages_base_url(),
        resolve_audio_public_base_url(base_url=base_url),
        ",".join(target.isoformat() for target in dates),
        len(contracts),
    )
    jobs = []
    for date_value in dates:
        jobs.extend(build_audio_jobs(contracts, target_date=date_value))
    cover_art_path = ensure_podcast_cover_art(docs_root=docs_root)
    feed_base_url = base_url or github_pages_base_url()
    audio_base_url = resolve_audio_public_base_url(base_url=feed_base_url)
    rendered_jobs = [render_audio_job(job, renderer=renderer, docs_root=docs_root, cache_root=cache_root) for job in jobs]
    for rendered_job in rendered_jobs:
        episode_id = str(rendered_job.get("episode_id") or rendered_job.get("entry_id") or "").strip()
        if episode_id:
            rendered_job["audio_url"] = audio_public_url(episode_id, audio_base_url=audio_base_url)
    cover_art_url = podcast_cover_art_public_url(base_url=feed_base_url)
    feed_path = Path(docs_root) / "podcast.xml" if docs_root else DEFAULT_PODCAST_FEED_PATH
    logger.info(
        "audio_pipeline rendered base_url=%s audio_base_url=%s jobs=%d rendered_ids=%s",
        feed_base_url,
        audio_base_url,
        len(jobs),
        _episode_id_list(rendered_jobs),
    )
    archived_jobs = load_published_audio_jobs(
        docs_root=docs_root,
        base_url=feed_base_url,
        audio_base_url=audio_base_url,
        exclude_episode_ids=[str(job.get("episode_id", "")).strip() for job in rendered_jobs],
    )
    archive_source = "local"
    if not archived_jobs and remote_feed_url:
        archived_jobs = load_podcast_feed_jobs(
            feed_path,
            base_url=base_url,
            remote_feed_url=remote_feed_url,
            include_local=False,
            require_remote=False,
        )
        archive_source = "remote" if archived_jobs else "empty"
    logger.info(
        "audio_pipeline archive source=%s feed_path=%s archived=%d archived_ids=%s",
        archive_source,
        feed_path,
        len(archived_jobs),
        _episode_id_list(archived_jobs),
    )
    feed_xml = build_rss_feed([*rendered_jobs, *archived_jobs], base_url=feed_base_url, cover_art_url=cover_art_url)
    feed_path = write_podcast_feed(feed_xml, feed_path)
    archive_index = write_audio_archive_index(docs_root=docs_root, base_url=feed_base_url, audio_base_url=audio_base_url)
    logger.info(
        "audio_pipeline write feed_path=%s rendered=%d archived=%d archive_items=%d",
        feed_path,
        len(rendered_jobs),
        len(archived_jobs),
        archive_index["archive_items"],
    )
    return {
        "contracts": len(contracts),
        "jobs": len(jobs),
        "rendered": len(rendered_jobs),
        "archived": len(archived_jobs),
        "feed_path": str(feed_path),
        "cover_art_path": str(cover_art_path),
        "archive_index_path": archive_index["archive_index_path"],
        "archive_manifest_path": archive_index["archive_manifest_path"],
        "rendered_jobs": rendered_jobs,
    }


def main() -> int:
    try:
        logging.basicConfig(level=logging.INFO, format="%(message)s")
        mode = str(os.environ.get("PUBLISH_MODE", "")).strip().lower()
        if mode == "bootstrap-no-cache":
            os.environ["PUBLISH_AUDIO_FORCE_REBUILD"] = "true"
        result = run_audio_pipeline(
            base_url=github_pages_base_url(),
            target_dates=_target_dates_for_mode(mode),
            remote_feed_url=podcast_feed_public_url(),
        )
        print(
            f"audio_pipeline mode={mode or 'daily'} contracts={result['contracts']} jobs={result['jobs']} rendered={result['rendered']} archived={result['archived']} rendered_ids={_episode_id_list(result.get('rendered_jobs') or [])} feed_path={result['feed_path']}"
        )
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
