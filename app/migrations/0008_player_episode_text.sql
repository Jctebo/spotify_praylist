-- v318 migration 0008 — player episode texts (app half, Plan T7): the
-- read-along text state on v312's player_episodes, in 0007's idiom.
-- text_state mirrors audio_state ('present' | 'missing'); text_r2_key
-- mirrors r2_key and is empty only on a missing row. The text bytes
-- themselves live in the app's R2 bucket at
-- texts/<date>/<episode_id>.txt — never inline in D1.
ALTER TABLE player_episodes ADD COLUMN text_state TEXT NOT NULL DEFAULT 'missing';
ALTER TABLE player_episodes ADD COLUMN text_r2_key TEXT NOT NULL DEFAULT '';
