-- v453 migration 0025 — a kind on each examination entry.
-- Entries gain a KIND — Sin | Reflection (release document
-- §1: D1 A · D2 A · D3 A, approved as amended twice). The
-- column is additive with a constant default — the standing
-- safe form, no table rebuild: every standing row reads
-- 'sin', exactly as the Scope rules standing entries do.
-- The server writes 'reflection' only when the entry form's
-- switch stands there and folds anything else to 'sin'; the
-- column's values are 'sin' | 'reflection'.
ALTER TABLE exam_entries ADD COLUMN kind TEXT NOT NULL DEFAULT 'sin';
