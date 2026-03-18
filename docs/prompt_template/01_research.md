# Run Research

You are entering the Research phase.

## Canonical references
- https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.1-research-phase
- https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/2-core-concepts-and-terminology

## Inputs
- /specs/00_requirements.md
- repository contents
- linked issues/docs if provided

## Output
Write /specs/01_research.md

## Mission
Transform the requirements and codebase into a compact, structured understanding of the relevant parts of the system.

## Research priorities
1. Correctness
2. Completeness
3. Noise reduction

## Mandatory research tasks
1. Identify all relevant files.
2. Identify the main symbols, modules, and boundaries involved.
3. Trace the relevant data flow or control flow.
4. Identify existing patterns and conventions that should be followed.
5. Identify dependencies, constraints, and edge cases.
6. Identify plausible implementation approaches only at a high level.
7. Surface unknowns and assumptions explicitly.

## Research constraints
- Do not write implementation code.
- Do not create a detailed step-by-step implementation plan here.
- Do not dump raw logs, giant grep output, or long code excerpts.
- Prefer compact summaries over transcripts.
- If using noisy exploration, isolate it and only return distilled findings.

## Required structure for /specs/01_research.md

# Research

## Metadata
- Project:
- Task:
- Date:
- Researcher:
- Status: Draft

## Source references
- Requirements: /specs/00_requirements.md
- DeepWiki:
  - https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/3.1-research-phase
  - https://deepwiki.com/humanlayer/advanced-context-engineering-for-coding-agents/2-core-concepts-and-terminology

## Objective of research
Restate what this research is trying to discover.

## Relevant files
For each file:
- path
- purpose
- relevance to task

## Relevant symbols and responsibilities
For each symbol:
- exact name
- location
- role

## Architecture and flow
Describe the relevant runtime flow, data flow, or control flow.

## Patterns and conventions
Document the local codebase patterns that implementation should follow.

## Constraints and dependencies
List technical dependencies, sequencing constraints, migrations, feature flags, config, permissions, etc.

## Potential approaches
List 1–3 viable approaches at high level only.
For each:
- summary
- pros
- cons
- compatibility with existing patterns

## Key findings
List the most important discoveries that planning must respect.

## Risks
- Risk:
- Why it matters:
- Possible mitigation:

## Unknowns / assumptions to validate
- 
- 
- 

## Recommendation for planning
State the recommended approach that planning should elaborate.

## Research quality self-check
- Is every major claim tied to an observed file/pattern? Yes/No
- Are critical files likely missing? Yes/No
- Is there implementation detail that should be removed? Yes/No
- Can a human review this quickly? Yes/No

## Exit recommendation
- Ready for planning: Yes/No
- If No, what additional research is needed?

## Final instruction
After writing /specs/01_research.md, stop.
Do not create the plan in the same step unless explicitly instructed.