from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, Optional

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
from jobs.publish.rss import build_rss_feed, write_podcast_feed



def run_audio_pipeline(
    *,
    contract_dir: Optional[Path] = None,
    docs_root: Optional[Path] = None,
    renderer=None,
    cache_root: Optional[Path] = None,
) -> Dict[str, Any]:
    contracts = load_publish_contracts(contract_dir or DEFAULT_CONTRACT_DIR)
    jobs = build_audio_jobs(contracts)
    rendered_jobs = [render_audio_job(job, renderer=renderer, docs_root=docs_root, cache_root=cache_root) for job in jobs]
    cover_art_path = ensure_podcast_cover_art(docs_root=docs_root)
    cover_art_url = podcast_cover_art_public_url(base_url=github_pages_base_url())
    archived_jobs = load_published_audio_jobs(docs_root=docs_root, base_url=github_pages_base_url())
    feed_xml = build_rss_feed([*rendered_jobs, *archived_jobs], base_url=github_pages_base_url(), cover_art_url=cover_art_url)
    feed_path = write_podcast_feed(feed_xml, Path(docs_root) / "podcast.xml" if docs_root else DEFAULT_PODCAST_FEED_PATH)
    return {
        "contracts": len(contracts),
        "jobs": len(jobs),
        "rendered": len(rendered_jobs),
        "archived": len(archived_jobs),
        "feed_path": str(feed_path),
        "cover_art_path": str(cover_art_path),
        "rendered_jobs": rendered_jobs,
    }



def main() -> int:
    try:
        result = run_audio_pipeline()
        print(
            f"audio_pipeline contracts={result['contracts']} jobs={result['jobs']} rendered={result['rendered']} feed_path={result['feed_path']}"
        )
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
