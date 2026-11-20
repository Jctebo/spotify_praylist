-- v549 migration 0042 — the day's Praylist additions widen
-- (Plan §2.6): a row is one of two kinds — a book prayer
-- (kind 'prayer', the v510 shape; every standing row reads
-- as one) or the day's Daily Readings episode (kind
-- 'reading', slug pinned to 'daily-readings', ref carrying
-- the episode's GUID, which was date-matched when the row
-- was written). Schema only: no standing row moves and no
-- data is rewritten — the profile defaults (Plan §2.7) and
-- the Summa marks carry (Plan §2.2) are guarded Ship steps,
-- not SQL.
--
-- No down-migration (the house posture): a rollback to
-- pre-v549 code names only the four standing columns in
-- its reads and writes, and any reading rows simply do
-- not stand.
ALTER TABLE prayer_day_additions ADD COLUMN kind TEXT NOT NULL DEFAULT 'prayer';
ALTER TABLE prayer_day_additions ADD COLUMN ref TEXT;
