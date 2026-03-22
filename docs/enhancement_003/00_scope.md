# Enhancement 003 Scope

Snapshot date: March 21, 2026

Status: Working scope for a Romcal inheritance overlay, special-Sunday normalization, and Easter Octave pseudo-rank.

## Problem
- Calendar-driven jobs should keep using Romcal, but not the raw bundled calendar alone.
- The user wants a thin inheritance layer that can normalize special Sundays without replacing the calendar engine.
- Two behaviors need to change together, but they are still separate:
  - special-Sunday normalization to `solemnity` when a Sunday is not just a plain numbered seasonal Sunday
  - an Easter Octave pseudo-rank that bypasses the generic checker logic
- Special Sunday cases already identified for normalization or regression coverage are:
  - `Second Sunday after the Nativity of the Lord`
  - `Sunday of the Word of God`
  - `Divine Mercy Sunday`
  - `Palm Sunday of the Passion of the Lord`
  - `Pentecost Sunday`
  - `Our Lord Jesus Christ, King of the Universe`
- Palm Sunday is the clearest mismatch already proven in the repo: raw Romcal treats it as `Sunday`, while the rule should surface it as `solemnity`.
- Easter Sunday also needs the overlay hook because the current Romcal output does not surface it as `solemnity` in the way the project expects.
- Christmas is already returned as `solemnity` by baseline Romcal, so it is a regression target rather than a behavior change.
- Why now: the calendar outputs feed daily novenas, devotional images, and the liturgical calendar sync/export path, so one consistent overlay layer will prevent the repo from drifting again.

## Audience
- Primary user: the maintainer who runs the daily novena and devotional image workflows and wants predictable liturgical output.
- Secondary stakeholders: anyone consuming the generated OneDrive devotional images, the Notion Liturgical Calendar rows, and future maintainers who need the rule to stay obvious in code.

## Current Status Quo
- `jobs/novena/generate_daily_novena_prayer.py` builds Romcal directly from bundled definitions/resources with no overlay.
- `jobs/novena/generate_devotional_image.py` reads the Romcal window directly and filters candidates by rank only.
- `jobs/novena/sync_liturgical_calendar.py` reuses the shared collectors from the novena job, so it inherits whatever Romcal data those helpers return.
- `collect_image_candidates_window` currently trusts `rank_name` / `rank` and knows nothing about an Easter Octave special case.
- The current code does not yet distinguish a normal Sunday from a special Sunday by `rank_name` alone; the stronger signal is `precedence` plus the celebration `id`.
- The current code already has a shared `infer_celebration_rank` helper, which makes this a good place to normalize special Sunday logic once and reuse it everywhere.

## Goal
- Build one inherited Romcal overlay that sits on top of the selected calendar and normalizes special Sundays.
- Keep Romcal as the source of calendar computation, but make the overlay the authoritative app-facing view for Sunday classification.
- Add one explicit Easter Octave pseudo-rank, `solemnity-easter octave`, so the checkers can distinguish it from an ordinary solemnity.
- Normalize special Sundays to `solemnity` when they do not follow the basic numbered seasonal Sunday pattern.
- Success criteria:
  - special Sundays like Palm Sunday and Divine Mercy Sunday return `solemnity` through the overlay.
  - Easter Octave weekdays are surfaced with the special pseudo-rank instead of being treated like a generic solemnity.
  - Christmas stays a solemnity and continues to act as a regression guard.
  - special Sunday solemnities that already resolve correctly, such as Pentecost and Christ the King, stay correct.
  - Ordinary solemnities, feasts, memorials, and optional memorials continue to behave as they do today.

## Constraints
- Preserve the existing rank behavior for the rest of the calendar.
- Keep the overlay layer small enough that the current image rendering, dedupe, manifest writing, and sync/export logic do not need to be rewritten.
- Prefer one shared calendar helper so every calendar-driven workflow reads the same inherited Romcal view.

## Narrow Wedge
- Add a synthetic child calendar definition that inherits from the selected Romcal calendar and applies the few required Sunday-normalization overrides.
- Normalize Easter Octave precedence to `solemnity-easter octave` in one shared rank helper.
- Keep the special handling separate from the ordinary celebration pipeline so the rest of the app continues to read standard ranks unchanged.

## Non-Goals
- Reworking the entire liturgical ranking model.
- Hard-coding title matching for every holiday.
- Touching playlist refresh, OneDrive sync, or image rendering behavior outside the calendar selection rule.
- Introducing a feature flag or rollout split for the override layer.

## Risks And Unknowns
- The override calendar must inherit the resolved calendar id, not just `general_roman`, or regional calendars could drift.
- Computed days like Easter Octave may need the exact Romcal day ids and date definitions to override cleanly.
- The pseudo-rank string is not a Romcal enum value, so it has to live in app-level normalization code.
- Sunday rows cannot be classified from `rank_name` alone; the implementation needs to key off `id` and `precedence` to tell ordinary Sundays from special Sundays.
- If the repo starts treating every Sunday as a rewrite target, the overlay will grow too broad; the plan should keep the explicit normalization list narrow and use regression coverage for the rest.
- If the normalization list is incomplete, the repo could still show mixed behavior across calendar-driven jobs.
- Christmas already matches the desired rank in baseline Romcal, so it should be guarded by a regression test rather than treated as a fix.

## Recommended Next Step
- Use `/research-astack` on the Romcal inheritance surface, the current `build_romcal` / collector helpers, and the rank filter in the devotional image selector to decide the exact Sunday-normalization table and shared pseudo-rank handling before planning implementation.
