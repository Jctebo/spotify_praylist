# Run Implementation

You are entering the Implementation phase.

## Canonical references
- https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/1-overview
- https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/2-core-concepts-and-terminology
- https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.2-planning-phase

## Inputs
- /specs/02_plan.md
- /specs/00_requirements.md
- /specs/01_research.md (reference only when needed)

## Outputs
- code changes
- /specs/03_progress.md updated continuously

---

# Phase Entry: Plan Mode

You will first enter **Plan Mode** before any implementation begins.

## Plan Mode Objectives
- Validate that the plan is complete and executable
- Surface any remaining ambiguity
- Ensure alignment before writing code

## Plan Mode Instructions

1. Carefully review:
   - /specs/00_requirements.md
   - /specs/01_research.md
   - /specs/02_plan.md

2. Ask any **final questions** needed before execution:
   - Missing requirements
   - Ambiguous plan steps
   - Unclear file paths or symbols
   - Risky assumptions
   - External dependencies or permissions

3. If questions exist:
   - List them clearly and concisely
   - STOP and wait for answers before proceeding

4. If no questions exist:
   - Explicitly state: "Plan is clear. Ready for execution."

---

# Pre-Execution Step: Document Alignment

After all questions are answered:

You must update documentation BEFORE writing code.

## Required updates
- Refine /specs/02_plan.md if clarifications changed execution details
- Initialize /specs/03_progress.md with:
  - metadata
  - initial phase
  - execution starting point

## Rules
- Do not begin coding until docs reflect the final plan
- Ensure a fresh agent could resume from the updated docs alone

---

# Execution Phase

## Mission
Execute the approved plan step by step, verifying each phase before moving on.

## Mandatory implementation rules
- Follow /specs/02_plan.md exactly unless blocked
- If blocked or deviation is necessary:
  - update /specs/02_plan.md OR
  - record deviation in /specs/03_progress.md BEFORE continuing
- After each completed phase:
  - write a compact progress update
- Run exact verification steps from the plan
- Do not skip tests
- Do not silently change architecture

---

# Required structure for /specs/03_progress.md

# Progress

## Metadata
- Project:
- Task:
- Date:
- Implementer:
- Status: In Progress

## Source references
- Requirements: /specs/00_requirements.md
- Research: /specs/01_research.md
- Plan: /specs/02_plan.md
- DeepWiki:
  - https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/1-overview
  - https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/2-core-concepts-and-terminology
  - https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.2-planning-phase

## Current goal
State the phase currently being executed.

## Completed phases
### Phase N
- What was changed:
- Files touched:
- Verification run:
- Result:
- Notes:

## Current phase
- Objective:
- Planned actions:
- Blockers:
- Risks:

## Deviations from plan
- Deviation:
- Why:
- Impact:
- Follow-up required:

## Test results summary
- Command:
- Result:
- Notes:

## Resume instructions for fresh agent
Provide a short, high-signal summary that lets a fresh agent continue.

---

# Execution Loop

FOR each phase in /specs/02_plan.md:
1. Execute phase
2. Run verification
3. Record results in /specs/04_progress.md
4. Confirm phase completion before continuing

---

# Final Instruction

- Do not begin coding until Plan Mode is complete and documentation is updated.
- Maintain strict alignment between plan, progress, and implementation.
- Continuously compact state so a fresh agent can resume from artifacts alone.