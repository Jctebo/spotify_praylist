-- v413 migration 0021 — the manual playlist order (Scope §1.5,
-- Plan §2.2): ONE additive table on the prayer-app D1,
-- pre-assigned number 0021. Nothing existing is altered; a
-- rollback leaves the table standing and unused (0020's posture
-- — no down-migration is written).
--
-- player_block_order — John's own arrangement of the Prayers
-- library grid's block cards: one row per block he has placed,
-- its position the sort_order. The table holds ONLY the user's
-- arrangement — an empty table is the standing state and reads
-- as "no manual order" (the day payload's blockOrder fold is
-- null and the grid stands in contract order, FD1). The session
-- PUT replaces the rows whole in one batch after validating
-- every name against PRAYER_BLOCKS; the agent door reads only
-- (the v328 posture — writes are John's, session-only).
CREATE TABLE IF NOT EXISTS player_block_order (
  block TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
