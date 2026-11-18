-- v527 migration 0039 — the Universal Prayer intentions
-- (Scope §1, Plan §2.2): ONE additive table on the prayer-app
-- D1, pre-assigned number 0039. Nothing existing is altered;
-- a rollback leaves the table standing and unused (0028's
-- posture — no down-migration is written).
--
-- mass_universal_prayer — John's private intentions for the
-- Universal Prayer (the Prayer of the Faithful), stored PER
-- DATE: one row per date, its intentions a JSON array of
-- strings in standing order. The list is the viewed day's
-- only — no row stands for a date until John adds to it, and
-- nothing carries forward. The session PUT validates every
-- item before it writes (a named 400 writes nothing); the
-- agent door reads only (the v328 posture — writes are
-- John's, session-only). A missing table (pre-0039) reads as
-- an empty list and never errors (the bookFavorites posture,
-- 0028). John's mass_personal_prayer seats are NOT touched
-- by this migration.
CREATE TABLE IF NOT EXISTS mass_universal_prayer (
  date TEXT PRIMARY KEY,
  intentions TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);
