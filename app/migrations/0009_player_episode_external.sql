-- v324 migration 0009 — external tracks in the player store (Plan
-- §2.3): three additive columns on v312's player_episodes, in 0008's
-- idiom. kind separates the podcast's own episodes ('episode', the
-- default every pre-v324 row and write reads) from external RSS
-- tracks ('external', §2.2's nine pinned slots); source carries the
-- display source name for the card's meta line; stream_url carries
-- the feed enclosure URL for a present external row — the audio
-- itself never enters the app store, it streams from the show's own
-- host. Additive-with-defaults: no table rebuild, and pre-v324 code
-- paths read the defaults and behave exactly as before.
ALTER TABLE player_episodes ADD COLUMN kind TEXT NOT NULL DEFAULT 'episode';
ALTER TABLE player_episodes ADD COLUMN source TEXT NOT NULL DEFAULT '';
ALTER TABLE player_episodes ADD COLUMN stream_url TEXT NOT NULL DEFAULT '';
