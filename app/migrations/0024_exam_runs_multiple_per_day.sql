-- v445 migration 0024 — multiple examinations in a day.
-- Implement finding against the release document §1: its
-- premise that one-run-per-date was a read-side accident is
-- wrong at the schema — migration 0004 created exam_runs
-- with date TEXT NOT NULL UNIQUE, so a second run for a
-- date cannot insert until the constraint drops. SQLite
-- table-rebuild idiom (migration 0018's form): identical
-- columns and primary key, the UNIQUE on date dropped,
-- every row copied across with its id — exam_entries keep
-- their run_id links untouched (run_id is a plain column;
-- no foreign key and no index stands on exam_runs besides
-- the unique autoindex this rebuild retires). Applied via
-- the connector D1 route at Ship, BEFORE the Worker
-- deploy, with read-backs: the row count and the full
-- content of exam_runs are identical before and after, and
-- a second run for one date inserts clean after. Implement
-- builds this file; it does not apply it.

CREATE TABLE exam_runs_new (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open',
  opened_at TEXT NOT NULL,
  closed_at TEXT
);

INSERT INTO exam_runs_new (id, date, state, opened_at, closed_at)
  SELECT id, date, state, opened_at, closed_at FROM exam_runs;

DROP TABLE exam_runs;

ALTER TABLE exam_runs_new RENAME TO exam_runs;
