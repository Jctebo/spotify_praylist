-- v495 migration 0032 — the Mass personal prayer (Scope §1,
-- Plan §2): ONE additive table on the prayer-app D1,
-- pre-assigned number 0032. Nothing existing is altered; a
-- rollback leaves the table standing and unused (0028's
-- posture — no down-migration is written).
--
-- mass_personal_prayer — John's own prayer standing in the
-- day's Mass after the Communion Antiphon, picked from the
-- written-prayer book (0026) and kept saved (John,
-- 2026-11-17: "Keep that prayer saved"). The seat holds ONE
-- choice, so the table holds ONE row, keyed by the constant
-- id 1: slug is the chosen prayer's book slug, or NULL where
-- the seat stands cleared. The session PUT validates a
-- non-null slug against prayer_book before it writes (a
-- named 400 writes nothing); the agent door reads only (the
-- v328 posture — writes are John's, session-only). A missing
-- table (pre-0032) reads as "no choice" and never errors
-- (the bookFavorites posture, 0028).
CREATE TABLE IF NOT EXISTS mass_personal_prayer (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  slug TEXT,
  updated_at TEXT NOT NULL
);
