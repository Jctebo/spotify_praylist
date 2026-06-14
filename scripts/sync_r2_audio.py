from __future__ import annotations

import argparse
import mimetypes
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_AUDIO_DIR = ROOT / "docs" / "audio"

REQUIRED_ENV = (
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_ENDPOINT",
)


@dataclass(frozen=True)
class UploadItem:
    path: Path
    key: str
    content_type: str


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _required_env(environ: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    source = environ if environ is not None else os.environ
    values = {name: _clean(source.get(name)) for name in REQUIRED_ENV}
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise RuntimeError(f"Missing required R2 environment values: {', '.join(missing)}")
    return values


def content_type_for(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".mp3":
        return "audio/mpeg"
    if suffix == ".json":
        return "application/json"
    if suffix in {".html", ".htm"}:
        return "text/html"
    guessed, _ = mimetypes.guess_type(path.name)
    return guessed or "application/octet-stream"


def iter_audio_files(audio_dir: Path) -> Iterable[Path]:
    root = Path(audio_dir)
    if not root.exists():
        raise RuntimeError(f"Audio directory does not exist: {root}")
    if not root.is_dir():
        raise RuntimeError(f"Audio path is not a directory: {root}")
    yield from sorted(path for path in root.rglob("*") if path.is_file())


def build_upload_plan(audio_dir: Path = DEFAULT_AUDIO_DIR, *, prefix: str = "") -> List[UploadItem]:
    root = Path(audio_dir)
    cleaned_prefix = _clean(prefix).strip("/")
    items: List[UploadItem] = []
    for path in iter_audio_files(root):
        relative_key = path.relative_to(root).as_posix()
        key = f"{cleaned_prefix}/{relative_key}" if cleaned_prefix else relative_key
        items.append(UploadItem(path=path, key=key, content_type=content_type_for(path)))
    if not items:
        raise RuntimeError(f"Audio directory has no files to upload: {root}")
    return items


def make_r2_client(*, access_key_id: str, secret_access_key: str, endpoint_url: str) -> Any:
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def sync_audio_archive(
    *,
    audio_dir: Path = DEFAULT_AUDIO_DIR,
    bucket: str,
    client: Any,
    dry_run: bool = False,
    prefix: str = "",
) -> int:
    plan = build_upload_plan(audio_dir, prefix=prefix)
    for item in plan:
        print(f"{'Would upload' if dry_run else 'Uploading'} {item.path} -> s3://{bucket}/{item.key} ({item.content_type})")
        if dry_run:
            continue
        client.upload_file(
            str(item.path),
            bucket,
            item.key,
            ExtraArgs={"ContentType": item.content_type},
        )
    return len(plan)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Sync the generated docs/audio archive to Cloudflare R2.")
    parser.add_argument("--audio-dir", type=Path, default=DEFAULT_AUDIO_DIR, help="Generated audio archive directory.")
    parser.add_argument("--prefix", default="", help="Optional R2 key prefix. Leave empty for bucket-root public URLs.")
    parser.add_argument("--dry-run", action="store_true", help="Show upload plan without uploading files.")
    args = parser.parse_args(argv)

    env = _required_env()
    client = make_r2_client(
        access_key_id=env["R2_ACCESS_KEY_ID"],
        secret_access_key=env["R2_SECRET_ACCESS_KEY"],
        endpoint_url=env["R2_ENDPOINT"],
    )
    count = sync_audio_archive(
        audio_dir=args.audio_dir,
        bucket=env["R2_BUCKET"],
        client=client,
        dry_run=args.dry_run,
        prefix=args.prefix,
    )
    print(f"Synced {count} audio archive files to R2 bucket {env['R2_BUCKET']}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
