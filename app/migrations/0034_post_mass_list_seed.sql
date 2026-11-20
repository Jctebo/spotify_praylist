-- v505 migration 0034 — the Post-Mass Prayers list seed
-- (Scope §1, Plan §2): the after-Mass seat becomes the
-- Post-Mass Prayers section's one ordered list. Its
-- initial state is the traditional post-Mass set merged
-- with the standing picks: the set in its order first —
-- anima-christi (the customary first thanksgiving) ·
-- act-of-faith · act-of-hope · act-of-charity (the acts
-- of thanksgiving) · hail-mary · hail-holy-queen ·
-- st-michael (the Leonine prayers) — then any standing
-- pick not in the set, in its saved order; duplicates
-- fold into one entry (a slug takes its earliest
-- ordinal). Data-only: no schema change, no other seat
-- touched. Where no 'aftermass' row stands, the row is
-- inserted carrying the set.
UPDATE mass_personal_prayer
SET slugs = (
  SELECT json_group_array(slug)
  FROM (
    SELECT slug FROM (
      SELECT slug, MIN(ord) AS mo FROM (
        SELECT value AS slug, key AS ord FROM json_each('["anima-christi","act-of-faith","act-of-hope","act-of-charity","hail-mary","hail-holy-queen","st-michael"]')
        UNION ALL
        SELECT value AS slug, 1000 + key AS ord
        FROM json_each(COALESCE((SELECT slugs FROM mass_personal_prayer WHERE seat = 'aftermass'), '[]'))
      ) GROUP BY slug ORDER BY mo
    )
  )
),
updated_at = '2026-11-17T00:00:00.000Z'
WHERE seat = 'aftermass';
INSERT INTO mass_personal_prayer (seat, slugs, updated_at)
SELECT 'aftermass',
  '["anima-christi","act-of-faith","act-of-hope","act-of-charity","hail-mary","hail-holy-queen","st-michael"]',
  '2026-11-17T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM mass_personal_prayer WHERE seat = 'aftermass');
