-- v486 migration 0031 — the Mass formulary cache: one row per
-- formulary key (season/week/part · saint slug · common), holding
-- the extracted ICEL propers JSON the Worker pulled from the
-- published Missal source. A cache only: no user data, no prayer
-- book rows; an absent row is the not-yet-fetched state and an
-- empty body is a failed extraction (re-tried after 24h by the
-- reader). The Missal texts do not change, so standing rows are
-- permanent.
CREATE TABLE mass_cache (
  key TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
