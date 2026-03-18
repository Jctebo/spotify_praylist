# Run Planning

You are entering the Planning phase.

## Canonical references
- https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.2-planning-phase
- https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.1-research-phase

## Inputs
- /specs/00_requirements.md
- /specs/01_research.md

## Output
Write /specs/02_plan.md

## Mission
Convert the research artifact into a precise, step-by-step implementation plan that can guide implementation with minimal ambiguity.

## Planning priorities
1. Exact file paths
2. Exact symbols to modify
3. Independent verifiable phases
4. Explicit tests / verification
5. Rollback notes
6. No implementation code

## Planning constraints
- Do not write code.
- Do not include raw research logs.
- Do not include rejected alternatives unless essential context.
- Be concrete enough that another agent could implement from this plan in a fresh context.

## Required structure for /specs/02_plan.md

# Implementation Plan

## Metadata
- Project:
- Task:
- Date:
- Planner:
- Status: Draft

## Source references
- Requirements: /specs/00_requirements.md
- Research: /specs/01_research.md
- DeepWiki:
  - https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.2-planning-phase
  - https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.1-research-phase

## Goal
State exactly what this plan will accomplish.

## Chosen approach
Describe the selected implementation approach in 1–3 short paragraphs.

## Files to modify
For each file:
- exact path
- why it changes
- key symbols affected

## Files to create
For each file:
- exact path
- purpose

## Files to verify but not modify
For each file:
- exact path
- what to confirm

## Phase breakdown

### Phase 1: [name]
Objective:
Files:
Symbols:
Changes to make:
Verification:
Rollback / recovery:
Risks:

### Phase 2: [name]
Objective:
Files:
Symbols:
Changes to make:
Verification:
Rollback / recovery:
Risks:

### Phase 3: [name]
Objective:
Files:
Symbols:
Changes to make:
Verification:
Rollback / recovery:
Risks:

[Add more phases as needed; prefer 5–10 phases total for non-trivial work.]

## Dependency and sequencing notes
Explain phase ordering, dependencies, and any gating conditions.

## Test strategy
### Unit
- exact commands
- expected coverage area

### Integration
- exact commands
- systems touched

### Manual verification
- exact scenarios
- expected results

### Performance / safety checks
- exact checks to run if relevant

## Edge cases to validate
- 
- 
- 

## Non-goals during implementation
- 
- 
- 

## Plan quality self-check
- Are all file paths exact? Yes/No
- Are all major symbols named? Yes/No
- Can each phase be verified independently? Yes/No
- Is there any implementation code that should be removed? Yes/No
- Could a fresh agent implement from this alone? Yes/No

## Exit recommendation
- Ready for implementation: Yes/No
- If No, what needs to change?

## Final instruction
After writing /specs/02_plan.md, stop.
Do not implement in the same step unless explicitly instructed.