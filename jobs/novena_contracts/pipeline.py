from __future__ import annotations

import datetime as _dt
import logging
import os
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence

from jobs.publish.audio import github_pages_base_url, podcast_feed_public_url

from .artifact_writer import audio_output_path, write_novena_artifact
from .audio import build_novena_audio_job, render_novena_audio_job
from .contracts import DEFAULT_CONTRACT_DIR, NovenaContract, load_novena_contracts
from .engine import generate_text, render_novena
from .resolver import resolve_active_novenas
from .rss_publisher import publish_novena_rss

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


def run_novena_pipeline(
    *,
    contract_dir: Optional[Path] = None,
    docs_root: Optional[Path] = None,
    cache_root: Optional[Path] = None,
    today: Optional[_dt.date] = None,
    publish_dates: Optional[Sequence[_dt.date]] = None,
    reset_feed: bool = False,
    renderer: Optional[Callable[[str, Dict[str, Any]], bytes]] = None,
    generate_text_fn: Callable[[str, Dict[str, Any]], str] = generate_text,
    base_url: Optional[str] = None,
    remote_feed_url: Optional[str] = None,
) -> Dict[str, Any]:
    root = Path(docs_root) if docs_root else Path(__file__).resolve().parents[2] / "docs"
    contracts = load_novena_contracts(contract_dir or DEFAULT_CONTRACT_DIR)
    anchor_date = today or _dt.date.today()
    target_dates = list(publish_dates) if publish_dates is not None else [anchor_date]
    logger.info(
        "novena_pipeline start base_url=%s publish_dates=%s contracts=%d",
        base_url or github_pages_base_url(),
        ",".join(target.isoformat() for target in target_dates),
        len(contracts),
    )
    active: List[Any] = []
    for target_date in target_dates:
        active.extend(resolve_active_novenas(target_date, contracts=contracts))
    if not active:
        logger.info("novena_pipeline no_active base_url=%s publish_dates=%s", base_url or github_pages_base_url(), ",".join(target.isoformat() for target in target_dates))
        return {
            "contracts": len(contracts),
            "active": 0,
            "rendered": 0,
            "audio": 0,
            "feed_written": False,
            "feed_path": str(root / "podcast.xml"),
            "publish_dates": [target.isoformat() for target in target_dates],
            "items": [],
        }

    items: List[Dict[str, Any]] = []
    for runtime in active:
        rendered = render_novena(runtime, generate_text_fn=generate_text_fn)
        rendered["episode_id"] = f"{runtime.date.isoformat()}-{runtime.contract_id}-day-{runtime.active_day}"
        context = dict(rendered.get("context") or {})
        rendered["title"] = _render_title(runtime, context)
        rendered["description"] = _render_description(runtime, context)
        audio_job = build_novena_audio_job(runtime, rendered)
        audio_result = render_novena_audio_job(audio_job, renderer=renderer, docs_root=root, cache_root=cache_root)
        sidecar_path = write_novena_artifact(runtime, rendered, audio_result, docs_root=root)
        items.append(
            {
                "runtime": runtime.to_dict(),
                "rendered": rendered,
                "audio": audio_result,
                "sidecar": str(sidecar_path),
            }
        )

    current_jobs = [dict(item["audio"]) for item in items]
    logger.info("novena_pipeline rendered active=%d rendered_ids=%s", len(active), _episode_id_list(current_jobs))
    feed_path = publish_novena_rss(
        docs_root=root,
        base_url=base_url,
        current_jobs=current_jobs,
        reset_feed=reset_feed,
        remote_feed_url=remote_feed_url,
    )
    logger.info("novena_pipeline write feed_path=%s items=%d", feed_path, len(current_jobs))
    return {
        "contracts": len(contracts),
        "active": len(active),
        "rendered": len(items),
        "audio": len(items),
        "feed_written": True,
        "feed_path": str(feed_path),
        "publish_dates": [target.isoformat() for target in target_dates],
        "items": items,
    }


def _render_title(runtime, context: Dict[str, Any]) -> str:
    from jobs.publish.formatting import render_publish_template

    pattern = str(runtime.publishing.get("rss", {}).get("episode_title_pattern", "Day {day}: Novena to {saint_name} - {theme} - {date_display}"))
    return render_publish_template(pattern, context)


def _render_description(runtime, context: Dict[str, Any]) -> str:
    from jobs.publish.formatting import render_publish_template

    pattern = str(runtime.publishing.get("rss", {}).get("episode_description_pattern", "Day {day} of the Novena to {saint_name} for {feast_name}."))
    return render_publish_template(pattern, context)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    mode = str(os.environ.get("NOVENA_PUBLISH_MODE", "daily")).strip().lower()
    anchor_today = _dt.date.today()
    if mode == "bootstrap":
        publish_dates = [anchor_today, anchor_today + _dt.timedelta(days=1)]
        reset_feed = False
    elif mode == "reset":
        publish_dates = [anchor_today, anchor_today + _dt.timedelta(days=1)]
        reset_feed = True
    elif mode == "today":
        publish_dates = [anchor_today]
        reset_feed = False
    else:
        publish_dates = [anchor_today + _dt.timedelta(days=1)]
        reset_feed = False
    result = run_novena_pipeline(
        base_url=github_pages_base_url(),
        publish_dates=publish_dates,
        reset_feed=reset_feed,
        remote_feed_url=podcast_feed_public_url(),
    )
    print(
        f"novena_pipeline mode={mode} publish_dates={','.join(result.get('publish_dates') or [])} contracts={result['contracts']} active={result['active']} rendered={result['rendered']} feed_path={result['feed_path']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
