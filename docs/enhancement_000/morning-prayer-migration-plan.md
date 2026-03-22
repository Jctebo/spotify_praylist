# Morning Prayer Migration Plan

Snapshot date: March 17, 2026

Status: Planning only. No functional changes were made.

Planning note:
- This document follows the DeepWiki planning-phase style: convert research into an implementation blueprint with exact files, phased work, testing strategy, review gates, and verification criteria.
- Research input: `docs/morning-prayer-audio-composition-research.md`
- Reference: https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.2-planning-phase

## Problem Summary

Morning Prayer rendered as novenas only on March 17, 2026 because the live `Morning Prayer` `Opus Dei` row is only linked to one active detailed fragment: `Daily Novena Audio`.

The active runtime in `jobs/notion/generate_page_audio.py` now builds Morning Prayer from the two-list `Opus Dei` + `Detailed Fragments` model, not from the older `MORNING_PRAYER_OUTPUT -> morning-prayer-wrapper -> MORNING_PRAYER_PAGE_AUDIO` path.

The older Morning Prayer fragment rows still exist in Notion, but they are orphaned:
- they have no `Opus Dei Item` relation to the live `Morning Prayer` row
- the active runtime ignores them
- the current `Text Sync Mode = page_content` setting then syncs novena-only content back into the page body

This is primarily a migration-completeness problem, not an audio-generation problem.

## Approach

Canonical direction:
- keep Morning Prayer on the two-list `Opus Dei` + `Detailed Fragments` model
- finish the migration instead of restoring the legacy builder as the primary path

Key implementation principles:
- treat owner-linked detailed fragments as the only runtime source of truth
- do not trust the current Morning Prayer page body as a recovery source because it is already degraded
- relink existing Morning Prayer legacy rows where possible instead of creating duplicate fragment rows
- fail closed if Morning Prayer resolves to a novena-only fragment set
- add regression coverage before or alongside live migration

## Phase 1: Define The Migration Contract

Goal:
- define the exact Morning Prayer fragment inventory that must exist after migration

Files:
- `docs/morning-prayer-audio-composition-research.md`
- `docs/notion-detailed-fragments-views.md`
- `scripts/migrate_page_audio_notion_schema.py`

Required fragment set:
1. `Morning Offering`
2. `Daily Consecration`
3. `Baptismal Renewal`
4. `Petitions Intro`
5. petition fragments
6. `Monthly Intention`
7. `Daily Novena Audio`
8. `Intercessory Litany`

Required metadata for each fragment:
- `Opus Dei Item` -> `Morning Prayer`
- `Order` matching intended prayer order
- `Assembly Role = append`
- `Fragment Kind`
  - `text` for static prayers
  - `monthly_intention` for the monthly intention row
  - `daily_novena_audio` for the novena row

Verification:
- compare the final required set against the legacy `Morning Prayer Sequence`
- confirm the ordering contract before any live writes

## Phase 2: Repair The Migration Script

Goal:
- make the migration complete the Morning Prayer owner-link migration instead of preserving a partial state

Primary file:
- `scripts/migrate_page_audio_notion_schema.py`

Primary code paths:
- `migrate_page_rows(...)`
- `morning_prayer_fragment_values_from_legacy_output(...)`
- `morning_prayer_fragment_values_from_page(...)`
- `find_owned_fragment_page(...)`
- `upsert_fragment_pages(...)`

Planned changes:
1. Prefer migration from the legacy fragment/output sequence for `Morning Prayer`.
2. Reuse and relink ownerless legacy Morning Prayer rows when titles and kinds match instead of creating duplicate fragment rows.
3. Preserve canonical `Order`, `Fragment Kind`, `Assembly Role`, and notes when relinking.
4. Prevent the migration from silently falling back to `morning_prayer_fragment_values_from_page(...)` when the live page body is already novena-only.
5. If fallback from the page body is still retained for disaster recovery, gate it behind an explicit condition and never let it override a valid legacy-derived fragment set.

Important constraint:
- the current page body is not a reliable reconstruction source for the static Morning Prayer sections

Verification:
- dry-run output should show the full Morning Prayer fragment inventory
- dry-run output should not produce a one-fragment novena-only result
- dry-run output should not imply duplicate Morning Prayer fragment creation when matching orphaned legacy rows already exist

## Phase 3: Add Migration Preflight Validation

Goal:
- stop incomplete Morning Prayer migrations before they write live data

Primary file:
- `scripts/migrate_page_audio_notion_schema.py`

Planned checks:
- fail or emit a hard warning if Morning Prayer resolves to only `Daily Novena Audio`
- fail or emit a hard warning if no static text fragments are present
- fail or emit a hard warning if required canonical fragments are missing
- flag duplicate candidates where relinking should happen instead of creation

Suggested output:
- explicit list of missing fragments
- explicit list of rows being relinked
- explicit list of rows that would be created

Verification:
- dry-run should be reviewable without inspecting Notion manually row by row

## Phase 4: Add Runtime Guardrails

Goal:
- prevent bad Morning Prayer data from silently producing valid-but-wrong output again

Primary file:
- `jobs/notion/generate_page_audio.py`

Candidate code paths:
- `build_opus_dei_two_list_plan(...)`
- `normalize_plan_for_row_text_sync(...)`
- `sync_page_content_blocks(...)`
- `main()`

Planned changes:
1. Add Morning Prayer-specific validation that checks the resolved fragment set before assembly.
2. Reject a relation set that contains only `daily_novena_audio` or otherwise lacks required static sections.
3. Fail before `page_content` sync so the page body is not overwritten with novena-only content.
4. Emit a clear operational error message that points to incomplete detailed-fragment migration.

Verification:
- Morning Prayer should fail closed with a clear error when the fragment set is incomplete
- no page-content sync should run for invalid Morning Prayer plans

## Phase 5: Add Regression Coverage

Goal:
- cover the exact failure mode from March 17, 2026

Primary files:
- `tests/test_migrate_page_audio_schema.py`
- `tests/test_page_audio_job.py`

Planned tests:
1. Migration test:
   - simulate ownerless Morning Prayer legacy fragments plus a live `Morning Prayer` row
   - verify the migration relinks the full set instead of leaving only novena active
2. Migration anti-duplication test:
   - verify existing matching legacy rows are reused instead of duplicated
3. Runtime guard test:
   - verify Morning Prayer assembly rejects a novena-only two-list relation set
4. Two-list integration test:
   - verify a correct Morning Prayer fragment set yields static text fragments plus monthly intention plus daily novena
5. Text-sync safety test:
   - verify invalid Morning Prayer plans do not proceed to page-content replacement

Verification:
- targeted test runs pass locally for both migration and runtime paths

## Phase 6: Dry-Run And Review Gate

Goal:
- review the plan output before any live Notion writes

Files and commands:
- `scripts/migrate_page_audio_notion_schema.py`

Review checklist:
- Morning Prayer resolves to the full required fragment set
- `Order` values match intended assembly order
- `Monthly Intention` and `Daily Novena Audio` are present as typed special fragments
- static prayer rows are owner-linked to `Morning Prayer`
- no unexpected duplicate fragment rows are proposed
- migration notes clearly identify relinked rows

Why this is a hard gate:
- per the planning-phase model, mistakes here amplify into both runtime output and page-content sync behavior

## Phase 7: Live Apply And Runtime Verification

Goal:
- apply the repaired migration and confirm the live pipeline behaves correctly

Primary files:
- `scripts/migrate_page_audio_notion_schema.py`
- `jobs/notion/generate_page_audio.py`
- `.github/workflows/daily_novena_prayer.yml`

Execution sequence:
1. snapshot current Morning Prayer row and related fragment rows
2. run migration in dry-run mode and review output
3. run migration in apply mode
4. rerun `jobs/notion/generate_page_audio.py`
5. verify the resulting Morning Prayer audio plan and page body

Required live verification:
- Morning Prayer has the full related detailed-fragment set
- assembled audio includes static prayer content, monthly intention, and today's novena sections
- page body again contains the static Morning Prayer sections plus generated novena toggles
- Morning Prayer no longer collapses to novena-only output on rerun

## Phase 8: Documentation Cleanup

Goal:
- remove documentation drift after the migration is complete

Primary files:
- `README.md`
- `docs/notion-detailed-fragments-views.md`
- optionally `docs/morning-prayer-audio-composition-research.md` with follow-up status notes

Planned updates:
- stop describing the legacy Morning Prayer path as if it is the active runtime
- document the two-list Morning Prayer source of truth
- document any migration safeguards or operational checks added during this fix

Optional cleanup after verification:
- retire or clearly mark legacy wrapper/sequence rows if they are no longer part of the active operational model

## Testing Strategy

Minimum local verification:
- run targeted migration tests in `tests/test_migrate_page_audio_schema.py`
- run targeted Morning Prayer runtime tests in `tests/test_page_audio_job.py`

Minimum live verification:
- dry-run migration output review
- apply migration
- rerun page-audio generation
- inspect resulting Morning Prayer fragment relations and page body

Success condition:
- both automated tests and live Notion state agree that Morning Prayer is fully represented in the two-list model

## Risks And Considerations

Risk:
- the current page body is already degraded
Mitigation:
- do not use page-body fallback as the primary migration path

Risk:
- duplicate fragment creation could make the detailed-fragment table harder to reason about
Mitigation:
- relink matching orphaned rows instead of creating new ones when possible

Risk:
- text sync can destroy remaining manual content if validation runs too late
Mitigation:
- validate before assembly and before page-content sync

Risk:
- README and Notion docs still point people toward legacy assumptions
Mitigation:
- update docs after migration succeeds

## Acceptance Criteria

The work is complete when all of the following are true:

1. `Morning Prayer` owns a full detailed-fragment set in the two-list model.
2. The active relation set includes static Morning Prayer fragments, `Monthly Intention`, and `Daily Novena Audio`.
3. The migration script relinks orphaned Morning Prayer rows instead of leaving them ownerless.
4. The migration script does not silently preserve or recreate a novena-only Morning Prayer configuration.
5. The runtime fails closed when Morning Prayer is missing required static fragments.
6. Regression tests cover the migration bug and the runtime guard behavior.
7. A live rerun restores Morning Prayer audio composition and page-content sync to the expected full prayer structure.

## Open Follow-Ups

1. After migration succeeds, should the old `Morning Prayer` collection rows, wrapper, and sequence be retired to reduce confusion?
2. Should a reusable QA command be added to compare owner-linked detailed fragments against legacy sequence expectations for other migrated prayers?
3. Should Morning Prayer keep `Text Sync Mode = page_content` long-term, or should that mode be narrowed if content loss risk remains high?
