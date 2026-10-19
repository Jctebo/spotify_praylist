"""Build the static GitHub Pages artifact for the daily prayer home."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from datetime import date as Date
from datetime import datetime as DateTime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.playlist.spotify_contracts import (
    SpotifyQueueContract,
    load_spotify_playlist_definitions,
    load_spotify_queue_contracts,
    normalize_spotify_queue_uri,
)
from jobs.playlist.refresh_playlist import (
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    SPOTIFY_REFRESH_TOKEN,
    load_resolver_runtime_config,
    resolve_contract_uris,
    sp_client,
)


SITE_DIR = ROOT / "config" / "site"
PODCAST_FEED = ROOT / "docs" / "podcast.xml"
PODCAST_COVER = ROOT / "docs" / "images" / "logo_ora_pro_nobis.png"
TIMEZONE = ZoneInfo("America/Chicago")


def _direct_item_url(uri: str) -> str | None:
    normalized = normalize_spotify_queue_uri(uri)
    if not normalized:
        return None
    kind, identifier = normalized.split(":")[1:]
    if kind not in {"track", "episode"}:
        return None
    return f"https://open.spotify.com/{kind}/{identifier}"


def _spotify_url(contract: SpotifyQueueContract, resolved_uris: list[str] | None = None) -> str | None:
    for uri in resolved_uris or []:
        direct_url = _direct_item_url(uri)
        if direct_url:
            return direct_url

    direct = contract.spotify_url_normal or contract.spotify_uri
    if direct:
        direct_url = _direct_item_url(direct)
        if direct_url:
            return direct_url
        if direct.startswith("https://open.spotify.com/track/") or direct.startswith("https://open.spotify.com/episode/"):
            return direct
    return None


def _resolved_item_uris(contracts: list[SpotifyQueueContract], current_date: Date) -> dict[str, list[str]]:
    credential_names = (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN)
    if not all(os.getenv(name, "").strip() for name in credential_names):
        return {}

    try:
        spotify, _ = sp_client()
    except Exception:
        print("WARN Spotify item resolution unavailable; dynamic prayer links will be omitted.", file=sys.stderr)
        return {}
    _, shows_cfg, fixed_cfg, tokens_cfg = load_resolver_runtime_config({})
    weekday = current_date.strftime("%A")
    resolved: dict[str, list[str]] = {}
    for contract in contracts:
        status: dict[str, bool] = {}
        try:
            resolved[contract.key] = resolve_contract_uris(
                spotify,
                contract,
                weekday,
                current_date,
                status,
                shows_cfg,
                fixed_cfg,
                tokens_cfg,
            )
        except Exception:
            print(f"WARN Spotify item resolution failed for '{contract.key}'; prayer link will be omitted.", file=sys.stderr)
            resolved[contract.key] = []
    return resolved


def build_prayer_data(
    *,
    playlist_dir: Path | None = None,
    contract_dir: Path | None = None,
    date: str | None = None,
    wallpaper_path: Path | None = None,
    spotify_resolved_uris: dict[str, list[str]] | None = None,
) -> dict[str, object]:
    contracts = load_spotify_queue_contracts(contract_dir)
    definitions = load_spotify_playlist_definitions(
        playlist_dir=playlist_dir,
        contract_dir=contract_dir,
        contracts=contracts,
    )
    display_order = {key: index for index, key in enumerate(("morning", "midday", "night", "sunday"))}
    definitions.sort(key=lambda definition: (display_order.get(definition.key, len(display_order)), definition.key))
    by_key = {contract.key: contract for contract in contracts}
    current_date = Date.fromisoformat(date) if date else DateTime.now(TIMEZONE).date()
    active_keys = {key for definition in definitions for key in definition.contracts}
    active_contracts = [contract for contract in contracts if contract.key in active_keys]
    resolved_uris = (
        spotify_resolved_uris
        if spotify_resolved_uris is not None
        else _resolved_item_uris(active_contracts, current_date)
    )
    groups = []
    for definition in definitions:
        prayers = [
            {
                "key": key,
                "name": by_key[key].name,
                "spotify_url": _spotify_url(by_key[key], resolved_uris.get(key)),
            }
            for key in definition.contracts
        ]
        groups.append(
            {
                "key": definition.key,
                "name": definition.name,
                "playlist_url": f"https://open.spotify.com/playlist/{definition.playlist_id}",
                "prayers": prayers,
            }
        )

    image = None
    if wallpaper_path is not None:
        source = Path(wallpaper_path)
        if not source.is_file():
            raise RuntimeError(f"Wallpaper image not found: {source}")
        suffix = source.suffix.lower()
        if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
            raise RuntimeError("Wallpaper must be a JPEG, PNG, or WebP image")
        image = f"images/daily-wallpaper{suffix}"

    return {
        "date": date or current_date.isoformat(),
        "timezone": "America/Chicago",
        "wallpaper": image,
        "groups": groups,
    }


def build_artifact(
    output_dir: Path,
    *,
    wallpaper_path: Path | None = None,
    spotify_resolved_uris: dict[str, list[str]] | None = None,
) -> dict[str, object]:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    payload = build_prayer_data(
        wallpaper_path=wallpaper_path,
        spotify_resolved_uris=spotify_resolved_uris,
    )
    wallpaper_bytes = Path(wallpaper_path).read_bytes() if wallpaper_path is not None else None

    image_dir = output_dir / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    for prior_wallpaper in image_dir.glob("daily-wallpaper.*"):
        prior_wallpaper.unlink()

    for name in ("index.html", "site.css", "site.js"):
        shutil.copy2(SITE_DIR / name, output_dir / name)
    (output_dir / "prayers.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    feed_target = output_dir / "podcast.xml"
    feed_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(PODCAST_FEED, feed_target)
    image_target = image_dir / "logo_ora_pro_nobis.png"
    shutil.copy2(PODCAST_COVER, image_target)
    if wallpaper_bytes is not None:
        (output_dir / str(payload["wallpaper"])).write_bytes(wallpaper_bytes)
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "pages_artifact")
    parser.add_argument("--wallpaper", type=Path)
    args = parser.parse_args()
    payload = build_artifact(args.output, wallpaper_path=args.wallpaper)
    print(
        f"Built Pages artifact: {len(payload['groups'])} playlists, "
        f"{sum(len(group['prayers']) for group in payload['groups'])} prayers, "
        f"wallpaper={'yes' if payload['wallpaper'] else 'no'}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
