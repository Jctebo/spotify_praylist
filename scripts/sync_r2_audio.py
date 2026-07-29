from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_AUDIO_DIR = ROOT / "docs" / "audio"
MANIFEST_KEY = ".audio-sync-manifest.json"
MANIFEST_VERSION = 1
DEFAULT_MAX_WORKERS = 4

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
    size: int
    sha256: str


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


def sha256_for(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_upload_plan(audio_dir: Path = DEFAULT_AUDIO_DIR, *, prefix: str = "") -> List[UploadItem]:
    root = Path(audio_dir)
    cleaned_prefix = _clean(prefix).strip("/")
    items: List[UploadItem] = []
    for path in iter_audio_files(root):
        relative_key = path.relative_to(root).as_posix()
        key = f"{cleaned_prefix}/{relative_key}" if cleaned_prefix else relative_key
        items.append(
            UploadItem(
                path=path,
                key=key,
                content_type=content_type_for(path),
                size=path.stat().st_size,
                sha256=sha256_for(path),
            )
        )
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


def _not_found(error: Exception) -> bool:
    response = getattr(error, "response", None)
    error_data = response.get("Error", {}) if isinstance(response, dict) else {}
    return str(error_data.get("Code", "")).strip() in {"404", "NoSuchKey", "NotFound"}


def _manifest_key(prefix: str) -> str:
    cleaned_prefix = _clean(prefix).strip("/")
    return f"{cleaned_prefix}/{MANIFEST_KEY}" if cleaned_prefix else MANIFEST_KEY


def load_remote_manifest(*, bucket: str, client: Any, prefix: str = "") -> Dict[str, Dict[str, Any]]:
    try:
        response = client.get_object(Bucket=bucket, Key=_manifest_key(prefix))
    except Exception as error:
        if _not_found(error):
            return {}
        raise
    try:
        payload = json.loads(response["Body"].read().decode("utf-8"))
        if payload.get("version") != MANIFEST_VERSION or not isinstance(payload.get("objects"), dict):
            return {}
        return {
            str(key): dict(value)
            for key, value in payload["objects"].items()
            if isinstance(value, dict)
        }
    except (KeyError, TypeError, UnicodeDecodeError, json.JSONDecodeError):
        return {}


def list_remote_objects(*, bucket: str, client: Any, prefix: str = "") -> Dict[str, int]:
    cleaned_prefix = _clean(prefix).strip("/")
    request: Dict[str, Any] = {"Bucket": bucket}
    if cleaned_prefix:
        request["Prefix"] = f"{cleaned_prefix}/"
    objects: Dict[str, int] = {}
    while True:
        response = client.list_objects_v2(**request)
        for item in response.get("Contents", []):
            key = _clean(item.get("Key"))
            if key:
                objects[key] = int(item.get("Size", 0))
        if not response.get("IsTruncated"):
            return objects
        token = _clean(response.get("NextContinuationToken"))
        if not token:
            raise RuntimeError("R2 listed a truncated result without a continuation token.")
        request["ContinuationToken"] = token


def delta_upload_plan(
    plan: Sequence[UploadItem],
    *,
    remote_objects: Dict[str, int],
    manifest: Dict[str, Dict[str, Any]],
) -> List[UploadItem]:
    return [
        item
        for item in plan
        if remote_objects.get(item.key) != item.size
        or manifest.get(item.key, {}).get("sha256") != item.sha256
    ]


def _upload_item(*, item: UploadItem, bucket: str, client: Any) -> None:
    client.upload_file(
        str(item.path),
        bucket,
        item.key,
        ExtraArgs={"ContentType": item.content_type, "Metadata": {"sha256": item.sha256}},
    )


def write_remote_manifest(*, plan: Sequence[UploadItem], bucket: str, client: Any, prefix: str = "") -> None:
    payload = {
        "version": MANIFEST_VERSION,
        "objects": {item.key: {"size": item.size, "sha256": item.sha256} for item in plan},
    }
    client.put_object(
        Bucket=bucket,
        Key=_manifest_key(prefix),
        Body=json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8"),
        ContentType="application/json",
    )


def sync_audio_archive(
    *,
    audio_dir: Path = DEFAULT_AUDIO_DIR,
    bucket: str,
    client: Any,
    dry_run: bool = False,
    prefix: str = "",
    max_workers: int = DEFAULT_MAX_WORKERS,
) -> int:
    plan = build_upload_plan(audio_dir, prefix=prefix)
    if max_workers < 1:
        raise ValueError("max_workers must be at least 1")
    manifest = load_remote_manifest(bucket=bucket, client=client, prefix=prefix)
    remote_objects = list_remote_objects(bucket=bucket, client=client, prefix=prefix)
    delta = delta_upload_plan(plan, remote_objects=remote_objects, manifest=manifest)
    skipped = len(plan) - len(delta)
    print(f"R2 delta sync scanned={len(plan)} upload={len(delta)} skipped={skipped}")
    for item in delta:
        print(f"{'Would upload' if dry_run else 'Uploading'} {item.path} -> s3://{bucket}/{item.key} ({item.content_type})")
    if dry_run:
        return len(delta)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(_upload_item, item=item, bucket=bucket, client=client) for item in delta]
        for future in as_completed(futures):
            future.result()
    write_remote_manifest(plan=plan, bucket=bucket, client=client, prefix=prefix)
    return len(delta)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Sync the generated docs/audio archive to Cloudflare R2.")
    parser.add_argument("--audio-dir", type=Path, default=DEFAULT_AUDIO_DIR, help="Generated audio archive directory.")
    parser.add_argument("--prefix", default="", help="Optional R2 key prefix. Leave empty for bucket-root public URLs.")
    parser.add_argument("--dry-run", action="store_true", help="Show upload plan without uploading files.")
    parser.add_argument("--max-workers", type=int, default=DEFAULT_MAX_WORKERS, help="Maximum concurrent R2 uploads.")
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
        max_workers=args.max_workers,
    )
    print(f"Synced {count} audio archive files to R2 bucket {env['R2_BUCKET']}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
