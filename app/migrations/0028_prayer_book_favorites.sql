-- v470 migration 0028 — the prayer book favorites (Scope §1.1,
-- Plan §2.1): ONE additive table on the prayer-app D1,
-- pre-assigned number 0028. Nothing existing is altered; a
-- rollback leaves the table standing and unused (0021's
-- posture — no down-migration is written).
--
-- prayer_book_favorites — John's own favorites in the written
-- prayer book (v462 shipped them device-local under
-- opn-book-favs-v462; an app upgrade took them, §1.1): one row
-- per favorited prayer, keyed by the book's slug (0026's
-- UNIQUE key), its favorites-list position the sort_order.
-- The table holds ONLY the user's favorites — an empty table
-- is the standing state and reads as "no favorites". The
-- session PUT replaces the rows whole in one batch after
-- validating every slug against prayer_book; the agent door
-- reads only (the v328 posture — writes are John's,
-- session-only). The table is 0021's DDL shape verbatim with
-- the key renamed to the book's key.
CREATE TABLE IF NOT EXISTS prayer_book_favorites (
  slug TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
