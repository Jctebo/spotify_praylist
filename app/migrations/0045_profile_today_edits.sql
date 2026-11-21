-- v594 Part 2 migration 0045 — Prayer Profiles today layers
-- (Plan §2.1): the state singleton gains the per-date
-- today-layer map as a JSON text column (date -> layer).
-- Absent / NULL = no layers = the pre-Part-2 fold exactly.
-- Additive only: no standing table is touched.
ALTER TABLE prayer_profile_state ADD COLUMN today_edits TEXT;
