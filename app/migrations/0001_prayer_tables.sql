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
