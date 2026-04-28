from __future__ import annotations

import datetime as _dt
import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, Optional, Sequence

from romcal import Romcal, get_bundled_resources

ALLOWED_SELECTOR_RANKS = frozenset({"solemnity", "feast", "memorial", "optional_memorial"})


def _normalize_token(value: Any) -> str:
    text = str(value or "").strip().lower()
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")


def _normal_forms(value: Any) -> set[str]:
    token = str(value or "").strip().lower()
    return {
        token,
        token.replace(" ", "_"),
        token.replace("_", " "),
        _normalize_token(token),
    }


@lru_cache(maxsize=1)
def _romcal() -> Romcal:
    return Romcal(calendar="general_roman", locale="en", resources=get_bundled_resources())


@lru_cache(maxsize=16)
def _romcal_identifier_index(years: tuple[int, ...]) -> Dict[str, str]:
    index: Dict[str, str] = {}
    cal = _romcal()
    for year in years:
        calendar = cal.liturgical_calendar(year)
        for days in calendar.values():
            for day in days:
                for candidate in (day.id, getattr(day, "fullname", ""), getattr(day, "name", "")):
                    for normal in _normal_forms(candidate):
                        if normal and normal not in index:
                            index[normal] = day.id
    return index


def resolve_romcal_identifier(value: Any, *, years: Optional[Iterable[int]] = None) -> str:
    candidate = str(value or "").strip()
    if not candidate:
        raise RuntimeError("Missing romcal identifier.")
    search_years = tuple(sorted(set(int(year) for year in (years or ()) if str(year).strip())))
    if not search_years:
        from datetime import date

        today = date.today().year
        search_years = tuple(range(today - 5, today + 6))
    index = _romcal_identifier_index(search_years)
    for normal in _normal_forms(candidate):
        resolved = index.get(normal)
        if resolved:
            return resolved
    return _normalize_token(candidate)


def resolve_romcal_date(value: Any, *, year: int) -> Optional[_dt.date]:
    identifier = resolve_romcal_identifier(value, years=(year,))
    calendar = _romcal().liturgical_calendar(year)
    for date_key, days in calendar.items():
        date_value = _dt.date.fromisoformat(str(date_key))
        for day in days:
            if day.id == identifier:
                return date_value
    return None


def normalize_contract_filename(value: Any) -> str:
    return resolve_romcal_identifier(value)


def validate_template_payload(payload: Dict[str, Any], *, source: str) -> None:
    if not isinstance(payload, dict):
        raise RuntimeError(f"Invalid template in {source}: root must be an object.")
    sections = payload.get("sections")
    if not isinstance(sections, list) or not sections:
        raise RuntimeError(f"Invalid template in {source}: missing or empty 'sections' array.")
    seen_keys: set[str] = set()
    for index, section in enumerate(sections, start=1):
        if not isinstance(section, dict):
            raise RuntimeError(f"Invalid template in {source}: section {index} must be an object.")
        key = _normalize_token(section.get("key") or section.get("id") or section.get("title"))
        if not key:
            raise RuntimeError(f"Invalid template in {source}: section {index} is missing a key.")
        if key in seen_keys:
            raise RuntimeError(f"Invalid template in {source}: duplicate section key '{key}'.")
        seen_keys.add(key)
        title = str(section.get("title", "")).strip()
        kind = str(section.get("kind", "")).strip().lower()
        if not title:
            raise RuntimeError(f"Invalid template in {source}: section '{key}' is missing a title.")
        if kind not in {"fixed", "generated"}:
            raise RuntimeError(f"Invalid template in {source}: section '{key}' uses unsupported kind '{kind}'.")
        if kind == "fixed":
            if not str(section.get("text", "")).strip():
                raise RuntimeError(f"Invalid template in {source}: fixed section '{key}' is missing text.")
        else:
            if not str(section.get("prompt", "")).strip():
                raise RuntimeError(f"Invalid template in {source}: generated section '{key}' is missing prompt.")


def _validate_feast_record(
    feast_record: Dict[str, Any],
    *,
    source: str,
    template_dir: Path,
    content_mode: str,
    default_saint_required: bool,
) -> None:
    if not isinstance(feast_record, dict):
        raise RuntimeError(f"Invalid novena contract in {source}: feast entry must be an object.")
    entry_id = _normalize_token(feast_record.get("id") or feast_record.get("feast_id") or feast_record.get("romcal_id"))
    feast = feast_record.get("feast")
    if feast is None:
        feast = feast_record
    if not isinstance(feast, dict):
        raise RuntimeError(f"Invalid novena contract in {source}: feast entry requires a feast object.")
    saint = feast_record.get("saint")
    if default_saint_required and not isinstance(saint, dict):
        raise RuntimeError(f"Invalid novena contract in {source}: feast entry requires a saint object.")
    feast_mode = str(feast.get("mode", "")).strip().lower() or ("romcal_id" if feast.get("romcal_id") else "fixed")
    if feast_mode == "fixed":
        try:
            month = int(feast.get("month"))
            day = int(feast.get("day"))
        except Exception as exc:
            raise RuntimeError(f"Invalid novena contract in {source}: feast month/day must be integers.") from exc
        if not (1 <= month <= 12):
            raise RuntimeError(f"Invalid novena contract in {source}: feast month must be between 1 and 12.")
        try:
            _dt.date(2000, month, day)
        except ValueError as exc:
            raise RuntimeError(f"Invalid novena contract in {source}: feast day is not valid for month {month}.") from exc
    elif feast_mode == "romcal_id":
        romcal_id = str(feast.get("romcal_id", "")).strip()
        if not romcal_id:
            raise RuntimeError(f"Invalid novena contract in {source}: feast.romcal_id is required for movable feasts.")
        resolved = resolve_romcal_identifier(romcal_id)
        if not resolved:
            raise RuntimeError(f"Invalid novena contract in {source}: feast.romcal_id is invalid.")
    else:
        raise RuntimeError(f"Invalid novena contract in {source}: feast.mode must be fixed or romcal_id.")
    if not str(feast.get("name", "")).strip():
        raise RuntimeError(f"Invalid novena contract in {source}: feast requires a name.")
    if not entry_id:
        raise RuntimeError(f"Invalid novena contract in {source}: feast entry requires an id.")
    if content_mode not in {"fixed", "ai_generated", "hybrid"}:
        raise RuntimeError(
            f"Invalid novena contract in {source}: content_mode must be fixed, ai_generated, or hybrid."
        )


def validate_novena_contract(payload: Dict[str, Any], *, source: str, template_dir: Path) -> None:
    if not isinstance(payload, dict):
        raise RuntimeError(f"Invalid novena contract in {source}: root must be an object.")
    contract = payload.get("contract")
    if not isinstance(contract, dict):
        raise RuntimeError(f"Invalid novena contract in {source}: missing 'contract' object.")
    contract_id = _normalize_token(contract.get("id"))
    if not contract_id:
        raise RuntimeError(f"Invalid novena contract in {source}: missing contract id.")
    if str(contract.get("type", "")).strip() != "novena_feast_rule":
        raise RuntimeError(f"Invalid novena contract in {source}: type must be 'novena_feast_rule'.")

    saint = contract.get("saint")
    if saint is not None and not isinstance(saint, dict):
        raise RuntimeError(f"Invalid novena contract in {source}: saint must be an object when present.")
    if isinstance(saint, dict):
        saint_id = _normalize_token(saint.get("id"))
        saint_name = str(saint.get("name", "")).strip()
        if not saint_id or not saint_name:
            raise RuntimeError(f"Invalid novena contract in {source}: saint requires id and name.")

    novena = contract.get("novena")
    if not isinstance(novena, dict):
        raise RuntimeError(f"Invalid novena contract in {source}: missing 'novena' object.")
    try:
        duration_days = int(novena.get("duration_days"))
        start_offset_days = int(novena.get("start_offset_days"))
    except Exception as exc:
        raise RuntimeError(f"Invalid novena contract in {source}: novena duration/start_offset must be integers.") from exc
    if duration_days <= 0:
        raise RuntimeError(f"Invalid novena contract in {source}: duration_days must be greater than zero.")
    content_mode = str(novena.get("content_mode", "")).strip().lower()
    if content_mode not in {"fixed", "ai_generated", "hybrid"}:
        raise RuntimeError(
            f"Invalid novena contract in {source}: content_mode must be fixed, ai_generated, or hybrid."
        )
    template_id = str(novena.get("template_id", "")).strip()
    template = novena.get("template")
    if template is None and not template_id:
        raise RuntimeError(f"Invalid novena contract in {source}: novena requires template_id or template.")
    if template is not None and not isinstance(template, dict):
        raise RuntimeError(f"Invalid novena contract in {source}: embedded template must be an object.")
    if template is not None:
        validate_template_payload(template, source=f"{source} (embedded template)")
    elif template_id:
        template_path = template_dir / f"{template_id}.json"
        if not template_path.exists():
            raise RuntimeError(f"Invalid novena contract in {source}: template file not found: {template_path}.")

    ai_config = novena.get("ai_config")
    if ai_config is not None and not isinstance(ai_config, dict):
        raise RuntimeError(f"Invalid novena contract in {source}: ai_config must be an object when present.")
    if ai_config and "themes" in ai_config:
        themes = ai_config.get("themes")
        if not isinstance(themes, list) or any(not str(item).strip() for item in themes):
            raise RuntimeError(f"Invalid novena contract in {source}: ai_config.themes must be an array of text.")

    publishing = contract.get("publishing")
    if not isinstance(publishing, dict):
        raise RuntimeError(f"Invalid novena contract in {source}: missing 'publishing' object.")
    audio = publishing.get("audio")
    rss = publishing.get("rss")
    if not isinstance(audio, dict):
        raise RuntimeError(f"Invalid novena contract in {source}: publishing.audio must be an object.")
    if not isinstance(rss, dict):
        raise RuntimeError(f"Invalid novena contract in {source}: publishing.rss must be an object.")
    if not bool(audio.get("enabled", True)):
        raise RuntimeError(f"Invalid novena contract in {source}: publishing.audio.enabled must be true.")
    if not bool(rss.get("enabled", True)):
        raise RuntimeError(f"Invalid novena contract in {source}: publishing.rss.enabled must be true.")
    for field_name in ("feed_id", "episode_title_pattern", "episode_description_pattern"):
        if not str(rss.get(field_name, "")).strip():
            raise RuntimeError(f"Invalid novena contract in {source}: publishing.rss.{field_name} is required.")

    def _template_is_compatible(template_payload: Dict[str, Any]) -> bool:
        sections = template_payload.get("sections") or []
        if content_mode == "fixed":
            return all(str(section.get("kind", "")).strip().lower() == "fixed" for section in sections)
        if content_mode == "ai_generated":
            return all(str(section.get("kind", "")).strip().lower() == "generated" for section in sections)
        return True

    if template is not None and not _template_is_compatible(template):
        raise RuntimeError(
            f"Invalid novena contract in {source}: template sections do not match content_mode '{content_mode}'."
        )
    if template is None and template_id:
        template_path = template_dir / f"{template_id}.json"
        try:
            with template_path.open("r", encoding="utf-8") as handle:
                template_payload = json.load(handle)
        except FileNotFoundError as exc:
            raise RuntimeError(f"Invalid novena contract in {source}: template file not found: {template_path}.") from exc
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"Invalid novena contract in {source}: invalid JSON in template file {template_path}: {exc.msg}"
            ) from exc
        validate_template_payload(template_payload, source=str(template_path))
        if not _template_is_compatible(template_payload):
            raise RuntimeError(
                f"Invalid novena contract in {source}: template sections do not match content_mode '{content_mode}'."
            )

    selector = contract.get("selector")
    feast = contract.get("feast")
    feasts = contract.get("feasts")
    if selector is not None:
        if feast is not None or feasts is not None:
            raise RuntimeError(f"Invalid novena contract in {source}: selector contracts cannot also define feast entries.")
        if not isinstance(selector, dict):
            raise RuntimeError(f"Invalid novena contract in {source}: selector must be an object.")
        selector_mode = str(selector.get("mode", "")).strip().lower()
        if selector_mode not in {"liturgical_rank_window", "auto"}:
            raise RuntimeError(
                f"Invalid novena contract in {source}: selector.mode must be liturgical_rank_window or auto."
            )
        ranks = selector.get("ranks")
        if ranks is not None:
            if not isinstance(ranks, list) or not ranks:
                raise RuntimeError(f"Invalid novena contract in {source}: selector.ranks must be a non-empty array.")
            normalized_ranks = [_normalize_token(rank) for rank in ranks]
            if any(rank not in ALLOWED_SELECTOR_RANKS for rank in normalized_ranks):
                raise RuntimeError(
                    f"Invalid novena contract in {source}: selector.ranks may only include solemnity, feast, memorial, or optional_memorial."
                )
        return

    if feast is not None and feasts is not None:
        raise RuntimeError(f"Invalid novena contract in {source}: use either 'feast' or 'feasts', not both.")
    if feast is None and feasts is None:
        raise RuntimeError(f"Invalid novena contract in {source}: missing 'selector' or 'feast' definition.")
    if feast is not None:
        if not isinstance(feast, dict):
            raise RuntimeError(f"Invalid novena contract in {source}: missing 'feast' object.")
        _validate_feast_record(
            {"id": contract_id, "saint": saint, "feast": feast},
            source=source,
            template_dir=template_dir,
            content_mode=content_mode,
            default_saint_required=True,
        )
    else:
        if not isinstance(feasts, list) or not feasts:
            raise RuntimeError(f"Invalid novena contract in {source}: 'feasts' must be a non-empty array.")
        seen_ids: set[str] = set()
        for index, feast_record in enumerate(feasts, start=1):
            if not isinstance(feast_record, dict):
                raise RuntimeError(f"Invalid novena contract in {source}: feast entry {index} must be an object.")
            entry_id = _normalize_token(feast_record.get("id") or feast_record.get("feast_id") or feast_record.get("romcal_id"))
            if not entry_id:
                raise RuntimeError(f"Invalid novena contract in {source}: feast entry {index} is missing an id.")
            if entry_id in seen_ids:
                raise RuntimeError(f"Invalid novena contract in {source}: duplicate feast entry id '{entry_id}'.")
            seen_ids.add(entry_id)
            entry_saint = feast_record.get("saint", saint)
            if entry_saint is not None and not isinstance(entry_saint, dict):
                raise RuntimeError(f"Invalid novena contract in {source}: feast entry {index} saint must be an object.")
            if entry_saint is None and saint is None:
                raise RuntimeError(f"Invalid novena contract in {source}: feast entry {index} requires a saint object.")
            _validate_feast_record(
                {"id": entry_id, "saint": entry_saint, "feast": feast_record.get("feast", feast_record)},
                source=source,
                template_dir=template_dir,
                content_mode=content_mode,
                default_saint_required=True,
            )
