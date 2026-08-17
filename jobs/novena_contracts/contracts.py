from __future__ import annotations

import datetime as _dt
import copy
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from jobs.publish.formatting import build_publish_context, render_publish_template

from .validators import _normalize_token, normalize_contract_filename, validate_novena_contract, validate_template_payload

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONTRACT_DIR = ROOT / "contracts" / "novenas"
DEFAULT_TEMPLATE_DIR = DEFAULT_CONTRACT_DIR / "templates"
DEFAULT_FEAST_DIR = DEFAULT_CONTRACT_DIR / "feast-days"
DEFAULT_LOUDNESS_NORMALIZATION = {
    "enabled": True,
    "integrated_lufs": -16,
    "true_peak_db": -1.5,
    "lra": 11,
}
DEFAULT_ELEVENLABS_AMELIA_PROVIDER = {
    "provider": "elevenlabs",
    "api_key_env": "ELEVENLABS_API_KEY",
    "voice_id": "pGAwIQNN9UjOkKxjAyGQ",
    "model_id": "eleven_multilingual_v2",
    "voice_settings": {
        "stability": 0.65,
        "similarity_boost": 0.8,
        "use_speaker_boost": True,
        "style": 0,
        "speed": 1.0,
    },
    "format": "mp3",
    "speed": 1.0,
}
DEFAULT_OPENAI_PROVIDER = {
    "provider": "openai",
    "api_key_env": "OPENAI_API_KEY",
    "model": "gpt-4o-mini-tts",
    "voice": "ash",
    "format": "mp3",
    "speed": 1.0,
}
DEFAULT_AUDIO_CONFIG = {
    "enabled": True,
    "model": "gpt-4o-mini-tts",
    "voice": "ash",
    "format": "mp3",
    "speed": 1.0,
    "providers": [
        copy.deepcopy(DEFAULT_ELEVENLABS_AMELIA_PROVIDER),
        copy.deepcopy(DEFAULT_OPENAI_PROVIDER),
    ],
    "loudness_normalization": dict(DEFAULT_LOUDNESS_NORMALIZATION),
}
DEFAULT_RSS_CONFIG = {
    "enabled": True,
    "feed_id": "ora-pro-nobis",
    "episode_title_pattern": "Short-Form Novena to {saint_name} Day {day} - {date_display}",
    "episode_description_pattern": "Day {day} of the Novena to {saint_name} for {feast_name}.",
}


@dataclass(frozen=True)
class TemplateSection:
    key: str
    title: str
    kind: str
    text: str = ""
    prompt: str = ""
    notes: str = ""
    days: Tuple[int, ...] = field(default_factory=tuple)
    parts: Tuple[Dict[str, Any], ...] = field(default_factory=tuple)

    def to_dict(self) -> Dict[str, Any]:
        payload = {"key": self.key, "title": self.title, "kind": self.kind}
        if self.text:
            payload["text"] = self.text
        if self.prompt:
            payload["prompt"] = self.prompt
        if self.notes:
            payload["notes"] = self.notes
        if self.days:
            payload["days"] = list(self.days)
        if self.parts:
            payload["parts"] = [dict(part) for part in self.parts]
        return payload


@dataclass(frozen=True)
class TemplateFragment:
    key: str
    title: str
    kind: str
    text: str
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "key": self.key,
            "title": self.title,
            "kind": self.kind,
            "text": self.text,
        }
        if self.notes:
            payload["notes"] = self.notes
        return payload


@dataclass(frozen=True)
class TemplateSpec:
    template_id: str
    sections: Tuple[TemplateSection, ...]
    source: str
    blocks: Tuple[TemplateSection, ...] = field(default_factory=tuple)
    fragments: Tuple[TemplateFragment, ...] = field(default_factory=tuple)

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "source": self.source,
            "template_id": self.template_id,
            "sections": [section.to_dict() for section in self.sections],
        }
        if self.blocks:
            payload["blocks"] = [block.to_dict() for block in self.blocks]
        if self.fragments:
            payload["fragments"] = [fragment.to_dict() for fragment in self.fragments]
        return payload


@dataclass(frozen=True)
class FeastRule:
    entry_id: str
    mode: str
    month: int
    day: int
    name: str
    romcal_id: str = ""
    offset_days: int = 0

    def feast_date(self, year: int) -> _dt.date:
        if self.mode in {"romcal_id", "relative_to_romcal"}:
            from .validators import resolve_romcal_date

            resolved = resolve_romcal_date(self.romcal_id or self.name, year=year)
            if resolved is None:
                raise RuntimeError(f"Unable to resolve movable feast date for '{self.romcal_id or self.name}' in {year}.")
            return resolved + _dt.timedelta(days=self.offset_days)
        return _dt.date(year, self.month, self.day)

    def to_dict(self) -> Dict[str, Any]:
        payload = {"id": self.entry_id, "mode": self.mode, "name": self.name}
        if self.mode in {"romcal_id", "relative_to_romcal"}:
            payload["romcal_id"] = self.romcal_id
        if self.mode == "relative_to_romcal":
            payload["offset_days"] = self.offset_days
        elif self.mode == "fixed":
            payload["month"] = self.month
            payload["day"] = self.day
        return payload


@dataclass(frozen=True)
class SelectorRule:
    mode: str
    ranks: Tuple[str, ...] = field(default_factory=tuple)

    def to_dict(self) -> Dict[str, Any]:
        payload = {"mode": self.mode}
        if self.ranks:
            payload["ranks"] = list(self.ranks)
        return payload


@dataclass(frozen=True)
class NovenaRule:
    duration_days: int
    start_offset_days: int
    content_mode: str
    template_id: str = ""
    template: Optional[TemplateSpec] = None
    ai_config: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "duration_days": self.duration_days,
            "start_offset_days": self.start_offset_days,
            "content_mode": self.content_mode,
        }
        if self.template_id:
            payload["template_id"] = self.template_id
        if self.template is not None:
            payload["template"] = self.template.to_dict()
        if self.ai_config:
            payload["ai_config"] = dict(self.ai_config)
        return payload


@dataclass(frozen=True)
class PublishingRule:
    audio: Dict[str, Any]
    rss: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {"audio": dict(self.audio), "rss": dict(self.rss)}


@dataclass(frozen=True)
class NovenaContract:
    family_id: str
    contract_id: str
    contract_type: str
    saint: Dict[str, Any]
    selector: Optional[SelectorRule]
    feast: Optional[FeastRule]
    novena: NovenaRule
    publishing: PublishingRule
    source_path: Path
    enabled: bool = True
    intro: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "contract": {
                "family_id": self.family_id,
                "id": self.contract_id,
                "type": self.contract_type,
                "enabled": self.enabled,
                "saint": dict(self.saint),
                "intro": dict(self.intro),
                "novena": self.novena.to_dict(),
                "publishing": self.publishing.to_dict(),
            }
        }
        contract = payload["contract"]
        if self.selector is not None:
            contract["selector"] = self.selector.to_dict()
        if self.feast is not None:
            contract["feast"] = self.feast.to_dict()
        return payload


@dataclass(frozen=True)
class NovenaRuntime:
    family_id: str
    contract_id: str
    saint: Dict[str, Any]
    feast: Dict[str, Any]
    novena: Dict[str, Any]
    resolved_template: TemplateSpec
    date: _dt.date
    active_day: int
    publishing: Dict[str, Any]
    source_path: Path
    intro: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "family_id": self.family_id,
            "contract_id": self.contract_id,
            "saint": dict(self.saint),
            "intro": dict(self.intro),
            "feast": dict(self.feast),
            "novena": dict(self.novena),
            "resolved_template": self.resolved_template.to_dict(),
            "date": self.date.isoformat(),
            "active_day": self.active_day,
            "publishing": dict(self.publishing),
            "source_path": str(self.source_path),
        }


def _payload_to_template_spec(payload: Dict[str, Any], *, source: str, source_kind: str) -> TemplateSpec:
    validate_template_payload(payload, source=source)
    template_id = str(payload.get("template_id") or Path(source).stem).strip()
    def _read_sections(items: Sequence[Dict[str, Any]]) -> Tuple[TemplateSection, ...]:
        return tuple(
            TemplateSection(
                key=_normalize_token(section.get("key") or section.get("id") or section.get("title")),
                title=str(section.get("title", "")).strip(),
                kind=str(section.get("kind", "")).strip().lower(),
                text=str(section.get("text", "")).strip(),
                prompt=str(section.get("prompt", "")).strip(),
                notes=str(section.get("notes", "")).strip(),
                days=tuple(
                    int(day)
                    for day in section.get("days", [])
                    if str(day).strip()
                ),
                parts=tuple(
                    dict(part)
                    for part in section.get("parts", [])
                    if isinstance(part, dict)
                ),
            )
            for section in items
        )

    sections = _read_sections(tuple(payload.get("sections", [])))
    blocks = _read_sections(tuple(payload.get("blocks", []))) if isinstance(payload.get("blocks"), list) else tuple()
    fragments = tuple(
        TemplateFragment(
            key=_normalize_token(fragment.get("key") or fragment.get("id") or fragment.get("title")),
            title=str(fragment.get("title", "")).strip(),
            kind=str(fragment.get("kind", "")).strip().lower(),
            text=str(fragment.get("text", "")).strip(),
            notes=str(fragment.get("notes", "")).strip(),
        )
        for fragment in payload.get("fragments", [])
        if isinstance(fragment, dict)
    )
    return TemplateSpec(template_id=template_id, sections=sections, source=source_kind, blocks=blocks, fragments=fragments)


def _template_matches_content_mode(template_spec: TemplateSpec, content_mode: str) -> bool:
    kinds = {str(section.kind).strip().lower() for section in template_spec.sections}
    if content_mode == "fixed":
        return kinds <= {"fixed"}
    if content_mode == "ai_generated":
        return kinds <= {"generated"}
    return True


def _load_json(path: Path, label: str) -> Dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except FileNotFoundError as exc:
        raise RuntimeError(f"{label} not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON in {label} '{path}': {exc.msg} (line {exc.lineno}, column {exc.colno}).") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"Invalid {label} '{path}': root must be a JSON object.")
    return payload


def _resolve_template_dir(contract_dir: Path) -> Path:
    if contract_dir.name == "feast-days":
        return contract_dir.parent / "templates"
    return contract_dir / "templates"


def _resolve_feast_dir(contract_dir: Path) -> Path:
    if contract_dir.name == "feast-days":
        return contract_dir
    feast_dir = contract_dir / "feast-days"
    if feast_dir.exists():
        return feast_dir
    return contract_dir


def _contract_root(contract_dir: Optional[Path]) -> Path:
    base = Path(contract_dir) if contract_dir else DEFAULT_CONTRACT_DIR
    if base.is_file():
        return base.parent
    return base


def _load_template(template_id: str, template_dir: Path) -> TemplateSpec:
    template_path = template_dir / f"{template_id}.json"
    payload = _load_json(template_path, "Novena template")
    source_kind = f"template_id:{template_id}"
    return _payload_to_template_spec(payload, source=str(template_path), source_kind=source_kind)


def _selector_payload_to_rule(selector_payload: Dict[str, Any], *, source: Path) -> SelectorRule:
    selector_mode = str(selector_payload.get("mode", "")).strip().lower() or "auto"
    ranks_payload = selector_payload.get("ranks") or []
    ranks = tuple(_normalize_token(rank) for rank in ranks_payload if str(rank).strip())
    if selector_mode not in {"auto", "liturgical_rank_window"}:
        raise RuntimeError(f"Novena contract '{source}' has unsupported selector mode '{selector_mode}'.")
    return SelectorRule(mode=selector_mode, ranks=ranks)


def _normalize_audio_config(config: Any) -> Dict[str, Any]:
    audio = copy.deepcopy(DEFAULT_AUDIO_CONFIG)
    if isinstance(config, dict):
        for key in audio:
            if key in config:
                audio[key] = copy.deepcopy(config[key])
        if isinstance(config.get("role_overrides"), dict):
            audio["role_overrides"] = copy.deepcopy(config["role_overrides"])
    audio["enabled"] = bool(audio.get("enabled", True))
    audio["model"] = str(audio.get("model", DEFAULT_AUDIO_CONFIG["model"])).strip() or DEFAULT_AUDIO_CONFIG["model"]
    audio["voice"] = str(audio.get("voice", DEFAULT_AUDIO_CONFIG["voice"])).strip() or DEFAULT_AUDIO_CONFIG["voice"]
    audio["format"] = str(audio.get("format", DEFAULT_AUDIO_CONFIG["format"])).strip().lower() or DEFAULT_AUDIO_CONFIG["format"]
    try:
        audio["speed"] = float(audio.get("speed", DEFAULT_AUDIO_CONFIG["speed"]))
    except Exception:
        audio["speed"] = float(DEFAULT_AUDIO_CONFIG["speed"])
    loudness_config = audio.get("loudness_normalization")
    if loudness_config is None:
        loudness = dict(DEFAULT_LOUDNESS_NORMALIZATION)
    elif isinstance(loudness_config, dict):
        loudness = dict(DEFAULT_LOUDNESS_NORMALIZATION)
        loudness.update(loudness_config)
    else:
        loudness = dict(DEFAULT_LOUDNESS_NORMALIZATION)
        loudness["enabled"] = bool(loudness_config)
    loudness["enabled"] = bool(loudness.get("enabled", True))
    try:
        loudness["integrated_lufs"] = float(loudness.get("integrated_lufs", DEFAULT_LOUDNESS_NORMALIZATION["integrated_lufs"]))
    except Exception:
        loudness["integrated_lufs"] = float(DEFAULT_LOUDNESS_NORMALIZATION["integrated_lufs"])
    try:
        loudness["true_peak_db"] = float(loudness.get("true_peak_db", DEFAULT_LOUDNESS_NORMALIZATION["true_peak_db"]))
    except Exception:
        loudness["true_peak_db"] = float(DEFAULT_LOUDNESS_NORMALIZATION["true_peak_db"])
    try:
        loudness["lra"] = float(loudness.get("lra", DEFAULT_LOUDNESS_NORMALIZATION["lra"]))
    except Exception:
        loudness["lra"] = float(DEFAULT_LOUDNESS_NORMALIZATION["lra"])
    audio["loudness_normalization"] = loudness
    providers = audio.get("providers")
    if isinstance(providers, list) and providers:
        normalized_providers: List[Dict[str, Any]] = []
        for provider in providers:
            if isinstance(provider, dict):
                normalized = copy.deepcopy(provider)
                normalized["provider"] = str(normalized.get("provider", "")).strip().lower()
                normalized["api_key_env"] = str(normalized.get("api_key_env", "")).strip()
                normalized["format"] = str(normalized.get("format", audio["format"])).strip().lower() or audio["format"]
                try:
                    normalized["speed"] = float(normalized.get("speed", audio["speed"]))
                except Exception:
                    normalized["speed"] = float(audio["speed"])
                if normalized["provider"] == "openai":
                    normalized["api_key_env"] = normalized["api_key_env"] or "OPENAI_API_KEY"
                    normalized["model"] = str(normalized.get("model", audio["model"])).strip() or audio["model"]
                    normalized["voice"] = str(normalized.get("voice", audio["voice"])).strip() or audio["voice"]
                elif normalized["provider"] == "elevenlabs":
                    normalized["api_key_env"] = normalized["api_key_env"] or "ELEVENLABS_API_KEY"
                    normalized["voice_id"] = str(normalized.get("voice_id", "")).strip()
                    normalized["model_id"] = str(normalized.get("model_id", "")).strip()
                    voice_settings = normalized.get("voice_settings")
                    normalized["voice_settings"] = copy.deepcopy(voice_settings) if isinstance(voice_settings, dict) else {}
                normalized_providers.append(normalized)
        if normalized_providers:
            audio["providers"] = normalized_providers
        else:
            audio.pop("providers", None)
    else:
        audio.pop("providers", None)
    return audio


def _normalize_rss_config(config: Any) -> Dict[str, Any]:
    rss = dict(DEFAULT_RSS_CONFIG)
    if isinstance(config, dict):
        for key in rss:
            if key in config:
                rss[key] = config[key]
    rss["enabled"] = bool(rss.get("enabled", True))
    rss["feed_id"] = str(rss.get("feed_id", DEFAULT_RSS_CONFIG["feed_id"])).strip() or DEFAULT_RSS_CONFIG["feed_id"]
    rss["episode_title_pattern"] = (
        str(rss.get("episode_title_pattern", DEFAULT_RSS_CONFIG["episode_title_pattern"])).strip()
        or DEFAULT_RSS_CONFIG["episode_title_pattern"]
    )
    rss["episode_description_pattern"] = (
        str(rss.get("episode_description_pattern", DEFAULT_RSS_CONFIG["episode_description_pattern"])).strip()
        or DEFAULT_RSS_CONFIG["episode_description_pattern"]
    )
    return rss


def _select_daily_focus(runtime: NovenaRuntime) -> tuple[str, list[str]]:
    ai_config = runtime.novena.get("ai_config") or {}
    themes = [str(item).strip() for item in ai_config.get("themes") or [] if str(item).strip()]
    if themes:
        focus = themes[(runtime.active_day - 1) % len(themes)]
    else:
        focus = str(runtime.feast.get("name", runtime.saint.get("name", runtime.contract_id))).strip() or runtime.contract_id
    return focus, themes


def _build_context_for_patterns(runtime: NovenaRuntime) -> Dict[str, Any]:
    entry = {"entry_id": runtime.contract_id, "title": runtime.saint.get("name", runtime.contract_id)}
    context = build_publish_context(
        contract_id=runtime.contract_id,
        contract_type="novena_feast_rule",
        frequency="daily",
        timezone="UTC",
        version="1",
        entry=entry,
        target_date=runtime.date,
    )
    theme, themes = _select_daily_focus(runtime)
    theme_title = " ".join(part.capitalize() for part in str(theme or "trust").split())
    context.update(
        {
            "day": runtime.active_day,
            "active_day": runtime.active_day,
            "novena_day": runtime.active_day,
            "saint_id": runtime.saint.get("id", runtime.contract_id),
            "saint_name": runtime.saint.get("name", runtime.contract_id),
            "saint": dict(runtime.saint),
            "feast_name": runtime.feast.get("name", runtime.contract_id),
            "feast": dict(runtime.feast),
            "theme": theme,
            "daily_focus": theme,
            "novena_daily_focus": theme,
            "themes": themes,
            "themes_text": ", ".join(str(item).strip() for item in themes if str(item).strip()),
            "novena_theme_title": theme_title,
            "novena_theme_slug": re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", theme_title.lower())).strip("-") or "trust",
            "novena_theme_explanation": f"Today's focus is {theme_title[:1].lower() + theme_title[1:] if theme_title else 'trust'}: this novena day is joined to the Church's prayer.",
            "novena_theme_transition": (
                f"Carrying today's focus of {theme_title[:1].lower() + theme_title[1:] if theme_title else 'trust'}, "
                "we join this novena intention to the needs of the whole day."
            ),
            "novena_theme_reflection_focus": f"Pray this novena day through {theme_title[:1].lower() + theme_title[1:] if theme_title else 'trust'}.",
            "novena_theme_sources": [{"kind": "novena", "label": runtime.saint.get("name", runtime.contract_id), "theme": theme}],
            "novena_theme_version": "saint-centered-theme-v1",
        }
    )
    return context


def _render_pattern(text: str, context: Dict[str, Any]) -> str:
    return render_publish_template(text, context)


def _build_template_spec(contract: Dict[str, Any], *, source: Path, template_dir: Path) -> TemplateSpec:
    novena = contract.get("novena") or {}
    embedded = novena.get("template")
    template_id = str(novena.get("template_id", "")).strip()
    if isinstance(embedded, dict):
        template_spec = _payload_to_template_spec(embedded, source=f"{source} (embedded template)", source_kind="embedded")
        if not _template_matches_content_mode(template_spec, str(novena.get("content_mode", "")).strip().lower()):
            raise RuntimeError(
                f"Novena contract '{source}' has an embedded template incompatible with content_mode '{novena.get('content_mode')}'."
            )
        return template_spec
    if template_id:
        template_spec = _load_template(template_id, template_dir)
        if not _template_matches_content_mode(template_spec, str(novena.get("content_mode", "")).strip().lower()):
            raise RuntimeError(
                f"Novena contract '{source}' has template_id '{template_id}' incompatible with content_mode '{novena.get('content_mode')}'."
            )
        return template_spec
    raise RuntimeError(f"Novena contract '{source}' is missing a template source.")


def _feast_payload_to_rule(
    *,
    feast_payload: Dict[str, Any],
    entry_id: str,
    source: Path,
) -> FeastRule:
    feast_mode = str(feast_payload.get("mode", "")).strip().lower() or ("romcal_id" if feast_payload.get("romcal_id") else "fixed")
    if feast_mode in {"romcal_id", "relative_to_romcal"}:
        month = 1
        day = 1
    else:
        month = int(feast_payload["month"])
        day = int(feast_payload["day"])
    return FeastRule(
        entry_id=entry_id,
        mode=feast_mode,
        month=month,
        day=day,
        name=str(feast_payload["name"]).strip(),
        romcal_id=str(feast_payload.get("romcal_id", "")).strip(),
        offset_days=int(feast_payload.get("offset_days", 0)),
    )


def _contract_entries_from_payload(payload: Dict[str, Any], *, source: Path, template_dir: Path) -> List[NovenaContract]:
    contract = payload["contract"]
    enabled = bool(contract.get("enabled", True))
    novena_payload = dict(contract["novena"])
    publishing_payload = dict(contract["publishing"])
    template_spec = _build_template_spec(contract, source=source, template_dir=template_dir)
    novena_rule = NovenaRule(
        duration_days=int(novena_payload["duration_days"]),
        start_offset_days=int(novena_payload["start_offset_days"]),
        content_mode=str(novena_payload["content_mode"]).strip().lower(),
        template_id=str(novena_payload.get("template_id", "")).strip(),
        template=template_spec,
        ai_config=dict(novena_payload.get("ai_config") or {}),
    )
    publishing = PublishingRule(
        audio=_normalize_audio_config(publishing_payload.get("audio")),
        rss=_normalize_rss_config(publishing_payload.get("rss")),
    )
    entries: List[NovenaContract] = []
    family_id = _normalize_token(contract["id"])
    shared_saint = contract.get("saint")
    shared_intro = contract.get("intro")
    selector_payload = contract.get("selector")
    if isinstance(selector_payload, dict):
        entries.append(
            NovenaContract(
                family_id=family_id,
                contract_id=family_id,
                contract_type=str(contract["type"]).strip(),
                enabled=enabled,
                saint=dict(shared_saint or {}),
                intro=dict(shared_intro or {}),
                selector=_selector_payload_to_rule(selector_payload, source=source),
                feast=None,
                novena=novena_rule,
                publishing=publishing,
                source_path=source,
            )
        )
        return entries
    feast_list = contract.get("feasts")
    grouped = feast_list is not None
    if feast_list is None:
        feast_list = [contract.get("feast")]
    for index, item in enumerate(feast_list or [], start=1):
        if not isinstance(item, dict):
            raise RuntimeError(f"Novena contract '{source}' has an invalid feast entry at index {index}.")
        entry_id = _normalize_token(
            item.get("id") or item.get("feast_id") or item.get("romcal_id") or (family_id if not grouped else "")
        )
        feast_payload = dict(item.get("feast") or item)
        saint_payload = item.get("saint") or shared_saint
        intro_payload = item.get("intro") or shared_intro
        feast = _feast_payload_to_rule(feast_payload=feast_payload, entry_id=entry_id, source=source)
        if not _template_matches_content_mode(template_spec, novena_rule.content_mode):
            raise RuntimeError(
                f"Novena contract '{source}' has template sections incompatible with content_mode '{novena_rule.content_mode}'."
            )
        entries.append(
            NovenaContract(
                family_id=family_id,
                contract_id=entry_id,
                contract_type=str(contract["type"]).strip(),
                enabled=enabled,
                saint=dict(saint_payload or {}),
                intro=dict(intro_payload or {}),
                selector=None,
                feast=feast,
                novena=novena_rule,
                publishing=publishing,
                source_path=source,
            )
        )
    return entries


def load_novena_contracts(contract_dir: Optional[Path] = None) -> List[NovenaContract]:
    base_dir = _contract_root(contract_dir)
    template_dir = _resolve_template_dir(base_dir)
    if not base_dir.exists():
        return []

    contract_files = sorted(
        path
        for path in base_dir.rglob("*.json")
        if path.is_file() and "templates" not in path.parts and path.name.endswith(".json")
    )
    if not contract_files:
        return []

    contracts: List[NovenaContract] = []
    seen_ids: Dict[str, Path] = {}
    for contract_path in contract_files:
        payload = _load_json(contract_path, "Novena contract")
        validate_novena_contract(payload, source=str(contract_path), template_dir=template_dir)
        entries = _contract_entries_from_payload(payload, source=contract_path, template_dir=template_dir)
        for contract in entries:
            normalized_id = contract.contract_id
            if contract.enabled and normalized_id in seen_ids:
                raise RuntimeError(
                    f"Duplicate novena contract id '{normalized_id}' in '{seen_ids[normalized_id]}' and '{contract_path}'."
                )
            if contract.enabled:
                seen_ids[normalized_id] = contract_path
            contracts.append(contract)

    contracts.sort(key=lambda contract: (contract.contract_id, contract.source_path.name))
    return contracts
