"""Scoped rclone operations for the independent devotional wallpaper library."""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Callable, Iterable, Optional

from jobs.novena.devotional_image_contract import AssetKey, DailyImageSpec, build_filename, variant_folder


SAFE_ROOT_PART = re.compile(r"^[A-Za-z0-9 _().-]+$")
WALLPAPER_ROOT = ".devotional_wallpapers"


@dataclass(frozen=True)
class RemoteAsset:
    path: str
    name: str
    size: int
    date: str
    variant: str
    checksum: Optional[str] = None


@dataclass(frozen=True)
class RcloneConfig:
    remote: str
    root: str
    executable: str = "rclone"

    @classmethod
    def from_env(cls, *, executable: Optional[str] = None) -> "RcloneConfig":
        remote = os.getenv("RCLONE_REMOTE_NAME", "onedrive").strip()
        root = os.getenv("RCLONE_REMOTE_ROOT", "Pictures/Samsung Gallery/DCIM").strip().strip("/")
        if not remote or not re.fullmatch(r"[A-Za-z0-9_.-]+", remote):
            raise RuntimeError("RCLONE_REMOTE_NAME is missing or invalid")
        if not root:
            raise RuntimeError("RCLONE_REMOTE_ROOT is missing")
        parts = PurePosixPath(root).parts
        if not parts or any(p in {".", ".."} or not SAFE_ROOT_PART.fullmatch(p) for p in parts):
            raise RuntimeError("RCLONE_REMOTE_ROOT is missing or contains unsupported path characters")
        forbidden = {"Current Devotion", "Current Devotion Wide", "Non Current Devotion", "Non Current Devotion Wide"}
        if any(part in forbidden or part == "devotional_image_library.json" for part in parts):
            raise RuntimeError("Wallpaper remote root overlaps the existing infographic library")
        return cls(remote=remote, root="/".join(parts), executable=executable or os.getenv("RCLONE_EXE", "rclone"))

    def remote_path(self, *parts: str) -> str:
        allowed_roots = {"watch-current", "watch-queue", "phone-current", "phone-queue", WALLPAPER_ROOT}
        for part in parts:
            pure = PurePosixPath(part)
            if pure.is_absolute() or any(seg in {".", ".."} for seg in pure.parts):
                raise ValueError("Remote path component is unsafe")
            if any(not SAFE_ROOT_PART.fullmatch(seg) for seg in pure.parts):
                raise ValueError("Remote path component contains unsupported characters")
            if pure.parts and pure.parts[0] not in allowed_roots:
                raise ValueError(f"Wallpaper writes are not allowed under {pure.parts[0]}")
        suffix = "/".join(part.strip("/") for part in parts if part.strip("/"))
        path = "/".join(v for v in (self.root, suffix) if v)
        return f"{self.remote}:{path}"


class RcloneStore:
    def __init__(self, config: RcloneConfig, runner: Callable[..., Any] = subprocess.run) -> None:
        self.config = config
        self.runner = runner

    def run(self, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
        result = self.runner([self.config.executable, *args], capture_output=True, text=True, check=False)
        if check and result.returncode:
            detail = (result.stderr or "").strip()
            raise RuntimeError(f"rclone {args[0]} failed (exit {result.returncode}): {detail[:500]}")
        return result

    def list_files(self, folder: str, *, recursive: bool = True) -> list[dict[str, Any]]:
        remote = self.config.remote_path(folder)
        result = self.run("lsjson", remote, "--files-only", *( ["--recursive"] if recursive else []), "--hash")
        try:
            data = json.loads(result.stdout or "[]")
        except json.JSONDecodeError as exc:
            raise RuntimeError("rclone returned an invalid file listing") from exc
        if not isinstance(data, list):
            raise RuntimeError("rclone file listing must be a JSON array")
        return [item for item in data if isinstance(item, dict)]

    def mkdir(self, folder: str) -> None:
        self.run("mkdir", self.config.remote_path(folder))

    def upload(self, local_path: Path, remote_relative: str) -> None:
        if not local_path.is_file():
            raise RuntimeError(f"Staged wallpaper is missing: {local_path.name}")
        self.run("copyto", str(local_path), self.config.remote_path(remote_relative), "--immutable")

    def download_bytes(self, remote_relative: str) -> bytes:
        with tempfile.TemporaryDirectory(prefix="devotional-wallpaper-verify-") as temporary:
            local_path = Path(temporary) / "asset.jpg"
            self.run("copyto", self.config.remote_path(remote_relative), str(local_path))
            return local_path.read_bytes()

    def remove(self, remote_relative: str) -> None:
        self.run("deletefile", self.config.remote_path(remote_relative))

    def copy_remote(self, source_relative: str, target_relative: str, *, immutable: bool = False) -> None:
        args = ["copyto", self.config.remote_path(source_relative), self.config.remote_path(target_relative)]
        if immutable:
            args.append("--immutable")
        self.run(*args)

    def write_json(self, remote_relative: str, payload: dict[str, Any]) -> None:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".json", delete=False) as file:
            path = Path(file.name)
            json.dump(payload, file, indent=2, sort_keys=True)
        try:
            self.run("copyto", str(path), self.config.remote_path(remote_relative))
        finally:
            path.unlink(missing_ok=True)

    def read_json(self, remote_relative: str) -> Optional[dict[str, Any]]:
        try:
            raw = self.download_bytes(remote_relative)
        except RuntimeError as exc:
            if "directory not found" in str(exc).lower() or "object not found" in str(exc).lower() or "doesn't exist" in str(exc).lower():
                return None
            raise
        try:
            value = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise RuntimeError("Wallpaper remote state manifest is corrupt") from None
        return value if isinstance(value, dict) else None


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def asset_path(spec: DailyImageSpec, variant: str, *, state: str) -> str:
    folder = variant_folder(variant, state)
    filename = build_filename(spec, variant)
    if state == "queue":
        return f"{folder}/{spec.date.isoformat()}/{filename}"
    return f"{folder}/{filename}"


def parse_asset_listing(folder: str, records: Iterable[dict[str, Any]]) -> list[RemoteAsset]:
    if folder not in {"watch-current", "watch-queue", "phone-current", "phone-queue"}:
        raise ValueError("Inventory may only inspect the four wallpaper folders")
    variant = "watch" if folder.startswith("watch-") else "phone"
    assets: list[RemoteAsset] = []
    for record in records:
        name = str(record.get("Name", ""))
        relative = str(record.get("Path", name)).replace("\\", "/").lstrip("/")
        size = int(record.get("Size", 0) or 0)
        match = re.search(r"__(\d{4}-\d{2}-\d{2})\.(?:jpe?g|png)$", name, re.I)
        if not match:
            continue
        try:
            import datetime as dt
            date = dt.date.fromisoformat(match.group(1))
        except ValueError:
            continue
        hashes = record.get("Hashes") or {}
        sha = next((str(v) for k, v in hashes.items() if str(k).lower() == "sha256"), None) if isinstance(hashes, dict) else None
        segments = PurePosixPath(relative).parts
        if folder.endswith("-queue"):
            if len(segments) != 2 or segments[0] != date.isoformat():
                raise RuntimeError(f"Dated wallpaper in {folder} has an invalid queue path: {relative}")
        elif len(segments) != 1:
            raise RuntimeError(f"Current wallpaper must be directly in {folder}: {relative}")
        if size <= 0:
            raise RuntimeError(f"Wallpaper inventory contains an empty file: {folder}/{relative}")
        assets.append(RemoteAsset(path=f"{folder}/{relative}", name=name, size=size, date=date.isoformat(), variant=variant, checksum=sha))
    return assets


def inventory_assets(store: RcloneStore) -> list[RemoteAsset]:
    found: list[RemoteAsset] = []
    for folder in ("watch-current", "watch-queue", "phone-current", "phone-queue"):
        records = store.list_files(folder, recursive=True)
        found.extend(parse_asset_listing(folder, records))
    slots: dict[tuple[str, str], set[str]] = {}
    for asset in found:
        slots.setdefault((asset.date, asset.variant), set()).add(asset.name)
    duplicates = [key for key, names in slots.items() if len(names) > 1]
    if duplicates:
        raise RuntimeError("Wallpaper inventory has multiple files for date/variant slots: " + ", ".join(f"{d}:{v}" for d, v in duplicates))
    return found


def assets_for_date(assets: Iterable[RemoteAsset], date: str) -> dict[str, list[RemoteAsset]]:
    result: dict[str, list[RemoteAsset]] = {"phone": [], "watch": []}
    for asset in assets:
        if asset.date == date:
            result[asset.variant].append(asset)
    return result


def deliver_missing_asset(store: RcloneStore, local_path: Path, spec: DailyImageSpec, variant: str) -> str:
    target = asset_path(spec, variant, state="queue")
    store.mkdir(f"{variant}-queue/{spec.date.isoformat()}")
    existing = [
        f"{variant}-current/{build_filename(spec, variant)}",
        target,
    ]
    for path in existing:
        result = store.run("lsjson", store.config.remote_path(path), "--stat", check=False)
        if result.returncode == 0:
            remote_bytes = store.download_bytes(path)
            local_sha = sha256(local_path.read_bytes())
            if sha256(remote_bytes) != local_sha:
                raise RuntimeError(f"Refusing to overwrite conflicting existing wallpaper: {path}")
            return path
    store.upload(local_path, target)
    remote = store.download_bytes(target)
    if sha256(remote) != sha256(local_path.read_bytes()):
        raise RuntimeError(f"Uploaded wallpaper checksum mismatch: {target}")
    return target


def _current_listing(store: RcloneStore, variant: str) -> dict[str, dict[str, Any]]:
    folder = f"{variant}-current"
    result = store.list_files(folder, recursive=False)
    return {str(item.get("Name")): item for item in result if item.get("Name")}


def _copy_verify(store: RcloneStore, source: str, target: str, expected_sha: str) -> None:
    store.copy_remote(source, target, immutable=True)
    if sha256(store.download_bytes(target)) != expected_sha:
        raise RuntimeError(f"OneDrive wallpaper verification failed: {target}")


def _archive_current_pair(store: RcloneStore, date: str, managed: dict[str, dict[str, str]]) -> None:
    for variant in ("phone", "watch"):
        item = managed.get(variant)
        if not item:
            continue
        source = str(item["path"])
        expected = str(item["sha256"])
        target = f"{WALLPAPER_ROOT}/archive/{date}/{variant}/{Path(source).name}"
        store.mkdir(f"{WALLPAPER_ROOT}/archive/{date}/{variant}")
        _copy_verify(store, source, target, expected)


def rotate_current(store: RcloneStore, date: str) -> dict[str, Any]:
    """Promote a complete, verified dated pair; preserve prior state until new pair is verified."""
    import datetime as dt
    target_date = dt.date.fromisoformat(date).isoformat()
    state_path = f"{WALLPAPER_ROOT}/manifests/rotation-state.json"
    store.mkdir(f"{WALLPAPER_ROOT}/manifests")
    state = store.read_json(state_path)
    if state is None:
        state = {"schema": 1, "managed_current": {}, "rotation": None}
    if state.get("schema") != 1 or not isinstance(state.get("managed_current", {}), dict):
        raise RuntimeError("Wallpaper rotation state manifest is invalid")
    if state.get("rotation"):
        recovered = recover_rotation(store)
        state = store.read_json(state_path) or state
    else:
        recovered = None
    current_date = state.get("current_date")
    managed = state.get("managed_current") or {}
    if current_date:
        try:
            current_date = dt.date.fromisoformat(str(current_date)).isoformat()
        except ValueError:
            raise RuntimeError("Wallpaper rotation state has an invalid current date") from None
        _verify_managed_current(store, managed)
    if current_date == target_date:
        # A previous invocation may have committed state and died during cleanup.
        _cleanup_old_current(store, target_date, managed, state)
        return {"rotated": False, "current_date": target_date, "reason": "already_current", "recovered": recovered}

    if current_date and target_date < current_date:
        raise RuntimeError(f"Refusing to roll OneDrive wallpapers backwards from {current_date} to {target_date}")

    inventory = inventory_assets(store)
    pair = assets_for_date(inventory, target_date)
    selected: dict[str, RemoteAsset] = {}
    for variant in ("phone", "watch"):
        options = pair[variant]
        if len(options) != 1:
            return {
                "rotated": False,
                "current_date": current_date,
                "reason": "today_pair_incomplete_or_ambiguous",
                "missing_variants": [variant for variant in ("phone", "watch") if len(pair[variant]) != 1],
            }
        selected[variant] = options[0]
        if not options[0].path.startswith(f"{variant}-queue/") and not options[0].path.startswith(f"{variant}-current/"):
            raise RuntimeError("Rotation selected a wallpaper from an unsupported folder")
        if options[0].size <= 0:
            raise RuntimeError(f"Rotation refuses an empty {variant} wallpaper")

    actual = {variant: _current_listing(store, variant) for variant in ("phone", "watch")}
    expected_managed_names = {variant: set((managed.get(variant) or {}).get("filenames", [])) for variant in managed}
    for variant in ("phone", "watch"):
        for filename, info in actual[variant].items():
            match = re.search(r"__(\d{4}-\d{2}-\d{2})\.(?:jpe?g|png)$", filename, re.I)
            if not match or match.group(1) != current_date:
                if filename not in expected_managed_names.get(variant, set()):
                    raise RuntimeError(f"Unmanaged file in {variant}-current; refusing rotation: {filename}")
            if filename in expected_managed_names.get(variant, set()):
                recorded = (managed.get(variant) or {}).get("sha256")
                raw = store.download_bytes(f"{variant}-current/{filename}")
                if recorded and sha256(raw) != recorded:
                    raise RuntimeError(f"Managed current wallpaper checksum changed: {variant}-current/{filename}")
        unknown = set(actual[variant]) - expected_managed_names.get(variant, set())
        if unknown:
            raise RuntimeError(f"Unmanaged files in {variant}-current; refusing rotation: {', '.join(sorted(unknown))}")

    previous_date = current_date
    _archive_current_pair(store, str(previous_date or target_date), managed)
    next_managed: dict[str, dict[str, Any]] = {}
    journal = {
        "schema": 1,
        "phase": "promoting",
        "date": target_date,
        "previous_date": previous_date,
        "previous_managed": managed,
        "next": {},
    }
    for variant in ("phone", "watch"):
        asset = selected[variant]
        source_bytes = store.download_bytes(asset.path)
        checksum = sha256(source_bytes)
        current_path = f"{variant}-current/{asset.name}"
        journal["next"][variant] = {"path": current_path, "queue_path": asset.path, "sha256": checksum}
    state["rotation"] = journal
    store.write_json(state_path, state)

    for variant in ("phone", "watch"):
        record = journal["next"][variant]
        _copy_verify(store, record["queue_path"], record["path"], record["sha256"])
        next_managed[variant] = {"filenames": [Path(record["path"]).name], "path": record["path"], "sha256": record["sha256"]}

    # Publish committed intent before deleting old current files. A rerun can finish cleanup.
    committed = {
        "schema": 1,
        "current_date": target_date,
        "managed_current": next_managed,
        "rotation": {**journal, "phase": "committed"},
    }
    store.write_json(state_path, committed)
    _cleanup_old_current(store, target_date, next_managed, committed)
    for variant in ("phone", "watch"):
        store.remove(journal["next"][variant]["queue_path"])
    committed["rotation"] = None
    store.write_json(state_path, committed)
    return {"rotated": True, "current_date": target_date, "previous_date": previous_date, "recovered": recovered}


def recover_rotation(store: RcloneStore) -> dict[str, Any]:
    """Complete a journaled rotation after confirming each source/destination hash."""
    state_path = f"{WALLPAPER_ROOT}/manifests/rotation-state.json"
    state = store.read_json(state_path)
    if not state or not state.get("rotation"):
        return {"recovered": False, "reason": "no_pending_rotation"}
    journal = state["rotation"]
    if journal.get("phase") not in {"promoting", "committed"}:
        raise RuntimeError("Wallpaper rotation journal has an unknown phase")
    date = str(journal.get("date", ""))
    import datetime as dt
    dt.date.fromisoformat(date)
    previous = journal.get("previous_managed") or {}
    if not isinstance(previous, dict):
        raise RuntimeError("Wallpaper rotation journal has invalid previous state")
    _verify_managed_current(store, previous)
    next_managed: dict[str, dict[str, Any]] = {}
    for variant in ("phone", "watch"):
        record = (journal.get("next") or {}).get(variant)
        if not isinstance(record, dict):
            raise RuntimeError("Wallpaper rotation journal is incomplete")
        remote_path = str(record["path"])
        queue_path = str(record["queue_path"])
        expected = str(record["sha256"])
        if not remote_path.startswith(f"{variant}-current/") or not queue_path.startswith(f"{variant}-queue/{date}/"):
            raise RuntimeError("Wallpaper rotation journal contains an out-of-scope path")
        if not re.fullmatch(r"[a-f0-9]{64}", expected):
            raise RuntimeError("Wallpaper rotation journal contains an invalid checksum")
        try:
            current_bytes = store.download_bytes(remote_path)
        except RuntimeError:
            current_bytes = b""
        if not current_bytes or sha256(current_bytes) != expected:
            _copy_verify(store, queue_path, remote_path, expected)
        next_managed[variant] = {"filenames": [Path(remote_path).name], "path": remote_path, "sha256": expected}
    committed = {
        "schema": 1,
        "current_date": date,
        "managed_current": next_managed,
        "rotation": {**journal, "phase": "committed"},
    }
    store.write_json(state_path, committed)
    _cleanup_old_current(store, date, next_managed, committed)
    for item in (journal.get("next") or {}).values():
        queue_path = str(item.get("queue_path", ""))
        try:
            store.remove(queue_path)
        except Exception:
            pass
    committed["rotation"] = None
    store.write_json(state_path, committed)
    return {"recovered": True, "current_date": date}


def _cleanup_old_current(store: RcloneStore, target_date: str, next_managed: dict[str, Any], state: dict[str, Any]) -> None:
    rotation = state.get("rotation") or {}
    old_managed = rotation.get("previous_managed") or {}
    for variant in ("phone", "watch"):
        old = old_managed.get(variant) or {}
        old_names = set(old.get("filenames", []))
        new_names = set((next_managed.get(variant) or {}).get("filenames", []))
        for filename in sorted(old_names - new_names):
            path = f"{variant}-current/{filename}"
            listing = _current_listing(store, variant)
            if filename in listing:
                store.remove(path)


def _verify_managed_current(store: RcloneStore, managed: dict[str, Any]) -> None:
    for variant in ("phone", "watch"):
        item = managed.get(variant) or {}
        filenames = item.get("filenames") or []
        if item and (len(filenames) != 1 or item.get("path") != f"{variant}-current/{filenames[0]}"):
            raise RuntimeError("Rotation state contains an invalid managed-current path")
        if len(filenames) > 1:
            raise RuntimeError("Rotation state lists multiple managed current files for one variant")
        for filename in filenames:
            if Path(filename).name != filename:
                raise RuntimeError("Rotation state contains an unsafe current filename")
            raw = store.download_bytes(f"{variant}-current/{filename}")
            expected = item.get("sha256")
            if not re.fullmatch(r"[a-f0-9]{64}", str(expected or "")) or sha256(raw) != expected:
                raise RuntimeError(f"Managed current wallpaper checksum mismatch: {variant}-current/{filename}")
