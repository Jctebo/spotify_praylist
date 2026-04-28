from __future__ import annotations

import datetime as _dt
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Sequence

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.publish.audio import (
    DEFAULT_PODCAST_FEED_PATH,
    build_audio_jobs,
    ensure_podcast_cover_art,
    github_pages_base_url,
    load_published_audio_jobs,
    podcast_cover_art_public_url,
    render_audio_job,
)
from jobs.publish.contracts import DEFAULT_CONTRACT_DIR, load_publish_contracts
from jobs.publish.rss import build_rss_feed, load_podcast_feed_jobs, write_podcast_feed


def _default_target_date() -> _dt.date:
    return _dt.date.today() + _dt.timedelta(days=1)


def run_audio_pipeline(
    *,
    contract_dir: Optional[Path] = None,
    docs_root: Optional[Path] = None,
    renderer=None,
    cache_root: Optional[Path] = None,
    base_url: Optional[str] = None,
    target_date: Optional[_dt.date] = None,
    target_dates: Optional[Sequence[_dt.date]] = None,
) -> Dict[str, Any]:
    contracts = load_publish_contracts(contract_dir or DEFAULT_CONTRACT_DIR)
    if target_dates is not None:
        dates = list(target_dates)
    elif target_date is not None:
        dates = [target_date]
    else:
        dates = [_default_target_date()]
    jobs = []
    for date_value in dates:
        jobs.extend(build_audio_jobs(contracts, target_date=date_value))
    rendered_jobs = [render_audio_job(job, renderer=renderer, docs_root=docs_root, cache_root=cache_root) for job in jobs]
    cover_art_path = ensure_podcast_cover_art(docs_root=docs_root)
    feed_base_url = base_url or github_pages_base_url()
    cover_art_url = podcast_cover_art_public_url(base_url=feed_base_url)
    feed_path = Path(docs_root) / "podcast.xml" if docs_root else DEFAULT_PODCAST_FEED_PATH
    archived_jobs = load_podcast_feed_jobs(feed_path, base_url=base_url)
    local_sidecar_jobs = load_published_audio_jobs(docs_root=docs_root, base_url=base_url)
    feed_xml = build_rss_feed([*rendered_jobs, *archived_jobs, *local_sidecar_jobs], base_url=feed_base_url, cover_art_url=cover_art_url)
    feed_path = write_podcast_feed(feed_xml, feed_path)
    return {
        "contracts": len(contracts),
        "jobs": len(jobs),
        "rendered": len(rendered_jobs),
        "archived": len(archived_jobs) + len(local_sidecar_jobs),
        "feed_path": str(feed_path),
        "cover_art_path": str(cover_art_path),
        "rendered_jobs": rendered_jobs,
    }


def main() -> int:
    try:
        result = run_audio_pipeline(base_url=github_pages_base_url())
        print(
            f"audio_pipeline contracts={result['contracts']} jobs={result['jobs']} rendered={result['rendered']} feed_path={result['feed_path']}"
        )
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
