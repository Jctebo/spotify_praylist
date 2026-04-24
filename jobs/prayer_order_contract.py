import re
from decimal import Decimal, InvalidOperation
from typing import Any, Optional


DEFAULT_TOP_LEVEL_ORDER_FALLBACK = 9999.0
_ORDER_RE = re.compile(r"[-+]?\d+(?:\.\d+)?")


def parse_top_level_order(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        try:
            return float(value)
        except Exception:
            return None
    text = str(value or "").strip()
    if not text:
        return None
    match = _ORDER_RE.search(text)
    if not match:
        return None
    try:
        return float(match.group(0))
    except Exception:
        return None


def top_level_order_sort_value(value: Any, default: float = DEFAULT_TOP_LEVEL_ORDER_FALLBACK) -> float:
    parsed = parse_top_level_order(value)
    return default if parsed is None else parsed


def format_top_level_order(value: Any) -> str:
    parsed = parse_top_level_order(value)
    if parsed is None:
        return ""
    try:
        decimal_value = Decimal(str(parsed))
    except (InvalidOperation, ValueError):
        return str(parsed)
    text = format(decimal_value.normalize(), "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"
