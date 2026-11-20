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
