import argparse
import os
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from jobs.notion import generate_page_audio as mod  # noqa: E402


MIGRATION_TAG = "two_list_page_audio_v1"

OPUS_DEI_SCHEMA_UPDATES: Dict[str, Dict[str, Any]] = {
    mod.OPUS_DEI_ASSEMBLY_MODE_PROPERTY: {
        "type": "select",
        "options": [mod.OPUS_DEI_ASSEMBLY_MODE_FRAGMENTS, mod.OPUS_DEI_ASSEMBLY_MODE_SPECIAL],
    },
    mod.OPUS_DEI_DETAILED_FRAGMENTS_PROPERTY: {"type": "relation", "database_id_ref": "fragments"},
    mod.OPUS_DEI_SPECIAL_BUILDER_PROPERTY: {
        "type": "select",
        "options": [mod.OPUS_DEI_SPECIAL_BUILDER_ROSARY],
    },
    mod.OPUS_DEI_TEXT_SYNC_MODE_PROPERTY: {
        "type": "select",
        "options": [
            mod.OPUS_DEI_TEXT_SYNC_MODE_NONE,
            mod.OPUS_DEI_TEXT_SYNC_MODE_PAGE_CONTENT,
            mod.OPUS_DEI_TEXT_SYNC_MODE_TEXT_PROPERTY,
        ],
    },
    mod.OPUS_DEI_TEXT_PROPERTY_PROPERTY: {"type": "rich_text"},
    mod.OPUS_DEI_AUDIO_CAPTION_PROPERTY: {"type": "rich_text"},
    mod.OPUS_DEI_OUTPUT_FOLDER_PROPERTY: {"type": "rich_text"},
    mod.OPUS_DEI_SILENCE_MS_PROPERTY: {"type": "number"},
    mod.OPUS_DEI_TTS_MODEL_PROPERTY: {"type": "rich_text"},
    mod.OPUS_DEI_TTS_VOICE_PROPERTY: {"type": "rich_text"},
    mod.OPUS_DEI_TTS_FORMAT_PROPERTY: {"type": "rich_text"},
    mod.OPUS_DEI_TTS_SPEED_PROPERTY: {"type": "number"},
    mod.OPUS_DEI_WEEKDAY_MAP_PROPERTY: {"type": "rich_text"},
}

FRAGMENTS_SCHEMA_UPDATES: Dict[str, Dict[str, Any]] = {
    mod.DETAILED_FRAGMENT_OPUS_DEI_RELATION_PROPERTY: {"type": "relation", "database_id_ref": "opus"},
    mod.DETAILED_FRAGMENT_GROUP_PROPERTY: {"type": "rich_text"},
    mod.DETAILED_FRAGMENT_KIND_PROPERTY: {
        "type": "select",
        "options": [
            mod.FRAGMENT_TYPE_TEXT,
            mod.FRAGMENT_TYPE_PROMPT,
            mod.FRAGMENT_KIND_RSS_AUDIO,
            mod.FRAGMENT_KIND_SOURCE_AUDIO,
            mod.FRAGMENT_KIND_BUILDER,
            mod.FRAGMENT_TYPE_MONTHLY_INTENTION,
            mod.FRAGMENT_TYPE_RANDOM_INTENTION,
            mod.FRAGMENT_TYPE_DAILY_NOVENA_AUDIO,
        ],
    },
    mod.DETAILED_FRAGMENT_ASSEMBLY_ROLE_PROPERTY: {
        "type": "select",
        "options": [
            mod.ASSEMBLY_ROLE_APPEND,
            mod.ASSEMBLY_ROLE_PRIMARY_SOURCE,
            mod.ASSEMBLY_ROLE_FALLBACK_SOURCE,
        ],
    },
    mod.DETAILED_FRAGMENT_SOURCE_URL_PROPERTY: {"type": "url"},
    mod.PAGE_AUDIO_CONFIG_BUILDER_PROPERTY: {"type": "rich_text"},
    mod.PAGE_AUDIO_CONFIG_FEED_URL_PROPERTY: {"type": "url"},
    mod.PAGE_AUDIO_CONFIG_FEED_MATCH_STRATEGY_PROPERTY: {"type": "rich_text"},
    mod.PAGE_AUDIO_CONFIG_FEED_MATCH_TEXT_PROPERTY: {"type": "rich_text"},
    mod.PAGE_AUDIO_CONFIG_FEED_MATCH_MAP_PROPERTY: {"type": "rich_text"},
    mod.PAGE_AUDIO_CONFIG_INTENTION_PROPERTY: {"type": "rich_text"},
    mod.PAGE_AUDIO_CONFIG_INTENTION_PREFIX_PROPERTY: {"type": "rich_text"},
}

TEXT_ONLY_BUILDERS = {
    mod.DIVINE_OFFICE_NIGHT_TEXT_BUILDER,
    mod.DIVINE_OFFICE_EVENING_TEXT_BUILDER,
    mod.DIVINE_OFFICE_MORNING_TEXT_BUILDER,
    mod.AUXILIUM_DAILY_TEXT_BUILDER,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migrate page-audio Notion data to the two-list Opus Dei + Detailed Fragments model.")
    parser.add_argument("--apply", action="store_true", help="Apply live changes instead of printing a dry run.")
    return parser.parse_args()


def build_property_schema(spec: Dict[str, Any], *, database_ids: Dict[str, str]) -> Dict[str, Any]:
    prop_type = str(spec.get("type", "")).strip()
    if prop_type == "rich_text":
        return {"rich_text": {}}
    if prop_type == "number":
        return {"number": {"format": "number"}}
    if prop_type == "url":
        return {"url": {}}
    if prop_type == "select":
        options = [{"name": str(option).strip(), "color": "default"} for option in spec.get("options") or [] if str(option).strip()]
        return {"select": {"options": options}}
    if prop_type == "relation":
        database_id = database_ids[str(spec.get("database_id_ref", "")).strip()]
        return {
            "relation": {
                "database_id": database_id,
                "type": "single_property",
                "single_property": {},
            }
        }
    raise RuntimeError(f"Unsupported schema property type '{prop_type}'.")


def ensure_database_properties(
    *,
    database_id: str,
    database_name: str,
    token: str,
    schema_updates: Dict[str, Dict[str, Any]],
    database_ids: Dict[str, str],
    apply: bool,
) -> Dict[str, Any]:
    database = mod.shared.notion_get_database(database_id, token)
    properties = database.get("properties") or {}
    payload_updates: Dict[str, Any] = {}
    for prop_name, spec in schema_updates.items():
        current = properties.get(prop_name) or {}
        if not current:
            payload_updates[prop_name] = build_property_schema(spec, database_ids=database_ids)
            continue
        if str(spec.get("type", "")).strip() != "select":
            continue
        current_names = {
            str(option.get("name", "")).strip()
            for option in ((current.get("select") or {}).get("options") or [])
            if isinstance(option, dict)
        }
        missing = [option for option in spec.get("options") or [] if str(option).strip() and str(option).strip() not in current_names]
        if missing:
            payload_updates[prop_name] = {
                "select": {"options": [{"name": str(option).strip(), "color": "default"} for option in missing]}
            }
    if payload_updates:
        print(f'{"APPLY" if apply else "DRYRUN"} add_schema database="{database_name}" properties={sorted(payload_updates)}')
        if apply:
            mod.shared.notion_call(
                "PATCH",
                f"https://api.notion.com/v1/databases/{database_id}",
                token,
                {"properties": payload_updates},
            )
            database = mod.shared.notion_get_database(database_id, token)
        else:
            database = deepcopy(database)
            properties = dict(database.get("properties") or {})
            for prop_name, payload in payload_updates.items():
                if "select" in payload:
                    current = properties.get(prop_name) or {"type": "select", "select": {"options": []}}
                    current_options = list(((current.get("select") or {}).get("options") or []))
                    current_options.extend(payload["select"].get("options") or [])
                    properties[prop_name] = {"type": "select", "select": {"options": current_options}}
                elif "relation" in payload:
                    properties[prop_name] = {"type": "relation", "relation": payload["relation"]}
                elif "number" in payload:
                    properties[prop_name] = {"type": "number", "number": payload["number"]}
                elif "url" in payload:
                    properties[prop_name] = {"type": "url", "url": {}}
                else:
                    properties[prop_name] = {"type": "rich_text", "rich_text": {}}
            database["properties"] = properties
    return database


def payload_for_database(database: Dict[str, Any], values: Dict[str, Any]) -> Dict[str, Any]:
    payload: Dict[str, Any] = {}
    for prop_name, value in values.items():
        rendered = mod.notion_property_payload_for_database(database, prop_name, value)
        if rendered is not None:
            payload[prop_name] = rendered
    return payload


def relation_contains_page(page: Dict[str, Any], prop_name: str, target_page_id: str) -> bool:
    return str(target_page_id or "").strip() in set(mod.page_property_relation_ids(page, prop_name))


def find_output_row_for_page(
    output_pages: Sequence[Dict[str, Any]],
    page: Dict[str, Any],
    *,
    title_property: str,
) -> Dict[str, Any]:
    title = mod.shared.page_title(page, title_property).strip()
    for output_page in output_pages:
        if mod.page_property_text(output_page, mod.AUDIO_OUTPUT_TARGET_ROW_PROPERTY).strip() == title:
            return output_page
    for output_page in output_pages:
        if mod.shared.page_title(output_page, mod.AUDIO_OUTPUT_TITLE_PROPERTY).strip() == title:
            return output_page
    return {}


def find_owned_fragment_page(
    fragment_pages: Sequence[Dict[str, Any]],
    *,
    owner_page_id: str,
    title: str,
) -> Dict[str, Any]:
    wanted = str(title or "").strip().lower()
    for page in fragment_pages:
        if not relation_contains_page(page, mod.DETAILED_FRAGMENT_OPUS_DEI_RELATION_PROPERTY, owner_page_id):
            continue
        if mod.shared.page_title(page, mod.AUDIO_FRAGMENT_TITLE_PROPERTY).strip().lower() == wanted:
            return page
    return {}


def fragment_value_title(values: Dict[str, Any]) -> str:
    return str(values.get(mod.AUDIO_FRAGMENT_TITLE_PROPERTY, "")).strip()


def fragment_value_key(values: Dict[str, Any]) -> str:
    return str(values.get(mod.AUDIO_FRAGMENT_KEY_PROPERTY, "")).strip()


def fragment_value_kind(values: Dict[str, Any]) -> str:
    return mod.normalize_detailed_fragment_kind(str(values.get(mod.DETAILED_FRAGMENT_KIND_PROPERTY, "")).strip())


def fragment_value_group(values: Dict[str, Any]) -> str:
    return str(values.get(mod.DETAILED_FRAGMENT_GROUP_PROPERTY, "")).strip()


def fragment_page_matches_values(page: Dict[str, Any], values: Dict[str, Any]) -> bool:
    parsed = mod.audio_fragment_from_notion_page(page, target_date=mod.shared.local_today(), enforce_date_window=False)
    parsed_key, parsed_fragment = parsed if parsed else ("", {})
    wanted_key = fragment_value_key(values)
    page_key = str(parsed_fragment.get("key", "")).strip() or str(parsed_key or "").strip()
    if wanted_key:
        if mod.normalize_flag_value(page_key) != mod.normalize_flag_value(wanted_key):
            return False
    else:
        title = mod.shared.page_title(page, mod.AUDIO_FRAGMENT_TITLE_PROPERTY).strip()
        if title.lower() != fragment_value_title(values).lower():
            return False
    page_kind = mod.normalize_detailed_fragment_kind(
        mod.page_property_text(page, mod.DETAILED_FRAGMENT_KIND_PROPERTY).strip()
        or mod.page_property_text(page, mod.AUDIO_FRAGMENT_TYPE_PROPERTY).strip()
        or str(parsed_fragment.get("type", "")).strip()
    )
    if page_kind != fragment_value_kind(values):
        return False
    page_group = (
        mod.page_property_text(page, mod.DETAILED_FRAGMENT_GROUP_PROPERTY).strip()
        or mod.page_property_text(page, mod.AUDIO_FRAGMENT_COLLECTION_PROPERTY).strip()
        or str(parsed_fragment.get("collection", "")).strip()
    )
    return mod.normalize_flag_value(page_group) == mod.normalize_flag_value(fragment_value_group(values))


def find_candidate_fragment_pages(
    fragment_pages: Sequence[Dict[str, Any]],
    *,
    owner_page_id: str,
    values: Dict[str, Any],
    require_owner: Optional[bool],
    reserved_page_ids: Optional[Sequence[str]] = None,
) -> List[Dict[str, Any]]:
    reserved = {str(value or "").strip() for value in (reserved_page_ids or []) if str(value or "").strip()}
    matches: List[Dict[str, Any]] = []
    for page in fragment_pages:
        page_id = str(page.get("id", "")).strip()
        if page_id and page_id in reserved:
            continue
        has_owner = bool(mod.page_property_relation_ids(page, mod.DETAILED_FRAGMENT_OPUS_DEI_RELATION_PROPERTY))
        if require_owner is True and not relation_contains_page(page, mod.DETAILED_FRAGMENT_OPUS_DEI_RELATION_PROPERTY, owner_page_id):
            continue
        if require_owner is False and has_owner:
            continue
        if not fragment_page_matches_values(page, values):
            continue
        matches.append(page)
    return matches


def build_fragment_page_resolutions(
    fragment_pages: Sequence[Dict[str, Any]],
    *,
    owner_page_id: str,
    values_list: Sequence[Dict[str, Any]],
    reuse_ownerless: bool,
) -> List[Dict[str, Any]]:
    resolutions: List[Dict[str, Any]] = []
    reserved_page_ids: List[str] = []
    for values in values_list:
        owned_matches = find_candidate_fragment_pages(
            fragment_pages,
            owner_page_id=owner_page_id,
            values=values,
            require_owner=True,
            reserved_page_ids=reserved_page_ids,
        )
        if len(owned_matches) > 1:
            resolutions.append({"action": "ambiguous_owned", "matches": owned_matches, "values": values})
            continue
        if owned_matches:
            page = owned_matches[0]
            page_id = str(page.get("id", "")).strip()
            if page_id:
                reserved_page_ids.append(page_id)
            resolutions.append({"action": "update", "page": page, "values": values})
            continue
        if reuse_ownerless:
            ownerless_matches = find_candidate_fragment_pages(
                fragment_pages,
                owner_page_id=owner_page_id,
                values=values,
                require_owner=False,
                reserved_page_ids=reserved_page_ids,
            )
            if len(ownerless_matches) > 1:
                resolutions.append({"action": "ambiguous_ownerless", "matches": ownerless_matches, "values": values})
                continue
            if ownerless_matches:
                page = ownerless_matches[0]
                page_id = str(page.get("id", "")).strip()
                if page_id:
                    reserved_page_ids.append(page_id)
                resolutions.append({"action": "relink", "page": page, "values": values})
                continue
        resolutions.append({"action": "create", "page": {}, "values": values})
    return resolutions


def format_report_list(values: Sequence[str]) -> str:
    cleaned = [str(value or "").strip() for value in values if str(value or "").strip()]
    return ", ".join(cleaned) if cleaned else "-"


def create_or_update_page(
    *,
    database_id: str,
    database: Dict[str, Any],
    token: str,
    page: Dict[str, Any],
    values: Dict[str, Any],
    apply: bool,
    label: str,
) -> Optional[str]:
    payload = payload_for_database(database, values)
    if not payload:
        return str(page.get("id", "")).strip() or None
    page_id = str(page.get("id", "")).strip()
    if page_id:
        print(f'{"APPLY" if apply else "DRYRUN"} update {label} props={sorted(payload)}')
        if apply:
            mod.shared.notion_update_page_properties(page_id, payload, token)
        return page_id
    print(f'{"APPLY" if apply else "DRYRUN"} create {label} props={sorted(payload)}')
    if apply:
        mod.shared.notion_create_page(database_id, payload, token)
    return None


def refresh_pages(database_id: str, token: str) -> List[Dict[str, Any]]:
    return mod.shared.notion_get_all_pages(database_id, token)


def strip_audio_row_fields(config: Dict[str, Any]) -> Dict[str, Any]:
    cleaned = deepcopy(config)
    for key in ("audio_caption", "label", "output_folder", "silence_ms", "target_row", "text_property", "tts"):
        cleaned.pop(key, None)
    return cleaned


def row_audio_config_values(
    page: Dict[str, Any],
    *,
    title_property: str,
    source_config: Dict[str, Any],
    output_page: Dict[str, Any],
) -> Dict[str, Any]:
    title = mod.shared.page_title(page, title_property).strip() or str(page.get("id", "")).strip() or "Page Audio"
    effective = deepcopy(source_config)
    if output_page:
        effective = mod.apply_audio_output_overrides(effective, mod.audio_output_common_overrides(output_page))
    settings = mod.tts_settings_from_config(effective) if effective else mod.default_output_tts_settings()
    values: Dict[str, Any] = {
        mod.OPUS_DEI_AUDIO_CAPTION_PROPERTY: str(effective.get("audio_caption", "")).strip() or f"{title} (Audio)",
        mod.OPUS_DEI_OUTPUT_FOLDER_PROPERTY: str(effective.get("output_folder", "")).strip(),
        mod.OPUS_DEI_SILENCE_MS_PROPERTY: int(effective.get("silence_ms", mod.DEFAULT_SILENCE_MS)),
        mod.OPUS_DEI_TTS_MODEL_PROPERTY: str(settings.get("model", "")).strip(),
        mod.OPUS_DEI_TTS_VOICE_PROPERTY: str(settings.get("voice", "")).strip(),
        mod.OPUS_DEI_TTS_FORMAT_PROPERTY: str(settings.get("format", "")).strip(),
        mod.OPUS_DEI_TTS_SPEED_PROPERTY: float(settings.get("speed", 1.0)),
    }
    weekday_map = mod.page_property_text(output_page, mod.AUDIO_OUTPUT_WEEKDAY_MAP_PROPERTY).strip()
    if weekday_map:
        values[mod.OPUS_DEI_WEEKDAY_MAP_PROPERTY] = weekday_map
    return values


def resolve_wrapped_config(config_key: str, config: Dict[str, Any], config_map: Dict[str, Any]) -> tuple[str, Dict[str, Any]]:
    current_key = str(config_key or "").strip()
    current = deepcopy(config)
    seen: set[str] = set()
    while current_key and current_key not in seen:
        seen.add(current_key)
        builder = str(current.get("builder", "")).strip()
        if builder == mod.AUDIO_FRAGMENTS_BUILDER:
            source_key = str(current.get("source_config_key", "")).strip()
            if source_key and isinstance(config_map.get(source_key), dict):
                current_key = source_key
                current = deepcopy(config_map[source_key])
                continue
            fragment_sequence = list(current.get("fragment_sequence") or [])
            fragments_map = current.get("fragments") or {}
            if len(fragment_sequence) == 1 and isinstance(fragments_map, dict):
                child = fragments_map.get(str(fragment_sequence[0] or "").strip()) or {}
                child_type = mod.normalize_fragment_type_name(child.get("type", ""))
                if mod.fragment_type_matches(child_type, mod.FRAGMENT_TYPE_CONFIG):
                    source_key = str(child.get("source_config_key", "")).strip()
                    if source_key and isinstance(config_map.get(source_key), dict):
                        current_key = source_key
                        current = deepcopy(config_map[source_key])
                        continue
                if mod.fragment_type_matches(child_type, mod.FRAGMENT_TYPE_BUILDER):
                    child_config = child.get("config") or {}
                    if isinstance(child_config, dict) and str(child_config.get("builder", "")).strip():
                        current_key = f"{current_key}:{fragment_sequence[0]}"
                        current = deepcopy(child_config)
                        continue
        break
    return current_key, current


def builder_fragment_values(
    *,
    owner_page_id: str,
    title: str,
    order: int,
    role: str,
    group: str,
    builder: str,
    notes: str,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    values: Dict[str, Any] = {
        mod.AUDIO_FRAGMENT_TITLE_PROPERTY: title,
        mod.DETAILED_FRAGMENT_OPUS_DEI_RELATION_PROPERTY: [owner_page_id],
        mod.AUDIO_FRAGMENT_ENABLED_PROPERTY: True,
        mod.AUDIO_FRAGMENT_ORDER_PROPERTY: float(order),
        mod.DETAILED_FRAGMENT_GROUP_PROPERTY: group,
        mod.DETAILED_FRAGMENT_KIND_PROPERTY: mod.FRAGMENT_KIND_BUILDER,
        mod.DETAILED_FRAGMENT_ASSEMBLY_ROLE_PROPERTY: role,
        mod.PAGE_AUDIO_CONFIG_BUILDER_PROPERTY: builder,
        mod.AUDIO_FRAGMENT_NOTES_PROPERTY: notes,
    }
    if extra:
        values.update(extra)
    return values


def rss_fragment_values(
    *,
    owner_page_id: str,
    title: str,
    order: int,
    role: str,
    group: str,
    config: Dict[str, Any],
    notes: str,
) -> Dict[str, Any]:
    cleaned = strip_audio_row_fields(config)
    return {
        mod.AUDIO_FRAGMENT_TITLE_PROPERTY: title,
        mod.DETAILED_FRAGMENT_OPUS_DEI_RELATION_PROPERTY: [owner_page_id],
        mod.AUDIO_FRAGMENT_ENABLED_PROPERTY: True,
        mod.AUDIO_FRAGMENT_ORDER_PROPERTY: float(order),
        mod.DETAILED_FRAGMENT_GROUP_PROPERTY: group,
        mod.DETAILED_FRAGMENT_KIND_PROPERTY: mod.FRAGMENT_KIND_RSS_AUDIO,
        mod.DETAILED_FRAGMENT_ASSEMBLY_ROLE_PROPERTY: role,
        mod.PAGE_AUDIO_CONFIG_BUILDER_PROPERTY: mod.RSS_AUDIO_BUILDER,
        mod.PAGE_AUDIO_CONFIG_FEED_URL_PROPERTY: str(cleaned.get("rss_feed_url", "")).strip(),
        mod.PAGE_AUDIO_CONFIG_FEED_MATCH_STRATEGY_PROPERTY: str(cleaned.get("rss_match_strategy", "")).strip(),
        mod.PAGE_AUDIO_CONFIG_FEED_MATCH_TEXT_PROPERTY: str(cleaned.get("rss_match_text", "")).strip(),
        mod.PAGE_AUDIO_CONFIG_FEED_MATCH_MAP_PROPERTY: str(cleaned.get("rss_match_map", "")).strip(),
        mod.AUDIO_FRAGMENT_NOTES_PROPERTY: notes,
    }


def random_intention_fragment_values(
    *,
    owner_page_id: str,
    order: int,
    config: Dict[str, Any],
    notes: str,
) -> Optional[Dict[str, Any]]:
    intention_property = str(config.get("intention_property", "")).strip()
    intention_prefix = str(config.get("intention_prefix", "")).strip()
    if not intention_property and not intention_prefix:
        return None
    return {
        mod.AUDIO_FRAGMENT_TITLE_PROPERTY: mod.RANDOM_INTENTION_FRAGMENT_LABEL,
        mod.DETAILED_FRAGMENT_OPUS_DEI_RELATION_PROPERTY: [owner_page_id],
        mod.AUDIO_FRAGMENT_ENABLED_PROPERTY: True,
        mod.AUDIO_FRAGMENT_ORDER_PROPERTY: float(order),
        mod.DETAILED_FRAGMENT_GROUP_PROPERTY: mod.RANDOM_INTENTION_FRAGMENT_COLLECTION,
        mod.DETAILED_FRAGMENT_KIND_PROPERTY: mod.FRAGMENT_TYPE_RANDOM_INTENTION,
        mod.DETAILED_FRAGMENT_ASSEMBLY_ROLE_PROPERTY: mod.ASSEMBLY_ROLE_APPEND,
        mod.PAGE_AUDIO_CONFIG_INTENTION_PROPERTY: intention_property or mod.DEFAULT_INTENTION_PROPERTY,
        mod.PAGE_AUDIO_CONFIG_INTENTION_PREFIX_PROPERTY: intention_prefix or mod.DEFAULT_INTENTION_PREFIX,
        mod.AUDIO_FRAGMENT_NOTES_PROPERTY: notes,
    }


def text_fragment_values(
    *,
    owner_page_id: str,
    title: str,
    key: str = "",
    order: int,
    text: str,
    group: str,
    notes: str,
) -> Dict[str, Any]:
    return {
        mod.AUDIO_FRAGMENT_TITLE_PROPERTY: title,
        mod.AUDIO_FRAGMENT_KEY_PROPERTY: key,
        mod.DETAILED_FRAGMENT_OPUS_DEI_RELATION_PROPERTY: [owner_page_id],
        mod.AUDIO_FRAGMENT_ENABLED_PROPERTY: True,
        mod.AUDIO_FRAGMENT_ORDER_PROPERTY: float(order),
        mod.DETAILED_FRAGMENT_GROUP_PROPERTY: group,
        mod.DETAILED_FRAGMENT_KIND_PROPERTY: mod.FRAGMENT_TYPE_TEXT,
        mod.DETAILED_FRAGMENT_ASSEMBLY_ROLE_PROPERTY: mod.ASSEMBLY_ROLE_APPEND,
        mod.AUDIO_FRAGMENT_TEXT_PROPERTY: text,
        mod.AUDIO_FRAGMENT_NOTES_PROPERTY: notes,
    }


def prompt_fragment_values(
    *,
    owner_page_id: str,
    title: str,
    key: str = "",
    order: int,
    prompt: str,
    prompt_model: str,
    group: str,
    notes: str,
) -> Dict[str, Any]:
    return {
        mod.AUDIO_FRAGMENT_TITLE_PROPERTY: title,
        mod.AUDIO_FRAGMENT_KEY_PROPERTY: key,
        mod.DETAILED_FRAGMENT_OPUS_DEI_RELATION_PROPERTY: [owner_page_id],
        mod.AUDIO_FRAGMENT_ENABLED_PROPERTY: True,
        mod.AUDIO_FRAGMENT_ORDER_PROPERTY: float(order),
        mod.DETAILED_FRAGMENT_GROUP_PROPERTY: group,
        mod.DETAILED_FRAGMENT_KIND_PROPERTY: mod.FRAGMENT_TYPE_PROMPT,
        mod.DETAILED_FRAGMENT_ASSEMBLY_ROLE_PROPERTY: mod.ASSEMBLY_ROLE_APPEND,
        mod.AUDIO_FRAGMENT_PROMPT_PROPERTY: prompt,
        mod.AUDIO_FRAGMENT_PROMPT_MODEL_PROPERTY: prompt_model,
        mod.AUDIO_FRAGMENT_NOTES_PROPERTY: notes,
    }


def source_or_builder_fragment_values(
    *,
    owner_page_id: str,
    title: str,
    order: int,
    role: str,
    config_key: str,
    config: Dict[str, Any],
    for_text_only: bool,
) -> List[Dict[str, Any]]:
    notes = f"{MIGRATION_TAG} source={config_key}"
    values: List[Dict[str, Any]] = []
    random_intention = random_intention_fragment_values(
        owner_page_id=owner_page_id,
        order=order,
        config=config,
        notes=f"{notes} random_intention",
    )
    if random_intention is not None and not for_text_only:
        values.append(random_intention)
        order += 1

    builder = str(config.get("builder", "")).strip()
    cleaned = strip_audio_row_fields(config)
    if builder == mod.DIVINE_OFFICE_INVITATORY_BUILDER:
        cleaned["builder"] = mod.RSS_AUDIO_BUILDER
        cleaned["rss_match_text"] = str(cleaned.get("rss_match_text", "Invitatory")).strip() or "Invitatory"
        cleaned["rss_feed_url"] = str(cleaned.get("rss_feed_url", mod.DIVINE_OFFICE_FEED_URL)).strip() or mod.DIVINE_OFFICE_FEED_URL
    if builder == mod.RSS_AUDIO_BUILDER:
        values.append(
            rss_fragment_values(
                owner_page_id=owner_page_id,
                title=title,
                order=order,
                role=role,
                group="rss_audio",
                config=cleaned,
                notes=notes,
            )
        )
        return values
    if builder in TEXT_ONLY_BUILDERS or builder:
        extra: Dict[str, Any] = {}
        if cleaned.get("rss_feed_url"):
            extra[mod.PAGE_AUDIO_CONFIG_FEED_URL_PROPERTY] = str(cleaned.get("rss_feed_url", "")).strip()
        if cleaned.get("rss_match_strategy"):
            extra[mod.PAGE_AUDIO_CONFIG_FEED_MATCH_STRATEGY_PROPERTY] = str(cleaned.get("rss_match_strategy", "")).strip()
        if cleaned.get("rss_match_text"):
            extra[mod.PAGE_AUDIO_CONFIG_FEED_MATCH_TEXT_PROPERTY] = str(cleaned.get("rss_match_text", "")).strip()
        if cleaned.get("rss_match_map"):
            extra[mod.PAGE_AUDIO_CONFIG_FEED_MATCH_MAP_PROPERTY] = str(cleaned.get("rss_match_map", "")).strip()
        values.append(
            builder_fragment_values(
                owner_page_id=owner_page_id,
                title=title,
                order=order,
                role=role,
                group="builder",
                builder=builder,
                notes=notes,
                extra=extra,
            )
        )
        return values
    raise RuntimeError(f"Unsupported legacy config '{config_key}' with builder '{builder}'.")


def raw_block_lines(block: Dict[str, Any], token: str) -> List[str]:
    block_type = str(block.get("type", "")).strip()
    lines: List[str] = []
    text = mod.normalize_whitespace(mod.shared.block_rich_text_plain(block))
    if text and block_type not in {"heading_1", "heading_2", "heading_3"}:
        lines.append(text)
    if bool(block.get("has_children")):
        block_id = str(block.get("id", "")).strip()
        if block_id:
            for child in mod.shared.notion_list_block_children(block_id, token):
                child_text = mod.normalize_whitespace(mod.shared.block_rich_text_plain(child))
                if child_text:
                    lines.append(child_text)
    return [line for line in lines if line]


def morning_prayer_fragment_values_from_page(page: Dict[str, Any], token: str) -> List[Dict[str, Any]]:
    page_id = str(page.get("id", "")).strip()
    if not page_id:
        raise RuntimeError("Morning Prayer row has no page id.")
    specs: List[Dict[str, Any]] = []
    current_heading = ""
    current_lines: List[str] = []
    order = 1

    def append_text_spec(label: str, lines: Sequence[str]) -> None:
        nonlocal order
        body = mod.normalize_whitespace("\n".join(str(line or "").strip() for line in lines if mod.normalize_whitespace(line)))
        if not body:
            return
        title = mod.normalize_whitespace(label) or body[:80]
        text = mod.normalize_whitespace(f"{title}.\n\n{body}") if label else body
        specs.append(
            text_fragment_values(
                owner_page_id=page_id,
                title=title,
                order=order,
                text=text,
                group="morning_prayer",
                notes=f"{MIGRATION_TAG} source=morning_prayer_page",
            )
        )
        order += 1

    def flush_current() -> None:
        nonlocal current_heading, current_lines
        if current_lines:
            append_text_spec(current_heading, current_lines)
        current_heading = ""
        current_lines = []

    for block in mod.shared.notion_list_block_children(page_id, token):
        block_type = str(block.get("type", "")).strip()
        if block_type in {"bookmark", "audio"} or mod.is_morning_prayer_autogen_novena_block(block):
            continue
        title = mod.normalize_whitespace(mod.shared.block_rich_text_plain(block))
        if block_type == "heading_2":
            continue
        if block_type == "heading_3":
            flush_current()
            current_heading = title
            continue
        for line in raw_block_lines(block, token):
            kind = mod.placeholder_kind(line)
            if kind == "monthly_intention":
                flush_current()
                specs.append(
                    {
                        mod.AUDIO_FRAGMENT_TITLE_PROPERTY: "Monthly Intention",
                        mod.DETAILED_FRAGMENT_OPUS_DEI_RELATION_PROPERTY: [page_id],
                        mod.AUDIO_FRAGMENT_ENABLED_PROPERTY: True,
                        mod.AUDIO_FRAGMENT_ORDER_PROPERTY: float(order),
                        mod.DETAILED_FRAGMENT_GROUP_PROPERTY: mod.AUDIO_FRAGMENT_MONTHLY_COLLECTION,
                        mod.DETAILED_FRAGMENT_KIND_PROPERTY: mod.FRAGMENT_TYPE_MONTHLY_INTENTION,
                        mod.DETAILED_FRAGMENT_ASSEMBLY_ROLE_PROPERTY: mod.ASSEMBLY_ROLE_APPEND,
                        mod.AUDIO_FRAGMENT_NOTES_PROPERTY: f"{MIGRATION_TAG} source=morning_prayer_page monthly_intention",
                    }
                )
                order += 1
                continue
            if kind == "daily_novena":
                flush_current()
                specs.append(
                    {
                        mod.AUDIO_FRAGMENT_TITLE_PROPERTY: "Daily Novena Audio",
                        mod.DETAILED_FRAGMENT_OPUS_DEI_RELATION_PROPERTY: [page_id],
                        mod.AUDIO_FRAGMENT_ENABLED_PROPERTY: True,
                        mod.AUDIO_FRAGMENT_ORDER_PROPERTY: float(order),
                        mod.DETAILED_FRAGMENT_GROUP_PROPERTY: "daily_novena",
                        mod.DETAILED_FRAGMENT_KIND_PROPERTY: mod.FRAGMENT_TYPE_DAILY_NOVENA_AUDIO,
                        mod.DETAILED_FRAGMENT_ASSEMBLY_ROLE_PROPERTY: mod.ASSEMBLY_ROLE_APPEND,
                        mod.AUDIO_FRAGMENT_NOTES_PROPERTY: f"{MIGRATION_TAG} source=morning_prayer_page daily_novena",
                    }
                )
                order += 1
                continue
            current_lines.append(line)
    flush_current()
    return specs


def expand_legacy_fragment_sequence(
    entry: str,
    *,
    fragments_map: Dict[str, Dict[str, Any]],
    fragment_stack: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    value = str(entry or "").strip()
    if not value:
        return []
    stack = list(fragment_stack or [])
    normalized = value.upper()
    if normalized == mod.SPECIAL_MONTHLY_INTENTION.upper():
        return [{"type": mod.FRAGMENT_TYPE_MONTHLY_INTENTION, "label": "Monthly Intention"}]
    if normalized == mod.SPECIAL_DAILY_NOVENA_AUDIO.upper():
        return [{"type": mod.FRAGMENT_TYPE_DAILY_NOVENA_AUDIO, "label": "Daily Novena Audio"}]
    if value in stack:
        raise RuntimeError(f"Legacy fragment cycle detected: {' -> '.join([*stack, value])}")
    spec = fragments_map.get(value)
    if not isinstance(spec, dict):
        return []
    fragment_type = mod.normalize_fragment_type_name(spec.get("type", ""))
    next_stack = [*stack, value]
    if mod.fragment_type_matches(fragment_type, mod.FRAGMENT_TYPE_SEQUENCE):
        out: List[Dict[str, Any]] = []
        for child in spec.get("fragment_sequence") or []:
            out.extend(expand_legacy_fragment_sequence(str(child or "").strip(), fragments_map=fragments_map, fragment_stack=next_stack))
        return out
    if mod.fragment_type_matches(fragment_type, mod.FRAGMENT_TYPE_TEXT):
        return [{"type": mod.FRAGMENT_TYPE_TEXT, "label": str(spec.get("label", value)).strip(), "text": str(spec.get("text", "")).strip()}]
    if mod.fragment_type_matches(fragment_type, mod.FRAGMENT_TYPE_PROMPT):
        return [
            {
                "type": mod.FRAGMENT_TYPE_PROMPT,
                "label": str(spec.get("label", value)).strip(),
                "prompt": str(spec.get("prompt", "")).strip(),
                "prompt_model": str(spec.get("prompt_model", "")).strip(),
            }
        ]
    if fragment_type in {
        mod.FRAGMENT_TYPE_MONTHLY_INTENTION,
        mod.FRAGMENT_TYPE_RANDOM_INTENTION,
        mod.FRAGMENT_TYPE_DAILY_NOVENA_AUDIO,
    }:
        return [{"type": fragment_type, "label": str(spec.get("label", value)).strip(), "config": spec.get("config") or {}}]
    return []


def morning_prayer_fragment_values_from_legacy_output(
    output_page: Dict[str, Any],
    *,
    owner_page_id: str,
    fragments_map: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    legacy_by_label: Dict[str, Dict[str, Any]] = {}
    for spec in fragments_map.values():
        label = mod.normalize_flag_value(str(spec.get("label", "")).strip())
        if label and label not in legacy_by_label:
            legacy_by_label[label] = spec
    values: List[Dict[str, Any]] = []
    for contract_item in mod.morning_prayer_contract_items():
        order = int(contract_item["order"])
        key = str(contract_item["key"]).strip()
        title = str(contract_item["label"]).strip()
        item_type = str(contract_item["kind"]).strip()
        legacy_spec = fragments_map.get(key) or legacy_by_label.get(mod.normalize_flag_value(title)) or {}
        if item_type == mod.FRAGMENT_TYPE_TEXT:
            text = str(legacy_spec.get("text", "")).strip()
            prompt = str(legacy_spec.get("prompt", "")).strip()
            if prompt and not text:
                values.append(
                    prompt_fragment_values(
                        owner_page_id=owner_page_id,
                        title=title,
                        key=key,
                        order=order,
                        prompt=prompt,
                        prompt_model=str(legacy_spec.get("prompt_model", "")).strip() or "gpt-4.1-mini",
                        group=str(contract_item["group"]).strip(),
                        notes=f"{MIGRATION_TAG} source=legacy_fragment_contract",
                    )
                )
                continue
            if not text:
                continue
            values.append(
                    text_fragment_values(
                        owner_page_id=owner_page_id,
                        title=title,
                        key=key,
                        order=order,
                        text=text,
                        group=str(contract_item["group"]).strip(),
                    notes=f"{MIGRATION_TAG} source=legacy_fragment_contract",
                )
            )
        elif item_type == mod.FRAGMENT_TYPE_MONTHLY_INTENTION:
            values.append(
                {
                    mod.AUDIO_FRAGMENT_TITLE_PROPERTY: "Monthly Intention",
                    mod.AUDIO_FRAGMENT_KEY_PROPERTY: key,
                    mod.DETAILED_FRAGMENT_OPUS_DEI_RELATION_PROPERTY: [owner_page_id],
                    mod.AUDIO_FRAGMENT_ENABLED_PROPERTY: True,
                    mod.AUDIO_FRAGMENT_ORDER_PROPERTY: float(order),
                    mod.DETAILED_FRAGMENT_GROUP_PROPERTY: str(contract_item["group"]).strip(),
                    mod.DETAILED_FRAGMENT_KIND_PROPERTY: mod.FRAGMENT_TYPE_MONTHLY_INTENTION,
                    mod.DETAILED_FRAGMENT_ASSEMBLY_ROLE_PROPERTY: mod.ASSEMBLY_ROLE_APPEND,
                    mod.AUDIO_FRAGMENT_NOTES_PROPERTY: f"{MIGRATION_TAG} source=legacy_fragment_contract monthly_intention",
                }
            )
        elif item_type == mod.FRAGMENT_TYPE_DAILY_NOVENA_AUDIO:
            values.append(
                {
                    mod.AUDIO_FRAGMENT_TITLE_PROPERTY: "Daily Novena Audio",
                    mod.AUDIO_FRAGMENT_KEY_PROPERTY: key,
                    mod.DETAILED_FRAGMENT_OPUS_DEI_RELATION_PROPERTY: [owner_page_id],
                    mod.AUDIO_FRAGMENT_ENABLED_PROPERTY: True,
                    mod.AUDIO_FRAGMENT_ORDER_PROPERTY: float(order),
                    mod.DETAILED_FRAGMENT_GROUP_PROPERTY: str(contract_item["group"]).strip(),
                    mod.DETAILED_FRAGMENT_KIND_PROPERTY: mod.FRAGMENT_TYPE_DAILY_NOVENA_AUDIO,
                    mod.DETAILED_FRAGMENT_ASSEMBLY_ROLE_PROPERTY: mod.ASSEMBLY_ROLE_APPEND,
                    mod.AUDIO_FRAGMENT_NOTES_PROPERTY: f"{MIGRATION_TAG} source=legacy_fragment_contract daily_novena",
                }
            )
    return values


def preflight_morning_prayer_migration(
    *,
    page: Dict[str, Any],
    output_page: Dict[str, Any],
    fragment_pages: Sequence[Dict[str, Any]],
    fragments_map: Dict[str, Dict[str, Any]],
    title_property: str,
    apply: bool,
) -> Dict[str, Any]:
    page_id = str(page.get("id", "")).strip()
    title = mod.shared.page_title(page, title_property).strip() or page_id or mod.MORNING_PRAYER_TITLE
    values_list = morning_prayer_fragment_values_from_legacy_output(
        output_page,
        owner_page_id=page_id,
        fragments_map=fragments_map,
    )
    resolutions = build_fragment_page_resolutions(
        fragment_pages,
        owner_page_id=page_id,
        values_list=values_list,
        reuse_ownerless=True,
    )
    errors = list(mod.morning_prayer_contract_errors(values_list))
    relink_titles: List[str] = []
    create_titles: List[str] = []
    for resolution in resolutions:
        action = str(resolution.get("action", "")).strip()
        values = resolution.get("values") or {}
        item_title = fragment_value_title(values)
        if action == "relink":
            relink_titles.append(item_title)
        elif action == "create":
            create_titles.append(item_title)
        elif action.startswith("ambiguous"):
            match_ids = [str(page.get("id", "")).strip() for page in resolution.get("matches") or [] if str(page.get("id", "")).strip()]
            match_type = "owner-linked" if action == "ambiguous_owned" else "ownerless"
            errors.append(
                f"ambiguous {match_type} fragment candidates for '{item_title}' ({format_report_list(match_ids)})"
            )
    print(
        f'{"APPLY" if apply else "DRYRUN"} morning_prayer_preflight title="{title}" '
        f'relink={format_report_list(relink_titles)} create={format_report_list(create_titles)}'
    )
    if errors:
        print(
            f'{"APPLY" if apply else "DRYRUN"} morning_prayer_preflight_errors title="{title}" '
            f'errors={format_report_list(errors)}'
        )
    return {
        "values_list": values_list,
        "resolutions": resolutions,
        "errors": errors,
        "relink_titles": relink_titles,
        "create_titles": create_titles,
    }


def rosary_fragment_sort_key(spec: Dict[str, Any]) -> tuple[int, str]:
    key = mod.rosary_fragment_key_from_label(str(spec.get("label", "")).strip()) or str(spec.get("key", "")).strip()
    order_map = {
        "rosary-sign-of-cross": 10,
        "rosary-apostles-creed": 20,
        "rosary-our-father": 30,
        "rosary-hail-mary": 40,
        "rosary-glory-be": 50,
        "rosary-fatima-prayer": 60,
        mod.DEFAULT_ROSARY_MEDITATION_FRAGMENT_KEY: 70,
        "rosary-hail-holy-queen": 80,
        "rosary-closing-prayer": 90,
    }
    mystery_match = mod.re.match(r"^rosary-(joyful|sorrowful|glorious|luminous)-([1-5])$", key)
    if mystery_match:
        set_offsets = {"joyful": 100, "sorrowful": 200, "glorious": 300, "luminous": 400}
        return (set_offsets[mystery_match.group(1)] + int(mystery_match.group(2)), key)
    return (order_map.get(key, 999), key)


def rosary_fragment_values(
    *,
    owner_page_id: str,
    legacy_fragments_map: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    for key, spec in legacy_fragments_map.items():
        normalized_key = mod.rosary_fragment_key_from_label(str(spec.get("label", "")).strip()) or str(key or "").strip()
        if not normalized_key.startswith("rosary-"):
            continue
        merged = dict(spec)
        merged["key"] = normalized_key
        candidates.append(merged)
    candidates.sort(key=rosary_fragment_sort_key)
    out: List[Dict[str, Any]] = []
    for index, spec in enumerate(candidates, start=1):
        label = str(spec.get("label", "")).strip() or str(spec.get("key", "")).strip()
        notes = f"{MIGRATION_TAG} source=rosary_library"
        extra_notes = str(spec.get("notes", "")).strip()
        if extra_notes:
            notes = f"{notes}\n{extra_notes}"
        if str(spec.get("prompt", "")).strip():
            out.append(
                prompt_fragment_values(
                    owner_page_id=owner_page_id,
                    title=label,
                    order=index,
                    prompt=str(spec.get("prompt", "")).strip(),
                    prompt_model=str(spec.get("prompt_model", "")).strip() or "gpt-4.1-mini",
                    group="rosary",
                    notes=notes,
                )
            )
        else:
            out.append(
                text_fragment_values(
                    owner_page_id=owner_page_id,
                    title=label,
                    order=index,
                    text=str(spec.get("text", "")).strip(),
                    group="rosary",
                    notes=notes,
                )
            )
    return out


def upsert_fragment_pages(
    *,
    fragments_db_id: str,
    fragments_db: Dict[str, Any],
    token: str,
    fragment_pages: List[Dict[str, Any]],
    owner_page_id: str,
    values_list: Sequence[Dict[str, Any]],
    apply: bool,
    reuse_ownerless: bool = False,
    planned_resolutions: Optional[Sequence[Dict[str, Any]]] = None,
) -> List[str]:
    created_or_found_ids: List[str] = []
    resolutions = list(planned_resolutions or build_fragment_page_resolutions(
        fragment_pages,
        owner_page_id=owner_page_id,
        values_list=values_list,
        reuse_ownerless=reuse_ownerless,
    ))
    for index, values in enumerate(values_list):
        title = str(values.get(mod.AUDIO_FRAGMENT_TITLE_PROPERTY, "")).strip()
        resolution = resolutions[index] if index < len(resolutions) else {}
        action = str(resolution.get("action", "")).strip()
        if action.startswith("ambiguous"):
            match_ids = [str(page.get("id", "")).strip() for page in resolution.get("matches") or [] if str(page.get("id", "")).strip()]
            raise RuntimeError(
                f"Ambiguous fragment candidates for '{title}' ({format_report_list(match_ids)})."
            )
        existing = resolution.get("page") if action in {"update", "relink"} else {}
        fragment_id = create_or_update_page(
            database_id=fragments_db_id,
            database=fragments_db,
            token=token,
            page=existing,
            values=values,
            apply=apply,
            label=f'fragment owner="{owner_page_id}" title="{title}"',
        )
        if apply and not existing:
            fragment_pages[:] = refresh_pages(fragments_db_id, token)
            matches = find_candidate_fragment_pages(
                fragment_pages,
                owner_page_id=owner_page_id,
                values=values,
                require_owner=True,
            )
            if len(matches) == 1:
                fragment_id = str(matches[0].get("id", "")).strip() or fragment_id
        elif apply and action == "relink":
            fragment_pages[:] = refresh_pages(fragments_db_id, token)
            matches = find_candidate_fragment_pages(
                fragment_pages,
                owner_page_id=owner_page_id,
                values=values,
                require_owner=True,
            )
            if len(matches) == 1:
                fragment_id = str(matches[0].get("id", "")).strip() or fragment_id
        if fragment_id:
            created_or_found_ids.append(fragment_id)
    if apply:
        fragment_pages[:] = refresh_pages(fragments_db_id, token)
        related_ids: List[str] = []
        for page in fragment_pages:
            if relation_contains_page(page, mod.DETAILED_FRAGMENT_OPUS_DEI_RELATION_PROPERTY, owner_page_id):
                page_id = str(page.get("id", "")).strip()
                if page_id:
                    related_ids.append(page_id)
        return related_ids
    return created_or_found_ids


def migrate_page_rows(
    *,
    token: str,
    opus_db_id: str,
    opus_db: Dict[str, Any],
    fragments_db_id: str,
    fragments_db: Dict[str, Any],
    config_map: Dict[str, Any],
    apply: bool,
) -> None:
    title_property = os.getenv(mod.NOTION_TITLE_PROPERTY, "Name").strip() or "Name"
    platform_property = os.getenv(mod.NOTION_PLATFORM_PROPERTY, "Platform").strip() or "Platform"
    enabled_property = os.getenv(mod.NOTION_AUDIO_ENABLED_PROPERTY, "Enabled").strip() or "Enabled"
    text_resolver_property = os.getenv(mod.NOTION_TEXT_RESOLVER_PROPERTY, mod.DEFAULT_TEXT_RESOLVER_PROPERTY).strip() or mod.DEFAULT_TEXT_RESOLVER_PROPERTY
    auto_audio_primary_property = (
        os.getenv(mod.NOTION_AUTO_AUDIO_RESOLVER_PRIMARY_PROPERTY, mod.DEFAULT_AUTO_AUDIO_RESOLVER_PRIMARY_PROPERTY).strip()
        or mod.DEFAULT_AUTO_AUDIO_RESOLVER_PRIMARY_PROPERTY
    )
    auto_audio_secondary_property = (
        os.getenv(mod.NOTION_AUTO_AUDIO_RESOLVER_SECONDARY_PROPERTY, mod.DEFAULT_AUTO_AUDIO_RESOLVER_SECONDARY_PROPERTY).strip()
        or mod.DEFAULT_AUTO_AUDIO_RESOLVER_SECONDARY_PROPERTY
    )
    legacy_config_property = os.getenv(mod.NOTION_AUDIO_CONFIG_PROPERTY, mod.DEFAULT_AUDIO_CONFIG_PROPERTY).strip() or mod.DEFAULT_AUDIO_CONFIG_PROPERTY
    legacy_resolver_property = os.getenv(mod.NOTION_AUDIO_RESOLVER_PROPERTY, "Spotify Resolver").strip() or "Spotify Resolver"

    opus_pages = refresh_pages(opus_db_id, token)
    outputs_db_id = mod.notion_audio_outputs_database_id(token)
    output_pages = refresh_pages(outputs_db_id, token) if outputs_db_id else []
    fragment_pages = refresh_pages(fragments_db_id, token)
    legacy_fragment_pages = [page for page in fragment_pages if not mod.page_property_relation_ids(page, mod.DETAILED_FRAGMENT_OPUS_DEI_RELATION_PROPERTY)]
    legacy_fragments_map: Dict[str, Dict[str, Any]] = {}
    for page in legacy_fragment_pages:
        parsed = mod.audio_fragment_from_notion_page(page, target_date=mod.shared.local_today(), enforce_date_window=False)
        if parsed:
            key, fragment = parsed
            legacy_fragments_map[key] = fragment

    candidates = mod.list_audio_candidate_pages(
        pages=opus_pages,
        title_property=title_property,
        platform_property=platform_property,
        platform_value=mod.DEFAULT_AUTO_AUDIO_PLATFORM_VALUE,
        enabled_property=enabled_property,
        row_title_filter="",
    )
    morning_prayer_preflights: Dict[str, Dict[str, Any]] = {}
    for page in candidates:
        page_id = str(page.get("id", "")).strip()
        title = mod.shared.page_title(page, title_property).strip() or page_id
        if not mod.is_morning_prayer_title(title):
            continue
        output_page = find_output_row_for_page(output_pages, page, title_property=title_property)
        preflight = preflight_morning_prayer_migration(
            page=page,
            output_page=output_page,
            fragment_pages=fragment_pages,
            fragments_map=legacy_fragments_map,
            title_property=title_property,
            apply=apply,
        )
        morning_prayer_preflights[page_id] = preflight
        if apply and preflight.get("errors"):
            raise RuntimeError(
                "Morning Prayer migration blocked: "
                + "; ".join(str(error or "").strip() for error in preflight.get("errors") or [] if str(error or "").strip())
            )

    for page in candidates:
        page_id = str(page.get("id", "")).strip()
        title = mod.shared.page_title(page, title_property).strip() or page_id
        auto_text_enabled = mod.page_has_platform_value(page, platform_property, "auto-text")
        auto_audio_enabled = mod.page_has_platform_value(page, platform_property, "auto-audio")
        output_page = find_output_row_for_page(output_pages, page, title_property=title_property)
        text_key, audio_keys = mod.resolve_page_sync_keys(
            page,
            config_map,
            text_resolver_property=text_resolver_property,
            auto_audio_primary_property=auto_audio_primary_property,
            auto_audio_secondary_property=auto_audio_secondary_property,
            legacy_config_property=legacy_config_property,
            legacy_resolver_property=legacy_resolver_property,
            auto_text_enabled=auto_text_enabled,
            auto_audio_enabled=auto_audio_enabled,
        )
        output_mode = mod.normalize_flag_value(mod.page_property_text(output_page, mod.AUDIO_OUTPUT_MODE_PROPERTY))
        source_key = audio_keys[0] if audio_keys else text_key
        source_config = deepcopy(config_map.get(source_key) or {})
        source_key, source_config = resolve_wrapped_config(source_key, source_config, config_map) if source_key else ("", {})
        row_values = row_audio_config_values(
            page,
            title_property=title_property,
            source_config=source_config,
            output_page=output_page,
        )
        fragment_values_list: List[Dict[str, Any]] = []
        text_sync_mode = mod.OPUS_DEI_TEXT_SYNC_MODE_NONE

        if (
            output_mode == mod.AUDIO_OUTPUT_MODE_ROSARY
            or str(source_config.get("builder", "")).strip() == mod.ROSARY_DYNAMIC_BUILDER
            or "rosary" in title.lower()
        ):
            row_values[mod.OPUS_DEI_ASSEMBLY_MODE_PROPERTY] = mod.OPUS_DEI_ASSEMBLY_MODE_SPECIAL
            row_values[mod.OPUS_DEI_SPECIAL_BUILDER_PROPERTY] = mod.OPUS_DEI_SPECIAL_BUILDER_ROSARY
            row_values[mod.OPUS_DEI_TEXT_SYNC_MODE_PROPERTY] = (
                mod.OPUS_DEI_TEXT_SYNC_MODE_PAGE_CONTENT if "intentions" in title.lower() else mod.OPUS_DEI_TEXT_SYNC_MODE_NONE
            )
            fragment_values_list = rosary_fragment_values(owner_page_id=page_id, legacy_fragments_map=legacy_fragments_map)
        elif mod.is_morning_prayer_title(title):
            row_values[mod.OPUS_DEI_ASSEMBLY_MODE_PROPERTY] = mod.OPUS_DEI_ASSEMBLY_MODE_FRAGMENTS
            row_values[mod.OPUS_DEI_TEXT_SYNC_MODE_PROPERTY] = mod.OPUS_DEI_TEXT_SYNC_MODE_PAGE_CONTENT
            preflight = morning_prayer_preflights.get(page_id) or {}
            fragment_values_list = list(preflight.get("values_list") or [])
            if preflight.get("errors"):
                print(
                    f'DRYRUN skip page title="{title}" reason="Morning Prayer preflight failed; apply would be blocked."'
                )
                continue
        else:
            row_values[mod.OPUS_DEI_ASSEMBLY_MODE_PROPERTY] = mod.OPUS_DEI_ASSEMBLY_MODE_FRAGMENTS
            order = 1
            if auto_text_enabled and text_key:
                resolved_text_key, text_config = resolve_wrapped_config(text_key, deepcopy(config_map.get(text_key) or {}), config_map)
                text_builder = str(text_config.get("builder", "")).strip()
                text_sync_mode = mod.OPUS_DEI_TEXT_SYNC_MODE_PAGE_CONTENT
                if text_builder == mod.RSS_AUDIO_BUILDER:
                    fragment_values_list.append(
                        rss_fragment_values(
                            owner_page_id=page_id,
                            title=str(text_config.get("label", "")).strip() or "Text Source",
                            order=order,
                            role=mod.ASSEMBLY_ROLE_APPEND,
                            group="rss_text",
                            config=text_config,
                            notes=f"{MIGRATION_TAG} source={resolved_text_key or text_key}",
                        )
                    )
                    order += 1
                else:
                    values = source_or_builder_fragment_values(
                        owner_page_id=page_id,
                        title=str(text_config.get("label", "")).strip() or "Text Source",
                        order=order,
                        role=mod.ASSEMBLY_ROLE_APPEND,
                        config_key=resolved_text_key or text_key,
                        config=text_config,
                        for_text_only=True,
                    )
                    fragment_values_list.extend(values)
                    order += len(values)
            for index, audio_key in enumerate(audio_keys):
                resolved_audio_key, audio_config = resolve_wrapped_config(audio_key, deepcopy(config_map.get(audio_key) or {}), config_map)
                role = mod.ASSEMBLY_ROLE_PRIMARY_SOURCE if index == 0 else mod.ASSEMBLY_ROLE_FALLBACK_SOURCE
                values = source_or_builder_fragment_values(
                    owner_page_id=page_id,
                    title=str(audio_config.get("label", "")).strip() or ("Primary Source" if index == 0 else f"Fallback Source {index}"),
                    order=order,
                    role=role,
                    config_key=resolved_audio_key or audio_key,
                    config=audio_config,
                    for_text_only=False,
                )
                fragment_values_list.extend(values)
                order += len(values)
            row_values[mod.OPUS_DEI_TEXT_SYNC_MODE_PROPERTY] = text_sync_mode

        if mod.OPUS_DEI_TEXT_SYNC_MODE_PROPERTY not in row_values:
            row_values[mod.OPUS_DEI_TEXT_SYNC_MODE_PROPERTY] = mod.OPUS_DEI_TEXT_SYNC_MODE_NONE
        row_values[mod.OPUS_DEI_TEXT_PROPERTY_PROPERTY] = mod.page_property_text(page, mod.OPUS_DEI_TEXT_PROPERTY_PROPERTY).strip() or mod.DEFAULT_RSS_TEXT_PROPERTY

        related_fragment_ids = upsert_fragment_pages(
            fragments_db_id=fragments_db_id,
            fragments_db=fragments_db,
            token=token,
            fragment_pages=fragment_pages,
            owner_page_id=page_id,
            values_list=fragment_values_list,
            apply=apply,
            reuse_ownerless=mod.is_morning_prayer_title(title),
            planned_resolutions=(morning_prayer_preflights.get(page_id) or {}).get("resolutions"),
        )
        row_values[mod.OPUS_DEI_DETAILED_FRAGMENTS_PROPERTY] = related_fragment_ids
        create_or_update_page(
            database_id=opus_db_id,
            database=opus_db,
            token=token,
            page=page,
            values=row_values,
            apply=apply,
            label=f'page title="{title}"',
        )


def main() -> int:
    args = parse_args()
    apply = bool(args.apply)
    token = os.getenv(mod.NOTION_TOKEN, "").strip()
    if not token:
        raise RuntimeError(f"Missing required environment variable: {mod.NOTION_TOKEN}")

    config_payload = mod.load_page_audio_config(token)
    config_map = config_payload.get("configs") or {}
    opus_db_id = mod.shared.notion_find_database_id(token)
    fragments_db_id = mod.notion_audio_fragments_database_id(token)
    if not opus_db_id or not fragments_db_id:
        raise RuntimeError("Missing required Notion databases for page-audio migration.")

    database_ids = {"opus": opus_db_id, "fragments": fragments_db_id}
    opus_db = ensure_database_properties(
        database_id=opus_db_id,
        database_name="Opus Dei",
        token=token,
        schema_updates=OPUS_DEI_SCHEMA_UPDATES,
        database_ids=database_ids,
        apply=apply,
    )
    fragments_db = ensure_database_properties(
        database_id=fragments_db_id,
        database_name=mod.DEFAULT_AUDIO_FRAGMENTS_DATABASE_NAME,
        token=token,
        schema_updates=FRAGMENTS_SCHEMA_UPDATES,
        database_ids=database_ids,
        apply=apply,
    )

    migrate_page_rows(
        token=token,
        opus_db_id=opus_db_id,
        opus_db=opus_db,
        fragments_db_id=fragments_db_id,
        fragments_db=fragments_db,
        config_map=config_map,
        apply=apply,
    )
    print(f'{"APPLY" if apply else "DRYRUN"} migration_complete')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
