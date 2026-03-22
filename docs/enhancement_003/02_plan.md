# Plan

## Summary
- Build a synthetic Romcal child calendar that inherits from the selected calendar id and applies the special-Sunday normalization rules we need.
- Keep Romcal as the calendar engine, but make the inherited overlay the app-facing calendar view.
- Propagate Easter Octave as a special pseudo-rank, `solemnity-easter octave`, so the devotional-image checker can distinguish it from an ordinary solemnity.
- Keep the Sunday normalization table explicit and id-based; special Sunday solemnities that already come back correctly, such as Pentecost and Christ the King, should stay regression checks instead of being forced into the overlay.
- Keep the Sunday audit list explicit: `Second Sunday after the Nativity of the Lord`, `Sunday of the Word of God`, `Divine Mercy Sunday`, `Palm Sunday`, `Pentecost Sunday`, and `Our Lord Jesus Christ, King of the Universe`.
- This plan is chosen because it keeps the Sunday classification rule explicit, uses Romcal’s existing inheritance model, and avoids broad changes to unrelated calendar behavior.

## What Already Exists
- `jobs/novena/generate_daily_novena_prayer.py` already owns the shared Romcal helpers:
  - `build_romcal`
  - `romcal_year_calendar`
  - `romcal_year_mass_calendar`
  - `romcal_fetch_day`
  - `collect_saints_window`
  - `collect_calendar_days_window`
  - `infer_celebration_rank`
  - `infer_precedence`
- `jobs/novena/generate_devotional_image.py` already has a single calendar-candidate path with a simple rank allowlist.
- `jobs/novena/sync_liturgical_calendar.py` already reuses the shared collectors, so it will inherit any fix applied in the shared calendar helper.
- The installed Romcal package supports `CalendarDefinition.parent_calendar_ids` and `DayDefinition.days_definitions`, which makes a child overlay the natural implementation shape.
- The current tests already isolate the calendar helpers enough that we can add focused regression coverage without a large harness rewrite.

## Architecture
- Use a synthetic child calendar definition built at runtime inside the shared Romcal helper.
  - The child calendar inherits from the user-selected calendar id, not just `general_roman`, so regional calendars continue to work.
  - The child calendar only carries the override rows we actually need.
- Normalize special Easter Octave precedence in one shared rank helper.
  - If `precedence` starts with `Precedence.weekday_of_easter_octave_`, return the pseudo-rank `solemnity-easter octave`.
  - Ordinary ranks remain unchanged.
- Distinguish ordinary Sundays from special Sundays using the celebration `id` and `precedence`, not the raw `rank_name` field.
- Let the downstream jobs consume the same shared rank view.
  - The novena collector path writes the normalized rank into the shared collector output.
  - The devotional-image selector accepts the pseudo-rank in its allowlist and candidate filter.

ASCII flow:

```text
selected Romcal calendar
        |
        v
synthetic child overlay
  - special Sundays -> solemnity
  - Easter Octave weekdays -> solemnity-easter octave
        |
        v
shared fetch / collector helpers
        |
        +----------------------+
        |                      |
        v                      v
 downstream sync         devotional image selector
 / export                - accepts solemnity-easter octave
                         - still allows ordinary solemnities
```

## Concrete Changes
- `jobs/novena/generate_daily_novena_prayer.py`
  - extend `build_romcal` so it constructs a synthetic child calendar definition on top of the resolved base calendar id
  - add explicit normalization rows for the named special Sundays that need rank correction, starting with `palm_sunday_of_the_passion_of_the_lord`, `divine_mercy_sunday`, and `easter_sunday`
  - keep Christmas as a regression guard, not a behavior change, because baseline Romcal already returns it as `solemnity`
  - keep special Sunday solemnities such as Pentecost and Christ the King out of the normalization table unless a later probe proves they are misclassified
  - add a small helper that marks named special Sundays as `solemnity` while leaving ordinary numbered Sundays alone
  - update `infer_celebration_rank` so Easter Octave precedence maps to `solemnity-easter octave`
  - keep `infer_precedence` unchanged
  - leave the rest of the collector logic intact
- `jobs/novena/generate_devotional_image.py`
  - replace the local rank normalization with the shared rank helper or an equivalent wrapper around it
  - add `solemnity-easter octave` to the devotional rank allowlist
  - make sure `collect_image_candidates_window` keeps ordinary solemnities unchanged while allowing the new pseudo-rank
- `tests/test_novena_job.py`
  - add tests for the inherited Romcal overlay
  - prove the named special Sundays return `solemnity` through the helper
  - prove ordinary numbered Sundays still stay `Sunday`
  - prove Christmas stays unchanged
  - prove a known special Sunday solemnity like Pentecost or Christ the King remains a regression check, not a forced override
  - prove Easter Octave precedence normalizes to the pseudo-rank
- `tests/test_devotional_image_job.py`
  - add tests proving the special Easter Octave rank is admitted by the selector
  - add tests proving an ordinary solemnity still produces a candidate
  - add tests proving the selector does not regress on ordinary rank filtering
- `README.md`
  - document the inherited Romcal overlay and the special Easter Octave pseudo-rank
  - note that Christmas is already solemnity in baseline Romcal and is only a regression guard

## UX And States
- No UI scope.
- Success state: all calendar-driven jobs read the same inherited Romcal view, special Sundays appear as solemnities, and Easter Octave is surfaced as a distinct pseudo-rank.
- Empty state: if a date window has no matching celebrations, the jobs behave as they do today and simply produce no candidate rows.
- Error state: if the child calendar cannot be constructed or the override day ids are wrong, the jobs fail fast with a clear Romcal error instead of silently falling back to the unmodified calendar.

## Implementation Phases
### Phase 1: Inherited Romcal overlay
- Goal
  - build the synthetic child calendar and apply the Sunday-normalization overrides
- Exact files to edit
  - `jobs/novena/generate_daily_novena_prayer.py`
- Symbols/interfaces touched
  - `build_romcal`
  - `romcal_year_calendar`
  - `romcal_year_mass_calendar`
  - `romcal_fetch_day`
- Change summary
  - create a child `CalendarDefinition` that inherits from the selected calendar id
  - add the normalization rows for the named special Sundays
  - keep the rest of the collector behavior unchanged
- Verification steps or commands
  - `py -3 -m unittest tests.test_novena_job`
  - spot-check `2026-03-29`, `2026-04-05`, and `2026-12-25` through the helper
- Rollback note
  - remove the child overlay and return `build_romcal` to the bundled-definition baseline if the normalization shape proves incorrect
- Dependencies on earlier phases
  - none

### Phase 2: Easter Octave pseudo-rank propagation
- Goal
  - carry Easter Octave precedence through the shared rank helper and the devotional-image selector
- Exact files to edit
  - `jobs/novena/generate_daily_novena_prayer.py`
  - `jobs/novena/generate_devotional_image.py`
- Symbols/interfaces touched
  - `infer_celebration_rank`
  - `collect_calendar_days_window`
  - `_normalized_rank` or its replacement
  - `DEVOTIONAL_ALLOWED_RANKS`
  - `collect_image_candidates_window`
- Change summary
  - map `Precedence.weekday_of_easter_octave_*` to `solemnity-easter octave`
  - allow the pseudo-rank in the devotional image allowlist
  - keep ordinary solemnities and feasts on the existing path
- Verification steps or commands
  - unit tests show Easter Octave weekdays get the pseudo-rank
  - unit tests show a normal solemnity still passes the filter
  - unit tests show the selector does not accidentally drop the octave rows
- Rollback note
  - remove the pseudo-rank mapping and restore the original rank filter if it catches the wrong rows
- Dependencies on earlier phases
  - Phase 1

### Phase 3: Regression coverage and docs
- Goal
  - lock the new behavior into tests and documentation so the override layer stays obvious
- Exact files to edit
  - `tests/test_novena_job.py`
  - `tests/test_devotional_image_job.py`
  - `README.md`
- Symbols/interfaces touched
  - inherited Romcal overlay tests
  - rank-normalization tests
  - devotional candidate-selection tests
  - calendar job documentation sections
- Change summary
  - add tests for the named special Sundays, Christmas, and Easter Octave
  - document the inherited overlay and the pseudo-rank
  - keep the docs consistent with the actual calendar behavior used by the jobs
- Verification steps or commands
  - `py -3 -m unittest tests.test_novena_job`
  - `py -3 -m unittest tests.test_devotional_image_job`
  - `.\scripts\run_local_tests.ps1`
- Rollback note
  - docs and tests can be updated independently if the implementation shape changes
- Dependencies on earlier phases
  - Phases 1-2

## Failure Modes
- Child calendar inherits the wrong parent id
  - detection: Romcal build error or the override tests still show raw ranks
  - user experience: the jobs keep emitting the unmodified calendar
- Override day ids or date definitions are wrong
  - detection: special Sundays still report the original rank
  - user experience: the calendar remains inconsistent for the exact dates the user cares about
- Easter Octave pseudo-rank is not whitelisted in the image selector
  - detection: unit tests for octave rows fail or the selector produces no candidate
  - user experience: Easter Octave disappears from the devotional-image pipeline
- The pseudo-rank is normalized in one place but not another
  - detection: sync/export tests and image-selector tests disagree on the same date
  - user experience: the repo drifts back into mixed calendar behavior

## QA And Test Matrix
- Unit tests
  - `py -3 -m unittest tests.test_novena_job`
  - `py -3 -m unittest tests.test_devotional_image_job`
- Full offline regression
  - `.\scripts\run_local_tests.ps1`
- Critical flows to verify
  - special Sundays resolve as `solemnity` through the inherited Romcal overlay
  - ordinary numbered Sundays remain `Sunday`
  - Christmas stays `solemnity`
  - Pentecost and Christ the King stay correct without widening the normalization table
  - Easter Octave weekdays resolve to `solemnity-easter octave`
  - ordinary solemnities outside Easter Time still generate devotional-image candidates
- Edge cases
  - the override layer works for the selected base calendar id, not only `general_roman`
  - the selector still dedupes repeated celebrations on the same day
  - empty calendar windows do not crash the jobs
- Manual date checks
  - `2026-03-29` for Palm Sunday
  - `2026-04-05` through `2026-04-11` for Easter Octave
  - `2026-12-25` for Christmas regression coverage

## Rollout Notes
- No feature flag is needed.
- Ship the inherited overlay and the pseudo-rank normalization together so the repo does not mix raw and overridden Romcal behavior.
- `sync_liturgical_calendar.py` will pick up the change through the shared collectors, and `export_liturgical_ics.py` will reflect whatever the sync job writes.
- Keep Christmas as a regression guard so we notice if the overlay accidentally changes already-correct fixed solemnities.
- Keep Pentecost and Christ the King as regression checks so the normalization list does not grow just because they are important Sundays.

## Not In Scope
- Rewriting the liturgical ranking model.
- Changing monthly devotion generation, image rendering, or file naming.
- Touching playlist refresh or unrelated OneDrive sync behavior.

## Open Questions
- Whether any additional celebration ids should be added to the explicit normalization table after the first pass of live verification.
- Whether the special pseudo-rank should stay exactly as `solemnity-easter octave` in persisted rows, or be normalized differently for any downstream consumer that needs a slug.
