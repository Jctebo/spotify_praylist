-- v368 migration 0016 — The AI Signal block (Plan §2.1; John's
-- decisions, 2026-11-10 20:40 CT: D1-A its own block LAST · D2-A
-- the own-store hand-off · D3-A today only · D4-B an intention
-- intro before the episode; the D4 pairing item per John's word
-- 2026-11-10 20:48 CT — a NEW prayer-module item, Plan §2.6 as
-- designed). Three statements, each in the estate's guard idiom:
--
-- 1. The settings row. The NOT EXISTS is both guards at once: a
-- second application inserts zero rows, and a row John has
-- created or moved himself stands untouched (and would be named
-- as a held override in the release record — the INSERT simply
-- never fires against his row).
-- 2. The draw item (the D4 vehicle, §2.6): item 'The AI Signal'
-- in its own module block, kind 'prayer' — it draws from the
-- same pool under the same weights as every prayer item, one
-- draw per date. Same guard shape, same held-override naming.
-- IMPLEMENT CORRECTION (evidence in §3): the guard keys on name
-- + kind='prayer', NOT name alone — production already carries
-- an item named 'The AI Signal' (id 40, Evening, kind
-- 'activity', "Listen to today's episode"), and a name-only
-- guard could never fire: the approved item would never plant
-- and the pairing would silently ride the activity's draw. The
-- kind-scoped guard preserves both guard purposes: a second
-- application matches the planted prayer item (zero rows), and
-- a same-name PRAYER item of John's own stands untouched as
-- the held override. The two same-name items coexist by id;
-- the name-keyed draw maps (playerIntroTexts, the helper's
-- read_draw) iterate blocks in PRAYER_BLOCKS order, so the new
-- block — LAST — supplies the pairing's draw.
-- 3. The meta increment, in the 0012/0013 form: relative,
-- unconditional, never a literal — it is what invalidates the
-- v334 device day-cache on next open (the v337 mechanism).
--
-- What 0016 does NOT do: no player_episodes change (episode rows
-- arrive by the new door route, §2.4) · no label row (§2.1: the
-- code-fallback form stands — the label reads as the block name).

INSERT INTO player_source_settings (source_key, name, family, block, day_rule, sort_order, enabled, slot_id, role, updated_at)
SELECT 'the-ai-signal', 'The AI Signal', 'own', 'The AI Signal', 'daily', 1, 1, NULL, 'primary', '2026-11-11T04:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM player_source_settings WHERE source_key = 'the-ai-signal');

INSERT INTO prayer_items (block, name, sub, kind, color, opening_prayer, closing_prayer, enabled, sort)
SELECT 'The AI Signal', 'The AI Signal', '', 'prayer', 'gold', '', '', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM prayer_items WHERE name = 'The AI Signal' AND kind = 'prayer');

UPDATE player_settings_meta SET version = version + 1, updated_at = '2026-11-11T04:00:00.000Z' WHERE id = 1;
