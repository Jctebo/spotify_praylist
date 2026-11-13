-- v390 migration 0018 — the Podcasts series generalization's two
-- data acts (Plan §2.4). Applied via the connector D1 route at
-- Ship, BEFORE the Worker deploy, with read-backs (the v381
-- §2.8 order: migration, read-back, then deploy). Implement
-- builds this file; it does not apply it.
--
-- Act 1 — widen the podcast_listens source check for the seed.
-- Migration 0017's CHECK admits only ('auto','manual'); §1 D3's
-- seed rows carry source 'seed' — neither auto nor manual is
-- true of them — and cannot be written until the check widens.
-- SQLite table-rebuild idiom: identical columns and primary
-- key, the widened CHECK, every row copied across. Read-back
-- (Ship): the row count and a full-content hash of
-- podcast_listens are identical before and after — Catechism's
-- standing marks pass through untouched — and the new check
-- accepts 'seed' while still rejecting any fourth value.

CREATE TABLE podcast_listens_new (
  series TEXT NOT NULL,
  seq_key TEXT NOT NULL,
  listened_at TEXT NOT NULL,
  listen_date TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('auto','manual','seed')),
  PRIMARY KEY (series, seq_key)
);

INSERT INTO podcast_listens_new (series, seq_key, listened_at, listen_date, source)
  SELECT series, seq_key, listened_at, listen_date, source FROM podcast_listens;

DROP TABLE podcast_listens;

ALTER TABLE podcast_listens_new RENAME TO podcast_listens;

-- Act 2 — retire the Bible in a Year source-mapping row (§1
-- D4, §2.6). Bible in a Year stands in Morning by this one row
-- (player_source_settings source_key='bible-in-a-year', family
-- external, slot ext-bible-in-a-year, block Morning, sort 6,
-- role primary, seeded by migration 0010; no fallback row
-- exists). Deleting it is the retirement, complete in itself:
-- the Worker's courier leg finds no row and contributes no
-- entry, and the Settings exact-set rule means no settings
-- write can put it back — resurrection would take a new
-- migration. The meta bump carries the settings version
-- forward like a settings write, so every device re-reads the
-- smaller set at next open. This act is NOT reversed by a
-- rollback (Plan §2.9): the deleted row stays deleted.

DELETE FROM player_source_settings WHERE source_key = 'bible-in-a-year';

UPDATE player_settings_meta SET version = version + 1, updated_at = '2026-11-12T00:00:00.000Z' WHERE id = 1;
