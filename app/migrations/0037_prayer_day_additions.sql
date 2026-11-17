-- v510 migration 0037 — the day's Praylist additions
-- (Scope §1, Plan §2.1): the prayers John slots into
-- today's Praylist from their prayer-book pages. One row
-- per addition, keyed by the presented (Chicago) date:
-- the block it stands in, the prayer slug, the language
-- of the added track, and its anchor in the block —
-- after_id '' stands at the block's head, an episodeId
-- stands directly after that item, NULL stands at the
-- block's tail. seq is the day's insertion order, stamped
-- by the session PUT's whole-list replace (the favorites
-- discipline). The rows are today-only by construction:
-- the day payload folds exactly the presented date's
-- rows, so yesterday's additions never fold into today.
--
-- No down-migration (the house posture): a rollback to
-- pre-v510 code reads a payload without the fold (its
-- playerDayPayload does not know the table) and the
-- additions simply do not stand.
CREATE TABLE IF NOT EXISTS prayer_day_additions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  block TEXT NOT NULL,
  slug TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  after_id TEXT,
  seq INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_prayer_day_additions_date ON prayer_day_additions (date, seq);
