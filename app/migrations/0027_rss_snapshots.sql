-- v464 migration 0027 — the Podcasts RSS series snapshot store
-- (Scope §1.4, Plan §2.2): ONE additive table on the prayer-app
-- D1. Nothing existing is altered; a rollback leaves the table
-- standing and unused (the standing posture — no down-migration
-- is written).
--
-- rss_snapshots — the Worker-built episode snapshot for a
-- Podcasts RSS series (The Exorcist Files · The Counsel of
-- Trent): one row per series, the windowed episode list (the
-- latest 50, D4 A — the window is applied at build, so the
-- stored snapshot IS the window) as JSON with its build
-- instant. The shape mirrors video_snapshots column for column
-- in its OWN table: one store per payload shape keeps every
-- contract absolute (0023's rule — an RSS row in
-- podcast_sequences would fail podReadSnapshot's PodSnapshot
-- validation, and in video_snapshots would bend the video
-- contract). The read path is the refresh path (2h lazy
-- rebuild, RSS_SNAPSHOT_MAX_AGE_MS); no cron stands behind it.
CREATE TABLE IF NOT EXISTS rss_snapshots (
  series TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  built_at TEXT NOT NULL
);
