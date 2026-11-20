-- v515 migration 0038 — Prayer Profiles (Plan P1): one row
-- per profile — the three defaults and any later customs in
-- ONE table (the player_source_settings one-store idiom) —
-- the singleton state beside it (the standing default, the
-- day-type rule, and a version bumped on EVERY profile
-- write: the day fold's freshness key), and John's per-date
-- picks (the pick IS the retreat-day declaration; deleting
-- a row returns the date to the rule). A profile's shape is
-- its core block list (a JSON array, in the profile's
-- order) plus its layer attachments (a JSON object:
-- {"novenas": {"on": 0|1}, "podcasts": {"on": 0|1,
-- "series": [series keys in order]}}).
--
-- The seed is written by THIS migration — the estate's own
-- idiom (0010 seeded player_source_settings in the
-- migration) — and migrations run exactly once, so "written
-- once, never re-seeded" is structural: no job, deploy, or
-- later release can re-apply it. The three defaults each
-- carry the line "named in honor of the tradition, not the
-- order's own routine". The state singleton seeds the
-- standing default 'salesian', the day rule on, version 1.
-- No picks at seed. Additive only: no standing table is
-- touched.
--
-- No down-migration (the house posture): a rollback to
-- pre-v515 code reads a day payload without the profile
-- fold (its playerDayPayload does not know the tables) and
-- the profiles simply do not stand.
CREATE TABLE IF NOT EXISTS prayer_profiles (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  honor_line TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK (kind IN ('default','custom')),
  core_blocks TEXT NOT NULL,
  layers TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prayer_profile_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  standing_key TEXT NOT NULL,
  day_rule INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prayer_profile_day_picks (
  date TEXT PRIMARY KEY,
  profile_key TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO prayer_profiles (key, name, honor_line, kind, core_blocks, layers, sort_order, updated_at) VALUES
  ('little-way', 'The Little Way', 'named in honor of the tradition, not the order''s own routine', 'default', '["Morning","Night"]', '{"novenas":{"on":0},"podcasts":{"on":0,"series":[]}}', 1, '2026-11-18T01:05:00.000Z'),
  ('salesian', 'The Salesian Way', 'named in honor of the tradition, not the order''s own routine', 'default', '["Morning","Midday","Evening","Night"]', '{"novenas":{"on":1},"podcasts":{"on":0,"series":[]}}', 2, '2026-11-18T01:05:00.000Z'),
  ('benedictine', 'The Benedictine Way', 'named in honor of the tradition, not the order''s own routine', 'default', '["Morning","Midmorning","Midday","Afternoon","Evening","Night"]', '{"novenas":{"on":1},"podcasts":{"on":0,"series":[]}}', 3, '2026-11-18T01:05:00.000Z');
INSERT INTO prayer_profile_state (id, standing_key, day_rule, version, updated_at) VALUES
  (1, 'salesian', 1, 1, '2026-11-18T01:05:00.000Z');
