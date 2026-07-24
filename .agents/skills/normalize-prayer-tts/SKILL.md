---
name: normalize-prayer-tts
description: Audit and normalize Catholic prayer, liturgy, devotional, and novena text for text-to-speech. Use when preparing plain text or JSON audio contracts, removing print-only speech artifacts, expanding saint or clergy abbreviations, converting intention instructions into bell/pause cues, separating Versicle and Response into role-specific voices, or reviewing text that sounds unnatural when narrated.
---

# Normalize Prayer TTS

Turn printed prayer text into ordered spoken segments without changing the prayer's meaning. Prefer structured roles, cues, and pauses over stage directions embedded in TTS prose.

## Workflow

1. Identify the target:
   - For repository contracts, determine whether the source uses publish blocks, novena `blocks`, legacy novena `sections`, or plain text.
   - If both novena `blocks` and `sections` exist, keep them synchronized or stop and flag the mismatch risk.
2. Read [references/conventions.md](references/conventions.md).
3. Run the preview:

   ```powershell
   python .agents/skills/normalize-prayer-tts/scripts/normalize_prayer_tts.py <path> --format auto
   ```

   Use `--no-bell` only when the user does not want an intention bell. Use `--strict` when unresolved review findings should fail validation.
4. Classify every finding:
   - Apply high-confidence transformations.
   - Preserve prayer prose and ambiguous text.
   - Present review-only removals and ambiguities to the user.
5. Map segments into the target schema:
   - Speech -> `inline` or `file` fragment text.
   - Versicle speech -> `audio_role: versicle`.
   - Response speech -> `audio_role: response`.
   - Sacred bell -> `{"kind":"audio_cue","cue":"sacred_bell"}` in publish contracts.
   - Personal intention -> `{"kind":"pause","purpose":"personal_intention","duration_ms":5000}`; never narrate "pause here."
6. Reuse `audio_config.role_overrides` for distinct voices. Default to the existing primary voice for Versicle and a clearly distinct configured voice for Response. Never invent provider voice ids.
7. Show a readable before/after summary, structured segment order, and unresolved findings before editing source files.
8. After edits, run relevant contract tests and rerun this normalizer in `--strict` mode.

## Safety Rules

- Preserve theology, canonical prayer wording, names, and prosodic punctuation.
- Do not delete all parentheticals, headings, citations, notes, URLs, or addresses by regex. Flag them for review.
- Do not expand `St.` when it may mean Street.
- Do not speak `V.`, `R.`, `x3`, "pause here," cue names, JSON keys, editorial notes, or provenance metadata.
- Expand repetition into actual structured repeats or repeated fragments; do not merely delete the count.
- Keep diagnostics auditable: record the rule, original text, action, source path, and whether review is required.
- Do not bulk-rewrite contract collections unless the user explicitly requests that migration.

## Script Output

`normalize_prayer_tts.py` emits JSON only and does not overwrite inputs.

- `segments`: ordered `speech`, `audio_cue`, and `pause` objects.
- `diagnostics`: stable rule ids with severity and action.
- JSON input returns one result for each likely spoken string field.
- Exit `0`: valid preview; exit `1`: `--strict` found unresolved review/error diagnostics; exit `2`: invalid input or CLI usage.
