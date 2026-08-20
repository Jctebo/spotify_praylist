from __future__ import annotations

import datetime as _dt
import re
from typing import Any, Callable, Dict, Tuple

from jobs.publish.saint_centered_theme import build_saint_centered_theme_brief


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
        "saint_centered_theme_brief",
        "timezone",
        "saintWitness",
        "saintWitnessDate",
        "saintWitnessRank",
        "saintWitnessQuote",
        "saintWitnessQuoteSource",
        "saintWitnessQuoteSourceUrl",
        "primaryAnchorDate",
        "primaryAnchorRank",
        "primaryAnchorTiming",
        "selectionSource",
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
        "daily_theme_version": str(payload.get("sharedThemeVersion") or "shared-liturgical-theme-v2"),
        "saint_centered_theme_brief": payload.get("saint_centered_theme_brief") or {},
        "theme_timezone": str(payload.get("timezone") or "America/Chicago"),
        "primary_anchor_date": str(payload.get("primaryAnchorDate") or "").strip(),
        "primary_anchor_rank": str(payload.get("primaryAnchorRank") or "").strip(),
        "saint_witness": str(payload.get("saintWitness") or "").strip(),
        "saint_witness_date": str(payload.get("saintWitnessDate") or "").strip(),
        "saint_witness_rank": str(payload.get("saintWitnessRank") or "").strip(),
        "saint_witness_quote": str(payload.get("saintWitnessQuote") or "").strip(),
        "saint_witness_quote_source": str(payload.get("saintWitnessQuoteSource") or "").strip(),
        "saint_witness_quote_source_url": str(payload.get("saintWitnessQuoteSourceUrl") or "").strip(),
        "primary_anchor_timing": str(payload.get("primaryAnchorTiming") or "").strip(),
        "selection_source": str(payload.get("selectionSource") or "").strip(),
    }


def daily_theme_cache_key(target_date: _dt.date, config: Dict[str, Any]) -> Tuple[str, str, str, str]:
    calendar = str(config.get("calendar") or "general_roman").strip() or "general_roman"
    locale = str(config.get("locale") or "en").strip() or "en"
    timezone = str(config.get("timezone") or "America/Chicago").strip() or "America/Chicago"
    return (target_date.isoformat(), calendar, locale, timezone)


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
    timezone: str = "America/Chicago",
    context_builder: Callable[..., Any] = build_saint_centered_theme_brief,
) -> Dict[str, Any]:
    brief = context_builder(
        target_date,
        calendar=calendar or None,
        locale=locale or None,
        timezone=timezone or "America/Chicago",
    )
    payload = brief.to_dict() if hasattr(brief, "to_dict") else dict(brief)
    anchor = str(payload.get("primary_anchor") or "Ordinary Time prayer").strip()
    themes = list(payload.get("themes") or ["trustful perseverance"])
    season = str(payload.get("season") or "Ordinary Time").strip()
    title = " and ".join(str(item).capitalize() for item in themes[:2])
    runtime = {
        "date": target_date.isoformat(),
        "liturgicalSeason": season,
        "liturgicalWeek": "",
        "feastDay": anchor,
        "liturgicalRank": str(payload.get("primary_rank") or "weekday"),
        "primaryAnchorDate": str(payload.get("primary_anchor_date") or target_date.isoformat()),
        "primaryAnchorRank": str(payload.get("primary_rank") or "weekday"),
        "primaryAnchorTiming": str(payload.get("primary_anchor_timing") or ("today" if str(payload.get("primary_anchor_date") or target_date.isoformat()) == target_date.isoformat() else "upcoming")),
        "selectionSource": str(payload.get("selection_source") or ""),
        "saintOfDay": str(payload.get("saint_witness") or ""),
        "gospelTheme": "",
        "primaryTheme": themes[0],
        "secondaryThemes": themes[1:],
        "emotionalTone": "reverent and attentive",
        "reflectionFocus": str(payload.get("rationale") or payload.get("summary") or "Pray the approved theme through the day."),
        "suggestedImagery": [],
        "suggestedMusicMood": "reverent and spacious",
        "openingTone": "reverent and attentive",
        "closingTone": "peaceful trust",
        "saintIntercessions": [str(payload.get("saint_witness") or "")] if payload.get("saint_witness") else [],
        "shortSummary": str(payload.get("summary") or f"Today's anchor is {anchor}."),
        "source": "saint-centered-calendar-window",
        "fallbackReason": str(payload.get("fallback_reason") or ""),
        "gospelCitation": "",
        "calendar": calendar or "general_roman",
        "locale": locale or "en",
        "sharedThemeTitle": title or "Trustful Perseverance",
        "sharedThemeSlug": "-".join(themes[:2]).lower().replace(" ", "-"),
        "sharedThemeExplanation": str(payload.get("rationale") or ""),
        "sharedThemeTransition": f"Carrying today's approved focus of {title.lower() or 'trustful perseverance'}, we place this day before the Lord.",
        "sharedThemeReflectionFocus": str(payload.get("rationale") or "Pray the approved theme through the day."),
        "sharedGospelBridge": "",
        "sharedThemeSources": list(payload.get("window_items") or []),
        "sharedThemeVersion": str(payload.get("version") or "shared-liturgical-theme-v2"),
        "saint_centered_theme_brief": payload,
        "timezone": timezone or "America/Chicago",
        "saintWitness": str(payload.get("saint_witness") or ""),
        "saintWitnessDate": str(payload.get("saint_witness_date") or ""),
        "saintWitnessRank": str(payload.get("saint_witness_rank") or ""),
        "saintWitnessQuote": str(payload.get("saint_witness_quote") or ""),
        "saintWitnessQuoteSource": str(payload.get("saint_witness_quote_source") or ""),
        "saintWitnessQuoteSourceUrl": str(payload.get("saint_witness_quote_source_url") or ""),
    }
    return daily_theme_runtime_fields(runtime)


class DailyThemeRuntimeCache:
    def __init__(self, *, context_builder: Callable[..., Any] = build_saint_centered_theme_brief) -> None:
        self._values: Dict[Tuple[str, str, str, str], Dict[str, Any]] = {}
        self._context_builder = context_builder

    def get(self, target_date: _dt.date, config: Dict[str, Any]) -> Dict[str, Any]:
        key = daily_theme_cache_key(target_date, config)
        if key not in self._values:
            _date_iso, calendar, locale, timezone = key
            self._values[key] = build_canonical_daily_theme_runtime_context(
                target_date,
                calendar=calendar,
                locale=locale,
                timezone=timezone,
                context_builder=self._context_builder,
            )
        return copy_daily_theme_runtime_fields(self._values[key])
