-- v356 migration 0014 — the Confession PIN credential store
-- (Plan §2.1): one singleton row holds the PIN + recovery-code
-- PBKDF2 hashes and the shared attempt counter; a second table
-- holds live verification tokens by their SHA-256 hash (the token
-- itself is 32 random bytes, shown to the client once at issuance;
-- revocation is deletion of these rows).
--
-- What 0014 does NOT do: no seed rows (the absence of a pin_state
-- row IS the no-PIN-set state — the content stands open until John
-- sets a PIN; the first Set inserts the row) · no changes to
-- existing tables · no player-settings meta increment (the PIN is
-- not a source-mapping row).

CREATE TABLE pin_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pin_hash TEXT NOT NULL, pin_salt TEXT NOT NULL, pin_iterations INTEGER NOT NULL,
  recovery_hash TEXT NOT NULL, recovery_salt TEXT NOT NULL, recovery_iterations INTEGER NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  next_allowed_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE pin_tokens (
  token_hash TEXT PRIMARY KEY,
  issued_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX idx_pin_tokens_expires ON pin_tokens (expires_at);
