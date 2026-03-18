# Research

## Metadata
- Project: spotify_praylist
- Task: bug_002 daily novena legacy prefetch cleanup
- Date: March 18, 2026
- Researcher: Codex
- Status: Draft

## Source references
- Requirements: `docs/bug_002/001_.md`
- DeepWiki:
  - https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.1-research-phase
  - https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/2-core-concepts-and-terminology

## Objective of research
Identify how the daily novena workflow prefetches OneDrive audio libraries, why the legacy novena backfill path produces missing-root noise, and what the smallest safe cleanup looks like without changing the primary audio mirror behavior.

## Relevant files

- `.github/workflows/daily_novena_prayer.yml`
  - Purpose: workflow_dispatch and scheduled daily novena orchestration.
  - Relevance: contains the prefetch step that currently attempts both the primary and legacy novena audio roots.

- `README.md`
  - Purpose: runtime documentation for novena and OneDrive environment variables.
  - Relevance: documents `AUDIO_ONEDRIVE_REMOTE_ROOT` and `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT`.

- `docs/bug_001/004_progress.md`
  - Purpose: latest progress note from the prior novena cleanup work.
  - Relevance: records the remote run that surfaced the legacy-root log noise.

- `scripts/run_daily_novena_prayer_local.ps1`
  - Purpose: local runner wrapper for the daily novena workflow logic.
  - Relevance: shows the novena job is driven by env vars and can inherit the same configuration locally.

## Relevant symbols and responsibilities

- `AUDIO_ONEDRIVE_REMOTE_ROOT` in `.github/workflows/daily_novena_prayer.yml` and `README.md`
  - Role: points the workflow at the primary `Praylist Audio` OneDrive root.

- `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT` in `.github/workflows/daily_novena_prayer.yml` and `README.md`
  - Role: optional legacy root for old `Pictures/Samsung Gallery/DCIM`-based backfills.

- `Prefetch Audio Libraries from OneDrive` step in `.github/workflows/daily_novena_prayer.yml`
  - Role: copies current novena audio trees into the local `onedrive_sync` workspace before generation.

- `rclone copy` in the prefetch step
  - Role: mirrors remote source trees locally.

## Architecture and flow

The workflow currently prefetches two roots before the novena generation job runs:

1. the current primary `Praylist Audio/Novena Audio Library`
2. a legacy `Pictures/Samsung Gallery/DCIM/Novena Audio Library` fallback path

The run log showed the legacy path does not exist in the current environment, so the unconditional fallback copy produces repeated `rclone` errors. Because the step ends with `|| true`, the job still continues, but the logs are noisy and the fallback behavior is misleading when no one is actually using that legacy tree.

The safer behavior is to treat the legacy path as opt-in:

- if `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT` is set, copy it
- if it is unset, skip the legacy prefetch entirely

That preserves the current primary audio sync behavior while removing the false error condition.

## Patterns and conventions

- Optional env vars should be no-ops when blank, not hard-coded fallback paths.
- The workflow already uses `AUDIO_ONEDRIVE_REMOTE_ROOT` as the authoritative primary root.
- Existing shell steps prefer explicit environment-driven branching instead of hidden assumptions.

## Constraints and dependencies

- The workflow runs in GitHub Actions on `ubuntu-latest`.
- `rclone copy` returns non-zero when a source root is missing, which is why the unconditional legacy copy emits errors.
- The fix must not change the primary `Praylist Audio` prefetch or the later `rclone sync` upload steps.
- Backward compatibility matters only for explicit legacy backfill usage, not for a default path that nobody is configuring anymore.

## Potential approaches

1. Skip the legacy copy unless `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT` is set.
   - Summary: make the legacy path explicitly opt-in.
   - Pros: simplest, removes log noise, matches the assumption that the legacy root is optional.
   - Cons: if someone relied on the hidden default, they will need to set the env var explicitly.
   - Compatibility with existing patterns: high.

2. Keep the fallback path but suppress or ignore the error output.
   - Summary: continue attempting the legacy copy but hide the failure.
   - Pros: minimal shell change.
   - Cons: preserves the wrong behavior and masks misconfiguration.
   - Compatibility with existing patterns: weak.

3. Probe the remote source before copying.
   - Summary: check whether the legacy source exists, then copy only when present.
   - Pros: robust against missing roots.
   - Cons: more shell complexity than necessary for an optional path.
   - Compatibility with existing patterns: acceptable, but more complicated than needed.

## Key findings

- The primary novena audio mirror is already healthy; the noisy part is only the legacy backfill attempt.
- The legacy `Pictures/Samsung Gallery/DCIM` path should be treated as optional migration support, not as a default.
- The smallest safe fix is to stop invoking the legacy copy when no legacy root is configured.

## Risks

- Risk: an existing migration workflow might still depend on the implicit fallback.
  - Why it matters: that workflow would need to set `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT` explicitly after the change.
  - Possible mitigation: document the env var clearly and keep the path available when set.

- Risk: a silent skip could make missing configuration less visible.
  - Why it matters: users might not realize the legacy backfill is disabled.
  - Possible mitigation: log a clear "legacy prefetch skipped" message when the env var is unset.

## Unknowns / assumptions to validate

- Whether anyone still relies on the legacy backfill path without setting `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT`.
- Whether the README should describe the legacy root as deprecated, optional, or migration-only.

## Recommendation for planning

Patch the workflow so the legacy prefetch branch only runs when `DEVOTIONAL_ONEDRIVE_REMOTE_ROOT` is explicitly configured, and update the README to describe the legacy path as optional migration support. This removes the missing-root noise without altering the primary novena pipeline.

## Research quality self-check
- Is every major claim tied to an observed file/pattern? Yes
- Are critical files likely missing? No
- Is there implementation detail that should be removed? No
- Can a human review this quickly? Yes

## Exit recommendation
- Ready for planning: Yes
- If No, what additional research is needed?

