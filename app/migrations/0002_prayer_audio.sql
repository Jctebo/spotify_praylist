-- v305 migration 0002 — prayer_audio: one row per block per day, the
-- app's own record of the six spoken Intentions segments (Amendment 9
-- item 6, the hard requirement). The audio bytes live in the app's R2
-- bucket under r2_key; this table is the identity (date + block + size
-- recorded from the push itself).
CREATE TABLE prayer_audio (
  date TEXT NOT NULL,
  block TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  pushed_at TEXT NOT NULL,
  PRIMARY KEY (date, block)
);
