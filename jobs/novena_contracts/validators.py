from __future__ import annotations

import datetime as _dt
import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, Optional, Sequence

from romcal import Romcal, get_bundled_resources

ALLOWED_SELECTOR_RANKS = frozenset({"solemnity", "feast", "memorial", "optional_memorial"})
ROMCAL_IDENTIFIER_ALIASES = {
    "sacred_heart_of_jesus": "most_sacred_heart_of_jesus",
}
DERIVED_ROMCAL_DATE_OFFSETS = {
    "immaculate_heart_of_mary": ("most_sacred_heart_of_jesus", 1),
}


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


@lru_cache(maxsize=16)
def _romcal_mass_identifier_index(years: tuple[int, ...]) -> Dict[str, str]:
    from jobs.novena.liturgical_helpers import romcal_fetch_day

    index: Dict[str, str] = {}
    for year in years:
        current = _dt.date(year, 1, 1)
        while current.year == year:
            for event in romcal_fetch_day("general_roman", "en", current):
                identifier = str(event.get("id", "")).strip()
                if not identifier:
                    continue
                for candidate in (identifier, event.get("name", ""), event.get("fullname", ""), event.get("title", "")):
                    for normal in _normal_forms(candidate):
                        if normal and normal not in index:
                            index[normal] = identifier
            current += _dt.timedelta(days=1)
    return index


@lru_cache(maxsize=16)
def _romcal_mass_dates(year: int) -> Dict[str, _dt.date]:
    from jobs.novena.liturgical_helpers import romcal_fetch_day

    dates: Dict[str, _dt.date] = {}
    current = _dt.date(year, 1, 1)
    while current.year == year:
        for event in romcal_fetch_day("general_roman", "en", current):
            identifier = str(event.get("id", "")).strip()
            if identifier and identifier not in dates:
                dates[identifier] = current
        current += _dt.timedelta(days=1)
    return dates


def _suppressed_romcal_date(identifier: str, year: int) -> Optional[_dt.date]:
    """Recover a suppressed fixed celebration from Romcal's nearby canonical years."""
    observed = [
        value
        for candidate_year in range(year - 6, year + 7)
        if candidate_year != year
        for key, value in _romcal_mass_dates(candidate_year).items()
        if key == identifier
    ]
    month_days = {(value.month, value.day) for value in observed}
    if len(month_days) != 1:
        return None
    month, day = next(iter(month_days))
    return _dt.date(year, month, day)


def resolve_romcal_identifier(value: Any, *, years: Optional[Iterable[int]] = None) -> str:
    candidate = str(value or "").strip()
    if not candidate:
        raise RuntimeError("Missing romcal identifier.")
    normalized_candidate = _normalize_token(candidate)
    if normalized_candidate in ROMCAL_IDENTIFIER_ALIASES:
        return ROMCAL_IDENTIFIER_ALIASES[normalized_candidate]
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
    mass_index = _romcal_mass_identifier_index(search_years)
    for normal in _normal_forms(candidate):
        resolved = mass_index.get(normal)
        if resolved:
            return resolved
    return normalized_candidate


def resolve_romcal_date(value: Any, *, year: int) -> Optional[_dt.date]:
    original_identifier = _normalize_token(value)
    identifier = resolve_romcal_identifier(value, years=(year,))
    calendar = _romcal().liturgical_calendar(year)
    for date_key, days in calendar.items():
        date_value = _dt.date.fromisoformat(str(date_key))
        for day in days:
            if day.id == identifier:
                return date_value
    mass_date = _romcal_mass_dates(year).get(identifier)
    if mass_date is not None:
        return mass_date
    suppressed_date = _suppressed_romcal_date(identifier, year)
    if suppressed_date is not None:
        return suppressed_date
    derived = DERIVED_ROMCAL_DATE_OFFSETS.get(original_identifier)
    if derived is not None:
        base_identifier, offset_days = derived
        base_date = resolve_romcal_date(base_identifier, year=year)
        if base_date is not None:
            return base_date + _dt.timedelta(days=offset_days)
    return None


def normalize_contract_filename(value: Any) -> str:
    return resolve_romcal_identifier(value)


def validate_template_payload(payload: Dict[str, Any], *, source: str) -> None:
    if not isinstance(payload, dict):
        raise RuntimeError(f"Invalid template in {source}: root must be an object.")
    sections = payload.get("sections")
    if not isinstance(sections, list) or not sections:
        raise RuntimeError(f"Invalid template in {source}: missing or empty 'sections' array.")

    def _validate_parts(parts: Any, *, label: str) -> None:
        if parts is None:
            return
        if not isinstance(parts, list):
            raise RuntimeError(f"Invalid template in {source}: {label} parts must be an array when present.")
        for index, part in enumerate(parts, start=1):
            if not isinstance(part, dict):
                raise RuntimeError(f"Invalid template in {source}: {label} part {index} must be an object.")
            part_kind = _normalize_token(part.get("kind"))
            if part_kind not in {"text", "fragment", "audio_cue", "pause"}:
                raise RuntimeError(f"Invalid template in {source}: {label} part {index} uses unsupported kind '{part_kind}'.")
            if part_kind == "text":
                if not str(part.get("text", "")).strip():
                    raise RuntimeError(f"Invalid template in {source}: {label} part {index} is missing text.")
            if part_kind in {"text", "fragment"}:
                repeat = part.get("repeat", 1)
                try:
                    repeat_count = int(repeat)
                except Exception as exc:
                    raise RuntimeError(f"Invalid template in {source}: {label} part {index} repeat must be an integer.") from exc
                if repeat_count <= 0:
                    raise RuntimeError(f"Invalid template in {source}: {label} part {index} repeat must be greater than zero.")
            if part_kind == "fragment":
                if not str(part.get("fragment_key", "")).strip():
                    raise RuntimeError(f"Invalid template in {source}: {label} part {index} is missing fragment_key.")
            elif part_kind == "audio_cue":
                cue = _normalize_token(part.get("cue"))
                if cue != "sacred_bell":
                    raise RuntimeError(
                        f"Invalid template in {source}: {label} part {index} has unsupported audio cue "
                        f"'{part.get('cue', '')}'; expected 'sacred_bell'."
                    )
            elif part_kind == "pause":
                raw_duration_ms = part.get("duration_ms")
                if isinstance(raw_duration_ms, bool) or not isinstance(raw_duration_ms, int):
                    raise RuntimeError(
                        f"Invalid template in {source}: {label} part {index} pause duration_ms must be an integer."
                    )
                if raw_duration_ms < 1 or raw_duration_ms > 120000:
                    raise RuntimeError(
                        f"Invalid template in {source}: {label} part {index} pause duration_ms "
                        "must be from 1 through 120000."
                    )
            if part_kind in {"audio_cue", "pause"} and part.get("repeat") not in {None, 1}:
                raise RuntimeError(
                    f"Invalid template in {source}: {label} part {index} control parts do not support repeat."
                )

    def _validate_section_list(items: Sequence[Dict[str, Any]], *, label: str, allow_parts: bool = False) -> None:
        seen_keys: set[str] = set()
        for index, section in enumerate(items, start=1):
            if not isinstance(section, dict):
                raise RuntimeError(f"Invalid template in {source}: {label} {index} must be an object.")
            key = _normalize_token(section.get("key") or section.get("id") or section.get("title"))
            if not key:
                raise RuntimeError(f"Invalid template in {source}: {label} {index} is missing a key.")
            if key in seen_keys:
                raise RuntimeError(f"Invalid template in {source}: duplicate {label} key '{key}'.")
            seen_keys.add(key)
            title = str(section.get("title", "")).strip()
            kind = str(section.get("kind", "")).strip().lower()
            if not title:
                raise RuntimeError(f"Invalid template in {source}: {label} '{key}' is missing a title.")
            if kind not in {"fixed", "generated"}:
                raise RuntimeError(f"Invalid template in {source}: {label} '{key}' uses unsupported kind '{kind}'.")
            parts = section.get("parts")
            if parts is not None and not allow_parts:
                raise RuntimeError(f"Invalid template in {source}: {label} '{key}' does not support parts.")
            _validate_parts(parts, label=f"{label} '{key}'")
            if kind == "fixed":
                if not str(section.get("text", "")).strip() and not parts:
                    raise RuntimeError(f"Invalid template in {source}: fixed {label} '{key}' is missing text.")
            else:
                if not str(section.get("prompt", "")).strip():
                    raise RuntimeError(f"Invalid template in {source}: generated {label} '{key}' is missing prompt.")
            days = section.get("days")
            if days is not None:
                if not isinstance(days, list):
                    raise RuntimeError(f"Invalid template in {source}: {label} '{key}' days must be an array when present.")
                normalized_days: list[int] = []
                for day_index, day_value in enumerate(days, start=1):
                    try:
                        day_number = int(day_value)
                    except Exception as exc:
                        raise RuntimeError(
                            f"Invalid template in {source}: {label} '{key}' day {day_index} must be an integer."
                        ) from exc
                    if day_number <= 0:
                        raise RuntimeError(
                            f"Invalid template in {source}: {label} '{key}' day {day_index} must be greater than zero."
                        )
                    normalized_days.append(day_number)
                if len(set(normalized_days)) != len(normalized_days):
                    raise RuntimeError(f"Invalid template in {source}: {label} '{key}' days must not repeat.")

    _validate_section_list(sections, label="section")
    blocks = payload.get("blocks")
    if blocks is not None:
        if not isinstance(blocks, list):
            raise RuntimeError(f"Invalid template in {source}: blocks must be an array when present.")
        _validate_section_list(blocks, label="block", allow_parts=True)
    fragments = payload.get("fragments")
    if fragments is not None:
        if not isinstance(fragments, list):
            raise RuntimeError(f"Invalid template in {source}: fragments must be an array when present.")
        _validate_section_list(fragments, label="fragment")
        fragment_keys: set[str] = set()
        for index, fragment in enumerate(fragments, start=1):
            if not isinstance(fragment, dict):
                continue
            fragment_key = _normalize_token(fragment.get("key") or fragment.get("id") or fragment.get("title"))
            if not fragment_key:
                raise RuntimeError(f"Invalid template in {source}: fragment {index} is missing a key.")
            if fragment_key in fragment_keys:
                raise RuntimeError(f"Invalid template in {source}: duplicate fragment key '{fragment_key}'.")
            fragment_keys.add(fragment_key)

        def _validate_fragment_references(items: Sequence[Dict[str, Any]], *, label: str) -> None:
            for index, section in enumerate(items, start=1):
                if not isinstance(section, dict):
                    continue
                parts = section.get("parts")
                if not isinstance(parts, list):
                    continue
                for part_index, part in enumerate(parts, start=1):
                    if not isinstance(part, dict):
                        continue
                    if str(part.get("kind", "")).strip().lower() != "fragment":
                        continue
                    fragment_key = _normalize_token(part.get("fragment_key"))
                    if not fragment_key:
                        continue
                    if fragment_key not in fragment_keys:
                        raise RuntimeError(
                            f"Invalid template in {source}: {label} {index} part {part_index} references unknown fragment '{fragment_key}'."
                        )

        _validate_fragment_references(sections, label="section")
        if isinstance(blocks, list):
            _validate_fragment_references(blocks, label="block")


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
    elif feast_mode in {"romcal_id", "relative_to_romcal"}:
        romcal_id = str(feast.get("romcal_id", "")).strip()
        if not romcal_id:
            raise RuntimeError(f"Invalid novena contract in {source}: feast.romcal_id is required for movable feasts.")
        resolved = resolve_romcal_identifier(romcal_id)
        if not resolved:
            raise RuntimeError(f"Invalid novena contract in {source}: feast.romcal_id is invalid.")
        if feast_mode == "relative_to_romcal":
            offset_days = feast.get("offset_days")
            if isinstance(offset_days, bool) or not isinstance(offset_days, int):
                raise RuntimeError(f"Invalid novena contract in {source}: feast.offset_days must be an integer.")
    else:
        raise RuntimeError(f"Invalid novena contract in {source}: feast.mode must be fixed, romcal_id, or relative_to_romcal.")
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
    enabled = contract.get("enabled", True)
    if not isinstance(enabled, bool):
        raise RuntimeError(f"Invalid novena contract in {source}: enabled must be a boolean when present.")

    saint = contract.get("saint")
    if saint is not None and not isinstance(saint, dict):
        raise RuntimeError(f"Invalid novena contract in {source}: saint must be an object when present.")
    if isinstance(saint, dict):
        saint_id = _normalize_token(saint.get("id"))
        saint_name = str(saint.get("name", "")).strip()
        if not saint_id or not saint_name:
            raise RuntimeError(f"Invalid novena contract in {source}: saint requires id and name.")

    intro = contract.get("intro")
    if intro is not None:
        if not isinstance(intro, dict):
            raise RuntimeError(f"Invalid novena contract in {source}: intro must be an object when present.")
        kind = str(intro.get("kind", "")).strip().lower()
        if kind not in {"saint", "event"}:
            raise RuntimeError(f"Invalid novena contract in {source}: intro.kind must be saint or event.")
        if not str(intro.get("summary", "")).strip():
            raise RuntimeError(f"Invalid novena contract in {source}: intro.summary is required.")
        patronage = intro.get("patronage", [])
        if not isinstance(patronage, list) or any(not str(item).strip() for item in patronage):
            raise RuntimeError(f"Invalid novena contract in {source}: intro.patronage must be an array of text.")
        if kind == "saint" and not patronage:
            raise RuntimeError(f"Invalid novena contract in {source}: saint intro requires patronage.")
        if kind == "event" and patronage:
            raise RuntimeError(f"Invalid novena contract in {source}: event intro must not define patronage.")

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
    short_form_template_id = template_id
    if not short_form_template_id and isinstance(template, dict):
        short_form_template_id = str(template.get("template_id", "")).strip()
    if short_form_template_id == "standard-9-day":
        focus_prompt = str((ai_config or {}).get("theme_prompt", "")).strip()
        themes = list((ai_config or {}).get("themes") or [])
        normalized_themes = [str(item).strip() for item in themes if str(item).strip()]
        if not focus_prompt and not normalized_themes:
            raise RuntimeError(
                f"Invalid novena contract in {source}: short-form standard-9-day contracts must define a theme_prompt or a legacy themes list."
            )
        if normalized_themes and len({item.lower() for item in normalized_themes}) != len(normalized_themes):
            raise RuntimeError(
                f"Invalid novena contract in {source}: ai_config.themes must not repeat when present."
            )

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
    providers = audio.get("providers")
    if providers is not None:
        if not isinstance(providers, list) or not providers:
            raise RuntimeError(f"Invalid novena contract in {source}: publishing.audio.providers must be a non-empty array.")
        for index, provider in enumerate(providers, start=1):
            if not isinstance(provider, dict):
                raise RuntimeError(f"Invalid novena contract in {source}: publishing.audio.providers[{index}] must be an object.")
            provider_name = str(provider.get("provider", "")).strip().lower()
            if not provider_name:
                raise RuntimeError(f"Invalid novena contract in {source}: publishing.audio.providers[{index}].provider is required.")
            if provider_name == "elevenlabs":
                if not str(provider.get("voice_id", "")).strip():
                    raise RuntimeError(f"Invalid novena contract in {source}: publishing.audio.providers[{index}].voice_id is required for ElevenLabs.")
                if not str(provider.get("model_id", "")).strip():
                    raise RuntimeError(f"Invalid novena contract in {source}: publishing.audio.providers[{index}].model_id is required for ElevenLabs.")
                voice_settings = provider.get("voice_settings")
                if voice_settings is not None and not isinstance(voice_settings, dict):
                    raise RuntimeError(f"Invalid novena contract in {source}: publishing.audio.providers[{index}].voice_settings must be an object.")
            elif provider_name == "openai":
                if not str(provider.get("model", audio.get("model", "gpt-4o-mini-tts"))).strip():
                    raise RuntimeError(f"Invalid novena contract in {source}: publishing.audio.providers[{index}].model is required for OpenAI.")
                if not str(provider.get("voice", audio.get("voice", "ash"))).strip():
                    raise RuntimeError(f"Invalid novena contract in {source}: publishing.audio.providers[{index}].voice is required for OpenAI.")
            else:
                raise RuntimeError(f"Invalid novena contract in {source}: unsupported audio provider '{provider_name}'.")
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
