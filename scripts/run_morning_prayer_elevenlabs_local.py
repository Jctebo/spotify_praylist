#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as _dt
import os
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.publish.audio import (
    build_audio_jobs,
    ensure_podcast_cover_art,
    github_pages_base_url,
    podcast_cover_art_public_url,
    render_audio_job,
    write_audio_archive_index,
)
from jobs.publish.contracts import load_publish_contracts
from jobs.publish.rss import build_rss_feed, write_podcast_feed

DEFAULT_CONTRACT_ID = "morning-prayer-elevenlabs"
DEFAULT_ENV_FILE = ROOT / "config" / "local" / "elevenlabs.env"
DEFAULT_DOCS_ROOT = ROOT / "artifacts" / "local" / "elevenlabs" / "docs"
DEFAULT_CACHE_ROOT = ROOT / "artifacts" / "local" / "elevenlabs" / "cache"


@lru_cache(maxsize=8)
def _load_env_file(path_text: str) -> Dict[str, str]:
    path = Path(path_text)
    if not path.exists():
        return {}
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return {}
    values: Dict[str, str] = {}
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            values[key] = value
    return values


def _apply_env_file(path: Path) -> int:
    values = _load_env_file(str(path))
    for key, value in values.items():
        if not os.getenv(key, "").strip():
            os.environ[key] = value
    return len(values)


def _parse_date(value: str) -> _dt.date:
    return _dt.date.fromisoformat(value)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Step-by-step local smoke test for the Morning Prayer ElevenLabs variant."
    )
    parser.add_argument(
        "--contract-id",
        default=DEFAULT_CONTRACT_ID,
        help="Publish contract id to render.",
    )
    parser.add_argument(
        "--contract-dir",
        default=str(ROOT / "config" / "publish" / "contracts"),
        help="Directory containing publish contracts.",
    )
    parser.add_argument(
        "--env-file",
        default=str(DEFAULT_ENV_FILE),
        help="Local env file to load before rendering.",
    )
    parser.add_argument(
        "--date",
        default="",
        help="Target date in YYYY-MM-DD format. Defaults to tomorrow.",
    )
    parser.add_argument(
        "--docs-root",
        default=str(DEFAULT_DOCS_ROOT),
        help="Where to write docs/audio and podcast.xml.",
    )
    parser.add_argument(
        "--cache-root",
        default=str(DEFAULT_CACHE_ROOT),
        help="Where to write publish audio cache files.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Load the contract and show the planned render without calling ElevenLabs.",
    )
    args = parser.parse_args()

    print("STEP 1: load local ElevenLabs environment")
    env_file = Path(args.env_file)
    if env_file.exists():
        loaded = _apply_env_file(env_file)
        print(f"Loaded {loaded} variables from {env_file}")
    else:
        print(f"No local env file found at {env_file}")

    if not args.dry_run and not os.getenv("ELEVENLABS_API_KEY", "").strip():
        raise RuntimeError(
            "Missing ELEVENLABS_API_KEY. Set it in the shell or add it to config/local/elevenlabs.env."
        )

    target_date = _parse_date(args.date) if str(args.date).strip() else _dt.date.today() + _dt.timedelta(days=1)
    docs_root = Path(args.docs_root)
    cache_root = Path(args.cache_root)

    print("STEP 2: load publish contracts")
    contracts = load_publish_contracts(Path(args.contract_dir))
    selected_contract = next((contract for contract in contracts if contract.contract_id == args.contract_id), None)
    if selected_contract is None:
        raise RuntimeError(f"Publish contract not found: {args.contract_id}")
    print(f"Selected contract: {selected_contract.contract_id}")
    if args.dry_run:
        print("STEP 3: dry-run only, skipping audio job assembly and rendering")
        print(f"Target date would be: {target_date.isoformat()}")
        print(f"Contract source: {selected_contract.source_path}")
        print("Dry run completed.")
        return 0

    print(f"STEP 3: build jobs for {target_date.isoformat()}")
    jobs = build_audio_jobs([selected_contract], target_date=target_date)
    if not jobs:
        raise RuntimeError(f"No audio jobs were built for contract '{args.contract_id}' on {target_date.isoformat()}.")
    print(f"Built {len(jobs)} job(s)")
    for job in jobs:
        print(f"- {job['episode_id']}: {job['title']}")

    print("STEP 4: render ElevenLabs audio")
    rendered_jobs = [
        render_audio_job(job, docs_root=docs_root, cache_root=cache_root)
        for job in jobs
    ]
    for rendered in rendered_jobs:
        print(f"- rendered {rendered['episode_id']} -> {rendered['audio_path']}")

    print("STEP 5: write feed and archive files")
    ensure_podcast_cover_art(docs_root=docs_root)
    feed_base_url = github_pages_base_url()
    cover_art_url = podcast_cover_art_public_url(base_url=feed_base_url)
    feed_xml = build_rss_feed(rendered_jobs, base_url=feed_base_url, cover_art_url=cover_art_url)
    feed_path = write_podcast_feed(feed_xml, docs_root / "podcast.xml")
    archive = write_audio_archive_index(docs_root=docs_root, base_url=feed_base_url)
    print(f"Wrote feed: {feed_path}")
    print(f"Wrote archive index: {archive['archive_index_path']}")
    print(f"Wrote archive manifest: {archive['archive_manifest_path']}")
    print("ElevenLabs smoke test completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
