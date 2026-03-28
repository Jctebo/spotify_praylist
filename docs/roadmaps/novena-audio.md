# Roadmap: Novena Audio

## Summary Of Changes
- Novena work is moving onto its own audio roadmap so stabilization can stay focused on Morning Prayer.
- This roadmap starts with contract-based novena output, then configurable content for each day, then AI-driven generation after the contract is stable.
- The goal is to make novena a deliberate audio surface instead of an ad hoc side effect.

## Roadmap Mode
- Detailed roadmap

## Problem
- Novena content needs its own durable contract so the output shape is predictable from day to day.
- The content for each day needs to be configurable instead of hard-coded into one narrow path.
- Once the contract and content model are stable, AI can be layered in without turning the whole pipeline into a moving target.

## Audience
- Primary user: the maintainer who wants a dependable novena audio pipeline.
- Secondary stakeholders: listeners who benefit from a predictable novena experience.
- Secondary stakeholders: future collaborators who need clear separation between Morning Prayer stabilization and novena audio work.

## Current Status Quo
- The novena workflow is intentionally disabled while the rest of the prayer stack stabilizes.
- The existing novena generator still exists in the repo, but it is not yet organized around a dedicated contract-driven audio roadmap.
- Morning Prayer stabilization is now tracked separately, which gives this roadmap room to focus on novena-specific audio structure.

## What Already Exists
- `jobs/novena/generate_daily_novena_prayer.py` as the existing novena generation surface.
- The shared liturgical helper boundary introduced by `0.1.3.2`.
- Existing Notion, OneDrive, and prayer-artifact patterns that can inform the contract shape.

## Sequencing Principles
- Build the contract first so the novena output has a stable shape before any smarter generation logic is added.
- Make day content configurable before introducing AI so operators can tune the output without changing the whole pipeline.
- Add AI only after the contract and configurable content path are boring and predictable.

## Release Overview
- Release 1: Contract-Based Novena Shell
- Release 2: Configurable Day Content
- Release 3: AI-Driven Novena Generation

## Release 1: Contract-Based Novena Shell

### Goal
- Define novena as a contract-first audio surface with stable day slots and predictable outputs.

### Scope
- In scope:
- Define the novena audio contract shape.
- Establish the day-by-day output structure.
- Decide how the novena output is named, validated, and handed off to downstream consumers.
- Keep the contract simple enough that later content changes do not force a redesign.
- Explicitly deferred:
- AI generation of novena text.
- Broad Morning Prayer stabilization work.
- RSS or other public publication surfaces.

### Why This Release Now
- The contract needs to exist before content logic can become configurable or AI-assisted.
- A stable shell reduces the chance that later changes will keep shifting the output shape.

### Research Notes
- `jobs/novena/generate_daily_novena_prayer.py` already has the core novena logic that can anchor the new contract.
- Existing prayer artifact patterns in the repo show how OneDrive and Notion boundaries are handled elsewhere.

### Plan
- Define the contract boundary first.
- Keep the initial implementation as close as possible to the current novena surface while making the day structure explicit.
- Validate that the shell can be reasoned about independently of content generation strategy.

### Features
- Stable novena contract schema.
- Explicit day-by-day novena structure.
- Clear output naming and validation rules.

### Stories
- As the maintainer, I want a novena contract with clear day slots, so I can reason about the output without opening the generator.
- As the operator, I want the shell to be predictable, so later content changes do not break the overall shape.

### Dependencies
- Existing novena generation code.
- The shared liturgical helper boundary from `0.1.3.2`.

### Risks
- The contract could become too abstract if it tries to solve content and AI at the same time.
- If the shell is not explicit enough, later content changes will still feel like ad hoc patching.

### Exit Criteria
- The novena contract has a stable shape.
- The day slots and output boundaries are documented.
- The shell can be validated without AI-generated text.

## Release 2: Configurable Day Content

### Goal
- Make novena content configurable on a per-day basis while keeping the contract stable.

### Scope
- In scope:
- Allow different content to be supplied for different novena days.
- Support manual or template-driven content selection.
- Keep the contract from Release 1 unchanged unless a real incompatibility is discovered.
- Explicitly deferred:
- AI-generated novena text.
- New distribution surfaces.
- Full Morning Prayer integration unless it is needed to keep the audio output coherent.

### Why This Release Now
- Configurable content is the bridge between a static shell and a more intelligent generator.
- It lets the maintainer control the prayer text before AI becomes part of the production path.

### Research Notes
- The repo already has prayer fragment and intention patterns that may be reusable for day-based content selection.
- The novena generator and page-audio code both show how content can be assembled from smaller pieces.

### Plan
- Add day-level configuration without widening the contract boundary.
- Keep configuration understandable enough that a human can override or inspect each day.
- Validate that content can vary by day while the shell remains stable.

### Features
- Configurable day-by-day novena content.
- Manual or template-driven content selection.
- Contract-preserving content overrides.

### Stories
- As the maintainer, I want to control each novena day's content, so the output can adapt to feast days, themes, or special needs.
- As the operator, I want configurable content instead of one fixed script, so I can tune the novena without touching the contract.

### Dependencies
- Release 1's stable novena shell.
- Existing novena generator and content assembly logic.

### Risks
- Content configuration can become messy if it is not bounded by the contract.
- Too much flexibility too early could make validation harder instead of easier.

### Exit Criteria
- Day-specific novena content can be configured.
- The stable contract from Release 1 still holds.
- The selected content is observable and repeatable.

## Release 3: AI-Driven Novena Generation

### Goal
- Add AI-driven novena generation on top of the stable contract and configurable content model.

### Scope
- In scope:
- Use AI to generate or adapt novena content within the established contract.
- Keep configurable content as the fallback or override path.
- Update tests and docs to reflect the AI-assisted generation path.
- Explicitly deferred:
- Rebuilding the contract shape from scratch.
- Generalizing AI to unrelated prayer surfaces.

### Why This Release Now
- AI is most useful once the contract and content model already tell it where to fit.
- This keeps AI from becoming the thing that defines the output shape.

### Research Notes
- The repo already uses OpenAI-based generation in other prayer paths.
- The novena pipeline can reuse that experience, but should keep the contract boundary in charge.

### Plan
- Introduce AI only where it clearly improves the novena content layer.
- Preserve the configurable content path so operators are not locked into a single generated answer.
- Validate that AI output still fits the established day-based structure.

### Features
- AI-assisted novena content generation.
- Contract-aware content fitting.
- Configurable fallback or override behavior.

### Stories
- As the maintainer, I want AI to help generate novena content, so the pipeline can scale without hard-coding every day.
- As the operator, I want a manual override path to remain available, so AI output does not become a single point of failure.

### Dependencies
- Release 1's stable novena contract.
- Release 2's configurable content layer.
- A validated AI model and prompt strategy for novena generation.

### Risks
- AI could drift away from the intended novena tone if the prompt and contract are too loose.
- If the fallback path is weak, AI issues could create avoidable downtime.

### Exit Criteria
- AI can generate novena content inside the established contract.
- Manual/configurable content still works as a fallback or override.
- The output remains stable enough to ship with confidence.

## Cross-Cutting Risks
- The novena roadmap can drift into a broad content generator if the contract boundaries are not respected.
- AI-generated content introduces tone and quality risks that are different from structural pipeline bugs.
- Shared liturgical helpers should stay shared, but not become a place where every future prayer surface piles in.

## Assumptions And Unknowns
- Fact: `jobs/novena/generate_daily_novena_prayer.py` is the existing novena implementation surface.
- Fact: `0.1.3.2` already established the shared helper boundary that novena can reuse.
- Fact: the dedicated novena audio roadmap is now separate from stabilization.
- Unknown: the final contract shape for novena days and content sources.
- Unknown: the exact AI prompt and model strategy that should power the generated content.
- Unknown: whether the novena output will ultimately remain Morning Prayer-adjacent or become a fully separate audio product.

## Recommended Next Step
- Move Release 1 into `/plan-astack` first.
- The contract shell is the foundation for both configurable content and AI generation.
