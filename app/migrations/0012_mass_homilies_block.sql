-- v339 migration 0012 — the Mass and Homilies block activation
-- (Plan §2.2): the four sources migration 0010 seeded as unplaced,
-- disabled placeholders are placed into the new seventh block
-- "Mass and Homilies", in John's approved inside order (Readings ·
-- Daily TV Mass · Fr. Mike · Barron), enabled, with the day rules
-- corrected per §2.2: TV Mass sundays -> daily (the §1-flagged
-- correction — the feed publishes daily and the playlist carried
-- Monday's Mass), and Fr. Mike + Barron sundays -> daily under
-- Plan's ruling (their cadence lives in the matcher,
-- latest_by_release_date — Sunday's item stands through the week;
-- a sundays presentation gate would hide the standing item
-- Mon–Sat, contradicting the verified playlist behavior).
--
-- THE OVERRIDE GUARD (the v337 §2.5 pattern, verbatim in spirit):
-- every UPDATE applies ONLY where the row still stands at its
-- 0010 seed values (family='unplaced' AND block='' AND enabled=0
-- AND slot_id IS NULL, plus the seeded day_rule per row). A row a
-- user has already moved fails its guard, stands untouched, and
-- is named as a held override in the release record. The
-- slot_id IS NULL condition is also the no-double-place guard:
-- a second application matches zero rows.
--
-- What 0012 does NOT do: no new rows (all four exist) · no
-- player_episodes change · no segment family change (the block
-- has NO block segment and NO Intentions card — v339 §2.5) · no
-- touching the six blocks' rows. The family moves 'unplaced' ->
-- 'external' with placement: the rows govern external slots from
-- this migration on (0010's family vocabulary: 'external' rows
-- carry slot_id; an enabled placed row with family 'unplaced'
-- would stand outside every family-filtered read).

UPDATE player_source_settings
SET family = 'external', block = 'Mass and Homilies', slot_id = 'ext-usccb-readings',
    sort_order = 1, enabled = 1, day_rule = 'daily',
    updated_at = '2026-11-09T18:00:00.000Z'
WHERE source_key = 'usccb-daily-readings'
  AND family = 'unplaced' AND block = '' AND enabled = 0 AND slot_id IS NULL
  AND day_rule = 'daily';

UPDATE player_source_settings
SET family = 'external', block = 'Mass and Homilies', slot_id = 'ext-daily-tv-mass',
    sort_order = 2, enabled = 1, day_rule = 'daily',
    updated_at = '2026-11-09T18:00:00.000Z'
WHERE source_key = 'daily-tv-mass'
  AND family = 'unplaced' AND block = '' AND enabled = 0 AND slot_id IS NULL
  AND day_rule = 'sundays';

UPDATE player_source_settings
SET family = 'external', block = 'Mass and Homilies', slot_id = 'ext-fr-mike-homily',
    sort_order = 3, enabled = 1, day_rule = 'daily',
    updated_at = '2026-11-09T18:00:00.000Z'
WHERE source_key = 'fr-mike-homily'
  AND family = 'unplaced' AND block = '' AND enabled = 0 AND slot_id IS NULL
  AND day_rule = 'sundays';

UPDATE player_source_settings
SET family = 'external', block = 'Mass and Homilies', slot_id = 'ext-barron-sermon',
    sort_order = 4, enabled = 1, day_rule = 'daily',
    updated_at = '2026-11-09T18:00:00.000Z'
WHERE source_key = 'barron-sermon'
  AND family = 'unplaced' AND block = '' AND enabled = 0 AND slot_id IS NULL
  AND day_rule = 'sundays';

-- The meta increment: relative, unconditional — it is what
-- invalidates the v334 device day-cache on next open (the v337
-- mechanism). Never a literal.
UPDATE player_settings_meta SET version = version + 1, updated_at = '2026-11-09T18:00:00.000Z' WHERE id = 1;
