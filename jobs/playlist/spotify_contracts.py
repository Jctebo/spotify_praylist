import json
import re
from pathlib import Path
from typing import Any, Dict, List, NamedTuple, Optional, Tuple


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SPOTIFY_CONFIG_DIR = ROOT / "config" / "spotify"
DEFAULT_CONTRACT_DIR = DEFAULT_SPOTIFY_CONFIG_DIR / "contracts"
DEFAULT_PLAYLIST_DIR = DEFAULT_SPOTIFY_CONFIG_DIR / "playlists"
VALID_WEEKDAYS = (
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
)
VALID_WEEKDAY_LOOKUP = {name.lower(): name for name in VALID_WEEKDAYS}


class SpotifyQueueContract(NamedTuple):
    key: str
    name: str
    resolver: str
    fallback_resolver: str
    spotify_uri: str
    weekdays: Tuple[str, ...]
    source_path: Path


class SpotifyPlaylistDefinition(NamedTuple):
    key: str
    name: str
    playlist_id: str
    contracts: Tuple[str, ...]
    source_path: Path


def normalize_spotify_contract_key(value: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", str(value or "").lower())).strip("-")


def normalize_spotify_contract_filter(value: str) -> str:
    return normalize_spotify_contract_key(value)


def normalize_spotify_playlist_id(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    match = re.fullmatch(r"spotify:playlist:([A-Za-z0-9]+)", raw, flags=re.IGNORECASE)
    if match:
        return match.group(1)
    match = re.search(r"open\.spotify\.com/playlist/([A-Za-z0-9]+)(?:[/?].*)?$", raw, flags=re.IGNORECASE)
    if match:
        return match.group(1)
    if re.fullmatch(r"[A-Za-z0-9]+", raw):
        return raw
    return ""


def playlist_definition_matches_filter(definition: SpotifyPlaylistDefinition, playlist_filter: str) -> bool:
    filter_key = normalize_spotify_contract_filter(playlist_filter)
    if not filter_key:
        return True
    return filter_key in {
        normalize_spotify_contract_key(definition.key),
        normalize_spotify_contract_key(definition.name),
    }


def _load_payload(path: Path, label: str) -> Dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except FileNotFoundError as exc:
        raise RuntimeError(f"{label} file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Invalid JSON in {label} '{path}': {exc.msg} (line {exc.lineno}, column {exc.colno})."
        ) from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"Invalid {label} '{path}': root must be a JSON object.")
    return payload


def _require_text(payload: Dict[str, Any], field_name: str, path: Path, label: str) -> str:
    value = str(payload.get(field_name, "")).strip()
    if not value:
        raise RuntimeError(f"{label} '{path}' is missing required field '{field_name}'.")
    return value


def _optional_text(payload: Dict[str, Any], field_name: str) -> str:
    return str(payload.get(field_name, "")).strip()


def _load_contract_weekdays(payload: Dict[str, Any], contract_path: Path) -> Tuple[str, ...]:
    raw_weekdays = payload.get("weekdays")
    if raw_weekdays is None:
        return ()
    if not isinstance(raw_weekdays, list):
        raise RuntimeError(
            f"Spotify queue contract '{contract_path}' has invalid 'weekdays'; expected a JSON array of weekday names."
        )

    normalized: List[str] = []
    seen = set()
    for raw_day in raw_weekdays:
        day_text = str(raw_day or "").strip()
        canonical = VALID_WEEKDAY_LOOKUP.get(day_text.lower())
        if not canonical:
            valid = ", ".join(VALID_WEEKDAYS)
            raise RuntimeError(
                f"Spotify queue contract '{contract_path}' has invalid weekday '{day_text}'. Use one of: {valid}."
            )
        if canonical not in seen:
            seen.add(canonical)
            normalized.append(canonical)
    return tuple(normalized)


def load_spotify_queue_contracts(contract_dir: Optional[Path] = None) -> List[SpotifyQueueContract]:
    base_dir = Path(contract_dir) if contract_dir else DEFAULT_CONTRACT_DIR
    if not base_dir.exists():
        raise RuntimeError(f"Spotify queue contract directory not found: {base_dir}")

    contract_files = sorted(path for path in base_dir.glob("*.json") if path.is_file())
    if not contract_files:
        raise RuntimeError(f"No Spotify queue contract files found in {base_dir}.")

    contracts: List[SpotifyQueueContract] = []
    seen_keys: Dict[str, Path] = {}
    seen_names: Dict[str, Path] = {}

    for contract_path in contract_files:
        payload = _load_payload(contract_path, "Spotify queue contract")

        key = normalize_spotify_contract_key(_require_text(payload, "key", contract_path, "Spotify queue contract"))
        name = _require_text(payload, "name", contract_path, "Spotify queue contract")
        resolver = _optional_text(payload, "resolver")
        fallback_resolver = _optional_text(payload, "fallback_resolver")
        spotify_uri = _optional_text(payload, "spotify_uri")
        weekdays = _load_contract_weekdays(payload, contract_path)

        if not key:
            raise RuntimeError(f"Spotify queue contract '{contract_path}' has an invalid 'key'.")
        if bool(resolver) == bool(spotify_uri):
            raise RuntimeError(
                f"Spotify queue contract '{contract_path}' must define exactly one of 'resolver' or 'spotify_uri'."
            )
        if fallback_resolver and not resolver:
            raise RuntimeError(
                f"Spotify queue contract '{contract_path}' cannot define 'fallback_resolver' without 'resolver'."
            )
        if spotify_uri and not spotify_uri.startswith("spotify:"):
            raise RuntimeError(f"Spotify queue contract '{contract_path}' has an invalid 'spotify_uri'.")

        duplicate_key_path = seen_keys.get(key)
        if duplicate_key_path:
            raise RuntimeError(
                f"Duplicate Spotify queue contract key '{key}' in '{duplicate_key_path}' and '{contract_path}'."
            )
        name_key = normalize_spotify_contract_key(name)
        duplicate_name_path = seen_names.get(name_key)
        if duplicate_name_path:
            raise RuntimeError(
                f"Duplicate Spotify queue contract name '{name}' in '{duplicate_name_path}' and '{contract_path}'."
            )

        seen_keys[key] = contract_path
        seen_names[name_key] = contract_path
        contracts.append(
            SpotifyQueueContract(
                key=key,
                name=name,
                resolver=resolver,
                fallback_resolver=fallback_resolver,
                spotify_uri=spotify_uri,
                weekdays=weekdays,
                source_path=contract_path,
            )
        )

    contracts.sort(
        key=lambda contract: (
            normalize_spotify_contract_key(contract.key),
            normalize_spotify_contract_key(contract.name),
        )
    )
    return contracts


def _load_playlist_contract_keys(payload: Dict[str, Any], playlist_path: Path) -> Tuple[str, ...]:
    raw_contracts = payload.get("contracts")
    if not isinstance(raw_contracts, list) or not raw_contracts:
        raise RuntimeError(
            f"Spotify playlist definition '{playlist_path}' must define a non-empty 'contracts' array."
        )

    contract_keys: List[str] = []
    for raw_value in raw_contracts:
        normalized = normalize_spotify_contract_key(str(raw_value or "").strip())
        if not normalized:
            raise RuntimeError(
                f"Spotify playlist definition '{playlist_path}' contains an invalid contract key in 'contracts'."
            )
        contract_keys.append(normalized)
    return tuple(contract_keys)


def load_spotify_playlist_definitions(
    playlist_filter: str = "",
    playlist_dir: Optional[Path] = None,
    contract_dir: Optional[Path] = None,
    contracts: Optional[List[SpotifyQueueContract]] = None,
) -> List[SpotifyPlaylistDefinition]:
    base_dir = Path(playlist_dir) if playlist_dir else DEFAULT_PLAYLIST_DIR
    if not base_dir.exists():
        raise RuntimeError(f"Spotify playlist definition directory not found: {base_dir}")

    playlist_files = sorted(path for path in base_dir.glob("*.json") if path.is_file())
    if not playlist_files:
        raise RuntimeError(f"No Spotify playlist definition files found in {base_dir}.")

    available_contracts = list(contracts or load_spotify_queue_contracts(contract_dir=contract_dir))
    contracts_by_key = {contract.key: contract for contract in available_contracts}

    definitions: List[SpotifyPlaylistDefinition] = []
    seen_keys: Dict[str, Path] = {}
    seen_names: Dict[str, Path] = {}
    for playlist_path in playlist_files:
        payload = _load_payload(playlist_path, "Spotify playlist definition")

        key = normalize_spotify_contract_key(
            _require_text(payload, "key", playlist_path, "Spotify playlist definition")
        )
        name = _require_text(payload, "name", playlist_path, "Spotify playlist definition")
        playlist_id = normalize_spotify_playlist_id(
            _require_text(payload, "playlist_id", playlist_path, "Spotify playlist definition")
        )
        contract_keys = _load_playlist_contract_keys(payload, playlist_path)

        if not key:
            raise RuntimeError(f"Spotify playlist definition '{playlist_path}' has an invalid 'key'.")
        if not playlist_id:
            raise RuntimeError(f"Spotify playlist definition '{playlist_path}' has an invalid 'playlist_id'.")

        duplicate_key_path = seen_keys.get(key)
        if duplicate_key_path:
            raise RuntimeError(
                f"Duplicate Spotify playlist definition key '{key}' in '{duplicate_key_path}' and '{playlist_path}'."
            )
        name_key = normalize_spotify_contract_key(name)
        duplicate_name_path = seen_names.get(name_key)
        if duplicate_name_path:
            raise RuntimeError(
                f"Duplicate Spotify playlist definition name '{name}' in '{duplicate_name_path}' and '{playlist_path}'."
            )

        seen_keys[key] = playlist_path
        seen_names[name_key] = playlist_path
        definitions.append(
            SpotifyPlaylistDefinition(
                key=key,
                name=name,
                playlist_id=playlist_id,
                contracts=contract_keys,
                source_path=playlist_path,
            )
        )

    for definition in definitions:
        for contract_key in definition.contracts:
            if contract_key not in contracts_by_key:
                raise RuntimeError(
                    f"Spotify playlist definition '{definition.source_path}' references unknown contract key '{contract_key}'."
                )

    definitions.sort(
        key=lambda definition: (
            normalize_spotify_contract_key(definition.key),
            normalize_spotify_contract_key(definition.name),
        )
    )
    filtered = [definition for definition in definitions if playlist_definition_matches_filter(definition, playlist_filter)]
    if normalize_spotify_contract_filter(playlist_filter) and not filtered:
        raise RuntimeError(f"No Spotify playlist definition matched '{playlist_filter}' in {base_dir}.")
    return filtered
