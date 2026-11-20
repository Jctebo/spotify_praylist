-- v427 migration 0022 — the per-episode prayer intention draws
-- (Scope §1.5, Plan §2.2): ONE additive table on the prayer-app
-- D1, pre-assigned number 0022. Nothing existing is altered; a
-- rollback leaves the table standing and unused (0021's posture
-- — no down-migration is written), and the code's failure posture
-- degrades the episode path to absence, never an error.
--
-- prayer_episode_draws — one drawn intention per (date, novena
-- episode), the episode-keyed sibling of prayer_draws: the
-- Novenas family stands in prayer_items as ONE row, so its
-- per-item draw could only ever give every novena the same line.
-- This store keys the draw by the feed-born episode id
-- (novena-<slug>) instead. prayer_draws, the per-item draw path,
-- and every standing reader of either are untouched.
CREATE TABLE IF NOT EXISTS prayer_episode_draws (
  date TEXT NOT NULL,
  episode_id TEXT NOT NULL,
  intention_id INTEGER NOT NULL,
  PRIMARY KEY (date, episode_id)
);
