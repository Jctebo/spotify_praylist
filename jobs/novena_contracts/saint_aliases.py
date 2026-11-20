"""Saint alias support for the novena generator.

One saint can appear under several name forms: the calendar (romcal) uses an
official long form (e.g. "Saint Pius of Pietrelcina, Priest") while John's
contract catalog may carry the same saint under a short form (e.g. the
"St Padre Pio" traditional contract), and the auto-materialized short-form
catalog names the saint after the calendar entry. Without alias resolution
the generator resolves each form to a different contract and produces two
novenas for one saint (a traditional one and a short-form one).

This module is the single, data-driven alias table. To cover another saint,
append one entry to SAINT_ALIAS_GROUPS with:

- "saint": display name for the saint (documentation only),
- "canonical_contract_id": the one contract every form resolves to
  (prefer the curated traditional/fixed contract over an auto-materialized
  short-form contract),
- "names": every saint-name form seen for this saint (contract saint names,
  calendar names, common short forms),
- "ids": every identifier form seen for this saint (contract ids, saint ids,
  romcal celebration ids).

Matching is normalization-based (case, accents/diacritics, "St." vs "Saint",
punctuation), so minor spelling variants of a listed form also resolve.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, Optional, Tuple

# Honorific / rank words that carry no identity for matching purposes.
_PREFIX_TOKENS = frozenset(
    {
        "st",
        "saint",
        "sts",
        "saints",
        "bl",
        "blessed",
        "ven",
        "venerable",
        "our",
        "lady",
    }
)


# Token-level spelling unifications applied during normalization.
_TOKEN_SYNONYMS = {
    "mt": "mount",
}


def normalize_saint_name(value: Any) -> str:
    """Normalize a saint name for comparison.

    Lowercases, strips accents/diacritics, unifies "&" to "and", drops
    punctuation, and removes leading honorific tokens ("St.", "Saint",
    "Sts", ...). Returns a space-separated token string.
    """
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower().replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    tokens = [_TOKEN_SYNONYMS.get(token, token) for token in text.split() if token]
    while tokens and tokens[0] in _PREFIX_TOKENS:
        tokens.pop(0)
    return " ".join(tokens)


def normalize_saint_id(value: Any) -> str:
    """Normalize an identifier (contract id / saint id / romcal id)."""
    return normalize_saint_name(str(value or "").replace("_", " "))


SAINT_ALIAS_GROUPS: Tuple[Dict[str, Any], ...] = (
    {
        "saint": "Padre Pio",
        "canonical_contract_id": "st_padre_pio",
        "names": (
            "Padre Pio",
            "Padre Pio of Pietrelcina",
            "St. Pio of Pietrelcina",
            "St. Padre Pio",
            "St Padre Pio",
            "Saint Pius of Pietrelcina",
            "Saint Pius of Pietrelcina, Priest",
            "Pius Francesco Forgione",
        ),
        "ids": (
            "st_padre_pio",
            "pius_francesco_forgione_priest",
            "padre_pio",
            "padre_pio_of_pietrelcina",
            "pio_of_pietrelcina",
            "st_pio_of_pietrelcina",
        ),
    },
    {
        "saint": "St. Therese of Lisieux",
        "canonical_contract_id": "st_therese_of_lisieux_rose",
        "names": (
            "St. Therese of Lisieux",
            "St. Thérèse of Lisieux",
            "Therese of Lisieux",
            "St. Therese of Lisieux Rose",
            "St. Therese of the Child Jesus",
            "St. Thérèse of the Child Jesus",
            "Therese of the Child Jesus",
            "Saint Thérèse of the Child Jesus, Virgin and Doctor of the Church",
        ),
        "ids": (
            "st_therese_of_lisieux_rose",
            "therese_of_the_child_jesus_and_the_holy_face_of_lisieux_virgin",
            "therese_of_lisieux",
            "therese_of_the_child_jesus",
        ),
    },
    {
        "saint": "Sts. Perpetua and Felicity",
        "canonical_contract_id": "sts_perpetua_and_felicity",
        "names": (
            "Sts Perpetua and Felicity",
            "Saints Perpetua and Felicity, Martyrs",
            "Perpetua and Felicity of Carthage",
        ),
        "ids": (
            "sts_perpetua_and_felicity",
            "perpetua_of_carthage_and_felicity_of_carthage_martyrs",
        ),
    },
    {
        "saint": "St. Bernardine of Siena",
        "canonical_contract_id": "st_bernadine_of_siena",
        "names": (
            "St Bernadine of Siena",
            "St. Bernardine of Siena",
            "Saint Bernardine of Siena, Priest",
            "Bernardine of Siena",
        ),
        "ids": (
            "st_bernadine_of_siena",
            "st_bernardine_of_siena",
            "bernardine_of_siena_priest",
        ),
    },
    {
        "saint": "Our Lady of Mount Carmel",
        "canonical_contract_id": "our_lady_of_mt_carmel",
        "names": (
            "Our Lady of Mt. Carmel",
            "Our Lady of Mt Carmel",
            "Our Lady of Mount Carmel",
        ),
        "ids": (
            "our_lady_of_mt_carmel",
            "our_lady_of_mount_carmel",
        ),
    },
    {
        "saint": "St. Edith Stein (Teresa Benedicta of the Cross)",
        "canonical_contract_id": "st_edith_stein",
        "names": (
            "St Edith Stein",
            "Edith Stein",
            "Teresa Benedicta of the Cross",
            "Saint Teresa Benedicta of the Cross Stein, Virgin and Martyr",
        ),
        "ids": (
            "st_edith_stein",
            "teresa_benedicta_of_the_cross_stein_virgin",
            "teresa_benedicta_of_the_cross",
        ),
    },
    {
        "saint": "Sts. Cosmas and Damian",
        "canonical_contract_id": "sts_cosmas_and_damian",
        "names": (
            "Sts Cosmas and Damian",
            "Saints Cosmas and Damian, Martyrs",
            "Cosmas and Damian of Cilicia",
        ),
        "ids": (
            "sts_cosmas_and_damian",
            "cosmas_of_cilicia_and_damian_of_cilicia_martyrs",
        ),
    },
    {
        "saint": "St. Teresa of Avila",
        "canonical_contract_id": "st_teresa_of_avila",
        "names": (
            "St. Teresa of Avila",
            "St. Teresa of Jesus",
            "Teresa of Jesus of Avila",
            "Saint Teresa of Jesus, Virgin and Doctor of the Church",
        ),
        "ids": (
            "st_teresa_of_avila",
            "teresa_of_jesus_of_avila_virgin",
            "teresa_of_jesus",
        ),
    },
    {
        "saint": "North American Martyrs",
        "canonical_contract_id": "north_american_martyrs",
        "names": (
            "North American Martyrs",
            "Saints John de Brébeuf and Isaac Jogues, Priests, and Companions, Martyrs",
            "John de Brebeuf and Isaac Jogues and Companions",
        ),
        "ids": (
            "north_american_martyrs",
            "john_de_brebeuf_isaac_jogues_priests_and_companions_martyrs",
        ),
    },
    {
        # Same saint under a different transliteration: the traditional
        # contract uses "Charbel", the calendar (and its auto-materialized
        # short-form contract) uses "Sharbel Makhluf". No normalization
        # bridges the two spellings, so the pair is listed explicitly.
        "saint": "St. Charbel (Sharbel Makhluf)",
        "canonical_contract_id": "st_charbel",
        "names": (
            "St Charbel",
            "St. Charbel",
            "Charbel Makhluf",
            "Saint Sharbel Makhlūf, Priest",
            "Saint Sharbel Makhluf, Priest",
            "Sharbel Makhluf",
        ),
        "ids": (
            "st_charbel",
            "sharbel_makhluf_priest",
            "sharbel_makhluf",
        ),
    },
    {
        # The traditional contract titles the Nov 2 observance "Holy Souls
        # in Purgatory"; the calendar short-form contract carries the
        # calendar title "The Commemoration of All the Faithful Departed".
        # Same observance, same window, no shared name tokens.
        "saint": "All Souls (Holy Souls in Purgatory)",
        "canonical_contract_id": "holy_souls_in_purgatory",
        "names": (
            "Holy Souls in Purgatory",
            "The Commemoration of All the Faithful Departed (All Soul's Day)",
            "Commemoration of All the Faithful Departed",
            "All Souls Day",
            "All Soul's Day",
        ),
        "ids": (
            "holy_souls_in_purgatory",
            "commemoration_of_all_the_faithful_departed",
        ),
    },
)


def _build_indexes() -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    name_index: Dict[str, Dict[str, Any]] = {}
    id_index: Dict[str, Dict[str, Any]] = {}
    for group in SAINT_ALIAS_GROUPS:
        for name in group["names"]:
            key = normalize_saint_name(name)
            if key:
                name_index.setdefault(key, group)
        for identifier in group["ids"]:
            key = normalize_saint_id(identifier)
            if key:
                id_index.setdefault(key, group)
        # The canonical contract id itself always resolves to its group.
        canonical_key = normalize_saint_id(group["canonical_contract_id"])
        if canonical_key:
            id_index.setdefault(canonical_key, group)
    return name_index, id_index


_NAME_INDEX, _ID_INDEX = _build_indexes()


def alias_group_for_name(name: Any) -> Optional[Dict[str, Any]]:
    """Return the alias group for a saint name form, or None."""
    return _NAME_INDEX.get(normalize_saint_name(name))


def alias_group_for_id(identifier: Any) -> Optional[Dict[str, Any]]:
    """Return the alias group for a contract/saint/romcal id form, or None."""
    return _ID_INDEX.get(normalize_saint_id(identifier))


def canonical_contract_id(
    *,
    contract_id: Any = None,
    saint_id: Any = None,
    saint_name: Any = None,
) -> Optional[str]:
    """Resolve any name/id form of a known saint to its canonical contract id.

    Returns None when the saint is not in the alias table (callers then keep
    their existing behavior for that saint).
    """
    for identifier in (contract_id, saint_id):
        group = alias_group_for_id(identifier)
        if group is not None:
            return str(group["canonical_contract_id"])
    group = alias_group_for_name(saint_name)
    if group is not None:
        return str(group["canonical_contract_id"])
    return None


def canonical_saint_key(
    *,
    contract_id: Any = None,
    saint_id: Any = None,
    saint_name: Any = None,
) -> Optional[str]:
    """Identity key used to dedupe generation: the canonical contract id for
    aliased saints, else None (the caller's own id remains the identity)."""
    return canonical_contract_id(contract_id=contract_id, saint_id=saint_id, saint_name=saint_name)
