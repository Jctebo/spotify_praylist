from __future__ import annotations

import datetime as _dt
import re
from typing import Any, Callable, Dict, Tuple

from jobs.publish.daily_liturgical_context import build_daily_liturgical_context


def _normalize_key(value: Any) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower())).strip("-")


def _humanize_slug(value: Any) -> str:
    text = re.sub(r"[_-]+", " ", str(value or "").strip())
    text = re.sub(r"\s+", " ", text).strip()
    return " ".join(part.capitalize() for part in text.split())


def daily_liturgical_context_to_payload(context: Any) -> Dict[str, Any]:
    if context is None:
        return {}
    if isinstance(context, dict):
        return dict(context)
    to_dict = getattr(context, "to_dict", None)
    if callable(to_dict):
        try:
            return dict(to_dict())
        except Exception:
            pass
    keys = (
        "date",
        "liturgicalSeason",
        "liturgicalWeek",
        "feastDay",
        "liturgicalRank",
        "saintOfDay",
        "gospelTheme",
        "primaryTheme",
        "secondaryThemes",
        "emotionalTone",
        "reflectionFocus",
        "suggestedImagery",
        "suggestedMusicMood",
        "openingTone",
        "closingTone",
        "saintIntercessions",
        "shortSummary",
        "source",
        "fallbackReason",
        "gospelCitation",
        "calendar",
        "locale",
        "sharedThemeTitle",
        "sharedThemeSlug",
        "sharedThemeExplanation",
        "sharedThemeTransition",
        "sharedThemeReflectionFocus",
        "sharedGospelBridge",
        "sharedThemeSources",
        "sharedThemeVersion",
    )
    return {key: getattr(context, key) for key in keys if hasattr(context, key)}


def daily_theme_runtime_fields(payload: Dict[str, Any]) -> Dict[str, Any]:
    title = str(payload.get("sharedThemeTitle") or _humanize_slug(payload.get("primaryTheme", "")) or "Trust").strip()
    slug = str(payload.get("sharedThemeSlug") or _normalize_key(title)).strip() or "trust"
    explanation = str(payload.get("sharedThemeExplanation") or payload.get("shortSummary") or f"Today's focus is {title}.").strip()
    transition = str(
        payload.get("sharedThemeTransition")
        or f"Carrying today's focus of {title.lower()}, we place ourselves and the needs of this day before the Lord."
    ).strip()
    reflection_focus = str(payload.get("sharedThemeReflectionFocus") or payload.get("reflectionFocus") or explanation).strip()
    gospel_bridge = str(payload.get("sharedGospelBridge") or "").strip()
    sources = payload.get("sharedThemeSources") or []
    return {
        "daily_liturgical_context": payload,
        "daily_theme_title": title,
        "daily_theme_slug": slug,
        "daily_theme_explanation": explanation,
        "daily_theme_transition": transition,
        "daily_theme_reflection_focus": reflection_focus,
        "daily_gospel_bridge": gospel_bridge,
        "daily_gospel_citation": str(payload.get("gospelCitation") or "").strip(),
        "daily_gospel_theme": str(payload.get("gospelTheme") or "").strip(),
        "daily_theme_sources": sources,
        "daily_theme_version": str(payload.get("sharedThemeVersion") or "daily-theme-v1"),
    }


def daily_theme_cache_key(target_date: _dt.date, config: Dict[str, Any]) -> Tuple[str, str, str]:
    calendar = str(config.get("calendar") or "general_roman").strip() or "general_roman"
    locale = str(config.get("locale") or "en").strip() or "en"
    return (target_date.isoformat(), calendar, locale)


def copy_daily_theme_runtime_fields(fields: Dict[str, Any]) -> Dict[str, Any]:
    copied = dict(fields)
    context = copied.get("daily_liturgical_context")
    if isinstance(context, dict):
        context_copy = dict(context)
        context_sources = context_copy.get("sharedThemeSources")
        if isinstance(context_sources, list):
            context_copy["sharedThemeSources"] = [
                dict(item) if isinstance(item, dict) else item for item in context_sources
            ]
        copied["daily_liturgical_context"] = context_copy
    sources = copied.get("daily_theme_sources")
    if isinstance(sources, list):
        copied["daily_theme_sources"] = [dict(item) if isinstance(item, dict) else item for item in sources]
    return copied


def build_canonical_daily_theme_runtime_context(
    target_date: _dt.date,
    *,
    calendar: str,
    locale: str,
    context_builder: Callable[..., Any] = build_daily_liturgical_context,
) -> Dict[str, Any]:
    try:
        context = context_builder(
            target_date,
            calendar=calendar or None,
            locale=locale or None,
            allow_missing_gospel=False,
        )
    except Exception:
        context = context_builder(
            target_date,
            calendar=calendar or None,
            locale=locale or None,
            allow_missing_gospel=True,
        )
    return daily_theme_runtime_fields(daily_liturgical_context_to_payload(context))


class DailyThemeRuntimeCache:
    def __init__(self, *, context_builder: Callable[..., Any] = build_daily_liturgical_context) -> None:
        self._values: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
        self._context_builder = context_builder

    def get(self, target_date: _dt.date, config: Dict[str, Any]) -> Dict[str, Any]:
        key = daily_theme_cache_key(target_date, config)
        if key not in self._values:
            _date_iso, calendar, locale = key
            self._values[key] = build_canonical_daily_theme_runtime_context(
                target_date,
                calendar=calendar,
                locale=locale,
                context_builder=self._context_builder,
            )
        return copy_daily_theme_runtime_fields(self._values[key])
