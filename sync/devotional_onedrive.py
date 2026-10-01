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
    subject: str = ""


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

    def validate_root(self) -> None:
        remote = self.config.remote_path()
        result = self.run("lsjson", remote, "--dirs-only", check=False)
        if result.returncode:
            detail = (result.stderr or "").strip()
            raise RuntimeError(f"rclone wallpaper root check failed (exit {result.returncode}): {detail[:500]}")
        try:
            data = json.loads(result.stdout or "[]")
        except json.JSONDecodeError as exc:
            raise RuntimeError("rclone returned an invalid wallpaper root listing") from exc
        if not isinstance(data, list):
            raise RuntimeError("rclone wallpaper root listing must be a JSON array")

    def list_files(self, folder: str, *, recursive: bool = True) -> list[dict[str, Any]]:
        remote = self.config.remote_path(folder)
        result = self.run("lsjson", remote, "--files-only", *( ["--recursive"] if recursive else []), "--hash", check=False)
        if result.returncode:
            detail = (result.stderr or "").strip()
            if "directory not found" in detail.casefold():
                return []
            raise RuntimeError(f"rclone lsjson failed (exit {result.returncode}): {detail[:500]}")
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


def _is_missing_remote_error(error: RuntimeError) -> bool:
    """Recognize rclone responses that mean a remote path is absent."""
    detail = str(error).casefold()
    return any(marker in detail for marker in (
        "directory not found",
        "object not found",
        "objectnotfound",
        "itemnotfound",
        "file not found",
        "doesn't exist",
    ))


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
            if len(segments) not in (1, 2) or (len(segments) == 2 and segments[0] != date.isoformat()):
                raise RuntimeError(f"Dated wallpaper in {folder} has an invalid queue path: {relative}")
        elif len(segments) != 1:
            raise RuntimeError(f"Current wallpaper must be directly in {folder}: {relative}")
        if size <= 0:
            raise RuntimeError(f"Wallpaper inventory contains an empty file: {folder}/{relative}")
        subject = name[:match.start()].rstrip("_")
        if not subject:
            raise RuntimeError(f"Wallpaper inventory contains an empty subject: {name}")
        assets.append(RemoteAsset(path=f"{folder}/{relative}", name=name, size=size, date=date.isoformat(), variant=variant, checksum=sha, subject=subject))
    return assets


def inventory_assets(store: RcloneStore) -> list[RemoteAsset]:
    store.validate_root()
    found: list[RemoteAsset] = []
    for folder in ("watch-current", "watch-queue", "phone-current", "phone-queue"):
        records = store.list_files(folder, recursive=True)
        found.extend(parse_asset_listing(folder, records))
    slots: dict[tuple[str, str, str], set[str]] = {}
    for asset in found:
        slots.setdefault((asset.date, asset.variant, asset.subject), set()).add(asset.name)
    duplicates = [key for key, names in slots.items() if len(names) > 1]
    if duplicates:
        raise RuntimeError("Wallpaper inventory has duplicate subject files for date/variant slots: " + ", ".join(f"{d}:{v}:{s}" for d, v, s in duplicates))
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


def _canonical_rotation_subject(subject: str) -> str:
    """Normalize legacy saint-title suffixes for replacement matching only."""
    for suffix in ("-martyrs", "-martyr"):
        if subject.endswith(suffix) and len(subject) > len(suffix):
            return subject[:-len(suffix)]
    return subject


def _prefer_queued_subjects(
    assets: list[RemoteAsset], queued_subjects: set[str]
) -> list[RemoteAsset]:
    """Drop an old current filename alias when its canonical queued subject replaces it."""
    queued_canonicals = {_canonical_rotation_subject(subject) for subject in queued_subjects}
    return [
        asset
        for asset in assets
        if not (
            asset.path.split("/", 1)[0].endswith("-current")
            and asset.subject not in queued_subjects
            and _canonical_rotation_subject(asset.subject) in queued_canonicals
        )
    ]

def _managed_files(item: dict[str, Any]) -> list[dict[str, str]]:
    files = item.get("files")
    if isinstance(files, list):
        return [dict(record) for record in files if isinstance(record, dict)]
    # Accept manifests written by the original one-file-per-device rotator.
    filenames = item.get("filenames") or ([Path(item["path"]).name] if item.get("path") else [])
    return [{"filename": str(name), "sha256": str(item.get("sha256") or "")} for name in filenames]


def _archive_current_pair(store: RcloneStore, date: str, managed: dict[str, dict[str, Any]]) -> None:
    for variant in ("phone", "watch"):
        item = managed.get(variant)
        if not item:
            continue
        for record in _managed_files(item):
            filename = record["filename"]
            source = f"{variant}-current/{filename}"
            target = f"{WALLPAPER_ROOT}/archive/{date}/{variant}/{filename}"
            try:
                current = store.download_bytes(source)
            except RuntimeError as exc:
                if not _is_missing_remote_error(exc):
                    raise
                current = b""
            if not current:
                try:
                    archived = store.download_bytes(target)
                except RuntimeError as exc:
                    if not _is_missing_remote_error(exc):
                        raise
                    # Both copies are already absent; stale manifest state must not
                    # block promotion of a complete set for the target date.
                    continue
                continue
            current_sha = sha256(current)
            try:
                archived = store.download_bytes(target)
            except RuntimeError as exc:
                if not _is_missing_remote_error(exc):
                    raise
            else:
                if sha256(archived) != current_sha:
                    raise RuntimeError(f"Existing wallpaper archive conflicts with current file: {target}")
                continue
            store.mkdir(f"{WALLPAPER_ROOT}/archive/{date}/{variant}")
            _copy_verify(store, source, target, current_sha)


def _promote_verified(store: RcloneStore, record: dict[str, str], previous_item: dict[str, Any]) -> None:
    remote_path = str(record["path"])
    queue_path = str(record["queue_path"])
    expected = str(record["sha256"])
    try:
        current = store.download_bytes(remote_path)
    except RuntimeError:
        current = b""
    if current and sha256(current) == expected:
        return
    if current:
        filename = Path(remote_path).name
        prior = next((entry for entry in _managed_files(previous_item) if entry["filename"] == filename), None)
        if prior is None or sha256(current) != prior.get("sha256"):
            raise RuntimeError(f"Refusing to replace unmanaged or changed current wallpaper: {remote_path}")
        store.remove(remote_path)
    _copy_verify(store, queue_path, remote_path, expected)


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
    missing_previous_files: list[str] = []
    if current_date:
        try:
            current_date = dt.date.fromisoformat(str(current_date)).isoformat()
        except ValueError:
            raise RuntimeError("Wallpaper rotation state has an invalid current date") from None
        missing_previous_files = _verify_managed_current(store, managed, current_date)
    if current_date and target_date < current_date:
        raise RuntimeError(f"Refusing to roll OneDrive wallpapers backwards from {current_date} to {target_date}")

    inventory = inventory_assets(store)
    pair = assets_for_date(inventory, target_date)
    current_subjects = {variant: {asset.subject for asset in pair[variant] if asset.path.startswith(f"{variant}-current/")} for variant in ("phone", "watch")}
    queue_subjects = {variant: {asset.subject for asset in pair[variant] if asset.path.startswith(f"{variant}-queue/")} for variant in ("phone", "watch")}
    if current_date == target_date:
        if not queue_subjects["phone"] and not queue_subjects["watch"] and current_subjects["phone"] == current_subjects["watch"]:
            _cleanup_old_current(store, target_date, managed, state)
            return {"rotated": False, "current_date": target_date, "reason": "already_current", "recovered": recovered, "missing_previous_files": missing_previous_files}
    if current_date is None:
        queue_assets = {variant: [asset for asset in pair[variant] if asset.path.startswith(f"{variant}-queue/")] for variant in ("phone", "watch")}
        if not queue_assets["phone"] or {a.subject for a in queue_assets["phone"]} != {a.subject for a in queue_assets["watch"]}:
            return {"rotated": False, "current_date": None, "reason": "today_subject_sets_incomplete", "missing_previous_files": missing_previous_files}
        selected_assets = queue_assets
    else:
        selected_assets = {variant: list(pair[variant]) for variant in ("phone", "watch")}
    selected: dict[str, list[RemoteAsset]] = {}
    subject_sets: dict[str, set[str]] = {}
    for variant in ("phone", "watch"):
        options = selected_assets[variant]
        selected[variant] = _prefer_queued_subjects(list(options), queue_subjects[variant])
        subject_sets[variant] = {asset.subject for asset in selected[variant]}
        for asset in options:
            if not asset.path.startswith(f"{variant}-queue/") and not asset.path.startswith(f"{variant}-current/"):
                raise RuntimeError("Rotation selected a wallpaper from an unsupported folder")
            if asset.size <= 0:
                raise RuntimeError(f"Rotation refuses an empty {variant} wallpaper")
    combined_sets = {variant: subject_sets[variant] | queue_subjects[variant] for variant in ("phone", "watch")}
    if not combined_sets["phone"] or combined_sets["phone"] != combined_sets["watch"]:
        return {"rotated": False, "current_date": current_date, "reason": "today_subject_sets_incomplete", "phone_subjects": sorted(subject_sets["phone"]), "watch_subjects": sorted(subject_sets["watch"]), "missing_previous_files": missing_previous_files}
    if current_date != target_date and current_date is not None and (subject_sets["phone"] != subject_sets["watch"] or queue_subjects["phone"] != queue_subjects["watch"]):
        return {"rotated": False, "current_date": current_date, "reason": "today_subject_sets_incomplete", "phone_subjects": sorted(subject_sets["phone"]), "watch_subjects": sorted(subject_sets["watch"]), "missing_previous_files": missing_previous_files}

    actual = {variant: _current_listing(store, variant) for variant in ("phone", "watch")}
    expected_managed_names = {variant: {record["filename"] for record in _managed_files(managed.get(variant) or {})} for variant in ("phone", "watch")}
    for variant in ("phone", "watch"):
        for filename, info in actual[variant].items():
            match = re.search(r"__(\d{4}-\d{2}-\d{2})\.(?:jpe?g|png)$", filename, re.I)
            if not match or match.group(1) != current_date:
                if filename not in expected_managed_names.get(variant, set()):
                    raise RuntimeError(f"Unmanaged file in {variant}-current; refusing rotation: {filename}")
        unknown = set(actual[variant]) - expected_managed_names.get(variant, set())
        if unknown:
            raise RuntimeError(f"Unmanaged files in {variant}-current; refusing rotation: {', '.join(sorted(unknown))}")

    previous_date = current_date
    _archive_current_pair(store, str(previous_date or target_date), managed)
    next_managed: dict[str, dict[str, Any]] = {}
    next_by_variant = {v: [] for v in ("phone", "watch")}
    journal = {
        "schema": 1,
        "phase": "promoting",
        "date": target_date,
        "previous_date": previous_date,
        "previous_managed": managed,
        "next": next_by_variant,
    }
    for variant in ("phone", "watch"):
        records = []
        for asset in selected[variant]:
            if current_date == target_date and asset.path.startswith(f"{variant}-current/") and asset.subject not in queue_subjects[variant]:
                records.append({"path": asset.path, "queue_path": asset.path, "sha256": sha256(store.download_bytes(asset.path)), "subject": asset.subject, "already_current": True})
                continue
            data = store.download_bytes(asset.path)
            records.append({"path": f"{variant}-current/{asset.name}", "queue_path": asset.path, "sha256": sha256(data), "subject": asset.subject})
        journal["next"][variant] = records
    state["rotation"] = journal
    store.write_json(state_path, state)

    for variant in ("phone", "watch"):
        files = []
        for record in journal["next"][variant]:
            if not record.get("already_current"):
                _promote_verified(store, record, managed.get(variant) or {})
            files.append({"filename": Path(record["path"]).name, "sha256": record["sha256"]})
        next_managed[variant] = {"files": files, "filenames": [item["filename"] for item in files]}

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
        for record in journal["next"][variant]:
            if record["queue_path"].startswith(f"{variant}-queue/{target_date}/"):
                store.remove(record["queue_path"])
    committed["rotation"] = None
    store.write_json(state_path, committed)
    return {"rotated": True, "current_date": target_date, "previous_date": previous_date, "recovered": recovered, "missing_previous_files": missing_previous_files}


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
    next_managed: dict[str, dict[str, Any]] = {}
    for variant in ("phone", "watch"):
        records = (journal.get("next") or {}).get(variant)
        if isinstance(records, dict):
            # Recover a single-pair journal written by the original rotator.
            records = [records]
        if not isinstance(records, list) or not records:
            raise RuntimeError("Wallpaper rotation journal is incomplete")
        files = []
        for record in records:
            if not isinstance(record, dict):
                raise RuntimeError("Wallpaper rotation journal is incomplete")
            remote_path = str(record["path"])
            queue_path = str(record["queue_path"])
            expected = str(record["sha256"])
            already_current = bool(record.get("already_current"))
            if not remote_path.startswith(f"{variant}-current/") or (not already_current and not queue_path.startswith(f"{variant}-queue/{date}/")) or (already_current and queue_path != remote_path):
                raise RuntimeError("Wallpaper rotation journal contains an out-of-scope path")
            if not re.fullmatch(r"[a-f0-9]{64}", expected):
                raise RuntimeError("Wallpaper rotation journal contains an invalid checksum")
            try:
                source_bytes = store.download_bytes(queue_path)
            except RuntimeError as exc:
                if not _is_missing_remote_error(exc):
                    raise
                source_bytes = b""
            if record.get("already_current"):
                source_bytes = store.download_bytes(remote_path)
            if source_bytes and sha256(source_bytes) != expected:
                raise RuntimeError(f"Wallpaper rotation source checksum mismatch: {queue_path}")
            if not record.get("already_current"):
                _promote_verified(store, record, previous.get(variant) or {})
            files.append({"filename": Path(remote_path).name, "sha256": expected})
        next_managed[variant] = {"files": files, "filenames": [item["filename"] for item in files]}
    committed = {
        "schema": 1,
        "current_date": date,
        "managed_current": next_managed,
        "rotation": {**journal, "phase": "committed"},
    }
    store.write_json(state_path, committed)
    _cleanup_old_current(store, date, next_managed, committed)
    for records in (journal.get("next") or {}).values():
        if isinstance(records, dict):
            records = [records]
        for item in records:
            queue_path = str(item.get("queue_path", ""))
            if queue_path != str(item.get("path", "")):
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
        old_names = {record["filename"] for record in _managed_files(old)}
        new_names = {record["filename"] for record in _managed_files(next_managed.get(variant) or {})}
        for filename in sorted(old_names - new_names):
            path = f"{variant}-current/{filename}"
            listing = _current_listing(store, variant)
            if filename in listing:
                store.remove(path)


def _verify_managed_current(
    store: RcloneStore,
    managed: dict[str, Any],
    archive_date: Optional[str] = None,
) -> list[str]:
    missing: list[str] = []
    for variant in ("phone", "watch"):
        item = managed.get(variant) or {}
        filenames = item.get("filenames") or []
        if item and item.get("path") and (len(filenames) != 1 or item.get("path") != f"{variant}-current/{filenames[0]}"):
            raise RuntimeError("Rotation state contains an invalid managed-current path")
        for record in _managed_files(item):
            filename = record["filename"]
            if Path(filename).name != filename:
                raise RuntimeError("Rotation state contains an unsafe current filename")
            current_path = f"{variant}-current/{filename}"
            try:
                store.download_bytes(current_path)
            except RuntimeError as exc:
                if not _is_missing_remote_error(exc):
                    raise
                archived = None
                if archive_date:
                    archive_path = f"{WALLPAPER_ROOT}/archive/{archive_date}/{variant}/{filename}"
                    try:
                        archived = store.download_bytes(archive_path)
                    except RuntimeError as archive_exc:
                        if not _is_missing_remote_error(archive_exc):
                            raise
                if archived is None:
                    missing.append(current_path)
                continue
    return missing
