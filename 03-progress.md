# Progress

## Status
- Complete

## Checklist
- [x] Build a synthetic Romcal child calendar on top of the selected calendar id
- [x] Normalize named special Sundays to `solemnity`
- [x] Map Easter Octave weekdays to `solemnity-easter octave`
- [x] Update the devotional image selector to accept the pseudo-rank
- [x] Add regression tests for special Sundays, Easter Octave, and ordinary solemnities
- [x] Run the focused verification suite
- [x] Update the progress note with final results

## Completed Work
- Added a synthetic Romcal overlay child calendar that inherits from the requested calendar and applies the explicit special-Sunday rows.
- Centralized celebration-rank normalization so the shared novena collectors and the devotional image selector both see the same app-facing rank view.
- Expanded the devotional image candidate allowlist to keep Easter Octave entries eligible.
- Added regression tests for the overlay calendar, named special Sundays, Easter Octave, Christmas, Pentecost, Christ the King, and ordinary Sundays.

## Deviations
- The shared rank helper now performs the final special-Sunday normalization as well, because the installed Romcal 4.0.0b6 build does not consistently honor a precedence-only child override for every computed Sunday row.

## Blockers
- None.

## Verification
- `py -3 -m unittest tests.test_novena_job`
- `py -3 -m unittest tests.test_devotional_image_job`
- Both focused suites passed locally.

## Follow-Ups
- Run the focused novena and devotional-image unit tests.
- Refresh the progress note with the actual verification results.
