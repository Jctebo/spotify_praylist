-- v624 migration 0047 — the server-side feed resolution store
-- (release doc §1 item 1, decision D1): one row per (date, slot)
-- in ext_resolutions, holding a POINTER to the provider's own
-- enclosure (stream_url) — no audio bytes are stored or served
-- by this path. ext_feed_state carries one row per feed key:
-- the last successful read, the last attempt, the last error,
-- and the feed build stamp of the last successful read. The
-- failure rule (§1 item 5) reads from these two tables: a
-- failed read writes no resolution row, so the last good row
-- stands; a slot is 'missing' only after a successful read
-- with no match.
CREATE TABLE ext_resolutions (
  slot_id TEXT NOT NULL,
  date TEXT NOT NULL,
  state TEXT NOT NULL,
  title TEXT,
  stream_url TEXT,
  duration_s INTEGER NOT NULL DEFAULT 0,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  desc_text TEXT,
  resolved_at TEXT NOT NULL,
  feed_stamp TEXT,
  PRIMARY KEY (date, slot_id)
);
CREATE TABLE ext_feed_state (
  feed_key TEXT PRIMARY KEY,
  last_success_at TEXT,
  last_attempt_at TEXT,
  last_error TEXT,
  last_stamp TEXT
);
