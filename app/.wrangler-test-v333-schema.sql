-- v305 migration 0001 — the six ported prayer tables, byte-faithful to
-- the GoalPost board's migration 0015 (the port source). Shapes and the
-- draw rule are unchanged: one active intention per enabled item per
-- date, weighted High=4 / Medium=2 / Low=1, persisted, fill-missing only.
-- prayer_completions history ports as DATA (Amendment 8 item 1): no
-- completion behavior is built on it anywhere in this app.
CREATE TABLE prayer_items (
  id INTEGER PRIMARY KEY,
  block TEXT NOT NULL,
  name TEXT NOT NULL,
  sub TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'prayer',
  color TEXT NOT NULL DEFAULT 'gold',
  opening_prayer TEXT NOT NULL DEFAULT '',
  closing_prayer TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE prayer_intentions (
  id INTEGER PRIMARY KEY,
  text TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'M',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);
CREATE TABLE prayer_draws (
  date TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  intention_id INTEGER NOT NULL,
  PRIMARY KEY (date, item_id)
);
CREATE TABLE prayer_completions (
  date TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  PRIMARY KEY (date, item_id)
);
CREATE TABLE prayer_addenda (
  date TEXT PRIMARY KEY,
  text TEXT NOT NULL DEFAULT ''
);
CREATE TABLE prayer_block_labels (
  block TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

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

-- v305 migration 0003 — player_sources: the prayer/block playback
-- mapping AS DATA (Amendment 3), editable in-app, never hard-coded.
-- source_kind: 'segment' (an in-app file route, url in rss_url),
-- 'rss' (a feed episode matched by title prefix, enclosure at read
-- time), 'playlist' (Spotify playlist only — link route).
-- Seed: the six blocks' Spotify Praylist URLs verbatim from the
-- midnight job sheet, as the block-level playlist routes, plus the
-- one episode mapping the approved mockup itself attests
-- ("Morning Prayer" plays under the Morning block).
CREATE TABLE player_sources (
  id INTEGER PRIMARY KEY,
  block TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  source_kind TEXT NOT NULL DEFAULT 'playlist',
  rss_url TEXT NOT NULL DEFAULT '',
  spotify_url TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0
);
INSERT INTO player_sources (block, title, source_kind, rss_url, spotify_url, sort) VALUES
  ('Morning',    'Morning',    'playlist', '', 'https://open.spotify.com/playlist/0sy9eBsySKuCppI0PxXRJN', 10),
  ('Midmorning', 'Midmorning', 'playlist', '', 'https://open.spotify.com/playlist/3EYFgLhMGEfILn6bRJgHJm', 20),
  ('Midday',     'Midday',     'playlist', '', 'https://open.spotify.com/playlist/4gQAaPAMiezBaDaoqK6sFQ', 30),
  ('Afternoon',  'Afternoon',  'playlist', '', 'https://open.spotify.com/playlist/7cyrM9f9LXEfmoqwZvUaXW', 40),
  ('Evening',    'Evening',    'playlist', '', 'https://open.spotify.com/playlist/6HNvFLWRShih7lgtwHTqXU', 50),
  ('Night',      'Night',      'playlist', '', 'https://open.spotify.com/playlist/1TAlNiKHMc41cT0fvkYxTD', 60),
  ('Morning',    'Morning Prayer', 'rss', '', '', 15);

-- v305 migration 0004 — examination of conscience (Scope Module 2).
-- exam_prompts: seeded content (migration 0006), editable by John
-- in-app. exam_runs: one run per date. exam_entries: a written entry
-- is the answer to a prompt (Amendment 8 item 2 — no marks, no
-- counter); prompt_id is NULL for custom entries, which carry their
-- category with them; confession_id links an entry under a confession
-- record when "Confession made" closes the preparation list.
CREATE TABLE exam_prompts (
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL,
  commandment_no INTEGER,
  text TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT ''
);
CREATE TABLE exam_runs (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'open',
  opened_at TEXT NOT NULL,
  closed_at TEXT
);
CREATE TABLE exam_entries (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL,
  prompt_id INTEGER,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  confession_id INTEGER,
  created_at TEXT NOT NULL
);

-- v305 migration 0005 — confessions + the confession guide (Scope
-- Module 2; Amendment 4's step-by-step guide shape). A confession
-- record closes the preparation list: the accumulated entries link
-- under it (exam_entries.confession_id) and the list restarts empty.
-- The penance assigned at a confession is held on its record until
-- marked complete (the penance card). The guide steps are seeded
-- editable data (migration 0006), not code.
CREATE TABLE confessions (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  penance_text TEXT NOT NULL DEFAULT '',
  penance_done_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE confession_guide (
  step_no INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT ''
);

-- v305 migration 0006 — examination + confession-guide seed content.
-- Source (named per Scope Open decision 1): the examination of
-- conscience in Fr. F. X. Lasance, "My Prayer Book" (Benziger
-- Brothers, 1908; public domain) — "Devotions for Confession",
-- pp. 347-349 (examination) and pp. 353-354 (the confession guide
-- and Act of Contrition). Text is seeded verbatim (the book's own
-- paragraphing; only scan-spacing artifacts cleaned). Every prompt
-- stays editable by John in-app afterward.
INSERT INTO exam_prompts (category, commandment_no, text, sort, source) VALUES
  ('Preliminary Examination', NULL, 'Did you omit to confess a mortal sin, either intentionally or through forgetfulness?', 10, 'Lasance, My Prayer Book (1908), p. 347'),
  ('Preliminary Examination', NULL, 'Did you intentionally neglect to say the penance which was imposed on you, or were you so careless as to forget it?', 20, 'Lasance, My Prayer Book (1908), p. 347'),
  ('Preliminary Examination', NULL, 'Have you carried out the resolutions you made at your last confession or have you paid no heed at all to them?', 30, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment I', 1, 'Have you doubted in matters of faith? Murmured against God at your adversity or at the prosperity of others? Despaired of His mercy?', 110, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment I', 1, 'Have you believed in fortune-tellers or consulted them?', 120, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment I', 1, 'Have you gone to places of worship belonging to other denominations?', 130, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment I', 1, 'Have you recommended yourself daily to God? Neglected your morning or night prayers? Omitted religious duties or practices through motives of human respect?', 140, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment I', 1, 'Have you rashly presumed upon God''s forbearance in order to commit sin?', 150, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment I', 1, 'Have you read books, papers, and periodicals of anti-Catholic or atheistic tendency? Made use of superstitious practices? Spoken with levity or irreverence of priests, Religious, or sacred objects?', 160, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment II', 2, 'Have you taken the name of God in vain? Profaned anything relating to religion?', 210, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment II', 2, 'Have you sworn falsely, rashly, or in slight and trivial matters? Cursed yourself or others, or any creature? Angered others so as to make them swear, or blaspheme?', 220, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment III', 3, 'Have you kept holy the Lord''s Day, and all other days commanded to be kept holy? Bought or sold things, not of necessity, on that day? Done or commanded some servile work not of necessity? Missed Mass or been wilfully distracted during Mass? Talked, gazed, or laughed in the church? Profaned the day by dancing, drinking, gambling, or in other ways?', 310, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment IV', 4, 'Have you honored your parents, superiors, and masters, according to your just duty? Deceived them? Disobeyed them?', 410, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment IV', 4, 'Have you failed in due reverence to aged persons?', 420, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment V', 5, 'Have you procured, desired, or hastened the death of any one? Borne hatred? Oppressed any one? Desired revenge? Not forgiven injuries? Refused to speak to others? Used provoking language? Injured others? Caused enmity between others?', 510, 'Lasance, My Prayer Book (1908), pp. 348-349'),
  ('Commandment VI and IX', 6, 'Have you been guilty of lascivious dressing? Been in lewd company? Read immodest books? Been guilty of unchaste songs, discourses, words, or actions? Wilfully entertained impure thoughts or desires?', 610, 'Lasance, My Prayer Book (1908), p. 349'),
  ('Commandment VII', 7, 'Have you been guilty of stealing, or of deceit in buying, or selling, in regard to wares, prices, weights, or measures? Have you wilfully damaged another man''s goods, or negligently spoiled them?', 710, 'Lasance, My Prayer Book (1908), p. 349'),
  ('Commandment VIII', 8, 'Have you borne false witness? Called injurious names? Disclosed another''s sins? Flattered others? Judged rashly?', 810, 'Lasance, My Prayer Book (1908), p. 349'),
  ('Commandment X', 10, 'Have you coveted unjustly anything that belongs to another?', 1010, 'Lasance, My Prayer Book (1908), p. 349'),
  ('Precepts of the Church', NULL, 'Have you gone to confession at least once a year? Received holy communion during Easter-time?', 1110, 'Lasance, My Prayer Book (1908), p. 349'),
  ('Precepts of the Church', NULL, 'Have you violated the fasts of the Church, or eaten flesh-meat on prohibited days?', 1120, 'Lasance, My Prayer Book (1908), p. 349'),
  ('Precepts of the Church', NULL, 'Have you sinned against any other commandment of the Church?', 1130, 'Lasance, My Prayer Book (1908), p. 349'),
  ('Capital Sins', NULL, 'Examine yourself also in regard to the Seven Capital Sins and the nine ways of being accessary to another''s sin.', 1210, 'Lasance, My Prayer Book (1908), p. 349');

INSERT INTO confession_guide (step_no, title, body) VALUES
  (1, 'Opening', 'Approach the confessional with the same recollectedness and reverence as would fill your heart if Christ our Lord were seated there in person ready to hear your confession. The priest is really the representative of Christ. When you kneel down, say: Bless me, Father, for I have sinned, and then begin the Confiteor, proceeding as far as "through my fault," etc. Then tell when you made your last confession and begin the avowal of your sins.'),
  (2, 'The list', 'Confess all your sins with a contrite and humble heart, and conclude thus: For these and all the sins of my past life, especially my sins of — , I am heartily sorry, beg pardon of God, and absolution of you, my Father; then finish the Confiteor: Therefore I beseech the blessed Mary ever Virgin, blessed Michael the archangel, blessed John the Baptist, the holy apostles Peter and Paul, and all the saints, to pray to the Lord our God for me.'),
  (3, 'Act of Contrition', 'O my God, confessing my guilt and with a contrite heart I kneel before Thee and implore Thee to look upon me according to the multitude of Thy mercies. I detest and am heartily sorry for all my sins, not only because I dread the loss of heaven and the pain of hell, but also and principally because by them I have offended Thee, Who art infinitely good and deserving of all my love. I firmly resolve, with the help of Thy grace, to confess my sins and to amend my life. I acknowledge Thee, O God, to be the Supreme Good, and I love Thee with all my heart. Be merciful to me, a poor sinner. I beseech Thee, by the passion and death of Jesus Christ, Thy Son, to forgive me my sins. Amen.'),
  (4, 'Penance', 'Listen then with humility and docility to the instruction of your confessor, and during this time avoid all recurrence as to the confession itself; remembering that sins forgotten after a serious examination are really comprised in the absolution. Accept with submission the penance imposed, and if any obstacle that you foresee will prevent your accomplishing it, state this respectfully.'),
  (5, 'Final blessing', 'While the priest pronounces the words of absolution, endeavor to excite an act of perfect contrition.');

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

-- v318 migration 0008 — player episode texts (app half, Plan T7): the
-- read-along text state on v312's player_episodes, in 0007's idiom.
-- text_state mirrors audio_state ('present' | 'missing'); text_r2_key
-- mirrors r2_key and is empty only on a missing row. The text bytes
-- themselves live in the app's R2 bucket at
-- texts/<date>/<episode_id>.txt — never inline in D1.
ALTER TABLE player_episodes ADD COLUMN text_state TEXT NOT NULL DEFAULT 'missing';
ALTER TABLE player_episodes ADD COLUMN text_r2_key TEXT NOT NULL DEFAULT '';

-- v324 migration 0009 — external tracks in the player store (Plan
-- §2.3): three additive columns on v312's player_episodes, in 0008's
-- idiom. kind separates the podcast's own episodes ('episode', the
-- default every pre-v324 row and write reads) from external RSS
-- tracks ('external', §2.2's nine pinned slots); source carries the
-- display source name for the card's meta line; stream_url carries
-- the feed enclosure URL for a present external row — the audio
-- itself never enters the app store, it streams from the show's own
-- host. Additive-with-defaults: no table rebuild, and pre-v324 code
-- paths read the defaults and behave exactly as before.
ALTER TABLE player_episodes ADD COLUMN kind TEXT NOT NULL DEFAULT 'episode';
ALTER TABLE player_episodes ADD COLUMN source TEXT NOT NULL DEFAULT '';
ALTER TABLE player_episodes ADD COLUMN stream_url TEXT NOT NULL DEFAULT '';

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
