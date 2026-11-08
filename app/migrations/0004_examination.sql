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
