-- v434 migration 0023 — the Podcasts video series snapshot store
-- (Scope §1.6, Plan §2.2, F-434-7): ONE additive table on the
-- prayer-app D1. Nothing existing is altered; a rollback leaves
-- the table standing and unused (the standing posture — no
-- down-migration is written).
--
-- video_snapshots — the Worker-built video list snapshot for a
-- Podcasts VIDEO series (CatholicTV, from its YouTube channel
-- feed): one row per series, the compact video list as JSON with
-- its build instant. The shape mirrors podcast_sequences column
-- for column in its OWN table: podcast_sequences' standing
-- contract is that every row parses as a PodSnapshot, enforced
-- by podReadSnapshot — a video payload riding that table would
-- either fail the audio validation or force it to loosen for
-- every audio row. One store per payload shape keeps both
-- contracts absolute. The read path is the refresh path (2h lazy
-- rebuild, VIDEO_SNAPSHOT_MAX_AGE_MS); no cron stands behind it.
CREATE TABLE IF NOT EXISTS video_snapshots (
  series TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  built_at TEXT NOT NULL
);
