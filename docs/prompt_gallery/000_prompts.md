# Prompt Gallery

Use this single prompt when you want the AI to create the full documentation bundle from a human-authored request. You can pause the flow by editing or removing any `Continue to the next step.` line.

```text
Note: Put in Plan Mode first.

I have created `000_request.md`. Treat it as the human-authored source of truth and use the prompt gallery as the methodology for the full documentation workflow.

1. Convert the request into `001_requirements.md`.
Continue to the next step.

2. Research the code base using the requirements and create `002_research.md`.
Continue to the next step.

3. Turn the research into `003_plan.md`.
Continue to the next step.

4. Review the plan, ask any final questions, update `001_requirements.md` if needed, and implement according to `03_implement.md`.
Pause here and ask any critical questions before deployment

5. Update `004_progress.md` continuously during implementation and summarize the final outcome when finished.
```
