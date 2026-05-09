from __future__ import annotations

import datetime as _dt
import json
import logging
import os
from dataclasses import replace
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence

from jobs.publish.audio import audio_public_url, github_pages_base_url, podcast_feed_public_url
from jobs.publish.formatting import render_publish_template

from .artifact_writer import audio_output_path, write_novena_artifact
from .audio import build_novena_audio_job, render_novena_audio_job
from .contracts import DEFAULT_CONTRACT_DIR, NovenaContract, load_novena_contracts
from .engine import generate_text, render_novena
from .resolver import resolve_active_novenas
from .rss_publisher import publish_novena_rss

logger = logging.getLogger(__name__)

SHORT_FORM_TEMPLATE_ID = "standard-9-day"
SHORT_FORM_THEME_COUNT = 9


def _episode_id_list(jobs: Sequence[Dict[str, Any]], *, limit: int = 8) -> str:
    episode_ids = [
        str(job.get("episode_id", "")).strip() or str(job.get("entry_id", "")).strip()
        for job in jobs
        if str(job.get("episode_id", "")).strip() or str(job.get("entry_id", "")).strip()
    ]
    if not episode_ids:
        return "-"
    if len(episode_ids) <= limit:
        return ",".join(episode_ids)
    remaining = len(episode_ids) - limit
    return f"{','.join(episode_ids[:limit])},...(+{remaining} more)"


def _episode_id(runtime: Any) -> str:
    return f"{runtime.date.isoformat()}-{runtime.contract_id}-day-{runtime.active_day}"


def _is_short_form_runtime(runtime: Any) -> bool:
    template_id = str(getattr(runtime.resolved_template, "template_id", "") or "").strip()
    if template_id == SHORT_FORM_TEMPLATE_ID:
        return True
    novena = dict(getattr(runtime, "novena", {}) or {})
    return str(novena.get("template_id", "")).strip() == SHORT_FORM_TEMPLATE_ID


def _runtime_short_form_context(runtime: Any) -> Dict[str, Any]:
    return {
        "saint_name": str(runtime.saint.get("name", runtime.contract_id)).strip(),
        "saint_id": str(runtime.saint.get("id", runtime.contract_id)).strip(),
        "feast_name": str(runtime.feast.get("name", runtime.contract_id)).strip(),
        "contract_id": str(runtime.contract_id).strip(),
        "family_id": str(runtime.family_id).strip(),
    }


def _parse_theme_outline(raw_text: str) -> List[str]:
    text = str(raw_text or "").strip()
    if not text:
        return []
    try:
        parsed = json.loads(text)
    except Exception:
        parsed = None
    themes: List[str] = []
    if isinstance(parsed, list):
        for item in parsed:
            value = str(item).strip()
            if value:
                themes.append(value)
    else:
        for line in text.splitlines():
            cleaned = line.strip()
            cleaned = cleaned.lstrip("-*").strip()
            cleaned = cleaned.lstrip("0123456789. )(").strip()
            if cleaned:
                themes.append(cleaned)
    deduped: List[str] = []
    seen: set[str] = set()
    for theme in themes:
        key = theme.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(theme)
    return deduped


def _generate_short_form_themes(runtime: Any, *, generate_text_fn: Callable[[str, Dict[str, Any]], str]) -> List[str]:
    ai_config = dict(runtime.novena.get("ai_config") or {})
    existing = [str(item).strip() for item in ai_config.get("themes") or [] if str(item).strip()]
    if len(existing) >= SHORT_FORM_THEME_COUNT:
        return existing[:SHORT_FORM_THEME_COUNT]
    context = _runtime_short_form_context(runtime)
    theme_prompt = str(ai_config.get("theme_prompt", "")).strip()
    prompt_context = dict(context)
    prompt_context["theme_prompt"] = theme_prompt
    prompt = render_publish_template(
        theme_prompt
        or (
            "Create exactly 9 unique daily focus lines for a novena to {saint_name}. "
            "Each line should point to a different stage, virtue, or witness in the saint's life. "
            "Return only a JSON array of 9 strings with no extra text."
        ),
        prompt_context,
    )
    outline_prompt = "\n".join(
        [
            prompt,
            "",
            "Rules:",
            "1. Return only a JSON array of 9 strings.",
            "2. Each string must be short, unique, and specific to this saint.",
            "3. Do not repeat the same emphasis across days.",
            "4. Order the lines so they naturally lead from introduction to final perseverance.",
        ]
    )
    raw_outline = generate_text_fn(outline_prompt, context)
    themes = _parse_theme_outline(raw_outline)
    if len(themes) < SHORT_FORM_THEME_COUNT:
        raise RuntimeError(
            f"Unable to generate 9 unique daily focuses for short-form novena '{runtime.contract_id}'."
        )
    return themes[:SHORT_FORM_THEME_COUNT]


def _runtime_with_themes(runtime: Any, themes: Sequence[str]) -> Any:
    novena = dict(runtime.novena)
    ai_config = dict(novena.get("ai_config") or {})
    ai_config["themes"] = [str(item).strip() for item in themes if str(item).strip()]
    novena["ai_config"] = ai_config
    return replace(runtime, novena=novena)


def _seed_runtime_day(runtime: Any, *, active_day: int, day_date: _dt.date) -> Any:
    feast = dict(runtime.feast)
    return replace(runtime, date=day_date, active_day=active_day, feast=feast)


def _seed_short_form_runtimes(runtimes: Sequence[Any]) -> List[Any]:
    grouped: Dict[str, List[Any]] = {}
    for runtime in runtimes:
        grouped.setdefault(str(runtime.contract_id), []).append(runtime)
    seeded: List[Any] = []
    for contract_id, contract_runtimes in grouped.items():
        ordered = sorted(contract_runtimes, key=lambda item: (item.date, item.active_day))
        root = ordered[0]
        if not _is_short_form_runtime(root):
            seeded.extend(ordered)
            continue
        start_day = min(int(runtime.active_day) for runtime in ordered)
        total_days = int(root.novena.get("duration_days", start_day))
        if total_days < start_day:
            total_days = start_day
        day_offset = start_day
        for active_day in range(start_day, total_days + 1):
            day_date = root.date + _dt.timedelta(days=active_day - day_offset)
            seeded.append(_seed_runtime_day(root, active_day=active_day, day_date=day_date))
    seeded.sort(key=lambda item: (item.date, item.family_id, item.contract_id, item.active_day))
    deduped: List[Any] = []
    seen: set[str] = set()
    for runtime in seeded:
        episode_id = _episode_id(runtime)
        if episode_id in seen:
            continue
        seen.add(episode_id)
        deduped.append(runtime)
    return deduped


def _placeholder_audio_result(
    runtime: Any,
    rendered: Dict[str, Any],
    *,
    base_url: Optional[str],
    docs_root: Optional[Path],
) -> Dict[str, Any]:
    episode_id = str(rendered.get("episode_id") or _episode_id(runtime)).strip()
    return {
        "episode_id": episode_id,
        "entry_id": episode_id,
        "audio_path": str(audio_output_path(episode_id, docs_root=docs_root)),
        "audio_url": audio_public_url(episode_id, base_url=base_url),
        "audio_config": dict(runtime.publishing.get("audio") or {}),
        "content_hash": str(rendered.get("content_hash", "")).strip(),
        "rendered": False,
    }


def _sidecar_path(runtime: Any, *, docs_root: Optional[Path]) -> Path:
    episode_id = _episode_id(runtime)
    return audio_output_path(episode_id, docs_root=docs_root).with_suffix(".json")


def _load_sidecar_payload(runtime: Any, *, docs_root: Optional[Path]) -> Optional[Dict[str, Any]]:
    sidecar_path = _sidecar_path(runtime, docs_root=docs_root)
    if not sidecar_path.exists():
        return None
    try:
        return json.loads(sidecar_path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _rendered_from_sidecar(runtime: Any, payload: Dict[str, Any]) -> Dict[str, Any]:
    episode_id = str(payload.get("episode_id") or _episode_id(runtime)).strip()
    return {
        "family_id": str(payload.get("family_id", runtime.family_id)).strip(),
        "contract_id": str(payload.get("contract_id", runtime.contract_id)).strip(),
        "date": str(payload.get("date", runtime.date.isoformat())).strip(),
        "active_day": int(payload.get("active_day", runtime.active_day) or runtime.active_day),
        "saint": dict(payload.get("saint") or runtime.saint),
        "feast": dict(payload.get("feast") or runtime.feast),
        "novena": dict(payload.get("novena") or runtime.novena),
        "template": dict(payload.get("template") or runtime.resolved_template.to_dict()),
        "context": {
            "saint_name": str((payload.get("saint") or runtime.saint).get("name", runtime.contract_id)).strip(),
            "feast_name": str((payload.get("feast") or runtime.feast).get("name", runtime.contract_id)).strip(),
            "day": int(payload.get("active_day", runtime.active_day) or runtime.active_day),
            "daily_focus": _extract_daily_focus_from_payload(payload, runtime=runtime),
        },
        "content": dict(payload.get("content") or {}),
        "audio_fragments": list(payload.get("fragments") or []),
        "episode_id": episode_id,
        "title": str(payload.get("title", "")).strip(),
        "description": str(payload.get("description", "")).strip(),
    }


def _extract_daily_focus_from_payload(payload: Dict[str, Any], *, runtime: Any) -> str:
    novena = dict(payload.get("novena") or runtime.novena or {})
    ai_config = dict(novena.get("ai_config") or {})
    themes = [str(item).strip() for item in ai_config.get("themes") or [] if str(item).strip()]
    if themes:
        active_day = int(payload.get("active_day", runtime.active_day) or runtime.active_day)
        return themes[(active_day - 1) % len(themes)]
    return str((payload.get("feast") or runtime.feast).get("name", runtime.contract_id)).strip()


def _audio_job_from_sidecar(runtime: Any, payload: Dict[str, Any]) -> Dict[str, Any]:
    episode_id = str(payload.get("episode_id") or _episode_id(runtime)).strip()
    audio_config = dict(payload.get("tts") or runtime.publishing.get("audio") or {})
    audio_fragments = list(payload.get("fragments") or [])
    content_hash = str(payload.get("content_hash") or payload.get("audio", {}).get("content_hash") or "").strip()
    return {
        "family_id": str(payload.get("family_id", runtime.family_id)).strip(),
        "entry_id": episode_id,
        "episode_id": episode_id,
        "contract_id": str(payload.get("contract_id", runtime.contract_id)).strip(),
        "contract_type": str(payload.get("contract_type", "novena_feast_rule")).strip(),
        "frequency": str(payload.get("frequency", "daily")).strip(),
        "timezone": "UTC",
        "version": "1",
        "title": str(payload.get("title", "")).strip(),
        "description": str(payload.get("description", "")).strip(),
        "date": str(payload.get("date", runtime.date.isoformat())).strip(),
        "published_date": str(payload.get("published_date", runtime.date.isoformat())).strip(),
        "status": "approved",
        "text": str(dict(payload.get("content") or {}).get("text", "")).strip(),
        "audio_fragments": audio_fragments,
        "audio_config": audio_config,
        "content_hash": content_hash,
    }


def run_novena_pipeline(
    *,
    contract_dir: Optional[Path] = None,
    docs_root: Optional[Path] = None,
    cache_root: Optional[Path] = None,
    today: Optional[_dt.date] = None,
    publish_dates: Optional[Sequence[_dt.date]] = None,
    reset_feed: bool = False,
    renderer: Optional[Callable[[str, Dict[str, Any]], bytes]] = None,
    generate_text_fn: Callable[[str, Dict[str, Any]], str] = generate_text,
    base_url: Optional[str] = None,
    remote_feed_url: Optional[str] = None,
) -> Dict[str, Any]:
    root = Path(docs_root) if docs_root else Path(__file__).resolve().parents[2] / "docs"
    contracts = load_novena_contracts(contract_dir or DEFAULT_CONTRACT_DIR)
    anchor_date = today or _dt.date.today()
    target_dates = list(publish_dates) if publish_dates is not None else [anchor_date]
    target_date_set = {target for target in target_dates}
    logger.info(
        "novena_pipeline start base_url=%s publish_dates=%s contracts=%d",
        base_url or github_pages_base_url(),
        ",".join(target.isoformat() for target in target_dates),
        len(contracts),
    )
    active: List[Any] = []
    for target_date in target_dates:
        active.extend(resolve_active_novenas(target_date, contracts=contracts))
    if not active:
        logger.info("novena_pipeline no_active base_url=%s publish_dates=%s", base_url or github_pages_base_url(), ",".join(target.isoformat() for target in target_dates))
        return {
            "contracts": len(contracts),
            "active": 0,
            "rendered": 0,
            "audio": 0,
            "seeded": 0,
            "feed_written": False,
            "feed_path": str(root / "podcast.xml"),
            "publish_dates": [target.isoformat() for target in target_dates],
            "items": [],
            "seeded_items": [],
        }

    prepared_active: List[Any] = []
    grouped_active: Dict[str, List[Any]] = {}
    for runtime in active:
        grouped_active.setdefault(str(runtime.contract_id), []).append(runtime)
    for contract_id, contract_runtimes in grouped_active.items():
        ordered = sorted(contract_runtimes, key=lambda item: (item.date, item.active_day))
        seed_runtime = ordered[0]
        if _is_short_form_runtime(seed_runtime):
            seeded_payload = None
            for candidate in ordered:
                seeded_payload = _load_sidecar_payload(candidate, docs_root=root)
                if seeded_payload is not None:
                    break
            themes: List[str] = []
            if seeded_payload is not None:
                themes = [str(item).strip() for item in (seeded_payload.get("novena", {}) or {}).get("ai_config", {}).get("themes") or [] if str(item).strip()]
            if not themes:
                themes = _generate_short_form_themes(seed_runtime, generate_text_fn=generate_text_fn)
            prepared_active.extend(_runtime_with_themes(runtime, themes) for runtime in ordered)
        else:
            prepared_active.extend(ordered)

    seeded_runtimes = _seed_short_form_runtimes(prepared_active)
    seeded_items: List[Dict[str, Any]] = []
    audio_items: List[Dict[str, Any]] = []
    for runtime in seeded_runtimes:
        sidecar_payload = _load_sidecar_payload(runtime, docs_root=root)
        if sidecar_payload is None:
            rendered = render_novena(runtime, generate_text_fn=generate_text_fn)
            rendered["episode_id"] = _episode_id(runtime)
            context = dict(rendered.get("context") or {})
            rendered["title"] = _render_title(runtime, context)
            rendered["description"] = _render_description(runtime, context)
            audio_job = build_novena_audio_job(runtime, rendered)
            if runtime.date in target_date_set:
                audio_result = render_novena_audio_job(
                    audio_job,
                    renderer=renderer,
                    docs_root=root,
                    cache_root=cache_root,
                    write_sidecar=False,
                )
            else:
                audio_result = _placeholder_audio_result(runtime, rendered, base_url=base_url, docs_root=root)
            sidecar_path = write_novena_artifact(runtime, rendered, audio_result, docs_root=root)
        else:
            rendered = _rendered_from_sidecar(runtime, sidecar_payload)
            audio_job = _audio_job_from_sidecar(runtime, sidecar_payload)
            if runtime.date in target_date_set:
                audio_result = render_novena_audio_job(
                    audio_job,
                    renderer=renderer,
                    docs_root=root,
                    cache_root=cache_root,
                    write_sidecar=False,
                )
            else:
                audio_result = dict(sidecar_payload.get("audio") or {})
                audio_result.setdefault("episode_id", _episode_id(runtime))
                audio_result.setdefault("entry_id", _episode_id(runtime))
                audio_result.setdefault("audio_path", str(audio_output_path(_episode_id(runtime), docs_root=root)))
                audio_result.setdefault("audio_url", str(sidecar_payload.get("audio_url", "")))
                audio_result["rendered"] = bool(audio_result.get("rendered", False)) and Path(str(audio_result.get("audio_path", ""))).exists()
            sidecar_path = _sidecar_path(runtime, docs_root=root)
        item = {
            "runtime": runtime.to_dict(),
            "rendered": rendered,
            "audio": audio_result,
            "sidecar": str(sidecar_path),
        }
        seeded_items.append(item)
        if runtime.date in target_date_set:
            audio_items.append(item)
    current_jobs = [dict(item["audio"]) for item in audio_items]
    logger.info("novena_pipeline rendered active=%d seeded=%d audio_ids=%s", len(active), len(seeded_items), _episode_id_list(current_jobs))
    feed_path = publish_novena_rss(
        docs_root=root,
        base_url=base_url,
        current_jobs=current_jobs,
        reset_feed=reset_feed,
        remote_feed_url=remote_feed_url,
    )
    logger.info("novena_pipeline write feed_path=%s items=%d", feed_path, len(current_jobs))
    return {
        "contracts": len(contracts),
        "active": len(active),
        "rendered": len(seeded_items),
        "audio": len(audio_items),
        "seeded": len(seeded_items),
        "feed_written": True,
        "feed_path": str(feed_path),
        "publish_dates": [target.isoformat() for target in target_dates],
        "items": audio_items,
        "seeded_items": seeded_items,
    }


def _render_title(runtime, context: Dict[str, Any]) -> str:
    from jobs.publish.formatting import render_publish_template

    pattern = str(runtime.publishing.get("rss", {}).get("episode_title_pattern", "Short-Form Novena to {saint_name} Day {day} - {date_display}"))
    return render_publish_template(pattern, context)


def _render_description(runtime, context: Dict[str, Any]) -> str:
    from jobs.publish.formatting import render_publish_template

    pattern = str(runtime.publishing.get("rss", {}).get("episode_description_pattern", "Day {day} of the Novena to {saint_name} for {feast_name}."))
    return render_publish_template(pattern, context)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    mode = str(os.environ.get("NOVENA_PUBLISH_MODE", "daily")).strip().lower()
    anchor_today = _dt.date.today()
    if mode in {"bootstrap", "bootstrap-no-cache"}:
        publish_dates = [anchor_today, anchor_today + _dt.timedelta(days=1)]
        reset_feed = False
    elif mode == "reset":
        publish_dates = [anchor_today, anchor_today + _dt.timedelta(days=1)]
        reset_feed = True
    elif mode == "today":
        publish_dates = [anchor_today]
        reset_feed = False
    else:
        publish_dates = [anchor_today + _dt.timedelta(days=1)]
        reset_feed = False
    result = run_novena_pipeline(
        base_url=github_pages_base_url(),
        publish_dates=publish_dates,
        reset_feed=reset_feed,
        remote_feed_url=podcast_feed_public_url(),
    )
    print(
        f"novena_pipeline mode={mode} publish_dates={','.join(result.get('publish_dates') or [])} contracts={result['contracts']} active={result['active']} rendered={result['rendered']} feed_path={result['feed_path']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
