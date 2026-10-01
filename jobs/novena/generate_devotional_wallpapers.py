"""Daily, missing-only devotional wallpaper generation and OneDrive rotation."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Any, Optional

from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.novena.devotional_calendar import CalendarResolution, fetch_calendar, resolve_calendar  # noqa: E402
from jobs.novena.devotional_image_contract import (  # noqa: E402
    CHICAGO,
    WINDOW_DAYS,
    DailyImageSpec,
    build_filename,
    build_window,
    local_today,
    monthly_variation,
)
from jobs.novena.devotional_wallpaper_render import render_variant  # noqa: E402
from sync.devotional_onedrive import (  # noqa: E402
    WALLPAPER_ROOT,
    RcloneConfig,
    RcloneStore,
    assets_for_date,
    deliver_missing_asset,
    inventory_assets,
    rotate_current,
    sha256,
)


DEFAULT_ARTIFACT_DIR = ROOT / "artifacts" / "devotional-wallpapers"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-date", help="Chicago-local YYYY-MM-DD; this date plus the next nine dates are checked")
    parser.add_argument("--resolve-only", action="store_true", help="Read calendar and OneDrive inventory without model or write calls")
    parser.add_argument("--skip-delivery", action="store_true", help="Render missing assets into a local artifact directory only")
    parser.add_argument("--rotate-only", action="store_true", help="Rotate today's OneDrive folders without fetching the calendar or calling a model")
    parser.add_argument("--dry-run-rotation", action="store_true", help="Report today's rotation readiness without changing OneDrive")
    parser.add_argument("--resume-run", help="Resume a run identifier saved in the private OneDrive manifest area")
    parser.add_argument("--artifact-dir", type=Path, default=DEFAULT_ARTIFACT_DIR)
    parser.add_argument("--rclone-exe", help="Optional path to the existing rclone executable")
    parser.add_argument("--tesseract-cmd", help="Optional Tesseract executable path; defaults to PATH")
    return parser


def _write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, suffix=".tmp", delete=False) as output:
        temporary = Path(output.name)
        json.dump(payload, output, indent=2, sort_keys=True, ensure_ascii=False)
        output.write("\n")
    temporary.replace(path)


def _spec_dict(spec: DailyImageSpec) -> dict[str, Any]:
    return {
        "date": spec.date.isoformat(),
        "title": spec.title,
        "classification": spec.classification,
        "source_kind": spec.source_kind,
        "subtitle": spec.subtitle,
        "priority": spec.priority,
        "source_uid": spec.source_uid,
        "recurrence_id": spec.recurrence_id,
        "sequence_kind": spec.sequence_kind,
        "sequence_day": spec.sequence_day,
        "iconography": spec.iconography,
        "monthly_fallback": spec.monthly_fallback,
    }


def _resolution_report(start_date: dt.date, dates: list[dt.date], resolution: CalendarResolution) -> dict[str, Any]:
    return {
        "schema": 1,
        "status": "resolved",
        "run_date": start_date.isoformat(),
        "window": [date.isoformat() for date in dates],
        "feed_checksum": resolution.feed_checksum,
        "covered_through": resolution.covered_through.isoformat() if resolution.covered_through else None,
        "specs": [_spec_dict(spec) for specs in resolution.specs.values() for spec in specs],
        "missing_dates": [date.isoformat() for date in resolution.missing_dates],
        "unclassified_events_skipped": [
            {"date": event.date.isoformat(), "summary": event.summary}
            for event in resolution.unclassified_events
        ],
    }


def _write_resolution_report(args: argparse.Namespace, start_date: dt.date, dates: list[dt.date], resolution: CalendarResolution) -> None:
    _write_json_atomic(args.artifact_dir / "resolve-report.json", _resolution_report(start_date, dates, resolution))


def _run_id(start: dt.date, end: dt.date, feed_checksum: str) -> str:
    raw = f"{start.isoformat()}:{end.isoformat()}:{feed_checksum}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:20]


def _provider():
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        raise RuntimeError("OPENAI_API_KEY is required when an image must be rendered")
    from openai import OpenAI, Timeout

    return OpenAI(
        api_key=key,
        base_url=os.getenv("OAI_API_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
        timeout=Timeout(300.0, connect=15.0),
        max_retries=0,
    )


def _transient_provider_error(exc: Exception) -> bool:
    try:
        from openai import APIConnectionError, APITimeoutError, RateLimitError, InternalServerError
        if isinstance(exc, (APIConnectionError, APITimeoutError, RateLimitError, InternalServerError)):
            return True
        from openai import APIStatusError
        return isinstance(exc, APIStatusError) and exc.status_code in {408, 409, 429, 500, 502, 503, 504}
    except ImportError:
        return False


def _load_remote_state(store: RcloneStore, run_id: str) -> dict[str, Any]:
    path = f"{WALLPAPER_ROOT}/manifests/runs/{run_id}.json"
    state = store.read_json(path)
    if state is None:
        return {"schema": 1, "run_id": run_id, "assets": {}, "updated_at": ""}
    if state.get("schema") != 1 or state.get("run_id") != run_id or not isinstance(state.get("assets", {}), dict):
        raise RuntimeError("Wallpaper resume manifest has an invalid schema or identity")
    return state


def _persist_remote_state(store: RcloneStore, state: dict[str, Any]) -> None:
    state["updated_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
    run_id = str(state["run_id"])
    store.mkdir(f"{WALLPAPER_ROOT}/manifests/runs")
    store.write_json(f"{WALLPAPER_ROOT}/manifests/runs/{run_id}.json", state)


def _key(date: dt.date, spec: DailyImageSpec, variant: str) -> str:
    from jobs.novena.devotional_image_contract import slugify
    return f"{date.isoformat()}:{slugify(spec.title)}:{variant}"


def _slot_paths(artifact_dir: Path, spec: DailyImageSpec, variant: str) -> tuple[Path, Path]:
    relative = Path(variant) / spec.date.isoformat() / build_filename(spec, variant)
    return artifact_dir / relative, artifact_dir / ".staging" / relative


def _run_local_only(args: argparse.Namespace, start_date: dt.date, dates: list[dt.date]) -> int:
    calendar_url = os.getenv("DEVOTIONAL_ICS_URL", "").strip()
    snapshot = fetch_calendar(calendar_url)
    resolution = resolve_calendar(snapshot.body, dates)
    args.artifact_dir.mkdir(parents=True, exist_ok=True)
    _write_resolution_report(args, start_date, dates, resolution)
    if args.resolve_only:
        report = _resolution_report(start_date, dates, resolution)
        report["delivery"] = "disabled"
        _write_json_atomic(args.artifact_dir / "resolve-report.json", report)
        print(json.dumps({"status": "resolved", "dates": len(resolution.specs), "missing_dates": len(resolution.missing_dates),
                          "unclassified_events_skipped": len(resolution.unclassified_events)}))
        return 0
    client = _provider()
    image_model = os.getenv("DEVOTIONAL_WALLPAPER_IMAGE_MODEL", "gpt-image-2")
    caller_model = os.getenv("DEVOTIONAL_WALLPAPER_CALLER_MODEL", "gpt-5-mini")
    qa_model = os.getenv("DEVOTIONAL_WALLPAPER_QA_MODEL", "gpt-5-mini")
    rendered = 0
    client = None
    for specs in resolution.specs.values():
        for spec in specs:
            for variant in ("phone", "watch"):
                final_path, _staged_path = _slot_paths(args.artifact_dir, spec, variant)
                if final_path.exists():
                    continue
                if client is None:
                    client = _provider()
                image_bytes, qa = render_variant(
                    client,
                    spec,
                    variant,
                    caller_model=caller_model,
                    image_model=image_model,
                    qa_model=qa_model,
                    tesseract_cmd=args.tesseract_cmd,
                    variation=monthly_variation(spec.date) if spec.monthly_fallback else "",
                    rejected_path=args.artifact_dir / ".rejected" / variant / spec.date.isoformat() / build_filename(spec, variant),
                )
                final_path.parent.mkdir(parents=True, exist_ok=True)
                final_path.write_bytes(image_bytes)
                _write_json_atomic(final_path.with_suffix(".qa.json"), qa)
                rendered += 1
    print(json.dumps({"status": "rendered_local", "rendered": rendered, "artifact_dir": str(args.artifact_dir)}))
    return 0


def run_pipeline(args: argparse.Namespace) -> int:
    actual_today = local_today()
    start_date = dt.date.fromisoformat(args.run_date) if args.run_date else actual_today
    dates = build_window(start_date, WINDOW_DAYS)
    if args.skip_delivery:
        return _run_local_only(args, start_date, dates)

    if args.resolve_only:
        snapshot = fetch_calendar(os.getenv("DEVOTIONAL_ICS_URL", "").strip())
        resolution = resolve_calendar(snapshot.body, dates)
        args.artifact_dir.mkdir(parents=True, exist_ok=True)
        _write_resolution_report(args, start_date, dates, resolution)
        inventory = inventory_assets(RcloneStore(RcloneConfig.from_env(executable=args.rclone_exe)))
        date_variants = {d.isoformat(): assets_for_date(inventory, d.isoformat()) for d in dates}
        missing_slots = []
        for date, specs in resolution.specs.items():
            for spec in specs:
                subject = build_filename(spec, "phone").split("__", 1)[0]
                for variant in ("phone", "watch"):
                    if not any(asset.subject == subject for asset in date_variants[date.isoformat()][variant]):
                        missing_slots.append(_key(date, spec, variant))
        print(json.dumps({
            "status": "resolved",
            "window_start": start_date.isoformat(),
            "window_end": dates[-1].isoformat(),
            "missing_slots": len(missing_slots),
            "missing_asset_keys": missing_slots,
            "specs": [_spec_dict(spec) for specs in resolution.specs.values() for spec in specs],
            "calendar_absent_dates_skipped": [d.isoformat() for d in resolution.missing_dates],
            "calendar_unclassified_events_skipped": [
                {"date": event.date.isoformat(), "summary": event.summary}
                for event in resolution.unclassified_events
            ],
        }, ensure_ascii=False))
        return 0

    config = RcloneConfig.from_env(executable=args.rclone_exe)
    store = RcloneStore(config)
    if args.dry_run_rotation:
        inventory = inventory_assets(store)
        pair = assets_for_date(inventory, actual_today.isoformat())
        subjects = {v: {a.subject for a in pair[v]} for v in ("phone", "watch")}
        ready = bool(subjects["phone"]) and subjects["phone"] == subjects["watch"]
        print(json.dumps({"status": "dry_run", "rotation_date": actual_today.isoformat(), "ready": ready,
                          "phone_subjects": sorted(subjects["phone"]), "watch_subjects": sorted(subjects["watch"])}))
        return 0
    if args.rotate_only:
        rotation = rotate_current(store, actual_today.isoformat())
        print(json.dumps({"status": "rotation_only", **rotation}))
        return 0

    inventory = inventory_assets(store)
    date_variants = {d.isoformat(): assets_for_date(inventory, d.isoformat()) for d in dates}
    snapshot = fetch_calendar(os.getenv("DEVOTIONAL_ICS_URL", "").strip())
    resolution = resolve_calendar(snapshot.body, dates)
    args.artifact_dir.mkdir(parents=True, exist_ok=True)
    _write_resolution_report(args, start_date, dates, resolution)
    rotation = rotate_current(store, actual_today.isoformat())
    missing_slots: list[tuple[dt.date, DailyImageSpec, str]] = []
    for date, specs in resolution.specs.items():
        for spec in specs:
            subject = build_filename(spec, "phone").split("__", 1)[0]
            for variant in ("phone", "watch"):
                if not any(asset.subject == subject for asset in date_variants[date.isoformat()][variant]):
                    missing_slots.append((date, spec, variant))
    manifest: dict[str, Any] = {
        "schema": 1,
        "run_date": actual_today.isoformat(),
        "window_start": start_date.isoformat(),
        "window_end": dates[-1].isoformat(),
        "rotation": rotation,
        "existing": sum(len(date_variants[d.isoformat()][v]) for d in dates for v in ("phone", "watch")),
        "missing_dates": sorted({date.isoformat() for date, _spec, _variant in missing_slots}),
        "missing_asset_keys": [_key(date, spec, variant) for date, spec, variant in missing_slots],
        "calendar_unclassified_events_skipped": [
            {"date": event.date.isoformat(), "summary": event.summary}
            for event in resolution.unclassified_events
        ],
        "assets": {},
    }
    if not missing_slots:
        final_rotation = rotate_current(store, actual_today.isoformat())
        report = _resolution_report(start_date, dates, resolution)
        report["status"] = "complete_no_generation_needed"
        report["rotation"] = final_rotation
        report["finished_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
        _write_json_atomic(args.artifact_dir / "resolve-report.json", report)
        print(json.dumps({"status": "complete_no_generation_needed", **{k: manifest[k] for k in ("run_date", "window_start", "window_end", "existing")}, "rotation": final_rotation}))
        return 0

    if args.resume_run:
        if not re.fullmatch(r"[a-f0-9]{20}", args.resume_run):
            raise RuntimeError("--resume-run must be a 20-character hexadecimal run id")
        run_id = args.resume_run
    else:
        run_id = _run_id(start_date, dates[-1], resolution.feed_checksum)
    remote_state = _load_remote_state(store, run_id)
    if remote_state.get("run_id") != run_id:
        raise RuntimeError("Wallpaper resume manifest run id does not match its path")
    if remote_state.get("feed_checksum") and remote_state["feed_checksum"] != resolution.feed_checksum:
        raise RuntimeError("Calendar feed changed since this run was staged; resume via a new run to preserve accepted art")
    if remote_state.get("window_start") and remote_state["window_start"] != start_date.isoformat():
        raise RuntimeError("Wallpaper resume manifest window does not match the requested window")
    remote_state.update({"feed_checksum": resolution.feed_checksum, "window_start": start_date.isoformat(), "window_end": dates[-1].isoformat()})
    manifest["run_id"] = run_id
    manifest["feed_checksum"] = resolution.feed_checksum
    manifest["covered_through"] = resolution.covered_through.isoformat() if resolution.covered_through else None
    manifest["missing_dates_without_calendar_events"] = [d.isoformat() for d in resolution.missing_dates]
    expected_dates = resolution.specs
    manifest["calendar_absent_dates_skipped"] = [d.isoformat() for d in resolution.missing_dates]
    manifest["calendar_unclassified_events_skipped"] = [
        {"date": event.date.isoformat(), "summary": event.summary}
        for event in resolution.unclassified_events
    ]
    manifest["missing_dates"] = [d.isoformat() for d in sorted({d for d, _spec, _variant in missing_slots})]
    client = None
    for missing_date, spec, variant in missing_slots:
        slot = _key(missing_date, spec, variant)
        local_path, stage_path = _slot_paths(args.artifact_dir, spec, variant)
        remote_stage = f"{WALLPAPER_ROOT}/staging/{missing_date.isoformat()}/{variant}/{build_filename(spec, variant)}"
        staged_record = remote_state.get("assets", {}).get(slot, {})
        if staged_record.get("state") in {"qa_passed", "staged"}:
            if staged_record.get("spec") != _spec_dict(spec):
                raise RuntimeError(f"Accepted staged wallpaper belongs to a different calendar subject: {slot}")
            staged_bytes = store.download_bytes(staged_record.get("staging_path", remote_stage))
            if sha256(staged_bytes) != staged_record.get("sha256"):
                raise RuntimeError(f"Accepted staged asset checksum mismatch: {slot}")
            local_path.parent.mkdir(parents=True, exist_ok=True)
            local_path.write_bytes(staged_bytes)
            qa = staged_record.get("qa", {})
        else:
            if client is None:
                client = _provider()
            last_error: Optional[Exception] = None
            for attempt in range(3):
                try:
                    image_bytes, qa = render_variant(
                        client,
                        spec,
                        variant,
                        caller_model=os.getenv("DEVOTIONAL_WALLPAPER_CALLER_MODEL", "gpt-5-mini"),
                        image_model=os.getenv("DEVOTIONAL_WALLPAPER_IMAGE_MODEL", "gpt-image-2"),
                        qa_model=os.getenv("DEVOTIONAL_WALLPAPER_QA_MODEL", "gpt-5-mini"),
                        tesseract_cmd=args.tesseract_cmd,
                        variation=monthly_variation(spec.date) if spec.monthly_fallback else "",
                        rejected_path=args.artifact_dir / ".rejected" / variant / spec.date.isoformat() / build_filename(spec, variant),
                    )
                    break
                except Exception as exc:
                    last_error = exc
                    if attempt == 2 or not _transient_provider_error(exc):
                        raise
                    import time
                    time.sleep(5 * (2 ** attempt))
            else:
                raise RuntimeError(f"Wallpaper render failed: {last_error}")
            local_path.parent.mkdir(parents=True, exist_ok=True)
            local_path.write_bytes(image_bytes)
            stage_path.parent.mkdir(parents=True, exist_ok=True)
            stage_path.write_bytes(image_bytes)
            store.mkdir(f"{WALLPAPER_ROOT}/staging/{missing_date.isoformat()}/{variant}")
            store.upload(stage_path, remote_stage)
            if sha256(store.download_bytes(remote_stage)) != sha256(image_bytes):
                raise RuntimeError(f"Private staged wallpaper checksum mismatch: {slot}")
            staged_record = {
                "state": "staged",
                "spec": _spec_dict(spec),
                "sha256": sha256(image_bytes),
                "staging_path": remote_stage,
                "qa": qa,
            }
            remote_state.setdefault("assets", {})[slot] = staged_record
            _persist_remote_state(store, remote_state)
        target = deliver_missing_asset(store, local_path, spec, variant)
        record = {
            "state": "delivered_verified",
            "spec": _spec_dict(spec),
            "filename": build_filename(spec, variant),
            "variant": variant,
            "remote_path": target,
            "sha256": sha256(local_path.read_bytes()),
            "qa": qa,
        }
        manifest["assets"][slot] = record
        remote_state.setdefault("assets", {})[slot] = {**record, "staging_path": remote_stage}
        _persist_remote_state(store, remote_state)

    # A newly completed today pair gets promoted in this run; future pairs remain queued.
    final_rotation = rotate_current(store, actual_today.isoformat())
    manifest["final_rotation"] = final_rotation
    manifest["finished_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
    store.mkdir(f"{WALLPAPER_ROOT}/manifests/runs")
    store.write_json(f"{WALLPAPER_ROOT}/manifests/runs/{run_id}-summary.json", manifest)
    _write_json_atomic(args.artifact_dir / f"{run_id}-summary.json", manifest)
    final_inventory = inventory_assets(store)
    remaining = [
        f"{date.isoformat()}:{build_filename(spec, variant).split('__', 1)[0]}:{variant}"
        for date in dates
        for spec in expected_dates.get(date, ())
        for variant in ("phone", "watch")
        if not any(a.subject == build_filename(spec, variant).split("__", 1)[0] for a in assets_for_date(final_inventory, date.isoformat())[variant])
    ]
    report = _resolution_report(start_date, dates, resolution)
    quality_fallbacks = [
        {"asset_key": key, "qa": item["qa"]}
        for key, item in manifest["assets"].items()
        if item.get("qa", {}).get("fallback_used")
    ]
    report["status"] = "incomplete" if remaining else "complete_with_warnings" if quality_fallbacks else "complete"
    report["run_id"] = run_id
    report["rotation"] = final_rotation
    report["remaining_missing_assets"] = remaining
    report["quality_fallbacks"] = quality_fallbacks
    report["finished_at"] = manifest["finished_at"]
    _write_json_atomic(args.artifact_dir / "resolve-report.json", report)
    summary = {
        "status": "incomplete" if remaining else "complete_with_warnings" if quality_fallbacks else "complete",
        "run_id": run_id,
        "window_start": start_date.isoformat(),
        "window_end": dates[-1].isoformat(),
        "rotation_date": actual_today.isoformat(),
        "rotation": final_rotation,
        "existing_slots": manifest["existing"],
        "newly_delivered": sum(1 for item in manifest["assets"].values() if item.get("state") == "delivered_verified"),
        "missing_assets": remaining,
        "quality_fallbacks": quality_fallbacks,
        "calendar_unavailable_dates": manifest["missing_dates_without_calendar_events"],
        "calendar_unclassified_events_skipped": manifest["calendar_unclassified_events_skipped"],
    }
    print(json.dumps(summary, ensure_ascii=False))
    return 0 if not remaining else 2


def main() -> int:
    args = build_parser().parse_args()
    if args.run_date:
        try:
            if dt.date.fromisoformat(args.run_date).isoformat() != args.run_date:
                raise ValueError("noncanonical date")
        except ValueError:
            print("ERROR --run-date must use YYYY-MM-DD", file=sys.stderr)
            return 2
    if args.resume_run and not re.fullmatch(r"[a-f0-9]{20}", args.resume_run):
        print("ERROR --resume-run must be a 20-character hexadecimal run id", file=sys.stderr)
        return 2
    if args.rotate_only and (args.resolve_only or args.skip_delivery):
        print("ERROR --rotate-only cannot be combined with generation modes", file=sys.stderr)
        return 2
    if args.dry_run_rotation and (args.resolve_only or args.skip_delivery or args.rotate_only):
        print("ERROR --dry-run-rotation cannot be combined with other modes", file=sys.stderr)
        return 2
    try:
        args.artifact_dir.mkdir(parents=True, exist_ok=True)
        run_status_path = args.artifact_dir / "run-status.json"
        _write_json_atomic(run_status_path, {
            "schema": 1,
            "status": "started",
            "run_date": args.run_date or local_today().isoformat(),
            "mode": "rotate-only" if args.rotate_only else "dry-run-rotation" if args.dry_run_rotation else "resolve-only" if args.resolve_only else "local-only" if args.skip_delivery else "generate",
        })
        result = run_pipeline(args)
        status = json.loads(run_status_path.read_text(encoding="utf-8"))
        status.update({"status": "completed" if result == 0 else "incomplete", "exit_code": result})
        _write_json_atomic(run_status_path, status)
        return result
    except Exception as exc:
        try:
            run_status_path = args.artifact_dir / "run-status.json"
            status = json.loads(run_status_path.read_text(encoding="utf-8")) if run_status_path.exists() else {"schema": 1}
            status.update({"status": "failed", "error_type": type(exc).__name__, "error": str(exc)})
            _write_json_atomic(run_status_path, status)
        except Exception as artifact_exc:
            print(f"ERROR unable to write run diagnostics ({type(artifact_exc).__name__})", file=sys.stderr)
        print(f"ERROR {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
