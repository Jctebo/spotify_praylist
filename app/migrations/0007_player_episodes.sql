-- v312 migration 0007 — player_episodes: the day's episode index in the
-- app's own D1 (Scope §1 item 1, Plan E1). One row per episode for the
-- stored day; block and sort are resolved at push time by the pushing
-- job (E8), never at read time. Episodes that belong to no block carry
-- the explicit unblocked marker 'unblocked'. audio_state is 'present'
-- (audio verified in the app R2 bucket at commit) or 'missing' (the
-- track stands named and counted, never silently dropped).
CREATE TABLE player_episodes (
  date TEXT NOT NULL,
  episode_id TEXT NOT NULL,
  title TEXT NOT NULL,
  block TEXT NOT NULL,
  sort INTEGER NOT NULL,
  duration_s REAL NOT NULL DEFAULT 0,
  r2_key TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  audio_state TEXT NOT NULL,
  pushed_at TEXT NOT NULL,
  PRIMARY KEY (date, episode_id)
);
CREATE INDEX idx_player_episodes_date_sort ON player_episodes (date, sort);
-- The stored-day singleton: the one explicit answer to "which day does
-- the app hold". The replace-day commit writes this row last inside its
-- D1 batch; the read path keys off it, never off a MAX() guess.
CREATE TABLE player_day (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  date TEXT NOT NULL,
  episode_count INTEGER NOT NULL,
  pushed_at TEXT NOT NULL
);
-- The single rss mapping row retires with the RSS read path (Scope §1
-- item 5). The six playlist rows stand untouched (presentation data).
DELETE FROM player_sources WHERE source_kind = 'rss';
