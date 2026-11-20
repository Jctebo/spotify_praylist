-- v381 migration 0017 — the Podcasts section (Plan §2.2): two
-- additive tables on the prayer-app D1. Nothing existing is
-- altered; a rollback leaves both tables standing and unused
-- (Plan §2.8 — no down-migration is written).
--
-- 1. podcast_listens — the per-user listening record. One row =
-- one listened episode of a tracked series; the row IS the D3
-- history record (the date listened and how it was marked stand
-- on it). Unmark deletes the row; a later re-mark writes a fresh
-- row with its own date — a progress record, not an audit log
-- (Plan §2.2, stated plainly there).
-- 2. podcast_sequences — the Worker-built sequence snapshot
-- (Plan §2.1): one row per series, the compact entry list as
-- JSON (~370 entries) with its build instant. The read path is
-- the refresh path (24h lazy rebuild); no cron stands behind it.

CREATE TABLE IF NOT EXISTS podcast_listens (
  series TEXT NOT NULL,
  seq_key TEXT NOT NULL,
  listened_at TEXT NOT NULL,
  listen_date TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('auto','manual')),
  PRIMARY KEY (series, seq_key)
);

CREATE TABLE IF NOT EXISTS podcast_sequences (
  series TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  built_at TEXT NOT NULL
);
