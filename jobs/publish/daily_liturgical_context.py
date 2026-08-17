from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, Optional

from jobs.novena.liturgical_helpers import romcal_fetch_day
from jobs.publish.daily_intro import fetch_daily_gospel_context
from jobs.publish.saint_centered_theme import build_saint_centered_theme_brief

SAINT_FALLBACK = "Saint Ignatius of Loyola"
SHARED_THEME_VERSION = "saint-centered-theme-v1"


@dataclass(frozen=True)
class DailyLiturgicalContext:
    date: str
    liturgicalSeason: str
    liturgicalWeek: str
    feastDay: str
    liturgicalRank: str
    saintOfDay: str
    gospelTheme: str
    primaryTheme: str
    secondaryThemes: tuple[str, ...]
    emotionalTone: str
    reflectionFocus: str
    suggestedImagery: tuple[str, ...]
    suggestedMusicMood: str
    openingTone: str
    closingTone: str
    saintIntercessions: tuple[str, ...]
    shortSummary: str
    source: str
    fallbackReason: str = ""
    gospelCitation: str = ""
    calendar: str = "general_roman"
    locale: str = "en"
    sharedThemeTitle: str = ""
    sharedThemeSlug: str = ""
    sharedThemeExplanation: str = ""
    sharedThemeTransition: str = ""
    sharedThemeReflectionFocus: str = ""
    sharedGospelBridge: str = ""
    sharedThemeSources: tuple[Dict[str, str], ...] = ()
    sharedThemeVersion: str = "saint-centered-theme-v1"
    saintWitness: str = ""
    saintWitnessDate: str = ""
    saintWitnessRank: str = ""
    saintWitnessQuote: str = ""
    saintWitnessQuoteSource: str = ""
    saintWitnessQuoteSourceUrl: str = ""

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["secondaryThemes"] = list(self.secondaryThemes)
        payload["suggestedImagery"] = list(self.suggestedImagery)
        payload["saintIntercessions"] = list(self.saintIntercessions)
        payload["sharedThemeSources"] = [dict(item) for item in self.sharedThemeSources]
        return payload


def build_daily_liturgical_context(
    date_value,
    *,
    calendar: Optional[str] = None,
    locale: Optional[str] = None,
    allow_missing_gospel: bool = True,
    timezone: Optional[str] = None,
) -> DailyLiturgicalContext:
    brief = build_saint_centered_theme_brief(
        date_value,
        calendar=str(calendar or "general_roman").strip() or "general_roman",
        locale=str(locale or "en").strip() or "en",
        timezone=str(timezone or "America/Chicago").strip() or "America/Chicago",
        allow_missing_gospel=allow_missing_gospel,
        day_fetcher=romcal_fetch_day,
        gospel_fetcher=fetch_daily_gospel_context,
    )
    return _context_from_brief(brief)


def _context_from_brief(brief: Any) -> DailyLiturgicalContext:
    payload = brief.to_dict()
    themes = list(payload.get("themes") or ["trustful perseverance"])
    anchor = str(payload.get("primary_anchor") or "Ordinary Time prayer")
    season = str(payload.get("season") or "Ordinary Time")
    title = " and ".join(str(item).capitalize() for item in themes[:2]) or "Trustful Perseverance"
    saint = str(payload.get("saint_witness") or "").strip()
    rationale = str(payload.get("rationale") or brief.summary)
    return DailyLiturgicalContext(
        date=str(payload.get("target_date") or ""),
        liturgicalSeason=season,
        liturgicalWeek="",
        feastDay=anchor,
        liturgicalRank=str(payload.get("primary_rank") or "weekday"),
        saintOfDay=saint,
        gospelTheme="",
        primaryTheme=themes[0],
        secondaryThemes=tuple(themes[1:]),
        emotionalTone="reverent and attentive",
        reflectionFocus=rationale,
        suggestedImagery=(),
        suggestedMusicMood="reverent and spacious",
        openingTone="reverent and attentive",
        closingTone="peaceful trust",
        saintIntercessions=(saint,) if saint else (),
        shortSummary=str(brief.summary),
        source="saint-centered-calendar-window",
        fallbackReason=str(payload.get("fallback_reason") or ""),
        calendar=str(payload.get("calendar") or "general_roman"),
        locale=str(payload.get("locale") or "en"),
        sharedThemeTitle=title,
        sharedThemeSlug="-".join(themes[:2]).lower().replace(" ", "-"),
        sharedThemeExplanation=rationale,
        sharedThemeTransition=f"Carrying today's approved focus of {title.lower()}, we place this day before the Lord.",
        sharedThemeReflectionFocus=rationale,
        sharedThemeSources=tuple(payload.get("window_items") or ()),
        sharedThemeVersion=str(payload.get("version") or "saint-centered-theme-v1"),
        saintWitness=str(payload.get("saint_witness") or ""),
        saintWitnessDate=str(payload.get("saint_witness_date") or ""),
        saintWitnessRank=str(payload.get("saint_witness_rank") or ""),
        saintWitnessQuote=str(payload.get("saint_witness_quote") or ""),
        saintWitnessQuoteSource=str(payload.get("saint_witness_quote_source") or ""),
        saintWitnessQuoteSourceUrl=str(payload.get("saint_witness_quote_source_url") or ""),
    )
