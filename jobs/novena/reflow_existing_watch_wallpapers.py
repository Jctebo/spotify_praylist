"""Safely reflow labels on the currently synced watch wallpapers."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter

from jobs.novena.devotional_image_contract import DailyImageSpec, WATCH_SIZE
from jobs.novena.devotional_wallpaper_render import overlay_wallpaper_text


DEFAULT_ROOT = Path.home() / "OneDrive" / "Pictures" / "Samsung Gallery" / "DCIM"
DEFAULT_MANIFEST_ROOT = DEFAULT_ROOT / ".devotional_wallpapers" / "manifests" / "runs"
EXPECTED_COUNT = 10
TOP_BAND_END = 410
DATE_DIR = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def discover_targets(root: Path) -> list[Path]:
    current = root / "watch-current"
    queue = root / "watch-queue"
    if not current.is_dir() or not queue.is_dir():
        raise ValueError("Expected watch-current and watch-queue directories")
    targets: list[Path] = []
    for entry in current.iterdir():
        if not entry.is_file() or entry.suffix.lower() != ".jpg" or not re.fullmatch(r"[a-z0-9-]+__\d{4}-\d{2}-\d{2}\.jpg", entry.name):
            raise ValueError(f"Unexpected entry in watch-current: {entry}")
        targets.append(entry)
    for day in queue.iterdir():
        if not day.is_dir() or not DATE_DIR.fullmatch(day.name):
            raise ValueError(f"Unexpected entry in watch-queue: {day}")
        try:
            dt.date.fromisoformat(day.name)
        except ValueError:
            raise ValueError(f"Invalid queue date directory: {day}") from None
        for entry in day.iterdir():
            if not entry.is_file() or entry.suffix.lower() != ".jpg" or not re.fullmatch(r"[a-z0-9-]+__\d{4}-\d{2}-\d{2}\.jpg", entry.name):
                raise ValueError(f"Unexpected entry in dated watch queue: {entry}")
            if not entry.name.endswith(f"__{day.name}.jpg"):
                raise ValueError(f"Filename date does not match queue directory: {entry}")
            targets.append(entry)
    targets.sort()
    if len(targets) != EXPECTED_COUNT:
        raise ValueError(f"Expected exactly {EXPECTED_COUNT} current/queue JPEGs; found {len(targets)}")
    return targets


def load_specs(manifest_root: Path, root: Path) -> dict[str, DailyImageSpec]:
    specs: dict[str, DailyImageSpec] = {}
    for path in manifest_root.glob("*.json"):
        try:
            run = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for asset in (run.get("assets") or {}).values():
            remote = asset.get("remote_path", "")
            if not (remote.startswith("watch-current/") or remote.startswith("watch-queue/")):
                continue
            if asset.get("variant") != "watch" or asset.get("state") != "delivered_verified":
                continue
            raw = asset.get("spec") or {}
            if not raw:
                continue
            spec = DailyImageSpec(
                date=dt.date.fromisoformat(raw["date"]),
                title=raw["title"],
                classification=raw["classification"],
                source_kind=raw.get("source_kind", "calendar"),
                subtitle=raw.get("subtitle", ""),
                priority=raw.get("priority", 100),
                source_uid=raw.get("source_uid", ""),
                recurrence_id=raw.get("recurrence_id", ""),
                sequence_kind=raw.get("sequence_kind", ""),
                sequence_day=raw.get("sequence_day"),
                iconography=raw.get("iconography", ""),
                monthly_fallback=raw.get("monthly_fallback", False),
            )
            relative = Path(remote)
            if ".." in relative.parts or relative.is_absolute():
                raise ValueError(f"Unsafe manifest path: {remote}")
            key = str((root / relative).resolve()).casefold()
            previous = specs.get(key)
            if previous and previous != spec:
                raise ValueError(f"Conflicting manifest metadata for {relative}")
            specs[key] = spec
            # Current is a copy of today's queued image; manifests may record only
            # its original queue path even after rotation promotes it to current.
            filename_key = f"filename:{relative.name.casefold()}"
            filename_previous = specs.get(filename_key)
            if filename_previous and filename_previous != spec:
                raise ValueError(f"Conflicting manifest metadata for filename {relative.name}")
            specs[filename_key] = spec
    return specs


def remove_old_top_labels(data: bytes) -> bytes:
    """Rebuild the dark old title-safe background, feathered at its lower edge."""
    with Image.open(io.BytesIO(data)) as source:
        source.load()
        if source.format != "JPEG" or source.size != WATCH_SIZE:
            raise ValueError("Each source must be a 1024x1024 JPEG")
        image = source.convert("RGB")
    width, height = image.size
    # Interpolate each row from the image's left/right edge colors. This preserves
    # the source's dark top background character without leaving the old lettering.
    px = image.load()
    # Keep a soft horizontal interpolation from narrow edge samples. A completely
    # uniform fill would erase the subtle original background lighting.
    edge_sample = 12
    top = Image.new("RGB", image.size)
    out = top.load()
    for y in range(TOP_BAND_END):
        left = tuple(round(sum(px[x, y][c] for x in range(edge_sample)) / edge_sample) for c in range(3))
        right = tuple(round(sum(px[width - 1 - x, y][c] for x in range(edge_sample)) / edge_sample) for c in range(3))
        for x in range(width):
            t = x / max(1, width - 1)
            out[x, y] = tuple(round(left[c] * (1 - t) + right[c] * t) for c in range(3))
    # Feather across only 22 pixels; everything below the old title band is exact.
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rectangle((0, 0, width, TOP_BAND_END - 22), fill=255)
    mask_draw = ImageDraw.Draw(mask)
    for y in range(TOP_BAND_END - 21, TOP_BAND_END + 1):
        alpha = round(255 * (TOP_BAND_END - y) / 22)
        mask_draw.line((0, y, width, y), fill=alpha)
    # Blur the boundary only, while keeping the masked top smooth and label-free.
    mask = mask.filter(ImageFilter.GaussianBlur(4))
    image.paste(top, (0, 0), mask)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def build_output(data: bytes, spec: DailyImageSpec) -> bytes:
    return overlay_wallpaper_text(remove_old_top_labels(data), spec, "watch")


def square_repaired_art(data: bytes) -> bytes:
    """Add clock-safe canvas above a text-free repaired image without scaling it."""
    with Image.open(io.BytesIO(data)) as source:
        source.load()
        if source.format not in {"JPEG", "PNG"}:
            raise ValueError("Replacement art must be a JPEG or PNG")
        image = source.convert("RGB")
    width, height = image.size
    if width == height:
        output = io.BytesIO()
        image.save(output, format="PNG")
        return output.getvalue()
    if width <= height or width - height > round(width * 0.2):
        raise ValueError("Replacement art must be a mildly landscape image for safe square padding")
    top_pad = round(width * 0.19)
    bottom_crop = top_pad - (width - height)
    if bottom_crop < 0 or bottom_crop > round(height * 0.08):
        raise ValueError("Replacement image cannot be squared without excessive crop")
    content = image.crop((0, 0, width, height - bottom_crop))
    canvas = Image.new("RGB", (width, width), (8, 13, 29))
    canvas.paste(content, (0, top_pad))
    output = io.BytesIO()
    canvas.save(output, format="PNG")
    return output.getvalue()


def _validate_output(data: bytes) -> None:
    with Image.open(io.BytesIO(data)) as image:
        image.load()
        if image.format != "JPEG" or image.size != WATCH_SIZE:
            raise ValueError("Reflow output must remain a 1024x1024 JPEG")


def migrate(
    root: Path,
    backup_dir: Path,
    manifest_root: Path,
    *,
    apply: bool = False,
    image_overrides: dict[str, Path] | None = None,
    preview_dir: Path | None = None,
) -> list[dict[str, str]]:
    targets = discover_targets(root)
    specs = load_specs(manifest_root, root)
    overrides = {key.casefold(): value for key, value in (image_overrides or {}).items()}
    target_names = {path.name.casefold() for path in targets}
    if not set(overrides).issubset(target_names):
        raise ValueError("Image override names must match discovered current/queue filenames")
    preview_root: Path | None = None
    if preview_dir is not None:
        preview_root = preview_dir.resolve()
        if root.resolve() == preview_root or root.resolve() in preview_root.parents:
            raise ValueError("Preview directory must be outside the OneDrive DCIM tree")
        if preview_root.exists() and any(preview_root.iterdir()):
            raise ValueError("Preview directory must be new or empty")
    records: list[dict[str, str]] = []
    originals: dict[Path, bytes] = {}
    outputs: dict[Path, bytes] = {}
    for path in targets:
        key = str(path.resolve()).casefold()
        spec = specs.get(key) or specs.get(f"filename:{path.name.casefold()}")
        if spec is None:
            raise ValueError(f"No verified manifest spec for {path}")
        if not path.name.endswith(f"__{spec.date.isoformat()}.jpg"):
            raise ValueError(f"Manifest date does not match image filename: {path}")
        data = path.read_bytes()
        if path.name.casefold() in overrides:
            # The original can be malformed/non-square; its exact bytes are still
            # backed up below, while a reviewed replacement source supplies art.
            with Image.open(io.BytesIO(data)) as original:
                original.load()
                if original.format != "JPEG":
                    raise ValueError(f"Original target must be JPEG: {path}")
            replacement = overrides[path.name.casefold()].read_bytes()
            repaired = square_repaired_art(replacement)
            output = overlay_wallpaper_text(repaired, spec, "watch")
        else:
            _validate_output(data)
            output = build_output(data, spec)
        originals[path] = data
        _validate_output(output)
        outputs[path] = output
        if preview_root is not None:
            relative = path.resolve().relative_to(root.resolve())
            preview_path = preview_root / relative
            preview_path.parent.mkdir(parents=True, exist_ok=True)
            preview_path.write_bytes(output)
        records.append({"path": str(path), "source_sha256": sha256(data), "output_sha256": sha256(output)})
    if not apply:
        return records

    root_resolved = root.resolve()
    backup_resolved = backup_dir.resolve()
    if backup_resolved == root_resolved or root_resolved in backup_resolved.parents:
        raise ValueError("Backup directory must be outside the OneDrive DCIM tree")
    if backup_resolved.exists() and any(backup_resolved.iterdir()):
        raise ValueError("Backup directory must be new or empty")
    backup_resolved.mkdir(parents=True, exist_ok=True)
    # All source bytes are backed up and checked before any replacement starts.
    backup_paths: dict[Path, Path] = {}
    for path, data in originals.items():
        relative = path.resolve().relative_to(root_resolved)
        saved = backup_resolved / relative
        saved.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, saved)
        if saved.read_bytes() != data:
            raise IOError(f"Backup verification failed for {path}")
        backup_paths[path] = saved

    replaced: list[Path] = []
    staged: dict[Path, Path] = {}
    try:
        for path, output in outputs.items():
            with tempfile.NamedTemporaryFile(prefix=f".{path.stem}.", suffix=".tmp", dir=path.parent, delete=False) as handle:
                handle.write(output)
                handle.flush()
                os.fsync(handle.fileno())
                staged[path] = Path(handle.name)
        for path, temp_path in staged.items():
            os.replace(temp_path, path)
            replaced.append(path)
            if path.read_bytes() != outputs[path]:
                raise IOError(f"Post-write verification failed for {path}")
    except Exception:
        for path in reversed(replaced):
            shutil.copy2(backup_paths[path], path)
        for temp_path in staged.values():
            temp_path.unlink(missing_ok=True)
        raise
    return records


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    parser.add_argument("--manifest-root", type=Path, default=DEFAULT_MANIFEST_ROOT)
    parser.add_argument("--backup-dir", type=Path)
    parser.add_argument("--preview-dir", type=Path, help="write rendered previews here without changing OneDrive")
    parser.add_argument(
        "--image-override", action="append", default=[], metavar="FILENAME=PATH",
        help="use a reviewed, text-free repaired art source for a legacy image whose title overlaps its subject",
    )
    parser.add_argument("--apply", action="store_true", help="write converted images after local backups")
    args = parser.parse_args(argv)
    if args.apply and args.backup_dir is None:
        parser.error("--apply requires --backup-dir outside the OneDrive DCIM tree")
    overrides: dict[str, Path] = {}
    for value in args.image_override:
        if "=" not in value:
            parser.error("--image-override must use FILENAME=PATH")
        name, source = value.split("=", 1)
        if not name or not source or name.casefold() in {key.casefold() for key in overrides}:
            parser.error("--image-override requires a unique filename and source path")
        overrides[name] = Path(source)
    records = migrate(
        args.root, args.backup_dir or Path(tempfile.gettempdir()) / "wallpaper-dry-run",
        args.manifest_root, apply=args.apply, image_overrides=overrides, preview_dir=args.preview_dir,
    )
    print(json.dumps({"mode": "apply" if args.apply else "dry-run", "count": len(records), "files": records}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
