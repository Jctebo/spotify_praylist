from typing import FrozenSet

ALLOWED_DEVOTIONAL_RANKS: FrozenSet[str] = frozenset(
    {
        "optional_memorial",
        "memorial",
        "feast",
        "solemnity",
    }
)
EASTER_OCTAVE_PRECEDENCE_PREFIX = "Precedence.weekday_of_easter_octave_"


def devotional_output_is_eligible(celebration_rank: str, precedence: str) -> bool:
    rank = str(celebration_rank or "").strip()
    precedence_key = str(precedence or "").strip()
    if precedence_key.startswith(EASTER_OCTAVE_PRECEDENCE_PREFIX):
        return False
    return rank in ALLOWED_DEVOTIONAL_RANKS
