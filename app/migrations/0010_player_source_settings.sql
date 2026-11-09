-- v328 migration 0010 — the source-mapping settings store (Plan
-- §2.1): one row per source (its block, day rule, order within the
-- block, on/off) plus a singleton meta row carrying the settings
-- version. The seed is written by THIS migration — the estate's own
-- idiom (0003 seeded player_sources; 0006 is a seed outright) — and
-- migrations run exactly once, so "written once, never re-seeded"
-- (Scope D6) is structural: no job, deploy, or later release can
-- re-apply it. The untouched seed is version 1; every session PUT
-- increments it. Additive only: no standing table is touched.
CREATE TABLE player_source_settings (
  source_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  family TEXT NOT NULL,              -- 'own' | 'external' | 'spotify' | 'unplaced'
  block TEXT NOT NULL DEFAULT '',    -- one of the six blocks, or '' = no block
  day_rule TEXT NOT NULL DEFAULT 'daily',
  sort_order INTEGER,                -- position within the block; NULL = no position (off, or no block)
  enabled INTEGER NOT NULL DEFAULT 1,
  slot_id TEXT,                      -- external rows: the v324 slot governed; NULL otherwise
  role TEXT NOT NULL DEFAULT 'primary',  -- 'primary' | 'fallback'
  updated_at TEXT NOT NULL
);
CREATE TABLE player_settings_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO player_settings_meta (id, version, updated_at) VALUES (1, 1, '2026-11-09T05:30:00.000Z');
INSERT INTO player_source_settings (source_key, name, family, block, day_rule, sort_order, enabled, slot_id, role, updated_at) VALUES
  ('morning-prayer',        'Morning Prayer',                    'own',      'Morning',   'daily',         1,    1, NULL,                   'primary',  '2026-11-09T05:30:00.000Z'),
  ('daily-rosary',          'Daily Rosary',                      'own',      'Morning',   'daily',         2,    1, NULL,                   'primary',  '2026-11-09T05:30:00.000Z'),
  ('marian-antiphon',       'Marian Antiphon — Angelus',         'own',      'Morning',   'daily',         3,    1, NULL,                   'primary',  '2026-11-09T05:30:00.000Z'),
  ('novenas',               'Novenas',                           'own',      'Midmorning', 'daily',        1,    1, NULL,                   'primary',  '2026-11-09T05:30:00.000Z'),
  ('auxilium-christianorum','Auxilium Christianorum',            'own',      'Afternoon', 'daily',         1,    1, NULL,                   'primary',  '2026-11-09T05:30:00.000Z'),
  ('daily-reflection',      'Daily Reflection',                  'own',      'Night',     'daily',         1,    1, NULL,                   'primary',  '2026-11-09T05:30:00.000Z'),
  ('do-invitatory',         'Divine Office — Invitatory',        'external', 'Morning',   'daily',         4,    1, 'ext-invitatory',       'primary',  '2026-11-09T05:30:00.000Z'),
  ('do-morning-prayer',     'Divine Office — Morning Prayer',    'external', 'Morning',   'daily',         5,    1, 'ext-morning-prayer',   'primary',  '2026-11-09T05:30:00.000Z'),
  ('sth-lauds',             'Sing the Hours — Lauds',            'external', 'Morning',   'fallback-only', 5,    1, 'ext-morning-prayer',   'fallback', '2026-11-09T05:30:00.000Z'),
  ('bible-in-a-year',       'Bible in a Year',                   'external', 'Morning',   'daily',         6,    1, 'ext-bible-in-a-year',  'primary',  '2026-11-09T05:30:00.000Z'),
  ('do-midmorning-prayer',  'Divine Office — Midmorning Prayer', 'external', 'Midmorning', 'daily',        2,    1, 'ext-midmorning-prayer','primary',  '2026-11-09T05:30:00.000Z'),
  ('do-midday-prayer',      'Divine Office — Midday Prayer',     'external', 'Midday',    'daily',         1,    1, 'ext-midday-prayer',    'primary',  '2026-11-09T05:30:00.000Z'),
  ('do-midafternoon-prayer','Divine Office — Midafternoon Prayer','external','Afternoon', 'daily',         3,    1, 'ext-midafternoon-prayer','primary', '2026-11-09T05:30:00.000Z'),
  ('saint-of-the-day',      'Saint of the Day',                  'spotify',  'Afternoon', 'daily',         2,    1, NULL,                   'primary',  '2026-11-09T05:30:00.000Z'),
  ('do-office-of-readings', 'Divine Office — Office of Readings','external', 'Evening',   'daily',         1,    1, 'ext-office-of-readings','primary', '2026-11-09T05:30:00.000Z'),
  ('do-evening-prayer',     'Divine Office — Evening Prayer',    'external', 'Evening',   'daily',         2,    1, 'ext-evening-prayer',   'primary',  '2026-11-09T05:30:00.000Z'),
  ('sth-vespers',           'Sing the Hours — Vespers',          'external', 'Evening',   'fallback-only', 2,    1, 'ext-evening-prayer',   'fallback', '2026-11-09T05:30:00.000Z'),
  ('do-night-prayer',       'Divine Office — Night Prayer',      'external', 'Night',     'daily',         2,    1, 'ext-night-prayer',     'primary',  '2026-11-09T05:30:00.000Z'),
  ('usccb-daily-readings',  'USCCB Daily Readings',              'unplaced', '',          'daily',         NULL, 0, NULL,                   'primary',  '2026-11-09T05:30:00.000Z'),
  ('daily-tv-mass',         'Daily TV Mass',                     'unplaced', '',          'sundays',       NULL, 0, NULL,                   'primary',  '2026-11-09T05:30:00.000Z'),
  ('fr-mike-homily',        'Fr. Mike Sunday Homily',            'unplaced', '',          'sundays',       NULL, 0, NULL,                   'primary',  '2026-11-09T05:30:00.000Z'),
  ('barron-sermon',         'Bp. Barron Sunday Sermon',          'unplaced', '',          'sundays',       NULL, 0, NULL,                   'primary',  '2026-11-09T05:30:00.000Z'),
  ('stations-of-the-cross', 'Stations of the Cross / Lenten Devotion', 'unplaced', '',       'fridays',       NULL, 0, NULL,                   'primary',  '2026-11-09T05:30:00.000Z');
