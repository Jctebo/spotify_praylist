# Publish Audio Feed Retention Architecture

## Problem And Scope
The podcast publish pipeline is losing older episodes on rerun because the archive source is too fragmented.

The simplest complete fix is to treat the published `podcast.xml` feed as the source of truth for history, and stop relying on sidecar files as archive inputs.

## Current Shape
Today the audio publish flow does this:
1. Render the current target-date audio jobs.
2. Rebuild the RSS feed from current jobs plus the previously published `podcast.xml`.
3. Upload the generated `docs/` tree to GitHub Pages.

The weak point is step 2. History only survives if the runner can reconstruct it from the published feed file. That keeps the archive boundary simple, but it still depends on the feed being available when the job runs.

## Target Shape
The recommended shape is:

1. Keep `podcast.xml` as the only archive input.
2. Render the current slice in memory.
3. Merge the current slice with the previously published feed items.
4. Write the full XML document back out.

This makes the archive boundary easy to reason about: the feed is the history.

## Components

### Publish Runner
- Owns current-day and next-day episode rendering.
- Writes the current slice into `docs/audio/` and refreshes `docs/podcast.xml`.
- Should not decide whether history exists; it should assume the feed file was loaded first.

### Feed Archive
- Lives in `podcast.xml`.
- Contains the previously published RSS items.
- Acts as the durable source of truth for append behavior.

### RSS Merge Helper
- Keeps the current dedupe and sort behavior.
- Merges the current slice with the archive feed contents.
- Audio publish should fail closed if the remote archive feed cannot be recovered, rather than silently publishing a truncated feed.
- Novena can still consume the in-workspace feed as a same-run handoff after the audio step has written it.

### Deploy Step
- Publishes the final `docs/` tree to GitHub Pages.
- Does not need a separate archive database or sidecar history source.

## Data Flow
```text
main branch workflow run
    |
    +--> checkout current code
    +--> render current audio slice
    +--> load existing podcast.xml
    +--> merge archive feed + current slice
    +--> write docs/podcast.xml and docs/audio/*
    +--> upload updated docs/ tree
```

## Deployment And Operational Assumptions
- GitHub Pages remains the hosting layer, but the published content is sourced from the existing feed file rather than a second storage system.
- The workflow should serialize publish runs so two runs do not try to rewrite the feed at the same time.
- The main repository stays clean: contracts, code, and tests live on `main`; generated outputs live in `docs/`.

## Why This Is Simpler
This avoids three brittle pieces at once:
- no sidecar-based archive recovery
- no need for a second storage system or database
- no separate branch to mirror the published history

It also keeps the mental model easy:
- `podcast.xml` says what the archive is
- the publish job merges new items into that one file

## Tradeoffs
- The feed file is still a single point of failure if the runner cannot read or fetch it.
- The workflow must preserve the feed file before rewriting it, which is simpler than a database but still requires discipline.

These tradeoffs are still preferable to a sidecar archive because they are explicit and reviewable.

## Risks
- Concurrent publish runs could race to rewrite `podcast.xml` unless the workflow is serialized.
- A bad publish run could publish a truncated feed if the job does not preserve the existing items first.
- If the published feed cannot be recovered, the archive still collapses to the current run only.

## Open Questions
- Should a missing archive feed fail the job immediately, or retry once before failing?
- Should the remote archive fetch retry once before the audio step fails closed?

## Recommended Next Step
Run `/plan-astack` on the feed-only archive approach so we can define the exact read/merge/write sequence before implementation.
