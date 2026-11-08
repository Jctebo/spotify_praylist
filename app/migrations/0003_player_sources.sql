-- v305 migration 0003 — player_sources: the prayer/block playback
-- mapping AS DATA (Amendment 3), editable in-app, never hard-coded.
-- source_kind: 'segment' (an in-app file route, url in rss_url),
-- 'rss' (a feed episode matched by title prefix, enclosure at read
-- time), 'playlist' (Spotify playlist only — link route).
-- Seed: the six blocks' Spotify Praylist URLs verbatim from the
-- midnight job sheet, as the block-level playlist routes, plus the
-- one episode mapping the approved mockup itself attests
-- ("Morning Prayer" plays under the Morning block).
CREATE TABLE player_sources (
  id INTEGER PRIMARY KEY,
  block TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  source_kind TEXT NOT NULL DEFAULT 'playlist',
  rss_url TEXT NOT NULL DEFAULT '',
  spotify_url TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0
);
INSERT INTO player_sources (block, title, source_kind, rss_url, spotify_url, sort) VALUES
  ('Morning',    'Morning',    'playlist', '', 'https://open.spotify.com/playlist/0sy9eBsySKuCppI0PxXRJN', 10),
  ('Midmorning', 'Midmorning', 'playlist', '', 'https://open.spotify.com/playlist/3EYFgLhMGEfILn6bRJgHJm', 20),
  ('Midday',     'Midday',     'playlist', '', 'https://open.spotify.com/playlist/4gQAaPAMiezBaDaoqK6sFQ', 30),
  ('Afternoon',  'Afternoon',  'playlist', '', 'https://open.spotify.com/playlist/7cyrM9f9LXEfmoqwZvUaXW', 40),
  ('Evening',    'Evening',    'playlist', '', 'https://open.spotify.com/playlist/6HNvFLWRShih7lgtwHTqXU', 50),
  ('Night',      'Night',      'playlist', '', 'https://open.spotify.com/playlist/1TAlNiKHMc41cT0fvkYxTD', 60),
  ('Morning',    'Morning Prayer', 'rss', '', '', 15);
