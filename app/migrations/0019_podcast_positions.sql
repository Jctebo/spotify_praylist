-- v395 migration 0019 — Podcasts episode position memory
-- (Plan §2.2): ONE additive table on the prayer-app D1. Nothing
-- existing is altered; a rollback leaves the table standing and
-- unused (0017's posture — no down-migration is written).
--
-- podcast_positions — the per-episode partway record, keyed
-- exactly like podcast_listens. One row = one episode that is
-- partway: its saved position and the duration it was saved
-- against, in whole seconds, with the write instant. A listened
-- episode never holds a row — enforced by the position route's
-- no-op and the mark/unmark routes' delete, not by a constraint:
-- the sibling follows the listen row's philosophy (0017: a
-- progress record, not an audit log). podcast_listens itself is
-- untouched in schema and rows.

CREATE TABLE IF NOT EXISTS podcast_positions (
  series TEXT NOT NULL,
  seq_key TEXT NOT NULL,
  position_s INTEGER NOT NULL,
  duration_s INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (series, seq_key)
);
