-- v349 migration 0013 — the Novenas block (Plan §2.2.7): the
-- novenas leave Midmorning for their own block, LAST in
-- PRAYER_BLOCKS, on BOTH the player side and the prayer-module
-- side (John's decisions 1 and 5, 2026-11-10 04:18 CT).
--
-- THE OVERRIDE GUARD (the 0011/0012 pattern): the settings UPDATE
-- applies ONLY where the row still stands at its post-0011 values
-- (family='own' AND block='Midmorning' AND sort_order=2 AND
-- enabled=1 AND slot_id IS NULL AND day_rule='daily' — 0010 seeded
-- the row at sort 1; 0011 aligned it to 2). A row John has moved
-- himself fails the guard, stands untouched, and is named as a
-- held override in the release record. The guard is also the
-- no-double-apply guard: a second application matches zero rows.
--
-- What 0013 does NOT do: no new rows · no player_episodes change ·
-- no label row (§2.2.5 verification: prayer_block_labels stands in
-- its code-fallback form — every live label reads as its block
-- name and no migration or fixture in the estate ever wrote a
-- row, so no 'Novenas' row is added; the fallback renders the
-- block name identically).

UPDATE player_source_settings
SET block = 'Novenas', sort_order = 1,
    updated_at = '2026-11-10T10:30:00.000Z'
WHERE source_key = 'novenas'
  AND family = 'own' AND block = 'Midmorning' AND sort_order = 2
  AND enabled = 1 AND slot_id IS NULL AND day_rule = 'daily';

-- The prayer-module item (decision 5): the Novenas item leaves
-- the module's Midmorning block and stands alone in the Novenas
-- module block. Module items are not user-movable, so no
-- held-override case exists; the block='Midmorning' condition is
-- the no-double-apply guard. Id, name, kind, sort, opening and
-- closing prayers are untouched — only the block value moves.
-- Past days' draws key on date + item id and are untouched.
UPDATE prayer_items
SET block = 'Novenas'
WHERE name = 'Novenas' AND block = 'Midmorning';

-- The meta increment: relative, unconditional — it is what
-- invalidates the v334 device day-cache on next open (the v337
-- mechanism). Never a literal.
UPDATE player_settings_meta SET version = version + 1, updated_at = '2026-11-10T10:30:00.000Z' WHERE id = 1;
