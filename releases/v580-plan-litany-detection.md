# v580 — Litany of the Saints detection · Plan

## The defect
2026-11-21 Morning Prayer (Memorial of the Presentation of the Blessed
Virgin Mary) carried the invocation "Presentation of the Blessed Virgin
Mary, pray for us" — an EVENT feast spoken as a person.

## Leak finding (proven on production fixtures, 2026-11-21)
The leak is in the feast-day saint resolution feeding the ladder, not in
the ladder's tier placement:

1. `jobs/publish/devotional_calendar_saint.py::_names_saint` decides
   "names a saint" by keyword: any observance containing "Blessed
   Virgin Mary" counts. The Presentation's observance name therefore
   enters the resolver's `saints` list as if it were a person:
   `resolve_saint_of_day(2026-11-21).saints == ["The Presentation of
   the Blessed Virgin Mary"]`.
2. The ladder's Tier-2 rule ("Marian titles and non-saint feasts add no
   invocation", v306) exists only in the module docstring. In code the
   only Marian guard is an exact normalized-name == "mary" check, which
   an event title never matches; every unmatched feast name falls into
   the "invoked as named" fallback (warning + placed). The event title
   is spoken.
3. Same mechanism, second case: 2027-06-24 resolves "The Nativity of
   Saint John the Baptist" as a feast saint and the ladder invokes it
   as named — a second, event-titled invocation of a saint who already
   stands in the core.
4. Converse gap: dedication feasts are hard-excluded upstream
   ("Dedication of" → not a saint), so their persons never reach the
   ladder at all — 2027-08-05 (Dedication of the Basilica of Saint
   Mary Major) resolves no saints, and "Saint Mary Major" is never
   invoked, against John's rule that a dedication yields its person.

## Production fixtures (drawn from the devotional calendar ICS)
- Event feast: 2026-11-21, "The Presentation of the Blessed Virgin
  Mary" — must add NO invocation.
- Dedication feast: 2027-08-05, "The Dedication of the Basilica of
  Saint Mary Major" — must yield "Saint Mary Major".
- Normal saint's day: 2026-11-17, "Saint Elizabeth of Hungary,
  Religious" — member-matched today, must stand unchanged.
- Extra same-class cases from the calendar scan: 2027-06-24 Nativity
  of Saint John the Baptist (extract the person; dedupes to core),
  2026-11-09 Lateran dedication, 2026-11-18 Basilicas of Saints Peter
  and Paul dedication.

## The build (John's picks, 2026-11-21 11:30 CT: Q1 A · Q2 A · Q3 A)
1. `jobs/publish/feast_classification.py` +
   `config/publish/feast-classification.json` — feast-type
   classification: calendar metadata (the observance name the calendar
   itself carries) first, deterministic patterns second, a small
   maintained exception table for the feasts metadata cannot settle
   (event feasts, dedication feasts, person extractions).
2. Table-backed person extraction for dedication feasts; the resolver
   surfaces them as `litany_persons` (Daily Reflection fields
   untouched) and the ladder places them through its normal
   member/window pipeline.
3. At episode build: a deterministic guard strikes any resolved
   invocation that classifies as a non-person (slot stands empty —
   Q5 A), and an LLM backstop that can only REMOVE suspect
   invocations, never add (Q3 A); any LLM failure leaves the
   deterministically guarded list unchanged.

## Ship shape
Fix merges to main and pushes; What's New entry; row to Live. Then the
corrected replacement for today's Morning Prayer (Q4 A): pull the
defective episode, re-render only the litany fragment, re-assemble
from cached fragments, transcript guard, publish a NEW episode titled
"corrected", flip the ledger, verify enclosures, and re-verify the
app leg.
