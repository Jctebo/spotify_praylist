-- v412 migration 0020 — Day-track position memory (Fix 10)
-- (Plan §2.2/§2.8): ONE additive table on the prayer-app D1,
-- pre-assigned number 0020. Nothing existing is altered; a
-- rollback leaves the table standing and unused (0019's posture
-- — no down-migration is written).
--
-- day_positions — the per-episode partway record for DAY tracks
-- (the day's prayers and externals), the mirror of
-- podcast_positions (0019) keyed the day's way: a day track is
-- identified by its presented date plus its canonical episode
-- id. One row = one day episode that is partway: its saved
-- position and the duration it was saved against, in whole
-- seconds, with the write instant. A finished episode never
-- holds a row — enforced by the position route's zero-deletes
-- rule (the client's ended handler posts 0), not by a
-- constraint: the sibling follows podcast_positions'
-- philosophy (a progress record, not an audit log).
-- podcast_positions and podcast_listens are untouched in
-- schema and rows.

CREATE TABLE IF NOT EXISTS day_positions (
  date TEXT NOT NULL,
  episode_id TEXT NOT NULL,
  position_s INTEGER NOT NULL,
  duration_s INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (date, episode_id)
);
