-- v352 migration 0015 — the liturgical day record (Plan §2.2):
-- one row per Chicago date holding the OFFICIAL liturgical day's
-- name + color, pushed nightly by the devotional job through the
-- agent door (POST /api/agent/prayer/liturgical-day) and read by
-- both day payloads as their `liturgicalDay` field. The shape
-- mirrors prayer_addenda (migration 0001): one row per date,
-- keyed by the date, upserted by the push.
--
-- What 0015 does NOT do: no seed rows (the absence of a row IS
-- the no-push state — the client falls back to the plain date
-- label; the first push inserts) · no changes to existing tables
-- · no player-settings meta increment (the liturgical record is
-- not a source-mapping row; the settings version stands and the
-- v334 device day-cache is not invalidated).
CREATE TABLE prayer_liturgical_days (
  date TEXT PRIMARY KEY,
  day_name TEXT NOT NULL,
  color TEXT NOT NULL,
  pushed_at TEXT NOT NULL
);
