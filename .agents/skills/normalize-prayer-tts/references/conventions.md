# Prayer Text-to-Speech Conventions

## Contents

1. Rule precedence
2. Transform automatically
3. Represent structurally
4. Review before removal
5. Preserve by default
6. Repository schema mappings

## Rule Precedence

Apply rules in this order:

1. Segment explicit speaker markers.
2. Extract intention instructions into cue/pause segments.
3. Expand safe pronunciation abbreviations.
4. Diagnose repetition and non-spoken artifacts.
5. Normalize whitespace.

This order protects call-and-response boundaries and the exact position of intentional silence.

## Transform Automatically

| Printed form | Spoken form | Guard |
|---|---|---|
| `STS Peter and Paul` / `Sts. Peter and Paul` | `Saints Peter and Paul` | Must introduce a capitalized name |
| `St. Joseph` | `Saint Joseph` | Must introduce a capitalized name and not follow an address number |
| `Fr. Michael` | `Father Michael` | Must introduce a capitalized name |
| `Rev. John` | `Reverend John` | Must introduce a capitalized name |
| `Bp. Barron` | `Bishop Barron` | Must introduce a capitalized name |
| `Msgr. Smith` | `Monsignor Smith` | Must introduce a capitalized name |

Preserve `Main St.`, `123 St. Paul Street`, initials, scripture references, and unknown abbreviations for review.

## Represent Structurally

### Versicle and Response

Printed `V.`, `V:`, or `Versicle:` introduces a Versicle segment. Printed `R.`, `R:`, or `Response:` introduces a Response segment. Remove the label from speech.

```json
[
  {"kind": "speech", "audio_role": "versicle", "text": "O God, come to my assistance."},
  {"kind": "speech", "audio_role": "response", "text": "O Lord, make haste to help me."}
]
```

Use `audio_config.role_overrides` for distinct voices. In this repository, follow `config/publish/contracts/auxilium-christianorum.json`. Use the normal/default voice for Versicle unless the contract says otherwise, and a different configured voice for Response. Do not invent an ElevenLabs `voice_id`.

### Personal Intention

Replace a clear instruction such as “Pause here to mention your request” with:

```json
[
  {"kind": "audio_cue", "cue": "sacred_bell"},
  {"kind": "pause", "purpose": "personal_intention", "duration_ms": 5000}
]
```

The user may change the pause duration or disable the bell. Never send cue labels or pause directions to TTS. The active publish schema renders `sacred_bell` as a deterministic cached bell and `pause` as exact generated silence.

### Repetition

Treat `x3`, `3 times`, and “repeat three times” as structure. Expand them into a `repeat` block or repeated cached fragments. Do not speak or simply delete the notation. `x1` is still non-spoken markup and should become one ordinary fragment.

## Review Before Removal

The repository audit found these additional artifact classes:

- Editorial lines: `Note:`, `Source:`, `Copyright:`, `Optional:`, `Instructions:`.
- Contact/provenance text: postal addresses, email addresses, URLs, “report favors received,” publisher details.
- Rubrics and stage directions in brackets or parentheses: leader/all instructions, kneeling/standing, silence, optional prayers, priest-only text.
- Printed headings embedded in prose.
- Scripture citations and footnote markers.
- Pronunciation guides and alternative wordings.

Classify each item as:

- `remove`: not intended for listeners;
- `transform`: conveys necessary structure;
- `preserve`: belongs to the proclaimed prayer;
- `review`: meaning or listener value is uncertain.

Default to `review` rather than deletion.

## Preserve By Default

- Canonical prayer words and repeated prayer bodies.
- Names and titles when expansion is uncertain.
- Parentheticals that are grammatical parts of the prayer.
- Punctuation that controls cadence.
- Archaic devotional language unless the user separately requests modernization.
- Citations when the target experience intentionally announces them.

## Repository Schema Mappings

### Publish Contracts

- Speech: `{"kind":"inline","text":"..."}` or a `file` block.
- Role: add `audio_role: "versicle"` or `"response"` to the speech block.
- Voice: configure `audio_config.role_overrides`; the fragment pipeline already applies it.
- Bell: add `{"kind":"audio_cue","cue":"sacred_bell"}`.
- Personal intention: add `{"kind":"pause","duration_ms":5000,"purpose":"personal_intention"}`.
- Ordinary fragment separation adds silence, while explicit pauses suppress that automatic gap on both adjacent joins.

### Novena Contracts

- Prefer structured template `blocks` and `parts` for roles, cues, and repeats.
- Large legacy `sections[].text` strings cannot express voice changes safely without segmentation.
- When both `blocks` and `sections` exist, update both representations or use the repository’s canonical regeneration path. Never leave their spoken content divergent.

### Validation

- Preview with this skill’s script.
- Inspect exact source paths in diagnostics.
- Run contract-specific unit tests.
- Rerun with `--strict`.
- Listen to a small rendered sample when runtime audio behavior changes.
