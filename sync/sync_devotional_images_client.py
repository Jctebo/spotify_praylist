#!/usr/bin/env python3
import argparse
import hashlib
import json
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote, urljoin
from urllib.request import urlopen


DEFAULT_ROOT_MANIFEST = "devotional_image_library.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync devotional image files for clients that do not use OneDrive."
    )
    parser.add_argument("--config", help="Optional JSON config file.")
    parser.add_argument("--source-root", help="Local source root containing devotional manifests and files.")
    parser.add_argument("--source-base-url", help="HTTP base URL hosting devotional manifests and files.")
    parser.add_argument("--target-root", help="Local destination root to sync into.")
    parser.add_argument("--root-manifest", default=DEFAULT_ROOT_MANIFEST, help="Root manifest filename.")
    parser.add_argument("--include-manifests", action="store_true", help="Also sync manifest JSON files.")
    parser.add_argument("--delete-missing", action="store_true", help="Delete local files not present in manifests.")
    return parser.parse_args()


def load_json_file(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def merge_config(args: argparse.Namespace) -> Dict[str, Any]:
    config: Dict[str, Any] = {}
    if args.config:
        config = load_json_file(Path(args.config))

    merged = {
        "source_root": args.source_root or config.get("source_root", ""),
        "source_base_url": args.source_base_url or config.get("source_base_url", ""),
        "target_root": args.target_root or config.get("target_root", ""),
        "root_manifest": args.root_manifest or config.get("root_manifest", DEFAULT_ROOT_MANIFEST),
        "include_manifests": bool(args.include_manifests or config.get("include_manifests", False)),
        "delete_missing": bool(args.delete_missing or config.get("delete_missing", False)),
    }
    if bool(merged["source_root"]) == bool(merged["source_base_url"]):
        raise RuntimeError("Set exactly one of --source-root or --source-base-url.")
    if not merged["target_root"]:
        raise RuntimeError("Missing --target-root.")
    return merged


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def url_for(base_url: str, relative_path: str) -> str:
    cleaned_base = base_url.rstrip("/") + "/"
    parts = [quote(part) for part in relative_path.replace("\\", "/").split("/") if part]
    return urljoin(cleaned_base, "/".join(parts))


def read_json_from_url(url: str) -> Dict[str, Any]:
    with urlopen(url) as response:
        return json.loads(response.read().decode("utf-8"))


def load_root_manifest(config: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    manifest_name = str(config["root_manifest"]).strip() or DEFAULT_ROOT_MANIFEST
    source_root = str(config["source_root"]).strip()
    source_base_url = str(config["source_base_url"]).strip()
    if source_root:
        manifest_path = Path(source_root) / manifest_name
        return load_json_file(manifest_path), manifest_name
    manifest_url = url_for(source_base_url, manifest_name)
    return read_json_from_url(manifest_url), manifest_name


def load_folder_manifest(config: Dict[str, Any], relative_path: str) -> Dict[str, Any]:
    source_root = str(config["source_root"]).strip()
    source_base_url = str(config["source_base_url"]).strip()
    if source_root:
        return load_json_file(Path(source_root) / relative_path)
    return read_json_from_url(url_for(source_base_url, relative_path))


def collect_sync_plan(config: Dict[str, Any], root_manifest: Dict[str, Any], root_manifest_name: str) -> List[Dict[str, Any]]:
    plan: List[Dict[str, Any]] = []
    if config["include_manifests"]:
        plan.append({"relative_path": root_manifest_name, "sha256": None, "kind": "manifest"})

    for folder in root_manifest.get("folders") or []:
        if not isinstance(folder, dict):
            continue
        manifest_path = str(folder.get("manifest_path", "")).strip()
        if not manifest_path:
            continue
        if config["include_manifests"]:
            plan.append({"relative_path": manifest_path, "sha256": None, "kind": "manifest"})
        folder_manifest = load_folder_manifest(config, manifest_path)
        for item in folder_manifest.get("items") or []:
            if not isinstance(item, dict):
                continue
            for record in (item.get("files") or {}).values():
                if not isinstance(record, dict):
                    continue
                relative_path = str(record.get("relative_path", "")).strip()
                if not relative_path:
                    continue
                plan.append(
                    {
                        "relative_path": relative_path,
                        "sha256": str(record.get("sha256", "")).strip() or None,
                        "kind": "asset",
                    }
                )

    deduped: Dict[str, Dict[str, Any]] = {}
    for entry in plan:
        deduped[entry["relative_path"]] = entry
    return [deduped[key] for key in sorted(deduped.keys())]


def copy_local_file(src: Path, dst: Path, expected_sha256: Optional[str]) -> bool:
    if dst.exists() and expected_sha256 and sha256_file(dst) == expected_sha256:
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    if expected_sha256 and sha256_file(dst) != expected_sha256:
        raise RuntimeError(f"Hash mismatch after copy: {dst}")
    return True


def download_file(url: str, dst: Path, expected_sha256: Optional[str]) -> bool:
    if dst.exists() and expected_sha256 and sha256_file(dst) == expected_sha256:
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(url) as response:
        data = response.read()
    if expected_sha256:
        digest = hashlib.sha256(data).hexdigest()
        if digest != expected_sha256:
            raise RuntimeError(f"Hash mismatch for download: {url}")
    with tempfile.NamedTemporaryFile(delete=False, dir=str(dst.parent)) as handle:
        temp_path = Path(handle.name)
        handle.write(data)
    temp_path.replace(dst)
    return True


def prune_missing_files(target_root: Path, wanted_files: List[str]) -> int:
    wanted = {path.replace("\\", "/") for path in wanted_files}
    removed = 0
    for path in sorted(target_root.rglob("*"), key=lambda item: len(item.parts), reverse=True):
        if path.is_dir():
            try:
                path.rmdir()
            except OSError:
                pass
            continue
        rel = path.relative_to(target_root).as_posix()
        if rel in wanted:
            continue
        path.unlink()
        removed += 1
    return removed


def main() -> int:
    try:
        args = parse_args()
        config = merge_config(args)
        target_root = Path(config["target_root"]).expanduser().resolve()
        target_root.mkdir(parents=True, exist_ok=True)

        root_manifest, root_manifest_name = load_root_manifest(config)
        plan = collect_sync_plan(config, root_manifest, root_manifest_name)

        copied = 0
        skipped = 0
        source_root = str(config["source_root"]).strip()
        source_base_url = str(config["source_base_url"]).strip()
        for entry in plan:
            relative_path = str(entry["relative_path"])
            expected_sha256 = entry.get("sha256")
            destination = target_root / Path(relative_path)
            if source_root:
                source = Path(source_root) / Path(relative_path)
                changed = copy_local_file(source, destination, expected_sha256)
            else:
                changed = download_file(url_for(source_base_url, relative_path), destination, expected_sha256)
            if changed:
                copied += 1
                print(f"SYNC copied={relative_path}")
            else:
                skipped += 1
                print(f"SYNC skipped={relative_path}")

        removed = 0
        if config["delete_missing"]:
            removed = prune_missing_files(target_root, [str(entry["relative_path"]) for entry in plan])

        print(
            "SUMMARY "
            f"planned={len(plan)} copied={copied} skipped={skipped} removed={removed} "
            f"target_root={target_root}"
        )
        return 0
    except Exception as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
