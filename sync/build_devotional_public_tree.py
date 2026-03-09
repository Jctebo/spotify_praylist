#!/usr/bin/env python3
import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import Any, Dict, List


DEFAULT_ROOT_MANIFEST = "devotional_image_library.json"
DEFAULT_FOLDERS = ("Current Devotion", "Current Devotion Wide")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a public devotional image tree from the OneDrive-oriented source tree."
    )
    parser.add_argument("--source-root", required=True, help="Source DCIM root containing manifests and devotional folders.")
    parser.add_argument("--target-root", required=True, help="Target root to populate for public hosting.")
    parser.add_argument(
        "--root-manifest",
        default=DEFAULT_ROOT_MANIFEST,
        help=f"Root manifest filename. Default: {DEFAULT_ROOT_MANIFEST}",
    )
    parser.add_argument(
        "--folder",
        action="append",
        dest="folders",
        help="Folder name to publish. May be repeated. Defaults to current portrait + wide folders.",
    )
    return parser.parse_args()


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def copy_folder(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def main() -> int:
    try:
        args = parse_args()
        source_root = Path(args.source_root).expanduser().resolve()
        target_root = Path(args.target_root).expanduser().resolve()
        root_manifest_name = str(args.root_manifest).strip() or DEFAULT_ROOT_MANIFEST
        wanted_folders = tuple(args.folders or DEFAULT_FOLDERS)

        manifest_path = source_root / root_manifest_name
        if not manifest_path.exists():
            raise RuntimeError(f"Missing root manifest: {manifest_path}")

        root_manifest = load_json(manifest_path)
        folders: List[Dict[str, Any]] = []
        for folder in root_manifest.get("folders") or []:
            if not isinstance(folder, dict):
                continue
            folder_name = str(folder.get("folder_name", "")).strip()
            if folder_name not in wanted_folders:
                continue
            folders.append(folder)

        if target_root.exists():
            shutil.rmtree(target_root)
        target_root.mkdir(parents=True, exist_ok=True)

        total_images = 0
        for folder in folders:
            folder_name = str(folder.get("folder_name", "")).strip()
            src_dir = source_root / folder_name
            if not src_dir.exists():
                raise RuntimeError(f"Missing source folder referenced by manifest: {src_dir}")
            copy_folder(src_dir, target_root / folder_name)
            total_images += int(folder.get("item_count") or 0)

        public_manifest = dict(root_manifest)
        public_manifest["root_path"] = target_root.name
        public_manifest["folder_count"] = len(folders)
        public_manifest["image_count"] = total_images
        public_manifest["folders"] = folders
        (target_root / root_manifest_name).write_text(json.dumps(public_manifest, indent=2), encoding="utf-8")

        print(
            "SUMMARY "
            f"source_root={source_root} target_root={target_root} "
            f"folders={len(folders)} images={total_images} root_manifest={root_manifest_name}"
        )
        return 0
    except Exception as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
