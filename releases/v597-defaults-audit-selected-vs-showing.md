# v597 — Defaults audit: selected must mean showing

Row 1571 · Ora Pro Nobis · Scope (audit only — no build on this document)

## §1 Scope

John's field report (Ora thread, 2026-11-21 16:36 CT, verbatim): "Things like the catechism show selected but aren't even in the playlist. Let's audit the defaults across everything and verify stuff shows. I don't want the courses part of default"

The audit verifies, item by item, per block, for each of the three ways' designed defaults AND John's standing saved profiles: what the Edit profiles editor shows as SELECTED vs what the fold actually composes into the day (the Praylist) — against the served production client (pin ora-pro-nobis-v594-2) driven in rendered device worlds over production fixtures (John's own v589 document, the production source-settings payload, the production 2026-11-21 day payload). Every mismatch is named with its mechanism. Decided constraint carried in from the direction: courses are NOT part of the defaults. The full findings stand in ~/workspace/projects/ora-pro-nobis/v597-defaults-audit-findings.md.

## §2 The audit's results

- The designed defaults store NO contents (seed = coreBlocks + layers only; effective.contents is null for every way, driven). With contents absent, the editor paints each block's whole contents UNIVERSE as selected — and the universe appends all four course selectors (catechism-in-a-year · bible-in-a-year · rosary-in-a-year · summa-in-a-year) to EVERY core block. The fold resolves courses only from explicit contents, so under the defaults no painted course can ever show.
- Mismatch totals (selected-but-not-showing): The Little Way 9 (8 courses + the Morning readings seat, which its podcasts-off posture can never compose) · The Salesian Way 16 (all courses) · The Benedictine Way 24 (all courses). Total 49. Showing-but-not-selected: 0 in every way. All sources and the all-novenas selector agree between editor and fold in every way.
- John's saved profiles are shape-identical to the designed defaults (no contents anywhere; zero stored course items). His standing Salesian today carries the Salesian table exactly: 16 painted course selections, none in his Praylist.
- Root-cause classes: A — courses: editor paints from the universe, fold resolves from explicit contents; sources got a standing-contents branch in the weave, courses never did. B — the seat: painted into Morning for every profile, admitted by the resolver only under a podcasts-on profile carrying daily-readings. C — latent: an explicit-contents course resolves only when a current episode exists; finished/unavailable courses stand silently empty while painted selected. D — double-carry: bible-in-a-year is both a Podcasts-layer series and a per-block course selector, two meanings of "selected" for one key.

## §3 The fix shape (proposed, held for John's word)

1. One standing-contents function per block, consumed by both the editor paint and every fold resolver (contents gating · courses · seat) — selected == showing by construction, proven by per-way × per-block harness legs over production fixtures.
2. Courses leave the defaults: course selectors come out of the contents universe (editor paint + Add picker), out of the contents validators on both folds (client + server parity); Reset — which already deletes contents — then restores a courseless default. Courses stand as before in Catechesis/Podcasts as series.
3. The seat enters a block's standing list only under the posture that can compose it.
4. The one decision for John — his own saved profiles' course items: the audit verified ZERO stored course items in his document, so Option 1 (recommended) is to proceed with no data change to his profiles at all; Option 2 adds a belt-and-braces migration strip for a state his document is verified not to be in; Option 3 keeps course selectors hand-addable (keeps Class C alive). The chain holds at Scope for his pick.
