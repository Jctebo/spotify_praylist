-- v337 migration 0011 — the contract-defaults alignment (Plan §2.5):
-- the contracts bundle (matching + default order + block membership)
-- is the shared source of truth for the Spotify Praylists and this
-- app (John, 2026-11-09 06:59 CT: "reuse the contract, apply in two
-- different contexts"); the v328 Settings layer rides ON TOP of these
-- defaults as the user's overrides, and the user's own moves win.
-- Four contents: (A) the defaults alignment of
-- player_source_settings + the meta version increment; (B) the two
-- new external rows and the Saint of the Day conversion; (C) the
-- standing intro family index (Plan §2.7); (D) the player_episodes
-- primary-key widening §2.6's placement mechanism requires.
--
-- PART (D) — NAMED DEVIATION FROM §2.5's "no player_episodes shape
-- change" line, taken at Implement on first-hand schema evidence:
-- migration 0007 keys player_episodes PRIMARY KEY (date,
-- episode_id) with block as a plain column, so one episode can
-- stand in exactly ONE block per date — §2.6's push-time
-- replication (one manifest entry per enabled block row, payload
-- listing the episode in Morning, Midday, and Evening, harness
-- leg 9) is unrepresentable in that key: the commit's ON CONFLICT
-- would collapse the three placements into the last one's block.
-- §2.5's no-shape-change line rests on §1 finding 3, which
-- examined the key for DATE multiplicity only. The widening below
-- — PRIMARY KEY (date, episode_id, block) — is the minimal change
-- under which every other §2 pin stands verbatim: ordering stays
-- in the stored sort (no second, payload-time path — §2.6's stated
-- reason for rejecting the alternative), and the stored read-back
-- counts placements truthfully (§2.6's own words). The table's
-- rows are nightly re-pushes under a four-date retention; no
-- irreplaceable data rides the rebuild. The deviation is named in
-- the release's §3 for Review's ruling.
--
-- THE OVERRIDE GUARD (John's 06:59 model made mechanical): every
-- UPDATE below applies ONLY where the row still stands at its 0010
-- seed values — each WHERE clause pins the seeded sort_order and
-- block (and, for the Saint conversion, family='spotify' AND
-- slot_id IS NULL). A row a user has already moved fails its guard,
-- stands untouched, and is named as a held override in the release
-- record. INSERTs are of genuinely new keys (absent from 0010) and
-- cannot collide with a user move. The meta increment is
-- unconditional and RELATIVE (version + 1, never a literal): it is
-- what invalidates the v334 device day-cache on next open.
-- Readings (usccb-daily-readings) and the Mass/Homilies unplaced
-- rows are NOT touched — they belong to v339 under John's rulings.

-- (C) The standing intro family index: one row per pushed intro at
-- the sentinel date 'current' (the v335 standing shape, per track).
CREATE TABLE prayer_intros (
  date TEXT NOT NULL,
  episode_id TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  pushed_at TEXT NOT NULL,
  PRIMARY KEY (date, episode_id)
);

-- (D) player_episodes: the primary key widens to (date, episode_id,
-- block) so one episode can stand placed in several blocks on one
-- date (§2.6). Column set carried verbatim from 0007 + 0008 + 0009;
-- every standing row is copied; the date/sort index is recreated.
CREATE TABLE player_episodes_v337 (
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
  text_state TEXT NOT NULL DEFAULT 'missing',
  text_r2_key TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'episode',
  source TEXT NOT NULL DEFAULT '',
  stream_url TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (date, episode_id, block)
);
INSERT INTO player_episodes_v337 (date, episode_id, title, block, sort, duration_s, r2_key, size_bytes, audio_state, pushed_at, text_state, text_r2_key, kind, source, stream_url)
  SELECT date, episode_id, title, block, sort, duration_s, r2_key, size_bytes, audio_state, pushed_at, text_state, text_r2_key, kind, source, stream_url FROM player_episodes;
DROP TABLE player_episodes;
ALTER TABLE player_episodes_v337 RENAME TO player_episodes;
CREATE INDEX idx_player_episodes_date_sort ON player_episodes (date, sort);

-- (A) Morning — bundle order: Invitatory 1 · Morning Prayer 2 ·
-- Divine Office Morning Prayer 3 · Daily Rosary 4 · Bible in a
-- Year 5 · Marian Antiphon 6; the Sing the Hours Lauds fallback
-- follows its slot (ext-morning-prayer stands at 3).
UPDATE player_source_settings SET sort_order = 1, updated_at = '2026-11-09T15:00:00.000Z'
  WHERE source_key = 'do-invitatory' AND block = 'Morning' AND sort_order = 4;
UPDATE player_source_settings SET sort_order = 2, updated_at = '2026-11-09T15:00:00.000Z'
  WHERE source_key = 'morning-prayer' AND block = 'Morning' AND sort_order = 1;
UPDATE player_source_settings SET sort_order = 3, updated_at = '2026-11-09T15:00:00.000Z'
  WHERE source_key = 'do-morning-prayer' AND block = 'Morning' AND sort_order = 5;
UPDATE player_source_settings SET sort_order = 3, updated_at = '2026-11-09T15:00:00.000Z'
  WHERE source_key = 'sth-lauds' AND block = 'Morning' AND sort_order = 5;
UPDATE player_source_settings SET sort_order = 4, updated_at = '2026-11-09T15:00:00.000Z'
  WHERE source_key = 'daily-rosary' AND block = 'Morning' AND sort_order = 2;
UPDATE player_source_settings SET sort_order = 5, updated_at = '2026-11-09T15:00:00.000Z'
  WHERE source_key = 'bible-in-a-year' AND block = 'Morning' AND sort_order = 6;
UPDATE player_source_settings SET sort_order = 6, updated_at = '2026-11-09T15:00:00.000Z'
  WHERE source_key = 'marian-antiphon' AND block = 'Morning' AND sort_order = 3;

-- (A)+(B) Midmorning — Daily Gospel Exegesis 1 (NEW row) · Novenas
-- 2 · Divine Office Midmorning Prayer 3.
INSERT INTO player_source_settings (source_key, name, family, block, day_rule, sort_order, enabled, slot_id, role, updated_at) VALUES
  ('daily-gospel-exegesis', 'Daily Gospel Exegesis', 'external', 'Midmorning', 'daily', 1, 1, 'ext-gospel-exegesis', 'primary', '2026-11-09T15:00:00.000Z');
UPDATE player_source_settings SET sort_order = 2, updated_at = '2026-11-09T15:00:00.000Z'
  WHERE source_key = 'novenas' AND block = 'Midmorning' AND sort_order = 1;
UPDATE player_source_settings SET sort_order = 3, updated_at = '2026-11-09T15:00:00.000Z'
  WHERE source_key = 'do-midmorning-prayer' AND block = 'Midmorning' AND sort_order = 2;

-- (A) Midday — the Marian Antiphon stands here too (NEW row for the
-- same own episode, §2.6's push-time replication places it) ·
-- Divine Office Midday Prayer 2.
INSERT INTO player_source_settings (source_key, name, family, block, day_rule, sort_order, enabled, slot_id, role, updated_at) VALUES
  ('marian-antiphon-midday', 'Marian Antiphon — Angelus', 'own', 'Midday', 'daily', 1, 1, NULL, 'primary', '2026-11-09T15:00:00.000Z');
UPDATE player_source_settings SET sort_order = 2, updated_at = '2026-11-09T15:00:00.000Z'
  WHERE source_key = 'do-midday-prayer' AND block = 'Midday' AND sort_order = 1;

-- (A)+(B) Afternoon — Saint of the Day 1 (converted from its
-- 'spotify' seed row to a playable external slot) · Auxilium
-- Christianorum 2 · Divine Office Midafternoon Prayer 3 (stands).
UPDATE player_source_settings SET family = 'external', slot_id = 'ext-saint-of-the-day', sort_order = 1, updated_at = '2026-11-09T15:00:00.000Z'
  WHERE source_key = 'saint-of-the-day' AND family = 'spotify' AND slot_id IS NULL AND block = 'Afternoon' AND sort_order = 2;
UPDATE player_source_settings SET sort_order = 2, updated_at = '2026-11-09T15:00:00.000Z'
  WHERE source_key = 'auxilium-christianorum' AND block = 'Afternoon' AND sort_order = 1;

-- (A) Evening — Office of Readings 1 (stands) · the Marian
-- Antiphon 2 (NEW row, same own episode) · Divine Office Evening
-- Prayer 3; the Sing the Hours Vespers fallback follows its slot.
INSERT INTO player_source_settings (source_key, name, family, block, day_rule, sort_order, enabled, slot_id, role, updated_at) VALUES
  ('marian-antiphon-evening', 'Marian Antiphon — Angelus', 'own', 'Evening', 'daily', 2, 1, NULL, 'primary', '2026-11-09T15:00:00.000Z');
UPDATE player_source_settings SET sort_order = 3, updated_at = '2026-11-09T15:00:00.000Z'
  WHERE source_key = 'do-evening-prayer' AND block = 'Evening' AND sort_order = 2;
UPDATE player_source_settings SET sort_order = 3, updated_at = '2026-11-09T15:00:00.000Z'
  WHERE source_key = 'sth-vespers' AND block = 'Evening' AND sort_order = 2;

-- Night stands unchanged (Daily Reflection 1 · Night Prayer 2).

-- The meta increment: relative, unconditional — production may
-- stand above 1 by the time this applies; version + 1 is the rule.
UPDATE player_settings_meta SET version = version + 1, updated_at = '2026-11-09T15:00:00.000Z' WHERE id = 1;
