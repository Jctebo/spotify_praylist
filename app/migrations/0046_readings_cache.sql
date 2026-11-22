-- v608 migration 0046 — the Mass readings display cache: one
-- row per date, holding the full merged readings payload JSON
-- (the USCCB Daily Readings RSS feed's day, memorial sets
-- merged in) the nightly grab pulled from the feed. A
-- short-term DISPLAY cache under the USCCB RSS display
-- clause — the feed's own current readings, shown on the
-- site — NOT an archive: rows stand in a rolling 35-day
-- window, pruned on each grab, and a date the store does
-- not carry is pulled live at serve time exactly as before.
-- No user data.
CREATE TABLE readings_cache (
  date TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
