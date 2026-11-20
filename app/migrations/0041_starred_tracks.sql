-- v546: starred tracks — John's one star list (Q4 A of scope
-- package 49 "starred-tracks", approval 37). One row per star:
-- star_key is the track's own key in one string —
-- 'episode:<episodeId>' · 'podcast:<series>:<seqKey>' ·
-- 'prayer:<slug>' — sort_order is the list order (most
-- recently starred first; the client owns the order, the
-- server stores it), entry is the star's JSON snapshot (the
-- display/play fallback for a track no live source still
-- carries). Written whole-list through the session PUT
-- /api/prayer/starred in the v470 prayer-book discipline.
-- Additive in the 0028 mold: no down-migration; a rollback
-- leaves the table standing and unused. The 0028
-- prayer_book_favorites table stands unmodified as the
-- carry-in source — the book star and this list are ONE
-- system, the client carries the book favorites in once.
CREATE TABLE IF NOT EXISTS starred_tracks (
  star_key TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL,
  entry TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
