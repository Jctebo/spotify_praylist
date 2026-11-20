-- v528 migration 0040 — the per-track prayer intention draws
-- (Scope package 46 Part B, Plan §2.2): ONE additive table on
-- the prayer-app D1. The Plan named 0039; v527 took 0039, so
-- the store takes the next free number, 0040 (recorded in the
-- release document §3). Nothing existing is altered; a
-- rollback leaves the table standing and unused (0028's
-- posture — no down-migration is written).
--
-- prayer_track_draws — one drawn intention per (date, track):
-- the track-keyed sibling of prayer_draws (0001) and
-- prayer_episode_draws (0022), following prayer_draws' shape
-- exactly, plus drawn_via — the field trial's measuring field
-- ('build' for a draw filled by the day build's batch, 'play'
-- for a draw filled at the startDesc seam for a track the
-- build does not cover). The pick is UNIFORM random from the
-- full active pool (decision B4) — deliberately NOT the
-- H=4 · M=2 · L=1 weighting of prayer_draws, which this
-- release does not touch. Fill-missing only: INSERT OR
-- IGNORE, first draw wins, never re-drawn within the day.
CREATE TABLE IF NOT EXISTS prayer_track_draws (
  date TEXT NOT NULL,
  track_key TEXT NOT NULL,
  intention_id INTEGER NOT NULL,
  drawn_via TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (date, track_key)
);
