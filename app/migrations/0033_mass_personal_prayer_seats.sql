-- v501 migration 0033 — the Mass personal prayers, seat-keyed
-- (Scope §1, Plan §2): migration 0032's one-row table
-- generalizes into one row per seat. John (2026-11-17):
-- a single-prayer seat before Communion, a single-prayer
-- seat after Communion, and a multiple-prayer seat after
-- Mass whose prayers stand side by side. Each seat's row
-- carries its slugs as a JSON array: 0 or 1 element at the
-- single seats, the ordered list at aftermass.
--
-- The standing v495 row becomes the 'after' seat with its
-- slug preserved as the array's single element (or '[]'
-- where no row stands or its slug is null), carrying the
-- standing row's updated_at. No down-migration (the house
-- posture): a rollback to pre-v501 code reads a table whose
-- shape its helper does not know, the helper's posture
-- answers unset, and the seats read empty.
CREATE TABLE mass_personal_prayer_seats (
  seat TEXT PRIMARY KEY CHECK (seat IN ('before','after','aftermass')),
  slugs TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);
INSERT INTO mass_personal_prayer_seats (seat, slugs, updated_at) VALUES
  ('before', '[]',
   COALESCE((SELECT updated_at FROM mass_personal_prayer WHERE id = 1), '1970-01-01T00:00:00.000Z')),
  ('after',
   COALESCE((SELECT json_array(slug) FROM mass_personal_prayer WHERE id = 1 AND slug IS NOT NULL), '[]'),
   COALESCE((SELECT updated_at FROM mass_personal_prayer WHERE id = 1), '1970-01-01T00:00:00.000Z')),
  ('aftermass', '[]',
   COALESCE((SELECT updated_at FROM mass_personal_prayer WHERE id = 1), '1970-01-01T00:00:00.000Z'));
DROP TABLE mass_personal_prayer;
ALTER TABLE mass_personal_prayer_seats RENAME TO mass_personal_prayer;
