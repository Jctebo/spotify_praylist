# Research

## Scope Baseline
- We are scoping a Romcal inheritance overlay, not a switch to another calendar source.
- The goal is to correct a few named celebrations while keeping Romcal as the calendar engine.
- Easter Octave still needs a separate special-case signal so the devotional-image checker can treat it differently from a normal solemnity.
- Palm Sunday is the concrete mismatch already confirmed in the repo: raw Romcal returns `Sunday`, but the overlay should surface it as `solemnity`.
- Divine Mercy Sunday is also part of the special-Sunday normalization set.
- Easter Sunday is part of the special overlay too, while Christmas is already a baseline solemnity and mainly needs regression coverage.
- Divine Mercy Sunday should also be treated as a special Sunday normalization case, not as a plain seasonal Sunday.
- Other Sunday-shaped celebrations that deserve explicit audit in the docs are `Second Sunday after the Nativity of the Lord`, `Sunday of the Word of God`, `Divine Mercy Sunday`, `Pentecost Sunday`, and `Our Lord Jesus Christ, King of the Universe`.
- Major Sunday solemnities such as Pentecost and Christ the King already come back as solemnities in the Romcal probes we ran, so they are regression checks rather than new normalization targets.
- Normal Sundays and special Sundays can be separated reliably with `precedence` plus the celebration `id`; `rank_name` alone is too coarse because every Sunday still looks like `Sunday`.

## Relevant Files
- `jobs/novena/generate_daily_novena_prayer.py`
  - Owns the shared Romcal helpers, including `build_romcal`, `romcal_fetch_day`, `collect_saints_window`, `collect_calendar_days_window`, `infer_celebration_rank`, and `infer_precedence`.
  - Best place to add the inherited overlay and the pseudo-rank normalization once, then let other jobs reuse it.
- `jobs/novena/generate_devotional_image.py`
  - Primary candidate-selection path for devotional images.
  - Contains the direct rank filter that must recognize the Easter Octave pseudo-rank.
- `jobs/novena/sync_liturgical_calendar.py`
  - Reuses the shared collectors from the novena job, so it will inherit the override layer if the shared helpers change correctly.
- `tests/test_novena_job.py`
  - Existing coverage for the shared collectors and orchestration flow.
  - Good place to pin the new inherited calendar behavior.
- `tests/test_devotional_image_job.py`
  - Current test surface for the devotional-image selector and manifest/render behavior.
  - Needs coverage for the special Easter Octave rank.
- `README.md`
  - Documents the calendar jobs and the rank/selection conventions users rely on.
- `requirements.txt`
  - Confirms the project is pinned to `romcal==4.0.0b6`, so the planning can rely on the current API surface.

## Current System Map
- `build_romcal(calendar, locale)` currently instantiates `Romcal` directly with bundled calendar definitions and bundled resources.
- The Romcal package in `site-packages` exposes a real inheritance model:
  - `CalendarDefinition.parent_calendar_ids`
  - `CalendarDefinition.days_definitions`
  - `DayDefinition.precedence`
  - `DayDefinition.drop`
  - `DayDefinition.allow_similar_rank_items`
- Built-in calendars already use inheritance chains, so a synthetic child calendar is a normal Romcal shape, not a hack.
- A local probe confirmed that a child calendar inheriting from `general_roman` can override Palm Sunday’s precedence and surface `rank_name=solemnity`.
- Probes across 2026 and 2027 showed that special Sunday solemnities such as Pentecost and Christ the King already surface as `solemnity`, while ordinary Sundays remain `Sunday` and Easter Octave weekdays surface as `solemnity` via their special precedence.
- `collect_image_candidates_window` currently:
  - calls `romcal_fetch_day`
  - normalizes `rank_name` / `rank`
  - only keeps `solemnity`, `feast`, `memorial`, and `optional_memorial`
- `collect_calendar_days_window` and `collect_saints_window` already call the shared `infer_celebration_rank` helper, which makes them good carriers for a new special rank string.
- `sync_liturgical_calendar.py` does not need its own calendar logic if the shared collectors return the overridden rows.
- `export_liturgical_ics.py` will reflect whatever the sync job writes into Notion, so the calendar consistency problem is upstream of export.

## Reuse Opportunities
- `build_romcal` can be extended instead of replaced.
- `infer_celebration_rank` already centralizes rank normalization and can become the home for the Easter Octave pseudo-rank.
- The current `romcal_fetch_day` / collector flow can stay intact, which keeps the rest of the jobs simple.
- The existing tests already isolate the collector logic enough that we can add focused regression coverage without a large harness rewrite.
- The bundled Romcal definitions and resources are enough to build a synthetic child calendar at runtime.

## External References
- Romcal `CalendarDefinition` and `DayDefinition` types in the installed `romcal==4.0.0b6`.
- Romcal `Rank` enum values are fixed and do not include a custom `solemnity-easter octave` member.
- Romcal `Precedence` enum includes `weekday_of_easter_octave_2`, which is the clean signal for the Easter Octave weekday cases.
- Romcal inheritance is modeled through `parent_calendar_ids`, not by mutating the base calendar in place.

## Constraints
- Any special-rank behavior for Easter Octave must be represented as an app-level string, because Romcal does not support inventing a new enum value.
- The override calendar should be anchored to the selected calendar id so regional calendars still inherit the same fix layer.
- Overriding computed days may require the exact Romcal day ids and matching date definitions, not just title text.
- Christmas already returns `solemnity` in baseline Romcal, so it should be treated as a regression check rather than a required behavior change.
- The image selector will ignore a special rank unless the allowlist and filter logic are updated together.
- Sunday normalization should key off `precedence` and `id`, because a special Sunday and a normal Sunday both present as `Sunday` in the raw rank field.

## Risks
- If the override calendar is built with the wrong parent id, regional calendars could silently drift from the intended behavior.
- If the day ids or date definitions are wrong, Romcal will leave the original rank in place and the fix will appear to work only for some dates.
- If the Easter Octave pseudo-rank is normalized in one place but not another, the sync and image jobs will diverge again.
- The current selector only looks at rank, so a new pseudo-rank must be deliberately whitelisted or it will disappear.
- The local probe showed that the override surface is real, but computed-day overrides may need fuller definitions than fixed-date saints.
- Over-extending the Sunday normalization list would be worse than missing a regression check, because many Sundays are intentionally ordinary and should remain that way.

## Assumptions To Validate
- The override child should inherit whatever calendar the user selects, not just `general_roman`.
- The named special Sundays should be normalized together, with Christmas remaining a no-op regression target.
- The Easter Octave pseudo-rank should be persisted through the sync/export path, not only used inside the image selector.
- The canonical special-rank string should be `solemnity-easter octave`, unless a downstream consumer forces a different normalization.
- Pentecost and Christ the King should remain regression checks, not explicit overrides, unless a future probe shows Romcal misclassifying them.
- Divine Mercy Sunday should be included in the special-Sunday normalization set.

## Unknowns
- Whether any additional major celebrations need explicit normalization rows beyond the currently identified special Sunday set.
- Whether the Easter Octave pseudo-rank should be emitted only for devotional-image selection or also written into Notion and exported to ICS.
- Whether the override day definitions need `drop`, `allow_similar_rank_items`, or custom entities in addition to precedence changes for any computed feast.
- Whether any future Sunday classifications need a shared helper that returns `special_sunday`, or whether explicit ids plus precedence checks are enough for the lifetime of this repo.

## Recommended Direction
- Proceed to `/plan-astack` with a synthetic child Romcal calendar that inherits from the selected calendar id, plus a shared app-level rank helper that normalizes special Sundays to `solemnity` and maps Easter Octave precedence to `solemnity-easter octave`.
- Keep the normalization table explicit and day-id based so Palm Sunday, Divine Mercy Sunday, and the other named special Sundays can be handled without title matching.
- Treat Pentecost, Christ the King, and other already-correct Sunday solemnities as regression checks, not as new normalization targets.
- Add regression tests that prove:
  - the overridden calendar returns the named special Sundays as solemnities
  - Christmas remains unchanged
  - Easter Octave weekdays surface with the special pseudo-rank and still flow through the shared collectors
