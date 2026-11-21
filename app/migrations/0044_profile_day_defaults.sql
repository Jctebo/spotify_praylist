-- v590 migration 0044 — Prayer Profiles per-day defaults
-- (Plan §2.6, Amendment 2): the state singleton gains the
-- weekday→profile-key map as a JSON text column. Absent /
-- NULL = no per-day defaults = the pre-v590 resolution
-- exactly. Contents ride the profiles' layers JSON under
-- their own key — no column stands for them. Additive
-- only: no standing table is touched.
ALTER TABLE prayer_profile_state ADD COLUMN day_defaults TEXT;
